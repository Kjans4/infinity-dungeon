// src/components/Menu.tsx
"use client";

import React, { useEffect, useRef, useState } from "react";

// ============================================================
// [🧱 BLOCK: Menu Props]
// ============================================================
interface MenuProps {
  onStart: () => void;
}

// ============================================================
// [🧱 BLOCK: Animated Background Canvas]
// Draws a slow-drifting particle field — enemies in the
// distance, giving atmosphere without distracting.
// ============================================================
function BackgroundCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx    = canvas.getContext("2d")!;
    let raf: number;

    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;

    window.addEventListener("resize", () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
    });

    // Floating particles — simulated enemies in the dark
    const particles = Array.from({ length: 40 }, () => ({
      x:     Math.random() * canvas.width,
      y:     Math.random() * canvas.height,
      size:  Math.random() * 10 + 4,
      speed: Math.random() * 0.3 + 0.1,
      alpha: Math.random() * 0.15 + 0.04,
      color: Math.random() > 0.5 ? "#a855f7" : "#ef4444",
    }));

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Background gradient
      const grad = ctx.createRadialGradient(
        canvas.width / 2, canvas.height / 2, 0,
        canvas.width / 2, canvas.height / 2, canvas.width * 0.8
      );
      grad.addColorStop(0,   "#0d1b2a");
      grad.addColorStop(0.5, "#0a0f1e");
      grad.addColorStop(1,   "#060a12");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Subtle grid dots
      ctx.fillStyle = "rgba(148,163,184,0.04)";
      for (let x = 0; x < canvas.width; x += 60) {
        for (let y = 0; y < canvas.height; y += 60) {
          ctx.beginPath();
          ctx.arc(x, y, 1, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Drifting enemy silhouettes
      particles.forEach((p) => {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alpha;
        ctx.fillRect(p.x, p.y, p.size, p.size);
        ctx.globalAlpha = 1;

        p.y += p.speed;
        if (p.y > canvas.height + 20) {
          p.y = -20;
          p.x = Math.random() * canvas.width;
        }
      });

      raf = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ position: "absolute", inset: 0, display: "block" }}
    />
  );
}

// ============================================================
// [🧱 BLOCK: Controls Reference]
// ============================================================
const CONTROLS = [
  { key: "WASD",  desc: "Move"         },
  { key: "C",     desc: "Dash"         },
  { key: "J",     desc: "Light Attack" },
  { key: "K",     desc: "Heavy Attack" },
];

