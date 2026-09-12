"""CLI for B3 validation and leakage-free learner-speaker splitting."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from .label_contract import assign_learner_speaker_splits, read_jsonl, validate_rows, write_jsonl


def _print_report(report) -> None:
    print(json.dumps({
        "valid": report.is_valid,
        "rows": report.row_count,
        "learnerSpeakers": report.learner_speaker_count,
        "rowsBySplit": report.rows_by_split,
        "learnerSpeakersBySplit": report.learner_speakers_by_split,
        "issues": [{"line": issue.line, "message": issue.message} for issue in report.issues],
    }, ensure_ascii=False, indent=2))


def main() -> None:
    parser = argparse.ArgumentParser(description="Validate or split Model B B3 prosody labels.")
    subparsers = parser.add_subparsers(dest="command", required=True)
    validate = subparsers.add_parser("validate")
    validate.add_argument("--manifest", type=Path, required=True)
    validate.add_argument("--require-assigned-split", action="store_true")
    split = subparsers.add_parser("assign-splits")
    split.add_argument("--input", type=Path, required=True)
    split.add_argument("--output", type=Path, required=True)
    split.add_argument("--seed", required=True)
    args = parser.parse_args()
    rows = read_jsonl(args.manifest if args.command == "validate" else args.input)
    if args.command == "validate":
        report = validate_rows(rows, require_assigned_split=args.require_assigned_split)
        _print_report(report)
        raise SystemExit(0 if report.is_valid else 1)
    assigned = assign_learner_speaker_splits(rows, seed=args.seed)
    report = validate_rows(assigned, require_assigned_split=True)
    if not report.is_valid:
        _print_report(report)
        raise SystemExit(1)
    write_jsonl(args.output, assigned)
    _print_report(report)


if __name__ == "__main__":
    main()
