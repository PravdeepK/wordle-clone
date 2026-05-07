"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import LoginSignupPanel from "./LoginSignupPanel";
import WordleLogoTiles from "./WordleLogoTiles";

export default function ComingSoonLanding() {
  const [authOpen, setAuthOpen] = useState(false);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => setAuthOpen(false), []);

  /** Coming-soon stays in light theme; restores saved preference when leaving this page */
  useEffect(() => {
    const savedDark = typeof window !== "undefined" && localStorage.getItem("darkMode") === "true";
    document.documentElement.classList.remove("dark");
    return () => {
      document.documentElement.classList.toggle("dark", savedDark);
    };
  }, []);

  useEffect(() => {
    if (!authOpen) return;
    document.body.dataset.comingSoonModalOpen = "true";
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    queueMicrotask(() => closeBtnRef.current?.focus());
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      delete document.body.dataset.comingSoonModalOpen;
      document.removeEventListener("keydown", onKey);
    };
  }, [authOpen, close]);

  return (
    <main className="login-page coming-soon-landing">
      <div className="coming-soon-top-bar" aria-label="Coming soon extras">
        <button
          type="button"
          className="coming-soon-auth-trigger restart-button"
          onClick={() => setAuthOpen(true)}
        >
          Log in / Sign up
        </button>
      </div>

      <h1 className="sr-only">Wordle By Prav</h1>
      <WordleLogoTiles />
      <p className="coming-soon__subtitle">Coming soon</p>

      {authOpen && (
        <div className="coming-soon-auth-overlay">
          <button
            type="button"
            className="coming-soon-auth-backdrop"
            tabIndex={-1}
            onClick={close}
          />

          <div
            className="coming-soon-auth-dialog-shell"
            role="dialog"
            aria-modal="true"
            aria-label="Sign in or create an account"
            tabIndex={-1}
          >
            <div className="coming-soon-auth-card-frame">
              <button
                ref={closeBtnRef}
                type="button"
                className="coming-soon-auth-close"
                onClick={close}
                aria-label="Close sign in dialog"
              >
                <svg
                  width={20}
                  height={20}
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden
                >
                  <path
                    d="M6 6l12 12M18 6L6 18"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                  />
                </svg>
              </button>

              <LoginSignupPanel
                cardClassName="login-card--embedded-modal"
                onLoginSuccess={() => {
                  close();
                }}
              />
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
