import {database} from '@/db/raw';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {z} from 'zod';
import {metrics} from '@/app/analytics-model';
export const dynamic='force-dynamic';
const str=(max=4000)=>z.string().trim().max(max).default('');
const url=z.union([z.literal(''),z.string().url().max(2000).refine(v=>new URL(v).protocol==='https:','Use an https URL')]).default('');
const date=z.union([z.literal(''),z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>!isNaN(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v&&v<=new Date().toISOString().slice(0,10),'Use a valid date no later than today')]).default('');
const num=z.number().finite().nonnegative().nullable().default(null);
const companySchema=z.object({id:z.string().optional(),name:z.string().trim().min(1).max(120),domain:url,page_id:str(80),market:z.string().regex(/^[A-Z]{2}$/).default('MY'),category:str(100),notes:str(10000)});
const adSchema=z.object({id:z.string().optional(),company_id:z.string().min(1),library_id:z.string().trim().max(100).nullable().default(null),title:z.string().trim().min(1).max(200),body:str(20000),format:z.enum(['Image','Video','Carousel','Other']).default('Image'),status:z.enum(['Active','Inactive','Unknown']).default('Unknown'),start_date:date,source_url:url,landing_url:url,image_url:url,market:z.string().regex(/^[A-Z]{2}$/).default('MY'),hook:str(2000),angle:str(300),notes:str(20000),hypothesis:str(10000),board:str(100),pinned:z.number().int().min(0).max(1).default(0),reach:z.number().int().nonnegative().nullable().default(null),spend:num,currency:z.string().regex(/^[A-Z]{3}$/).default('MYR'),metric_source:str(1000),frequency_low:num,frequency_high:num,cpm_low:num,cpm_high:num}).superRefine((v,c)=>{if((v.spend!==null||v.reach!==null)&&!v.metric_source)c.addIssue({code:'custom',message:'Add a source, period and region for the metrics.'});if(v.frequency_low!==null&&v.frequency_high!==null&&v.frequency_low>v.frequency_high)c.addIssue({code:'custom',message:'Low frequency must not exceed high frequency.'});if(v.cpm_low!==null&&v.cpm_high!==null&&v.cpm_low>v.cpm_high)c.addIssue({code:'custom',message:'Low CPM must not exceed high CPM.'});});
function response(data:unknown,status=200){return Response.json(data,{status,headers:{'Cache-Control':'no-store'}})}
export async function GET(){try{const user=await getChatGPTUser();if(!user)return response({error:'Please sign in to access your workspace.'},401);const db=database();const result=await db.batch(['companies','ads','observations','activity','performance'].map(t=>db.prepare(`SELECT * FROM ${t} WHERE owner = ?`).bind(user.userId)));return response({schemaVersion:2,companies:result[0].results,ads:result[1].results,observations:result[2].results,activity:result[3].results,performance:result[4].results});}catch(e){console.error('workspace read',e);return response({error:'Your database could not be loaded. Please retry.'},503)}}
export async function POST(request:Request){try{
 const user=await getChatGPTUser();if(!user)return response({error:'Please sign in to save changes.'},401);
 const origin=request.headers.get('origin');if(origin&&new URL(origin).origin!==new URL(request.url).origin)return response({error:'Invalid request origin.'},403);
 const raw=await request.text();if(raw.length>2000000)return response({error:'Import is too large. Use batches below 2 MB.'},413);
 const input=JSON.parse(raw),db=database(),owner=user.userId,now=new Date().toISOString(),uid=()=>crypto.randomUUID();
 const event=(message:string)=>db.prepare('INSERT INTO activity (id,owner,message,created_at) VALUES (?,?,?,?)').bind(uid(),owner,message,now);
 if(input.action==='performance.delete_scope'){
  const scope=z.object({account_id:z.string().min(1),currency:z.string().regex(/^[A-Z]{3}$/),attribution:z.string().min(1)}).parse(input.scope);
  await db.batch([db.prepare('DELETE FROM performance WHERE owner=? AND account_id=? AND currency=? AND attribution=?').bind(owner,scope.account_id,scope.currency,scope.attribution),event('Removed a performance reporting scope')]);return response({ok:true});
 }
 if(input.action==='performance.import'){
  const schema=z.object({company_id:z.string().min(1),account_id:z.string().min(1).max(100),ad_id:z.string().min(1).max(100),ad_name:z.string().min(1).max(500),date:date.refine(v=>!!v,'A reporting date is required'),currency:z.string().regex(/^[A-Z]{3}$/),attribution:z.string().trim().min(1).max(160),source:z.string().trim().min(1).max(1000),...Object.fromEntries(metrics.map(k=>[k,num]))});
  const rows=z.array(schema).min(1).max(500).parse(input.rows);
  const owned=(await db.prepare('SELECT id FROM companies WHERE owner=?').bind(owner).all()).results;
  const existing=(await db.prepare('SELECT account_id,ad_id,company_id FROM performance WHERE owner=?').bind(owner).all()).results;
  const seen=new Set<string>(),adCompanies=new Map<string,string>(),statements:D1PreparedStatement[]=[];
  for(const row of rows){
   if(!owned.some(c=>c.id===row.company_id))return response({error:'Choose an existing company.'},400);
   if(existing.some(r=>r.account_id===row.account_id&&r.ad_id===row.ad_id&&r.company_id!==row.company_id))return response({error:'This account ad is already assigned to another company.'},409);
   const accountAd=JSON.stringify([row.account_id,row.ad_id]);if(adCompanies.has(accountAd)&&adCompanies.get(accountAd)!==row.company_id)return response({error:'Assign each account ad to one company per import.'},400);adCompanies.set(accountAd,row.company_id);
   const key=JSON.stringify([row.account_id,row.ad_id,row.date,row.currency,row.attribution]);if(seen.has(key))return response({error:'Duplicate daily ad rows. Export without breakdowns.'},400);seen.add(key);
   const fields={...row,imported_at:now},keys=Object.keys(fields),values=Object.values(fields);
   statements.push(db.prepare(`INSERT INTO performance (id,owner,${keys.join(',')}) VALUES (${Array(keys.length+2).fill('?').join(',')}) ON CONFLICT(owner,account_id,ad_id,date,currency,attribution) DO UPDATE SET ${keys.map(k=>`${k}=excluded.${k}`).join(',')}`).bind(uid(),owner,...values));
  }
  await db.batch([...statements,event(`Imported ${rows.length} daily performance rows`)]);return response({ok:true,count:rows.length});
 }
 if(input.action==='company.save'){
  const v=companySchema.parse(input.data);if(v.id){const existing=await db.prepare('SELECT id FROM companies WHERE id=? AND owner=?').bind(v.id,owner).first();if(!existing)return response({error:'Company not found.'},404);}
  const id=v.id||uid();const stmt=v.id?db.prepare('UPDATE companies SET name=?,domain=?,page_id=?,market=?,category=?,notes=? WHERE id=? AND owner=?').bind(v.name,v.domain,v.page_id,v.market,v.category,v.notes,id,owner):db.prepare('INSERT INTO companies (id,owner,name,domain,page_id,market,category,notes,created_at) VALUES (?,?,?,?,?,?,?,?,?)').bind(id,owner,v.name,v.domain,v.page_id,v.market,v.category,v.notes,now);
  await db.batch([stmt,event(`${v.id?'Updated':'Added'} company · ${v.name}`)]);return response({id});
 }
 if(input.action==='company.delete'){
  const id=z.string().parse(input.id);await db.batch([db.prepare('DELETE FROM performance WHERE company_id=? AND owner=?').bind(id,owner),db.prepare('DELETE FROM observations WHERE owner=? AND ad_id IN (SELECT id FROM ads WHERE company_id=? AND owner=?)').bind(owner,id,owner),db.prepare('DELETE FROM ads WHERE company_id=? AND owner=?').bind(id,owner),db.prepare('DELETE FROM companies WHERE id=? AND owner=?').bind(id,owner),event('Removed company and its saved ads')]);return response({ok:true});
 }
 if(input.action==='ad.delete'){
  const id=z.string().parse(input.id);await db.batch([db.prepare('DELETE FROM observations WHERE ad_id=? AND owner=?').bind(id,owner),db.prepare('DELETE FROM ads WHERE id=? AND owner=?').bind(id,owner),event('Removed a saved ad')]);return response({ok:true});
 }
 if(input.action==='ad.pin'){
  const id=z.string().parse(input.id),pin=z.boolean().parse(input.pinned);const ad=await db.prepare('SELECT title FROM ads WHERE id=? AND owner=?').bind(id,owner).first();if(!ad)return response({error:'Ad not found.'},404);
  await db.batch([db.prepare('UPDATE ads SET pinned=? WHERE id=? AND owner=?').bind(pin?1:0,id,owner),event(`${pin?'Pinned':'Unpinned'} · ${ad.title}`)]);return response({ok:true});
 }
 if(input.action==='ad.observe'){
  const id=z.string().parse(input.id),status=z.enum(['Active','Inactive','Unknown']).parse(input.status);if(!await db.prepare('SELECT id FROM ads WHERE id=? AND owner=?').bind(id,owner).first())return response({error:'Ad not found.'},404);
  await db.batch([db.prepare('UPDATE ads SET status=?,last_seen=? WHERE id=? AND owner=?').bind(status,now,id,owner),db.prepare('INSERT INTO observations (id,owner,ad_id,status,observed_at,source) VALUES (?,?,?,?,?,?)').bind(uid(),owner,id,status,now,'Manual check'),event(`Recorded manual check · ${status}`)]);return response({ok:true});
 }
 if(input.action==='ad.save'||input.action==='ads.import'){
  const importing=input.action==='ads.import';const values=importing?z.array(adSchema).min(1).max(200).parse(input.ads):[adSchema.parse(input.data)];
  const companies=(await db.prepare('SELECT id FROM companies WHERE owner=?').bind(owner).all()).results;
  const existing=(await db.prepare('SELECT * FROM ads WHERE owner=?').bind(owner).all()).results;
  const statements:D1PreparedStatement[]=[];let savedId='';const seen=new Set<string>();
  for(const v of values){
   if(!companies.some(c=>c.id===v.company_id))return response({error:'Choose an existing company for every ad.'},400);
   const library=v.library_id||null;if(library&&seen.has(library))return response({error:`Duplicate Library ID in this import: ${library}`},400);if(library)seen.add(library);
   const prev=v.id?existing.find(a=>a.id===v.id):library?existing.find(a=>a.library_id===library):undefined;
   if(v.id&&!prev)return response({error:'Ad not found.'},404);
   if(library&&existing.some(a=>a.library_id===library&&prev?.id!==a.id))return response({error:'That Library ID already exists.'},409);
   if(prev&&prev.company_id!==v.company_id)return response({error:'This Library ID belongs to another tracked company.'},409);
   const id=prev?.id as string||uid();savedId=id;
   const fields={...v,library_id:library};delete fields.id;
   // Imports refresh evidence but preserve the owner’s curation on existing records.
   if(importing&&prev)for(const k of ['notes','hypothesis','board','pinned','hook','angle','frequency_low','frequency_high','cpm_low','cpm_high'] as const)(fields as Record<string,unknown>)[k]=prev[k];
   const keys=Object.keys(fields),vals=Object.values(fields);
   if(prev)statements.push(db.prepare(`UPDATE ads SET ${keys.map(k=>`${k}=?`).join(',')},last_seen=? WHERE id=? AND owner=?`).bind(...vals,importing||prev.status!==v.status?now:prev.last_seen,id,owner));
   else statements.push(db.prepare(`INSERT INTO ads (id,owner,${keys.join(',')},first_seen,last_seen) VALUES (${Array(keys.length+4).fill('?').join(',')})`).bind(id,owner,...vals,now,now));
   if(importing||!prev||prev.status!==v.status)statements.push(db.prepare('INSERT INTO observations (id,owner,ad_id,status,observed_at,source) VALUES (?,?,?,?,?,?)').bind(uid(),owner,id,v.status,now,importing?'Imported snapshot':'Manual entry'));
  }
  statements.push(event(importing?`Imported ${values.length} ad snapshots`:`${values[0].id?'Updated':'Saved'} ad · ${values[0].title}`));await db.batch(statements);return response({ok:true,count:values.length,id:savedId});
 }
 return response({error:'Unknown action.'},400);
 }catch(e){if(e instanceof z.ZodError)return response({error:e.issues.map(i=>i.message).join(' ')},400);if(e instanceof SyntaxError)return response({error:'The file must contain valid JSON.'},400);console.error('workspace write',e);return response({error:'Unable to save. Your input is still available; please retry.'},503)}
}
