"""PolTask — Linktera iş takip sitesi.  Çalıştırma: python app.py  →  http://localhost:5000"""
import json
import os
import re
import tempfile
import warnings
from datetime import date, datetime

from flask import Flask, abort, jsonify, request, send_file, send_from_directory

from db import FIELD_KEYS, FIELDS, compute_pivot, connect, get_meta, init_db, now, take_snapshot
from exporter import export_workbook
from importer import import_excel, import_opm, normalize_opm

warnings.filterwarnings("ignore", module="openpyxl")

app = Flask(__name__, static_folder="static", static_url_path="/static")
FIELD_TYPES = {k: t for k, _, t in FIELDS}
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def opm_index(conn):
    return {r["kod"]: dict(r) for r in conn.execute("SELECT * FROM opm_tickets")}


def task_dict(row, opm):
    t = dict(row)
    kod = normalize_opm(t.get("opm_no"))
    t["opm"] = opm.get(kod) if kod else None
    return t


def clean_value(key, v):
    if v is None or (isinstance(v, str) and v.strip() == ""):
        return None
    typ = FIELD_TYPES[key]
    if typ == "int":
        try:
            v = int(v)
        except (TypeError, ValueError):
            abort(400, f"{key}: sayı olmalı")
        if key == "yuzde":
            v = max(0, min(100, v))
        return v
    if typ == "date":
        if not DATE_RE.match(str(v)):
            abort(400, f"{key}: tarih YYYY-AA-GG olmalı")
        return str(v)
    return str(v).strip()


@app.errorhandler(400)
def bad_request(e):
    return jsonify(error=e.description), 400


@app.get("/")
def index():
    return send_from_directory(app.static_folder, "index.html")


@app.get("/api/meta")
def meta():
    with connect() as conn:
        return jsonify(
            son_ice_aktarim=get_meta(conn, "son_ice_aktarim"),
            son_opm_aktarim=get_meta(conn, "son_opm_aktarim"),
            opm_sayisi=conn.execute("SELECT COUNT(*) FROM opm_tickets").fetchone()[0],
            is_sayisi=conn.execute("SELECT COUNT(*) FROM tasks").fetchone()[0],
        )


@app.get("/api/tasks")
def list_tasks():
    with connect() as conn:
        opm = opm_index(conn)
        counts = dict(conn.execute("SELECT task_id, COUNT(*) FROM comments GROUP BY task_id").fetchall())
        tasks = []
        for r in conn.execute("SELECT * FROM tasks ORDER BY sira, id"):
            t = task_dict(r, opm)
            t["yorum_sayisi"] = counts.get(t["id"], 0)
            tasks.append(t)
        return jsonify(tasks)


@app.post("/api/tasks")
def create_task():
    data = request.get_json(force=True) or {}
    rec = {k: clean_value(k, data.get(k)) for k in FIELD_KEYS if k != "icerik_tarihce"}
    if not rec.get("konu"):
        abort(400, "KONU zorunlu")
    rec["durum"] = rec.get("durum") or "Başlamadı"
    ts = now()
    with connect() as conn:
        sira = conn.execute("SELECT COALESCE(MAX(sira), 0) + 1 FROM tasks").fetchone()[0]
        cur = conn.execute(
            f"INSERT INTO tasks(sira, {', '.join(rec)}, created_at, updated_at) "
            f"VALUES(?, {', '.join('?' * len(rec))}, ?, ?)",
            [sira] + list(rec.values()) + [ts, ts],
        )
        tid = cur.lastrowid
        conn.execute(
            "INSERT INTO task_history(task_id, alan, eski, yeni, zaman) VALUES(?, '_olusturma', NULL, NULL, ?)",
            (tid, ts),
        )
        return jsonify(task_dict(conn.execute("SELECT * FROM tasks WHERE id = ?", (tid,)).fetchone(), opm_index(conn))), 201


@app.patch("/api/tasks/<int:tid>")
def update_task(tid):
    data = request.get_json(force=True) or {}
    with connect() as conn:
        row = conn.execute("SELECT * FROM tasks WHERE id = ?", (tid,)).fetchone()
        if not row:
            abort(404)
        ts = now()
        changes = {}
        for k, v in data.items():
            if k not in FIELD_KEYS or k == "icerik_tarihce":
                continue
            v = clean_value(k, v)
            if v != row[k]:
                changes[k] = v
                conn.execute(
                    "INSERT INTO task_history(task_id, alan, eski, yeni, zaman) VALUES(?, ?, ?, ?, ?)",
                    (tid, k, None if row[k] is None else str(row[k]), None if v is None else str(v), ts),
                )
        if changes:
            conn.execute(
                f"UPDATE tasks SET {', '.join(f'{k} = ?' for k in changes)}, updated_at = ? WHERE id = ?",
                list(changes.values()) + [ts, tid],
            )
        return jsonify(task_dict(conn.execute("SELECT * FROM tasks WHERE id = ?", (tid,)).fetchone(), opm_index(conn)))


