"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "../config/firebaseConfig";
import { getFirestore, collection, addDoc } from "firebase/firestore";
import { checkGuess } from "../lib/wordle";
import { validateWord } from "../lib/validateWord";
import { useDarkMode } from "../hooks/useDarkMode";
import VirtualKeyboard from "../components/VirtualKeyboard";

const db = getFirestore();
const MAX_TRIES = 6;

const fallbacks: Record<number, string> = {
  3: "CAT", 4: "LAMP", 5: "STONE", 6: "PLANET",
  7: "BLANKET", 8: "SCHEDULE", 9: "IMPORTANT", 10: "STRAWBERRY",
};

export default function Home() {
  const router = useRouter();
  const { darkMode, toggleDarkMode } = useDarkMode();

  const [username, setUsername] = useState<string | null>(null);
  const [uid, setUid] = useState<string | null>(null);
  const [difficulty, setDifficulty] = useState(5);
  const [guesses, setGuesses] = useState<string[]>(Array(MAX_TRIES).fill(""));
  const [currentGuess, setCurrentGuess] = useState("");
  const [secretWord, setSecretWord] = useState("");
  const [gameOver, setGameOver] = useState(false);
  const [won, setWon] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [keyStatuses, setKeyStatuses] = useState<Record<string, string>>({});

  useEffect(() => {
    const isLocalDev = typeof window !== "undefined" && window.location.hostname === "localhost";
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace("/login");
      } else if (!user.emailVerified && !isLocalDev) {
        await signOut(auth);
        router.replace("/login");
      } else {
        setUsername(user.displayName || "Player");
        setUid(user.uid);
      }
    });
    return () => unsub();
  }, [router]);

  useEffect(() => {
    if (uid) fetchWord();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [difficulty, uid]);

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

  const fetchWord = async (attempt = 1) => {
    setLoading(true);
    setErrorMessage("");
    try {
      const res = await fetch("/api/word", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ length: difficulty }),
      });
      if (!res.ok) throw new Error("Bad response");
      const data = await res.json();
      if (!data.word || data.word.length !== difficulty) {
        if (attempt < 3) return fetchWord(attempt + 1);
        setSecretWord(fallbacks[difficulty] ?? "STONE");
        setGuesses(Array(MAX_TRIES).fill(""));
        setKeyStatuses({});
        setGameOver(false);
        setWon(false);
        setCurrentGuess("");
        return;
      }
      setSecretWord(data.word.toUpperCase());
      setGuesses(Array(MAX_TRIES).fill(""));
      setKeyStatuses({});
      setGameOver(false);
      setWon(false);
      setCurrentGuess("");
    } catch {
      if (attempt < 3) return fetchWord(attempt + 1);
      setErrorMessage("Could not load a word. Please refresh.");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = async (e: { key: string }) => {
    if (gameOver) return;
    if (e.key !== "Enter" || currentGuess.length !== difficulty) return;

    setErrorMessage("");
    if (!(await validateWord(currentGuess))) {
      setErrorMessage("Not a valid word! Please enter a real word.");
      return;
    }

    const newGuesses = [...guesses];
    const nextRow = newGuesses.findIndex((r) => r === "");
    if (nextRow !== -1) {
      newGuesses[nextRow] = currentGuess;
      setGuesses(newGuesses);

      const colors = checkGuess(currentGuess, secretWord);
      const newKeyStatuses = { ...keyStatuses };
      currentGuess.split("").forEach((letter, i) => {
        const c = colors[i];
        if (c.includes("green") || (c.includes("yellow") && newKeyStatuses[letter] !== "bg-green-500 text-white")) {
          newKeyStatuses[letter] = c;
        } else if (!newKeyStatuses[letter]) {
          newKeyStatuses[letter] = c;
        }
      });
      setKeyStatuses(newKeyStatuses);
    }

    if (currentGuess === secretWord) {
      await saveGameResult("win");
      setWon(true);
      setGameOver(true);
    } else if (newGuesses.filter((g) => g !== "").length >= MAX_TRIES) {
      await saveGameResult("lose");
      setGameOver(true);
    }
    setCurrentGuess("");
  };

  const handleVirtualKey = async (key: string) => {
    if (gameOver) return;
    if (key === "ENTER") await handleKeyPress({ key: "Enter" });
    else if (key === "⌫") setCurrentGuess((p) => p.slice(0, -1));
    else if (currentGuess.length < difficulty) setCurrentGuess((p) => p + key);
  };

  if (loading) return <div className="flex items-center justify-center min-h-screen"><p>Loading...</p></div>;
  if (!username) return null;

  return (
    <div className="flex flex-col justify-start items-center min-h-screen w-full text-center gap-3 px-2">
      <h1 className="title">Wordle Clone</h1>
      <p className="welcome-text">Welcome, {username}!</p>

      <div className="flex items-center gap-4">
        <label>Difficulty: {difficulty} letters</label>
        <input
          type="range"
          min="3"
          max="10"
          value={difficulty}
          onChange={(e) => setDifficulty(parseInt(e.target.value))}
        />
      </div>

      <label className="dark-mode-switch">
        <input type="checkbox" checked={darkMode} onChange={toggleDarkMode} />
        <span className="slider"></span>
      </label>

      <div className="grid">
        {guesses.map((guess, rowIndex) => {
          const tileColors = guess
            ? checkGuess(guess, secretWord)
            : Array(difficulty).fill("border-gray-400");
          return (
            <div key={rowIndex} className="grid-row">
              {Array.from({ length: difficulty }).map((_, colIndex) => (
                <div key={colIndex} className={`cell ${tileColors[colIndex]}`}>
                  {guess[colIndex] || ""}
                </div>
              ))}
            </div>
          );
        })}
      </div>

      <input
        type="text"
        value={currentGuess}
        onChange={(e) => setCurrentGuess(e.target.value.toUpperCase())}
        onKeyDown={handleKeyPress}
        className="input-box"
        maxLength={difficulty}
      />

      <VirtualKeyboard onKey={handleVirtualKey} keyStatuses={keyStatuses} />

      {errorMessage && <p className="error-message">{errorMessage}</p>}
      {gameOver && (
        <p className="game-over">
          {won ? "Congrats! You guessed the word!" : `Game Over! The word was ${secretWord}`}
        </p>
      )}

      <div className="flex flex-col gap-1 mt-2">
        <button
          onClick={async () => {
            if (!won && gameOver) await saveGameResult("lose");
            fetchWord();
          }}
          className="restart-button"
        >
          Restart Game
        </button>
        <button onClick={() => router.push("/custom-word")} className="scoreboard-button">Custom Word</button>
        <button onClick={() => router.push("/scoreboard")} className="scoreboard-button">View Scoreboard</button>
        <button onClick={() => router.push("/multiplayer")} className="scoreboard-button">Multiplayer Mode</button>
        <button className="logout-button" onClick={async () => { await signOut(auth); router.replace("/login"); }}>
          Logout
        </button>
      </div>
    </div>
  );
}
