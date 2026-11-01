"""SQLite bağlantısı ve şema. Bağlantılar her kullanımda kapanır (Windows'ta dosya kilidi bırakmaz)."""
import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path

from poltask.domain.fields import FIELDS

DEFAULT_DB_PATH = Path(__file__).resolve().parents[2] / "data" / "poltask.db"
# Gerçek veri dosyası (yamalanamaz kopya): testler altında açılması reddedilir
REAL_DB_PATH = DEFAULT_DB_PATH


class RealDataGuardError(RuntimeError):
    """pytest altında gerçek data/poltask.db açılmaya çalışıldı."""


def guard_real_data(path):
    """pytest çalışırken gerçek veritabanına erişimi yüksek sesle reddeder (olay 2026-11-01, A-5)."""
    if os.environ.get("PYTEST_CURRENT_TEST") and Path(path).resolve() == REAL_DB_PATH.resolve():
        raise RealDataGuardError(f"Testler gerçek veritabanına dokunamaz: {path}")

SCHEMA = f"""
CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sira INTEGER,
    {", ".join(f"{f.key} {'INTEGER' if f.type == 'int' else 'TEXT'}" for f in FIELDS)},
    created_at TEXT,
    updated_at TEXT
);
CREATE TABLE IF NOT EXISTS task_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL,
    alan TEXT NOT NULL,
    eski TEXT,
    yeni TEXT,
    zaman TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL,
    metin TEXT NOT NULL,
    zaman TEXT NOT NULL,
    ice_aktarim INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tarih TEXT NOT NULL,
    etiket TEXT,
    pivot_json TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS opm_tickets (
    kod TEXT PRIMARY KEY,
    konu TEXT,
    atanan TEXT,
    durum TEXT,
    oncelik TEXT,
    tur TEXT,
    modul TEXT,
    raportor TEXT,
    olusturma TEXT,
    son_guncelleme TEXT
);
CREATE TABLE IF NOT EXISTS meta (
    anahtar TEXT PRIMARY KEY,
    deger TEXT
);
CREATE INDEX IF NOT EXISTS ix_history_task ON task_history(task_id);
CREATE INDEX IF NOT EXISTS ix_comments_task ON comments(task_id);
"""


def _open(path):
    guard_real_data(path)
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


@contextmanager
def connect(path):
    """Tek işlem: başarıda commit, hatada rollback; her durumda kapanır."""
    conn = _open(path)
    try:
        yield conn
        conn.commit()
    except BaseException:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_schema(path):
    guard_real_data(path)
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    with connect(path) as conn:
        conn.executescript(SCHEMA)


SCHEMA_VERSION = 1
APP_TABLES = ("tasks", "task_history", "comments", "snapshots", "opm_tickets", "meta")


class StartupError(RuntimeError):
    """Veritabanı hazırlanamadı; uygulama başlamamalı. Mesaj Türkçedir ve kullanıcıya gösterilir."""


def _schema_state(path):
    """(uygulama tablosu var mı, user_version)."""
    if not Path(path).is_file() or Path(path).stat().st_size == 0:
        return False, 0
    conn = _open(path)
    try:
        names = {r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type = 'table'")}
        return bool(names & set(APP_TABLES)), conn.execute("PRAGMA user_version").fetchone()[0]
    except sqlite3.DatabaseError as e:
        raise StartupError(
            f"Veritabanı okunamadı: {path} geçerli bir SQLite dosyası değil ya da bozuk ({type(e).__name__}). "
            "Dosyayı değiştirmeden yedekten geri yükleyin."
        ) from e
    finally:
        conn.close()


def _backup(path, backup_dir, when):
    backup_dir = Path(backup_dir)
    target = backup_dir / f"poltask-yedek-{when:%Y%m%d-%H%M%S}.db"
    n = 1
    while target.exists():
        target = backup_dir / f"poltask-yedek-{when:%Y%m%d-%H%M%S}-{n}.db"
        n += 1
    guard_real_data(target)
    src = _open(path)
    try:
        backup_dir.mkdir(parents=True, exist_ok=True)
        dst = sqlite3.connect(target)
        try:
            src.backup(dst)
        finally:
            dst.close()
    finally:
        src.close()
    return target


def prepare_database(path, clock, backup_dir=None):
    """CB-9: sürümsüz mevcut veritabanında önce tarih-saat adlı yedek, sonra şema sürümü kaydı.

    Yedek alınamazsa yükseltme yapılmaz ve StartupError yükselir. Yeni/boş veritabanı doğrudan
    sürümle oluşturulur. Sürümlü veritabanına dokunulmaz. Alınan yedeğin yolunu (ya da None) döner.
    """
    guard_real_data(path)
    path = Path(path)
    has_tables, version = _schema_state(path)
    if version >= SCHEMA_VERSION:
        return None
    backup = None
    if has_tables:
        try:
            backup = _backup(path, backup_dir or path.parent, clock())
        except (OSError, sqlite3.Error) as e:
            raise StartupError(
                "Veritabanının yedeği alınamadı; yükseltme yapılmadı ve uygulama başlatılmadı. "
                f"Yedek klasörünü kontrol edin ({type(e).__name__})."
            ) from e
    init_schema(path)
    with connect(path) as conn:
        conn.execute(f"PRAGMA user_version = {SCHEMA_VERSION}")
    return backup
