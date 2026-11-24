import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import type { Plugin } from 'vite';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const rootDir = import.meta.dirname;

const PWA_MANIFEST = {
  id: '/',
  name: 'Vision Plus - فيجن بلس',
  short_name: 'Vision Plus',
  description:
    'متجر فيجن بلس للبصريات والنظارات الطبية والشمسية والعدسات اللاصقة ومحاليلها في السودان بالـ ج.س مع استشارة أخصائي البصريات.',
  lang: 'ar',
  dir: 'rtl' as const,
  start_url: '/',
  scope: '/',
  display: 'standalone' as const,
  display_override: ['window-controls-overlay', 'standalone', 'minimal-ui'] as (
    | 'window-controls-overlay'
    | 'standalone'
    | 'minimal-ui'
  )[],
  orientation: 'portrait' as const,
  background_color: '#ffffff',
  theme_color: '#1565C0',
  categories: ['shopping'],
  prefer_related_applications: false,
  launch_handler: {
    client_mode: 'focus-existing' as const,
  },
  icons: [
    {
      src: '/icons/icon-192.png',
      sizes: '192x192',
      type: 'image/png',
      purpose: 'any',
    },
    {
      src: '/icons/icon-512.png',
      sizes: '512x512',
      type: 'image/png',
      purpose: 'any',
    },
    {
      src: '/icons/icon-maskable-192.png',
      sizes: '192x192',
      type: 'image/png',
      purpose: 'maskable',
    },
    {
      src: '/icons/icon-maskable-512.png',
      sizes: '512x512',
      type: 'image/png',
      purpose: 'maskable',
    },
  ],
  screenshots: [
    {
      src: '/screenshots/wide-home.png',
      sizes: '1280x720',
      type: 'image/png',
      form_factor: 'wide' as const,
      label: 'Vision Plus Desktop Storefront',
    },
    {
      src: '/screenshots/narrow-home.png',
      sizes: '540x960',
      type: 'image/png',
      form_factor: 'narrow' as const,
      label: 'Vision Plus Mobile Storefront',
    },
  ],
  shortcuts: [
    {
      name: 'التصنيفات',
      short_name: 'التصنيفات',
      description: 'تصفح أقسام النظارات والعدسات',
      url: '/#/categories',
      icons: [
        {
          src: '/icons/icon-192.png',
          sizes: '192x192',
          type: 'image/png',
        },
      ],
    },
    {
      name: 'سلة المشتريات',
      short_name: 'السلة',
      description: 'عرض سلة المشتريات وإتمام الطلب',
      url: '/#/cart',
      icons: [
        {
          src: '/icons/icon-192.png',
          sizes: '192x192',
          type: 'image/png',
        },
      ],
    },
    {
      name: 'طلباتي',
      short_name: 'الطلبات',
      description: 'متابعة حالة الطلبات والتوصيل',
      url: '/#/orders',
      icons: [
        {
          src: '/icons/icon-192.png',
          sizes: '192x192',
          type: 'image/png',
        },
      ],
    },
  ],
};

function pwaBuilderManifestPlugin(): Plugin {
  const manifestBody = JSON.stringify(PWA_MANIFEST, null, 2);

  return {
    name: 'pwabuilder-manifest-middleware',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const reqPath = (req.url || '').split('?')[0];
        if (reqPath === '/manifest.webmanifest' || reqPath === '/manifest.json') {
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
          res.setHeader('Cache-Control', 'no-cache');
          res.end(manifestBody);
          return;
        }
        next();
      });
    },
    transformIndexHtml(html, ctx) {
      // In dev server (especially with DISABLE_HMR=true where vite-plugin-pwa skips dev SW),
      // ensure the manifest link is still present for PWABuilder & browser detection.
      if (ctx.server && !html.includes('rel="manifest"')) {
        return html.replace(
          '</head>',
          '    <link rel="manifest" href="/manifest.webmanifest" />\n  </head>'
        );
      }
      return html;
    },
    closeBundle(error?: Error) {
      if (error) return;
      const distDir = path.resolve(rootDir, 'dist');
      const webmanifestPath = path.resolve(distDir, 'manifest.webmanifest');
      const manifestJsonPath = path.resolve(distDir, 'manifest.json');
      if (fs.existsSync(webmanifestPath)) {
        fs.copyFileSync(webmanifestPath, manifestJsonPath);
      }
    },
  };
}

