import { describe, expect, it } from 'vitest';
import { META, TASKS, task } from '../test/fixtures';
import { genericKonuSet, isLate, opmSuggestion, statusRoles, targetDate, taskTitle } from './rules';

const roles = statusRoles(META);
const TODAY = '2026-10-28';

describe('statusRoles', () => {
  it('rolleri meta.varsayilan_durum ve meta.kapali_durumlar sırasından alır', () => {
    expect(roles.initial).toBe('Başlamadı');
    expect(roles.done).toBe('Tamamlandı');
    expect(roles.cancelled).toBe('İptal');
  });
  it('durumlar sırasına değil meta alanlarına dayanır', () => {
    const r = statusRoles({ kapali_durumlar: ['Kapandı', 'Vazgeçildi'], varsayilan_durum: 'Yeni' });
    expect(r.initial).toBe('Yeni');
    expect(r.done).toBe('Kapandı');
    expect([...r.closed]).toEqual(['Kapandı', 'Vazgeçildi']);
    expect(isLate(task({ id: 8, durum: 'Kapandı', hedef_tarih: '2026-01-01' }), r, TODAY)).toBe(false);
  });
});

describe('BR-1 gecikmiş', () => {
  it('br1: açık iş, hedef bugünden önce → gecikmiş', () => {
    expect(isLate(TASKS[0]!, roles, TODAY)).toBe(true);
  });
  it('br1: kapanmış iş gecikmiş sayılmaz', () => {
    expect(isLate(TASKS[1]!, roles, TODAY)).toBe(false);
  });
  it('br1: Hedef Teslim yoksa İlk Verilen Hedef kullanılır', () => {
    const t = task({ id: 9, ilk_hedef_tarih: '2026-10-27' });
    expect(targetDate(t)).toBe('2026-10-27');
    expect(isLate(t, roles, TODAY)).toBe(true);
    expect(isLate(task({ id: 10, hedef_tarih: '2026-10-28' }), roles, TODAY)).toBe(false);
  });
});

describe('BR-3 OPM uyumsuzluğu', () => {
  it('br3: OPM Çözüldü, bizde açık → tamamlandı önerilir', () => {
    expect(opmSuggestion(TASKS[2]!, roles)).toBe('Tamamlandı');
  });
  it('br3: OPM Reddedildi → iptal önerilir', () => {
    expect(opmSuggestion(task({ id: 4, opm: { kod: 'LTR4', durum: 'Reddedildi' } }), roles)).toBe('İptal');
  });
  it('br3: bizde kapanmışsa ya da OPM açıksa uyarı yok', () => {
    expect(opmSuggestion(TASKS[1]!, roles)).toBeNull();
    expect(opmSuggestion(task({ id: 5, opm: { kod: 'LTR5', durum: 'Açık' } }), roles)).toBeNull();
  });
});

describe('generic KONU', () => {
  it('20den fazla işte geçen KONU alt başlıktır; başlık Açıklamanın ilk satırı olur', () => {
    const many = Array.from({ length: 21 }, (_, i) =>
      task({ id: 100 + i, konu: 'Süreç İsterleri', aciklama: `Madde ${i}\nayrıntı` }),
    );
    const g = genericKonuSet(many);
    expect(g.has('Süreç İsterleri')).toBe(true);
    expect(taskTitle(many[3]!, g)).toBe('Madde 3');
    expect(genericKonuSet(many.slice(0, 20)).size).toBe(0);
  });
});
