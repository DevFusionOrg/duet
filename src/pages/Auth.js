import React, { useState } from "react";
import { supabase } from "../supabase/supabase";
import { createUserProfile } from "../firebase/firestore";
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
    setLoading(true);
    setError("");

    try {
      const { error: signInErr } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: typeof window !== "undefined" ? window.location.origin : undefined,
        },
      });

      if (signInErr) throw signInErr;
    } catch (err) {
      console.error("[Auth] Error signing in with Google:", err);
      setError(err.message || String(err));
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
        const { data, error: loginErr } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (loginErr) throw loginErr;

        if (data?.user) {
          const u = {
            uid: data.user.id,
            id: data.user.id,
            email: data.user.email,
            displayName:
              data.user.user_metadata?.full_name ||
              data.user.email?.split("@")[0] ||
              "User",
            photoURL: data.user.user_metadata?.avatar_url || "",
          };
          await createUserProfile(u);
        }
      } else {
        if (!name.trim()) {
          throw new Error("Full name is required");
        }
        if (!email.trim()) {
          throw new Error("Email is required");
        }

        const derivedUsername = deriveUsernameFromEmail(email);
        const { data, error: signupErr } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: name,
              name: name,
            },
          },
        });
        if (signupErr) throw signupErr;

        if (data?.user) {
          const u = {
            uid: data.user.id,
            id: data.user.id,
            email: data.user.email,
            displayName: name,
            photoURL: "",
          };
          await createUserProfile(u, derivedUsername);
        }
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
