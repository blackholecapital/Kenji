const SESSION_COOKIE="kenji_session";
const SESSION_TTL=7*24*60*60*1000;

function json(data,status=200,headers={}){return new Response(JSON.stringify(data,null,2),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store",...headers}});}
function clean(v="",max=5000){return String(v??"").trim().slice(0,max);}
function now(){return Date.now();}
function id(prefix){return `${prefix}_${crypto.randomUUID()}`;}
function bytesToHex(bytes){return [...new Uint8Array(bytes)].map(b=>b.toString(16).padStart(2,"0")).join("");}
function randomHex(bytes=32){const a=new Uint8Array(bytes);crypto.getRandomValues(a);return bytesToHex(a);}
async function sha256(value){return bytesToHex(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(String(value))));}
async function passwordHash(pass,salt){const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(String(pass)),"PBKDF2",false,["deriveBits"]);const bits=await crypto.subtle.deriveBits({name:"PBKDF2",hash:"SHA-256",salt:new TextEncoder().encode(salt),iterations:180000},key,256);return bytesToHex(bits);}
async function secureEqual(a,b){const [x,y]=await Promise.all([sha256(a),sha256(b)]);let d=x.length^y.length;for(let i=0;i<Math.max(x.length,y.length);i++)d|=(x.charCodeAt(i)||0)^(y.charCodeAt(i)||0);return d===0;}
function cookieValue(request,name){const cookie=request.headers.get("cookie")||"";for(const part of cookie.split(";")){const [k,...v]=part.trim().split("=");if(k===name)return decodeURIComponent(v.join("="));}return "";}
function sessionCookie(token,maxAge=SESSION_TTL/1000){return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${Math.floor(maxAge)}`;}
function clearCookie(){return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;}

async function currentUser(request,env){
  const token=cookieValue(request,SESSION_COOKIE);if(!token)return null;const hash=await sha256(token);
  const row=await env.DB.prepare(`SELECT u.id,u.name,u.email,s.id session_id,s.expires_at FROM owner_sessions s JOIN owner_users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>? LIMIT 1`).bind(hash,now()).first();return row||null;
}
async function createSession(env,userId){const token=randomHex(32);await env.DB.prepare(`INSERT INTO owner_sessions(id,user_id,token_hash,expires_at,created_at) VALUES(?,?,?,?,?)`).bind(id("sess"),userId,await sha256(token),now()+SESSION_TTL,now()).run();return token;}
async function authRoute(request,env,url){
  if(url.pathname==="/api/auth/status"&&request.method==="GET"){
    const user=await currentUser(request,env);const count=await env.DB.prepare(`SELECT COUNT(*) n FROM owner_users`).first();return json({ok:true,authenticated:Boolean(user),bootstrapAvailable:Number(count?.n||0)===0&&String(env.DEMO_BOOTSTRAP_OPEN||"true")==="true",user:user?{id:user.id,name:user.name,email:user.email}:null});
  }
  if(url.pathname==="/api/auth/bootstrap"&&request.method==="POST"){
    const count=await env.DB.prepare(`SELECT COUNT(*) n FROM owner_users`).first();if(Number(count?.n||0)>0||String(env.DEMO_BOOTSTRAP_OPEN||"true")!=="true")return json({ok:false,error:"Demo owner is already initialized"},409);
    const input=await request.json().catch(()=>({})),name=clean(input.name,120),email=clean(input.email,320).toLowerCase(),pass=String(input.passcode||"");if(!name||!email||pass.length<6)return json({ok:false,error:"Name, email and a 6+ character passcode are required"},400);
    const salt=randomHex(16),userId=id("user"),t=now();await env.DB.prepare(`INSERT INTO owner_users(id,name,email,pass_salt,pass_hash,created_at,updated_at) VALUES(?,?,?,?,?,?,?)`).bind(userId,name,email,salt,await passwordHash(pass,salt),t,t).run();const token=await createSession(env,userId);return json({ok:true,user:{id:userId,name,email}},201,{"set-cookie":sessionCookie(token)});
  }
  if(url.pathname==="/api/auth/login"&&request.method==="POST"){
    const input=await request.json().catch(()=>({})),email=clean(input.email,320).toLowerCase(),pass=String(input.passcode||"");const user=await env.DB.prepare(`SELECT * FROM owner_users WHERE email=? LIMIT 1`).bind(email).first();if(!user||!(await secureEqual(await passwordHash(pass,user.pass_salt),user.pass_hash)))return json({ok:false,error:"Invalid login"},401);const token=await createSession(env,user.id);return json({ok:true,user:{id:user.id,name:user.name,email:user.email}},200,{"set-cookie":sessionCookie(token)});
  }
  if(url.pathname==="/api/auth/logout"&&request.method==="POST"){
    const token=cookieValue(request,SESSION_COOKIE);if(token)await env.DB.prepare(`DELETE FROM owner_sessions WHERE token_hash=?`).bind(await sha256(token)).run();return json({ok:true},200,{"set-cookie":clearCookie()});
  }
  return null;
}

async function dataFetch(env,path,options={}){
  if(!env.DATA)throw new Error("DATA service binding is not configured");if(!env.INTERNAL_CALL_SECRET)throw new Error("INTERNAL_CALL_SECRET is not configured");
  const headers=new Headers(options.headers||{});headers.set("x-internal-call-secret",String(env.INTERNAL_CALL_SECRET));if(options.body&&!headers.has("content-type"))headers.set("content-type","application/json");
  return env.DATA.fetch(new Request(`https://kenji-data.internal${path}`,{...options,headers}));
}
async function proxyToData(request,env,url){
  const headers=new Headers();headers.set("x-internal-call-secret",String(env.INTERNAL_CALL_SECRET||""));const type=request.headers.get("content-type");if(type)headers.set("content-type",type);
  const options={method:request.method,headers};if(!["GET","HEAD"].includes(request.method))options.body=await request.arrayBuffer();
  const response=await env.DATA.fetch(new Request(`https://kenji-data.internal${url.pathname}${url.search}`,options));return new Response(response.body,{status:response.status,headers:response.headers});
}
async function snapshot(env){const r=await dataFetch(env,"/api/overwatch/snapshot");const data=await r.json().catch(()=>({}));if(!r.ok||data.ok===false)throw new Error(data.error||`Snapshot failed (${r.status})`);return data.snapshot||data;}

