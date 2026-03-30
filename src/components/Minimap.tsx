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
  { color: "#f8fafc", label: "You"     },
  { color: "#a855f7", label: "Grunt"   },
  { color: "#f59e0b", label: "Shooter" },
  { color: "#475569", label: "Tank"    },
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

      // ── Background ────────────────────────────────────────
      ctx.fillStyle = "rgba(10, 15, 30, 0.85)";
      ctx.fillRect(0, 0, MAP_W, MAP_H);

      // ── World boundary ────────────────────────────────────
      ctx.strokeStyle = isBoss
        ? "rgba(249, 115, 22, 0.4)"
        : "rgba(239, 68, 68, 0.4)";
      ctx.lineWidth = 1;
      ctx.strokeRect(PADDING, PADDING, MAP_W - PADDING * 2, MAP_H - PADDING * 2);

      // ── Door ──────────────────────────────────────────────
      if (state.door) {
        const dp = toMap(
          state.door.x + state.door.width  / 2,
          state.door.y + state.door.height / 2
        );
        ctx.beginPath();
        ctx.arc(dp.x, dp.y, 3, 0, Math.PI * 2);
        ctx.fillStyle = state.door.isActive ? "#4ade80" : "rgba(100,100,100,0.4)";
        ctx.fill();

        if (state.door.isActive) {
          ctx.beginPath();
          ctx.arc(dp.x, dp.y, 5, 0, Math.PI * 2);
          ctx.strokeStyle = "rgba(74, 222, 128, 0.4)";
          ctx.lineWidth   = 1;
          ctx.stroke();
        }
      }

      // ── Enemies ───────────────────────────────────────────
      state.enemies.forEach((enemy) => {
        if (enemy.isDead) return;
        const ep = toMap(
          enemy.x + enemy.width  / 2,
          enemy.y + enemy.height / 2
        );

        // Tank gets a larger dot to reflect its physical size
        const radius = enemy instanceof Tank ? 4 : 2;
        const color  =
          enemy instanceof Tank    ? "#475569" :
          enemy instanceof Shooter ? "#f59e0b" :
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
        ctx.arc(bp.x, bp.y, 5, 0, Math.PI * 2);
        ctx.fillStyle = "#ef4444";
        ctx.fill();

        ctx.fillStyle = "rgba(239,68,68,0.7)";
        ctx.font      = "bold 6px 'Courier New'";
        ctx.textAlign = "center";
        ctx.fillText("BOSS", bp.x, bp.y - 7);
        ctx.textAlign = "left";
      }

      // ── Player ────────────────────────────────────────────
      const pp = toMap(
        state.player.x + state.player.width  / 2,
        state.player.y + state.player.height / 2
      );

      ctx.beginPath();
      ctx.arc(pp.x, pp.y, 5, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.15)";
      ctx.fill();

      ctx.beginPath();
      ctx.arc(pp.x, pp.y, 3, 0, Math.PI * 2);
      ctx.fillStyle = "#f8fafc";
      ctx.fill();

      // ── Camera viewport ───────────────────────────────────
      const vp = toMap(state.camera.x, state.camera.y);
      ctx.strokeStyle = "rgba(255,255,255,0.12)";
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
        <p className="minimap-label">Minimap</p>

        <canvas
          ref={canvasRef}
          width={MAP_W}
          height={MAP_H}
          className="minimap-canvas"
        />

        <div className="minimap-legend">
          {LEGEND.map(({ color, label }) => (
            <div key={label} className="minimap-legend__item">
              <div
                className="minimap-legend__dot"
                style={{ background: color }}
              />
              <span className="minimap-legend__label">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}