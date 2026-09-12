from src.error_classifier import FEATURE_SCHEMA_VERSION, train_classifier, validate_feature_rows


def _row(speaker: str, split: str, index: int, label: str, phone: str = "ts") -> dict:
    base = {"correct": 1.4, "near_correct": 0.1, "incorrect": -1.5}[label]
    return {
        "schemaVersion": FEATURE_SCHEMA_VERSION,
        "recordingId": f"rec_{speaker}_{index}",
        "speakerId": speaker,
        "sentenceId": "s001",
        "split": split,
        "device": "laptop_microphone",
        "phoneIndex": 0,
        "label": label,
        "errorType": None,
        "raterConfidence": 4,
        "recordingQuality": "usable",
        "expectedPhone": phone,
        "top1Phone": phone if label != "incorrect" else "ch",
        "top2Phone": "a",
        "bestCompetitor": "ch",
        "previousPhone": None,
        "nextPhone": "a",
        "gop": base,
        "expectedProbability": 0.8 if label == "correct" else 0.5 if label == "near_correct" else 0.1,
        "competitorProbability": 0.1 if label == "correct" else 0.3 if label == "near_correct" else 0.8,
        "posteriorMargin": base / 2,
        "phonemeEntropy": 0.2 if label == "correct" else 0.6,
        "normalizedPhonemeEntropy": 0.1 if label == "correct" else 0.4,
        "durationMs": 70.0,
        "durationRatio": None,
        "estimatedSnrDb": 25.0,
        "clippingRatio": 0.0,
    }


def test_classifier_trains_only_on_train_and_reports_holdout_metrics() -> None:
    rows = [
        _row("vn01", "train", 1, "correct"), _row("vn02", "train", 2, "near_correct"), _row("vn03", "train", 3, "incorrect"),
        _row("vn04", "validation", 4, "correct"), _row("vn05", "validation", 5, "incorrect"),
        _row("vn06", "test", 6, "near_correct"), _row("vn07", "test", 7, "incorrect"),
    ]
    result = train_classifier(rows, seed=7)

    assert result.metadata["trainingRows"] == 3
    assert result.metrics["validation"]["rowCount"] == 2
    assert result.metrics["test"]["rowCount"] == 2
    assert "falseAcceptanceRate" in result.metrics["test"]


def test_feature_validation_rejects_speaker_leakage() -> None:
    rows = [_row("vn01", "train", 1, "correct"), _row("vn01", "test", 2, "incorrect")]
    assert any("speaker leakage" in issue for issue in validate_feature_rows(rows))
