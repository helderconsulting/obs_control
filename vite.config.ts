import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

const config = defineConfig({
  plugins: [tailwindcss(), sveltekit()],
  server: {
    proxy: {
      '/obs': 'http://127.0.0.1:3000',
      '/recording': 'http://127.0.0.1:3000',
      '/health': 'http://127.0.0.1:3000',
      '/ws': {
        target: 'ws://127.0.0.1:3000',
        ws: true,
      },
    },
  },
});

export default config;
