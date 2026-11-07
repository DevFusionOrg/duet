import { useState, useEffect } from "react";
import { notificationService } from "../services/notifications";

export function useNotifications(user, chatId) {
  const [hasNotificationPermission, setHasNotificationPermission] = useState(false);

  useEffect(() => {
    const initializeNotifications = async () => {
      if (typeof Notification === "undefined") return;

      if (Notification.permission === "granted") {
        setHasNotificationPermission(true);
      } else if (Notification.permission !== "denied") {
        const hasPermission = await notificationService.requestPermission();
        setHasNotificationPermission(hasPermission);
      }
    };

    if (user?.uid) {
      initializeNotifications();
    }
  }, [user]);

  const showNewMessageNotification = (message, friend) => {
    if (!hasNotificationPermission || document.visibilityState === "visible") return;

    const notificationTitle = friend?.displayName || "New Message";
    let notificationBody = "";

    if (message.type === "image") {
      notificationBody = message.text ? `📷 ${message.text}` : "📷 Sent a photo";
    } else if (message.isReply && message.originalMessageText) {
      notificationBody = `↪️ Reply: ${message.text || "Replied to a message"}`;
    } else {
      notificationBody = message.text || "Sent a message";
    }

    if (notificationBody.length > 100) {
      notificationBody = notificationBody.substring(0, 97) + "...";
    }

    notificationService.showNotification(notificationTitle, {
      body: notificationBody,
      icon: friend?.photoURL || "/default-avatar.png",
      badge: "/badge.png",
      data: {
        chatId,
        senderId: friend?.uid,
        messageId: message.id,
        type: "new-message",
      },
      vibrate: [200, 100, 200],
      tag: `chat-${chatId}-${message.id}`,
      renotify: true,
      requireInteraction: false,
      silent: false,
    });
  };

  return { hasNotificationPermission, showNewMessageNotification };
}

export default useNotifications;
