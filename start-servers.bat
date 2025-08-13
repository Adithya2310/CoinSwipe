@echo off
REM CoinSwipe Development Server Starter
REM Starts both the Node.js backend server and Next.js frontend

echo 🚀 Starting CoinSwipe Development Servers...
echo.

REM Check if ports are available
echo 📡 Checking if ports are available...
netstat -an | findstr :3001 >nul
if %ERRORLEVEL%==0 (
    echo ❌ Port 3001 is already in use (Frontend)
    echo    Please stop the existing process or change the port
    pause
    exit /b 1
)

netstat -an | findstr :3002 >nul
if %ERRORLEVEL%==0 (
    echo ❌ Port 3002 is already in use (Backend)
    echo    Please stop the existing process or change the port
    pause
    exit /b 1
)

echo ✅ Ports 3001 and 3002 are available

REM Create environment file for frontend if it doesn't exist
if not exist "application\.env.local" (
    echo 📝 Creating frontend environment file...
    echo NEXT_PUBLIC_BACKEND_URL=http://localhost:3002 > application\.env.local
    echo ✅ Created application\.env.local
)

REM Create environment file for backend if it doesn't exist
if not exist "server\.env" (
    echo 📝 Creating backend environment file...
    echo PORT=3002 > server\.env
    echo NODE_ENV=development >> server\.env
    echo CORS_ORIGIN=http://localhost:3000 >> server\.env
    echo WEBSOCKET_UPDATE_INTERVAL=2000 >> server\.env
    echo LOG_LEVEL=info >> server\.env
    echo ✅ Created server\.env
)

echo.
echo 🔧 Installing dependencies...

REM Install backend dependencies
echo 📦 Installing backend dependencies...
cd server
if not exist "node_modules" (
    call npm install
    if %ERRORLEVEL% neq 0 (
        echo ❌ Failed to install backend dependencies
        cd ..
        pause
        exit /b 1
    )
)
cd ..

REM Install frontend dependencies
echo 📦 Installing frontend dependencies...
cd application
if not exist "node_modules" (
    call npm install
    if %ERRORLEVEL% neq 0 (
        echo ❌ Failed to install frontend dependencies
        cd ..
        pause
        exit /b 1
    )
)
cd ..

echo.
echo 🚀 Starting servers...

REM Start backend server in new window
echo 🖥️  Starting Node.js Backend Server (Port 3002)...
start "CoinSwipe Backend" cmd /c "cd server && npm run dev"

REM Wait a moment for backend to start
timeout /t 3 /nobreak >nul

REM Start frontend server in new window
echo 🌐 Starting Next.js Frontend Server (Port 3001)...
start "CoinSwipe Frontend" cmd /c "cd application && npm run dev"

echo.
echo ✅ Both servers are starting up!
echo.
echo 📊 Backend Server:  http://localhost:3002
echo 🌐 Frontend App:    http://localhost:3000
echo 🔌 WebSocket:       ws://localhost:3002/socket.io
echo.
echo 💡 Tips:
echo    - Backend logs will show WebSocket connections
echo    - Frontend will connect to backend automatically
echo    - Check console logs for connection status
echo.
echo 🛑 To stop servers: Close the terminal windows or press Ctrl+C in each
echo.
pause
