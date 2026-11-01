"""İşler, zaman çizelgesi ve yorumlar."""
from flask import Blueprint, abort, jsonify, request

from poltask.api.context import db, now_ts
from poltask.api.validation import clean_create, clean_update
from poltask.domain.fields import DEFAULT_DURUM
from poltask.integrations.cleaning import normalize_opm
from poltask.storage import opm as opm_store
from poltask.storage import tasks as task_store

bp = Blueprint("tasks", __name__)


def task_dict(row, opm):
    t = dict(row)
    kod = normalize_opm(t.get("opm_no"))
    t["opm"] = opm.get(kod) if kod else None
    return t


def _json_body():
    data = request.get_json(force=True, silent=True)
    if data is None:
        if request.get_data():
            abort(400, "İstek gövdesi geçerli JSON değil")
        return {}
    if not isinstance(data, dict):
        abort(400, "İstek gövdesi bir JSON nesnesi olmalı")
    return data


@bp.get("/api/tasks")
def list_tasks():
    with db() as conn:
        opm = opm_store.opm_index(conn)
        counts = task_store.comment_counts(conn)
        out = []
        for r in task_store.list_tasks(conn):
            t = task_dict(r, opm)
            t["yorum_sayisi"] = counts.get(t["id"], 0)
            out.append(t)
    return jsonify(out)


@bp.post("/api/tasks")
def create_task():
    data = _json_body()
    rec = clean_create(data)
    if not rec.get("konu"):
        abort(400, "KONU zorunlu")
    rec["durum"] = rec.get("durum") or DEFAULT_DURUM
    with db() as conn:
        tid = task_store.create_task(conn, rec, now_ts())
        body = task_dict(task_store.get_task(conn, tid), opm_store.opm_index(conn))
    return jsonify(body), 201


@bp.patch("/api/tasks/<int:tid>")
def update_task(tid):
    data = _json_body()
    with db() as conn:
        row = task_store.get_task(conn, tid)
        if not row:
            abort(404)
        values = clean_update(data)
        task_store.update_task(conn, row, values, now_ts())
        body = task_dict(task_store.get_task(conn, tid), opm_store.opm_index(conn))
    return jsonify(body)


@bp.delete("/api/tasks/<int:tid>")
def delete_task(tid):
    with db() as conn:
        task_store.delete_task(conn, tid)
    return "", 204


@bp.get("/api/tasks/<int:tid>/timeline")
def timeline(tid):
    with db() as conn:
        items = task_store.timeline(conn, tid)
    return jsonify(items)


@bp.post("/api/tasks/<int:tid>/comments")
def add_comment(tid):
    metin = (_json_body().get("metin") or "").strip()
    if not metin:
        abort(400, "Yorum boş olamaz")
    with db() as conn:
        task_store.add_comment(conn, tid, metin, now_ts())
    return "", 201


@bp.delete("/api/comments/<int:cid>")
def delete_comment(cid):
    with db() as conn:
        task_store.delete_comment(conn, cid)
    return "", 204
