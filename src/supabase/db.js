import { supabase } from "./supabase";

// In-memory cache for user profiles
const USER_PROFILE_CACHE = new Map();
const BLOCKED_USERS_CACHE = new Map();
const PROFILE_CACHE_TTL_MS = 5 * 60 * 1000;

// Helper to normalize Supabase timestamps and user fields to match the app's expectations
const normalizeProfile = (data) => {
  if (!data) return null;
  return {
    ...data,
    uid: data.id,
    displayName: data.display_name || data.username,
    photoURL: data.photo_url || "",
    cloudinaryPublicId: data.cloudinary_public_id || null,
    isOnline: data.is_online || false,
    lastSeen: data.last_seen ? new Date(data.last_seen) : null,
    createdAt: data.created_at ? new Date(data.created_at) : null,
  };
};

const normalizeMessage = (data) => {
  if (!data) return null;
  return {
    ...data,
    id: data.id,
    senderId: data.sender_id,
    senderName: data.sender_name || "Someone",
    senderPhoto: data.sender_photo || "",
    chatId: data.chat_id,
    timestamp: data.created_at ? new Date(data.created_at) : new Date(),
    read: !!data.read,
    readAt: data.read_at ? new Date(data.read_at) : null,
    isSaved: !!data.is_saved,
    isEdited: !!data.is_edited,
    isReply: !!data.is_reply,
    originalMessageText: data.original_message_text || "",
    replyToId: data.reply_to_id || null,
    deletionTime: data.deletion_time ? new Date(data.deletion_time) : null,
    image: data.image || null,
    voice: data.voice || null,
  };
};

// -------------------------------------------------------------
// USER PROFILES
// -------------------------------------------------------------
export const getUserProfile = async (userId) => {
  if (!userId) return null;

  const cached = USER_PROFILE_CACHE.get(userId);
  if (cached && Date.now() - cached.ts < PROFILE_CACHE_TTL_MS) {
    return cached.data;
  }

  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (error || !data) return null;

    const normalized = normalizeProfile(data);
    USER_PROFILE_CACHE.set(userId, { data: normalized, ts: Date.now() });
    return normalized;
  } catch (err) {
    console.error("getUserProfile error:", err);
    return null;
  }
};

export const createUserProfile = async (user, customUsername = null) => {
  if (!user?.uid && !user?.id) return;
  const uid = user.uid || user.id;

  try {
    const existing = await getUserProfile(uid);
    if (existing) {
      const updates = {
        display_name: user.displayName || existing.displayName,
      };
      if (user.photoURL && !existing.cloudinaryPublicId) {
        updates.photo_url = user.photoURL;
      }
      await supabase.from("profiles").update(updates).eq("id", uid);
      return;
    }

    const emailPrefix = (user.email || "").split("@")[0] || "user";
    const base = (customUsername || emailPrefix)
      .toLowerCase()
      .replace(/[^a-z0-9_.-]/g, "")
      .slice(0, 16);
    const finalUsername = base.length >= 3 ? base : `user_${String(uid).slice(0, 6)}`;

    const newProfile = {
      id: uid,
      username: finalUsername,
      display_name: user.displayName || finalUsername,
      email: user.email || "",
      photo_url: user.photoURL || "",
      bio: "",
      is_online: true,
      last_seen: new Date().toISOString(),
    };

    const { error } = await supabase.from("profiles").upsert(newProfile);
    if (error) console.error("Error creating user profile in Supabase:", error);
  } catch (err) {
    console.error("createUserProfile error:", err);
  }
};

export const updateUsername = async (userId, newUsername) => {
  const clean = (newUsername || "").trim().toLowerCase();
  if (clean.length < 3 || clean.length > 16) {
    throw new Error("Username must be between 3 and 16 characters");
  }
  if (!/^[a-z0-9_.-]+$/.test(clean)) {
    throw new Error("Username can only contain lowercase letters, numbers, dots, and underscores");
  }

  // Check if username is already taken by someone else
  const { data: existing } = await supabase
    .from("profiles")
    .select("id")
    .eq("username", clean)
    .neq("id", userId)
    .single();

  if (existing) {
    throw new Error("Username already taken");
  }

  const { error } = await supabase
    .from("profiles")
    .update({ username: clean, updated_at: new Date().toISOString() })
    .eq("id", userId);

  if (error) throw error;
  USER_PROFILE_CACHE.delete(userId);
  return { success: true, username: clean };
};

