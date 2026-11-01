"""İstek bağlamı: veritabanı bağlantısı ve enjekte edilen saat."""
from flask import current_app

from poltask.domain.clock import format_ts
from poltask.storage import database


def db():
    return database.connect(current_app.config["DB_PATH"])


def now():
    return current_app.config["CLOCK"]()


def now_ts():
    return format_ts(now())
