@echo off
setlocal EnableDelayedExpansion
title Flashcard App - Inicio
echo ========================================================
echo    Flashcard App Personal ("Anki, pero mejor")
echo ========================================================
echo.

REM Ir al directorio del script
cd /d "%~dp0"

REM Crear carpetas de datos si no existen
if not exist "data" mkdir data
if not exist "data\sync" mkdir data\sync

REM Limpiar instancias huérfanas previas si quedaron abiertas
taskkill /fi "windowtitle eq Flashcard API*" /t /f >nul 2>&1
taskkill /fi "windowtitle eq Flashcard Frontend*" /t /f >nul 2>&1

REM Verificar Python
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python no encontrado en el sistema.
    echo Por favor instala Python 3.11+ desde https://python.org
    pause
    exit /b 1
)

REM Crear entorno virtual si no existe
if not exist "backend\.venv" (
    echo [1/4] Creando entorno virtual Python en backend\.venv...
    python -m venv backend\.venv
)

REM Activar entorno virtual e instalar dependencias
echo [2/4] Verificando dependencias Python...
call backend\.venv\Scripts\activate.bat
python -m pip install -q -e backend\.[dev]

REM Verificar Node.js
node --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js no encontrado.
    echo Por favor instala Node.js 18+ desde https://nodejs.org
    pause
    exit /b 1
)

REM Instalar dependencias del frontend si es necesario
if not exist "frontend\node_modules" (
    echo [3/4] Instalando dependencias de frontend (npm install)...
    cd frontend
    call npm install
    cd ..
)

REM Cargar variables de entorno de .env
if exist ".env" (
    for /f "usebackq tokens=1,* delims==" %%a in (".env") do (
        set "line=%%a"
        if not "!line:~0,1!"=="#" (
            if not "%%a"=="" set "%%a=%%b"
        )
    )
)

if "%FLASHCARD_API_PORT%"=="" set FLASHCARD_API_PORT=8001
if "%SYNC_PORT%"=="" set SYNC_PORT=8080
if "%FLASHCARD_API_HOST%"=="" set FLASHCARD_API_HOST=0.0.0.0

REM Asegurar que los puertos estén libres antes de iniciar
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":%FLASHCARD_API_PORT% " ^| findstr "LISTENING"') do taskkill /f /pid %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5173 " ^| findstr "LISTENING"') do taskkill /f /pid %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":%SYNC_PORT% " ^| findstr "LISTENING"') do taskkill /f /pid %%a >nul 2>&1

echo.
echo [4/4] Iniciando servicios de la aplicacion...

REM Iniciar API Backend (que incluye el servidor de sincronizacion Anki)
start "Flashcard API" cmd /c "backend\.venv\Scripts\python.exe -m uvicorn app.main:app --host %FLASHCARD_API_HOST% --port %FLASHCARD_API_PORT% --app-dir backend || (echo. && echo [ERROR] El servidor backend se detuvo. Revisa los errores arriba. && pause)"

REM Iniciar Frontend Vite en modo host para acceso LAN
cd frontend
start "Flashcard Frontend" cmd /c "npm run dev || (echo. && echo [ERROR] El servidor frontend se detuvo. && pause)"
cd ..

REM Esperar 3 segundos para que los procesos inicialicen
timeout /t 3 /nobreak >nul

echo.
echo ========================================================
echo    Servicios activos y listos para usar:
echo ========================================================
echo.
echo    - Aplicacion Web (Frontend): http://localhost:5173
echo    - API REST Backend:         http://localhost:%FLASHCARD_API_PORT%
echo    - Servidor Sync Anki:       http://localhost:%SYNC_PORT%
echo.
echo    Acceso desde tu movil u otros dispositivos en red local:
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do (
    set "ip=%%a"
    set "ip=!ip: =!"
    echo       http://!ip!:5173
)
echo.
echo    Para detener la aplicacion, presiona cualquier tecla.
echo ========================================================
pause >nul

echo.
echo Deteniendo servicios...
taskkill /fi "windowtitle eq Flashcard API*" /t /f >nul 2>&1
taskkill /fi "windowtitle eq Flashcard Frontend*" /t /f >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":%FLASHCARD_API_PORT% " ^| findstr "LISTENING"') do taskkill /f /pid %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5173 " ^| findstr "LISTENING"') do taskkill /f /pid %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":%SYNC_PORT% " ^| findstr "LISTENING"') do taskkill /f /pid %%a >nul 2>&1
echo Todos los procesos detenidos con exito.
