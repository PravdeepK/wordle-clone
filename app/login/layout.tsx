import type { Metadata } from "next";

const title = "Log in";
const description = "Sign in or create an account to track scores, save streaks, and play multiplayer.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/login" },
  openGraph: { title, description, url: "/login", images: ["/opengraph-image"] },
  twitter: { title, description },
  robots: { index: false, follow: true },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
