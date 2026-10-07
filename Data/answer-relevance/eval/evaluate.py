# -*- coding: utf-8 -*-
"""P4-E-26 retrieval evaluation. READ-ONLY against the live index.

  py evaluate.py fetch            run every question's legs live (debug=vector) and cache them in legs.json
  py evaluate.py score            score every fusion design on the cached legs (no network)

A leg is built exactly as ProviderKnowledgeSearchService builds it (kprobe mirrors the query). The embedding key
is read at run time from the file the owner named; it is never printed or written anywhere."""
import io, json, os, re, sys, time, urllib.request
sys.path.insert(0, r"C:\Nik\Data\knowledge-extraction-fix-plan\tools")
import srch_client as srch   # noqa: E402
import kprobe                # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
TOP_K, WINDOW, PER_DOC_CAP, RRF_K = 8, 2, 6, 60.0


def _embedder():
    cfg = json.load(io.open(r"C:\Nik\clinqetfuncations\Clinqet.Communications\local.settings.in.json", encoding="utf-8-sig"))["Values"]
    url, key, model = cfg["AzureAIFoundry__ApiUrl"].rstrip("/"), cfg["AzureAIFoundry__ApiKey"], cfg["AzureAIFoundry__EmbeddingModel"]

    def embed(text):
        req = urllib.request.Request("%s/openai/deployments/%s/embeddings?api-version=2024-10-21" % (url, model),
                                     data=json.dumps({"input": [text], "dimensions": 3072}).encode(), method="POST")
        req.add_header("api-key", key); req.add_header("Content-Type", "application/json")
        with urllib.request.urlopen(req, timeout=60) as r:
            return json.loads(r.read().decode())["data"][0]["embedding"]
    return embed


def run_leg(business, script, text, vector, k, size):
    body = {
        "search": kprobe.build_search_text(text, script) or "*",
        "searchFields": ",".join(kprobe.SEARCH_FIELDS),
        "select": "id,docId,docTitle,sectionTitle,content,chunkKind,scripts,imageRef",
        "filter": kprobe.build_filter(business, None, True),
        "top": size, "scoringProfile": kprobe.SCORING_PROFILE, "debug": "vector",
        "vectorQueries": [{"kind": "vector", "vector": vector, "fields": "contentVector", "k": k}],
    }
    started = time.perf_counter()
    st, res = srch.call("indexes/%s/docs/search" % srch.ALIAS, body, api=srch.QUERY_API)
    elapsed = time.perf_counter() - started
    if st != 200: raise SystemExit("search HTTP %s %s" % (st, json.dumps(res)[:300]))
    rows = []
    for rank, r in enumerate(res["value"]):
        sub = ((r.get("@search.documentDebugInfo") or {}).get("vectors") or {}).get("subscores") or {}
        vec = ((sub.get("vectors") or [{}])[0] or {}).get("contentVector") or {}
        rows.append({"rank": rank, "id": r["id"], "docId": r["docId"], "kind": r["chunkKind"], "scripts": r.get("scripts") or [],
                     "title": r.get("docTitle") or "", "content": r.get("content") or "", "rrf": r["@search.score"],
                     "bm25": (sub.get("text") or {}).get("searchScore"), "sim": vec.get("vectorSimilarity")})
    return rows, elapsed


def fetch():
    spec = json.load(io.open(os.path.join(HERE, "questions.json"), encoding="utf-8"))
    embed = _embedder()
    out = {"business": spec["business"], "questions": []}
    for q in spec["questions"]:
        legs = []
        for script, text in q["renderings"].items():
            vector = embed(text)
            rows16, t16 = run_leg(spec["business"], script, text, vector, TOP_K * WINDOW, TOP_K * WINDOW)
            rows50, t50 = run_leg(spec["business"], script, text, vector, 50, TOP_K * WINDOW)
            legs.append({"script": script, "text": text, "k16": rows16, "k50": rows50, "ms16": round(t16 * 1000), "ms50": round(t50 * 1000)})
        out["questions"].append({"id": q["id"], "legs": legs})
        print(q["id"], "fetched", [len(l["k16"]) for l in legs])
    json.dump(out, io.open(os.path.join(HERE, "legs.json"), "w", encoding="utf-8"), ensure_ascii=False)


