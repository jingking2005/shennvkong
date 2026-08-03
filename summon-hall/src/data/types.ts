/**
 * 运行时数据类型（变更单 §3.2 / §4.4 / §5.3）。
 * 与旧 src/data.ts 的 Card 兼容层并存；新代码一律用这里的定义。
 */

import type { Provenance } from './provenance';

export type CardForm = 'main' | 'h' | 'x' | 'evolved';

export type CardAssetRole = 'main' | 'icon' | 'h' | 'hIcon' | 'x' | 'xIcon' | 'guildIcon';

export interface CardAssetRef {
  role: CardAssetRole;
  asset: string;          // 运行时 URL（/archive/...）
  sourceFile: string;     // 归档内相对路径
  width?: number;
  height?: number;
  source: Provenance;
}

export interface CardStats {
  attack: number;
  defense: number;
  soldiers: number;
  speed: number;
  critRate: number;
  critDamage: number;
}

export interface SkillDefinition {
  name: string;
  desc: string;
  source: Provenance;
}

export interface CardDefinition {
  cardKey: string;          // 稳定 slug，不等同数字 card_id
  legacyId?: string;        // 旧 cards.json id（localStorage 迁移用）
  originalCardId?: number;  // 仅 89 条已知映射
  name: { en: string; cn?: string };
  rarity: 'N' | 'R' | 'SR' | 'UR' | 'LR' | 'X' | 'VR';
  element: 'Cool' | 'Dark' | 'Light' | 'Passion' | 'Special';
  stats: CardStats;
  skill?: SkillDefinition;
  forms: CardAssetRef[];
  quotesRef?: string;
  availability?: string;
  source: Provenance;
}

export interface CardQuotes {
  description?: string;
  login?: string;
  meet?: string;
  friendship?: string;
  friendshipMax?: string;
  friendshipEvent?: string;
  battleStart?: string;
  battleEnd?: string;
  rebirth?: string;
  raw?: string;
}

export interface WaveDefinition {
  enemies: Array<{ cardKey: string; level: number }>;
  source: Provenance;
}

export interface RewardDefinition {
  kind: 'gold' | 'gems' | 'card' | 'item' | 'exp';
  id?: string;
  amount: number;
  source: Provenance;
}

export interface StageDefinition {
  stageId: string;
  mapId: string;
  battleBackgroundId: string;
  musicId?: string;
  waves: WaveDefinition[];
  encounterType: 'normal' | 'boss' | 'round' | 'king';
  rewards: RewardDefinition[];
  source: Provenance;
}

export interface BattleEvent {
  turn: number;
  phase: 'wave-start' | 'skill-check' | 'attack' | 'status' | 'death-check' | 'wave-clear' | 'battle-end';
  actorId?: string;
  targetId?: string;
  amount?: number;
  effectId?: string;
  source: Provenance;
}
