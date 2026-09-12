"""CTC trellis/Viterbi forced alignment for the Model A phoneme pipeline.

The alignment is implemented here instead of using ``torchaudio.forced_align``
so the project does not depend on an API that was removed from recent
TorchAudio releases.  It aligns a *known* reference phoneme sequence to a
CTC emission matrix; pronunciation scoring belongs to A3 and later.
"""

from __future__ import annotations

from dataclasses import dataclass
from math import exp
from typing import Mapping, Sequence

import numpy as np


class CtcAlignmentError(ValueError):
    """Raised when a CTC emission matrix cannot align the supplied target."""


@dataclass(frozen=True)
class PhonemeAlignment:
    """One reference phoneme's aligned, end-exclusive frame span."""

    phoneme: str
    phoneme_index: int
    token_id: int
    start_frame: int
    end_frame: int
    start_ms: float
    end_ms: float
    mean_log_probability: float
    confidence: float


@dataclass(frozen=True)
class CtcAlignmentResult:
    """A monotonic CTC alignment over a single prepared audio sentence."""

    path_log_probability: float
    frame_count: int
    frame_duration_ms: float
    duration_ms: float
    segments: tuple[PhonemeAlignment, ...]


def phones_to_token_ids(
    phonemes: Sequence[str], token_to_id: Mapping[str, int], *, blank_id: int
) -> tuple[int, ...]:
    """Map model-compatible phones to IDs and reject invalid CTC targets."""
    if not phonemes:
        raise CtcAlignmentError("A forced alignment needs at least one reference phoneme.")

    missing = sorted({phone for phone in phonemes if phone not in token_to_id})
    if missing:
        raise CtcAlignmentError("Reference phonemes absent from the acoustic model vocabulary: " + ", ".join(missing))

    token_ids = tuple(int(token_to_id[phone]) for phone in phonemes)
    if blank_id in token_ids:
        raise CtcAlignmentError("The CTC blank/PAD token cannot be part of a reference phoneme sequence.")
    return token_ids


def _validate_inputs(
    log_probabilities: np.ndarray,
    target_token_ids: Sequence[int],
    target_phonemes: Sequence[str],
    blank_id: int,
    duration_ms: float,
) -> None:
    if log_probabilities.ndim != 2:
        raise CtcAlignmentError("CTC log probabilities must have shape [frames, vocabulary].")
    frame_count, vocabulary_size = log_probabilities.shape
    if frame_count == 0 or vocabulary_size == 0:
        raise CtcAlignmentError("CTC log probabilities must contain at least one frame and one token.")
    if not np.isfinite(log_probabilities).all():
        raise CtcAlignmentError("CTC log probabilities contain non-finite values.")
    if len(target_token_ids) != len(target_phonemes):
        raise CtcAlignmentError("Target phoneme labels and token IDs must have identical lengths.")
    if not target_token_ids:
        raise CtcAlignmentError("A forced alignment needs at least one reference phoneme.")
    if not 0 <= blank_id < vocabulary_size:
        raise CtcAlignmentError("The configured CTC blank ID is outside the model vocabulary.")
    if any(token_id < 0 or token_id >= vocabulary_size for token_id in target_token_ids):
        raise CtcAlignmentError("A target token ID is outside the model vocabulary.")
    if duration_ms <= 0:
        raise CtcAlignmentError("Audio duration must be positive.")


