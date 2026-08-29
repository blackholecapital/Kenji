const CAMPAIGN_STATUSES=new Set(["draft","active","paused","completed"]);
const MEMBER_TERMINAL=new Set(["completed","blocked","exhausted"]);

function json(data,status=200){return new Response(JSON.stringify(data,null,2),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store"}});}
function clean(v="",max=4000){return String(v??"").trim().slice(0,max);}
function now(){return Date.now();}
function id(prefix){return `${prefix}_${crypto.randomUUID()}`;}
async function digest(v){return new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(String(v))));}
async function sameSecret(a,b){const [x,y]=await Promise.all([digest(a),digest(b)]);let d=x.length^y.length;for(let i=0;i<Math.max(x.length,y.length);i++)d|=(x[i]??0)^(y[i]??0);return d===0;}
async function authorized(request,env){const expected=clean(env.INTERNAL_CALL_SECRET,1000),given=request.headers.get("x-internal-call-secret")||"";return Boolean(expected&&given&&await sameSecret(expected,given));}
function clampInt(value,min,max,fallback){const n=Math.round(Number(value));return Number.isFinite(n)?Math.min(max,Math.max(min,n)):fallback;}
function campaignFromRow(r){return r?{id:r.id,name:r.name,status:r.status,sourceFilter:r.source_filter,sourceAccountFilter:r.source_account_filter,stageFilter:r.stage_filter,minScore:Number(r.min_score||0),maxAttempts:Number(r.max_attempts||3),retryMinutes:Number(r.retry_minutes||60),callsPerTick:Number(r.calls_per_tick||5),totalMembers:Number(r.total_members||0),launchedAt:r.launched_at,completedAt:r.completed_at,createdBy:r.created_by,createdAt:r.created_at,updatedAt:r.updated_at}:null;}
async function campaignEvent(env,campaignId,leadId,type,text,data={}){await env.DB.prepare(`INSERT INTO campaign_events(id,campaign_id,lead_id,type,text,data_json,created_at) VALUES(?,?,?,?,?,?,?)`).bind(id("cevt"),campaignId,leadId||null,clean(type,120),clean(text,2500),JSON.stringify(data||{}),now()).run();try{env.ANALYTICS?.writeDataPoint({blobs:[type,campaignId,leadId||""],doubles:[Date.now()]});}catch{}}

function audienceWhere(input={}){
  const where=["dnc=0","contactable=1","phone<>''","stage NOT IN ('Won','Lost')"],bind=[];
  const source=clean(input.sourceFilter??input.source_filter,160),account=clean(input.sourceAccountFilter??input.source_account_filter,200),stage=clean(input.stageFilter??input.stage_filter,40),minScore=clampInt(input.minScore??input.min_score,0,100,0);
  if(source){where.push("source LIKE ?");bind.push(`%${source}%`);}
  if(account){where.push("source_account LIKE ?");bind.push(`%${account}%`);}
  if(stage){where.push("stage=?");bind.push(stage);}
  where.push("score>=?");bind.push(minScore);
  return {where:where.join(" AND "),bind,filters:{sourceFilter:source,sourceAccountFilter:account,stageFilter:stage,minScore}};
}
async function previewAudience(env,input={}){const q=audienceWhere(input);const count=await env.DB.prepare(`SELECT COUNT(*) n FROM leads WHERE ${q.where}`).bind(...q.bind).first();const sample=await env.DB.prepare(`SELECT id,first_name,last_name,company,phone,source,source_account,stage,score FROM leads WHERE ${q.where} ORDER BY score DESC,updated_at DESC LIMIT 12`).bind(...q.bind).all();return {filters:q.filters,count:Number(count?.n||0),sample:sample.results.map(r=>({id:r.id,name:`${r.first_name} ${r.last_name}`.trim(),company:r.company,phone:r.phone,source:r.source,sourceAccount:r.source_account,stage:r.stage,score:r.score}))};}

