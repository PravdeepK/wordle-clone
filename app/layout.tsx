import "./styles.css";
import React from "react";
import type { Metadata, Viewport } from "next";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "../lib/site";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_NAME,
    template: "%s · Wordle By Prav",
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  authors: [{ name: "Prav" }],
  creator: "Prav",
  publisher: "Prav",
  keywords: [
    "wordle",
    "word game",
    "puzzle",
    "daily word",
    "wordle clone",
    "wordle by prav",
    "multiplayer wordle",
    "custom wordle",
  ],
  category: "games",
  alternates: {
    canonical: "/",
  },
  formatDetection: {
    email: false,
    telephone: false,
    address: false,
  },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#121213" },
  ],
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: SITE_URL,
      name: SITE_NAME,
      description: SITE_DESCRIPTION,
      inLanguage: "en-US",
      publisher: { "@id": `${SITE_URL}/#person` },
    },
    {
      "@type": "WebApplication",
      "@id": `${SITE_URL}/#app`,
      name: SITE_NAME,
      url: SITE_URL,
      description: SITE_DESCRIPTION,
      applicationCategory: "GameApplication",
      genre: "Word Puzzle",
      operatingSystem: "Web",
      browserRequirements: "Requires JavaScript",
      inLanguage: "en-US",
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
      },
      author: { "@id": `${SITE_URL}/#person` },
    },
    {
      "@type": "Person",
      "@id": `${SITE_URL}/#person`,
      name: "Prav",
      url: SITE_URL,
    },
  ],
};

/**
 * Applies saved settings to <html> before first paint (no flash of the wrong
 * theme or palette). Mirrors `applyToDocument` in lib/settings.ts — keep the
 * storage keys and attribute names in sync with that file.
 */
const settingsBootScript = `(function(){try{
var d=document.documentElement,ls=localStorage;
if(ls.getItem("darkMode")==="true")d.classList.add("dark");
var s=JSON.parse(ls.getItem("wordle:settings")||"{}")||{};
var hex=/^#[0-9a-fA-F]{6}$/;
d.dataset.palette=typeof s.palette==="string"?s.palette:"classic";
d.dataset.tileMarks=typeof s.tileMarks==="string"?s.tileMarks:"off";
if(s.reduceMotion===true)d.classList.add("reduce-motion");
if(s.palette==="custom"&&hex.test(s.customCorrect)&&hex.test(s.customPresent)){
var txt=function(h){var n=parseInt(h.slice(1),16),l=function(c){c/=255;return c<=0.03928?c/12.92:Math.pow((c+0.055)/1.055,2.4)};var L=0.2126*l(n>>16&255)+0.7152*l(n>>8&255)+0.0722*l(n&255);return 1.05/(L+0.05)>=(L+0.05)/0.06?"#ffffff":"#1a1a1b"};
d.style.setProperty("--color-correct",s.customCorrect);d.style.setProperty("--color-present",s.customPresent);
d.style.setProperty("--color-correct-text",txt(s.customCorrect));d.style.setProperty("--color-present-text",txt(s.customPresent));}
}catch(e){}})();`;

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: settingsBootScript }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Clear+Sans:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
