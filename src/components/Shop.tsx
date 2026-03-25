// src/components/Shop.tsx
"use client";

import React, { useState, useCallback } from "react";
import { PlayerStats, STAT_DEFS, StatKey, statCost, statCap } from "@/engine/PlayerStats";
import { Charm } from "@/engine/CharmRegistry";
import { Player } from "@/engine/Player";

// ============================================================
// [🧱 BLOCK: Shop Props]
// ============================================================
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
// [🧱 BLOCK: Pill Button]
// Reusable styled button.
// ============================================================
function PillBtn({
  label, onClick, disabled, color = "#facc15", small = false,
}: {
  label: string; onClick: () => void;
  disabled?: boolean; color?: string; small?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        fontFamily:      "'Courier New', monospace",
        fontSize:        small ? 10 : 12,
        fontWeight:      700,
        letterSpacing:   "0.1em",
        textTransform:   "uppercase",
        color:           disabled ? "#334155" : hovered ? "#0f172a" : color,
        backgroundColor: disabled ? "#1e293b" : hovered ? color : "transparent",
        border:          `1px solid ${disabled ? "#1e293b" : color}`,
        padding:         small ? "4px 10px" : "8px 18px",
        borderRadius:    4,
        cursor:          disabled ? "not-allowed" : "pointer",
        transition:      "all 0.12s ease",
        whiteSpace:      "nowrap" as const,
      }}
    >
      {label}
    </button>
  );
}

// ============================================================
// [🧱 BLOCK: Stat Row]
// ============================================================
function StatRow({
  statKey, playerStats, player, gold, floor, onSpend,
}: {
  statKey:     StatKey;
  playerStats: PlayerStats;
  player:      Player;
  gold:        number;
  floor:       number;
  onSpend:     (newGold: number) => void;
}) {
  const def      = STAT_DEFS.find((d) => d.key === statKey)!;
  const level    = playerStats[statKey];
  const cap      = statCap(floor);
  const cost     = statCost(level);
  const canBuy   = playerStats.canUpgrade(statKey, gold, floor);
  const maxed    = level >= cap;

  const handleBuy = () => {
    const newGold = playerStats.upgradeStat(statKey, gold, floor);
    playerStats.applyToPlayer(player);
    onSpend(newGold);
  };

  return (
    <div style={{
      display:        "flex",
      alignItems:     "center",
      gap:            10,
      padding:        "8px 0",
      borderBottom:   "1px solid rgba(255,255,255,0.04)",
    }}>
      {/* Icon + Label */}
      <span style={{ fontSize: 16, width: 24 }}>{def.icon}</span>
      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#f1f5f9", letterSpacing: "0.1em" }}>
            {def.label}
          </span>
          <span style={{ fontSize: 9, color: "#475569" }}>
            {def.description}
          </span>
        </div>
        {/* Level pips */}
        <div style={{ display: "flex", gap: 3 }}>
          {Array.from({ length: cap }).map((_, i) => (
            <div key={i} style={{
              width: 10, height: 4, borderRadius: 2,
              backgroundColor: i < level ? "#facc15" : "#1e293b",
              boxShadow: i < level ? "0 0 4px #facc15" : "none",
            }} />
          ))}
        </div>
      </div>

      {/* Cost + Buy */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3 }}>
        {!maxed && (
          <span style={{ fontSize: 9, color: "#64748b" }}>
            💰 {cost}g
          </span>
        )}
        <PillBtn
          label={maxed ? "MAX" : `+1`}
          onClick={handleBuy}
          disabled={!canBuy || maxed}
          color="#facc15"
          small
        />
      </div>
    </div>
  );
}

