from src.pronunciation_scoring import score_rule_payload


def test_score_contract_marks_local_rule_as_incorrect_and_keeps_timing() -> None:
    payload = {
        "recognizedPhonemes": ["ch"],
        "reference": {"phonemes": ["ts"]},
        "findings": [{"code": "ts_may_be_ch", "category": "phoneme_confusion", "message": "review ts", "phonemeIndices": [0]}],
        "gop": {"phonemes": [{"expectedPhone": "ts", "top1Phone": "ch", "gop": -1.2, "normalizedPhonemeEntropy": 0.2, "startMs": 40, "endMs": 100, "positionInSentence": 0}]},
    }
    result = score_rule_payload(payload, sentence_id="s001")

    assert result["evaluationStatus"] == "scored"
    assert result["phonemes"][0]["status"] == "incorrect"
    assert result["phonemes"][0]["startMs"] == 40


def test_clipping_makes_result_unscorable() -> None:
    payload = {
        "recognizedPhonemes": ["ts"],
        "reference": {"phonemes": ["ts"]},
        "findings": [{"code": "audio_clipping", "category": "audio_quality", "message": "clip", "phonemeIndices": []}],
        "gop": {"phonemes": [{"expectedPhone": "ts", "top1Phone": "ts", "gop": 1.0, "normalizedPhonemeEntropy": 0.1, "startMs": 0, "endMs": 50, "positionInSentence": 0}]},
    }
    result = score_rule_payload(payload)

    assert result["evaluationStatus"] == "unscorable"
    assert result["overallContentScore"] is None
