// Filtreler: alan filtreleri, özel (Özet kutularından gelen) filtreler ve arama.
import type { Task } from '../api/types';
import { inWeekOf } from './dates';
import { dimValue, isClosed, isLate, opmSuggestion, str, type StatusRoles } from './rules';

export type SpecialFilter = 'acik' | 'gecikmis' | 'uat_hafta' | 'opm_uyumsuz';

export interface Filters {
  fields: Record<string, string>;
  special: SpecialFilter[];
  q: string;
}

export const EMPTY_FILTERS: Filters = { fields: {}, special: [], q: '' };

/** Filtre ve pivot boyutu olarak sunulan alan anahtarları (etiketleri meta'dan gelir). */
export const FILTER_KEYS = [
  'ana_baslik',
  'kapsam_tipi',
  'durum',
  'kimde_bekliyor',
  'oncelik',
  'talep_sorumlusu',
  'linktera_sorumlusu',
  'sozlesme',
];

export const SPECIAL_LABELS: Record<SpecialFilter, string> = {
  acik: 'Açık işler',
  gecikmis: 'Hedef tarihi geçmiş',
  uat_hafta: 'Bu hafta UAT',
  opm_uyumsuz: "OPM'de kapanmış",
};

export function specialTest(s: SpecialFilter, t: Task, roles: StatusRoles, todayIso: string): boolean {
  switch (s) {
    case 'acik':
      return !isClosed(t, roles);
    case 'gecikmis':
      return isLate(t, roles, todayIso);
    case 'uat_hafta':
      return inWeekOf(str(t, 'uat_hedef'), todayIso);
    case 'opm_uyumsuz':
      return opmSuggestion(t, roles) !== null;
  }
}

const SEARCH_KEYS = ['konu', 'aciklama', 'opm_no', 'ltr_yorum', 'ana_baslik', 'cr_no', 'kimde_bekliyor'];

export function applyFilters(tasks: Task[], f: Filters, roles: StatusRoles, todayIso: string): Task[] {
  const q = f.q.trim().toLocaleLowerCase('tr');
  return tasks.filter((t) => {
    for (const [k, v] of Object.entries(f.fields)) if (dimValue(t, k) !== v) return false;
    for (const s of f.special) if (!specialTest(s, t, roles, todayIso)) return false;
    if (q) {
      const hay = SEARCH_KEYS.map((k) => str(t, k) ?? '')
        .join(' ')
        .toLocaleLowerCase('tr');
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export function hasAnyFilter(f: Filters): boolean {
  return Object.keys(f.fields).length > 0 || f.special.length > 0 || f.q.trim() !== '';
}
