import dynamic from "next/dynamic";
import ComingSoonLanding from "../components/ComingSoonLanding";

const WordleHomePage = dynamic(() => import("./WordleHomePage"));

const isComingSoon = process.env.NEXT_PUBLIC_COMING_SOON === "true";

export function generateMetadata() {
  if (isComingSoon) {
    return {
      title: "Wordle By Prav",
      description: "Coming soon",
    };
  }
  return {
    title: "Wordle",
    description: "A Wordle clone",
  };
}

export default function Home() {
  if (isComingSoon) {
    return <ComingSoonLanding />;
  }
  return <WordleHomePage />;
}
