// src/components/HUD.tsx
"use client";

import React from "react";

// ============================================================
// [🧱 BLOCK: HUD Props]
// ============================================================
interface HUDProps {
  hp: number;
  maxHp: number;
  stamina: number;
  maxStamina: number;
  kills: number;
  killThreshold: number;
  room: number;
  floor: number;
}

// ============================================================
// [🧱 BLOCK: Stat Bar]
// Simple horizontal bar — reused for HP and Stamina.
// ============================================================
function StatBar({
  value,
  max,
  fillColor,
  label,
}: {
  value: number;
  max: number;
  fillColor: string;
  label: string;
}) {
  const pct = Math.max(0, Math.min(1, value / max)) * 100;

  return (
    <div className="flex flex-col gap-[3px] w-36">
      <div className="flex justify-between items-center">
        <span
          style={{
            fontFamily: "'Courier New', monospace",
            fontSize: 10,
            color: "#94a3b8",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
          }}
        >
          {label}
        </span>
        <span
          style={{
            fontFamily: "'Courier New', monospace",
            fontSize: 10,
            color: "#94a3b8",
          }}
        >
          {Math.round(value)}/{max}
        </span>
      </div>

      {/* Track */}
      <div
        style={{
          width: "100%",
          height: 8,
          backgroundColor: "#1e293b",
          borderRadius: 2,
          overflow: "hidden",
        }}
      >
        {/* Fill */}
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            backgroundColor: fillColor,
            borderRadius: 2,
            transition: "width 0.1s linear",
          }}
        />
      </div>
    </div>
  );
}

// ============================================================
// [🧱 BLOCK: Kill Progress]
// Linear bar showing kills / threshold.
// ============================================================
function KillBar({
  kills,
  threshold,
}: {
  kills: number;
  threshold: number;
}) {
  const pct = Math.min(kills / threshold, 1) * 100;
  const done = kills >= threshold;

  return (
    <div className="flex flex-col gap-[3px] w-36">
      <div className="flex justify-between items-center">
        <span
          style={{
            fontFamily: "'Courier New', monospace",
            fontSize: 10,
            color: done ? "#4ade80" : "#94a3b8",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
          }}
        >
          {done ? "⚡ Gate Open" : "Kills"}
        </span>
        <span
          style={{
            fontFamily: "'Courier New', monospace",
            fontSize: 10,
            color: done ? "#4ade80" : "#94a3b8",
          }}
        >
          {kills}/{threshold}
        </span>
      </div>

      <div
        style={{
          width: "100%",
          height: 8,
          backgroundColor: "#1e293b",
          borderRadius: 2,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            backgroundColor: done ? "#4ade80" : "#f87171",
            borderRadius: 2,
            transition: "width 0.1s linear",
          }}
        />
      </div>
    </div>
  );
}

// ============================================================
// [🧱 BLOCK: HUD Footer]
// A single horizontal bar sitting flush below the canvas.
// Width matches CANVAS_W (800px) set in GameCanvas.tsx.
// ============================================================
export default function HUD({
  hp,
  maxHp,
  stamina,
  maxStamina,
  kills,
  killThreshold,
  room,
  floor,
}: HUDProps) {
  const isDead = hp <= 0;

  return (
    <div
      style={{
        width: 800,
        backgroundColor: "#0f172a",
        borderLeft: "4px solid #334155",
        borderRight: "4px solid #334155",
        borderBottom: "4px solid #334155",
        borderRadius: "0 0 8px 8px",
        padding: "10px 20px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
      }}
    >
      {/* LEFT — HP + Stamina */}
      <div style={{ display: "flex", gap: 20 }}>
        <StatBar
          value={hp}
          max={maxHp}
          fillColor={hp / maxHp > 0.5 ? "#f87171" : hp / maxHp > 0.25 ? "#facc15" : "#ef4444"}
          label="HP"
        />
        <StatBar
          value={stamina}
          max={maxStamina}
          fillColor="#facc15"
          label="Stamina"
        />
      </div>

      {/* CENTER — Room + Floor label */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 1,
        }}
      >
        <span
          style={{
            fontFamily: "'Courier New', monospace",
            fontSize: 9,
            color: "#475569",
            letterSpacing: "0.15em",
            textTransform: "uppercase",
          }}
        >
          Floor {floor}
        </span>
        <span
          style={{
            fontFamily: "'Courier New', monospace",
            fontSize: 18,
            fontWeight: 900,
            color: isDead ? "#ef4444" : "#f1f5f9",
            letterSpacing: "0.05em",
          }}
        >
          {isDead ? "YOU DIED" : `ROOM ${room}/3`}
        </span>
      </div>

      {/* RIGHT — Kill bar */}
      <KillBar kills={kills} threshold={killThreshold} />
    </div>
  );
}