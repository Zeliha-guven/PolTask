"""HTTP yardımcıları (yalnızca public API üzerinden)."""
import io


def create_task(client, **fields):
    body = {"konu": "İş", **fields}
    r = client.post("/api/tasks", json=body)
    assert r.status_code == 201, r.get_json()
    return r.get_json()


def upload(client, url, path, name="dosya.xlsx"):
    with open(path, "rb") as f:
        data = f.read()
    return client.post(url, data={"file": (io.BytesIO(data), name)}, content_type="multipart/form-data")


def tasks(client):
    r = client.get("/api/tasks")
    assert r.status_code == 200
    return r.get_json()


def timeline(client, tid):
    r = client.get(f"/api/tasks/{tid}/timeline")
    assert r.status_code == 200
    return r.get_json()
