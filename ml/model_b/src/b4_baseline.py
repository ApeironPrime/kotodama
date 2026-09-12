"""B4: trainable, interpretable prosody baselines from B2 + B3.

The models learn *calibration* from human labels.  They do not consume raw
waveforms and they never replace B0--B2: B2 computes reproducible acoustic
evidence, B3 supplies human judgement, and B4 learns the relationship.
"""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, Iterable, Mapping, Sequence

import numpy as np

from .label_contract import ProsodyManifestError, read_jsonl, validate_rows


MODEL_VERSION = "kotodama-model-b-b4-baseline-v1"
FEATURE_NAMES = (
    "pitch_dtw_st",
    "pitch_drop_mismatch_st",
    "f0_median_delta_st",
    "f0_start_delta_st",
    "f0_end_delta_st",
    "f0_slope_delta_st_per_second",
    "duration_ratio_error",
    "duration_delta_relative",
    "voiced_ratio_delta",
    "energy_delta_db",
    "pause_before_delta_relative",
    "pause_after_delta_relative",
    "mora_position_normalized",
)

TASKS = {
    "pitch": {"label": "pitchAccent", "scores": {"correct": 100, "near_correct": 65, "incorrect": 25}},
    "rhythm": {
        "label": "rhythm",
        "scores": {"correct": 100, "too_fast": 55, "too_slow": 55, "long_vowel_shortened": 30, "sokuon_weak": 30, "other": 40},
    },
    "intonation": {"label": "intonation", "scores": {"natural": 100, "needs_work": 40}},
}
USABLE_RECORDING_QUALITIES = frozenset({"usable", "noisy"})


class ProsodyTrainingError(RuntimeError):
    """Raised when B3/B2 evidence cannot safely train a B4 baseline."""


@dataclass(frozen=True)
class FeatureRow:
    sample_id: str
    attempt_id: str
    annotation_id: str
    learner_speaker_id: str
    split: str
    mora_index: int
    label: str
    values: tuple[float, ...]
    labels: Mapping[str, str]

    def to_dict(self) -> dict[str, Any]:
        return {
            "sampleId": self.sample_id,
            "attemptId": self.attempt_id,
            "annotationId": self.annotation_id,
            "learnerSpeakerId": self.learner_speaker_id,
            "split": self.split,
            "moraIndex": self.mora_index,
            "moraLabel": self.label,
            "features": dict(zip(FEATURE_NAMES, self.values)),
            "labels": dict(self.labels),
        }


def _require_sklearn() -> tuple[Any, Any, Any, Any, Any, Any]:
    try:
        from sklearn.ensemble import RandomForestClassifier
        from sklearn.impute import SimpleImputer
        from sklearn.linear_model import LogisticRegression
        from sklearn.metrics import accuracy_score, f1_score
        from sklearn.pipeline import Pipeline
        from sklearn.preprocessing import StandardScaler
    except ImportError as error:
        raise ProsodyTrainingError("scikit-learn is required for B4. Run Model B bootstrap.ps1.") from error
    return RandomForestClassifier, SimpleImputer, LogisticRegression, accuracy_score, f1_score, (Pipeline, StandardScaler)


def _number(value: Any) -> float:
    if value is None:
        return float("nan")
    try:
        number = float(value)
    except (TypeError, ValueError):
        return float("nan")
    return number if np.isfinite(number) else float("nan")


def _safe_relative(path: Path, root: Path) -> Path:
    resolved_root = root.resolve()
    resolved = path.resolve()
    if resolved_root != resolved and resolved_root not in resolved.parents:
        raise ProsodyTrainingError(f"B2 evidence path escapes data root: {path}")
    return resolved


def _read_b2_evidence(path: Path) -> dict[str, Any]:
    if not path.is_file():
        raise ProsodyTrainingError(f"B2 evidence was not found: {path}")
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as error:
        raise ProsodyTrainingError(f"Invalid B2 JSON at {path}: {error.msg}") from error
    if not isinstance(payload, dict) or payload.get("schemaVersion") != "kotodama-model-b-b2-v1":
        raise ProsodyTrainingError(f"Expected kotodama-model-b-b2-v1 evidence at {path}")
    if not isinstance(payload.get("morae"), list):
        raise ProsodyTrainingError(f"B2 evidence lacks morae at {path}")
    return payload


