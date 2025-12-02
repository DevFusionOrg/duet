import { database, db } from '../firebase/firebase'; // Import both
import { ref, set, onValue, remove, update, get } from 'firebase/database';
import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc,
  query, 
  where, 
  orderBy, 
  limit,
  getDocs 
} from 'firebase/firestore';

class CallService {
  constructor() {
    // Use 'database' for Realtime Database, 'db' for Firestore
    this.activeCallsRef = ref(database, 'activeCalls');
    this.callHistoryRef = collection(db, 'callHistory');
  }

  // Create a new call
  async createCall(callerId, callerName, receiverId, receiverName) {
    const callId = `${callerId}_${receiverId}_${Date.now()}`;
    
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

    // Create call in Realtime Database
    const callRef = ref(database, `activeCalls/${callId}`);
    await set(callRef, callData);

    return { callId, ...callData };
  }

  // Accept call
  async acceptCall(callId, receiverId) {
    const callRef = ref(database, `activeCalls/${callId}`);
    await update(callRef, {
      status: 'accepted',
      acceptedAt: Date.now(),
      receiverId
    });
  }

  // Decline call
  async declineCall(callId, receiverId) {
    const callRef = ref(database, `activeCalls/${callId}`);
    await update(callRef, {
      status: 'declined',
      declinedAt: Date.now(),
      receiverId
    });

    // Remove after some time
    setTimeout(() => {
      remove(callRef);
    }, 5000);
  }

  // End call
  async endCall(callId, userId, duration, status = 'ended') {
    const callRef = ref(database, `activeCalls/${callId}`);
    
    // Get call data first
    const snapshot = await get(callRef);
    const callData = snapshot.val();

    if (callData) {
        // Update call status before removing
        await update(callRef, {
            status: status,
            endedAt: Date.now(),
            duration: duration || 0,
            endedBy: userId
        });
        // Save to call history in Firestore
        await addDoc(this.callHistoryRef, {
            ...callData,
            endedAt: Date.now(),
            duration: duration || 0,
            endedBy: userId,
            status: 'ended'
        });
    }

    // Remove active call
    setTimeout(() => {
        remove(callRef);
    }, 3000);
  }

  // Listen for incoming calls
  listenForIncomingCalls(userId, callback) {
    const callsRef = ref(database, 'activeCalls');
    
    return onValue(callsRef, (snapshot) => {
      const calls = snapshot.val();
      const incomingCalls = [];
      
      if (calls) {
        Object.keys(calls).forEach(callId => {
          const call = calls[callId];
          if (call.receiverId === userId && call.status === 'ringing') {
            incomingCalls.push(call);
          }
        });
      }
      
      callback(incomingCalls);
    });
  }

  // Send call notification to chat
  async sendCallNotification(chatId, userId, friendId, type, duration) {
    try {
      const messagesRef = collection(db, 'chats', chatId, 'messages');
      
      let messageText = '';
      if (type === 'started') {
        messageText = 'Audio call started';
      } else if (type === 'ended') {
        messageText = duration ? `Audio call ended (${this.formatDuration(duration)})` : 'Audio call ended';
      } else if (type === 'missed') {
        messageText = 'Missed audio call';
      }
      
      const deletionTime = new Date();
      deletionTime.setHours(deletionTime.getHours() + 24);

      await addDoc(messagesRef, {
        senderId: 'system',
        text: messageText,
        timestamp: new Date(),
        type: 'call',
        callType: type,
        callDuration: duration,
        read: false,
        readBy: null,
        readAt: null,
        seenBy: [],
        deletionTime: deletionTime,
        isSaved: false,
        isEdited: false
      });

      // Update chat last message
      const chatRef = doc(db, 'chats', chatId);
      await updateDoc(chatRef, {
        lastMessage: messageText,
        lastMessageAt: new Date()
      });

    } catch (error) {
      console.error('Error sending call notification:', error);
    }
  }

  // Format duration (seconds to MM:SS)
  formatDuration(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  // Get call logs for user
  async getCallHistory(userId) {
    try {
      const q = query(
        this.callHistoryRef,
        where('participants', 'array-contains', userId),
        orderBy('endedAt', 'desc'),
        limit(50)
      );
      
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Error getting call history:', error);
      return [];
    }
  }
}

export default new CallService();