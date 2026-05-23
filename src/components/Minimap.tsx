// src/components/Minimap.tsx
"use client";

import React, { useEffect, useRef } from "react";
import { GameState } from "@/engine/GameState";
import { WORLD_W, WORLD_H, BOSS_WORLD_W, BOSS_WORLD_H } from "@/engine/Camera";
import { Shooter } from "@/engine/enemy/Shooter";
import { Tank }    from "@/engine/enemy/Tank";
import { Dasher }  from "@/engine/enemy/Dasher";
import { Bomber }  from "@/engine/enemy/Bomber";
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
const PADDING = 0;

// ============================================================
// [🧱 BLOCK: Legend Items]
// ============================================================
const LEGEND_ROW1 = [
  { color: "#f0c040", label: "You"     },
  { color: "#a855f7", label: "Grunt"   },
  { color: "#c0860c", label: "Shooter" },
  { color: "#7a5c2a", label: "Tank"    },
];

const LEGEND_ROW2 = [
  { color: "#06b6d4", label: "Dasher"  },
  { color: "#f97316", label: "Bomber"  },
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
      const scaleX = MAP_W / worldW;
      const scaleY = MAP_H / worldH;

      const toMap = (wx: number, wy: number) => ({
        x: wx * scaleX,
        y: wy * scaleY,
      });

      // ── Clear ─────────────────────────────────────────────
      ctx.clearRect(0, 0, MAP_W, MAP_H);

      // ── Aged parchment background ─────────────────────────
      const bg = ctx.createRadialGradient(
        MAP_W * 0.5, MAP_H * 0.5, 0,
        MAP_W * 0.5, MAP_H * 0.5, MAP_W * 0.75
      );
      bg.addColorStop(0,   "rgba(28, 18, 6, 0.97)");
      bg.addColorStop(0.7, "rgba(20, 13, 4, 0.98)");
      bg.addColorStop(1,   "rgba(10, 6,  2, 1.0)" );
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, MAP_W, MAP_H);

      // ── Dungeon grid ──────────────────────────────────────
      ctx.strokeStyle = "rgba(120, 80, 20, 0.22)";
      ctx.lineWidth   = 0.5;
      const gridStep  = 20;
      for (let x = 0; x <= MAP_W; x += gridStep) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, MAP_H); ctx.stroke();
      }
      for (let y = 0; y <= MAP_H; y += gridStep) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(MAP_W, y); ctx.stroke();
      }

      // ── World boundary ────────────────────────────────────
      const borderColor = isBoss
        ? "rgba(249,115,22,0.7)"
        : "rgba(160,110,30,0.75)";
      ctx.strokeStyle = borderColor;
      ctx.lineWidth   = 1.5;
      ctx.strokeRect(0, 0, MAP_W, MAP_H);

      ctx.strokeStyle = "rgba(0,0,0,0.5)";
      ctx.lineWidth   = 1;
      ctx.strokeRect(1.5, 1.5, MAP_W - 3, MAP_H - 3);

      // ── Edge vignette ─────────────────────────────────────
      const vig = ctx.createRadialGradient(
        MAP_W / 2, MAP_H / 2, MAP_H * 0.2,
        MAP_W / 2, MAP_H / 2, MAP_H * 0.85
      );
      vig.addColorStop(0, "rgba(0,0,0,0)");
      vig.addColorStop(1, "rgba(0,0,0,0.45)");
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, MAP_W, MAP_H);

      // ── Door ──────────────────────────────────────────────
      if (state.door) {
        const dp = toMap(
          state.door.x + state.door.width  / 2,
          state.door.y + state.door.height / 2
        );
        ctx.beginPath();
        ctx.arc(dp.x, dp.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = state.door.isActive ? "#4ade80" : "rgba(90,64,16,0.5)";
        ctx.fill();
        if (state.door.isActive) {
          ctx.beginPath();
          ctx.arc(dp.x, dp.y, 6, 0, Math.PI * 2);
          ctx.strokeStyle = "rgba(74,222,128,0.45)";
          ctx.lineWidth   = 1;
          ctx.stroke();
        }
      }

      // ── Enemies ───────────────────────────────────────────
      state.enemies.forEach((enemy) => {
        if (enemy.isDead) return;
        const ep = toMap(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2);

        if (enemy instanceof Tank) {
          ctx.beginPath();
          ctx.arc(ep.x, ep.y, 4, 0, Math.PI * 2);
          ctx.fillStyle = "#7a5c2a";
          ctx.fill();
        } else if (enemy instanceof Shooter) {
          ctx.beginPath();
          ctx.arc(ep.x, ep.y, 2.5, 0, Math.PI * 2);
          ctx.fillStyle = "#c0860c";
          ctx.fill();
        } else if (enemy instanceof Dasher) {
          ctx.save();
          ctx.translate(ep.x, ep.y);
          ctx.rotate(Math.PI / 4);
          ctx.fillStyle = "#06b6d4";
          ctx.fillRect(-2.5, -2.5, 5, 5);
          ctx.restore();
        } else if (enemy instanceof Bomber) {
          ctx.fillStyle = "#f97316";
          ctx.fillRect(ep.x - 3, ep.y - 3, 6, 6);
        } else {
          // Grunt
          ctx.beginPath();
          ctx.arc(ep.x, ep.y, 2.5, 0, Math.PI * 2);
          ctx.fillStyle = "#a855f7";
          ctx.fill();
        }
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
        ctx.strokeStyle = "rgba(239,68,68,0.55)";
        ctx.lineWidth   = 2;
        ctx.stroke();
        ctx.fillStyle    = "rgba(239,68,68,0.85)";
        ctx.font         = "bold 6px 'Cinzel', serif";
        ctx.textAlign    = "center";
        ctx.fillText("☩", bp.x, bp.y - 8);
        ctx.textAlign    = "left";
      }

      // ── Player — gold diamond ─────────────────────────────
      const pp = toMap(
        state.player.x + state.player.width  / 2,
        state.player.y + state.player.height / 2
      );
      ctx.beginPath();
      ctx.arc(pp.x, pp.y, 6, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(240,192,64,0.18)";
      ctx.fill();
      ctx.save();
      ctx.translate(pp.x, pp.y);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = "#f0c040";
      ctx.fillRect(-3, -3, 6, 6);
      ctx.restore();

      // ── Camera viewport rect ──────────────────────────────
      const vp = toMap(state.camera.x, state.camera.y);
      ctx.strokeStyle = "rgba(160,110,30,0.18)";
      ctx.lineWidth   = 1;
      ctx.strokeRect(
        vp.x, vp.y,
        state.camera.screenW * scaleX,
        state.camera.screenH * scaleY
      );

      // ── Minimap fog overlay ───────────────────────────────
      // Radial gradient centered on player position — matches
      // gameplay fog proportionally (~38% of map width radius).
      // Drawn last so it sits on top of all entities.
      const fogRadius = MAP_W * 0.38;
      const fogGrad   = ctx.createRadialGradient(
        pp.x, pp.y, 0,
        pp.x, pp.y, fogRadius
      );
      fogGrad.addColorStop(0.00, "rgba(0, 0, 0, 0)");
      fogGrad.addColorStop(0.40, "rgba(0, 0, 0, 0)");
      fogGrad.addColorStop(0.70, "rgba(15, 15, 15, 0.55)");
      fogGrad.addColorStop(1.00, isBoss
        ? "rgba(30, 10, 10, 0.88)"
        : "rgba(15, 15, 15, 0.88)"
      );
      ctx.fillStyle = fogGrad;
      ctx.fillRect(0, 0, MAP_W, MAP_H);

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [state, isBoss]);

  return (
    <div className="minimap-root">
      <div className="minimap-frame">

        {/* Title bar */}
        <div className="minimap-title-bar">
          <div className="minimap-title-gem" />
          <p className="minimap-label">Realm Map</p>
          <div className="minimap-title-gem" />
        </div>

        {/* Canvas */}
        <div className="minimap-canvas-wrap">
          <canvas
            ref={canvasRef}
            width={MAP_W}
            height={MAP_H}
            className="minimap-canvas"
          />
        </div>

        {/* Legend — two rows */}
        <div className="minimap-legend">
          <div className="minimap-legend__row">
            {LEGEND_ROW1.map(({ color, label }) => (
              <div key={label} className="minimap-legend__item">
                <div className="minimap-legend__dot" style={{ background: color }} />
                <span className="minimap-legend__label">{label}</span>
              </div>
            ))}
          </div>
          <div className="minimap-legend__row">
            {LEGEND_ROW2.map(({ color, label }) => (
              <div key={label} className="minimap-legend__item">
                <div className="minimap-legend__dot" style={{ background: color }} />
                <span className="minimap-legend__label">{label}</span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}