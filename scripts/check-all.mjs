import { readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT=resolve(new URL('..',import.meta.url).pathname);
const roots=['apps','scripts'];
const files=[];
function walk(dir){for(const entry of readdirSync(dir,{withFileTypes:true})){if(entry.name==='node_modules'||entry.name.startsWith('.'))continue;const full=join(dir,entry.name);if(entry.isDirectory())walk(full);else if(entry.isFile()&&entry.name.endsWith('.js'))files.push(full);}}
for(const root of roots)walk(join(ROOT,root));
for(const file of files){const r=spawnSync(process.execPath,['--check',file],{stdio:'inherit'});if(r.status!==0)process.exit(r.status||1);}
console.log(`Syntax OK: ${files.length} JavaScript files`);
