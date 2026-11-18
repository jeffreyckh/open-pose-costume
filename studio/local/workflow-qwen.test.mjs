import test from 'node:test';import assert from 'node:assert/strict';import{buildQwenWorkflow}from'./workflow-qwen.mjs';
test('pose and depth fit the same canvas without stretching; appearance refs stay separate',()=>{
 const w=buildQwenWorkflow({images:{pose:'p',depth:'d',costume:'c',character:'f'},prompt:'studio photo',size:'1024x768',poseAngle:'side',spatialControl:true});const n=Object.values(w.graph),pads=n.filter(n=>n.class_type==='ResizeAndPadImage');
 assert.equal(pads.length,2);for(const p of pads){assert.equal(p.inputs.target_width,1024);assert.equal(p.inputs.target_height,768)}
 assert.equal(n.some(n=>n.class_type==='ImageScale'),false);assert.equal(n.some(n=>/Composite|FaceSwap|INSwapper/.test(n.class_type)),false);
 assert.equal(w.spatialControl,true);assert.ok(w.instruction.includes('strict side/profile'));assert.ok(!w.instruction.includes('light peach'));
 const enc=n.find(n=>n.class_type==='TextEncodeQwenImage21');assert.ok(enc.inputs['images.image_1']);assert.ok(enc.inputs['images.image_2']);assert.ok(enc.inputs['images.image_3']);
});
test('no face or depth reference does not claim those controls',()=>{const w=buildQwenWorkflow({images:{pose:'p',costume:'c'},prompt:'anime',poseAngle:'high'});assert.equal(w.spatialControl,false);assert.equal(w.instruction.includes('<image3>'),false);assert.ok(w.instruction.includes('looking down'));assert.throws(()=>buildQwenWorkflow({images:{},prompt:'x'}),/required/);});
test('unapproved depth route stays off by default even if a depth file is supplied',()=>{const w=buildQwenWorkflow({images:{pose:'p',costume:'c',depth:'d'},prompt:'photo'});assert.equal(w.spatialControl,false);assert.equal(Object.values(w.graph).some(n=>n.class_type==='QwenImageDiffsynthControlnet'),false);});
test('adult fashion reserves extra reference detail for the garment without changing pose or identity routing',()=>{
 const w=buildQwenWorkflow({images:{pose:'p',costume:'c',character:'f'},prompt:'[ADULT_FASHION_EXACT_OUTFIT] full-body dress',poseAngle:'high'});
 const enc=Object.values(w.graph).find(n=>n.class_type==='TextEncodeQwenImage21');
 assert.equal(w.garmentFidelity,true);
 assert.equal(w.graph[enc.inputs['images.image_2'][0]].inputs.megapixels,1.179648);
 assert.equal(w.graph[enc.inputs['images.image_3'][0]].inputs.megapixels,.786432);
 assert.equal(w.graph[enc.inputs['images.image_1'][0]].class_type,'ResizeAndPadImage');
 assert.ok(enc.inputs.prompt.includes('Ignore clothing visible in the portrait'));
 assert.ok(enc.inputs.prompt.includes('looking down'));
 assert.equal(Object.values(w.graph).filter(n=>n.class_type==='KSampler').length,1);
 const standard=buildQwenWorkflow({images:{pose:'p',costume:'c'},prompt:'anime'});
 assert.equal(standard.garmentFidelity,false);
});
