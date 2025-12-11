import { db } from "./firebase";
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
  writeBatch,
  serverTimestamp,
} from "firebase/firestore";

export const sendPushNotification = async (senderId, receiverId, message, chatId) => {
  try {
    const receiverDoc = await getDoc(doc(db, "users", receiverId));
    const receiverTokens = receiverDoc.data()?.notificationTokens || [];
    
    if (receiverTokens.length === 0) return;
    
    const response = await fetch('/api/send-notification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tokens: receiverTokens,
        title: "New Message",
        body: message.type === 'image' ? '📷 Photo' : message.text.substring(0, 100),
        data: {
          chatId,
          senderId,
          messageId: message.id,
          type: 'new-message'
        }
      })
    });
    
    return response.json();
  } catch (error) {
    console.error("Error sending push notification:", error);
  }
};

export const checkUsernameTaken = async (username, excludeUserId = null) => {
  try {
    const usernameRef = doc(db, "usernames", username);
    const usernameSnap = await getDoc(usernameRef);
    
    if (usernameSnap.exists()) {
      const usernameData = usernameSnap.data();
      if (excludeUserId && usernameData.uid === excludeUserId) {
        return false;
      }
      return true;
    }
    
    const usersRef = collection(db, "users");
    const q = query(usersRef, where("username", "==", username));
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      if (excludeUserId) {
        const isSameUser = querySnapshot.docs.some(doc => doc.id === excludeUserId);
        if (isSameUser) {
          return false;
        }
      }
      return true;
    }
    
    return false;
  } catch (error) {
    console.error("Error checking username:", error);
    throw error;
  }
};

export const createUserProfile = async (user, username = null) => {
  if (!user) return;

  try {
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);

    let finalUsername = username || user.email.split("@")[0];
    
    if (!userSnap.exists()) {
      const usernameTaken = await checkUsernameTaken(finalUsername, user.uid);
      
      if (usernameTaken) {
        finalUsername = `${finalUsername}${Math.floor(1000 + Math.random() * 9000)}`;
      }
    }

    if (!userSnap.exists()) {
      await setDoc(userRef, {
        uid: user.uid,
        displayName: user.displayName,
        email: user.email,
        photoURL: user.photoURL,
        username: finalUsername,
        bio: "",
        friends: [],
        friendRequests: [],
        blockedUsers: [],
        createdAt: new Date(),
      });
      
      await setDoc(doc(db, "usernames", finalUsername), {
        uid: user.uid,
        createdAt: new Date(),
      });
    } else {
      await updateDoc(userRef, {
        displayName: user.displayName,
        photoURL: user.photoURL,
      });
    }
  } catch (error) {
    console.error("Error creating user profile:", error);
    throw error;
  }
};

export const updateUsername = async (userId, newUsername) => {
  try {
    if (!newUsername || newUsername.length < 3 || newUsername.length > 30) {
      throw new Error("Username must be between 3 and 30 characters");
    }
    
    if (!/^[a-zA-Z0-9_.-]+$/.test(newUsername)) {
      throw new Error("Username can only contain letters, numbers, dots, underscores, and hyphens");
    }
    
    const usernameTaken = await checkUsernameTaken(newUsername, userId);
    
    if (usernameTaken) {
      throw new Error("Username is already taken");
    }
    
    const userRef = doc(db, "users", userId);
    const userSnap = await getDoc(userRef);
    
    if (!userSnap.exists()) {
      throw new Error("User not found");
    }
    
    const userData = userSnap.data();
    const oldUsername = userData.username;
    
    const batch = writeBatch(db);
    
    batch.update(userRef, {
      username: newUsername,
      updatedAt: serverTimestamp(),
    });
    
    if (oldUsername) {
      const oldUsernameRef = doc(db, "usernames", oldUsername);
      batch.delete(oldUsernameRef);
    }

    const newUsernameRef = doc(db, "usernames", newUsername);
    batch.set(newUsernameRef, {
      uid: userId,
      updatedAt: serverTimestamp(),
    });
    
    await batch.commit();
    
    await updateUsernameInChats(userId, oldUsername, newUsername);
    
    return { success: true, username: newUsername };
  } catch (error) {
    console.error("Error updating username:", error);
    throw error;
  }
};

