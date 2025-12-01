import React, { useState, useEffect } from "react";
import {
  signInWithPopup,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
} from "firebase/auth";
import { auth, googleProvider } from "../firebase/firebase";
import { 
  createUserProfile, 
  checkUsernameTaken,
  validateUsername,
  getUsernameSuggestions 
} from "../firebase/firestore";
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
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [usernameValidation, setUsernameValidation] = useState({
    isValid: false,
    errors: []
  });

  // Check username availability when it changes (with debounce)
  useEffect(() => {
    const checkUsernameAvailability = async () => {
      if (!username || username.length < 3) {
        setUsernameError("");
        setUsernameValidation({ isValid: false, errors: [] });
        setUsernameSuggestions([]);
        return;
      }

      // Validate format first
      const validation = validateUsername(username);
      setUsernameValidation(validation);
      
      if (!validation.isValid) {
        setUsernameError(validation.errors[0]);
        setUsernameSuggestions([]);
        return;
      }

      setIsCheckingUsername(true);
      setUsernameError("");
      
      try {
        const isTaken = await checkUsernameTaken(username);
        
        if (isTaken) {
          setUsernameError("Username is already taken");
          
          // Get suggestions for similar usernames
          const suggestions = await getUsernameSuggestions(username);
          setUsernameSuggestions(suggestions);
        } else {
          setUsernameError("");
          setUsernameSuggestions([]);
        }
      } catch (error) {
        console.error("Error checking username:", error);
        setUsernameError("Error checking username availability");
      } finally {
        setIsCheckingUsername(false);
      }
    };

    const debounceTimer = setTimeout(() => {
      checkUsernameAvailability();
    }, 500); // 500ms debounce

    return () => clearTimeout(debounceTimer);
  }, [username]);

  const signInWithGoogle = async () => {
    try {
      setLoading(true);
      setError("");
      const result = await signInWithPopup(auth, googleProvider);
      
      // Create user profile after Google sign in
      await createUserProfile(result.user);
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
    setUsernameError("");

    try {
      if (isLogin) {
        // Login flow
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        // Signup flow
        // Validate all fields
        if (!name.trim()) {
          throw new Error("Full name is required");
        }

        if (!username.trim()) {
          throw new Error("Username is required");
        }

        // Validate username format
        const validation = validateUsername(username);
        if (!validation.isValid) {
          throw new Error(validation.errors[0]);
        }

        // Check if username is taken (final check)
        const isTaken = await checkUsernameTaken(username);
        if (isTaken) {
          throw new Error("Username is already taken. Please choose another one.");
        }

        // Create user with email/password
        const userCredential = await createUserWithEmailAndPassword(
          auth,
          email,
          password,
        );

        // Update profile with display name
        await updateProfile(userCredential.user, {
          displayName: name,
        });

        // Create user profile in Firestore with username
        await createUserProfile(userCredential.user, username);
      }
    } catch (error) {
      console.error("Authentication error:", error);
      setError(error.message);
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
  };

  const toggleAuthMode = () => {
    resetForm();
    setIsLogin(!isLogin);
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
            type="button"
            className={`auth-toggle-button ${isLogin ? "auth-toggle-active" : ""}`}
            onClick={() => {
              resetForm();
              setIsLogin(true);
            }}
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
          >
            Sign Up
          </button>
        </div>

        {/* Email/Password Form */}
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
                  {isCheckingUsername && (
                    <span className="auth-checking">Checking...</span>
                  )}
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase())}
                  placeholder="Enter a unique username"
                  className={`auth-input ${usernameError ? "auth-input-error" : usernameValidation.isValid ? "auth-input-valid" : ""}`}
                  required={!isLogin}
                  disabled={loading || isCheckingUsername}
                  pattern="[a-zA-Z0-9_.-]+"
                  title="Only letters, numbers, dots, underscores, and hyphens allowed"
                />
                
                {usernameError && (
                  <div className="auth-input-error-message">{usernameError}</div>
                )}
                
                {!usernameError && usernameValidation.isValid && (
                  <div className="auth-input-success-message">
                    ✓ Username is available
                  </div>
                )}

                {/* Username format hints */}
                <div className="auth-input-hint">
                  Must be 3-30 characters. Only letters, numbers, ., _, - allowed.
                </div>

                {/* Username suggestions */}
                {usernameSuggestions.length > 0 && (
                  <div className="auth-suggestions-container">
                    <div className="auth-suggestions-label">
                      Suggestions:
                    </div>
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
              Must be at least 6 characters long
            </div>
          </div>

          <button
            type="submit"
            className="auth-email-button"
            disabled={loading || (!isLogin && (usernameError || !usernameValidation.isValid))}
          >
            {loading ? (
              <span className="auth-loading-spinner"></span>
            ) : isLogin ? "Sign In" : "Create Account"}
          </button>
        </form>

        {/* Divider */}
        <div className="auth-divider">
          <span className="auth-divider-text">or continue with</span>
        </div>

        {/* Google Sign In */}
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

        {/* Switch between Login and Signup */}
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