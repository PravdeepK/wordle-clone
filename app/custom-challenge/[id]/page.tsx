"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getFirestore, doc, getDoc, deleteDoc, collection, addDoc } from "firebase/firestore";
import { auth } from "../../../config/firebaseConfig";
import { onAuthStateChanged } from "firebase/auth";
import { checkGuess } from "../../../lib/wordle";
import { validateWord } from "../../../lib/validateWord";
import { useDarkMode } from "../../../hooks/useDarkMode";
import { useGlobalGuessKeyboard } from "../../../hooks/useGlobalGuessKeyboard";
import { useFlipAnimation } from "../../../hooks/useFlipAnimation";
import VirtualKeyboard from "../../../components/VirtualKeyboard";
import AppHeader from "../../../components/AppHeader";
import * as Sentry from "@sentry/nextjs";

const db = getFirestore();
const MAX_TRIES = 6;

export default function CustomChallengePage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  useDarkMode();

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

  const {
    tileReveal,
    animatingRow,
    shakeRow,
    winRow,
    runFlip,
    triggerShake,
    setWinRow,
  } = useFlipAnimation();

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      Sentry.captureException(e);
    }
  };

  const handleKeyPress = async (e: { key: string }) => {
    if (gameOver || animatingRow !== null) return;
    if (e.key !== "Enter" || currentGuess.length !== secretWord.length) return;

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
      wordLength: secretWord.length,
      onFlipDone: (flipColors, flipGuess) => {
        // Update keyboard colours
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
        // Win / lose
        if (flipGuess === secretWord) {
          void saveResult("win");
          setWon(true);
          setGameOver(true);
          setWinRow(nextRow);
        } else if (guessCount >= MAX_TRIES) {
          void saveResult("lose");
          setGameOver(true);
        }
      },
    });
  };

  const handleVirtualKey = async (key: string) => {
    if (gameOver || animatingRow !== null) return;
    if (key === "ENTER") await handleKeyPress({ key: "Enter" });
    else if (key === "⌫") setCurrentGuess((p) => p.slice(0, -1));
    else if (currentGuess.length < secretWord.length) setCurrentGuess((p) => p + key);
  };

  useGlobalGuessKeyboard({
    enabled: ready && !gameOver && !!secretWord && animatingRow === null,
    maxLength: secretWord.length || 5,
    setCurrentGuess,
    onEnter: () => handleKeyPress({ key: "Enter" }),
  });

  if (challengeExpired) {
    return (
      <div className="page-wrapper">
        <AppHeader title="Challenge expired" titleShort="Expired" backHref="/" />
        <div className="game-content game-content--centered">
          <div className="game-stage">
            <p style={{ color: "var(--color-text-muted)" }}>
              This challenge link has already been used or does not exist.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!ready) return null;

  const wordLen = secretWord.length;
  const tileSize = Math.min(62, Math.floor((460 - (wordLen - 1) * 5) / wordLen));

  return (
    <div className="page-wrapper">
      <AppHeader title="Custom challenge" titleShort="Custom" backHref="/" />

      <div className="game-content game-content--centered">
        <div className="game-stage">
        <div className="grid" style={{ '--tile-size': `${tileSize}px` } as React.CSSProperties}>
          {guesses.map((guess, rowIndex) => {
            const committedCount = guesses.filter((g) => g !== "").length;
            const isCurrentRow   = rowIndex === committedCount && !gameOver;
            const isAnimating    = animatingRow === rowIndex;
            const displayGuess   = isCurrentRow ? currentGuess : guess;
            const revealedColors = tileReveal[rowIndex] ?? [];

            return (
              <div
                key={rowIndex}
                className={`grid-row ${shakeRow === rowIndex ? "grid-row--shake" : ""} ${winRow === rowIndex ? "grid-row--bounce" : ""}`}
              >
                {Array.from({ length: wordLen }).map((_, colIndex) => {
                  const letter    = displayGuess[colIndex] || "";
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

        {/* Hidden keyboard capture input */}
        <input
          type="text"
          data-global-guess-keys
          value={currentGuess}
          onChange={(e) =>
            setCurrentGuess(e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, wordLen))
          }
          className="hidden-input"
          maxLength={wordLen}
          autoFocus
          aria-label="Type your guess"
        />

        <VirtualKeyboard onKey={handleVirtualKey} keyStatuses={keyStatuses} />

        {errorMessage && <p className="error-message">{errorMessage}</p>}

        {gameOver && (
          <p className={won ? "win-message" : "game-over"}>
            {won ? "Brilliant!" : `The word was ${secretWord}`}
          </p>
        )}

        <button onClick={() => router.push("/")} className="restart-button">Back to Game</button>
        </div>
      </div>
    </div>
  );
}
