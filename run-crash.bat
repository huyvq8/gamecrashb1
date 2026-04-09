@echo off
setlocal ENABLEDELAYEDEXPANSION

REM Thu muc chua file .bat (di chuyen project van chay duoc)
set "ROOT=%~dp0"
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"

cd /d "%ROOT%" || (
  echo Khong the cd vao: %ROOT%
  exit /b 1
)

where pnpm >nul 2>nul || (
  echo Can cai pnpm: npm install -g pnpm
  echo Hoac: corepack enable ^&^& corepack prepare pnpm@10.0.0 --activate
  pause
  exit /b 1
)

echo.
echo === Game Crash B1: Backend + Frontend ===
echo Root: %ROOT%
echo API/Socket proxy: http://localhost:3000
echo Giao dien:        http://localhost:5173
echo.

if not exist "%ROOT%\node_modules\" (
  echo Dang cai dependencies lan dau...
  pnpm install
  if errorlevel 1 (
    echo pnpm install that bai.
    pause
    exit /b 1
  )
)

echo Khoi dong Backend (Fastify + Socket.IO)...
start "GameCrash Backend" /D "%ROOT%" cmd /K "pnpm --filter @gamecrash/backend dev"

REM Doi backend len port 3000
ping -n 4 127.0.0.1 >nul

echo Khoi dong Frontend (Vite)...
start "GameCrash Frontend" /D "%ROOT%" cmd /K "pnpm --filter @gamecrash/frontend dev"

ping -n 6 127.0.0.1 >nul

echo Mo trinh duyet...
start "" "http://localhost:5173/"

echo.
echo Da mo 2 cua so: Backend va Frontend.
echo Dong tung cua so de tat dich vu tuong ung.
echo.
pause
endlocal
exit /b 0
