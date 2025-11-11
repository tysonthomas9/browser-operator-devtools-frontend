import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'agent/index': 'src/agent/index.ts',
    'graph/index': 'src/graph/index.ts',
    'state/index': 'src/state/index.ts',
    'hooks/index': 'src/hooks/index.ts',
    'events/index': 'src/events/index.ts',
    'types/index': 'src/types/index.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  treeshake: true,
  minify: false,
  external: ['ai', '@ai-sdk/provider-utils'],
});
