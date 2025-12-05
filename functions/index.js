const functions = require("firebase-functions/v1");
const admin = require("firebase-admin");

admin.initializeApp();

// small helper
const messaging = admin.messaging();

// ✅ CHAT NOTIFICATION
exports.sendChatMessageNotification = functions
  .region("us-central1")
  .firestore.document("chats/{chatId}/messages/{messageId}")
  .onCreate(async (snap, context) => {
    const message = snap.data();
    const chatId = context.params.chatId;

    const senderId = message.senderId;
    const text = message.text || "";

    // Get chat
    const chatRef = admin.firestore().collection("chats").doc(chatId);
    const chatDoc = await chatRef.get();
    if (!chatDoc.exists) return;

    const data = chatDoc.data();
    const participants = data.participants || [];
    if (participants.length < 2) return;

    const receiverIds = participants.filter((id) => id !== senderId);

    const title = message.senderName || "New message";
    const body = text || "You have a new message";

    for (const receiverId of receiverIds) {
      const tokensSnap = await admin
        .firestore()
        .collection("users")
        .doc(receiverId)
        .collection("tokens")
        .get();

      if (tokensSnap.empty) continue;

      const tokens = tokensSnap.docs.map((doc) => doc.id);

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
          senderName: message.senderName || "",
          senderPhoto: message.senderPhoto || "",
          message: text,
          timestamp: Date.now().toString(),
        },
        android: {
          priority: "high",
          notification: {
            channelId: "duet_default_channel",
            sound: "default",
          },
        },
      };

      await messaging.sendEachForMulticast(multicast);
    }
  });

// ✅ CALL NOTIFICATION
exports.sendIncomingCall = functions
  .region("us-central1")
  .https.onCall(async (data, context) => {
    const receiverId = data.receiverId;

    const tokensSnap = await admin
      .firestore()
      .collection("users")
      .doc(receiverId)
      .collection("tokens")
      .get();

    if (tokensSnap.empty) {
      return { success: false, message: "No tokens" };
    }

    const tokens = tokensSnap.docs.map((doc) => doc.id);

    const title = `Incoming ${data.callType || "audio"} call`;
    const body = data.callerName
      ? `${data.callerName} is calling you`
      : "You have an incoming call";

    const multicast = {
      tokens,
      notification: {
        title,
        body,
      },
      data: {
        type: "call_notification",
        callId: data.callId,
        callerId: data.callerId,
        callerName: data.callerName || "Caller",
        callerPhoto: data.callerPhoto || "",
        callType: data.callType || "audio",
        roomId: data.roomId || "",
        timestamp: Date.now().toString(),
      },
      android: {
        priority: "high",
        notification: {
          channelId: "duet_default_channel",
          sound: "default",
        },
      },
    };

    await messaging.sendEachForMulticast(multicast);

    return { success: true };
  });
