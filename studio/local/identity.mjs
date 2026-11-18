import{resolve}from'node:path';import{spawn}from'node:child_process';import{mkdir,writeFile,readFile}from'node:fs/promises';import{fileURLToPath}from'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
export async function refineIdentity(reference,base,jobDir){
 const dir=jobDir+'identity/';await mkdir(dir,{recursive:true});await writeFile(dir+'reference.png',reference);await writeFile(dir+'base.png',base);
 await new Promise((resolve,reject)=>{const child=spawn(resolve(process.env.OPC_STUDIO_INSTALL || root,'runtime/python/python.exe'),[root+'local/refine-identity.py',dir+'reference.png',dir+'base.png',dir,'--boost','2'],{cwd:root,windowsHide:true});let log='';child.stdout.on('data',b=>log+=b);child.stderr.on('data',b=>log+=b);child.on('error',reject);child.on('close',async code=>{await writeFile(dir+'run.log',log);if(code)reject(Error('Face refinement failed; base image is saved. '+log.replaceAll('\0','').slice(-550)));else resolve();});});
 const audit=JSON.parse(await readFile(dir+'identity-audit.json','utf8'));return{buffer:await readFile(dir+'identity-result.png'),audit};
}
