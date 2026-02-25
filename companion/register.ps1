param(
    [Parameter(Mandatory=$true)]
    [string]$ExtensionId
)

$ErrorActionPreference = "Stop"

$BinaryPath = "\\wsl$\Ubuntu\home\blaze\repos\ytdlext\companion\ytdlext-companion.exe"
$ManifestName = "com.ytdlext.companion"
$ManifestDir = "\\wsl$\Ubuntu\home\blaze\repos\ytdlext\companion\native-host"
$ManifestPath = Join-Path $ManifestDir "$ManifestName.json"

# Create native-host directory if needed
if (-not (Test-Path $ManifestDir)) {
    New-Item -ItemType Directory -Path $ManifestDir | Out-Null
}

# Write manifest JSON
$Manifest = (Get-Content "\\wsl$\Ubuntu\home\blaze\repos\ytdlext\companion\host-manifest.json" -Raw) `
    -replace "PLACEHOLDER_BINARY_PATH", ($BinaryPath -replace '\\', '\\') `
    -replace "PLACEHOLDER_EXTENSION_ID", $ExtensionId

$Manifest | Set-Content -Path $ManifestPath -Encoding UTF8
Write-Host "Wrote manifest: $ManifestPath"

# Register in Windows Registry for Chrome/Brave
$RegKey = "HKCU:\Software\Google\Chrome\NativeMessagingHosts\$ManifestName"
$ParentKey = Split-Path $RegKey
if (-not (Test-Path $ParentKey)) {
    New-Item -Path $ParentKey -Force | Out-Null
}
New-Item -Path $RegKey -Force | Out-Null
Set-ItemProperty -Path $RegKey -Name "(Default)" -Value $ManifestPath
Write-Host "Registered native host at $RegKey"

Write-Host ""
Write-Host "Done! Restart Brave/Chrome to pick up the native messaging host."
