import { database, db } from '../firebase/firebase';
import { ref, set, onValue, remove, update, get } from 'firebase/database';
import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc,
  setDoc,
  getDoc,
  query as firestoreQuery, 
  where, 
  orderBy, 
  limit,
  getDocs,
  serverTimestamp 
} from 'firebase/firestore';

class CallService {
  constructor() {
    this.activeCallsRef = ref(database, 'activeCalls');
    this.callHistoryRef = collection(db, 'callHistory');
    this.userCallHistoryRef = collection(db, 'userCallHistory');
  }

  // SIMPLIFIED: Create a new call without Firestore timestamps
  async createCall(callerId, callerName, receiverId, receiverName) {
    try {
      console.log('Creating call from', callerId, 'to', receiverId);
      
      // Generate unique call ID
      const callId = `${callerId}_${receiverId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // SIMPLIFIED call data for Realtime Database
      const callData = {
        callId,
        callerId,
        callerName,
        receiverId,
        receiverName,
        status: 'ringing',
        createdAt: Date.now(),
        type: 'audio'
      };

      console.log('Call data:', callData);

      // Create call in Realtime Database (SIMPLIFIED)
      const callRef = ref(database, `activeCalls/${callId}`);
      
      // Use set() with simpler data
      await set(callRef, callData);
      console.log('Call created in Realtime Database');

      // Log to Firestore for history (optional)
      try {
        await this.logCallEvent({
          callId,
          event: 'created',
          userId: callerId,
          details: {
            receiverId,
            receiverName,
            timestamp: new Date().toISOString()
          }
        });
      } catch (logError) {
        console.warn('Failed to log call event:', logError);
        // Don't throw, this is just logging
      }

      return { callId, ...callData };
    } catch (error) {
      console.error('Error creating call:', error);
      
      // Provide more helpful error message
      if (error.message.includes('PERMISSION_DENIED')) {
        throw new Error('Permission denied. Please check Firebase security rules.');
      }
      
      throw error;
    }
  }

  // SIMPLIFIED: Accept call
  async acceptCall(callId, receiverId) {
    try {
      console.log('Accepting call:', callId, 'by:', receiverId);
      
      const callRef = ref(database, `activeCalls/${callId}`);
      const snapshot = await get(callRef);
      const callData = snapshot.val();
      
      if (!callData) {
        throw new Error('Call not found');
      }
      
      // Validate receiver
      if (callData.receiverId !== receiverId) {
        throw new Error('Unauthorized to accept this call');
      }

      // SIMPLIFIED update
      await update(callRef, {
        status: 'accepted',
        acceptedAt: Date.now()
      });

      console.log('Call accepted successfully');
      
      return callData;
    } catch (error) {
      console.error('Error accepting call:', error);
      throw error;
    }
  }

  // SIMPLIFIED: Decline call
  async declineCall(callId, receiverId) {
    try {
      console.log('Declining call:', callId);
      
      const callRef = ref(database, `activeCalls/${callId}`);
      const snapshot = await get(callRef);
      const callData = snapshot.val();
      
      if (!callData) {
        throw new Error('Call not found');
      }

      // SIMPLIFIED update
      await update(callRef, {
        status: 'declined',
        declinedAt: Date.now()
      });

      // Remove after some time
      setTimeout(() => {
        remove(callRef).catch(() => {});
      }, 5000);

      console.log('Call declined successfully');
      
    } catch (error) {
      console.error('Error declining call:', error);
      throw error;
    }
  }

  // SIMPLIFIED: End call
  async endCall(callId, userId, duration = 0, status = 'ended') {
    try {
      console.log('Ending call:', callId, 'by:', userId);
      
      const callRef = ref(database, `activeCalls/${callId}`);
      const snapshot = await get(callRef);
      const callData = snapshot.val();

      if (!callData) {
        console.log('Call already ended or not found:', callId);
        return;
      }

      // Validate user can end this call
      const isParticipant = callData.callerId === userId || callData.receiverId === userId;
      if (!isParticipant) {
        console.warn('User not authorized to end this call:', userId);
        return;
      }

      let finalStatus = status;
      if (status === 'ended' && duration === 0) {
        finalStatus = 'missed';
      }

      // SIMPLIFIED update
      const updateData = {
        status: finalStatus,
        endedAt: Date.now(),
        duration: duration || 0,
        endedBy: userId
      };

      await update(callRef, updateData);

      // Save to Firestore history (optional)
      try {
        const historyData = {
          ...callData,
          ...updateData,
          endedAt: Date.now()
        };

        await this.addToCallHistory(historyData);
      } catch (historyError) {
        console.warn('Failed to save call history:', historyError);
      }

      // Remove active call after delay
      setTimeout(() => {
        remove(callRef).catch(() => {});
      }, 3000);

      console.log('Call ended successfully:', finalStatus);
      
    } catch (error) {
      console.error('Error ending call:', error);
      // Don't throw, just log
    }
  }

  // Listen for incoming calls
  listenForIncomingCalls(userId, callback) {
    console.log('Setting up call listener for user:', userId);
    
    const callsRef = ref(database, 'activeCalls');
    
    const unsubscribe = onValue(callsRef, (snapshot) => {
      const calls = snapshot.val();
      const incomingCalls = [];
      
      if (calls) {
        Object.keys(calls).forEach(callId => {
          const call = calls[callId];
          
          // Only show ringing calls for this specific user
          if (call.receiverId === userId && call.status === 'ringing') {
            call.callId = callId; // Ensure callId is set
            incomingCalls.push(call);
          }
        });
      }
      
      console.log('Incoming calls for', userId, ':', incomingCalls.length);
      callback(incomingCalls);
    }, (error) => {
      console.error('Error listening for calls:', error);
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

      console.log('Call notification sent:', type);

    } catch (error) {
      console.error('Error sending call notification:', error);
    }
  }

  formatDuration(seconds) {
    if (!seconds || seconds <= 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  // Log individual call event
  async logCallEvent(eventData) {
    try {
      const eventLogRef = collection(db, 'callEvents');
      await addDoc(eventLogRef, {
        ...eventData,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.warn('Failed to log call event:', error);
    }
  }

  // Add call to main call history
  async addToCallHistory(callData) {
    try {
      const historyRef = collection(db, 'callHistory');
      await addDoc(historyRef, {
        ...callData,
        loggedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error adding to call history:', error);
    }
  }
}

// Initialize service
const callServiceInstance = new CallService();

export default callServiceInstance;