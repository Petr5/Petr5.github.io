import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';  // Обязательно добавь этот импорт!

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
})
