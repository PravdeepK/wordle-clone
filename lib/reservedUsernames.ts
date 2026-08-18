/**
 * Usernames that may not be registered, plus the format rules for the rest.
 *
 * Enforcement lives in three places and the list must stay in sync with
 * `firestore.rules`, which is the only one that actually stops a determined
 * caller — signup writes `users/{username}` from the client, so the Firestore
 * rule is the real gate. The API route and the UI exist for good error
 * messages, not security.
 */
export const RESERVED_USERNAMES: readonly string[] = [
  // privilege / impersonation
  "admin", "administrator", "root", "superuser", "sysadmin", "system",
  "owner", "staff", "mod", "moderator", "official", "security",
  // site identity
  "wordle", "fakewordle", "prav",
  // role addresses people trust
  "support", "help", "contact", "info", "billing", "abuse",
  "noreply", "no-reply", "webmaster", "postmaster",
  // app routes and reserved words
  "api", "auth", "login", "logout", "signup", "register", "account",
  "settings", "scoreboard", "multiplayer", "custom", "challenge",
  // placeholders that read as a real state
  "guest", "anonymous", "null", "undefined", "none", "deleted", "unknown",
  "me", "you", "everyone", "all",
];

const RESERVED = new Set(RESERVED_USERNAMES);

/** Lowercase, 3-20 chars, letters/digits/underscore/hyphen, must start alphanumeric. */
export const USERNAME_PATTERN = /^[a-z0-9][a-z0-9_-]{2,19}$/;

export type UsernameCheck = { ok: true } | { ok: false; reason: string };

export function checkUsername(raw: string): UsernameCheck {
  const name = raw.trim().toLowerCase();

  if (!name) return { ok: false, reason: "Please choose a username." };
  if (name.length < 3) return { ok: false, reason: "Username must be at least 3 characters." };
  if (name.length > 20) return { ok: false, reason: "Username must be 20 characters or fewer." };
  if (!USERNAME_PATTERN.test(name)) {
    return {
      ok: false,
      reason: "Usernames can use letters, numbers, underscores and hyphens, and must start with a letter or number.",
    };
  }
  if (RESERVED.has(name)) return { ok: false, reason: "That username isn't available." };

  return { ok: true };
}
