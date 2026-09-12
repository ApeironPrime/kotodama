"""First supervised A6 classifier for labelled Vietnamese-learner phoneme data."""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Literal

import numpy as np


FEATURE_SCHEMA_VERSION = "a6-phoneme-feature-v1"
NUMERIC_FEATURES = (
    "gop",
    "expectedProbability",
    "competitorProbability",
    "posteriorMargin",
    "phonemeEntropy",
    "normalizedPhonemeEntropy",
    "durationMs",
    "durationRatio",
    "estimatedSnrDb",
    "clippingRatio",
)
CATEGORICAL_FEATURES = (
    "expectedPhone",
    "top1Phone",
    "top2Phone",
    "bestCompetitor",
    "previousPhone",
    "nextPhone",
    "device",
    "recordingQuality",
)
LABELS_THREE_CLASS = ("correct", "near_correct", "incorrect")
LABELS_BINARY = ("acceptable", "incorrect")
TargetMode = Literal["three_class", "binary"]
ModelKind = Literal["logistic_regression", "random_forest"]


class ClassifierDataError(ValueError):
    """Raised when a private feature export is unsafe or too incomplete to train."""


@dataclass(frozen=True)
class TrainingResult:
    model: Any
    metadata: dict[str, Any]
    metrics: dict[str, Any]


def read_feature_jsonl(path: Path) -> list[dict[str, Any]]:
    if not path.is_file():
        raise ClassifierDataError(f"Feature export was not found: {path}")
    rows: list[dict[str, Any]] = []
    for line_number, raw in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
        if not raw.strip():
            continue
        try:
            row = json.loads(raw)
        except json.JSONDecodeError as error:
            raise ClassifierDataError(f"Invalid JSON on line {line_number}: {error.msg}") from error
        if not isinstance(row, dict):
            raise ClassifierDataError(f"Feature export line {line_number} must be an object.")
        row["_featureLine"] = line_number
        rows.append(row)
    if not rows:
        raise ClassifierDataError("Feature export has no rows.")
    return rows


def _target_label(label: str, mode: TargetMode) -> str | None:
    if label == "unscorable":
        return None
    if label not in LABELS_THREE_CLASS:
        return None
    return "incorrect" if mode == "binary" and label == "incorrect" else "acceptable" if mode == "binary" else label


def validate_feature_rows(rows: list[dict[str, Any]]) -> list[str]:
    """Return validation messages; does not mutate the private feature rows."""
    issues: list[str] = []
    speaker_splits: dict[str, set[str]] = {}
    required = {
        "schemaVersion", "recordingId", "speakerId", "split", "phoneIndex", "label", "recordingQuality",
        *NUMERIC_FEATURES,
        *CATEGORICAL_FEATURES,
    }
    seen_rows: set[tuple[str, int]] = set()
    for fallback_line, row in enumerate(rows, start=1):
        line = int(row.get("_featureLine", fallback_line))
        missing = sorted(field for field in required if field not in row)
        if missing:
            issues.append(f"line {line}: missing fields: {', '.join(missing)}")
            continue
        if row["schemaVersion"] != FEATURE_SCHEMA_VERSION:
            issues.append(f"line {line}: unsupported schemaVersion {row['schemaVersion']!r}")
        if row["split"] not in {"train", "validation", "test"}:
            issues.append(f"line {line}: split must be assigned before training")
        if row["label"] not in {*LABELS_THREE_CLASS, "unscorable"}:
            issues.append(f"line {line}: unsupported label {row['label']!r}")
        if row["recordingQuality"] not in {"usable", "noisy", "clipped", "too_short", "invalid"}:
            issues.append(f"line {line}: unsupported recordingQuality")
        if not isinstance(row["phoneIndex"], int) or row["phoneIndex"] < 0:
            issues.append(f"line {line}: phoneIndex must be a non-negative integer")
        key = (str(row["recordingId"]), int(row["phoneIndex"]) if isinstance(row["phoneIndex"], int) else -1)
        if key in seen_rows:
            issues.append(f"line {line}: duplicate recordingId/phoneIndex feature row")
        seen_rows.add(key)
        speaker_splits.setdefault(str(row["speakerId"]), set()).add(str(row["split"]))
    for speaker, splits in speaker_splits.items():
        if len(splits) > 1:
            issues.append(f"speaker leakage: {speaker} appears in {', '.join(sorted(splits))}")
    return issues


