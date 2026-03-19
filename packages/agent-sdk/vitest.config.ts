import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    name: 'agent-sdk',
    include: ['src/**/*.test.ts'],
  },
})
