/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        ai: {
          bg: "#1F2439",
          panel: "#252B44",
          gold: "#F2B41B",
          text: "#E9ECF4",
          muted: "#AEB4C7",
        },
      },
    },
  },
  plugins: [],
};
