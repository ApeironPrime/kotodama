"""A9: serve a locally trained A6 classifier without replacing Model A alignment.

Model A's pretrained CTC still produces alignment/GOP. This module only loads
a trusted local A6 artifact and turns its per-phone probability vector into a
calibrated learner-review result.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Mapping

import numpy as np

from .error_classifier import CATEGORICAL_FEATURES, FEATURE_SCHEMA_VERSION, NUMERIC_FEATURES


CALIBRATED_SCORING_VERSION = "kotodama-model-a-a6-calibrated-v1"


class CalibratedScoringError(ValueError):
    """Raised for missing, incompatible, or unsafe A6 inference artifacts."""


@dataclass(frozen=True)
class CalibratedClassifierArtifact:
    model: Any
    metadata: Mapping[str, Any]
    artifact_directory: Path


def load_calibrated_classifier(artifact_directory: Path) -> CalibratedClassifierArtifact:
    """Load only an artifact written by ``save_training_result`` on this machine."""
    model_path = artifact_directory / "model.joblib"
    metadata_path = artifact_directory / "metadata.json"
    if not model_path.is_file() or not metadata_path.is_file():
        raise CalibratedScoringError("A6 artifact requires both model.joblib and metadata.json.")
    try:
        metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as error:
        raise CalibratedScoringError(f"A6 metadata is not valid JSON: {error.msg}") from error
    if not isinstance(metadata, dict) or metadata.get("schemaVersion") != FEATURE_SCHEMA_VERSION:
        raise CalibratedScoringError("A6 artifact has an incompatible feature schema.")
    if metadata.get("numericFeatures") != list(NUMERIC_FEATURES) or metadata.get("categoricalFeatures") != list(CATEGORICAL_FEATURES):
        raise CalibratedScoringError("A6 artifact feature columns do not match this Model A version.")
    if metadata.get("targetMode") not in {"three_class", "binary"}:
        raise CalibratedScoringError("A6 artifact has an unsupported target mode.")
    try:
        import joblib
    except ImportError as error:
        raise CalibratedScoringError("joblib is required; install Model A requirements-train.txt.") from error
    # joblib/pickle is executable data: never load a downloaded artifact.
    model = joblib.load(model_path)
    if not hasattr(model, "predict_proba") or not hasattr(model, "classes_"):
        raise CalibratedScoringError("A6 artifact does not expose a classifier probability interface.")
    return CalibratedClassifierArtifact(model=model, metadata=metadata, artifact_directory=artifact_directory)


def _quality_label(payload: Mapping[str, Any]) -> str:
    findings = payload.get("findings", [])
    if any(isinstance(item, dict) and item.get("code") == "audio_clipping" for item in findings):
        return "clipped"
    return "usable"


def _feature_rows(payload: Mapping[str, Any], *, device: str) -> list[dict[str, Any]]:
    gop = payload.get("gop")
    quality = payload.get("audioQuality")
    if not isinstance(gop, dict) or not isinstance(gop.get("phonemes"), list) or not isinstance(quality, dict):
        raise CalibratedScoringError("A4 payload does not contain the GOP and audio-quality evidence required by A6.")
    rows: list[dict[str, Any]] = []
    for evidence in gop["phonemes"]:
        if not isinstance(evidence, dict):
            raise CalibratedScoringError("A4 GOP phoneme evidence must be an object.")
        rows.append({
            "gop": evidence.get("gop"), "expectedProbability": evidence.get("expectedProbability"),
            "competitorProbability": evidence.get("competitorProbability"), "posteriorMargin": evidence.get("posteriorMargin"),
            "phonemeEntropy": evidence.get("phonemeEntropy"), "normalizedPhonemeEntropy": evidence.get("normalizedPhonemeEntropy"),
            "durationMs": evidence.get("durationMs"), "durationRatio": evidence.get("durationRatio"),
            "estimatedSnrDb": quality.get("estimatedSnrDb"), "clippingRatio": quality.get("clippingRatio"),
            "expectedPhone": evidence.get("expectedPhone"), "top1Phone": evidence.get("top1Phone"),
            "top2Phone": evidence.get("top2Phone"), "bestCompetitor": evidence.get("bestCompetitor"),
            "previousPhone": evidence.get("previousPhone"), "nextPhone": evidence.get("nextPhone"),
            "device": device, "recordingQuality": _quality_label(payload),
        })
    if not rows:
        raise CalibratedScoringError("A4 payload has no phoneme evidence to score.")
    return rows


def _status_from_label(label: str, mode: str) -> str:
    if mode == "binary":
        return "incorrect" if label == "incorrect" else "near_correct"
    if label not in {"correct", "near_correct", "incorrect"}:
        raise CalibratedScoringError(f"A6 classifier emitted unsupported label {label!r}.")
    return label


def _score_from_probabilities(probabilities: Mapping[str, float], mode: str) -> float:
    weights = {"incorrect": 25.0, "acceptable": 85.0} if mode == "binary" else {"correct": 100.0, "near_correct": 65.0, "incorrect": 25.0}
    return round(sum(probabilities.get(label, 0.0) * weight for label, weight in weights.items()), 2)


def _feedback(status: str, expected_phone: str) -> str:
    if status == "incorrect":
        return f"Âm {expected_phone} cần luyện lại. Nghe câu mẫu, đọc chậm rõ âm này rồi ghép lại vào cả câu."
    if status == "near_correct":
        return f"Âm {expected_phone} gần đúng; hãy thử lại trong nhịp tự nhiên của cả câu."
    return f"Âm {expected_phone} được classifier A6 đánh giá phù hợp trong recording này."


def score_calibrated_payload(payload: Mapping[str, Any], artifact: CalibratedClassifierArtifact, *, sentence_id: str | None = None, device: str = "unknown_inference") -> dict[str, Any]:
    """Apply the A6 artifact to A4 evidence and preserve all per-phone timing."""
    if _quality_label(payload) == "clipped":
        from .pronunciation_scoring import score_rule_payload
        return score_rule_payload(dict(payload), sentence_id=sentence_id)
    try:
        import pandas as pd
    except ImportError as error:
        raise CalibratedScoringError("pandas is required; install Model A requirements-train.txt.") from error
    rows = _feature_rows(payload, device=device)
    dataframe = pd.DataFrame(rows, columns=[*NUMERIC_FEATURES, *CATEGORICAL_FEATURES])
    probabilities = artifact.model.predict_proba(dataframe)
    classes = [str(item) for item in artifact.model.classes_]
    if probabilities.shape != (len(rows), len(classes)):
        raise CalibratedScoringError("A6 classifier returned an invalid probability shape.")
    evidence_rows = payload["gop"]["phonemes"]
    mode = str(artifact.metadata["targetMode"])
    phonemes: list[dict[str, Any]] = []
    for evidence, vector in zip(evidence_rows, probabilities):
        class_probabilities = {label: round(float(value), 6) for label, value in zip(classes, vector)}
        classifier_label = max(class_probabilities, key=class_probabilities.get)
        status = _status_from_label(classifier_label, mode)
        phonemes.append({
            "expected": evidence["expectedPhone"], "recognized": evidence["top1Phone"],
            "startMs": evidence["startMs"], "endMs": evidence["endMs"], "status": status,
            "classifierLabel": classifier_label, "errorType": None,
            "score": _score_from_probabilities(class_probabilities, mode),
            "confidence": round(max(class_probabilities.values()), 4), "classProbabilities": class_probabilities,
            "feedback": _feedback(status, str(evidence["expectedPhone"])),
        })
    scores = [item["score"] for item in phonemes]
    return {
        "sentenceId": sentence_id, "recognizedPhonemes": " ".join(payload["recognizedPhonemes"]),
        "referencePhonemes": " ".join(payload["reference"]["phonemes"]),
        "overallContentScore": round(float(np.mean(scores)), 2) if scores else None, "phonemes": phonemes,
        "evaluationStatus": "scored",
        "qualityFindings": [item for item in payload.get("findings", []) if isinstance(item, dict) and item.get("category") == "audio_quality"],
        "ruleHints": payload.get("findings", []), "modelVersion": CALIBRATED_SCORING_VERSION,
        "acousticModel": payload.get("model", {}).get("id"), "classifierArtifact": artifact.artifact_directory.name,
        "scoringMode": "a6_calibrated_classifier",
        "limitations": [
            "This model is calibrated only to the collection rubric, prompts, and learner population represented in its A6 artifact.",
            "Rule hints remain review evidence; they do not override the calibrated classifier label.",
        ],
    }
