from src.acoustic_finetune import NATIVE_SCHEMA_VERSION, _conv_output_frames, ctc_required_frames, validate_native_rows


def _row(speaker: str, split: str, recording: str) -> dict:
    return {
        "schemaVersion": NATIVE_SCHEMA_VERSION,
        "recordingId": recording,
        "audioPath": f"{recording}.wav",
        "speakerId": speaker,
        "split": split,
        "phonemesCtc": "k i cl t e o k a i m a sh i t a",
        "labelSource": "native",
    }


def test_native_ctc_contract_accepts_native_and_rejects_speaker_leakage() -> None:
    assert validate_native_rows([_row("native01", "train", "r1"), _row("native02", "validation", "r2")]) == []
    issues = validate_native_rows([_row("native01", "train", "r1"), _row("native01", "validation", "r2")])
    assert any("speaker leakage" in issue for issue in issues)


def test_expert_realized_learner_audio_must_not_use_intended_phonemes() -> None:
    row = _row("learner01", "train", "r1")
    row["labelSource"] = "expert_verified_realized"
    row["realizedPhonemes"] = "k i t e"
    assert any("realizedPhonemes" in issue for issue in validate_native_rows([row]))


def test_ctc_frame_feasibility_accounts_for_adjacent_repeated_phones() -> None:
    assert ctc_required_frames(["k", "a", "a", "N"]) == 5
    assert _conv_output_frames(16000, [10, 3, 3, 3, 3, 2, 2], [5, 2, 2, 2, 2, 2, 2]) == 49