export const getUsernameSuggestions = async (baseUsername) => {
  try {
    const suggestions = [];
    const maxAttempts = 5;
    
    for (let i = 0; i < maxAttempts; i++) {
      let suggestion;
      
      if (i === 0) {
        suggestion = baseUsername;
      } else if (i === 1) {
        suggestion = `${baseUsername}${Math.floor(100 + Math.random() * 900)}`;
      } else if (i === 2) {
        suggestion = `${baseUsername}${Math.floor(1000 + Math.random() * 9000)}`;
      } else if (i === 3) {
        suggestion = `${baseUsername}_${Math.floor(10 + Math.random() * 90)}`;
      } else {
        suggestion = `${baseUsername}${Math.floor(1 + Math.random() * 9)}${String.fromCharCode(97 + Math.floor(Math.random() * 26))}`;
      }
      
      const isTaken = await checkUsernameTaken(suggestion);
      
      if (!isTaken) {
        suggestions.push(suggestion);
      }
      
      if (suggestions.length >= 3) {
        break;
      }
    }
    
    return suggestions;
  } catch (error) {
    console.error("Error getting username suggestions:", error);
    return [];
  }
};

export const updateUsernameInChats = async (userId, oldUsername, newUsername) => {
  try {
    const chatsRef = collection(db, "chats");
    const q = query(chatsRef, where("participants", "array-contains", userId));
    const querySnapshot = await getDocs(q);
    
    const batch = writeBatch(db);
    
    querySnapshot.docs.forEach((doc) => {
      const chatData = doc.data();
      
      if (chatData.participantUsernames && chatData.participantUsernames[oldUsername]) {
        const updatedUsernames = { ...chatData.participantUsernames };
        updatedUsernames[newUsername] = updatedUsernames[oldUsername];
        delete updatedUsernames[oldUsername];
        
        batch.update(doc.ref, {
          participantUsernames: updatedUsernames,
        });
      }
    });
    
    if (querySnapshot.docs.length > 0) {
      await batch.commit();
    }
  } catch (error) {
    console.error("Error updating username in chats:", error);
  }
};

export const getUserProfile = async (userId) => {
  try {
    const userRef = doc(db, "users", userId);
    const userSnap = await getDoc(userRef);

    return userSnap.exists() ? userSnap.data() : null;
  } catch (error) {
    console.error("Error in getUserProfile:", error);
    return {
      uid: userId,
      displayName: "User",
      username: "user",
      bio: "",
      friends: [],
      friendRequests: [],
    };
  }
};

export const updateUserProfilePicture = async (userId, photoURL, cloudinaryPublicId = null) => {
  try {
    const userRef = doc(db, "users", userId);
    
    const updateData = {
      photoURL: photoURL,
      updatedAt: new Date()
    };
    
    if (cloudinaryPublicId) {
      updateData.cloudinaryPublicId = cloudinaryPublicId;
    }
    
    await updateDoc(userRef, updateData);
    console.log("Profile picture updated in Firestore");
  } catch (error) {
    console.error("Error updating profile picture in Firestore:", error);
    throw error;
  }
};

export const searchUsers = async (searchTerm, excludeUserId = null, checkBlocked = false) => {
  if (!searchTerm) return [];

  try {
    let blockedUsers = [];
    if (checkBlocked && excludeUserId) {
      const userProfile = await getUserProfile(excludeUserId);
      blockedUsers = userProfile?.blockedUsers || [];
    }

    const usersRef = collection(db, "users");

    const displayNameQuery = query(
      usersRef,
      where("displayName", ">=", searchTerm),
      where("displayName", "<=", searchTerm + "\uf8ff"),
    );

    const usernameQuery = query(
      usersRef,
      where("username", ">=", searchTerm),
      where("username", "<=", searchTerm + "\uf8ff"),
    );

    const [displayNameSnapshot, usernameSnapshot] = await Promise.all([
      getDocs(displayNameQuery),
      getDocs(usernameQuery),
    ]);

    const users = new Map();

    const addUser = (doc) => {
      if (excludeUserId && doc.id === excludeUserId) return;
      
      if (checkBlocked && blockedUsers.includes(doc.id)) return;
      
      users.set(doc.id, { id: doc.id, ...doc.data() });
    };

    displayNameSnapshot.forEach(addUser);
    usernameSnapshot.forEach(addUser);

    return Array.from(users.values());
  } catch (error) {
    console.error("Error searching users:", error);
    return [];
  }
};

