// src/components/Shop.tsx
"use client";

import React from "react";

// ============================================================
// [🧱 BLOCK: Shop Props]
// ============================================================
interface ShopProps {
  floor:  number;
  room:   number;
  onContinue: () => void;
}

// ============================================================
// [🧱 BLOCK: Shop Placeholder]
// Full screen overlay that pauses the game.
// Replace the interior later with actual upgrade options.
// ============================================================
export default function Shop({ floor, room, onContinue }: ShopProps) {
  return (
    <div style={{
      position:       "absolute",
      inset:          0,
      zIndex:         40,
      display:        "flex",
      flexDirection:  "column",
      alignItems:     "center",
      justifyContent: "center",
      background:     "rgba(0,0,0,0.88)",
    }}>

      {/* Title */}
      <p style={{
        fontFamily:   "'Courier New', monospace",
        fontSize:     13,
        color:        "#475569",
        letterSpacing:"0.2em",
        textTransform:"uppercase",
        marginBottom: 8,
      }}>
        Floor {floor} — Before Room {room}
      </p>

      <p style={{
        fontFamily:   "'Courier New', monospace",
        fontSize:     48,
        fontWeight:   900,
        color:        "#facc15",
        letterSpacing:"0.05em",
        textShadow:   "0 0 40px #facc15",
        marginBottom: 12,
      }}>
        SHOP
      </p>

      {/* Placeholder notice */}
      <div style={{
        border:       "1px solid #334155",
        borderRadius: 6,
        padding:      "24px 40px",
        marginBottom: 40,
        textAlign:    "center",
      }}>
        <p style={{
          fontFamily: "'Courier New', monospace",
          fontSize:   13,
          color:      "#64748b",
          marginBottom: 8,
        }}>
          — Coming Soon —
        </p>
        <p style={{
          fontFamily: "'Courier New', monospace",
          fontSize:   11,
          color:      "#334155",
        }}>
          Upgrades, healing, and gear will appear here.
        </p>
      </div>

      {/* Continue button */}
      <button
        onClick={onContinue}
        style={{
          fontFamily:    "'Courier New', monospace",
          fontSize:      14,
          fontWeight:    700,
          letterSpacing: "0.2em",
          color:         "#0f172a",
          backgroundColor: "#facc15",
          border:        "none",
          padding:       "14px 44px",
          borderRadius:  4,
          cursor:        "pointer",
          textTransform: "uppercase",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#fde047")}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#facc15")}
      >
        ▶ Enter Boss Room
      </button>

    </div>
  );
}