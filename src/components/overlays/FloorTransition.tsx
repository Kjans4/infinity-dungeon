// src/components/overlays/FloorTransition.tsx
"use client";

import React, { useEffect, useRef } from "react";
import "@/styles/floor-transition.css";

// ============================================================
// [🧱 BLOCK: Props]
// ============================================================
interface Props {
  targetFloor: number;               // floor the player is descending to
  onComplete:  () => void;           // fires when the fade-out ends
}

// ============================================================
// [🧱 BLOCK: Timing Constants]
// Total animation: fade-in → hold → fade-out
// ============================================================
const FADE_IN_MS  = 500;
const HOLD_MS     = 600;
const FADE_OUT_MS = 600;
const TOTAL_MS    = FADE_IN_MS + HOLD_MS + FADE_OUT_MS;

// ============================================================
// [🧱 BLOCK: FloorTransition]
// Renders a full-screen black overlay that fades in, displays
// "FLOOR X", then fades out. Calls onComplete when finished.
// Mounts immediately — the fade-in starts on mount.
// ============================================================
export default function FloorTransition({ targetFloor, onComplete }: Props) {
  // phase: 0 = fading in, 1 = holding, 2 = fading out
  const phaseRef = useRef<0 | 1 | 2>(0);
  const [opacity, setOpacity] = React.useState(0);
  const [textVisible, setTextVisible] = React.useState(false);

  useEffect(() => {
    // Kick off fade-in immediately on next paint
    const rafId = requestAnimationFrame(() => {
      setOpacity(1);
    });

    // Show text when backdrop is near-opaque
    const showText = setTimeout(() => {
      setTextVisible(true);
      phaseRef.current = 1;
    }, FADE_IN_MS);

    // Begin fade-out after hold
    const startFadeOut = setTimeout(() => {
      phaseRef.current = 2;
      setOpacity(0);
      setTextVisible(false);
    }, FADE_IN_MS + HOLD_MS);

    // Signal completion after full animation
    const complete = setTimeout(() => {
      onComplete();
    }, TOTAL_MS);

    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(showText);
      clearTimeout(startFadeOut);
      clearTimeout(complete);
    };
  }, [onComplete]);

  return (
    <div
      className="ft-backdrop"
      style={{
        opacity,
        transition: opacity === 0
          ? `opacity ${FADE_OUT_MS}ms ease-in`
          : `opacity ${FADE_IN_MS}ms ease-out`,
      }}
    >
      <div className={`ft-content ${textVisible ? "ft-content--visible" : ""}`}>

        {/* Decorative top rule */}
        <div className="ft-rule" />

        {/* Floor label */}
        <p className="ft-label">Descending to</p>
        <p className="ft-floor">FLOOR {targetFloor}</p>

        {/* Decorative bottom rule */}
        <div className="ft-rule" />

      </div>
    </div>
  );
}