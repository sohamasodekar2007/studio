
// tailwind.config.js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
   presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // Replicate theme colors from globals.css (adjust as needed for native)
        background: 'hsl(220 20% 96%)', // Lighter Cool Gray
        foreground: 'hsl(220 10% 25%)', // Dark Cool Gray
        card: 'hsl(220 20% 100%)', // White
        'card-foreground': 'hsl(220 10% 25%)',
        popover: 'hsl(220 20% 100%)',
        'popover-foreground': 'hsl(220 10% 25%)',
        primary: {
          DEFAULT: 'hsl(240 60% 55%)', // Primary Blue
          foreground: 'hsl(0 0% 100%)', // White
        },
        secondary: {
          DEFAULT: 'hsl(220 15% 92%)', // Light Gray
          foreground: 'hsl(220 10% 30%)',
        },
        muted: {
          DEFAULT: 'hsl(220 15% 92%)',
          foreground: 'hsl(220 10% 45%)',
        },
        accent: {
          DEFAULT: 'hsl(260 65% 60%)', // Accent Purple
          foreground: 'hsl(0 0% 100%)', // White
        },
        destructive: {
          DEFAULT: 'hsl(0 75% 55%)', // Red
          foreground: 'hsl(0 0% 100%)',
        },
        border: 'hsl(220 15% 88%)', // Slightly darker border
        input: 'hsl(220 15% 94%)', // Input background
        ring: 'hsl(240 60% 55%)', // Ring color matches primary
        // Add dark mode colors if needed, matching globals.css dark theme
      },
      borderRadius: {
        lg: '0.5rem', // Corresponds to var(--radius)
        md: 'calc(0.5rem - 2px)',
        sm: 'calc(0.5rem - 4px)',
      }
    },
  },
  plugins: [],
}
