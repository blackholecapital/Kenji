(() => {
  const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const tone=s=>String(s||'').trim().toLowerCase();
  let callbackBusy=false;

  function label(stage){const s=String(stage||'').trim();return s||'New';}
  async function callbackStageMap(){
    const r=await fetch('/api/callbacks',{headers:{accept:'application/json'}});const d=await r.json().catch(()=>({}));
    if(!r.ok||d?.ok===false)return [];
    return Array.isArray(d.callbacks)?d.callbacks:[];
  }
  async function decorateCallbacks(){
    if(callbackBusy)return;const list=$('#callbackList');if(!list)return;const cards=$$('.callback-card',list);if(!cards.length)return;
    callbackBusy=true;
    try{
      const rows=await callbackStageMap();
      cards.forEach((card,i)=>{
        const row=rows[i]||{},stage=row?.lead?.stage||row.stage||'New',t=tone(stage);
        card.dataset.stageTone=t||'new';
        let badge=$('.p13-callback-stage',card);if(!badge){badge=document.createElement('span');badge.className='p13-callback-stage';card.appendChild(badge);}badge.textContent=label(stage);
      });
    }catch{}finally{callbackBusy=false;}
  }
  function decorateLeadMeta(){
    for(const card of $$('.lead-card')){
      if(card.dataset.p13Dense)return;card.dataset.p13Dense='1';
      const meta=$('.lead-meta',card);if(!meta)continue;
      for(const row of [...meta.children]){
        const key=row.querySelector('label')?.textContent?.trim();if(key)row.dataset.metaKey=key.toLowerCase().replace(/\s+/g,'-');
      }
    }
  }
  function boot(){
    decorateLeadMeta();decorateCallbacks();
    const lead=$('#leadGrid');if(lead)new MutationObserver(()=>decorateLeadMeta()).observe(lead,{childList:true,subtree:true});
    const callbacks=$('#callbackList');if(callbacks)new MutationObserver(()=>setTimeout(decorateCallbacks,0)).observe(callbacks,{childList:true,subtree:true});
    document.addEventListener('click',e=>{if(e.target.closest('[data-view="callbacks"]'))setTimeout(decorateCallbacks,120);});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
