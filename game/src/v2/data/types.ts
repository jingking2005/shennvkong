/**
 * V2 数据模型 — 完整类型定义
 * 基于 spec/v2/data-model.md + spec/v2/card-and-skill-system.md
 */

// === 枚举 ===

export type Element = 'PASSION' | 'COOL' | 'LIGHT' | 'DARK' | 'SPECIAL';
export type Rarity = 'N' | 'R' | 'SR' | 'UR' | 'LR';
export type Symbol = 'SUN' | 'SEA' | 'EARTH' | null;
export type Position = 'FRONT_LEFT' | 'FRONT_RIGHT' | 'MID_LEFT' | 'MID_RIGHT' | 'BACK_CENTER';
export type Side = 'player' | 'enemy';

export type Role =
  | 'MAIN_DPS' | 'SUB_DPS' | 'TANK' | 'HEALER'
  | 'BUFF_SUPPORT' | 'DEBUFF_SUPPORT' | 'CONTROLLER' | 'HYBRID';

export type ActivationType =
  | 'MANUAL' | 'AUTO' | 'PASSIVE' | 'COUNTDOWN'
  | 'BATTLE_START' | 'NEAR_DEFEAT' | 'REACTION';

export type TriggerType =
  | 'BATTLE_START' | 'ALLY_TURN_START' | 'ENEMY_TURN_START'
  | 'BEFORE_ATTACK' | 'AFTER_ATTACK' | 'ON_HIT' | 'ON_CRIT'
  | 'HP_BELOW_THRESHOLD' | 'ALLY_DEATH' | 'ENEMY_DEATH'
  | 'SKILL_BLOCKED' | 'COUNTDOWN_ZERO';

export type TargetType =
  | 'SELF' | 'SINGLE_ALLY' | 'LOWEST_HP_ALLY' | 'ALL_ALLIES' | 'SAME_ELEMENT_ALLIES'
  | 'SINGLE_ENEMY' | 'HIGHEST_ATK_ENEMY' | 'LOWEST_HP_ENEMY'
  | 'FRONT_ROW' | 'BACK_ROW' | 'ALL_ENEMIES' | 'RANDOM_ENEMIES';

export type EffectType =
  | 'DAMAGE' | 'MULTI_HIT_DAMAGE' | 'AOE_DAMAGE' | 'TRUE_DAMAGE'
  | 'HEAL' | 'HEAL_OVER_TIME' | 'SHIELD' | 'REVIVE'
  | 'ATTACK_UP' | 'ATTACK_DOWN' | 'DEFENSE_UP' | 'DEFENSE_DOWN'
  | 'CRIT_UP' | 'DAMAGE_REDUCTION' | 'VULNERABILITY' | 'ABSORB'
  | 'CLEANSE' | 'DISPEL' | 'TURN_SKIP' | 'STUN' | 'SILENCE'
  | 'TAUNT' | 'PROTECT' | 'SKILL_NULLIFY' | 'SKILL_UNLEASH'
  | 'COOLDOWN_REDUCTION' | 'COUNTDOWN_REDUCTION'
  | 'RESURRECT' | 'EXECUTE' | 'COUNTER' | 'FOLLOW_UP';

// === 属性 ===

export interface Stats {
  attack: number;
  defense: number;
  soldiers: number; // HP
  speed: number;
  critRate: number;
  critDamage: number;
  healingPower: number;
  damageReduction: number;
  statusAccuracy: number;
  statusResistance: number;
}

// === 卡牌定义（模板） ===

export interface CardDefinition {
  id: string;
  name: { en: string; cn?: string; jp?: string };
  rarity: Rarity;
  element: Element;
  symbol: Symbol;
  cardCost: number;
  primaryRole: Role;
  secondaryRole: Role | null;
  combatTags: string[];
  baseStats: Stats;
  skillIds: string[];
  familyId: string;
  description?: string;
  artist?: string;
  forms: CardForm[];
}

export interface CardForm {
  stage: number; // 0-4
  statsMultiplier: number;
  assetKey?: string;
}

// === 卡牌实例（玩家持有） ===

export interface CardInstance {
  instanceId: string;
  cardId: string;
  level: number;
  exp: number;
  enhancement: number; // +0 ~ +10
  evolutionStage: number; // 0-4
  skillLevels: number[];
  friendship: number; // 0-100
  locked: boolean;
  derivedStats: Stats; // 计算后最终属性
}

// === 技能定义 ===

