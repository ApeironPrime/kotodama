import numpy as np

from src.mora import phonemes_to_moras
from src.prosody import PitchTrack, normalize_f0_semitones, summarize_mora_prosody


def _phone(phoneme, start, end, index):
    return {"phoneme": phoneme, "startMs": start, "endMs": end, "index": index}


def test_normalizes_pitch_to_utterance_median_and_keeps_unvoiced_nan():
    normalized, median = normalize_f0_semitones(np.array([100.0, 200.0, 0.0, np.nan]))
    assert median == 150.0
    assert round(float(normalized[0]), 4) == round(-7.019550008653875, 4)
    assert round(float(normalized[1]), 4) == round(4.980449991346125, 4)
    assert np.isnan(normalized[2]) and np.isnan(normalized[3])


def test_summarizes_voiced_mora_without_scoring_pause():
    morae = phonemes_to_moras([_phone("k", 0, 30, 0), _phone("a", 30, 100, 1), _phone("pau", 100, 140, 2)])
    track = PitchTrack(
        times_seconds=np.array([0.01, 0.04, 0.07, 0.11, 0.13]),
        f0_hz=np.array([100.0, 110.0, 120.0, 0.0, 0.0]),
        method="test",
    )
    rows, utterance_median = summarize_mora_prosody(morae, track, minimum_voiced_frames=3)
    assert utterance_median == 110.0
    assert rows[0].label == "ka"
    assert rows[0].voiced_ratio == 1.0
    assert rows[0].f0_slope_st_per_second is not None
    assert rows[1].kind == "pause"
    assert rows[1].f0_median_hz is None


def test_exposes_adjacent_pause_duration_for_phrase_features():
    morae = phonemes_to_moras([
        _phone("a", 0, 70, 0), _phone("pau", 70, 120, 1), _phone("N", 120, 190, 2)
    ])
    track = PitchTrack(np.array([0.01, 0.04, 0.15, 0.18]), np.array([100.0, 110.0, 120.0, 125.0]), "test")
    rows, _ = summarize_mora_prosody(morae, track, minimum_voiced_frames=2)
    assert rows[0].pause_after_ms == 50.0
    assert rows[2].pause_before_ms == 50.0


def test_unvoiced_mora_has_quality_evidence_but_no_contour_stats():
    morae = phonemes_to_moras([_phone("a", 0, 80, 0)])
    track = PitchTrack(np.array([0.01, 0.04, 0.07]), np.array([0.0, 0.0, 0.0]), "test")
    rows, _ = summarize_mora_prosody(morae, track)
    assert rows[0].voiced_ratio == 0.0
    assert rows[0].f0_median_hz is None
