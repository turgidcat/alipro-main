$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$backendDir = Join-Path $projectRoot 'backend'
$frontendDir = Join-Path $projectRoot 'frontend-react'

function Stop-PortProcess {
  param(
    [Parameter(Mandatory = $true)]
    [int]$Port
  )

  $connections = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
  if (-not $connections) {
    Write-Host ("Port {0} is not in use." -f $Port)
    return
  }

  $pids = $connections | Select-Object -ExpandProperty OwningProcess -Unique
  foreach ($procId in $pids) {
    if ($procId -and $procId -ne 0) {
      try {
        Stop-Process -Id $procId -Force -ErrorAction Stop
        Write-Host ("Stopped process on port {0}: PID={1}" -f $Port, $procId)
      } catch {
        Write-Warning ("Failed to stop PID={0}: {1}" -f $procId, $_.Exception.Message)
      }
    }
  }
}

Write-Host ""
Write-Host "=== Restart Alipro Dev Environment ==="
Write-Host ""

Stop-PortProcess -Port 3000
Stop-PortProcess -Port 5173

Write-Host ""
Write-Host "Starting backend..."
Start-Process cmd.exe -WorkingDirectory $backendDir -ArgumentList @(
  '/k',
  'npm run dev'
)

Start-Sleep -Seconds 2

Write-Host "Starting frontend..."
Start-Process cmd.exe -WorkingDirectory $frontendDir -ArgumentList @(
  '/k',
  'npm run dev -- --host 127.0.0.1'
)

Write-Host ""
Write-Host "Startup commands sent."
Write-Host "Backend:  http://127.0.0.1:3000/health"
Write-Host "Frontend: http://127.0.0.1:5173/"
Write-Host ""
