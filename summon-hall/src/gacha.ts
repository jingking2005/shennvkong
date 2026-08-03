/**
 * 抽卡适配层（OC-07）：实现已迁至 systems/gacha/gacha-engine.ts，
 * 概率/保底配置在 systems/gacha/gacha-config.json（original-fill 离线演示配置）。
 * 本文件仅 re-export，保持 main.ts 等调用方不变。
 */

export type { PoolEntry, HardPity, Banner, Pull, PityProgress } from './systems/gacha/gacha-engine';
export {
  BANNERS, Gacha, rateTable, bannerShowcase, bannerCards,
} from './systems/gacha/gacha-engine';
