// src/components/overlays/VictoryOverlay.tsx
"use client";

import React, { useEffect, useState } from "react";
import { PlayerStats }                from "@/engine/PlayerStats";
import { getBoonById }                from "@/engine/BoonRegistry";
import { BOON_SLOT_COUNT }            from "@/engine/PlayerBoons";
import "@/styles/victory.css";

// ============================================================
// [🧱 BLOCK: Props]
// ============================================================
interface Props {
  floor:           number;
  kills:           number;
  goldEarned:      number;
  totalKills:      number;
  totalGoldEarned: number;
  runStartTime:    number;
  playerStats:     PlayerStats;
  onClose:         () => void;   // minimizes to badge
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
// Close button minimizes to badge — no longer blocks gameplay.
// ============================================================
export default function VictoryOverlay({
  floor, kills, goldEarned,
  totalKills, totalGoldEarned, runStartTime,
  playerStats, onClose, onQuit,
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

  const equippedBoons = playerStats.boons.slots
    .map((slot, i) => ({ slot, i }))
    .filter(({ slot }) => slot.boonId);

  return (
    <div className="victory-backdrop">
      <div className={`victory-card ${visible ? "victory-card--visible" : ""}`}>

        {/* ── Title + Close button ── */}
        <div className="victory-title-row">
          <div className="victory-title-block">
            <p className="victory-title">FLOOR CLEAR</p>
            <p className="victory-subtitle">Floor {floor} Conquered</p>
          </div>
          <button
            className="victory-close-btn"
            onClick={onClose}
            title="Minimize — return to game"
          >
            ✕
          </button>
        </div>

        <div className="victory-divider" />

        {/* ── Two-column summaries ── */}
        <div className="victory-summaries">

          <div className="victory-summary">
            <p className="victory-summary__label">Floor {floor} Summary</p>
            <div className="victory-stats">
              <StatRow icon="☠"  label="Kills"       value={String(kills)}    />
              <StatRow icon="💰" label="Gold earned" value={`${goldEarned}g`} />
              <StatRow icon="📍" label="Depth"       value={`Floor ${floor}`} />
            </div>
          </div>

          <div className="victory-col-divider" />

          <div className="victory-summary">
            <p className="victory-summary__label">Run So Far</p>
            <div className="victory-stats">
              <StatRow icon="⏱" label="Time"        value={formatTime(elapsed)}   />
              <StatRow icon="☠" label="Total kills" value={String(totalKills)}    />
              <StatRow icon="💰" label="Total gold" value={`${totalGoldEarned}g`} />
              <StatRow icon="⚔" label="Weapon"      value={weapon}               />
            </div>

            {equippedBoons.length > 0 && (
              <div className="victory-charms">
                <p className="victory-charms__label">
                  Boons ({equippedBoons.length}/{BOON_SLOT_COUNT})
                </p>
                <div className="victory-charms__list">
                  {equippedBoons.map(({ slot, i }) => {
                    const def = getBoonById(slot.boonId!);
                    if (!def) return null;
                    return (
                      <div key={i} className="victory-charm-pill">
                        <span className="victory-charm-pill__icon">{def.icon}</span>
                        <span className="victory-charm-pill__name">{def.name} · Lv{slot.level}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

        </div>

        <p className="victory-warning">
          The dungeon grows darker. Approach the gate to descend to Floor {floor + 1}.
        </p>

        <div className="victory-divider" />

        {/* ── Footer actions ── */}
        <div className="victory-buttons">
          <button
            className="victory-btn victory-btn--minimize"
            onClick={onClose}
          >
            ↙ Return to Game
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
