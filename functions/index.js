const functions = require("firebase-functions/v1");
const admin = require("firebase-admin");

admin.initializeApp();

const messaging = admin.messaging();
const db = admin.firestore();

async function sendDataMessageToTokens(tokens = [], data = {}) {
  if (!tokens.length) return null;
  const multicast = {
    tokens,
    data,
    android: {
      priority: "high",
    },
    apns: {
      headers: {
        "apns-priority": "10",
      },
    },
  };

  try {
    return await messaging.sendEachForMulticast(multicast);
  } catch (err) {
    console.error("Error sending data message", err);
    return null;
  }
}

exports.sendChatMessageNotification = functions
  .region("asia-south1")
  .firestore.document("chats/{chatId}/messages/{messageId}")
  .onCreate(async (snap, context) => {
    const message = snap.data();
    const chatId = context.params.chatId;

    if (message.isCallLog) {
      console.log("Skipping notification for call log");
      return null;
    }

    const senderId = message.senderId;
    const text = message.notificationText || message.text || "";

    console.log("New chat message:", { chatId, senderId, text });

    const chatRef = admin.firestore().collection("chats").doc(chatId);
    const chatDoc = await chatRef.get();
    if (!chatDoc.exists) {
      console.log("Chat doc not found");
      return null;
    }

    const data = chatDoc.data();
    const participants = data.participants || [];
    if (participants.length < 2) {
      console.log("Not enough participants");
      return null;
    }

    const receiverIds = participants.filter((id) => id !== senderId);

    let senderProfile;
    try {
      const senderSnap = await admin.firestore().collection("users").doc(senderId).get();
      senderProfile = senderSnap.exists ? senderSnap.data() : null;
    } catch (err) {
      console.error("Unable to load sender profile", err);
    }

    const senderName =
      message.senderName || senderProfile?.displayName || senderProfile?.username || "New message";
    const senderPhoto = message.senderPhoto || senderProfile?.photoURL || "";

    let body;
    if (message.isReply) {
      body = `${senderName} replied "${text}"`;
    } else if (message.type === "image") {
      body = `${senderName} sent a photo`;
    } else {
      body = text || "You have a new message";
    }

    const title = senderName;

    for (const receiverId of receiverIds) {
      console.log("Processing receiver:", receiverId);

      const receiverDoc = await admin.firestore().collection("users").doc(receiverId).get();
      if (receiverDoc.exists) {
        const receiverData = receiverDoc.data();
        const mutedChats = receiverData.mutedChats || [];
        if (mutedChats.includes(chatId)) {
          console.log("Chat is muted for receiver", receiverId);
          continue;
        }
      }

      const tokensSnap = await admin
        .firestore()
        .collection("users")
        .doc(receiverId)
        .collection("tokens")
        .get();

      if (tokensSnap.empty) {
        console.log("No tokens for receiver", receiverId);
        continue;
      }

      const tokens = tokensSnap.docs.map((doc) => doc.id);
      console.log("Sending notification to tokens:", tokens);

      const multicast = {
        tokens,
        notification: {
          title,
          body,
        },
        data: {
          type: "chat_message",
          chatId,
          senderId,
          senderName,
          senderPhoto,
          message: text,
          messageType: message.type || (message.image ? "image" : "text"),
          isReply: (message.isReply || false).toString(),
          originalMessageText: message.originalMessageText || "",
          timestamp: Date.now().toString(),
        },
        android: {
          priority: "high",
          notification: {
            channelId: "duet_default_channel",
            sound: "default",
            icon: "ic_stat_name",
          },
        },
      };

      try {
        const res = await messaging.sendEachForMulticast(multicast);
        console.log("Notification sent result:", JSON.stringify(res));
      } catch (err) {
        console.error("Error sending notification to", receiverId, err);
      }
    }

    return null;
  });

