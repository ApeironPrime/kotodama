"""Goodness-of-Pronunciation evidence from aligned phoneme CTC emissions.

This module deliberately returns *evidence*, not a universal pass/fail label.
Per-phoneme decision thresholds need calibration with labelled recordings from
Vietnamese learners, which is a later Model A milestone.
"""

from __future__ import annotations

from dataclasses import dataclass
from math import log
from typing import Mapping, Sequence

import numpy as np

from .ctc_align import CtcAlignmentResult, PhonemeAlignment


class GopError(ValueError):
    """Raised when aligned CTC emissions cannot be converted to GOP evidence."""


@dataclass(frozen=True)
class AudioQualityEstimate:
    """Non-destructive quality indicators, not a speech-quality certification."""

    estimated_snr_db: float | None
    clipping_ratio: float


@dataclass(frozen=True)
class PhonemeGopEvidence:
    """Acoustic evidence for one reference phoneme after forced alignment."""

    expected_phone: str
    expected_token_id: int
    position_in_sentence: int
    previous_phone: str | None
    next_phone: str | None
    start_ms: float
    end_ms: float
    duration_ms: float
    duration_ratio: float | None
    top1_phone: str
    top2_phone: str | None
    best_competitor: str
    gop: float
    expected_log_probability: float
    competitor_log_probability: float
    expected_probability: float
    competitor_probability: float
    posterior_margin: float
    phoneme_entropy: float
    normalized_phoneme_entropy: float


@dataclass(frozen=True)
class GopAnalysis:
    """All phoneme-level evidence for a single aligned sentence."""

    phonemes: tuple[PhonemeGopEvidence, ...]
    candidate_phone_count: int


def estimate_audio_quality(waveform: np.ndarray, *, sample_rate: int) -> AudioQualityEstimate:
    """Estimate SNR from RMS percentiles and measure clipping without editing audio.

    The SNR estimate is intentionally labelled as an estimate: speech recordings
    with no quiet region cannot provide a true noise-floor measurement.  It is
    still useful as a feature and as a reason to avoid overconfident feedback.
    """
    samples = np.asarray(waveform, dtype=np.float64).reshape(-1)
    if sample_rate <= 0 or not len(samples):
        raise GopError("A non-empty waveform and positive sample rate are required for audio quality features.")

    clipping_ratio = float(np.mean(np.abs(samples) >= 0.99))
    frame_length = max(1, int(sample_rate * 0.02))
    frame_count = len(samples) // frame_length
    if frame_count < 2:
        return AudioQualityEstimate(estimated_snr_db=None, clipping_ratio=clipping_ratio)
    frames = samples[: frame_count * frame_length].reshape(frame_count, frame_length)
    rms = np.sqrt(np.mean(np.square(frames), axis=1))
    signal_rms = float(np.percentile(rms, 80))
    noise_rms = float(np.percentile(rms, 10))
    if signal_rms <= 1e-8 or noise_rms <= 1e-8:
        return AudioQualityEstimate(estimated_snr_db=None, clipping_ratio=clipping_ratio)
    return AudioQualityEstimate(
        estimated_snr_db=round(20 * log(signal_rms / noise_rms, 10), 3),
        clipping_ratio=round(clipping_ratio, 8),
    )


def _id_to_phone(token_to_id: Mapping[str, int]) -> dict[int, str]:
    result: dict[int, str] = {}
    for phone, token_id in token_to_id.items():
        numeric_id = int(token_id)
        if numeric_id in result:
            raise GopError(f"Tokenizer maps more than one token to ID {numeric_id}.")
        result[numeric_id] = str(phone)
    return result


def _candidate_ids(
    vocabulary_size: int, *, blank_id: int, special_token_ids: Sequence[int]
) -> tuple[int, ...]:
    excluded = {blank_id, *(int(token_id) for token_id in special_token_ids)}
    candidates = tuple(token_id for token_id in range(vocabulary_size) if token_id not in excluded)
    if len(candidates) < 2:
        raise GopError("GOP requires at least two non-special, non-blank phoneme tokens.")
    return candidates


def _phoneme_entropy(probabilities: np.ndarray) -> tuple[float, float]:
    """Return entropy over renormalised valid phoneme tokens, per selected frame."""
    normalizer = probabilities.sum(axis=1, keepdims=True)
    normalizer = np.maximum(normalizer, np.finfo(np.float64).tiny)
    posterior = probabilities / normalizer
    entropy_per_frame = -np.sum(posterior * np.log(np.maximum(posterior, np.finfo(np.float64).tiny)), axis=1)
    entropy = float(entropy_per_frame.mean())
    return entropy, entropy / log(probabilities.shape[1])


