(() => {
  if(window.__kenjiPass21AuthBooted)return;window.__kenjiPass21AuthBooted=true;
  const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
  let access=null,signupOpen=false;
  async function api(path,options={}){const r=await fetch(path,{...options,headers:{accept:'application/json',...(options.body?{'content-type':'application/json'}:{}),...(options.headers||{})}}),d=await r.json().catch(()=>({}));if(!r.ok||d?.ok===false)throw new Error(d?.error||`Request failed (${r.status})`);return d;}
  function toast(msg){const el=$('#toast');if(!el)return;el.textContent=msg;el.classList.add('show');clearTimeout(el._p21);el._p21=setTimeout(()=>el.classList.remove('show'),3000);}
  function err(msg){const el=$('#p21SignupError');if(el)el.textContent=msg||'';}

  function authUi(){
    const card=$('#authShell .auth-card');if(!card)return;
    card.classList.add('p21-auth-card');
    const form=$('#loginForm',card);if(!form)return;
    let open=$('#p21SignupOpen',card);
    if(!open){open=document.createElement('button');open.type='button';open.id='p21SignupOpen';open.className='ghost p21-signup-open';open.textContent='New User Sign Up';open.addEventListener('click',()=>setSignup(true));form.insertAdjacentElement('afterend',open);}
    let note=$('#p21SignupNote',card);if(!note){note=document.createElement('div');note.id='p21SignupNote';note.className='p21-signup-note';open.insertAdjacentElement('afterend',note);}
    let panel=$('#p21SignupPanel',card);
    if(!panel){panel=document.createElement('form');panel.id='p21SignupPanel';panel.className='p21-signup-panel';panel.innerHTML=`<div class="p21-mode-head"><b>Create user account</b><span>For the owner or another approved tester.</span></div><input id="p21SignupName" autocomplete="name" placeholder="Name" required><input id="p21SignupEmail" type="email" autocomplete="email" placeholder="Email" required><input id="p21SignupPass" type="password" autocomplete="new-password" minlength="8" placeholder="Passcode · 8+ characters" required><input id="p21SignupConfirm" type="password" autocomplete="new-password" minlength="8" placeholder="Confirm passcode" required><button id="p21SignupSubmit" class="primary" type="submit">Create Account</button><button id="p21SignupBack" class="ghost" type="button">Back to Login</button><div id="p21SignupError" class="error"></div>`;note.insertAdjacentElement('afterend',panel);$('#p21SignupBack',panel).addEventListener('click',()=>setSignup(false));panel.addEventListener('submit',submitSignup);}
    applyAccess();
  }
  function setSignup(open){signupOpen=Boolean(open);const card=$('#authShell .auth-card'),form=$('#loginForm',card),panel=$('#p21SignupPanel',card),openBtn=$('#p21SignupOpen',card);if(form)form.classList.toggle('p21-hidden',signupOpen);if(panel)panel.classList.toggle('open',signupOpen);if(openBtn)openBtn.classList.toggle('p21-hidden',signupOpen);err('');if(signupOpen)setTimeout(()=>$('#p21SignupName')?.focus(),40);}
  function applyAccess(){const btn=$('#p21SignupOpen'),note=$('#p21SignupNote');if(!btn||!note)return;if(!access){btn.style.display='none';note.textContent='Checking account registration…';note.classList.remove('closed');return;}const enabled=access.signupEnabled===true;btn.style.display=enabled?'':'none';note.textContent=enabled?'New account registration is temporarily open for approved testers.':'New user registration is currently disabled by the owner.';note.classList.toggle('closed',!enabled);if(!enabled&&signupOpen)setSignup(false);}
  async function loadAccess(){try{access=await api('/api/auth/access');applyAccess();renderOwnerAccess();}catch(e){access={signupEnabled:false,user:null,userCount:0,canManage:false,degraded:true};applyAccess();renderOwnerAccess();console.warn('Pass21 access status failed',e);}}
  async function submitSignup(e){e.preventDefault();err('');const button=$('#p21SignupSubmit');button.disabled=true;button.textContent='Creating…';try{const pass=$('#p21SignupPass').value,confirm=$('#p21SignupConfirm').value;if(pass!==confirm)throw new Error('Passcodes do not match.');await api('/api/auth/signup',{method:'POST',body:JSON.stringify({name:$('#p21SignupName').value.trim(),email:$('#p21SignupEmail').value.trim(),passcode:pass,confirmPasscode:confirm})});location.reload();}catch(e2){err(e2.message);}finally{button.disabled=false;button.textContent='Create Account';}}

  function ensureOwnerAccess(){
    const view=$('#view-setup');if(!view||$('#p21OwnerAccess'))return;
    const stacks=$$('.p10-stack',view),target=stacks[0]||view;
    const panel=document.createElement('article');panel.id='p21OwnerAccess';panel.className='panel p21-owner-access';panel.innerHTML=`<div class="panel-head"><div><p class="eyebrow">ACCESS CONTROL</p><h3>User onboarding</h3></div><span id="p21AccessCount" class="badge">checking</span></div><p class="copy">Keep sign up open while you add approved testers, then shut it off. Existing users can still log in after registration is closed.</p><div id="p21AccessBody"><p class="copy">Checking access…</p></div>`;target.appendChild(panel);
  }
  function renderOwnerAccess(){
    ensureOwnerAccess();const body=$('#p21AccessBody'),count=$('#p21AccessCount');if(!body||!access)return;if(count)count.textContent=`${Number(access.userCount||0)} user${Number(access.userCount||0)===1?'':'s'}`;
    if(access.degraded){body.innerHTML='<div class="p21-access-locked"><b>Access service unavailable</b><span>Apply the latest auth migration, then refresh this page.</span></div>';return;}
    if(!access.user){body.innerHTML='<div class="p21-access-locked"><b>Login required</b><span>Sign in as the owner to manage new-user registration.</span></div>';return;}
    if(!access.canManage){body.innerHTML=`<div class="p21-access-locked"><b>Owner-managed</b><span>Your account can use Kenji, but only the owner can open or close registration.</span></div>`;return;}
    body.innerHTML=`<label class="p21-signup-toggle"><input id="p21SignupEnabled" type="checkbox" ${access.signupEnabled?'checked':''}><span><b>Allow new user sign up</b><small>Turn this off after your approved users have created accounts.</small></span></label><div class="p21-access-actions"><button id="p21SaveSignup" class="primary small-btn">Save access setting</button><span id="p21AccessSaveStatus" class="hint"></span></div><div id="p21UserList" class="p21-user-list"><div class="copy">Loading users…</div></div>`;
    $('#p21SaveSignup').addEventListener('click',saveSignupSetting);loadUsers();
  }
  async function saveSignupSetting(){const btn=$('#p21SaveSignup'),enabled=Boolean($('#p21SignupEnabled')?.checked);if(!btn)return;btn.disabled=true;try{const d=await api('/api/auth/signup-settings',{method:'PUT',body:JSON.stringify({enabled})});access.signupEnabled=Boolean(d.signupEnabled);$('#p21AccessSaveStatus').textContent=enabled?'Registration open':'Registration closed';applyAccess();toast(enabled?'New user sign up enabled':'New user sign up disabled');}catch(e){toast(e.message);}finally{btn.disabled=false;}}
  async function loadUsers(){const host=$('#p21UserList');if(!host)return;try{const d=await api('/api/auth/users');host.innerHTML=(d.users||[]).map(u=>`<div class="p21-user-row"><div><b>${escapeHtml(u.name)}</b><span>${escapeHtml(u.email)}</span></div><span class="badge ${u.role==='owner'?'green':''}">${escapeHtml(u.role||'operator')}</span></div>`).join('')||'<div class="copy">No users yet.</div>';}catch(e){host.innerHTML=`<div class="copy">${escapeHtml(e.message)}</div>`;}}
  function escapeHtml(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}

  function loginSubmitPolish(){const submit=$('#authSubmit');if(submit&&submit.textContent!=='Enter AI Call Center')submit.textContent='Enter AI Call Center';const old=$('#authError');if(old&&!old.dataset.p21){old.dataset.p21='1';const observer=new MutationObserver(()=>{if(/500|request failed/i.test(old.textContent||''))old.textContent='Login could not be completed. Apply the latest auth repair, refresh once, then try Login or New User Sign Up.';});observer.observe(old,{childList:true,characterData:true,subtree:true});}}

  function boot(){authUi();ensureOwnerAccess();loginSubmitPolish();loadAccess();
    document.addEventListener('click',e=>{if(e.target.closest('#demoLoginBtn'))setTimeout(()=>{authUi();loginSubmitPolish();loadAccess();},40);const view=e.target.closest('[data-view]')?.dataset.view;if(view==='setup')setTimeout(()=>{ensureOwnerAccess();loadAccess();},90);});
    const auth=$('#authShell');if(auth){let queued=false;new MutationObserver(()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;authUi();loginSubmitPolish();});}).observe(auth,{childList:true,subtree:true});}
  }
  boot();
})();