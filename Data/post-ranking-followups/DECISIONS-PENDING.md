> ‼️ **HISTORICAL — every question below was ANSWERED on 2026-09-29.** The answers are in `PLAN.md` §10 and the build
> instructions are in `FINAL-PLAN.md`. Do not act on this file; where it differs from them, they win.

# The session-2 question list — 2026-09-29 (all answered; see PLAN.md §10)

Evidence: `FINDINGS-OOM.md`. Designs: `DESIGN-TALL-PAGES.md`, `DESIGN-PICTURES.md`.

## D1 — §1 out-of-memory: the fix (recommendation)
- Measured cause: one render of the Glanza page = ~400 MB native (PDFium decodes all 51 pictures at full size); the
  dev instance is **512 MB** (`deploy.ps1:924`, non-prod), not 2 GB; renders of different documents stack; every page
  is rendered even when its reading is banked.
- Fix: (a) `RenderFlags.LimitImageCacheSize` on every page render — byte-identical pixels, −57% peak (393 → 167 MB);
  (b) render lazily: only pages whose reading is not banked, one at a time, released at once; (c) the heavy-work gate
  around page RENDERING and picture DECODING only — **not** around model calls (network-bound; the AI governor already
  bounds them) — the plan said "vision batches"; (d) oversize pages through clipped sections (tall-page design).
- Gate size: prod **3** (plan); dev on 512 MB: **1**, set per environment in `deploy.ps1` — or raise dev to 2048 MB.
  Recommendation: keep 512 MB (cheaper, and a harsher proof) with dev = 1.
- Needs from the owner: confirm the dev app's instance memory in the portal (Scale and concurrency).

## D2 — Tall/oversize pages: approve `DESIGN-TALL-PAGES.md`
Including: trigger on reading scale + the 17 in limit (not aspect ratio); cuts from the page's own evidence;
each section read by Document Intelligence + the reading model + the source check; stitched page banked under the page
key; caps with a plain notice, never a refusal.

## D3 — PDF library (recommendation: A)
A. Replace Docnet.Core 2.6.0 (PDFium chromium/5445, Sept 2023) with `bblanchon.PDFium.Linux` + `.Win32` 156.0.8076
(current, Apache-2.0/BSD) and a ~20-call in-house binding with one process-wide lock. B/C rejected (workaround /
unbounded memory).

## D4 — Pictures: approve `DESIGN-PICTURES.md`, and within it
- a. ceiling 40 → **300** (to be confirmed by the measured cost per 100 pictures) + row-size guard 1,000,000 bytes;
- b. `MaxTranscribedPictures` 5 → **50**;
- c. the space rule: pictures are trimmed to fit the business's remaining searchable parts; a document is refused only
  when its TEXT does not fit (today the whole document is refused);
- d. near-duplicates: collapse only "the same picture at another size" (32×32 colour ≤ 2% + aspect ≤ 1%), never a
  grey-scale perceptual hash (car colour variants); measured on the corpus before it ships;
- e. §8: a follow-up message of an older reading is dropped as superseded;
- f. `StaleProcessingMinutes` re-derived for picture passes (330 → ~430).

## D5 — §0.7: `readingProgress` on KnowledgeDocument (Cosmos) — for "Reading pictures: 40 of 108"

