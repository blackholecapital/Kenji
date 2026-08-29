import app from "./index.js";

const GHL_BASE="https://services.leadconnectorhq.com";

function json(data,status=200){return new Response(JSON.stringify(data,null,2),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store"}});}
function clean(v="",max=4000){return String(v??"").trim().slice(0,max);}
function now(){return Date.now();}
function id(prefix){return `${prefix}_${crypto.randomUUID()}`;}
async function digest(value){return new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(String(value))));}
async function sameSecret(a,b){const [x,y]=await Promise.all([digest(a),digest(b)]);let d=x.length^y.length;for(let i=0;i<Math.max(x.length,y.length);i++)d|=(x[i]??0)^(y[i]??0);return d===0;}
async function internalAuthorized(request,env){const expected=clean(env.INTERNAL_CALL_SECRET,1000),given=request.headers.get("x-internal-call-secret")||"";return Boolean(expected&&given&&await sameSecret(expected,given));}
function headers(env){const token=clean(env.HIGHLEVEL_PRIVATE_TOKEN,4000);if(!token)throw new Error("HIGHLEVEL_PRIVATE_TOKEN is not configured on kenji-highlevel-worker");return {accept:"application/json","content-type":"application/json",authorization:`Bearer ${token}`,Version:"v3"};}
async function ghl(env,path,{method="GET",body}={}){const response=await fetch(`${GHL_BASE}${path}`,{method,headers:headers(env),body:body===undefined?undefined:JSON.stringify(body)});const text=await response.text();let data={};try{data=text?JSON.parse(text):{};}catch{data={raw:text};}if(!response.ok)throw new Error(data?.message||data?.error||`HighLevel ${method} ${path} failed (${response.status})`);return data;}
async function leadEvent(env,leadId,type,text,data={}){await env.DB.prepare(`INSERT INTO lead_events(id,lead_id,type,actor,text,data_json,created_at) VALUES(?,?,?,?,?,?,?)`).bind(id("evt"),leadId,type,"highlevel-worker",clean(text,3000),JSON.stringify(data),now()).run();}

async function agencyOps(env){
  const locations=await env.DB.prepare(`
    SELECT
      loc.location_id,loc.name,loc.enabled,loc.last_pull_at,loc.calendar_id,loc.assigned_user_id,
      (SELECT COUNT(*) FROM highlevel_links x WHERE x.location_id=loc.location_id) linked_leads,
      (SELECT COUNT(*) FROM highlevel_links x JOIN leads l ON l.id=x.lead_id WHERE x.location_id=loc.location_id AND l.stage='New') new_leads,
      (SELECT COUNT(*) FROM highlevel_links x JOIN leads l ON l.id=x.lead_id WHERE x.location_id=loc.location_id AND l.stage IN ('Booked','Won')) converted,
      (SELECT COUNT(*) FROM highlevel_links x JOIN leads l ON l.id=x.lead_id WHERE x.location_id=loc.location_id AND l.dnc=1) dnc,
      (SELECT COUNT(*) FROM highlevel_links x JOIN calls c ON c.lead_id=x.lead_id WHERE x.location_id=loc.location_id) calls,
      (SELECT COUNT(*) FROM highlevel_links x JOIN callbacks cb ON cb.lead_id=x.lead_id WHERE x.location_id=loc.location_id AND cb.status='queued' AND cb.due_at<=?) callbacks_due,
      (SELECT COUNT(*) FROM highlevel_links x JOIN appointment_intents ai ON ai.lead_id=x.lead_id WHERE x.location_id=loc.location_id AND ai.status='pending') appointments_pending,
      (SELECT COUNT(*) FROM highlevel_writebacks wb WHERE wb.location_id=loc.location_id AND wb.status='failed') writeback_failures
    FROM highlevel_locations loc
    ORDER BY loc.name COLLATE NOCASE,loc.location_id
  `).bind(now()).all();
  const totals=await env.DB.prepare(`
    SELECT
      (SELECT COUNT(*) FROM leads) leads,
      (SELECT COUNT(*) FROM calls) calls,
      (SELECT COUNT(*) FROM callbacks WHERE status='queued' AND due_at<=?) callbacks_due,
      (SELECT COUNT(*) FROM appointment_intents WHERE status='pending') appointments_pending,
      (SELECT COUNT(*) FROM highlevel_writebacks WHERE status='failed') writeback_failures
  `).bind(now()).first();
  return {
    connected:Boolean(clean(env.HIGHLEVEL_PRIVATE_TOKEN,4000)),
    totals:{leads:Number(totals?.leads||0),calls:Number(totals?.calls||0),callbacksDue:Number(totals?.callbacks_due||0),appointmentsPending:Number(totals?.appointments_pending||0),writebackFailures:Number(totals?.writeback_failures||0)},
    locations:locations.results.map(r=>({locationId:r.location_id,name:r.name,enabled:Boolean(r.enabled),lastPullAt:r.last_pull_at,calendarId:r.calendar_id||"",assignedUserId:r.assigned_user_id||"",linkedLeads:Number(r.linked_leads||0),newLeads:Number(r.new_leads||0),converted:Number(r.converted||0),dnc:Number(r.dnc||0),calls:Number(r.calls||0),callbacksDue:Number(r.callbacks_due||0),appointmentsPending:Number(r.appointments_pending||0),writebackFailures:Number(r.writeback_failures||0)}))
  };
}

