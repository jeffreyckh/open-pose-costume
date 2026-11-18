import test from 'node:test';import assert from 'node:assert/strict';import {buildWorkflow}from './workflow.mjs';
test('three references condition both CFG branches in role order; no pixel overlay or Canny',()=>{
 const{graph,outputNode}=buildWorkflow({images:{character:'face.png',costume:'dress.png',pose:'pose.png'},prompt:'Fashion photograph',size:'768x1024'});const nodes=Object.values(graph);
 assert.deepEqual(nodes.filter(n=>n.class_type==='LoadImage').map(n=>n.inputs.image),['pose.png','dress.png','face.png']);assert.equal(nodes.filter(n=>n.class_type==='ReferenceLatent').length,6);assert.equal(nodes.filter(n=>n.class_type==='VAEEncode').length,3);
 assert.equal(nodes.some(n=>/Canny|Composite|IPAdapter|Mask/.test(n.class_type)),false);assert.equal(graph[outputNode].class_type,'SaveImage');
 const cfg=nodes.find(n=>n.class_type==='CFGGuider');for(const branch of ['positive','negative']){let ref=cfg.inputs[branch],count=0;while(graph[ref[0]].class_type==='ReferenceLatent'){count++;ref=graph[ref[0]].inputs.conditioning;}assert.equal(count,3);}
});
test('invalid inputs fail before expensive submission',()=>{assert.throws(()=>buildWorkflow({images:{},prompt:'x'}),/pose/);assert.throws(()=>buildWorkflow({images:{pose:'p',costume:'c'},prompt:'x',size:'4000x4000'}),/resolution/);});

test('front neck-and-thigh pose gets asymmetric hand constraints and reference appearance instructions',()=>{
 const base={images:{pose:'p',costume:'c',character:'f'},prompt:'fashion',size:'768x1024',poseTitle:'Standing with hands at neck and thigh'};
 const front=buildWorkflow(base).instruction;assert.ok(front.includes('RIGHT arm hangs down'));assert.ok(front.includes('apparent age'));assert.ok(front.includes('white balance'));
 const side=buildWorkflow({...base,poseAngle:'side'}).instruction;assert.ok(!side.includes('RIGHT arm hangs down'));
 const other=buildWorkflow({...base,poseTitle:'Both arms raised'}).instruction;assert.ok(!other.includes('RIGHT arm hangs down'));
});
