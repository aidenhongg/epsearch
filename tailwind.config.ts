/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "app/**/*.{ts,tsx}",
    "components/**/*.{ts,tsx}",
    "./node_modules/streamdown/dist/*.js",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
