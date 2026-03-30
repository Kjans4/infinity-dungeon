"use client";

import React, { useState, useEffect } from "react";
import { PlayerStats } from "@/engine/PlayerStats";
import { Player }      from "@/engine/Player";
import { Charm }       from "@/engine/CharmRegistry";
import { WeaponItem }  from "@/engine/items/types";
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
// [🧱 BLOCK: Small Button]
// ============================================================
function SmallBtn({
  label, onClick, color = "#64748b", danger = false,
}: {
  label: string; onClick: () => void; color?: string; danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`inv-small-btn ${danger ? "inv-small-btn--danger" : "inv-small-btn--default"}`}
      style={
        !danger
          ? ({ "--btn-color": color } as React.CSSProperties)
          : undefined
      }
    >
      {label}
    </button>
  );
}

// ============================================================
// [🧱 BLOCK: Weapon Slot]
// ============================================================
function WeaponSlot({
  item, onUnequip,
}: {
  item:      WeaponItem | null;
  onUnequip: () => void;
}) {
  const [confirm, setConfirm] = useState(false);

  if (!item) {
    return (
      <div className="inv-weapon-slot inv-weapon-slot--empty">
        <p className="inv-weapon-slot__label">⚔ Weapon Slot</p>
        <p className="inv-weapon-slot__fists">👊 Bare Fists — buy a weapon in the shop</p>
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
      stam: item.weaponType === "sword" ? 25 : item.weaponType === "axe" ? 30 : 22,
    },
  ];

  return (
    <div className="inv-weapon-slot inv-weapon-slot--equipped">
      <p className="inv-weapon-slot__label">⚔ Weapon Slot — Equipped</p>

      <div className="inv-weapon-slot__header">
        <span className="inv-weapon-slot__icon">{item.icon}</span>
        <div className="inv-weapon-slot__info">
          <p className="inv-weapon-slot__name">{item.name}</p>
          <p className="inv-weapon-slot__type">{item.weaponType}</p>
          <p className="inv-weapon-slot__desc">{item.description}</p>
          {item.tradeOff && (
            <p className="inv-weapon-slot__tradeoff">⚠ {item.tradeOff}</p>
          )}
        </div>
      </div>

      <div className="inv-weapon-slot__atk-row">
        {atkStats.map((atk) => (
          <div key={atk.label} className="inv-weapon-slot__atk-card">
            <p className="inv-weapon-slot__atk-label">{atk.label}</p>
            <p className="inv-weapon-slot__atk-dmg">{atk.dmg} dmg</p>
            <p className="inv-weapon-slot__atk-stam">{atk.stam} stamina</p>
          </div>
        ))}
      </div>

      {!confirm ? (
        <SmallBtn
          label={`Unequip & Sell (+${refund}g)`}
          onClick={() => setConfirm(true)}
          danger
        />
      ) : (
        <div className="inv-confirm-row">
          <SmallBtn
            label="Confirm Sell"
            onClick={() => { setConfirm(false); onUnequip(); }}
            danger
          />
          <SmallBtn label="Cancel" onClick={() => setConfirm(false)} color="#64748b" />
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
      <span className="inv-charm-row__icon">{charm.icon}</span>
      <div className="inv-charm-row__info">
        <p className="inv-charm-row__name">{charm.name}</p>
        <p className="inv-charm-row__desc">{charm.description}</p>
        {charm.tradeOff && (
          <p className="inv-charm-row__tradeoff">⚠ {charm.tradeOff}</p>
        )}
      </div>
      {!confirm ? (
        <SmallBtn label="Sell" onClick={() => setConfirm(true)} danger />
      ) : (
        <div className="inv-confirm-row">
          <SmallBtn
            label={`+${refund}g`}
            onClick={() => { setConfirm(false); onSell(); }}
            danger
          />
          <SmallBtn label="✕" onClick={() => setConfirm(false)} color="#475569" />
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

  return (
    <div className="inv-backdrop">
      <div className="inv-panel">

        {/* Header */}
        <div className="inv-header">
          <div>
            <p className="inv-header__hint">Game Paused · Hold I or press ESC to close</p>
            <p className="inv-header__title">INVENTORY</p>
          </div>
          <div className="inv-header__gold">
            <p className="inv-header__gold-label">Gold Balance</p>
            <p className="inv-header__gold-value">💰 {gold}g</p>
          </div>
        </div>

        {/* Weapon slot */}
        <WeaponSlot
          item={playerStats.equippedWeaponItem}
          onUnequip={handleUnequipWeapon}
        />

        {/* Charm slots */}
        <div className="inv-charms-section">
          <p className="inv-charms-section__label">
            Charms ({playerStats.charms.length}/{playerStats.maxCharms})
          </p>
          <div className="inv-charms-list">
            {playerStats.charms.map((charm) => (
              <CharmRow
                key={charm.id}
                charm={charm}
                onSell={() => handleSellCharm(charm.id)}
              />
            ))}
            {Array.from({ length: playerStats.maxCharms - playerStats.charms.length }).map((_, i) => (
              <div key={`empty-${i}`} className="inv-charm-empty">
                — Empty slot
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="inv-footer">
          <SmallBtn label="Back to Game" onClick={onClose} color="#38bdf8" />
        </div>
        <p className="inv-footer__hint">
          BUY WEAPONS &amp; CHARMS IN THE SHOP · HOLD I TO CLOSE
        </p>

      </div>
    </div>
  );
}