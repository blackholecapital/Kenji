const STAGES = new Set(["New","Attempted","Contacted","Qualified","Booked","Won","Nurture","Lost"]);
const CORS = {
  "access-control-allow-origin":"*",
  "access-control-allow-methods":"GET,POST,PUT,DELETE,OPTIONS",
  "access-control-allow-headers":"content-type,authorization,x-internal-call-secret",
};

function json(data,status=200,headers={}) {
  return new Response(JSON.stringify(data,null,2),{status,headers:{"content-type":"application/json; charset=utf-8",...CORS,...headers}});
}
function clean(v="",max=1000){return String(v??"").trim().slice(0,max);}
function id(prefix){return `${prefix}_${crypto.randomUUID()}`;}
function now(){return Date.now();}
function clampScore(v){const n=Number(v);return Number.isFinite(n)?Math.max(0,Math.min(100,Math.round(n))):50;}
function stage(v){const s=clean(v,40);return STAGES.has(s)?s:"New";}
function bool(v, fallback=true){if(v===undefined||v===null||v==="")return fallback;return v===true||v===1||/^(1|true|yes|y)$/i.test(String(v));}
function tags(v){if(Array.isArray(v))return v.map(x=>clean(x,80)).filter(Boolean).slice(0,30);return clean(v,1000).split(/[|,;]/).map(x=>x.trim()).filter(Boolean).slice(0,30);}
function parseJson(v,fallback={}){try{return JSON.parse(v||"");}catch{return fallback;}}

async function sha256(value){const b=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(String(value)));return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,"0")).join("");}
async function equalSecret(a,b){const [x,y]=await Promise.all([sha256(a),sha256(b)]);let d=x.length^y.length;for(let i=0;i<Math.max(x.length,y.length);i++)d|=(x.charCodeAt(i)||0)^(y.charCodeAt(i)||0);return d===0;}
async function internalAuthorized(request,env){const expected=clean(env.INTERNAL_CALL_SECRET,1000),given=request.headers.get("x-internal-call-secret")||"";return Boolean(expected&&given&&await equalSecret(expected,given));}
async function apiAuthorized(request,env){
  const raw=(request.headers.get("authorization")||"").replace(/^Bearer\s+/i,"").trim();
  if(!raw)return null;
  const hash=await sha256(raw);
  const row=await env.DB.prepare(`SELECT id,label,prefix FROM api_keys WHERE key_hash=? AND enabled=1 LIMIT 1`).bind(hash).first();
  if(!row)return null;
  await env.DB.prepare(`UPDATE api_keys SET last_used_at=? WHERE id=?`).bind(now(),row.id).run();
  return row;
}
async function event(env,leadId,type,text="",data={},actor="system"){
  await env.DB.prepare(`INSERT INTO lead_events(id,lead_id,type,actor,text,data_json,created_at) VALUES(?,?,?,?,?,?,?)`)
    .bind(id("evt"),leadId||null,clean(type,120),clean(actor,80),clean(text,3000),JSON.stringify(data||{}),now()).run();
  try{env.ANALYTICS?.writeDataPoint({blobs:[clean(type,120),clean(leadId,160),clean(actor,80)],doubles:[Date.now()]});}catch{}
}
function leadFromRow(r){if(!r)return null;return {id:r.id,firstName:r.first_name,lastName:r.last_name,phone:r.phone,email:r.email,company:r.company,source:r.source,sourceAccount:r.source_account,stage:r.stage,score:r.score,assignedTo:r.assigned_to,tags:parseJson(r.tags_json,[]),notes:r.notes,contactable:Boolean(r.contactable),dnc:Boolean(r.dnc),lastContactedAt:r.last_contacted_at,nextCallbackAt:r.next_callback_at,createdAt:r.created_at,updatedAt:r.updated_at};}
function callFromRow(r){if(!r)return null;return {id:r.id,leadId:r.lead_id,direction:r.direction,status:r.status,disposition:r.disposition,providerSid:r.provider_sid,startedAt:r.started_at,endedAt:r.ended_at,durationSeconds:r.duration_seconds,summary:r.summary,transcript:r.transcript,error:r.error,createdAt:r.created_at,updatedAt:r.updated_at};}
function callbackFromRow(r){if(!r)return null;return {id:r.id,leadId:r.lead_id,dueAt:r.due_at,status:r.status,reason:r.reason,createdBy:r.created_by,callId:r.call_id,createdAt:r.created_at,updatedAt:r.updated_at};}

