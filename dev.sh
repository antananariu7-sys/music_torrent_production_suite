#!/bin/bash
# Development script to run the app in development mode

echo "Starting Music Production Suite in development mode..."

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi

# Build main process
echo "Building main process..."
npm run build:main

# Build preload
echo "Building preload..."
npm run build:preload

# Start Vite dev server in background
echo "Starting Vite dev server..."
npm run dev:renderer &
VITE_PID=$!

# Wait for Vite to be ready
sleep 3

# Start Electron
echo "Starting Electron..."
NODE_ENV=development electron .

# Cleanup: kill Vite server when Electron exits
kill $VITE_PID
