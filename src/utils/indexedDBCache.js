/**
 * IndexedDB Cache for Messages
 * Stores messages locally for instant loading and offline support
 */

const DB_NAME = 'duet_cache';
const DB_VERSION = 1;
const MESSAGES_STORE = 'messages';
const PROFILES_STORE = 'profiles';

class IndexedDBCache {
  constructor() {
    this.db = null;
    this.initPromise = this.init();
  }

  async init() {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Messages store
        if (!db.objectStoreNames.contains(MESSAGES_STORE)) {
          const messageStore = db.createObjectStore(MESSAGES_STORE, { keyPath: 'id' });
          messageStore.createIndex('chatId', 'chatId', { unique: false });
          messageStore.createIndex('timestamp', 'timestamp', { unique: false });
          messageStore.createIndex('chatId_timestamp', ['chatId', 'timestamp'], { unique: false });
        }

        // Profiles store
        if (!db.objectStoreNames.contains(PROFILES_STORE)) {
          const profileStore = db.createObjectStore(PROFILES_STORE, { keyPath: 'uid' });
          profileStore.createIndex('lastFetched', 'lastFetched', { unique: false });
        }
      };
    });
  }

  async cacheMessages(chatId, messages) {
    await this.initPromise;
    const tx = this.db.transaction([MESSAGES_STORE], 'readwrite');
    const store = tx.objectStore(MESSAGES_STORE);

    for (const message of messages) {
      store.put({
        ...message,
        chatId,
        cachedAt: Date.now()
      });
    }

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getCachedMessages(chatId, limit = 50) {
    await this.initPromise;
    const tx = this.db.transaction([MESSAGES_STORE], 'readonly');
    const store = tx.objectStore(MESSAGES_STORE);
    const index = store.index('chatId_timestamp');

    // Get messages for this chat, sorted by timestamp
    const range = IDBKeyRange.bound([chatId, 0], [chatId, Date.now()]);
    const messages = [];

    return new Promise((resolve, reject) => {
      const request = index.openCursor(range, 'prev'); // Newest first

      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor && messages.length < limit) {
          messages.push(cursor.value);
          cursor.continue();
        } else {
          resolve(messages.reverse()); // Return oldest first
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  async cacheProfile(profile) {
    await this.initPromise;
    const tx = this.db.transaction([PROFILES_STORE], 'readwrite');
    const store = tx.objectStore(PROFILES_STORE);

    store.put({
      ...profile,
      lastFetched: Date.now()
    });

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getCachedProfile(uid) {
    await this.initPromise;
    const tx = this.db.transaction([PROFILES_STORE], 'readonly');
    const store = tx.objectStore(PROFILES_STORE);

    return new Promise((resolve, reject) => {
      const request = store.get(uid);
      request.onsuccess = () => {
        const profile = request.result;
        // Return profile if cached within last 10 minutes
        if (profile && (Date.now() - profile.lastFetched) < 10 * 60 * 1000) {
          resolve(profile);
        } else {
          resolve(null);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  async clearOldMessages(daysOld = 30) {
    await this.initPromise;
    const tx = this.db.transaction([MESSAGES_STORE], 'readwrite');
    const store = tx.objectStore(MESSAGES_STORE);
    const cutoffTime = Date.now() - (daysOld * 24 * 60 * 60 * 1000);

    const index = store.index('timestamp');
    const range = IDBKeyRange.upperBound(cutoffTime);

    return new Promise((resolve, reject) => {
      const request = index.openCursor(range);
      let deletedCount = 0;

      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          cursor.delete();
          deletedCount++;
          cursor.continue();
        } else {
          console.log(`Cleared ${deletedCount} old messages from IndexedDB`);
          resolve(deletedCount);
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  async getStorageSize() {
    await this.initPromise;
    if (!navigator.storage || !navigator.storage.estimate) {
      return { used: 0, quota: 0 };
    }

    const estimate = await navigator.storage.estimate();
    return {
      used: estimate.usage,
      quota: estimate.quota,
      usedMB: (estimate.usage / (1024 * 1024)).toFixed(2),
      quotaMB: (estimate.quota / (1024 * 1024)).toFixed(2)
    };
  }

  async clearAll() {
    await this.initPromise;
    const tx = this.db.transaction([MESSAGES_STORE, PROFILES_STORE], 'readwrite');
    
    tx.objectStore(MESSAGES_STORE).clear();
    tx.objectStore(PROFILES_STORE).clear();

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => {
        console.log('IndexedDB cache cleared');
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    });
  }
}

// Global instance
export const idbCache = new IndexedDBCache();

// Hook to use IndexedDB cache
export function useIndexedDBCache(chatId) {
  const [cachedMessages, setCachedMessages] = React.useState([]);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    if (!chatId) return;

    const loadCached = async () => {
      try {
        const messages = await idbCache.getCachedMessages(chatId);
        setCachedMessages(messages);
      } catch (error) {
        console.error('Error loading cached messages:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadCached();
  }, [chatId]);

  const cacheMessages = React.useCallback(async (messages) => {
    if (!chatId) return;
    try {
      await idbCache.cacheMessages(chatId, messages);
    } catch (error) {
      console.error('Error caching messages:', error);
    }
  }, [chatId]);

  return { cachedMessages, cacheMessages, isLoading };
}

export default idbCache;
