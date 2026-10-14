// @vitest-environment jsdom
import { expect, it, vi } from 'vitest';

it('keeps browser storage after temporary global mocks are restored', () => {
  const browser = (globalThis as typeof globalThis & { jsdom: { window: Window } }).jsdom;
  expect(localStorage).toBe(browser.window.localStorage);
  vi.stubGlobal('fetch', vi.fn());
  vi.unstubAllGlobals();
  expect(localStorage).toBe(browser.window.localStorage);
  localStorage.setItem('storage-regression', 'ok');
  expect(localStorage.getItem('storage-regression')).toBe('ok');
  localStorage.removeItem('storage-regression');
});
