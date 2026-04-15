# Sync Multi Chat — Design System

> Design source of truth for the Sync Multi Chat Electron app.
> Extracted by Design Farmer (Phase 0–4.5 subset) from `src/renderer/styles/` (27 partials, 12,015 lines total).

- **Product**: Sync Multi Chat (Multi-AI Chat Broadcaster)
- **Platform**: Electron 39.2 desktop (macOS, Windows) — renderer-only styles
- **Styling approach**: Vanilla CSS with CSS Custom Properties (no Tailwind, no CSS-in-JS)
- **Color format (current)**: HSL space-separated tokens (Tailwind v3 shadcn/ui convention) + `hsl()` / `rgba()` literals + residual hex in preview-theme scope
- **Color format (target)**: OKLCH (recommended, Baseline 2023 — Electron 39 / Chromium ≥ 113)
- **Design maturity**: **Emerging** (mature token spine + 27-partial architecture; 194 stylelint warnings on preview-theme hex remain as documented tech-debt)
- **Theme strategy**: Dark-only for app chrome; **scoped light/dark pairs** inside Markdown/Mermaid/CPB preview contexts (see §2.6)
- **Quality enforcement**: Stylelint (`color-no-hex` = error in `components/`, warning in `features/` & `modals/`) + husky pre-commit gate (`lint-staged`)

---

## Config

```yaml
systemPath: src/renderer
framework: electron-vanilla-js
packageManager: npm
stylingApproach: vanilla-css-with-custom-properties-imports
componentScope: custom (Electron-renderer UI)
themeStrategy: dark-only-with-scoped-preview-themes
themeLibrary: none
brandColor: "oklch(0.55 0.23 288)"  # violet primary
radiusTone: medium (0.5rem base, 4–20px component radii)
accessibilityLevel: AA (WCAG 2.x target); APCA validation recommended
targetPlatforms: [macOS, Windows]
designMaturity: emerging
maturityScore: 5
lintEnforcement: stylelint + husky pre-commit
```

---

## 1. Architecture Snapshot

### 1.1 File topology

```
src/renderer/
├── index.html                  # root shell (sidebar + main + panels)
├── styles.css                  # 48-line @import manifest (cascade-ordered)
├── styles/
│   ├── 00-fonts.css            # @font-face — Noto Sans/Mono
│   ├── 01-tokens.css           # :root CSS custom properties (CANONICAL TOKEN SOURCE)
│   ├── 02-base.css             # body + container layout
│   ├── 03-scrollbars.css       # app-wide dark scrollbar theming
│   ├── components/             # 11 files — reusable UI components (STRICT: no hardcoded hex)
│   │   ├── sidebar.css                     (377 L)
│   │   ├── task-workspace.css              (603 L)
│   │   ├── artifact-cards.css              (124 L)
│   │   ├── bottom-input.css                (177 L)
│   │   ├── typing-thinking.css             (37 L)
│   │   ├── tool-blocks.css                 (97 L)
│   │   ├── chat-markdown.css               (71 L)
│   │   ├── permission-dialog.css           (101 L)
│   │   ├── customize-panel.css             (355 L)
│   │   ├── api-key-banner.css              (31 L)
│   │   └── settings-panel.css              (170 L)
│   ├── features/               # 8 files — larger feature surfaces (stylelint: color-no-hex=warning)
│   │   ├── prompt-hub.css                  (812 L)
│   │   ├── prompt-hub-gridjs.css           (460 L) — Grid.js dark theme
│   │   ├── prompt-hub-preview.css          (421 L)
│   │   ├── prompt-hub-selection.css        (294 L)
│   │   ├── history.css                     (138 L)
│   │   ├── history-preview.css             (4,557 L) — LARGE, candidate for sub-split
│   │   ├── chat-mode.css                   (199 L)
│   │   └── custom-prompt-builder.css       (2,283 L)
│   └── modals/                 # 4 files — overlay/modal layer
│       ├── prompt-expand.css               (64 L)
│       ├── confirm.css                     (92 L)
│       ├── variable-input.css              (168 L)
│       └── preview.css                     (230 L)
├── fonts/                      # Noto Sans + Noto Sans Mono (Latin woff2, OFL-1.1)
├── renderer.js, custom-prompt-builder.js, prompt-hub.js, history-manager.js
└── vendor/                     # 3rd-party libs (gridjs, highlight.js, katex, mermaid…)
```

### 1.2 Cascade order (enforced by `styles.css` manifest)

```
fonts  →  tokens  →  base  →  scrollbars  →  components  →  features  →  modals
```

Do NOT reorder without a full cascade audit. Adding a new partial requires a new `@import` line at the correct ordering bucket.

### 1.3 Surface inventory

- **~759 unique top-level class selectors** (≈ 943 total class references including nested/compound selectors) across all partials
- **10 `@keyframes` blocks** / 9 unique animation names (`spin` declared twice — see §4.4)
- **29 `:root` tokens** (see §2.2) + **23 scoped sub-theme tokens** for ZenUML/Mermaid (see §2.5) + **4 scoped scale tokens** for Prompt Hub / CPB (see §3.2)
- **4 scoped preview-theme pairs** (light + dark) — see §2.6

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
| `green.500` | `hsl(142 72% 50%)` | `oklch(0.70 0.19 152)` | status active (`--success`) |
| `green.400` | `hsl(160 60% 40%)` | `oklch(0.60 0.14 165)` | "New Task" accent button |
| `red.500` | `hsl(0 72% 50%)` | `oklch(0.60 0.23 27)` | stop/destructive action |
| `red.600` | `hsl(0 62.8% 30.6%)` | `oklch(0.40 0.145 27)` | destructive token |
| `amber.400` | `hsl(38 92% 50%)` | `oklch(0.77 0.17 71)` | `--warning` (model-select flash) |
| `blue.400` | `hsl(200 80% 25% / 0.4)` | `oklch(0.40 0.10 230 / 0.4)` | info chip background |

