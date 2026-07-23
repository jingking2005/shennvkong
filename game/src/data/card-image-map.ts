/**
 * 卡牌 slug → images/ 目录名映射
 * 用于从真实卡图目录加载图片
 */

export const CARD_IMAGE_MAP: Record<string, string> = {
  'goddess-athena': 'Athena',
  'demon-lucifer': 'Lucifer',
  'valkyrie-brynhildr': 'Arch Knight',
  'ice-queen': 'Elemental Queen',
  'angel-raphael': 'Archangel',
  'vampire-carmilla': 'Carmilla',
  'knight-nova': 'Knight',
  'frost-fairy': 'Cool Fairy',
  'priestess-light': 'Angelic Oracle',
  'dark-mage': 'Dark Mage',
  'slime': 'Cute Slime',
  'goblin': 'Dark Elf',
};

/**
 * 根据卡牌 slug 获取图片加载路径
 * 返回相对于 Vite 开发服务器的路径
 * 图片文件名中空格用下划线替代
 */
export function getCardImageUrl(slug: string): string | null {
  const dirName = CARD_IMAGE_MAP[slug];
  if (!dirName) return null;
  const fileName = dirName.replace(/ /g, '_');
  return `/images/${dirName}/${fileName}.png`;
}
