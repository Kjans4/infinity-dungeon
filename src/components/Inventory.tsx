// src/components/Inventory.tsx
"use client";

import React, { useState, useEffect } from "react";
import { PlayerStats }   from "@/engine/PlayerStats";
import { Player }        from "@/engine/Player";
import { WeaponItem }    from "@/engine/items/types";
import { ItemDrop }      from "@/engine/ItemDrop";
import { getWeaponPassive } from "@/engine/WeaponPassiveRegistry";
import { MAX_BOON_LEVEL, getBoonById } from "@/engine/BoonRegistry";
import { BOON_SLOT_COUNT } from "@/engine/PlayerBoons";
import { PlayerConsumables, BagEntry, HOTBAR_SLOTS } from "@/engine/PlayerConsumables";
import { ConsumableId }  from "@/engine/ConsumableRegistry";
import "@/styles/inventory.css";

// ============================================================
// [🧱 BLOCK: Props]
// ============================================================
interface InventoryProps {
  playerStats:        PlayerStats;
  player:             Player;
  gold:               number;
  nearbyDrops:        ItemDrop[];   // weapon-only ground drops, Phase 1
  playerConsumables:  PlayerConsumables;
  onGoldChange:       (newGold: number) => void;
  onEquipDrop:        (drop: ItemDrop) => void;
  onClose:            () => void;
}

// ============================================================
// [🧱 BLOCK: Drag Payloads]
// A drag can originate from the bag list, an existing hotbar
// slot, or an existing boon slot. We encode the source so the
// drop handler knows whether to swap slots or just assign.
// ============================================================
type ConsumableDragPayload =
  | { source: 'bag';  id: ConsumableId }
  | { source: 'slot'; id: ConsumableId; slotIndex: number };

type BoonDragPayload = { slotIndex: number };

const DRAG_KEY      = 'consumableDrag';
const BOON_DRAG_KEY = 'boonDrag';

function encodeDrag(payload: ConsumableDragPayload): string {
  return JSON.stringify(payload);
}

