#!/usr/bin/env bash
# Prepare a disposable CUDA workspace (RunPod, Vast, Lightning or similar).
set -euo pipefail

PROJECT_ROOT="${1:-$PWD}"
PYTHON_BIN="${PYTHON_BIN:-python3}"
TORCH_INDEX_URL="${TORCH_INDEX_URL:-https://download.pytorch.org/whl/cu126}"

cd "$PROJECT_ROOT"

# Kaggle's managed Python intentionally disables ensurepip, so creating a venv
# there fails. Its notebook image already supplies CUDA PyTorch; install the
# remaining project dependencies into the disposable session instead.
if [[ -d /kaggle ]]; then
  echo "Using Kaggle managed Python (no virtual environment)."
else
  "$PYTHON_BIN" -m venv .venv-cloud
  source .venv-cloud/bin/activate
fi
python -m pip install --upgrade pip

if ! python -c 'import torch; raise SystemExit(0 if torch.cuda.is_available() else 1)' 2>/dev/null; then
  python -m pip install --upgrade torch torchvision torchaudio --index-url "$TORCH_INDEX_URL"
fi

python -m pip install -r ml/model_a/requirements.txt -r ml/model_a/requirements-train.txt 'gdown>=5,<6'
python - <<'PY'
import torch
assert torch.cuda.is_available(), "CUDA PyTorch is required; pick a GPU image or set TORCH_INDEX_URL."
print({"torch": torch.__version__, "gpu": torch.cuda.get_device_name(0)})
PY
