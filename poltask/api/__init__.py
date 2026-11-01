"""Flask uygulaması: HTTP uç noktaları, girdi doğrulama, hata eşleme, statik arayüz."""
from pathlib import Path

from flask import Flask, abort, redirect, send_from_directory

from poltask.api import errors, meta, snapshots, tasks, transfer
from poltask.domain.clock import system_clock
from poltask.storage import database

ROOT = Path(__file__).resolve().parents[2]
STATIC_DIR = ROOT / "static"
WEB_DIST = ROOT / "web" / "dist"


def create_app(db_path=None, clock=system_clock, upload_dir=None, web_dist=None):
    """db_path: SQLite dosyası (varsayılan data/poltask.db); clock: enjekte edilen saat;
    upload_dir: yüklenen dosyaların geçici dizini (None = sistemin geçici dizini);
    web_dist: yeni arayüzün derleme çıktısı (varsayılan web/dist)."""
    app = Flask(__name__, static_folder=str(STATIC_DIR), static_url_path="/static")
    app.config["DB_PATH"] = Path(db_path or database.DEFAULT_DB_PATH)
    app.config["CLOCK"] = clock
    app.config["UPLOAD_DIR"] = upload_dir
    app.config["WEB_DIST"] = Path(web_dist or WEB_DIST)
    database.prepare_database(app.config["DB_PATH"], clock)

    # Spec 0002 ship geçişi (A-9): / yeni arayüz (web/dist); eski arayüz geri dönüş yolu olarak /eski (B-5)
    @app.get("/")
    def index():
        dist = app.config["WEB_DIST"]
        if not (dist / "index.html").is_file():
            abort(404, "Arayüz derlenmemiş: cd web && npm ci && npm run build")
        return send_from_directory(dist, "index.html")

    @app.get("/eski")
    def legacy_ui():
        return send_from_directory(app.static_folder, "index.html")

    @app.get("/yeni")
    def new_ui():
        return redirect("/", code=302)

    @app.get("/assets/<path:name>")
    def new_ui_assets(name):
        return send_from_directory(app.config["WEB_DIST"] / "assets", name)

    for bp in (meta.bp, tasks.bp, snapshots.bp, transfer.bp):
        app.register_blueprint(bp)
    errors.register(app)
    return app
