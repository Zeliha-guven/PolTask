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

Ardından tarayıcıda: <http://localhost:5000>. Veri `data/` altındaki yerel SQLite dosyasındadır
(repoya girmez).

## Geliştirme

```bash
pip install -r requirements-dev.txt   # flask, openpyxl + pytest, ruff (sabit sürümler)
./scripts/check                       # tek doğrulama komutu (tam profil = kanıt)
./scripts/check --fast                # iç döngü: yalnızca hızlı adımlar
```

Windows'ta `./scripts/check` Git Bash ile çalışır (`bash scripts/check`).
Arayüz React + TypeScript + Mantine'e taşınıyor ([ADR 0001](docs/decisions/0001-frontend-react-typescript-mantine.md));
Node.js adımları spec 0001 ile eklenecek.

## Süreç (ANEW)

Bu repo ANEW iş akışıyla geliştirilir (mod: **strict**): spec olmadan kod yok, plan insan onayı olmadan
uygulanmaz. Başlangıç noktası [AGENTS.md](AGENTS.md); komutların tamamı ve nerede durdukları
[docs/commands.md](docs/commands.md)'de. Mimari, domain dili ve kurallar `docs/` altında.
