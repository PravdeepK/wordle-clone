import dynamic from "next/dynamic";
import ComingSoonLanding from "../components/ComingSoonLanding";

const WordleHomePage = dynamic(() => import("./WordleHomePage"));

const isComingSoon = process.env.NEXT_PUBLIC_COMING_SOON === "true";

export function generateMetadata() {
  if (isComingSoon) {
    return {
      title: "Wordle By Prav",
      description: "Coming soon — a personal Wordle-style word game by Prav.",
      openGraph: {
        title: "Wordle By Prav",
        description: "Coming soon — a personal Wordle-style word game by Prav.",
      },
      twitter: {
        title: "Wordle By Prav",
        description: "Coming soon — a personal Wordle-style word game by Prav.",
      },
    };
  }
  return {
    title: "Wordle By Prav",
    description:
      "Guess the hidden word in six tries. Flexible word lengths, custom challenges, and real-time multiplayer.",
  };
}

export default function Home() {
  if (isComingSoon) {
    return <ComingSoonLanding />;
  }
  return <WordleHomePage />;
}
