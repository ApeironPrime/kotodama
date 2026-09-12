"""Turn A2-A4 evidence into an explicit, conservative local scoring response."""

from __future__ import annotations

from math import exp
from typing import Any


MODEL_VERSION = "kotodama-model-a-baseline-a4"


def _baseline_score(gop: float) -> float:
    """Monotonic display heuristic, not a calibrated probability or final grade."""
    return round(100 / (1 + exp(-gop)), 2)


def score_rule_payload(payload: dict[str, Any], *, sentence_id: str | None = None) -> dict[str, Any]:
    """Map explainable rule output to the stable `/v1/pronunciation/score` contract."""
    findings_by_index: dict[int, list[dict[str, Any]]] = {}
    quality_findings = []
    for finding in payload["findings"]:
        if finding["category"] == "audio_quality":
            quality_findings.append(finding)
        for index in finding["phonemeIndices"]:
            findings_by_index.setdefault(index, []).append(finding)
    audio_unscorable = any(finding["code"] == "audio_clipping" for finding in quality_findings)
    phonemes = []
    for evidence in payload.get("gop", {}).get("phonemes", []):
        index = evidence["positionInSentence"]
        local_findings = findings_by_index.get(index, [])
        if audio_unscorable:
            status, score, feedback = "unscorable", None, "Audio bị clipping; hãy ghi lại câu này trước khi chấm phát âm."
        elif local_findings:
            status, score, feedback = "incorrect", _baseline_score(evidence["gop"]), local_findings[0]["message"]
        elif evidence["top1Phone"] == evidence["expectedPhone"] and evidence["gop"] >= 0:
            status, score, feedback = "correct", _baseline_score(evidence["gop"]), "Âm này khớp với phoneme mục tiêu trong baseline."
        else:
            status, score, feedback = "near_correct", _baseline_score(evidence["gop"]), "Âm chưa đủ chắc chắn; hãy nghe lại và thử đọc chậm hơn."
        phonemes.append(
            {
                "expected": evidence["expectedPhone"],
                "recognized": evidence["top1Phone"],
                "startMs": evidence["startMs"],
                "endMs": evidence["endMs"],
                "status": status,
                "errorType": local_findings[0]["code"] if local_findings else None,
                "score": score,
                "confidence": round(max(0.0, min(1.0, 1 - evidence["normalizedPhonemeEntropy"])), 4),
                "feedback": feedback,
            }
        )
    scorable = [item["score"] for item in phonemes if item["score"] is not None]
    return {
        "sentenceId": sentence_id,
        "recognizedPhonemes": " ".join(payload["recognizedPhonemes"]),
        "referencePhonemes": " ".join(payload["reference"]["phonemes"]),
        "overallContentScore": round(sum(scorable) / len(scorable), 2) if scorable else None,
        "phonemes": phonemes,
        "evaluationStatus": "unscorable" if audio_unscorable else "scored",
        "qualityFindings": quality_findings,
        "modelVersion": MODEL_VERSION,
        "scoringMode": "baseline_heuristic_not_calibrated",
    }
