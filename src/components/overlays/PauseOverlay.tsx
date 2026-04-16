// src/components/overlays/PauseOverlay.tsx
"use client";

import React, { useState } from "react";
import { PlayerStats, STAT_DEFS } from "@/engine/PlayerStats";
import { Player }                 from "@/engine/Player";
import "@/styles/pause.css";

// ============================================================
// [🧱 BLOCK: Props]
// ============================================================
interface Props {
  floor:        number;
  room:         number;
  hp:           number;
  maxHp:        number;
  gold:         number;
  playerStats:  PlayerStats;
  player:       Player;
  onResume:     () => void;
  onQuit:       () => void;
}

// ============================================================
// [🧱 BLOCK: Controls Reference]
// ============================================================
const CONTROLS = [
  { key: "W A S D", desc: "Move"                  },
  { key: "J",       desc: "Light Attack / Charge"  },
  { key: "K",       desc: "Heavy Attack / Charge"  },
  { key: "L (tap)", desc: "Parry"                  },
  { key: "L (hold)",desc: "Block"                  },
  { key: "C",       desc: "Dash"                   },
  { key: "F",       desc: "Talk to NPC"            },
  { key: "Escape",  desc: "Pause / Resume"         },
];

// ============================================================
// [🧱 BLOCK: Stats Panel]
// ============================================================
function StatsPanel({ hp, maxHp, gold, playerStats }: {
  hp: number; maxHp: number; gold: number; playerStats: PlayerStats;
}) {
  const hpPct   = Math.round((hp / maxHp) * 100);
  const hpColor = hpPct > 50 ? "#4ade80" : hpPct > 25 ? "#facc15" : "#ef4444";

  return (
    <div className="pause-stats">

      <div className="pause-stats__section">
        <div className="pause-stats__row-spread">
          <span className="pause-stats__label">❤️ HP</span>
          <span className="pause-stats__value" style={{ color: hpColor }}>
            {Math.round(hp)} / {maxHp}
          </span>
        </div>
        <div className="pause-stats__bar-track">
          <div
            className="pause-stats__bar-fill"
            style={{ width: `${hpPct}%`, background: hpColor }}
          />
        </div>
      </div>

      <div className="pause-stats__row-spread">
        <span className="pause-stats__label">💰 Gold</span>
        <span className="pause-stats__value" style={{ color: "#facc15" }}>{gold}g</span>
      </div>

      <div className="pause-stats__section">
        <p className="pause-stats__sublabel">Stats</p>
        <div className="pause-stats__stat-grid">
          {STAT_DEFS.map((def) => (
            <div key={def.key} className="pause-stats__stat-row">
              <span className="pause-stats__stat-icon">{def.icon}</span>
              <span className="pause-stats__stat-key">{def.label}</span>
              <span className="pause-stats__stat-val">{playerStats[def.key]}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="pause-stats__section">
        <p className="pause-stats__sublabel">Weapon</p>
        {playerStats.equippedWeaponItem ? (
          <div className="pause-stats__weapon">
            <span className="pause-stats__weapon-icon">
              {playerStats.equippedWeaponItem.icon}
            </span>
            <div>
              <p className="pause-stats__weapon-name">
                {playerStats.equippedWeaponItem.name}
              </p>
              <p className="pause-stats__weapon-type">
                {playerStats.equippedWeaponItem.weaponType}
              </p>
            </div>
          </div>
        ) : (
          <p className="pause-stats__empty">👊 Bare Fists</p>
        )}
      </div>

      <div className="pause-stats__section">
        <p className="pause-stats__sublabel">
          Charms ({playerStats.charms.length}/{playerStats.maxCharms})
        </p>
        {playerStats.charms.length === 0 ? (
          <p className="pause-stats__empty">None equipped</p>
        ) : (
          <div className="pause-stats__charms">
            {playerStats.charms.map((charm) => (
              <div key={charm.id} className="pause-stats__charm-row">
                <span>{charm.icon}</span>
                <span className="pause-stats__charm-name">{charm.name}</span>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}

// ============================================================
// [🧱 BLOCK: PauseOverlay Component]
// ============================================================
export default function PauseOverlay({
  floor, room, hp, maxHp, gold, playerStats, player,
  onResume, onQuit,
}: Props) {
  const [confirmQuit, setConfirmQuit] = useState(false);

  return (
    <div className="pause-backdrop">
      <div className="pause-card">

        <div className="pause-title-block">
          <p className="pause-location">Floor {floor} · Room {room}</p>
          <p className="pause-title">PAUSED</p>
        </div>

        <div className="pause-divider" />

        <div className="pause-columns">

          <StatsPanel
            hp={hp} maxHp={maxHp}
            gold={gold} playerStats={playerStats}
          />

          <div className="pause-controls">
            <p className="pause-controls__label">Controls</p>
            {CONTROLS.map(({ key, desc }) => (
              <div key={key} className="pause-controls__row">
                <span className="pause-controls__key">{key}</span>
                <span className="pause-controls__desc">{desc}</span>
              </div>
            ))}
          </div>

        </div>

        <div className="pause-divider" />

        <div className="pause-buttons">
          <button
            onClick={onResume}
            className="pause-btn pause-btn--resume"
            onMouseEnter={(e) => (e.currentTarget.style.background = "#e2e8f0")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "#f1f5f9")}
          >
            ▶ Resume
          </button>

          {!confirmQuit ? (
            <button
              onClick={() => setConfirmQuit(true)}
              className="pause-btn pause-btn--quit"
              onMouseEnter={(e) => {
                e.currentTarget.style.color  = "#ef4444";
                e.currentTarget.style.border = "1px solid #ef4444";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color  = "#64748b";
                e.currentTarget.style.border = "1px solid #1e293b";
              }}
            >
              Quit to Menu
            </button>
          ) : (
            <div className="pause-confirm-row">
              <button
                onClick={onQuit}
                className="pause-btn pause-btn--confirm-yes"
                onMouseEnter={(e) => (e.currentTarget.style.background = "#f87171")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "#ef4444")}
              >
                Yes, Quit
              </button>
              <button
                onClick={() => setConfirmQuit(false)}
                className="pause-btn pause-btn--confirm-cancel"
                onMouseEnter={(e) => (e.currentTarget.style.color = "#f1f5f9")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#64748b")}
              >
                Cancel
              </button>
            </div>
          )}
        </div>

      </div>

      <p className="pause-hint">Press ESC to resume</p>
    </div>
  );
}