/**
 * 伤害计算（纯函数）：元素克制 + 单次命中。
 * 所有常数来自 battle-config.ts（inferred/original-fill）。
 */

import { BATTLE_CONFIG as CFG } from './battle-config';

type ElementNorm = 'light' | 'dark' | 'passion' | 'cool' | 'special';

function norm(e: string): ElementNorm {
  const s = (e || '').toLowerCase();
  if (s.includes('light') || s.includes('光')) return 'light';
  if (s.includes('dark') || s.includes('暗')) return 'dark';
  if (s.includes('passion') || s.includes('fire') || s.includes('火')) return 'passion';
  if (s.includes('cool') || s.includes('水') || s.includes('tree') || s.includes('树')) return 'cool';
  return 'special';
}

/** 元素克制倍率（inferred：光↔暗、火↔水/树；其余 original-fill 1.0） */
export function elementalMultiplier(atk: string, def: string): number {
  const a = norm(atk), d = norm(def);
  if (a === d) return CFG.elementNeutral.value;
  if ((a === 'light' && d === 'dark') || (a === 'dark' && d === 'light')) return CFG.elementLightDark.value;
  if ((a === 'passion' && d === 'cool') || (a === 'cool' && d === 'passion')) return CFG.elementPassionCool.value;
  return CFG.elementNeutral.value;
}

export interface HitInput {
  atk: number;
  targetDef: number;
  elementMult: number;
  critRate: number;    // 0..100
  critDamage: number;  // 0..100
  skillMult: number;
  sideBonus: number;
}

export interface HitResult {
  damage: number;
  crit: boolean;
}

/** 单次命中：atk × skillMult × em × crit × side − def×0.5，±10% 方差 */
export function computeHit(input: HitInput, rng: () => number): HitResult {
  const crit = rng() < input.critRate / 100;
  const critMult = crit ? 1 + input.critDamage / 100 : 1;
  let dmg = input.atk * input.skillMult * input.elementMult * critMult * input.sideBonus;
  dmg = Math.max(1, dmg - input.targetDef * CFG.defReduction.value);
  const v = CFG.damageVariance.value;
  dmg = Math.floor(dmg * (1 - v / 2 + rng() * v));
  return { damage: Math.max(1, dmg), crit };
}
