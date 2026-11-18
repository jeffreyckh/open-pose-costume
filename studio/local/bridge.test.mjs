import {readFile}from'node:fs/promises';import assert from'node:assert/strict';
const foreign=await fetch('http://127.0.0.1:8192/health',{headers:{Origin:'https://example.com'}});assert.equal(foreign.status,403);
const empty=await fetch('http://127.0.0.1:8192/v1/images/edits',{method:'POST',body:new FormData()});assert.equal(empty.status,400);
const source=await readFile(new URL('../src/generation.ts',import.meta.url),'utf8');assert.ok(source.includes("url.origin !== 'http://127.0.0.1:8192'"));assert.ok(!source.includes('atomflow.vip'));assert.ok(source.includes('`${reference.kind}-'));
console.log('Local-only endpoint, upload roles, invalid-input and foreign-origin checks passed. No GPU job submitted.');
