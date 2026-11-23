import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {PRSubmissionModal} from '../src/components/builder/PRSubmissionModal.tsx';
import {INITIAL_SERVICES} from '../src/services/sample-services.ts';

const manifest = INITIAL_SERVICES[0];
const noop = () => {};

function renderCliScript(): string {
  const html = renderToStaticMarkup(React.createElement(PRSubmissionModal,{
    isOpen:true, onClose:noop, manifest, yamlContent:'schema: 1',
  }));
  const script = html.match(/<pre[^>]*>((?:(?!<\/pre>).)*gh repo fork(?:(?!<\/pre>).)*)<\/pre>/s)?.[1];
  assert.ok(script, 'CLI script must render');
  return script;
}

test('CLI script forks the registry instead of pushing to the official repository', () => {
  const script = renderCliScript();
  assert.match(script, /gh repo fork gokite-ai\/kite-x402-services --clone/);
  assert.doesNotMatch(script, /git clone https:\/\/github\.com\/gokite-ai\/kite-x402-services\.git/);
});

test('CLI script branches from upstream main, pushes to the fork, then opens the PR upstream', () => {
  const script = renderCliScript();
  const branch = `add-service-${manifest.name}`;
  const steps = [
    'gh repo fork gokite-ai/kite-x402-services --clone',
    'git fetch upstream',
    `git checkout -b ${branch} upstream/main`,
    `git push -u origin ${branch}`,
    'gh pr create --repo gokite-ai/kite-x402-services --base main',
  ];
  const positions = steps.map((step) => script.indexOf(step));
  for (const [i, position] of positions.entries()) {
    assert.notEqual(position, -1, `missing step: ${steps[i]}`);
  }
  assert.deepEqual([...positions].sort((a, b) => a - b), positions, 'steps must appear in order');
});
