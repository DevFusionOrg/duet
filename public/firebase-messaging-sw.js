importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: process.env.REACT_APP_API_KEY,
  authDomain: "vibechat-f87fe.firebaseapp.com",
  projectId: "vibechat-f87fe",
  storageBucket: "vibechat-f87fe.firebasestorage.app",
  messagingSenderId: "802645032363",
  appId: "1:802645032363:web:d15288ea6900cb1a5d66ee",
  measurementId: "G-XCLFMX66ZM",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message:', payload);
  const data = payload.data || {};
  const type = data.type || 'chat_message';

  // If this is a read receipt, close existing chat notifications and skip showing a new one
  if (type === 'message_read') {
    const chatId = data.chatId;
    if (chatId && self.registration?.getNotifications) {
      self.registration.getNotifications().then((notifications) => {
        notifications.forEach((n) => {
          const tag = n.tag || '';
          if (tag === `chat-${chatId}` || tag.startsWith(`chat-${chatId}-`)) {
            n.close();
          }
        });
      });
    }
    return;
  }

  let notificationTitle = data.senderName || payload.notification?.title || 'New Message';
  let notificationBody = payload.notification?.body || data.message || 'You have a new message';
  let tag = 'chat-notification';
  let targetUrl = '/';

  if (type === 'friend_request') {
    notificationTitle = data.fromUserName || 'New friend request';
    notificationBody = `${notificationTitle} sent you a friend request`;
    tag = data.fromUserId ? `friend-request-${data.fromUserId}` : 'friend-request';
    targetUrl = '/?view=notifications';
  } else {
    if (data.messageType === 'image') {
      notificationBody = `${notificationTitle} sent a photo`;
    }
    tag = data.chatId ? `chat-${data.chatId}` : 'chat-notification';
    targetUrl = data.chatId
      ? `/?chatId=${data.chatId}&senderId=${data.senderId || ''}`
      : '/';
  }

  const notificationOptions = {
    body: notificationBody,
    icon: payload.notification?.icon || data.senderPhoto || '/icon-192x192.png',
    badge: '/badge.png',
    data: { ...data, targetUrl },
    tag,
    requireInteraction: false,
    actions: [
      {
        action: 'open',
        title: 'Open'
      },
      {
        action: 'dismiss',
        title: 'Dismiss'
      }
    ]
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.targetUrl || '/';
  const tag = event.notification.tag;

  event.waitUntil((async () => {
    try {
      if (tag) {
        const existing = await self.registration.getNotifications({ tag });
        existing.forEach((n) => n.close());
      }

      const clientList = await clients.matchAll({ type: 'window', includeUncontrolled: true });

      for (const client of clientList) {
        if ('focus' in client) {
          await client.focus();
        }

        if (client.url.includes(targetUrl) || targetUrl === '/') {
          return;
        }

        if (client.navigate) {
          return client.navigate(targetUrl);
        }

        if (client.postMessage) {
          client.postMessage({ type: 'notification-click', data: event.notification.data });
        }
      }

      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    } catch (err) {
      console.error('[firebase-messaging-sw.js] notification click error', err);
    }
  })());
});