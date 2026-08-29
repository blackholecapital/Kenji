const GHL_BASE="https://services.leadconnectorhq.com";
const GHL_ED25519_SPKI_B64="MCowBQYDK2VwAyEAi2HR1srL4o18O8BRa7gVJY7G7bupbN3H9AwJrHCDiOg=";
const LOCAL_STAGES=new Set(["New","Attempted","Contacted","Qualified","Booked","Won","Nurture","Lost"]);

function json(data,status=200){return new Response(JSON.stringify(data,null,2),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store"}});}
function clean(v="",max=4000){return String(v??"").trim().slice(0,max);}
function now(){return Date.now();}
function id(prefix){return `${prefix}_${crypto.randomUUID()}`;}
function parseJson(v,fallback={}){try{return JSON.parse(v||"");}catch{return fallback;}}
function b64Bytes(value=""){const raw=atob(String(value));const out=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)out[i]=raw.charCodeAt(i);return out;}
async function digest(value){return new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(String(value))));}
async function sameSecret(a,b){const [x,y]=await Promise.all([digest(a),digest(b)]);let d=x.length^y.length;for(let i=0;i<Math.max(x.length,y.length);i++)d|=(x[i]??0)^(y[i]??0);return d===0;}
async function internalAuthorized(request,env){const expected=clean(env.INTERNAL_CALL_SECRET,1000),given=request.headers.get("x-internal-call-secret")||"";return Boolean(expected&&given&&await sameSecret(expected,given));}

async function verifyGhlWebhook(raw,request){
  const signature=clean(request.headers.get("x-ghl-signature"),2000);
  if(!signature)return {ok:false,error:"Missing X-GHL-Signature"};
  try{
    const key=await crypto.subtle.importKey("spki",b64Bytes(GHL_ED25519_SPKI_B64),{name:"Ed25519"},false,["verify"]);
    const ok=await crypto.subtle.verify({name:"Ed25519"},key,b64Bytes(signature),new TextEncoder().encode(raw));
    return ok?{ok:true}:{ok:false,error:"Invalid HighLevel signature"};
  }catch(error){return {ok:false,error:`HighLevel signature verification failed: ${error?.message||error}`};}
}

function ghlHeaders(env,version="v3"){
  const token=clean(env.HIGHLEVEL_PRIVATE_TOKEN,4000);
  if(!token)throw new Error("HIGHLEVEL_PRIVATE_TOKEN is not configured on kenji-highlevel-worker");
  return {accept:"application/json","content-type":"application/json",authorization:`Bearer ${token}`,Version:version};
}
async function ghl(env,path,{method="GET",body,version="v3"}={}){
  const response=await fetch(`${GHL_BASE}${path}`,{method,headers:ghlHeaders(env,version),body:body===undefined?undefined:JSON.stringify(body)});
  const text=await response.text();let data={};try{data=text?JSON.parse(text):{};}catch{data={raw:text};}
  if(!response.ok)throw new Error(data?.message||data?.error||`HighLevel ${method} ${path} failed (${response.status})`);
  return data;
}

