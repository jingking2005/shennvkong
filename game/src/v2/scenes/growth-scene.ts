import Phaser from 'phaser';
import { BackgroundFX } from '../../ui/BackgroundFX';
import { getV2CardTextureKey } from '../data/card-images';
import { loadSave, writeSave, updateInventory } from '../systems/save-economy';
import { levelUp, enhance, applyEnhance, getExpForLevel, getMaxLevel, getMaterialExp } from '../systems/progression';
import type { CardDefinition, CardInstance } from '../data/types';
import cardsData from '../../../data/v2/fixtures/cards.json';

export class V2GrowthScene extends Phaser.Scene {
  private save = loadSave();
  private cards = cardsData as CardDefinition[];
  private selectedIdx = -1;
  private detailTexts: Phaser.GameObjects.Text[] = [];

  constructor() { super({ key: 'V2GrowthScene' }); }

  create(): void {
    new BackgroundFX(this, 'team');
    this.cameras.main.fadeIn(400, 0, 0, 0);
    const { width } = this.scale;

    // 顶栏
    const topBar = this.add.graphics();
    topBar.fillStyle(0x0a0a2a, 0.9);
    topBar.fillRect(0, 0, width, 45);
    this.add.text(width / 2, 22, '🔧 养成', { fontSize: '18px', color: '#ffaa44', fontStyle: 'bold' }).setOrigin(0.5);
    this.add.text(width - 100, 22, `💰 ${this.save.currencies.gold}`, { fontSize: '12px', color: '#ffdd44' }).setOrigin(0.5);

    const back = this.add.text(30, 22, '← 返回', { fontSize: '14px', color: '#aaa' }).setOrigin(0, 0.5).setInteractive({ useHandCursor: true });
    back.on('pointerdown', () => { this.cameras.main.fadeOut(200, 0, 0, 0); this.time.delayedCall(200, () => this.scene.start('V2HubScene')); });

    // 如果没有卡牌，给初始卡
    if (this.save.inventory.length === 0) {
      this.giveStarterCards();
    }

    // 左侧：卡牌列表
    this.add.text(120, 60, '你的卡牌', { fontSize: '13px', color: '#aaa' }).setOrigin(0.5);
    this.save.inventory.forEach((inst, i) => {
      const cardDef = this.cards.find(c => c.id === inst.cardId);
      if (!cardDef) return;
      const y = 85 + i * 50;
      if (y > 580) return;

      const texKey = getV2CardTextureKey(inst.cardId);
      const hasImg = this.textures.exists(texKey);

      const row = this.add.container(120, y);

      if (hasImg) {
        const img = this.add.image(-80, 0, texKey).setDisplaySize(35, 42);
        row.add(img);
      }

      const name = cardDef.name.cn || cardDef.name.en;
      const label = this.add.text(-55, -8, `${name.slice(0, 5)}`, { fontSize: '11px', color: '#fff' });
      row.add(label);
      const info = this.add.text(-55, 8, `Lv.${inst.level} +${inst.enhancement} ★${inst.evolutionStage}`, { fontSize: '9px', color: '#888' });
      row.add(info);

      const zone = this.add.zone(0, 0, 200, 45).setInteractive({ useHandCursor: true });
      row.add(zone);
      zone.on('pointerdown', () => this.selectCard(i));
    });

    // 右侧：详情+操作
    this.add.text(550, 60, '选择一张卡牌', { fontSize: '13px', color: '#666' }).setOrigin(0.5).setName('detailTitle');
  }