export const validateUsername = (username) => {
  const errors = [];
  
  if (!username || username.trim().length === 0) {
    errors.push("Username is required");
  }
  
  if (username.length < 3) {
    errors.push("Username must be at least 3 characters long");
  }
  
  if (username.length > 30) {
    errors.push("Username must be less than 30 characters");
  }
  
  if (!/^[a-zA-Z0-9_.-]+$/.test(username)) {
    errors.push("Username can only contain letters, numbers, dots, underscores, and hyphens");
  }
  
  if (/\s/.test(username)) {
    errors.push("Username cannot contain spaces");
  }
  
  const reservedUsernames = ['admin', 'administrator', 'support', 'help', 'system', 'root'];
  if (reservedUsernames.includes(username.toLowerCase())) {
    errors.push("This username is reserved");
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  };
};

export const sendFriendRequest = async (fromUserId, toUserId) => {
  try {
    console.log("Sending friend request from:", fromUserId, "to:", toUserId);

    const toUserProfile = await getUserProfile(toUserId);
    if (!toUserProfile) {
      throw new Error("User not found");
    }

    if (toUserProfile.friends && toUserProfile.friends.includes(fromUserId)) {
      throw new Error("You are already friends with this user");
    }

    if (toUserProfile.friendRequests) {
      const existingRequest = toUserProfile.friendRequests.find(
        (req) => req.from === fromUserId && req.status === "pending",
      );
      if (existingRequest) {
        throw new Error("Friend request already sent");
      }
    }

    const toUserRef = doc(db, "users", toUserId);

    await updateDoc(toUserRef, {
      friendRequests: arrayUnion({
        from: fromUserId,
        timestamp: new Date(),
        status: "pending",
      }),
    });

    return { success: true };
  } catch (error) {
    console.error("Error sending friend request:", error);

    let errorMessage = "Error sending friend request";
    if (error.code === "permission-denied") {
      errorMessage = "Permission denied. Please check Firestore rules.";
    } else if (error.code === "not-found") {
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

export const acceptFriendRequest = async (userId, requestFromId) => {
  try {
    const userRef = doc(db, "users", userId);
    const fromUserRef = doc(db, "users", requestFromId);

    const userSnap = await getDoc(userRef);
    const fromUserSnap = await getDoc(fromUserRef);

    if (!userSnap.exists() || !fromUserSnap.exists()) {
      throw new Error("User not found");
    }

    const userData = userSnap.data();

    const requestToRemove = userData.friendRequests?.find(
      (req) => req.from === requestFromId && req.status === "pending",
    );

    if (!requestToRemove) {
      throw new Error("Friend request not found");
    }

    const batchUpdates = [
      updateDoc(userRef, {
        friends: arrayUnion(requestFromId),
        friendRequests: arrayRemove(requestToRemove),
      }),
      updateDoc(fromUserRef, {
        friends: arrayUnion(userId),
      }),
    ];

    await Promise.all(batchUpdates);
  } catch (error) {
    console.error("Error accepting friend request:", error);
    let errorMessage = "Error accepting friend request";

    if (error.message.includes("not found")) {
      errorMessage = error.message;
    } else if (error.code === "permission-denied") {
      errorMessage = "Permission denied. Please check Firestore rules.";
    }

    throw new Error(errorMessage);
  }
};

export const rejectFriendRequest = async (userId, requestFromId) => {
  try {
    const userRef = doc(db, "users", userId);

    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      throw new Error("User not found");
    }

    const userData = userSnap.data();

    const requestToRemove = userData.friendRequests?.find(
      (req) => req.from === requestFromId && req.status === "pending",
    );

    if (!requestToRemove) {
      throw new Error("Friend request not found");
    }

    await updateDoc(userRef, {
      friendRequests: arrayRemove(requestToRemove),
    });
  } catch (error) {
    console.error("Error rejecting friend request:", error);
    let errorMessage = "Error rejecting friend request";

    if (error.message.includes("not found")) {
      errorMessage = error.message;
    } else if (error.code === "permission-denied") {
      errorMessage = "Permission denied. Please check Firestore rules.";
    }

    throw new Error(errorMessage);
  }
};

export const getUserFriends = async (userId) => {
  try {
    const user = await getUserProfile(userId);
    if (!user || !user.friends) return [];

    const friendsPromises = user.friends.map((friendId) =>
      getUserProfile(friendId),
    );
    return Promise.all(friendsPromises);
  } catch (error) {
    console.error("Error getting user friends:", error);
    return [];
  }
};

export const getOrCreateChat = async (user1Id, user2Id) => {
  try {
    const chatId = [user1Id, user2Id].sort().join("_");
    const chatRef = doc(db, "chats", chatId);

    const chatSnap = await getDoc(chatRef);

    if (!chatSnap.exists()) {
      const [user1Data, user2Data] = await Promise.all([
        getUserProfile(user1Id),
        getUserProfile(user2Id),
      ]);

      await setDoc(chatRef, {
        id: chatId,
        participants: [user1Id, user2Id],
        participantUsernames: {
          [user1Data.username]: user1Id,
          [user2Data.username]: user2Id,
        },
        createdAt: new Date(),
        lastMessage: null,
        lastMessageAt: new Date(),
      });
    }

    return chatId;
  } catch (error) {
    console.error("Error creating/getting chat:", error);
    throw error;
  }
};

export const saveUserNotificationToken = async (userId, token) => {
  try {
    const userRef = doc(db, "users", userId);
    await updateDoc(userRef, {
      notificationTokens: arrayUnion(token),
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error("Error saving notification token:", error);
  }
};

export const sendMessage = async (chatId, senderId, text, imageData = null) => {
  try {
    const receiverId = chatId.replace(senderId, '').replace('_', '');
    
    const receiverRef = doc(db, "users", receiverId);
    const receiverSnap = await getDoc(receiverRef);
    
    if (receiverSnap.exists()) {
      const receiverData = receiverSnap.data();
      
      if (receiverData.blockedUsers && receiverData.blockedUsers.includes(senderId)) {
        throw new Error("You cannot send messages to this user. You have been blocked.");
      }
      
      const senderRef = doc(db, "users", senderId);
      const senderSnap = await getDoc(senderRef);
      
      if (senderSnap.exists()) {
        const senderData = senderSnap.data();
        if (senderData.blockedUsers && senderData.blockedUsers.includes(receiverId)) {
          throw new Error("You cannot send messages to a user you have blocked. Unblock them first.");
        }
      }
    } else {
      throw new Error("Receiver not found");
    }

    const messagesRef = collection(db, "chats", chatId, "messages");

    const deletionTime = new Date();
    deletionTime.setHours(deletionTime.getHours() + 24);

    const messageData = {
      senderId,
      text: text || "",
      timestamp: new Date(),
      read: false,
      readBy: null,
      readAt: null,
      seenBy: [],
      deletionTime: deletionTime,
      isSaved: false,
      isEdited: false,
      editHistory: [],
      originalText: text || "",
      canEditUntil: new Date(Date.now() + 15 * 60 * 1000),
      isReply: false,
    };

    // Only send notification if NOT blocked
    await sendPushNotification(senderId, receiverId, messageData, chatId);

    if (imageData) {
      messageData.image = {
        publicId: imageData.public_id,
        url: imageData.secure_url,
        width: imageData.width,
        height: imageData.height,
        format: imageData.format,
      };
      messageData.type = "image";
    } else {
      messageData.type = "text";
    }

    const messageRef = await addDoc(messagesRef, messageData);

    const chatRef = doc(db, "chats", chatId);
    const now = new Date(); // Get current timestamp
    await updateDoc(chatRef, {
      lastMessage: text || "📷 Image",
      lastMessageAt: now,
      lastMessageId: messageRef.id,
    });

    return messageRef.id;
  } catch (error) {
    console.error("Error sending message:", error);
    throw error;
  }
};

export const getUserChats = async (userId) => {
  try {
    const userProfile = await getUserProfile(userId);
    const blockedUsers = userProfile?.blockedUsers || [];
    
    const chatsRef = collection(db, "chats");
    const q = query(chatsRef, where("participants", "array-contains", userId));
    const querySnapshot = await getDocs(q);

    const chats = [];
    for (const docSnap of querySnapshot.docs) {
      const chatData = docSnap.data();

      const otherParticipantId = chatData.participants.find(
        (id) => id !== userId,
      );
      
      if (blockedUsers.includes(otherParticipantId)) {
        continue;
      }
      
      const otherUser = await getUserProfile(otherParticipantId);
      const unreadCount = await getUnreadCount(chatData.id, userId);

      chats.push({
        id: chatData.id,
        ...chatData,
        otherParticipant: otherUser,
        unreadCount,
      });
    }

    chats.sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt));

    return chats;
  } catch (error) {
    console.error("Error getting user chats:", error);
    return [];
  }
};

export const getChatMessages = async (chatId, currentUserId) => {
  try {
    const currentUserRef = doc(db, "users", currentUserId);
    const currentUserSnap = await getDoc(currentUserRef);
    
    let blockedUsers = [];
    if (currentUserSnap.exists()) {
      const currentUserData = currentUserSnap.data();
      blockedUsers = currentUserData.blockedUsers || [];
    }
    
    const messagesRef = collection(db, "chats", chatId, "messages");
    const q = query(messagesRef, orderBy("timestamp", "asc"));
    const querySnapshot = await getDocs(q);

    const now = new Date();
    const messages = [];

    for (const doc of querySnapshot.docs) {
      const messageData = doc.data();
      
      if (blockedUsers.includes(messageData.senderId)) {
        continue;
      }

      if (
        messageData.deletionTime &&
        now > messageData.deletionTime.toDate() &&
        !messageData.isSaved
      ) {
        await deleteDoc(doc.ref);
        continue;
      }

      messages.push({
        id: doc.id,
        ...messageData,
      });
    }

    return messages;
  } catch (error) {
    console.error("Error getting chat messages:", error);
    return [];
  }
};

export const listenToChatMessages = (chatId, currentUserId, callback) => {
  const currentUserRef = doc(db, "users", currentUserId);
  
  const unsubscribeUser = onSnapshot(currentUserRef, async (userSnap) => {
    let blockedUsers = [];
    if (userSnap.exists()) {
      const userData = userSnap.data();
      blockedUsers = userData.blockedUsers || [];
    }
    
    const messagesRef = collection(db, "chats", chatId, "messages");
    const q = query(messagesRef, orderBy("timestamp", "asc"));
    
    return onSnapshot(q, async (snapshot) => {
      const now = new Date();
      const messages = [];

      for (const doc of snapshot.docs) {
        const messageData = doc.data();
        
        if (blockedUsers.includes(messageData.senderId)) {
          continue;
        }

        if (
          messageData.deletionTime &&
          now > messageData.deletionTime.toDate() &&
          !messageData.isSaved
        ) {
          if (messageData.type === "image" && messageData.image) {
            await trackCloudinaryDeletion(chatId, doc.id, messageData.image);
          }
          await deleteDoc(doc.ref);
          continue;
        }

        messages.push({
          id: doc.id,
          ...messageData,
        });
      }

      callback(messages);
    });
  });
  
  return unsubscribeUser;
};

export const listenToUserChats = (userId, callback) => {
  const userRef = doc(db, "users", userId);
  
  return onSnapshot(userRef, (userSnap) => {
    let blockedUsers = [];
    if (userSnap.exists()) {
      const userData = userSnap.data();
      blockedUsers = userData.blockedUsers || [];
    }
    
    const chatsRef = collection(db, "chats");
    const q = query(chatsRef, where("participants", "array-contains", userId));
    
    return onSnapshot(q, async (snapshot) => {
      const chats = [];

      for (const docSnap of snapshot.docs) {
        const chatData = docSnap.data();
        const otherParticipantId = chatData.participants.find(
          (id) => id !== userId,
        );
        
        if (blockedUsers.includes(otherParticipantId)) {
          continue;
        }
        
        const otherUser = await getUserProfile(otherParticipantId);
        const unreadCount = await getUnreadCount(chatData.id, userId);

        chats.push({
          id: chatData.id,
          ...chatData,
          otherParticipant: otherUser,
          unreadCount,
        });
      }

      chats.sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt));
      callback(chats);
    });
  });
};

