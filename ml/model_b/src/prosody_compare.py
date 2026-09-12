"""B2: native-reference versus learner prosody evidence.

The comparison is constrained by Model A's reference-text alignment: mora i
is compared only with mora i.  DTW is used *inside* each mora so normal
speaking-rate differences do not shift the learner onto another Japanese mora.
This module returns distances and quality evidence, never a learner grade.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass
from math import log10
from pathlib import Path
from typing import Any, Iterable, Mapping, Sequence

import numpy as np

from .mora import Mora, phonemes_to_moras
from .prosody import MoraProsody, PitchConfig, PitchTrack, extract_mora_prosody, normalize_f0_semitones


class ProsodyComparisonError(ValueError):
    """Raised when two recordings cannot safely be compared at the mora level."""


@dataclass(frozen=True)
class DtwEvidence:
    mean_absolute_distance_st: float | None
    total_distance_st: float | None
    path_length: int
    reference_frame_count: int
    learner_frame_count: int
    status: str


@dataclass(frozen=True)
class MoraComparison:
    mora_index: int
    label: str
    phonemes: tuple[str, ...]
    pitch_dtw: DtwEvidence
    duration_ratio_learner_to_reference: float | None
    duration_delta_ms: float
    voiced_ratio_delta: float | None
    f0_median_delta_st: float | None
    f0_start_delta_st: float | None
    f0_end_delta_st: float | None
    f0_slope_delta_st_per_second: float | None
    energy_delta_db: float | None
    pause_before_delta_ms: float
    pause_after_delta_ms: float
    reference_start_ms: float
    reference_end_ms: float
    learner_start_ms: float
    learner_end_ms: float
    reference_duration_ms: float
    learner_duration_ms: float
    reference_kind: str
    learner_kind: str

    def to_dict(self) -> dict[str, Any]:
        record = asdict(self)
        aliases = {
            "mora_index": "moraIndex",
            "pitch_dtw": "pitchDtw",
            "duration_ratio_learner_to_reference": "durationRatioLearnerToReference",
            "duration_delta_ms": "durationDeltaMs",
            "voiced_ratio_delta": "voicedRatioDelta",
            "f0_median_delta_st": "f0MedianDeltaSemitones",
            "f0_start_delta_st": "f0StartDeltaSemitones",
            "f0_end_delta_st": "f0EndDeltaSemitones",
            "f0_slope_delta_st_per_second": "f0SlopeDeltaSemitonesPerSecond",
            "energy_delta_db": "energyDeltaDb",
            "pause_before_delta_ms": "pauseBeforeDeltaMs",
            "pause_after_delta_ms": "pauseAfterDeltaMs",
            "reference_start_ms": "referenceStartMs",
            "reference_end_ms": "referenceEndMs",
            "learner_start_ms": "learnerStartMs",
            "learner_end_ms": "learnerEndMs",
            "reference_duration_ms": "referenceDurationMs",
            "learner_duration_ms": "learnerDurationMs",
            "reference_kind": "referenceKind",
            "learner_kind": "learnerKind",
        }
        for source, target in aliases.items():
            record[target] = record.pop(source)
        return record


@dataclass(frozen=True)
class ProsodyComparison:
    schema_version: str
    pitch_method_reference: str
    pitch_method_learner: str
    comparable_mora_count: int
    pitch_evidence_mora_count: int
    mean_pitch_dtw_distance_st: float | None
    mean_absolute_duration_ratio_error: float | None
    morae: tuple[MoraComparison, ...]

    def to_dict(self) -> dict[str, Any]:
        return {
            "stage": "B2-reference-learner-prosody-evidence",
            "schemaVersion": self.schema_version,
            "reference": {"pitchMethod": self.pitch_method_reference},
            "learner": {"pitchMethod": self.pitch_method_learner},
            "summary": {
                "comparableMoraCount": self.comparable_mora_count,
                "pitchEvidenceMoraCount": self.pitch_evidence_mora_count,
                "meanPitchDtwDistanceSemitones": self.mean_pitch_dtw_distance_st,
                "meanAbsoluteDurationRatioError": self.mean_absolute_duration_ratio_error,
            },
            "morae": [mora.to_dict() for mora in self.morae],
            "limitations": [
                "Distances are acoustic evidence, not calibrated pronunciation, pitch-accent, rhythm, or intonation scores.",
                "A shared transcript/alignment topology is required; do not compare unrelated sentences.",
                "B3-B4 require human labels and calibration before learner-facing pass/fail or 0-100 outputs.",
            ],
        }


def _finite_contour(track: PitchTrack, mora: Mora) -> np.ndarray:
    normalized, _ = normalize_f0_semitones(track.f0_hz)
    within = (track.times_seconds * 1000.0 >= mora.start_ms) & (track.times_seconds * 1000.0 < mora.end_ms)
    values = normalized[within]
    return values[np.isfinite(values)]


def dtw_absolute_semitones(
    reference: Sequence[float], learner: Sequence[float], *, minimum_voiced_frames: int = 3
) -> DtwEvidence:
    """Monotonic DTW with absolute semitone cost and deterministic backtracking."""
    ref = np.asarray(reference, dtype=np.float64)
    attempt = np.asarray(learner, dtype=np.float64)
    ref = ref[np.isfinite(ref)]
    attempt = attempt[np.isfinite(attempt)]
    if minimum_voiced_frames < 1:
        raise ValueError("minimum_voiced_frames must be at least one.")
    if len(ref) < minimum_voiced_frames or len(attempt) < minimum_voiced_frames:
        return DtwEvidence(None, None, 0, int(len(ref)), int(len(attempt)), "insufficient_voiced_frames")
    cost = np.full((len(ref) + 1, len(attempt) + 1), np.inf, dtype=np.float64)
    back = np.full((len(ref) + 1, len(attempt) + 1), -1, dtype=np.int8)
    cost[0, 0] = 0.0
    # 0 diagonal, 1 vertical, 2 horizontal. Prefer diagonal on ties.
    for row in range(1, len(ref) + 1):
        for column in range(1, len(attempt) + 1):
            candidates = (cost[row - 1, column - 1], cost[row - 1, column], cost[row, column - 1])
            step = int(np.argmin(candidates))
            cost[row, column] = abs(ref[row - 1] - attempt[column - 1]) + candidates[step]
            back[row, column] = step
    row, column, path_length = len(ref), len(attempt), 0
    while row or column:
        step = int(back[row, column])
        if step < 0:
            raise ProsodyComparisonError("DTW backtracking failed.")
        path_length += 1
        if step == 0:
            row -= 1; column -= 1
        elif step == 1:
            row -= 1
        else:
            column -= 1
    total = float(cost[-1, -1])
    return DtwEvidence(
        mean_absolute_distance_st=round(total / path_length, 6),
        total_distance_st=round(total, 6),
        path_length=path_length,
        reference_frame_count=int(len(ref)),
        learner_frame_count=int(len(attempt)),
        status="ok",
    )


def _ensure_same_mora_topology(reference_morae: Sequence[Mora], learner_morae: Sequence[Mora]) -> None:
    if len(reference_morae) != len(learner_morae):
        raise ProsodyComparisonError(
            f"Mora count differs (reference={len(reference_morae)}, learner={len(learner_morae)}). Re-run Model A on the same expected text."
        )
    for index, (reference, learner) in enumerate(zip(reference_morae, learner_morae)):
        if (reference.label, reference.phonemes, reference.kind) != (learner.label, learner.phonemes, learner.kind):
            raise ProsodyComparisonError(
                f"Mora topology differs at {index}: reference={reference.label!r}/{reference.kind}, "
                f"learner={learner.label!r}/{learner.kind}."
            )


def _delta(first: float | None, second: float | None) -> float | None:
    if first is None or second is None:
        return None
    return round(second - first, 6)


def _energy_delta_db(reference_rms: float | None, learner_rms: float | None) -> float | None:
    """Return relative energy in dB; absolute microphone gain is not a feature."""
    if reference_rms is None or learner_rms is None or reference_rms <= 0 or learner_rms <= 0:
        return None
    return round(20.0 * log10(learner_rms / reference_rms), 6)


def compare_mora_prosody(
    reference_morae: Sequence[Mora],
    learner_morae: Sequence[Mora],
    reference_track: PitchTrack,
    learner_track: PitchTrack,
    reference_features: Sequence[MoraProsody],
    learner_features: Sequence[MoraProsody],
) -> ProsodyComparison:
    """Compare two Model A-aligned recordings of the same expected sentence."""
    _ensure_same_mora_topology(reference_morae, learner_morae)
    if len(reference_features) != len(reference_morae) or len(learner_features) != len(learner_morae):
        raise ProsodyComparisonError("B1 feature rows must have exactly one row per B0 mora.")
    rows: list[MoraComparison] = []
    for reference_mora, learner_mora, reference_feature, learner_feature in zip(
        reference_morae, learner_morae, reference_features, learner_features
    ):
        pitch = dtw_absolute_semitones(_finite_contour(reference_track, reference_mora), _finite_contour(learner_track, learner_mora))
        duration_ratio = None if reference_mora.duration_ms <= 0 else round(learner_mora.duration_ms / reference_mora.duration_ms, 6)
        rows.append(
            MoraComparison(
                mora_index=reference_mora.mora_index,
                label=reference_mora.label,
                phonemes=reference_mora.phonemes,
                pitch_dtw=pitch,
                duration_ratio_learner_to_reference=duration_ratio,
                duration_delta_ms=round(learner_mora.duration_ms - reference_mora.duration_ms, 3),
                voiced_ratio_delta=_delta(reference_feature.voiced_ratio, learner_feature.voiced_ratio),
                f0_median_delta_st=_delta(reference_feature.f0_median_st, learner_feature.f0_median_st),
                f0_start_delta_st=_delta(reference_feature.f0_start_st, learner_feature.f0_start_st),
                f0_end_delta_st=_delta(reference_feature.f0_end_st, learner_feature.f0_end_st),
                f0_slope_delta_st_per_second=_delta(reference_feature.f0_slope_st_per_second, learner_feature.f0_slope_st_per_second),
                energy_delta_db=_energy_delta_db(reference_feature.energy_rms, learner_feature.energy_rms),
                pause_before_delta_ms=round(learner_feature.pause_before_ms - reference_feature.pause_before_ms, 3),
                pause_after_delta_ms=round(learner_feature.pause_after_ms - reference_feature.pause_after_ms, 3),
                reference_start_ms=reference_mora.start_ms,
                reference_end_ms=reference_mora.end_ms,
                learner_start_ms=learner_mora.start_ms,
                learner_end_ms=learner_mora.end_ms,
                reference_duration_ms=reference_mora.duration_ms,
                learner_duration_ms=learner_mora.duration_ms,
                reference_kind=reference_mora.kind,
                learner_kind=learner_mora.kind,
            )
        )
    valid_pitch = [row.pitch_dtw.mean_absolute_distance_st for row in rows if row.pitch_dtw.mean_absolute_distance_st is not None]
    valid_duration = [abs(row.duration_ratio_learner_to_reference - 1.0) for row in rows if row.duration_ratio_learner_to_reference is not None and row.reference_kind == "mora"]
    return ProsodyComparison(
        schema_version="kotodama-model-b-b2-v1",
        pitch_method_reference=reference_track.method,
        pitch_method_learner=learner_track.method,
        comparable_mora_count=sum(row.reference_kind == "mora" for row in rows),
        pitch_evidence_mora_count=len(valid_pitch),
        mean_pitch_dtw_distance_st=round(float(np.mean(valid_pitch)), 6) if valid_pitch else None,
        mean_absolute_duration_ratio_error=round(float(np.mean(valid_duration)), 6) if valid_duration else None,
        morae=tuple(rows),
    )


def compare_aligned_audio(
    reference_audio_path: Path,
    reference_alignment: Iterable[Mapping[str, object]],
    learner_audio_path: Path,
    learner_alignment: Iterable[Mapping[str, object]],
    *,
    pitch_config: PitchConfig = PitchConfig(),
) -> ProsodyComparison:
    """Run B0, B1, then B2 for a native reference and learner attempt."""
    reference_morae = phonemes_to_moras(reference_alignment)
    learner_morae = phonemes_to_moras(learner_alignment)
    reference_features, reference_track, _ = extract_mora_prosody(reference_audio_path, reference_morae, config=pitch_config)
    learner_features, learner_track, _ = extract_mora_prosody(learner_audio_path, learner_morae, config=pitch_config)
    return compare_mora_prosody(
        reference_morae, learner_morae, reference_track, learner_track, reference_features, learner_features
    )
