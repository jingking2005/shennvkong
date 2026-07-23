import Phaser from 'phaser';
import { V2BootScene } from './scenes/boot-scene';
import { V2HubScene } from './scenes/hub-scene';
import { V2MenuScene } from './scenes/menu-scene';
import { V2TeamScene } from './scenes/team-scene';
import { V2BattleScene } from './scenes/battle-scene';
import { V2ResultScene } from './scenes/result-scene';
import { V2GachaScene } from './scenes/gacha-scene';
import { V2CollectionScene } from './scenes/collection-scene';
import { V2KingdomScene } from './scenes/kingdom-scene';
import { V2GrowthScene } from './scenes/growth-scene';

export const V2_SCENES = [
  V2BootScene,
  V2HubScene,
  V2MenuScene,
  V2TeamScene,
  V2BattleScene,
  V2ResultScene,
  V2GachaScene,
  V2CollectionScene,
  V2KingdomScene,
  V2GrowthScene,
];

export function createV2Game(parent: string): Phaser.Game {
  const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    width: 960,
    height: 640,
    parent,
    backgroundColor: '#0a0a1a',
    scene: V2_SCENES,
  };
  return new Phaser.Game(config);
}
