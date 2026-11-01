"""Anahtar-değer meta kayıtları (son içe aktarım zamanları)."""


def set_meta(conn, key, value):
    conn.execute(
        "INSERT INTO meta(anahtar, deger) VALUES(?, ?) ON CONFLICT(anahtar) DO UPDATE SET deger = excluded.deger",
        (key, value),
    )


def get_meta(conn, key):
    row = conn.execute("SELECT deger FROM meta WHERE anahtar = ?", (key,)).fetchone()
    return row["deger"] if row else None
