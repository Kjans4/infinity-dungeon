// src/components/overlays/GameOverOverlay.tsx
"use client";

import React from "react";

// ============================================================
// [🧱 BLOCK: GameOverOverlay]
// ============================================================
interface Props {
  floor:   number;
  room:    number;
  onRetry: () => void;
}

export default function GameOverOverlay({ floor, room, onRetry }: Props) {
  return (
    <div style={{
      position: "absolute", inset: 0, zIndex: 48,
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      background: "rgba(0,0,0,0.82)",
      fontFamily: "'Courier New', monospace",
    }}>
      <p style={{
        fontSize: 64, fontWeight: 900,
        color: "#ef4444", letterSpacing: "0.1em",
        textShadow: "0 0 60px #ef4444", marginBottom: 12,
      }}>
        GAME OVER
      </p>

      <p style={{ fontSize: 14, color: "#475569", marginBottom: 40 }}>
        You were slain on Floor {floor} — Room {room}
      </p>

      <button
        onClick={onRetry}
        style={{
          fontFamily: "'Courier New', monospace",
          fontSize: 15, fontWeight: 700, letterSpacing: "0.2em",
          color: "#0f172a", backgroundColor: "#ef4444",
          border: "none", padding: "14px 44px",
          borderRadius: 4, cursor: "pointer", textTransform: "uppercase",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f87171")}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#ef4444")}
      >
        ▶ Raid Again
      </button>
    </div>
  );
}