// src/components/Shop.tsx
"use client";

import React, { useState, useCallback } from "react";
import { PlayerStats, STAT_DEFS, StatKey, statCost, statCap } from "@/engine/PlayerStats";
import { Player }     from "@/engine/Player";
import { Charm }      from "@/engine/CharmRegistry";
import { WeaponItem } from "@/engine/items/types";
import { ShopItem }   from "@/engine/items/ItemPool";
import "@/styles/shop.css";

interface ShopProps {
  floor:        number;
  room:         number;
  gold:         number;
  playerStats:  PlayerStats;
  player:       Player;
  onGoldChange: (newGold: number) => void;
  onContinue:   () => void;
}

// ============================================================
// [🧱 BLOCK: Heal Tiers]
// Costs scale per floor so healing doesn't trivialise later floors.
// Formula: baseCost × floor
// ============================================================
const HEAL_TIERS = [
  { label: "Small",  hp: 25,  baseCost: 40,  icon: "🩹" },
  { label: "Medium", hp: 50,  baseCost: 75,  icon: "💊" },
  { label: "Full",   hp: 999, baseCost: 120, icon: "❤️" }, // 999 = full heal (capped at maxHp)
];

// ============================================================
// [🧱 BLOCK: Shared Button]
// ============================================================
function PillBtn({ label, onClick, disabled, color = "#facc15", small = false }: {
  label: string; onClick: () => void;
  disabled?: boolean; color?: string; small?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`shop-pill-btn ${small ? "shop-pill-btn--small" : "shop-pill-btn--normal"} ${disabled ? "shop-pill-btn--disabled" : ""}`}
      style={!disabled ? ({ "--btn-color": color } as React.CSSProperties) : undefined}
    >
      {label}
    </button>
  );
}

// ============================================================
// [🧱 BLOCK: Stat Row]
// ============================================================
function StatRow({ statKey, playerStats, player, gold, floor, onSpend }: {
  statKey: StatKey; playerStats: PlayerStats; player: Player;
  gold: number; floor: number; onSpend: (g: number) => void;
}) {
  const def    = STAT_DEFS.find((d) => d.key === statKey)!;
  const level  = playerStats[statKey];
  const cap    = statCap(floor);
  const cost   = statCost(level);
  const canBuy = playerStats.canUpgrade(statKey, gold, floor);
  const maxed  = level >= cap;

  return (
    <div className="shop-stat-row">
      <span className="shop-stat-row__icon">{def.icon}</span>
      <div className="shop-stat-row__info">
        <div className="shop-stat-row__header">
          <span className="shop-stat-row__label">{def.label}</span>
          <span className="shop-stat-row__desc">{def.description}</span>
        </div>
        <div className="shop-stat-row__pips">
          {Array.from({ length: cap }).map((_, i) => (
            <div
              key={i}
              className={`shop-stat-pip ${i < level ? "shop-stat-pip--filled" : ""}`}
            />
          ))}
        </div>
      </div>
      <div className="shop-stat-row__actions">
        {!maxed && <span className="shop-stat-row__cost">💰 {cost}g</span>}
        <PillBtn
          label={maxed ? "MAX" : "+1"}
          onClick={() => {
            const ng = playerStats.upgradeStat(statKey, gold, floor);
            playerStats.applyToPlayer(player);
            onSpend(ng);
          }}
          disabled={!canBuy || maxed}
          color="#facc15"
          small
        />
      </div>
    </div>
  );
}

// ============================================================
// [🧱 BLOCK: Shop Item Card]
// ============================================================
function ShopItemCard({ item, gold, playerStats, player, onBuy }: {
  item: ShopItem; gold: number;
  playerStats: PlayerStats; player: Player;
  onBuy: (newGold: number) => void;
}) {
  const isWeapon   = item.kind === "weapon";
  const weaponItem = isWeapon ? (item as WeaponItem) : null;
  const charmItem  = !isWeapon ? (item as Charm & { kind: "charm" }) : null;

  const alreadyOwned = isWeapon
    ? playerStats.equippedWeaponItem?.id === weaponItem!.id
    : playerStats.hasCharm(charmItem!.id);

  const charmsFull  = !isWeapon && playerStats.charms.length >= playerStats.maxCharms;
  const canAfford   = gold >= item.cost;
  const canBuy      = !alreadyOwned && canAfford && !charmsFull;
  const accentColor = isWeapon ? "#38bdf8" : "#facc15";
  const typeLabel   = isWeapon
    ? `${weaponItem!.weaponType.toUpperCase()} · Weapon`
    : "Charm";

  function handleBuy() {
    if (!canBuy) return;
    const newGold = isWeapon
      ? playerStats.equipWeapon(weaponItem!, gold, player)
      : playerStats.buyCharm(charmItem!, gold, player);
    onBuy(newGold);
  }

  return (
    <div className={`shop-item-card ${alreadyOwned ? "shop-item-card--owned" : ""}`}>
      <div className="shop-item-card__icon">{item.icon}</div>
      <div className="shop-item-card__type" style={{ color: accentColor }}>
        {typeLabel}
      </div>
      <div className="shop-item-card__name">{item.name}</div>
      <div className="shop-item-card__desc">{item.description}</div>
      {item.tradeOff && (
        <div className="shop-item-card__tradeoff">⚠ {item.tradeOff}</div>
      )}
      <div className="shop-item-card__cost">💰 {item.cost}g</div>
      {charmsFull && !isWeapon && (
        <div className="shop-item-card__full-warning">Sell a charm first</div>
      )}
      <PillBtn
        label={alreadyOwned ? "Owned" : "Buy"}
        onClick={handleBuy}
        disabled={!canBuy || alreadyOwned}
        color={accentColor}
        small
      />
    </div>
  );
}