function assetLinksJsonPlugin(): Plugin {
  const sendAssetLinks = (
    req: { url?: string },
    res: {
      statusCode: number;
      setHeader: (name: string, value: string) => void;
      end: (body: string) => void;
    },
    next: () => void
  ) => {
    const reqPath = (req.url || '').split('?')[0];
    if (reqPath === '/.well-known/assetlinks.json') {
      const candidates = [
        path.resolve(rootDir, 'dist/.well-known/assetlinks.json'),
        path.resolve(rootDir, 'public/.well-known/assetlinks.json'),
      ];
      const filePath = candidates.find((p) => fs.existsSync(p));
      const body = filePath ? fs.readFileSync(filePath, 'utf-8') : '[]';
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.end(body);
      return;
    }
    next();
  };

  return {
    name: 'assetlinks-json-middleware',
    configureServer(server) {
      server.middlewares.use((req, res, next) => sendAssetLinks(req, res, next));
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => sendAssetLinks(req, res, next));
    },
    closeBundle(error?: Error) {
      if (error) return;
      const srcAssetLinks = path.resolve(rootDir, 'public/.well-known/assetlinks.json');
      const distDir = path.resolve(rootDir, 'dist');
      const distWellKnown = path.resolve(distDir, '.well-known');
      const distAssetLinks = path.resolve(distWellKnown, 'assetlinks.json');
      if (fs.existsSync(srcAssetLinks) && fs.existsSync(distDir)) {
        fs.mkdirSync(distWellKnown, { recursive: true });
        fs.copyFileSync(srcAssetLinks, distAssetLinks);
      }
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      pwaBuilderManifestPlugin(),
      assetLinksJsonPlugin(),
      VitePWA({
        registerType: 'autoUpdate',
        injectRegister: 'auto',
        includeAssets: [
          'favicon.ico',
          'offline.html',
          'icons/apple-touch-icon.png',
          'icons/icon-192.png',
          'icons/icon-512.png',
          'icons/icon-maskable-192.png',
          'icons/icon-maskable-512.png',
          'screenshots/wide-home.png',
          'screenshots/narrow-home.png',
        ],
        manifest: PWA_MANIFEST,
        workbox: {
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
          navigateFallback: '/index.html',
          navigateFallbackDenylist: [/^\/\.well-known\//, /^\/offline\.html$/],
          cleanupOutdatedCaches: true,
          runtimeCaching: [
            // NEVER cache Firestore, Firebase Auth, or Firebase Storage API requests
            {
              urlPattern: /^https:\/\/firestore\.googleapis\.com\/.*/i,
              handler: 'NetworkOnly',
            },
            {
              urlPattern: /^https:\/\/identitytoolkit\.googleapis\.com\/.*/i,
              handler: 'NetworkOnly',
            },
            {
              urlPattern: /^https:\/\/securetoken\.googleapis\.com\/.*/i,
              handler: 'NetworkOnly',
            },
            {
              urlPattern: /^https:\/\/firebasestorage\.googleapis\.com\/.*/i,
              handler: 'NetworkOnly',
            },
            // Offline fallback page for failed HTML navigations
            {
              urlPattern: ({ request }) => request.mode === 'navigate',
              handler: 'NetworkFirst',
              options: {
                cacheName: 'pages-cache',
                networkTimeoutSeconds: 5,
                precacheFallback: {
                  fallbackURL: '/offline.html',
                },
              },
            },
            // Static assets and images: CacheFirst, max 100 entries, 30 days
            {
              urlPattern: ({ request, url }) => {
                if (
                  url.hostname === 'firestore.googleapis.com' ||
                  url.hostname === 'identitytoolkit.googleapis.com' ||
                  url.hostname === 'securetoken.googleapis.com' ||
                  url.hostname === 'firebasestorage.googleapis.com'
                ) {
                  return false;
                }
                return (
                  request.destination === 'image' ||
                  request.destination === 'style' ||
                  request.destination === 'script' ||
                  request.destination === 'font' ||
                  /\.(?:png|jpg|jpeg|svg|gif|webp|avif|ico|woff2?|css|js)$/i.test(
                    url.pathname
                  )
                );
              },
              handler: 'CacheFirst',
              options: {
                cacheName: 'static-assets-and-images',
                expiration: {
                  maxEntries: 100,
                  maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
          ],
        },
        devOptions: {
          enabled: process.env.DISABLE_HMR !== 'true',
          type: 'module',
        },
      }),
      // Copies src/assets into dist/ so root-relative URLs like
      // "/src/assets/images/..." (e.g. generate_image output) still resolve
      // in production builds. Do not remove.
      {
        name: 'copy-unbundled-src-assets',
        apply: 'build',
        closeBundle(error?: Error): void {
          if (error) {
            return;
          }
          const distDir = path.resolve(rootDir, 'dist');
          const srcAssets = path.resolve(rootDir, 'src/assets');
          const distAssets = path.resolve(distDir, 'src/assets');
          if (fs.existsSync(distDir) && fs.existsSync(srcAssets)) {
            fs.cpSync(srcAssets, distAssets, { recursive: true, force: true });
          }
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(rootDir, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
