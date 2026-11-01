// Tarih yardımcıları. Tek kural: yerel tarih (Europe/Istanbul) — toISOString UTC verir, kullanılmaz
// (docs/conventions.md, Known traps). Saklama/taşıma YYYY-MM-DD, gösterim GG.AA.YYYY.

const pad = (n: number) => String(n).padStart(2, '0');

/** Verilen anın yerel takvim tarihi, YYYY-MM-DD. */
export function localIsoDate(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function today(): string {
  return localIsoDate(new Date());
}

/** YYYY-MM-DD → GG.AA.YYYY */
export function fmtDate(iso: string | null | undefined): string {
  if (!iso || iso.length < 10) return '';
  return `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;
}

/** YYYY-MM-DD → GG.AA */
export function fmtDateShort(iso: string | null | undefined): string {
  if (!iso || iso.length < 10) return '';
  return `${iso.slice(8, 10)}.${iso.slice(5, 7)}`;
}

/** ISO zaman damgası → GG.AA.YYYY SS:DD */
export function fmtTs(ts: string | null | undefined): string {
  if (!ts) return '';
  const time = ts.slice(11, 16);
  return time ? `${fmtDate(ts.slice(0, 10))} ${time}` : fmtDate(ts.slice(0, 10));
}

/** Verilen günün ISO haftası (Pazartesi–Pazar), YYYY-MM-DD çifti. */
export function weekRange(day: string): [string, string] {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  const n = new Date(y, m - 1, d);
  const offset = (n.getDay() + 6) % 7;
  const start = new Date(y, m - 1, d - offset);
  const end = new Date(y, m - 1, d - offset + 6);
  return [localIsoDate(start), localIsoDate(end)];
}

export function inWeekOf(date: string | null | undefined, day: string): boolean {
  if (!date) return false;
  const [s, e] = weekRange(day);
  return date >= s && date <= e;
}
