"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut,
} from "firebase/auth";
import { auth } from "../config/firebaseConfig";
import { getFirestore, doc, setDoc, getDoc } from "firebase/firestore";

const db = getFirestore();

function IconEyeOpen() {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
      <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function IconEyeSlash() {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <path d="M1 1l22 22" />
    </svg>
  );
}

export type LoginSignupPanelProps = {
  /** Applied to the `.login-card` root for layout overrides (e.g. modal). */
  cardClassName?: string;
  /** When set, replaces default `router.push("/")` after a successful login. */
  onLoginSuccess?: () => void;
};

export default function LoginSignupPanel({ cardClassName = "", onLoginSuccess }: LoginSignupPanelProps) {
  const router = useRouter();

  const [isLoginMode, setIsLoginMode] = useState(true);
  const [inputIdentifier, setInputIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [loading, setLoading] = useState(false);

  const resolveEmail = async (identifier: string): Promise<string | null> => {
    if (identifier.includes("@")) return identifier;
    const userDoc = await getDoc(doc(db, "users", identifier.toLowerCase()));
    if (!userDoc.exists()) return null;
    return userDoc.data().email as string;
  };

  const handleAuth = async () => {
    setError("");
    setSuccessMsg("");
    setNeedsVerification(false);
    setLoading(true);
    try {
      if (isLoginMode) {
        const email = await resolveEmail(inputIdentifier);
        if (!email) {
          setError("Invalid login. Please check your credentials and try again.");
          return;
        }

        const userCred = await signInWithEmailAndPassword(auth, email, password);
        const isLocalDev = process.env.NODE_ENV === "development";
        if (!userCred.user.emailVerified && !isLocalDev) {
          await signOut(auth);
          setNeedsVerification(true);
          setError("Please verify your email before logging in. Check your inbox (and spam folder).");
          return;
        }
        if (onLoginSuccess) {
          onLoginSuccess();
        } else {
          router.push("/");
        }
      } else {
        if (password !== confirmPassword) {
          setError("Passwords do not match.");
          return;
        }

        const usernameKey = username.toLowerCase();
        const userDocRef = doc(db, "users", usernameKey);
        if ((await getDoc(userDocRef)).exists()) {
          setError("Username already taken. Please choose another.");
          return;
        }

        const userCred = await createUserWithEmailAndPassword(auth, inputIdentifier, password);
        await updateProfile(userCred.user, { displayName: username });
        await setDoc(userDocRef, { email: inputIdentifier, uid: userCred.user.uid });
        await fetch("/api/send-verification-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: inputIdentifier }),
        });
        await signOut(auth);

        setIsLoginMode(true);
        setInputIdentifier("");
        setPassword("");
        setConfirmPassword("");
        setUsername("");
        setSuccessMsg("Account created! Check your email and click the verification link before logging in.");
      }
    } catch (err: unknown) {
      const e = err as { message?: string; code?: string };
      let formatted: string;
      if (isLoginMode) {
        formatted = "Invalid login. Please check your credentials and try again.";
      } else if (e.code === "auth/email-already-in-use") {
        formatted = "Error: Email already in use";
      } else {
        formatted = "Error: " + (e.message || "Something went wrong");
      }
      setError(formatted);
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    setError("");
    setSuccessMsg("");
    try {
      const email = await resolveEmail(inputIdentifier);
      if (!email) {
        setError("Username not found.");
        return;
      }
      const userCred = await signInWithEmailAndPassword(auth, email, password);
      await fetch("/api/send-verification-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      await signOut(auth);
      setNeedsVerification(false);
      setSuccessMsg("Verification email resent! Check your inbox.");
    } catch {
      setError("Could not resend. Check your email and password and try again.");
    }
  };

  const switchMode = () => {
    setIsLoginMode(!isLoginMode);
    setError("");
    setSuccessMsg("");
    setNeedsVerification(false);
  };

  const cardCn = ["login-card", cardClassName].filter(Boolean).join(" ");

  return (
    <div className={cardCn}>
      <h1 className="title">{isLoginMode ? "Welcome Back" : "Join Wordle"}</h1>
      <p className="login-subtitle">
        {isLoginMode ? "Sign in to continue playing" : "Create an account to start guessing"}
      </p>

      <div className="login-form">
        {!isLoginMode && (
          <div className="login-field">
            <label className="login-label">Username</label>
            <input
              className="input-box login-input"
              type="text"
              placeholder="Choose a username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
            />
          </div>
        )}

        <div className="login-field">
          <label className="login-label">{isLoginMode ? "Username or Email" : "Email"}</label>
          <input
            className="input-box login-input"
            type={isLoginMode ? "text" : "email"}
            placeholder={isLoginMode ? "Enter username or email" : "Enter your email"}
            value={inputIdentifier}
            onChange={(e) => setInputIdentifier(e.target.value)}
            autoComplete={isLoginMode ? "username" : "email"}
          />
        </div>

        <div className="login-field">
          <label className="login-label">Password</label>
          <div className="password-wrapper">
            <input
              className="input-box login-input"
              type={showPassword ? "text" : "password"}
              placeholder="Enter password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={isLoginMode ? "current-password" : "new-password"}
            />
            <button
              type="button"
              className="show-password-btn"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <IconEyeSlash /> : <IconEyeOpen />}
            </button>
          </div>
        </div>

        {!isLoginMode && (
          <div className="login-field">
            <label className="login-label">Confirm Password</label>
            <div className="password-wrapper">
              <input
                className="input-box login-input"
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Confirm your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
              />
              <button
                type="button"
                className="show-password-btn"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                aria-label={showConfirmPassword ? "Hide password" : "Show password"}
              >
                {showConfirmPassword ? <IconEyeSlash /> : <IconEyeOpen />}
              </button>
            </div>
          </div>
        )}

        {error && <div className="pretty-error">{error}</div>}
        {successMsg && <div className="pretty-success">{successMsg}</div>}

        <button onClick={handleAuth} className="restart-button login-submit" disabled={loading}>
          {loading ? "Please wait..." : isLoginMode ? "Login" : "Create Account"}
        </button>

        {needsVerification && (
          <button onClick={handleResendVerification} className="scoreboard-button login-submit">
            Resend verification email
          </button>
        )}

        <button type="button" onClick={switchMode} className="login-switch-mode">
          {isLoginMode ? "Need an account? Sign up" : "Already have an account? Log in"}
        </button>
      </div>
    </div>
  );
}
