import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';

function loadRootEnv(): Record<string, string> {
  const envPath = path.resolve(__dirname, '../../.env');
  if (!fs.existsSync(envPath)) return {};
  const content = fs.readFileSync(envPath, 'utf-8');
  const env: Record<string, string> = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const [key, ...valParts] = trimmed.split('=');
    if (key) env[key.trim()] = valParts.join('=').trim();
  }
  return env;
}

function chromeExtensionManifestPlugin(): Plugin {
  return {
    name: 'chrome-extension-manifest',
    closeBundle() {
      const manifestPath = path.resolve(__dirname, 'manifest.json');
      const distPath = path.resolve(__dirname, 'dist');
      const distManifestPath = path.resolve(distPath, 'manifest.json');

      if (!fs.existsSync(distPath)) {
        fs.mkdirSync(distPath, { recursive: true });
      }

      const rootEnv = loadRootEnv();
      const rawManifest = fs.readFileSync(manifestPath, 'utf-8');
      const manifest = JSON.parse(rawManifest);

      // 1. Update MV3 entry points to point to bundled output files in dist
      manifest.background = {
        service_worker: 'background.js',
        type: 'module'
      };
      manifest.content_scripts = [
        {
          matches: ['<all_urls>'],
          js: ['content.js'],
          run_at: 'document_idle'
        }
      ];

      // 2. Popup action points to the compiled popup HTML
      manifest.action = {
        ...manifest.action,
        default_popup: 'popup.html'
      };

      // 3. Resolve Google OAuth Client ID placeholder from env safely
      const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID || rootEnv.GOOGLE_OAUTH_CLIENT_ID || '';
      if (manifest.oauth2) {
        manifest.oauth2.client_id = clientId;
      }

      fs.writeFileSync(distManifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
      console.log(`[manifest-plugin] Transformed manifest written to ${distManifestPath}`);

      // 4. Copy icons from public to dist (if not already there from Vite's publicDir copy)
      const publicIconsPath = path.resolve(__dirname, 'public', 'icons');
      const distIconsPath = path.resolve(distPath, 'icons');
      if (fs.existsSync(publicIconsPath) && !fs.existsSync(distIconsPath)) {
        fs.mkdirSync(distIconsPath, { recursive: true });
        for (const file of fs.readdirSync(publicIconsPath)) {
          fs.copyFileSync(
            path.join(publicIconsPath, file),
            path.join(distIconsPath, file)
          );
        }
        console.log('[manifest-plugin] Copied icons to dist/icons/');
      }
    }
  };
}

export default defineConfig({
  plugins: [react(), chromeExtensionManifestPlugin()],
  resolve: {
    alias: {
      '@sara/shared': path.resolve(__dirname, '../../packages/shared/src/index.ts'),
      '@sara/site-adapters': path.resolve(__dirname, '../../packages/site-adapters/src/index.ts'),
      '@sara/recommendation-engine': path.resolve(__dirname, '../../packages/recommendation-engine/src/index.ts')
    }
  },
  publicDir: false,
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        background: path.resolve(__dirname, 'src/background/index.ts'),
        popup: path.resolve(__dirname, 'popup.html')
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === 'background') return 'background.js';
          return 'assets/[name]-[hash].js';
        }
      }
    }
  }
});
