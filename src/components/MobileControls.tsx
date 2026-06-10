"use client";

import React, { useRef, useEffect, useCallback, useState } from "react";
import { InputHandler } from "@/engine/Input";
import "@/styles/mobile-controls.css";

// ============================================================
// [🧱 BLOCK: Constants]
// ============================================================
const JOYSTICK_RADIUS    = 55;
const JOYSTICK_DEAD_ZONE = 0.08;

// ============================================================
// [🧱 BLOCK: Action Button Config]
// ============================================================
interface ActionBtn {
  key:   string;
  cls:   string;
  icon:  string;
  label: string;
}

const ACTION_BUTTONS: ActionBtn[] = [
  { key: 'KeyJ', cls: 'light', icon: '⚔',  label: 'J' },
  { key: 'KeyK', cls: 'heavy', icon: '💥', label: 'K' },
  { key: 'KeyC', cls: 'dash',  icon: '💨', label: 'C' },
  { key: 'KeyL', cls: 'block', icon: '🛡', label: 'L' },
];

// ============================================================
// [🧱 BLOCK: Slot Button Config]
// 4 consumable slots — horizontal row above the HUD strip
// ============================================================
const SLOT_BUTTONS = [
  { slotIndex: 0, label: '1' },
  { slotIndex: 1, label: '2' },
  { slotIndex: 2, label: '3' },
  { slotIndex: 3, label: '4' },
];

// ============================================================
// [🧱 BLOCK: Props]
// ============================================================
interface MobileControlsProps {
  inputRef:        React.MutableRefObject<InputHandler | null>;
  isMobile:        boolean;
  activeKeys?:     Set<string>;
  onPause?:        () => void;
  onInventory?:    () => void;
  onSlotActivate?: (slotIndex: number) => void;
}

