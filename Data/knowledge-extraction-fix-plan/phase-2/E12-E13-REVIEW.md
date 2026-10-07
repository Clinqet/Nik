# E12 / E13 — the second, independent review the owner asked for

> **Owner, 2026-09-12:** *"what is your recommendation, and make sure and let the next session review it too
> and explore and recommend it to me its solution, and then I will confirm."*

Written by the Phase-2B session. **Nothing here is built.** Every claim in `PHASE-2B-PROMPT.md` §2.2.4 was
re-derived from the code rather than accepted, and the result is: **the numbers are all exactly right, the
diagnosis is right, and it is incomplete in one way that changes the recommendation.**

---

## 1. Claim-by-claim verification

| # | §2.2.4 claim | Verdict | Where I checked |
|---|---|---|---|
| 1 | `Voice:Knowledge:MaxPagesPerDocument` = **100** | ✅ exact | Functions `appsettings.json:1180` |
| 2 | `…Vision:PageConcurrency` = 4, effective = `min(this, AiBudget:MaxBulkConcurrency)` | ✅ exact — the class comment says it itself | `VisionTranscriptionSettings.cs:116-118` |
| 3 | `AiBudget:MaxBulkConcurrency` = **2** ⇒ effective concurrency 2 | ✅ value exact · ⚠️ **the conclusion is too generous — see §2.A** | `appsettings.json:1540`, `AiBudgetGovernor.cs:51,57` |
| 4 | `…Vision:TimeBudgetSeconds` = **900** | ✅ exact | `appsettings.json:1307` |
| 5 | `functionTimeout` 45 min · `maxAutoLockRenewalDuration` 60 min | ✅ exact | `host.json:4,32` |
| 6 | **E13** — the per-page cache write rides the budget token | ✅ **CONFIRMED, it is a real defect** | `VisionDocumentTranscriptionService.cs` — `ParallelOptions.CancellationToken = budget.Token`, the body's `token` is that token, `TryWriteCacheAsync` rethrows `OperationCanceledException` |
| 7 | Rasterization is **outside** the budget | ✅ **CONFIRMED** — `budget.CancelAfter(...)` is called *after* `await _rasterizer.RasterizeAsync(...)` returns | same file, the rasterize call precedes the budget clock |
| 8 | A continuation repays the **full Document Intelligence call** | ✅ **CONFIRMED** — `retryDegradedVision` bypasses the banked artefact, so `ExtractAsync` re-runs end to end | `KnowledgeIngestProcessorFunction.cs` `retryDegradedVision` / `artifact != null && !retryLostPictures && !retryDegradedVision` |
| 9 | Budget exhaustion does **not** throw; the row completes **Ready** and R-5 never fires | ✅ CONFIRMED — it returns a degraded transcription; R-5 keys on `KnowledgeIngestRetryableException`, which this path never raises | same file, the `budgetExhausted` return |
| 10 | `MaxDocumentsPerBusiness` = 20 and queue session id = businessId bound abuse | ✅ both exact (`appsettings.json:1178`; `KnowledgeIngestQueue.SessionId(businessId) => businessId`) · ⚠️ **per tenant only — see §2.A** | |
| 11 | `AiAttemptBudgetPerDocument` = 6000, sliced per delivery | ✅ exact — `6000 / MaxDeliveryCount(5)` = 1200 attempts per delivery | `appsettings.json:1236,1001`; `KnowledgeIngestProcessorFunction.cs` `new AiAttemptBudget(...)` |

**Nothing in §2.2.4 was wrong.** The corrections below are things it did not look at.

---

## 2. What the analysis missed — and it changes the recommendation

### A. ‼️ The budget is a wall clock measured against a resource the document does not own

`AiBudgetGovernor` holds **two bulk slots for the whole process**, shared by every bulk AI flow — other
documents, captioning, embedding, the drafts judge. And `host.json` sets **`maxConcurrentSessions: 8`**, so up
to **eight businesses' documents run at once**. A page waits for a slot in `AcquireAsync` for up to
**`MaxAcquireWaitSeconds: 120`** — and *that wait happens inside the document's own 900-second budget*.

