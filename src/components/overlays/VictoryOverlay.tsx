// src/components/overlays/VictoryOverlay.tsx
"use client";

import React, { useEffect, useState } from "react";
import "@/styles/victory.css";

// ============================================================
// [🧱 BLOCK: Props]
// ============================================================
interface Props {
  floor:           number;
  kills:           number;   // kills earned this floor only
  goldEarned:      number;   // gold earned this floor only
  runStartTime:    number;   // Date.now() at run start — for total time on win screen
  isFinalFloor:    boolean;  // true → show "YOU WIN" instead of "Enter Floor N+1"
  onContinue:      () => void;
  onQuit:          () => void; // only shown on final floor
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
// Two modes:
//   isFinalFloor=false → simple "floor cleared, keep going" card
//   isFinalFloor=true  → full "YOU WIN" screen with run summary
// ============================================================
export default function VictoryOverlay({
  floor, kills, goldEarned, runStartTime,
  isFinalFloor, onContinue, onQuit,
}: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 80);
    return () => clearTimeout(t);
  }, []);

  const elapsed = Date.now() - runStartTime;

  // ── Final floor — full win screen ─────────────────────────
  if (isFinalFloor) {
    return (
      <div className="victory-backdrop">
        <div className={`victory-card victory-card--win ${visible ? "victory-card--visible" : ""}`}>

          <div className="victory-title-block">
            <p className="victory-title victory-title--win">YOU WIN</p>
            <p className="victory-subtitle">All {floor} floors cleared</p>
          </div>

          <div className="victory-divider" />

          <div className="victory-summary">
            <p className="victory-summary__label">Run Summary</p>
            <div className="victory-stats">
              <StatRow icon="⏱" label="Total Time"  value={formatTime(elapsed)} />
              <StatRow icon="☠" label="Total Kills"  value={String(kills)}       />
              <StatRow icon="💰" label="Gold Earned" value={`${goldEarned}g`}    />
              <StatRow icon="🏆" label="Floors"      value={`${floor} / ${floor}`} />
            </div>
          </div>

          <div className="victory-divider" />

          <div className="victory-buttons">
            <button
              className="victory-btn victory-btn--primary"
              onClick={onQuit}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#86efac")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "#4ade80")}
            >
              ← Main Menu
            </button>
          </div>

        </div>
      </div>
    );
  }

  // ── Normal floor clear — compact card ─────────────────────
  return (
    <div className="victory-backdrop">
      <div className={`victory-card ${visible ? "victory-card--visible" : ""}`}>

        <div className="victory-title-block">
          <p className="victory-title">VICTORY</p>
          <p className="victory-subtitle">Floor {floor} cleared</p>
        </div>

        <div className="victory-divider" />

        <div className="victory-summary">
          <div className="victory-stats">
            <StatRow icon="☠" label="Kills this floor"  value={String(kills)}    />
            <StatRow icon="💰" label="Gold this floor"  value={`${goldEarned}g`} />
          </div>
        </div>

        <p className="victory-warning">Floor {floor + 1} — enemies are stronger.</p>

        <div className="victory-divider" />

        <div className="victory-buttons">
          <button
            className="victory-btn victory-btn--primary"
            onClick={onContinue}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#86efac")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "#4ade80")}
          >
            ▶ Enter Floor {floor + 1}
          </button>
        </div>

      </div>
    </div>
  );
}