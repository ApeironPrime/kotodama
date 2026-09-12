"""CLI entry point for the private A5 -> A6 feature export."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from .data_contract import ManifestError
from .feature_dataset import export_annotated_features


def main() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description="Export private A3 phoneme evidence for A6 classifier training")
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--recordings-root", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    try:
        row_count = export_annotated_features(args.manifest, args.recordings_root, args.output)
    except ManifestError as error:
        raise SystemExit(str(error)) from error
    print(json.dumps({"schemaVersion": "a6-phoneme-feature-v1", "exportedRows": row_count, "output": str(args.output)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
