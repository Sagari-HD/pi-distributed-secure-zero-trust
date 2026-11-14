import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Configuração dos testes (npm test): ambiente de navegador simulado (jsdom).
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/testes/setup.js'],
    testTimeout: 20000,
  },
})
