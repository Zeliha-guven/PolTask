// İş kuralları (docs/domain.md). Durum adları burada SABİT DEĞİLDİR (AC-2): /api/meta'dan gelir.
// Sözleşme (plan 0002, A-1): `varsayilan_durum` yeni işin durumu; `kapali_durumlar` kapanmış durumlar,
// sırası anlamlı — [0] tamamlandı rolü (BR-2 hedefi), [1] iptal rolü.
import type { Meta, Opm, Task, TaskValue } from '../api/types';

export interface StatusRoles {
  initial: string;
  done: string;
  cancelled: string;
  closed: Set<string>;
}

export function statusRoles(meta: Pick<Meta, 'kapali_durumlar' | 'varsayilan_durum'> | null): StatusRoles {
  const kapali = meta?.kapali_durumlar ?? [];
  const done = kapali[0] ?? '';
  const cancelled = kapali[1] ?? '';
  return { initial: meta?.varsayilan_durum ?? '', done, cancelled, closed: new Set(kapali) };
}

/** OPM'nin kendi durum değerleri (bizim durumlarımız değil) → bizdeki karşılığın rolü (BR-3). */
const OPM_CLOSED: Record<string, 'done' | 'cancelled'> = {
  Kapatıldı: 'done',
  Çözüldü: 'done',
  Reddedildi: 'cancelled',
};

/** Seçim listesi olan alanlar: değerler meta'dan gelir. */
export function valueOptions(meta: Meta, key: string): string[] | null {
  if (key === 'durum') return meta.durumlar;
  if (key === 'kapsam_tipi') return meta.kapsam_tipleri;
  if (key === 'sozlesme') return meta.sozlesme_degerleri;
  return null;
}

export const EMPTY = '__bos__';

export function str(t: Task, key: string): string | null {
  const v = t[key];
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'object') return null;
  return String(v);
}

export function num(t: Task, key: string): number | null {
  const v = t[key] as TaskValue | undefined;
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Filtre/pivot için bir alanın değeri; boşlar EMPTY. */
export function dimValue(t: Task, key: string): string {
  return str(t, key) ?? EMPTY;
}

export function dimLabel(v: string): string {
  return v === EMPTY ? '(boş)' : v;
}

/** BR-1: hedef tarih = Hedef Teslim, yoksa İlk Verilen Hedef. */
export function targetDate(t: Task): string | null {
  return str(t, 'hedef_tarih') ?? str(t, 'ilk_hedef_tarih');
}

export function isClosed(t: Task, roles: StatusRoles): boolean {
  return roles.closed.has(str(t, 'durum') ?? '');
}

/** BR-1: açık bir işin hedef tarihi bugünden önceyse iş gecikmiştir. */
export function isLate(t: Task, roles: StatusRoles, todayIso: string): boolean {
  const d = targetDate(t);
  return !!d && !isClosed(t, roles) && d < todayIso;
}

/** BR-3: OPM'de kapanmış ama bizde açık işler için önerilen durum; yoksa null. */
export function opmSuggestion(t: Task, roles: StatusRoles): string | null {
  const opm = t.opm as Opm | null | undefined;
  if (!opm || !opm.durum || isClosed(t, roles)) return null;
  const role = OPM_CLOSED[opm.durum];
  if (!role) return null;
  return role === 'done' ? roles.done : roles.cancelled;
}

/** >20 işte geçen KONU değerleri alt başlıktır; asıl başlık Açıklama'nın ilk satırıdır. */
export function genericKonuSet(tasks: Task[]): Set<string> {
  const counts = new Map<string, number>();
  for (const t of tasks) {
    const k = str(t, 'konu');
    if (k) counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return new Set([...counts].filter(([, n]) => n > 20).map(([k]) => k));
}

export function taskTitle(t: Task, generic: Set<string>): string {
  const konu = str(t, 'konu') ?? '';
  const aciklama = str(t, 'aciklama');
  if (generic.has(konu) && aciklama) return aciklama.split('\n')[0] ?? konu;
  return konu;
}

export function taskSubtitle(t: Task, generic: Set<string>): string | null {
  const konu = str(t, 'konu') ?? '';
  const aciklama = str(t, 'aciklama');
  if (generic.has(konu) && aciklama) return null;
  return aciklama;
}

export const trCompare = (a: string, b: string) => a.localeCompare(b, 'tr');

/** Değerleri meta sırasına (varsa) ya da Türkçe alfabeye göre sıralar; boş en sonda. */
export function sortValues(values: Iterable<string>, order: string[] | null): string[] {
  return [...values].sort((a, b) => {
    if (a === EMPTY) return 1;
    if (b === EMPTY) return -1;
    if (order) {
      const ia = order.indexOf(a);
      const ib = order.indexOf(b);
      if (ia !== -1 || ib !== -1) return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    }
    return trCompare(a, b);
  });
}

/** Rozet rengi: rolü belli durumlar (varsayılan, tamamlandı, iptal) sabit renk; diğerleri sırayla (ad bilinmeden). */
const OPEN_COLORS = ['yellow', 'blue', 'violet', 'orange', 'cyan', 'grape'];
export function statusColor(
  meta: Pick<Meta, 'durumlar' | 'kapali_durumlar' | 'varsayilan_durum'> | null,
  durum: string | null,
): string {
  if (!meta || !durum) return 'gray';
  if (durum === meta.varsayilan_durum) return 'gray';
  if (durum === meta.kapali_durumlar[0]) return 'green';
  if (durum === meta.kapali_durumlar[1]) return 'red';
  const others = meta.durumlar.filter((d) => d !== meta.varsayilan_durum && !meta.kapali_durumlar.includes(d));
  const i = others.indexOf(durum);
  return i === -1 ? 'gray' : (OPEN_COLORS[i % OPEN_COLORS.length] ?? 'gray');
}
