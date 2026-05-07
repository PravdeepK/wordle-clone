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
import { useFlipAnimation } from "../../hooks/useFlipAnimation";

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

  const youAnim = useFlipAnimation();
  const themAnim = useFlipAnimation();

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
      let idxUsed = -1;
      setOpponentGuesses(o => {
        const idx = o.findIndex(x => x === "");
        if (idx === -1) return o;
        idxUsed = idx;
        const n = [...o];
        n[idx] = g;
        return n;
      });
      if (idxUsed !== -1) {
        themAnim.runFlip({
          rowIndex: idxUsed,
          colors: checkGuess(g, word),
          guess: g,
          wordLength: 5,
          onFlipDone: () => {},
        });
      }
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
    if (gameOver || !word || youDone || youAnim.animatingRow !== null) return;

    if (key === "ENTER") {
      if (currentGuess.length !== 5) return;
      if (!(await validateWord(currentGuess))) {
        setMultiError("Not a valid word.");
        setTimeout(() => setMultiError(""), 2000);
        return;
      }

      const guessU = currentGuess.toUpperCase();
      const nextGuesses = [...guesses];
      const rowIdx = nextGuesses.findIndex(x => x === "");
      if (rowIdx === -1) return;
      nextGuesses[rowIdx] = guessU;
      setGuesses(nextGuesses);
      setCurrentGuess("");

      const cols = checkGuess(guessU, word);
      sendJsonMessage("send-guess", { roomId, guess: guessU });

      youAnim.runFlip({
        rowIndex: rowIdx,
        colors: cols,
        guess: guessU,
        wordLength: 5,
        onFlipDone: async (flipColors, flipGuess) => {
          setKeyStatuses(ks => {
            const n = { ...ks };
            flipGuess.split("").forEach((ltr, i) => {
              const c = flipColors[i];
              if (c.includes("green") || (c.includes("yellow") && n[ltr] !== "bg-green-500 text-white")) {
                n[ltr] = c;
              } else if (!n[ltr]) {
                n[ltr] = c;
              }
            });
            return n;
          });

          const wonIt = flipGuess === word;
          const outOfTries = nextGuesses.every(g => g !== "");

          if (wonIt || outOfTries) {
            setGameOver(true);
            setWon(wonIt);
            setYouDone(true);
            if (wonIt) youAnim.setWinRow(rowIdx);
            sendJsonMessage("player-finished", { roomId });
            await saveResult(wonIt ? "win" : "lose");
          }
        },
      });
    } else if (key === "⌫") {
      setCurrentGuess(c => c.slice(0, -1));
    } else if (/^[A-Z]$/.test(key) && currentGuess.length < 5) {
      setCurrentGuess(c => c + key);
    }
  };

  useGlobalGuessKeyboard({
    enabled: !!roomId && !!word && !gameOver && !youDone && youAnim.animatingRow === null,
    maxLength: 5,
    setCurrentGuess,
    onEnter: () => void handleKey("ENTER"),
  });

  const renderBoard = (rows: string[], title: string, reveal: boolean, isYou: boolean) => {
    const anim = isYou ? youAnim : themAnim;
    const activeRowIdx = rows.findIndex((r) => r === "");
    return (
      <div className="flex flex-col items-center gap-1">
        <p className="board-label">{title}</p>
        <div className="grid multiplayer-board-grid">
          {rows.map((row, ri) => {
            const isActiveRow = ri === activeRowIdx;
            const isAnimating = anim.animatingRow === ri;
            const revealedColors = anim.tileReveal[ri] ?? [];
            const displayRow = isYou && isActiveRow ? currentGuess.padEnd(5, " ") : row;

            return (
              <div
                key={ri}
                className={`grid-row ${anim.winRow === ri ? "grid-row--bounce" : ""}`}
              >
                {Array.from({ length: 5 }).map((_, ci) => {
                  const letter = displayRow[ci]?.trim() || "";
                  const showLetter = row
                    ? isYou || reveal
                      ? row[ci]
                      : ""
                    : isYou && isActiveRow
                      ? letter
                      : "";

                  let colorClass = "";
                  if (row) {
                    if (isAnimating) {
                      colorClass = revealedColors[ci] ?? "";
                    } else {
                      colorClass = anim.tileReveal[ri]?.[ci] ?? checkGuess(row, word)[ci];
                    }
                  }

                  let flipClass = "";
                  let flipStyle: React.CSSProperties = {};
                  if (isAnimating && row) {
                    if (!revealedColors[ci]) {
                      flipClass = "cell--flip-in";
                      flipStyle = { animationDelay: `${ci * 300}ms` };
                    } else {
                      flipClass = "cell--flip-out";
                    }
                  }

                  const hasFilled = isYou && isActiveRow && !!letter;

                  return (
                    <div
                      key={ci}
                      className={`cell ${colorClass} ${hasFilled ? "cell--filled" : ""} ${flipClass}`}
                      style={flipStyle}
                    >
                      {showLetter}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

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
              {renderBoard(guesses, "Your Board", true, true)}
              {renderBoard(opponentGuesses, "Opponent", youDone && themDone, false)}
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
