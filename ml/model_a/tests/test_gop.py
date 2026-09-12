import numpy as np

from src.ctc_align import ctc_viterbi_align
from src.gop import analyze_gop, estimate_audio_quality


def test_gop_is_positive_when_expected_phone_dominates_its_aligned_frames() -> None:
    # blank=0, a=1, b=2; the reference path is a a blank b b blank.
    probabilities = np.array(
        [
            [0.05, 0.90, 0.05],
            [0.05, 0.90, 0.05],
            [0.95, 0.03, 0.02],
            [0.05, 0.02, 0.93],
            [0.05, 0.02, 0.93],
            [0.90, 0.05, 0.05],
        ]
    )
    alignment = ctc_viterbi_align(np.log(probabilities), (1, 2), ("a", "b"), blank_id=0, duration_ms=600)
    result = analyze_gop(np.log(probabilities), alignment, {"[PAD]": 0, "a": 1, "b": 2}, blank_id=0)

    assert [item.top1_phone for item in result.phonemes] == ["a", "b"]
    assert all(item.gop > 0 for item in result.phonemes)
    assert all(item.expected_probability > item.competitor_probability for item in result.phonemes)


def test_gop_is_negative_when_a_competitor_dominates_the_forced_span() -> None:
    probabilities = np.array(
        [
            [0.05, 0.05, 0.90],
            [0.05, 0.05, 0.90],
            [0.90, 0.05, 0.05],
        ]
    )
    alignment = ctc_viterbi_align(np.log(probabilities), (1,), ("a",), blank_id=0, duration_ms=300)
    result = analyze_gop(np.log(probabilities), alignment, {"[PAD]": 0, "a": 1, "b": 2}, blank_id=0)

    evidence = result.phonemes[0]
    assert evidence.gop < 0
    assert evidence.best_competitor == "b"


def test_audio_quality_reports_clipping_without_changing_waveform() -> None:
    waveform = np.array([0.0, 0.2, -0.2, 1.0, -1.0] * 100, dtype=np.float32)
    result = estimate_audio_quality(waveform, sample_rate=16000)

    assert result.clipping_ratio == 0.4