export const markMessagesAsRead = async (chatId, userId) => {
  try {
    const messagesRef = collection(db, "chats", chatId, "messages");
    const q = query(
      messagesRef,
      where("senderId", "!=", userId),
      where("read", "==", false),
    );

    const querySnapshot = await getDocs(q);
    const batch = writeBatch(db);

    querySnapshot.docs.forEach((doc) => {
      batch.update(doc.ref, { 
        read: true,
        readAt: new Date()  // Add timestamp for better tracking
      });
    });

    await batch.commit();
    console.log(`Messages marked as read in chat ${chatId} by ${userId}`);
    return querySnapshot.size;
  } catch (error) {
    console.error("Error marking messages as read:", error);
    return 0;
  }
};

export const listenToUnreadMessagesCount = (userId, callback) => {
  return listenToUserChats(userId, (chats) => {
    const friendsWithUnread = new Set();
    
    chats.forEach(chat => {
      if (chat.unreadCount > 0) {
        const friendId = chat.otherParticipant?.uid;
        if (friendId) {
          friendsWithUnread.add(friendId);
        }
      }
    });
    
    callback(friendsWithUnread.size);
  });
};

export const getUnreadCount = async (chatId, userId) => {
  try {
    const messagesRef = collection(db, "chats", chatId, "messages");
    const q = query(
      messagesRef,
      where("senderId", "!=", userId),
      where("read", "==", false),
    );

    const querySnapshot = await getDocs(q);
    return querySnapshot.size;
  } catch (error) {
    console.error("Error getting unread count:", error);
    return 0;
  }
};

