// src/app/layout.tsx
import type { Metadata } from "next";
// We use the alias @/ to point to the src folder
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
      <body className="antialiased bg-slate-950 overflow-hidden">
        {children}
      </body>
    </html>
  );
}