import { defineConfig, type Plugin } from 'vite';
import path from 'path';
import fs from 'fs';

/** 服务上级 images/ 目录的插件 */
function serveImages(): Plugin {
  const imagesDir = path.resolve(__dirname, '../images');
  return {
    name: 'serve-images',
    configureServer(server) {
      server.middlewares.use('/images', (req, res, next) => {
        const filePath = path.join(imagesDir, decodeURIComponent(req.url || ''));
        if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
          res.setHeader('Content-Type', 'image/webp');
          res.setHeader('Cache-Control', 'public, max-age=86400');
          fs.createReadStream(filePath).pipe(res);
        } else {
          next();
        }
      });
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [serveImages()],
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  },
  server: {
    port: 3000,
    open: true,
    fs: {
      allow: [path.resolve(__dirname, '..')],
    },
  },
});
