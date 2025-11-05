import { db } from './firebase';
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc,
  addDoc,
  deleteDoc,
  arrayUnion, 
  arrayRemove, 
  query, 
  where, 
  getDocs,
  onSnapshot,
  orderBy,
  writeBatch
} from 'firebase/firestore';

// Create or update user profile in Firestore
export const createUserProfile = async (user) => {
  if (!user) return;
  
  try {
    const userRef = doc(db, 'users', user.uid);
    const userSnap = await getDoc(userRef);
    
    if (!userSnap.exists()) {
      // New user - create profile
      await setDoc(userRef, {
        uid: user.uid,
        displayName: user.displayName,
        email: user.email,
        photoURL: user.photoURL,
        username: user.email.split('@')[0], // Default username
        bio: '',
        friends: [],
        friendRequests: [],
        createdAt: new Date()
      });
      console.log("New user profile created");
    } else {
      // Existing user - update basic info if needed
      await updateDoc(userRef, {
        displayName: user.displayName,
        photoURL: user.photoURL
      });
    }
  } catch (error) {
    console.error("Error creating user profile:", error);
    throw error; // Re-throw to handle in calling function
  }
};

// Get user profile with offline handling
export const getUserProfile = async (userId) => {
  try {
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    console.log("getUserProfile result:", userSnap.exists() ? userSnap.data() : null);
    return userSnap.exists() ? userSnap.data() : null;
  } catch (error) {
    console.error("Error in getUserProfile:", error);
    // Return a basic profile if offline
    return {
      uid: userId,
      displayName: "User",
      username: "user",
      bio: "",
      friends: [],
      friendRequests: []
    };
  }
};

// Search users by username or display name
export const searchUsers = async (searchTerm) => {
  if (!searchTerm) return [];
  
  try {
    const usersRef = collection(db, 'users');
    
    // Search in displayName
    const displayNameQuery = query(
      usersRef, 
      where('displayName', '>=', searchTerm),
      where('displayName', '<=', searchTerm + '\uf8ff')
    );
    
    // Search in username
    const usernameQuery = query(
      usersRef,
      where('username', '>=', searchTerm),
      where('username', '<=', searchTerm + '\uf8ff')
    );

    const [displayNameSnapshot, usernameSnapshot] = await Promise.all([
      getDocs(displayNameQuery),
      getDocs(usernameQuery)
    ]);

    const users = new Map();
    
    // Combine results and remove duplicates
    displayNameSnapshot.forEach(doc => {
      users.set(doc.id, { id: doc.id, ...doc.data() });
    });
    
    usernameSnapshot.forEach(doc => {
      users.set(doc.id, { id: doc.id, ...doc.data() });
    });

    return Array.from(users.values());
  } catch (error) {
    console.error("Error searching users:", error);
    return [];
  }
};

// Send friend request with better error handling
export const sendFriendRequest = async (fromUserId, toUserId) => {
  try {
    console.log("Sending friend request from:", fromUserId, "to:", toUserId);
    
    // First, check if the target user exists
    const toUserProfile = await getUserProfile(toUserId);
    if (!toUserProfile) {
      throw new Error("User not found");
    }
    
    // Check if already friends
    if (toUserProfile.friends && toUserProfile.friends.includes(fromUserId)) {
      throw new Error("You are already friends with this user");
    }
    
    // Check if request already sent
    if (toUserProfile.friendRequests) {
      const existingRequest = toUserProfile.friendRequests.find(
        req => req.from === fromUserId && req.status === 'pending'
      );
      if (existingRequest) {
        throw new Error("Friend request already sent");
      }
    }

    const toUserRef = doc(db, 'users', toUserId);
    
    await updateDoc(toUserRef, {
      friendRequests: arrayUnion({
        from: fromUserId,
        timestamp: new Date(),
        status: 'pending'
      })
    });
    
    console.log("Friend request sent successfully");
    return { success: true };
  } catch (error) {
    console.error("Error sending friend request:", error);
    
    // Provide more specific error messages
    let errorMessage = "Error sending friend request";
    if (error.code === 'permission-denied') {
      errorMessage = "Permission denied. Please check Firestore rules.";
    } else if (error.code === 'not-found') {
      errorMessage = "User not found.";
    } else if (error.message.includes("already friends")) {
      errorMessage = "You are already friends with this user.";
    } else if (error.message.includes("already sent")) {
      errorMessage = "Friend request already sent.";
    } else {
      errorMessage = error.message || "Error sending friend request";
    }
    
    throw new Error(errorMessage);
  }
};

