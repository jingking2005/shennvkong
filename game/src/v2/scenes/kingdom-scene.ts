import Phaser from 'phaser';
import { BackgroundFX } from '../../ui/BackgroundFX';
import { loadSave, writeSave, earn } from '../systems/save-economy';

export class V2KingdomScene extends Phaser.Scene {
  constructor() { super({ key: 'V2KingdomScene' }); }

  create(): void {
    new BackgroundFX(this, 'team');
    this.cameras.main.fadeIn(400, 0, 0, 0);
    const { width, height } = this.scale;
    const save = loadSave();

    // 顶栏
    const topBar = this.add.graphics();
    topBar.fillStyle(0x0a0a2a, 0.9);
    topBar.fillRect(0, 0, width, 45);
    this.add.text(width / 2, 22, '🏰 王国', { fontSize: '18px', color: '#44ff88', fontStyle: 'bold' }).setOrigin(0.5);

    const back = this.add.text(30, 22, '← 返回', { fontSize: '14px', color: '#aaa' }).setOrigin(0, 0.5).setInteractive({ useHandCursor: true });
    back.on('pointerdown', () => { this.cameras.main.fadeOut(200, 0, 0, 0); this.time.delayedCall(200, () => this.scene.start('V2HubScene')); });

    // 建筑列表
    const buildings = [
      { name: '城堡', level: save.kingdom.buildings['castle'] || 1, icon: '🏰', yield: '解锁建筑', color: '#ffd700' },
      { name: '农场', level: save.kingdom.buildings['farm'] || 0, icon: '🌾', yield: '+50 Gold/分', color: '#ffdd44' },
      { name: '以太炉', level: save.kingdom.buildings['ether'] || 0, icon: '🔮', yield: '+10 Ether/分', color: '#aa44ff' },
      { name: '铁矿', level: save.kingdom.buildings['iron'] || 0, icon: '⛏️', yield: '+8 Iron/分', color: '#888888' },
      { name: '兵营', level: save.kingdom.buildings['barracks'] || 0, icon: '⚔️', yield: '+5 Cost上限', color: '#ff4444' },
      { name: '技能研究所', level: save.kingdom.buildings['skilllab'] || 0, icon: '📚', yield: '解锁技能升级', color: '#4488ff' },
    ];

    buildings.forEach((b, i) => {
      const y = 80 + i * 85;
      const panel = this.add.graphics();
      panel.fillStyle(0x111122, 0.8);
      panel.fillRoundedRect(60, y, width - 120, 70, 8);
      panel.lineStyle(1, Phaser.Display.Color.HexStringToColor(b.color).color, 0.4);
      panel.strokeRoundedRect(60, y, width - 120, 70, 8);

      this.add.text(90, y + 15, `${b.icon} ${b.name}`, { fontSize: '16px', color: b.color, fontStyle: 'bold' });
      this.add.text(90, y + 42, `Lv.${b.level}  |  产出: ${b.yield}`, { fontSize: '11px', color: '#aaa' });

      // 升级按钮
      const upgradeCost = (b.level + 1) * 500;
      const btn = this.add.text(width - 140, y + 30, `升级\n💰${upgradeCost}`, {
        fontSize: '11px', color: '#66ff66', backgroundColor: '#1a3a1a', padding: { x: 10, y: 6 }, align: 'center',
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });

      btn.on('pointerdown', () => {
        if ((save.currencies.gold || 0) >= upgradeCost) {
          save.currencies.gold -= upgradeCost;
          const key = ['castle', 'farm', 'ether', 'iron', 'barracks', 'skilllab'][i];
          save.kingdom.buildings[key] = (save.kingdom.buildings[key] || 0) + 1;
          writeSave(save);
          this.scene.restart();
        }
      });
    });

    // 收取资源按钮
    const collectBtn = this.add.text(width / 2, height - 40, '[ 收取所有资源 ]', {
      fontSize: '16px', color: '#ffd700', backgroundColor: '#2a2a1a', padding: { x: 20, y: 8 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    collectBtn.on('pointerdown', () => {
      const farmLv = save.kingdom.buildings['farm'] || 0;
      const etherLv = save.kingdom.buildings['ether'] || 0;
      const ironLv = save.kingdom.buildings['iron'] || 0;
      earn(save, { gold: farmLv * 100, ether: etherLv * 20, iron: ironLv * 15 });
      writeSave(save);
      this.showFloating(`+${farmLv * 100} Gold  +${etherLv * 20} Ether  +${ironLv * 15} Iron`);
    });
  }

  private showFloating(text: string): void {
    const t = this.add.text(480, 300, text, { fontSize: '14px', color: '#ffd700', fontStyle: 'bold' }).setOrigin(0.5).setDepth(50);
    this.tweens.add({ targets: t, y: 250, alpha: 0, duration: 1500, onComplete: () => t.destroy() });
  }
}
