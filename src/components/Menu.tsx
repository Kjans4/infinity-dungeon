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
// [🧱 BLOCK: Corner Ornament SVG]
// Reusable filigree corner — mirrored via CSS transform.
// ============================================================
function CornerOrnament() {
  return (
    <svg viewBox="0 0 30 30" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M2 28L2 2L28 2" stroke="#8B6914" strokeWidth="1.5" />
      <rect
        x="6" y="6" width="7" height="7"
        fill="#0e0b06" stroke="#6a4c10" strokeWidth="1"
        transform="rotate(45 9.5 9.5)"
      />
    </svg>
  );
}

// ============================================================
// [🧱 BLOCK: Horizontal Rule]
// Gold diamond dividers used between sections.
// ============================================================
function HRule() {
  return (
    <div className="menu-hrule">
      <div className="menu-hrule__line" />
      <div className="menu-hrule__gem" />
      <div className="menu-hrule__line" />
      <div className="menu-hrule__gem" />
      <div className="menu-hrule__line" />
    </div>
  );
}

// ============================================================
// [🧱 BLOCK: Sigil SVG]
// Hand-crafted crest with shield, cross, runes, and jewel.
// ============================================================
function Sigil() {
  return (
    <svg className="menu-sigil" viewBox="0 0 160 160" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Outer rings */}
      <circle cx="80" cy="80" r="74" stroke="#2e2008" strokeWidth="1" />
      <circle cx="80" cy="80" r="72" stroke="#5a4010" strokeWidth="0.6" strokeDasharray="5 3" />
      {/* Shield body */}
      <path
        d="M80 18 L118 36 L118 80 Q118 116 80 138 Q42 116 42 80 L42 36 Z"
        fill="#0e0b06" stroke="#8B6914" strokeWidth="1.4"
      />
      {/* Shield inner */}
      <path
        d="M80 30 L108 44 L108 80 Q108 108 80 126 Q52 108 52 80 L52 44 Z"
        fill="none" stroke="#2a1e08" strokeWidth="0.8"
      />
      {/* Cross */}
      <path d="M80 44 L80 118" stroke="#5a4010" strokeWidth="1" strokeLinecap="round" />
      <path d="M55 74 L105 74"  stroke="#5a4010" strokeWidth="1" strokeLinecap="round" />
      {/* Rune marks */}
      <path d="M65 56 L70 50 L75 56" stroke="#6a4c10" strokeWidth="0.8" fill="none" />
      <path d="M85 56 L90 50 L95 56" stroke="#6a4c10" strokeWidth="0.8" fill="none" />
      <path d="M65 96 L70 102 L75 96" stroke="#6a4c10" strokeWidth="0.8" fill="none" />
      <path d="M85 96 L90 102 L95 96" stroke="#6a4c10" strokeWidth="0.8" fill="none" />
      {/* Central jewel */}
      <polygon points="80,68 85,74 80,80 75,74" fill="#1a1008" stroke="#c0860c" strokeWidth="1" />
      <circle cx="80" cy="74" r="2.5" fill="#8B6914" />
      {/* Banner */}
      <path d="M50 140 L55 132 L80 138 L105 132 L110 140" stroke="#5a4010" strokeWidth="0.9" fill="none" />
      {/* Crown top */}
      <path d="M62 20 L70 14 L80 18 L90 14 L98 20" stroke="#5a4010" strokeWidth="0.9" fill="none" />
      <path d="M75 14 L80 8 L85 14" stroke="#8B6914" strokeWidth="1" fill="none" />
      <circle cx="80" cy="8" r="2" fill="#8B6914" />
    </svg>
  );
}

