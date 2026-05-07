import type { MetadataRoute } from "next";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const isComingSoon = process.env.NEXT_PUBLIC_COMING_SOON === "true";

  if (isComingSoon) {
    return [
      { url: `${siteUrl}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    ];
  }

  return [
    { url: `${siteUrl}/`, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${siteUrl}/login`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${siteUrl}/custom-word`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${siteUrl}/multiplayer`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: `${siteUrl}/scoreboard`, lastModified: now, changeFrequency: "weekly", priority: 0.6 },
  ];
}