// Accept friend request
export const acceptFriendRequest = async (userId, requestFromId) => {
  try {
    console.log("Accepting friend request:", { userId, requestFromId });
    
    const userRef = doc(db, 'users', userId);
    const fromUserRef = doc(db, 'users', requestFromId);
    
    // First, get current data to find the exact request object
    const userSnap = await getDoc(userRef);
    const fromUserSnap = await getDoc(fromUserRef);
    
    if (!userSnap.exists() || !fromUserSnap.exists()) {
      throw new Error("User not found");
    }
    
    const userData = userSnap.data();
    const fromUserData = fromUserSnap.data();
    
    // Find the exact request object to remove
    const requestToRemove = userData.friendRequests?.find(
      req => req.from === requestFromId && req.status === 'pending'
    );
    
    if (!requestToRemove) {
      throw new Error("Friend request not found");
    }
    
    // Remove from friendRequests and add to friends for both users
    const batchUpdates = [
      updateDoc(userRef, {
        friends: arrayUnion(requestFromId),
        friendRequests: arrayRemove(requestToRemove)
      }),
      updateDoc(fromUserRef, {
        friends: arrayUnion(userId)
      })
    ];
    
    await Promise.all(batchUpdates);
    console.log("Friend request accepted successfully");
    
  } catch (error) {
    console.error("Error accepting friend request:", error);
    let errorMessage = "Error accepting friend request";
    
    if (error.message.includes("not found")) {
      errorMessage = error.message;
    } else if (error.code === 'permission-denied') {
      errorMessage = "Permission denied. Please check Firestore rules.";
    }
    
    throw new Error(errorMessage);
  }
};

// Reject friend request
export const rejectFriendRequest = async (userId, requestFromId) => {
  try {
    console.log("Rejecting friend request:", { userId, requestFromId });
    
    const userRef = doc(db, 'users', userId);
    
    // First, get current data to find the exact request object
    const userSnap = await getDoc(userRef);
    
    if (!userSnap.exists()) {
      throw new Error("User not found");
    }
    
    const userData = userSnap.data();
    
    // Find the exact request object to remove
    const requestToRemove = userData.friendRequests?.find(
      req => req.from === requestFromId && req.status === 'pending'
    );
    
    if (!requestToRemove) {
      throw new Error("Friend request not found");
    }
    
    // Remove the friend request
    await updateDoc(userRef, {
      friendRequests: arrayRemove(requestToRemove)
    });
    
    console.log("Friend request rejected successfully");
    
  } catch (error) {
    console.error("Error rejecting friend request:", error);
    let errorMessage = "Error rejecting friend request";
    
    if (error.message.includes("not found")) {
      errorMessage = error.message;
    } else if (error.code === 'permission-denied') {
      errorMessage = "Permission denied. Please check Firestore rules.";
    }
    
    throw new Error(errorMessage);
  }
};

// Get user's friends
export const getUserFriends = async (userId) => {
  try {
    const user = await getUserProfile(userId);
    if (!user || !user.friends) return [];
    
    const friendsPromises = user.friends.map(friendId => getUserProfile(friendId));
    return Promise.all(friendsPromises);
  } catch (error) {
    console.error("Error getting user friends:", error);
    return [];
  }
};

// Chat and Message Functions

// Create or get existing chat between two users
export const getOrCreateChat = async (user1Id, user2Id) => {
  try {
    // Create a consistent chat ID regardless of order
    const chatId = [user1Id, user2Id].sort().join('_');
    const chatRef = doc(db, 'chats', chatId);
    
    const chatSnap = await getDoc(chatRef);
    
    if (!chatSnap.exists()) {
      // Create new chat
      await setDoc(chatRef, {
        id: chatId,
        participants: [user1Id, user2Id],
        createdAt: new Date(),
        lastMessage: null,
        lastMessageAt: new Date()
      });
      console.log("New chat created:", chatId);
    }
    
    return chatId;
  } catch (error) {
    console.error("Error creating/getting chat:", error);
    throw error;
  }
};

