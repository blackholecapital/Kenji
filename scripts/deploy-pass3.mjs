import { existsSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const ROOT=resolve(new URL("..",import.meta.url).pathname);
const PLATFORM=process.env.CLOUDFLARE_PLATFORM_DIR||"/mnt/eila-hot-sidecar/workspace/cloudflare-platform";
const STORE="default_secrets_store";
const DB_NAME="kenji-call-center-db";

function run(cmd,args,{cwd=ROOT,capture=false}={}){const result=spawnSync(cmd,args,{cwd,encoding:"utf8",stdio:capture?["ignore","pipe","pipe"]:"inherit",shell:false});if(result.error)throw result.error;if(result.status!==0)throw new Error(`${cmd} ${args.join(" ")} failed with exit ${result.status}${capture?`\n${result.stderr||result.stdout}`:""}`);return capture?(result.stdout||result.stderr||""):"";}
function npx(args,opts){return run(process.platform==="win32"?"npx.cmd":"npx",["wrangler",...args],opts);}
function parseJsonOutput(text){const raw=String(text||"").trim();for(const [open,close] of [["[","]"],["{","}"]]){const start=raw.indexOf(open),end=raw.lastIndexOf(close);if(start>=0&&end>start){try{return JSON.parse(raw.slice(start,end+1));}catch{}}}throw new Error(`Could not parse Wrangler JSON output: ${raw.slice(0,500)}`);}
function findD1(){const data=parseJsonOutput(npx(["d1","list","--json"],{capture:true}));const rows=Array.isArray(data)?data:data.result||[];const row=rows.find(x=>x.name===DB_NAME);const id=row?.uuid||row?.id||row?.database_id;if(!id)throw new Error(`${DB_NAME} was not found. Deploy Pass 1 first.`);return id;}
function generatedConfig(path,d1Id){const source=readFileSync(path,"utf8"),generated=path.replace(/wrangler\.toml$/,"wrangler.generated.toml");writeFileSync(generated,source.replaceAll("__KENJI_D1_ID__",d1Id));return generated;}
function deployWithStore(config,bindings){const helper=resolve(PLATFORM,"scripts/deploy-with-secrets-store.mjs");if(!existsSync(helper))throw new Error(`Cloudflare platform helper not found at ${helper}. Set CLOUDFLARE_PLATFORM_DIR if needed.`);const args=[helper,"--config",config,"--store",STORE];for(const [workerBinding,storeSecret] of Object.entries(bindings))args.push("--bind",`${workerBinding}=${storeSecret}`);run(process.execPath,args,{cwd:PLATFORM});}

const generated=[];
try{
  console.log("Kenji Pass 3: outcome intelligence → agency ops → appointment confirmation → Isla actions");
  const d1Id=findD1();console.log(`Using D1 ${DB_NAME} (${d1Id})`);
  const dataConfig=generatedConfig(resolve(ROOT,"apps/data-worker/wrangler.toml"),d1Id),voiceConfig=generatedConfig(resolve(ROOT,"apps/voice-worker/wrangler.toml"),d1Id),highlevelConfig=generatedConfig(resolve(ROOT,"apps/highlevel-worker/wrangler.toml"),d1Id),overwatchConfig=generatedConfig(resolve(ROOT,"apps/overwatch-worker/wrangler.toml"),d1Id);generated.push(dataConfig,voiceConfig,highlevelConfig,overwatchConfig);
  console.log("Applying Pass 3 D1 migration…");npx(["d1","migrations","apply",DB_NAME,"--remote","--config",dataConfig]);
  console.log("Deploying Kenji Voice Pass 3…");deployWithStore(voiceConfig,{TWILIO_ACCOUNT_SID:"XYZ_DEMO_TWILIO_ACCOUNT_SID",TWILIO_AUTH_TOKEN:"XYZ_DEMO_TWILIO_AUTH_TOKEN",DEEPGRAM_API_KEY:"XYZ_DEMO_DEEPGRAM_API_KEY",EILA_RUNTIME_TOKEN:"XYZ_DEMO_EILA_RUNTIME_TOKEN",INTERNAL_CALL_SECRET:"XYZ_DEMO_EILA_RUNTIME_TOKEN"});
  console.log("Deploying Kenji HighLevel Pass 3…");deployWithStore(highlevelConfig,{INTERNAL_CALL_SECRET:"XYZ_DEMO_EILA_RUNTIME_TOKEN"});
  console.log("Deploying Kenji Overwatch Pass 3…");deployWithStore(overwatchConfig,{INTERNAL_CALL_SECRET:"XYZ_DEMO_EILA_RUNTIME_TOKEN",EILA_RUNTIME_TOKEN:"XYZ_DEMO_EILA_RUNTIME_TOKEN",BLACKHOLE_CAPABILITY_TOKEN:"XYZ_DEMO_EILA_RUNTIME_TOKEN"});
  console.log("\nPass 3 deployed.");console.log("Command Center: https://kenji-overwatch-worker.cryptocapitalgroupfl.workers.dev");console.log("New surface: Agency Ops");console.log("New flow: completed calls → AI disposition → callback/appointment intent → operator confirmation → HighLevel booking");console.log("Isla action tools plan first and require owner confirmation before execution.");
} finally {for(const file of generated){try{unlinkSync(file);}catch{}}}
