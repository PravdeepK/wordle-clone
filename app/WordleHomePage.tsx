"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "../config/firebaseConfig";
import { getFirestore, collection, addDoc } from "firebase/firestore";
import * as Sentry from "@sentry/nextjs";
import { checkGuess } from "../lib/wordle";
import { validateWord } from "../lib/validateWord";
import { useGlobalGuessKeyboard } from "../hooks/useGlobalGuessKeyboard";
import { useFlipAnimation } from "../hooks/useFlipAnimation";
import VirtualKeyboard from "../components/VirtualKeyboard";
import AppHeader, { Icon } from "../components/AppHeader";
import { loadRecentWords, pushRecentWord } from "../lib/recentWords";

const db = getFirestore();
const MAX_TRIES = 6;

const fallbackPools: Record<number, string[]> = {
  3: ["CAT", "DOG", "SUN", "CUP", "BAG", "PEN", "KEY", "MAP", "BOX", "FAN"],
  4: ["LAMP", "FORK", "BOOK", "RING", "BOAT", "RAIN", "TREE", "SHOE", "DESK", "MOON"],
  5: ["STONE", "BREAD", "RIVER", "CHAIR", "CLOUD", "HORSE", "PLANT", "MUSIC", "KNIFE", "CANDY", "TIGER", "OCEAN", "WATCH", "SWORD", "PIANO"],
  6: ["PLANET", "RABBIT", "PENCIL", "GUITAR", "WINDOW", "GARDEN", "MONKEY", "CASTLE", "FOREST", "BRIDGE"],
  7: ["BLANKET", "KITCHEN", "DIAMOND", "BALLOON", "RAINBOW", "BISCUIT", "LIBRARY", "COMPASS", "OCTOPUS", "TRUMPET"],
  8: ["SCHEDULE", "ELEPHANT", "MOUNTAIN", "UMBRELLA", "COMPUTER", "DINOSAUR", "HOSPITAL", "SANDWICH", "PANCAKES", "AIRPLANE"],
  9: ["IMPORTANT", "CHOCOLATE", "WONDERFUL", "TELEPHONE", "BUTTERFLY", "NEWSPAPER", "SPAGHETTI", "ASTRONAUT", "SUBMARINE", "LIGHTNING"],
  10: ["STRAWBERRY", "HELICOPTER", "PLAYGROUND", "WATERMELON", "BASKETBALL", "SKATEBOARD", "TOOTHBRUSH", "BINOCULARS", "DICTIONARY", "CALCULATOR"],
};

function pickClientFallback(len: number, recent: string[]): string {
  const pool = fallbackPools[len] ?? fallbackPools[5];
  const recentSet = new Set(recent.map((w) => w.toUpperCase()));
  const fresh = pool.filter((w) => !recentSet.has(w));
  const choices = fresh.length > 0 ? fresh : pool;
  return choices[Math.floor(Math.random() * choices.length)];
}

export default function WordleHomePage() {
  const router = useRouter();

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
  const [userEmail, setUserEmail] = useState<string | null>(null);

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
    const isGuest = (() => {
      try { return sessionStorage.getItem("wordle:guest") === "1"; } catch { return false; }
    })();
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        if (isGuest) {
          setUsername("Guest");
          setUid(null);
          setUserEmail(null);
        } else {
          router.replace("/login");
        }
      } else if (!user.emailVerified && !isLocalDev) {
        await signOut(auth);
        router.replace("/login");
      } else {
        try { sessionStorage.removeItem("wordle:guest"); } catch {}
        setUsername(user.displayName || "Player");
        setUid(user.uid);
        setUserEmail(user.email || null);
      }
    });
    return () => unsub();
  }, [router]);

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
      Sentry.captureException(err);
    }
  };

  const fetchWord = async (wordLength?: number): Promise<boolean> => {
    const len = wordLength ?? difficulty;
    setLoading(true);
    setErrorMessage("");
    let success = false;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const recent = loadRecentWords();
        const res = await fetch("/api/word", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ length: len, recent }),
        });
        if (!res.ok) throw new Error("Bad response");
        const data = await res.json();
        if (data.word && data.word.length === len) {
          const upper = data.word.toUpperCase();
          setSecretWord(upper);
          pushRecentWord(upper);
          resetBoardState();
          success = true;
          break;
        }
        if (attempt === 3) {
          const fallback = pickClientFallback(len, recent);
          setSecretWord(fallback);
          pushRecentWord(fallback);
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

  return (
    <div className="page-wrapper">
      <AppHeader
        title="Wordle"
        onBack={phase === "playing" ? handleBackToSetup : undefined}
        onNewGame={phase === "playing" ? () => void fetchWord() : undefined}
        newGameDisabled={loading}
        feedbackIdentifier={userEmail || username || ""}
        greetingName={username}
      />

      <div className="game-content game-content--centered">
        <div className="game-stage">
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
                disabled={loading}
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
    </div>
  );
}
