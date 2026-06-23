$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$RepoRoot = Split-Path -Parent $PSScriptRoot
$ReportPath = Join-Path $RepoRoot 'MVP救援检查报告.md'

function Write-Section {
    param([string]$Title)
    Write-Host ''
    Write-Host ('=== ' + $Title + ' ===') -ForegroundColor Cyan
}

function Invoke-CommandCapture {
    param(
        [Parameter(Mandatory = $true)][string]$FilePath,
        [string[]]$ArgumentList = @(),
        [string]$WorkingDirectory = $RepoRoot,
        [switch]$AllowFailure
    )

    $tempFile = [System.IO.Path]::GetTempFileName()
    try {
        Push-Location $WorkingDirectory
        $previousErrorActionPreference = $ErrorActionPreference
        $ErrorActionPreference = 'Continue'
        & $FilePath @ArgumentList *>&1 | Out-File -FilePath $tempFile -Encoding utf8
        $ErrorActionPreference = $previousErrorActionPreference
        $exitCode = $LASTEXITCODE
        $output = Get-Content -Raw -Encoding utf8 $tempFile
        if (-not $AllowFailure -and $exitCode -ne 0) {
            throw ('命令执行失败：' + $FilePath + ' ' + ($ArgumentList -join ' ') + "`n" + $output)
        }
        if ($null -eq $output) { $output = '' }
        return [pscustomobject]@{
            ExitCode = $exitCode
            Output = ([string]$output).TrimEnd()
        }
    }
    finally {
        $ErrorActionPreference = 'Stop'
        Pop-Location
        Remove-Item $tempFile -ErrorAction SilentlyContinue
    }
}

function Get-GitStatusEntries {
    $statusResult = Invoke-CommandCapture -FilePath 'git' -ArgumentList @('-c', 'core.quotePath=false', 'status', '--porcelain=v1')
    $entries = @()
    foreach ($line in ($statusResult.Output -split "`r?`n")) {
        if ([string]::IsNullOrWhiteSpace($line)) { continue }
        $code = if ($line.Length -ge 2) { $line.Substring(0, 2) } else { $line }
        $rest = if ($line.Length -gt 3) { $line.Substring(3).Trim() } else { '' }
        $path = $rest
        $oldPath = ''
        if ($rest -like '* -> *') {
            $parts = $rest -split ' -> ', 2
            $oldPath = $parts[0].Trim()
            $path = $parts[1].Trim()
        }
        if ($path.StartsWith('"') -and $path.EndsWith('"')) {
            $path = $path.Substring(1, $path.Length - 2)
        }
        if ($oldPath.StartsWith('"') -and $oldPath.EndsWith('"')) {
            $oldPath = $oldPath.Substring(1, $oldPath.Length - 2)
        }
        $entries += [pscustomobject]@{
            Code = $code
            Path = $path.Replace('\\', '/')
            OldPath = $oldPath.Replace('\\', '/')
        }
    }
    return [pscustomobject]@{ Raw = $statusResult.Output; Entries = $entries }
}

function Convert-ToMarkdownList {
    param([string[]]$Items, [string]$EmptyText)
    if ($null -eq $Items -or $Items.Count -eq 0) { return ('- ' + $EmptyText) }
    return ($Items | ForEach-Object { '- ' + $_ }) -join "`n"
}

function Convert-ToMarkdownCodeBlock {
    param([string]$Text)
    if ([string]::IsNullOrWhiteSpace($Text)) { $Text = '(空)' }
    return '```text' + "`n" + $Text.TrimEnd() + "`n" + '```'
}

$warnings = New-Object System.Collections.Generic.List[string]
$failures = New-Object System.Collections.Generic.List[string]
$scopeWarnings = New-Object System.Collections.Generic.List[string]
$docMessages = New-Object System.Collections.Generic.List[string]
$syntaxResults = @()
$buildResult = $null
$inspectResult = $null

Write-Section '基础 Git 检查'
$branchResult = Invoke-CommandCapture -FilePath 'git' -ArgumentList @('branch', '--show-current')
$currentBranch = $branchResult.Output.Trim()
Write-Host ('当前分支：' + $currentBranch)
if ($currentBranch -ne 'mvp-rescue') {
    $warnings.Add('当前分支不是 mvp-rescue，而是 ' + $currentBranch + '。')
}

