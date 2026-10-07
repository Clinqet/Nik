/**
 * QUANTIZATION A/B HARNESS — the POC that produced the numbers in PHASE-4-PROMPT.md §3.
 *
 * WHAT IT DOES (non-destructive):
 *   1. Reads the REAL index definition from the live search service.
 *   2. Clones it into temp indexes that differ ONLY in vector compression.
 *   3. Copies every document WITH ITS EXISTING VECTOR — so compression is the only variable.
 *      No re-embedding, no re-enrichment, no Cosmos writes, no LLM spend.
 *   4. Runs the same query set against baseline + each variant and diffs the rankings.
 *   5. Reports settled storage, recall/top-1 agreement, and latency.
 *   6. `cleanup` deletes every temp index it created.
 *
 * ‼️ METHODOLOGY TRAP (cost a whole bogus run — do not reintroduce):
 *   Paging the copy with $skip over an unordered `search=*` set SILENTLY DROPS ROWS. The first run
 *   copied 552 of 790 documents and reported a plausible "81.5% recall" that was pure artefact.
 *   `id` is not sortable on this index. The correct method — used below — is to enumerate the key
 *   set once (top=1000, select=id) and then fetch by explicit search.in(id, …) batches, asserting
 *   the returned count matches. NEVER trust a recall number without first asserting corpus counts.
 *
 * ‼️ Azure index /stats is EVENTUALLY CONSISTENT. Poll until documentCount matches and the numbers
 *   stop moving before reporting storage — an early read under-reports by a lot.
 *
 * RUN:  node quant-ab.js run       (create + load + measure)
 *       node quant-ab.js measure   (re-measure existing temp indexes)
 *       node quant-ab.js cleanup   (delete the temp indexes — ALWAYS do this)
 *
 * Credentials are read from the repo, never hardcoded:
 *   search  -> cosmosindexsetup/appsettings.{ca|in}.json  ->  Search.ServiceEndpoint / Search.ApiKey
 *   embed   -> clinqetfuncations/Clinqet.Communications/appsettings.json -> AzureAIFoundry
 */
const fs = require("fs");

const REGION = process.env.REGION || "ca";
const CA = JSON.parse(fs.readFileSync(`C:/Nik/cosmosindexsetup/appsettings.${REGION}.json`, "utf8"));
const FN = JSON.parse(fs.readFileSync("C:/Nik/clinqetfuncations/Clinqet.Communications/appsettings.json", "utf8"));

const SEARCH = CA.Search.ServiceEndpoint.replace(/\/$/, "");
const SKEY = CA.Search.ApiKey;
const API = "2026-04-01";
const BASE = process.env.BASE_INDEX || "clinket-dev";

const AOAI = FN.AzureAIFoundry.ApiUrl.replace(/\/$/, "");
const AKEY = FN.AzureAIFoundry.ApiKey;
const EMB = FN.AzureAIFoundry.EmbeddingModel;
const EMBVER = FN.AzureAIFoundry.ApiVersion;

// Add/remove variants here. `truncation` sets truncationDimension (MRL); omit for no MRL.
// ‼️ Microsoft: "We recommend 1,024 or higher for truncationDimension with binary quantization.
//    A dimensionality of less than 1,000 degrades the quality of search results."
// Truncation is the ONLY independent variable across these four — oversampling, HNSW params, query set,
// k and filters stay identical, because changing oversampling would confound the comparison.
const VARIANTS = [
  { name: "clinket-qtest-bq3072", kind: "binaryQuantization", store: "preserveOriginals" },
  { name: "clinket-qtest-mrl2048", kind: "binaryQuantization", store: "preserveOriginals", truncation: 2048 },
  { name: "clinket-qtest-mrl1536", kind: "binaryQuantization", store: "preserveOriginals", truncation: 1536 },
  { name: "clinket-qtest-mrl1024", kind: "binaryQuantization", store: "preserveOriginals", truncation: 1024 },
];

// Match the query set to the index's real content mix (facet categoryName to check).
const QUERIES = [
  "excavator", "mini excavator", "used caterpillar excavator for sale", "wheel loader", "backhoe",
  "skid steer loader", "telehandler", "bulldozer", "digger for a small job", "heavy equipment rental",
  "motor grader for snow clearing", "forklift", "screener for aggregate",
  "haircut", "hair colouring", "brazilian wax", "facial treatment", "keratin smoothing",
  "spa massage", "eyebrow threading",
];

const NAMES = () => VARIANTS.map((v) => v.name);
const median = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };

async function req(url, opts = {}) {
  const r = await fetch(url, { ...opts, headers: { "api-key": SKEY, "Content-Type": "application/json", ...(opts.headers || {}) } });
  const t = await r.text();
  if (!r.ok) throw new Error(`${r.status} ${url.split("?")[0]}\n${t.slice(0, 900)}`);
  return t ? JSON.parse(t) : null;
}