  private selectCard(idx: number): void {
    this.selectedIdx = idx;
    const inst = this.save.inventory[idx];
    const cardDef = this.cards.find(c => c.id === inst.cardId);
    if (!cardDef) return;

    // 清除旧详情
    this.detailTexts.forEach(t => t.destroy());
    this.detailTexts = [];

    const x = 550;
    const maxLv = getMaxLevel(cardDef.rarity);
    const nextExp = getExpForLevel(inst.level);

    const addText = (y: number, text: string, color = '#ccc', size = '12px') => {
      const t = this.add.text(x, y, text, { fontSize: size, color }).setOrigin(0.5);
      this.detailTexts.push(t);
      return t;
    };

    addText(90, `${cardDef.name.cn || cardDef.name.en}`, '#ffd700', '16px');
    addText(115, `${cardDef.rarity} · ${cardDef.element} · ${cardDef.primaryRole}`, '#888', '11px');
    addText(145, `等级: ${inst.level}/${maxLv}  经验: ${inst.exp}/${nextExp}`, '#aaa');
    addText(165, `强化: +${inst.enhancement}  进化: ★${inst.evolutionStage}`, '#aaa');
    addText(195, `ATK: ${inst.derivedStats.attack}  DEF: ${inst.derivedStats.defense}`, '#fff');
    addText(215, `HP: ${inst.derivedStats.soldiers}  SPD: ${inst.derivedStats.speed}`, '#fff');

    // 升级按钮
    const lvBtn = this.add.text(x - 100, 270, '[ 升级 ]', {
      fontSize: '14px', color: '#66ff66', backgroundColor: '#1a3a1a', padding: { x: 12, y: 6 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    this.detailTexts.push(lvBtn);
    lvBtn.on('pointerdown', () => this.doLevelUp(idx));

    // 强化按钮
    const enhBtn = this.add.text(x + 100, 270, '[ 强化 ]', {
      fontSize: '14px', color: '#ffaa44', backgroundColor: '#3a2a1a', padding: { x: 12, y: 6 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    this.detailTexts.push(enhBtn);
    enhBtn.on('pointerdown', () => this.doEnhance(idx));

    // 强化概率显示
    const rates = [100, 90, 75, 60, 45, 30, 20, 12, 7, 3];
    const curRate = inst.enhancement < 10 ? rates[inst.enhancement] : 0;
    addText(310, `强化成功率: ${curRate}%  (→+${inst.enhancement + 1})`, '#ff8844', '11px');
    addText(330, `消耗: 1张同卡 + ${(inst.enhancement + 1) * 200} Gold`, '#888', '10px');

    // 升级消耗
    addText(360, `升级消耗: ${Math.floor(nextExp * 0.5)} Gold (用Gold代替素材卡)`, '#888', '10px');
  }

  private doLevelUp(idx: number): void {
    const inst = this.save.inventory[idx];
    const cardDef = this.cards.find(c => c.id === inst.cardId);
    if (!cardDef) return;

    const cost = Math.floor(getExpForLevel(inst.level) * 0.5);
    if ((this.save.currencies.gold || 0) < cost) {
      this.showMsg('Gold不足!'); return;
    }
    this.save.currencies.gold -= cost;

    const result = levelUp(inst, cardDef, getExpForLevel(inst.level));
    this.save.inventory[idx] = result.instance;
    writeSave(this.save);
    this.showMsg(`升级! Lv.${result.instance.level} (+${result.levelsGained})`);
    this.selectCard(idx);
  }

  private doEnhance(idx: number): void {
    const inst = this.save.inventory[idx];
    const cardDef = this.cards.find(c => c.id === inst.cardId);
    if (!cardDef) return;

    const cost = (inst.enhancement + 1) * 200;
    if ((this.save.currencies.gold || 0) < cost) {
      this.showMsg('Gold不足!'); return;
    }

    // 检查是否有同卡作为材料
    const matIdx = this.save.inventory.findIndex((c, i) => i !== idx && c.cardId === inst.cardId);
    if (matIdx < 0) {
      this.showMsg('需要同名卡作为材料!'); return;
    }

    this.save.currencies.gold -= cost;
    const result = enhance(inst, cardDef, this.save.inventory[matIdx].enhancement, Math.random);

    if (result.success) {
      this.save.inventory[idx] = applyEnhance(inst, cardDef, result);
      this.save.inventory.splice(matIdx, 1); // 消耗材料
      this.showMsg(`强化成功! +${result.newLevel} 🎉`);
    } else {
      if (result.degraded) {
        this.save.inventory[idx] = applyEnhance(inst, cardDef, result);
        this.showMsg(`强化失败... 降至+${result.newLevel} 💔`);
      } else {
        this.showMsg(`强化失败! 材料消失 💔`);
      }
      this.save.inventory.splice(matIdx, 1);
    }

    writeSave(this.save);
    this.selectCard(idx);
  }

  private giveStarterCards(): void {
    // 给玩家初始5张卡
    const starters = ['v2-athena', 'v2-nova', 'v2-raphael', 'v2-frost-fairy', 'v2-dark-mage'];
    starters.forEach((cardId, i) => {
      const cardDef = this.cards.find(c => c.id === cardId);
      if (!cardDef) return;
      this.save.inventory.push({
        instanceId: `starter_${i}`,
        cardId,
        level: 1,
        exp: 0,
        enhancement: 0,
        evolutionStage: 0,
        skillLevels: [1, 1, 1],
        friendship: 0,
        locked: false,
        derivedStats: { ...cardDef.baseStats },
      });
    });
    writeSave(this.save);
  }

  private showMsg(text: string): void {
    const t = this.add.text(480, 450, text, { fontSize: '14px', color: '#ffd700', fontStyle: 'bold', backgroundColor: '#000000aa', padding: { x: 10, y: 5 } }).setOrigin(0.5).setDepth(50);
    this.tweens.add({ targets: t, y: 420, alpha: 0, duration: 1500, onComplete: () => t.destroy() });
  }
}
