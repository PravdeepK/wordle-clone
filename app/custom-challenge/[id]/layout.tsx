import type { Metadata } from "next";

const title = "Custom challenge";
const description = "A private Wordle challenge created by a friend. Can you guess the word?";

export const metadata: Metadata = {
  title,
  description,
  openGraph: { title, description },
  twitter: { title, description },
  robots: { index: false, follow: false },
};

export default function CustomChallengeLayout({ children }: { children: React.ReactNode }) {
  return children;
}
