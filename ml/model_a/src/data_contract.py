"""Private Vietnamese-learner recording manifest contract for Model A training."""

from __future__ import annotations

import copy
import hashlib
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable, Literal

from .audio import AudioPreparationError, inspect_wav, validate_model_audio
from .config import load_config


Split = Literal["train", "validation", "test", "unassigned"]
VALID_SPLITS = frozenset({"train", "validation", "test", "unassigned"})
VALID_LEVELS = frozenset({"N5", "N4", "N3", "N2", "N1", "custom"})
VALID_TARGET_ERRORS = frozenset({"none", "sokuon", "long_vowel", "ts_ch", "r_l", "nasal", "other"})
VALID_PHONE_LABELS = frozenset({"correct", "near_correct", "incorrect", "unscorable"})
VALID_ERROR_TYPES = frozenset({"substitution", "deletion", "insertion", "too_short", "too_long", "unclear"})
VALID_ERROR_PATTERNS = frozenset(
    {
        "ts_to_ch",
        "ts_to_s",
        "sokuon_deleted",
        "sokuon_weak",
        "long_vowel_shortened",
        "long_vowel_lengthened",
        "r_to_l",
        "r_to_d",
        "nasal_confusion",
        "vowel_confusion",
        "other",
    }
)
VALID_RECORDING_QUALITY = frozenset({"usable", "noisy", "clipped", "too_short", "invalid"})


@dataclass(frozen=True)
class ManifestIssue:
    line: int
    message: str


@dataclass(frozen=True)
class ManifestReport:
    row_count: int
    speaker_count: int
    rows_by_split: dict[str, int]
    speakers_by_split: dict[str, int]
    issues: tuple[ManifestIssue, ...]

    @property
    def is_valid(self) -> bool:
        return not self.issues


class ManifestError(ValueError):
    """Raised for malformed JSONL manifests or unsafe output paths."""


def read_jsonl(path: Path) -> list[dict[str, Any]]:
    """Read JSONL while retaining a clear line number for invalid input."""
    if not path.is_file():
        raise ManifestError(f"Manifest was not found: {path}")
    rows: list[dict[str, Any]] = []
    for line_number, raw_line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
        if not raw_line.strip():
            continue
        try:
            row = json.loads(raw_line)
        except json.JSONDecodeError as error:
            raise ManifestError(f"Invalid JSON on line {line_number}: {error.msg}") from error
        if not isinstance(row, dict):
            raise ManifestError(f"Line {line_number} must be a JSON object.")
        row["_manifestLine"] = line_number
        rows.append(row)
    if not rows:
        raise ManifestError("Manifest has no rows.")
    return rows


def write_jsonl(path: Path, rows: Iterable[dict[str, Any]]) -> None:
    """Write a new manifest; never overwrite an existing private dataset."""
    if path.exists():
        raise ManifestError(f"Refusing to overwrite existing manifest: {path}")
    path.parent.mkdir(parents=True, exist_ok=True)
    serialized = []
    for row in rows:
        clean_row = {key: value for key, value in row.items() if key != "_manifestLine"}
        serialized.append(json.dumps(clean_row, ensure_ascii=False, sort_keys=True))
    path.write_text("\n".join(serialized) + "\n", encoding="utf-8")


def _is_nonempty_string(value: Any) -> bool:
    return isinstance(value, str) and bool(value.strip())


def _valid_relative_audio_path(value: Any) -> bool:
    if not _is_nonempty_string(value):
        return False
    path = Path(value)
    return not path.is_absolute() and ".." not in path.parts and path.suffix.lower() == ".wav"


def _line(row: dict[str, Any], fallback: int) -> int:
    return int(row.get("_manifestLine", fallback))


