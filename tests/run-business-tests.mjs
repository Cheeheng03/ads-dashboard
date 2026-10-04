import {build} from 'esbuild';
import {mkdir} from 'node:fs/promises';
await mkdir('.sites-runtime/tests',{recursive:true});
await build({entryPoints:['tests/business.test.mjs'],bundle:true,platform:'node',format:'esm',outfile:'.sites-runtime/tests/business.test.mjs'});
await import('../.sites-runtime/tests/business.test.mjs');
