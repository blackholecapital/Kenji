import { createDeepgramTranscriber } from "./stt.js";

function json(data,status=200){return new Response(JSON.stringify(data,null,2),{status,headers:{"content-type":"application/json; charset=utf-8"}});}
function xml(body,status=200){return new Response(body,{status,headers:{"content-type":"text/xml; charset=utf-8"}});}
function clean(v="",max=3000){return String(v??"").trim().slice(0,max);}
function escapeXml(v=""){return String(v).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&apos;");}
function now(){return Date.now();}
function basicAuth(sid,token){return `Basic ${btoa(`${sid}:${token}`)}`;}
function bytesToBase64(bytes){const v=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes);let s="";for(let i=0;i<v.length;i+=0x8000)s+=String.fromCharCode(...v.subarray(i,i+0x8000));return btoa(s);}
async function sha256(value){const d=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(String(value)));return new Uint8Array(d);}
async function secretsEqual(a,b){const [x,y]=await Promise.all([sha256(a),sha256(b)]);let diff=x.length^y.length;for(let i=0;i<Math.max(x.length,y.length);i++)diff|=(x[i]??0)^(y[i]??0);return diff===0;}
async function parseBody(request){const type=request.headers.get("content-type")||"";if(type.includes("application/json"))return request.json().catch(()=>({}));if(type.includes("x-www-form-urlencoded"))return Object.fromEntries(new URLSearchParams(await request.text()));return {};}

async function authorizeInternal(request,env){const expected=clean(env.INTERNAL_CALL_SECRET,1000),provided=request.headers.get("x-internal-call-secret")||"";return Boolean(expected&&provided&&await secretsEqual(expected,provided));}
async function validateTwilio(request,env,body){
  const token=String(env.TWILIO_AUTH_TOKEN||""),provided=request.headers.get("x-twilio-signature")||"";if(!token||!provided)return false;
  const u=new URL(request.url);let signed=`${u.protocol}//${u.host}${u.pathname}${u.search}`;for(const key of Object.keys(body||{}).sort())signed+=`${key}${body[key]??""}`;
  const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(token),{name:"HMAC",hash:"SHA-1"},false,["sign"]);const sig=new Uint8Array(await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(signed)));let binary="";for(const b of sig)binary+=String.fromCharCode(b);return btoa(binary)===provided;
}
async function lead(env,id){return env.DB.prepare(`SELECT * FROM leads WHERE id=?`).bind(id).first();}
async function call(env,id){return env.DB.prepare(`SELECT * FROM calls WHERE id=?`).bind(id).first();}
async function addMessage(env,callId,role,text){
  const value=clean(text,6000);if(!value)return;
  await env.DB.prepare(`INSERT INTO call_messages(call_id,role,text,created_at) VALUES(?,?,?,?)`).bind(callId,role,value,now()).run();
  const rows=await env.DB.prepare(`SELECT role,text FROM call_messages WHERE call_id=? ORDER BY id ASC`).bind(callId).all();
  const transcript=rows.results.map(r=>`${r.role==='customer'?'Lead':'AI'}: ${r.text}`).join("\n").slice(-30000);
  await env.DB.prepare(`UPDATE calls SET transcript=?,updated_at=? WHERE id=?`).bind(transcript,now(),callId).run();
}
async function leadEvent(env,leadId,type,text,data={}){await env.DB.prepare(`INSERT INTO lead_events(id,lead_id,type,actor,text,data_json,created_at) VALUES(?,?,?,?,?,?,?)`).bind(`evt_${crypto.randomUUID()}`,leadId,type,"voice-worker",clean(text,3000),JSON.stringify(data),now()).run();}

