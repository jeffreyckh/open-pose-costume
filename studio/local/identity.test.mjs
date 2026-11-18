import {readFile,mkdir}from'node:fs/promises';import{refineIdentity}from'./identity.mjs';import assert from'node:assert/strict';
const dir=new URL('../output/identity-integration-test/',import.meta.url);await mkdir(dir,{recursive:true});
const result=await refineIdentity(await readFile(new URL('../public/images/hero/character.webp',import.meta.url)),await readFile(new URL('../output/local-jobs/c9198207-7cbc-4a86-aab0-e36d0596ca10/result.png',import.meta.url)),dir.pathname.replace(/^\/(?=[A-Za-z]:)/,'') );
assert.equal(result.audit.pixels_changed_outside_face_box,0);assert.ok(result.audit.recognition_cosine_after>result.audit.recognition_cosine_before+.03);console.log('Identity module integration passed; diagnostic improvement is not independent likeness proof.');
