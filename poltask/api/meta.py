"""GET /api/meta — son aktarımlar, sayılar; alan ve değer listeleri (tek tanım: domain, CB-8)."""
from flask import Blueprint, jsonify

from poltask.api.context import db
from poltask.domain import fields
from poltask.storage import meta as meta_store
from poltask.storage import opm as opm_store
from poltask.storage import tasks as task_store

bp = Blueprint("meta", __name__)


@bp.get("/api/meta")
def get_meta():
    with db() as conn:
        return jsonify(
            son_ice_aktarim=meta_store.get_meta(conn, "son_ice_aktarim"),
            son_opm_aktarim=meta_store.get_meta(conn, "son_opm_aktarim"),
            opm_sayisi=opm_store.count_opm(conn),
            is_sayisi=task_store.count_tasks(conn),
            alanlar=fields.meta_fields(),
            durumlar=fields.DURUMLAR,
            kapsam_tipleri=fields.KAPSAM_TIPLERI,
            sozlesme_degerleri=fields.SOZLESME_DEGERLERI,
            kapali_durumlar=fields.KAPALI_DURUMLAR,
            varsayilan_durum=fields.DEFAULT_DURUM,
        )