async function embed(texts) {
  const out = [];
  for (let i = 0; i < texts.length; i += 10) {
    const r = await fetch(`${AOAI}/openai/deployments/${EMB}/embeddings?api-version=${EMBVER}`, {
      method: "POST", headers: { "api-key": AKEY, "Content-Type": "application/json" },
      body: JSON.stringify({ input: texts.slice(i, i + 10), encoding_format: "float" }),
    });
    const t = await r.text();
    if (!r.ok) throw new Error(`embed ${r.status}: ${t.slice(0, 400)}`);
    out.push(...JSON.parse(t).data.sort((a, b) => a.index - b.index).map((d) => d.embedding));
  }
  return out;
}

function buildClone(def, variant) {
  const clone = JSON.parse(JSON.stringify(def));
  delete clone["@odata.context"];
  delete clone["@odata.etag"];
  clone.name = variant.name;

  const rescoring = variant.store === "discardOriginals"
    ? { rescoreStorageMethod: "discardOriginals" }
    : { enableRescoring: true, defaultOversampling: 10, rescoreStorageMethod: "preserveOriginals" };

  const compression = { name: "qc", kind: variant.kind, rescoringOptions: rescoring };
  if (variant.kind === "scalarQuantization") compression.scalarQuantizationParameters = { quantizedDataType: "int8" };
  if (variant.truncation) compression.truncationDimension = variant.truncation;

  clone.vectorSearch.compressions = [compression];
  clone.vectorSearch.profiles.forEach((p) => { p.compression = "qc"; });
  return clone;
}

async function settleStats(indexes, expected) {
  let prev = null, stable = 0;
  for (let i = 0; i < 30; i++) {
    const now = {};
    for (const ix of indexes) {
      const s = await req(`${SEARCH}/indexes/${ix}/stats?api-version=${API}`);
      now[ix] = [s.documentCount, s.storageSize, s.vectorIndexSize];
    }
    const key = JSON.stringify(now);
    const full = indexes.every((ix) => now[ix][0] === expected);
    if (key === prev && full) { if (++stable >= 2) return true; } else { stable = 0; }
    prev = key;
    await new Promise((r) => setTimeout(r, 10000));
  }
  return false;
}

