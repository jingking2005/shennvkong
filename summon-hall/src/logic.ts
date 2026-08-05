/**
 * 逻辑层 — 纯函数游戏逻辑（可测试、可回放）
 * ExploreStage / EvolveCard / BattleEngine / EnhanceCard
 * 所有随机走 seeded RNG，保证确定性。
 */

import type { Card, Rarity } from './data';
import { getCard, cardsByRarity, RARITY_RANK } from './data';
import type { DB, OwnedCard, Stage, WitchRaidBoss } from './db';
import { newInstId, makeOwnedCard, RARITY_TIER } from './db';
import type { Combatant, SkillFx } from './systems/battle/battle-engine';
import { BATTLE_CONFIG } from './systems/battle/battle-config';

// ─────────────────────────── Seeded RNG（单一来源：systems/battle/rng）───────────────────────────
export { mulberry32 } from './systems/battle/rng';

// ─────────────────────────── 战斗引擎（OC-06 已抽至 systems/battle）───────────────────────────
export type { Combatant, SkillFx, BattleAction, BattleTurnResult } from './systems/battle/battle-engine';
export { runBattleTurn, raidAttack } from './systems/battle/battle-engine';
export { elementalMultiplier } from './systems/battle/damage-calc';
import { mulberry32 } from './systems/battle/rng';

/** 10 种特效对应的技能名（skillName 缺失/物品名时使用） */
export const FX_NAMES: Record<SkillFx, string> = {
  fire: '烈焰爆炎', ice: '极冰霜华', thunder: '雷霆万钧', holy: '圣光审判',
  shadow: '暗影侵蚀', meteor: '陨石天坠', wind: '疾风龙卷', star: '星辰崩落',
  heal: '生命之泉', arcane: '奥术飞弹',
};

/**
 * 为一张卡分配技能特效：
 * - 元素决定基础流派（火→火球/陨石，水树→冰/龙卷，光→圣光/星辰，暗→暗影/奥术）
 * - 稀有度越高特效越强（LR/UR+ 倾向陨石/圣光/星辰等重特效）
 */
export function assignSkillFx(element: string, rarity: string): SkillFx {
  const e = (element || '').toLowerCase();
  const rank = RARITY_RANK[rarity as keyof typeof RARITY_RANK] || 1;
  const heavy = rank >= 5; // LR/UR/VR/X 用重特效
  if (e.includes('light') || e.includes('光')) return heavy ? 'star' : 'holy';
  if (e.includes('dark') || e.includes('暗')) return heavy ? 'shadow' : 'arcane';
  if (e.includes('cool') || e.includes('水') || e.includes('tree') || e.includes('树')) {
    return heavy ? 'ice' : 'wind';
  }
  return heavy ? 'meteor' : 'fire';
}

// ─────────────────────────── 有效属性（含进化加成；常数来自 battle-config）───────────────────────────
export function ownedToCombatant(o: OwnedCard, isLeader = false, db?: DB): Combatant | null {
  const card = getCard(o.cardId);
  if (!card) return null;
  const C = BATTLE_CONFIG;
  const stage = Math.min(Math.max(0, o.evoStage), 3);
  const form = FORM_STAGES[stage] as FormStage;
  // 形态满级值 = UR 官方满级 × 形态倍率（HUR×1.2 / GUR×1.5 / XUR×2.0）
  const maxAtk = formMaxStat(card, stage, 'atk');
  const maxDef = formMaxStat(card, stage, 'def');
  const maxSoldiers = formMaxStat(card, stage, 'soldiers');
  const maxLvForm = cardMaxLv(card, stage);
  // Lv1 基础值：反推（满级值 ÷ (1+(maxLv-1)×0.06)），保证升满正好 = 形态满级值（平均分配）
  const baseAtk = Math.round(maxAtk / (1 + (maxLvForm - 1) * C.lvScalePerLv.value));
  const baseDef = Math.round(maxDef / (1 + (maxLvForm - 1) * C.lvScalePerLv.value));
  const baseSoldiers = Math.round(maxSoldiers / (1 + (maxLvForm - 1) * C.lvScalePerLv.value));
  const lvScale = 1 + (o.lv - 1) * C.lvScalePerLv.value;
  const atk = Math.floor(Math.floor(baseAtk * lvScale) + o.atkBonus);
  const hpMax = Math.floor(
    Math.floor(
      (baseSoldiers * C.hpSoldiersMult.value + baseDef * C.hpDefenseMult.value + C.hpBase.value) * lvScale,
    ) + o.hpBonus,
  );
  const tier = RARITY_RANK[card.rarity];
  const fx = assignSkillFx(card.element, card.rarity);
  const cb: Combatant = {
    instId: o.instId, card, lv: o.lv,
    atk, hp: hpMax, hpMax, def: baseDef,
    speed: Math.floor((card.stats.speed || 100) * (1 + (o.lv - 1) * 0.03)),
    element: card.element,
    // 官方中文技能名（按形态）→ 战斗显示；否则用英文名/特效名
    skillName: card.skillsZh?.[form]?.name
      ?? (card.skillName && card.skillName.length <= 16 ? card.skillName : FX_NAMES[fx]),
    procChance: Math.min(C.procMax.value, C.procBase.value + tier * C.procPerTier.value),
    skillMult: C.skillMultBase.value + tier * C.skillMultPerTier.value,
    skillFx: fx,
    isLeader,
    rage: 0,
  };
  // 装备加成（若持有装备）
  if (db && o.equipInstId) {
    const equip = (db.inventory.equips || []).find(e => e.instId === o.equipInstId);
    applyEquip(cb, equip);
  }
  return cb;
}

/** 队长技能：全队攻击 +10% */
export function leaderAtkBonus(team: Combatant[]): number {
  return team.some(c => c.isLeader) ? 1.10 : 1.0;
}

// ─────────────────────────── 战斗体力（AP）恢复 ───────────────────────────

/** 每点 AP 恢复间隔（毫秒）：6 分钟一点 */
export const AP_RECOVER_MS = 6 * 60 * 1000;
/** 每点行动力恢复间隔（毫秒）：3 分钟一点 */
export const ENERGY_RECOVER_MS = 3 * 60 * 1000;

// ─────────────────────────── 每日签到 ───────────────────────────

export interface LoginReward {
  gold?: number; gems?: number; friendPt?: number;
  tickets?: Record<string, number>;
  label: string;
}

