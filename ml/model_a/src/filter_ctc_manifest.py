"""Write a new native CTC manifest without mathematically unalignable targets."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from .acoustic_finetune import AcousticFineTuneError, find_ctc_unalignable_rows, read_native_manifest


def filter_manifest(manifest: Path, recordings_root: Path, output_manifest: Path) -> dict[str, int]:
    if output_manifest.exists():
        raise AcousticFineTuneError(f"Refusing to overwrite existing manifest: {output_manifest}")
    rows = read_native_manifest(manifest)
    failures = find_ctc_unalignable_rows(rows, recordings_root)
    rejected = {str(item["recordingId"]) for item in failures}
    kept = [{key: value for key, value in row.items() if key != "_line"} for row in rows if row["recordingId"] not in rejected]
    if not kept:
        raise AcousticFineTuneError("All rows were rejected by CTC frame feasibility validation.")
    if not any(row["split"] == "train" for row in kept) or not any(row["split"] == "validation" for row in kept):
        raise AcousticFineTuneError("Filtering removed an entire train or validation split.")
    output_manifest.parent.mkdir(parents=True, exist_ok=True)
    output_manifest.write_text("\n".join(json.dumps(row, ensure_ascii=False) for row in kept) + "\n", encoding="utf-8")
    return {"inputRows": len(rows), "keptRows": len(kept), "rejectedRows": len(rejected)}


def main() -> None:
    parser = argparse.ArgumentParser(description="Filter infeasible native CTC rows into a new manifest.")
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--recordings-root", type=Path, required=True)
    parser.add_argument("--output-manifest", type=Path, required=True)
    args = parser.parse_args()
    try:
        print(json.dumps(filter_manifest(args.manifest, args.recordings_root, args.output_manifest), ensure_ascii=False))
    except AcousticFineTuneError as error:
        raise SystemExit(str(error)) from error


if __name__ == "__main__":
    main()
