"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "../config/firebaseConfig";
import { useDarkMode } from "../hooks/useDarkMode";
import FeedbackModal from "./FeedbackModal";

/* ── Inline icons ── */
export const Icon = {
  Menu: (p: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <line x1="4" y1="7" x2="20" y2="7" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="17" x2="20" y2="17" />
    </svg>
  ),
  Close: (p: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" />
    </svg>
  ),
  Back: (p: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
    </svg>
  ),
  Refresh: (p: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10" /><path d="M20.49 15A9 9 0 0 1 5.64 18.36L1 14" />
    </svg>
  ),
  Home: (p: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M3 12l9-9 9 9" /><path d="M5 10v10h14V10" />
    </svg>
  ),
  Pencil: (p: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  ),
  Trophy: (p: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M8 21h8" /><path d="M12 17v4" />
      <path d="M7 4h10v5a5 5 0 0 1-10 0V4z" />
      <path d="M17 5h3v3a3 3 0 0 1-3 3" /><path d="M7 5H4v3a3 3 0 0 0 3 3" />
    </svg>
  ),
  Users: (p: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  Chat: (p: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  ),
  Sun: (p: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  ),
  Moon: (p: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  ),
  Logout: (p: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  ),
};

type AppHeaderProps = {
  /** Full page name (used for accessibility when `titleShort` is set) */
  title: string;
  /** Optional compact label for the top bar on small screens (avoids truncation) */
  titleShort?: string;
  /** Override default back behavior. If omitted, no back button. */
  onBack?: () => void;
  /** Show a back button that pushes "/" (default for sub-pages). Ignored if onBack is provided. */
  backHref?: string;
  /** "New game" item shown at top of menu when provided. */
  onNewGame?: () => void;
  newGameDisabled?: boolean;
  /** Pre-fill the feedback modal identifier (email/username). */
  feedbackIdentifier?: string;
  /** Optional: greeting in the menu header. */
  greetingName?: string;
};

type MenuItemProps = {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
  active?: boolean;
};

function MenuItem({ icon, label, onClick, danger, disabled, active }: MenuItemProps) {
  return (
    <button
      type="button"
      className={`menu-item ${danger ? "menu-item--danger" : ""} ${active ? "menu-item--active" : ""}`}
      onClick={onClick}
      disabled={disabled}
      aria-current={active ? "page" : undefined}
    >
      <span className="menu-item-icon">{icon}</span>
      <span className="menu-item-label">{label}</span>
    </button>
  );
}

export default function AppHeader({
  title,
  titleShort,
  onBack,
  backHref,
  onNewGame,
  newGameDisabled,
  feedbackIdentifier = "",
  greetingName,
}: AppHeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { darkMode, toggleDarkMode } = useDarkMode();
  const [menuOpen, setMenuOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMenuOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const closeMenu = () => setMenuOpen(false);
  const go = (path: string) => { closeMenu(); router.push(path); };

  const handleBack = onBack ?? (backHref ? () => router.push(backHref) : undefined);
  const isHome = pathname === "/";

  const displayTitle = titleShort ?? title;
  const titleId = "app-header-title";

  return (
    <div className="app-header-wrap">
      <header className="game-header game-header--app" aria-labelledby={titleId}>
        <div className="game-header-left">
          {handleBack && (
            <button
              type="button"
              className="header-icon-btn"
              onClick={handleBack}
              aria-label="Back"
              title="Back"
            >
              <Icon.Back />
            </button>
          )}
        </div>
        <h1
          className="title"
          id={titleId}
          aria-label={titleShort ? title : undefined}
        >
          {displayTitle}
        </h1>
        <div className="game-header-right" ref={menuRef}>
          <button
            type="button"
            className="header-icon-btn"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label="Open menu"
            aria-expanded={menuOpen}
            title="Menu"
          >
            {menuOpen ? <Icon.Close /> : <Icon.Menu />}
          </button>
          {menuOpen && (
            <div className="menu-panel" role="menu">
              {greetingName && (
                <>
                  <div className="menu-greeting">
                    <span className="menu-greeting-label">Signed in as</span>
                    <span className="menu-greeting-name">{greetingName}</span>
                  </div>
                  <div className="menu-divider" />
                </>
              )}
              {onNewGame && (
                <MenuItem
                  icon={<Icon.Refresh />}
                  label="New game"
                  disabled={newGameDisabled}
                  onClick={() => { closeMenu(); onNewGame(); }}
                />
              )}
              {!isHome && (
                <MenuItem icon={<Icon.Home />} label="Home" onClick={() => go("/")} active={pathname === "/"} />
              )}
              <MenuItem
                icon={<Icon.Pencil />}
                label="Custom word"
                onClick={() => go("/custom-word")}
                active={pathname?.startsWith("/custom-word") || pathname?.startsWith("/custom-challenge")}
              />
              <MenuItem
                icon={<Icon.Trophy />}
                label="Scoreboard"
                onClick={() => go("/scoreboard")}
                active={pathname?.startsWith("/scoreboard")}
              />
              <MenuItem
                icon={<Icon.Users />}
                label="Multiplayer"
                onClick={() => go("/multiplayer")}
                active={pathname?.startsWith("/multiplayer")}
              />
              <MenuItem icon={<Icon.Chat />} label="Feedback" onClick={() => { closeMenu(); setFeedbackOpen(true); }} />
              <div className="menu-divider" />
              <MenuItem
                icon={darkMode ? <Icon.Sun /> : <Icon.Moon />}
                label={darkMode ? "Light mode" : "Dark mode"}
                onClick={() => toggleDarkMode()}
              />
              <MenuItem
                icon={<Icon.Logout />}
                label="Logout"
                danger
                onClick={async () => { closeMenu(); await signOut(auth); router.replace("/login"); }}
              />
            </div>
          )}
        </div>
      </header>

      <FeedbackModal
        open={feedbackOpen}
        onClose={() => setFeedbackOpen(false)}
        defaultIdentifier={feedbackIdentifier}
      />
    </div>
  );
}