async function main() {
  const mode = process.argv[2] || "run";

  if (mode === "cleanup") {
    for (const n of NAMES()) {
      try { await req(`${SEARCH}/indexes/${n}?api-version=${API}`, { method: "DELETE" }); console.log("deleted", n); }
      catch (e) { console.log("skip", n, e.message.split("\n")[0]); }
    }
    const left = await req(`${SEARCH}/indexes?api-version=${API}&$select=name`);
    console.log("indexes remaining:", left.value.map((i) => i.name).join(", "));
    return;
  }

  const def = await req(`${SEARCH}/indexes/${BASE}?api-version=${API}`);
  const vecField = def.fields.find((f) => f.vectorSearchProfile);
  const selectable = def.fields.filter((f) => f.retrievable !== false).map((f) => f.name);
  console.log(`baseline ${BASE}: ${def.fields.length} fields, vector '${vecField.name}' ${vecField.dimensions}d, compressions=${JSON.stringify(def.vectorSearch.compressions)}`);

  let expected;

  if (mode === "run") {
    for (const v of VARIANTS) {
      try { await req(`${SEARCH}/indexes/${v.name}?api-version=${API}`, { method: "DELETE" }); } catch { /* absent */ }
      await req(`${SEARCH}/indexes?api-version=${API}`, { method: "POST", body: JSON.stringify(buildClone(def, v)) });
      console.log(`created ${v.name} (${v.kind}, ${v.store}${v.truncation ? ", truncation " + v.truncation : ""})`);
    }

    // ‼️ Key-set enumeration, NOT $skip paging. See the header note.
    const idPage = await req(`${SEARCH}/indexes/${BASE}/docs/search?api-version=${API}`, {
      method: "POST", body: JSON.stringify({ search: "*", top: 1000, select: "id", count: true }),
    });
    const allIds = idPage.value.map((d) => d.id);
    expected = idPage["@odata.count"];
    if (allIds.length !== expected) throw new Error(`id enumeration incomplete: ${allIds.length} of ${expected} — raise top or page the key set deterministically`);
    console.log(`copying ${expected} documents by explicit key batches...`);

    for (let off = 0; off < allIds.length; off += 40) {
      const batchIds = allIds.slice(off, off + 40);
      const page = await req(`${SEARCH}/indexes/${BASE}/docs/search?api-version=${API}`, {
        method: "POST",
        body: JSON.stringify({ search: "*", top: 40, select: selectable.join(","), filter: `search.in(id, '${batchIds.join("|")}', '|')` }),
      });
      if ((page.value || []).length !== batchIds.length) throw new Error(`key batch returned ${page.value.length} of ${batchIds.length}`);
      const clean = page.value.map((d) => {
        const o = { "@search.action": "mergeOrUpload" };
        for (const [k, val] of Object.entries(d)) if (!k.startsWith("@search.") && val !== null) o[k] = val;
        return o;
      });
      for (const n of NAMES()) {
        await req(`${SEARCH}/indexes/${n}/docs/index?api-version=${API}`, { method: "POST", body: JSON.stringify({ value: clean }) });
      }
    }
    console.log(`copied ${expected} documents into ${VARIANTS.length} indexes`);
  } else {
    expected = Number(await (await fetch(`${SEARCH}/indexes/${BASE}/docs/$count?api-version=${API}`, { headers: { "api-key": SKEY } })).text());
  }

  console.log("settling index statistics (eventually consistent)...");
  const settled = await settleStats([BASE, ...NAMES()], expected);
  if (!settled) console.log("WARNING: stats never settled — storage numbers below may be low");

  console.log("\n=== MEASURED STORAGE (identical documents, identical vectors) ===");
  const baseStats = await req(`${SEARCH}/indexes/${BASE}/stats?api-version=${API}`);
  const rows = {};
  for (const ix of [BASE, ...NAMES()]) {
    const s = await req(`${SEARCH}/indexes/${ix}/stats?api-version=${API}`);
    rows[ix] = {
      docs: s.documentCount,
      "vectorIndex MB": (s.vectorIndexSize / 1048576).toFixed(3),
      "vs baseline": ix === BASE ? "1.0x" : (baseStats.vectorIndexSize / (s.vectorIndexSize || 1)).toFixed(1) + "x smaller",
      "total storage MB": (s.storageSize / 1048576).toFixed(2),
      "bytes/vector": Math.round(s.vectorIndexSize / (s.documentCount || 1)),
    };
  }
  console.table(rows);

  const vectors = await embed(QUERIES);
  const K = 10;
  const semanticCfg = (def.semantic?.configurations || [])[0]?.name;

  async function runSet(useSemantic) {
    const res = {};
    const lat = {};
    for (const ix of [BASE, ...NAMES()]) { res[ix] = []; lat[ix] = []; }
    for (let qi = 0; qi < QUERIES.length; qi++) {
      for (const ix of [BASE, ...NAMES()]) {
        const body = useSemantic
          ? { search: QUERIES[qi], queryType: "semantic", semanticConfiguration: semanticCfg, top: K, select: "id",
              vectorQueries: [{ kind: "vector", vector: vectors[qi], fields: vecField.name, k: 50 }] }
          : { top: K, select: "id", vectorQueries: [{ kind: "vector", vector: vectors[qi], fields: vecField.name, k: K }] };
        const t0 = process.hrtime.bigint();
        const r = await req(`${SEARCH}/indexes/${ix}/docs/search?api-version=${API}`, { method: "POST", body: JSON.stringify(body) });
        lat[ix].push(Number(process.hrtime.bigint() - t0) / 1e6);
        res[ix].push((r.value || []).map((d) => d.id));
      }
    }
    return { res, lat };
  }

  function report(label, res) {
    console.log(`\n=== ${label} vs uncompressed baseline ===`);
    const out = {};
    for (const ix of NAMES()) {
      let r10 = 0, r5 = 0, t1 = 0;
      for (let qi = 0; qi < QUERIES.length; qi++) {
        const b = res[BASE][qi], c = res[ix][qi];
        const bs = new Set(b), b5 = new Set(b.slice(0, 5));
        r10 += c.filter((x) => bs.has(x)).length / (b.length || 1);
        r5 += c.slice(0, 5).filter((x) => b5.has(x)).length / (Math.min(5, b.length) || 1);
        if (b[0] && b[0] === c[0]) t1++;
      }
      out[ix] = {
        "recall@10": (r10 / QUERIES.length * 100).toFixed(1) + "%",
        "recall@5": (r5 / QUERIES.length * 100).toFixed(1) + "%",
        "top-1 identical": `${t1}/${QUERIES.length}`,
      };
    }
    console.table(out);
  }

  const pure = await runSet(false);
  report(`PURE VECTOR top-${K}`, pure.res);

  if (semanticCfg) {
    const hyb = await runSet(true);
    report(`HYBRID + SEMANTIC ('${semanticCfg}', k=50 candidates -> top ${K})`, hyb.res);
    console.log("\n=== QUERY LATENCY (ms, hybrid+semantic, single client) ===");
    const ls = {};
    for (const ix of [BASE, ...NAMES()]) ls[ix] = { median: median(hyb.lat[ix]).toFixed(0), min: Math.min(...hyb.lat[ix]).toFixed(0), max: Math.max(...hyb.lat[ix]).toFixed(0) };
    console.table(ls);
  } else {
    console.log("\nNOTE: no semantic configuration on this index — hybrid leg skipped.");
  }

  console.log("\n‼️ Run `node quant-ab.js cleanup` when finished. Leaving temp indexes behind violates §0.16.");
}

main().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
