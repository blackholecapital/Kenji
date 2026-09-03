(() => {
  const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const surfaces={
    campaigns:'campaigns',integrations:'integrations',agency:'agency',isla:'eila',demo:'live-demo',nurture:'nurture',scale:'scale',launch:'launch',setup:'setup'
  };

  function markSurfaces(){
    for(const [id,name] of Object.entries(surfaces)){
      const view=$(`#view-${id}`);if(!view)continue;view.classList.add('p14-surface');view.dataset.p14Surface=name;
      $$('.panel',view).forEach(p=>p.classList.add('p14-panel'));
    }
  }

  function wrapField(id,label){
    const el=$(`#${id}`);if(!el||el.closest('.p14-field'))return;
    const wrap=document.createElement('div');wrap.className='p14-field';
    if(el.classList.contains('wide')||el.classList.contains('full'))wrap.classList.add(el.classList.contains('wide')?'wide':'full');
    const lab=document.createElement('label');lab.className='field-label';lab.htmlFor=id;lab.textContent=label;
    el.parentNode.insertBefore(wrap,el);wrap.append(lab,el);
  }

  function campaignLabels(){
    const fields=[
      ['p5Name','Campaign name'],['p5Source','Source contains'],['p5Account','Subaccount / source account'],['p5Stage','Pipeline stage'],
      ['p5Score','Minimum score'],['p5Attempts','Max attempts'],['p5Retry','Retry minutes'],['p5Rate','Calls / minute']
    ];
    fields.forEach(([id,label])=>wrapField(id,label));
  }

  function nurtureLabels(){
    const fields=[
      ['p6SmsFrom','SMS sender'],['p6EmailFrom','Email From'],['p6ReplyTo','Reply-To'],
      ['p6Name','Sequence name'],['p6Source','Source filter'],['p6Account','Subaccount filter'],['p6Stage','Pipeline stage'],['p6Score','Minimum score']
    ];
    fields.forEach(([id,label])=>wrapField(id,label));
  }

  function highLevelLabels(){
    const fields=[
      ['hlLocationId','Location ID'],['hlLocationName','Subaccount name'],['hlPipelineId','Pipeline ID'],
      ['hlBusinessId','Business ID'],['hlNoteUserId','Note author user'],['hlUnused','Credential boundary'],['hlStageMap','Stage map']
    ];
    fields.forEach(([id,label])=>wrapField(id,label));
  }

  function installCssHooks(){
    if($('#p14HookCss'))return;const s=document.createElement('style');s.id='p14HookCss';s.textContent=`
      .p14-field{min-width:0}.p14-field>input,.p14-field>select,.p14-field>textarea{width:100%!important;box-sizing:border-box}.p14-field.wide,.p14-field.full{grid-column:1/-1}.p14-field .field-label{margin-bottom:4px!important}
      .p14-surface .panel-head+ .copy{margin-top:-2px!important;margin-bottom:10px!important}
      .p14-surface .row{gap:7px!important}.p14-surface code{font-size:10px}
    `;document.head.appendChild(s);
  }

  function normalize(){installCssHooks();markSurfaces();campaignLabels();nurtureLabels();highLevelLabels();}
  function boot(){normalize();const obs=new MutationObserver(records=>{let useful=false;for(const r of records){if(r.addedNodes?.length){useful=true;break;}}if(useful)requestAnimationFrame(normalize);});obs.observe(document.body,{childList:true,subtree:true});}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
