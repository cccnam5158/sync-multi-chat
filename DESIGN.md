# Sync Multi Chat — Design System

> Design source of truth for the Sync Multi Chat Electron app.
> Extracted by Design Farmer (Phase 0–4.5 subset) from `src/renderer/styles.css` (12,015 lines).

- **Product**: Sync Multi Chat (Multi-AI Chat Broadcaster)
- **Platform**: Electron 39.2 desktop (macOS, Windows) — renderer-only styles
- **Styling approach**: Vanilla CSS with CSS Custom Properties (no Tailwind, no CSS-in-JS)
- **Color format (current)**: HSL space-separated tokens (Tailwind v3 shadcn/ui convention) + raw `hsl()` / `rgba()` / hex literals
- **Color format (target)**: OKLCH (recommended, Baseline 2023 — Electron 39 / Chromium ≥ 113)
- **Design maturity**: **Emerging** (mature token spine around shadcn variables; ad-hoc hex/hsl literals scattered across 750+ class rules)
- **Theme strategy**: Dark-only (no light mode switch; light theme fragments exist inside Markdown/Mermaid preview contexts)

---

## Config

```yaml
systemPath: src/renderer
framework: electron-vanilla-js
packageManager: npm
stylingApproach: vanilla-css-with-custom-properties
componentScope: custom (Electron-renderer UI)
themeStrategy: dark-only
themeLibrary: none
brandColor: "oklch(0.55 0.23 288)"  # violet primary
radiusTone: medium (0.5rem base, 4–20px component radii)
accessibilityLevel: AA (WCAG 2.x target); APCA validation recommended
targetPlatforms: [macOS, Windows]
designMaturity: emerging
maturityScore: 5
```

---

## 1. Architecture Snapshot

### File topology

```
src/renderer/
├── index.html                  # root shell (sidebar + main + panels)
├── styles.css                  # 12,015 lines — SINGLE stylesheet (all component styles)
├── fonts/                      # Noto Sans + Noto Sans Mono (Latin woff2, OFL-1.1)
├── renderer.js                 # main renderer entry
├── custom-prompt-builder.js    # CPB panel logic
├── prompt-hub.js               # Prompt Hub panel logic
├── history-manager.js          # Chat history sidebar
└── vendor/                     # 3rd-party libs (gridjs, highlight.js, katex, mermaid…)
```

### Styling layering (logical, file is monolithic)

1. **Font faces** (lines 1–60): 8 `@font-face` declarations for Noto Sans / Noto Sans Mono weights 400/500/600/700.
2. **Root tokens** (lines 62–92): shadcn/ui–style variables under `:root` — dark defaults.
3. **Base + scrollbar** (lines 94–134): global scrollbar theming + body/container layout.
4. **Shell layout** (lines 135–530): sidebar rail, main content, top-bar, resize handles, splitters.
5. **Task workspace / chat** (lines 532–1440): bubbles, composer, typing indicator, thinking block, tool blocks.
6. **Permission dialog, Customize panel, Settings** (lines 1641–2298): modals and side panels.
7. **Full-screen panels (smc-full-panel)** (lines 2298–2750): scoped typography scale (`--smc-fs-*`).
8. **Prompt Hub / CPB** (lines 2750–4400): filter sidebars, trees, Grid.js overrides, preview cards.
9. **Selection + chat history** (lines 3991–4980): multi-select bar, modal previews.
10. **Top bar / URL bar / splitters** (lines 4983–5400): view chrome and resize ergonomics.
11. **Controls, toggles, buttons** (lines 5361–5740): form primitives, switch styles, button variants.
12. **Main input + preview** (lines 5742–6250): prompt composer, preview pane, themed scrollbars.
13. **Prompt Builder split container** (lines 6242–6700): inline preview, mermaid fullscreen, zenUML themes.
14. **Grid.js complete dark theme** (lines 3110–3570): custom tabular components.
15. **Responsive** (lines 2441, 11432+): 4 breakpoint tiers (1200 / 1100 / 980 / 800 / 768 / 720 / 640).

---

## 2. Color System

### 2.1 Primitive tokens (proposed OKLCH)

> Current tokens are HSL space-separated; this table maps them to OKLCH primitives.
> Use the `--{role}` shadcn-style tokens only as **semantic** references; primitives below are for future refactor.

