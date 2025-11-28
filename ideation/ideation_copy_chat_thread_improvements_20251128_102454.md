# Ideation: Copy Chat Thread Improvements & Cross Check Feature

## 1. Overview
This document outlines the improvements for the "Copy Chat Thread" functionality and the introduction of a new "Cross Check" feature.

## 2. Improvements

### 2.1. Visual Feedback for "Copy Chat Thread"
- **Problem**: Users are unsure if the copy action was successful.
- **Solution**: Change the button text to "Copied!" for 2 seconds after a successful copy, then revert to "Copy Chat Thread".
- **Implementation**:
    - Renderer sends request to Main.
    - Main performs copy and sends success event back to Renderer.
    - Renderer updates button text temporarily.

### 2.2. Fix Claude Chat History Copying
- **Problem**: Copying Claude's thread includes the left sidebar titles.
- **Solution**: Refine the CSS selector for Claude to target only the chat content area, excluding the sidebar.
- **Implementation**: Update `config/selectors.json` for Claude.

### 2.3. Individual Panel Copy Button
- **Problem**: Users may want to copy only one specific chat thread.
- **Solution**: Add a "Copy" button below the "Reload" button in each service panel.
- **Design**: Similar to the Reload button (icon-based, floating).
- **Implementation**:
    - Inject button via `service-preload.js`.
    - On click, extract text from that specific webview and write to clipboard.
    - Show visual feedback (e.g., change icon to checkmark temporarily).

## 3. New Feature: Cross Check

### 3.1. Description
"Cross Check" allows users to cross-reference answers between AI services. It takes the chat history from other active services and feeds it into the target service as context.

### 3.2. Workflow
1.  User clicks "Cross Check" button (located next to "New Chat", "Copy Chat Thread").
2.  App extracts chat history from all *active* (and enabled) services.
3.  App constructs a prompt for each active service:
    - **ChatGPT Input**: `[Claude Thread]\n...\n[Gemini Thread]\n...`
    - **Claude Input**: `[ChatGPT Thread]\n...\n[Gemini Thread]\n...`
    - **Gemini Input**: `[ChatGPT Thread]\n...\n[Claude Thread]\n...`
4.  App injects these prompts into the respective input fields.
5.  App automatically sends the prompts.

### 3.3. Handling Edge Cases
- **Closed/Disabled Panels**: If a panel is disabled, its content is not included in the context for others, and it does not receive a prompt.
- **Empty Threads**: If a thread is empty, it is skipped in the context.

## 4. UI Changes
- **Control Bar**: Add "Cross Check" button.
- **Service Panels**: Add floating "Copy" button below "Reload" button.
