import { useState, useEffect } from "react";
import { notificationService } from "../services/notifications";
import { requestNotificationPermission, onMessageListener } from "../firebase/firebase";
import { saveUserNotificationToken } from "../firebase/firestore";

export function useNotifications(user, chatId) {
  const [notificationToken, setNotificationToken] = useState(null);
  const [hasNotificationPermission, setHasNotificationPermission] = useState(false);

  useEffect(() => {
    const initializeNotifications = async () => {
      if (Notification.permission === 'granted') {
        setHasNotificationPermission(true);
        const token = await requestNotificationPermission();
        setNotificationToken(token);
        if (token && user) {
          await saveUserNotificationToken(user.uid, token);
        }
      } else {
        const hasPermission = await notificationService.requestPermission();
        setHasNotificationPermission(hasPermission);
        if (hasPermission) {
          const token = await requestNotificationPermission();
          setNotificationToken(token);
          if (token && user) {
            await saveUserNotificationToken(user.uid, token);
          }
        }
      }
    };
    
    if (user?.uid) {
      initializeNotifications();
    }
  }, [user]);

  useEffect(() => {
    const setupForegroundMessages = async () => {
      const payload = await onMessageListener();
      if (payload) {
        const { title, body, data } = payload.notification || payload;
        
        const isFromCurrentChat = data?.chatId === chatId;
        const isAppInFocus = document.visibilityState === 'visible';
        
        if (!isFromCurrentChat && !isAppInFocus) {
          notificationService.showNotification(title || 'New Message', {
            body,
            data,
            icon: data?.senderPhoto || '/default-avatar.png',
            tag: `fcm-${Date.now()}`
          });
        }
      }
    };
    
    if (hasNotificationPermission) {
      setupForegroundMessages();
    }
  }, [hasNotificationPermission, chatId]);

  const showNewMessageNotification = (message, friend) => {
    if (!hasNotificationPermission || document.visibilityState === 'visible') return;
    
    const notificationTitle = friend.displayName;
    let notificationBody = '';
    
    if (message.type === 'image') {
      notificationBody = message.text ? `📷 ${message.text}` : '📷 Sent a photo';
    } else if (message.isReply && message.originalMessageText) {
      notificationBody = `↪️ Reply: ${message.text || 'Replied to a message'}`;
    } else {
      notificationBody = message.text || 'Sent a message';
    }
    
    if (notificationBody.length > 100) {
      notificationBody = notificationBody.substring(0, 97) + '...';
    }
    
    notificationService.showNotification(notificationTitle, {
      body: notificationBody,
      icon: friend.photoURL || '/default-avatar.png',
      badge: '/badge.png',
      data: {
        chatId,
        senderId: friend.uid,
        messageId: message.id,
        type: 'new-message'
      },
      vibrate: [200, 100, 200],
      tag: `chat-${chatId}-${message.id}`,
      renotify: true,
      requireInteraction: false,
      silent: false
    });
  };

  return { hasNotificationPermission, showNewMessageNotification };
}