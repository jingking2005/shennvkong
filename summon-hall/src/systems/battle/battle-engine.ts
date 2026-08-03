/**
 * 战斗引擎（OC-06）：回合制核心，seed 注入，输出可回放事件日志。
 * UI 只消费结果与事件；伤害常数全部来自 battle-config.ts。
 */

import type { Card } from '../../data';
import type { DB, WitchRaidBoss } from '../../db';
import type { BattleEvent } from '../../data/types';
import { prov } from '../../data/provenance';
import { mulberry32 } from './rng';
import { BATTLE_CONFIG as CFG } from './battle-config';
import { computeHit, elementalMultiplier } from './damage-calc';
import { aliveCount, deathCheck, orderBySpeed } from './status-engine';

const FILL = prov('original-fill', undefined, '离线战斗数值');

/** 10 种技能特效（渲染层消费，逻辑层只传递） */
export type SkillFx =
  | 'fire' | 'ice' | 'thunder' | 'holy' | 'shadow'
  | 'meteor' | 'wind' | 'star' | 'heal' | 'arcane';

export interface Combatant {
  instId: string;
  card: Card;
  lv: number;
  atk: number;
  hp: number;
  hpMax: number;
  def: number;
  speed: number;
  element: string;
  skillName: string;
  procChance: number;
  skillMult: number;
  skillFx: SkillFx;
  isLeader: boolean;
  /** 怒气 0..100：玩家侧满 100 才能放技能；普攻/受击积攒 */
  rage: number;
}

export interface BattleAction {
  actorInstId: string;
  actorName: string;
  targetIndex: number;
  damage: number;
  crit: boolean;
  skillUsed: boolean;
  skillName?: string;
  skillFx?: SkillFx;
  elementMult: number;
  heal?: number;
}

export interface BattleTurnResult {
  actions: BattleAction[];
  playerAlive: number;
  enemyAlive: number;
  finished: boolean;
  playerWon: boolean;
  /** 可回放事件日志（相同输入 + 相同 seed ⇒ 完全一致） */
  events: BattleEvent[];
}

/**
 * 回合制一回合：速度降序行动，procChance 触发技能。
 * 伤害 = atk × skillMult × elementMult × crit × side − def×0.5，±10%。
 */
export function runBattleTurn(
  team: Combatant[],
  enemies: Combatant[],
  seed: number,
  leaderBonus = 1.0,
  turn = 1,
): BattleTurnResult {
  const rng = mulberry32(seed);
  const actions: BattleAction[] = [];
  const events: BattleEvent[] = [];

  for (const { unit: c, side } of orderBySpeed(team, enemies)) {
    if (c.hp <= 0) continue;
    const foes = side === 'player' ? enemies : team;
    const aliveFoes = foes.filter(f => f.hp > 0);
    if (aliveFoes.length === 0) break;
    const target = aliveFoes[Math.floor(rng() * aliveFoes.length)];
    const targetIndex = foes.indexOf(target);

    // 怒气技能：玩家侧满怒才放技能（否则普攻攒怒）；敌方保持概率触发
    const rageMax = CFG.rageMax.value;
    let useSkill: boolean;
    if (side === 'player') {
      useSkill = c.rage >= rageMax;
      c.rage = useSkill ? 0 : Math.min(rageMax, c.rage + CFG.ragePerAttack.value);
    } else {
      useSkill = rng() < c.procChance;
    }
    target.rage = Math.min(rageMax, target.rage + CFG.ragePerHit.value);
    const hit = computeHit({
      atk: c.atk,
      targetDef: target.def,
      elementMult: elementalMultiplier(c.element, target.element),
      critRate: c.card.stats.critRate,
      critDamage: c.card.stats.critDamage,
      skillMult: useSkill ? c.skillMult : 1.0,
      sideBonus: side === 'player' ? leaderBonus : 1,
    }, rng);
    const em = elementalMultiplier(c.element, target.element);

    target.hp = Math.max(0, target.hp - hit.damage);
    events.push({
      turn, phase: 'attack', actorId: c.instId, targetId: target.instId,
      amount: hit.damage, effectId: useSkill ? c.skillFx : undefined, source: FILL,
    });

    actions.push({
      actorInstId: c.instId, actorName: c.card.name,
      targetIndex, damage: hit.damage, crit: hit.crit, skillUsed: useSkill,
      skillName: useSkill ? c.skillName : undefined,
      skillFx: useSkill ? c.skillFx : undefined,
      elementMult: em,
    });
  }

  const check = deathCheck(team, enemies);
  events.push({ turn, phase: 'death-check', source: FILL });
  if (check.finished) events.push({ turn, phase: 'battle-end', source: FILL });
  return {
    actions,
    playerAlive: aliveCount(team),
    enemyAlive: aliveCount(enemies),
    finished: check.finished,
    playerWon: check.playerWon,
    events,
  };
}