export interface SkillDefinition {
  id: string;
  name: string;
  description: string;
  skillCategory: 'normal_attack' | 'active' | 'passive' | 'ultimate';
  activationType: ActivationType;
  trigger: TriggerType | null;
  targetType: TargetType;
  effectList: SkillEffectDefinition[];
  baseChance: number; // 0-1
  levelScaling: LevelScaling;
  cooldown: number; // 0 = 无冷却
  turnCountdown: number; // 0 = 无倒计时
  procLimit: number; // 0 = 无限
  duration: number; // 0 = 即时
  conditions: SkillCondition[];
  priority: number; // 同回合多技能时的执行优先级
  animationKey: string;
  tags: string[];
}

export interface SkillEffectDefinition {
  type: EffectType;
  value: number;
  scalingPerLevel: number;
  duration: number; // 0 = 即时
  maxStacks: number; // 0 = 不可叠加
  targetOverride?: TargetType;
  conditions?: SkillCondition[];
}

export interface SkillCondition {
  type: 'hp_below' | 'hp_above' | 'element_match' | 'role_match' | 'tag_match' | 'turn_range' | 'enemy_count';
  value: number | string;
}

export interface LevelScaling {
  damageMultiplier?: number; // 每级增加
  healMultiplier?: number;
  chanceBonus?: number;
  durationBonus?: number;
  valueBonus?: number;
}

// === 状态效果 ===

export interface StatusEffect {
  id: string;
  sourceSkillId: string;
  sourceUnitId: string;
  type: EffectType;
  value: number;
  duration: number; // 剩余回合
  stacks: number;
  maxStacks: number;
  isDebuff: boolean;
  dispellable: boolean;
}

// === 战斗单位 ===

export interface BattleUnit {
  uid: string;
  cardInstance: CardInstance;
  cardDef: CardDefinition;
  side: Side;
  position: Position;
  currentSoldiers: number;
  maxSoldiers: number;
  currentStats: Stats; // 含 Buff/Debuff 修改后的属性
  statusEffects: StatusEffect[];
  shields: number;
  isAlive: boolean;
  skillCooldowns: Map<string, number>;
  skillProcCounts: Map<string, number>;
  countdowns: Map<string, number>;
  hasActed: boolean; // 本回合是否已普攻
  tauntTarget: boolean; // 是否被嘲讽标记
}

// === 战斗行动 ===

export interface BattleAction {
  type: 'normal_attack' | 'skill' | 'passive_trigger' | 'status_tick' | 'death';
  actorUid: string;
  skillId?: string;
  targetUids: string[];
  damage?: number;
  heal?: number;
  isCrit?: boolean;
  elementBonus?: number;
  statusApplied?: StatusEffect[];
  statusRemoved?: string[];
  killed?: string[];
}

// === 战斗状态 ===

export interface BattleState {
  turn: number;
  phase: 'ongoing' | 'player_win' | 'enemy_win' | 'draw';
  units: BattleUnit[];
  log: BattleAction[];
  rngState: number; // SeededRNG 状态
}

// === 队伍 ===

export interface DeckSlot {
  position: Position;
  cardInstanceId: string | null;
}

export interface DeckDefinition {
  name: string;
  slots: DeckSlot[];
  totalCost: number;
}

// === Unit Bonus ===

export interface UnitBonusDefinition {
  id: string;
  name: string;
  condition: BonusCondition;
  bonuses: BonusEntry[];
}

export interface BonusCondition {
  type: 'same_element' | 'same_rarity' | 'specific_cards' | 'theme' | 'role_combo';
  count?: number;
  cardIds?: string[];
  element?: Element;
  roles?: Role[];
}

export interface BonusEntry {
  stat: keyof Stats;
  value: number;
  type: 'flat' | 'percent';
}

// === 经济 ===

export type ResourceType =
  | 'gold' | 'ether' | 'iron' | 'jewels'
  | 'friendship_points' | 'rare_medals' | 'stamina' | 'battle_points'
  | 'awakening_materials' | 'rebirth_materials' | 'enhancement_protection';

export interface PlayerCurrencies {
  [key: string]: number;
}

// === 存档 ===

export interface PlayerSave {
  version: number;
  inventory: CardInstance[];
  decks: DeckDefinition[];
  currencies: PlayerCurrencies;
  clearedStages: string[];
  gachaPity: Record<string, number>;
  kingdom: KingdomState;
  settings: GameSettings;
  createdAt: string;
  updatedAt: string;
}

export interface KingdomState {
  buildings: Record<string, number>; // buildingId → level
  lastCollectTime: number;
}

export interface GameSettings {
  autoBattle: boolean;
  autoPauseOnSkill: boolean;
  battleSpeed: 1 | 2 | 3;
  soundEnabled: boolean;
  musicEnabled: boolean;
}
