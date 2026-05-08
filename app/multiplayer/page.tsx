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
import AppHeader from "../../components/AppHeader";
import useWebSocket from "./useWebSocket";
import { useGlobalGuessKeyboard } from "../../hooks/useGlobalGuessKeyboard";
import { useFlipAnimation } from "../../hooks/useFlipAnimation";
import * as Sentry from "@sentry/nextjs";

const MAX_TRIES = 6;

const DEFAULT_NAME_COLOR = "#4a90e2";
const NAME_COLORS: Array<{ id: string; hex: string; label: string }> = [
  { id: "blue",   hex: "#4a90e2", label: "Blue" },
  { id: "red",    hex: "#e25555", label: "Red" },
  { id: "orange", hex: "#e2884a", label: "Orange" },
  { id: "yellow", hex: "#d6b218", label: "Yellow" },
  { id: "green",  hex: "#3fa84a", label: "Green" },
  { id: "teal",   hex: "#2bb6a4", label: "Teal" },
  { id: "purple", hex: "#8a4ae2", label: "Purple" },
  { id: "pink",   hex: "#e24aa3", label: "Pink" },
];

function isValidNameColor(c: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(c);
}

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
  const [entryTab, setEntryTab] = useState<"game" | "settings">("game");
  const [mobileLayout, setMobileLayout] = useState<"split" | "tabs">("split");
  const [boardTab, setBoardTab] = useState<"you" | "opp">("you");
  const [isMobile, setIsMobile] = useState(false);
  const [myColor, setMyColor] = useState<string>(DEFAULT_NAME_COLOR);
  const [opponentColor, setOpponentColor] = useState<string>(DEFAULT_NAME_COLOR);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("mp.mobileLayout");
      if (saved === "split" || saved === "tabs") setMobileLayout(saved);
      const savedColor = localStorage.getItem("mp.chatColor");
      if (savedColor && isValidNameColor(savedColor)) setMyColor(savedColor);
    } catch {}
    const mql = window.matchMedia("(max-width: 760px)");
    const apply = () => setIsMobile(mql.matches);
    apply();
    mql.addEventListener("change", apply);
    return () => mql.removeEventListener("change", apply);
  }, []);

  const updateMobileLayout = (next: "split" | "tabs") => {
    setMobileLayout(next);
    try { localStorage.setItem("mp.mobileLayout", next); } catch {}
  };

  const updateMyColor = (next: string) => {
    if (!isValidNameColor(next)) return;
    setMyColor(next);
    try { localStorage.setItem("mp.chatColor", next); } catch {}
  };

  type ChatEntry = { id: number; kind: "system" | "user"; text: string; from?: string; color?: string };
  const [chatLog, setChatLog] = useState<ChatEntry[]>([]);
  const [chatInput, setChatInput] = useState("");
  const chatIdRef = useRef(0);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  const pushSystem = (text: string) => {
    setChatLog((log) => [...log, { id: ++chatIdRef.current, kind: "system", text }]);
  };
  const pushUser = (text: string, from: string, color?: string) => {
    setChatLog((log) => [...log, { id: ++chatIdRef.current, kind: "user", text, from, color }]);
  };

  const [oppTyping, setOppTyping] = useState<{ from: string; color: string } | null>(null);
  const oppTypingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingSentRef = useRef<number>(0);
  const typingStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatLog, oppTyping]);

  useEffect(() => () => {
    if (oppTypingTimerRef.current) clearTimeout(oppTypingTimerRef.current);
    if (typingStopTimerRef.current) clearTimeout(typingStopTimerRef.current);
  }, []);

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
    onRoomJoined: (newRoomId, newWord, oppName, oppColor) => {
      setRoomId(newRoomId);
      setWord(newWord.toUpperCase());
      if (oppColor && isValidNameColor(oppColor)) setOpponentColor(oppColor);
      if (oppName) {
        setOpponentUsername(oppName);
        pushSystem(`Joined room ${newRoomId}. Playing against ${oppName}.`);
      } else {
        pushSystem(`Room ${newRoomId} created. Waiting for an opponent…`);
      }
    },
    onGuestJoined: (oppName, oppColor) => {
      if (oppColor && isValidNameColor(oppColor)) setOpponentColor(oppColor);
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
    onChat: (text, from, color) => {
      pushUser(text, from, color && isValidNameColor(color) ? color : undefined);
      // Receiving a chat message implies they stopped typing.
      if (oppTypingTimerRef.current) clearTimeout(oppTypingTimerRef.current);
      setOppTyping(null);
    },
    onTyping: (from, color, isTyping) => {
      if (!isTyping) {
        if (oppTypingTimerRef.current) clearTimeout(oppTypingTimerRef.current);
        setOppTyping(null);
        return;
      }
      const safeColor = isValidNameColor(color) ? color : DEFAULT_NAME_COLOR;
      setOppTyping({ from, color: safeColor });
      if (oppTypingTimerRef.current) clearTimeout(oppTypingTimerRef.current);
      oppTypingTimerRef.current = setTimeout(() => setOppTyping(null), 3000);
    },
  });

  const sendTyping = (isTyping: boolean) => {
    if (!roomId) return;
    sendJsonMessage("typing", { roomId, isTyping });
  };

  const handleChatInputChange = (val: string) => {
    setChatInput(val);
    if (!roomId) return;
    if (val.trim().length === 0) {
      if (typingStopTimerRef.current) clearTimeout(typingStopTimerRef.current);
      sendTyping(false);
      lastTypingSentRef.current = 0;
      return;
    }
    const now = Date.now();
    if (now - lastTypingSentRef.current > 1500) {
      lastTypingSentRef.current = now;
      sendTyping(true);
    }
    if (typingStopTimerRef.current) clearTimeout(typingStopTimerRef.current);
    typingStopTimerRef.current = setTimeout(() => {
      sendTyping(false);
      lastTypingSentRef.current = 0;
    }, 2000);
  };

  const sendChat = () => {
    const text = chatInput.trim();
    if (!text || !roomId) return;
    sendJsonMessage("chat", { roomId, text });
    pushUser(text, myUsername, myColor);
    setChatInput("");
    if (typingStopTimerRef.current) clearTimeout(typingStopTimerRef.current);
    sendTyping(false);
    lastTypingSentRef.current = 0;
  };

  const saveResult = async (result: string) => {
    if (!uid || !word) return;
    try {
      await addDoc(
        collection(db, "users", uid, "games", "multiplayer", "entries"),
        { word, result, multiplayer: true, timestamp: new Date() }
      );
    } catch (e) {
      Sentry.captureException(e);
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
      <AppHeader title="Multiplayer" backHref="/" greetingName={myUsername} />

      <div className="game-content game-content--centered">
        <div className="game-stage">
        {wsError && <p className="error-message">{wsError}</p>}

        {!roomId ? (
          <div className="multiplayer-lobby">
            <div className="mp-tabs" role="tablist" aria-label="Multiplayer sections">
              <button
                role="tab"
                aria-selected={entryTab === "game"}
                className={`mp-tab ${entryTab === "game" ? "mp-tab--active" : ""}`}
                onClick={() => setEntryTab("game")}
              >
                Game
              </button>
              <button
                role="tab"
                aria-selected={entryTab === "settings"}
                className={`mp-tab ${entryTab === "settings" ? "mp-tab--active" : ""}`}
                onClick={() => setEntryTab("settings")}
              >
                Settings
              </button>
            </div>

            {entryTab === "settings" ? (
              <div className="mp-card">
                <MobileLayoutPicker value={mobileLayout} onChange={updateMobileLayout} />
                <ChatColorPicker value={myColor} onChange={updateMyColor} previewName={myUsername} />
              </div>
            ) : (
            <div className="mp-card">
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
              onClick={() => sendJsonMessage("create-room", { length: selectedLength, username: myUsername, color: myColor })}
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
                    sendJsonMessage("join-room", { roomId: joinRoomId, username: myUsername, color: myColor });
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
            )}
          </div>
        ) : (
          <>
            <div className="room-badge">Room: {roomId}</div>

            {multiError && <p className="error-message">{multiError}</p>}

            {isMobile && mobileLayout === "tabs" ? (
              <>
                <div className="mp-pill-tabs" role="tablist" aria-label="Boards">
                  <button
                    role="tab"
                    aria-selected={boardTab === "you"}
                    className={`mp-pill mp-pill--you ${boardTab === "you" ? "mp-pill--on" : ""}`}
                    onClick={() => setBoardTab("you")}
                  >
                    You · {Math.min(guesses.filter(g => g !== "").length + (youDone ? 0 : 1), MAX_TRIES)}/{MAX_TRIES}
                  </button>
                  <button
                    role="tab"
                    aria-selected={boardTab === "opp"}
                    className={`mp-pill mp-pill--opp ${boardTab === "opp" ? "mp-pill--on" : ""}`}
                    onClick={() => setBoardTab("opp")}
                  >
                    {opponentUsername} · {opponentGuesses.filter(g => g !== "").length}/{MAX_TRIES}
                  </button>
                </div>
                <div className="multiplayer-boards multiplayer-boards--single">
                  {boardTab === "you"
                    ? renderBoard(guesses, `${myUsername}'s Board`, true, true)
                    : renderBoard(opponentGuesses, `${opponentUsername}'s Board`, youDone && themDone, false)}
                </div>
              </>
            ) : (
              <div
                className={`multiplayer-boards ${isMobile && mobileLayout === "split" ? "multiplayer-boards--split-mobile" : ""}`}
              >
                {renderBoard(guesses, `${myUsername}'s Board`, true, true)}
                {renderBoard(opponentGuesses, `${opponentUsername}'s Board`, youDone && themDone, false)}
              </div>
            )}

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
                  chatLog.map((entry) => {
                    const fromColor = entry.kind === "user"
                      ? entry.color
                          ?? (entry.from === myUsername ? myColor : opponentColor)
                      : undefined;
                    return (
                      <div key={entry.id} className={`chat-line chat-line--${entry.kind}`}>
                        {entry.kind === "user" ? (
                          <>
                            <span className="chat-from" style={{ color: fromColor }}>{entry.from}:</span>{" "}
                            <span className="chat-text">{entry.text}</span>
                          </>
                        ) : (
                          <span className="chat-text">{entry.text}</span>
                        )}
                      </div>
                    );
                  })
                )}
                {oppTyping && (
                  <div className="chat-line chat-line--typing" aria-live="polite">
                    <span className="chat-from" style={{ color: oppTyping.color }}>{oppTyping.from}</span>
                    <span className="chat-typing-text"> is typing</span>
                    <span className="chat-typing-dots" aria-hidden="true">
                      <span></span><span></span><span></span>
                    </span>
                  </div>
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
                  onChange={(e) => handleChatInputChange(e.target.value)}
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

        </div>
      </div>
    </div>
  );
}

function MobileLayoutPicker({
  value,
  onChange,
}: {
  value: "split" | "tabs";
  onChange: (next: "split" | "tabs") => void;
}) {
  const options: Array<{ id: "split" | "tabs"; label: string; sub: string }> = [
    { id: "split", label: "A · Split", sub: "Both boards" },
    { id: "tabs", label: "B · Tabs", sub: "Big board" },
  ];

  const onKey = (e: React.KeyboardEvent, idx: number) => {
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      onChange(options[(idx + 1) % options.length].id);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      onChange(options[(idx - 1 + options.length) % options.length].id);
    }
  };

  return (
    <div className="mp-settings-panel">
      <div className="mp-settings-title">Mobile layout</div>
      <div className="mp-layout-row" role="radiogroup" aria-label="Mobile layout">
        {options.map((opt, idx) => {
          const selected = value === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              role="radio"
              aria-checked={selected}
              tabIndex={selected ? 0 : -1}
              className={`mp-layout-card ${selected ? "mp-layout-card--sel" : ""}`}
              onClick={() => onChange(opt.id)}
              onKeyDown={(e) => onKey(e, idx)}
            >
              {selected && <span className="mp-layout-check" aria-hidden="true">✓</span>}
              <span className="mp-layout-preview" aria-hidden="true">
                {opt.id === "split" ? <SplitPreview /> : <TabsPreview />}
              </span>
              <span className="mp-layout-label">{opt.label}</span>
              <span className="mp-layout-sub">{opt.sub}</span>
            </button>
          );
        })}
      </div>
      <div className="mp-settings-foot">Saves immediately</div>
    </div>
  );
}