function locationFromRow(row){return row?{locationId:row.location_id,name:row.name,businessId:row.business_id,pipelineId:row.pipeline_id,noteUserId:row.note_user_id,stageMap:parseJson(row.stage_map_json,{}),enabled:Boolean(row.enabled),lastPullAt:row.last_pull_at,createdAt:row.created_at,updatedAt:row.updated_at}:null;}
async function getLocation(env,locationId){return locationFromRow(await env.DB.prepare(`SELECT * FROM highlevel_locations WHERE location_id=?`).bind(locationId).first());}
async function listLocations(env){const rs=await env.DB.prepare(`SELECT * FROM highlevel_locations ORDER BY name COLLATE NOCASE, location_id`).all();return rs.results.map(locationFromRow);}
async function saveLocation(env,input={}){
  const locationId=clean(input.locationId||input.location_id,160);if(!locationId)throw new Error("HighLevel locationId is required");
  const existing=await getLocation(env,locationId),t=now();
  const name=clean(input.name||existing?.name||locationId,200),businessId=clean(input.businessId??existing?.businessId,160),pipelineId=clean(input.pipelineId??existing?.pipelineId,160),noteUserId=clean(input.noteUserId??existing?.noteUserId,160);
  const stageMap=input.stageMap&&typeof input.stageMap==="object"?input.stageMap:(existing?.stageMap||{}),enabled=input.enabled===undefined?(existing?.enabled??true):Boolean(input.enabled);
  await env.DB.prepare(`INSERT INTO highlevel_locations(location_id,name,business_id,pipeline_id,note_user_id,stage_map_json,enabled,created_at,updated_at) VALUES(?,?,?,?,?,?,?, ?,?) ON CONFLICT(location_id) DO UPDATE SET name=excluded.name,business_id=excluded.business_id,pipeline_id=excluded.pipeline_id,note_user_id=excluded.note_user_id,stage_map_json=excluded.stage_map_json,enabled=excluded.enabled,updated_at=excluded.updated_at`).bind(locationId,name,businessId,pipelineId,noteUserId,JSON.stringify(stageMap),enabled?1:0,existing?.createdAt||t,t).run();
  return getLocation(env,locationId);
}

function contactData(contact={}){
  return {id:clean(contact.id,160),locationId:clean(contact.locationId,160),firstName:clean(contact.firstName||contact.first_name,120),lastName:clean(contact.lastName||contact.last_name,120),phone:clean(contact.phone,60),email:clean(contact.email,320).toLowerCase(),company:clean(contact.companyName||contact.company,200),source:clean(contact.source||"HighLevel",160)||"HighLevel",tags:Array.isArray(contact.tags)?contact.tags.map(x=>clean(x,80)).filter(Boolean).slice(0,30):[],dnd:Boolean(contact.dnd)};
}
async function linkForContact(env,locationId,contactId){return env.DB.prepare(`SELECT hl.*,l.* FROM highlevel_links hl JOIN leads l ON l.id=hl.lead_id WHERE hl.location_id=? AND hl.contact_id=? LIMIT 1`).bind(locationId,contactId).first();}
async function leadByIdentity(env,phone,email){return env.DB.prepare(`SELECT * FROM leads WHERE (phone<>'' AND phone=?) OR (email<>'' AND email=?) ORDER BY updated_at DESC LIMIT 1`).bind(phone,email).first();}
async function event(env,leadId,type,text,data={}){await env.DB.prepare(`INSERT INTO lead_events(id,lead_id,type,actor,text,data_json,created_at) VALUES(?,?,?,?,?,?,?)`).bind(id("evt"),leadId||null,type,"highlevel-worker",clean(text,3000),JSON.stringify(data),now()).run();}

