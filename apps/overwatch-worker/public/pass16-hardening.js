(() => {
  const nativeFetch=window.fetch.bind(window);
  let degraded=false,errorCount=0,lastError="",lastOk=0;
  const $=(s,r=document)=>r.querySelector(s);

  function ensureChip(){
    let chip=$("#p16HealthChip");
    if(chip)return chip;
    const actions=$(".top-actions");if(!actions)return null;
    chip=document.createElement("button");chip.id="p16HealthChip";chip.type="button";chip.className="p16-health-chip";chip.title="Browser + API status";chip.innerHTML='<i></i><span>UI ready</span>';
    chip.addEventListener("click",()=>{if(degraded&&confirm(`Kenji UI is degraded${lastError?`:\n${lastError}`:""}.\n\nReload the page now?`))location.reload();});
    actions.prepend(chip);return chip;
  }
  function paint(){
    const chip=ensureChip();if(!chip)return;chip.classList.toggle("degraded",degraded);chip.querySelector("span").textContent=degraded?"UI degraded":"UI ready";chip.title=degraded?(lastError||"A browser/API error was detected. Click to reload."):"Browser + API status is healthy";
  }
  function recordError(message="Request failed"){
    errorCount++;lastError=String(message||"Request failed").slice(0,220);degraded=true;paint();
    const runtime=$("#runtimeStatus");if(runtime&&/checking|online|live/i.test(runtime.textContent||""))runtime.textContent="degraded · retry available";
  }
  function recordOk(){lastOk=Date.now();if(degraded&&errorCount<2){degraded=false;lastError="";}paint();}

  window.fetch=async function(input,init={}){
    let url;try{url=new URL(typeof input==="string"?input:input?.url,location.href);}catch{return nativeFetch(input,init);}
    const method=String(init.method||(typeof input!=="string"&&input?.method)||"GET").toUpperCase();
    if(url.origin!==location.origin||!url.pathname.startsWith("/api/")||init.signal)return nativeFetch(input,init);
    const controller=new AbortController(),timeoutMs=(method==="GET"||method==="HEAD")?7000:15000,timer=setTimeout(()=>controller.abort(),timeoutMs);
    try{
      const response=await nativeFetch(input,{...init,signal:controller.signal});
      if(response.status>=500)recordError(`${method} ${url.pathname} returned ${response.status}`);else if(response.status<400)recordOk();
      return response;
    }catch(error){
      const message=error?.name==="AbortError"?`${method} ${url.pathname} timed out after ${Math.round(timeoutMs/1000)}s`:(error?.message||String(error));recordError(message);throw new Error(message);
    }finally{clearTimeout(timer);}
  };

  window.addEventListener("error",event=>{
    if(event.filename&&event.filename.startsWith(location.origin))recordError(event.message||"Frontend script error");
  });
  window.addEventListener("unhandledrejection",event=>{
    const reason=event.reason;if(reason?.message&&!/Authentication required/i.test(reason.message))recordError(reason.message);
  });

  function watchdog(){
    ensureChip();paint();
    setTimeout(()=>{const runtime=$("#runtimeStatus");if(runtime&&/checking/i.test(runtime.textContent||""))recordError("Initial dashboard data did not finish loading");},9000);
    setInterval(()=>{
      if(document.hidden)return;
      if(degraded&&lastOk&&Date.now()-lastOk<12000){errorCount=Math.max(0,errorCount-1);if(errorCount===0){degraded=false;lastError="";paint();}}
    },12000);
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",watchdog,{once:true});else watchdog();
})();
