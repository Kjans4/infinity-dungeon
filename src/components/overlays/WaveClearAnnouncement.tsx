// src/components/overlays/WaveClearAnnouncement.tsx
"use client";

import React, { useEffect, useState } from "react";

// ============================================================
// [🧱 BLOCK: Props]
// ============================================================
interface Props {
  show:    boolean;
  message: string;   // e.g. "ROOM CLEAR" or "BOSS SLAIN"
  subtext?: string;  // e.g. "Gate is open" or "Victory!"
  color?:  string;   // accent color
}

// ============================================================
// [🧱 BLOCK: WaveClearAnnouncement]
// Fades in then fades out automatically.
// Triggered by parent setting show=true.
// Parent should reset show to false after ~2.5s.
// ============================================================
export default function WaveClearAnnouncement({
  show, message, subtext, color = "#4ade80",
}: Props) {
  const [opacity, setOpacity] = useState(0);
  const [scale,   setScale]   = useState(0.85);

  useEffect(() => {
    if (!show) {
      setOpacity(0);
      setScale(0.85);
      return;
    }

    // Fade + scale in
    setOpacity(1);
    setScale(1);

    // Fade out after 1.6s
    const fadeOut = setTimeout(() => {
      setOpacity(0);
      setScale(1.05);
    }, 1600);

    return () => clearTimeout(fadeOut);
  }, [show]);

  if (!show && opacity === 0) return null;

  return (
    <div style={{
      position:       "fixed",
      inset:          0,
      zIndex:         35,
      display:        "flex",
      flexDirection:  "column",
      alignItems:     "center",
      justifyContent: "center",
      pointerEvents:  "none",
    }}>
      <div style={{
        display:       "flex",
        flexDirection: "column",
        alignItems:    "center",
        gap:           8,
        opacity,
        transform:     `scale(${scale})`,
        transition:    "opacity 0.4s ease, transform 0.4s ease",
      }}>
        {/* Main text */}
        <p style={{
          fontFamily:   "'Courier New', monospace",
          fontSize:     42,
          fontWeight:   900,
          color,
          letterSpacing:"0.15em",
          textTransform:"uppercase",
          textShadow:   `0 0 40px ${color}`,
          margin:       0,
        }}>
          {message}
        </p>

        {/* Subtext */}
        {subtext && (
          <p style={{
            fontFamily:   "'Courier New', monospace",
            fontSize:     11,
            color:        "rgba(148,163,184,0.8)",
            letterSpacing:"0.2em",
            textTransform:"uppercase",
            margin:       0,
          }}>
            {subtext}
          </p>
        )}
      </div>
    </div>
  );
}