param(
    [Parameter(Mandatory = $true)]
    [string]$Token,

    [Parameter(Mandatory = $true)]
    [string]$Uid,

    [Parameter(Mandatory = $true)]
    [string]$StartTime,

    [Parameter(Mandatory = $true)]
    [string]$EndTime,

    [string]$OutputDir = ".\guaihub-export"
)

$ErrorActionPreference = "Stop"

function Convert-ToUnixTimestamp {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Value
    )

    $dt = [DateTimeOffset]::Parse($Value)
    return [int][Math]::Floor($dt.ToUnixTimeSeconds())
}

function Invoke-GuaihubGet {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Url,

        [Parameter(Mandatory = $true)]
        [hashtable]$Headers
    )

    return Invoke-RestMethod -Uri $Url -Headers $Headers -Method GET -TimeoutSec 30
}

function Get-AllLogItems {
    param(
        [Parameter(Mandatory = $true)]
        [int]$StartTimestamp,

        [Parameter(Mandatory = $true)]
        [int]$EndTimestamp,

        [Parameter(Mandatory = $true)]
        [hashtable]$Headers
    )

    $page = 1
    $pageSize = 100
    $items = @()

    while ($true) {
        $url = "https://guaihub.com/api/log/self?start_timestamp=$StartTimestamp&end_timestamp=$EndTimestamp&p=$page&size=$pageSize"
        $response = Invoke-GuaihubGet -Url $url -Headers $Headers

        if (-not $response.success) {
            throw "读取 log/self 失败: $($response.message)"
        }

        $batch = @($response.data.items)
        if ($batch.Count -eq 0) {
            break
        }

        $items += $batch

        if ($items.Count -ge [int]$response.data.total) {
            break
        }

        $page += 1
    }

    return $items
}

function Expand-LogItems {
    param(
        [Parameter(Mandatory = $true)]
        [object[]]$Items
    )

    foreach ($item in $Items) {
        $other = $null
        if ($item.other) {
            try {
                $other = $item.other | ConvertFrom-Json
            } catch {
                $other = $null
            }
        }

        [PSCustomObject]@{
            created_at_iso       = [DateTimeOffset]::FromUnixTimeSeconds([int64]$item.created_at).ToString("yyyy-MM-dd HH:mm:ss zzz")
            model_name           = $item.model_name
            token_name           = $item.token_name
            group                = $item.group
            quota                = $item.quota
            prompt_tokens        = $item.prompt_tokens
            completion_tokens    = $item.completion_tokens
            use_time_seconds     = $item.use_time
            is_stream            = $item.is_stream
            request_id           = $item.request_id
            request_path         = $other.request_path
            billing_source       = $other.billing_source
            cache_tokens         = $other.cache_tokens
            cache_ratio          = $other.cache_ratio
            completion_ratio     = $other.completion_ratio
            group_ratio          = $other.group_ratio
            model_ratio          = $other.model_ratio
            reasoning_effort     = $other.reasoning_effort
            first_response_ms    = $other.frt
        }
    }
}

$startTimestamp = Convert-ToUnixTimestamp -Value $StartTime
$endTimestamp = Convert-ToUnixTimestamp -Value $EndTime

$headers = @{
    Authorization  = "Bearer $Token"
    "New-Api-User" = $Uid
    Accept         = "application/json, text/plain, */*"
    "Cache-Control" = "no-store"
}

if (-not (Test-Path -LiteralPath $OutputDir)) {
    New-Item -ItemType Directory -Path $OutputDir | Out-Null
}

$logItems = Get-AllLogItems -StartTimestamp $startTimestamp -EndTimestamp $endTimestamp -Headers $headers
$expandedLogItems = Expand-LogItems -Items $logItems

$dataUrl = "https://guaihub.com/api/data/self?start_timestamp=$startTimestamp&end_timestamp=$endTimestamp"
$dataResponse = Invoke-GuaihubGet -Url $dataUrl -Headers $headers

if (-not $dataResponse.success) {
    throw "读取 data/self 失败: $($dataResponse.message)"
}

$rangeSlug = "{0}_{1}" -f $startTimestamp, $endTimestamp
$logJsonPath = Join-Path $OutputDir "log-self-$rangeSlug.json"
$logCsvPath = Join-Path $OutputDir "log-self-$rangeSlug.csv"
$dataJsonPath = Join-Path $OutputDir "data-self-$rangeSlug.json"
$dataCsvPath = Join-Path $OutputDir "data-self-$rangeSlug.csv"

$logItems | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $logJsonPath -Encoding UTF8
$expandedLogItems | Export-Csv -LiteralPath $logCsvPath -NoTypeInformation -Encoding UTF8
$dataResponse.data | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $dataJsonPath -Encoding UTF8
$dataResponse.data | Select-Object `
    @{ Name = "created_at_iso"; Expression = { [DateTimeOffset]::FromUnixTimeSeconds([int64]$_.created_at).ToString("yyyy-MM-dd HH:mm:ss zzz") } }, `
    model_name, `
    count, `
    token_used, `
    quota | Export-Csv -LiteralPath $dataCsvPath -NoTypeInformation -Encoding UTF8

Write-Host "导出完成:"
Write-Host "  $logJsonPath"
Write-Host "  $logCsvPath"
Write-Host "  $dataJsonPath"
Write-Host "  $dataCsvPath"
