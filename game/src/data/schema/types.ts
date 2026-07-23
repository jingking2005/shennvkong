/**
 * 神女控 标准数据 Schema
 * 定义所有游戏数据的 TypeScript 类型
 */

// === 枚举 ===

export type Element = 'Passion' | 'Cool' | 'Light' | 'Dark' | 'Special';

export type Rarity = 'N' | 'R' | 'SR' | 'UR' | 'LR' | 'HN' | 'HR' | 'HSR' | 'HUR' | 'HLR';

export type FormType = 'normal' | 'evolved' | 'awakened';

export type SkillTarget = 'single' | 'all' | 'self';

export type DownloadStatus = 'pending' | 'downloaded' | 'failed' | 'missing';

// === 核心数据 ===

export interface Stats {
  atk: number;
  def: number;
  hp: number;
  speed: number;
}

export interface SkillEffect {
  type: 'damage' | 'heal' | 'buff_atk' | 'buff_def' | 'debuff' | 'stun';
  value: number;
  duration?: number;
}

export interface Skill {
  id: string;
  name: string;
  name_cn?: string;
  desc: string;
  rate: number; // 触发概率 0-1
  multiplier: number; // 伤害倍率
  target: SkillTarget;
  effects: SkillEffect[];
}

export interface AssetReference {
  assetId: string;
  cardId: string;
  formType: FormType;
  usageType: 'card_art' | 'full_art' | 'thumbnail' | 'icon';
  sourceFileName: string;
  sourceUrl?: string;
  localPath: string;
  sha1?: string;
  width?: number;
  height?: number;
  mimeType?: string;
  downloadStatus: DownloadStatus;
}

export interface CardForm {
  formType: FormType;
  stats: Stats;
  assetRefs: string[]; // AssetReference IDs
}

export interface Card {
  id: string; // slug
  slug: string;
  names: { en: string; cn?: string; jp?: string };
  description?: string;
  rarity: Rarity;
  element: Element;
  cost: number;
  baseStats: Stats;
  maxStats?: Stats;
  skillIds: string[];
  forms: CardForm[];
  artist?: string;
  tags: string[];
  releaseInfo?: { date?: string; event?: string };
  dataVersion: number;
}

// === 战斗 ===

export interface BattleUnit {
  uid: string; // 战斗中的唯一实例 ID
  card: Card;
  skill: Skill | null;
  currentHp: number;
  maxHp: number;
  atk: number;
  def: number;
  speed: number;
  isAlive: boolean;
  side: 'player' | 'enemy';
  position: number; // 0-4
}

export interface BattleAction {
  turn: number;
  actorUid: string;
  actorName: string;
  type: 'attack' | 'skill' | 'death';
  targetUids: string[];
  damage?: number;
  isSkill?: boolean;
  skillName?: string;
  elementBonus?: number;
  killed?: string[];
}

export interface BattleState {
  turn: number;
  units: BattleUnit[];
  log: BattleAction[];
  phase: 'ongoing' | 'player_win' | 'enemy_win';
}

export interface BattleResult {
  winner: 'player' | 'enemy';
  turns: number;
  log: BattleAction[];
}

// === 队伍与关卡 ===

export interface Deck {
  name: string;
  cardIds: string[]; // 最多 5 张
}

export interface StageEnemy {
  cardId: string;
  level?: number;
}

export interface Stage {
  id: string;
  name: string;
  difficulty: number; // 1-5
  enemies: StageEnemy[];
  rewardExp?: number;
}

// === 存档 ===

export interface SaveData {
  version: number;
  createdAt: string;
  updatedAt: string;
  playerName: string;
  decks: Deck[];
  clearedStages: string[];
  cardCollection: string[]; // 已获得的卡牌 ID
  stats: { battlesWon: number; battlesLost: number };
}

// === 原始数据（Hermes 输出格式） ===

export interface RawCard {
  name?: string;
  name_cn?: string;
  rarity?: string;
  element?: string;
  atk?: number | string;
  def?: number | string;
  cost?: number | string;
  skill_name?: string;
  skill_desc?: string;
  image_url?: string;
  image_local?: string;
  url?: string;
  [key: string]: unknown; // 容忍未知字段
}
