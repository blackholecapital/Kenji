import app from "./pass11.js";

const DEMO_COOKIE="kenji_demo_hidden";
const FILTER_PATHS=new Set(["/api/overwatch/snapshot","/api/leads","/api/calls","/api/callbacks"]);

function json(data,status=200,headers={}){return new Response(JSON.stringify(data,null,2),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store",...headers}});}
function cookieValue(request,name){const raw=request.headers.get("cookie")||"";for(const part of raw.split(";")){const [k,...v]=part.trim().split("=");if(k===name)return decodeURIComponent(v.join("="));}return "";}
function hiddenIds(request){return new Set(cookieValue(request,DEMO_COOKIE).split(",").map(x=>x.trim()).filter(x=>/^demo_[A-Za-z0-9_-]+$/.test(x)).slice(0,80));}
function hiddenCookie(ids){const value=[...ids].slice(0,80).join(",");return `${DEMO_COOKIE}=${encodeURIComponent(value)}; Path=/; Secure; SameSite=Lax; Max-Age=${30*24*60*60}`;}
function clearHiddenCookie(){return `${DEMO_COOKIE}=; Path=/; Secure; SameSite=Lax; Max-Age=0`;}
function leadId(row){return row?.leadId||row?.lead_id||row?.lead?.id||row?.id||"";}
function visible(row,hidden){const id=leadId(row);return !id||!hidden.has(id);}
function uniqueLeads(rows=[]){const out=[],seen=new Set();for(const row of rows){if(!row?.id||seen.has(row.id))continue;seen.add(row.id);out.push(row);}return out;}
function recomputeSnapshot(snapshot,hidden){
  const next={...snapshot};
  next.hotLeads=(snapshot.hotLeads||[]).filter(x=>visible(x,hidden));
  next.staleLeads=(snapshot.staleLeads||[]).filter(x=>visible(x,hidden));
  next.dueCallbacks=(snapshot.dueCallbacks||[]).filter(x=>visible(x,hidden));
  next.recentCalls=(snapshot.recentCalls||[]).filter(x=>visible(x,hidden));
  const leads=uniqueLeads([...next.hotLeads,...next.staleLeads]);
  const count=stage=>leads.filter(x=>String(x.stage||"").toLowerCase()===stage.toLowerCase()).length;
  const booked=count("Booked"),won=count("Won");
  next.metrics={...(snapshot.metrics||{}),total:leads.length,new:count("New"),contacted:count("Contacted"),qualified:count("Qualified"),booked,won,dueCallbacks:next.dueCallbacks.filter(x=>Number(x.dueAt||x.due_at||0)<=Date.now()).length,conversionRate:leads.length?Math.round(((booked+won)/leads.length)*100):0};
  const sources=new Map();for(const row of leads){const source=String(row.source||"Unknown");sources.set(source,(sources.get(source)||0)+1);}next.sources=[...sources.entries()].map(([source,count])=>({source,count})).sort((a,b)=>b.count-a.count);
  return next;
}
async function filterDemoResponse(response,path,hidden){
  if(!hidden.size||!FILTER_PATHS.has(path)||(response.headers.get("content-type")||"").includes("application/json")===false)return response;
  const text=await response.text();let data={};try{data=text?JSON.parse(text):{};}catch{return new Response(text,{status:response.status,headers:response.headers});}
  if(!data?.demoView)return new Response(text,{status:response.status,headers:response.headers});
  if(path==="/api/leads")data.leads=(data.leads||[]).filter(x=>visible(x,hidden));
  if(path==="/api/calls")data.calls=(data.calls||[]).filter(x=>visible(x,hidden));
  if(path==="/api/callbacks")data.callbacks=(data.callbacks||[]).filter(x=>visible(x,hidden));
  if(path==="/api/overwatch/snapshot"&&data.snapshot)data.snapshot=recomputeSnapshot(data.snapshot,hidden);
  return json(data,response.status);
}

export default {
  async fetch(request,env,ctx){
    const url=new URL(request.url);
    if(request.method==="DELETE"&&url.pathname.startsWith("/api/demo/leads/")){
      const id=decodeURIComponent(url.pathname.slice("/api/demo/leads/".length));
      if(!/^demo_[A-Za-z0-9_-]+$/.test(id))return json({ok:false,error:"Only synthetic demo leads can be deleted here"},400);
      const hidden=hiddenIds(request);hidden.add(id);return json({ok:true,deleted:id,demoOnly:true},200,{"set-cookie":hiddenCookie(hidden)});
    }
    if(request.method==="POST"&&url.pathname==="/api/demo/reset")return json({ok:true,reset:true},200,{"set-cookie":clearHiddenCookie()});
    if(request.method==="GET"&&url.pathname==="/api/demo/hidden")return json({ok:true,hidden:[...hiddenIds(request)]});

    const response=await app.fetch(request,env,ctx);
    if(request.method==="GET"&&FILTER_PATHS.has(url.pathname))return filterDemoResponse(response,url.pathname,hiddenIds(request));
    const type=response.headers.get("content-type")||"";
    if(request.method==="GET"&&type.includes("text/html")){
      let html=await response.text();
      if(!html.includes("/pass12-polish.css"))html=html.replace("</head>",'  <link rel="stylesheet" href="/pass12-polish.css">\n</head>');
      if(!html.includes("/pass12-polish.js"))html=html.replace("</body>",'  <script src="/pass12-polish.js"></script>\n</body>');
      return new Response(html,{status:response.status,headers:response.headers});
    }
    return response;
  }
};
