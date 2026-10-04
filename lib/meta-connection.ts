import { z } from 'zod';
import type { MetaSecrets } from './meta-credentials';

export const DEFAULT_META_VERSION = 'v26.0';
export const saveSchema = z.object({
  action: z.literal('save'),
  revision: z.string().max(80).nullable(),
  appId: z.string().trim().regex(/^\d{5,30}$/),
  accountId: z.string().trim().regex(/^(act_)?\d{5,30}$/).transform(v => v.startsWith('act_') ? v : `act_${v}`),
  apiVersion: z.string().regex(/^v\d{2,3}\.0$/),
  accessToken: z.string().trim().max(8192).regex(/^[A-Za-z0-9._|~-]*$/).default(''),
  appSecret: z.string().trim().regex(/^(?:[a-fA-F0-9]{32})?$/).default(''),
  removeAppSecret: z.boolean().default(false),
}).strict();
export type SavedConnection = {
  appId: string; accountId: string; apiVersion: string; hasToken: boolean; hasAppSecret: boolean;
  revision: string; updatedAt: string; testedAt: string | null; test: ConnectionTest | null;
};
export type SettingsState = { encryptionReady: boolean; connection: SavedConnection | null };
export type ConnectionTest = { ok: boolean; message: string; accountName?: string; currency?: string; timezone?: string; hasRecentRows?: boolean };
export function sameOrigin(request: Request): boolean {
  return request.headers.get('origin') === new URL(request.url).origin && request.headers.get('sec-fetch-site') !== 'cross-site';
}

class MetaTestError extends Error {}
function metaError(code: unknown): string {
  if (code === 190) return 'Meta rejected the token. It may have expired or been revoked. Generate a replacement and save it here.';
  if ([10, 200, 294].includes(Number(code))) return 'Meta denied reporting access. Check ads_read and the token owner’s access to this ad account.';
  if ([4, 17, 32, 613, 80004].includes(Number(code))) return 'Meta is limiting requests. Wait a few minutes before testing again.';
  if (code === 100) return 'Meta could not read this resource. Check the ad account ID, API version, token permissions and app secret.';
  return 'Meta did not accept the request. Check the token, ad account access and app settings, then retry.';
}
export async function testMetaConnection(config: { accountId: string; apiVersion: string }, secrets: MetaSecrets, transport: typeof fetch = fetch): Promise<ConnectionTest> {
  // Keep paths constrained even if a stored database record was modified.
  if (!/^act_\d{5,30}$/.test(config.accountId) || !/^v\d{2,3}\.0$/.test(config.apiVersion)) return { ok: false, message: 'Check the saved account ID and API version.' };
  try {
    let proof = '';
    if (secrets.appSecret) {
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey('raw', encoder.encode(secrets.appSecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
      proof = Array.from(new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(secrets.accessToken))), b => b.toString(16).padStart(2, '0')).join('');
    }
    async function read(path: string, params: Record<string, string>) {
      const url = new URL(`https://graph.facebook.com/${config.apiVersion}/${config.accountId}${path}`);
      for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
      if (proof) url.searchParams.set('appsecret_proof', proof);
      const response = await transport(url, { method: 'GET', headers: { Authorization: `Bearer ${secrets.accessToken}`, Accept: 'application/json' }, redirect: 'error', signal: AbortSignal.timeout(15000) });
      const body = await response.json() as Record<string, unknown>;
      if (!response.ok || body.error) throw new MetaTestError(metaError((body.error as { code?: number } | undefined)?.code));
      return body;
    }
    const account = await read('', { fields: 'id,name,currency,timezone_name' });
    if (account.id !== config.accountId) throw new MetaTestError('Meta returned a different account. Check the saved account ID.');
    const insights = await read('/insights', { fields: 'account_id,date_start,date_stop,spend,impressions,clicks', level: 'account', date_preset: 'last_7d', limit: '1' });
    if (!Array.isArray(insights.data)) throw new MetaTestError('Meta returned an unexpected reporting response. Please retry.');
    const safeText = (value: unknown) => typeof value === 'string' ? value.slice(0, 200) : undefined;
    return { ok: true, message: insights.data.length ? 'Account and Insights access verified. Recent reporting rows are available.' : 'Account and Insights access verified. Meta returned no reporting rows for the last 7 days.', accountName: safeText(account.name), currency: safeText(account.currency), timezone: safeText(account.timezone_name), hasRecentRows: insights.data.length > 0 };
  } catch (error) {
    // Never return or log raw provider errors, URLs or tokens.
    return { ok: false, message: error instanceof MetaTestError ? error.message : 'The connection test could not finish. Check your internet connection and try again.' };
  }
}
