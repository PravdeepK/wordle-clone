"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../../config/firebaseConfig";
import { getFirestore, collection, addDoc } from "firebase/firestore";
import { checkGuess } from "../../lib/wordle";
import { validateWord } from "../../lib/validateWord";
import VirtualKeyboard from "../../components/VirtualKeyboard";
import useWebSocket from "./useWebSocket";

const MAX_TRIES = 6;

export default function MultiplayerPage() {
  const router = useRouter();
  const db = getFirestore();

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
      if (!(await validateWord(currentGuess))) return alert("❌ Not a valid word.");

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

  const renderBoard = (rows: string[], title: string, reveal: boolean) => (
    <div className="flex flex-col items-center gap-1">
      <h3 className="font-bold">{title}</h3>
      <div className="grid">
        {rows.map((row, ri) => {
          const cols = row === "" ? Array(5).fill("border-gray-400") : checkGuess(row, word);
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
    <div className="flex flex-col items-center min-h-screen gap-4 p-4 text-center">
      <h1 className="title">MULTIPLAYER</h1>

      {wsError && <p className="error-message">{wsError}</p>}

      {!roomId ? (
        <div className="flex flex-col gap-2 mt-2">
          <button className="scoreboard-button" onClick={() => sendJsonMessage("create-room")} disabled={!connected}>
            Start Multiplayer Game
          </button>
          <button className="scoreboard-button" onClick={() => {
            const id = prompt("Enter Room ID:");
            if (id) sendJsonMessage("join-room", { roomId: id.trim() });
          }} disabled={!connected}>
            Join a Room
          </button>
        </div>
      ) : (
        <>
          <p><strong>Room:</strong> {roomId}</p>
          <div className="flex flex-col md:flex-row gap-8">
            {renderBoard(guesses, "Your Board", true)}
            {renderBoard(opponentGuesses, "Opponent Board", youDone && themDone)}
          </div>

          <input
            className="input-box"
            type="text"
            value={currentGuess}
            readOnly
            maxLength={5}
            placeholder={youDone ? "" : "Type your guess…"}
            onKeyDown={e => {
              if (e.key === "Enter") handleKey("ENTER");
              else if (e.key === "Backspace") handleKey("⌫");
              else if (/^[a-zA-Z]$/.test(e.key)) handleKey(e.key.toUpperCase());
            }}
          />

          <VirtualKeyboard onKey={handleKey} keyStatuses={keyStatuses} disabled={youDone} />

          {gameOver && (
            <p className="game-over">
              {won ? "🎉 Congrats, you beat it!" : `😞 You failed! The word was ${word}`}
            </p>
          )}
        </>
      )}

      <button className="restart-button mt-4" onClick={() => router.push("/")}>
        Back to Main Game
      </button>
    </div>
  );
}
