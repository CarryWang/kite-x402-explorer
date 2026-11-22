import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {ManifestBuilderView, SubmitPrButton} from '../src/components/builder/ManifestBuilderView.tsx';
import {PRSubmissionModal} from '../src/components/builder/PRSubmissionModal.tsx';
import {INITIAL_SERVICES} from '../src/services/sample-services.ts';
import {validateServiceManifest} from '../src/services/schema-validator.ts';

// A complete manifest, as the builder form always produces, with one field the schema rejects.
const invalidManifest = {...structuredClone(INITIAL_SERVICES[0]), name:'Bad Name!'};
const noop = () => {};

test('submit button is disabled and explains why while the manifest fails the schema', () => {
  const validation = validateServiceManifest(invalidManifest);
  assert.equal(validation.valid, false);
  const html = renderToStaticMarkup(React.createElement(SubmitPrButton,{validation, onSubmit:noop}));
  assert.match(html, /disabled=""/);
  assert.match(html, new RegExp(`Fix ${validation.errors.length} issue\\(s\\) to submit`));
  assert.doesNotMatch(html, /Submit PR to Kite/);
});

test('submit button is enabled for the default template, which passes the schema', () => {
  const html = renderToStaticMarkup(React.createElement(ManifestBuilderView,{onTestInPlayground:noop}));
  assert.match(html, /Schema Valid \(PR Ready\)/);
  const button = html.match(/<button[^>]*>(?:(?!<\/button>).)*Submit PR to Kite/s)?.[0];
  assert.ok(button, 'Submit PR button must render');
  assert.doesNotMatch(button, /disabled=""/);
});

test('submission modal withholds the GitHub link, CLI script and PR body for an invalid manifest', () => {
  const html = renderToStaticMarkup(React.createElement(PRSubmissionModal,{
    isOpen:true, onClose:noop, manifest:invalidManifest, yamlContent:'schema: 1',
  }));
  assert.match(html, /role="alert"/);
  assert.match(html, /Submission blocked/);
  assert.doesNotMatch(html, /github\.com\/gokite-ai\/kite-x402-services\/new/);
  assert.doesNotMatch(html, /git clone/);
  assert.doesNotMatch(html, /Manifest conforms to/);
});
