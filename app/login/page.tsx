"use client";

import LoginSignupPanel from "../../components/LoginSignupPanel";
import { useDarkMode } from "../../hooks/useDarkMode";
import WordleLogoTiles from "../../components/WordleLogoTiles";

export default function LoginPage() {
  useDarkMode();

  return (
    <div className="login-page">
      <WordleLogoTiles />
      <LoginSignupPanel />
    </div>
  );
}
