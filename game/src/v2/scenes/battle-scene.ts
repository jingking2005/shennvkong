/**
 * V2 战斗场景 — 订阅 EventBus 渲染战斗动画
 * 上下结构：敌方在上，我方在下，5 位置布局
 */

import Phaser from 'phaser';
import { BattleEngine } from '../systems/battle-engine';
import { BattleEvents } from '../systems/event-bus';
import type { CardDefinition, CardInstance, SkillDefinition, BattleUnit, Position } from '../data/types';
import { getV2CardTextureKey } from '../data/card-images';
import cardsData from '../../../data/v2/fixtures/cards.json';
import skillsData from '../../../data/v2/fixtures/skills.json';
import { BackgroundFX } from '../../ui/BackgroundFX';

const POSITIONS: Position[] = ['FRONT_LEFT', 'FRONT_RIGHT', 'MID_LEFT', 'MID_RIGHT', 'BACK_CENTER'];
const POS_COORDS: Record<Position, { x: number; y: number }> = {
  FRONT_LEFT: { x: 300, y: 0 },
  FRONT_RIGHT: { x: 660, y: 0 },
  MID_LEFT: { x: 220, y: 0 },
  MID_RIGHT: { x: 740, y: 0 },
  BACK_CENTER: { x: 480, y: 0 },
};

export class V2BattleScene extends Phaser.Scene {
  private engine!: BattleEngine;
  private unitSprites = new Map<string, Phaser.GameObjects.Container>();
  private hpBars = new Map<string, Phaser.GameObjects.Graphics>();
  private hpTexts = new Map<string, Phaser.GameObjects.Text>();
  private statusIcons = new Map<string, Phaser.GameObjects.Text>();
  private turnText!: Phaser.GameObjects.Text;
  private logText!: Phaser.GameObjects.Text;
  private autoMode = true;

  constructor() {
    super({ key: 'V2BattleScene' });
  }

  create(): void {
    new BackgroundFX(this, 'battle');
    this.cameras.main.fadeIn(500, 0, 0, 0);

    const cards = cardsData as CardDefinition[];
    const skills = skillsData as SkillDefinition[];
    const cardMap = new Map(cards.map(c => [c.id, c]));

    // 从 registry 获取队伍配置
    const playerIds = (this.registry.get('v2PlayerDeck') as string[]) || cards.slice(0, 5).map(c => c.id);
    const enemyIds = (this.registry.get('v2EnemyDeck') as string[]) || cards.slice(5, 10).map(c => c.id);

    const makeUnits = (ids: string[], side: 'player' | 'enemy') => {
      return ids.slice(0, 5).map((id, i) => {
        const cardDef = cardMap.get(id) || cards[0];
        const cardInstance: CardInstance = {
          instanceId: `${side}_${i}`, cardId: id, level: 1, exp: 0,
          enhancement: 0, evolutionStage: 0, skillLevels: [1, 1, 1],
          friendship: 0, locked: false, derivedStats: { ...cardDef.baseStats },
        };
        return { cardDef, cardInstance, position: POSITIONS[i] };
      });
    };

    const playerUnits = makeUnits(playerIds, 'player');
    const enemyUnits = makeUnits(enemyIds, 'enemy');

    // 创建引擎
    this.engine = new BattleEngine(playerUnits, enemyUnits, skills, 42, { autoBattle: this.autoMode });

    // 布局卡牌
    this.layoutUnits(this.engine.getState().units);

    // UI
    this.turnText = this.add.text(480, 320, '', { fontSize: '14px', color: '#aaaaaa' }).setOrigin(0.5).setDepth(10);
    this.logText = this.add.text(20, 580, '', { fontSize: '11px', color: '#888888', wordWrap: { width: 920 } }).setDepth(10);

    // 分隔线
    const divider = this.add.graphics();
    divider.lineStyle(1, 0x4444aa, 0.3);
    divider.lineBetween(60, 320, 900, 320);

    this.add.text(480, 30, '— 敌方 —', { fontSize: '13px', color: '#ff6666' }).setOrigin(0.5).setDepth(10);
    this.add.text(480, 610, '— 我方 —', { fontSize: '13px', color: '#66ccff' }).setOrigin(0.5).setDepth(10);

    // 自动/手动切换按钮
    const modeBtn = this.add.text(900, 20, '[ 自动 ]', { fontSize: '12px', color: '#66ff66' }).setOrigin(1, 0).setInteractive({ useHandCursor: true }).setDepth(10);
    modeBtn.on('pointerdown', () => {
      this.autoMode = !this.autoMode;
      modeBtn.setText(this.autoMode ? '[ 自动 ]' : '[ 手动 ]');
      modeBtn.setColor(this.autoMode ? '#66ff66' : '#ffaa00');
    });

    // 订阅事件
    this.subscribeEvents();

    // 延迟启动战斗
    this.time.delayedCall(800, () => {
      this.engine.runBattle();
    });
  }