### 2.2 Semantic tokens (canonical — `src/renderer/styles/01-tokens.css`)

These exist in `:root` and are the **only source of truth** consumed by components. Values stored as HSL space-separated for alpha-channel modulation (`hsl(var(--primary) / 0.42)`).

**Core (shadcn/ui convention)**

| Token | HSL | Role |
|-------|-----|------|
| `--background` | `224 71.4% 4.1%` | app surface |
| `--foreground` | `210 20% 98%` | primary text |
| `--card` / `--card-foreground` | same as bg/fg | raised surface |
| `--popover` / `--popover-foreground` | same as bg/fg | popover surface |
| `--primary` | `263.4 70% 50.4%` | brand action |
| `--primary-foreground` | `210 20% 98%` | text on primary |
| `--secondary` / `--secondary-foreground` | `215 27.9% 16.9%` / fg | subtle action |
| `--muted` / `--muted-foreground` | `215 27.9% 16.9%` / `217.9 10.6% 64.9%` | subdued surface + captions |
| `--accent` / `--accent-foreground` | same as muted | accent surface |
| `--destructive` / `--destructive-foreground` | `0 62.8% 30.6%` / fg | danger |
| `--border` / `--input` | `215 27.9% 16.9%` | separators, input borders |
| `--ring` | `263.4 70% 50.4%` (= primary) | focus ring |
| `--radius` | `0.5rem` | default corner radius |

**Semantic extensions (added 2026-04-15 during DESIGN.md enforcement)**

| Token | HSL | Role |
|-------|-----|------|
| `--warning` / `--warning-foreground` | `38 92% 50%` / `38 92% 10%` | amber — model-select flash |
| `--success` | `142 72% 50%` | green — status live dot |
| `--surface-white` | `0 0% 100%` | opaque white for HTML preview iframes |
| `--muted-icon-fg` | `0 0% 60%` | placeholder icon on dark surfaces |
| `--muted-icon-fg-hover` | `0 0% 87%` | icon hover state |

**Typography / scale tokens**

| Token | Value | Role |
|-------|-------|------|
| `--font-sans` | `"Noto Sans", -apple-system, …` | primary UI font |
| `--font-mono` | `"Noto Sans Mono", ui-monospace, …` | code surfaces |
| `--smc-fs-placeholder` | `max(10.5pt, 0.78rem)` | placeholder text size (one step below body) |

**Usage pattern**

```css
/* correct: alpha via space-separated hsl */
background: hsl(var(--primary) / 0.42);

/* correct: semantic token, no fallback needed */
color: hsl(var(--muted-foreground));

/* WRONG: hardcoded hex — blocked by stylelint in components/ */
color: #cbd5e1;
```

### 2.3 Status / Chip palette

Alpha-blended variants consumed by task-status-dot, chat-badge, message chips.

| Status | Background | Foreground | Border |
|--------|-----------|------------|--------|
| Neutral | `hsl(220 10% 25%)` | `hsl(220 10% 60%)` | — |
| Info | `hsl(200 80% 25% / 0.4)` | `hsl(200 80% 70%)` | — |
| Success | `hsl(142 40% 25% / 0.4)` | `hsl(142 60% 65%)` | — |
| Warning | `hsl(var(--warning))` + glow | `hsl(var(--warning-foreground))` | `hsl(var(--warning) / 0.5)` |
| Danger | `hsl(0 72% 50% / 0.1)` | `hsl(0 72% 70%)` | `hsl(0 72% 50% / 0.2)` |

### 2.4 Contrast audit (APCA + WCAG)

- Body text `hsl(var(--foreground))` on `hsl(var(--background))` → Lc ≈ 103, WCAG ≈ 21:1 → ✅ AAA
- Muted text `hsl(var(--muted-foreground))` on `hsl(var(--background))` → Lc ≈ 68, WCAG ≈ 6.2:1 → ✅ AA body; borderline at < 14px + weight 400
- Primary button text on primary → WCAG ≈ 5.4:1 → ✅ AA
- Alpha-blended status chips → **runtime revalidation required** (effective L changes with stacked transparency)

**Rule**: never adjust chroma for contrast — modify L only. Re-validate APCA after any token change.

### 2.5 ZenUML / Mermaid sub-theme tokens

Scoped to `.chat-thread-preview-task-state .zenuml`-like selectors inside `styles/features/history-preview.css` (lines ~2339–2383). **These are separate from the app-chrome token layer** and should be edited as a unit when theming the ZenUML/Mermaid diagram renderer.

| Token | Value | Role |
|-------|-------|------|
| `--color-bg-base` | `transparent` | diagram canvas bg |
| `--color-text-base` | `#cbd5e1` | primary text |
| `--color-text-secondary` | `#94a3b8` | secondary text / fragment labels |
| `--color-border-base` | `hsl(220 15% 45%)` | generic element border |
| `--color-border-primary` | `hsl(220 20% 50%)` | accent border |
| `--color-outline-primary` | `hsl(220 20% 50%)` | outline strokes |
| `--color-message-arrow` | `hsl(220 15% 55%)` | sequence-diagram arrows |
| `--color-bg-participant` | `hsl(220 20% 18%)` | participant box bg |
| `--color-text-participant` | `#e2e8f0` | participant label |
| `--color-border-participant` | `hsl(220 20% 45%)` | participant border |
| `--color-shadow-participant` | `none` | participant shadow (off) |
| `--color-bg-occurrence` | `hsl(220 15% 22%)` | occurrence stripe bg |
| `--color-border-occurrence` | `hsl(220 15% 40%)` | occurrence border |
| `--color-shadow-occurrence` | `none` | occurrence shadow (off) |
| `--color-bg-fragment-header` | `hsl(220 15% 20%)` | fragment header bg |
| `--color-text-fragment-header` | `#94a3b8` | fragment header text |
| `--color-text-fragment` | `#94a3b8` | fragment body text |
| `--color-border-fragment` | `hsl(220 15% 35%)` | fragment border |
| `--color-border-frame` | `hsl(220 15% 35%)` | frame border |
| `--color-bg-frame` | `transparent` | frame bg |
| `--color-bg-title` | `hsl(220 15% 16%)` | title bar bg |
| `--color-text-title` | `#e2e8f0` | title text |
| `--color-text-message` | `#cbd5e1` | message text |

