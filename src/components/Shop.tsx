// src/components/Shop.tsx
"use client";

import React, { useState, useCallback, useRef } from "react";
import { PlayerStats, STAT_DEFS, StatKey, statCost, statCap } from "@/engine/PlayerStats";
import { Player }     from "@/engine/Player";
import { Charm }      from "@/engine/CharmRegistry";
import { WeaponItem } from "@/engine/items/types";
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
  pendingLoot:  ShopItem[];
  isMidRoom:    boolean;
  onGoldChange: (newGold: number) => void;
  onClaimLoot:  (item: ShopItem) => void;
  onContinue:   () => void;
  onClose:      () => void;
}

// ============================================================
// [🧱 BLOCK: Heal Tiers]
// ============================================================
const HEAL_TIERS = [
  { label: "Tincture",  hp: 25,  baseCost: 40,  icon: "🩹" },
  { label: "Draught",   hp: 50,  baseCost: 75,  icon: "💊" },
  { label: "Elixir",    hp: 999, baseCost: 120, icon: "❤️" },
];

// ============================================================
// [🧱 BLOCK: Gem Rule Divider]
// ============================================================
function GemRule() {
  return (
    <div className="shop-gem-rule">
      <div className="shop-gem-rule-gem" />
    </div>
  );
}

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
// [🧱 BLOCK: Pending Loot Card]
// ============================================================
function PendingLootCard({ item, playerStats, player, onClaim }: {
  item: ShopItem; playerStats: PlayerStats; player: Player; onClaim: () => void;
}) {
  const isWeapon    = item.kind === "weapon";
  const accentColor = isWeapon ? "#60a5fa" : "#a78bfa";
  const typeLabel   = isWeapon
    ? `${(item as WeaponItem).weaponType.toUpperCase()} · Spoil`
    : "Charm · Spoil";

  const alreadyOwned = isWeapon
    ? playerStats.equippedWeaponItem?.id === item.id
    : playerStats.hasCharm(item.id);
  const charmsFull = !isWeapon && playerStats.charms.length >= playerStats.maxCharms;
  const willReplace = isWeapon && !!playerStats.equippedWeaponItem;
  const canClaim    = !alreadyOwned && !charmsFull;

  function handleClaim() {
    if (!canClaim) return;
    if (isWeapon) playerStats.claimWeapon(item as WeaponItem, player);
    else          playerStats.claimCharm(item as Charm, player);
    onClaim();
  }

  return (
    <div className="shop-loot-card">
      <div className="shop-loot-card__badge" style={{ background: accentColor }}>FREE</div>
      <div className="shop-item-card__icon">{item.icon}</div>
      <div className="shop-item-card__type" style={{ color: accentColor }}>{typeLabel}</div>
      <div className="shop-item-card__name">{item.name}</div>
      <div className="shop-item-card__desc">{item.description}</div>
      {isWeapon && (() => {
        const p = getWeaponPassive((item as WeaponItem).weaponType);
        return p ? (
          <div className="shop-item-card__passive">
            <span className="shop-item-card__passive-label">Passive · {p.name}</span>
            <span className="shop-item-card__passive-desc">{p.description}</span>
            {p.tradeOff && <span className="shop-item-card__tradeoff">⚠ {p.tradeOff}</span>}
          </div>
        ) : null;
      })()}
      {!isWeapon && item.tradeOff && <div className="shop-item-card__tradeoff">⚠ {item.tradeOff}</div>}
      {willReplace && !alreadyOwned && (
        <div className="shop-loot-card__replace-warn">Replaces {playerStats.equippedWeaponItem?.name}</div>
      )}
      {charmsFull && !isWeapon && <div className="shop-item-card__full-warning">Sell a charm first</div>}
      {alreadyOwned && <div className="shop-item-card__full-warning">Already owned</div>}
      <PillBtn
        label={canClaim ? "Claim" : alreadyOwned ? "Owned" : "No Slots"}
        onClick={handleClaim}
        disabled={!canClaim}
        color={accentColor}
        small
      />
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
  const accentColor = isWeapon ? "#60a5fa" : "#f0c040";
  const typeLabel   = isWeapon ? `${weaponItem!.weaponType.toUpperCase()} · Weapon` : "Charm";

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
      {!isWeapon && item.tradeOff && <div className="shop-item-card__tradeoff">⚠ {item.tradeOff}</div>}
      <div className="shop-item-card__cost">{item.cost}g</div>
      {charmsFull && !isWeapon && <div className="shop-item-card__full-warning">Sell a charm first</div>}
      <PillBtn
        label={alreadyOwned ? "Owned" : "Acquire"}
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
// [🧱 BLOCK: Healing Section]
// ============================================================
function HealingSection({ player, gold, floor, onHeal }: {
  player: Player; gold: number; floor: number; onHeal: (newGold: number) => void;
}) {
  const atFullHp = player.hp >= player.maxHp;
  const hpPct    = Math.round((player.hp / player.maxHp) * 100);

  return (
    <div className="shop-section shop-healing">
      <div className="shop-healing__header">
        <p className="shop-section__label">⚕ Healing Arts</p>
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
                    <p className="shop-healing__tier-sub">+{healAmt} vitality · {cost}g</p>
                  </div>
                </div>
                <PillBtn
                  label={canAfford ? `Heal +${healAmt}` : "Insufficient gold"}
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
// ============================================================
export default function Shop({
  floor, room, gold, playerStats, player,
  pendingLoot, isMidRoom,
  onGoldChange, onClaimLoot, onContinue, onClose,
}: ShopProps) {
  const [, forceUpdate] = useState(0);
  const refresh = useCallback(() => forceUpdate((n) => n + 1), []);

  // Generate shop options exactly once per mount — using a ref avoids
  // the setState-during-render anti-pattern that caused double renders.
  const shopInitRef = useRef(false);
  if (!shopInitRef.current) {
    playerStats.generateShopOptions();
    shopInitRef.current = true;
  }

  const handleStatSpend  = (ng: number) => { onGoldChange(ng); refresh(); };
  const handleBuy        = (ng: number) => { onGoldChange(ng); refresh(); };
  const handleReroll     = () => { onGoldChange(playerStats.reroll(gold)); refresh(); };
  const handleSellCharm  = (id: string) => { onGoldChange(playerStats.sellCharm(id, gold, player)); refresh(); };
  const handleSellWeapon = () => { onGoldChange(playerStats.unequipWeapon(gold, player)); refresh(); };
  const handleHeal       = (ng: number) => { onGoldChange(ng); refresh(); };
  const handleClaim      = (item: ShopItem) => { onClaimLoot(item); refresh(); };

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

          <GemRule />

          {/* ── Pending Loot ── */}
          {pendingLoot.length > 0 && (
            <>
              <div className="shop-section shop-section--loot">
                <p className="shop-section__label">
                  ✦ Spoils of Battle — Claim for Free ({pendingLoot.length}/3)
                </p>
                <div className="shop-items-row">
                  {pendingLoot.map((item, i) => (
                    <PendingLootCard
                      key={`${item.id}-${i}`}
                      item={item} playerStats={playerStats} player={player}
                      onClaim={() => handleClaim(item)}
                    />
                  ))}
                </div>
              </div>
              <GemRule />
            </>
          )}

          {/* ── Main panels ── */}
          <div className="shop-main">

            {/* Stat allocation */}
            <div className="shop-section shop-section--stats">
              <p className="shop-section__label">Attributes · Cap {cap}/10</p>
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

              {/* Item slots */}
              <div className="shop-section">
                <div className="shop-section__items-header">
                  <p className="shop-section__label">Wares</p>
                  <PillBtn
                    label={atRerollCap ? `Reroll ${nextRerollCost}g (max)` : `Reroll ${nextRerollCost}g`}
                    onClick={handleReroll}
                    disabled={gold < nextRerollCost}
                    color="#5a4010"
                    small
                  />
                </div>
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

              {/* Equipped weapon */}
              <div className="shop-section">
                <p className="shop-section__label">Equipped Weapon</p>
                {playerStats.equippedWeaponItem ? (
                  <EquippedWeaponPill item={playerStats.equippedWeaponItem} onSell={handleSellWeapon} />
                ) : (
                  <p className="shop-none-msg">"Bare fists — seek steel."</p>
                )}
              </div>

              {/* Owned charms */}
              <div className="shop-section">
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

          <GemRule />

          {/* ── Healing ── */}
          <HealingSection player={player} gold={gold} floor={floor} onHeal={handleHeal} />

          <GemRule />

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