| Name | Current | Proposed OKLCH | Notes |
|------|---------|----------------|-------|
| `neutral.950` | `hsl(224 71.4% 4.1%)` | `oklch(0.13 0.024 264)` | app background |
| `neutral.900` | `hsl(220 15% 10%)` | `oklch(0.17 0.010 258)` | full-panel bg |
| `neutral.850` | `hsl(220 15% 11%)` | `oklch(0.18 0.010 258)` | scrollbar track, empty state gradient outer |
| `neutral.800` | `hsl(220 15% 13–14%)` | `oklch(0.22 0.012 258)` | card / topbar variants |
| `neutral.750` | `hsl(215 27.9% 16.9%)` | `oklch(0.24 0.025 260)` | border / muted / secondary |
| `neutral.700` | `hsl(220 15% 18–20%)` | `oklch(0.27 0.012 258)` | sidebar bg, hover surfaces |
| `neutral.500` | `hsl(217.9 10.6% 64.9%)` | `oklch(0.68 0.018 258)` | muted-foreground (icons, captions) |
| `neutral.100` | `hsl(210 20% 98%)` | `oklch(0.985 0.003 247)` | foreground text |
| `violet.500` | `hsl(263.4 70% 50.4%)` | `oklch(0.55 0.23 288)` | **brand primary** |
| `violet.400` | `hsl(260 12% 15%)` | `oklch(0.23 0.018 288)` | empty state center (radial gradient) |
| `green.500` | `hsl(142 72% 50%)` | `oklch(0.70 0.19 152)` | status active (green dot, online) |
| `green.400` | `hsl(160 60% 40%)` | `oklch(0.60 0.14 165)` | "New Task" accent button |
| `red.500` | `hsl(0 72% 50%)` | `oklch(0.60 0.23 27)` | stop/destructive action |
| `red.600` | `hsl(0 62.8% 30.6%)` | `oklch(0.40 0.145 27)` | destructive token |
| `amber.400` | `#f59e0b` | `oklch(0.77 0.17 71)` | model-select flash warning |
| `blue.400` | `hsl(200 80% 25% / 0.4)` | `oklch(0.40 0.10 230 / 0.4)` | info chip background |

### 2.2 Semantic tokens (existing shadcn convention)

These already exist in `:root` (lines 65–84) and are the **canonical layer** used across components.

| Token | Role | OKLCH value |
|-------|------|-------------|
| `--background` | app surface | `oklch(0.13 0.024 264)` |
| `--foreground` | primary text | `oklch(0.985 0.003 247)` |
| `--card` / `--popover` | raised surface | `oklch(0.13 0.024 264)` |
| `--primary` | brand action | `oklch(0.55 0.23 288)` |
| `--primary-foreground` | text on primary | `oklch(0.985 0.003 247)` |
| `--secondary` / `--muted` / `--accent` | subtle surface | `oklch(0.24 0.025 260)` |
| `--muted-foreground` | secondary text / icons | `oklch(0.68 0.018 258)` |
| `--destructive` | danger surface | `oklch(0.40 0.145 27)` |
| `--border` / `--input` | separator, input border | `oklch(0.24 0.025 260)` |
| `--ring` | focus ring (= primary) | `oklch(0.55 0.23 288)` |

Usage pattern: `hsl(var(--primary) / 0.42)` — alpha modulation through the space-separated channel trick.
OKLCH equivalent: `oklch(from var(--primary) l c h / 0.42)` (CSS Color Module 5) or pre-compute flattened tokens.

### 2.3 Status/Chip palette (observed)

| Status | Background | Foreground | Border |
|--------|-----------|------------|--------|
| Neutral (default) | `hsl(220 10% 25%)` | `hsl(220 10% 60%)` | — |
| Info | `hsl(200 80% 25% / 0.4)` | `hsl(200 80% 70%)` | — |
| Success | `hsl(142 40% 25% / 0.4)` | `hsl(142 60% 65%)` | — |
| Warning | `#f59e0b` glow | amber | `rgba(245,158,11,0.5)` |
| Danger | `hsl(0 72% 50% / 0.1)` | `hsl(0 72% 70%)` | `hsl(0 72% 50% / 0.2)` |

### 2.4 Contrast audit (APCA + WCAG)

- Body text `oklch(0.985 / 247)` on `oklch(0.13 / 264)` → Lc ≈ **103**, WCAG **21:1** → ✅ exceeds AAA.
- Muted text `oklch(0.68 / 258)` on `oklch(0.13 / 264)` → Lc ≈ **68**, WCAG ≈ **6.2:1** → ✅ AA for body, borderline for small text (revalidate if < 14px + weight 400).
- Primary button text `oklch(0.985)` on `oklch(0.55 / 288)` → Lc ≈ **82**, WCAG ≈ **5.4:1** → ✅ AA.
- Status "Success" text `hsl(160 60% 85%)` on `hsl(160 60% 30% / 0.25)` → computed over `--background` base; **needs runtime revalidation** because alpha blending changes effective L.

