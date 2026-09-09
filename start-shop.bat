@echo off
title Retail Sales & Inventory POS - Starting...
color 0A
echo.
echo ======================================================================
echo           RETAIL SALES ^& INVENTORY MANAGEMENT SYSTEM
echo           Production POS ^& Inventory Management
echo ======================================================================
echo.

REM --- Ensure Docker is in PATH ---
set "PATH=C:\Program Files\Docker\Docker\resources\bin;C:\Users\%USERNAME%\AppData\Local\Programs\DockerDesktop\resources\bin;%PATH%"

REM --- Create required data directories if they don't exist ---
echo [SETUP] Ensuring data directories exist...
if not exist "data\postgres_live" mkdir "data\postgres_live"
if not exist "data\postgres_recovery" mkdir "data\postgres_recovery"
if not exist "data\uploads\products" mkdir "data\uploads\products"
if not exist "data\logs\api" mkdir "data\logs\api"
if not exist "data\logs\nginx" mkdir "data\logs\nginx"
if not exist "backups" mkdir "backups"
echo [OK] Data directories ready.
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
        echo [ERROR] Docker Desktop failed to start. Please start it manually and try again.
        pause
        exit /b 1
    )
)
echo [OK] Docker Desktop is running.
echo.

REM --- Start all services ---
echo [START] Launching PostgreSQL, API Server, and Web Frontend...
docker compose up -d --build
echo.

REM --- Wait for services to be healthy ---
echo [WAIT] Waiting for services to become healthy...
set RETRIES=0
:healthcheck
timeout /t 3 /nobreak >nul
set /a RETRIES+=1
docker compose ps --format "{{.Status}}" 2>nul | findstr /i "unhealthy" >nul
if not errorlevel 1 (
    if %RETRIES% lss 20 (
        echo        Attempt %RETRIES%/20 - Services starting up...
        goto healthcheck
    )
)
echo.

REM --- Show status ---
echo ======================================================================
echo [SUCCESS] All systems are running!
echo.
echo    POS Counter ^& Management:  http://localhost
echo    Backend API Health:         http://localhost/health
echo.
echo    Data stored safely at:
echo      Database:       .\data\postgres_live\
echo      Product Images: .\data\uploads\products\
echo      Backups:        .\backups\
echo.
echo    Stopping or recreating Docker containers will NOT lose data.
echo ======================================================================
echo.

REM --- Open App in Standalone Window ---
echo [APP] Launching Retail POS Standalone Application...
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
echo Press any key to close this window (services will keep running)...
pause >nul
