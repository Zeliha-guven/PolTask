# Architecture

> Kararlaştırılan mimari — hedef değil, kural. Ajanlar plan yapmadan önce bu dosyayı okur.

## System overview

PolTask tek süreçte çalışan bir **modüler monolit**tir: bir Flask uygulaması hem REST API'yi hem de
derlenmiş (statik) arayüzü sunar; veri tek bir SQLite dosyasındadır. Tek kullanıcı, tek makine,
`127.0.0.1` — ayrı servis, kuyruk veya veritabanı sunucusu gerekmez; modül sınırları ise ileride çok
kullanıcılı kullanıma (backlog B-1) geçişi ucuz tutmak için bugünden çizilir.
Arayüz React + TypeScript + Vite + Mantine ile yazılır, statik varlıklara derlenir ve Flask tarafından
sunulur; tek çalıştırma komutu korunur (ADR [0001](decisions/0001-frontend-react-typescript-mantine.md)).

**Bugünkü durum (geçiş):** sunucu tarafı spec 0001 ile `poltask/` paketine taşındı —
`poltask/domain`, `poltask/storage`, `poltask/integrations`, `poltask/api`; kökteki `app.py` (sunucu) ve
`importer.py` (komut satırından içe aktarım) yalnızca giriş noktalarıdır. Eski arayüz (`static/`, vanilla JS
innerHTML şablonları + CDN'den Chart.js, kendi alan/durum kopyalarıyla) yalnızca geri dönüş yoludur. Yeni arayüz
spec 0002 ile `web/` altında yazıldı ve `/`'dan sunulur (`web/dist`); eski arayüz geri dönüş yolu olarak
`/eski`'de durur, kaldırılması backlog B-5.

## Modules / components and ownership

| Module | Single responsibility | Owns |
|---|---|---|
| `domain` (backend) | Alanlar, Durum/Kapsam Tipi/Sözleşme değerleri, iş kuralları (BR-n), pivot ve gecikme hesabı. Saf Python. | İş kavramı ve kuralları; izin verilen değer listelerinin **tek** tanımı. |
| `storage` (backend) | SQLite erişimi, şema ve migration'lar. | İşler, tarihçe, yorumlar, snapshot'lar, OPM ticket'ları, meta — kalıcı veri. |
| `integrations` (backend) | Excel içe/dışa aktarım, OPM içe aktarım (openpyxl). | Excel/OPM dosya formatlarının bilgisi (sütun sırası, başlıklar, normalizasyon). |
| `api` (backend) | Flask: HTTP uç noktaları, girdi doğrulama (BR-5), hata eşleme, statik arayüzü sunma. | HTTP sözleşmesi (`/api/...`), hata mesajları. |
| `web/src/api` (frontend) | Sunucuyla konuşan **tek** katman (fetch). | İstek/yanıt tipleri. |
| `web/src/features/<ekran>` (frontend) | Ekran başına özellik (iş listesi, detay/drawer, pivot, snapshot karşılaştırma, içe/dışa aktarım). | Ekran durumu (UI state). |
| `web/src/components` (frontend) | Paylaşılan görsel bileşenler (tek bildirim bileşeni dahil). | Görsel tutarlılık. |

## Communication rules

- Backend'de çağrı yönü tek yönlüdür: `api` → `integrations` / `storage` → `domain`. `api` `domain`'i de
  doğrudan çağırabilir. Tek süreç: doğrudan fonksiyon çağrısı; olay/kuyruk yok.
- Frontend sunucuya yalnızca `web/src/api` üzerinden, yalnızca REST/JSON ile erişir.
- Alan listesi, Durum, Kapsam Tipi ve Sözleşme değerleri **yalnızca** backend `domain`'de tanımlıdır;
  frontend bunları `/api/meta`'dan alır, kendi kopyasını tutmaz.
- Girdi doğrulama yalnızca `api` katmanında, `domain`'in izin verilen değer listelerine karşı yapılır
  (`docs/conventions.md`).

## Forbidden dependencies (make them testable)

Backend'de bir pytest mimari testi (`tests/unit/test_architecture.py`), frontend'de bir
lint kuralı veya test (spec 0002 ile) bunları doğrular:

- `domain` şunların hiçbirini import etmez: `storage`, `integrations`, `api`, `flask`, `sqlite3`, `openpyxl`.
- `storage` ve `integrations` asla `api` import etmez.
- Frontend'de `fetch` yalnızca `web/src/api` altında çağrılır; `features` ve `components` doğrudan HTTP
  yapmaz.
- Frontend'de Durum/Kapsam Tipi/alan listesi sabit olarak tanımlanmaz (kaynak: `/api/meta`).

## Deliberately out of scope

- Çok kullanıcılı kullanım, kimlik doğrulama, yetkilendirme, CSRF (backlog B-1).
- Sunucuyu LAN'a / `0.0.0.0`'a açmak (`docs/security.md`).
- Zaman damgalarının UTC'ye geçişi (bugün Europe/Istanbul yerel saat; B-1 ile birlikte).
- Remote ve CI (backlog B-2).
- Jira benzeri iş akışı/atama motoru — Excel'in mantığı korunur.
