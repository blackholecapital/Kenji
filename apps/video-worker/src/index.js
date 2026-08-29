function json(data,status=200){return new Response(JSON.stringify(data,null,2),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store"}});}
function clean(v="",max=8000){return String(v??"").trim().slice(0,max);}
function now(){return Date.now();}
async function digest(v){return new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(String(v))));}
async function sameSecret(a,b){const [x,y]=await Promise.all([digest(a),digest(b)]);let d=x.length^y.length;for(let i=0;i<Math.max(x.length,y.length);i++)d|=(x[i]??0)^(y[i]??0);return d===0;}
async function authorized(request,env){const expected=clean(env.INTERNAL_CALL_SECRET,1000),given=request.headers.get("x-internal-call-secret")||"";return Boolean(expected&&given&&await sameSecret(expected,given));}

async function snapshot(env){
  const [counts,due,hot,recent,sources]=await Promise.all([
    env.DB.prepare(`SELECT COUNT(*) total,SUM(stage='New') new_count,SUM(stage='Qualified') qualified,SUM(stage='Booked') booked,SUM(stage='Won') won FROM leads`).first(),
    env.DB.prepare(`SELECT COUNT(*) n FROM callbacks WHERE status='queued' AND due_at<=?`).bind(now()).first(),
    env.DB.prepare(`SELECT id,first_name,last_name,company,source,source_account,stage,score FROM leads WHERE dnc=0 AND contactable=1 AND stage NOT IN ('Won','Lost') ORDER BY score DESC,updated_at DESC LIMIT 10`).all(),
    env.DB.prepare(`SELECT c.id,c.direction,c.status,c.disposition,c.summary,c.created_at,l.first_name,l.last_name,l.company FROM calls c JOIN leads l ON l.id=c.lead_id ORDER BY c.created_at DESC LIMIT 8`).all(),
    env.DB.prepare(`SELECT source,COUNT(*) count,SUM(stage IN ('Booked','Won')) converted FROM leads GROUP BY source ORDER BY count DESC LIMIT 8`).all(),
  ]);
  return {capturedAt:now(),metrics:{total:Number(counts?.total||0),new:Number(counts?.new_count||0),qualified:Number(counts?.qualified||0),booked:Number(counts?.booked||0),won:Number(counts?.won||0),dueCallbacks:Number(due?.n||0)},hotLeads:hot.results,recentCalls:recent.results,sources:sources.results};
}
function instructions(job,snap){return [
  "# Identity",
  `You are Isla Overwatch, ${job.owner_name}'s live executive call-center operator for Kenji. You are appearing as a standing LemonSlice avatar inside the Kenji control plane.`,
  "# Job",
  "Help the owner understand the lead pipeline in real time: lead volume, source quality, hot leads, callback backlog, calls, conversions, and what deserves attention next. Be analytical and operational, not salesy.",
  "# Live snapshot",
  "The JSON below was captured immediately before this governed video job opened its room. Treat it as factual but time-bounded. Never invent newer activity or claim a side effect occurred unless the browser confirms it.",
  JSON.stringify(snap),
  "# Conversation style",
  "Spoken output only. Be concise, natural, quick and confident. Most turns are one to three short sentences. Lead with the most important number or anomaly.",
  "# Boundaries",
  "You may recommend calls, callbacks, stage changes, imports and integrations. Do not claim those actions were executed from the video room unless a connected workflow explicitly confirms it."
].join("\n\n").slice(0,12000);}
async function processJob(env,jobId){
  const job=await env.DB.prepare(`SELECT * FROM video_jobs WHERE id=?`).bind(jobId).first();if(!job)return {missing:true};if(["ready","failed"].includes(job.status))return {terminal:true,status:job.status};
  const attempts=Number(job.attempts||0)+1,t=now();await env.DB.prepare(`UPDATE video_jobs SET status='creating',attempts=?,started_at=COALESCE(started_at,?),error='',updated_at=? WHERE id=?`).bind(attempts,t,t,jobId).run();
  try{
    if(!env.VIDEO||typeof env.VIDEO.fetch!=="function")throw new Error("Shared blackhole-video-worker binding is unavailable");if(!env.BLACKHOLE_CAPABILITY_TOKEN)throw new Error("BLACKHOLE_CAPABILITY_TOKEN is not configured");
    const snap=await snapshot(env),fanId=clean(job.owner_user_id,96).replace(/[^A-Za-z0-9_-]/g,"")||crypto.randomUUID();
    const payload={tenantId:"kenji",product:"kenji-isla-overwatch",creatorId:"isla",creatorName:"Isla",creatorSlug:"isla-overwatch",fanId,fanName:job.owner_name,avatarProvider:"lemonslice",avatarSource:"image-url",avatarImageUrl:clean(env.ISLA_VIDEO_AVATAR_IMAGE_URL,2000),avatarPrompt:clean(env.ISLA_VIDEO_AVATAR_PROMPT||"Professional standing AI operator with natural attentive movement, subtle hand gestures, and calm executive presence.",600),avatarIdlePrompt:"Relaxed attentive listening, natural breathing, occasional subtle movement.",voiceProvider:"eila-runtime",voiceId:clean(env.ISLA_VIDEO_VOICE_ID||"eila",80),instructions:instructions(job,snap),context:{snapshotCapturedAt:snap.capturedAt,videoJobId:jobId}};
    const upstream=await env.VIDEO.fetch(new Request("https://blackhole.internal/internal/video/session",{method:"POST",headers:{"content-type":"application/json","x-blackhole-capability-token":String(env.BLACKHOLE_CAPABILITY_TOKEN)},body:JSON.stringify(payload)}));
    const text=await upstream.text();let data={};try{data=text?JSON.parse(text):{};}catch{data={raw:text};}if(!upstream.ok||data?.ok===false)throw new Error(data.error||`Video broker failed (${upstream.status})`);
    const done=now();await env.DB.prepare(`UPDATE video_jobs SET status='ready',result_json=?,error='',completed_at=?,expires_at=?,updated_at=? WHERE id=?`).bind(JSON.stringify({...data,snapshotCapturedAt:snap.capturedAt}),done,done+10*60*1000,done,jobId).run();
    try{env.ANALYTICS?.writeDataPoint({blobs:["ready",jobId],doubles:[Date.now(),attempts]});}catch{}return {ready:true};
  }catch(error){
    const message=clean(error?.message||error,3000),failed=attempts>=5,t2=now();await env.DB.prepare(`UPDATE video_jobs SET status=?,error=?,completed_at=?,updated_at=? WHERE id=?`).bind(failed?"failed":"queued",message,failed?t2:null,t2,jobId).run();
    try{env.ANALYTICS?.writeDataPoint({blobs:[failed?"failed":"retry",jobId],doubles:[Date.now(),attempts]});}catch{}if(failed)return {failed:true,error:message};throw error;
  }
}
async function status(env){const row=await env.DB.prepare(`SELECT COUNT(*) total,SUM(status='queued') queued,SUM(status='creating') creating,SUM(status='ready') ready,SUM(status='failed') failed FROM video_jobs`).first();return {ok:true,service:"kenji-video-worker",brokerBinding:Boolean(env.VIDEO),capability:Boolean(env.BLACKHOLE_CAPABILITY_TOKEN),jobs:{total:Number(row?.total||0),queued:Number(row?.queued||0),creating:Number(row?.creating||0),ready:Number(row?.ready||0),failed:Number(row?.failed||0)}};}
export default {async fetch(request,env){const url=new URL(request.url);if(url.pathname==="/health")return json({ok:true,service:"kenji-video-worker"});if(url.pathname==="/internal/pass8/status"){if(!(await authorized(request,env)))return json({ok:false,error:"Unauthorized"},401);return json(await status(env));}return json({ok:false,error:"Not found"},404);},async queue(batch,env){for(const msg of batch.messages){const jobId=clean(msg.body?.jobId,180);if(!jobId){msg.ack();continue;}try{const result=await processJob(env,jobId);if(result.failed||result.ready||result.terminal||result.missing)msg.ack();else msg.retry({delaySeconds:15});}catch(error){console.error("Kenji video job failed",jobId,error);msg.retry({delaySeconds:15});}}}};
