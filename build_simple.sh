#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🧬 SeroJump WebAssembly Simple Build Script${NC}"
echo "=============================================="

# Check if build directory exists
if [ ! -d "build" ]; then
    echo -e "${YELLOW}📁 Creating build directory...${NC}"
    mkdir -p build
fi

# Build native server first using direct g++
echo -e "${BLUE}🚀 Building native C++ server...${NC}"

if g++ -std=c++17 -O2 -pthread -o build/serojump_server src/server.cpp; then
    echo -e "${GREEN}✅ Native server built successfully!${NC}"
else
    echo -e "${RED}❌ Failed to build native server${NC}"
    echo "Trying with clang++..."
    if clang++ -std=c++17 -O2 -pthread -o build/serojump_server src/server.cpp; then
        echo -e "${GREEN}✅ Native server built successfully with clang++!${NC}"
    else
        echo -e "${RED}❌ Failed to build native server with both g++ and clang++${NC}"
        exit 1
    fi
fi

# Check if emsdk is available for WebAssembly build
if command -v emcc &> /dev/null; then
    echo -e "${BLUE}🌊 Building WebAssembly module...${NC}"
    
    # Create web output directory
    mkdir -p build/web
    
    # Build with Emscripten
    if emcc -std=c++17 -O2 \
        -s WASM=1 \
        -s 'EXPORTED_RUNTIME_METHODS=["ccall","cwrap"]' \
        -s 'EXPORTED_FUNCTIONS=["_malloc","_free"]' \
        -s ALLOW_MEMORY_GROWTH=1 \
        -s NO_EXIT_RUNTIME=1 \
        -s MODULARIZE=1 \
        -s 'EXPORT_NAME="createSeroJumpModule"' \
        -s STACK_SIZE=1MB \
        -s TOTAL_MEMORY=64MB \
        --no-entry \
        -o build/web/serojump_module.js \
        src/serojump.cpp; then
        
        echo -e "${GREEN}✅ WebAssembly module built successfully!${NC}"
        
        # Check if generated files exist
        if [ -f "build/web/serojump_module.js" ] && [ -f "build/web/serojump_module.wasm" ]; then
            echo -e "${GREEN}📦 WebAssembly files generated:${NC}"
            echo "   - serojump_module.js"
            echo "   - serojump_module.wasm"
            
            # Copy web files to build directory
            cp web/* build/web/ 2>/dev/null || true
            echo -e "${GREEN}📋 Web interface files copied to build/web/${NC}"
        else
            echo -e "${YELLOW}⚠️  Warning: Expected WASM files not found${NC}"
        fi
    else
        echo -e "${RED}❌ Failed to build WebAssembly module${NC}"
        exit 1
    fi
else
    echo -e "${YELLOW}⚠️  Warning: Emscripten not found. Skipping WebAssembly build.${NC}"
    echo "WebAssembly module will not be available."
    echo ""
    echo "To install Emscripten:"
    echo "1. Clone emsdk: git clone https://github.com/emscripten-core/emsdk.git"
    echo "2. Run: ./emsdk/emsdk install latest && ./emsdk/emsdk activate latest"
    echo "3. Source: source ./emsdk/emsdk_env.sh"
fi

echo ""
echo -e "${GREEN}🎉 Build completed!${NC}"

if [ -f "build/serojump_server" ]; then
    echo -e "${BLUE}▶️  To start the server: ./start.sh${NC}"
    echo -e "${BLUE}🌐 Then visit: http://localhost:2020${NC}"
else
    echo -e "${RED}❌ Server binary not found${NC}"
fi