async function upsertContact(env,rawContact={},locationHint=""){
  const c=contactData(rawContact),locationId=c.locationId||clean(locationHint,160);if(!locationId)throw new Error("HighLevel contact payload has no locationId");
  let loc=await getLocation(env,locationId);if(!loc)loc=await saveLocation(env,{locationId,name:`HighLevel ${locationId.slice(0,8)}`});
  let linked=c.id?await linkForContact(env,locationId,c.id):null;
  let lead=linked||await leadByIdentity(env,c.phone,c.email),leadId=lead?.lead_id||lead?.id,t=now();
  if(!leadId){
    if(!c.phone&&!c.email)throw new Error("HighLevel contact has no phone or email and cannot create a Kenji lead");
    leadId=id("lead");
    await env.DB.prepare(`INSERT INTO leads(id,first_name,last_name,phone,email,company,source,source_account,stage,score,assigned_to,tags_json,notes,contactable,dnc,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?, 'New',50,'',?,'',?,?,?,?)`).bind(leadId,c.firstName,c.lastName,c.phone,c.email,c.company,c.source,loc.name||locationId,JSON.stringify(c.tags),c.dnd?0:1,c.dnd?1:0,t,t).run();
    await event(env,leadId,"highlevel.contact.created","HighLevel contact entered Kenji pipeline",{locationId,contactId:c.id});
  }else{
    const previous=await env.DB.prepare(`SELECT * FROM leads WHERE id=?`).bind(leadId).first();
    await env.DB.prepare(`UPDATE leads SET first_name=?,last_name=?,phone=?,email=?,company=?,source=?,source_account=?,tags_json=?,contactable=?,dnc=?,updated_at=? WHERE id=?`).bind(c.firstName||previous.first_name,c.lastName||previous.last_name,c.phone||previous.phone,c.email||previous.email,c.company||previous.company,c.source||previous.source,loc.name||locationId,c.tags.length?JSON.stringify(c.tags):previous.tags_json,c.dnd?0:previous.contactable,c.dnd?1:previous.dnc,t,leadId).run();
    await event(env,leadId,"highlevel.contact.updated","HighLevel contact refreshed",{locationId,contactId:c.id});
  }
  if(c.id){
    await env.DB.prepare(`INSERT INTO highlevel_links(lead_id,location_id,contact_id,sync_state,last_synced_at,created_at,updated_at) VALUES(?,?,?,'linked',?,?,?) ON CONFLICT(lead_id) DO UPDATE SET location_id=excluded.location_id,contact_id=excluded.contact_id,sync_state='linked',last_synced_at=excluded.last_synced_at,updated_at=excluded.updated_at`).bind(leadId,locationId,c.id,t,t,t).run();
  }
  return env.DB.prepare(`SELECT * FROM leads WHERE id=?`).bind(leadId).first();
}

function stageFromOpportunity(loc,opp={}){
  const map=loc?.stageMap||{},mapped=clean(map[opp.pipelineStageId],40);if(LOCAL_STAGES.has(mapped))return mapped;
  const status=clean(opp.status,40).toLowerCase();if(status==="won")return "Won";if(["lost","abandoned"].includes(status))return "Lost";return "";
}
async function applyOpportunity(env,opp={},locationHint=""){
  const locationId=clean(opp.locationId||locationHint,160),contactId=clean(opp.contactId,160);if(!locationId||!contactId)throw new Error("HighLevel opportunity needs locationId and contactId");
  let loc=await getLocation(env,locationId);if(!loc)loc=await saveLocation(env,{locationId,name:`HighLevel ${locationId.slice(0,8)}`,pipelineId:opp.pipelineId||""});
  let link=await env.DB.prepare(`SELECT * FROM highlevel_links WHERE location_id=? AND contact_id=? LIMIT 1`).bind(locationId,contactId).first();
  if(!link){
    try{const detail=await ghl(env,`/contacts/${encodeURIComponent(contactId)}`);await upsertContact(env,detail.contact||detail,locationId);}catch{}
    link=await env.DB.prepare(`SELECT * FROM highlevel_links WHERE location_id=? AND contact_id=? LIMIT 1`).bind(locationId,contactId).first();
  }
  if(!link)return {linked:false};
  const t=now(),stage=stageFromOpportunity(loc,opp);
  await env.DB.prepare(`UPDATE highlevel_links SET opportunity_id=?,pipeline_id=?,stage_id=?,last_synced_at=?,updated_at=? WHERE lead_id=?`).bind(clean(opp.id,160),clean(opp.pipelineId,160),clean(opp.pipelineStageId,160),t,t,link.lead_id).run();
  if(stage)await env.DB.prepare(`UPDATE leads SET stage=?,updated_at=? WHERE id=?`).bind(stage,t,link.lead_id).run();
  await event(env,link.lead_id,"highlevel.opportunity.updated","HighLevel opportunity synchronized",{locationId,opportunityId:opp.id,pipelineId:opp.pipelineId,pipelineStageId:opp.pipelineStageId,status:opp.status,localStage:stage||undefined});
  return {linked:true,leadId:link.lead_id,stage};
}

