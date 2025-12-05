import React, { useEffect, useState } from "react";
import { auth, db } from "./firebase/firebase"; // ⬅️ db added
import { doc, setDoc } from "firebase/firestore"; // ⬅️ for saving token
import { createUserProfile, setUserOnlineStatus } from "./firebase/firestore";
import Auth from "./pages/Auth";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Profile from "./pages/Profile";
import Chat from "./pages/Chat";
import IncomingCallModal from "./Components/Call/IncomingCallModal";
import { notificationService } from "./services/notificationService";
import { initPush } from "./push-init"; // <-- native push init
import "./App.css";

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [incomingCall, setIncomingCall] = useState(null);
  const [isIncomingCallVisible, setIsIncomingCallVisible] = useState(false);

  // Initialize push notifications (native Capacitor)
  useEffect(() => {
    try {
      initPush();
    } catch (e) {
      console.error("initPush failed:", e);
    }
  }, []);

  // Native FCM → JS event listener
  useEffect(() => {
    const handler = (event) => {
      try {
        const data = JSON.parse(event.detail);

        notificationService.handleFirebaseMessage({
          notification: {
            title: data.title,
            body: data.body,
          },
          data,
        });
      } catch (err) {
        console.error("nativePush parse error:", err);
      }
    };

    window.addEventListener("nativePush", handler);

    return () => {
      window.removeEventListener("nativePush", handler);
    };
  }, []);

  // ✅ When user is authenticated: flush pending token + init notificationService
  useEffect(() => {
    if (user) {
      // ⚡ Flush pending native FCM token (saved before login)
      const pendingToken = localStorage.getItem("pending_native_fcm");
      if (pendingToken) {
        console.log(
          "%c [PUSH] Writing pending FCM token now",
          "color: purple; font-weight: bold"
        );

        const tokenRef = doc(db, "users", user.uid, "tokens", pendingToken);
        setDoc(
          tokenRef,
          {
            token: pendingToken,
            platform: "android",
            createdAt: new Date().toISOString(),
            active: true,
            lastActive: new Date().toISOString(),
          },
          { merge: true }
        )
          .then(() => {
            console.log(
              "%c [PUSH] Pending token saved successfully!",
              "color: purple; font-weight: bold"
            );
            localStorage.removeItem("pending_native_fcm");
          })
          .catch((err) => {
            console.error("Error saving pending token:", err);
          });
      }

      // existing notification initialization
      notificationService.initialize();

      // Listen for incoming calls
      const removeCallListener = notificationService.addCallListener(
        (callData) => {
          if (callData.type === "incoming_call") {
            setIncomingCall(callData);
            setIsIncomingCallVisible(true);
          }
        }
      );

      return () => {
        removeCallListener();
      };
    }
  }, [user]);

  // Auth state
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

  // Handle online status
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

  // Handle call acceptance
  const handleAcceptCall = async () => {
    if (incomingCall) {
      await notificationService.acceptCall(incomingCall.callId);
      setIsIncomingCallVisible(false);
      setIncomingCall(null);
    }
  };

  // Handle call rejection
  const handleRejectCall = async () => {
    if (incomingCall) {
      await notificationService.rejectCall(incomingCall.callId);
      setIsIncomingCallVisible(false);
      setIncomingCall(null);
    }
  };

  // Handle call modal close
  const handleCloseCallModal = () => {
    setIsIncomingCallVisible(false);
    setIncomingCall(null);
    notificationService.stopRingtone();
  };

  // Register service worker
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/firebase-messaging-sw.js")
        .then((registration) => {
          console.log(
            "Service Worker registered with scope:",
            registration.scope
          );
        })
        .catch((error) => {
          console.error("Service Worker registration failed:", error);
        });
    }
  }, []);

  // Listen for service worker messages
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener("message", (event) => {
        if (event.data && event.data.type === "INCOMING_CALL") {
          const callData = event.data.data;
          setIncomingCall({
            type: "incoming_call",
            ...callData,
          });
          setIsIncomingCallVisible(true);
        }
      });
    }
  }, []);

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
      {/* Incoming Call Modal */}
      <IncomingCallModal
        callerName={incomingCall?.callerName || "Unknown Caller"}
        callerPhoto={incomingCall?.callerPhoto || "/default-avatar.png"}
        onAccept={handleAcceptCall}
        onDecline={handleRejectCall}
        onClose={handleCloseCallModal}
        visible={isIncomingCallVisible}
      />

      <Routes>
        <Route path="/" element={<Home user={user} />} />
        <Route path="/profile" element={<Profile user={user} />} />
        <Route path="/profile/:uid" element={<Profile user={user} />} />
        {/* Add call route */}
        <Route path="/call/:callId" element={<Chat user={user} />} />
      </Routes>
    </Router>
  );
}

export default App;
