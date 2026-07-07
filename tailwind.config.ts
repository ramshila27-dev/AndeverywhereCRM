import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        sans: ["var(--font-body)", "system-ui", "sans-serif"],
      },
      colors: {
        // Warm paper background - replaces cold slate-50, fits a travel brand
        // better than a clinical SaaS gray.
        paper: {
          50: "#faf8f4",
          100: "#f3efe6",
          200: "#e8e1d1",
        },
        // Andeverywhere navy blue (primary) — drives buttons, links, headings.
        brand: {
          50: "#eef1fa",
          100: "#d7ddf3",
          200: "#b0bde6",
          300: "#8194d5",
          400: "#5670c1",
          500: "#3a54ab",
          600: "#2b3f89",
          700: "#20306b",
          800: "#1b2857",
          900: "#172147",
        },
        // Andeverywhere red (accent) — logo mark, highlights, CTAs.
        accent: {
          50: "#fdecec",
          100: "#fbd2d2",
          200: "#f6a6a6",
          300: "#f07575",
          400: "#e94a4a",
          500: "#e11d2a",
          600: "#c2141f",
          700: "#9d121b",
          800: "#7f141a",
          900: "#6b151a",
        },
      },
    },
  },
  plugins: [],
};

export default config;
