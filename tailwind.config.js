/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        panel: '#1f2430',
        panel2: '#262b38',
        ink: '#e6e8ee',
        muted: '#8a92a6',
        accent: '#4f8cff',
      },
    },
  },
  plugins: [],
};
