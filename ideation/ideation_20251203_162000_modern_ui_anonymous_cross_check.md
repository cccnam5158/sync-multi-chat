# Modern UI & Anonymous Cross Check Implementation Plan

## 1. Overview
This document outlines the plan to modernize the bottom multi-prompt input area using the **shadcn/ui** design system and to implement an **Anonymous Cross Check** feature. This feature allows users to hide specific AI service names during cross-checking to reduce bias or context leakage between models.

## 2. User Requirements

### 2.1 UI Modernization (shadcn/ui)
- **Design System**: Adopt the aesthetics of shadcn/ui (clean, minimal, accessible, premium feel).
- **Components**:
    - **Input Area**: Modernized text area with better focus states and typography.
    - **Buttons**: Use shadcn/ui button styles (default, outline, ghost, secondary) for "Send", "Cross Check", and service toggles.
    - **Toggles**: Modernized toggle switches or pressed-state buttons.
- **Constraint**: Since the project uses Vanilla HTML/CSS/JS, we will **replicate** the shadcn/ui design tokens (CSS variables) and component styles manually, rather than importing the React library.

### 2.2 Anonymous Cross Check
- **New Control**: Add an "Anonymous" (?µëª…) toggle button next to the "Cross Check" button.
- **Behavior when Anonymous is ON**:
    - **Service Toggles**: Change labels from service names to aliases:
        - ChatGPT -> **(A)**
        - Claude -> **(B)**
        - Gemini -> **(C)**
        - Grok -> **(D)**
        - Perplexity -> **(E)**
    - **Prompt Injection**: When Cross Check is executed:
        - Remove the explicit service name from the prompt sent to other services.
        - If the prompt refers to a service (e.g., "Compare with Claude's answer"), replace it with the alias (e.g., "Compare with (B)'s answer").
        - *Specific Requirement*: "CrossCheck???µëª… ë²„íŠ¼ On ? íƒ ??CrossCheckê°€ ? íƒ?˜ì—ˆ???ŒëŠ” ê¸°ì¡´???ë™ ?¤ì •?˜ë˜ Claude ?¼ëŠ” ?•ë³´ê°€ ?„ë‹ˆ??(A) ?¼ëŠ” ?•ë³´ê°€ ?„ë‹¬ ?˜ë„ë¡??´ì¤˜" (When Anonymous is On and CrossCheck is selected, pass information as (A) instead of the previously automatically set Claude).

## 3. Technical Architecture

### 3.1 CSS (Design System)
- Define CSS variables in `index.css` matching shadcn/ui's `globals.css`:
    - `--background`, `--foreground`
    - `--primary`, `--primary-foreground`
    - `--muted`, `--muted-foreground`
    - `--border`, `--input`, `--ring`
    - `--radius`
- Create utility classes or specific component classes (e.g., `.btn-primary`, `.btn-outline`, `.input-area`).

### 3.2 Renderer Logic (`renderer.js`)
- **State Management**:
    - Add `isAnonymousMode` (boolean).
- **UI Updates**:
    - `updateServiceToggles()`: Check `isAnonymousMode`. If true, render aliases (A, B, C...). If false, render names.
    - `toggleAnonymousMode()`: Handler for the new button. Toggles state and re-renders buttons.
- **Prompt Construction**:
    - Modify the logic that prepares the prompt for Cross Check.
    - Create a mapping: `{ 'chatgpt': '(A)', 'claude': '(B)', ... }`.
    - Before sending, if `isAnonymousMode` is true, substitute service names with aliases in the generated prompt text.

### 3.3 Main Process (`main.js`)
- No significant changes expected in the main process, as prompt construction happens in the renderer or can be intercepted there.

## 4. Implementation Steps
1.  **Styles**: Update `index.css` with shadcn/ui variables and component styles.
2.  **HTML**: Refactor the bottom input section in `index.html` to match the new design structure.
3.  **JS**:
    - Implement `isAnonymousMode` state.
    - Implement the Anonymous toggle button logic.
    - Update the service toggle rendering logic.
    - Update the Cross Check prompt generation logic to use aliases.
4.  **Testing**:
    - Verify UI looks "modern" and matches shadcn/ui vibes.
    - Verify toggling Anonymous mode updates labels immediately.
    - Verify Cross Check sends prompts with aliases (A, B...) instead of names when Anonymous is ON.
    - Verify Cross Check sends prompts with names when Anonymous is OFF.
