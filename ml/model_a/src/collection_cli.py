"""CLI for validating and splitting private A5 recording manifests."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from .data_contract import ManifestError, assign_speaker_splits, read_jsonl, validate_rows, write_jsonl


def _report_payload(report) -> dict:
    return {
        "valid": report.is_valid,
        "rowCount": report.row_count,
        "speakerCount": report.speaker_count,
        "rowsBySplit": report.rows_by_split,
        "speakersBySplit": report.speakers_by_split,
        "issues": [{"line": issue.line, "message": issue.message} for issue in report.issues],
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Kotodama Model A A5 private-data tooling")
    subparsers = parser.add_subparsers(dest="command", required=True)
    validate = subparsers.add_parser("validate", help="Validate JSONL schema, labels and optional WAV files")
    validate.add_argument("--manifest", type=Path, required=True)
    validate.add_argument("--recordings-root", type=Path, help="Optional root used to verify each 16 kHz mono WAV")
    validate.add_argument("--require-assigned-split", action="store_true")
    split = subparsers.add_parser("assign-splits", help="Create a new deterministic speaker-disjoint manifest")
    split.add_argument("--input", type=Path, required=True)
    split.add_argument("--output", type=Path, required=True)
    split.add_argument("--seed", required=True, help="Stable project seed; record it in your experiment log")
    return parser.parse_args()


def main() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    args = parse_args()
    try:
        if args.command == "validate":
            report = validate_rows(
                read_jsonl(args.manifest),
                require_assigned_split=args.require_assigned_split,
                recordings_root=args.recordings_root,
            )
            print(json.dumps(_report_payload(report), ensure_ascii=False, indent=2))
            if not report.is_valid:
                raise SystemExit(1)
        else:
            source_rows = read_jsonl(args.input)
            source_report = validate_rows(source_rows)
            if not source_report.is_valid:
                print(json.dumps(_report_payload(source_report), ensure_ascii=False, indent=2))
                raise SystemExit("Input manifest is invalid; correct it before assigning splits.")
            assigned = assign_speaker_splits(source_rows, seed=args.seed)
            report = validate_rows(assigned, require_assigned_split=True)
            if not report.is_valid:
                raise SystemExit("Internal split validation failed: " + "; ".join(issue.message for issue in report.issues))
            write_jsonl(args.output, assigned)
            print(json.dumps(_report_payload(report), ensure_ascii=False, indent=2))
    except ManifestError as error:
        raise SystemExit(str(error)) from error


if __name__ == "__main__":
    main()
