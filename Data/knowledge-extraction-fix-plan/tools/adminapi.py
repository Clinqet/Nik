"""Drive the deployed CA API as ADMIN. Token from the session scratchpad only - never a repo (CLAUDE.md 19)."""
import json, os, urllib.request, urllib.error
BASE = "https://api-ca.dev.clinket.com/api/v1"
_here = os.path.dirname(os.path.abspath(__file__))
# Same durable home as toolspi.py: the programme's secrets folder, with a scratchpad copy winning if a
# session keeps its own. The admin token has NO refresh stored - ask the owner when it expires.
_SECRETS = os.path.join(os.path.dirname(_here), "secrets")
def _read(*names):
    for n in names:
        for d in (_here, _SECRETS):
            p = os.path.join(d, n)
            if os.path.exists(p):
                v = open(p, encoding="utf-8").read().strip()
                if v:
                    return v
    raise FileNotFoundError(
        "No admin token. Put it in %s\ca-admin-jwt.txt (ask the owner - admin tokens have no refresh)." % _SECRETS)

TOKEN = os.environ.get("CLINKET_ADMIN_TOKEN") or _read(".clinket-admin-token", "ca-admin-jwt.txt")

def call(method, path, body=None):
    data = None if body is None else json.dumps(body).encode("utf-8")
    req = urllib.request.Request(BASE + path, data=data, method=method)
    req.add_header("Authorization", "Bearer " + TOKEN)
    req.add_header("Accept", "application/json")
    if data is not None: req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            t = r.read().decode("utf-8").strip()
            return r.status, (json.loads(t) if t else None)
    except urllib.error.HTTPError as e:
        p = e.read()
        try: return e.code, json.loads(p.decode("utf-8"))
        except Exception: return e.code, p.decode("utf-8", "replace")[:400]