/** 7 日签到表（循环）；第 7 天为大奖 */
export const LOGIN_REWARDS: LoginReward[] = [
  { gold: 5000, label: '金币 ×5000' },
  { gems: 50, label: '宝石 ×50' },
  { friendPt: 2000, label: '友情点 ×2000' },
  { gems: 100, label: '宝石 ×100' },
  { tickets: { fate: 1 }, label: '命运召唤券 ×1' },
  { gems: 150, label: '宝石 ×150' },
  { gems: 200, tickets: { legend: 1 }, label: '宝石 ×200 + 传说券 ×1' },
];

function todayStr(now: number): string {
  return new Date(now).toISOString().slice(0, 10);
}

/** 今日是否可签到 */
export function canClaimLogin(db: DB, now = Date.now()): boolean {
  return db.user.loginLastClaim !== todayStr(now);
}

/**
 * 领取今日签到奖励。连续签到（昨天领过）streak+1，断签重置为 1。
 * 表位置 = (streak-1) % 7。
 */
export function claimDailyLogin(db: DB, now = Date.now()): { ok: boolean; reward?: LoginReward; day?: number; reason?: string } {
  const u = db.user;
  const today = todayStr(now);
  if (u.loginLastClaim === today) return { ok: false, reason: '今日已签到' };
  const yesterday = todayStr(now - 86400000);
  u.loginStreak = u.loginLastClaim === yesterday ? u.loginStreak + 1 : 1;
  u.loginLastClaim = today;
  const idx = (u.loginStreak - 1) % LOGIN_REWARDS.length;
  const r = LOGIN_REWARDS[idx];
  if (r.gold) u.gold += r.gold;
  if (r.gems) u.gems += r.gems;
  if (r.friendPt) u.friendPt += r.friendPt;
  if (r.tickets) for (const [k, v] of Object.entries(r.tickets)) u.tickets[k] = (u.tickets[k] ?? 0) + v;
  return { ok: true, reward: r, day: idx + 1 };
}

/**
 * 结算 AP 随时间恢复：每 AP_RECOVER_MS 恢复 1 点，最多 battlePtMax。
 * 返回当前 AP 与下次恢复倒计时（秒）。
 */
export function tickBattlePt(db: DB, now = Date.now()): { battlePt: number; nextInSec: number } {
  const u = db.user;
  if (u.battlePt >= u.battlePtMax) {
    u.battlePtRecoverAt = now;
    return { battlePt: u.battlePt, nextInSec: 0 };
  }
  let elapsed = now - u.battlePtRecoverAt;
  if (elapsed <= 0) return { battlePt: u.battlePt, nextInSec: Math.ceil(AP_RECOVER_MS / 1000) };
  const gained = Math.min(Math.floor(elapsed / AP_RECOVER_MS), u.battlePtMax - u.battlePt);
  if (gained > 0) {
    u.battlePt += gained;
    u.battlePtRecoverAt += gained * AP_RECOVER_MS;
    if (u.battlePt >= u.battlePtMax) u.battlePtRecoverAt = now;
  }
  const nextInSec = Math.max(0, Math.ceil((u.battlePtRecoverAt + AP_RECOVER_MS - now) / 1000));
  return { battlePt: u.battlePt, nextInSec };
}

/** 结算行动力随时间恢复：每 ENERGY_RECOVER_MS 恢复 1 点，最多 energyMax */
export function tickEnergy(db: DB, now = Date.now()): void {
  const u = db.user;
  if (u.energy >= u.energyMax) { u.energyRecoverAt = now; return; }
  // 月卡特权：体力恢复速度 +50%（每点所需毫秒 × 2/3）
  const recoverMs = u.monthCardUntil > now ? ENERGY_RECOVER_MS * 2 / 3 : ENERGY_RECOVER_MS;
  const elapsed = now - u.energyRecoverAt;
  if (elapsed <= 0) return;
  const gained = Math.min(Math.floor(elapsed / recoverMs), u.energyMax - u.energy);
  if (gained > 0) {
    u.energy += gained;
    u.energyRecoverAt += gained * recoverMs;
    if (u.energy >= u.energyMax) u.energyRecoverAt = now;
  }
}

// ─────────────────────────── 探索闯关 ───────────────────────────

/** 探索掉落卡片入库（N/R 狗粮卡） */
function grantLootCard(db: DB, rarity: Rarity, rng: () => number): void {
  const pool = cardsByRarity(rarity);
  if (!pool.length) return;
  const c = pool[Math.floor(rng() * pool.length)];
  db.inventory.cards.push(makeOwnedCard(c.id, 1 + (RARITY_TIER[rarity] ?? 0) * 2));
}

export interface ExploreResult {
  ok: boolean;
  reason?: string;
  energySpent: number;
  progressGain: number;
  newProgress: number;
  event: 'none' | 'loot' | 'mob' | 'chest' | 'witch';
  lootGold: number;
  lootGems: number;
  lootCardRarity?: string;
  lootPotion?: number;
  witchRaidId?: string;
  completed: boolean;      // 到达 100%
  firstClear: boolean;     // 本次是否首通
  firstClearReward?: string;
}

/**
 * ExploreStage：点「进军」走一步
 * - 固定扣 10 点行动力
 * - 每关固定 totalSteps 步，每步推进 100%/N（早期 5 步、后期 10 步）
 * - 途中随机：魔女 25% / 小怪 40% / 拾取 20% / 宝箱 15%
 * - 通关那一步（100%）必遇魔女
 */