⇒ A document's effective page concurrency under load is **below 1, not 2**, and its budget can be spent almost
entirely on queueing for other documents' work.

**This is the single most important fact in the whole question**, because it disposes of two options:

- **Raising `TimeBudgetSeconds` (option A) buys less under load than it looks**, because the extra seconds are
  spent in the same queue.
- **Raising `PageConcurrency` (option B) provably buys nothing** — the governor is the ceiling and the setting's
  own comment says so. Raising `MaxBulkConcurrency` instead is a *process-wide capacity* change affecting every
  bulk flow, not a knowledge-ingest fix.

It also strengthens option D: a continuation gets a **fresh budget**, and everything already read is banked.

### B. `MinBulkRequestSpacingMs: 250` is a hard dispatch floor

Every bulk dispatch is spaced ≥ 250 ms per deployment: 100 pages ⇒ **≥ 25 s of pure spacing**, whatever the
concurrency. Small against 900 s, but it means concurrency can never fully parallelise dispatch.

### C. ‼️ A TRAP FOR THE E12 BUILD — `retryDegradedVision` is gated on `deliveryCount <= 1`

```csharp
var retryDegradedVision = artifact is { VisionDegraded: true } && deliveryCount <= 1;
```

A **redelivery** of the same message replays the degraded artefact whole. Service Bus is at-least-once, so a
continuation ticket *will* eventually be redelivered. **A continuation design that leans on
`retryDegradedVision` will, on a redelivery, silently finalise a half-read document as Ready.** The
continuation must carry its own intent, not inherit this flag.

### D. E13's blast radius, stated honestly

When the budget fires, three kinds of in-flight work die: the page's **model call** (inherent — you cannot
finish work you just cancelled), any paid **third-reading verification** inside `AdjudicateAsync` (also on the
budget token, also inherent), and the **cache write of an answer already in hand** (*not* inherent). Only the
third is work that is complete and merely unsaved, so the prompt's narrow fix is correctly scoped — but the
saving is smaller than "up to `PageConcurrency` pages per cut": it is only the pages whose upload was in
flight at the instant of the cut.

### E. `IngestTimeoutSeconds: 1800` is the real container

There is a **per-delivery pipeline deadline of 30 minutes** (`appsettings.json:1235`) wrapping the whole
ingest, inside the 45-minute function timeout. The 900 s vision budget sits inside it and must leave room for
Document Intelligence, rasterization (unbudgeted), captioning, the summary, embeddings and indexing. Vision
already takes up to half of it, so "there is headroom in the 45-minute function" overstates the room.

---

## 3. ‼️ THE MEASUREMENT — and it changes the answer

