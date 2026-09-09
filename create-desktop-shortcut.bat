@echo off
setlocal enabledelayedexpansion
title Windows App Shortcut Installer
color 0A

echo.
echo ======================================================================
echo           RETAIL SALES ^& INVENTORY MANAGEMENT SYSTEM
echo           Install / Update Windows Desktop Standalone App
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

REM --- 2. Determine App / Shop Name dynamically ---
set "APP_NAME=%~1"
if /i "%APP_NAME%"=="nowait" set "APP_NAME="
if "%APP_NAME%"=="" (
    for /f "usebackq delims=" %%N in (`powershell -NoProfile -Command "try { $r = Invoke-RestMethod -Uri 'http://localhost/api/v1/settings/public' -TimeoutSec 2; if ($r.data.shop_name_en) { $r.data.shop_name_en.Trim() } else { 'Sell & Inventory' } } catch { 'Sell & Inventory' }"`) do (
        set "APP_NAME=%%N"
    )
)
if "%APP_NAME%"=="" set "APP_NAME=Sell & Inventory"

REM --- 3. Determine paths & icons ---
set "SCRIPT_DIR=%~dp0"
set "ICON_FILE=%SCRIPT_DIR%icon.ico"
if not exist "%ICON_FILE%" set "ICON_FILE=%SCRIPT_DIR%apps\web\public\icon.ico"
set "TARGET_URL=http://localhost"
set "APP_ARGS=--app=%TARGET_URL% --window-size=1440,900"

set "DESKTOP_DIR=%USERPROFILE%\Desktop"
set "START_MENU_DIR=%APPDATA%\Microsoft\Windows\Start Menu\Programs"

REM --- 4. Clean up any obsolete/legacy shortcuts ---
if exist "%DESKTOP_DIR%\Al-Noor POS.lnk" del /f /q "%DESKTOP_DIR%\Al-Noor POS.lnk" >nul 2>&1
if exist "%START_MENU_DIR%\Al-Noor POS.lnk" del /f /q "%START_MENU_DIR%\Al-Noor POS.lnk" >nul 2>&1

REM --- 5. Create Desktop and Start Menu Shortcuts via PowerShell ---
echo [INSTALL] Creating Windows Shortcuts...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$appName = [System.Environment]::GetEnvironmentVariable('APP_NAME');" ^
  "$browser = [System.Environment]::GetEnvironmentVariable('BROWSER_EXE');" ^
  "$args = [System.Environment]::GetEnvironmentVariable('APP_ARGS');" ^
  "$icon = [System.Environment]::GetEnvironmentVariable('ICON_FILE');" ^
  "$desktop = [System.Environment]::GetEnvironmentVariable('DESKTOP_DIR');" ^
  "$startMenu = [System.Environment]::GetEnvironmentVariable('START_MENU_DIR');" ^
  "$ws = New-Object -ComObject WScript.Shell;" ^
  "$safeName = [string]::Join('_', $appName.Split([System.IO.Path]::GetInvalidFileNameChars()));" ^
  "$dShortcut = $ws.CreateShortcut((Join-Path $desktop ($safeName + '.lnk')));" ^
  "$dShortcut.TargetPath = $browser;" ^
  "$dShortcut.Arguments = $args;" ^
  "$dShortcut.IconLocation = ($icon + ',0');" ^
  "$dShortcut.Description = ($appName + ' Standalone App');" ^
  "$dShortcut.Save();" ^
  "$mShortcut = $ws.CreateShortcut((Join-Path $startMenu ($safeName + '.lnk')));" ^
  "$mShortcut.TargetPath = $browser;" ^
  "$mShortcut.Arguments = $args;" ^
  "$mShortcut.IconLocation = ($icon + ',0');" ^
  "$mShortcut.Description = ($appName + ' Standalone App');" ^
  "$mShortcut.Save();" ^
  "Write-Host ('[SUCCESS] Shortcuts created: ' + $safeName + '.lnk');"

echo.
echo ======================================================================
echo  [INSTALLATION COMPLETE]
echo.
echo  You can now open the app from your Desktop or Start Menu.
echo  It will launch in a dedicated, borderless standalone app window!
echo ======================================================================
echo.
if not "%~2"=="nowait" if not "%~1"=="nowait" pause