export function ExploreStage(db: DB, stage: Stage, seed: number): ExploreResult {
  const rng = mulberry32(seed);
  const STEP_COST = 10;
  const res: ExploreResult = {
    ok: false, energySpent: 0, progressGain: 0, newProgress: stage.progress,
    event: 'none', lootGold: 0, lootGems: 0, completed: false, firstClear: false,
  };
  stage.energyCost = STEP_COST;
  if (db.user.energy < STEP_COST) { res.reason = '体力不足'; return res; }

  db.user.energy -= STEP_COST;
  res.energySpent = STEP_COST;
  res.ok = true;

  stage.stepsTaken = (stage.stepsTaken || 0) + 1;

  // 固定步数：每步推进 100%/totalSteps
  const total = Math.max(1, stage.totalSteps || 5);
  const gain = 1 / total;
  res.progressGain = gain;
  const wasBelow = stage.progress < 1;
  stage.progress = Math.min(1, stage.progress + gain);
  res.newProgress = stage.progress;

  // 到达 100%（通关那一步必是魔女）
  const atEnd = stage.progress >= 1 && wasBelow;
  if (atEnd) {
    res.completed = true;
    res.event = 'witch';
    // 首通强制大魔女，之后通关普通魔女守关
    const forceArch = !stage.archEncountered;
    res.witchRaidId = spawnWitch(db, stage, rng, '', forceArch);
    if (forceArch) stage.archEncountered = true;
    stage.witchEncounters += 1;
    return res;
  }

  // ── 途中随机事件：魔女 25% / 小怪 40% / 拾取 20% / 宝箱 15% ──
  const roll = rng();
  if (roll < 0.25) {
    res.event = 'witch';
    res.witchRaidId = spawnWitch(db, stage, rng, '', false);
    stage.witchEncounters += 1;
  } else if (roll < 0.65) {
    res.event = 'mob';
    res.lootGold = Math.floor(150 + rng() * 400);
    db.user.gold += res.lootGold;
    res.lootCardRarity = 'N';
    grantLootCard(db, 'N', rng);
  } else if (roll < 0.85) {
    res.event = 'loot';
    res.lootGold = Math.floor(200 + rng() * 800);
    res.lootGems = rng() < 0.25 ? Math.floor(1 + rng() * 5) : 0;
    db.user.gold += res.lootGold;
    db.user.gems += res.lootGems;
    if (rng() < 0.35) {
      res.lootCardRarity = rng() < 0.85 ? 'N' : 'R';
      grantLootCard(db, res.lootCardRarity as Rarity, rng);
    } else if (rng() < 0.5) {
      const n = 1 + (rng() < 0.3 ? 1 : 0);
      db.inventory.materials.upgradePotion = (db.inventory.materials.upgradePotion || 0) + n;
      res.lootPotion = n;
    }
  } else {
    // 宝箱：金币 + 宝石，30% 掉 R 卡
    res.event = 'chest';
    res.lootGold = Math.floor(500 + rng() * 1000);
    res.lootGems = Math.floor(1 + rng() * 8);
    db.user.gold += res.lootGold;
    db.user.gems += res.lootGems;
    if (rng() < 0.3) {
      res.lootCardRarity = 'R';
      grantLootCard(db, 'R', rng);
    }
  }
  return res;
}

/** 触发魔女；forceArch=true 时强制大魔女 */
export function spawnWitch(
  db: DB, stage: Stage, rng: () => number, bossCardId = '', forceArch = false,
): string {
  const level = 80 + Math.floor(db.eventPoint.raidKills * 0.8 + rng() * 120);
  const arch = forceArch || rng() < 0.08;
  // ── HP 平衡：关卡基础难度（由弱到强）与队伍动态适配取高 ──
  // 目标战斗长度由关卡 targetRounds 决定（早期 3 回合弱、后期 7 回合强）；大魔女约 2.2 倍
  const rounds = Math.max(2, stage.targetRounds || 6);
  const dpt = estimateTeamDPT(db);
  const avgHp = estimateTeamHP(db);
  const hpMax = Math.floor(
    Math.max(stage.enemyPower * (arch ? 4 : 1.5), dpt * rounds * (arch ? 2.2 : 1)) * (0.9 + rng() * 0.2),
  );
  // ── 攻击平衡：普通魔女每击约打掉单卡 10% HP、大魔女 18%（用户反馈打不过，下调）──
  const attack = Math.floor(
    Math.max(stage.enemyPower * 0.12, avgHp * (arch ? 0.18 : 0.10)) * (0.9 + rng() * 0.2),
  );
  const raid: WitchRaidBoss = {
    raidId: newInstId(),
    bossCardId,
    name: arch ? '超·幻想魔女' : '幻想魔女',
    level, hp: hpMax, hpMax,
    attack,
    archWitch: arch,
    discoveredBy: db.user.name,
    expiresAt: Date.now() + (arch ? 30 : 120) * 60 * 1000,
    damageLog: {}, defeated: false, claimed: false,
  };
  db.raids.push(raid);
  return raid.raidId;
}

// ─────────────────────────── 队伍战力估算（敌人动态平衡用）───────────────────────────

/** 估算队伍每回合期望总输出（库存最强 5 张；怒气制技能约每 4 击 1 次，有效触发率取 0.25；×1.45 补偿元素克制/队长/暴击） */
export function estimateTeamDPT(db: DB): number {
  const EFFECTIVE_SKILL_RATE = 0.25;
  const pows = db.inventory.cards
    .map(o => {
      const c = ownedToCombatant(o);
      return c ? c.atk * (1 + EFFECTIVE_SKILL_RATE * (c.skillMult - 1)) : 0;
    })
    .sort((a, b) => b - a);
  return Math.max(3000, pows.slice(0, 5).reduce((s, v) => s + v, 0) * 1.45);
}

/** 估算队伍平均单卡 HP（库存最强 5 张） */
export function estimateTeamHP(db: DB): number {
  const hps = db.inventory.cards
    .map(o => {
      const c = ownedToCombatant(o);
      return c ? c.hpMax : 0;
    })
    .sort((a, b) => b - a)
    .slice(0, 5);
  if (!hps.length) return 10000;
  return Math.max(6000, hps.reduce((s, v) => s + v, 0) / hps.length);
}

// ─────────────────────────── 进化（官方形态体系）───────────────────────────

/** 旧升星体系上限（无官方数据卡仍按星级合卡） */
export const MAX_STAR = 10;
/** 每星属性倍率：n 星 = 基础 × 1.2^n（攻击/体力/速度，复利）（旧体系） */
export const STAR_STAT_MULT = 1.2;

/** 形态档位 → 官方形态键（evoStage 0-3） */
export const FORM_STAGES = ['UR', 'HUR', 'GUR', 'XUR'] as const;
export type FormStage = (typeof FORM_STAGES)[number];

/** 形态属性倍率（用户规则）：HUR=UR×1.2 / GUR=UR×1.5 / XUR=UR×2.0 */
export const FORM_MULT: Record<FormStage, number> = { UR: 1, HUR: 1.2, GUR: 1.5, XUR: 2 };

/** 形态满级值 = UR 官方满级值 × 该形态倍率（HUR 满级 = UR满级×1.2 …） */
export function formMaxStat(card: Card, stage: number, stat: 'atk' | 'def' | 'soldiers'): number {
  const ur = card.officialForms?.UR;
  const base = ur ? ur[stat] : card.stats[stat === 'atk' ? 'attack' : stat === 'def' ? 'defense' : 'soldiers'];
  return Math.floor(base * FORM_MULT[FORM_STAGES[Math.min(Math.max(0, stage), 3)] as FormStage]);
}

