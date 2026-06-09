// src/components/Menu.tsx
"use client";

import React, { useEffect, useState } from "react";
import { loadBestRun, loadRunHistory, RunRecord } from "@/engine/GameState";
import "@/styles/menu.css";
import "@/styles/tutorial.css";

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
// ============================================================
function TitleFrame({ width, height }: { width: number; height: number }) {
  const w = width;
  const h = height;
  const c = 18;

  return (
    <svg
      className="menu-title-frame"
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d={`M ${c} 2 L ${w - c} 2 Q ${w - 2} 2 ${w - 2} ${c} L ${w - 2} ${h - c} Q ${w - 2} ${h - 2} ${w - c} ${h - 2} L ${c} ${h - 2} Q 2 ${h - 2} 2 ${h - c} L 2 ${c} Q 2 2 ${c} 2 Z`}
        stroke="#8B6914" strokeWidth="1" opacity="0.7"
      />
      <path
        d={`M ${c + 4} 6 L ${w - c - 4} 6 Q ${w - 6} 6 ${w - 6} ${c + 4} L ${w - 6} ${h - c - 4} Q ${w - 6} ${h - 6} ${w - c - 4} ${h - 6} L ${c + 4} ${h - 6} Q 6 ${h - 6} 6 ${h - c - 4} L 6 ${c + 4} Q 6 6 ${c + 4} 6 Z`}
        stroke="#c0860c" strokeWidth="0.5" opacity="0.4"
      />
      <g opacity="0.9">
        <rect x="8" y="8" width="7" height="7" transform="rotate(45 11.5 11.5)" fill="#8B6914" opacity="0.6" />
        <rect x="9" y="9" width="5" height="5" transform="rotate(45 11.5 11.5)" fill="#f0c040" opacity="0.3" />
        <path d="M 11.5 2 L 11.5 8" stroke="#8B6914" strokeWidth="1" />
        <path d="M 11.5 2 L 9 5 L 11.5 4 L 14 5 Z" fill="#8B6914" opacity="0.7" />
        <path d="M 2 11.5 L 8 11.5" stroke="#8B6914" strokeWidth="1" />
        <path d="M 2 11.5 L 5 9 L 4 11.5 L 5 14 Z" fill="#8B6914" opacity="0.7" />
        <path d="M 8 8 Q 14 8 14 14" stroke="#c0860c" strokeWidth="0.7" fill="none" opacity="0.5" />
      </g>
      <g opacity="0.9">
        <rect x={w - 15} y="8" width="7" height="7" transform={`rotate(45 ${w - 11.5} 11.5)`} fill="#8B6914" opacity="0.6" />
        <rect x={w - 14} y="9" width="5" height="5" transform={`rotate(45 ${w - 11.5} 11.5)`} fill="#f0c040" opacity="0.3" />
        <path d={`M ${w - 11.5} 2 L ${w - 11.5} 8`} stroke="#8B6914" strokeWidth="1" />
        <path d={`M ${w - 11.5} 2 L ${w - 14} 5 L ${w - 11.5} 4 L ${w - 9} 5 Z`} fill="#8B6914" opacity="0.7" />
        <path d={`M ${w - 2} 11.5 L ${w - 8} 11.5`} stroke="#8B6914" strokeWidth="1" />
        <path d={`M ${w - 2} 11.5 L ${w - 5} 9 L ${w - 4} 11.5 L ${w - 5} 14 Z`} fill="#8B6914" opacity="0.7" />
        <path d={`M ${w - 8} 8 Q ${w - 14} 8 ${w - 14} 14`} stroke="#c0860c" strokeWidth="0.7" fill="none" opacity="0.5" />
      </g>
      <g opacity="0.9">
        <rect x="8" y={h - 15} width="7" height="7" transform={`rotate(45 11.5 ${h - 11.5})`} fill="#8B6914" opacity="0.6" />
        <rect x="9" y={h - 14} width="5" height="5" transform={`rotate(45 11.5 ${h - 11.5})`} fill="#f0c040" opacity="0.3" />
        <path d={`M 11.5 ${h - 2} L 11.5 ${h - 8}`} stroke="#8B6914" strokeWidth="1" />
        <path d={`M 11.5 ${h - 2} L 9 ${h - 5} L 11.5 ${h - 4} L 14 ${h - 5} Z`} fill="#8B6914" opacity="0.7" />
        <path d={`M 2 ${h - 11.5} L 8 ${h - 11.5}`} stroke="#8B6914" strokeWidth="1" />
        <path d={`M 2 ${h - 11.5} L 5 ${h - 9} L 4 ${h - 11.5} L 5 ${h - 14} Z`} fill="#8B6914" opacity="0.7" />
        <path d={`M 8 ${h - 8} Q 14 ${h - 8} 14 ${h - 14}`} stroke="#c0860c" strokeWidth="0.7" fill="none" opacity="0.5" />
      </g>
      <g opacity="0.9">
        <rect x={w - 15} y={h - 15} width="7" height="7" transform={`rotate(45 ${w - 11.5} ${h - 11.5})`} fill="#8B6914" opacity="0.6" />
        <rect x={w - 14} y={h - 14} width="5" height="5" transform={`rotate(45 ${w - 11.5} ${h - 11.5})`} fill="#f0c040" opacity="0.3" />
        <path d={`M ${w - 11.5} ${h - 2} L ${w - 11.5} ${h - 8}`} stroke="#8B6914" strokeWidth="1" />
        <path d={`M ${w - 11.5} ${h - 2} L ${w - 14} ${h - 5} L ${w - 11.5} ${h - 4} L ${w - 9} ${h - 5} Z`} fill="#8B6914" opacity="0.7" />
        <path d={`M ${w - 2} ${h - 11.5} L ${w - 8} ${h - 11.5}`} stroke="#8B6914" strokeWidth="1" />
        <path d={`M ${w - 2} ${h - 11.5} L ${w - 5} ${h - 9} L ${w - 4} ${h - 11.5} L ${w - 5} ${h - 14} Z`} fill="#8B6914" opacity="0.7" />
        <path d={`M ${w - 8} ${h - 8} Q ${w - 14} ${h - 8} ${w - 14} ${h - 14}`} stroke="#c0860c" strokeWidth="0.7" fill="none" opacity="0.5" />
      </g>
      <line x1={c} y1="2" x2={w / 2 - 30} y2="2" stroke="#8B6914" strokeWidth="1.5" opacity="0.8" />
      <line x1={w / 2 + 30} y1="2" x2={w - c} y2="2" stroke="#8B6914" strokeWidth="1.5" opacity="0.8" />
      <rect x={w / 2 - 4} y={-2} width="8" height="8" transform={`rotate(45 ${w / 2} 2)`} fill="#8B6914" opacity="0.8" />
      <rect x={w / 2 - 2.5} y={-0.5} width="5" height="5" transform={`rotate(45 ${w / 2} 2)`} fill="#f0c040" opacity="0.5" />
      <line x1={c} y1={h - 2} x2={w / 2 - 30} y2={h - 2} stroke="#8B6914" strokeWidth="1.5" opacity="0.8" />
      <line x1={w / 2 + 30} y1={h - 2} x2={w - c} y2={h - 2} stroke="#8B6914" strokeWidth="1.5" opacity="0.8" />
      <rect x={w / 2 - 4} y={h - 6} width="8" height="8" transform={`rotate(45 ${w / 2} ${h - 2})`} fill="#8B6914" opacity="0.8" />
      <rect x={w / 2 - 2.5} y={h - 4.5} width="5" height="5" transform={`rotate(45 ${w / 2} ${h - 2})`} fill="#f0c040" opacity="0.5" />
      <line x1="2" y1={h / 2 - 10} x2="2" y2={h / 2 + 10} stroke="#8B6914" strokeWidth="2" opacity="0.6" />
      <line x1={w - 2} y1={h / 2 - 10} x2={w - 2} y2={h / 2 + 10} stroke="#8B6914" strokeWidth="2" opacity="0.6" />
      <circle cx="2" cy={h / 2} r="2.5" fill="#8B6914" opacity="0.7" />
      <circle cx={w - 2} cy={h / 2} r="2.5" fill="#8B6914" opacity="0.7" />
    </svg>
  );
}

