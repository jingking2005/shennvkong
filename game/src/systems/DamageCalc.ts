import type { Element } from '../data/schema/types';

/**
 * 属性克制环：Passion > Cool > Light > Dark > Passion
 * Special 对所有属性 1.0
 */
const ADVANTAGE_MAP: Record<Element, Element> = {
  Passion: 'Cool',
  Cool: 'Light',
  Light: 'Dark',
  Dark: 'Passion',
  Special: 'Special', // Special 不克制任何
};

export function getElementBonus(attacker: Element, defender: Element): number {
  if (attacker === 'Special' || defender === 'Special') return 1.0;
  if (ADVANTAGE_MAP[attacker] === defender) return 1.3;
  if (ADVANTAGE_MAP[defender] === attacker) return 0.7;
  return 1.0;
}

export interface DamageInput {
  atk: number;
  def: number;
  multiplier: number;
  attackerElement: Element;
  defenderElement: Element;
}

export function calculateDamage(input: DamageInput): number {
  const { atk, def, multiplier, attackerElement, defenderElement } = input;
  const baseDamage = atk * multiplier - def * 0.5;
  const elementBonus = getElementBonus(attackerElement, defenderElement);
  return Math.max(1, Math.floor(baseDamage * elementBonus));
}
