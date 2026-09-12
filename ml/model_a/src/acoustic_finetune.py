"""A7 CTC fine-tuning utilities for native or expert-verified pronunciation audio only."""

from __future__ import annotations

import inspect
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Literal

from .audio import AudioPreparationError, load_waveform, inspect_wav
from .config import load_config


NATIVE_SCHEMA_VERSION = "a7-native-ctc-v1"
VALID_LABEL_SOURCES = frozenset({"native", "expert_verified_realized"})
VALID_SPLITS = frozenset({"train", "validation"})


class AcousticFineTuneError(ValueError):
    """Raised when CTC training data violates the A7 safety contract."""


@dataclass(frozen=True)
class AcousticFineTuneConfig:
    model_id: str
    local_files_only: bool
    sample_rate: int
    max_audio_seconds: float
    train_batch_size: int
    eval_batch_size: int
    gradient_accumulation_steps: int
    head_learning_rate: float
    encoder_learning_rate: float
    num_train_epochs: float
    logging_steps: int
    eval_steps: int
    save_steps: int
    save_total_limit: int
    freeze_feature_extractor: bool
    unfreeze_last_encoder_blocks: int
    gradient_checkpointing: bool
    fp16: bool


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_CONFIG_PATH = PROJECT_ROOT / "configs" / "acoustic_finetune.json"


def load_acoustic_config(path: Path | None = None) -> AcousticFineTuneConfig:
    payload = json.loads((path or DEFAULT_CONFIG_PATH).read_text(encoding="utf-8"))
    return AcousticFineTuneConfig(
        model_id=str(payload["modelId"]),
        local_files_only=bool(payload.get("localFilesOnly", False)),
        sample_rate=int(payload["sampleRate"]),
        max_audio_seconds=float(payload["maxAudioSeconds"]),
        train_batch_size=int(payload["perDeviceTrainBatchSize"]),
        eval_batch_size=int(payload["perDeviceEvalBatchSize"]),
        gradient_accumulation_steps=int(payload["gradientAccumulationSteps"]),
        head_learning_rate=float(payload["headLearningRate"]),
        encoder_learning_rate=float(payload["encoderLearningRate"]),
        num_train_epochs=float(payload["numTrainEpochs"]),
        logging_steps=int(payload["loggingSteps"]),
        eval_steps=int(payload["evalSteps"]),
        save_steps=int(payload["saveSteps"]),
        save_total_limit=int(payload["saveTotalLimit"]),
        freeze_feature_extractor=bool(payload["freezeFeatureExtractor"]),
        unfreeze_last_encoder_blocks=int(payload["unfreezeLastEncoderBlocks"]),
        gradient_checkpointing=bool(payload["gradientCheckpointing"]),
        fp16=bool(payload["fp16"]),
    )


def read_native_manifest(path: Path) -> list[dict[str, Any]]:
    if not path.is_file():
        raise AcousticFineTuneError(f"Native CTC manifest was not found: {path}")
    rows: list[dict[str, Any]] = []
    for line_number, raw in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
        if not raw.strip():
            continue
        try:
            row = json.loads(raw)
        except json.JSONDecodeError as error:
            raise AcousticFineTuneError(f"Invalid JSON on line {line_number}: {error.msg}") from error
        if not isinstance(row, dict):
            raise AcousticFineTuneError(f"Line {line_number} must be a JSON object.")
        row["_line"] = line_number
        rows.append(row)
    if not rows:
        raise AcousticFineTuneError("Native CTC manifest has no rows.")
    return rows


def validate_native_rows(rows: list[dict[str, Any]], *, recordings_root: Path | None = None) -> list[str]:
    """Validate that only acoustic labels safe for CTC loss are admitted."""
    config = load_config()
    issues: list[str] = []
    speaker_splits: dict[str, set[str]] = {}
    ids: set[str] = set()
    for fallback, row in enumerate(rows, start=1):
        line = int(row.get("_line", fallback))
        required = ("recordingId", "audioPath", "speakerId", "split", "phonemesCtc", "labelSource")
        missing = [field for field in required if not isinstance(row.get(field), str) or not row[field].strip()]
        if missing:
            issues.append(f"line {line}: required non-empty fields missing: {', '.join(missing)}")
            continue
        if row.get("schemaVersion") != NATIVE_SCHEMA_VERSION:
            issues.append(f"line {line}: schemaVersion must be {NATIVE_SCHEMA_VERSION}")
        if row["recordingId"] in ids:
            issues.append(f"line {line}: duplicate recordingId {row['recordingId']}")
        ids.add(row["recordingId"])
        audio_path = Path(row["audioPath"])
        if audio_path.is_absolute() or ".." in audio_path.parts or audio_path.suffix.lower() != ".wav":
            issues.append(f"line {line}: audioPath must be a relative .wav without '..'")
        if row["split"] not in VALID_SPLITS:
            issues.append(f"line {line}: split must be train or validation")
        speaker_splits.setdefault(row["speakerId"], set()).add(row["split"])
        if row["labelSource"] not in VALID_LABEL_SOURCES:
            issues.append(f"line {line}: labelSource must be native or expert_verified_realized; learner intended text is forbidden")
        phonemes = row["phonemesCtc"].split()
        if not phonemes:
            issues.append(f"line {line}: phonemesCtc must contain at least one phone")
        unknown = sorted(set(phonemes) - config.reference_vocabulary)
        if unknown:
            issues.append(f"line {line}: phonemesCtc has phones outside baseline vocabulary: {', '.join(unknown)}")
        # A learner recording is acceptable only if an expert supplied the
        # realised phoneme sequence, never merely the intended sentence text.
        if row["labelSource"] == "expert_verified_realized" and row.get("realizedPhonemes") != row["phonemesCtc"]:
            issues.append(f"line {line}: expert_verified_realized requires realizedPhonemes identical to phonemesCtc")
        if recordings_root is not None and not audio_path.is_absolute() and ".." not in audio_path.parts:
            resolved_root = recordings_root.resolve()
            candidate = (recordings_root / audio_path).resolve()
            try:
                candidate.relative_to(resolved_root)
                info = inspect_wav(candidate)
                if info.sample_rate != 16000 or info.channels != 1 or not 0 < info.duration_seconds <= 8:
                    issues.append(f"line {line}: CTC audio must be mono 16 kHz and 0–8 seconds")
            except (ValueError, AudioPreparationError) as error:
                issues.append(f"line {line}: {error}")
    for speaker, splits in speaker_splits.items():
        if len(splits) > 1:
            issues.append(f"speaker leakage: {speaker} appears in {', '.join(sorted(splits))}")
    return issues


