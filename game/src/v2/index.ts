/**
 * V2 游戏入口 — 注册所有 V2 场景
 */

import Phaser from 'phaser';
import { V2MenuScene } from './scenes/menu-scene';
import { V2TeamScene } from './scenes/team-scene';
import { V2BattleScene } from './scenes/battle-scene';
import { V2ResultScene } from './scenes/result-scene';

export const V2_SCENES = [V2MenuScene, V2TeamScene, V2BattleScene, V2ResultScene];

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
