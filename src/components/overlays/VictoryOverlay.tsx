// src/components/overlays/VictoryOverlay.tsx
"use client";

import React from "react";

// ============================================================
// [🧱 BLOCK: VictoryOverlay]
// ============================================================
interface Props {
  floor:      number;
  onContinue: () => void;
}

export default function VictoryOverlay({ floor, onContinue }: Props) {
  return (
    <div style={{
      position: "absolute", inset: 0, zIndex: 45,
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      background: "rgba(0,0,0,0.85)",
      fontFamily: "'Courier New', monospace",
    }}>
      <p style={{
        fontSize: 64, fontWeight: 900,
        color: "#4ade80", letterSpacing: "0.1em",
        textShadow: "0 0 60px #4ade80", marginBottom: 12,
      }}>
        VICTORY
      </p>

      <p style={{ fontSize: 14, color: "#475569", marginBottom: 8 }}>
        Floor {floor} cleared.
      </p>

      <p style={{ fontSize: 12, color: "#334155", marginBottom: 40 }}>
        Floor {floor + 1} — enemies are stronger.
      </p>

      <button
        onClick={onContinue}
        style={{
          fontFamily: "'Courier New', monospace",
          fontSize: 15, fontWeight: 700, letterSpacing: "0.2em",
          color: "#0f172a", backgroundColor: "#4ade80",
          border: "none", padding: "14px 44px",
          borderRadius: 4, cursor: "pointer", textTransform: "uppercase",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#86efac")}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#4ade80")}
      >
        ▶ Enter Floor {floor + 1}
      </button>
    </div>
  );
}