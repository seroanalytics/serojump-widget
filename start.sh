#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🧬 SeroJump WebAssembly Server${NC}"
echo "=============================="

# Check if server exists
if [ ! -f "build/serojump_server" ]; then
    echo -e "${RED}❌ Server not found. Building first...${NC}"
    ./build.sh
    echo ""
fi

# Check again after build
if [ ! -f "build/serojump_server" ]; then
    echo -e "${RED}❌ Failed to build server${NC}"
    exit 1
fi

# Check if web files exist
WEB_FILES_EXIST=false
if [ -f "web/index.html" ]; then
    WEB_FILES_EXIST=true
fi

if [ "$WEB_FILES_EXIST" = false ]; then
    echo -e "${YELLOW}⚠️  Web files not found. Creating minimal web interface...${NC}"
    mkdir -p web
    # We'll create the web interface files next
fi

echo -e "${GREEN}🚀 Starting SeroJump server...${NC}"
echo ""

# Start the server
./build/serojump_server

# The server will handle the rest

