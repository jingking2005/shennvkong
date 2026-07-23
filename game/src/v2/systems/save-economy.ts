/**
 * V2 存档 + 经济系统
 */

import type { PlayerSave, PlayerCurrencies, CardInstance } from '../data/types';

const SAVE_KEY = 'valkyrie-crusade-v2-save';

// === 默认存档 ===

export function createDefaultSave(): PlayerSave {
  return {
    version: 2,
    inventory: [],
    decks: [{ name: '默认队伍', slots: [
      { position: 'FRONT_LEFT', cardInstanceId: null },
      { position: 'FRONT_RIGHT', cardInstanceId: null },
      { position: 'MID_LEFT', cardInstanceId: null },
      { position: 'MID_RIGHT', cardInstanceId: null },
      { position: 'BACK_CENTER', cardInstanceId: null },
    ], totalCost: 0 }],
    currencies: {
      gold: 5000,
      ether: 500,
      iron: 300,
      jewels: 1000,
      friendship_points: 2000,
      rare_medals: 50,
      stamina: 100,
      battle_points: 0,
    },
    clearedStages: [],
    gachaPity: {},
    kingdom: { buildings: { castle: 1 }, lastCollectTime: Date.now() },
    settings: { autoBattle: true, autoPauseOnSkill: false, battleSpeed: 1, soundEnabled: true, musicEnabled: true },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

// === 存档读写 ===

export function loadSave(): PlayerSave {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      const save = JSON.parse(raw) as PlayerSave;
      if (save.version === 2) return save;
    }
  } catch { /* 损坏存档 */ }
  const save = createDefaultSave();
  writeSave(save);
  return save;
}

export function writeSave(save: PlayerSave): void {
  save.updatedAt = new Date().toISOString();
  localStorage.setItem(SAVE_KEY, JSON.stringify(save));
}

// === 经济操作 ===

export function canAfford(save: PlayerSave, cost: Partial<PlayerCurrencies>): boolean {
  for (const [key, amount] of Object.entries(cost)) {
    if ((save.currencies[key] || 0) < (amount || 0)) return false;
  }
  return true;
}

export function spend(save: PlayerSave, cost: Partial<PlayerCurrencies>): boolean {
  if (!canAfford(save, cost)) return false;
  for (const [key, amount] of Object.entries(cost)) {
    save.currencies[key] = (save.currencies[key] || 0) - (amount || 0);
  }
  return true;
}

export function earn(save: PlayerSave, reward: Partial<PlayerCurrencies>): void {
  for (const [key, amount] of Object.entries(reward)) {
    save.currencies[key] = (save.currencies[key] || 0) + (amount || 0);
  }
}

// === 战斗奖励 ===

export interface BattleReward {
  gold: number;
  exp: number;
  friendshipPoints: number;
  rareMedals?: number;
  jewels?: number;
}

export function getBattleReward(won: boolean, stageDifficulty: number = 1): BattleReward {
  if (!won) return { gold: 100, exp: 50, friendshipPoints: 2 };
  return {
    gold: 300 * stageDifficulty,
    exp: 150 * stageDifficulty,
    friendshipPoints: 5 * stageDifficulty,
    rareMedals: stageDifficulty >= 3 ? 1 : 0,
    jewels: stageDifficulty >= 4 ? 10 : 0,
  };
}

export function applyBattleReward(save: PlayerSave, reward: BattleReward): void {
  earn(save, {
    gold: reward.gold,
    friendship_points: reward.friendshipPoints,
    rare_medals: reward.rareMedals || 0,
    jewels: reward.jewels || 0,
  });
}

// === 背包操作 ===

export function addToInventory(save: PlayerSave, instance: CardInstance): void {
  save.inventory.push(instance);
}

export function removeFromInventory(save: PlayerSave, instanceId: string): CardInstance | null {
  const idx = save.inventory.findIndex(c => c.instanceId === instanceId);
  if (idx < 0) return null;
  return save.inventory.splice(idx, 1)[0];
}

export function updateInventory(save: PlayerSave, instance: CardInstance): void {
  const idx = save.inventory.findIndex(c => c.instanceId === instance.instanceId);
  if (idx >= 0) save.inventory[idx] = instance;
}