// Send a message with auto-deletion and edit capabilities
export const sendMessage = async (chatId, senderId, text) => {
  try {
    const messagesRef = collection(db, 'chats', chatId, 'messages');
    
    // Calculate deletion time (72 hours from now)
    const deletionTime = new Date();
    deletionTime.setHours(deletionTime.getHours() + 72);
    
    const messageData = {
      senderId,
      text,
      timestamp: new Date(),
      read: false,
      // Auto-deletion fields
      deletionTime: deletionTime,
      isSaved: false,
      // Edit fields
      isEdited: false,
      editHistory: [],
      originalText: text,
      canEditUntil: new Date(Date.now() + 15 * 60 * 1000) // 15 minutes from now
    };
    
    // Add message to subcollection
    const messageRef = await addDoc(messagesRef, messageData);
    
    // Update chat's last message
    const chatRef = doc(db, 'chats', chatId);
    await updateDoc(chatRef, {
      lastMessage: text,
      lastMessageAt: new Date()
    });
    
    console.log("Message sent with auto-deletion:", messageRef.id);
    return messageRef.id;
  } catch (error) {
    console.error("Error sending message:", error);
    throw error;
  }
};

// Get all chats for a user
export const getUserChats = async (userId) => {
  try {
    const chatsRef = collection(db, 'chats');
    const q = query(chatsRef, where('participants', 'array-contains', userId));
    const querySnapshot = await getDocs(q);
    
    const chats = [];
    for (const docSnap of querySnapshot.docs) {
      const chatData = docSnap.data();
      
      // Get the other participant's info
      const otherParticipantId = chatData.participants.find(id => id !== userId);
      const otherUser = await getUserProfile(otherParticipantId);
      
      // Get unread count
      const unreadCount = await getUnreadCount(chatData.id, userId);
      
      chats.push({
        id: chatData.id,
        ...chatData,
        otherParticipant: otherUser,
        unreadCount
      });
    }
    
    // Sort by last message time
    chats.sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt));
    
    return chats;
  } catch (error) {
    console.error("Error getting user chats:", error);
    return [];
  }
};

// Get messages with auto-deletion check
export const getChatMessages = async (chatId) => {
  try {
    const messagesRef = collection(db, 'chats', chatId, 'messages');
    const q = query(messagesRef, orderBy('timestamp', 'asc'));
    const querySnapshot = await getDocs(q);
    
    const now = new Date();
    const messages = [];
    
    for (const doc of querySnapshot.docs) {
      const messageData = doc.data();
      
      // Check if message should be auto-deleted
      if (messageData.deletionTime && 
          now > messageData.deletionTime.toDate() && 
          !messageData.isSaved) {
        // Auto-delete this message
        await deleteDoc(doc.ref);
        continue;
      }
      
      messages.push({
        id: doc.id,
        ...messageData
      });
    }
    
    return messages;
  } catch (error) {
    console.error("Error getting chat messages:", error);
    return [];
  }
};

// Real-time listener with auto-deletion check
export const listenToChatMessages = (chatId, callback) => {
  const messagesRef = collection(db, 'chats', chatId, 'messages');
  const q = query(messagesRef, orderBy('timestamp', 'asc'));
  
  return onSnapshot(q, async (snapshot) => {
    const now = new Date();
    const messages = [];
    
    for (const doc of snapshot.docs) {
      const messageData = doc.data();
      
      // Check if message should be auto-deleted
      if (messageData.deletionTime && 
          now > messageData.deletionTime.toDate() && 
          !messageData.isSaved) {
        // Auto-delete this message
        await deleteDoc(doc.ref);
        continue;
      }
      
      messages.push({
        id: doc.id,
        ...messageData
      });
    }
    
    callback(messages);
  });
};