# ── fusion designs ─────────────────────────────────────────────────────────────────────────────────────

def fuse_by_rank(legs):
    scores, seen, order = {}, {}, []
    for rows in legs:
        for row in rows:
            if row["id"] not in scores:
                scores[row["id"]] = 0.0; seen[row["id"]] = row; order.append(row["id"])
            scores[row["id"]] += 1.0 / (RRF_K + row["rank"] + 1)
    return [seen[i] for i in sorted(order, key=lambda i: -scores[i])]


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
            if row["sim"] is not None:
                best[row["id"]] = max(best.get(row["id"], -1.0), row["sim"])
    return best


def gated(legs, absolute, relative, order):
    sims = best_sim(legs)
    top = max(sims.values()) if sims else 0.0
    floor = max(absolute, relative * top)
    keep = {i for i, s in sims.items() if s >= floor}
    if order == "prod":
        order = "bestrank" if len(legs) == 1 else "dual"
    if order == "rrf":
        ranked = [r for r in fuse_by_rank(legs) if r["id"] in keep]
    elif order == "bestrank":
        best_rank, pool = {}, {}
        for rows in legs:
            for row in rows:
                if row["id"] not in keep: continue
                pool.setdefault(row["id"], row)
                best_rank[row["id"]] = min(best_rank.get(row["id"], 10**6), row["rank"])
        ranked = sorted(pool.values(), key=lambda r: (best_rank[r["id"]], -sims[r["id"]]))
    elif order == "dual":
        best_rank, pool = {}, {}
        for rows in legs:
            for row in rows:
                if row["id"] not in keep: continue
                pool.setdefault(row["id"], row)
                best_rank[row["id"]] = min(best_rank.get(row["id"], 10**6), row["rank"])
        by_sim = sorted(pool, key=lambda i: -sims[i])
        by_rank = sorted(pool, key=lambda i: (best_rank[i], -sims[i]))
        fused = {i: 1.0 / (RRF_K + by_sim.index(i) + 1) + 1.0 / (RRF_K + by_rank.index(i) + 1) for i in pool}
        ranked = [pool[i] for i in sorted(pool, key=lambda i: (-fused[i], -sims[i]))]
    else:
        pool = {}
        for rows in legs:
            for row in rows:
                pool.setdefault(row["id"], row)
        ranked = sorted((pool[i] for i in keep), key=lambda r: -sims[r["id"]])
    return diversify(ranked)


def weighted_rrf(legs, absolute, power):
    sims = best_sim(legs)
    top = max(sims.values()) if sims else 0.0
    scores, seen = {}, {}
    for rows in legs:
        leg_best = max([r["sim"] for r in rows if r["sim"] is not None] or [0.0])
        weight = (leg_best / top) ** power if top > 0 else 0.0
        for row in rows:
            if sims.get(row["id"], -1) < absolute: continue
            seen.setdefault(row["id"], row)
            scores[row["id"]] = scores.get(row["id"], 0.0) + weight / (RRF_K + row["rank"] + 1)
    return diversify([seen[i] for i in sorted(scores, key=lambda i: -scores[i])])


def keyword_boosted(legs, absolute, bonus):
    sims = best_sim(legs)
    kw = {}
    for rows in legs:
        top_bm = max([r["bm25"] for r in rows if r["bm25"] is not None] or [0.0])
        for row in rows:
            if row["bm25"] is not None and top_bm > 0:
                kw[row["id"]] = max(kw.get(row["id"], 0.0), row["bm25"] / top_bm)
    pool = {}
    for rows in legs:
        for row in rows:
            pool.setdefault(row["id"], row)
    keep = [i for i, s in sims.items() if s >= absolute]
    return diversify(sorted((pool[i] for i in keep), key=lambda r: -(sims[r["id"]] + bonus * kw.get(r["id"], 0.0))))


