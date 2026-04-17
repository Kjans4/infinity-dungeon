// src/components/Minimap.tsx
"use client";

import React, { useEffect, useRef } from "react";
import { GameState } from "@/engine/GameState";
import { WORLD_W, WORLD_H, BOSS_WORLD_W, BOSS_WORLD_H } from "@/engine/Camera";
import { Shooter } from "@/engine/enemy/Shooter";
import { Tank }    from "@/engine/enemy/Tank";
import "@/styles/minimap.css";

// ============================================================
// [🧱 BLOCK: Minimap Props]
// ============================================================
interface MinimapProps {
  state:  GameState | null;
  isBoss: boolean;
}

// ============================================================
// [🧱 BLOCK: Minimap Constants]
// ============================================================
const MAP_W   = 160;
const MAP_H   = 120;
const PADDING = 6;

// ============================================================
// [🧱 BLOCK: Legend Items]
// ============================================================
const LEGEND = [
  { color: "#f0c040", label: "You"     },
  { color: "#a855f7", label: "Grunt"   },
  { color: "#c0860c", label: "Shooter" },
  { color: "#5a4010", label: "Tank"    },
  { color: "#4ade80", label: "Gate"    },
];

// ============================================================
// [🧱 BLOCK: Minimap Component]
// ============================================================
export default function Minimap({ state, isBoss }: MinimapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef    = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const draw = () => {
      const ctx = canvas.getContext("2d");
      if (!ctx || !state) {
        rafRef.current = requestAnimationFrame(draw);
        return;
      }

      const worldW = isBoss ? BOSS_WORLD_W : WORLD_W;
      const worldH = isBoss ? BOSS_WORLD_H : WORLD_H;
      const scaleX = (MAP_W - PADDING * 2) / worldW;
      const scaleY = (MAP_H - PADDING * 2) / worldH;

      const toMap = (wx: number, wy: number) => ({
        x: PADDING + wx * scaleX,
        y: PADDING + wy * scaleY,
      });

      // ── Clear ─────────────────────────────────────────────
      ctx.clearRect(0, 0, MAP_W, MAP_H);

      // ── Stone background ──────────────────────────────────
      ctx.fillStyle = "rgba(10, 8, 4, 0.92)";
      ctx.fillRect(0, 0, MAP_W, MAP_H);

      // Subtle grid texture
      ctx.strokeStyle = "rgba(46,32,8,0.4)";
      ctx.lineWidth   = 0.5;
      for (let x = PADDING; x <= MAP_W - PADDING; x += 20) {
        ctx.beginPath(); ctx.moveTo(x, PADDING); ctx.lineTo(x, MAP_H - PADDING); ctx.stroke();
      }
      for (let y = PADDING; y <= MAP_H - PADDING; y += 20) {
        ctx.beginPath(); ctx.moveTo(PADDING, y); ctx.lineTo(MAP_W - PADDING, y); ctx.stroke();
      }

      // ── World boundary — gold border ──────────────────────
      ctx.strokeStyle = isBoss ? "rgba(249,115,22,0.5)" : "rgba(139,105,20,0.6)";
      ctx.lineWidth   = 1.5;
      ctx.strokeRect(PADDING, PADDING, MAP_W - PADDING * 2, MAP_H - PADDING * 2);

      // Inner shadow line
      ctx.strokeStyle = "rgba(0,0,0,0.4)";
      ctx.lineWidth   = 1;
      ctx.strokeRect(PADDING + 1, PADDING + 1, MAP_W - PADDING * 2 - 2, MAP_H - PADDING * 2 - 2);

      // ── Door ──────────────────────────────────────────────
      if (state.door) {
        const dp = toMap(
          state.door.x + state.door.width  / 2,
          state.door.y + state.door.height / 2
        );
        ctx.beginPath();
        ctx.arc(dp.x, dp.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = state.door.isActive ? "#4ade80" : "rgba(90,64,16,0.4)";
        ctx.fill();
        if (state.door.isActive) {
          ctx.beginPath();
          ctx.arc(dp.x, dp.y, 6, 0, Math.PI * 2);
          ctx.strokeStyle = "rgba(74,222,128,0.4)";
          ctx.lineWidth   = 1;
          ctx.stroke();
        }
      }

      // ── Enemies ───────────────────────────────────────────
      state.enemies.forEach((enemy) => {
        if (enemy.isDead) return;
        const ep = toMap(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2);
        const radius = enemy instanceof Tank ? 4 : 2.5;
        const color  =
          enemy instanceof Tank    ? "#5a4010" :
          enemy instanceof Shooter ? "#c0860c" :
                                     "#a855f7";
        ctx.beginPath();
        ctx.arc(ep.x, ep.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
      });

      // ── Boss ──────────────────────────────────────────────
      if (state.boss && !state.boss.isDead) {
        const bp = toMap(
          state.boss.x + state.boss.width  / 2,
          state.boss.y + state.boss.height / 2
        );
        ctx.beginPath();
        ctx.arc(bp.x, bp.y, 6, 0, Math.PI * 2);
        ctx.fillStyle = "#ef4444";
        ctx.fill();
        ctx.beginPath();
        ctx.arc(bp.x, bp.y, 6, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(239,68,68,0.5)";
        ctx.lineWidth   = 2;
        ctx.stroke();
        ctx.fillStyle   = "rgba(239,68,68,0.8)";
        ctx.font        = "bold 6px 'Cinzel', serif";
        ctx.textAlign   = "center";
        ctx.fillText("☩", bp.x, bp.y - 8);
        ctx.textAlign   = "left";
      }

      // ── Player — gold diamond ─────────────────────────────
      const pp = toMap(
        state.player.x + state.player.width  / 2,
        state.player.y + state.player.height / 2
      );
      // Glow halo
      ctx.beginPath();
      ctx.arc(pp.x, pp.y, 6, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(240,192,64,0.15)";
      ctx.fill();
      // Diamond shape
      ctx.save();
      ctx.translate(pp.x, pp.y);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = "#f0c040";
      ctx.fillRect(-3, -3, 6, 6);
      ctx.restore();

      // ── Camera viewport ───────────────────────────────────
      const vp = toMap(state.camera.x, state.camera.y);
      ctx.strokeStyle = "rgba(140,90,10,0.2)";
      ctx.lineWidth   = 1;
      ctx.strokeRect(
        vp.x, vp.y,
        state.camera.screenW * scaleX,
        state.camera.screenH * scaleY
      );

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [state, isBoss]);

  return (
    <div className="minimap-root">
      <div className="minimap-frame">

        {/* Decorative inner border line */}
        <div className="minimap-inner-border" />

        {/* Title bar with gem dividers */}
        <div className="minimap-title-bar">
          <div className="minimap-title-gem" />
          <p className="minimap-label">Realm Map</p>
          <div className="minimap-title-gem" />
        </div>

        {/* Canvas with bottom-corner accents */}
        <div className="minimap-canvas-wrap" style={{ padding: "0 4px" }}>
          <canvas
            ref={canvasRef}
            width={MAP_W}
            height={MAP_H}
            className="minimap-canvas"
          />
        </div>

        {/* Legend */}
        <div className="minimap-legend">
          {LEGEND.map(({ color, label }) => (
            <div key={label} className="minimap-legend__item">
              <div className="minimap-legend__dot" style={{ background: color }} />
              <span className="minimap-legend__label">{label}</span>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}