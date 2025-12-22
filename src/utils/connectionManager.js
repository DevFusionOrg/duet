/**
 * Connection State Manager
 * Handles network state, reconnections, and offline mode
 */

import { onDisconnect, ref, set, serverTimestamp } from 'firebase/realtime-database';
import { database } from '../firebase/firebase';

class ConnectionManager {
  constructor() {
    this.isOnline = navigator.onLine;
    this.listeners = [];
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000; // Start with 1 second
    this.userId = null;

    this.init();
  }

  init() {
    // Listen to browser online/offline events
    window.addEventListener('online', () => this.handleOnline());
    window.addEventListener('offline', () => this.handleOffline());

    // Listen to Firebase connection state
    const connectedRef = ref(database, '.info/connected');
    set(connectedRef, (snapshot) => {
      if (snapshot.val() === true) {
        this.handleFirebaseConnected();
      } else {
        this.handleFirebaseDisconnected();
      }
    });

    console.log('[ConnectionManager] Initialized');
  }

  handleOnline() {
    console.log('[ConnectionManager] Browser online');
    this.isOnline = true;
    this.reconnectAttempts = 0;
    this.notifyListeners({ isOnline: true, isReconnecting: false });
  }

  handleOffline() {
    console.log('[ConnectionManager] Browser offline');
    this.isOnline = false;
    this.notifyListeners({ isOnline: false, isReconnecting: false });
  }

  handleFirebaseConnected() {
    console.log('[ConnectionManager] Firebase connected');
    this.reconnectAttempts = 0;
    this.reconnectDelay = 1000;
    this.notifyListeners({ isOnline: true, isReconnecting: false, firebaseConnected: true });

    // Update presence if user is logged in
    if (this.userId) {
      const presenceRef = ref(database, `presence/${this.userId}`);
      set(presenceRef, {
        isOnline: true,
        lastSeen: serverTimestamp(),
      });

      onDisconnect(presenceRef).set({
        isOnline: false,
        lastSeen: serverTimestamp(),
      });
    }
  }

  handleFirebaseDisconnected() {
    console.log('[ConnectionManager] Firebase disconnected');
    this.notifyListeners({ isOnline: false, isReconnecting: true, firebaseConnected: false });

    // Attempt to reconnect with exponential backoff
    this.attemptReconnect();
  }

  attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('[ConnectionManager] Max reconnect attempts reached');
      this.notifyListeners({ 
        isOnline: false, 
        isReconnecting: false, 
        error: 'Connection failed after multiple attempts' 
      });
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1), 30000);

    console.log(`[ConnectionManager] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

    setTimeout(() => {
      if (!this.isOnline) {
        this.notifyListeners({ 
          isOnline: false, 
          isReconnecting: true,
          reconnectAttempt: this.reconnectAttempts 
        });
      }
    }, delay);
  }

  setUserId(userId) {
    this.userId = userId;
  }

  subscribe(callback) {
    this.listeners.push(callback);
    // Immediately call with current state
    callback({ 
      isOnline: this.isOnline, 
      isReconnecting: false,
      firebaseConnected: true 
    });

    // Return unsubscribe function
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
    };
  }

  notifyListeners(state) {
    this.listeners.forEach(listener => listener(state));
  }

  getState() {
    return {
      isOnline: this.isOnline,
      reconnectAttempts: this.reconnectAttempts,
    };
  }
}

// Global instance
export const connectionManager = new ConnectionManager();

// React hook for connection state
export function useConnectionState() {
  const [state, setState] = React.useState({
    isOnline: navigator.onLine,
    isReconnecting: false,
    firebaseConnected: true,
  });

  React.useEffect(() => {
    const unsubscribe = connectionManager.subscribe(setState);
    return unsubscribe;
  }, []);

  return state;
}

export default connectionManager;