// Real-time listener for user chats
export const listenToUserChats = (userId, callback) => {
  const chatsRef = collection(db, 'chats');
  const q = query(chatsRef, where('participants', 'array-contains', userId));
  
  return onSnapshot(q, async (snapshot) => {
    const chats = [];
    
    for (const docSnap of snapshot.docs) {
      const chatData = docSnap.data();
      const otherParticipantId = chatData.participants.find(id => id !== userId);
      const otherUser = await getUserProfile(otherParticipantId);
      const unreadCount = await getUnreadCount(chatData.id, userId);
      
      chats.push({
        id: chatData.id,
        ...chatData,
        otherParticipant: otherUser,
        unreadCount
      });
    }
    
    // Sort by last message time
    chats.sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt));
    callback(chats);
  });
};

// Mark messages as read
export const markMessagesAsRead = async (chatId, userId) => {
  try {
    const messagesRef = collection(db, 'chats', chatId, 'messages');
    const q = query(
      messagesRef, 
      where('senderId', '!=', userId),
      where('read', '==', false)
    );
    
    const querySnapshot = await getDocs(q);
    const batch = writeBatch(db);
    
    querySnapshot.docs.forEach((doc) => {
      batch.update(doc.ref, { read: true });
    });
    
    await batch.commit();
    console.log("Messages marked as read");
  } catch (error) {
    console.error("Error marking messages as read:", error);
  }
};

// Get unread message count for a chat
export const getUnreadCount = async (chatId, userId) => {
  try {
    const messagesRef = collection(db, 'chats', chatId, 'messages');
    const q = query(
      messagesRef,
      where('senderId', '!=', userId),
      where('read', '==', false)
    );
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.size;
  } catch (error) {
    console.error("Error getting unread count:", error);
    return 0;
  }
};


// Music Sync Functions

// Update music state in a chat
export const updateMusicState = async (chatId, musicState) => {
  try {
    const chatRef = doc(db, 'chats', chatId);
    await updateDoc(chatRef, {
      musicState: {
        ...musicState,
        lastUpdated: new Date(),
        updatedBy: musicState.updatedBy
      }
    });
    console.log("Music state updated:", musicState);
  } catch (error) {
    console.error("Error updating music state:", error);
    throw error;
  }
};

// Get current music state for a chat
export const getMusicState = async (chatId) => {
  try {
    const chatRef = doc(db, 'chats', chatId);
    const chatSnap = await getDoc(chatRef);
    return chatSnap.exists() ? chatSnap.data().musicState || null : null;
  } catch (error) {
    console.error("Error getting music state:", error);
    return null;
  }
};

// Real-time listener for music state changes
export const listenToMusicState = (chatId, callback) => {
  const chatRef = doc(db, 'chats', chatId);
  
  return onSnapshot(chatRef, (doc) => {
    if (doc.exists()) {
      const chatData = doc.data();
      callback(chatData.musicState || null);
    }
  });
};

// Add music to queue
export const addToMusicQueue = async (chatId, videoData, addedBy) => {
  try {
    const chatRef = doc(db, 'chats', chatId);
    const chatSnap = await getDoc(chatRef);
    
    if (!chatSnap.exists()) return;
    
    const chatData = chatSnap.data();
    const currentQueue = chatData.musicQueue || [];
    
    const queueItem = {
      id: Date.now().toString(),
      videoId: videoData.videoId,
      title: videoData.title,
      thumbnail: videoData.thumbnail,
      duration: videoData.duration,
      addedBy: addedBy,
      addedAt: new Date(),
      played: false
    };
    
    await updateDoc(chatRef, {
      musicQueue: [...currentQueue, queueItem]
    });
    
    console.log("Added to music queue:", queueItem);
  } catch (error) {
    console.error("Error adding to music queue:", error);
    throw error;
  }
};

// Get music queue
export const getMusicQueue = async (chatId) => {
  try {
    const chatRef = doc(db, 'chats', chatId);
    const chatSnap = await getDoc(chatRef);
    return chatSnap.exists() ? chatSnap.data().musicQueue || [] : [];
  } catch (error) {
    console.error("Error getting music queue:", error);
    return [];
  }
};

// Real-time listener for music queue
export const listenToMusicQueue = (chatId, callback) => {
  const chatRef = doc(db, 'chats', chatId);
  
  return onSnapshot(chatRef, (doc) => {
    if (doc.exists()) {
      const chatData = doc.data();
      callback(chatData.musicQueue || []);
    }
  });
};

