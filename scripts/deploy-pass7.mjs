import { existsSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const ROOT=resolve(new URL("..",import.meta.url).pathname);
const PLATFORM=process.env.CLOUDFLARE_PLATFORM_DIR||"/mnt/eila-hot-sidecar/workspace/cloudflare-platform";
const STORE="default_secrets_store";
const DB_NAME="kenji-call-center-db";
const QUEUES=[
  "kenji-orch-voice-ingress","kenji-orch-voice-ingress-dlq",
  "kenji-orch-sms-ingress","kenji-orch-sms-ingress-dlq",
  "kenji-orch-email-ingress","kenji-orch-email-ingress-dlq",
];
function run(cmd,args,{cwd=ROOT,capture=false,allowFail=false}={}){const r=spawnSync(cmd,args,{cwd,encoding:"utf8",stdio:capture?["ignore","pipe","pipe"]:"inherit",shell:false});if(r.error)throw r.error;if(r.status!==0&&!allowFail)throw new Error(`${cmd} ${args.join(" ")} failed with exit ${r.status}${capture?`\n${r.stderr||r.stdout}`:""}`);return capture?(r.stdout||r.stderr||""):"";}
function npx(args,opts){return run(process.platform==="win32"?"npx.cmd":"npx",["wrangler",...args],opts);}
function parseJsonOutput(text){const raw=String(text||"").trim();for(const [o,c] of [["[","]"],["{","}"]]){const s=raw.indexOf(o),e=raw.lastIndexOf(c);if(s>=0&&e>s){try{return JSON.parse(raw.slice(s,e+1));}catch{}}}throw new Error(`Could not parse Wrangler JSON output: ${raw.slice(0,500)}`);}
function findD1(){const data=parseJsonOutput(npx(["d1","list","--json"],{capture:true}));const rows=Array.isArray(data)?data:data.result||[];const row=rows.find(x=>x.name===DB_NAME);const id=row?.uuid||row?.id||row?.database_id;if(!id)throw new Error(`${DB_NAME} was not found. Deploy earlier passes first.`);return id;}
function listQueues(){try{const data=parseJsonOutput(npx(["queues","list","--json"],{capture:true}));return Array.isArray(data)?data:data.result||[];}catch{return [];}}
function ensureQueues(){let current=listQueues();for(const name of QUEUES){if(current.some(x=>(x.queue_name||x.name)===name))continue;console.log(`Creating Queue ${name}…`);npx(["queues","create",name]);current=listQueues();}}
function generatedConfig(path,d1Id){const source=readFileSync(path,"utf8"),generated=path.replace(/wrangler\.toml$/,"wrangler.generated.toml");writeFileSync(generated,source.replaceAll("__KENJI_D1_ID__",d1Id));return generated;}
function deployWithStore(config,bindings){const helper=resolve(PLATFORM,"scripts/deploy-with-secrets-store.mjs");if(!existsSync(helper))throw new Error(`Cloudflare platform helper not found at ${helper}. Set CLOUDFLARE_PLATFORM_DIR if needed.`);const args=[helper,"--config",config,"--store",STORE];for(const [workerBinding,storeSecret] of Object.entries(bindings))args.push("--bind",`${workerBinding}=${storeSecret}`);run(process.execPath,args,{cwd:PLATFORM});}

const generated=[];
try{
  console.log("Kenji Pass 7: ingress queues → sharded governor → campaign/nurture routing → Scale Lab");
  const d1Id=findD1();console.log(`Using D1 ${DB_NAME} (${d1Id})`);ensureQueues();
  const dataConfig=generatedConfig(resolve(ROOT,"apps/data-worker/wrangler.toml"),d1Id);
  const orchConfig=generatedConfig(resolve(ROOT,"apps/orchestrator-worker/wrangler.toml"),d1Id);
  const campaignConfig=generatedConfig(resolve(ROOT,"apps/campaign-worker/wrangler.toml"),d1Id);
  const nurtureConfig=generatedConfig(resolve(ROOT,"apps/nurture-worker/wrangler.toml"),d1Id);
  const overwatchConfig=generatedConfig(resolve(ROOT,"apps/overwatch-worker/wrangler.toml"),d1Id);
  generated.push(dataConfig,orchConfig,campaignConfig,nurtureConfig,overwatchConfig);
  console.log("Applying Pass 7 D1 migration…");npx(["d1","migrations","apply",DB_NAME,"--remote","--config",dataConfig]);
  console.log("Deploying Kenji Orchestrator Worker…");deployWithStore(orchConfig,{INTERNAL_CALL_SECRET:"XYZ_DEMO_EILA_RUNTIME_TOKEN"});
  console.log("Redeploying Campaign Worker through voice ingress…");deployWithStore(campaignConfig,{INTERNAL_CALL_SECRET:"XYZ_DEMO_EILA_RUNTIME_TOKEN"});
  console.log("Redeploying Nurture Worker through SMS/email ingress…");deployWithStore(nurtureConfig,{INTERNAL_CALL_SECRET:"XYZ_DEMO_EILA_RUNTIME_TOKEN"});
  console.log("Deploying Kenji Overwatch Pass 7…");deployWithStore(overwatchConfig,{INTERNAL_CALL_SECRET:"XYZ_DEMO_EILA_RUNTIME_TOKEN",EILA_RUNTIME_TOKEN:"XYZ_DEMO_EILA_RUNTIME_TOKEN",BLACKHOLE_CAPABILITY_TOKEN:"XYZ_DEMO_EILA_RUNTIME_TOKEN"});
  console.log("\nPass 7 deployed.");
  console.log("Command Center: https://kenji-overwatch-worker.cryptocapitalgroupfl.workers.dev");
  console.log("New surface: Scale Lab");
  console.log("Governed queue lanes: voice + SMS + email. Video remains a separately configurable advisory lane until the renderer is queue-backed.");
  console.log("Dry-run load modeling never sends provider traffic.");
} finally {for(const file of generated){try{unlinkSync(file);}catch{}}}