**Forbidden**: do not mix these with the `--foreground` / `--muted-foreground` tokens. ZenUML's CSS expects the `--color-*` convention; breaking it corrupts diagram theming.

### 2.6 Preview theme system (light/dark scoped pairs)

The app chrome is dark-only, but Markdown/Mermaid/CPB **preview panes** support light-or-dark rendering based on user preference. This is implemented as **scoped theme classes**, not root-level theme switches.

| Scope selector | Context | Source file |
|----------------|---------|-------------|
| `.inline-preview-dark` / `.inline-preview-light` | Master input inline preview (main composer) | `features/custom-prompt-builder.css` |
| `.cpb-preview-theme-dark` / `.cpb-preview-theme-light` | CPB (Custom Prompt Builder) preview pane | `features/custom-prompt-builder.css` |
| Mermaid node-label contrast | Mermaid diagrams inside preview | `features/history-preview.css` |
| Mermaid light foreignObject halo | Colored classDef node labels on light bg | `features/history-preview.css` |

**Why light-theme hex colors persist in `features/`**: these are the CSS literals (`#e2e8f0`, `#94a3b8`, `#fca5a5`, `#f8fafc`, `#1a1a2e`, …) used when a preview pane switches to light mode. They are **intentionally unlinked from `--foreground` / `--background`** because the preview's context inverts relative to the app chrome.

**Stylelint treatment**: these hex values remain as `warning` (194 warnings total across `features/` + `modals/`). Planned remediation: introduce a `--preview-light-*` token family in a future PR (see §11 Migration Roadmap, Step 7).

---

## 3. Typography

### 3.1 Families

```css
--font-sans: "Noto Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
             "Helvetica Neue", Arial, sans-serif;
--font-mono: "Noto Sans Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
```

Self-hosted via `@font-face` at weights **400 / 500 / 600 / 700** for both families (Latin only, woff2, `font-display: swap`). Located in `src/renderer/fonts/`.

### 3.2 Type scale

Two overlapping scales coexist (see §8 Known Issues — scheduled consolidation).

**(a) General app scale** — raw `rem`/`px`, set per component:

| Usage | Size | Weight | Line-height |
|-------|------|--------|-------------|
| Hero title (empty state) | `1.5rem` | 700 | — |
| Panel title | `1.1rem` | 600 | — |
| Chat body | `0.9rem` | 400 | 1.5 |
| Task-mode option label | `0.85rem` | — | 1.25 |
| Card / meta / section title | `0.82rem` | 600 | 1.4–1.6 |
| Captions, code meta | `0.78rem` | 500 | 1.3 |
| Micro labels (badges) | `0.72rem` / `0.7rem` | 600–700 | — |
| Smallest (edit hints) | `0.68rem` | 500 | 1.3 |
| Grid.js rows | `12px` / `13px` | 400 | default |

**Observed frequency distribution** (top 5 sizes): `12px` (29×), `13px` (27×), `0.8rem` (27×), `11px` (25×), `0.78rem` (21×). Consolidation target: reduce to ≤ 8 canonical sizes.

**(b) Full-panel scale** — scoped via `--smc-fs-*` inside `.smc-full-panel`:

```css
--smc-fs-body:        max(12pt, 0.9rem);
--smc-fs-value:       0.95rem;
--smc-fs-section:     0.88rem;
--smc-fs-table:       0.8rem;
--smc-fs-meta:        0.75rem;
--smc-fs-caption:     0.72rem;
--smc-fs-placeholder: max(10.5pt, 0.78rem);  /* also defined at :root */
```

**(c) Scoped scale tokens — Prompt Hub / CPB**

Inherit from `--smc-fs-*` and cascade through nested scopes.

| Token | Fallback chain | Role |
|-------|----------------|------|
| `--ph-list-fs` | `--ph-category-depth1-fs` → `--smc-fs-table` → `0.8rem` | Prompt Hub list rows |
| `--ph-sidebar-list-fs` | `--ph-list-fs` → `--smc-fs-table` → `0.8rem` | Prompt Hub sidebar list |
| `--ph-category-depth1-fs` | `--smc-fs-table` → `0.8rem` | Category depth-1 labels |
| `--cpb-ph-filter-input-r-inset` | `10px` (literal) | CPB filter input right-inset (layout, not type) |

**Letter-spacing**: uppercase badges `0.02em`–`0.04em`. Default 0.

### 3.3 Code typography

- Inline code: `font-size: 0.95em` (relative to parent), background `hsl(220 15% 18%)`, radius `3px`, padding `1px 4px`.
- Block code (`pre`): `font-size: 0.84rem`, background `hsl(220 15% 10%)` (dark preview) / `hsl(220 15% 8%)` (Customize detail), padding `10–12px`, radius `6px` or `var(--radius)`.

---

## 4. Spacing, Radii, Shadows, Motion

### 4.1 Spacing

No formal spacing token — raw pixels and rems used inline. Observed canonical steps: `2, 3, 4, 6, 8, 10, 12, 14, 16, 20, 24, 32 px` — effectively a 4px/2px base grid.

**Proposed tokenization** (future refactor):

```css
--space-1: 4px;   --space-2: 8px;   --space-3: 12px;  --space-4: 16px;
--space-5: 20px;  --space-6: 24px;  --space-8: 32px;
```

### 4.2 Radii

