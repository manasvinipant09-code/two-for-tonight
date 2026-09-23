import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#131218",        // near-black charcoal background
        marquee: "#E8B84C",    // warm marquee-gold accent
        velvet: "#E23F49",     // reserved for the match moment
        paper: "#F4F1E9",      // warm off-white text/surfaces
        dusk: "#211F29",       // card surface, one step up from ink
        dusk2: "#2B2836",      // subtle layering above dusk
        mist: "#8A8797",       // secondary text
      },
      fontFamily: {
        display: ["var(--font-display)", "serif"],
        body: ["var(--font-body)", "sans-serif"],
      },
      boxShadow: {
        card: "0 20px 60px -15px rgba(0,0,0,0.6)",
      },
      keyframes: {
        "match-in": {
          "0%": { opacity: "0", transform: "scale(0.85)" },
          "60%": { opacity: "1", transform: "scale(1.03)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "0% 50%" },
          "100%": { backgroundPosition: "200% 50%" },
        },
      },
      animation: {
        "match-in": "match-in 0.6s cubic-bezier(0.16,1,0.3,1) forwards",
        shimmer: "shimmer 3s linear infinite",
      },
    },
  },
  plugins: [],
};
export default config;
