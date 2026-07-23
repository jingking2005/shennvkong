import type { Skill } from '../data/schema/types';

/**
 * 判定技能是否触发
 * @param skill 技能定义
 * @param rng 随机数生成器（可注入，便于测试）
 */
export function rollSkillTrigger(skill: Skill, rng: () => number = Math.random): boolean {
  return rng() < skill.rate;
}
