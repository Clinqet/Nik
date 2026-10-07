# W7 · W8 · W9 — live proof (2026-09-30, Canada + India sandbox)

The NEW code, never deployed: the worktree API (`W:\clinqetapi`, build of commit `f80326c2` + the concurrent-reads change
below) run locally against the Canada sandbox (`CLINKET_REGION=ca`), its public aliases pointed at throwaway clones
built from the NEW definitions (`zz-public-services-ca-w8`, `zz-public-providers-ca-w8`, aliases `zz-services-ca-w8`,
`zz-providers-ca-w8`), Service Bus pointed at a namespace that does not exist (nothing reached the deployed Functions).
The real indexes were only READ. Recipe: memory `local-api-on-sandbox-clones-recipe`. Probes: scratchpad `proof/srch`,
`proof/clones`, `proof/w8_queries.py`.

## Data

The Canada sandbox holds three businesses — all were copied row for row from the real indexes into the clones (49 service
rows, 3 provider rows):

| Business | Where | Comes to you | Area |
|---|---|---|---|
| NKN607 Complete Hair & Beauty | Hamilton address | no (at its place) | Hamilton, 70 km |
| 0N7BJE Aqua O Glow | Cambridge address | no | Cambridge, 50 km |
| 4Q7JN7 Moak Real Estate | Mississauga address | **yes** | Mississauga, 50 km |

## W8 — "Serves …" and the Distance order

**Hamilton customer (43.2557, −79.8711)** — services and providers sorted by Distance:

| # | Before (by the address: the old key, still in `distanceKm`) | After (the number the card leads with) |
|---|---|---|
| 1 | NKN607 · 9.2 km | **4Q7JN7 · "Serves Mississauga"** (the customer is inside its 50 km area; its address is 42.7 km away; "Based in" hidden — same city) |
| 2 | 0N7BJE · 40.7 km | NKN607 · 9.2 km (at its place — card unchanged) |
| 3 | 4Q7JN7 · 42.7 km | 0N7BJE · 40.7 km |

**Cambridge customer (43.3719, −80.3484, radius 100)**: 0N7BJE 0 km · NKN607 49.6 km · 4Q7JN7 **"Serves Mississauga · 61.8 km"**
(outside every area: the nearest area and the distance to its centre) — ordered by that number.

Azure accepted every new read on the real service: the banded containment filter (3,284 chars, 24 band clauses over the
area collection), `location ne null` / `location eq null`, `geoPoint ne null` / `eq null`, `geo.distance` orders.

**Cost of the "serves you here" read** (median of 15, real index, 49 rows): band growth 2 → 154 ms (filter 3,200 chars),
4 → 97 ms, 8 → 77 ms, one band → 43 ms; a plain read 64 ms. India's index (farther away) 418 / 323 / 293 / 239 ms. Wider
bands shift cost to reading and trimming many more rows on a busy index (growth 8 would pass the 2,000-row ceiling at a
60-deep window), so growth **2** stays. **Decision (build session):** the three Distance reads are independent and now run
**concurrently** — services Distance warm 380–490 ms → **340–440 ms**, providers 275–300 → **230–275 ms** (the rest is the
request's own work: place, analytics).

## W9 — "Most reviewed" ordered at the index

Clones built from the new definition carry `listingReviewCount` (sortable, hidden); Azure accepted
`listingReviewCount desc` on the real service. With counts set on the clone rows only (4Q7JN7 = 50, 0N7BJE = 12, NKN607
none — card count and index count set together, as the indexer writes them), "Most reviewed" answered **4Q7JN7 · 0N7BJE ·
NKN607**. The indexer's own write of the field is pinned by `AzureSearchIndexerRemovalFirstTests` (Functions host).

‼️ **Deploy order (hand-off):** the index update (`cosmosindexsetup`, additive `CreateOrUpdateIndex`) must run BEFORE the
new API: until the index has `listingReviewCount`, a "Most reviewed" browse on the new API is an Azure 400.

## W7 — whole-index word scoring (customer search and lead matching use the same option)

Same typed query 8 times, `ScoringStatistics.Local` vs `Global`, top 20, real indexes:

| Index · query | Local | Global |
|---|---|---|
| IN · "car service" | **2 distinct orders** in 8 runs; 235–252 ms warm | **1 order**; 240–283 ms |
| IN · "insurance", "suv" | 1 (no match) | 1 |
| CA · "facial", "hair colour", "brazilian wax" | 1 order each; 40–90 ms | 1 order each; 52–103 ms; the scores re-scale and close ranks reorder ("hair colour": the top two swap) |

Global removes the shard-to-shard shuffle at no measurable latency cost.

## Cleanup
Clones and aliases deleted and LISTED empty after the proof (see the end of this file); the local API stopped.