$gitStatus = Get-GitStatusEntries
$gitStatusRaw = $gitStatus.Raw
Write-Host '工作区状态：'
if ([string]::IsNullOrWhiteSpace($gitStatusRaw)) {
    Write-Host '工作区干净'
} else {
    Write-Host $gitStatusRaw
}

$diffStatResult = Invoke-CommandCapture -FilePath 'git' -ArgumentList @('diff', '--stat') -AllowFailure
$diffNameStatusResult = Invoke-CommandCapture -FilePath 'git' -ArgumentList @('diff', '--name-status') -AllowFailure
$diffCheckResult = Invoke-CommandCapture -FilePath 'git' -ArgumentList @('diff', '--check') -AllowFailure
$gitLogResult = Invoke-CommandCapture -FilePath 'git' -ArgumentList @('log', '--oneline', '-5')

Write-Host 'git diff --stat：'
Write-Host $(if ([string]::IsNullOrWhiteSpace($diffStatResult.Output)) { '(空)' } else { $diffStatResult.Output })
Write-Host 'git diff --name-status：'
Write-Host $(if ([string]::IsNullOrWhiteSpace($diffNameStatusResult.Output)) { '(空)' } else { $diffNameStatusResult.Output })
Write-Host 'git diff --check：'
Write-Host $(if ([string]::IsNullOrWhiteSpace($diffCheckResult.Output)) { '(空)' } else { $diffCheckResult.Output })
if ($diffCheckResult.ExitCode -ne 0) { $failures.Add('git diff --check 存在问题。') }
Write-Host 'git log --oneline -5：'
Write-Host $gitLogResult.Output

$changedFiles = @($gitStatus.Entries | ForEach-Object { if ($_.Path) { $_.Path } } | Sort-Object -Unique)
$untrackedFiles = @($gitStatus.Entries | Where-Object { $_.Code -eq '??' } | ForEach-Object { $_.Path } | Sort-Object -Unique)
$addedFiles = @($gitStatus.Entries | Where-Object { $_.Code.StartsWith('A') -or $_.Code -eq '??' } | ForEach-Object { $_.Path } | Sort-Object -Unique)

Write-Host '当前未跟踪文件列表：'
Write-Host $(if ($untrackedFiles.Count -gt 0) { $untrackedFiles -join "`n" } else { '无' })
Write-Host '当前新增文件列表：'
Write-Host $(if ($addedFiles.Count -gt 0) { $addedFiles -join "`n" } else { '无' })

Write-Section '文档检查'
$docA = @(Get-ChildItem -Path $RepoRoot -File -Recurse | Where-Object { $_.Name -eq 'ALIPRO_MVP_ACCEPTANCE_CARD.md' } | Select-Object -ExpandProperty FullName)
$docB = @(Get-ChildItem -Path $RepoRoot -File -Recurse | Where-Object { $_.Name -eq 'Alipro-MVP验收卡.md' } | Select-Object -ExpandProperty FullName)
if ($docA.Count -eq 0 -and $docB.Count -eq 0) {
    $warnings.Add('未找到 ALIPRO_MVP_ACCEPTANCE_CARD.md 或 Alipro-MVP验收卡.md。')
    $docMessages.Add('警告：两个 MVP 验收卡文档都不存在。')
} elseif ($docA.Count -gt 0 -and $docB.Count -gt 0) {
    $warnings.Add('两个 MVP 验收卡文档同时存在，后续需要统一文档名。')
    $docMessages.Add('提醒：两个文档都存在，后续需要统一文档名。')
} else {
    if ($docA.Count -gt 0) { $docMessages.Add('已找到：ALIPRO_MVP_ACCEPTANCE_CARD.md') }
    if ($docB.Count -gt 0) { $docMessages.Add('已找到：Alipro-MVP验收卡.md') }
}
$docMessages | ForEach-Object { Write-Host $_ }

