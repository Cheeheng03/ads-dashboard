'use client';
import {createContext,useContext,useState,type ComponentProps} from 'react';
import {ExternalLink} from 'lucide-react';
import {Calendar,CalendarDayButton} from '@/components/ui/calendar';
import {MetricInfo} from './metric-info';
import {adSource} from './ad-creative';
import {type Ad,money} from './model';
import type {analyzeAds} from './estimation-model';
import {savedStartCalendar,calendarDate,calendarDateKey,type savedAdCharts} from './ad-chart-model';

type Result=ReturnType<typeof analyzeAds>;
type SavedCharts=ReturnType<typeof savedAdCharts>;
const day=(date:string)=>calendarDate(date).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});
const number=(n:number)=>n.toLocaleString('en-MY',{maximumFractionDigits:1});
const CalendarAds=createContext<Record<string,Ad[]>>({});
function StartDayButton({day:cell,modifiers,...props}:ComponentProps<typeof CalendarDayButton>){
 const ads=useContext(CalendarAds)[calendarDateKey(cell.date)]||[];
 return <CalendarDayButton {...props} day={cell} modifiers={modifiers} className="start-calendar-day" aria-label={`${props['aria-label']||day(calendarDateKey(cell.date))}, ${ads.length} saved ad starts`} data-has-starts={ads.length>0}>
  <span className="calendar-day-number">{cell.date.getDate()}</span>{ads.length>0&&<span className="calendar-start-count">{ads.length} {ads.length===1?'ad':'ads'}</span>}
 </CalendarDayButton>;
}
function AdLabel({ad,onOpenAd}:{ad:Ad;onOpenAd:(id:string)=>void}){
 const source=adSource(ad);
 return <div className="chart-ad-link"><button title={ad.title} onClick={()=>onOpenAd(ad.id)}>{ad.title}</button>{source&&<a href={source} target="_blank" rel="noreferrer" aria-label={`Open ${ad.title} on Meta`} title="Open original ad on Meta"><ExternalLink size={14}/></a>}</div>;
}
function Axis({max,unit}:{max:number;unit:string}){
 return <div className="ad-bar-axis" aria-hidden="true"><span>0</span><span>{number(max/2)}</span><span>{number(max)} {unit}</span></div>;
}
export function AdReportCharts({result,saved,currency,isBudget,ageMax,spendMax,calendarMonth,onCalendarMonth,onOpenAd}:{result:Result;saved:SavedCharts;currency:string;isBudget:boolean;ageMax:number;spendMax:number;calendarMonth:string;onCalendarMonth:(month:string)=>void;onOpenAd:(id:string)=>void}) {
 const [allAges,setAllAges]=useState(false),[allSpend,setAllSpend]=useState(false),[selectedDate,setSelectedDate]=useState('');
 const spending=result.rows.filter(r=>r.spend!==null).sort((a,b)=>b.spend!.high-a.spend!.high||a.ad.id.localeCompare(b.ad.id));
 const ageRows=allAges?saved.ages:saved.ages.slice(0,6),spendRows=allSpend?spending:spending.slice(0,6);
 const ageScale=Math.max(1,Math.ceil(ageMax)),spendScale=Math.max(1,Math.ceil(spendMax));
 const from=result.dates[0],to=result.dates.at(-1)!;
 const calendar=savedStartCalendar(result.rows.map(r=>r.ad),from,to);
 const month=calendar.months.includes(calendarMonth)?calendarMonth:calendar.months[0];
 const visibleDates=calendar.dates.filter(date=>date.startsWith(month));
 const chosen=visibleDates.includes(selectedDate)?selectedDate:visibleDates.find(date=>calendar.byDate[date]?.length)||visibleDates[0];
 const dayAds=calendar.byDate[chosen]||[],monthCount=visibleDates.reduce((sum,date)=>sum+(calendar.byDate[date]?.length||0),0);
 return <>
 <section className="report-chart-card">
  <header><div><h3>{isBudget?'Budget allocation by ad':'Spend by ad'}</h3><p>{isBudget?'Hypothetical selected-window allocation':'Source-based selected-window amounts'} · {currency}</p></div><MetricInfo explanation={{title:'Selected-window ad spending',formula:isBudget?'Divide each assumed daily budget equally among eligible saved ads, then add each ad’s shares within the selected window. Show the low and high results.':'Use supplied spend, otherwise impressions × CPM / 1,000; reach × frequency × CPM / 1,000; or paid clicks × CPC. Use the first available method per ad, never sum alternatives.',source:isBudget?'Your assumed daily pool and the current saved Active status and start dates.':'Evidence matching the selected dates and currency, plus any required assumptions.',limit:isBudget?'Past delivery is unknown. Current status cannot reconstruct past budgets, paused ads or missing creatives. These allocations are a what-if scenario, not cumulative historical spend.':'The collection may be incomplete. Scope and estimation method can differ between ads; see each row. Mixed scopes are not added to a company total.'}}/></header>
  <div className={`ad-bar-chart ${isBudget?'scenario-bars':''}`}>
   {spending.length?<><Axis max={spendScale} unit={currency}/>{spendRows.map(r=><div className="ad-bar-row" key={r.ad.id}>
    <AdLabel ad={r.ad} onOpenAd={onOpenAd}/>
    <div className="ad-bar-value"><span>{isBudget?'Scenario':r.reported?'Supplied spend':'Estimate'}</span><strong>{r.spend!.low===r.spend!.high?money(r.spend!.low,currency,0):`${money(r.spend!.low,currency,0)} – ${money(r.spend!.high,currency,0)}`}</strong></div>
    <div className="ad-bar-track" aria-hidden="true"><span className="ad-bar-fill range-base" style={{width:`${r.spend!.low/spendScale*100}%`}}/><span className="ad-bar-range" style={{left:`${r.spend!.low/spendScale*100}%`,width:`${(r.spend!.high-r.spend!.low)/spendScale*100}%`}}/><i className="ad-bar-cap" style={{left:`${r.spend!.high/spendScale*100}%`}}/></div>
    {!isBudget&&<small className="ad-bar-source">{r.method} · {r.e?.scope}</small>}
   </div>)}</>:<p className="report-chart-empty">{isBudget?'No eligible allocation. Check saved ad dates and budget assumptions.':'Add matching spend or delivery evidence to an ad to plot its amount.'}</p>}
  </div>
  <footer><span>{isBudget?'Assumptions only. ':''}Solid bar = lower bound; pale extension = upper bound. Sorted by upper bound.</span>{spending.length>6&&<button onClick={()=>setAllSpend(v=>!v)}>{allSpend?'Show top 6':`Show all ${spending.length}`}</button>}</footer>
 </section>
 <section className="report-chart-card">
  <header><div><h3>Ad age comparison</h3><p>Days since source start · as of {day(to)}</p></div><MetricInfo metric="sourceAge"/></header>
  <div className="ad-bar-chart">
   {saved.ages.length?<><Axis max={ageScale} unit="days"/>{ageRows.map(({ad,age})=><div className="ad-bar-row" key={ad.id}>
    <AdLabel ad={ad} onOpenAd={onOpenAd}/><div className="ad-bar-value"><span>{ad.status} at last check</span><strong>{number(age)} {age===1?'day':'days'}</strong></div>
    <div className="ad-bar-track" aria-hidden="true"><span className="ad-bar-fill" style={{width:`${age/ageScale*100}%`}}/></div>
   </div>)}</>:<p className="report-chart-empty">Save valid source start dates to compare ad age.</p>}
  </div>
  <footer><span>Calendar age, not verified paid runtime.{saved.unknown?` ${saved.unknown} missing, invalid or later start dates excluded.`:''}</span>{saved.ages.length>6&&<button onClick={()=>setAllAges(v=>!v)}>{allAges?'Show top 6':`Show all ${saved.ages.length}`}</button>}</footer>
 </section>
 <section className="report-chart-card report-calendar-card">
  <header><div><h3>Ad start calendar</h3><p>{monthCount} saved ad starts this month within the selected window</p></div><MetricInfo explanation={{title:'Ad start calendar',formula:'Place each saved ad on its valid source start date. The badge counts records on that date. Only dates inside the selected report window can be selected.',source:'Saved source start dates, including all statuses. This is not the date the ad was added to your database.',limit:'No badge means no saved starts on that date, not proof that the company launched no ads. A start date alone says nothing about subsequent delivery or performance.'}}/></header>
  <div className="start-calendar-layout">
   <CalendarAds.Provider value={calendar.byDate}><Calendar className="start-calendar" mode="single" required weekStartsOn={1} showOutsideDays={false} fixedWeeks month={calendarDate(month+'-01')} onMonthChange={date=>onCalendarMonth(calendarDateKey(date).slice(0,7))} startMonth={calendarDate(from)} endMonth={calendarDate(to)} selected={calendarDate(chosen)} onSelect={date=>date&&setSelectedDate(calendarDateKey(date))} disabled={[{before:calendarDate(from)},{after:calendarDate(to)}]} components={{DayButton:StartDayButton}}/></CalendarAds.Provider>
   <div className="calendar-ad-list" aria-live="polite"><div><h4>{day(chosen)}</h4><p>{dayAds.length} saved {dayAds.length===1?'ad':'ads'} started</p></div>{dayAds.length?dayAds.map(ad=><div className="calendar-ad-item" key={ad.id}><AdLabel ad={ad} onOpenAd={onOpenAd}/><small>{ad.format} · {ad.status} at last check</small></div>):<p className="calendar-empty">No saved ads with a source start on this date.</p>}</div>
  </div>
  <footer><span>Select a date to open its ads. Dates outside the report window are disabled.</span></footer>
 </section>
 </>;
}
