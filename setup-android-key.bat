@echo off
rem One-time: create the Android signing key and upload it to GitHub secrets
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup-android-key.ps1"