Write-Section '越界检查'
$allowedExactFiles = @(
    'backend/routes/ai.js',
    'backend/verify-batch-generation.js',
    'frontend-react/src/App.jsx',
    'frontend-react/src/lib/chapterResult.js',
    'frontend-react/src/lib/generationActions.js',
    'tools/check-mvp-rescue.ps1'
)
$allowedDocNames = @('ALIPRO_MVP_ACCEPTANCE_CARD.md', 'Alipro-MVP验收卡.md')
$warnChecks = @(
    @{ Pattern = 'frontend-react/src/.*(theme|style|css)'; Message = '前端主题/样式系统' },
    @{ Pattern = '.*timeline.*'; Message = '复杂时间线可视化' },
    @{ Pattern = '.*(character|role).*(graph|relation|map).*'; Message = '人物关系图' },
    @{ Pattern = '.*payment.*'; Message = '支付相关' },
    @{ Pattern = '.*(deploy|docker|nginx|vercel|pm2).*'; Message = '部署相关' },
    @{ Pattern = '.*migrat.*'; Message = '数据库迁移' },
    @{ Pattern = '^package\.json$'; Message = 'package.json' },
    @{ Pattern = '^package-lock\.json$'; Message = 'package-lock.json' },
    @{ Pattern = '.*vite\.config.*'; Message = 'vite 配置' },
    @{ Pattern = '.*nginx.*'; Message = 'nginx 配置' }
)
foreach ($file in $changedFiles) {
    $isAllowed = $allowedExactFiles -contains $file
    if (-not $isAllowed) {
        $fileName = [System.IO.Path]::GetFileName($file)
        if ($allowedDocNames -contains $fileName) { $isAllowed = $true }
    }
    if (-not $isAllowed) {
        $scopeWarnings.Add('可能越界：' + $file + ' 不在本轮允许改动范围内。')
    }
    foreach ($item in $warnChecks) {
        if ($file -match $item.Pattern) {
            $scopeWarnings.Add('可能越界：' + $file + ' 命中敏感范围（' + $item.Message + '）。')
        }
    }
}
if ($scopeWarnings.Count -eq 0) {
    Write-Host '未发现明显越界改动。'
} else {
    $scopeWarnings | ForEach-Object {
        Write-Host $_ -ForegroundColor Yellow
        $warnings.Add($_)
    }
}

Write-Section '语法检查'
$syntaxTargets = @($changedFiles | Where-Object { (($_ -like 'backend/*.js') -or ($_ -like 'frontend-react/src/lib/*.js')) -and ($_ -notlike '*.jsx') } | Sort-Object -Unique)
if ($syntaxTargets.Count -eq 0) {
    Write-Host '没有需要做 node --check 的本轮 .js 文件。'
} else {
    foreach ($target in $syntaxTargets) {
        $fullPath = Join-Path $RepoRoot ($target -replace '/', '\\')
        if (-not (Test-Path $fullPath)) {
            $syntaxResults += [pscustomobject]@{ File = $target; Status = 'SKIP'; Detail = '文件不存在，跳过' }
            continue
        }
        $result = Invoke-CommandCapture -FilePath 'node' -ArgumentList @('--check', $fullPath) -AllowFailure
        $status = if ($result.ExitCode -eq 0) { 'PASS' } else { 'FAIL' }
        if ($result.ExitCode -ne 0) { $failures.Add('语法检查失败：' + $target) }
        $detail = if ([string]::IsNullOrWhiteSpace($result.Output)) { '通过' } else { $result.Output }
        $syntaxResults += [pscustomobject]@{ File = $target; Status = $status; Detail = $detail }
        Write-Host ($target + ' => ' + $status)
    }
}

Write-Section '前端构建'
$frontendChanged = @($changedFiles | Where-Object { $_ -like 'frontend-react/*' })
if ($frontendChanged.Count -gt 0) {
    $buildResult = Invoke-CommandCapture -FilePath 'npm.cmd' -ArgumentList @('--prefix', 'frontend-react', 'run', 'build') -AllowFailure
    if ($buildResult.ExitCode -eq 0) {
        Write-Host '前端构建通过。' -ForegroundColor Green
    } else {
        Write-Host '前端构建失败。' -ForegroundColor Red
        $failures.Add('前端 build 失败。')
    }
} else {
    $buildResult = [pscustomobject]@{ ExitCode = 0; Output = '本轮未修改 frontend-react，已跳过 build。' }
    Write-Host $buildResult.Output
}