async function recordWebhook(env,payload,raw){
  const webhookId=clean(payload.webhookId||payload.webhook_id||`${payload.type||"event"}:${payload.locationId||""}:${payload.id||payload.contactId||""}:${payload.timestamp||""}`,240);
  const existing=await env.DB.prepare(`SELECT webhook_id FROM highlevel_webhooks WHERE webhook_id=?`).bind(webhookId).first();if(existing)return {duplicate:true,webhookId};
  await env.DB.prepare(`INSERT INTO highlevel_webhooks(webhook_id,event_type,location_id,external_id,status,payload_json,received_at) VALUES(?,?,?,?, 'accepted',?,?)`).bind(webhookId,clean(payload.type||"Unknown",100),clean(payload.locationId,160),clean(payload.id||payload.contactId,160),raw.slice(0,50000),now()).run();return {duplicate:false,webhookId};
}
async function processWebhook(env,payload={}){
  const type=clean(payload.type,120);
  if(/^Contact(Create|Update)$/i.test(type)){const lead=await upsertContact(env,payload,payload.locationId);return {type,leadId:lead.id};}
  if(/^Opportunity(Create|Update|StatusUpdate|StageUpdate)$/i.test(type)){const result=await applyOpportunity(env,payload,payload.locationId);return {type,...result};}
  return {type,ignored:true};
}

async function pullLocation(env,locationId){
  const loc=await getLocation(env,locationId);if(!loc)throw new Error("Configure this HighLevel location first");if(!loc.enabled)throw new Error("This HighLevel location is disabled");
  let contacts=[];
  const contactSearch=await ghl(env,"/contacts/search",{method:"POST",version:"2021-07-28",body:{locationId,page:1,pageLimit:100}});
  contacts=Array.isArray(contactSearch.contacts)?contactSearch.contacts:[];
  let imported=0;for(const contact of contacts){try{await upsertContact(env,contact,locationId);imported++;}catch(error){console.error("HighLevel contact import failed",contact?.id,error?.message||error);}}
  let opportunities=[];
  try{const params=new URLSearchParams({locationId,status:"all",limit:"100",page:"1"});if(loc.pipelineId)params.set("pipelineId",loc.pipelineId);const data=await ghl(env,`/opportunities/search?${params.toString()}`);opportunities=Array.isArray(data.opportunities)?data.opportunities:[];for(const opp of opportunities){try{await applyOpportunity(env,opp,locationId);}catch(error){console.error("HighLevel opportunity import failed",opp?.id,error?.message||error);}}}catch(error){console.warn("HighLevel opportunity pull skipped",error?.message||error);}
  await env.DB.prepare(`UPDATE highlevel_locations SET last_pull_at=?,updated_at=? WHERE location_id=?`).bind(now(),now(),locationId).run();
  return {ok:true,locationId,contactsSeen:contacts.length,contactsImported:imported,opportunitiesSeen:opportunities.length};
}

