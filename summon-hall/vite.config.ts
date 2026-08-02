import { defineConfig } from 'vite';

/**
 * 素材已全部迁移至 public/ 自包含：
 *   public/archive/battle-bg/  ← 原 神女控2/.../Battle/Background（128 张）
 *   public/archive/map/        ← 原 神女控2/.../Battle/Map（133 张）
 *   public/archive/bgm/        ← 原 神女控2/.../Audio/stream（25 首）
 *   public/archive/items/      ← 原 神女控2/.../Items/Enhancement（12 张）
 *   public/images/             ← 原 神女控/images（3380 张卡图，1.7G）
 * public 目录由 Vite 直接静态服务，URL 与旧中间件挂载一致（/archive/*、/images/*）。
 * 素材为粉丝归档，仅私人原型用，已通过 .gitignore 排除，不进 GitHub。
 */
export default defineConfig({
  server: {
    port: 3100,
    strictPort: true,
  },
});
