# Kotodama Model A — Japanese phoneme baseline

Model A is the local foundation for phoneme-level pronunciation feedback. These
first milestones intentionally do **not** train a new model. They make the
pipeline reproducible before any learner data is collected:

1. Convert a known Japanese sentence to the phoneme set used by the acoustic
   baseline.
2. Convert input audio to 16 kHz mono PCM WAV without aggressive denoising or
   loudness processing.
3. Run a pretrained Japanese phoneme CTC model and expose its frame logits for
   later CTC alignment and GOP scoring.

The baseline model is `prj-beatrice/japanese-hubert-base-phoneme-ctc-v2`.
It is a starting point only; it is not Kotodama's trained pronunciation model.

## Directory map

```text
configs/                 Runtime defaults and the baseline model identifier
data/manifests/          Private JSONL manifests (not committed)
data/recordings/         Private learner WAV recordings (not committed)
data/feature_exports/    Private A3 feature exports for supervised training
data/templates/          Checked-in JSONL templates, never real learner data
data/samples/            Local smoke-test audio (not committed)
data/user_dictionary/    Optional OpenJTalk user dictionaries
src/audio.py             Safe 16 kHz mono WAV preparation and inspection
src/g2p.py               Japanese text -> baseline phoneme vocabulary
src/phoneme_model.py     Lazy CTC model loading and inference
src/ctc_align.py         Self-contained CTC Viterbi forced alignment (A2)
src/gop.py               A3 phoneme evidence: GOP, competitors, entropy, audio quality
src/rule_baseline.py     A4 explainable review rules; thresholds live in configs/
src/data_contract.py     A5 manifest validation and speaker-disjoint data splits
src/collection_cli.py    A5 command-line validator and split generator
src/feature_dataset.py   A6 A3-evidence export joined with teacher labels
src/error_classifier.py  A6 Logistic Regression / Random Forest classifier
src/train_classifier.py  A6 training and metrics artifact CLI
src/acoustic_finetune.py A7 safe native/verified CTC fine-tuning utilities
src/train_acoustic.py    A7 CTC fine-tuning CLI for RTX 4050 settings
src/pronunciation_api.py A7 localhost FastAPI scoring service
src/calibrated_scoring.py A9 local A6-artifact inference used by the API
src/build_jvs_manifest.py Prepare a private JVS A7 native CTC subset
src/inference.py         JSON-ready baseline inference contract
src/smoke_test.py        End-to-end command-line check
tests/                   Unit tests that do not download a model
```

## Setup on this machine

The installed Python executable is:

```powershell
$ModelPython = 'C:\Users\ACER\AppData\Local\Programs\Python\Python312\python.exe'
```

Create the environment and install ordinary dependencies:

```powershell
cd D:\Project\kotodama\ml\model_a
& $ModelPython .\bootstrap.ps1
```

If Python was reinstalled and the existing `.venv` can no longer start, create
a fresh Model A environment explicitly (it only removes `ml/model_a/.venv`):

```powershell
& $ModelPython .\bootstrap.ps1 -RecreateEnvironment -InstallTorch
```

`bootstrap.ps1` deliberately does not choose a CUDA wheel.  It uses
`pyopenjtalk-plus`, which distributes prebuilt Windows wheels, so installing
G2P does not require Visual Studio Build Tools. On this RTX 4050 machine the
NVIDIA driver supports CUDA 13.2, so install the supported CUDA 13.0 build:

```powershell
& $ModelPython .\bootstrap.ps1 -InstallTorch
```

Then verify:

```powershell
.\.venv\Scripts\Activate.ps1
python -c "import torch; print(torch.cuda.is_available(), torch.cuda.get_device_name(0))"
```

Install `ffmpeg` separately only if it is not already available on `PATH`.
The web application's existing media worker also uses it.

## Smoke test

G2P only, with no model download:

```powershell
.\.venv\Scripts\python.exe -m src.smoke_test --text "こんにちは、切手を買いました。" --skip-model
```

Full model test, after the environment is ready:

```powershell
.\.venv\Scripts\python.exe -m src.smoke_test `
  --text "こんにちは、切手を買いました。" `
  --audio .\data\samples\sample.wav
```

Forced alignment test (A2):

```powershell
.\.venv\Scripts\python.exe -m src.smoke_test `
  --text "こんにちは、切手を買いました。" `
  --audio .\data\samples\sample.wav `
  --align
```

GOP evidence test (A3; this does not return a pass/fail pronunciation grade):

```powershell
.\.venv\Scripts\python.exe -m src.smoke_test `
  --text "こんにちは、切手を買いました。" `
  --audio .\data\samples\sample.wav `
  --gop
```

Rule-baseline test (A4; findings are prompts for review, not verdicts):

```powershell
.\.venv\Scripts\python.exe -m src.smoke_test `
  --text "こんにちは、切手を買いました。" `
  --audio .\data\samples\sample.wav `
  --rules
