import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import * as AppModule from '../src/App.tsx';

test('initial directory render announces loading without showing an empty search result', () => {
  const storage = globalThis.localStorage;
  Object.defineProperty(globalThis, 'localStorage', {configurable:true, value:{getItem:() => null}});
  try {
    const html = renderToStaticMarkup(React.createElement(AppModule.App));
    assert.match(html, /aria-busy="true"/);
    assert.match(html, /Loading service directory/);
    assert.doesNotMatch(html, /No x402 services found matching your filters/);
  } finally {
    Object.defineProperty(globalThis, 'localStorage', {configurable:true, value:storage});
  }
});

test('directory feedback distinguishes failure, empty result and stale snapshot for assistive technology', () => {
  const Feedback = (AppModule as unknown as {DirectoryFeedback?: React.ComponentType<{
    state:{kind:'failed'|'empty'|'stale';message:string};
  }>}).DirectoryFeedback;
  assert.ok(Feedback, 'App must export the directory feedback shown to users');
  const failure = renderToStaticMarkup(React.createElement(Feedback,{state:{kind:'failed',message:'HTTP 503'}}));
  assert.match(failure, /role="alert"/);
  assert.match(failure, /Directory unavailable/);
  assert.match(failure, /HTTP 503/);
  const empty = renderToStaticMarkup(React.createElement(Feedback,{state:{kind:'empty',message:'Official directory'}}));
  assert.match(empty, /role="status"/);
  assert.match(empty, /No directory entries/);
  const stale = renderToStaticMarkup(React.createElement(Feedback,{state:{kind:'stale',message:'Last fetched yesterday'}}));
  assert.match(stale, /role="status"/);
  assert.match(stale, /stale|Stale/);
  assert.match(stale, /Last fetched yesterday/);
});
