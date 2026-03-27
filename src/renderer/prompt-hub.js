/**
 * Prompt categories, favorites, Prompt Hub panel, shared with CPB via SMCPromptLibrary.
 */
(function () {
    'use strict';

    const LS_CAT = 'smc_categories_v1';
    const LS_FAV_CAT = 'smc_favorite_category_ids_v1';
    const LS_PROMPTS = 'smc_prompts_v1';
    const LS_PH_COLS = 'smc_ph_table_cols_v1';

    function uid() {
        return 'c_' + Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
    }

    function loadCategories() {
        try {
            const t = localStorage.getItem(LS_CAT);
            const arr = t ? JSON.parse(t) : [];
            if (!Array.isArray(arr)) return [];
            return arr.filter((c) => c && c.id && c.name).map((c) => ({
                id: String(c.id),
                name: String(c.name),
                parentId: c.parentId == null || c.parentId === '' ? null : String(c.parentId),
            }));
        } catch (e) {
            return [];
        }
    }

    function saveCategories(list) {
        localStorage.setItem(LS_CAT, JSON.stringify(list));
        window.dispatchEvent(new CustomEvent('smc:prompt-library-changed'));
    }

    function loadFavoriteCategoryIds() {
        try {
            const t = localStorage.getItem(LS_FAV_CAT);
            const arr = t ? JSON.parse(t) : [];
            return Array.isArray(arr) ? arr.map(String) : [];
        } catch (e) {
            return [];
        }
    }

    function saveFavoriteCategoryIds(ids) {
        localStorage.setItem(LS_FAV_CAT, JSON.stringify([...new Set(ids)]));
        window.dispatchEvent(new CustomEvent('smc:prompt-library-changed'));
    }

    function loadPromptsRaw() {
        try {
            const t = localStorage.getItem(LS_PROMPTS);
            const arr = t ? JSON.parse(t) : [];
            return Array.isArray(arr) ? arr : [];
        } catch (e) {
            return [];
        }
    }

    function categoryDepth(id, cats) {
        const c = cats.find((x) => x.id === id);
        if (!c || !c.parentId) return 1;
        return 2;
    }

    function isPromptFavorite(p, favCatIds, cats) {
        if (p.favorite) return true;
        const cid = p.categoryId || null;
        if (!cid) return false;
        if (favCatIds.includes(cid)) return true;
        const cat = cats.find((c) => c.id === cid);
        if (cat && cat.parentId && favCatIds.includes(cat.parentId)) return true;
        return false;
    }

    window.SMCPromptLibrary = {
        LS_CAT,
        LS_FAV_CAT,
        LS_PROMPTS,
        loadCategories,
        saveCategories,
        loadFavoriteCategoryIds,
        saveFavoriteCategoryIds,
        loadPromptsRaw,
        categoryDepth,
        isPromptFavorite,
        uncategorizedLabel: 'Uncategorized',
        /** Filled when CPB registers its category panel (getState returns shared _cpbPhState). */
        _getCpbPhState: null,
        _cpbPhRefresh: null,
    };

    let _deps = null;
    let _phState = {
        titleQ: '',
        catId: '',
        tagQ: '',
        favoritesOnly: false,
        view: 'table',
        selected: new Set(),
        catExpanded: {},
        allUnderAllExpanded: true,
        filterCollapsed: false,
        sortCol: 'updatedAt',
        sortDir: 'desc',
    };

    /** Sidebar category inline editor (replaces window.prompt in Electron). */
    let _phCatQuick = { mode: 'idle', parentId: null, targetId: null, initialName: null, panel: 'hub' };

    function escapeHtml(s) {
        return String(s || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function previewOf(text, n) {
        const t = String(text || '').replace(/\s+/g, ' ').trim();
        return t.length > (n || 120) ? t.slice(0, n || 120) + '…' : t;
    }

    function loadTableColWidths() {
        try {
            const t = localStorage.getItem(LS_PH_COLS);
            const o = t ? JSON.parse(t) : null;
            if (o && typeof o.title === 'number' && typeof o.summary === 'number' && typeof o.category === 'number') {
                return { title: o.title, summary: o.summary, category: o.category };
            }
        } catch (e) { /* ignore */ }
        return { title: 220, summary: 300, category: 140 };
    }

    function saveTableColWidths(w) {
        try {
            localStorage.setItem(LS_PH_COLS, JSON.stringify(w));
        } catch (e) { /* ignore */ }
    }

    function phToast(msg) {
        let el = document.getElementById('ph-hub-toast');
        if (!el) {
            el = document.createElement('div');
            el.id = 'ph-hub-toast';
            el.className = 'ph-hub-toast';
            el.setAttribute('role', 'status');
            document.body.appendChild(el);
        }
        el.textContent = msg;
        el.classList.add('ph-hub-toast--show');
        clearTimeout(phToast._tm);
        phToast._tm = setTimeout(() => el.classList.remove('ph-hub-toast--show'), 1800);
    }

    /** Line break after "?" so the Uncategorized sentence stays on its own line; word wrap at word boundaries (see .smc-confirm-msg). */
    function deleteCategoryConfirmMessage(displayName) {
        const u = window.SMCPromptLibrary.uncategorizedLabel || 'Uncategorized';
        const name = String(displayName || '');
        return `Delete "${name}"?\nPrompts in this category will become ${u}.`;
    }

    /** Themed confirm (replaces window.confirm for Electron / dark UI). */
    function showSmcConfirmModal(opts, callback) {
        const modal = document.getElementById('smc-confirm-modal');
        if (!modal) {
            if (callback) callback(false);
            return;
        }
        // Note: There are legacy/new confirm modal markups in index.html.
        // Resolve elements from the active modal node first, then fallback.
        const titleEl = modal.querySelector('#smc-confirm-title');
        const msgEl = modal.querySelector('#smc-confirm-message') || modal.querySelector('#smc-confirm-msg');
        const okBtn = modal.querySelector('#smc-confirm-ok');
        const cancelBtn = modal.querySelector('#smc-confirm-cancel');
        const closeBtn = modal.querySelector('#smc-confirm-close');
        if (!msgEl || !okBtn || !cancelBtn) {
            if (callback) callback(false);
            return;
        }
        if (titleEl) titleEl.textContent = opts.title || 'Confirm';
        msgEl.textContent = opts.message || '';
        okBtn.textContent = opts.confirmText || 'OK';
        cancelBtn.textContent = opts.cancelText || 'Cancel';
        okBtn.className = 'btn-primary';
        if (opts.danger) okBtn.classList.add('smc-confirm-danger');
        const cleanup = () => {
            modal.classList.remove('visible');
            okBtn.onclick = null;
            cancelBtn.onclick = null;
            closeBtn.onclick = null;
            modal.onclick = null;
            try { window.applySmcPreferredServiceVisibility?.(); } catch (e) { /* ignore */ }
        };
        const onOk = () => { cleanup(); if (callback) callback(true); };
        const onNo = () => { cleanup(); if (callback) callback(false); };
        okBtn.onclick = onOk;
        cancelBtn.onclick = onNo;
        if (closeBtn) closeBtn.onclick = onNo;
        modal.onclick = (ev) => { if (ev.target === modal) onNo(); };
        try { window.electronAPI?.setServiceVisibility?.(false); } catch (e) { /* ignore */ }
        modal.classList.add('visible');
    }

    /** @returns {boolean} true if a category was removed */
    function performCategoryDeleteById(id) {
        const sid = String(id || '');
        if (!sid) return false;
        const allCats = loadCategories();
        const cat = allCats.find((c) => c.id === sid);
        if (!cat) return false;
        const subtreeIds = collectSubtreeCategoryIds(sid, allCats);
        const removeIds = new Set(subtreeIds);
        const next = allCats.filter((c) => !removeIds.has(c.id));
        saveCategories(next);
        const valid = new Set(next.map((c) => c.id));
        const prompts = loadPromptsRaw().map(normalizePrompt).map((p) => {
            if (p.categoryId && !valid.has(String(p.categoryId))) return { ...p, categoryId: null, updatedAt: Date.now() };
            return p;
        });
        saveAllPrompts(prompts);
        const prevFav = loadFavoriteCategoryIds();
        const fav = prevFav.filter((fid) => !removeIds.has(String(fid)));
        if (fav.length !== prevFav.length) saveFavoriteCategoryIds(fav);
        if (removeIds.has(String(_phState.catId || ''))) _phState.catId = '';
        removeIds.forEach((rid) => {
            if (_phState.catExpanded && rid in _phState.catExpanded) delete _phState.catExpanded[rid];
        });
        try {
            const g = window.SMCPromptLibrary._getCpbPhState?.();
            if (g && (removeIds.has(String(g.catId || '')))) g.catId = '';
            if (g && g.catExpanded) {
                removeIds.forEach((rid) => { if (rid in g.catExpanded) delete g.catExpanded[rid]; });
            }
        } catch (e2) { /* ignore */ }
        if (_phCatQuick.targetId && removeIds.has(_phCatQuick.targetId)) closePhCatQuick();
        return true;
    }

    function reorderRootBefore(dragId, beforeId) {
        const list = loadCategories();
        if (dragId === beforeId) return;
        const drag = list.find((c) => c.id === dragId && !c.parentId);
        const before = list.find((c) => c.id === beforeId && !c.parentId);
        if (!drag || !before) return;
        const roots = list.filter((c) => !c.parentId);
        const order = roots.filter((c) => c.id !== dragId);
        const idx = order.findIndex((c) => c.id === beforeId);
        if (idx < 0) return;
        order.splice(idx, 0, drag);
        const next = [];
        order.forEach((r) => {
            next.push(r);
            list.filter((c) => c.parentId === r.id).forEach((ch) => next.push(ch));
        });
        saveCategories(next);
    }

    function reparentCategory(childId, newParentRootId) {
        const list = loadCategories();
        const ch = list.find((c) => c.id === childId);
        const root = list.find((c) => c.id === newParentRootId && !c.parentId);
        if (!ch || !ch.parentId || !root) return;
        ch.parentId = newParentRootId;
        saveCategories(list);
    }

    function assignPromptsToCategory(ids, catVal) {
        const all = loadPromptsRaw().map(normalizePrompt);
        all.forEach((p) => {
            if (ids.includes(p.id)) {
                p.categoryId = !catVal || catVal === '__uncat__' || catVal === '' ? null : catVal;
                p.updatedAt = Date.now();
            }
        });
        saveAllPrompts(all);
    }

    const PH_SVG = {
        viewTable: '<svg class="ph-ic" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18M3 12h18M3 18h18"/></svg>',
        viewPreview: '<svg class="ph-ic" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>',
        edit: '<svg class="ph-ic" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>',
        copy: '<svg class="ph-ic" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>',
        dup: '<svg class="ph-ic" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="11" height="14" rx="2"/><rect x="8" y="3" width="11" height="14" rx="2"/><path d="M12 10v4M10 12h4"/></svg>',
        run: '<svg class="ph-ic" viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>',
        del: '<svg class="ph-ic" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14zM10 11v6M14 11v6"/></svg>',
    };

    function phRowActions(pid) {
        const id = escapeHtml(pid);
        return `<span class="ph-action-btns">
            <button type="button" class="ph-icon-btn" data-act="edit" data-pid="${id}" title="Edit" aria-label="Edit">${PH_SVG.edit}</button>
            <button type="button" class="ph-icon-btn" data-act="copy" data-pid="${id}" title="Copy content" aria-label="Copy content">${PH_SVG.copy}</button>
            <button type="button" class="ph-icon-btn" data-act="dup" data-pid="${id}" title="Duplicate" aria-label="Duplicate">${PH_SVG.dup}</button>
            <button type="button" class="ph-icon-btn" data-act="run" data-pid="${id}" title="Insert in main prompt" aria-label="Insert in main prompt">${PH_SVG.run}</button>
            <button type="button" class="ph-icon-btn ph-icon-btn-delete" data-act="del" data-pid="${id}" title="Delete" aria-label="Delete">${PH_SVG.del}</button>
        </span>`;
    }

    function parseTagsInput(str) {
        return String(str || '')
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
    }

    function normalizePrompt(p) {
        const cid = p.categoryId;
        const categoryId = cid == null || cid === '' ? null : String(cid);
        return {
            id: p.id,
            title: p.title || '',
            content: p.content || '',
            localVars: Array.isArray(p.localVars) ? p.localVars : [],
            createdAt: p.createdAt ?? Date.now(),
            updatedAt: p.updatedAt ?? Date.now(),
            lastUsedAt: p.lastUsedAt ?? Date.now(),
            categoryId,
            tags: Array.isArray(p.tags) ? p.tags : [],
            summary: p.summary || '',
            favorite: !!p.favorite,
        };
    }

    /** All category ids in the subtree rooted at catId (including catId). */
    function collectSubtreeCategoryIds(catId, list) {
        const root = String(catId || '');
        if (!root) return [];
        const ids = [root];
        list.filter((c) => c.parentId === root).forEach((ch) => {
            ids.push(...collectSubtreeCategoryIds(ch.id, list));
        });
        return ids;
    }

    function saveAllPrompts(prompts) {
        localStorage.setItem(LS_PROMPTS, JSON.stringify(prompts));
        try { window.electronAPI?.saveCustomPrompts?.(prompts); } catch (e) { }
        window.dispatchEvent(new CustomEvent('smc:prompt-library-changed'));
    }

    /** Direct counts per category id; uncat + all totals (all prompts in library). */
    function computeCategoryPromptCounts() {
        const prompts = loadPromptsRaw().map(normalizePrompt);
        const all = prompts.length;
        let uncat = 0;
        const direct = {};
        prompts.forEach((p) => {
            if (!p.categoryId) {
                uncat += 1;
                return;
            }
            const id = String(p.categoryId);
            direct[id] = (direct[id] || 0) + 1;
        });
        return { all, uncat, direct };
    }

    /** Total prompts in this category and all descendants (folder aggregate; Explorer-style). */
    function subtreePromptCount(categoryId, cats, direct) {
        let n = direct[categoryId] || 0;
        cats.filter((c) => c.parentId === categoryId).forEach((ch) => {
            n += subtreePromptCount(ch.id, cats, direct);
        });
        return n;
    }

    const TREE_ICONS = {
        folder: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>',
        folderOpen: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2v1"/><path d="M2 10l2.4 9.6a1 1 0 001 .4h13.2a1 1 0 001-.8L22 10H2z"/></svg>',
        file: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
        add: '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
        rename: '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>',
        del: '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14z"/></svg>',
    };

    /** Category row label + count with NBSP before "(" for stable spacing; ellipsis on .ph-tree-label-text (CSS). */
    function phTreeCatItemButton(opts) {
        const {
            labelText, count, catVal, active, isChild, dropRoot,
        } = opts;
        const label = escapeHtml(labelText);
        const n = Number(count) || 0;
        const title = escapeHtml(`${labelText} (${n})`);
        const catAttr = escapeHtml(catVal == null ? '' : String(catVal));
        const cls = ['ph-cat-item', isChild ? 'ph-cat-child' : '', active ? 'active' : ''].filter(Boolean).join(' ');
        const dropR = dropRoot ? ' data-ph-drop-root="1"' : '';
        return `<button type="button" class="${cls}" data-cat="${catAttr}" data-ph-drop-cat="${catAttr}"${dropR} title="${title}"><span class="ph-tree-label-text">${label}</span><span class="ph-tree-count">\u00a0(${n})</span></button>`;
    }

    function buildCategoryTreeDndHtml(cats, uiState) {
        const S = uiState || _phState;
        const { all, uncat, direct } = computeCategoryPromptCounts();
        const roots = cats.filter((c) => !c.parentId);
        const underAllOpen = S.allUnderAllExpanded !== false;
        let html = `<div class="ph-cat-dnd-tree">`;
        html += `<div class="ph-tree-row ph-tree-row-fixed ph-tree-all-row">`;
        html += `<button type="button" class="ph-tree-chev ph-tree-chev-all" aria-label="Toggle categories under All">${underAllOpen ? '▾' : '▸'}</button>`;
        html += `<span class="ph-tree-icon">${TREE_ICONS.folder}</span>`;
        html += phTreeCatItemButton({
            labelText: 'All',
            count: all,
            catVal: '',
            active: !S.catId,
            isChild: false,
            dropRoot: false,
        });
        html += `</div>`;
        html += `<div class="ph-tree-under-all${underAllOpen ? '' : ' ph-tree-under-all--collapsed'}">`;
        roots.forEach((r) => {
            const open = S.catExpanded[r.id] !== false;
            const kids = cats.filter((c) => c.parentId === r.id);
            const icon = open ? TREE_ICONS.folderOpen : TREE_ICONS.folder;
            const rootTotal = subtreePromptCount(r.id, cats, direct);
            const isRootEditing = _phCatQuick.mode === 'rename' && _phCatQuick.targetId === r.id;
            const rootLabel = isRootEditing
                ? `<input type="text" class="ph-tree-inline-input" data-tree-inline-input data-tree-id="${escapeHtml(r.id)}" value="${escapeHtml(r.name)}" />`
                : phTreeCatItemButton({
                    labelText: r.name,
                    count: rootTotal,
                    catVal: r.id,
                    active: S.catId === r.id,
                    isChild: false,
                    dropRoot: true,
                });
            html += `<div class="ph-tree-node" data-tree-root="${escapeHtml(r.id)}">`;
            html += `<div class="ph-tree-row" draggable="true" data-ph-dnd-cat="${escapeHtml(r.id)}" data-ph-dnd-root="1">`;
            html += `<button type="button" class="ph-tree-chev" aria-label="Toggle">${open ? '▾' : '▸'}</button>`;
            html += `<span class="ph-tree-icon">${icon}</span>`;
            html += rootLabel;
            html += `<span class="ph-tree-actions">`;
            html += `<button type="button" class="ph-tree-act" draggable="false" data-tree-act="add-sub" data-tree-id="${escapeHtml(r.id)}" title="Add subcategory">${TREE_ICONS.add}</button>`;
            html += `<button type="button" class="ph-tree-act" draggable="false" data-tree-act="rename" data-tree-id="${escapeHtml(r.id)}" title="Rename">${TREE_ICONS.rename}</button>`;
            html += `<button type="button" class="ph-tree-act ph-tree-act-del" draggable="false" data-tree-act="delete" data-tree-id="${escapeHtml(r.id)}" title="Delete">${TREE_ICONS.del}</button>`;
            html += `</span></div>`;
            if (open) {
                html += `<div class="ph-tree-children">`;
                kids.forEach((ch) => {
                    const subN = direct[ch.id] || 0;
                    const isSubEditing = _phCatQuick.mode === 'rename' && _phCatQuick.targetId === ch.id;
                    const subLabel = isSubEditing
                        ? `<input type="text" class="ph-tree-inline-input" data-tree-inline-input data-tree-id="${escapeHtml(ch.id)}" value="${escapeHtml(ch.name)}" />`
                        : phTreeCatItemButton({
                            labelText: ch.name,
                            count: subN,
                            catVal: ch.id,
                            active: S.catId === ch.id,
                            isChild: true,
                            dropRoot: false,
                        });
                    html += `<div class="ph-tree-row ph-tree-row-child" draggable="true" data-ph-dnd-cat="${escapeHtml(ch.id)}" data-ph-dnd-root="0">`;
                    html += `<span class="ph-tree-icon">${TREE_ICONS.file}</span>`;
                    html += subLabel;
                    html += `<span class="ph-tree-actions">`;
                    html += `<button type="button" class="ph-tree-act" draggable="false" data-tree-act="rename" data-tree-id="${escapeHtml(ch.id)}" title="Rename">${TREE_ICONS.rename}</button>`;
                    html += `<button type="button" class="ph-tree-act ph-tree-act-del" draggable="false" data-tree-act="delete" data-tree-id="${escapeHtml(ch.id)}" title="Delete">${TREE_ICONS.del}</button>`;
                    html += `</span></div>`;
                });
                html += `</div>`;
            }
            html += `</div>`;
        });
        html += `</div>`;
        html += `<div class="ph-tree-row ph-tree-row-fixed ph-tree-uncat-row"><span class="ph-tree-icon">${TREE_ICONS.file}</span>`;
        html += phTreeCatItemButton({
            labelText: window.SMCPromptLibrary.uncategorizedLabel,
            count: uncat,
            catVal: '__uncat__',
            active: S.catId === '__uncat__',
            isChild: false,
            dropRoot: false,
        });
        html += `</div>`;
        html += `</div>`;
        return html;
    }

    /** Shared Prompt Hub / CPB sidebar filtering. */
    function filterPromptBySidebarState(p, cats, state) {
        const tagLower = (state.tagQ || '').trim().toLowerCase();
        const tq = (state.titleQ || '').trim().toLowerCase();
        if (tq) {
            const t = String(p.title || '').toLowerCase();
            if (!t.includes(tq)) return false;
        }
        if (state.catId === '__uncat__') {
            if (p.categoryId) return false;
        } else if (state.catId) {
            if (p.categoryId !== state.catId) {
                const ch = cats.find((c) => c.id === p.categoryId);
                if (!ch || ch.parentId !== state.catId) return false;
            }
        }
        if (tagLower) {
            const tags = (p.tags || []).map((x) => String(x).toLowerCase());
            if (!tags.some((t) => t.includes(tagLower))) return false;
        }
        if (state.favoritesOnly && !p.favorite) return false;
        return true;
    }

    /** Filter + sort prompts using _phState (does not touch the DOM). */
    function getFilteredPromptsForHub() {
        const cats = loadCategories();
        const prompts = loadPromptsRaw().map(normalizePrompt);
        const filtered = prompts.filter((p) => filterPromptBySidebarState(p, cats, _phState));
        const col = _phState.sortCol || 'updatedAt';
        const dir = _phState.sortDir === 'asc' ? 1 : -1;
        filtered.sort((a, b) => {
            let cmp = 0;
            if (col === 'favorite') {
                cmp = (b.favorite ? 1 : 0) - (a.favorite ? 1 : 0);
                if (cmp === 0) cmp = (b.updatedAt || 0) - (a.updatedAt || 0);
                return cmp;
            }
            if (col === 'title') {
                cmp = (a.title || '').localeCompare(b.title || '', undefined, { sensitivity: 'base' });
            } else if (col === 'category') {
                const ca = phCatLabel(a, cats);
                const cb = phCatLabel(b, cats);
                cmp = ca.localeCompare(cb, undefined, { sensitivity: 'base' });
            } else {
                cmp = (a.updatedAt || 0) - (b.updatedAt || 0);
            }
            return cmp * dir;
        });
        return { filtered, cats };
    }

    function buildFavoriteCategoriesHtml(cats) {
        const favCats = loadFavoriteCategoryIds();
        const prompts = loadPromptsRaw().map(normalizePrompt);
        const roots = cats.filter((c) => !c.parentId);
        const chunks = [];
        roots.forEach((r) => {
            const sub = cats.filter((c) => c.parentId === r.id);
            const subtreeIds = new Set([r.id, ...sub.map((s) => s.id)]);
            const showRootBlock = prompts.some((p) => p.favorite && p.categoryId && subtreeIds.has(String(p.categoryId)));
            if (!showRootBlock) return;
            const checked = favCats.includes(r.id) ? 'checked' : '';
            let h = `<label class="ph-fav-row"><input type="checkbox" class="ph-fav-root" data-cid="${escapeHtml(r.id)}" ${checked}/> ${escapeHtml(r.name)} (whole tree)</label>`;
            sub.forEach((ch) => {
                const showSub = prompts.some((p) => p.favorite && String(p.categoryId) === ch.id);
                if (!showSub) return;
                const c2 = favCats.includes(ch.id) ? 'checked' : '';
                h += `<label class="ph-fav-row ph-fav-sub"><input type="checkbox" class="ph-fav-ch" data-cid="${escapeHtml(ch.id)}" ${c2}/> ${escapeHtml(ch.name)}</label>`;
            });
            chunks.push(h);
        });
        return chunks.length ? chunks.join('') : '<span class="ph-muted">No starred prompts in categories yet</span>';
    }

    /** Persistent bulk bar DOM (buttons always present); visibility via `.ph-bulk-bar--visible` + syncPhBulkBar. */
    function buildBulkSlotHtml() {
        const n = _phState.selected.size;
        const vis = n > 0 ? ' ph-bulk-bar--visible' : '';
        return `<div class="ph-bulk-slot-inner">
            <div id="ph-bulk-bar-panel" class="ph-bulk-bar ph-bulk-bar--collapsible${vis}" aria-hidden="${n === 0 ? 'true' : 'false'}">
                <span class="ph-bulk-count" id="ph-bulk-count">${n} selected</span>
                <button type="button" class="btn-secondary ph-bulk-btn" id="ph-bulk-select-all">Select All</button>
                <button type="button" class="btn-secondary ph-bulk-btn" id="ph-bulk-deselect">Deselect</button>
                <button type="button" class="btn-danger ph-bulk-btn ph-bulk-delete" id="ph-bulk-delete">Delete Selected</button>
            </div>
        </div>`;
    }

    function syncPhBulkBar(root) {
        const panel = root.querySelector('#ph-bulk-bar-panel');
        const countEl = root.querySelector('#ph-bulk-count');
        if (!panel || !countEl) return;
        const n = _phState.selected.size;
        countEl.textContent = `${n} selected`;
        panel.classList.toggle('ph-bulk-bar--visible', n > 0);
        panel.setAttribute('aria-hidden', n === 0 ? 'true' : 'false');
    }

    function syncPhListSelectionDom(root) {
        const listHost = root.querySelector('#ph-list-host');
        if (!listHost) return;
        if (_phState.view === 'table') {
            listHost.querySelectorAll('.ph-row-chk').forEach((c) => {
                const id = c.getAttribute('data-pid');
                if (id) c.checked = _phState.selected.has(id);
            });
        } else {
            listHost.querySelectorAll('.ph-card').forEach((card) => {
                const pid = card.getAttribute('data-pid');
                const c = card.querySelector('.ph-row-chk');
                if (c && pid) c.checked = _phState.selected.has(pid);
                if (pid) card.classList.toggle('ph-card-selected', _phState.selected.has(pid));
            });
        }
    }

    function updatePhSelectionUi(root) {
        syncPhBulkBar(root);
        syncPhListSelectionDom(root);
    }

    function phGetHubRoot() {
        return document.getElementById('prompt-hub-root');
    }

    /** After prompt data changes (fav/dup/del); avoids full panel innerHTML when hub is mounted. */
    function phRefreshListAfterDataChange() {
        const r = phGetHubRoot();
        if (r) renderPromptHubListOnly(r);
        else renderPromptHub();
    }

    /** Re-render list + bulk bar only; keeps filter inputs mounted (fixes Korean IME). */
    function renderPromptHubListOnly(root) {
        if (!root) return;
        const listHost = root.querySelector('#ph-list-host');
        if (!listHost) return;
        const { filtered, cats } = getFilteredPromptsForHub();
        const favCats = loadFavoriteCategoryIds();
        const wMap = loadTableColWidths();
        const bulkSlot = root.querySelector('#ph-bulk-slot');
        if (bulkSlot) {
            if (!bulkSlot.querySelector('#ph-bulk-bar-panel')) {
                bulkSlot.innerHTML = buildBulkSlotHtml();
            } else {
                syncPhBulkBar(root);
            }
        }
        renderPhListIntoHost(root, listHost, filtered, cats, favCats, wMap);
        wirePhListHandlers(root);
    }

    function sortArrow(col) {
        if (_phState.sortCol !== col) return '';
        return _phState.sortDir === 'asc' ? ' ▲' : ' ▼';
    }

    let _phGridInstance = null;

    function phCatLabel(p, cats) {
        const uncategorized = window.SMCPromptLibrary.uncategorizedLabel;
        const cid = p.categoryId;
        if (!cid) return uncategorized;
        const c = cats.find((x) => x.id === cid);
        if (!c) return uncategorized;
        if (c.parentId) {
            const parent = cats.find((x) => x.id === c.parentId);
            return parent ? `${parent.name} / ${c.name}` : c.name;
        }
        return c.name;
    }

    function buildPhGridTableModel(filtered, cats) {
        const tipCell = (cell, row, getFull) => {
            const pid = String(row.cells[0]?.data ?? '');
            const pr = filtered.find((x) => x.id === pid);
            const full = pr ? getFull(pr) : String(cell ?? '');
            const disp = escapeHtml(String(cell ?? ''));
            return gridjs.html(`<span class="smc-grid-cell-tooltip" title="${escapeHtml(full)}">${disp}</span>`);
        };
        const data = filtered.map((p) => [
            p.id,
            p.id,
            p.title || '(Untitled)',
            previewOf(p.summary || p.content, 60),
            phCatLabel(p, cats),
            p.id
        ]);
        const favActive = _phState.favoritesOnly ? ' smc-grid-fav-active' : '';
        const wMap = loadTableColWidths();
        const columns = [
            { id: 'chk', name: '', width: '40px', sort: false, resizable: false,
              formatter: (pid) => gridjs.html(`<input type="checkbox" class="ph-row-chk" data-pid="${escapeHtml(pid)}" ${_phState.selected.has(pid) ? 'checked' : ''} />`)
            },
            { id: 'fav', name: gridjs.html(`<span class="smc-grid-fav-hdr${favActive}">★</span>`), width: '40px', sort: false, resizable: false,
              formatter: (pid) => {
                  const pr = filtered.find(x => x.id === pid);
                  const cls = pr && pr.favorite ? 'ph-star-btn is-fav' : 'ph-star-btn';
                  return gridjs.html(`<button type="button" class="${cls}" data-ph-fav="${escapeHtml(pid)}" title="Favorite">★</button>`);
              }
            },
            { id: 'title', name: 'Title', width: `${wMap.title}px`, sort: true, resizable: true,
              formatter: (cell, row) => tipCell(cell, row, (p) => p.title || '(Untitled)'),
            },
            { id: 'summary', name: 'Summary / preview', width: `${wMap.summary}px`, sort: false, resizable: true,
              formatter: (cell, row) => tipCell(cell, row, (p) => String(p.summary || p.content || '')),
            },
            { id: 'category', name: 'Category', width: `${wMap.category}px`, sort: true, resizable: true,
              formatter: (cell, row) => tipCell(cell, row, (p) => phCatLabel(p, cats)),
            },
            { id: 'actions', name: 'Actions', width: '188px', sort: false, resizable: false,
              formatter: (pid) => gridjs.html(`<span class="smc-grid-actions">${phRowActions(pid)}</span>`)
            }
        ];
        return { data, columns, wMap };
    }

    function renderPhGridTable(host, filtered, cats) {
        if (!Array.isArray(filtered) || filtered.length === 0) {
            destroyPhGrid();
            host.innerHTML = [
                '<div class="smc-empty-state-wrap">',
                '  <div class="smc-empty-state" role="status" aria-live="polite">',
                '    <div class="smc-empty-state-icon" aria-hidden="true">🔎</div>',
                '    <div class="smc-empty-state-title">No prompts found</div>',
                '    <div class="smc-empty-state-desc">No prompts match the current filters. Try clearing filters, changing categories, or creating a new prompt.</div>',
                '  </div>',
                '</div>'
            ].join('');
            return;
        }
        const { data, columns, wMap } = buildPhGridTableModel(filtered, cats);
        const canSoft =
            _phGridInstance &&
            host &&
            host.querySelector('.gridjs-container');
        if (canSoft) {
            try {
                _phGridInstance.updateConfig({ data, columns });
                _phGridInstance.forceRender();
                requestAnimationFrame(() => {
                    applyPhGridColumnClasses(host);
                    wireGridjsResizePersist(host, wMap, saveTableColWidths);
                });
                return;
            } catch (err) {
                /* fall through to full rebuild */
            }
        }
        if (_phGridInstance) {
            destroyPhGrid();
        }
        host.innerHTML = '';
        _phGridInstance = new gridjs.Grid({
            columns,
            data,
            sort: true,
            resizable: true,
            className: { container: 'smc-gridjs' },
            autoWidth: false,
            language: { noRecordsFound: 'No prompts found' }
        }).render(host);

        requestAnimationFrame(() => {
            phGridPostRender(host, filtered);
            wireGridjsResizePersist(host, wMap, saveTableColWidths);
        });
    }

    function phGridPostRender(host, filtered) {
        applyPhGridColumnClasses(host);
        /* Wire event delegation on the grid container */
        if (host.dataset.phGridBound) return;
        host.dataset.phGridBound = '1';
        host.addEventListener('click', (ev) => {
            /* Favorite toggle */
            const favBtn = ev.target.closest('[data-ph-fav]');
            if (favBtn) {
                ev.stopPropagation();
                ev.preventDefault();
                const pid = favBtn.getAttribute('data-ph-fav');
                const all = loadPromptsRaw().map(normalizePrompt);
                const p = all.find((x) => x.id === pid);
                if (!p) return;
                p.favorite = !p.favorite;
                p.updatedAt = Date.now();
                saveAllPrompts(all);
                phToast(p.favorite ? 'Added to favorites' : 'Removed from favorites');
                phRefreshListAfterDataChange();
                return;
            }
            /* Action buttons */
            const actBtn = ev.target.closest('[data-act]');
            if (actBtn) {
                ev.stopPropagation();
                const act = actBtn.getAttribute('data-act');
                const pid = actBtn.getAttribute('data-pid');
                const p = loadPromptsRaw().map(normalizePrompt).find((x) => x.id === pid);
                if (!p) return;
                if (act === 'edit') {
                    if (window.openCustomPromptBuilderForIdEdit) window.openCustomPromptBuilderForIdEdit(pid);
                    else if (window.openCustomPromptBuilderForId) window.openCustomPromptBuilderForId(pid);
                } else if (act === 'copy') {
                    navigator.clipboard.writeText(p.content || '').then(() => phToast('Copied to clipboard')).catch(() => phToast('Copy failed'));
                } else if (act === 'dup') {
                    const copy = { ...p, id: uid(), title: (p.title || 'Untitled') + ' (copy)', updatedAt: Date.now(), createdAt: Date.now() };
                    const all = loadPromptsRaw().map(normalizePrompt);
                    all.unshift(copy);
                    saveAllPrompts(all);
                    phToast('Prompt duplicated');
                    phRefreshListAfterDataChange();
                } else if (act === 'del') {
                    showSmcConfirmModal({
                        title: 'Delete Prompt',
                        message: `Delete ${JSON.stringify(p.title || 'Untitled')}?\nThis action cannot be undone.`,
                        confirmText: 'Delete',
                        cancelText: 'Cancel',
                        danger: true,
                    }, (ok) => {
                        if (!ok) return;
                        const all = loadPromptsRaw().map(normalizePrompt).filter((x) => x.id !== pid);
                        saveAllPrompts(all);
                        _phState.selected.delete(pid);
                        phRefreshListAfterDataChange();
                    });
                } else if (act === 'run') {
                    const ta = document.getElementById('master-input');
                    if (ta) {
                        ta.value = p.content || '';
                        ta.dispatchEvent(new Event('input', { bubbles: true }));
                        ta.focus();
                    }
                    if (typeof window.closeSmcFullPanels === 'function') window.closeSmcFullPanels();
                }
                return;
            }
        });
        host.addEventListener('dblclick', (ev) => {
            if (ev.target.closest('button, input, a')) return;
            const row = ev.target.closest('.gridjs-tr');
            if (!row) return;
            const pidCell = row.querySelector('.smc-grid-col-chk input[data-pid]');
            if (!pidCell) return;
            const pid = pidCell.getAttribute('data-pid');
            if (window.openCustomPromptBuilderForIdEdit) window.openCustomPromptBuilderForIdEdit(pid);
            else if (window.openCustomPromptBuilderForId) window.openCustomPromptBuilderForId(pid);
        });
    }

    function applyPhGridColumnClasses(host) {
        const map = {
            chk: 'smc-grid-col-chk',
            fav: 'smc-grid-col-fav',
            title: 'smc-grid-col-title',
            summary: 'smc-grid-col-summary',
            category: 'smc-grid-col-category',
            actions: 'smc-grid-col-actions',
        };
        Object.entries(map).forEach(([colId, cls]) => {
            host.querySelectorAll(`th[data-column-id="${colId}"], td[data-column-id="${colId}"]`).forEach((el) => {
                el.classList.add(cls);
            });
        });
    }

    function destroyPhGrid() {
        if (_phGridInstance) {
            try { _phGridInstance.destroy(); } catch (_) {}
            _phGridInstance = null;
        }
    }

    /** Persist Grid.js column widths after user drag-resizes a column. */
    function wireGridjsResizePersist(host, wMap, saveFn) {
        const COL_MAP = ['chk', 'fav', 'title', 'summary', 'category', 'actions'];
        const RESIZABLE = new Set(['title', 'summary', 'category']);
        const MIN_W = 96;
        const MAX_W = 1200;
        const RESIZE_DEBUG = false;
        const dbg = (...args) => { if (RESIZE_DEBUG) console.log('[PH_GRID_RESIZE]', ...args); };
        const captureWidths = () => {
            const ths = host.querySelectorAll('th[data-column-id]');
            ths.forEach((th, i) => {
                const colName = COL_MAP[i];
                if (colName && RESIZABLE.has(colName)) {
                    const w = Math.round(th.getBoundingClientRect().width);
                    if (w > 0) wMap[colName] = w;
                }
            });
            dbg('captureWidths', { ...wMap });
            saveFn(wMap);
        };
        const ensureManualHandles = () => {
            host.querySelectorAll('th[data-column-id]').forEach((th, i) => {
                const colName = COL_MAP[i];
                if (!colName || !RESIZABLE.has(colName)) return;
                if (th.querySelector('.gridjs-resizable, .smc-col-resize-handle')) return;
                const manual = document.createElement('div');
                manual.className = 'smc-col-resize-handle';
                manual.setAttribute('data-col', colName);
                th.appendChild(manual);
            });
        };
        const bindHandles = () => {
            const handles = host.querySelectorAll('.gridjs-resizable, .smc-col-resize-handle');
            dbg('bind handles', handles.length);
            handles.forEach((handle) => {
            if (handle.dataset.phResizeBound) return;
            handle.dataset.phResizeBound = '1';
            handle.addEventListener('mousedown', (ev) => {
                ev.preventDefault();
                ev.stopPropagation();
                const th = handle.closest('th');
                if (!th) return;
                const ths = Array.from(host.querySelectorAll('th[data-column-id]'));
                const idx = ths.indexOf(th);
                const colName = COL_MAP[idx];
                dbg('mousedown', { idx, colName, x: ev.clientX });
                if (!colName || !RESIZABLE.has(colName)) return;
                const startX = ev.clientX;
                const startW = Math.round(th.getBoundingClientRect().width) || 0;
                const onMove = (mv) => {
                    const next = Math.max(MIN_W, Math.min(MAX_W, startW + (mv.clientX - startX)));
                    th.style.width = `${next}px`;
                    dbg('mousemove', { colName, x: mv.clientX, width: next });
                };
                const onUp = () => {
                    document.removeEventListener('mousemove', onMove);
                    document.removeEventListener('mouseup', onUp);
                    dbg('mouseup', { colName });
                    requestAnimationFrame(() => {
                        captureWidths();
                    });
                };
                document.addEventListener('mousemove', onMove);
                document.addEventListener('mouseup', onUp);
            });
            handle.addEventListener('mouseup', () => {
                dbg('handle mouseup');
                requestAnimationFrame(() => {
                    captureWidths();
                });
            });
            handle.addEventListener('pointerup', () => {
                dbg('handle pointerup');
                requestAnimationFrame(() => {
                    captureWidths();
                });
            });
            });
            return handles.length;
        };
        let retries = 0;
        const bindWhenReady = () => {
            const thCount = host.querySelectorAll('th[data-column-id]').length;
            dbg('header count', thCount, 'retry', retries);
            if (thCount > 0) {
                ensureManualHandles();
                const bound = bindHandles();
                if (bound > 0) return;
            }
            if (retries >= 20) return;
            retries += 1;
            requestAnimationFrame(bindWhenReady);
        };
        bindWhenReady();
        /* Also capture via document-level mouseup for when cursor leaves the handle */
        if (!host.dataset.phResizeDocBound) {
            host.dataset.phResizeDocBound = '1';
            let resizing = false;
            host.addEventListener('mousedown', (ev) => {
                if (ev.target.closest('.gridjs-resizable')) resizing = true;
            });
            host.addEventListener('pointerdown', (ev) => {
                if (ev.target.closest('.gridjs-resizable')) resizing = true;
            });
            document.addEventListener('mouseup', () => {
                if (!resizing) return;
                resizing = false;
                requestAnimationFrame(() => {
                    captureWidths();
                });
            });
            document.addEventListener('pointerup', () => {
                if (!resizing) return;
                resizing = false;
                requestAnimationFrame(() => {
                    captureWidths();
                });
            });
        }
    }

    function renderPhListIntoHost(root, host, filtered, cats, favCats, wMap) {
        if (!host) return;
        if (_phState.view === 'table') {
            renderPhGridTable(host, filtered, cats);
        } else {
            destroyPhGrid();
            host.dataset.phGridBound = '';
            host.innerHTML = `<div class="ph-cards">${filtered.map((p) => {
                const chk = _phState.selected.has(p.id) ? 'checked' : '';
                const rowSel = _phState.selected.has(p.id) ? ' ph-card-selected' : '';
                const favOn = !!p.favorite;
                const favCls = favOn ? 'ph-star-btn is-fav' : 'ph-star-btn';
                return `<div class="ph-card${rowSel}" data-pid="${escapeHtml(p.id)}" draggable="true">
                    <div class="ph-card-head">
                        <div class="ph-card-head-main">
                            <div class="ph-card-head-left">
                                <input type="checkbox" class="ph-row-chk" data-pid="${escapeHtml(p.id)}" ${chk} />
                                <button type="button" class="${favCls}" data-ph-fav="${escapeHtml(p.id)}" title="Favorite" aria-label="Favorite">★</button>
                                <span class="ph-card-title">${escapeHtml(p.title || '(Untitled)')}</span>
                            </div>
                            <div class="ph-card-head-actions">${phRowActions(p.id)}</div>
                        </div>
                    </div>
                    <div class="ph-card-body-resizable" title="Drag corner to resize height">
                        <div class="ph-card-sum ph-muted ph-card-sum-body">${escapeHtml(String(p.content || '').trim() !== '' ? String(p.content) : String(p.summary || ''))}</div>
                    </div>
                </div>`;
            }).join('') || [
                '<div class="smc-empty-state-wrap">',
                '  <div class="smc-empty-state" role="status" aria-live="polite">',
                '    <div class="smc-empty-state-icon" aria-hidden="true">🔎</div>',
                '    <div class="smc-empty-state-title">No prompts found</div>',
                '    <div class="smc-empty-state-desc">No prompts match the current filters. Try clearing filters, changing categories, or creating a new prompt.</div>',
                '  </div>',
                '</div>'
            ].join('')}</div>`;
        }
    }

    function wirePhListHandlers(root) {
        root.querySelectorAll('[data-ph-fav]').forEach((btn) => {
            if (btn.dataset.phListBound) return;
            btn.dataset.phListBound = '1';
            btn.addEventListener('click', (ev) => {
                ev.stopPropagation();
                ev.preventDefault();
                const pid = btn.getAttribute('data-ph-fav');
                const all = loadPromptsRaw().map(normalizePrompt);
                const p = all.find((x) => x.id === pid);
                if (!p) return;
                p.favorite = !p.favorite;
                p.updatedAt = Date.now();
                saveAllPrompts(all);
                phToast(p.favorite ? 'Added to favorites' : 'Removed from favorites');
                phRefreshListAfterDataChange();
            });
        });

        root.querySelectorAll('[data-act]').forEach((btn) => {
            if (btn.dataset.phListBound) return;
            btn.dataset.phListBound = '1';
            btn.addEventListener('click', (ev) => {
                ev.stopPropagation();
                const act = btn.getAttribute('data-act');
                const pid = btn.getAttribute('data-pid');
                const p = loadPromptsRaw().map(normalizePrompt).find((x) => x.id === pid);
                if (!p) return;
                if (act === 'edit') {
                    if (window.openCustomPromptBuilderForIdEdit) window.openCustomPromptBuilderForIdEdit(pid);
                    else if (window.openCustomPromptBuilderForId) window.openCustomPromptBuilderForId(pid);
                } else if (act === 'copy') {
                    navigator.clipboard.writeText(p.content || '').then(() => phToast('Copied to clipboard')).catch(() => phToast('Copy failed'));
                } else if (act === 'dup') {
                    const copy = { ...p, id: uid(), title: (p.title || 'Untitled') + ' (copy)', updatedAt: Date.now(), createdAt: Date.now() };
                    const all = loadPromptsRaw().map(normalizePrompt);
                    all.unshift(copy);
                    saveAllPrompts(all);
                    phToast('Prompt duplicated');
                    phRefreshListAfterDataChange();
                } else if (act === 'del') {
                    showSmcConfirmModal({
                        title: 'Delete Prompt',
                        message: `Delete ${JSON.stringify(p.title || 'Untitled')}?\nThis action cannot be undone.`,
                        confirmText: 'Delete',
                        cancelText: 'Cancel',
                        danger: true,
                    }, (ok) => {
                        if (!ok) return;
                        const all = loadPromptsRaw().map(normalizePrompt).filter((x) => x.id !== pid);
                        saveAllPrompts(all);
                        _phState.selected.delete(pid);
                        phRefreshListAfterDataChange();
                    });
                } else if (act === 'run') {
                    const ta = document.getElementById('master-input');
                    if (ta) {
                        ta.value = p.content || '';
                        ta.dispatchEvent(new Event('input', { bubbles: true }));
                        ta.focus();
                    }
                    if (typeof window.closeSmcFullPanels === 'function') window.closeSmcFullPanels();
                }
            });
        });

        root.querySelectorAll('tr[data-pid], .ph-card[data-pid]').forEach((el) => {
            if (el.dataset.phDblBound) return;
            el.dataset.phDblBound = '1';
            el.addEventListener('dblclick', (ev) => {
                if (ev.target.closest('button, input, a')) return;
                const pid = el.getAttribute('data-pid');
                if (window.openCustomPromptBuilderForIdEdit) window.openCustomPromptBuilderForIdEdit(pid);
                else if (window.openCustomPromptBuilderForId) window.openCustomPromptBuilderForId(pid);
            });
        });
    }

    /** Delegated input on filter fields: update list without replacing inputs (IME-safe). */
    function ensurePhFilterListRefresh(root) {
        if (root.dataset.phFilterListDeleg === '1') return;
        root.dataset.phFilterListDeleg = '1';
        root.addEventListener('input', (e) => {
            const t = e.target;
            if (!t || (t.id !== 'ph-filter-title' && t.id !== 'ph-filter-tag')) return;
            if (t.id === 'ph-filter-title') _phState.titleQ = t.value;
            else _phState.tagQ = t.value;
            _phState.selected.clear();
            renderPromptHubListOnly(root);
        });
        root.addEventListener('change', (e) => {
            const t = e.target;
            if (!t || t.id !== 'ph-filter-favorites') return;
            _phState.favoritesOnly = !!t.checked;
            _phState.selected.clear();
            renderPromptHubListOnly(root);
        });
    }

    function closePhCatQuick() {
        _phCatQuick = { mode: 'idle', parentId: null, targetId: null, initialName: null, panel: 'hub' };
    }

    function startTreeInlineRename(panel, categoryId, initialName) {
        _phCatQuick = { mode: 'rename', parentId: null, targetId: categoryId, initialName: initialName || '', panel: panel || 'hub' };
    }

    function createCategoryAndStartInlineRename(parentId, panel) {
        const list = loadCategories();
        const id = uid();
        const name = parentId ? 'New Subcategory' : 'New Category';
        list.push({ id, name, parentId: parentId ? String(parentId) : null });
        saveCategories(list);
        if (parentId) {
            _phState.catExpanded[parentId] = true;
            try {
                const s = window.SMCPromptLibrary._getCpbPhState?.();
                if (s && s.catExpanded) s.catExpanded[parentId] = true;
            } catch (e) { /* ignore */ }
        }
        startTreeInlineRename(panel, id, name);
    }

    function commitTreeInlineRename(panel, categoryId, nextName) {
        const name = String(nextName || '').trim();
        if (!categoryId) return;
        const list = loadCategories();
        const cat = list.find((c) => c.id === categoryId);
        closePhCatQuick();
        if (!cat) {
            if (panel === 'cpb') window.SMCPromptLibrary._cpbPhRefresh?.();
            else renderPromptHub();
            return;
        }
        if (name && name !== cat.name) {
            cat.name = name;
            saveCategories(list);
        }
        if (panel === 'cpb') window.SMCPromptLibrary._cpbPhRefresh?.();
        else renderPromptHub();
    }

    function getPhCatQuickPanelRoot() {
        return _phCatQuick.panel === 'cpb'
            ? document.getElementById('cpb-ph-panel-root')
            : document.getElementById('prompt-hub-root');
    }

    function submitPhCatQuick() {
        const root = getPhCatQuickPanelRoot();
        if (!root) return;
        const form = root.querySelector('[data-ph-cat-quick-form]');
        const inp = form && form.querySelector('[data-ph-cat-quick-input]');
        const name = inp ? inp.value.trim() : '';
        if (!name) {
            phToast('Enter a category name');
            return;
        }
        const m = _phCatQuick;
        const whichPanel = m.panel || 'hub';
        if (m.mode === 'idle') return;
        if (m.mode === 'add-root') {
            const list = loadCategories();
            list.push({ id: uid(), name, parentId: null });
            saveCategories(list);
        } else if (m.mode === 'add-sub' && m.parentId) {
            const list = loadCategories();
            list.push({ id: uid(), name, parentId: String(m.parentId) });
            saveCategories(list);
            const st = whichPanel === 'cpb' ? window.SMCPromptLibrary._getCpbPhState?.() : _phState;
            if (st && st.catExpanded) st.catExpanded[m.parentId] = true;
            _phState.catExpanded[m.parentId] = true;
        } else if (m.mode === 'rename' && m.targetId) {
            const list = loadCategories();
            const cat = list.find((c) => c.id === m.targetId);
            if (!cat) {
                closePhCatQuick();
                if (whichPanel === 'cpb') window.SMCPromptLibrary._cpbPhRefresh?.();
                else renderPromptHub();
                return;
            }
            if (name === cat.name) {
                closePhCatQuick();
                if (whichPanel === 'cpb') window.SMCPromptLibrary._cpbPhRefresh?.();
                else renderPromptHub();
                return;
            }
            cat.name = name;
            saveCategories(list);
        }
        closePhCatQuick();
        if (whichPanel === 'cpb') window.SMCPromptLibrary._cpbPhRefresh?.();
        else renderPromptHub();
    }

    function finishPhCatQuickAfterRender(root) {
        if (!root || _phCatQuick.mode === 'idle') return;
        const form = root.querySelector('[data-ph-cat-quick-form]');
        const hint = form && form.querySelector('[data-ph-cat-quick-hint]');
        const inp = form && form.querySelector('[data-ph-cat-quick-input]');
        const apply = form && form.querySelector('[data-ph-cat-quick-apply]');
        if (!form || !hint || !inp || !apply) return;
        form.classList.remove('hidden');
        form.setAttribute('aria-hidden', 'false');
        const cats = loadCategories();
        const m = _phCatQuick;
        if (m.mode === 'add-root') {
            hint.textContent = 'New root category';
            apply.textContent = 'Add';
            inp.value = '';
        } else if (m.mode === 'add-sub') {
            const p = cats.find((c) => c.id === m.parentId);
            hint.textContent = p ? `New subcategory under "${p.name}"` : 'New subcategory';
            apply.textContent = 'Add';
            inp.value = '';
        } else if (m.mode === 'rename') {
            const c = cats.find((x) => x.id === m.targetId);
            hint.textContent = 'Rename category';
            apply.textContent = 'Save';
            inp.value = c ? c.name : '';
        }
        requestAnimationFrame(() => {
            inp.focus();
            if (m.mode === 'rename') inp.select();
        });
    }

    function ensurePhHubHandlers(root) {
        if (root.dataset.phHubBound) return;
        root.dataset.phHubBound = '1';
        root.addEventListener('click', (e) => {
            const chevAll = e.target.closest('.ph-tree-chev-all');
            if (chevAll && root.contains(chevAll)) {
                e.preventDefault();
                e.stopPropagation();
                const wasOpen = _phState.allUnderAllExpanded !== false;
                _phState.allUnderAllExpanded = !wasOpen;
                renderPromptHub();
                return;
            }

            const treeAct = e.target.closest('[data-tree-act]');
            const treeHost = root.querySelector('[data-ph-cat-tree-host]');
            if (treeAct && treeHost && treeHost.contains(treeAct)) {
                e.preventDefault();
                e.stopPropagation();
                const action = treeAct.getAttribute('data-tree-act');
                const id = treeAct.getAttribute('data-tree-id');
                if (!id) return;
                const allCats = loadCategories();
                if (action === 'add-sub') {
                    createCategoryAndStartInlineRename(id, 'hub');
                    renderPromptHub();
                    return;
                }
                if (action === 'rename') {
                    const cat = allCats.find((c) => c.id === id);
                    if (!cat) return;
                    startTreeInlineRename('hub', id, cat.name);
                    renderPromptHub();
                    return;
                }
                if (action === 'delete') {
                    const cat = allCats.find((c) => c.id === id);
                    if (!cat) return;
                    showSmcConfirmModal({
                        title: 'Delete category',
                        message: deleteCategoryConfirmMessage(cat.name),
                        confirmText: 'Delete',
                        cancelText: 'Cancel',
                        danger: true,
                    }, (ok) => {
                        if (!ok) return;
                        if (performCategoryDeleteById(id)) {
                            phToast('Category deleted');
                        } else {
                            phToast('Could not delete category (not found).');
                        }
                        renderPromptHub();
                    });
                    return;
                }
                return;
            }

            if (e.target.closest('.ph-tree-add-root-btn') && root.querySelector('.ph-tree-add-root-btn') && root.contains(e.target.closest('.ph-tree-add-root-btn'))) {
                e.preventDefault();
                createCategoryAndStartInlineRename(null, 'hub');
                renderPromptHub();
                return;
            }

            const chev = e.target.closest('.ph-tree-chev:not(.ph-tree-chev-all)');
            if (chev) {
                e.preventDefault();
                e.stopPropagation();
                const node = chev.closest('[data-tree-root]');
                const cid = node && node.getAttribute('data-tree-root');
                if (!cid) return;
                if (_phState.catExpanded[cid] === false) delete _phState.catExpanded[cid];
                else _phState.catExpanded[cid] = false;
                renderPromptHub();
            }
        });
        root.addEventListener('keydown', (e) => {
            if (e.target && e.target.matches('[data-tree-inline-input]')) {
                if (e.key === 'Escape') {
                    e.preventDefault();
                    closePhCatQuick();
                    renderPromptHub();
                    return;
                }
                if (e.key === 'Enter') {
                    e.preventDefault();
                    const id = e.target.getAttribute('data-tree-id');
                    commitTreeInlineRename('hub', id, e.target.value);
                }
            }
        });
        root.addEventListener('focusout', (e) => {
            const t = e.target;
            if (!t || !t.matches('[data-tree-inline-input]')) return;
            const id = t.getAttribute('data-tree-id');
            commitTreeInlineRename('hub', id, t.value);
        });
        root.addEventListener('dragstart', (e) => {
            const catRow = e.target.closest('[data-ph-dnd-cat]');
            const tr = e.target.closest('tr[data-pid]');
            const card = e.target.closest('.ph-card[data-pid]');
            if (catRow && !tr && !card) {
                if (e.target.closest('button, input, a, textarea, label, .ph-tree-act')) return;
                const id = catRow.getAttribute('data-ph-dnd-cat');
                const isRoot = catRow.getAttribute('data-ph-dnd-root') === '1';
                e.dataTransfer.setData('application/smc-category', JSON.stringify({ id, isRoot }));
                e.dataTransfer.effectAllowed = 'move';
            } else if (tr || card) {
                if (e.target.closest('button, input, a, textarea')) return;
                const el = tr || card;
                const pid = el.getAttribute('data-pid');
                const ids = _phState.selected.size ? [..._phState.selected] : [pid];
                e.dataTransfer.setData('application/smc-prompt-ids', JSON.stringify(ids));
                e.dataTransfer.effectAllowed = 'copyMove';
            }
        });
        root.addEventListener('dragover', (e) => {
            if (e.target.closest('[data-ph-drop-cat]')) {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'copy';
            }
        });
        root.addEventListener('drop', (e) => {
            const dropEl = e.target.closest('[data-ph-drop-cat]');
            if (!dropEl) return;
            e.preventDefault();
            const cat = dropEl.getAttribute('data-ph-drop-cat');
            const pr = e.dataTransfer.getData('application/smc-prompt-ids');
            if (pr) {
                let ids;
                try {
                    ids = JSON.parse(pr);
                } catch (err) {
                    return;
                }
                if (!Array.isArray(ids) || ids.length === 0) return;
                assignPromptsToCategory(ids, cat == null ? '' : cat);
                phToast('Category updated');
                renderPromptHub();
                return;
            }
            const cr = e.dataTransfer.getData('application/smc-category');
            if (!cr) return;
            let parsed;
            try {
                parsed = JSON.parse(cr);
            } catch (err2) {
                return;
            }
            const { id: dragId, isRoot } = parsed;
            const cats = loadCategories();
            const dropOnRoot = dropEl.getAttribute('data-ph-drop-root') === '1';
            if (isRoot && dropOnRoot && cat && cat !== '' && cat !== '__uncat__') {
                reorderRootBefore(dragId, cat);
                phToast('Categories reordered');
            } else if (!isRoot && cat && cat !== '' && cat !== '__uncat__') {
                const target = cats.find((c) => c.id === cat);
                const parentId = target && (target.parentId || target.id);
                if (parentId) {
                    reparentCategory(dragId, parentId);
                    phToast('Category moved');
                }
            }
            renderPromptHub();
        });
        ensurePhSelectionAndBulkDelegation(root);
    }

    function ensurePhSelectionAndBulkDelegation(root) {
        if (root.dataset.phSelBulkDeleg) return;
        root.dataset.phSelBulkDeleg = '1';
        root.addEventListener('change', (e) => {
            const chk = e.target.closest('.ph-row-chk');
            if (!chk) return;
            const listHost = root.querySelector('#ph-list-host');
            if (!listHost || !listHost.contains(chk)) return;
            const id = chk.getAttribute('data-pid');
            if (!id) return;
            if (chk.checked) _phState.selected.add(id);
            else _phState.selected.delete(id);
            syncPhBulkBar(root);
            const card = chk.closest('.ph-card');
            if (card) card.classList.toggle('ph-card-selected', chk.checked);
        });
        root.addEventListener('click', (e) => {
            const selAll = e.target.closest('#ph-bulk-select-all');
            const desel = e.target.closest('#ph-bulk-deselect');
            const del = e.target.closest('#ph-bulk-delete');
            if (selAll && root.contains(selAll)) {
                e.preventDefault();
                const { filtered } = getFilteredPromptsForHub();
                filtered.forEach((p) => _phState.selected.add(p.id));
                updatePhSelectionUi(root);
                return;
            }
            if (desel && root.contains(desel)) {
                e.preventDefault();
                _phState.selected.clear();
                updatePhSelectionUi(root);
                return;
            }
            if (del && root.contains(del)) {
                e.preventDefault();
                if (_phState.selected.size === 0) return;
                const n = _phState.selected.size;
                showSmcConfirmModal({
                    title: 'Delete prompts',
                    message: `Delete ${n} selected prompt(s)?\nThis cannot be undone.`,
                    confirmText: 'Delete',
                    cancelText: 'Cancel',
                    danger: true,
                }, (ok) => {
                    if (!ok) return;
                    let all = loadPromptsRaw().map(normalizePrompt);
                    all = all.filter((x) => !_phState.selected.has(x.id));
                    saveAllPrompts(all);
                    _phState.selected.clear();
                    renderPromptHubListOnly(root);
                });
            }
        });
    }

    function wireTableSortHeaders(root) {
        root.querySelectorAll('.ph-th-sort[data-sort-col]').forEach((th) => {
            if (th.dataset.phSortBound) return;
            th.dataset.phSortBound = '1';
            th.style.cursor = 'pointer';
            th.addEventListener('click', (ev) => {
                if (ev.target.closest('.ph-col-handle')) return;
                const col = th.getAttribute('data-sort-col');
                if (_phState.sortCol === col) {
                    _phState.sortDir = _phState.sortDir === 'asc' ? 'desc' : 'asc';
                } else {
                    _phState.sortCol = col;
                    _phState.sortDir = col === 'updatedAt' ? 'desc' : 'asc';
                }
                renderPromptHubListOnly(root);
            });
        });
    }

    function wireColumnResizers(root, wMap) {
        const table = root.querySelector('.ph-table-resizable');
        if (!table) return;
        table.querySelectorAll('.ph-col-handle').forEach((h) => {
            if (h.dataset.phColBound) return;
            h.dataset.phColBound = '1';
            const colName = h.getAttribute('data-col');
            h.addEventListener('mousedown', (ev) => {
                ev.preventDefault();
                ev.stopPropagation();
                const startX = ev.clientX;
                const col = table.querySelector(`col.ph-col-${colName}`);
                const startW = col ? col.getBoundingClientRect().width : 120;
                const onMove = (ev2) => {
                    const dw = ev2.clientX - startX;
                    const nw = Math.max(80, Math.min(560, startW + dw));
                    wMap[colName] = nw;
                    if (col) col.style.width = `${nw}px`;
                };
                const onUp = () => {
                    document.removeEventListener('mousemove', onMove);
                    document.removeEventListener('mouseup', onUp);
                    saveTableColWidths(wMap);
                };
                document.addEventListener('mousemove', onMove);
                document.addEventListener('mouseup', onUp);
            });
        });
    }

    function renderPromptHub() {
        const root = document.getElementById('prompt-hub-root');
        if (!root) return;

        ensurePhHubHandlers(root);
        ensurePhFilterListRefresh(root);

        const { filtered, cats } = getFilteredPromptsForHub();
        const favCats = loadFavoriteCategoryIds();
        const wMap = loadTableColWidths();
        const bulkSlotInner = buildBulkSlotHtml();

        const favOnlyChk = _phState.favoritesOnly ? 'checked' : '';
        const collapsedCls = _phState.filterCollapsed ? ' ph-filters-collapsed' : '';
        const chevronSvg = _phState.filterCollapsed
            ? '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>'
            : '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>';
        root.innerHTML = `
            <div class="ph-grid">
                <aside class="ph-filters${collapsedCls}" id="ph-filters-aside">
                    <button type="button" class="ph-collapse-toggle" id="ph-collapse-toggle" title="${_phState.filterCollapsed ? 'Expand filter' : 'Collapse filter'}" aria-label="Toggle filter panel">${chevronSvg}</button>
                    <label class="ph-label">Search title</label>
                    <input type="search" class="ph-input" id="ph-filter-title" value="${escapeHtml(_phState.titleQ)}" placeholder="Filter by title…" />
                    <label class="ph-label">Tag contains</label>
                    <input type="text" class="ph-input" id="ph-filter-tag" value="${escapeHtml(_phState.tagQ)}" placeholder="Tag…" />
                    <div class="ph-label-row">
                        <label class="ph-label">Categories</label>
                        <span class="ph-label-row-actions">
                            <button type="button" class="ph-tree-add-root-btn" title="Add root category" aria-label="Add root category">${TREE_ICONS.add}</button>
                            <span class="ph-help-tip" tabindex="0" role="button" aria-label="Category guide">?
                                <span class="ph-help-tip-bubble">Drag categories to reorder (roots) or move subcategories onto a root. Drag selected prompts here to assign.</span>
                            </span>
                        </span>
                    </div>
                    <div data-ph-cat-tree-host id="ph-cat-tree-host">${buildCategoryTreeDndHtml(cats)}</div>
                    <div class="ph-resize-handle" id="ph-filter-resize"></div>
                </aside>
                <div class="ph-main">
                    <div id="ph-bulk-slot">${bulkSlotInner}</div>
                    <div class="ph-toolbar">
                        <div class="ph-view-toggle" role="group" aria-label="View mode">
                            <button type="button" class="ph-toggle ph-toggle-icon ${_phState.view === 'table' ? 'active' : ''}" data-view="table" title="Table view" aria-label="Table view">${PH_SVG.viewTable}</button>
                            <button type="button" class="ph-toggle ph-toggle-icon ${_phState.view === 'preview' ? 'active' : ''}" data-view="preview" title="Preview cards" aria-label="Preview cards">${PH_SVG.viewPreview}</button>
                        </div>
                        <label class="switch-container ph-fav-only-toggle ph-fav-toolbar" for="ph-filter-favorites">
                            <input type="checkbox" id="ph-filter-favorites" ${favOnlyChk} />
                            <span class="switch-slider" aria-hidden="true"></span>
                            <span class="switch-label">Favorites</span>
                        </label>
                    </div>
                    <div id="ph-list-host"></div>
                </div>
            </div>
        `;

        const host = root.querySelector('#ph-list-host');
        renderPhListIntoHost(root, host, filtered, cats, favCats, wMap);
        wirePhListHandlers(root);

        root.querySelectorAll('.ph-cat-item').forEach((btn) => {
            btn.addEventListener('click', () => {
                _phState.catId = btn.getAttribute('data-cat') || '';
                _phState.selected.clear();
                renderPromptHub();
            });
        });

        root.querySelectorAll('.ph-toggle').forEach((b) => {
            b.addEventListener('click', () => {
                _phState.view = b.getAttribute('data-view') || 'table';
                renderPromptHub();
            });
        });

        wirePhFilterResizeHandle(root);
        wirePhCollapseToggle(root);
    }

    function wirePhFilterResizeHandle(root) {
        const handle = root.querySelector('#ph-filter-resize');
        const aside = root.querySelector('#ph-filters-aside');
        if (!handle || !aside) return;
        handle.addEventListener('mousedown', (ev) => {
            ev.preventDefault();
            const startX = ev.clientX;
            const startW = aside.getBoundingClientRect().width;
            handle.classList.add('ph-resizing');
            const onMove = (e2) => {
                const nw = Math.max(240, Math.min(520, startW + (e2.clientX - startX)));
                aside.style.width = nw + 'px';
            };
            const onUp = () => {
                handle.classList.remove('ph-resizing');
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
            };
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
        });
    }

    function wirePhCollapseToggle(root) {
        const btn = root.querySelector('#ph-collapse-toggle');
        if (!btn) return;
        btn.addEventListener('click', () => {
            _phState.filterCollapsed = !_phState.filterCollapsed;
            renderPromptHub();
        });
    }

    function ensureCpbPhPanelBound() {
        const panel = document.getElementById('cpb-ph-panel-root');
        if (!panel || panel.dataset.smcCpbPhBound === '1') return;
        panel.dataset.smcCpbPhBound = '1';

        const getS = () => window.SMCPromptLibrary._getCpbPhState?.();
        const refresh = () => window.SMCPromptLibrary._cpbPhRefresh?.();

        panel.addEventListener('click', (e) => {
            const chevAll = e.target.closest('.ph-tree-chev-all');
            if (chevAll && panel.contains(chevAll)) {
                e.preventDefault();
                e.stopPropagation();
                const S = getS();
                if (!S) return;
                const wasOpen = S.allUnderAllExpanded !== false;
                S.allUnderAllExpanded = !wasOpen;
                refresh();
                return;
            }

            const catItem = e.target.closest('.ph-cat-item');
            if (catItem && catItem.closest('.ph-cat-dnd-tree') && panel.contains(catItem)) {
                e.preventDefault();
                const v = catItem.getAttribute('data-cat') ?? '';
                const S = getS();
                if (!S) return;
                S.catId = v;
                window.SMCPromptLibrary._cpbAssignCategoryFromTree?.(v);
                refresh();
                return;
            }

            const treeAct = e.target.closest('[data-tree-act]');
            const treeHost = panel.querySelector('[data-ph-cat-tree-host]');
            if (treeAct && treeHost && treeHost.contains(treeAct)) {
                e.preventDefault();
                e.stopPropagation();
                const action = treeAct.getAttribute('data-tree-act');
                const id = treeAct.getAttribute('data-tree-id');
                if (!id) return;
                const allCats = loadCategories();
                if (action === 'add-sub') {
                    createCategoryAndStartInlineRename(id, 'cpb');
                    window.SMCPromptLibrary._cpbShowListMode?.();
                    refresh();
                    return;
                }
                if (action === 'rename') {
                    const cat = allCats.find((c) => c.id === id);
                    if (!cat) return;
                    startTreeInlineRename('cpb', id, cat.name);
                    window.SMCPromptLibrary._cpbShowListMode?.();
                    refresh();
                    return;
                }
                if (action === 'delete') {
                    const cat = allCats.find((c) => c.id === id);
                    if (!cat) return;
                    showSmcConfirmModal({
                        title: 'Delete category',
                        message: deleteCategoryConfirmMessage(cat.name),
                        confirmText: 'Delete',
                        cancelText: 'Cancel',
                        danger: true,
                    }, (ok) => {
                        if (!ok) return;
                        if (performCategoryDeleteById(id)) {
                            phToast('Category deleted');
                        } else {
                            phToast('Could not delete category (not found).');
                        }
                        refresh();
                        renderPromptHub();
                    });
                    return;
                }
                return;
            }

            if (e.target.closest('.ph-tree-add-root-btn') && panel.contains(e.target.closest('.ph-tree-add-root-btn'))) {
                e.preventDefault();
                createCategoryAndStartInlineRename(null, 'cpb');
                window.SMCPromptLibrary._cpbShowListMode?.();
                refresh();
                return;
            }

            const chev = e.target.closest('.ph-tree-chev:not(.ph-tree-chev-all)');
            if (chev && panel.contains(chev)) {
                e.preventDefault();
                e.stopPropagation();
                const node = chev.closest('[data-tree-root]');
                const cid = node && node.getAttribute('data-tree-root');
                if (!cid) return;
                const S = getS();
                if (!S) return;
                if (S.catExpanded[cid] === false) delete S.catExpanded[cid];
                else S.catExpanded[cid] = false;
                refresh();
                return;
            }
        });

        panel.addEventListener('keydown', (e) => {
            if (e.target && e.target.matches('[data-tree-inline-input]')) {
                if (e.key === 'Escape') {
                    e.preventDefault();
                    closePhCatQuick();
                    refresh();
                    return;
                }
                if (e.key === 'Enter') {
                    e.preventDefault();
                    const id = e.target.getAttribute('data-tree-id');
                    commitTreeInlineRename('cpb', id, e.target.value);
                }
            }
        });
        panel.addEventListener('focusout', (e) => {
            const t = e.target;
            if (!t || !t.matches('[data-tree-inline-input]')) return;
            const id = t.getAttribute('data-tree-id');
            commitTreeInlineRename('cpb', id, t.value);
        });

        panel.addEventListener('dragstart', (e) => {
            const catRow = e.target.closest('[data-ph-dnd-cat]');
            const item = e.target.closest('.cpb-item[data-prompt-id]');
            if (catRow && !item) {
                if (e.target.closest('button, input, a, textarea, label, .ph-tree-act')) return;
                const id = catRow.getAttribute('data-ph-dnd-cat');
                const isRoot = catRow.getAttribute('data-ph-dnd-root') === '1';
                e.dataTransfer.setData('application/smc-category', JSON.stringify({ id, isRoot }));
                e.dataTransfer.effectAllowed = 'move';
            } else if (item) {
                if (e.target.closest('button, input, a, textarea')) return;
                const pid = item.getAttribute('data-prompt-id');
                e.dataTransfer.setData('application/smc-prompt-ids', JSON.stringify([pid]));
                e.dataTransfer.effectAllowed = 'copyMove';
            }
        });
        panel.addEventListener('dragover', (e) => {
            if (e.target.closest('[data-ph-drop-cat]')) {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'copy';
            }
        });
        panel.addEventListener('drop', (e) => {
            const dropEl = e.target.closest('[data-ph-drop-cat]');
            if (!dropEl || !panel.contains(dropEl)) return;
            e.preventDefault();
            const cat = dropEl.getAttribute('data-ph-drop-cat');
            const pr = e.dataTransfer.getData('application/smc-prompt-ids');
            if (pr) {
                let ids;
                try {
                    ids = JSON.parse(pr);
                } catch (err) {
                    return;
                }
                if (!Array.isArray(ids) || ids.length === 0) return;
                assignPromptsToCategory(ids, cat == null ? '' : cat);
                phToast('Category updated');
                window.SMCPromptLibrary._cpbReloadPromptsAfterExternalChange?.();
                refresh();
                renderPromptHub();
                return;
            }
            const cr = e.dataTransfer.getData('application/smc-category');
            if (!cr) return;
            let parsed;
            try {
                parsed = JSON.parse(cr);
            } catch (err2) {
                return;
            }
            const { id: dragId, isRoot } = parsed;
            const cats = loadCategories();
            const dropOnRoot = dropEl.getAttribute('data-ph-drop-root') === '1';
            if (isRoot && dropOnRoot && cat && cat !== '' && cat !== '__uncat__') {
                reorderRootBefore(dragId, cat);
                phToast('Categories reordered');
            } else if (!isRoot && cat && cat !== '' && cat !== '__uncat__') {
                const target = cats.find((c) => c.id === cat);
                const parentId = target && (target.parentId || target.id);
                if (parentId) {
                    reparentCategory(dragId, parentId);
                    phToast('Category moved');
                }
            }
            refresh();
            renderPromptHub();
        });
    }

    function openCategoryModal() {
        const modal = document.getElementById('smc-category-modal');
        const body = document.getElementById('smc-category-modal-body');
        if (!modal || !body) return;

        /** In-modal form (avoid window.prompt — often invisible when BrowserViews are hidden). */
        const catModalForm = { mode: 'root', parentId: null, renameId: null };

        function resetCatModalForm() {
            catModalForm.mode = 'root';
            catModalForm.parentId = null;
            catModalForm.renameId = null;
        }

        function wireCategoryModalForm() {
            const inp = body.querySelector('#smc-modal-cat-input');
            const submitBtn = body.querySelector('#smc-modal-cat-form-submit');
            if (!inp || !submitBtn) return;

            const applyLabels = () => {
                if (catModalForm.mode === 'rename' && catModalForm.renameId) {
                    submitBtn.textContent = 'Save';
                } else {
                    submitBtn.textContent = 'Add';
                }
                if (catModalForm.mode === 'rename' && catModalForm.renameId) {
                    const c = loadCategories().find((x) => x.id === catModalForm.renameId);
                    inp.placeholder = 'Category name';
                    if (c && !inp.dataset.smcTouched) inp.value = c.name;
                } else if (catModalForm.mode === 'sub' && catModalForm.parentId) {
                    const p = loadCategories().find((x) => x.id === catModalForm.parentId);
                    inp.placeholder = p ? `Subcategory under "${p.name}"` : 'New subcategory name';
                    if (!inp.dataset.smcTouched) inp.value = '';
                } else {
                    inp.placeholder = 'New root category name';
                    if (!inp.dataset.smcTouched) inp.value = '';
                }
            };
            inp.dataset.smcTouched = '';
            inp.addEventListener('input', () => { inp.dataset.smcTouched = '1'; });
            applyLabels();
            requestAnimationFrame(() => {
                inp.focus();
                if (catModalForm.mode === 'rename') inp.select();
            });

            const doSubmit = () => {
                const name = inp.value.trim();
                const list = loadCategories();
                if (catModalForm.mode === 'rename' && catModalForm.renameId) {
                    if (!name) return;
                    const cat = list.find((x) => x.id === catModalForm.renameId);
                    if (cat && name !== cat.name) {
                        cat.name = name;
                        saveCategories(list);
                    }
                    resetCatModalForm();
                    renderModal();
                    return;
                }
                if (!name) return;
                if (catModalForm.mode === 'sub' && catModalForm.parentId) {
                    list.push({ id: uid(), name, parentId: catModalForm.parentId });
                    saveCategories(list);
                    resetCatModalForm();
                    renderModal();
                    return;
                }
                list.push({ id: uid(), name, parentId: null });
                saveCategories(list);
                resetCatModalForm();
                renderModal();
            };

            submitBtn.onclick = (e) => {
                e.preventDefault();
                doSubmit();
            };
            inp.onkeydown = (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    doSubmit();
                }
                if (e.key === 'Escape' && catModalForm.mode !== 'root') {
                    e.preventDefault();
                    e.stopPropagation();
                    resetCatModalForm();
                    renderModal();
                }
            };
        }

        function renderModal() {
            const cats = loadCategories();
            const roots = cats.filter((c) => !c.parentId);
            let html = `
                <div class="smc-cat-form-row">
                    <p class="smc-cat-form-hint">Type a name here and click Add (or use row icons for subcategory / rename). Max 2-depth.</p>
                    <div class="smc-cat-form-inline">
                        <input type="text" id="smc-modal-cat-input" class="ph-input" autocomplete="off" />
                        <button type="button" id="smc-modal-cat-form-submit" class="btn-secondary">Add</button>
                    </div>
                </div>
                <div class="ph-cat-dnd-tree smc-modal-tree">`;
            roots.forEach((r) => {
                const kids = cats.filter((c) => c.parentId === r.id);
                html += `<div class="ph-tree-node">`;
                html += `<div class="ph-tree-row"><span class="ph-tree-icon">${TREE_ICONS.folderOpen}</span><span class="smc-modal-cat-name">${escapeHtml(r.name)}</span>`;
                html += `<span class="ph-tree-actions" style="display:flex">`;
                html += `<button type="button" class="ph-tree-act" data-modal-act="add-sub" data-modal-id="${escapeHtml(r.id)}" title="Add subcategory">${TREE_ICONS.add}</button>`;
                html += `<button type="button" class="ph-tree-act" data-modal-act="rename" data-modal-id="${escapeHtml(r.id)}" title="Rename">${TREE_ICONS.rename}</button>`;
                html += `<button type="button" class="ph-tree-act ph-tree-act-del" data-modal-act="delete" data-modal-id="${escapeHtml(r.id)}" title="Delete">${TREE_ICONS.del}</button>`;
                html += `</span></div>`;
                if (kids.length) {
                    html += '<div class="ph-tree-children">';
                    kids.forEach((ch) => {
                        html += `<div class="ph-tree-row ph-tree-row-child"><span class="ph-tree-icon">${TREE_ICONS.file}</span><span class="smc-modal-cat-name">${escapeHtml(ch.name)}</span>`;
                        html += `<span class="ph-tree-actions" style="display:flex">`;
                        html += `<button type="button" class="ph-tree-act" data-modal-act="rename" data-modal-id="${escapeHtml(ch.id)}" title="Rename">${TREE_ICONS.rename}</button>`;
                        html += `<button type="button" class="ph-tree-act ph-tree-act-del" data-modal-act="delete" data-modal-id="${escapeHtml(ch.id)}" title="Delete">${TREE_ICONS.del}</button>`;
                        html += `</span></div>`;
                    });
                    html += '</div>';
                }
                html += '</div>';
            });
            html += '</div>';
            body.innerHTML = html;

            body.querySelectorAll('[data-modal-act]').forEach((btn) => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const act = btn.getAttribute('data-modal-act');
                    const id = btn.getAttribute('data-modal-id');
                    const allCats = loadCategories();
                    if (act === 'add-sub') {
                        catModalForm.mode = 'sub';
                        catModalForm.parentId = id;
                        catModalForm.renameId = null;
                        renderModal();
                    } else if (act === 'rename') {
                        catModalForm.mode = 'rename';
                        catModalForm.renameId = id;
                        catModalForm.parentId = null;
                        renderModal();
                    } else if (act === 'delete') {
                        const cat = allCats.find((c) => c.id === id);
                        if (!cat) return;
                        showSmcConfirmModal({
                            title: 'Delete category',
                            message: deleteCategoryConfirmMessage(cat.name),
                            confirmText: 'Delete',
                            cancelText: 'Cancel',
                            danger: true,
                        }, (ok) => {
                            if (!ok) return;
                            if (performCategoryDeleteById(id)) phToast('Category deleted');
                            else phToast('Could not delete category (not found).');
                            resetCatModalForm();
                            renderModal();
                            if (typeof window.renderPromptHub === 'function') window.renderPromptHub();
                        });
                    }
                });
            });

            wireCategoryModalForm();
        }

        resetCatModalForm();
        renderModal();
        modal.classList.add('visible');
        window.electronAPI?.setServiceVisibility?.(false);

        const close = () => {
            modal.classList.remove('visible');
            try { window.applySmcPreferredServiceVisibility?.(); } catch (e) { /* ignore */ }
            resetCatModalForm();
        };
        document.getElementById('smc-category-modal-close').onclick = close;
        document.getElementById('smc-category-modal-done').onclick = close;
        document.getElementById('smc-category-add-root').onclick = () => {
            resetCatModalForm();
            renderModal();
            const inp = body.querySelector('#smc-modal-cat-input');
            inp?.focus();
        };
    }

    window.openSmcCategoryModal = openCategoryModal;
    window.renderPromptHub = renderPromptHub;
    window.ensureCpbPhPanelBound = ensureCpbPhPanelBound;
    window.showSmcConfirmModal = showSmcConfirmModal;

    window.SMCPromptLibrary.filterPromptBySidebarState = filterPromptBySidebarState;
    window.SMCPromptLibrary.buildCategoryTreeForPanel = buildCategoryTreeDndHtml;
    window.SMCPromptLibrary.buildFavoriteCategoriesHtmlForPanel = buildFavoriteCategoriesHtml;

    window.initPromptHubShell = function (deps) {
        _deps = deps || {};
        window.addEventListener('smc:prompt-library-changed', () => {
            const rail = document.getElementById('history-sidebar')?.getAttribute('data-active-panel') === 'prompt-hub';
            const overlayOpen = document.getElementById('smc-overlay-prompt-hub')?.classList.contains('is-open');
            if (rail || overlayOpen) renderPromptHub();
        });
    };
})();
