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

    getSessions(limit = 20, offset = 0) {
        return this.ensureInit().then(() => {
            return new Promise((resolve, reject) => {
                const transaction = this.db.transaction([this.storeName], 'readonly');
                const store = transaction.objectStore(this.storeName);
                // Fetch all sessions and sort by createdAt in memory
                // (IndexedDB only has updatedAt index, sorting by createdAt requires JS sort)
                const request = store.getAll();

                request.onsuccess = () => {
                    let sessions = request.result || [];
                    // Sort by createdAt descending (newest first)
                    sessions.sort((a, b) => {
                        const dateA = a.createdAt ? new Date(a.createdAt) : new Date(0);
                        const dateB = b.createdAt ? new Date(b.createdAt) : new Date(0);
                        return dateB - dateA;
                    });
                    // Apply offset and limit
                    sessions = sessions.slice(offset, offset + limit);
                    resolve(sessions);
                };

                request.onerror = (event) => {
                    reject(event.target.error);
                };
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
