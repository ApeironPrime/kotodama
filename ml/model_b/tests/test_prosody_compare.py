import numpy as np

from src.mora import Mora, phonemes_to_moras
from src.prosody import PitchTrack, summarize_mora_prosody
from src.prosody_compare import ProsodyComparisonError, compare_mora_prosody, dtw_absolute_semitones


def _phone(phoneme, start, end, index):
    return {"phoneme": phoneme, "startMs": start, "endMs": end, "index": index}


def _features(morae, track):
    return summarize_mora_prosody(morae, track, minimum_voiced_frames=3)[0]


def test_dtw_is_zero_for_the_same_contour_at_different_sampling_rates():
    evidence = dtw_absolute_semitones([-1.0, 0.0, 1.0], [-1.0, -0.5, 0.0, 0.5, 1.0])
    assert evidence.status == "ok"
    assert evidence.path_length == 5
    assert evidence.mean_absolute_distance_st == 0.2


def test_b2_compares_mora_internal_pitch_and_timing_evidence():
    reference_morae = phonemes_to_moras([_phone("k", 0, 25, 0), _phone("a", 25, 100, 1), _phone("pau", 100, 140, 2), _phone("N", 140, 200, 3)])
    learner_morae = phonemes_to_moras([_phone("k", 0, 30, 0), _phone("a", 30, 120, 1), _phone("pau", 120, 180, 2), _phone("N", 180, 250, 3)])
    reference_track = PitchTrack(np.array([0.01, 0.04, 0.07, 0.15, 0.18]), np.array([100.0, 110.0, 120.0, 115.0, 105.0]), "test")
    learner_track = PitchTrack(np.array([0.01, 0.05, 0.09, 0.19, 0.22]), np.array([200.0, 220.0, 240.0, 230.0, 210.0]), "test")
    result = compare_mora_prosody(
        reference_morae,
        learner_morae,
        reference_track,
        learner_track,
        _features(reference_morae, reference_track),
        _features(learner_morae, learner_track),
    )
    assert result.comparable_mora_count == 2
    assert result.pitch_evidence_mora_count == 1
    assert result.morae[0].pitch_dtw.status == "ok"
    assert result.morae[0].duration_ratio_learner_to_reference == 1.2
    assert result.morae[0].pause_after_delta_ms == 20.0
    assert result.to_dict()["summary"]["meanPitchDtwDistanceSemitones"] is not None


def test_b2_refuses_to_compare_different_expected_mora_sequences():
    reference_morae = phonemes_to_moras([_phone("k", 0, 20, 0), _phone("a", 20, 80, 1)])
    learner_morae = phonemes_to_moras([_phone("s", 0, 20, 0), _phone("a", 20, 80, 1)])
    track = PitchTrack(np.array([0.01, 0.04, 0.07]), np.array([100.0, 110.0, 120.0]), "test")
    try:
        compare_mora_prosody(reference_morae, learner_morae, track, track, _features(reference_morae, track), _features(learner_morae, track))
    except ProsodyComparisonError as error:
        assert "topology differs" in str(error)
    else:
        raise AssertionError("B2 should reject unrelated mora sequences")
