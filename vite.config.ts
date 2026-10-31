import { createReadStream, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const ortDir = path.resolve(rootDir, 'node_modules/onnxruntime-web/dist');

function serveOrt(): Plugin {
  const attach = (middlewares: {
    use: (
      path: string,
      handler: (
        req: { url?: string },
        res: NodeJS.WritableStream & { setHeader: (name: string, value: string) => void },
        next: () => void,
      ) => void,
    ) => void;
  }) => {
    middlewares.use('/ort', (req, res, next) => {
      const name = path.basename(decodeURIComponent((req.url ?? '/').split('?')[0]));
      if (!/^[\w.-]+$/.test(name)) {
        next();
        return;
      }
      const file = path.join(ortDir, name);
      if (!file.startsWith(ortDir)) {
        next();
        return;
      }
      try {
        const info = statSync(file);
        if (!info.isFile()) {
          next();
          return;
        }
        res.setHeader(
          'Content-Type',
          name.endsWith('.wasm') ? 'application/wasm' : 'text/javascript',
        );
        res.setHeader('Content-Length', String(info.size));
        createReadStream(file).pipe(res);
      } catch {
        next();
      }
    });
  };
  return {
    name: 'serve-ort-wasm',
    configureServer(server) {
      attach(server.middlewares);
    },
    configurePreviewServer(server) {
      attach(server.middlewares);
    },
  };
}

const ortWebgpu = path.join(ortDir, 'ort.webgpu.min.mjs');

export default defineConfig({
  plugins: [react(), tailwindcss(), serveOrt()],
  resolve: {
    alias: {
      '@': path.resolve(rootDir, 'src'),
      'onnxruntime-web/webgpu': ortWebgpu,
    },
    conditions: ['onnxruntime-web-use-extern-wasm'],
  },
  worker: { format: 'es' },
  optimizeDeps: { exclude: ['onnxruntime-web'] },
});
