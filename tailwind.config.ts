import type {Config} from 'tailwindcss';

export default {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        body: ['var(--font-inter)', 'sans-serif'],
        headline: ['var(--font-space-grotesk)', 'sans-serif'],
      },
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        chart: {
          '1': 'hsl(var(--chart-1))',
          '2': 'hsl(var(--chart-2))',
          '3': 'hsl(var(--chart-3))',
          '4': 'hsl(var(--chart-4))',
          '5': 'hsl(var(--chart-5))',
        },
        sidebar: {
          DEFAULT: 'hsl(var(--sidebar-background))',
          foreground: 'hsl(var(--sidebar-foreground))',
          primary: 'hsl(var(--sidebar-primary))',
          'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
          accent: 'hsl(var(--sidebar-accent))',
          'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
          border: 'hsl(var(--sidebar-border))',
          ring: 'hsl(var(--sidebar-ring))',
        },
        mana: 'hsl(var(--mana))',
        hp: 'hsl(var(--hp))',
        buff: 'hsl(var(--buff))',
        debuff: 'hsl(var(--debuff))',
        'attack-ready': 'hsl(var(--attack-ready))',
        biome: {
          forest: 'hsl(var(--biome-forest))',
          desert: 'hsl(var(--biome-desert))',
          ice: 'hsl(var(--biome-ice))',
          volcano: 'hsl(var(--biome-volcano))',
          sanctuary: 'hsl(var(--biome-sanctuary))',
        }
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      keyframes: {
        'accordion-down': {
          from: {
            height: '0',
          },
          to: {
            height: 'var(--radix-accordion-content-height)',
          },
        },
        'accordion-up': {
          from: {
            height: 'var(--radix-accordion-content-height)',
          },
          to: {
            height: '0',
          },
        },
        'boing': {
            '0%': { transform: 'scale(0.5)', opacity: '0' },
            '75%': { transform: 'scale(1.1)', opacity: '1' },
            '100%': { transform: 'scale(1)', opacity: '1' },
        },
        'shake': {
            '10%, 90%': { transform: 'translate3d(-1px, 0, 0)' },
            '20%, 80%': { transform: 'translate3d(2px, 0, 0)' },
            '30%, 50%, 70%': { transform: 'translate3d(-4px, 0, 0)' },
            '40%, 60%': { transform: 'translate3d(4px, 0, 0)' },
        },
        'flash': {
            '0%, 100%': { opacity: '1' },
            '50%': { opacity: '0.5' },
        },
        'fade-in': {
            'from': { opacity: '0', transform: 'scale(0.9)' },
            'to': { opacity: '1', transform: 'scale(1)' },
        },
        'fade-out-shake': {
            '0%': { transform: 'translate3d(0, 0, 0) scale(1)', opacity: '1' },
            '20%': { transform: 'translate3d(-10px, 0, 0) scale(1)', opacity: '1' },
            '40%': { transform: 'translate3d(10px, 0, 0) scale(1)', opacity: '1' },
            '60%': { transform: 'translate3d(-10px, 0, 0) scale(1)', opacity: '1' },
            '80%': { transform: 'translate3d(10px, 0, 0) scale(0.9)', opacity: '1' },
            '100%': { transform: 'translate3d(0, 0, 0) scale(0.5)', opacity: '0' },
        },
        'drop-in': {
            'from': { transform: 'translateY(-40px) scale(1.1)', opacity: '0' },
            'to': { transform: 'translateY(0) scale(1)', opacity: '1' },
        },
        'shake-quick': {
            '0%, 100%': { transform: 'translateX(0)' },
            '20%, 60%': { transform: 'translateX(-3px)' },
            '40%, 80%': { transform: 'translateX(3px)' },
        },
        'flash-out': {
            '0%': { transform: 'scale(1)', opacity: '1' },
            '25%': { transform: 'scale(1.05)', opacity: '0.5' },
            '50%': { transform: 'scale(1.1)', opacity: '1', filter: 'brightness(2)' },
            '100%': { transform: 'scale(0.5)', opacity: '0', filter: 'brightness(1)' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'boing': 'boing 0.5s ease-out',
        'shake': 'shake 0.82s cubic-bezier(.36,.07,.19,.97) both',
        'flash': 'flash 0.5s ease-in-out',
        'fade-in': 'fade-in 0.3s ease-out',
        'fade-out-shake': 'fade-out-shake 0.5s ease-in-out forwards',
        'drop-in': 'drop-in 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards',
        'shake-quick': 'shake-quick 0.5s cubic-bezier(.36,.07,.19,.97) both',
        'flash-out': 'flash-out 1s ease-out forwards',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
} satisfies Config;
