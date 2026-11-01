# ADR 0001 — Arayüz React + TypeScript + Vite + Mantine ile yeniden yazılır

- Status: Accepted
- Date: 2026-11-01

## Context

PolTask'in bugünkü arayüzü vanilla JavaScript'tir: `static/app.js` (819 satır) ekranları `innerHTML`
şablonlarıyla üretir, grafikler CDN'den yüklenen Chart.js 4.4.1 ile çizilir. Bu yapının sorunları:

- Alan listeleri, Durum/Kapsam Tipi değerleri ve pivot mantığı Python ve JS'de **ikilenmiştir**; biri
  değişince diğeri sessizce eskir.
- `innerHTML` şablonları escape'i her yerde elle yapmayı gerektirir (XSS riski) ve büyüdükçe bakımı
  zorlaşır; tip denetimi, bileşen testi ve lint yoktur.
- CDN bağımlılığı uygulamayı çevrimdışı kullanılamaz kılar.
- Hedef, aracın ileride şirket içinde birden fazla kişi tarafından kullanılmasıdır (backlog B-1); arayüzün
  büyüyecek ve daha çok kişiye hitap edecek olması özelleştirilebilirlik ve görünüm beklentisini artırır.

İnsan (Zeliha Güven) seçimi ajana bıraktı, ölçütü açıkça verdi: "hangisi daha özelleştirilebilir ve daha
iyi görünüyorsa". Backend (Python 3.12 + Flask 3.1 + openpyxl 3.1 + SQLite) korunur; karar yalnızca
arayüz içindir.

## Decision

Arayüzü **React + TypeScript (strict) + Vite** ile, bileşen kütüphanesi olarak **Mantine** (tema, tablo,
drawer, tarih seçiciler, bildirimler, grafikler) kullanarak yeniden yazıyoruz; Vite çıktısı statik
varlıklar olarak Flask tarafından sunulur, böylece tek çalıştırma komutu korunur ve tüm varlıklar
derlemeye dahil edilir (CDN yok). Tam npm sürümleri spec 0001'de commit edilen lockfile ile sabitlenir.

## Consequences

**Kazandıklarımız:**
- Mantine'in tema sistemi ve hazır bileşenleri (tablo, drawer, tarih seçici, bildirim, grafik) hem
  görünümü hem özelleştirmeyi tek yerden yönetilebilir kılar; ekranları elle kurma emeği düşer.
- TypeScript strict, API yanıtlarını ve alanları tiplerle bağlar; yanlış alan adı derlemede yakalanır.
- React metni otomatik escape eder; `dangerouslySetInnerHTML` yasaklanarak XSS yüzeyi küçülür.
- Vitest + React Testing Library ile UI durumları (boş/yükleniyor/hata/başarılı) bileşen testleriyle
  kanıtlanabilir.
- Tüm varlıklar paketlenir; uygulama çevrimdışı çalışır. Chart.js CDN'i kalkar.
- Alan/değer listeleri `/api/meta`'dan alınarak ikileme biter.

**Bedeli:**
- Bir **Node.js derleme adımı** gelir (Node ≥ 20, npm); geliştirme makinesine Node kurulmalı ve
  `scripts/check`'e web adımları (lint/typecheck, test, build) eklenir — check süresi uzar.
- Önemli sayıda **npm bağımlılığı** gelir; her biri sürüm sabitlemesi, lockfile ve güncelleme yükü
  getirir (`docs/security.md`, Dependencies).
- Mevcut 819 satırlık arayüz yeniden yazılır; geçiş süresince eski ve yeni yapı yan yana durur.
- Mantine'in görsel diline ve API'sine bağımlılık oluşur; kütüphane değişimi pahalıdır.

## Alternatives considered

- **Vanilla JS'i korumak:** sıfır bağımlılık ve derleme adımı yok. Özelleştirilebilirlik ve bakım
  kolaylığında kaybetti: tema, tablo, tarih seçici gibi her şey elle yazılmalı; tip ve bileşen testi yok;
  `innerHTML` escape yükü sürer.
- **Vue veya Svelte (+ bir bileşen kütüphanesi):** uygulanabilir, daha küçük paket boyutu. Hazır bileşen
  ekosisteminin genişliğinde kaybetti: React + Mantine kombinasyonu ihtiyaç duyulan bileşenlerin
  (veri tablosu, drawer, tarih aralığı, bildirim, grafik) hepsini tek, tutarlı bir tema altında sunuyor.
- **React + Tailwind + shadcn/ui:** çok esnek ve modern görünüm. Daha fazla elle montaj gerektirdiği için
  kaybetti: bileşenler projeye kopyalanıp sahiplenilir, tarih seçici/grafik/bildirim için ayrı paketler
  birleştirilmelidir; tek kişilik bakım için daha pahalı.

## Revisit triggers

- Node derleme adımı geliştirme veya dağıtımda kalıcı sorun yaratırsa (ör. Node kurulamayan bir hedef
  makine).
- Mantine'in bakımı yavaşlar, büyük bir sürüm geçişi aşırı pahalı olur ya da ihtiyaç duyulan bir bileşeni
  karşılayamazsa.
- Çok kullanıcılı geçişte (B-1) sunucu taraflı render veya farklı bir dağıtım modeli gerekirse.
- Derlenmiş paket boyutu veya check süresi kabul edilemez hâle gelirse.
