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
import { Spinner } from "../Components/Spinner";
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
    return local.toLowerCase().trim().replace(/[^a-z0-9._-]/g, "").slice(0, 16);
  };

  const signInWithGoogle = async () => {
    const platform = Capacitor.getPlatform();
    const isNative = platform === "android" || platform === "ios";

    setLoading(true);
    setError("");

    try {
      if (isNative) {
        console.log("[Auth] Attempting native Google sign-in...");
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
        console.log("[Auth] Native Google sign-in successful");
      } else {
        console.log("[Auth] Attempting web Google sign-in popup...");
        const result = await signInWithPopup(auth, googleProvider);

        const derivedUsername = deriveUsernameFromEmail(result.user.email || "");
        await createUserProfile(result.user, derivedUsername);
        console.log("[Auth] Web Google sign-in successful");
      }
    } catch (err) {
      console.error("[Auth] Error signing in with Google:", err);

      let errorMessage = "Error signing in with Google: ";
      if (err.code === 'auth/popup-blocked') {
        errorMessage += "Pop-up was blocked by your browser. Please allow pop-ups for this site.";
      } else if (err.code === 'auth/popup-closed-by-user') {
        errorMessage += "Sign-in was cancelled.";
      } else if (err.code === 'auth/network-request-failed') {
        errorMessage += "Network error. Please check your internet connection.";
      } else {
        errorMessage += (err.message || err);
      }
      
      setError(errorMessage);
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
    <div className="auth-container auth-layout-v2">
      <div className="auth-mobile-top-logo">
        <img src="/logo192.png" alt="Duet Logo" className="auth-mobile-logo" />
      </div>

      <div className="auth-split-layout">
        <div className="auth-left-pane">
          <div className="auth-left-logo-wrap">
            <img src="/logo192.png" alt="Duet Logo" className="auth-left-logo" />
          </div>

          <div className="auth-left-content">
            <p className="auth-hero-line">chat privately with your</p>
            <p className="auth-hero-line auth-hero-line-strong">close friends</p>
            <img src="/login.png" alt="Duet login" className="auth-left-illustration" />
          </div>
        </div>

        <div className="auth-right-pane">
          <div className="auth-card auth-card-v2">
            <h2 className="auth-right-title">{isLogin ? "Log in to Duet" : "Create new account"}</h2>

            {error && <div className="auth-error">{error}</div>}

            {isLogin ? (
              <>
                <form onSubmit={handleEmailAuth} className="auth-form">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email"
                    className="auth-input-simple"
                    required
                    disabled={loading}
                  />

                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password"
                    className="auth-input-simple"
                    required
                    minLength={6}
                    disabled={loading}
                  />

                  <button
                    type="submit"
                    className="auth-email-button"
                    disabled={loading}
                  >
                    {loading ? (
                      <Spinner size="small" inline={true} />
                    ) : (
                      "Login"
                    )}
                  </button>
                </form>

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
                  {loading ? "Loading..." : "Login with Google"}
                </button>

                <div className="auth-switch-container">
                  <button
                    type="button"
                    onClick={toggleAuthMode}
                    className="auth-create-account-button"
                    disabled={loading}
                  >
                    Create new account
                  </button>
                </div>
              </>
            ) : (
              <>
                <form onSubmit={handleEmailAuth} className="auth-form">
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Name"
                    className="auth-input-simple"
                    required={!isLogin}
                    disabled={loading}
                  />

                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email"
                    className="auth-input-simple"
                    required
                    disabled={loading}
                  />

                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password"
                    className="auth-input-simple"
                    required
                    minLength={6}
                    disabled={loading}
                  />

                  <button
                    type="submit"
                    className="auth-email-button"
                    disabled={loading}
                  >
                    {loading ? (
                      <Spinner size="small" inline={true} />
                    ) : (
                      "Sign Up"
                    )}
                  </button>
                </form>

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
                  {loading ? "Loading..." : "Sign up with Google"}
                </button>

                <div className="auth-switch-container">
                  <button
                    type="button"
                    onClick={toggleAuthMode}
                    className="auth-create-account-button"
                    disabled={loading}
                  >
                    Back to Login
                  </button>
                </div>
              </>
            )}

            <div className="auth-right-devfusion">
              <img src="/DevFusion.png" alt="DevFusion" className="devfusion-logo-img" />
              <span className="devfusion-text">DevFusion</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Auth;
