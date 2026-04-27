// src/components/Inventory.tsx
"use client";

import React, { useState, useEffect } from "react";
import { PlayerStats }   from "@/engine/PlayerStats";
import { Player }        from "@/engine/Player";
import { Charm }         from "@/engine/CharmRegistry";
import { WeaponItem, ArmorItem, ArmorSlot } from "@/engine/items/types";
import { ItemDrop }      from "@/engine/ItemDrop";
import { getWeaponPassive } from "@/engine/WeaponPassiveRegistry";
import { ARMOR_SET_DEFS }   from "@/engine/items/ArmorRegistry";
import "@/styles/inventory.css";

// ============================================================
// [🧱 BLOCK: Props]
// ============================================================
interface InventoryProps {
  playerStats:   PlayerStats;
  player:        Player;
  gold:          number;
  nearbyDrops:   ItemDrop[];
  onGoldChange:  (newGold: number) => void;
  onEquipDrop:   (drop: ItemDrop) => void;
  onClose:       () => void;
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
// Shows Equip (empty slot) or Swap (slot occupied).
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

  const isSwap = isSlotOccupied && !alreadyEquipped;

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
// Shows STR/VIT/AGI/END with level, bar, computed total,
// and the contribution from that stat level alone.
// ============================================================
function AttributesPanel({ playerStats, player }: {
  playerStats: PlayerStats;
  player:      Player;
}) {
  const cap = 10; // visual bar max

  // Computed totals factoring all bonuses
  const totalAtk  = playerStats.atkBonus + (playerStats.equippedWeaponItem ? 0 : 0);
  const totalHp   = player.maxHp;
  const totalSpd  = player.maxSpeed;
  const totalSta  = player.maxStamina;

  // Contribution from stat level only
  const strContrib = playerStats.str * 3;
  const vitContrib = playerStats.vit * 10;
  const agiContrib = (playerStats.agi * 0.3).toFixed(1);
  const endContrib = playerStats.end * 5;

  const rows = [
    {
      icon: '⚔️', key: 'STR', level: playerStats.str,
      total: `${totalAtk} ATK`,
      bonus: strContrib > 0 ? `+${strContrib} lvl` : 'base',
    },
    {
      icon: '❤️', key: 'VIT', level: playerStats.vit,
      total: `${totalHp} HP`,
      bonus: vitContrib > 0 ? `+${vitContrib} lvl` : 'base',
    },
    {
      icon: '💨', key: 'AGI', level: playerStats.agi,
      total: `${totalSpd.toFixed(1)} SPD`,
      bonus: parseFloat(agiContrib) > 0 ? `+${agiContrib} lvl` : 'base',
    },
    {
      icon: '⚡', key: 'END', level: playerStats.end,
      total: `${totalSta} STA`,
      bonus: endContrib > 0 ? `+${endContrib} lvl` : 'base',
    },
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
                <div
                  className="inv-stat-bar-fill"
                  style={{ width: `${(row.level / cap) * 100}%` }}
                />
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
// All 3 sets, all tiers visible, active tiers highlighted.
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
                    <span className={`inv-tier-badge ${active ? 'inv-tier-badge--active' : ''}`}>
                      {tier.pieces}pc
                    </span>
                    <span className={`inv-tier-desc ${active ? 'inv-tier-desc--active' : ''}`}>
                      {tier.description}
                    </span>
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
// [🧱 BLOCK: Weapon Slot]
// ============================================================
function WeaponSlotCard({ item, onSell }: {
  item:    WeaponItem | null;
  onSell:  () => void;
}) {
  const [confirm, setConfirm] = useState(false);

  if (!item) {
    return (
      <div className="inv-equip-card">
        <div className="inv-slot-box">WPN</div>
        <div className="inv-equip-info">
          <div className="inv-equip-empty">Bare fists — seek steel</div>
        </div>
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
          <button className="inv-confirm-btn--yes" onClick={() => { setConfirm(false); onSell(); }}>+{refund}g</button>
          <button className="inv-confirm-btn--cancel" onClick={() => setConfirm(false)}>✕</button>
        </div>
      )}
    </div>
  );
}

// ============================================================
// [🧱 BLOCK: Armor Slot Card]
// ============================================================
function ArmorSlotCard({ slot, item, onSell }: {
  slot:   ArmorSlot;
  item:   ArmorItem | null;
  onSell: () => void;
}) {
  const [confirm, setConfirm] = useState(false);
  const label = SLOT_LABELS[slot];

  if (!item) {
    return (
      <div className="inv-equip-card">
        <div className="inv-slot-box">{label.short}</div>
        <div className="inv-equip-info">
          <div className="inv-equip-empty">Empty — {label.full}</div>
        </div>
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
          <button className="inv-confirm-btn--yes" onClick={() => { setConfirm(false); onSell(); }}>+{refund}g</button>
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
          <button className="inv-confirm-btn--yes" onClick={() => { setConfirm(false); onSell(); }}>+{refund}g</button>
          <button className="inv-confirm-btn--cancel" onClick={() => setConfirm(false)}>✕</button>
        </div>
      )}
    </div>
  );
}

// ============================================================
// [🧱 BLOCK: Inventory Main]
// ============================================================
export default function Inventory({
  playerStats, player, gold, nearbyDrops, onGoldChange, onEquipDrop, onClose,
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

  const handleSellWeapon = () => {
    onGoldChange(playerStats.unequipWeapon(gold, player));
    refresh();
  };

  const handleSellArmor = (slot: ArmorSlot) => {
    onGoldChange(playerStats.sellArmor(slot, gold, player));
    refresh();
  };

  const handleSellCharm = (charmId: string) => {
    onGoldChange(playerStats.sellCharm(charmId, gold, player));
    refresh();
  };

  const handleEquipDrop = (drop: ItemDrop) => {
    onEquipDrop(drop);
    refresh();
  };

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
                  <WeaponSlotCard
                    item={playerStats.equippedWeaponItem}
                    onSell={handleSellWeapon}
                  />
                </div>
              </div>

              <div>
                <span className="inv-sec-label">Armor</span>
                <div className="inv-box">
                  {ARMOR_SLOTS.map((slot) => (
                    <ArmorSlotCard
                      key={slot}
                      slot={slot}
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
                    <CharmRow
                      key={charm.id}
                      charm={charm}
                      onSell={() => handleSellCharm(charm.id)}
                    />
                  ))}
                  {Array.from({ length: playerStats.maxCharms - playerStats.charms.length }).map((_, i) => (
                    <div key={`empty-${i}`} className="inv-charm-empty">— Empty charm slot</div>
                  ))}
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