"""Local API security checks. Never sends a request to Meta. Refuses to overwrite a saved connection."""
import json
import sqlite3
import urllib.request
import urllib.error
from pathlib import Path

BASE = 'http://127.0.0.1:5173'
def request(path='/api/settings/meta', body=None, auth=True, origin=BASE, content_type='application/json'):
    headers = {'Origin': origin, 'Content-Type': content_type}
    if auth: headers['Cookie'] = '__sites_local_auth=1'
    if origin is None: headers.pop('Origin')
    data = json.dumps(body).encode() if body is not None else None
    try:
        response = urllib.request.urlopen(urllib.request.Request(BASE + path, data=data, headers=headers))
    except urllib.error.HTTPError as error: response = error
    raw = response.read()
    try: parsed = json.loads(raw)
    except (ValueError, UnicodeDecodeError): parsed = None
    return response.status, parsed, raw, response.headers

status, initial, _, headers = request()
assert status == 200 and initial['encryptionReady'], 'Local encryption must be configured.'
assert initial['connection'] is None, 'Existing connection found: refusing to touch user credentials.'
assert 'no-store' in headers['Cache-Control']
assert request(auth=False)[0] == 401
payload = dict(action='save', revision=None, appId='123456789', accountId='987654321', apiVersion='v26.0', accessToken='TEST_TOKEN_LOCAL_ONLY', appSecret='a' * 32)
assert request(body=payload, auth=False)[0] == 401
assert request(body=payload, origin='https://evil.example')[0] == 403
assert request(body=payload, origin=None)[0] == 403
assert request(body=payload, content_type='text/plain')[0] == 415
assert request(body={**payload, 'accountId': '../me'})[0] == 400
revision = None
try:
    status, result, raw, _ = request(body=payload)
    assert status == 200
    revision = result['connection']['revision']
    assert result['connection']['accountId'] == 'act_987654321'
    assert payload['accessToken'].encode() not in raw and payload['appSecret'].encode() not in raw
    status, state, raw, _ = request()
    assert state['connection']['hasToken'] and state['connection']['hasAppSecret']
    assert b'encrypted_credentials' not in raw and b'TEST_TOKEN_LOCAL_ONLY' not in raw
    assert request(body=payload)[0] == 409
    dbs = list(Path('.wrangler/state/v3/d1').rglob('*.sqlite'))
    found = False
    for file in dbs:
        with sqlite3.connect(f'file:{file}?mode=ro', uri=True) as db:
            if not db.execute("SELECT name FROM sqlite_master WHERE name='meta_connections'").fetchone(): continue
            row = db.execute('SELECT encrypted_credentials FROM meta_connections WHERE owner=?', ('local_seedy',)).fetchone()
            if row:
                found = True
                assert row[0].startswith('v1.') and payload['accessToken'] not in row[0] and payload['appSecret'] not in row[0]
    assert found
    status, saved, _, _ = request(body={**payload, 'revision': revision, 'accessToken': '', 'appSecret': ''})
    assert status == 200 and saved['connection']['hasToken'] and saved['connection']['hasAppSecret']
    revision = saved['connection']['revision']
    status, saved, _, _ = request(body={**payload, 'revision': revision, 'accessToken': '', 'appSecret': '', 'removeAppSecret': True})
    assert status == 200 and not saved['connection']['hasAppSecret']
    revision = saved['connection']['revision']
    assert request(body={**payload, 'revision': revision, 'appId': '999999999', 'accessToken': ''})[0] == 400
    status, _, raw, _ = request('/api/workspace')
    assert status == 200 and b'TEST_TOKEN_LOCAL_ONLY' not in raw and b'encrypted_credentials' not in raw and b'meta_connections' not in raw
finally:
    if revision:
        status, _, _, _ = request(body={'action': 'delete', 'revision': revision})
        assert status == 200, 'Clean up test connection before using real credentials.'
assert request()[1]['connection'] is None
for path in ['/.dev.vars', '/@fs' + str(Path('.dev.vars').resolve())]:
    status, _, raw, _ = request(path)
    assert status in (403, 404) and b'CREDENTIALS_ENCRYPTION_KEY=' not in raw
assert request('/settings')[0] == 200
print('PASS: auth, CSRF, validation, encrypted DB, secret redaction, revision conflicts, credential retention/removal, exports, file blocking and settings route. No calls made to Meta.')