def _validate_annotation(row: dict[str, Any], line: int, issues: list[ManifestIssue], phonemes: list[str]) -> None:
    annotation = row.get("annotation")
    if annotation is None:
        return
    if not isinstance(annotation, dict):
        issues.append(ManifestIssue(line, "annotation must be an object when present."))
        return
    labels = annotation.get("phoneLabels")
    if not isinstance(labels, list) or not labels:
        issues.append(ManifestIssue(line, "annotation.phoneLabels must be a non-empty list."))
    else:
        raw_target_indices = row.get("targetPhoneIndices", [])
        target_indices = set(raw_target_indices) if isinstance(raw_target_indices, list) else set()
        seen_indices: set[int] = set()
        for position, label in enumerate(labels):
            prefix = f"annotation.phoneLabels[{position}]"
            if not isinstance(label, dict):
                issues.append(ManifestIssue(line, f"{prefix} must be an object."))
                continue
            index = label.get("phoneIndex")
            if not isinstance(index, int) or not 0 <= index < len(phonemes):
                issues.append(ManifestIssue(line, f"{prefix}.phoneIndex is outside phonemesRef."))
                continue
            if index not in target_indices:
                issues.append(ManifestIssue(line, f"{prefix} must label a pre-selected targetPhoneIndex during the pilot."))
            if index in seen_indices:
                issues.append(ManifestIssue(line, f"{prefix}.phoneIndex is duplicated."))
            seen_indices.add(index)
            if label.get("phone") != phonemes[index]:
                issues.append(ManifestIssue(line, f"{prefix}.phone must match phonemesRef at phoneIndex."))
            if label.get("label") not in VALID_PHONE_LABELS:
                issues.append(ManifestIssue(line, f"{prefix}.label is invalid."))
            error_type = label.get("errorType")
            if error_type is not None and error_type not in VALID_ERROR_TYPES:
                issues.append(ManifestIssue(line, f"{prefix}.errorType is invalid."))
            error_pattern = label.get("errorPattern")
            if error_pattern is not None and error_pattern not in VALID_ERROR_PATTERNS:
                issues.append(ManifestIssue(line, f"{prefix}.errorPattern is invalid."))
            if label.get("label") == "correct" and (error_type is not None or error_pattern is not None):
                issues.append(ManifestIssue(line, f"{prefix} cannot have an errorType/errorPattern when label is correct."))
            confidence = label.get("raterConfidence")
            if not isinstance(confidence, int) or not 1 <= confidence <= 5:
                issues.append(ManifestIssue(line, f"{prefix}.raterConfidence must be an integer from 1 to 5."))
        missing_targets = target_indices - seen_indices
        if missing_targets:
            issues.append(ManifestIssue(line, "annotation.phoneLabels must cover every targetPhoneIndex during the pilot."))
    intelligibility = annotation.get("sentenceIntelligibility")
    if not isinstance(intelligibility, int) or not 1 <= intelligibility <= 5:
        issues.append(ManifestIssue(line, "annotation.sentenceIntelligibility must be an integer from 1 to 5."))
    if annotation.get("recordingQuality") not in VALID_RECORDING_QUALITY:
        issues.append(ManifestIssue(line, "annotation.recordingQuality is invalid."))
    if not _is_nonempty_string(annotation.get("raterId")):
        issues.append(ManifestIssue(line, "annotation.raterId is required so inter-rater agreement can be measured later."))


