import json

from src.b4_baseline import FEATURE_NAMES, build_training_rows, load_baseline, predict_mora, train_baseline


def _evidence(index: int) -> dict:
    return {
        "schemaVersion": "kotodama-model-b-b2-v1",
        "morae": [{
            "moraIndex": 0, "label": "ka", "referenceKind": "mora", "pitchDtw": {"mean_absolute_distance_st": 0.1 + index * 0.04},
            "durationRatioLearnerToReference": 1.0 + (index % 3) * 0.12, "durationDeltaMs": index * 5,
            "referenceDurationMs": 100, "voicedRatioDelta": 0.02 * index, "f0MedianDeltaSemitones": 0.1 * index,
            "f0StartDeltaSemitones": 0.2 * index, "f0EndDeltaSemitones": 0.1 * index,
            "f0SlopeDeltaSemitonesPerSecond": 0.05 * index, "energyDeltaDb": 0.3 * index,
            "pauseBeforeDeltaMs": index, "pauseAfterDeltaMs": -index,
        }],
    }


def _row(index: int, split: str) -> dict:
    pitch = ("correct", "near_correct", "incorrect")[index % 3]
    rhythm = ("correct", "too_fast", "long_vowel_shortened")[index % 3]
    return {
        "schemaVersion": "kotodama-model-b-b3-v1", "attemptId": f"attempt_{index}", "learnerSpeakerId": f"vn{index:03d}",
        "l1Code": "vi", "referenceId": "ref_001", "sentenceId": "sentence_001", "expectedText": "か。",
        "b2EvidencePath": f"comparisons/attempt_{index}.json", "morae": [{"moraIndex": 0, "label": "ka"}],
        "focusMoraIndices": [0], "consentVersion": "pilot-v1", "split": split,
        "annotation": {"annotationId": f"attempt_{index}__rater_01", "raterId": "rater_01", "pitchAccent": pitch,
                       "rhythm": rhythm, "intonation": "natural" if index % 2 == 0 else "needs_work",
                       "problematicMoraIndices": [] if index % 2 == 0 else [0], "raterConfidence": 4, "recordingQuality": "usable"},
    }


def test_b4_trains_three_models_and_scores_one_mora(tmp_path) -> None:
    data_root = tmp_path / "data"
    (data_root / "comparisons").mkdir(parents=True)
    splits = ["train"] * 9 + ["validation"] * 2 + ["test"] * 2
    rows = []
    for index, split in enumerate(splits):
        (data_root / "comparisons" / f"attempt_{index}.json").write_text(json.dumps(_evidence(index)), encoding="utf-8")
        rows.append(_row(index, split))
    manifest = tmp_path / "b3.jsonl"
    manifest.write_text("\n".join(json.dumps(row) for row in rows) + "\n", encoding="utf-8")
    training_rows = build_training_rows(manifest, data_root=data_root)
    assert len(training_rows) == len(rows)
    assert len(training_rows[0].values) == len(FEATURE_NAMES)
    output = tmp_path / "artifact"
    report = train_baseline(manifest, data_root=data_root, output_dir=output, random_state=4)
    assert set(report["tasks"]) == {"pitch", "rhythm", "intonation"}
    artifact = load_baseline(output)
    prediction = predict_mora(artifact, training_rows[0])
    assert set(prediction["scores"]) == {"pitch", "rhythm", "intonation"}
    assert 0 <= prediction["scores"]["pitch"]["calibratedScore"] <= 100
