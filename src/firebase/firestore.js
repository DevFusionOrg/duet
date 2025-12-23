import { auth, db } from "./firebase";
import { deleteUser } from "firebase/auth";
import {
  collection,
  doc,
  runTransaction,
  setDoc,
  getDoc,
  getCountFromServer,
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
  limit,
  increment,
} from "firebase/firestore";
import { handleIndexError } from '../utils/indexHelper';

// Simple in-memory cache for user profiles and blocked users to reduce repeated reads
const USER_PROFILE_CACHE = new Map();
const BLOCKED_USERS_CACHE = new Map();
const PROFILE_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const BLOCKED_USERS_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

// Batch-delete helper that respects Firestore's 500 writes per batch limit
const deleteInChunks = async (refs, chunkSize = 450) => {
  if (!refs || refs.length === 0) return;

  let batch = writeBatch(db);
  let ops = 0;

  for (const ref of refs) {
    if (!ref) continue;
    batch.delete(ref);
    ops += 1;

    if (ops >= chunkSize) {
      await batch.commit();
      batch = writeBatch(db);
      ops = 0;
    }
  }

  if (ops > 0) {
    await batch.commit();
  }
};

export const updateUsernameTransaction = async (
  uid,
  newUsername,
  oldUsername = null
) => {
  return await runTransaction(db, async (transaction) => {
    const newUsernameRef = doc(db, "usernames", newUsername);

    const newUsernameSnap = await transaction.get(newUsernameRef);

    if (newUsernameSnap.exists()) {
      if (newUsernameSnap.data().uid !== uid) {
        throw new Error("Username already taken");
      }
      return;
    }

    if (oldUsername) {
      const oldUsernameRef = doc(db, "usernames", oldUsername);
      transaction.delete(oldUsernameRef);
    }

    transaction.set(newUsernameRef, { uid });

    const userRef = doc(db, "users", uid);
    transaction.update(userRef, {
      username: newUsername,
    });
  });
};

export const sendPushNotification = async (senderId, receiverId, message, chatId) => {
  try {
    const [senderSnap, receiverSnap] = await Promise.all([
      getDoc(doc(db, "users", senderId)),
      getDoc(doc(db, "users", receiverId)),
    ]);

    if (!senderSnap.exists() || !receiverSnap.exists()) return;

    const senderData = senderSnap.data();
    const receiverData = receiverSnap.data();

    if (
      senderData.blockedUsers?.includes(receiverId) ||
      receiverData.blockedUsers?.includes(senderId)
    ) {
      return;
    }

    const receiverTokens = receiverData.notificationTokens || [];
    if (receiverTokens.length === 0) return;

    const senderUsername = senderData.username || senderData.displayName || "Someone";

    const response = await fetch("/api/send-notification", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tokens: receiverTokens,
        title: senderUsername,
        body:
          message.type === "image"
            ? "📷 Photo"
            : (message.text || "").substring(0, 100),
        data: {
          chatId,
          senderId,
          messageId: message.id,
          type: "new-message",
        },
      }),
    });

    return response.json();
  } catch (error) {
    console.error("Error sending push notification:", error);
  }
};

export const listenToUserFriends = (userId, callback) => {
  // Listen to the friends subcollection to avoid churn from user doc updates (presence, profile edits)
  const friendsRef = collection(db, "users", userId, "friends");

  return onSnapshot(friendsRef, (snap) => {
    if (!snap || snap.empty) {
      callback([]);
      return;
    }

    const ids = snap.docs.map((d) => d.id);
    callback(ids);
  }, (error) => {
    console.error("Error listening to friends subcollection:", error);
    callback([]);
  });
};

export const getUserFriendsWithProfiles = async (friendIds) => {
  if (!friendIds || friendIds.length === 0) return [];

  const uniqueIds = [...new Set(friendIds)];

  // Return cached profiles where available and collect missing IDs
  const cachedProfiles = [];
  const missingIds = [];
  uniqueIds.forEach((id) => {
    const cached = USER_PROFILE_CACHE.get(id);
    if (cached && Date.now() - cached.ts < PROFILE_CACHE_TTL_MS) {
      cachedProfiles.push({ ...cached.data, uid: id, id });
    } else {
      missingIds.push(id);
    }
  });

  if (missingIds.length === 0) {
    return cachedProfiles;
  }

  // Firestore `in` queries are limited to 10 values; batch accordingly
  const batches = [];
  for (let i = 0; i < missingIds.length; i += 10) {
    batches.push(missingIds.slice(i, i + 10));
  }

  try {
    const results = await Promise.all(
      batches.map((ids) =>
        getDocs(query(collection(db, "users"), where("__name__", "in", ids)))
      )
    );

    const fetched = [];
    results.forEach((snapshot) => {
      snapshot.docs.forEach((docSnap) => {
        const data = docSnap.data();
        USER_PROFILE_CACHE.set(docSnap.id, { data, ts: Date.now() });
        fetched.push({ ...data, uid: docSnap.id, id: docSnap.id });
      });
    });

    return [...cachedProfiles, ...fetched];
  } catch (error) {
    console.error("Error fetching friend profiles in batch:", error);
    return cachedProfiles; // Return what we have cached
  }
};

export const createUserProfile = async (user, username = null) => {
  if (!user) return;

  try {
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
      const userData = userSnap.data();

      const updateData = {
        displayName: user.displayName,
      };

      if (!userData.cloudinaryPublicId) {
        updateData.photoURL = user.photoURL;
      }

      // Initialize isOnline field if it doesn't exist (for old users)
      if (userData.isOnline === undefined) {
        updateData.isOnline = false;
        updateData.lastSeen = new Date();
      }
      
      await updateDoc(userRef, updateData);
      return;
    }

    const providerEmail = user?.providerData?.find((p) => p.email)?.email || "";
    const emailLocalPart = (user.email || providerEmail || "").split("@")[0];
    const displaySlug = (user.displayName || "")
      .replace(/\s+/g, "")
      .replace(/[^a-zA-Z0-9_.-]/g, "")
      .toLowerCase();

    let baseUsername = (
      username ||
      emailLocalPart ||
      displaySlug ||
      `user${user.uid.slice(0, 6)}`
    )
      .toLowerCase()
      .replace(/[^a-zA-Z0-9_.-]/g, "");

    if (!baseUsername || baseUsername.length < 3) {
      baseUsername = `user${user.uid.slice(0, 6)}`;
    }

    let finalUsername = baseUsername;
    let counter = 1;

    while (true) {
      const usernameRef = doc(db, "usernames", finalUsername);
      const usernameSnap = await getDoc(usernameRef);
      
      if (!usernameSnap.exists()) {
        break;
      }
      
      finalUsername = `${baseUsername}${counter++}`;
    }

    await runTransaction(db, async (transaction) => {
      const usernameRef = doc(db, "usernames", finalUsername);
      const usernameSnap = await transaction.get(usernameRef);
      
      if (usernameSnap.exists()) {
        throw new Error("Username taken during transaction");
      }

      transaction.set(usernameRef, { uid: user.uid });

      transaction.set(userRef, {
        uid: user.uid,
        displayName: user.displayName,
        email: user.email,
        photoURL: user.photoURL,
        username: finalUsername,
        bio: "",
        friends: [],
        friendRequests: [],
        blockedUsers: [],
        isOnline: false,
        lastSeen: new Date(),
        createdAt: new Date(),
      });
    });
  } catch (error) {
    console.error("Error creating user profile:", error);
    throw error;
  }
};

