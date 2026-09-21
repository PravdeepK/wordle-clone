/**
 * Preserving where the visitor was headed across the /login detour.
 *
 * Without this, opening a shared custom-challenge link while signed out sends
 * you to /login and then dumps you on the home page — the challenge you clicked
 * is lost. Gated pages redirect to `loginHref(...)` instead, and the login panel
 * returns you to `?next=` after signing in or continuing as a guest.
 */

/**
 * The path the browser is on right now, including its query string, ready to be
 * handed to `loginHref`. Returns "/" during SSR.
 */
export function currentPath(): string {
  if (typeof window === "undefined") return "/";
  return `${window.location.pathname}${window.location.search}`;
}

/** `/login` with the destination attached, for a gated page to redirect to. */
export function loginHref(next?: string): string {
  const target = next ?? currentPath();
  if (!isInternalPath(target) || target.startsWith("/login")) return "/login";
  return `/login?next=${encodeURIComponent(target)}`;
}

/**
 * Validate a `?next=` value before navigating to it. Only same-origin absolute
 * paths are allowed: anything protocol-relative ("//evil.com"), absolute-URL or
 * backslash-escaped would turn the login page into an open redirect.
 */
export function safeNextPath(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim();
  if (!isInternalPath(value)) return null;
  if (value.startsWith("/login")) return null; // never bounce back to login
  return value;
}

/** Read and validate `?next=` from the current URL. */
export function nextFromLocation(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return safeNextPath(new URLSearchParams(window.location.search).get("next"));
  } catch {
    return null;
  }
}

function isInternalPath(value: string): boolean {
  return (
    value.startsWith("/") &&
    !value.startsWith("//") &&
    !value.startsWith("/\\")
  );
}
