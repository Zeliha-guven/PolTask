# PolTask

TurkOnay'ın 3rd party (öncelikle Linktera) ile yürüttüğü işlerin — Ana Kapsam, Ek İstek, Kapsam İçi
Değişiklik, Bug fix — takip aracı. Excel'deki manuel pivot ve haftalık karşılaştırma emeğini kaldırır:
iş listesinin ana kaynağı sitedir, Excel yalnızca içe/dışa aktarım formatıdır. Jira'ya benzemeden
Excel'in mantığını korur.

Bugün tek kullanıcılı ve yalnızca bu makinede (`127.0.0.1`) çalışır; hedef, ileride şirket içinde
birden fazla kişinin kullanmasıdır.

## Çalıştırma (bugün)

Python 3.12 gerekir.

```bash
pip install -r requirements.txt
python app.py          # ya da Windows'ta: baslat.bat
```

Ardından tarayıcıda: <http://localhost:5000>. Arayüz derlenmiş hâliyle `web/dist`'ten sunulur; ilk kurulumda
(ve arayüz güncellenince) bir kez `cd web && npm ci && npm run build` çalıştırın — derlenmemişse `/` bunu
söyleyen bir hata döner. Eski arayüz geri dönüş yolu olarak <http://localhost:5000/eski> adresinde durur.
Veri `data/` altındaki yerel SQLite dosyasındadır (repoya girmez).

## Geliştirme

```bash
pip install -r requirements-dev.txt   # flask, openpyxl + pytest, ruff (sabit sürümler)
./scripts/check                       # tek doğrulama komutu (tam profil = kanıt)
./scripts/check --fast                # iç döngü: yalnızca hızlı adımlar
```

Windows'ta `./scripts/check` Git Bash ile çalışır (`bash scripts/check`).

### Web arayüzü (`web/`)

Arayüz React + TypeScript + Vite + Mantine ile `web/` altında
([ADR 0001](docs/decisions/0001-frontend-react-typescript-mantine.md), spec 0002). Node.js ≥ 20 gerekir.

```bash
cd web && npm ci          # bağımlılıklar (sabit sürümler, package-lock.json) — check bunu YAPMAZ, önce bir kez çalıştırın
npm run dev               # geliştirme: Vite dev sunucusu, /api → http://127.0.0.1:5000 (python app.py açık olmalı)
npm run lint              # eslint + tsc --noEmit
npm test                  # vitest run (tek seferlik, watch yok)
npm run build             # derleme çıktısı web/dist (Flask bunu sunar)
```

`./scripts/check` web adımlarını (`web-lint`, `web-test`, `web-build`) çalıştırır; `web/node_modules` yoksa
bu adımlar kırmızı olur — önce `cd web && npm ci`.

## Süreç (ANEW)

Bu repo ANEW iş akışıyla geliştirilir (mod: **lite**): spec olmadan kod yok, plan insan onayı olmadan
uygulanmaz. Başlangıç noktası [AGENTS.md](AGENTS.md); komutların tamamı ve nerede durdukları
[docs/commands.md](docs/commands.md)'de. Mimari, domain dili ve kurallar `docs/` altında.
