"""B1: F0, voicing, energy, and duration features on Model B mora spans.

No function in this module produces a pronunciation grade.  It only turns a
prepared audio file plus B0's mora time axis into reproducible observations.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass
from math import log2
from pathlib import Path
from typing import Any, Sequence

import numpy as np

from .mora import Mora


class ProsodyExtractionError(RuntimeError):
    """Raised when audio or the Praat backend cannot produce a pitch track."""


@dataclass(frozen=True)
class PitchConfig:
    time_step_seconds: float = 0.01
    floor_hz: float = 50.0
    ceiling_hz: float = 800.0
    method: str = "raw_ac_fallback"


@dataclass(frozen=True)
class PitchTrack:
    times_seconds: np.ndarray
    f0_hz: np.ndarray
    method: str

    def __post_init__(self) -> None:
        if self.times_seconds.ndim != 1 or self.f0_hz.ndim != 1:
            raise ValueError("Pitch-track time and F0 arrays must be one-dimensional.")
        if len(self.times_seconds) != len(self.f0_hz):
            raise ValueError("Pitch-track time and F0 arrays must have equal length.")


@dataclass(frozen=True)
class MoraProsody:
    mora_index: int
    label: str
    phonemes: tuple[str, ...]
    start_ms: float
    end_ms: float
    duration_ms: float
    kind: str
    voiced_frame_count: int
    total_frame_count: int
    voiced_ratio: float | None
    f0_median_hz: float | None
    f0_min_hz: float | None
    f0_max_hz: float | None
    f0_start_st: float | None
    f0_end_st: float | None
    f0_median_st: float | None
    f0_slope_st_per_second: float | None
    f0_peak_st: float | None
    f0_peak_relative_position: float | None
    energy_rms: float | None
    pause_before_ms: float
    pause_after_ms: float
    long_vowel_group: int | None
    long_vowel_position: str | None

    def to_dict(self) -> dict[str, Any]:
        record = asdict(self)
        aliases = {
            "mora_index": "moraIndex",
            "start_ms": "startMs",
            "end_ms": "endMs",
            "duration_ms": "durationMs",
            "voiced_frame_count": "voicedFrameCount",
            "total_frame_count": "totalFrameCount",
            "voiced_ratio": "voicedRatio",
            "f0_median_hz": "f0MedianHz",
            "f0_min_hz": "f0MinHz",
            "f0_max_hz": "f0MaxHz",
            "f0_start_st": "f0StartSemitones",
            "f0_end_st": "f0EndSemitones",
            "f0_median_st": "f0MedianSemitones",
            "f0_slope_st_per_second": "f0SlopeSemitonesPerSecond",
            "f0_peak_st": "f0PeakSemitones",
            "f0_peak_relative_position": "f0PeakRelativePosition",
            "energy_rms": "energyRms",
            "pause_before_ms": "pauseBeforeMs",
            "pause_after_ms": "pauseAfterMs",
            "long_vowel_group": "longVowelGroup",
            "long_vowel_position": "longVowelPosition",
        }
        for source, target in aliases.items():
            record[target] = record.pop(source)
        return record


def normalize_f0_semitones(f0_hz: Sequence[float] | np.ndarray) -> tuple[np.ndarray, float | None]:
    """Normalize voiced F0 relative to the utterance median in semitones.

    Unvoiced/invalid frames remain ``NaN``.  This intentionally compares
    contour shape rather than a raw Hz range that differs by speaker.
    """
    values = np.asarray(f0_hz, dtype=np.float64)
    normalized = np.full(values.shape, np.nan, dtype=np.float64)
    voiced = np.isfinite(values) & (values > 0)
    if not np.any(voiced):
        return normalized, None
    median_hz = float(np.median(values[voiced]))
    normalized[voiced] = 12.0 * np.log2(values[voiced] / median_hz)
    return normalized, median_hz


def _load_prepared_audio(audio_path: Path) -> tuple[np.ndarray, int]:
    try:
        import soundfile as sf
    except ImportError as error:
        raise ProsodyExtractionError("soundfile is required; install Model B requirements.") from error
    if not audio_path.is_file():
        raise ProsodyExtractionError(f"Audio file was not found: {audio_path}")
    signal, sample_rate = sf.read(str(audio_path), dtype="float64", always_2d=False)
    signal = np.asarray(signal, dtype=np.float64)
    if signal.ndim != 1:
        raise ProsodyExtractionError("Model B requires a mono WAV. Prepare audio through Model A first.")
    if sample_rate != 16000:
        raise ProsodyExtractionError(f"Model B expects 16 kHz audio, got {sample_rate} Hz.")
    if not signal.size:
        raise ProsodyExtractionError("Audio has no samples.")
    return signal, int(sample_rate)


def extract_pitch_track(audio_path: Path, *, config: PitchConfig = PitchConfig()) -> PitchTrack:
    """Extract a reproducible F0 track with the available Praat backend.

    `praat-parselmouth` 0.4 uses an older embedded Praat, so its supported
    `to_pitch_ac` call is explicitly recorded as ``raw_ac_fallback``.  Do not
    treat this output as the later production filtered-AC implementation.
    """
    if config.method != "raw_ac_fallback":
        raise ProsodyExtractionError(
            "This baseline only implements raw_ac_fallback. A newer external Praat filtered-AC adapter is required "
            f"for method={config.method!r}."
        )
    signal, sample_rate = _load_prepared_audio(audio_path)
    try:
        import parselmouth
    except ImportError as error:
        raise ProsodyExtractionError("praat-parselmouth is required; run Model B bootstrap.ps1.") from error
    try:
        sound = parselmouth.Sound(signal, sampling_frequency=sample_rate)
        pitch = sound.to_pitch_ac(
            time_step=config.time_step_seconds,
            pitch_floor=config.floor_hz,
            pitch_ceiling=config.ceiling_hz,
        )
        f0 = np.asarray(pitch.selected_array["frequency"], dtype=np.float64)
        times = np.asarray(pitch.xs(), dtype=np.float64)
    except Exception as error:  # Praat errors have version-specific Python classes.
        raise ProsodyExtractionError(f"Praat pitch extraction failed: {error}") from error
    f0[f0 <= 0] = np.nan
    return PitchTrack(times, f0, method=config.method)


def _energy_rms(signal: np.ndarray | None, sample_rate: int | None, start_ms: float, end_ms: float) -> float | None:
    if signal is None or sample_rate is None:
        return None
    start = max(0, int(round(start_ms * sample_rate / 1000.0)))
    end = min(len(signal), int(round(end_ms * sample_rate / 1000.0)))
    if end <= start:
        return None
    return round(float(np.sqrt(np.mean(np.square(signal[start:end])))), 8)


def _adjacent_pause_ms(morae: Sequence[Mora], index: int, *, direction: int) -> float:
    """Return the contiguous pause duration immediately before or after a mora."""
    cursor = index + direction
    total = 0.0
    while 0 <= cursor < len(morae) and morae[cursor].kind == "pause":
        total += morae[cursor].duration_ms
        cursor += direction
    return round(total, 3)


def summarize_mora_prosody(
    morae: Sequence[Mora],
    pitch_track: PitchTrack,
    *,
    signal: np.ndarray | None = None,
    sample_rate: int | None = None,
    minimum_voiced_frames: int = 3,
) -> tuple[tuple[MoraProsody, ...], float | None]:
    """Create B1 feature rows for B0 morae without making a quality judgement."""
    if minimum_voiced_frames < 1:
        raise ValueError("minimum_voiced_frames must be at least one.")
    normalized, utterance_median_hz = normalize_f0_semitones(pitch_track.f0_hz)
    rows: list[MoraProsody] = []
    for mora_position, mora in enumerate(morae):
        within = (pitch_track.times_seconds * 1000.0 >= mora.start_ms) & (pitch_track.times_seconds * 1000.0 < mora.end_ms)
        f0 = pitch_track.f0_hz[within]
        contour = normalized[within]
        voiced = np.isfinite(f0) & (f0 > 0)
        total_count = int(len(f0))
        voiced_count = int(np.count_nonzero(voiced))
        ratio = round(voiced_count / total_count, 6) if total_count else None
        valid_contour = contour[voiced]
        if mora.kind != "mora" or voiced_count < minimum_voiced_frames:
            values: dict[str, float | None] = {
                "median_hz": None, "min_hz": None, "max_hz": None, "start_st": None, "end_st": None,
                "median_st": None, "slope": None, "peak_st": None, "peak_position": None,
            }
        else:
            position = int(np.nanargmax(valid_contour))
            slope = (float(valid_contour[-1]) - float(valid_contour[0])) / max(mora.duration_ms / 1000.0, 1e-3)
            values = {
                "median_hz": round(float(np.median(f0[voiced])), 5),
                "min_hz": round(float(np.min(f0[voiced])), 5),
                "max_hz": round(float(np.max(f0[voiced])), 5),
                "start_st": round(float(valid_contour[0]), 5),
                "end_st": round(float(valid_contour[-1]), 5),
                "median_st": round(float(np.median(valid_contour)), 5),
                "slope": round(slope, 5),
                "peak_st": round(float(np.max(valid_contour)), 5),
                "peak_position": round(position / max(voiced_count - 1, 1), 5),
            }
        rows.append(
            MoraProsody(
                mora_index=mora.mora_index,
                label=mora.label,
                phonemes=mora.phonemes,
                start_ms=mora.start_ms,
                end_ms=mora.end_ms,
                duration_ms=mora.duration_ms,
                kind=mora.kind,
                voiced_frame_count=voiced_count,
                total_frame_count=total_count,
                voiced_ratio=ratio,
                f0_median_hz=values["median_hz"],
                f0_min_hz=values["min_hz"],
                f0_max_hz=values["max_hz"],
                f0_start_st=values["start_st"],
                f0_end_st=values["end_st"],
                f0_median_st=values["median_st"],
                f0_slope_st_per_second=values["slope"],
                f0_peak_st=values["peak_st"],
                f0_peak_relative_position=values["peak_position"],
                energy_rms=_energy_rms(signal, sample_rate, mora.start_ms, mora.end_ms),
                pause_before_ms=_adjacent_pause_ms(morae, mora_position, direction=-1),
                pause_after_ms=_adjacent_pause_ms(morae, mora_position, direction=1),
                long_vowel_group=mora.long_vowel_group,
                long_vowel_position=mora.long_vowel_position,
            )
        )
    return tuple(rows), utterance_median_hz


def extract_mora_prosody(
    audio_path: Path,
    morae: Sequence[Mora],
    *,
    config: PitchConfig = PitchConfig(),
    minimum_voiced_frames: int = 3,
) -> tuple[tuple[MoraProsody, ...], PitchTrack, float | None]:
    """Run B1 on an already B0-aligned utterance."""
    signal, sample_rate = _load_prepared_audio(audio_path)
    track = extract_pitch_track(audio_path, config=config)
    features, utterance_median_hz = summarize_mora_prosody(
        morae,
        track,
        signal=signal,
        sample_rate=sample_rate,
        minimum_voiced_frames=minimum_voiced_frames,
    )
    return features, track, utterance_median_hz
