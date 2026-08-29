import { existsSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const ROOT=resolve(new URL("..",import.meta.url).pathname);
const PLATFORM=process.env.CLOUDFLARE_PLATFORM_DIR||"/mnt/eila-hot-sidecar/workspace/cloudflare-platform";
const STORE="default_secrets_store";
const DB_NAME="kenji-call-center-db";
const QUEUES=["kenji-sms-jobs","kenji-sms-jobs-dlq","kenji-email-jobs","kenji-email-jobs-dlq"];
function run(cmd,args,{cwd=ROOT,capture=false,allowFail=false}={}){const result=spawnSync(cmd,args,{cwd,encoding:"utf8",stdio:capture?["ignore","pipe","pipe"]:"inherit",shell:false});if(result.error)throw result.error;if(result.status!==0&&!allowFail)throw new Error(`${cmd} ${args.join(" ")} failed with exit ${result.status}${capture?`\n${result.stderr||result.stdout}`:""}`);return capture?(result.stdout||result.stderr||""):"";}
function npx(args,opts){return run(process.platform==="win32"?"npx.cmd":"npx",["wrangler",...args],opts);}
function parseJsonOutput(text){const raw=String(text||"").trim();for(const [open,close] of [["[","]"],["{","}"]]){const start=raw.indexOf(open),end=raw.lastIndexOf(close);if(start>=0&&end>start){try{return JSON.parse(raw.slice(start,end+1));}catch{}}}throw new Error(`Could not parse Wrangler JSON output: ${raw.slice(0,500)}`);}
function findD1(){const data=parseJsonOutput(npx(["d1","list","--json"],{capture:true}));const rows=Array.isArray(data)?data:data.result||[];const row=rows.find(x=>x.name===DB_NAME);const id=row?.uuid||row?.id||row?.database_id;if(!id)throw new Error(`${DB_NAME} was not found. Deploy earlier passes first.`);return id;}
function listQueues(){try{const data=parseJsonOutput(npx(["queues","list","--json"],{capture:true}));return Array.isArray(data)?data:data.result||[];}catch{return [];}}
function ensureQueues(){let current=listQueues();for(const name of QUEUES){if(current.some(x=>(x.queue_name||x.name)===name))continue;console.log(`Creating Queue ${name}…`);npx(["queues","create",name]);current=listQueues();}}
function generatedConfig(path,d1Id){const source=readFileSync(path,"utf8"),generated=path.replace(/wrangler\.toml$/,"wrangler.generated.toml");writeFileSync(generated,source.replaceAll("__KENJI_D1_ID__",d1Id));return generated;}
function deployWithStore(config,bindings){const helper=resolve(PLATFORM,"scripts/deploy-with-secrets-store.mjs");if(!existsSync(helper))throw new Error(`Cloudflare platform helper not found at ${helper}. Set CLOUDFLARE_PLATFORM_DIR if needed.`);const args=[helper,"--config",config,"--store",STORE];for(const [workerBinding,storeSecret] of Object.entries(bindings))args.push("--bind",`${workerBinding}=${storeSecret}`);run(process.execPath,args,{cwd:PLATFORM});}

const generated=[];
try{
  console.log("Kenji Pass 6: explicit channel consent → separate SMS/email queues → nurture orchestration");
  const d1Id=findD1();console.log(`Using D1 ${DB_NAME} (${d1Id})`);ensureQueues();
  const dataConfig=generatedConfig(resolve(ROOT,"apps/data-worker/wrangler.toml"),d1Id),smsConfig=generatedConfig(resolve(ROOT,"apps/sms-worker/wrangler.toml"),d1Id),emailConfig=generatedConfig(resolve(ROOT,"apps/email-worker/wrangler.toml"),d1Id),nurtureConfig=generatedConfig(resolve(ROOT,"apps/nurture-worker/wrangler.toml"),d1Id),overwatchConfig=generatedConfig(resolve(ROOT,"apps/overwatch-worker/wrangler.toml"),d1Id);generated.push(dataConfig,smsConfig,emailConfig,nurtureConfig,overwatchConfig);
  console.log("Applying Pass 6 D1 migration…");npx(["d1","migrations","apply",DB_NAME,"--remote","--config",dataConfig]);
  console.log("Deploying Kenji SMS Worker…");deployWithStore(smsConfig,{TWILIO_ACCOUNT_SID:"XYZ_DEMO_TWILIO_ACCOUNT_SID",TWILIO_AUTH_TOKEN:"XYZ_DEMO_TWILIO_AUTH_TOKEN",INTERNAL_CALL_SECRET:"XYZ_DEMO_EILA_RUNTIME_TOKEN"});
  console.log("Deploying Kenji Email Worker…");deployWithStore(emailConfig,{RESEND_API_KEY:"XYZ_DEMO_RESEND_API_KEY",INTERNAL_CALL_SECRET:"XYZ_DEMO_EILA_RUNTIME_TOKEN"});
  console.log("Deploying Kenji Nurture Worker…");deployWithStore(nurtureConfig,{INTERNAL_CALL_SECRET:"XYZ_DEMO_EILA_RUNTIME_TOKEN"});
  console.log("Deploying Kenji Overwatch Pass 6…");deployWithStore(overwatchConfig,{INTERNAL_CALL_SECRET:"XYZ_DEMO_EILA_RUNTIME_TOKEN",EILA_RUNTIME_TOKEN:"XYZ_DEMO_EILA_RUNTIME_TOKEN",BLACKHOLE_CAPABILITY_TOKEN:"XYZ_DEMO_EILA_RUNTIME_TOKEN"});
  console.log("\nPass 6 deployed.");
  console.log("Command Center: https://kenji-overwatch-worker.cryptocapitalgroupfl.workers.dev");
  console.log("New surface: Nurture");
  console.log("Workers: kenji-sms-worker + kenji-email-worker + kenji-nurture-worker");
  console.log("Queues: kenji-sms-jobs + kenji-email-jobs with dedicated DLQs");
  console.log("Safety: SMS and email require explicit per-lead opt-in. Voice contactability is never treated as channel consent.");
} finally {for(const file of generated){try{unlinkSync(file);}catch{}}}
