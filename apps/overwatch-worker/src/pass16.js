import app from "./pass15.js";

const LOGIN_WINDOW_MS=15*60*1000;
const LOGIN_BLOCK_MS=15*60*1000;
const LOGIN_MAX_FAILURES=6;

function json(data,status=200,headers={}){return new Response(JSON.stringify(data,null,2),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store",...headers}});}
function now(){return Date.now();}
async function sha256(value){const b=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(String(value)));return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,"0")).join("");}
function hardenedHeaders(headers=new Headers(),{html=false,api=false}={}){
  const h=new Headers(headers);
  h.set("x-content-type-options","nosniff");
  h.set("x-frame-options","DENY");
  h.set("referrer-policy","same-origin");
  if(html||api)h.set("cache-control","no-store");
  return h;
}
function safeOrigin(request,url){const origin=request.headers.get("origin");return !origin||origin===url.origin;}
async function loginFingerprint(request,email){const ip=request.headers.get("cf-connecting-ip")||request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()||"unknown";return sha256(`${ip}|${String(email||"").trim().toLowerCase()}`);}
async function throttleStatus(env,key){
  try{
    const row=await env.DB.prepare(`SELECT key_hash,failures,window_started_at,blocked_until,last_attempt_at FROM owner_login_attempts WHERE key_hash=? LIMIT 1`).bind(key).first();
    if(!row)return {blocked:false,failures:0,windowStartedAt:now()};
    if(Number(row.blocked_until||0)>now())return {blocked:true,retryAfterMs:Number(row.blocked_until)-now(),failures:Number(row.failures||0),windowStartedAt:Number(row.window_started_at||now())};
    if(now()-Number(row.window_started_at||0)>LOGIN_WINDOW_MS)return {blocked:false,failures:0,windowStartedAt:now()};
    return {blocked:false,failures:Number(row.failures||0),windowStartedAt:Number(row.window_started_at||now())};
  }catch(error){console.error("Pass16 login throttle lookup failed",error);return {blocked:false,failures:0,windowStartedAt:now(),ledgerUnavailable:true};}
}
async function recordLoginFailure(env,key,state){
  if(state.ledgerUnavailable)return;
  try{
    const failures=Number(state.failures||0)+1,t=now(),blockedUntil=failures>=LOGIN_MAX_FAILURES?t+LOGIN_BLOCK_MS:null;
    await env.DB.prepare(`INSERT INTO owner_login_attempts(key_hash,failures,window_started_at,blocked_until,last_attempt_at) VALUES(?,?,?,?,?) ON CONFLICT(key_hash) DO UPDATE SET failures=excluded.failures,window_started_at=excluded.window_started_at,blocked_until=excluded.blocked_until,last_attempt_at=excluded.last_attempt_at`).bind(key,failures,Number(state.windowStartedAt||t),blockedUntil,t).run();
  }catch(error){console.error("Pass16 login throttle write failed",error);}
}
async function clearLoginFailures(env,key){try{await env.DB.prepare(`DELETE FROM owner_login_attempts WHERE key_hash=?`).bind(key).run();}catch(error){console.error("Pass16 login throttle clear failed",error);}}
function cleanup(env,ctx){
  try{ctx?.waitUntil?.(Promise.all([
    env.DB.prepare(`DELETE FROM owner_sessions WHERE expires_at<=?`).bind(now()).run().catch(()=>{}),
    env.DB.prepare(`DELETE FROM owner_login_attempts WHERE last_attempt_at<?`).bind(now()-24*60*60*1000).run().catch(()=>{}),
  ]));}catch{}
}

export default {
  async fetch(request,env,ctx){
    const url=new URL(request.url),method=request.method.toUpperCase(),apiPath=url.pathname.startsWith("/api/");
    cleanup(env,ctx);

    if(apiPath&&!['GET','HEAD','OPTIONS'].includes(method)&&!safeOrigin(request,url))return json({ok:false,error:"Cross-origin mutation request rejected"},403);

    if(url.pathname==="/api/auth/login"&&method==="POST"){
      const copy=request.clone(),input=await copy.json().catch(()=>({})),key=await loginFingerprint(request,input.email),state=await throttleStatus(env,key);
      if(state.blocked){const seconds=Math.max(1,Math.ceil(state.retryAfterMs/1000));return json({ok:false,error:"Too many failed login attempts. Try again later.",retryAfterSeconds:seconds},429,{"retry-after":String(seconds)});}
      const response=await app.fetch(request,env,ctx);
      if(response.ok)await clearLoginFailures(env,key);else if(response.status===401)await recordLoginFailure(env,key,state);
      return new Response(response.body,{status:response.status,headers:hardenedHeaders(response.headers,{api:true})});
    }

    let response=await app.fetch(request,env,ctx);
    const type=response.headers.get("content-type")||"";
    if(method==="GET"&&type.includes("text/html")){
      let html=await response.text();
      if(!html.includes("/pass16-hardening.css"))html=html.replace("</head>",'  <link rel="stylesheet" href="/pass16-hardening.css">\n</head>');
      if(!html.includes("/pass16-hardening.js"))html=html.replace("</body>",'  <script src="/pass16-hardening.js"></script>\n</body>');
      if(!html.includes("/pass16-handbook.js"))html=html.replace("</body>",'  <script src="/pass16-handbook.js"></script>\n</body>');
      return new Response(html,{status:response.status,headers:hardenedHeaders(response.headers,{html:true})});
    }
    return new Response(response.body,{status:response.status,headers:hardenedHeaders(response.headers,{api:apiPath})});
  }
};
