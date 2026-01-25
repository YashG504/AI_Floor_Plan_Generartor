/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#6b46c1', // Purple-ish
        secondary: '#1e293b', // Slate-900 like
        dark: '#0f172a', // Slate-950 like
      }
    },
  },
  plugins: [],
}
