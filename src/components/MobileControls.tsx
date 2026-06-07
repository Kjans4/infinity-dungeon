// src/components/MobileControls.tsx
"use client";

import React, { useRef, useEffect, useCallback, useState } from "react";
import { MobileInput, MobileAction } from "@/engine/MobileInput";
import { HotbarSlot } from "@/engine/PlayerConsumables";
import { CONSUMABLE_REGISTRY, SLOT_COOLDOWNS } from "@/engine/ConsumableRegistry";
import "@/styles/mobile-controls.css";

// ============================================================
// [🧱 BLOCK: Props]
// ============================================================
interface MobileControlsProps {
  mobileInput:    MobileInput;
  visible:        boolean;          // hide while menu/shop/gameover shown
  hp:             number;
  maxHp:          number;
  stamina:        number;
  maxStamina:     number;
  gold:           number;
  floor:          number;
  room:           number;
  kills:          number;
  killThreshold:  number;
  hotbar:         [HotbarSlot, HotbarSlot, HotbarSlot, HotbarSlot];
  bagCounts:      number[];
  onSlotActivate: (index: number) => void;
}

// ============================================================
// [🧱 BLOCK: Joystick Constants]
// ============================================================
const JOY_RADIUS      = 60;  // half of the 120px ring
const NUB_MAX_TRAVEL  = JOY_RADIUS - 12;

