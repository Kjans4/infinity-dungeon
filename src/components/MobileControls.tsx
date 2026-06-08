"use client";

import React, { useRef, useEffect, useCallback, useState } from "react";
import { InputHandler } from "@/engine/Input";
import "@/styles/mobile-controls.css";

// ============================================================
// [🧱 BLOCK: Constants]
// ============================================================
const JOYSTICK_RADIUS    = 55;   // px — max knob travel from center
const JOYSTICK_DEAD_ZONE = 0.08; // normalized dead zone

// ============================================================
// [🧱 BLOCK: Action Button Config]
// Each button maps to a virtual key code + display info.
// ============================================================
interface ActionBtn {
  key:       string;
  cls:       string;
  icon:      string;
  label:     string;
}

const ACTION_BUTTONS: ActionBtn[] = [
  { key: 'KeyJ', cls: 'light', icon: '⚔',  label: 'J'  },
  { key: 'KeyK', cls: 'heavy', icon: '💥',  label: 'K'  },
  { key: 'KeyC', cls: 'dash',  icon: '💨',  label: 'C'  },
  { key: 'KeyL', cls: 'block', icon: '🛡',  label: 'L'  },
];

// ============================================================
// [🧱 BLOCK: Props]
// ============================================================
interface MobileControlsProps {
  inputRef:  React.MutableRefObject<InputHandler | null>;
  isMobile:  boolean;
  /** Keys currently pressed — for desktop glow indicators */
  activeKeys?: Set<string>;
}

// ============================================================
// [🧱 BLOCK: MobileControls Component]
// Renders:
//   - Mobile: virtual joystick (bottom-left) + touch D-pad (bottom-right)
//   - Desktop: D-pad glow indicators only (no joystick, no touch handlers)
// ============================================================
export default function MobileControls({ inputRef, isMobile, activeKeys }: MobileControlsProps) {

  // ── Joystick state ────────────────────────────────────────
  const baseRef      = useRef<HTMLDivElement>(null);
  const knobRef      = useRef<HTMLDivElement>(null);
  const joyTouchId   = useRef<number | null>(null);
  const [knobActive, setKnobActive] = useState(false);
  const [knobOffset, setKnobOffset] = useState({ x: 0, y: 0 });

  // ── Action button pressed state ───────────────────────────
  // Map of key → touch identifier (allows multi-touch)
  const btnTouchMap = useRef<Map<string, number>>(new Map());
  const [pressedKeys, setPressedKeys] = useState<Set<string>>(new Set());

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
      if (e.changedTouches[i].identifier === joyTouchId.current) {
        touchIndex = i;
        break;
      }
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

    const ox = Math.cos(angle) * clamp;
    const oy = Math.sin(angle) * clamp;

    setKnobOffset({ x: ox, y: oy });

    // Normalize to -1..1, apply dead zone
    let nx = dx / JOYSTICK_RADIUS;
    let ny = dy / JOYSTICK_RADIUS;
    nx = Math.max(-1, Math.min(1, nx));
    ny = Math.max(-1, Math.min(1, ny));

    const mag = Math.sqrt(nx * nx + ny * ny);
    if (mag < JOYSTICK_DEAD_ZONE) {
      nx = 0; ny = 0;
    } else {
      // Rescale so dead zone edge = 0, full extent = 1
      const scale = (mag - JOYSTICK_DEAD_ZONE) / (1 - JOYSTICK_DEAD_ZONE);
      nx = (nx / mag) * Math.min(scale, 1);
      ny = (ny / mag) * Math.min(scale, 1);
    }

    inputRef.current?.setJoystick(nx, ny);
  }, [inputRef]);

  const handleJoyEnd = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    let found = false;
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === joyTouchId.current) {
        found = true; break;
      }
    }
    if (!found) return;
    joyTouchId.current = null;
    setKnobActive(false);
    setKnobOffset({ x: 0, y: 0 });
    inputRef.current?.clearJoystick();
  }, [inputRef]);

  // ============================================================
  // [🧱 BLOCK: Action Button Touch Handlers]
  // ============================================================
  const handleBtnStart = useCallback((e: React.TouchEvent, key: string) => {
    e.preventDefault();
    const touch = e.changedTouches[0];
    btnTouchMap.current.set(key, touch.identifier);
    inputRef.current?.pressVirtualKey(key);
    setPressedKeys((prev) => new Set(prev).add(key));
  }, [inputRef]);

  const handleBtnEnd = useCallback((e: React.TouchEvent, key: string) => {
    e.preventDefault();
    const storedId = btnTouchMap.current.get(key);
    if (storedId === undefined) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === storedId) {
        btnTouchMap.current.delete(key);
        inputRef.current?.releaseVirtualKey(key);
        setPressedKeys((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
        break;
      }
    }
  }, [inputRef]);

  // ============================================================
  // [🧱 BLOCK: Cleanup on unmount]
  // ============================================================
  useEffect(() => {
    return () => {
      inputRef.current?.clearJoystick();
      inputRef.current?.releaseAllVirtualKeys();
    };
  }, [inputRef]);

  // ============================================================
  // [🧱 BLOCK: Desktop — Glow Indicators Only]
  // Shows D-pad shapes that light up when keys are held.
  // activeKeys is polled from the InputHandler each render tick.
  // ============================================================
  if (!isMobile) {
    const active = activeKeys ?? new Set<string>();
    return (
      <div className="mc-desktop-indicators">
        {ACTION_BUTTONS.map((btn) => {
          const isActive = active.has(btn.key);
          return (
            <div
              key={btn.key}
              className={`mc-desktop-btn mc-desktop-btn--${btn.cls} ${isActive ? 'mc-btn--active' : ''}`}
            >
              <div className="mc-desktop-btn__label">
                <span>{btn.icon}</span>
                <span className="mc-desktop-btn__key">{btn.label}</span>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // ============================================================
  // [🧱 BLOCK: Mobile — Joystick + Action Buttons]
  // ============================================================
  return (
    <div className="mc-root">

      {/* ── Virtual Joystick ── */}
      <div
        ref={baseRef}
        className="mc-joystick-base"
        onTouchStart={handleJoyStart}
        onTouchMove={handleJoyMove}
        onTouchEnd={handleJoyEnd}
        onTouchCancel={handleJoyEnd}
      >
        <div
          ref={knobRef}
          className={`mc-joystick-knob ${knobActive ? 'mc-joystick-knob--active' : ''}`}
          style={{
            transform: `translate(${knobOffset.x}px, ${knobOffset.y}px)`,
          }}
        />
      </div>

      {/* ── Action D-pad ── */}
      <div className="mc-actions">
        {ACTION_BUTTONS.map((btn) => {
          const isActive = pressedKeys.has(btn.key);
          return (
            <div
              key={btn.key}
              className={`mc-btn mc-btn--${btn.cls} ${isActive ? 'mc-btn--active' : ''}`}
              onTouchStart={(e) => handleBtnStart(e, btn.key)}
              onTouchEnd={(e) => handleBtnEnd(e, btn.key)}
              onTouchCancel={(e) => handleBtnEnd(e, btn.key)}
            >
              <div className="mc-btn__label">
                <span className="mc-btn__icon">{btn.icon}</span>
                <span className="mc-btn__key">{btn.label}</span>
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
}