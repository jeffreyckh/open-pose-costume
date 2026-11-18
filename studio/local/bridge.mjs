import { refineIdentity } from './identity.mjs';
import {contentMode} from './content-mode.mjs';
import http from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile, readFile, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { buildWorkflow, MODELS } from './workflow.mjs';
import {buildQwenWorkflow,QWEN_MODEL_ID,QWEN_MODELS} from './workflow-qwen.mjs';

const COMFY = 'http://127.0.0.1:8189';
const OUTPUT = fileURLToPath(new URL('../output/local-jobs/', import.meta.url));
const origins = new Set(['http://127.0.0.1:5200', 'http://localhost:5200']);
let busy = false;
const GPU_BACKENDS=[['http://127.0.0.1:8189','Studio image generation'],['http://127.0.0.1:8188','Other local generation'],['http://127.0.0.1:8194','Three Brothers video']];
function queueBusy(backend,queue){
 const label=GPU_BACKENDS.find(([url])=>url===backend)?.[1]||'Local generation';
 const error=Error(`${label} is using the GPU. No image job was submitted. Wait for that task to finish, then generate once.`);
 Object.assign(error,{status:409,code:'gpu_busy',backend,active_prompt_ids:queue.queue_running.map(row=>row[1])});
 return error;
}
async function comfy(path, options, backend=COMFY) {
  const response = await fetch(backend + path, { ...options, signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw Error(`ComfyUI ${response.status}: ${(await response.text()).slice(0, 600)}`);
  return response;
}
async function available(modelId='FLUX.2-klein-base-4B-local') {
 const isQwen=modelId===QWEN_MODEL_ID,models=isQwen?QWEN_MODELS:MODELS,backend=isQwen?'http://127.0.0.1:8189':COMFY;
 const checks=[['UNETLoader','unet_name',models.diffusion],['CLIPLoader','clip_name',models.text],['VAELoader','vae_name',models.vae]];
 for(const[node,field,model]of checks){const info=await(await comfy(`/object_info/${node}`,undefined,backend)).json();if(!info[node]?.input.required[field][0].includes(model))throw Error(`Missing local model: ${model}`);}
 for(const node of isQwen?['TextEncodeQwenImage21','QwenImage21Cache','ResizeAndPadImage','QwenImageDiffsynthControlnet']:['ReferenceLatent','EmptyFlux2LatentImage','Flux2Scheduler']){const info=await(await comfy(`/object_info/${node}`,undefined,backend)).json();if(!info[node])throw Error(`Missing core node: ${node}`);}
}
function send(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(data));
}
const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin;
  if (origin && !origins.has(origin)) return send(res, 403, { error: { message: 'Local studio origin required.' } });
  if (origin) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  if(req.method==='GET'&&req.url==='/gpu-status'){
    const queues=await Promise.all(GPU_BACKENDS.map(async([backend,label])=>{
      try{const response=await fetch(backend+'/queue',{signal:AbortSignal.timeout(3000)});if(!response.ok)throw Error('Queue unavailable');const q=await response.json();return{backend,label,available:true,running:q.queue_running.map(row=>row[1]),pending:q.queue_pending.map(row=>row[1])};}
      catch{return{backend,label,available:false,running:[],pending:[]};}
    }));
    return send(res,200,{busy:busy||queues.some(q=>q.running.length||q.pending.length),queues});
  }
  if (req.method === 'GET' && req.url === '/health') {
    try { await available(QWEN_MODEL_ID); return send(res, 200, { ready: true, backend: 'http://127.0.0.1:8189', model:QWEN_MODEL_ID, models: QWEN_MODELS, identity_refinement: false, bridge_pid: process.pid, paid_fallback: false }); }
    catch (error) { return send(res, 503, { ready: false, error: error.message }); }
  }
  if (req.method !== 'POST' || req.url !== '/v1/images/edits') return send(res, 404, { error: { message: 'Not found' } });
  if (busy) return send(res, 409, { error: { code:'gpu_busy', submitted:false,message: 'A Studio job is already running. No additional job was submitted. Wait for it to finish.' } });
  busy = true;
  let jobDir, submitted;
  try {
    if (!String(req.headers['content-type']).startsWith('multipart/form-data;')) throw Error('Multipart image references required.');
    let count = 0; const chunks = [];
    for await (const chunk of req) {
      count += chunk.length;
      if (count > 40 * 1024 * 1024) throw Error('Reference upload exceeds 40 MB.');
      chunks.push(chunk);
    }
    const form = await new Request('http://127.0.0.1/', {
      method: 'POST', headers: { 'Content-Type': req.headers['content-type'] }, body: Buffer.concat(chunks),
    }).formData();
    const prompt = String(form.get('prompt') || '').trim();
    if (!prompt || prompt.length > 12000) throw Error('Provide a prompt of at most 12000 characters.');
    const modelId=String(form.get('model'));if(!['FLUX.2-klein-base-4B-local',QWEN_MODEL_ID].includes(modelId))throw Error('Choose an installed local model.');
    const isQwen=modelId===QWEN_MODEL_ID,backend=isQwen?'http://127.0.0.1:8189':COMFY;
    const requestComfy=(path,options)=>comfy(path,options,backend);const build=isQwen?buildQwenWorkflow:buildWorkflow;
    const files = new Map();
    for (const file of form.getAll('image[]')) {
      const role = /^(pose|costume|character|depth)-/.exec(file.name || '')?.[1];
      if (!role || files.has(role) || !['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || !file.size || file.size > 12 * 1024 * 1024)
        throw Error('Use one PNG/JPG/WebP per role: pose, costume and optional character (12 MB each).');
      files.set(role, file);
    }
    const mode=contentMode(prompt);
    if(mode==='art'){files.delete('character');files.delete('costume');files.delete('depth');}
    if (!files.has('pose') || (mode!=='art'&&!files.has('costume'))) throw Error('Pose and costume are required; automatic outfit extraction is not supported locally.');
    const size = String(form.get('size') || '768x1024');
    const style = String(form.get('style') || 'anime');
    const poseTitle=String(form.get('pose_title') || '').slice(0,500);
    const poseAngle=String(form.get('pose_angle') || 'front');
    const quality = String(form.get('quality') || 'auto');
    build({ images: Object.fromEntries([...files.keys()].map(role => [role, role])), prompt, size, quality, style, poseTitle, poseAngle });
    await available(modelId);
    for(const stop of ['D:/AI/STOP_REQUESTED.json',fileURLToPath(new URL('../STOP_REQUESTED.json',import.meta.url)),fileURLToPath(new URL('./STOP_REQUESTED.json',import.meta.url))]){try {await access(stop);throw Error('Local STOP file is present.');}catch(e){if(e.code!=='ENOENT')throw e;}}
    try { const other=JSON.parse(await readFile(OUTPUT+'tryon-active.json','utf8'));try{process.kill(other.pid,0);throw Error('The separate try-on process is active.');}catch(e){if(e.code!=='ESRCH')throw e;} } catch(e){if(e.code!=='ENOENT')throw e;}
    const queue = await (await requestComfy('/queue')).json();
    await requestComfy('/history?max_items=1');
    if (queue.queue_running.length || queue.queue_pending.length) throw queueBusy(backend,queue);
    for(const otherBackend of ['http://127.0.0.1:8188','http://127.0.0.1:8194']){
     try{const other=await(await comfy('/queue',undefined,otherBackend)).json();if(other.queue_running.length||other.queue_pending.length)throw queueBusy(otherBackend,other);await comfy('/history?max_items=1',undefined,otherBackend);await comfy('/free',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({unload_models:true,free_memory:true})},otherBackend);}catch(e){if(e.code==='gpu_busy')throw e;if(e.cause?.code!=='ECONNREFUSED')throw e;}
    }
    const id = randomUUID();
    jobDir = `${OUTPUT}${id}/`;
    await mkdir(jobDir, { recursive: true });
    const inventory=await promisify(execFile)('nvidia-smi',['--query-compute-apps=pid,process_name,used_memory','--format=csv'],{windowsHide:true});
    await writeFile(jobDir+'preflight.json',JSON.stringify({queue,gpu:inventory.stdout,time:new Date().toISOString(),automatic_retry:false},null,2));
    const images = {};
    for (const [role, file] of files) {
      const upload = new FormData();
      upload.set('image', file, `${role}.${file.type === 'image/png' ? 'png' : file.type === 'image/jpeg' ? 'jpg' : 'webp'}`);
      upload.set('type', 'input'); upload.set('subfolder', `LocalPoseCostume/${id}`);
      const result = await (await requestComfy('/upload/image', { method: 'POST', body: upload })).json();
      images[role] = `${result.subfolder}/${result.name}`;
    }
    const workflow = build({ images, prompt, size, quality, style, poseTitle, poseAngle });
    await writeFile(jobDir+'pipeline.json',JSON.stringify({model:modelId,backend,content_mode:mode,garment_fidelity:!!workflow.garmentFidelity,spatial_control:!!workflow.spatialControl,face_swap:mode!=='art'&&!isQwen&&form.get('identity')==='on',quality_approved:false},null,2));
    await writeFile(jobDir + 'workflow_api.json', JSON.stringify(workflow.graph, null, 2));
    await writeFile(jobDir + 'STOP_AUTORETRY.json', JSON.stringify({ automatic_retry: false, story_quality_approved: false }));
    submitted = await (await requestComfy('/prompt', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: workflow.graph, client_id: `local-pose-costume-${id}` }),
    })).json();
    await writeFile(jobDir + 'submission.json', JSON.stringify(submitted, null, 2));
    const deadline = Date.now() + 25 * 60 * 1000;
    while (Date.now() < deadline) {
      const history = await (await requestComfy(`/history/${submitted.prompt_id}`)).json();
      const entry = history[submitted.prompt_id];
      if (entry) {
        await writeFile(jobDir + 'history.json', JSON.stringify(entry, null, 2));
        if (entry.status?.status_str !== 'success') throw Error(`Local execution failed. Evidence: ${jobDir}`);
        const image = entry.outputs[workflow.outputNode]?.images?.[0];
        if (!image) throw Error('ComfyUI completed without an output image.');
        const query = new URLSearchParams(image);
        const buffer = Buffer.from(await (await requestComfy(`/view?${query}`)).arrayBuffer());
        await writeFile(jobDir + 'result.png', buffer);
        let final=buffer,identity;
        if(!isQwen && form.get('identity')==='on' && files.has('character')){
          const refined=await refineIdentity(Buffer.from(await files.get('character').arrayBuffer()),buffer,jobDir);
          final=refined.buffer;identity=refined.audit;await writeFile(jobDir+'final-result.png',final);
        }
        return send(res, 200, { data: [{ b64_json: final.toString('base64') }], prompt_id: submitted.prompt_id, identity, model:modelId,spatial_control:!!workflow.spatialControl });
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    throw Error(`Local job timed out. It may still be running; do not retry blindly. Prompt ID: ${submitted.prompt_id}`);
  } catch (error) {
    if (jobDir) await writeFile(jobDir + 'error.json', JSON.stringify({ message: error.message, submission: submitted })).catch(() => {});
    send(res, error.status||400, { error: { message: error.message,code:error.code,submitted:!!submitted,backend:error.backend,active_prompt_ids:error.active_prompt_ids } });
  } finally { busy = false; }
});
server.listen(8192, '127.0.0.1', () => console.log('Local image bridge: http://127.0.0.1:8192 (ComfyUI :8189)'));
