import type {Ad} from './model';
import {sourceAge} from './business-model';
import {bucketStart,dateWindow,type Grouping} from './spend-model';

/** Counts describe the saved collection, never the advertiser's complete activity. */
export function savedAdCharts(ads:Ad[],from:string,to:string,group:Grouping='week') {
 const dates=dateWindow(from,to);
 if(!dates.length)return {ages:[],starts:[],known:0,unknown:ads.length,started:0};
 const asOf=Date.parse(to+'T00:00:00Z');
 const ages=ads.flatMap(ad=>{
  const age=sourceAge(ad.start_date,asOf);
  return age===null?[]:[{ad,age}];
 }).sort((a,b)=>b.age-a.age||a.ad.id.localeCompare(b.ad.id));
 const starts=[...new Set(dates.map(date=>bucketStart(date,group)))].map(key=>{
  const selected=dates.filter(date=>bucketStart(date,group)===key);
  const records=ages.filter(({ad})=>ad.start_date>=selected[0]&&ad.start_date<=selected[selected.length-1]);
  return {key,from:selected[0],to:selected[selected.length-1],count:records.length,ads:records.map(r=>r.ad)};
 });
 return {ages,starts,known:ages.length,unknown:ads.length-ages.length,started:starts.reduce((n,b)=>n+b.count,0)};
}

export function savedStartCalendar(ads:Ad[],from:string,to:string) {
 const dates=dateWindow(from,to),included=new Set(dates);
 const byDate:Record<string,Ad[]>={};
 for(const {ad} of savedAdCharts(ads,from,to).ages) {
  if(included.has(ad.start_date)) (byDate[ad.start_date]??=[]).push(ad);
 }
 return {dates,months:[...new Set(dates.map(d=>d.slice(0,7)))],byDate};
}
// Calendar widgets use local civil dates; avoid UTC serialization shifting a day.
export function calendarDate(iso:string){const [y,m,d]=iso.split('-').map(Number);return new Date(y,m-1,d||1,12)}
export function calendarDateKey(date:Date){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`}
