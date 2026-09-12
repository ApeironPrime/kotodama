#!/usr/bin/env bash
# Run only inside a private cloud workspace after reviewing JVS terms.
set -euo pipefail

PROJECT_ROOT="${1:-$PWD}"
DATA_ROOT="${KOTODAMA_DATA_ROOT:-$PROJECT_ROOT/private-data/jvs}"
MANIFEST="${KOTODAMA_MANIFEST_PATH:-$DATA_ROOT/../manifests/jvs-a7-cloud-v1.jsonl}"
RECORDINGS="${KOTODAMA_RECORDINGS_ROOT:-$DATA_ROOT/../recordings/jvs-a7-cloud-v1}"
ARTIFACT="${KOTODAMA_ARTIFACT_PATH:-$PROJECT_ROOT/ml/model_a/artifacts/a7-jvs-ctc-cloud-v1}"
CONFIG="$PROJECT_ROOT/ml/model_a/configs/acoustic_finetune_cloud_24gb.json"

cd "$PROJECT_ROOT"
if [[ -f .venv-cloud/bin/activate ]]; then
  source .venv-cloud/bin/activate
elif [[ -d /kaggle ]]; then
  echo "Using Kaggle managed Python."
else
  echo "Missing .venv-cloud. Run bootstrap_gpu.sh first." >&2
  exit 2
fi
export PYTHONPATH="$PROJECT_ROOT/ml/model_a"

if [[ "${KOTODAMA_ACCEPT_JVS_RESEARCH_TERMS:-}" != "yes" ]]; then
  echo "Set KOTODAMA_ACCEPT_JVS_RESEARCH_TERMS=yes only after reading Model A's dataset licence matrix." >&2
  exit 2
fi

if [[ ! -d "$DATA_ROOT/jvs_ver1" ]]; then
  python ml/model_a/tools/acquire_jvs.py --destination "$DATA_ROOT" --accept-noncommercial-research-terms
fi

if [[ ! -f "$MANIFEST" ]]; then
  python -m src.build_jvs_manifest \
    --source-root "$DATA_ROOT/jvs_ver1" \
    --recordings-root "$RECORDINGS" \
    --output-manifest "$MANIFEST" \
    --max-speakers 60
fi

python -m src.train_acoustic \
  --manifest "$MANIFEST" \
  --recordings-root "$RECORDINGS" \
  --output-directory "$ARTIFACT" \
  --config "$CONFIG"