def ctc_required_frames(phonemes: list[str]) -> int:
    """Minimum CTC frames: one per target, plus one between repeated targets."""
    return len(phonemes) + sum(left == right for left, right in zip(phonemes, phonemes[1:]))


def _conv_output_frames(input_frames: int, kernels: list[int], strides: list[int]) -> int:
    result = input_frames
    for kernel, stride in zip(kernels, strides):
        result = (result - kernel) // stride + 1
        if result <= 0:
            return 0
    return result


def find_ctc_unalignable_rows(
    rows: list[dict[str, Any]],
    recordings_root: Path,
    *,
    config: AcousticFineTuneConfig | None = None,
) -> list[dict[str, int | str]]:
    """Find labels that are mathematically impossible for the CTC encoder frames."""
    settings = config or load_acoustic_config()
    try:
        from transformers import AutoConfig
    except ImportError as error:
        raise AcousticFineTuneError("transformers is required to validate CTC frame feasibility.") from error
    model_config = AutoConfig.from_pretrained(settings.model_id, local_files_only=settings.local_files_only)
    kernels = [int(value) for value in getattr(model_config, "conv_kernel", [])]
    strides = [int(value) for value in getattr(model_config, "conv_stride", [])]
    if not kernels or len(kernels) != len(strides):
        raise AcousticFineTuneError("The selected CTC model does not expose valid convolution stride metadata.")

    failures: list[dict[str, int | str]] = []
    for row in rows:
        audio = inspect_wav(recordings_root / str(row["audioPath"]))
        phones = str(row["phonemesCtc"]).split()
        required = ctc_required_frames(phones)
        available = _conv_output_frames(audio.frames, kernels, strides)
        if required > available:
            failures.append({
                "recordingId": str(row["recordingId"]),
                "split": str(row["split"]),
                "requiredFrames": required,
                "availableFrames": available,
            })
    return failures


class NativeCtcDataset:
    """Lazy audio loader: DataLoader never preloads the native corpus into RAM."""

    def __init__(self, rows: list[dict[str, Any]], recordings_root: Path, processor: Any, token_to_id: dict[str, int]):
        self.rows = rows
        self.recordings_root = recordings_root
        self.processor = processor
        self.token_to_id = token_to_id

    def __len__(self) -> int:
        return len(self.rows)

    def __getitem__(self, index: int) -> dict[str, Any]:
        row = self.rows[index]
        waveform = load_waveform(self.recordings_root / row["audioPath"])
        phonemes = row["phonemesCtc"].split()
        try:
            labels = [self.token_to_id[phone] for phone in phonemes]
        except KeyError as error:
            raise AcousticFineTuneError(f"Unknown CTC phoneme in {row['recordingId']}: {error.args[0]}") from error
        return {"input_values": waveform, "labels": labels}


class CtcDataCollator:
    def __init__(self, processor: Any):
        self.processor = processor

    def __call__(self, features: list[dict[str, Any]]) -> dict[str, Any]:
        inputs = self.processor.pad({"input_values": [item["input_values"] for item in features]}, padding=True, return_tensors="pt")
        labels = self.processor.tokenizer.pad({"input_ids": [item["labels"] for item in features]}, padding=True, return_tensors="pt")
        inputs["labels"] = labels.input_ids.masked_fill(labels.attention_mask.ne(1), -100)
        return inputs