// ============================================================
// [🧱 BLOCK: Fullscreen Button]
// Maximise / restore using the Fullscreen API.
// ============================================================
function FullscreenButton() {
  const [isFs, setIsFs] = useState(false);

  useEffect(() => {
    const onFsChange = () => setIsFs(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  const toggle = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  }, []);

  return (
    <button
      className="mc-fullscreen"
      onPointerDown={(e) => { e.stopPropagation(); toggle(); }}
      aria-label={isFs ? "Exit fullscreen" : "Enter fullscreen"}
    >
      <svg className="mc-fullscreen__icon" viewBox="0 0 24 24">
        {isFs ? (
          // Minimize arrows
          <>
            <path d="M9 15H5v4" />
            <path d="M5 15l4 4" />
            <path d="M15 9h4V5" />
            <path d="M19 9l-4-4" />
            <path d="M9 9H5V5" />
            <path d="M5 9l4-4" />
            <path d="M15 15h4v4" />
            <path d="M19 15l-4 4" />
          </>
        ) : (
          // Expand arrows
          <>
            <path d="M3 7V3h4" />
            <path d="M3 3l6 6" />
            <path d="M21 7V3h-4" />
            <path d="M21 3l-6 6" />
            <path d="M3 17v4h4" />
            <path d="M3 21l6-6" />
            <path d="M21 17v4h-4" />
            <path d="M21 21l-6-6" />
          </>
        )}
      </svg>
    </button>
  );
}

// ============================================================
// [🧱 BLOCK: Virtual Joystick]
// Single-touch drag. Clamps nub to NUB_MAX_TRAVEL radius.
// ============================================================
function VirtualJoystick({ mobileInput }: { mobileInput: MobileInput }) {
  const ringRef   = useRef<HTMLDivElement>(null);
  const nubRef    = useRef<HTMLDivElement>(null);
  const touchId   = useRef<number | null>(null);
  const originRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const [active, setActive] = useState(false);

  const moveNub = useCallback((dx: number, dy: number) => {
    const mag  = Math.sqrt(dx * dx + dy * dy);
    const clamp = Math.min(mag, NUB_MAX_TRAVEL);
    const nx   = mag > 0 ? (dx / mag) * clamp : 0;
    const ny   = mag > 0 ? (dy / mag) * clamp : 0;
    if (nubRef.current) {
      nubRef.current.style.transform =
        `translate(calc(-50% + ${nx}px), calc(-50% + ${ny}px))`;
    }
    const normX = mag > 0 ? dx / mag : 0;
    const normY = mag > 0 ? dy / mag : 0;
    mobileInput.setJoystick(normX, normY);
  }, [mobileInput]);

  const resetNub = useCallback(() => {
    if (nubRef.current) {
      nubRef.current.style.transform = "translate(-50%, -50%)";
    }
    mobileInput.resetJoystick();
    setActive(false);
  }, [mobileInput]);

  useEffect(() => {
    const ring = ringRef.current;
    if (!ring) return;

    const onTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      if (touchId.current !== null) return;
      const touch = e.changedTouches[0];
      touchId.current = touch.identifier;
      const rect = ring.getBoundingClientRect();
      originRef.current = {
        x: rect.left + rect.width  / 2,
        y: rect.top  + rect.height / 2,
      };
      setActive(true);
      const dx = touch.clientX - originRef.current.x;
      const dy = touch.clientY - originRef.current.y;
      moveNub(dx, dy);
    };

    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      const touch = Array.from(e.changedTouches).find(
        (t) => t.identifier === touchId.current
      );
      if (!touch) return;
      const dx = touch.clientX - originRef.current.x;
      const dy = touch.clientY - originRef.current.y;
      moveNub(dx, dy);
    };

    const onTouchEnd = (e: TouchEvent) => {
      const touch = Array.from(e.changedTouches).find(
        (t) => t.identifier === touchId.current
      );
      if (!touch) return;
      touchId.current = null;
      resetNub();
    };

    ring.addEventListener("touchstart",  onTouchStart,  { passive: false });
    ring.addEventListener("touchmove",   onTouchMove,   { passive: false });
    ring.addEventListener("touchend",    onTouchEnd,    { passive: false });
    ring.addEventListener("touchcancel", onTouchEnd,    { passive: false });

    return () => {
      ring.removeEventListener("touchstart",  onTouchStart);
      ring.removeEventListener("touchmove",   onTouchMove);
      ring.removeEventListener("touchend",    onTouchEnd);
      ring.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [moveNub, resetNub]);

  return (
    <div className="mc-joystick" ref={ringRef}>
      <div className="mc-joystick__ring" />
      <div
        ref={nubRef}
        className={`mc-joystick__nub${active ? " mc-joystick__nub--active" : ""}`}
      />
    </div>
  );
}

// ============================================================
// [🧱 BLOCK: Action Button]
// Single button in the diamond. Each has its own touch id so
// multiple buttons can be pressed simultaneously.
// ============================================================
interface ActionButtonProps {
  action:    MobileAction;
  position:  "north" | "south" | "east" | "west";
  label:     string;
  icon:      React.ReactNode;
  mobileInput: MobileInput;
}

function ActionButton({ action, position, label, icon, mobileInput }: ActionButtonProps) {
  const [pressed, setPressed] = useState(false);
  const touchId = useRef<number | null>(null);

  const press = useCallback(() => {
    setPressed(true);
    mobileInput.setButton(action, true);
  }, [action, mobileInput]);

  const release = useCallback(() => {
    setPressed(false);
    mobileInput.setButton(action, false);
    touchId.current = null;
  }, [action, mobileInput]);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    if (touchId.current !== null) return;
    touchId.current = e.changedTouches[0].identifier;
    press();
  }, [press]);

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    const touch = Array.from(e.changedTouches).find(
      (t) => t.identifier === touchId.current
    );
    if (!touch) return;
    release();
  }, [release]);

  return (
    <div
      className={`mc-btn mc-btn--${position}${pressed ? " mc-btn--pressed" : ""}`}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchEnd}
    >
      <div className="mc-btn__shape" />
      <div className="mc-btn__label">
        {icon}
        <span>{label}</span>
      </div>
    </div>
  );
}

