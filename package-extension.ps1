param(
  [string]$OutputDir = "dist"
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$manifestPath = Join-Path $repoRoot "manifest.json"

if (-not (Test-Path $manifestPath)) {
  throw "manifest.json not found at $manifestPath"
}

$manifest = Get-Content -Path $manifestPath -Raw | ConvertFrom-Json

if (-not $manifest.version) {
  throw "Version is missing in manifest.json"
}

$version = $manifest.version
$outputDirectory = Join-Path $repoRoot $OutputDir
$archiveName = "search-popup-chrome-v$version.zip"
$archivePath = Join-Path $outputDirectory $archiveName
$stagingPath = Join-Path ([System.IO.Path]::GetTempPath()) ("search-popup-package-" + [guid]::NewGuid().ToString())

$excludeNames = @(
  ".git",
  ".github",
  ".cursor",
  "node_modules",
  "dist",
  "Todo",
  ".desloppify"
)

$excludeFiles = @(
  ".gitignore",
  ".gitattributes",
  "README.md",
  "LICENSE",
  "AGENTS.md",
  "STORE_LISTING_CHROME.md",
  "bump.bat",
  "package-extension.ps1"
)

try {
  if (-not (Test-Path $outputDirectory)) {
    New-Item -ItemType Directory -Path $outputDirectory | Out-Null
  }

  if (Test-Path $archivePath) {
    Remove-Item -Path $archivePath -Force
  }

  New-Item -ItemType Directory -Path $stagingPath | Out-Null

  Get-ChildItem -Path $repoRoot -Force | ForEach-Object {
    if ($excludeNames -contains $_.Name) {
      return
    }

    if ($_.PSIsContainer) {
      if ($_.Name -eq "img") {
        $targetImgDir = Join-Path $stagingPath "img"
        New-Item -ItemType Directory -Path $targetImgDir -Force | Out-Null
        Copy-Item -Path (Join-Path $_.FullName "icon.png") -Destination $targetImgDir -Force
        return
      }

      Copy-Item -Path $_.FullName -Destination $stagingPath -Recurse -Force
      return
    }

    if ($excludeFiles -contains $_.Name) {
      return
    }

    Copy-Item -Path $_.FullName -Destination $stagingPath -Force
  }

  Compress-Archive -Path (Join-Path $stagingPath "*") -DestinationPath $archivePath -CompressionLevel Optimal

  Write-Host "Created package:"
  Write-Host $archivePath
}
finally {
  if (Test-Path $stagingPath) {
    Remove-Item -Path $stagingPath -Recurse -Force
  }
}
