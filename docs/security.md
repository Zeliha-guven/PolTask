# Security

> Ajanların her planda ve review'da uyduğu temel kurallar. Bootstrap 2026-11-01'de dolduruldu.

## Secrets
- Secrets never enter the repo, specs, prompts, or chat. `.env` is gitignored; provide `.env.example`.
- Agents never print secret values, even when debugging.
- Gerçek iş verisi (Linktera Excel dosyası, `data/` altındaki SQLite veritabanı) repoya girmez;
  `data/` gitignore'dadır. Testler kendi fixture'larını üretir (`docs/testing.md`).

## Input & output
- **Tüm API girdileri `api` katmanında doğrulanır**: tip, aralık (`yuzde` 0–100, `oncelik` 1–3), tarih
  biçimi (`YYYY-MM-DD`), izin verilen değerler (Durum, Kapsam Tipi, Sözleşme — BR-5), zorunlu alanlar
  (KONU boş olamaz). Doğrulanmamış veri `storage`'a ulaşmaz.
- **Dosya yükleme:** yalnızca `.xlsx`; en fazla **20 MB** (Flask `MAX_CONTENT_LENGTH`; aşımda 413 +
  Türkçe `{error}`). Yüklenen dosya geçici dizinde işlenir, iş bitince (hata durumunda da) silinir;
  çalışma kitabı silmeden önce kapatılır (`docs/conventions.md`, Known traps).
- **Çıktı:** React metni otomatik escape eder; `dangerouslySetInnerHTML` **yasaktır**. (Bugünkü vanilla
  JS `innerHTML` şablonları spec 0001 ile kalkar.)
- **Hata mesajları** asla dosya yolu, stack trace, SQL veya iç ayrıntı sızdırmaz
  (`docs/conventions.md`, Error handling).
- Yan etkisi olan işlemler yalnızca `POST`/`PATCH`/`PUT`/`DELETE` ile yapılır; `GET` veri değiştirmez.
  (Bugün `GET /api/snapshots`'ın yazma yan etkisi var — bilinen açık, spec 0001 kapatır.)

## AuthN / AuthZ
- Sunucu **yalnızca `127.0.0.1`'e** bağlanır. Kimlik doğrulama yoktur — bu bilinçli bir sınırdır:
  makineye erişen herkes uygulamaya erişir.
- **0.0.0.0/LAN'a açmak, kimlik doğrulama + yetkilendirme + CSRF getiren ayrı bir spec olmadan
  yasaktır.** (backlog B-1; o gün Yetkilendirme hassas alan olarak yeniden değerlendirilir —
  `docs/domain.md`.)
- Review'da `host=` değerinin `127.0.0.1` dışında bir şeye değişmesi bulgu sayılır.

## Dependencies
- Yeni bir paket (Python veya npm) yalnızca **onaylanmış bir planda listelenmişse ve insan onay
  verdiyse** eklenir. Plan, paketin amacını, lisansını ve bakım durumunu belirtir.
- Sürümler sabitlenir: Python `==` ile (`requirements.txt`, `requirements-dev.txt`); npm tam sürüm +
  commit edilen `web/package-lock.json`.
- **CDN yok:** tüm arayüz varlıkları derlemeye dahil edilir, uygulama çevrimdışı çalışır.
- Bilinen güvenlik açığı olan sürüm bilerek eklenmez; güncelleme de bir plan adımıdır.

## Review lens
Security is a mandatory dimension of every independent review (see `prompts/review.md`), not a
separate afterthought phase.
