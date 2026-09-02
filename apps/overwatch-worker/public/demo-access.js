(() => {
  const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
  let sessionAuthenticated=false;

  function style(){
    if($("#demoAccessStyles"))return;
    const s=document.createElement("style");s.id="demoAccessStyles";s.textContent=`
      .auth-shell{position:fixed!important;inset:0!important;z-index:3000!important;min-height:0!important;background:rgba(3,6,10,.76)!important;backdrop-filter:blur(13px)!important;padding:20px!important}
      .auth-shell.hidden{display:none!important}.auth-card{position:relative!important;width:min(430px,calc(100vw - 32px))!important;padding:30px!important;box-shadow:0 35px 110px rgba(0,0,0,.72)!important}
      .auth-card h1{font-size:29px!important}.auth-card .brand-mark{width:42px!important;height:42px!important;font-size:20px!important;margin-bottom:18px!important}
      #demoAuthClose{position:absolute;right:15px;top:14px;width:34px;height:34px;border-radius:9px;border:1px solid #2b3746;background:#10161f;color:#aeb9c7;font-size:20px}
      #demoLoginBtn{display:inline-flex;align-items:center;gap:7px;white-space:nowrap}
      #demoModePill{display:inline-flex;align-items:center;border:1px solid rgba(49,215,255,.26);background:rgba(49,215,255,.055);color:#aeefff;border-radius:999px;padding:7px 10px;font-size:9px;font-weight:800;letter-spacing:.08em;white-space:nowrap}
      #demoModePill.live{border-color:rgba(85,230,165,.3);background:rgba(85,230,165,.06);color:#9cf2ca}
      body.demo-readonly button:not([data-view]):not([data-goto]):not(#demoLoginBtn):not(#demoAuthClose):not(#refreshBtn):not([data-copy]){cursor:pointer}
      @media(max-width:760px){#demoModePill{display:none}.top-actions{gap:5px}.top-actions .subtle{display:none}}
    `;document.head.appendChild(s);
  }
  function replaceText(root=document.body){
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);
    for(const n of nodes){if(!n.nodeValue)continue;const next=n.nodeValue.replace(/\bISLA\b/g,"EILA").replace(/\bIsla\b/g,"EILA");if(next!==n.nodeValue)n.nodeValue=next;}
    for(const el of $$('[placeholder],[title],[aria-label]',root)){for(const attr of ["placeholder","title","aria-label"]){const v=el.getAttribute(attr);if(v)el.setAttribute(attr,v.replace(/\bISLA\b/g,"EILA").replace(/\bIsla\b/g,"EILA"));}}
  }
  function openLogin(){
    const shell=$("#authShell");if(!shell)return;shell.classList.remove("hidden");replaceText(shell);setTimeout(()=>$("#authEmail")?.focus(),50);
  }
  function closeLogin(){$("#authShell")?.classList.add("hidden");}
  async function status(){
    try{const r=await fetch("/api/auth/status",{headers:{accept:"application/json"}}),d=await r.json();sessionAuthenticated=Boolean(d.sessionAuthenticated);document.body.classList.toggle("demo-readonly",!sessionAuthenticated);const btn=$("#demoLoginBtn"),pill=$("#demoModePill"),logout=$("#logoutBtn");if(btn)btn.innerHTML=sessionAuthenticated?`<span>●</span> ${String(d.user?.name||"Owner").split(/\s+/).map(x=>x[0]).join("").slice(0,2).toUpperCase()||"OWNER"}`:`<span>⌾</span> Login`;if(pill){pill.textContent=sessionAuthenticated?"OWNER MODE":"DEMO VIEW · READ ONLY";pill.classList.toggle("live",sessionAuthenticated);}if(logout)logout.style.display=sessionAuthenticated?"":"none";if(!sessionAuthenticated)closeLogin();return d;}catch{return null;}
  }
  function controls(){
    const actions=$(".top-actions");if(actions&&!$("#demoLoginBtn")){const pill=document.createElement("span");pill.id="demoModePill";pill.textContent="DEMO VIEW · READ ONLY";const btn=document.createElement("button");btn.id="demoLoginBtn";btn.className="ghost compact";btn.innerHTML="<span>⌾</span> Login";btn.addEventListener("click",openLogin);actions.prepend(btn);actions.prepend(pill);}
    const card=$("#authShell .auth-card");if(card&&!$("#demoAuthClose")){const close=document.createElement("button");close.id="demoAuthClose";close.type="button";close.textContent="×";close.setAttribute("aria-label","Close login");close.addEventListener("click",closeLogin);card.prepend(close);}
    $("#authShell")?.addEventListener("click",e=>{if(e.target.id==="authShell")closeLogin();});
  }
  function safeDemoButton(button){
    return Boolean(
      button.closest("#authShell")||
      button.closest("#kenjiSupportPanel")||
      button.closest("#p11StageChips")||
      button.id==="kenjiSupportPill"||
      button.id==="demoLoginBtn"||
      button.id==="demoAuthClose"||
      button.id==="refreshBtn"||
      button.matches("[data-view],[data-goto],[data-copy],.text-btn")
    );
  }
  function lockLiveActions(){
    document.addEventListener("click",e=>{
      if(sessionAuthenticated)return;const button=e.target.closest("button");if(!button||safeDemoButton(button))return;
      e.preventDefault();e.stopImmediatePropagation();openLogin();
    },true);
    document.addEventListener("change",e=>{if(sessionAuthenticated)return;if(e.target.matches("[data-stage]")){e.preventDefault();e.stopImmediatePropagation();openLogin();}},true);
  }
  function boot(){
    style();controls();$("#authShell")?.classList.add("hidden");$("#app")?.classList.remove("hidden");replaceText();
    const observer=new MutationObserver(records=>{for(const rec of records){for(const node of rec.addedNodes){if(node.nodeType===Node.TEXT_NODE){const next=node.nodeValue?.replace(/\bISLA\b/g,"EILA").replace(/\bIsla\b/g,"EILA");if(next&&next!==node.nodeValue)node.nodeValue=next;}else if(node.nodeType===Node.ELEMENT_NODE)replaceText(node);}}});observer.observe(document.body,{childList:true,subtree:true});
    lockLiveActions();status();
    $("#loginForm")?.addEventListener("submit",()=>{setTimeout(status,700);setTimeout(status,1800);});
    $("#logoutBtn")?.addEventListener("click",()=>setTimeout(status,400));
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});else boot();
})();
