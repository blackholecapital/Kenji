(() => {
  const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const tone=s=>String(s||'').trim().toLowerCase();
  let callbackRows=[],callbackById=new Map(),callbackByLead=new Map(),loadingCallbacks=null,decorateQueued=false;

  function label(stage){const s=String(stage||'').trim();return s||'New';}
  function indexCallbacks(rows=[]){callbackRows=rows;callbackById=new Map();callbackByLead=new Map();for(const row of rows){if(row?.id)callbackById.set(String(row.id),row);if(row?.leadId)callbackByLead.set(String(row.leadId),row);}return rows;}
  async function refreshCallbackStageMap(){
    if(loadingCallbacks)return loadingCallbacks;
    loadingCallbacks=(async()=>{try{const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8000);try{const r=await fetch('/api/callbacks',{headers:{accept:'application/json'},signal:controller.signal}),d=await r.json().catch(()=>({}));if(!r.ok||d?.ok===false)return callbackRows;return indexCallbacks(Array.isArray(d.callbacks)?d.callbacks:[]);}finally{clearTimeout(timer);}}catch{return callbackRows;}finally{loadingCallbacks=null;}})();
    return loadingCallbacks;
  }
  function callbackRow(card,index=0){const cb=card.querySelector('[data-complete-cb]')?.dataset.completeCb,lead=card.querySelector('[data-call]')?.dataset.call;return callbackById.get(String(cb||''))||callbackByLead.get(String(lead||''))||callbackRows[index]||null;}
  function decorateCallbackCard(card,row){
    if(!row)return false;
    const stage=row?.lead?.stage||row.stage||'New',t=tone(stage)||'new',desired=label(stage);
    if(card.dataset.stageTone!==t)card.dataset.stageTone=t;
    card.dataset.p13Callback='1';
    let badge=$('.p13-callback-stage',card);
    if(!badge){badge=document.createElement('span');badge.className='p13-callback-stage';card.appendChild(badge);}
    if(badge.textContent!==desired)badge.textContent=desired;
    return true;
  }
  function decorateCallbacks(){decorateQueued=false;const list=$('#callbackList');if(!list)return;$$('.callback-card',list).forEach((card,i)=>decorateCallbackCard(card,callbackRow(card,i)));}
  function scheduleDecorate(){if(decorateQueued)return;decorateQueued=true;requestAnimationFrame(decorateCallbacks);}
  async function refreshAndDecorate(){await refreshCallbackStageMap();scheduleDecorate();}
  function decorateLeadMeta(){
    for(const card of $$('.lead-card')){
      if(card.dataset.p13Dense)return;card.dataset.p13Dense='1';
      const meta=$('.lead-meta',card);if(!meta)continue;
      for(const row of [...meta.children]){const key=row.querySelector('label')?.textContent?.trim();if(key)row.dataset.metaKey=key.toLowerCase().replace(/\s+/g,'-');}
    }
  }
  function boot(){
    decorateLeadMeta();refreshCallbackStageMap().then(scheduleDecorate);
    const lead=$('#leadGrid');if(lead)new MutationObserver(()=>requestAnimationFrame(decorateLeadMeta)).observe(lead,{childList:true,subtree:true});
    const callbacks=$('#callbackList');if(callbacks)new MutationObserver(scheduleDecorate).observe(callbacks,{childList:true,subtree:true});
    document.addEventListener('click',e=>{if(e.target.closest('[data-view="callbacks"]')){scheduleDecorate();refreshAndDecorate();}});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
