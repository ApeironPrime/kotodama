from pathlib import Path

import numpy as np
import pytest
import soundfile as sf

from src.audio import AudioInfo, AudioPreparationError, prepare_audio, validate_model_audio


def test_validate_model_audio_accepts_prepared_sentence() -> None:
    validate_model_audio(AudioInfo(Path("sample.wav"), 16000, 1, 16000, 1.0))


def test_validate_model_audio_rejects_stereo() -> None:
    with pytest.raises(AudioPreparationError, match="mono"):
        validate_model_audio(AudioInfo(Path("sample.wav"), 16000, 2, 16000, 1.0))


def test_prepare_audio_resamples_wav_when_ffmpeg_is_unavailable(tmp_path: Path) -> None:
    source = tmp_path / "source.wav"
    destination = tmp_path / "prepared.wav"
    sf.write(source, np.zeros((2400, 2), dtype=np.float32), 24000)

    prepared = prepare_audio(source, destination, ffmpeg_path="missing-ffmpeg-for-test")

    assert prepared.sample_rate == 16000
    assert prepared.channels == 1
    assert prepared.duration_seconds == pytest.approx(0.1, abs=0.01)
