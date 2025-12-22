/**
 * Optimized Presence Tracking
 * Batches presence updates to reduce Firebase writes
 */

import { ref, onValue, set, onDisconnect, serverTimestamp } from 'firebase/realtime-database';
import { database } from '../firebase/firebase';

class PresenceManager {
  constructor() {
    this.userId = null;
    this.isOnline = false;
    this.listeners = new Map();
    this.updateQueue = [];
    this.updateTimer = null;
    this.BATCH_INTERVAL = 5000; // Batch updates every 5 seconds
  }

  /**
   * Initialize presence tracking for a user
   */
  init(userId) {
    if (this.userId === userId && this.isOnline) return;

    this.userId = userId;
    const presenceRef = ref(database, `presence/${userId}`);

    // Set online status
    set(presenceRef, {
      isOnline: true,
      lastSeen: serverTimestamp(),
    });

    // Set offline status on disconnect
    onDisconnect(presenceRef).set({
      isOnline: false,
      lastSeen: serverTimestamp(),
    });

    this.isOnline = true;

    // Handle visibility change
    this.handleVisibilityChange = () => {
      if (document.hidden) {
        // User went offline (tab hidden)
        set(presenceRef, {
          isOnline: false,
          lastSeen: serverTimestamp(),
        });
      } else {
        // User came back online
        set(presenceRef, {
          isOnline: true,
          lastSeen: serverTimestamp(),
        });
      }
    };

    document.addEventListener('visibilitychange', this.handleVisibilityChange);

    // Periodic heartbeat every 30 seconds (reduces writes from every 5s)
    this.heartbeatInterval = setInterval(() => {
      if (!document.hidden) {
        set(presenceRef, {
          isOnline: true,
          lastSeen: serverTimestamp(),
        });
      }
    }, 30000);

    console.log('[PresenceManager] Initialized for user:', userId);
  }

  /**
   * Listen to another user's presence
   * Batches multiple listeners to reduce overhead
   */
  listenToPresence(userId, callback) {
    const key = `presence_${userId}`;

    // Reuse existing listener if available
    if (this.listeners.has(key)) {
      const listener = this.listeners.get(key);
      listener.callbacks.push(callback);
      // Immediately call with cached data
      if (listener.cachedData) {
        callback(listener.cachedData);
      }
      return () => this.unlistenFromPresence(userId, callback);
    }

    // Create new listener
    const presenceRef = ref(database, `presence/${userId}`);
    const unsubscribe = onValue(presenceRef, (snapshot) => {
      const data = snapshot.val() || { isOnline: false, lastSeen: null };
      
      const listener = this.listeners.get(key);
      if (listener) {
        listener.cachedData = data;
        listener.callbacks.forEach(cb => cb(data));
      }
    });

    this.listeners.set(key, {
      unsubscribe,
      callbacks: [callback],
      cachedData: null,
    });

    return () => this.unlistenFromPresence(userId, callback);
  }

  unlistenFromPresence(userId, callback) {
    const key = `presence_${userId}`;
    const listener = this.listeners.get(key);

    if (!listener) return;

    // Remove callback
    listener.callbacks = listener.callbacks.filter(cb => cb !== callback);

    // If no more callbacks, remove listener
    if (listener.callbacks.length === 0) {
      listener.unsubscribe();
      this.listeners.delete(key);
      console.log('[PresenceManager] Removed listener for:', userId);
    }
  }

  /**
   * Cleanup on user logout
   */
  cleanup() {
    if (this.userId) {
      const presenceRef = ref(database, `presence/${this.userId}`);
      set(presenceRef, {
        isOnline: false,
        lastSeen: serverTimestamp(),
      });
    }

    // Clear heartbeat
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    // Remove visibility listener
    if (this.handleVisibilityChange) {
      document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    }

    // Cleanup all listeners
    this.listeners.forEach(listener => listener.unsubscribe());
    this.listeners.clear();

    this.isOnline = false;
    this.userId = null;

    console.log('[PresenceManager] Cleaned up');
  }

  /**
   * Get current online status cache
   */
  getCachedStatus(userId) {
    const key = `presence_${userId}`;
    const listener = this.listeners.get(key);
    return listener?.cachedData || null;
  }

  /**
   * Batch multiple presence checks
   */
  async batchCheckPresence(userIds) {
    const results = {};
    
    for (const userId of userIds) {
      const cached = this.getCachedStatus(userId);
      if (cached) {
        results[userId] = cached;
      } else {
        // Will be populated when listener triggers
        results[userId] = { isOnline: false, lastSeen: null };
      }
    }

    return results;
  }
}

// Global instance
export const presenceManager = new PresenceManager();

// React hook for presence
export function usePresence(userId) {
  const [presence, setPresence] = React.useState({ isOnline: false, lastSeen: null });

  React.useEffect(() => {
    if (!userId) return;

    const unsubscribe = presenceManager.listenToPresence(userId, setPresence);
    return unsubscribe;
  }, [userId]);

  return presence;
}

// Batch hook for multiple users
export function useBatchPresence(userIds) {
  const [presenceMap, setPresenceMap] = React.useState({});

  React.useEffect(() => {
    if (!userIds || userIds.length === 0) return;

    const unsubscribers = userIds.map(userId =>
      presenceManager.listenToPresence(userId, (data) => {
        setPresenceMap(prev => ({ ...prev, [userId]: data }));
      })
    );

    return () => unsubscribers.forEach(unsub => unsub());
  }, [userIds.join(',')]);

  return presenceMap;
}

export default presenceManager;
