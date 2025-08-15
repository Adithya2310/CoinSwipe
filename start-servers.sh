#!/bin/bash

# CoinSwipe Development Server Starter
# Starts both the Node.js backend server and Next.js frontend

echo "🚀 Starting CoinSwipe Development Servers..."
echo

# Check if ports are available
echo "📡 Checking if ports are available..."

if lsof -Pi :3001 -sTCP:LISTEN -t >/dev/null ; then
    echo "❌ Port 3001 is already in use (Frontend)"
    echo "   Please stop the existing process or change the port"
    exit 1
fi

if lsof -Pi :3002 -sTCP:LISTEN -t >/dev/null ; then
    echo "❌ Port 3002 is already in use (Backend)"
    echo "   Please stop the existing process or change the port"
    exit 1
fi

echo "✅ Ports 3001 and 3002 are available"

# Create environment file for frontend if it doesn't exist
if [ ! -f "application/.env.local" ]; then
    echo "📝 Creating frontend environment file..."
    echo "NEXT_PUBLIC_BACKEND_URL=http://localhost:3002" > application/.env.local
    echo "✅ Created application/.env.local"
fi

# Create environment file for backend if it doesn't exist
if [ ! -f "server/.env" ]; then
    echo "📝 Creating backend environment file..."
    cat > server/.env << EOF
PORT=3002
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000
WEBSOCKET_UPDATE_INTERVAL=2000
LOG_LEVEL=info
EOF
    echo "✅ Created server/.env"
fi

echo
echo "🔧 Installing dependencies..."

# Install backend dependencies
echo "📦 Installing backend dependencies..."
cd server
if [ ! -d "node_modules" ]; then
    npm install
    if [ $? -ne 0 ]; then
        echo "❌ Failed to install backend dependencies"
        exit 1
    fi
fi
cd ..

# Install frontend dependencies
echo "📦 Installing frontend dependencies..."
cd application
if [ ! -d "node_modules" ]; then
    npm install
    if [ $? -ne 0 ]; then
        echo "❌ Failed to install frontend dependencies"
        exit 1
    fi
fi
cd ..

echo
echo "🚀 Starting servers..."

# Function to cleanup processes on exit
cleanup() {
    echo
    echo "🛑 Stopping servers..."
    if [ ! -z "$BACKEND_PID" ]; then
        kill $BACKEND_PID 2>/dev/null
    fi
    if [ ! -z "$FRONTEND_PID" ]; then
        kill $FRONTEND_PID 2>/dev/null
    fi
    echo "✅ Servers stopped"
    exit 0
}

# Set up trap to cleanup on script exit
trap cleanup SIGINT SIGTERM

# Start backend server in background
echo "🖥️  Starting Node.js Backend Server (Port 3002)..."
cd server
npm run dev &
BACKEND_PID=$!
cd ..

# Wait a moment for backend to start
sleep 3

# Start frontend server in background
echo "🌐 Starting Next.js Frontend Server (Port 3001)..."
cd application
npm run dev &
FRONTEND_PID=$!
cd ..

echo
echo "✅ Both servers are running!"
echo
echo "📊 Backend Server:  http://localhost:3002"
echo "🌐 Frontend App:    http://localhost:3000"
echo "🔌 WebSocket:       ws://localhost:3002/socket.io"
echo
echo "💡 Tips:"
echo "   - Backend logs will show WebSocket connections"
echo "   - Frontend will connect to backend automatically"
echo "   - Check console logs for connection status"
echo
echo "🛑 Press Ctrl+C to stop both servers"
echo

# Wait for processes to finish
wait $BACKEND_PID $FRONTEND_PID
