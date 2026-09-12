from src.mora import MoraAlignmentError, phonemes_to_moras


def _phone(phoneme, start, end, index):
    return {"phoneme": phoneme, "startMs": start, "endMs": end, "index": index}


def test_groups_consonant_vowel_and_special_morae():
    morae = phonemes_to_moras(
        [
            _phone("k", 0, 40, 0), _phone("i", 40, 100, 1),
            _phone("cl", 100, 130, 2), _phone("t", 130, 160, 3), _phone("e", 160, 230, 4),
            _phone("N", 230, 280, 5), _phone("ky", 280, 320, 6), _phone("o", 320, 390, 7),
        ]
    )
    assert [mora.label for mora in morae] == ["ki", "cl", "te", "N", "kyo"]
    assert [mora.duration_ms for mora in morae] == [100.0, 30.0, 100.0, 50.0, 110.0]


def test_marks_explicit_repeated_vowel_without_collapsing_it():
    morae = phonemes_to_moras([_phone("k", 0, 30, 0), _phone("o", 30, 90, 1), _phone("o", 90, 170, 2)])
    assert [mora.label for mora in morae] == ["ko", "o"]
    assert [mora.long_vowel_position for mora in morae] == ["onset", "continuation"]
    assert morae[0].long_vowel_group == morae[1].long_vowel_group


def test_keeps_pauses_out_of_scored_mora_kind():
    morae = phonemes_to_moras([_phone("a", 0, 50, 0), _phone("pau", 50, 120, 1), _phone("N", 120, 180, 2)])
    assert [mora.kind for mora in morae] == ["mora", "pause", "mora"]


def test_rejects_overlapping_model_a_spans():
    try:
        phonemes_to_moras([_phone("a", 0, 50, 0), _phone("i", 40, 90, 1)])
    except MoraAlignmentError as error:
        assert "overlap" in str(error).lower()
    else:
        raise AssertionError("Expected MoraAlignmentError")