**Rule applied here**: never adjust chroma for contrast — only modify the L channel (per `operational-notes.md`).

---

## 3. Typography

### 3.1 Families

```css
--font-sans: "Noto Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
             "Helvetica Neue", Arial, sans-serif;
--font-mono: "Noto Sans Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
```

Self-hosted via `@font-face` at weights **400 / 500 / 600 / 700** for both families (Latin only, woff2, `font-display: swap`).

### 3.2 Type scale

Two overlapping scales coexist:

**(a) General app scale** — set per component by `rem`:

| Usage | Size | Weight | Line-height |
|-------|------|--------|-------------|
| Hero title (empty state) | `1.5rem` | 700 | — |
| Panel title | `1.1rem` | 600 | — |
| Chat body | `0.9rem` | 400 | 1.5 |
| Task-mode option label | `0.85rem` | — | 1.25 |
| Card / meta | `0.82rem` | 600 | 1.4–1.6 |
| Captions, code meta | `0.78rem` | 500 | 1.3 |
| Micro labels (badges) | `0.72rem` / `0.7rem` | 600–700 | — |
| Smallest (edit hints) | `0.68rem` | 500 | 1.3 |

**(b) Full-panel scale** — scoped via `--smc-fs-*` inside `.smc-full-panel`:

```css
--smc-fs-body:        max(12pt, 0.9rem);
--smc-fs-value:       0.95rem;
--smc-fs-section:     0.88rem;
--smc-fs-table:       0.8rem;
--smc-fs-meta:        0.75rem;
--smc-fs-caption:     0.72rem;
--smc-fs-placeholder: max(10.5pt, 0.78rem);
```

**Letter-spacing**: uppercase badges use `0.02em`–`0.04em`. Default 0.

### 3.3 Code typography

- Inline code: `font-size: 0.95em` (relative to parent), background `hsl(220 15% 18%)`, radius `3px`, padding `1px 4px`.
- Block code (`pre`): `font-size: 0.84rem`, background `hsl(220 15% 10%)` (dark preview) / `hsl(220 15% 8%)` (Customize detail), padding `10–12px`, radius `6px` or `var(--radius)`.

---

## 4. Spacing, Radii, Shadows, Motion

### 4.1 Spacing

No formal spacing token — raw pixels and rems used inline. Observed canonical steps:

`2, 3, 4, 6, 8, 10, 12, 14, 16, 20, 24, 32 px` — effectively a 4px/2px base grid.

**Proposed tokenization** (future refactor):

```css
--space-1: 4px;   --space-2: 8px;   --space-3: 12px;  --space-4: 16px;
--space-5: 20px;  --space-6: 24px;  --space-8: 32px;
```

### 4.2 Radii

| Token | Value | Use |
|-------|-------|-----|
| (hard pill) | `999px` | rail buttons, scroll thumb, status chips |
| (circle) | `50%` | avatar, send button, status dots, dropdown caret pill |
| `4px` | small | tooltip tags, resize handles |
| `6px` | tight | inline `pre`, chip dismiss |
| `8px` | default | attach chips, skill chips, toggle labels |
| `10px` | medium | task panels, popovers, Grid.js cells |
| `12px` | comfortable | message bubbles, empty-state composer |
| `14px` | large | permission dialog shell, composer gradient frame |
| `16px` | largest | controls-container chrome |
| `var(--radius)` = `0.5rem` = 8px | semantic default | buttons, inputs, chat pres |

### 4.3 Shadows

All shadows use `hsl(0 0% 0% / α)` or `rgba(0,0,0,α)` to blend with the dark surface.

| Level | Value | Purpose |
|-------|-------|---------|
| focus | `0 0 0 1px hsl(var(--ring))` | inputs, model selector |
| subtle | `0 0 0 1px hsl(var(--primary) / 0.12)` | active rail button |
| chip-ring | `0 0 0 1px hsl(var(--primary) / 0.25)` | chip toggled |
| popover | `0 12px 32px hsl(0 0% 0% / 0.5)` | dropdown, popover |
| modal | `0 8px 32px hsl(0 0% 0% / 0.4)` | permission dialog |
| panel | `-6px 0 24px rgba(0,0,0,0.35)` | `.smc-full-panel` left edge |
| glow-warning | `0 0 12px rgba(245,158,11,0.5)` | model-select flash |
| glow-success | `0 0 4px hsl(142 72% 50% / 0.5)` | live status dot |
| pulse-stop | `0 0 0 8px hsl(0 72% 50% / 0)` → `0.5` | stop button animation |

