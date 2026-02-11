import esbuild from 'esbuild';
import path from 'node:path';

const shared = {
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['electron'],
  target: 'node20',
};

await esbuild.build({
  ...shared,
  entryPoints: ['src/main.ts'],
  outfile: 'dist/main.cjs',
});

await esbuild.build({
  ...shared,
  entryPoints: ['src/preload.ts'],
  outfile: 'dist/preload.cjs',
});