let numberCache={at:0,value:""};
async function outboundNumber(env){
  const configured=clean(env.TWILIO_PHONE_NUMBER,60);if(configured)return configured;
  if(numberCache.value&&now()-numberCache.at<300000)return numberCache.value;
  const sid=clean(env.TWILIO_ACCOUNT_SID,80),token=clean(env.TWILIO_AUTH_TOKEN,200);if(!sid||!token)throw new Error("Twilio credentials are not configured");
  const response=await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/IncomingPhoneNumbers.json?PageSize=100`,{headers:{Authorization:basicAuth(sid,token)}});
  const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.message||`Twilio number lookup failed (${response.status})`);
  const chosen=(data.incoming_phone_numbers||[]).find(n=>n.capabilities?.voice!==false)?.phone_number;if(!chosen)throw new Error("No voice-capable Twilio number is available on the shared account");
  numberCache={at:now(),value:String(chosen)};return String(chosen);
}
async function originateCall(env,callId){
  const c=await call(env,callId);if(!c)throw new Error("Call job not found");const l=await lead(env,c.lead_id);if(!l)throw new Error("Lead not found");
  if(!l.phone)throw new Error("Lead has no phone number");if(l.dnc||!l.contactable)throw new Error("Lead is not contactable");
  const sid=clean(env.TWILIO_ACCOUNT_SID,80),token=clean(env.TWILIO_AUTH_TOKEN,200),from=await outboundNumber(env),base=clean(env.PUBLIC_BASE_URL,1000).replace(/\/$/,"");if(!base)throw new Error("PUBLIC_BASE_URL is not configured");
  const answer=new URL(`${base}/twilio/answer`);answer.searchParams.set("callId",callId);const status=new URL(`${base}/twilio/status`);status.searchParams.set("callId",callId);
  const params=new URLSearchParams({To:l.phone,From:from,Url:answer.toString(),Method:"POST",StatusCallback:status.toString(),StatusCallbackMethod:"POST",StatusCallbackEvent:"initiated ringing answered completed"});
  const response=await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Calls.json`,{method:"POST",headers:{Authorization:basicAuth(sid,token),"content-type":"application/x-www-form-urlencoded"},body:params});
  const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.message||`Twilio call failed (${response.status})`);
  await env.DB.prepare(`UPDATE calls SET status=?,provider_sid=?,started_at=?,updated_at=? WHERE id=?`).bind(data.status||"initiated",data.sid||"",now(),now(),callId).run();
  await env.DB.prepare(`UPDATE leads SET stage=CASE WHEN stage='New' THEN 'Attempted' ELSE stage END,last_contacted_at=?,updated_at=? WHERE id=?`).bind(now(),now(),l.id).run();
  await leadEvent(env,l.id,"call.started","Outbound AI call started",{callId,providerSid:data.sid||"",from});
  return {ok:true,callId,providerSid:data.sid||"",status:data.status||"queued",from};
}

async function runtimeChat(env,state,utterance){
  const base=clean(env.EILA_RUNTIME_URL,1000).replace(/\/$/,""),token=clean(env.EILA_RUNTIME_TOKEN,1000);if(!base||!token)throw new Error("EILA runtime is not configured");
  const history=await env.DB.prepare(`SELECT role,text FROM call_messages WHERE call_id=? ORDER BY id DESC LIMIT 12`).bind(state.callId).all();
  const conversation=[...history.results].reverse().map(r=>`${r.role}: ${r.text}`).join("\n");
  const prompt=[
    "SYSTEM: You are the Kenji AI follow-up agent calling a lead who previously asked for information. Be warm, fast, concise, and natural. Your job is to understand what they need, qualify interest, answer only what is supported by the lead context, and obtain a clear next step or callback time. Never invent pricing, account details, promises, or appointments. If they ask not to be called, apologize, confirm you will stop, and do not persuade them. Keep most replies under 30 spoken words and ask one question at a time.",
    `LEAD: ${JSON.stringify({name:`${state.firstName} ${state.lastName}`.trim(),company:state.company,source:state.source,sourceAccount:state.sourceAccount,notes:state.notes,score:state.score,stage:state.stage})}`,
    `RECENT CALL: ${conversation}`,
    `CURRENT_UTTERANCE: ${utterance}`,
  ].join("\n\n");
  const response=await fetch(`${base}/chat`,{method:"POST",headers:{"content-type":"application/json","x-runtime-token":token},body:JSON.stringify({text:prompt,firstName:state.firstName,interest:state.notes||state.sourceAccount,leadScore:state.score,tenantId:"kenji",sessionId:state.callId})});
  const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.detail||data.error||`EILA runtime chat failed (${response.status})`);return clean(data.response||data.text,2400);
}
async function runtimeAudio(env,text){
  const base=clean(env.EILA_RUNTIME_URL,1000).replace(/\/$/,""),token=clean(env.EILA_RUNTIME_TOKEN,1000);if(!base||!token)throw new Error("EILA runtime is not configured");
  const response=await fetch(`${base}/tts/twilio`,{method:"POST",headers:{"content-type":"application/json","x-runtime-token":token},body:JSON.stringify({text,voice:clean(env.EILA_VOICE_ID||"eila",80)})});
  if(!response.ok)throw new Error(`EILA TTS failed (${response.status}): ${(await response.text()).slice(0,200)}`);return new Uint8Array(await response.arrayBuffer());
}