def _freeze_for_adapter_finetune(model: Any, config: AcousticFineTuneConfig) -> None:
    if config.freeze_feature_extractor and hasattr(model, "freeze_feature_encoder"):
        model.freeze_feature_encoder()
    encoder = getattr(getattr(model, "hubert", None), "encoder", None)
    layers = list(getattr(encoder, "layers", []))
    frozen_until = max(0, len(layers) - config.unfreeze_last_encoder_blocks)
    for index, layer in enumerate(layers):
        if index < frozen_until:
            for parameter in layer.parameters():
                parameter.requires_grad = False


def _optimizer(model: Any, config: AcousticFineTuneConfig):
    import torch

    head_parameters, encoder_parameters = [], []
    for name, parameter in model.named_parameters():
        if not parameter.requires_grad:
            continue
        (head_parameters if "lm_head" in name else encoder_parameters).append(parameter)
    return torch.optim.AdamW(
        [
            {"params": head_parameters, "lr": config.head_learning_rate},
            {"params": encoder_parameters, "lr": config.encoder_learning_rate},
        ],
        weight_decay=0.01,
    )


def train_native_ctc(
    rows: list[dict[str, Any]],
    recordings_root: Path,
    output_directory: Path,
    *,
    config: AcousticFineTuneConfig | None = None,
) -> dict[str, Any]:
    """Fine-tune CTC only on safe acoustic labels; refuses an existing output directory."""
    settings = config or load_acoustic_config()
    issues = validate_native_rows(rows, recordings_root=recordings_root)
    if issues:
        raise AcousticFineTuneError("Invalid native CTC manifest: " + "; ".join(issues))
    # Some corpora contain short utterances whose automatically generated
    # phoneme sequence cannot physically fit into the encoder's CTC frames.
    # They are unusable training examples, not evidence that their labels are
    # correct after all, so exclude them rather than forcing an invalid loss.
    infeasible = find_ctc_unalignable_rows(rows, recordings_root, config=settings)
    infeasible_ids = {str(item["recordingId"]) for item in infeasible}
    usable_rows = [row for row in rows if str(row["recordingId"]) not in infeasible_ids]
    if output_directory.exists():
        raise AcousticFineTuneError(f"Refusing to overwrite training output directory: {output_directory}")
    try:
        import torch
        from transformers import AutoModelForCTC, AutoProcessor, Trainer, TrainingArguments
    except ImportError as error:
        raise AcousticFineTuneError("torch, transformers and accelerate are required; install requirements-train.txt.") from error
    processor = AutoProcessor.from_pretrained(settings.model_id, local_files_only=settings.local_files_only)
    model = AutoModelForCTC.from_pretrained(settings.model_id, local_files_only=settings.local_files_only)
    _freeze_for_adapter_finetune(model, settings)
    if settings.gradient_checkpointing:
        model.gradient_checkpointing_enable()
    train_rows = [row for row in usable_rows if row["split"] == "train"]
    validation_rows = [row for row in usable_rows if row["split"] == "validation"]
    if not train_rows or not validation_rows:
        raise AcousticFineTuneError("Native CTC manifest needs at least one train and one validation row.")
    token_to_id = {str(token): int(identifier) for token, identifier in processor.tokenizer.get_vocab().items()}
    train_dataset = NativeCtcDataset(train_rows, recordings_root, processor, token_to_id)
    validation_dataset = NativeCtcDataset(validation_rows, recordings_root, processor, token_to_id)
    argument_fields = inspect.signature(TrainingArguments).parameters
    args: dict[str, Any] = {
        "output_dir": str(output_directory),
        "per_device_train_batch_size": settings.train_batch_size,
        "per_device_eval_batch_size": settings.eval_batch_size,
        "gradient_accumulation_steps": settings.gradient_accumulation_steps,
        "num_train_epochs": settings.num_train_epochs,
        "logging_steps": settings.logging_steps,
        "save_steps": settings.save_steps,
        "eval_steps": settings.eval_steps,
        "save_total_limit": settings.save_total_limit,
        "fp16": settings.fp16 and torch.cuda.is_available(),
        "gradient_checkpointing": settings.gradient_checkpointing,
        "remove_unused_columns": False,
        "load_best_model_at_end": True,
        "metric_for_best_model": "eval_loss",
        "greater_is_better": False,
        "report_to": [],
    }
    args["eval_strategy" if "eval_strategy" in argument_fields else "evaluation_strategy"] = "steps"
    args["save_strategy"] = "steps"
    training_args = TrainingArguments(**args)
    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=train_dataset,
        eval_dataset=validation_dataset,
        data_collator=CtcDataCollator(processor),
        optimizers=(_optimizer(model, settings), None),
    )
    trainer.train()
    trainer.save_model(str(output_directory))
    processor.save_pretrained(str(output_directory))
    summary = {
        "schemaVersion": NATIVE_SCHEMA_VERSION,
        "baseModel": settings.model_id,
        "trainingRows": len(train_rows),
        "validationRows": len(validation_rows),
        "excludedUnalignableRows": len(infeasible),
        "freezeFeatureExtractor": settings.freeze_feature_extractor,
        "unfreezeLastEncoderBlocks": settings.unfreeze_last_encoder_blocks,
        "selectionMetric": "eval_loss",
        "note": "This checkpoint only adapts CTC acoustics; learner error classification remains a separate A6 model.",
    }
    (output_directory / "training-summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    return summary
