// src/components/Inventory.tsx
"use client";

import React, { useState, useEffect, useRef } from "react";
import { PlayerStats }   from "@/engine/PlayerStats";
import { Player }        from "@/engine/Player";
import { Charm }         from "@/engine/CharmRegistry";
import { WeaponItem, ArmorItem, ArmorSlot } from "@/engine/items/types";
import { ItemDrop }      from "@/engine/ItemDrop";
import { getWeaponPassive } from "@/engine/WeaponPassiveRegistry";
import { ARMOR_SET_DEFS }   from "@/engine/items/ArmorRegistry";
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
  nearbyDrops:        ItemDrop[];
  playerConsumables:  PlayerConsumables;
  onGoldChange:       (newGold: number) => void;
  onEquipDrop:        (drop: ItemDrop) => void;
  onClose:            () => void;
}

// ============================================================
// [🧱 BLOCK: Armor Slot Order + Labels]
// ============================================================
const ARMOR_SLOTS: ArmorSlot[] = ['helmet', 'armor', 'leggings', 'gloves', 'boots'];

const SLOT_LABELS: Record<ArmorSlot, { short: string; full: string }> = {
  helmet:   { short: 'HLM', full: 'Helmet'   },
  armor:    { short: 'ARM', full: 'Armor'     },
  leggings: { short: 'LEG', full: 'Leggings'  },
  gloves:   { short: 'GLV', full: 'Gloves'    },
  boots:    { short: 'BTS', full: 'Boots'     },
};

