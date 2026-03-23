// src/components/HUD.tsx
"use client";

import React from "react";

// ============================================================
// [🧱 BLOCK: HUD Props]
// ============================================================
interface HUDProps {
  hp:             number;
  maxHp:          number;
  stamina:        number;
  maxStamina:     number;
  kills:          number;
  killThreshold:  number;
  room:           number;
  floor:          number;
}

// ============================================================
// [🧱 BLOCK: Pill Wrapper]
// Shared glass-pill container used by every HUD element.
// ============================================================
function Pill({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        background:   "rgba(10, 15, 30, 0.55)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        border:       "1px solid rgba(255,255,255,0.07)",
        borderRadius: 8,
        padding:      "8px 14px",
        display:      "flex",
        flexDirection:"column",
        gap:          6,
        fontFamily:   "'Courier New', monospace",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ============================================================
// [🧱 BLOCK: Thin Bar]
// Compact progress bar used inside pills.
// ============================================================
function ThinBar({
  value, max, color, label,
}: {
  value: number; max: number; color: string; label: string;
}) {
  const pct = Math.max(0, Math.min(1, value / max)) * 100;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 110 }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span style={{ fontSize: 9, color: "rgba(148,163,184,0.8)", letterSpacing: "0.12em", textTransform: "uppercase" }}>
          {label}
        </span>
        <span style={{ fontSize: 9, color: "rgba(148,163,184,0.6)" }}>
          {Math.round(value)}/{max}
        </span>
      </div>
      <div style={{ width: "100%", height: 5, background: "rgba(30,41,59,0.8)", borderRadius: 3, overflow: "hidden" }}>
        <div style={{
          width:        `${pct}%`,
          height:       "100%",
          background:   color,
          borderRadius: 3,
          transition:   "width 0.1s linear",
          boxShadow:    `0 0 6px ${color}`,
        }} />
      </div>
    </div>
  );
}

// ============================================================
// [🧱 BLOCK: Kill Ring]
// Circular progress for the kill counter — top right pill.
// ============================================================
function KillRing({ kills, threshold }: { kills: number; threshold: number }) {
  const pct          = Math.min(kills / threshold, 1);
  const radius       = 18;
  const circumference = 2 * Math.PI * radius;
  const dashOffset   = circumference * (1 - pct);
  const done         = kills >= threshold;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      {/* Ring */}
      <div style={{ position: "relative", width: 44, height: 44 }}>
        <svg
          style={{ position: "absolute", inset: 0, transform: "rotate(-90deg)" }}
          width="44" height="44" viewBox="0 0 44 44"
        >
          <circle cx="22" cy="22" r={radius} fill="none" stroke="rgba(30,41,59,0.8)" strokeWidth="4" />
          <circle
            cx="22" cy="22" r={radius} fill="none"
            stroke={done ? "#4ade80" : "#f87171"}
            strokeWidth="4"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            style={{ transition: "stroke-dashoffset 0.1s linear", filter: done ? "drop-shadow(0 0 4px #4ade80)" : "none" }}
          />
        </svg>
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
        }}>
          <span style={{ fontSize: 11, fontWeight: 900, color: done ? "#4ade80" : "#f1f5f9", fontFamily: "'Courier New', monospace" }}>
            {kills}
          </span>
        </div>
      </div>

      {/* Label */}
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <span style={{ fontSize: 9, color: "rgba(148,163,184,0.7)", letterSpacing: "0.12em", textTransform: "uppercase" }}>
          Kills
        </span>
        <span style={{ fontSize: 9, color: done ? "#4ade80" : "rgba(148,163,184,0.5)" }}>
          {done ? "⚡ Gate Open" : `${kills} / ${threshold}`}
        </span>
      </div>
    </div>
  );
}

// ============================================================
// [🧱 BLOCK: HUD Root]
// Four floating pills in the corners — nothing at bottom
// center where the player spawns.
//
// Layout:
//   TOP-LEFT     → HP + Stamina
//   TOP-RIGHT    → Kill counter
//   BOTTOM-LEFT  → Room / Floor label
//   (bottom-center and bottom-right intentionally empty)
// ============================================================
export default function HUD({
  hp, maxHp, stamina, maxStamina,
  kills, killThreshold, room, floor,
}: HUDProps) {
  const hpColor = hp / maxHp > 0.5
    ? "#f87171"
    : hp / maxHp > 0.25
      ? "#facc15"
      : "#ef4444";

  return (
    // Full screen container — pointer-events: none so clicks pass through
    <div style={{
      position:      "fixed",
      inset:         0,
      pointerEvents: "none",
      zIndex:        20,
    }}>

      {/* ── TOP-LEFT: HP + Stamina ── */}
      <div style={{ position: "absolute", top: 16, left: 16 }}>
        <Pill>
          <ThinBar value={hp}      max={maxHp}      color={hpColor}   label="HP"      />
          <ThinBar value={stamina} max={maxStamina}  color="#facc15"   label="Stamina" />
        </Pill>
      </div>

      {/* ── TOP-RIGHT: Kill Counter ── */}
      <div style={{ position: "absolute", top: 16, right: 16 }}>
        <Pill>
          <KillRing kills={kills} threshold={killThreshold} />
        </Pill>
      </div>

      {/* ── BOTTOM-LEFT: Room + Floor ── */}
      <div style={{ position: "absolute", bottom: 16, left: 16 }}>
        <Pill style={{ padding: "6px 12px" }}>
          <span style={{
            fontSize: 9, color: "rgba(148,163,184,0.5)",
            letterSpacing: "0.15em", textTransform: "uppercase",
          }}>
            Floor {floor}
          </span>
          <span style={{
            fontSize: 16, fontWeight: 900,
            color: "#f1f5f9", letterSpacing: "0.05em",
            lineHeight: 1,
          }}>
            ROOM {room}
          </span>
        </Pill>
      </div>

    </div>
  );
}