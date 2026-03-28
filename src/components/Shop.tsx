// src/components/Shop.tsx
"use client";

import React, { useState, useCallback } from "react";
import { PlayerStats, STAT_DEFS, StatKey, statCost, statCap } from "@/engine/PlayerStats";
import { Player } from "@/engine/Player";
import { Charm } from "@/engine/CharmRegistry";
import { WeaponItem } from "@/engine/items/types";
import { ShopItem } from "@/engine/items/ItemPool";

interface ShopProps {
  floor:       number;
  room:        number;
  gold:        number;
  playerStats: PlayerStats;
  player:      Player;
  onGoldChange:(newGold: number) => void;
  onContinue:  () => void;
}

// ============================================================
// [🧱 BLOCK: Shared Button]
// ============================================================
function PillBtn({ label, onClick, disabled, color = "#facc15", small = false }: {
  label: string; onClick: () => void;
  disabled?: boolean; color?: string; small?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick} disabled={disabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        fontFamily: "'Courier New', monospace",
        fontSize: small ? 10 : 12, fontWeight: 700,
        letterSpacing: "0.1em", textTransform: "uppercase",
        color:           disabled ? "#334155" : hovered ? "#0f172a" : color,
        backgroundColor: disabled ? "#1e293b" : hovered ? color : "transparent",
        border:          `1px solid ${disabled ? "#1e293b" : color}`,
        padding: small ? "4px 10px" : "8px 18px",
        borderRadius: 4, cursor: disabled ? "not-allowed" : "pointer",
        transition: "all 0.12s ease", whiteSpace: "nowrap" as const,
      }}
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
    <div style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 0", borderBottom:"1px solid rgba(255,255,255,0.04)" }}>
      <span style={{ fontSize:16, width:24 }}>{def.icon}</span>
      <div style={{ flex:1 }}>
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:3 }}>
          <span style={{ fontSize:11, fontWeight:700, color:"#f1f5f9", letterSpacing:"0.1em" }}>{def.label}</span>
          <span style={{ fontSize:9, color:"#475569" }}>{def.description}</span>
        </div>
        <div style={{ display:"flex", gap:3 }}>
          {Array.from({ length: cap }).map((_, i) => (
            <div key={i} style={{ width:10, height:4, borderRadius:2,
              backgroundColor: i < level ? "#facc15" : "#1e293b",
              boxShadow: i < level ? "0 0 4px #facc15" : "none" }} />
          ))}
        </div>
      </div>
      <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:3 }}>
        {!maxed && <span style={{ fontSize:9, color:"#64748b" }}>💰 {cost}g</span>}
        <PillBtn label={maxed ? "MAX" : "+1"} onClick={() => {
          const ng = playerStats.upgradeStat(statKey, gold, floor);
          playerStats.applyToPlayer(player);
          onSpend(ng);
        }} disabled={!canBuy || maxed} color="#facc15" small />
      </div>
    </div>
  );
}

