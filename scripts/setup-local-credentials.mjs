import { randomBytes } from 'node:crypto';
import { open, readFile, chmod } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const path = fileURLToPath(new URL('../.dev.vars', import.meta.url));
let existing = '';
try { existing = await readFile(path, 'utf8'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
if (/^\s*CREDENTIALS_ENCRYPTION_KEY\s*=/m.test(existing)) {
  await chmod(path, 0o600);
  console.log('Existing encryption key retained; local secret file permissions restricted.');
} else {
  const file = await open(path, 'a', 0o600);
  try {
    await file.chmod(0o600);
    await file.write(`${existing && !existing.endsWith('\n') ? '\n' : ''}CREDENTIALS_ENCRYPTION_KEY=${randomBytes(32).toString('base64')}\n`);
  } finally { await file.close(); }
  console.log('Local encryption key configured. Restart the dev server to load it.');
}