  private layoutUnits(units: BattleUnit[]): void {
    const ENEMY_Y = 150;
    const PLAYER_Y = 470;

    for (const unit of units) {
      const coord = POS_COORDS[unit.position];
      const y = unit.side === 'player' ? PLAYER_Y + coord.y : ENEMY_Y + coord.y;
      const x = coord.x;

      const container = this.add.container(x, y);

      // 真实卡图或占位色块
      const texKey = getV2CardTextureKey(unit.cardDef.id);
      const hasImg = this.textures.exists(texKey);
      if (hasImg) {
        const img = this.add.image(0, 0, texKey).setDisplaySize(65, 85);
        container.add(img);
      } else {
        const color = this.getElementColor(unit.cardDef.element);
        const card = this.add.graphics();
        card.fillStyle(color, 0.85);
        card.fillRoundedRect(-32, -42, 65, 85, 6);
        container.add(card);
      }

      // 稀有度边框
      const border = this.add.graphics();
      border.lineStyle(2, this.getRarityColor(unit.cardDef.rarity), 1);
      border.strokeRoundedRect(-33, -43, 66, 86, 6);
      container.add(border);

      // 名称
      const name = unit.cardDef.name.cn || unit.cardDef.name.en;
      const shortName = name.length > 4 ? name.slice(0, 4) : name;
      const nameText = this.add.text(0, -50, shortName, { fontSize: '9px', color: '#fff', stroke: '#000', strokeThickness: 1 }).setOrigin(0.5);
      container.add(nameText);

      // HP 条
      const hpBar = this.add.graphics();
      this.drawHpBar(hpBar, unit.currentSoldiers, unit.maxSoldiers, x, y + 50);
      this.hpBars.set(unit.uid, hpBar);

      // HP 文字
      const hpText = this.add.text(x, y + 62, `${unit.currentSoldiers}`, { fontSize: '9px', color: '#aaa' }).setOrigin(0.5);
      this.hpTexts.set(unit.uid, hpText);

      // 状态图标
      const statusText = this.add.text(x + 30, y - 40, '', { fontSize: '10px' }).setOrigin(0.5);
      this.statusIcons.set(unit.uid, statusText);

      this.unitSprites.set(unit.uid, container);
    }
  }

