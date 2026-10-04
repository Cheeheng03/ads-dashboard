"""Daily report persistence and validation against the explicit local test identity."""
import json, urllib.request, urllib.error
BASE='http://127.0.0.1:5173/api/workspace'
def call(payload=None):
    req=urllib.request.Request(BASE,data=json.dumps(payload).encode() if payload else None,headers={'Content-Type':'application/json','Cookie':'__sites_local_auth=1'})
    try:
        with urllib.request.urlopen(req) as res:return res.status,json.load(res)
    except urllib.error.HTTPError as e:return e.code,json.load(e)
def post(action,**kw):
    status,data=call({'action':action,**kw});assert status==200,(status,data);return data
company=post('company.save',data={'name':'Performance QA'})['id']
other=post('company.save',data={'name':'Performance QA other'})['id']
try:
    row={'company_id':company,'account_id':'qa-account','ad_id':'qa-manager-ad','ad_name':'QA report','date':'2026-01-01','currency':'MYR','attribution':'7d click / 1d view · impression time · MYT','source':'Local QA','spend':100,'impressions':10000,'clicks':100,'purchases':5,'revenue':500}
    post('performance.import',rows=[row])
    post('performance.import',rows=[{**row,'spend':125}])
    saved=[r for r in call()[1]['performance'] if r['company_id']==company]
    assert len(saved)==1 and saved[0]['spend']==125 and saved[0]['reach'] is None
    for bad in [{**row,'date':'2026-02-30'},{**row,'date':'2999-01-01'},{**row,'spend':-1},{**row,'attribution':''},{**row,'company_id':'not-owned'}]:
        assert call({'action':'performance.import','rows':[{**row,'ad_id':'would-be-inserted'},bad]})[0]==400
    assert len([r for r in call()[1]['performance'] if r['company_id']==company])==1
    assert call({'action':'performance.import','rows':[row,row]})[0]==400
    assert call({'action':'performance.import','rows':[{**row,'company_id':other}]})[0]==409
    post('performance.import',rows=[{**row,'attribution':'1d click · impression time · MYT'}])
    post('performance.import',rows=[{**row,'currency':'USD'}])
    saved=[r for r in call()[1]['performance'] if r['company_id']==company]
    assert len(saved)==3,'attribution and currency scopes must remain separate'
    post('performance.delete_scope',scope={'account_id':'qa-account','currency':'USD','attribution':row['attribution']})
    assert len([r for r in call()[1]['performance'] if r['company_id']==company])==2
finally:
    post('company.delete',id=company)
    post('company.delete',id=other)
assert not any(r['company_id'] in [company,other] for r in call()[1]['performance'])
print('PASS: idempotent reports, atomic rejection, scope isolation, ownership checks, nullable fields and cascading cleanup')
