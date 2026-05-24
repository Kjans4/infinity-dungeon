// src/components/Menu.tsx
"use client";

import React, { useEffect, useState } from "react";
import { loadBestRun, loadRunHistory, RunRecord } from "@/engine/GameState";
import "@/styles/menu.css";

// ============================================================
// [🧱 BLOCK: Menu Props]
// ============================================================
interface MenuProps {
  onStart: () => void;
}

// ============================================================
// [🧱 BLOCK: Time Formatter]
// ============================================================
function formatTime(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const mins     = Math.floor(totalSec / 60);
  const secs     = totalSec % 60;
  if (mins === 0) return `${secs}s`;
  return `${mins}m ${secs}s`;
}

// ============================================================
// [🧱 BLOCK: Gothic Title Frame SVG]
// Nameplate frame — curved corner flourishes + horizontal bars
// ============================================================
function TitleFrame({ width, height }: { width: number; height: number }) {
  const w = width;
  const h = height;
  const c = 18; // corner flourish size

  return (
    <svg
      className="menu-title-frame"
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* ── Main border rectangle with curved corners ── */}
      <path
        d={`
          M ${c} 2
          L ${w - c} 2
          Q ${w - 2} 2 ${w - 2} ${c}
          L ${w - 2} ${h - c}
          Q ${w - 2} ${h - 2} ${w - c} ${h - 2}
          L ${c} ${h - 2}
          Q 2 ${h - 2} 2 ${h - c}
          L 2 ${c}
          Q 2 2 ${c} 2
          Z
        `}
        stroke="#8B6914"
        strokeWidth="1"
        opacity="0.7"
      />

      {/* ── Inner border ── */}
      <path
        d={`
          M ${c + 4} 6
          L ${w - c - 4} 6
          Q ${w - 6} 6 ${w - 6} ${c + 4}
          L ${w - 6} ${h - c - 4}
          Q ${w - 6} ${h - 6} ${w - c - 4} ${h - 6}
          L ${c + 4} ${h - 6}
          Q 6 ${h - 6} 6 ${h - c - 4}
          L 6 ${c + 4}
          Q 6 6 ${c + 4} 6
          Z
        `}
        stroke="#c0860c"
        strokeWidth="0.5"
        opacity="0.4"
      />

      {/* ── Top-left gothic flourish ── */}
      <g opacity="0.9">
        {/* Corner diamond */}
        <rect x="8" y="8" width="7" height="7" transform="rotate(45 11.5 11.5)" fill="#8B6914" opacity="0.6" />
        <rect x="9" y="9" width="5" height="5" transform="rotate(45 11.5 11.5)" fill="#f0c040" opacity="0.3" />
        {/* Vertical spike */}
        <path d="M 11.5 2 L 11.5 8" stroke="#8B6914" strokeWidth="1" />
        <path d="M 11.5 2 L 9 5 L 11.5 4 L 14 5 Z" fill="#8B6914" opacity="0.7" />
        {/* Horizontal spike */}
        <path d="M 2 11.5 L 8 11.5" stroke="#8B6914" strokeWidth="1" />
        <path d="M 2 11.5 L 5 9 L 4 11.5 L 5 14 Z" fill="#8B6914" opacity="0.7" />
        {/* Curl */}
        <path d="M 8 8 Q 14 8 14 14" stroke="#c0860c" strokeWidth="0.7" fill="none" opacity="0.5" />
      </g>

      {/* ── Top-right gothic flourish ── */}
      <g opacity="0.9">
        <rect x={w - 15} y="8" width="7" height="7" transform={`rotate(45 ${w - 11.5} 11.5)`} fill="#8B6914" opacity="0.6" />
        <rect x={w - 14} y="9" width="5" height="5" transform={`rotate(45 ${w - 11.5} 11.5)`} fill="#f0c040" opacity="0.3" />
        <path d={`M ${w - 11.5} 2 L ${w - 11.5} 8`} stroke="#8B6914" strokeWidth="1" />
        <path d={`M ${w - 11.5} 2 L ${w - 14} 5 L ${w - 11.5} 4 L ${w - 9} 5 Z`} fill="#8B6914" opacity="0.7" />
        <path d={`M ${w - 2} 11.5 L ${w - 8} 11.5`} stroke="#8B6914" strokeWidth="1" />
        <path d={`M ${w - 2} 11.5 L ${w - 5} 9 L ${w - 4} 11.5 L ${w - 5} 14 Z`} fill="#8B6914" opacity="0.7" />
        <path d={`M ${w - 8} 8 Q ${w - 14} 8 ${w - 14} 14`} stroke="#c0860c" strokeWidth="0.7" fill="none" opacity="0.5" />
      </g>

      {/* ── Bottom-left gothic flourish ── */}
      <g opacity="0.9">
        <rect x="8" y={h - 15} width="7" height="7" transform={`rotate(45 11.5 ${h - 11.5})`} fill="#8B6914" opacity="0.6" />
        <rect x="9" y={h - 14} width="5" height="5" transform={`rotate(45 11.5 ${h - 11.5})`} fill="#f0c040" opacity="0.3" />
        <path d={`M 11.5 ${h - 2} L 11.5 ${h - 8}`} stroke="#8B6914" strokeWidth="1" />
        <path d={`M 11.5 ${h - 2} L 9 ${h - 5} L 11.5 ${h - 4} L 14 ${h - 5} Z`} fill="#8B6914" opacity="0.7" />
        <path d={`M 2 ${h - 11.5} L 8 ${h - 11.5}`} stroke="#8B6914" strokeWidth="1" />
        <path d={`M 2 ${h - 11.5} L 5 ${h - 9} L 4 ${h - 11.5} L 5 ${h - 14} Z`} fill="#8B6914" opacity="0.7" />
        <path d={`M 8 ${h - 8} Q 14 ${h - 8} 14 ${h - 14}`} stroke="#c0860c" strokeWidth="0.7" fill="none" opacity="0.5" />
      </g>

      {/* ── Bottom-right gothic flourish ── */}
      <g opacity="0.9">
        <rect x={w - 15} y={h - 15} width="7" height="7" transform={`rotate(45 ${w - 11.5} ${h - 11.5})`} fill="#8B6914" opacity="0.6" />
        <rect x={w - 14} y={h - 14} width="5" height="5" transform={`rotate(45 ${w - 11.5} ${h - 11.5})`} fill="#f0c040" opacity="0.3" />
        <path d={`M ${w - 11.5} ${h - 2} L ${w - 11.5} ${h - 8}`} stroke="#8B6914" strokeWidth="1" />
        <path d={`M ${w - 11.5} ${h - 2} L ${w - 14} ${h - 5} L ${w - 11.5} ${h - 4} L ${w - 9} ${h - 5} Z`} fill="#8B6914" opacity="0.7" />
        <path d={`M ${w - 2} ${h - 11.5} L ${w - 8} ${h - 11.5}`} stroke="#8B6914" strokeWidth="1" />
        <path d={`M ${w - 2} ${h - 11.5} L ${w - 5} ${h - 9} L ${w - 4} ${h - 11.5} L ${w - 5} ${h - 14} Z`} fill="#8B6914" opacity="0.7" />
        <path d={`M ${w - 8} ${h - 8} Q ${w - 14} ${h - 8} ${w - 14} ${h - 14}`} stroke="#c0860c" strokeWidth="0.7" fill="none" opacity="0.5" />
      </g>

      {/* ── Top horizontal bar extensions ── */}
      <line x1={c} y1="2" x2={w / 2 - 30} y2="2" stroke="#8B6914" strokeWidth="1.5" opacity="0.8" />
      <line x1={w / 2 + 30} y1="2" x2={w - c} y2="2" stroke="#8B6914" strokeWidth="1.5" opacity="0.8" />
      {/* Top center diamond */}
      <rect x={w / 2 - 4} y={-2} width="8" height="8" transform={`rotate(45 ${w / 2} 2)`} fill="#8B6914" opacity="0.8" />
      <rect x={w / 2 - 2.5} y={-0.5} width="5" height="5" transform={`rotate(45 ${w / 2} 2)`} fill="#f0c040" opacity="0.5" />

      {/* ── Bottom horizontal bar extensions ── */}
      <line x1={c} y1={h - 2} x2={w / 2 - 30} y2={h - 2} stroke="#8B6914" strokeWidth="1.5" opacity="0.8" />
      <line x1={w / 2 + 30} y1={h - 2} x2={w - c} y2={h - 2} stroke="#8B6914" strokeWidth="1.5" opacity="0.8" />
      {/* Bottom center diamond */}
      <rect x={w / 2 - 4} y={h - 6} width="8" height="8" transform={`rotate(45 ${w / 2} ${h - 2})`} fill="#8B6914" opacity="0.8" />
      <rect x={w / 2 - 2.5} y={h - 4.5} width="5" height="5" transform={`rotate(45 ${w / 2} ${h - 2})`} fill="#f0c040" opacity="0.5" />

      {/* ── Mid side accent marks ── */}
      <line x1="2" y1={h / 2 - 10} x2="2" y2={h / 2 + 10} stroke="#8B6914" strokeWidth="2" opacity="0.6" />
      <line x1={w - 2} y1={h / 2 - 10} x2={w - 2} y2={h / 2 + 10} stroke="#8B6914" strokeWidth="2" opacity="0.6" />
      <circle cx="2" cy={h / 2} r="2.5" fill="#8B6914" opacity="0.7" />
      <circle cx={w - 2} cy={h / 2} r="2.5" fill="#8B6914" opacity="0.7" />
    </svg>
  );
}

