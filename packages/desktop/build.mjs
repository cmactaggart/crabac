import esbuild from 'esbuild';

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
  outfile: 'dist/main.js',
});

await esbuild.build({
  ...shared,
  entryPoints: ['src/preload.ts'],
  outfile: 'dist/preload.js',
});
