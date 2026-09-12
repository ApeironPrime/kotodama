"""B5: combine Model A phoneme review with calibrated Model B evidence.

This module intentionally receives worker-produced JSON rather than accepting
raw audio.  Model A remains the single owner of acoustic phoneme alignment;
Model B receives the paired native/learner B2 comparison.  Keeping that
boundary avoids duplicating GPU work and makes every learner-facing finding
traceable to its source model.
"""

from __future__ import annotations

from collections.abc import Callable, Mapping
from statistics import mean
from typing import Any

from .b4_baseline import ProsodyTrainingError, feature_row_from_b2_mora, predict_mora


class ShadowingEvaluationError(ValueError):
    """Raised when Model A/B payloads describe different or invalid attempts."""


def _number(value: Any) -> float | None:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number


def _mean_or_none(values: list[float | None]) -> float | None:
    usable = [value for value in values if value is not None]
    return round(mean(usable), 2) if usable else None


def _model_b_predictions(artifact: Mapping[str, Any], evidence: Mapping[str, Any]) -> dict[int, dict[str, Any]]:
    morae = evidence.get("morae")
    if evidence.get("schemaVersion") != "kotodama-model-b-b2-v1" or not isinstance(morae, list):
        raise ShadowingEvaluationError("B5 expects kotodama-model-b-b2-v1 evidence with morae.")
    predictions: dict[int, dict[str, Any]] = {}
    for row in morae:
        if not isinstance(row, dict) or row.get("referenceKind") != "mora":
            continue
        index = row.get("moraIndex")
        if not isinstance(index, int):
            raise ShadowingEvaluationError("Every scoreable B2 mora must have an integer moraIndex.")
        try:
            predictions[index] = predict_mora(artifact, feature_row_from_b2_mora(evidence, mora_index=index))
        except ProsodyTrainingError as error:
            raise ShadowingEvaluationError(str(error)) from error
    if not predictions:
        raise ShadowingEvaluationError("B2 evidence contains no scoreable mora.")
    return predictions


def _group_model_a_phonemes(model_a_score: Mapping[str, Any], evidence: Mapping[str, Any]) -> dict[int, list[dict[str, Any]]]:
    phonemes = model_a_score.get("phonemes")
    morae = evidence.get("morae")
    if not isinstance(phonemes, list) or not isinstance(morae, list):
        raise ShadowingEvaluationError("Model A score and B2 evidence must both contain lists.")
    scoreable_morae = [row for row in morae if isinstance(row, dict) and row.get("referenceKind") == "mora"]
    cursor = 0
    grouped: dict[int, list[dict[str, Any]]] = {}
    for mora in scoreable_morae:
        index, expected_phones = mora.get("moraIndex"), mora.get("phonemes")
        if not isinstance(index, int) or not isinstance(expected_phones, list) or not expected_phones:
            raise ShadowingEvaluationError("B2 scoreable mora lacks moraIndex or reference phonemes.")
        group: list[dict[str, Any]] = []
        for expected_phone in expected_phones:
            if cursor >= len(phonemes) or not isinstance(phonemes[cursor], dict):
                raise ShadowingEvaluationError("Model A phoneme sequence is shorter than the B2 reference mora sequence.")
            candidate = phonemes[cursor]
            if candidate.get("expected") != expected_phone:
                raise ShadowingEvaluationError(
                    "Model A and B2 reference phonemes differ. Regenerate both results from the same expectedText and attempt."
                )
            group.append(candidate)
            cursor += 1
        grouped[index] = group
    return grouped


def _content_summary(phonemes: list[dict[str, Any]]) -> dict[str, Any]:
    scores = [_number(item.get("score")) for item in phonemes]
    starts = [value for item in phonemes if (value := _number(item.get("startMs"))) is not None]
    ends = [value for item in phonemes if (value := _number(item.get("endMs"))) is not None]
    statuses = {str(item.get("status")) for item in phonemes}
    if all(score is None for score in scores):
        status = "unscorable"
    elif "incorrect" in statuses:
        status = "incorrect"
    elif "near_correct" in statuses:
        status = "near_correct"
    else:
        status = "correct"
    return {
        "status": status,
        "score": _mean_or_none(scores),
        "confidence": _mean_or_none([_number(item.get("confidence")) for item in phonemes]),
        "feedback": next((str(item["feedback"]) for item in phonemes if item.get("status") in {"incorrect", "near_correct"} and item.get("feedback")), None),
        "startMs": min(starts) if starts else None,
        "endMs": max(ends) if ends else None,
    }


def _prosody_feedback(scores: Mapping[str, Mapping[str, Any]]) -> list[dict[str, str]]:
    messages: list[dict[str, str]] = []
    pitch = scores["pitch"]["label"]
    if pitch == "incorrect":
        messages.append({"issue": "pitch_contour", "feedback": "Nghe lại đường cao độ của mora này rồi lặp lại cả cụm, đừng chỉ đọc từng âm rời."})
    elif pitch == "near_correct":
        messages.append({"issue": "pitch_contour_near", "feedback": "Đường cao độ gần đúng; thử bắt đầu hoặc hạ giọng sớm hơn một chút."})
    rhythm = scores["rhythm"]["label"]
    rhythm_messages = {
        "too_fast": "Bạn đi qua mora này hơi nhanh; giữ nhịp đều với câu mẫu.",
        "too_slow": "Bạn kéo mora này hơi lâu; nghe lại độ dài trong câu mẫu.",
        "long_vowel_shortened": "Trường âm đang ngắn; kéo dài nguyên âm thêm một mora.",
        "sokuon_weak": "Âm ngắt っ chưa rõ; dừng ngắn trước phụ âm kế tiếp.",
        "other": "Nhịp của mora này khác câu mẫu; nghe lại cả cụm rồi nhại theo.",
    }
    if rhythm in rhythm_messages:
        messages.append({"issue": f"rhythm_{rhythm}", "feedback": rhythm_messages[rhythm]})
    if scores["intonation"]["label"] == "needs_work":
        messages.append({"issue": "intonation", "feedback": "Ngữ điệu của cả cụm chưa tự nhiên; thử nhại lại một lần liền mạch."})
    return messages


