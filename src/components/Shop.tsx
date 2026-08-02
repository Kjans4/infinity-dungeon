// src/components/Shop.tsx
"use client";

import React, { useState, useCallback, useRef } from "react";
import { PlayerStats, STAT_DEFS, StatKey, statCost, statCap } from "@/engine/PlayerStats";
import { Player }     from "@/engine/Player";
import { BoonDef, getBoonById, getBoonEffectsAtLevel, MAX_BOON_LEVEL } from "@/engine/BoonRegistry";
import { BOON_SLOT_COUNT } from "@/engine/PlayerBoons";
import { WeaponItem } from "@/engine/items/types";
import { ShopItem }   from "@/engine/items/ItemPool";
import { getWeaponPassive } from "@/engine/WeaponPassiveRegistry";
import {
  ConsumableDef, POTION_POOL, SCROLL_POOL,
  MAX_CONSUMABLE_LEVEL, getUpgradeCost,
} from "@/engine/ConsumableRegistry";
import { PlayerConsumables } from "@/engine/PlayerConsumables";
import "@/styles/shop.css";

// ============================================================
// [🧱 BLOCK: Props]
// ============================================================
interface ShopProps {
  floor:              number;
  room:               number;
  gold:               number;
  playerStats:        PlayerStats;
  player:             Player;
  playerConsumables:  PlayerConsumables;
  isMidRoom:          boolean;
  nearbyWeaponDrop?:  { name: string; icon: string } | null;
  onGoldChange:       (newGold: number) => void;
  onContinue:         () => void;
  onClose:            () => void;
}

// ============================================================
// [🧱 BLOCK: Heal Tiers]
// ============================================================
const HEAL_TIERS = [
  { label: "Tincture", hp: 25,  baseCost: 40,  icon: "🩹" },
  { label: "Draught",  hp: 50,  baseCost: 75,  icon: "💊" },
  { label: "Elixir",   hp: 999, baseCost: 120, icon: "❤️" },
];

// ============================================================
// [🧱 BLOCK: Pill Button]
// ============================================================
function PillBtn({ label, onClick, disabled, color = "#f0c040", small = false }: {
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
            <div key={i} className={`shop-stat-pip ${i < level ? "shop-stat-pip--filled" : ""}`} />
          ))}
        </div>
      </div>
      <div className="shop-stat-row__actions">
        {!maxed && <span className="shop-stat-row__cost">{cost}g</span>}
        <PillBtn
          label={maxed ? "MAX" : "+1"}
          onClick={() => {
            const ng = playerStats.upgradeStat(statKey, gold, floor);
            playerStats.applyToPlayer(player);
            onSpend(ng);
          }}
          disabled={!canBuy || maxed}
          color="#f0c040"
          small
        />
      </div>
    </div>
  );
}

// ============================================================
// [🧱 BLOCK: Shop Item Card — Horizontal layout]
// Handles both weapon and boon offers.
// ============================================================
function ShopItemCard({ item, gold, playerStats, onBuyWeapon, onBuyBoon }: {
  item: ShopItem; gold: number;
  playerStats: PlayerStats;
  onBuyWeapon: (item: WeaponItem) => void;
  onBuyBoon:   (item: Extract<ShopItem, { kind: 'boon' }>) => void;
}) {
  const isWeapon = item.kind === "weapon";
  const isBoon   = item.kind === "boon";

  const weaponItem = isWeapon ? (item as WeaponItem) : null;

  const alreadyOwned = isWeapon
    ? playerStats.equippedWeaponItem?.id === weaponItem!.id
    : playerStats.hasBoon(item.id);

  const canAfford = gold >= item.cost;
  const canBuy    = !alreadyOwned && canAfford;

  const accentColor = isWeapon ? "#60a5fa" : "#f0c040";
  const typeLabel    = isWeapon ? `${weaponItem!.weaponType.toUpperCase()} · WPN` : "BOON";

  function handleBuy() {
    if (!canBuy) return;
    if (isWeapon) onBuyWeapon(weaponItem!);
    else          onBuyBoon(item as Extract<ShopItem, { kind: 'boon' }>);
  }

  return (
    <div className={`shop-item-card ${alreadyOwned ? "shop-item-card--owned" : ""}`}>
      <div className="shop-item-card__icon">{item.icon}</div>
      <div className="shop-item-card__type" style={{ color: accentColor }}>{typeLabel}</div>
      <div className="shop-item-card__name">{item.name}</div>
      <div className="shop-item-card__desc">{item.description}</div>
      {isWeapon && (() => {
        const p = getWeaponPassive(weaponItem!.weaponType);
        return p ? (
          <div className="shop-item-card__passive">
            <span className="shop-item-card__passive-label">Passive · {p.name}</span>
            <span className="shop-item-card__passive-desc">{p.description}</span>
          </div>
        ) : null;
      })()}
      {item.tradeOff && <div className="shop-item-card__tradeoff">⚠ {item.tradeOff}</div>}
      <div className="shop-item-card__footer">
        <span className="shop-item-card__cost">{item.cost}g</span>
        <PillBtn
          label={alreadyOwned ? "Owned" : "Acquire"}
          onClick={handleBuy}
          disabled={!canBuy || alreadyOwned}
          color={accentColor}
          small
        />
      </div>
    </div>
  );
}

