import { existsSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const ROOT=resolve(new URL("..",import.meta.url).pathname);
const STORE="default_secrets_store";
const DB_NAME="kenji-call-center-db";
const QUEUES=["kenji-orch-video-ingress","kenji-orch-video-ingress-dlq","kenji-video-jobs","kenji-video-jobs-dlq"];
function run(cmd,args,{cwd=ROOT,capture=false,allowFail=false}={}){const r=spawnSync(cmd,args,{cwd,encoding:"utf8",stdio:capture?["ignore","pipe","pipe"]:"inherit",shell:false});if(r.error)throw r.error;if(r.status!==0&&!allowFail)throw new Error(`${cmd} ${args.join(" ")} failed with exit ${r.status}${capture?`\n${r.stderr||r.stdout}`:""}`);return capture?(r.stdout||r.stderr||""):"";}
function npx(args,opts){return run(process.platform==="win32"?"npx.cmd":"npx",["wrangler",...args],opts);}
function parseJsonOutput(text){const raw=String(text||"").trim();for(const [o,c] of [["[","]"],["{","}"]]){const s=raw.indexOf(o),e=raw.lastIndexOf(c);if(s>=0&&e>s){try{return JSON.parse(raw.slice(s,e+1));}catch{}}}throw new Error(`Could not parse Wrangler JSON output: ${raw.slice(0,500)}`);}
function findD1(){const data=parseJsonOutput(npx(["d1","list","--json"],{capture:true}));const rows=Array.isArray(data)?data:data.result||[];const row=rows.find(x=>x.name===DB_NAME);const id=row?.uuid||row?.id||row?.database_id;if(!id)throw new Error(`${DB_NAME} was not found. Deploy earlier passes first.`);return id;}
function ensureQueue(name){const cmd=process.platform==="win32"?"npx.cmd":"npx";console.log(`Ensuring Queue ${name}…`);const r=spawnSync(cmd,["wrangler","queues","create",name],{cwd:ROOT,encoding:"utf8",stdio:["ignore","pipe","pipe"],shell:false});if(r.error)throw r.error;const output=`${r.stdout||""}\n${r.stderr||""}`;if(r.status===0){console.log(`Queue ${name} created.`);return;}if(/already taken|code:\s*11009|\[code:\s*11009\]/i.test(output)){console.log(`Queue ${name} already exists; continuing.`);return;}throw new Error(`wrangler queues create ${name} failed with exit ${r.status}\n${output.slice(0,4000)}`);}
function generatedConfig(path,d1Id){const source=readFileSync(path,"utf8"),generated=path.replace(/wrangler\.toml$/,"wrangler.generated.toml");writeFileSync(generated,source.replaceAll("__KENJI_D1_ID__",d1Id));return generated;}
function deployWithStore(config,bindings){const helper=resolve(ROOT,"scripts/deploy-with-secrets-store.mjs");if(!existsSync(helper))throw new Error(`Kenji deploy helper not found at ${helper}.`);const args=[helper,"--config",config,"--store",STORE];for(const [workerBinding,storeSecret] of Object.entries(bindings))args.push("--bind",`${workerBinding}=${storeSecret}`);run(process.execPath,args,{cwd:ROOT});}

const generated=[];
try{
  console.log("Kenji Pass 8: governed video ingress → video execution worker → shared avatar broker → full-stack rehearsal");
  const d1Id=findD1();console.log(`Using D1 ${DB_NAME} (${d1Id})`);for(const q of QUEUES)ensureQueue(q);
  const dataConfig=generatedConfig(resolve(ROOT,"apps/data-worker/wrangler.toml"),d1Id);
  const orchConfig=generatedConfig(resolve(ROOT,"apps/orchestrator-worker/wrangler.toml"),d1Id);
  const videoConfig=generatedConfig(resolve(ROOT,"apps/video-worker/wrangler.toml"),d1Id);
  const overwatchConfig=generatedConfig(resolve(ROOT,"apps/overwatch-worker/wrangler.toml"),d1Id);
  generated.push(dataConfig,orchConfig,videoConfig,overwatchConfig);
  console.log("Applying Pass 8 D1 migration…");npx(["d1","migrations","apply",DB_NAME,"--remote","--config",dataConfig]);
  console.log("Redeploying Kenji Orchestrator with governed video lane…");deployWithStore(orchConfig,{INTERNAL_CALL_SECRET:"XYZ_DEMO_EILA_RUNTIME_TOKEN"});
  console.log("Deploying Kenji Video Worker…");deployWithStore(videoConfig,{INTERNAL_CALL_SECRET:"XYZ_DEMO_EILA_RUNTIME_TOKEN",BLACKHOLE_CAPABILITY_TOKEN:"XYZ_DEMO_EILA_RUNTIME_TOKEN"});
  console.log("Deploying Kenji Overwatch Pass 8…");deployWithStore(overwatchConfig,{INTERNAL_CALL_SECRET:"XYZ_DEMO_EILA_RUNTIME_TOKEN",EILA_RUNTIME_TOKEN:"XYZ_DEMO_EILA_RUNTIME_TOKEN",BLACKHOLE_CAPABILITY_TOKEN:"XYZ_DEMO_EILA_RUNTIME_TOKEN"});
  console.log("\nPass 8 deployed.");
  console.log("Command Center: https://kenji-overwatch-worker.cryptocapitalgroupfl.workers.dev");
  console.log("Video route: browser → kenji-orch-video-ingress → governor → kenji-video-jobs → kenji-video-worker → blackhole-video-worker");
  console.log("Scale Lab video lane is now queue-backed. Full-stack rehearsal sends zero provider traffic.");
} finally {for(const file of generated){try{unlinkSync(file);}catch{}}}
