import type { Metadata } from "next";
import dynamic from "next/dynamic";
import ComingSoonLanding from "../components/ComingSoonLanding";
import { SITE_DESCRIPTION, SITE_NAME, isComingSoon } from "../lib/site";

const WordleHomePage = dynamic(() => import("./WordleHomePage"));

export function generateMetadata(): Metadata {
  if (isComingSoon) {
    const desc = "Coming soon — a personal Wordle-style word game by Prav.";
    return {
      title: SITE_NAME,
      description: desc,
      alternates: { canonical: "/" },
      openGraph: { title: SITE_NAME, description: desc, url: "/" },
      twitter: { title: SITE_NAME, description: desc },
    };
  }
  return {
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    alternates: { canonical: "/" },
    openGraph: { title: SITE_NAME, description: SITE_DESCRIPTION, url: "/" },
    twitter: { title: SITE_NAME, description: SITE_DESCRIPTION },
  };
}

export default function Home() {
  if (isComingSoon) {
    return <ComingSoonLanding />;
  }
  return <WordleHomePage />;
}
