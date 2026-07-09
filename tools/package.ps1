$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$dist = Join-Path $root "dist"
$zip = Join-Path $dist "x-reply-janitor.zip"

& (Join-Path $PSScriptRoot "validate-extension.ps1")

if (Test-Path -LiteralPath $dist) {
  Remove-Item -LiteralPath $dist -Recurse -Force
}
New-Item -ItemType Directory -Force -Path $dist | Out-Null

$items = @(
  "manifest.json",
  "src",
  "icons",
  "README.md",
  "LICENSE",
  "PRIVACY.md"
)

$paths = $items | ForEach-Object { Join-Path $root $_ }
Compress-Archive -Path $paths -DestinationPath $zip -Force

Write-Host "Created $zip"