// ============================================================
// [🧱 BLOCK: Button Corner Brackets]
// Individual corner bracket frame per button
// ============================================================
function ButtonFrame({ width, height, color = "#8B6914" }: { width: number; height: number; color?: string }) {
  const s = 10; // bracket size
  const g = 3;  // gap from edge

  return (
    <svg
      className="menu-btn-frame"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
    >
      {/* Top-left */}
      <path d={`M ${g} ${g + s} L ${g} ${g} L ${g + s} ${g}`} stroke={color} strokeWidth="1.5" />
      <circle cx={g} cy={g} r="1.5" fill={color} opacity="0.6" />

      {/* Top-right */}
      <path d={`M ${width - g} ${g + s} L ${width - g} ${g} L ${width - g - s} ${g}`} stroke={color} strokeWidth="1.5" />
      <circle cx={width - g} cy={g} r="1.5" fill={color} opacity="0.6" />

      {/* Bottom-left */}
      <path d={`M ${g} ${height - g - s} L ${g} ${height - g} L ${g + s} ${height - g}`} stroke={color} strokeWidth="1.5" />
      <circle cx={g} cy={height - g} r="1.5" fill={color} opacity="0.6" />

      {/* Bottom-right */}
      <path d={`M ${width - g} ${height - g - s} L ${width - g} ${height - g} L ${width - g - s} ${height - g}`} stroke={color} strokeWidth="1.5" />
      <circle cx={width - g} cy={height - g} r="1.5" fill={color} opacity="0.6" />
    </svg>
  );
}