| Value | Count | Use |
|-------|-------|-----|
| `var(--radius)` = 8px | 66× | **canonical default** — buttons, inputs, chat panels |
| `999px` | 50× | pill — rail buttons, scroll thumb, status chips |
| `8px` | 47× | literal 8px equivalent to `--radius` (candidate for token substitution) |
| `6px` | 30× | tight — inline `pre`, chip dismiss |
| `4px` | 26× | small — tooltip tags, resize handles |
| `10px` | 24× | medium — task panels, popovers, Grid.js cells |
| `50%` | 16× | circle — avatar, send button, status dots |
| `14px` | 8× | large — permission dialog shell, composer gradient frame |
| `12px` | 8× | comfortable — message bubbles, empty-state composer |
| `3px` / `5px` / `7px` | 20× | special-purpose |

### 4.3 Shadows

All shadows blend to the dark surface with `hsl(0 0% 0% / α)` or `rgba(0,0,0,α)`.

| Level | Value | Purpose |
|-------|-------|---------|
| focus | `0 0 0 1px hsl(var(--ring))` | inputs, model selector |
| subtle | `0 0 0 1px hsl(var(--primary) / 0.12)` | active rail button |
| chip-ring | `0 0 0 1px hsl(var(--primary) / 0.25)` | chip toggled |
| popover | `0 12px 32px hsl(0 0% 0% / 0.5)` | dropdown, popover |
| modal | `0 8px 32px hsl(0 0% 0% / 0.4)` | permission dialog, history modal |
| panel | `-6px 0 24px rgba(0,0,0,0.35)` | `.smc-full-panel` left edge |
| glow-warning | `0 0 12px hsl(var(--warning) / 0.5)` | model-select flash |
| glow-success | `0 0 4px hsl(var(--success) / 0.5)` | live status dot |
| pulse-stop | `0 0 0 8px hsl(0 72% 50% / 0)` → `0.5` | stop button animation |

### 4.4 Motion — `@keyframes` inventory

Total: **10 `@keyframes` blocks** across 4 partials (9 unique animation names — `spin` is declared identically in two files for locality; both definitions must stay in sync).

| Keyframe | File | Purpose |
|----------|------|---------|
| `typingBounce` | `components/typing-thinking.css` | 3-dot bounce typing indicator |
| `thinkingPulse` | `components/tool-blocks.css` | reasoning block breathing |
| `stopPulse` | `components/bottom-input.css` | stop button 3-stage ring expand |
| `task-pulse` | `components/task-workspace.css` | ambient task-status badge breathing (also consumed by `components/settings-panel.css`) |
| `msgFadeIn` | `components/task-workspace.css` | chat message enter |
| `modelSelectFlash` | `components/task-workspace.css` | 3-blink amber warning on model selector |
| `spin` (2 definitions) | `components/settings-panel.css` + `features/history-preview.css` | reload / copy-button rotation |
| `cpbDialogFadeIn` | `features/custom-prompt-builder.css` | CPB dialog backdrop |
| `cpbDialogPopIn` | `features/custom-prompt-builder.css` | CPB dialog scale-pop entry |

**Duration defaults**:
- Interactive transitions: `0.15s ease` (background / color / border / box-shadow)
- Dense hover states: `0.12s`
- Sidebar expand: `width 0.28s cubic-bezier(0.4, 0, 0.2, 1)` (Material standard)
- Keyframes: all under 2s, most under 1s

**Principle**: transitions ≤ 300ms, easing is `ease` / `ease-in-out` / Material cubic-bezier. No spring physics.

**Missing guard**: `@media (prefers-reduced-motion)` — scheduled in §11 Migration Roadmap, Step 6.

---

## 5. Component Inventory (~759 top-level classes)

### 5.1 Shell (`components/sidebar.css`, top-bar in `features/history-preview.css`)

- `#app-container`, `#main-content`, `#history-sidebar` (rail, 48 px collapsed → expanded)
- `.sidebar-rail-btn`, `.rail-btn-label`, `.sidebar-footer`, `.sidebar-rail-separator`, `.sidebar-rail-spacer`
- `#new-chat-btn`, `#new-task-btn` (primary + accent variants)
- `.settings-btn`, `.user-status`
- **Top bar**: `#top-bar`, `#top-bar-toggle` (floating), `.top-bar-hidden` state
- **URL bar (URLBAR-001)**: `.url-bar`, `.url-bar-btn`, `.url-bar-buttons`, `.close-btn`, `.copy-last-response-btn`, `.header-btn` (reload / copy spin animations)
- **Maximized view**: `.maximized-view-*` (webview fullscreen mode)
- **Splitters / resize**: `.splitter`, `.resize-handle`, `.ph-resize-handle`, `.cpb-resize-handle`
- **Views placeholder**, **App-level popup layer** (BrowserView overlap handling)

### 5.2 Task workspace (chat) — `components/task-workspace.css` + `components/bottom-input.css` (104 `.task-*` classes)

- `.task-chat`, `.task-chat-messages`, `.task-chat-empty`
- `.task-chat-bubble` (assistant / user variants) with `msgFadeIn`
- `.task-chat-bubble-content` — markdown renderer surfaces
- `.task-msg-actions`, `.task-msg-action-btn`, `.task-msg-edit-btn`
- `.task-chat-chip`, `.task-chat-chip-remove` (attachment chips)
- `.task-composer`, `.task-composer-toolbar`
- `.task-mode-option`, `.task-mode-dropdown`, `.task-mode-icon`
- `.task-status-dot` (idle / live / stopped)
- **Stopped notice**: `.stopped-notice`
- **Task attach menu** (skill selection popover above composer): `.task-attach-menu`, `.task-attach-menu-option`, `.task-attach-menu-divider`, `.task-attach-menu-label`
- **Skill chips inside composer**: `.task-skill-chip`, `.task-skill-chip-remove`
- **Composer toggles + hints**: `.plugins-toggle`, `.plugins-toggle-slider` (power-style switch), `.task-chat-input-hint` (send-hint below toolbar, shown in empty state)

### 5.3 Feedback — `components/typing-thinking.css` + `components/tool-blocks.css`

