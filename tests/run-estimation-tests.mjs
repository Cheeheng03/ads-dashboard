import {build} from 'esbuild';
import {mkdir} from 'node:fs/promises';
await mkdir('.sites-runtime/tests',{recursive:true});
await build({entryPoints:['tests/estimation.test.mjs'],bundle:true,platform:'node',format:'esm',outfile:'.sites-runtime/tests/estimation.test.mjs'});
await import('../.sites-runtime/tests/estimation.test.mjs');