async function persistAssistant(env,sessionId,role,body,channel="chat"){
  const text=clean(body,8000);if(!text)return;await env.DB.prepare(`INSERT INTO assistant_messages(id,session_id,role,body,channel,created_at) VALUES(?,?,?,?,?,?)`).bind(id("msg"),clean(sessionId,160),clean(role,40),text,clean(channel,40),now()).run();
}
async function askIsla(request,env,user){
  const input=await request.json().catch(()=>({})),question=clean(input.question||input.message,3000);if(!question)return json({ok:false,error:"Ask Isla a question"},400);const snap=await snapshot(env),sessionId=clean(input.sessionId||`owner_${user.id}`,160);await persistAssistant(env,sessionId,"user",question);
  const context=JSON.stringify({capturedAt:snap.capturedAt,metrics:snap.metrics,dueCallbacks:(snap.dueCallbacks||[]).slice(0,10),hotLeads:(snap.hotLeads||[]).slice(0,12),staleLeads:(snap.staleLeads||[]).slice(0,8),recentCalls:(snap.recentCalls||[]).slice(0,10),sources:(snap.sources||[]).slice(0,10)}).slice(0,14000);
  const prompt=[
    `SYSTEM: You are Isla Overwatch, ${user.name}'s executive call-center operator for Kenji. You have a fresh, read-only snapshot of the live Kenji lead/call data plane. Answer the operator's question directly. Prioritize patterns, bottlenecks, hot leads, overdue callbacks, call outcomes and next actions. Distinguish facts in the snapshot from recommendations. Never invent a lead, call, metric, action or API result. If the user asks you to perform an action that this chat route cannot perform, explain the next click/action instead of claiming it happened. Keep answers concise but analytical.`,
    `LIVE_SNAPSHOT: ${context}`,
    `OPERATOR_QUESTION: ${question}`,
  ].join("\n\n");
  const base=clean(env.EILA_RUNTIME_URL,1000).replace(/\/$/,""),token=clean(env.EILA_RUNTIME_TOKEN,1000);if(!base||!token)return json({ok:false,error:"EILA runtime is not configured"},503);
  const r=await fetch(`${base}/chat`,{method:"POST",headers:{"content-type":"application/json","x-runtime-token":token},body:JSON.stringify({text:prompt,tenantId:"kenji",sessionId,firstName:user.name,interest:"call center operations"})});const data=await r.json().catch(()=>({}));if(!r.ok)return json({ok:false,error:data.detail||data.error||`Runtime failed (${r.status})`},502);const answer=clean(data.response||data.text,7000);await persistAssistant(env,sessionId,"assistant",answer);return json({ok:true,sessionId,answer,snapshotCapturedAt:snap.capturedAt});
}

