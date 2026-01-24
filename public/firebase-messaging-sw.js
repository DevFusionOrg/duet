importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyAdW-9Tt4XZpmubm0YGtbcrRRxFt7A9S0w",
  authDomain: "duet-2025.firebaseapp.com",
  projectId: "duet-2025",
  storageBucket: "duet-2025.firebasestorage.app",
  messagingSenderId: "59902469466",
  appId: "1:59902469466:web:8efef080265aa491e9ff63",
  measurementId: "G-LK70XFJBW2"
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