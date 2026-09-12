# Kotodama Model B — Prosody baseline

Model B measures the prosody of a Japanese utterance.  It is deliberately
separate from Model A:

- Model A answers: *were the expected phonemes acoustically supported?*
- Model B answers: *does pitch, rhythm, and phrasing resemble the native
  reference?*

## B0–B2 delivered here

1. `src/mora.py` converts Model A A2 phoneme-alignment JSON into monotonic
   mora time spans.  `cl` (っ) and `N` (ん) remain their own mora; `sil` and
   `pau` are emitted as non-scored pause spans.
2. `src/prosody.py` extracts an F0 track with Praat/Parselmouth when it is
   available, normalizes voiced F0 to semitones relative to the utterance
   median, and creates safe per-mora feature records.
3. `src/prosody_pipeline.py` joins the two stages and returns a JSON-friendly
   B1 payload.  It produces features only — it does **not** yet score a
   learner or claim pitch-accent correctness.
4. `src/prosody_compare.py` uses a native reference and learner attempt with
   the same Model A mora topology. It performs per-mora F0 DTW and reports
   pitch/rhythm/pause evidence; B2 still does **not** return a score.

## Setup

Use a separate environment from Model A.  The bootstrap script creates
`ml/model_b/.venv` and installs the runtime dependencies.

```powershell
cd D:\Project\kotodama\ml\model_b
.\bootstrap.ps1
```

For a quick local demonstration (Model A must have generated the alignment
JSON first):

```powershell
.\.venv\Scripts\python.exe -m src.prosody_pipeline `
  --audio D:\path\to\sentence_16k.wav `
  --alignment D:\path\to\model_a_alignment.json
```

## Pitch-method note

Parselmouth 0.4.x bundles an older Praat and exposes raw autocorrelation as
`Sound.to_pitch_ac`.  The implementation records this as `raw_ac_fallback`;
it does not silently call it “filtered AC”.  The production B1 configuration
is intentionally ready for a newer external Praat filtered-autocorrelation
adapter, which will replace the fallback before training or product scoring.

No Model B output is a pronunciation grade until B2–B4 provide native
reference comparisons, learner labels, calibration, and evaluation.

## B2 comparison

Read [B2_REFERENCE_COMPARISON.md](docs/B2_REFERENCE_COMPARISON.md). It explains
the required pair of Model A alignment JSON files and the `prosody_compare_cli`
command. B2 rejects different mora topology instead of quietly comparing two
unrelated sentences.

## B3 human labels

The B3 private JSONL contract, split CLI, offline listening form and pilot
rubric are documented in [B3_HUMAN_LABELS.md](docs/B3_HUMAN_LABELS.md). It
collects human pitch/rhythm/intonation labels for selected morae; it does not
ask raters to transcribe F0 or IPA.

## B4 calibrated baseline

[B4_TRAINING.md](docs/B4_TRAINING.md) documents the three small models and
their train/predict CLI. B4 turns B2 evidence plus B3 human labels into an
auditable pilot calibration; it is not a deployment-grade universal score.

## B5 shadowing API

[B5_SHADOWING_API.md](docs/B5_SHADOWING_API.md) documents the local endpoint
that combines trusted Model A and B2 worker JSON with a locally trained B4
artifact into timestamped mora feedback.