```

The first full run downloads the pretrained checkpoint to the Hugging Face
cache.  It should produce JSON with the reference phonemes, the predicted
phonemes, frame count, and approximate frame duration.

`requirements-train.txt` is needed starting at A6. It contains training,
calibration and API dependencies and must not be installed before the CUDA
PyTorch wheel is confirmed.

## A5 private-data collection

Use the checked-in examples in `data/templates/`, then follow
[A5_DATA_COLLECTION.md](docs/A5_DATA_COLLECTION.md). It includes the short
teacher rubric and commands to validate manifests and assign leakage-free
speaker splits.

## A6 first supervised classifier

After A5 labels are available, export only labelled target phonemes and train
without speaker leakage:

```powershell
# This runs A3 over each annotated recording; output remains private.
.\.venv\Scripts\python.exe -m src.feature_export_cli `
  --manifest .\data\manifests\pilot-split-v1.jsonl `
  --recordings-root .\data\recordings `
  --output .\data\feature_exports\pilot-a6-v1.jsonl

# New artifact directory only; it writes model.joblib, metadata and metrics.
.\.venv\Scripts\python.exe -m src.train_classifier `
  --features .\data\feature_exports\pilot-a6-v1.jsonl `
  --output-directory .\artifacts\a6-logistic-v1 `
  --target-mode three_class `
  --model logistic_regression
```

The first target labels are `correct`, `near_correct`, `incorrect`; `unscorable`
and non-`usable` recordings are excluded from training. Metrics include macro
F1, false-acceptance/rejection rate, confusion matrix and per-phoneme results.

## A7 acoustic adaptation and local scoring API

Read [A7_ACOUSTIC_FINETUNE.md](docs/A7_ACOUSTIC_FINETUNE.md) before fine-tuning.
The CTC manifest is separate from learner-error data: only native audio or an
expert-verified realised phoneme sequence may enter CTC loss. The FastAPI score
service is local-only and remains an A2–A4 baseline until A6 calibration data
is sufficient.

## A8 native data and error-label form

The dataset acquisition plan and licence boundaries for JVS, Common Voice and
Japanese learner corpora are in [A8_NATIVE_DATA_AND_ERROR_LABELS.md](docs/A8_NATIVE_DATA_AND_ERROR_LABELS.md).
It also documents the offline reviewer form used to create auditable
phoneme-target labels for learner recordings.

## A9 calibrated API serving

[A9_CALIBRATED_API.md](docs/A9_CALIBRATED_API.md) explains how the local API
loads a reviewed A6 artifact. Without that artifact, it deliberately remains
in the A4 heuristic demo mode.

## Native corpus licence gate

Read [DATASET_LICENSE_MATRIX.md](docs/DATASET_LICENSE_MATRIX.md) before
downloading or training on any external audio. It separates CC0, research-only
and prohibited/unclear sources. For the approved JVS thesis subset, first run
`tools\acquire_jvs.ps1 -AcceptNonCommercialResearchTerms -InstallGdown`, then
prepare a private speaker-disjoint manifest with `src.build_jvs_manifest`.

## Cloud GPU train

The provider-neutral scripts for Kaggle, Lightning, RunPod or Vast are in
[cloud/README.md](cloud/README.md). They keep JVS private, download it only
from the official source after an explicit research-terms acknowledgement, and
use `configs/acoustic_finetune_cloud_24gb.json` for a 24 GB GPU.

## Important limits of A0–A5

- A CTC prediction is not yet a pronunciation score.
- A2 aligns the supplied reference text even when the learner says something
  different. Its timings are useful for karaoke sync and segmenting, but are
  not pronunciation feedback yet.
- A3 calculates phoneme-level GOP and uncertainty features, but no universal
  pass/fail threshold is valid before calibration against labelled recordings
  from Vietnamese learners.
- A4 only produces explainable review hints. Its thresholds are in
  `configs/rule_baseline.json` and must be calibrated before learner-facing
  correctness claims are enabled.
- Do not train incorrect learner audio using the intended correct phonemes as
  CTC labels.  That would teach the recognizer to hide the very errors that
  Kotodama needs to diagnose.
- The optional user dictionary is needed for names, loanwords and domain terms
  whose readings are not handled correctly by default G2P.

## Manifest contract for later collection

Each learner recording will eventually become one private JSONL row:

```json
{
  "audioPath": "speaker_001/sentence_003.wav",
  "speakerId": "speaker_001",
  "sentenceId": "sentence_003",
  "textJa": "切手を買いました。",
  "phonemesRef": "k i cl t e o k a i m a sh i t a",
  "targetPhones": ["cl"],
  "targetError": "sokuon",
  "split": "train"
}
```

Human labels are added later by the annotation workflow, not guessed during
A0–A4.
