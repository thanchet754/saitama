# ==============================================================
# Saitama - one-time Android signing key setup
# Run once:  right-click > "Run with PowerShell"
#   1. Creates a signing key in ..\saitama-android-key (next to the repo, NOT in it)
#   2. Uploads it as GitHub Actions secrets so the APK can be built in the cloud
# Keep the key folder safe (copy it to Google Drive / USB). Losing it means
# the app can no longer be updated in place.
# ==============================================================
$ErrorActionPreference = 'Stop'
$repo = 'thanchet754/saitama'
# Key folder sits NEXT TO the repo folder (e.g. D:\...\saitama-android-key), never inside it
$dir  = Join-Path (Split-Path $PSScriptRoot -Parent) 'saitama-android-key'
$ks   = Join-Path $dir 'saitama-release.jks'

$env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')
$jdk = Get-ChildItem 'C:\Program Files\Microsoft' -Directory -Filter 'jdk-21*' | Select-Object -First 1
if (-not $jdk) { throw 'Java 21 not found. Install with: winget install Microsoft.OpenJDK.21' }
$keytool = Join-Path $jdk.FullName 'bin\keytool.exe'

New-Item -ItemType Directory -Force $dir | Out-Null
if (Test-Path $ks) {
    Write-Host "Key already exists at $ks - reusing it (never overwrite!)" -ForegroundColor Yellow
    $pw = (Select-String -Path (Join-Path $dir 'README-KEY.txt') -Pattern 'Store password: (.+)$').Matches[0].Groups[1].Value.Trim()
} else {
    $pw = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | ForEach-Object { [char]$_ })
    & $keytool -genkeypair -keystore $ks -storetype PKCS12 -alias saitama -keyalg RSA -keysize 4096 -validity 36500 `
        -storepass $pw -keypass $pw -dname 'CN=Saitama, O=thanchet754, C=VN'
    @"
Saitama Android signing key - KEEP THIS FOLDER SAFE (backup to Google Drive / USB).
Losing it means the app cannot be updated in place (must uninstall + reinstall).

Keystore file : saitama-release.jks
Alias         : saitama
Store password: $pw
Key password  : $pw
Created       : $(Get-Date -Format 'yyyy-MM-dd HH:mm')
"@ | Out-File (Join-Path $dir 'README-KEY.txt') -Encoding utf8
    Write-Host "Created key: $ks" -ForegroundColor Green
}

$b64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes($ks))
$b64       | gh secret set ANDROID_KEYSTORE_BASE64   -R $repo
$pw        | gh secret set ANDROID_KEYSTORE_PASSWORD -R $repo
'saitama'  | gh secret set ANDROID_KEY_ALIAS         -R $repo
$pw        | gh secret set ANDROID_KEY_PASSWORD      -R $repo

Write-Host ''
Write-Host 'Done. GitHub secrets:' -ForegroundColor Green
gh secret list -R $repo
Write-Host ''
Write-Host "Back up the folder $dir now!" -ForegroundColor Yellow
Read-Host 'Press Enter to close'
