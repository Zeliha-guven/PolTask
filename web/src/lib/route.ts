// Basit hash yönlendirme: #/<ekran>?is=<id>. Ayrıca /?is=<id> derin bağlantısı da çekmeceyi açar.
import { useCallback, useEffect, useState } from 'react';

export const VIEWS = ['ozet', 'liste', 'pano', 'karsilastirma', 'aktarim'] as const;
export type View = (typeof VIEWS)[number];

export interface Route {
  view: View;
  taskId: number | 'new' | null;
}

export function parseRoute(hash: string, search: string): Route {
  const [path = '', query = ''] = hash.replace(/^#\/?/, '').split('?');
  const view = (VIEWS as readonly string[]).includes(path) ? (path as View) : 'ozet';
  const raw = new URLSearchParams(query).get('is') ?? new URLSearchParams(search).get('is');
  let taskId: Route['taskId'] = null;
  if (raw === 'yeni') taskId = 'new';
  else if (raw && /^\d+$/.test(raw)) taskId = Number(raw);
  return { view, taskId };
}

export function buildHash(view: View, taskId: Route['taskId'] = null): string {
  if (taskId === null) return `#/${view}`;
  return `#/${view}?is=${taskId === 'new' ? 'yeni' : taskId}`;
}

export function useRoute() {
  const read = () => parseRoute(window.location.hash, window.location.search);
  const [route, setRoute] = useState<Route>(read);

  useEffect(() => {
    const onChange = () => setRoute(parseRoute(window.location.hash, window.location.search));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  const go = useCallback((view: View, taskId: Route['taskId'] = null) => {
    // ?is= sorgusu yalnız ilk açılışta okunur; sonra hash kaynak olur.
    if (window.location.search) {
      window.history.replaceState(null, '', window.location.pathname + buildHash(view, taskId));
    } else {
      window.location.hash = buildHash(view, taskId);
    }
    setRoute({ view, taskId });
  }, []);

  return { route, go };
}
