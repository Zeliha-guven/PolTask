"""Pivot ("Güncel Durum") — boş değer ve SQLite GROUP BY ile aynı anahtar sırası."""
from poltask.domain.rules import compute_pivot


def test_pivot_counts_and_bos():
    pairs = [("Ek İstek", "Testte"), (None, "Başlamadı"), ("Ek İstek", "Testte"), ("Ana Kapsam", None)]
    assert compute_pivot(pairs) == {
        "(boş)": {"Başlamadı": 1}, "Ana Kapsam": {"(boş)": 1}, "Ek İstek": {"Testte": 2}}


def test_pivot_key_order_is_code_point_order():
    pairs = [("İ", "x"), ("Z", "x"), ("(boş)", "x"), ("A", "Ö"), ("A", "B")]
    p = compute_pivot(pairs)
    assert list(p) == ["(boş)", "A", "Z", "İ"] and list(p["A"]) == ["B", "Ö"]


def test_pivot_empty():
    assert compute_pivot([]) == {}
