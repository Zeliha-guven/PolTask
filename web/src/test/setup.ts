// Test belirlenimi (docs/testing.md, Determinism): TZ Europe/Istanbul (vite.config), tr yerel ayar,
// sabit saat (yalnız Date sahte), Mantine geçişleri kapalı (reduced motion), her testten sonra temizlik.
import '@testing-library/jest-dom/vitest';
import { notifications } from '@mantine/notifications';
import { act, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';

export const FIXED_NOW = new Date(2026, 9, 28, 10, 0, 0); // 28.10.2026 Çarşamba, yerel saat

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: query.includes('prefers-reduced-motion'),
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
window.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
window.HTMLElement.prototype.scrollIntoView = () => {};
// jsdom'da document.fonts yok (Mantine Textarea autosize kullanır)
Object.defineProperty(document, 'fonts', {
  configurable: true,
  value: { addEventListener: () => {}, removeEventListener: () => {}, ready: Promise.resolve() },
});

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(FIXED_NOW);
  window.localStorage.clear();
  window.history.replaceState(null, '', '/');
});

afterEach(() => {
  // Bildirim deposu modül düzeyinde: testler arası sızmasın
  act(() => {
    notifications.clean();
    notifications.cleanQueue();
  });
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