def validate_rows(
    rows: list[dict[str, Any]],
    *,
    require_assigned_split: bool = False,
    recordings_root: Path | None = None,
) -> ManifestReport:
    """Validate schema, labels and speaker split isolation without changing data."""
    config = load_config()
    issues: list[ManifestIssue] = []
    recording_ids: set[str] = set()
    speaker_splits: dict[str, set[str]] = {}
    rows_by_split = {split: 0 for split in sorted(VALID_SPLITS)}
    for fallback_line, row in enumerate(rows, start=1):
        line = _line(row, fallback_line)
        required_strings = ("recordingId", "speakerId", "sentenceId", "textJa", "phonemesRef", "level", "device", "consentVersion")
        for field in required_strings:
            if not _is_nonempty_string(row.get(field)):
                issues.append(ManifestIssue(line, f"{field} must be a non-empty string."))
        recording_id = row.get("recordingId")
        if _is_nonempty_string(recording_id):
            if recording_id in recording_ids:
                issues.append(ManifestIssue(line, f"recordingId is duplicated: {recording_id}"))
            recording_ids.add(recording_id)
        if not _valid_relative_audio_path(row.get("audioPath")):
            issues.append(ManifestIssue(line, "audioPath must be a relative .wav path without '..'."))
        split = row.get("split")
        if split not in VALID_SPLITS:
            issues.append(ManifestIssue(line, "split must be train, validation, test, or unassigned."))
        else:
            rows_by_split[split] += 1
            if require_assigned_split and split == "unassigned":
                issues.append(ManifestIssue(line, "split must be assigned before training."))
        speaker_id = row.get("speakerId")
        if _is_nonempty_string(speaker_id) and split in VALID_SPLITS:
            speaker_splits.setdefault(speaker_id, set()).add(split)
        if row.get("level") not in VALID_LEVELS:
            issues.append(ManifestIssue(line, "level must be one of N5, N4, N3, N2, N1, custom."))
        if row.get("targetError") not in VALID_TARGET_ERRORS:
            issues.append(ManifestIssue(line, "targetError is invalid."))
        phonemes = row.get("phonemesRef")
        phone_list = phonemes.split() if isinstance(phonemes, str) else []
        if not phone_list:
            issues.append(ManifestIssue(line, "phonemesRef must contain at least one space-separated phoneme."))
        else:
            unknown = sorted(set(phone_list) - config.reference_vocabulary)
            if unknown:
                issues.append(ManifestIssue(line, "phonemesRef has phones outside baseline vocabulary: " + ", ".join(unknown)))
        target_phones = row.get("targetPhones")
        target_phone_list = target_phones if isinstance(target_phones, list) else []
        target_indices = row.get("targetPhoneIndices")
        if not target_phone_list or not all(isinstance(phone, str) for phone in target_phone_list):
            issues.append(ManifestIssue(line, "targetPhones must be a non-empty list of phoneme strings."))
        if not isinstance(target_indices, list) or not target_indices or not all(isinstance(index, int) for index in target_indices):
            issues.append(ManifestIssue(line, "targetPhoneIndices must be a non-empty list of phoneme indices."))
        elif phone_list:
            if len(target_phone_list) != len(target_indices):
                issues.append(ManifestIssue(line, "targetPhones and targetPhoneIndices must have the same length."))
            if len(set(target_indices)) != len(target_indices):
                issues.append(ManifestIssue(line, "targetPhoneIndices must not contain duplicates."))
            for position, index in enumerate(target_indices):
                if not 0 <= index < len(phone_list):
                    issues.append(ManifestIssue(line, "targetPhoneIndices contains an index outside phonemesRef."))
                elif position < len(target_phone_list) and target_phone_list[position] != phone_list[index]:
                    issues.append(ManifestIssue(line, "targetPhones must match phonemesRef at targetPhoneIndices."))
        _validate_annotation(row, line, issues, phone_list)
        if recordings_root is not None and _valid_relative_audio_path(row.get("audioPath")):
            audio_path = (recordings_root / row["audioPath"]).resolve()
            try:
                audio_path.relative_to(recordings_root.resolve())
            except ValueError:
                issues.append(ManifestIssue(line, "audioPath escapes recordings_root."))
                continue
            try:
                validate_model_audio(inspect_wav(audio_path), max_seconds=config.max_audio_seconds)
            except AudioPreparationError as error:
                issues.append(ManifestIssue(line, str(error)))

    for speaker_id, splits in speaker_splits.items():
        assigned_splits = splits - {"unassigned"}
        if len(assigned_splits) > 1:
            issues.append(ManifestIssue(0, f"Speaker leakage: {speaker_id} appears in {', '.join(sorted(assigned_splits))}."))
    speakers_by_split = {split: 0 for split in sorted(VALID_SPLITS)}
    for split_set in speaker_splits.values():
        if len(split_set) == 1:
            speakers_by_split[next(iter(split_set))] += 1
    return ManifestReport(len(rows), len({row.get("speakerId") for row in rows if _is_nonempty_string(row.get("speakerId"))}), rows_by_split, speakers_by_split, tuple(issues))


def assign_speaker_splits(rows: list[dict[str, Any]], *, seed: str) -> list[dict[str, Any]]:
    """Assign deterministic disjoint splits by speaker, never by recording row."""
    speakers = sorted({str(row["speakerId"]) for row in rows if _is_nonempty_string(row.get("speakerId"))})
    if len(speakers) < 3:
        raise ManifestError("At least three distinct speakers are required for disjoint train/validation/test splits.")
    ordered = sorted(
        speakers,
        key=lambda speaker: hashlib.sha256(f"{seed}:{speaker}".encode("utf-8")).hexdigest(),
    )
    validation_count = max(1, round(len(ordered) * 0.15))
    test_count = max(1, round(len(ordered) * 0.15))
    train_count = len(ordered) - validation_count - test_count
    if train_count < 1:
        raise ManifestError("Not enough speakers after reserving validation and test splits.")
    assignments = {
        **{speaker: "train" for speaker in ordered[:train_count]},
        **{speaker: "validation" for speaker in ordered[train_count : train_count + validation_count]},
        **{speaker: "test" for speaker in ordered[train_count + validation_count :]},
    }
    assigned_rows: list[dict[str, Any]] = []
    for row in rows:
        updated = copy.deepcopy(row)
        updated["split"] = assignments[str(updated["speakerId"])]
        assigned_rows.append(updated)
    return assigned_rows
