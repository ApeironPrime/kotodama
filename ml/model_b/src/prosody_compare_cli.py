"""CLI for B2 comparison of a native reference and a learner attempt."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from .prosody_compare import compare_aligned_audio
from .prosody_pipeline import _read_model_a_alignment


def main() -> None:
    parser = argparse.ArgumentParser(description="Compare Model B prosody evidence for the same Japanese sentence.")
    parser.add_argument("--reference-audio", type=Path, required=True, help="Native reference 16 kHz mono WAV.")
    parser.add_argument("--reference-alignment", type=Path, required=True, help="Model A A2 JSON for reference audio.")
    parser.add_argument("--learner-audio", type=Path, required=True, help="Learner 16 kHz mono WAV.")
    parser.add_argument("--learner-alignment", type=Path, required=True, help="Model A A2 JSON for learner audio using the same expected text.")
    parser.add_argument("--output", type=Path, help="Optional new JSON output path; refuses to overwrite.")
    args = parser.parse_args()
    comparison = compare_aligned_audio(
        args.reference_audio,
        _read_model_a_alignment(args.reference_alignment),
        args.learner_audio,
        _read_model_a_alignment(args.learner_alignment),
    )
    encoded = json.dumps(comparison.to_dict(), ensure_ascii=False, indent=2)
    if args.output:
        if args.output.exists():
            raise SystemExit(f"Refusing to overwrite existing output: {args.output}")
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(encoded + "\n", encoding="utf-8")
    else:
        print(encoded)


if __name__ == "__main__":
    main()
