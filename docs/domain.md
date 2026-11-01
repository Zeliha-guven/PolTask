# Domain

> TurkOnay ile 3rd party (öncelikle Linktera) arasında yürüyen işlerin ortak dili. Kodda, spec'lerde
> ve konuşmada aynı kelime aynı anlama gelir. Burada olmayan bir terim için ajan kendi anlamını uydurur —
> yeni terim önce buraya yazılır.

## Ubiquitous language

| Term | Meaning | Notes / not to be confused with |
|---|---|---|
| İş (task) | Excel'deki bir satır; Ana Başlık > KONU altında takip edilen birim. | Kodda `task`. Jira "issue"su değildir: iş akışı/atama motoru yoktur. |
| Ana Başlık | İşin ait olduğu üst gruplama (`ana_baslik`). | KONU ile karıştırılmamalı. |
| KONU | İşin konusu/başlığı (`konu`). Asla boş olamaz. | 20'den fazla işin paylaştığı bir KONU değeri (ör. "Süreç İsterleri") aslında bir **alt başlıktır**; o işlerin gerçek başlığı Açıklama'nın ilk satırıdır. |
| Açıklama | İşin serbest metin açıklaması. | Alt başlık durumunda ilk satırı işin başlığıdır (bkz. KONU). |
| Durum | İşin aşaması (`durum`). Tanımlı değerler: Başlamadı, Beklemede, Geliştirmede, Testte, Tamamlandı, İptal. | OPM'deki durumlarla (Kapatıldı, Çözüldü, Reddedildi…) aynı şey değildir; bkz. BR-3. |
| Kapanmış | Durumu Tamamlandı veya İptal olan iş. | — |
| Açık | Kapanmamış iş (Durum ∉ {Tamamlandı, İptal}). | "Başlamadı" da açıktır. |
| Kapsam Tipi | İşin sözleşmeye göre türü (`kapsam_tipi`): Ana Kapsam, Ek İstek, Kapsam İçi Değişiklik, Bug fix. | Sözleşme Kapsamı ile karıştırılmamalı. |
| Sözleşme Kapsamı | İşin sözleşmeye dahil olup olmadığı: Dahil / Dahil değil. | Kapsam Tipi'nden bağımsız bir alandır. |
| Kimde Bekliyor | Topun kimde olduğu (`kimde_bekliyor`): Linktera, TurkOnay, Banka, PAX… | Sorumlu kişi değil, bekleyen taraf. |
| Yüzde | Tamamlanma yüzdesi (`yuzde`), 0–100 tam sayı. | Excel başlığı "Tamamlanma Durumu " (sonda boşluk; bkz. conventions Known traps). |
| Öncelik | İşin önceliği (`oncelik`), 1–3 tam sayı. | — |
| OPM | Linktera'nın ticket sistemi. | PolTask'in kendisi değil; yalnızca içe aktarılan bir kaynak. |
| OPM No | İşin OPM'deki kodu (`opm_no`), ör. `LTR1234`. Metinden `LTR\d+` çıkarılarak normalize edilir. | — |
| Hedef Teslim | Güncel hedef teslim tarihi. | İlk Verilen Hedef'in yerine geçer (BR-1). |
| İlk Verilen Hedef | İş için ilk verilen hedef tarih. | Hedef Teslim yoksa hedef tarih budur. |
| Hedef tarih | Hedef Teslim; yoksa İlk Verilen Hedef (BR-1). | Hesaplanan bir değerdir, ayrı alan değildir. |
| Gecikmiş | Hedef tarihi bugünden önce olan açık iş (BR-1). | Kapanmış iş hiçbir zaman gecikmiş sayılmaz. |
| Bitiş Tarihi | İşin tamamlandığı tarih. | Hedef tarih değildir. |
| Pivot / Güncel Durum | Kapsam Tipi × Durum iş sayısı tablosu (Excel'deki "Güncel Durum" sayfası). | — |
| Snapshot (anlık görüntü) | Pivotun belli bir andaki kaydı; haftalık karşılaştırmanın temeli. | Excel'den gelen geçmiş snapshot'lar da bu tabloya alınır. |
| Tarihçe (history) | Bir işin alan değişikliklerinin kaydı (alan, eski, yeni, zaman). | Yorum değildir. |
| Yorum | İşe eklenen serbest not. İçe aktarımdan gelenler `ice_aktarim` bayrağı taşır. | — |
| İçe aktarım (Excel) | Linktera Excel dosyasından tüm verinin yeniden yüklenmesi (BR-4). | OPM içe aktarımı ayrı bir işlemdir. |
| Dışa aktarım (Excel) | Mevcut verinin "Linktera_Tüm_İşler" sayfası biçiminde Excel'e yazılması. | — |

## Business rules

- **BR-1:** Bir işin hedef tarihi Hedef Teslim'dir; Hedef Teslim yoksa İlk Verilen Hedef'tir. Açık bir
  işin hedef tarihi bugünden önceyse iş **gecikmiştir**. Kapanmış iş gecikmiş sayılmaz.
- **BR-2:** Bir iş Tamamlandı'ya geçerken Yüzde = 100 ve Bitiş Tarihi = bugün **önerilir**; kullanıcı
  kabul etmek zorunda değildir (sistem zorlamaz).
- **BR-3:** OPM'de Kapatıldı/Çözüldü (→ Tamamlandı) ya da Reddedildi (→ İptal) olup bizde hâlâ açık olan
  iş **uyarı** alır. Durum otomatik değişmez; karar kullanıcınındır.
- **BR-4:** Excel içe aktarımı tüm veriyi (işler, yorumlar, tarihçe, snapshot'lar) değiştirir ve yalnızca
  kullanıcının açık onayıyla yapılır.
- **BR-5:** Durum, Kapsam Tipi ve Sözleşme Kapsamı yalnızca tanımlı değerlerden biri olabilir; sunucu
  doğrular ve geçersiz değeri reddeder (`api` katmanı, spec 0001). Excel/OPM içe aktarımı değerleri olduğu
  gibi alır.
- **BR-6:** Her ISO haftasında en az bir snapshot alınır.

## Key domain invariants

- Her alan değişikliği tarihçeye yazılır: alan, eski değer, yeni değer, zaman. Tarihçesiz değişiklik yoktur.
- KONU asla boş değildir — oluşturmada da güncellemede (PATCH) de.
- Excel dışa aktarımının sütun sırası ve başlıkları kaynak sayfa "Linktera_Tüm_İşler" ile birebir aynıdır;
  dışa aktarılan dosya tekrar içe aktarılabilir.
- Alan listesi, Durum ve Kapsam Tipi değerleri tek bir yerde (backend `domain`) tanımlıdır
  (`docs/architecture.md`).

## Sensitive areas

**None** — insanın bilinçli kararı (Zeliha Güven, 2026-11-01): uygulama tek kullanıcılı ve yalnızca
localhost'ta çalışıyor; para, kimlik veya kişisel veri işlenmiyor.
Not: çok kullanıcılı kullanım geldiğinde (backlog B-1) **Yetkilendirme** hassas alan olarak yeniden
değerlendirilir.
