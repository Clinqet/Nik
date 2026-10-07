import json, io, urllib.request, urllib.error

_cfg = json.load(io.open(r'C:\Nik\cosmosindexsetup\appsettings.ca.json', encoding='utf-8-sig'))
ENDPOINT = _cfg['Search']['ServiceEndpoint'].rstrip('/')
KEY = _cfg['Search']['ApiKey']
API = '2024-07-01'
# P4-I-02: since search topology Phase 2 the knowledge index is the private cell alias (clinket-knowledge-dev-* are gone).
ALIAS = 'private-knowledge-cell1-dev'
# ‼️ Aliases resolve on GET index and on QUERIES, but 2024-07-01 does not resolve one for docs/search on
# this service; the newer version does. The Analyze API never resolves an alias - use PHYS for that.
QUERY_API = '2026-04-01'
PHYS = 'private-knowledge-cell1-dev-v2'

def call(path, body=None, method=None, api=API):
    url = "%s/%s?api-version=%s" % (ENDPOINT, path.lstrip('/'), api)
    data = json.dumps(body).encode('utf-8') if body is not None else None
    m = method or ('POST' if data else 'GET')
    req = urllib.request.Request(url, data=data, method=m)
    req.add_header('api-key', KEY)
    if data: req.add_header('Content-Type', 'application/json')
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            raw = r.read().decode('utf-8')
            return r.status, (json.loads(raw) if raw else None)
    except urllib.error.HTTPError as e:
        raw = e.read().decode('utf-8', 'replace')
        try: return e.code, json.loads(raw)
        except Exception: return e.code, raw
