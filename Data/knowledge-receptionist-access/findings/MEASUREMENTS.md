# Measurements — knowledge receptionist access (Canada sandbox)

All numbers are Cosmos `x-ms-request-charge` medians over 10 identical runs, read through the REST gateway
against `Clinket-nonprod` / `KnowledgeBase-dev` on the Canada account, 2026-09-07 21:20–21:35 UTC.
Probe: session scratchpad `cosmos-probe.js` (deleted with the session, §0.16).

## P0 — baseline, before any code change

### Live business SX3SG2 (3 File rows, all Ready, no FAQs, no pictures)

| Read | Rows | RU |
|---|---|---|
| today `ListRetrievableDocIdsAsync` (`SELECT VALUE c.docId … status = 'Ready'`) | 3 | 3.10 |
| today `ListRefSuppressedDocIdsAsync` (`SELECT docId, shareWithCallers, status … sourceKind = 'File'`) | 3 | 3.02 |
| today `CountReadyAsync` | 1 | 2.90 |
| **new** one sweep (`SELECT docId, status, usedByReceptionist, shareWithCallers … type`) | 3 | 2.92 |
| today `ListSendableImageRefsAsync` shape | 0 | 3.72 |
| **new** images shape (+ `usedByReceptionist` filter) | 0 | 3.72 |

Per voice search today = retrievable + refSuppressed = **6.12 RU**; new = one sweep = **2.92 RU** (−52%).
(Two later runs of the same queries returned 7.8–8.0 RU for the 3-row reads — gateway variance between
runs, identical within a run. The comparison inside one run is what matters.)

### Synthetic partition K1PROBE0000 at the shipped caps (20 File rows, 10 carrying a 40-picture
registry, 200 typed FAQs; half of every kind carries `usedByReceptionist`, half does not)

| Read | Rows | RU |
|---|---|---|
| today `ListRetrievableDocIdsAsync` | 220 | 9.31 |
| today `ListRefSuppressedDocIdsAsync` | 20 | 3.90 |
| today `CountReadyAsync` | 1 | 8.59 |
| **new** one sweep (4 fields) | 220 | 10.08 |
| new sweep, ids only (for reference) | 220 | 8.89 |
| today `ListSendableImageRefsAsync` shape | 6 | 5.24 |
| **new** images shape (+ `usedByReceptionist` filter) | 4 | 4.82 |

Per voice search today = **13.21 RU** (9.31 + 3.90); new = **10.08 RU** (−24%) — and the new sweep also
covers the 200 FAQs the old suppression read never looked at (FAQs now carry the choice).

‼️ **K1PROBE0000 is synthetic and MUST be purged when P8 is done** (`node cosmos-probe.js purge K1PROBE0000`).

### Retrieval battery — BLOCKED by a pre-existing sandbox state (not caused by this programme)

`clinket-knowledge-dev` → `clinket-knowledge-dev-v1` holds **0 documents** (index stats, 21:31 UTC) while
the registry says 4 rows are Ready (SX3SG2 ×3, MEE3IC ×1). `clinket-dev-v1` (821) and
`clinket-providers-dev-v1` (10) were repopulated after the `-v1` rebuild; the knowledge index is fed only by
the ingest queue, so it needs an admin **Reindex All** (or the deploy's resync) per business. The dev
machine's `local.settings.json` points at **Central India**, so the resync cannot be triggered from here
without Canada Service Bus credentials, and forging an admin token against a deployed host is not something
this session does without being asked.

Consequence for the proof: this change never touches the search request, filter, ranking or card text —
only the registry-derived post-filter and the send refs — so byte-identity is proven in C# (unit tests that
compare the passage list with every row used vs. absent-field, and real-Cosmos tests for the sweep), and
the battery is a live sanity check to run once the Canada index is repopulated (recorded here when done).

## P8 — experiment E: two IncludedPaths (`/usedByReceptionist/?`, `/shareWithCallers/?`) on Canada — REJECTED

Applied to `KnowledgeBase-dev` on the Canada account through the REST gateway (2026-09-07), index
transformation reported 100 % before and after, measured on the same synthetic partition K1PROBE0000
(20 File rows, 10 × 40 pictures, 200 typed FAQs), medians over 10 identical runs per read and 10 replaces
per write, then REVERTED to the shipped policy (confirmed identical path list, transformation 100 %).

| Read / write | Shipped policy | With the two paths | Verdict |
|---|---|---|---|
| **new** one sweep (per voice search) | 10.08 | 10.08 | identical — a projection cannot use an equality index |
| **new** images shape (per material send) | 4.82 | 4.82 | identical — `NOT IS_DEFINED(x) OR x = true` does not narrow on the index |
| today `ListSendableImageRefsAsync` shape (retired) | 5.24 | 5.01 | −0.23 on a query the new code no longer runs |
| replace a 40-picture File row | 19.86 | 19.86 | identical |
| replace a typed FAQ row | 10.29 | 10.29 | identical |

