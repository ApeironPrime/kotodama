$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot

function Test-ListeningPort([int] $Port) {
  return $null -ne (Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue)
}

function Start-KotodamaWindow([string] $Title, [string] $NpmCommand) {
  $command = "cd /d `"$projectRoot`" && npm.cmd $NpmCommand"
  Start-Process -FilePath 'cmd.exe' -ArgumentList @('/d', '/k', $command) -WorkingDirectory $projectRoot
  Write-Host "Da bat $Title." -ForegroundColor Green
}

function Wait-ForHttp([string] $Url, [int] $TimeoutSeconds = 45) {
  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    try {
      $response = Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec 2
      if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 400) { return $true }
    } catch {
      # The process may be listening while Vite is still compiling its first page.
    }
    Start-Sleep -Milliseconds 400
  }
  return $false
}

if (-not (Test-ListeningPort 8787)) {
  Start-KotodamaWindow -Title 'Kotodama API' -NpmCommand 'run api'
} else {
  Write-Host 'Kotodama API dang chay (port 8787).' -ForegroundColor DarkYellow
}

if (-not (Test-ListeningPort 5173)) {
  Start-KotodamaWindow -Title 'Kotodama Web' -NpmCommand 'run dev -- --host 127.0.0.1'
} else {
  Write-Host 'Kotodama Web dang chay (port 5173).' -ForegroundColor DarkYellow
}

if ((Wait-ForHttp 'http://127.0.0.1:8787/health') -and (Wait-ForHttp 'http://127.0.0.1:5173/')) {
  Start-Process 'http://127.0.0.1:5173/'
  Write-Host 'Da mo Kotodama tren trinh duyet.' -ForegroundColor Cyan
} else {
  Write-Host 'Mot trong hai tien trinh chua khoi dong. Hay xem hai cua so Kotodama API va Kotodama Web.' -ForegroundColor Red
  exit 1
}
