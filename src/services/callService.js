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

  // Create a new call
  async createCall(callerId, callerName, receiverId, receiverName) {
    try {
      console.log('📞 Creating call from', callerName, 'to', receiverName);
      
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
      console.log('✅ Call created:', callId);

      return { callId, ...callData };
    } catch (error) {
      console.error('❌ Error creating call:', error);
      throw error;
    }
  }

  // Accept call
  async acceptCall(callId, receiverId) {
    try {
      console.log('📞 Accepting call:', callId);
      
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

      console.log('✅ Call accepted');
      return callData;
    } catch (error) {
      console.error('❌ Error accepting call:', error);
      throw error;
    }
  }

  // Decline call
  async declineCall(callId, receiverId) {
    try {
      console.log('📞 Declining call:', callId);
      
      const callRef = ref(database, `activeCalls/${callId}`);
      const snapshot = await get(callRef);
      const callData = snapshot.val();
      
      if (!callData) {
        throw new Error('Call not found');
      }

      await update(callRef, {
        status: 'declined',
        endedAt: Date.now()
      });

      // Remove after delay
      setTimeout(() => {
        remove(callRef).catch(() => {});
      }, 30000);

      console.log('✅ Call declined' ,  finalStatus);
    } catch (error) {
      console.error('❌ Error declining call:', error);
      throw error;
    }
  }

  // End call
  async endCall(callId, userId, duration = 0, status = 'ended') {
    try {
      console.log('📞 Ending call:', callId, 'status:', status);
      
      const callRef = ref(database, `activeCalls/${callId}`);
      const snapshot = await get(callRef);
      const callData = snapshot.val();

      if (!callData) {
        console.log('Call already ended');
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

      console.log('✅ Call ended:', finalStatus);
      
    } catch (error) {
      console.error('❌ Error ending call:', error);
    }
  }

  // Listen for incoming calls
  listenForIncomingCalls(userId, callback) {
    console.log('👂 Setting up call listener for user:', userId);
    
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
      
      console.log('📞 Incoming calls for', userId, ':', incomingCalls.length);
      callback(incomingCalls);
    }, (error) => {
      console.error('❌ Error listening for calls:', error);
      callback([]);
    });

    return unsubscribe;
  }

  // Send call notification to chat
  async sendCallNotification(chatId, userId, friendId, type, duration = 0) {
    try {
      if (!chatId) {
        console.log('No chatId for call notification');
        return;
      }

      const messagesRef = collection(db, 'chats', chatId, 'messages');
      
      let messageText = '';
      if (type === 'started') {
        messageText = 'Audio call started';
      } else if (type === 'ended') {
        messageText = duration > 0 
          ? `Audio call ended (${this.formatDuration(duration)})` 
          : 'Audio call ended';
      } else if (type === 'missed') {
        messageText = 'Missed audio call';
      }

      await addDoc(messagesRef, {
        senderId: 'system',
        text: messageText,
        timestamp: new Date(),
        type: 'call',
        callType: type,
        callDuration: duration,
        read: false,
        deletionTime: new Date(Date.now() + 24 * 60 * 60 * 1000)
      });

      // Update chat last message
      const chatRef = doc(db, 'chats', chatId);
      await updateDoc(chatRef, {
        lastMessage: messageText,
        lastMessageAt: new Date()
      });

      console.log('📢 Call notification sent:', type);

    } catch (error) {
      console.error('❌ Error sending call notification:', error);
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