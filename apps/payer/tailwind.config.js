/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: '#1B3A6B', light: '#2E75B6', dark: '#0F2040' },
        accent:  { DEFAULT: '#2E75B6', light: '#5B9BD5' },
      },
    },
  },
  plugins: [],
};
