import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'service-worker.ts',
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json}'],
      },
      devOptions: {
        enabled: false, // Disable in dev to avoid confusion
      },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        // Generate content-hashed filenames for JavaScript entry files
        // Example: main.js -> main.abc123def.js
        entryFileNames: 'assets/[name].[hash].js',

        // Generate content-hashed filenames for JavaScript chunks
        // Example: vendor.js -> vendor.xyz789ghi.js
        chunkFileNames: 'assets/[name].[hash].js',

        // Generate content-hashed filenames for CSS and other assets
        // Example: style.css -> style.def456abc.css
        // Example: logo.png -> logo.ghi789xyz.png
        assetFileNames: 'assets/[name].[hash].[ext]',
      },
    },
  },
})
