# -*- coding: utf-8 -*-
"""W3 follow-up: does a ranking change find the table rows W3 made readable without losing anything the approved
P4-E-26 design finds? READ-ONLY against the live sandbox indexes. Keys are read at run time and never printed.

  py evaluate2.py fetch <ca|in> <questions.json> <legs.json>
  py evaluate2.py score <questions.json> <legs.json> [design-to-print]
"""
import io, json, os, re, sys, time, urllib.request, urllib.error
sys.path.insert(0, r"C:\Nik\Data\knowledge-extraction-fix-plan\tools")
import kprobe  # noqa: E402  (the query builder mirror; its own search client is not used)

TOP_K, PER_DOC_CAP, RRF_K = 8, 6, 60.0
ALIAS, QUERY_API = "private-knowledge-cell1-dev", "2026-04-01"


def _search(region):
    cfg = json.load(io.open(r"C:\Nik\cosmosindexsetup\appsettings.%s.json" % region, encoding="utf-8-sig"))["Search"]
    endpoint, key = cfg["ServiceEndpoint"].rstrip("/"), cfg["ApiKey"]

    def call(body):
        req = urllib.request.Request("%s/indexes/%s/docs/search?api-version=%s" % (endpoint, ALIAS, QUERY_API),
                                     data=json.dumps(body).encode(), method="POST")
        req.add_header("api-key", key); req.add_header("Content-Type", "application/json")
        for attempt in range(4):
            try:
                with urllib.request.urlopen(req, timeout=60) as r:
                    return json.loads(r.read().decode())
            except urllib.error.HTTPError as e:
                if e.code in (429, 503) and attempt < 3: time.sleep(2 ** attempt); continue
                raise SystemExit("search HTTP %s %s" % (e.code, e.read().decode()[:300]))
    return call


def _embedder(region):
    cfg = json.load(io.open(r"C:\Nik\clinqetfuncations\Clinqet.Communications\local.settings.%s.json" % region, encoding="utf-8-sig"))["Values"]
    url, key, model = cfg["AzureAIFoundry__ApiUrl"].rstrip("/"), cfg["AzureAIFoundry__ApiKey"], cfg["AzureAIFoundry__EmbeddingModel"]

    def embed(text):
        req = urllib.request.Request("%s/openai/deployments/%s/embeddings?api-version=2024-10-21" % (url, model),
                                     data=json.dumps({"input": [text], "dimensions": 3072}).encode(), method="POST")
        req.add_header("api-key", key); req.add_header("Content-Type", "application/json")
        with urllib.request.urlopen(req, timeout=60) as r:
            return json.loads(r.read().decode())["data"][0]["embedding"]
    return embed


# name -> (top, k, vector weight, keyword on, vector on)
FETCHES = {
    "p16": (16, 50, None, True, True),
    "p24": (24, 50, None, True, True),
    "p32": (32, 50, None, True, True),
    "p50": (50, 50, None, True, True),
    "w2_16": (16, 50, 2.0, True, True),
    "w3_16": (16, 50, 3.0, True, True),
    "w2_50": (50, 50, 2.0, True, True),
    "vec50": (50, 50, None, False, True),
    "kw50": (50, 50, None, True, False),
}


def run(call, business, script, text, vector, fetch):
    top, k, weight, keyword, use_vector = FETCHES[fetch]
    body = {
        "search": (kprobe.build_search_text(text, script) or "*") if keyword else None,
        "searchFields": ",".join(kprobe.SEARCH_FIELDS),
        "select": "id,docId,docTitle,sectionTitle,content,chunkKind",
        "filter": kprobe.build_filter(business, None, use_vector),
        "top": top, "scoringProfile": kprobe.SCORING_PROFILE,
    }
    if body["search"] is None: del body["search"]; del body["searchFields"]
    if use_vector:
        body["debug"] = "vector"
        q = {"kind": "vector", "vector": vector, "fields": "contentVector", "k": k}
        if weight is not None: q["weight"] = weight
        body["vectorQueries"] = [q]
    res = call(body)
    rows = []
    for rank, r in enumerate(res["value"]):
        sub = ((r.get("@search.documentDebugInfo") or {}).get("vectors") or {}).get("subscores") or {}
        vec = ((sub.get("vectors") or [{}])[0] or {}).get("contentVector") or {}
        rows.append({"rank": rank, "id": r["id"], "docId": r["docId"], "kind": r["chunkKind"], "title": r.get("docTitle") or "",
                     "content": (r.get("sectionTitle") or "") + "\n" + (r.get("content") or ""), "score": r["@search.score"],
                     "sim": vec.get("vectorSimilarity")})
    return rows


