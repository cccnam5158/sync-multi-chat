class HistoryManager {
    constructor() {
        this.dbName = 'conversations-db';
        this.storeName = 'conversations';
        this.db = null;
    }

    init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, 1);

            request.onerror = (event) => {
                console.error('[HistoryManager] Database error:', event.target.errorCode);
                reject(event.target.errorCode);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    const store = db.createObjectStore(this.storeName, { keyPath: 'id' });
                    store.createIndex('updatedAt', 'updatedAt', { unique: false });
                }
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                console.log('[HistoryManager] Initialized');
                resolve(this.db);
            };
        });
    }

    ensureInit() {
        if (this.db) return Promise.resolve(this.db);
        return this.init();
    }

    saveSession(sessionData) {
        return this.ensureInit().then(() => {
            return new Promise((resolve, reject) => {
                if (!sessionData.id) {
                    reject('Cannot save session without ID');
                    return;
                }

                const now = new Date().toISOString();
                if (!sessionData.createdAt) sessionData.createdAt = now;
                sessionData.updatedAt = now;

                const transaction = this.db.transaction([this.storeName], 'readwrite');
                const store = transaction.objectStore(this.storeName);
                const request = store.put(sessionData);

                request.onsuccess = () => {
                    // console.log(`[HistoryManager] Saved session: ${sessionData.id}`);
                    resolve(sessionData);
                };

                request.onerror = (event) => {
                    console.error('[HistoryManager] Save error:', event.target.error);
                    reject(event.target.error);
                };
            });
        });
    }

    getSessions(limit = 20, offset = 0, options = {}) {
        const sortBy = options.sortBy || 'updatedDesc';
        return this.ensureInit().then(() => {
            return new Promise((resolve, reject) => {
                const transaction = this.db.transaction([this.storeName], 'readonly');
                const store = transaction.objectStore(this.storeName);
                const request = store.getAll();

                request.onsuccess = () => {
                    let sessions = request.result || [];
                    const t = (s) => {
                        const u = s.updatedAt ? new Date(s.updatedAt).getTime() : 0;
                        const c = s.createdAt ? new Date(s.createdAt).getTime() : 0;
                        return { u, c };
                    };
                    if (sortBy === 'titleAsc') {
                        sessions.sort((a, b) => String(a.title || '').localeCompare(String(b.title || ''), undefined, { sensitivity: 'base' }));
                    } else if (sortBy === 'createdDesc') {
                        sessions.sort((a, b) => t(b).c - t(a).c);
                    } else {
                        // updatedDesc (default)
                        sessions.sort((a, b) => {
                            const tb = t(b);
                            const ta = t(a);
                            return (tb.u || tb.c) - (ta.u || ta.c);
                        });
                    }
                    sessions = sessions.slice(offset, offset + limit);
                    resolve(sessions);
                };

                request.onerror = (event) => {
                    reject(event.target.error);
                };
            });
        });
    }

    getAllSessions(options = {}) {
        const sortBy = options.sortBy || 'updatedDesc';
        return this.ensureInit().then(() => {
            return new Promise((resolve, reject) => {
                const transaction = this.db.transaction([this.storeName], 'readonly');
                const store = transaction.objectStore(this.storeName);
                const request = store.getAll();
                request.onsuccess = () => {
                    let sessions = request.result || [];
                    const t = (s) => {
                        const u = s.updatedAt ? new Date(s.updatedAt).getTime() : 0;
                        const c = s.createdAt ? new Date(s.createdAt).getTime() : 0;
                        return { u, c };
                    };
                    if (sortBy === 'titleAsc') {
                        sessions.sort((a, b) => String(a.title || '').localeCompare(String(b.title || ''), undefined, { sensitivity: 'base' }));
                    } else if (sortBy === 'createdDesc') {
                        sessions.sort((a, b) => t(b).c - t(a).c);
                    } else {
                        sessions.sort((a, b) => (t(b).u || t(b).c) - (t(a).u || t(a).c));
                    }
                    resolve(sessions);
                };
                request.onerror = (event) => reject(event.target.error);
            });
        });
    }

    getSession(id) {
        return this.ensureInit().then(() => {
            return new Promise((resolve, reject) => {
                const transaction = this.db.transaction([this.storeName], 'readonly');
                const store = transaction.objectStore(this.storeName);
                const request = store.get(id);

                request.onsuccess = () => resolve(request.result);
                request.onerror = (event) => reject(event.target.error);
            });
        });
    }

    deleteSession(id) {
        return this.ensureInit().then(() => {
            return new Promise((resolve, reject) => {
                const transaction = this.db.transaction([this.storeName], 'readwrite');
                const store = transaction.objectStore(this.storeName);
                const request = store.delete(id);

                request.onsuccess = () => {
                    console.log(`[HistoryManager] Deleted session: ${id}`);
                    resolve();
                };
                request.onerror = (event) => reject(event.target.error);
            });
        });
    }

    deleteSessions(ids = []) {
        return this.ensureInit().then(() => {
            return new Promise((resolve, reject) => {
                const uniqueIds = Array.from(new Set(ids)).filter(Boolean);
                if (uniqueIds.length === 0) {
                    resolve();
                    return;
                }

                const transaction = this.db.transaction([this.storeName], 'readwrite');
                const store = transaction.objectStore(this.storeName);

                transaction.oncomplete = () => {
                    console.log(`[HistoryManager] Deleted sessions: ${uniqueIds.length}`);
                    resolve();
                };
                transaction.onerror = (event) => reject(event.target.error);
                transaction.onabort = (event) => reject(event.target.error);

                uniqueIds.forEach((id) => {
                    try {
                        store.delete(id);
                    } catch (e) {
                        // if delete throws synchronously, abort transaction
                        try { transaction.abort(); } catch (_) {}
                        reject(e);
                    }
                });
            });
        });
    }

    clearAll() {
        return this.ensureInit().then(() => {
            return new Promise((resolve, reject) => {
                const transaction = this.db.transaction([this.storeName], 'readwrite');
                const store = transaction.objectStore(this.storeName);
                const request = store.clear();

                request.onsuccess = () => {
                    console.log('[HistoryManager] Cleared all sessions');
                    resolve();
                };
                request.onerror = (event) => reject(event.target.error);
            });
        });
    }
}

// Expose generically
window.HistoryManager = HistoryManager;
