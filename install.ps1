# PowerShell Script to install Mewsic on Windows

$ErrorActionPreference = 'Stop'
$repo = "xeoniii/Mewsic"
$tempDir = [System.IO.Path]::GetTempPath()

Write-Host "Fetching latest release information from GitHub..." -ForegroundColor Cyan

# Fetch latest release URL
$releasesApi = "https://api.github.com/repos/$repo/releases/latest"
$response = Invoke-RestMethod -Uri $releasesApi -UseBasicParsing

# Find the download URL for Windows installer (.msi or .exe)
$asset = $response.assets | Where-Object { $_.name -like "*.msi" -or ($_.name -like "*.exe" -and $_.name -like "*setup*") } | Select-Object -First 1

if ($null -eq $asset) {
    Write-Error "No Windows installer (.msi or setup .exe) found in the latest release."
    exit 1
}

$downloadUrl = $asset.browser_download_url
$fileName = $asset.name
$outputPath = Join-Path $tempDir $fileName

Write-Host "Downloading $fileName..." -ForegroundColor Cyan
Invoke-WebRequest -Uri $downloadUrl -OutFile $outputPath

Write-Host "Installing Mewsic..." -ForegroundColor Cyan
if ($fileName.EndsWith(".msi")) {
    # Run MSI installer silently
    Start-Process -FilePath "msiexec.exe" -ArgumentList "/i `"$outputPath`" /passive /norestart" -Wait
} else {
    # Run EXE installer
    Start-Process -FilePath $outputPath -Wait
}

# Clean up
if (Test-Path $outputPath) {
    Remove-Item $outputPath
}

Write-Host "Installation completed successfully." -ForegroundColor Green
