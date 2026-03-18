# Cross Check User Prompt Addition Implementation Plan

## 1. Overview
This document outlines the implementation of enhancements to the "Cross Check" feature, allowing users to add custom prompts or use an editable predefined comparison prompt when cross-checking AI responses. This provides more control and context for the cross-check process.

## 2. User Requirements

### 2.1 Cross Check Popup
- **Trigger**: Clicking the "Cross Check" button opens a modal popup instead of immediately executing the cross-check.
- **Options**: The popup presents two main options:
    - **Compare AI Responses (Í∞?AI ?ëÎãµ ÎπÑÍµê)**: Uses an editable predefined prompt to ask AIs to compare the collected responses.
    - **Add Custom Prompt (?¨Ïö©???ïÏùò ?ÑÎ°¨?ÑÌä∏ Ï∂îÍ?)**: Allows the user to input, save, and manage custom prompts.

### 2.2 Compare AI Responses Mode
- **Behavior**:
    - Prepend a predefined comparison prompt to the collected AI responses.
    - **Default Predefined Prompt**: "Below are responses from different AI models. Please compare and analyze them for accuracy, completeness, and logic. Identify any discrepancies and suggest the best answer."
    - Send the combined text to all active AI services.
- **Editable Predefined Prompt**:
    - Users can hover over the "Compare AI Responses" button to see a preview tooltip with the full prompt text.
    - An edit icon (pencil) appears on hover, allowing users to modify the predefined prompt.
    - The edited prompt is persisted in localStorage.
    - The edit modal includes validation: "Modify" button is disabled until changes are made.

### 2.3 Add Custom Prompt Mode
- **UI**:
    - **Input Fields**: 
        - Title input (required)
        - Prompt content text area (required)
    - **Saved Prompts Table**: Displays up to 10 saved prompts with:
        - Title
        - Preview (truncated content)
        - Last Used date
        - Created date
        - Delete action button
    - **Sorting**: Click table headers to sort by Title, Last Used, or Created date
    - **Save Options**: 
        - "Add Custom Prompt" button: Saves the prompt without sending
        - "Send Cross Check" button with "Save this prompt" checkbox: Optionally saves while sending
- **Behavior**:
    - Both Title and Content fields are required
    - Title must be unique among saved prompts
    - Validation ensures buttons are disabled when fields are empty
    - Inputs remain enabled after all operations (deletion, saving)
    - Delete confirmation modal appears before removing a prompt
- **Data Management**:
    - **Storage**: localStorage with up to 10 custom prompts
    - **Fields**: `id`, `title`, `content`, `createdAt`, `lastUsedAt`
    - **Ordering**: Sorts by `createdAt` (descending) when adding new prompts
    - **LRU Policy**: When exceeding 10 items, oldest created prompts are removed

## 3. Technical Architecture

### 3.1 UI Components
- **Cross Check Modal**: Main modal for Cross Check options
- **Options View**: Displays "Compare AI Responses" and "Add Custom Prompt" buttons with hover preview
- **Predefined Prompt Edit View**: Modal for editing the predefined prompt with validation
- **Custom Prompt View**: Input form with Title, Content fields, and action buttons
- **Saved Prompts Table**: Sortable table with delete confirmation
- **Delete Confirmation Modal**: Separate modal for prompt deletion

### 3.2 Renderer Logic (`renderer.js`)
- **State**:
    - `customPrompts`: Array of prompt objects
    - `currentPredefinedPrompt`: Current predefined prompt text
    - `currentSort`: Current sort column and direction for saved prompts table
    - `pendingDeletePromptIndex`: Index of prompt pending deletion
