"use client";

import React from "react";
import "@/styles/hud.css";

// ============================================================
// [🧱 BLOCK: HUD Props]
// ============================================================
import { RoomPhase } from "@/engine/RoomManager";

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
  bossHp:        number;
  bossMaxHp:     number;
  bossIsEnraged: boolean;
  roomPhase:     RoomPhase;
}

// ============================================================
// [🧱 BLOCK: Thin Bar]
// ============================================================
function ThinBar({ value, max, color, label }: {
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
          style={{ width: `${pct}%`, background: color, boxShadow: `0 0 6px ${color}` }}
        />
      </div>
    </div>
  );
}

// ============================================================
// [🧱 BLOCK: Gem Divider]
// Vertical rule with a gold diamond at center.
// ============================================================
function Divider() {
  return (
    <div className="hud-divider">
      <div className="hud-divider-gem" />
    </div>
  );
}

// ============================================================
// [🧱 BLOCK: Kill Ring — Rune Circle]
// ============================================================
function KillRing({ kills, threshold, isElite }: {
  kills: number; threshold: number; isElite: boolean;
}) {
  const done          = kills >= threshold;
  const pct           = done ? 1 : Math.min(kills / threshold, 1);
  const radius        = 17;
  const circumference = 2 * Math.PI * radius;
  const dashOffset    = circumference * (1 - pct);

  const extraKills    = done ? kills - threshold : 0;
  const tier          = Math.floor(extraKills / 10);
  const multiplier    = done ? Math.max(0.20, 1.0 - tier * 0.20) : 1.0;
  const multiplierPct = Math.round(multiplier * 100);

  const baseIncompleteColor = isElite ? "#f97316" : "#c0860c";
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
        {/* Outer rune tick marks */}
        <svg
          style={{ position: "absolute", inset: "-4px", width: "calc(100% + 8px)", height: "calc(100% + 8px)" }}
          viewBox="0 0 52 52"
        >
          {Array.from({ length: 12 }).map((_, i) => {
            const angle  = (i / 12) * Math.PI * 2 - Math.PI / 2;
            const r1     = 24; const r2 = 22;
            const x1     = 26 + Math.cos(angle) * r1;
            const y1     = 26 + Math.sin(angle) * r1;
            const x2     = 26 + Math.cos(angle) * r2;
            const y2     = 26 + Math.sin(angle) * r2;
            return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#3a2808" strokeWidth="1.5" />;
          })}
        </svg>

        <svg className="hud-kill-ring-svg" width="44" height="44" viewBox="0 0 44 44">
          {/* Track */}
          <circle cx="22" cy="22" r={radius} fill="none" stroke="#1a1208" strokeWidth="4" />
          {/* Gold background ring */}
          <circle cx="22" cy="22" r={radius} fill="none" stroke="#2e2008" strokeWidth="4" />
          {/* Fill */}
          <circle
            cx="22" cy="22" r={radius} fill="none"
            stroke={ringColor}
            strokeWidth="4"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            strokeLinecap="butt"
            style={{
              transition: "stroke-dashoffset 0.1s linear, stroke 0.3s ease",
              filter: done ? `drop-shadow(0 0 5px ${ringColor})` : "none",
            }}
          />
        </svg>
        <div className="hud-kill-ring-count">
          {done ? (
            <span className="hud-kill-ring-number" style={{ color: ringColor }}>{extraKills}</span>
          ) : (
            <span className="hud-kill-ring-number" style={{ color: "#c0860c" }}>{kills}</span>
          )}
        </div>
      </div>

      {done ? (
        <div className="hud-kill-ring-farming">
          <span className="hud-kill-ring-label" style={{ color: ringColor, textShadow: `0 0 8px ${ringColor}` }}>
            GATE OPEN
          </span>
          <span className="hud-kill-ring-bonus" style={{ color: ringColor }}>
            {multiplierPct}% gold
          </span>
        </div>
      ) : (
        <span
          className="hud-kill-ring-label"
          style={{ color: isElite ? "rgba(249,115,22,0.8)" : "#5a4010" }}
        >
          {kills} / {threshold}
        </span>
      )}
    </div>
  );
}

