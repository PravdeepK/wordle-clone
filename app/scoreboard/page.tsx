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
    const unsub = onAuthStateChanged(auth, (u) => {
      if (!u) { router.push("/login"); return; }
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

      <div className="game-content">
        {/* Game Modes */}
        <div className="scoreboard-filter-group">
          <button
            className={`scoreboard-button ${activeTab === "all" ? "active-button" : ""}`}
            onClick={() => {
              setActiveTab("all");
              setDifficultyFilter("all");
            }}
          >
            All Game Modes
          </button>
          {[...Array(8)].map((_, i) => {
            const len = (i + 3).toString();
            return (
              <button
                key={len}
                className={`scoreboard-button ${difficultyFilter === len ? "active-button" : ""}`}
                onClick={() => {
                  setDifficultyFilter(len);
                  setActiveTab("solo");
                }}
              >
                {len} Letters
              </button>
            );
          })}
          <button
            className={`scoreboard-button ${
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
            className={`scoreboard-button ${activeTab === "multiplayer" ? "active-button" : ""}`}
            onClick={() => {
              setActiveTab("multiplayer");
              setDifficultyFilter("all");
            }}
          >
            Multiplayer
          </button>
        </div>

        {/* Results */}
        <div className="scoreboard-filter-group">
          <button
            className={`scoreboard-button ${resultFilter === "all" ? "active-button" : ""}`}
            onClick={() => setResultFilter("all")}
          >
            All Results
          </button>
          <button
            className={`scoreboard-button ${resultFilter === "win" ? "active-button" : ""}`}
            onClick={() => setResultFilter("win")}
          >
            Wins
          </button>
          <button
            className={`scoreboard-button ${resultFilter === "lose" ? "active-button" : ""}`}
            onClick={() => setResultFilter("lose")}
          >
            Losses
          </button>
        </div>

        {/* List */}
        {filtered.length === 0 ? (
          <p style={{ color: "var(--color-text-muted)" }}>No games found.</p>
        ) : (
          <ul className="scoreboard-list">
            {filtered.map((g) => (
              <li
                key={g.id}
                className={`scoreboard-item ${g.result === "win" ? "scoreboard-item--win" : "scoreboard-item--loss"}`}
              >
                <span style={{ fontWeight: 700 }}>{g.result === "win" ? "\u2713" : "\u2717"}</span>
                <span className="scoreboard-word">{g.word}</span>
                <span style={{ color: "var(--color-text-muted)", fontSize: "0.8rem", marginLeft: "auto" }}>
                  {g.difficulty === "custom"
                    ? "Custom"
                    : g.difficulty === "multiplayer"
                    ? "Multiplayer"
                    : `${g.difficulty} letters`}
                </span>
                {g.multiplayer && g.player && (
                  <span style={{ color: "var(--color-text-muted)", fontSize: "0.8rem" }}>
                    vs {g.player}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}

        <button className="restart-button" onClick={resetScoreboard}>
          Reset Scoreboard
        </button>
      </div>
    </div>
  );
}
