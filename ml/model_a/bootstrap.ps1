[CmdletBinding()]
param(
  [string]$PythonPath = 'C:\Users\ACER\AppData\Local\Programs\Python\Python312\python.exe',
  [switch]$RecreateEnvironment,
  [switch]$InstallTorch,
  [string]$TorchIndexUrl = 'https://download.pytorch.org/whl/cu130'
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSCommandPath
$venvPath = Join-Path $projectRoot '.venv'

if (-not (Test-Path -LiteralPath $PythonPath)) {
  throw "Python was not found at: $PythonPath"
}

if ($RecreateEnvironment -and (Test-Path -LiteralPath $venvPath)) {
  # This only ever targets Model A's explicitly declared virtual environment.
  Remove-Item -LiteralPath $venvPath -Recurse -Force
}

$venvPython = Join-Path $venvPath 'Scripts\python.exe'
if ((Test-Path -LiteralPath $venvPath) -and -not (Test-Path -LiteralPath $venvPython)) {
  throw "Model A virtual environment is incomplete. Run bootstrap.ps1 with -RecreateEnvironment."
}

if (-not (Test-Path -LiteralPath $venvPath)) {
  & $PythonPath -m venv $venvPath
}

& $venvPython --version
if ($LASTEXITCODE -ne 0) {
  throw "Model A virtual environment cannot start. Run bootstrap.ps1 with -RecreateEnvironment."
}
& $venvPython -m pip install --upgrade pip

if ($InstallTorch) {
  Write-Host "Installing PyTorch CUDA build from $TorchIndexUrl"
  & $venvPython -m pip install --upgrade --force-reinstall `
    torch==2.11.0 torchvision==0.26.0 torchaudio==2.11.0 `
    --index-url $TorchIndexUrl
}

& $venvPython -m pip install -r (Join-Path $projectRoot 'requirements.txt')

Write-Host ''
Write-Host 'Environment prepared.'
Write-Host "Activate with: $venvPath\Scripts\Activate.ps1"
Write-Host 'Verify CUDA with: python -c "import torch; print(torch.cuda.is_available())"'
