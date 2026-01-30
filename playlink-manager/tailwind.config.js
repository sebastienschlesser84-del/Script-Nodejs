/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        broadcast: {
          dark: '#0f1115',
          panel: '#161920',
        }
      }
    },
  },
  plugins: [],
}