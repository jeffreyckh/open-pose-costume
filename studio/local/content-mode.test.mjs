import test from 'node:test';
import assert from 'node:assert/strict';
import {buildQwenWorkflow} from './workflow-qwen.mjs';
import {buildWorkflow} from './workflow.mjs';
for(const [name,build] of [['Qwen',buildQwenWorkflow],['FLUX',buildWorkflow]]) {
 test(`${name} art mode excludes identity and wardrobe from the actual graph`,()=>{
  const w=build({images:{pose:'mannequin.png',character:'private-face.png',costume:'private-outfit.png',depth:'d.png'},prompt:'[ADULT_ART_STUDY] charcoal life study'});
  const loads=Object.values(w.graph).filter(n=>n.class_type==='LoadImage');
  assert.deepEqual(loads.map(n=>n.inputs.image),['mannequin.png']);
  assert.equal(w.contentMode,'art');
  assert.ok(w.instruction.includes('fictional clearly mature adult'));
  assert.ok(!w.instruction.includes('wearing the complete outfit'));
  assert.doesNotThrow(()=>build({images:{pose:'p'},prompt:'[ADULT_ART_STUDY]'}));
 });
 test(`${name} adult fashion modes keep garment and identity references separate`,()=>{
  for(const [marker,mode]of [['ADULT_SWIMWEAR','swimwear'],['ADULT_LINGERIE_FASHION','lingerie']]){
   const w=build({images:{pose:'p',costume:'c',character:'f'},prompt:`[${marker}]`});
   assert.equal(w.contentMode,mode);
   assert.equal(Object.values(w.graph).filter(n=>n.class_type==='LoadImage').length,3);
   assert.ok(w.instruction.includes('age25 or older'));
   assert.throws(()=>build({images:{pose:'p'},prompt:`[${marker}]`}),/garment|outfit/);
  }
 });
}