@app.delete("/api/tasks/<int:tid>")
def delete_task(tid):
    with connect() as conn:
        conn.execute("DELETE FROM comments WHERE task_id = ?", (tid,))
        conn.execute("DELETE FROM task_history WHERE task_id = ?", (tid,))
        conn.execute("DELETE FROM tasks WHERE id = ?", (tid,))
    return "", 204


@app.get("/api/tasks/<int:tid>/timeline")
def timeline(tid):
    with connect() as conn:
        items = [
            {"tip": "yorum", **dict(c)}
            for c in conn.execute("SELECT id, metin, zaman, ice_aktarim FROM comments WHERE task_id = ?", (tid,))
        ] + [
            {"tip": "degisiklik", **dict(h)}
            for h in conn.execute("SELECT id, alan, eski, yeni, zaman FROM task_history WHERE task_id = ?", (tid,))
        ]
    items.sort(key=lambda i: (i["zaman"], i["id"]), reverse=True)
    return jsonify(items)


@app.post("/api/tasks/<int:tid>/comments")
def add_comment(tid):
    metin = ((request.get_json(force=True) or {}).get("metin") or "").strip()
    if not metin:
        abort(400, "Yorum boş olamaz")
    with connect() as conn:
        conn.execute("INSERT INTO comments(task_id, metin, zaman) VALUES(?, ?, ?)", (tid, metin, now()))
        conn.execute("UPDATE tasks SET updated_at = ? WHERE id = ?", (now(), tid))
    return "", 201


@app.delete("/api/comments/<int:cid>")
def delete_comment(cid):
    with connect() as conn:
        conn.execute("DELETE FROM comments WHERE id = ?", (cid,))
    return "", 204


def iso_week(ts):
    return datetime.strptime(ts[:10], "%Y-%m-%d").isocalendar()[:2]


@app.get("/api/snapshots")
def list_snapshots():
    with connect() as conn:
        last = conn.execute("SELECT tarih FROM snapshots ORDER BY tarih DESC LIMIT 1").fetchone()
        has_tasks = conn.execute("SELECT 1 FROM tasks LIMIT 1").fetchone()
        # Haftada bir otomatik anlık görüntü: bu hafta hiç alınmadıysa ilk açılışta al
        if has_tasks and (not last or iso_week(last["tarih"]) != date.today().isocalendar()[:2]):
            take_snapshot(conn, "Haftalık otomatik")
        rows = conn.execute("SELECT * FROM snapshots ORDER BY tarih, id").fetchall()
        return jsonify([{**dict(r), "pivot": json.loads(r["pivot_json"])} for r in rows])


@app.post("/api/snapshots")
def create_snapshot():
    etiket = ((request.get_json(silent=True) or {}).get("etiket") or "").strip() or None
    with connect() as conn:
        sid = take_snapshot(conn, etiket or "Elle alındı")
    return jsonify(id=sid), 201


@app.delete("/api/snapshots/<int:sid>")
def delete_snapshot(sid):
    with connect() as conn:
        conn.execute("DELETE FROM snapshots WHERE id = ?", (sid,))
    return "", 204


@app.get("/api/pivot")
def pivot():
    with connect() as conn:
        return jsonify(compute_pivot(conn))


def _upload_to_temp():
    f = request.files.get("file")
    if not f or not f.filename.lower().endswith((".xlsx", ".xlsm")):
        abort(400, "Lütfen .xlsx dosyası seçin")
    fd, path = tempfile.mkstemp(suffix=".xlsx")
    os.close(fd)
    f.save(path)
    return path


@app.post("/api/import/excel")
def upload_excel():
    path = _upload_to_temp()
    try:
        return jsonify(import_excel(path))
    except (KeyError, ValueError) as e:
        abort(400, f"İçe aktarılamadı: {e}")
    finally:
        os.remove(path)


@app.post("/api/import/opm")
def upload_opm():
    path = _upload_to_temp()
    try:
        n = import_opm(path)
    except ValueError as e:
        abort(400, str(e))
    finally:
        os.remove(path)
    with connect() as conn:
        opm = opm_index(conn)
        matched = sum(1 for r in conn.execute("SELECT opm_no FROM tasks") if normalize_opm(r["opm_no"]) in opm)
    return jsonify(opm=n, eslesen=matched)


@app.get("/api/export")
def export():
    with connect() as conn:
        buf = export_workbook(conn)
    name = f"Linktera AltYapı Mevcut Fonksiyon Özet Listesi_{date.today():%Y%m%d}.xlsx"
    return send_file(buf, as_attachment=True, download_name=name,
                     mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")


if __name__ == "__main__":
    init_db()
    app.run(host="127.0.0.1", port=5000, debug=False)
