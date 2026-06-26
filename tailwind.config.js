/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-jakarta)", "Plus Jakarta Sans", "system-ui", "sans-serif"],
      },
      colors: {
        // InsightHub design system — primary scale built around #1B4DFF
        brand: {
          50: "#EEF1FF",
          100: "#DCE4FF",
          200: "#B9CCFF",
          300: "#8FAEFF",
          400: "#5B7FFF",
          500: "#1B4DFF",
          600: "#1640DB",
          700: "#1234B0",
          800: "#102C8C",
          900: "#0E266E",
        },
        ink: "#0B0B0F",
        success: {
          50: "#E6F8F0",
          500: "#21C17A",
          600: "#15A06A",
        },
        danger: {
          50: "#FFEBED",
          500: "#F0142F",
          600: "#D40E27",
        },
        warning: {
          50: "#FFF6E6",
          500: "#F5A524",
          600: "#DB8F12",
        },
        info: {
          50: "#E7EDFB",
          500: "#28C5FF",
        },
      },
      borderRadius: {
        sm: "8px",
        md: "14px",
        lg: "18px",
        xl: "22px",
        "2xl": "26px",
      },
      boxShadow: {
        card: "0 1px 2px rgba(20,28,60,0.06)",
        raised: "0 12px 28px -16px rgba(20,28,60,0.25)",
        popover: "0 24px 48px -20px rgba(20,28,60,0.40)",
        primary: "0 12px 26px -12px rgba(27,77,255,0.55)",
      },
    },
  },
  plugins: [],
};
