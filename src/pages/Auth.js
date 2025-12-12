import React, { useState } from "react";
import {
  signInWithPopup,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  GoogleAuthProvider,
  signInWithCredential,
} from "firebase/auth";
import { auth, googleProvider } from "../firebase/firebase";
import { createUserProfile } from "../firebase/firestore";
import { Capacitor } from "@capacitor/core";
import { FirebaseAuthentication } from "@capacitor-firebase/authentication";
import "../styles/Auth.css";

function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const deriveUsernameFromEmail = (emailStr) => {
    if (!emailStr) return "";
    const local = emailStr.split("@")[0] || "";
    return local.toLowerCase().trim().replace(/[^a-z0-9._-]/g, "").slice(0, 30);
  };

  const signInWithGoogle = async () => {
    const platform = Capacitor.getPlatform();
    const isNative = platform === "android" || platform === "ios";

    setLoading(true);
    setError("");

    try {
      if (isNative) {
        const result = await FirebaseAuthentication.signInWithGoogle();

        if (!result || !result.credential || !result.credential.idToken) {
          throw new Error("No ID token returned from native Google sign-in");
        }

        const credential = GoogleAuthProvider.credential(
          result.credential.idToken
        );
        const userCredential = await signInWithCredential(auth, credential);

        const derivedUsername = deriveUsernameFromEmail(
          userCredential.user.email || ""
        );
        await createUserProfile(userCredential.user, derivedUsername);
      } else {
        const result = await signInWithPopup(auth, googleProvider);

        const derivedUsername = deriveUsernameFromEmail(result.user.email || "");
        await createUserProfile(result.user, derivedUsername);
      }
    } catch (err) {
      console.error("Error signing in with Google:", err);
      setError("Error signing in with Google: " + (err.message || err));
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
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        if (!name.trim()) {
          throw new Error("Full name is required");
        }

        if (!email.trim()) {
          throw new Error("Email is required");
        }

        const userCredential = await createUserWithEmailAndPassword(
          auth,
          email,
          password
        );

        await updateProfile(userCredential.user, {
          displayName: name,
        });

        const derivedUsername = deriveUsernameFromEmail(email);
        await createUserProfile(userCredential.user, derivedUsername);
      }
    } catch (err) {
      console.error("Authentication error:", err);
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setEmail("");
    setPassword("");
    setName("");
    setError("");
  };

  const toggleAuthMode = () => {
    resetForm();
    setIsLogin((prev) => !prev);
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <h1 className="auth-title">Duet</h1>
          <p className="auth-subtitle">
            Chat with friends and listen to music together
          </p>
        </div>

        {error && <div className="auth-error">{error}</div>}

        <div className="auth-toggle-container">
          <button
            type="button"
            className={`auth-toggle-button ${isLogin ? "auth-toggle-active" : ""}`}
            onClick={() => {
              resetForm();
              setIsLogin(true);
            }}
            disabled={loading}
          >
            Sign In
          </button>
          <button
            type="button"
            className={`auth-toggle-button ${!isLogin ? "auth-toggle-active" : ""}`}
            onClick={() => {
              resetForm();
              setIsLogin(false);
            }}
            disabled={loading}
          >
            Sign Up
          </button>
        </div>

        <form onSubmit={handleEmailAuth} className="auth-form">
          {!isLogin && (
            <>
              <div className="auth-input-group">
                <label className="auth-label">
                  Full Name
                  <span className="auth-required">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your full name"
                  className="auth-input"
                  required={!isLogin}
                  disabled={loading}
                />
              </div>
            </>
          )}

          <div className="auth-input-group">
            <label className="auth-label">
              Email
              <span className="auth-required">*</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              className="auth-input"
              required
              disabled={loading}
            />
          </div>

          <div className="auth-input-group">
            <label className="auth-label">
              Password
              <span className="auth-required">*</span>
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              className="auth-input"
              required
              minLength={6}
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            className="auth-email-button"
            disabled={loading}
          >
            {loading ? (
              <span className="auth-loading-spinner"></span>
            ) : isLogin ? (
              "Sign In"
            ) : (
              "Create Account"
            )}
          </button>
        </form>

        <div className="auth-divider">
          <span className="auth-divider-text">or continue with</span>
        </div>

        <button
          type="button"
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

        <div className="auth-switch-container">
          <p className="auth-switch-text">
            {isLogin ? "Don't have an account? " : "Already have an account? "}
            <button
              type="button"
              onClick={toggleAuthMode}
              className="auth-switch-button"
              disabled={loading}
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
