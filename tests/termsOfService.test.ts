import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
const require = createRequire(import.meta.url);
function load(file: string): { default: React.ComponentType<Record<string, unknown>> } {
  const source = readFileSync(new URL('../src/' + file, import.meta.url), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
  const mod = { exports: {} };
  new Function('require', 'exports', js)((name: string) => {
    if (name === 'react') return { ...React, useEffect: () => {} };
    if (name === 'react-router-dom') return { Link: ({ to, children, ...props }: { to: string; children: React.ReactNode }) => React.createElement('a', { ...props, href: to }, children) };
    if (name.endsWith('TermsOfServiceContent')) return load('components/TermsOfServiceContent.tsx');
    if (name.includes('supabase') || name.includes('Auth')) throw Error('Terms must not require authentication.');
    return require(name);
  }, mod.exports);
  return mod.exports as ReturnType<typeof load>;
}
test('shared Terms markup is identical to the original agreement in a80cd0bd', () => {
  const content = renderToStaticMarkup(React.createElement(load('components/TermsOfServiceContent.tsx').default));
  assert.equal(createHash('sha256').update(content).digest('hex'), '50cb46fd69524c249133edc3f2799526012ec3066837ea7374248ea9b614b59d');
  const page = renderToStaticMarkup(React.createElement(load('pages/TermsOfService.tsx').default));
  const modal = renderToStaticMarkup(React.createElement(load('components/LegalModal.tsx').default, { isOpen: true, type: 'terms', onClose: () => {} }));
  assert.ok(page.includes(content)); assert.ok(modal.includes(content));
  assert.match(page, /<h1[^>]*>Terms of Service<\/h1>/);
  assert.match(modal, /role="dialog"/); assert.match(modal, /Close dialog/);
});
test('Terms is an ordinary public app route, with no beta/auth wrapper', () => {
  const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
  assert.match(app, /<Route path="\/terms-of-service" element=\{<TermsOfService \/>\} \/>/);
});
