import app from "./index.js";

const TERMINAL=new Set(["completed","busy","failed","no-answer","canceled"]);
const STAGES=new Set(["New","Attempted","Contacted","Qualified","Booked","Won","Nurture","Lost"]);
const DISPOSITIONS=new Set(["connected","qualified","callback","appointment-request","not-interested","wrong-number","dnc","no-answer","busy","failed","canceled","unknown"]);

function clean(v="",max=6000){return String(v??"").trim().slice(0,max);}
function now(){return Date.now();}
function id(prefix){return `${prefix}_${crypto.randomUUID()}`;}
async function formBody(request){const type=request.headers.get("content-type")||"";if(type.includes("x-www-form-urlencoded"))return Object.fromEntries(new URLSearchParams(await request.text()));if(type.includes("application/json"))return request.json().catch(()=>({}));return {};}
function parseJsonText(value=""){const text=String(value||"").trim();try{return JSON.parse(text);}catch{}const fenced=text.match(/```(?:json)?\s*([\s\S]*?)```/i);if(fenced)try{return JSON.parse(fenced[1]);}catch{}const match=text.match(/\{[\s\S]*\}/);if(match)try{return JSON.parse(match[0]);}catch{}return null;}

async function runtimeClassify(env,row){
  const base=clean(env.EILA_RUNTIME_URL,1000).replace(/\/$/,""),token=clean(env.EILA_RUNTIME_TOKEN,1000);
  if(!base||!token)throw new Error("EILA runtime is not configured");
  const prompt=[
    "SYSTEM: Analyze this completed Kenji outbound lead call. Return ONE JSON object only, no markdown.",
    `Allowed disposition: connected, qualified, callback, appointment-request, not-interested, wrong-number, dnc, unknown.`,
    `Allowed nextStage: Contacted, Qualified, Nurture, Lost. Never return Booked unless an external appointment is actually created.`,
    `Schema: {"disposition":"...","confidence":0.0,"summary":"max 220 chars","nextStage":"...","nextAction":"max 180 chars","callbackAt":"","appointmentStart":"","durationMinutes":30}`,
    "callbackAt and appointmentStart must be ISO-8601 timestamps only when the lead clearly requested that time. Otherwise use empty strings.",
    `CURRENT_UTC: ${new Date().toISOString()}`,
    `LEAD: ${JSON.stringify({id:row.lead_id,name:`${row.first_name} ${row.last_name}`.trim(),company:row.company,stage:row.stage,source:row.source,sourceAccount:row.source_account,notes:row.notes})}`,
    `TRANSCRIPT:\n${clean(row.transcript,22000)}`
  ].join("\n\n");
  const response=await fetch(`${base}/chat`,{method:"POST",headers:{"content-type":"application/json","x-runtime-token":token},body:JSON.stringify({text:prompt,tenantId:"kenji",sessionId:`outcome_${row.call_id}`,firstName:row.first_name||"",interest:"call outcome extraction"})});
  const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.detail||data.error||`Outcome classification failed (${response.status})`);
  const parsed=parseJsonText(data.response||data.text);if(!parsed)throw new Error("Outcome classifier returned invalid JSON");return parsed;
}