def _load_dataframe(rows: list[dict[str, Any]], mode: TargetMode):
    try:
        import pandas as pd
    except ImportError as error:
        raise ClassifierDataError("pandas is required; install requirements-train.txt.") from error
    issues = validate_feature_rows(rows)
    if issues:
        raise ClassifierDataError("Invalid feature export: " + "; ".join(issues))
    dataframe = pd.DataFrame(rows)
    dataframe["target"] = dataframe["label"].map(lambda value: _target_label(value, mode))
    before = len(dataframe)
    dataframe = dataframe[(dataframe["target"].notna()) & (dataframe["recordingQuality"] == "usable")].copy()
    excluded = before - len(dataframe)
    if dataframe.empty:
        raise ClassifierDataError("No usable, human-scored feature rows remain after excluding unscorable/poor audio.")
    return dataframe, excluded


def _make_pipeline(model_kind: ModelKind, *, seed: int):
    try:
        from sklearn.compose import ColumnTransformer
        from sklearn.ensemble import RandomForestClassifier
        from sklearn.impute import SimpleImputer
        from sklearn.linear_model import LogisticRegression
        from sklearn.pipeline import Pipeline
        from sklearn.preprocessing import OneHotEncoder, StandardScaler
    except ImportError as error:
        raise ClassifierDataError("scikit-learn is required; install requirements-train.txt.") from error
    # durationRatio is intentionally entirely missing until native-duration
    # calibration exists. Keep that column instead of silently dropping it.
    numeric = Pipeline(steps=[("imputer", SimpleImputer(strategy="median", add_indicator=True, keep_empty_features=True)), ("scale", StandardScaler())])
    categorical = Pipeline(steps=[("imputer", SimpleImputer(strategy="most_frequent")), ("onehot", OneHotEncoder(handle_unknown="ignore"))])
    preprocessor = ColumnTransformer(transformers=[("numeric", numeric, list(NUMERIC_FEATURES)), ("categorical", categorical, list(CATEGORICAL_FEATURES))])
    if model_kind == "logistic_regression":
        estimator = LogisticRegression(max_iter=2000, class_weight="balanced", random_state=seed)
    elif model_kind == "random_forest":
        estimator = RandomForestClassifier(n_estimators=400, class_weight="balanced_subsample", random_state=seed, n_jobs=-1)
    else:
        raise ClassifierDataError(f"Unsupported model kind: {model_kind}")
    return Pipeline(steps=[("preprocess", preprocessor), ("classifier", estimator)])