- `.typing-indicator` — 3-dot `typingBounce`
- `.thinking-block` — reasoning reveal with `thinkingPulse` (keyframe defined in `components/tool-blocks.css`)
- `.tool-execution-block` — tool call surface with start/success/error states
- `.model-select-flash` — 3-blink amber warning ring

### 5.4 Artifacts & Markdown — `components/artifact-cards.css` + `components/chat-markdown.css`

- `.artifact-card`, `.artifact-preview` — rendered output cards for tool/AI artifacts
- Markdown render rules for `pre`, `code`, `blockquote`, `ul/ol`, `h1–h6`, `table`, `hr`, `a`

### 5.5 Panels — `components/customize-panel.css` + `components/settings-panel.css` + `components/api-key-banner.css` + `features/prompt-hub*.css` (89 `.ph-*` + 41 `.smc-*`)

- **Shell**: `.smc-full-panel`, `.smc-panel-chrome`, `.smc-panel-breadcrumb`, `.smc-panel-title`, `.smc-panel-overlay-stack`, `.has-open-panel`
- **Settings Panel**: `.settings-section`, ChatGPT subscription block, Task history badges
- **API key banner**: `.api-key-banner` (standalone file `components/api-key-banner.css`, 31 L)
- **Customize Panel** (3-panel layout): tree toggle, list content, detail content, Coming Soon overlay, file/dir tree
- **Prompt Hub** (`ph-*`, 89 classes):
  - Overlay chrome, filter sidebar (resize + collapse), categories row, tag input
  - DnD tree with drop-target highlights
  - Grid.js custom theme (see §6)
  - Preview cards (full prompt body, line-break preserving)
  - Selection bar (always in DOM, show/hide with transition)

### 5.6 Modals — `modals/*.css` + scattered

**Shared base classes** (consumed by all modals — defined in `features/history-preview.css` around lines 3841–4023):

- `.modal-content` — the dialog container (width, padding, centering, shadow)
- `.modal-header` + `.modal-header h2` — title bar
- `.modal-body` — scrollable content region
- `.modal-divider` — horizontal separator between sections

Individual modal files below **extend** (not replace) these base classes. Overrides for width, padding, or background must use double-class selectors (`.modal-content.chat-thread-preview-shell`) to preserve specificity.

| Modal | File | Selectors |
|-------|------|-----------|
| Permission Dialog | `components/permission-dialog.css` | `.permission-dialog`, `.permission-actions` |
| Confirm | `modals/confirm.css` | `.confirm-modal`, `.modal-header`, `.modal-body`, `.modal-divider` |
| Variable Input | `modals/variable-input.css` | `.variable-input-modal`, `.var-input-row` |
| Preview (full-screen) | `modals/preview.css` | `.preview-modal`, `.preview-modal-split`, `.preview-modal-editor-pane`, `.preview-modal-preview-pane`, `.preview-modal-header-actions` |
| Prompt Expand/Collapse | `modals/prompt-expand.css` | `.prompt-expand-btn`, `.prompt-area-expanded` |
| Chat Thread Preview Modal | `features/history-preview.css` | `.chat-thread-preview-shell`, `.chat-thread-preview-grid`, `.chat-thread-preview-body`, `.chat-thread-preview-task`, `.chat-thread-entry*` |
| Cross Check Modal | `features/history-preview.css` | `.cross-check-btn`, `.cross-check-content` |
| Upload Confirm Modal | `features/custom-prompt-builder.css` | upload file sync flow |
| Session Slash Insert | `features/custom-prompt-builder.css` | `.slash-insert-modal`, `.slash-insert-dialog`, `.slash-insert-btn` |
| History Modal | `features/history-preview.css` | `.history-modal-content` |
| CPB Import/Export Dialog | `features/custom-prompt-builder.css` | `.cpb-dialog-backdrop`, `.cpb-dialog-modal`, `.cpb-dialog-header`, `.cpb-dialog-body`, `.cpb-dialog-footer`, `.cpb-dialog-report`, `.cpb-dialog-list`, `.cpb-dialog-close` (with `cpbDialogFadeIn` + `cpbDialogPopIn`) |
| Unresolved Vars Modal | `features/custom-prompt-builder.css` | CPB-only |

### 5.7 Composer / input — `components/bottom-input.css` (177 L) + `#master-input` fragments

- `#master-input`, `.prompt-toggle`, `.layout-group`
- Clip button, Send button (send ↔ stop state toggle with `stopPulse`)
- File preview, skill chips
- Autocomplete popup, slash command menu, variable mini form
- Main input/preview scrollbar (modern dark style)
- `#master-input` is referenced ~15 times across `features/history.css`, `features/history-preview.css`, and `modals/prompt-expand.css` — the composer shell lives in `components/bottom-input.css` while inline-preview and session-modal variants extend it from feature files.

### 5.8 Custom Prompt Builder — `features/custom-prompt-builder.css` (164 `.cpb-*` classes, 2,283 lines)

The app's **largest feature surface**. Sub-regions:

- **Overlay root**: `.cpb-app`, `.cpb-topbar`, `.cpb-back`, `.cpb-badge`
- **Sidebar** (collapsible, Prompt Hub–aligned strip): `.cpb-sidebar`, `.cpb-ph-panel`
- **Editor**: `.cpb-editor-wrap`, `.cpb-center`, `.cpb-live-preview-on` (split pane)
- **Variables Panel**: `.cpb-vars-*` (resizable, scroll-synced)
- **Preview**: `.cpb-preview`, `.cpb-preview-theme-dark`, `.cpb-preview-theme-light`
- **EasyMDE/CodeMirror overrides** (see §7)
- **Footer**: `.cpb-footer-action-bar`
- **Dialogs**: `.cpb-dialog-*` family
- **Zen toggle**, **More menu** (hidden), **Inline markdown toolbar**

### 5.9 Controls — scattered across `features/history-preview.css` + `features/custom-prompt-builder.css`

