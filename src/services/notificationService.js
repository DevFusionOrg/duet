import { db } from '../firebase/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { auth, messaging } from '../firebase/firebase'; // Make sure messaging is exported

class NotificationService  {
  constructor() {
    this.fcmToken = null;
    this.callListeners = [];
    this.messageListeners = [];
    this.isInitialized = false;
    this.ringtone = null;
  }

  async initialize() {
    if (this.isInitialized) return;
    
    console.log('Initializing notification service...');
    
    try {
      // Request notification permission
      if ('Notification' in window) {
        const permission = await Notification.requestPermission();
        console.log('Notification permission:', permission);
        
        if (permission === 'granted') {
          await this.setupFirebaseMessaging();
        }
      }
      
      this.isInitialized = true;
      console.log('Notification service initialized successfully');
      
    } catch (error) {
      console.error('Error initializing notification service:', error);
    }
  }

  async setupFirebaseMessaging() {
    try {
      // Get Firebase Cloud Messaging instance
      if (!messaging) {
        console.warn('Firebase Messaging not available');
        return;
      }
      
      // Get FCM token
      this.fcmToken = await messaging.getToken({
        vapidKey: 'YOUR_VAPID_KEY' // Get from Firebase Console -> Cloud Messaging -> Web Configuration
      });
      
      if (this.fcmToken) {
        console.log('FCM Token:', this.fcmToken);
        await this.saveTokenToFirestore(this.fcmToken);
      }
      
      // Listen for messages
      this.setupMessageListeners();
      
    } catch (error) {
      console.error('Error setting up Firebase Messaging:', error);
    }
  }

  async saveTokenToFirestore(token) {
    try {
      const user = auth.currentUser;
      if (user) {
        const tokenRef = doc(db, 'users', user.uid, 'tokens', token);
        await setDoc(tokenRef, {
          token: token,
          platform: 'web',
          createdAt: new Date().toISOString(),
          active: true,
          lastActive: new Date().toISOString()
        }, { merge: true });
        
        console.log('Token saved to Firestore');
        
        // Also save to localStorage
        localStorage.setItem('fcm_token', token);
      }
    } catch (error) {
      console.error('Error saving token to Firestore:', error);
    }
  }