def _duration_ratio(segment: PhonemeAlignment, expected_duration_ms: Mapping[str, float] | None) -> float | None:
    if not expected_duration_ms:
        return None
    reference = expected_duration_ms.get(segment.phoneme)
    if reference is None or reference <= 0:
        return None
    return (segment.end_ms - segment.start_ms) / reference


def analyze_gop(
    log_probabilities: np.ndarray,
    alignment: CtcAlignmentResult,
    token_to_id: Mapping[str, int],
    *,
    blank_id: int,
    special_token_ids: Sequence[int] = (),
    expected_duration_ms: Mapping[str, float] | None = None,
) -> GopAnalysis:
    """Compute GOP and related acoustic features for each aligned phoneme.

    GOP is the mean frame-level margin between the expected phoneme and the
    strongest alternative phoneme.  The CTC blank and tokenizer control tokens
    are excluded from alternatives.  A negative GOP therefore means a competing
    *phoneme* fits the selected frames better than the expected one.
    """
    emissions = np.asarray(log_probabilities, dtype=np.float64)
    if emissions.ndim != 2 or emissions.shape[0] != alignment.frame_count:
        raise GopError("Emission shape must match the frame count of its CTC alignment.")
    if not np.isfinite(emissions).all():
        raise GopError("GOP requires finite CTC log probabilities.")
    vocabulary_size = emissions.shape[1]
    if not 0 <= blank_id < vocabulary_size:
        raise GopError("The CTC blank ID is outside the emission vocabulary.")

    id_to_phone = _id_to_phone(token_to_id)
    candidates = _candidate_ids(vocabulary_size, blank_id=blank_id, special_token_ids=special_token_ids)
    if any(token_id not in id_to_phone for token_id in candidates):
        raise GopError("The tokenizer vocabulary does not name every CTC emission token.")

    evidence: list[PhonemeGopEvidence] = []
    phones = alignment.segments
    for index, segment in enumerate(phones):
        if segment.token_id not in candidates:
            raise GopError(f"Expected phoneme {segment.phoneme} is not a valid scoring token.")
        if not 0 <= segment.start_frame < segment.end_frame <= alignment.frame_count:
            raise GopError(f"Aligned span for {segment.phoneme} is outside the CTC emission matrix.")

        frame_logs = emissions[segment.start_frame : segment.end_frame]
        frame_probabilities = np.exp(frame_logs)
        candidate_logs = frame_logs[:, candidates]
        candidate_probabilities = frame_probabilities[:, candidates]
        expected_logs = frame_logs[:, segment.token_id]
        competitor_ids = tuple(token_id for token_id in candidates if token_id != segment.token_id)
        competitor_logs = frame_logs[:, competitor_ids]
        strongest_competitor_per_frame = competitor_logs.max(axis=1)
        mean_probabilities = candidate_probabilities.mean(axis=0)
        ranked_positions = np.argsort(mean_probabilities)[::-1]
        top1_id = candidates[int(ranked_positions[0])]
        top2_id = candidates[int(ranked_positions[1])] if len(ranked_positions) > 1 else None
        competitor_mean_logs = frame_logs[:, competitor_ids].mean(axis=0)
        best_competitor_id = competitor_ids[int(np.argmax(competitor_mean_logs))]
        entropy, normalized_entropy = _phoneme_entropy(candidate_probabilities)
        duration_ratio = _duration_ratio(segment, expected_duration_ms)

        expected_probability = float(frame_probabilities[:, segment.token_id].mean())
        competitor_probability = float(frame_probabilities[:, best_competitor_id].mean())
        evidence.append(
            PhonemeGopEvidence(
                expected_phone=segment.phoneme,
                expected_token_id=segment.token_id,
                position_in_sentence=index,
                previous_phone=phones[index - 1].phoneme if index else None,
                next_phone=phones[index + 1].phoneme if index + 1 < len(phones) else None,
                start_ms=segment.start_ms,
                end_ms=segment.end_ms,
                duration_ms=round(segment.end_ms - segment.start_ms, 3),
                duration_ratio=round(duration_ratio, 6) if duration_ratio is not None else None,
                top1_phone=id_to_phone[top1_id],
                top2_phone=id_to_phone[top2_id] if top2_id is not None else None,
                best_competitor=id_to_phone[best_competitor_id],
                gop=round(float(np.mean(expected_logs - strongest_competitor_per_frame)), 6),
                expected_log_probability=round(float(expected_logs.mean()), 6),
                competitor_log_probability=round(float(strongest_competitor_per_frame.mean()), 6),
                expected_probability=round(expected_probability, 6),
                competitor_probability=round(competitor_probability, 6),
                posterior_margin=round(expected_probability - competitor_probability, 6),
                phoneme_entropy=round(entropy, 6),
                normalized_phoneme_entropy=round(normalized_entropy, 6),
            )
        )
    return GopAnalysis(phonemes=tuple(evidence), candidate_phone_count=len(candidates))
