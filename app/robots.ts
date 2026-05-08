import type { MetadataRoute } from "next";
import { SITE_URL, isComingSoon } from "../lib/site";

export default function robots(): MetadataRoute.Robots {
  if (isComingSoon) {
    return {
      rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/auth/"] }],
      sitemap: `${SITE_URL}/sitemap.xml`,
      host: SITE_URL,
    };
  }

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/auth/", "/custom-challenge/"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
