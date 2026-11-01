"""SQLite şeması ve ortak yardımcılar."""
import json
import os
import sqlite3
from datetime import datetime

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "data", "poltask.db")

# (alan, Excel başlığı, tip) — sıra Excel'deki kolon sırasıyla aynı
FIELDS = [
    ("ana_baslik", "ANA BAŞLIK", "text"),
    ("konu", "KONU", "text"),
    ("sozlesme", "Sözleşme Kapsamına Dahil/Dahil değil", "text"),
    ("kapsam_tipi", "Kapsam Tipi", "text"),
    ("ltr_yorum", "LTR Yorum", "text"),
    ("aciklama", "Açıklama", "text"),
    ("yuzde", "Tamamlanma Yüzdesi", "int"),
    ("durum", "Tamamlanma Durumu ", "text"),
    ("opm_talep_tarihi", "OPM Talep Tarihi", "date"),
    ("ilk_hedef_tarih", "İlk Verilen Hedef Teslim Tarihi(Linktera)", "date"),
    ("hedef_tarih", "Hedef Teslim Tarihi(Linktera)", "date"),
    ("uat_hedef", "UAT Hedefi(TurkOnay)", "date"),
    ("bitis_tarihi", "Bitiş Tarihi ", "date"),
    ("yayginlastirma_tarihi", "Yaygınlaştırma Tarihi", "date"),
    ("cr_no", "CR NUMARASI", "text"),
    ("talep_sorumlusu", "TALEP SORUMLUSU", "text"),
    ("linktera_sorumlusu", "LİNKTERA SORUMLUSU", "text"),
    ("kimde_bekliyor", "Kimde Bekliyor?", "text"),
    ("oncelik", "Öncelik", "int"),
    ("icerik_tarihce", "İçerik Detayı-Tarihçe", "text"),
    ("opm_no", "OPM NO", "text"),
]
FIELD_KEYS = [f[0] for f in FIELDS]

DURUMLAR = ["Başlamadı", "Beklemede", "Geliştirmede", "Testte", "Tamamlandı", "İptal"]
KAPSAM_TIPLERI = ["Ana Kapsam", "Bug fix", "Ek İstek", "Kapsam İçi Değişiklik"]

SCHEMA = f"""
CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sira INTEGER,
    {", ".join(f"{k} {'INTEGER' if t == 'int' else 'TEXT'}" for k, _, t in FIELDS)},
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


def now():
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def connect():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db():
    with connect() as conn:
        conn.executescript(SCHEMA)


def set_meta(conn, key, value):
    conn.execute(
        "INSERT INTO meta(anahtar, deger) VALUES(?, ?) "
        "ON CONFLICT(anahtar) DO UPDATE SET deger = excluded.deger",
        (key, value),
    )


def get_meta(conn, key):
    row = conn.execute("SELECT deger FROM meta WHERE anahtar = ?", (key,)).fetchone()
    return row["deger"] if row else None


def compute_pivot(conn):
    """Kapsam Tipi × Tamamlanma Durumu sayımları ("Güncel Durum" sayfasının karşılığı)."""
    pivot = {}
    for r in conn.execute(
        "SELECT COALESCE(kapsam_tipi, '(boş)') k, COALESCE(durum, '(boş)') d, COUNT(*) n "
        "FROM tasks GROUP BY 1, 2"
    ):
        pivot.setdefault(r["k"], {})[r["d"]] = r["n"]
    return pivot


def take_snapshot(conn, etiket=None, tarih=None):
    tarih = tarih or now()
    pivot = compute_pivot(conn)
    cur = conn.execute(
        "INSERT INTO snapshots(tarih, etiket, pivot_json) VALUES(?, ?, ?)",
        (tarih, etiket, json.dumps(pivot, ensure_ascii=False)),
    )
    return cur.lastrowid
