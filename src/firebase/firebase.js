import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore, enableIndexedDbPersistence } from "firebase/firestore";

// Your Firebase config from Firebase Console
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

// Enable offline persistence
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
