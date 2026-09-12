"""Command-line smoke test for A0–A1."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from .g2p import japanese_to_phonemes
from .inference import run_baseline, run_forced_alignment, run_gop_baseline, run_rule_baseline


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Kotodama Model A A0-A4 smoke test")
    parser.add_argument("--text", required=True, help="Known Japanese reference sentence")
    parser.add_argument("--audio", type=Path, help="Prepared 16 kHz mono WAV sentence")
    parser.add_argument("--user-dictionary", type=Path, help="Optional compiled OpenJTalk .dic file")
    parser.add_argument("--skip-model", action="store_true", help="Only verify Japanese G2P")
    parser.add_argument("--align", action="store_true", help="Force-align reference phonemes to CTC frames (A2)")
    parser.add_argument("--gop", action="store_true", help="Compute A3 GOP evidence after forced alignment")
    parser.add_argument("--rules", action="store_true", help="Apply explainable A4 review rules")
    return parser.parse_args()


def main() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    args = parse_args()
    if args.skip_model:
        if args.align or args.gop or args.rules:
            raise SystemExit("--align/--gop/--rules require the acoustic model; remove --skip-model and provide --audio.")
        reference = japanese_to_phonemes(args.text, user_dictionary=args.user_dictionary)
        payload = {
            "stage": "A1-g2p",
            "text": reference.text,
            "phonemes": list(reference.phonemes),
            "engine": reference.engine,
        }
    else:
        if args.audio is None:
            raise SystemExit("--audio is required unless --skip-model is used.")
        runner = run_rule_baseline if args.rules else run_gop_baseline if args.gop else run_forced_alignment if args.align else run_baseline
        payload = runner(args.audio, args.text, user_dictionary=args.user_dictionary)
    print(json.dumps(payload, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