function reverseStageMap(loc,localStage){for(const [external,local] of Object.entries(loc?.stageMap||{}))if(local===localStage)return external;return "";}
async function createWriteback(env,{leadId,callId="",locationId,contactId,opportunityId="",action,requestData={}}){const writebackId=id("wb"),t=now();await env.DB.prepare(`INSERT INTO highlevel_writebacks(id,lead_id,call_id,location_id,contact_id,opportunity_id,action,status,request_json,created_at,updated_at) VALUES(?,?,?,?,?,?,?,'pending',?,?,?)`).bind(writebackId,leadId||null,callId||null,locationId||"",contactId||"",opportunityId||"",action,JSON.stringify(requestData),t,t).run();return writebackId;}
async function finishWriteback(env,writebackId,status,response={},error=""){await env.DB.prepare(`UPDATE highlevel_writebacks SET status=?,response_json=?,error=?,updated_at=? WHERE id=?`).bind(status,JSON.stringify(response||{}),clean(error,3000),now(),writebackId).run();}
async function writeCallOutcome(env,row){
  const loc=await getLocation(env,row.location_id);if(!loc||!row.contact_id)return {skipped:true,reason:"unlinked"};
  const requestData={callId:row.call_id,leadId:row.lead_id,stage:row.stage,callStatus:row.call_status,durationSeconds:row.duration_seconds};const writebackId=await createWriteback(env,{leadId:row.lead_id,callId:row.call_id,locationId:row.location_id,contactId:row.contact_id,opportunityId:row.opportunity_id,action:"call-outcome",requestData});
  try{
    const results={};
    const noteBody=[`Kenji AI call: ${row.call_status}.`,row.duration_seconds?`Duration: ${row.duration_seconds}s.`:"",row.transcript?`Transcript:\n${String(row.transcript).slice(-5000)}`:""].filter(Boolean).join("\n");
    if(noteBody){const body={body:noteBody,title:"Kenji AI call follow-up",pinned:false};if(loc.noteUserId)body.userId=loc.noteUserId;results.note=await ghl(env,`/contacts/${encodeURIComponent(row.contact_id)}/notes`,{method:"POST",body});}
    if(row.opportunity_id){const pipelineStageId=reverseStageMap(loc,row.stage);const body={};if(loc.pipelineId||row.pipeline_id)body.pipelineId=loc.pipelineId||row.pipeline_id;if(pipelineStageId)body.pipelineStageId=pipelineStageId;if(row.stage==="Won")body.status="won";else if(row.stage==="Lost")body.status="lost";else body.status="open";results.opportunity=await ghl(env,`/opportunities/${encodeURIComponent(row.opportunity_id)}`,{method:"PUT",body});}
    await finishWriteback(env,writebackId,"sent",results);await event(env,row.lead_id,"highlevel.writeback.sent","AI call outcome written back to HighLevel",{callId:row.call_id,locationId:row.location_id,writebackId});return {ok:true,writebackId};
  }catch(error){await finishWriteback(env,writebackId,"failed",{},error?.message||String(error));return {ok:false,writebackId,error:error?.message||String(error)};}
}
async function flushCallWritebacks(env,limit=20){
  if(!clean(env.HIGHLEVEL_PRIVATE_TOKEN,4000))return {skipped:true,reason:"token-not-configured"};
  const rs=await env.DB.prepare(`SELECT c.id call_id,c.lead_id,c.status call_status,c.duration_seconds,c.transcript,l.stage,hl.location_id,hl.contact_id,hl.opportunity_id,hl.pipeline_id FROM calls c JOIN leads l ON l.id=c.lead_id JOIN highlevel_links hl ON hl.lead_id=c.lead_id LEFT JOIN highlevel_writebacks wb ON wb.call_id=c.id AND wb.action='call-outcome' AND wb.status IN ('pending','sent') WHERE c.status IN ('completed','busy','failed','no-answer','canceled') AND wb.id IS NULL ORDER BY c.updated_at ASC LIMIT ?`).bind(limit).all();
  const results=[];for(const row of rs.results)results.push(await writeCallOutcome(env,row));return {processed:results.length,results};
}

