from src.shadowing_evaluation import combine_shadowing_scores


def _b2() -> dict:
    return {
        "schemaVersion": "kotodama-model-b-b2-v1",
        "morae": [
            {"moraIndex": 0, "label": "ka", "phonemes": ["k", "a"], "referenceKind": "mora", "learnerStartMs": 10, "learnerEndMs": 120},
            {"moraIndex": 1, "label": "cl", "phonemes": ["cl"], "referenceKind": "mora", "learnerStartMs": 120, "learnerEndMs": 180},
        ],
    }


def _model_a() -> dict:
    return {
        "sentenceId": "sentence_01", "modelVersion": "a-test", "evaluationStatus": "scored",
        "phonemes": [
            {"expected": "k", "status": "correct", "score": 95, "confidence": 0.9, "startMs": 10, "endMs": 65, "feedback": "ok"},
            {"expected": "a", "status": "near_correct", "score": 64, "confidence": 0.7, "startMs": 65, "endMs": 120, "feedback": "Đọc rõ nguyên âm hơn."},
            {"expected": "cl", "status": "incorrect", "score": 30, "confidence": 0.9, "startMs": 120, "endMs": 180, "feedback": "Âm ngắt chưa rõ."},
        ],
    }


def _prediction(pitch: str, rhythm: str, intonation: str) -> dict:
    return {
        "modelVersion": "b4-test", "scores": {
            "pitch": {"label": pitch, "calibratedScore": 75, "confidence": 0.8},
            "rhythm": {"label": rhythm, "calibratedScore": 60, "confidence": 0.8},
            "intonation": {"label": intonation, "calibratedScore": 70, "confidence": 0.8},
        },
    }


def test_b5_merges_content_and_prosody_into_timestamped_mora_feedback() -> None:
    result = combine_shadowing_scores(_model_a(), _b2(), {0: _prediction("correct", "correct", "natural"), 1: _prediction("near_correct", "sokuon_weak", "needs_work")})
    assert result["evaluationStatus"] == "review_only_baseline"
    assert result["scores"]["contentScore"] == 54.75
    assert result["scores"]["pitchScore"] == 75.0
    assert len(result["problematicMoras"]) == 2
    issue = result["problematicMoras"][1]
    assert issue["mora"] == "cl"
    assert issue["startMs"] == 120.0
    assert {item["issue"] for item in issue["issues"]} == {"phoneme_support", "pitch_contour_near", "rhythm_sokuon_weak", "intonation"}


def test_b5_refuses_to_score_when_model_a_marks_audio_unscorable() -> None:
    result = combine_shadowing_scores({"sentenceId": "bad", "modelVersion": "a-test", "evaluationStatus": "unscorable"}, _b2(), {})
    assert result["evaluationStatus"] == "unscorable"
    assert result["problematicMoras"] == []
