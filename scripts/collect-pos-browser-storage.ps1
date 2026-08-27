$ErrorActionPreference = "Stop"

$runningBrowsers = Get-Process chrome, msedge, brave -ErrorAction SilentlyContinue
if ($runningBrowsers) {
  Write-Host "Close Chrome, Edge, and Brave completely, then run this collector again." -ForegroundColor Yellow
  exit 2
}

$timestamp = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH-mm-ssZ")
$downloads = Join-Path $env:USERPROFILE "Downloads"
if (-not (Test-Path -LiteralPath $downloads)) {
  $downloads = [Environment]::GetFolderPath("Desktop")
}
$collectionRoot = Join-Path $downloads "CASSA-August-Recovery-$timestamp"
$zipPath = "$collectionRoot.zip"
New-Item -ItemType Directory -Path $collectionRoot | Out-Null

$browserRoots = @(
  @{ Name = "Chrome"; Path = (Join-Path $env:LOCALAPPDATA "Google\Chrome\User Data") },
  @{ Name = "Edge"; Path = (Join-Path $env:LOCALAPPDATA "Microsoft\Edge\User Data") },
  @{ Name = "Brave"; Path = (Join-Path $env:LOCALAPPDATA "BraveSoftware\Brave-Browser\User Data") }
)

$copiedProfiles = 0
foreach ($browser in $browserRoots) {
  if (-not (Test-Path -LiteralPath $browser.Path)) { continue }

  $profiles = Get-ChildItem -LiteralPath $browser.Path -Directory | Where-Object {
    $_.Name -eq "Default" -or $_.Name -like "Profile *"
  }

  foreach ($profile in $profiles) {
    $profileDestination = Join-Path $collectionRoot (Join-Path $browser.Name $profile.Name)
    $storageLocations = @(
      @{ Name = "Local Storage\leveldb"; Source = (Join-Path $profile.FullName "Local Storage\leveldb") },
      @{ Name = "Session Storage"; Source = (Join-Path $profile.FullName "Session Storage") }
    )

    $profileCopied = $false
    foreach ($storage in $storageLocations) {
      if (-not (Test-Path -LiteralPath $storage.Source)) { continue }
      $destination = Join-Path $profileDestination $storage.Name
      New-Item -ItemType Directory -Path $destination -Force | Out-Null
      & robocopy.exe $storage.Source $destination /E /COPY:DAT /DCOPY:DAT /R:1 /W:1 /NFL /NDL /NJH /NJS /NP | Out-Null
      if ($LASTEXITCODE -ge 8) {
        throw "Could not copy $($storage.Source) (robocopy exit code $LASTEXITCODE)."
      }
      $profileCopied = $true
    }

    if ($profileCopied) { $copiedProfiles += 1 }
  }
}

if ($copiedProfiles -eq 0) {
  throw "No Chrome, Edge, or Brave browser storage profiles were found."
}

Compress-Archive -LiteralPath $collectionRoot -DestinationPath $zipPath -CompressionLevel Optimal
Write-Host "CASSA recovery copy created successfully:" -ForegroundColor Green
Write-Host $zipPath
Write-Host "Send this ZIP for August CASSA recovery. It may contain private browser data, so share it only through the recovery session." -ForegroundColor Yellow