// ============================================================
// [🧱 BLOCK: Stone Cracks SVG]
// ============================================================
function StoneCracks() {
  return (
    <svg
      className="menu-cracks"
      viewBox="0 0 560 560"
      preserveAspectRatio="xMidYMid slice"
    >
      <path d="M60 0 L85 110 L55 165 L95 240 L72 330 L108 400 L84 500 L118 560"
        stroke="#c8a050" strokeWidth="1.2" fill="none" />
      <path d="M85 110 L130 150 L108 185"
        stroke="#c8a050" strokeWidth="0.8" fill="none" />
      <path d="M220 0 L200 70 L228 115 L205 205 L235 275 L212 365 L240 455 L220 560"
        stroke="#c8a050" strokeWidth="0.9" fill="none" />
      <path d="M400 80 L375 190 L408 260 L382 360 L415 450 L398 560"
        stroke="#c8a050" strokeWidth="0.7" fill="none" />
      <path d="M0 220 L90 232 L140 226 L228 238 L320 228 L420 240 L560 235"
        stroke="#c8a050" strokeWidth="0.6" fill="none" />
      <path d="M0 380 L75 370 L160 382 L280 372 L400 385 L500 375 L560 380"
        stroke="#c8a050" strokeWidth="0.4" fill="none" />
    </svg>
  );
}

// ============================================================
// [🧱 BLOCK: Menu Button]
// ============================================================
interface MenuButtonProps {
  icon:    React.ReactNode;
  label:   string;
  active?: boolean;
  danger?: boolean;
  onClick: () => void;
}

function MenuButton({ icon, label, active, danger, onClick }: MenuButtonProps) {
  return (
    <button
      onClick={onClick}
      className={[
        "menu-item-btn",
        active  ? "menu-item-btn--active"  : "",
        danger  ? "menu-item-btn--danger"  : "",
      ].join(" ").trim()}
    >
      <span className="menu-item-btn__icon">{icon}</span>
      {label}
      <span className="menu-item-btn__arrow">&#9656;</span>
    </button>
  );
}