// ===== AUTO-DELETION AND EDITING FUNCTIONS =====

// Save/star a message to prevent deletion
export const saveMessage = async (chatId, messageId, userId) => {
  try {
    const messageRef = doc(db, 'chats', chatId, 'messages', messageId);
    await updateDoc(messageRef, {
      isSaved: true,
      savedBy: userId,
      savedAt: new Date()
    });
    console.log("Message saved from deletion");
  } catch (error) {
    console.error("Error saving message:", error);
    throw error;
  }
};

// Unsave a message
export const unsaveMessage = async (chatId, messageId) => {
  try {
    const messageRef = doc(db, 'chats', chatId, 'messages', messageId);
    await updateDoc(messageRef, {
      isSaved: false,
      savedBy: null,
      savedAt: null
    });
    console.log("Message unsaved");
  } catch (error) {
    console.error("Error unsaving message:", error);
    throw error;
  }
};

// Edit a message (within 15 minutes)
export const editMessage = async (chatId, messageId, newText, userId) => {
  try {
    const messageRef = doc(db, 'chats', chatId, 'messages', messageId);
    const messageSnap = await getDoc(messageRef);
    
    if (!messageSnap.exists()) {
      throw new Error("Message not found");
    }
    
    const messageData = messageSnap.data();
    
    // Check if user is the sender
    if (messageData.senderId !== userId) {
      throw new Error("You can only edit your own messages");
    }
    
    // Check if edit window is still open (15 minutes)
    const now = new Date();
    const canEditUntil = messageData.canEditUntil.toDate();
    
    if (now > canEditUntil) {
      throw new Error("Edit time expired. You can only edit messages within 15 minutes of sending.");
    }
    
    // Add to edit history
    const editHistory = messageData.editHistory || [];
    editHistory.push({
      previousText: messageData.text,
      editedAt: new Date()
    });
    
    await updateDoc(messageRef, {
      text: newText,
      isEdited: true,
      editHistory: editHistory,
      lastEditedAt: new Date()
    });
    
    console.log("Message edited successfully");
  } catch (error) {
    console.error("Error editing message:", error);
    throw error;
  }
};

// Schedule auto-deletion cleanup (run this periodically)
export const cleanupExpiredMessages = async () => {
  try {
    const chatsRef = collection(db, 'chats');
    const chatsSnapshot = await getDocs(chatsRef);
    
    const now = new Date();
    const cleanupPromises = [];
    
    for (const chatDoc of chatsSnapshot.docs) {
      const messagesRef = collection(db, 'chats', chatDoc.id, 'messages');
      const messagesQuery = query(
        messagesRef,
        where('deletionTime', '<=', now),
        where('isSaved', '==', false)
      );
      
      const messagesSnapshot = await getDocs(messagesQuery);
      
      messagesSnapshot.docs.forEach(doc => {
        cleanupPromises.push(deleteDoc(doc.ref));
      });
    }
    
    await Promise.all(cleanupPromises);
    console.log(`Cleaned up ${cleanupPromises.length} expired messages`);
  } catch (error) {
    console.error("Error cleaning up expired messages:", error);
  }
};

// Real-time listener for user profile updates with offline handling
export const listenToUserProfile = (userId, callback) => {
  console.log("Setting up listener for user:", userId);
  const userRef = doc(db, 'users', userId);
  
  return onSnapshot(userRef, 
    (doc) => {
      console.log("Profile snapshot received:", doc.exists());
      if (doc.exists()) {
        const data = doc.data();
        console.log("Profile data:", data);
        callback(data);
      } else {
        console.log("No profile found for user:", userId);
        // Create a basic profile structure if document doesn't exist
        callback({
          uid: userId,
          displayName: "User",
          username: "user",
          bio: "",
          friends: [],
          friendRequests: []
        });
      }
    },
    (error) => {
      console.error("Error in profile listener:", error);
      // Provide fallback data when offline
      callback({
        uid: userId,
        displayName: "User",
        username: "user",
        bio: "",
        friends: [],
        friendRequests: []
      });
    }
  );
};