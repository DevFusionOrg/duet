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

  // exports.migrateAllUsersFriends = functions
  // .region("us-central1")
  // .https.onRequest(async (req, res) => {
  //   try {
  //     const db = admin.firestore();

  //     console.log("Starting friends migration...");

  //     const usersSnap = await db.collection("users").get();

  //     for (const userDoc of usersSnap.docs) {
  //       const uid = userDoc.id;
  //       const userData = userDoc.data();

  //       if (!Array.isArray(userData.friends) || userData.friends.length === 0) {
  //         continue;
  //       }

  //       for (const friendId of userData.friends) {
  //         const friendSnap = await db.collection("users").doc(friendId).get();
  //         if (!friendSnap.exists) continue;

  //         const friendData = friendSnap.data();

  //         await db
  //           .collection("users")
  //           .doc(uid)
  //           .collection("friends")
  //           .doc(friendId)
  //           .set(
  //             {
  //               displayName: friendData.displayName || "User",
  //               photoURL: friendData.photoURL || null,
  //               lastSeen: friendData.lastSeen || null,
  //               online: friendData.online || false,
  //               addedAt: admin.firestore.FieldValue.serverTimestamp(),
  //             },
  //             { merge: true } // 🔒 SAFE & IDEMPOTENT
  //           );
  //       }
  //     }

  //     console.log("Friends migration completed");
  //     return res.status(200).send("Friends migration completed successfully");
  //   } catch (error) {
  //     console.error("Migration failed:", error);
  //     return res.status(500).send("Migration failed");
  //   }
  // });
