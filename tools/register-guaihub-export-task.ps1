param(
    [string]$TaskName = "Alipro-GuaiHub-Export",
    [int]$IntervalMinutes = 5,
    [string]$ConfigPath = "C:\Users\turgidcat\Desktop\alipro-main\tools\guaihub-export-config.json"
)

$ErrorActionPreference = "Stop"

if ($IntervalMinutes -lt 5) {
    throw "IntervalMinutes must be at least 5."
}

$runnerPath = Join-Path $PSScriptRoot "export-guaihub-latest.ps1"
$launcherPath = Join-Path $PSScriptRoot "run-guaihub-export-hidden.vbs"

if (-not (Test-Path -LiteralPath $runnerPath)) {
    throw "Missing script: $runnerPath"
}

$launcherContent = @"
Dim shell
Dim command

Set shell = CreateObject("WScript.Shell")
command = "powershell.exe -NoProfile -ExecutionPolicy Bypass -File ""$runnerPath"" -ConfigPath ""$ConfigPath"""

shell.Run command, 0, False
"@

Set-Content -LiteralPath $launcherPath -Value $launcherContent -Encoding ASCII

$taskCommand = "wscript.exe `"$launcherPath`""
$arguments = @(
    "/Create",
    "/F",
    "/SC", "MINUTE",
    "/MO", $IntervalMinutes,
    "/TN", $TaskName,
    "/TR", $taskCommand
)

& schtasks.exe @arguments | Out-Null
& schtasks.exe /Run /TN $TaskName | Out-Null

Write-Host "Scheduled task created: $TaskName"