def feature_row_from_b2_mora(
    evidence: Mapping[str, Any],
    *,
    mora_index: int,
    sample_id: str = "inference",
    attempt_id: str = "inference",
    annotation_id: str = "inference",
    learner_speaker_id: str = "inference",
    split: str = "inference",
    labels: Mapping[str, str] | None = None,
) -> FeatureRow:
    """Turn one B2 mora comparison into a fixed, missing-value-safe vector."""
    morae = evidence.get("morae")
    if not isinstance(morae, list) or not morae:
        raise ProsodyTrainingError("B2 evidence has no morae.")
    selected = next((row for row in morae if isinstance(row, dict) and row.get("moraIndex") == mora_index), None)
    if selected is None:
        raise ProsodyTrainingError(f"B2 evidence has no moraIndex={mora_index}.")
    if selected.get("referenceKind") != "mora":
        raise ProsodyTrainingError(f"moraIndex={mora_index} is not a scoreable mora.")
    pitch = selected.get("pitchDtw") if isinstance(selected.get("pitchDtw"), dict) else {}
    duration_ratio = _number(selected.get("durationRatioLearnerToReference"))
    duration_delta = _number(selected.get("durationDeltaMs"))
    reference_duration = _number(selected.get("referenceDurationMs"))
    start_delta = _number(selected.get("f0StartDeltaSemitones"))
    end_delta = _number(selected.get("f0EndDeltaSemitones"))
    pause_scale_ms = 250.0
    values = (
        _number(pitch.get("mean_absolute_distance_st")),
        start_delta - end_delta if np.isfinite(start_delta) and np.isfinite(end_delta) else float("nan"),
        _number(selected.get("f0MedianDeltaSemitones")),
        start_delta,
        end_delta,
        _number(selected.get("f0SlopeDeltaSemitonesPerSecond")),
        abs(duration_ratio - 1.0) if np.isfinite(duration_ratio) else float("nan"),
        duration_delta / reference_duration if np.isfinite(duration_delta) and reference_duration > 0 else float("nan"),
        _number(selected.get("voicedRatioDelta")),
        _number(selected.get("energyDeltaDb")),
        _number(selected.get("pauseBeforeDeltaMs")) / pause_scale_ms,
        _number(selected.get("pauseAfterDeltaMs")) / pause_scale_ms,
        float(mora_index) / max(1, len(morae) - 1),
    )
    return FeatureRow(
        sample_id=sample_id,
        attempt_id=attempt_id,
        annotation_id=annotation_id,
        learner_speaker_id=learner_speaker_id,
        split=split,
        mora_index=mora_index,
        label=str(selected.get("label", "")),
        values=tuple(float(value) for value in values),
        labels=dict(labels or {}),
    )


def build_training_rows(manifest_path: Path, *, data_root: Path, minimum_confidence: int = 3) -> list[FeatureRow]:
    """Load only usable, human-labelled B3 rows and the referenced B2 evidence."""
    if not 1 <= minimum_confidence <= 5:
        raise ValueError("minimum_confidence must be from 1 to 5.")
    try:
        manifest = read_jsonl(manifest_path)
    except ProsodyManifestError as error:
        raise ProsodyTrainingError(str(error)) from error
    report = validate_rows(manifest, require_assigned_split=True)
    if not report.is_valid:
        details = "; ".join(f"line {item.line}: {item.message}" for item in report.issues[:5])
        raise ProsodyTrainingError(f"B3 manifest is invalid: {details}")
    root = data_root.resolve()
    rows: list[FeatureRow] = []
    for item in manifest:
        annotation = item.get("annotation")
        if not isinstance(annotation, dict):
            continue
        if annotation.get("recordingQuality") not in USABLE_RECORDING_QUALITIES:
            continue
        if int(annotation.get("raterConfidence", 0)) < minimum_confidence:
            continue
        evidence_path = _safe_relative(root / str(item["b2EvidencePath"]), root)
        evidence = _read_b2_evidence(evidence_path)
        target_labels = {task: str(annotation[details["label"]]) for task, details in TASKS.items()}
        for mora_index in item["focusMoraIndices"]:
            rows.append(
                feature_row_from_b2_mora(
                    evidence,
                    mora_index=int(mora_index),
                    sample_id=f"{item['attemptId']}::{annotation['annotationId']}::m{mora_index}",
                    attempt_id=str(item["attemptId"]),
                    annotation_id=str(annotation["annotationId"]),
                    learner_speaker_id=str(item["learnerSpeakerId"]),
                    split=str(item["split"]),
                    labels=target_labels,
                )
            )
    if not rows:
        raise ProsodyTrainingError("No usable labelled B3 rows remain after quality/confidence filtering.")
    return rows


def _metrics(model: Any, features: np.ndarray, targets: Sequence[str]) -> dict[str, Any]:
    if not len(targets):
        return {"sampleCount": 0}
    predicted = model.predict(features)
    _, _, _, accuracy_score, f1_score, _ = _require_sklearn()
    return {
        "sampleCount": len(targets),
        "accuracy": round(float(accuracy_score(targets, predicted)), 4),
        "macroF1": round(float(f1_score(targets, predicted, average="macro", zero_division=0)), 4),
    }