  setupMessageListeners() {
    if (!messaging) return;
    
    // Handle foreground messages
    messaging.onMessage((payload) => {
      console.log('Foreground message received:', payload);
      this.handleFirebaseMessage(payload);
    });
    
    // Optional: Handle background messages via service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'FIREBASE_MESSAGE') {
          console.log('Background message received:', event.data.payload);
          this.handleFirebaseMessage(event.data.payload);
        }
      });
    }
  }

  handleFirebaseMessage(payload) {
    const { notification, data } = payload;
    
    if (data && data.type === 'call_notification') {
      this.handleCallNotification(notification, data);
    } else if (data && data.type === 'chat_message') {
      this.handleChatNotification(notification, data);
    } else {
      this.showLocalNotification(
        notification?.title || 'Notification',
        notification?.body || 'New notification',
        data
      );
    }
  }

  handleChatNotification(notification, data) {
    const { chatId, senderId, senderName, message, senderPhoto } = data;
    
    // Check if app is in foreground and viewing same chat
    const isAppInForeground = document.visibilityState === 'visible';
    const currentChatId = window.location.pathname.includes('/chat/') 
      ? window.location.pathname.split('/chat/')[1] 
      : null;
    
    // Don't show notification if user is in the same chat
    if (isAppInForeground && currentChatId === chatId) {
      return;
    }
    
    // Notify listeners
    this.messageListeners.forEach(listener => {
      listener({
        type: 'new_message',
        chatId,
        senderId,
        senderName,
        message,
        senderPhoto,
        timestamp: new Date().toISOString()
      });
    });
    
    // Show notification if app is in background
    if (!isAppInForeground) {
      this.showLocalNotification(
        `💬 ${senderName || 'New Message'}`,
        message || 'You have a new message',
        { 
          ...data, 
          type: 'chat_message',
          icon: senderPhoto || '/default-avatar.png'
        }
      );
    }
  }

  handleCallNotification(notification, data) {
    const { callId, callerId, callerName, callType, roomId, callerPhoto } = data;
    
    // Create call data object
    const callData = {
      type: 'incoming_call',
      callId,
      callerId,
      callerName: callerName || 'Unknown Caller',
      callerPhoto: callerPhoto || '/default-avatar.png',
      callType: callType || 'audio',
      roomId,
      timestamp: new Date().toISOString()
    };
    
    console.log('Incoming call received:', callData);
    
    // Notify call listeners (App.js will handle UI)
    this.callListeners.forEach(listener => {
      listener(callData);
    });
    
    // Play ringtone
    this.playRingtone();
    
    // Show notification (will be interactive)
    this.showCallNotification(callData);
    
    // Auto-reject after 45 seconds
    setTimeout(() => {
      this.handleCallTimeout(callId);
    }, 45000);
  }

  showCallNotification(callData) {
    this.showLocalNotification(
      `📞 Incoming ${callData.callType} Call`,
      `${callData.callerName} is calling`,
      {
        ...callData,
        type: 'call_notification',
        icon: callData.callerPhoto || '/default-avatar.png',
        requireInteraction: true
      }
    );
  }

  showLocalNotification(title, body, data = {}) {
    try {
      if ('Notification' in window && Notification.permission === 'granted') {
        const options = {
          body,
          icon: data.icon || '/logo1921.png',
          badge: '/logo1921.png',
          data,
          vibrate: data.type === 'call_notification' ? [300, 200, 300, 200, 300] : [200, 100, 200],
          requireInteraction: data.requireInteraction || false,
          tag: data.tag || `notification-${Date.now()}`
        };
        
        const notification = new Notification(title, options);
        
        notification.onclick = (event) => {
          event.preventDefault();
          notification.close();
          window.focus();
          
          if (data.type === 'call_notification') {
            // Show incoming call modal
            this.callListeners.forEach(listener => {
              listener({
                type: 'incoming_call',
                callId: data.callId,
                callerName: data.callerName,
                callerPhoto: data.callerPhoto,
                callType: data.callType,
                roomId: data.roomId
              });
            });
          } else if (data.chatId) {
            window.location.href = `/chat/${data.chatId}`;
          }
        };
        
        // Auto-close after 30 seconds for non-call notifications
        if (!data.requireInteraction) {
          setTimeout(() => {
            notification.close();
          }, 30000);
        }
      }
    } catch (error) {
      console.error('Error showing notification:', error);
    }
  }

  // Call management
  async acceptCall(callId) {
    this.stopRingtone();
    
    // Notify server
    await this.sendCallAction(callId, 'accepted');
    
    // Navigate to call page
    window.location.href = `/call/${callId}`;
  }

  async rejectCall(callId) {
    this.stopRingtone();
    
    // Notify server
    await this.sendCallAction(callId, 'rejected');
  }

  handleCallTimeout(callId) {
    this.stopRingtone();
    this.sendCallAction(callId, 'timeout');
  }

  async sendCallAction(callId, action) {
    try {
      const user = auth.currentUser;
      if (!user) return;
      
      const token = await user.getIdToken();
      
      // Send to your backend (Firebase Function or your server)
      const response = await fetch('https://your-backend.com/call-action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          callId,
          action,
          userId: user.uid,
          timestamp: new Date().toISOString()
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to send call action');
      }
      
      console.log(`Call ${action} sent to server`);
    } catch (error) {
      console.error('Error sending call action:', error);
    }
  }

  // Audio handling
  playRingtone() {
    if (this.ringtone) return;
    
    try {
      this.ringtone = new Audio('/ringtone.mp3');
      this.ringtone.loop = true;
      this.ringtone.volume = 0.7;
      
      const playPromise = this.ringtone.play();
      if (playPromise !== undefined) {
        playPromise.catch(error => {
          console.log('Ringtone autoplay prevented:', error);
          // User interaction is required for audio
          // We'll rely on notification sound instead
        });
      }
    } catch (error) {
      console.error('Error playing ringtone:', error);
    }
  }

  stopRingtone() {
    if (this.ringtone) {
      this.ringtone.pause();
      this.ringtone.currentTime = 0;
      this.ringtone = null;
    }
  }

  // Listener management
  addCallListener(listener) {
    this.callListeners.push(listener);
    return () => {
      this.callListeners = this.callListeners.filter(l => l !== listener);
    };
  }

  addMessageListener(listener) {
    this.messageListeners.push(listener);
    return () => {
      this.messageListeners = this.messageListeners.filter(l => l !== listener);
    };
  }

  // Get current token
  getCurrentToken() {
    return this.fcmToken || localStorage.getItem('fcm_token');
  }

  // Send notification to user (for testing)
  async sendNotificationToUser(userId, title, body, data = {}) {
    try {
      const user = auth.currentUser;
      if (!user) return;
      
      const token = await user.getIdToken();
      
      const response = await fetch('https://your-backend.com/send-notification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          userId,
          title,
          body,
          data,
          timestamp: new Date().toISOString()
        })
      });
      
      return response.ok;
    } catch (error) {
      console.error('Error sending notification:', error);
      return false;
    }
  }

  // Cleanup
  destroy() {
    this.stopRingtone();
    this.callListeners = [];
    this.messageListeners = [];
    this.isInitialized = false;
  }
}

// Singleton instance
export const notificationService = new NotificationService();