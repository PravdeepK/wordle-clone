import type { MetadataRoute } from "next";
import { SITE_URL, isComingSoon } from "../lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  if (isComingSoon) {
    return [
      { url: `${SITE_URL}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    ];
  }

  return [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/login`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE_URL}/custom-word`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE_URL}/multiplayer`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: `${SITE_URL}/scoreboard`, lastModified: now, changeFrequency: "weekly", priority: 0.6 },
  ];
}
