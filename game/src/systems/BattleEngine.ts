import type { Card, Skill, BattleUnit, BattleAction, BattleState, BattleResult } from '../data/schema/types';
import { calculateDamage, getElementBonus } from './DamageCalc';
import { rollSkillTrigger } from './SkillSystem';

let uidCounter = 0;
function nextUid(): string {
  return `unit_${++uidCounter}`;
}

export function resetUidCounter(): void {
  uidCounter = 0;
}

/** 从卡牌创建战斗单位 */
export function createBattleUnit(card: Card, skill: Skill | null, side: 'player' | 'enemy', position: number): BattleUnit {
  return {
    uid: nextUid(),
    card,
    skill,
    currentHp: card.baseStats.hp,
    maxHp: card.baseStats.hp,
    atk: card.baseStats.atk,
    def: card.baseStats.def,
    speed: card.baseStats.speed,
    isAlive: true,
    side,
    position,
  };
}

/** 初始化战斗状态 */
export function initBattle(playerCards: { card: Card; skill: Skill | null }[], enemyCards: { card: Card; skill: Skill | null }[]): BattleState {
  resetUidCounter();
  const playerUnits = playerCards.map((p, i) => createBattleUnit(p.card, p.skill, 'player', i));
  const enemyUnits = enemyCards.map((e, i) => createBattleUnit(e.card, e.skill, 'enemy', i));
  return {
    turn: 0,
    units: [...playerUnits, ...enemyUnits],
    log: [],
    phase: 'ongoing',
  };
}

/** 获取存活单位按速度排序 */
function getAliveUnitsSorted(units: BattleUnit[]): BattleUnit[] {
  return units.filter(u => u.isAlive).sort((a, b) => b.speed - a.speed);
}

/** 获取敌方存活单位 */
function getEnemies(units: BattleUnit[], side: 'player' | 'enemy'): BattleUnit[] {
  const targetSide = side === 'player' ? 'enemy' : 'player';
  return units.filter(u => u.side === targetSide && u.isAlive);
}

/** 执行一个单位的行动 */
function executeAction(unit: BattleUnit, state: BattleState, rng: () => number): BattleAction | null {
  if (!unit.isAlive) return null;

  const enemies = getEnemies(state.units, unit.side);
  if (enemies.length === 0) return null;

  // 判定技能触发
  const useSkill = unit.skill && rollSkillTrigger(unit.skill, rng);

  if (useSkill && unit.skill) {
    const skill = unit.skill;
    const targets = skill.target === 'all' ? enemies : [enemies[rng() * enemies.length | 0]];
    let totalDamage = 0;
    const killed: string[] = [];

    for (const target of targets) {
      const dmg = calculateDamage({
        atk: unit.atk,
        def: target.def,
        multiplier: skill.multiplier,
        attackerElement: unit.card.element,
        defenderElement: target.card.element,
      });
      target.currentHp -= dmg;
      totalDamage += dmg;
      if (target.currentHp <= 0) {
        target.currentHp = 0;
        target.isAlive = false;
        killed.push(target.uid);
      }
    }

    return {
      turn: state.turn,
      actorUid: unit.uid,
      actorName: unit.card.names.cn || unit.card.names.en,
      type: 'skill',
      targetUids: targets.map(t => t.uid),
      damage: totalDamage,
      isSkill: true,
      skillName: skill.name,
      elementBonus: getElementBonus(unit.card.element, targets[0].card.element),
      killed,
    };
  }

  // 普通攻击
  const target = enemies[rng() * enemies.length | 0];
  const dmg = calculateDamage({
    atk: unit.atk,
    def: target.def,
    multiplier: 1.0,
    attackerElement: unit.card.element,
    defenderElement: target.card.element,
  });
  target.currentHp -= dmg;
  const killed: string[] = [];
  if (target.currentHp <= 0) {
    target.currentHp = 0;
    target.isAlive = false;
    killed.push(target.uid);
  }

  return {
    turn: state.turn,
    actorUid: unit.uid,
    actorName: unit.card.names.cn || unit.card.names.en,
    type: 'attack',
    targetUids: [target.uid],
    damage: dmg,
    isSkill: false,
    elementBonus: getElementBonus(unit.card.element, target.card.element),
    killed,
  };
}

/** 检查胜负 */
function checkVictory(units: BattleUnit[]): 'ongoing' | 'player_win' | 'enemy_win' {
  const playerAlive = units.some(u => u.side === 'player' && u.isAlive);
  const enemyAlive = units.some(u => u.side === 'enemy' && u.isAlive);
  if (!enemyAlive) return 'player_win';
  if (!playerAlive) return 'enemy_win';
  return 'ongoing';
}

/** 执行一整个回合 */
export function executeTurn(state: BattleState, rng: () => number = Math.random): BattleAction[] {
  state.turn++;
  const actions: BattleAction[] = [];
  const sorted = getAliveUnitsSorted(state.units);

  for (const unit of sorted) {
    if (state.phase !== 'ongoing') break;
    const action = executeAction(unit, state, rng);
    if (action) {
      actions.push(action);
      state.log.push(action);
    }
    state.phase = checkVictory(state.units);
  }

  return actions;
}

/** 运行完整战斗（最多 100 回合防无限循环） */
export function runBattle(
  playerCards: { card: Card; skill: Skill | null }[],
  enemyCards: { card: Card; skill: Skill | null }[],
  rng: () => number = Math.random,
): BattleResult {
  const state = initBattle(playerCards, enemyCards);
  const MAX_TURNS = 100;

  while (state.phase === 'ongoing' && state.turn < MAX_TURNS) {
    executeTurn(state, rng);
  }

  // 超时判定：比较存活 HP 总量
  if (state.phase === 'ongoing') {
    const playerHp = state.units.filter(u => u.side === 'player').reduce((s, u) => s + u.currentHp, 0);
    const enemyHp = state.units.filter(u => u.side === 'enemy').reduce((s, u) => s + u.currentHp, 0);
    state.phase = playerHp >= enemyHp ? 'player_win' : 'enemy_win';
  }

  return {
    winner: state.phase === 'player_win' ? 'player' : 'enemy',
    turns: state.turn,
    log: state.log,
  };
}