def ctc_viterbi_align(
    log_probabilities: np.ndarray,
    target_token_ids: Sequence[int],
    target_phonemes: Sequence[str],
    *,
    blank_id: int,
    duration_ms: float,
) -> CtcAlignmentResult:
    """Force-align reference phonemes to CTC emissions with a Viterbi trellis.

    ``log_probabilities`` must already be the output of ``log_softmax`` and
    have shape ``[frames, vocabulary]``.  The returned spans are end-exclusive
    and therefore safe to use with the usual ``start <= t < end`` condition.
    Consecutive equal phonemes require a blank transition, as CTC specifies.
    """
    emissions = np.asarray(log_probabilities, dtype=np.float64)
    targets = tuple(int(token_id) for token_id in target_token_ids)
    phones = tuple(target_phonemes)
    _validate_inputs(emissions, targets, phones, blank_id, duration_ms)

    frame_count, _ = emissions.shape
    # blank, p0, blank, p1, ... blank.  Odd states are target phonemes.
    extended: list[int] = [blank_id]
    for token_id in targets:
        extended.extend((token_id, blank_id))
    state_count = len(extended)

    # CTC needs at least one frame per target, plus blanks between identical
    # neighbours. This upfront guard makes an impossible input easy to debug.
    minimum_frames = len(targets) + sum(
        left == right for left, right in zip(targets, targets[1:])
    )
    if frame_count < minimum_frames:
        raise CtcAlignmentError(
            f"The emission has {frame_count} frames but this target needs at least {minimum_frames}."
        )

    scores = np.full((frame_count, state_count), -np.inf, dtype=np.float64)
    backpointers = np.full((frame_count, state_count), -1, dtype=np.int32)
    scores[0, 0] = emissions[0, blank_id]
    scores[0, 1] = emissions[0, extended[1]]

    for frame in range(1, frame_count):
        for state, token_id in enumerate(extended):
            candidates: list[tuple[float, int]] = [(scores[frame - 1, state], state)]
            if state >= 1:
                candidates.append((scores[frame - 1, state - 1], state - 1))
            # Skip a blank only when it does not merge consecutive equal labels.
            if state >= 2 and token_id != blank_id and token_id != extended[state - 2]:
                candidates.append((scores[frame - 1, state - 2], state - 2))
            previous_score, previous_state = max(candidates, key=lambda candidate: candidate[0])
            if np.isfinite(previous_score):
                scores[frame, state] = previous_score + emissions[frame, token_id]
                backpointers[frame, state] = previous_state

    final_candidates = [(scores[-1, state_count - 1], state_count - 1)]
    # The final blank is optional in a CTC path.
    final_candidates.append((scores[-1, state_count - 2], state_count - 2))
    path_log_probability, current_state = max(final_candidates, key=lambda candidate: candidate[0])
    if not np.isfinite(path_log_probability):
        raise CtcAlignmentError("No valid CTC path reaches the complete reference phoneme sequence.")

    state_path = np.full(frame_count, -1, dtype=np.int32)
    for frame in range(frame_count - 1, -1, -1):
        state_path[frame] = current_state
        if frame:
            current_state = backpointers[frame, current_state]
            if current_state < 0:
                raise CtcAlignmentError("CTC backtracking failed before reaching the first frame.")

    frame_duration_ms = float(duration_ms) / frame_count
    segments: list[PhonemeAlignment] = []
    for index, (phone, token_id) in enumerate(zip(phones, targets)):
        target_state = index * 2 + 1
        frames = np.flatnonzero(state_path == target_state)
        if not len(frames):
            raise CtcAlignmentError(f"No frame was assigned to reference phoneme {index}: {phone}.")
        start_frame, end_frame = int(frames[0]), int(frames[-1] + 1)
        mean_log_probability = float(emissions[frames, token_id].mean())
        segments.append(
            PhonemeAlignment(
                phoneme=phone,
                phoneme_index=index,
                token_id=token_id,
                start_frame=start_frame,
                end_frame=end_frame,
                start_ms=round(start_frame * frame_duration_ms, 3),
                end_ms=round(min(float(duration_ms), end_frame * frame_duration_ms), 3),
                mean_log_probability=round(mean_log_probability, 6),
                confidence=round(float(np.clip(exp(mean_log_probability), 0.0, 1.0)), 6),
            )
        )

    for previous, current in zip(segments, segments[1:]):
        if previous.end_frame > current.start_frame:
            raise CtcAlignmentError("CTC alignment produced overlapping phoneme spans.")

    return CtcAlignmentResult(
        path_log_probability=float(path_log_probability),
        frame_count=frame_count,
        frame_duration_ms=frame_duration_ms,
        duration_ms=float(duration_ms),
        segments=tuple(segments),
    )