function ChatColorPicker({
  value,
  onChange,
  previewName,
}: {
  value: string;
  onChange: (next: string) => void;
  previewName: string;
}) {
  return (
    <div className="mp-settings-panel">
      <div className="mp-settings-title">Chat name color</div>
      <div className="mp-color-preview">
        <span className="chat-from" style={{ color: value }}>{previewName}:</span>{" "}
        <span className="chat-text">looks like this</span>
      </div>
      <div className="mp-color-row" role="radiogroup" aria-label="Chat name color presets">
        {NAME_COLORS.map((c) => {
          const selected = value.toLowerCase() === c.hex.toLowerCase();
          return (
            <button
              key={c.id}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={c.label}
              title={c.label}
              className={`mp-color-swatch ${selected ? "mp-color-swatch--sel" : ""}`}
              style={{ background: c.hex }}
              onClick={() => onChange(c.hex)}
            />
          );
        })}
      </div>
      <label className="mp-color-custom">
        <span className="mp-color-custom-label">Custom</span>
        <input
          type="color"
          className="mp-color-custom-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label="Pick a custom chat name color"
        />
        <span className="mp-color-custom-hex">{value.toUpperCase()}</span>
      </label>
      <div className="mp-settings-foot">Saves immediately</div>
    </div>
  );
}

