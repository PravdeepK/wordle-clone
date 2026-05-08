import type { Metadata } from "next";

const title = "Create a custom challenge";
const description = "Pick a secret word and share a private Wordle challenge link with friends.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/custom-word" },
  openGraph: { title, description, url: "/custom-word" },
  twitter: { title, description },
};

export default function CustomWordLayout({ children }: { children: React.ReactNode }) {
  return children;
}