def _fit_task(task: str, rows: Sequence[FeatureRow], *, random_state: int) -> tuple[Any, dict[str, Any]]:
    RandomForestClassifier, SimpleImputer, LogisticRegression, _, _, pipeline_types = _require_sklearn()
    Pipeline, StandardScaler = pipeline_types
    details = TASKS[task]
    eligible = [row for row in rows if row.labels.get(task) in details["scores"]]
    train = [row for row in eligible if row.split == "train"]
    if len(train) < 8:
        raise ProsodyTrainingError(f"{task}: need at least 8 usable train samples; found {len(train)}.")
    targets = [row.labels[task] for row in train]
    if len(set(targets)) < 2:
        raise ProsodyTrainingError(f"{task}: train data needs at least two human-label classes.")
    x_train = np.asarray([row.values for row in train], dtype=np.float64)
    if task == "rhythm":
        classifier = RandomForestClassifier(
            n_estimators=300, min_samples_leaf=2, class_weight="balanced_subsample", random_state=random_state, n_jobs=-1
        )
        model = Pipeline([("imputer", SimpleImputer(strategy="median")), ("classifier", classifier)])
    else:
        classifier = LogisticRegression(max_iter=2000, class_weight="balanced", random_state=random_state)
        model = Pipeline(
            [("imputer", SimpleImputer(strategy="median")), ("scaler", StandardScaler()), ("classifier", classifier)]
        )
    model.fit(x_train, targets)
    report: dict[str, Any] = {
        "algorithm": "random_forest" if task == "rhythm" else "logistic_regression",
        "train": _metrics(model, x_train, targets),
        "classes": list(model.classes_),
    }
    for split in ("validation", "test"):
        held_out = [row for row in eligible if row.split == split]
        report[split] = _metrics(model, np.asarray([row.values for row in held_out], dtype=np.float64), [row.labels[task] for row in held_out])
    return model, report


def train_baseline(
    manifest_path: Path,
    *,
    data_root: Path,
    output_dir: Path,
    minimum_confidence: int = 3,
    random_state: int = 2026,
) -> dict[str, Any]:
    """Train all three B4 models and save one local, versioned artifact."""
    if output_dir.exists():
        raise ProsodyTrainingError(f"Refusing to overwrite existing output directory: {output_dir}")
    rows = build_training_rows(manifest_path, data_root=data_root, minimum_confidence=minimum_confidence)
    models: dict[str, Any] = {}
    reports: dict[str, Any] = {}
    for index, task in enumerate(TASKS):
        models[task], reports[task] = _fit_task(task, rows, random_state=random_state + index)
    try:
        import joblib
    except ImportError as error:
        raise ProsodyTrainingError("joblib is required by scikit-learn for B4 artifact storage.") from error
    output_dir.mkdir(parents=True, exist_ok=False)
    artifact = {"modelVersion": MODEL_VERSION, "featureNames": list(FEATURE_NAMES), "models": models, "labelScores": {task: item["scores"] for task, item in TASKS.items()}}
    joblib.dump(artifact, output_dir / "b4_models.joblib")
    report = {
        "schemaVersion": "kotodama-model-b-b4-training-report-v1",
        "modelVersion": MODEL_VERSION,
        "featureNames": list(FEATURE_NAMES),
        "sampleCount": len(rows),
        "speakerCount": len({row.learner_speaker_id for row in rows}),
        "minimumRaterConfidence": minimum_confidence,
        "tasks": reports,
        "limitations": [
            "Scores are calibrated only to this pilot's raters and prompts; they are not a universal proficiency score.",
            "Do not deploy a learner-facing pass/fail threshold until held-out speaker metrics and rater agreement are reviewed.",
        ],
    }
    (output_dir / "training_report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return report


def load_baseline(model_dir: Path) -> dict[str, Any]:
    """Load an artifact created locally by ``train_baseline``; never load untrusted files."""
    artifact_path = model_dir / "b4_models.joblib"
    if not artifact_path.is_file():
        raise ProsodyTrainingError(f"B4 artifact was not found: {artifact_path}")
    try:
        import joblib
    except ImportError as error:
        raise ProsodyTrainingError("joblib is required by scikit-learn for B4 artifact loading.") from error
    artifact = joblib.load(artifact_path)
    if not isinstance(artifact, dict) or artifact.get("modelVersion") != MODEL_VERSION or artifact.get("featureNames") != list(FEATURE_NAMES):
        raise ProsodyTrainingError("B4 artifact is incompatible with this feature schema.")
    return artifact


def predict_mora(artifact: Mapping[str, Any], feature_row: FeatureRow) -> dict[str, Any]:
    values = np.asarray([feature_row.values], dtype=np.float64)
    outcomes: dict[str, Any] = {}
    for task, model in artifact["models"].items():
        probabilities = model.predict_proba(values)[0]
        classes = list(model.classes_)
        class_probabilities = {str(label): round(float(probability), 6) for label, probability in zip(classes, probabilities)}
        label = str(classes[int(np.argmax(probabilities))])
        score_map = artifact["labelScores"][task]
        score = sum(float(class_probabilities.get(name, 0.0)) * float(score_map[name]) for name in score_map)
        outcomes[task] = {
            "label": label,
            "calibratedScore": round(score, 1),
            "confidence": round(max(class_probabilities.values()), 4),
            "classProbabilities": class_probabilities,
        }
    return {
        "schemaVersion": "kotodama-model-b-b4-prediction-v1",
        "modelVersion": artifact["modelVersion"],
        "sample": feature_row.to_dict(),
        "scores": outcomes,
        "limitations": [
            "This is a B4 pilot calibration, not a medical, linguistic-certification, or universal pronunciation score.",
            "Use human review when confidence is low or B2 has missing pitch evidence.",
        ],
    }