async function saveOutcome(env,callId,providerStatus){
  const existing=await env.DB.prepare(`SELECT id FROM call_outcomes WHERE call_id=?`).bind(callId).first();if(existing)return;
  let row=await env.DB.prepare(`SELECT c.id call_id,c.lead_id,c.status call_status,c.transcript,c.duration_seconds,l.first_name,l.last_name,l.company,l.stage,l.source,l.source_account,l.notes FROM calls c JOIN leads l ON l.id=c.lead_id WHERE c.id=?`).bind(callId).first();
  if(!row)return;
  let outcome={disposition:"unknown",confidence:0,summary:"",nextStage:"",nextAction:"",callbackAt:"",appointmentStart:"",durationMinutes:30};
  const status=clean(providerStatus||row.call_status,80).toLowerCase();
  if(status!=="completed"){
    const disposition=DISPOSITIONS.has(status)?status:"unknown";
    outcome={...outcome,disposition,confidence:1,summary:`Call ended with provider status ${status}.`,nextAction:["busy","no-answer"].includes(status)?"Retry or schedule follow-up.":"Review call status."};
  }else{
    if(!clean(row.transcript,100)){await new Promise(r=>setTimeout(r,1500));row=await env.DB.prepare(`SELECT c.id call_id,c.lead_id,c.status call_status,c.transcript,c.duration_seconds,l.first_name,l.last_name,l.company,l.stage,l.source,l.source_account,l.notes FROM calls c JOIN leads l ON l.id=c.lead_id WHERE c.id=?`).bind(callId).first();}
    if(clean(row?.transcript,100)){try{outcome={...outcome,...await runtimeClassify(env,row)};}catch(error){console.error("Kenji outcome classifier failed",callId,error?.message||error);outcome={...outcome,disposition:"connected",confidence:.4,summary:"Completed call. Automatic disposition extraction needs review.",nextStage:"Contacted",nextAction:"Review transcript."};}}
    else outcome={...outcome,disposition:"connected",confidence:.2,summary:"Completed call with no final transcript available.",nextStage:"Contacted",nextAction:"Review call."};
  }
  let disposition=clean(outcome.disposition,80).toLowerCase();if(!DISPOSITIONS.has(disposition))disposition="unknown";
  const confidence=Math.max(0,Math.min(1,Number(outcome.confidence)||0)),summary=clean(outcome.summary,220),nextAction=clean(outcome.nextAction,180);
  let nextStage=clean(outcome.nextStage,40);if(!STAGES.has(nextStage)||nextStage==="Booked"||nextStage==="Won")nextStage="";
  let callbackAt=Date.parse(String(outcome.callbackAt||""));if(!Number.isFinite(callbackAt)||callbackAt<=now())callbackAt=null;
  let appointmentStart=Date.parse(String(outcome.appointmentStart||""));if(!Number.isFinite(appointmentStart)||appointmentStart<=now())appointmentStart=null;
  const duration=Math.max(15,Math.min(240,Number(outcome.durationMinutes)||30)),t=now(),outcomeId=id("outcome");
  await env.DB.prepare(`INSERT INTO call_outcomes(id,call_id,lead_id,disposition,confidence,summary,next_action,callback_at,appointment_start,raw_json,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`)
    .bind(outcomeId,callId,row.lead_id,disposition,confidence,summary,nextAction,callbackAt,appointmentStart,JSON.stringify(outcome),t,t).run();
  await env.DB.prepare(`UPDATE calls SET disposition=?,summary=?,updated_at=? WHERE id=?`).bind(disposition,summary,t,callId).run();
  if(nextStage)await env.DB.prepare(`UPDATE leads SET stage=?,updated_at=? WHERE id=?`).bind(nextStage,t,row.lead_id).run();
  if(disposition==="dnc")await env.DB.prepare(`UPDATE leads SET dnc=1,contactable=0,stage='Lost',updated_at=? WHERE id=?`).bind(t,row.lead_id).run();
  if(callbackAt){
    const exists=await env.DB.prepare(`SELECT id FROM callbacks WHERE lead_id=? AND status='queued' AND ABS(due_at-?)<300000 LIMIT 1`).bind(row.lead_id,callbackAt).first();
    if(!exists){
      const cbId=id("cb");await env.DB.prepare(`INSERT INTO callbacks(id,lead_id,due_at,status,reason,created_by,call_id,created_at,updated_at) VALUES(?,?,?,'queued',?,'voice-worker',?,?,?)`)
        .bind(cbId,row.lead_id,callbackAt,nextAction||"AI-detected callback",callId,t,t).run();
      await env.DB.prepare(`UPDATE leads SET next_callback_at=?,updated_at=? WHERE id=?`).bind(callbackAt,t,row.lead_id).run();
    }
  }
  if(appointmentStart){
    const exists=await env.DB.prepare(`SELECT id FROM appointment_intents WHERE lead_id=? AND status='pending' AND ABS(start_at-?)<300000 LIMIT 1`).bind(row.lead_id,appointmentStart).first();
    if(!exists){
      await env.DB.prepare(`INSERT INTO appointment_intents(id,lead_id,call_id,start_at,duration_minutes,title,notes,status,created_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?,'pending','voice-worker',?,?)`)
        .bind(id("appt"),row.lead_id,callId,appointmentStart,duration,`Follow-up with ${`${row.first_name} ${row.last_name}`.trim()||"lead"}`,nextAction||summary,t,t).run();
    }
  }
  await env.DB.prepare(`INSERT INTO lead_events(id,lead_id,type,actor,text,data_json,created_at) VALUES(?,?,?,?,?,?,?)`)
    .bind(id("evt"),row.lead_id,"call.outcome.extracted","voice-worker",summary||`Disposition: ${disposition}`,JSON.stringify({callId,disposition,confidence,nextStage,callbackAt,appointmentStart,nextAction}),t).run();
}

export default {
  async fetch(request,env,ctx){
    const url=new URL(request.url);
    const clone=url.pathname==="/twilio/status"&&request.method==="POST"?request.clone():null;
    const response=await app.fetch(request,env,ctx);
    if(clone&&response.ok){
      try{
        const body=await formBody(clone),status=clean(body.CallStatus,80).toLowerCase(),callId=clean(url.searchParams.get("callId"),160);
        if(callId&&TERMINAL.has(status)){
          const job=saveOutcome(env,callId,status).catch(error=>console.error("Kenji Pass 3 outcome extraction failed",callId,error?.message||error));
          if(ctx?.waitUntil)ctx.waitUntil(job);else void job;
        }
      }catch(error){console.error("Kenji Pass 3 status hook failed",error);}
    }
    return response;
  },
  async queue(batch,env,ctx){
    if(typeof app.queue==="function")return app.queue(batch,env,ctx);
  }
};
