import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages serves this project under /<repo>/, so the production build needs
// that base path. Local dev stays at '/'.
export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === 'build' ? '/ariel-Pok-mon-merge/' : '/',
  server: {
    host: true,
    port: 5173,
  },
}));
