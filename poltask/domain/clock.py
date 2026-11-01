"""Saat enjeksiyonu: saat = argümansız, datetime dönen bir çağrılabilir (Europe/Istanbul yerel saat)."""
from collections.abc import Callable
from datetime import datetime

Clock = Callable[[], datetime]

TS_FORMAT = "%Y-%m-%d %H:%M:%S"


def system_clock():
    return datetime.now()


def format_ts(dt):
    return dt.strftime(TS_FORMAT)