// ============================================================
// [🧱 BLOCK: Menu Component]
// Brutalist / dark military aesthetic. Feels like a raid
// briefing rather than a cheerful game menu.
// ============================================================
export default function Menu({ onStart }: MenuProps) {
  const [hovered, setHovered] = useState(false);
  const [visible, setVisible] = useState(false);

  // Stagger-in on mount
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 80);
    return () => clearTimeout(t);
  }, []);

  return (
    <div style={{
      position:       "fixed",
      inset:          0,
      display:        "flex",
      flexDirection:  "column",
      alignItems:     "center",
      justifyContent: "center",
      overflow:       "hidden",
      fontFamily:     "'Courier New', monospace",
    }}>
      {/* Animated background */}
      <BackgroundCanvas />

      {/* Content layer */}
      <div style={{
        position:      "relative",
        zIndex:        10,
        display:       "flex",
        flexDirection: "column",
        alignItems:    "center",
        gap:           0,
        opacity:       visible ? 1 : 0,
        transform:     visible ? "translateY(0)" : "translateY(16px)",
        transition:    "opacity 0.6s ease, transform 0.6s ease",
      }}>

        {/* ── Eyebrow ── */}
        <p style={{
          fontSize:      10,
          letterSpacing: "0.4em",
          color:         "rgba(239,68,68,0.7)",
          textTransform: "uppercase",
          marginBottom:  16,
          opacity:       visible ? 1 : 0,
          transition:    "opacity 0.6s ease 0.1s",
        }}>
          ▸ Enter if you dare
        </p>

        {/* ── Title ── */}
        <h1 style={{
          fontSize:      clamp(48, 8, 96),
          fontWeight:    900,
          letterSpacing: "-0.02em",
          lineHeight:    0.9,
          margin:        0,
          marginBottom:  6,
          color:         "#f1f5f9",
          textShadow:    "0 0 80px rgba(239,68,68,0.3), 0 2px 4px rgba(0,0,0,0.8)",
          opacity:       visible ? 1 : 0,
          transition:    "opacity 0.6s ease 0.15s",
        }}>
          INFINITY
        </h1>
        <h1 style={{
          fontSize:      clamp(48, 8, 96),
          fontWeight:    900,
          letterSpacing: "-0.02em",
          lineHeight:    0.9,
          margin:        0,
          marginBottom:  32,
          color:         "#ef4444",
          textShadow:    "0 0 60px rgba(239,68,68,0.6)",
          opacity:       visible ? 1 : 0,
          transition:    "opacity 0.6s ease 0.2s",
        }}>
          DUNGEON
        </h1>

        {/* ── Tagline ── */}
        <p style={{
          fontSize:      11,
          letterSpacing: "0.2em",
          color:         "rgba(100,116,139,0.9)",
          textTransform: "uppercase",
          marginBottom:  48,
          opacity:       visible ? 1 : 0,
          transition:    "opacity 0.6s ease 0.25s",
        }}>
          Kill. Descend. Repeat.
        </p>

        {/* ── RAID Button ── */}
        <button
          onClick={onStart}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          style={{
            fontFamily:      "'Courier New', monospace",
            fontSize:        18,
            fontWeight:      900,
            letterSpacing:   "0.35em",
            textTransform:   "uppercase",
            color:           hovered ? "#0f172a" : "#ef4444",
            backgroundColor: hovered ? "#ef4444" : "transparent",
            border:          "2px solid #ef4444",
            padding:         "16px 56px",
            borderRadius:    4,
            cursor:          "pointer",
            marginBottom:    48,
            transition:      "all 0.15s ease",
            boxShadow:       hovered
              ? "0 0 40px rgba(239,68,68,0.5)"
              : "0 0 20px rgba(239,68,68,0.15)",
            opacity:         visible ? 1 : 0,
          }}
        >
          ▶ &nbsp;RAID
        </button>

        {/* ── Controls ── */}
        <div style={{
          display:       "flex",
          gap:           24,
          opacity:       visible ? 0.5 : 0,
          transition:    "opacity 0.6s ease 0.35s",
        }}>
          {CONTROLS.map(({ key, desc }) => (
            <div key={key} style={{
              display:       "flex",
              flexDirection: "column",
              alignItems:    "center",
              gap:           4,
            }}>
              <span style={{
                fontSize:        10,
                fontWeight:      700,
                color:           "#f1f5f9",
                background:      "rgba(255,255,255,0.08)",
                border:          "1px solid rgba(255,255,255,0.12)",
                borderRadius:    4,
                padding:         "3px 8px",
                letterSpacing:   "0.05em",
              }}>
                {key}
              </span>
              <span style={{
                fontSize:      9,
                color:         "rgba(100,116,139,0.8)",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
              }}>
                {desc}
              </span>
            </div>
          ))}
        </div>

      </div>

      {/* ── Bottom version tag ── */}
      <p style={{
        position:      "absolute",
        bottom:        16,
        right:         20,
        zIndex:        10,
        fontSize:      9,
        color:         "rgba(71,85,105,0.6)",
        letterSpacing: "0.15em",
        fontFamily:    "'Courier New', monospace",
      }}>
        ALPHA v0.1
      </p>
    </div>
  );
}

// Clamp font size between min/max vw
function clamp(base: number, min: number, max: number): string {
  return `clamp(${min}vw, ${base}px, ${max}vw)`;
}