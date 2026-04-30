export default {
  content: [
    "./docs/*.html"
  ],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: ["IBM Plex Sans", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "Monaco", "Menlo", "monospace"]
      },
      colors: {
        "trust-blue": "#2563EB",
        "trust-blue-dark": "#1E40AF",
        "cta-orange": "#F97316",
        "cta-orange-dark": "#EA580C"
      }
    }
  }
};
