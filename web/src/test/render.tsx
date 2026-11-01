// Test yardımcıları: API'yi fetch düzeyinde stub'lar (web/src/api gerçek haliyle çalışır), uygulamayı bir rotada açar.
import { render } from '@testing-library/react';
import { vi } from 'vitest';
import { App } from '../App';
import { Providers } from '../Providers';
import { META, SNAPSHOTS, TASKS } from './fixtures';

export type Reply = { status: number; body?: unknown } | 'pending';
export type Handler = Reply | ((body: unknown) => Reply);
export interface Call {
  method: string;
  url: string;
  body: unknown;
}

export const ok = (body: unknown): Reply => ({ status: 200, body });
export const fail = (status: number, error: string): Reply => ({ status, body: { error } });

export function defaultRoutes(): Record<string, Handler> {
  return {
    'GET /api/meta': ok(META),
    'GET /api/tasks': ok(TASKS),
    'GET /api/snapshots': ok(SNAPSHOTS),
    'POST /api/snapshots/haftalik': ok({ alindi: false }),
  };
}

export function stubApi(routes: Record<string, Handler>) {
  const calls: Call[] = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method ?? 'GET').toUpperCase();
    let body: unknown = init?.body;
    if (typeof body === 'string') body = JSON.parse(body) as unknown;
    calls.push({ method, url, body });
    const key = `${method} ${url}`;
    const pattern = Object.keys(routes).find((k) => k === key || (k.endsWith('*') && key.startsWith(k.slice(0, -1))));
    const h = pattern ? routes[pattern] : undefined;
    const reply: Reply = h === undefined ? fail(404, `Stub yok: ${key}`) : typeof h === 'function' ? h(body) : h;
    if (reply === 'pending') return new Promise<Response>(() => {});
    if (reply.status === 204) return new Response(null, { status: 204 });
    return new Response(JSON.stringify(reply.body ?? null), {
      status: reply.status,
      headers: { 'Content-Type': 'application/json' },
    });
  });
  vi.stubGlobal('fetch', fetchMock);
  return calls;
}

export function renderApp(hash = '#/ozet', routes: Record<string, Handler> = {}) {
  window.history.replaceState(null, '', `/${hash}`);
  const calls = stubApi({ ...defaultRoutes(), ...routes });
  const utils = render(
    <Providers>
      <App />
    </Providers>,
  );
  return { ...utils, calls };
}
