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
  let head = sha;
  let displayName = INITIAL_SERVICES[0].display_name;
  const fetcher=(async(url:unknown)=>{
    calls++;
    if(fail) return new Response('offline',{status:503});
    if (String(url).endsWith('/git/ref/heads/main')) {
      return Response.json({ref:'refs/heads/main', object:{type:'commit', sha:head}});
    }
    if (String(url).endsWith('/commits/main')) {
      return Response.json({sha, files:[{patch:'x'.repeat(65_536)}]});
    }
    if (String(url).includes('/git/trees/')) {
      assert.ok(String(url).endsWith('/git/trees/' + head + '?recursive=1'));
      return Response.json({truncated:false,tree:empty?[]:[
        {type:'blob',path:'services/open-meteo-weather/README.md'},
        {type:'blob',path:'services/open-meteo-weather/service.yaml'},
        {type:'blob',path:'services/broken/service.yaml'}]});
    }
    assert.ok(String(url).includes('/'+head+'/'));
    if(String(url).includes('/broken/')) return new Response('name: broken');
    return new Response(invalid?'schema: broken':JSON.stringify({...INITIAL_SERVICES[0], display_name:displayName}));
  }) as typeof fetch;
  return {
    fetcher,
    calls: () => calls,
    fail: () => { fail = true; },
    recover: (commit: string, name: string) => {
      fail = false;
      head = commit;
      displayName = name;
    },
    invalid: () => { invalid = true; },
    empty: () => { empty = true; },
  };
}
test('official snapshots pin sources, validate manifests and coalesce concurrent requests',async()=>{
  const f=fixture();const registry=new OfficialRegistry({fetcher:f.fetcher});
  const [a,b]=await Promise.all([registry.get(),registry.get()]);
  assert.deepEqual(a,b);assert.equal(f.calls(),4);
  assert.equal(a.services.length,1);assert.equal(a.registry.commit,sha);
  assert.equal(a.registry.errors.length,1);assert.match(a.registry.sources[0].url,new RegExp('/'+sha+'/'));
  await registry.get();assert.equal(f.calls(),4);
});
test('refresh keeps the last good snapshot during backoff and replaces it when the source recovers', async () => {
  let clock = 1_000_000;
  const f = fixture();
  const registry = new OfficialRegistry({fetcher:f.fetcher, now:() => clock, ttlMs:1000});
  const first = await registry.get();

  f.fail();
  clock += 999;
  assert.deepEqual(await registry.get(), first);
  assert.equal(f.calls(), 4);

  clock += 1;
  const stale = await registry.get();
  assert.deepEqual(stale.services, first.services);
  assert.deepEqual(stale.registry, {
    ...first.registry, stale:true, error:'Official registry returned HTTP 503',
  });
  assert.equal(f.calls(), 5);

  const recoveredCommit = 'b'.repeat(40);
  f.recover(recoveredCommit, 'Updated weather service');
  clock += 29_999;
  assert.deepEqual(await registry.get(), stale);
  assert.equal(f.calls(), 5);

  clock += 1;
  const recovered = await registry.get();
  assert.equal(recovered.registry.commit, recoveredCommit);
  assert.equal(recovered.registry.fetchedAt, new Date(clock).toISOString());
  assert.equal(recovered.registry.stale, false);
  assert.equal(recovered.registry.error, undefined);
  assert.equal(recovered.services[0].display_name, 'Updated weather service');
  assert.deepEqual(recovered.registry.sources, [{
    name:'open-meteo-weather',
    url:`https://raw.githubusercontent.com/gokite-ai/kite-x402-services/${recoveredCommit}/services/open-meteo-weather/service.yaml`,
  }]);
  assert.equal(f.calls(), 9);
});

test('a pinned directory recovers from a failed first fetch without resolving main', async () => {
  let clock = 1_000_000;
  const f = fixture();
  f.fail();
  const registry = new OfficialRegistry({fetcher:f.fetcher, now:() => clock, commit:sha});
  const unavailable = await registry.get();
  assert.deepEqual(unavailable.services, []);
  assert.equal(unavailable.registry.commit, null);
  assert.equal(unavailable.registry.stale, true);

  f.recover(sha, 'Pinned weather service');
  clock += 30_000;
  const recovered = await registry.get();
  assert.equal(recovered.registry.commit, sha);
  assert.equal(recovered.registry.stale, false);
  assert.equal(recovered.registry.error, undefined);
  assert.equal(recovered.services[0].display_name, 'Pinned weather service');
  assert.equal(f.calls(), 4, 'one failed tree request, then a tree and two manifests');
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
  assert.equal(good.registry.stale,true);
  const fresh=await loadDirectory((async()=>Response.json({services:[],registry:{source:'official',commit:sha,fetchedAt:'2026-10-28',stale:false}})) as typeof fetch);
  assert.equal(fresh.registry.stale,false);
  await assert.rejects(loadDirectory((async()=>Response.json({services:[]})) as typeof fetch));
  await assert.rejects(loadDirectory((async()=>new Response('',{status:503})) as typeof fetch));
});

test('directory client preserves snapshot metadata and errors for the details panel', async () => {
  const fetchedAt = '2026-11-22T02:01:02.000Z';
  const registry = {
    source: 'official',
    commit: sha,
    fetchedAt,
    stale: true,
    error: 'Upstream returned HTTP 503',
    errors: [{path:'services/broken/service.yaml', error:'Invalid manifest'}],
  };
  const result = await loadDirectory(async () => Response.json({services:[], registry}));
  assert.deepEqual(result.registry, registry);

  const unavailable = {...registry, commit:null, fetchedAt:null, errors:[]};
  await assert.rejects(
    loadDirectory(async () => Response.json({services:[], registry:unavailable}, {status:503})),
    {registry:unavailable},
  );
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

const manifestPath = 'services/open-meteo-weather/service.yaml';
const manifestFile = {type:'blob', path:manifestPath, mode:'100644'};

for (const {label, tree, error} of [
  {
    label:'duplicate service names',
    tree:[manifestFile, {...manifestFile}],
    error:/Duplicate official registry service/,
  },
  {
    label:'a manifest at the wrong directory depth',
    tree:[{...manifestFile, path:'services/open-meteo-weather/nested/service.yaml'}],
    error:/Invalid official registry manifest path/,
  },
  {
    label:'a manifest with a noncanonical service name',
    tree:[{...manifestFile, path:'services/Open-Meteo-Weather/service.yaml'}],
    error:/Invalid official registry manifest path/,
  },
  {
    label:'a manifest entry that is not a regular file',
    tree:[{...manifestFile, mode:'120000'}],
    error:/Invalid official registry manifest file/,
  },
  {
    label:'a tree with more than 10,000 entries',
    tree:Array.from({length:10_001}, (_, i) => ({type:'blob', path:`docs/${i}.md`})),
    error:/10,000-entry limit/,
  },
]) {
  test(`official registry rejects ${label} before fetching manifests`, async () => {
    const urls: string[] = [];
    const fetcher: typeof fetch = async (url) => {
      urls.push(String(url));
      if (urls.length === 1) return Response.json({truncated:false, tree});
      return Response.json(INITIAL_SERVICES[0]);
    };
    const result = await new OfficialRegistry({commit:sha, fetcher}).get();
    assert.match(result.registry.error ?? '', error);
    assert.equal(result.registry.commit, null);
    assert.equal(result.registry.stale, true);
    assert.deepEqual(result.services, []);
    assert.equal(urls.length, 1);
  });
}
