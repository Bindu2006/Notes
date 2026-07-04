/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        darkBg: "#0F172A",
        darkCard: "#1E293B",
        accentBlue: "#3B82F6",
        accentPurple: "#8B5CF6",
      },
    },
  },
  plugins: [],
}
