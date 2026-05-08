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
      "A Wordle clone I built. Pick a word length, guess in six tries, share challenges with friends.",
  };
}

export default function Home() {
  if (isComingSoon) {
    return <ComingSoonLanding />;
  }
  return <WordleHomePage />;
}
