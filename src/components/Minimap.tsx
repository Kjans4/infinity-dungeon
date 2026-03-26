// src/components/Minimap.tsx
"use client";

import React, { useEffect, useRef } from "react";
import { GameState } from "@/engine/GameState";
import { WORLD_W, WORLD_H, BOSS_WORLD_W, BOSS_WORLD_H } from "@/engine/Camera";
import { Grunt } from "@/engine/enemy/Grunt";
import { Shooter } from "@/engine/enemy/Shooter";

// ============================================================
// [🧱 BLOCK: Minimap Props]
// ============================================================
interface MinimapProps {
  state:   GameState | null;
  isBoss:  boolean;
}

// ============================================================
// [🧱 BLOCK: Minimap Constants]
// ============================================================
const MAP_W   = 160;
const MAP_H   = 120;
const PADDING = 6; // Inner padding so dots don't clip edges

// ============================================================
// [🧱 BLOCK: Minimap Component]
// Draws onto a small canvas every frame using requestAnimationFrame.
// Shows:
//   - World boundary
//   - Player position (white dot)
//   - Enemy positions (red/orange dots by type)
//   - Door position (green dot when active, grey when not)
//   - Boss position (large orange dot)
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

      // Scale factors — world coords → minimap coords
      const scaleX = (MAP_W - PADDING * 2) / worldW;
      const scaleY = (MAP_H - PADDING * 2) / worldH;

      // Helper: world pos → minimap screen pos
      const toMap = (wx: number, wy: number) => ({
        x: PADDING + wx * scaleX,
        y: PADDING + wy * scaleY,
      });

      // ── Clear ──────────────────────────────────────────────
      ctx.clearRect(0, 0, MAP_W, MAP_H);

      // ── Background ─────────────────────────────────────────
      ctx.fillStyle = "rgba(10, 15, 30, 0.85)";
      ctx.fillRect(0, 0, MAP_W, MAP_H);

      // ── World boundary ─────────────────────────────────────
      ctx.strokeStyle = isBoss
        ? "rgba(249, 115, 22, 0.4)"
        : "rgba(239, 68, 68, 0.4)";
      ctx.lineWidth   = 1;
      ctx.strokeRect(PADDING, PADDING, MAP_W - PADDING * 2, MAP_H - PADDING * 2);

      // ── Door ───────────────────────────────────────────────
      if (state.door) {
        const dp = toMap(
          state.door.x + state.door.width  / 2,
          state.door.y + state.door.height / 2
        );
        ctx.beginPath();
        ctx.arc(dp.x, dp.y, 3, 0, Math.PI * 2);
        ctx.fillStyle = state.door.isActive
          ? "#4ade80"
          : "rgba(100,100,100,0.4)";
        ctx.fill();

        // Pulsing ring when active
        if (state.door.isActive) {
          ctx.beginPath();
          ctx.arc(dp.x, dp.y, 5, 0, Math.PI * 2);
          ctx.strokeStyle = "rgba(74, 222, 128, 0.4)";
          ctx.lineWidth   = 1;
          ctx.stroke();
        }
      }

      // ── Enemies ────────────────────────────────────────────
      state.enemies.forEach((enemy) => {
        if (enemy.isDead) return;
        const ep = toMap(
          enemy.x + enemy.width  / 2,
          enemy.y + enemy.height / 2
        );
        ctx.beginPath();
        ctx.arc(ep.x, ep.y, 2, 0, Math.PI * 2);
        ctx.fillStyle = enemy instanceof Shooter
          ? "#f59e0b"   // Orange for shooters
          : "#a855f7";  // Purple for grunts
        ctx.fill();
      });

      // ── Boss ───────────────────────────────────────────────
      if (state.boss && !state.boss.isDead) {
        const bp = toMap(
          state.boss.x + state.boss.width  / 2,
          state.boss.y + state.boss.height / 2
        );
        ctx.beginPath();
        ctx.arc(bp.x, bp.y, 5, 0, Math.PI * 2);
        ctx.fillStyle = "#ef4444";
        ctx.fill();

        // Boss label
        ctx.fillStyle   = "rgba(239,68,68,0.7)";
        ctx.font        = "bold 6px 'Courier New'";
        ctx.textAlign   = "center";
        ctx.fillText("BOSS", bp.x, bp.y - 7);
        ctx.textAlign   = "left";
      }

      // ── Player ─────────────────────────────────────────────
      const pp = toMap(
        state.player.x + state.player.width  / 2,
        state.player.y + state.player.height / 2
      );

      // Player glow
      ctx.beginPath();
      ctx.arc(pp.x, pp.y, 5, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.15)";
      ctx.fill();

      // Player dot
      ctx.beginPath();
      ctx.arc(pp.x, pp.y, 3, 0, Math.PI * 2);
      ctx.fillStyle = "#f8fafc";
      ctx.fill();

      // ── Camera viewport indicator ──────────────────────────
      // Shows what portion of the world is currently visible
      const camX = state.camera.x;
      const camY = state.camera.y;
      const camW = state.camera.screenW;
      const camH = state.camera.screenH;

      const vp = toMap(camX, camY);
      ctx.strokeStyle = "rgba(255,255,255,0.12)";
      ctx.lineWidth   = 1;
      ctx.strokeRect(vp.x, vp.y, camW * scaleX, camH * scaleY);

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [state, isBoss]);

  return (
    <div style={{
      position:     "fixed",
      top:          16,
      right:        16,
      zIndex:       20,
      pointerEvents:"none",
    }}>
      {/* Glass frame */}
      <div style={{
        background:          "rgba(10, 15, 30, 0.6)",
        backdropFilter:      "blur(8px)",
        WebkitBackdropFilter:"blur(8px)",
        border:              "1px solid rgba(255,255,255,0.07)",
        borderRadius:        8,
        padding:             4,
        display:             "flex",
        flexDirection:       "column",
        gap:                 4,
      }}>
        {/* Label */}
        <p style={{
          fontFamily:   "'Courier New', monospace",
          fontSize:     7,
          color:        "rgba(100,116,139,0.7)",
          letterSpacing:"0.15em",
          textTransform:"uppercase",
          textAlign:    "center",
          margin:       0,
          paddingTop:   2,
        }}>
          Minimap
        </p>

        {/* Canvas */}
        <canvas
          ref={canvasRef}
          width={MAP_W}
          height={MAP_H}
          style={{ display: "block", borderRadius: 4 }}
        />

        {/* Legend */}
        <div style={{
          display:      "flex",
          gap:          8,
          justifyContent:"center",
          paddingBottom: 2,
        }}>
          {[
            { color: "#f8fafc",  label: "You"     },
            { color: "#a855f7",  label: "Grunt"   },
            { color: "#f59e0b",  label: "Shooter" },
            { color: "#4ade80",  label: "Gate"    },
          ].map(({ color, label }) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: 3 }}>
              <div style={{
                width: 5, height: 5, borderRadius: "50%",
                background: color,
              }} />
              <span style={{
                fontFamily:   "'Courier New', monospace",
                fontSize:     6,
                color:        "rgba(100,116,139,0.7)",
                letterSpacing:"0.05em",
              }}>
                {label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}