function videoInstructions(user,snap){
  const compact={capturedAt:snap.capturedAt,metrics:snap.metrics,dueCallbacks:(snap.dueCallbacks||[]).slice(0,8),hotLeads:(snap.hotLeads||[]).slice(0,10),recentCalls:(snap.recentCalls||[]).slice(0,8),sources:(snap.sources||[]).slice(0,8)};
  return [
    "# Identity",
    `You are Isla Overwatch, ${user.name}'s live executive call-center operator for Kenji. You are appearing as a standing LemonSlice avatar inside the Kenji control plane.`,
    "# Job",
    "Help the owner understand the lead pipeline in real time: lead volume, source quality, hot leads, stale leads, callback backlog, calls, conversions, and what deserves attention next. Be analytical and operational, not salesy.",
    "# Live snapshot",
    "The JSON below was captured immediately before this video room opened. Treat it as factual but time-bounded. Never invent newer activity or claim a side effect occurred unless the browser confirms it.",
    JSON.stringify(compact),
    "# Conversation style",
    "Spoken output only. Be concise, natural, quick and confident. Most turns are one to three short sentences. If the owner asks a broad question, lead with the most important number or anomaly and then the action. Ask at most one question at a time.",
    "# Boundaries",
    "You may recommend calling, scheduling a callback, changing pipeline stage, importing leads or connecting the API. Do not claim those actions were executed from the video room unless a connected workflow explicitly confirms it.",
  ].join("\n\n").slice(0,12000);
}
async function videoSession(env,user){
  if(!env.VIDEO)throw new Error("VIDEO service binding is not configured");if(!env.BLACKHOLE_CAPABILITY_TOKEN)throw new Error("BLACKHOLE_CAPABILITY_TOKEN is not configured");const snap=await snapshot(env),fanId=clean(user.id,96).replace(/[^A-Za-z0-9_-]/g,"")||crypto.randomUUID();
  const payload={tenantId:"kenji",product:"kenji-isla-overwatch",creatorId:"isla",creatorName:"Isla",creatorSlug:"isla-overwatch",fanId,fanName:user.name,avatarProvider:"lemonslice",avatarSource:"image-url",avatarImageUrl:clean(env.ISLA_VIDEO_AVATAR_IMAGE_URL,2000),avatarPrompt:clean(env.ISLA_VIDEO_AVATAR_PROMPT||"Professional standing AI operator with natural attentive movement, subtle hand gestures, and calm executive presence.",600),avatarIdlePrompt:"Relaxed attentive listening, natural breathing, occasional subtle movement.",voiceProvider:"eila-runtime",voiceId:clean(env.ISLA_VIDEO_VOICE_ID||"eila",80),instructions:videoInstructions(user,snap),context:{snapshotCapturedAt:snap.capturedAt}};
  const upstream=await env.VIDEO.fetch(new Request("https://blackhole.internal/internal/video/session",{method:"POST",headers:{"content-type":"application/json","x-blackhole-capability-token":String(env.BLACKHOLE_CAPABILITY_TOKEN)},body:JSON.stringify(payload)}));const text=await upstream.text();let data={};try{data=text?JSON.parse(text):{};}catch{data={raw:text};}if(!upstream.ok||data?.ok===false)throw new Error(data.error||`Video broker failed (${upstream.status})`);return {ok:true,...data,snapshotCapturedAt:snap.capturedAt,user:{id:user.id,name:user.name}};
}
async function videoTranscript(request,env,user){const input=await request.json().catch(()=>({})),sessionId=clean(input.sessionId||input.dispatchId||input.room,160);if(!sessionId)return json({ok:false,error:"sessionId is required"},400);let saved=0;for(const row of (Array.isArray(input.messages)?input.messages:[]).slice(-160)){const text=clean(row.text||row.body,4000);if(!text)continue;await persistAssistant(env,sessionId,["owner","user","customer"].includes(String(row.role))?"user":"assistant",text,"video");saved++;}return json({ok:true,saved,ended:Boolean(input.ended),userId:user.id});}

export default {
  async fetch(request,env,ctx){
    const url=new URL(request.url);
    if(url.pathname.startsWith("/api/auth/")){const auth=await authRoute(request,env,url);if(auth)return auth;}
    if(url.pathname==="/api/health")return json({ok:true,service:"kenji-overwatch-worker",data:Boolean(env.DATA),video:Boolean(env.VIDEO),runtime:Boolean(env.EILA_RUNTIME_URL&&env.EILA_RUNTIME_TOKEN)});
    if(url.pathname.startsWith("/api/")){
      const user=await currentUser(request,env);if(!user)return json({ok:false,error:"Authentication required"},401);
      try{
        if(url.pathname==="/api/isla/ask"&&request.method==="POST")return askIsla(request,env,user);
        if(url.pathname==="/api/video/session"&&request.method==="POST")return json(await videoSession(env,user));
        if(url.pathname==="/api/video/transcript"&&request.method==="POST")return videoTranscript(request,env,user);
        if(url.pathname==="/api/video/readiness"&&request.method==="GET")return json({ok:Boolean(env.VIDEO&&env.BLACKHOLE_CAPABILITY_TOKEN&&env.ISLA_VIDEO_AVATAR_IMAGE_URL&&env.EILA_RUNTIME_TOKEN),videoBinding:Boolean(env.VIDEO),capability:Boolean(env.BLACKHOLE_CAPABILITY_TOKEN),avatar:Boolean(env.ISLA_VIDEO_AVATAR_IMAGE_URL),runtime:Boolean(env.EILA_RUNTIME_TOKEN),voiceId:clean(env.ISLA_VIDEO_VOICE_ID||"eila",80)});
        return proxyToData(request,env,url);
      }catch(e){console.error("Kenji Overwatch API failed",e);return json({ok:false,error:e.message||String(e)},500);}
    }
    return env.ASSETS.fetch(request);
  },
};
