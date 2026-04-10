import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node20',
  outDir: 'dist',
  // @dice-game/core는 .ts 소스만 있으므로 번들에 포함
  noExternal: ['@dice-game/core'],
  clean: true,
  sourcemap: false,
})
