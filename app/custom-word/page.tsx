"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { addDoc, collection, getFirestore } from "firebase/firestore";
import { auth } from "../../config/firebaseConfig";
import { onAuthStateChanged } from "firebase/auth";
import { useDarkMode } from "../../hooks/useDarkMode";
import AppHeader from "../../components/AppHeader";

const db = getFirestore();

export default function CustomWordPage() {
  const [customWord, setCustomWord] = useState("");
  const [challengeLink, setChallengeLink] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();
  useDarkMode();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user) router.push("/login");
    });
    return () => unsub();
  }, [router]);

  const createChallenge = async () => {
    setError("");
    const word = customWord.toUpperCase();

    if (word.length < 3 || word.length > 10) {
      setError("Word must be between 3\u201310 letters.");
      return;
    }

    if (!/^[A-Z]+$/.test(word)) {
      setError("Word must contain only letters.");
      return;
    }

    try {
      const docRef = await addDoc(collection(db, "customChallenges"), {
        word,
        timestamp: new Date(),
      });
      setChallengeLink(`${window.location.origin}/custom-challenge/${docRef.id}`);
    } catch {
      setError("Something went wrong. Please try again.");
    }
  };

  return (
    <div className="page-wrapper">
      <AppHeader title="Custom Challenge" backHref="/" />

      <div className="game-content">
        <input
          type="text"
          value={customWord}
          onChange={(e) => setCustomWord(e.target.value.toUpperCase())}
          className="input-box"
          placeholder="Enter a word"
          maxLength={10}
        />

        {error && <p className="error-message">{error}</p>}

        <button onClick={createChallenge} className="restart-button">
          Create Challenge
        </button>

        {challengeLink && (
          <div className="challenge-link-box">
            <p className="win-message">Challenge created!</p>
            <p style={{ color: "var(--color-text-muted)", fontSize: "0.8rem" }}>Share this link:</p>
            <a href={challengeLink} target="_blank" rel="noreferrer">{challengeLink}</a>
            <button
              className="scoreboard-button"
              style={{ marginTop: 4 }}
              onClick={() => navigator.clipboard.writeText(challengeLink)}
            >
              Copy Link
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
