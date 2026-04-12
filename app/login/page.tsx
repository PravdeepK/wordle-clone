"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  sendEmailVerification,
  signOut,
} from "firebase/auth";
import { auth } from "../../config/firebaseConfig";
import { getFirestore, doc, setDoc, getDoc } from "firebase/firestore";

const db = getFirestore();

const TILE_COLORS = ["bg-green-500", "bg-yellow-500", "bg-gray-400", "bg-green-500", "bg-yellow-500", "bg-green-500"];

export default function LoginPage() {
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
        if (!email) { setError("Username not found."); return; }

        const userCred = await signInWithEmailAndPassword(auth, email, password);
        if (!userCred.user.emailVerified) {
          await signOut(auth);
          setNeedsVerification(true);
          setError("Please verify your email before logging in. Check your inbox (and spam folder).");
          return;
        }
        router.push("/");
      } else {
        if (password !== confirmPassword) { setError("Passwords do not match."); return; }

        const usernameKey = username.toLowerCase();
        const userDocRef = doc(db, "users", usernameKey);
        if ((await getDoc(userDocRef)).exists()) {
          setError("Username already taken. Please choose another.");
          return;
        }

        const userCred = await createUserWithEmailAndPassword(auth, inputIdentifier, password);
        await updateProfile(userCred.user, { displayName: username });
        await setDoc(userDocRef, { email: inputIdentifier, uid: userCred.user.uid });
        await sendEmailVerification(userCred.user);
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
      const formatted = e.code === "auth/email-already-in-use"
        ? "Error: Email already in use"
        : "Error: " + (e.message || "Something went wrong");
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
      if (!email) { setError("Username not found."); return; }
      const userCred = await signInWithEmailAndPassword(auth, email, password);
      await sendEmailVerification(userCred.user);
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

  return (
    <div className="login-page">
      {/* Decorative Wordle tiles */}
      <div className="login-tiles">
        {"WORDLE".split("").map((letter, i) => (
          <div key={i} className={`cell login-tile ${TILE_COLORS[i]}`}>
            {letter}
          </div>
        ))}
      </div>

      <div className="login-card">
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
            <label className="login-label">
              {isLoginMode ? "Username or Email" : "Email"}
            </label>
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
                {showPassword ? "🙈" : "👁️"}
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
                  {showConfirmPassword ? "🙈" : "👁️"}
                </button>
              </div>
            </div>
          )}

          {error && <div className="pretty-error">{error}</div>}
          {successMsg && <div className="pretty-success">{successMsg}</div>}

          <button
            onClick={handleAuth}
            className="restart-button login-submit"
            disabled={loading}
          >
            {loading ? "Please wait…" : isLoginMode ? "Login" : "Create Account"}
          </button>

          {needsVerification && (
            <button onClick={handleResendVerification} className="scoreboard-button login-submit">
              Resend verification email
            </button>
          )}

          <button onClick={switchMode} className="login-switch-mode">
            {isLoginMode ? "Need an account? Sign up →" : "Already have an account? Log in →"}
          </button>
        </div>
      </div>
    </div>
  );
}
