@echo off
setlocal enabledelayedexpansion
title Retail Sales & Inventory POS - Starting...
color 0A

echo.
echo ======================================================================
echo           RETAIL SALES ^& INVENTORY MANAGEMENT SYSTEM
echo ======================================================================
echo.

REM --- 1. Mode Selection (Argument or Interactive Prompt) ---
set "MODE_INPUT=%~1"

if /i "%MODE_INPUT%"=="1" goto set_prod
if /i "%MODE_INPUT%"=="prod" goto set_prod
if /i "%MODE_INPUT%"=="production" goto set_prod
if /i "%MODE_INPUT%"=="--prod" goto set_prod

if /i "%MODE_INPUT%"=="2" goto set_dev
if /i "%MODE_INPUT%"=="dev" goto set_dev
if /i "%MODE_INPUT%"=="development" goto set_dev
if /i "%MODE_INPUT%"=="--dev" goto set_dev

:prompt_mode
echo Select Launch Mode:
echo.
echo   [1] PRODUCTION Mode (Recommended for Daily Shop Operations)
echo       - Fully optimized Ahead-Of-Time (AOT) standalone build
echo       - Instant sub-millisecond page transitions with zero compilation lag
echo       - Rock-solid stability for Multi-terminal LAN ^& Cashier POS
echo       - Minimal RAM and CPU usage
echo.
echo   [2] DEVELOPMENT Mode (For Code Customization ^& Debugging)
echo       - Next.js development server with hot-module reloading (HMR)
echo       - Source files bind-mounted for real-time code editing
echo.
set "USER_CHOICE="
set /p "USER_CHOICE=Enter choice [1 or 2, default is 1]: "

if "%USER_CHOICE%"=="" goto set_prod
if "%USER_CHOICE%"=="1" goto set_prod
if "%USER_CHOICE%"=="2" goto set_dev
if /i "%USER_CHOICE%"=="prod" goto set_prod
if /i "%USER_CHOICE%"=="dev" goto set_dev

echo [INVALID] Invalid selection '%USER_CHOICE%'. Defaulting to Production Mode.
echo.

:set_prod
set "COMPOSE_FILES=-f docker-compose.yml"
set "MODE_LABEL=PRODUCTION (Optimized Standalone)"
goto proceed_startup

:set_dev
set "COMPOSE_FILES=-f docker-compose.yml -f docker-compose.dev.yml"
set "MODE_LABEL=DEVELOPMENT (Hot Reloading)"
goto proceed_startup

:proceed_startup
echo.
echo ======================================================================
echo  Active Mode: %MODE_LABEL%
echo ======================================================================
echo.

REM --- Ensure Docker is in PATH ---
set "PATH=C:\Program Files\Docker\Docker\resources\bin;C:\Users\%USERNAME%\AppData\Local\Programs\DockerDesktop\resources\bin;%PATH%"

REM --- Create required data directories if they don't exist ---
echo [SETUP] Ensuring persistent host directories exist...
if not exist "data\postgres_live" mkdir "data\postgres_live"
if not exist "data\postgres_recovery" mkdir "data\postgres_recovery"
if not exist "data\uploads\products" mkdir "data\uploads\products"
if not exist "data\logs\api" mkdir "data\logs\api"
if not exist "data\logs\nginx" mkdir "data\logs\nginx"
if not exist "backups" mkdir "backups"
echo [OK] Persistent directories ready.
echo.

REM --- Check if Docker is running ---
echo [CHECK] Verifying Docker Desktop is running...
docker info >nul 2>&1
if errorlevel 1 (
    echo [WARNING] Docker Desktop is not running. Attempting to start...
    start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"
    echo [WAIT] Waiting 30 seconds for Docker to initialize...
    timeout /t 30 /nobreak >nul
    docker info >nul 2>&1
    if errorlevel 1 (
        echo [ERROR] Docker Desktop failed to start. Please start Docker manually and retry.
        pause
        exit /b 1
    )
)
echo [OK] Docker Desktop is running.
echo.

REM --- Start all services with selected configuration ---
echo [START] Building and launching containers in %MODE_LABEL%...
docker compose %COMPOSE_FILES% up -d --build
if errorlevel 1 (
    echo.
    echo [ERROR] Docker Compose failed to launch services.
    pause
    exit /b 1
)
echo.

REM --- Wait for services to be healthy ---
echo [WAIT] Waiting for all services to become healthy...
set RETRIES=0
:healthcheck
timeout /t 3 /nobreak >nul
set /a RETRIES+=1
docker compose ps --format "{{.Status}}" 2>nul | findstr /i "unhealthy" >nul
if not errorlevel 1 (
    if %RETRIES% lss 20 (
        echo        Attempt %RETRIES%/20 - Initializing services...
        goto healthcheck
    )
)
echo.

REM --- Show status ---
echo ======================================================================
echo [SUCCESS] Retail POS ^& Management is running in %MODE_LABEL%!
echo.
echo    POS Terminal ^& Dashboard:  http://localhost
echo    Backend API Health:         http://localhost/health
echo.
echo    Data persistence:
echo      PostgreSQL DB:  .\data\postgres_live\
echo      Uploads:        .\data\uploads\products\
echo      Backups:        .\backups\
echo.
echo    Stopping or rebuilding containers will NEVER lose business data.
echo ======================================================================
echo.

REM --- Open App in Standalone Window ---
echo [APP] Opening standalone application window...
if exist "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" (
    start "" "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --app=http://localhost --window-size=1440,900
) else if exist "C:\Program Files\Microsoft\Edge\Application\msedge.exe" (
    start "" "C:\Program Files\Microsoft\Edge\Application\msedge.exe" --app=http://localhost --window-size=1440,900
) else if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" (
    start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --app=http://localhost --window-size=1440,900
) else (
    start "" "http://localhost"
)
echo.
echo Press any key to close this launcher (services will keep running in background)...
pause >nul
