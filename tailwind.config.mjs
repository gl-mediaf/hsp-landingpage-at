/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        'hsp-lime':      '#97BF0D',
        'hsp-lime-dark': '#7da00b',
        'hsp-red':       '#E30613',
        'hsp-dark':      '#0f0f0f',
        'hsp-gray':      '#5a5a5a',
        'hsp-light':     '#f7f7f3',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      keyframes: {
        fadeUp: {
          '0%':   { opacity: '0', transform: 'translateY(28px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%':      { transform: 'translateY(-10px)' },
        },
        slideRight: {
          '0%':   { opacity: '0', transform: 'translateX(-20px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
      },
      animation: {
        'fade-up':    'fadeUp 0.7s ease forwards',
        'float':      'float 5s ease-in-out infinite',
        'slide-right':'slideRight 0.6s ease forwards',
      },
    },
  },
  plugins: [],
};
