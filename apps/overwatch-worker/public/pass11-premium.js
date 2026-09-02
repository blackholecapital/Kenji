(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  const EILA_AVATAR = "https://eila-overwatch-worker.cryptocapitalgroupfl.workers.dev/eila-avatar.png";

  const icon = (name, size = 18) => {
    const paths = {
      home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M9 21v-7h6v7"/>',
      users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
      phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.68 2.8a2 2 0 0 1-.45 2.11L8.07 9.9a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.32 1.84.55 2.8.68A2 2 0 0 1 22 16.92z"/>',
      message: '<path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/>',
      mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
      calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/>',
      refresh: '<path d="M20 11a8 8 0 1 0 2 5"/><path d="M20 4v7h-7"/>',
      search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>',
      sparkle: '<path d="m12 3 1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5z"/><path d="m19 15 .8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>',
      help: '<circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 1 1 5.8 1c0 2-3 2-3 4"/><path d="M12 18h.01"/>',
      chevron: '<path d="m9 18 6-6-6-6"/>',
      close: '<path d="M18 6 6 18M6 6l12 12"/>',
      check: '<path d="m20 6-11 11-5-5"/>',
      zap: '<path d="M13 2 3 14h9l-1 8 10-12h-9z"/>',
      filter: '<path d="M4 6h16M7 12h10M10 18h4"/>',
      lock: '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
    };
    return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.sparkle}</svg>`;
  };

  const faqs = [
    {
      category: "Getting started",
      q: "What should I do first?",
      a: `<p>Start on <b>Overview</b>. It tells you what is happening right now: total leads, new leads, due callbacks, booked appointments, conversion rate, hot leads, recent calls, and source performance.</p><ol><li>Review the six KPI cards.</li><li>Check <b>Hot leads</b> for the best opportunities.</li><li>Check <b>Due callbacks</b> so nothing falls through the cracks.</li><li>Open <b>Lead Pipeline</b> when you need to work individual records.</li><li>Use <b>EILA Overwatch</b> when you want the system to explain the pipeline in plain English.</li></ol>`
    },
    {
      category: "Getting started",
      q: "What is Demo View versus Owner Mode?",
      a: `<p><b>Demo View</b> is read-only. It lets someone explore the interface without exposing or changing live customer data.</p><p><b>Owner Mode</b> unlocks live actions such as calling, callbacks, stage changes, sender configuration, campaigns, integrations, and EILA Live. Use the Login button in the top-right to enter Owner Mode.</p>`
    },
    {
      category: "Dashboard",
      q: "How do I read the Command Center?",
      a: `<p>The Command Center is the real-time operating view.</p><ul><li><b>Total Leads:</b> everyone currently in the pipeline.</li><li><b>New:</b> leads that still need first contact.</li><li><b>Due Callbacks:</b> follow-ups that are due now or soon.</li><li><b>Contacted:</b> leads the system has reached.</li><li><b>Booked:</b> appointments created from the pipeline.</li><li><b>Conversion:</b> booked and won performance.</li><li><b>Priority Queue:</b> highest-score leads to work first.</li><li><b>Source Intelligence:</b> where leads are coming from and which channels are producing volume.</li></ul>`
    },
    {
      category: "Leads",
      q: "How do lead cards work?",
      a: `<p>Each lead card is a compact customer record. The score in the top-right is the lead priority score. Higher scores should generally be worked first.</p><p>The card shows stage, source, account/location, last contact, and notes. The action bar along the bottom gives you fast access to phone, text, email, callback/calendar, and stage controls.</p><p>In Demo View those actions ask you to log in. In Owner Mode they route into the live communication or follow-up tools.</p>`
    },
    {
      category: "Leads",
      q: "What do the pipeline stages mean?",
      a: `<ul><li><b>New:</b> untouched or newly imported.</li><li><b>Attempted:</b> contact attempted but not yet connected.</li><li><b>Contacted:</b> live contact established.</li><li><b>Qualified:</b> real opportunity worth advancing.</li><li><b>Booked:</b> appointment scheduled.</li><li><b>Won:</b> converted customer.</li><li><b>Nurture:</b> not ready now, but worth following up.</li><li><b>Lost:</b> closed out or disqualified.</li></ul>`
    },
    {
      category: "Calls",
      q: "How do AI calls and callbacks work?",
      a: `<p><b>Calls</b> shows the live and historical voice pipeline. You can see status, direction, duration, disposition, start time, and any call summary or error.</p><p><b>Callbacks</b> is the follow-up queue. When a lead needs a later touch, schedule a callback from the lead card. The dispatcher watches the queue and keeps due follow-ups visible.</p><p>The voice stack uses the configured Twilio number, Deepgram speech recognition, and the EILA voice runtime.</p>`
    },
    {
      category: "Campaigns",
      q: "How do outbound campaigns work?",
      a: `<p>Campaigns are for controlled outbound calling at scale.</p><ol><li>Choose the audience filters.</li><li>Preview the audience before sending anything.</li><li>Create the campaign as a draft.</li><li>Set attempts, retry timing, and calls per minute.</li><li>Launch explicitly when the audience is correct.</li><li>Use Pause or Pause All if you need to stop new dispatches.</li></ol><p>DNC, non-contactable, Won, and Lost leads are blocked by the campaign safety rules.</p>`
    },
    {
      category: "Integrations",
      q: "How do I connect lead sources or HighLevel?",
      a: `<p>Use <b>Integrations</b> for CSV import and API ingestion. CSV is best for a fast bulk load; the API is best for continuously pushing new leads into Kenji.</p><p><b>Owner Setup</b> contains the guided HighLevel configuration for location, pipeline, and calendar mapping. The HighLevel private token stays server-side and is never exposed to the browser.</p>`
    },
    {
      category: "Agency Ops",
      q: "What is Agency Ops for?",
      a: `<p>Agency Ops is the cross-account operating view for HighLevel/Kenji locations. It summarizes linked leads, new leads, converted leads, calls, callbacks due, appointment intents, failed writebacks, calendar mapping, and last sync state.</p><p>Use it when you need to understand which subaccount or location needs attention instead of drilling into individual leads first.</p>`
    },
    {
      category: "EILA",
      q: "What can EILA Overwatch do?",
      a: `<p>EILA is the operator layer over the call center. She receives a fresh pipeline snapshot when you ask a question and can explain hot leads, stale leads, source quality, callback debt, call outcomes, and operational priorities.</p><p>Good questions include: <i>“What needs attention right now?”</i>, <i>“Which source is performing best?”</i>, and <i>“Which untouched leads should we call first?”</i></p><p>Action requests use a plan-first flow and require confirmation before consequential changes are executed.</p>`
    },
    {
      category: "EILA",
      q: "How do I use EILA Live?",
      a: `<p>Click <b>EILA Live</b> in the top-right. In Owner Mode, Kenji creates a governed video job, opens a private LiveKit room, and connects the shared avatar runtime. EILA enters with a fresh operating snapshot so the conversation starts with current context.</p><p>If the video lane is at capacity, the request waits behind the governor rather than bypassing the queue.</p>`
    },
    {
      category: "Nurture",
      q: "How do SMS and email nurture sequences work?",
      a: `<p>Nurture handles scheduled SMS and email follow-up. Voice contactability does <b>not</b> automatically grant SMS or email permission. Each channel has its own explicit consent state.</p><ol><li>Select eligible leads.</li><li>Build the SMS/email step sequence.</li><li>Preview the audience.</li><li>Create the sequence as a draft.</li><li>Launch when the timing and content are correct.</li></ol><p>Inbound SMS STOP disables SMS permission for that lead.</p>`
    },
    {
      category: "Scale Lab",
      q: "What is Scale Lab?",
      a: `<p>Scale Lab shows the governor for voice, SMS, email, and video. Each lane has its own per-minute ceiling, burst budget, shard count, enabled state, and circuit breaker.</p><p>The dry-run model lets you estimate how long a workload would take without sending provider traffic. The numbers are orchestration ceilings, not guarantees of Twilio, Resend, LiveKit, LemonSlice, or GPU capacity.</p>`
    },
    {
      category: "Launch",
      q: "What does Launch tell me?",
      a: `<p>Launch is the source-of-truth handoff gate.</p><p><b>Platform Ready</b> means the software and runtimes are healthy. <b>Go-Live Ready</b> additionally requires real leads, a routed voice number, an SMS sender, and a verified email sender.</p><p>Use the acceptance button before a customer demo or before enabling controlled live traffic.</p>`
    },
    {
      category: "Owner Setup",
      q: "What is Owner Setup for?",
      a: `<p>Owner Setup is the guided configuration wizard. It walks through brand/owner identity, lead source, voice number, SMS/email senders, calendar mapping, platform acceptance, and go-live readiness.</p><p>It reuses the existing configuration APIs. It is not a second control plane and it never asks for provider secrets in the browser.</p>`
    },
    {
      category: "Troubleshooting",
      q: "What should I check if something looks wrong?",
      a: `<ol><li>Hit <b>Refresh</b>.</li><li>Check the AI runtime indicator in the lower-left.</li><li>Open <b>Launch</b> and run acceptance.</li><li>Use <b>Live Demo</b> to check Twilio, Deepgram, EILA runtime, D1, HighLevel, and video readiness.</li><li>Use <b>Scale Lab</b> to confirm no circuit breaker is open.</li><li>If only one lead is affected, inspect its stage, consent/contactability, callback state, and recent call disposition.</li></ol>`
    }
  ];

  function style() {
    if ($("#pass11PremiumStyle")) return;
    const s = document.createElement("style");
    s.id = "pass11PremiumStyle";
    s.textContent = `
      :root{
        --bg:#f6f8fc!important;--panel:#ffffff!important;--panel2:#f8fafc!important;--line:#e2e8f0!important;
        --text:#111827!important;--muted:#64748b!important;--cyan:#1268e8!important;--cyan2:#2563eb!important;
        --green:#10b981!important;--amber:#f59e0b!important;--red:#ef4444!important;--shadow:0 12px 30px rgba(15,23,42,.06)!important;
        color-scheme:light!important;
      }
      html,body{background:#f6f8fc!important;color:#111827!important}
      body{background:linear-gradient(180deg,#fbfdff 0,#f5f8fc 100%)!important}
      .app{grid-template-columns:248px 1fr!important;background:transparent!important}
      .sidebar{background:#fff!important;border-right:1px solid #e5eaf1!important;box-shadow:8px 0 30px rgba(15,23,42,.025)!important;padding:18px 14px!important}
      .brand{padding:5px 6px 22px!important;align-items:flex-start!important}
      .brand-mark{background:linear-gradient(145deg,#edf5ff,#dff9f5)!important;border:1px solid #cfe0f4!important;color:#1769e0!important;box-shadow:none!important}
      .brand strong{color:#0f172a!important;letter-spacing:.05em!important;font-size:15px!important}.brand span{color:#7b8798!important;letter-spacing:.08em!important;font-size:8px!important;line-height:1.3!important;max-width:150px!important}
      .sidebar nav{gap:3px!important}.sidebar nav button{color:#536174!important;padding:10px 11px!important;border-radius:10px!important;font-weight:650!important}
      .sidebar nav button:hover{background:#f4f7fb!important;color:#0f172a!important}.sidebar nav button.active{background:#edf5ff!important;color:#1268e8!important;border-color:#d9e9ff!important;box-shadow:none!important}
      .sidebar nav button span{color:#1268e8!important}.p11-nav-label{font-size:9px;font-weight:850;color:#a0aaba;letter-spacing:.13em;text-transform:uppercase;margin:15px 10px 5px}
      .sidebar-foot{gap:10px!important}.runtime-pill{background:#f8fafc!important;border-color:#e2e8f0!important}.runtime-pill b{color:#1e293b!important}.runtime-pill span{color:#718096!important}
      .main{padding:0 30px 70px!important}.topbar{height:90px!important;background:rgba(255,255,255,.92)!important;border-bottom:1px solid #e6ebf2!important;backdrop-filter:blur(18px)!important;margin-bottom:22px!important}
      .topbar h2{color:#111827!important;font-size:25px!important}.eyebrow{color:#1769e0!important}.subtle,.hint,.copy{color:#738196!important}
      input,select,textarea{background:#fff!important;border-color:#dce3ec!important;color:#111827!important;box-shadow:none!important}input:focus,select:focus,textarea:focus{border-color:#8ebdff!important;box-shadow:0 0 0 3px rgba(37,99,235,.08)!important}
      .primary{background:linear-gradient(135deg,#1769e0,#0b7df1)!important;color:#fff!important;box-shadow:0 8px 18px rgba(23,105,224,.16)!important}.ghost{background:#fff!important;border:1px solid #dde5ee!important;color:#27364a!important}.ghost:hover{border-color:#b8c8db!important;background:#f8fafc!important}
      .video-btn{background:#0f6fec!important;border:1px solid #0f6fec!important;color:#fff!important;box-shadow:0 8px 18px rgba(15,111,236,.18)!important}.video-btn:hover{background:#0d62d1!important}
      #demoModePill{background:#eff6ff!important;border-color:#cfe1ff!important;color:#1769e0!important}.badge{background:#f7f9fc!important;border-color:#e1e7ef!important;color:#64748b!important}.badge.green{background:#ecfdf5!important;border-color:#c5f0dc!important;color:#087b56!important}
      .metric-grid{gap:12px!important}.metric{background:#fff!important;border:1px solid #e2e8f0!important;border-radius:14px!important;box-shadow:0 8px 24px rgba(15,23,42,.045)!important;min-height:106px!important}.metric span{color:#6b7890!important}.metric strong{color:#111827!important}.metric.hot strong{color:#1769e0!important}.metric small{color:#8b98aa!important}
      .panel{background:#fff!important;border:1px solid #e2e8f0!important;box-shadow:0 9px 28px rgba(15,23,42,.045)!important;border-radius:15px!important}.panel h3{color:#111827!important}
      .mini-lead,.list-row{background:#fbfcfe!important;border-color:#e7ecf3!important}.mini-lead b,.list-row b{color:#172033!important}.mini-lead span,.list-row span{color:#718096!important}.score{background:#eef8f5!important;border-color:#bfe8da!important;color:#087b56!important}
      .mini-actions button{background:#fff!important;border-color:#dde5ee!important;color:#42526a!important}.mini-actions .call{color:#1769e0!important;border-color:#cfe1ff!important;background:#f3f8ff!important}
      .bar{background:#edf1f6!important}.bar i{background:linear-gradient(90deg,#1769e0,#35c9d0)!important}.source-line{color:#243247!important}
      .toolbar{background:#fff!important;box-shadow:0 6px 22px rgba(15,23,42,.04)!important;border-radius:13px!important}.lead-grid{grid-template-columns:repeat(3,minmax(290px,1fr))!important;gap:14px!important}
      .lead-card{background:#fff!important;border:1px solid #e1e7ef!important;border-radius:16px!important;padding:18px!important;box-shadow:0 8px 24px rgba(15,23,42,.05)!important;overflow:visible!important}.lead-card:hover{border-color:#c8d8ea!important;transform:translateY(-2px)!important;box-shadow:0 15px 36px rgba(15,23,42,.075)!important}.lead-card:before{display:none!important}
      .avatar{width:44px!important;height:44px!important;border-radius:50%!important;background:linear-gradient(145deg,#eef5ff,#edfdf8)!important;color:#1769e0!important;border:1px solid #dbe7f4!important}.lead-top b{font-size:15px!important;color:#111827!important}.lead-top small{color:#738196!important}
      .score-ring{width:44px!important;height:44px!important;border-radius:50%!important;border:2px solid #32bf8a!important;display:grid!important;place-items:center!important;color:#087b56!important;background:#f4fffa!important;font-size:13px!important}.lead-meta{grid-template-columns:1fr!important;gap:0!important;margin:15px 0 10px!important;border-top:1px solid #edf1f5!important;border-bottom:1px solid #edf1f5!important}.lead-meta div{display:flex!important;justify-content:space-between!important;gap:14px!important;background:transparent!important;border:0!important;border-bottom:1px solid #f0f3f7!important;border-radius:0!important;padding:8px 2px!important}.lead-meta div:last-child{border-bottom:0!important}.lead-meta label{font-size:10px!important;color:#8793a5!important}.lead-meta span{font-size:11px!important;color:#26364c!important;font-weight:650!important;margin:0!important;text-align:right!important}.lead-notes{color:#64748b!important;min-height:38px!important;max-height:44px!important;line-height:1.55!important}.lead-actions{display:flex!important;gap:7px!important;margin-top:14px!important;border-top:1px solid #edf1f5!important;padding-top:12px!important}.lead-actions button{width:40px!important;height:38px!important;display:grid!important;place-items:center!important;padding:0!important;border:1px solid #dfe6ef!important;background:#fff!important;color:#41516a!important;border-radius:10px!important}.lead-actions button:hover{background:#f4f8ff!important;border-color:#c5d9f2!important;color:#1769e0!important}.lead-actions select{height:38px!important;margin-left:auto!important;background:#f8fafc!important;min-width:118px!important;color:#334155!important;border-color:#dde5ee!important}
      .p11-extra-action{flex:none!important}.p11-extra-action[data-kind="text"]{color:#6d5ce8!important}.p11-extra-action[data-kind="email"]{color:#1769e0!important}
      .p11-stage-tabs{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin:0 0 12px;padding:4px}.p11-stage-tab{border:0;background:transparent;color:#69768a;padding:8px 12px;border-radius:9px;font-weight:700;font-size:11px}.p11-stage-tab:hover{background:#f2f6fb;color:#1f2b3d}.p11-stage-tab.active{background:#edf5ff;color:#1769e0}
      .table th{color:#8a95a5!important;border-color:#e7ecf2!important}.table td{color:#4b5a70!important;border-color:#eef1f5!important}.table td strong{color:#172033!important}.status{background:#f3f6f9!important;color:#64748b!important}.status.completed{background:#ecfdf5!important;color:#087b56!important}.status.failed,.status.busy,.status.no-answer{background:#fff1f2!important;color:#be3344!important}
      .callback-card{background:#fff!important;border-color:#e2e8f0!important}.callback-card .time{color:#b36b00!important}
      .dropzone,.copy-field code,.code-sample{background:#f8fafc!important;border-color:#dfe6ee!important;color:#334155!important}.copy-field button{background:#fff!important;border-color:#dfe6ee!important;color:#45566d!important}.key-reveal{background:#fffbeb!important;border-color:#f8dea4!important}.flow div{background:#f8fafc!important;border-color:#e0e7ef!important}.flow b{color:#1f2937!important}.flow span{color:#778397!important}
      .isla-hero{background:linear-gradient(145deg,#f4f9ff,#f0fffb)!important}.isla-orb{background:#eef6ff!important;border-color:#cfe1ff!important;color:#1769e0!important;box-shadow:none!important}.isla-hero>p:not(.eyebrow){color:#64748b!important}.chat-stream,.bubble{color:#334155!important}.bubble{background:#f6f8fb!important;border-color:#e2e8f0!important}.bubble.user{background:#edf5ff!important;border-color:#d3e5ff!important}.snapshot-strip div{background:#fff!important;border-color:#e0e7ef!important}
      dialog{background:#fff!important;color:#111827!important}.dialog-card{background:#fff!important}
      .auth-shell{background:rgba(15,23,42,.28)!important}.auth-card{background:#fff!important;border-color:#dfe6ee!important;box-shadow:0 35px 100px rgba(15,23,42,.18)!important}.auth-card h1,.auth-copy{color:#111827!important}#demoAuthClose{background:#fff!important;color:#475569!important;border-color:#dce4ed!important}
      [id^="view-"] .p7-lane,[id^="view-"] .p9-check,[id^="view-"] .p7-result,[id^="view-"] .p10-step,[id^="view-"] .p10-card{background:#fff!important;border-color:#e2e8f0!important;color:#334155!important}
      .p7-meta,.p9-check span,.p9-run span,.p7-routing{color:#748197!important}
      .p7-fields input,.p9-form input,.p9-form textarea,.p9-form select{background:#fff!important;color:#1f2937!important;border-color:#dce4ed!important}
      .p11-support-pill{position:fixed;right:24px;bottom:22px;z-index:2200;display:flex;align-items:center;gap:10px;border:1px solid #d6e3f2;background:#fff;border-radius:999px;padding:9px 15px 9px 9px;box-shadow:0 16px 42px rgba(15,23,42,.14);cursor:pointer;color:#1c2d44}.p11-support-pill:hover{transform:translateY(-1px);box-shadow:0 20px 48px rgba(15,23,42,.18)}.p11-support-pill img{width:42px;height:42px;border-radius:50%;object-fit:cover;background:#eef5ff}.p11-support-pill b,.p11-support-pill span{display:block}.p11-support-pill b{font-size:12px}.p11-support-pill span{font-size:10px;color:#6f7f95;margin-top:2px}.p11-support-pill i{width:7px;height:7px;border-radius:50%;background:#16c784;display:inline-block;margin-right:5px}
      .p11-support-drawer{position:fixed;right:24px;bottom:82px;z-index:2190;width:min(430px,calc(100vw - 32px));height:min(720px,calc(100vh - 120px));background:#fff;border:1px solid #dce5ef;border-radius:19px;box-shadow:0 28px 75px rgba(15,23,42,.2);display:none;overflow:hidden}.p11-support-drawer.open{display:grid;grid-template-rows:auto auto 1fr auto}.p11-support-head{padding:16px 16px 13px;border-bottom:1px solid #e8edf3;display:flex;align-items:center;gap:11px;background:linear-gradient(135deg,#f8fbff,#f4fffb)}.p11-support-head img{width:52px;height:52px;border-radius:14px;object-fit:cover;background:#eef5ff}.p11-support-head h3,.p11-support-head p{margin:0}.p11-support-head h3{font-size:15px;color:#132238}.p11-support-head p{font-size:10px;color:#718096;margin-top:4px;line-height:1.4}.p11-support-close{margin-left:auto;border:0;background:transparent;color:#64748b;width:32px;height:32px;display:grid;place-items:center}.p11-support-search{padding:12px 14px;border-bottom:1px solid #eef2f6;position:relative}.p11-support-search svg{position:absolute;left:26px;top:23px;color:#9aa6b6}.p11-support-search input{width:100%;padding-left:36px!important;background:#f8fafc!important}.p11-support-body{overflow:auto;padding:13px 14px 18px}.p11-quick{display:grid;grid-template-columns:repeat(4,1fr);gap:7px;margin-bottom:14px}.p11-quick button{border:1px solid #e1e8f0;background:#fff;border-radius:10px;padding:9px 5px;color:#536174;font-size:9px;font-weight:750}.p11-quick button:hover{background:#f4f8ff;color:#1769e0;border-color:#cfe1ff}.p11-faq-title{font-size:10px;color:#95a0af;letter-spacing:.1em;text-transform:uppercase;font-weight:800;margin:13px 2px 7px}.p11-faq-item{border:1px solid #e4eaf1;border-radius:11px;margin-bottom:7px;overflow:hidden}.p11-faq-q{width:100%;display:flex;align-items:center;gap:8px;border:0;background:#fff;padding:11px 12px;text-align:left;color:#243247;font-size:11px;font-weight:750}.p11-faq-q span{flex:1}.p11-faq-q svg{transition:.18s}.p11-faq-item.open .p11-faq-q svg{transform:rotate(90deg)}.p11-faq-a{display:none;padding:0 13px 13px;color:#58677d;font-size:11px;line-height:1.55}.p11-faq-item.open .p11-faq-a{display:block}.p11-faq-a p{margin:8px 0}.p11-faq-a ul,.p11-faq-a ol{padding-left:18px;margin:8px 0}.p11-faq-a li{margin:5px 0}.p11-support-foot{padding:11px 14px;border-top:1px solid #e9eef4;background:#fbfcfe;display:flex;align-items:center;gap:8px}.p11-support-foot span{font-size:10px;color:#748197;flex:1}.p11-support-foot button{border:0;background:#1769e0;color:#fff;border-radius:10px;padding:9px 11px;font-size:10px;font-weight:750}
      @media(max-width:1100px){.lead-grid{grid-template-columns:repeat(2,minmax(280px,1fr))!important}.metric-grid{grid-template-columns:repeat(3,1fr)!important}.app{grid-template-columns:220px 1fr!important}}
      @media(max-width:760px){.app{display:block!important}.sidebar{position:relative!important;height:auto!important}.main{padding:0 14px 70px!important}.lead-grid,.grid.two,.metric-grid{grid-template-columns:1fr!important}.topbar{position:relative!important;height:auto!important;padding:16px 0!important;align-items:flex-start!important}.top-actions{flex-wrap:wrap!important;justify-content:flex-end!important}.p11-support-pill{right:12px;bottom:12px}.p11-support-drawer{right:8px;bottom:68px;width:calc(100vw - 16px);height:calc(100vh - 86px)}.p11-quick{grid-template-columns:repeat(2,1fr)}}
    `;
    document.head.appendChild(s);
  }

  function replaceText(root = document.body) {
    if (!root) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const n of nodes) {
      if (!n.nodeValue) continue;
      n.nodeValue = n.nodeValue
        .replace(/\bISLA\b/g, "EILA")
        .replace(/\bIsla\b/g, "EILA")
        .replace(/KENJI × BLACK HOLE/g, "KENJI AI")
        .replace(/KENJI CALL CENTER/g, "KENJI AI");
    }
  }

  function brand() {
    const el = $(".brand");
    if (!el || el.dataset.p11) return;
    el.dataset.p11 = "1";
    el.innerHTML = `<div class="brand-mark small">K</div><div><strong>KENJI AI</strong><span>AI THAT CLOSES DEALS WHILE YOU SLEEP</span></div>`;
  }

  function groupNav() {
    const nav = $("#nav");
    if (!nav || nav.dataset.p11) return;
    nav.dataset.p11 = "1";
    const inserts = [
      ["overview", "Core"],
      ["campaigns", "Growth"],
      ["isla", "AI & Operations"],
      ["integrations", "System"],
    ];
    for (const [view, label] of inserts) {
      const target = nav.querySelector(`[data-view="${view}"]`);
      if (!target) continue;
      const d = document.createElement("div");
      d.className = "p11-nav-label";
      d.textContent = label;
      nav.insertBefore(d, target);
    }
  }

  function premiumToast(text) {
    const el = $("#toast");
    if (!el) return;
    el.textContent = text;
    el.classList.add("show");
    clearTimeout(el._p11);
    el._p11 = setTimeout(() => el.classList.remove("show"), 2800);
  }

  function navigate(view) {
    const btn = $(`[data-view="${view}"]`);
    if (btn) btn.click();
  }

  function enhanceLeadCards() {
    for (const card of $$(".lead-card:not([data-p11-premium])")) {
      card.dataset.p11Premium = "1";
      const actions = $(".lead-actions", card);
      if (!actions) continue;
      const call = $("button.call", actions);
      const callback = $("button[data-callback]", actions);
      if (call) {
        call.innerHTML = icon("phone", 17);
        call.title = "Call lead";
        call.setAttribute("aria-label", "Call lead");
      }
      if (callback) {
        callback.innerHTML = icon("calendar", 17);
        callback.title = "Schedule callback";
        callback.setAttribute("aria-label", "Schedule callback");
      }
      if (!actions.querySelector('[data-kind="text"]')) {
        const text = document.createElement("button");
        text.type = "button";
        text.className = "p11-extra-action";
        text.dataset.kind = "text";
        text.title = "Text lead";
        text.setAttribute("aria-label", "Text lead");
        text.innerHTML = icon("message", 17);
        text.addEventListener("click", () => { navigate("nurture"); premiumToast("Open Nurture to send or schedule SMS follow-up."); });
        actions.insertBefore(text, callback || actions.firstChild);
      }
      if (!actions.querySelector('[data-kind="email"]')) {
        const email = document.createElement("button");
        email.type = "button";
        email.className = "p11-extra-action";
        email.dataset.kind = "email";
        email.title = "Email lead";
        email.setAttribute("aria-label", "Email lead");
        email.innerHTML = icon("mail", 17);
        email.addEventListener("click", () => { navigate("nurture"); premiumToast("Open Nurture to send or schedule email follow-up."); });
        const stage = $("select", actions);
        actions.insertBefore(email, stage || null);
      }
    }
    for (const row of $$(".mini-lead:not([data-p11-premium])")) {
      row.dataset.p11Premium = "1";
      const call = $("button.call", row);
      const callback = $("button[data-callback]", row);
      if (call) { call.innerHTML = icon("phone", 14); call.title = "Call lead"; }
      if (callback) { callback.innerHTML = icon("calendar", 14); callback.title = "Schedule callback"; }
    }
  }

  function stageTabs() {
    const view = $("#view-leads");
    const toolbar = $("#view-leads .toolbar");
    if (!view || !toolbar || $("#p11StageTabs")) return;
    const wrap = document.createElement("div");
    wrap.id = "p11StageTabs";
    wrap.className = "p11-stage-tabs";
    const stages = ["All", "New", "Contacted", "Qualified", "Booked", "Nurture", "Won"];
    wrap.innerHTML = stages.map((s, i) => `<button class="p11-stage-tab ${i === 0 ? "active" : ""}" data-p11-stage="${s === "All" ? "" : s}">${s}</button>`).join("");
    view.insertBefore(wrap, toolbar);
    wrap.addEventListener("click", e => {
      const b = e.target.closest("[data-p11-stage]");
      if (!b) return;
      const sel = $("#stageFilter");
      if (!sel) return;
      sel.value = b.dataset.p11Stage;
      sel.dispatchEvent(new Event("change", { bubbles: true }));
      $$(".p11-stage-tab", wrap).forEach(x => x.classList.toggle("active", x === b));
    });
  }

  function support() {
    if ($("#p11SupportPill")) return;
    const pill = document.createElement("button");
    pill.id = "p11SupportPill";
    pill.className = "p11-support-pill";
    pill.innerHTML = `<img src="${EILA_AVATAR}" alt="EILA"><div><b>24-hour support</b><span><i></i>EILA is available</span></div>`;

    const drawer = document.createElement("aside");
    drawer.id = "p11SupportDrawer";
    drawer.className = "p11-support-drawer";
    drawer.innerHTML = `
      <header class="p11-support-head">
        <img src="${EILA_AVATAR}" alt="EILA">
        <div><h3>EILA · Kenji Support</h3><p>How to use the dashboard, leads, campaigns, integrations, EILA, and launch tools.</p></div>
        <button class="p11-support-close" aria-label="Close support">${icon("close", 18)}</button>
      </header>
      <div class="p11-support-search">${icon("search", 16)}<input id="p11FaqSearch" placeholder="Search help…"></div>
      <div class="p11-support-body">
        <div class="p11-quick">
          <button data-p11-go="overview">Overview</button>
          <button data-p11-go="leads">Leads</button>
          <button data-p11-go="isla">EILA</button>
          <button data-p11-go="launch">Launch</button>
        </div>
        <div id="p11FaqList"></div>
      </div>
      <footer class="p11-support-foot"><span>Need the whole system explained? Start with “What should I do first?”</span><button data-p11-go="isla">Ask EILA</button></footer>`;

    document.body.append(drawer, pill);
    pill.addEventListener("click", () => drawer.classList.toggle("open"));
    $(".p11-support-close", drawer).addEventListener("click", () => drawer.classList.remove("open"));
    drawer.addEventListener("click", e => {
      const go = e.target.closest("[data-p11-go]");
      if (go) { navigate(go.dataset.p11Go); drawer.classList.remove("open"); }
      const q = e.target.closest(".p11-faq-q");
      if (q) q.closest(".p11-faq-item").classList.toggle("open");
    });
    $("#p11FaqSearch", drawer).addEventListener("input", renderFaq);
    renderFaq();
  }

  function renderFaq() {
    const list = $("#p11FaqList");
    if (!list) return;
    const term = String($("#p11FaqSearch")?.value || "").trim().toLowerCase();
    const rows = faqs.filter(x => !term || `${x.category} ${x.q} ${x.a.replace(/<[^>]+>/g, " ")}`.toLowerCase().includes(term));
    const groups = new Map();
    for (const row of rows) {
      if (!groups.has(row.category)) groups.set(row.category, []);
      groups.get(row.category).push(row);
    }
    list.innerHTML = [...groups.entries()].map(([cat, items]) => `
      <div class="p11-faq-title">${cat}</div>
      ${items.map(x => `<section class="p11-faq-item"><button class="p11-faq-q"><span>${x.q}</span>${icon("chevron", 15)}</button><div class="p11-faq-a">${x.a}</div></section>`).join("")}
    `).join("") || `<p class="copy">No help topics match that search.</p>`;
  }

  function topbar() {
    const actions = $(".top-actions");
    if (!actions || actions.dataset.p11) return;
    actions.dataset.p11 = "1";
    const refresh = $("#refreshBtn");
    if (refresh) refresh.innerHTML = `${icon("refresh", 15)} Refresh`;
    const video = $("#videoBtn");
    if (video) video.innerHTML = `${icon("sparkle", 15)} EILA Live`;
  }

  function all() {
    replaceText();
    brand();
    groupNav();
    topbar();
    stageTabs();
    enhanceLeadCards();
  }

  function boot() {
    style();
    all();
    support();
    const observer = new MutationObserver(() => all());
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})();