async function createCampaign(env,input={}){
  const name=clean(input.name,180);if(!name)throw new Error("Campaign name is required");const q=audienceWhere(input),t=now(),campaignId=id("campaign");
  const maxAttempts=clampInt(input.maxAttempts,1,8,3),retryMinutes=clampInt(input.retryMinutes,5,10080,60),callsPerTick=clampInt(input.callsPerTick,1,25,5);
  await env.DB.prepare(`INSERT INTO campaigns(id,name,status,source_filter,source_account_filter,stage_filter,min_score,max_attempts,retry_minutes,calls_per_tick,created_by,created_at,updated_at) VALUES(?,?,'draft',?,?,?,?,?,?,?,'owner',?,?)`).bind(campaignId,name,q.filters.sourceFilter,q.filters.sourceAccountFilter,q.filters.stageFilter,q.filters.minScore,maxAttempts,retryMinutes,callsPerTick,t,t).run();
  await campaignEvent(env,campaignId,null,"campaign.created",`Campaign ${name} created`,{filters:q.filters,maxAttempts,retryMinutes,callsPerTick});return campaignFromRow(await env.DB.prepare(`SELECT * FROM campaigns WHERE id=?`).bind(campaignId).first());
}
async function getCampaign(env,campaignId){return campaignFromRow(await env.DB.prepare(`SELECT * FROM campaigns WHERE id=?`).bind(campaignId).first());}
async function materializeAudience(env,campaign){
  const q=audienceWhere(campaign),rows=await env.DB.prepare(`SELECT id FROM leads WHERE ${q.where} ORDER BY score DESC,updated_at DESC LIMIT 5000`).bind(...q.bind).all(),t=now();
  const statements=rows.results.map(r=>env.DB.prepare(`INSERT OR IGNORE INTO campaign_members(campaign_id,lead_id,status,attempts,next_attempt_at,created_at,updated_at) VALUES(?,?,'queued',0,?,?,?)`).bind(campaign.id,r.id,t,t,t));
  for(let i=0;i<statements.length;i+=80)await env.DB.batch(statements.slice(i,i+80));
  const count=await env.DB.prepare(`SELECT COUNT(*) n FROM campaign_members WHERE campaign_id=?`).bind(campaign.id).first();await env.DB.prepare(`UPDATE campaigns SET total_members=?,updated_at=? WHERE id=?`).bind(Number(count?.n||0),t,campaign.id).run();return Number(count?.n||0);
}
async function launchCampaign(env,campaignId){const campaign=await getCampaign(env,campaignId);if(!campaign)throw new Error("Campaign not found");if(campaign.status==="completed")throw new Error("Completed campaigns cannot be relaunched");const total=await materializeAudience(env,campaign);if(!total)throw new Error("No contactable leads match this campaign audience");const t=now();await env.DB.prepare(`UPDATE campaigns SET status='active',launched_at=COALESCE(launched_at,?),completed_at=NULL,updated_at=? WHERE id=?`).bind(t,t,campaignId).run();await campaignEvent(env,campaignId,null,"campaign.launched",`Campaign launched with ${total} lead(s)`,{total});return getCampaign(env,campaignId);}
async function setCampaignStatus(env,campaignId,status){if(!["active","paused"].includes(status))throw new Error("Unsupported campaign state");const campaign=await getCampaign(env,campaignId);if(!campaign)throw new Error("Campaign not found");if(campaign.status==="completed")throw new Error("Completed campaigns cannot be resumed");await env.DB.prepare(`UPDATE campaigns SET status=?,updated_at=? WHERE id=?`).bind(status,now(),campaignId).run();await campaignEvent(env,campaignId,null,`campaign.${status}`,`Campaign ${status}`);return getCampaign(env,campaignId);}

