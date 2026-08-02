/**
 * 逻辑层 — 纯函数游戏逻辑（可测试、可回放）
 * ExploreStage / EvolveCard / BattleEngine / EnhanceCard
 * 所有随机走 seeded RNG，保证确定性。
 */

import type { Card } from './data';
import { getCard, RARITY_RANK } from './data';
import type { DB, OwnedCard, Stage, WitchRaidBoss } from './db';
import { elementalMultiplier, newInstId } from './db';

// ─────────────────────────── Seeded RNG ───────────────────────────
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ─────────────────────────── 有效属性（含进化加成）───────────────────────────
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
  procChance: number;   // 技能触发率 0..1
  skillMult: number;    // 技能倍率
  isLeader: boolean;
}

export function ownedToCombatant(o: OwnedCard, isLeader = false): Combatant | null {
  const card = getCard(o.cardId);
  if (!card) return null;
  const lvScale = 1 + (o.lv - 1) * 0.06;
  const atk = Math.floor(card.stats.attack * lvScale) + o.atkBonus;
  const hpMax = Math.floor((card.stats.soldiers * 100 + card.stats.defense * 10 + 5000) * lvScale) + o.hpBonus;
  const tier = RARITY_RANK[card.rarity];
  return {
    instId: o.instId, card, lv: o.lv,
    atk, hp: hpMax, hpMax, def: card.stats.defense,
    speed: card.stats.speed || 100,
    element: card.element,
    skillName: card.skillName || '攻击',
    procChance: Math.min(0.85, 0.25 + tier * 0.08), // 稀有度越高触发率越高
    skillMult: 2.2 + tier * 0.4,
    isLeader,
  };
}

/** 队长技能：全队攻击 +10% */
export function leaderAtkBonus(team: Combatant[]): number {
  return team.some(c => c.isLeader) ? 1.10 : 1.0;
}

// ─────────────────────────── 战斗体力（AP）恢复 ───────────────────────────

/** 每点 AP 恢复间隔（毫秒）：6 分钟一点 */
export const AP_RECOVER_MS = 6 * 60 * 1000;

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

