import React, { useState } from "react";
import {
  signInWithPopup,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  GoogleAuthProvider,
  signInWithCredential,
  sendPasswordResetEmail,
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
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState("");
  const [resetEmailSent, setResetEmailSent] = useState(false);

// Add these SVG components inside the Auth function
  const EmailIcon = () => (
    <svg 
      className="auth-input-icon"
      viewBox="0 0 24 24" 
      fill="currentColor"
    >
      <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" />
    </svg>
  );

  const PasswordIcon = () => (
    <svg 
      className="auth-input-icon"
      viewBox="0 0 24 24" 
      fill="currentColor"
    >
      <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z" />
    </svg>
  );

  const NameIcon = () => (
    <svg 
      className="auth-input-icon"
      viewBox="0 0 24 24" 
      fill="currentColor"
    >
      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
    </svg>
  );

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

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    
    if (!forgotPasswordEmail.trim()) {
      setError("Please enter your email address");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await sendPasswordResetEmail(auth, forgotPasswordEmail);
      setResetEmailSent(true);
      setError("");

      setTimeout(() => {
        setShowForgotPassword(false);
        setResetEmailSent(false);
        setForgotPasswordEmail("");
      }, 8000);
    } catch (err) {
      console.error("Password reset error:", err);
      
      let errorMessage = "Failed to send password reset email. ";
      if (err.code === 'auth/user-not-found') {
        errorMessage += "No account found with this email address.";
      } else if (err.code === 'auth/invalid-email') {
        errorMessage += "Invalid email address.";
      } else if (err.code === 'auth/too-many-requests') {
        errorMessage += "Too many requests. Please try again later.";
      } else {
        errorMessage += (err.message || String(err));
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const openForgotPasswordModal = () => {
    setShowForgotPassword(true);
    setForgotPasswordEmail(email); 
    setError("");
    setResetEmailSent(false);
  };

  const closeForgotPasswordModal = () => {
    setShowForgotPassword(false);
    setForgotPasswordEmail("");
    setError("");
    setResetEmailSent(false);
  };

  return (
    <div className="auth-container">
      <div className="auth-top-header">
        <div className="auth-app-name">Duet (IND)</div>
      </div>

      <div className="auth-logo-section">
        <img src="/logo192.png" alt="Duet Logo" className="auth-logo" />
      </div>

      <div className="auth-card">
        {error && <div className="auth-error">{error}</div>}

        {isLogin ? (
          <>
            <form onSubmit={handleEmailAuth} className="auth-form">
              <div className="auth-input-group">
                <div className="auth-input-icon-container">
                  <EmailIcon />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder=" "
                  className="auth-input"
                  required
                  disabled={loading}
                />
                <label className="auth-label">Email</label>
              </div>

              <div className="auth-input-group">
                <div className="auth-input-icon-container">
                  <PasswordIcon />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder=" "
                  className="auth-input"
                  required
                  minLength={6}
                  disabled={loading}
                />
                <label className="auth-label">Password</label>
              </div>

              <button
                type="submit"
                className="auth-email-button"
                disabled={loading}
              >
                {loading ? (
                  <Spinner size="small" inline={true} />
                ) : (
                  "Sign In"
                )}
              </button>
            </form>

            <div className="auth-forgot-password-container">
              <button
                type="button"
                onClick={openForgotPasswordModal}
                className="auth-forgot-password-link"
                disabled={loading}
              >
                Forgot Password?
              </button>
            </div>

            <div className="auth-divider">
              <span className="auth-divider-text">or</span>
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
          </>
        ) : (
          <>
            <form onSubmit={handleEmailAuth} className="auth-form">
              <div className="auth-input-group">
                <div className="auth-input-icon-container">
                  <NameIcon />
                </div>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder=" "
                  className="auth-input"
                  required={!isLogin}
                  disabled={loading}
                />
                <label className="auth-label">Full Name</label>
              </div>

              <div className="auth-input-group">
                <div className="auth-input-icon-container">
                  <EmailIcon />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder=" "
                  className="auth-input"
                  required
                  disabled={loading}
                />
                <label className="auth-label">Email</label>
              </div>

              <div className="auth-input-group">
                <div className="auth-input-icon-container">
                  <PasswordIcon />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder=" "
                  className="auth-input"
                  required
                  minLength={6}
                  disabled={loading}
                />
                <label className="auth-label">Password</label>
              </div>

              <button
                type="submit"
                className="auth-email-button"
                disabled={loading}
              >
                {loading ? (
                  <Spinner size="small" inline={true} />
                ) : (
                  "Create Account"
                )}
              </button>
            </form>

            <div className="auth-divider">
              <span className="auth-divider-text">or</span>
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
              {loading ? "Loading..." : "Sign up with Google"}
            </button>
          </>
        )}

        <div className="auth-switch-container">
          <button
            type="button"
            onClick={toggleAuthMode}
            className="auth-create-account-button"
            disabled={loading}
          >
            {isLogin ? "Create new account" : "Back to Sign In"}
          </button>
        </div>
      </div>

      <div className="auth-footer">
        <div className="devfusion-logo">
          <img src="/DevFusion.png" alt="DevFusion" className="devfusion-logo-img" />
          <span className="devfusion-text">DevFusion</span>
        </div>
      </div>

      {}
      {showForgotPassword && (
        <div className="auth-modal-overlay" onClick={closeForgotPasswordModal}>
          <div className="auth-modal-content" onClick={(e) => e.stopPropagation()}>
            <button 
              className="auth-modal-close" 
              onClick={closeForgotPasswordModal}
              aria-label="Close"
            >
              ×
            </button>
            
            <h2 className="auth-modal-title">Reset Password</h2>
            
            {resetEmailSent ? (
              <div className="auth-reset-success">
                <div className="auth-success-icon">✓</div>
                <p className="auth-success-message">
                  Password reset email sent successfully!
                </p>
                <p className="auth-success-submessage">
                  Please check your inbox at <strong>{forgotPasswordEmail}</strong>
                </p>
                <p className="auth-spam-notice">
                  ⚠️ Don't forget to check your <strong>spam/junk folder</strong> if you don't see the email in a few minutes.
                </p>
                <button 
                  onClick={closeForgotPasswordModal}
                  className="auth-modal-ok-button"
                >
                  OK
                </button>
              </div>
            ) : (
              <>
                <p className="auth-modal-description">
                  Enter your email address and we'll send you a link to reset your password.
                </p>
                
                {error && <div className="auth-error">{error}</div>}
                
                <form onSubmit={handleForgotPassword} className="auth-modal-form">
                  <div className="auth-input-group">
                    <div className="auth-input-icon-container">
                      <EmailIcon />
                    </div>
                    <input
                      type="email"
                      value={forgotPasswordEmail}
                      onChange={(e) => setForgotPasswordEmail(e.target.value)}
                      placeholder=" "
                      className="auth-input"
                      required
                      disabled={loading}
                      autoFocus
                    />
                    <label className="auth-label">Email Address</label>
                  </div>

                  <div className="auth-modal-buttons">
                    <button
                      type="button"
                      onClick={closeForgotPasswordModal}
                      className="auth-modal-cancel-button"
                      disabled={loading}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="auth-modal-submit-button"
                      disabled={loading}
                    >
                      {loading ? (
                        <Spinner size="small" inline={true} />
                      ) : (
                        "Send Reset Link"
                      )}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default Auth;
