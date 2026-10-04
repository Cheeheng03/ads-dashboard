"""Read-only merchant enrichment. Never requests Facebook or any private endpoint.

Run explicitly to refresh public merchant evidence, then build-pilot-audit.py.
Response bodies and hashes are retained so parsing can be independently checked.
"""
import concurrent.futures
import datetime as dt
import hashlib
import json
from pathlib import Path
import urllib.error
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'docs/research/pilot-data-audit'
ALLOWED = {'www.amazingraze.com.my', 'amazingraze.com.my', 'www.jobbienutbutter.com', 'jobbienutbutter.com'}
TARGETS = [
    ('graze-vanilla', 'graze', 'https://www.amazingraze.com.my/products/oh-so-vanilla-protein-blend-700g'),
    ('graze-granola', 'graze', 'https://www.amazingraze.com.my/products/amazin-granola-variety-box'),
    ('graze-trial', 'graze', 'https://www.amazingraze.com.my/products/first-trial-kit'),
    ('graze-protein', 'graze', 'https://www.amazingraze.com.my/collections/protein-blend'),
    ('jobbie-home', 'jobbie', 'https://www.jobbienutbutter.com/'),
    ('jobbie-product', 'jobbie', 'https://www.jobbienutbutter.com/products/chunky-pure-peanut-butter-380grams'),
]
# Read-only routes observed in the merchant's publicly served page scripts.
INSPECTED_TARGETS = [
    ('jobbie-promotions', 'jobbie', 'https://www.jobbienutbutter.com/products/chunky-pure-peanut-butter-380grams/promotions?limit=5&page=1'),
    ('jobbie-recommend', 'jobbie', 'https://www.jobbienutbutter.com/products/chunky-pure-peanut-butter-380grams/recommend'),
    ('graze-recommend', 'graze', 'https://www.amazingraze.com.my/recommendations/products?section_id=product-upsell-slider&product_id=7578158497974&limit=8&intent=related'),
    ('graze-product-view', 'graze', 'https://www.amazingraze.com.my/products/oh-so-vanilla-protein-blend-700g/?view=js_ppr'),
    ('graze-recommend-json', 'graze', 'https://www.amazingraze.com.my/recommendations/products.json?product_id=7578158497974&limit=8&intent=related'),
]

class SafeRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        if urllib.parse.urlsplit(newurl).hostname not in ALLOWED:
            raise ValueError('Redirect outside merchant allowlist')
        return super().redirect_request(req, fp, code, msg, headers, newurl)

def fetch(target):
    ident, company, url = target
    record = {'id': ident, 'company': company, 'url': url, 'checked_at': dt.datetime.now(dt.timezone.utc).isoformat(), 'status': None, 'error': None}
    try:
        opener = urllib.request.build_opener(SafeRedirect())
        req = urllib.request.Request(url, headers={'User-Agent': 'AdObservatory-PublicResearch/1.0', 'Accept': 'application/json' if url.endswith('.js') else 'text/html'})
        try:
            res = opener.open(req, timeout=25)
        except urllib.error.HTTPError as exc:
            res = exc
        with res:
            body = res.read(2_000_001)
            record.update(status=res.status, final_url=res.geturl(), content_type=res.headers.get('Content-Type', ''), bytes=len(body))
            if len(body) > 2_000_000:
                raise ValueError('Response exceeded 2 MB limit')
            record['sha256'] = hashlib.sha256(body).hexdigest()
            record['file'] = f'raw/{ident}.txt'
            (OUT / record['file']).write_bytes(body)
            try:
                data = json.loads(body)
                # Retain only public product information, never session/cart contents.
                if isinstance(data, dict):
                    record['json_keys'] = list(data)
            except (ValueError, UnicodeDecodeError):
                pass
    except Exception as exc:
        record['error'] = str(exc)
    return record

def main():
    (OUT / 'raw').mkdir(parents=True, exist_ok=True)
    targets = TARGETS + [(i+'-json', c, u+'.js') for i,c,u in TARGETS if '/products/' in u] + INSPECTED_TARGETS
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        records = list(pool.map(fetch, targets))
    (OUT/'merchant-fetches.json').write_text(json.dumps(records, indent=2))
    for r in records:
        print(r['id'], r['status'], r.get('content_type'), r.get('json_keys', []), r['error'])

if __name__ == '__main__':
    main()
