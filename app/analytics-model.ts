import type {Ad, Workspace} from './model';

export const metrics=['spend','impressions','reach','clicks','link_clicks','landing_page_views','add_to_cart','checkouts','purchases','revenue','leads','video_plays'] as const;
export type Metric=typeof metrics[number];
export type Performance={id?:string;company_id:string;account_id:string;ad_id:string;ad_name:string;date:string;currency:string;attribution:string;source:string;imported_at?:string} & Record<Metric,number|null>;
export const ratio=(a:number|null,b:number|null,m=1)=>a===null||b===null||b===0?null:a/b*m;
// Missing measures stay unknown. Do not silently turn an incomplete report into a total.
export function total(rows:Performance[],field:Metric){return !rows.length||rows.some(r=>r[field]===null)?null:rows.reduce((n,r)=>n+r[field]!,0)}
export function summarize(rows:Performance[]){const spend=total(rows,'spend'),revenue=total(rows,'revenue'),impressions=total(rows,'impressions'),clicks=total(rows,'clicks'),purchases=total(rows,'purchases');return {spend,revenue,impressions,clicks,purchases,ctr:ratio(clicks,impressions,100),cpc:ratio(spend,clicks),cpm:ratio(spend,impressions,1000),cpa:ratio(spend,purchases),roas:ratio(revenue,spend)}}
export function days(count:number){const end=new Date();end.setUTCHours(0,0,0,0);return Array.from({length:count},(_,i)=>new Date(end.getTime()-(count-i-1)*86400000).toISOString().slice(0,10))}
export function publicAnalytics(workspace:Workspace,count:number,companyId='all'){
 const ads=workspace.ads.filter(a=>companyId==='all'||a.company_id===companyId),dates=days(count),ids=new Set(ads.map(a=>a.id));
 const timeline=dates.map(date=>({date,label:new Date(date+'T12:00:00Z').toLocaleDateString('en-GB',{month:'short',day:'numeric'}),discovered:ads.filter(a=>a.first_seen.slice(0,10)===date).length,checks:workspace.observations.filter(o=>ids.has(o.ad_id)&&o.observed_at.slice(0,10)===date).length}));
 const split=(field:'format'|'angle'|'hook')=>Object.entries(ads.reduce<Record<string,number>>((n,a)=>{const v=a[field]||'Untagged';n[v]=(n[v]||0)+1;return n},{})).map(([name,value])=>({name,value})).sort((a,b)=>b.value-a.value);
 const age=(a:Ad)=>a.start_date?Math.max(0,Math.floor((Date.now()-Date.parse(a.start_date))/86400000)):null;
 const longevity=[{name:'0–7 days',min:0,max:7},{name:'8–30 days',min:8,max:30},{name:'31–90 days',min:31,max:90},{name:'90+ days',min:91,max:Infinity}].map(b=>({name:b.name,value:ads.filter(a=>age(a)!>=b.min&&age(a)!<=b.max&&age(a)!==null).length}));
 const businesses=workspace.companies.filter(c=>companyId==='all'||c.id===companyId).map(c=>{const list=ads.filter(a=>a.company_id===c.id);return {...c,saved:list.length,active:list.filter(a=>a.status==='Active').length,newAds:list.filter(a=>a.first_seen.slice(0,10)>=dates[0]).length,pinned:list.filter(a=>a.pinned).length,oldest:Math.max(0,...list.map(a=>age(a)||0)),stale:list.filter(a=>Date.now()-Date.parse(a.last_seen)>7*86400000).length}}).sort((a,b)=>b.saved-a.saved);
 return {ads,timeline,formats:split('format'),angles:split('angle'),hooks:split('hook'),longevity,businesses,unknownAge:ads.filter(a=>!a.start_date).length,stale:ads.filter(a=>Date.now()-Date.parse(a.last_seen)>7*86400000).length,newAds:timeline.reduce((n,d)=>n+d.discovered,0),tagged:ads.filter(a=>a.angle&&a.hook).length};
}

function number(value:unknown):number|null{if(value===undefined||value===null||value==='')return null;const n=Number(value);if(!Number.isFinite(n)||n<0)throw Error('Metrics must be finite, non-negative numbers.');return n}
type Raw=Record<string,unknown>;
export function normalizePerformance(raw:unknown,companyId:string,attribution:string,currency:string):Performance[]{
 const rows=Array.isArray(raw)?raw:(raw as Raw)?.data;
 if(!Array.isArray(rows)||!rows.length||rows.length>500)throw Error('Use an Insights JSON array or {data: [...]}, with 1–500 daily ad rows.');
 return rows.map((r:Raw,i:number)=>{
  if(!r||typeof r!=='object')throw Error(`Row ${i+1}: expected an object.`);
  if(['age','gender','country','publisher_platform','platform_position','device_platform','region','hourly_stats_aggregated_by_advertiser_time_zone'].some(k=>r[k]!==undefined))throw Error(`Row ${i+1}: export without breakdowns to avoid double counting.`);
  const date=r.date||r.date_start;if(!date||r.date_stop&&r.date_stop!==date)throw Error(`Row ${i+1}: daily rows required (time_increment=1).`);
  if(!r.account_id||!r.ad_id)throw Error(`Row ${i+1}: account_id and Ads Manager ad_id are required.`);
  const action=(key:string,list=r.actions):number|null=>{if(!Array.isArray(list))return null;const found=list.find((v:Raw)=>v.action_type===key);return found?number(found.value):null};
  // Use one canonical action type, never add overlapping purchase / pixel aliases.
  const v={company_id:companyId,account_id:String(r.account_id),ad_id:String(r.ad_id),ad_name:String(r.ad_name||r.ad_id),date:String(date),currency:String(r.account_currency||r.currency||currency),attribution,source:'Meta Insights JSON import'} as Performance;
  for(const key of metrics)v[key]=number(r[key]);
  v.link_clicks=number(r.link_clicks)??number(r.inline_link_clicks)??action('link_click');
  v.landing_page_views=number(r.landing_page_views)??action('landing_page_view');
  v.add_to_cart=number(r.add_to_cart)??action('add_to_cart');v.checkouts=number(r.checkouts)??action('initiate_checkout');
  v.purchases=number(r.purchases)??action('purchase');v.revenue=number(r.revenue)??action('purchase',r.action_values);v.leads=number(r.leads)??action('lead');v.video_plays=number(r.video_plays)??action('video_view');
  return v;
 });
}
