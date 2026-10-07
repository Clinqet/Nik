# -*- coding: utf-8 -*-
import json, io, urllib.request, urllib.error, math

_cfg = json.load(io.open(r'C:\Nik\clinqetfuncations\Clinqet.Communications\appsettings.json', encoding='utf-8-sig'))
_f = _cfg['AzureAIFoundry']
BASE = _f['ApiUrl'].rstrip('/')
KEY = _f['ApiKey']
MODEL = _f['EmbeddingModel']
VER = _f['ApiVersion']
DIMS = int(_f['EmbeddingDimensions'])

def embed(texts):
    url = "%s/openai/deployments/%s/embeddings?api-version=%s" % (BASE, MODEL, VER)
    body = json.dumps({"input": texts, "dimensions": DIMS}).encode('utf-8')
    req = urllib.request.Request(url, data=body, method='POST')
    req.add_header('api-key', KEY)
    req.add_header('Content-Type', 'application/json')
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            d = json.loads(r.read().decode('utf-8'))
            return [x['embedding'] for x in sorted(d['data'], key=lambda e: e['index'])]
    except urllib.error.HTTPError as e:
        raise SystemExit("embed HTTP %s: %s" % (e.code, e.read().decode('utf-8', 'replace')[:400]))

def cos(a, b):
    dot = sum(x*y for x, y in zip(a, b))
    na = math.sqrt(sum(x*x for x in a)); nb = math.sqrt(sum(y*y for y in b))
    return dot / (na*nb) if na and nb else 0.0