// ============================================================
// [🧱 BLOCK: Nearby Drop Row]
// ============================================================
function NearbyDropRow({ drop, playerStats, onEquip }: {
  drop:        ItemDrop;
  playerStats: PlayerStats;
  onEquip:     (drop: ItemDrop) => void;
}) {
  const item     = drop.item;
  const isWeapon = item.kind === 'weapon';
  const isArmor  = item.kind === 'armor';
  const isCharm  = item.kind === 'charm';

  const kindLabel =
    isWeapon ? 'Weapon' :
    isArmor  ? `Armor · ${SLOT_LABELS[(item as ArmorItem).slot]?.full ?? ''}` :
               'Charm';

  const isSlotOccupied =
    isWeapon ? !!playerStats.equippedWeaponItem :
    isArmor  ? playerStats.hasArmorInSlot((item as ArmorItem).slot) :
               false;

  const isCharmsFull   = isCharm && playerStats.charms.length >= playerStats.maxCharms;
  const alreadyEquipped =
    isWeapon ? playerStats.equippedWeaponItem?.id === item.id :
    isArmor  ? playerStats.armorSlots[(item as ArmorItem).slot]?.id === item.id :
               playerStats.hasCharm(item.id);

  const canEquip = !alreadyEquipped && !isCharmsFull;
  const isSwap   = isSlotOccupied && !alreadyEquipped;

  return (
    <div className="inv-drop-row">
      <div className="inv-drop-row__info">
        <div className="inv-drop-row__kind">{kindLabel}</div>
        <div className="inv-drop-row__name">{item.name}</div>
      </div>
      <button
        className={`inv-drop-btn ${isSwap ? 'inv-drop-btn--swap' : ''} ${!canEquip ? 'inv-drop-btn--disabled' : ''}`}
        onClick={() => canEquip && onEquip(drop)}
        disabled={!canEquip}
      >
        {alreadyEquipped ? 'Equipped' : isCharmsFull ? 'Full' : isSwap ? 'Swap ↕' : 'Equip'}
      </button>
    </div>
  );
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
// [🧱 BLOCK: Set Bonuses Panel]
// ============================================================
function SetBonusesPanel({ playerStats }: { playerStats: PlayerStats }) {
  const counts = playerStats.getEquippedSetCounts();
  return (
    <>
      {ARMOR_SET_DEFS.map((def, idx) => {
        const count = counts[def.id] ?? 0;
        const pct   = (count / 5) * 100;
        return (
          <React.Fragment key={def.id}>
            {idx > 0 && <div className="inv-set-divider" />}
            <div className="inv-set-entry">
              <div className="inv-set-header">
                <span>{def.name}</span>
                <span className="inv-set-count">{count} / 5</span>
              </div>
              <div className="inv-set-bar-bg">
                <div className="inv-set-bar-fill" style={{ width: `${pct}%` }} />
              </div>
              {def.tiers.map((tier) => {
                const active = count >= tier.pieces;
                return (
                  <div key={tier.pieces} className="inv-tier-row">
                    <span className={`inv-tier-badge ${active ? 'inv-tier-badge--active' : ''}`}>{tier.pieces}pc</span>
                    <span className={`inv-tier-desc  ${active ? 'inv-tier-desc--active'  : ''}`}>{tier.description}</span>
                  </div>
                );
              })}
            </div>
          </React.Fragment>
        );
      })}
    </>
  );
}

// ============================================================
// [🧱 BLOCK: Weapon Slot Card]
// ============================================================
function WeaponSlotCard({ item, onSell }: { item: WeaponItem | null; onSell: () => void }) {
  const [confirm, setConfirm] = useState(false);
  if (!item) {
    return (
      <div className="inv-equip-card">
        <div className="inv-slot-box">WPN</div>
        <div className="inv-equip-info"><div className="inv-equip-empty">Bare fists — seek steel</div></div>
      </div>
    );
  }
  const passive = getWeaponPassive(item.weaponType);
  const refund  = Math.ceil(item.cost * 0.5);
  return (
    <div className="inv-equip-card inv-equip-card--filled">
      <div className="inv-slot-box inv-slot-box--active">WPN</div>
      <div className="inv-equip-info">
        <div className="inv-equip-name">{item.icon} {item.name}</div>
        <div className="inv-equip-sub">{item.weaponType}</div>
        {passive && <div className="inv-equip-pass">Passive · {passive.name}</div>}
      </div>
      {!confirm ? (
        <button className="inv-sell-btn" onClick={() => setConfirm(true)}>Sell</button>
      ) : (
        <div className="inv-confirm-row">
          <button className="inv-confirm-btn--yes"    onClick={() => { setConfirm(false); onSell(); }}>+{refund}g</button>
          <button className="inv-confirm-btn--cancel" onClick={() => setConfirm(false)}>✕</button>
        </div>
      )}
    </div>
  );
}

// ============================================================
// [🧱 BLOCK: Armor Slot Card]
// ============================================================
function ArmorSlotCard({ slot, item, onSell }: { slot: ArmorSlot; item: ArmorItem | null; onSell: () => void }) {
  const [confirm, setConfirm] = useState(false);
  const label = SLOT_LABELS[slot];
  if (!item) {
    return (
      <div className="inv-equip-card">
        <div className="inv-slot-box">{label.short}</div>
        <div className="inv-equip-info"><div className="inv-equip-empty">Empty — {label.full}</div></div>
      </div>
    );
  }
  const refund = Math.ceil(item.cost * 0.5);
  return (
    <div className="inv-equip-card inv-equip-card--filled">
      <div className="inv-slot-box inv-slot-box--active">{label.short}</div>
      <div className="inv-equip-info">
        <div className="inv-equip-name">{item.icon} {item.name}</div>
        <div className="inv-equip-sub">{item.description} · {item.setName}</div>
      </div>
      {!confirm ? (
        <button className="inv-sell-btn" onClick={() => setConfirm(true)}>Sell</button>
      ) : (
        <div className="inv-confirm-row">
          <button className="inv-confirm-btn--yes"    onClick={() => { setConfirm(false); onSell(); }}>+{refund}g</button>
          <button className="inv-confirm-btn--cancel" onClick={() => setConfirm(false)}>✕</button>
        </div>
      )}
    </div>
  );
}

// ============================================================
// [🧱 BLOCK: Charm Row]
// ============================================================
function CharmRow({ charm, onSell }: { charm: Charm; onSell: () => void }) {
  const [confirm, setConfirm] = useState(false);
  const refund = Math.ceil(charm.cost * 0.5);
  return (
    <div className="inv-charm-row">
      <span className="inv-charm-icon">{charm.icon}</span>
      <div className="inv-charm-info">
        <div className="inv-charm-name">{charm.name}</div>
        <div className="inv-charm-desc">{charm.description}</div>
        {charm.tradeOff && <div className="inv-charm-tradeoff">⚠ {charm.tradeOff}</div>}
      </div>
      {!confirm ? (
        <button className="inv-sell-btn" onClick={() => setConfirm(true)}>Sell</button>
      ) : (
        <div className="inv-confirm-row">
          <button className="inv-confirm-btn--yes"    onClick={() => { setConfirm(false); onSell(); }}>+{refund}g</button>
          <button className="inv-confirm-btn--cancel" onClick={() => setConfirm(false)}>✕</button>
        </div>
      )}
    </div>
  );
}

// ============================================================
// [🧱 BLOCK: Consumable Bag Row]
// Each row shows icon, name, description, stack count.
// Dragging the row sends only the icon as the drag ghost.
// Dropping onto a hotbar slot number assigns it.
// ============================================================
function ConsumableBagRow({ entry, onDragStart }: {
  entry:       BagEntry;
  onDragStart: (id: ConsumableId) => void;
}) {
  const isPotion = entry.def.kind === 'potion';

  const handleDragStart = (e: React.DragEvent) => {
    // Create a small ghost showing only the icon
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

    e.dataTransfer.setData('consumableId', entry.def.id);
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
// [🧱 BLOCK: Hotbar Assign Slots]
// Four drop targets rendered as numbered boxes.
// Player drags a consumable from the bag list onto a slot.
// Shows current assignment (icon + name) or empty state.
// ============================================================
function HotbarAssignPanel({ playerConsumables, onAssign, refresh }: {
  playerConsumables: PlayerConsumables;
  onAssign:          (slotIndex: number, id: ConsumableId | null) => void;
  refresh:           () => void;
}) {
  const [dragOverSlot, setDragOverSlot] = useState<number | null>(null);

  const handleDrop = (e: React.DragEvent, slotIndex: number) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('consumableId') as ConsumableId | '';
    if (id) {
      onAssign(slotIndex, id);
      refresh();
    }
    setDragOverSlot(null);
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
              <div className="inv-hotbar-slot__assigned">
                <span className="inv-hotbar-slot__assigned-icon">{def.icon}</span>
                <div className="inv-hotbar-slot__assigned-info">
                  <div className="inv-hotbar-slot__assigned-name">{def.name}</div>
                  <div className="inv-hotbar-slot__assigned-count">×{count} remaining</div>
                </div>
                <button
                  className="inv-hotbar-slot__clear"
                  onClick={() => { onAssign(i, null); refresh(); }}
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
  const [draggingId, setDraggingId] = useState<ConsumableId | null>(null);

  // ESC closes inventory
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleSellWeapon = () => { onGoldChange(playerStats.unequipWeapon(gold, player)); refresh(); };
  const handleSellArmor  = (slot: ArmorSlot) => { onGoldChange(playerStats.sellArmor(slot, gold, player)); refresh(); };
  const handleSellCharm  = (id: string) => { onGoldChange(playerStats.sellCharm(id, gold, player)); refresh(); };
  const handleEquipDrop  = (drop: ItemDrop) => { onEquipDrop(drop); refresh(); };

  const handleAssignSlot = (slotIndex: number, id: ConsumableId | null) => {
    playerConsumables.assignSlot(slotIndex, id);
    refresh();
  };

  const bagEntries = playerConsumables.bagEntries();

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

          {/* ── 4-Column Body ── */}
          <div className="inv-cols">

            {/* ── Column 1: Nearby Drops · Attributes · Set Bonuses ── */}
            <div className="inv-col">
              <div>
                <span className="inv-sec-label">Nearby Drops</span>
                <div className="inv-box">
                  {nearbyDrops.length === 0 ? (
                    <div className="inv-drop-empty">No items nearby</div>
                  ) : (
                    nearbyDrops.map((drop, i) => (
                      <NearbyDropRow
                        key={`${drop.item.id}-${i}`}
                        drop={drop}
                        playerStats={playerStats}
                        onEquip={handleEquipDrop}
                      />
                    ))
                  )}
                </div>
              </div>
              <div>
                <span className="inv-sec-label">Attributes</span>
                <div className="inv-box">
                  <AttributesPanel playerStats={playerStats} player={player} />
                </div>
              </div>
              <div className="inv-set-section">
                <span className="inv-sec-label">Set Bonuses</span>
                <div className="inv-set-box">
                  <SetBonusesPanel playerStats={playerStats} />
                </div>
              </div>
            </div>

            {/* ── Column 2: Weapon + Armor ── */}
            <div className="inv-col">
              <div>
                <span className="inv-sec-label">Weapon</span>
                <div className="inv-box">
                  <WeaponSlotCard item={playerStats.equippedWeaponItem} onSell={handleSellWeapon} />
                </div>
              </div>
              <div>
                <span className="inv-sec-label">Armor</span>
                <div className="inv-box">
                  {ARMOR_SLOTS.map((slot) => (
                    <ArmorSlotCard
                      key={slot} slot={slot}
                      item={playerStats.armorSlots[slot]}
                      onSell={() => handleSellArmor(slot)}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* ── Column 3: Charms ── */}
            <div className="inv-col">
              <div>
                <span className="inv-sec-label">
                  Charms ({playerStats.charms.length} / {playerStats.maxCharms})
                </span>
                <div className="inv-box">
                  {playerStats.charms.map((charm) => (
                    <CharmRow key={charm.id} charm={charm} onSell={() => handleSellCharm(charm.id)} />
                  ))}
                  {Array.from({ length: playerStats.maxCharms - playerStats.charms.length }).map((_, i) => (
                    <div key={`empty-${i}`} className="inv-charm-empty">— Empty charm slot</div>
                  ))}
                </div>
              </div>
            </div>

            {/* ── Column 4: Provisions ── */}
            <div className="inv-col">

              {/* Hotbar assignment */}
              <div>
                <span className="inv-sec-label">Hotbar · Drag to assign</span>
                <HotbarAssignPanel
                  playerConsumables={playerConsumables}
                  onAssign={handleAssignSlot}
                  refresh={refresh}
                />
              </div>

              {/* Bag list */}
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
                        onDragStart={(id) => setDraggingId(id)}
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