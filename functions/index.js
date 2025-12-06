// functions/index.js
const functions = require("firebase-functions/v1");
const admin = require("firebase-admin");

admin.initializeApp();

// 🔔 Trigger on new message documents
exports.onNewMessage = functions.firestore
  .document("chats/{chatId}/messages/{messageId}")
  .onCreate(async (snap, context) => {
    const message = snap.data();
    const chatId = context.params.chatId;

    const toId = message.toId;     // recipient
    const fromId = message.fromId; // sender
    const text = message.text || "";

    console.log("New message created:", { chatId, fromId, toId, text });

    if (!toId) {
      console.log("No toId on message, skipping notification");
      return null;
    }

    // 1. Get recipient user document
    const userRef = admin.firestore().collection("users").doc(toId);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      console.log("Recipient user doc not found, skipping");
      return null;
    }

    const userData = userSnap.data();
    const fcmToken = userData.fcmToken; // or userData.tokens if you store array

    if (!fcmToken) {
      console.log("No FCM token for user", toId);
      return null;
    }

    // 2. Build notification payload
    const payload = {
      notification: {
        title: message.fromName || "New message",
        body: text.substring(0, 80) || "You have a new message",
      },
      data: {
        type: "message",
        chatId: chatId,
        senderId: fromId || "",
      },
    };

    try {
      // 3. Send push notification
      const response = await admin.messaging().sendToDevice(fcmToken, payload);
      console.log("Notification sent:", response);
    } catch (err) {
      console.error("Error sending FCM notification:", err);
    }

    return null;
  });
