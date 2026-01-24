import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { initializeFirestore, memoryLocalCache } from "firebase/firestore";
import { getDatabase } from "firebase/database";
import { getMessaging, getToken, onMessage } from "firebase/messaging";

const firebaseConfig = {
  apiKey: "AIzaSyAdW-9Tt4XZpmubm0YGtbcrRRxFt7A9S0w",
  authDomain: "duet-2025.firebaseapp.com",
  databaseURL: "https://duet-2025-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "duet-2025",
  storageBucket: "duet-2025.firebasestorage.app",
  messagingSenderId: "59902469466",
  appId: "1:59902469466:web:8efef080265aa491e9ff63",
  measurementId: "G-LK70XFJBW2"
};

if (!firebaseConfig.apiKey) {
  console.error("Firebase API key is missing! Check your .env file.");
}

const isMessagingSupported = () => {
  return typeof window !== 'undefined' && 
         'Notification' in window && 
         'serviceWorker' in navigator && 
         'PushManager' in window &&
         !window.cordova && 
         !window.Capacitor; 
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();
const db = initializeFirestore(app, {
  localCache: memoryLocalCache()
});
const database = getDatabase(app); 

let messaging = null;
try {
  if (isMessagingSupported()) {
    messaging = getMessaging(app);
  }
} catch (error) {
  console.warn("Firebase Messaging could not be initialized:", error);
  messaging = null;
}
export { messaging };

export const requestNotificationPermission = async () => {
  
  if (!messaging) {
    console.log("Messaging is not supported in this environment.");
    return null;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      console.log("Notification permission granted.");
      
      const token = await getToken(messaging, {
        vapidKey: "YOUR_VAPID_KEY",
      });
      
      if (token) {
        console.log("FCM Token:", token);
        return token;
      } else {
        console.log('No registration token available.');
      }
    } else {
      console.log("Unable to get permission to notify.");
    }
  } catch (error) {
    console.error("Error getting notification permission:", error);
  }
};

export const onMessageListener = () =>
  new Promise((resolve, reject) => {
    
    if (!messaging) {
      reject(new Error("Messaging is not supported in this environment."));
      return;
    }

    onMessage(messaging, (payload) => {
      resolve(payload);
    });
  });

export { auth, googleProvider, db, database };