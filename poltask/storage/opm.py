"""OPM ticket'ları."""


def opm_index(conn):
    return {r["kod"]: dict(r) for r in conn.execute("SELECT * FROM opm_tickets")}


def count_opm(conn):
    return conn.execute("SELECT COUNT(*) FROM opm_tickets").fetchone()[0]


def replace_opm(conn, records):
    conn.execute("DELETE FROM opm_tickets")
    for rec in records:
        conn.execute(
            f"INSERT OR REPLACE INTO opm_tickets({', '.join(rec)}) VALUES({', '.join('?' * len(rec))})",
            list(rec.values()),
        )
    return len(records)
