import { existsSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const ROOT=resolve(new URL("..",import.meta.url).pathname);
const STORE="default_secrets_store";
const DB_NAME="kenji-call-center-db";

function run(cmd,args,{cwd=ROOT,capture=false}={}){const result=spawnSync(cmd,args,{cwd,encoding:"utf8",stdio:capture?["ignore","pipe","pipe"]:"inherit",shell:false});if(result.error)throw result.error;if(result.status!==0)throw new Error(`${cmd} ${args.join(" ")} failed with exit ${result.status}${capture?`\n${result.stderr||result.stdout}`:""}`);return capture?(result.stdout||result.stderr||""):"";}
function npx(args,opts){return run(process.platform==="win32"?"npx.cmd":"npx",["wrangler",...args],opts);}
function parseJsonOutput(text){const raw=String(text||"").trim();for(const [open,close] of [["[","]"],["{","}"]]){const start=raw.indexOf(open),end=raw.lastIndexOf(close);if(start>=0&&end>start){try{return JSON.parse(raw.slice(start,end+1));}catch{}}}throw new Error(`Could not parse Wrangler JSON output: ${raw.slice(0,500)}`);}
function findD1(){const data=parseJsonOutput(npx(["d1","list","--json"],{capture:true}));const rows=Array.isArray(data)?data:data.result||[];const row=rows.find(x=>x.name===DB_NAME);const id=row?.uuid||row?.id||row?.database_id;if(!id)throw new Error(`${DB_NAME} was not found. Deploy earlier passes first.`);return id;}
function generatedConfig(path,d1Id){const source=readFileSync(path,"utf8"),generated=path.replace(/wrangler\.toml$/,"wrangler.generated.toml");writeFileSync(generated,source.replaceAll("__KENJI_D1_ID__",d1Id));return generated;}
function deployWithStore(config,bindings){const helper=resolve(ROOT,"scripts/deploy-with-secrets-store.mjs");if(!existsSync(helper))throw new Error(`Kenji deploy helper not found at ${helper}.`);const args=[helper,"--config",config,"--store",STORE];for(const [workerBinding,storeSecret] of Object.entries(bindings))args.push("--bind",`${workerBinding}=${storeSecret}`);run(process.execPath,args,{cwd:ROOT});}

const generated=[];
try{
  console.log("Kenji Pass 5: audience preview → rate-limited campaigns → disposition retry engine");
  const d1Id=findD1();console.log(`Using D1 ${DB_NAME} (${d1Id})`);
  const dataConfig=generatedConfig(resolve(ROOT,"apps/data-worker/wrangler.toml"),d1Id),campaignConfig=generatedConfig(resolve(ROOT,"apps/campaign-worker/wrangler.toml"),d1Id),overwatchConfig=generatedConfig(resolve(ROOT,"apps/overwatch-worker/wrangler.toml"),d1Id);generated.push(dataConfig,campaignConfig,overwatchConfig);
  console.log("Applying Pass 5 D1 migration…");npx(["d1","migrations","apply",DB_NAME,"--remote","--config",dataConfig]);
  console.log("Deploying Kenji Campaign Worker…");deployWithStore(campaignConfig,{INTERNAL_CALL_SECRET:"XYZ_DEMO_EILA_RUNTIME_TOKEN"});
  console.log("Deploying Kenji Overwatch Pass 5…");deployWithStore(overwatchConfig,{INTERNAL_CALL_SECRET:"XYZ_DEMO_EILA_RUNTIME_TOKEN",EILA_RUNTIME_TOKEN:"XYZ_DEMO_EILA_RUNTIME_TOKEN",BLACKHOLE_CAPABILITY_TOKEN:"XYZ_DEMO_EILA_RUNTIME_TOKEN"});
  console.log("\nPass 5 deployed.");
  console.log("Command Center: https://kenji-overwatch-worker.cryptocapitalgroupfl.workers.dev");
  console.log("New surface: Campaigns");
  console.log("Dispatcher: once per minute through kenji-campaign-worker → existing kenji-call-jobs queue");
  console.log("Safety: preview first, explicit launch, pause-all kill switch, DNC/contactability and Won/Lost hard stops.");
} finally {for(const file of generated){try{unlinkSync(file);}catch{}}}