async function reconcileMember(env,campaign,row){
  if(!row.last_call_id||row.status!=="calling")return false;
  const call=await env.DB.prepare(`SELECT c.status,c.disposition,c.error,co.disposition outcome_disposition FROM calls c LEFT JOIN call_outcomes co ON co.call_id=c.id WHERE c.id=?`).bind(row.last_call_id).first();if(!call)return false;
  const provider=clean(call.status,80).toLowerCase();if(!["completed","busy","failed","no-answer","canceled"].includes(provider))return false;
  const disposition=clean(call.outcome_disposition||call.disposition||provider,80).toLowerCase(),t=now();
  if(["dnc","not-interested","wrong-number","qualified","appointment-request","callback","connected"].includes(disposition)||provider==="completed"){
    await env.DB.prepare(`UPDATE campaign_members SET status='completed',last_disposition=?,stop_reason=?,next_attempt_at=NULL,updated_at=? WHERE campaign_id=? AND lead_id=?`).bind(disposition,disposition||provider,t,campaign.id,row.lead_id).run();
  }else if(row.attempts>=campaign.maxAttempts){
    await env.DB.prepare(`UPDATE campaign_members SET status='exhausted',last_disposition=?,stop_reason='max-attempts',next_attempt_at=NULL,updated_at=? WHERE campaign_id=? AND lead_id=?`).bind(disposition||provider,t,campaign.id,row.lead_id).run();
  }else{
    const next=t+campaign.retryMinutes*60000;await env.DB.prepare(`UPDATE campaign_members SET status='waiting',last_disposition=?,next_attempt_at=?,updated_at=? WHERE campaign_id=? AND lead_id=?`).bind(disposition||provider,next,t,campaign.id,row.lead_id).run();
  }
  await campaignEvent(env,campaign.id,row.lead_id,"campaign.member.reconciled",`Attempt ${row.attempts}: ${disposition||provider}`,{callId:row.last_call_id,providerStatus:provider,disposition});return true;
}
async function reconcileCampaign(env,campaign){const rows=await env.DB.prepare(`SELECT * FROM campaign_members WHERE campaign_id=? AND status='calling' ORDER BY updated_at ASC LIMIT 100`).bind(campaign.id).all();let reconciled=0;for(const row of rows.results)if(await reconcileMember(env,campaign,row))reconciled++;return reconciled;}
async function queueMember(env,campaign,row){
  const lead=await env.DB.prepare(`SELECT id,phone,dnc,contactable,stage FROM leads WHERE id=?`).bind(row.lead_id).first(),t=now();
  if(!lead||!lead.phone||lead.dnc||!lead.contactable||["Won","Lost"].includes(lead.stage)){
    await env.DB.prepare(`UPDATE campaign_members SET status='blocked',stop_reason='not-contactable',next_attempt_at=NULL,updated_at=? WHERE campaign_id=? AND lead_id=?`).bind(t,campaign.id,row.lead_id).run();return false;
  }
  const active=await env.DB.prepare(`SELECT id FROM calls WHERE lead_id=? AND status IN ('queued','initiated','ringing','in-progress') AND created_at>? LIMIT 1`).bind(row.lead_id,t-15*60000).first();if(active){await env.DB.prepare(`UPDATE campaign_members SET status='waiting',next_attempt_at=?,updated_at=? WHERE campaign_id=? AND lead_id=?`).bind(t+5*60000,t,campaign.id,row.lead_id).run();return false;}
  const callId=id("call");await env.DB.prepare(`INSERT INTO calls(id,lead_id,direction,status,campaign_id,call_reason,created_at,updated_at) VALUES(?,?,'outbound','queued',?,'campaign',?,?)`).bind(callId,row.lead_id,campaign.id,t,t).run();
  await env.DB.prepare(`UPDATE campaign_members SET status='calling',attempts=attempts+1,last_call_id=?,next_attempt_at=NULL,updated_at=? WHERE campaign_id=? AND lead_id=?`).bind(callId,t,campaign.id,row.lead_id).run();
  await env.CALL_JOBS.send({type:"call.start",callId,leadId:row.lead_id,reason:"campaign",campaignId:campaign.id,queuedAt:t});await campaignEvent(env,campaign.id,row.lead_id,"campaign.call.queued","Campaign call queued",{callId});return true;
}
async function tickCampaign(env,campaign){
  await reconcileCampaign(env,campaign);const due=await env.DB.prepare(`SELECT * FROM campaign_members WHERE campaign_id=? AND status IN ('queued','waiting') AND COALESCE(next_attempt_at,0)<=? ORDER BY attempts ASC,next_attempt_at ASC,created_at ASC LIMIT ?`).bind(campaign.id,now(),campaign.callsPerTick).all();let queued=0;for(const row of due.results)if(await queueMember(env,campaign,row))queued++;
  const open=await env.DB.prepare(`SELECT COUNT(*) n FROM campaign_members WHERE campaign_id=? AND status NOT IN ('completed','blocked','exhausted')`).bind(campaign.id).first();if(Number(open?.n||0)===0){const t=now();await env.DB.prepare(`UPDATE campaigns SET status='completed',completed_at=?,updated_at=? WHERE id=?`).bind(t,t,campaign.id).run();await campaignEvent(env,campaign.id,null,"campaign.completed","Campaign completed");}
  return {campaignId:campaign.id,queued};
}
async function runTick(env){const active=await env.DB.prepare(`SELECT * FROM campaigns WHERE status='active' ORDER BY launched_at ASC LIMIT 20`).all();let queued=0,reconciledCampaigns=0;for(const row of active.results){const campaign=campaignFromRow(row),result=await tickCampaign(env,campaign);queued+=result.queued;reconciledCampaigns++;}return {campaigns:reconciledCampaigns,queued};}

