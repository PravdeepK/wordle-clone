"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../../config/firebaseConfig";
import { getFirestore, collection, addDoc } from "firebase/firestore";
import { checkGuess } from "../../lib/wordle";
import { validateWord } from "../../lib/validateWord";
import { useDarkMode } from "../../hooks/useDarkMode";
import VirtualKeyboard from "../../components/VirtualKeyboard";
import useWebSocket from "./useWebSocket";
import { useGlobalGuessKeyboard } from "../../hooks/useGlobalGuessKeyboard";

const MAX_TRIES = 6;

export default function MultiplayerPage() {
  const router = useRouter();
  const db = getFirestore();
  useDarkMode();

  const [uid, setUid] = useState<string | null>(null);
  const [roomId, setRoomId] = useState("");
  const [word, setWord] = useState("");
  const [guesses, setGuesses] = useState<string[]>(Array(MAX_TRIES).fill(""));
  const [opponentGuesses, setOpponentGuesses] = useState<string[]>(Array(MAX_TRIES).fill(""));
  const [youDone, setYouDone] = useState(false);
  const [themDone, setThemDone] = useState(false);
  const [currentGuess, setCurrentGuess] = useState("");
  const [gameOver, setGameOver] = useState(false);
  const [won, setWon] = useState(false);
  const [keyStatuses, setKeyStatuses] = useState<Record<string, string>>({});
  const [joinRoomId, setJoinRoomId] = useState("");
  const [showJoinInput, setShowJoinInput] = useState(false);
  const [multiError, setMultiError] = useState("");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (!u) router.replace("/login");
      else setUid(u.uid);
    });
    return () => unsub();
  }, [router]);

  const { sendJsonMessage, connected, wsError } = useWebSocket({
    onRoomJoined: (newRoomId, newWord) => {
      setRoomId(newRoomId);
      setWord(newWord.toUpperCase());
    },
    onGuestJoined: () => {},
    onOpponentGuess: (guess) => {
      const g = guess.toUpperCase();
      setOpponentGuesses(o => {
        const n = [...o];
        const idx = n.findIndex(x => x === "");
        if (idx !== -1) n[idx] = g;
        return n;
      });
    },
    onPlayerFinished: () => setThemDone(true),
  });

  const saveResult = async (result: string) => {
    if (!uid || !word) return;
    try {
      await addDoc(
        collection(db, "users", uid, "games", "multiplayer", "entries"),
        { word, result, multiplayer: true, timestamp: new Date() }
      );
    } catch (e) {
      console.error("Failed to save result:", e);
    }
  };

  const handleKey = async (key: string) => {
    if (gameOver || !word || youDone) return;

    if (key === "ENTER") {
      if (currentGuess.length !== 5) return;
      if (!(await validateWord(currentGuess))) {
        setMultiError("Not a valid word.");
        setTimeout(() => setMultiError(""), 2000);
        return;
      }

      const guessU = currentGuess.toUpperCase();
      const nextGuesses = [...guesses];
      const idx = nextGuesses.findIndex(x => x === "");
      if (idx !== -1) nextGuesses[idx] = guessU;
      setGuesses(nextGuesses);

      const cols = checkGuess(guessU, word);
      setKeyStatuses(ks => {
        const n = { ...ks };
        guessU.split("").forEach((ltr, i) => {
          const c = cols[i];
          if (c.includes("green") || (c.includes("yellow") && n[ltr] !== "bg-green-500 text-white")) {
            n[ltr] = c;
          } else if (!n[ltr]) {
            n[ltr] = c;
          }
        });
        return n;
      });

      sendJsonMessage("send-guess", { roomId, guess: guessU });

      const wonIt = guessU === word;
      const outOfTries = nextGuesses.every(g => g !== "");

      if (wonIt || outOfTries) {
        setGameOver(true);
        setWon(wonIt);
        setYouDone(true);
        sendJsonMessage("player-finished", { roomId });
        await saveResult(wonIt ? "win" : "lose");
      }
      setCurrentGuess("");
    } else if (key === "⌫") {
      setCurrentGuess(c => c.slice(0, -1));
    } else if (/^[A-Z]$/.test(key) && currentGuess.length < 5) {
      setCurrentGuess(c => c + key);
    }
  };

  useGlobalGuessKeyboard({
    enabled: !!roomId && !!word && !gameOver && !youDone,
    maxLength: 5,
    setCurrentGuess,
    onEnter: () => void handleKey("ENTER"),
  });

  const renderBoard = (rows: string[], title: string, reveal: boolean) => (
    <div className="flex flex-col items-center gap-1">
      <p className="board-label">{title}</p>
      <div className="grid multiplayer-board-grid">
        {rows.map((row, ri) => {
          const cols = row === "" ? Array(5).fill("") : checkGuess(row, word);
          return (
            <div key={ri} className="grid-row">
              {cols.map((c, ci) => (
                <div key={ci} className={`cell ${c}`}>
                  {reveal && row ? row[ci] : ""}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="page-wrapper">
      <header className="game-header">
        <h1 className="title">Multiplayer</h1>
      </header>

      <div className="game-content">
        {wsError && <p className="error-message">{wsError}</p>}

        {!roomId ? (
          <div className="multiplayer-lobby">
            <button
              className="scoreboard-button"
              onClick={() => sendJsonMessage("create-room")}
              disabled={!connected}
            >
              Start Multiplayer Game
            </button>

            {showJoinInput ? (
              <div className="room-id-join">
                <input
                  className="input-box"
                  type="text"
                  placeholder="Enter Room ID"
                  value={joinRoomId}
                  onChange={(e) => setJoinRoomId(e.target.value.trim().toUpperCase())}
                  autoFocus
                />
                <button
                  className="scoreboard-button"
                  disabled={!joinRoomId || !connected}
                  onClick={() => {
                    sendJsonMessage("join-room", { roomId: joinRoomId });
                    setShowJoinInput(false);
                  }}
                >
                  Join
                </button>
                <button className="restart-button" onClick={() => setShowJoinInput(false)}>
                  Cancel
                </button>
              </div>
            ) : (
              <button
                className="scoreboard-button"
                disabled={!connected}
                onClick={() => setShowJoinInput(true)}
              >
                Join a Room
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="room-badge">Room: {roomId}</div>

            {multiError && <p className="error-message">{multiError}</p>}

            <div className="multiplayer-boards">
              {renderBoard(guesses, "Your Board", true)}
              {renderBoard(opponentGuesses, "Opponent", youDone && themDone)}
            </div>

            <input
              className="hidden-input"
              type="text"
              data-global-guess-keys
              value={currentGuess}
              onChange={(e) => setCurrentGuess(e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 5))}
              autoFocus
              aria-label="Type your guess"
            />

            <VirtualKeyboard onKey={handleKey} keyStatuses={keyStatuses} disabled={youDone} />

            {gameOver && (
              <p className={won ? "win-message" : "game-over"}>
                {won ? "Brilliant!" : `The word was ${word}`}
              </p>
            )}
          </>
        )}

        <button className="restart-button" onClick={() => router.push("/")}>
          Back to Main Game
        </button>
      </div>
    </div>
  );
}
