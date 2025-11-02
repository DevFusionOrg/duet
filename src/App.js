import React, { useEffect, useState } from "react";
import { auth } from "./firebase/firebase";
import { createUserProfile } from "./firebase/firestore";
import Auth from "./pages/Auth";
import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import Home from "./pages/Home";
import Search from "./pages/Search";
import Notifications from "./pages/Notifications";
import Profile from "./pages/Profile";
import "./App.css"; // Import the CSS file

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (currentUser) => {
      console.log("Auth state changed:", currentUser);
      
      try {
        if (currentUser) {
          // Create/update user profile in Firestore
          console.log("Creating/updating user profile...");
          await createUserProfile(currentUser);
          console.log("User profile created/updated");
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

  // Show loading only while checking auth state
  if (loading) {
    return (
      <div className="app-loading">
        <div className="app-loading-content">
          <div className="app-logo">
            Duet
          </div>
          <p>Loading...</p>
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

  // User is authenticated
  return (
    <Router>
      <nav className="app-nav">
        <div className="app-nav-left">
          <Link to="/" className="app-nav-brand">
            Duet
          </Link>
          <div className="app-nav-links">
            <Link to="/" className="app-nav-link">Home</Link>
            <Link to="/search" className="app-nav-link">Search</Link>
            <Link to="/notifications" className="app-nav-link">Notifications</Link>
            <Link to="/profile" className="app-nav-link">Profile</Link>
          </div>
        </div>
        <div className="app-nav-right">
          <span className="app-user-greeting">
            Hello, {user.displayName || 'User'}!
          </span>
          <button 
            onClick={() => auth.signOut()} 
            className="app-logout-button"
          >
            Logout
          </button>
        </div>
      </nav>

      <Routes>
        <Route path="/" element={<Home user={user} />} />
        <Route path="/search" element={<Search user={user} />} />
        <Route path="/notifications" element={<Notifications user={user} />} />
        <Route path="/profile" element={<Profile user={user} />} />
      </Routes>
    </Router>
  );
}

export default App;