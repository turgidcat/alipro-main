$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$releaseRoot = Join-Path $projectRoot 'release'
$stagingRoot = Join-Path $releaseRoot 'portable-staging'
$appDir = Join-Path $stagingRoot 'ALIPRO-Project-Manager-win32-x64'
$appResources = Join-Path $appDir 'resources\app'
$electronDist = Join-Path $projectRoot 'node_modules\electron\dist'

if (-not (Test-Path (Join-Path $electronDist 'electron.exe'))) { throw "未找到 Electron 运行时：$electronDist" }
if (Test-Path $stagingRoot) { Remove-Item -LiteralPath $stagingRoot -Recurse -Force }
New-Item -ItemType Directory -Path $stagingRoot -Force | Out-Null
New-Item -ItemType Directory -Path $appResources -Force | Out-Null
Get-ChildItem -LiteralPath $electronDist -Force | Copy-Item -Destination $appDir -Recurse -Force
Copy-Item -LiteralPath (Join-Path $projectRoot 'src') -Destination $appResources -Recurse -Force
Copy-Item -LiteralPath (Join-Path $projectRoot 'package.json') -Destination $appResources -Force
$portableExe = Join-Path $appDir 'ALIPRO-Project-Manager.exe'
Rename-Item -LiteralPath (Join-Path $appDir 'electron.exe') -NewName (Split-Path $portableExe -Leaf)
$zipPath = Join-Path $releaseRoot 'ALIPRO-Project-Manager-portable.zip'
if (Test-Path $zipPath) { Remove-Item -LiteralPath $zipPath -Force }
Compress-Archive -LiteralPath $appDir -DestinationPath $zipPath -Force
Remove-Item -LiteralPath $stagingRoot -Recurse -Force
Write-Output "便携包已生成：$zipPath"
