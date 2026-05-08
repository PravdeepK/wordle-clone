export const SITE_NAME = "Wordle By Prav";
export const SITE_DESCRIPTION =
  "A Wordle clone I built. Pick a word length, guess in six tries, share challenges with friends.";
export const SITE_TAGLINE = "Daily-style word puzzle — pick a length, guess in six.";

export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://fakewordle.com");

export const isComingSoon = process.env.NEXT_PUBLIC_COMING_SOON === "true";
