// src/components/Menu.tsx
"use client";

import React, { useEffect, useRef, useState } from "react";
import "@/styles/menu.css";

// ============================================================
// [🧱 BLOCK: Menu Props]
// ============================================================
interface MenuProps {
  onStart: () => void;
}

// ============================================================
// [🧱 BLOCK: Animated Background Canvas]
// ============================================================
function BackgroundCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx    = canvas.getContext("2d")!;
    let raf: number;

    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;

    const onResize = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", onResize);

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

      const grad = ctx.createRadialGradient(
        canvas.width / 2, canvas.height / 2, 0,
        canvas.width / 2, canvas.height / 2, canvas.width * 0.8
      );
      grad.addColorStop(0,   "#0d1b2a");
      grad.addColorStop(0.5, "#0a0f1e");
      grad.addColorStop(1,   "#060a12");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = "rgba(148,163,184,0.04)";
      for (let x = 0; x < canvas.width; x += 60) {
        for (let y = 0; y < canvas.height; y += 60) {
          ctx.beginPath();
          ctx.arc(x, y, 1, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      particles.forEach((p) => {
        ctx.fillStyle  = p.color;
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
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return <canvas ref={canvasRef} className="menu-bg-canvas" />;
}

// ============================================================
// [🧱 BLOCK: Controls Reference]
// ============================================================
const CONTROLS = [
  { key: "WASD", desc: "Move"         },
  { key: "C",    desc: "Dash"         },
  { key: "J",    desc: "Light Attack" },
  { key: "K",    desc: "Heavy Attack" },
];

// ============================================================
// [🧱 BLOCK: Menu Component]
// ============================================================
export default function Menu({ onStart }: MenuProps) {
  const [hovered, setHovered] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 80);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="menu-root">
      <BackgroundCanvas />

      {/* Content layer */}
      <div className={`menu-content ${visible ? "menu-content--visible" : ""}`}>

        {/* ── Eyebrow ── */}
        <p className={`menu-eyebrow ${visible ? "menu-eyebrow--visible" : ""}`}>
          ▸ Enter if you dare
        </p>

        {/* ── Title ── */}
        <h1 className={`menu-title menu-title--white ${visible ? "menu-title--visible-1" : ""}`}>
          INFINITY
        </h1>
        <h1 className={`menu-title menu-title--red ${visible ? "menu-title--visible-2" : ""}`}>
          DUNGEON
        </h1>

        {/* ── Tagline ── */}
        <p className={`menu-tagline ${visible ? "menu-tagline--visible" : ""}`}>
          Kill. Descend. Repeat.
        </p>

        {/* ── RAID Button ── */}
        <button
          onClick={onStart}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          className={`menu-raid-btn ${hovered ? "menu-raid-btn--hovered" : ""} ${visible ? "menu-raid-btn--visible" : ""}`}
        >
          ▶ &nbsp;RAID
        </button>

        {/* ── Controls ── */}
        <div className={`menu-controls ${visible ? "menu-controls--visible" : ""}`}>
          {CONTROLS.map(({ key, desc }) => (
            <div key={key} className="menu-control-item">
              <span className="menu-control-key">{key}</span>
              <span className="menu-control-desc">{desc}</span>
            </div>
          ))}
        </div>

      </div>

      {/* ── Version tag ── */}
      <p className="menu-version">ALPHA v0.1</p>
    </div>
  );
}