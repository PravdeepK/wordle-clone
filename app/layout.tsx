import "./styles.css";
import React from "react";

export const metadata = {
  title: "Wordle Clone",
  description: "A simple Wordle clone built with Next.js",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </head>
      <body style={{ margin: 0, padding: 0 }}>
        <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
          {children}
        </div>
      </body>
    </html>
  );
}