| Column | Answer |
|---|---|
| What | `KnowledgeDocument.readingProgress` (Cosmos `KnowledgeBase`, pk `/businessId`): `{ stage: "Pages" \| "Pictures" (enum as string), done: int, total: int }`, null when not reading |
| Who reads it | API `KnowledgeManagementService.ListAsync` → the document DTO → partner web + partner mobile knowledge list ("Reading pictures: 40 of 108", "Reading pages: 12 of 46") |
| Who writes it | the ingest worker, once per continuation pass (with the continuation), and the `CommitAsync` funnel clears it on every status that is not Processing (the same invariant as `cardsRewriting`) |
| Why not a column | Cosmos row; one-to-one with the document |
| Why not a constant/enum | the numbers vary per document; the stage IS an enum |
| Why not already stored | `readingNotices` means "things worth knowing about a document that works" (one field, one meaning); `processingSince` carries no count; nothing else holds progress |
| Cost | ~60 bytes per Processing row; NOT indexed (the container excludes `/*`); one extra row write per continuation pass (~10–40 RU at today's row sizes) |
| What breaks if omitted | nothing functional: the provider sees "Processing"/"taking longer" with no count for a long document (up to ~1 h for 300 pictures) |

## D6 — §2A dead-letter handler details
- a. **"Same reading" = the row's `ProcessingSince`, not `UpdatedAt`**: every API-started reading sets
  `ProcessingSince` in the write whose `UpdatedAt` is the message's epoch; a newer reading always starts later; the
  row's `UpdatedAt` moves on every later write, so the plan's "epoch equals the row's" would leave most dead rows
  Processing. Rule: stamp Failed only when the row is Processing and `ProcessingSince ≤ epoch`.
- b. A details re-cut (MetadataOnly) is started by the WORKER, so nothing ties that row state to its message. Fix:
  `BeginRecutAsync` stamps `ProcessingSince` = the message's epoch (the moment the edit was queued) — the same rule
  then holds for every mode.
- c. **Delete the nightly dead-letter drain** (`KnowledgeMaintenance.DrainIngestDeadLetterAsync` +
  `ServiceBusService.DrainDeadLetterAsync` + `DeadLetterDrainMaxMessages`): the trigger handles every message on
  arrival; the drain would race it (it abandons, raising delivery counts) and carries the open P4-C-17 defect.
- d. **Analytics** messages that die: the analytics run is stamped Failed on its own generation (the job's existing
  `CommitAnalyticsAsync` rule), so the row stops saying "Analysing" for ever; the document itself is untouched.
- e. **Bursts**: an admin alert is a row in the admin list (no email/push), and after deletion that row is the only
  evidence of the message. Recommendation: ONE row per dead-lettered message (deduped by MessageId), no cooldown —
  paging on a burst is the existing Azure Monitor `dlq-depth` metric alert. Alternative: one summary row per
  business per 15 min holding every message (needs a read-modify-write on the alert document).

## D7 — §2B out-of-memory alert
- The action group exists (`clinket-alerts-{env}` in `azureautomation/analytics-alerts.json`); the rule is added there,
  split by instance. Needs from the owner: run in the India dev App Insights (Logs) and send the result —
  `union exceptions, AppExceptions | where timestamp > ago(1d) or TimeGenerated > ago(1d) | where * has "WorkerProcessExitException" | take 5`
  — so the rule queries the table and columns the kills actually land in (the workspace-based rules use `AppExceptions`;
  the plan's query uses the classic `exceptions`).

## D8 — O1: which typed queries
Recommendation: `ScoringStatistics.Global` on every TYPED query of the public plane: the services BM25 (all expansion
phases) and its semantic leg, AND the leads matcher's typed query (same per-shard defect), each with its own
before/after. The private plane (Ask Clinket / receptionist) is NOT touched.

## D9 — O2: travelling providers
- No new index field is needed: every row already carries all its areas (centre, radius, city, name), the address city
  and the "comes to you" flags.
- a. Outside every served area, the distance shown is to the nearest served area's **centre** (the leads rule D-102/103)
  — or to its **edge**? Recommendation: centre (one rule across the product).
- b. A local provider: "Serves Hamilton · Based in Hamilton", or hide "Based in" when it is the same city?
  Recommendation: always show both lines (neither is favoured).
- c. Distance sort, browse: the index orders by the nearest area centre, then the window (`MaxResultDepth`) is re-sorted
  with 0 inside a served area — an area whose centre ranks beyond the first 500 rows cannot be reached (radius ≫
  distance to 500 nearer centres; stated, not hidden).

## D10 — O3: §0.7 for `listingReviewCount` (services index only)

| Column | Answer |
|---|---|
| What | public services index field `listingReviewCount`, `Edm.Int32`, sortable only (not searchable, filterable, facetable), **null when the card shows no count** |
| Who reads it | `AzureSearchQuery` browse "Most reviewed" `$orderby listingReviewCount desc, serviceRatingSortScore desc, id asc` (new `IndexOrderFor` arm); the card keeps reading the same value through the mapper |
| Who writes it | the one builder, `AzureSearchIndexer.CreateServiceSearchDocumentAsync` (line ~1768), as `RatingValue.ServiceOrBusiness(...).ReviewCount` — exactly what the card shows |
| Why not already stored | `serviceReviewCount` / `businessReviewCount` hold one source each; the card shows one OR the other, which no `$orderby` can express |
| Name | checked: `serviceReviewCount`, `businessReviewCount` exist; `listingReviewCount` collides with nothing |
| Cost | one Int32 per row, sortable (doc-values); sandbox indexes rebuilt (no backfill) |
| Provider list | needs NO field: its card shows `businessReviewCount` and "Most reviewed" already orders at the index by it (one rule) |

## D11 — Deploy guard scope
- a. Also add the six Cosmos `%…%` tokens missing from `deploy.ps1`'s `$script:RequiredFunctionAppSettings` (the same
  class of gap — deploy.ps1's own check would not have caught the India gap either). Recommendation: yes.
- b. The same guard for API/MCP: to be decided after I check how those hosts fail on a missing setting.

## D12 — §7 findings the live tests will hit
- a. §12.5: the set/change/clear path patches the profile FIRST and writes the audit alert AFTER; if the alert write
  fails the change stands with only a log line — "exactly one audit alert per change" is not guaranteed. Proposed fix:
  audit first with a fixed id, then the patch, the same order the lapse path already uses.
- b. §12.5: a lapsed override is cleared only for businesses the nightly job scores or when the audit rotation reaches
  them (1 business per night in the sandbox) — the build-state doc says "swept nightly for every business". It stops
  counting for ranking at once either way (read-time `IsLive`). Proposed fix: decide whether the STORED fields must be
  cleared nightly for every business.
- c. Book again: detail pages offer it after a provider no-show (web + mobile); list cards only after Completed —
  should list cards offer it too? (Plan §7: owner decides.)
