import Phaser from 'phaser';
import type { Card, BattleResult, BattleUnit } from '../data/schema/types';
import { initBattle, executeTurn } from '../systems/BattleEngine';
import { getSkillById } from '../data/skills';
import { buildAnimationQueue, getAttackOffset, type AnimStep } from '../ui/BattleAnimator';
import { CardSprite } from '../ui/CardSprite';
import { spawnDamageText, spawnSkillBanner } from '../ui/DamageText';

export class BattleScene extends Phaser.Scene {
  private cardSprites = new Map<string, CardSprite>();
  private animQueue: AnimStep[] = [];
  private animIndex = 0;
  private isPlaying = false;
  private battleResult: BattleResult | null = null;
  private turnText!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'BattleScene' });
  }

  create(): void {
    const cards = this.registry.get('cards') as Card[];
    const deckIds = this.registry.get('playerDeck') as string[];

    // 构建玩家队伍
    const playerCards = deckIds
      .map(id => cards.find(c => c.id === id))
      .filter((c): c is Card => !!c)
      .map(card => ({ card, skill: getSkillById(card.skillIds[0] || '') }));

    // 构建敌方队伍
    const enemyPool = cards.filter(c => !deckIds.includes(c.id));
    const enemyCards = enemyPool.slice(0, 3).map(card => ({
      card,
      skill: getSkillById(card.skillIds[0] || ''),
    }));

    // 运行完整战斗获取日志
    const state = initBattle(playerCards, enemyCards);
    while (state.phase === 'ongoing' && state.turn < 100) {
      executeTurn(state);
    }
    if (state.phase === 'ongoing') {
      const playerHp = state.units.filter(u => u.side === 'player').reduce((s, u) => s + u.currentHp, 0);
      const enemyHp = state.units.filter(u => u.side === 'enemy').reduce((s, u) => s + u.currentHp, 0);
      state.phase = playerHp >= enemyHp ? 'player_win' : 'enemy_win';
    }
    this.battleResult = {
      winner: state.phase === 'player_win' ? 'player' : 'enemy',
      turns: state.turn,
      log: state.log,
    };

    // 布局卡牌精灵
    this.layoutCards(state.units);

    // UI 标题
    this.add.text(480, 16, '— 战斗中 —', { fontSize: '18px', color: '#ffd700' }).setOrigin(0.5);
    this.turnText = this.add.text(480, 600, '', { fontSize: '13px', color: '#aaaaaa' }).setOrigin(0.5);

    // 构建动画队列
    this.animQueue = buildAnimationQueue(this.battleResult.log);
    this.animIndex = 0;

    // 延迟开始播放
    this.time.delayedCall(500, () => this.playNext());
  }

  /** 布局：玩家在左，敌人在右 */
  private layoutCards(units: BattleUnit[]): void {
    const playerUnits = units.filter(u => u.side === 'player');
    const enemyUnits = units.filter(u => u.side === 'enemy');

    const PLAYER_X = 180;
    const ENEMY_X = 780;
    const START_Y = 120;
    const GAP_Y = 115;

    playerUnits.forEach((unit, i) => {
      const y = START_Y + i * GAP_Y;
      const sprite = new CardSprite(this, unit, PLAYER_X, y);
      this.cardSprites.set(unit.uid, sprite);
    });

    enemyUnits.forEach((unit, i) => {
      const y = START_Y + i * GAP_Y;
      const sprite = new CardSprite(this, unit, ENEMY_X, y);
      this.cardSprites.set(unit.uid, sprite);
    });
  }

  /** 顺序播放动画队列 */
  private async playNext(): Promise<void> {
    if (this.isPlaying) return;
    this.isPlaying = true;

    while (this.animIndex < this.animQueue.length) {
      const step = this.animQueue[this.animIndex];
      this.animIndex++;
      await this.executeStep(step);
    }

    // 动画播完 → 结算
    this.isPlaying = false;
    this.showVictory();
  }

  /** 执行单个动画步骤 */
  private async executeStep(step: AnimStep): Promise<void> {
    switch (step.type) {
      case 'turn_start':
        this.turnText.setText(`— 第 ${step.turn} 回合 —`);
        await this.wait(step.duration);
        break;

      case 'skill_banner': {
        const actor = step.actorUid ? this.cardSprites.get(step.actorUid) : null;
        const actorName = actor?.unit.card.names.cn || actor?.unit.card.names.en || '';
        spawnSkillBanner(this, step.skillName || '', actorName);
        await this.wait(step.duration);
        break;
      }

      case 'attack': {
        const sprite = step.actorUid ? this.cardSprites.get(step.actorUid) : null;
        if (sprite && sprite.alive) {
          const offset = getAttackOffset(sprite.side);
          await sprite.playAttack(offset.x, step.duration);
        } else {
          await this.wait(step.duration);
        }
        break;
      }

      case 'hit': {
        const target = step.targetUid ? this.cardSprites.get(step.targetUid) : null;
        if (target) {
          const pos = target.getPosition();
          const isCrit = (step.elementBonus ?? 1.0) > 1.0;
          spawnDamageText(this, pos.x, pos.y - 60, step.damage ?? 0, { isCrit });
          await target.playHit();

          // 更新 HP（从战斗日志推算当前 HP 较复杂，这里用 unit 的实时状态）
          const currentHp = Math.max(0, target.unit.currentHp - (step.damage ?? 0));
          target.unit.currentHp = currentHp;
          target.updateHp(currentHp, target.unit.maxHp);
        } else {
          await this.wait(step.duration);
        }
        break;
      }

      case 'death': {
        const promises: Promise<void>[] = [];
        for (const uid of step.killedUids || []) {
          const sprite = this.cardSprites.get(uid);
          if (sprite && sprite.alive) {
            promises.push(sprite.playDeath());
          }
        }
        if (promises.length > 0) {
          await Promise.all(promises);
        } else {
          await this.wait(step.duration);
        }
        break;
      }

      default:
        await this.wait(step.duration);
    }
  }

  /** 显示胜利/失败提示后跳转 */
  private showVictory(): void {
    if (!this.battleResult) return;

    const isWin = this.battleResult.winner === 'player';
    const text = isWin ? '✦ 胜利 ✦' : '✗ 败北 ✗';
    const color = isWin ? '#ffd700' : '#ff4444';

    const victoryText = this.add.text(480, 300, text, {
      fontSize: '36px', color, fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 5,
    }).setOrigin(0.5).setAlpha(0);

    this.tweens.add({
      targets: victoryText,
      alpha: 1,
      duration: 500,
      ease: 'Power2',
    });

    this.registry.set('battleResult', this.battleResult);
    this.time.delayedCall(1500, () => this.scene.start('ResultScene'));
  }

  /** 等待指定毫秒 */
  private wait(ms: number): Promise<void> {
    return new Promise(resolve => {
      this.time.delayedCall(ms, resolve);
    });
  }
}