export const updateMusicState = async (chatId, musicState) => {
  try {
    const chatRef = doc(db, "chats", chatId);
    await updateDoc(chatRef, {
      musicState: {
        ...musicState,
        lastUpdated: new Date(),
        updatedBy: musicState.updatedBy,
      },
    });
    console.log("Music state updated:", musicState);
  } catch (error) {
    console.error("Error updating music state:", error);
    throw error;
  }
};

export const getMusicState = async (chatId) => {
  try {
    const chatRef = doc(db, "chats", chatId);
    const chatSnap = await getDoc(chatRef);
    return chatSnap.exists() ? chatSnap.data().musicState || null : null;
  } catch (error) {
    console.error("Error getting music state:", error);
    return null;
  }
};

export const listenToMusicState = (chatId, callback) => {
  const chatRef = doc(db, "chats", chatId);

  return onSnapshot(chatRef, (doc) => {
    if (doc.exists()) {
      const chatData = doc.data();
      callback(chatData.musicState || null);
    }
  });
};

export const addToMusicQueue = async (chatId, videoData, addedBy) => {
  try {
    const chatRef = doc(db, "chats", chatId);
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
      played: false,
    };

    await updateDoc(chatRef, {
      musicQueue: [...currentQueue, queueItem],
    });

    console.log("Added to music queue:", queueItem);
  } catch (error) {
    console.error("Error adding to music queue:", error);
    throw error;
  }
};

