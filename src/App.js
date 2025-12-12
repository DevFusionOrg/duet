import React, { useEffect, useRef, useState } from "react";
import { auth } from "./firebase/firebase";
import { createUserProfile, setUserOnlineStatus } from "./firebase/firestore";
import Auth from "./pages/Auth";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Profile from "./pages/Profile";
import "./App.css";
import { initPushNotifications } from "./push-init";
import ChatWrapper from './pages/ChatWrapper';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  const pushInitCalledRef = useRef(false);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (currentUser) => {
      try {
        if (currentUser) {
          await createUserProfile(currentUser);
          setAuthError(null);
          await setUserOnlineStatus(currentUser.uid, true);
        }

        setUser(currentUser);
      } catch (error) {
        console.error("Error in auth state change:", error);
        setAuthError(error.message);
      } finally {
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user) return;

    const updateOnlineStatus = async (isOnline) => {
      try {
        await setUserOnlineStatus(user.uid, isOnline);
      } catch (error) {
        console.error("Error updating online status:", error);
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        updateOnlineStatus(false);
      } else {
        updateOnlineStatus(true);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);

      if (user) {
        setUserOnlineStatus(user.uid, false).catch((error) => {
          console.error("Error setting offline status on cleanup:", error);
        });
      }
    };
  }, [user]);

  useEffect(() => {
    if (!user) return;
    if (pushInitCalledRef.current) return;

    pushInitCalledRef.current = true;

    initPushNotifications();

    if ("serviceWorker" in navigator && !window.Capacitor) {
      navigator.serviceWorker
        .register("/firebase-messaging-sw.js")
        .then((registration) => {
          console.log("Service Worker registered with scope:", registration.scope);
        })
        .catch((error) => {
          console.error("Service Worker registration failed:", error);
        });
    }
  }, [user]);

  if (loading) {
    return (
      <div className="app-loading">
        <div className="app-loading-content">
          <div className="animated-logo">
            <img src="/logo1921.png" alt="Duet Logo" className="logo-image" />
          </div>
          <div className="loading-dots">
            <span></span>
            <span></span>
            <span></span>
          </div>
        </div>
      </div>
    );
  }

  if (authError) {
    return (
      <div className="app-error">
        <h2>Authentication Error</h2>
        <p className="app-error-message">{authError}</p>
        <p>Please check your Firestore security rules and refresh the page.</p>
        <button
          onClick={() => window.location.reload()}
          className="app-error-button"
        >
          Refresh Page
        </button>
      </div>
    );
  }

  if (!user) {
    return <Auth />;
  }

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home user={user} />} />
        <Route path="/chat/:uid" element={<ChatWrapper user={user} />} />
        <Route path="/profile" element={<Profile user={user} />} />
        <Route path="/profile/:uid" element={<Profile user={user} />} />
      </Routes>
    </Router>
  );
}

export default App;