// ============================================================
// [🧱 BLOCK: Charm Card]
// ============================================================
function CharmCard({
  charm, canBuy, onBuy, owned,
}: {
  charm:  Charm;
  canBuy: boolean;
  onBuy:  () => void;
  owned:  boolean;
}) {
  return (
    <div style={{
      background:   "rgba(255,255,255,0.03)",
      border:       "1px solid rgba(255,255,255,0.07)",
      borderRadius: 8,
      padding:      12,
      display:      "flex",
      flexDirection:"column",
      gap:          6,
      minWidth:     150,
      flex:         1,
    }}>
      <div style={{ fontSize: 24, textAlign: "center" }}>{charm.icon}</div>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#f1f5f9", textAlign: "center" }}>
        {charm.name}
      </div>
      <div style={{ fontSize: 9, color: "#64748b", textAlign: "center", lineHeight: 1.4 }}>
        {charm.description}
      </div>
      {charm.tradeOff && (
        <div style={{ fontSize: 9, color: "#ef4444", textAlign: "center" }}>
          ⚠ {charm.tradeOff}
        </div>
      )}
      <div style={{ fontSize: 10, color: "#facc15", textAlign: "center" }}>
        💰 {charm.cost}g
      </div>
      <PillBtn
        label={owned ? "Owned" : "Buy"}
        onClick={onBuy}
        disabled={!canBuy || owned}
        color="#facc15"
        small
      />
    </div>
  );
}

