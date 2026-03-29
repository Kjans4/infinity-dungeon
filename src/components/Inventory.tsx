"use client";

import React, { useState, useEffect, useRef } from "react";
import { PlayerStats } from "@/engine/PlayerStats";
import { Player }      from "@/engine/Player";
import { Charm }        from "@/engine/CharmRegistry";
import { WeaponItem }  from "@/engine/items/types";

// ============================================================
// [🧱 BLOCK: Props]
// ============================================================
interface InventoryProps {
  playerStats: PlayerStats;
  player:      Player;
  gold:        number;
  onGoldChange:(newGold: number) => void;
  onClose:     () => void;
}

// ============================================================
// [🧱 BLOCK: Small Button]
// ============================================================
function SmallBtn({
  label, onClick, color = "#64748b", danger = false,
}: {
  label: string; onClick: () => void; color?: string; danger?: boolean;
}) {
  const [hov, setHov] = useState(false);
  const bg = danger
    ? (hov ? "#ef4444" : "transparent")
    : (hov ? color     : "transparent");
  const fg = hov ? "#0f172a" : color;

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        fontFamily:    "'Courier New', monospace",
        fontSize:      9, fontWeight: 700,
        letterSpacing: "0.1em", textTransform: "uppercase",
        color:         fg, background: bg,
        border:        `1px solid ${danger ? "#ef4444" : color}`,
        padding:       "4px 10px", borderRadius: 4,
        cursor:        "pointer", transition: "all 0.1s",
      }}
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
      <div style={{
        background:   "rgba(56,189,248,0.03)",
        border:       "1px dashed rgba(56,189,248,0.15)",
        borderRadius: 10, padding: 16,
      }}>
        <p style={{ fontSize:9, color:"#38bdf8", letterSpacing:"0.2em",
          textTransform:"uppercase", marginBottom:8 }}>
          ⚔ Weapon Slot
        </p>
        <p style={{ fontSize:11, color:"#334155" }}>
          👊 Bare Fists — buy a weapon in the shop
        </p>
      </div>
    );
  }

  const refund = Math.ceil(item.cost * 0.5);

  return (
    <div style={{
      background:   "rgba(56,189,248,0.05)",
      border:       "1px solid rgba(56,189,248,0.25)",
      borderRadius: 10, padding: 16,
      display:      "flex", flexDirection: "column", gap: 10,
    }}>
      <p style={{ fontSize:9, color:"#38bdf8", letterSpacing:"0.2em",
        textTransform:"uppercase" }}>
        ⚔ Weapon Slot — Equipped
      </p>

      <div style={{ display:"flex", alignItems:"center", gap:12 }}>
        <span style={{ fontSize:32 }}>{item.icon}</span>
        <div style={{ flex:1 }}>
          <p style={{ fontSize:14, fontWeight:700, color:"#f1f5f9", marginBottom:2 }}>
            {item.name}
          </p>
          <p style={{ fontSize:9, color:"#38bdf8", letterSpacing:"0.1em",
            textTransform:"uppercase", marginBottom:4 }}>
            {item.weaponType}
          </p>
          <p style={{ fontSize:10, color:"#94a3b8" }}>{item.description}</p>
          {item.tradeOff && (
            <p style={{ fontSize:9, color:"#ef4444", marginTop:2 }}>⚠ {item.tradeOff}</p>
          )}
        </div>
      </div>

      <div style={{ display:"flex", gap:8 }}>
        {[
          { label:"Light", dmg: item.weaponType === 'sword' ? 12 : item.weaponType === 'axe' ? 15 : 10,
            stam: item.weaponType === 'sword' ? 10 : item.weaponType === 'axe' ? 12 : 8 },
          { label:"Heavy", dmg: item.weaponType === 'sword' ? 28 : item.weaponType === 'axe' ? 40 : 35,
            stam: item.weaponType === 'sword' ? 25 : item.weaponType === 'axe' ? 30 : 22 },
        ].map((atk) => (
          <div key={atk.label} style={{
            flex:1, background:"rgba(255,255,255,0.03)",
            border:"1px solid rgba(255,255,255,0.06)",
            borderRadius:6, padding:"6px 10px",
          }}>
            <p style={{ fontSize:8, color:"#475569", letterSpacing:"0.1em",
              textTransform:"uppercase", marginBottom:4 }}>
              {atk.label}
            </p>
            <p style={{ fontSize:11, color:"#f1f5f9", marginBottom:2 }}>
              {atk.dmg} dmg
            </p>
            <p style={{ fontSize:9, color:"#64748b" }}>{atk.stam} stamina</p>
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
        <div style={{ display:"flex", gap:8 }}>
          <SmallBtn
            label="Confirm Sell"
            onClick={() => { setConfirm(false); onUnequip(); }}
            danger
          />
          <SmallBtn
            label="Cancel"
            onClick={() => setConfirm(false)}
            color="#64748b"
          />
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
    <div style={{
      display:"flex", alignItems:"center", gap:10,
      background:"rgba(250,204,21,0.04)",
      border:"1px solid rgba(250,204,21,0.12)",
      borderRadius:8, padding:"10px 12px",
    }}>
      <span style={{ fontSize:20 }}>{charm.icon}</span>
      <div style={{ flex:1 }}>
        <p style={{ fontSize:11, fontWeight:700, color:"#f1f5f9", marginBottom:2 }}>
          {charm.name}
        </p>
        <p style={{ fontSize:9, color:"#64748b" }}>{charm.description}</p>
        {charm.tradeOff && (
          <p style={{ fontSize:9, color:"#ef4444" }}>⚠ {charm.tradeOff}</p>
        )}
      </div>
      {!confirm ? (
        <SmallBtn label="Sell" onClick={() => setConfirm(true)} danger />
      ) : (
        <div style={{ display:"flex", gap:4 }}>
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

  // ── Keyboard Close Logic ──────────────────────────────────
  // This ensures that if the user holds 'I' to close, it triggers properly
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
    <div style={{
      position:       "fixed", inset: 0, zIndex: 100, // Higher Z-index
      display:        "flex", alignItems: "center", justifyContent: "center",
      background:     "rgba(0,0,0,0.85)",
      backdropFilter: "blur(10px)",
      fontFamily:     "'Courier New', monospace",
    }}>
      <div style={{
        width:     "min(620px, 95%)",
        maxHeight: "88vh", overflowY: "auto",
        display:   "flex", flexDirection: "column", gap: 14,
        background:"rgba(10,15,30,0.98)",
        border:    "2px solid rgba(56,189,248,0.2)", // Subtle glow border
        borderRadius: 12, padding: 24,
        boxShadow: "0 20px 50px rgba(0,0,0,0.5)",
      }}>

        {/* Header */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
          <div>
            <p style={{ fontSize:9, color:"#475569", letterSpacing:"0.25em",
              textTransform:"uppercase", marginBottom:4 }}>
              Game Paused · Hold I or press ESC to close
            </p>
            <p style={{ fontSize:22, fontWeight:900, color:"#f1f5f9" }}>
              INVENTORY
            </p>
          </div>
          <div style={{ textAlign:"right" }}>
            <p style={{ fontSize:9, color:"#475569", marginBottom:2 }}>Gold Balance</p>
            <p style={{ fontSize:18, fontWeight:900, color:"#facc15" }}>💰 {gold}g</p>
          </div>
        </div>

        {/* Weapon slot */}
        <WeaponSlot
          item={playerStats.equippedWeaponItem}
          onUnequip={handleUnequipWeapon}
        />

        {/* Charm slots */}
        <div style={{
          background:   "rgba(255,255,255,0.02)",
          border:       "1px solid rgba(255,255,255,0.06)",
          borderRadius: 10, padding: 16,
        }}>
          <p style={{ fontSize:9, color:"#64748b", letterSpacing:"0.15em",
            textTransform:"uppercase", marginBottom:12 }}>
            Charms ({playerStats.charms.length}/{playerStats.maxCharms})
          </p>

          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {playerStats.charms.map((charm) => (
              <CharmRow
                key={charm.id} charm={charm}
                onSell={() => handleSellCharm(charm.id)}
              />
            ))}
            {Array.from({ length: playerStats.maxCharms - playerStats.charms.length }).map((_, i) => (
              <div key={`empty-${i}`} style={{
                border: "1px dashed rgba(255,255,255,0.05)",
                borderRadius: 8, padding: "10px 12px",
                color: "#1e293b", fontSize: 11,
              }}>
                — Empty slot
              </div>
            ))}
          </div>
        </div>

        {/* Footer Close Button (Optional but helpful for accessibility) */}
        <div style={{ marginTop: 10, textAlign: 'center' }}>
            <SmallBtn label="Back to Game" onClick={onClose} color="#38bdf8" />
        </div>

        <p style={{ fontSize:8, color:"#334155", textAlign:"center", letterSpacing:"0.1em", marginTop: 10 }}>
          BUY WEAPONS &amp; CHARMS IN THE SHOP · HOLD I TO CLOSE
        </p>

      </div>
    </div>
  );
}