// ============================================================
// [🧱 BLOCK: Consumable Shop Row — with upgrade system]
// ============================================================
function ConsumableShopRow({ def, gold, playerConsumables, onBuy, onUpgrade }: {
  def:               ConsumableDef;
  gold:              number;
  playerConsumables: PlayerConsumables;
  onBuy:             (newGold: number) => void;
  onUpgrade:         (newGold: number) => void;
}) {
  const isPotion      = def.kind === 'potion';
  const canAffordBuy  = gold >= def.cost;
  const currentCount  = playerConsumables.bagCount(def.id);
  const maxed         = currentCount >= 8;
  const canBuy        = canAffordBuy && !maxed;
  const accentColor   = isPotion ? '#a78bfa' : '#38bdf8';

  const currentLevel  = playerConsumables.getLevel(def.id);
  const isMaxLevel    = currentLevel >= MAX_CONSUMABLE_LEVEL;
  const upgradeCost   = isMaxLevel ? 0 : playerConsumables.getUpgradeCost(def);
  const canAffordUpg  = !isMaxLevel && gold >= upgradeCost;

  const levelDescriptions: Record<string, string[]> = {
    health_potion:    ['40 HP', '55 HP', '75 HP', '100 HP', '130 HP'],
    wrath_potion:     ['+25 ATK/15s', '+32 ATK/17s', '+40 ATK/20s', '+50 ATK/23s', '+65 ATK/27s'],
    iron_potion:      ['40% DR/10s', '48%/12s', '55%/14s', '62%/17s', '70%/20s'],
    phantom_potion:   ['12s', '16s', '20s', '25s', '32s'],
    fireball_scroll:  ['45dmg/r90', '65/r105', '90/r125', '120/r148', '160/r175'],
    frost_scroll:     ['28dmg/2s', '42/2.5s', '60/3s', '82/3.5s', '110/4s'],
    lightning_scroll: ['32dmg/3c', '48/4c', '68/4c', '92/5c', '125/5c'],
    blink_scroll:     ['300px', '380px', '470px', '570px', '680px'],
    ward_scroll:      ['3hits/5s', '4/6s', '5/7s', '6/9s', '8/11s'],
    void_scroll:      ['r160/s20', 'r200/s25', 'r250/s32', 'r310/s40', 'r380/s50'],
  };
  const currentDesc = levelDescriptions[def.id]?.[currentLevel - 1] ?? '';
  const nextDesc    = !isMaxLevel ? levelDescriptions[def.id]?.[currentLevel] ?? '' : '';

  return (
    <div className="shop-consumable-row shop-consumable-row--upgradable">
      <div className="shop-consumable-row__main">
        <span className="shop-consumable-row__icon">{def.icon}</span>
        <div className="shop-consumable-row__info">
          <div className="shop-consumable-row__name">{def.name}</div>
          <div className="shop-consumable-row__desc">{def.description}</div>
        </div>
        <div className="shop-consumable-row__right">
          <span
            className="shop-consumable-row__kind"
            style={{ color: accentColor, borderColor: isPotion ? '#4a2a6a' : '#0a3a4a' }}
          >
            {isPotion ? 'POTION' : 'SCROLL'}
          </span>
          {currentCount > 0 && (
            <span className="shop-consumable-row__count">×{currentCount}</span>
          )}
          <span className="shop-consumable-row__cost">{def.cost}g</span>
          <PillBtn
            label={maxed ? "MAX" : canAffordBuy ? "Buy" : "Need gold"}
            onClick={() => {
              if (!canBuy) return;
              playerConsumables.addToBag(def, 1);
              onBuy(gold - def.cost);
            }}
            disabled={!canBuy}
            color={accentColor}
            small
          />
        </div>
      </div>

      <div className="shop-consumable-row__upgrade-row">
        <div className="shop-consumable-row__level-pips">
          {Array.from({ length: MAX_CONSUMABLE_LEVEL }).map((_, i) => (
            <div
              key={i}
              className={`shop-consumable-pip ${i < currentLevel ? 'shop-consumable-pip--filled' : ''}`}
              style={i < currentLevel ? { background: accentColor, borderColor: accentColor } : undefined}
            />
          ))}
        </div>

        <span className="shop-consumable-row__level-stat" style={{ color: accentColor }}>
          {currentDesc}
        </span>

        {!isMaxLevel && (
          <>
            <span className="shop-consumable-row__upgrade-arrow">→</span>
            <span className="shop-consumable-row__next-stat">{nextDesc}</span>
          </>
        )}

        <div style={{ flex: 1 }} />

        {isMaxLevel ? (
          <span className="shop-consumable-row__max-badge" style={{ color: accentColor }}>
            MAX LVL
          </span>
        ) : (
          <>
            <span className="shop-consumable-row__upgrade-cost">{upgradeCost}g</span>
            <PillBtn
              label={`↑ ${def.upgradeDesc}`}
              onClick={() => {
                const newGold = playerConsumables.upgrade(def, gold);
                onUpgrade(newGold);
              }}
              disabled={!canAffordUpg}
              color={accentColor}
              small
            />
          </>
        )}
      </div>
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
        <div className="shop-owned-pill__weapon-sub">{item.weaponType}</div>
      </div>
      {confirm ? (
        <div className="shop-owned-pill__confirm">
          <PillBtn label={`+${refund}g`} onClick={onSell} color="#ef4444" small />
          <PillBtn label="Keep" onClick={() => setConfirm(false)} color="#5a4010" small />
        </div>
      ) : (
        <PillBtn label="Sell" onClick={() => setConfirm(true)} color="#5a4010" small />
      )}
    </div>
  );
}