def designs():
    yield "today (rank fusion, no floor)", lambda legs: diversify(fuse_by_rank(legs))
    for absolute in (0.25, 0.30, 0.35):
        for relative in (0.0, 0.60, 0.70, 0.80):
            for order in ("sim", "bestrank", "dual"):
                yield "floor abs %.2f rel %.2f order %s" % (absolute, relative, order), \
                      (lambda a, r, o: (lambda legs: gated(legs, a, r, o)))(absolute, relative, order)
        for power in (2, 4):
            yield "weighted rrf abs %.2f power %d" % (absolute, power), \
                  (lambda a, p: (lambda legs: weighted_rrf(legs, a, p)))(absolute, power)
        for bonus in (0.05, 0.10):
            yield "sim+kw abs %.2f bonus %.2f" % (absolute, bonus), \
                  (lambda a, b: (lambda legs: keyword_boosted(legs, a, b)))(absolute, bonus)


def score(window="k16", verbose=None):
    spec = {q["id"]: q for q in json.load(io.open(os.path.join(HERE, "questions.json"), encoding="utf-8"))["questions"]}
    data = json.load(io.open(os.path.join(HERE, "legs.json"), encoding="utf-8"))
    results = []
    for name, design in designs():
        hit = need = wrong = seated_total = 0
        empty_ok = empty_total = 0
        top1 = answered = 0
        per_q = []
        for q in data["questions"]:
            s = spec[q["id"]]
            legs = [l[window] for l in q["legs"]]
            seated = design(legs)
            rel = re.compile(s["relevant"], re.M) if s["relevant"] else None
            acc = re.compile(s["acceptable"], re.M) if s.get("acceptable") else None
            pool = {r["id"]: r for rows in legs for r in rows}
            relevant_ids = {i for i, r in pool.items() if rel and rel.search(r["content"])}
            is_rel = [bool(rel and rel.search(r["content"])) for r in seated]
            is_acc = [bool(acc and acc.search(r["content"])) for r in seated]
            if rel is None:
                empty_total += 1
                empty_ok += len(seated) == 0
                wrong += len(seated)
            else:
                answered += 1
                got = sum(is_rel)
                hit += min(got, TOP_K)
                need += min(len(relevant_ids), TOP_K)
                wrong += sum(1 for r, a in zip(is_rel, is_acc) if not r and not a)
                top1 += bool(seated and is_rel[0])
            seated_total += len(seated)
            per_q.append((q["id"], len(seated), sum(is_rel), len(relevant_ids), [(r["id"].split("_", 1)[1][:14], "R" if x else ("a" if y else "-"), r["sim"]) for r, x, y in zip(seated, is_rel, is_acc)]))
        results.append((name, hit, need, wrong, seated_total, empty_ok, empty_total, top1, answered, per_q))
    print("%-38s %9s %7s %7s %9s %6s" % ("design", "recall", "wrong", "seated", "no-answer", "top1"))
    for name, hit, need, wrong, seated_total, empty_ok, empty_total, top1, answered, per_q in results:
        print("%-38s %4d/%-4d %7d %7d %5d/%-3d %3d/%d" % (name, hit, need, wrong, seated_total, empty_ok, empty_total, top1, answered))
    if verbose:
        for name, *_rest in results:
            if name == verbose:
                for qid, n, got, total, cards in _rest[-1]:
                    print(qid, "seated", n, "relevant seated", got, "of", total, cards)


if __name__ == "__main__":
    if sys.argv[1] == "fetch": fetch()
    else: score(sys.argv[2] if len(sys.argv) > 2 else "k16", sys.argv[3] if len(sys.argv) > 3 else None)
