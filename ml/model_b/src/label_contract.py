"""B3 contract for auditable human prosody labels.

The contract deliberately stores only pseudonymous speaker IDs and a chosen
L1 code. It never infers ethnicity, nationality, gender, or identity from
audio. Labels are used for later B4 calibration, not for CTC training.
"""

from __future__ import annotations

import copy
import hashlib
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable


VALID_SPLITS = frozenset({"train", "validation", "test", "unassigned"})
VALID_PITCH_LABELS = frozenset({"correct", "near_correct", "incorrect", "unscorable"})
VALID_RHYTHM_LABELS = frozenset(
    {"correct", "too_fast", "too_slow", "long_vowel_shortened", "sokuon_weak", "other", "unscorable"}
)
VALID_INTONATION_LABELS = frozenset({"natural", "needs_work", "unscorable"})
VALID_RECORDING_QUALITY = frozenset({"usable", "noisy", "clipped", "too_short", "invalid"})


class ProsodyManifestError(ValueError):
    """Raised for malformed B3 JSONL or unsafe output paths."""


@dataclass(frozen=True)
class ManifestIssue:
    line: int
    message: str


@dataclass(frozen=True)
class ManifestReport:
    row_count: int
    learner_speaker_count: int
    rows_by_split: dict[str, int]
    learner_speakers_by_split: dict[str, int]
    issues: tuple[ManifestIssue, ...]

    @property
    def is_valid(self) -> bool:
        return not self.issues


def read_jsonl(path: Path) -> list[dict[str, Any]]:
    if not path.is_file():
        raise ProsodyManifestError(f"Manifest was not found: {path}")
    rows: list[dict[str, Any]] = []
    for line_number, raw in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
        if not raw.strip():
            continue
        try:
            row = json.loads(raw)
        except json.JSONDecodeError as error:
            raise ProsodyManifestError(f"Invalid JSON on line {line_number}: {error.msg}") from error
        if not isinstance(row, dict):
            raise ProsodyManifestError(f"Line {line_number} must be a JSON object.")
        row["_manifestLine"] = line_number
        rows.append(row)
    if not rows:
        raise ProsodyManifestError("Manifest has no rows.")
    return rows


def write_jsonl(path: Path, rows: Iterable[dict[str, Any]]) -> None:
    if path.exists():
        raise ProsodyManifestError(f"Refusing to overwrite existing manifest: {path}")
    path.parent.mkdir(parents=True, exist_ok=True)
    serialized = [json.dumps({key: value for key, value in row.items() if key != "_manifestLine"}, ensure_ascii=False, sort_keys=True) for row in rows]
    path.write_text("\n".join(serialized) + "\n", encoding="utf-8")


def _string(value: Any) -> bool:
    return isinstance(value, str) and bool(value.strip())


def _relative_json_path(value: Any) -> bool:
    if not _string(value):
        return False
    path = Path(value)
    return not path.is_absolute() and ".." not in path.parts and path.suffix.lower() == ".json"


def _mora_indices(row: dict[str, Any], line: int, issues: list[ManifestIssue]) -> set[int]:
    morae = row.get("morae")
    if not isinstance(morae, list) or not morae:
        issues.append(ManifestIssue(line, "morae must be a non-empty list copied from B2 evidence."))
        return set()
    indices: set[int] = set()
    for position, mora in enumerate(morae):
        if not isinstance(mora, dict) or not isinstance(mora.get("moraIndex"), int) or not _string(mora.get("label")):
            issues.append(ManifestIssue(line, f"morae[{position}] requires moraIndex and label."))
            continue
        index = mora["moraIndex"]
        if index in indices:
            issues.append(ManifestIssue(line, f"morae contains duplicate moraIndex {index}."))
        indices.add(index)
    return indices


def _validate_annotation(row: dict[str, Any], line: int, valid_mora_indices: set[int], issues: list[ManifestIssue]) -> None:
    annotation = row.get("annotation")
    if annotation is None:
        return
    if not isinstance(annotation, dict):
        issues.append(ManifestIssue(line, "annotation must be an object when present."))
        return
    if not _string(annotation.get("raterId")):
        issues.append(ManifestIssue(line, "annotation.raterId is required."))
    if not _string(annotation.get("annotationId")):
        issues.append(ManifestIssue(line, "annotation.annotationId is required."))
    if annotation.get("pitchAccent") not in VALID_PITCH_LABELS:
        issues.append(ManifestIssue(line, "annotation.pitchAccent is invalid."))
    if annotation.get("rhythm") not in VALID_RHYTHM_LABELS:
        issues.append(ManifestIssue(line, "annotation.rhythm is invalid."))
    if annotation.get("intonation") not in VALID_INTONATION_LABELS:
        issues.append(ManifestIssue(line, "annotation.intonation is invalid."))
    if annotation.get("recordingQuality") not in VALID_RECORDING_QUALITY:
        issues.append(ManifestIssue(line, "annotation.recordingQuality is invalid."))
    confidence = annotation.get("raterConfidence")
    if not isinstance(confidence, int) or not 1 <= confidence <= 5:
        issues.append(ManifestIssue(line, "annotation.raterConfidence must be an integer from 1 to 5."))
    problematic = annotation.get("problematicMoraIndices")
    if not isinstance(problematic, list) or not all(isinstance(index, int) for index in problematic):
        issues.append(ManifestIssue(line, "annotation.problematicMoraIndices must be a list of integers."))
    elif len(set(problematic)) != len(problematic):
        issues.append(ManifestIssue(line, "annotation.problematicMoraIndices must not contain duplicates."))
    else:
        focus = set(row.get("focusMoraIndices", []))
        for index in problematic:
            if index not in valid_mora_indices:
                issues.append(ManifestIssue(line, "annotation.problematicMoraIndices includes a mora not in morae."))
            if index not in focus:
                issues.append(ManifestIssue(line, "annotation.problematicMoraIndices must remain within focusMoraIndices for the pilot."))