/** 每档对应的星级视觉（H★=5星银 / G★=7星金 / X★=10星彩虹） */
export const FORM_STAR_GLYPH: Record<FormStage, number> = { UR: 0, HUR: 5, GUR: 7, XUR: 10 };

/** 官方形态显示名（按稀有度）：H档 N→HN / R→HR / SR→HSR / UR→HUR / LR→HLR；G档 SR→GSR / UR→GUR / LR→GLR；X档 SR→XSR / UR→XUR / LR→XLR */
const H_NAME: Record<string, string> = { N: 'HN', R: 'HR', SR: 'HSR', UR: 'HUR', LR: 'HLR', X: 'HX', VR: 'HVR' };
const G_NAME: Record<string, string> = { SR: 'GSR', UR: 'GUR', LR: 'GLR', VR: 'GVR' };
const X_NAME: Record<string, string> = { SR: 'XSR', UR: 'XUR', LR: 'XLR' };

/** 形态显示名（evoStage 0=基础稀有度名 / 1=H★ / 2=G★ / 3=X★） */
export function formName(rarity: string, stage: number): string {
  if (stage <= 0) return rarity;
  if (stage === 1) return H_NAME[rarity] || `${rarity}★`;
  if (stage === 2) return G_NAME[rarity] || `${rarity}★`;
  if (stage === 3) return X_NAME[rarity] || `${rarity}★`;
  return rarity;
}

/** 该卡官方形态档位数（0-4：无官方数据=1 档只有 UR） */
export function formStageCount(card: Card): number {
  const f = card.officialForms;
  if (!f) return 1;
  return FORM_STAGES.filter(s => f[s]).length;
}

/** 某档是否有官方数据 */
export function hasForm(card: Card, stage: number): boolean {
  const f = card.officialForms;
  if (!f) return stage === 0;
  return !!f[FORM_STAGES[stage] as FormStage];
}

/** 该档官方满级等级；无官方数据回退旧公式（rank×20 + stage×10） */
export function formMaxLv(card: Card, stage: number): number {
  return cardMaxLv(card, stage);
}

/**
 * 官方形态合卡成功率（%）：基础 50% + 素材星级加成（同星素材每张 +25%，低星按比例）+ 同名加成（+15/张）。
 *  → 3星主 + 2×3星 = 100%；3星主 + 2×0星 = 50%；同名卡额外加成。封顶 100。
 */
export function formEvolveRateDetail(mainStage: number, mats: { evoStage: number; cardId: string }[], mainCardId: string): number {
  let starBonus = 0;
  let sameNameBonus = 0;
  for (const m of mats) {
    if (mainStage > 0) {
      const ratio = Math.min(1, m.evoStage / mainStage);
      starBonus += Math.round(25 * ratio);
    } else {
      starBonus += 25;
    }
    if (m.cardId === mainCardId) sameNameBonus += 15;
  }
  return Math.min(100, 50 + starBonus + sameNameBonus);
}

/** 形态合卡成功率（%）：按目标档位递减（原创配置，非原版数值）
 * →H★ 70% / →G★ 50% / →X★ 30%；加成卡与失败补偿可叠加上限 100。 */
export function formEvolveRate(stage: number): number {
  if (stage >= 3) return 30;
  if (stage === 2) return 50;
  return 70;
}

/**
 * 升星成功率（%）：两张同名卡、星级差 ≤1 可合，结果 = max(星级)+1。
 * 同星合成：(10-目标星)×10%（→1星90%、→2星80%、→3星70%…→9星10%）
 * 混星合成：再 -10%（如 1星+2星→3星 60%，3星+2星→4星 50%），保底 5%。
 * 规则为离线原创配置，非原版数值。（旧体系保留：无官方数据卡仍按星级合卡）
 */
export function evolveRate(starA: number, starB: number): number | null {
  if (Math.abs(starA - starB) > 1) return null;
  const target = Math.max(starA, starB) + 1;
  if (target > MAX_STAR) return null;
  const base = (10 - target) * 10;
  const mixed = starA !== starB;
  return Math.max(5, base - (mixed ? 10 : 0));
}

export const EVOLVE_FAIL_BONUS = 30;       // 每次失败补偿 +30%（同一主卡累积）
export const EVOLVE_FAIL_BONUS_MAX = 3;    // 最多累积 3 次（+90%）
export interface EvolvePrep {
  ok: boolean;
  reason?: string;
  rate: number;          // 最终成功率（含加成卡+失败补偿）%，封顶 100
  boost: number;         // 加成卡提供的加成 %
  bonus: number;         // 失败补偿加成 %
  success: boolean;
  newEvoStage: number;
  inheritedAtk: number;
  inheritedHp: number;
}

/** 加成卡成功率提升（%）：稀有度差 0:+10 / +1:15 / +2:30 / +3:60 / ≥+4:100；低于主卡不加成 */
export function evolveBoostRate(targetRarity: string, boosterRarity: string): number {
  const diff = (RARITY_RANK[boosterRarity as keyof typeof RARITY_RANK] ?? 0) -
    (RARITY_RANK[targetRarity as keyof typeof RARITY_RANK] ?? 0);
  if (diff < 0) return 0;
  if (diff >= 4) return 100;
  return [10, 15, 30, 60][diff];
}

/**
 * 预计算升星结果（不改动 db）；rng 注入便于测试。
 *
 * 【官方形态卡】（有 officialForms）：按形态档合卡
 *   - 素材形态必须与主卡同档（如 HUR 主卡用 HUR 素材）
 *   - 规则 A：1 张同名同形态卡 → 结果 = 下一形态档
 *   - 规则 B：2 张同稀有度同形态卡（无需同名）→ 结果 = 下一形态档
 *   - 成功率 formEvolveRate(目标档) + 加成卡 + 失败补偿
 *
 * 【无官方数据卡】：旧星级逻辑（同名卡×1 星级差≤1 / 同稀有度×2）
 */
