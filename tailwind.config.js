/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        mono: ['Consolas', 'Monaco', 'Courier New', 'monospace'],
      },
    },
  },
  plugins: [],
};
