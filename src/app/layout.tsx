// src/app/layout.tsx
import type { Metadata } from "next";
import "@/styles/globals.css";

export const metadata: Metadata = {
  title: "Infinity Dungeon",
  description: "A bird's eye view arena rogue-like",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      {/* No extra classes — globals.css handles the reset */}
      <body>{children}</body>
    </html>
  );
}