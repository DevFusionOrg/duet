import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';

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
      
      if (options.data && options.data.url) {
        try { window.open(options.data.url, '_blank'); } catch (e) {}
      } else if (options.data && options.data.chatId) {
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

      const notifications = await registration.getNotifications();
      notifications.forEach((notification) => {
        const tag = notification.tag || '';
        if (tag === `chat-${chatId}` || tag.startsWith(`chat-${chatId}-`)) {
          notification.close();
        }
      });
    } catch (err) {
      console.error("[notifications] Failed to clear chat notifications", err);
    }
  }

  async clearAllNotifications(chatId) {
    
    await this.clearChatNotifications(chatId);

    try {
      const platform = (typeof Capacitor !== 'undefined' && Capacitor.getPlatform) ? Capacitor.getPlatform() : 'web';
      if (platform === 'android' || platform === 'ios') {
        await PushNotifications.removeAllDeliveredNotifications();
      }
    } catch (err) {
      console.warn('[notifications] Failed to clear native notifications', err);
    }
  }
}

export const notificationService = new NotificationService();