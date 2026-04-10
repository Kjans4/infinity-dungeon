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
  // Boss bar — only rendered when bossHp > 0
  bossHp:        number;
  bossMaxHp:     number;
  bossIsEnraged: boolean;
  // Elite room — tints the kill ring orange
  isEliteRoom:   boolean;
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
// Before threshold: fills red → green (or orange in elite room).
// After threshold:  stays full, shows +N extra kills and a
// gold tier indicator.
// ============================================================
function KillRing({
  kills, threshold, isElite,
}: {
  kills: number; threshold: number; isElite: boolean;
}) {
  const done          = kills >= threshold;
  const pct           = done ? 1 : Math.min(kills / threshold, 1);
  const radius        = 16;
  const circumference = 2 * Math.PI * radius;
  const dashOffset    = circumference * (1 - pct);

  // Gold tier after threshold
  const extraKills    = done ? kills - threshold : 0;
  const tier          = Math.floor(extraKills / 10);
  const multiplier    = done ? Math.max(0.20, 1.0 - tier * 0.20) : 1.0;
  const multiplierPct = Math.round(multiplier * 100);

  // Ring color — elite uses orange base instead of red
  const baseIncompleteColor = isElite ? "#f97316" : "#f87171";
  const ringColor = !done
    ? baseIncompleteColor
    : multiplier >= 1.0  ? "#4ade80"
    : multiplier >= 0.80 ? "#a3e635"
    : multiplier >= 0.60 ? "#facc15"
    : multiplier >= 0.40 ? "#fb923c"
    : "#f87171";

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
            stroke={ringColor}
            strokeWidth="4"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            style={{
              transition: "stroke-dashoffset 0.1s linear, stroke 0.3s ease",
              filter: done ? `drop-shadow(0 0 4px ${ringColor})` : "none",
            }}
          />
        </svg>
        <div className="hud-kill-ring-count">
          {done ? (
            <span className="hud-kill-ring-number" style={{ color: ringColor }}>
              +{extraKills}
            </span>
          ) : (
            <span className="hud-kill-ring-number" style={{ color: "#f1f5f9" }}>
              {kills}
            </span>
          )}
        </div>
      </div>

      {/* Label row */}
      {done ? (
        <div className="hud-kill-ring-farming">
          <span className="hud-kill-ring-label" style={{ color: ringColor, textShadow: `0 0 8px ${ringColor}` }}>
            ⚡ open
          </span>
          <span className="hud-kill-ring-bonus" style={{ color: ringColor }}>
            💰 {multiplierPct}%
          </span>
        </div>
      ) : (
        <span
          className="hud-kill-ring-label"
          style={{ color: isElite ? "rgba(249,115,22,0.7)" : "rgba(148,163,184,0.6)" }}
        >
          {isElite ? "⚡ " : ""}{kills}/{threshold}
        </span>
      )}
    </div>
  );
}

// ============================================================
// [🧱 BLOCK: Boss HP Bar]
// ============================================================
function BossHPBar({
  hp, maxHp, isEnraged, floor,
}: {
  hp: number; maxHp: number; isEnraged: boolean; floor: number;
}) {
  const pct = Math.max(0, Math.min(1, hp / maxHp));

  const barColor =
    pct > 0.5  ? "#ef4444" :
    pct > 0.25 ? "#f97316" :
                 "#fbbf24";

  const nameColor = isEnraged ? "#f87171" : "rgba(239,68,68,0.9)";
  const nameLabel = isEnraged ? "⚡ ENRAGED" : "BOSS";

  return (
    <div className={`hud-boss-bar ${isEnraged ? "hud-boss-bar--enraged" : ""}`}>

      {/* ── Header row: name + HP fraction ── */}
      <div className="hud-boss-bar__header">
        <span className="hud-boss-bar__name" style={{ color: nameColor }}>
          {nameLabel}
        </span>
        <span className="hud-boss-bar__hp">
          {Math.ceil(hp)} / {maxHp}
        </span>
      </div>

      {/* ── Bar track ── */}
      <div className="hud-boss-bar__track">
        <div
          className="hud-boss-bar__fill"
          style={{
            width: `${pct * 100}%`,
            background: barColor,
            boxShadow: isEnraged ? `0 0 8px ${barColor}` : "none",
          }}
        />
        {/* Rage threshold marker at 50% — hidden once enraged */}
        {!isEnraged && <div className="hud-boss-bar__rage-marker" />}
      </div>

      <span className="hud-boss-bar__floor">Floor {floor} Boss</span>
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
  bossHp, bossMaxHp, bossIsEnraged,
  isEliteRoom,
}: HUDProps) {
  const hpColor =
    hp / maxHp > 0.5  ? "#4ade80" :
    hp / maxHp > 0.25 ? "#facc15" :
                        "#ef4444";

  return (
    <>
      {/* ── Boss HP bar — top center, only during boss phase ── */}
      {bossHp > 0 && (
        <BossHPBar
          hp={bossHp}
          maxHp={bossMaxHp}
          isEnraged={bossIsEnraged}
          floor={floor}
        />
      )}

      {/* ── Elite room indicator — top center, below boss bar ── */}
      {isEliteRoom && bossHp === 0 && (
        <div className="hud-elite-badge">
          ⚡ ELITE ROOM
        </div>
      )}

      {/* ── Main HUD pill — bottom center ── */}
      <div className="hud-root">

        {/* ── HP + Stamina ── */}
        <div className="hud-bars-group">
          <ThinBar value={hp}      max={maxHp}     color={hpColor} label="HP"      />
          <ThinBar value={stamina} max={maxStamina} color="#3b82f6" label="Stamina" />
        </div>

        <Divider />

        {/* ── Room / Floor ── */}
        <div className="hud-room-group">
          <span className="hud-floor-label">Floor {floor}</span>
          <span
            className="hud-room-number"
            style={isEliteRoom ? { color: "#f97316" } : undefined}
          >
            ROOM {room}
          </span>
        </div>

        <Divider />

        {/* ── Gold ── */}
        <div className="hud-gold-group">
          <span className="hud-gold-label">Gold</span>
          <span className="hud-gold-value">💰 {gold}</span>
        </div>

        <Divider />

        {/* ── Kill Ring ── */}
        <KillRing kills={kills} threshold={killThreshold} isElite={isEliteRoom} />

      </div>
    </>
  );
}