// ============================================================
// [🧱 BLOCK: Boss HP Bar]
// ============================================================
function BossHPBar({ hp, maxHp, isEnraged, floor }: {
  hp: number; maxHp: number; isEnraged: boolean; floor: number;
}) {
  const pct = Math.max(0, Math.min(1, hp / maxHp));
  const barColor =
    pct > 0.5  ? "#ef4444" :
    pct > 0.25 ? "#f97316" :
                 "#fbbf24";
  const nameColor = isEnraged ? "#f87171" : "#c0860c";
  const nameLabel = isEnraged ? "⚡ ENRAGED" : "BOSS";

  return (
    <div className={`hud-boss-bar ${isEnraged ? "hud-boss-bar--enraged" : ""}`}>
      <div className="hud-boss-bar__header">
        <span className="hud-boss-bar__name" style={{ color: nameColor }}>{nameLabel}</span>
        <span className="hud-boss-bar__hp">{Math.ceil(hp)} / {maxHp}</span>
      </div>
      <div className="hud-boss-bar__track">
        <div
          className="hud-boss-bar__fill"
          style={{ width: `${pct * 100}%`, background: barColor, boxShadow: isEnraged ? `0 0 8px ${barColor}` : "none" }}
        />
        {!isEnraged && <div className="hud-boss-bar__rage-marker" />}
      </div>
      <span className="hud-boss-bar__floor">Floor {floor} — Boss Chamber</span>
    </div>
  );
}

// ============================================================
// [🧱 BLOCK: HUD Root]
// ============================================================
export default function HUD({
  hp, maxHp, stamina, maxStamina,
  kills, killThreshold, room, floor, gold,
  bossHp, bossMaxHp, bossIsEnraged, roomPhase,
}: HUDProps) {
  const isEliteRoom = roomPhase === 'elite';
  const isBossRoom  = roomPhase === 'boss';

  const hpColor =
    hp / maxHp > 0.5  ? "#4ade80" :
    hp / maxHp > 0.25 ? "#facc15" :
                        "#ef4444";

  return (
    <>
      {bossHp > 0 && (
        <BossHPBar hp={bossHp} maxHp={bossMaxHp} isEnraged={bossIsEnraged} floor={floor} />
      )}

      {isEliteRoom && bossHp === 0 && (
        <div className="hud-elite-badge">⚡ Elite Sanctum</div>
      )}

      <div className="hud-root">
        <div className="hud-inner">

          {/* ── HP + Stamina ── */}
          <div className="hud-bars-group">
            <ThinBar value={hp}      max={maxHp}      color={hpColor}   label="Vitality" />
            <ThinBar value={stamina} max={maxStamina}  color="#60a5fa"   label="Stamina"  />
          </div>

          <Divider />

          {/* ── Floor / Room ── */}
          <div className="hud-room-group">
            <span className="hud-floor-label">Floor {floor}</span>
            <span
              className="hud-room-number"
              style={
                isEliteRoom ? { color: "#f97316", textShadow: "0 0 12px rgba(249,115,22,0.5)" } :
                isBossRoom  ? { color: "#ef4444", textShadow: "0 0 12px rgba(239,68,68,0.5)"  } :
                undefined
              }
            >
              {isEliteRoom ? "⚡ " : isBossRoom ? "💀 " : ""}Room {room}
            </span>
            {isEliteRoom && (
              <span className="hud-room-subtitle hud-room-subtitle--elite">Elite Room</span>
            )}
            {isBossRoom && (
              <span className="hud-room-subtitle hud-room-subtitle--boss">Boss Room</span>
            )}
          </div>

          <Divider />

          {/* ── Gold ── */}
          <div className="hud-gold-group">
            <span className="hud-gold-label">Treasury</span>
            <span className="hud-gold-value">{gold}g</span>
          </div>

          <Divider />

          {/* ── Kill Ring ── */}
          <KillRing kills={kills} threshold={killThreshold} isElite={isEliteRoom} />

        </div>
      </div>
    </>
  );
}