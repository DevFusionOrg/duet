import { database, db } from '../firebase/firebase';
import { ref, set, onValue, remove, update, get } from 'firebase/database';
import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc
} from 'firebase/firestore';

class CallService {
  constructor() {
    this.activeCallsRef = ref(database, 'activeCalls');
  }

  // Create a new audio call
  async createCall(callerId, callerName, receiverId, receiverName) {
    try {
      const callId = `${callerId}_${receiverId}_${Date.now()}`;
      
      const callData = {
        callId,
        callerId,
        callerName,
        receiverId,
        receiverName,
        status: 'ringing',
        createdAt: Date.now(),
        type: 'audio',
        acceptedAt: null,
        endedAt: null,
        duration: 0
      };

      // Create call in Realtime Database
      const callRef = ref(database, `activeCalls/${callId}`);
      await set(callRef, callData);

      return { callId, ...callData };
    } catch (error) {
      console.error('❌ Error creating audio call:', error);
      throw error;
    }
  }

  // Create a video call
  async createVideoCall(callerId, callerName, receiverId, receiverName) {
    try {
      const callId = `${callerId}_${receiverId}_${Date.now()}`;
      
      const callData = {
        callId,
        callerId,
        callerName,
        receiverId,
        receiverName,
        status: 'ringing',
        createdAt: Date.now(),
        type: 'video',
        acceptedAt: null,
        endedAt: null,
        duration: 0
      };

      // Create call in Realtime Database
      const callRef = ref(database, `activeCalls/${callId}`);
      await set(callRef, callData);

      return { callId, ...callData };
    } catch (error) {
      console.error('❌ Error creating video call:', error);
      throw error;
    }
  }

  // Accept call
  async acceptCall(callId, receiverId) {
    try {
      const callRef = ref(database, `activeCalls/${callId}`);
      const snapshot = await get(callRef);
      const callData = snapshot.val();
      
      if (!callData) {
        throw new Error('Call not found');
      }
      
      if (callData.receiverId !== receiverId) {
        throw new Error('Unauthorized to accept this call');
      }

      await update(callRef, {
        status: 'accepted',
        acceptedAt: Date.now()
      });

      return callData;
    } catch (error) {
      console.error('❌ Error accepting call:', error);
      throw error;
    }
  }

  // Decline call
  async declineCall(callId, receiverId) {
    try {
      const callRef = ref(database, `activeCalls/${callId}`);
      const snapshot = await get(callRef);
      const callData = snapshot.val();
      
      if (!callData) {
        return; // Call already ended, no need to decline
      }

      await update(callRef, {
        status: 'declined',
        endedAt: Date.now()
      });

      // Remove after delay
      setTimeout(() => {
        remove(callRef).catch(() => {});
      }, 30000);

    } catch (error) {
      console.error('❌ Error declining call:', error);
      throw error;
    }
  }

  // End call
  async endCall(callId, userId, duration = 0, status = 'ended') {
    try {
      const callRef = ref(database, `activeCalls/${callId}`);
      const snapshot = await get(callRef);
      const callData = snapshot.val();

      if (!callData) {
        return;
      }

      // Validate user
      const isParticipant = callData.callerId === userId || callData.receiverId === userId;
      if (!isParticipant) {
        console.warn('User not authorized to end this call');
        return;
      }

      const finalStatus = status === 'ended' && duration === 0 ? 'missed' : status;

      await update(callRef, {
        status: finalStatus,
        endedAt: Date.now(),
        duration: duration || 0
      });

      // Remove after delay
      setTimeout(() => {
        remove(callRef).catch(() => {});
      }, 3000);

      
    } catch (error) {
      console.error('❌ Error ending call:', error);
    }
  }