export const getMusicQueue = async (chatId) => {
  try {
    const chatRef = doc(db, "chats", chatId);
    const chatSnap = await getDoc(chatRef);
    return chatSnap.exists() ? chatSnap.data().musicQueue || [] : [];
  } catch (error) {
    console.error("Error getting music queue:", error);
    return [];
  }
};

export const listenToMusicQueue = (chatId, callback) => {
  const chatRef = doc(db, "chats", chatId);

  return onSnapshot(chatRef, (doc) => {
    if (doc.exists()) {
      const chatData = doc.data();
      callback(chatData.musicQueue || []);
    }
  });
};

export const saveMessage = async (chatId, messageId, userId) => {
  try {
    const messageRef = doc(db, "chats", chatId, "messages", messageId);
    await updateDoc(messageRef, {
      isSaved: true,
      savedBy: userId,
      savedAt: new Date(),
    });
    console.log("Message saved from deletion");
  } catch (error) {
    console.error("Error saving message:", error);
    throw error;
  }
};

export const unsaveMessage = async (chatId, messageId) => {
  try {
    const messageRef = doc(db, "chats", chatId, "messages", messageId);
    await updateDoc(messageRef, {
      isSaved: false,
      savedBy: null,
      savedAt: null,
    });
    console.log("Message unsaved");
  } catch (error) {
    console.error("Error unsaving message:", error);
    throw error;
  }
};

export const editMessage = async (chatId, messageId, newText, userId) => {
  try {
    const messageRef = doc(db, "chats", chatId, "messages", messageId);
    const chatRef = doc(db, "chats", chatId);
    
    const messageSnap = await getDoc(messageRef);
    const chatSnap = await getDoc(chatRef);

    if (!messageSnap.exists()) {
      throw new Error("Message not found");
    }

    const messageData = messageSnap.data();
    const chatData = chatSnap.data();

    if (messageData.senderId !== userId) {
      throw new Error("You can only edit your own messages");
    }

    const now = new Date();
    const canEditUntil = messageData.canEditUntil.toDate();

    if (now > canEditUntil) {
      throw new Error(
        "Edit time expired. You can only edit messages within 15 minutes of sending.",
      );
    }

    const editHistory = messageData.editHistory || [];
    editHistory.push({
      previousText: messageData.text,
      editedAt: new Date(),
    });

    await updateDoc(messageRef, {
      text: newText,
      isEdited: true,
      editHistory: editHistory,
      lastEditedAt: new Date(),
    });
    
    if (chatData.lastMessageId === messageId) {
      await updateDoc(chatRef, {
        lastMessage: newText,
        lastMessageAt: new Date(),
      });
    }

    console.log("Message edited successfully");
  } catch (error) {
    console.error("Error editing message:", error);
    throw error;
  }
};

