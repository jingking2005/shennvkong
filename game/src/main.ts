import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { MenuScene } from './scenes/MenuScene';
import { StageSelectScene } from './scenes/StageSelectScene';
import { TeamScene } from './scenes/TeamScene';
import { BattleScene } from './scenes/BattleScene';
import { ResultScene } from './scenes/ResultScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 960,
  height: 640,
  parent: 'game-container',
  backgroundColor: '#1a1a2e',
  scene: [BootScene, MenuScene, StageSelectScene, TeamScene, BattleScene, ResultScene],
};

new Phaser.Game(config);
