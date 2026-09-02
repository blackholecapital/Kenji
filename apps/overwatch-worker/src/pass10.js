import app from "./pass9.js";

function json(data,status=200){return new Response(JSON.stringify(data,null,2),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store"}});}
function clean(v="",max=4000){return String(v??"").trim().slice(0,max);}
function now(){return Date.now();}
function id(prefix){return `${prefix}_${crypto.randomUUID()}`;}
async function authUser(request,env){const cookie=request.headers.get("cookie")||"";const r=await app.fetch(new Request("https://kenji.internal/api/auth/status",{headers:{cookie}}),env,{});const d=await r.json().catch(()=>({}));return r.ok&&d.authenticated?d.user:null;}
async function local(request,env,path,{method="GET",body}={}){const headers={cookie:request.headers.get("cookie")||"",accept:"application/json"};if(body!==undefined)headers["content-type"]="application/json";const r=await app.fetch(new Request(`https://kenji.internal${path}`,{method,headers,body:body===undefined?undefined:JSON.stringify(body)}),env,{});const text=await r.text();let d={};try{d=text?JSON.parse(text):{};}catch{d={raw:text};}if(!r.ok||d?.ok===false)throw new Error(d?.error||`${path} failed (${r.status})`);return d;}

async function setupProfile(env,input=null){
  if(input){
    const current=await env.DB.prepare(`SELECT * FROM owner_setup WHERE id='default'`).first();
    const brand=clean(input.brandLabel??current?.brand_label??"Kenji AI",120)||"Kenji AI";
    const assistant=clean(input.assistantName??current?.assistant_name??"Isla",80)||"Isla";
    const goal=clean(input.primaryGoal??current?.primary_goal??"Turn lead backlog into booked conversations",600)||"Turn lead backlog into booked conversations";
    const timezone=clean(input.timezone??current?.timezone??"America/New_York",120)||"America/New_York";
    const demoMode=input.demoMode===undefined?Boolean(current?.demo_mode):Boolean(input.demoMode);
    const step=Math.max(1,Math.min(7,Number(input.currentStep??current?.current_step??1)||1));
    const t=now();
    await env.DB.prepare(`INSERT INTO owner_setup(id,brand_label,assistant_name,primary_goal,timezone,demo_mode,current_step,created_at,updated_at) VALUES('default',?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET brand_label=excluded.brand_label,assistant_name=excluded.assistant_name,primary_goal=excluded.primary_goal,timezone=excluded.timezone,demo_mode=excluded.demo_mode,current_step=excluded.current_step,updated_at=excluded.updated_at`).bind(brand,assistant,goal,timezone,demoMode?1:0,step,current?.created_at||t,t).run();
  }
  const r=await env.DB.prepare(`SELECT * FROM owner_setup WHERE id='default'`).first();
  return {brandLabel:r?.brand_label||"Kenji AI",assistantName:r?.assistant_name||"Isla",primaryGoal:r?.primary_goal||"Turn lead backlog into booked conversations",timezone:r?.timezone||"America/New_York",demoMode:Boolean(r?.demo_mode??1),currentStep:Number(r?.current_step||1),updatedAt:r?.updated_at||null};
}

async function safe(request,env,path,opts){try{return await local(request,env,path,opts);}catch(error){return {ok:false,error:error?.message||String(error)};}}
async function state(request,env){
  const [setup,handoff,checklist,highlevel,locations,voiceNumbers,smsNumbers,communication,rehearsal]=await Promise.all([
    setupProfile(env),
    safe(request,env,"/api/pass9/profile"),
    safe(request,env,"/api/pass9/checklist"),
    safe(request,env,"/api/highlevel/status"),
    safe(request,env,"/api/highlevel/locations"),
    safe(request,env,"/api/pass4/voice/numbers"),
    safe(request,env,"/api/pass6/sms/numbers"),
    safe(request,env,"/api/pass6/settings"),
    safe(request,env,"/api/pass8/rehearsal"),
  ]);
  const launchProfile=handoff?.profile||{};
  const cfg=checklist?.config||{},counts=checklist?.counts||{};
  const realLeads=Math.max(0,Number(counts.leads||0)-Number(counts.safeDemoLeads||0));
  const locationList=Array.isArray(locations?.locations)?locations.locations:[];
  const connected=Boolean(highlevel?.connected||highlevel?.status?.connected||highlevel?.highlevel?.connected);
  const calendarReady=locationList.some(x=>Boolean(x.calendarId||x.calendar_id));
  const leadSourceReady=realLeads>0||connected;
  const steps=[
    {id:"identity",label:"Brand + owner",ready:Boolean(setup.brandLabel&&setup.assistantName&&launchProfile.companyName),detail:setup.brandLabel},
    {id:"leads",label:"Lead source",ready:leadSourceReady,detail:connected?"HighLevel connected":realLeads?`${realLeads} real lead(s) loaded`:"Connect HighLevel or import real leads"},
    {id:"voice",label:"Voice number",ready:Boolean(cfg.voiceNumberRouted),detail:cfg.voiceNumberRouted?"Inbound voice routed":"Choose a Twilio voice number"},
    {id:"messaging",label:"SMS + email",ready:Boolean(cfg.smsSenderSelected&&cfg.emailSenderSelected),detail:`SMS ${cfg.smsSenderSelected?"ready":"pending"} · email ${cfg.emailSenderSelected?"ready":"pending"}`},
    {id:"calendar",label:"Booking calendar",ready:connected?calendarReady:true,optional:!connected,detail:connected?(calendarReady?"Calendar mapped":"Map a HighLevel calendar"):"Optional until HighLevel is connected"},
    {id:"platform",label:"Platform acceptance",ready:Boolean(checklist?.platformReady),detail:checklist?.platformReady?"All runtimes healthy":"Run Launch acceptance"},
    {id:"live",label:"Go-live gate",ready:Boolean(checklist?.goLiveReady),detail:checklist?.goLiveReady?"Ready for controlled live traffic":"Finish sender/routing/data setup"},
  ];
  const complete=steps.filter(x=>x.ready||x.optional).length;
  return {ok:true,setup,handoff:launchProfile,checklist,highlevel,locations:locationList,voiceNumbers:Array.isArray(voiceNumbers?.numbers)?voiceNumbers.numbers:[],smsNumbers:Array.isArray(smsNumbers?.numbers)?smsNumbers.numbers:[],communication:communication?.settings||communication,rehearsal,steps,progress:{complete,total:steps.length,percent:Math.round(100*complete/steps.length)},capturedAt:now()};
}

async function preserveSettings(request,env,patch){const current=await local(request,env,"/api/pass6/settings");const s=current?.settings||current||{};return local(request,env,"/api/pass6/settings",{method:"PUT",body:{smsFromNumber:patch.smsFromNumber??s.smsFromNumber??"",emailFrom:patch.emailFrom??s.emailFrom??"",replyTo:patch.replyTo??s.replyTo??""}});}
async function configureHighLevel(request,env,input){const locationId=clean(input.locationId,160);if(!locationId)throw new Error("HighLevel location ID is required");const location=await local(request,env,"/api/highlevel/locations",{method:"PUT",body:{locationId,name:clean(input.name,200)||locationId,businessId:clean(input.businessId,160),pipelineId:clean(input.pipelineId,160),noteUserId:clean(input.noteUserId,160),enabled:input.enabled!==false,stageMap:input.stageMap&&typeof input.stageMap==="object"?input.stageMap:{}}});let calendar=null;if(clean(input.calendarId,160)||clean(input.assignedUserId,160))calendar=await local(request,env,`/api/highlevel/pass3/locations/${encodeURIComponent(locationId)}/calendar`,{method:"PUT",body:{calendarId:clean(input.calendarId,160),assignedUserId:clean(input.assignedUserId,160)}});return {ok:true,location:location.location||location,calendar:calendar?.calendar||calendar};}
async function demoRun(env,user,input={}){const steps=Array.isArray(input.completedSteps)?input.completedSteps.map(x=>clean(x,80)).filter(Boolean).slice(0,20):[];const runId=id("tour");await env.DB.prepare(`INSERT INTO owner_demo_runs(id,mode,completed_steps_json,created_by,created_at) VALUES(?,?,?,?,?)`).bind(runId,clean(input.mode||"guided",40),JSON.stringify(steps),user.id,now()).run();return {ok:true,runId,completedSteps:steps};}

export default {async fetch(request,env,ctx){const url=new URL(request.url);if(url.pathname.startsWith("/api/pass10/")){const user=await authUser(request,env);if(!user)return json({ok:false,error:"Authentication required"},401);try{
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
const response=await app.fetch(request,env,ctx);const type=response.headers.get("content-type")||"";if(request.method==="GET"&&type.includes("text/html")){const html=await response.text(),injected=html.includes("/pass10-setup.js")?html:html.replace("</body>",'  <script src="/pass10-setup.js"></script>\n</body>');return new Response(injected,{status:response.status,headers:response.headers});}return response;}};