// ============================================================
// [🧱 BLOCK: Boon Slot Card]
// picking = true means a boon purchase is pending and this
// card acts as a clickable replace target.
// ============================================================
function BoonSlotCard({
  slotIndex, playerStats, gold, player,
  picking, onPickSlot, onSell, onUpgrade,
}: {
  slotIndex:   number;
  playerStats: PlayerStats;
  gold:        number;
  player:      Player;
  picking:     boolean;
  onPickSlot:  (slotIndex: number) => void;
  onSell:      (slotIndex: number) => void;
  onUpgrade:   (slotIndex: number) => void;
}) {
  const [confirm, setConfirm] = useState(false);
  const slot   = playerStats.boons.slots[slotIndex];
  const boon   = slot.boonId ? getBoonById(slot.boonId) : null;
  const level  = slot.level;
  const maxed  = level >= MAX_BOON_LEVEL;
  const cost   = playerStats.boons.getSlotUpgradeCost(slotIndex);
  const canAffordUpg = !maxed && gold >= cost;

  if (picking) {
    return (
      <div className="shop-boon-slot shop-boon-slot--picking" onClick={() => onPickSlot(slotIndex)}>
        <div className="shop-boon-slot__header">
          <span className="shop-boon-slot__icon">{boon?.icon ?? '➕'}</span>
          <span className="shop-boon-slot__name">{boon ? boon.name : `Empty Slot`}</span>
          <span className="shop-boon-slot__level-badge">Lv{level}</span>
        </div>
        <div className="shop-boon-slot__desc">
          {boon ? "Click to replace with the new boon" : "Click to fill this empty slot"}
        </div>
      </div>
    );
  }

  return (
    <div className={`shop-boon-slot ${!boon ? 'shop-boon-slot--empty' : ''}`}>
      <div className="shop-boon-slot__header">
        <span className="shop-boon-slot__icon">{boon?.icon ?? '—'}</span>
        <span className="shop-boon-slot__name">{boon ? boon.name : 'Empty'}</span>
        <span className="shop-boon-slot__level-badge">Lv{level}</span>
      </div>

      {boon ? (
        <>
          <div className="shop-boon-slot__desc">{boon.description(level)}</div>
          {boon.tradeOff && <div className="shop-boon-slot__tradeoff">⚠ {boon.tradeOff}</div>}
        </>
      ) : (
        <div className="shop-boon-slot__empty-text">No boon slotted — buy one from Wares.</div>
      )}

      <div className="shop-boon-slot__pips">
        {Array.from({ length: MAX_BOON_LEVEL }).map((_, i) => (
          <div key={i} className={`shop-boon-pip ${i < level ? 'shop-boon-pip--filled' : ''}`} />
        ))}
      </div>

      <div className="shop-boon-slot__actions">
        {maxed ? (
          <span className="shop-boon-slot__max-badge">MAX</span>
        ) : (
          <>
            <span className="shop-boon-slot__upgrade-cost">{cost}g</span>
            <PillBtn
              label="↑ Level"
              onClick={() => onUpgrade(slotIndex)}
              disabled={!canAffordUpg}
              color="#f0c040"
              small
            />
          </>
        )}
        {boon && (
          confirm ? (
            <div className="shop-owned-pill__confirm">
              <PillBtn label={`+${Math.ceil(boon.cost * 0.5)}g`} onClick={() => { setConfirm(false); onSell(slotIndex); }} color="#ef4444" small />
              <PillBtn label="Keep" onClick={() => setConfirm(false)} color="#5a4010" small />
            </div>
          ) : (
            <PillBtn label="Sell" onClick={() => setConfirm(true)} color="#5a4010" small />
          )
        )}
      </div>
    </div>
  );
}