// ─────────────────────────── 探索闯关 ───────────────────────────

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
  } else {
    res.event = 'loot';
    res.lootGold = Math.floor(200 + rng() * 800);
    res.lootGems = rng() < 0.25 ? Math.floor(1 + rng() * 5) : 0;
    db.user.gold += res.lootGold;
    db.user.gems += res.lootGems;
    if (rng() < 0.35) {
      res.lootCardRarity = rng() < 0.85 ? 'N' : 'R';
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
  // HP 平衡：我方全队一回合约 1.5万~3万输出
  // 普通魔女 12万~27万 → 约 6~15 回合；大魔女 32万~68万 → 约 15~35 回合
  const hpMax = Math.floor((arch ? 8 : 3) * 10000 + level * (arch ? 3000 : 1200));
  const raid: WitchRaidBoss = {
    raidId: newInstId(),
    bossCardId,
    name: arch ? '超·幻想魔女' : '幻想魔女',
    level, hp: hpMax, hpMax,
    attack: Math.floor(2500 + level * 40 * (arch ? 1.8 : 1)),
    archWitch: arch,
    discoveredBy: db.user.name,
    expiresAt: Date.now() + (arch ? 30 : 120) * 60 * 1000,
    damageLog: {}, defeated: false, claimed: false,
  };
  db.raids.push(raid);
  return raid.raidId;
}

// ─────────────────────────── 进化 ───────────────────────────

export interface EvolveResult {
  ok: boolean;
  reason?: string;
  result?: OwnedCard;
  inheritedAtk: number;
  inheritedHp: number;
  newEvoStage: number;
}

/**
 * EvolveCard(cardA, cardB)：两张同名卡合成进化
 * - 校验同 cardId
 * - 素材卡 8% 属性永久继承（满级进化更多，12%）
 * - 进化次数 +1，提升上限
 */
export function EvolveCard(db: DB, instA: string, instB: string, inheritRate = 0.08): EvolveResult {
  const inv = db.inventory;
  const a = inv.cards.find(c => c.instId === instA);
  const b = inv.cards.find(c => c.instId === instB);
  const res: EvolveResult = { ok: false, inheritedAtk: 0, inheritedHp: 0, newEvoStage: 0 };
  if (!a || !b) { res.reason = '卡牌不存在'; return res; }
  if (a.instId === b.instId) { res.reason = '不能与自己合成'; return res; }
  if (a.cardId !== b.cardId) { res.reason = '必须同名卡'; return res; }

  const card = getCard(a.cardId)!;
  // 满级进化继承更多
  const bMax = b.lv >= maxLv(card.rarity, b.evoStage);
  const rate = bMax ? inheritRate * 1.5 : inheritRate;
  const bAtk = card.stats.attack * (1 + (b.lv - 1) * 0.06) + b.atkBonus;
  const bHp = (card.stats.soldiers * 100 + card.stats.defense * 10 + 5000) * (1 + (b.lv - 1) * 0.06) + b.hpBonus;
  const inhAtk = Math.floor(bAtk * rate);
  const inhHp = Math.floor(bHp * rate);

  a.atkBonus += inhAtk;
  a.hpBonus += inhHp;
  a.evoStage += 1;
  // 移除素材卡
  inv.cards = inv.cards.filter(c => c.instId !== instB);

  res.ok = true;
  res.result = a;
  res.inheritedAtk = inhAtk;
  res.inheritedHp = inhHp;
  res.newEvoStage = a.evoStage;
  return res;
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

// ─────────────────────────── 战斗引擎 ───────────────────────────

export interface BattleAction {
  actorInstId: string;
  actorName: string;
  targetIndex: number;
  damage: number;
  crit: boolean;
  skillUsed: boolean;
  skillName?: string;
  elementMult: number;
  heal?: number;
}

export interface BattleTurnResult {
  actions: BattleAction[];
  playerAlive: number;
  enemyAlive: number;
  finished: boolean;
  playerWon: boolean;
}

/**
 * BattleEngine：回合制 / 半自动
 * - 行动顺序按 Speed 降序
 * - 每张卡按 procChance 触发技能（高倍率），否则普攻
 * - 伤害 = atk × skillMult × elementMult × (1 ± crit) - 目标 def 减免
 * - 克制系数 20%~50%
 */
export function runBattleTurn(
  team: Combatant[],
  enemies: Combatant[],
  seed: number,
  leaderBonus = 1.0,
): BattleTurnResult {
  const rng = mulberry32(seed);
  const actions: BattleAction[] = [];

  const all = [
    ...team.filter(c => c.hp > 0).map(c => ({ c, side: 'player' as const })),
    ...enemies.filter(c => c.hp > 0).map(c => ({ c, side: 'enemy' as const })),
  ].sort((x, y) => y.c.speed - x.c.speed);

  for (const { c, side } of all) {
    if (c.hp <= 0) continue;
    const foes = side === 'player' ? enemies : team;
    const aliveFoes = foes.filter(f => f.hp > 0);
    if (aliveFoes.length === 0) break;
    const target = aliveFoes[Math.floor(rng() * aliveFoes.length)];
    const targetIndex = foes.indexOf(target);

    const useSkill = rng() < c.procChance;
    const mult = useSkill ? c.skillMult : 1.0;
    const em = elementalMultiplier(c.element, target.element);
    const crit = rng() < c.card.stats.critRate / 100;
    const critMult = crit ? 1 + c.card.stats.critDamage / 100 : 1;
    const sideBonus = side === 'player' ? leaderBonus : 1;

    let dmg = c.atk * mult * em * critMult * sideBonus;
    dmg = Math.max(1, dmg - target.def * 0.5);
    dmg = Math.floor(dmg * (0.9 + rng() * 0.2));

    target.hp = Math.max(0, target.hp - dmg);

    actions.push({
      actorInstId: c.instId, actorName: c.card.name,
      targetIndex, damage: dmg, crit, skillUsed: useSkill,
      skillName: useSkill ? c.skillName : undefined,
      elementMult: em,
    });
  }

  const playerAlive = team.filter(c => c.hp > 0).length;
  const enemyAlive = enemies.filter(c => c.hp > 0).length;
  return {
    actions,
    playerAlive,
    enemyAlive,
    finished: playerAlive === 0 || enemyAlive === 0,
    playerWon: enemyAlive === 0 && playerAlive > 0,
  };
}

/** 讨伐魔女：对 Raid Boss 造成一段伤害并记贡献 */
export function raidAttack(db: DB, raid: WitchRaidBoss, team: Combatant[], seed: number): { dmg: number; defeated: boolean; ptGain: number; outOfAp: boolean } {
  const rng = mulberry32(seed);
  if (db.user.battlePt <= 0) return { dmg: 0, defeated: false, ptGain: 0, outOfAp: true };
  db.user.battlePt -= 1;
  const leaderBonus = leaderAtkBonus(team);
  let dmg = 0;
  for (const c of team) {
    if (c.hp <= 0) continue;
    const useSkill = rng() < c.procChance;
    const mult = useSkill ? c.skillMult : 1.0;
    const em = elementalMultiplier(c.element, 'dark');
    dmg += Math.floor(c.atk * mult * em * leaderBonus * (0.9 + rng() * 0.2));
  }
  raid.hp = Math.max(0, raid.hp - dmg);
  raid.damageLog[db.user.uid] = (raid.damageLog[db.user.uid] || 0) + dmg;
  let ptGain = Math.floor(dmg / 100);
  if (raid.hp <= 0 && !raid.defeated) {
    raid.defeated = true;
    db.eventPoint.raidKills += 1;
    ptGain += raid.archWitch ? 500 : 100; // 击杀奖
  }
  db.eventPoint.points += ptGain;
  return { dmg, defeated: raid.defeated, ptGain, outOfAp: false };
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