export const cleanupExpiredMessages = async () => {
  try {
    const chatsRef = collection(db, "chats");
    const chatsSnapshot = await getDocs(chatsRef);

    const now = new Date();
    const cleanupPromises = [];

    for (const chatDoc of chatsSnapshot.docs) {
      const messagesRef = collection(db, "chats", chatDoc.id, "messages");
      const messagesQuery = query(
        messagesRef,
        where("deletionTime", "<=", now),
        where("isSaved", "==", false),
      );

      const messagesSnapshot = await getDocs(messagesQuery);

      messagesSnapshot.docs.forEach((doc) => {
        cleanupPromises.push(deleteDoc(doc.ref));
      });
    }

    await Promise.all(cleanupPromises);
  } catch (error) {
    console.error("Error cleaning up expired messages:", error);
  }
};

export const listenToUserProfile = (userId, callback) => {
  const userRef = doc(db, "users", userId);

  return onSnapshot(
    userRef,
    (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        callback(data);
      } else {
        callback({
          uid: userId,
          displayName: "User",
          username: "user",
          bio: "",
          friends: [],
          friendRequests: [],
        });
      }
    },
    (error) => {
      console.error("Error in profile listener:", error);
      callback({
        uid: userId,
        displayName: "User",
        username: "user",
        bio: "",
        friends: [],
        friendRequests: [],
      });
    },
  );
};

export const trackCloudinaryDeletion = async (chatId, messageId, imageData) => {
  try {
    const deletionLogRef = doc(db, "deletionLogs", `${chatId}_${messageId}`);

    await setDoc(deletionLogRef, {
      chatId,
      messageId,
      publicId: imageData.publicId,
      deletedAt: new Date(),
      scheduledForDeletion: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
    });

    console.log("Cloudinary deletion tracked for:", imageData.publicId);
  } catch (error) {
    console.error("Error tracking Cloudinary deletion:", error);
  }
};

export const setUserOnlineStatus = async (userId, isOnline) => {
  try {
    const userRef = doc(db, "users", userId);
    await updateDoc(userRef, {
      isOnline: isOnline,
      lastSeen: new Date()
    });
  } catch (error) {
    console.error("Error updating online status:", error);
  }
};

export const listenToUserOnlineStatus = (userId, callback) => {
  const userRef = doc(db, "users", userId);
  return onSnapshot(userRef, (doc) => {
    if (doc.exists()) {
      callback(doc.data().isOnline);
    }
  });
};

export const listenToFriendsOnlineStatus = (friendIds, callback) => {
  if (friendIds.length === 0) return () => {};
  
  const friendsRef = collection(db, "users");
  const q = query(friendsRef, where("__name__", "in", friendIds));
  
  return onSnapshot(q, (snapshot) => {
    const onlineStatus = {};
    snapshot.forEach(doc => {
      onlineStatus[doc.id] = doc.data().isOnline || false;
    });
    callback(onlineStatus);
  });
};

export const deleteChat = async (chatId, userId) => {
  try {
    const chatRef = doc(db, "chats", chatId);
    const chatSnap = await getDoc(chatRef);
    
    if (!chatSnap.exists() || !chatSnap.data().participants.includes(userId)) {
      throw new Error("Chat not found or unauthorized");
    }
    
    // Delete all messages first
    const messagesRef = collection(db, "chats", chatId, "messages");
    const messagesSnap = await getDocs(messagesRef);
    
    const batch = writeBatch(db);
    messagesSnap.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    // Delete the chat document
    batch.delete(chatRef);
    await batch.commit();
    
    return { success: true };
    
  } catch (error) {
    console.error("Error deleting chat:", error);
    throw error;
  }
};

export const blockUser = async (userId, userToBlockId) => {
  try {
    if (userId === userToBlockId) {
      throw new Error("You cannot block yourself");
    }
    
    const userRef = doc(db, "users", userId);
    const userSnap = await getDoc(userRef);
    
    if (!userSnap.exists()) {
      throw new Error("User not found");
    }
    
    const userData = userSnap.data();
    
    if (userData.blockedUsers && userData.blockedUsers.includes(userToBlockId)) {
      throw new Error("User is already blocked");
    }
    
    // Remove from friends if they are friends
    const updates = {
      blockedUsers: arrayUnion(userToBlockId),
    };
    
    if (userData.friends && userData.friends.includes(userToBlockId)) {
      updates.friends = arrayRemove(userToBlockId);
    }
    
    await updateDoc(userRef, updates);
    
    // Also remove from friend requests if any
    if (userData.friendRequests) {
      const requestToRemove = userData.friendRequests.find(
        req => req.from === userToBlockId
      );
      if (requestToRemove) {
        await updateDoc(userRef, {
          friendRequests: arrayRemove(requestToRemove)
        });
      }
    }
    
    return { success: true };
    
  } catch (error) {
    console.error("Error blocking user:", error);
    throw error;
  }
};