// ============================================================
// [🧱 BLOCK: Healing Section]
// ============================================================
function HealingSection({ player, gold, floor, onHeal }: {
  player: Player; gold: number; floor: number; onHeal: (newGold: number) => void;
}) {
  const atFullHp = player.hp >= player.maxHp;
  const hpPct    = Math.round((player.hp / player.maxHp) * 100);

  return (
    <div className="shop-healing">
      <div className="shop-healing__header">
        <span className="shop-section__label">⚕ Healing Arts</span>
        <span className="shop-healing__hp-badge">
          ❤ {Math.round(player.hp)} / {player.maxHp}
        </span>
      </div>
      <div className="shop-healing__bar-track">
        <div
          className="shop-healing__bar-fill"
          style={{ width: `${hpPct}%`, background: hpPct > 50 ? "#4ade80" : hpPct > 25 ? "#facc15" : "#ef4444" }}
        />
      </div>
      {atFullHp ? (
        <p className="shop-healing__full-msg">"Your wounds are mended."</p>
      ) : (
        <div className="shop-healing__tiers">
          {HEAL_TIERS.map((tier) => {
            const cost      = tier.baseCost * floor;
            const healAmt   = Math.min(tier.hp, player.maxHp - player.hp);
            const canAfford = gold >= cost;
            const disabled  = !canAfford || healAmt <= 0;
            return (
              <div key={tier.label} className="shop-healing__tier">
                <div className="shop-healing__tier-info">
                  <span className="shop-healing__tier-icon">{tier.icon}</span>
                  <div>
                    <p className="shop-healing__tier-label">{tier.label}</p>
                    <p className="shop-healing__tier-sub">+{healAmt} · {cost}g</p>
                  </div>
                </div>
                <PillBtn
                  label={canAfford ? `+${healAmt}` : "Need gold"}
                  onClick={() => { player.hp = Math.min(player.maxHp, player.hp + tier.hp); onHeal(gold - cost); }}
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
// 4-Column layout — 1440×700 panel, no scroll.
//   Col 1 — Attributes (stat allocation)
//   Col 2 — Wares (5 boon+weapon cards) + Healing
//   Col 3 — Weapon + Boon Slots
//   Col 4 — Provisions (buy & upgrade potions/scrolls)
// ============================================================
export default function Shop({
  floor, room, gold, playerStats, player,
  playerConsumables,
  isMidRoom, nearbyWeaponDrop,
  onGoldChange, onContinue, onClose,
}: ShopProps) {
  const [, forceUpdate] = useState(0);
  const refresh = useCallback(() => forceUpdate((n) => n + 1), []);

  // Pending boon purchase — set when Acquire is clicked on a boon
  // offer while all 5 slots are full. Player then clicks a slot
  // in the Boon Slots column to confirm the replacement.
  const [pendingBoonPurchase, setPendingBoonPurchase] =
    useState<Extract<ShopItem, { kind: 'boon' }> | null>(null);

  // Generate shop options once on mount
  const shopInitRef = useRef(false);
  if (!shopInitRef.current) {
    playerStats.generateShopOptions(floor);
    shopInitRef.current = true;
  }

  const handleStatSpend  = (ng: number) => { onGoldChange(ng); refresh(); };
  const handleReroll     = () => { onGoldChange(playerStats.reroll(gold, floor)); refresh(); };
  const handleSellWeapon = () => { onGoldChange(playerStats.unequipWeapon(gold, player)); refresh(); };
  const handleHeal       = (ng: number) => { onGoldChange(ng); refresh(); };
  const handleConsumableBuy = (ng: number) => { onGoldChange(ng); refresh(); };
  const handleConsumableUpgrade = (ng: number) => { onGoldChange(ng); refresh(); };

  const handleBuyWeapon = (item: WeaponItem) => {
    onGoldChange(playerStats.equipWeapon(item, gold, player));
    refresh();
  };

  const handleBuyBoon = (item: Extract<ShopItem, { kind: 'boon' }>) => {
    if (playerStats.boons.filledCount >= BOON_SLOT_COUNT) {
      setPendingBoonPurchase(item);
      return;
    }
    const emptyIdx = playerStats.boons.slots.findIndex((s) => !s.boonId);
    onGoldChange(playerStats.equipBoon(item.id, emptyIdx, gold, player));
    refresh();
  };

  const handlePickSlot = (slotIndex: number) => {
    if (!pendingBoonPurchase) return;
    onGoldChange(playerStats.equipBoon(pendingBoonPurchase.id, slotIndex, gold, player));
    setPendingBoonPurchase(null);
    refresh();
  };

  const handleSellBoon = (slotIndex: number) => {
    onGoldChange(playerStats.sellBoon(slotIndex, gold, player));
    refresh();
  };

  const handleUpgradeBoonSlot = (slotIndex: number) => {
    onGoldChange(playerStats.upgradeBoonSlot(slotIndex, gold, player));
    refresh();
  };

  const cap            = statCap(floor);
  const nextRerollCost = playerStats.rerollCost;

  return (
    <div className="shop-backdrop">
      <div className="shop-panel">
        <div className="shop-panel-inner">

          {/* ── Header ── */}
          <div className="shop-header">
            <div>
              <p className="shop-header__eyebrow">
                {isMidRoom ? `Floor ${floor} · Room ${room}` : `Floor ${floor} · Before the Boss`}
              </p>
              <p className="shop-header__title">The Merchant</p>
            </div>
            <div className="shop-header__gold">
              <p className="shop-header__gold-label">Treasury</p>
              <p className="shop-header__gold-value">{gold}g</p>
            </div>
          </div>

          {/* ── 4-Column Body ── */}
          <div className="shop-body">

            {/* ── Column 1: Attributes ── */}
            <div className="shop-col shop-col--attributes">
              <p className="shop-section__label">Attributes · Cap {cap}/10</p>
              <div className="shop-col__box shop-col__box--grow">
                {STAT_DEFS.map((def) => (
                  <StatRow
                    key={def.key} statKey={def.key}
                    playerStats={playerStats} player={player}
                    gold={gold} floor={floor} onSpend={handleStatSpend}
                  />
                ))}
              </div>
            </div>

            {/* ── Column 2: Wares + Healing ── */}
            <div className="shop-col shop-col--wares">
              <div>
                <div className="shop-wares__header">
                  <p className="shop-section__label">Wares</p>
                  <PillBtn
                    label={`Reroll ${nextRerollCost}g`}
                    onClick={handleReroll}
                    disabled={gold < nextRerollCost}
                    color="#5a4010"
                    small
                  />
                </div>
                <div className="shop-col__box">
                  <div className="shop-items-row">
                    {playerStats.shopOptions.map((item, i) => (
                      <ShopItemCard
                        key={`${item.id}-${i}`}
                        item={item} gold={gold}
                        playerStats={playerStats}
                        onBuyWeapon={handleBuyWeapon}
                        onBuyBoon={handleBuyBoon}
                      />
                    ))}
                    {playerStats.shopOptions.length === 0 && (
                      <p className="shop-empty-msg">"My stores are bare, traveller."</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="shop-col__box shop-col__box--grow">
                <HealingSection player={player} gold={gold} floor={floor} onHeal={handleHeal} />
              </div>
            </div>

            {/* ── Column 3: Weapon + Boon Slots ── */}
            <div className="shop-col shop-col--gear">
              <p className="shop-section__label">Arsenal</p>
              <div className="shop-col__box shop-col__box--grow shop-col__box--boon-scroll">

                <p className="shop-gear__sublabel">Weapon</p>
                {playerStats.equippedWeaponItem ? (
                  <EquippedWeaponPill item={playerStats.equippedWeaponItem} onSell={handleSellWeapon} />
                ) : (
                  <p className="shop-none-msg">"Bare fists — seek steel."</p>
                )}
                {nearbyWeaponDrop && (
                  <div className="shop-nearby-weapon">
                    <span className="shop-nearby-weapon__label">Nearby</span>
                    <span className="shop-nearby-weapon__name">{nearbyWeaponDrop.icon} {nearbyWeaponDrop.name}</span>
                  </div>
                )}

                <p className="shop-gear__sublabel" style={{ marginTop: 12 }}>
                  Boons ({playerStats.boons.filledCount}/{BOON_SLOT_COUNT})
                </p>

                {pendingBoonPurchase && (
                  <div className="shop-boon-picker-banner">
                    <span className="shop-boon-picker-banner__text">
                      Choose a slot to replace with {pendingBoonPurchase.name}
                    </span>
                    <PillBtn label="Cancel" onClick={() => setPendingBoonPurchase(null)} color="#5a4010" small />
                  </div>
                )}

                {Array.from({ length: BOON_SLOT_COUNT }).map((_, i) => (
                  <BoonSlotCard
                    key={i}
                    slotIndex={i}
                    playerStats={playerStats}
                    gold={gold}
                    player={player}
                    picking={!!pendingBoonPurchase}
                    onPickSlot={handlePickSlot}
                    onSell={handleSellBoon}
                    onUpgrade={handleUpgradeBoonSlot}
                  />
                ))}
              </div>
            </div>

            {/* ── Column 4: Provisions ── */}
            <div className="shop-col shop-col--provisions">
              <p className="shop-section__label">Provisions · Buy &amp; Upgrade</p>
              <div className="shop-col__box shop-col__box--grow shop-col__box--provisions-scroll">
                <p className="shop-gear__sublabel">Potions</p>
                {POTION_POOL.map((def) => (
                  <ConsumableShopRow
                    key={def.id}
                    def={def}
                    gold={gold}
                    playerConsumables={playerConsumables}
                    onBuy={handleConsumableBuy}
                    onUpgrade={handleConsumableUpgrade}
                  />
                ))}
                <p className="shop-gear__sublabel" style={{ marginTop: 8 }}>Scrolls</p>
                {SCROLL_POOL.map((def) => (
                  <ConsumableShopRow
                    key={def.id}
                    def={def}
                    gold={gold}
                    playerConsumables={playerConsumables}
                    onBuy={handleConsumableBuy}
                    onUpgrade={handleConsumableUpgrade}
                  />
                ))}
              </div>
            </div>

          </div>

          {/* ── Footer ── */}
          <div className="shop-footer">
            {isMidRoom ? (
              <PillBtn label="Farewell, Merchant" onClick={onClose} color="#5a4010" />
            ) : (
              <PillBtn label="▶ Enter the Boss Chamber" onClick={onContinue} color="#f0c040" />
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
