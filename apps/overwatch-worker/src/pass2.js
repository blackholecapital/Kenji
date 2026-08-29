import app from "./index.js";

function json(data,status=200){return new Response(JSON.stringify(data,null,2),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store"}});}

async function authenticated(request,env){
  const cookie=request.headers.get("cookie")||"";
  const probe=new Request("https://kenji.internal/api/auth/status",{method:"GET",headers:{cookie}});
  const response=await app.fetch(probe,env,{});
  const data=await response.json().catch(()=>({}));
  return Boolean(response.ok&&data.authenticated);
}

async function proxyHighLevel(request,env,url){
  if(!env.HIGHLEVEL||typeof env.HIGHLEVEL.fetch!=="function")return json({ok:false,error:"HighLevel service binding is not configured"},503);
  if(!env.INTERNAL_CALL_SECRET)return json({ok:false,error:"Internal capability is not configured"},503);
  const headers=new Headers();
  headers.set("x-internal-call-secret",String(env.INTERNAL_CALL_SECRET));
  const type=request.headers.get("content-type");if(type)headers.set("content-type",type);
  const options={method:request.method,headers};
  if(!["GET","HEAD"].includes(request.method))options.body=await request.arrayBuffer();
  const response=await env.HIGHLEVEL.fetch(new Request(`https://kenji-highlevel.internal${url.pathname}${url.search}`,options));
  return new Response(response.body,{status:response.status,headers:response.headers});
}

export default {
  async fetch(request,env,ctx){
    const url=new URL(request.url);
    if(url.pathname.startsWith("/api/highlevel/")){
      if(!(await authenticated(request,env)))return json({ok:false,error:"Authentication required"},401);
      try{return await proxyHighLevel(request,env,url);}catch(error){console.error("Kenji HighLevel proxy failed",error);return json({ok:false,error:error?.message||String(error)},502);}
    }
    return app.fetch(request,env,ctx);
  },
};
