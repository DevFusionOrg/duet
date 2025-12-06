// src/push-init.js
import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { db, auth } from "./firebase/firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";

async function saveTokenToFirestore(token) {
  const user = auth.currentUser;
  if (!user) {
    console.log("[push-init] No user logged in yet, skipping token save");
    return;
  }

  const uid = user.uid;

  try {
    // 1) Optional: keep a top-level fcmToken field if you want
    const userRef = doc(db, "users", uid);
    await setDoc(
      userRef,
      {
        fcmToken: token,
      },
      { merge: true }
    );

    // 2) IMPORTANT: match your old structure - tokens subcollection
    // Doc ID is the token itself, just like the old working setup
    const tokenRef = doc(db, "users", uid, "tokens", token);
    await setDoc(
      tokenRef,
      {
        token,
        platform: Capacitor.getPlatform(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    console.log("[push-init] Token saved to Firestore for user:", uid);
  } catch (err) {
    console.error("[push-init] Error saving token to Firestore:", err);
  }
}

export async function initPushNotifications() {
  const platform = Capacitor.getPlatform();
  if (platform !== "android" && platform !== "ios") {
    console.log("[push-init] Not running on a native platform, skipping push init");
    return;
  }

  console.log("[push-init] Initializing push notifications…");

  let permStatus = await PushNotifications.checkPermissions();

  if (permStatus.receive === "prompt") {
    permStatus = await PushNotifications.requestPermissions();
  }

  if (permStatus.receive !== "granted") {
    console.warn("[push-init] Push permission not granted:", permStatus);
    return;
  }

  await PushNotifications.register();

  PushNotifications.addListener("registration", async (token) => {
    console.log("[push-init] Registration token:", token.value);

    try {
      await saveTokenToFirestore(token.value);
    } catch (err) {
      console.error("[push-init] Error saving token to Firestore:", err);
    }
  });

  PushNotifications.addListener("registrationError", (error) => {
    console.error("[push-init] Registration error:", JSON.stringify(error));
  });

  PushNotifications.addListener("pushNotificationReceived", (notification) => {
    console.log("[push-init] Notification received in foreground:", notification);
  });

  PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
    console.log("[push-init] Notification action performed:", action);

    const data = action.notification?.data || {};
    const chatId = data.chatId;
    if (chatId) {
      console.log("[push-init] Should navigate to chat:", chatId);
    }
  });

  console.log("[push-init] Push notifications setup complete");
}
