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
  "ai-slop-report.md",
  "gitlog.bat",
  "bump.bat",
  "bump.txt",
  "changelog.txt",
  "package.bat",
  "package-extension.ps1",
  "*.py"
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

  # Create the ZIP with forward-slash entry names and files at the ZIP root.
  # Do NOT use Compress-Archive here: on Windows PowerShell 5.1 it stores
  # subfolders with backslashes (e.g. "img\icon.png"), which the Firefox
  # AMO validator rejects with "Invalid file name in archive".
  Add-Type -AssemblyName System.IO.Compression
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $zipStream = [System.IO.File]::Open($archivePath, [System.IO.FileMode]::Create)
  try {
    $zip = New-Object System.IO.Compression.ZipArchive($zipStream, [System.IO.Compression.ZipArchiveMode]::Create)
    try {
      Get-ChildItem -Path $stagingPath -Recurse -File | ForEach-Object {
        $entryName = $_.FullName.Substring($stagingPath.Length + 1) -replace '\\', '/'
        [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $_.FullName, $entryName, [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
      }
    } finally {
      $zip.Dispose()
    }
  } finally {
    $zipStream.Dispose()
  }

  Write-Host "Created package:"
  Write-Host $archivePath
}
finally {
  if (Test-Path $stagingPath) {
    Remove-Item -Path $stagingPath -Recurse -Force
  }
}
