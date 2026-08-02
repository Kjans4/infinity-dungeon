// src/components/BoonPicker.tsx
"use client";

import React, { useState } from "react";
import { PlayerStats } from "@/engine/PlayerStats";
import { Player }      from "@/engine/Player";
import { BoonDef, MAX_BOON_LEVEL, getBoonById } from "@/engine/BoonRegistry";
import { BOON_SLOT_COUNT } from "@/engine/PlayerBoons";
import "@/styles/boon-picker.css";

// ============================================================
// [🧱 BLOCK: Props]
// ============================================================
interface BoonPickerProps {
  choices:     BoonDef[];   // 3 random boons, free grant
  playerStats: PlayerStats;
  player:      Player;
  onResolved:  () => void;  // called once a boon has been claimed
}

// ============================================================
// [🧱 BLOCK: BoonPicker]
// Boss Chest reward — the one deliberate Shop-only exception.
// Step 1: pick one of 3 free boon choices.
// Step 2: if all 5 slots are full, pick which slot to replace.
// ============================================================
export default function BoonPicker({ choices, playerStats, player, onResolved }: BoonPickerProps) {
  const [selected, setSelected] = useState<BoonDef | null>(null);

  const needsSlotPick = selected !== null && playerStats.boons.filledCount >= BOON_SLOT_COUNT;

  const handleChoose = (boon: BoonDef) => {
    if (playerStats.boons.filledCount < BOON_SLOT_COUNT) {
      const emptyIdx = playerStats.boons.slots.findIndex((s) => !s.boonId);
      playerStats.claimBoon(boon.id, emptyIdx, player);
      onResolved();
      return;
    }
    setSelected(boon);
  };

  const handlePickSlot = (slotIndex: number) => {
    if (!selected) return;
    playerStats.claimBoon(selected.id, slotIndex, player);
    onResolved();
  };

  return (
    <div className="bp-backdrop">
      <div className="bp-panel">

        <div className="bp-title-block">
          <p className="bp-eyebrow">The chest creaks open</p>
          <p className="bp-title">Choose a Boon</p>
        </div>

        {!needsSlotPick ? (
          <div className="bp-choices">
            {choices.map((boon) => (
              <div key={boon.id} className="bp-card" onClick={() => handleChoose(boon)}>
                <span className="bp-card__icon">{boon.icon}</span>
                <span className="bp-card__name">{boon.name}</span>
                <span className="bp-card__desc">{boon.description(1)}</span>
                {boon.tradeOff && <span className="bp-card__tradeoff">⚠ {boon.tradeOff}</span>}
                <button className="bp-card__btn" onClick={() => handleChoose(boon)}>Choose</button>
              </div>
            ))}
          </div>
        ) : (
          <>
            <p className="bp-slot-banner">All slots are full — choose a boon to replace with {selected!.name}</p>
            <div className="bp-slots">
              {playerStats.boons.slots.map((slot, i) => {
                const currentDef = slot.boonId ? getBoonById(slot.boonId) : null;
                return (
                  <div key={i} className="bp-slot-row" onClick={() => handlePickSlot(i)}>
                    <span className="bp-slot-row__icon">{currentDef?.icon ?? '➕'}</span>
                    <span className="bp-slot-row__name">
                      Slot {i + 1} — {currentDef ? currentDef.name : 'Empty'}
                    </span>
                    <span className="bp-slot-row__level">Lv{slot.level}/{MAX_BOON_LEVEL}</span>
                  </div>
                );
              })}
            </div>
            <div className="bp-cancel-row">
              <button className="bp-cancel-btn" onClick={() => setSelected(null)}>← Back</button>
            </div>
          </>
        )}

      </div>
    </div>
  );
}
