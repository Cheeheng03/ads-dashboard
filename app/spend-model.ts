import {ratio,total,type Performance} from './analytics-model';
import {accountValues,groupAccountAds} from './business-model';

const DAY=86400000;
export type Grouping='week'|'month';
export type ResultMetric='purchases'|'leads'|'link_clicks';
export type RankMetric='roas'|'cpa'|'cpl'|'linkCpc'|'linkCtr'|'spend';
export const resultNames:Record<ResultMetric,string>={purchases:'Purchases',leads:'Leads',link_clicks:'Link clicks'};
export const rankNames:Record<RankMetric,string>={roas:'Highest ROAS',cpa:'Lowest cost per purchase',cpl:'Lowest cost per lead',linkCpc:'Lowest cost per link click',linkCtr:'Highest link CTR',spend:'Highest spend'};

function validDate(s:string){const n=Date.parse(s+'T00:00:00Z');return /^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(n)&&new Date(n).toISOString().slice(0,10)===s}
export function dateWindow(start:string,end:string){
 if(!validDate(start)||!validDate(end))return [];
 const count=(Date.parse(end)-Date.parse(start))/DAY+1;
 if(count<1||count>366)return [];
 return Array.from({length:count},(_,i)=>new Date(Date.parse(start)+i*DAY).toISOString().slice(0,10));
}
export function bucketStart(date:string,group:Grouping){
 if(group==='month')return date.slice(0,7)+'-01';
 const d=new Date(date+'T00:00:00Z');d.setUTCDate(d.getUTCDate()-(d.getUTCDay()+6)%7);return d.toISOString().slice(0,10);
}
function bucketEnd(start:string,group:Grouping){const d=new Date(start+'T00:00:00Z');if(group==='week')d.setUTCDate(d.getUTCDate()+6);else{d.setUTCMonth(d.getUTCMonth()+1);d.setUTCDate(0)}return d.toISOString().slice(0,10)}
export function financialSummary(rows:Performance[],dates:string[],result:ResultMetric){
 const allowed=new Set(dates),selected=rows.filter(r=>allowed.has(r.date)),values=accountValues(selected),reportDays=new Set(selected.map(r=>r.date)).size;
 return {...values,spend:values.spend,revenue:values.revenue,roas:values.roas,results:total(selected,result),resultCost:ratio(values.spend,total(selected,result)),averageDailySpend:ratio(values.spend,reportDays),reportDays,expectedDays:dates.length,rowCount:selected.length,spendRows:selected.filter(r=>Number.isFinite(r.spend)).length,revenueRows:selected.filter(r=>Number.isFinite(r.revenue)).length,roasPercent:values.roas===null?null:values.roas*100};
}
export function periodSeries(rows:Performance[],dates:string[],group:Grouping,result:ResultMetric){
 const buckets=new Map<string,string[]>();for(const date of dates){const key=bucketStart(date,group);buckets.set(key,[...(buckets.get(key)||[]),date])}
 return [...buckets].map(([key,selectedDates])=>{
  const selected=rows.filter(r=>selectedDates.includes(r.date)),summary=financialSummary(selected,selectedDates,result);
  const knownSpend=selected.filter(r=>r.spend!==null),spendingAds=knownSpend.length?new Set(knownSpend.filter(r=>r.spend!>0).map(r=>JSON.stringify([r.account_id,r.ad_id]))).size:null;
  return {key,label:group==='month'?new Date(key+'T00:00:00Z').toLocaleDateString('en-GB',{month:'short',year:'2-digit',timeZone:'UTC'}):key.slice(5),start:selectedDates[0],end:selectedDates.at(-1)!,partialPeriod:selectedDates[0]!==key||selectedDates.at(-1)!==bucketEnd(key,group),...summary,spendingAds,spendCoverageComplete:selected.length>0&&knownSpend.length===selected.length};
 });
}
export function cumulativeSeries(rows:Performance[],dates:string[]){
 let spend=0,revenue=0,spendKnown=true,revenueKnown=true,reportedDates=0;
 return dates.map(date=>{
  const selected=rows.filter(r=>r.date===date);
  // A missing date remains a plotted gap. Subsequent points sum imported rows only.
  if(!selected.length)return {date,spend:null,revenue:null,reportedDates};
  reportedDates++;
  const dailySpend=total(selected,'spend'),dailyRevenue=total(selected,'revenue');
  spendKnown=spendKnown&&dailySpend!==null;revenueKnown=revenueKnown&&dailyRevenue!==null;
  if(dailySpend!==null)spend+=dailySpend;if(dailyRevenue!==null)revenue+=dailyRevenue;
  return {date,spend:spendKnown?spend:null,revenue:revenueKnown?revenue:null,reportedDates};
 });
}
export function rankedAccountAds(rows:Performance[],metric:RankMetric){
 const ascending=['cpa','cpl','linkCpc'].includes(metric);
 const groups=[...new Set(rows.map(r=>r.company_id))].flatMap(company=>groupAccountAds(rows.filter(r=>r.company_id===company))).map(g=>({...g,key:JSON.stringify([g.row.company_id,g.row.account_id,g.row.ad_id]),days:new Set(g.rows.map(r=>r.date)).size}));
 const eligible=groups.filter(g=>g.values[metric]!==null).map(g=>g.values[metric]!);
 return groups.map(g=>{
  const value=g.values[metric],better=value===null?0:eligible.filter(v=>ascending?v<value:v>value).length,ties=value===null?0:eligible.filter(v=>v===value).length;
  const rank=value===null?null:1+better+(ties-1)/2;
  const score=rank===null||metric==='spend'||eligible.length<2?null:100*(eligible.length-rank)/(eligible.length-1);
  return {...g,rank,score,eligible:eligible.length};
 }).sort((a,b)=>(a.rank??Infinity)-(b.rank??Infinity)||a.key.localeCompare(b.key));
}
export function revenueScenario(spendText:string,roasText:string){
 if(!spendText.trim()||!roasText.trim())return null;
 const spend=Number(spendText),roas=Number(roasText),revenue=spend*roas;
 if(!Number.isFinite(spend)||!Number.isFinite(roas)||!Number.isFinite(revenue)||spend<0||roas<0||!Number.isFinite(roas*100))return null;
 return {spend,roas,revenue,percent:spend===0?null:roas*100};
}
