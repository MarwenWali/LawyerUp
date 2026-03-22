/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        display: ['"Playfair Display"', 'Georgia', 'serif'],
      },
      colors: {
        primary: '#14213D',
        accent: '#D4A03C',
        success: '#16A34A',
        warning: '#F59E0B',
        danger: '#DC2626',
        navy: {
          50: 'rgba(20,33,61,0.05)',
          100: 'rgba(20,33,61,0.10)',
          200: 'rgba(20,33,61,0.20)',
        },
        gold: {
          50: 'rgba(212,160,60,0.08)',
          100: 'rgba(212,160,60,0.15)',
          200: 'rgba(212,160,60,0.25)',
        },
      },
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
        'card-hover': '0 4px 12px rgba(0,0,0,0.10)',
        modal: '0 20px 60px rgba(0,0,0,0.15)',
      },
    },
  },
  plugins: [],
};
