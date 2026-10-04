import { build } from 'esbuild';
import { mkdir } from 'node:fs/promises';
await mkdir('.sites-runtime/tests', { recursive: true });
await build({ entryPoints: ['tests/meta-connection.test.mjs'], bundle: true, platform: 'node', format: 'esm', outfile: '.sites-runtime/tests/meta-connection.test.mjs' });
await import('../.sites-runtime/tests/meta-connection.test.mjs');
