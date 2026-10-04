"""Evidence correctness and local authenticated delivery. No external requests."""
import importlib.util
import json
from pathlib import Path
import unittest
import urllib.error
import urllib.request

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('pilot_audit',ROOT/'scripts/build-pilot-audit.py')
model=importlib.util.module_from_spec(spec);spec.loader.exec_module(model)
DATA=json.loads((ROOT/'docs/research/pilot-data-audit/audit.json').read_text())

class EvidenceTests(unittest.TestCase):
    def test_age_is_elapsed_calendar_days_and_rejects_future_start(self):
        self.assertEqual(model.calendar_age('2026-10-04','2026-10-04T03:31:50Z'),0)
        self.assertEqual(model.calendar_age('2026-09-07','2026-10-04'),27)
        self.assertEqual(model.calendar_age('2024-02-28','2024-03-01'),2)
        with self.assertRaises(ValueError):model.calendar_age('2026-10-05','2026-10-04')
    def test_discounts_never_invent_reference_price(self):
        self.assertIsNone(model.discount(99.9,None))
        self.assertIsNone(model.discount(10,0))
        self.assertIsNone(model.discount(12,10))
        self.assertEqual(model.discount(20.9,27.5),24)
    def test_saved_values_and_live_values_keep_distinct_times_and_scope(self):
        self.assertEqual(len(DATA['ads']),13)
        self.assertEqual(len({a['id'] for a in DATA['ads']}),13)
        self.assertTrue(all(a['observed_at']==DATA['meta_observed_at'] for a in DATA['ads']))
        jobbie=[a for a in DATA['ads'] if a['company']=='jobbie']
        self.assertEqual(sorted(a['age_days'] for a in jobbie),[3,3,3,7,27])
        self.assertTrue(all(a['spend'] is None and a['ctr'] is None and a['paid_clicks'] is None for a in DATA['ads']))
    def test_declared_validation_passes_and_source_references_resolve(self):
        self.assertTrue(all(c['passed'] for c in DATA['checks']))
        sources={s['id'] for s in DATA['sources']}
        for metric in DATA['metrics']:
            self.assertTrue(set(metric['source_ids'])<=sources,metric['id'])
            self.assertEqual(set(metric['values']),{'jobbie','graze'})
    def test_avatar_exclusion_and_media_completeness_not_inferred(self):
        for ad in DATA['ads']:
            self.assertNotIn(ad['avatar_url'],ad['images'])
            self.assertEqual(ad['video_urls'],[])
            self.assertIsNone(ad['platforms'])
        self.assertGreater(sum(len(a['images']) for a in DATA['ads']),13)
    def test_product_units_and_variant_discounts(self):
        pp={p['id']:p for p in DATA['products']}
        vanilla=pp['graze-vanilla'];self.assertEqual(vanilla['price'],99.9)
        self.assertEqual(vanilla['variants'][0]['price'],99.9)
        self.assertIsNone(vanilla['variants'][0]['discount_pct'])
        self.assertEqual(pp['jobbie-product']['price'],20.9)
        self.assertEqual(pp['jobbie-product']['variants'][0]['price'],20.9)
        self.assertEqual(pp['jobbie-product']['matched_ads'],[])
        self.assertEqual(pp['graze-trial']['price'],50)
        for product in DATA['products']:
            self.assertEqual(product['currency'],'MYR')
            for ident in product['matched_ads']:
                ad=next(a for a in DATA['ads'] if a['id']==ident)
                self.assertTrue(any(model.urlsplit(u).path==model.urlsplit(product['url']).path for u in ad['landing_urls']))
    def test_failed_api_shape_and_unexecuted_calls_not_reported_as_success(self):
        endpoints={e['id']:e for e in DATA['endpoints']}
        self.assertEqual(endpoints['jobbie-product-json']['http_status'],200)
        self.assertEqual(endpoints['jobbie-product-json']['status'],'Not a JSON API: HTML fallback')
        self.assertEqual(endpoints['meta-live']['status'],'Blocked')
        for key in ['meta-archive','meta-insights','apify-api','adyntel-api','foreplay-api','pathmatics-api']:
            self.assertIsNone(endpoints[key]['http_status'])
        self.assertIn('variants[].price',endpoints['graze-vanilla-json']['field_paths'])
        self.assertEqual(endpoints['jobbie-promotions']['parameters'],{'limit':['5'],'page':['1']})
    def test_local_auth_and_server_render(self):
        base='http://127.0.0.1:5173'
        def get(path,auth):
            req=urllib.request.Request(base+path,headers={'Cookie':'__sites_local_auth=1'} if auth else {})
            try:
                with urllib.request.urlopen(req,timeout=30) as r:return r.status,r.read().decode(),r.headers
            except urllib.error.HTTPError as e:return e.code,e.read().decode(),e.headers
        status,body,headers=get('/api/data-audit',False)
        self.assertEqual(status,401);self.assertNotIn(DATA['ads'][0]['id'],body)
        status,body,headers=get('/api/data-audit',True)
        self.assertEqual(status,200);self.assertEqual(json.loads(body),DATA)
        self.assertIn('no-store',headers['Cache-Control'])
        status,body,_=get('/data-audit',False)
        self.assertEqual(status,200);self.assertNotIn(DATA['ads'][0]['id'],body)
        status,body,_=get('/data-audit',True)
        self.assertEqual(status,200)
        for expected in ['Metric catalog','Endpoint inspection','JOBBIE','Amazin','Ad Library record']:
            self.assertIn(expected,body)
        self.assertIn(DATA['ads'][0]['id'],body)

if __name__=='__main__':unittest.main(verbosity=2)