export function prepareEvolve(db: DB, instA: string, matInsts: string[], rng: () => number = Math.random, inheritRate = 0.08, boosterInsts: string[] = []): EvolvePrep {
  const a = db.inventory.cards.find(c => c.instId === instA);
  const res: EvolvePrep = { ok: false, rate: 0, boost: 0, bonus: 0, success: false, newEvoStage: 0, inheritedAtk: 0, inheritedHp: 0 };
  if (!a) { res.reason = '卡牌不存在'; return res; }
  const mats = matInsts.map(id => db.inventory.cards.find(c => c.instId === id));
  if (mats.some(m => !m)) { res.reason = '素材卡不存在'; return res; }
  if (new Set(matInsts).size !== matInsts.length || matInsts.includes(instA)) { res.reason = '素材卡重复'; return res; }
  const cardA = getCard(a.cardId)!;
  // 加成卡校验：存在、不重复、不是主卡/素材
  const boosters = boosterInsts.map(id => db.inventory.cards.find(c => c.instId === id));
  if (boosters.some(b => !b)) { res.reason = '加成卡不存在'; return res; }
  const allIds = [...matInsts, ...boosterInsts];
  if (new Set(allIds).size !== allIds.length || boosterInsts.includes(instA)) { res.reason = '加成卡与素材重复'; return res; }

  let rate: number;
  if (cardA.officialForms) {
    // ── 官方形态合卡（素材放宽：同稀有度任意星级即可）──
    const stage = Math.min(Math.max(0, a.evoStage), 3);
    if (stage >= 3) { res.reason = `已达 ${formName(cardA.rarity, 3)} 上限`; return res; }
    const targetStage = stage + 1;
    if (!hasForm(cardA, targetStage)) {
      res.reason = `该卡无 ${formName(cardA.rarity, targetStage)} 形态`;
      return res;
    }
    // 素材校验：1 张同名（任意星级）或 2 张同稀有度（任意星级）
    if (mats.length === 1) {
      const b = mats[0]!;
      if (b.cardId !== a.cardId) { res.reason = '单素材必须同名卡'; return res; }
    } else if (mats.length === 2) {
      const rarA = cardA.rarity;
      if (mats.some(m => getCard(m!.cardId)?.rarity !== rarA)) { res.reason = '双素材必须与主卡同稀有度'; return res; }
    } else {
      res.reason = '需要 1 张同名卡或 2 张同稀有度卡'; return res;
    }
    // 成功率：基础 50% + 素材星级加成（同星素材每张 +25%，低星按比例）+ 同名加成
    //   → 3星主 + 2×3星 = 100%；3星主 + 2×0星 = 50%（低）；同名卡额外 +15%
    let starBonus = 0;
    let sameNameBonus = 0;
    for (const m of mats) {
      if (stage > 0) {
        const ratio = Math.min(1, m!.evoStage / stage);
        starBonus += Math.round(25 * ratio);
      } else {
        // 0 星主卡：素材有星即全额（0星主卡素材同星）
        starBonus += m!.evoStage >= 0 ? 25 : 0;
      }
      if (m!.cardId === a.cardId) sameNameBonus += 15;
    }
    rate = Math.min(100, 50 + starBonus + sameNameBonus);
    res.newEvoStage = targetStage;
  } else {
    // ── 旧星级逻辑（无官方数据）──
    if (a.evoStage >= MAX_STAR) { res.reason = `已达 ${MAX_STAR} 星上限`; return res; }
    if (mats.length === 1) {
      const b = mats[0]!;
      if (b.cardId !== a.cardId) { res.reason = '单素材必须同名卡'; return res; }
      const r = evolveRate(a.evoStage, b.evoStage);
      if (r === null) { res.reason = '星级差超过 1 不能合成'; return res; }
      rate = r;
      res.newEvoStage = Math.max(a.evoStage, b.evoStage) + 1;
    } else if (mats.length === 2) {
      const rarA = cardA.rarity;
      if (mats.some(m => getCard(m!.cardId)?.rarity !== rarA)) { res.reason = '双素材必须与主卡同稀有度'; return res; }
      rate = evolveRate(a.evoStage, a.evoStage)!;
      res.newEvoStage = a.evoStage + 1;
    } else {
      res.reason = '需要 1 张同名卡或 2 张同稀有度卡'; return res;
    }
  }

  // 继承：各素材均摊（总量与单素材一致；满级素材继承 ×1.5）
  for (const m of mats) {
    const mc = getCard(m!.cardId)!;
    const mMax = m!.lv >= cardMaxLv(mc, m!.evoStage);
    const ir = (mMax ? inheritRate * 1.5 : inheritRate) / mats.length;
    const mAtk = mc.stats.attack * (1 + (m!.lv - 1) * 0.06) + m!.atkBonus;
    const mHp = (mc.stats.soldiers * 100 + mc.stats.defense * 10 + 5000) * (1 + (m!.lv - 1) * 0.06) + m!.hpBonus;
    res.inheritedAtk += Math.floor(mAtk * ir);
    res.inheritedHp += Math.floor(mHp * ir);
  }

  // 加成卡加成（%）：按稀有度差累加（多张可叠加；rate 最终封顶 100）
  let boost = 0;
  for (const b of boosters) {
    const bc = getCard(b!.cardId)!;
    boost += evolveBoostRate(cardA.rarity, bc.rarity);
  }

  // 失败补偿：同一主卡每失败一次 +30%（上限 +90%），成功清零
  const bonus = Math.min(EVOLVE_FAIL_BONUS_MAX, a.evoFailStacks ?? 0) * EVOLVE_FAIL_BONUS;

  res.ok = true;
  res.boost = boost;
  res.bonus = bonus;
  res.rate = Math.min(100, rate + boost + bonus);
  res.success = rng() * 100 < res.rate;
  return res;
}

/**
 * 降星保底：≥7 星不降（回退到当前星=不掉档）；5/6 星只降到 5 星；<5 星正常降 1 星（0 星不降）。
 */
export function evolveFailureStar(star: number): number {
  if (star >= 7) return star;
  if (star >= 5) return 5;
  return Math.max(0, star - 1);
}

/**
 * 应用升星结果：成功=主卡升形态/加星+继承、素材消耗+加成卡消耗+失败补偿清零；
 * 失败=主卡保持当前形态（官方卡）/按保底规则降星（旧体系卡）、素材+加成卡损毁、失败补偿 +1 累积。
 */
