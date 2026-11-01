"""İş kuralları: pivot ("Güncel Durum") ve BR-6 haftalık snapshot kuralı."""
from datetime import date, datetime

BOS = "(boş)"


def compute_pivot(pairs):
    """(kapsam_tipi, durum) çiftlerinden Kapsam Tipi × Durum sayımı; boş değer "(boş)".

    Anahtar sırası SQLite `GROUP BY` (BINARY) sırasıyla aynıdır: kod noktası sırası.
    """
    counts = {}
    for kapsam, durum in pairs:
        key = (kapsam if kapsam is not None else BOS, durum if durum is not None else BOS)
        counts[key] = counts.get(key, 0) + 1
    pivot = {}
    for (k, d), n in sorted(counts.items()):
        pivot.setdefault(k, {})[d] = n
    return pivot


def iso_week(value):
    """'YYYY-MM-DD...' metni, date veya datetime → (ISO yıl, ISO hafta)."""
    if isinstance(value, str):
        value = datetime.strptime(value[:10], "%Y-%m-%d")
    if isinstance(value, datetime):
        value = value.date()
    assert isinstance(value, date)
    return value.isocalendar()[:2]


def needs_weekly_snapshot(has_tasks, snapshot_dates, today):
    """BR-6: iş varsa ve içinde bulunulan ISO haftasına düşen HİÇBİR snapshot yoksa True.

    Yalnızca en son tarihe bakılmaz: gelecek tarihli bir snapshot bu haftayı gizlememeli (review M-2).
    """
    if not has_tasks:
        return False
    week = iso_week(today)
    return not any(iso_week(d) == week for d in snapshot_dates)
