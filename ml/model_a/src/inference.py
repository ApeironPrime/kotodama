"""JSON-friendly Model A baseline inference contract."""

from __future__ import annotations

from pathlib import Path

from .audio import load_waveform
from .ctc_align import ctc_viterbi_align, phones_to_token_ids
from .g2p import G2PResult, japanese_to_phonemes
from .gop import analyze_gop, estimate_audio_quality
from .phoneme_model import JapanesePhonemeRecognizer
from .rule_baseline import detect_baseline_findings


def run_baseline(audio_path: Path, text: str, *, user_dictionary: Path | None = None) -> dict:
    """Return reference and predicted phones, without claiming pronunciation scoring."""
    reference: G2PResult = japanese_to_phonemes(text, user_dictionary=user_dictionary)
    prediction = JapanesePhonemeRecognizer().predict(audio_path)
    return {
        "stage": "A0-A1-baseline",
        "reference": {
            "text": reference.text,
            "phonemes": list(reference.phonemes),
            "engine": reference.engine,
        },
        "prediction": {
            "phonemes": list(prediction.phonemes),
            "modelId": prediction.model_id,
            "device": prediction.device,
            "durationMs": round(prediction.duration_ms, 2),
            "frameCount": prediction.frame_count,
            "approximateFrameDurationMs": round(prediction.frame_duration_ms, 4),
        },
        "limitations": [
            "This output is not a pronunciation score.",
            "A2 adds CTC Viterbi alignment and GOP before per-phone feedback is enabled.",
        ],
    }


def run_forced_alignment(audio_path: Path, text: str, *, user_dictionary: Path | None = None) -> dict:
    """Return reference-constrained phoneme timings without pronunciation scoring."""
    reference: G2PResult = japanese_to_phonemes(text, user_dictionary=user_dictionary)
    recognizer = JapanesePhonemeRecognizer()
    emissions = recognizer.emissions(audio_path)
    prediction = recognizer.decode_emissions(emissions)
    target_ids = phones_to_token_ids(reference.phonemes, emissions.token_to_id, blank_id=emissions.blank_id)
    alignment = ctc_viterbi_align(
        emissions.log_probabilities,
        target_ids,
        reference.phonemes,
        blank_id=emissions.blank_id,
        duration_ms=emissions.duration_ms,
    )
    return {
        "stage": "A2-ctc-forced-alignment",
        "reference": {
            "text": reference.text,
            "phonemes": list(reference.phonemes),
            "engine": reference.engine,
        },
        "prediction": {
            "phonemes": list(prediction.phonemes),
            "modelId": prediction.model_id,
            "device": prediction.device,
        },
        "alignment": {
            "durationMs": round(alignment.duration_ms, 2),
            "frameCount": alignment.frame_count,
            "frameDurationMs": round(alignment.frame_duration_ms, 4),
            "pathLogProbability": round(alignment.path_log_probability, 4),
            "phonemes": [
                {
                    "phoneme": segment.phoneme,
                    "index": segment.phoneme_index,
                    "startFrame": segment.start_frame,
                    "endFrame": segment.end_frame,
                    "startMs": segment.start_ms,
                    "endMs": segment.end_ms,
                    "acousticConfidence": segment.confidence,
                }
                for segment in alignment.segments
            ],
        },
        "limitations": [
            "A2 forces the known reference text onto audio; it does not yet decide whether pronunciation is correct.",
            "A3 will use aligned emission evidence and calibrated GOP features for pronunciation feedback.",
        ],
    }