exports.clearChatNotificationsOnRead = functions
  .region("asia-south1")
  .firestore.document("chats/{chatId}/messages/{messageId}")
  .onUpdate(async (change, context) => {
    const beforeRead = change.before.get("read");
    const afterRead = change.after.get("read");
    if (beforeRead === true || afterRead !== true) {
      return null;
    }

    const chatId = context.params.chatId;
    const message = change.after.data();
    const senderId = message.senderId;

    const chatRef = admin.firestore().collection("chats").doc(chatId);
    const chatDoc = await chatRef.get();
    if (!chatDoc.exists) {
      console.log("clearChatNotificationsOnRead: chat not found", chatId);
      return null;
    }

    const participants = chatDoc.data().participants || [];
    const recipientId = participants.find((p) => p !== senderId);
    if (!recipientId) {
      console.log("clearChatNotificationsOnRead: recipient not found", { chatId, participants, senderId });
      return null;
    }

    const tokensSnap = await admin
      .firestore()
      .collection("users")
      .doc(recipientId)
      .collection("tokens")
      .get();

    if (tokensSnap.empty) {
      console.log("clearChatNotificationsOnRead: no tokens for recipient", recipientId);
      return null;
    }

    const tokens = tokensSnap.docs.map((doc) => doc.id);
    await sendDataMessageToTokens(tokens, {
      type: "message_read",
      chatId,
      messageId: context.params.messageId,
    });

    console.log("clearChatNotificationsOnRead: sent clear command", { chatId, recipientId, tokensCount: tokens.length });
    return null;
  });

exports.sendFriendRequestNotification = functions
  .region("asia-south1")
  .firestore.document("users/{userId}")
  .onUpdate(async (change, context) => {
    const beforeRequests = change.before.data().friendRequests || [];
    const afterRequests = change.after.data().friendRequests || [];

    const beforeKeys = new Set(
      beforeRequests.map((req) => `${req.from}_${req.status}_${req.timestamp?.toMillis?.() || req.timestamp}`)
    );

    const newRequests = afterRequests.filter((req) => {
      const key = `${req.from}_${req.status}_${req.timestamp?.toMillis?.() || req.timestamp}`;
      return req.status === "pending" && !beforeKeys.has(key);
    });

    if (!newRequests.length) {
      return null;
    }

    const userId = context.params.userId;

    for (const request of newRequests) {
      const fromUserId = request.from;

      let fromUser;
      try {
        const snap = await admin.firestore().collection("users").doc(fromUserId).get();
        fromUser = snap.exists ? snap.data() : null;
      } catch (err) {
        console.error("Unable to load requesting user", err);
      }

      const title = fromUser?.displayName || fromUser?.username || "New friend request";
      const body = "sent you a friend request";

      const tokensSnap = await admin
        .firestore()
        .collection("users")
        .doc(userId)
        .collection("tokens")
        .get();

      if (tokensSnap.empty) {
        console.log("No tokens for receiver", userId);
        continue;
      }

      const tokens = tokensSnap.docs.map((doc) => doc.id);

      const fromUserPhoto = fromUser?.photoURL || "";

      const multicast = {
        tokens,
        notification: {
          title,
          body,
        },
        data: {
          type: "friend_request",
          fromUserId,
          fromUserName: title,
          fromUserPhoto,
          timestamp: Date.now().toString(),
        },
        android: {
          priority: "high",
          notification: {
            channelId: "duet_default_channel",
            sound: "default",
            icon: "ic_stat_name",
          },
        },
      };

      try {
        const res = await messaging.sendEachForMulticast(multicast);
        console.log("Friend request notification sent:", JSON.stringify(res));
      } catch (err) {
        console.error("Error sending friend request notification", err);
      }
    }

    return null;
  });

function compareSemver(a = "0.0.0", b = "0.0.0") {
  const pa = String(a).split(".").map((n) => parseInt(n, 10) || 0);
  const pb = String(b).split(".").map((n) => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const na = pa[i] || 0;
    const nb = pb[i] || 0;
    if (na > nb) return 1;
    if (na < nb) return -1;
  }
  return 0;
}