def validate_rows(rows: list[dict[str, Any]], *, require_assigned_split: bool = False) -> ManifestReport:
    """Validate B3 records and prevent learner-speaker leakage between splits."""
    issues: list[ManifestIssue] = []
    ids: set[str] = set()
    annotation_ids: set[str] = set()
    speaker_splits: dict[str, set[str]] = {}
    rows_by_split = {split: 0 for split in sorted(VALID_SPLITS)}
    for fallback_line, row in enumerate(rows, start=1):
        line = int(row.get("_manifestLine", fallback_line))
        for field in ("schemaVersion", "attemptId", "learnerSpeakerId", "referenceId", "sentenceId", "expectedText", "consentVersion"):
            if not _string(row.get(field)):
                issues.append(ManifestIssue(line, f"{field} must be a non-empty string."))
        if row.get("schemaVersion") != "kotodama-model-b-b3-v1":
            issues.append(ManifestIssue(line, "schemaVersion must be kotodama-model-b-b3-v1."))
        attempt_id = row.get("attemptId")
        if _string(attempt_id):
            # An attempt may deliberately be assessed by two raters.  Raw,
            # unannotated intake rows still need a unique attempt ID.
            annotation = row.get("annotation")
            if annotation is None:
                if attempt_id in ids:
                    issues.append(ManifestIssue(line, f"Unannotated attemptId is duplicated: {attempt_id}"))
                ids.add(attempt_id)
            elif isinstance(annotation, dict) and _string(annotation.get("annotationId")):
                annotation_id = str(annotation["annotationId"])
                if annotation_id in annotation_ids:
                    issues.append(ManifestIssue(line, f"annotation.annotationId is duplicated: {annotation_id}"))
                annotation_ids.add(annotation_id)
        if not _relative_json_path(row.get("b2EvidencePath")):
            issues.append(ManifestIssue(line, "b2EvidencePath must be a relative .json path without '..'."))
        l1_code = row.get("l1Code")
        if l1_code is not None and (not isinstance(l1_code, str) or not 2 <= len(l1_code) <= 8 or not l1_code.replace("-", "").isalpha()):
            issues.append(ManifestIssue(line, "l1Code must be an optional short language code such as vi or zh-Hans."))
        split = row.get("split")
        if split not in VALID_SPLITS:
            issues.append(ManifestIssue(line, "split must be train, validation, test, or unassigned."))
        else:
            rows_by_split[split] += 1
            if require_assigned_split and split == "unassigned":
                issues.append(ManifestIssue(line, "split must be assigned before training."))
            speaker = row.get("learnerSpeakerId")
            if _string(speaker):
                speaker_splits.setdefault(speaker, set()).add(split)
        indices = _mora_indices(row, line, issues)
        focus = row.get("focusMoraIndices")
        if not isinstance(focus, list) or not focus or not all(isinstance(index, int) for index in focus):
            issues.append(ManifestIssue(line, "focusMoraIndices must be a non-empty list of mora indices."))
        elif len(set(focus)) != len(focus) or any(index not in indices for index in focus):
            issues.append(ManifestIssue(line, "focusMoraIndices must be unique indices present in morae."))
        _validate_annotation(row, line, indices, issues)
    for speaker, splits in speaker_splits.items():
        assigned = splits - {"unassigned"}
        if len(assigned) > 1:
            issues.append(ManifestIssue(0, f"Learner speaker leakage: {speaker} appears in {', '.join(sorted(assigned))}."))
    speakers_by_split = {split: 0 for split in sorted(VALID_SPLITS)}
    for splits in speaker_splits.values():
        if len(splits) == 1:
            speakers_by_split[next(iter(splits))] += 1
    return ManifestReport(len(rows), len(speaker_splits), rows_by_split, speakers_by_split, tuple(issues))


def assign_learner_speaker_splits(rows: list[dict[str, Any]], *, seed: str) -> list[dict[str, Any]]:
    speakers = sorted({str(row["learnerSpeakerId"]) for row in rows if _string(row.get("learnerSpeakerId"))})
    if len(speakers) < 3:
        raise ProsodyManifestError("At least three learner speakers are required for train/validation/test splits.")
    ordered = sorted(speakers, key=lambda speaker: hashlib.sha256(f"{seed}:{speaker}".encode("utf-8")).hexdigest())
    validation_count, test_count = max(1, round(len(ordered) * 0.15)), max(1, round(len(ordered) * 0.15))
    train_count = len(ordered) - validation_count - test_count
    if train_count < 1:
        raise ProsodyManifestError("Not enough learner speakers after reserving validation and test splits.")
    assignments = {
        **{speaker: "train" for speaker in ordered[:train_count]},
        **{speaker: "validation" for speaker in ordered[train_count : train_count + validation_count]},
        **{speaker: "test" for speaker in ordered[train_count + validation_count :]},
    }
    return [{**copy.deepcopy(row), "split": assignments[str(row["learnerSpeakerId"])]} for row in rows]
