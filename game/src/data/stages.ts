import type { Stage } from './schema/types';

/**
 * 5 个难度递增关卡
 * enemies 中的 cardId 对应 mock-cards.json 中的卡牌 id
 * 后续接入真实数据后可替换为卡池随机
 */
export const stages: Stage[] = [
  {
    id: 'stage-1',
    name: '荒野遭遇',
    difficulty: 1,
    enemies: [
      { cardId: 'slime' },
      { cardId: 'goblin' },
    ],
  },
  {
    id: 'stage-2',
    name: '冰霜洞窟',
    difficulty: 2,
    enemies: [
      { cardId: 'frost-fairy' },
      { cardId: 'ice-queen' },
      { cardId: 'goblin' },
    ],
  },
  {
    id: 'stage-3',
    name: '暗夜神殿',
    difficulty: 3,
    enemies: [
      { cardId: 'dark-mage' },
      { cardId: 'vampire-carmilla' },
      { cardId: 'demon-lucifer' },
    ],
  },
  {
    id: 'stage-4',
    name: '圣光试炼',
    difficulty: 4,
    enemies: [
      { cardId: 'priestess-light' },
      { cardId: 'angel-raphael' },
      { cardId: 'goddess-athena' },
      { cardId: 'knight-nova' },
    ],
  },
  {
    id: 'stage-5',
    name: '诸神黄昏',
    difficulty: 5,
    enemies: [
      { cardId: 'goddess-athena' },
      { cardId: 'demon-lucifer' },
      { cardId: 'valkyrie-brynhildr' },
      { cardId: 'ice-queen' },
      { cardId: 'angel-raphael' },
    ],
  },
];
