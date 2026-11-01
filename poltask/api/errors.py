"""HTTP hata eşleme (CB-10): her hata Türkçe {"error": …}; iz, dosya yolu, SQL sızmaz."""
import logging

from flask import jsonify
from werkzeug.exceptions import HTTPException

log = logging.getLogger("poltask")

MAX_UPLOAD_BYTES = 20 * 1024 * 1024  # 20 MiB (docs/security.md)

GENERIC = {
    400: "Geçersiz istek",
    404: "Kayıt bulunamadı",
    405: "Bu işlem desteklenmiyor",
    413: "Dosya çok büyük (en fazla 20 MB)",
    500: "Beklenmeyen bir hata oluştu",
}


def register(app):
    app.config["MAX_CONTENT_LENGTH"] = MAX_UPLOAD_BYTES

    @app.errorhandler(HTTPException)
    def http_error(e):
        code = e.code or 500
        # abort(400, "<Türkçe mesaj>") açıklamayı taşır; werkzeug'un İngilizce varsayılanı genel mesaja döner
        own = e.description if e.description != type(e).description else None
        if code >= 500 or code == 413 or not own:
            msg = GENERIC.get(code, "İstek işlenemedi")
        else:
            msg = own
        return jsonify(error=msg), code

    @app.errorhandler(Exception)
    def unexpected(e):
        log.exception("Beklenmeyen hata")
        return jsonify(error=GENERIC[500]), 500
