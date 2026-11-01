"""PolTask — Linktera iş takip sitesi.  Çalıştırma: python app.py  →  http://localhost:5000"""
import sys
import warnings

from poltask.api import create_app
from poltask.storage import database


def main():
    warnings.filterwarnings("ignore", module="openpyxl")
    try:
        app = create_app(database.DEFAULT_DB_PATH)
    except database.StartupError as e:
        sys.stderr.reconfigure(encoding="utf-8")
        print(f"PolTask başlatılamadı: {e}", file=sys.stderr)
        sys.exit(1)
    app.run(host="127.0.0.1", port=5000, debug=False)


if __name__ == "__main__":
    main()
