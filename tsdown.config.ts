import { defineConfig } from 'tsdown'

export default defineConfig([
  {
    entry: ['src/*.ts'],
    platform: 'neutral',
    dts: {
      tsconfig: 'tsconfig.lib.json',
    },
  },
])
