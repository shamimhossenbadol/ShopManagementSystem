@echo off
setlocal enabledelayedexpansion
title Al-Noor POS - Install Windows App Shortcut
color 0A

echo.
echo ======================================================================
echo           AL-NOOR RETAIL SHOP MANAGEMENT SYSTEM (KSA)
echo           Install Windows Desktop Standalone App
echo ======================================================================
echo.

REM --- 1. Detect Edge or Chrome executable ---
set "BROWSER_EXE="

if exist "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" (
    set "BROWSER_EXE=C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
) else if exist "C:\Program Files\Microsoft\Edge\Application\msedge.exe" (
    set "BROWSER_EXE=C:\Program Files\Microsoft\Edge\Application\msedge.exe"
) else if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" (
    set "BROWSER_EXE=C:\Program Files\Google\Chrome\Application\chrome.exe"
) else if exist "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" (
    set "BROWSER_EXE=C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
)

if "%BROWSER_EXE%"=="" (
    echo [ERROR] Neither Microsoft Edge nor Google Chrome was detected.
    echo Defaulting to default browser protocol handler.
    pause
    exit /b 1
)

echo [OK] Using browser engine: %BROWSER_EXE%

REM --- 2. Determine paths ---
set "SCRIPT_DIR=%~dp0"
set "ICON_FILE=%SCRIPT_DIR%icon.ico"
set "TARGET_URL=http://localhost"
set "APP_ARGS=--app=%TARGET_URL% --window-size=1440,900"

set "DESKTOP_DIR=%USERPROFILE%\Desktop"
set "START_MENU_DIR=%APPDATA%\Microsoft\Windows\Start Menu\Programs"

REM --- 3. Create Desktop Shortcut using PowerShell ---
echo [INSTALL] Creating Windows Desktop Shortcut...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('%DESKTOP_DIR%\Al-Noor POS.lnk'); $s.TargetPath = '%BROWSER_EXE%'; $s.Arguments = '%APP_ARGS%'; $s.IconLocation = '%ICON_FILE%'; $s.Description = 'Al-Noor Supermarket & Retail POS App'; $s.Save()"

if errorlevel 1 (
    echo [WARNING] Failed to create Desktop shortcut.
) else (
    echo [SUCCESS] Shortcut created on Desktop: "%DESKTOP_DIR%\Al-Noor POS.lnk"
)

REM --- 4. Create Start Menu Shortcut ---
echo [INSTALL] Creating Windows Start Menu Shortcut...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('%START_MENU_DIR%\Al-Noor POS.lnk'); $s.TargetPath = '%BROWSER_EXE%'; $s.Arguments = '%APP_ARGS%'; $s.IconLocation = '%ICON_FILE%'; $s.Description = 'Al-Noor Supermarket & Retail POS App'; $s.Save()"

if errorlevel 1 (
    echo [WARNING] Failed to create Start Menu shortcut.
) else (
    echo [SUCCESS] Shortcut created in Start Menu: "%START_MENU_DIR%\Al-Noor POS.lnk"
)

echo.
echo ======================================================================
echo  [INSTALLATION COMPLETE]
echo.
echo  You can now open Al-Noor POS like a native Windows application:
echo    1. From your Desktop: Double-click the "Al-Noor POS" icon.
echo    2. From Start Menu: Search for "Al-Noor POS".
echo.
echo  It will launch in a dedicated, borderless standalone app window
echo  without address bars, tabs, or browser clutter!
echo ======================================================================
echo.
pause
