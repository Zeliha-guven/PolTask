"""I-1 — gerçek veri klasörünün parmak izi dedektörü kendisi de çalışıyor mu."""
import os

from tests.support import data_dir_fingerprint


def test_fingerprint_detects_content_size_and_new_files(tmp_path):
    d = tmp_path / "data"
    d.mkdir()
    db = d / "poltask.db"
    db.write_bytes(b"abc")
    base = data_dir_fingerprint(d)
    assert data_dir_fingerprint(d) == base  # okuma değiştirmez
    st = db.stat()
    db.write_bytes(b"abd")  # aynı boyut, farklı içerik
    os.utime(db, ns=(st.st_atime_ns, st.st_mtime_ns))  # mtime da geri alınsa bile
    assert data_dir_fingerprint(d) != base
    db.write_bytes(b"abc")
    os.utime(db, ns=(st.st_atime_ns, st.st_mtime_ns))
    assert data_dir_fingerprint(d) == base
    (d / "poltask.db-journal").write_bytes(b"")
    assert data_dir_fingerprint(d) != base


def test_fingerprint_missing_dir_is_none(tmp_path):
    assert data_dir_fingerprint(tmp_path / "yok") is None
