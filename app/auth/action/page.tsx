"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { applyActionCode, checkActionCode, confirmPasswordReset, verifyPasswordResetCode } from "firebase/auth";
import { auth } from "../../../config/firebaseConfig";
import { useDarkMode } from "../../../hooks/useDarkMode";
import WordleLogoTiles from "../../../components/WordleLogoTiles";

type Status = "loading" | "success" | "error" | "needs-password";

function ActionHandler() {
  useDarkMode();
  const params = useSearchParams();
  const mode = params.get("mode");
  const oobCode = params.get("oobCode");

  const [status, setStatus] = useState<Status>("loading");
  const [message, setMessage] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!oobCode || !mode) {
      setStatus("error");
      setMessage("Invalid or expired link.");
      return;
    }

    (async () => {
      try {
        if (mode === "verifyEmail") {
          await applyActionCode(auth, oobCode);
          setStatus("success");
          setMessage("Email verified! You can now log in.");
        } else if (mode === "resetPassword") {
          await verifyPasswordResetCode(auth, oobCode);
          setStatus("needs-password");
        } else if (mode === "recoverEmail") {
          await checkActionCode(auth, oobCode);
          await applyActionCode(auth, oobCode);
          setStatus("success");
          setMessage("Email change reverted successfully.");
        } else {
          setStatus("error");
          setMessage("Unsupported action.");
        }
      } catch {
        setStatus("error");
        setMessage("This link is invalid or has expired. Please request a new one.");
      }
    })();
  }, [mode, oobCode]);

  const submitPasswordReset = async () => {
    if (!oobCode) return;
    if (newPassword.length < 6) {
      setMessage("Password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }
    setSubmitting(true);
    try {
      await confirmPasswordReset(auth, oobCode, newPassword);
      setStatus("success");
      setMessage("Password updated! You can now log in with your new password.");
    } catch {
      setMessage("Could not reset password. The link may have expired.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <WordleLogoTiles />
      <div className="login-card">
        <h1 className="title">
          {mode === "verifyEmail" ? "Email Verification" :
           mode === "resetPassword" ? "Reset Password" :
           mode === "recoverEmail" ? "Recover Email" :
           "Account Action"}
        </h1>

        {status === "loading" && <p className="login-subtitle">Working on it…</p>}

        {status === "success" && (
          <>
            <p className="pretty-success">{message}</p>
            <Link href="/login" className="restart-button login-submit">Go to Login</Link>
          </>
        )}

        {status === "error" && (
          <>
            <p className="pretty-error">{message}</p>
            <Link href="/login" className="restart-button login-submit">Back to Login</Link>
          </>
        )}

        {status === "needs-password" && (
          <div className="login-form">
            <div className="login-field">
              <label className="login-label">New Password</label>
              <input
                className="input-box login-input"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            <div className="login-field">
              <label className="login-label">Confirm Password</label>
              <input
                className="input-box login-input"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            {message && <p className="pretty-error">{message}</p>}
            <button
              className="restart-button login-submit"
              onClick={submitPasswordReset}
              disabled={submitting}
            >
              {submitting ? "Please wait..." : "Update Password"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AuthActionPage() {
  return (
    <Suspense fallback={<div className="login-page"><p className="login-subtitle">Loading…</p></div>}>
      <ActionHandler />
    </Suspense>
  );
}
