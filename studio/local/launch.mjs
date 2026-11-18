import net from 'node:net';
import { resolve, sep } from 'node:path';
import { spawn } from 'node:child_process';
import { openSync,writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const install = resolve(process.env.OPC_STUDIO_INSTALL || root) + sep;
const node=install+'runtime/node/node.exe';
writeFileSync(root+'local/benchmark-paths.yaml',`studio:\n  base_path: ${JSON.stringify(install+'local/benchmark-models')}\n  diffusion_models: diffusion_models\n  text_encoders: text_encoders\n  vae: vae\n  model_patches: model_patches\n`);
function listening(port) {
  return new Promise(resolve => {
    const socket = net.connect({ host: '127.0.0.1', port });
    let done = false;
    const finish = result => { if (!done) { done = true; socket.destroy(); resolve(result); } };
    socket.on('connect', () => finish(true)); socket.on('error', () => finish(false));
    socket.setTimeout(1000, () => finish(false));
  });
}
function start(executable, args, cwd, name) {
  const out = openSync(root + name + '.stdout.log', 'a');
  const err = openSync(root + name + '.stderr.log', 'a');
  const child = spawn(executable, args, { cwd, env:{...process.env,HF_HUB_OFFLINE:'1',TRANSFORMERS_OFFLINE:'1',PYTHONDONTWRITEBYTECODE:'1'}, detached: true, windowsHide: true, stdio: ['ignore', out, err] });
  child.unref();
}
if (!await listening(8189)) start(install+'local\\benchmark-venv\\Scripts\\python.exe',['-s','main.py','--listen','127.0.0.1','--port','8189','--disable-auto-launch','--disable-all-custom-nodes','--extra-model-paths-config',root+'local\\benchmark-paths.yaml','--reserve-vram','1.5'],install+'local\\benchmark-comfy','qwen');
if (!await listening(8192)) start(node, ['local/bridge.mjs'], root, 'bridge');
if (!await listening(5200)) start(node, ['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5200','--strictPort'], root, 'ui');
for (let n = 0; n < 40 && !await listening(5200); n++) await new Promise(resolve => setTimeout(resolve, 500));
if (!await listening(5200)) throw Error('Local UI did not start. See ui.stderr.log.');
if (!process.argv.includes('--no-browser')) {
  spawn('rundll32.exe', ['url.dll,FileProtocolHandler','http://127.0.0.1:5200/?lang=en&view=studio'], { detached: true, windowsHide: true, stdio: 'ignore' }).unref();
}
console.log('Local Reference Studio: http://127.0.0.1:5200/?lang=en&view=studio');
