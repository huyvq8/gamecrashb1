@echo off
setlocal ENABLEDELAYEDEXPANSION

REM Paths
set "ROOT=F:\GameB\gamecrashb1"
set "BACKEND=%ROOT%\backend"
set "FRONTEND=%ROOT%\frontend"

echo.
echo === Crash Game: Start Backend and Frontend ===
echo Root: %ROOT%
echo.

REM Optional: bootstrap installs in separate windows if node_modules is missing
if not exist "%BACKEND%\node_modules" (
  start "Install Backend Deps" /D "%BACKEND%" cmd /K "npm install --no-audit --no-fund"
)
if not exist "%FRONTEND%\node_modules" (
  start "Install Frontend Deps" /D "%FRONTEND%" cmd /K "npm install --no-audit --no-fund"
)

REM Start Backend (Fastify on port 3000)
echo Starting Backend...
start "Crash Backend" /D "%BACKEND%" cmd /K "npm run dev"

REM Start Frontend (Vite dev server)
echo Starting Frontend...
start "Crash Frontend" /D "%FRONTEND%" cmd /K "npm run dev -- --open"

echo.
echo Launched two terminals:
echo  - Crash Backend (http://localhost:3000)
echo  - Crash Frontend (Vite dev server)
echo.
echo Close this window if you don't need it.

endlocal
exit /B 0