exports.notifyAppUpdate = functions
  .region("asia-south1")
  .firestore.document("appConfig/latestRelease")
  .onWrite(async (change, context) => {
    const before = change.before.exists ? change.before.data() : {};
    const after = change.after.exists ? change.after.data() : {};

    const oldVersion = (before.version || "0.0.0").toString();
    const newVersion = (after.version || "").toString();
    const apkUrl = after.apkUrl || "";
    const notes = after.notes || "";

    if (!newVersion) {
      console.log("notifyAppUpdate: No version in latestRelease, skipping");
      return null;
    }

    if (compareSemver(oldVersion, newVersion) >= 0) {
      console.log("notifyAppUpdate: Version not increased", { oldVersion, newVersion });
      return null;
    }

    console.log("notifyAppUpdate: Broadcasting app update", { newVersion, apkUrl });

    const db = admin.firestore();
    const usersSnap = await db.collection("users").get();

    const allTokens = [];
    for (const userDoc of usersSnap.docs) {
      try {
        const tokensSnap = await db
          .collection("users")
          .doc(userDoc.id)
          .collection("tokens")
          .get();
        if (!tokensSnap.empty) {
          for (const t of tokensSnap.docs) {
            const token = t.id;
            if (token) allTokens.push(token);
          }
        }
      } catch (err) {
        console.warn("notifyAppUpdate: Failed reading tokens for user", userDoc.id, err);
      }
    }

    if (!allTokens.length) {
      console.log("notifyAppUpdate: No device tokens found, aborting push");
      return null;
    }

    const chunkSize = 500;
    const chunks = [];
    for (let i = 0; i < allTokens.length; i += chunkSize) {
      chunks.push(allTokens.slice(i, i + chunkSize));
    }

    const sendPromises = chunks.map((tokens) => {
      const payload = {
        tokens,
        notification: {
          title: `Update available ${newVersion}`,
          body: notes || "Tap to download and install.",
        },
        data: {
          type: "app_update",
          version: newVersion,
          url: apkUrl,
          timestamp: Date.now().toString(),
        },
        android: {
          priority: "high",
          notification: {
            channelId: "duet_default_channel",
            sound: "default",
            icon: "ic_stat_name",
          },
        },
      };

      return messaging.sendEachForMulticast(payload)
        .then((res) => {
          console.log(
            `notifyAppUpdate: Sent to ${tokens.length} tokens, success=${res.successCount}, failure=${res.failureCount}`
          );
          return res;
        })
        .catch((err) => {
          console.error("notifyAppUpdate: Error sending multicast", err);
          return null;
        });
    });

    await Promise.all(sendPromises);

    console.log("notifyAppUpdate: Broadcast complete");
    return null;
  });

// Scheduled cleanup of expired, unsaved messages to remove client-side deletion writes
exports.cleanupExpiredMessages = functions
  .region("asia-south1")
  .pubsub.schedule("every 15 minutes")
  .onRun(async () => {
    const now = admin.firestore.Timestamp.now();
    const batchSize = 500;
    let deleted = 0;

    try {
      const query = db
        .collectionGroup("messages")
        .where("deletionTime", "<=", now)
        .where("isSaved", "==", false)
        .limit(batchSize);

      let snap = await query.get();
      while (!snap.empty) {
        const batch = db.batch();
        snap.docs.forEach((doc) => {
          const data = doc.data() || {};
          const img = data.image || null;
          if (img?.publicId) {
            const logRef = db.collection("deletionLogs").doc(`${data.chatId || doc.ref.parent.parent.id}_${doc.id}`);
            batch.set(logRef, {
              chatId: data.chatId || doc.ref.parent.parent.id,
              messageId: doc.id,
              publicId: img.publicId,
              deletedAt: admin.firestore.Timestamp.now(),
              scheduledForDeletion: admin.firestore.Timestamp.fromMillis(Date.now() + 12 * 60 * 60 * 1000),
            });
          }
          batch.delete(doc.ref);
        });
        await batch.commit();
        deleted += snap.size;
        snap = await query.get();
      }

      console.log(`cleanupExpiredMessages: Deleted ${deleted} expired messages`);
    } catch (err) {
      console.error("cleanupExpiredMessages: Error during cleanup", err);
    }
    return null;
  });

