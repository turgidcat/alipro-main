param(
    [string]$ConfigPath = ".\tools\guaihub-export-config.json"
)

$ErrorActionPreference = "Stop"

$scriptDir = $PSScriptRoot
$projectRoot = Split-Path -Parent $scriptDir

if (-not (Test-Path -LiteralPath $ConfigPath)) {
    throw "Missing config file: $ConfigPath. Create it from tools/guaihub-export-config.sample.json first."
}

$config = Get-Content -LiteralPath $ConfigPath -Raw | ConvertFrom-Json

if ([string]::IsNullOrWhiteSpace([string]$config.token) -or [string]::IsNullOrWhiteSpace([string]$config.uid)) {
    throw "Config file is missing token or uid."
}

$now = Get-Date
$rangeMode = if ($config.rangeMode) { [string]$config.rangeMode } else { "today" }

switch ($rangeMode.ToLowerInvariant()) {
    "rolling" {
        $lookbackHours = if ($null -ne $config.lookbackHours) { [int]$config.lookbackHours } else { 24 }
        if ($lookbackHours -le 0) {
            throw "lookbackHours must be greater than 0."
        }
        $startTime = $now.AddHours(-$lookbackHours)
        $endTime = $now
    }
    default {
        $startTime = Get-Date -Year $now.Year -Month $now.Month -Day $now.Day -Hour 0 -Minute 0 -Second 0
        $endTime = $now
    }
}

$rawOutputDir = if ($config.outputDir) { [string]$config.outputDir } else { ".\guaihub-export-test" }
$outputDir = if ([System.IO.Path]::IsPathRooted($rawOutputDir)) {
    $rawOutputDir
} else {
    Join-Path $projectRoot $rawOutputDir
}

$scriptPath = Join-Path $scriptDir "export-guaihub-data.ps1"

& $scriptPath `
    -Token ([string]$config.token) `
    -Uid ([string]$config.uid) `
    -StartTime ($startTime.ToString("o")) `
    -EndTime ($endTime.ToString("o")) `
    -OutputDir $outputDir
