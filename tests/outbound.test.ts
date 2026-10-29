import assert from 'node:assert/strict';
import test from 'node:test';
import {EventEmitter} from 'node:events';
import {PassThrough} from 'node:stream';
import type https from 'node:https';
import type {lookup} from 'node:dns/promises';
import {isPublicAddress,validateTarget,requestPublic} from '../server/outbound.ts';

const origin = 'https://service.example';
const resolve = (async () => [{address:'93.184.216.34',family:4}]) as unknown as typeof lookup;
function transport(status: number, chunks: string[], stalled = false) {
  let called = 0;
  let destroyed = false;
  const request = ((_url: unknown, options: any, callback: (response:any) => void) => {
    called++;
    options.lookup('service.example',{all:true},(error:unknown,addresses:unknown) => {
      assert.equal(error,null); assert.deepEqual(addresses,[{address:'93.184.216.34',family:4}]);
    });
    const req = new EventEmitter() as any;
    req.write = () => {};
    req.destroy = () => {destroyed = true;};
    req.end = () => queueMicrotask(() => {
      const response = new PassThrough() as any;
      response.statusCode = status;
      response.headers = {'content-type':'application/json','payment-required':'challenge'};
      callback(response);
      if (!response.destroyed) for (const chunk of chunks) response.write(chunk);
      if (!stalled && !response.destroyed) response.end();
    });
    return req;
  }) as unknown as typeof https.request;
  return {request,count:() => called,destroyed:() => destroyed};
}

test('only configured HTTPS origins and public DNS addresses are accepted', async () => {
  for(const raw of ['http://service.example','https://evil.example','https://user:pass@service.example'])
    assert.throws(() => validateTarget(raw,[origin]));
  for(const ip of ['127.0.0.1','10.0.0.1','169.254.169.254','100.64.0.1','::1','::ffff:127.0.0.1','2001:db8::1']) assert.equal(isPublicAddress(ip),false,ip);
  assert.equal(isPublicAddress('93.184.216.34'),true);
  const mock=transport(200,['ok']);
  await assert.rejects(requestPublic(origin,{allowedOrigins:[origin],request:mock.request,
    resolve:(async () => [{address:'127.0.0.1',family:4}]) as unknown as typeof lookup}));
  assert.equal(mock.count(),0);
});
test('allowed responses preserve payment headers and pin resolved addresses', async () => {
  const mock=transport(402,['pay']);
  const response=await requestPublic(origin,{allowedOrigins:[origin],resolve,request:mock.request});
  assert.equal(response.status,402); assert.equal(response.headers['payment-required'],'challenge');
  assert.equal(response.body.toString(),'pay');
});
test('redirects, oversized bodies, stalled reads and DNS are bounded', async () => {
  for(const mock of [transport(302,[]),transport(200,['too large']),transport(200,[],true)]) {
    await assert.rejects(requestPublic(origin,{allowedOrigins:[origin],resolve,request:mock.request,maxBytes:2,timeoutMs:10}));
    assert.equal(mock.count(),1); assert.equal(mock.destroyed(),true);
  }
  const mock=transport(200,[]);
  await assert.rejects(requestPublic(origin,{allowedOrigins:[origin],request:mock.request,timeoutMs:10,
    resolve:(async () => new Promise(() => {})) as unknown as typeof lookup}));
  assert.equal(mock.count(),0);
});
