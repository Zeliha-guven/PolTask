"""İşler, tarihçe ve yorumlar. Doğrulanmış veri alır; zaman damgası (ts) çağırandan gelir."""
from poltask.domain.fields import FIELD_KEYS


def list_tasks(conn):
    return conn.execute("SELECT * FROM tasks ORDER BY sira, id").fetchall()


def comment_counts(conn):
    return dict(conn.execute("SELECT task_id, COUNT(*) FROM comments GROUP BY task_id").fetchall())


def get_task(conn, tid):
    return conn.execute("SELECT * FROM tasks WHERE id = ?", (tid,)).fetchone()


def all_opm_nos(conn):
    return [r["opm_no"] for r in conn.execute("SELECT opm_no FROM tasks")]


def count_tasks(conn):
    return conn.execute("SELECT COUNT(*) FROM tasks").fetchone()[0]


def has_tasks(conn):
    return conn.execute("SELECT 1 FROM tasks LIMIT 1").fetchone() is not None


def create_task(conn, rec, ts):
    """Yeni iş (sıra = en büyük + 1) ve `_olusturma` tarihçe kaydı; yeni id döner."""
    sira = conn.execute("SELECT COALESCE(MAX(sira), 0) + 1 FROM tasks").fetchone()[0]
    cur = conn.execute(
        f"INSERT INTO tasks(sira, {', '.join(rec)}, created_at, updated_at) "
        f"VALUES(?, {', '.join('?' * len(rec))}, ?, ?)",
        [sira, *rec.values(), ts, ts],
    )
    tid = cur.lastrowid
    conn.execute(
        "INSERT INTO task_history(task_id, alan, eski, yeni, zaman) VALUES(?, '_olusturma', NULL, NULL, ?)",
        (tid, ts),
    )
    return tid


def update_task(conn, row, values, ts):
    """Değeri değişen her alan için tarihçe yazar ve işi günceller; değişen alanları döner."""
    changes = {k: v for k, v in values.items() if v != row[k]}
    for k, v in changes.items():
        conn.execute(
            "INSERT INTO task_history(task_id, alan, eski, yeni, zaman) VALUES(?, ?, ?, ?, ?)",
            (row["id"], k, None if row[k] is None else str(row[k]), None if v is None else str(v), ts),
        )
    if changes:
        conn.execute(
            f"UPDATE tasks SET {', '.join(f'{k} = ?' for k in changes)}, updated_at = ? WHERE id = ?",
            [*changes.values(), ts, row["id"]],
        )
    return changes


def delete_task(conn, tid):
    conn.execute("DELETE FROM comments WHERE task_id = ?", (tid,))
    conn.execute("DELETE FROM task_history WHERE task_id = ?", (tid,))
    conn.execute("DELETE FROM tasks WHERE id = ?", (tid,))


def timeline(conn, tid):
    """Yorumlar + değişiklikler, yeniden eskiye."""
    items = [
        {"tip": "yorum", **dict(c)}
        for c in conn.execute("SELECT id, metin, zaman, ice_aktarim FROM comments WHERE task_id = ?", (tid,))
    ] + [
        {"tip": "degisiklik", **dict(h)}
        for h in conn.execute("SELECT id, alan, eski, yeni, zaman FROM task_history WHERE task_id = ?", (tid,))
    ]
    items.sort(key=lambda i: (i["zaman"], i["id"]), reverse=True)
    return items


def add_comment(conn, tid, metin, ts):
    conn.execute("INSERT INTO comments(task_id, metin, zaman) VALUES(?, ?, ?)", (tid, metin, ts))
    conn.execute("UPDATE tasks SET updated_at = ? WHERE id = ?", (ts, tid))


def delete_comment(conn, cid):
    conn.execute("DELETE FROM comments WHERE id = ?", (cid,))


def comments_for_export(conn):
    return [dict(r) for r in conn.execute("SELECT task_id, metin, zaman, ice_aktarim FROM comments ORDER BY zaman, id")]


def replace_all(conn, items, ts):
    """BR-4: işler, tarihçe, yorumlar ve snapshot'lar silinir; `items` = [(kayıt, tarihçe metni)]."""
    for t in ("tasks", "task_history", "comments", "snapshots"):
        conn.execute(f"DELETE FROM {t}")
    conn.execute("DELETE FROM sqlite_sequence WHERE name IN ('tasks','task_history','comments','snapshots')")
    for sira, (rec, tarihce) in enumerate(items, start=1):
        cur = conn.execute(
            f"INSERT INTO tasks(sira, {', '.join(FIELD_KEYS)}, created_at, updated_at) "
            f"VALUES(?, {', '.join('?' * len(FIELD_KEYS))}, ?, ?)",
            [sira, *(rec[k] for k in FIELD_KEYS), ts, ts],
        )
        if tarihce:
            conn.execute(
                "INSERT INTO comments(task_id, metin, zaman, ice_aktarim) VALUES(?, ?, ?, 1)",
                (cur.lastrowid, tarihce, ts),
            )
    return len(items)
