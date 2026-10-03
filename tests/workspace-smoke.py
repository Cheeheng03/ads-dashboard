"""Run against the local Sites preview only; uses its explicit mock identity."""
import json, urllib.request, urllib.error
BASE='http://127.0.0.1:5173/api/workspace'
def call(payload=None, auth=True, extra=None):
    headers={'Content-Type':'application/json'}
    if auth: headers['Cookie']='__sites_local_auth=1'
    headers.update(extra or {})
    r=urllib.request.Request(BASE,data=json.dumps(payload).encode() if payload else None,headers=headers)
    try:
        with urllib.request.urlopen(r) as x:return x.status,json.load(x)
    except urllib.error.HTTPError as e:
        raw=e.read().decode()
        try: body=json.loads(raw)
        except ValueError: body={'error':raw}
        return e.code,body
def post(action,**kw):
    status,data=call({'action':action,**kw});assert status==200,(status,data);return data
assert call(auth=False)[0]==401
assert call(auth=False,extra={'oai-authenticated-user-id':'spoof','oai-authenticated-user-email':'fake@example.com'})[0]==401
assert call({'action':'company.save','data':{'name':'Blocked'}},extra={'Origin':'https://another.example'})[0]==403
company=post('company.save',data={'name':'API QA fixture'})['id']
ad={'company_id':company,'library_id':'qa-local-unique','title':'QA creative A','body':'A local verification fixture','status':'Active','notes':'Keep my notes','board':'QA board','pinned':1,'reach':10000,'metric_source':'Local test fixture, no real metrics','frequency_low':1,'frequency_high':2,'cpm_low':10,'cpm_high':20}
aid=post('ad.save',data=ad)['id']
_,w=call();a=next(x for x in w['ads'] if x['id']==aid);last=a['last_seen']
post('ad.save',data={**a,'notes':'Preserve this annotation'})
_,w=call();assert next(x for x in w['ads'] if x['id']==aid)['last_seen']==last
post('ads.import',ads=[{**ad,'notes':'overwrite attempt','pinned':0,'board':'wrong','title':'QA refreshed creative'}])
_,w=call();matches=[x for x in w['ads'] if x['library_id']=='qa-local-unique'];assert len(matches)==1
assert matches[0]['notes']=='Preserve this annotation' and matches[0]['pinned']==1 and matches[0]['board']=='QA board'
assert len([o for o in w['observations'] if o['ad_id']==aid])==2
before=len(w['ads'])
assert call({'action':'ads.import','ads':[{**ad,'library_id':'qa-valid'},{**ad,'library_id':'qa-invalid','spend':-1}]})[0]==400
assert len(call()[1]['ads'])==before
assert call({'action':'ads.import','ads':[ad,ad]})[0]==400
assert call({'action':'ad.save','data':{**ad,'library_id':'qa-missing-source','metric_source':''}})[0]==400
assert call({'action':'ad.save','data':{**ad,'library_id':'qa-invalid-range','cpm_low':30,'cpm_high':10}})[0]==400
assert call({'action':'ad.pin','id':'foreign-or-missing-id','pinned':True})[0]==404
post('ad.observe',id=aid,status='Inactive')
assert next(x for x in call()[1]['ads'] if x['id']==aid)['status']=='Inactive'
post('company.delete',id=company)
_,w=call();assert not any(x['id']==aid for x in w['ads']);assert not any(x['ad_id']==aid for x in w['observations'])
print('PASS: auth, spoof rejection, origin, persistence, deduplication, curation preservation, observation dates, atomic validation, source/range validation and cascade deletion')