function mediaSocket(request,env,ctx){
  if((request.headers.get("upgrade")||"").toLowerCase()!=="websocket")return json({ok:false,error:"Expected websocket upgrade"},426);
  const pair=new WebSocketPair(),[client,server]=Object.values(pair);server.accept();
  const state={callId:"",leadId:"",streamSid:"",firstName:"",lastName:"",company:"",source:"",sourceAccount:"",notes:"",score:50,stage:"",turning:false,closed:false,stt:null};
  const sendAudio=(bytes)=>{if(!state.streamSid||!bytes?.length)return;try{server.send(JSON.stringify({event:"media",streamSid:state.streamSid,media:{payload:bytesToBase64(bytes)}}));}catch{}};
  const speak=async(text)=>{if(!text||state.closed)return;await addMessage(env,state.callId,"assistant",text);const audio=await runtimeAudio(env,text);sendAudio(audio);};
  const processTurn=async(transcript)=>{
    if(state.turning||state.closed)return;state.turning=true;
    try{
      await addMessage(env,state.callId,"customer",transcript);
      if(/\b(stop calling|do not call|don't call|remove me|take me off)\b/i.test(transcript)){
        await env.DB.prepare(`UPDATE leads SET dnc=1,contactable=0,stage='Lost',updated_at=? WHERE id=?`).bind(now(),state.leadId).run();await leadEvent(env,state.leadId,"lead.dnc","Lead requested no further calls",{callId:state.callId});await speak("Absolutely. I’ve marked this number not to be called again. Take care.");return;
      }
      const response=await runtimeChat(env,state,transcript);if(response)await speak(response);
    }catch(e){console.error("Kenji media turn failed",e);try{await speak("I’m sorry, I hit a connection issue. I’ll have the team follow up instead.");}catch{}}
    finally{state.turning=false;}
  };
  server.addEventListener("message",event=>{
    if(typeof event.data!=="string")return;let msg;try{msg=JSON.parse(event.data);}catch{return;}
    if(msg.event==="start"){
      state.streamSid=msg.start?.streamSid||msg.streamSid||"";const p=msg.start?.customParameters||{};state.callId=p.callId||"";state.leadId=p.leadId||"";state.firstName=p.firstName||"";state.lastName=p.lastName||"";state.company=p.company||"";state.source=p.source||"";state.sourceAccount=p.sourceAccount||"";state.notes=p.notes||"";state.score=Number(p.score||50);state.stage=p.stage||"";
      state.stt=createDeepgramTranscriber(env,{onTranscript:t=>{if(t.isFinal&&t.speechFinal)ctx.waitUntil(processTurn(t.transcript));},onError:e=>console.error("Deepgram error",e)});
      ctx.waitUntil((async()=>{await env.DB.prepare(`UPDATE calls SET status='in-progress',started_at=COALESCE(started_at,?),updated_at=? WHERE id=?`).bind(now(),now(),state.callId).run();const opening=`Hi${state.firstName?` ${state.firstName}`:""}, this is Kenji's AI follow-up assistant. You recently asked for information, and I wanted to make sure you got what you needed. Is now a good time for a quick minute?`;await speak(opening);})());
      return;
    }
    if(msg.event==="media")state.stt?.sendBase64(msg.media?.payload||"");
    if(msg.event==="stop"){state.stt?.finalize();state.stt?.close();state.closed=true;}
  });
  server.addEventListener("close",()=>{state.closed=true;state.stt?.close();});
  return new Response(null,{status:101,webSocket:client});
}

async function answerRoute(request,env,url){
  const body=await parseBody(request);if(!(await validateTwilio(request,env,body)))return xml("<Response></Response>",403);
  const callId=clean(url.searchParams.get("callId"),160),c=await call(env,callId);if(!c)return xml("<Response><Hangup/></Response>",404);const l=await lead(env,c.lead_id);if(!l)return xml("<Response><Hangup/></Response>",404);
  const base=clean(env.PUBLIC_BASE_URL,1000).replace(/\/$/,""),ws=base.replace(/^https:/,"wss:").replace(/^http:/,"ws:")+"/twilio/media";
  const params=[["callId",callId],["leadId",l.id],["firstName",l.first_name],["lastName",l.last_name],["company",l.company],["source",l.source],["sourceAccount",l.source_account],["notes",l.notes],["score",l.score],["stage",l.stage]].filter(([,v])=>String(v??"")!=="").map(([k,v])=>`      <Parameter name="${escapeXml(k)}" value="${escapeXml(clean(v,220))}"/>`).join("\n");
  return xml(`<Response>\n  <Connect>\n    <Stream url="${escapeXml(ws)}">\n${params}\n    </Stream>\n  </Connect>\n</Response>`);
}
async function statusRoute(request,env,url){
  const body=await parseBody(request);if(!(await validateTwilio(request,env,body)))return json({ok:false},403);const callId=clean(url.searchParams.get("callId"),160),status=clean(body.CallStatus||"unknown",80),duration=Number(body.CallDuration||0),ended=/completed|busy|failed|no-answer|canceled/.test(status)?now():null;
  const c=await call(env,callId);if(c){await env.DB.prepare(`UPDATE calls SET status=?,duration_seconds=?,ended_at=COALESCE(?,ended_at),error=?,updated_at=? WHERE id=?`).bind(status,duration,ended,/failed|busy|no-answer/.test(status)?status:"",now(),callId).run();if(status==="completed")await env.DB.prepare(`UPDATE leads SET stage=CASE WHEN stage IN ('New','Attempted') THEN 'Contacted' ELSE stage END,last_contacted_at=?,updated_at=? WHERE id=?`).bind(now(),now(),c.lead_id).run();await leadEvent(env,c.lead_id,"call.status",`Call status: ${status}`,{callId,duration});}
  return json({ok:true});
}

export default {
  async fetch(request,env,ctx){
    const url=new URL(request.url);
    if(url.pathname==="/health")return json({ok:true,service:"kenji-voice-worker",twilio:Boolean(env.TWILIO_ACCOUNT_SID&&env.TWILIO_AUTH_TOKEN),deepgram:Boolean(env.DEEPGRAM_API_KEY),runtime:Boolean(env.EILA_RUNTIME_URL&&env.EILA_RUNTIME_TOKEN),time:now()});
    if(url.pathname==="/twilio/media")return mediaSocket(request,env,ctx);
    if(url.pathname==="/twilio/answer"&&request.method==="POST")return answerRoute(request,env,url);
    if(url.pathname==="/twilio/status"&&request.method==="POST")return statusRoute(request,env,url);
    if(url.pathname==="/internal/calls"&&request.method==="POST"){
      if(!(await authorizeInternal(request,env)))return json({ok:false,error:"Unauthorized"},401);const body=await parseBody(request);try{return json(await originateCall(env,body.callId),202);}catch(e){return json({ok:false,error:e.message},400);}
    }
    return json({ok:false,error:"Not found"},404);
  },
  async queue(batch,env,ctx){
    for(const message of batch.messages){const job=message.body||{};if(job.type!=="call.start"){message.ack();continue;}try{await originateCall(env,job.callId);message.ack();}catch(e){console.error("Kenji call job failed",{callId:job.callId,error:e.message});const c=await call(env,job.callId);if(c){await env.DB.prepare(`UPDATE calls SET status='failed',error=?,updated_at=? WHERE id=?`).bind(clean(e.message,1000),now(),job.callId).run();await leadEvent(env,c.lead_id,"call.failed",e.message,{callId:job.callId});}message.retry();}}
  },
};
