// IMPORTANT: Capacitor WebView CANNOT load external importScripts.
// So we inline the minimal Firebase Messaging logic manually.

self.addEventListener("push", function (event) {
  if (!event.data) return;

  const payload = event.data.json();
  console.log("[SW] PUSH RECEIVED:", payload);

  const data = payload.data || {};
  const title = data.title || "New Notification";
  const body = data.body || "You have a new message";

  const options = {
    body,
    icon: data.senderPhoto || "/logo1921.png",
    badge: "/logo1921.png",
    data,
    vibrate:
      data.type === "call_notification"
        ? [300, 200, 300, 200, 300]
        : [200, 100, 200],
    requireInteraction: data.type === "call_notification", // keeps ringing
  };

  event.waitUntil(self.registration.showNotification(title, options));

  // Also forward to UI
  self.clients.matchAll().then((clients) => {
    clients.forEach((client) =>
      client.postMessage({
        type: "FIREBASE_MESSAGE",
        payload,
      })
    );
  });
});

// CLICK HANDLER
self.addEventListener("notificationclick", (event) => {
  const data = event.notification.data;
  event.notification.close();

  console.log("[SW] Notification clicked:", data);

  if (!data) return;

  // CALL NOTIFICATION
  if (data.type === "call_notification") {
    event.waitUntil(
      self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientsList) => {
        if (clientsList.length > 0) {
          clientsList[0].focus();
          clientsList[0].postMessage({
            type: "INCOMING_CALL",
            data,
          });
        } else {
          self.clients.openWindow("/");
        }
      })
    );
    return;
  }

  // CHAT MESSAGE
  if (data.chatId) {
    event.waitUntil(self.clients.openWindow(`/chat/${data.chatId}`));
    return;
  }

  // DEFAULT → Open app
  event.waitUntil(self.clients.openWindow("/"));
});
