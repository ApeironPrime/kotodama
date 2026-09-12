"""CLI and JSON contract for Model B B0–B1 feature extraction."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any, Mapping

from .mora import phonemes_to_moras
from .prosody import PitchConfig, extract_mora_prosody


def _read_model_a_alignment(path: Path) -> list[Mapping[str, object]]:
    try:
        payload: Any = json.loads(path.read_text(encoding="utf-8"))
    except OSError as error:
        raise ValueError(f"Could not read Model A alignment JSON: {path}") from error
    except json.JSONDecodeError as error:
        raise ValueError(f"Model A alignment is not valid JSON: {path}") from error
    phonemes = payload.get("alignment", {}).get("phonemes") if isinstance(payload, dict) else None
    if not isinstance(phonemes, list):
        raise ValueError("Expected Model A A2 JSON containing alignment.phonemes.")
    return phonemes


def extract_b1_payload(audio_path: Path, alignment_phonemes: list[Mapping[str, object]]) -> dict[str, Any]:
    morae = phonemes_to_moras(alignment_phonemes)
    features, track, utterance_median_hz = extract_mora_prosody(audio_path, morae, config=PitchConfig())
    return {
        "stage": "B0-B1-prosody-features",
        "schemaVersion": "kotodama-model-b-b1-v1",
        "pitch": {
            "method": track.method,
            "frameCount": int(len(track.f0_hz)),
            "utteranceMedianHz": round(utterance_median_hz, 5) if utterance_median_hz else None,
            "normalization": "semitones_relative_to_utterance_median",
        },
        "morae": [mora.to_dict() for mora in morae],
        "features": [feature.to_dict() for feature in features],
        "limitations": [
            "This creates observations only, not pitch-accent or pronunciation scores.",
            "raw_ac_fallback is explicitly temporary; production should use a newer filtered-autocorrelation Praat backend.",
            "B2 compares this learner contour with a native reference after timing alignment.",
        ],
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Extract Model B B0–B1 prosody features.")
    parser.add_argument("--audio", type=Path, required=True, help="Prepared 16 kHz mono WAV.")
    parser.add_argument("--alignment", type=Path, required=True, help="Model A A2 alignment JSON.")
    parser.add_argument("--output", type=Path, help="Optional path for JSON; refuses to overwrite.")
    args = parser.parse_args()
    payload = extract_b1_payload(args.audio, _read_model_a_alignment(args.alignment))
    encoded = json.dumps(payload, ensure_ascii=False, indent=2)
    if args.output:
        if args.output.exists():
            raise SystemExit(f"Refusing to overwrite existing output: {args.output}")
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(encoded + "\n", encoding="utf-8")
    else:
        print(encoded)


if __name__ == "__main__":
    main()
