import numpy as np
import pytest

from src.ctc_align import CtcAlignmentError, ctc_viterbi_align, phones_to_token_ids


def test_viterbi_aligns_distinct_reference_phones_to_monotonic_spans() -> None:
    # blank=0, a=1, b=2. The intended path is a a blank b b blank.
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
    result = ctc_viterbi_align(np.log(probabilities), (1, 2), ("a", "b"), blank_id=0, duration_ms=600)

    assert [(item.phoneme, item.start_frame, item.end_frame) for item in result.segments] == [
        ("a", 0, 2),
        ("b", 3, 5),
    ]
    assert result.segments[0].end_ms <= result.segments[1].start_ms


def test_viterbi_keeps_repeated_phone_separate_with_a_blank() -> None:
    probabilities = np.array(
        [
            [0.05, 0.95],
            [0.05, 0.95],
            [0.98, 0.02],
            [0.05, 0.95],
            [0.05, 0.95],
            [0.98, 0.02],
        ]
    )
    result = ctc_viterbi_align(np.log(probabilities), (1, 1), ("a", "a"), blank_id=0, duration_ms=600)

    assert [(item.start_frame, item.end_frame) for item in result.segments] == [(0, 2), (3, 5)]


def test_mapping_rejects_unknown_reference_phone() -> None:
    with pytest.raises(CtcAlignmentError, match="absent"):
        phones_to_token_ids(("a", "unknown"), {"a": 1}, blank_id=0)