// ============================================================
// [🧱 BLOCK: SVG Icons for action buttons]
// ============================================================
const IconSword = (
  <svg className="mc-btn__icon" viewBox="0 0 24 24">
    <path d="M14.5 17.5L3 6V3h3l11.5 11.5" />
    <path d="M13 19l6-6" />
    <path d="M16 16l4 4" />
    <path d="M19 21l2-2" />
  </svg>
);
const IconHeavy = (
  <svg className="mc-btn__icon" viewBox="0 0 24 24">
    <path d="M14 3L21 10l-7 7-7-7 7-7z" />
    <path d="M3 21l6-6" />
  </svg>
);
const IconShield = (
  <svg className="mc-btn__icon" viewBox="0 0 24 24">
    <path d="M12 2L3 7v6c0 5.25 3.75 9.74 9 10.93C17.25 22.74 21 18.25 21 13V7L12 2z" />
  </svg>
);
const IconDash = (
  <svg className="mc-btn__icon" viewBox="0 0 24 24">
    <path d="M5 12h14" />
    <path d="M15 8l4 4-4 4" />
    <path d="M5 6l4-4" />
    <path d="M5 18l4 4" />
  </svg>
);

// ============================================================
// [🧱 BLOCK: Diamond Button Cluster]
// ============================================================
function DiamondButtons({ mobileInput }: { mobileInput: MobileInput }) {
  return (
    <div className="mc-buttons">
      <ActionButton
        action="light"
        position="west"
        label="Attack"
        icon={IconSword}
        mobileInput={mobileInput}
      />
      <ActionButton
        action="heavy"
        position="north"
        label="Heavy"
        icon={IconHeavy}
        mobileInput={mobileInput}
      />
      <ActionButton
        action="block"
        position="east"
        label="Parry"
        icon={IconShield}
        mobileInput={mobileInput}
      />
      <ActionButton
        action="dash"
        position="south"
        label="Dash"
        icon={IconDash}
        mobileInput={mobileInput}
      />
    </div>
  );
}

// ============================================================
// [🧱 BLOCK: Mobile Hotbar Slot]
// Bigger than desktop — optimised for thumbs.
// ============================================================
function MobileHotbarSlot({
  slot, slotIndex, bagCount, onActivate,
}: {
  slot:       HotbarSlot;
  slotIndex:  number;
  bagCount:   number;
  onActivate: () => void;
}) {
  const def         = slot.assignedId ? CONSUMABLE_REGISTRY[slot.assignedId] : null;
  const cooldownMax = SLOT_COOLDOWNS[slotIndex];
  const cdPct       = slot.cooldownMs > 0 ? slot.cooldownMs / cooldownMax : 0;
  const durPct      = def && def.durationMs > 0 && slot.durationMs > 0
    ? slot.durationMs / def.durationMs : 0;
  const onCooldown  = slot.cooldownMs > 0;
  const R = 21;
  const CIRC = 2 * Math.PI * R;

  return (
    <div
      className={`mc-hotbar__slot${!def ? " mc-hotbar__slot--empty" : ""}${onCooldown ? " mc-hotbar__slot--cooldown" : ""}`}
      onPointerDown={(e) => { e.preventDefault(); if (!onCooldown && def && bagCount > 0) onActivate(); }}
    >
      <span className="mc-hotbar__slot__key">{slotIndex + 1}</span>
      <span className="mc-hotbar__slot__icon">{def ? def.icon : "·"}</span>
      {def && bagCount > 0 && (
        <span className="mc-hotbar__slot__count">×{bagCount}</span>
      )}
      {onCooldown && (
        <>
          <svg className="mc-hotbar__slot__cd-svg" viewBox="0 0 54 54">
            <circle
              cx="27" cy="27" r={R}
              fill="none"
              stroke="rgba(0,0,0,0.70)"
              strokeWidth="42"
              strokeDasharray={CIRC}
              strokeDashoffset={CIRC * (1 - cdPct)}
              strokeLinecap="butt"
              style={{ transform: "rotate(-90deg)", transformOrigin: "27px 27px" }}
            />
          </svg>
          <span className="mc-hotbar__slot__cd-text">
            {(slot.cooldownMs / 1000).toFixed(1)}
          </span>
        </>
      )}
      {durPct > 0 && (
        <div className="mc-hotbar__slot__dur">
          <div className="mc-hotbar__slot__dur-fill" style={{ width: `${durPct * 100}%` }} />
        </div>
      )}
    </div>
  );
}

