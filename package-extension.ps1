param(
  [string]$OutputDir = "dist"
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$manifestPath = Join-Path $repoRoot "manifest.json"

if (-not (Test-Path $manifestPath)) {
  throw "manifest.json not found at $manifestPath"
}

$rawManifest = Get-Content -Path $manifestPath -Raw
$manifest = $rawManifest | ConvertFrom-Json

if (-not $manifest.version) {
  throw "Version is missing in manifest.json"
}

if (-not $manifest.background.service_worker) {
  throw "manifest.json has no background.service_worker to convert for the Firefox build"
}

$version = $manifest.version
$outputDirectory = Join-Path $repoRoot $OutputDir

$excludeNames = @(
  "node_modules",
  "dist",
  "Todo"
)

$excludeFiles = @(
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

function Copy-ExtensionFiles {
  param(
    [Parameter(Mandatory)][string]$Destination
  )

  Get-ChildItem -Path $repoRoot -Force | ForEach-Object {
    if ($_.Name.StartsWith(".")) {
      return
    }

    if ($excludeNames -contains $_.Name) {
      return
    }

    if ($_.PSIsContainer) {
      if ($_.Name -eq "img") {
        $targetImgDir = Join-Path $Destination "img"
        New-Item -ItemType Directory -Path $targetImgDir -Force | Out-Null
        Copy-Item -Path (Join-Path $_.FullName "icon.png") -Destination $targetImgDir -Force
        return
      }

      Copy-Item -Path $_.FullName -Destination $Destination -Recurse -Force
      return
    }

    if ($excludeFiles -contains $_.Name) {
      return
    }

    Copy-Item -Path $_.FullName -Destination $Destination -Force
  }
}

function New-FirefoxManifest {
  param(
    [Parameter(Mandatory)][string]$Destination
  )

  # Firefox MV3 has no service-worker background, so the Firefox package swaps
  # the background block for an event page. Rewriting the raw text keeps every
  # other key byte-identical to the Chrome manifest.
  $backgroundPattern = '"background"\s*:\s*\{[^{}]*\}'
  if ($rawManifest -notmatch $backgroundPattern) {
    throw "Could not locate the background block in manifest.json"
  }

  $firefoxManifest = $rawManifest -replace $backgroundPattern, '"background": { "scripts": ["js/background.js"] }'
  $parsed = $firefoxManifest | ConvertFrom-Json

  if (-not $parsed.background.scripts -or $parsed.background.service_worker) {
    throw "Firefox manifest rewrite failed validation"
  }

  [System.IO.File]::WriteAllText((Join-Path $Destination "manifest.json"), $firefoxManifest)
}

function New-ExtensionArchive {
  param(
    [Parameter(Mandatory)][string]$Source,
    [Parameter(Mandatory)][string]$ArchivePath
  )

  # Create the ZIP with forward-slash entry names and files at the ZIP root.
  # Do NOT use Compress-Archive here: on Windows PowerShell 5.1 it stores
  # subfolders with backslashes (e.g. "img\icon.png"), which the Firefox
  # AMO validator rejects with "Invalid file name in archive".
  Add-Type -AssemblyName System.IO.Compression
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $zipStream = [System.IO.File]::Open($ArchivePath, [System.IO.FileMode]::Create)
  try {
    $zip = New-Object System.IO.Compression.ZipArchive($zipStream, [System.IO.Compression.ZipArchiveMode]::Create)
    try {
      Get-ChildItem -Path $Source -Recurse -File | ForEach-Object {
        $entryName = $_.FullName.Substring($Source.Length + 1) -replace '\\', '/'
        [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $_.FullName, $entryName, [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
      }
    } finally {
      $zip.Dispose()
    }
  } finally {
    $zipStream.Dispose()
  }
}

$variants = @(
  @{ Name = "chrome"; ArchiveName = "search-popup-chrome-v$version.zip" },
  @{ Name = "firefox"; ArchiveName = "search-popup-firefox-v$version.zip" }
)

if (-not (Test-Path $outputDirectory)) {
  New-Item -ItemType Directory -Path $outputDirectory | Out-Null
}

foreach ($variant in $variants) {
  $archivePath = Join-Path $outputDirectory $variant.ArchiveName
  $stagingPath = Join-Path ([System.IO.Path]::GetTempPath()) ("search-popup-package-" + $variant.Name + "-" + [guid]::NewGuid().ToString())

  try {
    if (Test-Path $archivePath) {
      Remove-Item -Path $archivePath -Force
    }

    New-Item -ItemType Directory -Path $stagingPath | Out-Null
    Copy-ExtensionFiles -Destination $stagingPath

    if ($variant.Name -eq "firefox") {
      New-FirefoxManifest -Destination $stagingPath
    }

    New-ExtensionArchive -Source $stagingPath -ArchivePath $archivePath

    Write-Host "Created package:"
    Write-Host $archivePath
  }
  finally {
    if (Test-Path $stagingPath) {
      Remove-Item -Path $stagingPath -Recurse -Force
    }
  }
}
