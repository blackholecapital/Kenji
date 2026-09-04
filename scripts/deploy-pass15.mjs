import { existsSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const ROOT=resolve(new URL("..",import.meta.url).pathname);
const STORE="default_secrets_store";
const DB_NAME="kenji-call-center-db";
function run(cmd,args,{cwd=ROOT,capture=false}={}){const r=spawnSync(cmd,args,{cwd,encoding:"utf8",stdio:capture?["ignore","pipe","pipe"]:"inherit",shell:false});if(r.error)throw r.error;if(r.status!==0)throw new Error(`${cmd} ${args.join(" ")} failed with exit ${r.status}${capture?`\n${r.stderr||r.stdout}`:""}`);return capture?(r.stdout||r.stderr||""):"";}
function npx(args,opts){return run(process.platform==="win32"?"npx.cmd":"npx",["wrangler",...args],opts);}
function parseJsonOutput(text){const raw=String(text||"").trim();for(const [o,c] of [["[","]"],["{","}"]]){const s=raw.indexOf(o),e=raw.lastIndexOf(c);if(s>=0&&e>s){try{return JSON.parse(raw.slice(s,e+1));}catch{}}}throw new Error(`Could not parse Wrangler JSON output: ${raw.slice(0,500)}`);}
function findD1(){const data=parseJsonOutput(npx(["d1","list","--json"],{capture:true}));const rows=Array.isArray(data)?data:data.result||[];const row=rows.find(x=>x.name===DB_NAME);const id=row?.uuid||row?.id||row?.database_id;if(!id)throw new Error(`${DB_NAME} was not found. Deploy earlier passes first.`);return id;}
function generatedConfig(path,d1Id){const source=readFileSync(path,"utf8"),generated=path.replace(/wrangler\.toml$/,"wrangler.generated.toml");writeFileSync(generated,source.replaceAll("__KENJI_D1_ID__",d1Id));return generated;}
function deployWithStore(config,bindings){const helper=resolve(ROOT,"scripts/deploy-with-secrets-store.mjs");if(!existsSync(helper))throw new Error(`Kenji deploy helper not found at ${helper}.`);const args=[helper,"--config",config,"--store",STORE];for(const [workerBinding,storeSecret] of Object.entries(bindings))args.push("--bind",`${workerBinding}=${storeSecret}`);run(process.execPath,args,{cwd:ROOT});}

let generated="";
try{
  console.log("Kenji Pass 15: compact overview → stable callbacks → premium call activity + transcript drawer");
  const d1Id=findD1();console.log(`Using D1 ${DB_NAME} (${d1Id})`);
  generated=generatedConfig(resolve(ROOT,"apps/overwatch-worker/wrangler.toml"),d1Id);
  console.log("Deploying Kenji Overwatch Pass 15…");
  deployWithStore(generated,{INTERNAL_CALL_SECRET:"XYZ_DEMO_EILA_RUNTIME_TOKEN",EILA_RUNTIME_TOKEN:"XYZ_DEMO_EILA_RUNTIME_TOKEN",BLACKHOLE_CAPABILITY_TOKEN:"XYZ_DEMO_EILA_RUNTIME_TOKEN"});
  console.log("\nPass 15 deployed.");
  console.log("Command Center: https://kenji-overwatch-worker.cryptocapitalgroupfl.workers.dev");
  console.log("Polish: compact Overview rack, hot-lead fire tiers, stable stage-mapped callbacks with icon deck, premium call tickets and transcript detail panel.");
  console.log("No provider, queue, secret, D1 schema, or execution-worker changes.");
  console.log("No other repository participates in this deployment.");
} finally {if(generated){try{unlinkSync(generated);}catch{}}}
