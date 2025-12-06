// functions/index.js
const functions = require("firebase-functions/v1");
const admin = require("firebase-admin");

admin.initializeApp();

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

    console.log("New chat message:", { chatId, senderId, text });

    // Get chat
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

    // All other participants except sender
    const receiverIds = participants.filter((id) => id !== senderId);

    const title = message.senderName || "New message";
    const body = text || "You have a new message";

    for (const receiverId of receiverIds) {
      console.log("Processing receiver:", receiverId);

      // 🔑 Read tokens subcollection - doc ID is the token
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

      try {
        const res = await messaging.sendEachForMulticast(multicast);
        console.log("Notification sent result:", JSON.stringify(res));
      } catch (err) {
        console.error("Error sending notification to", receiverId, err);
      }
    }

    return null;
  });