// ============================================================
// [🧱 BLOCK: Mobile HUD Strip]
// HP + Stamina bars, hotbar, gold/room info.
// ============================================================
function MobileHUD({
  hp, maxHp, stamina, maxStamina,
  gold, floor, room, kills, killThreshold,
  hotbar, bagCounts, onSlotActivate,
}: Omit<MobileControlsProps, "mobileInput" | "visible">) {
  const hpPct  = Math.max(0, Math.min(1, hp / maxHp));
  const staPct = Math.max(0, Math.min(1, stamina / maxStamina));
  const hpLow  = hpPct <= 0.25;
  const staEmpty = stamina < 5;

  return (
    <div className="mc-hud">
      {/* Bars */}
      <div className="mc-hud__bars">
        <div className="mc-hud__bar-row">
          <span className="mc-hud__bar-label">HP</span>
          <div className="mc-hud__bar-track">
            <div
              className={`mc-hud__bar-fill ${hpLow ? "mc-hud__bar-fill--hp-low" : "mc-hud__bar-fill--hp"}`}
              style={{ width: `${hpPct * 100}%` }}
            />
          </div>
          <span style={{ fontFamily: "'Courier New', monospace", fontSize: 9, color: "rgba(192,134,12,0.65)", minWidth: 36, textAlign: "right" }}>
            {Math.round(hp)}/{maxHp}
          </span>
        </div>
        <div className="mc-hud__bar-row">
          <span className="mc-hud__bar-label">ST</span>
          <div className="mc-hud__bar-track">
            <div
              className={`mc-hud__bar-fill ${staEmpty ? "mc-hud__bar-fill--sta-empty" : "mc-hud__bar-fill--sta"}`}
              style={{ width: `${staPct * 100}%` }}
            />
          </div>
          <span style={{ fontFamily: "'Courier New', monospace", fontSize: 9, color: "rgba(192,134,12,0.65)", minWidth: 36, textAlign: "right" }}>
            {Math.round(stamina)}/{maxStamina}
          </span>
        </div>
      </div>

      {/* Hotbar */}
      <div className="mc-hotbar">
        {hotbar.map((slot, i) => (
          <MobileHotbarSlot
            key={i}
            slot={slot}
            slotIndex={i}
            bagCount={bagCounts[i] ?? 0}
            onActivate={() => onSlotActivate(i)}
          />
        ))}
      </div>

      {/* Info row */}
      <div className="mc-hud__info">
        <div className="mc-hud__info-item">
          Floor <span>{floor}</span>
        </div>
        <div className="mc-hud__info-item">
          Room <span>{room}</span>
        </div>
        <div className="mc-hud__info-item">
          Kills <span>{kills}/{killThreshold}</span>
        </div>
        <div className="mc-hud__info-item">
          Gold <span>{gold}g</span>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// [🧱 BLOCK: MobileControls Root]
// ============================================================
export default function MobileControls({
  mobileInput, visible,
  hp, maxHp, stamina, maxStamina,
  gold, floor, room, kills, killThreshold,
  hotbar, bagCounts, onSlotActivate,
}: MobileControlsProps) {
  if (!visible) return <FullscreenButton />;

  return (
    <>
      <FullscreenButton />

      {/* Virtual joystick — bottom left */}
      <VirtualJoystick mobileInput={mobileInput} />

      {/* HUD strip — bottom centre */}
      <MobileHUD
        hp={hp} maxHp={maxHp}
        stamina={stamina} maxStamina={maxStamina}
        gold={gold} floor={floor} room={room}
        kills={kills} killThreshold={killThreshold}
        hotbar={hotbar} bagCounts={bagCounts}
        onSlotActivate={onSlotActivate}
      />

      {/* Diamond buttons — bottom right */}
      <DiamondButtons mobileInput={mobileInput} />
    </>
  );
}