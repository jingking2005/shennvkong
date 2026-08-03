/**
 * 资源加载诊断：图片/音频失败统一记录 + 一次性 console.warn。
 * 开发/测试通过 window.__assetDiag 读取，烟雾测试据此判定 0 Error。
 */

export interface AssetDiagEntry { kind: 'image' | 'audio'; src: string; at: number; }

export interface AssetDiag {
  failed: AssetDiagEntry[];
}

const seen = new Set<string>();
const diag: AssetDiag = { failed: [] };

export function reportAssetFailure(kind: 'image' | 'audio', src: string): void {
  const key = `${kind}:${src}`;
  if (seen.has(key)) return;
  seen.add(key);
  diag.failed.push({ kind, src, at: Date.now() });
  console.warn(`[asset:${kind}] 加载失败: ${src}`);
}

export function getAssetDiag(): AssetDiag {
  return diag;
}

declare global {
  interface Window { __assetDiag?: AssetDiag; }
}

if (typeof window !== 'undefined') {
  window.__assetDiag = diag;
}
