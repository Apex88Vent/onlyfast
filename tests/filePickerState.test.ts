import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  isOnlyFastFilePickerOpen,
  setOnlyFastFilePickerActive,
} from '../src/lib/filePickerState.ts';

const installBrowserState = () => {
  const values = new Map<string, string>();
  const fakeStorage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  };
  Object.defineProperty(globalThis, 'window', { value: {}, configurable: true });
  Object.defineProperty(globalThis, 'localStorage', { value: fakeStorage, configurable: true });
  return values;
};

test('file picker state survives a WebView pause and clears after selection or cancellation', () => {
  installBrowserState();
  setOnlyFastFilePickerActive(true);
  assert.equal(isOnlyFastFilePickerOpen(), true);
  setOnlyFastFilePickerActive(false);
  assert.equal(isOnlyFastFilePickerOpen(), false);
});

test('stale picker state cannot permanently suppress normal navigation', () => {
  const values = installBrowserState();
  values.set('onlyfast_file_picker_active', 'true');
  values.set('onlyfast_file_picker_started_at', String(Date.now() - 3 * 60 * 1000));
  assert.equal(isOnlyFastFilePickerOpen(), false);
  assert.equal(values.has('onlyfast_file_picker_active'), false);
});

test('native back and history events are ignored only while the picker is active', () => {
  const source = readFileSync(
    new URL('../src/components/SafeBackHandler.tsx', import.meta.url),
    'utf8',
  );
  assert.match(source, /handlePopState[\s\S]*if \(isOnlyFastFilePickerOpen\(\)\)/);
  assert.match(source, /handleNativeBack[\s\S]*if \(isOnlyFastFilePickerOpen\(\)\) return/);
});
