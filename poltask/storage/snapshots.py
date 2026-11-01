"""Snapshot'lar ve canlı pivot."""
import json

from poltask.domain.rules import compute_pivot


def current_pivot(conn):
    return compute_pivot((r["kapsam_tipi"], r["durum"]) for r in conn.execute("SELECT kapsam_tipi, durum FROM tasks"))


def insert_snapshot(conn, tarih, etiket, pivot):
    cur = conn.execute(
        "INSERT INTO snapshots(tarih, etiket, pivot_json) VALUES(?, ?, ?)",
        (tarih, etiket, json.dumps(pivot, ensure_ascii=False)),
    )
    return cur.lastrowid


def take_snapshot(conn, etiket, tarih):
    return insert_snapshot(conn, tarih, etiket, current_pivot(conn))


def list_snapshots(conn):
    rows = conn.execute("SELECT * FROM snapshots ORDER BY tarih, id").fetchall()
    return [{**dict(r), "pivot": json.loads(r["pivot_json"])} for r in rows]


def snapshot_dates(conn):
    return [r["tarih"] for r in conn.execute("SELECT tarih FROM snapshots")]


def delete_snapshot(conn, sid):
    conn.execute("DELETE FROM snapshots WHERE id = ?", (sid,))
