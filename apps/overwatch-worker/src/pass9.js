import app from "./pass8.js";

function json(data,status=200){return new Response(JSON.stringify(data,null,2),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store"}});}
function clean(v="",max=4000){return String(v??"").trim().slice(0,max);}
function now(){return Date.now();}
function id(prefix){return `${prefix}_${crypto.randomUUID()}`;}
async function authUser(request,env){const cookie=request.headers.get("cookie")||"";const r=await app.fetch(new Request("https://kenji.internal/api/auth/status",{headers:{cookie}}),env,{});const d=await r.json().catch(()=>({}));return r.ok&&d.authenticated?d.user:null;}
async function local(request,env,path){const cookie=request.headers.get("cookie")||"";const r=await app.fetch(new Request(`https://kenji.internal${path}`,{headers:{cookie}}),env,{});const d=await r.json().catch(()=>({ok:false,error:`${path} returned ${r.status}`}));return d;}

async function profile(env,input=null){if(input){await env.DB.prepare(`UPDATE launch_profile SET company_name=?,operator_name=?,handoff_status=?,notes=?,updated_at=? WHERE id='default'`).bind(clean(input.companyName||"Kenji",180)||"Kenji",clean(input.operatorName,180),["setup","demo-ready","handoff","live"].includes(String(input.handoffStatus))?String(input.handoffStatus):"setup",clean(input.notes,3000),now()).run();}const r=await env.DB.prepare(`SELECT * FROM launch_profile WHERE id='default'`).first();return {companyName:r?.company_name||"Kenji",operatorName:r?.operator_name||"",handoffStatus:r?.handoff_status||"setup",notes:r?.notes||"",updatedAt:r?.updated_at||null};}

async function checklist(request,env){
  const [demo,nurture,scale,video]=await Promise.all([
    local(request,env,"/api/pass4/readiness").catch(e=>({ok:false,error:e.message})),
    local(request,env,"/api/pass6/readiness").catch(e=>({ok:false,error:e.message})),
    local(request,env,"/api/pass7/status").catch(e=>({ok:false,error:e.message})),
    local(request,env,"/api/video/readiness").catch(e=>({ok:false,error:e.message})),
  ]);
  const [leadCounts,ownerCount,settings,seedCount]=await Promise.all([
    env.DB.prepare(`SELECT COUNT(*) total,SUM(source='Kenji Safe Demo') demo FROM leads`).first(),
    env.DB.prepare(`SELECT COUNT(*) n FROM owner_users`).first(),
    env.DB.prepare(`SELECT sms_from_number,email_from,reply_to FROM communication_settings WHERE id='default'`).first(),
    env.DB.prepare(`SELECT COUNT(*) n FROM demo_seed_batches`).first(),
  ]);
  const lanes=Array.isArray(scale?.lanes)?scale.lanes:[];
  const laneReady=name=>{const l=lanes.find(x=>x.lane===name);return Boolean(l&&l.mode==="queue"&&l.enabled&&!l.circuitOpen);};
  const voice=demo?.voice||{};
  const required={
    owner:Boolean(Number(ownerCount?.n||0)>0),
    dataPlane:Boolean(env.DB&&env.DATA),
    voiceRuntime:Boolean(voice.twilio&&voice.deepgram&&voice.runtime),
    smsEngine:Boolean(nurture?.sms?.ok!==false),
    emailEngine:Boolean(nurture?.email?.ok!==false),
    nurtureEngine:Boolean(nurture?.nurture),
    voiceLane:laneReady("voice"),
    smsLane:laneReady("sms"),
    emailLane:laneReady("email"),
    videoLane:laneReady("video"),
    videoRuntime:Boolean(video?.ok),
  };
  const config={
    leadsLoaded:Number(leadCounts?.total||0)>0,
    voiceNumberRouted:Number(voice.routedNumbers||0)>0,
    smsSenderSelected:Boolean(clean(settings?.sms_from_number,60)),
    emailSenderSelected:Boolean(clean(settings?.email_from,320)),
    safeDemoSeeded:Number(seedCount?.n||0)>0,
  };
  const platformReady=Object.values(required).every(Boolean);
  const goLiveReady=platformReady&&config.leadsLoaded&&config.voiceNumberRouted&&config.smsSenderSelected&&config.emailSenderSelected;
  return {ok:true,platformReady,goLiveReady,required,config,counts:{leads:Number(leadCounts?.total||0),safeDemoLeads:Number(leadCounts?.demo||0)},settings:{smsFromNumber:settings?.sms_from_number||"",emailFrom:settings?.email_from||"",replyTo:settings?.reply_to||""},voice:{voiceNumbers:Number(voice.voiceNumbers||0),routedNumbers:Number(voice.routedNumbers||0),inboundWebhook:voice.inboundWebhook||""},capturedAt:now()};
}

const SAFE_LEADS=[
  ["Avery","Stone","Northstar Roofing","+12025550100","avery.stone@example.com","New",92,"Website"],
  ["Maya","Chen","Beacon Dental","+12025550101","maya.chen@example.com","New",88,"Paid Social"],
  ["Jordan","Reed","Summit Solar","+12025550102","jordan.reed@example.com","Contacted",84,"Google Ads"],
  ["Noah","Brooks","Atlas Fitness","+12025550103","noah.brooks@example.com","Qualified",81,"Referral"],
  ["Sofia","Martinez","Harbor Med Spa","+12025550104","sofia.martinez@example.com","New",78,"Landing Page"],
  ["Ethan","Price","Bluebird HVAC","+12025550105","ethan.price@example.com","Contacted",74,"Organic"],
  ["Lena","Patel","Oakline Law","+12025550106","lena.patel@example.com","Nurture",71,"Webinar"],
  ["Caleb","Foster","Forge Auto","+12025550107","caleb.foster@example.com","New",69,"Partner"],
  ["Zoe","King","Cedar Realty","+12025550108","zoe.king@example.com","Qualified",66,"Direct"],
  ["Miles","Grant","Vertex Plumbing","+12025550109","miles.grant@example.com","New",63,"CSV Import"],
];
async function seedDemo(env,user){const t=now(),batchId=id("seed");let added=0;for(const [first,last,company,phone,email,stage,score,channel] of SAFE_LEADS){const existing=await env.DB.prepare(`SELECT id FROM leads WHERE email=? LIMIT 1`).bind(email).first();if(existing)continue;const leadId=id("lead");await env.DB.prepare(`INSERT INTO leads(id,first_name,last_name,phone,email,company,source,source_account,stage,score,assigned_to,tags_json,notes,contactable,dnc,created_at,updated_at) VALUES(?,?,?,?,?,?,'Kenji Safe Demo',?,?,?,'','["safe-demo","synthetic"]',?,0,0,?,?)`).bind(leadId,first,last,phone,email,company,channel,stage,score,"Synthetic handoff lead. Outbound contact is disabled by contactable=0.",t,t).run();await env.DB.prepare(`INSERT INTO lead_events(id,lead_id,type,actor,text,data_json,created_at) VALUES(?,?,?,?,?,?,?)`).bind(id("evt"),leadId,"lead.demo.seeded",user.id,"Safe synthetic demo lead created",JSON.stringify({batchId}),t).run();added++;}await env.DB.prepare(`INSERT INTO demo_seed_batches(id,lead_count,created_by,created_at) VALUES(?,?,?,?)`).bind(batchId,added,user.id,t).run();return {ok:true,batchId,added,total:SAFE_LEADS.length,safe:true,outboundBlocked:true};}

async function acceptance(request,env,user){const c=await checklist(request,env),runId=id("accept"),status=c.goLiveReady?"go-live-ready":c.platformReady?"platform-ready":"needs-attention";await env.DB.prepare(`INSERT INTO launch_acceptance_runs(id,status,checks_json,created_by,created_at) VALUES(?,?,?,?,?)`).bind(runId,status,JSON.stringify(c),user.id,now()).run();return {ok:true,runId,status,...c};}
async function history(env){const rs=await env.DB.prepare(`SELECT id,status,created_by,created_at FROM launch_acceptance_runs ORDER BY created_at DESC LIMIT 12`).all();return rs.results.map(r=>({id:r.id,status:r.status,createdBy:r.created_by,createdAt:r.created_at}));}

export default{async fetch(request,env,ctx){const url=new URL(request.url);if(url.pathname.startsWith("/api/pass9/")){const user=await authUser(request,env);if(!user)return json({ok:false,error:"Authentication required"},401);try{if(url.pathname==="/api/pass9/checklist"&&request.method==="GET")return json(await checklist(request,env));if(url.pathname==="/api/pass9/profile"&&request.method==="GET")return json({ok:true,profile:await profile(env)});if(url.pathname==="/api/pass9/profile"&&request.method==="PUT")return json({ok:true,profile:await profile(env,await request.json().catch(()=>({})))});if(url.pathname==="/api/pass9/seed-demo"&&request.method==="POST"){const input=await request.json().catch(()=>({}));if(input.confirm!==true)return json({ok:false,error:"Explicit confirmation is required before seeding demo data"},400);return json(await seedDemo(env,user));}if(url.pathname==="/api/pass9/acceptance"&&request.method==="POST")return json(await acceptance(request,env,user));if(url.pathname==="/api/pass9/acceptance/history"&&request.method==="GET")return json({ok:true,runs:await history(env)});return json({ok:false,error:"Pass 9 route not found"},404);}catch(error){console.error("Kenji Pass 9 handoff route failed",error);return json({ok:false,error:error?.message||String(error)},400);}}const response=await app.fetch(request,env,ctx);const type=response.headers.get("content-type")||"";if(request.method==="GET"&&type.includes("text/html")){const html=await response.text(),injected=html.includes("/pass9-launch.js")?html:html.replace("</body>",'  <script src="/pass9-launch.js"></script>\n</body>');return new Response(injected,{status:response.status,headers:response.headers});}return response;}};