function decodeDrag(raw: string): ConsumableDragPayload | null {
  try { return JSON.parse(raw) as ConsumableDragPayload; }
  catch { return null; }
}

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
// Includes the folded-in "Nearby Weapon" pickup, since ground
// drops are weapon-only as of Phase 1 and no longer warrant a
// dedicated column.
// ============================================================
function WeaponSlotCard({ item, onSell, nearbyDrop, onEquipDrop }: {
  item: WeaponItem | null;
  onSell: () => void;
  nearbyDrop: ItemDrop | null;
  onEquipDrop: (drop: ItemDrop) => void;
}) {
  const [confirm, setConfirm] = useState(false);

  return (
    <>
      {!item ? (
        <div className="inv-equip-card">
          <div className="inv-slot-box">WPN</div>
          <div className="inv-equip-info"><div className="inv-equip-empty">Bare fists — seek steel</div></div>
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
          {!confirm ? (
            <button className="inv-sell-btn" onClick={() => setConfirm(true)}>Sell</button>
          ) : (
            <div className="inv-confirm-row">
              <button className="inv-confirm-btn--yes"    onClick={() => { setConfirm(false); onSell(); }}>+{Math.ceil(item.cost * 0.5)}g</button>
              <button className="inv-confirm-btn--cancel" onClick={() => setConfirm(false)}>✕</button>
            </div>
          )}
        </div>
      )}

      {nearbyDrop && (
        <div className="inv-nearby-weapon" onClick={() => onEquipDrop(nearbyDrop)}>
          <div className="inv-nearby-weapon__info">
            <div className="inv-nearby-weapon__kind">Nearby Weapon</div>
            <div className="inv-nearby-weapon__name">{nearbyDrop.item.icon} {nearbyDrop.item.name}</div>
          </div>
          <button className="inv-nearby-weapon__btn" onClick={(e) => { e.stopPropagation(); onEquipDrop(nearbyDrop); }}>
            {item ? 'Swap ↕' : 'Equip'}
          </button>
        </div>
      )}
    </>
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
// [🧱 BLOCK: Consumable Bag Row]
// ============================================================
function ConsumableBagRow({ entry, onDragStart }: {
  entry:       BagEntry;
  onDragStart: (id: ConsumableId) => void;
}) {
  const isPotion = entry.def.kind === 'potion';

  const handleDragStart = (e: React.DragEvent) => {
    const ghost = document.createElement('div');
    ghost.style.cssText = `
      position:fixed; top:-100px; left:-100px;
      width:36px; height:36px;
      display:flex; align-items:center; justify-content:center;
      font-size:22px; background:rgba(10,8,4,0.9);
      border:1px solid #8b6914; border-radius:4px;
      pointer-events:none;
    `;
    ghost.textContent = entry.def.icon;
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, 18, 18);
    setTimeout(() => document.body.removeChild(ghost), 0);

    const payload: ConsumableDragPayload = { source: 'bag', id: entry.def.id };
    e.dataTransfer.setData(DRAG_KEY, encodeDrag(payload));
    onDragStart(entry.def.id);
  };

  return (
    <div
      className={`inv-consumable-row inv-consumable-row--${entry.def.kind}`}
      draggable
      onDragStart={handleDragStart}
    >
      <span className="inv-consumable-row__icon">{entry.def.icon}</span>
      <div className="inv-consumable-row__info">
        <div className="inv-consumable-row__name">{entry.def.name}</div>
        <div className="inv-consumable-row__desc">{entry.def.description}</div>
      </div>
      <span className={`inv-consumable-row__kind inv-consumable-row__kind--${entry.def.kind}`}>
        {isPotion ? 'Potion' : 'Scroll'}
      </span>
      <span className="inv-consumable-row__count">×{entry.count}</span>
    </div>
  );
}

// ============================================================
// [🧱 BLOCK: Hotbar Assign Panel]
// ============================================================
function HotbarAssignPanel({ playerConsumables, onSwapSlots, onAssign, refresh }: {
  playerConsumables: PlayerConsumables;
  onSwapSlots:       (a: number, b: number) => void;
  onAssign:          (slotIndex: number, id: ConsumableId | null) => void;
  refresh:           () => void;
}) {
  const [dragOverSlot, setDragOverSlot] = useState<number | null>(null);

  const makeGhost = (icon: string) => {
    const ghost = document.createElement('div');
    ghost.style.cssText = `
      position:fixed; top:-100px; left:-100px;
      width:36px; height:36px;
      display:flex; align-items:center; justify-content:center;
      font-size:22px; background:rgba(10,8,4,0.9);
      border:1px solid #8b6914; border-radius:4px;
      pointer-events:none;
    `;
    ghost.textContent = icon;
    return ghost;
  };

  const handleDrop = (e: React.DragEvent, targetSlotIndex: number) => {
    e.preventDefault();
    setDragOverSlot(null);

    const raw     = e.dataTransfer.getData(DRAG_KEY);
    const payload = decodeDrag(raw);
    if (!payload) return;

    if (payload.source === 'bag') {
      onAssign(targetSlotIndex, payload.id);
    } else if (payload.source === 'slot') {
      const sourceSlotIndex = payload.slotIndex;
      if (sourceSlotIndex === targetSlotIndex) return;
      onSwapSlots(sourceSlotIndex, targetSlotIndex);
    }

    refresh();
  };

  const SLOT_COOLDOWN_LABELS = ['3s', '4.5s', '6s', '7s'];

  return (
    <div className="inv-hotbar-assign">
      {Array.from({ length: HOTBAR_SLOTS }).map((_, i) => {
        const slot       = playerConsumables.slots[i];
        const assignedId = slot.assignedId;
        const def        = assignedId ? playerConsumables.bag.get(assignedId)?.def ?? null : null;
        const count      = assignedId ? playerConsumables.bagCount(assignedId) : 0;
        const isOver     = dragOverSlot === i;

        const handleSlotDragStart = (e: React.DragEvent) => {
          if (!assignedId || !def) return;
          const ghost = makeGhost(def.icon);
          document.body.appendChild(ghost);
          e.dataTransfer.setDragImage(ghost, 18, 18);
          setTimeout(() => document.body.removeChild(ghost), 0);

          const payload: ConsumableDragPayload = { source: 'slot', id: assignedId, slotIndex: i };
          e.dataTransfer.setData(DRAG_KEY, encodeDrag(payload));
        };

        return (
          <div
            key={i}
            className={`inv-hotbar-slot ${isOver ? 'inv-hotbar-slot--dragover' : ''} ${!assignedId ? 'inv-hotbar-slot--empty' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDragOverSlot(i); }}
            onDragLeave={() => setDragOverSlot(null)}
            onDrop={(e) => handleDrop(e, i)}
          >
            <div className="inv-hotbar-slot__header">
              <span className="inv-hotbar-slot__key">{i + 1}</span>
              <span className="inv-hotbar-slot__cd">{SLOT_COOLDOWN_LABELS[i]}</span>
            </div>

            {def ? (
              <div
                className="inv-hotbar-slot__assigned"
                draggable
                onDragStart={handleSlotDragStart}
                style={{ cursor: 'grab' }}
              >
                <span className="inv-hotbar-slot__assigned-icon">{def.icon}</span>
                <div className="inv-hotbar-slot__assigned-info">
                  <div className="inv-hotbar-slot__assigned-name">{def.name}</div>
                  <div className="inv-hotbar-slot__assigned-count">×{count} remaining</div>
                </div>
                <button
                  className="inv-hotbar-slot__clear"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAssign(i, null);
                    refresh();
                  }}
                >✕</button>
              </div>
            ) : (
              <div className="inv-hotbar-slot__placeholder">
                Drop item here
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ============================================================
// [🧱 BLOCK: Inventory Main]
// ============================================================
export default function Inventory({
  playerStats, player, gold, nearbyDrops,
  playerConsumables,
  onGoldChange, onEquipDrop, onClose,
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

  const handleSellWeapon = () => { onGoldChange(playerStats.unequipWeapon(gold, player)); refresh(); };
  const handleEquipDrop  = (drop: ItemDrop) => { onEquipDrop(drop); refresh(); };

  const handleSellBoon    = (slotIndex: number) => { onGoldChange(playerStats.sellBoon(slotIndex, gold, player)); refresh(); };
  const handleUpgradeBoon = (slotIndex: number) => { onGoldChange(playerStats.upgradeBoonSlot(slotIndex, gold, player)); refresh(); };
  const handleSwapBoons   = (a: number, b: number) => { playerStats.swapBoonSlots(a, b, player); refresh(); };

  const handleAssignSlot = (slotIndex: number, id: ConsumableId | null) => {
    playerConsumables.assignSlot(slotIndex, id);
    refresh();
  };

  const handleSwapSlots = (a: number, b: number) => {
    const slotA = playerConsumables.slots[a];
    const slotB = playerConsumables.slots[b];
    const idA   = slotA.assignedId;
    const idB   = slotB.assignedId;
    slotA.assignedId = idB;
    slotB.assignedId = idA;
    refresh();
  };

  const bagEntries    = playerConsumables.bagEntries();
  const nearbyWeapon  = nearbyDrops[0] ?? null;

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
                <span className="inv-sec-label">Weapon</span>
                <div className="inv-box">
                  <WeaponSlotCard
                    item={playerStats.equippedWeaponItem}
                    onSell={handleSellWeapon}
                    nearbyDrop={nearbyWeapon}
                    onEquipDrop={handleEquipDrop}
                  />
                </div>
              </div>
            </div>

            {/* ── Column 3: Provisions ── */}
            <div className="inv-col">
              <div>
                <span className="inv-sec-label">Hotbar · Drag to assign or swap</span>
                <HotbarAssignPanel
                  playerConsumables={playerConsumables}
                  onSwapSlots={handleSwapSlots}
                  onAssign={handleAssignSlot}
                  refresh={refresh}
                />
              </div>

              <div className="inv-prov-bag">
                <span className="inv-sec-label">Provisions</span>
                <div className="inv-box inv-box--grow">
                  {bagEntries.length === 0 ? (
                    <div className="inv-drop-empty">No potions or scrolls carried</div>
                  ) : (
                    bagEntries.map((entry) => (
                      <ConsumableBagRow
                        key={entry.def.id}
                        entry={entry}
                        onDragStart={() => {}}
                      />
                    ))
                  )}
                </div>
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
