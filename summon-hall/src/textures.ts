/**
 * textures.ts —— VC 归档静态纹理加载器（public/vc/ 下，Vite 静态服务）
 * 用于召唤页壁纸、卡池选项卡、横条 logo、货币图标等非卡牌图片
 */

const cache = new Map<string, HTMLImageElement>();

export function preloadTex(name: string, retry = 2): Promise<HTMLImageElement> {
  const url = `/vc/${name}.png`;
  const hit = cache.get(url);
  if (hit?.complete && hit.naturalWidth > 0) return Promise.resolve(hit);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => { cache.set(url, img); resolve(img); };
    img.onerror = () => {
      if (retry > 0) {
        setTimeout(() => preloadTex(name, retry - 1).then(resolve, reject), 600);
      } else {
        reject(new Error('tex load failed: ' + url));
      }
    };
    img.src = url;
    cache.set(url, img);
  });
}

export function getTex(name: string): HTMLImageElement | null {
  const img = cache.get(`/vc/${name}.png`);
  return img?.complete && img.naturalWidth > 0 ? img : null;
}

/** 全部召唤系统纹理预加载（启动时并行拉取，命中缓存后零延迟） */
export const VC_TEX = [
  'course1', 'course2', 'course3', 'course4', 'course5', 'course6',
  'gbtn_beginner', 'gbtn_duel', 'gbtn_event', 'gbtn_guild', 'gbtn_guild2',
  'gbtn_guildcamp', 'gbtn_hell', 'gbtn_thor', 'gbtn_tower', 'gbtn_weapon',
  'bg_sp_login', 'bg_gacha', 'anibg1', 'anibg2', 'anibg3',
  'bg_shop', 'deck_bg', 'logo_enemy', 'weapon_engage', 'logo_witchhunt3', 'witchgate_bg',
  'campaign1', 'campaign2', 'campaign3',
  'icon_ticket', 'icon_gold', 'icon_energy', 'icon_gems',
];

export function preloadAllTex(): void {
  for (const n of VC_TEX) preloadTex(n).catch(() => {});
}

/** 调试：导出纹理缓存状态 */
export function texStatus(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const n of VC_TEX) {
    const img = cache.get(`/vc/${n}.png`);
    out[n] = img ? (img.complete ? `ok(${img.naturalWidth})` : 'loading') : 'missing';
  }
  return out;
}

/** cover 铺满绘制（保持比例居中裁切） */
export function drawCoverTex(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number, y: number, w: number, h: number,
  alpha = 1,
): void {
  if (!img.complete || !img.naturalWidth) return;
  const sc = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const dw = img.naturalWidth * sc, dh = img.naturalHeight * sc;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  ctx.restore();
}
