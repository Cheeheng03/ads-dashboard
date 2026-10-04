'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { ArrowLeft, ArrowUpRight, Check, KeyRound, LoaderCircle, LockKeyhole, Plug, Radar, ShieldCheck, Trash2 } from 'lucide-react';
import type { SettingsState, SavedConnection } from '@/lib/meta-connection';
import s from './settings.module.css';

const external = { target: '_blank', rel: 'noopener noreferrer' };
export default function Settings() {
  const [state, setState] = useState<SettingsState | null>(null);
  const [appId, setAppId] = useState(''), [accountId, setAccountId] = useState(''), [apiVersion, setApiVersion] = useState('v26.0');
  const [token, setToken] = useState(''), [secret, setSecret] = useState(''), [removeSecret, setRemoveSecret] = useState(false);
  const [busy, setBusy] = useState(''), [error, setError] = useState(''), [notice, setNotice] = useState(''), [signedOut, setSignedOut] = useState(false), [confirmDelete, setConfirmDelete] = useState(false);
  const connection = state?.connection;
  const dirty = Boolean(token || secret || removeSecret || (connection && (appId !== connection.appId || accountId !== connection.accountId || apiVersion !== connection.apiVersion)));
  function applyConnection(saved: SavedConnection | null) {
    setAppId(saved?.appId ?? ''); setAccountId(saved?.accountId ?? ''); setApiVersion(saved?.apiVersion ?? 'v26.0');
    setToken(''); setSecret(''); setRemoveSecret(false); setConfirmDelete(false);
  }
  async function load() {
    setBusy('load'); setError('');
    try {
      const response = await fetch('/api/settings/meta', { cache: 'no-store' });
      const body = await response.json() as SettingsState & { error?: string };
      if (response.status === 401) setSignedOut(true);
      if (!response.ok) throw new Error(body.error || 'Could not load settings.');
      setSignedOut(false); setState(body); applyConnection(body.connection);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not load settings.'); }
    finally { setBusy(''); }
  }
  useEffect(() => { void load(); }, []);
  useEffect(() => {
    if (!dirty) return;
    const prevent = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', prevent);
    return () => window.removeEventListener('beforeunload', prevent);
  }, [dirty]);
  async function act(action: 'save' | 'test' | 'delete') {
    setBusy(action); setError(''); setNotice('');
    try {
      const payload = action === 'save' ? { action, revision: connection?.revision ?? null, appId, accountId, apiVersion, accessToken: token, appSecret: secret, removeAppSecret: removeSecret } : { action, revision: connection?.revision };
      const response = await fetch('/api/settings/meta', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const body = await response.json() as { error?: string; connection: SavedConnection | null };
      if (response.status === 401) setSignedOut(true);
      if (!response.ok) throw new Error(body.error || 'The operation failed.');
      setState(previous => previous ? { ...previous, connection: body.connection } : previous);
      applyConnection(body.connection);
      setNotice(action === 'save' ? 'Credentials saved and encrypted. Test the connection when you are ready.' : action === 'delete' ? 'Saved credentials removed from this app. Revoke the token in Meta too if you no longer need it.' : 'Connection test finished. See the result below.');
    } catch (e) { setError(e instanceof Error ? e.message : 'The operation failed.'); }
    finally { setBusy(''); }
  }
  const save = (event: FormEvent) => { event.preventDefault(); void act('save'); };
  const blocked = Boolean(busy || !state || !state.encryptionReady || signedOut);
  return <div className={s.page}>
    <header className={s.header}><a href="/" className={s.brand}><Radar size={21}/>Ad Observatory</a><span className={s.divider}>/</span><span>Settings</span><a href="/" className={s.back}><ArrowLeft size={14}/> Back to workspace</a></header>
    <main className={s.main}>
      <div className={s.heading}><p className={s.eyebrow}>WORKSPACE SETTINGS</p><h1>Connect your Meta account</h1><p>Bring verified ad results into your workspace, starting with a secure connection.</p></div>
      <div className={s.scope}><ShieldCheck size={20}/><p><strong>Your accounts, with your permission.</strong> Reporting access can unlock spend, impressions, clicks and attributed results for accounts you manage. It does not unlock competitors’ private results.</p></div>
      <div aria-live="polite">{error && <div className={s.error} role="alert">{error} {signedOut ? <a href="/signin-with-chatgpt?return_to=%2Fsettings">Sign in to continue →</a> : <button className={s.textButton} onClick={() => void load()} disabled={Boolean(busy)}>Reload settings</button>}</div>}{notice && <div className={s.notice}><Check size={16}/>{notice}</div>}</div>
      <div className={s.layout}>
        <section className={s.panel} aria-labelledby="credentials-title">
          <div className={s.panelHeader}><div><h2 id="credentials-title"><KeyRound size={18}/> Connection details</h2><p>One ad account for this initial connection.</p></div><span className={`${s.badge} ${connection?.test?.ok && !dirty ? s.success : ''}`}>{busy === 'load' ? 'Loading…' : dirty ? 'Unsaved changes' : connection?.test?.ok ? 'Access verified' : connection ? 'Saved · test needed' : 'Not connected'}</span></div>
          {!state && !error ? <div className={s.loading}><LoaderCircle size={18} className={s.spin}/> Loading your settings…</div> : <form onSubmit={save} className={s.form} autoComplete="off">
            {state && !state.encryptionReady && <p className={s.error}>Server encryption is not ready. Credential entry is disabled until the local key is configured.</p>}
            <fieldset disabled={blocked}>
              <div className={s.fields}>
                <label htmlFor="meta-app-id">Meta App ID <span>Required</span><input id="meta-app-id" value={appId} onChange={e => setAppId(e.target.value)} placeholder="e.g. 123456789012345" inputMode="numeric" pattern="[0-9]{5,30}" required maxLength={30}/><small>Meta for Developers → your app → Settings → Basic.</small></label>
                <label htmlFor="meta-account-id">Ad account ID <span>Required</span><input id="meta-account-id" value={accountId} onChange={e => setAccountId(e.target.value)} placeholder="act_123456789012345" required pattern="(act_)?[0-9]{5,30}" maxLength={34}/><small>Find it in Ads Manager’s account selector. The act_ prefix is optional.</small></label>
              </div>
              <label htmlFor="meta-token">Access token <span>{connection?.hasToken ? 'Saved securely' : 'Required'}</span><input id="meta-token" name="meta-access-token" type="password" autoComplete="new-password" spellCheck={false} value={token} onChange={e => setToken(e.target.value)} placeholder={connection?.hasToken ? 'Saved · paste here only to replace' : 'Paste your Meta access token'} required={!connection?.hasToken} maxLength={8192}/><small>Use a user or system-user token with <code>ads_read</code> and access to this account. Saved tokens are never shown again.</small></label>
              <details className={s.advanced}><summary>App secret & API version <span>Additional settings</span></summary><div>
                <label htmlFor="meta-secret">App secret <span>{connection?.hasAppSecret ? 'Saved securely' : 'Optional unless your app requires proof'}</span><input id="meta-secret" name="meta-app-secret" type="password" autoComplete="new-password" spellCheck={false} value={secret} onChange={e => { setSecret(e.target.value); setRemoveSecret(false); }} placeholder={connection?.hasAppSecret ? 'Saved · leave blank to keep' : '32-character app secret'} maxLength={32} pattern="[a-fA-F0-9]{32}"/><small>Settings → Basic in your Meta app. Used server-side to generate app secret proof for requests.</small></label>
                {connection?.hasAppSecret && <label className={s.checkbox}><input type="checkbox" checked={removeSecret} onChange={e => { setRemoveSecret(e.target.checked); setSecret(''); }}/> Remove saved app secret on next save</label>}
                <label htmlFor="meta-version">Graph API version<input id="meta-version" value={apiVersion} onChange={e => setApiVersion(e.target.value)} pattern="v[0-9]{2,3}\.0" required maxLength={6}/><small>Default v26.0 matches the Meta Business SDK version checked for this setup. Change only to a supported version for your app.</small></label>
              </div></details>
              <div className={s.formFooter}><p><LockKeyhole size={14}/> Encrypted before database storage</p><button className={s.primary} type="submit" disabled={blocked}>{busy === 'save' ? <LoaderCircle size={15} className={s.spin}/> : <LockKeyhole size={15}/>} {busy === 'save' ? 'Saving…' : 'Save credentials'}</button></div>
            </fieldset>
          </form>}
          <div className={s.testSection}>
            <div className={s.testHeading}><div><h3><Plug size={17}/> Test reporting access</h3><p>Checks the saved account and its Insights endpoint.</p></div><button className={s.secondary} disabled={blocked || !connection || dirty} onClick={() => void act('test')}>{busy === 'test' && <LoaderCircle size={15} className={s.spin}/>} {busy === 'test' ? 'Testing…' : 'Test connection'}</button></div>
            {dirty ? <p className={s.hint}>Save your changes before testing.</p> : connection?.test ? <div className={connection.test.ok ? s.testSuccess : s.error}><strong>{connection.test.ok ? 'Reporting access verified' : 'Connection needs attention'}</strong><p>{connection.test.message}</p>{connection.test.ok && <dl className={s.accountFacts}><div><dt>Account</dt><dd>{connection.test.accountName || connection.accountId}</dd></div><div><dt>Currency</dt><dd>{connection.test.currency || 'Not returned'}</dd></div><div><dt>Time zone</dt><dd>{connection.test.timezone || 'Not returned'}</dd></div></dl>}<small>Last test: {connection.testedAt ? new Date(connection.testedAt).toLocaleString() : '—'}</small></div> : <p className={s.hint}>{connection ? 'Saved locally. No access has been verified yet.' : 'Save your credentials above to enable the test.'}</p>}
            <p className={s.fine}>Testing sends the saved token to Meta from the server and reads account details plus a small report from the last 7 days. It does not change ads or import reports. App ID ownership and token expiry are not verified by this test.</p>
          </div>
        </section>
        <aside className={s.guide} aria-label="Connection setup guide"><h2>Let’s connect, step by step</h2><p className={s.guideIntro}>You can start with your own ad account. Keep passwords and tokens out of chat.</p><ol>
          <li><span>1</span><div><h3>Create or choose your Meta app</h3><p>Open Meta for Developers. Choose an app configured for the Marketing API, or create one using the advertising / Marketing API use case offered in the dashboard.</p><a href="https://developers.facebook.com/apps/" {...external}>Open Meta for Developers <ArrowUpRight size={13}/></a><small>Copy its App ID into this page.</small></div></li>
          <li><span>2</span><div><h3>Check your ad account access</h3><p>In Business Settings, make sure your user can view the ad account’s performance. For a system-user token, assign that system user the required app and ad account assets.</p><a href="https://business.facebook.com/settings/" {...external}>Open Business Settings <ArrowUpRight size={13}/></a><small>Copy the ad account ID from Ads Manager.</small></div></li>
          <li><span>3</span><div><h3>Generate a reporting token</h3><p>For a first test, choose your app in Graph API Explorer and generate a user token with <code>ads_read</code>. A system-user token is an alternative for a business integration.</p><a href="https://developers.facebook.com/tools/explorer/" {...external}>Open Graph API Explorer <ArrowUpRight size={13}/></a><small>Paste it into Access token. Token lifetime varies; replace it when expired or revoked. Permissions for external clients may require app review and advanced access.</small></div></li>
          <li><span>{connection?.test?.ok ? <Check size={14}/> : '4'}</span><div><h3>Save, then test</h3><p>Save the credentials and select Test connection. A successful test confirms that this token can read the selected account and its reporting endpoint.</p><small>After this, we can connect report imports to a business in your workspace. Automatic syncing is not enabled on this page.</small></div></li>
        </ol><a className={s.docsLink} href="https://www.postman.com/meta/facebook-marketing-api/collection/0zr4mes/facebook-marketing-api-mapi" {...external}>Meta’s Marketing API reference <ArrowUpRight size={13}/></a></aside>
      </div>
      <section className={s.security}><div><h2><ShieldCheck size={17}/> How your credentials are stored</h2><p>Access tokens and app secrets are encrypted using AES-256-GCM. The local encryption key is kept separately from the database, in a server-only file. The app returns only saved-status flags and excludes credentials from workspace exports.</p><p>This localhost preview uses a local development sign-in, not a personal password. Treat your Mac account as the security boundary. Encryption does not protect credentials if someone gains control of both the database and server key.</p></div><div><h3>Remove this connection</h3><p>Delete the saved credentials. Your ads and imported reports will remain.</p>{confirmDelete ? <div className={s.confirm}><p>Remove the stored token and app secret?</p><button className={s.danger} disabled={Boolean(busy)} onClick={() => void act('delete')}>Yes, remove credentials</button><button className={s.secondary} disabled={Boolean(busy)} onClick={() => setConfirmDelete(false)}>Cancel</button></div> : <button className={s.secondary} disabled={!connection || Boolean(busy)} onClick={() => setConfirmDelete(true)}><Trash2 size={14}/> Remove saved connection</button>}<small>To revoke access completely, also revoke the token in Meta. Old database backups may retain encrypted records.</small></div></section>
    </main>
  </div>;
}