- Modern checkbox / toggle / switch (`.anonymous-btn` power-style, scroll-sync switch)
- Button variants: `.btn-primary`, `.btn-secondary`, `.btn-outline`, `.btn-ghost`, `.btn-danger`
- Note: `.btn-ghost-danger` and legacy sidebar-footer override were removed (dead-code marker in `features/history-preview.css`)

### 5.10 History sidebar — `features/history.css`

- Chat history list, `.history-item`, mode badge, scroll container
- Modern scrollbar matching `#master-input`

### 5.11 Chat mode — `features/chat-mode.css`

- `.chat-mode-btn`, `.chat-mode-modal`, `.option-card`, Single AI selection, current mode indicator

### 5.12 Missing surface addendum (2026-04-15 cross-tool audit)

Previously under-described selectors discovered during a Cursor/Codex cross-review. Goal: prevent feature drift between actual renderer UI and this document.

#### 5.12.1 CPB Fullscreen Preview Subsurface — `features/custom-prompt-builder.css` (lines ~914–1028)

The CPB preview flow includes a fullscreen layer beyond the inline `.cpb-preview`.

| Selector | Role |
|---|---|
| `.cpb-preview-fs-fab` | floating action button that enters fullscreen preview |
| `.cpb-preview-fs-overlay` | fixed-position overlay (`z-index: 12050`) |
| `.cpb-preview-fs-overlay:not([hidden])` | visible state (flex) |
| `.cpb-preview-fs-panel` | panel container inside the overlay |
| `.cpb-preview-fs-inner` | scrollable inner content wrapper |
| `.cpb-preview-fs-close` | close-fullscreen button |
| `.cpb-preview-stack.cpb-has-visible-preview` | state gate that reveals preview controls |

**Theme linkage**:
- `.cpb-preview-fs-panel[data-preview-theme="light"]` — light override
- `.cpb-preview-fs-panel[data-preview-theme="dark"]` — default dark fallback
- Close button theme variants inherit from the panel's `data-preview-theme` attribute

#### 5.12.2 Master inline preview + prompt-block surface — `features/history-preview.css`

Inline preview for the master input (main composer) is theme-scoped and has its own prompt-block subsurface.

| Selector | Role |
|---|---|
| `.master-preview` | inline preview host for master input / session context |
| `.master-preview::-webkit-scrollbar*` | scoped scrollbar variant (also see §6.7) |
| `.master-preview-theme` | theme switch group wrapper |
| `.master-preview-theme-btn` / `.master-preview-theme-btn.active` | light/dark toggle buttons |
| `.master-preview-inline-btn` | inline preview action button |
| `.master-preview-theme-light` / `.master-preview-theme-dark` | scoped preview theme classes (§2.6 family) |
| `.master-preview .mi-var` / `.mi-var-resolved` / `.mi-var-reserved` / `.mi-var-unresolved` | variable-highlighting inside preview |
| `.master-preview .mi-edit-btn` | inline edit action for variables |
| `.prompt-block-wrapper` | prompt-block container (themed by parent `.cpb-preview-theme-*`) |
| `.prompt-block-header` | prompt-block header row |
| `.prompt-block-content` | prompt-block body content |
| `.prompt-block-view-btn` / `.prompt-block-view-btn.active` | expand/view toggle |
| `.prompt-block-copy-btn` | copy action |

**Render mode variants**:
- `.cpb-preview-md` (markdown render)
- `.cpb-preview-plain` (plain-text render)

#### 5.12.3 SMC overlay target IDs — `features/prompt-hub.css` (lines ~132–170)

Overlay layout and responsive behavior are ID-scoped and must be preserved when refactoring.

| Selector | Role |
|---|---|
| `#smc-overlay-prompt-hub` | Prompt Hub overlay root |
| `#smc-overlay-history` | History overlay root |
| `#smc-overlay-dashboard` | Dashboard overlay root |
| `#smc-overlay-prompt-hub .ph-filters` | PH sidebar width + responsive override target |
| `#smc-overlay-prompt-hub .ph-grid` | PH grid-template responsive override target |
| `#smc-overlay-history .smc-panel-body-column` | history panel body column layout |
| `#smc-overlay-history .history-toolbar` | history toolbar responsive wrap target |
| `#smc-overlay-history .history-toolbar-search` | history toolbar search field responsive target |
| `#smc-overlay-dashboard .smc-panel-body-dashboard` | dashboard panel body layout |

#### 5.12.4 Critical interaction IDs (composer / modal coupling)

ID-coupled behavior that must be tracked as part of the design contract. Changing these IDs requires updating both CSS and the JavaScript that binds to them.

| Selector | Role | Reference count |
|---|---|---|
| `#send-btn` | send/stop action button host | 4× |
| `#clip-btn` | file attach trigger | 2× |
| `#input-area` | expanded prompt/modal input area root | 5× |
| `#controls-container` | composer controls container | 15× |
| `#preview-modal-content` | preview modal content root | 27× |
| `#preview-modal-editor` | preview modal editor pane | 6× |
| `#cpb-editor-textarea` | CPB textarea fallback/editor target | 8× |
| `#saved-prompts-table` | saved-prompts table host | 21× |
| `#history-list` | history list container | 8× |

#### 5.12.5 Cross-tool review ground truth (reviewer-error log)

Recurring false positives from external AI reviewers (Cursor/Codex) that have been fact-checked and **rejected**:

| Claim | Verdict | Evidence |
|---|---|---|
| "`components/api-key-banner.css` does not exist" | ❌ False | File exists (803 bytes); imported at `styles.css:31` |
| "The tree has 26 partials, not 27" | ❌ False | `find src/renderer/styles -name "*.css"` returns exactly **27** files |
| "`.skill-chip` is documented but actual is `.task-skill-chip`" | ✅ True | Corrected in §5.2 — actual selectors are `.task-skill-chip` / `.task-skill-chip-remove` (defined at `components/customize-panel.css:344`) |

