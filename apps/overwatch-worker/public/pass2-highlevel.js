(() => {
  const $=(s,r=document)=>r.querySelector(s);
  const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const when=t=>!t?"never":new Intl.DateTimeFormat(undefined,{month:"short",day:"numeric",hour:"numeric",minute:"2-digit"}).format(new Date(Number(t)));
  let loaded=false,status=null;

  async function api(path,options={}){
    const response=await fetch(path,{...options,headers:{accept:"application/json",...(options.body?{"content-type":"application/json"}:{}),...(options.headers||{})}});
    const data=await response.json().catch(()=>({}));
    if(!response.ok||data?.ok===false)throw new Error(data?.error||`Request failed (${response.status})`);
    return data;
  }
  function toast(message){const el=$("#toast");if(!el)return;el.textContent=message;el.classList.add("show");clearTimeout(el._hl);el._hl=setTimeout(()=>el.classList.remove("show"),2800);}
  function css(){
    if($("#highlevelPass2Css"))return;
    const style=document.createElement("style");style.id="highlevelPass2Css";style.textContent=`
      .hl-shell{margin-top:18px}.hl-head-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.hl-status{display:inline-flex;gap:8px;align-items:center;padding:7px 10px;border:1px solid rgba(255,255,255,.12);border-radius:999px;font-size:12px}.hl-status i{width:7px;height:7px;border-radius:50%;background:#ffb84d}.hl-status.live i{background:#55d98b}.hl-form{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:14px}.hl-form input,.hl-form textarea{width:100%;box-sizing:border-box}.hl-form textarea{grid-column:1/-1;min-height:82px;resize:vertical}.hl-actions{display:flex;gap:9px;align-items:center;flex-wrap:wrap;margin-top:11px}.hl-locations{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:10px;margin-top:14px}.hl-location{border:1px solid rgba(255,255,255,.09);border-radius:14px;padding:13px;background:rgba(255,255,255,.025)}.hl-location h4{margin:0 0 4px}.hl-location p{margin:0;color:var(--muted,#98a2b3);font-size:12px}.hl-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:7px;margin-top:11px}.hl-kpis div{background:rgba(255,255,255,.035);border-radius:10px;padding:8px}.hl-kpis b{display:block;font-size:18px}.hl-kpis span{font-size:10px;color:var(--muted,#98a2b3)}.hl-webhook{margin-top:12px}.hl-webhook code{word-break:break-all}.hl-note{font-size:12px;color:var(--muted,#98a2b3);margin:8px 0 0}.hl-writebacks{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.hl-writebacks span{font-size:11px;border:1px solid rgba(255,255,255,.09);border-radius:999px;padding:5px 8px}@media(max-width:850px){.hl-form{grid-template-columns:1fr}.hl-form textarea{grid-column:auto}.hl-kpis{grid-template-columns:repeat(2,1fr)}}`;
    document.head.appendChild(style);
  }
  function install(){
    const view=$("#view-integrations");if(!view||$("#highlevelPass2"))return;
    css();const panel=document.createElement("article");panel.id="highlevelPass2";panel.className="panel hl-shell";panel.innerHTML=`
      <div class="panel-head"><div><p class="eyebrow">DIRECT HIGHLEVEL BRIDGE</p><h3>Kenji sub-accounts → call center → writeback</h3></div><div class="hl-head-actions"><span id="hlStatus" class="hl-status"><i></i><b>checking</b></span><button id="hlRefresh" class="ghost small-btn">↻ Refresh</button></div></div>
      <p class="copy">Connect a HighLevel location without changing the call-center core. Contact and opportunity webhooks create or refresh the same lead tiles, completed AI calls can write notes and pipeline outcomes back, and Isla sees the aggregated agency pipeline.</p>
      <div class="hl-webhook"><label class="field-label">Verified webhook endpoint</label><div class="copy-field"><code id="hlWebhook">Loading…</code><button id="hlCopyWebhook">Copy</button></div><p class="hl-note">The endpoint verifies HighLevel's current Ed25519 <code>X-GHL-Signature</code>. No HighLevel token is entered into this browser.</p></div>
      <div class="hl-form">
        <input id="hlLocationId" placeholder="HighLevel Location ID">
        <input id="hlLocationName" placeholder="Friendly sub-account name">
        <input id="hlPipelineId" placeholder="Pipeline ID (optional)">
        <input id="hlBusinessId" placeholder="Business ID (optional)">
        <input id="hlNoteUserId" placeholder="Note author User ID (optional)">
        <input id="hlUnused" placeholder="Token stays server-side" disabled>
        <textarea id="hlStageMap" spellcheck="false" placeholder='Stage map JSON, e.g. {"GHL_STAGE_ID":"Qualified","BOOKED_STAGE_ID":"Booked"}'></textarea>
      </div>
      <div class="hl-actions"><button id="hlSave" class="primary">Save location</button><button id="hlSync" class="ghost">Pull now</button><button id="hlFlush" class="ghost">Flush call writebacks</button><span id="hlActionStatus" class="hint"></span></div>
      <div id="hlWritebacks" class="hl-writebacks"></div>
      <div id="hlLocations" class="hl-locations"></div>`;
    const flow=view.querySelector(".flow")?.closest("article.panel");if(flow)flow.before(panel);else view.appendChild(panel);
    $("#hlRefresh").addEventListener("click",()=>load(true));$("#hlSave").addEventListener("click",save);$("#hlSync").addEventListener("click",sync);$("#hlFlush").addEventListener("click",flush);$("#hlCopyWebhook").addEventListener("click",copyWebhook);
  }
  function render(){
    if(!status)return;const live=Boolean(status.connected),pill=$("#hlStatus");pill.classList.toggle("live",live);pill.querySelector("b").textContent=live?"HighLevel token connected":"bridge staged · token not connected";$("#hlWebhook").textContent=status.webhook?.url||"Unavailable";
    const summary=status.summary||{},locations=summary.locations||[];$("#hlLocations").innerHTML=locations.map(loc=>`<div class="hl-location" data-hl-location="${esc(loc.locationId)}"><h4>${esc(loc.name||loc.locationId)}</h4><p>${esc(loc.locationId)} · last pull ${esc(when(loc.lastPullAt))}</p><div class="hl-kpis"><div><b>${esc(loc.linkedLeads)}</b><span>linked leads</span></div><div><b>${esc(loc.newLeads)}</b><span>new</span></div><div><b>${esc(loc.converted)}</b><span>booked/won</span></div><div><b>${esc(loc.dnc)}</b><span>DNC</span></div></div><button class="text-btn" data-hl-edit="${esc(loc.locationId)}">Load config</button></div>`).join("")||`<div class="hl-location"><h4>No HighLevel locations yet</h4><p>Add a Location ID above. CSV and the existing Bearer lead API keep working independently.</p></div>`;
    const wb=summary.writebacks||{},webhooks=summary.webhooks||{};$("#hlWritebacks").innerHTML=`<span>webhooks ${esc(webhooks.count||0)}</span><span>writebacks sent ${esc(wb.sent||0)}</span><span>failed ${esc(wb.failed||0)}</span><span>last webhook ${esc(when(webhooks.lastAt))}</span>`;
    document.querySelectorAll("[data-hl-edit]").forEach(btn=>btn.addEventListener("click",()=>loadConfig(btn.dataset.hlEdit)));
  }
  function loadConfig(locationId){const loc=(status?.locations||[]).find(x=>x.locationId===locationId);if(!loc)return;$("#hlLocationId").value=loc.locationId||"";$("#hlLocationName").value=loc.name||"";$("#hlPipelineId").value=loc.pipelineId||"";$("#hlBusinessId").value=loc.businessId||"";$("#hlNoteUserId").value=loc.noteUserId||"";$("#hlStageMap").value=JSON.stringify(loc.stageMap||{},null,2);$("#hlActionStatus").textContent=`Loaded ${loc.name||loc.locationId}`;}
  async function load(force=false){
    install();if(loaded&&!force)return;$("#hlActionStatus").textContent="Loading HighLevel bridge…";
    try{status=await api("/api/highlevel/status");loaded=true;render();$("#hlActionStatus").textContent=status.connected?"Live token available.":"Bridge is deployed. Add HIGHLEVEL_PRIVATE_TOKEN on kenji-highlevel-worker when ready for a real account.";}catch(error){$("#hlActionStatus").textContent=error.message;}
  }
  async function save(){
    let stageMap={};const raw=$("#hlStageMap").value.trim();if(raw){try{stageMap=JSON.parse(raw);}catch{return toast("Stage map must be valid JSON");}}
    const payload={locationId:$("#hlLocationId").value.trim(),name:$("#hlLocationName").value.trim(),pipelineId:$("#hlPipelineId").value.trim(),businessId:$("#hlBusinessId").value.trim(),noteUserId:$("#hlNoteUserId").value.trim(),stageMap};if(!payload.locationId)return toast("Enter a HighLevel Location ID");
    $("#hlActionStatus").textContent="Saving location…";try{await api("/api/highlevel/locations",{method:"PUT",body:JSON.stringify(payload)});toast("HighLevel location saved");loaded=false;await load(true);}catch(error){$("#hlActionStatus").textContent=error.message;}
  }
  async function sync(){const locationId=$("#hlLocationId").value.trim();if(!locationId)return toast("Load or enter a Location ID first");$("#hlActionStatus").textContent="Pulling contacts and opportunities…";try{const result=await api("/api/highlevel/sync",{method:"POST",body:JSON.stringify({locationId})});$("#hlActionStatus").textContent=`Pulled ${result.contactsImported||0} contacts and saw ${result.opportunitiesSeen||0} opportunities.`;toast("HighLevel sync complete");loaded=false;await load(true);}catch(error){$("#hlActionStatus").textContent=error.message;}}
  async function flush(){$("#hlActionStatus").textContent="Checking completed calls…";try{const result=await api("/api/highlevel/flush-writebacks",{method:"POST",body:"{}"});$("#hlActionStatus").textContent=result.skipped?`Writeback skipped: ${result.reason}`:`Processed ${result.processed||0} call outcomes.`;loaded=false;await load(true);}catch(error){$("#hlActionStatus").textContent=error.message;}}
  async function copyWebhook(){const value=$("#hlWebhook").textContent.trim();if(!value)return;try{await navigator.clipboard.writeText(value);toast("Webhook copied");}catch{toast("Copy the webhook URL manually");}}
  function boot(){install();document.querySelector('[data-view="integrations"]')?.addEventListener("click",()=>load());if($("#view-integrations")?.classList.contains("active"))load();}
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});else boot();
})();