// ============================================================
// [🧱 BLOCK: Owned Charm Pill]
// ============================================================
function OwnedCharmPill({ charm, onSell }: { charm: Charm; onSell: () => void }) {
  const [confirm, setConfirm] = useState(false);
  const refund = Math.ceil(charm.cost * 0.5);

  return (
    <div className="shop-owned-pill shop-owned-pill--charm">
      <span className="shop-owned-pill__icon">{charm.icon}</span>
      <span className="shop-owned-pill__name">{charm.name}</span>
      {confirm ? (
        <div className="shop-owned-pill__confirm">
          <PillBtn label={`Sell +${refund}g`} onClick={onSell} color="#ef4444" small />
          <PillBtn label="Keep" onClick={() => setConfirm(false)} color="#64748b" small />
        </div>
      ) : (
        <PillBtn label="Sell" onClick={() => setConfirm(true)} color="#64748b" small />
      )}
    </div>
  );
}

// ============================================================
// [🧱 BLOCK: Equipped Weapon Pill]
// ============================================================
function EquippedWeaponPill({ item, onSell }: { item: WeaponItem; onSell: () => void }) {
  const [confirm, setConfirm] = useState(false);
  const refund = Math.ceil(item.cost * 0.5);

  return (
    <div className="shop-owned-pill shop-owned-pill--weapon">
      <span className="shop-owned-pill__icon">{item.icon}</span>
      <div className="shop-owned-pill__weapon-info">
        <div className="shop-owned-pill__name">{item.name}</div>
        <div className="shop-owned-pill__weapon-sub">{item.weaponType} · {item.description}</div>
      </div>
      {confirm ? (
        <div className="shop-owned-pill__confirm">
          <PillBtn label={`Sell +${refund}g`} onClick={onSell} color="#ef4444" small />
          <PillBtn label="Keep" onClick={() => setConfirm(false)} color="#64748b" small />
        </div>
      ) : (
        <PillBtn label="Sell" onClick={() => setConfirm(true)} color="#64748b" small />
      )}
    </div>
  );
}

