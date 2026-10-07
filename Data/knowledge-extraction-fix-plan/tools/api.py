"""Drive the deployed CA API as the provider. The token comes from the environment, never from a file."""
import json, os, ssl, time, urllib.request, urllib.error

BASE = "https://api-ca.dev.clinket.com/api/v1"
# Session scratchpad only - never a repo, an appsettings or a memory entry (CLAUDE.md 19).
_here = os.path.dirname(os.path.abspath(__file__))
# The programme's own secrets folder is the durable home (same pattern as secrets\ca-servicebus.txt, which
# kaudit/kqueue already read). A session scratchpad copy wins if present, so a probe can hold its own token.
_SECRETS = os.path.join(os.path.dirname(_here), "secrets")
def _read(*names):
    for n in names:
        for d in (_here, _SECRETS):
            p = os.path.join(d, n)
            if os.path.exists(p):
                v = open(p, encoding="utf-8").read().strip()
                if v:
                    return v, p
    return None, None

TOKEN, _token_path = _read(".clinket-token", "ca-provider-jwt.txt")
TOKEN = os.environ.get("CLINKET_TOKEN") or TOKEN


_retrying = [False]


# A long probe WILL meet a dropped connection eventually; losing a 40-minute watch to one is not a finding
# about the product. Retries the TRANSPORT only - an HTTP status is an answer and is returned untouched.
_TRANSIENT = (urllib.error.URLError, ConnectionError, TimeoutError, OSError)


def call(method, path, body=None, raw=False, _transport_tries=4):
    data = None if body is None else json.dumps(body).encode("utf-8")
    req = urllib.request.Request(BASE + path, data=data, method=method)
    req.add_header("Authorization", "Bearer " + TOKEN)
    req.add_header("Accept", "application/json")
    if data is not None:
        req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            payload = r.read()
            if raw:
                return r.status, payload
            text = payload.decode("utf-8").strip()
            return r.status, (json.loads(text) if text else None)
    except urllib.error.HTTPError as e:
        if e.code == 401 and not _retrying[0] and refresh_token():
            _retrying[0] = True
            try:
                return call(method, path, body, raw)
            finally:
                _retrying[0] = False  # retried_after_refresh
        payload = e.read()
        try:
            return e.code, json.loads(payload.decode("utf-8"))
        except Exception:
            return e.code, payload.decode("utf-8", "replace")[:600]
    except _TRANSIENT:
        # ‼️ MUST stay BELOW the HTTPError clause: HTTPError is a subclass of URLError, so placed above it
        # this swallowed every 401 and the token could never refresh itself.
        if _transport_tries <= 1:
            raise
        time.sleep(3)
        return call(method, path, body, raw, _transport_tries - 1)


def put_blob(url, data, content_type):
    req = urllib.request.Request(url, data=data, method="PUT")
    req.add_header("x-ms-blob-type", "BlockBlob")
    req.add_header("Content-Type", content_type)
    try:
        with urllib.request.urlopen(req, timeout=300) as r:
            return r.status
    except urllib.error.HTTPError as e:
        return f"{e.code} {e.read().decode('utf-8', 'replace')[:300]}"

IDENTITY = "https://identity-ca.dev.clinket.com/api/v1.0"
_refresh_value, _refresh_path = _read(".clinket-refresh", "ca-provider-refresh.txt")


def refresh_token():
    """Mint a fresh JWT from the stored refresh token, rotating both. Returns True when it worked."""
    global TOKEN, _refresh_value
    if not _refresh_value:
        return False
    body = json.dumps({"token": TOKEN, "refreshToken": _refresh_value}).encode()
    req = urllib.request.Request(IDENTITY + "/auth/token/refresh", data=body, method="POST")
    req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            data = json.loads(r.read().decode()).get("data") or {}
    except urllib.error.HTTPError:
        return False
    if not data.get("token"):
        return False
    TOKEN = data["token"]
    open(_token_path or os.path.join(_SECRETS, "ca-provider-jwt.txt"), "w", encoding="utf-8").write(TOKEN)
    # ‼️ A REFRESH TOKEN IS SINGLE-USE AND ROTATES. Reusing a spent one triggers RevokeAllOnReuse and
    # kills every session on the account. Persist the new one IMMEDIATELY or the next call is locked out.
    if data.get("refreshToken"):
        _refresh_value = data["refreshToken"]
        open(_refresh_path or os.path.join(_SECRETS, "ca-provider-refresh.txt"), "w", encoding="utf-8").write(_refresh_value)
    return True
