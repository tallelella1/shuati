const esbuild = require('esbuild');

esbuild.build({
  entryPoints: ['src/main.cjs'],
  bundle: true,
  external: ['obsidian'],
  format: 'cjs',
  platform: 'browser',
  target: 'es2020',
  outfile: 'main.js',
  banner: { js: '// Built from src/main.cjs by npm run build.' },
}).catch(() => process.exitCode = 1);