// ============================================================
// [🧱 BLOCK: Shop Item Card — handles both weapons and charms]
// ============================================================
function ShopItemCard({ item, gold, playerStats, player, onBuy }: {
  item: ShopItem; gold: number;
  playerStats: PlayerStats; player: Player;
  onBuy: (newGold: number) => void;
}) {
  const isWeapon  = item.kind === 'weapon';
  const weaponItem = isWeapon ? (item as WeaponItem) : null;
  const charmItem  = !isWeapon ? (item as Charm & { kind: 'charm' }) : null;

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
    let newGold = gold;
    if (isWeapon) {
      newGold = playerStats.equipWeapon(weaponItem!, gold, player);
    } else {
      newGold = playerStats.buyCharm(charmItem!, gold, player);
    }
    onBuy(newGold);
  }

  return (
    <div style={{
      background: "rgba(255,255,255,0.03)",
      border: `1px solid ${alreadyOwned ? "rgba(74,222,128,0.3)" : "rgba(255,255,255,0.07)"}`,
      borderRadius: 8, padding: 12,
      display: "flex", flexDirection: "column", gap: 6,
      minWidth: 150, flex: 1,
    }}>
      <div style={{ fontSize: 24, textAlign: "center" }}>{item.icon}</div>
      <div style={{ fontSize: 9, color: accentColor, textAlign: "center",
        letterSpacing: "0.15em", textTransform: "uppercase" }}>
        {typeLabel}
      </div>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#f1f5f9", textAlign: "center" }}>
        {item.name}
      </div>
      <div style={{ fontSize: 9, color: "#64748b", textAlign: "center", lineHeight: 1.4 }}>
        {item.description}
      </div>
      {item.tradeOff && (
        <div style={{ fontSize: 9, color: "#ef4444", textAlign: "center" }}>⚠ {item.tradeOff}</div>
      )}
      <div style={{ fontSize: 10, color: "#facc15", textAlign: "center" }}>
        💰 {item.cost}g
      </div>
      {charmsFull && !isWeapon && (
        <div style={{ fontSize: 8, color: "#ef4444", textAlign: "center" }}>Sell a charm first</div>
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
    <div style={{ display:"flex", alignItems:"center", gap:8,
      background:"rgba(250,204,21,0.06)", border:"1px solid rgba(250,204,21,0.15)",
      borderRadius:6, padding:"6px 10px" }}>
      <span style={{ fontSize:16 }}>{charm.icon}</span>
      <span style={{ fontSize:10, color:"#f1f5f9", flex:1 }}>{charm.name}</span>
      {confirm ? (
        <div style={{ display:"flex", gap:4 }}>
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
    <div style={{ display:"flex", alignItems:"center", gap:8,
      background:"rgba(56,189,248,0.06)", border:"1px solid rgba(56,189,248,0.2)",
      borderRadius:6, padding:"6px 10px" }}>
      <span style={{ fontSize:16 }}>{item.icon}</span>
      <div style={{ flex:1 }}>
        <div style={{ fontSize:10, fontWeight:700, color:"#f1f5f9" }}>{item.name}</div>
        <div style={{ fontSize:9, color:"#64748b" }}>{item.weaponType} · {item.description}</div>
      </div>
      {confirm ? (
        <div style={{ display:"flex", gap:4 }}>
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
// [🧱 BLOCK: Shop Main]
// ============================================================
export default function Shop({ floor, room, gold, playerStats, player, onGoldChange, onContinue }: ShopProps) {
  const [, forceUpdate] = useState(0);
  const refresh = useCallback(() => forceUpdate((n) => n + 1), []);

  const [optionsReady, setOptionsReady] = useState(false);
  if (!optionsReady) {
    playerStats.generateShopOptions();
    setOptionsReady(true);
  }

  const handleStatSpend = (newGold: number) => { onGoldChange(newGold); refresh(); };
  const handleBuy       = (newGold: number) => { onGoldChange(newGold); refresh(); };
  const handleReroll    = () => { onGoldChange(playerStats.reroll(gold)); refresh(); };

  const handleSellCharm = (charmId: string) => {
    const ng = playerStats.sellCharm(charmId, gold, player);
    onGoldChange(ng); refresh();
  };

  const handleSellWeapon = () => {
    const ng = playerStats.unequipWeapon(gold, player);
    onGoldChange(ng); refresh();
  };

  const cap = statCap(floor);

  return (
    <div style={{ position:"fixed", inset:0, zIndex:40,
      display:"flex", alignItems:"center", justifyContent:"center",
      background:"rgba(0,0,0,0.92)", fontFamily:"'Courier New', monospace", padding:20 }}>
      <div style={{ width:"min(900px,100%)", maxHeight:"90vh", overflowY:"auto",
        display:"flex", flexDirection:"column", gap:20 }}>

        {/* Header */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            <p style={{ fontSize:9, color:"#475569", letterSpacing:"0.2em",
              textTransform:"uppercase", marginBottom:4 }}>
              Floor {floor} · Before Room {room}
            </p>
            <p style={{ fontSize:28, fontWeight:900, color:"#facc15", textShadow:"0 0 30px #facc15" }}>
              SHOP
            </p>
          </div>
          <div style={{ textAlign:"right" }}>
            <p style={{ fontSize:9, color:"#475569", marginBottom:2 }}>Your Gold</p>
            <p style={{ fontSize:24, fontWeight:900, color:"#facc15" }}>💰 {gold}g</p>
          </div>
        </div>

        {/* Main panels */}
        <div style={{ display:"flex", gap:20, flexWrap:"wrap" as const }}>

          {/* Stat allocation */}
          <div style={{ flex:1, minWidth:260, background:"rgba(255,255,255,0.02)",
            border:"1px solid rgba(255,255,255,0.06)", borderRadius:10, padding:16 }}>
            <p style={{ fontSize:10, color:"#64748b", letterSpacing:"0.15em",
              textTransform:"uppercase", marginBottom:12 }}>
              Stat Allocation · Cap {cap}/10
            </p>
            {STAT_DEFS.map((def) => (
              <StatRow key={def.key} statKey={def.key}
                playerStats={playerStats} player={player}
                gold={gold} floor={floor} onSpend={handleStatSpend} />
            ))}
          </div>

          {/* Shop items + inventory */}
          <div style={{ flex:1, minWidth:320, display:"flex", flexDirection:"column", gap:12 }}>

            {/* 3 random shop slots */}
            <div style={{ background:"rgba(255,255,255,0.02)",
              border:"1px solid rgba(255,255,255,0.06)", borderRadius:10, padding:16 }}>
              <div style={{ display:"flex", justifyContent:"space-between",
                alignItems:"center", marginBottom:12 }}>
                <p style={{ fontSize:10, color:"#64748b", letterSpacing:"0.15em",
                  textTransform:"uppercase" }}>
                  Items
                </p>
                <PillBtn label={`Reroll 💰${playerStats.rerollCost}g`}
                  onClick={handleReroll}
                  disabled={gold < playerStats.rerollCost}
                  color="#64748b" small />
              </div>

              <div style={{ display:"flex", gap:10 }}>
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
                  <p style={{ fontSize:11, color:"#334155", padding:20 }}>
                    Nothing available.
                  </p>
                )}
              </div>
            </div>

            {/* Equipped weapon */}
            <div style={{ background:"rgba(255,255,255,0.02)",
              border:"1px solid rgba(255,255,255,0.06)", borderRadius:10, padding:16 }}>
              <p style={{ fontSize:10, color:"#64748b", letterSpacing:"0.15em",
                textTransform:"uppercase", marginBottom:10 }}>
                Equipped Weapon
              </p>
              {playerStats.equippedWeaponItem ? (
                <EquippedWeaponPill
                  item={playerStats.equippedWeaponItem}
                  onSell={handleSellWeapon}
                />
              ) : (
                <p style={{ fontSize:11, color:"#334155" }}>👊 Bare Fists</p>
              )}
            </div>

            {/* Owned charms */}
            <div style={{ background:"rgba(255,255,255,0.02)",
              border:"1px solid rgba(255,255,255,0.06)", borderRadius:10, padding:16 }}>
              <p style={{ fontSize:10, color:"#64748b", letterSpacing:"0.15em",
                textTransform:"uppercase", marginBottom:10 }}>
                Charms ({playerStats.charms.length}/{playerStats.maxCharms})
              </p>
              {playerStats.charms.length === 0 ? (
                <p style={{ fontSize:11, color:"#334155" }}>No charms equipped.</p>
              ) : (
                <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                  {playerStats.charms.map((charm) => (
                    <OwnedCharmPill key={charm.id} charm={charm}
                      onSell={() => handleSellCharm(charm.id)} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Continue */}
        <div style={{ display:"flex", justifyContent:"center", paddingTop:8 }}>
          <PillBtn label="▶ Enter Boss Room" onClick={onContinue} color="#facc15" />
        </div>
      </div>
    </div>
  );
}