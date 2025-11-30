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
} from "firebase/firestore";

// Create or update user profile in Firestore
export const createUserProfile = async (user) => {
  if (!user) return;

  try {
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      // New user - create profile
      await setDoc(userRef, {
        uid: user.uid,
        displayName: user.displayName,
        email: user.email,
        photoURL: user.photoURL,
        username: user.email.split("@")[0], // Default username
        bio: "",
        friends: [],
        friendRequests: [],
        createdAt: new Date(),
      });
    } else {
      // Existing user - update basic info if needed
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

// Get user profile with offline handling
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

// Search users by username or display name
export const searchUsers = async (searchTerm) => {
  if (!searchTerm) return [];

  try {
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

    displayNameSnapshot.forEach((doc) => {
      users.set(doc.id, { id: doc.id, ...doc.data() });
    });

    usernameSnapshot.forEach((doc) => {
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

// Accept friend request
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

// Reject friend request
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

// Get user's friends
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

// Chat and Message Functions

// Create or get existing chat between two users
export const getOrCreateChat = async (user1Id, user2Id) => {
  try {
    const chatId = [user1Id, user2Id].sort().join("_");
    const chatRef = doc(db, "chats", chatId);

    const chatSnap = await getDoc(chatRef);

    if (!chatSnap.exists()) {
      await setDoc(chatRef, {
        id: chatId,
        participants: [user1Id, user2Id],
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

// Send a message with auto-deletion and edit capabilities
export const sendMessage = async (chatId, senderId, text, imageData = null) => {
  try {
    const messagesRef = collection(db, "chats", chatId, "messages");

    const deletionTime = new Date();
    deletionTime.setHours(deletionTime.getHours() + 24);

    const messageData = {
      senderId,
      text: text || "",
      timestamp: new Date(),
      read: false,
      deletionTime: deletionTime,
      isSaved: false,
      isEdited: false,
      editHistory: [],
      originalText: text || "",
      canEditUntil: new Date(Date.now() + 15 * 60 * 1000),
    };

    // Add image data if available - FIXED: parameter name
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
    await updateDoc(chatRef, {
      lastMessage: text || "📷 Image",
      lastMessageAt: new Date(),
    });

    return messageRef.id;
  } catch (error) {
    console.error("Error sending message:", error);
    throw error;
  }
};

// Get all chats for a user
export const getUserChats = async (userId) => {
  try {
    const chatsRef = collection(db, "chats");
    const q = query(chatsRef, where("participants", "array-contains", userId));
    const querySnapshot = await getDocs(q);

    const chats = [];
    for (const docSnap of querySnapshot.docs) {
      const chatData = docSnap.data();

      const otherParticipantId = chatData.participants.find(
        (id) => id !== userId,
      );
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

// Get messages with auto-deletion check
export const getChatMessages = async (chatId) => {
  try {
    const messagesRef = collection(db, "chats", chatId, "messages");
    const q = query(messagesRef, orderBy("timestamp", "asc"));
    const querySnapshot = await getDocs(q);

    const now = new Date();
    const messages = [];

    for (const doc of querySnapshot.docs) {
      const messageData = doc.data();

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

// Real-time listener with auto-deletion check
export const listenToChatMessages = (chatId, callback) => {
  const messagesRef = collection(db, "chats", chatId, "messages");
  const q = query(messagesRef, orderBy("timestamp", "asc"));

  return onSnapshot(q, async (snapshot) => {
    const now = new Date();
    const messages = [];

    for (const doc of snapshot.docs) {
      const messageData = doc.data();

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
};

// Real-time listener for user chats
export const listenToUserChats = (userId, callback) => {
  const chatsRef = collection(db, "chats");
  const q = query(chatsRef, where("participants", "array-contains", userId));

  return onSnapshot(q, async (snapshot) => {
    const chats = [];

    for (const docSnap of snapshot.docs) {
      const chatData = docSnap.data();
      const otherParticipantId = chatData.participants.find(
        (id) => id !== userId,
      );
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
};

// Mark messages as read
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

// Music Sync Functions
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

// ===== AUTO-DELETION AND EDITING FUNCTIONS =====
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
    const messageSnap = await getDoc(messageRef);

    if (!messageSnap.exists()) {
      throw new Error("Message not found");
    }

    const messageData = messageSnap.data();

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

// Enhanced function to track Cloudinary deletions
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
