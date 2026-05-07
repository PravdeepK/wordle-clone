"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "../config/firebaseConfig";
import { getFirestore, collection, addDoc } from "firebase/firestore";
import { checkGuess } from "../lib/wordle";
import { validateWord } from "../lib/validateWord";
import { useDarkMode } from "../hooks/useDarkMode";
import { useGlobalGuessKeyboard } from "../hooks/useGlobalGuessKeyboard";
import { useFlipAnimation } from "../hooks/useFlipAnimation";
import VirtualKeyboard from "../components/VirtualKeyboard";
import FeedbackModal from "../components/FeedbackModal";

const db = getFirestore();
const MAX_TRIES = 6;

const fallbacks: Record<number, string> = {
  3: "CAT", 4: "LAMP", 5: "STONE", 6: "PLANET",
  7: "BLANKET", 8: "SCHEDULE", 9: "IMPORTANT", 10: "STRAWBERRY",
};

/* ── Inline icons (stroke=currentColor so they match theme) ── */
const Icon = {
  Menu: (p: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <line x1="4" y1="7" x2="20" y2="7" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="17" x2="20" y2="17" />
    </svg>
  ),
  Close: (p: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" />
    </svg>
  ),
  Back: (p: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
    </svg>
  ),
  Refresh: (p: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10" /><path d="M20.49 15A9 9 0 0 1 5.64 18.36L1 14" />
    </svg>
  ),
  Pencil: (p: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  ),
  Trophy: (p: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M8 21h8" /><path d="M12 17v4" />
      <path d="M7 4h10v5a5 5 0 0 1-10 0V4z" />
      <path d="M17 5h3v3a3 3 0 0 1-3 3" /><path d="M7 5H4v3a3 3 0 0 0 3 3" />
    </svg>
  ),
  Users: (p: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  Chat: (p: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  ),
  Sun: (p: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  ),
  Moon: (p: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  ),
  Logout: (p: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  ),
};

export default function WordleHomePage() {
  const router = useRouter();
  const { darkMode, toggleDarkMode } = useDarkMode();

  const [username, setUsername] = useState<string | null>(null);
  const [uid, setUid] = useState<string | null>(null);
  const [phase, setPhase] = useState<"setup" | "playing">("setup");
  const [pendingDifficulty, setPendingDifficulty] = useState(5);
  const [difficulty, setDifficulty] = useState(5);
  const [guesses, setGuesses] = useState<string[]>(Array(MAX_TRIES).fill(""));
  const [currentGuess, setCurrentGuess] = useState("");
  const [secretWord, setSecretWord] = useState("");
  const [gameOver, setGameOver] = useState(false);
  const [won, setWon] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [keyStatuses, setKeyStatuses] = useState<Record<string, string>>({});
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const {
    tileReveal,
    animatingRow,
    shakeRow,
    winRow,
    runFlip,
    triggerShake,
    setWinRow,
    resetAnimation,
  } = useFlipAnimation();

  useEffect(() => {
    const isLocalDev = process.env.NODE_ENV === "development";
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace("/login");
      } else if (!user.emailVerified && !isLocalDev) {
        await signOut(auth);
        router.replace("/login");
      } else {
        setUsername(user.displayName || "Player");
        setUid(user.uid);
        setUserEmail(user.email || null);
      }
    });
    return () => unsub();
  }, [router]);

  // Close menu on outside click / escape
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMenuOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const resetBoardState = () => {
    resetAnimation();
    setGuesses(Array(MAX_TRIES).fill(""));
    setKeyStatuses({});
    setGameOver(false);
    setWon(false);
    setCurrentGuess("");
    setErrorMessage("");
  };

  const saveGameResult = async (result: string) => {
    if (!uid || !secretWord) return;
    try {
      await addDoc(
        collection(db, "users", uid, "games", difficulty.toString(), "entries"),
        { word: secretWord, result, timestamp: new Date() }
      );
    } catch (err) {
      console.error("Failed to save game result:", err);
    }
  };

  const fetchWord = async (wordLength?: number): Promise<boolean> => {
    const len = wordLength ?? difficulty;
    setLoading(true);
    setErrorMessage("");
    let success = false;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const res = await fetch("/api/word", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ length: len }),
        });
        if (!res.ok) throw new Error("Bad response");
        const data = await res.json();
        if (data.word && data.word.length === len) {
          setSecretWord(data.word.toUpperCase());
          resetBoardState();
          success = true;
          break;
        }
        if (attempt === 3) {
          setSecretWord((fallbacks[len] ?? "STONE").toUpperCase());
          resetBoardState();
          success = true;
          break;
        }
      } catch {
        if (attempt === 3) {
          setErrorMessage("Could not load a word. Please refresh.");
        }
      }
    }
    setLoading(false);
    return success;
  };

  const handleStartGame = async () => {
    setDifficulty(pendingDifficulty);
    const ok = await fetchWord(pendingDifficulty);
    if (ok) setPhase("playing");
  };

  const handleBackToSetup = () => {
    const midGame = phase === "playing" && secretWord && !gameOver && guesses.some((g) => g !== "");
    if (midGame && !window.confirm("Abandon this game and pick a new word length?")) return;
    setPhase("setup");
    setPendingDifficulty(difficulty);
    setSecretWord("");
    resetBoardState();
  };

  const handleKeyPress = async (e: { key: string }) => {
    if (gameOver || animatingRow !== null) return;
    if (e.key !== "Enter" || currentGuess.length !== difficulty) return;

    setErrorMessage("");
    if (!(await validateWord(currentGuess))) {
      setErrorMessage("Not a valid word! Please enter a real word.");
      const currentRow = guesses.filter((g) => g !== "").length;
      triggerShake(currentRow);
      return;
    }

    const newGuesses = [...guesses];
    const nextRow = newGuesses.findIndex((r) => r === "");
    if (nextRow === -1) return;

    newGuesses[nextRow] = currentGuess;
    setGuesses(newGuesses);
    setCurrentGuess("");

    const colors = checkGuess(currentGuess, secretWord);
    const guessCount = newGuesses.filter((g) => g !== "").length;
    const submittedGuess = currentGuess;

    runFlip({
      rowIndex: nextRow,
      colors,
      guess: submittedGuess,
      wordLength: difficulty,
      onFlipDone: (flipColors, flipGuess) => {
        setKeyStatuses((prev) => {
          const next = { ...prev };
          flipGuess.split("").forEach((letter, i) => {
            const c = flipColors[i];
            if (c.includes("green") || (c.includes("yellow") && next[letter] !== "bg-green-500 text-white")) {
              next[letter] = c;
            } else if (!next[letter]) {
              next[letter] = c;
            }
          });
          return next;
        });
        if (flipGuess === secretWord) {
          void saveGameResult("win");
          setWon(true);
          setGameOver(true);
          setWinRow(nextRow);
        } else if (guessCount >= MAX_TRIES) {
          void saveGameResult("lose");
          setGameOver(true);
        }
      },
    });
  };

  const handleVirtualKey = async (key: string) => {
    if (gameOver) return;
    if (key === "ENTER") await handleKeyPress({ key: "Enter" });
    else if (key === "⌫") setCurrentGuess((p) => p.slice(0, -1));
    else if (currentGuess.length < difficulty) setCurrentGuess((p) => p + key);
  };

  useGlobalGuessKeyboard({
    enabled: phase === "playing" && !gameOver && !loading,
    maxLength: difficulty,
    setCurrentGuess,
    onEnter: () => handleKeyPress({ key: "Enter" }),
  });

  if (!username) return null;

  const gridLength = phase === "setup" ? pendingDifficulty : difficulty;
  const tileSize = Math.min(62, Math.floor((520 - (gridLength - 1) * 5) / gridLength));

  const closeMenu = () => setMenuOpen(false);
  const go = (path: string) => { closeMenu(); router.push(path); };

  type MenuItemProps = { icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean; disabled?: boolean };
  const MenuItem = ({ icon, label, onClick, danger, disabled }: MenuItemProps) => (
    <button
      type="button"
      className={`menu-item ${danger ? "menu-item--danger" : ""}`}
      onClick={onClick}
      disabled={disabled}
    >
      <span className="menu-item-icon">{icon}</span>
      <span className="menu-item-label">{label}</span>
    </button>
  );

  return (
    <div className="page-wrapper">

      {/* Sticky Header */}
      <header className="game-header game-header--app">
        <div className="game-header-left">
          {phase === "playing" && (
            <button
              type="button"
              className="header-icon-btn"
              onClick={handleBackToSetup}
              aria-label="Back to setup"
              title="Back"
            >
              <Icon.Back />
            </button>
          )}
        </div>
        <h1 className="title">Wordle</h1>
        <div className="game-header-right" ref={menuRef}>
          <button
            type="button"
            className="header-icon-btn"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label="Open menu"
            aria-expanded={menuOpen}
            title="Menu"
          >
            {menuOpen ? <Icon.Close /> : <Icon.Menu />}
          </button>
          {menuOpen && (
            <div className="menu-panel" role="menu">
              <div className="menu-greeting">
                <span className="menu-greeting-label">Signed in as</span>
                <span className="menu-greeting-name">{username}</span>
              </div>
              <div className="menu-divider" />
              {phase === "playing" && (
                <MenuItem
                  icon={<Icon.Refresh />}
                  label="New game"
                  disabled={loading}
                  onClick={() => { closeMenu(); void fetchWord(); }}
                />
              )}
              <MenuItem icon={<Icon.Pencil />} label="Custom word" onClick={() => go("/custom-word")} />
              <MenuItem icon={<Icon.Trophy />} label="Scoreboard" onClick={() => go("/scoreboard")} />
              <MenuItem icon={<Icon.Users />} label="Multiplayer" onClick={() => go("/multiplayer")} />
              <MenuItem icon={<Icon.Chat />} label="Feedback" onClick={() => { closeMenu(); setFeedbackOpen(true); }} />
              <div className="menu-divider" />
              <MenuItem
                icon={darkMode ? <Icon.Sun /> : <Icon.Moon />}
                label={darkMode ? "Light mode" : "Dark mode"}
                onClick={() => { toggleDarkMode(); }}
              />
              <MenuItem
                icon={<Icon.Logout />}
                label="Logout"
                danger
                onClick={async () => { closeMenu(); await signOut(auth); router.replace("/login"); }}
              />
            </div>
          )}
        </div>
      </header>

      <FeedbackModal
        open={feedbackOpen}
        onClose={() => setFeedbackOpen(false)}
        defaultIdentifier={userEmail || username || ""}
      />

      {/* Main Content */}
      <div className="game-content">
        {phase === "setup" ? (
          <div className="setup-panel setup-panel--card">
            <p className="welcome-text">Welcome, {username}</p>
            <p className="setup-label">Pick a word length</p>
            <div className="setup-length-number">{pendingDifficulty}</div>
            <div
              className="setup-length-tiles"
              style={{ "--setup-tile-size": `${Math.min(46, Math.max(30, Math.floor(420 / pendingDifficulty)))}px` } as React.CSSProperties}
              aria-hidden="true"
            >
              {Array.from({ length: pendingDifficulty }).map((_, index) => (
                <div key={index} className="setup-length-tile" />
              ))}
            </div>
            <div className="setup-range-row">
              <span>3</span>
              <input
                type="range"
                min={3}
                max={10}
                value={pendingDifficulty}
                onChange={(e) => setPendingDifficulty(parseInt(e.target.value, 10))}
                aria-label="Word length"
                style={{
                  background: `linear-gradient(to right, var(--color-text) 0%, var(--color-text) ${((pendingDifficulty - 3) / 7) * 100}%, var(--color-tile-empty) ${((pendingDifficulty - 3) / 7) * 100}%, var(--color-tile-empty) 100%)`,
                }}
              />
              <span>10</span>
            </div>
            <button
              type="button"
              className="restart-button setup-start-btn"
              disabled={loading || !uid}
              onClick={() => void handleStartGame()}
            >
              {loading ? "Loading…" : "Start Game"}
            </button>
            {errorMessage && <p className="error-message">{errorMessage}</p>}
          </div>
        ) : (
          <>
            <div className="playing-meta">
              <span>{difficulty} letters</span>
            </div>

            <div className="grid" style={{ '--tile-size': `${tileSize}px` } as React.CSSProperties}>
              {guesses.map((guess, rowIndex) => {
                const committedCount  = guesses.filter((g) => g !== "").length;
                const isCurrentRow    = rowIndex === committedCount && !gameOver;
                const isAnimating     = animatingRow === rowIndex;
                const displayGuess    = isCurrentRow ? currentGuess : guess;
                const revealedColors  = tileReveal[rowIndex] ?? [];

                return (
                  <div
                    key={rowIndex}
                    className={`grid-row ${shakeRow === rowIndex ? "grid-row--shake" : ""} ${winRow === rowIndex ? "grid-row--bounce" : ""}`}
                  >
                    {Array.from({ length: difficulty }).map((_, colIndex) => {
                      const letter = displayGuess[colIndex] || "";
                      const hasFilled = isCurrentRow && !!letter;

                      const colorClass = isCurrentRow
                        ? ""
                        : isAnimating
                        ? (revealedColors[colIndex] ?? "")
                        : (tileReveal[rowIndex]?.[colIndex] ?? (guess ? checkGuess(guess, secretWord)[colIndex] : ""));

                      let flipClass = "";
                      let flipStyle: React.CSSProperties = {};
                      if (isAnimating && guess) {
                        if (!revealedColors[colIndex]) {
                          flipClass = "cell--flip-in";
                          flipStyle = { animationDelay: `${colIndex * 300}ms` };
                        } else {
                          flipClass = "cell--flip-out";
                        }
                      }

                      return (
                        <div
                          key={colIndex}
                          className={`cell ${colorClass} ${hasFilled ? "cell--filled" : ""} ${flipClass}`}
                          style={flipStyle}
                        >
                          {letter}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>

            <input
              type="text"
              data-global-guess-keys
              value={currentGuess}
              onChange={(e) => setCurrentGuess(e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, difficulty))}
              className="hidden-input"
              maxLength={difficulty}
              autoFocus
              aria-label="Type your guess"
            />

            <VirtualKeyboard onKey={handleVirtualKey} keyStatuses={keyStatuses} />

            {errorMessage && <p className="error-message">{errorMessage}</p>}

            {gameOver && (
              <div className="game-over-card">
                <p className={won ? "win-message" : "game-over"}>
                  {won ? "Brilliant!" : `The word was ${secretWord}`}
                </p>
                <button
                  type="button"
                  className="restart-button"
                  disabled={loading}
                  onClick={() => void fetchWord()}
                >
                  <Icon.Refresh />
                  <span>New Game</span>
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