async function listCampaigns(env){const rs=await env.DB.prepare(`SELECT c.*,
  (SELECT COUNT(*) FROM campaign_members m WHERE m.campaign_id=c.id AND m.status='queued') queued,
  (SELECT COUNT(*) FROM campaign_members m WHERE m.campaign_id=c.id AND m.status='waiting') waiting,
  (SELECT COUNT(*) FROM campaign_members m WHERE m.campaign_id=c.id AND m.status='calling') calling,
  (SELECT COUNT(*) FROM campaign_members m WHERE m.campaign_id=c.id AND m.status='completed') completed_members,
  (SELECT COUNT(*) FROM campaign_members m WHERE m.campaign_id=c.id AND m.status='exhausted') exhausted,
  (SELECT COUNT(*) FROM campaign_members m WHERE m.campaign_id=c.id AND m.status='blocked') blocked,
  (SELECT COUNT(*) FROM calls x WHERE x.campaign_id=c.id) calls,
  (SELECT COUNT(*) FROM calls x WHERE x.campaign_id=c.id AND x.disposition='qualified') qualified,
  (SELECT COUNT(*) FROM calls x WHERE x.campaign_id=c.id AND x.disposition='appointment-request') appointment_requests
  FROM campaigns c ORDER BY c.created_at DESC LIMIT 100`).all();return rs.results.map(r=>({...campaignFromRow(r),metrics:{queued:Number(r.queued||0),waiting:Number(r.waiting||0),calling:Number(r.calling||0),completed:Number(r.completed_members||0),exhausted:Number(r.exhausted||0),blocked:Number(r.blocked||0),calls:Number(r.calls||0),qualified:Number(r.qualified||0),appointmentRequests:Number(r.appointment_requests||0)}}));}
