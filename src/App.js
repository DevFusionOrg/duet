import React, { useEffect, useRef, useState } from "react";
import { auth } from "./firebase/firebase";
import { createUserProfile, setUserOnlineStatus } from "./firebase/firestore";
import Auth from "./pages/Auth";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Profile from "./pages/Profile";
import SecurityWarning from "./Components/SecurityWarning";
import "./App.css";
import { initPushNotifications } from "./push-init";

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  // eslint-disable-next-line no-unused-vars
  const [authError, _setAuthError] = useState(null);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const savedTheme = localStorage.getItem('theme');
    return savedTheme === 'dark';
  });

  const pushInitCalledRef = useRef(false);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  const toggleTheme = () => {
    setIsDarkMode(prev => !prev);
  };

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((currentUser) => {
      setUser(currentUser);
      setLoading(false);

      if (currentUser) {
        createUserProfile(currentUser).catch(console.error);
        setUserOnlineStatus(currentUser.uid, true).catch(console.error);
      }
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    // Preload Cloudinary widget globally when app starts
    if (!window.cloudinary) {
      const script = document.createElement("script");
      script.src = "https://upload-widget.cloudinary.com/global/all.js";
      script.type = "text/javascript";
      script.async = true;
      script.id = 'cloudinary-global-script';
      document.head.appendChild(script);
      console.log("Cloudinary script preloaded globally");
    }
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
    return (
      <>
        <SecurityWarning />
        <Auth />
      </>
    );
  }

  return (
    <>
      <SecurityWarning />
      <Router>
        <Routes>
          <Route path="/" element={<Home user={user} isDarkMode={isDarkMode} toggleTheme={toggleTheme} />} />
          <Route path="/profile" element={<Profile user={user} isDarkMode={isDarkMode} toggleTheme={toggleTheme} />} />
          <Route path="/profile/:uid" element={<Profile user={user} isDarkMode={isDarkMode} toggleTheme={toggleTheme} />} />
        </Routes>
      </Router>
    </>
  );
}

export default App;
