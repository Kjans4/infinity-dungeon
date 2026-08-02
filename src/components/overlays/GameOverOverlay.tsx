// src/components/overlays/GameOverOverlay.tsx
"use client";

import React, { useEffect, useState } from "react";
import { PlayerStats }                from "@/engine/PlayerStats";
import { BOON_SLOT_COUNT }            from "@/engine/PlayerBoons";
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
// ============================================================
function formatTime(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const mins     = Math.floor(totalSec / 60);
  const secs     = totalSec % 60;
  if (mins === 0) return `${secs}s`;
  return `${mins}m ${secs}s`;
}

// ============================================================
// [🧱 BLOCK: Gem Divider]
// ============================================================
function GemDivider() {
  return (
    <div className="go-divider">
      <div className="go-divider-gem" />
    </div>
  );
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
// Fantasy RPG stone-panel aesthetic, matching pause/victory.
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

  const elapsed = Date.now() - runStartTime;
  const weapon  = playerStats.equippedWeaponItem
    ? `${playerStats.equippedWeaponItem.icon} ${playerStats.equippedWeaponItem.name}`
    : "👊 Bare Fists";
  const boons = `${playerStats.boons.filledCount} / ${BOON_SLOT_COUNT}`;

  return (
    <div className="go-backdrop">
      <div className={`go-card ${visible ? "go-card--visible" : ""}`}>
        <div className="go-card-inner">

          {/* ── Title ── */}
          <div className="go-title-block">
            <p className="go-subtitle-location">Floor {floor} · Room {room}</p>
            <p className="go-title">You Died</p>
          </div>

          <GemDivider />

          {/* ── Run Summary ── */}
          <div className="go-summary">
            <p className="go-summary__label">Run Summary</p>
            <div className="go-stats">
              <StatRow icon="⏱" label="Time"        value={formatTime(elapsed)}               />
              <StatRow icon="☠" label="Kills"        value={String(totalKills)}                />
              <StatRow icon="💰" label="Gold Earned" value={`${totalGoldEarned}g`}             />
              <StatRow icon="⚔" label="Weapon"       value={weapon}                            />
              <StatRow icon="🧿" label="Boons"        value={boons}                             />
              <StatRow icon="📍" label="Reached"     value={`Floor ${floor} · Room ${room}`}   />
            </div>
          </div>

          <GemDivider />

          {/* ── Buttons ── */}
          <div className="go-buttons">
            <button className="go-btn go-btn--retry" onClick={onRetry}>
              ▶ Raid Again
            </button>
            <button className="go-btn go-btn--quit" onClick={onQuit}>
              ← Main Menu
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