**The one number nobody had.** Five documents pushed through the **deployed** Canada pipeline on `MEE3IC`,
2026-09-12 04:54–05:04, one at a time (the queue session serializes per business, so a serial push is the only
way to measure one document's own cost). Duration is the Cosmos row's own `createdAt` → `updatedAt`, so it is
server-side and free of client polling error. Every one reported `visionDegraded: false` — **the budget was
never exhausted and every page really was transcribed.** The documents were deleted afterwards.

| Document | Pages | Rows/page | Duration | Notes |
|---|---|---|---|---|
| `rate_card_01p` | 1 | 10 | **39.3 s** | |
| `rate_card_05p` | 5 | 10 | 56.0 s | ⚠️ overlapped the 1-page run on the same session — excluded from the fit |
| `rate_card_20p` | 20 | 10 | **88.9 s** | |
| `rate_card_60p` | 60 | 10 | **165.0 s** | 245 cards |
| `rate_card_dense_20p_45r` | 20 | **45** | **148.9 s** | ~4.5× the text per page |

**The fit** (clean typed Latin pages, concurrency 2, **no contention**):

```
fixed overhead ≈ 37 s   (Document Intelligence + rasterization + summary + embeddings + index + analytics)
per page       ≈ 1.9 s  (20 → 60 pages)   … 2.6 s (1 → 20 pages)
dense page     ≈ 5.6 s  (45 rows/page)
```

### ‼️ What this does to §2.2.4's central claim

§2.2.4 argues `100 pages ÷ 2 at a time = 50 rounds; 900 s ÷ 50 = 18 s per page`, and that a luna page "does
not reliably land in 18 seconds". **The measurement says a page lands in roughly 4–6 seconds of model time,
three to nine times faster than that assumption.** Extrapolated:

| 100-page document | Predicted | Against the 900 s budget |
|---|---|---|
| clean typed (10 rows/page) | **≈ 237 s** | **26%** — finishes comfortably |
| dense typed (45 rows/page) | **≈ 597 s** | **66%** — finishes |
| dense **and** non-Latin (≈2.5× tokens per character — `KnowledgeTokenEstimate`) | ≈ 1,000–1,200 s | ‼️ **exceeds** |
| any of the above **under contention** (8 sessions, 2 global slots) | up to several × worse | ‼️ **exceeds** |

⇒ **"We accept documents we cannot mathematically finish" is FALSE for ordinary documents.** The page cap and
the time budget do **not** contradict each other at 100 pages; a clean 100-page price list finishes in about
four minutes. I was asked not to take the analysis on faith, and this is the part of it that does not survive
measurement — **the recommendation below is different because of it.**

**But the cliff is real at the tail**, and it is exactly the tail this programme cares about: a dense
non-Latin 100-page document, or any long document while seven other businesses are ingesting. And when it is
hit, today's behaviour is the genuine defect — **the row goes Ready with the quick reading for the whole
document, and nothing continues it.**

**Caveat, stated plainly:** these numbers were taken on an idle sandbox. They are a **best case**. I did not
manufacture contention (it would need several businesses ingesting at once, and only one business had document
headroom), so the contention multiplier above is derived from the governor's own parameters, not measured.

---

## 4. Options, and my recommendation

| # | Option | Verdict after measuring |
|---|---|---|
| A | Raise `TimeBudgetSeconds` | ❌ **not needed and not a fix.** Ordinary documents use a quarter of the budget; the tail cases are the ones that overrun, and under contention the extra seconds are spent queueing (§2.A). It also eats the 1,800 s per-delivery deadline the rest of the pipeline needs |
| B | Raise concurrency | ❌ **`PageConcurrency` provably buys nothing** — the governor is the ceiling and the setting's own comment says so. Raising `MaxBulkConcurrency` is a process-wide capacity change for every bulk flow; not a knowledge fix |
| C | Lower `MaxPagesPerDocument` | ❌ **now clearly wrong.** A 100-page document finishes in ~4 minutes. Lowering the cap would refuse documents that work today |
| D | **Self-continuation** | ✅ **RECOMMENDED** — the only option under which the tail cases, and a 500-page document, ever finish |
| E | **Split the artefact** so a continuation reuses the parse | ✅ **do it with D** — verified: a continuation today repays the whole Document Intelligence call |
| F | One queue message per page | ❌ over-engineering; the session serializes pages anyway |
| **G** | **NEW — derive the vision budget from the remaining delivery deadline instead of a standalone 900** | ✅ **do it with D.** A hardcoded 900 is a guess that has to be re-guessed whenever the rest of the pipeline changes; the honest bound is "stop in time to finish the rest of this delivery". It removes a magic number rather than re-tuning one (§1A.2) |

### My recommendation, in priority order

**1 — E13's token fix, the dead dial, and the page-cap copy. Small, safe, independent.**
Move the per-page cache write off the budget token (bounded by its own short timeout, exactly as the
compensation path already does); delete or make authoritative `PageConcurrency`, which today lies to whoever
tunes it; and give `Error_KnowledgeTooManyPages` its two numbers in all five languages, said at upload time
from the pre-count. **Cost:** near zero. **What breaks if skipped:** paid work discarded at every cut, a dial
that misleads, and a provider told only "too many pages" without being told how many are allowed.

**2 — D + E + G: self-continuation, with the artefact split and a derived budget.**
When the budget expires with pages unread, enqueue a continuation instead of completing Ready-but-rough. The
row stays in the **Taking longer** state the approved mockup already draws. Bounded by: a **progress
requirement** (a continuation that reads zero new pages stops, permanently — this terminates a poison page, a
model outage and an unreadable document without anyone choosing a magic number), a derived max-continuations
ceiling, and the existing `AiAttemptBudgetPerDocument`, which a continuation consumes from rather than resets.

‼️ **And it must not lean on `retryDegradedVision`** — §2.C: that flag is off on a redelivery, so a redelivered
continuation would silently finalise a half-read document.

**Cost:** no extra AI spend per page (finished pages are already cached; only unread pages are bought). With E,
a continuation no longer repays the Document Intelligence call — that is a *saving* against today's "Read
again". **What breaks if skipped:** a dense non-Latin long document, or any long document under load, is
published to the phone receptionist with the quick reading throughout, marked Ready, and the only remedy is a
human pressing "Read again" repeatedly — each press today costing a full Document Intelligence analyze.

**What I am NOT recommending:** changing `TimeBudgetSeconds`, `MaxPagesPerDocument` or `MaxBulkConcurrency`.
The measurement says none of them is the problem.

---

## 3B. ‼️ THE TWO GAPS THE OWNER REQUIRED — both now MEASURED, and both change the verdict

> **Owner, 2026-09-12:** *"one measured case on an idle sandbox plus two extrapolations isn't enough to
> commit on."* Right. Here is the same question answered with numbers instead.

### Gap 1 — the non-Latin case, measured rather than extrapolated at 2.5×

A 20-page Gujarati price list (25 priced rows per page, `Nirmala UI`, a real text layer), pushed through the
deployed pipeline alone. Duration is the Cosmos row's own `createdAt` → `updatedAt`.

| Document | Pages | Duration | Per page |
|---|---|---|---|
| Latin rate card (10 rows/page) | 20 | 88.9 s | ~2.6 s |
| Latin rate card (45 rows/page) | 20 | 148.9 s | ~5.6 s |
| **Gujarati price list (25 rows/page)** | **20** | **228.7 s** | **~9.6 s** |

⇒ **100 Gujarati pages ≈ 37 + 958 = 995 s against a 900 s budget. It exceeds on its own, with no contention
at all.** My 2.5× extrapolation understated it: the measured factor against the comparable Latin page is
**3.7×**, and the whole-document factor against the light Latin card is **2.6×**.

**The token question, answered:** every run reported `visionDegraded: false`, and `Degraded` is
`BudgetExhausted || RasterizationFailed || PagesUnreadable > 0` — so `PagesUnreadable` was **0** on all of
them. A dense non-Latin page does **not** approach `MaxCompletionTokens: 6000`. **Truncation is not the
failure mode; time is.** That matters, because a truncated page would have been a different defect
(`PagesUnreadable`, which R-5 and the degraded notice already handle) rather than a budget problem.

### Gap 2 — contention, manufactured rather than argued

Four sandbox businesses pushed the same 20-page Gujarati list within 10 seconds of each other. The queue
session is the businessId, so one business's documents serialize and **only separate businesses compete** —
this is exactly the 8-session / 2-slot condition.

| Business | Duration |
|---|---|
| ZZCON1 | **793.4 s** |
| ZZCON2 | **786.2 s** |
| ZZCON3 | **787.8 s** |
| ZZCON4 | **787.0 s** |

All four landed within **8 seconds** of one another — fair-share, as the governor's semaphore predicts.
**Against the 228.7 s single-tenant baseline that is a 3.45× degradation**, close to the theoretical 4×
(four documents through the two slots one document had to itself), the difference being the fixed overhead —
Document Intelligence, embeddings, indexing — which does overlap across documents.

‼️ **Read the number against the budget: 789 s is 88% of the 900 s window, for a document ONE FIFTH of the
page cap.** One more concurrent tenant tips even a 20-page document over. A 100-page Gujarati document under
the same contention needs roughly **3,900 s** — it would exhaust the budget about four times over.

‼️ **And this is the OPTIMISTIC number.** These runs recorded `PageNotRenderable` for 96 of 96 regions: they
ran before the source-check fix, so the third reading cost them nothing. With it working, each of these
documents also buys up to `MaxVerifiedPagesPerDocument: 8` real `gpt-5.6-sol` High-reasoning checks **inside
the same window**.

### Gap 1, re-measured with the source check WORKING — and the cost model is not linear

The 228.7 s above was taken while the source check was dead on multi-page documents (96 of 96 regions
`PageNotRenderable`). Re-run after the renderer fix, same document, alone:

| | source check dead | source check working |
|---|---|---|
| Duration (20 Gujarati pages) | 228.7 s | **698.7 s** |
| `PageNotRenderable` | 96 / 96 | **0 / 96** |
| `CandidateReadingRetained` (P2-A's fallback) | 75 | **0** |
| Resolved on real evidence | 0 | **52 `ResolvedToCandidateReading` + 23 `UncertainThirdReadingUsed`** |
| `visionDegraded` | false | false (698.7 s is **78%** of the budget) |

Two things follow, and the second corrects my own arithmetic.

**1. The renderer fix is doing exactly what it should.** Every one of the 75 regions that used to fall to
P2-A's "nobody could settle this" rule now gets a real third reading and is decided on evidence. P2-A's rule
is still correct where it applies — it just applies far less often once the source check can see the page.

**2. ‼️ The cost is NOT linear in pages, because verification is capped per DOCUMENT.**
`MaxVerifiedPagesPerDocument: 8` × `MaxDiscrepanciesPerVerification: 12` = **96** — exactly the number of
regions recorded, so all eight slots were spent. Solving the two runs together:

```
total ≈ 37 s fixed  +  pages × 9.6 s (vision)  +  min(pages, 8) × 58.8 s (source check)
```

| 100-page Gujarati document | Predicted | vs 900 s |
|---|---|---|
| alone | **≈ 1,465 s** | **1.6× over** |
| under the measured 3.45× contention | **≈ 5,000 s** | **5.5× over** |

My earlier "≈995 s" was a straight-line extrapolation and **understated the alone case** (it omitted the
source check, which was broken when I measured) **and would have overstated a 500-page one** (verification
does not grow past eight pages). This model is the one to design against.

‼️ **A separate observation worth its own item:** on a 20-page document the eight verification slots were
exhausted by pages 1–8 at twelve discrepancies each. Pages 9–20's disputes were settled with **no evidence
and no recorded disposition** — the `WithoutEvidence` path. On a 100-page document that is 92 pages decided
silently. The ceiling is defensible as a spend bound, but the silence is not, and it is where P2-A's rule
still carries the weight.

### What the measurements settle

| Claim | Verdict |
|---|---|
| "We accept documents we cannot mathematically finish" | **True for the documents this programme exists for**, false for clean Latin ones. My §3 conclusion was right about the common case and too comfortable about the tail |
| Raising `TimeBudgetSeconds` would fix it | **No** — under contention the extra seconds are spent in the same queue, and 3.45× cannot be bought back with a bigger number |
| Lowering `MaxPagesPerDocument` would fix it | **No** — a 20-page document already reaches 88% of budget under load. The cap is not where the problem is |
| Self-continuation is needed | ‼️ **Yes, and by measurement rather than by argument** |

---

## 5. ‼️ OWNER'S DECISION — 2026-09-12, both approved

Asked as two separate questions with the recommendation marked; the owner chose the recommended option
for both.

| Item | Ruling |
|---|---|
| **The small safe items** — E13's token fix · delete-or-fix the dead `PageConcurrency` dial · the page-cap sentence with its two numbers in all five languages, said at upload time from the pre-count | ✅ **"Yes — build all three"** |
| **E12 — D + E + G** — self-continuation, the artefact split so a continuation stops repaying Document Intelligence, and a vision budget derived from the remaining delivery deadline instead of a hardcoded 900 | ✅ **"Yes — build D + E + G"** |

**Not approved because not proposed, and deliberately unchanged:** `TimeBudgetSeconds` as a tunable number,
`MaxPagesPerDocument`, and `AiBudget:MaxBulkConcurrency`. The measurement says none of them is the problem.

---

## 5. ‼️ Cross-check of this review (Phase-2 session 1, 2026-09-12) — and two gaps to close before the owner decides

The session that wrote §2.2.4 read this review and re-verified its **new** claims independently.
`IngestTimeoutSeconds: 1800` · `MinBulkRequestSpacingMs: 250` · `MaxAcquireWaitSeconds: 120` (and it is the
governor's own wait) · `MaxDeliveryCount: 5` · `maxConcurrentSessions: 8` — **all exact.**

**Three corrections to §2.2.4 are accepted:**

1. **The real container is 1,800 s, not the 45-minute function.** §2.2.4's "headroom in a 45-minute function"
   overstated the room. This review is right.
2. **E13's blast radius is narrower** than "up to `PageConcurrency` pages per cut" — only pages whose upload
   was in flight. The more honest figure.
3. **The 18 s/page premise does not survive measurement.** ~2–6 s is the real cost, so *"we accept documents we
   cannot mathematically finish"* is **false for ordinary documents** and must not be repeated.

**Two findings §2.2.4 missed are accepted and are material:** the governor-contention point (§2.A) and ‼️ the
`deliveryCount <= 1` continuation trap (§2.C), which would have shipped a bug. **Option G is better than
anything §2.2.4 proposed** — it removes a magic number instead of re-tuning one (§1A.2).

### ‼️ Two measurement gaps to close BEFORE the owner is asked to confirm

Both are cheap, and both replace a guess with a fact. §1A.5 already grants the access.

1. **The non-Latin per-page cost was never measured — only extrapolated at 2.5× via `KnowledgeTokenEstimate`.**
   That is the single case this whole programme exists for, and it is the one carrying the "exceeds the
   budget" verdict on the strength of an assumption. ‼️ **The fixtures already exist**: re-run
   `6fcd9c32e6e4c8397c7babc7121a462` (Gujarati PNG) and `4eeae96e1e0549538283705897ca3bc0` (Hindi/Gujarati/
   English PDF) **in place** and read the real per-page seconds off
   `VisionDocumentTranscriptionService.cs:306` (`{Transcribed} transcribed … in {Elapsed:0.#}s`). Also record
   whether a dense non-Latin page approaches `MaxCompletionTokens: 6000` — a truncated page is
   `PagesUnreadable`, a *different* failure from "slower", and it would change the shape of the answer.
2. **Contention was never measured, and §2.A makes it the dominant risk.** The review says it could not be
   done because only one business had document headroom — but `MaxDocumentsPerBusiness: 20` is **per
   business**. Create three or four sandbox businesses and push simultaneously: that is exactly the 8-session
   / 2-slot condition, and it is the condition under which every "exceeds" verdict is claimed.

**Until those two land, the recommendation is right but rests on one measured case (clean Latin, idle sandbox)
and two extrapolations.** The review says this itself — *"these numbers were taken on an idle sandbox. They
are a best case"* — which is the correct way to state it. Close the gaps, then ask.

**Recommendation to the owner is otherwise UNCHANGED and endorsed:** priority 1 (E13's token fix, the dead
dial, the page-cap copy) and priority 2 (D + E + G, self-continuation with the artefact split and a derived
budget), **not** changing `TimeBudgetSeconds`, `MaxPagesPerDocument` or `MaxBulkConcurrency`.