export interface RaidAttackResult {
  dmg: number;
  defeated: boolean;
  ptGain: number;
  outOfAp: boolean;
  skills: { actorInstId: string; skillFx: SkillFx; skillName: string }[];
  counter: { targetInstId: string; dmg: number } | null;
  events: BattleEvent[];
}

/** 讨伐魔女：对 Raid Boss 造成一段伤害并记贡献；未击杀则魔女反击 */
export function raidAttack(
  db: DB, raid: WitchRaidBoss, team: Combatant[], seed: number, turn = 1,
): RaidAttackResult {
  const rng = mulberry32(seed);
  const events: BattleEvent[] = [];
  if (db.user.battlePt <= 0) {
    return { dmg: 0, defeated: false, ptGain: 0, outOfAp: true, skills: [], counter: null, events };
  }
  db.user.battlePt -= 1;
  const leaderBonus = team.some(c => c.isLeader) ? CFG.leaderAtkBonus.value : 1.0;
  let dmg = 0;
  const skills: { actorInstId: string; skillFx: SkillFx; skillName: string }[] = [];
  for (const c of team) {
    if (c.hp <= 0) continue;
    const useSkill = c.rage >= CFG.rageMax.value;
    c.rage = useSkill ? 0 : Math.min(CFG.rageMax.value, c.rage + CFG.ragePerAttack.value);
    const mult = useSkill ? c.skillMult : 1.0;
    const em = elementalMultiplier(c.element, 'dark');
    const v = CFG.damageVariance.value;
    const hit = Math.floor(c.atk * mult * em * leaderBonus * (1 - v / 2 + rng() * v));
    dmg += hit;
    events.push({ turn, phase: 'attack', actorId: c.instId, targetId: raid.raidId, amount: hit, source: FILL });
    if (useSkill) skills.push({ actorInstId: c.instId, skillFx: c.skillFx, skillName: c.skillName || '技能' });
  }
  raid.hp = Math.max(0, raid.hp - dmg);
  raid.damageLog[db.user.uid] = (raid.damageLog[db.user.uid] || 0) + dmg;
  let ptGain = Math.floor(dmg / 100);
  if (raid.hp <= 0 && !raid.defeated) {
    raid.defeated = true;
    db.eventPoint.raidKills += 1;
    ptGain += raid.archWitch ? 500 : 100; // 击杀奖（original-fill）
  }
  db.eventPoint.points += ptGain;

  let counter: { targetInstId: string; dmg: number } | null = null;
  if (!raid.defeated) {
    const alive = team.filter(c => c.hp > 0);
    if (alive.length > 0) {
      const target = alive[Math.floor(rng() * alive.length)];
      const cdmg = Math.max(1, Math.floor(
        (raid.attack - target.def * CFG.counterDefReduction.value)
        * (CFG.counterVarianceMin.value + rng() * CFG.counterVarianceSpan.value),
      ));
      target.hp = Math.max(0, target.hp - cdmg);
      counter = { targetInstId: target.instId, dmg: cdmg };
      events.push({ turn, phase: 'attack', actorId: raid.raidId, targetId: target.instId, amount: cdmg, source: FILL });
    }
  }
  if (raid.defeated) events.push({ turn, phase: 'battle-end', source: FILL });
  return { dmg, defeated: raid.defeated, ptGain, outOfAp: false, skills, counter, events };
}