function MiniBoard({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  const cols = 5;
  const rows = 3;
  const pad = 2;
  const gap = 2;
  const cellW = (w - pad * 2 - gap * (cols - 1)) / cols;
  const cellH = (h - pad * 2 - gap * (rows - 1)) / rows;
  const cells = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      cells.push(
        <rect
          key={`${r}-${c}`}
          x={x + pad + c * (cellW + gap)}
          y={y + pad + r * (cellH + gap)}
          width={cellW}
          height={cellH}
          fill="currentColor"
          opacity="0.5"
          rx="1"
        />
      );
    }
  }
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill="none" stroke="currentColor" strokeWidth="1.5" rx="3" />
      {cells}
    </g>
  );
}

function MiniKeyboard({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  const keys = 7;
  const pad = 1.5;
  const gap = 1.5;
  const keyW = (w - pad * 2 - gap * (keys - 1)) / keys;
  const keyH = h - pad * 2;
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill="none" stroke="currentColor" strokeWidth="1.5" rx="2" />
      {Array.from({ length: keys }).map((_, i) => (
        <rect
          key={i}
          x={x + pad + i * (keyW + gap)}
          y={y + pad}
          width={keyW}
          height={keyH}
          fill="currentColor"
          opacity="0.5"
          rx="0.5"
        />
      ))}
    </g>
  );
}

function SplitPreview() {
  return (
    <svg className="pv-svg" viewBox="0 0 200 120" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <MiniBoard x={2} y={2} w={96} h={70} />
      <MiniBoard x={102} y={2} w={96} h={70} />
      <MiniKeyboard x={2} y={78} w={196} h={20} />
      <rect x={2} y={102} width={196} height={14} fill="none" stroke="currentColor" strokeWidth="1.5" rx="2" />
    </svg>
  );
}

function TabsPreview() {
  return (
    <svg className="pv-svg" viewBox="0 0 200 120" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <rect x={2} y={2} width={96} height={12} fill="currentColor" rx="2" />
      <rect x={102} y={2} width={96} height={12} fill="none" stroke="currentColor" strokeWidth="1.5" rx="2" />
      <MiniBoard x={2} y={20} w={196} h={52} />
      <MiniKeyboard x={2} y={78} w={196} h={20} />
      <rect x={2} y={102} width={196} height={14} fill="none" stroke="currentColor" strokeWidth="1.5" rx="2" />
    </svg>
  );
}
