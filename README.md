# Multi-AI Chat (MAPB)

**Multi-AI Chat** (Code Name: MAPB - Multi AI Prompt Broadcaster) is an Electron-based desktop application designed to maximize productivity for users who utilize multiple AI services simultaneously.

This application allows you to enter a prompt once in a **Master Input** field and broadcast it to **ChatGPT**, **Claude**, and **Gemini** at the same time. You can compare the responses from each AI model in a single, unified interface.

![Multi-AI Chat Application Screenshot](assets/mutli-ai-chat.png)
*Figure 1: Multi-AI Chat Interface showing simultaneous interactions with ChatGPT, Claude, and Gemini.*

## 📋 Overview

-   **Project Name**: Multi-AI Chat
-   **Version**: v0.3.0
-   **Platform**: Windows 10/11 (64-bit)
-   **Tech Stack**: Electron, Node.js, HTML/CSS/JavaScript

### Supported Services (Phase 1)
-   [ChatGPT](https://chat.openai.com)
-   [Claude](https://claude.ai)
-   [Gemini](https://gemini.google.com/app)

---

## ✨ Key Features

### Core Functionality
-   **Unified Master Input**: Type your prompt once, send to all active services.
-   **Multi-Panel Layout**: View ChatGPT, Claude, and Gemini side-by-side (default 3-panel view).
-   **Service Toggling**: Easily enable or disable specific AI services.
-   **Session Persistence**: Automatically saves your login state (cookies/local storage) so you don't have to log in every time.
-   **Copy Chat Thread**: One-click copy of all chat threads to clipboard for easy sharing or saving.
-   **Cross Check**: Automatically feed the chat history of other AIs into each AI to cross-reference answers.

### Security & Privacy
-   **Sandboxed Environment**: Each service runs in an isolated `BrowserView` with context isolation.
-   **No Credential Storage**: Your passwords are never stored by the app; you log in directly via the official service websites.
-   **Bot Detection Evasion**: Uses User-Agent spoofing and human-like input event triggering to ensure compatibility.

---

## 🚀 Installation & Getting Started

### Prerequisites
-   [Node.js](https://nodejs.org/) (v16 or higher recommended)
-   [npm](https://www.npmjs.com/) (usually comes with Node.js)

### Installation Steps

1.  **Clone the repository**
    ```bash
    git clone https://github.com/your-username/sync-multi-chat.git
    cd sync-multi-chat
    ```

2.  **Install dependencies**
    ```bash
    npm install
    ```

3.  **Run the application**
    ```bash
    npm start
    ```

4.  **Build for production**
    
    **Option A: Portable Executable (Recommended)**
    Creates a standalone folder that you can run without installation.
    ```bash
    npm run build:portable
    ```
    The executable will be located in: `dist-packager/Multi-AI Chat-win32-x64/Multi-AI Chat.exe`

    **Option B: Installer (NSIS)**
    Creates a setup.exe installer (requires valid code signing environment).
    ```bash
    npm run build
    ```
    The installer will be generated in the `dist` folder.

---

## 📖 Usage Guide

1.  **Initial Setup**: When you launch the app for the first time, you will see the login screens for ChatGPT, Claude, and Gemini in their respective panels. Please **log in** to each service manually.
2.  **Broadcasting Prompts**:
    -   Type your question in the input bar at the bottom.
    -   Press **Enter** (or click Send) to broadcast the message to all enabled services.
    -   Use **Ctrl+Enter** to force send.
    -   Use **Ctrl+Shift+Enter** or click the **New Chat** button to start a new conversation in all active panels.
3.  **Advanced Features**:
    -   **Copy Chat Thread**: Click the **Copy Chat Thread** button to copy the entire conversation history from all active panels to your clipboard.
    -   **Cross Check**: Click the **Cross Check** button to have each AI review the answers provided by the other AIs.
    -   **Individual Copy**: Use the floating copy button (📋) in each panel to copy just that service's thread.
-   [x] Basic multi-view architecture
-   [x] Prompt broadcasting
-   [x] Copy Chat Thread
-   [x] Cross Check (Response Cross-referencing)
-   [ ] Response completion detection
-   [ ] Error handling & recovery

### Phase 2 (Planned)
-   Support for additional services (DeepSeek, Perplexity, Copilot)
-   Response comparison tools (Diff view)
-   Response copying/saving features (Enhanced)

### Phase 3 (Future)
-   Prompt templates
-   Local conversation history
-   Response quality analytics

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1.  Fork the project.
2.  Create your feature branch (`git checkout -b feature/AmazingFeature`).
3.  Commit your changes (`git commit -m 'Add some AmazingFeature'`).
4.  Push to the branch (`git push origin feature/AmazingFeature`).
5.  Open a Pull Request.

---

## 📄 License

This project is licensed under the **Apache License 2.0**. See the [LICENSE](LICENSE) file for details.

```text
Copyright 2025 Joseph Nam

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
```
