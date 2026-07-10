/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        sidebar: {
          DEFAULT: '#0B1830',
          hover: '#152847',
          active: '#F5730B',
        },
        brand: {
          orange: '#F5730B',
          navy: '#0B1830',
        },
      },
    },
  },
  plugins: [],
};
