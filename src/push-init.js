// src/push-init.js
import { PushNotifications } from '@capacitor/push-notifications';
import { auth, db } from './firebase/firebase';
import { doc, setDoc } from 'firebase/firestore';

async function saveNativeTokenToFirestore(tokenValue) {
  try {
    const user = auth.currentUser;

    if (!user) {
      localStorage.setItem('pending_native_fcm', tokenValue);
      console.log('Saved pending FCM token (no user yet):', tokenValue);
      return;
    }

    const tokenRef = doc(db, 'users', user.uid, 'tokens', tokenValue);
    await setDoc(
      tokenRef,
      {
        token: tokenValue,
        platform: 'android',
        createdAt: new Date().toISOString(),
        active: true,
        lastActive: new Date().toISOString(),
      },
      { merge: true }
    );

    console.log('Native FCM token saved to Firestore for user:', user.uid);
  } catch (err) {
    console.error('Error saving native FCM token:', err);
  }
}

export async function initPush() {
  console.log('Initializing notification service...');

  try {
    const perm = await PushNotifications.requestPermissions();
    console.log('Push permission result:', perm);

    if (perm.receive !== 'granted') {
      console.warn('Push permission not granted; aborting registration.');
      return;
    }

    await PushNotifications.register();

    PushNotifications.addListener('registration', (token) => {
      console.log('%c [PUSH] Native Token Received: ' + token.value, 'color: green; font-weight: bold');

      const user = auth.currentUser;
      if (!user) {
        console.log('%c [PUSH] No authenticated user yet, storing token temporarily', 'color: orange; font-weight: bold');
        localStorage.setItem('pending_native_fcm', token.value);
        return;
      }

      console.log('%c [PUSH] User found, saving token directly to Firestore', 'color: lime; font-weight: bold');
      saveNativeTokenToFirestore(token.value);
    });

    PushNotifications.addListener('registrationError', (err) => {
      console.error('Push registration error:', err);
    });

    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      console.log('Push received while app in foreground:', notification);
    });

    PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      console.log('Push action performed:', action);
    });

    console.log('Notification service initialized successfully');
  } catch (e) {
    console.error('initPush unexpected error', e);
  }
}
