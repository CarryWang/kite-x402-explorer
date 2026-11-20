import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CodeSnippetGenerator } from '../src/components/common/CodeSnippetGenerator.js';
import type { ServiceManifest, ServiceEndpoint } from '../src/types/service.js';

const service: ServiceManifest = {
  schema: 1, name: 'curl-test', display_name: 'cURL test', description: 'Fixture',
  maintainer: { github: 'fixture', contact: 'fixture@example.com' },
  status: 'testnet', base_url: 'https://example.com', network: 'eip155:2368',
  pay_to: '0x1111111111111111111111111111111111111111',
  upstream: { name: 'fixture', url: 'https://example.com' }, categories: ['other'],
  endpoints: [],
};

function renderSnippet(endpoint: ServiceEndpoint, baseUrl = service.base_url): string {
  const html = renderToStaticMarkup(React.createElement(CodeSnippetGenerator, {
    service: { ...service, base_url: baseUrl }, endpoint,
  }));
  const code = html.match(/<pre[^>]*>([\s\S]*?)<\/pre>/)?.[1];
  assert.ok(code, 'the cURL tab renders a code block');
  const entities: Record<string, string> = {
    '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#x27;': "'",
  };
  return code.replace(/&(?:amp|lt|gt|quot|#x27);/g, value => entities[value]);
}

const configuredShell = process.env.POSIX_SHELL;
const shell = configuredShell || (process.platform === 'win32' ? undefined : '/bin/sh');

for (const fixture of [
  { name: 'plain GET', method: 'GET', path: '/v1/search' },
  { name: 'query parameters', method: 'GET', path: '/v1/search', query: { q: "O'Reilly & Kite 中文" } },
  { name: 'JSON apostrophes', method: 'POST', path: '/v1/search', body: { name: "O'Reilly" } },
  { name: 'shell metacharacters', method: 'POST',
    path: '/v1/$HOME/$(printf UNEXPECTED)`printf UNEXPECTED`/"quote"/O\'Reilly',
    body: { text: '"quoted"\n$HOME $(printf UNEXPECTED) `printf UNEXPECTED` 中文' } },
  { name: 'false JSON body', method: 'POST', path: '/v1/search', body: false },
  { name: 'zero JSON body', method: 'PUT', path: '/v1/search', body: 0 },
  { name: 'null JSON body', method: 'PATCH', path: '/v1/search', body: null },
  { name: 'GET ignores body', method: 'GET', path: '/v1/search', body: { unused: true } },
] as const) {
  test(`cURL preserves arguments for ${fixture.name}`, {
    skip: !shell || !existsSync(shell) ? 'Set POSIX_SHELL to a POSIX shell on Windows' : false,
  }, () => {
    const endpoint: ServiceEndpoint = {
      method: fixture.method, path: fixture.path, summary: 'Fixture', price_usd: '0.001',
      example_request: {
        ...('query' in fixture ? { query: fixture.query } : {}),
        ...('body' in fixture ? { body: fixture.body } : {}),
      },
    };
    const snippet = renderSnippet(endpoint);
    const result = spawnSync(shell!, ['-c',
      'curl() { printf "%s\\0" "$@"; printf "\\0"; }\n' + snippet,
    ], { encoding: 'utf8', timeout: 5000, env: { ...process.env, HOME: 'EXPANDED_HOME' } });
    assert.ifError(result.error);
    assert.equal(result.status, 0, result.stderr);
    const url = service.base_url + fixture.path + ('query' in fixture
      ? '?' + new URLSearchParams(fixture.query).toString() : '');
    const first = ['--globoff', '-i', '-X', fixture.method, url, '-H', 'Accept: application/json'];
    const second = [...first, '-H', 'PAYMENT-SIGNATURE: <base64-encoded-eip3009-authorization>'];
    if (fixture.method !== 'GET' && 'body' in fixture) {
      const body = ['-H', 'Content-Type: application/json', '-d', JSON.stringify(fixture.body)];
      first.push(...body);
      second.push(...body);
    }
    assert.equal(result.stdout, first.join('\0') + '\0\0' + second.join('\0') + '\0\0');
  });
}

test('cURL tab identifies its shell syntax', () => {
  const html = renderToStaticMarkup(React.createElement(CodeSnippetGenerator, {
    service, endpoint: { method: 'GET', path: '/v1/search', summary: 'Fixture', price_usd: '0.001' },
  }));
  assert.match(html, /Bash \/ POSIX shell/);
});