async function calendarConfig(env,locationId,input=null){
  const row=await env.DB.prepare(`SELECT location_id,name,calendar_id,assigned_user_id FROM highlevel_locations WHERE location_id=?`).bind(locationId).first();if(!row)throw new Error("HighLevel location is not configured");
  if(input)await env.DB.prepare(`UPDATE highlevel_locations SET calendar_id=?,assigned_user_id=?,updated_at=? WHERE location_id=?`).bind(clean(input.calendarId,160),clean(input.assignedUserId,160),now(),locationId).run();
  const current=await env.DB.prepare(`SELECT location_id,name,calendar_id,assigned_user_id FROM highlevel_locations WHERE location_id=?`).bind(locationId).first();
  return {locationId:current.location_id,name:current.name,calendarId:current.calendar_id||"",assignedUserId:current.assigned_user_id||""};
}

async function listIntents(env){
  const rs=await env.DB.prepare(`SELECT ai.*,l.first_name,l.last_name,l.company,l.phone,l.email,hl.location_id,hl.contact_id,loc.name location_name,loc.calendar_id,loc.assigned_user_id FROM appointment_intents ai JOIN leads l ON l.id=ai.lead_id LEFT JOIN highlevel_links hl ON hl.lead_id=ai.lead_id LEFT JOIN highlevel_locations loc ON loc.location_id=hl.location_id ORDER BY CASE ai.status WHEN 'pending' THEN 0 ELSE 1 END,ai.start_at ASC LIMIT 100`).all();
  return rs.results.map(r=>({id:r.id,leadId:r.lead_id,callId:r.call_id||"",startAt:r.start_at,durationMinutes:r.duration_minutes,title:r.title,notes:r.notes,status:r.status,externalAppointmentId:r.external_appointment_id||"",createdBy:r.created_by,lead:{firstName:r.first_name,lastName:r.last_name,company:r.company,phone:r.phone,email:r.email},highlevel:{locationId:r.location_id||"",locationName:r.location_name||"",contactId:r.contact_id||"",calendarId:r.calendar_id||"",assignedUserId:r.assigned_user_id||""}}));
}

async function createIntent(env,input={}){
  const leadId=clean(input.leadId,160);if(!leadId)throw new Error("leadId is required");
  const lead=await env.DB.prepare(`SELECT id,first_name,last_name FROM leads WHERE id=?`).bind(leadId).first();if(!lead)throw new Error("Lead not found");
  const link=await env.DB.prepare(`SELECT location_id,contact_id FROM highlevel_links WHERE lead_id=?`).bind(leadId).first();if(!link?.contact_id)throw new Error("This lead is not linked to a HighLevel contact yet");
  let startAt=Number(input.startAt??input.startTime);if(!Number.isFinite(startAt))startAt=Date.parse(String(input.startAt??input.startTime??""));if(!Number.isFinite(startAt)||startAt<=now())throw new Error("A future appointment start time is required");
  const duration=Math.max(15,Math.min(240,Number(input.durationMinutes||30))),intentId=id("appt"),t=now(),title=clean(input.title||`Follow-up with ${`${lead.first_name} ${lead.last_name}`.trim()||"lead"}`,240);
  await env.DB.prepare(`INSERT INTO appointment_intents(id,lead_id,call_id,start_at,duration_minutes,title,notes,status,created_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?,'pending',?,?,?)`).bind(intentId,leadId,clean(input.callId,160)||null,startAt,duration,title,clean(input.notes,2000),clean(input.createdBy||"operator",80),t,t).run();
  await leadEvent(env,leadId,"appointment.intent.created","Appointment intent created",{intentId,startAt,durationMinutes:duration,locationId:link.location_id});
  return (await listIntents(env)).find(x=>x.id===intentId);
}

