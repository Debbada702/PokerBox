@echo off
cd /d "%~dp0"
title PokerBox — server per il browser

echo.
echo  ============================================
echo    POKERBOX — GIOCA NEL BROWSER
echo    (Chrome, Edge, Firefox...)
echo  ============================================
echo.
echo  Il gioco NON e' un programma desktop: e' un sito web.
echo  Indirizzo: http://localhost:5173
echo.

if not exist "node_modules\" (
  echo  Prima volta: installazione...
  call npm install
  if errorlevel 1 (
    echo  Installa Node.js da https://nodejs.org
    pause
    exit /b 1
  )
)

echo  Avvio server e apertura browser...
echo  Lascia questa finestra aperta mentre giochi.
echo.

start "" cmd /c "ping 127.0.0.1 -n 4 >nul && start http://localhost:5173"

call npm run dev

pause
