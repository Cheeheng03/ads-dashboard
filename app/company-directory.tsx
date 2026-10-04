'use client';
import {useEffect,useState} from 'react';
import {Search,Building2,PenLine,Trash2,ExternalLink,Plus} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {type Company,type Workspace} from './model';
import {businessFacts} from './business-model';
import {MetricInfo} from './metric-info';

export function CompanyDirectory({workspace,onOpen,onCompare,onAdd,onEdit,onDelete}:{workspace:Workspace;onOpen:(id:string)=>void;onCompare:(id:string)=>void;onAdd:()=>void;onEdit:(c:Company)=>void;onDelete:(id:string)=>void}){
 const [query,setQuery]=useState(''),[asOf,setAsOf]=useState(()=>Date.now());
 // Refresh the date snapshot when saved evidence is refreshed.
 // eslint-disable-next-line react-hooks/set-state-in-effect
 useEffect(()=>setAsOf(Date.now()),[workspace]);
 const companies=workspace.companies.filter(c=>[c.name,c.domain,c.category,c.market,c.page_id].join(' ').toLowerCase().includes(query.trim().toLowerCase()));
 return <div className="company-directory">
  <div className="directory-search"><Search size={22}/><Input aria-label="Search companies" placeholder="Search companies…" value={query} onChange={e=>setQuery(e.target.value)}/>{query&&<Button variant="ghost" onClick={()=>setQuery('')}>Clear</Button>}</div>
  <div className="directory-results"><span>{companies.length} of {workspace.companies.length} companies</span><span>Saved records · no live collection</span></div>
  {!companies.length?<section className="panel directory-empty"><Building2 size={28}/><h2>{query?'No saved companies match':'Start your company watchlist'}</h2><p>{query?'Try a different name, or add the business to your watchlist.':'Add a business, then save or import its ads to build a report.'}</p><Button onClick={onAdd}><Plus size={16}/>Add company</Button></section>:<div className="directory-grid">{companies.map(c=>{
   const facts=businessFacts(workspace,c.id,30,asOf);
   const reports=(workspace.performance||[]).filter(r=>r.company_id===c.id);
   const last=facts.lastCheck?new Date(facts.lastCheck).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}):'Not checked';
   return <article key={c.id} className="panel directory-card">
    <div className="directory-card-heading"><span className="avatar large">{c.name.slice(0,2).toUpperCase()}</span><div><h2><button onClick={()=>onOpen(c.id)}>{c.name}</button></h2><p>{[c.category,c.market].filter(Boolean).join(' · ')}</p></div><Button variant="ghost" size="icon" aria-label={`Edit ${c.name}`} onClick={()=>onEdit(c)}><PenLine size={16}/></Button></div>
    {c.domain&&<a className="directory-domain" href={c.domain} target="_blank" rel="noreferrer">{c.domain.replace(/^https?:\/\//,'').replace(/\/$/,'')}<ExternalLink size={13}/></a>}
    <div className="directory-metrics"><div><span>Saved ads <MetricInfo metric="saved"/></span><strong>{facts.values.saved}</strong></div><div><span>Active at last check <MetricInfo metric="active"/></span><strong>{facts.values.active}</strong></div><div><span>Oldest ad age <MetricInfo metric="oldestAge"/></span><strong>{facts.values.oldestAge===null?'Unknown':`${facts.values.oldestAge}d`}</strong></div></div>
    <div className="directory-coverage"><span>{facts.ads.length?'Creative report available':'No ads saved yet'}</span><small>{reports.length?`${reports.length} account report rows`:'Public ad records'}</small></div>
    <div className="directory-last-check">Last saved check · {last}</div>
    <div className="directory-actions"><Button onClick={()=>onOpen(c.id)}>View company</Button><Button variant="outline" disabled={workspace.companies.length<2} onClick={()=>onCompare(c.id)}>Compare</Button><Button className="directory-delete" variant="ghost" size="icon" aria-label={`Delete ${c.name}`} onClick={()=>onDelete(c.id)}><Trash2 size={15}/></Button></div>
   </article>
  })}</div>}
 </div>
}
