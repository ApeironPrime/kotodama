param(
    [switch]$RecreateEnvironment
)

$ErrorActionPreference = 'Stop'
$Workspace = Split-Path -Parent $PSScriptRoot
$VenvPath = Join-Path $PSScriptRoot '.venv'

if ($RecreateEnvironment -and (Test-Path -LiteralPath $VenvPath)) {
    Remove-Item -LiteralPath $VenvPath -Recurse -Force
}

if (-not (Test-Path -LiteralPath $VenvPath)) {
    py -3.12 -m venv $VenvPath
}

$Python = Join-Path $VenvPath 'Scripts\python.exe'
& $Python -m pip install --upgrade pip
& $Python -m pip install -r (Join-Path $PSScriptRoot 'requirements.txt')
& $Python -m pytest (Join-Path $PSScriptRoot 'tests') -q

Write-Host "Model B environment is ready: $VenvPath"
