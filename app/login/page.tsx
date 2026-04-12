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

  // Resolve username → email if needed
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

        // Send verification email then immediately sign out so they
        // can't enter the app until they've confirmed their address.
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
    }
  };

  const handleResendVerification = async () => {
    setError("");
    setSuccessMsg("");
    try {
      // Re-sign in temporarily just to call sendEmailVerification
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

  return (
    <div className="flex flex-col justify-center items-center min-h-screen w-full text-center gap-5">
      <h1 className="title">{isLoginMode ? "Login" : "Sign Up"}</h1>

      {!isLoginMode && (
        <input
          className="input-box"
          type="text"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
      )}

      <input
        className="input-box"
        type={isLoginMode ? "text" : "email"}
        placeholder={isLoginMode ? "Username or Email" : "Email"}
        value={inputIdentifier}
        onChange={(e) => setInputIdentifier(e.target.value)}
      />

      {/* Password Field */}
      <div className="flex flex-col items-center">
        <input
          className="input-box"
          type={showPassword ? "text" : "password"}
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <label className="mt-1 text-sm text-gray-700 flex items-center gap-2">
          <input type="checkbox" checked={showPassword} onChange={() => setShowPassword(!showPassword)} />
          Show password
        </label>
      </div>

      {/* Confirm Password for Sign Up */}
      {!isLoginMode && (
        <div className="flex flex-col items-center">
          <input
            className="input-box"
            type={showConfirmPassword ? "text" : "password"}
            placeholder="Confirm Password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
          <label className="mt-1 text-sm text-gray-700 flex items-center gap-2">
            <input type="checkbox" checked={showConfirmPassword} onChange={() => setShowConfirmPassword(!showConfirmPassword)} />
            Show confirm password
          </label>
        </div>
      )}

      {error && <div className="pretty-error">{error}</div>}
      {successMsg && <p className="win-message">{successMsg}</p>}

      <button onClick={handleAuth} className="restart-button">
        {isLoginMode ? "Login" : "Create Account"}
      </button>

      {/* Shown after a failed login due to unverified email */}
      {needsVerification && (
        <button onClick={handleResendVerification} className="scoreboard-button">
          Resend verification email
        </button>
      )}

      <button
        onClick={() => {
          setIsLoginMode(!isLoginMode);
          setError("");
          setSuccessMsg("");
          setNeedsVerification(false);
        }}
        className="scoreboard-button"
      >
        {isLoginMode ? "Need an account? Sign Up" : "Already have an account? Login"}
      </button>
    </div>
  );
}
