// Uygulama verisi: meta (bir kez), işler ve ekranlar arası paylaşılan filtre durumu.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api } from '../api/client';
import type { Alan, Meta, Task } from '../api/types';
import { EMPTY_FILTERS, type Filters } from '../lib/filtering';
import { genericKonuSet, statusRoles, type StatusRoles } from '../lib/rules';

export type LoadStatus = 'loading' | 'error' | 'ready';

interface AppDataValue {
  status: LoadStatus;
  meta: Meta | null;
  tasks: Task[];
  roles: StatusRoles;
  generic: Set<string>;
  fields: Map<string, Alan>;
  reload: () => Promise<void>;
  reloadMeta: () => Promise<void>;
  upsertTask: (t: Task) => void;
  removeTask: (id: number) => void;
  filters: Filters;
  setFilters: (f: Filters | ((prev: Filters) => Filters)) => void;
}

const AppDataContext = createContext<AppDataValue | null>(null);

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [meta, setMeta] = useState<Meta | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);

  const reload = useCallback(async () => {
    setStatus('loading');
    try {
      const [m, t] = await Promise.all([api.meta(), api.tasks()]);
      setMeta(m);
      setTasks(t);
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, []);

  const reloadMeta = useCallback(async () => {
    try {
      setMeta(await api.meta());
    } catch {
      /* bildirim client'ta gösterildi */
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const upsertTask = useCallback((t: Task) => {
    setTasks((prev) => {
      const i = prev.findIndex((x) => x.id === t.id);
      if (i === -1) return [...prev, { yorum_sayisi: 0, ...t }];
      const next = [...prev];
      next[i] = { ...prev[i], ...t };
      return next;
    });
  }, []);

  const removeTask = useCallback((id: number) => setTasks((prev) => prev.filter((t) => t.id !== id)), []);

  const value = useMemo<AppDataValue>(
    () => ({
      status,
      meta,
      tasks,
      roles: statusRoles(meta),
      generic: genericKonuSet(tasks),
      fields: new Map((meta?.alanlar ?? []).map((a) => [a.anahtar, a])),
      reload,
      reloadMeta,
      upsertTask,
      removeTask,
      filters,
      setFilters,
    }),
    [status, meta, tasks, reload, reloadMeta, upsertTask, removeTask, filters],
  );

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData(): AppDataValue {
  const v = useContext(AppDataContext);
  if (!v) throw new Error('AppDataProvider eksik');
  return v;
}

/** Meta yüklendiğinde kullanılan, meta'nın kesin olduğu görünüm. */
export function useMeta(): Meta {
  const { meta } = useAppData();
  if (!meta) throw new Error('meta henüz yüklenmedi');
  return meta;
}
