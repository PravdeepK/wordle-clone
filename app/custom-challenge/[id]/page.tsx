"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getFirestore, doc, getDoc, deleteDoc, collection, addDoc } from "firebase/firestore";
import { auth } from "../../../config/firebaseConfig";
import { onAuthStateChanged } from "firebase/auth";
import { checkGuess } from "../../../lib/wordle";
import { validateWord } from "../../../lib/validateWord";
import { useDarkMode } from "../../../hooks/useDarkMode";
import VirtualKeyboard from "../../../components/VirtualKeyboard";

const db = getFirestore();
const MAX_TRIES = 6;

export default function CustomChallengePage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const { darkMode, toggleDarkMode } = useDarkMode();

  const [uid, setUid] = useState<string | null>(null);
  const [secretWord, setSecretWord] = useState("");
  const [guesses, setGuesses] = useState<string[]>(Array(MAX_TRIES).fill(""));
  const [currentGuess, setCurrentGuess] = useState("");
  const [keyStatuses, setKeyStatuses] = useState<Record<string, string>>({});
  const [gameOver, setGameOver] = useState(false);
  const [won, setWon] = useState(false);
  const [challengeExpired, setChallengeExpired] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) { router.push("/login"); return; }
      setUid(user.uid);

      const docSnap = await getDoc(doc(db, "customChallenges", id));
      if (docSnap.exists()) {
        setSecretWord((docSnap.data().word as string).toUpperCase());
        setReady(true);
      } else {
        setChallengeExpired(true);
      }
    });
    return () => unsub();
  }, [id]);

  const saveResult = async (result: string) => {
    if (!uid || !secretWord) return;
    try {
      await addDoc(
        collection(db, "users", uid, "games", "custom", "entries"),
        { word: secretWord, result, timestamp: new Date() }
      );
      await deleteDoc(doc(db, "customChallenges", id));
    } catch (e) {
      console.error("Failed to save result:", e);
    }
  };

  const handleKeyPress = async (e: { key: string }) => {
    if (gameOver) return;
    if (e.key !== "Enter" || currentGuess.length !== secretWord.length) return;

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
      await saveResult("win");
      setWon(true);
      setGameOver(true);
    } else if (newGuesses.filter((g) => g !== "").length >= MAX_TRIES) {
      await saveResult("lose");
      setGameOver(true);
    }
    setCurrentGuess("");
  };

  const handleVirtualKey = async (key: string) => {
    if (gameOver) return;
    if (key === "ENTER") await handleKeyPress({ key: "Enter" });
    else if (key === "⌫") setCurrentGuess((p) => p.slice(0, -1));
    else if (currentGuess.length < secretWord.length) setCurrentGuess((p) => p + key);
  };

  if (challengeExpired) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-6 text-center">
        <h1 className="title text-red-500">Challenge Expired</h1>
        <p className="text-white">This challenge link has already been used or does not exist.</p>
        <button className="restart-button" onClick={() => router.push("/")}>Back to Game</button>
      </div>
    );
  }

  if (!ready) return null;

  return (
    <div className="flex flex-col justify-start items-center min-h-screen w-full text-center gap-3 px-2">
      <h1 className="title">Custom Challenge</h1>

      <label className="dark-mode-switch">
        <input type="checkbox" checked={darkMode} onChange={toggleDarkMode} />
        <span className="slider"></span>
      </label>

      <div className="grid">
        {guesses.map((guess, rowIndex) => {
          const tileColors = guess
            ? checkGuess(guess, secretWord)
            : Array(secretWord.length).fill("border-gray-400");
          return (
            <div key={rowIndex} className="grid-row">
              {Array.from({ length: secretWord.length }).map((_, colIndex) => (
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
        maxLength={secretWord.length}
      />

      <VirtualKeyboard onKey={handleVirtualKey} keyStatuses={keyStatuses} />

      {errorMessage && <p className="error-message">{errorMessage}</p>}
      {gameOver && (
        <p className="game-over">
          {won ? "Congrats! You guessed the word!" : `Game Over! The word was ${secretWord}`}
        </p>
      )}

      <div className="flex flex-col gap-1 mt-2">
        <button onClick={() => router.push("/")} className="restart-button">Back to Game</button>
      </div>
    </div>
  );
}