  // Listen for incoming calls
  listenForIncomingCalls(userId, callback) {
    const callsRef = ref(database, 'activeCalls');
    
    const unsubscribe = onValue(callsRef, (snapshot) => {
      const calls = snapshot.val();
      const incomingCalls = [];
      
      if (calls) {
        Object.keys(calls).forEach(callId => {
          const call = calls[callId];
          // Only show ringing calls for this user
          if (call.receiverId === userId && call.status === 'ringing') {
            incomingCalls.push({ ...call, callId });
          }
        });
      }
      
      callback(incomingCalls);
    }, (error) => {
      console.error('❌ Error listening for calls:', error);
      callback([]);
    });

    return unsubscribe;
  }

  // Send call notification to chat
  async sendCallNotification(chatId, userId, friendId, type, duration = 0, callData = null) {
    try {
      if (!chatId) {
        return;
      }

      const messagesRef = collection(db, 'chats', chatId, 'messages');
      
      let messageText = '';
      let senderId = '';
      let callAction = '';
      let callInitiatorId = '';
      
      // Only create message for actual calls (with duration) or missed calls
      if (type === 'ended') {
        if (duration > 0) {
          messageText = `📞 Call`;
          callAction = 'ended';
        } else {
          messageText = `📞 Missed call`;
          callAction = 'missed';
        }
        
        if (callData && callData.callerId) {
          callInitiatorId = callData.callerId;
          senderId = callInitiatorId;
        } else {
          callInitiatorId = userId;
          senderId = userId;
        }
      } else if (type === 'missed') {
        messageText = `📞 Missed call`;
        senderId = friendId;
        callAction = 'missed';
        callInitiatorId = friendId;
      }

      // Only send message if it's a valid type
      if (messageText) {
        await addDoc(messagesRef, {
          senderId: senderId,
          text: messageText,
          timestamp: new Date(),
          type: 'call',
          callType: type,
          callAction: callAction,
          callDuration: duration,
          callInitiatorId: callInitiatorId,
          read: false,
          deletionTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
          isCallLog: true
        });

        // Update chat last message
        const chatRef = doc(db, 'chats', chatId);
        await updateDoc(chatRef, {
          lastMessage: messageText,
          lastMessageAt: new Date()
        });
      }

    } catch (error) {
      console.error('❌ Error sending call notification:', error);
    }
  }

  // Send video call notification to chat
  async sendVideoCallNotification(chatId, userId, friendId, type, duration = 0, callData = null) {
    try {
      if (!chatId) {
        return;
      }

      const messagesRef = collection(db, 'chats', chatId, 'messages');
      
      let messageText = '';
      let senderId = '';
      let callAction = '';
      let callInitiatorId = '';
      
      // Only create message for actual calls (with duration) or missed calls
      if (type === 'ended') {
        if (duration > 0) {
          messageText = `📹 Call`;
          callAction = 'ended';
        } else {
          messageText = `📹 Missed call`;
          callAction = 'missed';
        }
        
        if (callData && callData.callerId) {
          callInitiatorId = callData.callerId;
          senderId = callInitiatorId;
        } else {
          callInitiatorId = userId;
          senderId = userId;
        }
      } else if (type === 'missed') {
        messageText = `📹 Missed call`;
        senderId = friendId;
        callAction = 'missed';
        callInitiatorId = friendId;
      }

      // Only send message if it's a valid type
      if (messageText) {
        await addDoc(messagesRef, {
          senderId: senderId,
          text: messageText,
          timestamp: new Date(),
          type: 'video-call',
          callType: type,
          callAction: callAction,
          callDuration: duration,
          callInitiatorId: callInitiatorId,
          read: false,
          deletionTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
          isCallLog: true
        });

        // Update chat last message
        const chatRef = doc(db, 'chats', chatId);
        await updateDoc(chatRef, {
          lastMessage: messageText,
          lastMessageAt: new Date()
        });
      }

    } catch (error) {
      console.error('❌ Error sending video call notification:', error);
    }
  }

  formatDuration(seconds) {
    if (!seconds || seconds <= 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
}

// Initialize service
const callServiceInstance = new CallService();

export default callServiceInstance;