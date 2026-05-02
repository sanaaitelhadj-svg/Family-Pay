/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: '#1B3A6B', light: '#2E75B6' },
        accent:  { DEFAULT: '#10b981', light: '#34d399' },
      },
    },
  },
  plugins: [],
};
