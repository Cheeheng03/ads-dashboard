'use client';
import {Info} from 'lucide-react';
import {Popover,PopoverContent,PopoverTrigger} from '@/components/ui/popover';
import {help,type Explanation} from './business-model';
export function MetricInfo({metric,explanation}:{metric?:string;explanation?:Explanation}){
 const item=explanation||(metric?help[metric]:undefined);if(!item)return null;
 return <Popover><PopoverTrigger asChild><button type="button" className="metric-info" aria-label={`About ${item.title}`}><Info size={14}/></button></PopoverTrigger><PopoverContent className="formula-popover" align="start" aria-label={`${item.title} calculation`}><h3>{item.title}</h3><dl><dt>Calculation</dt><dd>{item.formula}</dd><dt>Source & scope</dt><dd>{item.source}</dd><dt>How to interpret it</dt><dd>{item.limit}</dd></dl></PopoverContent></Popover>;
}
