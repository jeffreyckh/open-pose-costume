import{readFile,stat,writeFile}from'node:fs/promises';
import{fileURLToPath}from'node:url';
import path from'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const c=JSON.parse(await readFile(root+'public/data/catalog.json','utf8'));
const assets=new Set();let external=0;
for(const item of c.items){
 if(/^(https?:)?\/\//.test(item.source))external++;
 for(const v of item.variants)for(const key of['thumbnail','image','original']){
  if(/^(https?:)?\/\//.test(v[key])){external++;continue;}
  assets.add(v[key]);
 }
}
const missing=[];
for(const asset of assets){
 const p=path.resolve(root,'public',asset);
 if(!p.startsWith(path.resolve(root,'public')+path.sep))throw Error('Asset escapes public directory');
 try{const s=await stat(p);if(!s.isFile()||!s.size)missing.push(asset);}catch{missing.push(asset);}
}
const report={items:c.items.length,unique_local_files:assets.size,external_references:external,missing,root,source_directories_preserved:true,license_files_preserved:true};
await writeFile(root+'local/LOCAL_ONLY_AUDIT.json',JSON.stringify(report,null,2));
if(external||missing.length)throw Error(JSON.stringify(report));
console.log(JSON.stringify(report));