  private subscribeEvents(): void {
    const bus = this.engine.getEventBus();

    bus.on(BattleEvents.TURN_START, (data: any) => {
      this.turnText.setText(`— 第 ${data.turn} 回合 —`);
    });

    bus.on(BattleEvents.DAMAGE_DEALT, (data: any) => {
      const targetSprite = this.unitSprites.get(data.target);
      if (!targetSprite) return;
      const pos = { x: targetSprite.x, y: targetSprite.y };

      // 伤害飘字
      const color = data.isCrit ? '#ffdd00' : '#ffffff';
      const size = data.isCrit ? '20px' : '14px';
      const txt = this.add.text(pos.x, pos.y - 50, `-${data.damage}`, {
        fontSize: size, color, fontStyle: 'bold', stroke: '#000', strokeThickness: 2,
      }).setOrigin(0.5).setDepth(20);

      this.tweens.add({ targets: txt, y: pos.y - 90, alpha: 0, duration: 800, ease: 'Cubic.easeOut', onComplete: () => txt.destroy() });

      // 受击抖动
      this.tweens.add({ targets: targetSprite, x: targetSprite.x + 4, duration: 40, yoyo: true, repeat: 3, onComplete: () => { targetSprite.x = pos.x; } });

      // 更新 HP 条
      this.updateHpDisplay(data.target);

      // 日志
      this.appendLog(`${data.isCrit ? '暴击! ' : ''}→ ${data.damage} dmg`);
    });

    bus.on(BattleEvents.HEAL_APPLIED, (data: any) => {
      const targetSprite = this.unitSprites.get(data.target);
      if (!targetSprite) return;
      const txt = this.add.text(targetSprite.x, targetSprite.y - 50, `+${data.heal}`, {
        fontSize: '14px', color: '#66ff66', fontStyle: 'bold', stroke: '#000', strokeThickness: 2,
      }).setOrigin(0.5).setDepth(20);
      this.tweens.add({ targets: txt, y: targetSprite.y - 90, alpha: 0, duration: 800, onComplete: () => txt.destroy() });
      this.updateHpDisplay(data.target);
    });

    bus.on(BattleEvents.SKILL_TRIGGERED, (data: any) => {
      const banner = this.add.text(480, 300, `✦ ${data.skillName || data.skillId} ✦`, {
        fontSize: '20px', color: '#ffd700', fontStyle: 'bold', stroke: '#000', strokeThickness: 3,
      }).setOrigin(0.5).setAlpha(0).setDepth(20);
      this.tweens.add({ targets: banner, alpha: 1, duration: 200, yoyo: true, hold: 400, onComplete: () => banner.destroy() });
    });

    bus.on(BattleEvents.UNIT_DIED, (data: any) => {
      const sprite = this.unitSprites.get(data.unit);
      if (sprite) {
        this.tweens.add({ targets: sprite, alpha: 0.2, duration: 500 });
      }
      const hpBar = this.hpBars.get(data.unit);
      if (hpBar) hpBar.clear();
      const hpText = this.hpTexts.get(data.unit);
      if (hpText) hpText.setText('DEAD');
    });

    bus.on(BattleEvents.STATUS_APPLIED, (data: any) => {
      const icon = this.statusIcons.get(data.unit);
      if (icon && data.status) {
        const symbols: Record<string, string> = { STUN: '💫', SILENCE: '🔇', TAUNT: '🛡', ATTACK_UP: '⬆', DEFENSE_DOWN: '⬇', VULNERABILITY: '🎯' };
        icon.setText(symbols[data.status.type] || '●');
      }
    });

    bus.on(BattleEvents.STATUS_EXPIRED, (data: any) => {
      const icon = this.statusIcons.get(data.unit);
      if (icon) icon.setText('');
    });

    bus.on(BattleEvents.BATTLE_END, (data: any) => {
      const isWin = data.state.phase === 'player_win';
      const text = isWin ? '✦ 胜利 ✦' : '✗ 败北 ✗';
      const color = isWin ? '#ffd700' : '#ff4444';
      const victoryText = this.add.text(480, 320, text, {
        fontSize: '36px', color, fontStyle: 'bold', stroke: '#000', strokeThickness: 4,
      }).setOrigin(0.5).setAlpha(0).setDepth(30);
      this.tweens.add({ targets: victoryText, alpha: 1, duration: 500 });

      this.registry.set('v2BattleResult', { winner: isWin ? 'player' : 'enemy', turns: data.state.turn });
      this.time.delayedCall(2000, () => this.scene.start('V2ResultScene'));
    });
  }

  private updateHpDisplay(uid: string): void {
    const state = this.engine.getState();
    const unit = state.units.find(u => u.uid === uid);
    if (!unit) return;

    const sprite = this.unitSprites.get(uid);
    const hpBar = this.hpBars.get(uid);
    const hpText = this.hpTexts.get(uid);
    if (sprite && hpBar) {
      hpBar.clear();
      this.drawHpBar(hpBar, unit.currentSoldiers, unit.maxSoldiers, sprite.x, sprite.y + 50);
    }
    if (hpText) hpText.setText(`${Math.max(0, unit.currentSoldiers)}`);
  }

  private drawHpBar(g: Phaser.GameObjects.Graphics, current: number, max: number, x: number, y: number): void {
    const w = 60, h = 6;
    const ratio = Math.max(0, current / max);
    g.fillStyle(0x333333, 1);
    g.fillRoundedRect(x - w / 2, y, w, h, 2);
    const color = ratio > 0.6 ? 0x4caf50 : ratio > 0.3 ? 0xffc107 : 0xf44336;
    g.fillStyle(color, 1);
    g.fillRoundedRect(x - w / 2, y, w * ratio, h, 2);
  }

  private appendLog(text: string): void {
    const current = this.logText.text;
    const lines = current.split('\n');
    lines.push(text);
    if (lines.length > 3) lines.shift();
    this.logText.setText(lines.join('\n'));
  }

  private getElementColor(element: string): number {
    const colors: Record<string, number> = { PASSION: 0xc62828, COOL: 0x1565c0, LIGHT: 0x2e7d32, DARK: 0x6a1b9a, SPECIAL: 0xf57f17 };
    return colors[element] || 0x424242;
  }

  private getRarityColor(rarity: string): number {
    const colors: Record<string, number> = { N: 0x9e9e9e, R: 0x42a5f5, SR: 0xffa726, UR: 0xef5350, LR: 0xab47bc };
    return colors[rarity] || 0xffffff;
  }
}
