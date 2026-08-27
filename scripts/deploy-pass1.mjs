import { existsSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const ROOT=resolve(new URL("..",import.meta.url).pathname);
const PLATFORM=process.env.CLOUDFLARE_PLATFORM_DIR||"/mnt/eila-hot-sidecar/workspace/cloudflare-platform";
const STORE="default_secrets_store";
const DB_NAME="kenji-call-center-db";
const QUEUES=["kenji-call-jobs","kenji-call-jobs-dlq"];

function run(cmd,args,{cwd=ROOT,allowFail=false,capture=false}={}){
  const result=spawnSync(cmd,args,{cwd,encoding:"utf8",stdio:capture?["ignore","pipe","pipe"]:"inherit",shell:false});
  if(result.error)throw result.error;
  if(result.status!==0&&!allowFail)throw new Error(`${cmd} ${args.join(" ")} failed with exit ${result.status}${capture?`\n${result.stderr||result.stdout}`:""}`);
  return capture?(result.stdout||result.stderr||""):"";
}
function npx(args,opts){return run(process.platform==="win32"?"npx.cmd":"npx",["wrangler",...args],opts);}
function parseJsonOutput(text){const raw=String(text||"").trim();for(const [open,close] of [["[","]"],["{","}"]]){const start=raw.indexOf(open),end=raw.lastIndexOf(close);if(start>=0&&end>start){try{return JSON.parse(raw.slice(start,end+1));}catch{}}}throw new Error(`Could not parse Wrangler JSON output: ${raw.slice(0,500)}`);}
function listD1(){const out=npx(["d1","list","--json"],{capture:true});const data=parseJsonOutput(out);return Array.isArray(data)?data:data.result||[];}
function ensureD1(){let row=listD1().find(x=>x.name===DB_NAME);if(!row){console.log(`Creating D1 ${DB_NAME}…`);npx(["d1","create",DB_NAME]);row=listD1().find(x=>x.name===DB_NAME);}const id=row?.uuid||row?.id||row?.database_id;if(!id)throw new Error(`Could not resolve UUID for ${DB_NAME}`);console.log(`Using D1 ${DB_NAME} (${id})`);return id;}
function listQueues(){try{const data=parseJsonOutput(npx(["queues","list","--json"],{capture:true}));return Array.isArray(data)?data:data.result||[];}catch{return [];}}
function ensureQueues(){let current=listQueues();for(const name of QUEUES){if(current.some(x=>(x.queue_name||x.name)===name))continue;console.log(`Creating Queue ${name}…`);npx(["queues","create",name]);current=listQueues();}}
function generatedConfig(path,d1Id){const source=readFileSync(path,"utf8");if(!source.includes("__KENJI_D1_ID__"))return path;const generated=path.replace(/wrangler\.toml$/,"wrangler.generated.toml");writeFileSync(generated,source.replaceAll("__KENJI_D1_ID__",d1Id));return generated;}
function deployWithStore(config,bindings){
  const helper=resolve(PLATFORM,"scripts/deploy-with-secrets-store.mjs");if(!existsSync(helper))throw new Error(`Cloudflare platform helper not found at ${helper}. Set CLOUDFLARE_PLATFORM_DIR if needed.`);
  const args=[helper,"--config",config,"--store",STORE];for(const [workerBinding,storeSecret] of Object.entries(bindings))args.push("--bind",`${workerBinding}=${storeSecret}`);run(process.execPath,args,{cwd:PLATFORM});
}

const generated=[];
try{
  console.log("Kenji Pass 1 provisioning: D1 → queues → migration → data → voice → Overwatch");
  const d1Id=ensureD1();ensureQueues();
  const dataConfig=generatedConfig(resolve(ROOT,"apps/data-worker/wrangler.toml"),d1Id),voiceConfig=generatedConfig(resolve(ROOT,"apps/voice-worker/wrangler.toml"),d1Id),overwatchConfig=generatedConfig(resolve(ROOT,"apps/overwatch-worker/wrangler.toml"),d1Id);for(const c of [dataConfig,voiceConfig,overwatchConfig])if(c.endsWith("generated.toml"))generated.push(c);
  console.log("Applying D1 migration…");npx(["d1","migrations","apply",DB_NAME,"--remote","--config",dataConfig]);
  console.log("Deploying Kenji data worker with centralized Secrets Store…");deployWithStore(dataConfig,{INTERNAL_CALL_SECRET:"XYZ_DEMO_EILA_RUNTIME_TOKEN"});
  console.log("Deploying Kenji voice worker with centralized Secrets Store…");deployWithStore(voiceConfig,{TWILIO_ACCOUNT_SID:"XYZ_DEMO_TWILIO_ACCOUNT_SID",TWILIO_AUTH_TOKEN:"XYZ_DEMO_TWILIO_AUTH_TOKEN",DEEPGRAM_API_KEY:"XYZ_DEMO_DEEPGRAM_API_KEY",EILA_RUNTIME_TOKEN:"XYZ_DEMO_EILA_RUNTIME_TOKEN",INTERNAL_CALL_SECRET:"XYZ_DEMO_EILA_RUNTIME_TOKEN"});
  console.log("Deploying Kenji Overwatch with centralized Secrets Store…");deployWithStore(overwatchConfig,{INTERNAL_CALL_SECRET:"XYZ_DEMO_EILA_RUNTIME_TOKEN",EILA_RUNTIME_TOKEN:"XYZ_DEMO_EILA_RUNTIME_TOKEN",BLACKHOLE_CAPABILITY_TOKEN:"XYZ_DEMO_EILA_RUNTIME_TOKEN"});
  console.log("\nPass 1 deployed. Open: https://kenji-overwatch-worker.cryptocapitalgroupfl.workers.dev");
  console.log("On first load, initialize the demo owner login. Then generate the external lead API key from Integrations.");
} finally {
  for(const file of generated){try{unlinkSync(file);}catch{}}
}
