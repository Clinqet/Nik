"""A/B one reasoning-effort setting across FOUR dimensions, on identical documents.

  py effort_ab.py medium      # baseline, before the setting is changed
  py effort_ab.py low         # after the owner sets ExtractorReasoningEffort=Low

Writes results\effort-<label>.json so the two runs can be compared line for line.
Measures CONTENT, not just the clock: a reasoning dial is a QUALITY dial, and an A/B that
only times the run would approve a setting that extracts worse.
"""
import sys, os, json, time, urllib.parse
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import api, adminapi
from api import call, put_blob

HERE = os.path.dirname(os.path.abspath(__file__))
LABEL = (sys.argv[1] if len(sys.argv) > 1 else "run").lower()
OUT = os.path.join(HERE, "results"); os.makedirs(OUT, exist_ok=True)

# Four SHAPES, not four sizes - the edge cases are where a weaker reasoner fails first.
def shapes():
    clean = ["Treatment,Price"] + ["%s %s,$%d" % (t, lv, 20 + i)
             for i, (t, lv) in enumerate([(t, lv) for t in
             ["Classic Facial","Gel Manicure","Full Leg Wax","Lash Lift","Hair Cut","Balayage","Head Massage"]
             for lv in ["Express","Standard","Deluxe","Signature","Premium","Student","Weekday"]])]
    # messy: ranges, "from", per-unit, two prices on a line, a fee that is NOT an offering
    messy = ["Service | Cost",
             "Bridal Package | from $450",
             "Hair Colour | $80-$160 depending on length",
             "Extensions | $25 per strand",
             "Keratin | $200 (short) / $320 (long)",
             "Missed appointment fee | $30",
             "Deposit (refundable) | $50",
             "Gift card | $100",
             "Head Massage 30min | $45",
             "Head Massage 60min | $80"]
    # a continuation table: the header is far from the rows
    wide = ["Treatment,Duration,Price,Notes"] + \
           ["Facial Type %d,%d min,$%d,room %d" % (i, 30 + (i % 4) * 15, 55 + i, i % 3) for i in range(1, 41)]
    # non-English names with prices
    intl = ["Treatment,Price"] + ["%s,$%d" % (nm, 30 + i) for i, nm in enumerate(
            ["Soin du visage classique","Masaje de cuerpo completo","Gesichtsbehandlung Deluxe",
             "Trattamento cheratina","Pedicure spa completo","Manicura en gel","Masaje de cabeza",
             "Depilación con cera","Tinte de cejas","Corte de cabello"])]
    return {"clean_49": clean, "messy_9": messy, "wide_40": wide, "intl_10": intl}

def alerts_since(since):
    tok, out = None, []
    for _ in range(5):
        q = "/admin/alerts?pageSize=100" + (("&continuationToken=" + urllib.parse.quote(tok)) if tok else "")
        s, b = adminapi.call("GET", q)
        if s != 200: return out
        d = (b or {}).get("data") or {}
        items = d.get("items") or []
        for a in items:
            if (a.get("createdAt") or "") >= since:
                out.append({"at": a.get("createdAt"), "title": a.get("title")})
        tok = d.get("continuationToken")
        if not tok or not items: break
    return out

def push_and_wait(name, lines, minutes=25):
    body = ("\r\n".join(lines) + "\r\n").encode()
    priced = len([l for l in lines[1:] if "$" in l])
    st, b = call("POST", "/knowledge/documents/sas-urls", {"files": [{
        "fileName": "ab_%s_%s.csv" % (LABEL, name), "contentType": "text/csv", "fileSize": len(body)}]})
    u = b["data"]["uploadUrls"][0]
    put_blob(u["uploadUrl"], body, "text/csv")
    call("POST", "/knowledge/documents/confirm", {"files": [{
        "docId": u["docId"], "blobName": u["blobName"], "fileName": "ab_%s_%s.csv" % (LABEL, name),
        "contentType": "text/csv", "fileSize": len(body), "docType": "PriceList",
        "receptionistAccess": "AnswersAndSends"}]})
    print("  %-10s pushed %s (%d priced lines)" % (name, u["docId"], priced), flush=True)
    start = time.time()
    for _ in range(minutes * 3):
        time.sleep(20)
        s, rb = call("GET", "/knowledge/documents?page=1&pageSize=50")
        if not isinstance(rb, dict): continue
        r = next((x for x in rb["data"]["documents"] if x["docId"] == u["docId"]), None)
        if r is None: return {"name": name, "docId": u["docId"], "priced": priced, "outcome": "GONE"}
        a = r.get("serviceDraftAnalytics") or {}
        if a.get("outcome") not in (None, "", "Queued", "Running"):
            return {"name": name, "docId": u["docId"], "priced": priced,
                    "minutes": round((time.time() - start) / 60, 1), "outcome": a.get("outcome"),
                    "candidateCount": a.get("candidateCount"), "draftCount": a.get("draftCount"),
                    "judgeRemoved": a.get("judgeRemovedCount"), "notFullyScanned": a.get("notFullyScanned"),
                    "failureReason": a.get("failureReason")}
    return {"name": name, "docId": u["docId"], "priced": priced, "outcome": "TIMED_OUT_LOCALLY"}

since = time.strftime("%Y-%m-%dT%H:%M", time.gmtime())
print("A/B label=%s | alerts counted from %s UTC" % (LABEL, since), flush=True)
results = [push_and_wait(n, l) for n, l in shapes().items()]      # ONE AT A TIME: the queue is session-serialised
payload = {"label": LABEL, "since": since, "results": results, "alerts": alerts_since(since)}
open(os.path.join(OUT, "effort-%s.json" % LABEL), "w", encoding="utf-8").write(json.dumps(payload, indent=1))
print("\n%-10s %-8s %-8s %-8s %-8s %s" % ("shape", "priced", "cands", "drafts", "min", "outcome"), flush=True)
for r in results:
    print("%-10s %-8s %-8s %-8s %-8s %s" % (r["name"], r["priced"], r.get("candidateCount"),
          r.get("draftCount"), r.get("minutes"), r["outcome"]), flush=True)
print("\ncut-off alerts in window:", sum(1 for a in payload["alerts"] if "cut off" in (a["title"] or "")), flush=True)
print("written:", os.path.join(OUT, "effort-%s.json" % LABEL), flush=True)
