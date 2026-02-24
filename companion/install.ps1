param(
    [Parameter(Mandatory=$true)]
    [string]$ExtensionId
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Push-Location $ScriptDir

try {
    Write-Host "Building ytdlext-companion.exe..."
    $env:GOOS = "windows"
    $env:GOARCH = "amd64"
    go build -o ytdlext-companion.exe .
    if ($LASTEXITCODE -ne 0) { throw "Go build failed" }

    $BinaryPath = (Resolve-Path "ytdlext-companion.exe").Path
    Write-Host "Built: $BinaryPath"

    # Generate manifest with real paths.
    $Manifest = (Get-Content "host-manifest.json" -Raw) `
        -replace "PLACEHOLDER_BINARY_PATH", ($BinaryPath -replace '\\', '\\') `
        -replace "PLACEHOLDER_EXTENSION_ID", $ExtensionId

    $ManifestName = "com.ytdlext.companion"
    $ManifestDir = Join-Path $ScriptDir "native-host"
    if (-not (Test-Path $ManifestDir)) {
        New-Item -ItemType Directory -Path $ManifestDir | Out-Null
    }
    $ManifestPath = Join-Path $ManifestDir "$ManifestName.json"
    $Manifest | Set-Content -Path $ManifestPath -Encoding UTF8
    Write-Host "Wrote manifest: $ManifestPath"

    # Register in Windows Registry for Chrome and Edge.
    $Browsers = @(
        @{ Name = "Chrome";  Key = "HKCU:\Software\Google\Chrome\NativeMessagingHosts\$ManifestName" },
        @{ Name = "Edge";    Key = "HKCU:\Software\Microsoft\Edge\NativeMessagingHosts\$ManifestName" }
    )

    foreach ($Browser in $Browsers) {
        $ParentKey = Split-Path $Browser.Key
        if (-not (Test-Path $ParentKey)) {
            New-Item -Path $ParentKey -Force | Out-Null
        }
        New-Item -Path $Browser.Key -Force | Out-Null
        Set-ItemProperty -Path $Browser.Key -Name "(Default)" -Value $ManifestPath
        Write-Host "Registered native host for $($Browser.Name)"
    }

    Write-Host ""
    Write-Host "Installation complete!"
    Write-Host ""
    Write-Host "Next steps:"
    Write-Host "  1. Load the extension at chrome://extensions (developer mode)"
    Write-Host "  2. Copy the extension ID"
    Write-Host "  3. Re-run this script if the extension ID has changed"
    Write-Host "  4. Restart Chrome to pick up the native messaging host"
} finally {
    Pop-Location
}
