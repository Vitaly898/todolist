// Vitest's global window can retain Node's localStorage getter on Node 26.
const browser = (globalThis as typeof globalThis & {
  jsdom?: { window: Window };
}).jsdom;
if (browser) {
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    enumerable: true,
    writable: true,
    value: browser.window.localStorage,
  });
}
