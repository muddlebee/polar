#!/usr/bin/env bash
set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get the script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PIDS_DIR="$SCRIPT_DIR/.dev-pids"

echo -e "${BLUE}Stopping Polar development services...${NC}"
echo ""

# Stop API server
if [ -f "$PIDS_DIR/api.pid" ]; then
    PID=$(cat "$PIDS_DIR/api.pid")
    if kill -0 $PID 2>/dev/null; then
        kill $PID
        echo -e "${GREEN}✓${NC} Stopped API server (PID: $PID)"
    fi
    rm "$PIDS_DIR/api.pid"
fi

# Stop worker
if [ -f "$PIDS_DIR/worker.pid" ]; then
    PID=$(cat "$PIDS_DIR/worker.pid")
    if kill -0 $PID 2>/dev/null; then
        kill $PID
        echo -e "${GREEN}✓${NC} Stopped worker (PID: $PID)"
    fi
    rm "$PIDS_DIR/worker.pid"
fi

# Stop frontend
if [ -f "$PIDS_DIR/frontend.pid" ]; then
    PID=$(cat "$PIDS_DIR/frontend.pid")
    if kill -0 $PID 2>/dev/null; then
        kill $PID
        echo -e "${GREEN}✓${NC} Stopped frontend (PID: $PID)"
    fi
    rm "$PIDS_DIR/frontend.pid"
fi

# Optionally stop Docker services
echo ""
read -p "Do you want to stop Docker services? (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    cd "$SCRIPT_DIR/server"
    docker compose down
    echo -e "${GREEN}✓${NC} Stopped Docker services"
fi

echo ""
echo -e "${GREEN}All services stopped${NC}"
