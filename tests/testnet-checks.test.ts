import assert from 'node:assert/strict';
import test from 'node:test';
import {checkRpc,checkDomain,checkFacilitator,checkOfflineSignature,checkZeroDeduction} from '../src/services/testnet-checks.ts';

const rpc = (chain='0x940',block='0x10') => (async () => Response.json([
  {jsonrpc:'2.0',id:2,result:block},{jsonrpc:'2.0',id:1,result:chain}])) as typeof fetch;
test('RPC checks use response IDs and reject missing or incorrect evidence', async () => {
  assert.equal((await checkRpc(rpc())).status,'passed');
  for (const fixture of [rpc('0x1'),rpc('0x940','invalid'),rpc('0x940','0x0'),
    (async()=>Response.json([{jsonrpc:'2.0',id:1,result:'0x940'}])) as typeof fetch,
    (async()=>{throw new Error('offline');}) as typeof fetch]) await assert.rejects(checkRpc(fixture));
});
test('domain verification rejects a contract result that differs from configuration',async () => {
  const fetcher = (async (_url, init) => {
    const request=JSON.parse(init!.body as string);
    return request[0].method === 'eth_call' ? Response.json([{jsonrpc:'2.0',id:3,result:'0x'+'00'.repeat(32)}]) : rpc()('');
  }) as typeof fetch;
  await assert.rejects(checkDomain(fetcher),/DOMAIN_SEPARATOR/);
});
test('facilitator must return a compatible supported capability',async () => {
  for(const body of [{}, {kinds:[]}, {kinds:[{x402Version:1,scheme:'exact',network:'eip155:2368'}]},
    {kinds:[{x402Version:2,scheme:'exact',network:'eip155:2366'}]}])
    await assert.rejects(checkFacilitator((async()=>Response.json(body)) as typeof fetch));
  assert.equal((await checkFacilitator((async()=>Response.json({kinds:[{x402Version:2,scheme:'exact',network:'eip155:2368'}]})) as typeof fetch)).scope,'live-readonly');
});
test('offline signing and blocked settlement checks cannot be mistaken for live payments',async () => {
  assert.equal((await checkOfflineSignature()).scope,'offline');
  assert.equal(checkZeroDeduction().status,'blocked');
  assert.equal(checkZeroDeduction().scope,'not-run');
});