exports.searchSong = functions
  .region("asia-south1")
  .https.onRequest(async (req, res) => {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");

    if (req.method === "OPTIONS") {
      res.status(204).send("");
      return;
    }

    if (req.method !== "GET") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    const query = (req.query.q || "").toString().trim();
    if (!query) {
      res.status(400).json({ error: "Missing query parameter q" });
      return;
    }

    const normalize = (video) => {
      if (!video) return null;
      const videoId =
        video?.id?.videoId ||
        video?.videoId ||
        video?.id ||
        null;
      const title = video?.snippet?.title || video?.title || null;
      if (!videoId || !title) return null;
      return { videoId, title };
    };

    const fetchJson = async (url, options = {}) => {
      try {
        const response = await fetch(url, options);
        if (!response.ok) return null;
        return await response.json();
      } catch {
        return null;
      }
    };

    const searchYouTubeHtml = async (q) => {
      try {
        const response = await fetch(
          `https://www.youtube.com/results?search_query=${encodeURIComponent(q + " official audio")}`,
          {
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
              "Accept-Language": "en-US,en;q=0.9",
            },
          }
        );

        if (!response.ok) return null;
        const html = await response.text();

        const idMatch = html.match(/"videoId":"([a-zA-Z0-9_-]{11})"/);
        if (!idMatch) return null;

        const titleRegex = new RegExp(`"videoId":"${idMatch[1]}"[\\s\\S]{0,500}?"title":\\{\\"runs\\":\\[\\{\\"text\\":\\"([^\\"]+)\\"`, "m");
        const titleMatch = html.match(titleRegex);

        return {
          videoId: idMatch[1],
          title: titleMatch?.[1] || q,
        };
      } catch {
        return null;
      }
    };

    try {
      const youtubeApiKey = process.env.YOUTUBE_API_KEY || process.env.REACT_APP_YOUTUBE_API_KEY || "";

      if (youtubeApiKey) {
        const youtubeData = await fetchJson(
          `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=1&q=${encodeURIComponent(query + " official audio")}&key=${youtubeApiKey}`
        );
        if (youtubeData?.items?.length) {
          const normalized = normalize(youtubeData.items[0]);
          if (normalized) {
            res.status(200).json(normalized);
            return;
          }
        }
      }

      const lemnosData = await fetchJson(
        `https://yt.lemnoslife.com/noKey/search?part=snippet&type=video&maxResults=1&q=${encodeURIComponent(query + " official audio")}`
      );
      if (lemnosData?.items?.length) {
        const normalized = normalize(lemnosData.items[0]);
        if (normalized) {
          res.status(200).json(normalized);
          return;
        }
      }

      const invidiousData = await fetchJson(
        `https://invidious.nerdvpn.de/api/v1/search?q=${encodeURIComponent(query + " official audio")}&type=video`
      );
      if (Array.isArray(invidiousData) && invidiousData.length > 0) {
        const first = invidiousData[0];
        const normalized = normalize({ videoId: first?.videoId, title: first?.title });
        if (normalized) {
          res.status(200).json(normalized);
          return;
        }
      }

      const htmlResult = await searchYouTubeHtml(query);
      if (htmlResult) {
        res.status(200).json(htmlResult);
        return;
      }

      res.status(404).json({ error: "No results found from providers" });
    } catch (error) {
      console.error("searchSong error:", error);
      res.status(500).json({ error: "Search failed" });
    }
  });
