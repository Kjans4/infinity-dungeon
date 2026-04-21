// src/components/Inventory.tsx
"use client";

import React, { useState, useEffect } from "react";
import { PlayerStats }   from "@/engine/PlayerStats";
import { Player }        from "@/engine/Player";
import { Charm }         from "@/engine/CharmRegistry";
import { WeaponItem, ArmorItem, ArmorSlot } from "@/engine/items/types";
import { getWeaponPassive } from "@/engine/WeaponPassiveRegistry";
import { ARMOR_SET_DEFS }   from "@/engine/items/ArmorRegistry";
import "@/styles/inventory.css";

// ============================================================
// [🧱 BLOCK: Props]
// ============================================================
interface InventoryProps {
  playerStats:  PlayerStats;
  player:       Player;
  gold:         number;
  onGoldChange: (newGold: number) => void;
  onClose:      () => void;
}

// ============================================================
// [🧱 BLOCK: Gem Rule Divider]
// ============================================================
function GemRule() {
  return (
    <div className="inv-gem-rule">
      <div className="inv-gem-rule-gem" />
    </div>
  );
}

// ============================================================
// [🧱 BLOCK: Small Button]
// ============================================================
function SmallBtn({ label, onClick, color = "#5a4010", danger = false }: {
  label: string; onClick: () => void; color?: string; danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`inv-small-btn ${danger ? "inv-small-btn--danger" : "inv-small-btn--default"}`}
      style={!danger ? ({ "--btn-color": color } as React.CSSProperties) : undefined}
    >
      {label}
    </button>
  );
}

// ============================================================
// [🧱 BLOCK: Weapon Slot]
// ============================================================
function WeaponSlot({ item, onUnequip }: {
  item: WeaponItem | null;
  onUnequip: () => void;
}) {
  const [confirm, setConfirm] = useState(false);

  if (!item) {
    return (
      <div className="inv-weapon-slot inv-weapon-slot--empty">
        <p className="inv-weapon-slot__label">⚔ Weapon Slot</p>
        <p className="inv-weapon-slot__fists">"Bare fists — seek steel from a merchant."</p>
      </div>
    );
  }

  const refund = Math.ceil(item.cost * 0.5);
  const atkStats = [
    {
      label: "Light",
      dmg:  item.weaponType === "sword" ? 12 : item.weaponType === "axe" ? 15 : 10,
      stam: item.weaponType === "sword" ? 10 : item.weaponType === "axe" ? 12 : 8,
    },
    {
      label: "Heavy",
      dmg:  item.weaponType === "sword" ? 28 : item.weaponType === "axe" ? 40 : 35,
      stam: item.weaponType === "sword" ? 35 : item.weaponType === "axe" ? 42 : 32,
    },
  ];

  return (
    <div className="inv-weapon-slot inv-weapon-slot--equipped">
      <p className="inv-weapon-slot__label">⚔ Weapon — Equipped</p>

      <div className="inv-weapon-slot__header">
        <span className="inv-weapon-slot__icon">{item.icon}</span>
        <div className="inv-weapon-slot__info">
          <p className="inv-weapon-slot__name">{item.name}</p>
          <p className="inv-weapon-slot__type">{item.weaponType}</p>
          <p className="inv-weapon-slot__desc">{item.description}</p>
          {item.tradeOff && <p className="inv-weapon-slot__tradeoff">⚠ {item.tradeOff}</p>}
        </div>
      </div>

      {(() => {
        const p = getWeaponPassive(item.weaponType);
        return p ? (
          <div className="inv-weapon-slot__passive">
            <p className="inv-weapon-slot__passive-label">Passive · {p.name}</p>
            <p className="inv-weapon-slot__passive-desc">{p.description}</p>
            {p.tradeOff && <p className="inv-weapon-slot__tradeoff">⚠ {p.tradeOff}</p>}
          </div>
        ) : null;
      })()}

      <div className="inv-weapon-slot__atk-row">
        {atkStats.map((atk) => (
          <div key={atk.label} className="inv-weapon-slot__atk-card">
            <p className="inv-weapon-slot__atk-label">{atk.label}</p>
            <p className="inv-weapon-slot__atk-dmg">{atk.dmg} damage</p>
            <p className="inv-weapon-slot__atk-stam">{atk.stam} stamina</p>
          </div>
        ))}
      </div>

      {!confirm ? (
        <SmallBtn label={`Sell for ${refund}g`} onClick={() => setConfirm(true)} danger />
      ) : (
        <div className="inv-confirm-row">
          <SmallBtn label="Confirm" onClick={() => { setConfirm(false); onUnequip(); }} danger />
          <SmallBtn label="Cancel"  onClick={() => setConfirm(false)} color="#5a4010" />
        </div>
      )}
    </div>
  );
}

