"""Excel/OPM içe aktarım ve Excel dışa aktarım uç noktaları + içe aktarım orkestrasyonu."""
import logging
import os
import tempfile

from flask import Blueprint, abort, current_app, jsonify, request, send_file

from poltask.api.context import db, now, now_ts
from poltask.domain.clock import format_ts
from poltask.integrations.cleaning import normalize_opm
from poltask.integrations.errors import ImportFormatError, UnreadableFileError
from poltask.integrations.excel_export import build_workbook
from poltask.integrations.excel_import import read_excel_file
from poltask.integrations.opm_import import read_opm_file
from poltask.storage import database, snapshots
from poltask.storage import meta as meta_store
from poltask.storage import opm as opm_store
from poltask.storage import tasks as task_store

bp = Blueprint("transfer", __name__)

log = logging.getLogger("poltask")
UNREADABLE = "Dosya okunamadı; geçerli bir .xlsx değil"

XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


def import_excel_file(db_path, path, clock):
    """BR-4: dosya önce tamamen okunur ve kapanır, sonra tek işlemde tüm veri değiştirilir."""
    when = clock()
    parsed = read_excel_file(path, when.year)
    ts = format_ts(when)
    with database.connect(db_path) as conn:
        n_tasks = task_store.replace_all(conn, parsed.tasks, ts)
        for tarih, etiket, pivot in parsed.history:
            snapshots.insert_snapshot(conn, tarih, etiket, pivot)
        snapshots.take_snapshot(conn, "İçe aktarım", ts)
        n_opm = None
        if parsed.opm is not None:
            n_opm = opm_store.replace_opm(conn, parsed.opm)
            meta_store.set_meta(conn, "son_opm_aktarim", ts)
        meta_store.set_meta(conn, "son_ice_aktarim", ts)
    return {"isler": n_tasks, "gecmis_ozet": len(parsed.history), "opm": n_opm}


def _upload_to_temp():
    f = request.files.get("file")
    if not f or not f.filename.lower().endswith((".xlsx", ".xlsm")):
        abort(400, "Lütfen .xlsx dosyası seçin")
    fd, path = tempfile.mkstemp(suffix=".xlsx", dir=current_app.config["UPLOAD_DIR"])
    os.close(fd)
    f.save(path)
    return path


@bp.post("/api/import/excel")
def upload_excel():
    path = _upload_to_temp()
    try:
        result = import_excel_file(current_app.config["DB_PATH"], path, current_app.config["CLOCK"])
    except ImportFormatError as e:
        abort(400, f"İçe aktarılamadı: {e}")
    except UnreadableFileError as e:
        log.warning("Excel okunamadı: %s", e)
        abort(400, UNREADABLE)
    finally:
        os.remove(path)
    return jsonify(result)


@bp.post("/api/import/opm")
def upload_opm():
    path = _upload_to_temp()
    try:
        records = read_opm_file(path)
    except ImportFormatError as e:
        abort(400, str(e))
    except UnreadableFileError as e:
        log.warning("OPM dosyası okunamadı: %s", e)
        abort(400, UNREADABLE)
    finally:
        os.remove(path)
    with db() as conn:
        n = opm_store.replace_opm(conn, records)
        meta_store.set_meta(conn, "son_opm_aktarim", now_ts())
        opm = opm_store.opm_index(conn)
        matched = sum(1 for o in task_store.all_opm_nos(conn) if normalize_opm(o) in opm)
    return jsonify(opm=n, eslesen=matched)


@bp.get("/api/export")
def export():
    with db() as conn:
        buf = build_workbook(snapshots.current_pivot(conn), task_store.list_tasks(conn),
                             task_store.comments_for_export(conn))
    name = f"Linktera AltYapı Mevcut Fonksiyon Özet Listesi_{now():%Y%m%d}.xlsx"
    return send_file(buf, as_attachment=True, download_name=name, mimetype=XLSX_MIME)
