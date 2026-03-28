// src/components/Inventory.tsx
"use client";

import React, { useState } from "react";
import { PlayerStats } from "@/engine/PlayerStats";
import { Player }      from "@/engine/Player";
import { Charm }       from "@/engine/CharmRegistry";
import { WeaponItem }  from "@/engine/items/types";

// ============================================================
// [🧱 BLOCK: Inventory Props]
// ============================================================
interface InventoryProps {
  playerStats: PlayerStats;
  player:      Player;
  gold:        number;
  onGoldChange:(newGold: number) => void;
  onClose:     () => void;
}

// ============================================================
// [🧱 BLOCK: Weapon Slot]
// ============================================================
function WeaponSlot({ item, onSell }: {
  item:   WeaponItem | null;
  onSell: () => void;
}) {
  const [confirm, setConfirm] = useState(false);

  return (
    <div style={{
      background:   "rgba(56,189,248,0.05)",
      border:       `1px solid ${item ? "rgba(56,189,248,0.25)" : "rgba(255,255,255,0.06)"}`,
      borderRadius: 10, padding: 16,
    }}>
      <p style={{ fontSize:9, color:"#38bdf8", letterSpacing:"0.2em",
        textTransform:"uppercase", marginBottom:10 }}>
        ⚔ Weapon Slot
      </p>

      {item ? (
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <span style={{ fontSize:28 }}>{item.icon}</span>
            <div style={{ flex:1 }}>
              <p style={{ fontSize:13, fontWeight:700, color:"#f1f5f9", marginBottom:2 }}>
                {item.name}
              </p>
              <p style={{ fontSize:9, color:"#38bdf8", letterSpacing:"0.1em", textTransform:"uppercase" }}>
                {item.weaponType}
              </p>
            </div>
          </div>

          {/* Passive */}
          <div style={{ background:"rgba(255,255,255,0.03)", borderRadius:6, padding:"8px 10px" }}>
            <p style={{ fontSize:9, color:"#64748b", letterSpacing:"0.1em",
              textTransform:"uppercase", marginBottom:4 }}>
              Passive
            </p>
            <p style={{ fontSize:11, color:"#f1f5f9" }}>{item.description}</p>
            {item.tradeOff && (
              <p style={{ fontSize:10, color:"#ef4444", marginTop:4 }}>⚠ {item.tradeOff}</p>
            )}
          </div>

          {/* Attack stats */}
          <div style={{ display:"flex", gap:8 }}>
            {(['light', 'heavy'] as const).map((mode) => (
              <div key={mode} style={{ flex:1, background:"rgba(255,255,255,0.02)",
                borderRadius:6, padding:"6px 10px" }}>
                <p style={{ fontSize:8, color:"#475569", letterSpacing:"0.1em",
                  textTransform:"uppercase", marginBottom:4 }}>
                  {mode}
                </p>
                <p style={{ fontSize:10, color:"#f1f5f9" }}>
                  {mode === 'light' ? '12' : '28'} dmg
                </p>
              </div>
            ))}
          </div>

          {/* Sell */}
          {!confirm ? (
            <button onClick={() => setConfirm(true)} style={{
              fontFamily:"'Courier New', monospace", fontSize:10, fontWeight:700,
              letterSpacing:"0.15em", textTransform:"uppercase",
              color:"#64748b", background:"transparent",
              border:"1px solid #1e293b", padding:"8px 0",
              borderRadius:4, cursor:"pointer", width:"100%",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color="#ef4444"; e.currentTarget.style.borderColor="#ef4444"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color="#64748b"; e.currentTarget.style.borderColor="#1e293b"; }}
            >
              Unequip / Sell (+{Math.ceil(item.cost * 0.5)}g)
            </button>
          ) : (
            <div style={{ display:"flex", gap:8 }}>
              <button onClick={() => { setConfirm(false); onSell(); }} style={{
                fontFamily:"'Courier New', monospace", fontSize:10, fontWeight:700,
                letterSpacing:"0.1em", textTransform:"uppercase",
                color:"#0f172a", background:"#ef4444",
                border:"none", padding:"8px 0", borderRadius:4,
                cursor:"pointer", flex:1,
              }}>
                Confirm Sell
              </button>
              <button onClick={() => setConfirm(false)} style={{
                fontFamily:"'Courier New', monospace", fontSize:10, fontWeight:700,
                letterSpacing:"0.1em", textTransform:"uppercase",
                color:"#64748b", background:"transparent",
                border:"1px solid #1e293b", padding:"8px 0",
                borderRadius:4, cursor:"pointer", flex:1,
              }}>
                Cancel
              </button>
            </div>
          )}
        </div>
      ) : (
        <p style={{ fontSize:11, color:"#334155" }}>👊 Bare Fists — no weapon equipped</p>
      )}
    </div>
  );
}