Rows returned were identical in every read (220 / 220 / 4). **Results identical, cost NOT lower ⇒ E is not
shipped**: `CosmosContainerPolicies.KnowledgeBase` keeps its 11 paths, and no §0.7 index change is proposed.
The two bits are projected, never filtered, by the sweep; the only filter that reads them is the images
shape, whose `NOT IS_DEFINED` branch the index cannot serve.

Sandbox left as found: policy = shipped policy (11 paths); **K1PROBE0000 purged (220 rows deleted)**; the
registry holds only the two live businesses (SX3SG2 ×3 Ready, MEE3IC ×1 Ready).

### Retrieval battery — still BLOCKED (unchanged from P0)

The Canada knowledge index (`clinket-knowledge-dev-v1`) still holds 0 documents; the live battery stays a
post-deploy sanity check once the owner's resync repopulates it. The non-degradation proof rests on the C#
byte-identity tests and the real-Cosmos sweep tests (see PLAN §12).

## P9 audit fix — Ask Clinket's "has documents" fact: COUNT → index-only TOP 1

`GetBusinessProfileTool` reads the provider's own fact (any Ready document, whoever may use it) live, once per
`get_business_profile` call. The audit replaced the partition COUNT with `AnyReadyAsync` (`SELECT TOP 1 VALUE
c.docId … status = Ready`, `MaxItemCount = 1`), measured on the Canada account (medians over 10 runs):

| Partition | `COUNT(1)` | `TOP 1` |
|---|---|---|
| SX3SG2 (3 rows) | 2.90 | 3.02 |
| K1PROBE0000 re-seeded (220 rows) | 8.59 | 3.14 |

Flat at ~3 RU whatever the library size, against a count that grows with it. The synthetic partition was
re-seeded for this one measurement and **purged again (220 rows deleted)**; the registry again holds only
SX3SG2 ×3 and MEE3IC ×1.

## 2026-09-08 — ONE FIELD (`receptionistAccess`) replaces the two bits: re-measured on Canada

The owner rejected the additive two-bit storage on sight ("one field in cosmos handle all three choice is best
solution... no fucking workaround or backward compatible"). The row now stores ONE word. Everything below was
re-measured after the rewrite, on a freshly seeded synthetic partition K1PROBE0000 (20 File rows — 10 carrying a
40-picture registry — and 200 typed FAQs, the words dealt round-robin so a third of each kind is NotUsed),
medians over 10 identical runs, then the partition was purged.

| Read / write | Two bits (2026-09-07) | One word (2026-09-08) |
|---|---|---|
| the sweep, per voice search (220 rows) | 10.08 | **9.67** (one field fewer to project) |
| the picture allow-list | 4.82 | **5.13** |
| Ask Clinket's "has documents" (`AnyReadyAsync`) | 3.14 | 3.14 |
| replace a 40-picture File row | 19.86 | 19.86 |
| replace a typed FAQ row | 10.29 | 10.29 |

Against the pre-programme baseline the per-search cost is still **13.21 → 9.67 RU** at the caps and
**6.12 → 2.92 RU** on the live 3-row business, and the sweep now also covers the 200 FAQs the old suppression
read never looked at.

The images query moved 4.82 → 5.13 because its filter is now an equality on a NON-indexed path where it used to
combine two paths, one of which (`shareWithCallers`) the engine could partially serve. 0.31 RU on the query that
runs only when a caller asks for pictures, in exchange for one field with one meaning — and it is recoverable
(below) if the owner wants it.

### Experiment E, re-run for the single field: ONE path `/receptionistAccess/?` — measured, NOT shipped

| Read / write | Shipped policy (11 paths) | With `/receptionistAccess/?` |
|---|---|---|
| the sweep (220 rows) | 9.67 | 9.67 |
| **the picture allow-list** | 5.13 | **4.67** |
| `AnyReadyAsync` TOP 1 | 3.14 | 3.14 |
| replace a 40-picture File row | 19.86 | 19.86 |
| replace a typed FAQ row | 10.29 | 10.29 |

Rows returned identical in every read. Index transformation reported 100 % before and after, and the policy was
REVERTED to the shipped 11 paths (confirmed by re-reading it, and the images query returned to 5.13).

**Not shipped: 0.46 RU (~9 %) on one infrequent query is not worth a §0.7 index change**, and unlike the two-bit
version there is now a real (if small) number on the table — recorded here so the owner can decide otherwise in
one line. The sweep cannot use an index at all: it PROJECTS the word and never filters on it.

### Sandbox data (owner permitted; no backfill code exists anywhere)

Both non-production regions were migrated in place by a scratchpad probe, carrying each row's own effective
setting across rather than blanket-setting anything: CA **4 rows**, IN **53 rows** (23 → `AnswersAndSends`,
30 → `AnswersOnly`, none `NotUsed`), the two retired properties removed from every one. `KnowledgeServiceDraft`
documents share the container and were deliberately untouched. Re-reported afterwards: 0 rows left to migrate in
either region.
