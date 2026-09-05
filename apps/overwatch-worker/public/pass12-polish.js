(() => {
  const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const stageTone={new:"new",attempted:"attempted",contacted:"contacted",qualified:"qualified",nurture:"nurture",booked:"booked",won:"won",lost:"lost"};
  const svgTrash='<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v5M14 11v5"/></svg>';

  function tone(stage){return stageTone[String(stage||"").trim().toLowerCase()]||"";}
  function cardStage(card){const select=card.querySelector('[data-stage]');if(select?.value)return select.value;const row=[...card.querySelectorAll('.lead-meta div')].find(x=>x.querySelector('label')?.textContent.trim().toLowerCase()==='stage');return row?.querySelector('span')?.textContent||'';}
  function applyStageColors(root=document){
    for(const card of $$('.lead-card',root)){const t=tone(cardStage(card));if(t)card.dataset.stageTone=t;}
    for(const button of $$('[data-p11-stage],.p11-stage-tab',root)){const label=button.dataset.p11Stage??button.textContent;const t=tone(label);if(t)button.dataset.stageTone=t;else button.removeAttribute('data-stage-tone');}
  }
  function leadId(card){return card.querySelector('[data-stage]')?.dataset.stage||card.querySelector('[data-call]')?.dataset.call||card.querySelector('[data-callback]')?.dataset.callback||'';}
  function toast(msg){const el=$('#toast');if(!el)return;el.textContent=msg;el.classList.add('show');clearTimeout(el._p12);el._p12=setTimeout(()=>el.classList.remove('show'),2600);}

  async function deleteDemoLead(card,id){
    const name=card.querySelector('.lead-top b')?.textContent?.trim()||'this demo lead';
    if(!confirm(`Delete ${name} from this demo view?\n\nThis only removes the synthetic placeholder for this browser. It does not touch live CRM data.`))return;
    const r=await fetch(`/api/demo/leads/${encodeURIComponent(id)}`,{method:'DELETE',headers:{accept:'application/json'}});const d=await r.json().catch(()=>({}));if(!r.ok||d?.ok===false){toast(d?.error||`Delete failed (${r.status})`);return;}location.reload();
  }
  function demoDeleteButtons(root=document){
    for(const card of $$('.lead-card',root)){
      const id=leadId(card);if(!/^demo_/.test(id)||card.querySelector('[data-p12-demo-delete]'))continue;
      const actions=card.querySelector('.premium-lead-actions')||card.querySelector('.lead-actions');if(!actions)continue;
      const b=document.createElement('button');b.type='button';b.className='p12-demo-delete text-btn';b.dataset.p12DemoDelete='1';b.dataset.demoSafe='1';b.title='Delete demo lead';b.setAttribute('aria-label','Delete demo lead');b.innerHTML=svgTrash;b.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();deleteDemoLead(card,id);});actions.appendChild(b);
    }
    const toolbar=$('#view-leads .toolbar');if(toolbar&&!$('#p12ResetDemo')){const b=document.createElement('button');b.id='p12ResetDemo';b.type='button';b.className='ghost compact text-btn';b.dataset.demoSafe='1';b.textContent='Reset demo data';b.addEventListener('click',async()=>{if(!confirm('Restore all synthetic Kenji demo leads?'))return;await fetch('/api/demo/reset',{method:'POST'});location.reload();});toolbar.appendChild(b);}
  }

  function retireLegacyTopBrand(){$('#p12KenjiBrand')?.remove();}

  function headshotSupport(){
    for(const img of $$('#kenjiSupportPill > img,.kenji-support-head > img')){
      if(img.dataset.p12Headshot)return;img.dataset.p12Headshot='1';const wrap=document.createElement('span');wrap.className='p12-eila-headshot'+(img.closest('.kenji-support-head')?' large':'');img.parentNode.insertBefore(wrap,img);wrap.appendChild(img);
    }
  }

  function fixedSupport(){const panel=$('#kenjiSupportPanel');if(panel)panel.classList.add('p12-fixed-support');headshotSupport();}

  function enhance(){applyStageColors();demoDeleteButtons();retireLegacyTopBrand();fixedSupport();}
  function boot(){enhance();const grid=$('#leadGrid');if(grid)new MutationObserver(()=>{applyStageColors(grid);demoDeleteButtons(grid);}).observe(grid,{childList:true,subtree:true});const supportObserver=new MutationObserver(()=>fixedSupport());supportObserver.observe(document.body,{childList:true,subtree:true});document.addEventListener('change',e=>{if(e.target.matches('[data-stage]'))setTimeout(()=>applyStageColors(e.target.closest('.lead-card')),0);});}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
