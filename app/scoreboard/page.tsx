"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getFirestore,
  collection,
  getDocs,
  query,
  orderBy,
  deleteDoc,
  doc,
} from "firebase/firestore";
import { auth } from "../../config/firebaseConfig";
import { onAuthStateChanged } from "firebase/auth";
import { useDarkMode } from "../../hooks/useDarkMode";
import AppHeader from "../../components/AppHeader";

const db = getFirestore();

interface GameEntry {
  id: string;
  difficulty: number | string;
  word: string;
  result: string;
  timestamp: unknown;
  multiplayer?: boolean;
  player?: string;
}

export default function Scoreboard() {
  const router = useRouter();
  useDarkMode();

  const [uid, setUid] = useState<string | null>(null);
  const [isGuest, setIsGuest] = useState(false);
  const [games, setGames] = useState<GameEntry[]>([]);
  const [difficultyFilter, setDifficultyFilter] = useState("all");
  const [resultFilter, setResultFilter] = useState("all");
  const [activeTab, setActiveTab] = useState("all");

  const fetchAllGames = async (userId: string) => {
    const allGames: GameEntry[] = [];

    // solo 3-10
    for (let i = 3; i <= 10; i++) {
      const snap = await getDocs(
        query(
          collection(db, "users", userId, "games", i.toString(), "entries"),
          orderBy("timestamp", "desc")
        )
      );
      snap.forEach((d) =>
        allGames.push({ id: d.id, difficulty: i, ...d.data() } as GameEntry)
      );
    }
    // custom
    {
      const snap = await getDocs(
        query(
          collection(db, "users", userId, "games", "custom", "entries"),
          orderBy("timestamp", "desc")
        )
      );
      snap.forEach((d) =>
        allGames.push({ id: d.id, difficulty: "custom", ...d.data() } as GameEntry)
      );
    }
    // multiplayer
    {
      const snap = await getDocs(
        query(
          collection(db, "users", userId, "games", "multiplayer", "entries"),
          orderBy("timestamp", "desc")
        )
      );
      snap.forEach((d) =>
        allGames.push({ id: d.id, difficulty: "multiplayer", ...d.data() } as GameEntry)
      );
    }

    setGames(allGames);
  };

  const resetScoreboard = async () => {
    if (!uid) return;
    if (!confirm("Reset your scoreboard?")) return;

    // delete solo 3-10
    for (let i = 3; i <= 10; i++) {
      const snap = await getDocs(
        collection(db, "users", uid, "games", i.toString(), "entries")
      );
      await Promise.all(
        snap.docs.map((docItem) =>
          deleteDoc(
            doc(db, "users", uid, "games", i.toString(), "entries", docItem.id)
          )
        )
      );
    }
    // custom
    {
      const snap = await getDocs(
        collection(db, "users", uid, "games", "custom", "entries")
      );
      await Promise.all(
        snap.docs.map((docItem) =>
          deleteDoc(
            doc(db, "users", uid, "games", "custom", "entries", docItem.id)
          )
        )
      );
    }
    // multiplayer
    {
      const snap = await getDocs(
        collection(db, "users", uid, "games", "multiplayer", "entries")
      );
      await Promise.all(
        snap.docs.map((docItem) =>
          deleteDoc(
            doc(db, "users", uid, "games", "multiplayer", "entries", docItem.id)
          )
        )
      );
    }

    await fetchAllGames(uid);
  };

  useEffect(() => {
    const isGuest = (() => {
      try { return sessionStorage.getItem("wordle:guest") === "1"; } catch { return false; }
    })();
    const unsub = onAuthStateChanged(auth, (u) => {
      if (!u) {
        if (isGuest) { setUid(null); setIsGuest(true); return; }
        router.push("/login");
        return;
      }
      setIsGuest(false);
      setUid(u.uid);
      fetchAllGames(u.uid);
    });
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = games.filter((g) => {
    const isMulti = g.multiplayer === true;

    const tabOk =
      activeTab === "all" ||
      (activeTab === "multiplayer" && isMulti) ||
      (activeTab === "solo" && !isMulti);

    const diffOk =
      difficultyFilter === "all" ||
      (g.difficulty === "custom" && difficultyFilter === "custom") ||
      g.difficulty === parseInt(difficultyFilter);
    const resOk = resultFilter === "all" || g.result === resultFilter;
    return tabOk && diffOk && resOk;
  });

  return (
    <div className="page-wrapper">
      <AppHeader title="Scoreboard" backHref="/" />

      <div className="game-content game-content--centered">
        <div className="game-stage">
        {/* Stats summary */}
        {games.length > 0 && (() => {
          const wins = games.filter((g) => g.result === "win").length;
          const winRate = Math.round((wins / games.length) * 100);
          return (
            <div className="scoreboard-stats">
              <div className="scoreboard-stat">
                <span className="scoreboard-stat-value">{games.length}</span>
                <span className="scoreboard-stat-label">Played</span>
              </div>
              <div className="scoreboard-stat">
                <span className="scoreboard-stat-value">{wins}</span>
                <span className="scoreboard-stat-label">Wins</span>
              </div>
              <div className="scoreboard-stat">
                <span className="scoreboard-stat-value">{winRate}%</span>
                <span className="scoreboard-stat-label">Win Rate</span>
              </div>
            </div>
          );
        })()}

        {/* Filters card */}
        <div className="scoreboard-filters-card">
          <div className="scoreboard-filter-section">
            <p className="setup-label">Game Mode</p>
            <div className="scoreboard-filter-group">
              <button
                className={`scoreboard-chip ${activeTab === "all" ? "active-button" : ""}`}
                onClick={() => {
                  setActiveTab("all");
                  setDifficultyFilter("all");
                }}
              >
                All
              </button>
              {[...Array(8)].map((_, i) => {
                const len = (i + 3).toString();
                return (
                  <button
                    key={len}
                    className={`scoreboard-chip ${difficultyFilter === len ? "active-button" : ""}`}
                    onClick={() => {
                      setDifficultyFilter(len);
                      setActiveTab("solo");
                    }}
                  >
                    {len}
                  </button>
                );
              })}
              <button
                className={`scoreboard-chip ${
                  difficultyFilter === "custom" && activeTab === "solo" ? "active-button" : ""
                }`}
                onClick={() => {
                  setDifficultyFilter("custom");
                  setActiveTab("solo");
                }}
              >
                Custom
              </button>
              <button
                className={`scoreboard-chip ${activeTab === "multiplayer" ? "active-button" : ""}`}
                onClick={() => {
                  setActiveTab("multiplayer");
                  setDifficultyFilter("all");
                }}
              >
                Multiplayer
              </button>
            </div>
          </div>

          <div className="scoreboard-filter-section">
            <p className="setup-label">Result</p>
            <div className="scoreboard-filter-group">
              <button
                className={`scoreboard-chip ${resultFilter === "all" ? "active-button" : ""}`}
                onClick={() => setResultFilter("all")}
              >
                All
              </button>
              <button
                className={`scoreboard-chip ${resultFilter === "win" ? "active-button" : ""}`}
                onClick={() => setResultFilter("win")}
              >
                Wins
              </button>
              <button
                className={`scoreboard-chip ${resultFilter === "lose" ? "active-button" : ""}`}
                onClick={() => setResultFilter("lose")}
              >
                Losses
              </button>
            </div>
          </div>
        </div>

        {/* List */}
        {filtered.length === 0 ? (
          <p className="scoreboard-empty">
            {isGuest
              ? "Guest games aren't saved. Create an account to track your stats."
              : "No games found."}
          </p>
        ) : (
          <ul className="scoreboard-list">
            {filtered.map((g) => (
              <li
                key={g.id}
                className={`scoreboard-item ${g.result === "win" ? "scoreboard-item--win" : "scoreboard-item--loss"}`}
              >
                <span className="scoreboard-result-icon">{g.result === "win" ? "\u2713" : "\u2717"}</span>
                <span className="scoreboard-word">{g.word}</span>
                <span className="scoreboard-meta">
                  {g.difficulty === "custom"
                    ? "Custom"
                    : g.difficulty === "multiplayer"
                    ? "Multiplayer"
                    : `${g.difficulty} letters`}
                </span>
                {g.multiplayer && g.player && (
                  <span className="scoreboard-meta">vs {g.player}</span>
                )}
              </li>
            ))}
          </ul>
        )}

        {games.length > 0 && (
          <button className="scoreboard-reset" onClick={resetScoreboard}>
            Reset Scoreboard
          </button>
        )}
        </div>
      </div>
    </div>
  );
}
