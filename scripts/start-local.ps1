$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$localEnvPath = Join-Path $projectRoot '.env.local'

if (-not (Test-Path -LiteralPath $localEnvPath)) {
  Write-Host 'Thieu .env.local voi DATABASE_URL tro toi PostgreSQL local.' -ForegroundColor Red
  exit 1
}

Write-Host 'Dang kiem tra PostgreSQL local va cap nhat database...' -ForegroundColor Cyan
Push-Location $projectRoot
try {
  & npm.cmd run db:migrate:local
  if ($LASTEXITCODE -ne 0) {
    Write-Host 'PostgreSQL local chua san sang. Web se khong mo cho den khi database ket noi duoc.' -ForegroundColor Red
    exit 1
  }
} finally {
  Pop-Location
}

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
  Start-KotodamaWindow -Title 'Kotodama API' -NpmCommand 'run api:local'
} else {
  $listener = Get-NetTCPConnection -State Listen -LocalPort 8787 -ErrorAction SilentlyContinue | Select-Object -First 1
  $commandLine = (Get-CimInstance Win32_Process -Filter "ProcessId = $($listener.OwningProcess)" -ErrorAction SilentlyContinue).CommandLine
  if ($commandLine -notmatch 'env-file=\.env\.local') {
    Write-Host 'Port 8787 dang duoc su dung boi API khac. Hay dong API cu roi bat lai Kotodama.' -ForegroundColor Red
    exit 1
  }
  Write-Host 'Kotodama API local dang chay (port 8787).' -ForegroundColor DarkYellow
}

if (-not (Test-ListeningPort 5173)) {
  Start-KotodamaWindow -Title 'Kotodama Web' -NpmCommand 'run dev -- --host 127.0.0.1'
} else {
  Write-Host 'Kotodama Web dang chay (port 5173).' -ForegroundColor DarkYellow
}

if ((Wait-ForHttp 'http://127.0.0.1:8787/health') -and
    (Wait-ForHttp 'http://127.0.0.1:5173/') -and
    (Wait-ForHttp 'http://127.0.0.1:5173/src/main.tsx')) {
  Start-Process 'http://127.0.0.1:5173/'
  Write-Host 'Da mo Kotodama tren trinh duyet.' -ForegroundColor Cyan
} else {
  Write-Host 'Mot trong hai tien trinh chua khoi dong. Hay xem hai cua so Kotodama API va Kotodama Web.' -ForegroundColor Red
  exit 1
}
