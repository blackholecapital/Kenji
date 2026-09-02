import app from "./pass9.js";

function json(data,status=200){return new Response(JSON.stringify(data,null,2),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store"}});}
function clean(v="",max=4000){return String(v??"").trim().slice(0,max);}
function now(){return Date.now();}
function id(prefix){return `${prefix}_${crypto.randomUUID()}`;}
async function rawAuth(request,env){const cookie=request.headers.get("cookie")||"";const r=await app.fetch(new Request("https://kenji.internal/api/auth/status",{headers:{cookie}}),env,{});const d=await r.json().catch(()=>({}));return {response:r,data:d};}
async function authUser(request,env){const {response,data}=await rawAuth(request,env);return response.ok&&data.authenticated?data.user:null;}
async function local(request,env,path,{method="GET",body}={}){const headers={cookie:request.headers.get("cookie")||"",accept:"application/json"};if(body!==undefined)headers["content-type"]="application/json";const r=await app.fetch(new Request(`https://kenji.internal${path}`,{method,headers,body:body===undefined?undefined:JSON.stringify(body)}),env,{});const text=await r.text();let d={};try{d=text?JSON.parse(text):{};}catch{d={raw:text};}if(!r.ok||d?.ok===false)throw new Error(d?.error||`${path} failed (${r.status})`);return d;}

const DEMO_LEADS=[
  {id:"demo_avery",firstName:"Avery",lastName:"Stone",company:"Northstar Roofing",phone:"+12025550100",email:"avery.stone@example.com",source:"Website",sourceAccount:"Kenji Demo",stage:"New",score:92,notes:"Requested a quote after visiting the commercial roofing page.",contactable:false,dnc:false,lastContactedAt:null,updatedAt:now()-11*60000},
  {id:"demo_maya",firstName:"Maya",lastName:"Chen",company:"Beacon Dental",phone:"+12025550101",email:"maya.chen@example.com",source:"Paid Social",sourceAccount:"Kenji Demo",stage:"New",score:88,notes:"High-intent lead from a same-day implant campaign.",contactable:false,dnc:false,lastContactedAt:null,updatedAt:now()-26*60000},
  {id:"demo_jordan",firstName:"Jordan",lastName:"Reed",company:"Summit Solar",phone:"+12025550102",email:"jordan.reed@example.com",source:"Google Ads",sourceAccount:"Kenji Demo",stage:"Contacted",score:84,notes:"Asked for a callback after 4 PM.",contactable:false,dnc:false,lastContactedAt:now()-70*60000,updatedAt:now()-70*60000},
  {id:"demo_noah",firstName:"Noah",lastName:"Brooks",company:"Atlas Fitness",phone:"+12025550103",email:"noah.brooks@example.com",source:"Referral",sourceAccount:"Kenji Demo",stage:"Qualified",score:81,notes:"Qualified multi-location operator. Wants a booking link.",contactable:false,dnc:false,lastContactedAt:now()-2*3600000,updatedAt:now()-2*3600000},
  {id:"demo_sofia",firstName:"Sofia",lastName:"Martinez",company:"Harbor Med Spa",phone:"+12025550104",email:"sofia.martinez@example.com",source:"Landing Page",sourceAccount:"Kenji Demo",stage:"New",score:78,notes:"Submitted after-hours. No human follow-up yet.",contactable:false,dnc:false,lastContactedAt:null,updatedAt:now()-3*3600000},
  {id:"demo_ethan",firstName:"Ethan",lastName:"Price",company:"Bluebird HVAC",phone:"+12025550105",email:"ethan.price@example.com",source:"Organic",sourceAccount:"Kenji Demo",stage:"Contacted",score:74,notes:"Interested in maintenance-plan pricing.",contactable:false,dnc:false,lastContactedAt:now()-4*3600000,updatedAt:now()-4*3600000},
  {id:"demo_lena",firstName:"Lena",lastName:"Patel",company:"Oakline Law",phone:"+12025550106",email:"lena.patel@example.com",source:"Webinar",sourceAccount:"Kenji Demo",stage:"Nurture",score:71,notes:"Longer-term nurture opportunity.",contactable:false,dnc:false,lastContactedAt:now()-24*3600000,updatedAt:now()-24*3600000},
  {id:"demo_caleb",firstName:"Caleb",lastName:"Foster",company:"Forge Auto",phone:"+12025550107",email:"caleb.foster@example.com",source:"Partner",sourceAccount:"Kenji Demo",stage:"New",score:69,notes:"Partner referral awaiting first touch.",contactable:false,dnc:false,lastContactedAt:null,updatedAt:now()-26*3600000},
];
const DEMO_CALLS=[
  {id:"demo_call_1",leadId:"demo_noah",lead:DEMO_LEADS[3],direction:"outbound",status:"completed",durationSeconds:184,disposition:"qualified",summary:"Qualified operator and requested booking options.",createdAt:now()-38*60000},
  {id:"demo_call_2",leadId:"demo_jordan",lead:DEMO_LEADS[2],direction:"outbound",status:"completed",durationSeconds:76,disposition:"callback",summary:"Requested a callback after 4 PM.",createdAt:now()-70*60000},
  {id:"demo_call_3",leadId:"demo_ethan",lead:DEMO_LEADS[5],direction:"inbound",status:"completed",durationSeconds:131,disposition:"connected",summary:"Inbound receptionist captured service interest.",createdAt:now()-4*3600000},
  {id:"demo_call_4",leadId:"demo_sofia",lead:DEMO_LEADS[4],direction:"outbound",status:"no-answer",durationSeconds:0,disposition:"no-answer",summary:"Retry window available.",createdAt:now()-5*3600000},
];
const DEMO_CALLBACKS=[
  {id:"demo_cb_1",leadId:"demo_jordan",lead:DEMO_LEADS[2],dueAt:now()-8*60000,status:"queued",reason:"Requested callback after 4 PM"},
  {id:"demo_cb_2",leadId:"demo_sofia",lead:DEMO_LEADS[4],dueAt:now()+42*60000,status:"queued",reason:"Second attempt after no answer"},
];
function demoSnapshot(){return {capturedAt:now(),metrics:{total:DEMO_LEADS.length,new:4,contacted:2,qualified:1,booked:1,won:0,dueCallbacks:1,conversionRate:25},hotLeads:DEMO_LEADS.slice(0,5),staleLeads:DEMO_LEADS.slice(5),dueCallbacks:DEMO_CALLBACKS,recentCalls:DEMO_CALLS,sources:[{source:"Website",count:2},{source:"Paid Social",count:2},{source:"Google Ads",count:1},{source:"Referral",count:1},{source:"Organic",count:1},{source:"Partner",count:1}]};}
function demoLanes(){return [
  {lane:"voice",mode:"queue",enabled:true,circuitOpen:false,perMinute:120,burst:20,shardCount:4,dailyCapacity:172800,note:"Demo model"},
  {lane:"sms",mode:"queue",enabled:true,circuitOpen:false,perMinute:300,burst:50,shardCount:4,dailyCapacity:432000,note:"Demo model"},
  {lane:"email",mode:"queue",enabled:true,circuitOpen:false,perMinute:600,burst:100,shardCount:4,dailyCapacity:864000,note:"Demo model"},
  {lane:"video",mode:"queue",enabled:true,circuitOpen:false,perMinute:20,burst:5,shardCount:2,dailyCapacity:28800,note:"Demo model"},
];}
function publicDemo(url){
  if(url.pathname==="/api/overwatch/snapshot")return {ok:true,snapshot:demoSnapshot(),demoView:true};
  if(url.pathname==="/api/leads"){
    const q=(url.searchParams.get("q")||"").toLowerCase(),stage=url.searchParams.get("stage")||"";const leads=DEMO_LEADS.filter(l=>(!stage||l.stage===stage)&&(!q||`${l.firstName} ${l.lastName} ${l.company} ${l.source}`.toLowerCase().includes(q)));return {ok:true,leads,total:leads.length,demoView:true};
  }
  if(url.pathname==="/api/calls")return {ok:true,calls:DEMO_CALLS,demoView:true};
  if(url.pathname==="/api/callbacks")return {ok:true,callbacks:DEMO_CALLBACKS,demoView:true};
  if(url.pathname==="/api/integrations/api-key/status")return {ok:true,endpoint:`${url.origin}/v1/leads`,key:null,demoView:true};
  if(url.pathname==="/api/highlevel/status")return {ok:true,connected:false,demoView:true};
  if(url.pathname==="/api/highlevel/locations")return {ok:true,locations:[],demoView:true};
  if(url.pathname==="/api/highlevel/pass3/agency-ops")return {ok:true,agency:{connected:false,totals:{leads:DEMO_LEADS.length,calls:DEMO_CALLS.length,callbacksDue:1,appointmentsPending:1,writebackFailures:0},locations:[]},demoView:true};
  if(url.pathname==="/api/highlevel/pass3/appointments")return {ok:true,appointments:[],demoView:true};
  if(url.pathname==="/api/pass4/readiness")return {ok:true,voice:{twilio:true,deepgram:true,runtime:true,voiceNumbers:2,routedNumbers:0,inboundWebhook:"Demo view · login to inspect routing"},demoView:true};
  if(url.pathname==="/api/pass4/voice/numbers")return {ok:true,numbers:[],demoView:true};
  if(url.pathname==="/api/pass5/summary")return {ok:true,summary:{active:1,paused:0,total:2,members:1240,calls:318,qualified:47,appointmentRequests:19},demoView:true};
  if(url.pathname==="/api/pass5/campaigns")return {ok:true,campaigns:[],demoView:true};
  if(url.pathname==="/api/pass6/readiness")return {ok:true,nurture:{active:1,sequences:2,smsOptIns:624,emailOptIns:811,messages:1532,failed:4},sms:{ok:true},email:{ok:true},demoView:true};
  if(url.pathname==="/api/pass6/settings")return {ok:true,settings:{smsFromNumber:"",emailFrom:"",replyTo:""},demoView:true};
  if(url.pathname==="/api/pass6/sequences")return {ok:true,sequences:[],demoView:true};
  if(url.pathname==="/api/pass6/consents")return {ok:true,consents:[],demoView:true};
  if(url.pathname==="/api/pass6/sms/numbers")return {ok:true,numbers:[],demoView:true};
  if(url.pathname==="/api/pass7/status")return {ok:true,lanes:demoLanes(),ingress:{voice:"kenji-orch-voice-ingress",sms:"kenji-orch-sms-ingress",email:"kenji-orch-email-ingress",video:"kenji-orch-video-ingress"},execution:{voice:"kenji-call-jobs",sms:"kenji-sms-jobs",email:"kenji-email-jobs",video:"kenji-video-jobs"},capturedAt:now(),demoView:true};
  if(url.pathname==="/api/pass8/rehearsal")return {ok:true,checks:{data:true,voice:true,sms:true,email:true,nurture:true,orchestrator:true,video:true},providerTrafficSent:false,demoView:true};
  if(url.pathname==="/api/video/readiness")return {ok:true,queueBacked:true,lane:{lane:"video",mode:"queue",enabled:true,circuitOpen:false,perMinute:20,burst:5,shardCount:2},demoView:true};
  if(url.pathname==="/api/pass9/checklist")return {ok:true,platformReady:true,goLiveReady:false,required:{owner:true,dataPlane:true,voiceRuntime:true,smsEngine:true,emailEngine:true,nurtureEngine:true,voiceLane:true,smsLane:true,emailLane:true,videoLane:true,videoRuntime:true},config:{leadsLoaded:true,voiceNumberRouted:false,smsSenderSelected:false,emailSenderSelected:false,safeDemoSeeded:true},counts:{leads:DEMO_LEADS.length,safeDemoLeads:DEMO_LEADS.length},settings:{smsFromNumber:"",emailFrom:"",replyTo:""},voice:{voiceNumbers:2,routedNumbers:0,inboundWebhook:"Demo view"},capturedAt:now(),demoView:true};
  if(url.pathname==="/api/pass9/profile")return {ok:true,profile:{companyName:"Kenji AI",operatorName:"Demo Owner",handoffStatus:"demo-ready",notes:"Read-only buyer demo"},demoView:true};
  if(url.pathname==="/api/pass9/acceptance/history")return {ok:true,runs:[],demoView:true};
  if(url.pathname==="/api/pass10/state")return {ok:true,setup:{brandLabel:"Kenji AI",assistantName:"EILA",primaryGoal:"Turn lead backlog into booked conversations",timezone:"America/New_York",demoMode:true,currentStep:1},handoff:{companyName:"Kenji AI",operatorName:"Demo Owner",handoffStatus:"demo-ready",notes:"Read-only buyer demo"},checklist:publicDemo(new URL(`${url.origin}/api/pass9/checklist`)),highlevel:{ok:true,connected:false},locations:[],voiceNumbers:[],smsNumbers:[],communication:{smsFromNumber:"",emailFrom:"",replyTo:""},rehearsal:publicDemo(new URL(`${url.origin}/api/pass8/rehearsal`)),steps:[{id:"identity",label:"Brand + owner",ready:true,detail:"Kenji AI"},{id:"leads",label:"Lead source",ready:true,detail:`${DEMO_LEADS.length} safe demo leads`},{id:"voice",label:"Voice number",ready:false,detail:"Login to choose a Twilio number"},{id:"messaging",label:"SMS + email",ready:false,detail:"Login to configure senders"},{id:"calendar",label:"Booking calendar",ready:true,optional:true,detail:"Optional for demo"},{id:"platform",label:"Platform acceptance",ready:true,detail:"All demo runtimes modeled healthy"},{id:"live",label:"Go-live gate",ready:false,detail:"Login to finish real routing"}],progress:{complete:4,total:7,percent:57},capturedAt:now(),demoView:true};
  return null;
}

async function setupProfile(env,input=null){
  if(input){
    const current=await env.DB.prepare(`SELECT * FROM owner_setup WHERE id='default'`).first();
    const brand=clean(input.brandLabel??current?.brand_label??"Kenji AI",120)||"Kenji AI";
    const assistant=clean(input.assistantName??current?.assistant_name??"EILA",80)||"EILA";
    const goal=clean(input.primaryGoal??current?.primary_goal??"Turn lead backlog into booked conversations",600)||"Turn lead backlog into booked conversations";
    const timezone=clean(input.timezone??current?.timezone??"America/New_York",120)||"America/New_York";
    const demoMode=input.demoMode===undefined?Boolean(current?.demo_mode):Boolean(input.demoMode);
    const step=Math.max(1,Math.min(7,Number(input.currentStep??current?.current_step??1)||1));
    const t=now();
    await env.DB.prepare(`INSERT INTO owner_setup(id,brand_label,assistant_name,primary_goal,timezone,demo_mode,current_step,created_at,updated_at) VALUES('default',?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET brand_label=excluded.brand_label,assistant_name=excluded.assistant_name,primary_goal=excluded.primary_goal,timezone=excluded.timezone,demo_mode=excluded.demo_mode,current_step=excluded.current_step,updated_at=excluded.updated_at`).bind(brand,assistant,goal,timezone,demoMode?1:0,step,current?.created_at||t,t).run();
  }
  const r=await env.DB.prepare(`SELECT * FROM owner_setup WHERE id='default'`).first();
  return {brandLabel:r?.brand_label||"Kenji AI",assistantName:r?.assistant_name||"EILA",primaryGoal:r?.primary_goal||"Turn lead backlog into booked conversations",timezone:r?.timezone||"America/New_York",demoMode:Boolean(r?.demo_mode??1),currentStep:Number(r?.current_step||1),updatedAt:r?.updated_at||null};
}

async function safe(request,env,path,opts){try{return await local(request,env,path,opts);}catch(error){return {ok:false,error:error?.message||String(error)};}}
async function state(request,env){
  const [setup,handoff,checklist,highlevel,locations,voiceNumbers,smsNumbers,communication,rehearsal]=await Promise.all([
    setupProfile(env),safe(request,env,"/api/pass9/profile"),safe(request,env,"/api/pass9/checklist"),safe(request,env,"/api/highlevel/status"),safe(request,env,"/api/highlevel/locations"),safe(request,env,"/api/pass4/voice/numbers"),safe(request,env,"/api/pass6/sms/numbers"),safe(request,env,"/api/pass6/settings"),safe(request,env,"/api/pass8/rehearsal"),
  ]);
  const launchProfile=handoff?.profile||{};const cfg=checklist?.config||{},counts=checklist?.counts||{};const realLeads=Math.max(0,Number(counts.leads||0)-Number(counts.safeDemoLeads||0));const locationList=Array.isArray(locations?.locations)?locations.locations:[];const connected=Boolean(highlevel?.connected||highlevel?.status?.connected||highlevel?.highlevel?.connected);const calendarReady=locationList.some(x=>Boolean(x.calendarId||x.calendar_id));const leadSourceReady=realLeads>0||connected;
  const steps=[{id:"identity",label:"Brand + owner",ready:Boolean(setup.brandLabel&&setup.assistantName&&launchProfile.companyName),detail:setup.brandLabel},{id:"leads",label:"Lead source",ready:leadSourceReady,detail:connected?"HighLevel connected":realLeads?`${realLeads} real lead(s) loaded`:"Connect HighLevel or import real leads"},{id:"voice",label:"Voice number",ready:Boolean(cfg.voiceNumberRouted),detail:cfg.voiceNumberRouted?"Inbound voice routed":"Choose a Twilio voice number"},{id:"messaging",label:"SMS + email",ready:Boolean(cfg.smsSenderSelected&&cfg.emailSenderSelected),detail:`SMS ${cfg.smsSenderSelected?"ready":"pending"} · email ${cfg.emailSenderSelected?"ready":"pending"}`},{id:"calendar",label:"Booking calendar",ready:connected?calendarReady:true,optional:!connected,detail:connected?(calendarReady?"Calendar mapped":"Map a HighLevel calendar"):"Optional until HighLevel is connected"},{id:"platform",label:"Platform acceptance",ready:Boolean(checklist?.platformReady),detail:checklist?.platformReady?"All runtimes healthy":"Run Launch acceptance"},{id:"live",label:"Go-live gate",ready:Boolean(checklist?.goLiveReady),detail:checklist?.goLiveReady?"Ready for controlled live traffic":"Finish sender/routing/data setup"}];
  const complete=steps.filter(x=>x.ready||x.optional).length;return {ok:true,setup,handoff:launchProfile,checklist,highlevel,locations:locationList,voiceNumbers:Array.isArray(voiceNumbers?.numbers)?voiceNumbers.numbers:[],smsNumbers:Array.isArray(smsNumbers?.numbers)?smsNumbers.numbers:[],communication:communication?.settings||communication,rehearsal,steps,progress:{complete,total:steps.length,percent:Math.round(100*complete/steps.length)},capturedAt:now()};
}

async function preserveSettings(request,env,patch){const current=await local(request,env,"/api/pass6/settings");const s=current?.settings||current||{};return local(request,env,"/api/pass6/settings",{method:"PUT",body:{smsFromNumber:patch.smsFromNumber??s.smsFromNumber??"",emailFrom:patch.emailFrom??s.emailFrom??"",replyTo:patch.replyTo??s.replyTo??""}});}
async function configureHighLevel(request,env,input){const locationId=clean(input.locationId,160);if(!locationId)throw new Error("HighLevel location ID is required");const location=await local(request,env,"/api/highlevel/locations",{method:"PUT",body:{locationId,name:clean(input.name,200)||locationId,businessId:clean(input.businessId,160),pipelineId:clean(input.pipelineId,160),noteUserId:clean(input.noteUserId,160),enabled:input.enabled!==false,stageMap:input.stageMap&&typeof input.stageMap==="object"?input.stageMap:{}}});let calendar=null;if(clean(input.calendarId,160)||clean(input.assignedUserId,160))calendar=await local(request,env,`/api/highlevel/pass3/locations/${encodeURIComponent(locationId)}/calendar`,{method:"PUT",body:{calendarId:clean(input.calendarId,160),assignedUserId:clean(input.assignedUserId,160)}});return {ok:true,location:location.location||location,calendar:calendar?.calendar||calendar};}
async function demoRun(env,user,input={}){const steps=Array.isArray(input.completedSteps)?input.completedSteps.map(x=>clean(x,80)).filter(Boolean).slice(0,20):[];const runId=id("tour");await env.DB.prepare(`INSERT INTO owner_demo_runs(id,mode,completed_steps_json,created_by,created_at) VALUES(?,?,?,?,?)`).bind(runId,clean(input.mode||"guided",40),JSON.stringify(steps),user.id,now()).run();return {ok:true,runId,completedSteps:steps};}

export default {async fetch(request,env,ctx){const url=new URL(request.url);
  if(url.pathname==="/api/auth/status"&&request.method==="GET"){
    const {response,data}=await rawAuth(request,env);if(response.ok&&data.authenticated)return json({...data,sessionAuthenticated:true,demoView:false});return json({ok:true,authenticated:true,sessionAuthenticated:false,demoView:true,bootstrapAvailable:Boolean(data.bootstrapAvailable),user:{id:"demo-viewer",name:"Demo Viewer",email:""}});
  }
  if(request.method==="GET"){const user=await authUser(request,env);if(!user){const demo=publicDemo(url);if(demo)return json(demo);}}
  if(url.pathname.startsWith("/api/pass10/")){const user=await authUser(request,env);if(!user)return json({ok:false,error:"Authentication required"},401);try{
    if(url.pathname==="/api/pass10/state"&&request.method==="GET")return json(await state(request,env));
    if(url.pathname==="/api/pass10/setup"&&request.method==="PUT")return json({ok:true,setup:await setupProfile(env,await request.json().catch(()=>({})))});
    if(url.pathname==="/api/pass10/voice/route"&&request.method==="POST"){const input=await request.json().catch(()=>({}));if(input.confirm!==true)return json({ok:false,error:"Explicit confirmation is required before changing voice routing"},400);const sid=clean(input.numberSid,80);if(!/^PN[0-9a-fA-F]{32}$/.test(sid))return json({ok:false,error:"A valid Twilio number SID is required"},400);return json(await local(request,env,`/api/pass4/voice/numbers/${sid}/route`,{method:"POST",body:{confirm:true}}));}
    if(url.pathname==="/api/pass10/sms/sender"&&request.method==="PUT"){const input=await request.json().catch(()=>({}));return json(await preserveSettings(request,env,{smsFromNumber:clean(input.smsFromNumber,60)}));}
    if(url.pathname==="/api/pass10/sms/route"&&request.method==="POST"){const input=await request.json().catch(()=>({}));if(input.confirm!==true)return json({ok:false,error:"Explicit confirmation is required before changing SMS routing"},400);const sid=clean(input.numberSid,80);if(!/^PN[0-9a-fA-F]{32}$/.test(sid))return json({ok:false,error:"A valid Twilio number SID is required"},400);return json(await local(request,env,`/api/pass6/sms/numbers/${sid}/route`,{method:"POST",body:{confirm:true}}));}
    if(url.pathname==="/api/pass10/email/sender"&&request.method==="PUT"){const input=await request.json().catch(()=>({}));return json(await preserveSettings(request,env,{emailFrom:clean(input.emailFrom,320),replyTo:clean(input.replyTo,320)}));}
    if(url.pathname==="/api/pass10/highlevel"&&request.method==="PUT")return json(await configureHighLevel(request,env,await request.json().catch(()=>({}))));
    if(url.pathname==="/api/pass10/acceptance"&&request.method==="POST")return json(await local(request,env,"/api/pass9/acceptance",{method:"POST",body:{}}));
    if(url.pathname==="/api/pass10/demo-run"&&request.method==="POST")return json(await demoRun(env,user,await request.json().catch(()=>({}))));
    return json({ok:false,error:"Pass 10 route not found"},404);
  }catch(error){console.error("Kenji Pass 10 owner setup route failed",error);return json({ok:false,error:error?.message||String(error)},400);}}
  const response=await app.fetch(request,env,ctx);const type=response.headers.get("content-type")||"";if(request.method==="GET"&&type.includes("text/html")){const html=await response.text();let injected=html.includes("/pass10-setup.js")?html:html.replace("</body>",'  <script src="/pass10-setup.js"></script>\n</body>');if(!injected.includes("/demo-access.js"))injected=injected.replace("</body>",'  <script src="/demo-access.js"></script>\n</body>');return new Response(injected,{status:response.status,headers:response.headers});}return response;}};
