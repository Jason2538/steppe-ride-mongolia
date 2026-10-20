$ErrorActionPreference = 'Stop'
$port = if ($env:PORT) { $env:PORT } else { '5173' }
Write-Host "Starting STEPPE v1.3 local server on port $port..." -ForegroundColor Cyan
$server = Start-Process -FilePath "node" -ArgumentList "server.mjs" -WorkingDirectory $PSScriptRoot -PassThru -WindowStyle Hidden
try {
  Start-Sleep -Seconds 1
  Write-Host "Opening external HTTPS tunnel via Cloudflare..." -ForegroundColor Green
  & 'C:\Program Files (x86)\cloudflared\cloudflared.exe' tunnel --url "http://127.0.0.1:$port" --no-autoupdate
} finally {
  if ($server -and !$server.HasExited) {
    Stop-Process -Id $server.Id -Force
  }
}
