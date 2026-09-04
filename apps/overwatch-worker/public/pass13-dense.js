(() => {
  const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const tone=s=>String(s||'').trim().toLowerCase();
  let callbackRows=[],callbackById=new Map(),callbackByLead=new Map(),loadingCallbacks=null;

  function label(stage){const s=String(stage||'').trim();return s||'New';}
  function indexCallbacks(rows=[]){callbackRows=rows;callbackById=new Map();callbackByLead=new Map();for(const row of rows){if(row?.id)callbackById.set(String(row.id),row);if(row?.leadId)callbackByLead.set(String(row.leadId),row);}return rows;}
  async function refreshCallbackStageMap(){
    if(loadingCallbacks)return loadingCallbacks;
    loadingCallbacks=(async()=>{try{const r=await fetch('/api/callbacks',{headers:{accept:'application/json'}}),d=await r.json().catch(()=>({}));if(!r.ok||d?.ok===false)return callbackRows;return indexCallbacks(Array.isArray(d.callbacks)?d.callbacks:[]);}catch{return callbackRows;}finally{loadingCallbacks=null;}})();
    return loadingCallbacks;
  }
  function callbackRow(card,index=0){const cb=card.querySelector('[data-complete-cb]')?.dataset.completeCb,lead=card.querySelector('[data-call]')?.dataset.call;return callbackById.get(String(cb||''))||callbackByLead.get(String(lead||''))||callbackRows[index]||null;}
  function decorateCallbackCard(card,row){if(!row)return false;const stage=row?.lead?.stage||row.stage||'New',t=tone(stage);card.dataset.stageTone=t||'new';card.dataset.p13Callback='1';let badge=$('.p13-callback-stage',card);if(!badge){badge=document.createElement('span');badge.className='p13-callback-stage';card.appendChild(badge);}badge.textContent=label(stage);return true;}
  function decorateCallbacks(){const list=$('#callbackList');if(!list)return;const cards=$$('.callback-card',list);cards.forEach((card,i)=>decorateCallbackCard(card,callbackRow(card,i)));}
  async function refreshAndDecorate(){await refreshCallbackStageMap();decorateCallbacks();}
  function decorateLeadMeta(){
    for(const card of $$('.lead-card')){
      if(card.dataset.p13Dense)return;card.dataset.p13Dense='1';
      const meta=$('.lead-meta',card);if(!meta)continue;
      for(const row of [...meta.children]){const key=row.querySelector('label')?.textContent?.trim();if(key)row.dataset.metaKey=key.toLowerCase().replace(/\s+/g,'-');}
    }
  }
  function boot(){
    decorateLeadMeta();refreshCallbackStageMap().then(decorateCallbacks);
    const lead=$('#leadGrid');if(lead)new MutationObserver(()=>decorateLeadMeta()).observe(lead,{childList:true,subtree:true});
    const callbacks=$('#callbackList');if(callbacks)new MutationObserver(()=>decorateCallbacks()).observe(callbacks,{childList:true,subtree:true});
    document.addEventListener('click',e=>{if(e.target.closest('[data-view="callbacks"]')){decorateCallbacks();refreshAndDecorate();}});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
