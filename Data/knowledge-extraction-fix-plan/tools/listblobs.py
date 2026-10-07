import base64, hashlib, hmac, io, re, sys, urllib.request, urllib.error
from datetime import datetime, timezone

conn = io.open(sys.argv[1], encoding="utf-8").read().strip()
acct = re.search(r"AccountName=([^;]+)", conn).group(1)
key  = base64.b64decode(re.search(r"AccountKey=([^;]+)", conn).group(1))
container, prefix = sys.argv[2], sys.argv[3]

ver, now = "2021-08-06", datetime.now(timezone.utc).strftime("%a, %d %b %Y %H:%M:%S GMT")
q = {"comp": "list", "prefix": prefix, "restype": "container"}
canon_res = "/%s/%s\n%s" % (acct, container, "\n".join("%s:%s" % (k, q[k]) for k in sorted(q)))
sts = "\n".join(["GET", "", "", "", "", "", "", "", "", "", "", "",
                 "x-ms-date:%s\nx-ms-version:%s" % (now, ver), canon_res])
sig = base64.b64encode(hmac.new(key, sts.encode("utf-8"), hashlib.sha256).digest()).decode()

url = "https://%s.blob.core.windows.net/%s?%s" % (
    acct, container, urllib.parse.urlencode({"restype": "container", "comp": "list", "prefix": prefix}))
req = urllib.request.Request(url)
req.add_header("x-ms-date", now); req.add_header("x-ms-version", ver)
req.add_header("Authorization", "SharedKey %s:%s" % (acct, sig))
try:
    body = urllib.request.urlopen(req, timeout=60).read().decode("utf-8")
except urllib.error.HTTPError as e:
    print("HTTP", e.code, e.read().decode("utf-8", "replace")[:300]); raise SystemExit(1)
names = re.findall(r"<Name>(.*?)</Name>", body)
print("prefix '%s' -> %d blob(s)" % (prefix, len(names)))
for n in names[:25]: print("   ", n)
