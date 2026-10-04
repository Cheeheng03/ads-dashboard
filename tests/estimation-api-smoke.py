"""Local-only model persistence, ownership and validation. Leaves existing records intact."""
import json,urllib.request,urllib.error
BASE='http://127.0.0.1:5173/api/workspace'
def call(payload=None,authenticated=True,origin=None):
 headers={'Content-Type':'application/json'}
 if authenticated:headers['Cookie']='__sites_local_auth=1'
 if origin:headers['Origin']=origin
 req=urllib.request.Request(BASE,data=json.dumps(payload).encode() if payload else None,headers=headers)
 try:
  with urllib.request.urlopen(req,timeout=20) as res:return res.status,json.load(res)
 except urllib.error.HTTPError as e:
  body=e.read().decode()
  try:return e.code,json.loads(body)
  except json.JSONDecodeError:return e.code,body[:200]
def post(action,**kw):
 status,data=call({'action':action,**kw});assert status==200,(status,data);return data
assert call(authenticated=False)[0]==401
company=post('company.save',data={'name':'Estimator API QA temporary'})['id']
other=post('company.save',data={'name':'Estimator foreign company QA temporary'})['id']
try:
 ad=post('ad.save',data={'company_id':company,'title':'Estimator QA','status':'Active','start_date':'2026-09-01'})['id']
 outside=post('ad.save',data={'company_id':other,'title':'Estimator other QA'})['id']
 assumptions={'dailyLow':100,'dailyHigh':300,'cpmLow':10,'cpmHigh':20,'cpcLow':.5,'cpcHigh':2,'frequencyLow':1.5,'frequencyHigh':3,'ctrLow':.5,'ctrHigh':2,'currency':'MYR','benchmarkSource':'QA assumptions'}
 evidence={'ad_id':ad,'from':'2026-09-01','to':'2026-09-30','source':'QA report','scope':'MY traffic','currency':'MYR','impressionsLow':100000,'impressionsHigh':100000,'paidClicks':1000,'spend':1500,'reach':None,'visits':None,'conversions':None,'engagementStart':None,'engagementEnd':None}
 model={'version':1,'from':'2026-09-01','to':'2026-09-30','basis':'evidence','assumptions':assumptions,'evidence':[evidence]}
 payload={'action':'analysis.save','company_id':company,'model':model}
 assert call(payload,authenticated=False)[0]==401
 assert call(payload,origin='https://untrusted.example')[0]==403
 post('analysis.save',company_id=company,model=model)
 models=[m for m in call()[1]['analysisModels'] if m['company_id']==company]
 assert len(models)==1 and models[0]['model']==model
 updated={**model,'basis':'budget'}
 post('analysis.save',company_id=company,model=updated)
 assert len([m for m in call()[1]['analysisModels'] if m['company_id']==company])==1
 for invalid in [{**model,'assumptions':{**assumptions,'cpmLow':100}},{**model,'evidence':[{**evidence,'ad_id':outside}]},{**model,'evidence':[{**evidence,'source':''}]},{**model,'evidence':[evidence,evidence]},{**model,'to':'2999-01-01'}]:
  assert call({**payload,'model':invalid})[0]==400
 assert call({**payload,'company_id':'does-not-exist'})[0]==404
 assert [m for m in call()[1]['analysisModels'] if m['company_id']==company][0]['model']==updated,'invalid writes preserve previous model'
finally:
 post('company.delete',id=company)
 post('company.delete',id=other)
assert not any(m['company_id'] in [company,other] for m in call()[1]['analysisModels'])
print('PASS: owner auth, origin validation, model round-trip/upsert, cross-company rejection, atomic invalid-input rejection and company deletion cascade')