// ============================================================
// [🧱 BLOCK: Healing Section]
// Only appears in the shop (before boss room).
// Three fixed tiers — costs scale with floor number.
// HP does not restore between rooms — this is the only source
// of healing in the run outside of charm/weapon passives.
// ============================================================
function HealingSection({ player, gold, floor, onHeal }: {
  player: Player;
  gold:   number;
  floor:  number;
  onHeal: (newGold: number) => void;
}) {
  const atFullHp = player.hp >= player.maxHp;
  const hpPct    = Math.round((player.hp / player.maxHp) * 100);

  return (
    <div className="shop-section shop-healing">
      <div className="shop-healing__header">
        <p className="shop-section__label">⚕ Healing — Before Boss</p>
        <span className="shop-healing__hp-badge">
          ❤️ {Math.round(player.hp)} / {player.maxHp}
        </span>
      </div>

      {/* HP bar */}
      <div className="shop-healing__bar-track">
        <div
          className="shop-healing__bar-fill"
          style={{
            width: `${hpPct}%`,
            background: hpPct > 50 ? "#4ade80" : hpPct > 25 ? "#facc15" : "#ef4444",
          }}
        />
      </div>

      {atFullHp ? (
        <p className="shop-healing__full-msg">✓ Already at full HP</p>
      ) : (
        <div className="shop-healing__tiers">
          {HEAL_TIERS.map((tier) => {
            const cost       = tier.baseCost * floor;
            const healAmt    = Math.min(tier.hp, player.maxHp - player.hp);
            const wouldHeal  = healAmt > 0;
            const canAfford  = gold >= cost;
            const disabled   = !canAfford || !wouldHeal;

            return (
              <div key={tier.label} className="shop-healing__tier">
                <div className="shop-healing__tier-info">
                  <span className="shop-healing__tier-icon">{tier.icon}</span>
                  <div>
                    <p className="shop-healing__tier-label">{tier.label} Heal</p>
                    <p className="shop-healing__tier-sub">
                      +{healAmt} HP · 💰 {cost}g
                    </p>
                  </div>
                </div>
                <PillBtn
                  label={canAfford ? `Heal +${healAmt}` : "Can't afford"}
                  onClick={() => {
                    player.hp = Math.min(player.maxHp, player.hp + tier.hp);
                    onHeal(gold - cost);
                  }}
                  disabled={disabled}
                  color="#4ade80"
                  small
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================================================
// [🧱 BLOCK: Shop Main]
// ============================================================
export default function Shop({
  floor, room, gold, playerStats, player, onGoldChange, onContinue,
}: ShopProps) {
  const [, forceUpdate] = useState(0);
  const refresh = useCallback(() => forceUpdate((n) => n + 1), []);

  const [optionsReady, setOptionsReady] = useState(false);
  if (!optionsReady) {
    playerStats.generateShopOptions();
    setOptionsReady(true);
  }

  const handleStatSpend  = (ng: number) => { onGoldChange(ng); refresh(); };
  const handleBuy        = (ng: number) => { onGoldChange(ng); refresh(); };
  const handleReroll     = () => { onGoldChange(playerStats.reroll(gold)); refresh(); };
  const handleSellCharm  = (id: string) => { onGoldChange(playerStats.sellCharm(id, gold, player)); refresh(); };
  const handleSellWeapon = () => { onGoldChange(playerStats.unequipWeapon(gold, player)); refresh(); };
  const handleHeal       = (ng: number) => { onGoldChange(ng); refresh(); };

  const cap = statCap(floor);

  return (
    <div className="shop-backdrop">
      <div className="shop-panel">

        {/* Header */}
        <div className="shop-header">
          <div>
            <p className="shop-header__eyebrow">Floor {floor} · Before Boss</p>
            <p className="shop-header__title">SHOP</p>
          </div>
          <div className="shop-header__gold">
            <p className="shop-header__gold-label">Your Gold</p>
            <p className="shop-header__gold-value">💰 {gold}g</p>
          </div>
        </div>

        {/* Main panels */}
        <div className="shop-main">

          {/* Stat allocation */}
          <div className="shop-section shop-section--stats">
            <p className="shop-section__label">Stat Allocation · Cap {cap}/10</p>
            {STAT_DEFS.map((def) => (
              <StatRow
                key={def.key} statKey={def.key}
                playerStats={playerStats} player={player}
                gold={gold} floor={floor} onSpend={handleStatSpend}
              />
            ))}
          </div>

          {/* Right column */}
          <div className="shop-right-col">

            {/* 3 random shop slots */}
            <div className="shop-section">
              <div className="shop-section__items-header">
                <p className="shop-section__label">Items</p>
                <PillBtn
                  label={`Reroll 💰${playerStats.rerollCost}g`}
                  onClick={handleReroll}
                  disabled={gold < playerStats.rerollCost}
                  color="#64748b"
                  small
                />
              </div>
              <div className="shop-items-row">
                {playerStats.shopOptions.map((item, i) => (
                  <ShopItemCard
                    key={`${item.id}-${i}`}
                    item={item as ShopItem}
                    gold={gold}
                    playerStats={playerStats}
                    player={player}
                    onBuy={handleBuy}
                  />
                ))}
                {playerStats.shopOptions.length === 0 && (
                  <p className="shop-empty-msg">Nothing available.</p>
                )}
              </div>
            </div>

            {/* Equipped weapon */}
            <div className="shop-section">
              <p className="shop-section__label">Equipped Weapon</p>
              {playerStats.equippedWeaponItem ? (
                <EquippedWeaponPill
                  item={playerStats.equippedWeaponItem}
                  onSell={handleSellWeapon}
                />
              ) : (
                <p className="shop-none-msg">👊 Bare Fists</p>
              )}
            </div>

            {/* Owned charms */}
            <div className="shop-section">
              <p className="shop-section__label">
                Charms ({playerStats.charms.length}/{playerStats.maxCharms})
              </p>
              {playerStats.charms.length === 0 ? (
                <p className="shop-none-msg">No charms equipped.</p>
              ) : (
                <div className="shop-charms-list">
                  {playerStats.charms.map((charm) => (
                    <OwnedCharmPill
                      key={charm.id} charm={charm}
                      onSell={() => handleSellCharm(charm.id)}
                    />
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>

        {/* ── Healing Section ── */}
        <HealingSection
          player={player}
          gold={gold}
          floor={floor}
          onHeal={handleHeal}
        />

        {/* Continue */}
        <div className="shop-footer">
          <PillBtn label="▶ Enter Boss Room" onClick={onContinue} color="#facc15" />
        </div>

      </div>
    </div>
  );
}