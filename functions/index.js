const functions = require("firebase-functions/v1");
const admin = require("firebase-admin");

admin.initializeApp();

const messaging = admin.messaging();

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
