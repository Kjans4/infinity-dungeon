//src/components/HUD.tsx
"use client";

import React from "react";
import "@/styles/hud.css";
import { RoomPhase } from "@/engine/RoomManager";
import { SKILL_COOLDOWN_MS } from "@/engine/WeaponSkillRegistry";

// ============================================================
// [🧱 BLOCK: Types]
// ============================================================
interface BoonChip { icon: string; level: number; }

// ============================================================
// [🧱 BLOCK: HUD Props]
// Hotbar (4 consumable slots) replaced by:
//  - Q/E weapon skill slots (icon + cooldown ring + active-buff bar)
//  - a 5-icon boon strip (read-only, mirrors equipped boon slots)
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
  qSkillIcon:    string | null;
  qSkillName:    string | null;
  qCooldownMs:   number;
  qDurationMs:   number;
  eSkillIcon:    string | null;
  eSkillName:    string | null;
  eCooldownMs:   number;
  eDurationMs:   number;
  boonSlots:     BoonChip[];
  isMobile?:     boolean;
}

const STAMINA_EMPTY_THRESHOLD = 5;

// ============================================================
// [🧱 BLOCK: Thin Bar]
// ============================================================
function ThinBar({ value, max, color, label, isEmpty = false }: {
  value: number; max: number; color: string; label: string; isEmpty?: boolean;
}) {
  const pct = Math.max(0, Math.min(1, value / max)) * 100;
  return (
    <div className="hud-bar-wrapper">
      <div className="hud-bar-header">
        <span className="hud-label">{label}</span>
        <span className="hud-value">{Math.round(value)}/{max}</span>
      </div>
      <div className={`hud-bar-track ${isEmpty ? "hud-bar-track--empty" : ""}`}>
        <div
          className={`hud-bar-fill ${isEmpty ? "hud-bar-fill--empty" : ""}`}
          style={{ width: `${pct}%`, background: isEmpty ? "#475569" : color, boxShadow: isEmpty ? "none" : `0 0 6px ${color}` }}
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
          <circle cx="22" cy="22" r={radius} fill="none" stroke="#1a1208" strokeWidth="4" />
          <circle cx="22" cy="22" r={radius} fill="none" stroke="#2e2008" strokeWidth="4" />
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
// [🧱 BLOCK: Skill Slot Widget — Q / E]
// Cooldown ring uses the flat SKILL_COOLDOWN_MS placeholder.
// Duration bar (bottom sliver) shows remaining active-buff time
// for buff-style skills (ward/wrath/iron/phantom) — 0 for
// instant-effect skills like fireball.
// ============================================================
function SkillSlotWidget({ label, icon, name, cooldownMs, durationMs }: {
  label: 'Q' | 'E';
  icon:  string | null;
  name:  string | null;
  cooldownMs: number;
  durationMs: number;
}) {
  const isEmpty    = !icon;
  const onCooldown = cooldownMs > 0;

  const R    = 18;
  const CIRC = 2 * Math.PI * R;
  const cdPct = onCooldown ? cooldownMs / SKILL_COOLDOWN_MS : 0;
  const sweepOffset = CIRC * (1 - cdPct);

  // Duration bar caps its visual fill at a generous ceiling so a
  // long buff (e.g. extended Wrath) doesn't look perpetually full.
  const durPct = durationMs > 0 ? Math.min(1, durationMs / 20000) : 0;

  return (
    <div
      className={`hud-hotbar-slot ${isEmpty ? "hud-hotbar-slot--empty" : ""} ${onCooldown ? "hud-hotbar-slot--cooldown" : ""}`}
      title={name ?? undefined}
    >
      <span className="hud-hotbar-slot__key">{label}</span>
      <span className="hud-hotbar-slot__icon">{icon ?? "·"}</span>
      {onCooldown && (
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
      )}
      {onCooldown && (
        <span className="hud-hotbar-slot__cd-text">
          {(cooldownMs / 1000).toFixed(1)}
        </span>
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
// [🧱 BLOCK: Skill Row — Q + E]
// ============================================================
function SkillRow({ qIcon, qName, qCooldownMs, qDurationMs, eIcon, eName, eCooldownMs, eDurationMs }: {
  qIcon: string | null; qName: string | null; qCooldownMs: number; qDurationMs: number;
  eIcon: string | null; eName: string | null; eCooldownMs: number; eDurationMs: number;
}) {
  return (
    <div className="hud-hotbar">
      <SkillSlotWidget label="Q" icon={qIcon} name={qName} cooldownMs={qCooldownMs} durationMs={qDurationMs} />
      <SkillSlotWidget label="E" icon={eIcon} name={eName} cooldownMs={eCooldownMs} durationMs={eDurationMs} />
    </div>
  );
}

// ============================================================
// [🧱 BLOCK: Boon Strip — 5 read-only icon chips]
// ============================================================
function BoonStrip({ boonSlots }: { boonSlots: BoonChip[] }) {
  return (
    <div className="hud-boon-strip">
      {boonSlots.map((chip, i) => (
        <div key={i} className={`hud-boon-chip ${!chip.icon ? "hud-boon-chip--empty" : ""}`}>
          <span className="hud-boon-chip__icon">{chip.icon || "—"}</span>
          {chip.icon && <span className="hud-boon-chip__level">{chip.level}</span>}
        </div>
      ))}
    </div>
  );
}

// ============================================================
// [🧱 BLOCK: Mobile HUD Strip]
// Compact bottom strip: HP bar | ST bar | Room/Floor | Kill | Gold
// Q/E + boons are handled by MobileControls / not shown here to
// save space — same rationale the old hotbar had on mobile.
// ============================================================
function MobileHUDStrip({ hp, maxHp, stamina, maxStamina, kills, killThreshold, room, floor, gold, roomPhase }: {
  hp: number; maxHp: number;
  stamina: number; maxStamina: number;
  kills: number; killThreshold: number;
  room: number; floor: number;
  gold: number;
  roomPhase: RoomPhase;
}) {
  const hpPct  = Math.max(0, Math.min(1, hp / maxHp));
  const stPct  = Math.max(0, Math.min(1, stamina / maxStamina));
  const hpColor =
    hpPct > 0.5  ? "#4ade80" :
    hpPct > 0.25 ? "#facc15" :
                   "#ef4444";
  const stEmpty = stamina < STAMINA_EMPTY_THRESHOLD;
  const isElite = roomPhase === 'elite';
  const isBoss  = roomPhase === 'boss';

  return (
    <div className="hud-mobile-strip">
      {/* Bars */}
      <div className="hud-mobile-strip__bars">
        <div className="hud-mobile-strip__bar-row">
          <span className="hud-mobile-strip__bar-label">HP</span>
          <div className="hud-mobile-strip__bar-track">
            <div className="hud-mobile-strip__bar-fill" style={{ width: `${hpPct * 100}%`, background: hpColor }} />
          </div>
        </div>
        <div className="hud-mobile-strip__bar-row">
          <span className="hud-mobile-strip__bar-label">ST</span>
          <div className={`hud-mobile-strip__bar-track ${stEmpty ? 'hud-mobile-strip__bar-track--empty' : ''}`}>
            <div className="hud-mobile-strip__bar-fill" style={{ width: `${stPct * 100}%`, background: stEmpty ? '#475569' : '#60a5fa' }} />
          </div>
        </div>
      </div>

      <div className="hud-mobile-strip__divider" />

      {/* Room / Floor */}
      <div className="hud-mobile-strip__cell">
        <span className="hud-mobile-strip__sublabel">ROOM</span>
        <span className="hud-mobile-strip__value" style={
          isElite ? { color: '#f97316' } : isBoss ? { color: '#ef4444' } : undefined
        }>{room}</span>
      </div>

      <div className="hud-mobile-strip__divider" />

      <div className="hud-mobile-strip__cell">
        <span className="hud-mobile-strip__sublabel">FLOOR</span>
        <span className="hud-mobile-strip__value">{floor}</span>
      </div>

      <div className="hud-mobile-strip__divider" />

      {/* Kill count */}
      <div className="hud-mobile-strip__cell">
        <span className="hud-mobile-strip__sublabel">KILL</span>
        <span className="hud-mobile-strip__value" style={{ color: kills >= killThreshold ? '#4ade80' : undefined }}>
          {kills}/{killThreshold}
        </span>
      </div>

      <div className="hud-mobile-strip__divider" />

      {/* Gold */}
      <div className="hud-mobile-strip__cell">
        <span className="hud-mobile-strip__sublabel">GOLD</span>
        <span className="hud-mobile-strip__value" style={{ color: '#f0c040' }}>{gold}g</span>
      </div>
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
  qSkillIcon, qSkillName, qCooldownMs, qDurationMs,
  eSkillIcon, eSkillName, eCooldownMs, eDurationMs,
  boonSlots,
  isMobile = false,
}: HUDProps) {
  const isEliteRoom = roomPhase === 'elite';
  const isBossRoom  = roomPhase === 'boss';

  const hpColor =
    hp / maxHp > 0.5  ? "#4ade80" :
    hp / maxHp > 0.25 ? "#facc15" :
                        "#ef4444";
  const staminaEmpty = stamina < STAMINA_EMPTY_THRESHOLD;

  return (
    <>
      {bossHp > 0 && (
        <BossHPBar hp={bossHp} maxHp={bossMaxHp} isEnraged={bossIsEnraged} floor={floor} />
      )}

      {isEliteRoom && bossHp === 0 && !isMobile && (
        <div className="hud-elite-badge">⚡ Elite Sanctum</div>
      )}

      {/* Desktop HUD banner */}
      {!isMobile && (
        <div className="hud-root">
          <div className="hud-inner">
            <div className="hud-bars-group">
              <ThinBar value={hp}      max={maxHp}     color={hpColor}  label="Vitality" />
              <ThinBar value={stamina} max={maxStamina} color="#60a5fa" label="Stamina" isEmpty={staminaEmpty} />
            </div>
            <Divider />
            <div className="hud-skills-group">
              <SkillRow
                qIcon={qSkillIcon} qName={qSkillName} qCooldownMs={qCooldownMs} qDurationMs={qDurationMs}
                eIcon={eSkillIcon} eName={eSkillName} eCooldownMs={eCooldownMs} eDurationMs={eDurationMs}
              />
              <BoonStrip boonSlots={boonSlots} />
            </div>
            <Divider />
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
              {isEliteRoom && <span className="hud-room-subtitle hud-room-subtitle--elite">Elite Room</span>}
              {isBossRoom  && <span className="hud-room-subtitle hud-room-subtitle--boss">Boss Room</span>}
            </div>
            <Divider />
            <div className="hud-gold-group">
              <span className="hud-gold-label">Treasury</span>
              <span className="hud-gold-value">{gold}g</span>
            </div>
            <Divider />
            <KillRing kills={kills} threshold={killThreshold} isElite={isEliteRoom} />
          </div>
        </div>
      )}

      {/* Mobile HUD strip */}
      {isMobile && (
        <MobileHUDStrip
          hp={hp} maxHp={maxHp}
          stamina={stamina} maxStamina={maxStamina}
          kills={kills} killThreshold={killThreshold}
          room={room} floor={floor} gold={gold}
          roomPhase={roomPhase}
        />
      )}
    </>
  );
}