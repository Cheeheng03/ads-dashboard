import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { database } from '@/db/raw';
import { encryptionKey, seal, unseal } from '@/lib/meta-credentials';
import { sameOrigin, saveSchema, testMetaConnection, type ConnectionTest } from '@/lib/meta-connection';
import { z } from 'zod';

export const dynamic = 'force-dynamic';
type Row = { owner: string; app_id: string; account_id: string; api_version: string; encrypted_credentials: string; has_app_secret: number; revision: string; updated_at: string; tested_at: string | null; test_result: string | null };
const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });
const find = (owner: string) => database().prepare('SELECT * FROM meta_connections WHERE owner=?').bind(owner).first<Row>();
const context = (row: Pick<Row, 'owner' | 'app_id' | 'account_id'>) => JSON.stringify([row.owner, row.app_id, row.account_id]);
function publicConnection(row: Row | null) {
  return row ? { appId: row.app_id, accountId: row.account_id, apiVersion: row.api_version, hasToken: true, hasAppSecret: Boolean(row.has_app_secret), revision: row.revision, updatedAt: row.updated_at, testedAt: row.tested_at, test: row.test_result ? JSON.parse(row.test_result) as ConnectionTest : null } : null;
}
export async function GET() {
  try {
    const user = await getChatGPTUser();
    if (!user) return reply({ error: 'Sign in to open connection settings.' }, 401);
    let encryptionReady = false;
    try { await encryptionKey(env.CREDENTIALS_ENCRYPTION_KEY); encryptionReady = true; } catch { /* fail closed */ }
    return reply({ encryptionReady, connection: publicConnection(await find(user.userId)) });
  } catch { return reply({ error: 'Connection settings could not be loaded.' }, 503); }
}
const actionSchema = z.object({ action: z.enum(['test', 'delete']), revision: z.string().min(1).max(80) }).strict();
async function limitedBody(request: Request): Promise<string> {
  if (Number(request.headers.get('content-length')) > 16384) throw new Error('size');
  const reader = request.body?.getReader();
  if (!reader) return '';
  const chunks: Uint8Array[] = []; let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 16384) { await reader.cancel(); throw new Error('size'); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return new TextDecoder().decode(bytes);
}
export async function POST(request: Request) {
  try {
    const user = await getChatGPTUser();
    if (!user) return reply({ error: 'Sign in to manage this connection.' }, 401);
    if (!sameOrigin(request)) return reply({ error: 'This request must come from the settings page.' }, 403);
    if (request.headers.get('content-type')?.split(';')[0] !== 'application/json') return reply({ error: 'Expected a JSON request.' }, 415);
    let raw: unknown;
    try { raw = JSON.parse(await limitedBody(request)); } catch { return reply({ error: 'The request is invalid or too large.' }, 400); }
    const parsed = z.union([saveSchema, actionSchema]).safeParse(raw);
    if (!parsed.success) return reply({ error: 'Check the numeric App ID and ad account ID, API version, token and 32-character app secret.' }, 400);
    const input = parsed.data, owner = user.userId, row = await find(owner), db = database();
    if (input.revision !== (row?.revision ?? null)) return reply({ error: 'Settings changed in another tab. Reload before trying again.' }, 409);

    if (input.action === 'delete') {
      // Local removal only; this does not revoke the token at Meta.
      const removed = await db.prepare('DELETE FROM meta_connections WHERE owner=? AND revision=?').bind(owner, input.revision).run();
      if (!removed.meta.changes) return reply({ error: 'Settings changed in another tab. Reload before trying again.' }, 409);
      return reply({ ok: true, connection: null });
    }
    let key: CryptoKey;
    try { key = await encryptionKey(env.CREDENTIALS_ENCRYPTION_KEY); }
    catch { return reply({ error: 'Server encryption is not configured. Credentials have not been saved or sent.' }, 503); }
    if (input.action === 'save') {
      const appChanged = row && row.app_id !== input.appId;
      if ((!row || appChanged || row.account_id !== input.accountId) && !input.accessToken) return reply({ error: 'Enter an access token for this app and ad account.' }, 400);
      let previous = { accessToken: '', appSecret: '' };
      if (row && !appChanged && (!input.accessToken || (!input.appSecret && !input.removeAppSecret))) {
        try { previous = await unseal(key, context(row), row.encrypted_credentials); }
        catch { return reply({ error: 'Saved credentials cannot be opened. Remove the saved connection and enter credentials again.' }, 409); }
      }
      const secrets = { accessToken: input.accessToken || previous.accessToken, appSecret: input.removeAppSecret ? '' : input.appSecret || previous.appSecret };
      const ciphertext = await seal(key, context({ owner, app_id: input.appId, account_id: input.accountId }), secrets);
      const revision = crypto.randomUUID(), now = new Date().toISOString();
      const saved = row
        ? await db.prepare('UPDATE meta_connections SET app_id=?,account_id=?,api_version=?,encrypted_credentials=?,has_app_secret=?,revision=?,updated_at=?,tested_at=NULL,test_result=NULL WHERE owner=? AND revision=?').bind(input.appId, input.accountId, input.apiVersion, ciphertext, Number(Boolean(secrets.appSecret)), revision, now, owner, input.revision).run()
        : await db.prepare('INSERT OR IGNORE INTO meta_connections (owner,app_id,account_id,api_version,encrypted_credentials,has_app_secret,revision,updated_at) VALUES (?,?,?,?,?,?,?,?)').bind(owner, input.appId, input.accountId, input.apiVersion, ciphertext, Number(Boolean(secrets.appSecret)), revision, now).run();
      if (!saved.meta.changes) return reply({ error: 'Settings changed in another tab. Reload before trying again.' }, 409);
      return reply({ ok: true, connection: publicConnection(await find(owner)) });
    }
    if (!row) return reply({ error: 'Save your credentials first.' }, 400);
    if (row.tested_at && Date.now() - Date.parse(row.tested_at) < 30000) return reply({ error: 'Wait 30 seconds between connection tests.' }, 429);
    let secrets;
    try { secrets = await unseal(key, context(row), row.encrypted_credentials); }
    catch { return reply({ error: 'Saved credentials cannot be opened. Remove the saved connection and enter credentials again.' }, 409); }
    const now = new Date().toISOString();
    // Claim this test atomically so concurrent clicks do not trigger repeated Meta calls.
    const claimed = await db.prepare('UPDATE meta_connections SET tested_at=?,test_result=NULL WHERE owner=? AND revision=? AND (tested_at IS NULL OR tested_at<?)').bind(now, owner, row.revision, new Date(Date.now() - 30000).toISOString()).run();
    if (!claimed.meta.changes) return reply({ error: 'Another test is running, or settings changed. Wait 30 seconds and reload.' }, 409);
    const result = await testMetaConnection({ accountId: row.account_id, apiVersion: row.api_version }, secrets);
    const finished = await db.prepare('UPDATE meta_connections SET test_result=? WHERE owner=? AND revision=? AND tested_at=?').bind(JSON.stringify(result), owner, row.revision, now).run();
    if (!finished.meta.changes) return reply({ error: 'Settings changed during the test. Reload and test the current connection.' }, 409);
    return reply({ ok: true, connection: publicConnection(await find(owner)) });
  } catch { return reply({ error: 'The settings operation could not finish. Please retry.' }, 503); }
}