When future reviewers raise the same claims, verify against `src/renderer/styles/` directly before acting. These claims have been checked twice.

#### 5.12.6 Selector-fidelity rule (for future additions)

When adding or changing renderer styles, update this document using the following rule set:

1. **New selector family** (new prefix like `.foo-*` or new state class) → add at least one explicit entry in the relevant §5.x subsection.
2. **ID-coupled behavior** (overlay targets, action buttons, pane roots) → add an entry to §5.12.3 or §5.12.4.
3. **Theme-scoped styles** (`*-theme-light/dark`, `data-theme` attributes) → document both the default and the override path in §2.6 and the relevant component subsection.
4. **Large feature files** (`history-preview.css`, `custom-prompt-builder.css`) → maintain sub-surface tables (as in §5.12.1, §5.12.2) instead of single summary bullets.

---

## 6. Vendor library overrides

Third-party CSS is re-themed to match the dark app chrome. Owners of these features must be aware that future library upgrades may require re-applying these overrides.

### 6.1 Grid.js — `features/prompt-hub-gridjs.css` (460 lines)

Complete dark theme replacing Grid.js defaults:
- `.gridjs`, `.gridjs-container`, `.gridjs-wrapper`, `.gridjs-table`
- `.gridjs-thead`, `.gridjs-th-content`, `.gridjs-sort`, `.gridjs-sort-asc`/`-desc`/`-neutral`
- `.gridjs-tbody`, `.gridjs-tr`, `.gridjs-resizable`, `.gridjs-loading-bar`, `.gridjs-message`
- Custom column types: star/fav, checkbox, title with ellipsis, summary, actions, selected row

### 6.2 EasyMDE + CodeMirror — `features/custom-prompt-builder.css`

- `.EasyMDEContainer` — wrapper restyling
- `.CodeMirror`, `.CodeMirror-focused`, `.CodeMirror-cursor`, `.CodeMirror-selected`, `.CodeMirror-line`, `.CodeMirror-linenumber`, `.CodeMirror-gutters`
- Native scrollbar hidden via margin trick; custom visible scrollbar on `.CodeMirror-vscrollbar` / `.CodeMirror-hscrollbar`

### 6.3 Mermaid — `features/history-preview.css` (node-label contrast) + inline overrides

- `.mermaid`, `.mermaid-block-toolbar`
- Mermaid fullscreen modal, inline preview column-flex wrapper
- Light-theme foreignObject label contrast (JS sets class; CSS applies halo to colored classDef nodes)

### 6.4 ZenUML — `features/history-preview.css` (lines ~2339–2383)

Dark theme overrides via 23 `--color-*` CSS variables (see §2.5). Applied to sequence/class/state diagrams.

### 6.5 KaTeX / highlight.js

No custom CSS overrides — vendor default stylesheets loaded from `src/renderer/vendor/`.

### 6.6 EasyMDE toolbar

- `.EasyMDEContainer .editor-toolbar` — restyled toolbar container (flat, dark)
- `.editor-toolbar button` — hover + `.active` state
- `.editor-toolbar i.separator` — separator line theming
- Scoped under `.cpb-editor-highlight-wrap` to prevent bleed into other EasyMDE instances

### 6.7 Scrollbar variants

`03-scrollbars.css` defines the app-wide dark scrollbar. Additional scoped variants exist per surface:

| Scope | Purpose | File |
|-------|---------|------|
| `*::-webkit-scrollbar` (global) | App-wide dark scrollbar | `03-scrollbars.css` |
| `#master-input` scrollbar | Composer scrollbar, matches modern dark style | `components/bottom-input.css` |
| `.cpb-preview.cpb-preview-theme-dark` | CPB/Session preview dark scrollbar (10px, no arrows) | `features/custom-prompt-builder.css` |
| `.cpb-preview.cpb-preview-theme-light` | CPB/Session preview light scrollbar | `features/custom-prompt-builder.css` |
| `.CodeMirror-vscrollbar` / `.CodeMirror-hscrollbar` | CodeMirror visible scrollbars (native hidden via margin trick) | `features/custom-prompt-builder.css` |
| Chat history modern scrollbar | Matches `#master-input` styling | `features/history.css` |
| Block content scrollbar dark + light | Mermaid/preview block-level scrolling | `features/history-preview.css` |
| Textarea modern scrollbar + diagonal resize handle | History modal textarea | `features/history-preview.css` |

**Rule**: when adding a new surface with overflow, default to the global dark scrollbar. Only add a scoped variant if the surface has a different color scheme (e.g., light preview pane) or a distinct size requirement.

---

## 7. Interaction states

### 7.1 Hover / active / focus

- `.active` — rail buttons, mode tabs, selected options
- `.is-open` — panels, dropdowns
- `.has-open-panel` — enables pointer-events on overlay stack
- `.selected` — Grid.js rows, tree nodes
- `.expanded` / `.collapsed` — panels, tree directories, prompt area
- `.disabled` — buttons, form controls

### 7.2 Focus management

- **Focus ring**: `box-shadow: 0 0 0 1px hsl(var(--ring))` — thin; consider 2px for AA improvement
- `:focus-visible` used in 3 files: `features/custom-prompt-builder.css`, `features/history-preview.css`, `features/prompt-hub.css`. Other surfaces rely on `:focus` — recommend broader `:focus-visible` migration for keyboard-only UX.

### 7.3 Drag & Drop

- `.dragging` — source element during drag (opacity reduced)
- `.drop-target` / `.drag-over` — DnD target highlights (used in Prompt Hub tree)
- Custom drag preview stylized with rotation + shadow
- Session modal DnD for file uploads

### 7.4 Animation triggers

- `modelSelectFlash` — triggered when user tries to send without model selection
- `stopPulse` — triggered on send → stop state transition during generation
- `task-pulse` — ambient during task run
- `cpbDialogPopIn` — CPB import/export dialog entry

---

## 8. Responsive Strategy

