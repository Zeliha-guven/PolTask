"""Excel içe aktarma — komut satırından ilk kurulum:  python importer.py "<excel yolu>"

Mevcut veriyi siler ve Excel'deki işleri, geçmiş haftalık özetleri ve OPM sayfasını yükler (BR-4).
"""
import sys
import warnings

from poltask.api import create_app
from poltask.api.transfer import import_excel_file
from poltask.storage import database


def main(argv):
    warnings.filterwarnings("ignore")
    sys.stdout.reconfigure(encoding="utf-8")
    if len(argv) < 2:
        print('Kullanım: python importer.py "<excel yolu>"')
        return 1
    try:
        app = create_app(database.DEFAULT_DB_PATH)
    except database.StartupError as e:
        print(f"İçe aktarım başlatılamadı: {e}", file=sys.stderr)
        return 1
    print(import_excel_file(app.config["DB_PATH"], argv[1], app.config["CLOCK"]))
    return 0


if __name__ == "__main__":
    code = main(sys.argv)
    if code:
        sys.exit(code)
