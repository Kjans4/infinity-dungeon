// src/components/overlays/VictoryOverlay.tsx
"use client";

import React, { useEffect, useState } from "react";
import "@/styles/victory.css";

// ============================================================
// [🧱 BLOCK: Props]
// Removed cycle-related props. Logic is now pure infinite.
// ============================================================
interface Props {
  floor:      number;
  kills:      number;   // kills this floor only
  goldEarned: number;   // gold this floor only
  onContinue: () => void;
  onQuit:     () => void;
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
// Simplified to a single mode: Floor Clear.
// No more "Cycle" interruptions or expanded cards.
// ============================================================
export default function VictoryOverlay({
  floor, kills, goldEarned, onContinue, onQuit,
}: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 80);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="victory-backdrop">
      <div className={`victory-card ${visible ? "victory-card--visible" : ""}`}>

        <div className="victory-title-block">
          <p className="victory-title">FLOOR CLEAR</p>
          <p className="victory-subtitle">Floor {floor} Conquered</p>
        </div>

        <div className="victory-divider" />

        <div className="victory-summary">
          <p className="victory-summary__label">Floor Summary</p>
          <div className="victory-stats">
            <StatRow icon="☠"  label="Kills this floor" value={String(kills)}      />
            <StatRow icon="💰" label="Gold this floor"  value={`${goldEarned}g`}   />
            <StatRow icon="📍" label="Current Depth"   value={`Floor ${floor}`}    />
          </div>
        </div>

        <p className="victory-warning">
          The dungeon grows darker. Floor {floor + 1} awaits.
        </p>

        <div className="victory-divider" />

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