// ============================================================
// [🧱 BLOCK: Run History]
// ============================================================
function RunHistory() {
  const [best,    setBest]    = useState<RunRecord | null>(null);
  const [history, setHistory] = useState<RunRecord[]>([]);

  useEffect(() => {
    setBest(loadBestRun());
    setHistory(loadRunHistory().slice(0, 5));
  }, []);

  if (!best && history.length === 0) return null;

  return (
    <div className="menu-history">
      {best && (
        <div className="menu-history__best">
          <span className="menu-history__best-crown">⚜ BEST RUN</span>
          <div className="menu-history__best-stats">
            <div className="menu-history__best-stat">
              <span className="menu-history__best-stat-label">Floor</span>
              <span className="menu-history__best-stat-value">{best.floor}</span>
            </div>
            <div className="menu-history__divider" />
            <div className="menu-history__best-stat">
              <span className="menu-history__best-stat-label">Kills</span>
              <span className="menu-history__best-stat-value">{best.kills}</span>
            </div>
            <div className="menu-history__divider" />
            <div className="menu-history__best-stat">
              <span className="menu-history__best-stat-label">Time</span>
              <span className="menu-history__best-stat-value">{formatTime(best.elapsedMs)}</span>
            </div>
            <div className="menu-history__divider" />
            <div className="menu-history__best-stat">
              <span className="menu-history__best-stat-label">Gold</span>
              <span className="menu-history__best-stat-value">{best.goldEarned}g</span>
            </div>
          </div>
        </div>
      )}

      {history.length > 1 && (
        <>
          <p className="menu-history__label">Recent Runs</p>
          <div className="menu-history__list">
            {history.map((run, i) => (
              <div key={run.timestamp} className="menu-history__row">
                <span className="menu-history__row-index">{i + 1}</span>
                <span className="menu-history__row-floor">F{run.floor}</span>
                <span className="menu-history__row-kills">{run.kills} kills</span>
                <span className="menu-history__row-time">{formatTime(run.elapsedMs)}</span>
                <span className="menu-history__row-gold">{run.goldEarned}g</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ============================================================
// [🧱 BLOCK: Menu Component]
// ============================================================
export default function Menu({ onStart }: MenuProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 60);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className={`menu-root ${visible ? "menu-root--visible" : ""}`}>

      {/* ── Background image ── */}
      <div className="menu-bg" />

      {/* ── Dark fog vignette ── */}
      <div className="menu-fog" />

      {/* ── Center column ── */}
      <div className="menu-center">

        {/* Gothic title nameplate */}
        <div className="menu-title-wrap">
          <TitleFrame width={400} height={90} />
          <div className="menu-title-content">
            <p className="menu-eyebrow">A ROGUELIKE DUNGEON CRAWLER</p>
            <h1 className="menu-title">INFINITY <span className="menu-title__dot">·</span> DUNGEON</h1>
          </div>
        </div>

        {/* Buttons */}
        <div className="menu-buttons">

          {/* RAID */}
          <div className="menu-btn-wrap">
            <ButtonFrame width={300} height={58} color="#c0860c" />
            <button className="menu-btn menu-btn--raid" onClick={onStart}>
              RAID
            </button>
          </div>

          {/* SETTINGS */}
          <div className="menu-btn-wrap">
            <ButtonFrame width={300} height={44} color="#2e2008" />
            <button className="menu-btn menu-btn--settings" disabled>
              SETTINGS
            </button>
          </div>

        </div>

        {/* Run history */}
        <RunHistory />

      </div>

      {/* ── Version watermark ── */}
      <p className="menu-version">ALPHA v0.1</p>

    </div>
  );
}