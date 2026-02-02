#!/usr/bin/env bash
set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Get the script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$SCRIPT_DIR/server"
CLIENTS_DIR="$SCRIPT_DIR/clients"

# PID file and log locations
PIDS_DIR="$SCRIPT_DIR/.dev-pids"
LOGS_DIR="$SCRIPT_DIR/.dev-logs"
mkdir -p "$PIDS_DIR"
mkdir -p "$LOGS_DIR"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Polar Development Environment${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Function to cleanup on exit
cleanup() {
    echo -e "\n${YELLOW}Shutting down services...${NC}"
    
    for service in api worker frontend; do
        if [ -f "$PIDS_DIR/$service.pid" ]; then
            PGID=$(cat "$PIDS_DIR/$service.pid")
            # Kill the entire process group
            kill -- -$PGID 2>/dev/null || true
            rm -f "$PIDS_DIR/$service.pid"
            echo -e "  Stopped $service"
        fi
    done
    
    echo -e "${GREEN}All services stopped${NC}"
    exit 0
}

trap cleanup SIGINT SIGTERM EXIT

# Function to start a service in a new process group
start_service() {
    local name=$1
    local dir=$2
    local cmd=$3
    local log_file="$LOGS_DIR/$name.log"
    
    cd "$dir"
    # Start in new process group using setsid
    setsid bash -c "$cmd" > "$log_file" 2>&1 &
    local PID=$!
    echo $PID > "$PIDS_DIR/$name.pid"
    echo $PID
}

# Step 1: Start Docker services
echo -e "${BLUE}[1/5]${NC} Starting Docker services (PostgreSQL, Redis, MinIO)..."
cd "$SERVER_DIR"
if docker compose ps 2>/dev/null | grep -q "Up"; then
    echo -e "${YELLOW}  → Docker services already running${NC}"
else
    docker compose up -d
    echo -e "${GREEN}  ✓ Docker services started${NC}"
fi

# Wait for database to be ready
echo -e "  Waiting for PostgreSQL to be ready..."
for i in {1..30}; do
    if docker compose exec -T db pg_isready -U polar > /dev/null 2>&1; then
        echo -e "${GREEN}  ✓ PostgreSQL is ready${NC}"
        break
    fi
    if [ $i -eq 30 ]; then
        echo -e "${YELLOW}  → Proceeding without confirmation (timeout)${NC}"
    fi
    sleep 1
done

# Step 2: Apply database migrations
echo -e "${BLUE}[2/5]${NC} Applying database migrations..."
cd "$SERVER_DIR"
uv run task db_migrate
echo -e "${GREEN}  ✓ Migrations applied${NC}"

# Step 3: Start API server
echo -e "${BLUE}[3/5]${NC} Starting API server..."
API_PID=$(start_service "api" "$SERVER_DIR" "uv run task api")
echo -e "${GREEN}  ✓ API server started (PGID: $API_PID)${NC}"
echo -e "     Logs: .dev-logs/api.log"
echo -e "     URL: ${BLUE}http://127.0.0.1:8000${NC}"

# Wait a moment for API to initialize
sleep 2

# Step 4: Start worker
echo -e "${BLUE}[4/5]${NC} Starting worker..."
WORKER_PID=$(start_service "worker" "$SERVER_DIR" "uv run task worker")
echo -e "${GREEN}  ✓ Worker started (PGID: $WORKER_PID)${NC}"
echo -e "     Logs: .dev-logs/worker.log"

# # Step 5: Start frontend
# echo -e "${BLUE}[5/5]${NC} Starting frontend..."
# FRONTEND_PID=$(start_service "frontend" "$CLIENTS_DIR" "pnpm dev-web")
# echo -e "${GREEN}  ✓ Frontend started (PGID: $FRONTEND_PID)${NC}"
# echo -e "     Logs: .dev-logs/frontend.log"
# echo -e "     URL: ${BLUE}http://127.0.0.1:3000${NC}"

# Wait for services to be ready
echo ""
echo -e "${YELLOW}Waiting for services to be ready...${NC}"
sleep 3

# Check if services are running
check_service() {
    local name=$1
    local pid_file="$PIDS_DIR/$name.pid"
    if [ -f "$pid_file" ]; then
        local PGID=$(cat "$pid_file")
        if ps -p $PGID > /dev/null 2>&1; then
            return 0
        fi
    fi
    return 1
}

ALL_OK=true
for service in api worker frontend; do
    if check_service "$service"; then
        echo -e "  ${GREEN}✓${NC} $service is running"
    else
        echo -e "  ${RED}✗${NC} $service failed to start"
        echo -e "    Check logs: tail -f .dev-logs/$service.log"
        ALL_OK=false
    fi
done

echo ""
if [ "$ALL_OK" = true ]; then
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}  All services started successfully!${NC}"
    echo -e "${GREEN}========================================${NC}"
else
    echo -e "${YELLOW}========================================${NC}"
    echo -e "${YELLOW}  Some services failed to start${NC}"
    echo -e "${YELLOW}========================================${NC}"
fi
echo ""
echo -e "Services:"
echo -e "  • API:      ${BLUE}http://127.0.0.1:8000${NC}"
echo -e "  • Frontend: ${BLUE}http://127.0.0.1:3000${NC}"
echo ""
echo -e "Logs:"
echo -e "  • API:      tail -f .dev-logs/api.log"
echo -e "  • Worker:   tail -f .dev-logs/worker.log"
echo -e "  • Frontend: tail -f .dev-logs/frontend.log"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop all services${NC}"
echo ""

# Keep the script running and tail all logs
tail -f "$LOGS_DIR/api.log" "$LOGS_DIR/worker.log" "$LOGS_DIR/frontend.log" 2>/dev/null
