from src.label_contract import assign_learner_speaker_splits, validate_rows


def _row(speaker: str = "vn001", attempt: str = "attempt_001", split: str = "unassigned") -> dict:
    return {
        "schemaVersion": "kotodama-model-b-b3-v1",
        "attemptId": attempt,
        "learnerSpeakerId": speaker,
        "l1Code": "vi",
        "referenceId": "jvs001_parallel100_001",
        "sentenceId": "jvs_parallel100_001",
        "expectedText": "切手を買いました。",
        "b2EvidencePath": f"comparisons/{attempt}.json",
        "morae": [{"moraIndex": 0, "label": "ki"}, {"moraIndex": 1, "label": "cl"}],
        "focusMoraIndices": [1],
        "consentVersion": "kotodama-b3-pilot-v1",
        "split": split,
    }


def test_accepts_annotation_and_optional_l1_code() -> None:
    row = _row()
    row["annotation"] = {
        "annotationId": "attempt_001__rater_01", "raterId": "rater_01", "pitchAccent": "near_correct", "rhythm": "sokuon_weak", "intonation": "needs_work",
        "problematicMoraIndices": [1], "raterConfidence": 4, "recordingQuality": "usable",
    }
    assert validate_rows([row]).is_valid


def test_rejects_problem_mora_outside_focus() -> None:
    row = _row()
    row["annotation"] = {
        "annotationId": "attempt_001__rater_01", "raterId": "rater_01", "pitchAccent": "incorrect", "rhythm": "other", "intonation": "needs_work",
        "problematicMoraIndices": [0], "raterConfidence": 4, "recordingQuality": "usable",
    }
    report = validate_rows([row])
    assert any("focusMoraIndices" in issue.message for issue in report.issues)


def test_assigns_splits_by_learner_speaker_only() -> None:
    rows = [_row("vn001", "a"), _row("vn001", "b"), _row("vn002", "c"), _row("vn003", "d"), _row("vn004", "e")]
    assigned = assign_learner_speaker_splits(rows, seed="b3-test")
    assert assigned[0]["split"] == assigned[1]["split"]
    assert validate_rows(assigned, require_assigned_split=True).is_valid


def test_allows_double_rating_of_one_attempt_when_annotation_ids_differ() -> None:
    first = _row("vn001", "attempt_shared", "train")
    first["annotation"] = {
        "annotationId": "attempt_shared__rater_01", "raterId": "rater_01", "pitchAccent": "correct", "rhythm": "correct",
        "intonation": "natural", "problematicMoraIndices": [], "raterConfidence": 4, "recordingQuality": "usable",
    }
    second = _row("vn001", "attempt_shared", "train")
    second["annotation"] = {**first["annotation"], "annotationId": "attempt_shared__rater_02", "raterId": "rater_02"}
    assert validate_rows([first, second], require_assigned_split=True).is_valid
