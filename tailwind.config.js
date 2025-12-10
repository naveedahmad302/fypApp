// tailwind.config.js
module.exports = {
  content: [
    "./App.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      fontFamily: {
        'radio-canada': ['"Radio Canada"', 'sans-serif'],
        'radio-canada-light': ['"Radio Canada"', 'sans-serif'],
        'radio-canada-regular': ['"Radio Canada"', 'sans-serif'],
        'radio-canada-medium': ['"Radio Canada"', 'sans-serif'],
        'radio-canada-semibold': ['"Radio Canada"', 'sans-serif'],
        'radio-canada-bold': ['"Radio Canada"', 'sans-serif'],
      },
    },
  },
  plugins: [],
};