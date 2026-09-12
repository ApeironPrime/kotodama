"""Create private, label-ready A6 phoneme feature rows from A3 evidence and A5 manifests."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from .data_contract import ManifestError, read_jsonl, validate_rows, write_jsonl
from .inference import run_gop_baseline
from .phoneme_model import JapanesePhonemeRecognizer


FEATURE_SCHEMA_VERSION = "a6-phoneme-feature-v1"


def export_annotated_features(
    manifest_path: Path,
    recordings_root: Path,
    output_path: Path,
) -> int:
    """Run A3 per annotated target phone and write private trainable JSONL rows.

    This function never infers a human label. Rows without a completed teacher
    annotation are skipped, while non-usable recordings are retained in the
    export for audit but excluded by the training loader.
    """
    manifest_rows = read_jsonl(manifest_path)
    report = validate_rows(manifest_rows, require_assigned_split=True, recordings_root=recordings_root)
    if not report.is_valid:
        details = "; ".join(f"line {issue.line}: {issue.message}" for issue in report.issues)
        raise ManifestError("Cannot export features from an invalid manifest: " + details)

    exported: list[dict[str, Any]] = []
    recognizer = JapanesePhonemeRecognizer()
    for row in manifest_rows:
        annotation = row.get("annotation")
        if not isinstance(annotation, dict):
            continue
        labels_by_index = {label["phoneIndex"]: label for label in annotation["phoneLabels"]}
        gop_payload = run_gop_baseline(
            recordings_root / row["audioPath"],
            row["textJa"],
            recognizer=recognizer,
        )
        quality = gop_payload["audioQuality"]
        for evidence in gop_payload["gop"]["phonemes"]:
            phone_index = evidence["positionInSentence"]
            label = labels_by_index.get(phone_index)
            if label is None:
                continue
            exported.append(
                {
                    "schemaVersion": FEATURE_SCHEMA_VERSION,
                    "recordingId": row["recordingId"],
                    "speakerId": row["speakerId"],
                    "sentenceId": row["sentenceId"],
                    "split": row["split"],
                    "device": row["device"],
                    "phoneIndex": phone_index,
                    "label": label["label"],
                    "errorType": label.get("errorType"),
                    "raterConfidence": label["raterConfidence"],
                    "recordingQuality": annotation["recordingQuality"],
                    "expectedPhone": evidence["expectedPhone"],
                    "top1Phone": evidence["top1Phone"],
                    "top2Phone": evidence["top2Phone"],
                    "bestCompetitor": evidence["bestCompetitor"],
                    "previousPhone": evidence["previousPhone"],
                    "nextPhone": evidence["nextPhone"],
                    "gop": evidence["gop"],
                    "expectedProbability": evidence["expectedProbability"],
                    "competitorProbability": evidence["competitorProbability"],
                    "posteriorMargin": evidence["posteriorMargin"],
                    "phonemeEntropy": evidence["phonemeEntropy"],
                    "normalizedPhonemeEntropy": evidence["normalizedPhonemeEntropy"],
                    "durationMs": evidence["durationMs"],
                    "durationRatio": evidence["durationRatio"],
                    "estimatedSnrDb": quality["estimatedSnrDb"],
                    "clippingRatio": quality["clippingRatio"],
                }
            )
    if not exported:
        raise ManifestError("No annotated target phonemes were found; feature export would be empty.")
    write_jsonl(output_path, exported)
    return len(exported)
