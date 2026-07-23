/**
 * V2 卡牌 → 真实卡图路径映射
 */
export const V2_CARD_IMAGE_MAP: Record<string, string> = {
  'v2-athena': 'Athena',
  'v2-lucifer': 'Lucifer',
  'v2-brynhildr': 'Arch Knight',
  'v2-ice-queen': 'Elemental Queen',
  'v2-raphael': 'Raphael',
  'v2-carmilla': 'Carmilla',
  'v2-nova': 'Knight',
  'v2-frost-fairy': 'Cool Fairy',
  'v2-priestess': 'Priest',
  'v2-dark-mage': 'Dark Mage',
  'v2-slime': 'Cute Slime',
  'v2-goblin': 'Dark Elf',
  'v2-shield-maiden': 'Rose Knight',
  'v2-assassin': 'Assassin',
  'v2-sage': 'Sage',
  'v2-necromancer': 'Necromancer',
};

export function getV2CardImageUrl(cardId: string): string | null {
  const dirName = V2_CARD_IMAGE_MAP[cardId];
  if (!dirName) return null;
  const fileName = dirName.replace(/ /g, '_');
  return `/images/${dirName}/${fileName}.png`;
}

export function getV2CardTextureKey(cardId: string): string {
  return `card-${cardId}`;
}
