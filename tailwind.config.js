/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef4ff",
          100: "#dce8ff",
          200: "#b9d1ff",
          300: "#8fb4ff",
          400: "#5f8eff",
          500: "#3866f5",
          600: "#274bd1",
          700: "#1f3aa8",
          800: "#1c317f",
          900: "#1a2c5e",
        },
      },
    },
  },
  plugins: [],
};
