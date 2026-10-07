import sys, os, time, urllib.parse
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import api
try:
    import adminapi
except Exception as _e:          # an expired/absent admin token must never kill the run watch
    adminapi = None

DOC = open(r"C:\Users\NIK~1.ADH\AppData\Local\Temp\claude\C--Nik\63c1b746-67bb-4e54-a298-549d7efdf9ab\scratchpad\k1000_docid.txt").read().strip()
SINCE = "2026-09-15T05:10"
print("watching the 1000-line document on the new build:", DOC, flush=True)
start = time.time()

def alerts():
    if adminapi is None:
        return [("(no admin token - ask the owner)", "", "")]
    tok, out = None, []
    for _ in range(4):
        q = "/admin/alerts?pageSize=100" + (("&continuationToken=" + urllib.parse.quote(tok)) if tok else "")
        s, b = adminapi.call("GET", q)
        if s != 200:
            return [("(admin %s)" % s, "", "")]
        d = (b or {}).get("data") or {}
        items = d.get("items") or []
        for a in items:
            if (a.get("createdAt") or "") >= SINCE:
                out.append((a.get("createdAt"), a.get("title"), (a.get("description") or "")[:230]))
        tok = d.get("continuationToken")
        if not tok or not items:
            break
    return sorted(out, reverse=True)

for i in range(200):
    time.sleep(20)
    s, rb = api.call("GET", "/knowledge/documents?page=1&pageSize=50")
    if not isinstance(rb, dict):
        print("  http", s, flush=True); continue
    r = next((x for x in rb["data"]["documents"] if x["docId"] == DOC), None)
    a = (r or {}).get("serviceDraftAnalytics") or {}
    out = a.get("outcome")
    if out not in (None, "", "Queued", "Running"):
        print("\nSETTLED in %.1f min -> outcome=%s candidates=%s drafts=%s notFullyScanned=%s judgeRemoved=%s"
              % ((time.time()-start)/60, out, a.get("candidateCount"), a.get("draftCount"),
                 a.get("notFullyScanned"), a.get("judgeRemovedCount")), flush=True)
        print("failureReason:", a.get("failureReason"), flush=True)
        print("\n--- alerts since %s ---" % SINCE, flush=True)
        for ts, ti, de in alerts()[:8]:
            print(" ", str(ts)[11:19], "|", ti, flush=True); print("     ", de, flush=True)
        break
    if i % 6 == 0:
        print("  %.0f min: %s / %s" % ((time.time()-start)/60, (r or {}).get("status"), out), flush=True)
else:
    print("not settled after 66 min", flush=True)