def run_gop_baseline(
    audio_path: Path,
    text: str,
    *,
    user_dictionary: Path | None = None,
    recognizer: JapanesePhonemeRecognizer | None = None,
) -> dict:
    """Return A3 acoustic evidence; calibration turns it into learner feedback later."""
    reference: G2PResult = japanese_to_phonemes(text, user_dictionary=user_dictionary)
    recognizer = recognizer or JapanesePhonemeRecognizer()
    emissions = recognizer.emissions(audio_path)
    target_ids = phones_to_token_ids(reference.phonemes, emissions.token_to_id, blank_id=emissions.blank_id)
    alignment = ctc_viterbi_align(
        emissions.log_probabilities,
        target_ids,
        reference.phonemes,
        blank_id=emissions.blank_id,
        duration_ms=emissions.duration_ms,
    )
    gop = analyze_gop(
        emissions.log_probabilities,
        alignment,
        emissions.token_to_id,
        blank_id=emissions.blank_id,
        special_token_ids=emissions.special_token_ids,
    )
    waveform = load_waveform(audio_path)
    audio_quality = estimate_audio_quality(waveform, sample_rate=recognizer.config.sample_rate)
    return {
        "stage": "A3-gop-evidence",
        "reference": {
            "text": reference.text,
            "phonemes": list(reference.phonemes),
            "engine": reference.engine,
        },
        "model": {"id": emissions.model_id, "device": emissions.device},
        "audioQuality": {
            "estimatedSnrDb": audio_quality.estimated_snr_db,
            "clippingRatio": audio_quality.clipping_ratio,
            "snrStatus": "estimated-from-rms-percentiles",
        },
        "alignment": {
            "durationMs": round(alignment.duration_ms, 2),
            "frameDurationMs": round(alignment.frame_duration_ms, 4),
        },
        "gop": {
            "candidatePhoneCount": gop.candidate_phone_count,
            "phonemes": [
                {
                    "expectedPhone": item.expected_phone,
                    "top1Phone": item.top1_phone,
                    "top2Phone": item.top2_phone,
                    "bestCompetitor": item.best_competitor,
                    "gop": item.gop,
                    "expectedLogProbability": item.expected_log_probability,
                    "competitorLogProbability": item.competitor_log_probability,
                    "expectedProbability": item.expected_probability,
                    "competitorProbability": item.competitor_probability,
                    "posteriorMargin": item.posterior_margin,
                    "phonemeEntropy": item.phoneme_entropy,
                    "normalizedPhonemeEntropy": item.normalized_phoneme_entropy,
                    "startMs": item.start_ms,
                    "endMs": item.end_ms,
                    "durationMs": item.duration_ms,
                    "durationRatio": item.duration_ratio,
                    "positionInSentence": item.position_in_sentence,
                    "previousPhone": item.previous_phone,
                    "nextPhone": item.next_phone,
                    "estimatedSnrDb": audio_quality.estimated_snr_db,
                    "clippingRatio": audio_quality.clipping_ratio,
                }
                for item in gop.phonemes
            ],
        },
        "limitations": [
            "GOP is acoustic evidence, not a calibrated pass/fail score yet.",
            "Duration ratios remain null until native reference-duration statistics are collected.",
            "The SNR value is an estimate and should be used as a quality feature, not as ground truth.",
        ],
    }


def run_rule_baseline(
    audio_path: Path,
    text: str,
    *,
    user_dictionary: Path | None = None,
    recognizer: JapanesePhonemeRecognizer | None = None,
) -> dict:
    """Return A4's conservative, explainable pronunciation-review findings."""
    reference: G2PResult = japanese_to_phonemes(text, user_dictionary=user_dictionary)
    recognizer = recognizer or JapanesePhonemeRecognizer()
    emissions = recognizer.emissions(audio_path)
    prediction = recognizer.decode_emissions(emissions)
    target_ids = phones_to_token_ids(reference.phonemes, emissions.token_to_id, blank_id=emissions.blank_id)
    alignment = ctc_viterbi_align(
        emissions.log_probabilities,
        target_ids,
        reference.phonemes,
        blank_id=emissions.blank_id,
        duration_ms=emissions.duration_ms,
    )
    gop = analyze_gop(
        emissions.log_probabilities,
        alignment,
        emissions.token_to_id,
        blank_id=emissions.blank_id,
        special_token_ids=emissions.special_token_ids,
    )
    audio_quality = estimate_audio_quality(load_waveform(audio_path), sample_rate=recognizer.config.sample_rate)
    rules = detect_baseline_findings(gop, audio_quality)
    return {
        "stage": "A4-rule-baseline",
        "reference": {"text": reference.text, "phonemes": list(reference.phonemes), "engine": reference.engine},
        "model": {"id": emissions.model_id, "device": emissions.device},
        "recognizedPhonemes": list(prediction.phonemes),
        "audioQuality": {
            "estimatedSnrDb": audio_quality.estimated_snr_db,
            "clippingRatio": audio_quality.clipping_ratio,
        },
        "gop": {
            "phonemes": [
                {
                    "expectedPhone": item.expected_phone,
                    "top1Phone": item.top1_phone,
                    "gop": item.gop,
                    "normalizedPhonemeEntropy": item.normalized_phoneme_entropy,
                    "startMs": item.start_ms,
                    "endMs": item.end_ms,
                    "positionInSentence": item.position_in_sentence,
                }
                for item in gop.phonemes
            ]
        },
        "rulesetVersion": rules.ruleset_version,
        "findings": [
            {
                "code": finding.code,
                "category": finding.category,
                "severity": finding.severity,
                "message": finding.message,
                "phonemeIndices": list(finding.phoneme_indices),
                "evidence": finding.evidence,
            }
            for finding in rules.findings
        ],
        "summary": {
            "findingCount": len(rules.findings),
            "requiresReview": bool(rules.findings),
            "note": "Không có finding không có nghĩa phát âm chắc chắn đúng; đây chỉ là baseline rule.",
        },
        "limitations": [
            "Rules are review hints, not a final pronunciation verdict.",
            "Thresholds must be calibrated with labelled Vietnamese-learner recordings before production use.",
            "The long-vowel rule uses within-sentence duration only until a native reference corpus is available.",
        ],
    }
