"""BR-6 (unit) — her ISO haftasında en az bir snapshot."""
from datetime import date, datetime

from poltask.domain.rules import iso_week, needs_weekly_snapshot

TODAY = datetime(2026, 11, 4, 10, 0)  # ISO 2026-W45


def test_br6_needs_snapshot_when_none_exists():
    assert needs_weekly_snapshot(True, [], TODAY)


def test_br6_needs_snapshot_when_last_is_previous_week():
    assert needs_weekly_snapshot(True, ["2026-11-01 23:59:59"], TODAY)  # Pazar, W44


def test_br6_no_snapshot_when_this_week_has_one():
    assert not needs_weekly_snapshot(True, ["2026-11-02 00:00:00"], TODAY)  # Pazartesi, W45


def test_br6_no_snapshot_without_tasks():
    assert not needs_weekly_snapshot(False, [], TODAY)


def test_iso_week_year_boundary():
    assert iso_week("2026-12-31") == (2026, 53) and iso_week(date(2027, 1, 3)) == (2026, 53)
    assert iso_week(datetime(2027, 1, 4)) == (2027, 1)


def test_br6_any_snapshot_in_week_counts_not_only_the_latest():
    """M-2: en son tarihli snapshot gelecekte olsa bile bu haftadaki snapshot sayılır."""
    dates = ["2026-11-03 09:00:00", "2027-12-23 00:00:00"]
    assert not needs_weekly_snapshot(True, dates, TODAY)
    assert needs_weekly_snapshot(True, ["2027-12-23 00:00:00", "2026-10-28 00:00:00"], TODAY)
