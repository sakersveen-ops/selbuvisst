/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,ts,jsx,tsx}', './components/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Georgia', 'serif'],
      },
      colors: {
        felt: '#1a472a',
        felt2: '#15391f',
        gold: '#c9a84c',
        gold2: '#e8c96a',
        card: '#f5f0e8',
      }
    }
  },
  plugins: [],
}
