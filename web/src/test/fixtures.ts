// Test verisi: /api/meta sözleşmesine uygun meta ve örnek işler (durum adları YALNIZ burada/testlerde geçer).
import type { Meta, Snapshot, Task } from '../api/types';
import contract from './meta.contract.json';

// Meta, gerçek /api/meta yanıtından üretilen sözleşme dosyasından kurulur (review L-3; backend'in pytest
// sözleşme testi aynı dosyayı doğrular). Yalnız değişken alanlar (zaman, sayılar) burada sabitlenir.
export const META: Meta = {
  ...(contract as unknown as Meta),
  son_ice_aktarim: '2026-10-20T09:15:00',
  son_opm_aktarim: null,
  opm_sayisi: 2,
  is_sayisi: 3,
};

/** Değer listeleri: AC-2 taraması bunların kaynakta sabit yazılmadığını denetler. */
export const META_VALUES = [...META.durumlar, ...META.kapsam_tipleri, ...META.sozlesme_degerleri];

export function task(over: Partial<Task> & { id: number }): Task {
  return {
    ana_baslik: 'Ödeme',
    konu: `İş ${over.id}`,
    aciklama: null,
    kapsam_tipi: 'Ek İstek',
    sozlesme: 'Dahil',
    durum: 'Geliştirmede',
    yuzde: 50,
    oncelik: 2,
    kimde_bekliyor: 'Linktera',
    ilk_hedef_tarih: null,
    hedef_tarih: null,
    uat_hedef: null,
    bitis_tarihi: null,
    opm_talep_tarihi: null,
    opm_no: null,
    talep_sorumlusu: null,
    opm: null,
    yorum_sayisi: 0,
    ...over,
  };
}

export const TASKS: Task[] = [
  // Gecikmiş (BR-1): hedef 20.10.2026 < bugün 28.10.2026, açık
  task({ id: 1, konu: 'Kart limit ekranı', hedef_tarih: '2026-10-20', durum: 'Geliştirmede', yorum_sayisi: 2 }),
  // Kapanmış: hedef geçmiş ama gecikmiş değil; OPM kapalı ama bizde de kapalı → uyarı yok
  task({
    id: 2,
    konu: 'Rapor dışa aktarımı',
    hedef_tarih: '2026-10-01',
    durum: 'Tamamlandı',
    yuzde: 100,
    bitis_tarihi: '2026-10-02',
    opm_no: 'LTR200',
    opm: { kod: 'LTR200', durum: 'Kapatıldı' },
  }),
  // OPM'de kapanmış, bizde açık (BR-3); UAT bu hafta; İlk Verilen Hedef gelecekte
  task({
    id: 3,
    ana_baslik: 'Raporlama',
    konu: 'Mutabakat servisi',
    kapsam_tipi: 'Bug fix',
    durum: 'Testte',
    ilk_hedef_tarih: '2026-11-15',
    uat_hedef: '2026-10-30',
    kimde_bekliyor: 'TurkOnay',
    opm_no: 'LTR300',
    opm: { kod: 'LTR300', durum: 'Çözüldü', konu: 'Mutabakat', atanan: 'Ali' },
  }),
];

export const SNAPSHOTS: Snapshot[] = [
  { id: 10, tarih: '2026-10-19T08:00:00', etiket: 'Haftalık otomatik', pivot: { 'Ek İstek': { Geliştirmede: 2, Testte: 1 } } },
  { id: 11, tarih: '2026-10-26T08:00:00', etiket: '26 Ekim haftası', pivot: { 'Ek İstek': { Geliştirmede: 1, Tamamlandı: 1 }, 'Bug fix': { Testte: 1 } } },
];
