/**
 * Listener Management Layer
 * Prevents duplicate listeners and manages subscriptions efficiently
 * 
 * This is a crucial performance optimization that prevents multiple
 * components from creating redundant listeners for the same data.
 */

class ListenerCache {
  constructor() {
    this.listeners = new Map(); // key -> { unsubscribe, refCount, data }
    this.timers = new Map(); // key -> timeout ID for cleanup
  }

  /**
   * Get or create a listener, reusing existing ones
   * @param {string} key - Unique identifier for the listener
   * @param {Function} createListener - Function that creates the listener
   * @param {Function} onData - Callback when data updates
   * @returns {Function} Unsubscribe function
   */
  getOrCreate(key, createListener, onData) {
    let entry = this.listeners.get(key);

    if (entry) {
      // Listener already exists, reuse it
      entry.refCount++;
      console.log(`[ListenerCache] Reusing listener for ${key}, refCount: ${entry.refCount}`);
      
      // Immediately call with cached data
      if (entry.data !== undefined) {
        onData(entry.data);
      }
      
      // Return unsubscribe function that decrements refCount
      return () => this.unsubscribe(key);
    }

    // Create new listener
    console.log(`[ListenerCache] Creating listener for ${key}`);
    
    const unsubscribeOriginal = createListener((data) => {
      // Update cached data
      if (entry) entry.data = data;
      // Call all registered callbacks
      if (entry && entry.callbacks) {
        entry.callbacks.forEach(cb => cb(data));
      }
    });

    entry = {
      unsubscribe: unsubscribeOriginal,
      refCount: 1,
      callbacks: [onData],
      data: undefined,
    };

    this.listeners.set(key, entry);

    // Clear any pending cleanup timer for this key
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
      this.timers.delete(key);
    }

    // Return unsubscribe function for this consumer
    return () => this.unsubscribe(key);
  }

  unsubscribe(key) {
    const entry = this.listeners.get(key);
    if (!entry) return;

    entry.refCount--;
    console.log(`[ListenerCache] Unsubscribe from ${key}, refCount: ${entry.refCount}`);

    // Keep listener alive a bit longer in case component remounts quickly
    if (entry.refCount <= 0) {
      const timerId = setTimeout(() => {
        console.log(`[ListenerCache] Cleaning up listener for ${key}`);
        const current = this.listeners.get(key);
        if (current && current.refCount <= 0) {
          current.unsubscribe();
          this.listeners.delete(key);
          this.timers.delete(key);
        }
      }, 5000); // 5 second grace period

      this.timers.set(key, timerId);
    }
  }

  clear() {
    this.listeners.forEach(entry => {
      entry.unsubscribe();
      if (this.timers.has(entry.key)) {
        clearTimeout(this.timers.get(entry.key));
      }
    });
    this.listeners.clear();
    this.timers.clear();
  }
}

// Global instance
export const listenerCache = new ListenerCache();

/**
 * Hook to use cached listeners
 * Example:
 * useCachedListener('friends_' + userId, () => listenToUserFriends(userId, cb), cb)
 */
export function useCachedListener(key, createListener, callback) {
  const unsubscribeRef = React.useRef(null);

  React.useEffect(() => {
    unsubscribeRef.current = listenerCache.getOrCreate(
      key,
      createListener,
      callback
    );

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, [key, callback, createListener]);
}

export default listenerCache;
