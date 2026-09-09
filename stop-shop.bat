@echo off
title Al-Noor Retail Shop POS - Stopping...
color 0E
echo.
echo ======================================================================
echo           AL-NOOR RETAIL SHOP MANAGEMENT SYSTEM (KSA)
echo           Safely Stopping Services
echo ======================================================================
echo.
echo This will stop the POS system, API server, and databases.
echo.
echo    YOUR DATA IS SAFE. All data is stored on this computer at:
echo      Database:       .\data\postgres_live\
echo      Product Images: .\data\uploads\products\
echo      Backups:        .\backups\
echo.
echo    You can restart anytime using start-shop.bat
echo.

set /p CONFIRM="Are you sure you want to stop? (Y/N): "
if /i not "%CONFIRM%"=="Y" (
    echo.
    echo [CANCELLED] Services will continue running.
    pause
    exit /b 0
)

echo.
set "PATH=C:\Program Files\Docker\Docker\resources\bin;C:\Users\%USERNAME%\AppData\Local\Programs\DockerDesktop\resources\bin;%PATH%"

echo [STOP] Gracefully stopping all services...
docker compose down

echo.
echo ======================================================================
echo [DONE] All services stopped safely.
echo.
echo    Your database and all business data remain intact on disk.
echo    Run start-shop.bat to restart the system.
echo ======================================================================
echo.
pause