// ============================================================
// [🧱 BLOCK: Charm Slot]
// ============================================================
function CharmSlot({ charm, onSell }: { charm: Charm; onSell: () => void }) {
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
        <button onClick={() => setConfirm(true)} style={{
          fontFamily:"'Courier New', monospace", fontSize:9, fontWeight:700,
          letterSpacing:"0.1em", textTransform:"uppercase",
          color:"#475569", background:"transparent",
          border:"1px solid #1e293b", padding:"4px 10px",
          borderRadius:4, cursor:"pointer",
        }}>
          Sell
        </button>
      ) : (
        <div style={{ display:"flex", gap:4 }}>
          <button onClick={() => { setConfirm(false); onSell(); }} style={{
            fontFamily:"'Courier New', monospace", fontSize:9, fontWeight:700,
            color:"#0f172a", background:"#ef4444", border:"none",
            padding:"4px 8px", borderRadius:4, cursor:"pointer",
          }}>
            +{refund}g
          </button>
          <button onClick={() => setConfirm(false)} style={{
            fontFamily:"'Courier New', monospace", fontSize:9,
            color:"#64748b", background:"transparent",
            border:"1px solid #1e293b", padding:"4px 8px",
            borderRadius:4, cursor:"pointer",
          }}>
            ✕
          </button>
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

  const handleSellWeapon = () => {
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
      position:"fixed", inset:0, zIndex:55,
      display:"flex", alignItems:"center", justifyContent:"center",
      background:"rgba(0,0,0,0.80)",
      backdropFilter:"blur(6px)",
      fontFamily:"'Courier New', monospace",
    }}>
      <div style={{
        width:"min(640px, 95%)", maxHeight:"90vh", overflowY:"auto",
        display:"flex", flexDirection:"column", gap:16,
        background:"rgba(10,15,30,0.95)",
        border:"1px solid rgba(255,255,255,0.07)",
        borderRadius:12, padding:24,
      }}>

        {/* Header */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            <p style={{ fontSize:9, color:"#475569", letterSpacing:"0.3em",
              textTransform:"uppercase", marginBottom:4 }}>
              Press I to close
            </p>
            <p style={{ fontSize:24, fontWeight:900, color:"#f1f5f9" }}>
              INVENTORY
            </p>
          </div>
          <div style={{ textAlign:"right" }}>
            <p style={{ fontSize:9, color:"#475569", marginBottom:2 }}>Gold</p>
            <p style={{ fontSize:20, fontWeight:900, color:"#facc15" }}>💰 {gold}g</p>
          </div>
        </div>

        {/* Weapon slot */}
        <WeaponSlot
          item={playerStats.equippedWeaponItem}
          onSell={handleSellWeapon}
        />

        {/* Charm slots */}
        <div style={{ background:"rgba(255,255,255,0.02)",
          border:"1px solid rgba(255,255,255,0.06)", borderRadius:10, padding:16 }}>
          <p style={{ fontSize:10, color:"#64748b", letterSpacing:"0.15em",
            textTransform:"uppercase", marginBottom:12 }}>
            Charms ({playerStats.charms.length}/{playerStats.maxCharms})
          </p>

          {/* Empty slots */}
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {playerStats.charms.map((charm) => (
              <CharmSlot key={charm.id} charm={charm}
                onSell={() => handleSellCharm(charm.id)} />
            ))}
            {Array.from({ length: playerStats.maxCharms - playerStats.charms.length }).map((_, i) => (
              <div key={`empty-${i}`} style={{
                border:"1px dashed rgba(255,255,255,0.06)",
                borderRadius:8, padding:"10px 12px",
                color:"#1e293b", fontSize:11,
              }}>
                — Empty slot
              </div>
            ))}
          </div>
        </div>

        {/* Close */}
        <div style={{ display:"flex", justifyContent:"center" }}>
          <button onClick={onClose} style={{
            fontFamily:"'Courier New', monospace", fontSize:12,
            fontWeight:700, letterSpacing:"0.2em", textTransform:"uppercase",
            color:"#f1f5f9", background:"transparent",
            border:"1px solid rgba(255,255,255,0.1)", padding:"10px 32px",
            borderRadius:4, cursor:"pointer",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background="rgba(255,255,255,0.06)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background="transparent"; }}
          >
            Close [I]
          </button>
        </div>
      </div>
    </div>
  );
}