// src/components/WeaponPicker.tsx
"use client";

import React from "react";
import { PlayerStats } from "@/engine/PlayerStats";
import { Player }      from "@/engine/Player";
import { WeaponItem }  from "@/engine/items/types";
import { getWeaponPassive } from "@/engine/WeaponPassiveRegistry";
import "@/styles/weapon-picker.css";

// ============================================================
// [🧱 BLOCK: Props]
// ============================================================
interface WeaponPickerProps {
  choices:     WeaponItem[];   // 3 random weapons, free grant
  playerStats: PlayerStats;
  player:      Player;
  onResolved:  () => void;     // called once a weapon has been claimed
}

// ============================================================
// [🧱 BLOCK: WeaponPicker]
// [🧱 Phase 2] Run-start weapon picker. Blocks the start of
// Room 1 until resolved — no reroll, no cancel. Unlike BoonPicker
// there is no slot-replace step: the player owns exactly one
// weapon, so choosing simply claims it outright.
// ============================================================
export default function WeaponPicker({ choices, playerStats, player, onResolved }: WeaponPickerProps) {
  const handleChoose = (item: WeaponItem) => {
    playerStats.claimWeapon(item, player);
    onResolved();
  };

  return (
    <div className="wp-backdrop">
      <div className="wp-panel">

        <div className="wp-title-block">
          <p className="wp-eyebrow">Before you descend</p>
          <p className="wp-title">Choose Your Weapon</p>
        </div>

        <div className="wp-choices">
          {choices.map((item) => {
            const passive = getWeaponPassive(item.weaponType);
            return (
              <div key={item.id} className="wp-card" onClick={() => handleChoose(item)}>
                <span className="wp-card__icon">{item.icon}</span>
                <span className="wp-card__name">{item.name}</span>
                <span className="wp-card__type">{item.weaponType.toUpperCase()}</span>
                <span className="wp-card__desc">{item.description}</span>
                {passive && (
                  <div className="wp-card__passive">
                    <span className="wp-card__passive-label">Passive · {passive.name}</span>
                    <span className="wp-card__passive-desc">{passive.description}</span>
                  </div>
                )}
                {item.tradeOff && <span className="wp-card__tradeoff">⚠ {item.tradeOff}</span>}
                <button className="wp-card__btn" onClick={() => handleChoose(item)}>Choose</button>
              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
}