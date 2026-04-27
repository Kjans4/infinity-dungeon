// src/components/Shop.tsx
"use client";

import React, { useState, useCallback, useRef } from "react";
import { PlayerStats, STAT_DEFS, StatKey, statCost, statCap } from "@/engine/PlayerStats";
import { Player }     from "@/engine/Player";
import { Charm }      from "@/engine/CharmRegistry";
import { WeaponItem, ArmorItem } from "@/engine/items/types";
import { ShopItem }   from "@/engine/items/ItemPool";
import { getWeaponPassive } from "@/engine/WeaponPassiveRegistry";
import "@/styles/shop.css";

// ============================================================
// [🧱 BLOCK: Props]
// ============================================================
interface ShopProps {
  floor:        number;
  room:         number;
  gold:         number;
  playerStats:  PlayerStats;
  player:       Player;
  isMidRoom:    boolean;
  onGoldChange: (newGold: number) => void;
  onContinue:   () => void;
  onClose:      () => void;
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
// [🧱 BLOCK: Shop Item Card]
// Shorter card — no flex-grow, fixed compact height.
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
    ? `${weaponItem!.weaponType.toUpperCase()} · Weapon`
    : isArmor
    ? `${armorItem!.setName} · Armor`
    : "Charm";

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
            {p.tradeOff && <span className="shop-item-card__tradeoff">⚠ {p.tradeOff}</span>}
          </div>
        ) : null;
      })()}
      {isArmor && (
        <div className="shop-item-card__armor-slot">
          Slot: {armorItem!.slot} · {armorItem!.setName}
        </div>
      )}
      {isCharm && item.tradeOff && <div className="shop-item-card__tradeoff">⚠ {item.tradeOff}</div>}
      {existingArmor && !alreadyOwned && (
        <div className="shop-item-card__replace-warn">Replaces {existingArmor.name}</div>
      )}
      <div className="shop-item-card__footer">
        <span className="shop-item-card__cost">{item.cost}g</span>
        {charmsFull && <span className="shop-item-card__full-warning">Sell a charm first</span>}
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
        <div className="shop-owned-pill__weapon-sub">{item.weaponType} · {item.description}</div>
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
// [🧱 BLOCK: Healing Section — Column 3]
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
        <p className="shop-healing__full-msg">"Your wounds are mended, warrior."</p>
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
// Fixed 1020×640 panel. Three columns, no scroll.
//   Col 1 — Attributes (stat allocation)
//   Col 2 — Wares (3 item cards + reroll)
//   Col 3 — Healing / Equipped Weapon / Charms
// ============================================================
export default function Shop({
  floor, room, gold, playerStats, player,
  isMidRoom,
  onGoldChange, onContinue, onClose,
}: ShopProps) {
  const [, forceUpdate] = useState(0);
  const refresh = useCallback(() => forceUpdate((n) => n + 1), []);

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
  const handleHeal       = (ng: number) => { onGoldChange(ng); refresh(); };

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

          {/* ── 3-Column Body ── */}
          <div className="shop-body">

            {/* ── Column 1: Attributes ── */}
            <div className="shop-col">
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

            {/* ── Column 2: Wares ── */}
            <div className="shop-col">
              <div className="shop-wares__header">
                <p className="shop-section__label">Wares</p>
                <PillBtn
                  label={atRerollCap ? `Reroll ${nextRerollCost}g ·max` : `Reroll ${nextRerollCost}g`}
                  onClick={handleReroll}
                  disabled={gold < nextRerollCost}
                  color="#5a4010"
                  small
                />
              </div>
              <div className="shop-col__box shop-col__box--grow">
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

            {/* ── Column 3: Healing / Weapon / Charms ── */}
            <div className="shop-col">

              {/* Healing */}
              <div className="shop-col__box">
                <HealingSection player={player} gold={gold} floor={floor} onHeal={handleHeal} />
              </div>

              {/* Equipped Weapon */}
              <div className="shop-col__box">
                <p className="shop-section__label">Equipped Weapon</p>
                {playerStats.equippedWeaponItem ? (
                  <EquippedWeaponPill item={playerStats.equippedWeaponItem} onSell={handleSellWeapon} />
                ) : (
                  <p className="shop-none-msg">"Bare fists — seek steel."</p>
                )}
              </div>

              {/* Charms */}
              <div className="shop-col__box shop-col__box--grow">
                <p className="shop-section__label">
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