"use client";

import React from "react";
import "@/styles/hud.css";

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
  gold:          number;
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
    <div className="hud-bar-wrapper">
      <div className="hud-bar-header">
        <span className="hud-label">{label}</span>
        <span className="hud-value">{Math.round(value)}/{max}</span>
      </div>
      <div className="hud-bar-track">
        <div
          className="hud-bar-fill"
          style={{
            width: `${pct}%`,
            background: color,
            boxShadow: `0 0 6px ${color}`,
          }}
        />
      </div>
    </div>
  );
}

// ============================================================
// [🧱 BLOCK: Kill Ring]
// ============================================================
function KillRing({ kills, threshold }: { kills: number; threshold: number }) {
  const pct           = Math.min(kills / threshold, 1);
  const radius        = 16;
  const circumference = 2 * Math.PI * radius;
  const dashOffset    = circumference * (1 - pct);
  const done          = kills >= threshold;

  return (
    <div className="hud-kill-ring-wrapper">
      <div className="hud-kill-ring-dial">
        <svg
          className="hud-kill-ring-svg"
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
        <div className="hud-kill-ring-count">
          <span
            className="hud-kill-ring-number"
            style={{ color: done ? "#4ade80" : "#f1f5f9" }}
          >
            {kills}
          </span>
        </div>
      </div>
      <span
        className="hud-kill-ring-label"
        style={{
          color: done ? "#4ade80" : "rgba(148,163,184,0.6)",
          textShadow: done ? "0 0 8px #4ade80" : "none",
        }}
      >
        {done ? "⚡ open" : `${kills}/${threshold}`}
      </span>
    </div>
  );
}

// ============================================================
// [🧱 BLOCK: Divider]
// ============================================================
function Divider() {
  return <div className="hud-divider" />;
}

// ============================================================
// [🧱 BLOCK: HUD Root]
// ============================================================
export default function HUD({
  hp, maxHp, stamina, maxStamina,
  kills, killThreshold, room, floor, gold,
}: HUDProps) {
  const hpColor =
    hp / maxHp > 0.5  ? "#4ade80" :
    hp / maxHp > 0.25 ? "#facc15" :
                        "#ef4444";

  return (
    <div className="hud-root">

      {/* ── HP + Stamina ── */}
      <div className="hud-bars-group">
        <ThinBar value={hp}      max={maxHp}      color={hpColor}  label="HP"      />
        <ThinBar value={stamina} max={maxStamina}  color="#3b82f6"  label="Stamina" />
      </div>

      <Divider />

      {/* ── Room / Floor ── */}
      <div className="hud-room-group">
        <span className="hud-floor-label">Floor {floor}</span>
        <span className="hud-room-number">ROOM {room}</span>
      </div>

      <Divider />

      {/* ── Gold ── */}
      <div className="hud-gold-group">
        <span className="hud-gold-label">Gold</span>
        <span className="hud-gold-value">💰 {gold}</span>
      </div>

      <Divider />

      {/* ── Kill Ring ── */}
      <KillRing kills={kills} threshold={killThreshold} />

    </div>
  );
}