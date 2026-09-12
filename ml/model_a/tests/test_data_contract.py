from pathlib import Path

from src.data_contract import assign_speaker_splits, validate_rows, write_jsonl


def _row(speaker: str, recording: str, split: str = "unassigned") -> dict:
    return {
        "recordingId": recording,
        "audioPath": f"{speaker}/{recording}.wav",
        "speakerId": speaker,
        "sentenceId": "s001",
        "textJa": "切手を買いました。",
        "phonemesRef": "k i cl t e o k a i m a sh i t a",
        "targetPhones": ["cl"],
        "targetPhoneIndices": [2],
        "targetError": "sokuon",
        "level": "N4",
        "device": "laptop_microphone",
        "consentVersion": "kotodama-pilot-v1",
        "split": split,
    }


def test_valid_annotation_manifest_is_accepted() -> None:
    row = _row("vn001", "rec001")
    row["annotation"] = {
        "raterId": "rater_01",
        "phoneLabels": [{"phoneIndex": 2, "phone": "cl", "label": "incorrect", "errorType": "deletion", "raterConfidence": 4}],
        "sentenceIntelligibility": 4,
        "recordingQuality": "usable",
    }
    assert validate_rows([row]).is_valid


def test_manifest_rejects_path_escape_and_phone_label_mismatch() -> None:
    row = _row("vn001", "rec001")
    row["audioPath"] = "../outside.wav"
    row["annotation"] = {
        "raterId": "rater_01",
        "phoneLabels": [{"phoneIndex": 2, "phone": "ts", "label": "incorrect", "errorType": "deletion", "raterConfidence": 4}],
        "sentenceIntelligibility": 4,
        "recordingQuality": "usable",
    }
    messages = [issue.message for issue in validate_rows([row]).issues]
    assert any("audioPath" in message for message in messages)
    assert any("phone must match" in message for message in messages)


def test_annotation_accepts_known_error_pattern() -> None:
    row = _row("vn001", "rec001")
    row["annotation"] = {
        "raterId": "rater_01",
        "phoneLabels": [
            {
                "phoneIndex": 2,
                "phone": "cl",
                "label": "incorrect",
                "errorType": "deletion",
                "errorPattern": "sokuon_deleted",
                "raterConfidence": 4,
            }
        ],
        "sentenceIntelligibility": 4,
        "recordingQuality": "usable",
    }
    assert validate_rows([row]).is_valid


def test_annotation_rejects_error_pattern_on_correct_phone() -> None:
    row = _row("vn001", "rec001")
    row["annotation"] = {
        "raterId": "rater_01",
        "phoneLabels": [
            {
                "phoneIndex": 2,
                "phone": "cl",
                "label": "correct",
                "errorPattern": "sokuon_deleted",
                "raterConfidence": 4,
            }
        ],
        "sentenceIntelligibility": 4,
        "recordingQuality": "usable",
    }
    report = validate_rows([row])
    assert any("cannot have an errorType/errorPattern" in issue.message for issue in report.issues)


def test_speaker_split_is_deterministic_and_disjoint() -> None:
    rows = [_row("vn001", "r1"), _row("vn001", "r2"), _row("vn002", "r3"), _row("vn003", "r4"), _row("vn004", "r5")]
    assigned_once = assign_speaker_splits(rows, seed="a5-test")
    assigned_twice = assign_speaker_splits(rows, seed="a5-test")

    assert [row["split"] for row in assigned_once] == [row["split"] for row in assigned_twice]
    assert assigned_once[0]["split"] == assigned_once[1]["split"]
    assert validate_rows(assigned_once, require_assigned_split=True).is_valid


def test_write_jsonl_refuses_to_overwrite(tmp_path: Path) -> None:
    destination = tmp_path / "manifest.jsonl"
    write_jsonl(destination, [_row("vn001", "r1")])
    try:
        write_jsonl(destination, [_row("vn001", "r2")])
    except Exception as error:
        assert "Refusing to overwrite" in str(error)
    else:
        raise AssertionError("existing private manifest was overwritten")
