// src/push-init.js
import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { db, auth } from "./firebase/firebase";
import { doc, setDoc } from "firebase/firestore";

/**
 * Save the FCM token to Firestore under the current user.
 * Assumes you have a "users" collection with userId == auth uid.
 */
async function saveTokenToFirestore(token) {
  const user = auth.currentUser;
  if (!user) {
    console.log("[push-init] No user logged in yet, skipping token save");
    return;
  }

  const userRef = doc(db, "users", user.uid);

  // Merge so we don’t overwrite other user fields
  await setDoc(
    userRef,
    {
      fcmToken: token,
      // if you want multiple devices per user, use: tokens: arrayUnion(token)
    },
    { merge: true }
  );

  console.log("[push-init] Token saved to Firestore for user:", user.uid);
}

/**
 * Initialize push notifications for Capacitor (Android/iOS only).
 */
export async function initPushNotifications() {
  const platform = Capacitor.getPlatform();
  if (platform !== "android" && platform !== "ios") {
    console.log("[push-init] Not running on a native platform, skipping push init");
    return;
  }

  console.log("[push-init] Initializing push notifications…");

  // 1. Request permission
  let permStatus = await PushNotifications.checkPermissions();

  if (permStatus.receive === "prompt") {
    permStatus = await PushNotifications.requestPermissions();
  }

  if (permStatus.receive !== "granted") {
    console.warn("[push-init] Push permission not granted:", permStatus);
    return;
  }

  // 2. Register with FCM
  await PushNotifications.register();

  // 3. Listen for registration success => get token
  PushNotifications.addListener("registration", async (token) => {
    console.log("[push-init] Registration token:", token.value);

    try {
      await saveTokenToFirestore(token.value);
    } catch (err) {
      console.error("[push-init] Error saving token to Firestore:", err);
    }
  });

  // 4. Listen for registration errors
  PushNotifications.addListener("registrationError", (error) => {
    console.error("[push-init] Registration error:", JSON.stringify(error));
  });

  // 5. Foreground notification received
  PushNotifications.addListener("pushNotificationReceived", (notification) => {
    console.log("[push-init] Notification received in foreground:", notification);
    // You can show a custom in-app toast/snackbar here if you like
  });

  // 6. When the user taps a notification
  PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
    console.log("[push-init] Notification action performed:", action);

    // Example: read data to open a chat
    const data = action.notification?.data || {};
    const chatId = data.chatId;
    if (chatId) {
      // TODO: navigate to your chat route, e.g. /chat/:chatId
      // You’ll handle this with your router (React Router / etc.)
      console.log("[push-init] Should navigate to chat:", chatId);
    }
  });

  console.log("[push-init] Push notifications setup complete");
}
