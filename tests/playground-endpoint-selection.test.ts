import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PlaygroundView } from '../src/components/playground/PlaygroundView.tsx';
import { INITIAL_SERVICES } from '../src/services/sample-services.js';

test('Playground distinguishes HTTP methods that share an endpoint path', (t) => {
  const storage = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage');
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: { getItem: () => null, setItem: () => {} } });
  t.after(() => {
    if (storage) Object.defineProperty(globalThis, 'sessionStorage', storage);
    else Reflect.deleteProperty(globalThis, 'sessionStorage');
  });
  const sample = INITIAL_SERVICES[0];
  const get = { ...sample.endpoints[0], method: 'GET' as const, path: '/v1/jobs' };
  const post = { ...get, method: 'POST' as const };
  const service = { ...sample, endpoints: [get, post] };
  const markup = renderToStaticMarkup(React.createElement(PlaygroundView, {
    services: [service],
    selectedService: service,
    selectedEndpoint: post,
    onSelectService: () => {},
  }));

  const choices = [...markup.matchAll(/<option value="([^"]+)"([^>]*)>(GET|POST) \/v1\/jobs/g)];
  assert.equal(choices.length, 2);
  assert.notEqual(choices[0][1], choices[1][1]);
  assert.doesNotMatch(choices[0][2], / selected/);
  assert.match(choices[1][2], / selected/);
});
