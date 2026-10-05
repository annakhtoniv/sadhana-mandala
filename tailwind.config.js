/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        org: {
          primary: 'var(--org-primary, #4f46e5)',
          accent: 'var(--org-accent, #06b6d4)',
        }
      }
    },
  },
  plugins: [],
}
