// src/components/Inventory.tsx
"use client";

import React, { useState, useEffect } from "react";
import { PlayerStats }   from "@/engine/PlayerStats";
import { Player }        from "@/engine/Player";
import { WeaponItem }    from "@/engine/items/types";
import { getWeaponPassive } from "@/engine/WeaponPassiveRegistry";
import { MAX_BOON_LEVEL, getBoonById } from "@/engine/BoonRegistry";
import { BOON_SLOT_COUNT } from "@/engine/PlayerBoons";
import { getSkillDef, SKILL_COOLDOWN_MS } from "@/engine/WeaponSkillRegistry";
import "@/styles/inventory.css";

// ============================================================
// [🧱 BLOCK: Props]
// [Phase 2] Weapon acquisition is Shop-only — no ground pickup.
// [Phase 3] playerConsumables removed — potions/scrolls became
// weapon-bound Q/E skills, no bag/hotbar to manage anymore.
// ============================================================
interface InventoryProps {
  playerStats:  PlayerStats;
  player:       Player;
  gold:         number;
  onGoldChange: (newGold: number) => void;
  onClose:      () => void;
}

// ============================================================
// [🧱 BLOCK: Drag Payloads — Boons only]
// ============================================================
type BoonDragPayload = { slotIndex: number };

const BOON_DRAG_KEY = 'boonDrag';

