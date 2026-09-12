"""CLI for safe A7 CTC fine-tuning."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from .acoustic_finetune import AcousticFineTuneError, load_acoustic_config, read_native_manifest, train_native_ctc


def main() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description="Fine-tune Kotodama Model A CTC on native/verified audio only")
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--recordings-root", type=Path, required=True)
    parser.add_argument("--output-directory", type=Path, required=True)
    parser.add_argument("--config", type=Path, help="Optional hardware-specific acoustic fine-tune JSON config.")
    args = parser.parse_args()
    try:
        result = train_native_ctc(
            read_native_manifest(args.manifest),
            args.recordings_root,
            args.output_directory,
            config=load_acoustic_config(args.config) if args.config else None,
        )
    except AcousticFineTuneError as error:
        raise SystemExit(str(error)) from error
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
