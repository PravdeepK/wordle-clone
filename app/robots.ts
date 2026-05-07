import type { MetadataRoute } from "next";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

export default function robots(): MetadataRoute.Robots {
  const isComingSoon = process.env.NEXT_PUBLIC_COMING_SOON === "true";

  if (isComingSoon) {
    return {
      rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/auth/"] }],
      sitemap: `${siteUrl}/sitemap.xml`,
      host: siteUrl,
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
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
