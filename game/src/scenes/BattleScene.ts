import Phaser from 'phaser';
import type { Card, Skill, BattleResult } from '../data/schema/types';
import { runBattle } from '../systems/BattleEngine';
import { getSkillById } from '../data/skills';

export class BattleScene extends Phaser.Scene {
  private logText!: Phaser.GameObjects.Text;
  private battleResult: BattleResult | null = null;
  private logIndex = 0;
  private timerEvent: Phaser.Time.TimerEvent | null = null;

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

    // 构建敌方队伍（取前 3 张非玩家选择的卡）
    const enemyPool = cards.filter(c => !deckIds.includes(c.id));
    const enemyCards = enemyPool.slice(0, 3).map(card => ({
      card,
      skill: getSkillById(card.skillIds[0] || ''),
    }));

    // 运行战斗
    this.battleResult = runBattle(playerCards, enemyCards);
    this.logIndex = 0;

    // UI
    this.add.text(480, 20, '— 战斗中 —', { fontSize: '20px', color: '#ffd700' }).setOrigin(0.5);

    const playerInfo = playerCards.map(p => `${p.card.names.cn || p.card.names.en} [${p.card.element}]`).join('\n');
    const enemyInfo = enemyCards.map(e => `${e.card.names.cn || e.card.names.en} [${e.card.element}]`).join('\n');

    this.add.text(30, 60, `我方:\n${playerInfo}`, { fontSize: '13px', color: '#66ccff', lineSpacing: 4 });
    this.add.text(600, 60, `敌方:\n${enemyInfo}`, { fontSize: '13px', color: '#ff6666', lineSpacing: 4 });

    this.logText = this.add.text(480, 400, '', {
      fontSize: '14px', color: '#cccccc', wordWrap: { width: 900 }, lineSpacing: 3,
    }).setOrigin(0.5, 0);

    // 逐条播放战斗日志
    this.timerEvent = this.time.addEvent({
      delay: 600,
      callback: this.showNextAction,
      callbackScope: this,
      loop: true,
    });
  }

  private showNextAction(): void {
    if (!this.battleResult) return;

    if (this.logIndex < this.battleResult.log.length) {
      const action = this.battleResult.log[this.logIndex];
      const skillTag = action.isSkill ? ` [技能:${action.skillName}]` : '';
      const bonusTag = action.elementBonus && action.elementBonus !== 1.0
        ? ` (克制x${action.elementBonus})` : '';
      const killTag = action.killed && action.killed.length > 0 ? ' [击破!]' : '';

      const line = `T${action.turn} ${action.actorName}${skillTag} → ${action.damage} dmg${bonusTag}${killTag}`;
      this.logText.setText(this.logText.text + line + '\n');
      this.logIndex++;
    } else {
      // 战斗结束
      this.timerEvent?.destroy();
      this.registry.set('battleResult', this.battleResult);
      this.time.delayedCall(1000, () => this.scene.start('ResultScene'));
    }
  }
}
