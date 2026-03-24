"use client";

import React from "react";

// ============================================================
// [🧱 BLOCK: HUD Props]
// ============================================================
interface HUDProps {
  hp:            number;
  maxHp:         number;
  stamina:       number;
  maxStamina:    number;
  kills:         number;
  killThreshold: number;
  room:          number;
  floor:         number;
  gold:          number; // Added gold here
}

// ============================================================
// [🧱 BLOCK: Thin Bar]
// ============================================================
function ThinBar({
  value, max, color, label,
}: {
  value: number; max: number; color: string; label: string;
}) {
  const pct = Math.max(0, Math.min(1, value / max)) * 100;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 120 }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span style={{
          fontSize: 9, color: "rgba(148,163,184,0.8)",
          letterSpacing: "0.12em", textTransform: "uppercase",
          fontFamily: "'Courier New', monospace",
        }}>
          {label}
        </span>
        <span style={{ fontSize: 9, color: "rgba(148,163,184,0.6)", fontFamily: "'Courier New', monospace" }}>
          {Math.round(value)}/{max}
        </span>
      </div>
      <div style={{
        width: "100%", height: 5,
        background: "rgba(30,41,59,0.8)",
        borderRadius: 3, overflow: "hidden",
      }}>
        <div style={{
          width: `${pct}%`, height: "100%",
          background: color, borderRadius: 3,
          transition: "width 0.1s linear",
          boxShadow: `0 0 6px ${color}`,
        }} />
      </div>
    </div>
  );
}

// ============================================================
// [🧱 BLOCK: Kill Ring]
// ============================================================
function KillRing({ kills, threshold }: { kills: number; threshold: number }) {
  const pct          = Math.min(kills / threshold, 1);
  const radius       = 16;
  const circumference = 2 * Math.PI * radius;
  const dashOffset   = circumference * (1 - pct);
  const done         = kills >= threshold;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
      <div style={{ position: "relative", width: 40, height: 40 }}>
        <svg
          style={{ position: "absolute", inset: 0, transform: "rotate(-90deg)" }}
          width="40" height="40" viewBox="0 0 40 40"
        >
          <circle cx="20" cy="20" r={radius} fill="none" stroke="rgba(30,41,59,0.8)" strokeWidth="4" />
          <circle
            cx="20" cy="20" r={radius} fill="none"
            stroke={done ? "#4ade80" : "#f87171"}
            strokeWidth="4"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            style={{
              transition: "stroke-dashoffset 0.1s linear",
              filter: done ? "drop-shadow(0 0 4px #4ade80)" : "none",
            }}
          />
        </svg>
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <span style={{
            fontSize: 10, fontWeight: 900,
            color: done ? "#4ade80" : "#f1f5f9",
            fontFamily: "'Courier New', monospace",
          }}>
            {kills}
          </span>
        </div>
      </div>
      <span style={{
        fontSize: 8, fontFamily: "'Courier New', monospace",
        color: done ? "#4ade80" : "rgba(148,163,184,0.6)",
        letterSpacing: "0.1em", textTransform: "uppercase",
        textShadow: done ? "0 0 8px #4ade80" : "none",
      }}>
        {done ? "⚡ open" : `${kills}/${threshold}`}
      </span>
    </div>
  );
}

// ============================================================
// [🧱 BLOCK: Divider]
// Thin vertical line separating pill sections.
// ============================================================
function Divider() {
  return (
    <div style={{
      width: 1, alignSelf: "stretch",
      background: "rgba(255,255,255,0.07)",
      margin: "0 4px",
    }} />
  );
}

// ============================================================
// [🧱 BLOCK: HUD Root]
// ============================================================
export default function HUD({
  hp, maxHp, stamina, maxStamina,
  kills, killThreshold, room, floor, gold, // Added gold to props
}: HUDProps) {
  const hpColor = hp / maxHp > 0.5
    ? "#4ade80" // Note: updated to a healthier green-ish, or keep your red logic
    : hp / maxHp > 0.25
      ? "#facc15"
      : "#ef4444";

  return (
    <div style={{
      position:      "fixed",
      bottom:        20,
      left:          "50%",
      transform:     "translateX(-50%)",
      zIndex:        20,
      pointerEvents: "none",

      display:        "flex",
      flexDirection:  "row",
      alignItems:     "center",
      gap:            16,
      padding:        "10px 20px",
      background:     "rgba(10, 15, 30, 0.55)",
      backdropFilter: "blur(12px)",
      WebkitBackdropFilter: "blur(12px)",
      border:         "1px solid rgba(255,255,255,0.07)",
      borderRadius:   12,
      boxShadow:      "0 4px 24px rgba(0,0,0,0.4)",
      whiteSpace:     "nowrap",
    }}>

      {/* ── HP + Stamina ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <ThinBar value={hp}      max={maxHp}     color={hpColor}  label="HP"      />
        <ThinBar value={stamina} max={maxStamina} color="#3b82f6"  label="Stamina" />
      </div>

      <Divider />

      {/* ── Room / Floor ── */}
      <div style={{
        display: "flex", flexDirection: "column",
        alignItems: "center", gap: 2,
      }}>
        <span style={{
          fontSize: 8, color: "rgba(100,116,139,0.8)",
          letterSpacing: "0.18em", textTransform: "uppercase",
          fontFamily: "'Courier New', monospace",
        }}>
          Floor {floor}
        </span>
        <span style={{
          fontSize: 18, fontWeight: 900, lineHeight: 1,
          color: "#f1f5f9", letterSpacing: "0.04em",
          fontFamily: "'Courier New', monospace",
        }}>
          ROOM {room}
        </span>
      </div>

      <Divider />

      {/* ── Gold Section ── */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
        <span style={{ fontSize: 8, color: "rgba(100,116,139,0.8)", letterSpacing: "0.18em", textTransform: "uppercase", fontFamily: "'Courier New', monospace" }}>
          Gold
        </span>
        <span style={{ fontSize: 14, fontWeight: 900, color: "#facc15", fontFamily: "'Courier New', monospace" }}>
          💰 {gold}
        </span>
      </div>

      <Divider />

      {/* ── Kill Ring ── */}
      <KillRing kills={kills} threshold={killThreshold} />

    </div>
  );
}