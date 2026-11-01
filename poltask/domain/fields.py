"""Alan listesinin ve izin verilen değerlerin TEK tanımı (BR-5, docs/architecture.md)."""
from typing import NamedTuple


class Field(NamedTuple):
    key: str  # domain alan anahtarı = DB sütunu
    header: str  # Excel başlığı (kaynak sayfayla birebir, sondaki boşluklar dahil)
    type: str  # saklama tipi: text · int · date
    label: str  # Türkçe arayüz etiketi
    ui_type: str  # arayüz tipi: text · textarea · int · date


# Sıra Excel'deki kolon sırasıyla aynı
FIELDS = [
    Field("ana_baslik", "ANA BAŞLIK", "text", "Ana Başlık", "text"),
    Field("konu", "KONU", "text", "Konu", "textarea"),
    Field("sozlesme", "Sözleşme Kapsamına Dahil/Dahil değil", "text", "Sözleşme Kapsamı", "text"),
    Field("kapsam_tipi", "Kapsam Tipi", "text", "Kapsam Tipi", "text"),
    Field("ltr_yorum", "LTR Yorum", "text", "LTR Yorum", "textarea"),
    Field("aciklama", "Açıklama", "text", "Açıklama", "textarea"),
    Field("yuzde", "Tamamlanma Yüzdesi", "int", "Tamamlanma %", "int"),
    Field("durum", "Tamamlanma Durumu ", "text", "Tamamlanma Durumu", "text"),
    Field("opm_talep_tarihi", "OPM Talep Tarihi", "date", "OPM Talep Tarihi", "date"),
    Field("ilk_hedef_tarih", "İlk Verilen Hedef Teslim Tarihi(Linktera)", "date", "İlk Verilen Hedef Teslim", "date"),
    Field("hedef_tarih", "Hedef Teslim Tarihi(Linktera)", "date", "Hedef Teslim (Linktera)", "date"),
    Field("uat_hedef", "UAT Hedefi(TurkOnay)", "date", "UAT Hedefi (TurkOnay)", "date"),
    Field("bitis_tarihi", "Bitiş Tarihi ", "date", "Bitiş Tarihi", "date"),
    Field("yayginlastirma_tarihi", "Yaygınlaştırma Tarihi", "date", "Yaygınlaştırma Tarihi", "date"),
    Field("cr_no", "CR NUMARASI", "text", "CR Numarası", "text"),
    Field("talep_sorumlusu", "TALEP SORUMLUSU", "text", "Talep Sorumlusu", "text"),
    Field("linktera_sorumlusu", "LİNKTERA SORUMLUSU", "text", "Linktera Sorumlusu", "text"),
    Field("kimde_bekliyor", "Kimde Bekliyor?", "text", "Kimde Bekliyor?", "text"),
    Field("oncelik", "Öncelik", "int", "Öncelik", "int"),
    Field("icerik_tarihce", "İçerik Detayı-Tarihçe", "text", "İçerik Detayı-Tarihçe", "text"),
    Field("opm_no", "OPM NO", "text", "OPM No", "text"),
]
FIELD_KEYS = [f.key for f in FIELDS]
FIELD_TYPES = {f.key: f.type for f in FIELDS}
# İçe aktarımda yorum akışına taşınan, API ile yazılmayan alan
DERIVED_FIELD = "icerik_tarihce"
EDITABLE_KEYS = [k for k in FIELD_KEYS if k != DERIVED_FIELD]

DURUMLAR = ["Başlamadı", "Beklemede", "Geliştirmede", "Testte", "Tamamlandı", "İptal"]
KAPSAM_TIPLERI = ["Ana Kapsam", "Bug fix", "Ek İstek", "Kapsam İçi Değişiklik"]
SOZLESME_DEGERLERI = ["Dahil", "Dahil değil"]
DEFAULT_DURUM = "Başlamadı"
# Kapanmış iş: Durum ∈ {Tamamlandı, İptal} (docs/domain.md)
KAPALI_DURUMLAR = ["Tamamlandı", "İptal"]

# BR-5: alan → izin verilen değerler
ALLOWED_VALUES = {"durum": DURUMLAR, "kapsam_tipi": KAPSAM_TIPLERI, "sozlesme": SOZLESME_DEGERLERI}
# Tam sayı aralıkları (docs/conventions.md, Data rules)
INT_RANGES = {"yuzde": (0, 100), "oncelik": (1, 3)}


def meta_fields():
    """Arayüze sunulan alan listesi (/api/meta `alanlar`)."""
    out = []
    for f in FIELDS:
        item = {"anahtar": f.key, "baslik": f.header, "etiket": f.label, "tip": f.ui_type}
        if f.key in INT_RANGES:
            item["min"], item["max"] = INT_RANGES[f.key]
        out.append(item)
    return out
