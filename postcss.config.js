import tailwindcss from '@tailwindcss/postcss';
import autoprefixer from 'autoprefixer';

export default {
  plugins: [
    tailwindcss, // Используем новый плагин для Tailwind CSS
    autoprefixer, // Плагин для автопрефиксов
  ],
};
