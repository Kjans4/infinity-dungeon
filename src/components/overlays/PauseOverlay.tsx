// src/components/overlays/PauseOverlay.tsx
"use client";

import React, { useState } from "react";

// ============================================================
// [🧱 BLOCK: PauseOverlay Props]
// ============================================================
interface Props {
  floor:   number;
  room:    number;
  onResume: () => void;
  onQuit:   () => void;
}

// ============================================================
// [🧱 BLOCK: Controls Reference]
// ============================================================
const CONTROLS = [
  { key: "W A S D",  desc: "Move"          },
  { key: "J",        desc: "Light Attack"  },
  { key: "K",        desc: "Heavy Attack"  },
  { key: "C",        desc: "Dash"          },
  { key: "Escape",   desc: "Pause / Resume"},
];

// ============================================================
// [🧱 BLOCK: PauseOverlay Component]
// ============================================================
export default function PauseOverlay({ floor, room, onResume, onQuit }: Props) {
  const [confirmQuit, setConfirmQuit] = useState(false);

  return (
    <div
      style={{
        position:       "fixed",
        inset:          0,
        zIndex:         60,
        display:        "flex",
        flexDirection:  "column",
        alignItems:     "center",
        justifyContent: "center",
        background:     "rgba(0, 0, 0, 0.75)",
        backdropFilter: "blur(6px)",
        fontFamily:     "'Courier New', monospace",
      }}
    >
      {/* ── Card ── */}
      <div style={{
        background:   "rgba(10, 15, 30, 0.9)",
        border:       "1px solid rgba(255,255,255,0.08)",
        borderRadius: 12,
        padding:      "36px 48px",
        display:      "flex",
        flexDirection:"column",
        alignItems:   "center",
        gap:          24,
        minWidth:     320,
      }}>

        {/* Title */}
        <div style={{ textAlign: "center" }}>
          <p style={{
            fontSize: 9, color: "#475569",
            letterSpacing: "0.3em", textTransform: "uppercase",
            marginBottom: 6,
          }}>
            Floor {floor} · Room {room}
          </p>
          <p style={{
            fontSize: 32, fontWeight: 900,
            color: "#f1f5f9", letterSpacing: "0.1em",
          }}>
            PAUSED
          </p>
        </div>

        {/* Divider */}
        <div style={{ width: "100%", height: 1, background: "rgba(255,255,255,0.06)" }} />

        {/* Controls */}
        <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 8 }}>
          <p style={{
            fontSize: 8, color: "#334155",
            letterSpacing: "0.2em", textTransform: "uppercase",
            marginBottom: 4,
          }}>
            Controls
          </p>
          {CONTROLS.map(({ key, desc }) => (
            <div key={key} style={{
              display:        "flex",
              justifyContent: "space-between",
              alignItems:     "center",
              gap:            24,
            }}>
              <span style={{
                fontSize:     10,
                fontWeight:   700,
                color:        "#f1f5f9",
                background:   "rgba(255,255,255,0.06)",
                border:       "1px solid rgba(255,255,255,0.1)",
                borderRadius: 4,
                padding:      "2px 8px",
                letterSpacing:"0.05em",
              }}>
                {key}
              </span>
              <span style={{
                fontSize: 10,
                color:    "rgba(100,116,139,0.9)",
                letterSpacing: "0.08em",
              }}>
                {desc}
              </span>
            </div>
          ))}
        </div>

        {/* Divider */}
        <div style={{ width: "100%", height: 1, background: "rgba(255,255,255,0.06)" }} />

        {/* Buttons */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%" }}>

          {/* Resume */}
          <button
            onClick={onResume}
            style={{
              fontFamily:    "'Courier New', monospace",
              fontSize:      13,
              fontWeight:    700,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color:         "#0f172a",
              background:    "#f1f5f9",
              border:        "none",
              padding:       "12px 0",
              borderRadius:  6,
              cursor:        "pointer",
              width:         "100%",
              transition:    "background 0.12s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#e2e8f0")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "#f1f5f9")}
          >
            ▶ Resume
          </button>

          {/* Quit — with confirm step */}
          {!confirmQuit ? (
            <button
              onClick={() => setConfirmQuit(true)}
              style={{
                fontFamily:    "'Courier New', monospace",
                fontSize:      12,
                fontWeight:    700,
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                color:         "#64748b",
                background:    "transparent",
                border:        "1px solid #1e293b",
                padding:       "10px 0",
                borderRadius:  6,
                cursor:        "pointer",
                width:         "100%",
                transition:    "all 0.12s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color  = "#ef4444";
                e.currentTarget.style.border = "1px solid #ef4444";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color  = "#64748b";
                e.currentTarget.style.border = "1px solid #1e293b";
              }}
            >
              Quit to Menu
            </button>
          ) : (
            // Confirm row
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={onQuit}
                style={{
                  fontFamily:    "'Courier New', monospace",
                  fontSize:      11, fontWeight: 700,
                  letterSpacing: "0.15em", textTransform: "uppercase",
                  color:         "#0f172a", background: "#ef4444",
                  border:        "none", padding: "10px 0",
                  borderRadius:  6, cursor: "pointer", flex: 1,
                  transition:    "background 0.12s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#f87171")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "#ef4444")}
              >
                Yes, Quit
              </button>
              <button
                onClick={() => setConfirmQuit(false)}
                style={{
                  fontFamily:    "'Courier New', monospace",
                  fontSize:      11, fontWeight: 700,
                  letterSpacing: "0.15em", textTransform: "uppercase",
                  color:         "#64748b", background: "transparent",
                  border:        "1px solid #1e293b",
                  padding:       "10px 0",
                  borderRadius:  6, cursor: "pointer", flex: 1,
                  transition:    "all 0.12s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#f1f5f9")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#64748b")}
              >
                Cancel
              </button>
            </div>
          )}
        </div>

      </div>

      {/* Hint */}
      <p style={{
        marginTop:     16,
        fontSize:      9,
        color:         "#1e293b",
        letterSpacing: "0.15em",
      }}>
        Press ESC to resume
      </p>
    </div>
  );
}