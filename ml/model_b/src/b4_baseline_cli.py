"""Command line interface for B4 calibration training and local prediction."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from .b4_baseline import ProsodyTrainingError, _read_b2_evidence, feature_row_from_b2_mora, load_baseline, predict_mora, train_baseline


def main() -> None:
    parser = argparse.ArgumentParser(description="Train or run the Kotodama Model B B4 prosody baseline.")
    commands = parser.add_subparsers(dest="command", required=True)
    train = commands.add_parser("train", help="Train B4 from split B3 JSONL and private B2 evidence.")
    train.add_argument("--manifest", type=Path, required=True)
    train.add_argument("--data-root", type=Path, required=True, help="Directory containing paths in b2EvidencePath.")
    train.add_argument("--output-dir", type=Path, required=True, help="New artifact directory; must not yet exist.")
    train.add_argument("--minimum-confidence", type=int, default=3)
    train.add_argument("--seed", type=int, default=2026)
    predict = commands.add_parser("predict", help="Score one B2 mora with a locally trained B4 artifact.")
    predict.add_argument("--model-dir", type=Path, required=True)
    predict.add_argument("--b2-evidence", type=Path, required=True)
    predict.add_argument("--mora-index", type=int, required=True)
    predict.add_argument("--output", type=Path, help="Optional new JSON output path; refuses to overwrite.")
    args = parser.parse_args()
    try:
        if args.command == "train":
            result = train_baseline(args.manifest, data_root=args.data_root, output_dir=args.output_dir, minimum_confidence=args.minimum_confidence, random_state=args.seed)
        else:
            result = predict_mora(load_baseline(args.model_dir), feature_row_from_b2_mora(_read_b2_evidence(args.b2_evidence), mora_index=args.mora_index))
    except ProsodyTrainingError as error:
        raise SystemExit(str(error)) from error
    encoded = json.dumps(result, ensure_ascii=False, indent=2) + "\n"
    if getattr(args, "output", None):
        if args.output.exists():
            raise SystemExit(f"Refusing to overwrite existing output: {args.output}")
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(encoded, encoding="utf-8")
    else:
        print(encoded)


if __name__ == "__main__":
    main()
