/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: '#1B3A6B', light: '#2E75B6' },
        accent:  { DEFAULT: '#8b5cf6', light: '#a78bfa' },
      },
    },
  },
  plugins: [],
};