export const unblockUser = async (userId, userToUnblockId) => {
  try {
    const userRef = doc(db, "users", userId);
    const userSnap = await getDoc(userRef);
    
    if (!userSnap.exists()) {
      throw new Error("User not found");
    }
    
    const userData = userSnap.data();
    
    if (!userData.blockedUsers || !userData.blockedUsers.includes(userToUnblockId)) {
      throw new Error("User is not blocked");
    }
    
    await updateDoc(userRef, {
      blockedUsers: arrayRemove(userToUnblockId)
    });
    
    return { success: true };
    
  } catch (error) {
    console.error("Error unblocking user:", error);
    throw error;
  }
};

export const getBlockedUsers = async (userId) => {
  try {
    const user = await getUserProfile(userId);
    if (!user || !user.blockedUsers) return [];
    
    const blockedUsersPromises = user.blockedUsers.map((blockedId) =>
      getUserProfile(blockedId)
    );
    return Promise.all(blockedUsersPromises);
  } catch (error) {
    console.error("Error getting blocked users:", error);
    return [];
  }
};

export const replyToMessage = async (chatId, originalMessageId, replyText, senderId, imageData = null) => {
  try {
    const messagesRef = collection(db, "chats", chatId, "messages");
    
    const originalMessageRef = doc(db, "chats", chatId, "messages", originalMessageId);
    const originalMessageSnap = await getDoc(originalMessageRef);
    
    if (!originalMessageSnap.exists()) {
      throw new Error("Original message not found");
    }
    
    const originalMessage = originalMessageSnap.data();
    
    const deletionTime = new Date();
    deletionTime.setHours(deletionTime.getHours() + 24);
    
    const replyData = {
      senderId,
      text: replyText || "",
      timestamp: new Date(),
      read: false,
      readBy: null,
      readAt: null,
      seenBy: [],
      deletionTime: deletionTime,
      isSaved: false,
      isEdited: false,
      editHistory: [],
      originalText: replyText || "",
      canEditUntil: new Date(Date.now() + 15 * 60 * 1000),
      isReply: true,
      originalMessageId: originalMessageId,
      originalSenderId: originalMessage.senderId,
      originalMessageText: originalMessage.text,
      originalMessageType: originalMessage.type,
    };
    
    if (imageData) {
      replyData.image = {
        publicId: imageData.public_id,
        url: imageData.secure_url,
        width: imageData.width,
        height: imageData.height,
        format: imageData.format,
      };
      replyData.type = "image";
    } else {
      replyData.type = "text";
    }
    
    if (originalMessage.image) {
      replyData.originalMessageImage = {
        url: originalMessage.image.url,
        publicId: originalMessage.image.publicId,
      };
    }
    
    const receiverId = chatId.replace(senderId, '').replace('_', '');
    await sendPushNotification(senderId, receiverId, replyData, chatId);
    
    const messageRef = await addDoc(messagesRef, replyData);
    
    const chatRef = doc(db, "chats", chatId);
    const now = new Date();
    await updateDoc(chatRef, {
      lastMessage: replyText || "📷 Image",
      lastMessageAt: now,
      lastMessageId: messageRef.id,
    });
    
    return messageRef.id;
    
  } catch (error) {
    console.error("Error replying to message:", error);
    throw error;
  }
};

export const getMessageById = async (chatId, messageId) => {
  try {
    const messageRef = doc(db, "chats", chatId, "messages", messageId);
    const messageSnap = await getDoc(messageRef);
    
    if (!messageSnap.exists()) {
      return null;
    }
    
    return {
      id: messageSnap.id,
      ...messageSnap.data(),
    };
  } catch (error) {
    console.error("Error getting message by ID:", error);
    return null;
  }
};

export const getReplyNotificationData = (originalMessage, replyText, senderName) => {
  const originalText = originalMessage.text || "an image";
  const truncatedText = originalText.length > 50 
    ? originalText.substring(0, 50) + "..."
    : originalText;
  
  return {
    title: "Reply to your message",
    body: `${senderName}: ${replyText || "📷 Image"}`,
    data: {
      originalMessageId: originalMessage.id,
      originalText: truncatedText,
      type: 'reply'
    }
  };
};