// Offline, additive adapter. Existing IDs, translations and selected references survive.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
const root=fileURLToPath(new URL('../',import.meta.url));
const source=path.resolve(process.argv.find(x=>x.startsWith('--source='))?.slice(9)||'D:/AI/RuiC-PoseAtlas');
const apply=process.argv.includes('--apply');
const read=async p=>JSON.parse(await fs.readFile(p,'utf8'));
const catalogPath=path.join(root,'public/data/catalog.json');
const catalog=await read(catalogPath);
const byId=new Map(catalog.items.map(x=>[x.id,x]));
const [poses,costumes,faces]=await Promise.all(['poses','costumes','faces'].map(n=>read(path.join(source,'data',n+'.json'))));
const local=p=>{const f=path.resolve(source,p);if(!f.startsWith(source+path.sep))throw Error('Source path escapes atlas');return f;};
const labels=x=>({zh:x?.zh||x?.en||'',en:x?.en||x?.zh||''});
const report={source,mode:apply?'apply':'audit',matched:{pose:0,costume:0,character:0},added:[],missing:[],source_assets_missing:[],sample_hash_comparisons:[],quality_approved:false};
const prefix={full_std:'full_single',upper:'upper80v2',duo:'pair60',full_sexy:'full_sexy'};
const rows=[
 ...poses.poses.map(x=>({id:`${prefix[x.series]||x.series}_${x.no}`,kind:'pose',code:x.no,title:labels(x.names),category:{id:x.category,...labels(poses.categories.find(c=>c.key===x.category)?.names)},series:labels(poses.series.find(s=>s.key===x.series)?.names),variants:x.variants.map(v=>({id:`${prefix[x.series]||x.series}_${x.no}_${v.angle==='diagonal'?'diag':v.angle}`,angle:v.angle==='diagonal'?'diag':v.angle,label:labels(poses.angles.find(a=>a.key===v.angle)?.names),thumb:v.thumb,full:v.full}))})),
 ...costumes.costumes.map(x=>({id:x.id,kind:'costume',code:x.id,title:{zh:x.tags.join(' '),en:x.tags.join(' ')},category:{id:x.cat,...labels(costumes.categories.find(c=>c.key===x.cat)?.names)},series:{zh:'服装参考',en:'Costume reference'},variants:[{id:x.id,angle:'front',label:{zh:'正面',en:'Front'},thumb:x.thumb,full:x.image}]})),
 ...faces.images.map(x=>({id:'portrait-'+x.id,kind:'character',code:x.id,title:{zh:`${x.id} · 角色参考`,en:`${x.id} · Character reference`},category:{id:'portrait-'+x.sec,...labels(faces.sections.find(s=>s.key===x.sec)?.names)},series:labels(faces.hairs.find(h=>h.key===x.hair)?.names),portrait:{section:x.sec,hair:x.hair},variants:[{id:x.id,angle:'front',label:labels(faces.sections.find(s=>s.key===x.sec)?.names),thumb:x.thumb,full:x.full}]}))
];
for(const row of rows){
 const existing=byId.get(row.id);
 if(existing){
  if(existing.kind!==row.kind)throw Error('ID kind conflict: '+row.id);
  report.matched[row.kind]++;
  for(const v of existing.variants)for(const key of ['thumbnail','image','original']){
   const f=path.resolve(root,'public',v[key]);
   if(!f.startsWith(path.resolve(root,'public')+path.sep))throw Error('Non-local target');
   try{await fs.access(f);}catch{report.missing.push(v[key]);}
  }
  // Byte identity is evidence only when encodings/extensions match.
  if(report.sample_hash_comparisons.filter(x=>x.kind===row.kind).length<3){
   const a=local(row.variants[0].full),b=path.join(root,'public',existing.variants[0].original);
   try{const [aa,bb]=await Promise.all([fs.readFile(a),fs.readFile(b)]);report.sample_hash_comparisons.push({kind:row.kind,id:row.id,equal:createHash('sha256').update(aa).digest('hex')===createHash('sha256').update(bb).digest('hex')});}catch{}
  }
  continue;
 }
 const variants=[];
 for(const v of row.variants){
  const files={};
  for(const [key,p] of [['thumbnail',v.thumb],['image',v.full]]){
   try{await fs.access(local(p));}catch{report.source_assets_missing.push(p);continue;}
   const dest=`atlas-library/${row.kind}/${v.id}-${key}${path.extname(p)}`;
   if(apply){await fs.mkdir(path.dirname(path.join(root,'public',dest)),{recursive:true});await fs.copyFile(local(p),path.join(root,'public',dest),fs.constants.COPYFILE_EXCL);}
   files[key]=dest;
  }
  if(files.image&&files.thumbnail)variants.push({id:v.id,angle:v.angle,label:v.label,...files,original:files.image});
 }
 if(variants.length!==row.variants.length)continue;
 const item={...row,extended:false,keywords:row.title,source:'data/catalog.json',variants};
 catalog.items.push(item);byId.set(item.id,item);report.added.push(item.id);
}
const count=k=>catalog.items.filter(x=>x.kind===k).length;
catalog.stats={poseGroups:count('pose'),poseImages:catalog.items.filter(x=>x.kind==='pose').reduce((n,x)=>n+x.variants.length,0),costumes:count('costume'),characters:count('character'),references:catalog.items.length,images:catalog.items.reduce((n,x)=>n+x.variants.length,0)};
report.stats=catalog.stats;
if(report.missing.length)throw Error('Existing assets missing; see audit before changing catalog');
if(apply){
 await fs.mkdir(path.join(root,'local/atlas-import'),{recursive:true});
 const backup=path.join(root,'local/atlas-import/catalog.before.json');
 try{await fs.copyFile(catalogPath,backup,fs.constants.COPYFILE_EXCL);}catch(e){if(e.code!=='EEXIST')throw e;}
 await fs.copyFile(path.join(source,'LICENSE'),path.join(root,'local/atlas-import/RuiC-PoseAtlas-LICENSE.txt'));
 await fs.writeFile(catalogPath,JSON.stringify(catalog,null,2)+'\n');
 // Existing preview builds serve dist, while Vite dev serves public.
 try{await fs.access(path.join(root,'dist/data/catalog.json'));await fs.copyFile(catalogPath,path.join(root,'dist/data/catalog.json'));}catch(e){if(e.code!=='ENOENT')throw e;}
}
await fs.mkdir(path.join(root,'local/atlas-import'),{recursive:true});
await fs.writeFile(path.join(root,'local/atlas-import/report.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