async function campaignDetail(env,campaignId){const campaign=(await listCampaigns(env)).find(x=>x.id===campaignId);if(!campaign)throw new Error("Campaign not found");const members=await env.DB.prepare(`SELECT m.*,l.first_name,l.last_name,l.company,l.phone,l.stage,l.score FROM campaign_members m JOIN leads l ON l.id=m.lead_id WHERE m.campaign_id=? ORDER BY CASE m.status WHEN 'calling' THEN 0 WHEN 'queued' THEN 1 WHEN 'waiting' THEN 2 ELSE 3 END,l.score DESC LIMIT 250`).bind(campaignId).all();return {campaign,members:members.results.map(r=>({leadId:r.lead_id,name:`${r.first_name} ${r.last_name}`.trim(),company:r.company,phone:r.phone,stage:r.stage,score:r.score,status:r.status,attempts:r.attempts,nextAttemptAt:r.next_attempt_at,lastCallId:r.last_call_id,lastDisposition:r.last_disposition,stopReason:r.stop_reason}))};}
async function summary(env){const campaigns=await listCampaigns(env),calls=campaigns.reduce((n,c)=>n+c.metrics.calls,0);return {active:campaigns.filter(c=>c.status==="active").length,paused:campaigns.filter(c=>c.status==="paused").length,total:campaigns.length,members:campaigns.reduce((n,c)=>n+c.totalMembers,0),calls,qualified:campaigns.reduce((n,c)=>n+c.metrics.qualified,0),appointmentRequests:campaigns.reduce((n,c)=>n+c.metrics.appointmentRequests,0)};}

async function internalApi(request,env,url){
  if(!(await authorized(request,env)))return json({ok:false,error:"Unauthorized"},401);
  try{
    if(url.pathname==="/internal/pass5/summary"&&request.method==="GET")return json({ok:true,summary:await summary(env)});
    if(url.pathname==="/internal/pass5/campaigns"&&request.method==="GET")return json({ok:true,campaigns:await listCampaigns(env)});
    if(url.pathname==="/internal/pass5/campaigns/preview"&&request.method==="POST")return json({ok:true,preview:await previewAudience(env,await request.json().catch(()=>({}))) });
    if(url.pathname==="/internal/pass5/campaigns"&&request.method==="POST")return json({ok:true,campaign:await createCampaign(env,await request.json().catch(()=>({})))},201);
    if(url.pathname==="/internal/pass5/tick"&&request.method==="POST")return json({ok:true,...await runTick(env)});
    const detail=url.pathname.match(/^\/internal\/pass5\/campaigns\/([^/]+)$/);if(detail&&request.method==="GET")return json({ok:true,...await campaignDetail(env,decodeURIComponent(detail[1]))});
    const action=url.pathname.match(/^\/internal\/pass5\/campaigns\/([^/]+)\/(launch|pause|resume)$/);if(action&&request.method==="POST"){const campaignId=decodeURIComponent(action[1]),op=action[2];return json({ok:true,campaign:op==="launch"?await launchCampaign(env,campaignId):await setCampaignStatus(env,campaignId,op==="pause"?"paused":"active")});}
    if(url.pathname==="/internal/pass5/pause-all"&&request.method==="POST"){const t=now(),result=await env.DB.prepare(`UPDATE campaigns SET status='paused',updated_at=? WHERE status='active'`).bind(t).run();return json({ok:true,paused:Number(result.meta?.changes||0)});}
    return json({ok:false,error:"Campaign route not found"},404);
  }catch(error){console.error("Kenji campaign worker failed",error);return json({ok:false,error:error?.message||String(error)},400);}
}

export default {async fetch(request,env){const url=new URL(request.url);if(url.pathname==="/health")return json({ok:true,service:"kenji-campaign-worker",queue:Boolean(env.CALL_JOBS),d1:Boolean(env.DB)});if(url.pathname.startsWith("/internal/pass5/"))return internalApi(request,env,url);return json({ok:false,error:"Not found"},404);},async scheduled(controller,env,ctx){const job=runTick(env).catch(error=>console.error("Kenji campaign tick failed",error));if(ctx?.waitUntil)ctx.waitUntil(job);else await job;}};
