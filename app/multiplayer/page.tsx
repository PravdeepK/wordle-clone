"use client";

import React, { useEffect, useRef, useState } from "react";
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
  const [myUsername, setMyUsername] = useState<string>("Player");
  const [opponentUsername, setOpponentUsername] = useState<string>("Opponent");
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
  const [selectedLength, setSelectedLength] = useState(5);

  type ChatEntry = { id: number; kind: "system" | "user"; text: string; from?: string };
  const [chatLog, setChatLog] = useState<ChatEntry[]>([]);
  const [chatInput, setChatInput] = useState("");
  const chatIdRef = useRef(0);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  const pushSystem = (text: string) => {
    setChatLog((log) => [...log, { id: ++chatIdRef.current, kind: "system", text }]);
  };
  const pushUser = (text: string, from: string) => {
    setChatLog((log) => [...log, { id: ++chatIdRef.current, kind: "user", text, from }]);
  };

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatLog]);

  const wordLength = word.length || selectedLength;

  const youAnim = useFlipAnimation();
  const themAnim = useFlipAnimation();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (!u) router.replace("/login");
      else {
        setUid(u.uid);
        setMyUsername(u.displayName || "Player");
      }
    });
    return () => unsub();
  }, [router]);

  const { sendJsonMessage, connected, wsError } = useWebSocket({
    onRoomJoined: (newRoomId, newWord, oppName) => {
      setRoomId(newRoomId);
      setWord(newWord.toUpperCase());
      if (oppName) {
        setOpponentUsername(oppName);
        pushSystem(`Joined room ${newRoomId}. Playing against ${oppName}.`);
      } else {
        pushSystem(`Room ${newRoomId} created. Waiting for an opponent…`);
      }
    },
    onGuestJoined: (oppName) => {
      if (oppName) {
        setOpponentUsername(oppName);
        pushSystem(`${oppName} joined the room.`);
      } else {
        pushSystem(`Opponent joined the room.`);
      }
    },
    onOpponentGuess: (guess) => {
      const g = guess.toUpperCase();
      const idx = opponentGuesses.findIndex(x => x === "");
      if (idx === -1) return;
      const n = [...opponentGuesses];
      n[idx] = g;
      setOpponentGuesses(n);
      themAnim.runFlip({
        rowIndex: idx,
        colors: checkGuess(g, word),
        guess: g,
        wordLength: word.length,
        onFlipDone: () => {},
      });
    },
    onPlayerFinished: () => {
      setThemDone(true);
      pushSystem(`${opponentUsername} finished.`);
    },
    onChat: (text, from) => pushUser(text, from),
  });

  const sendChat = () => {
    const text = chatInput.trim();
    if (!text || !roomId) return;
    sendJsonMessage("chat", { roomId, text });
    pushUser(text, myUsername);
    setChatInput("");
  };

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
      if (currentGuess.length !== wordLength) return;
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
        wordLength: wordLength,
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
            pushSystem(wonIt ? `You solved it in ${rowIdx + 1} ${rowIdx === 0 ? "try" : "tries"}!` : `You're out of tries. The word was ${word}.`);
            await saveResult(wonIt ? "win" : "lose");
          }
        },
      });
    } else if (key === "⌫") {
      setCurrentGuess(c => c.slice(0, -1));
    } else if (/^[A-Z]$/.test(key) && currentGuess.length < wordLength) {
      setCurrentGuess(c => c + key);
    }
  };

  useGlobalGuessKeyboard({
    enabled: !!roomId && !!word && !gameOver && !youDone && youAnim.animatingRow === null,
    maxLength: wordLength,
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
            const displayRow = isYou && isActiveRow ? currentGuess.padEnd(wordLength, " ") : row;

            return (
              <div
                key={ri}
                className={`grid-row ${anim.winRow === ri ? "grid-row--bounce" : ""}`}
              >
                {Array.from({ length: wordLength }).map((_, ci) => {
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
            <div className="setup-panel">
              <p className="setup-label">Pick a word length</p>
              <div className="setup-length-number">{selectedLength}</div>
              <div
                className="setup-length-tiles"
                style={{ "--setup-tile-size": `${Math.min(46, Math.max(30, Math.floor(420 / selectedLength)))}px` } as React.CSSProperties}
                aria-hidden="true"
              >
                {Array.from({ length: selectedLength }).map((_, index) => (
                  <div key={index} className="setup-length-tile" />
                ))}
              </div>
              <div className="setup-range-row">
                <span>3</span>
                <input
                  type="range"
                  min={3}
                  max={10}
                  value={selectedLength}
                  onChange={(e) => setSelectedLength(parseInt(e.target.value, 10))}
                  aria-label="Word length"
                  style={{
                    background: `linear-gradient(to right, var(--color-text) 0%, var(--color-text) ${((selectedLength - 3) / 7) * 100}%, var(--color-tile-empty) ${((selectedLength - 3) / 7) * 100}%, var(--color-tile-empty) 100%)`,
                  }}
                />
                <span>10</span>
              </div>
            </div>

            <button
              className="scoreboard-button"
              onClick={() => sendJsonMessage("create-room", { length: selectedLength, username: myUsername })}
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
                    sendJsonMessage("join-room", { roomId: joinRoomId, username: myUsername });
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
              {renderBoard(guesses, `${myUsername}'s Board`, true, true)}
              {renderBoard(opponentGuesses, `${opponentUsername}'s Board`, youDone && themDone, false)}
            </div>

            <input
              className="hidden-input"
              type="text"
              data-global-guess-keys
              value={currentGuess}
              onChange={(e) => setCurrentGuess(e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, wordLength))}
              autoFocus
              aria-label="Type your guess"
            />

            <VirtualKeyboard onKey={handleKey} keyStatuses={keyStatuses} disabled={youDone} />

            {gameOver && (
              <p className={won ? "win-message" : "game-over"}>
                {won ? "Brilliant!" : `The word was ${word}`}
              </p>
            )}

            <div className="chat-panel" aria-label="Game chat">
              <div className="chat-log" ref={chatScrollRef}>
                {chatLog.length === 0 ? (
                  <div className="chat-empty">Say hi to your opponent…</div>
                ) : (
                  chatLog.map((entry) => (
                    <div key={entry.id} className={`chat-line chat-line--${entry.kind}`}>
                      {entry.kind === "user" ? (
                        <>
                          <span className="chat-from">{entry.from}:</span>{" "}
                          <span className="chat-text">{entry.text}</span>
                        </>
                      ) : (
                        <span className="chat-text">{entry.text}</span>
                      )}
                    </div>
                  ))
                )}
              </div>
              <form
                className="chat-input-row"
                onSubmit={(e) => {
                  e.preventDefault();
                  sendChat();
                }}
              >
                <input
                  className="chat-input"
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Send a message…"
                  maxLength={280}
                  aria-label="Chat message"
                />
                <button type="submit" className="chat-send" disabled={!chatInput.trim() || !connected}>
                  Send
                </button>
              </form>
            </div>
          </>
        )}

        <button className="restart-button" onClick={() => router.push("/")}>
          Back to Main Game
        </button>
      </div>
    </div>
  );
}
