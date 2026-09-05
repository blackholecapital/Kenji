import app from "./pass20.js";

const SESSION_COOKIE="kenji_session";
const SESSION_TTL=7*24*60*60*1000;
const HASH_ITERATIONS=240000;
const ATTEMPT_WINDOW=15*60*1000;
const BLOCK_MS=15*60*1000;
const MAX_FAILURES=6;

function now(){return Date.now();}
function id(prefix){return `${prefix}_${crypto.randomUUID()}`;}
function clean(v="",max=5000){return String(v??"").trim().slice(0,max);}
function bytesToHex(bytes){return [...new Uint8Array(bytes)].map(b=>b.toString(16).padStart(2,"0")).join("");}
function randomHex(bytes=32){const a=new Uint8Array(bytes);crypto.getRandomValues(a);return bytesToHex(a);}
async function sha256(value){return bytesToHex(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(String(value))));}
async function passwordHash(pass,salt,iterations=180000){const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(String(pass)),"PBKDF2",false,["deriveBits"]);const bits=await crypto.subtle.deriveBits({name:"PBKDF2",hash:"SHA-256",salt:new TextEncoder().encode(String(salt)),iterations:Number(iterations)||180000},key,256);return bytesToHex(bits);}
async function secureEqual(a,b){const [x,y]=await Promise.all([sha256(a),sha256(b)]);let d=x.length^y.length;for(let i=0;i<Math.max(x.length,y.length);i++)d|=(x.charCodeAt(i)||0)^(y.charCodeAt(i)||0);return d===0;}
function cookieValue(request,name){const raw=request.headers.get("cookie")||"";for(const part of raw.split(";")){const [k,...v]=part.trim().split("=");if(k===name)return decodeURIComponent(v.join("="));}return "";}
function sessionCookie(token,maxAge=SESSION_TTL/1000){return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${Math.floor(maxAge)}`;}
function clearCookie(){return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;}
function headers(extra={}){return {"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff","x-frame-options":"DENY","referrer-policy":"same-origin",...extra};}
function json(data,status=200,extra={}){return new Response(JSON.stringify(data,null,2),{status,headers:headers(extra)});}
function safeOrigin(request,url){const origin=request.headers.get("origin");return !origin||origin===url.origin;}
function validEmail(email){return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);}

async function ensureSettings(env){
  const t=now();
  await env.DB.prepare(`INSERT OR IGNORE INTO owner_auth_settings(id,signup_enabled,owner_user_id,created_at,updated_at) VALUES('default',1,(SELECT id FROM owner_users ORDER BY created_at ASC LIMIT 1),?,?)`).bind(t,t).run();
  return env.DB.prepare(`SELECT * FROM owner_auth_settings WHERE id='default'`).first();
}
async function currentUser(request,env){
  const token=cookieValue(request,SESSION_COOKIE);if(!token)return null;
  const hash=await sha256(token);
  return env.DB.prepare(`SELECT u.id,u.name,u.email,u.role,s.id session_id,s.expires_at FROM owner_sessions s JOIN owner_users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>? LIMIT 1`).bind(hash,now()).first();
}
async function cleanupSessions(env,userId=""){
  await env.DB.prepare(`DELETE FROM owner_sessions WHERE expires_at<=?`).bind(now()).run();
  if(userId)await env.DB.prepare(`DELETE FROM owner_sessions WHERE user_id=? AND id NOT IN (SELECT id FROM owner_sessions WHERE user_id=? ORDER BY created_at DESC LIMIT 8)`).bind(userId,userId).run();
}
async function createSession(env,userId){
  await cleanupSessions(env,userId);
  const token=randomHex(32),t=now();
  await env.DB.prepare(`INSERT INTO owner_sessions(id,user_id,token_hash,expires_at,created_at) VALUES(?,?,?,?,?)`).bind(id("sess"),userId,await sha256(token),t+SESSION_TTL,t).run();
  await cleanupSessions(env,userId);
  return token;
}
async function fingerprint(request,email,purpose){const ip=request.headers.get("cf-connecting-ip")||request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()||"unknown";return sha256(`${purpose}|${ip}|${clean(email,320).toLowerCase()}`);}
async function attemptState(env,key){
  const row=await env.DB.prepare(`SELECT failures,window_started_at,blocked_until FROM owner_login_attempts WHERE key_hash=? LIMIT 1`).bind(key).first();
  if(!row)return {failures:0,windowStartedAt:now(),blocked:false};
  if(Number(row.blocked_until||0)>now())return {failures:Number(row.failures||0),windowStartedAt:Number(row.window_started_at||now()),blocked:true,retryAfterMs:Number(row.blocked_until)-now()};
  if(now()-Number(row.window_started_at||0)>ATTEMPT_WINDOW)return {failures:0,windowStartedAt:now(),blocked:false};
  return {failures:Number(row.failures||0),windowStartedAt:Number(row.window_started_at||now()),blocked:false};
}
async function recordFailure(env,key,state){const failures=Number(state.failures||0)+1,t=now(),blocked=failures>=MAX_FAILURES?t+BLOCK_MS:null;await env.DB.prepare(`INSERT INTO owner_login_attempts(key_hash,failures,window_started_at,blocked_until,last_attempt_at) VALUES(?,?,?,?,?) ON CONFLICT(key_hash) DO UPDATE SET failures=excluded.failures,window_started_at=excluded.window_started_at,blocked_until=excluded.blocked_until,last_attempt_at=excluded.last_attempt_at`).bind(key,failures,Number(state.windowStartedAt||t),blocked,t).run();}
async function clearFailures(env,key){await env.DB.prepare(`DELETE FROM owner_login_attempts WHERE key_hash=?`).bind(key).run();}

async function signup(request,env,{bootstrapOnly=false}={}){
  const input=await request.json().catch(()=>({})),name=clean(input.name,120),email=clean(input.email,320).toLowerCase(),pass=String(input.passcode||""),confirm=String(input.confirmPasscode??pass);
  const countRow=await env.DB.prepare(`SELECT COUNT(*) n FROM owner_users`).first(),count=Number(countRow?.n||0),settings=await ensureSettings(env);
  if(bootstrapOnly&&count>0)return json({ok:false,error:"An account already exists. Use Login or New User Sign Up."},409);
  if(!bootstrapOnly&&Number(settings?.signup_enabled??1)!==1)return json({ok:false,error:"New user sign up is currently disabled by the owner."},403);
  if(!name||!validEmail(email)||pass.length<8||pass.length>256)return json({ok:false,error:"Name, a valid email, and an 8+ character passcode are required."},400);
  if(pass!==confirm)return json({ok:false,error:"Passcodes do not match."},400);
  const key=await fingerprint(request,email,"signup"),state=await attemptState(env,key);if(state.blocked){const seconds=Math.max(1,Math.ceil(state.retryAfterMs/1000));return json({ok:false,error:"Too many attempts. Try again later.",retryAfterSeconds:seconds},429,{"retry-after":String(seconds)});}
  const existing=await env.DB.prepare(`SELECT id FROM owner_users WHERE email=? LIMIT 1`).bind(email).first();if(existing){await recordFailure(env,key,state);return json({ok:false,error:"An account with that email already exists. Use Login."},409);}
  const role=count===0||!settings?.owner_user_id?"owner":"operator",userId=id("user"),salt=randomHex(16),t=now(),hash=await passwordHash(pass,salt,HASH_ITERATIONS);
  try{
    await env.DB.prepare(`INSERT INTO owner_users(id,name,email,pass_salt,pass_hash,role,pass_iterations,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)`).bind(userId,name,email,salt,hash,role,HASH_ITERATIONS,t,t).run();
    if(role==="owner")await env.DB.prepare(`UPDATE owner_auth_settings SET owner_user_id=?,updated_at=? WHERE id='default'`).bind(userId,t).run();
    const token=await createSession(env,userId);await clearFailures(env,key);
    return json({ok:true,user:{id:userId,name,email,role},signupEnabled:Number(settings?.signup_enabled??1)===1},201,{"set-cookie":sessionCookie(token)});
  }catch(error){console.error("Pass21 signup failed",error);return json({ok:false,error:"Account creation could not be completed. Refresh and try again."},500);}
}
async function login(request,env){
  const input=await request.json().catch(()=>({})),email=clean(input.email,320).toLowerCase(),pass=String(input.passcode||"");
  if(!validEmail(email)||!pass)return json({ok:false,error:"Invalid email or passcode."},401);
  const key=await fingerprint(request,email,"login"),state=await attemptState(env,key);if(state.blocked){const seconds=Math.max(1,Math.ceil(state.retryAfterMs/1000));return json({ok:false,error:"Too many failed login attempts. Try again later.",retryAfterSeconds:seconds},429,{"retry-after":String(seconds)});}
  try{
    const user=await env.DB.prepare(`SELECT id,name,email,pass_salt,pass_hash,role,pass_iterations FROM owner_users WHERE email=? LIMIT 1`).bind(email).first();
    const valid=Boolean(user)&&await secureEqual(await passwordHash(pass,user.pass_salt,Number(user.pass_iterations||180000)),user.pass_hash);
    if(!valid){await recordFailure(env,key,state);return json({ok:false,error:"Invalid email or passcode."},401);}
    const token=await createSession(env,user.id);await clearFailures(env,key);
    return json({ok:true,user:{id:user.id,name:user.name,email:user.email,role:user.role||"operator"}},200,{"set-cookie":sessionCookie(token)});
  }catch(error){console.error("Pass21 login failed",error);return json({ok:false,error:"Login storage is unavailable. The Pass 21 auth migration may still be pending."},503);}
}
async function status(request,env){
  try{
    const [user,settings,countRow]=await Promise.all([currentUser(request,env),ensureSettings(env),env.DB.prepare(`SELECT COUNT(*) n FROM owner_users`).first()]);
    const count=Number(countRow?.n||0),signupEnabled=Number(settings?.signup_enabled??1)===1;
    if(user)return json({ok:true,authenticated:true,sessionAuthenticated:true,demoView:false,bootstrapAvailable:false,signupEnabled,userCount:count,user:{id:user.id,name:user.name,email:user.email,role:user.role||"operator"}});
    return json({ok:true,authenticated:true,sessionAuthenticated:false,demoView:true,bootstrapAvailable:count===0,signupEnabled,userCount:count,user:{id:"demo-viewer",name:"Demo Viewer",email:"",role:"viewer"}});
  }catch(error){console.error("Pass21 auth status failed",error);return json({ok:true,authenticated:true,sessionAuthenticated:false,demoView:true,bootstrapAvailable:false,signupEnabled:true,userCount:0,user:{id:"demo-viewer",name:"Demo Viewer",email:"",role:"viewer"},authDegraded:true});}
}
async function accessSettings(request,env){
  const settings=await ensureSettings(env),countRow=await env.DB.prepare(`SELECT COUNT(*) n FROM owner_users`).first(),user=await currentUser(request,env);
  return json({ok:true,signupEnabled:Number(settings?.signup_enabled??1)===1,userCount:Number(countRow?.n||0),canManage:Boolean(user&&user.id===settings?.owner_user_id),user:user?{id:user.id,name:user.name,email:user.email,role:user.role||"operator"}:null});
}
async function updateSignupSettings(request,env){
  const user=await currentUser(request,env);if(!user)return json({ok:false,error:"Authentication required"},401);
  const settings=await ensureSettings(env);if(user.id!==settings?.owner_user_id&&user.role!=="owner")return json({ok:false,error:"Only the owner can change signup settings."},403);
  const input=await request.json().catch(()=>({}));if(typeof input.enabled!=="boolean")return json({ok:false,error:"enabled must be true or false"},400);
  await env.DB.prepare(`UPDATE owner_auth_settings SET signup_enabled=?,updated_at=? WHERE id='default'`).bind(input.enabled?1:0,now()).run();
  return json({ok:true,signupEnabled:input.enabled});
}
async function users(request,env){
  const user=await currentUser(request,env);if(!user)return json({ok:false,error:"Authentication required"},401);
  const settings=await ensureSettings(env);if(user.id!==settings?.owner_user_id&&user.role!=="owner")return json({ok:false,error:"Only the owner can view user access."},403);
  const result=await env.DB.prepare(`SELECT id,name,email,role,created_at FROM owner_users ORDER BY created_at ASC LIMIT 25`).all();return json({ok:true,users:(result.results||[]).map(x=>({id:x.id,name:x.name,email:x.email,role:x.role,createdAt:x.created_at}))});
}
async function logout(request,env){const token=cookieValue(request,SESSION_COOKIE);if(token)await env.DB.prepare(`DELETE FROM owner_sessions WHERE token_hash=?`).bind(await sha256(token)).run();return json({ok:true},200,{"set-cookie":clearCookie()});}

export default {
  async fetch(request,env,ctx){
    const url=new URL(request.url),method=request.method.toUpperCase();
    if(url.pathname.startsWith("/api/auth/")&&!['GET','HEAD','OPTIONS'].includes(method)&&!safeOrigin(request,url))return json({ok:false,error:"Cross-origin authentication request rejected."},403);
    try{
      if(url.pathname==="/api/auth/status"&&method==="GET")return status(request,env);
      if(url.pathname==="/api/auth/access"&&method==="GET")return accessSettings(request,env);
      if(url.pathname==="/api/auth/users"&&method==="GET")return users(request,env);
      if(url.pathname==="/api/auth/signup"&&method==="POST")return signup(request,env);
      if(url.pathname==="/api/auth/bootstrap"&&method==="POST")return signup(request,env,{bootstrapOnly:true});
      if(url.pathname==="/api/auth/login"&&method==="POST")return login(request,env);
      if(url.pathname==="/api/auth/logout"&&method==="POST")return logout(request,env);
      if(url.pathname==="/api/auth/signup-settings"&&method==="PUT")return updateSignupSettings(request,env);
    }catch(error){console.error("Pass21 auth boundary failed",error);return json({ok:false,error:"Authentication service is temporarily unavailable."},503);}

    const response=await app.fetch(request,env,ctx),type=response.headers.get("content-type")||"";
    if(method==="GET"&&type.includes("text/html")){
      let html=await response.text();
      if(!html.includes("/pass21-auth.css"))html=html.replace("</head>",'  <link rel="stylesheet" href="/pass21-auth.css">\n</head>');
      if(!html.includes("/pass21-auth.js"))html=html.replace("</body>",'  <script src="/pass21-auth.js"></script>\n</body>');
      return new Response(html,{status:response.status,headers:response.headers});
    }
    return response;
  }
};
