/**
 * 资源解析器（变更单 §4.2）：AssetRef → URL、用途区分、fallback、缓存、诊断。
 * 不负责抽卡/战斗/存档/页面跳转。
 */

import { reportAssetFailure } from '../diag';
import type { CardAssetRef, CardAssetRole, CardDefinition } from './types';

const cache = new Map<string, HTMLImageElement>();
const failedAssets = new Set<string>();
const missingAssets = new Set<string>();

/** 解析资源 URL 并纳入缓存；加载失败进 failedAssets 诊断 */
export function resolveImage(ref: CardAssetRef): HTMLImageElement {
  let img = cache.get(ref.asset);
  if (img) return img;
  img = new Image();
  img.onerror = () => {
    failedAssets.add(ref.asset);
    reportAssetFailure('image', ref.asset);
  };
  img.src = ref.asset;
  cache.set(ref.asset, img);
  return img;
}

/**
 * 按用途取卡牌的资源引用；不存在时返回 null（UI 显示「无缩略图」，
 * 而不是请求一个不存在的 URL）。
 */
export function formOf(card: CardDefinition, role: CardAssetRole): CardAssetRef | null {
  return card.forms.find(f => f.role === role) ?? null;
}

/** 登记「manifest 中本应存在但缺失」的资源（构建/校验期使用） */
export function reportMissingAsset(asset: string): void {
  missingAssets.add(asset);
}

export function getFailedAssets(): readonly string[] {
  return [...failedAssets];
}

export function getMissingAssets(): readonly string[] {
  return [...missingAssets];
}

/** 测试用：清空诊断与缓存 */
export function resetAssetResolver(): void {
  cache.clear();
  failedAssets.clear();
  missingAssets.clear();
}