export function applyEvolve(db: DB, instA: string, matInsts: string[], prep: EvolvePrep, boosterInsts: string[] = []): void {
  const inv = db.inventory;
  const a = inv.cards.find(c => c.instId === instA);
  if (!a || !prep.ok) return;
  if (prep.success) {
    a.atkBonus += prep.inheritedAtk;
    a.hpBonus += prep.inheritedHp;
    a.evoStage = prep.newEvoStage;
    a.evoFailStacks = 0;
  } else {
    // 官方形态卡：失败不掉档（素材损毁 + 补偿累积）；旧体系卡：按保底规则降星
    const cardA = getCard(a.cardId);
    if (!cardA?.officialForms) {
      a.evoStage = evolveFailureStar(a.evoStage);
    }
    a.evoFailStacks = (a.evoFailStacks ?? 0) + 1;
  }
  const drop = new Set([...matInsts, ...boosterInsts]);
  inv.cards = inv.cards.filter(c => !drop.has(c.instId));
}

export function maxLv(rarity: string, evoStage: number): number {
  const base = RARITY_RANK[rarity as keyof typeof RARITY_RANK] || 1;
  return base * 20 + evoStage * 10;
}

/** 卡片在该形态档位的等级上限（官方形态卡用官方 maxLv，否则旧公式） */
export function cardMaxLv(card: Card, stage: number): number {
  const f = card.officialForms?.[FORM_STAGES[Math.min(Math.max(0, stage), 3)] as FormStage];
  if (f?.maxLv) return f.maxLv;
  return maxLv(card.rarity, stage);
}

// ─────────────────────────── 装备（X 级装备卡）───────────────────────────

export type EquipKind = 'atkFlat' | 'hpFlat' | 'speed' | 'atkMult' | 'globalMult' | 'revive';

export interface EquipDef {
  cardId: string;
  name: string;
  kind: EquipKind;
  /** 数值描述（攻/体/速为数值；乘区为百分比；复活为次数） */
  value: number;
  desc: string;
}

const EQUIP_KINDS: EquipKind[] = ['atkFlat', 'hpFlat', 'speed', 'atkMult', 'globalMult', 'revive'];

/** X 级卡 → 装备定义：按 cardId 稳定哈希分配 6 种效果（原创规则，非原版数值） */
export function equipDefFor(cardId: string): EquipDef | null {
  const card = getCard(cardId);
  if (!card || card.rarity !== 'X') return null;
  let h = 0;
  for (let i = 0; i < cardId.length; i++) h = (h * 31 + cardId.charCodeAt(i)) >>> 0;
  const kind = EQUIP_KINDS[h % EQUIP_KINDS.length];
  const tier = (h >> 3) % 3; // 0/1/2 三档强度
  switch (kind) {
    case 'atkFlat':   return { cardId, name: card.name, kind, value: 120 + tier * 120, desc: `攻击力 +${120 + tier * 120}` };
    case 'hpFlat':    return { cardId, name: card.name, kind, value: 900 + tier * 900, desc: `生命力 +${900 + tier * 900}` };
    case 'speed':     return { cardId, name: card.name, kind, value: 6 + tier * 4, desc: `速度 +${6 + tier * 4}` };
    case 'atkMult':   return { cardId, name: card.name, kind, value: 6 + tier * 4, desc: `攻击力 ×${(1 + (6 + tier * 4) / 100).toFixed(2)}` };
    case 'globalMult': return { cardId, name: card.name, kind, value: 4 + tier * 3, desc: `全属性 ×${(1 + (4 + tier * 3) / 100).toFixed(2)}` };
    case 'revive':    return { cardId, name: card.name, kind, value: 1, desc: '战斗死亡时复活 1 次（50% HP）' };
  }
}

/** 装备新装备：目标槽位已有时直接替换（旧装备留在装备库，不消耗） */
export function equipCard(db: DB, cardInstId: string, equipInstId: string): EquipDef | null {
  const card = db.inventory.cards.find(c => c.instId === cardInstId);
  const equip = (db.inventory.equips || []).find(e => e.instId === equipInstId);
  if (!card || !equip) return null;
  card.equipInstId = equipInstId;
  return equipDefFor(equip.cardId);
}

/** 卸下装备 */
export function unequipCard(db: DB, cardInstId: string): void {
  const card = db.inventory.cards.find(c => c.instId === cardInstId);
  if (card) card.equipInstId = undefined;
}

/** 装备实例入库（元素池抽到的 X 卡） */
export function addEquipToInventory(db: DB, cardId: string): string {
  const inv = db.inventory;
  if (!inv.equips) inv.equips = [];
  const e = { instId: newInstId(), cardId, gainedAt: Date.now() };
  inv.equips.push(e);
  return e.instId;
}

/** 战斗面板加成：装备效果应用到 Combatant（含复活次数） */
export function applyEquip(cb: Combatant, equip: { cardId: string } | undefined): void {
  if (!equip) return;
  const def = equipDefFor(equip.cardId);
  if (!def) return;
  switch (def.kind) {
    case 'atkFlat': cb.atk += def.value; break;
    case 'hpFlat': cb.hpMax += def.value; cb.hp += def.value; break;
    case 'speed': cb.speed += def.value; break;
    case 'atkMult': cb.atk = Math.floor(cb.atk * (1 + def.value / 100)); break;
    case 'globalMult': {
      const m = 1 + def.value / 100;
      cb.atk = Math.floor(cb.atk * m);
      cb.hpMax = Math.floor(cb.hpMax * m);
      cb.hp = Math.floor(cb.hp * m);
      cb.speed = Math.floor(cb.speed * m);
      break;
    }
    case 'revive': cb.reviveCharges = def.value; break;
  }
}

// ─────────────────────────── 强化（喂狗粮）───────────────────────────

export interface EnhanceResult {
  ok: boolean;
  reason?: string;
  expGain: number;
  lvBefore: number;
  lvAfter: number;
  goldSpent: number;
}

export function EnhanceCard(db: DB, targetInst: string, fodderInsts: string[]): EnhanceResult {
  const inv = db.inventory;
  const target = inv.cards.find(c => c.instId === targetInst);
  const res: EnhanceResult = { ok: false, expGain: 0, lvBefore: 0, lvAfter: 0, goldSpent: 0 };
  if (!target) { res.reason = '目标卡不存在'; return res; }
  const card = getCard(target.cardId)!;
  let expGain = 0, goldCost = 0;
  for (const fid of fodderInsts) {
    const f = inv.cards.find(c => c.instId === fid);
    if (!f || f.instId === targetInst) continue;
    const fcard = getCard(f.cardId)!;
    expGain += RARITY_RANK[fcard.rarity] * 120 * (1 + (f.lv - 1) * 0.2);
    goldCost += 100 * RARITY_RANK[fcard.rarity];
  }
  if (db.user.gold < goldCost) { res.reason = '金币不足'; return res; }
  db.user.gold -= goldCost;
  res.lvBefore = target.lv;
  target.exp += expGain;
  const need = (lv: number) => lv * 40;
  while (target.lv < cardMaxLv(card, target.evoStage) && target.exp >= need(target.lv)) {
    target.exp -= need(target.lv);
    target.lv += 1;
  }
  res.lvAfter = target.lv;
  res.expGain = expGain;
  res.goldSpent = goldCost;
  inv.cards = inv.cards.filter(c => !fodderInsts.includes(c.instId) || c.instId === targetInst);
  res.ok = true;
  return res;
}

