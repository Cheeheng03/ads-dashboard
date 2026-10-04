import type {Metadata} from 'next';
import PilotAudit, {type Audit} from './pilot-audit';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import audit from '@/docs/research/pilot-data-audit/audit.json';
export const metadata:Metadata={title:'Pilot data audit · Ad Observatory',robots:{index:false,follow:false}};
export const dynamic='force-dynamic';
export default async function Page(){const user=await getChatGPTUser();return <PilotAudit initialData={user?audit as Audit:undefined}/>}
