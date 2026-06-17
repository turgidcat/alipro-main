# restart-backend.ps1
# 可靠地停止并重启网文生成器后端服务
# 使用方式：powershell -ExecutionPolicy Bypass -File scripts/restart-backend.ps1

$projectRoot = Split-Path -Parent $PSScriptRoot
$backendDir = Join-Path $projectRoot "backend"
$port = 3000
$healthUrl = "http://localhost:${port}/health"

Write-Host "========================================"
Write-Host "  重启后端服务"
Write-Host "========================================"

# ===== 步骤 1：停止旧进程 =====
Write-Host "[1/3] 停止旧进程..."
$pids = @()
(netstat -ano 2>$null) -split "`n" | ForEach-Object {
    if ($_ -match ":$port\s") {
        $parts = $_.Trim() -split '\s+'
        if ($parts[-1] -match '^\d+$') { $pids += $parts[-1] }
    }
}
$pids = $pids | Select-Object -Unique

if ($pids.Count -gt 0) {
    foreach ($procId in $pids) {
        Write-Host "  Kill PID: $procId"
        taskkill /F /PID $procId 2>$null
    }
    # 等待端口释放
    $waited = 0
    do {
        Start-Sleep -Seconds 1
        $waited++
        $stillListening = $false
        (netstat -ano 2>$null) -split "`n" | ForEach-Object {
            if ($_ -match ":$port\s.*LISTENING") { $stillListening = $true }
        }
    } while ($stillListening -and $waited -lt 15)
    Write-Host "  Done (waited ${waited}s)"
} else {
    Write-Host "  No process on port $port"
}

# ===== 步骤 2：启动后端 =====
Write-Host "[2/3] 启动后端..."
cd $backendDir
$cmdArgs = "/c `"cd /d $backendDir && title Backend-Alipro && node server.js`""
$proc = Start-Process -FilePath "cmd" -ArgumentList $cmdArgs -WindowStyle Minimized -PassThru
Write-Host "  Started (PID: $($proc.Id))"

# ===== 步骤 3：健康检查 =====
Write-Host "[3/3] 等待服务就绪..."
$ok = $false
for ($i = 1; $i -le 10; $i++) {
    Start-Sleep -Seconds 2
    try {
        $r = Invoke-WebRequest -Uri $healthUrl -UseBasicParsing -TimeoutSec 3
        if ($r.StatusCode -eq 200) {
            Write-Host "  Backend OK (attempt $i)"
            $ok = $true
            break
        }
    } catch {
        Write-Host "  ... ($i/10)"
    }
}

if ($ok) {
    Write-Host ""
    Write-Host "Done! http://localhost:${port}"
} else {
    Write-Host "  WARNING: Health check timed out"
    Write-Host "  Check logs: $backendDir\logs\"
}

Write-Host "========================================"
