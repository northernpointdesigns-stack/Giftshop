import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import {defineConfig} from 'vite';

const desktopVersion = '1.0.0';

export default defineConfig(() => {
  return {
    // Electron loads the production build with file://, so bundled assets
    // must resolve relative to dist/index.html instead of the filesystem root.
    base: './',
    plugins: [
      react(), 
      tailwindcss(),
      {
        name: 'serve-desktop-builds',
        configureServer(server) {
          server.middlewares.use((req, res, next) => {
            const url = req.url || '';
            if (url.startsWith('/download/BoutiquePOS.AppImage')) {
              const filePath = path.resolve(__dirname, `dist-desktop/BoutiquePOS-${desktopVersion}.AppImage`);
              if (fs.existsSync(filePath)) {
                res.writeHead(200, {
                  'Content-Type': 'application/octet-stream',
                  'Content-Disposition': `attachment; filename="BoutiquePOS-${desktopVersion}.AppImage"`
                });
                fs.createReadStream(filePath).pipe(res);
                return;
              }
            }
            if (url.startsWith('/download/BoutiquePOS.snap')) {
              const filePath = path.resolve(__dirname, `dist-desktop/boutique-pos_${desktopVersion}_amd64.snap`);
              if (fs.existsSync(filePath)) {
                res.writeHead(200, {
                  'Content-Type': 'application/octet-stream',
                  'Content-Disposition': `attachment; filename="BoutiquePOS-${desktopVersion}.snap"`
                });
                fs.createReadStream(filePath).pipe(res);
                return;
              }
            }
            next();
          });
        }
      }
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      allowedHosts: true,
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