export const updateUsername = async (userId, newUsername) => {
  try {
    if (!newUsername || newUsername.length < 3 || newUsername.length > 16) {
      throw new Error("Username must be between 3 and 16 characters");
    }

    if (/\s/.test(newUsername)) {
      throw new Error("Username cannot contain spaces");
    }

    if (!/^[a-z0-9_.-]+$/.test(newUsername)) {
      throw new Error(
        "Username can only contain lowercase letters, numbers, dots, underscores, and hyphens"
      );
    }

    const userRef = doc(db, "users", userId);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      throw new Error("User not found");
    }

    const oldUsername = userSnap.data().username;

    await updateUsernameTransaction(userId, newUsername, oldUsername);

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
    const maxAttempts = 10;

    // Generate suggestions
    const generatedSuggestions = [];
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
        suggestion = `${baseUsername}${Math.floor(
          1 + Math.random() * 9
        )}${String.fromCharCode(97 + Math.floor(Math.random() * 26))}`;
      }

      generatedSuggestions.push(suggestion);
    }

    // Check all in parallel
    const checks = await Promise.all(
      generatedSuggestions.map(async (suggestion) => {
        const usernameRef = doc(db, "usernames", suggestion);
        const snap = await getDoc(usernameRef);
        return { suggestion, exists: snap.exists() };
      })
    );

    // Collect available suggestions
    for (const { suggestion, exists } of checks) {
      if (!exists) {
        suggestions.push(suggestion);
        if (suggestions.length >= 3) break;
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
    const cached = USER_PROFILE_CACHE.get(userId);
    if (cached && Date.now() - cached.ts < PROFILE_CACHE_TTL_MS) {
      return cached.data;
    }

    const userRef = doc(db, "users", userId);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
      const data = userSnap.data();
      USER_PROFILE_CACHE.set(userId, { data, ts: Date.now() });
      return data;
    }
    return null;
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

// Aggressive caching for blocked users to avoid repeated fetches
export const getBlockedUsersForUser = async (userId) => {
  try {
    const cached = BLOCKED_USERS_CACHE.get(userId);
    if (cached && Date.now() - cached.ts < BLOCKED_USERS_CACHE_TTL_MS) {
      return cached.data;
    }

    const userSnap = await getDoc(doc(db, "users", userId));
    if (!userSnap.exists()) return [];

    const blockedIds = userSnap.data().blockedUsers || [];
    BLOCKED_USERS_CACHE.set(userId, { data: blockedIds, ts: Date.now() });
    return blockedIds;
  } catch (error) {
    console.error("Error getting blocked users:", error);
    return [];
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

export const searchUsers = async (searchTerm, excludeUserId = null) => {
  if (!searchTerm) return [];

  try {
    let blockedUsers = [];

    if (excludeUserId) {
      const userProfile = await getUserProfile(excludeUserId);
      blockedUsers = userProfile?.blockedUsers || [];
    }

    const usersRef = collection(db, "users");

    const displayNameQuery = query(
      usersRef,
      where("displayName", ">=", searchTerm),
        where("displayName", "<=", searchTerm + "\uf8ff"),
        limit(20)
    );

    const usernameQuery = query(
      usersRef,
      where("username", ">=", searchTerm),
        where("username", "<=", searchTerm + "\uf8ff"),
        limit(20)
    );

    const [displayNameSnapshot, usernameSnapshot] = await Promise.all([
      getDocs(displayNameQuery),
      getDocs(usernameQuery),
    ]);

    const users = new Map();

    const addUser = (docSnap) => {
      if (excludeUserId && docSnap.id === excludeUserId) return;

      const otherUserData = docSnap.data();

      if (
        blockedUsers.includes(docSnap.id) ||
        otherUserData.blockedUsers?.includes(excludeUserId)
      ) {
        return;
      }

      users.set(docSnap.id, {
        id: docSnap.id,
        ...otherUserData,
      });
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
    if (fromUserId === toUserId) {
      throw new Error("You cannot send a request to yourself");
    }

    console.log("Sending friend request from:", fromUserId, "to:", toUserId);

    const [fromUser, toUserProfile] = await Promise.all([
      getUserProfile(fromUserId),
      getUserProfile(toUserId),
    ]);

    if (!toUserProfile) {
      throw new Error("User not found");
    }

    if (
      fromUser?.blockedUsers?.includes(toUserId) ||
      toUserProfile?.blockedUsers?.includes(fromUserId)
    ) {
      throw new Error("Cannot send request to blocked user");
    }

    if (toUserProfile.friends?.includes(fromUserId)) {
      throw new Error("You are already friends with this user");
    }

    const existingRequest = toUserProfile.friendRequests?.find(
      (req) => req.from === fromUserId && req.status === "pending"
    );

    if (existingRequest) {
      throw new Error("Friend request already sent");
    }

    const toUserRef = doc(db, "users", toUserId);
    const fromUserRef = doc(db, "users", fromUserId);

    // Write to arrays (legacy) and subcollections (new) for compatibility
    const payloadIncoming = { from: fromUserId, timestamp: new Date(), status: "pending" };
    const payloadOutgoing = { to: toUserId, timestamp: new Date(), status: "pending" };

    await Promise.all([
      updateDoc(toUserRef, { friendRequests: arrayUnion(payloadIncoming) }),
      updateDoc(fromUserRef, { sentFriendRequests: arrayUnion(payloadOutgoing) }).catch(() => {}),
      setDoc(doc(db, "users", toUserId, "friendRequests", fromUserId), payloadIncoming).catch(() => {}),
      setDoc(doc(db, "users", fromUserId, "sentFriendRequests", toUserId), payloadOutgoing).catch(() => {})
    ]);

    return { success: true };
  } catch (error) {
    console.error("Error sending friend request:", error);

    let errorMessage = "Error sending friend request";

    if (error.code === "permission-denied") {
      errorMessage = "Permission denied. Please check Firestore rules.";
    } else if (error.message.includes("already friends")) {
      errorMessage = "You are already friends with this user.";
    } else if (error.message.includes("already sent")) {
      errorMessage = "Friend request already sent.";
    } else if (error.message.includes("blocked")) {
      errorMessage = "You cannot send a request to this user.";
    } else if (error.message.includes("not found")) {
      errorMessage = "User not found.";
    } else {
      errorMessage = error.message || errorMessage;
    }

    throw new Error(errorMessage);
  }
};

export const acceptFriendRequest = async (userId, requestFromId) => {
  try {
    if (userId === requestFromId) {
      throw new Error("Invalid friend request");
    }

    const userRef = doc(db, "users", userId);
    const fromUserRef = doc(db, "users", requestFromId);

    const [userSnap, fromUserSnap] = await Promise.all([
      getDoc(userRef),
      getDoc(fromUserRef),
    ]);

    if (!userSnap.exists() || !fromUserSnap.exists()) {
      throw new Error("User not found");
    }

    const userData = userSnap.data();
    const fromUserData = fromUserSnap.data();

    if (
      userData.blockedUsers?.includes(requestFromId) ||
      fromUserData.blockedUsers?.includes(userId)
    ) {
      throw new Error("Cannot accept request from blocked user");
    }

    const requestToRemove = userData.friendRequests?.find(
      (req) => req.from === requestFromId && req.status === "pending"
    );

    if (!requestToRemove) {
      throw new Error("Friend request not found");
    }

    const batch = writeBatch(db);

    batch.update(userRef, {
      friends: arrayUnion(requestFromId),
      friendRequests: arrayRemove(requestToRemove),
    });

    const sentRequestToRemove = fromUserData.sentFriendRequests?.find(
      (req) => req.to === userId && req.status === "pending"
    );

    batch.update(fromUserRef, {
      friends: arrayUnion(userId),
      ...(sentRequestToRemove && { sentFriendRequests: arrayRemove(sentRequestToRemove) })
    });

    batch.set(
      doc(db, "users", userId, "friends", requestFromId),
      {
        displayName: fromUserData.displayName,
        photoURL: fromUserData.photoURL || null,
        lastSeen: fromUserData.lastSeen || null,
        isOnline: fromUserData.isOnline || false,
        addedAt: serverTimestamp(),
      }
    );

    batch.set(
      doc(db, "users", requestFromId, "friends", userId),
      {
        displayName: userData.displayName,
        photoURL: userData.photoURL || null,
        lastSeen: userData.lastSeen || null,
        isOnline: userData.isOnline || false,
        addedAt: serverTimestamp(),
      }
    );

    await batch.commit();

    // Remove subcollection entries
    await Promise.all([
      deleteDoc(doc(db, "users", userId, "friendRequests", requestFromId)).catch(() => {}),
      deleteDoc(doc(db, "users", requestFromId, "sentFriendRequests", userId)).catch(() => {}),
    ]);
    return { success: true };

  } catch (error) {
    console.error("Error accepting friend request:", error);
    throw new Error(error.message || "Error accepting friend request");
  }
};

export const loadFriendRequests = async (userId, pageSize = 20, lastDocTimestamp = null) => {
  try {
    // Prefer subcollection to avoid transferring large arrays on each user doc read
    const requestsRef = collection(db, "users", userId, "friendRequests");

    let q;
    if (lastDocTimestamp) {
      q = query(
        requestsRef,
        where("timestamp", "<", lastDocTimestamp),
        orderBy("timestamp", "desc"),
        limit(pageSize)
      );
    } else {
      q = query(requestsRef, orderBy("timestamp", "desc"), limit(pageSize));
    }

    const snap = await getDocs(q);

    // Fallback to legacy array if subcollection empty
    if (snap.empty) {
      const userSnap = await getDoc(doc(db, "users", userId));
      if (!userSnap.exists()) return { requests: [], hasMore: false };
      const friendRequests = userSnap.data().friendRequests || [];
      let filtered = friendRequests.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      if (lastDocTimestamp) {
        filtered = filtered.filter((req) => new Date(req.timestamp) < new Date(lastDocTimestamp));
      }
      const page = filtered.slice(0, pageSize);
      const hasMore = filtered.length > pageSize;
      const senderIds = page.map((req) => req.from);
      const profiles = await getUserFriendsWithProfiles(senderIds);
      const profileMap = new Map(profiles.map((p) => [p.uid || p.id, p]));
      const requests = page.map((req) => ({ ...req, senderProfile: profileMap.get(req.from) || null }));
      return {
        requests,
        hasMore,
        nextCursor: requests.length > 0 ? requests[requests.length - 1].timestamp : null,
      };
    }

    const page = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const senderIds = page.map((req) => req.from);
    const profiles = await getUserFriendsWithProfiles(senderIds);
    const profileMap = new Map(profiles.map((p) => [p.uid || p.id, p]));
    const requests = page.map((req) => ({ ...req, senderProfile: profileMap.get(req.from) || null }));

    return {
      requests,
      hasMore: snap.size === pageSize,
      nextCursor: requests.length > 0 ? requests[requests.length - 1].timestamp : null,
    };
  } catch (error) {
    console.error("Error loading friend requests:", error);
    return { requests: [], hasMore: false };
  }
};

export const rejectFriendRequest = async (userId, requestFromId) => {
  try {
    const userRef = doc(db, "users", userId);
    const fromUserRef = doc(db, "users", requestFromId);

    const [userSnap, fromUserSnap] = await Promise.all([
      getDoc(userRef),
      getDoc(fromUserRef),
    ]);

    if (!userSnap.exists()) {
      throw new Error("User not found");
    }

    const userData = userSnap.data();
    const fromUserData = fromUserSnap.data();

    const requestToRemove = userData.friendRequests?.find(
      (req) => req.from === requestFromId && req.status === "pending",
    );

    if (!requestToRemove) {
      throw new Error("Friend request not found");
    }

    const sentRequestToRemove = fromUserData?.sentFriendRequests?.find(
      (req) => req.to === userId && req.status === "pending"
    );

    const batch = writeBatch(db);

    batch.update(userRef, {
      friendRequests: arrayRemove(requestToRemove),
    });

    if (sentRequestToRemove) {
      batch.update(fromUserRef, {
        sentFriendRequests: arrayRemove(sentRequestToRemove),
      });
    }

    await batch.commit();

    // Remove subcollection entries
    await Promise.all([
      deleteDoc(doc(db, "users", userId, "friendRequests", requestFromId)).catch(() => {}),
      deleteDoc(doc(db, "users", requestFromId, "sentFriendRequests", userId)).catch(() => {}),
    ]);
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

export async function getUserFriends(uid) {
  const snapshot = await getDocs(
    collection(db, "users", uid, "friends")
  );

  return snapshot.docs.map(doc => ({
    id: doc.id,
    uid: doc.id,
    ...doc.data()
  }));
}

export const getOrCreateChat = async (user1Id, user2Id) => {
  try {
    const [user1, user2] = await Promise.all([
      getUserProfile(user1Id),
      getUserProfile(user2Id),
    ]);

    if (
      user1?.blockedUsers?.includes(user2Id) ||
      user2?.blockedUsers?.includes(user1Id)
    ) {
      throw new Error("Cannot create chat with blocked user");
    }

    const chatId = [user1Id, user2Id].sort().join("_");
    const chatRef = doc(db, "chats", chatId);

    const chatSnap = await getDoc(chatRef);

    if (!chatSnap.exists()) {
      const chatData = {
        id: chatId,
        participants: [user1Id, user2Id],
        participantUsernames: {
          [user1.username]: user1Id,
          [user2.username]: user2Id,
        },
        createdAt: new Date(),
        lastMessage: null,
        lastMessageAt: new Date(),
      };
      // Initialize user-specific unread counts
      chatData[`unreadCount_${user1Id}`] = 0;
      chatData[`unreadCount_${user2Id}`] = 0;
      
      await setDoc(chatRef, chatData);
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

    const [receiverSnap, senderSnap] = await Promise.all([
      getDoc(doc(db, "users", receiverId)),
      getDoc(doc(db, "users", senderId))
    ]);
    
    if (!receiverSnap.exists()) {
      throw new Error("Receiver not found");
    }
    
    const receiverData = receiverSnap.data();
    const senderData = senderSnap.exists() ? senderSnap.data() : {};

    if (receiverData.blockedUsers?.includes(senderId)) {
      throw new Error("You cannot send messages to this user. You have been blocked.");
    }
    
    if (senderData.blockedUsers?.includes(receiverId)) {
      throw new Error("You cannot send messages to a user you have blocked. Unblock them first.");
    }

    const messagesRef = collection(db, "chats", chatId, "messages");
    const now = new Date();

    const senderName = senderData?.displayName || senderData?.username || "Someone";
    const senderPhoto = senderData?.photoURL || "";

    const messageData = {
      senderId,
      senderName,
      senderPhoto,
      chatId,
      text: text || "",
      notificationText: text || (imageData ? "📷 Image" : ""),
      timestamp: now,
      read: false,
      readBy: null,
      readAt: null,
      seenBy: [],
      deletionTime: null,
      isSaved: false,
      isEdited: false,
      editHistory: [],
      canEditUntil: new Date(now.getTime() + 5 * 60 * 1000),
      isReply: false,
    };

    if (imageData) {
      messageData.image = {
        publicId: imageData.public_id,
        url: imageData.secure_url,
        // Generate thumbnail URL (200x200, quality 80) for faster loading
        thumbnailUrl: imageData.secure_url.replace(/upload\//, 'upload/w_200,q_80/'),
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
    // Set receiver-specific unread count, keep sender's at 0
    const updateData = {
      lastMessage: text || "📷 Image",
      lastMessageAt: now,
      lastMessageId: messageRef.id,
    };
    updateData[`unreadCount_${receiverId}`] = increment(1); // Increment for receiver
    updateData[`unreadCount_${senderId}`] = 0; // Keep sender's count at 0
    
    updateDoc(chatRef, updateData).catch(err => console.error("Error updating chat lastMessage:", err));

    sendPushNotification(senderId, receiverId, { ...messageData, text: text || "" }, chatId).catch(
      err => console.error("Error sending push notification:", err)
    );

    return messageRef.id;
  } catch (error) {
    console.error("Error sending message:", error);
    throw error;
  }
};

export const sendVoiceNote = async (chatId, senderId, voiceData) => {
  try {
    const receiverId = chatId.replace(senderId, '').replace('_', '');
    
    const receiverRef = doc(db, "users", receiverId);
    const receiverSnap = await getDoc(receiverRef);
    let senderData;
    
    if (receiverSnap.exists()) {
      const receiverData = receiverSnap.data();
      
      if (receiverData.blockedUsers && receiverData.blockedUsers.includes(senderId)) {
        throw new Error("You cannot send messages to this user. You have been blocked.");
      }
      
      const senderRef = doc(db, "users", senderId);
      const senderSnap = await getDoc(senderRef);
      
      if (senderSnap.exists()) {
        senderData = senderSnap.data();
        if (senderData.blockedUsers && senderData.blockedUsers.includes(receiverId)) {
          throw new Error("You cannot send messages to a user you have blocked. Unblock them first.");
        }
      }
    } else {
      throw new Error("Receiver not found");
    }

    const messagesRef = collection(db, "chats", chatId, "messages");

    const deletionTime = new Date();
    deletionTime.setHours(deletionTime.getHours() + 12);

    const senderName = senderData?.displayName || senderData?.username || "Someone";
    const senderPhoto = senderData?.photoURL || "";

    const messageData = {
      senderId,
      senderName,
      senderPhoto,
      chatId,
      text: "",
      notificationText: "🎤 Voice message",
      type: "voice",
      voice: {
        url: voiceData.url,
        publicId: voiceData.publicId,
        duration: voiceData.duration,
        format: voiceData.format,
        bytes: voiceData.bytes
      },
      timestamp: new Date(),
      read: false,
      readBy: null,
      readAt: null,
      seenBy: [],
      deletionTime: deletionTime,
      isSaved: false,
      isEdited: false,
      isReply: false,
    };

    await sendPushNotification(senderId, receiverId, { ...messageData, text: "🎤 Voice message" }, chatId);

    const messageRef = await addDoc(messagesRef, messageData);

    const chatRef = doc(db, "chats", chatId);
    const now = new Date();
    // Set receiver-specific unread count, keep sender's at 0
    const updateData = {
      lastMessage: "🎤 Voice message",
      lastMessageAt: now,
      lastMessageId: messageRef.id,
    };
    updateData[`unreadCount_${receiverId}`] = increment(1); // Increment for receiver
    updateData[`unreadCount_${senderId}`] = 0; // Keep sender's count at 0
    
    await updateDoc(chatRef, updateData);

    return messageRef.id;
  } catch (error) {
    console.error("Error sending voice note:", error);
    throw error;
  }
};

export const getUserChats = async (userId) => {
  try {
    const blockedUsers = await getBlockedUsersForUser(userId);
    
    const chatsRef = collection(db, "chats");
    const q = query(chatsRef, where("participants", "array-contains", userId));
    const querySnapshot = await getDocs(q);

    // Collect other participant IDs excluding blocked ones
    const chatDocs = querySnapshot.docs;
    const otherIds = new Set();
    const filteredChatDocs = [];
    for (const docSnap of chatDocs) {
      const chatData = docSnap.data();
      const otherParticipantId = chatData.participants.find((id) => id !== userId);
      if (blockedUsers.includes(otherParticipantId)) continue;
      filteredChatDocs.push(docSnap);
      if (otherParticipantId) otherIds.add(otherParticipantId);
    }

    // Batch fetch participant profiles
    const otherIdList = Array.from(otherIds);
    const profilesArr = await getUserFriendsWithProfiles(otherIdList);
    const profileMap = new Map(profilesArr.map((p) => [p.uid || p.id, p]));

    // Use cached unreadCount from chat document instead of counting
    const chats = filteredChatDocs.map((docSnap) => {
      const chatData = docSnap.data();
      const otherParticipantId = chatData.participants.find((id) => id !== userId);
      const otherUser = profileMap.get(otherParticipantId) || null;
      // Get user-specific unreadCount from chat document
      const unreadCount = chatData[`unreadCount_${userId}`] || 0;
      
      // Debug log
      if (unreadCount > 0) {
        console.log(`[getUserChats] Chat ${chatData.id} has ${unreadCount} unread messages for user ${userId}`);
      }
      
      return {
        id: chatData.id,
        ...chatData,
        otherParticipant: otherUser,
        unreadCount,
      };
    });

    chats.sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt));

    return chats;
  } catch (error) {
    console.error("Error getting user chats:", error);
    return [];
  }
};

export const getChatMessages = async (chatId, currentUserId, messagesLimit = 25) => {
  try {
    const currentUserRef = doc(db, "users", currentUserId);
    const currentUserSnap = await getDoc(currentUserRef);
    
    let blockedUsers = [];
    if (currentUserSnap.exists()) {
      const currentUserData = currentUserSnap.data();
      blockedUsers = currentUserData.blockedUsers || [];
    }

    const messagesRef = collection(db, "chats", chatId, "messages");
    const q = query(
      messagesRef, 
      orderBy("timestamp", "asc"),
      limit(messagesLimit)
    );
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

export const listenToChatMessages = (chatId, currentUserId, callback, messagesLimit = 25) => {
  let blockedUsers = [];
  let unsubscribeMessages;
  let bufferedMessages = [];
  let needsSort = false;
  const MAX_BUFFER_SIZE = messagesLimit * 2; // Prevent unbounded memory growth

  const init = async () => {
    blockedUsers = await getBlockedUsersForUser(currentUserId);

    const messagesRef = collection(db, "chats", chatId, "messages");
    // Get the NEWEST messages by ordering descending, then reverse them for display
    const q = query(messagesRef, orderBy("timestamp", "desc"), limit(messagesLimit));

    if (unsubscribeMessages) {
      unsubscribeMessages();
    }

    unsubscribeMessages = onSnapshot(
      q,
      async (snapshot) => {
        try {
          const now = new Date();
          const changes = snapshot.docChanges();

          // Refresh blockedUsers from cache once per snapshot
          const cached = BLOCKED_USERS_CACHE.get(currentUserId);
          if (cached && Array.isArray(cached.data)) {
            blockedUsers = cached.data;
          }

          // Optimization: Initial snapshot - get newest messages and reverse for chronological order
          if (bufferedMessages.length === 0 && snapshot.docs.length > 0 && changes.length === 0) {
            bufferedMessages = snapshot.docs
              .map((d) => ({ id: d.id, ...d.data() }))
              .filter((m) => !blockedUsers.includes(m.senderId))
              .filter(
                (m) => !(m.deletionTime && now > m.deletionTime.toDate() && !m.isSaved)
              )
              .reverse(); // Reverse to show oldest first (chronological order)
            callback(bufferedMessages);
            return;
          }

          // Optimization: Only process changes if there are any
          if (changes.length > 0) {
            for (const change of changes) {
              const doc = change.doc;
              const messageData = doc.data();

              const isBlocked = blockedUsers.includes(messageData.senderId);
              const isExpired =
                messageData.deletionTime &&
                now > messageData.deletionTime.toDate() &&
                !messageData.isSaved;

              if (change.type === "added") {
                if (!isBlocked && !isExpired) {
                  const exists = bufferedMessages.some((m) => m.id === doc.id);
                  if (!exists) {
                    bufferedMessages.push({ id: doc.id, ...messageData });
                    needsSort = true;
                  }
                }
              } else if (change.type === "modified") {
                const idx = bufferedMessages.findIndex((m) => m.id === doc.id);
                if (idx !== -1) {
                  if (!isBlocked && !isExpired) {
                    bufferedMessages[idx] = { id: doc.id, ...messageData };
                  } else {
                    bufferedMessages.splice(idx, 1);
                  }
                } else if (!isBlocked && !isExpired) {
                  bufferedMessages.push({ id: doc.id, ...messageData });
                  needsSort = true;
                }
              } else if (change.type === "removed") {
                const idx = bufferedMessages.findIndex((m) => m.id === doc.id);
                if (idx !== -1) bufferedMessages.splice(idx, 1);
              }
            }

            // Optimization: Only sort if needed and prevent unbounded growth
            if (needsSort) {
              bufferedMessages.sort((a, b) => {
                const ta = a.timestamp?.toDate?.() || a.timestamp || 0;
                const tb = b.timestamp?.toDate?.() || b.timestamp || 0;
                return ta - tb;
              });
              needsSort = false;
            }

            // Optimization: Keep buffer size bounded - keep NEWEST messages
            if (bufferedMessages.length > MAX_BUFFER_SIZE) {
              bufferedMessages = bufferedMessages.slice(-MAX_BUFFER_SIZE);
            }
          }

          callback(bufferedMessages);
        } catch (error) {
          console.error("Error processing chat messages snapshot:", error);
          callback(bufferedMessages);
        }
      },
      (error) => {
        console.error("Error in chat messages listener:", error);
        callback([]);
      }
    );
  };

  // Kick off listener
  init();

  return () => {
    if (unsubscribeMessages) {
      unsubscribeMessages();
    }
    bufferedMessages = []; // Clear buffer on unmount
  };
};

// Pagination function to load older messages (call when user scrolls up)
export const loadOlderMessages = async (chatId, currentUserId, cursorTimestamp, pageSize = 15) => {
  try {
    const currentUserRef = doc(db, "users", currentUserId);
    const currentUserSnap = await getDoc(currentUserRef);
    
    let blockedUsers = [];
    if (currentUserSnap.exists()) {
      const currentUserData = currentUserSnap.data();
      blockedUsers = currentUserData.blockedUsers || [];
    }

    const messagesRef = collection(db, "chats", chatId, "messages");
    
    // Query messages older than cursor (before the oldest currently loaded message)
    const q = query(
      messagesRef,
      orderBy("timestamp", "desc"),
      where("timestamp", "<", cursorTimestamp),
      limit(pageSize)
    );
    
    const querySnapshot = await getDocs(q);
    const now = new Date();
    const messages = [];

    // Collect messages in reverse order (oldest first for proper display order)
    const docsArray = querySnapshot.docs.reverse();
    
    for (const doc of docsArray) {
      const messageData = doc.data();
      
      if (blockedUsers.includes(messageData.senderId)) {
        continue;
      }

      if (
        messageData.deletionTime &&
        now > messageData.deletionTime.toDate() &&
        !messageData.isSaved
      ) {
        continue;
      }

      messages.push({
        id: doc.id,
        ...messageData,
      });
    }

    return {
      messages,
      newCursor: messages.length > 0 ? messages[0].timestamp : cursorTimestamp,
      hasMore: querySnapshot.docs.length === pageSize,
    };
  } catch (error) {
    console.error("Error loading older messages:", error);
    return {
      messages: [],
      newCursor: cursorTimestamp,
      hasMore: false,
    };
  }
};

export const listenToUserChats = (userId, callback) => {
  const chatsRef = collection(db, "chats");
  const q = query(chatsRef, where("participants", "array-contains", userId));
  let lastParticipantsKey = "";
  let lastProfileMap = new Map();

  return onSnapshot(q, async (snapshot) => {
    // Get cached blocked users
    const blockedUsers = await getBlockedUsersForUser(userId);
    
    const docs = snapshot.docs;
    const otherIds = new Set();
    const filteredDocs = [];

    for (const docSnap of docs) {
      const chatData = docSnap.data();
      const otherParticipantId = chatData.participants.find((id) => id !== userId);
      if (blockedUsers.includes(otherParticipantId)) continue;
      filteredDocs.push(docSnap);
      if (otherParticipantId) otherIds.add(otherParticipantId);
    }

    const participantsKey = Array.from(otherIds).sort().join(",");
    let profileMap = lastProfileMap;
    if (participantsKey !== lastParticipantsKey) {
      const profilesArr = await getUserFriendsWithProfiles(Array.from(otherIds));
      profileMap = new Map(profilesArr.map((p) => [p.uid || p.id, p]));
      lastParticipantsKey = participantsKey;
      lastProfileMap = profileMap;
    }

    // Use unreadCount cached on chat document
    const chats = filteredDocs.map((docSnap) => {
      const chatData = docSnap.data();
      const otherParticipantId = chatData.participants.find((id) => id !== userId);
      const otherUser = profileMap.get(otherParticipantId) || null;
      // Get user-specific unreadCount from chat document
      const unreadCount = chatData[`unreadCount_${userId}`] || 0;
      
      // Debug log to help troubleshoot
      if (unreadCount > 0) {
        console.log(`Chat ${chatData.id} has ${unreadCount} unread messages for user ${userId}`);
      }
      
      return {
        id: chatData.id,
        ...chatData,
        otherParticipant: otherUser,
        unreadCount,
      };
    });

    chats.sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt));
    callback(chats);
  });
};

export const markMessagesAsRead = async (chatId, userId) => {
  try {
    const messagesRef = collection(db, "chats", chatId, "messages");
    const q = query(
      messagesRef,
      where("senderId", "!=", userId),
      where("read", "==", false),
      limit(50) 
    );

    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      return 0;
    }

    const batch = writeBatch(db);
    const readAt = new Date();
    const deletionTime = new Date(readAt.getTime() + 24 * 60 * 60 * 1000);
    const messageCount = querySnapshot.size;

    querySnapshot.docs.forEach((doc) => {
      batch.update(doc.ref, { 
        read: true,
        readAt,
        deletionTime
      });
    });

    // Update user-specific unreadCount on chat document (cache it)
    const chatRef = doc(db, "chats", chatId);
    const updateData = {
      lastReadAt: readAt
    };
    updateData[`unreadCount_${userId}`] = 0; // Reset user-specific count to 0
    batch.update(chatRef, updateData);

    await batch.commit();
    console.log(`${messageCount} messages marked as read in chat ${chatId}`);
    return messageCount;
  } catch (error) {
    // Handle index building error gracefully
    if (handleIndexError(error)) {
      return 0; // Silently skip if index is building
    }
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
    const aggSnap = await getCountFromServer(q);
    return aggSnap?.data()?.count ?? 0;
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
    const queueRef = collection(db, "chats", chatId, "queueItems");
    const queueItem = {
      videoId: videoData.videoId,
      title: videoData.title,
      thumbnail: videoData.thumbnail,
      duration: videoData.duration,
      addedBy: addedBy,
      addedAt: new Date(),
      played: false,
    };

    await addDoc(queueRef, queueItem);
    console.log("Added to music queue (subcollection):", queueItem);
  } catch (error) {
    console.error("Error adding to music queue:", error);
    throw error;
  }
};

export const getMusicQueue = async (chatId) => {
  try {
    // Prefer subcollection
    const queueRef = collection(db, "chats", chatId, "queueItems");
    const snap = await getDocs(query(queueRef, orderBy("addedAt", "asc")));
    if (!snap.empty) {
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    }
    // Fallback to legacy array
    const chatSnap = await getDoc(doc(db, "chats", chatId));
    return chatSnap.exists() ? chatSnap.data().musicQueue || [] : [];
  } catch (error) {
    console.error("Error getting music queue:", error);
    return [];
  }
};

export const listenToMusicQueue = (chatId, callback) => {
  // Prefer subcollection listener with bounds
  const queueRef = collection(db, "chats", chatId, "queueItems");
  const q = query(queueRef, orderBy("addedAt", "desc"), limit(50));

  return onSnapshot(q, (snapshot) => {
    if (!snapshot.empty) {
      const items = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      callback(items.reverse()); // oldest first for UI
    } else {
      // Fallback to legacy array on chat doc
      const chatRef = doc(db, "chats", chatId);
      getDoc(chatRef)
        .then((docSnap) => {
          if (docSnap.exists()) {
            const chatData = docSnap.data();
            const queue = (chatData.musicQueue || []).slice(-50);
            callback(queue);
          } else {
            callback([]);
          }
        })
        .catch(() => callback([]));
    }
  });
};

// Load older songs from music queue with pagination
export const loadOlderMusicQueue = async (chatId, pageSize = 20, lastIndex = null) => {
  try {
    // Prefer subcollection pagination by timestamp
    const queueRef = collection(db, "chats", chatId, "queueItems");
    let q;
    if (lastIndex) {
      q = query(queueRef, where("addedAt", "<", lastIndex), orderBy("addedAt", "desc"), limit(pageSize));
    } else {
      q = query(queueRef, orderBy("addedAt", "desc"), limit(pageSize));
    }

    const snap = await getDocs(q);
    if (!snap.empty) {
      const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const hasMore = snap.size === pageSize;
      return {
        items: items.reverse(),
        hasMore,
        nextCursor: items.length > 0 ? items[0].addedAt : null,
      };
    }

    // Fallback to legacy array on chat doc
    const chatSnap = await getDoc(doc(db, "chats", chatId));
    if (!chatSnap.exists()) return { items: [], hasMore: false };
    const chatData = chatSnap.data();
    const fullQueue = chatData.musicQueue || [];
    let startIndex = fullQueue.length - 50;
    if (lastIndex !== null) {
      startIndex = lastIndex - 1;
    }
    if (startIndex <= 0) return { items: [], hasMore: false };
    const endIndex = Math.max(0, startIndex - pageSize);
    const items = fullQueue.slice(endIndex, startIndex);
    const hasMore = endIndex > 0;
    return { items: items.reverse(), hasMore, nextCursor: items.length > 0 ? endIndex : null };
  } catch (error) {
    console.error("Error loading older music queue:", error);
    return { items: [], hasMore: false };
  }
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
        "Edit time expired. You can only edit messages within 5 minutes of sending.",
      );
    }

    const editHistory = messageData.editHistory || [];
    editHistory.push({
      previousText: messageData.text, 
      editedAt: new Date(),
    });
    // Keep only last 5 edits to prevent unbounded array growth
    if (editHistory.length > 5) {
      editHistory.shift();
    }

    await updateDoc(messageRef, {
      text: newText,
      isEdited: true,
      editHistory: editHistory,
      lastEditedAt: new Date(),
    });
    
    // Only update lastMessage text if this is the last message, preserve unread counts
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
      scheduledForDeletion: new Date(Date.now() + 24 * 60 * 60 * 1000), 
    });

    console.log("Cloudinary deletion tracked for:", imageData.publicId);
  } catch (error) {
    console.error("Error tracking Cloudinary deletion:", error);
  }
};

// Legacy presence helpers removed in favor of RTDB presence (see firebase/presence.js)

export const deleteChat = async (chatId, userId) => {
  try {
    const chatRef = doc(db, "chats", chatId);
    const chatSnap = await getDoc(chatRef);
    
    if (!chatSnap.exists() || !chatSnap.data().participants.includes(userId)) {
      throw new Error("Chat not found or unauthorized");
    }

    const messagesRef = collection(db, "chats", chatId, "messages");
    const messagesSnap = await getDocs(messagesRef);
    
    const batch = writeBatch(db);
    messagesSnap.docs.forEach(doc => {
      batch.delete(doc.ref);
    });

    batch.delete(chatRef);
    await batch.commit();

    return { success: true };
    
  } catch (error) {
    console.error("Error deleting chat:", error);
    throw error;
  }
};

export const blockUser = async (userId, userToBlockId) => {
  if (userId === userToBlockId) {
    throw new Error("You cannot block yourself");
  }

  const userRef = doc(db, "users", userId);
  const blockedUserRef = doc(db, "users", userToBlockId);

  const userSnap = await getDoc(userRef);
  if (!userSnap.exists()) {
    throw new Error("User not found");
  }

  const userData = userSnap.data();

  if (userData.blockedUsers?.includes(userToBlockId)) {
    return { success: true };
  }

  const chatId = [userId, userToBlockId].sort().join("_");
  const chatRef = doc(db, "chats", chatId);

  const batch = writeBatch(db);

  batch.update(userRef, {
    blockedUsers: arrayUnion(userToBlockId),
    friends: arrayRemove(userToBlockId),
  });

  batch.update(blockedUserRef, {
    friends: arrayRemove(userId),
  });

  batch.delete(doc(db, "users", userId, "friends", userToBlockId));
  batch.delete(doc(db, "users", userToBlockId, "friends", userId));

  const incomingRequests = userData.friendRequests || [];
  incomingRequests
    .filter((req) => req.from === userToBlockId)
    .forEach((req) => {
      batch.update(userRef, {
        friendRequests: arrayRemove(req),
      });
    });

  const blockedUserSnap = await getDoc(blockedUserRef);
  if (blockedUserSnap.exists()) {
    const theirRequests = blockedUserSnap.data().friendRequests || [];
    theirRequests
      .filter((req) => req.from === userId)
      .forEach((req) => {
        batch.update(blockedUserRef, {
          friendRequests: arrayRemove(req),
        });
      });
  }

  batch.delete(chatRef);

  await batch.commit();
  // Update local blocked users cache for faster propagation
  try {
    const cached = BLOCKED_USERS_CACHE.get(userId);
    const current = cached?.data || [];
    const updated = Array.from(new Set([...current, userToBlockId]));
    BLOCKED_USERS_CACHE.set(userId, { data: updated, ts: Date.now() });
  } catch (e) {
    // noop
  }
  return { success: true };
};

export const unblockUser = async (userId, userToUnblockId) => {
  const userRef = doc(db, "users", userId);

  await updateDoc(userRef, {
    blockedUsers: arrayRemove(userToUnblockId),
  });

  // Update local cache immediately
  try {
    const cached = BLOCKED_USERS_CACHE.get(userId);
    const current = cached?.data || [];
    const updated = current.filter((id) => id !== userToUnblockId);
    BLOCKED_USERS_CACHE.set(userId, { data: updated, ts: Date.now() });
  } catch (e) {
    // noop
  }
  return { success: true };
};

export const getBlockedUsers = async (userId) => {
  const userSnap = await getDoc(doc(db, "users", userId));
  if (!userSnap.exists()) return [];

  const blockedIds = userSnap.data().blockedUsers || [];
  if (blockedIds.length === 0) return [];

  const profiles = await Promise.all(
    blockedIds.map(id => getUserProfile(id))
  );

  return profiles.filter(Boolean);
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
    deletionTime.setHours(deletionTime.getHours() + 12);
    
    const replyData = {
      senderId,
      text: replyText || "",
      notificationText: replyText || "",
      timestamp: new Date(),
      read: false,
      readBy: null,
      readAt: null,
      seenBy: [],
      deletionTime: deletionTime,
      isSaved: false,
      isEdited: false,
      editHistory: [],
      canEditUntil: new Date(Date.now() + 5 * 60 * 1000),
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
        thumbnailUrl: imageData.secure_url.replace(/upload\//, 'upload/w_200,q_80/'),
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
        thumbnailUrl: originalMessage.image.url.replace(/upload\//, 'upload/w_200,q_80/'),
        publicId: originalMessage.image.publicId,
      };
    }
    
    const receiverId = chatId.replace(senderId, '').replace('_', '');
    
    await sendPushNotification(senderId, receiverId, { ...replyData, text: replyText || "" }, chatId);
    
    const messageRef = await addDoc(messagesRef, replyData);
    
    const chatRef = doc(db, "chats", chatId);
    const now = new Date();
    // Set receiver-specific unread count, keep sender's at 0
    const updateData = {
      lastMessage: replyText || "📷 Image",
      lastMessageAt: now,
      lastMessageId: messageRef.id,
    };
    updateData[`unreadCount_${receiverId}`] = increment(1); // Increment for receiver
    updateData[`unreadCount_${senderId}`] = 0; // Keep sender's count at 0
    
    await updateDoc(chatRef, updateData);
    
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

export const deleteFriend = async (userId, friendId, options = { deleteChat: true }) => {
  try {
    if (userId === friendId) {
      throw new Error("You cannot remove yourself");
    }

    const userRef = doc(db, "users", userId);
    const friendRef = doc(db, "users", friendId);

    const userFriendSubRef = doc(db, "users", userId, "friends", friendId);
    const friendUserSubRef = doc(db, "users", friendId, "friends", userId);

    const batch = writeBatch(db);

    batch.update(userRef, {
      friends: arrayRemove(friendId),
    });

    batch.update(friendRef, {
      friends: arrayRemove(userId),
    });

    batch.delete(userFriendSubRef);
    batch.delete(friendUserSubRef);

    if (options.deleteChat) {
      const chatId = [userId, friendId].sort().join("_");
      const chatRef = doc(db, "chats", chatId);
      batch.delete(chatRef);
    }

    await batch.commit();
    return { success: true };
  } catch (error) {
    console.error("Error deleting friend:", error);
    throw error;
  }
};

export const deleteUserAccount = async (userId, options = { deleteAuth: true }) => {
  const { deleteAuth } = options;

  if (!userId) {
    throw new Error("User ID is required for account deletion");
  }

  try {
    const userRef = doc(db, "users", userId);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      if (deleteAuth && auth?.currentUser?.uid === userId) {
        try {
          await deleteUser(auth.currentUser);
        } catch (authError) {
          console.error("Error deleting auth user for missing profile:", authError);
        }
      }

      return { success: true, message: "User profile already removed" };
    }

    const userData = userSnap.data() || {};
    const username = userData.username;

    // 1) Delete all chats and messages involving this user
    const chatsSnap = await getDocs(
      query(collection(db, "chats"), where("participants", "array-contains", userId)),
    );

    for (const chatDoc of chatsSnap.docs) {
      const messagesSnap = await getDocs(collection(db, "chats", chatDoc.id, "messages"));
      await deleteInChunks(messagesSnap.docs.map((d) => d.ref));
      await deleteInChunks([chatDoc.ref]);
    }

    // 2) Clean friendships and friend subcollection entries
    const friendIds = userData.friends || [];
    for (const friendId of friendIds) {
      const friendRef = doc(db, "users", friendId);
      const friendSnap = await getDoc(friendRef);

      if (friendSnap.exists()) {
        const friendData = friendSnap.data() || {};

        // Use arrayRemove for atomic operations
        const updatePayload = {
          friends: arrayRemove(userId),
        };

        // Only include these fields if they have data
        const incomingRequests = (friendData.friendRequests || []).filter((req) => req.from === userId);
        const outgoingRequests = (friendData.sentFriendRequests || []).filter((req) => req.to === userId);
        
        if (incomingRequests.length > 0) {
          incomingRequests.forEach((req) => {
            updatePayload.friendRequests = arrayRemove(req);
          });
        }
        
        if (outgoingRequests.length > 0) {
          outgoingRequests.forEach((req) => {
            updatePayload.sentFriendRequests = arrayRemove(req);
          });
        }

        if ((friendData.blockedUsers || []).includes(userId)) {
          updatePayload.blockedUsers = arrayRemove(userId);
        }

        await updateDoc(friendRef, updatePayload);
      }

      await deleteDoc(doc(db, "users", friendId, "friends", userId)).catch(() => {});
    }

    // Remove incoming friend requests (others -> user)
    const incomingRequests = userData.friendRequests || [];
    for (const req of incomingRequests) {
      const fromRef = doc(db, "users", req.from);
      const fromSnap = await getDoc(fromRef);

      if (fromSnap.exists()) {
        const fromData = fromSnap.data() || {};
        const sentReqsToRemove = (fromData.sentFriendRequests || []).filter((r) => r.to === userId);
        
        const updatePayload = {};
        sentReqsToRemove.forEach((r) => {
          if (!updatePayload.sentFriendRequests) {
            updatePayload.sentFriendRequests = arrayRemove(r);
          }
        });

        if (Object.keys(updatePayload).length > 0) {
          await updateDoc(fromRef, updatePayload);
        }
      }
    }

    // Remove outgoing friend requests (user -> others)
    const outgoingRequests = userData.sentFriendRequests || [];
    for (const req of outgoingRequests) {
      const toRef = doc(db, "users", req.to);
      const toSnap = await getDoc(toRef);

      if (toSnap.exists()) {
        const toData = toSnap.data() || {};
        const reqsToRemove = (toData.friendRequests || []).filter((r) => r.from === userId);
        
        const updatePayload = {};
        reqsToRemove.forEach((r) => {
          if (!updatePayload.friendRequests) {
            updatePayload.friendRequests = arrayRemove(r);
          }
        });

        if (Object.keys(updatePayload).length > 0) {
          await updateDoc(toRef, updatePayload);
        }
      }
    }

    // Clear any blocks pointing at this user
    const blockedBySnap = await getDocs(
      query(collection(db, "users"), where("blockedUsers", "array-contains", userId)),
    );

    for (const blockedDoc of blockedBySnap.docs) {
      const blockedData = blockedDoc.data() || {};
      
      const updatePayload = {
        blockedUsers: arrayRemove(userId),
        friends: arrayRemove(userId),
      };

      // Clean up any friend requests
      const incomingReqs = (blockedData.friendRequests || []).filter((req) => req.from === userId);
      const outgoingReqs = (blockedData.sentFriendRequests || []).filter((req) => req.to === userId);

      incomingReqs.forEach((req) => {
        if (!updatePayload.friendRequests) {
          updatePayload.friendRequests = arrayRemove(req);
        }
      });

      outgoingReqs.forEach((req) => {
        if (!updatePayload.sentFriendRequests) {
          updatePayload.sentFriendRequests = arrayRemove(req);
        }
      });

      await updateDoc(blockedDoc.ref, updatePayload).catch((err) => console.error("Error cleaning block entry:", err));
    }

    // Delete the user's friends subcollection documents
    const friendsSubSnap = await getDocs(collection(db, "users", userId, "friends"));
    await deleteInChunks(friendsSubSnap.docs.map((d) => d.ref));

    // Remove username mapping if present
    if (username) {
      await deleteDoc(doc(db, "usernames", username)).catch(() => {});
    }

    // Delete the user document itself
    await deleteDoc(userRef);
    USER_PROFILE_CACHE.delete(userId);

    // Delete authentication record when requested and available
    if (deleteAuth && auth?.currentUser?.uid === userId) {
      try {
        await deleteUser(auth.currentUser);
      } catch (authError) {
        console.error("Error deleting Firebase Auth user:", authError);
      }
    }

    return { success: true };
  } catch (error) {
    console.error("Error deleting user account:", error);
    throw error;
  }
};

export const setTypingStatus = async (chatId, userId, isTyping) => {
  try {
    const chatRef = doc(db, "chats", chatId);
    const typingField = `typing.${userId}`;
    // Throttle rapid typing updates to reduce write frequency
    const key = `${chatId}:${userId}`;
    const now = Date.now();
    const last = setTypingStatus._last || (setTypingStatus._last = new Map());
    const lastEntry = last.get(key) || { ts: 0, lastState: null };

    const minIntervalMs = 2000; // at most one write every 2s while typing

    if (isTyping) {
      if (lastEntry.lastState !== true || (now - lastEntry.ts) > minIntervalMs) {
        await updateDoc(chatRef, { [typingField]: serverTimestamp() });
        last.set(key, { ts: now, lastState: true });
      }
    } else {
      // Write stop-typing immediately but update cache
      await updateDoc(chatRef, { [typingField]: null });
      last.set(key, { ts: now, lastState: false });
    }
  } catch (error) {
    console.error("Error setting typing status:", error);
  }
};

export const listenToTypingStatus = (chatId, userId, callback) => {
  const chatRef = doc(db, "chats", chatId);
  
  return onSnapshot(chatRef, (docSnap) => {
    if (docSnap.exists()) {
      const data = docSnap.data();
      const typing = data.typing || {};

      const otherUserId = chatId.split('_').find(id => id !== userId);
      const otherUserTyping = typing[otherUserId];
      
      if (otherUserTyping) {
        
        const typingTime = otherUserTyping.toDate ? otherUserTyping.toDate() : new Date(otherUserTyping);
        const now = new Date();
        const diffSeconds = (now - typingTime) / 1000;
        
        callback(diffSeconds < 5);
      } else {
        callback(false);
      }
    } else {
      callback(false);
    }
  });
};

// Migration function to convert old unreadCount to user-specific counts
export const migrateOldUnreadCounts = async (userId) => {
  try {
    console.log("Starting unreadCount migration for user:", userId);
    const chatsRef = collection(db, "chats");
    const q = query(chatsRef, where("participants", "array-contains", userId));
    const querySnapshot = await getDocs(q);

    const batch = writeBatch(db);
    let migratedCount = 0;

    for (const docSnap of querySnapshot.docs) {
      const chatData = docSnap.data();
      const chatRef = doc(db, "chats", docSnap.id);
      const chatId = docSnap.id;
      
      // Check if this chat needs migration (has old unreadCount or missing user-specific counts)
      const needsMigration = 'unreadCount' in chatData || 
                            !(`unreadCount_${userId}` in chatData);
      
      if (needsMigration) {
        const participants = chatData.participants;
        const updateData = {};
        
        // Count actual unread messages for each participant
        for (const participantId of participants) {
          try {
            const messagesRef = collection(db, "chats", chatId, "messages");
            const unreadQuery = query(
              messagesRef,
              where("senderId", "!=", participantId),
              where("read", "==", false)
            );
            const unreadSnapshot = await getDocs(unreadQuery);
            updateData[`unreadCount_${participantId}`] = unreadSnapshot.size;
          } catch (err) {
            // If query fails (e.g., index not ready), set to 0
            updateData[`unreadCount_${participantId}`] = 0;
          }
        }
        
        // Remove the old unreadCount field if it exists
        if ('unreadCount' in chatData) {
          updateData.unreadCount = null;
        }
        
        batch.update(chatRef, updateData);
        migratedCount++;
        
        console.log(`Migrated chat ${chatId}:`, updateData);
      }
    }

    if (migratedCount > 0) {
      await batch.commit();
      console.log(`Successfully migrated ${migratedCount} chats`);
    } else {
      console.log("No chats needed migration");
    }

    return migratedCount;
  } catch (error) {
    console.error("Error migrating unread counts:", error);
    throw error;
  }
};
