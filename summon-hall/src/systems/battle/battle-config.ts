/**
 * 战斗数值配置（变更单 §5.2）：全部常量集中在此，可替换而不重写引擎。
 * 注意：以下数值均为 inferred 或 original-fill，不是原版恢复结果；
 * 用户批准前不得宣称逆向确认。
 */

import type { Provenance } from '../../data/provenance';

export interface BattleConfigEntry<T> {
  value: T;
  source: Provenance;
}

const INFERRED: Provenance = { level: 'inferred', sourceNote: '旧文档公式，无原版 master data 证据' };
const FILL: Provenance = { level: 'original-fill', sourceNote: '离线可玩性原创数值' };

export const BATTLE_CONFIG = {
  /** 元素克制倍率：光↔暗 1.5、火(passion)↔水/树(cool) 1.4、其余 1.0（inferred） */
  elementLightDark: { value: 1.5, source: INFERRED } as BattleConfigEntry<number>,
  elementPassionCool: { value: 1.4, source: INFERRED } as BattleConfigEntry<number>,
  elementNeutral: { value: 1.0, source: FILL } as BattleConfigEntry<number>,

  /** 伤害公式：atk × mult × em × crit × side − def × defReduction，再乘 1±variance/2（original-fill） */
  defReduction: { value: 0.5, source: FILL } as BattleConfigEntry<number>,
  damageVariance: { value: 0.2, source: FILL } as BattleConfigEntry<number>,

  /** 队长技：全队攻击 +10%（original-fill） */
  leaderAtkBonus: { value: 1.10, source: FILL } as BattleConfigEntry<number>,

  /** 技能触发率/倍率：按稀有度 tier 递增（original-fill） */
  procBase: { value: 0.25, source: FILL } as BattleConfigEntry<number>,
  procPerTier: { value: 0.08, source: FILL } as BattleConfigEntry<number>,
  procMax: { value: 0.85, source: FILL } as BattleConfigEntry<number>,
  skillMultBase: { value: 2.2, source: FILL } as BattleConfigEntry<number>,
  skillMultPerTier: { value: 0.4, source: FILL } as BattleConfigEntry<number>,

  /** 等级缩放与 HP 派生（original-fill） */
  lvScalePerLv: { value: 0.06, source: FILL } as BattleConfigEntry<number>,
  hpSoldiersMult: { value: 100, source: FILL } as BattleConfigEntry<number>,
  hpDefenseMult: { value: 10, source: FILL } as BattleConfigEntry<number>,
  hpBase: { value: 5000, source: FILL } as BattleConfigEntry<number>,

  /** 魔女反击：atk − def×0.5，方差 0.85~1.15（original-fill） */
  counterDefReduction: { value: 0.5, source: FILL } as BattleConfigEntry<number>,
  counterVarianceMin: { value: 0.85, source: FILL } as BattleConfigEntry<number>,
  counterVarianceSpan: { value: 0.3, source: FILL } as BattleConfigEntry<number>,
} as const;
