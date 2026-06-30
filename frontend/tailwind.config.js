/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        elyndor: {
          obsidian: "#06070a",
          dark: "#0b0c10",
          ash: "#1f2129",
          border: "#b89047", // Ancient gold
          gold: "#e2b653",
          blood: "#8c1d1d",
          sapphire: "#2b569a",
          poison: "#1d5c2e"
        }
      },
      fontFamily: {
        cinzel: ["Cinzel", "serif"],
        outfit: ["Outfit", "sans-serif"]
      },
      boxShadow: {
        'premium': '0 0 15px rgba(226, 182, 83, 0.15)',
        'blood-glow': '0 0 15px rgba(140, 29, 29, 0.4)',
        'sapphire-glow': '0 0 15px rgba(43, 86, 154, 0.4)'
      }
    },
  },
  plugins: [],
}