Write-Section 'inspect 验收'
$verifyScriptPath = Join-Path $RepoRoot 'backend\verify-batch-generation.js'
if (Test-Path $verifyScriptPath) {
    $inspectResult = Invoke-CommandCapture -FilePath 'node' -ArgumentList @($verifyScriptPath, '--mode', 'inspect') -AllowFailure
    if ($inspectResult.ExitCode -eq 0) {
        Write-Host 'inspect 验收通过。' -ForegroundColor Green
    } else {
        Write-Host 'inspect 验收未通过。' -ForegroundColor Yellow
        $failures.Add('inspect 验收失败。')
    }
} else {
    $inspectResult = [pscustomobject]@{ ExitCode = 0; Output = '未找到 backend/verify-batch-generation.js，已跳过 inspect 验收。' }
    $warnings.Add($inspectResult.Output)
    Write-Host $inspectResult.Output
}

$finalConclusion = 'PASS'
if ($failures.Count -gt 0) {
    $finalConclusion = 'FAIL'
} elseif ($warnings.Count -gt 0) {
    $finalConclusion = 'WARN'
}
Write-Section '最终结论'
Write-Host ('最终结论：' + $finalConclusion) -ForegroundColor Magenta

$buildStatus = if ($buildResult.ExitCode -eq 0) { 'PASS' } else { 'FAIL' }
$inspectStatus = if ($inspectResult.ExitCode -eq 0) { 'PASS' } else { 'FAIL' }
$reportLines = @(
    '# MVP救援检查报告',
    '',
    '1. 执行时间',
    '',
    (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'),
    '',
    '2. 当前分支',
    '',
    $currentBranch,
    '',
    '3. 工作区状态',
    '',
    (Convert-ToMarkdownCodeBlock -Text $gitStatusRaw),
    '',
    '4. 修改文件列表',
    '',
    (Convert-ToMarkdownList -Items $changedFiles -EmptyText '无'),
    '',
    '未跟踪文件：',
    '',
    (Convert-ToMarkdownList -Items $untrackedFiles -EmptyText '无'),
    '',
    '新增文件：',
    '',
    (Convert-ToMarkdownList -Items $addedFiles -EmptyText '无'),
    '',
    '5. diff 统计',
    '',
    'git diff --stat',
    '',
    (Convert-ToMarkdownCodeBlock -Text $diffStatResult.Output),
    '',
    'git diff --name-status',
    '',
    (Convert-ToMarkdownCodeBlock -Text $diffNameStatusResult.Output),
    '',
    'git diff --check',
    '',
    (Convert-ToMarkdownCodeBlock -Text $diffCheckResult.Output),
    '',
    'git log --oneline -5',
    '',
    (Convert-ToMarkdownCodeBlock -Text $gitLogResult.Output),
    '',
    '6. 文档存在情况',
    '',
    (Convert-ToMarkdownList -Items @($docMessages.ToArray()) -EmptyText '未发现文档信息'),
    '',
    '7. 是否有越界改动警告',
    '',
    (Convert-ToMarkdownList -Items @($scopeWarnings.ToArray()) -EmptyText '未发现越界改动警告'),
    '',
    '8. 语法检查结果'
)
if ($syntaxResults.Count -eq 0) {
    $reportLines += ''
    $reportLines += '- 没有需要做语法检查的本轮 .js 文件'
} else {
    foreach ($item in $syntaxResults) {
        $reportLines += ''
        $reportLines += ('- ' + $item.File + '：' + $item.Status)
        $reportLines += ''
        $reportLines += (Convert-ToMarkdownCodeBlock -Text $item.Detail)
    }
}
$reportLines += @(
    '',
    '9. 前端 build 结果',
    '',
    $buildStatus,
    '',
    (Convert-ToMarkdownCodeBlock -Text $buildResult.Output),
    '',
    '10. inspect 验收结果',
    '',
    $inspectStatus,
    '',
    (Convert-ToMarkdownCodeBlock -Text $inspectResult.Output),
    '',
    '11. 最终结论',
    '',
    ('- ' + $finalConclusion),
    '',
    '附加警告：',
    '',
    (Convert-ToMarkdownList -Items @($warnings.ToArray()) -EmptyText '无'),
    '',
    '阻塞问题：',
    '',
    (Convert-ToMarkdownList -Items @($failures.ToArray()) -EmptyText '无')
)
[System.IO.File]::WriteAllText($ReportPath, ($reportLines -join "`r`n"), (New-Object System.Text.UTF8Encoding($true)))
Write-Host ''
Write-Host ('报告已生成：' + $ReportPath) -ForegroundColor Green
