class NotificationService {
  constructor() {
    this.isSupported = 'Notification' in window;
    this.permission = this.isSupported ? Notification.permission : 'denied';
  }

  async requestPermission() {
    if (!this.isSupported) {
      console.log('Notifications not supported');
      return false;
    }

    if (this.permission === 'default') {
      this.permission = await Notification.requestPermission();
    }

    return this.permission === 'granted';
  }

  showNotification(title, options = {}) {
    if (!this.isSupported || this.permission !== 'granted') {
      return;
    }

    const notificationOptions = {
      icon: '/favicon.ico',
      badge: '/badge.png',
      ...options
    };

    const notification = new Notification(title, notificationOptions);

    notification.onclick = () => {
      window.focus();
      notification.close();
      
      if (options.data && options.data.chatId) {
        window.dispatchEvent(new CustomEvent('notification-click', {
          detail: options.data
        }));
      }
    };

    setTimeout(() => notification.close(), 5000);

    return notification;
  }

  isPageVisible() {
    return !document.hidden;
  }

  showNotificationIfHidden(title, options = {}) {
    if (this.isPageVisible()) {
      return null;
    }
    return this.showNotification(title, options);
  }

  async clearChatNotifications(chatId) {
    try {
      if (!('serviceWorker' in navigator) || !chatId) {
        return;
      }

      const registration = await navigator.serviceWorker.getRegistration();
      if (!registration || !registration.getNotifications) {
        return;
      }

      const notifications = await registration.getNotifications({ tag: `chat-${chatId}` });
      notifications.forEach((notification) => notification.close());
    } catch (err) {
      console.error("[notifications] Failed to clear chat notifications", err);
    }
  }
}

export const notificationService = new NotificationService();