export const updateUserProfilePicture = async (userId, photoURL, cloudinaryPublicId = null) => {
  const { error } = await supabase
    .from("profiles")
    .update({
      photo_url: photoURL,
      cloudinary_public_id: cloudinaryPublicId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);

  if (error) throw error;
  USER_PROFILE_CACHE.delete(userId);
};

export const searchUsers = async (searchTerm, excludeUserId = null) => {
  const term = (searchTerm || "").trim().toLowerCase();
  if (!term) return [];

  let query = supabase
    .from("profiles")
    .select("id, username, display_name, photo_url, bio")
    .or(`username.ilike.%${term}%,display_name.ilike.%${term}%`)
    .limit(20);

  if (excludeUserId) {
    query = query.neq("id", excludeUserId);
  }

  const { data, error } = await query;
  if (error) {
    console.error("searchUsers error:", error);
    return [];
  }
  return (data || []).map(normalizeProfile);
};

// -------------------------------------------------------------
// FRIENDS & FRIEND REQUESTS
// -------------------------------------------------------------
export const getUserFriends = async (uid) => {
  if (!uid) return [];
  const { data, error } = await supabase
    .from("friends")
    .select("friend_id")
    .eq("user_id", uid);

  if (error) {
    console.error("getUserFriends error:", error);
    return [];
  }
  return (data || []).map((row) => row.friend_id);
};

export const getUserFriendsWithProfiles = async (friendIds) => {
  if (!friendIds || friendIds.length === 0) return [];
  const uniqueIds = [...new Set(friendIds)];

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .in("id", uniqueIds);

  if (error) {
    console.error("getUserFriendsWithProfiles error:", error);
    return [];
  }
  return (data || []).map(normalizeProfile);
};

export const listenToUserFriends = (userId, callback) => {
  if (!userId) return () => {};

  // Initial fetch
  getUserFriends(userId).then(callback);

  // Realtime subscription
  const channel = supabase
    .channel(`friends:${userId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "friends", filter: `user_id=eq.${userId}` },
      () => {
        getUserFriends(userId).then(callback);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};

export const sendFriendRequest = async (fromUserId, toUserId) => {
  if (!fromUserId || !toUserId || fromUserId === toUserId) return;

  const { error } = await supabase.from("friend_requests").insert({
    from_user_id: fromUserId,
    to_user_id: toUserId,
    status: "pending",
  });

  if (error && error.code !== "23505") {
    // 23505 = unique violation (already sent)
    console.error("sendFriendRequest error:", error);
    throw error;
  }
};

export const acceptFriendRequest = async (userId, requestFromId) => {
  // Add friendship both ways
  await supabase.from("friends").upsert([
    { user_id: userId, friend_id: requestFromId },
    { user_id: requestFromId, friend_id: userId },
  ]);

  // Remove or update the friend request
  await supabase
    .from("friend_requests")
    .delete()
    .eq("from_user_id", requestFromId)
    .eq("to_user_id", userId);
};

export const rejectFriendRequest = async (userId, requestFromId) => {
  await supabase
    .from("friend_requests")
    .delete()
    .eq("from_user_id", requestFromId)
    .eq("to_user_id", userId);
};

export const loadFriendRequests = async (userId) => {
  if (!userId) return [];
  const { data, error } = await supabase
    .from("friend_requests")
    .select("*, from_user:profiles!from_user_id(*)")
    .eq("to_user_id", userId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("loadFriendRequests error:", error);
    return [];
  }

  return (data || []).map((row) => ({
    id: row.id,
    from: row.from_user_id,
    fromUser: normalizeProfile(row.from_user),
    timestamp: new Date(row.created_at),
    status: row.status,
  }));
};

export const listenToIncomingFriendRequestCount = (userId, callback) => {
  if (!userId) return () => {};

  const fetchCount = async () => {
    const { count, error } = await supabase
      .from("friend_requests")
      .select("id", { count: "exact", head: true })
      .eq("to_user_id", userId)
      .eq("status", "pending");

    if (!error) callback(count || 0);
  };

  fetchCount();

  const channel = supabase
    .channel(`friend_requests:${userId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "friend_requests", filter: `to_user_id=eq.${userId}` },
      () => fetchCount()
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};

export const deleteFriend = async (userId, friendId) => {
  await supabase
    .from("friends")
    .delete()
    .or(`and(user_id.eq.${userId},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${userId})`);
};

// -------------------------------------------------------------
// BLOCKED USERS
// -------------------------------------------------------------
export const blockUser = async (userId, userToBlockId) => {
  await supabase.from("blocked_users").insert({
    user_id: userId,
    blocked_id: userToBlockId,
  });
  BLOCKED_USERS_CACHE.delete(userId);
};

export const unblockUser = async (userId, userToUnblockId) => {
  await supabase
    .from("blocked_users")
    .delete()
    .eq("user_id", userId)
    .eq("blocked_id", userToUnblockId);
  BLOCKED_USERS_CACHE.delete(userId);
};

export const getBlockedUsersForUser = async (userId) => {
  if (!userId) return [];
  const { data } = await supabase
    .from("blocked_users")
    .select("blocked_id")
    .eq("user_id", userId);

  return (data || []).map((row) => row.blocked_id);
};

export const getBlockedUsers = getBlockedUsersForUser;

// -------------------------------------------------------------
// CHATS & MESSAGES
// -------------------------------------------------------------
export const getOrCreateChat = async (user1Id, user2Id) => {
  const chatId = [user1Id, user2Id].sort().join("_");

  const { data: existing } = await supabase
    .from("chats")
    .select("id")
    .eq("id", chatId)
    .single();

  if (!existing) {
    await supabase.from("chats").insert({
      id: chatId,
      participant_ids: [user1Id, user2Id],
    });

    await supabase.from("chat_participants").upsert([
      { chat_id: chatId, user_id: user1Id, unread_count: 0 },
      { chat_id: chatId, user_id: user2Id, unread_count: 0 },
    ]);
  }

  return chatId;
};

export const getUserChats = async (userId) => {
  if (!userId) return [];
  const { data, error } = await supabase
    .from("chats")
    .select("*")
    .contains("participant_ids", [userId])
    .order("last_message_at", { ascending: false });

  if (error) {
    console.error("getUserChats error:", error);
    return [];
  }
  return data || [];
};

export const listenToUserChats = (userId, callback) => {
  if (!userId) return () => {};

  getUserChats(userId).then(callback);

  const channel = supabase
    .channel(`user_chats:${userId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "chats" },
      () => {
        getUserChats(userId).then(callback);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};

export const getChatMessages = async (chatId, currentUserId, messagesLimit = 25) => {
  if (!chatId) return [];

  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("chat_id", chatId)
    .order("created_at", { ascending: false })
    .limit(messagesLimit);

  if (error) {
    console.error("getChatMessages error:", error);
    return [];
  }

  return (data || []).map(normalizeMessage).reverse();
};

export const listenToChatMessages = (chatId, currentUserId, callback, messagesLimit = 30) => {
  if (!chatId) return () => {};

  let messages = [];

  getChatMessages(chatId, currentUserId, messagesLimit).then((initial) => {
    messages = initial;
    callback(messages);
  });

  const channel = supabase
    .channel(`chat_messages:${chatId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `chat_id=eq.${chatId}`,
      },
      (payload) => {
        const newMsg = normalizeMessage(payload.new);
        if (!messages.some((m) => m.id === newMsg.id)) {
          messages = [...messages, newMsg];
          callback(messages);
        }
      }
    )
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "messages",
        filter: `chat_id=eq.${chatId}`,
      },
      (payload) => {
        const updatedMsg = normalizeMessage(payload.new);
        messages = messages.map((m) => (m.id === updatedMsg.id ? updatedMsg : m));
        callback(messages);
      }
    )
    .on(
      "postgres_changes",
      {
        event: "DELETE",
        schema: "public",
        table: "messages",
        filter: `chat_id=eq.${chatId}`,
      },
      (payload) => {
        messages = messages.filter((m) => m.id !== payload.old?.id);
        callback(messages);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};

export const loadOlderMessages = async (chatId, currentUserId, cursorTimestamp, pageSize = 15) => {
  try {
    const cursorIso =
      cursorTimestamp instanceof Date
        ? cursorTimestamp.toISOString()
        : new Date(cursorTimestamp).toISOString();

    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("chat_id", chatId)
      .lt("created_at", cursorIso)
      .order("created_at", { ascending: false })
      .limit(pageSize);

    if (error) throw error;

    const list = (data || []).map(normalizeMessage).reverse();
    return {
      messages: list,
      newCursor: list.length > 0 ? list[0].timestamp : cursorTimestamp,
      hasMore: (data || []).length === pageSize,
    };
  } catch (err) {
    console.error("loadOlderMessages error:", err);
    return { messages: [], newCursor: cursorTimestamp, hasMore: false };
  }
};

export const sendMessage = async (chatId, senderId, text, imageData = null) => {
  if (!chatId || !senderId) return null;

  const user = await getUserProfile(senderId);

  const newMsg = {
    chat_id: chatId,
    sender_id: senderId,
    sender_name: user?.displayName || user?.username || "Someone",
    sender_photo: user?.photoURL || "",
    text: text || "",
    type: imageData ? "image" : "text",
    image: imageData
      ? {
          publicId: imageData.public_id,
          url: imageData.secure_url,
          thumbnailUrl: imageData.secure_url?.replace(/upload\//, "upload/w_200,q_80/"),
          width: imageData.width,
          height: imageData.height,
        }
      : null,
    read: false,
    created_at: new Date().toISOString(),
  };

  const { data, error } = await supabase.from("messages").insert(newMsg).select("id").single();
  if (error) {
    console.error("sendMessage error:", error);
    throw error;
  }

  // Update chat last message
  await supabase
    .from("chats")
    .update({
      last_message: text || (imageData ? "📷 Image" : ""),
      last_message_at: new Date().toISOString(),
      last_message_id: data.id,
    })
    .eq("id", chatId);

  return data.id;
};

export const sendVoiceNote = async (chatId, senderId, voiceData) => {
  const user = await getUserProfile(senderId);

  const newMsg = {
    chat_id: chatId,
    sender_id: senderId,
    sender_name: user?.displayName || user?.username || "Someone",
    sender_photo: user?.photoURL || "",
    text: "🎤 Voice message",
    type: "voice",
    voice: voiceData,
    read: false,
    created_at: new Date().toISOString(),
  };

  const { data, error } = await supabase.from("messages").insert(newMsg).select("id").single();
  if (error) throw error;

  await supabase
    .from("chats")
    .update({
      last_message: "🎤 Voice message",
      last_message_at: new Date().toISOString(),
      last_message_id: data.id,
    })
    .eq("id", chatId);

  return data.id;
};

export const replyToMessage = async (chatId, originalMessageId, replyText, senderId, imageData = null) => {
  const user = await getUserProfile(senderId);

  // Fetch original message text
  const { data: orig } = await supabase
    .from("messages")
    .select("text, sender_name")
    .eq("id", originalMessageId)
    .single();

  const newMsg = {
    chat_id: chatId,
    sender_id: senderId,
    sender_name: user?.displayName || user?.username || "Someone",
    sender_photo: user?.photoURL || "",
    text: replyText || "",
    type: imageData ? "image" : "text",
    is_reply: true,
    reply_to_id: originalMessageId,
    original_message_text: orig?.text || "",
    read: false,
    created_at: new Date().toISOString(),
  };

  const { data, error } = await supabase.from("messages").insert(newMsg).select("id").single();
  if (error) throw error;
  return data.id;
};

export const editMessage = async (chatId, messageId, newText, userId) => {
  const { error } = await supabase
    .from("messages")
    .update({
      text: newText,
      is_edited: true,
    })
    .eq("id", messageId)
    .eq("sender_id", userId);

  if (error) throw error;
};

export const markMessagesAsRead = async (chatId, userId) => {
  if (!chatId || !userId) return;

  await supabase
    .from("messages")
    .update({ read: true, read_at: new Date().toISOString() })
    .eq("chat_id", chatId)
    .neq("sender_id", userId)
    .eq("read", false);

  await supabase
    .from("chat_participants")
    .update({ unread_count: 0 })
    .eq("chat_id", chatId)
    .eq("user_id", userId);
};

export const getUnreadCount = async (chatId, userId) => {
  const { count } = await supabase
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("chat_id", chatId)
    .neq("sender_id", userId)
    .eq("read", false);

  return count || 0;
};

export const listenToUnreadMessagesCount = (userId, callback) => {
  if (!userId) return () => {};

  const fetchUnread = async () => {
    const { count } = await supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .neq("sender_id", userId)
      .eq("read", false);

    callback(count || 0);
  };

  fetchUnread();

  const channel = supabase
    .channel(`unread_messages:${userId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "messages" },
      () => fetchUnread()
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};

export const saveMessage = async (chatId, messageId, userId) => {
  await supabase.from("saved_messages").upsert({
    chat_id: chatId,
    message_id: messageId,
    user_id: userId,
  });
  await supabase.from("messages").update({ is_saved: true }).eq("id", messageId);
};

export const unsaveMessage = async (chatId, messageId, userId) => {
  await supabase
    .from("saved_messages")
    .delete()
    .eq("message_id", messageId)
    .eq("user_id", userId);
  await supabase.from("messages").update({ is_saved: false }).eq("id", messageId);
};

export const listenToSavedMessages = (userId, chatId, callback) => {
  if (!userId || !chatId) return () => {};

  const fetchSaved = async () => {
    const { data } = await supabase
      .from("saved_messages")
      .select("message:messages(*)")
      .eq("user_id", userId)
      .eq("chat_id", chatId);

    callback((data || []).map((d) => normalizeMessage(d.message)));
  };

  fetchSaved();

  const channel = supabase
    .channel(`saved_messages:${userId}:${chatId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "saved_messages", filter: `chat_id=eq.${chatId}` },
      () => fetchSaved()
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};

export const deleteChat = async (chatId) => {
  await supabase.from("chats").delete().eq("id", chatId);
};

// -------------------------------------------------------------
// TYPING INDICATOR (Realtime Broadcast - zero DB writes)
// -------------------------------------------------------------
const typingChannels = new Map();

export const setTypingStatus = async (chatId, userId, isTyping) => {
  if (!chatId || !userId) return;

  let channel = typingChannels.get(chatId);
  if (!channel) {
    channel = supabase.channel(`typing:${chatId}`);
    channel.subscribe();
    typingChannels.set(chatId, channel);
  }

  await channel.send({
    type: "broadcast",
    event: "typing",
    payload: { userId, isTyping, timestamp: Date.now() },
  });
};

export const listenToTypingStatus = (chatId, currentUserId, callback) => {
  if (!chatId) return () => {};

  let timeoutId = null;

  const channel = supabase
    .channel(`typing:${chatId}`)
    .on("broadcast", { event: "typing" }, ({ payload }) => {
      if (payload && payload.userId !== currentUserId) {
        if (payload.isTyping) {
          callback(true);
          clearTimeout(timeoutId);
          timeoutId = setTimeout(() => callback(false), 3000);
        } else {
          clearTimeout(timeoutId);
          callback(false);
        }
      }
    })
    .subscribe();

  return () => {
    clearTimeout(timeoutId);
    supabase.removeChannel(channel);
  };
};

// -------------------------------------------------------------
// MUSIC PLAYER & QUEUE
// -------------------------------------------------------------
export const updateMusicState = async (chatId, musicState) => {
  if (!chatId) return;

  // 1. Broadcast over WebSocket for immediate sync across listening friends
  const channel = supabase.channel(`music:${chatId}`);
  channel.subscribe((status) => {
    if (status === "SUBSCRIBED") {
      channel.send({
        type: "broadcast",
        event: "sync",
        payload: { ...musicState, lastUpdated: Date.now() },
      });
    }
  });

  // 2. Persist in database for future sessions
  await supabase
    .from("chats")
    .update({ music_state: { ...musicState, lastUpdated: new Date().toISOString() } })
    .eq("id", chatId);
};

export const getMusicState = async (chatId) => {
  if (!chatId) return null;
  const { data } = await supabase
    .from("chats")
    .select("music_state")
    .eq("id", chatId)
    .single();

  return data?.music_state || null;
};

export const listenToMusicState = (chatId, callback) => {
  if (!chatId) return () => {};

  // Initial fetch
  getMusicState(chatId).then(callback);

  // Realtime Broadcast & DB listen
  const channel = supabase
    .channel(`music:${chatId}`)
    .on("broadcast", { event: "sync" }, ({ payload }) => {
      callback(payload);
    })
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "chats", filter: `id=eq.${chatId}` },
      (payload) => {
        if (payload.new?.music_state) {
          callback(payload.new.music_state);
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};

export const addToMusicQueue = async (chatId, videoData, addedBy) => {
  if (!chatId || !videoData) return;

  await supabase.from("music_queue").insert({
    chat_id: chatId,
    video_id: videoData.videoId,
    title: videoData.title,
    thumbnail: videoData.thumbnail || "",
    duration: videoData.duration || "",
    added_by: addedBy,
    played: false,
  });
};

export const getMusicQueue = async (chatId) => {
  if (!chatId) return [];
  const { data, error } = await supabase
    .from("music_queue")
    .select("*")
    .eq("chat_id", chatId)
    .order("created_at", { ascending: true });

  if (error) return [];
  return data || [];
};

export const listenToMusicQueue = (chatId, callback) => {
  if (!chatId) return () => {};

  getMusicQueue(chatId).then(callback);

  const channel = supabase
    .channel(`music_queue:${chatId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "music_queue", filter: `chat_id=eq.${chatId}` },
      () => {
        getMusicQueue(chatId).then(callback);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};

export const loadOlderMusicQueue = async (chatId, pageSize = 20) => {
  const items = await getMusicQueue(chatId);
  return {
    items,
    hasMore: false,
    nextCursor: null,
  };
};

export const migrateOldUnreadCounts = async () => {
  // No-op for Supabase
};

export const validateUsername = (username) => {
  if (!username || username.length < 3 || username.length > 16) {
    return { isValid: false, message: "Username must be between 3 and 16 characters" };
  }
  if (!/^[a-z0-9_.-]+$/.test(username)) {
    return { isValid: false, message: "Only lowercase letters, numbers, dots, and underscores allowed" };
  }
  return { isValid: true, message: "" };
};

export const getUsernameSuggestions = async (baseUsername) => {
  const clean = (baseUsername || "user").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 10);
  return [
    `${clean}${Math.floor(100 + Math.random() * 900)}`,
    `${clean}_${Math.floor(10 + Math.random() * 90)}`,
    `${clean}.${Math.floor(10 + Math.random() * 90)}`,
  ];
};

export const listenToUserProfile = (userId, callback) => {
  if (!userId) return () => {};
  getUserProfile(userId).then(callback);
  const channel = supabase
    .channel(`profile:${userId}`)
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${userId}` },
      (payload) => {
        callback(normalizeProfile(payload.new));
      }
    )
    .subscribe();
  return () => supabase.removeChannel(channel);
};

export const sendPushNotification = async () => {
  return null;
};

export const deleteUserAccount = async (userId) => {
  if (!userId) return;
  await supabase.from("profiles").delete().eq("id", userId);
  await supabase.auth.signOut();
};


