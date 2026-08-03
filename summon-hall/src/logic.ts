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
export function ownedToCombatant(o: OwnedCard, isLeader = false): Combatant | null {
  const card = getCard(o.cardId);
  if (!card) return null;
  const C = BATTLE_CONFIG;
  const lvScale = 1 + (o.lv - 1) * C.lvScalePerLv.value;
  const starScale = Math.pow(STAR_STAT_MULT, o.evoStage); // 每星全属性 ×1.2（复利）
  const atk = Math.floor((Math.floor(card.stats.attack * lvScale) + o.atkBonus) * starScale);
  const hpMax = Math.floor(
    (Math.floor(
      (card.stats.soldiers * C.hpSoldiersMult.value + card.stats.defense * C.hpDefenseMult.value + C.hpBase.value) * lvScale,
    ) + o.hpBonus) * starScale,
  );
  const tier = RARITY_RANK[card.rarity];
  const fx = assignSkillFx(card.element, card.rarity);
  return {
    instId: o.instId, card, lv: o.lv,
    atk, hp: hpMax, hpMax, def: card.stats.defense,
    speed: Math.floor((card.stats.speed || 100) * starScale),
    element: card.element,
    // 物品名/空技能名 → 用特效名（wiki 技能多为物品名，观赏性差）
    skillName: card.skillName && card.skillName.length <= 16 ? card.skillName : FX_NAMES[fx],
    procChance: Math.min(C.procMax.value, C.procBase.value + tier * C.procPerTier.value),
    skillMult: C.skillMultBase.value + tier * C.skillMultPerTier.value,
    skillFx: fx,
    isLeader,
    rage: 0,
  };
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
  event: 'none' | 'loot' | 'mob' | 'witch';
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
 * - 每步推进 10%~20%（约 6~8 步通关）
 * - 遇敌节奏：每 5~6 步必遇魔女；通关那一步必是大魔女
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
  const step = stage.stepsTaken;

  // 每步 10%~20%，百分比真实推进并反映到进度条
  const gain = 0.10 + rng() * 0.10;
  res.progressGain = gain;
  const wasBelow = stage.progress < 1;
  stage.progress = Math.min(1, stage.progress + gain);
  res.newProgress = stage.progress;

  // 到达 100%（通关那一步必是大魔女）
  const atEnd = stage.progress >= 1 && wasBelow;
  if (atEnd) {
    res.completed = true;
  }

  // ── 遇敌节奏（有保底，不是糊弄人的假百分比）──
  // 每 5~6 步必遇魔女：第 5、11、17、23…步
  const witchStep = step % 6 === 5;
  // 通关步：强制大魔女
  if (atEnd && !stage.archEncountered) {
    res.event = 'witch';
    res.witchRaidId = spawnWitch(db, stage, rng, '', true);
    stage.archEncountered = true;
    stage.witchEncounters += 1;
  } else if (atEnd && stage.archEncountered) {
    // 大魔女已遇过：结尾再来一只普通魔女守住
    res.event = 'witch';
    res.witchRaidId = spawnWitch(db, stage, rng, '', false);
    stage.witchEncounters += 1;
  } else if (witchStep) {
    // 保底：第 5 / 11 / 17 步必遇魔女
    res.event = 'witch';
    res.witchRaidId = spawnWitch(db, stage, rng, '', false);
    stage.witchEncounters += 1;
  } else if (rng() < 0.4) {
    // 其余步：40% 拾取 / 60% 小怪
    res.event = 'mob';
    res.lootGold = Math.floor(150 + rng() * 400);
    db.user.gold += res.lootGold;
    res.lootCardRarity = 'N';
    grantLootCard(db, 'N', rng);
  } else {
    res.event = 'loot';
    res.lootGold = Math.floor(200 + rng() * 800);
    res.lootGems = rng() < 0.25 ? Math.floor(1 + rng() * 5) : 0;
    db.user.gold += res.lootGold;
    db.user.gems += res.lootGems;
    if (rng() < 0.35) {
      res.lootCardRarity = rng() < 0.85 ? 'N' : 'R';
      grantLootCard(db, res.lootCardRarity as Rarity, rng);
    } else if (rng() < 0.5) {
      // 35% 概率掉 1~2 瓶强化药水
      const n = 1 + (rng() < 0.3 ? 1 : 0);
      db.inventory.materials.upgradePotion = (db.inventory.materials.upgradePotion || 0) + n;
      res.lootPotion = n;
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
  // 目标战斗长度：普通魔女约 6 轮输出、大魔女约 14 轮
  const dpt = estimateTeamDPT(db);
  const avgHp = estimateTeamHP(db);
  const hpMax = Math.floor(
    Math.max(stage.enemyPower * (arch ? 4 : 1.5), dpt * (arch ? 14 : 6)) * (0.9 + rng() * 0.2),
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

// ─────────────────────────── 进化 ───────────────────────────

/** 升星上限：同名卡合成，最高 10 星 */
export const MAX_STAR = 10;

/** 每星属性倍率：n 星 = 基础 × 1.2^n（攻击/体力/速度，复利） */
export const STAR_STAT_MULT = 1.2;

/**
 * 升星成功率（%）：两张同名卡、星级差 ≤1 可合，结果 = max(星级)+1。
 * 同星合成：(10-目标星)×10%（→1星90%、→2星80%、→3星70%…→9星10%）
 * 混星合成：再 -10%（如 1星+2星→3星 60%，3星+2星→4星 50%），保底 5%。
 * 规则为离线原创配置，非原版数值。
 */
export function evolveRate(starA: number, starB: number): number | null {
  if (Math.abs(starA - starB) > 1) return null;
  const target = Math.max(starA, starB) + 1;
  if (target > MAX_STAR) return null;
  const base = (10 - target) * 10;
  const mixed = starA !== starB;
  return Math.max(5, base - (mixed ? 10 : 0));
}

export interface EvolvePrep {
  ok: boolean;
  reason?: string;
  rate: number;           // 成功率 %
  success: boolean;       // 预掷结果（动画播完才落库）
  newEvoStage: number;
  inheritedAtk: number;
  inheritedHp: number;
}

/**
 * 预计算升星结果（不改动 db）；rng 注入便于测试。
 * 素材两种合法形态：
 *  - 同名卡×1（星级差 ≤1）：rate = evolveRate(主星, 素材星)，结果 = max+1
 *  - 同稀有度卡×2（无需同名）：rate = 同星基准 (10-(主星+1))×10%，结果 = 主星+1
 */
export function prepareEvolve(db: DB, instA: string, matInsts: string[], rng: () => number = Math.random, inheritRate = 0.08): EvolvePrep {
  const res: EvolvePrep = { ok: false, rate: 0, success: false, newEvoStage: 0, inheritedAtk: 0, inheritedHp: 0 };
  const a = db.inventory.cards.find(c => c.instId === instA);
  if (!a) { res.reason = '卡牌不存在'; return res; }
  if (a.evoStage >= MAX_STAR) { res.reason = `已达 ${MAX_STAR} 星上限`; return res; }
  const mats = matInsts.map(id => db.inventory.cards.find(c => c.instId === id));
  if (mats.some(m => !m)) { res.reason = '素材卡不存在'; return res; }
  if (new Set(matInsts).size !== matInsts.length || matInsts.includes(instA)) { res.reason = '素材卡重复'; return res; }
  const cardA = getCard(a.cardId)!;

  let rate: number;
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

  // 继承：各素材均摊（总量与单素材一致；满级素材继承 ×1.5）
  for (const m of mats) {
    const mc = getCard(m!.cardId)!;
    const mMax = m!.lv >= maxLv(mc.rarity, m!.evoStage);
    const ir = (mMax ? inheritRate * 1.5 : inheritRate) / mats.length;
    const mAtk = mc.stats.attack * (1 + (m!.lv - 1) * 0.06) + m!.atkBonus;
    const mHp = (mc.stats.soldiers * 100 + mc.stats.defense * 10 + 5000) * (1 + (m!.lv - 1) * 0.06) + m!.hpBonus;
    res.inheritedAtk += Math.floor(mAtk * ir);
    res.inheritedHp += Math.floor(mHp * ir);
  }

  res.ok = true;
  res.rate = rate;
  res.success = rng() * 100 < rate;
  return res;
}

/** 应用升星结果：成功=主卡加星+继承、素材消耗；失败=主卡降 1 星（0 星不降）、素材损毁 */
export function applyEvolve(db: DB, instA: string, matInsts: string[], prep: EvolvePrep): void {
  const inv = db.inventory;
  const a = inv.cards.find(c => c.instId === instA);
  if (!a || !prep.ok) return;
  if (prep.success) {
    a.atkBonus += prep.inheritedAtk;
    a.hpBonus += prep.inheritedHp;
    a.evoStage = prep.newEvoStage;
  } else {
    a.evoStage = Math.max(0, a.evoStage - 1);
  }
  const drop = new Set(matInsts);
  inv.cards = inv.cards.filter(c => !drop.has(c.instId));
}

export function maxLv(rarity: string, evoStage: number): number {
  const base = RARITY_RANK[rarity as keyof typeof RARITY_RANK] || 1;
  return base * 20 + evoStage * 10;
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
  while (target.lv < maxLv(card.rarity, target.evoStage) && target.exp >= need(target.lv)) {
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
  if (!target || target.evoStage >= MAX_STAR) return null;
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
  if (target.lv >= maxLv(card.rarity, target.evoStage)) { res.reason = '已达等级上限'; return res; }

  inv.materials.upgradePotion = potions - 1;
  db.user.gold -= POTION_GOLD;
  res.lvBefore = target.lv;
  target.exp += POTION_EXP;
  const need = (lv: number) => lv * 40;
  while (target.lv < maxLv(card.rarity, target.evoStage) && target.exp >= need(target.lv)) {
    target.exp -= need(target.lv);
    target.lv += 1;
  }
  res.lvAfter = target.lv;
  res.expGain = POTION_EXP;
  res.goldSpent = POTION_GOLD;
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
