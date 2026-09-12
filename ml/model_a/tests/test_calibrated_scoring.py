from pathlib import Path

import numpy as np

from src.calibrated_scoring import CalibratedClassifierArtifact, score_calibrated_payload
from src.error_classifier import CATEGORICAL_FEATURES, FEATURE_SCHEMA_VERSION, NUMERIC_FEATURES


class _FakeClassifier:
    classes_ = np.asarray(["correct", "near_correct", "incorrect"])

    def predict_proba(self, dataframe):
        assert list(dataframe.columns) == [*NUMERIC_FEATURES, *CATEGORICAL_FEATURES]
        return np.asarray([[0.1, 0.2, 0.7], [0.2, 0.7, 0.1]])


def _payload() -> dict:
    base = {
        "recognizedPhonemes": ["ch", "a"], "reference": {"phonemes": ["ts", "a"]}, "model": {"id": "test-ctc"},
        "audioQuality": {"estimatedSnrDb": 24, "clippingRatio": 0}, "findings": [],
    }
    first = {"expectedPhone": "ts", "top1Phone": "ch", "top2Phone": "ts", "bestCompetitor": "ch", "gop": -1.1,
             "expectedProbability": 0.1, "competitorProbability": 0.8, "posteriorMargin": -0.7, "phonemeEntropy": 0.3,
             "normalizedPhonemeEntropy": 0.2, "durationMs": 60, "durationRatio": None, "startMs": 10, "endMs": 70,
             "positionInSentence": 0, "previousPhone": None, "nextPhone": "a"}
    second = {"expectedPhone": "a", "top1Phone": "a", "top2Phone": "i", "bestCompetitor": "i", "gop": 0.8,
              "expectedProbability": 0.8, "competitorProbability": 0.1, "posteriorMargin": 0.7, "phonemeEntropy": 0.2,
              "normalizedPhonemeEntropy": 0.1, "durationMs": 80, "durationRatio": None, "startMs": 70, "endMs": 150,
              "positionInSentence": 1, "previousPhone": "ts", "nextPhone": None}
    return {**base, "gop": {"phonemes": [first, second]}}


def test_a6_scoring_uses_classifier_probabilities_and_preserves_timing() -> None:
    artifact = CalibratedClassifierArtifact(
        model=_FakeClassifier(), artifact_directory=Path("a6-test"),
        metadata={"schemaVersion": FEATURE_SCHEMA_VERSION, "targetMode": "three_class", "numericFeatures": list(NUMERIC_FEATURES), "categoricalFeatures": list(CATEGORICAL_FEATURES)},
    )
    result = score_calibrated_payload(_payload(), artifact, sentence_id="s01")
    assert result["scoringMode"] == "a6_calibrated_classifier"
    assert result["phonemes"][0]["status"] == "incorrect"
    assert result["phonemes"][0]["startMs"] == 10
    assert result["phonemes"][1]["status"] == "near_correct"