// ============================================================
// [🧱 BLOCK: Owned Charm Pill]
// ============================================================
function OwnedCharmPill({
  charm, onSell,
}: {
  charm:  Charm;
  onSell: () => void;
}) {
  const [confirm, setConfirm] = useState(false);
  const refund = Math.ceil(charm.cost * 0.5);

  return (
    <div style={{
      display:      "flex",
      alignItems:   "center",
      gap:          8,
      background:   "rgba(250,204,21,0.06)",
      border:       "1px solid rgba(250,204,21,0.15)",
      borderRadius: 6,
      padding:      "6px 10px",
    }}>
      <span style={{ fontSize: 16 }}>{charm.icon}</span>
      <span style={{ fontSize: 10, color: "#f1f5f9", flex: 1 }}>{charm.name}</span>
      {confirm ? (
        <div style={{ display: "flex", gap: 4 }}>
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
// [🧱 BLOCK: Shop Main Component]
// ============================================================
export default function Shop({
  floor, room, gold, playerStats, player, onGoldChange, onContinue,
}: ShopProps) {
  // Local re-render trigger when stats change
  const [, forceUpdate] = useState(0);
  const refresh = useCallback(() => forceUpdate((n) => n + 1), []);

  // Generate shop options once on mount
  const [optionsReady, setOptionsReady] = useState(false);
  if (!optionsReady) {
    playerStats.generateShopOptions();
    setOptionsReady(true);
  }

  const handleStatSpend = (newGold: number) => {
    onGoldChange(newGold);
    refresh();
  };

  const handleBuyCharm = (charm: Charm) => {
    const newGold = playerStats.buyCharm(charm, gold, player);
    onGoldChange(newGold);
    refresh();
  };

  const handleSellCharm = (charmId: string) => {
    const newGold = playerStats.sellCharm(charmId, gold, player);
    onGoldChange(newGold);
    refresh();
  };

  const handleReroll = () => {
    const newGold = playerStats.reroll(gold);
    onGoldChange(newGold);
    refresh();
  };

  const charmsFull = playerStats.charms.length >= playerStats.maxCharms;
  const cap        = statCap(floor);

  return (
    <div style={{
      position:       "fixed",
      inset:          0,
      zIndex:         40,
      display:        "flex",
      alignItems:     "center",
      justifyContent: "center",
      background:     "rgba(0,0,0,0.92)",
      fontFamily:     "'Courier New', monospace",
      padding:        20,
    }}>
      <div style={{
        width:        "min(860px, 100%)",
        maxHeight:    "90vh",
        overflowY:    "auto",
        display:      "flex",
        flexDirection:"column",
        gap:          20,
      }}>

        {/* ── Header ── */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <p style={{ fontSize: 9, color: "#475569", letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 4 }}>
              Floor {floor} · Before Room {room}
            </p>
            <p style={{ fontSize: 28, fontWeight: 900, color: "#facc15", textShadow: "0 0 30px #facc15" }}>
              SHOP
            </p>
          </div>
          <div style={{ textAlign: "right" }}>
            <p style={{ fontSize: 9, color: "#475569", marginBottom: 2 }}>Your Gold</p>
            <p style={{ fontSize: 24, fontWeight: 900, color: "#facc15" }}>💰 {gold}g</p>
          </div>
        </div>

        {/* ── Main Panel: Stats + Charms ── */}
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap" as const }}>

          {/* STAT ALLOCATION */}
          <div style={{
            flex:         1, minWidth: 260,
            background:   "rgba(255,255,255,0.02)",
            border:       "1px solid rgba(255,255,255,0.06)",
            borderRadius: 10, padding: 16,
          }}>
            <p style={{ fontSize: 10, color: "#64748b", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 12 }}>
              Stat Allocation · Cap: {cap}/10
            </p>
            {STAT_DEFS.map((def) => (
              <StatRow
                key={def.key}
                statKey={def.key}
                playerStats={playerStats}
                player={player}
                gold={gold}
                floor={floor}
                onSpend={handleStatSpend}
              />
            ))}
          </div>

          {/* CHARMS */}
          <div style={{
            flex:         1, minWidth: 320,
            display:      "flex",
            flexDirection:"column",
            gap:          12,
          }}>

            {/* Shop options */}
            <div style={{
              background:   "rgba(255,255,255,0.02)",
              border:       "1px solid rgba(255,255,255,0.06)",
              borderRadius: 10, padding: 16,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <p style={{ fontSize: 10, color: "#64748b", letterSpacing: "0.15em", textTransform: "uppercase" }}>
                  Charms
                </p>
                <PillBtn
                  label={`Reroll 💰${playerStats.rerollCost}g`}
                  onClick={handleReroll}
                  disabled={gold < playerStats.rerollCost}
                  color="#64748b"
                  small
                />
              </div>

              {charmsFull && (
                <p style={{ fontSize: 9, color: "#ef4444", marginBottom: 10, textAlign: "center" }}>
                  ⚠ Sell a charm to make room
                </p>
              )}

              <div style={{ display: "flex", gap: 10 }}>
                {playerStats.shopOptions.map((charm) => (
                  <CharmCard
                    key={charm.id}
                    charm={charm}
                    canBuy={playerStats.canBuyCharm(charm, gold)}
                    owned={playerStats.hasCharm(charm.id)}
                    onBuy={() => handleBuyCharm(charm)}
                  />
                ))}
                {playerStats.shopOptions.length === 0 && (
                  <p style={{ fontSize: 11, color: "#334155", padding: 20 }}>
                    No charms available — all owned.
                  </p>
                )}
              </div>
            </div>

            {/* Owned charms */}
            <div style={{
              background:   "rgba(255,255,255,0.02)",
              border:       "1px solid rgba(255,255,255,0.06)",
              borderRadius: 10, padding: 16,
            }}>
              <p style={{ fontSize: 10, color: "#64748b", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 12 }}>
                Your Charms ({playerStats.charms.length}/{playerStats.maxCharms})
              </p>
              {playerStats.charms.length === 0 ? (
                <p style={{ fontSize: 11, color: "#334155" }}>No charms equipped yet.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {playerStats.charms.map((charm) => (
                    <OwnedCharmPill
                      key={charm.id}
                      charm={charm}
                      onSell={() => handleSellCharm(charm.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Continue Button ── */}
        <div style={{ display: "flex", justifyContent: "center", paddingTop: 8 }}>
          <PillBtn label="▶ Enter Boss Room" onClick={onContinue} color="#facc15" />
        </div>
      </div>
    </div>
  );
}