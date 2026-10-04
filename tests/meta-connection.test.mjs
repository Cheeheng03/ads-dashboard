import assert from 'node:assert/strict';
import { randomBytes, createHmac } from 'node:crypto';
import { encryptionKey, seal, unseal } from '../lib/meta-credentials.ts';
import { sameOrigin, saveSchema, testMetaConnection } from '../lib/meta-connection.ts';

const key = await encryptionKey(randomBytes(32).toString('base64'));
const secret = { accessToken: 'TEST_TOKEN_DO_NOT_USE', appSecret: 'a'.repeat(32) };
const context = JSON.stringify(['owner-a', '123456', 'act_123456']);
const sealed = await seal(key, context, secret);
assert.ok(!sealed.includes(secret.accessToken) && !sealed.includes(secret.appSecret));
assert.deepEqual(await unseal(key, context, sealed), secret);
assert.notEqual(sealed, await seal(key, context, secret), 'fresh nonce for every encryption');
await assert.rejects(() => unseal(key, 'other-owner', sealed));
await assert.rejects(() => unseal(key, JSON.stringify(['owner-a', '123456', 'act_654321']), sealed));
const pieces = sealed.split('.'); const bytes = Buffer.from(pieces[2], 'base64'); bytes[0] ^= 1; pieces[2] = bytes.toString('base64');
await assert.rejects(() => unseal(key, context, pieces.join('.')));
const otherKey = await encryptionKey(randomBytes(32).toString('base64'));
await assert.rejects(() => unseal(otherKey, context, sealed));
await assert.rejects(() => encryptionKey(undefined));
await assert.rejects(() => encryptionKey('invalid'));

const settings = { action: 'save', revision: null, appId: '123456', accountId: '123456', apiVersion: 'v26.0', accessToken: secret.accessToken, appSecret: secret.appSecret };
assert.equal(saveSchema.parse(settings).accountId, 'act_123456');
for (const patch of [{ accountId: '../me' }, { apiVersion: '../debug' }, { accessToken: 'token\r\nheader' }, { appSecret: 'wrong' }, { url: 'https://example.com' }]) assert.equal(saveSchema.safeParse({ ...settings, ...patch }).success, false);
assert.equal(sameOrigin(new Request('http://localhost:5173/api/settings/meta', { headers: { Origin: 'http://localhost:5173' } })), true);
assert.equal(sameOrigin(new Request('http://localhost:5173/api/settings/meta')), false);
assert.equal(sameOrigin(new Request('http://localhost:5173/api/settings/meta', { headers: { Origin: 'https://evil.example' } })), false);
assert.equal(sameOrigin(new Request('http://localhost:5173/api/settings/meta', { headers: { Origin: 'http://localhost:5173', 'Sec-Fetch-Site': 'cross-site' } })), false);

let calls = [];
const account = { id: 'act_123456', name: 'Test account', currency: 'MYR', timezone_name: 'Asia/Kuala_Lumpur' };
const config = { accountId: 'act_123456', apiVersion: 'v26.0' };
const mock = async (url, options) => { calls.push({ url, options }); return Response.json(url.pathname.endsWith('/insights') ? { data: [] } : account); };
const result = await testMetaConnection(config, secret, mock);
assert.equal(result.ok, true); assert.equal(result.hasRecentRows, false); assert.equal(calls.length, 2);
for (const { url, options } of calls) {
  assert.equal(url.origin, 'https://graph.facebook.com'); assert.equal(options.method, 'GET'); assert.equal(options.redirect, 'error');
  assert.equal(options.headers.Authorization, `Bearer ${secret.accessToken}`);
  assert.ok(!url.href.includes(secret.accessToken) && !url.href.includes(secret.appSecret));
  assert.equal(url.searchParams.get('appsecret_proof'), createHmac('sha256', secret.appSecret).update(secret.accessToken).digest('hex'));
}
assert.equal(calls[1].url.searchParams.get('level'), 'account');
assert.equal(calls[1].url.searchParams.get('date_preset'), 'last_7d');
assert.equal(calls[1].url.searchParams.get('limit'), '1');
calls = [];
await testMetaConnection(config, { ...secret, appSecret: '' }, mock);
assert.ok(calls.every(({ url }) => !url.searchParams.has('appsecret_proof')));
assert.equal((await testMetaConnection(config, secret, async () => Response.json({ error: { code: 190, message: secret.accessToken } }, { status: 400 }))).ok, false);
assert.ok(!JSON.stringify(await testMetaConnection(config, secret, async () => { throw new Error(secret.accessToken); })).includes(secret.accessToken));
assert.equal((await testMetaConnection(config, secret, async () => Response.json({ ...account, id: 'act_999999' }))).ok, false);
assert.equal((await testMetaConnection(config, secret, async url => Response.json(url.pathname.endsWith('/insights') ? { data: [{ spend: '5' }] } : account))).hasRecentRows, true);
let attempted = false;
assert.equal((await testMetaConnection({ ...config, accountId: '../me' }, secret, async () => { attempted = true; return Response.json({}); })).ok, false);
assert.equal(attempted, false);
console.log('PASS: encryption, tamper protection, owner/account binding, input validation, origin checks, read-only Meta requests, proof and sanitized errors.');