def combine_shadowing_scores(
    model_a_score: Mapping[str, Any],
    b2_evidence: Mapping[str, Any],
    b4_predictions: Mapping[int, Mapping[str, Any]],
) -> dict[str, Any]:
    """Merge trusted worker outputs into a timestamped review contract."""
    if model_a_score.get("evaluationStatus") == "unscorable":
        return {
            "schemaVersion": "kotodama-shadowing-evaluation-b5-v1",
            "evaluationStatus": "unscorable",
            "sentenceId": model_a_score.get("sentenceId"),
            "modelVersions": {"modelA": model_a_score.get("modelVersion"), "modelB": None},
            "reason": "Model A marked the recording unscorable; do not infer pitch/rhythm from it.",
            "problematicMoras": [],
        }
    grouped_a = _group_model_a_phonemes(model_a_score, b2_evidence)
    morae = b2_evidence["morae"]
    reviews: list[dict[str, Any]] = []
    all_content: list[float | None] = []
    all_pitch: list[float | None] = []
    all_rhythm: list[float | None] = []
    all_intonation: list[float | None] = []
    for mora in morae:
        if not isinstance(mora, dict) or mora.get("referenceKind") != "mora":
            continue
        index = mora["moraIndex"]
        prediction = b4_predictions.get(index)
        if prediction is None or not isinstance(prediction.get("scores"), dict):
            raise ShadowingEvaluationError(f"B4 has no prediction for moraIndex={index}.")
        content = _content_summary(grouped_a[index])
        scores = prediction["scores"]
        if not all(name in scores for name in ("pitch", "rhythm", "intonation")):
            raise ShadowingEvaluationError("B4 prediction must contain pitch, rhythm and intonation.")
        issues: list[dict[str, str]] = []
        if content["status"] in {"incorrect", "near_correct"}:
            issues.append({"issue": "phoneme_support", "feedback": content["feedback"] or "Nghe lại câu mẫu và đọc rõ các âm trong mora này."})
        issues.extend(_prosody_feedback(scores))
        all_content.append(content["score"])
        all_pitch.append(_number(scores["pitch"].get("calibratedScore")))
        all_rhythm.append(_number(scores["rhythm"].get("calibratedScore")))
        all_intonation.append(_number(scores["intonation"].get("calibratedScore")))
        if issues:
            reviews.append(
                {
                    "moraIndex": index,
                    "mora": mora.get("label"),
                    "startMs": _number(mora.get("learnerStartMs")) or content["startMs"],
                    "endMs": _number(mora.get("learnerEndMs")) or content["endMs"],
                    "content": content,
                    "prosody": scores,
                    "issue": issues[0]["issue"],
                    "feedback": issues[0]["feedback"],
                    "issues": issues,
                }
            )
    pitch_score, rhythm_score, intonation_score, content_score = (_mean_or_none(all_pitch), _mean_or_none(all_rhythm), _mean_or_none(all_intonation), _mean_or_none(all_content))
    weighted = [(content_score, 0.45), (pitch_score, 0.25), (rhythm_score, 0.20), (intonation_score, 0.10)]
    available_weight = sum(weight for value, weight in weighted if value is not None)
    overall = round(sum(value * weight for value, weight in weighted if value is not None) / available_weight, 2) if available_weight else None
    return {
        "schemaVersion": "kotodama-shadowing-evaluation-b5-v1",
        "evaluationStatus": "review_only_baseline",
        "sentenceId": model_a_score.get("sentenceId"),
        "modelVersions": {"modelA": model_a_score.get("modelVersion"), "modelB": next(iter(b4_predictions.values())).get("modelVersion")},
        "scores": {"contentScore": content_score, "pitchScore": pitch_score, "rhythmScore": rhythm_score, "intonationScore": intonation_score, "overallShadowingScore": overall},
        "problematicMoras": sorted(reviews, key=lambda item: (item["startMs"] is None, item["startMs"] or 0.0)),
        "limitations": [
            "Model A content values are heuristic until its labelled Vietnamese-learner calibration is complete.",
            "Model B values are B4 pilot calibration scores; do not use this response for pass/fail or public ranking before held-out-speaker evaluation.",
            "The service combines outputs for the same expectedText and attempt only; regenerate both workers after any edit or recording retry.",
        ],
    }


def evaluate_with_artifact(model_a_score: Mapping[str, Any], b2_evidence: Mapping[str, Any], artifact: Mapping[str, Any]) -> dict[str, Any]:
    """Convenience entry point for a trusted backend worker with local B4 artifact."""
    if model_a_score.get("evaluationStatus") == "unscorable":
        return combine_shadowing_scores(model_a_score, b2_evidence, {})
    return combine_shadowing_scores(model_a_score, b2_evidence, _model_b_predictions(artifact, b2_evidence))
