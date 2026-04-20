// src/components/overlays/VictoryOverlay.tsx
"use client";

import React, { useEffect, useState } from "react";
import { PlayerStats }                from "@/engine/PlayerStats";
import "@/styles/victory.css";

// ============================================================
// [🧱 BLOCK: Props]
// ============================================================
interface Props {
  floor:           number;
  kills:           number;        // kills this floor only
  goldEarned:      number;        // gold this floor only
  totalKills:      number;        // run-wide total
  totalGoldEarned: number;        // run-wide total
  runStartTime:    number;        // Date.now() at run start
  playerStats:     PlayerStats;
  onContinue:      () => void;
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
// [🧱 BLOCK: Stat Row]
// ============================================================
function StatRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="victory-stat-row">
      <span className="victory-stat-row__icon">{icon}</span>
      <span className="victory-stat-row__label">{label}</span>
      <span className="victory-stat-row__value">{value}</span>
    </div>
  );
}

// ============================================================
// [🧱 BLOCK: VictoryOverlay]
// Two panels: floor summary (left) + run summary (right).
// ============================================================
export default function VictoryOverlay({
  floor, kills, goldEarned,
  totalKills, totalGoldEarned, runStartTime,
  playerStats, onContinue, onQuit,
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

  return (
    <div className="victory-backdrop">
      <div className={`victory-card ${visible ? "victory-card--visible" : ""}`}>

        {/* ── Title ── */}
        <div className="victory-title-block">
          <p className="victory-title">FLOOR CLEAR</p>
          <p className="victory-subtitle">Floor {floor} Conquered</p>
        </div>

        <div className="victory-divider" />

        {/* ── Two-column summaries ── */}
        <div className="victory-summaries">

          {/* Floor summary */}
          <div className="victory-summary">
            <p className="victory-summary__label">Floor {floor} Summary</p>
            <div className="victory-stats">
              <StatRow icon="☠"  label="Kills"        value={String(kills)}        />
              <StatRow icon="💰" label="Gold earned"  value={`${goldEarned}g`}     />
              <StatRow icon="📍" label="Depth"        value={`Floor ${floor}`}     />
            </div>
          </div>

          {/* Vertical rule */}
          <div className="victory-col-divider" />

          {/* Run summary */}
          <div className="victory-summary">
            <p className="victory-summary__label">Run So Far</p>
            <div className="victory-stats">
              <StatRow icon="⏱" label="Time"         value={formatTime(elapsed)}        />
              <StatRow icon="☠" label="Total kills"  value={String(totalKills)}         />
              <StatRow icon="💰" label="Total gold"  value={`${totalGoldEarned}g`}      />
              <StatRow icon="⚔" label="Weapon"       value={weapon}                     />
            </div>

            {/* Charms row */}
            {playerStats.charms.length > 0 && (
              <div className="victory-charms">
                <p className="victory-charms__label">
                  Charms ({playerStats.charms.length}/{playerStats.maxCharms})
                </p>
                <div className="victory-charms__list">
                  {playerStats.charms.map((charm) => (
                    <div key={charm.id} className="victory-charm-pill">
                      <span className="victory-charm-pill__icon">{charm.icon}</span>
                      <span className="victory-charm-pill__name">{charm.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

        </div>

        <p className="victory-warning">
          The dungeon grows darker. Floor {floor + 1} awaits.
        </p>

        <div className="victory-divider" />

        {/* ── Buttons ── */}
        <div className="victory-buttons">
          <button
            className="victory-btn victory-btn--primary"
            onClick={onContinue}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#86efac")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "#4ade80")}
          >
            ▶ Descend to Floor {floor + 1}
          </button>
          <button
            className="victory-btn victory-btn--secondary"
            onClick={onQuit}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "#f1f5f9";
              e.currentTarget.style.borderColor = "#475569";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "";
              e.currentTarget.style.borderColor = "";
            }}
          >
            ← Retreat to Menu
          </button>
        </div>

      </div>
    </div>
  );
}