import React, { useState } from "react";
import {
  signInWithPopup,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
} from "firebase/auth";
import { auth, googleProvider } from "../firebase/firebase";
import "../styles/Auth.css";

function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const signInWithGoogle = async () => {
    try {
      setLoading(true);
      setError("");
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Error signing in with Google:", error);
      setError("Error signing in with Google: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      if (isLogin) {
        // Sign in existing user
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        // Create new user
        const userCredential = await createUserWithEmailAndPassword(
          auth,
          email,
          password,
        );

        // Update profile with display name
        if (name) {
          await updateProfile(userCredential.user, {
            displayName: name,
          });
        }
      }
    } catch (error) {
      console.error("Authentication error:", error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        {/* Header */}
        <div className="auth-header">
          <h1 className="auth-title">Duet</h1>
          <p className="auth-subtitle">
            Chat with friends and listen to music together
          </p>
        </div>

        {/* Error Message */}
        {error && <div className="auth-error">{error}</div>}

        {/* Toggle between Login and Signup */}
        <div className="auth-toggle-container">
          <button
            className={`auth-toggle-button ${isLogin ? "auth-toggle-active" : ""}`}
            onClick={() => setIsLogin(true)}
          >
            Sign In
          </button>
          <button
            className={`auth-toggle-button ${!isLogin ? "auth-toggle-active" : ""}`}
            onClick={() => setIsLogin(false)}
          >
            Sign Up
          </button>
        </div>

        {/* Email/Password Form */}
        <form onSubmit={handleEmailAuth} className="auth-form">
          {!isLogin && (
            <div className="auth-input-group">
              <label className="auth-label">Full Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your full name"
                className="auth-input"
                required={!isLogin}
              />
            </div>
          )}

          <div className="auth-input-group">
            <label className="auth-label">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              className="auth-input"
              required
            />
          </div>

          <div className="auth-input-group">
            <label className="auth-label">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              className="auth-input"
              required
              minLength={6}
            />
          </div>

          <button
            type="submit"
            className="auth-email-button"
            disabled={loading}
          >
            {loading ? "Loading..." : isLogin ? "Sign In" : "Sign Up"}
          </button>
        </form>

        {/* Divider */}
        <div className="auth-divider">
          <span className="auth-divider-text">or continue with</span>
        </div>

        {/* Google Sign In */}
        <button
          onClick={signInWithGoogle}
          className="auth-google-button"
          disabled={loading}
        >
          <img
            src="https://developers.google.com/identity/images/g-logo.png"
            alt="Google"
            className="auth-google-icon"
          />
          {loading ? "Loading..." : "Sign in with Google"}
        </button>

        {/* Switch between Login and Signup */}
        <div className="auth-switch-container">
          <p className="auth-switch-text">
            {isLogin ? "Don't have an account? " : "Already have an account? "}
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="auth-switch-button"
            >
              {isLogin ? "Sign up" : "Sign in"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Auth;
