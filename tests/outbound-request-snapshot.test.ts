import assert from 'node:assert/strict';
import test from 'node:test';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { requestPublic, type OutboundOptions } from '../server/outbound.js';
const origin = 'https://public.example';
function fixture(method: 'GET' | 'POST') {
  let release!: () => void;
  const sent: { headers?: Record<string, string>; body?: string } = {};
  const options: OutboundOptions = {
    allowedOrigins: [origin], method,
    headers: { 'Content-Type': 'application/json' },
    resolve: (() => new Promise(resolve => { release = () => resolve([{ address: '8.8.8.8', family: 4 }]); })) as unknown as OutboundOptions['resolve'],
    request: ((_url: unknown, input: { headers: Record<string, string> }, callback: (response: unknown) => void) => {
      sent.headers = { ...input.headers };
      const request = new EventEmitter() as EventEmitter & { destroy: () => void; write: (body: string) => void; end: () => void };
      request.destroy = () => {}; request.write = body => { sent.body = body; };
      request.end = () => queueMicrotask(() => {
        const response = Object.assign(new PassThrough(), { statusCode: 200, headers: { 'content-type': 'application/json' } });
        callback(response); response.end('ok');
      });
      return request;
    }) as unknown as OutboundOptions['request'],
  };
  return { options, sent, release: () => release() };
}

test('headers validated before DNS cannot gain a forbidden field while DNS is pending', async () => {
  const f = fixture('GET'); const pending = requestPublic(origin, f.options);
  f.options.headers!['x-forbidden'] = 'fixture';
  f.release(); await pending;
  assert.deepEqual(f.sent.headers, { 'Content-Type': 'application/json' });
});

test('POST sends the validated body even if the caller replaces it with an oversized one', async () => {
  const f = fixture('POST'); f.options.body = '{"value":1}';
  const pending = requestPublic(origin, f.options);
  f.options.body = 'x'.repeat(70000);
  f.release(); await pending;
  assert.equal(f.sent.body, '{"value":1}');
});

test('a GET cannot acquire a body after its method/body policy has been checked', async () => {
  const f = fixture('GET'); const pending = requestPublic(origin, f.options);
  f.options.body = 'late body';
  f.release(); await pending;
  assert.equal(f.sent.body, undefined);
});

test('an invalid original header is still rejected before resolving or sending', async () => {
  const f = fixture('GET'); f.options.headers!['x-forbidden'] = 'fixture';
  await assert.rejects(requestPublic(origin, f.options), /header is not permitted/);
  assert.deepEqual(f.sent, {});
});
