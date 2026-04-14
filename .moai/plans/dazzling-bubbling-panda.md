# Plan: Live Chat-Thread Capture on Response Completion

## Context

The `chatThread` field on a history session powers the "eye icon" preview modal in the history sidebar and helps the user decide what title to give a chat. Today it is only populated in two places:

- `loadSession(session)` at [src/renderer/renderer.js:4529](src/renderer/renderer.js#L4529) when the user switches sessions from the history list.
- `window.electronAPI.onAppWillClose` handler at [src/renderer/renderer.js:5040](src/renderer/renderer.js#L5040) when the app is closing.

Both paths call `saveCurrentSession({ extractChatThread: true })`, which in turn invokes the `get-chat-thread-json` IPC handler at [src/main/main.js:3182](src/main/main.js#L3182) → `buildChatThreadJsonForCPB` at [src/main/main.js:3093](src/main/main.js#L3093) → per-service `extractContentFromService` at [src/main/main.js:2393](src/main/main.js#L2393).

That means while the user is actively chatting, the preview modal shows stale or empty threads, and if a response is interrupted (in-webview stop button, "+ New Task", history switch, etc.) without a session switch/app-close, nothing ever gets persisted. We need the `chatThread` to be kept fresh automatically after each webview response finishes, and to be captured defensively at every transition point so the preview and title-edit experience always reflects recent activity.

Intended outcome: after any webview (multi-mode service or single-mode instance) finishes producing a response, `chatThread` is re-extracted and saved under the current session; at every destructive transition the last-known thread is flushed synchronously.

## Approach (recommended)

Add a **response-completion signal** per webview and a **debounced live-capture hook** in the renderer that updates only the current session's `chatThread` field. Use **content-stability polling** in `service-preload.js` because it is service-agnostic (no need to add per-service stop-button selectors) and already has the necessary helpers.

### 1. Detect completion per webview — `src/preload/service-preload.js`

Right after `clickSendButton(...)` succeeds at [src/preload/service-preload.js:593](src/preload/service-preload.js#L593) (inside `injectPrompt`) and at line 609 (external `click-send-button` IPC path), start a per-webview observer:

- Interval: ~800 ms, hard cap 15 min (safety abort).
- Per tick compute a lightweight signature of the "last assistant response area":
  - **Claude short-circuit**: if `document.querySelector('[data-is-streaming]')` exists, force `busy=true` and continue polling. (Already referenced in selectors at [src/config/selectors.json:68](src/config/selectors.json#L68) and in `extractContentFromService` at [src/main/main.js:2456](src/main/main.js#L2456).)
  - **Generic**: read `innerText.length` of the element matching the first selector from `currentConfig.lastResponseSelector`; fall back to `messageSelector` count. Hash = `${count}:${lastTextLength}`.
- Transition rule:
  1. Mark `sawChange = true` the first tick the hash differs from the initial baseline (i.e., streaming started).
  2. Once `sawChange` is true and the hash is stable for **3 consecutive ticks** (~2.4 s), consider the response complete.
- On completion:
  - `ipcRenderer.send('chat-response-complete', { service: currentService, instanceKey: currentInstanceKey })`
  - Clear the interval.
- Re-entry safety: a new `inject-prompt` while an observer is active simply resets `sawChange`, `stableCount`, baseline — single interval handle, no leaks.
- Navigation safety: listen once for `pagehide` / `beforeunload` and clear the interval so observers don't survive a webview navigation (e.g., after New Chat reset URL).

Reuses: existing `currentService`, `currentInstanceKey`, `currentConfig` state at the top of `service-preload.js`; existing `isSendButtonDisabled` helper at [src/preload/service-preload.js:612](src/preload/service-preload.js#L612) as a secondary "input ready again" check if needed.

### 2. Forward the signal — `src/main/main.js` + `src/main/preload.js`

- In `src/main/main.js`, add `ipcMain.on('chat-response-complete', (event, { service, instanceKey }) => { ... })` that validates the sender (`views[service]` or any single-mode instance whose `webContents === event.sender`), then calls `mainWindow.webContents.send('chat-response-complete', { service, instanceKey, mode: chatMode })`. Place it near the other IPC handlers around [src/main/main.js:3182](src/main/main.js#L3182).
- In `src/main/preload.js`, expose `onChatResponseComplete: (cb) => ipcRenderer.on('chat-response-complete', (e, d) => cb(d))` alongside the existing `onChatThreadCopied` at [src/main/preload.js:16](src/main/preload.js#L16).

### 3. Live capture in the renderer — `src/renderer/renderer.js`

Add a small capture module near `saveCurrentSession` ([src/renderer/renderer.js:4277](src/renderer/renderer.js#L4277)):

```text
// (sketch, not final code)
let chatThreadCaptureTimer = null;
let chatThreadCaptureInFlight = false;

function scheduleChatThreadCapture(delay = 1500) {...}
async function flushChatThreadCaptureNow() {...}
async function captureChatThreadForCurrentSession() {
    // 1. snapshot currentSessionId
    // 2. const thread = await window.electronAPI.getChatThreadJson?.()
    // 3. if empty/null → skip (don't wipe existing)
    // 4. const fresh = await historyManager.getSession(snapshotId)
    // 5. if !fresh → skip
    // 6. fresh.chatThread = thread; fresh.updatedAt = now
    // 7. await historyManager.saveSession(fresh)
    // 8. if history sidebar open → loadHistoryList({ preserveScroll: true })
}
```

Wiring:

- On boot, register `window.electronAPI.onChatResponseComplete(({ service, instanceKey }) => scheduleChatThreadCapture())`. Debounce coalesces bursts when multiple webviews complete within a short window (common in multi mode).
- Guard with `chatThreadCaptureInFlight` to prevent overlapping writes; if another completion arrives mid-flight, re-arm `scheduleChatThreadCapture()` after the current one resolves.
- Only update `chatThread` + `updatedAt` — never overwrite other fields, never create a new row. This mirrors the defensive fix already applied to `commitInlineEdit` at [src/renderer/renderer.js:4895](src/renderer/renderer.js#L4895).

### 4. Defensive flush at transitions — `src/renderer/renderer.js`

At every transition that abandons the current chat view, call `await flushChatThreadCaptureNow()` **before** the destructive work:

- `triggerNewChatWorkflow` at [src/renderer/renderer.js:112](src/renderer/renderer.js#L112) — replace the current `await saveCurrentSession()` with `await flushChatThreadCaptureNow(); await saveCurrentSession({ extractChatThread: true });`.
- `loadSession` at [src/renderer/renderer.js:4522-4531](src/renderer/renderer.js#L4522-L4531) — already calls `saveCurrentSession({ extractChatThread: true })`; add `flushChatThreadCaptureNow()` just before, and also cancel the debounce timer (like the existing `urlChangeDebounceTimer` clear).
- `triggerNewTaskWorkflow` at [src/renderer/renderer.js:5171](src/renderer/renderer.js#L5171) — currently calls `await saveCurrentSession()`; upgrade to `await flushChatThreadCaptureNow(); await saveCurrentSession({ extractChatThread: true });` so switching to a task flushes the prior chat thread.
- `performDeleteSession` paths at [src/renderer/renderer.js:4191](src/renderer/renderer.js#L4191), `performClearAll` at [src/renderer/renderer.js:4244](src/renderer/renderer.js#L4244), and `performHistoryBulkDelete` at [src/renderer/renderer.js:3612](src/renderer/renderer.js#L3612) — if `currentSessionId` is among the deleted ids, cancel the pending capture timer (the session is gone; saving would re-create it).
- `onAppWillClose` at [src/renderer/renderer.js:5038-5047](src/renderer/renderer.js#L5038-L5047) — add `await flushChatThreadCaptureNow();` before the existing `saveCurrentSession({ extractChatThread: true })` for belt-and-braces.

### 5. In-webview Stop button

When the user clicks the stop button inside a webview, the response freezes in place. The content-stability observer in step 1 will naturally detect stability and fire `chat-response-complete`, so no extra wiring is needed — the partial response gets captured. Claude's case is also covered because `[data-is-streaming]` is removed when the user aborts.

### Race / correctness guarantees

- **No new rows ever created**: `captureChatThreadForCurrentSession` always reads by `currentSessionId` via `historyManager.getSession(id)` first; if the row is gone it bails. Only updates existing records via `put` upsert.
- **No concurrent overwrites**: a single `chatThreadCaptureInFlight` flag plus the debounce timer serialize writes against themselves; `loadSession` / `triggerNewChatWorkflow` / `triggerNewTaskWorkflow` await the flush before mutating `currentSessionId`.
- **No empty overwrites**: if `getChatThreadJson()` returns `null` / `[]` (e.g., webview not yet rendered), the capture is skipped so we never clobber a known-good thread.
- **No observer leaks**: per-webview interval is cleared on `pagehide`, on re-entry, and by the 15-minute cap.
- **Session deletion**: the capture timer is cancelled when the current session is deleted; otherwise a late completion would resurrect the row.

## Critical files to modify

- [src/preload/service-preload.js](src/preload/service-preload.js) — new `startResponseObserver(selectors)` helper, wire-up inside `injectPrompt` / `click-send-button` handler, `pagehide` cleanup. Reuses `isSendButtonDisabled` at line 612 and `currentConfig.lastResponseSelector`.
- [src/main/main.js](src/main/main.js) — new `ipcMain.on('chat-response-complete', ...)` forwarder near line 3182. No changes to `buildChatThreadJsonForCPB` / `extractContentFromService`; they already work on-demand.
- [src/main/preload.js](src/main/preload.js) — expose `onChatResponseComplete` bridge near line 16-17.
- [src/renderer/renderer.js](src/renderer/renderer.js) — add live-capture module (`scheduleChatThreadCapture`, `flushChatThreadCaptureNow`, `captureChatThreadForCurrentSession`) near `saveCurrentSession` at line 4277; subscribe to `onChatResponseComplete` during init; add `flushChatThreadCaptureNow()` calls in `triggerNewChatWorkflow` (line 112), `loadSession` (line 4522), `triggerNewTaskWorkflow` (line 5171), deletion handlers, and `onAppWillClose` (line 5040). Reuse existing `historyManager.getSession` / `historyManager.saveSession` at [src/renderer/history-manager.js:38](src/renderer/history-manager.js#L38) and `loadHistoryList({ preserveScroll: true })`.

No schema changes (the `chatThread` field already exists on session records). No changes required to `selectors.json` — detection is derived from existing `lastResponseSelector` / `messageSelector`.

## Verification

End-to-end manual checks (run `npm start` / the usual app launch):

1. **Multi mode happy path**: Enable 3 services, send a prompt, wait for all responses to finish. Open the history sidebar preview (eye icon) on the active session — it should show the thread from all 3 services without having closed the app or switched sessions.
2. **Single mode multi-instance**: Switch to single mode with 3 instances of ChatGPT, send a prompt, wait for all 3 instances to finish. Preview should reflect all 3 instance replies.
3. **Mid-stream New Chat**: Send a long-ish prompt, click "+ New Chat" while still streaming. The previous session's preview should contain the partial response that had streamed so far (not empty). No duplicate row is created.
4. **Mid-stream history switch**: Same scenario but switch to another history item mid-stream. Preview on the previous session reflects partial state; preview on the target session is untouched.
5. **Mid-stream "+ New Task"**: Same scenario but click "+ New Task". Previous chat session's preview contains partial content; the new task session opens cleanly.
6. **In-webview Stop button**: Start a response, click the service's own Stop button in the webview. Within ~3 s the preview for the current session should update with the truncated response.
7. **App close mid-stream**: Quit the app mid-stream. Re-open → the previous session's preview still contains partial content (existing `onAppWillClose` path plus new flush).
8. **Title-edit interplay**: Double-click a session title during streaming, edit, press Enter. The row's `title` updates and the preview still renders correctly; no new row is created (regression guard against the previous `commitInlineEdit` bug).
9. **Delete current mid-capture**: Delete the current session via the delete button while a capture is pending. No new row should reappear after the pending timer fires.
10. **Observer leak check**: `setInterval` count in DevTools (for each webview) should return to baseline after a completion is reported; opening/closing sessions many times shouldn't accumulate intervals.

Automated smoke (optional, if time permits): add a focused unit test around `captureChatThreadForCurrentSession` that mocks `historyManager.getSession` / `saveSession` and asserts (a) early-return on missing session, (b) early-return on null thread, (c) merge updates only `chatThread` + `updatedAt`.