async function agencySummary(env){
  const rs=await env.DB.prepare(`SELECT h.location_id,h.name,h.enabled,h.last_pull_at,COUNT(hl.lead_id) linked_leads,SUM(CASE WHEN l.stage='New' THEN 1 ELSE 0 END) new_leads,SUM(CASE WHEN l.stage IN ('Booked','Won') THEN 1 ELSE 0 END) converted,SUM(CASE WHEN l.dnc=1 THEN 1 ELSE 0 END) dnc FROM highlevel_locations h LEFT JOIN highlevel_links hl ON hl.location_id=h.location_id LEFT JOIN leads l ON l.id=hl.lead_id GROUP BY h.location_id,h.name,h.enabled,h.last_pull_at ORDER BY linked_leads DESC,h.name COLLATE NOCASE`).all();
  const webhook=await env.DB.prepare(`SELECT COUNT(*) n,MAX(received_at) last_at FROM highlevel_webhooks`).first(),writebacks=await env.DB.prepare(`SELECT status,COUNT(*) n FROM highlevel_writebacks GROUP BY status`).all();
  return {locations:rs.results.map(r=>({locationId:r.location_id,name:r.name,enabled:Boolean(r.enabled),lastPullAt:r.last_pull_at,linkedLeads:Number(r.linked_leads||0),newLeads:Number(r.new_leads||0),converted:Number(r.converted||0),dnc:Number(r.dnc||0)})),webhooks:{count:Number(webhook?.n||0),lastAt:webhook?.last_at||null},writebacks:Object.fromEntries(writebacks.results.map(r=>[r.status,Number(r.n||0)]))};
}

async function internalApi(request,env,url){
  if(!(await internalAuthorized(request,env)))return json({ok:false,error:"Unauthorized"},401);
  if(url.pathname==="/api/highlevel/status"&&request.method==="GET"){const summary=await agencySummary(env);return json({ok:true,connected:Boolean(clean(env.HIGHLEVEL_PRIVATE_TOKEN,4000)),authMode:"Private Integration Token / OAuth access token",webhook:{url:`${clean(env.PUBLIC_BASE_URL,1000).replace(/\/$/,"")}/webhooks/highlevel`,signature:"X-GHL-Signature / Ed25519"},locations:await listLocations(env),summary});}
  if(url.pathname==="/api/highlevel/locations"&&request.method==="GET")return json({ok:true,locations:await listLocations(env)});
  if(url.pathname==="/api/highlevel/locations"&&request.method==="PUT"){try{return json({ok:true,location:await saveLocation(env,await request.json().catch(()=>({}))) });}catch(error){return json({ok:false,error:error.message},400);}}
  if(url.pathname==="/api/highlevel/sync"&&request.method==="POST"){try{const input=await request.json().catch(()=>({}));return json(await pullLocation(env,clean(input.locationId,160)));}catch(error){return json({ok:false,error:error.message},502);}}
  if(url.pathname==="/api/highlevel/flush-writebacks"&&request.method==="POST")return json({ok:true,...await flushCallWritebacks(env,50)});
  if(url.pathname==="/api/highlevel/summary"&&request.method==="GET")return json({ok:true,summary:await agencySummary(env)});
  return json({ok:false,error:"HighLevel route not found"},404);
}

export default {
  async fetch(request,env,ctx){
    const url=new URL(request.url);
    if(url.pathname==="/health")return json({ok:true,service:"kenji-highlevel-worker",tokenConfigured:Boolean(clean(env.HIGHLEVEL_PRIVATE_TOKEN,4000)),webhookVerification:"ed25519",database:Boolean(env.DB)});
    if(url.pathname==="/webhooks/highlevel"&&request.method==="POST"){
      const raw=await request.text(),verified=await verifyGhlWebhook(raw,request);if(!verified.ok)return json({ok:false,error:verified.error},401);
      let payload={};try{payload=JSON.parse(raw);}catch{return json({ok:false,error:"Invalid JSON"},400);}
      try{const ledger=await recordWebhook(env,payload,raw);if(ledger.duplicate)return json({ok:true,duplicate:true,webhookId:ledger.webhookId});const result=await processWebhook(env,payload);return json({ok:true,webhookId:ledger.webhookId,result});}catch(error){console.error("HighLevel webhook processing failed",error);return json({ok:false,error:error?.message||String(error)},500);}
    }
    if(url.pathname.startsWith("/api/highlevel/"))return internalApi(request,env,url);
    return json({ok:false,error:"Not found"},404);
  },
  async scheduled(controller,env,ctx){ctx.waitUntil(flushCallWritebacks(env,25).catch(error=>console.error("HighLevel scheduled writeback failed",error)));},
};
