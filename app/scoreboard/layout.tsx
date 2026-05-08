import type { Metadata } from "next";

const title = "Scoreboard";
const description = "Top Wordle By Prav scores. See who's solving fastest across word lengths.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/scoreboard" },
  openGraph: { title, description, url: "/scoreboard" },
  twitter: { title, description },
};

export default function ScoreboardLayout({ children }: { children: React.ReactNode }) {
  return children;
}
