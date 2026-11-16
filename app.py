import os
import re
import secrets
import sqlite3
from datetime import date, datetime, timedelta, timezone

from flask import Flask, g, jsonify, request, send_from_directory, session
from werkzeug.security import check_password_hash, generate_password_hash

BASE = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.environ.get("DB_PATH", os.path.join(BASE, "speaksafe.db"))
ITSB = re.compile(r"^[^@\s]+@([a-z0-9-]+\.)*itsb\.ac\.id$")


def load_secret_key():
    key = os.environ.get("SECRET_KEY")
    if key:
        return key
    path = os.path.join(BASE, "secret.key")
    try:
        fd = os.open(path, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
        with os.fdopen(fd, "w") as f:
            f.write(secrets.token_hex(32))
    except FileExistsError:
        pass
    with open(path) as f:
        return f.read().strip()


app = Flask(__name__)
app.config.update(
    SECRET_KEY=load_secret_key(),
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE="Lax",
    SESSION_COOKIE_SECURE=os.environ.get("COOKIE_SECURE") == "1",
    PERMANENT_SESSION_LIFETIME=timedelta(days=7),
    MAX_CONTENT_LENGTH=64 * 1024,
)

SCHEMA = """
CREATE TABLE IF NOT EXISTS users(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  pw_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'mahasiswa',
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS reports(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  no TEXT NOT NULL UNIQUE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  anon INTEGER NOT NULL,
  jenis TEXT NOT NULL,
  tgl TEXT NOT NULL,
  lok TEXT NOT NULL,
  kron TEXT NOT NULL,
  ket TEXT NOT NULL DEFAULT '',
  status INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS comments(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  report_id INTEGER NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  author_role TEXT NOT NULL,
  user_id INTEGER REFERENCES users(id),
  body TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_reports_user ON reports(user_id);
CREATE INDEX IF NOT EXISTS idx_comments_report ON comments(report_id);
"""


def init_db():
    con = sqlite3.connect(DB_PATH)
    con.executescript(SCHEMA)
    con.commit()
    con.close()


init_db()


def db():
    if "db" not in g:
        g.db = sqlite3.connect(DB_PATH, timeout=10)
        g.db.row_factory = sqlite3.Row
        g.db.execute("PRAGMA foreign_keys=ON")
    return g.db


@app.teardown_appcontext
def close_db(_):
    con = g.pop("db", None)
    if con is not None:
        con.close()


def now_iso():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def err(msg, code):
    return jsonify(error=msg), code


@app.before_request
def require_json():
    if request.method == "POST" and request.path.startswith("/api/") and not request.is_json:
        return err("Permintaan tidak valid.", 415)


@app.after_request
def headers(resp):
    resp.headers["X-Content-Type-Options"] = "nosniff"
    resp.headers["X-Frame-Options"] = "DENY"
    resp.headers["Referrer-Policy"] = "same-origin"
    if request.path.startswith("/api/") or request.path == "/":
        resp.headers["Cache-Control"] = "no-store"
    return resp


def current_user():
    uid = session.get("uid")
    if not uid:
        return None
    return db().execute("SELECT id, name, email, role FROM users WHERE id=?", (uid,)).fetchone()


def clean(data, key, maxlen):
    v = data.get(key, "")
    return v.strip()[:maxlen] if isinstance(v, str) else ""


# ---------- halaman ----------
@app.get("/")
def index():
    return send_from_directory(os.path.join(BASE, "templates"), "index.html")


@app.get("/healthz")
def healthz():
    return "ok"


# ---------- akun ----------
@app.get("/api/check-email")
def check_email():
    email = request.args.get("email", "").strip().lower()
    row = db().execute("SELECT 1 FROM users WHERE email=?", (email,)).fetchone()
    return jsonify(exists=bool(row))


@app.post("/api/register")
def register():
    d = request.get_json(silent=True) or {}
    name = clean(d, "name", 100)
    email = clean(d, "email", 150).lower()
    pw = d.get("password") if isinstance(d.get("password"), str) else ""
    if not name or not email or not pw:
        return err("Semua kolom wajib diisi.", 400)
    if not ITSB.match(email):
        return err("Gunakan email kampus ITSB (@itsb.ac.id).", 400)
    if len(pw) < 8 or len(pw) > 128:
        return err("Password minimal 8 karakter.", 400)
    con = db()
    if con.execute("SELECT 1 FROM users WHERE email=?", (email,)).fetchone():
        return err("Email ini sudah terdaftar.", 409)
    try:
        con.execute(
            "INSERT INTO users(name,email,pw_hash,created_at) VALUES(?,?,?,?)",
            (name, email, generate_password_hash(pw), now_iso()),
        )
        con.commit()
    except sqlite3.IntegrityError:
        return err("Email ini sudah terdaftar.", 409)
    return jsonify(ok=True), 201


@app.post("/api/login")
def login():
    d = request.get_json(silent=True) or {}
    email = clean(d, "email", 150).lower()
    pw = d.get("password") if isinstance(d.get("password"), str) else ""
    if not email or not pw:
        return err("Email dan password wajib diisi.", 400)
    if not ITSB.match(email):
        return err("Email tidak terverifikasi. Gunakan email kampus ITSB.", 400)
    u = db().execute("SELECT * FROM users WHERE email=?", (email,)).fetchone()
    if not u:
        return err("Email belum terdaftar. Silakan registrasi dulu.", 404)
    if not check_password_hash(u["pw_hash"], pw):
        return err("Password salah.", 401)
    session.clear()
    session["uid"] = u["id"]
    session.permanent = True
    return jsonify(user={"name": u["name"], "email": u["email"]})


@app.post("/api/logout")
def logout():
    session.clear()
    return jsonify(ok=True)


@app.get("/api/me")
def me():
    u = current_user()
    if not u:
        return err("Belum login.", 401)
    return jsonify(user={"name": u["name"], "email": u["email"]})


# ---------- laporan ----------
def report_dict(r, comments):
    return {
        "no": r["no"],
        "anon": bool(r["anon"]),
        "jenis": r["jenis"],
        "tgl": r["tgl"],
        "lok": r["lok"],
        "kron": r["kron"],
        "ket": r["ket"],
        "stage": r["status"],
        "dibuat": r["created_at"],
        "cms": [{"me": c["author_role"] == "mahasiswa", "t": c["body"], "at": c["created_at"]} for c in comments],
    }


@app.get("/api/reports")
def list_reports():
    u = current_user()
    if not u:
        return err("Sesi berakhir. Silakan login lagi.", 401)
    con = db()
    rows = con.execute("SELECT * FROM reports WHERE user_id=? ORDER BY id DESC", (u["id"],)).fetchall()
    by_report = {r["id"]: [] for r in rows}
    if rows:
        marks = ",".join("?" * len(rows))
        for c in con.execute(
            f"SELECT * FROM comments WHERE report_id IN ({marks}) ORDER BY id", [r["id"] for r in rows]
        ):
            by_report[c["report_id"]].append(c)
    return jsonify(reports=[report_dict(r, by_report[r["id"]]) for r in rows])


@app.post("/api/reports")
def create_report():
    u = current_user()
    if not u:
        return err("Sesi berakhir. Silakan login lagi.", 401)
    d = request.get_json(silent=True) or {}
    jenis, lok = clean(d, "jenis", 120), clean(d, "lok", 200)
    kron, ket = clean(d, "kron", 5000), clean(d, "ket", 3000)
    tgl = clean(d, "tgl", 10)
    if not jenis or not lok or not kron or not tgl:
        return err("Tanggal, lokasi, dan kronologi wajib diisi.", 400)
    try:
        tanggal = datetime.strptime(tgl, "%Y-%m-%d").date()
    except ValueError:
        return err("Format tanggal tidak valid.", 400)
    if tanggal > date.today() + timedelta(days=1):
        return err("Tanggal kejadian tidak boleh di masa depan.", 400)
    anon = 1 if d.get("anon") is True else 0
    con = db()
    cur = con.execute(
        "INSERT INTO reports(no,user_id,anon,jenis,tgl,lok,kron,ket,status,created_at) VALUES(?,?,?,?,?,?,?,?,1,?)",
        ("tmp-" + secrets.token_hex(6), u["id"], anon, jenis, tgl, lok, kron, ket, now_iso()),
    )
    no = f"SS-{datetime.now().year}-{cur.lastrowid:04d}"
    con.execute("UPDATE reports SET no=? WHERE id=?", (no, cur.lastrowid))
    con.commit()
    row = con.execute("SELECT * FROM reports WHERE id=?", (cur.lastrowid,)).fetchone()
    return jsonify(report=report_dict(row, [])), 201


@app.post("/api/reports/<no>/comments")
def add_comment(no):
    u = current_user()
    if not u:
        return err("Sesi berakhir. Silakan login lagi.", 401)
    con = db()
    r = con.execute("SELECT id FROM reports WHERE no=? AND user_id=?", (no, u["id"])).fetchone()
    if not r:
        return err("Laporan tidak ditemukan.", 404)
    text = clean(request.get_json(silent=True) or {}, "text", 1000)
    if not text:
        return err("Komentar tidak boleh kosong.", 400)
    ts = now_iso()
    con.execute(
        "INSERT INTO comments(report_id,author_role,user_id,body,created_at) VALUES(?,?,?,?,?)",
        (r["id"], "mahasiswa", u["id"], text, ts),
    )
    con.commit()
    return jsonify(comment={"me": True, "t": text, "at": ts}), 201


if __name__ == "__main__":
    app.run(debug=True)