### 4.4 Motion

- **Default transition**: `0.15s ease` on `background / color / border-color / box-shadow`.
- **Faster**: `0.12s` for dense chip/tab hover states.
- **Sidebar width**: `width 0.28s cubic-bezier(0.4, 0, 0.2, 1)` (Material standard easing).
- **Typing indicator**: custom `typingBounce` keyframes.
- **Thinking block**: `thinkingPulse` keyframes.
- **Stop button**: `stopPulse` — 3-stage ring expand.
- **Task pulse**: `task-pulse` — ambient badge breathing.
- **Message enter**: `msgFadeIn` keyframes.
- **Model selector flash**: `modelSelectFlash` — 3-blink amber warning.

**Principle**: all transitions stay under 300ms; easing is `ease`, `ease-in-out`, or the sidebar cubic-bezier. No spring physics.

---

## 5. Component Inventory

Roughly **750+ class-scoped rules** grouped into the following surfaces:

### 5.1 Shell
- `#app-container`, `#main-content`, `#history-sidebar` (rail, 48 px collapsed → expanded)
- `.sidebar-rail-btn`, `.rail-btn-label`, `.sidebar-footer`, `.sidebar-rail-separator`
- `#new-chat-btn`, `#new-task-btn` (primary + accent variants)
- `.settings-btn`, `.user-status`
- Top bar + floating toggle (`.top-bar`, `#top-bar-toggle`)
- Splitter/resize handles (`.splitter`, `.resize-handle`)

### 5.2 Task workspace (chat)
- `.task-chat`, `.task-chat-messages`, `.task-chat-empty`
- `.task-chat-bubble` (assistant / user variants) with `msgFadeIn`
- `.task-chat-bubble-content` (markdown renderer: pre, code, blockquote, lists, headings, tables, hr, links)
- `.task-msg-actions`, `.task-msg-action-btn`, `.task-msg-edit-btn`
- `.task-chat-chip` (attachment chip), `.task-chat-chip-remove`
- `.task-composer`, `.task-composer-toolbar` with send/stop button
- `.task-mode-option`, `.task-mode-dropdown`, `.task-mode-icon`
- `.task-status-dot` (idle / live / stopped states)

### 5.3 Feedback
- `.typing-indicator` (3-dot bounce)
- `.thinking-block` (reasoning reveal)
- `.tool-execution-block` (tool call surface)
- `.stopped-notice` (Claude-style neutral stop banner)

### 5.4 Artifacts & preview
- `.artifact-card`, `.artifact-preview`
- `.customize-detail-content` (markdown rendering: pre, code, img)
- Text/Preview toggle tabs
- HTML preview iframe
- Mermaid preview (light + dark) + fullscreen
- ZenUML dark theme overrides
- Grid.js full dark theme (~450 lines)

### 5.5 Panels
- `.smc-full-panel`, `.smc-panel-chrome`, `.smc-panel-breadcrumb`, `.smc-panel-title`, `.smc-panel-overlay-stack`
- Settings panel (`.settings-section`, ChatGPT subscription block, Task history badges)
- Customize panel (3-panel layout, "Coming Soon" overlay, file/dir list)
- Prompt Hub (filters sidebar, categories row, resize handle, collapse)
- CPB / Prompt Hub shared sidebar tree (Explorer-style hover + purple selection)

### 5.6 Modals
- Permission dialog
- Chat Thread Preview Modal
- Blur-background confirmation dialog

### 5.7 Composer / input
- `#master-input`, `.prompt-toggle`, `.layout-group`
- Clip button, Send button (send ↔ stop state toggle)
- File preview, skill chips
- Prompt Builder split container (inline preview pane)
- Main preview themes (dark default, light for code/markdown)

### 5.8 Controls
- Modern checkbox / toggle / switch (Power-style anonymous toggle)
- Scroll-sync switch button
- Button variants: primary, secondary, ghost, ghost-danger (ghost-danger marked dead code per comment @ 4981)

---

## 6. Responsive Strategy

Breakpoints observed (desktop-first, min/max mixed):

