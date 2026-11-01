// Sunucuyla konuşan TEK katman (docs/architecture.md, AC-3): fetch yalnız burada çağrılır.
import type {
  ExcelImportResult,
  Meta,
  OpmImportResult,
  Snapshot,
  Task,
  TaskInput,
  TimelineItem,
} from './types';

export class ApiError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

type ErrorHandler = (message: string) => void;
let onError: ErrorHandler = () => {};

/** Hataların tek bildirim noktasına iletilmesi (uygulama başlangıcında bağlanır). */
export function setApiErrorHandler(handler: ErrorHandler): void {
  onError = handler;
}

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  const init: RequestInit = { method, headers: {} };
  if (body instanceof FormData) {
    init.body = body;
  } else if (body !== undefined) {
    init.body = JSON.stringify(body);
    init.headers = { 'Content-Type': 'application/json' };
  }
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch {
    const msg = 'Sunucuya ulaşılamadı';
    onError(msg);
    throw new ApiError(msg, 0);
  }
  if (!res.ok) {
    let msg = res.statusText || `Hata ${res.status}`;
    try {
      const data = (await res.json()) as { error?: string };
      if (data && typeof data.error === 'string') msg = data.error;
    } catch {
      /* gövde JSON değil */
    }
    onError(msg);
    throw new ApiError(msg, res.status);
  }
  if (res.status === 204) return null as T;
  const type = res.headers.get('content-type') ?? '';
  if (!type.includes('json')) return null as T;
  return (await res.json()) as T;
}

export const api = {
  meta: () => request<Meta>('GET', '/api/meta'),
  tasks: () => request<Task[]>('GET', '/api/tasks'),
  createTask: (data: TaskInput) => request<Task>('POST', '/api/tasks', data),
  patchTask: (id: number, data: TaskInput) => request<Task>('PATCH', `/api/tasks/${id}`, data),
  deleteTask: (id: number) => request<null>('DELETE', `/api/tasks/${id}`),
  timeline: (id: number) => request<TimelineItem[]>('GET', `/api/tasks/${id}/timeline`),
  addComment: (id: number, metin: string) => request<null>('POST', `/api/tasks/${id}/comments`, { metin }),
  deleteComment: (cid: number) => request<null>('DELETE', `/api/comments/${cid}`),
  snapshots: () => request<Snapshot[]>('GET', '/api/snapshots'),
  weeklySnapshot: () => request<unknown>('POST', '/api/snapshots/haftalik'),
  createSnapshot: (etiket: string) => request<{ id: number }>('POST', '/api/snapshots', { etiket }),
  deleteSnapshot: (id: number) => request<null>('DELETE', `/api/snapshots/${id}`),
  importExcel: (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return request<ExcelImportResult>('POST', '/api/import/excel', fd);
  },
  importOpm: (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return request<OpmImportResult>('POST', '/api/import/opm', fd);
  },
  exportUrl: '/api/export',
};
