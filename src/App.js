import React, { useEffect, useState } from "react";
import { auth } from "./firebase/firebase";
import { createUserProfile } from "./firebase/firestore";
import Auth from "./pages/Auth";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Search from "./pages/Search";
import Notifications from "./pages/Notifications";
import Profile from "./pages/Profile";
import "./App.css";

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (currentUser) => {
      try {
        if (currentUser) {
          // Create/update user profile in Firestore
          await createUserProfile(currentUser);
          setAuthError(null);
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

  // Show auth error if any
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

  // If not loading and no user, show the new Auth component
  if (!user) {
    return <Auth />;
  }

  // User is authenticated, show the main app
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home user={user} />} />
        <Route path="/search" element={<Search user={user} />} />
        <Route path="/notifications" element={<Notifications user={user} />} />
        {/* Both profile routes */}
        <Route path="/profile" element={<Profile user={user} />} />
        <Route path="/profile/:uid" element={<Profile user={user} />} />
      </Routes>
    </Router>
  );
}

export default App;