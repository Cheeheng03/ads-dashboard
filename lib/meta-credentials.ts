// Server cryptography. This module is never imported by client components.
const encoder = new TextEncoder();
function encode(bytes: Uint8Array): string { return btoa(String.fromCharCode(...bytes)); }
function decode(value: string): Uint8Array<ArrayBuffer> { return Uint8Array.from(atob(value), c => c.charCodeAt(0)); }
export async function encryptionKey(value: string | undefined): Promise<CryptoKey> {
  if (!value || !/^[A-Za-z0-9+/]{43}=$/.test(value)) throw new Error('Encryption is not configured.');
  const bytes = decode(value);
  if (bytes.length !== 32) throw new Error('Encryption is not configured.');
  return crypto.subtle.importKey('raw', bytes, 'AES-GCM', false, ['encrypt', 'decrypt']);
}
export type MetaSecrets = { accessToken: string; appSecret: string };
export async function seal(key: CryptoKey, context: string, secrets: MetaSecrets): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: encoder.encode(`meta:v1:${context}`) }, key, encoder.encode(JSON.stringify(secrets)));
  return `v1.${encode(iv)}.${encode(new Uint8Array(ciphertext))}`;
}
export async function unseal(key: CryptoKey, context: string, envelope: string): Promise<MetaSecrets> {
  const parts = envelope.split('.');
  if (parts.length !== 3 || parts[0] !== 'v1') throw new Error('Cannot open credentials.');
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: decode(parts[1]), additionalData: encoder.encode(`meta:v1:${context}`) }, key, decode(parts[2]));
  const result = JSON.parse(new TextDecoder().decode(plaintext));
  if (typeof result.accessToken !== 'string' || typeof result.appSecret !== 'string') throw new Error('Cannot open credentials.');
  return result;
}