def fetch(region, qfile, lfile):
    spec = json.load(io.open(qfile, encoding="utf-8"))
    call, embed = _search(region), _embedder(region)
    out = {"business": spec["business"], "questions": []}
    for q in spec["questions"]:
        legs = []
        for script, text in q["renderings"].items():
            vector = embed(text)
            leg = {"script": script, "text": text}
            for name in FETCHES: leg[name] = run(call, spec["business"], script, text, vector, name)
            legs.append(leg)
        out["questions"].append({"id": q["id"], "legs": legs})
        print(q["id"], "fetched", flush=True)
    json.dump(out, io.open(lfile, "w", encoding="utf-8"), ensure_ascii=False)


def diversify(ranked, top_k=TOP_K, cap=PER_DOC_CAP):
    counts, selected, deferred = {}, [], []
    for i, row in enumerate(ranked):
        if len(selected) >= top_k: break
        c = counts.get(row["docId"], 0)
        if c >= cap: deferred.append(i); continue
        counts[row["docId"]] = c + 1; selected.append(i)
    for i in deferred:
        if len(selected) >= top_k: break
        selected.append(i)
    return [ranked[i] for i in sorted(selected)]


def best_sim(legs):
    best = {}
    for rows in legs:
        for row in rows:
            if row["sim"] is not None: best[row["id"]] = max(best.get(row["id"], -1.0), row["sim"])
    return best


def production(legs, order=None, absolute=0.25, relative=0.60):
    """KnowledgeRelevanceRanker.Rank + Diversify, as shipped: one leg keeps the search order, several fuse closeness with rank."""
    sims = best_sim(legs)
    if not sims: return []
    floor = max(absolute, relative * max(sims.values()))
    keep = {i for i, s in sims.items() if s >= floor}
    pool, position = {}, {}
    for rows in legs:
        for row in rows:
            if row["id"] not in keep: continue
            pool.setdefault(row["id"], row)
            position[row["id"]] = min(position.get(row["id"], 10 ** 6), row["rank"])
    order = order or ("search" if len(legs) == 1 else "dual")
    if order == "search":
        ranked = sorted(pool.values(), key=lambda r: (position[r["id"]], -sims[r["id"]]))
    elif order == "sim":
        ranked = sorted(pool.values(), key=lambda r: -sims[r["id"]])
    else:
        by_sim = sorted(pool, key=lambda i: -sims[i])
        by_pos = sorted(pool, key=lambda i: (position[i], -sims[i]))
        fused = {i: 1.0 / (RRF_K + by_sim.index(i) + 1) + 1.0 / (RRF_K + by_pos.index(i) + 1) for i in pool}
        ranked = [pool[i] for i in sorted(pool, key=lambda i: (-fused[i], -sims[i]))]
    return diversify(ranked)


def reserved(legs50, count, at, near=None, outside_only=False):
    """Today's pipeline on the first 16 rows, then the closest card(s) of the whole wide window keep a seat."""
    window = [[r for r in rows if r["rank"] < 16] for rows in legs50]
    seated = production(window)
    sims = best_sim(legs50)
    if not sims: return seated
    closest = max(sims.values())
    pool = {}
    for rows in legs50:
        for row in rows: pool.setdefault(row["id"], row)
    ordered = sorted(sims, key=lambda i: -sims[i])
    best_rank = {}
    for rows in legs50:
        for row in rows: best_rank[row["id"]] = min(best_rank.get(row["id"], 10 ** 6), row["rank"])
    picks = []
    for i in ordered[:count]:
        if near is not None and sims[i] < near * closest: break
        if outside_only and best_rank[i] < 16 and not (outside_only == "first-always" and i == ordered[0]): continue
        if i not in {r["id"] for r in seated}: picks.append(pool[i])
    for n, row in enumerate(picks):
        pos = len(seated) if at == "end" else min(len(seated), at - 1 + n)
        seated.insert(pos, row)
    return seated[:TOP_K] if at != "end" else (seated[:TOP_K - len(picks)] + picks if len(seated) > TOP_K else seated)


