// src/components/overlays/GameOverOverlay.tsx
"use client";

import React, { useEffect, useState } from "react";
import { PlayerStats }                from "@/engine/PlayerStats";
import "@/styles/gameover.css";

// ============================================================
// [🧱 BLOCK: Props]
// ============================================================
interface Props {
  floor:           number;
  room:            number;
  totalKills:      number;
  totalGoldEarned: number;
  runStartTime:    number;
  playerStats:     PlayerStats;
  onRetry:         () => void;
  onQuit:          () => void;
}

// ============================================================
// [🧱 BLOCK: Format Time]
// Converts ms elapsed into "Xm Ys" string.
// ============================================================
function formatTime(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const mins     = Math.floor(totalSec / 60);
  const secs     = totalSec % 60;
  if (mins === 0) return `${secs}s`;
  return `${mins}m ${secs}s`;
}

// ============================================================
// [🧱 BLOCK: Stat Row]
// ============================================================
function StatRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="go-stat-row">
      <span className="go-stat-row__icon">{icon}</span>
      <span className="go-stat-row__label">{label}</span>
      <span className="go-stat-row__value">{value}</span>
    </div>
  );
}

// ============================================================
// [🧱 BLOCK: GameOverOverlay]
// Fades in with staggered stat rows.
// ============================================================
export default function GameOverOverlay({
  floor, room, totalKills, totalGoldEarned,
  runStartTime, playerStats, onRetry, onQuit,
}: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 80);
    return () => clearTimeout(t);
  }, []);

  const elapsed  = Date.now() - runStartTime;
  const weapon   = playerStats.equippedWeaponItem
    ? `${playerStats.equippedWeaponItem.icon} ${playerStats.equippedWeaponItem.name}`
    : "👊 Bare Fists";
  const charms   = `${playerStats.charms.length} / ${playerStats.maxCharms}`;

  return (
    <div className="go-backdrop">
      <div className={`go-card ${visible ? "go-card--visible" : ""}`}>

        {/* ── Title ── */}
        <div className="go-title-block">
          <p className="go-title">YOU DIED</p>
          <p className="go-subtitle">Floor {floor} · Room {room}</p>
        </div>

        <div className="go-divider" />

        {/* ── Run Summary ── */}
        <div className="go-summary">
          <p className="go-summary__label">Run Summary</p>
          <div className="go-stats">
            <StatRow icon="⏱" label="Time"         value={formatTime(elapsed)}          />
            <StatRow icon="☠" label="Kills"         value={String(totalKills)}           />
            <StatRow icon="💰" label="Gold Earned"  value={`${totalGoldEarned}g`}        />
            <StatRow icon="⚔" label="Weapon"        value={weapon}                       />
            <StatRow icon="🧿" label="Charms"        value={charms}                       />
            <StatRow icon="📍" label="Reached"      value={`Floor ${floor} · Room ${room}`} />
          </div>
        </div>

        <div className="go-divider" />

        {/* ── Buttons ── */}
        <div className="go-buttons">
          <button
            onClick={onRetry}
            className="go-btn go-btn--retry"
            onMouseEnter={(e) => (e.currentTarget.style.background = "#f87171")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "#ef4444")}
          >
            ▶ Raid Again
          </button>
          <button
            onClick={onQuit}
            className="go-btn go-btn--quit"
            onMouseEnter={(e) => {
              e.currentTarget.style.color  = "#f1f5f9";
              e.currentTarget.style.border = "1px solid #475569";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color  = "#475569";
              e.currentTarget.style.border = "1px solid #1e293b";
            }}
          >
            ← Main Menu
          </button>
        </div>

      </div>
    </div>
  );
}