| Breakpoint | Scope |
|------------|-------|
| `min-width: 1100px` | PH overlay filter width override (grid → flex swap) |
| `max-width: 1200px` | wide app compaction |
| `max-width: 980px` | medium compaction |
| `max-width: 800px` | small-desktop |
| `max-width: 768px` | tablet landscape |
| `max-width: 720px` | dashboard tables collapse |
| `max-width: 640px` | mobile (rare in Electron, but supported) |

> Since this is a desktop Electron app, sub-800px is edge-case. Primary design target is ≥ 1200px.

---

## 7. Accessibility Notes

- **Focus ring**: `box-shadow: 0 0 0 1px hsl(var(--ring))` — visible but thin; consider `2px` for better AA visibility.
- **Contrast** (see §2.4): body/primary pass AA. Status chips with alpha backgrounds need runtime APCA check over the actual app background.
- **Font smoothing**: `-webkit-font-smoothing: antialiased` on body.
- **No reduced-motion media query** detected — `@media (prefers-reduced-motion)` should be added to disable `task-pulse`, `thinkingPulse`, `stopPulse`, `modelSelectFlash`, `msgFadeIn`.
- **Keyboard navigation**: styles rely on `:focus` and `:focus-visible` is not explicitly used — consider migrating for better keyboard-only experience.
- **APCA note**: APCA Lc 60 ≠ WCAG 2.x 4.5:1 — for legally required accessibility verify both.

---

## 8. Known Issues / Improvement Opportunities

1. **Hardcoded literals**: 100+ raw `hsl(220 15% …)` and a few `#f59e0b`, `#fff`, `#94a3b8`, `#cbd5e1`, `#e2e8f0`, `rgba(...)` values bypass the semantic token layer. Promote them to primitives (§2.1) first.
2. **Alpha-channel pattern**: `hsl(var(--primary) / 0.42)` is clever but fragile when switching to OKLCH. Migrate to CSS Color 5 `oklch(from var(--primary) l c h / α)` or pre-compute flattened tokens.
3. **Monolithic stylesheet**: 12K lines / 750+ rules in one file. Consider splitting by surface (`shell.css`, `chat.css`, `panels.css`, `prompt-hub.css`, `grid.css`, `preview-themes.css`).
4. **Duplicate typography scales**: general rem scale + `--smc-fs-*` scale overlap. Consolidate into one semantic scale with context-scoped overrides.
5. **No reduced-motion guard**.
6. **No light theme**: light fragments inside Mermaid/Markdown preview are themed contextually but the app shell is dark-only. If light mode is future-scope, `:root.light` overrides are feasible via the existing semantic token layer.
7. **Dead code marker** at line 4981 (`btn-ghost-danger and legacy sidebar-footer override removed`) — verify comment matches reality.
8. **Mixed color formats**: HSL space-separated (tokens) + hex + rgba + hsl() literal. Standardize on OKLCH or a single HSL dialect.

---

## 9. Migration Roadmap (recommended, not implemented)

- **Step 1 — Tokenize**: freeze current shadcn `:root` as the semantic layer; add OKLCH primitive layer above it.
- **Step 2 — Sweep literals**: replace `hsl(220 15% 18%)` and siblings with `var(--neutral-700)` etc.
- **Step 3 — Switch format**: convert `:root` semantic values from HSL to OKLCH; test rendering on macOS (wide-P3) and Windows (sRGB) displays.
- **Step 4 — Split stylesheet**: extract logical sections into feature files; import ordered in `index.html`.
- **Step 5 — Add light theme (optional)**: `:root[data-theme="light"]` override block.
- **Step 6 — Reduced-motion**: wrap all keyframes in `@media (prefers-reduced-motion: no-preference)`.

Each step is non-breaking if done in order; steps 1–3 can be gated behind a feature flag in main.js via CSS class toggle on `<html>`.

---

## 10. Source Files Analyzed

- `src/renderer/styles.css` (12,015 lines) — single source of UI styling
- `src/renderer/index.html` — shell markup
- `src/renderer/custom-prompt-builder.js`, `prompt-hub.js`, `renderer.js` — inline style hooks & class toggles
- `package.json` — Electron 39.2 / CommonJS / no framework

---

**Status**: DONE — Design source-of-truth document generated.
**Scope**: Phase 0–4.5 subset (preflight + repo analysis + pattern extraction + OKLCH normalization + DESIGN.md).
**Not executed**: Phase 3.5 visual preview, Phase 5–11 (token files, component implementation, Storybook, reviews, integration). Run the full `/design-farmer` pipeline if you want those phases applied to this codebase.

Generated by Design Farmer v0.0.6
