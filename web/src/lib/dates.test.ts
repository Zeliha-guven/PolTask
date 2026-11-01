import { describe, expect, it, vi } from 'vitest';
import { fmtDate, fmtTs, inWeekOf, localIsoDate, today, weekRange } from './dates';

describe('tarih yardımcıları', () => {
  it('GG.AA.YYYY gösterir', () => {
    expect(fmtDate('2026-03-07')).toBe('07.03.2026');
    expect(fmtDate(null)).toBe('');
    expect(fmtTs('2026-10-20T09:15:00')).toBe('20.10.2026 09:15');
  });

  it('gece yarısından sonra yerel tarihi verir (toISOString tuzağı)', () => {
    // 29.10.2026 00:30 İstanbul = 28.10.2026 21:30 UTC
    vi.setSystemTime(new Date('2026-10-28T21:30:00Z'));
    expect(today()).toBe('2026-10-29');
    expect(localIsoDate(new Date(2026, 0, 1, 0, 5))).toBe('2026-01-01');
  });

  it('ISO haftası Pazartesi–Pazar', () => {
    expect(weekRange('2026-10-28')).toEqual(['2026-10-26', '2026-11-01']);
    expect(inWeekOf('2026-11-01', '2026-10-28')).toBe(true);
    expect(inWeekOf('2026-11-02', '2026-10-28')).toBe(false);
  });
});
