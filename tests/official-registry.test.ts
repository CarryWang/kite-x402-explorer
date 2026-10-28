import assert from 'node:assert/strict';
import test from 'node:test';
import {OfficialRegistry} from '../server/official-registry.ts';
import {INITIAL_SERVICES} from '../src/services/sample-services.ts';
import {loadDirectory} from '../src/services/directory-client.ts';
const sha='a'.repeat(40);
function fixture() {
  let fail=false;
  let calls=0;
  let invalid=false;
  let empty=false;
  const fetcher=(async(url:unknown)=>{
    calls++;
    if(fail) return new Response('offline',{status:503});
    if(String(url).includes('/commits/')) return Response.json({sha});
    if(String(url).includes('/git/trees/')) return Response.json({truncated:false,tree:empty?[]:[
      {type:'blob',path:'services/open-meteo-weather/service.yaml'},
      {type:'blob',path:'services/broken/service.yaml'}]});
    assert.ok(String(url).includes('/'+sha+'/'));
    if(String(url).includes('/broken/')) return new Response('name: broken');
    return new Response(invalid?'schema: broken':JSON.stringify(INITIAL_SERVICES[0]));
  }) as typeof fetch;
  return {fetcher,calls:()=>calls,fail:()=>{fail=true;},invalid:()=>{invalid=true;},empty:()=>{empty=true;}};
}
test('official snapshots pin sources, validate manifests and coalesce concurrent requests',async()=>{
  const f=fixture();const registry=new OfficialRegistry({fetcher:f.fetcher});
  const [a,b]=await Promise.all([registry.get(),registry.get()]);
  assert.deepEqual(a,b);assert.equal(f.calls(),4);
  assert.equal(a.services.length,1);assert.equal(a.registry.commit,sha);
  assert.equal(a.registry.errors.length,1);assert.match(a.registry.sources[0].url,new RegExp('/'+sha+'/'));
  await registry.get();assert.equal(f.calls(),4);
});
test('failed refresh retains the last good snapshot and backs off',async()=>{
  let clock=1_000_000;const f=fixture();const registry=new OfficialRegistry({fetcher:f.fetcher,now:()=>clock,ttlMs:1000});
  const first=await registry.get();f.fail();clock+=2000;
  const stale=await registry.get();assert.deepEqual(stale.services,first.services);
  assert.equal(stale.registry.fetchedAt,first.registry.fetchedAt);assert.equal(stale.registry.stale,true);
  const calls=f.calls();await registry.get();assert.equal(f.calls(),calls);
});
test('invalid first snapshot never falls back to demo and an empty official registry stays empty',async()=>{
  const bad=fixture();bad.invalid();const result=await new OfficialRegistry({fetcher:bad.fetcher}).get();
  assert.equal(result.services.length,0);assert.equal(result.registry.source,'official');assert.equal(result.registry.stale,true);
  const empty=fixture();empty.empty();assert.equal((await new OfficialRegistry({fetcher:empty.fetcher}).get()).registry.stale,false);
  assert.throws(()=>new OfficialRegistry({commit:'main'}));
});
test('client requires explicit provenance and preserves unavailable directory errors',async()=>{
  const good=await loadDirectory((async()=>Response.json({services:[],registry:{source:'official',commit:sha,fetchedAt:'2026-10-28',stale:true,error:'offline'}})) as typeof fetch);
  assert.equal(good.services.length,0);assert.match(good.note,/stale: offline/);
  await assert.rejects(loadDirectory((async()=>Response.json({services:[]})) as typeof fetch));
  await assert.rejects(loadDirectory((async()=>new Response('',{status:503})) as typeof fetch));
});

test('a manifest transport failure retains the whole previous catalog',async()=>{
  let clock=1_000_000;
  let failManifest=false;
  const f=fixture();
  const fetcher=(async(url:unknown,init?:RequestInit)=>{
    if(failManifest && String(url).includes('/open-meteo-weather/')) return new Response('offline',{status:503});
    return f.fetcher(url as string,init);
  }) as typeof fetch;
  const registry=new OfficialRegistry({fetcher,now:()=>clock,ttlMs:1000});
  const first=await registry.get();
  clock+=2000;failManifest=true;
  const stale=await registry.get();
  assert.equal(stale.registry.stale,true);
  assert.deepEqual(stale.services,first.services);
  assert.equal(stale.registry.fetchedAt,first.registry.fetchedAt);
});
