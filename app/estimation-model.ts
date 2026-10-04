import {z} from 'zod';
import type {Ad} from './model';
import {dateWindow} from './spend-model';
import {sourceAge} from './business-model';
export type Range={low:number;high:number};
const n=z.number().finite().min(0).max(1e12).nullable();
const day=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s=>Number.isFinite(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s,'Invalid calendar date');
export const evidenceSchema=z.object({ad_id:z.string().min(1),from:day,to:day,source:z.string().trim().min(1).max(1000),scope:z.string().trim().min(1).max(300),currency:z.string().regex(/^[A-Z]{3}$/),impressionsLow:n,impressionsHigh:n,reach:n,paidClicks:n,spend:n,visits:n,conversions:n,engagementStart:n,engagementEnd:n}).superRefine((v,c)=>{
 if(!dateWindow(v.from,v.to).length)c.addIssue({code:'custom',message:'Evidence dates must cover 1–366 days.'});
 if((v.impressionsLow===null)!==(v.impressionsHigh===null)||v.impressionsLow!==null&&v.impressionsLow>v.impressionsHigh!)c.addIssue({code:'custom',message:'Supply both impression bounds, with low no greater than high.'});
 if((v.engagementStart===null)!==(v.engagementEnd===null))c.addIssue({code:'custom',message:'Engagement pace needs both snapshot counts.'});
 if(v.impressionsLow===null&&v.reach===null&&v.paidClicks===null&&v.spend===null&&v.visits===null&&v.conversions===null&&v.engagementStart===null)c.addIssue({code:'custom',message:'Enter at least one observed measure.'});
});
export type AdEvidence=z.infer<typeof evidenceSchema>;
export const assumptionSchema=z.object({dailyLow:n,dailyHigh:n,cpmLow:n,cpmHigh:n,cpcLow:n,cpcHigh:n,frequencyLow:n,frequencyHigh:n,ctrLow:n,ctrHigh:n,benchmarkSource:z.string().trim().max(1000),currency:z.string().regex(/^[A-Z]{3}$/).refine(s=>{try{new Intl.NumberFormat('en',{style:'currency',currency:s});return true}catch{return false}},'Invalid currency')}).superRefine((v,c)=>{
 for(const stem of ['daily','cpm','cpc','frequency','ctr'] as const){const low=v[`${stem}Low`],high=v[`${stem}High`];if((low===null)!==(high===null)||low!==null&&low>high!)c.addIssue({code:'custom',message:`${stem}: enter both bounds, low ≤ high.`});}
 if(v.ctrHigh!==null&&v.ctrHigh>100)c.addIssue({code:'custom',message:'Assumed CTR must be between 0 and 100%.'});
 if(v.frequencyLow!==null&&v.frequencyLow<1)c.addIssue({code:'custom',message:'Frequency must be at least 1.'});
 if(v.cpmLow!==null&&v.cpmLow<=0)c.addIssue({code:'custom',message:'CPM must be greater than zero.'});
});
export type Assumptions=z.infer<typeof assumptionSchema>;
export const analysisSchema=z.object({version:z.literal(1),from:day,to:day,basis:z.enum(['budget','evidence']),assumptions:assumptionSchema,evidence:z.array(evidenceSchema).max(500)}).superRefine((v,c)=>{
 if(!dateWindow(v.from,v.to).length)c.addIssue({code:'custom',message:'Choose a window of 1–366 days.'});
 const keys=v.evidence.map(e=>e.ad_id);if(new Set(keys).size!==keys.length)c.addIssue({code:'custom',message:'Save one current evidence record per ad.'});
});
export type AnalysisModel=z.infer<typeof analysisSchema>;
export type SavedAnalysis={company_id:string;model:AnalysisModel;updated_at:string};
export const illustrativeAssumptions:Assumptions={dailyLow:100,dailyHigh:300,cpmLow:10,cpmHigh:20,cpcLow:.5,cpcHigh:2,frequencyLow:1.5,frequencyHigh:3,ctrLow:.5,ctrHigh:2,benchmarkSource:'Illustrative inputs only — not Malaysian market benchmarks',currency:'MYR'};
export const blankEvidence=(ad_id:string,from:string,to:string,currency='MYR'):AdEvidence=>({ad_id,from,to,source:'',scope:'',currency,impressionsLow:null,impressionsHigh:null,reach:null,paidClicks:null,spend:null,visits:null,conversions:null,engagementStart:null,engagementEnd:null});
export const range=(low:number|null,high:number|null):Range|null=>low===null||high===null||!Number.isFinite(low)||!Number.isFinite(high)||low<0||high<low?null:{low,high};
const multiply=(a:Range|null,b:Range|null,scale=1)=>a&&b?range(a.low*b.low/scale,a.high*b.high/scale):null;
const divide=(a:Range|null,b:Range|null,scale=1)=>a&&b&&b.low>0?range(a.low/b.high*scale,a.high/b.low*scale):null;
export function evidenceEstimate(e:AdEvidence|null,a:Assumptions){
 const cpm=range(a.cpmLow,a.cpmHigh),frequency=range(a.frequencyLow,a.frequencyHigh),cpc=range(a.cpcLow,a.cpcHigh);
 const impressions=e?range(e.impressionsLow,e.impressionsHigh):null;
 const inferredImpressions=impressions??(e?.reach!==null&&e?.reach!==undefined?multiply(range(e.reach,e.reach),frequency):null);
 const options=[{method:'Reported spend',value:e?.spend!==null&&e?.spend!==undefined?range(e.spend,e.spend):null},{method:'Impressions × CPM',value:multiply(impressions,cpm,1000)},{method:'Reach × frequency × CPM',value:e?.reach!==null&&e?.reach!==undefined?multiply(multiply(range(e.reach,e.reach),frequency),cpm,1000):null},{method:'Paid clicks × CPC',value:e?.paidClicks!==null&&e?.paidClicks!==undefined?multiply(range(e.paidClicks,e.paidClicks),cpc):null}];
 const chosen=options.find(o=>o.value!==null);
 return {options,spend:chosen?.value??null,method:chosen?.method??'Needs delivery evidence',impressions:inferredImpressions,reported:chosen?.method==='Reported spend'};
}
export function measuredPerformance(e:AdEvidence|null){
 const impressions=e?.impressionsLow!==null&&e?.impressionsLow===e?.impressionsHigh?e?.impressionsLow??null:null;
 const ratio=(num:number|null|undefined,den:number|null|undefined,scale=1)=>num!==null&&num!==undefined&&den!==null&&den!==undefined&&den>0?num/den*scale:null;
 const elapsed=e?(Date.parse(e.to)-Date.parse(e.from))/86400000:0;
 const engagementDelta=e&&e.engagementStart!==null&&e.engagementEnd!==null?e.engagementEnd-e.engagementStart:null;
 return {ctr:ratio(e?.paidClicks,impressions,100),cpc:ratio(e?.spend,e?.paidClicks),cpa:ratio(e?.spend,e?.conversions),cvr:ratio(e?.conversions,e?.visits,100),engagementPerDay:elapsed>0&&engagementDelta!==null?engagementDelta/elapsed:null,engagementDelta};
}
export function analyzeAds(ads:Ad[],model:AnalysisModel){
 const dates=dateWindow(model.from,model.to),a=model.assumptions,daily=range(a.dailyLow,a.dailyHigh);
 const allocations=new Map<string,{spend:Range;days:number}>();let cumulativeLow=0,cumulativeHigh=0;
 // Explicit scenario: fully spent shared daily pool; equal shares among last-observed-active saved ads whose valid source start is on/before that date.
 const timeline=dates.map(date=>{
  const eligible=ads.filter(ad=>ad.status==='Active'&&sourceAge(ad.start_date,Date.parse(date+'T12:00:00Z'))!==null);
  const value=daily&&eligible.length?daily:null;
  if(value){cumulativeLow+=value.low;cumulativeHigh+=value.high;for(const ad of eligible){const prev=allocations.get(ad.id)||{spend:{low:0,high:0},days:0};allocations.set(ad.id,{spend:{low:prev.spend.low+value.low/eligible.length,high:prev.spend.high+value.high/eligible.length},days:prev.days+1});}}
  return {date,low:value?.low??null,high:value?.high??null,cumulativeLow:value?cumulativeLow:null,cumulativeHigh:value?cumulativeHigh:null,eligible:eligible.length};
 });
 const rows=ads.map(ad=>{
  const stored=model.evidence.find(e=>e.ad_id===ad.id),e=stored&&stored.from===model.from&&stored.to===model.to&&stored.currency===a.currency?stored:null;
  const estimate=evidenceEstimate(e,a),allocation=allocations.get(ad.id),spend=model.basis==='budget'?allocation?.spend??null:estimate.spend;
  const impressions=model.basis==='budget'?divide(spend,range(a.cpmLow,a.cpmHigh),1000):estimate.impressions;
  const modeledClicks=multiply(impressions,range(a.ctrLow,a.ctrHigh),100);
  const actual=measuredPerformance(e);
  return {ad,e,stored,spend,impressions,modeledClicks,actual,method:model.basis==='budget'?'Shared budget scenario':estimate.method,reported:model.basis==='evidence'&&estimate.reported,options:estimate.options,assumedDays:allocation?.days??null,age:sourceAge(ad.start_date,Date.parse(model.to+'T12:00:00Z')),dailyAverage:spend&&dates.length?{low:spend.low/dates.length,high:spend.high/dates.length}:null};
 });
 const withSpend=rows.filter(r=>r.spend!==null);
 const total=withSpend.length?withSpend.reduce((acc,r)=>({low:acc.low+r.spend!.low,high:acc.high+r.spend!.high}),{low:0,high:0}):null;
 // Evidence for different geography / attribution scopes must not be summed into one business figure.
 const evidenceScopes=new Set(withSpend.flatMap(r=>r.e?[r.e.scope]:[]));
 const compatible=model.basis==='budget'||evidenceScopes.size<=1;
 return {rows,dates,timeline,total:compatible?total:null,compatible,coverage:withSpend.length,average:compatible&&total&&dates.length?{low:total.low/dates.length,high:total.high/dates.length}:null};
}
