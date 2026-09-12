"""Audio preparation for phoneme inference without destructive processing."""

from __future__ import annotations

import subprocess
from math import gcd
from dataclasses import dataclass
from pathlib import Path


class AudioPreparationError(RuntimeError):
    """Raised when audio cannot be made suitable for Model A."""


@dataclass(frozen=True)
class AudioInfo:
    path: Path
    sample_rate: int
    channels: int
    frames: int
    duration_seconds: float


def inspect_wav(path: Path) -> AudioInfo:
    """Read WAV metadata only; audio is not modified."""
    try:
        import soundfile as sf
    except ImportError as error:
        raise AudioPreparationError("soundfile is required; install Model A requirements.") from error
    if not path.is_file():
        raise AudioPreparationError(f"Audio file was not found: {path}")
    try:
        info = sf.info(str(path))
    except RuntimeError as error:
        raise AudioPreparationError(f"Unable to read audio metadata: {path}") from error
    duration = info.frames / info.samplerate if info.samplerate else 0
    return AudioInfo(path, info.samplerate, info.channels, info.frames, duration)


def validate_model_audio(info: AudioInfo, *, max_seconds: float = 10) -> None:
    """Ensure an already-prepared file follows the A0–A1 input contract."""
    if info.sample_rate != 16000:
        raise AudioPreparationError(f"Expected 16 kHz WAV, got {info.sample_rate} Hz: {info.path}")
    if info.channels != 1:
        raise AudioPreparationError(f"Expected mono WAV, got {info.channels} channels: {info.path}")
    if info.duration_seconds <= 0:
        raise AudioPreparationError(f"Audio has no duration: {info.path}")
    if info.duration_seconds > max_seconds:
        raise AudioPreparationError(
            f"Audio is {info.duration_seconds:.2f}s; Model A baseline accepts at most {max_seconds:.0f}s per sentence."
        )


def _resample_wav_without_ffmpeg(source: Path, destination: Path) -> AudioInfo:
    """Fallback for local WAV corpora when FFmpeg is unavailable.

    This intentionally supports WAV only.  Browser uploads such as WebM still
    require FFmpeg, while a research corpus such as JVS can be prepared without
    adding a machine-wide executable to PATH.
    """
    if source.suffix.lower() != ".wav":
        raise AudioPreparationError("FFmpeg is required to prepare non-WAV audio files.")
    try:
        import numpy as np
        import soundfile as sf
        from scipy.signal import resample_poly
    except ImportError as error:
        raise AudioPreparationError("Install soundfile and scipy, or configure FFmpeg.") from error

    try:
        waveform, sample_rate = sf.read(str(source), dtype="float32", always_2d=True)
    except RuntimeError as error:
        raise AudioPreparationError(f"Unable to read WAV audio: {source}") from error
    mono = np.asarray(waveform, dtype=np.float32).mean(axis=1)
    divisor = gcd(int(sample_rate), 16000)
    converted = resample_poly(mono, 16000 // divisor, int(sample_rate) // divisor).astype(np.float32)
    sf.write(str(destination), converted, 16000, subtype="PCM_16")
    return inspect_wav(destination)


def prepare_audio(source: Path, destination: Path, *, ffmpeg_path: str = "ffmpeg") -> AudioInfo:
    """Create a new mono 16 kHz PCM WAV without overwriting an existing file."""
    if not source.is_file():
        raise AudioPreparationError(f"Input audio file was not found: {source}")
    if destination.exists():
        raise AudioPreparationError(f"Refusing to overwrite existing output: {destination}")
    destination.parent.mkdir(parents=True, exist_ok=True)
    command = [
        ffmpeg_path,
        "-nostdin",
        "-n",
        "-i",
        str(source),
        "-vn",
        "-ac",
        "1",
        "-ar",
        "16000",
        "-c:a",
        "pcm_s16le",
        str(destination),
    ]
    try:
        result = subprocess.run(command, capture_output=True, text=True, check=False)
    except FileNotFoundError:
        return _resample_wav_without_ffmpeg(source, destination)
    if result.returncode != 0:
        error_tail = result.stderr[-800:].strip()
        raise AudioPreparationError(f"FFmpeg conversion failed: {error_tail}")
    return inspect_wav(destination)


def load_waveform(path: Path, *, target_sample_rate: int = 16000):
    """Load a prepared mono waveform as float32 without changing loudness."""
    info = inspect_wav(path)
    if info.sample_rate != target_sample_rate or info.channels != 1:
        raise AudioPreparationError("Audio must be prepared with prepare_audio before model inference.")
    try:
        import numpy as np
        import soundfile as sf
    except ImportError as error:
        raise AudioPreparationError("numpy and soundfile are required; install Model A requirements.") from error
    waveform, sample_rate = sf.read(str(path), dtype="float32", always_2d=False)
    if sample_rate != target_sample_rate:
        raise AudioPreparationError("Prepared audio sample rate changed during loading.")
    return np.asarray(waveform, dtype=np.float32)