def designs():
    yield "TODAY p16 (shipped)", "p16", lambda legs: production(legs)
    for f in ("p24", "p32", "p50"):
        yield "window %s, shipped order" % f, f, lambda legs: production(legs)
        yield "window %s, dual order" % f, f, lambda legs: production(legs, "dual")
        yield "window %s, closeness order" % f, f, lambda legs: production(legs, "sim")
    for f in ("w2_16", "w3_16", "w2_50"):
        yield "weight %s, shipped order" % f, f, lambda legs: production(legs)
    for count in (1, 2, 3):
        for at in (2, "end"):
            yield "reserve %d closest @%s" % (count, at), "p50", (lambda c, a: lambda legs: reserved(legs, c, a))(count, at)
    yield "reserve 2 closest @2 near .97", "p50", lambda legs: reserved(legs, 2, 2, 0.97)
    yield "reserve 3 closest @2 near .95", "p50", lambda legs: reserved(legs, 3, 2, 0.95)
    for count, near in ((1, None), (2, None), (3, None), (2, 0.95), (3, 0.95), (3, 0.90)):
        yield "outside-window %d closest near %s" % (count, near), "p50", (lambda c, n: lambda legs: reserved(legs, c, 2, n, True))(count, near)
    yield "closest always + 2nd if outside", "p50", lambda legs: reserved(legs, 2, 2, None, "first-always")
    yield "closest always + 2,3rd if outside", "p50", lambda legs: reserved(legs, 3, 2, None, "first-always")
    yield "p16, dual order", "p16", lambda legs: production(legs, "dual")
    yield "p16, closeness order", "p16", lambda legs: production(legs, "sim")


def score(qfile, lfile, verbose=None):
    spec = {q["id"]: q for q in json.load(io.open(qfile, encoding="utf-8"))["questions"]}
    data = json.load(io.open(lfile, encoding="utf-8"))
    print("%-36s %10s %7s %7s %6s %9s" % ("design", "recall", "wrong", "seated", "top1", "answered"))
    for name, fetch_name, design in designs():
        hit = need = wrong = seated_total = top1 = answered = asked = empty_ok = empty_total = 0
        detail = []
        for q in data["questions"]:
            s = spec[q["id"]]
            legs = [l[fetch_name] for l in q["legs"]]
            seated = design(legs)
            rel = re.compile(s["relevant"], re.M) if s.get("relevant") else None
            title = re.compile(s["title"], re.I) if s.get("title") else None
            acc = re.compile(s["acceptable"], re.M) if s.get("acceptable") else None
            def is_relevant(r): return bool(rel and rel.search(r["content"]) and (title is None or title.search(r["title"])))
            # every relevant card any fetch saw — the same denominator for every design
            universe = {r["id"] for l in q["legs"] for f in FETCHES for r in l[f] if is_relevant(r)}
            flags = [is_relevant(r) for r in seated]
            if rel is None:
                empty_total += 1; empty_ok += len(seated) == 0; wrong += len(seated)
            else:
                asked += 1
                got = sum(flags)
                hit += min(got, TOP_K); need += min(len(universe), TOP_K)
                answered += got > 0
                top1 += bool(seated and flags[0])
                wrong += sum(1 for r, x in zip(seated, flags) if not x and not (acc and acc.search(r["content"])))
            seated_total += len(seated)
            detail.append((q["id"], got if rel else None, len(universe) if rel else None))
        print("%-36s %4d/%-5d %7d %7d %3d/%-3d %4d/%d" % (name, hit, need, wrong, seated_total, top1, asked, answered, asked))
        if verbose and name == verbose:
            for d in detail: print("   ", d)


if __name__ == "__main__":
    if sys.argv[1] == "fetch": fetch(sys.argv[2], sys.argv[3], sys.argv[4])
    else: score(sys.argv[2], sys.argv[3], sys.argv[4] if len(sys.argv) > 4 else None)
