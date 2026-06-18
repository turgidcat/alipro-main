param(
    [Parameter(Mandatory = $true)]
    [int]$TotalTurns,

    [string]$Note = "",

    [string]$Source = "manual",

    [string]$FilePath = ".\backend\data\codex-turn-snapshots.json"
)

$ErrorActionPreference = "Stop"

if (Test-Path -LiteralPath $FilePath) {
    $content = Get-Content -LiteralPath $FilePath -Raw
    $snapshots = if ($content.Trim()) { $content | ConvertFrom-Json } else { @() }
} else {
    $snapshots = @()
}

if ($snapshots -isnot [System.Collections.IEnumerable]) {
    $snapshots = @()
}

$list = @($snapshots)
$list += [PSCustomObject]@{
    recordedAt = (Get-Date).ToString("o")
    totalTurns = $TotalTurns
    source     = $Source
    note       = $Note
}

$list | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $FilePath -Encoding UTF8
Write-Host "已追加轮次快照到 $FilePath"
