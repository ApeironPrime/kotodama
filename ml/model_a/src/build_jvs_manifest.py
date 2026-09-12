"""Prepare a private, speaker-disjoint JVS subset for safe A7 CTC fine-tuning."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

from .acoustic_finetune import NATIVE_SCHEMA_VERSION, AcousticFineTuneError, validate_native_rows
from .audio import AudioPreparationError, inspect_wav, prepare_audio
from .g2p import G2PError, japanese_to_phonemes


def _transcripts(path: Path) -> dict[str, str]:
    candidates = list(path.rglob("transcripts_utf8.txt"))
    if not candidates:
        raise AcousticFineTuneError("JVS transcripts_utf8.txt was not found.")
    result: dict[str, str] = {}
    for file in candidates:
        for raw in file.read_text(encoding="utf-8").splitlines():
            if ":" not in raw:
                continue
            key, text = raw.split(":", 1)
            if key.strip() and text.strip():
                result[key.strip()] = text.strip()
    if not result:
        raise AcousticFineTuneError("JVS transcripts are empty or unreadable.")
    return result


def _split(speaker_id: str, seed: str) -> str:
    return "validation" if int(hashlib.sha256(f"{seed}:{speaker_id}".encode()).hexdigest(), 16) % 5 == 0 else "train"


def build_jvs_manifest(source_root: Path, recordings_root: Path, output_manifest: Path, *, max_speakers: int, seed: str) -> dict[str, int]:
    if output_manifest.exists():
        raise AcousticFineTuneError(f"Refusing to overwrite existing manifest: {output_manifest}")
    transcripts = _transcripts(source_root)
    speakers = sorted(path for path in source_root.glob("jvs*") if path.is_dir())[:max_speakers]
    if len(speakers) < 3:
        raise AcousticFineTuneError("Need at least three JVS speaker directories for a speaker-disjoint split.")
    speaker_splits = {speaker.name: _split(speaker.name, seed) for speaker in speakers}
    # A very small smoke subset can hash entirely to one side.  Keep the split
    # speaker-disjoint, while guaranteeing that validation is exercised.
    if all(split == "train" for split in speaker_splits.values()):
        speaker_splits[speakers[-1].name] = "validation"
    elif all(split == "validation" for split in speaker_splits.values()):
        speaker_splits[speakers[-1].name] = "train"
    rows: list[dict[str, str]] = []
    skipped_too_long = 0
    phoneme_cache: dict[str, tuple[str, ...]] = {}
    for speaker in speakers:
        wav_directory = speaker / "parallel100" / "wav24kHz16bit"
        for source_wav in sorted(wav_directory.glob("*.wav")):
            # A7 deliberately trains on sentence-sized utterances only.  Filtering
            # before conversion avoids generating unusable output files.
            if inspect_wav(source_wav).duration_seconds > 8.0:
                skipped_too_long += 1
                continue
            text = transcripts.get(source_wav.stem)
            if not text:
                continue
            phones = phoneme_cache.get(text)
            if phones is None:
                try:
                    phones = japanese_to_phonemes(text).phonemes
                except G2PError:
                    continue
                phoneme_cache[text] = phones
            destination = recordings_root / speaker.name / source_wav.name
            destination.parent.mkdir(parents=True, exist_ok=True)
            try:
                prepare_audio(source_wav, destination)
            except AudioPreparationError as error:
                raise AcousticFineTuneError(f"Could not prepare {source_wav}: {error}") from error
            rows.append({
                "schemaVersion": NATIVE_SCHEMA_VERSION, "recordingId": f"jvs_{speaker.name}_{source_wav.stem}",
                "audioPath": str(destination.relative_to(recordings_root)).replace("\\", "/"), "speakerId": speaker.name,
                "split": speaker_splits[speaker.name], "phonemesCtc": " ".join(phones), "labelSource": "native",
            })
    issues = validate_native_rows(rows, recordings_root=recordings_root)
    if issues:
        raise AcousticFineTuneError("Generated JVS manifest is invalid: " + "; ".join(issues[:10]))
    if not any(row["split"] == "train" for row in rows) or not any(row["split"] == "validation" for row in rows):
        raise AcousticFineTuneError("JVS split did not produce both train and validation rows; use another seed.")
    output_manifest.parent.mkdir(parents=True, exist_ok=True)
    output_manifest.write_text("\n".join(json.dumps(row, ensure_ascii=False) for row in rows) + "\n", encoding="utf-8")
    return {
        "speakers": len(speakers),
        "rows": len(rows),
        "train": sum(row["split"] == "train" for row in rows),
        "validation": sum(row["split"] == "validation" for row in rows),
        "skippedTooLong": skipped_too_long,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Prepare a private 16 kHz JVS subset for A7 CTC training.")
    parser.add_argument("--source-root", type=Path, required=True, help="Extracted jvs_ver1 directory.")
    parser.add_argument("--recordings-root", type=Path, required=True)
    parser.add_argument("--output-manifest", type=Path, required=True)
    parser.add_argument("--max-speakers", type=int, default=40)
    parser.add_argument("--seed", default="kotodama-jvs-a7-v1")
    args = parser.parse_args()
    if args.max_speakers < 3:
        raise SystemExit("--max-speakers must be at least 3.")
    try:
        print(json.dumps(build_jvs_manifest(args.source_root, args.recordings_root, args.output_manifest, max_speakers=args.max_speakers, seed=args.seed), ensure_ascii=False))
    except (AcousticFineTuneError, AudioPreparationError) as error:
        raise SystemExit(str(error)) from error


if __name__ == "__main__":
    main()