// ============================================================
// [🧱 BLOCK: Button Corner Brackets]
// ============================================================
function ButtonFrame({ width, height, color = "#8B6914" }: { width: number; height: number; color?: string }) {
  const s = 10;
  const g = 3;
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
      <path d={`M ${g} ${g + s} L ${g} ${g} L ${g + s} ${g}`} stroke={color} strokeWidth="1.5" />
      <circle cx={g} cy={g} r="1.5" fill={color} opacity="0.6" />
      <path d={`M ${width - g} ${g + s} L ${width - g} ${g} L ${width - g - s} ${g}`} stroke={color} strokeWidth="1.5" />
      <circle cx={width - g} cy={g} r="1.5" fill={color} opacity="0.6" />
      <path d={`M ${g} ${height - g - s} L ${g} ${height - g} L ${g + s} ${height - g}`} stroke={color} strokeWidth="1.5" />
      <circle cx={g} cy={height - g} r="1.5" fill={color} opacity="0.6" />
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
// [🧱 BLOCK: Gem Divider]
// ============================================================
function GemDivider() {
  return (
    <div className="tutorial-divider">
      <div className="tutorial-divider-gem" />
    </div>
  );
}

// ============================================================
// [🧱 BLOCK: Tutorial Tab IDs]
// ============================================================
type TutorialTab =
  | 'basics'
  | 'combat'
  | 'consumables'
  | 'gear'
  | 'enemies'
  | 'tips';

const TABS: { id: TutorialTab; label: string }[] = [
  { id: 'basics',      label: '📖 The Basics'    },
  { id: 'combat',      label: '⚔️ Combat'        },
  { id: 'consumables', label: '🧪 Consumables'   },
  { id: 'gear',        label: '🛡 Gear & Sets'   },
  { id: 'enemies',     label: '👾 Enemies'       },
  { id: 'tips',        label: '💡 Survival Tips' },
];

// ============================================================
// [🧱 BLOCK: Tutorial Tab — Basics]
// ============================================================
function TabBasics() {
  return (
    <div className="tutorial-section">
      {/* Floor progression */}
      <div className="tutorial-card" style={{ gridColumn: '1 / -1' }}>
        <div className="tutorial-card__heading">
          <span className="tutorial-card__heading-icon">🗺</span>
          Floor Progression
        </div>
        <div className="tutorial-room-flow">
          {[
            { num: '1', label: 'Horde', cls: '' },
            { num: '→', label: '', cls: 'arrow' },
            { num: '2', label: 'Horde', cls: '' },
            { num: '→', label: '', cls: 'arrow' },
            { num: '3', label: 'Elite', cls: '--elite' },
            { num: '→', label: '', cls: 'arrow' },
            { num: '4', label: 'Boss', cls: '--boss' },
          ].map((item, i) =>
            item.cls === 'arrow' ? (
              <div key={i} className="tutorial-room-arrow">▶</div>
            ) : (
              <div key={i} className="tutorial-room-node">
                <div className={`tutorial-room-node__box${item.cls}`}>
                  <div className="tutorial-room-node__num">{item.num}</div>
                  <div className="tutorial-room-node__label">{item.label}</div>
                </div>
              </div>
            )
          )}
        </div>
        <p style={{ fontFamily: "'IM Fell English', serif", fontStyle: 'italic', fontSize: 10, color: '#6a5020', lineHeight: 1.5 }}>
          Kill enough enemies in each room to open the gate. Press <strong style={{ fontFamily: "'Cinzel', serif", fontSize: 9, color: '#c0860c' }}>F</strong> at the gate or the Shop NPC to advance. Defeat the boss to unlock descent to the next floor.
        </p>
      </div>

      {/* Movement */}
      <div className="tutorial-card">
        <div className="tutorial-card__heading">
          <span className="tutorial-card__heading-icon">🎮</span>
          Movement
        </div>
        <div className="tutorial-kv">
          <div className="tutorial-kv__row">
            <span className="tutorial-kv__key">W A S D</span>
            <span className="tutorial-kv__val">Move in any direction</span>
          </div>
          <div className="tutorial-kv__row">
            <span className="tutorial-kv__key">C</span>
            <span className="tutorial-kv__val">Dash — grants invincibility frames. Costs stamina.</span>
          </div>
          <div className="tutorial-kv__row">
            <span className="tutorial-kv__key">F</span>
            <span className="tutorial-kv__val">Interact with door or Shop NPC when nearby</span>
          </div>
          <div className="tutorial-kv__row">
            <span className="tutorial-kv__key">I (hold)</span>
            <span className="tutorial-kv__val">Open Inventory — manage gear, hotbar & consumables</span>
          </div>
          <div className="tutorial-kv__row">
            <span className="tutorial-kv__key">ESC</span>
            <span className="tutorial-kv__val">Pause / Resume</span>
          </div>
        </div>
      </div>

      {/* Resources */}
      <div className="tutorial-card">
        <div className="tutorial-card__heading">
          <span className="tutorial-card__heading-icon">❤️</span>
          Resources
        </div>
        <div className="tutorial-kv">
          <div className="tutorial-kv__row">
            <span className="tutorial-kv__key" style={{ color: '#4ade80', borderColor: '#166534' }}>HP</span>
            <span className="tutorial-kv__val">Your life. Reaches zero = run ends. Restored by potions, kills (with charms), or the Merchant.</span>
          </div>
          <div className="tutorial-kv__row">
            <span className="tutorial-kv__key" style={{ color: '#fbbf24', borderColor: '#78350f' }}>Stamina</span>
            <span className="tutorial-kv__val">Powers attacks, dash, and blocking. Regenerates automatically. Runs out = no dashing or heavies.</span>
          </div>
          <div className="tutorial-kv__row">
            <span className="tutorial-kv__key" style={{ color: '#f0c040', borderColor: '#6a4c10' }}>Gold</span>
            <span className="tutorial-kv__val">Currency. Dropped by enemies, collected on contact. Spent at the Merchant between rooms.</span>
          </div>
        </div>
      </div>

      {/* Kill threshold */}
      <div className="tutorial-card" style={{ gridColumn: '1 / -1' }}>
        <div className="tutorial-card__heading">
          <span className="tutorial-card__heading-icon">💀</span>
          Kill Threshold & Farming
        </div>
        <p style={{ fontFamily: "'IM Fell English', serif", fontStyle: 'italic', fontSize: 10, color: '#6a5020', lineHeight: 1.5 }}>
          Each room has a kill threshold shown in the HUD ring. Once met, the gate opens and <strong style={{ fontFamily: "'Cinzel', serif", fontSize: 9, color: '#c0860c' }}>Tank batches</strong> begin spawning — 5 tanks per wave, up to 10 waves, each stronger than the last. Gold drops decrease the longer you farm, so push forward rather than stalling.
        </p>
      </div>
    </div>
  );
}

// ============================================================
// [🧱 BLOCK: Tutorial Tab — Combat]
// ============================================================
function TabCombat() {
  return (
    <div className="tutorial-section">
      <div className="tutorial-card">
        <div className="tutorial-card__heading">
          <span className="tutorial-card__heading-icon">⚔️</span>
          Attacks — J & K
        </div>
        <div className="tutorial-kv">
          <div className="tutorial-kv__row">
            <span className="tutorial-kv__key">J tap</span>
            <span className="tutorial-kv__val">Light attack — quick, low cost. Lunges forward slightly.</span>
          </div>
          <div className="tutorial-kv__row">
            <span className="tutorial-kv__key">J hold</span>
            <span className="tutorial-kv__val">Charged light — 2.5× damage, wider arc. Slows movement while charging.</span>
          </div>
          <div className="tutorial-kv__row">
            <span className="tutorial-kv__key">K tap</span>
            <span className="tutorial-kv__val">Heavy attack — slow, powerful, halts movement. High cooldown.</span>
          </div>
          <div className="tutorial-kv__row">
            <span className="tutorial-kv__key">K hold</span>
            <span className="tutorial-kv__val">Charged heavy — 2× damage, large area. Cannot move while charging.</span>
          </div>
        </div>
      </div>

      <div className="tutorial-card">
        <div className="tutorial-card__heading">
          <span className="tutorial-card__heading-icon">🛡</span>
          Block & Parry — L
        </div>
        <div className="tutorial-kv">
          <div className="tutorial-kv__row">
            <span className="tutorial-kv__key">L tap</span>
            <span className="tutorial-kv__val">Parry — opens a brief window. If an attack lands in the window, the enemy is stunned and takes 1.5× damage.</span>
          </div>
          <div className="tutorial-kv__row">
            <span className="tutorial-kv__key">L hold</span>
            <span className="tutorial-kv__val">Block — absorbs hits for stamina cost. Breaks if stamina is drained.</span>
          </div>
        </div>
      </div>

      <div className="tutorial-card">
        <div className="tutorial-card__heading">
          <span className="tutorial-card__heading-icon">⚔️</span>
          Weapon Types
        </div>
        <div className="tutorial-tag-list">
          <div className="tutorial-tag-row">
            <span className="tutorial-tag-row__icon">⚔️</span>
            <div className="tutorial-tag-row__info">
              <div className="tutorial-tag-row__name">Sword</div>
              <div className="tutorial-tag-row__desc">Forward arc light / wide 180° heavy. Passive: <em>Riposte</em> — parrying opens a 3× damage window.</div>
            </div>
          </div>
          <div className="tutorial-tag-row">
            <span className="tutorial-tag-row__icon">🪓</span>
            <div className="tutorial-tag-row__info">
              <div className="tutorial-tag-row__name">Axe</div>
              <div className="tutorial-tag-row__desc">Close circle light / large circle heavy. Passive: <em>Rend</em> — marks enemies for +8 bonus on next hit.</div>
            </div>
          </div>
          <div className="tutorial-tag-row">
            <span className="tutorial-tag-row__icon">🔱</span>
            <div className="tutorial-tag-row__info">
              <div className="tutorial-tag-row__name">Spear</div>
              <div className="tutorial-tag-row__desc">Long rectangle hitbox. Passive: <em>Momentum</em> — dash then attack for 2× damage.</div>
            </div>
          </div>
        </div>
      </div>

      <div className="tutorial-card">
        <div className="tutorial-card__heading">
          <span className="tutorial-card__heading-icon">📊</span>
          Stamina Costs
        </div>
        <div className="tutorial-kv">
          <div className="tutorial-kv__row">
            <span className="tutorial-kv__key">Dash</span>
            <span className="tutorial-kv__val">30 stamina (reduced by items/sets)</span>
          </div>
          <div className="tutorial-kv__row">
            <span className="tutorial-kv__key">Light</span>
            <span className="tutorial-kv__val">8–12 stamina depending on weapon</span>
          </div>
          <div className="tutorial-kv__row">
            <span className="tutorial-kv__key">Heavy</span>
            <span className="tutorial-kv__val">32–42 stamina depending on weapon</span>
          </div>
          <div className="tutorial-kv__row">
            <span className="tutorial-kv__key">Block</span>
            <span className="tutorial-kv__val">20 on entry + drain per second + 12 per blocked hit</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// [🧱 BLOCK: Tutorial Tab — Consumables]
// ============================================================
function TabConsumables() {
  return (
    <div className="tutorial-section">
      {/* Hotbar */}
      <div className="tutorial-card" style={{ gridColumn: '1 / -1' }}>
        <div className="tutorial-card__heading">
          <span className="tutorial-card__heading-icon">🎒</span>
          Hotbar — Keys 1, 2, 3, 4
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
          {[
            { slot: '1', cd: '3s' },
            { slot: '2', cd: '4.5s' },
            { slot: '3', cd: '6s' },
            { slot: '4', cd: '7s' },
          ].map((s) => (
            <div key={s.slot} style={{ flex: 1, background: 'rgba(0,0,0,0.4)', border: '1px solid #3a2808', padding: '8px 6px', textAlign: 'center' }}>
              <div style={{ fontFamily: "'Cinzel Decorative', serif", fontSize: 16, color: '#8B6914', lineHeight: 1 }}>{s.slot}</div>
              <div style={{ fontFamily: "'Cinzel', serif", fontSize: 8, color: '#5a4010', marginTop: 3, letterSpacing: '0.1em' }}>CD {s.cd}</div>
            </div>
          ))}
        </div>
        <p style={{ fontFamily: "'IM Fell English', serif", fontStyle: 'italic', fontSize: 10, color: '#6a5020', lineHeight: 1.5 }}>
          Open Inventory (I) and drag items from the Provisions bag onto hotbar slots. Each slot has its own cooldown. Re-using a buff potion while it is still active <strong style={{ color: '#c0860c', fontFamily: "'Cinzel', serif", fontSize: 9 }}>extends the duration</strong> instead of resetting it.
        </p>
      </div>

      {/* Potions */}
      <div className="tutorial-card">
        <div className="tutorial-card__heading">
          <span className="tutorial-card__heading-icon">🧪</span>
          Potions
        </div>
        <div className="tutorial-tag-list">
          {[
            { icon: '🧪', name: 'Health Potion',  desc: 'Instantly restores HP. Upgrades increase heal amount (40→130 HP at Lv5).' },
            { icon: '🔥', name: 'Wrath Potion',   desc: 'Bonus attack damage + speed for a duration. Re-use extends buff.' },
            { icon: '🛡️', name: 'Iron Potion',    desc: 'Reduces all incoming damage for a duration. Stacks with armor DR.' },
            { icon: '👻', name: 'Phantom Potion', desc: 'Turns invisible — enemies lose aggro entirely. Re-use extends.' },
          ].map((p) => (
            <div key={p.name} className="tutorial-tag-row">
              <span className="tutorial-tag-row__icon">{p.icon}</span>
              <div className="tutorial-tag-row__info">
                <div className="tutorial-tag-row__name">{p.name}</div>
                <div className="tutorial-tag-row__desc">{p.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Scrolls */}
      <div className="tutorial-card">
        <div className="tutorial-card__heading">
          <span className="tutorial-card__heading-icon">📜</span>
          Scrolls
        </div>
        <div className="tutorial-tag-list">
          {[
            { icon: '📜', name: 'Fireball',   desc: 'Fires a fireball that explodes on impact, dealing AoE damage.' },
            { icon: '❄️', name: 'Frost',       desc: 'Cone blast that freezes enemies in front of you.' },
            { icon: '⚡', name: 'Lightning',  desc: 'Bolt that chains between nearby enemies.' },
            { icon: '💨', name: 'Blink',       desc: 'Teleports you forward in your facing direction instantly.' },
            { icon: '🔮', name: 'Ward',        desc: 'Absorbs a set number of incoming hits for a duration.' },
            { icon: '🌀', name: 'Void',        desc: 'Pulls nearby enemies toward a point ahead of you.' },
          ].map((s) => (
            <div key={s.name} className="tutorial-tag-row">
              <span className="tutorial-tag-row__icon">{s.icon}</span>
              <div className="tutorial-tag-row__info">
                <div className="tutorial-tag-row__name">{s.name}</div>
                <div className="tutorial-tag-row__desc">{s.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Upgrading */}
      <div className="tutorial-card" style={{ gridColumn: '1 / -1' }}>
        <div className="tutorial-card__heading">
          <span className="tutorial-card__heading-icon">⬆️</span>
          Upgrading Consumables (Lv1 → Lv5)
        </div>
        <p style={{ fontFamily: "'IM Fell English', serif", fontStyle: 'italic', fontSize: 10, color: '#6a5020', lineHeight: 1.5 }}>
          At The Merchant, each consumable has an <strong style={{ color: '#c0860c', fontFamily: "'Cinzel', serif", fontSize: 9 }}>Upgrade</strong> row below the buy button. Upgrading significantly increases power — a Lv5 Health Potion heals 130 HP vs 40 at Lv1. Upgrade costs scale per tier. Levels persist across all rooms in a run.
        </p>
      </div>
    </div>
  );
}

// ============================================================
// [🧱 BLOCK: Tutorial Tab — Gear & Sets]
// ============================================================
function TabGear() {
  return (
    <div className="tutorial-section">
      {/* Armor slots */}
      <div className="tutorial-card">
        <div className="tutorial-card__heading">
          <span className="tutorial-card__heading-icon">🪖</span>
          Armor Slots & Stats
        </div>
        <div className="tutorial-kv">
          {[
            { key: 'Helmet',   val: '+Max HP' },
            { key: 'Armor',    val: '+Damage Reduction' },
            { key: 'Leggings', val: '+Move Speed' },
            { key: 'Gloves',   val: '+Attack Damage' },
            { key: 'Boots',    val: '+Move Speed (stacks)' },
          ].map((r) => (
            <div key={r.key} className="tutorial-kv__row">
              <span className="tutorial-kv__key">{r.key}</span>
              <span className="tutorial-kv__val">{r.val}</span>
            </div>
          ))}
        </div>
        <p style={{ fontFamily: "'IM Fell English', serif", fontStyle: 'italic', fontSize: 9, color: '#5a4010', lineHeight: 1.4, marginTop: 4 }}>
          Armor drops from enemies, bosses, and the Merchant's Wares. Stats scale with floor.
        </p>
      </div>

      {/* Attributes */}
      <div className="tutorial-card">
        <div className="tutorial-card__heading">
          <span className="tutorial-card__heading-icon">📊</span>
          Attributes (Shop)
        </div>
        <div className="tutorial-stat-grid">
          {[
            { icon: '⚔️', label: 'STR', val: '+3 attack per level' },
            { icon: '❤️', label: 'VIT', val: '+10 max HP per level' },
            { icon: '💨', label: 'AGI', val: '+0.3 speed per level' },
            { icon: '⚡', label: 'END', val: '+5 max stamina per level' },
          ].map((s) => (
            <div key={s.label} className="tutorial-stat-pill">
              <span className="tutorial-stat-pill__icon">{s.icon}</span>
              <div className="tutorial-stat-pill__info">
                <div className="tutorial-stat-pill__label">{s.label}</div>
                <div className="tutorial-stat-pill__value">{s.val}</div>
              </div>
            </div>
          ))}
        </div>
        <p style={{ fontFamily: "'IM Fell English', serif", fontStyle: 'italic', fontSize: 9, color: '#5a4010', lineHeight: 1.4, marginTop: 6 }}>
          Cap rises by 3 each floor. Costs increase at levels 3 and 6.
        </p>
      </div>

      {/* Set bonuses — full width */}
      <div className="tutorial-card" style={{ gridColumn: '1 / -1' }}>
        <div className="tutorial-card__heading">
          <span className="tutorial-card__heading-icon">✨</span>
          Armor Set Bonuses
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          {[
            {
              name: '🛡 Iron Warden',
              color: '#94a3b8',
              tiers: [
                { pieces: '2pc', desc: '+15 Max HP' },
                { pieces: '4pc', desc: '+20% Damage Reduction' },
                { pieces: '5pc', desc: 'On hit: 30% chance reflect 10 dmg' },
              ],
            },
            {
              name: '🥷 Shadow Walker',
              color: '#7dd3fc',
              tiers: [
                { pieces: '2pc', desc: 'Dash costs −10 stamina' },
                { pieces: '4pc', desc: '+1.5 Move Speed' },
                { pieces: '5pc', desc: 'Dash grants 1s invisibility + freeze' },
              ],
            },
            {
              name: '🩸 Blood Reaper',
              color: '#f87171',
              tiers: [
                { pieces: '2pc', desc: '+8 Attack Damage' },
                { pieces: '4pc', desc: 'Kills heal 8 HP' },
                { pieces: '5pc', desc: 'Every 5th kill: 120px shockwave' },
              ],
            },
          ].map((set) => (
            <div key={set.name} className="tutorial-set">
              <div className="tutorial-set__name" style={{ color: set.color }}>{set.name}</div>
              {set.tiers.map((t) => (
                <div key={t.pieces} className="tutorial-set__tier">
                  <span className="tutorial-set__tier-badge tutorial-set__tier-badge--active" style={{ borderColor: set.color, color: set.color }}>{t.pieces}</span>
                  <span className="tutorial-set__tier-desc">{t.desc}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// [🧱 BLOCK: Tutorial Tab — Enemies]
// ============================================================
function TabEnemies() {
  return (
    <div className="tutorial-section">
      <div className="tutorial-card">
        <div className="tutorial-card__heading">
          <span className="tutorial-card__heading-icon">👾</span>
          Horde Enemies
        </div>
        <div className="tutorial-tag-list">
          {[
            { icon: '🟣', name: 'Grunt',   badge: 'Common', badgeColor: '#a855f7', desc: 'Charges and melees. Floor 3+ can dash-lunge toward you.' },
            { icon: '🟡', name: 'Shooter', badge: 'Ranged', badgeColor: '#f59e0b', desc: 'Keeps distance and fires projectiles. Floor 2+ fires 3-shot spreads.' },
            { icon: '🔷', name: 'Tank',    badge: 'Armored', badgeColor: '#94a3b8', desc: 'Front-shielded. Attack from the sides/back for full damage. Heavy attacks pierce shield better.' },
            { icon: '🔵', name: 'Dasher',  badge: 'Fast',   badgeColor: '#06b6d4', desc: 'Rapid dash attacker. Floor 3+ dashes twice per combo.' },
            { icon: '🟠', name: 'Bomber',  badge: 'Danger', badgeColor: '#f97316', desc: 'Arms a fuse when close, then explodes. Kill it before the fuse ring fills up!' },
          ].map((e) => (
            <div key={e.name} className="tutorial-tag-row">
              <span className="tutorial-tag-row__icon">{e.icon}</span>
              <div className="tutorial-tag-row__info">
                <div className="tutorial-tag-row__name">{e.name}</div>
                <div className="tutorial-tag-row__desc">{e.desc}</div>
              </div>
              <span className="tutorial-tag-row__badge" style={{ color: e.badgeColor, borderColor: e.badgeColor }}>{e.badge}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="tutorial-card">
        <div className="tutorial-card__heading">
          <span className="tutorial-card__heading-icon">✨</span>
          Enemy Variants
        </div>
        <div className="tutorial-tag-list">
          {[
            { icon: '🔴', name: 'Tough',        desc: '+40% max HP' },
            { icon: '⚡', name: 'Swift',         desc: '+30% movement speed' },
            { icon: '🔥', name: 'Berserker',    desc: '+25% outgoing damage' },
            { icon: '🛡', name: 'Armored',       desc: '30% damage reduction' },
            { icon: '💥', name: 'Volatile',     desc: 'Explodes on death — move away!' },
            { icon: '💚', name: 'Regenerating', desc: 'Slowly recovers HP over time' },
          ].map((v) => (
            <div key={v.name} className="tutorial-tag-row">
              <span className="tutorial-tag-row__icon">{v.icon}</span>
              <div className="tutorial-tag-row__info">
                <div className="tutorial-tag-row__name">{v.name}</div>
                <div className="tutorial-tag-row__desc">{v.desc}</div>
              </div>
            </div>
          ))}
        </div>
        <p style={{ fontFamily: "'IM Fell English', serif", fontStyle: 'italic', fontSize: 9, color: '#5a4010', lineHeight: 1.4, marginTop: 4 }}>
          Variant enemies drop 1.5× gold per variant. Floor 4+ enemies can have 2 variants.
        </p>
      </div>

      {/* Bosses */}
      <div className="tutorial-card" style={{ gridColumn: '1 / -1' }}>
        <div className="tutorial-card__heading">
          <span className="tutorial-card__heading-icon">💀</span>
          Bosses — All enrage at 60% HP
        </div>
        <div className="tutorial-tag-list">
          {[
            { icon: '🔴', name: 'Brute',    floor: 'Floor 1', desc: 'Charges, slams with AoE, and shoots spread projectiles. Enraging increases speed and damage.' },
            { icon: '🟣', name: 'Phantom',  floor: 'Floor 2', desc: 'Teleports around the arena, fires bullet rings and aimed volleys. Intangible while blinking.' },
            { icon: '⚫', name: 'Colossus', floor: 'Floor 3', desc: 'Armored until 60% HP — heavy attacks pierce better. Stomps with chained AoE.' },
            { icon: '🟢', name: 'Mage',     floor: 'Floor 4+', desc: 'Blinks, fires homing projectiles, and summons illusion clones that fire back.' },
            { icon: '🔵', name: 'Shade',    floor: 'Floor 4+', desc: 'Extreme speed, approach dashes, and lunge combos. The fastest boss in the dungeon.' },
          ].map((b) => (
            <div key={b.name} className="tutorial-tag-row">
              <span className="tutorial-tag-row__icon">{b.icon}</span>
              <div className="tutorial-tag-row__info">
                <div className="tutorial-tag-row__name">{b.name}</div>
                <div className="tutorial-tag-row__desc">{b.desc}</div>
              </div>
              <span className="tutorial-tag-row__badge" style={{ color: '#8B6914', borderColor: '#3a2808' }}>{b.floor}</span>
            </div>
          ))}
        </div>
        <p style={{ fontFamily: "'IM Fell English', serif", fontStyle: 'italic', fontSize: 9, color: '#5a4010', lineHeight: 1.4, marginTop: 6 }}>
          Parrying the boss staggers it — follow up immediately with a charged heavy for massive burst damage.
        </p>
      </div>
    </div>
  );
}

// ============================================================
// [🧱 BLOCK: Tutorial Tab — Survival Tips]
// ============================================================
function TabTips() {
  const tips = [
    { text: <><strong>Keep moving.</strong> Standing still will get you killed by ranged enemies and bombers. Dodge sideways through projectile spreads.</> },
    { text: <><strong>Dash through attacks.</strong> Invincibility frames during dash let you pass safely through enemy strikes and even boss slams.</> },
    { text: <><strong>Parry for big damage.</strong> A parried boss staggers — follow up with a charged heavy immediately for a devastating burst window.</> },
    { text: <><strong>Upgrade consumables early.</strong> A Lv5 Health Potion heals 130 HP vs 40 at Lv1. Upgrading is often better than buying more stacks.</> },
    { text: <><strong>Don't ignore armor.</strong> Set bonuses are extremely powerful. Even a 2-piece Iron Warden is worth building toward early on.</> },
    { text: <><strong>Bombers are urgent.</strong> The moment you see the fuse ring appear, kill the Bomber immediately or dash far away before it explodes.</> },
    { text: <><strong>Ward Scroll is a safety net.</strong> Assign it to a slow-cooldown slot before boss fights as emergency damage absorption.</> },
    { text: <><strong>Stack damage reduction.</strong> Iron Potion + Armor piece + Iron Warden set bonuses multiply together — you can become nearly untouchable.</> },
  ];

  return (
    <div className="tutorial-section tutorial-section--single">
      <div className="tutorial-tips">
        {tips.map((tip, i) => (
          <div key={i} className="tutorial-tip">
            <div className="tutorial-tip__num">{i + 1}</div>
            <div className="tutorial-tip__text">{tip.text}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// [🧱 BLOCK: Tutorial Modal]
// ============================================================
function TutorialModal({ onClose }: { onClose: () => void }) {
  const [visible,    setVisible]    = useState(false);
  const [activeTab,  setActiveTab]  = useState<TutorialTab>('basics');

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 40);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div className="tutorial-backdrop">
      <div className={`tutorial-panel ${visible ? 'tutorial-panel--visible' : ''}`}>
        <div className="tutorial-inner">

          {/* Header */}
          <div className="tutorial-header">
            <div className="tutorial-header__title-block">
              <span className="tutorial-header__eyebrow">Dungeon Codex</span>
              <span className="tutorial-header__title">How to Play</span>
            </div>
            <button className="tutorial-close-btn" onClick={onClose}>✕</button>
          </div>

          {/* Tabs */}
          <div className="tutorial-tabs">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                className={`tutorial-tab ${activeTab === tab.id ? 'tutorial-tab--active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="tutorial-content">
            {activeTab === 'basics'      && <TabBasics />}
            {activeTab === 'combat'      && <TabCombat />}
            {activeTab === 'consumables' && <TabConsumables />}
            {activeTab === 'gear'        && <TabGear />}
            {activeTab === 'enemies'     && <TabEnemies />}
            {activeTab === 'tips'        && <TabTips />}
          </div>

          {/* Footer */}
          <div className="tutorial-footer">
            <span className="tutorial-footer__hint">"Knowledge is the sharpest blade in the dungeon."</span>
            <button className="tutorial-footer__close" onClick={onClose}>
              ▶ Begin the Raid
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}

// ============================================================
// [🧱 BLOCK: Menu Component]
// ============================================================
export default function Menu({ onStart }: MenuProps) {
  const [visible,      setVisible]      = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 60);
    return () => clearTimeout(t);
  }, []);

  return (
    <>
      <div className={`menu-root ${visible ? "menu-root--visible" : ""}`}>

        {/* Background image */}
        <div className="menu-bg" />

        {/* Dark fog vignette */}
        <div className="menu-fog" />

        {/* Center column */}
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

            {/* HOW TO PLAY */}
            <div className="menu-btn-wrap">
              <ButtonFrame width={300} height={44} color="#3a2808" />
              <button
                className="menu-btn menu-btn--howtoplay"
                onClick={() => setShowTutorial(true)}
              >
                HOW TO PLAY
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

        {/* Version watermark */}
        <p className="menu-version">ALPHA v0.1</p>

      </div>

      {/* Tutorial Modal — rendered outside .menu-root so z-index is clean */}
      {showTutorial && (
        <TutorialModal onClose={() => setShowTutorial(false)} />
      )}
    </>
  );
}