- **Functions**:
    - `openCrossCheckModal()`: Display the modal and load prompts
    - `showOptionsView()`: Show main options view
    - `showCustomPromptView()`: Show custom prompt input view
    - `showPredefinedEditView()`: Show predefined prompt edit view
    - `updateSendButtonState()`: Validate and enable/disable action buttons
    - `saveCustomPrompt(title, content)`: Save prompt to localStorage
    - `loadCustomPrompts()`: Load prompts from localStorage with migration
    - `loadPredefinedPrompt()`: Load custom predefined prompt or use default
    - `savePredefinedPrompt(content)`: Save edited predefined prompt
    - `deleteCustomPrompt(index, e)`: Open delete confirmation modal
    - `performPromptDeletion(index)`: Execute prompt deletion
    - `renderSavedPrompts()`: Render table with sorting
    - `forceEnableCustomPromptInputs()`: Ensure inputs remain enabled
    - `resetCustomPromptForm()`: Clear form fields and reset state

### 3.3 Data Storage
- **LocalStorage Keys**:
    - `customPrompts`: Array of custom prompt objects
    - `predefinedPrompt`: User-customized predefined prompt text
- **Schema**:
    ```json
    [
      {
        "id": "timestamp-based-id",
        "title": "My Custom Prompt",
        "content": "Analyze this...",
        "createdAt": "ISO8601 timestamp",
        "lastUsedAt": "ISO8601 timestamp"
      }
    ]
    ```

### 3.4 Input State Management
- **MutationObserver**: Monitors input fields for unwanted disabled state changes
- **forceEnableCustomPromptInputs()**: Uses multiple strategies (direct, requestAnimationFrame, setTimeout) to ensure inputs stay enabled
- **Window Focus Listener**: Re-enables inputs when window regains focus

## 4. Implementation Steps
1.  **UI Implementation**:
    - Created Cross Check Modal HTML structure in `index.html`
    - Added Predefined Prompt Edit View with validation
    - Added Delete Confirmation Modal
    - Styled components using `styles.css` (shadcn/ui tokens)
    - Added edit icon with hover effect
    - Created sortable table for saved prompts
    
2.  **Logic Implementation (`renderer.js`)**:
    - Modified "Cross Check" button to open modal
    - Implemented "Compare" button with editable predefined prompt
    - Implemented "Custom Prompt" UI with validation
    - Added "Add Custom Prompt" button for saving without sending
    - Implemented storage logic (save/load/delete/sort)
    - Added input state management with MutationObserver
    - Implemented delete confirmation modal
    
3.  **Main Process Updates (`main.js`)**:
    - Updated `cross-check` IPC handler to accept `promptPrefix`
    - Added `set-service-visibility` IPC handler to hide/show BrowserViews
    
4.  **Preload Updates (`preload.js`)**:
    - Updated `crossCheck` to accept `promptPrefix` parameter
    - Exposed `setServiceVisibility` API
    
5.  **Refinement**:
    - Smooth UX (focus management, modal closing)
    - Comprehensive validation (required fields, unique titles)
    - Robust input state management
    - Date formatting for creation and last used timestamps
    - Sortable table headers with visual indicators

## 5. Verification
- **Manual Testing**:
    - Click Cross Check ??Verify Modal opens with options
    - Hover "Compare AI Responses" ??Verify preview tooltip appears
    - Click edit icon ??Verify edit modal with disabled "Modify" button
    - Edit predefined prompt ??Verify "Modify" enables on change
    - Click "Compare" ??Verify predefined prompt is prepended and sent
    - Click "Custom" ??Enter title and prompt ??Verify buttons enable/disable correctly
    - Click "Add Custom Prompt" ??Verify prompt saves and form clears
    - Verify saved prompts appear in table with dates
    - Click table headers ??Verify sorting works
    - Select saved prompt ??Verify it populates inputs and enables buttons
    - Delete prompt ??Verify confirmation modal appears
    - Confirm deletion ??Verify inputs remain enabled
    - Check persistence after reload

## 6. Key Features Implemented
- ??Editable predefined prompt with persistent storage
- ??Custom prompt management (add, save, delete, sort)
- ??Required field validation (Title and Content)
- ??Unique title validation
- ??Delete confirmation modal
- ??Sortable table with creation and last used dates
- ??Robust input state management preventing unwanted disabled states
- ??Hover preview tooltip for predefined prompt
- ??Visual feedback for button states (disabled/enabled)
- ??BrowserView visibility management during modal display

## 7. Implementation Date
**Completed**: 2025-12-04
**Version**: v0.5.2