Desktop-first breakpoints (primary target ≥ 1200px, Electron desktop):

| Breakpoint | Scope |
|------------|-------|
| `min-width: 1100px` | PH overlay filter width override (grid → flex swap) |
| `max-width: 1200px` | wide app compaction |
| `max-width: 980px` | medium compaction |
| `max-width: 800px` | small-desktop |
| `max-width: 768px` | tablet landscape |
| `max-width: 720px` | dashboard tables collapse |
| `max-width: 640px` | mobile (rare in Electron, supported) |

---

## 9. Accessibility Notes

- **Focus ring**: 1px via box-shadow — functional but under AA recommended weight; consider 2px ring in a future polish pass.
- **Contrast** (§2.4): body/primary pass AA; alpha-blended status chips need runtime APCA validation.
- **Font smoothing**: `-webkit-font-smoothing: antialiased` on body.
- **Reduced-motion guard**: **MISSING** — `@media (prefers-reduced-motion)` should wrap all 10 keyframes in §4.4.
- **Keyboard navigation**: `:focus-visible` used in 3 feature files; broader migration recommended.
- **APCA note**: APCA Lc 60 ≠ WCAG 2.x 4.5:1 — verify both for legally required accessibility (ADA, EN 301 549).

---

## 10. Known Issues / Improvement Opportunities

1. ~~**Monolithic stylesheet**: 12K lines in one file~~ → **RESOLVED 2026-04-15**: split into 27 partials under `src/renderer/styles/` with `@import` manifest.
2. ~~**Hardcoded literals in components**~~ → **RESOLVED** for `components/` (stylelint error gate); **194 warnings remain** in `features/` + `modals/` (mostly preview-light-theme hex — see §2.6). Scheduled remediation: `--preview-light-*` token family.
3. **Alpha-channel pattern**: `hsl(var(--primary) / 0.42)` is fragile when migrating to OKLCH. Migration target: CSS Color 5 `oklch(from var(--primary) l c h / α)` or pre-computed flattened tokens.
4. **Duplicate typography scales**: general rem/px scale + `--smc-fs-*` scale overlap. Consolidation target: ≤ 8 canonical sizes under one token family.
5. **No reduced-motion guard** — see §9.
6. **No light theme for app chrome**: scoped preview light themes exist (§2.6); full chrome light theme would require `:root[data-theme="light"]` overrides (not planned).
7. **`features/history-preview.css` is 4,557 lines** — candidate for sub-split into `modals/chat-thread-preview.css`, `modals/cross-check.css`, `features/maximized-view.css`, `features/url-bar.css`, etc.
8. **Mixed color formats** within preview scope: HSL space-separated tokens + hex for light palettes. Address via §2.6 remediation.
9. ~~**Dead-code verification needed** (legacy `btn-ghost-danger` / sidebar-footer override)~~ → **✅ VERIFIED 2026-04-15**: only a tombstone comment remains at `features/history-preview.css:559`; no active selectors or references to `btn-ghost-danger` exist anywhere in the stylesheet tree. The comment itself can be removed in the next cleanup pass.

---

## 11. Migration Roadmap

- ~~**Step 1 — Tokenize**: freeze current shadcn `:root` as the semantic layer~~ ✅ (canonical layer in `01-tokens.css`)
- **Step 2 — Sweep literals**: replace residual `hsl(220 15% 18%)` / hex with primitives. Status: partial (`components/` clean, `features/` warnings remain).
- **Step 3 — Switch format**: convert `:root` semantic values from HSL to OKLCH; test rendering on macOS (wide-P3) and Windows (sRGB) displays. Not started.
- ~~**Step 4 — Split stylesheet**: extract into feature files~~ ✅ (27 partials + manifest, 2026-04-15)
- **Step 5 — Add light theme** (optional): `:root[data-theme="light"]` override block for app chrome. Not planned.
- **Step 6 — Reduced-motion**: wrap all 10 keyframes in `@media (prefers-reduced-motion: no-preference)`. Not started.
- **Step 7 — Preview light tokens**: introduce `--preview-light-*` family to dissolve the 194 `color-no-hex` warnings in `features/` + `modals/`. Not started.
- **Step 8 — Sub-split `history-preview.css`**: 4,557 lines → 4–5 smaller partials. Not started.

Each step is non-breaking if done in order; steps 1–3 can be gated behind a feature flag via CSS class toggle on `<html>`.

---

## 12. Enforcement (how this document becomes binding)

1. **CLAUDE.md Section 7.5** — "Design System Protocol" — mandates DESIGN.md read-before-style for all UI PRs.
2. **Stylelint** — `.stylelintrc.json` blocks hardcoded colors in `components/` (error severity); warns in `features/` + `modals/`.
3. **Husky pre-commit + lint-staged** — every `git commit` runs `stylelint` on staged CSS; failure blocks the commit.
4. **PR template** — `.github/pull_request_template.md` Design System checklist must be ticked for UI PRs.
5. **This file** — treat it as the single authoritative reference. Any new token, pattern, or surface must either reuse what's documented here or add an entry to the same PR.

---

## 13. Source Files Analyzed

- `src/renderer/styles/` — 27 partial files, 12,015 lines total
- `src/renderer/index.html` — shell markup
- `src/renderer/custom-prompt-builder.js`, `prompt-hub.js`, `renderer.js`, `history-manager.js` — inline style hooks & class toggles
- `package.json` — Electron 39.2, CommonJS, stylelint + husky + lint-staged
- `.stylelintrc.json`, `.stylelintignore` — lint rules
- `CLAUDE.md` §7.5 — design-system protocol
- `.github/pull_request_template.md` — checklist

---

**Status**: DONE — Design source-of-truth document v2 (post CSS-split, post-Stylelint).
**Last updated**: 2026-04-15 (P0+P1+P2 coverage pass).
**Generated by**: Design Farmer v0.0.6 (Phase 0–4.5 subset) + manual completeness audit.
