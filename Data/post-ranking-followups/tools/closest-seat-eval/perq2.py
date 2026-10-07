import io, json, re, sys
import evaluate2 as e
from guard import has_identifier
qfile, lfile = sys.argv[1], sys.argv[2]
spec = {q["id"]: q for q in json.load(io.open(qfile, encoding="utf-8"))["questions"]}
data = json.load(io.open(lfile, encoding="utf-8"))
A = lambda legs, texts: e.production([[r for r in rows if r["rank"] < 16] for rows in legs])
B = lambda legs, texts: A(legs, texts) if has_identifier(texts) else e.reserved(legs, 2, 2, None, "first-always")
worse = better = guarded = 0
tot = {"A": [0, 0, 0, 0], "B": [0, 0, 0, 0]}
for q in data["questions"]:
    s = spec[q["id"]]
    legs = [l["p50"] for l in q["legs"]]; texts = [l["text"] for l in q["legs"]]
    guarded += has_identifier(texts)
    rel = re.compile(s["relevant"], re.M) if s.get("relevant") else None
    title = re.compile(s["title"], re.I) if s.get("title") else None
    acc = re.compile(s["acceptable"], re.M) if s.get("acceptable") else None
    def isrel(r): return bool(rel and rel.search(r["content"]) and (title is None or title.search(r["title"])))
    def stats(seated):
        good = sum(1 for r in seated if isrel(r))
        bad = sum(1 for r in seated if not isrel(r) and not (acc and acc.search(r["content"])))
        return good, bad, bool(seated and isrel(seated[0])), good > 0, [r["id"] for r in seated]
    a, b = stats(A(legs, texts)), stats(B(legs, texts))
    for k, x in (("A", a), ("B", b)):
        tot[k][0] += x[0]; tot[k][1] += x[1]; tot[k][2] += x[2]; tot[k][3] += x[3]
    if a[4] != b[4]:
        tag = "WORSE" if (b[0] < a[0] or b[2] < a[2] or (b[0] == a[0] and b[1] > a[1])) else ("same-score-reordered" if a[:4] == b[:4] else "better")
        worse += tag == "WORSE"; better += tag == "better"
        print("  %s %s  good %d bad %d first %s  ->  good %d bad %d first %s" % (tag, q["id"], a[0], a[1], a[2], b[0], b[1], b[2]))
print("%s: today right %d unrelated %d first %d answered %d | rule right %d unrelated %d first %d answered %d | better %d WORSE %d (identifier questions %d)" % (
    qfile, *tot["A"], *tot["B"], better, worse, guarded))
