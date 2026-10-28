import { lookup } from 'node:dns/promises';
import https from 'node:https';
import { BlockList, isIP } from 'node:net';

const blocked = new BlockList();
for (const [ip, bits] of [['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10],
  ['127.0.0.0', 8], ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.168.0.0', 16],
  ['192.0.0.0', 24], ['192.0.2.0', 24], ['198.18.0.0', 15], ['198.51.100.0', 24],
  ['203.0.113.0', 24], ['224.0.0.0', 3]] as const) blocked.addSubnet(ip, bits, 'ipv4');
const globalV6 = new BlockList();
globalV6.addSubnet('2000::', 3, 'ipv6');
blocked.addSubnet('2001:db8::', 32, 'ipv6');

export function isPublicAddress(address: string): boolean {
  const family = isIP(address);
  return family === 4 ? !blocked.check(address, 'ipv4')
    : family === 6 && globalV6.check(address, 'ipv6') && !blocked.check(address, 'ipv6');
}

export function validateTarget(raw: string, allowedOrigins: string[]): URL {
  const url = new URL(raw);
  if (url.protocol !== 'https:' || url.username || url.password || url.hash ||
      !allowedOrigins.includes(url.origin)) throw new Error('Target is not an allowed HTTPS service');
  return url;
}

export interface OutboundResponse { status: number; headers: Record<string, string>; body: Buffer }
export interface OutboundOptions {
  allowedOrigins: string[];
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
  maxBytes?: number;
  resolve?: typeof lookup;
  request?: typeof https.request;
}

/** One deadline covers DNS, headers and body. DNS results are pinned to the socket. */
export async function requestPublic(raw: string, options: OutboundOptions): Promise<OutboundResponse> {
  const url = validateTarget(raw, options.allowedOrigins);
  const maxBytes = options.maxBytes ?? 1024 * 1024;
  return new Promise((resolve, reject) => {
    let request: ReturnType<typeof https.request> | undefined;
    let finished = false;
    const fail = (error: Error) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      request?.destroy();
      reject(error);
    };
    const timer = setTimeout(() => fail(new Error('Outbound request timed out')), options.timeoutMs ?? 3000);
    const resolver = options.resolve ?? lookup;
    void resolver(url.hostname, {all: true}).then((addresses) => {
      if (finished) return;
      if (!addresses.length || addresses.some(({address}) => !isPublicAddress(address))) {
        fail(new Error('Target must resolve only to public addresses')); return;
      }
      request = (options.request ?? https.request)(url, {
        method: options.method ?? 'GET', headers: options.headers ?? {Accept: 'application/json'},
        lookup: (_host, settings, callback) => {
          if (settings.all) callback(null, addresses);
          else callback(null, addresses[0].address, addresses[0].family);
        },
      }, (response) => {
        const status = response.statusCode ?? 502;
        if (status >= 300 && status < 400) {
          response.destroy(); fail(new Error('Upstream redirects are not permitted')); return;
        }
        const chunks: Buffer[] = [];
        let size = 0;
        response.on('data', (chunk: Buffer) => {
          if (finished) return;
          size += chunk.length;
          if (size > maxBytes) { response.destroy(); fail(new Error('Upstream response too large')); }
          else chunks.push(Buffer.from(chunk));
        });
        response.on('error', fail);
        response.on('aborted', () => fail(new Error('Upstream response incomplete')));
        response.on('end', () => {
          if (finished) return;
          finished = true;
          clearTimeout(timer);
          const headers: Record<string,string> = {};
          for (const name of ['content-type', 'payment-required', 'payment-response']) {
            const value = response.headers[name];
            if (typeof value === 'string') headers[name] = value;
          }
          resolve({status, headers, body: Buffer.concat(chunks)});
        });
      });
      request.on('error', fail);
      if (options.body) request.write(options.body);
      request.end();
    }).catch(fail);
  });
}
