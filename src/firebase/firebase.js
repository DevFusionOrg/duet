import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore, enableIndexedDbPersistence } from "firebase/firestore";
import { getMessaging, getToken, onMessage } from "firebase/messaging";

const firebaseConfig = {
  apiKey: process.env.REACT_APP_API_KEY,
  authDomain: "vibechat-f87fe.firebaseapp.com",
  projectId: "vibechat-f87fe",
  storageBucket: "vibechat-f87fe.firebasestorage.app",
  messagingSenderId: "802645032363",
  appId: "1:802645032363:web:d15288ea6900cb1a5d66ee",
  measurementId: "G-XCLFMX66ZM",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();
const db = getFirestore(app);
export const messaging = getMessaging(app);

export const requestNotificationPermission = async () => {
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
  new Promise((resolve) => {
    onMessage(messaging, (payload) => {
      resolve(payload);
    });
  });

enableIndexedDbPersistence(db).catch((err) => {
  if (err.code === "failed-precondition") {
    console.log(
      "Multiple tabs open, persistence can only be enabled in one tab at a time.",
    );
  } else if (err.code === "unimplemented") {
    console.log("The current browser doesn't support persistence.");
  }
});

export { auth, googleProvider, db };