/** 一键强化：自动挑狗粮——未锁定、不在队伍、非目标自身，先 N 后 R，最多 max 张 */
export function autoFodder(db: DB, targetInst: string, teamInsts: Set<string>, max = 6): string[] {
  const ok = (o: OwnedCard) =>
    o.instId !== targetInst && !o.locked && !teamInsts.has(o.instId);
  const n = db.inventory.cards.filter(o => ok(o) && getCard(o.cardId)?.rarity === 'N');
  const r = db.inventory.cards.filter(o => ok(o) && getCard(o.cardId)?.rarity === 'R');
  return [...n, ...r].slice(0, max).map(o => o.instId);
}

/** 一键升星：找可合成的同名素材（未锁定、不在队伍、星级差≤1；同星优先、等级高优先） */
export function findDuplicate(db: DB, targetInst: string, teamInsts: Set<string>): OwnedCard | null {
  const target = db.inventory.cards.find(o => o.instId === targetInst);
  if (!target) return null;
  const tcard = getCard(target.cardId);
  // 官方形态卡：找同名素材（任意星级，且有下一形态可合）
  if (tcard?.officialForms) {
    if (!hasForm(tcard, Math.min(target.evoStage + 1, 3))) return null;
    const cands = db.inventory.cards.filter(o =>
      o.instId !== targetInst && o.cardId === target.cardId && !o.locked &&
      !teamInsts.has(o.instId),
    );
    cands.sort((x, y) => (x.evoStage === target.evoStage ? 0 : 1) - (y.evoStage === target.evoStage ? 0 : 1) || y.lv - x.lv);
    return cands[0] ?? null;
  }
  // 旧体系：同星级（或差1星）同名素材
  if (target.evoStage >= MAX_STAR) return null;
  const cands = db.inventory.cards.filter(o =>
    o.instId !== targetInst && o.cardId === target.cardId && !o.locked &&
    !teamInsts.has(o.instId) && evolveRate(target.evoStage, o.evoStage) !== null,
  );
  cands.sort((x, y) => (x.evoStage === target.evoStage ? 0 : 1) - (y.evoStage === target.evoStage ? 0 : 1) || y.lv - x.lv);
  return cands[0] ?? null;
}

/** 药水提供的经验（等价 1 张 R 卡狗粮） */
export const POTION_EXP = 300;
/** 使用一瓶药水的金币成本 */
export const POTION_GOLD = 200;

/**
 * UseEnhancePotion：消耗一瓶强化药水给目标卡加经验
 * - 需要 1 瓶药水 + 200 金币
 * - 经验 = POTION_EXP（约等于 1 张 R 卡狗粮）
 */
export function UseEnhancePotion(db: DB, targetInst: string): EnhanceResult {
  const inv = db.inventory;
  const target = inv.cards.find(c => c.instId === targetInst);
  const res: EnhanceResult = { ok: false, expGain: 0, lvBefore: 0, lvAfter: 0, goldSpent: 0 };
  if (!target) { res.reason = '目标卡不存在'; return res; }
  const potions = inv.materials.upgradePotion || 0;
  if (potions < 1) { res.reason = '强化药水不足'; return res; }
  if (db.user.gold < POTION_GOLD) { res.reason = '金币不足'; return res; }
  const card = getCard(target.cardId)!;
  if (target.lv >= cardMaxLv(card, target.evoStage)) { res.reason = '已达等级上限'; return res; }

  inv.materials.upgradePotion = potions - 1;
  db.user.gold -= POTION_GOLD;
  res.lvBefore = target.lv;
  target.exp += POTION_EXP;
  const need = (lv: number) => lv * 40;
  while (target.lv < cardMaxLv(card, target.evoStage) && target.exp >= need(target.lv)) {
    target.exp -= need(target.lv);
    target.lv += 1;
  }
  res.lvAfter = target.lv;
  res.expGain = POTION_EXP;
  res.goldSpent = POTION_GOLD;
  res.ok = true;
  return res;
}

// ─────────────────────────── 技能升级（用同稀有度卡喂养）───────────────────────────

/** 技能等级上限 */
export const MAX_SKILL_LV = 10;

/** 素材稀有度 → 技能经验（N 少 → UR 多；20 张 SR 或 10 张 UR 可到 Lv10） */
export const SKILL_EXP_BY_RARITY: Record<string, number> = {
  N: 10, R: 25, SR: 50, UR: 100, LR: 150, X: 200, VR: 300,
};

/** 升级到下一技能等级所需经验（Lv1→2 最少，逐级递增；累计 1000 到 Lv10） */
const SKILL_LV_NEED = [60, 70, 80, 90, 100, 120, 140, 160, 180];

/** 技能 Lv → 当前级升到下一级所需经验；Lv10 封顶返回 0 */
export function skillLvNeed(skillLv: number): number {
  if (skillLv < 1) return SKILL_LV_NEED[0];
  if (skillLv >= MAX_SKILL_LV) return 0;
  return SKILL_LV_NEED[skillLv - 1];
}

/** 一张素材卡提供的技能经验 */
export function skillExpOf(card: Card): number {
  return SKILL_EXP_BY_RARITY[card.rarity] ?? 10;
}

export interface SkillLevelResult {
  ok: boolean;
  reason?: string;
  expGain: number;
  lvBefore: number;
  lvAfter: number;
}

/**
 * 升级技能：消耗同稀有度素材卡，经验按素材稀有度（N10/R25/SR50/UR100…）。
 * 技能经验累计升级（Lv1→2 需 60，逐级递增；累计约 20 张 SR 或 10 张 UR 到 Lv10）。
 * 素材卡被消耗（与强化狗粮一致）。
 */