def _evaluate(model: Any, dataframe, labels: tuple[str, ...]) -> dict[str, Any]:
    from sklearn.metrics import classification_report, confusion_matrix, f1_score, precision_recall_fscore_support

    features = dataframe.loc[:, [*NUMERIC_FEATURES, *CATEGORICAL_FEATURES]]
    truth = dataframe["target"].to_numpy()
    predicted = model.predict(features)
    precision, recall, f1, support = precision_recall_fscore_support(truth, predicted, labels=list(labels), zero_division=0)
    per_class = {
        label: {"precision": round(float(precision[index]), 6), "recall": round(float(recall[index]), 6), "f1": round(float(f1[index]), 6), "support": int(support[index])}
        for index, label in enumerate(labels)
    }
    incorrect_mask = truth == "incorrect"
    accepted_mask = predicted != "incorrect"
    far = float(np.mean(accepted_mask[incorrect_mask])) if incorrect_mask.any() else None
    acceptable_mask = truth != "incorrect"
    rejected_mask = predicted == "incorrect"
    frr = float(np.mean(rejected_mask[acceptable_mask])) if acceptable_mask.any() else None
    per_phone: dict[str, dict[str, Any]] = {}
    for phone in sorted(dataframe["expectedPhone"].dropna().unique()):
        phone_mask = dataframe["expectedPhone"] == phone
        phone_truth, phone_predicted = truth[phone_mask], predicted[phone_mask]
        per_phone[str(phone)] = {
            "support": int(phone_mask.sum()),
            "macroF1": round(float(f1_score(phone_truth, phone_predicted, labels=list(labels), average="macro", zero_division=0)), 6),
        }
    return {
        "rowCount": int(len(dataframe)),
        "macroF1": round(float(f1_score(truth, predicted, labels=list(labels), average="macro", zero_division=0)), 6),
        "falseAcceptanceRate": round(far, 6) if far is not None else None,
        "falseRejectionRate": round(frr, 6) if frr is not None else None,
        "labels": list(labels),
        "perClass": per_class,
        "perPhone": per_phone,
        "confusionMatrix": confusion_matrix(truth, predicted, labels=list(labels)).tolist(),
        "classificationReport": classification_report(truth, predicted, labels=list(labels), output_dict=True, zero_division=0),
    }


def train_classifier(
    rows: list[dict[str, Any]],
    *,
    mode: TargetMode = "three_class",
    model_kind: ModelKind = "logistic_regression",
    seed: int = 2026,
) -> TrainingResult:
    """Train only on the manifest train split and evaluate untouched validation/test speakers."""
    dataframe, excluded = _load_dataframe(rows, mode)
    labels = LABELS_THREE_CLASS if mode == "three_class" else LABELS_BINARY
    train = dataframe[dataframe["split"] == "train"]
    validation = dataframe[dataframe["split"] == "validation"]
    test = dataframe[dataframe["split"] == "test"]
    if train.empty or validation.empty or test.empty:
        raise ClassifierDataError("Train, validation and test each need at least one usable labelled feature row.")
    classes = set(train["target"])
    if len(classes) < 2:
        raise ClassifierDataError("Training rows must contain at least two target classes.")
    model = _make_pipeline(model_kind, seed=seed)
    model.fit(train.loc[:, [*NUMERIC_FEATURES, *CATEGORICAL_FEATURES]], train["target"])
    metadata = {
        "schemaVersion": FEATURE_SCHEMA_VERSION,
        "modelKind": model_kind,
        "targetMode": mode,
        "seed": seed,
        "numericFeatures": list(NUMERIC_FEATURES),
        "categoricalFeatures": list(CATEGORICAL_FEATURES),
        "trainingRows": int(len(train)),
        "excludedRows": excluded,
        "trainingClasses": sorted(classes),
    }
    return TrainingResult(model=model, metadata=metadata, metrics={"validation": _evaluate(model, validation, labels), "test": _evaluate(model, test, labels)})


def save_training_result(result: TrainingResult, output_directory: Path) -> None:
    """Persist model and auditable metrics only to a new artifact directory."""
    if output_directory.exists():
        raise ClassifierDataError(f"Refusing to overwrite model artifact directory: {output_directory}")
    try:
        import joblib
    except ImportError as error:
        raise ClassifierDataError("joblib is required; install requirements-train.txt.") from error
    output_directory.mkdir(parents=True, exist_ok=False)
    joblib.dump(result.model, output_directory / "model.joblib")
    (output_directory / "metadata.json").write_text(json.dumps(result.metadata, ensure_ascii=False, indent=2), encoding="utf-8")
    (output_directory / "metrics.json").write_text(json.dumps(result.metrics, ensure_ascii=False, indent=2), encoding="utf-8")
