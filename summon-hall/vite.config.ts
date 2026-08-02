import { defineConfig, type Plugin } from 'vite';
import path from 'path';
import fs from 'fs';

const ARCHIVE_ROOT = path.resolve(
  __dirname,
  '../../神女控2/archive/final-archive/extracted/Valkyrie Crusade Fan Archive - Final - 2022-09-16',
);

function contentType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.ogg') return 'audio/ogg';
  if (ext === '.mp3') return 'audio/mpeg';
  if (ext === '.wav') return 'audio/wav';
  if (ext === '.m4a') return 'audio/mp4';
  return 'application/octet-stream';
}

function serveStaticMount(mount: string, dir: string): Plugin {
  return {
    name: `serve-${mount.replace(/\W+/g, '-')}`,
    configureServer(server) {
      server.middlewares.use(mount, (req, res, next) => {
        const rel = decodeURIComponent((req.url || '').replace(/^\//, '').split('?')[0]);
        const filePath = path.join(dir, rel);
        if (!filePath.startsWith(dir)) return next();
        if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
          res.setHeader('Content-Type', contentType(filePath));
          res.setHeader('Cache-Control', 'public, max-age=86400');
          fs.createReadStream(filePath).pipe(res);
        } else {
          next();
        }
      });
    },
  };
}

/** 服务上级 images/ 卡图目录 */
function serveImages(): Plugin {
  return serveStaticMount('/images', path.resolve(__dirname, '../images'));
}

export default defineConfig({
  plugins: [
    serveImages(),
    serveStaticMount('/archive/map', path.join(ARCHIVE_ROOT, 'Battle/Map')),
    serveStaticMount('/archive/battle-bg', path.join(ARCHIVE_ROOT, 'Battle/Background')),
    // Battle/Audio 为空；使用归档 Audio/stream
    serveStaticMount('/archive/bgm', path.join(ARCHIVE_ROOT, 'Audio/stream')),
    // 强化道具 / 药水（探索奖励）
    serveStaticMount('/archive/items', path.join(ARCHIVE_ROOT, 'Items/Enhancement')),
  ],
  server: {
    port: 3100,
    strictPort: true,
    fs: { allow: [path.resolve(__dirname, '..'), ARCHIVE_ROOT] },
  },
});