// ============================================================
// [🧱 BLOCK: Icon SVGs]
// ============================================================
const IconStar = (
  <svg viewBox="0 0 18 18" fill="none">
    <path d="M9 1L11 6.5H17L12.5 10L14.5 16L9 12.5L3.5 16L5.5 10L1 6.5H7L9 1Z" fill="#c0860c" />
  </svg>
);
const IconClock = (
  <svg viewBox="0 0 18 18" fill="none">
    <circle cx="9" cy="9" r="6.5" stroke="#8B6914" strokeWidth="1.2" />
    <path d="M9 5v4.5l3 2" stroke="#c0860c" strokeWidth="1.2" strokeLinecap="round" />
  </svg>
);
const IconScroll = (
  <svg viewBox="0 0 18 18" fill="none">
    <rect x="2" y="2" width="14" height="14" rx="1" stroke="#8B6914" strokeWidth="1.2" />
    <path d="M6 2v14M2 7h14M2 11h14" stroke="#8B6914" strokeWidth="0.7" opacity="0.5" />
  </svg>
);
const IconGear = (
  <svg viewBox="0 0 18 18" fill="none">
    <circle cx="9" cy="9" r="2.5" stroke="#8B6914" strokeWidth="1.2" />
    <path d="M9 1.5v2M9 14.5v2M1.5 9h2M14.5 9h2M3.7 3.7l1.4 1.4M12.9 12.9l1.4 1.4M3.7 14.3l1.4-1.4M12.9 5.1l1.4-1.4"
      stroke="#8B6914" strokeWidth="1" strokeLinecap="round" />
  </svg>
);
const IconExit = (
  <svg viewBox="0 0 18 18" fill="none">
    <path d="M8 3H4a1 1 0 00-1 1v10a1 1 0 001 1h4M12 6l3 3-3 3M7 9h8"
      stroke="#6a2010" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// ============================================================
// [🧱 BLOCK: Best Run Panel]
// Displays the personal best + last 5 runs in the menu.
// ============================================================
function BestRunPanel() {
  const [best,    setBest]    = useState<RunRecord | null>(null);
  const [history, setHistory] = useState<RunRecord[]>([]);

  useEffect(() => {
    setBest(loadBestRun());
    setHistory(loadRunHistory().slice(0, 5));
  }, []);

  if (!best) return null;

  return (
    <div className="menu-best-run">
      <div className="menu-best-run__header">
        <span className="menu-best-run__crown">⚜</span>
        <span className="menu-best-run__title">Best Run</span>
      </div>

      <div className="menu-best-run__record">
        <div className="menu-best-run__stat">
          <span className="menu-best-run__stat-label">Floor</span>
          <span className="menu-best-run__stat-value menu-best-run__stat-value--gold">
            {best.floor}
          </span>
        </div>
        <div className="menu-best-run__divider" />
        <div className="menu-best-run__stat">
          <span className="menu-best-run__stat-label">Kills</span>
          <span className="menu-best-run__stat-value">{best.kills}</span>
        </div>
        <div className="menu-best-run__divider" />
        <div className="menu-best-run__stat">
          <span className="menu-best-run__stat-label">Time</span>
          <span className="menu-best-run__stat-value">{formatTime(best.elapsedMs)}</span>
        </div>
        <div className="menu-best-run__divider" />
        <div className="menu-best-run__stat">
          <span className="menu-best-run__stat-label">Gold</span>
          <span className="menu-best-run__stat-value">{best.goldEarned}g</span>
        </div>
      </div>

      {history.length > 1 && (
        <>
          <p className="menu-best-run__history-label">Recent Runs</p>
          <div className="menu-best-run__history">
            {history.map((run, i) => (
              <div key={run.timestamp} className="menu-best-run__history-row">
                <span className="menu-best-run__history-index">{i + 1}</span>
                <span className="menu-best-run__history-floor">F{run.floor}</span>
                <span className="menu-best-run__history-kills">{run.kills}☠</span>
                <span className="menu-best-run__history-time">{formatTime(run.elapsedMs)}</span>
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
    const t = setTimeout(() => setVisible(true), 80);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className={`menu-root ${visible ? "menu-root--visible" : ""}`}>

      {/* ══════ LEFT PANEL: Stone + Sigil ══════ */}
      <div className="menu-left">
        <div className="menu-stone-bg" />
        <div className="menu-vignette" />
        <StoneCracks />
        <div className="menu-left-content">
          <Sigil />
          <p className="menu-lore">
            "In the age before memory,<br />
            when gods still <em>walked amongst ash</em>,<br />
            a single choice shattered<br />
            <em>the last eternal throne.</em>"
          </p>
        </div>
      </div>

      {/* ══════ VERTICAL DIVIDER ══════ */}
      <div className="menu-vert-divider">
        <div className="menu-vert-gem" />
      </div>

      {/* ══════ RIGHT PANEL: Title + Menu ══════ */}
      <div className="menu-right">

        {/* Corner ornaments */}
        <span className="menu-corner menu-corner--tl"><CornerOrnament /></span>
        <span className="menu-corner menu-corner--tr"><CornerOrnament /></span>
        <span className="menu-corner menu-corner--bl"><CornerOrnament /></span>
        <span className="menu-corner menu-corner--br"><CornerOrnament /></span>

        {/* Title */}
        <div className="menu-title-block">
          <h1 className="menu-title">Infinity<br />Dungeon</h1>
          <p className="menu-subtitle">Chronicles of the Forsaken Age</p>
        </div>

        <HRule />

        {/* Nav buttons */}
        <nav className="menu-nav">
          <MenuButton icon={IconStar}   label="New Quest"          active onClick={onStart} />
          <MenuButton icon={IconClock}  label="Continue Journey"          onClick={onStart} />
          <MenuButton icon={IconScroll} label="Hall of Chronicles"         onClick={() => {}} />
          <MenuButton icon={IconGear}   label="Tome of Settings"           onClick={() => {}} />
          <div className="menu-nav__divider" />
          <MenuButton icon={IconExit}   label="Forsake the Realm"  danger  onClick={() => {}} />
        </nav>

        {/* Best run history */}
        <BestRunPanel />

        {/* Footer */}
        <footer className="menu-footer">
          <p className="menu-footer__quote">"Where heroes are forged in shadow and flame..."</p>
          <p className="menu-footer__version">ALPHA v0.1</p>
        </footer>

      </div>
    </div>
  );
}