async function confirmIntent(env,intentId){
  const row=await env.DB.prepare(`SELECT ai.*,l.first_name,l.last_name,hl.location_id,hl.contact_id,loc.calendar_id,loc.assigned_user_id FROM appointment_intents ai JOIN leads l ON l.id=ai.lead_id LEFT JOIN highlevel_links hl ON hl.lead_id=ai.lead_id LEFT JOIN highlevel_locations loc ON loc.location_id=hl.location_id WHERE ai.id=? LIMIT 1`).bind(intentId).first();
  if(!row)throw new Error("Appointment intent not found");if(row.status==="booked")return {ok:true,idempotent:true,intentId,appointmentId:row.external_appointment_id};if(row.status!=="pending")throw new Error(`Appointment intent is ${row.status}`);if(!row.location_id||!row.contact_id)throw new Error("Lead is not linked to HighLevel");if(!row.calendar_id)throw new Error("Set a HighLevel calendar ID for this subaccount before booking");
  const start=new Date(Number(row.start_at));if(Number.isNaN(start.getTime()))throw new Error("Appointment start time is invalid");const end=new Date(start.getTime()+Number(row.duration_minutes||30)*60000);
  const body={title:row.title||"Kenji follow-up",calendarId:row.calendar_id,locationId:row.location_id,contactId:row.contact_id,startTime:start.toISOString(),endTime:end.toISOString(),appointmentStatus:"confirmed",description:clean(row.notes||"Booked by Kenji AI Call Center / Isla Overwatch",1000),toNotify:true,ignoreDateRange:false,ignoreFreeSlotValidation:false};if(row.assigned_user_id)body.assignedUserId=row.assigned_user_id;
  const result=await ghl(env,"/calendars/events/appointments",{method:"POST",body}),appointment=result.appointment||result,eventId=clean(appointment.id||result.id,160);if(!eventId)throw new Error("HighLevel created the appointment but returned no event ID");const t=now();
  await env.DB.batch([env.DB.prepare(`UPDATE appointment_intents SET status='booked',external_appointment_id=?,updated_at=? WHERE id=?`).bind(eventId,t,intentId),env.DB.prepare(`UPDATE leads SET stage='Booked',next_callback_at=NULL,updated_at=? WHERE id=?`).bind(t,row.lead_id),env.DB.prepare(`UPDATE callbacks SET status='completed',updated_at=? WHERE lead_id=? AND status='queued'`).bind(t,row.lead_id)]);
  await leadEvent(env,row.lead_id,"appointment.booked","HighLevel appointment booked",{intentId,appointmentId:eventId,startAt:row.start_at,calendarId:row.calendar_id,locationId:row.location_id});return {ok:true,intentId,appointmentId:eventId,appointment};
}

async function pass3Route(request,env,url){
  if(!(await internalAuthorized(request,env)))return json({ok:false,error:"Unauthorized"},401);
  try{
    if(url.pathname==="/api/highlevel/pass3/agency-ops"&&request.method==="GET")return json({ok:true,agency:await agencyOps(env)});
    if(url.pathname==="/api/highlevel/pass3/appointments"&&request.method==="GET")return json({ok:true,appointments:await listIntents(env)});
    if(url.pathname==="/api/highlevel/pass3/appointments"&&request.method==="POST")return json({ok:true,appointment:await createIntent(env,await request.json().catch(()=>({})))},201);
    const configMatch=url.pathname.match(/^\/api\/highlevel\/pass3\/locations\/([^/]+)\/calendar$/);if(configMatch&&request.method==="GET")return json({ok:true,calendar:await calendarConfig(env,decodeURIComponent(configMatch[1]))});if(configMatch&&request.method==="PUT")return json({ok:true,calendar:await calendarConfig(env,decodeURIComponent(configMatch[1]),await request.json().catch(()=>({})))});
    const confirmMatch=url.pathname.match(/^\/api\/highlevel\/pass3\/appointments\/([^/]+)\/confirm$/);if(confirmMatch&&request.method==="POST")return json(await confirmIntent(env,decodeURIComponent(confirmMatch[1])));
    return json({ok:false,error:"Pass 3 HighLevel route not found"},404);
  }catch(error){console.error("Kenji HighLevel Pass 3 failed",error);return json({ok:false,error:error?.message||String(error)},400);}
}

export default {async fetch(request,env,ctx){const url=new URL(request.url);if(url.pathname.startsWith("/api/highlevel/pass3/"))return pass3Route(request,env,url);return app.fetch(request,env,ctx);},async scheduled(controller,env,ctx){if(typeof app.scheduled==="function")return app.scheduled(controller,env,ctx);}};