// ============================================================
// [🧱 BLOCK: Armor Slot Row]
// Displays a single armor slot (helmet/armor/boots/gloves/weapon).
// Shows the piece if equipped, empty state if not.
// ============================================================
const SLOT_LABELS: Record<ArmorSlot, string> = {
  helmet: '🪖 Helmet',
  armor:  '🛡 Armor',
  boots:  '👢 Boots',
  gloves: '🧤 Gloves',
  weapon: '⚔️ Set Weapon',
};

function ArmorSlotRow({ slot, item, onSell }: {
  slot:   ArmorSlot;
  item:   ArmorItem | null;
  onSell: () => void;
}) {
  const [confirm, setConfirm] = useState(false);

  if (!item) {
    return (
      <div className="inv-armor-row inv-armor-row--empty">
        <span className="inv-armor-row__slot-label">{SLOT_LABELS[slot]}</span>
        <span className="inv-armor-row__empty-text">— Empty</span>
      </div>
    );
  }

  const refund = Math.ceil(item.cost * 0.5);

  return (
    <div className="inv-armor-row inv-armor-row--equipped">
      <span className="inv-armor-row__icon">{item.icon}</span>
      <div className="inv-armor-row__info">
        <p className="inv-armor-row__name">{item.name}</p>
        <p className="inv-armor-row__set">{item.setName} Set</p>
        <p className="inv-armor-row__stat">{item.description}</p>
      </div>
      {!confirm ? (
        <SmallBtn label="Sell" onClick={() => setConfirm(true)} danger />
      ) : (
        <div className="inv-confirm-row">
          <SmallBtn label={`+${refund}g`} onClick={() => { setConfirm(false); onSell(); }} danger />
          <SmallBtn label="✕"             onClick={() => setConfirm(false)} color="#3a2808" />
        </div>
      )}
    </div>
  );
}

// ============================================================
// [🧱 BLOCK: Set Bonus Display]
// Shows all 3 sets with their piece count and active bonuses.
// ============================================================
function SetBonusPanel({ playerStats }: { playerStats: PlayerStats }) {
  const counts     = playerStats.getEquippedSetCounts();
  const activeTiers = playerStats.getActiveBonusTiers();

  return (
    <div className="inv-set-bonus-panel">
      <p className="inv-set-bonus-panel__title">Armor Set Bonuses</p>
      {ARMOR_SET_DEFS.map((def) => {
        const count     = counts[def.id] ?? 0;
        const activeTier = activeTiers.find((t) => t.setId === def.id);

        return (
          <div key={def.id} className="inv-set-bonus-entry">
            {/* Set header */}
            <div className="inv-set-bonus-entry__header">
              <span className="inv-set-bonus-entry__icon">{def.icon}</span>
              <span
                className="inv-set-bonus-entry__name"
                style={{ color: count >= 2 ? def.color : '#334155' }}
              >
                {def.name}
              </span>
              <span className="inv-set-bonus-entry__count">
                {count} / 5
              </span>
            </div>

            {/* Tier rows */}
            {def.tiers.map((tier) => {
              const reached = count >= tier.pieces;
              const isActive = activeTier?.tier === tier.pieces ||
                (activeTier && activeTier.tier > tier.pieces);
              // A tier is active if we've met or exceeded its threshold
              const tierActive = count >= tier.pieces;
              return (
                <div
                  key={tier.pieces}
                  className={`inv-set-bonus-tier ${tierActive ? "inv-set-bonus-tier--active" : ""}`}
                >
                  <span
                    className="inv-set-bonus-tier__badge"
                    style={{ background: tierActive ? def.color : undefined }}
                  >
                    {tier.pieces}pc
                  </span>
                  <span className="inv-set-bonus-tier__desc">{tier.description}</span>
                </div>
              );
            })}
          </div>
        );
      })}
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
      <span className="inv-charm-row__icon">{charm.icon}</span>
      <div className="inv-charm-row__info">
        <p className="inv-charm-row__name">{charm.name}</p>
        <p className="inv-charm-row__desc">{charm.description}</p>
        {charm.tradeOff && <p className="inv-charm-row__tradeoff">⚠ {charm.tradeOff}</p>}
      </div>
      {!confirm ? (
        <SmallBtn label="Sell" onClick={() => setConfirm(true)} danger />
      ) : (
        <div className="inv-confirm-row">
          <SmallBtn label={`+${refund}g`} onClick={() => { setConfirm(false); onSell(); }} danger />
          <SmallBtn label="✕"             onClick={() => setConfirm(false)} color="#3a2808" />
        </div>
      )}
    </div>
  );
}

