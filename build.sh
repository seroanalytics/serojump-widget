#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🧬 SeroJump WebAssembly Build Script${NC}"
echo "======================================"

# Check if build directory exists
if [ ! -d "build" ]; then
    echo -e "${YELLOW}📁 Creating build directory...${NC}"
    mkdir -p build
fi

# Build native server first
echo -e "${BLUE}🚀 Building native C++ server...${NC}"
cd build
cmake .. -DCMAKE_BUILD_TYPE=Release
if make serojump_server; then
    echo -e "${GREEN}✅ Native server built successfully!${NC}"
else
    echo -e "${RED}❌ Failed to build native server${NC}"
    exit 1
fi
cd ..

# Check if emsdk is available
if command -v emcc &> /dev/null; then
    echo -e "${BLUE}🌊 Building WebAssembly module...${NC}"
    
    # Create web output directory
    mkdir -p build/web
    
    # Build with Emscripten
    cd build
    emcmake cmake .. -DCMAKE_BUILD_TYPE=Release
    if emmake make serojump_module; then
        echo -e "${GREEN}✅ WebAssembly module built successfully!${NC}"
        
        # Copy the generated files to web directory
        if [ -f "web/serojump_module.js" ] && [ -f "web/serojump_module.wasm" ]; then
            echo -e "${GREEN}📦 WebAssembly files generated:${NC}"
            echo "   - serojump_module.js"
            echo "   - serojump_module.wasm"
        else
            echo -e "${YELLOW}⚠️  Warning: Expected WASM files not found in web directory${NC}"
        fi
    else
        echo -e "${RED}❌ Failed to build WebAssembly module${NC}"
        exit 1
    fi
    cd ..
else
    echo -e "${YELLOW}⚠️  Warning: Emscripten not found. Skipping WebAssembly build.${NC}"
    echo "To install Emscripten:"
    echo "1. Clone emsdk: git clone https://github.com/emscripten-core/emsdk.git"
    echo "2. Run: ./emsdk/emsdk install latest && ./emsdk/emsdk activate latest"
    echo "3. Source: source ./emsdk/emsdk_env.sh"
fi

echo ""
echo -e "${GREEN}🎉 Build completed!${NC}"

if [ -f "build/serojump_server" ]; then
    echo -e "${BLUE}▶️  To start the server: ./start.sh${NC}"
else
    echo -e "${RED}❌ Server binary not found${NC}"
fi

