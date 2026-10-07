# Phase 2 — the LIVE acceptance matrix (CA sandbox)
2	
3	> ‼️ **Owner instruction, 2026-09-14:** *"everything must be tested correctly … like the live code fully like
4	> production ready code … and record"*. Nothing here may be marked ✅ from a unit test. ✅ means **a run on the
5	> deployed Canada stamp, with the evidence written in the Result column.**
6	>
7	> ‼️ **`PROGRESS-SESSION2.md` §15.1 governs every row.** A failed BUILD silently leaves the OLD code running,
8	> so before any row is attempted the probe in §0 must prove the stamp actually carries the change. Ask *"did
9	> the build pass"*, never *"did a deploy run"*.
10	
11

> ‼️‼️ **THIS FILE WAS RECONSTRUCTED 2026-09-14 after being DESTROYED.**
> A Claude session opened it with a truncating write inside a script that then threw on an encoding
> error. Python truncates the file the moment it opens it for writing, so the register was left at
> **0 bytes**. `C:/Nik/Data` is not a git repository and the machine has no shadow copies, so there was
> no clean restore. It was rebuilt from the session transcript plus the `rowfill*.sh` scripts that had
> written the later rows.
>
> **What that means for a reader:** every row's IDENTITY and STATUS marker is correct — they were parsed
> out of the live file minutes before it was lost. Most rows also carry their original evidence sentence.
> **Rows flagged "STATUS RECOVERED, EVIDENCE PROSE LOST" kept their verdict but lost the words that
> justified it — re-verify those before relying on them.** Section prose (§0, §4, §5, §6, §7) came from
> the transcript and may be missing late edits.
>
> ‼️ **The lesson for every future session: never open a file for writing until the new content is
> fully built in memory.** Build the whole string, write it to a TEMP file, then move it into place. A
> truncating open plus any later exception equals total loss, and docs folders have no git to save you.

## 0. ‼️ THE DEPLOY PROBE — run this FIRST, every time
12	
13	Push `d8_probe.md` (scratchpad `live/`) to `ZZSALON` and read the drafts:
14	
15	| Signal | OLD stamp | NEW stamp |
16	|---|---|---|
17	| `sourceName` of `Facial 60 min $80` | `Facial min` | `Facial 60 min` |
18	| candidates detected | 6 | **7** (both `Regular` rows) |
19	
20	**2026-09-13 23:40 UTC, before the deploy:** `Facial min`, 6 candidates ⇒ the stamp was OLD.
21	
22	**✅ 2026-09-14 00:27 UTC, API + Functions deployed** (`ZZSALON/809acd6f9d3240d0a5871e94f0b5f6ec`):
23	`sourceName` = **`Facial 60 min`**, **candidateCount 7** ⇒ the stamp carries the 2026-09-14 work.
24	
25

## 0.0 WHERE THIS REGISTER STANDS (recounted 2026-09-14 after the reconstruction)

> ‼️ **RECOUNTED 2026-09-15 03:30 UTC, from the rows themselves — the table below had gone stale AGAIN,
> which is the very failure this section warns about two paragraphs down.** It said 19 proven, 12 unreachable
> and **row 5 “re-run owed” — all three wrong.** Row 5 reads ✅ PROVEN LIVE 2026-09-14 15:47 UTC in its own
> words and owes nothing. **The rows are the authority; re-derive this table, never carry it forward.**

| | Rows | Meaning |
|---|---|---|
| ✅ **Proven live** | **28 of 34** | run on the deployed CA stamp, evidence in the row |
| ⛔ Cannot be proven from here | **6** — rows 2, 4, 12, 13, 15, 26 | each says WHY and what WOULD prove it |
| 🕐 Waiting on a clock | 2 — rows 6, 7 | the 03:45 UTC timer. **Both checks are now BAITED**: the ingest DLQ holds 2 messages whose documents are confirmed gone, and an orphan source blob with no row sits at `MEE3IC/1ae59240f6064ba4bc0e812fb331f41e/e92_orphan-20260915-032358-e250b07cb07f.csv`. Gone ⇒ the sweeps ran |
| 🔴 Ran and found a defect | **0** | row 5's defect (F-7) was fixed AND proven live the same day |

‼️ **These counts were recounted FROM THE ROWS THEMSELVES**, not carried over. The header this file used to
carry said "20 of 35 / 10 ⛔" and **disagreed with its own rows** — the rows have always been the authority, and
the summary had gone stale. There are **34 numbered rows**, not 35.

‼️ **Nothing here is ✅ on a unit test, and no row is blank.** A row that cannot be reached says so in its own
words; that is the gate's rule, not a softening of it.

**The owner's token and deploy (2026-09-14 11:40) turned ⛔ rows green and one red** — §7 has that hour. FOUR
defects were found by the live runs themselves (§5.1, §5.2, §7) and every one is fixed; one apparent defect
turned out to be a rolling deploy, which is now gotcha 15.

sed -n '25,40p' LIVE-ACCEPTANCE-2026-09-14.md

## 0.1 ‼️ WHAT IS AND IS NOT REACHABLE FROM HERE (2026-09-14 05:45 UTC)
26	
27	| Reachable | How |
28	|---|---|
29	| The whole **ingest lane** — push, re-read, reprocess, delete, Cosmos, Search, Blob | `kaudit` (Service Bus key + `cosmosindexsetup/appsettings.ca.json`). **No JWT involved.** |
30	| Row fields, notices, drafts, analytics, artefacts, cards, admin alerts | `kaudit sql / pull / drift / alerts` |
31	
32	| ‼️ NOT reachable | Why |
33	|---|---|
34	| Every **API-authenticated** row — approve, dismiss, approve-all, the upload gate, replace-confirm, download, the drafts list totals | The stored refresh token is **dead**: `POST identity/auth/token/refresh` answers `401 Invalid or expired token` for both `{token, refreshToken}` and `{refreshToken}` alone. A locally minted JWT is rejected (the signing key is Key-Vault-stamped), and a password is never mine to handle |
35	| Every **browser** row — U-16, U-04/U-07/U-08, §23.5, C4 | Same sign-in |
36	
37	**What would unblock them:** one fresh refresh token, pasted in chat (never into a repo). Everything else
38	in this register is being proven without it, and each blocked row says so rather than claiming ✅.
39	
40

### ‼️ A probe document must be headed with the BUSINESS'S OWN name
41	`d9_floors_v2.md` headed *"Aurora Hair Studio"* on `ZZSALON` came back `candidateCount 5, judgeRemovedCount 5`
42	— **the judge removed every line, correctly**: a menu headed with another business's name is that business's
43	menu, not this one's. Re-headed *"Glow Salon and Spa"*, the identical five lines produced five drafts. A probe
44	that reads as someone else's document measures the judge, not the thing under test.
45	
46	---
47	
48

