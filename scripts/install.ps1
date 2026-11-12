param(
  [string]$Version = "latest",
  [string]$Destination = ""
)

$ErrorActionPreference = "Stop"
$repo = "BlazeNebula/dsh-todo-notes"
if ([string]::IsNullOrWhiteSpace($Destination)) {
  $Destination = Join-Path $env:LOCALAPPDATA "dsh-todo-notes"
}

if ($Version -eq "latest") {
  $release = Invoke-RestMethod -Uri "https://api.github.com/repos/$repo/releases/latest" -Headers @{ "User-Agent" = "dsh-todo-notes-installer" }
  $Version = $release.tag_name.TrimStart("v")
} else {
  if (-not $Version.StartsWith("v")) { $Version = "v$Version" }
  $release = Invoke-RestMethod -Uri "https://api.github.com/repos/$repo/releases/tags/$Version" -Headers @{ "User-Agent" = "dsh-todo-notes-installer" }
  $Version = $Version.TrimStart("v")
}

$asset = $release.assets | Where-Object { $_.name -like "dsh-todo-notes-*.tgz" } | Select-Object -First 1
if ($null -eq $asset) { throw "Release v$Version 没有找到 dsh-todo-notes-*.tgz 附件。" }

$target = Join-Path $Destination ("v" + $Version)
New-Item -ItemType Directory -Force -Path $target | Out-Null
$tgz = Join-Path $target $asset.name
Write-Host "下载 $($asset.name) ..."
Invoke-WebRequest -Uri $asset.browser_download_url -OutFile $tgz -UseBasicParsing

$sumAsset = $release.assets | Where-Object { $_.name -eq ($asset.name + ".sha256") } | Select-Object -First 1
if ($null -ne $sumAsset) {
  $sumFile = Join-Path $target ($asset.name + ".sha256")
  Invoke-WebRequest -Uri $sumAsset.browser_download_url -OutFile $sumFile -UseBasicParsing
  $expected = (Get-Content $sumFile -Raw).Split(" ")[0].Trim().ToLowerInvariant()
  $actual = (Get-FileHash $tgz -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($expected -ne $actual) { throw "校验失败：期望 $expected，实际 $actual" }
  Write-Host "SHA256 校验通过。"
}

$extract = Join-Path $target "package"
if (Test-Path $extract) { Remove-Item $extract -Recurse -Force }
New-Item -ItemType Directory -Force -Path $extract | Out-Null
tar -xzf $tgz -C $extract
$pluginRoot = Join-Path $extract "package"
if (-not (Test-Path (Join-Path $pluginRoot "package.json"))) {
  $pluginRoot = $extract
}

Write-Host ""
Write-Host "已解压到：$pluginRoot"
Write-Host "在 DSH 设置 → 插件 → 添加插件，选择上面这个目录即可安装。"
