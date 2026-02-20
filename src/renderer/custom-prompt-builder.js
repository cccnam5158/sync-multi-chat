// ===========================================
// Custom Prompt Builder (CPB) Module
// ===========================================
// Depends on: renderer.js globals (window.electronAPI, isAnonymousMode, escapeHtml)

(function () {
    'use strict';

    // ---- Storage Keys ----
    const LS_PROMPTS = 'smc_prompts_v1';
    const LS_GLOBALV = 'smc_global_vars_v1';
    const LS_UI = 'smc_ui_v1';

    // ---- System Variables (no active_services per spec) ----
    const SYSTEM_VARS = [
        { name: 'chat_thread', desc: 'Full conversation thread (JSON)', icon: 'S' },
        { name: 'last_response', desc: 'Last AI response', icon: 'S' },
        { name: 'current_time', desc: 'Current time (ISO 8601)', icon: 'S' },
        { name: 'main_prompt', desc: 'Reserved – current main prompt input text (not usable in main/Session editor)', icon: 'S' }
    ];
    const RESERVED_SYSTEM_VARS = ['main_prompt'];
    const RESERVED_MAIN_PROMPT_MSG = '{{main_prompt}} is a reserved system variable and cannot be used in this editor.';
    const RESERVED_MAIN_PROMPT_ACTION = 'Remove {{main_prompt}} to enable sending.';
    const RESERVED_MAIN_PROMPT_FIX_LABEL = 'Quick Fix : Remove {{main_prompt}}';
    const RESERVED_MAIN_PROMPT_TITLE = 'Remove {{main_prompt}} to enable sending.';
    const CPB_EXPORT_SCHEMA = 'smc.cpb';
    const CPB_EXPORT_VERSION = 2;

    // ---- State ----
    let cpbPrompts = [];
    let cpbGlobalVars = [];
    let cpbCurrentId = null;
    let cpbDirty = false;
    let cpbSortMode = 'recent';
    let cpbZen = false;
    let cpbLivePreview = false;
    let cpbPreviewMode = false;
    let cpbScrollSyncLock = false;
    let cpbHighlightVars = true;
    let cpbOnlyMissing = false;
    let cpbEditor = null;
    let cpbSuggestedLocalVars = [];
    const cpbIgnoredSuggestedLocals = new Map();
    let cpbPendingCloseWarnOpen = false;
    let cpbPreviewRenderSeq = 0;
    let cpbPreviewSysCache = null;
    let cpbPreviewSysCacheAt = 0;
    let cpbPreviewSysPending = null;

    // Autocomplete state
    let acOpen = false;
    let acAnchor = -1;
    let acItems = [];
    let acSelected = 0;

    // Debounce timers
    let promptsTimer = null;
    let globalsTimer = null;
    let currentPromptTimer = null;

    // ---- DOM References ----
    let el = {};

    function initElements() {
        el = {
            modal: document.getElementById('cpb-modal'),
            closeBtn: document.getElementById('cpb-close-btn'),
            // Sidebar
            sidebar: document.getElementById('cpb-sidebar'),
            list: document.getElementById('cpb-list'),
            searchInput: document.getElementById('cpb-search'),
            sortBtn: document.getElementById('cpb-sort-btn'),
            btnNew: document.getElementById('cpb-btn-new'),
            btnCollapseSidebar: document.getElementById('cpb-btn-collapse-sidebar'),
            btnImport: document.getElementById('cpb-btn-import'),
            btnExport: document.getElementById('cpb-btn-export'),
            // Topbar
            promptTitle: document.getElementById('cpb-prompt-title'),
            dirtyDot: document.getElementById('cpb-dirty-dot'),
            dirtyText: document.getElementById('cpb-dirty-text'),
            metaText: document.getElementById('cpb-meta-text'),
            btnSave: document.getElementById('cpb-btn-save'),
            btnPreviewTab: document.getElementById('cpb-btn-preview'),
            btnSend: document.getElementById('cpb-btn-send'),
            btnCopyToInput: document.getElementById('cpb-btn-copy-to-input'),
            zenCheck: document.getElementById('cpb-zen-check'),
            btnDup: document.getElementById('cpb-btn-dup'),
            btnDel: document.getElementById('cpb-btn-del'),
            // Editor
            tabEdit: document.getElementById('cpb-tab-edit'),
            tabPrev: document.getElementById('cpb-tab-prev'),
            livePreviewCheck: document.getElementById('cpb-live-preview-check'),
            btnInsertVar: document.getElementById('cpb-btn-insert-var'),
            btnFormat: document.getElementById('cpb-btn-format'),
            hlOn: document.getElementById('cpb-hl-on'),
            hlMissing: document.getElementById('cpb-hl-missing'),
            prompt: document.getElementById('cpb-editor-textarea'),
            highlight: document.getElementById('cpb-editor-highlight'),
            preview: document.getElementById('cpb-editor-preview'),
            ac: document.getElementById('cpb-ac'),
            editorWrap: document.getElementById('cpb-editor-wrap'),
            // Variables
            varsPanel: document.getElementById('cpb-vars'),
            btnCollapseVars: document.getElementById('cpb-btn-collapse-vars'),
            btnExpandVars: document.getElementById('cpb-vars-expand-btn'),
            globalRows: document.getElementById('cpb-global-rows'),
            localRows: document.getElementById('cpb-local-rows'),
            addGlobal: document.getElementById('cpb-add-global'),
            addLocal: document.getElementById('cpb-add-local'),
            localSuggestBox: document.getElementById('cpb-local-suggest-box'),
            localSuggestRows: document.getElementById('cpb-local-suggest-rows'),
            localSuggestCount: document.getElementById('cpb-local-suggest-count'),
            addAllSuggestedLocal: document.getElementById('cpb-add-all-local-suggest'),
            localTabBadge: document.getElementById('cpb-local-tab-badge'),
            globalChips: document.getElementById('cpb-global-chips'),
            localChips: document.getElementById('cpb-local-chips'),
            sysChips: document.getElementById('cpb-sys-chips'),
            // Resize handles
            sbResize: document.getElementById('cpb-sb-resize'),
            varsResize: document.getElementById('cpb-vars-resize'),
        };
    }

    // =============================================
    // Persistence
    // =============================================
    function loadPrompts() {
        try {
            const t = localStorage.getItem(LS_PROMPTS);
            const arr = t ? JSON.parse(t) : [];
            return (Array.isArray(arr) ? arr : []).map(p => ({
                id: p.id ?? uid(),
                title: p.title ?? '',
                content: p.content ?? '',
                localVars: Array.isArray(p.localVars) ? p.localVars : [],
                createdAt: p.createdAt ?? Date.now(),
                updatedAt: p.updatedAt ?? Date.now(),
                lastUsedAt: p.lastUsedAt ?? Date.now(),
            }));
        } catch (e) {
            return [];
        }
    }

    function loadGlobalVars() {
        try {
            const t = localStorage.getItem(LS_GLOBALV);
            const arr = t ? JSON.parse(t) : [];
            return Array.isArray(arr) ? arr.map(v => ({ name: v.name || '', value: v.value || '' })) : [];
        } catch (e) {
            return [];
        }
    }

    function savePrompts() {
        localStorage.setItem(LS_PROMPTS, JSON.stringify(cpbPrompts));
        try { window.electronAPI?.saveCustomPrompts?.(cpbPrompts); } catch (e) { }
    }

    function saveGlobalVars() {
        localStorage.setItem(LS_GLOBALV, JSON.stringify(cpbGlobalVars));
        try { window.electronAPI?.saveCustomPromptGlobalVars?.(cpbGlobalVars); } catch (e) { }
    }

    function savePromptsDebounced() {
        clearTimeout(promptsTimer);
        promptsTimer = setTimeout(savePrompts, 400);
    }

    function saveGlobalVarsDebounced() {
        clearTimeout(globalsTimer);
        globalsTimer = setTimeout(saveGlobalVars, 400);
    }

    function saveCurrentDebounced() {
        clearTimeout(currentPromptTimer);
        currentPromptTimer = setTimeout(() => {
            if (cpbDirty) saveCurrent({ renderListNow: false });
        }, 450);
    }

    function flushPendingCurrentSave() {
        clearTimeout(currentPromptTimer);
        clearTimeout(promptsTimer);
        clearTimeout(globalsTimer);
        if (cpbDirty) saveCurrent({ renderListNow: true });
    }

    function scheduleSidePanelAutoSave() {
        markDirty(true);
        saveCurrentDebounced();
    }

    // Legacy migration
    function migrateFromLegacy() {
        try {
            const legacyRaw = localStorage.getItem('customPrompts');
            if (!legacyRaw) return;
            const legacy = JSON.parse(legacyRaw);
            if (!Array.isArray(legacy) || legacy.length === 0) return;
            const existing = localStorage.getItem(LS_PROMPTS);
            if (existing) { const arr = JSON.parse(existing); if (Array.isArray(arr) && arr.length > 0) return; }
            const migrated = legacy.map(p => ({
                id: p.id || uid(), title: p.title || '', content: p.content || '',
                localVars: Array.isArray(p.localVars) ? p.localVars : [],
                createdAt: typeof p.createdAt === 'string' ? new Date(p.createdAt).getTime() : (p.createdAt || Date.now()),
                updatedAt: typeof p.updatedAt === 'string' ? new Date(p.updatedAt).getTime() : (p.updatedAt || Date.now()),
                lastUsedAt: typeof p.lastUsedAt === 'string' ? new Date(p.lastUsedAt).getTime() : (p.lastUsedAt || Date.now()),
            }));
            cpbPrompts = migrated;
            savePrompts();
        } catch (e) { console.error('[CPB] Legacy migration failed:', e); }
    }

    // =============================================
    // Seed Data
    // =============================================
    function seedPrompts() {
        const now = Date.now();
        return [
            {
                id: uid(), title: 'Fact Check Prompt',
                content: '# Fact-Check Prompt\n\n## Role\nYou are a fact-check report writer.\n\n## Input\n{{last_response}}\n\n## Evidence\n{{chat_thread}}\n\n## Output Format\n{{output_format}}\n',
                localVars: [{ name: 'analysis_depth', value: 'Classify evidence as primary/secondary' }],
                createdAt: now - 86400000 * 10, updatedAt: now - 86400000, lastUsedAt: now - 86400000
            },
            {
                id: uid(), title: 'Expert Analysis Mode',
                content: 'You are an expert analyst.\n\nAnalyze the following conversation and summarize the key points:\n{{chat_thread}}\n\nRefer to previous responses:\n{{last_response}}\n\nOutput in {{output_format}}.\n',
                localVars: [{ name: 'tone', value: 'concise but logical' }],
                createdAt: now - 86400000 * 20, updatedAt: now - 86400000 * 2, lastUsedAt: now - 86400000 * 2
            },
        ];
    }

    function seedGlobalVars() {
        return [
            { name: 'output_format', value: 'Structured with markdown headers/lists/code blocks' },
            { name: 'role', value: 'AI Platform/Governance Consultant' },
            { name: 'lang', value: 'Korean (formal)' }
        ];
    }

    // =============================================
    // UI State Persistence
    // =============================================
    function loadUI() { try { return JSON.parse(localStorage.getItem(LS_UI) || '{}'); } catch (e) { return {}; } }

    function persistUI() {
        const ui = loadUI();
        ui.sortMode = cpbSortMode;
        ui.zen = cpbZen;
        ui.livePreview = cpbLivePreview;
        if (cpbZen) {
            // When Zen is on, save the pre-zen state (not the current collapsed state)
            ui.preZenSidebarCollapsed = _preZenSidebar;
            ui.preZenVarsCollapsed = _preZenVars;
        } else {
            ui.sidebarCollapsed = el.sidebar.classList.contains('cpb-collapsed');
            ui.varsCollapsed = el.varsPanel.classList.contains('cpb-collapsed');
            ui.preZenSidebarCollapsed = false;
            ui.preZenVarsCollapsed = false;
        }
        localStorage.setItem(LS_UI, JSON.stringify(ui));
    }

    function restoreUI() {
        const ui = loadUI();
        if (typeof ui.sidebarWidth === 'number') el.sidebar.style.width = ui.sidebarWidth + 'px';
        if (typeof ui.varsWidth === 'number') el.varsPanel.style.width = ui.varsWidth + 'px';
        if (ui.sortMode) {
            cpbSortMode = ui.sortMode;
            el.sortBtn.textContent = cpbSortMode === 'recent' ? 'Sort: Recent' : 'Sort: Title';
        }
        cpbLivePreview = !!ui.livePreview;
        if (ui.zen) {
            // Restore pre-zen state from persist, then apply Zen
            _preZenSidebar = !!ui.preZenSidebarCollapsed;
            _preZenVars = !!ui.preZenVarsCollapsed;
            cpbZen = true;
            if (el.zenCheck) el.zenCheck.checked = true;
            el.sidebar.classList.add('cpb-collapsed');
            el.varsPanel.classList.add('cpb-collapsed');
        } else {
            if (ui.sidebarCollapsed) el.sidebar.classList.add('cpb-collapsed');
            else el.sidebar.classList.remove('cpb-collapsed');
            if (ui.varsCollapsed) el.varsPanel.classList.add('cpb-collapsed');
            else el.varsPanel.classList.remove('cpb-collapsed');
        }
    }

    // =============================================
    // Open / Close
    // =============================================
    function openCPB() {
        unbindEvents();
        initElements();
        migrateFromLegacy();
        cpbPrompts = loadPrompts();
        cpbGlobalVars = loadGlobalVars();
        if (cpbPrompts.length === 0) { cpbPrompts = seedPrompts(); savePrompts(); }
        if (cpbGlobalVars.length === 0) { cpbGlobalVars = seedGlobalVars(); saveGlobalVars(); }
        cpbCurrentId = cpbPrompts[0]?.id ?? null;
        cpbDirty = false;
        restoreUI();
        initMarkdownEditor();
        renderAll();
        loadToEditor(cpbCurrentId);
        setLivePreviewMode(cpbLivePreview);
        bindEvents();
        if (el.searchInput) { el.searchInput.disabled = false; el.searchInput.readOnly = false; el.searchInput.style.pointerEvents = 'auto'; }
        el.modal.classList.add('visible');
    }

    function closeCPB(opts = {}) {
        const { skipPendingDecisionGuard = false } = opts;
        refreshSuggestedLocalVars({ render: true, autoOpenLocal: false });
        if (!skipPendingDecisionGuard && cpbSuggestedLocalVars.length > 0) {
            focusLocalTabForDecision();
            showPendingLocalDecisionCloseModal(cpbSuggestedLocalVars.length);
            return;
        }
        flushPendingCurrentSave();
        el.modal.classList.remove('visible');
        closeAutocomplete();
        const masterAc = document.getElementById('master-ac');
        const masterSlash = document.getElementById('master-slash-menu');
        miCloseAc(masterAc);
        miCloseSlashMenu(masterSlash);
        unbindEvents();
    }

    // =============================================
    // Events Binding
    // =============================================
    let _boundKeydown = null;
    let _boundDocClick = null;

    function bindEvents() {
        el.closeBtn.onclick = closeCPB;
        el.modal.addEventListener('click', (e) => { if (e.target === el.modal) closeCPB(); });

        // Sidebar
        el.btnNew.onclick = handleNew;
        el.btnCollapseSidebar.onclick = () => { el.sidebar.classList.toggle('cpb-collapsed'); persistUI(); };
        el.searchInput.oninput = () => renderList();
        el.sortBtn.onclick = () => {
            cpbSortMode = cpbSortMode === 'recent' ? 'title' : 'recent';
            el.sortBtn.textContent = cpbSortMode === 'recent' ? 'Sort: Recent' : 'Sort: Title';
            renderList();
        };
        el.btnImport.onclick = handleImport;
        el.btnExport.onclick = handleExport;

        // Topbar (inline actions, no More menu)
        el.promptTitle.addEventListener('input', () => {
            markDirty(true);
            saveCurrentDebounced();
        });
        el.btnSave.onclick = () => saveCurrent();
        el.btnPreviewTab.onclick = () => setPreviewMode(!isPreviewMode());
        el.btnSend.onclick = handleSend;
        el.btnCopyToInput.onclick = handleCopyToInput;
        if (el.livePreviewCheck) {
            el.livePreviewCheck.checked = cpbLivePreview;
            el.livePreviewCheck.onchange = () => {
                setLivePreviewMode(el.livePreviewCheck.checked);
                persistUI();
            };
        }
        if (el.zenCheck) {
            el.zenCheck.onchange = () => { cpbZen = el.zenCheck.checked; applyZen(); persistUI(); };
        }
        el.btnDup.onclick = handleDuplicate;
        el.btnDel.onclick = handleDelete;

        // Editor
        el.tabEdit.onclick = () => setPreviewMode(false);
        el.tabPrev.onclick = () => setPreviewMode(true);
        el.btnInsertVar.onclick = () => {
            // Open variable palette at caret — full {{name}} inserted on pick
            focusEditor();
            acAnchor = getEditorSelectionStart();
            requestAnimationFrame(() => openPaletteAtCaret());
        };
        el.btnFormat.onclick = handleFormat;
        el.hlOn.onclick = () => { cpbHighlightVars = !cpbHighlightVars; el.hlOn.classList.toggle('cpb-pill-active', cpbHighlightVars); updateHighlightOverlay(); if (isPreviewMode()) renderPreview(); };
        el.hlMissing.onclick = () => { cpbOnlyMissing = !cpbOnlyMissing; el.hlMissing.classList.toggle('cpb-pill-active', cpbOnlyMissing); updateHighlightOverlay(); if (isPreviewMode()) renderPreview(); };

        if (!cpbEditor) {
            el.prompt.addEventListener('input', handleEditorInput);
            el.prompt.addEventListener('keydown', handleEditorKeydown);
            el.prompt.addEventListener('scroll', syncHighlightScroll);
        }
        el.preview.onscroll = handlePreviewScroll;
        el.preview.onclick = handlePreviewLinkClick;

        // Variables
        el.btnCollapseVars.onclick = () => { el.varsPanel.classList.toggle('cpb-collapsed'); persistUI(); };
        if (el.btnExpandVars) { el.btnExpandVars.onclick = () => { el.varsPanel.classList.remove('cpb-collapsed'); persistUI(); }; }
        el.addGlobal.onclick = () => {
            cpbGlobalVars.push({ name: '', value: '' });
            saveGlobalVars();
            renderVarsPanels();
            scheduleSidePanelAutoSave();
        };
        el.addLocal.onclick = () => {
            const p = getCurrentPrompt(); if (!p) return;
            p.localVars = p.localVars || [];
            p.localVars.push({ name: '', value: '' });
            touchPrompt(p);
            savePrompts();
            renderVarsPanels();
            scheduleSidePanelAutoSave();
        };
        if (el.addAllSuggestedLocal) {
            el.addAllSuggestedLocal.onclick = () => addAllSuggestedLocalVars();
        }

        // Variable tabs
        document.querySelectorAll('.cpb-var-tab').forEach(t => {
            t.addEventListener('click', () => {
                setVarTab(t.dataset.tab);
            });
        });

        // Resize
        makeResizable(el.sidebar, el.sbResize, 'sidebarWidth', 200, 520, 'right');
        makeResizable(el.varsPanel, el.varsResize, 'varsWidth', 240, 520, 'left');

        _boundKeydown = handleGlobalKeydown;
        document.addEventListener('keydown', _boundKeydown);

        _boundDocClick = (e) => {
            if (!el.ac.contains(e.target) && e.target !== el.prompt) { closeAutocomplete(); }
        };
        document.addEventListener('click', _boundDocClick);
    }

    function unbindEvents() {
        if (_boundKeydown) document.removeEventListener('keydown', _boundKeydown);
        if (_boundDocClick) document.removeEventListener('click', _boundDocClick);
        if (el.preview) el.preview.onclick = null;
        clearTimeout(currentPromptTimer);
    }

    function initMarkdownEditor() {
        if (cpbEditor || !el.prompt || typeof EasyMDE === 'undefined') return;
        cpbEditor = new EasyMDE({
            element: el.prompt,
            forceSync: true,
            spellChecker: false,
            lineNumbers: true,
            status: false,
            autoDownloadFontAwesome: true,
            promptURLs: true,
            toolbar: [
                'bold',
                'italic',
                'strikethrough',
                '|',
                'heading',
                'quote',
                '|',
                'unordered-list',
                'ordered-list',
                '|',
                'link',
                'code',
                'table',
                'horizontal-rule',
                '|',
                'undo',
                'redo'
            ]
        });

        cpbEditor.codemirror.on('change', () => handleEditorInput());
        cpbEditor.codemirror.on('keydown', (_cm, evt) => handleEditorKeydown(evt));
        cpbEditor.codemirror.on('scroll', () => syncHighlightScroll());
        if (el.highlight) el.highlight.style.display = 'none';
    }

    function getEditorValue() {
        if (cpbEditor) return cpbEditor.value() || '';
        return el.prompt?.value || '';
    }

    function setEditorValue(value) {
        const nextValue = value || '';
        if (cpbEditor) {
            cpbEditor.value(nextValue);
            return;
        }
        if (el.prompt) el.prompt.value = nextValue;
    }

    function focusEditor() {
        if (cpbEditor) cpbEditor.codemirror.focus();
        else if (el.prompt) el.prompt.focus();
    }

    function getEditorSelectionStart() {
        if (cpbEditor) {
            const cm = cpbEditor.codemirror;
            return cm.indexFromPos(cm.getCursor());
        }
        return el.prompt?.selectionStart || 0;
    }

    function replaceEditorSelection(text) {
        if (cpbEditor) {
            const cm = cpbEditor.codemirror;
            cm.replaceSelection(text);
            cm.focus();
            return;
        }
        insertAtCaret(el.prompt, text);
    }

    // =============================================
    // Global Keyboard
    // =============================================
    function handleGlobalKeydown(e) {
        if (!el.modal || !el.modal.classList.contains('visible')) return;
        if (e.ctrlKey && e.key.toLowerCase() === 's') { e.preventDefault(); if (cpbDirty) saveCurrent(); }
        if (e.ctrlKey && e.key === 'Enter') { e.preventDefault(); handleSend(); }
    }

    // =============================================
    // Renderers
    // =============================================
    function renderAll() { renderList(); renderVarsPanels(); renderSysChips(); updateStatus(); }

    function renderList() {
        const q = (el.searchInput.value || '').trim().toLowerCase();
        const items = sortPrompts([...cpbPrompts]);
        el.list.innerHTML = '';
        const filtered = items.filter(p => {
            if (!q) return true;
            return (p.title || '').toLowerCase().includes(q) || (p.content || '').toLowerCase().includes(q);
        });
        if (filtered.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'cpb-empty-msg';
            empty.textContent = 'No results found.';
            el.list.appendChild(empty);
            return;
        }
        filtered.forEach(p => {
            const div = document.createElement('div');
            div.className = 'cpb-item' + (p.id === cpbCurrentId ? ' cpb-item-active' : '');
            div.setAttribute('data-prompt-id', p.id);
            div.innerHTML = `
                <div class="cpb-item-title">${safeHtml(p.title || '(Untitled)')}</div>
                <div class="cpb-item-preview">${safeHtml(previewOf(p.content))}</div>
                <div class="cpb-item-meta">
                    <span>Updated: ${fmt(p.updatedAt)}</span>
                    <span>Used: ${fmt(p.lastUsedAt)}</span>
                </div>
            `;
            // Delete button on sidebar item
            const delBtn = document.createElement('button');
            delBtn.className = 'cpb-item-del';
            delBtn.title = 'Delete';
            delBtn.innerHTML = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>';
            delBtn.onclick = (e) => { e.stopPropagation(); deletePromptById(p.id); };
            div.appendChild(delBtn);

            div.onclick = () => trySwitchPrompt(p.id);
            el.list.appendChild(div);
        });
    }

    function refreshCurrentListItem(p) {
        if (!el.list || !p) return;
        const listItems = [...el.list.querySelectorAll('.cpb-item')];
        const item = listItems.find((node) => node.getAttribute('data-prompt-id') === p.id);
        if (!item) return;

        const titleEl = item.querySelector('.cpb-item-title');
        const previewEl = item.querySelector('.cpb-item-preview');
        const metaSpans = item.querySelectorAll('.cpb-item-meta span');

        if (titleEl) titleEl.textContent = p.title || '(Untitled)';
        if (previewEl) previewEl.textContent = previewOf(p.content);
        if (metaSpans[0]) metaSpans[0].textContent = `Updated: ${fmt(p.updatedAt)}`;
        if (metaSpans[1]) metaSpans[1].textContent = `Used: ${fmt(p.lastUsedAt)}`;
    }

    function renderVarsPanels() {
        el.globalRows.innerHTML = '';
        cpbGlobalVars.forEach((v, idx) => el.globalRows.appendChild(makeVarRow('global', idx, v)));
        const p = getCurrentPrompt();
        const localVars = p?.localVars || [];
        el.localRows.innerHTML = '';
        localVars.forEach((v, idx) => el.localRows.appendChild(makeVarRow('local', idx, v)));
        // Chips
        el.globalChips.innerHTML = '';
        cpbGlobalVars.forEach(v => { if (v.name) el.globalChips.appendChild(makeChip(v.name, 'global')); });
        el.localChips.innerHTML = '';
        localVars.forEach(v => { if (v.name) el.localChips.appendChild(makeChip(v.name, 'local')); });
        refreshSuggestedLocalVars({ render: false });
        renderLocalSuggestions();
    }

    function renderSysChips() {
        el.sysChips.innerHTML = '';
        SYSTEM_VARS.filter(v => !RESERVED_SYSTEM_VARS.includes(v.name)).forEach(v => el.sysChips.appendChild(makeChip(v.name, 'system')));
    }

    function makeChip(name, scope) {
        const c = document.createElement('div');
        c.className = 'cpb-chip';
        c.textContent = `{{${name}}}`;
        c.title = scope === 'system' ? 'Insert system variable' : 'Insert variable';
        c.onclick = () => replaceEditorSelection(`{{${name}}}`);
        return c;
    }

    function makeVarRow(type, idx, v) {
        const row = document.createElement('div');
        row.className = 'cpb-var-row';

        const nameInput = document.createElement('input');
        nameInput.className = 'cpb-var-name';
        nameInput.value = v.name || '';
        nameInput.placeholder = 'name (a-z, 0-9, _)';
        nameInput.title = 'Variable name: English letters, numbers, underscores only';
        nameInput.lang = 'en';
        nameInput.setAttribute('inputmode', 'latin');
        // Only allow English variable names - sanitize on blur, not on every keystroke
        nameInput.addEventListener('keydown', (e) => {
            // Allow control keys
            if (e.ctrlKey || e.metaKey || e.altKey) return;
            if (['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab', 'Home', 'End'].includes(e.key)) return;
            // Only allow English letters, numbers, underscore
            if (!/^[a-zA-Z0-9_]$/.test(e.key)) {
                e.preventDefault();
            }
        });
        nameInput.addEventListener('blur', () => {
            const sanitized = sanitizeVarName(nameInput.value);
            if (sanitized !== v.name) {
                v.name = sanitized;
                nameInput.value = sanitized;
                // Update chips only on blur
                updateChips();
                if (type === 'global') saveGlobalVarsDebounced(); else savePromptsDebounced();
                scheduleSidePanelAutoSave();
            }
            refreshSuggestedLocalVars();
        });
        nameInput.addEventListener('input', () => {
            // Live update the var object but don't re-render
            v.name = nameInput.value;
            if (type === 'global') saveGlobalVarsDebounced(); else savePromptsDebounced();
            scheduleSidePanelAutoSave();
            if (type === 'local') refreshSuggestedLocalVars();
        });

        const valueInput = document.createElement('textarea');
        valueInput.className = 'cpb-var-value';
        valueInput.value = v.value || '';
        valueInput.placeholder = 'Value';
        valueInput.addEventListener('input', () => {
            v.value = valueInput.value;
            if (type === 'global') saveGlobalVarsDebounced(); else savePromptsDebounced();
            scheduleSidePanelAutoSave();
        });

        const delBtn = document.createElement('button');
        delBtn.className = 'cpb-var-del';
        delBtn.title = 'Delete';
        delBtn.innerHTML = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
        delBtn.onclick = () => {
            if (type === 'global') { cpbGlobalVars.splice(idx, 1); saveGlobalVars(); }
            else { const p = getCurrentPrompt(); p.localVars.splice(idx, 1); touchPrompt(p); savePrompts(); }
            renderVarsPanels();
            scheduleSidePanelAutoSave();
        };

        row.appendChild(nameInput);
        row.appendChild(valueInput);
        row.appendChild(delBtn);
        return row;
    }

    /** Update only the chip sections without re-rendering all var rows */
    function updateChips() {
        const p = getCurrentPrompt();
        const localVars = p?.localVars || [];
        el.globalChips.innerHTML = '';
        cpbGlobalVars.forEach(v => { if (v.name) el.globalChips.appendChild(makeChip(v.name, 'global')); });
        el.localChips.innerHTML = '';
        localVars.forEach(v => { if (v.name) el.localChips.appendChild(makeChip(v.name, 'local')); });
    }

    // =============================================
    // Editor / Preview
    // =============================================
    function isPreviewMode() { return cpbPreviewMode; }

    function setPreviewControlsDisabled(disabled) {
        el.tabEdit.classList.toggle('cpb-pill-disabled', disabled);
        el.tabPrev.classList.toggle('cpb-pill-disabled', disabled);
        el.btnPreviewTab.disabled = disabled;
        el.btnPreviewTab.classList.toggle('cpb-btn-disabled', disabled);
        el.btnPreviewTab.classList.toggle('cpb-btn-active', disabled);
    }

    function setPreviewMode(on, opts = {}) {
        const forcedByLive = !!opts.forcedByLive;
        if (cpbLivePreview && !forcedByLive) return;
        cpbPreviewMode = !!on;
        el.tabEdit.classList.toggle('cpb-pill-active', !on);
        el.tabPrev.classList.toggle('cpb-pill-active', on);
        const hlWrap = el.prompt.closest('.cpb-editor-highlight-wrap');
        if (hlWrap) hlWrap.style.display = (on && !cpbLivePreview) ? 'none' : '';
        el.preview.style.display = (on || cpbLivePreview) ? 'block' : 'none';
        const lockEditorActions = !!on && !cpbLivePreview;
        el.btnInsertVar.disabled = lockEditorActions;
        el.btnFormat.disabled = lockEditorActions;
        el.btnInsertVar.style.opacity = lockEditorActions ? '0.4' : '';
        el.btnFormat.style.opacity = lockEditorActions ? '0.4' : '';
        el.btnInsertVar.style.pointerEvents = lockEditorActions ? 'none' : '';
        el.btnFormat.style.pointerEvents = lockEditorActions ? 'none' : '';
        if (on || cpbLivePreview) {
            el.preview.classList.add('cpb-preview-md');
            renderPreview();
        } else {
            el.preview.classList.remove('cpb-preview-md');
        }
    }

    function setLivePreviewMode(on) {
        cpbLivePreview = !!on;
        if (el.livePreviewCheck) el.livePreviewCheck.checked = cpbLivePreview;
        if (el.editorWrap) el.editorWrap.classList.toggle('cpb-live-preview-on', cpbLivePreview);
        setPreviewControlsDisabled(cpbLivePreview);
        if (cpbLivePreview) setPreviewMode(true, { forcedByLive: true });
        else setPreviewMode(false, { forcedByLive: true });
    }

    function updateHighlightOverlay() {
        if (!el.highlight) return;
        if (!cpbHighlightVars) { el.highlight.innerHTML = ''; return; }
        if (cpbEditor) { el.highlight.innerHTML = ''; return; }
        const raw = getEditorValue();
        const map = buildVarMap();
        const html = safeHtml(raw).replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (m, key) => {
            const exists = Object.prototype.hasOwnProperty.call(map, key);
            const hasValue = exists && map[key];
            if (cpbOnlyMissing && hasValue) return m;
            const cls = hasValue ? 'hl-var' : 'hl-var hl-var-missing';
            return `<span class="${cls}">${m}</span>`;
        });
        el.highlight.innerHTML = html + '\n';  // trailing newline for height matching
        syncHighlightScroll();
    }

    function syncHighlightScroll() {
        if (!el.highlight) return;
        if (cpbEditor) {
            const scroll = cpbEditor.codemirror.getScrollInfo();
            el.highlight.scrollTop = scroll.top;
            el.highlight.scrollLeft = scroll.left;
            syncPreviewScrollFromEditor();
            return;
        }
        el.highlight.scrollTop = el.prompt.scrollTop;
        el.highlight.scrollLeft = el.prompt.scrollLeft;
        syncPreviewScrollFromEditor();
    }

    function getEditorScrollInfo() {
        if (cpbEditor) {
            const s = cpbEditor.codemirror.getScrollInfo();
            return {
                top: s.top,
                max: Math.max(0, s.height - s.clientHeight),
            };
        }
        if (!el.prompt) return { top: 0, max: 0 };
        return {
            top: el.prompt.scrollTop,
            max: Math.max(0, el.prompt.scrollHeight - el.prompt.clientHeight),
        };
    }

    function setEditorScrollByRatio(ratio) {
        const safeRatio = Number.isFinite(ratio) ? Math.min(1, Math.max(0, ratio)) : 0;
        if (cpbEditor) {
            const cm = cpbEditor.codemirror;
            const s = cm.getScrollInfo();
            const max = Math.max(0, s.height - s.clientHeight);
            cm.scrollTo(null, safeRatio * max);
            return;
        }
        if (!el.prompt) return;
        const max = Math.max(0, el.prompt.scrollHeight - el.prompt.clientHeight);
        el.prompt.scrollTop = safeRatio * max;
    }

    function syncPreviewScrollFromEditor() {
        if (!el.preview || cpbScrollSyncLock) return;
        if (!(cpbLivePreview || isPreviewMode())) return;
        const previewMax = Math.max(0, el.preview.scrollHeight - el.preview.clientHeight);
        const editorScroll = getEditorScrollInfo();
        const ratio = editorScroll.max > 0 ? (editorScroll.top / editorScroll.max) : 0;
        cpbScrollSyncLock = true;
        el.preview.scrollTop = ratio * previewMax;
        cpbScrollSyncLock = false;
    }

    function handlePreviewScroll() {
        if (cpbScrollSyncLock || !cpbLivePreview) return;
        const previewMax = Math.max(0, el.preview.scrollHeight - el.preview.clientHeight);
        const ratio = previewMax > 0 ? (el.preview.scrollTop / previewMax) : 0;
        cpbScrollSyncLock = true;
        setEditorScrollByRatio(ratio);
        cpbScrollSyncLock = false;
    }

    function looksLikeStructuredPlainText(raw) {
        const text = String(raw || '').trim();
        if (!text) return false;

        // JSON payloads should be rendered as plain text.
        if (text.startsWith('{') || text.startsWith('[')) {
            try {
                JSON.parse(text);
                return true;
            } catch (e) {
                // continue
            }
        }

        // XML/HTML payloads should be rendered as plain text to avoid DOM/layout side effects.
        if (/^<\?xml[\s>]/i.test(text)) return true;
        if (/^<!doctype\s+html/i.test(text)) return true;
        if (/^<html[\s>]/i.test(text)) return true;
        if (/<\/?[a-z][^>]*>/i.test(text)) {
            const tagCount = (text.match(/<\/?[a-z][^>]*>/gi) || []).length;
            if (tagCount >= 2) return true;
        }

        return false;
    }

    function looksLikeMarkdown(raw) {
        const text = String(raw || '');
        if (!text.trim()) return false;
        const patterns = [
            /^\s{0,3}#{1,6}\s+\S/m,                      // heading
            /^\s*([-*+]|\d+\.)\s+\S/m,                  // list
            /^\s*>\s+\S/m,                               // blockquote
            /```[\s\S]*?```/m,                           // fenced code
            /\[[^\]]+\]\(([^)]+)\)/m,                    // link
            /^\s*\|.+\|\s*$/m,                           // table row
            /^\s*---+\s*$/m                              // horizontal rule
        ];
        return patterns.some((re) => re.test(text));
    }

    function decidePreviewMode(raw) {
        if (looksLikeStructuredPlainText(raw)) return 'plain';
        if (looksLikeMarkdown(raw)) return 'markdown';
        return 'plain';
    }

    function renderPreviewAsPlainText(withPlaceholders, placeholders) {
        let html = safeHtml(withPlaceholders);
        for (const [ph, replacement] of Object.entries(placeholders)) {
            html = html.replaceAll(safeHtml(ph), replacement);
            html = html.replaceAll(ph, replacement);
        }
        html = html.replace(/\n/g, '<br>');
        el.preview.classList.remove('cpb-preview-md');
        el.preview.classList.add('cpb-preview-plain');
        el.preview.innerHTML = html;
    }

    async function renderPreview() {
        const renderSeq = ++cpbPreviewRenderSeq;
        const raw = getEditorValue();
        const map = await buildPreviewVarMap();
        if (renderSeq !== cpbPreviewRenderSeq) return;

        // --- Markdown rendering with variable highlight support ---
        // Strategy: replace variables with unique placeholders, render markdown, then restore highlights
        const placeholders = {};
        let placeholderIdx = 0;

        // Step 1: Replace {{var}} with unique placeholders (before markdown parsing)
        const withPlaceholders = raw.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (m, key) => {
            const exists = Object.prototype.hasOwnProperty.call(map, key);
            const hasValue = exists && map[key];
            const val = hasValue ? map[key] : m;

            const phKey = `%%CPB_VAR_${placeholderIdx++}%%`;

            if (!cpbHighlightVars) {
                placeholders[phKey] = makePreviewValueHtml(key, val, hasValue);
            } else if (cpbOnlyMissing && hasValue) {
                placeholders[phKey] = makePreviewValueHtml(key, val, hasValue);
            } else {
                const cls = hasValue ? 'cpb-var-hl' : 'cpb-var-hl cpb-var-missing';
                const title = hasValue ? `Resolved: ${key}` : (exists ? `Empty value: ${key}` : `Unresolved: ${key}`);
                const valueHtml = makePreviewValueHtml(key, val, hasValue);
                if (hasValue && PREVIEW_TRUNCATE_KEYS.has(key) && toTextValue(val).length > 100) {
                    placeholders[phKey] = `<span class="${cls}">${valueHtml}</span>`;
                } else {
                    placeholders[phKey] = `<span class="${cls}" title="${title}">${valueHtml}</span>`;
                }
            }
            return phKey;
        });

        const previewMode = decidePreviewMode(raw);
        if (previewMode === 'markdown') {
            // Step 2 (markdown mode): Render markdown
            let html = '';
            try {
                html = marked.parse(withPlaceholders, { breaks: true, gfm: true });
            } catch (e) {
                renderPreviewAsPlainText(withPlaceholders, placeholders);
                syncPreviewScrollFromEditor();
                return;
            }

            // Step 3: Restore placeholders with actual variable HTML
            for (const [ph, replacement] of Object.entries(placeholders)) {
                html = html.replaceAll(safeHtml(ph), replacement);
                html = html.replaceAll(ph, replacement); // also handle unescaped occurrences
            }

            el.preview.classList.remove('cpb-preview-plain');
            el.preview.classList.add('cpb-preview-md');
            el.preview.innerHTML = html;
        } else {
            // Plain text mode (XML/JSON/HTML/non-markdown content)
            renderPreviewAsPlainText(withPlaceholders, placeholders);
        }
        syncPreviewScrollFromEditor();
    }

    function handleEditorInput() {
        markDirty(true);
        saveCurrentDebounced();
        refreshSuggestedLocalVars();
        updateHighlightOverlay();
        if (isPreviewMode() || cpbLivePreview) renderPreview();
        maybeOpenAutocomplete();
    }

    function handleEditorKeydown(e) {
        if (e.ctrlKey && e.key === 'Enter') { e.preventDefault(); handleSend(); return; }
        if (!acOpen) return;
        if (e.key === 'ArrowDown') { e.preventDefault(); acSelected = Math.min(acSelected + 1, acItems.length - 1); renderAutocomplete(); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); acSelected = Math.max(acSelected - 1, 0); renderAutocomplete(); }
        else if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); if (acItems[acSelected]) pickAutocomplete(acItems[acSelected].name); }
        else if (e.key === 'Escape') { closeAutocomplete(); }
    }

    function fallbackFormatText(text) {
        return (text || '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
    }

    function normalizeMarkdownForPrettier(text) {
        const lines = (text || '').replace(/\r\n?/g, '\n').split('\n');

        // Pre-normalize common markdown typos so Prettier can format predictably.
        const normalized = lines.map((line) => {
            let next = line;
            next = next.replace(/^(\s{0,3}#{1,6})([^#\s].*)$/, '$1 $2'); // "#title" -> "# title"
            next = next.replace(/^(\s*>+)([^\s>].*)$/, '$1 $2'); // ">quote" -> "> quote"
            next = next.replace(/^(\s*)([-*+])([^\s].*)$/, '$1$2 $3'); // "-item" -> "- item"
            next = next.replace(/^(\s*)(\d+\.)([^\s].*)$/, '$1$2 $3'); // "1.item" -> "1. item"
            next = next.replace(/^(\s*[-*+]\s*\[[ xX]\])([^\s].*)$/, '$1 $2'); // "- [x]task" -> "- [x] task"
            return next;
        });

        let prevListIndent = -1;
        let prevLineIsList = false;

        for (let i = 0; i < normalized.length; i++) {
            const rawLine = normalized[i];
            if (!rawLine.trim()) continue;

            const listMatch = rawLine.match(/^(\s*)(?:[-*+]|\d+\.)\s+/);
            if (!listMatch) {
                prevLineIsList = false;
                prevListIndent = -1;
                continue;
            }

            const currentIndent = listMatch[1].replace(/\t/g, '  ').length;
            if (prevLineIsList && currentIndent - prevListIndent >= 3) {
                const targetIndent = prevListIndent + 2;
                normalized[i] = ' '.repeat(targetIndent) + rawLine.trimStart();
                prevListIndent = targetIndent;
            } else {
                prevListIndent = currentIndent;
            }
            prevLineIsList = true;
        }

        return normalized.join('\n');
    }

    async function handleFormat() {
        const source = getEditorValue();
        const normalizedSource = normalizeMarkdownForPrettier(source);
        let next = source;

        try {
            const markdownPlugin = window.prettierPlugins?.markdown || window.prettierPluginMarkdown;
            if (!window.prettier || !markdownPlugin) throw new Error('Prettier markdown plugin not loaded');
            next = await window.prettier.format(normalizedSource, {
                parser: 'markdown',
                plugins: [markdownPlugin],
                printWidth: 100,
                tabWidth: 2,
                proseWrap: 'preserve'
            });
        } catch (e) {
            console.warn('[CPB] Prettier format failed. Falling back to simple cleanup:', e);
            next = fallbackFormatText(normalizedSource);
        }

        setEditorValue(next);
        markDirty(true);
        saveCurrentDebounced();
        updateHighlightOverlay();
        if (isPreviewMode() || cpbLivePreview) renderPreview();
    }

    // =============================================
    // Variable Substitution
    // =============================================
    const PREVIEW_TRUNCATE_KEYS = new Set(['chat_thread', 'last_response', 'main_prompt']);

    function toTextValue(v) {
        if (v === null || v === undefined) return '';
        if (typeof v === 'string') return v;
        if (typeof v === 'object') {
            try { return JSON.stringify(v, null, 2); } catch (e) { return String(v); }
        }
        return String(v);
    }

    function formatCurrentTimeISO() {
        return new Date().toISOString();
    }

    function normalizePreviewSystemVars(raw) {
        const fallback = {
            chat_thread: '[No chat history yet. Start a conversation to populate chat_thread.]',
            last_response: '[No AI response yet. Send a prompt to populate last_response.]',
            current_time: formatCurrentTimeISO(),
            main_prompt: '[Main prompt is empty. Type in the main input to populate main_prompt.]'
        };
        const source = raw && typeof raw === 'object' ? raw : {};
        const chatThread = toTextValue(source.chat_thread).trim();
        const lastResponse = toTextValue(source.last_response).trim();
        const rawTime = toTextValue(source.current_time).trim();
        const currentTime = rawTime || fallback.current_time;
        const mainPrompt = toTextValue(getMainPromptValue()).trim();
        return {
            chat_thread: chatThread || fallback.chat_thread,
            last_response: lastResponse || fallback.last_response,
            current_time: currentTime || fallback.current_time,
            main_prompt: mainPrompt || fallback.main_prompt
        };
    }

    function getAnonymousModeForCPB() {
        return !!window._cpb_isAnonymousMode;
    }

    async function getPreviewSystemVars() {
        const now = Date.now();
        if (cpbPreviewSysCache && now - cpbPreviewSysCacheAt < 1200) {
            const liveMainPrompt = toTextValue(getMainPromptValue()).trim();
            return {
                ...cpbPreviewSysCache,
                main_prompt: liveMainPrompt || '[Main prompt is empty. Type in the main input to populate main_prompt.]'
            };
        }
        if (cpbPreviewSysPending) return cpbPreviewSysPending;
        cpbPreviewSysPending = (async () => {
            let raw = {};
            try { raw = await window.electronAPI.getSystemVarsForCPB({ anonymousMode: getAnonymousModeForCPB() }); }
            catch (e) {
                console.warn('[CPB] Failed to load system vars for preview:', e);
            }
            cpbPreviewSysCache = normalizePreviewSystemVars(raw);
            cpbPreviewSysCacheAt = Date.now();
            cpbPreviewSysPending = null;
            return cpbPreviewSysCache;
        })();
        return cpbPreviewSysPending;
    }

    async function buildPreviewVarMap() {
        const p = getCurrentPrompt();
        const local = (p?.localVars || []).reduce((acc, v) => { if (v.name) acc[v.name] = v.value ?? ''; return acc; }, {});
        const glo = cpbGlobalVars.reduce((acc, v) => { if (v.name) acc[v.name] = v.value ?? ''; return acc; }, {});
        const sys = await getPreviewSystemVars();
        return { ...sys, ...glo, ...local };
    }

    function makePreviewValueHtml(key, value, hasValue) {
        const text = toTextValue(value);
        if (!hasValue) return safeHtml(text);
        if (!PREVIEW_TRUNCATE_KEYS.has(key)) return safeHtml(text);
        if (text.length <= 100) return safeHtml(text);
        const short = `${text.slice(0, 100)}...`;
        return `<span class="cpb-preview-truncated-val" title="${safeHtml(text)}">${safeHtml(short)}</span>`;
    }

    function buildVarMap() {
        const mainPrompt = getMainPromptValue();
        const p = getCurrentPrompt();
        const local = (p?.localVars || []).reduce((acc, v) => { if (v.name) acc[v.name] = v.value ?? ''; return acc; }, {});
        const glo = cpbGlobalVars.reduce((acc, v) => { if (v.name) acc[v.name] = v.value ?? ''; return acc; }, {});
        const sys = {
            chat_thread: JSON.stringify([{ role: 'user', content: 'Question...' }, { role: 'assistant', content: 'Answer...' }], null, 2),
            last_response: '(dummy last response for preview)',
            current_time: formatCurrentTimeISO(),
            main_prompt: mainPrompt
        };
        return { ...sys, ...glo, ...local };
    }

    function substitutePlain(text, map) {
        let t = text;
        for (const [k, v] of Object.entries(map)) { t = t.replaceAll(`{{${k}}}`, v); }
        return t;
    }

    const ATTACHABLE_SYSTEM_VARS = ['chat_thread', 'last_response'];
    const ATTACHABLE_SYSTEM_VAR_SET = new Set(ATTACHABLE_SYSTEM_VARS);
    const SYSTEM_VAR_FILE_LINE_THRESHOLD = 200;

    function countLines(text) {
        return (text || '').split('\n').length;
    }

    async function materializePromptWithSystemAttachments(templateText, map, options = {}) {
        const { source = 'cpb' } = options;
        const resolvedMap = { ...map };
        const text = toTextValue(templateText);

        for (const varName of ATTACHABLE_SYSTEM_VARS) {
            const token = `{{${varName}}}`;
            if (!text.includes(token)) continue;
            if (!ATTACHABLE_SYSTEM_VAR_SET.has(varName)) continue;

            const value = toTextValue(resolvedMap[varName]);
            const lineCount = countLines(value);
            if (!value) {
                resolvedMap[varName] = '';
                continue;
            }

            let shouldConvert = lineCount >= SYSTEM_VAR_FILE_LINE_THRESHOLD;
            if (typeof window.shouldConvertTextToAttachment === 'function') {
                const decision = window.shouldConvertTextToAttachment(value, {
                    lineThreshold: SYSTEM_VAR_FILE_LINE_THRESHOLD
                });
                shouldConvert = decision.shouldConvert;
            }

            if (!shouldConvert) {
                continue;
            }

            if (typeof window.convertLongTextToAttachment !== 'function') {
                continue;
            }

            const conversion = await window.convertLongTextToAttachment(value, {
                source: `${source}-${varName}`,
                filePrefix: `cpb-${varName}`
            });

            if (conversion && conversion.converted) {
                // Keep only non-system prompt text in main input when large system vars become attachments.
                resolvedMap[varName] = '';
            }
        }

        return substitutePlain(text, resolvedMap);
    }

    /** Build map for "Copy to Input" — only local vars with values */
    function buildCopyMap() {
        const p = getCurrentPrompt();
        return (p?.localVars || []).reduce((acc, v) => { if (v.name && v.value) acc[v.name] = v.value; return acc; }, {});
    }

    /** Build full runtime map for Send (system vars resolved from main process) */
    async function buildSendMap() {
        const mainPrompt = getMainPromptValue();
        const p = getCurrentPrompt();
        const local = (p?.localVars || []).reduce((acc, v) => { if (v.name) acc[v.name] = v.value ?? ''; return acc; }, {});
        const glo = cpbGlobalVars.reduce((acc, v) => { if (v.name) acc[v.name] = v.value ?? ''; return acc; }, {});
        let sysVals = {};
        try { sysVals = await window.electronAPI.getSystemVarsForCPB({ anonymousMode: getAnonymousModeForCPB() }); }
        catch (e) {
            console.error('[CPB] Failed to get system vars:', e);
            sysVals = { chat_thread: '', last_response: '', current_time: formatCurrentTimeISO() };
        }
        sysVals.main_prompt = mainPrompt;
        return { ...sysVals, ...glo, ...local };
    }

    // =============================================
    // Autocomplete
    // =============================================
    function maybeOpenAutocomplete() {
        const t = getEditorValue();
        const pos = getEditorSelectionStart();
        const before = t.slice(0, pos);
        const i = before.lastIndexOf('{{');
        if (i === -1) { closeAutocomplete(); return; }
        const after = before.slice(i + 2);
        if (after.includes('}}') || /[\s\n\r]/.test(after)) { closeAutocomplete(); return; }
        acAnchor = i;
        const filter = after.toLowerCase();
        acItems = listAllVars().filter(v => v.name.toLowerCase().includes(filter)).slice(0, 60);
        if (acItems.length === 0) { closeAutocomplete(); return; }
        acSelected = 0;
        positionAutocomplete();
        renderAutocomplete();
    }

    function positionAutocomplete() {
        acOpen = true;
        let top = 0;
        let left = 0;
        if (cpbEditor) {
            const cm = cpbEditor.codemirror;
            const cursor = cm.getCursor();
            const coords = cm.cursorCoords(cursor, 'window');
            top = coords.bottom + 4;
            left = coords.left;
        } else {
            const coords = getCaretCoords(el.prompt, el.prompt.selectionStart);
            const rect = el.prompt.getBoundingClientRect();
            top = rect.top + coords.top - el.prompt.scrollTop + coords.height + 4;
            left = rect.left + coords.left - el.prompt.scrollLeft;
            if (top + 300 > window.innerHeight - 16) top = rect.top + coords.top - el.prompt.scrollTop - 300 - 4;
        }
        const vw = window.innerWidth, vh = window.innerHeight, acW = 320, acH = 300;
        if (left + acW > vw - 16) left = vw - acW - 16;
        if (left < 8) left = 8;
        if (top + acH > vh - 16) top = vh - acH - 16;
        if (top < 8) top = 8;
        el.ac.style.top = top + 'px';
        el.ac.style.left = left + 'px';
        el.ac.classList.add('cpb-show');
    }

    function getCaretCoords(textarea, position) {
        const mirror = document.createElement('div');
        const style = window.getComputedStyle(textarea);
        const props = ['fontFamily','fontSize','fontWeight','fontStyle','letterSpacing','textTransform','wordSpacing','textIndent','whiteSpace','wordWrap','overflowWrap','tabSize','lineHeight','paddingTop','paddingRight','paddingBottom','paddingLeft','borderTopWidth','borderRightWidth','borderBottomWidth','borderLeftWidth','boxSizing'];
        mirror.style.position = 'absolute'; mirror.style.visibility = 'hidden'; mirror.style.overflow = 'hidden';
        mirror.style.width = textarea.offsetWidth + 'px'; mirror.style.height = 'auto';
        props.forEach(p => { mirror.style[p] = style[p]; });
        mirror.textContent = textarea.value.substring(0, position);
        const span = document.createElement('span');
        span.textContent = textarea.value.substring(position) || '.';
        mirror.appendChild(span);
        document.body.appendChild(mirror);
        const top = span.offsetTop, left = span.offsetLeft, height = span.offsetHeight;
        document.body.removeChild(mirror);
        return { top, left, height };
    }

    function openPaletteAtCaret() {
        acItems = listAllVars().slice(0, 60); acSelected = 0; acOpen = true;
        positionAutocomplete(); renderAutocomplete();
    }

    function renderAutocomplete() {
        el.ac.innerHTML = '';
        const groups = [
            { key: 'system', title: 'System', badge: 'cpb-badge-sys' },
            { key: 'global', title: 'Global', badge: 'cpb-badge-glo' },
            { key: 'local', title: 'Local', badge: 'cpb-badge-loc' }
        ];
        let idx = 0;
        for (const g of groups) {
            const rows = acItems.filter(x => x.scope === g.key);
            if (rows.length === 0) continue;
            const st = document.createElement('div');
            st.className = 'cpb-ac-section'; st.textContent = g.title;
            el.ac.appendChild(st);
            rows.forEach(r => {
                const ri = idx;
                const row = document.createElement('div');
                row.className = 'cpb-ac-row' + (ri === acSelected ? ' cpb-ac-selected' : '');
                row.innerHTML = `<span class="cpb-ac-badge ${g.badge}">${safeHtml(r.icon)}</span><div><div class="cpb-ac-name">{{${safeHtml(r.name)}}}</div><div class="cpb-ac-desc">${safeHtml(r.desc)}</div></div>`;
                row.onmouseenter = () => { acSelected = ri; highlightSelected(); };
                row.onclick = () => pickAutocomplete(r.name);
                el.ac.appendChild(row);
                idx++;
            });
        }
        highlightSelected();
    }

    function highlightSelected() {
        const rows = [...el.ac.querySelectorAll('.cpb-ac-row')];
        rows.forEach((r, i) => r.classList.toggle('cpb-ac-selected', i === acSelected));
        const sel = rows[acSelected]; if (sel) sel.scrollIntoView({ block: 'nearest' });
    }

    function pickAutocomplete(name) {
        const t = getEditorValue();
        const pos = getEditorSelectionStart();
        const before = t.slice(0, acAnchor), after = t.slice(pos);
        const insert = `{{${name}}}`;
        const nextValue = before + insert + after;
        const newPos = before.length + insert.length;
        setEditorValue(nextValue);
        if (cpbEditor) {
            const cm = cpbEditor.codemirror;
            cm.setCursor(cm.posFromIndex(newPos));
            cm.focus();
        } else {
            el.prompt.setSelectionRange(newPos, newPos);
            el.prompt.focus();
        }
        markDirty(true); closeAutocomplete(); updateHighlightOverlay(); if (isPreviewMode() || cpbLivePreview) renderPreview();
    }

    function closeAutocomplete() { acOpen = false; acAnchor = -1; acItems = []; el.ac.classList.remove('cpb-show'); }

    function listAllVars() {
        const p = getCurrentPrompt();
        const local = (p?.localVars || []).map(v => ({ scope: 'local', name: v.name, desc: (v.value || '').slice(0, 80), icon: 'L' })).filter(x => x.name);
        const glo = cpbGlobalVars.map(v => ({ scope: 'global', name: v.name, desc: (v.value || '').slice(0, 80), icon: 'G' })).filter(x => x.name);
        const sys = SYSTEM_VARS.map(v => ({ scope: 'system', name: v.name, desc: v.desc, icon: 'S' }));
        return [...sys, ...glo, ...local];
    }

    // =============================================
    // Prompt Management
    // =============================================
    function getCurrentPrompt() { return cpbPrompts.find(x => x.id === cpbCurrentId) || null; }

    function loadToEditor(id) {
        const p = cpbPrompts.find(x => x.id === id); if (!p) return;
        cpbCurrentId = id;
        el.promptTitle.value = p.title || '';
        setEditorValue(p.content || '');
        cpbDirty = false;
        renderList(); renderVarsPanels(); updateStatus();
        refreshSuggestedLocalVars();
        updateHighlightOverlay();
        if (isPreviewMode() || cpbLivePreview) renderPreview();
    }

    function saveCurrent(opts = {}) {
        const { renderListNow = true } = opts;
        const p = getCurrentPrompt(); if (!p) return;
        p.title = (el.promptTitle.value || '').trim();
        p.content = getEditorValue();
        touchPrompt(p);
        savePrompts();
        cpbDirty = false;
        const hasSearchFilter = !!(el.searchInput?.value || '').trim();
        const shouldRenderList = renderListNow || hasSearchFilter || cpbSortMode === 'title';
        if (shouldRenderList) renderList();
        else refreshCurrentListItem(p);
        updateStatus();
    }

    function touchPrompt(p) { p.updatedAt = Date.now(); }
    function markDirty(flag) { cpbDirty = !!flag; updateStatus(); }

    function updateStatus() {
        el.dirtyDot.classList.toggle('cpb-dot-dirty', cpbDirty);
        el.dirtyDot.classList.toggle('cpb-dot-saved', !cpbDirty);
        el.dirtyText.textContent = cpbDirty ? 'Unsaved' : 'Saved';
        el.btnSave.disabled = !cpbDirty;
        const p = getCurrentPrompt();
        if (!p) { el.metaText.textContent = ''; return; }
        el.metaText.textContent = `Created ${fmt(p.createdAt)} · Updated ${fmt(p.updatedAt)}`;
    }

    function trySwitchPrompt(id) {
        if (id === cpbCurrentId) return;
        flushPendingCurrentSave();
        if (cpbDirty) {
            const ok = confirm('You have unsaved changes. Save before switching?');
            if (ok) saveCurrent(); else { cpbDirty = false; updateStatus(); }
        }
        loadToEditor(id);
    }

    // =============================================
    // Actions
    // =============================================
    function handleNew() {
        flushPendingCurrentSave();
        if (cpbDirty) { if (!confirm('Unsaved changes will be lost. Continue?')) return; }
        const p = { id: uid(), title: '', content: '', localVars: [], createdAt: Date.now(), updatedAt: Date.now(), lastUsedAt: Date.now() };
        cpbPrompts.unshift(p); cpbCurrentId = p.id; savePrompts(); renderAll(); loadToEditor(p.id); el.promptTitle.focus();
    }

    function handleDuplicate() {
        const p = getCurrentPrompt(); if (!p) return;
        const clone = { ...JSON.parse(JSON.stringify(p)), id: uid(), title: (p.title || 'Untitled') + ' (Copy)', createdAt: Date.now(), updatedAt: Date.now(), lastUsedAt: Date.now() };
        cpbPrompts.unshift(clone); savePrompts(); loadToEditor(clone.id); renderAll();
    }

    function handleDelete() {
        const p = getCurrentPrompt(); if (!p) return;
        showDeleteConfirm(p.title || '(Untitled)', () => {
            cpbPrompts = cpbPrompts.filter(x => x.id !== p.id);
            savePrompts(); cpbCurrentId = cpbPrompts[0]?.id ?? null; renderAll();
            if (cpbCurrentId) loadToEditor(cpbCurrentId);
            else { el.promptTitle.value = ''; setEditorValue(''); el.preview.textContent = ''; }
            markDirty(false);
        });
    }

    function deletePromptById(id) {
        const p = cpbPrompts.find(x => x.id === id);
        if (!p) return;
        showDeleteConfirm(p.title || '(Untitled)', () => {
            cpbPrompts = cpbPrompts.filter(x => x.id !== id);
            savePrompts();
            if (cpbCurrentId === id) {
                cpbCurrentId = cpbPrompts[0]?.id ?? null;
                if (cpbCurrentId) loadToEditor(cpbCurrentId);
                else { el.promptTitle.value = ''; setEditorValue(''); el.preview.textContent = ''; }
            }
            renderAll(); markDirty(false);
        });
    }

    /** Show a styled delete confirmation dialog */
    function showDeleteConfirm(title, onConfirm) {
        const backdrop = document.createElement('div');
        backdrop.className = 'cpb-unresolved-backdrop';
        backdrop.innerHTML = `
            <div class="cpb-unresolved-modal">
                <div class="cpb-unresolved-header">
                    <span>Delete Prompt</span>
                    <button class="cpb-unresolved-close">&times;</button>
                </div>
                <div class="cpb-unresolved-body">
                    <p>Are you sure you want to delete <b>"${safeHtml(title)}"</b>?</p>
                    <p style="color:#fca5a5;font-size:12px;margin-top:8px">This action cannot be undone.</p>
                </div>
                <div class="cpb-unresolved-footer">
                    <button class="cpb-btn cpb-btn-secondary cpb-unresolved-cancel">Cancel</button>
                    <button class="cpb-btn cpb-btn-danger cpb-unresolved-ok">Delete</button>
                </div>
            </div>
        `;
        const cleanup = () => backdrop.remove();
        backdrop.querySelector('.cpb-unresolved-close').onclick = cleanup;
        backdrop.querySelector('.cpb-unresolved-cancel').onclick = cleanup;
        backdrop.querySelector('.cpb-unresolved-ok').onclick = () => { cleanup(); onConfirm(); };
        backdrop.addEventListener('click', (e) => { if (e.target === backdrop) cleanup(); });
        document.body.appendChild(backdrop);
    }

    async function handleSend() {
        const p = getCurrentPrompt(); if (!p) return;
        flushPendingCurrentSave();
        const unresolvedLocals = (p.localVars || []).filter(v => v.name && !v.value);
        if (unresolvedLocals.length > 0) {
            const resolved = await promptUnresolvedVars(unresolvedLocals);
            if (!resolved) return;
            unresolvedLocals.forEach((v, i) => { v.value = resolved[i]; });
            touchPrompt(p); savePrompts(); renderVarsPanels();
        }
        p.lastUsedAt = Date.now(); savePrompts();
        const map = await buildSendMap();
        const finalText = await materializePromptWithSystemAttachments(getEditorValue(), map, { source: 'cpb-send' });
        closeCPB({ skipPendingDecisionGuard: true });
        const crossCheckModal = document.getElementById('cross-check-modal');
        if (crossCheckModal) crossCheckModal.classList.remove('visible');
        window.electronAPI.setServiceVisibility(true);
        const masterInput = document.getElementById('master-input');
        if (masterInput) {
            masterInput.value = finalText;
            masterInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
        window._cpb_context = null;
        if (typeof window.sendPrompt === 'function') {
            await window.sendPrompt();
        }
    }

    async function handleCopyToInput() {
        const p = getCurrentPrompt(); if (!p) return;
        flushPendingCurrentSave();

        const rawText = getEditorValue();

        // Store CPB context with local var values for session variable resolution on Send
        window._cpb_context = {
            promptId: p.id,
            globalVars: JSON.parse(JSON.stringify(cpbGlobalVars)),
            localVars: JSON.parse(JSON.stringify(p.localVars || [])),
            systemVarNames: SYSTEM_VARS.map(v => v.name)
        };

        const masterInput = document.getElementById('master-input');
        if (masterInput) {
            masterInput.value = rawText;
            masterInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
        closeCPB({ skipPendingDecisionGuard: true });
        const crossCheckModal = document.getElementById('cross-check-modal');
        if (crossCheckModal) crossCheckModal.classList.remove('visible');
        window.electronAPI.setServiceVisibility(true);
        if (masterInput) masterInput.focus();
    }

    function promptUnresolvedVars(vars) {
        return new Promise((resolve) => {
            setMainPopupLayerActive(true);

            const backdrop = document.createElement('div');
            backdrop.className = 'cpb-unresolved-backdrop';
            backdrop.innerHTML = `
                <div class="cpb-unresolved-modal">
                    <div class="cpb-unresolved-header">
                        <span>Unresolved Local Variables</span>
                        <button class="cpb-unresolved-close">&times;</button>
                    </div>
                    <div class="cpb-unresolved-body">
                        <p>The following local variables have no value. Please enter values to proceed.</p>
                        <div class="cpb-unresolved-fields"></div>
                    </div>
                    <div class="cpb-unresolved-footer">
                        <button class="cpb-btn cpb-btn-secondary cpb-unresolved-cancel">Cancel</button>
                        <button class="cpb-btn cpb-btn-primary cpb-unresolved-ok">Confirm &amp; Send</button>
                    </div>
                </div>
            `;
            const fieldsDiv = backdrop.querySelector('.cpb-unresolved-fields');
            const inputs = [];
            vars.forEach(v => {
                const row = document.createElement('div'); row.className = 'cpb-unresolved-row';
                row.innerHTML = `<label class="cpb-unresolved-label">{{${safeHtml(v.name)}}}</label>`;
                const inp = document.createElement('input'); inp.className = 'cpb-unresolved-input';
                inp.placeholder = `Enter value for ${v.name}`;
                row.appendChild(inp); fieldsDiv.appendChild(row); inputs.push(inp);
            });
            const cleanup = (val) => {
                backdrop.remove();
                setMainPopupLayerActive(false);
                resolve(val);
            };
            backdrop.querySelector('.cpb-unresolved-close').onclick = () => cleanup(null);
            backdrop.querySelector('.cpb-unresolved-cancel').onclick = () => cleanup(null);
            backdrop.querySelector('.cpb-unresolved-ok').onclick = () => cleanup(inputs.map(inp => inp.value));
            backdrop.addEventListener('click', (e) => { if (e.target === backdrop) cleanup(null); });
            document.body.appendChild(backdrop); if (inputs[0]) inputs[0].focus();
        });
    }

    // =============================================
    // Import / Export
    // =============================================
    function showCpbDialog(options = {}) {
        const {
            title = 'Notice',
            messageHtml = '',
            actions = [{ id: 'ok', label: 'OK', variant: 'primary' }],
            dismissActionId = 'cancel',
            closeOnBackdrop = true
        } = options;

        return new Promise((resolve) => {
            const backdrop = document.createElement('div');
            backdrop.className = 'cpb-dialog-backdrop';

            const normalizedActions = Array.isArray(actions) && actions.length
                ? actions
                : [{ id: 'ok', label: 'OK', variant: 'primary' }];

            const actionHtml = normalizedActions.map((action) => {
                const id = safeHtml(action.id || 'ok');
                const label = safeHtml(action.label || 'OK');
                let btnClass = 'cpb-btn cpb-btn-secondary';
                if (action.variant === 'primary') btnClass = 'cpb-btn cpb-btn-primary';
                if (action.variant === 'danger') btnClass = 'cpb-btn cpb-btn-danger';
                return `<button class="${btnClass}" data-cpb-dialog-action="${id}">${label}</button>`;
            }).join('');

            backdrop.innerHTML = `
                <div class="cpb-dialog-modal" role="dialog" aria-modal="true" aria-label="${safeHtml(title)}">
                    <div class="cpb-dialog-header">
                        <span>${safeHtml(title)}</span>
                        <button class="cpb-dialog-close" aria-label="Close">&times;</button>
                    </div>
                    <div class="cpb-dialog-body">${messageHtml}</div>
                    <div class="cpb-dialog-footer">${actionHtml}</div>
                </div>
            `;

            let resolved = false;
            const cleanup = (actionId) => {
                if (resolved) return;
                resolved = true;
                window.removeEventListener('keydown', onKeydown, true);
                backdrop.remove();
                resolve(actionId);
            };

            const onKeydown = (e) => {
                if (e.key !== 'Escape') return;
                const fallbackId = normalizedActions.some((a) => a.id === dismissActionId)
                    ? dismissActionId
                    : normalizedActions[normalizedActions.length - 1].id;
                cleanup(fallbackId);
            };

            backdrop.querySelector('.cpb-dialog-close').onclick = () => {
                const fallbackId = normalizedActions.some((a) => a.id === dismissActionId)
                    ? dismissActionId
                    : normalizedActions[normalizedActions.length - 1].id;
                cleanup(fallbackId);
            };

            [...backdrop.querySelectorAll('[data-cpb-dialog-action]')].forEach((btn) => {
                btn.onclick = () => cleanup(btn.getAttribute('data-cpb-dialog-action'));
            });

            if (closeOnBackdrop) {
                backdrop.addEventListener('click', (e) => {
                    if (e.target !== backdrop) return;
                    const fallbackId = normalizedActions.some((a) => a.id === dismissActionId)
                        ? dismissActionId
                        : normalizedActions[normalizedActions.length - 1].id;
                    cleanup(fallbackId);
                });
            }

            document.body.appendChild(backdrop);
            window.addEventListener('keydown', onKeydown, true);
        });
    }

    function handleExport() {
        flushPendingCurrentSave();
        const p = getCurrentPrompt();
        const titleSlug = sanitizeFilename(p?.title || 'all');
        const ts = fmtTimestamp(Date.now());
        const filename = `smc-prompts-${titleSlug}-${ts}.json`;
        const normalizedPrompts = normalizePromptList(cpbPrompts, { sanitizeSystemVarNames: false }).prompts;
        const normalizedGlobalVars = normalizeGlobalVars(cpbGlobalVars, { allowSystemNames: false }).vars;
        downloadJSON(filename, {
            schema: CPB_EXPORT_SCHEMA,
            version: CPB_EXPORT_VERSION,
            exportedAt: new Date().toISOString(),
            systemVarsPolicy: 'runtime-only',
            prompts: normalizedPrompts,
            globalVars: normalizedGlobalVars
        });
    }

    async function handleImport() {
        const file = await pickFile('.json'); if (!file) return;
        const text = await file.text();
        try {
            const payload = JSON.parse(text);
            const extracted = extractImportData(payload);
            if (!extracted) {
                await showCpbDialog({
                    title: 'Import Failed',
                    messageHtml: '<p>Invalid format. Required: <code>prompts</code> (array), <code>globalVars</code> (array).</p>',
                    actions: [{ id: 'ok', label: 'OK', variant: 'primary' }],
                    dismissActionId: 'ok'
                });
                return;
            }

            const normalizedImportedPrompts = normalizePromptList(extracted.prompts, { sanitizeSystemVarNames: true });
            const normalizedImportedGlobals = normalizeGlobalVars(extracted.globalVars, { allowSystemNames: false });

            const importMode = await showCpbDialog({
                title: 'Choose Import Mode',
                messageHtml:
                    '<p><b>Safe Merge</b> keeps existing data and adds only safe entries.</p>' +
                    '<ul class="cpb-dialog-list">' +
                    '<li>Keep existing prompts and global variables</li>' +
                    '<li>Skip prompt ID collisions</li>' +
                    '<li>Skip duplicate prompts by content</li>' +
                    '<li>Protect reserved system variable names</li>' +
                    '</ul>' +
                    '<p><b>Full Overwrite</b> replaces all current prompts/global variables.</p>',
                actions: [
                    { id: 'safe-merge', label: 'Safe Merge (Recommended)', variant: 'primary' },
                    { id: 'full-overwrite', label: 'Full Overwrite', variant: 'danger' },
                    { id: 'cancel', label: 'Cancel', variant: 'secondary' }
                ],
                dismissActionId: 'cancel'
            });

            if (importMode === 'cancel') return;

            let nextPrompts = [];
            let nextGlobalVars = [];
            let report = null;

            if (importMode === 'safe-merge') {
                const mergedPrompts = mergePromptsSafely(cpbPrompts, normalizedImportedPrompts.prompts);
                const mergedGlobals = mergeGlobalVarsSafely(cpbGlobalVars, normalizedImportedGlobals.vars);
                nextPrompts = mergedPrompts.prompts;
                nextGlobalVars = mergedGlobals.vars;
                report = buildImportReport({
                    mode: 'safe-merge',
                    promptStats: { ...normalizedImportedPrompts.stats, ...mergedPrompts.stats },
                    globalStats: { ...normalizedImportedGlobals.stats, ...mergedGlobals.stats }
                });
            } else {
                const overwriteConfirm = await showCpbDialog({
                    title: 'Confirm Full Overwrite',
                    messageHtml: '<p>Full Overwrite will replace all existing prompts and global variables.</p><p><b>This action cannot be undone.</b></p>',
                    actions: [
                        { id: 'confirm-overwrite', label: 'Overwrite', variant: 'danger' },
                        { id: 'cancel', label: 'Cancel', variant: 'secondary' }
                    ],
                    dismissActionId: 'cancel'
                });
                if (overwriteConfirm !== 'confirm-overwrite') return;
                nextPrompts = normalizedImportedPrompts.prompts;
                nextGlobalVars = normalizedImportedGlobals.vars;
                report = buildImportReport({
                    mode: 'full-overwrite',
                    promptStats: { ...normalizedImportedPrompts.stats, promptsLoaded: nextPrompts.length },
                    globalStats: { ...normalizedImportedGlobals.stats, varsLoaded: nextGlobalVars.length }
                });
            }

            cpbPrompts = nextPrompts;
            cpbGlobalVars = nextGlobalVars;
            savePrompts();
            saveGlobalVars();
            cpbCurrentId = cpbPrompts[0]?.id ?? null;
            renderAll();
            if (cpbCurrentId) loadToEditor(cpbCurrentId);
            else {
                el.promptTitle.value = '';
                setEditorValue('');
                el.preview.textContent = '';
                markDirty(false);
            }
            await showCpbDialog({
                title: 'Import Complete',
                messageHtml: `<pre class="cpb-dialog-report">${safeHtml(report)}</pre>`,
                actions: [{ id: 'ok', label: 'Done', variant: 'primary' }],
                dismissActionId: 'ok'
            });
        } catch (e) {
            await showCpbDialog({
                title: 'Import Failed',
                messageHtml: '<p>Failed to parse JSON file. Please verify the file content and try again.</p>',
                actions: [{ id: 'ok', label: 'OK', variant: 'primary' }],
                dismissActionId: 'ok'
            });
        }
    }

    // =============================================
    // Zen Mode
    // =============================================
    let _preZenSidebar = false;
    let _preZenVars = false;

    function applyZen() {
        if (cpbZen) {
            // Save pre-zen state BEFORE collapsing
            _preZenSidebar = el.sidebar.classList.contains('cpb-collapsed');
            _preZenVars = el.varsPanel.classList.contains('cpb-collapsed');
            el.sidebar.classList.add('cpb-collapsed');
            el.varsPanel.classList.add('cpb-collapsed');
        } else {
            // Restore to pre-zen state
            if (_preZenSidebar) el.sidebar.classList.add('cpb-collapsed');
            else el.sidebar.classList.remove('cpb-collapsed');
            if (_preZenVars) el.varsPanel.classList.add('cpb-collapsed');
            else el.varsPanel.classList.remove('cpb-collapsed');
        }
    }

    // =============================================
    // Resizable Panels
    // =============================================
    function makeResizable(panel, handle, key, min, max, side) {
        let dragging = false, startX = 0, startW = 0;
        handle.addEventListener('mousedown', (e) => { dragging = true; startX = e.clientX; startW = panel.getBoundingClientRect().width; document.body.style.cursor = 'col-resize'; e.preventDefault(); });
        window.addEventListener('mousemove', (e) => {
            if (!dragging) return;
            const dx = e.clientX - startX;
            let w = side === 'right' ? (startW + dx) : (startW - dx);
            w = Math.max(min, Math.min(max, w));
            panel.style.width = w + 'px';
            const ui = loadUI(); ui[key] = w; localStorage.setItem(LS_UI, JSON.stringify(ui));
        });
        window.addEventListener('mouseup', () => { if (!dragging) return; dragging = false; document.body.style.cursor = ''; });
    }

    // =============================================
    // Utilities
    // =============================================
    function uid() { return Math.random().toString(16).slice(2) + Date.now().toString(16); }

    function fmt(ms) {
        if (!ms) return '-';
        const d = new Date(ms);
        return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
    }

    function fmtTimestamp(ms) {
        const d = new Date(ms);
        return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}_${String(d.getHours()).padStart(2,'0')}${String(d.getMinutes()).padStart(2,'0')}${String(d.getSeconds()).padStart(2,'0')}`;
    }

    function previewOf(text) { const t = (text || '').replace(/\s+/g, ' ').trim(); return t.length > 80 ? t.slice(0, 80) + '...' : (t || '--'); }
    function safeHtml(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;'); }
    function sanitizeVarName(name) { return (name || '').trim().replace(/[^a-zA-Z0-9_]/g, '').replace(/^_+|_+$/g, '').slice(0, 40); }
    function sanitizeFilename(name) { return (name || '').trim().replace(/[^a-zA-Z0-9가-힣\-_]/g, '_').slice(0, 50) || 'untitled'; }
    function normalizePromptText(text) { return String(text ?? '').replace(/\r\n?/g, '\n').trim(); }

    function extractVariableTokens(text) {
        const src = String(text || '');
        const re = /\{\{([a-zA-Z0-9_]+)\}\}/g;
        const seen = new Set();
        const out = [];
        let m;
        while ((m = re.exec(src)) !== null) {
            const name = sanitizeVarName(m[1]);
            if (!name) continue;
            const lower = name.toLowerCase();
            if (seen.has(lower)) continue;
            seen.add(lower);
            out.push(name);
        }
        return out;
    }

    function getIgnoredSuggestedSet(promptId, createIfMissing = false) {
        if (!promptId) return null;
        let set = cpbIgnoredSuggestedLocals.get(promptId);
        if (!set && createIfMissing) {
            set = new Set();
            cpbIgnoredSuggestedLocals.set(promptId, set);
        }
        return set || null;
    }

    function clearStaleIgnoredSuggestions(promptId, validNamesLower) {
        const ignored = getIgnoredSuggestedSet(promptId, false);
        if (!ignored) return;
        [...ignored].forEach((nameLower) => {
            if (!validNamesLower.has(nameLower)) ignored.delete(nameLower);
        });
        if (ignored.size === 0) cpbIgnoredSuggestedLocals.delete(promptId);
    }

    function refreshSuggestedLocalVars(opts = {}) {
        const { render = true, autoOpenLocal = true } = opts;
        const prevCount = cpbSuggestedLocalVars.length;
        const p = getCurrentPrompt();
        if (!p) {
            cpbSuggestedLocalVars = [];
            updateLocalTabDecisionBadge();
            if (render) renderLocalSuggestions();
            return;
        }

        const tokenNames = extractVariableTokens(getEditorValue());
        const tokenSetLower = new Set(tokenNames.map(n => n.toLowerCase()));
        clearStaleIgnoredSuggestions(p.id, tokenSetLower);

        const ignored = getIgnoredSuggestedSet(p.id, false) || new Set();
        const knownLower = new Set();
        SYSTEM_VARS.forEach((v) => knownLower.add(v.name.toLowerCase()));
        cpbGlobalVars.forEach((v) => {
            if (!v?.name) return;
            knownLower.add(v.name.toLowerCase());
        });
        (p.localVars || []).forEach((v) => {
            if (!v?.name) return;
            knownLower.add(v.name.toLowerCase());
        });

        cpbSuggestedLocalVars = tokenNames
            .filter((name) => {
                const lower = name.toLowerCase();
                if (knownLower.has(lower)) return false;
                if (ignored.has(lower)) return false;
                return true;
            })
            .slice(0, 12);

        updateLocalTabDecisionBadge();
        maybeAutoOpenLocalTabForDecision(prevCount, cpbSuggestedLocalVars.length, autoOpenLocal);
        if (render) renderLocalSuggestions();
    }

    function getCurrentVarTab() {
        return document.querySelector('.cpb-var-tab.cpb-tab-active')?.dataset?.tab || 'global';
    }

    function setVarTab(tab) {
        if (!tab) return;
        document.querySelectorAll('.cpb-var-tab').forEach((x) => x.classList.toggle('cpb-tab-active', x.dataset.tab === tab));
        const globalPanel = document.getElementById('cpb-panel-global');
        const localPanel = document.getElementById('cpb-panel-local');
        const systemPanel = document.getElementById('cpb-panel-system');
        if (globalPanel) globalPanel.style.display = tab === 'global' ? 'block' : 'none';
        if (localPanel) localPanel.style.display = tab === 'local' ? 'block' : 'none';
        if (systemPanel) systemPanel.style.display = tab === 'system' ? 'block' : 'none';
    }

    function updateLocalTabDecisionBadge() {
        if (!el.localTabBadge) return;
        const count = cpbSuggestedLocalVars.length;
        if (!count) {
            el.localTabBadge.style.display = 'none';
            el.localTabBadge.textContent = '';
            return;
        }
        el.localTabBadge.style.display = 'inline-flex';
        el.localTabBadge.textContent = String(Math.min(99, count));
    }

    function maybeAutoOpenLocalTabForDecision(prevCount, nextCount, autoOpenLocal) {
        if (!autoOpenLocal) return;
        if (nextCount <= 0 || nextCount <= prevCount) return;
        if (cpbZen) return;
        if (!el.varsPanel || el.varsPanel.classList.contains('cpb-collapsed')) return;
        if (getCurrentVarTab() === 'local') return;
        setVarTab('local');
    }

    function focusLocalTabForDecision() {
        if (el.varsPanel?.classList.contains('cpb-collapsed')) {
            el.varsPanel.classList.remove('cpb-collapsed');
            persistUI();
        }
        setVarTab('local');
        const firstActionBtn = el.localSuggestRows?.querySelector('.cpb-var-suggest-btn');
        if (firstActionBtn) firstActionBtn.focus();
    }

    function showPendingLocalDecisionCloseModal(pendingCount) {
        if (cpbPendingCloseWarnOpen) return;
        cpbPendingCloseWarnOpen = true;
        const backdrop = document.createElement('div');
        backdrop.className = 'cpb-unresolved-backdrop';
        backdrop.innerHTML = `
            <div class="cpb-unresolved-modal">
                <div class="cpb-unresolved-header">
                    <span>Local Variable Action Needed</span>
                    <button class="cpb-unresolved-close">&times;</button>
                </div>
                <div class="cpb-unresolved-body">
                    <p><b>${pendingCount}</b> detected local variable${pendingCount > 1 ? 's' : ''} still need a decision.</p>
                    <p>Please review them in the <b>Local</b> tab before closing.</p>
                </div>
                <div class="cpb-unresolved-footer">
                    <button class="cpb-btn cpb-btn-secondary cpb-unresolved-cancel">Review in Local Tab</button>
                    <button class="cpb-btn cpb-btn-danger cpb-unresolved-ok">Close Anyway</button>
                </div>
            </div>
        `;
        const cleanup = () => {
            cpbPendingCloseWarnOpen = false;
            backdrop.remove();
        };
        backdrop.querySelector('.cpb-unresolved-close').onclick = cleanup;
        backdrop.querySelector('.cpb-unresolved-cancel').onclick = cleanup;
        backdrop.querySelector('.cpb-unresolved-ok').onclick = () => {
            cleanup();
            closeCPB({ skipPendingDecisionGuard: true });
        };
        backdrop.addEventListener('click', (e) => { if (e.target === backdrop) cleanup(); });
        document.body.appendChild(backdrop);
    }

    function renderLocalSuggestions() {
        if (!el.localSuggestBox || !el.localSuggestRows || !el.localSuggestCount) return;
        el.localSuggestRows.innerHTML = '';
        if (!cpbSuggestedLocalVars.length) {
            el.localSuggestBox.style.display = 'none';
            el.localSuggestCount.textContent = '';
            return;
        }

        el.localSuggestBox.style.display = 'block';
        el.localSuggestCount.textContent = `${cpbSuggestedLocalVars.length} detected`;

        cpbSuggestedLocalVars.forEach((name) => {
            const row = document.createElement('div');
            row.className = 'cpb-var-suggest-row';
            row.innerHTML = `<div class="cpb-var-suggest-name">{{${safeHtml(name)}}}</div>`;

            const actions = document.createElement('div');
            actions.className = 'cpb-var-suggest-actions';

            const addBtn = document.createElement('button');
            addBtn.className = 'cpb-var-suggest-btn';
            addBtn.textContent = 'Add';
            addBtn.onclick = () => addSuggestedLocalVar(name);

            const ignoreBtn = document.createElement('button');
            ignoreBtn.className = 'cpb-var-suggest-btn cpb-var-suggest-btn-muted';
            ignoreBtn.textContent = 'Ignore';
            ignoreBtn.onclick = () => ignoreSuggestedLocalVar(name);

            actions.appendChild(addBtn);
            actions.appendChild(ignoreBtn);
            row.appendChild(actions);
            el.localSuggestRows.appendChild(row);
        });
    }

    function addSuggestedLocalVar(name) {
        const p = getCurrentPrompt();
        if (!p || !name) return;
        const sanitized = sanitizeVarName(name);
        if (!sanitized) return;
        const nextLower = sanitized.toLowerCase();

        const alreadyExists = (p.localVars || []).some(v => (v?.name || '').toLowerCase() === nextLower)
            || cpbGlobalVars.some(v => (v?.name || '').toLowerCase() === nextLower)
            || SYSTEM_VARS.some(v => v.name.toLowerCase() === nextLower);
        if (alreadyExists) {
            refreshSuggestedLocalVars();
            return;
        }

        p.localVars = p.localVars || [];
        p.localVars.push({ name: sanitized, value: '' });
        touchPrompt(p);
        savePrompts();
        scheduleSidePanelAutoSave();
        renderVarsPanels();
    }

    function addAllSuggestedLocalVars() {
        const p = getCurrentPrompt();
        if (!p || !cpbSuggestedLocalVars.length) return;
        const namesToAdd = [...cpbSuggestedLocalVars];
        const existingLower = new Set((p.localVars || []).map(v => (v?.name || '').toLowerCase()));
        cpbGlobalVars.forEach(v => existingLower.add((v?.name || '').toLowerCase()));
        SYSTEM_VARS.forEach(v => existingLower.add(v.name.toLowerCase()));
        p.localVars = p.localVars || [];

        let addedCount = 0;
        namesToAdd.forEach((name) => {
            const sanitized = sanitizeVarName(name);
            if (!sanitized) return;
            const lower = sanitized.toLowerCase();
            if (existingLower.has(lower)) return;
            existingLower.add(lower);
            p.localVars.push({ name: sanitized, value: '' });
            addedCount++;
        });
        if (!addedCount) return;
        touchPrompt(p);
        savePrompts();
        scheduleSidePanelAutoSave();
        renderVarsPanels();
    }

    function ignoreSuggestedLocalVar(name) {
        const p = getCurrentPrompt();
        if (!p || !name) return;
        const sanitized = sanitizeVarName(name);
        if (!sanitized) return;
        const ignored = getIgnoredSuggestedSet(p.id, true);
        ignored.add(sanitized.toLowerCase());
        scheduleSidePanelAutoSave();
        refreshSuggestedLocalVars();
    }

    function isSystemVarName(name) {
        return SYSTEM_VARS.some(v => v.name === name);
    }

    function toTimestampMs(value, fallback) {
        if (typeof value === 'number' && Number.isFinite(value)) return value;
        if (typeof value === 'string' && value.trim()) {
            const parsed = Date.parse(value);
            if (!Number.isNaN(parsed)) return parsed;
        }
        return fallback;
    }

    function makeUniqueVarName(baseName, takenNamesLower) {
        let base = sanitizeVarName(baseName || 'var') || 'var';
        if (isSystemVarName(base)) base = `${base}_imported`;
        let next = base;
        let idx = 2;
        while (takenNamesLower.has(next.toLowerCase()) || isSystemVarName(next)) {
            next = `${base}_${idx++}`;
        }
        takenNamesLower.add(next.toLowerCase());
        return next;
    }

    function normalizeVarList(rawVars, options = {}) {
        const allowSystemNames = !!options.allowSystemNames;
        const renameSystemNames = !!options.renameSystemNames;
        const byName = new Map();
        const stats = {
            invalidSkipped: 0,
            duplicatedInFile: 0,
            systemRenamed: 0,
            systemSkipped: 0
        };
        if (!Array.isArray(rawVars)) {
            return { vars: [], stats };
        }
        const seenLower = new Set();
        rawVars.forEach((raw) => {
            const originalName = sanitizeVarName(raw?.name || '');
            const value = String(raw?.value ?? '');
            if (!originalName) {
                stats.invalidSkipped++;
                return;
            }
            let finalName = originalName;
            if (!allowSystemNames && isSystemVarName(finalName)) {
                if (!renameSystemNames) {
                    stats.systemSkipped++;
                    return;
                }
                finalName = makeUniqueVarName(`${finalName}_imported`, seenLower);
                stats.systemRenamed++;
            } else {
                const lower = finalName.toLowerCase();
                if (!seenLower.has(lower)) seenLower.add(lower);
            }
            const lowerKey = finalName.toLowerCase();
            if (byName.has(lowerKey)) stats.duplicatedInFile++;
            byName.set(lowerKey, { name: finalName, value });
        });
        return { vars: [...byName.values()], stats };
    }

    function normalizePromptEntry(rawPrompt, options = {}) {
        if (!rawPrompt || typeof rawPrompt !== 'object') return null;
        const now = Date.now();
        const title = String(rawPrompt.title ?? '').trim();
        const content = normalizePromptText(rawPrompt.content ?? '');
        if (!title && !content) return null;
        const vars = normalizeVarList(rawPrompt.localVars, {
            allowSystemNames: false,
            renameSystemNames: !!options.sanitizeSystemVarNames
        });
        return {
            prompt: {
                id: String(rawPrompt.id ?? '').trim() || uid(),
                title,
                content,
                localVars: vars.vars,
                createdAt: toTimestampMs(rawPrompt.createdAt, now),
                updatedAt: toTimestampMs(rawPrompt.updatedAt, now),
                lastUsedAt: toTimestampMs(rawPrompt.lastUsedAt, now),
            },
            varStats: vars.stats
        };
    }

    function promptSignature(prompt) {
        const title = (prompt.title || '').trim().toLowerCase();
        const content = normalizePromptText(prompt.content || '').replace(/[ \t]+\n/g, '\n');
        return `${title}::${content}`;
    }

    function normalizePromptList(rawPrompts, options = {}) {
        const prompts = [];
        const seenIds = new Set();
        const seenSignatures = new Set();
        const stats = {
            invalidSkipped: 0,
            duplicateInFileSkipped: 0,
            idRegeneratedInFile: 0,
            localSystemVarsRenamed: 0,
            localSystemVarsSkipped: 0
        };
        if (!Array.isArray(rawPrompts)) return { prompts, stats };

        rawPrompts.forEach((rawPrompt) => {
            const normalized = normalizePromptEntry(rawPrompt, options);
            if (!normalized) {
                stats.invalidSkipped++;
                return;
            }
            const p = normalized.prompt;
            stats.localSystemVarsRenamed += normalized.varStats.systemRenamed;
            stats.localSystemVarsSkipped += normalized.varStats.systemSkipped;
            if (seenIds.has(p.id)) {
                p.id = uid();
                stats.idRegeneratedInFile++;
            }
            const signature = promptSignature(p);
            if (seenSignatures.has(signature)) {
                stats.duplicateInFileSkipped++;
                return;
            }
            seenIds.add(p.id);
            seenSignatures.add(signature);
            prompts.push(p);
        });

        return { prompts, stats };
    }

    function normalizeGlobalVars(rawGlobalVars, options = {}) {
        const normalized = normalizeVarList(rawGlobalVars, {
            allowSystemNames: !!options.allowSystemNames,
            renameSystemNames: false
        });
        return { vars: normalized.vars, stats: normalized.stats };
    }

    function makeUniqueImportedTitle(baseTitle, takenTitleLowerSet) {
        const base = (baseTitle || 'Untitled').trim() || 'Untitled';
        let candidate = `${base} (Imported)`;
        let i = 2;
        while (takenTitleLowerSet.has(candidate.toLowerCase())) {
            candidate = `${base} (Imported ${i++})`;
        }
        takenTitleLowerSet.add(candidate.toLowerCase());
        return candidate;
    }

    function mergePromptsSafely(existingPrompts, importedPrompts) {
        const merged = [...existingPrompts];
        const existingIds = new Set(existingPrompts.map(p => p.id));
        const existingSignatures = new Set(existingPrompts.map(promptSignature));
        const existingTitles = new Set(existingPrompts.map(p => (p.title || '').trim().toLowerCase()).filter(Boolean));
        const stats = {
            added: 0,
            idConflictSkipped: 0,
            duplicateSkipped: 0,
            titleRenamed: 0
        };

        importedPrompts.forEach((imported) => {
            if (existingIds.has(imported.id)) {
                stats.idConflictSkipped++;
                return;
            }
            const signature = promptSignature(imported);
            if (existingSignatures.has(signature)) {
                stats.duplicateSkipped++;
                return;
            }
            const next = JSON.parse(JSON.stringify(imported));
            const titleLower = (next.title || '').trim().toLowerCase();
            if (titleLower && existingTitles.has(titleLower)) {
                next.title = makeUniqueImportedTitle(next.title, existingTitles);
                stats.titleRenamed++;
            } else if (titleLower) {
                existingTitles.add(titleLower);
            }
            merged.push(next);
            existingIds.add(next.id);
            existingSignatures.add(signature);
            stats.added++;
        });

        return { prompts: merged, stats };
    }

    function mergeGlobalVarsSafely(existingVars, importedVars) {
        const merged = normalizeGlobalVars(existingVars, { allowSystemNames: false }).vars;
        const byName = new Set(merged.map(v => v.name.toLowerCase()));
        const stats = {
            added: 0,
            nameConflictSkipped: 0,
            reservedSkipped: 0
        };

        importedVars.forEach((item) => {
            if (isSystemVarName(item.name)) {
                stats.reservedSkipped++;
                return;
            }
            const lower = item.name.toLowerCase();
            if (byName.has(lower)) {
                stats.nameConflictSkipped++;
                return;
            }
            merged.push(item);
            byName.add(lower);
            stats.added++;
        });

        return { vars: merged, stats };
    }

    function extractImportData(payload) {
        if (!payload || typeof payload !== 'object') return null;
        const hasExplicitShape = Array.isArray(payload.prompts) && Array.isArray(payload.globalVars);
        if (hasExplicitShape) {
            return { prompts: payload.prompts, globalVars: payload.globalVars };
        }
        // Legacy fallback: some exports may only include prompts array
        if (Array.isArray(payload.prompts)) {
            return { prompts: payload.prompts, globalVars: [] };
        }
        return null;
    }

    function buildImportReport({ mode, promptStats, globalStats }) {
        const lines = [];
        lines.push(`Import completed (${mode === 'safe-merge' ? 'Safe Merge' : 'Full Overwrite'})`);
        lines.push('');
        lines.push('[Prompts]');
        if (mode === 'safe-merge') {
            lines.push(`- Added: ${promptStats.added || 0}`);
            lines.push(`- Skipped (ID conflict): ${promptStats.idConflictSkipped || 0}`);
            lines.push(`- Skipped (duplicate content): ${promptStats.duplicateSkipped || 0}`);
            lines.push(`- Renamed (title conflict): ${promptStats.titleRenamed || 0}`);
        } else {
            lines.push(`- Loaded: ${promptStats.promptsLoaded || 0}`);
        }
        lines.push(`- Skipped (invalid in file): ${promptStats.invalidSkipped || 0}`);
        lines.push(`- Skipped (duplicate in file): ${promptStats.duplicateInFileSkipped || 0}`);
        lines.push(`- Regenerated ID (duplicate in file): ${promptStats.idRegeneratedInFile || 0}`);
        lines.push(`- Local vars renamed (system reserved): ${promptStats.localSystemVarsRenamed || 0}`);
        lines.push(`- Local vars skipped (system reserved): ${promptStats.localSystemVarsSkipped || 0}`);
        lines.push('');
        lines.push('[Global Variables]');
        if (mode === 'safe-merge') {
            lines.push(`- Added: ${globalStats.added || 0}`);
            lines.push(`- Skipped (name conflict): ${globalStats.nameConflictSkipped || 0}`);
        } else {
            lines.push(`- Loaded: ${globalStats.varsLoaded || 0}`);
        }
        lines.push(`- Skipped (invalid in file): ${globalStats.invalidSkipped || 0}`);
        lines.push(`- Skipped (duplicate in file): ${globalStats.duplicatedInFile || 0}`);
        lines.push(`- Skipped (system reserved): ${globalStats.systemSkipped || globalStats.reservedSkipped || 0}`);
        return lines.join('\n');
    }

    function sortPrompts(arr) {
        if (cpbSortMode === 'title') return arr.sort((a, b) => (a.title || '').localeCompare((b.title || ''), 'ko'));
        return arr.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    }

    function getMainPromptValue() {
        const masterInput = document.getElementById('master-input');
        return masterInput?.value || '';
    }

    function insertAtCaret(textarea, text) {
        const start = textarea.selectionStart, end = textarea.selectionEnd, v = textarea.value;
        textarea.value = v.slice(0, start) + text + v.slice(end);
        const pos = start + text.length; textarea.setSelectionRange(pos, pos); textarea.focus(); markDirty(true);
    }

    function downloadJSON(filename, obj) {
        const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = filename;
        document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    }

    function pickFile(accept) {
        return new Promise((resolve) => {
            const inp = document.createElement('input'); inp.type = 'file'; inp.accept = accept;
            inp.onchange = () => resolve(inp.files && inp.files[0] ? inp.files[0] : null); inp.click();
        });
    }

    // =============================================
    // Main Input: Preview, Autocomplete, Variable Edit
    // =============================================
    let miPreviewMode = false;
    let miPreviewTheme = 'light';
    let miAcOpen = false, miAcAnchor = -1, miAcItems = [], miAcSelected = 0;
    let miSlashOpen = false, miSlashAnchor = -1, miSlashItems = [], miSlashSelected = 0;
    let miPopupLayerRefCount = 0;
    let miModalLayerRefCount = 0;
    let miExpandedLayerActive = false;
    let sessionPromptModal = null;
    let sessionPromptEditorMde = null;
    const sessionPromptState = {
        previewMode: false,
        livePreview: false,
        highlightVars: true,
        onlyMissing: false,
        activeVarTab: 'session',
    };
    let sessionAcOpen = false, sessionAcAnchor = -1, sessionAcItems = [], sessionAcSelected = 0, sessionAcPaletteMode = false;
    let sessionSlashOpen = false, sessionSlashAnchor = -1, sessionSlashItems = [], sessionSlashSelected = 0;
    let sessionScrollSyncLock = false;
    const VAR_TOKEN_RE = /\{\{([a-zA-Z0-9_]+)\}\}/g;

    function syncMainLayerState() {
        const hasPopupLayer = miPopupLayerRefCount > 0;
        const hasModalLayer = miModalLayerRefCount > 0;
        const shouldHideWebviews = hasPopupLayer || hasModalLayer || miExpandedLayerActive;

        document.body.classList.toggle('main-popup-layer-active', hasPopupLayer);
        document.body.classList.toggle('main-modal-layer-active', hasModalLayer);

        try { window.electronAPI.setServiceVisibility(!shouldHideWebviews); } catch (e) { }
    }

    function setMainPopupLayerActive(active) {
        if (active) miPopupLayerRefCount += 1;
        else miPopupLayerRefCount = Math.max(0, miPopupLayerRefCount - 1);
        syncMainLayerState();
    }

    function setMainModalLayerActive(active) {
        if (active) miModalLayerRefCount += 1;
        else miModalLayerRefCount = Math.max(0, miModalLayerRefCount - 1);
        syncMainLayerState();
    }

    function setMainExpandedLayerActive(active) {
        miExpandedLayerActive = !!active;
        syncMainLayerState();
    }

    function escapeAttr(s) {
        return safeHtml(String(s ?? ''));
    }

    // --- Variable Input Modal (hides webviews) ---
    function showVariableInputModal(unresolvedNames, allVarInfo) {
        return new Promise((resolve) => {
            const modal = document.getElementById('var-input-modal');
            const rowsContainer = document.getElementById('var-input-rows');
            const unresolvedStatEl = document.getElementById('var-input-unresolved-stat');
            const totalStatEl = document.getElementById('var-input-total-stat');
            const sendBtn = document.getElementById('var-input-send-btn');
            const sendAnywayBtn = document.getElementById('var-input-send-anyway-btn');
            const cancelBtn = document.getElementById('var-input-cancel-btn');
            const closeBtn = document.getElementById('close-var-input-modal-btn');
            if (!modal || !rowsContainer) { resolve({ action: 'cancel' }); return; }

            rowsContainer.innerHTML = '';
            unresolvedNames.forEach((name) => {
                const info = allVarInfo[name] || {};
                const source = info.source || 'Session';
                const currentValue = info.value || '';
                const isUnresolved = !String(currentValue).trim();
                const row = document.createElement('div');
                row.className = `var-input-row${isUnresolved ? ' unresolved' : ''}`;
                row.innerHTML = `
                    <label class="var-input-row-label">{{${escapeAttr(name)}}}<span class="var-input-row-scope">${escapeAttr(source)}</span></label>
                    <textarea data-var-name="${escapeAttr(name)}" placeholder="Enter value for ${escapeAttr(name)}">${safeHtml(currentValue)}</textarea>
                `;
                rowsContainer.appendChild(row);
            });

            modal.classList.toggle('var-input-many', unresolvedNames.length >= 8);

            const updateStats = () => {
                const unresolvedCount = [...rowsContainer.querySelectorAll('textarea')]
                    .filter((ta) => !String(ta.value || '').trim()).length;
                if (unresolvedStatEl) {
                    unresolvedStatEl.textContent = `Unresolved ${unresolvedCount}`;
                    unresolvedStatEl.classList.toggle('warning', unresolvedCount > 0);
                }
                if (totalStatEl) totalStatEl.textContent = `Total ${unresolvedNames.length}`;
            };

            rowsContainer.querySelectorAll('textarea').forEach((ta) => {
                ta.addEventListener('input', () => {
                    ta.closest('.var-input-row')?.classList.toggle('unresolved', !String(ta.value).trim());
                    updateStats();
                });
            });
            updateStats();

            setMainModalLayerActive(true);
            modal.classList.add('visible');
            const firstTa = rowsContainer.querySelector('textarea');
            if (firstTa) firstTa.focus();

            let resolved = false;
            const onKeydown = (e) => {
                if (e.key === 'Escape') cleanup({ action: 'cancel' });
            };
            const cleanup = (result) => {
                if (resolved) return;
                resolved = true;
                modal.classList.remove('visible');
                window.removeEventListener('keydown', onKeydown, true);
                setMainModalLayerActive(false);
                resolve(result);
            };

            const collectValues = () => {
                const values = {};
                rowsContainer.querySelectorAll('textarea').forEach((ta) => {
                    values[ta.getAttribute('data-var-name')] = ta.value;
                });
                return values;
            };

            sendBtn.onclick = () => cleanup({ action: 'send', values: collectValues() });
            sendAnywayBtn.onclick = () => cleanup({ action: 'send-anyway', values: collectValues() });
            cancelBtn.onclick = () => cleanup({ action: 'cancel' });
            closeBtn.onclick = () => cleanup({ action: 'cancel' });
            window.addEventListener('keydown', onKeydown, true);
        });
    }

    // --- Preview Modal (full-screen, CPB-like split + live preview) ---
    function openPreviewModal() {
        const masterInput = document.getElementById('master-input');
        const modal = document.getElementById('preview-modal');
        const previewContent = document.getElementById('preview-modal-content');
        const previewThemeWrap = document.getElementById('preview-modal-theme');
        const editor = document.getElementById('preview-modal-editor');
        const liveToggle = document.getElementById('preview-live-toggle');
        const editorPane = document.getElementById('preview-modal-editor-pane');
        const previewPane = document.getElementById('preview-modal-preview-pane');
        if (!modal || !previewContent || !masterInput || !editor || !liveToggle || !editorPane || !previewPane) return;

        let isClosing = false;
        let syncLock = false;

        const renderFromText = async (text) => {
            const maps = await buildMainPreviewMapsAsync();
            const { html, mode } = buildVariableAwarePreviewHtml(text, maps, { allowEditButtons: false, mainInputContext: true });
            previewContent.classList.toggle('cpb-preview-md', mode === 'markdown');
            previewContent.classList.toggle('cpb-preview-plain', mode !== 'markdown');
            previewContent.innerHTML = html;
            applyMainPreviewTheme(previewContent, previewThemeWrap);
        };

        const updateSplitMode = () => {
            const live = !!liveToggle.checked;
            modal.classList.toggle('preview-live-enabled', live);
            editorPane.style.display = live ? '' : 'none';
            if (!live) {
                previewPane.classList.add('preview-pane-full');
            } else {
                previewPane.classList.remove('preview-pane-full');
            }
        };

        editor.value = masterInput.value || '';
        renderFromText(editor.value);
        updateSplitMode();

        previewContent.onclick = handlePreviewLinkClick;

        if (previewThemeWrap) {
            previewThemeWrap.querySelectorAll('.master-preview-theme-btn').forEach((btn) => {
                btn.onclick = () => {
                    miPreviewTheme = btn.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
                    applyMainPreviewTheme(previewContent, previewThemeWrap);
                };
            });
        }

        editor.oninput = () => {
            masterInput.value = editor.value;
            masterInput.dispatchEvent(new Event('input', { bubbles: true }));
            if (liveToggle.checked) renderFromText(editor.value);
        };

        liveToggle.onchange = () => {
            updateSplitMode();
            renderFromText(editor.value);
        };

        editor.onscroll = () => {
            if (!liveToggle.checked || syncLock) return;
            const maxSrc = editor.scrollHeight - editor.clientHeight;
            const maxDst = previewPane.scrollHeight - previewPane.clientHeight;
            const ratio = maxSrc > 0 ? (editor.scrollTop / maxSrc) : 0;
            syncLock = true;
            previewPane.scrollTop = ratio * Math.max(0, maxDst);
            syncLock = false;
        };
        previewPane.onscroll = () => {
            if (!liveToggle.checked || syncLock) return;
            const maxDst = previewPane.scrollHeight - previewPane.clientHeight;
            const maxSrc = editor.scrollHeight - editor.clientHeight;
            const ratio = maxDst > 0 ? (previewPane.scrollTop / maxDst) : 0;
            syncLock = true;
            editor.scrollTop = ratio * Math.max(0, maxSrc);
            syncLock = false;
        };

        setMainModalLayerActive(true);
        modal.classList.add('visible');

        const closeBtn = document.getElementById('close-preview-modal-btn');
        const closeBtn2 = document.getElementById('preview-modal-close-btn');
        const sendBtn = document.getElementById('preview-modal-send-btn');

        const closeModal = () => {
            if (isClosing) return;
            isClosing = true;
            modal.classList.remove('visible');
            setMainModalLayerActive(false);
            window.removeEventListener('keydown', onEsc, true);
        };
        if (closeBtn) closeBtn.onclick = closeModal;
        if (closeBtn2) closeBtn2.onclick = closeModal;

        if (sendBtn) {
            sendBtn.onclick = async () => {
                closeModal();
                if (typeof window.sendPrompt === 'function') window.sendPrompt();
            };
        }

        const onEsc = (e) => {
            if (e.key === 'Escape') closeModal();
        };
        window.addEventListener('keydown', onEsc, true);
    }

    // --- Prompt Expand/Collapse (hides webviews when expanded) ---
    let _promptExpanded = false;
    function setupPromptExpandButton() {
        const expandBtn = document.getElementById('prompt-expand-btn');
        const controlsContainer = document.getElementById('controls-container');
        const promptToggleBtn = document.getElementById('prompt-toggle-btn');
        if (!expandBtn || !controlsContainer) return;

        const COLLAPSE_SVG = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 14 10 14 10 20"></polyline><polyline points="20 10 14 10 14 4"></polyline><polyline points="14 10 21 3"></polyline><polyline points="3 21 10 14"></polyline></svg>`;
        const EXPAND_SVG = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 3 21 3 21 9"></polyline><polyline points="9 21 3 21 3 15"></polyline><polyline points="3 9 3 3 9 3"></polyline><polyline points="21 15 21 21 15 21"></polyline></svg>`;

        const updateIcon = () => {
            expandBtn.innerHTML = _promptExpanded ? COLLAPSE_SVG : EXPAND_SVG;
            expandBtn.title = _promptExpanded ? 'Collapse prompt area' : 'Expand prompt area';
        };

        const applyExpandedState = (nextExpanded) => {
            _promptExpanded = !!nextExpanded;
            controlsContainer.classList.toggle('prompt-expanded', _promptExpanded);
            setMainExpandedLayerActive(_promptExpanded);
            updateIcon();
        };
        expandBtn.onclick = () => {
            applyExpandedState(!_promptExpanded);
        };

        // If top-right collapse arrow is used while expanded, restore to pre-expanded size
        // (do not collapse the control panel itself).
        if (promptToggleBtn) {
            promptToggleBtn.addEventListener('click', (e) => {
                if (!_promptExpanded) return;
                e.preventDefault();
                e.stopImmediatePropagation();
                applyExpandedState(false);
                controlsContainer.classList.remove('collapsed');
                const inputArea = document.getElementById('input-area');
                if (inputArea) inputArea.classList.remove('collapsed');
                promptToggleBtn.setAttribute('aria-expanded', 'true');
                promptToggleBtn.title = 'Collapse controls';
            }, true);
        }

        // Also react to renderer state event (setPromptCollapsed)
        window.addEventListener('smc:prompt-collapsed-changed', (evt) => {
            const collapsed = !!(evt && evt.detail && evt.detail.collapsed);
            if (collapsed && _promptExpanded) applyExpandedState(false);
        });
        updateIcon();
    }

    // --- Inline Preview State ---
    let _inlinePreviewActive = false;
    let _inlinePreviewTheme = 'dark';
    let _inlinePreviewLive = true;
    let _inlinePreviewRafId = null;
    let _previewPrevHeight = null;

    function toggleInlinePreview(forceState) {
        const splitContainer = document.querySelector('.prompt-split-container');
        const previewPane = document.getElementById('prompt-inline-preview-pane');
        const previewContent = document.getElementById('prompt-inline-preview-content');
        const previewBtn = document.getElementById('master-preview-btn');
        const masterInput = document.getElementById('master-input');
        const controlsContainer = document.getElementById('controls-container');
        const mdToolbar = document.getElementById('inline-md-toolbar');
        if (!splitContainer || !previewPane || !previewContent || !masterInput) return;

        _inlinePreviewActive = typeof forceState === 'boolean' ? forceState : !_inlinePreviewActive;

        splitContainer.classList.toggle('split-active', _inlinePreviewActive);
        previewBtn?.classList.toggle('active', _inlinePreviewActive);
        controlsContainer?.classList.toggle('inline-preview-active', _inlinePreviewActive);

        if (_inlinePreviewActive) {
            _previewPrevHeight = controlsContainer ? controlsContainer.style.height || null : null;
            if (controlsContainer) {
                const targetHeight = Math.round(window.innerHeight * 0.33);
                const currentHeight = controlsContainer.offsetHeight;
                if (currentHeight < targetHeight) {
                    controlsContainer.style.height = `${targetHeight}px`;
                }
            }
            previewPane.style.display = 'flex';
            if (mdToolbar) mdToolbar.style.display = 'flex';
            renderInlinePreview();
            if (_inlinePreviewLive) startInlineLiveSync();
            setupInlineScrollSync();
        } else {
            previewPane.style.display = 'none';
            if (mdToolbar) mdToolbar.style.display = 'none';
            if (controlsContainer && _previewPrevHeight !== null) {
                controlsContainer.style.height = _previewPrevHeight;
            }
            _previewPrevHeight = null;
            stopInlineLiveSync();
            teardownInlineScrollSync();
        }
    }

    async function renderInlinePreview() {
        const masterInput = document.getElementById('master-input');
        const previewContent = document.getElementById('prompt-inline-preview-content');
        if (!masterInput || !previewContent) return;

        const raw = masterInput.value || '';
        const maps = await buildMainPreviewMapsAsync();
        const { html, mode } = buildVariableAwarePreviewHtml(raw, maps, { allowEditButtons: false, mainInputContext: true });
        previewContent.classList.toggle('cpb-preview-md', mode === 'markdown');
        previewContent.classList.toggle('cpb-preview-plain', mode !== 'markdown');
        previewContent.innerHTML = html;
        applyInlinePreviewTheme();
        previewContent.onclick = handlePreviewLinkClick;
    }

    function applyInlinePreviewTheme() {
        const previewContent = document.getElementById('prompt-inline-preview-content');
        const themeWrap = document.getElementById('inline-preview-theme');
        if (!previewContent) return;
        const dark = _inlinePreviewTheme === 'dark';
        previewContent.classList.toggle('inline-preview-dark', dark);
        previewContent.classList.toggle('inline-preview-light', !dark);
        if (themeWrap) {
            themeWrap.querySelectorAll('.inline-preview-theme-btn').forEach((btn) => {
                btn.classList.toggle('active', (btn.getAttribute('data-theme') === 'dark') === dark);
            });
        }
    }

    function startInlineLiveSync() {
        stopInlineLiveSync();
        const masterInput = document.getElementById('master-input');
        if (!masterInput) return;
        const handler = () => {
            if (_inlinePreviewActive && _inlinePreviewLive) {
                if (_inlinePreviewRafId) cancelAnimationFrame(_inlinePreviewRafId);
                _inlinePreviewRafId = requestAnimationFrame(() => renderInlinePreview());
            }
        };
        masterInput._inlinePreviewHandler = handler;
        masterInput.addEventListener('input', handler);
    }

    function stopInlineLiveSync() {
        const masterInput = document.getElementById('master-input');
        if (masterInput && masterInput._inlinePreviewHandler) {
            masterInput.removeEventListener('input', masterInput._inlinePreviewHandler);
            masterInput._inlinePreviewHandler = null;
        }
        if (_inlinePreviewRafId) {
            cancelAnimationFrame(_inlinePreviewRafId);
            _inlinePreviewRafId = null;
        }
    }

    // --- Inline Scroll Sync ---
    let _inlineScrollSyncLock = false;

    function setupInlineScrollSync() {
        teardownInlineScrollSync();
        const masterInput = document.getElementById('master-input');
        const previewContent = document.getElementById('prompt-inline-preview-content');
        if (!masterInput || !previewContent) return;

        const onEditorScroll = () => {
            if (_inlineScrollSyncLock) return;
            _inlineScrollSyncLock = true;
            const maxSrc = masterInput.scrollHeight - masterInput.clientHeight;
            const maxDst = previewContent.scrollHeight - previewContent.clientHeight;
            const ratio = maxSrc > 0 ? (masterInput.scrollTop / maxSrc) : 0;
            previewContent.scrollTop = ratio * Math.max(0, maxDst);
            _inlineScrollSyncLock = false;
        };
        const onPreviewScroll = () => {
            if (_inlineScrollSyncLock) return;
            _inlineScrollSyncLock = true;
            const maxSrc = previewContent.scrollHeight - previewContent.clientHeight;
            const maxDst = masterInput.scrollHeight - masterInput.clientHeight;
            const ratio = maxSrc > 0 ? (previewContent.scrollTop / maxSrc) : 0;
            masterInput.scrollTop = ratio * Math.max(0, maxDst);
            _inlineScrollSyncLock = false;
        };

        masterInput._inlineEditorScrollHandler = onEditorScroll;
        previewContent._inlinePreviewScrollHandler = onPreviewScroll;
        masterInput.addEventListener('scroll', onEditorScroll);
        previewContent.addEventListener('scroll', onPreviewScroll);
    }

    function teardownInlineScrollSync() {
        const masterInput = document.getElementById('master-input');
        const previewContent = document.getElementById('prompt-inline-preview-content');
        if (masterInput && masterInput._inlineEditorScrollHandler) {
            masterInput.removeEventListener('scroll', masterInput._inlineEditorScrollHandler);
            masterInput._inlineEditorScrollHandler = null;
        }
        if (previewContent && previewContent._inlinePreviewScrollHandler) {
            previewContent.removeEventListener('scroll', previewContent._inlinePreviewScrollHandler);
            previewContent._inlinePreviewScrollHandler = null;
        }
    }

    // --- Inline Markdown Toolbar ---
    let _mdUndoStack = [];
    let _mdRedoStack = [];

    function setupInlineMdToolbar() {
        const toolbar = document.getElementById('inline-md-toolbar');
        const masterInput = document.getElementById('master-input');
        if (!toolbar || !masterInput) return;

        toolbar.addEventListener('click', (e) => {
            const btn = e.target.closest('.md-tb-btn');
            if (!btn) return;
            const action = btn.dataset.md;
            if (!action) return;
            e.preventDefault();
            applyMdAction(masterInput, action);
        });

        masterInput.addEventListener('input', () => {
            if (_inlinePreviewActive) {
                _mdUndoStack.push(masterInput.value);
                if (_mdUndoStack.length > 100) _mdUndoStack.shift();
                _mdRedoStack = [];
            }
        });
    }

    function applyMdAction(ta, action) {
        const start = ta.selectionStart;
        const end = ta.selectionEnd;
        const text = ta.value;
        const selected = text.substring(start, end);
        let before = text.substring(0, start);
        let after = text.substring(end);
        let insert = '';
        let cursorOffset = 0;
        let selectFrom = -1;
        let selectTo = -1;

        switch (action) {
            case 'bold':
                insert = `**${selected || 'bold text'}**`;
                if (!selected) { cursorOffset = 2; selectFrom = start + 2; selectTo = start + 11; }
                break;
            case 'italic':
                insert = `*${selected || 'italic text'}*`;
                if (!selected) { selectFrom = start + 1; selectTo = start + 12; }
                break;
            case 'strikethrough':
                insert = `~~${selected || 'text'}~~`;
                if (!selected) { selectFrom = start + 2; selectTo = start + 6; }
                break;
            case 'heading': {
                const lineStart = before.lastIndexOf('\n') + 1;
                const linePrefix = before.substring(lineStart);
                const headingMatch = linePrefix.match(/^(#{1,5})\s/);
                if (headingMatch) {
                    const level = Math.min(headingMatch[1].length + 1, 6);
                    before = before.substring(0, lineStart) + '#'.repeat(level) + ' ' + linePrefix.replace(/^#{1,6}\s/, '');
                    insert = selected;
                } else {
                    const prefix = before.endsWith('\n') || before === '' ? '' : '\n';
                    insert = `${prefix}# ${selected || 'heading'}`;
                    if (!selected) { selectFrom = start + prefix.length + 2; selectTo = start + prefix.length + 9; }
                }
                break;
            }
            case 'quote': {
                const prefix = before.endsWith('\n') || before === '' ? '' : '\n';
                const lines = (selected || 'quote').split('\n').map(l => `> ${l}`).join('\n');
                insert = `${prefix}${lines}`;
                if (!selected) { selectFrom = start + prefix.length + 2; selectTo = start + prefix.length + 7; }
                break;
            }
            case 'ul': {
                const prefix = before.endsWith('\n') || before === '' ? '' : '\n';
                if (selected) {
                    insert = prefix + selected.split('\n').map(l => `- ${l}`).join('\n');
                } else {
                    insert = `${prefix}- item`;
                    selectFrom = start + prefix.length + 2; selectTo = start + prefix.length + 6;
                }
                break;
            }
            case 'ol': {
                const prefix = before.endsWith('\n') || before === '' ? '' : '\n';
                if (selected) {
                    insert = prefix + selected.split('\n').map((l, i) => `${i + 1}. ${l}`).join('\n');
                } else {
                    insert = `${prefix}1. item`;
                    selectFrom = start + prefix.length + 3; selectTo = start + prefix.length + 7;
                }
                break;
            }
            case 'link':
                if (selected) {
                    insert = `[${selected}](url)`;
                    selectFrom = start + selected.length + 3; selectTo = start + selected.length + 6;
                } else {
                    insert = '[link text](url)';
                    selectFrom = start + 1; selectTo = start + 10;
                }
                break;
            case 'code':
                if (selected && selected.includes('\n')) {
                    insert = `\n\`\`\`\n${selected}\n\`\`\`\n`;
                } else {
                    insert = `\`${selected || 'code'}\``;
                    if (!selected) { selectFrom = start + 1; selectTo = start + 5; }
                }
                break;
            case 'table': {
                const prefix = before.endsWith('\n') || before === '' ? '' : '\n';
                insert = `${prefix}| Column 1 | Column 2 | Column 3 |\n| --- | --- | --- |\n| cell | cell | cell |\n`;
                break;
            }
            case 'hr': {
                const prefix = before.endsWith('\n') || before === '' ? '' : '\n';
                insert = `${prefix}---\n`;
                break;
            }
            case 'undo':
                if (_mdUndoStack.length > 1) {
                    _mdRedoStack.push(_mdUndoStack.pop());
                    const prev = _mdUndoStack[_mdUndoStack.length - 1];
                    if (prev !== undefined) { ta.value = prev; ta.dispatchEvent(new Event('input', { bubbles: true })); }
                }
                ta.focus();
                return;
            case 'redo':
                if (_mdRedoStack.length > 0) {
                    const next = _mdRedoStack.pop();
                    _mdUndoStack.push(next);
                    ta.value = next; ta.dispatchEvent(new Event('input', { bubbles: true }));
                }
                ta.focus();
                return;
            default:
                return;
        }

        ta.value = before + insert + after;
        ta.dispatchEvent(new Event('input', { bubbles: true }));
        ta.focus();

        if (selectFrom >= 0 && selectTo >= 0) {
            ta.setSelectionRange(selectFrom, selectTo);
        } else {
            const newPos = before.length + insert.length;
            ta.setSelectionRange(newPos, newPos);
        }
    }

    function setupInlinePreviewControls() {
        const liveToggle = document.getElementById('inline-live-toggle');
        const themeWrap = document.getElementById('inline-preview-theme');

        if (liveToggle) {
            liveToggle.checked = _inlinePreviewLive;
            liveToggle.onchange = () => {
                _inlinePreviewLive = liveToggle.checked;
                if (_inlinePreviewActive) {
                    if (_inlinePreviewLive) {
                        renderInlinePreview();
                        startInlineLiveSync();
                    } else {
                        stopInlineLiveSync();
                    }
                }
            };
        }

        if (themeWrap) {
            themeWrap.querySelectorAll('.inline-preview-theme-btn').forEach((btn) => {
                btn.onclick = () => {
                    _inlinePreviewTheme = btn.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
                    applyInlinePreviewTheme();
                };
            });
        }
    }

    function setupMainInputFeatures() {
        const masterInput = document.getElementById('master-input');
        const masterAc = document.getElementById('master-ac');
        const masterSlash = document.getElementById('master-slash-menu');
        const previewBtn = document.getElementById('master-preview-btn');
        const expandBtn = document.getElementById('master-expand-btn');
        const sendBtn = document.getElementById('send-btn');
        const validationEl = document.getElementById('main-prompt-validation');
        if (!masterInput || masterInput._cpbHooked) return;
        masterInput._cpbHooked = true;

        const hasReservedMainPromptToken = (text) => /\{\{main_prompt\}\}/i.test(String(text || ''));
        const removeReservedMainPromptToken = (text) => String(text || '').replace(/\{\{main_prompt\}\}/gi, '').replace(/\n{3,}/g, '\n\n');
        const updateMainPromptValidationState = () => {
            const blocked = hasReservedMainPromptToken(masterInput.value || '');
            masterInput.dataset.reservedBlocked = blocked ? '1' : '0';
            if (sendBtn) {
                sendBtn.disabled = blocked;
                sendBtn.title = blocked ? RESERVED_MAIN_PROMPT_TITLE : 'Send prompt';
                sendBtn.setAttribute('aria-disabled', blocked ? 'true' : 'false');
            }
            if (validationEl) {
                if (blocked) {
                    validationEl.innerHTML = `
                        <span class="validation-inline-text">${safeHtml(RESERVED_MAIN_PROMPT_MSG)} ${safeHtml(RESERVED_MAIN_PROMPT_ACTION)}</span>
                        <button type="button" class="main-prompt-validation-fix">${safeHtml(RESERVED_MAIN_PROMPT_FIX_LABEL)}</button>
                    `;
                    const fixBtn = validationEl.querySelector('.main-prompt-validation-fix');
                    if (fixBtn) {
                        fixBtn.onclick = () => {
                            masterInput.value = removeReservedMainPromptToken(masterInput.value || '');
                            masterInput.dispatchEvent(new Event('input', { bubbles: true }));
                            masterInput.focus();
                        };
                    }
                    validationEl.style.display = 'flex';
                } else {
                    validationEl.style.display = 'none';
                    validationEl.innerHTML = '';
                }
            }
            return blocked;
        };

        // --- Preview button toggles inline preview ---
        if (previewBtn) {
            previewBtn.onclick = () => {
                toggleInlinePreview();
            };
        }

        if (expandBtn) {
            expandBtn.onclick = () => {
                openSessionPromptBuilderModal();
            };
        }

        // --- Setup inline preview controls + markdown toolbar ---
        setupInlinePreviewControls();
        setupInlineMdToolbar();

        // --- Prompt expand/collapse ---
        setupPromptExpandButton();

        // --- Autocomplete for {{ ---
        masterInput.addEventListener('input', () => {
            miMaybeOpenSlashCommand(masterInput, masterSlash);
            miMaybeOpenAutocomplete(masterInput, masterAc);
            updateMainPromptValidationState();
        });
        masterInput.addEventListener('keydown', (e) => {
            if (miSlashOpen) {
                if (e.key === 'ArrowDown') { e.preventDefault(); miSlashSelected = Math.min(miSlashSelected + 1, miSlashItems.length - 1); miRenderSlashMenu(masterSlash); return; }
                if (e.key === 'ArrowUp') { e.preventDefault(); miSlashSelected = Math.max(miSlashSelected - 1, 0); miRenderSlashMenu(masterSlash); return; }
                if (e.key === 'Enter' || e.key === 'Tab') {
                    const picked = miSlashItems[miSlashSelected];
                    if (picked) {
                        e.preventDefault();
                        miPickSlashCommand(masterInput, masterSlash, picked);
                    }
                    return;
                }
                if (e.key === 'Escape') { e.preventDefault(); miCloseSlashMenu(masterSlash); return; }
            }
            if (!miAcOpen) return;
            if (e.key === 'ArrowDown') { e.preventDefault(); miAcSelected = Math.min(miAcSelected + 1, miAcItems.length - 1); miRenderAc(masterAc); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); miAcSelected = Math.max(miAcSelected - 1, 0); miRenderAc(masterAc); }
            else if (e.key === 'Enter' || e.key === 'Tab') { if (miAcItems[miAcSelected]) { e.preventDefault(); miPickAc(masterInput, masterAc, miAcItems[miAcSelected].name); } }
            else if (e.key === 'Escape') { miCloseAc(masterAc); }
        });

        document.addEventListener('click', (e) => {
            if (masterAc && !masterAc.contains(e.target) && e.target !== masterInput) miCloseAc(masterAc);
            if (masterSlash && !masterSlash.contains(e.target) && e.target !== masterInput) miCloseSlashMenu(masterSlash);
        });

        // --- Intercept send to resolve variables via modal ---
        const origSendPrompt = window.sendPrompt;
        window.sendPrompt = async function () {
            const text = masterInput.value || '';
            if (hasReservedMainPromptToken(text)) {
                updateMainPromptValidationState();
                return;
            }
            const hasVars = /\{\{([a-zA-Z0-9_]+)\}\}/.test(text);

            if (hasVars) {
                miEnsureMainInputContext(text);
                const ctx = window._cpb_context;
                let sysVals = {};
                try { sysVals = await window.electronAPI.getSystemVarsForCPB({ anonymousMode: getAnonymousModeForCPB() }); }
                catch (e) { sysVals = { chat_thread: '', last_response: '', current_time: formatCurrentTimeISO() }; }

                const gloMap = (ctx.globalVars || []).reduce((acc, v) => { if (v.name) acc[v.name] = v.value ?? ''; return acc; }, {});
                const localMap = (ctx.localVars || []).reduce((acc, v) => { if (v.name) acc[v.name] = v.value ?? ''; return acc; }, {});
                const fullMap = { ...sysVals, ...gloMap, ...localMap };

                const unresolvedNames = miFindUnresolvedVariables(text, fullMap);
                if (unresolvedNames.length > 0) {
                    const allVarInfo = {};
                    unresolvedNames.forEach((name) => {
                        const localVar = (ctx.localVars || []).find((v) => v?.name === name);
                        const globalVar = (ctx.globalVars || []).find((v) => v?.name === name);
                        allVarInfo[name] = {
                            source: localVar ? 'Session' : (globalVar ? 'Global' : 'Session'),
                            value: localVar ? (localVar.value || '') : (globalVar ? (globalVar.value || '') : '')
                        };
                    });

                    const result = await showVariableInputModal(unresolvedNames, allVarInfo);
                    if (result.action === 'cancel') return;

                    if (result.action === 'send' || result.action === 'send-anyway') {
                        if (result.values) {
                            const ctxNow = window._cpb_context || { globalVars: [], localVars: [] };
                            Object.entries(result.values).forEach(([key, val]) => {
                                let target = (ctxNow.localVars || []).find((v) => v?.name === key);
                                if (!target) {
                                    target = { name: key, value: '' };
                                    ctxNow.localVars = ctxNow.localVars || [];
                                    ctxNow.localVars.push(target);
                                }
                                target.value = val;
                            });
                            window._cpb_context = ctxNow;
                        }

                        if (result.action === 'send') {
                            const updatedLocalMap = (window._cpb_context.localVars || []).reduce((acc, v) => { if (v.name) acc[v.name] = v.value ?? ''; return acc; }, {});
                            const updatedFullMap = { ...sysVals, ...gloMap, ...updatedLocalMap };
                            const stillUnresolved = miFindUnresolvedVariables(text, updatedFullMap);
                            if (stillUnresolved.length > 0) {
                                const stillInfo = {};
                                stillUnresolved.forEach((name) => {
                                    stillInfo[name] = { source: 'Session', value: '' };
                                });
                                const retry = await showVariableInputModal(stillUnresolved, stillInfo);
                                if (retry.action === 'cancel') return;
                                if (retry.values) {
                                    const ctxRetry = window._cpb_context || { globalVars: [], localVars: [] };
                                    Object.entries(retry.values).forEach(([key, val]) => {
                                        let t = (ctxRetry.localVars || []).find((v) => v?.name === key);
                                        if (!t) { t = { name: key, value: '' }; ctxRetry.localVars.push(t); }
                                        t.value = val;
                                    });
                                    window._cpb_context = ctxRetry;
                                }
                            }
                        }

                        const finalLocalMap = (window._cpb_context.localVars || []).reduce((acc, v) => { if (v.name) acc[v.name] = v.value ?? ''; return acc; }, {});
                        const finalFullMap = { ...sysVals, ...gloMap, ...finalLocalMap };
                        masterInput.value = await materializePromptWithSystemAttachments(text, finalFullMap, { source: 'cpb-main-send' });
                        masterInput.dispatchEvent(new Event('input', { bubbles: true }));
                    }
                } else {
                    masterInput.value = await materializePromptWithSystemAttachments(text, fullMap, { source: 'cpb-main-send' });
                    masterInput.dispatchEvent(new Event('input', { bubbles: true }));
                }
            }
            if (typeof origSendPrompt === 'function') {
                await origSendPrompt();
            }
            // Renderer send flow clears textarea directly without always emitting input.
            // Re-emit to keep inline preview and validation in sync after send.
            masterInput.dispatchEvent(new Event('input', { bubbles: true }));
        };
        updateMainPromptValidationState();
    }

    function miGetVarList() {
        const ctx = window._cpb_context;
        const result = [];
        SYSTEM_VARS
            .filter(v => !RESERVED_SYSTEM_VARS.includes(v.name))
            .forEach(v => result.push({ scope: 'system', name: v.name, desc: v.desc, icon: 'S' }));
        const globalVars = Array.isArray(ctx?.globalVars)
            ? ctx.globalVars
            : (() => {
                try { return JSON.parse(localStorage.getItem(LS_GLOBALV) || '[]'); } catch (e) { return []; }
            })();
        globalVars.forEach(v => { if (v.name) result.push({ scope: 'global', name: v.name, desc: (v.value || '').slice(0, 60), icon: 'G' }); });
        return result;
    }

    function miLoadPromptItems(query = '') {
        let prompts = [];
        try {
            const arr = JSON.parse(localStorage.getItem(LS_PROMPTS) || '[]');
            prompts = Array.isArray(arr) ? arr : [];
        } catch (e) { prompts = []; }
        const q = String(query || '').trim().toLowerCase();
        const sorted = [...prompts].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
        return sorted
            .filter((p) => {
                if (!q) return true;
                const title = String(p?.title || '').toLowerCase();
                const content = String(p?.content || '').toLowerCase();
                return title.includes(q) || content.includes(q);
            })
            .slice(0, 40)
            .map((p) => ({
                id: p.id,
                title: p.title || '(Untitled)',
                content: p.content || '',
                localVars: Array.isArray(p.localVars) ? p.localVars : [],
                updatedAt: p.updatedAt || 0
            }));
    }

    function miMaybeOpenSlashCommand(ta, slashEl) {
        if (!slashEl || miAcOpen) { miCloseSlashMenu(slashEl); return; }
        const text = ta.value || '';
        const pos = ta.selectionStart || 0;
        const before = text.slice(0, pos);
        const tokenStart = Math.max(before.lastIndexOf(' '), before.lastIndexOf('\n'), before.lastIndexOf('\t')) + 1;
        const token = before.slice(tokenStart);
        if (!token.startsWith('/')) { miCloseSlashMenu(slashEl); return; }
        if (token.includes('{{')) { miCloseSlashMenu(slashEl); return; }
        const query = token.slice(1);
        miSlashItems = miLoadPromptItems(query);
        if (!miSlashItems.length) { miCloseSlashMenu(slashEl); return; }
        miSlashAnchor = tokenStart;
        miSlashSelected = 0;

        const coords = getCaretCoords(ta, pos);
        const rect = ta.getBoundingClientRect();
        let left = rect.left + coords.left - ta.scrollLeft;
        let top = rect.top + coords.top - ta.scrollTop - 8;
        const menuHeight = Math.min(miSlashItems.length * 36 + 38, 300);
        top = Math.max(8, top - menuHeight);
        if (left + 340 > window.innerWidth - 16) left = window.innerWidth - 356;
        if (left < 8) left = 8;
        slashEl.style.left = `${left}px`;
        slashEl.style.top = `${top}px`;
        slashEl.classList.add('show');
        if (!miSlashOpen) setMainPopupLayerActive(true);
        miSlashOpen = true;
        miRenderSlashMenu(slashEl);
    }

    function miRenderSlashMenu(slashEl) {
        if (!slashEl) return;
        slashEl.innerHTML = `
            <div class="msm-header">Slash Commands · Custom Prompts</div>
            <div class="msm-list"></div>
        `;
        const listEl = slashEl.querySelector('.msm-list');
        if (!listEl) return;
        miSlashItems.forEach((item, index) => {
            const row = document.createElement('div');
            row.className = 'msm-row' + (index === miSlashSelected ? ' selected' : '');
            row.setAttribute('data-msm-index', String(index));
            row.innerHTML = `
                <span class="msm-icon">P</span>
                <span>
                    <div class="msm-title">${safeHtml(item.title)}</div>
                    <div class="msm-desc">${safeHtml(previewOf(item.content || ''))}</div>
                </span>
            `;
            row.onmouseenter = () => {
                miSlashSelected = index;
                miHighlightSlashSelection(slashEl);
            };
            row.onmousedown = (e) => {
                // Prevent focus loss from textarea while choosing with mouse.
                e.preventDefault();
            };
            row.onclick = (e) => {
                e.preventDefault();
                const ta = document.getElementById('master-input');
                if (ta) miPickSlashCommand(ta, slashEl, item);
            };
            row.ondblclick = (e) => {
                e.preventDefault();
                const ta = document.getElementById('master-input');
                if (ta) miPickSlashCommand(ta, slashEl, item);
            };
            listEl.appendChild(row);
        });
        miHighlightSlashSelection(slashEl);
    }

    function miHighlightSlashSelection(slashEl) {
        if (!slashEl) return;
        const rows = [...slashEl.querySelectorAll('.msm-list .msm-row')];
        rows.forEach((row, idx) => row.classList.toggle('selected', idx === miSlashSelected));
        const selected = rows[miSlashSelected];
        if (selected) selected.scrollIntoView({ block: 'nearest' });
    }

    function miPickSlashCommand(ta, slashEl, item) {
        const existingText = ta.value || '';
        const pos = ta.selectionStart || 0;
        const insertedText = item.content || '';
        const promptLocalVars = Array.isArray(item.localVars) ? JSON.parse(JSON.stringify(item.localVars)) : [];

        // Check if there is meaningful text (beyond just the slash token)
        const textWithoutSlash = existingText.slice(0, miSlashAnchor) + existingText.slice(pos);
        const hasExistingContent = textWithoutSlash.trim().length > 0;

        // Capture anchor/pos before closing slash menu (which resets them)
        const capturedAnchor = miSlashAnchor;

        const doInsert = (mode) => {
            const globalVars = (() => {
                try { return JSON.parse(localStorage.getItem(LS_GLOBALV) || '[]'); } catch (e) { return []; }
            })();
            const existingCtx = window._cpb_context || {};
            const existingLocals = Array.isArray(existingCtx.localVars) ? existingCtx.localVars : [];

            if (mode === 'replace') {
                ta.value = insertedText;
                const newPos = insertedText.length;
                ta.setSelectionRange(newPos, newPos);
                window._cpb_context = {
                    promptId: item.id || null,
                    globalVars: JSON.parse(JSON.stringify(Array.isArray(globalVars) ? globalVars : [])),
                    localVars: promptLocalVars,
                    systemVarNames: SYSTEM_VARS.map(v => v.name)
                };
            } else {
                // insert at cursor — use captured anchor
                const before = existingText.slice(0, capturedAnchor);
                const after = existingText.slice(pos);
                ta.value = before + insertedText + after;
                const newPos = before.length + insertedText.length;
                ta.setSelectionRange(newPos, newPos);
                // Merge local vars: keep existing, add new ones from prompt
                const mergedLocals = [...existingLocals];
                const knownNames = new Set(mergedLocals.map(v => (v?.name || '').toLowerCase()));
                promptLocalVars.forEach(v => {
                    if (v?.name && !knownNames.has(v.name.toLowerCase())) {
                        mergedLocals.push(v);
                        knownNames.add(v.name.toLowerCase());
                    }
                });
                window._cpb_context = {
                    promptId: existingCtx.promptId || item.id || null,
                    globalVars: JSON.parse(JSON.stringify(Array.isArray(globalVars) ? globalVars : [])),
                    localVars: mergedLocals,
                    systemVarNames: SYSTEM_VARS.map(v => v.name)
                };
            }
            ta.focus();
            ta.dispatchEvent(new Event('input', { bubbles: true }));
        };

        // Always close slash menu FIRST to deactivate popup layer
        // (popup layer raises #controls-container to z-index 12010, which can cover modals)
        miCloseSlashMenu(slashEl);

        if (!hasExistingContent) {
            // No existing content — just replace directly
            doInsert('replace');
            return;
        }

        // Show modal asking user: Insert / Replace / Cancel
        showSlashInsertModal({
            onInsert: () => doInsert('insert'),
            onReplace: () => doInsert('replace'),
            onCancel: () => { ta.focus(); }
        });
    }

    function showSlashInsertModal(callbacks) {
        const existing = document.querySelector('.slash-insert-modal:not(.session-slash-insert-modal)');
        if (existing) existing.remove();
        const modal = document.createElement('div');
        modal.className = 'slash-insert-modal';

        // Activate modal layer to keep webviews hidden and ensure blur backdrop
        setMainModalLayerActive(true);

        modal.innerHTML = `
            <div class="slash-insert-dialog">
                <div class="slash-insert-title">Prompt Already Exists</div>
                <p class="slash-insert-desc">The main input already contains content.<br>How would you like to apply the selected prompt?</p>
                <div class="slash-insert-actions">
                    <button class="slash-insert-btn" data-action="insert">Insert at Cursor</button>
                    <button class="slash-insert-btn primary" data-action="replace">Replace All</button>
                    <button class="slash-insert-btn cancel" data-action="cancel">Cancel</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        const cleanup = (cb) => {
            modal.remove();
            setMainModalLayerActive(false);
            cb();
        };
        modal.querySelector('[data-action="insert"]').onclick = () => cleanup(callbacks.onInsert);
        modal.querySelector('[data-action="replace"]').onclick = () => cleanup(callbacks.onReplace);
        modal.querySelector('[data-action="cancel"]').onclick = () => cleanup(callbacks.onCancel);
        modal.addEventListener('click', (e) => { if (e.target === modal) cleanup(callbacks.onCancel); });
    }

    function miCloseSlashMenu(slashEl) {
        if (miSlashOpen) setMainPopupLayerActive(false);
        miSlashOpen = false;
        miSlashAnchor = -1;
        miSlashItems = [];
        if (slashEl) slashEl.classList.remove('show');
    }

    function miExtractVariableNames(text) {
        const out = [];
        const seen = new Set();
        let m;
        VAR_TOKEN_RE.lastIndex = 0;
        while ((m = VAR_TOKEN_RE.exec(String(text || ''))) !== null) {
            const name = sanitizeVarName(m[1] || '');
            if (!name) continue;
            const lower = name.toLowerCase();
            if (seen.has(lower)) continue;
            seen.add(lower);
            out.push(name);
        }
        return out;
    }

    function miEnsureMainInputContext(text) {
        const existing = window._cpb_context || {};
        let globals = Array.isArray(existing.globalVars) ? existing.globalVars : [];
        if (!globals.length) {
            try { globals = JSON.parse(localStorage.getItem(LS_GLOBALV) || '[]'); } catch (e) { globals = []; }
        }
        const locals = Array.isArray(existing.localVars) ? existing.localVars : [];
        const detected = miExtractVariableNames(text);
        // Build sets of known names so we don't re-add existing ones
        const systemNames = new Set(SYSTEM_VARS.map((v) => v.name.toLowerCase()));
        const globalNames = new Set(globals.map((v) => String(v?.name || '').toLowerCase()));
        const localNames = new Set(locals.map((v) => String(v?.name || '').toLowerCase()));
        detected.forEach((name) => {
            const lower = name.toLowerCase();
            // Skip system and global variables — they should NOT become session vars
            if (systemNames.has(lower)) return;
            if (globalNames.has(lower)) return;
            if (localNames.has(lower)) return;
            localNames.add(lower);
            locals.push({ name, value: '' });
        });
        window._cpb_context = {
            promptId: existing.promptId || null,
            globalVars: globals,
            localVars: locals,
            systemVarNames: SYSTEM_VARS.map((v) => v.name)
        };
    }

    function miRefreshVariableMiniForm(masterInput, miniFormEl) {
        if (!masterInput || !miniFormEl) return;
        const text = masterInput.value || '';
        const ctx0 = window._cpb_context || {};
        const gVars = Array.isArray(ctx0.globalVars) ? ctx0.globalVars : [];
        const gNameSet = new Set(gVars.map(v => (v?.name || '').toLowerCase()));
        // Exclude system AND global vars — only show session-scoped vars
        const detected = miExtractVariableNames(text).filter((name) => {
            if (SYSTEM_VARS.some((v) => v.name === name)) return false;
            if (gNameSet.has(name.toLowerCase())) return false;
            return true;
        });
        if (!detected.length) {
            miniFormEl.style.display = 'none';
            miniFormEl.innerHTML = '';
            return;
        }

        miEnsureMainInputContext(text);
        const ctx = window._cpb_context || {};
        const globalVars = Array.isArray(ctx.globalVars) ? ctx.globalVars : [];
        const localVars = Array.isArray(ctx.localVars) ? ctx.localVars : [];

        miniFormEl.style.display = 'block';
        miniFormEl.innerHTML = `
            <div class="mvmf-header">
                <span class="mvmf-title">Variable Mini Form</span>
                <span class="mvmf-count">${detected.length} detected</span>
            </div>
        `;

        detected.forEach((name) => {
            const localVar = localVars.find((v) => v?.name === name);
            const globalVar = globalVars.find((v) => v?.name === name);
            const source = localVar ? 'Session' : (globalVar ? 'Global' : 'Session');
            const currentValue = localVar ? (localVar.value || '') : (globalVar ? (globalVar.value || '') : '');
            const unresolved = !String(currentValue).trim();

            const row = document.createElement('div');
            row.className = `mvmf-row${unresolved ? ' unresolved' : ''}`;
            row.innerHTML = `
                <label class="mvmf-label">{{${escapeAttr(name)}}}<span class="mvmf-scope">${escapeAttr(source)}</span></label>
                <textarea class="mvmf-input" data-mi-var-name="${escapeAttr(name)}" placeholder="Enter value for ${escapeAttr(name)}">${safeHtml(currentValue)}</textarea>
            `;
            miniFormEl.appendChild(row);
        });

        miniFormEl.querySelectorAll('.mvmf-input').forEach((inputEl) => {
            inputEl.addEventListener('input', () => {
                const key = inputEl.getAttribute('data-mi-var-name');
                if (!key) return;
                const nextValue = inputEl.value;
                const ctxNow = window._cpb_context || { globalVars: [], localVars: [] };
                let target = (ctxNow.localVars || []).find((v) => v?.name === key);
                if (!target) {
                    target = { name: key, value: '' };
                    ctxNow.localVars = ctxNow.localVars || [];
                    ctxNow.localVars.push(target);
                }
                target.value = nextValue;
                window._cpb_context = ctxNow;
                inputEl.closest('.mvmf-row')?.classList.toggle('unresolved', !String(nextValue).trim());
            });
        });
    }

    function miFocusFirstMiniFormField(varName) {
        const miniForm = document.getElementById('master-var-mini-form');
        if (!miniForm) return;
        const selector = varName
            ? `.mvmf-input[data-mi-var-name="${varName.replace(/"/g, '\\"')}"]`
            : '.mvmf-input';
        const input = miniForm.querySelector(selector) || miniForm.querySelector('.mvmf-input');
        if (!input) return;
        miniForm.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        input.focus();
        const len = input.value.length;
        input.setSelectionRange(len, len);
    }

    function miFindUnresolvedVariables(text, map) {
        const names = miExtractVariableNames(text);
        return names.filter((name) => {
            if (SYSTEM_VARS.some((v) => v.name === name)) return false;
            if (!Object.prototype.hasOwnProperty.call(map, name)) return true;
            return !String(map[name] ?? '').trim();
        });
    }

    function miMaybeOpenAutocomplete(ta, acEl) {
        const slashEl = document.getElementById('master-slash-menu');
        const t = ta.value, pos = ta.selectionStart;
        const before = t.slice(0, pos);
        const i = before.lastIndexOf('{{');
        if (i === -1) { miCloseAc(acEl); return; }
        const after = before.slice(i + 2);
        if (after.includes('}}') || /[\s\n\r]/.test(after)) { miCloseAc(acEl); return; }
        miAcAnchor = i;
        const filter = after.toLowerCase();
        miAcItems = miGetVarList().filter(v => v.name.toLowerCase().includes(filter)).slice(0, 40);
        if (miAcItems.length === 0) { miCloseAc(acEl); return; }
        miAcSelected = 0;

        // Position — always above caret since main input is at bottom of screen
        const coords = getCaretCoords(ta, pos);
        const rect = ta.getBoundingClientRect();
        const acHeight = Math.min(miAcItems.length * 30 + 40, 260);
        let left = rect.left + coords.left - ta.scrollLeft;
        let top = rect.top + coords.top - ta.scrollTop - acHeight - 6;
        const vw = window.innerWidth;
        if (left + 280 > vw - 16) left = vw - 296;
        if (left < 8) left = 8;
        if (top < 8) top = 8;
        acEl.style.top = top + 'px';
        acEl.style.left = left + 'px';
        acEl.classList.add('show');

        miCloseSlashMenu(slashEl);
        if (!miAcOpen) setMainPopupLayerActive(true);
        miAcOpen = true;
        miRenderAc(acEl);
    }

    function miRenderAc(acEl) {
        acEl.innerHTML = '';
        const groups = [
            { key: 'system', title: 'System', badge: 'mac-badge-sys' },
            { key: 'global', title: 'Global', badge: 'mac-badge-glo' },
            { key: 'local', title: 'Local', badge: 'mac-badge-loc' }
        ];
        let idx = 0;
        for (const g of groups) {
            const rows = miAcItems.filter(x => x.scope === g.key);
            if (rows.length === 0) continue;
            const sec = document.createElement('div');
            sec.className = 'mac-section'; sec.textContent = g.title;
            acEl.appendChild(sec);
            rows.forEach(r => {
                const ri = idx;
                const row = document.createElement('div');
                row.className = 'mac-row' + (ri === miAcSelected ? ' selected' : '');
                row.innerHTML = `<span class="mac-badge ${g.badge}">${safeHtml(r.icon)}</span><span class="mac-name">{{${safeHtml(r.name)}}}</span><span class="mac-desc">${safeHtml(r.desc)}</span>`;
                row.onmouseenter = () => { miAcSelected = ri; miHighlightAc(acEl); };
                row.onclick = () => {
                    const ta = document.getElementById('master-input');
                    if (ta) miPickAc(ta, acEl, r.name);
                };
                acEl.appendChild(row);
                idx++;
            });
        }
        miHighlightAc(acEl);
    }

    function miHighlightAc(acEl) {
        const rows = [...acEl.querySelectorAll('.mac-row')];
        rows.forEach((r, i) => r.classList.toggle('selected', i === miAcSelected));
        const sel = rows[miAcSelected]; if (sel) sel.scrollIntoView({ block: 'nearest' });
    }

    function miPickAc(ta, acEl, name) {
        const t = ta.value, pos = ta.selectionStart;
        const before = t.slice(0, miAcAnchor), after = t.slice(pos);
        const insert = `{{${name}}}`;
        ta.value = before + insert + after;
        const newPos = before.length + insert.length;
        ta.setSelectionRange(newPos, newPos); ta.focus();
        miCloseAc(acEl);
    }

    function miCloseAc(acEl) {
        if (miAcOpen) setMainPopupLayerActive(false);
        miAcOpen = false; miAcAnchor = -1; miAcItems = [];
        if (acEl) acEl.classList.remove('show');
    }

    function buildMainPreviewMaps() {
        const ctx = window._cpb_context;
        const gloMap = {};
        const localMap = {};
        if (ctx) {
            (ctx.globalVars || []).forEach(v => { if (v.name) gloMap[v.name] = v.value ?? ''; });
            (ctx.localVars || []).forEach(v => { if (v.name) localMap[v.name] = v.value ?? ''; });
        } else {
            try {
                const gv = JSON.parse(localStorage.getItem(LS_GLOBALV) || '[]');
                gv.forEach(v => { if (v.name) gloMap[v.name] = v.value ?? ''; });
            } catch (e) { }
        }
        const sysMap = {};
        SYSTEM_VARS.forEach(v => {
            if (v.name === 'current_time') sysMap[v.name] = formatCurrentTimeISO();
            else if (v.name === 'last_response') sysMap[v.name] = '(last AI response)';
            else if (v.name === 'chat_thread') sysMap[v.name] = '(full chat thread)';
            else if (RESERVED_SYSTEM_VARS.includes(v.name)) { /* exclude from main input context */ }
            else sysMap[v.name] = `(${v.name})`;
        });
        return { sysMap, gloMap, localMap };
    }

    async function buildMainPreviewMapsAsync() {
        const ctx = window._cpb_context;
        const gloMap = {};
        const localMap = {};
        if (ctx) {
            (ctx.globalVars || []).forEach(v => { if (v.name) gloMap[v.name] = v.value ?? ''; });
            (ctx.localVars || []).forEach(v => { if (v.name) localMap[v.name] = v.value ?? ''; });
        } else {
            try {
                const gv = JSON.parse(localStorage.getItem(LS_GLOBALV) || '[]');
                gv.forEach(v => { if (v.name) gloMap[v.name] = v.value ?? ''; });
            } catch (e) { }
        }
        let sysMap = {};
        try {
            const sys = await getPreviewSystemVars();
            sysMap = { ...sys };
            delete sysMap.main_prompt;
        } catch (e) {
            sysMap = buildMainPreviewMaps().sysMap;
        }
        return { sysMap, gloMap, localMap };
    }

    function buildVariableAwarePreviewHtml(raw, maps, options = {}) {
        const { allowEditButtons = false, mainInputContext = false } = options;
        const { sysMap = {}, gloMap = {}, localMap = {} } = maps || {};
        const placeholders = {};
        let idx = 0;
        const withPlaceholders = String(raw || '').replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (m, key) => {
            const isReserved = mainInputContext && RESERVED_SYSTEM_VARS.includes(key);
            const isSys = Object.prototype.hasOwnProperty.call(sysMap, key);
            const isGlo = Object.prototype.hasOwnProperty.call(gloMap, key);
            const isLocal = Object.prototype.hasOwnProperty.call(localMap, key);
            let resolvedValue = '';
            if (isReserved) {
                resolvedValue = '';
            } else if (isSys) resolvedValue = sysMap[key];
            else if (isGlo && gloMap[key]) resolvedValue = gloMap[key];
            else if (isLocal && localMap[key]) resolvedValue = localMap[key];

            const ph = `%%MI_VAR_${idx++}%%`;
            if (isReserved) {
                placeholders[ph] = `<span class="mi-var mi-var-reserved" title="Reserved system variable. {{${safeHtml(key)}} is not usable in the main prompt editor.">${safeHtml(m)} <em>(reserved)</em></span>`;
            } else if (resolvedValue) {
                const scope = isSys ? 'system' : (isGlo ? 'global' : 'session');
                placeholders[ph] = `<span class="mi-var mi-var-resolved" title="${scope}: ${safeHtml(key)} = ${safeHtml(String(resolvedValue).slice(0, 100))}">${safeHtml(String(resolvedValue))}</span>`;
            } else {
                const scope = isGlo ? 'global' : (isLocal ? 'local' : 'unknown');
                const editBtn = allowEditButtons
                    ? `<button class="mi-edit-btn" data-var-name="${safeHtml(key)}" data-var-scope="${scope}" title="Edit value"><svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg></button>`
                    : '';
                placeholders[ph] = `<span class="mi-var mi-var-unresolved" title="${scope}: ${safeHtml(key)} (no value)">${safeHtml(m)}${editBtn}</span>`;
            }
            return ph;
        });

        const mode = decidePreviewMode(raw);
        let html = '';
        if (mode === 'markdown') {
            try {
                html = marked.parse(withPlaceholders, { breaks: true, gfm: true });
            } catch (e) {
                html = safeHtml(withPlaceholders).replace(/\n/g, '<br>');
            }
        } else {
            html = safeHtml(withPlaceholders).replace(/\n/g, '<br>');
        }
        for (const [ph, replacement] of Object.entries(placeholders)) {
            html = html.replaceAll(safeHtml(ph), replacement);
            html = html.replaceAll(ph, replacement);
        }
        return { html, mode };
    }

    async function renderMasterPreview() {
        const masterInput = document.getElementById('master-input');
        const masterPreview = document.getElementById('master-preview');
        const previewThemeWrap = document.getElementById('master-preview-theme');
        if (!masterInput || !masterPreview) return;
        const raw = masterInput.value || '';
        const maps = await buildMainPreviewMapsAsync();
        const { html, mode } = buildVariableAwarePreviewHtml(raw, maps, { allowEditButtons: true, mainInputContext: true });
        masterPreview.classList.toggle('cpb-preview-md', mode === 'markdown');
        masterPreview.classList.toggle('cpb-preview-plain', mode !== 'markdown');
        masterPreview.innerHTML = html;
        applyMainPreviewTheme(masterPreview, previewThemeWrap);

        masterPreview.querySelectorAll('.mi-edit-btn').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                const varName = btn.dataset.varName;
                const varScope = btn.dataset.varScope;
                showVarEditPopup(varName, varScope);
            };
        });
    }

    function openSessionPromptBuilderModal() {
        const masterInput = document.getElementById('master-input');
        if (!masterInput) return;
        miEnsureMainInputContext(masterInput.value || '');
        if (!sessionPromptModal) {
            sessionPromptModal = document.createElement('div');
            sessionPromptModal.className = 'session-prompt-modal';
            sessionPromptModal.innerHTML = `
                <div class="session-prompt-dialog">
                    <div class="session-prompt-header">
                        <strong>Session Custom Prompt Builder</strong>
                        <button class="session-prompt-close" title="Close">&times;</button>
                    </div>
                    <div class="session-prompt-topbar">
                        <input class="session-prompt-title" placeholder="Session prompt title" />
                    </div>
                    <div class="session-prompt-body">
                        <div class="session-prompt-center">
                            <div class="cpb-editor-shell session-cpb-shell">
                                <div class="cpb-editor-head session-cpb-head">
                                    <div class="cpb-tabs2">
                                        <button class="cpb-pill cpb-pill-active session-prompt-tab" data-mode="edit">Edit</button>
                                        <button class="cpb-pill session-prompt-tab" data-mode="preview">Preview</button>
                                        <label class="cpb-zen-toggle cpb-live-toggle session-live-toggle" title="Live Preview">
                                            <input type="checkbox" class="session-live-preview-check" />
                                            <span class="cpb-zen-slider"></span>
                                            <span class="cpb-zen-label">Live Preview</span>
                                        </label>
                                    </div>
                                    <div class="cpb-toolbar">
                                        <button class="cpb-btn cpb-btn-secondary cpb-btn-sm session-btn-insert-var">
                                            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                                            Insert Var
                                        </button>
                                        <button class="cpb-btn cpb-btn-secondary cpb-btn-sm session-btn-format">
                                            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7V4h16v3"/><path d="M9 20h6"/><path d="M12 4v16"/></svg>
                                            Format
                                        </button>
                                        <button class="cpb-pill cpb-pill-active session-hl-on">Highlight Vars</button>
                                        <button class="cpb-pill session-hl-missing">Unresolved Only</button>
                                    </div>
                                </div>
                                <div class="cpb-editor session-cpb-editor">
                                    <div class="session-cpb-editor-wrap">
                                        <textarea class="session-prompt-editor" spellcheck="false" placeholder="Build a session prompt for this chat.

· Type &quot;/&quot; slash command to load and insert a saved custom prompt template.
· Type &quot;{{&quot; to insert global/system variable. 
  - System: {{chat_thread}}, {{last_response}}, {{current_time}} (ISO 8601)
  - Global/Session examples: {{output_format}}, {{role}}, {{lang}}, {{timezone}}
  - Reserved: {{main_prompt}} cannot be used in this editor."></textarea>
                                    </div>
                                    <div class="cpb-preview session-prompt-preview"></div>
                                    <div class="cpb-ac session-ac"></div>
                                    <div class="master-slash-menu session-slash-menu"></div>
                                </div>
                            </div>
                        </div>
                        <div class="session-prompt-side">
                            <div class="cpb-vars-top">
                                <div class="cpb-vars-title">
                                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                                    Variables
                                </div>
                            </div>
                            <div class="session-vars-body">
                                <div class="session-var-tabs">
                                    <button class="session-var-tab" data-spb-tab="global">Global</button>
                                    <button class="session-var-tab active" data-spb-tab="session">Session</button>
                                    <button class="session-var-tab" data-spb-tab="system">System</button>
                                </div>

                                <div class="session-var-panel" data-spb-panel="global" style="display:none;">
                                    <div class="session-var-hint">Global variables are shared across <b>all prompts</b>.<br/>e.g. {{output_format}}, {{role}}</div>
                                    <div class="session-readonly-list session-global-list"></div>
                                    <div class="cpb-sep"></div>
                                    <div class="cpb-muted cpb-text-sm cpb-text-bold">Quick Insert</div>
                                    <div class="cpb-var-chips session-global-chips"></div>
                                </div>

                                <div class="session-var-panel" data-spb-panel="session">
                                    <div class="session-var-hint">Session variables are editable.<br/>Saved as <b>Local variables</b> on "Save to New Custom Prompt".</div>
                                    <div class="session-vars-list"></div>
                                </div>

                                <div class="session-var-panel" data-spb-panel="system" style="display:none;">
                                    <div class="session-var-hint">System variables are automatically injected at runtime.</div>
                                    <div class="session-system-list"></div>
                                    <div class="cpb-sep"></div>
                                    <div class="cpb-muted cpb-text-sm cpb-text-bold">Quick Insert</div>
                                    <div class="cpb-var-chips session-system-chips"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="session-prompt-footer">
                        <div class="session-prompt-validation" style="display:none;" aria-live="polite"></div>
                        <button class="session-prompt-btn" data-action="save">Save to New Custom Prompt</button>
                        <button class="session-prompt-btn primary" data-action="send">Send</button>
                    </div>
                </div>
            `;
            document.body.appendChild(sessionPromptModal);
            sessionPromptModal.addEventListener('click', (e) => {
                if (e.target === sessionPromptModal) closeSessionPromptBuilderModal();
            });
            sessionPromptModal.querySelector('.session-prompt-close')?.addEventListener('click', closeSessionPromptBuilderModal);
            const editorTextarea = sessionPromptModal.querySelector('.session-prompt-editor');
            if (editorTextarea && !sessionPromptEditorMde && typeof EasyMDE !== 'undefined') {
                sessionPromptEditorMde = new EasyMDE({
                    element: editorTextarea,
                    forceSync: true,
                    spellChecker: false,
                    lineNumbers: true,
                    status: false,
                    autoDownloadFontAwesome: true,
                    promptURLs: true,
                    toolbar: [
                        'bold',
                        'italic',
                        'strikethrough',
                        '|',
                        'heading',
                        'quote',
                        '|',
                        'unordered-list',
                        'ordered-list',
                        '|',
                        'link',
                        'code',
                        'table',
                        'horizontal-rule',
                        '|',
                        'undo',
                        'redo'
                    ]
                });
            }
        }

        const titleInput = sessionPromptModal.querySelector('.session-prompt-title');
        const editor = sessionPromptModal.querySelector('.session-prompt-editor');
        const preview = sessionPromptModal.querySelector('.session-prompt-preview');
        if (!titleInput || !editor || !preview) return;

        const now = new Date();
        titleInput.value = `Session Prompt ${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`;
        setSessionPromptEditorValue(masterInput.value || '');
        bindSessionPromptModalHandlers(sessionPromptModal, masterInput);
        sessionSetLivePreviewMode(sessionPromptModal, false);
        sessionSetPreviewMode(sessionPromptModal, false);
        sessionSetVarTab(sessionPromptModal, 'session');
        refreshSessionPromptVars(sessionPromptModal, editor, preview);
        updateSessionPromptPreview(sessionPromptModal, editor, preview);

        setMainModalLayerActive(true);
        sessionPromptModal.classList.add('visible');
        focusSessionPromptEditor();
    }

    function closeSessionPromptBuilderModal() {
        if (!sessionPromptModal) return;
        // Final sync to main input on close
        const masterInput = document.getElementById('master-input');
        if (masterInput) {
            masterInput.value = getSessionPromptEditorValue();
            masterInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
        sessionCloseAutocomplete();
        sessionCloseSlashMenu(sessionPromptModal);
        // Remove any lingering session slash insert modal to prevent residual blur
        const lingeringInsertModal = document.querySelector('.session-slash-insert-modal');
        if (lingeringInsertModal) lingeringInsertModal.remove();
        sessionPromptModal.classList.remove('visible');
        setMainModalLayerActive(false);
    }

    function bindSessionPromptModalHandlers(modal, masterInput) {
        if (modal.dataset.bound === '1') return;
        modal.dataset.bound = '1';
        const tabs = [...modal.querySelectorAll('.session-prompt-tab')];
        const preview = modal.querySelector('.session-prompt-preview');
        const editor = modal.querySelector('.session-prompt-editor');
        const sessionSendBtn = modal.querySelector('[data-action="send"]');
        const sessionValidationEl = modal.querySelector('.session-prompt-validation');
        if (!preview || !editor) return;

        const sessionHasReservedMainPrompt = () => /\{\{main_prompt\}\}/i.test(getSessionPromptEditorValue() || '');
        const sessionRemoveReservedMainPrompt = (text) => String(text || '').replace(/\{\{main_prompt\}\}/gi, '').replace(/\n{3,}/g, '\n\n');
        const updateSessionSendState = () => {
            const blocked = sessionHasReservedMainPrompt();
            if (sessionSendBtn) {
                sessionSendBtn.disabled = blocked;
                sessionSendBtn.title = blocked ? RESERVED_MAIN_PROMPT_TITLE : 'Send';
                sessionSendBtn.setAttribute('aria-disabled', blocked ? 'true' : 'false');
            }
            if (sessionValidationEl) {
                if (blocked) {
                    sessionValidationEl.innerHTML = `
                        <span class="validation-inline-text">${safeHtml(RESERVED_MAIN_PROMPT_MSG)} ${safeHtml(RESERVED_MAIN_PROMPT_ACTION)}</span>
                        <button type="button" class="session-validation-fix">${safeHtml(RESERVED_MAIN_PROMPT_FIX_LABEL)}</button>
                    `;
                    const fixBtn = sessionValidationEl.querySelector('.session-validation-fix');
                    if (fixBtn) {
                        fixBtn.onclick = () => {
                            setSessionPromptEditorValue(sessionRemoveReservedMainPrompt(getSessionPromptEditorValue() || ''));
                            sessionHandleEditorInput(modal);
                            focusSessionPromptEditor();
                        };
                    }
                    sessionValidationEl.style.display = 'flex';
                } else {
                    sessionValidationEl.style.display = 'none';
                    sessionValidationEl.innerHTML = '';
                }
            }
            return blocked;
        };

        tabs.forEach((tab) => {
            tab.addEventListener('click', () => {
                sessionSetPreviewMode(modal, tab.dataset.mode === 'preview');
            });
        });

        modal.querySelector('.session-live-preview-check')?.addEventListener('change', (e) => {
            sessionSetLivePreviewMode(modal, !!e.target.checked);
        });

        modal.querySelectorAll('.session-var-tab').forEach((tabBtn) => {
            tabBtn.addEventListener('click', () => {
                sessionSetVarTab(modal, tabBtn.getAttribute('data-spb-tab') || 'session');
            });
        });

        modal.querySelector('.session-btn-insert-var')?.addEventListener('click', () => {
            focusSessionPromptEditor();
            requestAnimationFrame(() => sessionOpenPaletteAtCaret());
        });

        modal.querySelector('.session-btn-format')?.addEventListener('click', async () => {
            const source = getSessionPromptEditorValue();
            if (!String(source || '').trim()) return;
            try {
                const next = await prettier.format(source, { parser: 'markdown', plugins: prettierPlugins });
                setSessionPromptEditorValue(next);
                sessionHandleEditorInput(modal);
            } catch (e) { }
        });

        const hlOnBtn = modal.querySelector('.session-hl-on');
        const hlMissingBtn = modal.querySelector('.session-hl-missing');
        if (hlOnBtn) {
            hlOnBtn.addEventListener('click', () => {
                sessionPromptState.highlightVars = !sessionPromptState.highlightVars;
                hlOnBtn.classList.toggle('cpb-pill-active', sessionPromptState.highlightVars);
                if (sessionPromptState.previewMode || sessionPromptState.livePreview) {
                    updateSessionPromptPreview(modal, editor, preview);
                }
            });
        }
        if (hlMissingBtn) {
            hlMissingBtn.addEventListener('click', () => {
                sessionPromptState.onlyMissing = !sessionPromptState.onlyMissing;
                hlMissingBtn.classList.toggle('cpb-pill-active', sessionPromptState.onlyMissing);
                if (sessionPromptState.previewMode || sessionPromptState.livePreview) {
                    updateSessionPromptPreview(modal, editor, preview);
                }
            });
        }

        if (sessionPromptEditorMde) {
            sessionPromptEditorMde.codemirror.on('change', () => {
                sessionHandleEditorInput(modal);
                sessionMaybeOpenAutocomplete();
                sessionMaybeOpenSlashCommand(modal);
            });
            sessionPromptEditorMde.codemirror.on('keydown', (_cm, evt) => {
                if (sessionHandleSlashKeydown(evt, modal)) return;
                if (sessionHandleAcKeydown(evt)) return;
                if (evt.ctrlKey && evt.key.toLowerCase() === 'enter') {
                    evt.preventDefault();
                    if (updateSessionSendState()) return;
                    modal.querySelector('[data-action="send"]')?.click();
                }
            });
            // Scroll sync for live preview
            sessionPromptEditorMde.codemirror.on('scroll', () => {
                sessionSyncPreviewScrollFromEditor(modal);
            });
        } else {
            editor.addEventListener('input', () => {
                sessionHandleEditorInput(modal);
                sessionMaybeOpenAutocomplete();
                sessionMaybeOpenSlashCommand(modal);
            });
            editor.addEventListener('keydown', (evt) => {
                if (sessionHandleSlashKeydown(evt, modal)) return;
                if (sessionHandleAcKeydown(evt)) return;
                if (evt.ctrlKey && evt.key.toLowerCase() === 'enter') {
                    evt.preventDefault();
                    if (updateSessionSendState()) return;
                    modal.querySelector('[data-action="send"]')?.click();
                }
            });
        }
        preview.onclick = handlePreviewLinkClick;

        // Scroll sync: preview -> editor
        preview.addEventListener('scroll', () => {
            sessionHandlePreviewScroll(modal);
        });

        // Close session autocomplete / slash menu on outside click
        modal.addEventListener('click', (e) => {
            const acEl = modal.querySelector('.session-ac');
            if (acEl && !acEl.contains(e.target)) sessionCloseAutocomplete();
            const slashEl = modal.querySelector('.session-slash-menu');
            if (slashEl && !slashEl.contains(e.target)) sessionCloseSlashMenu(modal);
        });

        modal.querySelector('[data-action="save"]')?.addEventListener('click', async () => {
            const title = (modal.querySelector('.session-prompt-title')?.value || '').trim() || 'Session Prompt';
            const content = getSessionPromptEditorValue() || '';
            const sessionVars = collectSessionVarsFromModal(modal);
            let prompts = [];
            try { prompts = JSON.parse(localStorage.getItem(LS_PROMPTS) || '[]'); } catch (e) { prompts = []; }
            prompts.unshift({
                id: uid(),
                title,
                content,
                localVars: sessionVars,
                createdAt: Date.now(),
                updatedAt: Date.now(),
                lastUsedAt: Date.now()
            });
            localStorage.setItem(LS_PROMPTS, JSON.stringify(prompts));
            try { await window.electronAPI?.saveCustomPrompts?.(prompts); } catch (e) { }
            const saveBtn = modal.querySelector('[data-action="save"]');
            if (saveBtn) {
                const prev = saveBtn.textContent;
                saveBtn.textContent = 'Saved';
                saveBtn.disabled = true;
                setTimeout(() => {
                    saveBtn.textContent = prev;
                    saveBtn.disabled = false;
                }, 900);
            }
        });

        modal.querySelector('[data-action="send"]')?.addEventListener('click', async () => {
            if (updateSessionSendState()) return;
            masterInput.value = getSessionPromptEditorValue();
            masterInput.dispatchEvent(new Event('input', { bubbles: true }));
            closeSessionPromptBuilderModal();
            if (typeof window.sendPrompt === 'function') await window.sendPrompt();
        });
        updateSessionSendState();
    }

    function sessionHandleEditorInput(modal) {
        const editor = modal.querySelector('.session-prompt-editor');
        const preview = modal.querySelector('.session-prompt-preview');
        if (!editor || !preview) return;
        const sessionSendBtn = modal.querySelector('[data-action="send"]');
        const sessionValidationEl = modal.querySelector('.session-prompt-validation');
        const blocked = /\{\{main_prompt\}\}/i.test(getSessionPromptEditorValue() || '');
        const sessionRemoveReservedMainPrompt = (text) => String(text || '').replace(/\{\{main_prompt\}\}/gi, '').replace(/\n{3,}/g, '\n\n');
        if (sessionSendBtn) {
            sessionSendBtn.disabled = blocked;
            sessionSendBtn.title = blocked ? RESERVED_MAIN_PROMPT_TITLE : 'Send';
            sessionSendBtn.setAttribute('aria-disabled', blocked ? 'true' : 'false');
        }
        if (sessionValidationEl) {
            if (blocked) {
                sessionValidationEl.innerHTML = `
                    <span class="validation-inline-text">${safeHtml(RESERVED_MAIN_PROMPT_MSG)} ${safeHtml(RESERVED_MAIN_PROMPT_ACTION)}</span>
                    <button type="button" class="session-validation-fix">${safeHtml(RESERVED_MAIN_PROMPT_FIX_LABEL)}</button>
                `;
                const fixBtn = sessionValidationEl.querySelector('.session-validation-fix');
                if (fixBtn) {
                    fixBtn.onclick = () => {
                        setSessionPromptEditorValue(sessionRemoveReservedMainPrompt(getSessionPromptEditorValue() || ''));
                        sessionHandleEditorInput(modal);
                        focusSessionPromptEditor();
                    };
                }
                sessionValidationEl.style.display = 'flex';
            } else {
                sessionValidationEl.style.display = 'none';
                sessionValidationEl.innerHTML = '';
            }
        }
        refreshSessionPromptVars(modal, editor, preview);
        if (sessionPromptState.previewMode || sessionPromptState.livePreview) {
            updateSessionPromptPreview(modal, editor, preview);
        }
        // Auto-sync session editor content back to main input
        const masterInput = document.getElementById('master-input');
        if (masterInput) {
            masterInput.value = getSessionPromptEditorValue();
            // Silently update (no re-trigger of input event to avoid loops)
        }
    }

    function getSessionPromptEditorValue() {
        if (sessionPromptEditorMde) return sessionPromptEditorMde.value() || '';
        return sessionPromptModal?.querySelector('.session-prompt-editor')?.value || '';
    }

    function setSessionPromptEditorValue(value, opts = {}) {
        const nextValue = value || '';
        if (sessionPromptEditorMde) {
            sessionPromptEditorMde.value(nextValue);
            // Force CodeMirror to recalculate internal state (prevents line count / cursor desync)
            const cm = sessionPromptEditorMde.codemirror;
            cm.refresh();
            if (opts.refreshDelay !== false) {
                setTimeout(() => { try { cm.refresh(); } catch (e) { /* ignore */ } }, 50);
            }
            return;
        }
        const editor = sessionPromptModal?.querySelector('.session-prompt-editor');
        if (editor) editor.value = nextValue;
    }

    function focusSessionPromptEditor() {
        if (sessionPromptEditorMde) {
            sessionPromptEditorMde.codemirror.focus();
            return;
        }
        sessionPromptModal?.querySelector('.session-prompt-editor')?.focus();
    }

    function replaceSessionPromptSelection(text) {
        if (sessionPromptEditorMde) {
            const cm = sessionPromptEditorMde.codemirror;
            cm.replaceSelection(text);
            cm.focus();
            return;
        }
        const editor = sessionPromptModal?.querySelector('.session-prompt-editor');
        if (editor) insertAtCaret(editor, text);
    }

    /* ---------- Session Builder Autocomplete ---------- */
    function sessionListAllVars() {
        const ctx = window._cpb_context || { globalVars: [], localVars: [] };
        const globals = Array.isArray(ctx.globalVars) ? ctx.globalVars : [];
        const locals = Array.isArray(ctx.localVars) ? ctx.localVars : [];
        const sys = SYSTEM_VARS.filter(v => !RESERVED_SYSTEM_VARS.includes(v.name)).map(v => ({ scope: 'system', name: v.name, desc: v.desc, icon: 'S' }));
        const glo = globals.map(v => ({ scope: 'global', name: v.name, desc: (v.value || '').slice(0, 80), icon: 'G' })).filter(x => x.name);
        const loc = locals.map(v => ({ scope: 'local', name: v.name, desc: (v.value || '').slice(0, 80), icon: 'L' })).filter(x => x.name);
        return [...sys, ...glo, ...loc];
    }

    function sessionMaybeOpenAutocomplete() {
        const t = getSessionPromptEditorValue();
        let pos = 0;
        if (sessionPromptEditorMde) {
            const cm = sessionPromptEditorMde.codemirror;
            pos = cm.indexFromPos(cm.getCursor());
        }
        const before = t.slice(0, pos);
        const i = before.lastIndexOf('{{');
        if (i === -1) { sessionCloseAutocomplete(); return; }
        const after = before.slice(i + 2);
        if (after.includes('}}') || /[\s\n\r]/.test(after)) { sessionCloseAutocomplete(); return; }
        sessionAcAnchor = i;
        sessionAcPaletteMode = false; // typing mode, not palette
        const filter = after.toLowerCase();
        sessionAcItems = sessionListAllVars().filter(v => v.name.toLowerCase().includes(filter)).slice(0, 60);
        if (sessionAcItems.length === 0) { sessionCloseAutocomplete(); return; }
        sessionAcSelected = 0;
        sessionPositionAutocomplete();
        sessionRenderAutocomplete();
    }

    function sessionOpenPaletteAtCaret() {
        focusSessionPromptEditor();
        miEnsureMainInputContext(getSessionPromptEditorValue());
        sessionAcItems = sessionListAllVars().slice(0, 60);
        sessionAcSelected = 0;
        if (sessionPromptEditorMde) {
            const cm = sessionPromptEditorMde.codemirror;
            sessionAcAnchor = cm.indexFromPos(cm.getCursor());
        } else {
            sessionAcAnchor = sessionPromptModal?.querySelector('.session-prompt-editor')?.selectionStart || 0;
        }
        sessionAcPaletteMode = true;
        sessionPositionAutocomplete();
        sessionRenderAutocomplete();
    }

    function sessionPositionAutocomplete() {
        sessionAcOpen = true;
        const acEl = sessionPromptModal?.querySelector('.session-ac');
        if (!acEl) return;
        let top = 0, left = 0;
        if (sessionPromptEditorMde) {
            const cm = sessionPromptEditorMde.codemirror;
            const cursor = cm.getCursor();
            const coords = cm.cursorCoords(cursor, 'window');
            top = coords.bottom + 4;
            left = coords.left;
        }
        const vw = window.innerWidth, vh = window.innerHeight, acW = 320, acH = 300;
        if (left + acW > vw - 16) left = vw - acW - 16;
        if (left < 8) left = 8;
        if (top + acH > vh - 16) top = vh - acH - 16;
        if (top < 8) top = 8;
        acEl.style.top = top + 'px';
        acEl.style.left = left + 'px';
        acEl.classList.add('cpb-show');
    }

    function sessionRenderAutocomplete() {
        const acEl = sessionPromptModal?.querySelector('.session-ac');
        if (!acEl) return;
        acEl.innerHTML = '';
        const groups = [
            { key: 'system', title: 'System', badge: 'cpb-badge-sys' },
            { key: 'global', title: 'Global', badge: 'cpb-badge-glo' },
            { key: 'local', title: 'Session', badge: 'cpb-badge-loc' }
        ];
        let idx = 0;
        for (const g of groups) {
            const rows = sessionAcItems.filter(x => x.scope === g.key);
            if (rows.length === 0) continue;
            const st = document.createElement('div');
            st.className = 'cpb-ac-section'; st.textContent = g.title;
            acEl.appendChild(st);
            rows.forEach(r => {
                const ri = idx;
                const row = document.createElement('div');
                row.className = 'cpb-ac-row' + (ri === sessionAcSelected ? ' cpb-ac-selected' : '');
                row.innerHTML = `<span class="cpb-ac-badge ${g.badge}">${safeHtml(r.icon)}</span><div><div class="cpb-ac-name">{{${safeHtml(r.name)}}}</div><div class="cpb-ac-desc">${safeHtml(r.desc)}</div></div>`;
                row.onmouseenter = () => { sessionAcSelected = ri; sessionHighlightSelected(); };
                row.onclick = () => sessionPickAutocomplete(r.name);
                acEl.appendChild(row);
                idx++;
            });
        }
        sessionHighlightSelected();
    }

    function sessionHighlightSelected() {
        const acEl = sessionPromptModal?.querySelector('.session-ac');
        if (!acEl) return;
        const rows = [...acEl.querySelectorAll('.cpb-ac-row')];
        rows.forEach((r, i) => r.classList.toggle('cpb-ac-selected', i === sessionAcSelected));
        const sel = rows[sessionAcSelected]; if (sel) sel.scrollIntoView({ block: 'nearest' });
    }

    function sessionPickAutocomplete(name) {
        const insert = `{{${name}}}`;
        if (sessionAcPaletteMode) {
            // Palette mode: just insert at cursor position
            replaceSessionPromptSelection(insert);
        } else if (sessionPromptEditorMde) {
            const t = getSessionPromptEditorValue();
            const cm = sessionPromptEditorMde.codemirror;
            const pos = cm.indexFromPos(cm.getCursor());
            const before = t.slice(0, sessionAcAnchor), after = t.slice(pos);
            const nextValue = before + insert + after;
            const newPos = before.length + insert.length;
            setSessionPromptEditorValue(nextValue);
            cm.setCursor(cm.posFromIndex(newPos));
            cm.focus();
        } else {
            replaceSessionPromptSelection(insert);
        }
        sessionCloseAutocomplete();
        sessionHandleEditorInput(sessionPromptModal);
    }

    function sessionCloseAutocomplete() {
        sessionAcOpen = false; sessionAcAnchor = -1; sessionAcItems = []; sessionAcPaletteMode = false;
        const acEl = sessionPromptModal?.querySelector('.session-ac');
        if (acEl) acEl.classList.remove('cpb-show');
    }

    function sessionHandleAcKeydown(evt) {
        if (!sessionAcOpen) return false;
        if (evt.key === 'ArrowDown') { evt.preventDefault(); sessionAcSelected = Math.min(sessionAcSelected + 1, sessionAcItems.length - 1); sessionRenderAutocomplete(); return true; }
        if (evt.key === 'ArrowUp') { evt.preventDefault(); sessionAcSelected = Math.max(sessionAcSelected - 1, 0); sessionRenderAutocomplete(); return true; }
        if (evt.key === 'Enter' || evt.key === 'Tab') { evt.preventDefault(); if (sessionAcItems[sessionAcSelected]) sessionPickAutocomplete(sessionAcItems[sessionAcSelected].name); return true; }
        if (evt.key === 'Escape') { sessionCloseAutocomplete(); return true; }
        return false;
    }

    /* ---------- Session Builder Slash Command ---------- */
    function sessionMaybeOpenSlashCommand(modal) {
        const slashEl = modal?.querySelector('.session-slash-menu');
        if (!slashEl || sessionAcOpen) { sessionCloseSlashMenu(modal); return; }
        const text = getSessionPromptEditorValue();
        let pos = 0;
        if (sessionPromptEditorMde) {
            const cm = sessionPromptEditorMde.codemirror;
            pos = cm.indexFromPos(cm.getCursor());
        }
        const before = text.slice(0, pos);
        const tokenStart = Math.max(before.lastIndexOf(' '), before.lastIndexOf('\n'), before.lastIndexOf('\t')) + 1;
        const token = before.slice(tokenStart);
        if (!token.startsWith('/')) { sessionCloseSlashMenu(modal); return; }
        if (token.includes('{{')) { sessionCloseSlashMenu(modal); return; }
        const query = token.slice(1);
        sessionSlashItems = miLoadPromptItems(query);
        if (!sessionSlashItems.length) { sessionCloseSlashMenu(modal); return; }
        sessionSlashAnchor = tokenStart;
        sessionSlashSelected = 0;
        sessionSlashOpen = true;

        // Position the menu near cursor
        if (sessionPromptEditorMde) {
            const cm = sessionPromptEditorMde.codemirror;
            const cursor = cm.getCursor();
            const coords = cm.cursorCoords(cursor, 'window');
            let left = coords.left;
            let top = coords.bottom + 4;
            const menuHeight = Math.min(sessionSlashItems.length * 36 + 38, 300);
            // prefer above cursor if not enough room below
            if (top + menuHeight > window.innerHeight - 16) top = Math.max(8, coords.top - menuHeight - 4);
            if (left + 340 > window.innerWidth - 16) left = window.innerWidth - 356;
            if (left < 8) left = 8;
            slashEl.style.left = `${left}px`;
            slashEl.style.top = `${top}px`;
        }
        slashEl.classList.add('show');
        sessionRenderSlashMenu(modal);
    }

    function sessionRenderSlashMenu(modal) {
        const slashEl = modal?.querySelector('.session-slash-menu');
        if (!slashEl) return;
        slashEl.innerHTML = `
            <div class="msm-header">Slash Commands · Custom Prompts</div>
            <div class="msm-list"></div>
        `;
        const listEl = slashEl.querySelector('.msm-list');
        if (!listEl) return;
        sessionSlashItems.forEach((item, index) => {
            const row = document.createElement('div');
            row.className = 'msm-row' + (index === sessionSlashSelected ? ' selected' : '');
            row.innerHTML = `
                <span class="msm-icon">P</span>
                <span>
                    <div class="msm-title">${safeHtml(item.title)}</div>
                    <div class="msm-desc">${safeHtml(previewOf(item.content || ''))}</div>
                </span>
            `;
            row.onmouseenter = () => {
                sessionSlashSelected = index;
                sessionHighlightSlashSelection(modal);
            };
            row.onmousedown = (e) => e.preventDefault();
            row.onclick = (e) => {
                e.preventDefault();
                sessionPickSlashCommand(modal, item);
            };
            listEl.appendChild(row);
        });
        sessionHighlightSlashSelection(modal);
    }

    function sessionHighlightSlashSelection(modal) {
        const slashEl = modal?.querySelector('.session-slash-menu');
        if (!slashEl) return;
        const rows = [...slashEl.querySelectorAll('.msm-list .msm-row')];
        rows.forEach((row, idx) => row.classList.toggle('selected', idx === sessionSlashSelected));
        const selected = rows[sessionSlashSelected];
        if (selected) selected.scrollIntoView({ block: 'nearest' });
    }

    function sessionPickSlashCommand(modal, item) {
        const existingText = getSessionPromptEditorValue();
        const insertedText = item.content || '';
        const promptLocalVars = Array.isArray(item.localVars) ? JSON.parse(JSON.stringify(item.localVars)) : [];

        let pos = 0;
        if (sessionPromptEditorMde) {
            const cm = sessionPromptEditorMde.codemirror;
            pos = cm.indexFromPos(cm.getCursor());
        }

        // Check if there is meaningful text (beyond just the slash token)
        const textWithoutSlash = existingText.slice(0, sessionSlashAnchor) + existingText.slice(pos);
        const hasExistingContent = textWithoutSlash.trim().length > 0;

        // Capture anchor/pos before closing slash menu (which resets them)
        const capturedAnchor = sessionSlashAnchor;

        const doInsert = (mode) => {
            const globalVars = (() => {
                try { return JSON.parse(localStorage.getItem(LS_GLOBALV) || '[]'); } catch (e) { return []; }
            })();
            const existingCtx = window._cpb_context || {};
            const existingLocals = Array.isArray(existingCtx.localVars) ? existingCtx.localVars : [];

            if (mode === 'replace') {
                setSessionPromptEditorValue(insertedText);
                if (sessionPromptEditorMde) {
                    const cm = sessionPromptEditorMde.codemirror;
                    cm.setCursor(cm.posFromIndex(insertedText.length));
                    cm.focus();
                    // Extra refresh to ensure line count and cursor sync
                    setTimeout(() => { try { cm.refresh(); } catch (e) { /* ignore */ } }, 80);
                }
                window._cpb_context = {
                    promptId: null,
                    globalVars: JSON.parse(JSON.stringify(Array.isArray(globalVars) ? globalVars : [])),
                    localVars: promptLocalVars,
                    systemVarNames: SYSTEM_VARS.map(v => v.name)
                };
            } else {
                // insert at cursor — use captured anchor
                const before = existingText.slice(0, capturedAnchor);
                const after = existingText.slice(pos);
                const newText = before + insertedText + after;
                setSessionPromptEditorValue(newText);
                const newPos = before.length + insertedText.length;
                if (sessionPromptEditorMde) {
                    const cm = sessionPromptEditorMde.codemirror;
                    cm.setCursor(cm.posFromIndex(newPos));
                    cm.focus();
                    // Extra refresh to ensure line count and cursor sync
                    setTimeout(() => { try { cm.refresh(); } catch (e) { /* ignore */ } }, 80);
                }
                // Merge local vars
                const mergedLocals = [...existingLocals];
                const knownNames = new Set(mergedLocals.map(v => (v?.name || '').toLowerCase()));
                promptLocalVars.forEach(v => {
                    if (v?.name && !knownNames.has(v.name.toLowerCase())) {
                        mergedLocals.push(v);
                        knownNames.add(v.name.toLowerCase());
                    }
                });
                window._cpb_context = {
                    promptId: existingCtx.promptId || null,
                    globalVars: JSON.parse(JSON.stringify(Array.isArray(globalVars) ? globalVars : [])),
                    localVars: mergedLocals,
                    systemVarNames: SYSTEM_VARS.map(v => v.name)
                };
            }
            sessionHandleEditorInput(modal);
            focusSessionPromptEditor();

            // Also sync to main input
            const masterInput = document.getElementById('master-input');
            if (masterInput) {
                masterInput.value = getSessionPromptEditorValue();
            }
        };

        // Always close slash menu FIRST before showing modal
        sessionCloseSlashMenu(modal);

        if (!hasExistingContent) {
            doInsert('replace');
            return;
        }

        // Show modal asking user: Insert / Replace / Cancel
        showSessionSlashInsertModal(modal, {
            onInsert: () => doInsert('insert'),
            onReplace: () => doInsert('replace'),
            onCancel: () => { focusSessionPromptEditor(); }
        });
    }

    function showSessionSlashInsertModal(parentModal, callbacks) {
        // Remove any lingering session slash insert modal
        const existing = document.querySelector('.session-slash-insert-modal');
        if (existing) existing.remove();

        const modalEl = document.createElement('div');
        modalEl.className = 'slash-insert-modal session-slash-insert-modal';
        modalEl.innerHTML = `
            <div class="slash-insert-dialog">
                <div class="slash-insert-title">Prompt Already Exists</div>
                <p class="slash-insert-desc">The editor already contains content.<br>How would you like to apply the selected prompt?</p>
                <div class="slash-insert-actions">
                    <button class="slash-insert-btn" data-action="insert">Insert at Cursor</button>
                    <button class="slash-insert-btn primary" data-action="replace">Overwrite</button>
                    <button class="slash-insert-btn cancel" data-action="cancel">Cancel</button>
                </div>
            </div>
        `;

        // Append inside session modal to inherit its stacking context (z-index 13120)
        // This ensures the insert modal renders above the session modal content
        if (parentModal) {
            parentModal.appendChild(modalEl);
        } else {
            document.body.appendChild(modalEl);
        }

        const cleanup = (cb) => {
            modalEl.remove();
            cb();
        };
        modalEl.querySelector('[data-action="insert"]').onclick = () => cleanup(callbacks.onInsert);
        modalEl.querySelector('[data-action="replace"]').onclick = () => cleanup(callbacks.onReplace);
        modalEl.querySelector('[data-action="cancel"]').onclick = () => cleanup(callbacks.onCancel);
        modalEl.addEventListener('click', (e) => { if (e.target === modalEl) cleanup(callbacks.onCancel); });
    }

    function sessionCloseSlashMenu(modal) {
        sessionSlashOpen = false;
        sessionSlashAnchor = -1;
        sessionSlashItems = [];
        const slashEl = modal?.querySelector('.session-slash-menu');
        if (slashEl) slashEl.classList.remove('show');
    }

    function sessionHandleSlashKeydown(evt, modal) {
        if (!sessionSlashOpen) return false;
        if (evt.key === 'ArrowDown') { evt.preventDefault(); sessionSlashSelected = Math.min(sessionSlashSelected + 1, sessionSlashItems.length - 1); sessionRenderSlashMenu(modal); return true; }
        if (evt.key === 'ArrowUp') { evt.preventDefault(); sessionSlashSelected = Math.max(sessionSlashSelected - 1, 0); sessionRenderSlashMenu(modal); return true; }
        if (evt.key === 'Enter' || evt.key === 'Tab') {
            const picked = sessionSlashItems[sessionSlashSelected];
            if (picked) { evt.preventDefault(); sessionPickSlashCommand(modal, picked); }
            return true;
        }
        if (evt.key === 'Escape') { evt.preventDefault(); sessionCloseSlashMenu(modal); return true; }
        return false;
    }

    /* ---------- Session Builder Scroll Sync ---------- */
    function sessionSyncPreviewScrollFromEditor(modal) {
        if (sessionScrollSyncLock) return;
        if (!(sessionPromptState.livePreview || sessionPromptState.previewMode)) return;
        const preview = modal?.querySelector('.session-prompt-preview');
        if (!preview) return;
        const previewMax = Math.max(0, preview.scrollHeight - preview.clientHeight);
        let ratio = 0;
        if (sessionPromptEditorMde) {
            const s = sessionPromptEditorMde.codemirror.getScrollInfo();
            const edMax = Math.max(0, s.height - s.clientHeight);
            ratio = edMax > 0 ? (s.top / edMax) : 0;
        }
        sessionScrollSyncLock = true;
        preview.scrollTop = ratio * previewMax;
        sessionScrollSyncLock = false;
    }

    function sessionHandlePreviewScroll(modal) {
        if (sessionScrollSyncLock || !sessionPromptState.livePreview) return;
        const preview = modal?.querySelector('.session-prompt-preview');
        if (!preview) return;
        const previewMax = Math.max(0, preview.scrollHeight - preview.clientHeight);
        const ratio = previewMax > 0 ? (preview.scrollTop / previewMax) : 0;
        sessionScrollSyncLock = true;
        if (sessionPromptEditorMde) {
            const cm = sessionPromptEditorMde.codemirror;
            const s = cm.getScrollInfo();
            const edMax = Math.max(0, s.height - s.clientHeight);
            cm.scrollTo(null, ratio * edMax);
        }
        sessionScrollSyncLock = false;
    }

    function sessionSetPreviewMode(modal, on, opts = {}) {
        const forcedByLive = !!opts.forcedByLive;
        if (sessionPromptState.livePreview && !forcedByLive) return;
        sessionPromptState.previewMode = !!on;
        const editTab = modal.querySelector('.session-prompt-tab[data-mode="edit"]');
        const previewTab = modal.querySelector('.session-prompt-tab[data-mode="preview"]');
        const editorWrap = modal.querySelector('.session-cpb-editor-wrap');
        const preview = modal.querySelector('.session-prompt-preview');
        const insertBtn = modal.querySelector('.session-btn-insert-var');
        const formatBtn = modal.querySelector('.session-btn-format');
        if (!editorWrap || !preview) return;
        if (editTab) editTab.classList.toggle('cpb-pill-active', !on);
        if (previewTab) previewTab.classList.toggle('cpb-pill-active', !!on);
        editorWrap.style.display = (on && !sessionPromptState.livePreview) ? 'none' : '';
        preview.style.display = (on || sessionPromptState.livePreview) ? 'block' : 'none';
        const lockEditorActions = !!on && !sessionPromptState.livePreview;
        if (insertBtn) {
            insertBtn.disabled = lockEditorActions;
            insertBtn.style.opacity = lockEditorActions ? '0.4' : '';
            insertBtn.style.pointerEvents = lockEditorActions ? 'none' : '';
        }
        if (formatBtn) {
            formatBtn.disabled = lockEditorActions;
            formatBtn.style.opacity = lockEditorActions ? '0.4' : '';
            formatBtn.style.pointerEvents = lockEditorActions ? 'none' : '';
        }
        if (on || sessionPromptState.livePreview) {
            updateSessionPromptPreview(modal, modal.querySelector('.session-prompt-editor'), preview);
        }
    }

    function sessionSetLivePreviewMode(modal, on) {
        sessionPromptState.livePreview = !!on;
        const liveCheck = modal.querySelector('.session-live-preview-check');
        if (liveCheck) liveCheck.checked = sessionPromptState.livePreview;
        const editorContainer = modal.querySelector('.session-cpb-editor');
        if (editorContainer) editorContainer.classList.toggle('cpb-live-preview-on', sessionPromptState.livePreview);
        // Disable/enable Edit and Preview tabs when Live Preview is on/off
        const editTab = modal.querySelector('.session-prompt-tab[data-mode="edit"]');
        const previewTab = modal.querySelector('.session-prompt-tab[data-mode="preview"]');
        [editTab, previewTab].forEach((tab) => {
            if (!tab) return;
            tab.disabled = !!on;
            tab.style.opacity = on ? '0.4' : '';
            tab.style.pointerEvents = on ? 'none' : '';
        });
        if (sessionPromptState.livePreview) sessionSetPreviewMode(modal, true, { forcedByLive: true });
        else sessionSetPreviewMode(modal, false, { forcedByLive: true });
    }

    function refreshSessionPromptVars(modal, editor, previewEl) {
        const varsList = modal.querySelector('.session-vars-list');
        const globalList = modal.querySelector('.session-global-list');
        const globalChips = modal.querySelector('.session-global-chips');
        const systemChips = modal.querySelector('.session-system-chips');
        if (!varsList || !globalList || !globalChips || !systemChips) return;
        const text = getSessionPromptEditorValue();
        miEnsureMainInputContext(text);
        const ctx = window._cpb_context || { globalVars: [], localVars: [] };
        const globals = Array.isArray(ctx.globalVars) ? ctx.globalVars : [];
        const locals = Array.isArray(ctx.localVars) ? ctx.localVars : [];
        const globalNameSet = new Set(globals.map(v => (v?.name || '').toLowerCase()));
        // Session tab: detected vars that are NOT system and NOT global
        const names = miExtractVariableNames(text).filter((name) => {
            if (SYSTEM_VARS.some((v) => v.name === name)) return false;
            if (globalNameSet.has(name.toLowerCase())) return false;
            return true;
        });

        globalList.innerHTML = '';
        globalChips.innerHTML = '';
        if (!globals.length) {
            globalList.innerHTML = '<div class="session-vars-empty">No global variables found.</div>';
        } else {
            globals.forEach((v) => {
                const name = sanitizeVarName(v?.name || '');
                if (!name) return;
                const row = document.createElement('div');
                row.className = 'session-readonly-row session-readonly-row-sys';
                row.innerHTML = `
                    <span class="session-readonly-key">{{${safeHtml(name)}}}</span>
                    <span class="session-readonly-val">${safeHtml(String(v?.value || '').slice(0, 80) || '(empty)')}</span>
                `;
                row.style.cursor = 'pointer';
                row.addEventListener('click', () => replaceSessionPromptSelection(`{{${name}}}`));
                globalList.appendChild(row);
                const chip = document.createElement('button');
                chip.className = 'cpb-chip';
                chip.type = 'button';
                chip.textContent = `{{${name}}}`;
                chip.addEventListener('click', () => replaceSessionPromptSelection(`{{${name}}}`));
                globalChips.appendChild(chip);
            });
        }

        const systemList = modal.querySelector('.session-system-list');
        if (systemList) {
            systemList.innerHTML = '';
            SYSTEM_VARS.filter(v => !RESERVED_SYSTEM_VARS.includes(v.name)).forEach((v) => {
                const row = document.createElement('div');
                row.className = 'session-readonly-row session-readonly-row-sys';
                row.innerHTML = `
                    <span class="session-readonly-key">{{${safeHtml(v.name)}}}</span>
                    <span class="session-readonly-val">${safeHtml(v.desc || '')}</span>
                `;
                row.style.cursor = 'pointer';
                row.addEventListener('click', () => replaceSessionPromptSelection(`{{${v.name}}}`));
                systemList.appendChild(row);
            });
        }

        systemChips.innerHTML = '';
        SYSTEM_VARS.filter(v => !RESERVED_SYSTEM_VARS.includes(v.name)).forEach((v) => {
            const chip = document.createElement('button');
            chip.className = 'cpb-chip';
            chip.type = 'button';
            chip.textContent = `{{${v.name}}}`;
            chip.title = v.desc || 'Insert system variable';
            chip.addEventListener('click', () => replaceSessionPromptSelection(`{{${v.name}}}`));
            systemChips.appendChild(chip);
        });

        varsList.innerHTML = '';
        if (!names.length) {
            varsList.innerHTML = `
                <div class="session-vars-empty">
                    No session variables detected yet.
                    <br />
                    Add placeholders like <code>{{topic}}</code> in the editor.
                </div>
            `;
            return;
        }
        names.forEach((name) => {
            const localVar = locals.find((v) => v?.name === name);
            const globalVar = globals.find((v) => v?.name === name);
            const val = localVar ? (localVar.value || '') : (globalVar ? (globalVar.value || '') : '');
            const row = document.createElement('div');
            row.className = 'session-var-row';
            const source = localVar ? 'Session' : (globalVar ? 'Global' : 'Session');
            row.innerHTML = `
                <div class="session-var-head">
                    <label class="session-var-label">{{${safeHtml(name)}}}</label>
                    <span class="session-var-scope">${safeHtml(source)}</span>
                </div>
                <textarea class="session-var-input" data-var="${escapeAttr(name)}" placeholder="Enter value for ${escapeAttr(name)}">${safeHtml(val)}</textarea>
            `;
            varsList.appendChild(row);
        });

        varsList.querySelectorAll('.session-var-input').forEach((inp) => {
            inp.addEventListener('input', () => {
                const name = inp.getAttribute('data-var');
                if (!name) return;
                const ctxNow = window._cpb_context || { globalVars: [], localVars: [] };
                let target = (ctxNow.localVars || []).find((v) => v?.name === name);
                if (!target) {
                    target = { name, value: '' };
                    ctxNow.localVars = ctxNow.localVars || [];
                    ctxNow.localVars.push(target);
                }
                target.value = inp.value;
                window._cpb_context = ctxNow;
                const isPreviewActive = modal.querySelector('.session-prompt-tab[data-mode="preview"]')?.classList.contains('active');
                if (isPreviewActive) updateSessionPromptPreview(modal, editor, previewEl);
            });
        });
    }

    function collectSessionVarsFromModal(modal) {
        const vars = [];
        const inputs = modal.querySelectorAll('.session-var-input');
        inputs.forEach((inp) => {
            const name = sanitizeVarName(inp.getAttribute('data-var') || '');
            if (!name) return;
            vars.push({ name, value: inp.value || '' });
        });
        return vars;
    }

    async function updateSessionPromptPreview(modal, editor, previewEl) {
        const raw = getSessionPromptEditorValue();
        // Use real system vars via IPC (same as CPB)
        const sysVars = await getPreviewSystemVars();
        const ctx = window._cpb_context || { globalVars: [], localVars: [] };
        const gloMap = (ctx.globalVars || []).reduce((acc, v) => { if (v.name) acc[v.name] = v.value ?? ''; return acc; }, {});
        const localMap = (ctx.localVars || []).reduce((acc, v) => { if (v.name) acc[v.name] = v.value ?? ''; return acc; }, {});
        const mergedMap = { ...sysVars, ...gloMap, ...localMap };
        RESERVED_SYSTEM_VARS.forEach((name) => delete mergedMap[name]);
        const placeholders = {};
        let idx = 0;
        const withPlaceholders = String(raw || '').replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (m, key) => {
            if (RESERVED_SYSTEM_VARS.includes(key)) {
                const ph = `%%SPB_VAR_${idx++}%%`;
                placeholders[ph] = `<span class="cpb-var-hl cpb-var-missing" title="Reserved system variable. {{${key}} is not usable in the main/Session prompt editor.">${safeHtml(m)} <em>(reserved)</em></span>`;
                return ph;
            }
            const exists = Object.prototype.hasOwnProperty.call(mergedMap, key);
            const hasValue = exists && String(mergedMap[key] ?? '').trim();
            const val = hasValue ? mergedMap[key] : m;
            const ph = `%%SPB_VAR_${idx++}%%`;
            if (!sessionPromptState.highlightVars) {
                placeholders[ph] = makePreviewValueHtml(key, val, !!hasValue);
                return ph;
            }
            if (sessionPromptState.onlyMissing && hasValue) {
                placeholders[ph] = makePreviewValueHtml(key, val, !!hasValue);
                return ph;
            }
            const cls = hasValue ? 'cpb-var-hl' : 'cpb-var-hl cpb-var-missing';
            const title = hasValue ? `Resolved: ${key}` : (exists ? `Empty value: ${key}` : `Unresolved: ${key}`);
            const valueHtml = makePreviewValueHtml(key, val, !!hasValue);
            placeholders[ph] = `<span class="${cls}" title="${title}">${valueHtml}</span>`;
            return ph;
        });

        const mode = decidePreviewMode(raw);
        let html = '';
        if (mode === 'markdown') {
            try {
                html = marked.parse(withPlaceholders, { breaks: true, gfm: true });
            } catch (e) {
                html = safeHtml(withPlaceholders).replace(/\n/g, '<br>');
            }
        } else {
            html = safeHtml(withPlaceholders).replace(/\n/g, '<br>');
        }
        for (const [ph, replacement] of Object.entries(placeholders)) {
            html = html.replaceAll(safeHtml(ph), replacement);
            html = html.replaceAll(ph, replacement);
        }

        previewEl.classList.toggle('cpb-preview-md', mode === 'markdown');
        previewEl.classList.toggle('session-preview-plain', mode !== 'markdown');
        previewEl.innerHTML = html;
    }

    function sessionSetVarTab(modal, tab) {
        const safeTab = ['global', 'session', 'system'].includes(tab) ? tab : 'session';
        sessionPromptState.activeVarTab = safeTab;
        modal.querySelectorAll('.session-var-tab').forEach((btn) => {
            btn.classList.toggle('active', btn.getAttribute('data-spb-tab') === safeTab);
        });
        modal.querySelectorAll('.session-var-panel').forEach((panel) => {
            panel.style.display = panel.getAttribute('data-spb-panel') === safeTab ? '' : 'none';
        });
    }

    function applyMainPreviewTheme(masterPreview, themeWrap) {
        if (!masterPreview) return;
        const dark = miPreviewTheme === 'dark';
        masterPreview.classList.toggle('master-preview-theme-dark', dark);
        masterPreview.classList.toggle('master-preview-theme-light', !dark);
        if (!themeWrap) return;
        themeWrap.querySelectorAll('.master-preview-theme-btn').forEach((btn) => {
            const active = (btn.getAttribute('data-theme') === 'dark') === dark;
            btn.classList.toggle('active', active);
        });
    }

    function showVarEditPopup(varName, scope) {
        const ctx = window._cpb_context;
        let currentValue = '';
        if (scope === 'local' && ctx) {
            const v = (ctx.localVars || []).find(v => v.name === varName);
            if (v) currentValue = v.value || '';
        } else if (scope === 'global') {
            if (ctx) {
                const v = (ctx.globalVars || []).find(v => v.name === varName);
                if (v) currentValue = v.value || '';
            } else {
                try {
                    const gv = JSON.parse(localStorage.getItem(LS_GLOBALV) || '[]');
                    const v = gv.find(v => v.name === varName);
                    if (v) currentValue = v.value || '';
                } catch (e) { }
            }
        }

        setMainPopupLayerActive(true);

        const backdrop = document.createElement('div');
        backdrop.className = 'cpb-unresolved-backdrop';
        backdrop.innerHTML = `
            <div class="cpb-unresolved-modal">
                <div class="cpb-unresolved-header">
                    <span>Edit Variable: {{${safeHtml(varName)}}}</span>
                    <button class="cpb-unresolved-close">&times;</button>
                </div>
                <div class="cpb-unresolved-body">
                    <p>Scope: <b>${scope}</b></p>
                    <div class="cpb-unresolved-fields">
                        <div class="cpb-unresolved-row">
                            <label class="cpb-unresolved-label">Value</label>
                        </div>
                    </div>
                </div>
                <div class="cpb-unresolved-footer">
                    <button class="cpb-btn cpb-btn-secondary cpb-unresolved-cancel">Cancel</button>
                    <button class="cpb-btn cpb-btn-primary cpb-unresolved-ok">Save</button>
                </div>
            </div>
        `;

        const fieldsDiv = backdrop.querySelector('.cpb-unresolved-row');
        const inp = document.createElement('textarea');
        inp.className = 'cpb-unresolved-input';
        inp.style.minHeight = '60px';
        inp.value = currentValue;
        inp.placeholder = `Enter value for ${varName}`;
        fieldsDiv.appendChild(inp);

        const cleanup = () => {
            backdrop.remove();
            setMainPopupLayerActive(false);
        };

        backdrop.querySelector('.cpb-unresolved-close').onclick = cleanup;
        backdrop.querySelector('.cpb-unresolved-cancel').onclick = cleanup;
        backdrop.querySelector('.cpb-unresolved-ok').onclick = () => {
            const newVal = inp.value;
            // Update in context
            if (scope === 'local' && ctx) {
                const v = (ctx.localVars || []).find(v => v.name === varName);
                if (v) v.value = newVal;
            } else if (scope === 'global') {
                if (ctx) {
                    const v = (ctx.globalVars || []).find(v => v.name === varName);
                    if (v) v.value = newVal;
                }
                // Also update localStorage global vars
                try {
                    const gv = JSON.parse(localStorage.getItem(LS_GLOBALV) || '[]');
                    const v = gv.find(v => v.name === varName);
                    if (v) { v.value = newVal; localStorage.setItem(LS_GLOBALV, JSON.stringify(gv)); }
                } catch (e) { }
            }
            cleanup();
            if (miPreviewMode) renderMasterPreview();
        };

        backdrop.addEventListener('click', (e) => { if (e.target === backdrop) cleanup(); });
        document.body.appendChild(backdrop);
        inp.focus();
        inp.setSelectionRange(inp.value.length, inp.value.length);
    }

    function handlePreviewLinkClick(event) {
        const anchor = event.target?.closest?.('a[href]');
        if (!anchor) return;
        const href = anchor.getAttribute('href');
        if (!href) return;
        let parsedUrl;
        try {
            parsedUrl = new URL(href, window.location.href);
        } catch (e) {
            return;
        }
        if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') return;
        event.preventDefault();
        event.stopPropagation();
        window.electronAPI?.openUrlInChrome?.(parsedUrl.toString());
    }

    // =============================================
    // Expose to global scope
    // =============================================
    window.openCustomPromptBuilder = openCPB;

    // Setup main input features on load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setupMainInputFeatures);
    } else {
        setTimeout(setupMainInputFeatures, 100);
    }
})();
