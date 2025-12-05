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
  
  const notificationTitle = payload.notification?.title || 'New Message';
  const notificationOptions = {
    body: payload.notification?.body,
    icon: payload.notification?.icon || '/icon-192x192.png',
    badge: '/badge.png',
    data: payload.data,
    tag: payload.data?.chatId ? `chat-${payload.data.chatId}` : 'chat-notification',
    requireInteraction: false,
    actions: [
      {
        action: 'open',
        title: 'Open Chat'
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
  
  const chatId = event.notification.data?.chatId;
  const senderId = event.notification.data?.senderId;
  
  if (event.action === 'open' || !event.action) {
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true })
        .then((clientList) => {
          for (const client of clientList) {
            if (client.url.includes('/chat') && 'focus' in client) {
              return client.focus();
            }
          }
          if (clients.openWindow) {
            return clients.openWindow(`/chat?chatId=${chatId}&senderId=${senderId}`);
          }
        })
    );
  }
});