function normalizeLead(input={}){
  return {
    firstName:clean(input.firstName??input.first_name??input.firstname??input.name?.split?.(/\s+/)?.[0],120),
    lastName:clean(input.lastName??input.last_name??input.lastname??(input.name?String(input.name).split(/\s+/).slice(1).join(" "):""),120),
    phone:clean(input.phone??input.phone_number??input.mobile,50),
    email:clean(input.email,320).toLowerCase(),
    company:clean(input.company??input.business??input.account,200),
    source:clean(input.source??input.lead_source??"manual",160)||"manual",
    sourceAccount:clean(input.sourceAccount??input.source_account??input.location??input.subaccount,200),
    stage:stage(input.stage),
    score:clampScore(input.score??input.leadScore??input.lead_score),
    assignedTo:clean(input.assignedTo??input.assigned_to??input.owner,160),
    tags:tags(input.tags??input.tag),
    notes:clean(input.notes??input.note??input.comments,4000),
    contactable:bool(input.contactable??input.can_contact??input.consent,true),
    dnc:bool(input.dnc??input.do_not_call,false),
  };
}
async function upsertLead(env,input={},sourceOverride=""){
  const n=normalizeLead({...input,source:sourceOverride||input.source});
  if(!n.phone&&!n.email)throw new Error("Lead needs a phone number or email address");
  const existing=await env.DB.prepare(`SELECT * FROM leads WHERE (phone<>'' AND phone=?) OR (email<>'' AND email=?) ORDER BY updated_at DESC LIMIT 1`).bind(n.phone,n.email).first();
  const t=now();
  if(existing){
    const merged={...leadFromRow(existing),...n,firstName:n.firstName||existing.first_name,lastName:n.lastName||existing.last_name,phone:n.phone||existing.phone,email:n.email||existing.email,company:n.company||existing.company,source:n.source||existing.source,sourceAccount:n.sourceAccount||existing.source_account,assignedTo:n.assignedTo||existing.assigned_to,notes:n.notes||existing.notes,tags:n.tags.length?n.tags:parseJson(existing.tags_json,[])};
    await env.DB.prepare(`UPDATE leads SET first_name=?,last_name=?,phone=?,email=?,company=?,source=?,source_account=?,stage=?,score=?,assigned_to=?,tags_json=?,notes=?,contactable=?,dnc=?,updated_at=? WHERE id=?`)
      .bind(merged.firstName,merged.lastName,merged.phone,merged.email,merged.company,merged.source,merged.sourceAccount,merged.stage,merged.score,merged.assignedTo,JSON.stringify(merged.tags),merged.notes,merged.contactable?1:0,merged.dnc?1:0,t,existing.id).run();
    await event(env,existing.id,"lead.updated","Lead refreshed from ingest",{source:merged.source});
    return leadFromRow(await env.DB.prepare(`SELECT * FROM leads WHERE id=?`).bind(existing.id).first());
  }
  const leadId=id("lead");
  await env.DB.prepare(`INSERT INTO leads(id,first_name,last_name,phone,email,company,source,source_account,stage,score,assigned_to,tags_json,notes,contactable,dnc,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .bind(leadId,n.firstName,n.lastName,n.phone,n.email,n.company,n.source,n.sourceAccount,n.stage,n.score,n.assignedTo,JSON.stringify(n.tags),n.notes,n.contactable?1:0,n.dnc?1:0,t,t).run();
  await event(env,leadId,"lead.created","Lead entered Kenji pipeline",{source:n.source,sourceAccount:n.sourceAccount});
  return leadFromRow(await env.DB.prepare(`SELECT * FROM leads WHERE id=?`).bind(leadId).first());
}

function parseCsv(text=""){
  const rows=[];let row=[],cell="",quoted=false;
  const input=String(text).replace(/^\uFEFF/,"");
  for(let i=0;i<input.length;i++){
    const ch=input[i],next=input[i+1];
    if(ch==='"'&&quoted&&next==='"'){cell+='"';i++;continue;}
    if(ch==='"'){quoted=!quoted;continue;}
    if(ch===","&&!quoted){row.push(cell);cell="";continue;}
    if((ch==="\n"||ch==="\r")&&!quoted){if(ch==="\r"&&next==="\n")i++;row.push(cell);cell="";if(row.some(v=>String(v).trim()))rows.push(row);row=[];continue;}
    cell+=ch;
  }
  if(cell||row.length){row.push(cell);if(row.some(v=>String(v).trim()))rows.push(row);}
  if(rows.length<2)return [];
  const headers=rows.shift().map(h=>clean(h,120).toLowerCase().replace(/[^a-z0-9]+/g,"_"));
  return rows.map(values=>Object.fromEntries(headers.map((h,i)=>[h,values[i]??""])));
}

async function listLeads(url,env){
  const q=clean(url.searchParams.get("q"),200),st=clean(url.searchParams.get("stage"),40),limit=Math.min(500,Math.max(1,Number(url.searchParams.get("limit")||100)));
  const where=[],bind=[];
  if(st&&STAGES.has(st)){where.push("stage=?");bind.push(st);}
  if(q){where.push("(first_name LIKE ? OR last_name LIKE ? OR phone LIKE ? OR email LIKE ? OR company LIKE ? OR source LIKE ?)");for(let i=0;i<6;i++)bind.push(`%${q}%`);}
  const rs=await env.DB.prepare(`SELECT * FROM leads ${where.length?`WHERE ${where.join(" AND ")}`:""} ORDER BY score DESC, updated_at DESC LIMIT ?`).bind(...bind,limit).all();
  return rs.results.map(leadFromRow);
}
async function getLead(env,leadId){return leadFromRow(await env.DB.prepare(`SELECT * FROM leads WHERE id=?`).bind(leadId).first());}

async function queueCall(env,lead,reason="operator",callbackId=null){
  if(!lead)throw new Error("Lead not found");
  if(!lead.phone)throw new Error("Lead has no phone number");
  if(lead.dnc||!lead.contactable)throw new Error("Lead is marked do-not-call or not contactable");
  const callId=id("call"),t=now();
  await env.DB.prepare(`INSERT INTO calls(id,lead_id,direction,status,created_at,updated_at) VALUES(?,?, 'outbound','queued',?,?)`).bind(callId,lead.id,t,t).run();
  await event(env,lead.id,"call.queued","AI call queued",{callId,reason,callbackId});
  await env.CALL_JOBS.send({type:"call.start",callId,leadId:lead.id,reason,callbackId,queuedAt:t});
  return callFromRow(await env.DB.prepare(`SELECT * FROM calls WHERE id=?`).bind(callId).first());
}
async function scheduleCallback(env,leadId,input={}){
  const lead=await getLead(env,leadId);if(!lead)throw new Error("Lead not found");
  const dueRaw=input.dueAt??input.due_at??input.when;let due=Number(dueRaw);
  if(!Number.isFinite(due)){due=Date.parse(String(dueRaw||""));}
  if(!Number.isFinite(due))due=Date.now()+3600000;
  const cbId=id("cb"),t=now(),reason=clean(input.reason||"Follow up",500);
  await env.DB.prepare(`INSERT INTO callbacks(id,lead_id,due_at,status,reason,created_by,created_at,updated_at) VALUES(?,?,?,'queued',?,'operator',?,?)`).bind(cbId,leadId,due,reason,t,t).run();
  await env.DB.prepare(`UPDATE leads SET next_callback_at=?,updated_at=? WHERE id=?`).bind(due,t,leadId).run();
  await event(env,leadId,"callback.scheduled",`Callback scheduled for ${new Date(due).toISOString()}`,{callbackId:cbId,dueAt:due,reason},"operator");
  return callbackFromRow(await env.DB.prepare(`SELECT * FROM callbacks WHERE id=?`).bind(cbId).first());
}

async function snapshot(env){
  const [counts,due,hot,recentCalls,stale,sources]=await Promise.all([
    env.DB.prepare(`SELECT COUNT(*) total,SUM(stage='New') new_count,SUM(stage='Contacted') contacted,SUM(stage='Qualified') qualified,SUM(stage='Booked') booked,SUM(stage='Won') won FROM leads`).first(),
    env.DB.prepare(`SELECT c.*,l.first_name,l.last_name,l.phone,l.email,l.score,l.stage FROM callbacks c JOIN leads l ON l.id=c.lead_id WHERE c.status='queued' AND c.due_at<=? ORDER BY c.due_at ASC LIMIT 12`).bind(now()).all(),
    env.DB.prepare(`SELECT * FROM leads WHERE dnc=0 AND contactable=1 ORDER BY score DESC,updated_at DESC LIMIT 12`).all(),
    env.DB.prepare(`SELECT c.*,l.first_name,l.last_name,l.company,l.score FROM calls c JOIN leads l ON l.id=c.lead_id ORDER BY c.created_at DESC LIMIT 12`).all(),
    env.DB.prepare(`SELECT * FROM leads WHERE dnc=0 AND contactable=1 AND (last_contacted_at IS NULL OR last_contacted_at<?) AND stage NOT IN ('Won','Lost') ORDER BY score DESC LIMIT 10`).bind(now()-86400000).all(),
    env.DB.prepare(`SELECT source,COUNT(*) count,SUM(stage='Booked' OR stage='Won') converted FROM leads GROUP BY source ORDER BY count DESC LIMIT 10`).all(),
  ]);
  const total=Number(counts?.total||0),booked=Number(counts?.booked||0)+Number(counts?.won||0);
  return {
    capturedAt:now(),
    metrics:{total,new:Number(counts?.new_count||0),contacted:Number(counts?.contacted||0),qualified:Number(counts?.qualified||0),booked:Number(counts?.booked||0),won:Number(counts?.won||0),conversionRate:total?Number(((booked/total)*100).toFixed(1)):0,dueCallbacks:due.results.length},
    dueCallbacks:due.results.map(r=>({...callbackFromRow(r),lead:{id:r.lead_id,firstName:r.first_name,lastName:r.last_name,phone:r.phone,email:r.email,score:r.score,stage:r.stage}})),
    hotLeads:hot.results.map(leadFromRow),
    staleLeads:stale.results.map(leadFromRow),
    recentCalls:recentCalls.results.map(r=>({...callFromRow(r),lead:{firstName:r.first_name,lastName:r.last_name,company:r.company,score:r.score}})),
    sources:sources.results,
  };
}

async function rotateApiKey(env,input={}){
  const raw=`kenji_${crypto.randomUUID().replaceAll("-","")}_${crypto.randomUUID().replaceAll("-","")}`;
  const prefix=raw.slice(0,14),hash=await sha256(raw),keyId=id("key");
  await env.DB.prepare(`UPDATE api_keys SET enabled=0 WHERE enabled=1`).run();
  await env.DB.prepare(`INSERT INTO api_keys(id,label,prefix,key_hash,enabled,created_at) VALUES(?,?,?,?,1,?)`).bind(keyId,clean(input.label||"Kenji lead ingest",120),prefix,hash,now()).run();
  return {id:keyId,label:clean(input.label||"Kenji lead ingest",120),prefix,apiKey:raw,shownOnce:true};
}

async function internalRoute(request,env,url){
  const p=url.pathname;
  if(p==="/api/leads"&&request.method==="GET")return json({ok:true,leads:await listLeads(url,env)});
  if(p==="/api/leads"&&request.method==="POST"){
    const input=await request.json().catch(()=>({}));const items=Array.isArray(input)?input:Array.isArray(input.leads)?input.leads:[input];
    if(items.length>5000)return json({ok:false,error:"Maximum 5,000 leads per request"},413);
    const out=[];for(const item of items)out.push(await upsertLead(env,item));return json({ok:true,count:out.length,leads:out},201);
  }
  if(p==="/api/leads/import"&&request.method==="POST"){
    const input=await request.json().catch(()=>({}));const rows=parseCsv(input.csv||"");if(!rows.length)return json({ok:false,error:"CSV must include a header row and at least one lead"},400);if(rows.length>5000)return json({ok:false,error:"Maximum 5,000 CSV rows per import"},413);
    const imported=[];const errors=[];for(let i=0;i<rows.length;i++){try{imported.push(await upsertLead(env,rows[i],clean(input.source||rows[i].source||"csv",160)));}catch(e){errors.push({row:i+2,error:e.message});}}
    return json({ok:true,imported:imported.length,rejected:errors.length,errors:errors.slice(0,100),leads:imported.slice(0,50)});
  }
  const leadMatch=p.match(/^\/api\/leads\/([^/]+)$/);
  if(leadMatch&&request.method==="GET"){const lead=await getLead(env,decodeURIComponent(leadMatch[1]));return lead?json({ok:true,lead}):json({ok:false,error:"Lead not found"},404);}
  if(leadMatch&&request.method==="PUT"){
    const leadId=decodeURIComponent(leadMatch[1]),existing=await getLead(env,leadId);if(!existing)return json({ok:false,error:"Lead not found"},404);const input=await request.json().catch(()=>({}));
    const next={...existing,...normalizeLead({...existing,...input}),stage:input.stage?stage(input.stage):existing.stage,score:input.score!==undefined?clampScore(input.score):existing.score,contactable:input.contactable!==undefined?bool(input.contactable):existing.contactable,dnc:input.dnc!==undefined?bool(input.dnc,false):existing.dnc};
    await env.DB.prepare(`UPDATE leads SET first_name=?,last_name=?,phone=?,email=?,company=?,source=?,source_account=?,stage=?,score=?,assigned_to=?,tags_json=?,notes=?,contactable=?,dnc=?,updated_at=? WHERE id=?`).bind(next.firstName,next.lastName,next.phone,next.email,next.company,next.source,next.sourceAccount,next.stage,next.score,next.assignedTo,JSON.stringify(next.tags||[]),next.notes,next.contactable?1:0,next.dnc?1:0,now(),leadId).run();
    await event(env,leadId,"lead.updated","Lead updated",{fields:Object.keys(input)},"operator");return json({ok:true,lead:await getLead(env,leadId)});
  }
  const callMatch=p.match(/^\/api\/leads\/([^/]+)\/call$/);
  if(callMatch&&request.method==="POST"){try{return json({ok:true,call:await queueCall(env,await getLead(env,decodeURIComponent(callMatch[1])),"operator")},202);}catch(e){return json({ok:false,error:e.message},409);}}
  const cbMatch=p.match(/^\/api\/leads\/([^/]+)\/callback$/);
  if(cbMatch&&request.method==="POST"){try{return json({ok:true,callback:await scheduleCallback(env,decodeURIComponent(cbMatch[1]),await request.json().catch(()=>({})))},201);}catch(e){return json({ok:false,error:e.message},400);}}
  if(p==="/api/callbacks"&&request.method==="GET"){
    const due=url.searchParams.get("due")==="1",rs=await env.DB.prepare(`SELECT c.*,l.first_name,l.last_name,l.phone,l.email,l.score,l.stage FROM callbacks c JOIN leads l ON l.id=c.lead_id WHERE c.status='queued' ${due?"AND c.due_at<=?":""} ORDER BY c.due_at ASC LIMIT 250`);const out=due?await rs.bind(now()).all():await rs.all();
    return json({ok:true,callbacks:out.results.map(r=>({...callbackFromRow(r),lead:{id:r.lead_id,firstName:r.first_name,lastName:r.last_name,phone:r.phone,email:r.email,score:r.score,stage:r.stage}}))});
  }
  const complete=p.match(/^\/api\/callbacks\/([^/]+)\/complete$/);
  if(complete&&request.method==="POST"){const cbId=decodeURIComponent(complete[1]),t=now();const row=await env.DB.prepare(`SELECT * FROM callbacks WHERE id=?`).bind(cbId).first();if(!row)return json({ok:false,error:"Callback not found"},404);await env.DB.prepare(`UPDATE callbacks SET status='done',updated_at=? WHERE id=?`).bind(t,cbId).run();await event(env,row.lead_id,"callback.completed","Callback marked complete",{callbackId:cbId},"operator");return json({ok:true});}
  if(p==="/api/calls"&&request.method==="GET"){const rs=await env.DB.prepare(`SELECT c.*,l.first_name,l.last_name,l.company,l.score FROM calls c JOIN leads l ON l.id=c.lead_id ORDER BY c.created_at DESC LIMIT 250`).all();return json({ok:true,calls:rs.results.map(r=>({...callFromRow(r),lead:{firstName:r.first_name,lastName:r.last_name,company:r.company,score:r.score}}))});}
  if(p==="/api/events"&&request.method==="GET"){const rs=await env.DB.prepare(`SELECT * FROM lead_events ORDER BY created_at DESC LIMIT 250`).all();return json({ok:true,events:rs.results.map(r=>({...r,data:parseJson(r.data_json,{})}))});}
  if(p==="/api/overwatch/snapshot"&&request.method==="GET")return json({ok:true,snapshot:await snapshot(env)});
  if(p==="/api/integrations/api-key/status"&&request.method==="GET"){const key=await env.DB.prepare(`SELECT id,label,prefix,enabled,last_used_at,created_at FROM api_keys WHERE enabled=1 ORDER BY created_at DESC LIMIT 1`).first();return json({ok:true,endpoint:`${clean(env.PUBLIC_BASE_URL,1000).replace(/\/$/,"")}/v1/leads`,key:key||null});}
  if(p==="/api/integrations/api-key/rotate"&&request.method==="POST")return json({ok:true,endpoint:`${clean(env.PUBLIC_BASE_URL,1000).replace(/\/$/,"")}/v1/leads`,key:await rotateApiKey(env,await request.json().catch(()=>({})))},201);
  return json({ok:false,error:"Not found"},404);
}

async function publicApiRoute(request,env,url){
  const key=await apiAuthorized(request,env);if(!key)return json({ok:false,error:"Invalid API key"},401);
  if(url.pathname==="/v1/leads"&&request.method==="POST"){
    const input=await request.json().catch(()=>({}));const items=Array.isArray(input)?input:Array.isArray(input.leads)?input.leads:[input];if(items.length>5000)return json({ok:false,error:"Maximum 5,000 leads"},413);
    const out=[];const errors=[];for(let i=0;i<items.length;i++){try{out.push(await upsertLead(env,{...items[i],source:items[i].source||"kenji-api"}));}catch(e){errors.push({index:i,error:e.message});}}
    return json({ok:true,accepted:out.length,rejected:errors.length,errors,leadIds:out.map(x=>x.id)},202);
  }
  return json({ok:false,error:"Not found"},404);
}

async function dispatchDueCallbacks(env){
  const due=await env.DB.prepare(`SELECT c.* FROM callbacks c JOIN leads l ON l.id=c.lead_id WHERE c.status='queued' AND c.due_at<=? AND l.dnc=0 AND l.contactable=1 ORDER BY c.due_at ASC LIMIT 25`).bind(now()).all();
  let queued=0;
  for(const cb of due.results){
    const claim=await env.DB.prepare(`UPDATE callbacks SET status='dispatching',updated_at=? WHERE id=? AND status='queued'`).bind(now(),cb.id).run();
    if(!claim.meta?.changes)continue;
    try{const call=await queueCall(env,await getLead(env,cb.lead_id),"scheduled-callback",cb.id);await env.DB.prepare(`UPDATE callbacks SET call_id=?,updated_at=? WHERE id=?`).bind(call.id,now(),cb.id).run();queued++;}
    catch(e){await env.DB.prepare(`UPDATE callbacks SET status='queued',updated_at=? WHERE id=?`).bind(now(),cb.id).run();await event(env,cb.lead_id,"callback.dispatch_failed",e.message,{callbackId:cb.id});}
  }
  return queued;
}

export default {
  async fetch(request,env){
    const url=new URL(request.url);
    if(request.method==="OPTIONS")return new Response(null,{status:204,headers:CORS});
    if(url.pathname==="/health")return json({ok:true,service:"kenji-data-worker",database:Boolean(env.DB),callQueue:Boolean(env.CALL_JOBS),time:now()});
    if(url.pathname.startsWith("/v1/"))return publicApiRoute(request,env,url);
    if(url.pathname.startsWith("/api/")){
      if(!(await internalAuthorized(request,env)))return json({ok:false,error:"Unauthorized"},401);
      try{return await internalRoute(request,env,url);}catch(e){console.error("Kenji data API failed",e);return json({ok:false,error:e.message||String(e)},500);}
    }
    return json({ok:false,error:"Not found"},404);
  },
  async scheduled(event,env,ctx){ctx.waitUntil(dispatchDueCallbacks(env));},
};
