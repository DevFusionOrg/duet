import React, { useState, useEffect } from "react";
import {
  signInWithPopup,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  GoogleAuthProvider,
  signInWithCredential,
} from "firebase/auth";
import { auth, googleProvider } from "../firebase/firebase";
import {
  createUserProfile,
  checkUsernameTaken,
  validateUsername,
  getUsernameSuggestions,
} from "../firebase/firestore";
import { Capacitor } from "@capacitor/core";
import { FirebaseAuthentication } from "@capacitor-firebase/authentication";
import "../styles/Auth.css";

function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [usernameError, setUsernameError] = useState("");
  const [usernameSuggestions, setUsernameSuggestions] = useState([]);
  const [usernameStatus, setUsernameStatus] = useState("idle");
  const [usernameValidation, setUsernameValidation] = useState({
    isValid: false,
    errors: [],
  });

  // Live username validation + availability check
  useEffect(() => {
    let isCancelled = false;

    const checkUsernameAvailability = async () => {
      if (!username || username.length < 3) {
        setUsernameError("");
        setUsernameValidation({ isValid: false, errors: [] });
        setUsernameSuggestions([]);
        setUsernameStatus("idle");
        return;
      }

      const validation = validateUsername(username);
      setUsernameValidation(validation);

      if (!validation.isValid) {
        if (!isCancelled) {
          setUsernameError(validation.errors[0]);
          setUsernameSuggestions([]);
          setUsernameStatus("invalid");
        }
        return;
      }

      setUsernameError("");
      setUsernameStatus("checking");

      try {
        const isTaken = await checkUsernameTaken(username);
        if (isCancelled) return;

        if (isTaken) {
          setUsernameError("Username is already taken");
          setUsernameStatus("taken");

          const suggestions = await getUsernameSuggestions(username);
          if (!isCancelled) {
            setUsernameSuggestions(suggestions);
          }
        } else {
          setUsernameError("");
          setUsernameSuggestions([]);
          setUsernameStatus("available");
        }
      } catch (err) {
        console.error("Error checking username:", err);
        if (!isCancelled) {
          setUsernameError("Error checking username availability");
          setUsernameStatus("error");
        }
      }
    };

    const debounceTimer = setTimeout(() => {
      checkUsernameAvailability();
    }, 500);

    return () => {
      isCancelled = true;
      clearTimeout(debounceTimer);
    };
  }, [username]);

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
        await createUserProfile(userCredential.user);
      } else {
        const result = await signInWithPopup(auth, googleProvider);
        await createUserProfile(result.user);
      }
    } catch (err) {
      console.error("Error signing in with Google:", err);
      setError("Error signing in with Google: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setUsernameError("");

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        if (!name.trim()) {
          throw new Error("Full name is required");
        }

        if (!username.trim()) {
          throw new Error("Username is required");
        }

        const validation = validateUsername(username);
        if (!validation.isValid) {
          throw new Error(validation.errors[0]);
        }

        const isTaken = await checkUsernameTaken(username);
        if (isTaken) {
          throw new Error("Username is already taken. Please choose another one.");
        }

        const userCredential = await createUserWithEmailAndPassword(
          auth,
          email,
          password
        );

        await updateProfile(userCredential.user, {
          displayName: name,
        });

        await createUserProfile(userCredential.user, username);
      }
    } catch (err) {
      console.error("Authentication error:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSuggestionClick = (suggestion) => {
    setUsername(suggestion);
    setUsernameError("");
    setUsernameSuggestions([]);
  };

  const resetForm = () => {
    setEmail("");
    setPassword("");
    setName("");
    setUsername("");
    setError("");
    setUsernameError("");
    setUsernameSuggestions([]);
    setUsernameStatus("idle");
    setUsernameValidation({ isValid: false, errors: [] });
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
            className={`auth-toggle-button ${
              isLogin ? "auth-toggle-active" : ""
            }`}
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
            className={`auth-toggle-button ${
              !isLogin ? "auth-toggle-active" : ""
            }`}
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

              <div className="auth-input-group">
                <label className="auth-label">
                  Username
                  <span className="auth-required">*</span>
                  {usernameStatus === "checking" && (
                    <span className="auth-checking">Checking...</span>
                  )}
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase())}
                  placeholder="Choose a username"
                  className={`auth-input ${
                    usernameError
                      ? "auth-input-error"
                      : usernameStatus === "available"
                      ? "auth-input-valid"
                      : ""
                  }`}
                  required={!isLogin}
                  disabled={loading}
                  pattern="[a-zA-Z0-9_.-]+"
                  title="Only letters, numbers, dots (.), underscores (_) and hyphens (-) allowed"
                />

                {usernameError && (
                  <div className="auth-input-error-message">
                    {usernameError}
                  </div>
                )}

                {!usernameError && usernameStatus === "available" && (
                  <div className="auth-input-success-message">
                    ✓ Username is available
                  </div>
                )}

                <div className="auth-input-hint">
                  Must be 3–30 characters. Only letters, numbers, ., _, - allowed.
                </div>

                {usernameSuggestions.length > 0 && (
                  <div className="auth-suggestions-container">
                    <div className="auth-suggestions-label">Suggestions:</div>
                    <div className="auth-suggestions-list">
                      {usernameSuggestions.map((suggestion, index) => (
                        <button
                          key={index}
                          type="button"
                          className="auth-suggestion-button"
                          onClick={() => handleSuggestionClick(suggestion)}
                          disabled={loading}
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
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
            <div className="auth-input-hint">
              Must be at least 6 characters long.
            </div>
          </div>

          <button
            type="submit"
            className="auth-email-button"
            disabled={
              loading ||
              (!isLogin && (usernameError || !usernameValidation.isValid))
            }
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