// ============================================================
// [🧱 BLOCK: Inventory Main]
// ============================================================
export default function Inventory({
  playerStats, player, gold, onGoldChange, onClose,
}: InventoryProps) {
  const [, forceUpdate] = useState(0);
  const refresh = () => forceUpdate((n) => n + 1);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handleUnequipWeapon = () => {
    const ng = playerStats.unequipWeapon(gold, player);
    onGoldChange(ng);
    refresh();
  };

  const handleSellCharm = (charmId: string) => {
    const ng = playerStats.sellCharm(charmId, gold, player);
    onGoldChange(ng);
    refresh();
  };

  const handleSellArmor = (slot: ArmorSlot) => {
    const ng = playerStats.sellArmor(slot, gold, player);
    onGoldChange(ng);
    refresh();
  };

  const ARMOR_SLOTS: ArmorSlot[] = ['helmet', 'armor', 'boots', 'gloves', 'weapon'];

  return (
    <div className="inv-backdrop">
      <div className="inv-panel">
        <div className="inv-panel-inner">

          {/* Header */}
          <div className="inv-header">
            <div>
              <p className="inv-header__hint">Paused · Hold I or ESC to close</p>
              <p className="inv-header__title">Satchel</p>
            </div>
            <div className="inv-header__gold">
              <p className="inv-header__gold-label">Treasury</p>
              <p className="inv-header__gold-value">{gold}g</p>
            </div>
          </div>

          <GemRule />

          {/* Weapon slot */}
          <WeaponSlot item={playerStats.equippedWeaponItem} onUnequip={handleUnequipWeapon} />

          <GemRule />

          {/* Armor slots */}
          <div className="inv-armor-section">
            <p className="inv-armor-section__label">Armor</p>
            <div className="inv-armor-list">
              {ARMOR_SLOTS.map((slot) => (
                <ArmorSlotRow
                  key={slot}
                  slot={slot}
                  item={playerStats.armorSlots[slot]}
                  onSell={() => handleSellArmor(slot)}
                />
              ))}
            </div>
          </div>

          <GemRule />

          {/* Set bonus panel */}
          <SetBonusPanel playerStats={playerStats} />

          <GemRule />

          {/* Charm slots */}
          <div className="inv-charms-section">
            <p className="inv-charms-section__label">
              Charms ({playerStats.charms.length}/{playerStats.maxCharms})
            </p>
            <div className="inv-charms-list">
              {playerStats.charms.map((charm) => (
                <CharmRow key={charm.id} charm={charm} onSell={() => handleSellCharm(charm.id)} />
              ))}
              {Array.from({ length: playerStats.maxCharms - playerStats.charms.length }).map((_, i) => (
                <div key={`empty-${i}`} className="inv-charm-empty">— Empty charm slot</div>
              ))}
            </div>
          </div>

          <GemRule />

          {/* Footer */}
          <div className="inv-footer">
            <SmallBtn label="Return to Battle" onClick={onClose} color="#8B6914" />
          </div>
          <p className="inv-footer__hint">
            "Acquire armor &amp; weapons from the merchant · Hold I to close"
          </p>

        </div>
      </div>
    </div>
  );
}