export function LevelUpSkill(db: DB, targetInst: string, fodderInsts: string[]): SkillLevelResult {
  const inv = db.inventory;
  const target = inv.cards.find(c => c.instId === targetInst);
  const res: SkillLevelResult = { ok: false, expGain: 0, lvBefore: 0, lvAfter: 0 };
  if (!target) { res.reason = '目标卡不存在'; return res; }
  const card = getCard(target.cardId);
  if (!card) { res.reason = '卡牌不存在'; return res; }
  const lv = Math.min(target.skillLv ?? 1, MAX_SKILL_LV);
  if (lv >= MAX_SKILL_LV) { res.reason = '技能已达 Lv.10 上限'; return res; }
  // 校验素材：存在、非目标、未锁定
  const fodders = fodderInsts.map(id => inv.cards.find(c => c.instId === id));
  if (fodders.some(f => !f)) { res.reason = '素材卡不存在'; return res; }
  if (new Set(fodderInsts).size !== fodderInsts.length || fodderInsts.includes(targetInst)) {
    res.reason = '素材卡重复'; return res;
  }
  if (fodders.some(f => f!.locked)) { res.reason = '素材卡已锁定'; return res; }
  // 累计经验并升级
  let exp = (target.skillExp ?? 0);
  for (const f of fodders) {
    const fc = getCard(f!.cardId);
    if (fc) exp += skillExpOf(fc);
  }
  res.expGain = exp - (target.skillExp ?? 0);
  let curLv = lv;
  while (curLv < MAX_SKILL_LV && exp >= skillLvNeed(curLv)) {
    exp -= skillLvNeed(curLv);
    curLv += 1;
  }
  target.skillLv = curLv;
  target.skillExp = exp;
  // 消耗素材
  inv.cards = inv.cards.filter(c => !fodderInsts.includes(c.instId));
  res.lvBefore = lv;
  res.lvAfter = curLv;
  res.ok = true;
  return res;
}

// ─────────────────────────── 宝箱（战斗胜利奖励） ───────────────────────────

export type ChestQuality = 'silver' | 'gold' | 'diamond' | 'legend';

export interface ChestReward {
  quality: ChestQuality;
  cards: { cardId: string; rarity: string }[];
  gold: number;
  gems: number;
  potions: number;
}

/**
 * openChest：开启宝箱，抽出 3 张卡入库（original-fill 概率）
 * - silver（遭遇战）：R 45% / SR 42% / UR 13%
 * - gold（普通魔女讨伐）：SR 45% / UR 40% / LR 15%
 * - diamond（大魔女讨伐）：SR 25% / UR 45% / LR 26% / X 4%
 * - legend（稀有极品·大魔女小概率升级）：UR 35% / LR 45% / X 15% / VR 5%
 * 另附金币/宝石/药水；金及以上必掉药水
 */
export function openChest(
  db: DB, quality: ChestQuality,
  pickCard: (r: string) => Card | undefined, seed: number,
): ChestReward {
  const rng = mulberry32(seed);
  const pools: Record<ChestQuality, [string, number][]> = {
    silver: [['R', 45], ['SR', 42], ['UR', 13]],
    gold: [['SR', 45], ['UR', 40], ['LR', 15]],
    diamond: [['SR', 25], ['UR', 45], ['LR', 26], ['X', 4]],
    legend: [['UR', 35], ['LR', 45], ['X', 15], ['VR', 5]],
  };
  const pool = pools[quality];
  const roll = (): string => {
    let v = rng() * 100;
    for (const [r, w] of pool) { v -= w; if (v <= 0) return r; }
    return pool[0][0];
  };
  const cards: { cardId: string; rarity: string }[] = [];
  for (let i = 0; i < 3; i++) {
    const r = roll();
    const c = pickCard(r);
    if (!c) continue;
    db.inventory.cards.push(makeOwnedCard(c.id, 1 + (RARITY_TIER[r as keyof typeof RARITY_TIER] || 1) * 2));
    cards.push({ cardId: c.id, rarity: r });
  }
  const gold = quality === 'legend' ? 30000 + Math.floor(rng() * 30000)
    : quality === 'diamond' ? 15000 + Math.floor(rng() * 15000)
    : quality === 'gold' ? 8000 + Math.floor(rng() * 12000)
    : 3000 + Math.floor(rng() * 5000);
  const gems = quality === 'legend' ? 300 + Math.floor(rng() * 300)
    : quality === 'diamond' ? 150 + Math.floor(rng() * 150)
    : quality === 'gold' ? 80 + Math.floor(rng() * 120)
    : 20 + Math.floor(rng() * 40);
  const potions = quality === 'legend' ? 5 : quality === 'diamond' ? 3
    : quality === 'gold' ? 2 : rng() < 0.5 ? 1 : 0;
  db.user.gold += gold;
  db.user.gems += gems;
  if (potions > 0) db.inventory.materials.upgradePotion = (db.inventory.materials.upgradePotion || 0) + potions;
  return { quality, cards, gold, gems, potions };
}

/** 战绩：领取已讨伐魔女的奖励 */
export function claimRaidReward(db: DB, raidId: string): {
  ok: boolean; reason?: string; gold: number; gems: number; tickets: number;
} {
  const empty = { ok: false, gold: 0, gems: 0, tickets: 0 };
  const raid = db.raids.find(r => r.raidId === raidId);
  if (!raid) return { ...empty, reason: '战绩不存在' };
  if (!raid.defeated) return { ...empty, reason: '尚未讨伐成功' };
  if (raid.claimed) return { ...empty, reason: '已领取' };
  const gold = raid.archWitch ? 50000 : 12000;
  const gems = raid.archWitch ? 500 : 300;
  const tickets = raid.archWitch ? 3 : 1;
  raid.claimed = true;
  db.user.gold += gold;
  db.user.gems += gems;
  db.user.tickets.fate = (db.user.tickets.fate || 0) + tickets;
  return { ok: true, gold, gems, tickets };
}

/** 一次性领取全部可领战绩 */
export function claimAllRaidRewards(db: DB): {
  count: number; gold: number; gems: number; tickets: number;
} {
  let count = 0, gold = 0, gems = 0, tickets = 0;
  for (const r of db.raids) {
    if (!r.defeated || r.claimed) continue;
    const res = claimRaidReward(db, r.raidId);
    if (res.ok) {
      count += 1;
      gold += res.gold;
      gems += res.gems;
      tickets += res.tickets;
    }
  }
  return { count, gold, gems, tickets };
}