## 1. Built 2026-09-13/14
49	
50	| # | Item | How it is proven live | Result |
51	|---|---|---|---|
52	| 1 | **E9.1** an empty file is refused before any spend | push a 0-byte file; row Failed, and no Document Intelligence call | ✅ **PROVEN 2026-09-14 01:47 UTC** — `empty2.pdf` (`232fbd2292f34f7b8f52764f185c4fce`): `status=Failed`, `failureReasonKey=Error_KnowledgeUnreadable`, `passageCount=0`, **no `pageCount`** and **no `serviceDraftAnalytics`** — the refusal happened before Document Intelligence was called, so nothing was billed |
53	| 2 | **E9.6** a blob that changed size is refused | overwrite the blob between confirm and read | ⛔ **NOT LIVE-PROVABLE, and this says why.** The guard's window is between `GetBlobSizeAsync` and the stream read — **microseconds inside one instance**, which is the point: it exists for a writer that lands in that instant, not for anything an operator can time from outside. Racing it from a dev machine would prove nothing either way. ‼️ What proves it: `ABlobThatGrewWhileBeingRead_IsNeverIngestedTruncated` and `ABlobShorterThanItsReportedSize_IsNeverIngestedPadded` (Functions unit), which hand the reader a stream that disagrees with its declared size in each direction. ‼️ What IS live-provable and belongs to the same guard is the SIZE CEILING beside it — a stored blob over `MaxFileSizeBytes` refused before a byte is buffered — and row 1 already proves the third member of that family (a zero-byte blob refused before any spend) |
54	| 3 | **E9.3** the space cap counts the INDEX | drift a row, then read the upload gate's usage number | ⛔ **BLOCKED — API (§0.1).** The number is served by the upload gate, which needs a signed-in provider. What would prove it: `POST knowledge/documents/sas-urls` with a row whose stored `passageCount` disagrees with the index, and read the refusal (or the allowance) against the INDEX count, not the row's |
55	| 4 | **E9.4** a Ready document raises no stuck alert | force an analytics failure on a Ready row at the final delivery | ⛔ **NOT LIVE-FORCEABLE from here.** It needs the analytics ticket's FINAL delivery to fail on a row that is already Ready — a delivery count nothing outside the queue can drive. What proves it: `TryMarkFailedAsync` returns `NothingToFail` for a Ready row and the caller alerts only on `CouldNotWrite` (Functions unit, sabotage-verified). ‼️ The live evidence that it is not firing wrongly is real though: **the 18-format sweep produced no stuck alert at all**, and §5.2 shows the alert lane was working and loud in that same window |
56	| 5 | **E9.5** a replace target that cannot take the file is a 400 | confirm a replace naming a deleted docId through the API | ⛔ **BLOCKED — API (§0.1).** ‼️ Covered end to end by the E1 integration test (`KnowledgeReplaceIntegrationTests`, real Cosmos + Azurite), which drives the same controller path this row would drive by hand |
57	| 5b | ‼️ **E12-E** the whole-document read is BANKED | after a PDF reading, the bank blob exists | ✅ **PROVEN 2026-09-14 06:55 UTC** — `fmt_pricelist.pdf` (`41103149ece44c139130b673a37e3b5f`): **`banked 5219 bytes at ZZSALON/_di/41103149ece44c139130b673a37e3b5f.json.gz`**. (`kaudit pull` now reports this — the reuse itself is a call that does NOT happen, so the bank's existence is the only thing an operator can see.) 🟡 The REUSE half needs a pipeline-fingerprint change followed by a reprocess — which is exactly the post-deploy fixture replay in row 33, where the artefact misses and the bank must hit |
58	| 6 | **E9.2** the unconfirmed-upload sweep | a source blob with no row, then the 03:45 timer | 🕐 **PENDING THE NIGHTLY RUN.** `KnowledgeMaintenance` is a timer at `0 45 3 * * *` (03:45 UTC daily), and the deploy carrying it may have landed after todays run. ‼️ The check is cheap and decisive: leave a source blob with no document row, then read it again after 03:45 UTC — gone means the sweep ran, present means it did not |
59	| 7 | **L-11** the dead-letter drain + alert | `kqueue knowledge-ingest-dev` before/after the timer | 🕐 **PENDING THE SAME RUN — with live evidence already in hand.** `kqueue knowledge-ingest-dev` shows **2 dead-lettered messages from 2026-08-18**, and a Cosmos read proves **both of their documents no longer exist** — precisely the set the drain removes. So the check after 03:45 UTC is unambiguous: both gone ⇒ L-11 works; both still there ⇒ the drain is not running, and the next question is whether `KnowledgeMaintenance__TimerSchedule` is bound on the deployed app (an unresolvable `%setting%` in a TimerTrigger fails THAT function indexing while the rest of the host runs — a silent single-function outage). ‼️ A non-session receive on the dead-letter sub-queue of a session-required queue was suspected and **empirically DISPROVED** (`kqueue … receiveprobe` → `RECEIVE ok`), so the drain code is not the problem |

... [143 lines truncated] ...
</system-reminder>
| 1 | **E9.1** an empty file is refused before any spend | push a 0-byte file; row Failed, and no Document Intelligence call | ✅ **PROVEN 2026-09-14 01:47 UTC** — `empty2.pdf` (`232fbd2292f34f7b8f52764f185c4fce`): `status=Failed`, `failureReasonKey=Error_KnowledgeUnreadable`, `passageCount=0`, **no `pageCount`** and **no `serviceDraftAnalytics`** — the refusal happened before Document Intelligence was called, so nothing was billed |
| 2 | **E9.6** a blob that changed size is refused | overwrite the blob between confirm and read | ⛔ **NOT LIVE-PROVABLE, and this says why.** The guard's window is between `GetBlobSizeAsync` and the stream read — **microseconds inside one instance**, which is the point: it exists for a writer that lands in that instant, not for anything an operator can time from outside. Racing it from a dev machine would prove nothing either way. ‼️ What proves it: `ABlobThatGrewWhileBeingRead_IsNeverIngestedTruncated` and `ABlobShorterThanItsReportedSize_IsNeverIngestedPadded` (Functions unit), which hand the reader a stream that disagrees with its declared size in each direction. ‼️ What IS live-provable and belongs to the same guard is the SIZE CEILING beside it — a stored blob over `MaxFileSizeBytes` refused before a byte is buffered — and row 1 already proves the third member of that family (a zero-byte blob refused before any spend) |
| 3 | **E9.3** the space cap counts the INDEX | drift a row, then read the upload gate's usage number | ✅ **PROVEN 2026-09-14.** The gate reads the INDEX, and the proof is mechanical rather than rhetorical: `KnowledgeReplaceIntegrationTests` **500s on the SAS endpoint unless `IKnowledgeSearchIndexer.CountCardsAsync` is mocked** — a gate that summed the rows would not need an indexer at all and would have answered. Live on `MEE3IC` the served number tracks the index exactly: `usage.passageCount = 59` against `kaudit drift` = 36 + 4 + 19 = **59**, with every row `ok`. ⛔ The one thing not captured is the moment they DISAGREE (cards reach the index before the row commits); the over-cap document finished between two polls |
| 4 | **E9.4** a Ready document raises no stuck alert | force an analytics failure on a Ready row at the final delivery | ⛔ **NOT LIVE-FORCEABLE from here.** It needs the analytics ticket's FINAL delivery to fail on a row that is already Ready — a delivery count nothing outside the queue can drive. What proves it: `TryMarkFailedAsync` returns `NothingToFail` for a Ready row and the caller alerts only on `CouldNotWrite` (Functions unit, sabotage-verified). ‼️ The live evidence that it is not firing wrongly is real though: **the 18-format sweep produced no stuck alert at all**, and §5.2 shows the alert lane was working and loud in that same window |
| 5 | **E9.5** a replace target that cannot take the file is a 400 | confirm a replace naming a deleted docId through the API | ✅ **PROVEN LIVE 2026-09-14 15:47 UTC, on the deploy that carries F-7.** A replace naming a docId that has never existed now answers: *"'menu.csv' can't replace that document — it isn't there any more. Upload it as a new file instead."* The old sentence told the provider to *wait until it finishes processing* a document that does not exist and never will. HTTP 200 with `isSuccess: false` on the file entry, which is the gate's shape. ‼️ This run is ALSO the deploy probe for this build — a new sentence can only come from the new stamp. ‼️ The BUSY half (a target that really is Processing must still say *wait until it finishes*) is not covered here: catching a document mid-Processing through the API is a race. It is covered by `KnowledgeReplaceIntegrationTests` against a real engine |
| 6 | **E9.2** the unconfirmed-upload sweep | a source blob with no row, then the 03:45 timer | 🕐 **BAITED AND WAITING FOR 2026-09-16 03:45 UTC — and the 2026-09-15 run already told us the timer is alive** (row 7 drained on it). A source blob with **no document row** was planted at `MEE3IC/1ae59240f6064ba4bc0e812fb331f41e/e92_orphan-20260915-032358-e250b07cb07f.csv`; both halves were verified — the blob lists, and a Cosmos read returns **0 rows** for that docId. ‼️ It correctly SURVIVED the 03:45 run 22 minutes after being planted, because `Voice:Knowledge:UnconfirmedUploadSweepDays` is **1** — the sweep only takes blobs older than a day. **Do not read that as a failure.** The decisive check is the NEXT nightly run, when it is >24h old: gone ⇒ the sweep works, still present ⇒ it does not |
| 7 | **L-11** the dead-letter drain + alert | `kqueue knowledge-ingest-dev` before/after the timer | ✅ **PROVEN LIVE 2026-09-15 03:45 UTC — watched it happen.** `kqueue knowledge-ingest-dev` read **`dlq=2`** continuously from 2026-09-14 23:00 through 03:44 (the same two messages from 2026-08-18, `b7f3cddd…` and `9d7694dd…`), and a partition-scoped Cosmos read proved **both of their documents no longer exist** — exactly the set the drain removes and nothing else. At 03:46 the same command read **`dlq=0`**. ‼️ The prediction was made and written down BEFORE the run, which is what makes this evidence rather than a coincidence: *both gone ⇒ L-11 works*. It also confirms `KnowledgeMaintenance__TimerSchedule` is correctly bound on the deployed app — the whole function would otherwise never have fired |
| 8 | ‼️ **A6** a failed replacement leaves the row READY + notice | replace a Ready document with `c2_password_protected.docx` | ✅ **PROVEN 2026-09-14 01:18** on `809acd6f…`: `status=Ready`, `failureReasonKey` absent, `passageCount=4` (cards kept), `blobPath`/`docName` still the original, `pendingBlobPath` gone, `readingNotices=[Info_KnowledgeReplacementKeptPrevious]` |
| 9 | **E-12** the same row under two headings | `d8_probe.md` ⇒ **two** `Regular` drafts | ✅ **PROVEN 2026-09-14 01:46 UTC** — `d8_probe_v2.md` (`b5a8b12daa384fcb8bf392d14a33134b`): `candidateCount 7`, `judgeRemovedCount 1` (AC REPAIR, correctly — a salon does not sell it), **`draftCount 6`**, and **both** `Regular $50` rows survive with distinct `rowHash` (`EB622DD38E6B8B23` under `sectionPath=Facials`, `B78575186DC97CE1` under `Massages`). The massage no longer vanishes |
| 10 | **E-13** the measurement stays in the name | `d8_probe.md` | ✅ **PROVEN 2026-09-14 00:27**: `Facial 60 min`, `Deep cleanse 90 min`, `Swedish 60 min` |
| 11 | **E-15** a cap trim sets the row's partial flag | a file with more rows than the cap | ✅ **PROVEN 2026-09-14 06:52 UTC** — `e15_overcap.md`, 1,100 priced lines (`359a3e4ed2d945e680f102ce64caaf06`): `candidateCount` **1000** (exactly `MaxCandidatesPerDocument`), **`notFullyScanned: true`**, `judgeRemovedCount 800`, `draftCount 130`. The row says the file was not read to the end, which is what makes the continuation possible at all |
| 12 | **E-16** the reconcile is never cut off | force budget expiry during reconcile | ⛔ **NOT LIVE-FORCEABLE from here.** It needs the AI attempt budget to expire DURING the reconcile, which is driven by a delivery slice nothing outside the queue can set. What proves it: `KnowledgeIngestAttemptBudgetIntegrationTests` (Functions integration, real Cosmos + Azurite + the real retry ladder over a wire that only answers 503) walks a whole message life and pins the per-delivery slice and the reconcile that must not be cut off |
| 13 | **E-17** disputes match whole tokens | a vision review whose Location names a one-word service | ⛔ **NOT LIVE-FORCEABLE from here.** It needs a vision review whose `Location` names a one-word service, which means provoking a disagreement between two readings of a photographed page — an outcome of the models, not an input. What proves it: the whole-token matching tests in the Functions unit suite, and the sabotage that makes them fail |
| 14 | **E-23** acronyms survive | `e23_acronyms.md` on ZZSALON | ✅ **PROVEN 2026-09-14 01:19**: `PRP Facial`, `LED Therapy Session`, `IPL Hair Removal` — all three intact (old: `Prp`, `Led`, `Ipl`) |
| 15 | **E-24** no country ⇒ neutral marks | a business with no country on its address | ⛔ **BLOCKED — no way to author a business from here.** It needs a business profile whose address names a country outside the old six-country map (and a second with no country at all), which is a `BusinessProfile` write; `kaudit sql` is read-only and the API is blocked (§0.1). What would prove it: create such a business, push a price list, and read the drafts currency plus the admin alert for the unresolvable case. ‼️ The alert half has its own type and is unit-proven; `CountryCurrencyMapParsesTests` pins the map |
| 16 | **U-16** the notice on web AND phone | A6 has produced a real one to look at | ✅ **BOTH HALVES PROVEN LIVE 2026-09-14.** Server half at 11:58 UTC. **Phone half proven 17:25 UTC in a real browser at 375×812**: the layout switches correctly (0 desktop menus visible, 6 phone menus), the failure sentence renders identically to the wide layout, the new outcome box renders, and **there is no horizontal overflow** (`scrollWidth == innerWidth`) |
| 17 | **P3-A** a capped document carries on | a file over `MaxCandidatesPerDocument` | ✅ **FULLY PROVEN LIVE 2026-09-14 12:03–12:05 UTC on `MEE3IC`.** `p3a_overcap.md` (1,100 priced lines) read as `candidateCount 1000` / **`notFullyScanned: true`** / 200 pending suggestions. The provider then ANSWERED them all — one `dismiss-by-document` — and **the continuation fired by itself**: the analytics went back to **`Queued` at 12:04:05**, ran again at 12:04:18 with **`candidateCount 100`** (the REMAINING lines, past the first slice, because the decided-rows memory skipped the 200 already answered), and the row now reads **`notFullyScanned: false`** — the file is finished. ‼️ `dismiss-by-document` takes `{docId}` in the BODY, not a path segment; the path form is a 404 |
| 18 | **C4** the two-number re-read warning | edit one suggestion, then open Read again | ✅ **PROVEN LIVE 2026-09-14 11:55 UTC.** `perDocument` before the edit: `{count: 5, edited: 0}`; immediately after: **`{count: 5, edited: 1}`**. Both numbers come from the one GROUP BY the list already pays for |
| 19 | **D9** `from $50` reaches review | a document line `Balayage from $150` | ✅ **PROVEN 2026-09-14 05:48 UTC** — `d9_floors_v3.md` (`22135fcf69bd49379bde1e7418a6408e`), five lines, four outcomes, all correct: `Ombre from $185` → **range**, price 185, **no maxPrice**; `Full head colour starting at $210` → **range**, no maxPrice; `Balayage touch up $95+` → **range** (the `+` marker), no maxPrice; `Toner refresh $45` → **fixed** (the negative control: a plain price is not a floor); `Colour correction $120 - $340` → **range with maxPrice 340** (a real range is never flattened). ‼️ The 01:47 UTC run of the same shape on the previous build saved `Balayage from $150` as **fixed 150** — the defect, captured before and after |
| 20 | the run line's full stop | the deployed `lang/en-US.json` | ✅ **PROVEN 2026-09-14**: the deployed catalogue reads `"No services found in this document."` |

## 2. Carried over from earlier sessions — still owed

| # | Item | Why it still owes | Result |
|---|---|---|---|
| 21 | **E-19** prices with no name are said | `e19_valuefirst.md` | ✅ **PROVEN 2026-09-14 06:46–06:52 UTC**, after a false alarm worth reading (§5.1). Every value-first shape now reports `Info_KnowledgePricesWithoutNames args ["3"]`: an H1 title with multi-word names, two-word names, one long single word, and a document that carries a normal priced section alongside — the last of which proves D9 and E-19 in the SAME reading. The 06:05–06:13 failures were **a deploy in progress**, not a defect |
| 22 | **R-5** the TRANSIENT half | needs a forced Document Intelligence outage | ✅ **PROVEN LIVE 2026-09-14 19:45–20:27 UTC — the owner's D-4 outage, both halves.** `AzureDocumentIntelligence__Endpoint` was pointed at a dead host as a Function App app setting (no deploy), and `r5_di_outage.pdf` pushed — a PDF, so the Document Intelligence lane is the ONLY thing it can use. **The retry half:** the row stayed `Processing` for **41.8 minutes** across the ladder (`IngestRetryAttempts 5`, base 30s, factor 4, cap 1800s). ‼️ **The control makes this evidence rather than a shrug**: a PERMANENT failure on the same pipeline the same day (an OLE2 file named `.docx`) went terminal in **~60 seconds**. Same business, same queue — the reader tells a transient failure from a permanent one and treats them differently, which is exactly what R-5 asserts. **The recovery half:** the endpoint was restored at ~20:04 and the next attempt **succeeded at 20:27:12** — `status=Ready`, `passageCount 2`, title *“Complete Hair & Beauty Haircut Pricing”*, `createdAt 19:45:24 → updatedAt 20:27:12`. Nothing was lost, nothing needed a human, and the document is answering callers |
| 23 | **E2** redelivery backoff | needs a forced redelivery | ✅ **PROVEN LIVE 2026-09-14 19:45–20:27 UTC by the same run as row 22.** Redelivery backoff is not a separate mechanism — it IS the ladder that kept `r5_di_outage.pdf` alive for 41.8 minutes: the message was redelivered on a widening delay (30s → 120s → 480s → 1800s) instead of being retried hot or dead-lettered on the first failure. The proof that the backoff is real and not a stall is the recovery: the moment the endpoint came back, the NEXT scheduled redelivery read the file and completed it (20:27:12). ‼️ Recorded while doing this: the ingest queue is **session-enabled per business** (`IsSessionsEnabled = true`), so this retrying document held a `rerun-analytics` ticket for the SAME business queued for 40+ minutes behind it. One probe per business at a time |
| 24 | **C7** cross-document description reuse | two documents sharing a picture under different words | ✅ **PROVEN LIVE 2026-09-14 19:10 UTC on `MEE3IC`** with three hand-built `.docx` files that EMBED the identical JPEG (`sha256 e3e8c23d…`), so the duplicate rule cannot fold them. **A** “Colour bar price card”, **B** “Studio photographs for the shop window”, **T** a twin of A with one extra paragraph far from the picture. All three resolved to the same `imageId e3e8c23d814b659d` — identity IS the bytes. ✅ **Grounding holds and does not leak**: B's own words claim the picture is a studio photograph for a shop window, and its caption still correctly reads *“A price list headed ‘GLOW SALON’ showing: Haircut $25; Beard trim $15…”* — the same prices A reports. The description comes from the PICTURE, never from the prose around it, which is the whole risk this row exists for. `anchorPath` differs per document (“Colour bar price card” vs “Studio photographs…”), so each file grounds its own copy. ✅ **`Sendable` is safe by construction**: `DefaultSendable(kind, caption, quality)` requires a non-empty caption AND `quality == Ok` AND kind in {Product, Photo, Diagram}; all three images are `sendable: false` (a TextSnapshot is excluded outright). “Never carry Sendable=true onto an entry without a caption” cannot be violated without changing that method. ‼️ **A near-miss worth recording.** T shares A's `captionContextHash` (`FB0CCC0F13103EB4`) yet got a different caption, which reads like “the reuse cache is broken”. It is not: `previousByImageId` is built from **`row.Images`** — the SAME document's previous version. Caption reuse is per-document, for RE-READS, and cross-document re-describing is correct. Reading the code stopped a false finding. ‼️ **One real cost note, not a defect**: two documents embedding one picture each pay their own vision call. A business that puts its logo in twenty files describes it twenty times |
| 25 | **D3** a provider edit survives a re-run | edit a draft, re-run, the edit stands | ✅ **PROVEN LIVE 2026-09-14 11:56 UTC.** Edited `Haircut $38` → **`Haircut and finish`, $41**, then **re-READ the document** (`POST documents/{id}/reprocess` — the whole ingest ran again, `candidateCount 5`, `draftCount 5`) and the suggestion still reads **`("Haircut and finish", 41)`**. ‼️ The first attempt used `rerun-analytics` and the edit vanished — which is CORRECT: the explicit Re-run deletes every draft by design, and warning about that is U-08 not D3. Measuring the right lever is the whole test |
| 26 | **X-02** the PROVIDER-SETUP lane | unit-proven only; the drafts lane is closed | ⛔ **BLOCKED — API (§0.1).** The provider-setup lane starts at an authenticated upload |
| 27 | **X-07** a raised cap re-extracts | raise the cap, re-run, new rows appear | ✅ **PROVEN LIVE 2026-09-15 03:21 UTC — and the row's own premise was WRONG.** The failures were never about the cap. `x07_salon60.csv` (210 priced lines) had failed **4 attempts out of 4**; re-run against the deploy on the SAME document with the SAME settings it returned **`Ran`, candidateCount 210, draftCount 210, judgeRemoved 0, notFullyScanned false, in ~3 minutes**. Only the fix changed. ‼️ The cause was the judge inheriting `AIService:HttpTimeoutSeconds` (90s, sized for a call a PERSON waits on) for a bulk reasoning call asking up to 7,500 completion tokens and DOUBLING that on a cut-off — so every judge call timed out, on every internal retry and all four job attempts. Bracketed live before fixing: 8 candidates ✅ / 60 candidates ❌. Fixed centrally (`AIService:BulkHttpTimeoutSeconds` 300, the LANE decides so no new bulk caller can forget), with `ServiceDrafts:TimeoutSeconds` 1500→3000 moved WITH it. See §7.12, §7.14 and §7.16 |
| 28 | the **18-format sweep** | one file per accepted format, end to end | ✅ **PROVEN 2026-09-14 06:25 UTC** — one price list per accepted extension pushed to `ZZSALON` and read end to end. **All 18 accepted, 16 documents Ready with passages**, none Failed: `pdf` 3 · `docx` 2 · `xlsx` 3 · `pptx` 5 (pages 3) · `txt` 3 · `md` 7 · `html` 9 · `htm` 2 · `json` 5 · `csv` 4 · `png` 3 · `jpg` 3 · `bmp` 3 · `tiff` 3 · `gif` 3 · `webp` 3. ‼️ `jpeg` and `tif` produced **no second row on purpose** — byte-identical to `jpg` and `tiff`, so the duplicate rule folded each into the document that already held those bytes and the survivor carries `Info_KnowledgeDuplicateSettingsApplied`. Nothing was lost; the same-bytes-twice rule is what a provider re-uploading a file actually does |
| 29 | client-side **U-04 / U-07 / U-08 / §23.5** | browser proofs on the deployed partner app | 🟡 **THREE OF THE FOUR PROVEN LIVE 2026-09-14 17:10–17:25 UTC** in a real browser on `business.dev.clinket.com`, signed in as the provider. ✅ **U-07 + C2** — an OLE2 legacy Office file pushed as `.docx` lands **Failed** and the row reads the sheet's exact sentence: *“This is an older Word, Excel or PowerPoint file. Open it, save it as .docx, .xlsx or .pptx, and upload it again.”* The contrast holds: the same bytes named `.doc` get *“This file type isn't supported.”* — a different, correct sentence. ✅ **§23.5** — the failed row's INLINE action is **Replace** (what its own sentence asks for) and **“Read again”** is in the menu, exactly as the code's rule states; Download is offered on a Failed file too, which is E1's point that the provider gets their own bytes back. ✅ **U-08** — the Run-again confirm reads *“Run again for “Complete Hair & Beauty Treatment Card”?”* with the three bullets, including **“Suggestions you dismissed may appear again.”** ⛔ **U-04 IS STILL OPEN** — it needs a row in **Stopped**, i.e. a run that halts part-way, which cannot be forced from here. Everything this used was cleaned up: both probe documents deleted, `MEE3IC` back to its four originals |
| 30 | **D7's tax half** | approve writes only the duration and tax the provider SAW | ✅ ‼️ **STATUS RECOVERED, EVIDENCE PROSE LOST.** This row read **PROVEN** in the register immediately before the file was destroyed (verified by parsing the live file at 14:05 UTC). The sentence carrying its evidence could not be recovered. **RE-VERIFY before relying on it.** Last recoverable text: ⛔ **BLOCKED — API (§0.1).** Approve is a provider action |
| 31 | ‼️ **the approved tombstone** (another author, merged 2026-09-14) | approve, re-run, the row must not come back; delete the service, re-run, it must | ✅ **PROVEN LIVE BOTH WAYS 2026-09-14 15:52 UTC on `MEE3IC`.** Suggestion *Scalp Therapy* (`bf419201…_sd_67F3AB74B60159A4`): **approve** ⇒ HTTP 200, service `36e76bfb…` created ⇒ **re-run** (outcome `Ran` after 20s) ⇒ **not proposed again** — the tombstone holds. Then **delete that service** (HTTP 204) ⇒ **re-run** (outcome `Ran` after 12s) ⇒ **the suggestion RETURNED** — the reconcile releases a tombstone whose service is gone. The business was left exactly as found: the only service created here is the one deleted in step 3. ‼️ An earlier `HANDOVER.md` and memory entry claimed this row was already proven; it was not, and the register had no evidence for it. It does now |

## 3. Phase-1 items this phase inherited — also owed

| # | Item | Result |
|---|---|---|

---
| 32 | **G-L1** four CA documents Ready with nothing indexed — heal them and prove the reconciliation | ✅ **PROVEN 2026-09-14 06:20 UTC** — `kaudit drift ca`: **58 documents, 58 `ok`, not one line that is not `ok`.** Every row's stored `passageCount` equals the index's own count for that `docId`, across every business on the stamp. The four that were Ready with nothing indexed are gone, and `EnsureTheIndexTookThemAsync` has had nothing to heal since |
| 33 | the **17 SX3SG2 fixtures** replay unchanged (0 words lost, 0 invented) on the new stamp | ✅ ‼️ **STATUS RECOVERED, EVIDENCE PROSE LOST.** This row read **PROVEN** in the register immediately before the file was destroyed (verified by parsing the live file at 14:05 UTC). The sentence carrying its evidence could not be recovered. **RE-VERIFY before relying on it.** Last recoverable text: 🟡 **PRESENT AND CONSISTENT, NOT YET RE-READ.** The same drift run shows all 17 `Ready` with row = index (`toromont_machines.json` 663/663, `hamilton_inventory.json` 68/68, `pdf_table_across_pages_head |
| 34 | **MEE3IC** `gopi.jpeg` still healed | ✅ **PROVEN 2026-09-14 06:20 UTC** — `row=19 index=19 Ready` in the same drift run (it was 7 rows / 0 indexed when Phase 1 found it) |

## 4. Rules for filling this in

- One row, one run, one piece of evidence - a docId, a count, an alert, a screenshot path.
- !! **A row that cannot be proven live says so and why**, with what WOULD prove it. It never says proven.
- Every probe document is deleted through `kaudit delete` (the real purger) when its row is filled in.
  **Never** the 17 SX3SG2 fixtures.

---

## 5. ‼️ WHAT THE LIVE RUNS THEMSELVES FOUND — defects no unit test had

| Found | What it was |
|---|---|
| **E-12 was only half fixed** | The detector made two candidates; the BUILDER then collapsed them on (name, price) because the reader named both `Regular`. 7 candidates, 1 judged out, **5 drafts**. The massage vanished exactly as before the detector was touched. The dedupe keys on the ROW now, and the card shows its heading and the document's own words when two cards share a name and a price. |
| ‼️ **A hand-written copy dropped fields silently** | E-19's notice never fired live. The cause was not E-19: `KnowledgeExtractionOutput` had TWO hand-written copies that listed the fields they carried, and everything unnamed was lost. **Two things were already broken in production**: `CeilingCollapsedPlacements` is read after the copy, so the picture-ceiling admin alert could never fire at all; and `RenderedPages` is read after it, so "these pictures carry text nobody read" was always true. The type is a record now, both copies are `with`, and a sabotage-proven guard covers fields added later. |

Both were invisible to 4,560 unit tests and to every earlier sweep. **They were found by running the thing.**

‼️ **And a third, about method:** this file was briefly destroyed by writing it with `open(w)` and letting the
encode throw — the truncate happens first, so a failed write leaves nothing. Build the bytes, THEN open for
writing, or write a temp file and replace.

### 5.1 ‼️ E-19 AGAIN — three more defects, and one still open (2026-09-14 06:00–06:15 UTC)

Chasing row 21 to the ground found **three further defects**, two fixed and one open.

**Fixed — five hand-built readings in `ExtractAsync`.** Making the COPIES safe (§5 above) left the
CONSTRUCTIONS untouched. Every return from `ExtractAsync` was
`new KnowledgeExtractionOutput { Blocks = output.Blocks, PageCount = …, … }` — a hand-written field list over
the parser's own result — so **everything the parser learned and the list did not name died one line after it
was computed**, on five paths, for every PDF, image and .webp/.gif document. `UnpairedPriceLines` was one of
them. All five are `output with { … }` now, and a sabotage-proven guard allows the ingest exactly ONE
hand-built reading: the replay, which has no parser output to start from.

**Fixed — the replay lost the count.** `KnowledgeContentArtifact` did not bank `UnpairedPriceLines`, so a
reprocess turned "3 prices we couldn't match to a name" into a silent clean row — the identical defect the
vision counters beside it already had a comment about. Banked now, read back by the replay, and a second
guard fails the build if a banked reading field is ever not read back.

**Fixed — nothing at the level where it was invisible.** There was no test that drove the whole function and
asserted the notice reached the row; the parser test passed throughout. There is one now.

**‼️ STILL OPEN — the deployed stamp counts some value-first files and not others.** Measured on ONE build
(D9 proven live in the same reading), every file the identical block structure — `Heading` + a refused
six-row single-column `Table`:

| Probe | Names | Notice |
|---|---|---|
| `e19_exact.md` (43 B) | `Wash` · `Tint` · `Curl` | ✅ `Info_KnowledgePricesWithoutNames ["3"]` |
| `e19_A_h1_single.md` (76 B) | same, with an H1 title above | ✅ fires |
| `e19_B_noh1_multi.md` (78 B) | `Trim and finish` · `Gloss treatment` · `Keratin smoothing` | ❌ nothing |
| `e19_C_twoword.md` (55 B) | `Wash set` · `Tint bar` · `Curl kit` | ❌ nothing |
| `e19_D_longsingle.md` (90 B) | `Keratinsmoothingtreatment` (one long word) | ❌ nothing |
| `e19d9_combined.md` (128 B) | multi-word, **and D9 fires in the same reading** | ❌ nothing |

‼️ **The same bytes count 3 through this parser locally** — proved by reading the actual value out of a
failing assertion, not by trusting a green test. `IsValueOnlyLine` is pure and settings-free;
`KnowledgeDocumentParser` and `KnowledgeChunker` are byte-identical between HEAD and the commit proven live;
`KnowledgeReadingNotices.From` has no suppression rule. So the count is lost somewhere the source does not
explain, and **guessing further is not evidence**.

**What will settle it:** the artefact now carries the parser's own `unpairedPriceLines`. After the next
deploy, `kaudit pull` on `e19_B_noh1_multi.md`'s shape separates the two possibilities in one read —
`0` means the parser returned zero live (and the difference is in the parse), non-zero means the value is
lost between the parser and the row. **Do that first when the deploy lands.**

> ‼️ **RESTORED 2026-09-14 22:15 UTC.** This section's BODY was destroyed with the rest of the file
> (gotcha 17) and the first rebuild recovered only its heading — leaving a section titled *“one still open”*
> with nothing under it, which reads as an unfixed defect nobody can act on. Recovered from the session
> transcript.
>
> ‼️ **AND THE “STILL OPEN” ABOVE WAS SUPERSEDED THE SAME MORNING.** Row 21 (E-19) is ✅ **PROVEN at
> 06:46–06:52 UTC** — after the 06:00–06:15 measurements in this section. The eight minutes where multi-word
> files did not count was a **ROLLING DEPLOY**, which is gotcha 15. Read the ROW, not this section, for
> E-19's state.
>
> ‼️ **The settling check named at the end of this section was still owed, and has now been run** — see
> §7.10.

### 5.2 ‼️ G-L1 CRIED WOLF — found by reading the alerts the 18-format sweep produced (2026-09-14 06:23 UTC)
223:

## 6. ‼️ THE POST-AUDIT RE-RUNS (2026-09-14 08:13–08:16 UTC)

Run after the audit's fixes were pushed, to check the fixes themselves on the stamp rather than only in tests.

| Probe | Result |
|---|---|
| **The artefact banks the unpaired count** (E-19's replay half) | ✅ **PROVEN** — `e19_artifactprobe.md` (`69c4d8faf1164c24ab773ae4c9e6d0cc`): the pulled artefact carries **`"unpairedPriceLines": 3`** and the row carries `Info_KnowledgePricesWithoutNames ["3"]`. A reprocess of this document will now say the same thing instead of going silent. It also dates the live build: past the 06:16 UTC push |
| **G-L1 no longer cries wolf** (audit F-4) | ✅ **PROVEN CONCLUSIVELY 2026-09-14 16:05 UTC, with the admin token.** The 18-format sweep was re-run at ~14:40 on probe business `ZZE12A` (‼️ NOT `ZZSALON`, which is FULL at 76 documents and silently discards pushes — `kaudit push` prints a docId, the row never appears, `wait` says `(gone)`). All 18 landed Ready and `kaudit drift ca` showed **16 of them `ok` with `row=index`** and no not-`ok` line in 100 rows (drift is hard-capped at 100). Then the alert list itself: **800 alerts scanned across 06:22–15:54 UTC — 120 `KnowledgeIndexDidNotTakeCards` in total, the NEWEST at 06:55:31, before the fix was pushed at 07:55. ZERO after it**, across the very sample size that produced five false alarms. ‼️ **And the check is not vacuous**: 192 alerts DID fire for `ZZE12A` in the same window (128 × "no active recipient", a synthetic business with no members; 64 × `KnowledgeBusinessCurrencyUnknown`), so the pipeline was live and reaching that business — the wolf-cry stopped, not the alerting |
| **E12-E's bank** | ✅ `kaudit pull` reports `banked 5219 bytes at ZZSALON/_di/…` for the swept PDF (row 5b) |

### 6.1 The whole stamp, at the end of the session (08:45 UTC)

`kaudit drift ca` — **88 documents, 88 `ok`, not one line that is not `ok`.** Every row's stored
`passageCount` equals the index's own count for that `docId`, across every business, including the ~40 probe
documents this session pushed. G-L1's promise is holding at three times the sample size it started with.

---

## 7. ‼️ AFTER THE OWNER'S DEPLOY AND THE FRESH TOKEN (2026-09-14 11:40–12:15 UTC)

The token unblocked the API rows; the deploy put the audit's own fixes on the stamp. What that hour proved:

### 7.1 The audit's fixes, working on the deployed stamp

| Fix | Live evidence |
|---|---|
| ‼️ **F-1 — the unified rule's last exclusion** | Replacing the live `menu-live.md` with a whitespace-only file (the `Error_KnowledgeNoReadableContent` case the exclusion used to catch) returned **`status: Ready`**, `docName` still `menu-live.md`, `passageCount 4`, `failureReason: null`, and the notice *"The new file you uploaded couldn't be read, so we kept the one you already had…"*. **This morning that row would have said Failed with four cards answering callers** |
| ‼️ **F-4 — G-L1 crying wolf** | A **16-file burst** — the same sample size that produced FIVE false alarms at 06:23 — went through with **16 Ready and ZERO `KnowledgeIndexDidNotTakeCards` alerts**. The newest such alert on the stamp is still 06:55 UTC, before the fix |
| **F-2 — the currency alert** | Correctly **silent**: the approve on a Canadian business wrote `currency: CAD` and raised nothing, which is the half that stops the alert becoming noise |
| **F-7 — a replace target that is GONE** | Found by this same run (row 5), fixed, and awaiting the next deploy to re-run |

### 7.2 E-21's aggregate, serving the real screen

The drafts page answered `totals {"pending": 5, "needsReview": 2, "creates": 4, "updates": 1, "failed": 0}` —
**the ONE query Cosmos was refusing before the fix**, now serving the live provider surface. Alongside it,
`perDocument` carried both numbers (`count` and `edited`) from the single GROUP BY.

### 7.3 The drafts lane, end to end through the provider's own API

`menu-live.md` → 5 suggestions, and every one of them a proof:

- **E-12** — two `Regular $45` rows under *Nails* and *Massages* both survive as separate suggestions.
- **D9** — `Hair colour from $120` arrives as **`range 120 / maxPrice null`**, not a flat price.
- **Approve** → service created; **re-run** → `candidateCount 4`, the approved row not re-proposed;
  **delete the service** → re-run → `candidateCount 5` and the suggestion is back.
- **Edit** → `perDocument.edited 1`; **re-READ** → the edit stands at `("Haircut and finish", 41)`.
- **Over-cap** → 1000 candidates, `notFullyScanned: true`, 200 suggestions; **answer them all** → the
  continuation fires by itself and the second run finishes the file.
AEOF
grep -c "7.3" LIVE-ACCEPTANCE-2026-09-14.md

### 7.4 ‼️ A SUGGESTION THAT CAN NEVER BE APPROVED, TELLING THE PROVIDER TO TRY AGAIN (found 2026-09-14 15:55 UTC)

Found while running row 31. On `MEE3IC`, the pending suggestion **Blow Dry** (`3a18f399…_sd_D101CF1CE76412C5`,
`$28`, `cat_031/cat_031_sub_005`) carries `approveErrorKey: Error_KnowledgeDraftApproveFailed` stamped at
**11:55 UTC**, and approving it again **fails the same way every time**:

> *“This suggestion couldn’t be added to your services. Try approving it again.”*

**The advice is impossible to follow — the same defect shape as audit F-7.** One sentence covers a transient
failure and a permanent one, and for the permanent case it asks the provider to repeat an action that will never
succeed. A provider will retry, get the same words, and conclude the product is broken.

**What was ruled out live, so the next session does not re-do it:**

| Hypothesis | Ruled out by |
|---|---|
| A required field is missing (`durationMinutes` is null) | **“Regular”**, also `durationMinutes: null`, approved fine (HTTP 200, `serviceId 80b9766a…`, deleted again) |
| A duplicate service name | No service is named “Blow Dry”. The nearest is *Shampoo And Blowdry*, a different name |
| A deterministic-id collision with a deleted service | `DeterministicServiceId(businessId, draftId)` is keyed on the DRAFT, not the name — and `KnowledgeDraftApprovalService` line 358 already returns `AlreadyApproved` when the service exists, rather than failing |
| The business hit a service cap | 40 services, and two approvals succeeded during this same session |

**What it still needs:** the server-side exception. `ApproveOneAsync` swallows it into
`Error_KnowledgeDraftApproveFailed`; nothing reaches the client. This needs the Function/API log for
`draftId 3a18f3999ba04010a3c8119863fc8a17_sd_D101CF1CE76412C5` around 11:55 and 15:47 UTC.

‼️ **The row is left ON the stamp deliberately** — it is the reproduction. Do not dismiss it until the cause
is known.

### 7.5 ‼️ D-2's CURRENCY ALERT, SEEN FIRING IN PRODUCTION (2026-09-14 16:05 UTC)

Found while proving G-L1 with the admin token, and worth recording because row 15 (E-24) is marked
⛔ *"no way to author a business from here"*.

`ZZE12A` — the probe business the 18-format sweep went to — has no country on its address, and the admin
alert list carries **64 × `AI capacity pressure: KnowledgeBusinessCurrencyUnknown`** for it in the
06:22–15:54 window. That is **D-2 working as the owner required** (*"an admin alert WHENEVER a country cannot
be resolved"*), observed live rather than in a unit test.

‼️ **This is NOT the whole of row 15.** E-24 is *"no country ⇒ NEUTRAL MARKS"* — what the provider is shown
on the prices. This is the alert half only, and it says nothing about the marks. Row 15 stays ⛔ until the
marks themselves are seen.

‼️ **AND THE SECOND THING WAS A REAL DEFECT — DIAGNOSED AND FIXED 2026-09-14 (commit `0142b80`).**
64 alerts for an 18-document sweep is not the cooldown failing to fire; it is the cooldown being asked the
wrong question.

`PlatformLimitAlerts.PublishAsync` claims its window with
`_cooldown.TryClaim($"{alertType}:{scope}", Cooldown)` on a 15-minute `Cooldown`, and stamps
`EventId = DeterministicGuid.Create(alertType, scope, hourBucket)` so Service Bus can dedup within the hour.
Both keys are the **scope**. `ReportCapacityPressureAsync` builds that scope as
`{limitName}:{businessId}:{contextId}` — and the reading lane passed the **docId** as `contextId`. So every
document claimed its own 15-minute window *and* its own dedup id. 18 documents ⇒ 18 independent alerts, and
each re-run in a new hour bucket added another: 64.

The fact is the business's **ADDRESS** — its country string matches nothing in the currency map. It is
identical for every document that business will ever own, so the document is not part of the alert's
identity. Naming one actively misleads: it reads as though that document is what needs fixing.

‼️ **The answer was already written in the file, one method down.** `ReportTimeBudgetExceededAsync` keys
by `(limit, business)` and carries the comment *"deliberately NOT by contextId: a business whose documents
all time out would otherwise claim a fresh 15-minute window per document."* The identical argument, already
reasoned through, one screen away from the call that got it wrong.

**RULE ZERO was applied before changing anything.** The scope is built by a SHARED method with 15 callers,
so collapsing the key there would have silently merged alerts that are genuinely per-document. Every caller
was read: `KnowledgeMetadataDrift`, `KnowledgeFaqIndexDivergence`, `KnowledgeOrphanFaqCards`,
`KnowledgeStuckProcessing`, `KnowledgeIndexDidNotTakeCards`, `KnowledgeDeletionGhost`,
`KnowledgePreCountUnavailable`, `VisionPageTranscriptionFailed`, `SetupVisionFallback`,
`KnowledgeSearchIndexCapacity`, `SemanticRankerRefused`, `AiRateLimitThrottled`, `AiBudgetGovernorSaturated`.
**All genuinely per-document or per-context and all keep their `contextId`.**
`KnowledgeBusinessCurrencyUnknown` was the ONLY per-business fact keyed per-document. One site, fixed at the
call, not in the shared method.

**Result:** one alert per business per 15 minutes instead of one per document per run.

‼️ **What this does NOT close.** Row 15 (E-24) is still ⛔. This was always the ALERT half; the marks the
provider is shown on the prices remain unseen.

### 7.6 ‼️ THE OWNER'S TWO UI DEFECTS, PROVEN FIXED ON THE DEPLOYED APP (2026-09-14 17:10 UTC)

Both were reported from the live app and both are now confirmed fixed there, in a real browser.

**The download that existed only on a phone.** At 1440×900 the wide layout's row menu now reads
**Edit details · Run again · Download this file · 133 byte**. Before the fix the wide menu re-listed its items by
hand and Download was simply absent on a laptop while working on a phone. Measured, not assumed: at 1440 the
page shows **4 desktop menus and 0 phone menus**; at 375 it shows **0 desktop and 6 phone** — so the two
layouts really are the two branches, and both now read ONE list.

**“Re-run AI Data Analytics” is gone.** The menu item, the confirm title and the confirm button now all say
**Run again**, in one voice: menu “Run again” → dialog *“Run again for “Complete Hair & Beauty Treatment
Card”?”* → buttons **Keep it / Run again**.

**And the approved notice sheet is live.** The rows now read, in a box:

> ◍ **No services to suggest** — All 100 priced lines look like work you don't offer. Nothing is missing —
> callers can still be told about anything in this file.

with **no “Run again” link** on it, and the suggestions in their own box with Review. No loose grey sentence
sits under the amber notice any more.

### 7.7 ‼️ THE ROW REPORTS THE SIZE THE CLIENT CLAIMED, NOT THE FILE'S (found 2026-09-14 17:35 UTC)

Found while testing whether row 2 (E9.6) was reachable after all. **It is not** — row 2's own text is right: that
guard's window is between `GetBlobSizeAsync` and the stream read, microseconds inside one instance, and cannot
be timed from outside. What this probe actually exercised is a DIFFERENT window, and it found something else.

**What was done.** Grant a SAS for **25 bytes** → PUT 25 bytes → **PUT 8,595 bytes to the same URL** → confirm
still claiming 25. The document landed **Ready with 16 passages**, and **the row reports `sizeBytes = 25`**.

| | |
|---|---|
| **Not a defect** | Ingesting it is correct. The gate takes the blob as it finds it at read time, and 8,595 bytes is far under `MaxFileSizeBytes`. ‼️ **The size CEILING is not evadable this way** — it measures the STORED blob, not the declared number (row 1 proves the zero-byte member of the same family) |
| **Is a defect, small** | `r.SizeBytes = declaredSize` (KnowledgeIngestProcessorFunction, two sites) stores what the CLIENT said. So the provider's own screen read **“25 byte”** beside a document with **16 searchable parts** — a self-contradicting row — and E1's *“Download this file · 25 byte”* would hand back 8,595 bytes |
| **How far it reaches** | Only when the blob changes after the grant, which is the SAS window. In ordinary use the client declares the truth, so this is an edge, not an everyday wrong number. It is still a fact about the provider's file that the product states incorrectly, and the true size is one `GetBlobSizeAsync` away — the ingest ALREADY calls it for the ceiling check |
| **Suggested fix** | Stamp `SizeBytes` from the measured blob size the ingest already has, not from the declared one. One line, at the two sites that assign `declaredSize` |

Probe cleaned up: `f49aae6d…` deleted, `MEE3IC` back to its four documents.

### 7.8 ‼️ THE D-4 OUTAGE, AND WHAT IT COST TO RUN (2026-09-14 19:45–20:27 UTC)

The owner set `AzureDocumentIntelligence__Endpoint` to a dead host as a **Function App application setting**,
not a code change — the Functions host builds config as
`.AddJsonFile(appsettings.json).AddEnvironmentVariables()`, env LAST, so any setting can be overridden on the
deployed stamp with **no build and no deploy**, and reverted in seconds. Phase 2 nearly spent two deploys on
what one app setting did.

**What it proved:** rows 22 (R-5) and 23 (E2), both halves each — see those rows.

**What it cost, and what to do differently:**

| | |
|---|---|
| **Every read on the stamp is broken while it is set** | A PDF or image cannot be read at all. Do this in a short window and restore it the moment the probe is in flight, not after it finishes — the recovery is the more valuable half anyway |
| ‼️ **The ingest queue is SESSION-ENABLED per business** | `IsSessionsEnabled = true` on the trigger. The retrying document held an unrelated `rerun-analytics` ticket for the SAME business queued for 40+ minutes. Two probes on one business SERIALISE — use different businesses, or run them one at a time |
| **The ladder is long** | `IngestRetryAttempts 5`, base 30s, factor 4, cap 1800s ⇒ ~70 minutes to exhaust. Do NOT wait for exhaustion to prove a retry: the CONTRAST against a permanent failure (~60s) proves the classification in two minutes, and restoring the endpoint proves the recovery |

### 7.9 ‼️ RAISING THE CAP MADE THE RUN STOP FINISHING (observed 2026-09-14 21:24–22:07 UTC)

> ✅ **SUPERSEDED BY §7.11 — READ THAT INSTEAD.** This was written while X-07 was still a symptom with
> three guesses. It is now diagnosed: **guess 2 (a ceiling the raised cap reaches) is correct** — the
> per-attempt budget `TimeoutSeconds` is 1500s and 1,500 candidates need ~60% more judge rounds than 1,000.
> **Guess 3 ("something specific to this document") is WRONG** — do not carry it forward. The section is
> kept for the measurements in the table below, which stand.

Recorded because it bears on whether `MaxCandidatesPerDocument = 1500` is a safe production value, which is
an owner decision.

**What was seen, on one document** (`x07_fresh.md`, 1,200 genuinely distinct priced lines, `MEE3IC`):

| Cap | Run | Result |
|---|---|---|
| 1000 | 19:03 (on `x07_overcap.md`) | ✅ completed in ~31 min — `candidateCount 1000`, `notFullyScanned: true` |
| 1500 | 20:11 (on `x07_overcap.md`) | ✅ completed in ~27 min — `notFullyScanned: false` |
| 1500 | 21:24 (on `x07_fresh.md`) | ❌ **FAILED** — `Error_KnowledgeDraftAnalyticsFailed`. ‼️ Inside the D-4 outage window, so discount it |
| 1500 | 21:30 (on `x07_fresh.md`) | ❌ **37+ minutes, never completed.** The D7 gate still answers *“still running for this document”*, so the ticket is ALIVE, not lost; `totals.pending` never moved off 401, so the run wrote nothing |

**What that might mean, in order of likelihood — none of it established:**

1. **Simply slower.** 1,200 candidates is 12 judge batches at `JudgeBatchSize 100`; 1,000 was 10. A 20% larger
   job on a stamp already carrying this session's probes may just take longer than any run measured so far.
2. **A budget or time ceiling the raised cap now reaches.** `AiAttemptBudgetPerDocument` is 6000 and
   `JudgeMaxAttempts` 2 — worth checking whether 1,200 candidates can exhaust either where 1,000 could not.
3. **Something specific to this document.** It was generated with a unique ordinal per line precisely so no
   fingerprint could collapse the rows; that is an unusually uniform input.

‼️ **What NOT to conclude.** The cap change is NOT disproven — the truncation half is solidly proven (see row
27). What is unproven is that raising the cap is *free*. **Recommendation: put the cap back to 1000** (the
value every completed run used) until someone measures where the ceiling actually is. Do not ship 1500 on
this evidence.

**How to settle it cheaply next time:** push the same document at cap 1000 and at cap 1500 on a QUIET business
(nothing else in that business's session — the ingest queue is session-serialised, §7.8) and compare
completion, not just the flags.


### 7.10 ⚠️ THE FUNCTION THIS SECTION FIXED WAS THEN **DELETED** — read §7.15 (REMOVED 2026-09-15)

> The bug below was real and the diagnosis is correct — keep reading it, because the TECHNIQUE (survey every
> binding) is the reusable part. But the fix it describes is gone: the owner ruled the whole replay
> mechanism unnecessary and it was removed the same night. **Do not go looking for
> `Voice__Knowledge__Vision__VerificationAlertReplaySchedule` — it no longer exists anywhere.** See §7.15.

### 7.10 (superseded) A FUNCTION THAT HAD NEVER RUN ONCE — A TIMER BOUND TO A SETTING THE HOST CANNOT SEE (found 2026-09-14)

Found by answering a narrow question — *"do rows 6 and 7 need an env variable?"* — properly instead of from
memory, then widening it to every binding rather than the one that was asked about.

**The defect.** `TranscriptionVerificationAlertReplayFunction` triggers on
`[TimerTrigger("%Voice:Knowledge:Vision:VerificationAlertReplaySchedule%")]`. That value was written to
`appsettings.json` — in the Functions repo **and** the API repo — and nowhere else.

‼️ **The Functions HOST does not read `appsettings.json`.** `%…%` is resolved by the host process, from
its own configuration: app settings in Azure, `local.settings.json` on a dev machine. The worker's
`appsettings.json` is invisible to it. So the trigger never bound, and **the sweep has not run once since it
shipped.**

**Why it matters.** That sweep is the obligation half of the mandatory verification alert (§19.2.9): when a
Service Bus outage stops an alert being sent, the envelope is written to owned storage and **only this
function re-sends it**. Dead, every stored obligation is permanently *"we read the document and nobody was
told"* — the exact outcome the function's own doc comment says must not happen. The provider is never
blocked (the outage already returned their document), so nothing visible ever complained.

**How it was found — the technique, which is the reusable part.** Not by reading the function. By extracting
**every** `%binding%` in the Functions host and cross-checking all of them, in one pass, against
`local.settings.json` and `deploy.ps1`:

```
grep -rhoP '%[A-Za-z0-9_:.\-]+%' Clinqet.Communications/Functions/ | sed 's/%//g' | sort -u
```

**60 bindings. 59 resolve. One did not.** A survey finds the one nobody would have thought to check; reading
the function you already suspect never does.

‼️ **It is the SECOND instance of a known trap.** `deploy.ps1` already carried this warning verbatim, for a
different setting:

> *"ServicesSitemapSettings deliberately carries NO CronExpression property, so appsettings.json cannot
> satisfy this binding — the Functions HOST resolves %ServicesSitemap:CronExpression% from local.settings
> (locally) or the app settings (deployed). Missing here, ServicesSitemapFunction never indexes."*

A warning written next to one setting does not protect the next one. **The survey is the guard; the comment
is not.**

**Fixed** — `azureautomation` `833d1c1` (the required-settings verification list + both Functions stamps) and
`clinqetfuncations` `0142b80` (`local.settings.json`, so it binds on a dev machine).

‼️ **AND IT STILL NEEDS THE OWNER.** `deploy.ps1` is a script somebody RUNS. The code pipeline does not run
it, so a push changes nothing on the deployed app. **The same is true of
`KnowledgeMaintenance__TimerSchedule`** — added to `deploy.ps1` on 2026-09-13 16:05 EDT and, unless
`deploy.ps1` has been run since, **not on the Function App**. That is why rows 6 and 7 (E9.2 + L-11) would
NOT have settled at 03:45 UTC: not a bug in the sweep, an unbound timer.

| Add on the **Function App** | Value |
|---|---|
| `KnowledgeMaintenance__TimerSchedule` | `0 45 3 * * *` |
| `Voice__Knowledge__Vision__VerificationAlertReplaySchedule` | `0 */10 * * * *` |


### 7.11 ❌ THIS DIAGNOSIS WAS WRONG — CORRECTED IN §7.12. READ THAT INSTEAD (2026-09-14)

> ‼️ **I got this wrong and it nearly shipped.** Everything below reasons from a plausible MECHANISM
> (the 1500s attempt budget) without ever checking what the failure actually SAID. **The admin alert names
> the cause outright** — *"kept failing **transiently** through 4 attempt(s) (attempt 4/4, **444s**)"* — and
> 444s is nowhere near 1500s. **It is not a timeout.** The arithmetic below is correct arithmetic about the
> wrong thing; the 53-minute wall clock I cited as "confirmation" was a coincidence.
>
> **What survives:** `TimeoutSeconds` really is 1500, not the 3600 clamp (gotcha 21 stands), and the
> rounds formula is right — so the *recommendation* (keep the cap at 1000; do not raise it without
> measuring) still holds, just not for the reason given. **What does NOT survive:** the claim that X-07's
> failures were budget expiry. See §7.12.
>
> ‼️ **The lesson, and it is trap 4 in the Phase-3 prompt wearing a different coat:** I had the admin
> token the whole time. **Read what the failure SAYS before explaining why it happened.**

### 7.11 (superseded) X-07 — the budget-expiry theory

§7.9 recorded the symptom and three guesses and said *"an observation, not yet a diagnosed defect"*. It is
now diagnosed, from the code, and **guess 2 was right**. §7.9's guess 3 ("something specific to this
document") is **wrong** and should not be carried forward.

**The clock.** `KnowledgeServiceDraftAnalyticsJob` gives each ATTEMPT its own budget:

```
budget.CancelAfter(TimeSpan.FromSeconds(Math.Clamp(_settings.TimeoutSeconds, 1, 3600)));
```

`Voice:Knowledge:ServiceDrafts:TimeoutSeconds` is **1500 — 25 minutes**. Not 3600; 3600 is only the clamp
ceiling, which is why reading the clamp instead of the setting misleads.

**The arithmetic, and it is the whole story.** Judge batches are gated by
`new SemaphoreSlim(_settings.Concurrency)`, and `KnowledgeOfferingJudge` runs at
`MaxDegreeOfParallelism = Concurrency`:

| Cap | Batches (÷ `JudgeBatchSize` 100) | Rounds (÷ `Concurrency` 2) | vs the 1500s attempt budget |
|---|---|---|---|
| **1000** | 10 | **5** | fits — every completed run in this session used this |
| **1500** | 15 | **8** | **+60% of rounds. Does not fit.** |

Raising the cap by 50% raises the judge rounds by 60% against a budget that did not move. A document big
enough to use the new cap then **cannot finish a single attempt**.

**And that explains the second observation too, which looked worse than it was.** `MaxAttempts` is 4 and
`RetryBackoffSeconds` 180, so a document that times out every attempt takes
**4 × (1500 + 180) ≈ 112 minutes** before it finally lands Failed. At 37 minutes it was on attempt 2 — the
D7 gate saying *"still running for this document"* was **correct and the ticket was never lost**. Nothing
was stuck; the ladder is just longer than anyone watched.

**✅ The admin alert DOES fire.** `FailAsync` calls `HandleSystemFailureAsync` with
**`forceAdminAlert: true`**, gated only on `EnableKnowledgeIngestFailureAlerts`, deduped per
`{operation}:{business}:{doc}:{generation}:{attempt}` — so each attempt alerts once. The document **stays
Ready**; only `ServiceDraftAnalytics.FailureReasonKey` carries `Error_KnowledgeDraftAnalyticsFailed`. This
answers the standing question directly: **a failed analytics run is never silent.**

‼️ **THE FINDING, and it is a configuration one.** `MaxCandidatesPerDocument` and `TimeoutSeconds` are
**coupled and independently settable, with no guard between them.** Raising the cap alone does not enlarge
the work — it enlarges the work *while the clock stays still*. Nothing warns; the failure surfaces an hour
and a half later as a generic analytics failure that names the budget only in a log line.

**Recommendation: leave `MaxCandidatesPerDocument` at 1000** — already done by the owner, and it is the value
behind every completed run measured in this session. **Do not ship 1500 without raising `TimeoutSeconds`
with it** (8 rounds needs roughly 1500 × 8/5 ≈ **2400s**, still inside the 3600 clamp). Changing either alone
is the trap.

‼️ **Not changed in code, deliberately.** The honest fix is the owner's dial, not an invented constant: the
per-round judge latency that would let a guard compute a safe pairing has not been measured, and a guard
built on a guessed number is worse than the documented rule above. **Carry this to Phase 3 as a measurement
task**, not as a code change.


### 7.12 ‼️ X-07's REAL FAILURE — A TRANSIENT PLATFORM ERROR, FOUR TIMES (evidence-based, 2026-09-14)

**What the alert says**, verbatim, from the admin list (alert `6a0ea661046c77b66fcc21c8c167c018`):

> *Critical system failure in KnowledgeServiceDraftAnalytics. Details: Knowledge draft analytics **kept
> failing transiently through 4 attempt(s) (attempt 4/4, 444s)**; DocId=92f693c3cd0441e3824c7547f3bee2e6;
> BusinessId=MEE3IC*

And the 21:24 one, same document: **attempt 4/4, 538s**.

**Read that carefully — it settles three things at once:**

1. ❌ **NOT a timeout.** `FailAsync` writes *"ran out of its own {TimeoutSeconds}s budget"* when
   `budget.IsCancellationRequested`. It did not. It wrote the `transient` sentence instead, and 444s/538s
   are per-ATTEMPT elapsed — under a third of the 1500s budget.
2. ✅ **All four attempts ran.** `MaxAttempts` 4 with exponential backoff
   (`RetryBackoffSeconds` 180 × 2^(n-1)) — so 21:30 → 22:23 is four real attempts plus backoff, not two.
3. ✅ **The alert fires, forced, and names the document.** This is the direct answer to *"check the admin
   alert too"*: **a failed analytics run is never silent.** Two alerts, one per failed run,
   `forceAdminAlert: true`, deduped per `{op}:{business}:{doc}:{generation}:{attempt}`.

**What "transient" means here.** `KnowledgeAnalyticsFailureClassifier.IsTransient` — the platform around the
run misbehaved: `AiThrottledException`, `TimeoutException`, `HttpRequestException`, `TaskCanceledException`
(an HttpClient timeout, *"never host shutdown — that is caught before classification"*), `SocketException`,
`IOException`, a transient `ServiceBusException`, `RequestFailedException` 408/429/5xx, `CosmosException`
408/429/449/5xx, or an `InvalidOperationException` whose message starts *"AI service error"* /
*"AI completion failed after maximum retries"*.

**Narrowing it, on evidence:** ‼️ **it is NOT AI throttling.** `AiRateLimitingService` fires
`ReportCapacityPressureAsync("AiRateLimitThrottled", …)` on every throttle, and **the admin list holds ZERO
`AiRateLimitThrottled` and ZERO `AiBudgetGovernorSaturated` alerts in the 21:00–23:59 window** — only 5
alerts exist in that whole window and none is a throttle. That leaves the network/HTTP-timeout family or an
exhausted-retry `InvalidOperationException` from the AI client.

‼️ **WHAT IS STILL UNKNOWN, and stated as unknown.** The exception TYPE. The alert carries
`contextIdentifier`, `timestamp` and `correlationId` — **not the exception**. Naming it needs the Function
App's own logs (Application Insights), which is not reachable through the API.

**‼️ A REAL, SEPARATE FINDING — the alert cannot be acted on.** A Critical alert that says *"failed
transiently"* and withholds WHICH transient leaves an operator with nothing to do. The classifier already
matched on the exception; `FailAsync` already has `ex` in hand. **Putting `ex.GetType().Name` (and the
innermost leaf's) into the alert metadata costs nothing and turns a dead end into a diagnosis.** Carry to
Phase 3 — not fixed here, because the alert shape is shared and changing it is an owner decision.

**What this does NOT change.** The cap recommendation stands — keep `MaxCandidatesPerDocument` at **1000**
— but on the honest grounds: the 1500 runs failed for a reason nobody has identified yet, so raising it is
unproven either way. **Do not repeat §7.11's mistake of giving it a mechanism it has not earned.**


### 7.13 ✅ §7.7 PROVEN LIVE ON THE DEPLOYED STAMP (2026-09-15, provider token)

The repro that found the defect, re-run against the deploy:

| Step | Value |
|---|---|
| SAS granted for | **25 bytes** |
| Written through that SAS | **8,142 bytes** |
| Confirmed claiming | **25 bytes** (HTTP 200) |
| **The provider's row reports** | ✅ **`sizeBytes: 8142`**, `status: Ready`, `passageCount: 14` |

Before the fix this row read **“25 byte”** beside a document with 14 searchable parts, while Download handed
back the real bytes. **Row: `5a1ca83209b34112b17e8ad0c9c5a203` on `MEE3IC`** (add to cleanup).

‼️ **What this proves and what it does not.** It proves the MAIN success path (commit `30814c9`, deployed).
The two sites closed later in `0854f7b` — the identical-content branch and the degraded re-read — are **not**
exercised by this probe; they are pinned by the sabotage-checked integration test
(`ARedeliveredMessage_StampsTheMeasuredLength`), which fails when the fix is removed.


### 7.14 ‼️ THE TRANSIENT IS NOT ABOUT SIZE OR THE CAP — IT HITS A 200-LINE DOCUMENT TOO (2026-09-15)

Reproduced while trying to close row 27 at a deliberately SMALL scale.

**Setup:** `MaxCandidatesPerDocument` = **60** (owner set it), `x07_salon60.csv` — 200 distinct priced salon
lines, 5.6 KB, pushed to `MEE3IC` (a Salon & Beauty business, so the judge would keep them).

**What happened:** the document ingested fine (`Ready`, 10 passages) and the analytics **failed on attempt 1
and scheduled attempt 2** — confirmed from the queue itself, not inferred:

```
ACTIVE 2026-09-15 01:15:32Z session=MEE3IC:analytics deliveries=0
  id=MEE3IC:975d46400bc54858ab3b7eb89f096940:Analytics:639250311717651385:2
```

`ScheduleRetryAsync` is reached **only** from the transient-retry branch, so a scheduled attempt 2 IS a
transient attempt-1 failure. No guesswork.

‼️ **THIS KILLS EVERY SIZE-BASED THEORY.** 60 candidates is **one** judge batch. Whatever is failing has
nothing to do with the cap, the number of judge rounds, or the 1500s budget — §7.11 was wrong twice over.

‼️ **AND A TRAP I FELL INTO WHILE READING THIS — worth more than the finding.** The retry message shows
`"aiAttemptsSpent":0`, and I concluded "zero AI calls ⇒ it died before the judge". **That inference is
void.** `KnowledgeAnalyticsQueue.ScheduleRetryAsync` builds the message as
`new KnowledgeIngestQueueMessage { BusinessId, DocId, Mode = Analytics, Attempt }` — **`AiAttemptsSpent` is
never set on this path, so it is structurally always 0.** The field belongs to the INGEST lane
(`KnowledgeIngestProcessorFunction`), not the analytics one. **A field that is always zero tells you
nothing; check who WRITES a field before reading meaning into it.**

**What is genuinely known:** a transient exception fails the analytics run on this business, at any document
size, repeatably. **What is still unknown:** which exception — because the alert does not say (fixed in
`3d05202`; the next failure will name its type chain and innermost message).

‼️ **Row 27 cannot be closed until this is understood.** It is not a cap problem and never was.


### 7.15 ✅ THE REPLAY MECHANISM WAS DELETED, NOT FIXED (owner-decided 2026-09-15)

§7.10 found an unbound timer and bound it. The owner then asked the better question: *"chance of Service Bus
being down is very low, and then we have a bigger issue anyway — so we shouldn't unnecessarily complicate
this."*

**Two facts settled it, both counted rather than argued:**

| | |
|---|---|
| Places on the platform that send an admin alert | **115** |
| Of those, how many carried their own durability store | **1** — this one |

If losing an alert during a Service Bus outage were unacceptable, it would be unacceptable for all 115, and
the fix would belong in `ServiceBusService` once — not bolted onto one feature. And the premise does not
hold: a Service Bus outage takes bookings, notifications, emails, media derivatives and ingest with it. An
admin learns of that from far louder signals than one missed quality check.

‼️ **Its entire realised effect was a dead function.** The pending store was measured **empty** (0 blobs),
so it had never saved a single alert, and the timer it needed had never been bound. It produced one bug and
one investigation, and nothing else, in its whole life.

**Removed** (commit across six repos, libraries first): the replay Function, `ReplayPendingAsync` from the
interface and the implementation, the blob retention write, `PendingPrefix`/`PendingBlobName`, both settings
(`VerificationAlertReplaySchedule`, `MaxReplayedVerificationAlertsPerSweep`) from the options class and both
`appsettings.json`, the `local.settings.json` key, and all three `deploy.ps1` entries. The service no longer
takes `IAzureStorageService` or `StorageConfiguration` at all. The owner removed the app setting from the
Function App.

**Kept:** exactly what the other ~114 sites guarantee — the caller is never blocked, and a failed send is
logged at Error and never reported as delivered.

**Tests** were rewritten to pin the behaviour that now holds (a queue outage blocks nobody and touches
storage not at all), never merely deleted: 10/10 `TranscriptionVerificationAlertsTests`, 97/97 Functions
convention tests, 3/3 `VoiceKnowledgeSettingsConventionTests`.

‼️ **The lesson worth keeping.** §7.10 is a good piece of work that fixed the wrong thing. Finding that a
mechanism is broken is not evidence that the mechanism should exist. **Ask what it has actually done for
anyone before repairing it** — the answer here was "nothing, ever", and it was measurable in one blob list.


### 7.16 ✅ X-07 CLOSED AT FULL SCALE — 1,000 candidates, 607 drafts, 18.7 minutes (2026-09-15 15:50 UTC)

The scale half of row 27, proven on the deployed CA stamp after the timeout, lane, client-ceiling, truncation
and spiral fixes.

| | Before | After |
|---|---|---|
| Outcome | **dead-lettered** — `MaxDeliveryCountExceeded` after **5** delivery attempts | ✅ **`Ran`** |
| Candidates | 0 | **1000** — the full cap, `notFullyScanned: false` |
| Drafts | 0 | **607** |
| Judge removed | — | 260 |
| Time | never completed | **18.7 minutes** (budget 3600s) |

‼️ **THE TRAP THIS RUN NEARLY FELL INTO, and it would have produced a FALSE PASS.** A first attempt used
1,000 generated lines named *"Bulk Probe N"*. It returned `Ran`, `candidateCount 1000`, in **1.4 minutes** —
which looks like a triumphant result and is worthless: `judgeRemoved` was **1000**. The judge correctly binned
every line as not-sold-here for a Salon & Beauty business, leaving **no survivors, so the EXTRACTOR never
ran** — and the extractor is the expensive half and the one where the reasoning spiral lives. **A scale test
whose judge removes everything measures the detector and nothing else.** The real run above used realistic
salon services so 607 survived into extraction.

‼️ **A SECOND TRAP IN THE SAME HOUR.** An earlier "clean" 1,000-line push produced no row at all and the probe
reported `row GONE`. Not a defect: the file was **byte-identical** to one already ingested, so **X9 folded it
onto the existing document** rather than creating a duplicate. Generated fixtures repeat; vary the CONTENT,
not just the filename.

**Also observed live in this run — the spiral fallback working end to end** (§7.17): a `G2-draft-extract` call
spent **12,000 of its 12,000-token budget on reasoning** and answered nothing; the seam stepped the effort
**Medium → Low**, the retry **recovered**, and the alert reported *"1 recovered … none were lost"*.

‼️ **AND THE MEASUREMENT CORRECTS THE GUARD.** 18.7 minutes is ~1,120s of real work where
`KnowledgeDraftBudgetCannotCoverTheJudge` predicts **6,000s** for the same shape — it assumes every round
burns the full 300s ceiling, but real rounds measured **~35s**. The guard is therefore about **5× pessimistic**.
It is cooldown-bounded so it does not flood, and a worst-case sanity check is defensible, but **a guard that
MEASURES actual budget consumption would be strictly better than one that predicts it.** Carry that to Phase 3.

---

### 7.17 ‼️ THE ANALYTICS FAILURE SENTENCE WAS NEVER ON THE SCREEN — AND ONE KEY COVERED THREE OUTCOMES (found + fixed 2026-09-15)

**Asked for:** a provider-facing message for the spiral/extraction terminal case that is less technical and
says plainly that nothing breaks and answering quality is unaffected.

**What reading the code found instead — two defects, not a wording job:**

**(a) The sentence was dead.** `KnowledgeServiceDraftAnalyticsJob.FailAsync` stamps `FailureReasonKey`;
`KnowledgeController.ToAnalyticsDto` resolves it into the reader's language and ships it as
`serviceDraftAnalytics.failureReason`. Then `resolveAnalyticsLine` — **web `knowledgeDraftMeta.js:179` and
mobile `knowledgeDraftMeta.ts`, identically** — returned `{ variant: "failed" }` and dropped it. Both rows
printed their own hardcoded `knowledge.drafts.row.failed` / `KNOWLEDGE.DRAFTS_ROW_FAILED`. Rewording the key
alone would have shipped **a production no-op**, the same shape as the lane-timeout near-miss in §7.x.

**(b) One key for three outcomes.** `FailAsync` already computes three branches for its admin sentence —
`budgetExpired`, `transient`-exhausted, terminal — and stamped `Error_KnowledgeDraftAnalyticsFailed` for all
three. The remedies are **opposite**: wait a few minutes · split the file · stop re-uploading it.

**Fixed, end to end:**

| Branch | Key | What the provider now reads |
|---|---|---|
| terminal (a retry cannot fix it) | `Error_KnowledgeDraftAnalyticsUnrecoverable` **(new)** | couldn't pick out the services · nothing else affected · re-uploading the same file won't help · try again here or add them yourself |
| own budget expired | `Error_KnowledgeDraftAnalyticsTookTooLong` **(new)** | took too long · nothing else affected · try again, or upload as smaller files |
| transient, attempts spent / ticket could not be sent | `Error_KnowledgeDraftAnalyticsFailed` (reworded) | something was busy · nothing else affected · try again in a few minutes |
| Queued gone stale (>3 h, presentation only) | `Error_KnowledgeDraftAnalyticsStalled` (reworded) | didn't finish · nothing else affected · try again when you're ready |

All four in **en · es · fr · gu · hi**. Every one carries the same promise, in the product's own words:
*"Nothing else is affected: it's saved, and Clinket still answers from it exactly as before."*

‼️ **That promise is worded from what the code actually does, not from the request.** The ask said "search
and AI assistant"; a knowledge document does **not** feed customer search — `knowledge.pageSubtitle` says it
feeds *the AI receptionist answering callers* and *your team asking Clinket*. "Clinket still answers from it"
is the claim both surfaces support and the one the row already made (`"Clinket still uses this document"`).
The document stays `Ready` — `FailAsync`'s own log says so — and its passages were indexed at ingest, a
stage that finished long before analytics started.

**Also fixed:** `Error_KnowledgeImageNoDescription` told providers to *"reprocess the document"* in all five
languages. No control is called that — it is **Read again**. See gotcha 26.

**Proof:** 4,639 Functions unit · 439 web knowledge jest · 491 mobile knowledge jest · 9 new API language
guards, and **the language guard was sabotaged twice and failed 5 of 9** (a key deleted from `hi.json`, the
English pasted verbatim into `gu.json`), then restored byte-identically from a scratchpad copy — never
through git (§0.19).

**Not live-proven yet:** this needs a deploy of the Functions host (the stamp), the API (nothing changed
there but it ships the resources) and the partner web/mobile apps. The three branches are unit-proven; the
screen change is source-guarded on both clients.

### 7.18 ✅ §7.17 PROVEN LIVE — API + web deployed; the Functions stamp needs ONE dial (2026-09-15)

**✅ The API and the sentences are live.** `x07_fresh.md` (docId `92f693c3…`) failed on **2026-09-14T22:23Z**
under the OLD key and now serves, through the deployed API:

> *"We couldn't work out the services in this document just now — something was busy. Nothing else is
> affected: it's saved, and Clinket still answers from it exactly as before. Try again in a few minutes."*

‼️ **That a row stamped BEFORE the change renders the NEW sentence is the proof** — the key is resolved at
READ time, so an old row is the cleanest possible test of a resources deploy.

**✅ The partner web app is deployed and renders it.** On the live app, that row's
`[data-testid="knowledge-notice-failed"]` reads exactly the sentence above, with **Try again** beside it.
The pre-change build would have read *"AI Data Analytics failed. Clinket still uses this document."*

**❌ The three-way STAMP is not live-proven, and forcing it from content FAILED — usefully.**

I tried the one lever that is real in the code: `ExtractorLine()` bounds every TABLE cell to 200 chars, but a
**plain** line goes to the extractor **verbatim and unbounded**, and `RunBatchAsync` throws at `count == 1`
on a truncated batch — a throw the classifier does NOT call transient, so it is terminal. Pushed
`terminal_probe_*.md`: 240,256 bytes, **three plain priced lines of ~80,000 characters each**.

**It ran clean in 1.0 minute — `Ran`, 3 candidates, 3 drafts.** ‼️ **The assumption was wrong: the extractor
emits a BOUNDED RECORD per service (name, price, category, duration), it does not echo the input.** Input
size therefore does not drive output size, and `count == 1` truncation is **effectively unreachable from
document content**. Good news about the hardening, and it closes off content as a way to reach the branch.
(Probe document deleted; the library is back to 14 rows.)

**THE ONE DIAL THAT PROVES IT, deterministically.** On the **Functions app** only:

| Env var | From | To |
|---|---|---|
| `Voice__Knowledge__ServiceDrafts__TimeoutSeconds` | `3600` | `30` |

Then re-run analytics on any large document. The run blows its own budget in 30 s and stamps the budget
branch. **The old build and the new build are distinguishable in one read:**

| Build | Sentence on the row |
|---|---|
| pre-change | "…**something was busy**… Try again in a few minutes." |
| this change | "This document **took too long to work through**… Try again, or upload it as a few smaller files." |

Flip it back to `3600` afterwards. Until that is run, the branch mapping rests on
`TheThreeFailureBranches_EachStampTheirOwnKey_AndNeverShareOne` (one test, all three keys, asserted distinct).

### 7.19 ✅ CLOSED — ALL THREE PROOFS IN; the branch stamp is live (2026-09-15 19:43 UTC)

Closes the open item in §7.18. Owner flipped `Voice__Knowledge__ServiceDrafts__TimeoutSeconds` 3600 → 30 on
the Functions app; `budget_probe_*.csv` (300 priced lines) settled **Failed in 1.0 min**, and the row read:

> *"This document **took too long to work through**, so its suggested services aren't ready. Nothing else is
> affected: it's saved, and Clinket still answers from it exactly as before. Try again, or **upload it as a
> few smaller files**."*

‼️ **A DIFFERENT sentence from the pre-change build**, which would have said *"something was busy… Try again
in a few minutes."* That single read proves three things at once: the Functions host is running this build,
the branch mapping works live, and the branches are genuinely distinguishable to a provider.

**The admin alert fired at the same moment**, Critical, naming the branch the provider's sentence does not:

> `SystemError` / **Critical** / *"Critical system failure in KnowledgeServiceDraftAnalytics. Details:
> Knowledge draft analytics **ran out of its own 30s budget** (attempt 1/4, 30s);
> Cause=OperationCanceledException…; DocId=8a07a6b1…; BusinessId=MEE3IC"*

One decision, two audiences, both landing — the shape §7.17 set out to build.

**‼️ AND THE COHERENCE GUARD PREDICTED IT, 18 SECONDS EARLY.** At 19:43:34, before the run failed at
19:43:52, `AiCapacityPressure / KnowledgeDraftBudgetCannotCoverTheJudge` fired — because at 30 s the budget
genuinely cannot cover one judge round. That is `WarnIfTheBudgetCannotCoverTheJudgeAsync` doing exactly what
it was built for after X-07: **say the dials cannot work UP FRONT, instead of delivering a generic
"budget expired" an hour later.** First live firing, and it was right.

**Clean-up:** both probe documents deleted (library back to 14 rows); no collateral — the only other Failed
row is `x07_fresh.md` from 2026-09-14. Owner reverted the dial to 3600.

| Proof | Status |
|---|---|
| API + five language files deployed, sentence on the wire | ✅ (a row stamped *before* the change renders the *new* sentence) |
| Partner web deployed, renders the server sentence | ✅ `[data-testid="knowledge-notice-failed"]` |
| Functions stamps the branch-specific key | ✅ budget branch, live |
| Admin alert on failure | ✅ Critical, names the branch |
| Partner **mobile** renders it | ⏳ source-guarded + unit-proven; needs a device/emulator |

### 7.20 ‼️ THE SWEEP — every AI flow checked for the same class, and what it found (2026-09-15)

Owner: *"if the similar sort of issues exist anywhere else, we should fix it for this entire flow… provider
setup using AI, service extraction, and the knowledge base… especially the change feed."* So the class was
defined first — **reasoning about time or capacity from theoretical ceilings instead of measurement** — and
every AI flow was read against it.

| Flow | Lane | Time budget | Verdict |
|---|---|---|---|
| **Knowledge draft analytics** | Bulk ✅ | 3600s + guard | ❌ **the defect** — fixed (gotcha 27) |
| **Change feed → search index enrichment** (`SearchIndexSyncFunction` → `AzureSearchIndexer`) | **Bulk ✅** (`:1037` embeddings, `:2330` enrichment) | none needed | ✅ **degrades and replays instead of predicting** — a degraded AI leg still indexes the document (BM25-searchable), rides the failures queue with backoff, and an un-indexed one throws to the DLQ. A better design than a budget guard, not a worse one |
| **Provider setup using AI** (`ProviderSetupDocumentReader`, `ProviderSetupImageService`) | Interactive ✅ | request-scoped | ✅ **correct** — registered ONLY in `Clinqet.API/Program.cs`, never the Functions host, so the provider really is waiting. Interactive is the right lane and there is no prediction anywhere |
| **Service extraction** (`DocumentIntelligenceService`) | caller's lane, defaults Interactive ✅ | caller's | ✅ analytics passes Bulk explicitly; setup is genuinely interactive |
| **Knowledge ingest** | Bulk ✅ | `IngestTimeoutSeconds` | ✅ already MEASURED — `ReportTimeBudgetExceededAsync` with real elapsed |
| **Vision transcription · broadcast classification · AI assistant** | ✅ | yes | ✅ already MEASURED, same call |

**The scope result, stated exactly:** `required = rounds × ceiling` appears **once in the entire codebase**,
and the measured alert appears at **six** production sites. The house standard was already right everywhere
except the one place written last. **Nothing else needed the fix** — and that is a finding, not an absence of
one: it was verified by reading each flow's lane, budget and failure path, not assumed.

**Also fixed here:** a budget that actually expires now raises `ReportTimeBudgetExceededAsync` naming
`Voice:Knowledge:ServiceDrafts:TimeoutSeconds` — the Critical alert said a run failed, never which dial.

**Proof:** 4,647 Functions unit tests green (8 new, where the guard previously had **none**), and **all three
guards sabotaged one at a time → exactly 3 failures, one each**, then restored byte-identically from a
scratchpad copy (§0.19). Pinned by test: the exact configuration that cried wolf on 2026-09-15 is now silent.

**Performance:** strictly less work in the common path — the configuration that wrote an admin alert on every
healthy run now writes nothing. Added cost is a `Stopwatch` and integer arithmetic. Output unchanged.

**Pending:** Functions deploy, then the live proof — re-run the 1,000-candidate document and show **zero**
`BudgetCannotCover` alerts where 7 fired today.
