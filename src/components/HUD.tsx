"use client";

import React from "react";
import "@/styles/hud.css";
import { RoomPhase } from "@/engine/RoomManager";
import { HotbarSlot } from "@/engine/PlayerConsumables";
import { CONSUMABLE_REGISTRY, SLOT_COOLDOWNS } from "@/engine/ConsumableRegistry";

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
  bossHp:        number;
  bossMaxHp:     number;
  bossIsEnraged: boolean;
  roomPhase:     RoomPhase;
  hotbar:        [HotbarSlot, HotbarSlot, HotbarSlot, HotbarSlot];
  isMobile:      boolean;
  onPause:       () => void;
  onInventory:   () => void;
  onActivateSlot?: (index: number) => void;
  isMinimized?:  boolean;
  onMinimize?:   () => void;
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
          style={{ width: `${pct}%`, background: color, boxShadow: `0 0 5px ${color}` }}
        />
      </div>
    </div>
  );
}

// ============================================================
// [🧱 BLOCK: Gem Divider]
// ============================================================
function Divider() {
  return (
    <div className="hud-divider">
      <div className="hud-divider-gem" />
    </div>
  );
}

// ============================================================
// [🧱 BLOCK: Kill Ring]
// ============================================================
function KillRing({ kills, threshold, isElite }: {
  kills: number; threshold: number; isElite: boolean;
}) {
  const done          = kills >= threshold;
  const pct           = done ? 1 : Math.min(kills / threshold, 1);
  const radius        = 14;
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
        <svg
          style={{ position: "absolute", inset: "-3px", width: "calc(100% + 6px)", height: "calc(100% + 6px)" }}
          viewBox="0 0 44 44"
        >
          {Array.from({ length: 12 }).map((_, i) => {
            const angle = (i / 12) * Math.PI * 2 - Math.PI / 2;
            const r1 = 20; const r2 = 18;
            return (
              <line
                key={i}
                x1={22 + Math.cos(angle) * r1} y1={22 + Math.sin(angle) * r1}
                x2={22 + Math.cos(angle) * r2} y2={22 + Math.sin(angle) * r2}
                stroke="#3a2808" strokeWidth="1.5"
              />
            );
          })}
        </svg>
        <svg className="hud-kill-ring-svg" width="38" height="38" viewBox="0 0 36 36">
          <circle cx="18" cy="18" r={radius} fill="none" stroke="#1a1208" strokeWidth="3.5" />
          <circle cx="18" cy="18" r={radius} fill="none" stroke="#2e2008" strokeWidth="3.5" />
          <circle
            cx="18" cy="18" r={radius} fill="none"
            stroke={ringColor}
            strokeWidth="3.5"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            strokeLinecap="butt"
            style={{
              transition: "stroke-dashoffset 0.1s linear, stroke 0.3s ease",
              filter: done ? `drop-shadow(0 0 4px ${ringColor})` : "none",
            }}
          />
        </svg>
        <div className="hud-kill-ring-count">
          <span className="hud-kill-ring-number" style={{ color: done ? ringColor : "#c0860c" }}>
            {done ? extraKills : kills}
          </span>
        </div>
      </div>
      {done ? (
        <div className="hud-kill-ring-farming">
          <span className="hud-kill-ring-label" style={{ color: ringColor, textShadow: `0 0 6px ${ringColor}` }}>OPEN</span>
          <span className="hud-kill-ring-bonus" style={{ color: ringColor }}>{multiplierPct}% g</span>
        </div>
      ) : (
        <span className="hud-kill-ring-label" style={{ color: isElite ? "rgba(249,115,22,0.8)" : "#5a4010" }}>
          {kills}/{threshold}
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
  const barColor = pct > 0.5 ? "#ef4444" : pct > 0.25 ? "#f97316" : "#fbbf24";
  const nameColor = isEnraged ? "#f87171" : "#c0860c";

  return (
    <div className={`hud-boss-bar ${isEnraged ? "hud-boss-bar--enraged" : ""}`}>
      <div className="hud-boss-bar__header">
        <span className="hud-boss-bar__name" style={{ color: nameColor }}>
          {isEnraged ? "⚡ ENRAGED" : "BOSS"}
        </span>
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
// [🧱 BLOCK: Single Hotbar Slot Widget]
// ============================================================
function HotbarSlotWidget({ slot, slotIndex, bagCount, onActivate, isMobile }: {
  slot:       HotbarSlot;
  slotIndex:  number;
  bagCount:   number;
  onActivate?: () => void;
  isMobile:   boolean;
}) {
  const def         = slot.assignedId ? CONSUMABLE_REGISTRY[slot.assignedId] : null;
  const cooldownMax = SLOT_COOLDOWNS[slotIndex];
  const cdPct       = slot.cooldownMs > 0 ? slot.cooldownMs / cooldownMax : 0;
  const durPct      = def && def.durationMs > 0 && slot.durationMs > 0
    ? slot.durationMs / def.durationMs : 0;

  const isEmpty    = !def;
  const onCooldown = slot.cooldownMs > 0;
  const noneLeft   = def && bagCount === 0;

  const R    = 18;
  const CIRC = 2 * Math.PI * R;
  const sweepOffset = CIRC * (1 - cdPct);

  return (
    <div
      className={[
        "hud-hotbar-slot",
        isEmpty    ? "hud-hotbar-slot--empty"    : "",
        onCooldown ? "hud-hotbar-slot--cooldown" : "",
        noneLeft   ? "hud-hotbar-slot--depleted" : "",
        isMobile   ? "hud-hotbar-slot--mobile"   : "",
      ].join(" ").trim()}
      onClick={onActivate}
      onTouchEnd={(e) => { e.preventDefault(); onActivate?.(); }}
    >
      <span className="hud-hotbar-slot__key">{slotIndex + 1}</span>
      <span className="hud-hotbar-slot__icon">{def ? def.icon : "·"}</span>
      {def && bagCount > 0 && (
        <span className="hud-hotbar-slot__count">x{bagCount}</span>
      )}
      {onCooldown && (
        <>
          <svg className="hud-hotbar-slot__cd-svg" viewBox="0 0 44 44">
            <circle
              cx="22" cy="22" r={R}
              fill="none"
              stroke="rgba(0,0,0,0.65)"
              strokeWidth="36"
              strokeDasharray={CIRC}
              strokeDashoffset={sweepOffset}
              strokeLinecap="butt"
              style={{ transform: "rotate(-90deg)", transformOrigin: "22px 22px" }}
            />
          </svg>
          <span className="hud-hotbar-slot__cd-text">
            {(slot.cooldownMs / 1000).toFixed(1)}
          </span>
        </>
      )}
      {durPct > 0 && (
        <div className="hud-hotbar-slot__dur-bar">
          <div className="hud-hotbar-slot__dur-fill" style={{ width: `${durPct * 100}%` }} />
        </div>
      )}
    </div>
  );
}

// ============================================================
// [🧱 BLOCK: HUD Root]
// Desktop: inline horizontal hotbar bottom-right of strip
// Mobile:  diagonal hotbar bottom-center-right (tappable)
// ============================================================
export default function HUD({
  hp, maxHp, stamina, maxStamina,
  kills, killThreshold, room, floor, gold,
  bossHp, bossMaxHp, bossIsEnraged, roomPhase,
  hotbar, isMobile,
  onPause, onInventory, onActivateSlot,
  isMinimized = false, onMinimize,
}: HUDProps) {
  const isEliteRoom = roomPhase === 'elite';
  const isBossRoom  = roomPhase === 'boss';

  const hpColor =
    hp / maxHp > 0.5  ? "#4ade80" :
    hp / maxHp > 0.25 ? "#facc15" : "#ef4444";

  const bagCounts = hotbar.map((slot) =>
    slot.assignedId ? (slot as any)._bagCount ?? 0 : 0
  );

  return (
    <>
      {/* ── Top-left: minimize + pause ── */}
      <div className="hud-top-controls">
        {onMinimize && (
          <button
            className="hud-control-btn hud-control-btn--minimize"
            onClick={onMinimize}
            title={isMinimized ? "Maximize HUD" : "Minimize HUD"}
          >
            {isMinimized ? "⤢" : "⤡"}
          </button>
        )}
        <button className="hud-control-btn" onClick={onPause} title="Pause (ESC)">
          ▶
        </button>
      </div>

      {/* ── Top-center: boss bar / elite badge ── */}
      {bossHp > 0 && (
        <BossHPBar hp={bossHp} maxHp={bossMaxHp} isEnraged={bossIsEnraged} floor={floor} />
      )}
      {isEliteRoom && bossHp === 0 && (
        <div className="hud-elite-badge">⚡ Elite Sanctum</div>
      )}

      {/* ── Bottom-left: HUD strip ── */}
      {!isMinimized && (
        <div className="hud-strip">
          <div className="hud-bars-group">
            <ThinBar value={hp}      max={maxHp}     color={hpColor} label="HP" />
            <ThinBar value={stamina} max={maxStamina} color="#60a5fa" label="ST" />
          </div>
          <Divider />
          <div className="hud-room-group">
            <span className="hud-floor-label">Floor {floor}</span>
            <span
              className="hud-room-number"
              style={
                isEliteRoom ? { color: "#f97316", textShadow: "0 0 10px rgba(249,115,22,0.5)" } :
                isBossRoom  ? { color: "#ef4444", textShadow: "0 0 10px rgba(239,68,68,0.5)" }  :
                undefined
              }
            >
              {isEliteRoom ? "⚡ " : isBossRoom ? "💀 " : ""}Room {room}
            </span>
            {isEliteRoom && <span className="hud-room-subtitle hud-room-subtitle--elite">Elite</span>}
            {isBossRoom  && <span className="hud-room-subtitle hud-room-subtitle--boss">Boss</span>}
          </div>
          <Divider />
          <div className="hud-gold-group">
            <span className="hud-gold-label">Gold</span>
            <span className="hud-gold-value">{gold}g</span>
          </div>
          <Divider />
          <KillRing kills={kills} threshold={killThreshold} isElite={isEliteRoom} />

          {/* Desktop: inline hotbar appended to strip */}
          {!isMobile && (
            <>
              <Divider />
              <div className="hud-hotbar-row">
                {hotbar.map((slot, i) => (
                  <HotbarSlotWidget
                    key={i} slot={slot} slotIndex={i}
                    bagCount={bagCounts[i] ?? 0}
                    isMobile={false}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Mobile: diagonal tappable hotbar grid */}
      {!isMinimized && isMobile && (
        <div className="hud-hotbar-grid">
          {hotbar.map((slot, i) => (
            <HotbarSlotWidget
              key={i} slot={slot} slotIndex={i}
              bagCount={bagCounts[i] ?? 0}
              onActivate={() => onActivateSlot?.(i)}
              isMobile
            />
          ))}
        </div>
      )}

      {/* ── Inventory button ── */}
      <button
        className="hud-inventory-btn"
        onClick={onInventory}
        onTouchEnd={(e) => { e.preventDefault(); onInventory(); }}
        title="Inventory (I)"
      >
        🎒
        <span className="hud-inventory-btn__label">[I]</span>
      </button>
    </>
  );
}