$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$manifestPath = Join-Path $root "manifest.json"
$manifest = Get-Content -Raw -Encoding UTF8 -LiteralPath $manifestPath | ConvertFrom-Json

if ($manifest.manifest_version -ne 3) {
  throw "manifest_version must be 3"
}

$requiredFiles = @(
  "src/defaults.js",
  "src/content.js",
  "src/content.css",
  "src/popup.html",
  "src/popup.js",
  "src/popup.css",
  "src/options.html",
  "src/options.js",
  "src/options.css",
  "README.md",
  "INSTALL.md",
  "llms.txt",
  "LICENSE",
  "PRIVACY.md"
)

foreach ($file in $requiredFiles) {
  $path = Join-Path $root $file
  if (!(Test-Path -LiteralPath $path)) {
    throw "Missing required file: $file"
  }
}

foreach ($icon in $manifest.icons.PSObject.Properties.Value) {
  $path = Join-Path $root $icon
  if (!(Test-Path -LiteralPath $path)) {
    throw "Missing icon: $icon"
  }
}

$source = Get-ChildItem -LiteralPath (Join-Path $root "src") -File -Recurse |
  ForEach-Object { Get-Content -Raw -Encoding UTF8 -LiteralPath $_.FullName }

if ($source -match "\beval\s*\(") {
  throw "eval() is not allowed"
}

if ($source -match "https?://") {
  throw "Source files should not make remote requests"
}

$defaults = Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $root "src/defaults.js")
$patternMatches = [regex]::Matches($defaults, 'pattern:\s*"((?:\\.|[^"\\])*)"')
foreach ($match in $patternMatches) {
  $pattern = $match.Groups[1].Value
  try {
    [void][regex]::new($pattern)
  } catch {
    throw "Invalid default regex: $pattern"
  }
}

Write-Host "OK: extension manifest and source checks passed"
