#include <iostream>
#include <fstream>
#include <sstream>
#include <string>
#include <thread>
#include <chrono>
#include <cstring>
#include <map>

#ifdef _WIN32
    #include <winsock2.h>
    #include <ws2tcpip.h>
    #pragma comment(lib, "ws2_32.lib")
#else
    #include <sys/socket.h>
    #include <netinet/in.h>
    #include <unistd.h>
    #include <arpa/inet.h>
#endif

class SimpleHTTPServer {
private:
    int server_socket;
    bool running;
    const int PORT = 1010;
    
    std::map<std::string, std::string> mimeTypes = {
        {".html", "text/html"},
        {".js", "application/javascript"},
        {".wasm", "application/wasm"},
        {".css", "text/css"},
        {".csv", "text/csv"},
        {".png", "image/png"},
        {".jpg", "image/jpeg"},
        {".jpeg", "image/jpeg"},
        {".gif", "image/gif"},
        {".svg", "image/svg+xml"}
    };
    
    std::string getFileExtension(const std::string& filename) {
        size_t dot = filename.find_last_of('.');
        if (dot != std::string::npos) {
            return filename.substr(dot);
        }
        return "";
    }
    
    std::string getMimeType(const std::string& filename) {
        std::string ext = getFileExtension(filename);
        auto it = mimeTypes.find(ext);
        if (it != mimeTypes.end()) {
            return it->second;
        }
        return "text/plain";
    }
    
    std::string readFile(const std::string& filename) {
        std::ifstream file(filename, std::ios::binary);
        if (!file.is_open()) {
            return "";
        }
        
        std::stringstream buffer;
        buffer << file.rdbuf();
        return buffer.str();
    }
    
    void handleRequest(int client_socket) {
        char buffer[1024] = {0};
        ssize_t bytes_read = recv(client_socket, buffer, 1023, 0);
        
        if (bytes_read <= 0) {
            return;
        }
        
        std::string request(buffer, bytes_read);
        
        // Parse the request
        std::istringstream request_stream(request);
        std::string method, path, version;
        request_stream >> method >> path >> version;
        
        std::cout << "📡 " << method << " " << path << std::endl;
        
        // Default to index.html
        if (path == "/" || path.empty()) {
            path = "/index.html";
        }
        
        // Security: prevent directory traversal
        if (path.find("..") != std::string::npos) {
            sendNotFound(client_socket);
            return;
        }
        
        // Construct file path (web directory)
        std::string filepath = "web" + path;
        
        // Try to read the file
        std::string content = readFile(filepath);
        
        if (content.empty()) {
            sendNotFound(client_socket);
            return;
        }
        
        // Send response
        std::string mime_type = getMimeType(filepath);
        sendResponse(client_socket, content, mime_type);
    }
    
    void sendResponse(int client_socket, const std::string& content, const std::string& mime_type) {
        std::stringstream response;
        response << "HTTP/1.1 200 OK\r\n";
        response << "Content-Type: " << mime_type << "\r\n";
        response << "Content-Length: " << content.length() << "\r\n";
        response << "Access-Control-Allow-Origin: *\r\n";
        response << "Cache-Control: no-cache\r\n";
        response << "\r\n";
        response << content;
        
        std::string response_str = response.str();
        send(client_socket, response_str.c_str(), response_str.length(), 0);
    }
    
    void sendNotFound(int client_socket) {
        std::string response = "HTTP/1.1 404 Not Found\r\n"
                             "Content-Type: text/html\r\n"
                             "Content-Length: 47\r\n"
                             "\r\n"
                             "<html><body><h1>404 Not Found</h1></body></html>";
        send(client_socket, response.c_str(), response.length(), 0);
    }

public:
    bool start() {
        #ifdef _WIN32
        WSADATA wsaData;
        if (WSAStartup(MAKEWORD(2, 2), &wsaData) != 0) {
            std::cerr << "WSAStartup failed" << std::endl;
            return false;
        }
        #endif
        
        server_socket = socket(AF_INET, SOCK_STREAM, 0);
        if (server_socket < 0) {
            std::cerr << "Failed to create socket" << std::endl;
            return false;
        }
        
        // Reuse address to avoid "Address already in use" error
        int opt = 1;
        setsockopt(server_socket, SOL_SOCKET, SO_REUSEADDR, (char*)&opt, sizeof(opt));
        
        sockaddr_in server_addr = {};
        server_addr.sin_family = AF_INET;
        server_addr.sin_addr.s_addr = INADDR_ANY;
        server_addr.sin_port = htons(PORT);
        
        if (bind(server_socket, (struct sockaddr*)&server_addr, sizeof(server_addr)) < 0) {
            std::cerr << "Failed to bind to port " << PORT << std::endl;
            return false;
        }
        
        if (listen(server_socket, 10) < 0) {
            std::cerr << "Failed to listen on socket" << std::endl;
            return false;
        }
        
        running = true;
        
        std::cout << "\n🧬 SeroJump WebAssembly Server" << std::endl;
        std::cout << "🌐 Server running on http://localhost:" << PORT << std::endl;
        std::cout << "📁 Serving files from ./web/ directory" << std::endl;
        std::cout << "⚡ Ready for individual antibody trajectory analysis!" << std::endl;
        std::cout << "\nPress Ctrl+C to stop the server...\n" << std::endl;
        
        return true;
    }
    
    void run() {
        while (running) {
            sockaddr_in client_addr = {};
            socklen_t client_addr_len = sizeof(client_addr);
            
            int client_socket = accept(server_socket, (struct sockaddr*)&client_addr, &client_addr_len);
            if (client_socket < 0) {
                if (running) {
                    std::cerr << "Failed to accept connection" << std::endl;
                }
                continue;
            }
            
            // Handle request in a separate thread for concurrency
            std::thread client_thread([this, client_socket]() {
                this->handleRequest(client_socket);
                #ifdef _WIN32
                closesocket(client_socket);
                #else
                close(client_socket);
                #endif
            });
            client_thread.detach();
        }
    }
    
    void stop() {
        running = false;
        #ifdef _WIN32
        closesocket(server_socket);
        WSACleanup();
        #else
        close(server_socket);
        #endif
    }
    
    ~SimpleHTTPServer() {
        stop();
    }
};

int main() {
    SimpleHTTPServer server;
    
    if (!server.start()) {
        std::cerr << "❌ Failed to start server" << std::endl;
        return 1;
    }
    
    server.run();
    
    return 0;
}
