import type { Config } from "tailwindcss";

export default {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        warm: {
          50: 'rgb(var(--studio-background) / <alpha-value>)',
          100: 'rgb(var(--studio-surface) / <alpha-value>)',
          200: 'rgb(var(--studio-border) / <alpha-value>)',
          300: 'rgb(var(--studio-line) / <alpha-value>)',
          400: 'rgb(var(--studio-highlight) / <alpha-value>)',
          500: 'rgb(var(--studio-accent) / <alpha-value>)',
          600: 'rgb(var(--studio-muted) / <alpha-value>)',
          700: 'rgb(var(--studio-body) / <alpha-value>)',
          800: 'rgb(var(--studio-deep) / <alpha-value>)',
          900: 'rgb(var(--studio-primary) / <alpha-value>)',
        },
        primary: {
          DEFAULT: 'rgb(var(--studio-primary) / <alpha-value>)',
          hover: 'rgb(var(--studio-hover) / <alpha-value>)',
        },
        accent: {
          DEFAULT: 'rgb(var(--studio-accent) / <alpha-value>)',
          light: 'rgb(var(--studio-surface) / <alpha-value>)',
          dark: 'rgb(var(--studio-muted) / <alpha-value>)',
        }
      },
      fontFamily: {
        serif: ['Pretendard', 'Noto Serif KR', 'serif'],
        sans: ['Pretendard', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config;
