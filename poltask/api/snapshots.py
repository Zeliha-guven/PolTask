"""Snapshot'lar ve pivot."""
from flask import Blueprint, jsonify, request

from poltask.api.context import db, now, now_ts
from poltask.domain.rules import needs_weekly_snapshot
from poltask.storage import snapshots as snap_store
from poltask.storage import tasks as task_store

bp = Blueprint("snapshots", __name__)


@bp.get("/api/snapshots")
def list_snapshots():
    """Saf okuma (CB-5): haftalık snapshot artık açık bir POST ile alınır."""
    with db() as conn:
        rows = snap_store.list_snapshots(conn)
    return jsonify(rows)


@bp.post("/api/snapshots/haftalik")
def weekly_snapshot():
    """BR-6 / CB-6: iş varsa ve bu ISO haftasında snapshot yoksa tek bir 'Haftalık otomatik' alır."""
    with db() as conn:
        if not needs_weekly_snapshot(task_store.has_tasks(conn), snap_store.snapshot_dates(conn), now()):
            return jsonify(alindi=False, id=None), 200
        sid = snap_store.take_snapshot(conn, "Haftalık otomatik", now_ts())
    return jsonify(alindi=True, id=sid), 201


@bp.post("/api/snapshots")
def create_snapshot():
    etiket = ((request.get_json(silent=True) or {}).get("etiket") or "").strip() or None
    with db() as conn:
        sid = snap_store.take_snapshot(conn, etiket or "Elle alındı", now_ts())
    return jsonify(id=sid), 201


@bp.delete("/api/snapshots/<int:sid>")
def delete_snapshot(sid):
    with db() as conn:
        snap_store.delete_snapshot(conn, sid)
    return "", 204


@bp.get("/api/pivot")
def pivot():
    with db() as conn:
        return jsonify(snap_store.current_pivot(conn))
