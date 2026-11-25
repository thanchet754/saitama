@echo off
title AnyVideoPro - Trinh Tai Video Da Nen Tang
color 0b

echo ========================================================
echo         ANYVIDEOPRO - TAI VIDEO DA NEN TANG
echo   Facebook, TikTok, Instagram, YouTube, X/Twitter
echo ========================================================
echo.

:: Detect Python
set PYTHON_CMD=python
where python >nul 2>nul
if %errorlevel% neq 0 (
    if exist "%LOCALAPPDATA%\Programs\Python\Python312\python.exe" (
        set "PYTHON_CMD=%LOCALAPPDATA%\Programs\Python\Python312\python.exe"
    ) else (
        echo [LOI] Khong tim thay Python tren he thong!
        echo Vui long cai dat Python 3.10+ tu https://python.org
        pause
        exit /b 1
    )
)

echo [*] Su dung Python: %PYTHON_CMD%
echo [*] Dang kiem tra va khoi dong may chu...
echo.

:: Launch browser in background after 2 seconds
start "" /b cmd /c "timeout /t 2 /nobreak >nul & start http://localhost:8000"

:: Start FastAPI Server
"%PYTHON_CMD%" app.py

pause
