import type { Metadata } from "next";

const title = "Multiplayer";
const description =
  "Race a friend in real-time Wordle. Create or join a room and guess the word first.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/multiplayer" },
  openGraph: { title, description, url: "/multiplayer" },
  twitter: { title, description },
};

export default function MultiplayerLayout({ children }: { children: React.ReactNode }) {
  return children;
}
