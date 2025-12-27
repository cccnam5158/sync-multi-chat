[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/cccnam5158/sync-multi-chat)

# Sync Multi Chat

**Sync Multi Chat** (Code Name: MAPB - Multi AI Prompt Broadcaster) is an Electron-based desktop application designed to maximize productivity for users who utilize multiple AI services simultaneously.
It allows users to send a single prompt to **ChatGPT**, **Claude**, **Gemini**, **Grok**, and **Perplexity** at once, displaying their responses side-by-side for easy comparison.

![Sync Multi Chat Application Screenshot](assets/mutli-ai-chat.png)
*Figure 1: Sync Multi Chat Interface showing simultaneous interactions with ChatGPT, Claude, and Gemini.*

## Key Features

-   **Multi-Pane Interface**: View and interact with up to 4 AI services (ChatGPT, Claude, Gemini, Grok, Perplexity) simultaneously in a grid layout.
-   **Simultaneous Prompting**: Send a message from a central "Master Input" to all active AI services instantly.
-   **Broad Service Support**: Supports ChatGPT, Claude, Gemini, Grok (xAI), Perplexity, and **Genspark**.
-   **Chat History Management**: Save and restore entire chat sessions including active services, layouts, and URLs.
-   **Conversation History**: Access past sessions from the sidebar and restore them instantly.
-   **Zoom & Layout Controls**: Adjust text size and switch between 2x2, 1x3, 1x4, and Maximize layouts.
-   **Prompt History**: Save and reuse frequently used prompts.
-   **Cross Check**: Iterate on your prompts by sending an AI's response as a new prompt to others.

## Tech Stack

-   **Electron**: Cross-platform desktop application framework.
-   **Puppeteer**: Headless Chrome Node.js API for automating the web views and interactions.
-   **Vanilla HTML/CSS/JS**: Lightweight and fast frontend.

## Version

-   **Current Version**: v0.5.5

## Installation

This application is distributed as a portable executable for Windows (`.exe`). No complex installation is required.

1.  Download the latest release zip file (e.g., `Sync Multi Chat-win32-x64-v0.5.5.zip`).
2.  Extract the zip file to a location of your choice.
3.  Run `Sync Multi Chat.exe` inside the extracted folder.

### Development Setup (For Contributors)

1.  Clone the repository.
2.  Run `npm install` to install dependencies.
3.  Run `npm start` to launch the application in development mode.

## Architecture & Design

-   **Project Name**: Sync Multi Chat
-   **Copy Chat Thread**: One-click copy of all chat threads to clipboard with proper Markdown formatting.
-   **Copy Last Response**: Copy only the last AI response from all active services for quick comparisons.
-   **Cross Check**: Click the "Cross Check" button to have each AI review the answers provided by the other AIs.
-   **Anonymous Cross Check**: Option to hide AI service names (replaced with aliases A, B, C...) during cross-checking to reduce bias.
-   **File Upload**: Attach images or text files to your prompt and broadcast them to all supported services. Supports **Drag & Drop** and **Clipboard Paste**.

-   **Sandboxed Environment**: Each service runs in an isolated `BrowserView` with context isolation.
-   **No Credential Storage**: Your passwords are never stored by the app; you log in directly via the official service websites.
-   **Bot Detection Evasion**: Uses User-Agent spoofing and human-like input event triggering to ensure compatibility.

---

## 📦 Installation & Getting Started

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
    The executable will be located in: `dist-packager/Sync Multi Chat-win32-x64/Sync Multi Chat.exe`

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
    -   **Copy Chat Thread**: Click the **Copy Chat Thread** button to copy the entire conversation history from all active panels to your clipboard with proper Markdown formatting.
    -   **Copy Last Response**: Click the **Copy Last Response** button to copy only the last AI response from each active service.
    -   **Cross Check**: Click the **Cross Check** button to have each AI review the answers provided by the other AIs.
    -   **Per-Service Header**: Each panel has a header bar with the service name and quick-access buttons:
        -   🔄 **Reload**: Refresh only that specific service panel.
        -   📋 **Copy**: Copy that service's full chat thread with Markdown formatting.
4.  **File Upload**:
    -   **Attach Files**: Click the **Clip** icon or **Drag & Drop** files into the input area.
    -   **Paste Images**: Paste images directly from your clipboard.
    -   **Two-Step Send**: When files are attached, pressing Enter initiates the upload. Wait for the confirmation modal, then press **Ctrl+Enter** again to send the prompt with files.

## Roadmap

### Phase 1 (Complete)
-   [x] Basic multi-view architecture
-   [x] Prompt broadcasting
-   [x] Copy Chat Thread
-   [x] Cross Check (Response Cross-referencing)
-   [ ] Response completion detection
-   [ ] Error handling & recovery

### Phase 2 (In Progress)
-   [x] Support for additional services (Grok, Perplexity)
-   [x] Advanced Layouts (2x2, Resizable)
-   [x] File Upload (Drag & Drop, Paste, Multi-service) *Grok temporarily disabled*
-   [x] Local conversation history
-   Support for DeepSeek, Copilot
-   Response comparison tools (Diff view)
-   Response copying/saving features (Enhanced)

### Phase 3 (Future)
-   Prompt templates
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

This project is licensed under the **Polyform Noncommercial License 1.0.0**. See the [LICENSE](LICENSE) file for details.

This license allows for:
*   **Personal Use**: You are free to use this software for your own personal needs.
*   **Non-Commercial Use**: You are free to use this software for non-profit and non-commercial purposes.

This license **PROHIBITS**:
*   **Commercial Use**: You may NOT use this software for any commercial purpose, including business operations, giving it away as part of a freemium service, or any activity primarily intended for commercial advantage or monetary compensation.

```text
Copyright (c) 2025 Joseph Nam. All rights reserved.
```