// ============================================================
// [🧱 BLOCK: MobileControls Component]
// ============================================================
export default function MobileControls({
  inputRef,
  isMobile,
  activeKeys,
  onPause,
  onInventory,
  onSlotActivate,
}: MobileControlsProps) {

  // ── Joystick state ────────────────────────────────────────
  const baseRef    = useRef<HTMLDivElement>(null);
  const joyTouchId = useRef<number | null>(null);
  const [knobActive, setKnobActive] = useState(false);
  const [knobOffset, setKnobOffset] = useState({ x: 0, y: 0 });

  // ── Action button touch map ───────────────────────────────
  const btnTouchMap = useRef<Map<string, number>>(new Map());
  const [pressedKeys, setPressedKeys] = useState<Set<string>>(new Set());

  // ── Fullscreen state ──────────────────────────────────────
  const [isFullscreen, setIsFullscreen] = useState(false);

  // ============================================================
  // [🧱 BLOCK: Fullscreen Handler]
  // Works on Android Chrome + iOS Safari (webkit prefix)
  // ============================================================
  const toggleFullscreen = useCallback(() => {
    const el = document.documentElement as HTMLElement & {
      webkitRequestFullscreen?: () => Promise<void>;
    };
    const doc = document as Document & {
      webkitFullscreenElement?: Element;
      webkitExitFullscreen?: () => Promise<void>;
    };

    const isFs = !!(document.fullscreenElement || doc.webkitFullscreenElement);

    if (!isFs) {
      const req = el.requestFullscreen ?? el.webkitRequestFullscreen;
      if (req) req.call(el).catch(() => {});
    } else {
      const exit = document.exitFullscreen ?? doc.webkitExitFullscreen;
      if (exit) exit.call(document).catch(() => {});
    }
  }, []);

  useEffect(() => {
    const onChange = () => {
      const doc = document as Document & { webkitFullscreenElement?: Element };
      setIsFullscreen(!!(document.fullscreenElement || doc.webkitFullscreenElement));
    };
    document.addEventListener('fullscreenchange',       onChange);
    document.addEventListener('webkitfullscreenchange', onChange);
    return () => {
      document.removeEventListener('fullscreenchange',       onChange);
      document.removeEventListener('webkitfullscreenchange', onChange);
    };
  }, []);

  // ============================================================
  // [🧱 BLOCK: Joystick Touch Handlers]
  // ============================================================
  const handleJoyStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    if (joyTouchId.current !== null) return;
    const touch = e.changedTouches[0];
    joyTouchId.current = touch.identifier;
    setKnobActive(true);
  }, []);

  const handleJoyMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    if (joyTouchId.current === null || !baseRef.current) return;

    let touchIndex = -1;
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === joyTouchId.current) { touchIndex = i; break; }
    }
    if (touchIndex === -1) return;
    const touch = e.changedTouches[touchIndex];

    const rect  = baseRef.current.getBoundingClientRect();
    const cx    = rect.left + rect.width  / 2;
    const cy    = rect.top  + rect.height / 2;
    const dx    = touch.clientX - cx;
    const dy    = touch.clientY - cy;
    const dist  = Math.sqrt(dx * dx + dy * dy);
    const clamp = Math.min(dist, JOYSTICK_RADIUS);
    const angle = Math.atan2(dy, dx);

    setKnobOffset({ x: Math.cos(angle) * clamp, y: Math.sin(angle) * clamp });

    let nx = Math.max(-1, Math.min(1, dx / JOYSTICK_RADIUS));
    let ny = Math.max(-1, Math.min(1, dy / JOYSTICK_RADIUS));
    const mag = Math.sqrt(nx * nx + ny * ny);
    if (mag < JOYSTICK_DEAD_ZONE) {
      nx = 0; ny = 0;
    } else {
      const scale = (mag - JOYSTICK_DEAD_ZONE) / (1 - JOYSTICK_DEAD_ZONE);
      nx = (nx / mag) * Math.min(scale, 1);
      ny = (ny / mag) * Math.min(scale, 1);
    }

    const inp = inputRef.current;
    if (!inp) return;
    // Map joystick to WASD keys directly
    inp.keys[ny < -JOYSTICK_DEAD_ZONE ? 'add' : 'delete']('KeyW');
    inp.keys[ny >  JOYSTICK_DEAD_ZONE ? 'add' : 'delete']('KeyS');
    inp.keys[nx < -JOYSTICK_DEAD_ZONE ? 'add' : 'delete']('KeyA');
    inp.keys[nx >  JOYSTICK_DEAD_ZONE ? 'add' : 'delete']('KeyD');
  }, [inputRef]);

  const handleJoyEnd = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    let found = false;
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === joyTouchId.current) { found = true; break; }
    }
    if (!found) return;
    joyTouchId.current = null;
    setKnobActive(false);
    setKnobOffset({ x: 0, y: 0 });
    const inp = inputRef.current;
    if (inp) { ['KeyW','KeyS','KeyA','KeyD'].forEach(k => inp.keys.delete(k)); }
  }, [inputRef]);

  // ============================================================
  // [🧱 BLOCK: Action Button Touch Handlers]
  // ============================================================
  const handleBtnStart = useCallback((e: React.TouchEvent, key: string) => {
    e.preventDefault();
    const touch = e.changedTouches[0];
    btnTouchMap.current.set(key, touch.identifier);
    inputRef.current?.keys.add(key);
    setPressedKeys(prev => new Set(prev).add(key));
  }, [inputRef]);

  const handleBtnEnd = useCallback((e: React.TouchEvent, key: string) => {
    e.preventDefault();
    const storedId = btnTouchMap.current.get(key);
    if (storedId === undefined) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === storedId) {
        btnTouchMap.current.delete(key);
        inputRef.current?.keys.delete(key);
        setPressedKeys(prev => { const n = new Set(prev); n.delete(key); return n; });
        break;
      }
    }
  }, [inputRef]);

  // ============================================================
  // [🧱 BLOCK: Slot Button Handler]
  // ============================================================
  const handleSlotTap = useCallback((e: React.TouchEvent, slotIndex: number) => {
    e.preventDefault();
    onSlotActivate?.(slotIndex);
  }, [onSlotActivate]);

  // ============================================================
  // [🧱 BLOCK: Cleanup]
  // ============================================================
  useEffect(() => {
    return () => {
      const inp = inputRef.current;
      if (!inp) return;
      ['KeyW','KeyS','KeyA','KeyD','KeyJ','KeyK','KeyC','KeyL'].forEach(k => inp.keys.delete(k));
    };
  }, [inputRef]);

  // ============================================================
  // [🧱 BLOCK: Desktop — Glow Indicators Only]
  // ============================================================
  if (!isMobile) {
    const active = activeKeys ?? new Set<string>();
    return (
      <div className="mc-desktop-indicators">
        {ACTION_BUTTONS.map((btn) => (
          <div
            key={btn.key}
            className={`mc-desktop-btn mc-desktop-btn--${btn.cls} ${active.has(btn.key) ? 'mc-btn--active' : ''}`}
          >
            <div className="mc-desktop-btn__label">
              <span>{btn.icon}</span>
              <span className="mc-desktop-btn__key">{btn.label}</span>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // ============================================================
  // [🧱 BLOCK: Mobile Layout]
  // Slot row is a direct child of .mc-root (not inside
  // .mc-right-cluster) so it can be full-width and centered.
  // ============================================================
  return (
    <div className="mc-root">

      {/* ── Top-left controls: Fullscreen + Pause ── */}
      <div className="mc-top-left">
        <button
          className="mc-top-btn"
          onTouchEnd={(e) => { e.preventDefault(); toggleFullscreen(); }}
          aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
        >
          {isFullscreen ? '⤡' : '⤢'}
        </button>
        <button
          className="mc-top-btn"
          onTouchEnd={(e) => { e.preventDefault(); onPause?.(); }}
          aria-label="Pause"
        >
          ▶
        </button>
      </div>

      {/* ── Virtual Joystick — bottom-left ── */}
      <div
        ref={baseRef}
        className="mc-joystick-base"
        onTouchStart={handleJoyStart}
        onTouchMove={handleJoyMove}
        onTouchEnd={handleJoyEnd}
        onTouchCancel={handleJoyEnd}
      >
        <div
          className={`mc-joystick-knob ${knobActive ? 'mc-joystick-knob--active' : ''}`}
          style={{ transform: `translate(${knobOffset.x}px, ${knobOffset.y}px)` }}
        />
      </div>

      {/* ── Slot row — full-width centered strip above HUD ── */}
      <div className="mc-slots">
        {SLOT_BUTTONS.map(({ slotIndex, label }) => (
          <div
            key={slotIndex}
            className="mc-slot-btn"
            onTouchEnd={(e) => handleSlotTap(e, slotIndex)}
          >
            <span className="mc-slot-btn__label">{label}</span>
          </div>
        ))}
      </div>

      {/* ── Right cluster: action D-pad + inventory ── */}
      <div className="mc-right-cluster">

        {/* Action D-pad */}
        <div className="mc-actions">
          {ACTION_BUTTONS.map((btn) => (
            <div
              key={btn.key}
              className={`mc-btn mc-btn--${btn.cls} ${pressedKeys.has(btn.key) ? 'mc-btn--active' : ''}`}
              onTouchStart={(e) => handleBtnStart(e, btn.key)}
              onTouchEnd={(e)   => handleBtnEnd(e,   btn.key)}
              onTouchCancel={(e)=> handleBtnEnd(e,   btn.key)}
            >
              <div className="mc-btn__label">
                <span className="mc-btn__icon">{btn.icon}</span>
                <span className="mc-btn__key">{btn.label}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Inventory button */}
        <div
          className="mc-inventory-btn"
          onTouchEnd={(e) => { e.preventDefault(); onInventory?.(); }}
        >
          <span className="mc-inventory-btn__icon">🎒</span>
        </div>

      </div>

    </div>
  );
}