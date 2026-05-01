// src/components/Shop.tsx
"use client";

import React, { useState, useCallback, useRef } from "react";
import { PlayerStats, STAT_DEFS, StatKey, statCost, statCap } from "@/engine/PlayerStats";
import { Player }     from "@/engine/Player";
import { Charm }      from "@/engine/CharmRegistry";
import { WeaponItem, ArmorItem, ArmorSlot } from "@/engine/items/types";
import { ShopItem }   from "@/engine/items/ItemPool";
import { getWeaponPassive } from "@/engine/WeaponPassiveRegistry";
import {
  ConsumableDef, POTION_POOL, SCROLL_POOL,
  MAX_CONSUMABLE_LEVEL, getUpgradeCost,
} from "@/engine/ConsumableRegistry";
import { PlayerConsumables } from "@/engine/PlayerConsumables";
import { getShopConsumableOptions } from "@/engine/items/ItemPool";
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
// [🧱 BLOCK: Armor Slot Labels]
// ============================================================
const ARMOR_SLOT_LABELS: Record<ArmorSlot, string> = {
  helmet:   'Helmet',
  armor:    'Armor',
  leggings: 'Leggings',
  gloves:   'Gloves',
  boots:    'Boots',
};

const ARMOR_SLOTS: ArmorSlot[] = ['helmet', 'armor', 'leggings', 'gloves', 'boots'];

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
// ============================================================
function ShopItemCard({ item, gold, playerStats, player, onBuy }: {
  item: ShopItem; gold: number;
  playerStats: PlayerStats; player: Player;
  onBuy: (newGold: number) => void;
}) {
  const isWeapon = item.kind === "weapon";
  const isArmor  = item.kind === "armor";
  const isCharm  = item.kind === "charm";

  const weaponItem = isWeapon ? (item as WeaponItem) : null;
  const armorItem  = isArmor  ? (item as ArmorItem)  : null;
  const charmItem  = isCharm  ? (item as Charm & { kind: "charm" }) : null;

  const alreadyOwned = isWeapon
    ? playerStats.equippedWeaponItem?.id === weaponItem!.id
    : isArmor
    ? playerStats.armorSlots[armorItem!.slot]?.id === armorItem!.id
    : playerStats.hasCharm(charmItem!.id);

  const charmsFull = isCharm && playerStats.charms.length >= playerStats.maxCharms;
  const canAfford  = gold >= item.cost;
  const canBuy     = !alreadyOwned && canAfford && !charmsFull;

  const accentColor = isWeapon ? "#60a5fa" : isArmor ? "#4ade80" : "#f0c040";
  const typeLabel   = isWeapon
    ? `${weaponItem!.weaponType.toUpperCase()} · WPN`
    : isArmor
    ? `${ARMOR_SLOT_LABELS[armorItem!.slot].toUpperCase()} · ARM`
    : "CHARM";

  const existingArmor = isArmor ? playerStats.armorSlots[armorItem!.slot] : null;

  function handleBuy() {
    if (!canBuy) return;
    let newGold: number;
    if (isWeapon)     newGold = playerStats.equipWeapon(weaponItem!, gold, player);
    else if (isArmor) newGold = playerStats.equipArmor(armorItem!, gold, player);
    else              newGold = playerStats.buyCharm(charmItem!, gold, player);
    onBuy(newGold);
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
      {isArmor && (
        <div className="shop-item-card__armor-slot">
          {armorItem!.setName}
        </div>
      )}
      {(isCharm && item.tradeOff) && <div className="shop-item-card__tradeoff">⚠ {item.tradeOff}</div>}
      {existingArmor && !alreadyOwned && (
        <div className="shop-item-card__replace-warn">Replaces {existingArmor.name}</div>
      )}
      <div className="shop-item-card__footer">
        <span className="shop-item-card__cost">{item.cost}g</span>
        {charmsFull && <span className="shop-item-card__full-warning">Full</span>}
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
// Shows: icon | name+desc | kind badge | stack count | buy btn
//        level pips (●●●○○) | upgrade cost | upgrade btn
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

  // ── Upgrade state ──────────────────────────────────────────
  const currentLevel  = playerConsumables.getLevel(def.id);
  const isMaxLevel    = currentLevel >= MAX_CONSUMABLE_LEVEL;
  const upgradeCost   = isMaxLevel ? 0 : playerConsumables.getUpgradeCost(def);
  const canAffordUpg  = !isMaxLevel && gold >= upgradeCost;

  // Level description shown next to pips
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
      {/* ── Top row: icon | info | kind | count | buy ── */}
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

      {/* ── Bottom row: level pips + current stat + upgrade btn ── */}
      <div className="shop-consumable-row__upgrade-row">
        {/* Level pips */}
        <div className="shop-consumable-row__level-pips">
          {Array.from({ length: MAX_CONSUMABLE_LEVEL }).map((_, i) => (
            <div
              key={i}
              className={`shop-consumable-pip ${i < currentLevel ? 'shop-consumable-pip--filled' : ''}`}
              style={i < currentLevel ? { background: accentColor, borderColor: accentColor } : undefined}
            />
          ))}
        </div>

        {/* Current level stat */}
        <span className="shop-consumable-row__level-stat" style={{ color: accentColor }}>
          {currentDesc}
        </span>

        {/* Arrow + next level preview */}
        {!isMaxLevel && (
          <>
            <span className="shop-consumable-row__upgrade-arrow">→</span>
            <span className="shop-consumable-row__next-stat">{nextDesc}</span>
          </>
        )}

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Upgrade button */}
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
// [🧱 BLOCK: Equipped Armor Pill]
// ============================================================
function EquippedArmorPill({ slot, item, onSell }: {
  slot:  ArmorSlot;
  item:  ArmorItem | null;
  onSell: () => void;
}) {
  const [confirm, setConfirm] = useState(false);
  const label = ARMOR_SLOT_LABELS[slot];

  if (!item) {
    return (
      <div className="shop-owned-pill shop-owned-pill--armor shop-owned-pill--empty">
        <span className="shop-owned-pill__slot-label">{label}</span>
        <span className="shop-owned-pill__empty-text">— Empty</span>
      </div>
    );
  }

  const refund = Math.ceil(item.cost * 0.5);
  return (
    <div className="shop-owned-pill shop-owned-pill--armor">
      <span className="shop-owned-pill__icon">{item.icon}</span>
      <div className="shop-owned-pill__weapon-info">
        <div className="shop-owned-pill__name">{item.name}</div>
        <div className="shop-owned-pill__weapon-sub">{item.setName} · {item.description}</div>
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
//   Col 2 — Wares (5 item cards horizontal + reroll) + Healing
//   Col 3 — Equipped Gear (weapon + armor slots + charms)
//   Col 4 — Provisions (buy + upgrade potions/scrolls)
// ============================================================
export default function Shop({
  floor, room, gold, playerStats, player,
  playerConsumables,
  isMidRoom,
  onGoldChange, onContinue, onClose,
}: ShopProps) {
  const [, forceUpdate] = useState(0);
  const refresh = useCallback(() => forceUpdate((n) => n + 1), []);

  // Generate shop options once on mount
  const shopInitRef = useRef(false);
  if (!shopInitRef.current) {
    playerStats.generateShopOptions(floor);
    shopInitRef.current = true;
  }

  const handleStatSpend  = (ng: number) => { onGoldChange(ng); refresh(); };
  const handleBuy        = (ng: number) => { onGoldChange(ng); refresh(); };
  const handleReroll     = () => { onGoldChange(playerStats.reroll(gold, floor)); refresh(); };
  const handleSellCharm  = (id: string) => { onGoldChange(playerStats.sellCharm(id, gold, player)); refresh(); };
  const handleSellWeapon = () => { onGoldChange(playerStats.unequipWeapon(gold, player)); refresh(); };
  const handleSellArmor  = (slot: ArmorSlot) => { onGoldChange(playerStats.sellArmor(slot, gold, player)); refresh(); };
  const handleHeal       = (ng: number) => { onGoldChange(ng); refresh(); };
  const handleConsumableBuy = (ng: number) => { onGoldChange(ng); refresh(); };
  const handleConsumableUpgrade = (ng: number) => { onGoldChange(ng); refresh(); };

  const cap            = statCap(floor);
  const nextRerollCost = playerStats.rerollCost;
  const atRerollCap    = nextRerollCost >= 100;

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
                    label={atRerollCap ? `Reroll ${nextRerollCost}g · max` : `Reroll ${nextRerollCost}g`}
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
                        item={item as ShopItem} gold={gold}
                        playerStats={playerStats} player={player}
                        onBuy={handleBuy}
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

            {/* ── Column 3: Equipped Gear ── */}
            <div className="shop-col shop-col--gear">
              <p className="shop-section__label">Equipped Gear</p>
              <div className="shop-col__box shop-col__box--grow shop-col__box--gear-scroll">

                <p className="shop-gear__sublabel">Weapon</p>
                {playerStats.equippedWeaponItem ? (
                  <EquippedWeaponPill item={playerStats.equippedWeaponItem} onSell={handleSellWeapon} />
                ) : (
                  <p className="shop-none-msg">"Bare fists — seek steel."</p>
                )}

                <p className="shop-gear__sublabel" style={{ marginTop: 10 }}>Armor</p>
                {ARMOR_SLOTS.map((slot) => (
                  <EquippedArmorPill
                    key={slot}
                    slot={slot}
                    item={playerStats.armorSlots[slot]}
                    onSell={() => handleSellArmor(slot)}
                  />
                ))}

                <p className="shop-gear__sublabel" style={{ marginTop: 10 }}>
                  Charms ({playerStats.charms.length}/{playerStats.maxCharms})
                </p>
                {playerStats.charms.length === 0 ? (
                  <p className="shop-none-msg">"No charms equipped."</p>
                ) : (
                  <div className="shop-charms-list">
                    {playerStats.charms.map((charm) => (
                      <OwnedCharmPill key={charm.id} charm={charm} onSell={() => handleSellCharm(charm.id)} />
                    ))}
                  </div>
                )}
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