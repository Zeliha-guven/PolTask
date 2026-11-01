// Sunucu sözleşmesinin tipleri (spec 0002, /api/meta sözleşmesi; diğer uçlar app.py ile aynı).

export type FieldType = 'text' | 'textarea' | 'int' | 'date';

export interface Alan {
  anahtar: string;
  baslik: string;
  etiket: string;
  tip: FieldType;
  /** int alanlar için izin verilen aralık (ör. yuzde 0–100, oncelik 1–3). */
  min?: number;
  max?: number;
}

export interface Meta {
  son_ice_aktarim: string | null;
  son_opm_aktarim: string | null;
  opm_sayisi: number;
  is_sayisi: number;
  alanlar: Alan[];
  durumlar: string[];
  kapsam_tipleri: string[];
  sozlesme_degerleri: string[];
  /** Kapanmış durumlar; sıra sözleşmedir: [0] tamamlandı (BR-2 hedefi), [1] iptal. */
  kapali_durumlar: string[];
  /** Yeni işin varsayılan durumu. */
  varsayilan_durum: string;
}

export interface Opm {
  kod: string;
  durum?: string | null;
  konu?: string | null;
  atanan?: string | null;
  oncelik?: string | null;
  tur?: string | null;
  modul?: string | null;
  olusturma?: string | null;
  son_guncelleme?: string | null;
}

export type TaskValue = string | number | null;

export interface Task {
  id: number;
  opm?: Opm | null;
  yorum_sayisi?: number;
  [key: string]: TaskValue | Opm | undefined;
}

export type TaskInput = Record<string, string | number | null>;

export type TimelineItem =
  | { tip: 'yorum'; id: number; metin: string; zaman: string; ice_aktarim?: number | boolean | null }
  | { tip: 'degisiklik'; id: number; alan: string; eski: string | null; yeni: string | null; zaman: string };

/** Pivot: kapsam tipi → durum → sayı */
export type Pivot = Record<string, Record<string, number>>;

export interface Snapshot {
  id: number;
  tarih: string;
  etiket: string | null;
  pivot: Pivot;
}

export interface ExcelImportResult {
  isler: number;
  gecmis_ozet: number;
  opm?: number | null;
}

export interface OpmImportResult {
  opm: number;
  eslesen: number;
}
