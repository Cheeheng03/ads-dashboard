import {getChatGPTUser} from '@/app/chatgpt-auth';
import audit from '@/docs/research/pilot-data-audit/audit.json';

export const dynamic='force-dynamic';
export async function GET(){
  if(!await getChatGPTUser())return Response.json({error:'Sign in to view the pilot audit.'},{status:401,headers:{'Cache-Control':'no-store'}});
  return Response.json(audit,{headers:{'Cache-Control':'private, no-store'}});
}
