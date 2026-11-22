import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import * as AppModule from '../src/App.tsx';
import {DirectoryProvenanceDetails} from '../src/components/directory/DirectoryProvenanceDetails.tsx';

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

test('directory details present the exact snapshot and both classes of registry error', () => {
  const commit = 'b'.repeat(40);
  const fetchedAt = '2026-11-22T02:01:02.000Z';
  const html = renderToStaticMarkup(React.createElement(DirectoryProvenanceDetails, {
    registry:{
      source:'official', commit, fetchedAt, stale:true, error:'Upstream returned HTTP 503',
      errors:[{path:'services/broken/service.yaml', error:'Invalid <field>'}],
    },
  }));
  assert.match(html, /<details/);
  assert.ok(html.includes('href="https://github.com/gokite-ai/kite-x402-services/commit/' + commit + '"'));
  assert.ok(html.toLowerCase().includes('datetime="' + fetchedAt.toLowerCase() + '"'));
  assert.match(html, /<dd>Stale<\/dd>/);
  assert.match(html, /Upstream returned HTTP 503/);
  assert.match(html, /services\/broken\/service\.yaml/);
  assert.match(html, /Invalid &lt;field&gt;/);
});

test('directory details identify demo data and cold failures without a source snapshot', () => {
  for (const source of ['demo', 'official'] as const) {
    const html = renderToStaticMarkup(React.createElement(DirectoryProvenanceDetails, {
      registry:{
        source, commit:null, fetchedAt:null, stale:source === 'official',
        error:source === 'official' ? 'Upstream unavailable' : null, errors:[],
      },
    }));
    assert.doesNotMatch(html, /<a |<time |<dd>Current<\/dd>/);
    assert.match(html, source === 'demo' ? /Bundled demo directory/ : /Upstream unavailable/);
  }
});
