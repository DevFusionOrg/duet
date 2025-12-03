import { database, db } from '../firebase/firebase';
import { ref, set, onValue, remove, update, get, push, query, orderByChild, equalTo, onDisconnect } from 'firebase/database';
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

  // Create a new call with better validation
  async createCall(callerId, callerName, receiverId, receiverName) {
    try {
      // Check if there's already an active call between these users
      const activeCalls = await this.getActiveCallsForUser(callerId);
      const existingCall = activeCalls.find(call => 
        (call.callerId === callerId && call.receiverId === receiverId) ||
        (call.callerId === receiverId && call.receiverId === callerId)
      );
      
      if (existingCall && existingCall.status === 'ringing') {
        throw new Error('You already have an active call request with this user');
      }

      const callId = `${callerId}_${receiverId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const callData = {
        callId,
        callerId,
        callerName,
        receiverId,
        receiverName,
        status: 'ringing',
        createdAt: Date.now(),
        createdAtTimestamp: serverTimestamp(),
        type: 'audio',
        participants: [callerId, receiverId]
      };

      // Create call in Realtime Database
      const callRef = ref(database, `activeCalls/${callId}`);
      await set(callRef, callData);
      
      // Set up disconnect handler to clean up if caller disconnects
      const callerStatusRef = ref(database, `userStatus/${callerId}/activeCall`);
      await set(callerStatusRef, callId);
      onDisconnect(callerStatusRef).remove();

      // Log call creation to Firestore for history
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

      return { callId, ...callData };
    } catch (error) {
      console.error('Error creating call:', error);
      throw error;
    }
  }

  // Accept call with history logging
  async acceptCall(callId, receiverId) {
    try {
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

      await update(callRef, {
        status: 'accepted',
        acceptedAt: Date.now(),
        receiverId: receiverId,
        acceptedAtTimestamp: serverTimestamp()
      });

      // Update receiver's status
      const receiverStatusRef = ref(database, `userStatus/${receiverId}/activeCall`);
      await set(receiverStatusRef, callId);
      onDisconnect(receiverStatusRef).remove();

      // Log acceptance
      await this.logCallEvent({
        callId,
        event: 'accepted',
        userId: receiverId,
        details: {
          timestamp: new Date().toISOString()
        }
      });

      // Log to call history
      await this.addToCallHistory({
        ...callData,
        status: 'accepted',
        acceptedAt: Date.now(),
        acceptedBy: receiverId
      });

    } catch (error) {
      console.error('Error accepting call:', error);
      throw error;
    }
  }

  // Decline call with proper cleanup
  async declineCall(callId, receiverId) {
    try {
      const callRef = ref(database, `activeCalls/${callId}`);
      const snapshot = await get(callRef);
      const callData = snapshot.val();
      
      if (!callData) {
        throw new Error('Call not found');
      }

      // Validate receiver
      if (callData.receiverId !== receiverId) {
        throw new Error('Unauthorized to decline this call');
      }

      await update(callRef, {
        status: 'declined',
        declinedAt: Date.now(),
        declinedBy: receiverId,
        declinedAtTimestamp: serverTimestamp()
      });

      // Log decline
      await this.logCallEvent({
        callId,
        event: 'declined',
        userId: receiverId,
        details: {
          timestamp: new Date().toISOString()
        }
      });

      // Log to call history as missed
      await this.addToCallHistory({
        ...callData,
        status: 'missed',
        endedAt: Date.now(),
        endedBy: receiverId,
        duration: 0
      });

      // Remove after some time
      setTimeout(() => {
        remove(callRef).catch(() => {});
        
        // Clean up user status
        const callerStatusRef = ref(database, `userStatus/${callData.callerId}/activeCall`);
        remove(callerStatusRef).catch(() => {});
      }, 5000);

    } catch (error) {
      console.error('Error declining call:', error);
      throw error;
    }
  }

  // Enhanced end call with comprehensive logging
  async endCall(callId, userId, duration = 0, status = 'ended') {
    try {
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
        throw new Error('Unauthorized to end this call');
      }

      // Determine final status
      let finalStatus = status;
      if (status === 'ended' && duration === 0) {
        finalStatus = 'missed';
      }

      // Update call status
      const updateData = {
        status: finalStatus,
        endedAt: Date.now(),
        duration: duration || 0,
        endedBy: userId,
        endedAtTimestamp: serverTimestamp()
      };

      await update(callRef, updateData);

      // Log end event
      await this.logCallEvent({
        callId,
        event: 'ended',
        userId: userId,
        details: {
          status: finalStatus,
          duration,
          timestamp: new Date().toISOString()
        }
      });

      // Save to call history
      const historyData = {
        ...callData,
        ...updateData,
        participants: [callData.callerId, callData.receiverId],
        endedAt: Date.now(),
        endedAtTimestamp: serverTimestamp()
      };

      await this.addToCallHistory(historyData);

      // Also save to user-specific call history
      await this.addToUserCallHistory(callData.callerId, historyData);
      await this.addToUserCallHistory(callData.receiverId, historyData);

      // Clean up user status
      const callerStatusRef = ref(database, `userStatus/${callData.callerId}/activeCall`);
      const receiverStatusRef = ref(database, `userStatus/${callData.receiverId}/activeCall`);
      
      await remove(callerStatusRef).catch(() => {});
      await remove(receiverStatusRef).catch(() => {});

      // Remove active call after delay
      setTimeout(() => {
        remove(callRef).catch(() => {});
      }, 3000);

    } catch (error) {
      console.error('Error ending call:', error);
      throw error;
    }
  }

  // Listen for incoming calls with better filtering
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
            // Add additional validation
            call.callId = callId; // Ensure callId is set
            incomingCalls.push(call);
          }
        });
      }
      
      console.log('Filtered incoming calls for', userId, ':', incomingCalls.length);
      callback(incomingCalls);
    }, (error) => {
      console.error('Error listening for calls:', error);
    });

    return unsubscribe;
  }

  // Send call notification to chat with better formatting
  async sendCallNotification(chatId, userId, friendId, type, duration = 0) {
    try {
      if (!chatId) {
        console.log('No chatId for call notification');
        return;
      }

      const messagesRef = collection(db, 'chats', chatId, 'messages');
      
      let messageText = '';
      let icon = '📞';
      
      if (type === 'started') {
        messageText = 'Audio call started';
        icon = '📞';
      } else if (type === 'ended') {
        if (duration > 0) {
          messageText = `Audio call ended (${this.formatDuration(duration)})`;
        } else {
          messageText = 'Audio call ended';
        }
        icon = '📞';
      } else if (type === 'missed') {
        messageText = 'Missed audio call';
        icon = '❌';
      } else if (type === 'declined') {
        messageText = 'Declined audio call';
        icon = '❌';
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
        icon: icon,
        read: false,
        readBy: null,
        readAt: null,
        seenBy: [],
        deletionTime: deletionTime,
        isSaved: false,
        isEdited: false,
        metadata: {
          eventType: 'call',
          callAction: type,
          duration: duration
        }
      });

      // Update chat last message
      const chatRef = doc(db, 'chats', chatId);
      await updateDoc(chatRef, {
        lastMessage: messageText,
        lastMessageAt: new Date(),
        lastMessageType: 'call'
      });

      console.log('Call notification sent:', { type, duration, chatId });

    } catch (error) {
      console.error('Error sending call notification:', error);
    }
  }

  // Format duration (seconds to MM:SS)
  formatDuration(seconds) {
    if (!seconds || seconds <= 0) return '0:00';
    
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  // Get active calls for a user
  async getActiveCallsForUser(userId) {
    try {
      const q = query(
        ref(database, 'activeCalls'),
        orderByChild('participants'),
        equalTo(userId)
      );
      
      const snapshot = await get(q);
      const calls = snapshot.val();
      
      if (!calls) return [];
      
      return Object.keys(calls).map(callId => ({
        callId,
        ...calls[callId]
      })).filter(call => 
        call.status !== 'ended' && 
        call.status !== 'declined' && 
        call.status !== 'missed'
      );
    } catch (error) {
      console.error('Error getting active calls:', error);
      return [];
    }
  }

  // Get call history for user from Firestore
  async getCallHistory(userId, limitCount = 50) {
    try {
      const q = firestoreQuery(
        collection(db, 'userCallHistory'),
        where('userId', '==', userId),
        orderBy('endedAt', 'desc'),
        limit(limitCount)
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

  // Get recent calls with a specific user
  async getCallsWithUser(userId, friendId, limitCount = 20) {
    try {
      const q = firestoreQuery(
        collection(db, 'callHistory'),
        where('participants', 'array-contains', userId),
        orderBy('endedAt', 'desc'),
        limit(limitCount)
      );
      
      const snapshot = await getDocs(q);
      const allCalls = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // Filter calls with the specific friend
      return allCalls.filter(call => 
        call.participants.includes(friendId)
      );
    } catch (error) {
      console.error('Error getting calls with user:', error);
      return [];
    }
  }

  // Log individual call event for debugging/analytics
  async logCallEvent(eventData) {
    try {
      const eventLogRef = collection(db, 'callEvents');
      await addDoc(eventLogRef, {
        ...eventData,
        timestamp: new Date().toISOString(),
        serverTimestamp: serverTimestamp()
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
        loggedAt: new Date().toISOString(),
        serverTimestamp: serverTimestamp()
      });
    } catch (error) {
      console.error('Error adding to call history:', error);
      throw error;
    }
  }

  // Add call to user-specific call history
  async addToUserCallHistory(userId, callData) {
    try {
      const userHistoryRef = doc(collection(db, 'userCallHistory'));
      await setDoc(userHistoryRef, {
        ...callData,
        userId: userId,
        loggedAt: new Date().toISOString(),
        serverTimestamp: serverTimestamp(),
        // Add summary for quick display
        summary: {
          with: callData.callerId === userId ? callData.receiverName : callData.callerName,
          duration: callData.duration || 0,
          status: callData.status,
          timestamp: callData.endedAt || callData.createdAt,
          type: callData.type || 'audio'
        }
      });
    } catch (error) {
      console.error('Error adding to user call history:', error);
      throw error;
    }
  }

  // Get call statistics for user
  async getCallStats(userId) {
    try {
      const history = await this.getCallHistory(userId, 1000); // Get large batch
      
      const stats = {
        totalCalls: history.length,
        completedCalls: history.filter(call => call.status === 'ended' && call.duration > 0).length,
        missedCalls: history.filter(call => call.status === 'missed').length,
        declinedCalls: history.filter(call => call.status === 'declined').length,
        totalDuration: history.reduce((sum, call) => sum + (call.duration || 0), 0),
        averageDuration: 0,
        recentCalls: history.slice(0, 10)
      };
      
      if (stats.completedCalls > 0) {
        const completedDurations = history
          .filter(call => call.status === 'ended' && call.duration > 0)
          .map(call => call.duration);
        
        stats.averageDuration = Math.round(
          completedDurations.reduce((sum, duration) => sum + duration, 0) / 
          completedDurations.length
        );
      }
      
      return stats;
    } catch (error) {
      console.error('Error getting call stats:', error);
      return {
        totalCalls: 0,
        completedCalls: 0,
        missedCalls: 0,
        declinedCalls: 0,
        totalDuration: 0,
        averageDuration: 0,
        recentCalls: []
      };
    }
  }

  // Clean up stale calls (calls older than 24 hours)
  async cleanupStaleCalls() {
    try {
      const now = Date.now();
      const oneDayAgo = now - (24 * 60 * 60 * 1000);
      
      const callsRef = ref(database, 'activeCalls');
      const snapshot = await get(callsRef);
      const calls = snapshot.val();
      
      if (!calls) return;
      
      const cleanupPromises = Object.keys(calls).map(async (callId) => {
        const call = calls[callId];
        
        // Clean up calls older than 1 day
        if (call.createdAt && call.createdAt < oneDayAgo) {
          await remove(ref(database, `activeCalls/${callId}`));
          
          // Log as expired
          await this.addToCallHistory({
            ...call,
            callId,
            status: 'expired',
            endedAt: now,
            endedBy: 'system',
            duration: 0
          });
        }
        
        // Clean up ringing calls older than 5 minutes
        if (call.status === 'ringing' && call.createdAt && (now - call.createdAt) > (5 * 60 * 1000)) {
          await this.endCall(callId, 'system', 0, 'missed');
        }
      });
      
      await Promise.all(cleanupPromises);
      console.log('Stale calls cleaned up');
    } catch (error) {
      console.error('Error cleaning up stale calls:', error);
    }
  }
}

// Initialize and run periodic cleanup
const callServiceInstance = new CallService();

// Run cleanup every hour
setInterval(() => {
  callServiceInstance.cleanupStaleCalls();
}, 60 * 60 * 1000);

// Run immediate cleanup on startup
setTimeout(() => {
  callServiceInstance.cleanupStaleCalls();
}, 5000);

export default callServiceInstance;