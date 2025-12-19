import React, { useEffect, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { SplashScreen } from "@capacitor/splash-screen";
import { auth } from "./firebase/firebase";
import { createUserProfile, setUserOnlineStatus } from "./firebase/firestore";
import Auth from "./pages/Auth";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Profile from "./pages/Profile";
import SecurityWarning from "./Components/SecurityWarning";
import UpdateChecker from "./Components/UpdateChecker";
import "./App.css";
import { initPushNotifications } from "./push-init";

if (Capacitor.isNativePlatform()) {
  SplashScreen.hide().catch(console.error);
}

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
    
    let lastTouchEnd = 0;
    const preventZoom = (e) => {
      const now = Date.now();
      if (now - lastTouchEnd <= 300) {
        e.preventDefault();
      }
      lastTouchEnd = now;
    };

    const preventPinchZoom = (e) => {
      if (e.touches.length > 1) {
        e.preventDefault();
      }
    };

    const preventKeyboardZoom = (e) => {
      if (
        (e.ctrlKey || e.metaKey) &&
        (e.key === '+' || e.key === '-' || e.key === '=' || e.key === '0')
      ) {
        e.preventDefault();
      }
    };

    const preventWheelZoom = (e) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
      }
    };

    document.addEventListener('touchend', preventZoom);
    document.addEventListener('touchmove', preventPinchZoom, { passive: false });
    document.addEventListener('keydown', preventKeyboardZoom);
    document.addEventListener('wheel', preventWheelZoom, { passive: false });

    return () => {
      document.removeEventListener('touchend', preventZoom);
      document.removeEventListener('touchmove', preventPinchZoom);
      document.removeEventListener('keydown', preventKeyboardZoom);
      document.removeEventListener('wheel', preventWheelZoom);
    };
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  const toggleTheme = () => {
    setIsDarkMode(prev => !prev);
  };

  useEffect(() => {
    const platform = (typeof Capacitor !== 'undefined' && Capacitor.getPlatform) ? Capacitor.getPlatform() : 'web';
    if (platform !== 'android') return;

    document.body.classList.add('no-text-select');

    const preventContext = (e) => {
      e.preventDefault();
    };
    const preventCopyCut = (e) => {
      e.preventDefault();
    };
    const preventSelectStart = (e) => {
      const el = e.target;
      const tag = (el?.tagName || '').toLowerCase();
      const isEditable = el?.isContentEditable;
      if (tag !== 'input' && tag !== 'textarea' && !isEditable) {
        e.preventDefault();
      }
    };

    document.addEventListener('contextmenu', preventContext);
    document.addEventListener('copy', preventCopyCut);
    document.addEventListener('cut', preventCopyCut);
    document.addEventListener('selectstart', preventSelectStart);

    return () => {
      document.body.classList.remove('no-text-select');
      document.removeEventListener('contextmenu', preventContext);
      document.removeEventListener('copy', preventCopyCut);
      document.removeEventListener('cut', preventCopyCut);
      document.removeEventListener('selectstart', preventSelectStart);
    };
  }, []);

  useEffect(() => {
    let removeListener;

    const setupBackButtonHandler = async () => {
      try {
        const platform = (typeof Capacitor !== 'undefined' && Capacitor.getPlatform) ? Capacitor.getPlatform() : 'web';
        if (platform !== 'android') return;

        const { App } = await import('@capacitor/app');
        const backHandler = App.addListener('backButton', ({ canGoBack }) => {
          if (window.history.length > 1 && canGoBack !== false) {
            window.history.back();
          }
          
        });

        removeListener = () => backHandler?.remove();
      } catch (error) {
        console.error('Error setting up back button handler:', error);
      }
    };

    setupBackButtonHandler();

    return () => {
      if (removeListener) removeListener();
    };
  }, []);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((currentUser) => {
      setUser(currentUser);
      setLoading(false);

      if (currentUser) {
        createUserProfile(currentUser).catch(console.error);
        setUserOnlineStatus(currentUser.uid, true).catch(console.error);
      }

      if (Capacitor.isNativePlatform()) {
        SplashScreen.hide().catch(console.error);
      }
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    
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
        
        await setUserOnlineStatus(user.uid, isOnline, !isOnline);
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
        
        setUserOnlineStatus(user.uid, false, true).catch((error) => {
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
        <div className="app-loading-footer">
          <div className="devfusion-logo">
            <img src="/DevFusion.png" alt="DevFusion" className="devfusion-logo-img" />
            <span className="devfusion-text">DevFusion</span>
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
        <UpdateChecker showButton={false} />
        <Auth />
      </>
    );
  }

  return (
    <>
      <SecurityWarning />
      <UpdateChecker showButton={false} />
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