// ============================================================
// [🧱 BLOCK: Attributes Panel]
// ============================================================
function AttributesPanel({ playerStats, player }: {
  playerStats: PlayerStats;
  player:      Player;
}) {
  const cap        = 10;
  const totalAtk   = playerStats.atkBonus;
  const totalHp    = player.maxHp;
  const totalSpd   = player.maxSpeed;
  const totalSta   = player.maxStamina;
  const strContrib = playerStats.str * 3;
  const vitContrib = playerStats.vit * 10;
  const agiContrib = (playerStats.agi * 0.3).toFixed(1);
  const endContrib = playerStats.end * 5;

  const rows = [
    { icon: '⚔️', key: 'STR', level: playerStats.str, total: `${totalAtk} ATK`, bonus: strContrib > 0 ? `+${strContrib} lvl` : 'base' },
    { icon: '❤️', key: 'VIT', level: playerStats.vit, total: `${totalHp} HP`,   bonus: vitContrib > 0 ? `+${vitContrib} lvl` : 'base' },
    { icon: '💨', key: 'AGI', level: playerStats.agi, total: `${totalSpd.toFixed(1)} SPD`, bonus: parseFloat(agiContrib) > 0 ? `+${agiContrib} lvl` : 'base' },
    { icon: '⚡', key: 'END', level: playerStats.end, total: `${totalSta} STA`, bonus: endContrib > 0 ? `+${endContrib} lvl` : 'base' },
  ];

  return (
    <table className="inv-stat-table">
      <tbody>
        {rows.map((row) => (
          <tr key={row.key}>
            <td className="inv-stat-table__icon">{row.icon}</td>
            <td className="inv-stat-table__key">{row.key}</td>
            <td className="inv-stat-table__lvl">{row.level}</td>
            <td className="inv-stat-table__bar">
              <div className="inv-stat-bar-bg">
                <div className="inv-stat-bar-fill" style={{ width: `${(row.level / cap) * 100}%` }} />
              </div>
            </td>
            <td className="inv-stat-table__total">{row.total}</td>
            <td className="inv-stat-table__bonus">{row.bonus}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ============================================================
// [🧱 BLOCK: Weapon Slot Card]
// [Phase 2] Read-only — informational display only. No Sell
// button, no swap interaction. All weapon economy (buy, sell)
// lives in the Shop; this card just shows what's equipped.
// ============================================================
function WeaponSlotCard({ item }: { item: WeaponItem | null }) {
  return (
    <>
      {!item ? (
        <div className="inv-equip-card">
          <div className="inv-slot-box">WPN</div>
          <div className="inv-equip-info"><div className="inv-equip-empty">Bare fists — seek the Merchant</div></div>
        </div>
      ) : (
        <div className="inv-equip-card inv-equip-card--filled">
          <div className="inv-slot-box inv-slot-box--active">WPN</div>
          <div className="inv-equip-info">
            <div className="inv-equip-name">{item.icon} {item.name}</div>
            <div className="inv-equip-sub">{item.weaponType}</div>
            {(() => {
              const passive = getWeaponPassive(item.weaponType);
              return passive ? <div className="inv-equip-pass">Passive · {passive.name}</div> : null;
            })()}
          </div>
        </div>
      )}
    </>
  );
}

// ============================================================
// [🧱 BLOCK: Weapon Skills Panel — Q / E]
// Read-only — Q/E skills are randomly rolled on weapon equip,
// not player-assigned. Level shown reflects Arcane Focus /
// Battle Focus boon slot level if equipped, else base Level 1.
// ============================================================
function WeaponSkillsPanel({ playerStats, player }: {
  playerStats: PlayerStats;
  player:      Player;
}) {
  const qDef = player.equippedQSkill ? getSkillDef(player.equippedQSkill) : null;
  const eDef = player.equippedESkill ? getSkillDef(player.equippedESkill) : null;

  const rows = [
    { label: 'Q', def: qDef, level: playerStats.qSkillLevel, boonName: 'Arcane Focus' },
    { label: 'E', def: eDef, level: playerStats.eSkillLevel, boonName: 'Battle Focus' },
  ];

  return (
    <div className="inv-skills-panel">
      {rows.map((row) => (
        <div key={row.label} className="inv-skill-row">
          <div className="inv-skill-row__key">{row.label}</div>
          {row.def ? (
            <>
              <span className="inv-skill-row__icon">{row.def.icon}</span>
              <div className="inv-skill-row__info">
                <div className="inv-skill-row__name">{row.def.name}</div>
                <div className="inv-skill-row__desc">{row.def.description}</div>
              </div>
              <div className="inv-skill-row__level">Lv{row.level}</div>
            </>
          ) : (
            <div className="inv-skill-row__empty">No weapon equipped — seek the Merchant</div>
          )}
        </div>
      ))}
      <p className="inv-skills-panel__hint">
        Skills reroll on weapon equip. Cooldown {(SKILL_COOLDOWN_MS / 1000).toFixed(0)}s.
        Level boosted by Arcane Focus (Q) / Battle Focus (E) boons.
      </p>
    </div>
  );
}

// ============================================================
// [🧱 BLOCK: Boon Slot Card]
// Draggable — drop onto another slot to swap boons (levels stay
// with the slot, not the boon). Empty slots show a level-only
// placeholder and are still valid swap/drop targets.
// ============================================================
function BoonSlotCard({
  slotIndex, playerStats, gold, player, onSell, onUpgrade, onSwap, refresh,
}: {
  slotIndex:   number;
  playerStats: PlayerStats;
  gold:        number;
  player:      Player;
  onSell:      (slotIndex: number) => void;
  onUpgrade:   (slotIndex: number) => void;
  onSwap:      (a: number, b: number) => void;
  refresh:     () => void;
}) {
  const [confirm, setConfirm]   = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const slot  = playerStats.boons.slots[slotIndex];
  const boon  = slot.boonId ? getBoonById(slot.boonId) : null;
  const level = slot.level;
  const maxed = level >= MAX_BOON_LEVEL;
  const cost  = playerStats.boons.getSlotUpgradeCost(slotIndex);
  const canAffordUpg = !maxed && gold >= cost;

  const handleDragStart = (e: React.DragEvent) => {
    const payload: BoonDragPayload = { slotIndex };
    e.dataTransfer.setData(BOON_DRAG_KEY, JSON.stringify(payload));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const raw = e.dataTransfer.getData(BOON_DRAG_KEY);
    if (!raw) return;
    try {
      const payload = JSON.parse(raw) as BoonDragPayload;
      if (payload.slotIndex === slotIndex) return;
      onSwap(payload.slotIndex, slotIndex);
    } catch { /* ignore malformed payload */ }
  };

  return (
    <div
      className={`inv-boon-slot ${!boon ? 'inv-boon-slot--empty' : ''} ${dragOver ? 'inv-boon-slot--dragover' : ''}`}
      draggable
      onDragStart={handleDragStart}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      <div className="inv-boon-slot__header">
        <span className="inv-boon-slot__icon">{boon?.icon ?? '—'}</span>
        <span className="inv-boon-slot__name">{boon ? boon.name : 'Empty Slot'}</span>
        <span className="inv-boon-slot__level-badge">Lv{level}</span>
      </div>

      {boon ? (
        <>
          <div className="inv-boon-slot__desc">{boon.description(level)}</div>
          {boon.tradeOff && <div className="inv-boon-slot__tradeoff">⚠ {boon.tradeOff}</div>}
        </>
      ) : (
        <div className="inv-boon-slot__desc">Drag a boon here, or buy one from the Merchant.</div>
      )}

      <div className="inv-boon-slot__pips">
        {Array.from({ length: MAX_BOON_LEVEL }).map((_, i) => (
          <div key={i} className={`inv-boon-pip ${i < level ? 'inv-boon-pip--filled' : ''}`} />
        ))}
      </div>

      <div className="inv-boon-slot__footer">
        {maxed ? (
          <span style={{ fontSize: 9, color: '#4ade80', letterSpacing: 1 }}>MAX LEVEL</span>
        ) : (
          <button
            className="inv-nearby-weapon__btn"
            disabled={!canAffordUpg}
            style={!canAffordUpg ? { opacity: 0.35, cursor: 'not-allowed' } : undefined}
            onClick={() => { onUpgrade(slotIndex); refresh(); }}
          >
            ↑ Lv ({cost}g)
          </button>
        )}
        {boon && (
          confirm ? (
            <div className="inv-confirm-row">
              <button className="inv-confirm-btn--yes"    onClick={() => { setConfirm(false); onSell(slotIndex); }}>+{Math.ceil(boon.cost * 0.5)}g</button>
              <button className="inv-confirm-btn--cancel" onClick={() => setConfirm(false)}>✕</button>
            </div>
          ) : (
            <button className="inv-sell-btn" onClick={() => setConfirm(true)}>Sell</button>
          )
        )}
      </div>
    </div>
  );
}

// ============================================================
// [🧱 BLOCK: Inventory Main]
// ============================================================
export default function Inventory({
  playerStats, player, gold,
  onGoldChange, onClose,
}: InventoryProps) {
  const [, forceUpdate] = useState(0);
  const refresh = () => forceUpdate((n) => n + 1);

  // ESC closes inventory
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleSellBoon    = (slotIndex: number) => { onGoldChange(playerStats.sellBoon(slotIndex, gold, player)); refresh(); };
  const handleUpgradeBoon = (slotIndex: number) => { onGoldChange(playerStats.upgradeBoonSlot(slotIndex, gold, player)); refresh(); };
  const handleSwapBoons   = (a: number, b: number) => { playerStats.swapBoonSlots(a, b, player); refresh(); };

  return (
    <div className="inv-backdrop">
      <div className="inv-panel">
        <div className="inv-panel-inner">

          {/* ── Header ── */}
          <div className="inv-header">
            <div>
              <div className="inv-header__hint">Tap I to close · Game continues</div>
              <div className="inv-header__title">Satchel</div>
            </div>
            <div>
              <div className="inv-header__gold-label">Treasury</div>
              <div className="inv-header__gold-value">{gold}g</div>
            </div>
          </div>

          {/* ── 3-Column Body ── */}
          <div className="inv-cols">

            {/* ── Column 1: Boons ── */}
            <div className="inv-col">
              <span className="inv-sec-label">
                Boons ({playerStats.boons.filledCount}/{BOON_SLOT_COUNT}) · Drag to reorder
              </span>
              <div className="inv-box inv-box--grow">
                {Array.from({ length: BOON_SLOT_COUNT }).map((_, i) => (
                  <BoonSlotCard
                    key={i}
                    slotIndex={i}
                    playerStats={playerStats}
                    gold={gold}
                    player={player}
                    onSell={handleSellBoon}
                    onUpgrade={handleUpgradeBoon}
                    onSwap={handleSwapBoons}
                    refresh={refresh}
                  />
                ))}
              </div>
            </div>

            {/* ── Column 2: Attributes + Weapon ── */}
            <div className="inv-col">
              <div>
                <span className="inv-sec-label">Attributes</span>
                <div className="inv-box">
                  <AttributesPanel playerStats={playerStats} player={player} />
                </div>
              </div>
              <div>
                <span className="inv-sec-label">Weapon · Manage at the Merchant</span>
                <div className="inv-box">
                  <WeaponSlotCard item={playerStats.equippedWeaponItem} />
                </div>
              </div>
            </div>

            {/* ── Column 3: Weapon Skills (read-only) ── */}
            <div className="inv-col">
              <span className="inv-sec-label">Active Skills · Q &amp; E</span>
              <div className="inv-box inv-box--grow">
                <WeaponSkillsPanel playerStats={playerStats} player={player} />
              </div>
            </div>

          </div>

          {/* ── Footer ── */}
          <div className="inv-footer">
            <button className="inv-close-btn" onClick={onClose}>
              Return to Battle
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}