/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        card: 'var(--card)',
        ink: 'var(--ink)',
        mut: 'var(--mut)',
        line: 'var(--line)',
        acc: 'var(--acc)',
        onacc: 'var(--onacc)',
        accbg: 'var(--accbg)',
        ok: 'var(--ok)',
        okbg: 'var(--okbg)',
        bad: 'var(--bad)',
        badbg: 'var(--badbg)',
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'system-ui', '-apple-system', '"Segoe UI"', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
