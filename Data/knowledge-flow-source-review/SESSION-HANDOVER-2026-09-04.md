# Session handover — knowledge flow, 2026-09-04

Stopped mid-programme at the owner's instruction so another session could work. **The tree is green and
buildable.** Everything below is fact, checked at the moment of stopping.

---

## 0. ‼️ READ FIRST — state of the tree

### Build + test status at the cut-over

| Suite | Result |
|---|---|
| `clinqetinfrastructure` (Clinqet.Infrastructure.csproj) | **0 errors** |
| `Clinqet.Mcp.UnitTests` | **838 / 838 passed**, 0 errors |
| `Clinqet.Communications.UnitTests` (`~Knowledge` filter) | **1188 / 1188 passed**, 0 errors |
| `Clinqet.API.UnitTests` (full) | **11 447 / 11 447 passed**, 0 errors |
| `Clinqet.API.IntegrationTests` | **compiles, 0 errors** (not executed — owner's instruction) |
| `Clinqet.Mcp.IntegrationTests` | **compiles, 0 errors** (was BROKEN before this session — see §0.2) |
| `Clinqet.Communications.IntegrationTests` | **compiles, 0 errors** (owner confirmed passing) |

### 0.1 ‼️ A PEER COMMIT SWEPT THIS SESSION'S WORK IN

The commit **`search UI improvements`** in `clinqetcore`, `clinqetshared`, `clinqetinfrastructure` and
`clinqetmcp` **contains this session's knowledge changes mixed with a peer session's Business Search work.**
Verified by `git grep` against HEAD: `KnowledgeAnswerableRule`, `FingerprintMatches` and
`DropSubstitutedCards` are all inside HEAD.

- **Nothing is lost. Nothing needs reverting.**
- The commit messages do **not** describe the knowledge work, so a reader of the history will not know it is
  in there.
- **Still uncommitted** at the cut-over: `clinqetapi/Clinqet.API.UnitTests/Services/KnowledgeDraftApprovalServiceTests.cs`,
  `clinqetinfrastructure/Services/Knowledge/KnowledgeDraftApprovalService.cs`,
  `clinqetinfrastructure/Services/Knowledge/KnowledgeServiceDraftCleaner.cs`,
  `clinqetcore/Interfaces/Knowledge/IKnowledgeServiceDraftCleaner.cs`,
  `clinqetmcp/Clinqet.Mcp.IntegrationTests/Tests/{MaterialInfoToolIntegrationTests,VoiceReceptionistE2ETests}.cs`.
- **Push order still applies** (memory `feedback-owner-pushes-and-deploys-2026-08-20`): shared / core /
  infrastructure first, hosts after.

### 0.2 Two pre-existing breakages fixed on the way in (NOT this session's defects)

1. **`Clinqet.API.UnitTests` did not compile.** A peer session added `ICurrencyService` as the 2nd
   constructor argument of `SearchRefundRequestsTool` without updating its two call sites. Fixed by adding
   the argument in `BusinessSearchWorkToolFakes.Refunds` (with a new explicit `Currency(symbol)` helper,
   defaulting to an EMPTY symbol so no test's meaning is invented) and in
   `BusinessSearchRefundRequestsIntegrationTests.Tool`.
   ‼️ **STILL OPEN, NOT MINE TO DECIDE:** `BusinessSearchGroupBToolTests.ARefundAmount_ArrivesReadyToQuote_NeverAsMinorUnits`
   asserts `"INR 4500.00"`. The peer's change now renders `symbol + N2`, i.e. `"<symbol>4,500.00"` —
   different on BOTH the symbol and the thousands separator. **That test currently passes only because the
   fake returns an empty symbol.** The peer session owns what that string should be. Do not guess it.
2. **`Clinqet.Mcp.IntegrationTests` did not compile** (stale, from an older session):
   `VoiceReceptionistE2ETests.cs:364` passed a `CancellationToken` positionally where
   `BookingTimestampBounds` now sits third on `GetPaginatedBookingsAsync`. Fixed by naming the argument
   (`cancellationToken:`). Owner confirmed this was old, not an active edit.

---

## 1. DONE — closed, green, and sabotage-proven

### EX-01 — a mixed-generation answer (owner-approved "Option A", 2026-09-04)

**The defect:** a card's search key is `{business}_{doc}_{chunkNo}`, so a rerun overwrites the previous
run's cards ordinal by ordinal. `ListRetrievableDocIdsAsync` deliberately included `Processing`, so during a
replace a caller could be answered from a **mixture of old and new passages** — an answer that existed in
neither version.

**Owner decision, after being shown that keeping first-upload visibility would need a §0.7 Cosmos index
change:** *quiet until Ready.* A document answers only when its run has committed.

**The fix — ONE rule, and it now has FOUR call sites** (there were three copies before, one of them inline):

| Where | What changed |
|---|---|
| `clinqetcore/Interfaces/Knowledge/KnowledgeSearchVisibility.cs` | **NEW** `KnowledgeAnswerableRule` — the C# predicate plus the Cosmos filter/parameter/value it is stated as in SQL |
| `KnowledgeDocumentRepository.ListRetrievableDocIdsAsync` | SQL is now `c.type = @type AND c.status = @answerable`. ‼️ **Still index-only** — `type`, `status`, `docId` are all in the indexing policy, so no document body is loaded. This query runs on **every voice search** |
| `KnowledgeDocumentRepository.ListSearchVisibleDocIdsAsync` | Business Search allow-list routed through the shared rule |
| `KnowledgeDocumentRepository.ListRefSuppressedDocIdsAsync` | had its **own inline** `status == Ready` copy — now routed through the rule |
| `BusinessSearchDocumentService.ResolveAsync` | page/view endpoints now state the rule instead of resting on the coincidence that a rewrite nulls `ContentHash` |

**Cost:** none. The query is index-only before and after, and returns marginally fewer rows.

**Why `passageCount` is NOT in the rule:** the `KnowledgeBase` container excludes `/*` and indexes only
`type, docId, status, docType, sourceKind, contentHash, createdAt, updatedAt, kind, needsReview, queueRank`.
Touching `passageCount` would force Cosmos to load each document **body** (which carries the image registry,
up to 40 entries) on every voice search — roughly 20 body loads per search at the 20-document cap.
A new `status` enum value was also considered and **rejected**: 14 backend call sites plus provider web and
mobile status labels and their localization.

### EX-02 — a send handle promised a POSITION, not WORDS (owner-approved)

**The defect:** the handle was `{doc}:{chunk}`. Re-chunk the document between the assistant offering a
passage and the caller accepting, and chunk 7 is different text — the assistant says "Premium — $500" and
the send delivers "Basic — $100".

**The fix — a content fingerprint, and NO schema change of any kind:**
- `KnowledgeMaterialRef.Format(docId, chunkNo, content)` → `{doc}:{chunk}:{8 hex}` (SHA-256 of the **stored**
  content, never a display rendering — the send path sanitizes for display, so hashing that would mismatch
  every time). `FingerprintMatches` / 4-arg `TryParse` added; a 2-part handle still resolves.
- `KnowledgeCardRef.ContentFingerprint` — computed in `GetByRefsAsync` from the same stored field.
- `ProviderKnowledgeSearchService.BuildRef` issues the 3-part handle.
- `KnowledgeTools.DropSubstitutedCards` drops any card whose words changed; if nothing survives for that
  reason the tool returns a new honest **`materialChanged`** refusal telling the model to re-read the
  current text — never to claim the owner does not share it.
- ‼️ **A garbled fingerprint is a MALFORMED HANDLE, never "no fingerprint supplied"** — otherwise a
  transcription slip becomes an unchecked send.

**Cost:** +9 characters per handle, ~18–24 tokens per search at `RetrievalTopK` 8. **Zero** extra AI,
embedding, Document Intelligence, Cosmos or Search work.

### #8 — destructive storage before the CAS (audit finding #8)

**Verified real, both halves.** `EditAsync` deleted the image blob at line 253 **before**
`TryReplaceAsync`, and `DismissAsync` at line 735 **before** its CAS — so a request that then LOST its race
had already destroyed the picture of the draft that WON. Dismiss was worse: an exhausted CAS returns
`Conflict` and leaves the draft **Pending with its picture already gone**.

**Fix:** commit first, clean after. `IKnowledgeServiceDraftCleaner.DeleteImagesAsync(businessId, docId,
draftId, images, ct)` added as the **post-commit** form (it takes the snapshot, because after the write the
row no longer names the images); `DeleteDraftBlobsAsync(draft)` now delegates to it, so there is one loop.

‼️ **The three approve-path deletions (lines 369, 384, 494) were checked and are CORRECT** — they follow a
committed service write. Only the two above were defects.

### Two defects found while doing the above that are in NEITHER audit document

1. **My own EX-01 change would have made the send lie.** A handle for a document mid-rewrite no longer
   resolves (the allow-list is Ready-only), so `rows` was empty and `IsBeingUpdated` returned false — the
   send would have said *"the owner does not share that"* about material they do share, which is exactly what
   the existing `BeingUpdated` copy exists to prevent. Closed with
   `IKnowledgeDocumentRepository.ListUpdatingDocIdsAsync` — **index-only**, and read ONLY on the path already
   returning nothing, so a successful send pays nothing (guarded by a test).
2. **`SentRefs` reported every sent reference as DROPPED whenever the model copied a short prefix.** It
   rebuilt a 12-character handle from the card and compared it against whatever length the model sent.
   `TryParse` accepts any prefix ≤ 12 and `ResolveDocId` resolves any length, so the mismatch was reachable.
   Now matched by prefix, the same way `ResolveDocId` does, and the model gets its OWN handle back.

### Dead code removed (§22.2)

`KnowledgeTools.NormalizeRefs` — superseded by `NormalizeAllRefs`; its only caller was its own test. Both
deleted, plus the orphaned comment.

### Guards added — 8 sabotages, every one RED on exactly the right guard

| Sabotage (each ISOLATED, restored with `cp` from the scratchpad, never git) | Result |
|---|---|
| 1. Disable the fingerprint check | RED — 2 guards |
| 2. Revert `SentRefs` to rebuilding from the card | RED — 2 guards |
| 3. Accept a malformed fingerprint | RED — 3 theory cases |
| 4. Remove the mid-rewrite explanation read | RED — 1 guard |
| 5. Widen `IsAnswerable` back to "not Deleting" | RED — 2 theory cases |
| 6. Drift the SQL value away from the predicate | RED — the drift guard |
| 7. Restore the pre-commit blob delete in Dismiss | RED — Dismiss guard only (Edit stayed green ⇒ isolated) |
| 8. Restore the pre-commit blob delete in Edit | RED — Edit guard only |

New test files / cases:
- `Clinqet.Mcp.UnitTests/Services/KnowledgeAnswerableRuleTests.cs` — **NEW**. Status truth table, plus the
  **SQL-vs-predicate drift guard** (the SQL cannot call the predicate, so the two are only equal as long as
  the SQL's value is the one value the predicate accepts).
- `Clinqet.Mcp.UnitTests/Tools/KnowledgeToolsTests.cs` — 12 new cases (unchanged content sends; changed
  content refuses; partial drop still sends the rest; no-fingerprint back-compat; 4 malformed-fingerprint
  cases; short prefix reported as sent; mid-rewrite says beingUpdated; not-mid-rewrite stays notSendable;
  the explanation read is never paid for on the success path).
- `Clinqet.API.UnitTests/Services/KnowledgeDraftApprovalServiceTests.cs` — 2 new cases proving a
  non-committing Dismiss and a stale-tag Edit both LEAVE THE PICTURE ALONE.
- `Clinqet.Mcp.IntegrationTests/Tests/MaterialInfoToolIntegrationTests.cs` — the old
  `..._ButKeepProcessing` test **rewritten** as `RetrievableDocIds_AgainstRealCosmos_KeepOnlyACommittedRun`
  (now the real-engine drift guard: it asserts the SQL result equals `IsAnswerable` for all four statuses),
  plus **NEW** `UpdatingDocIds_AgainstRealCosmos_NamesOnlyTheRunsInFlight`.
  ‼️ **These two have NOT been executed** — the owner stopped integration runs. They compile.

### Fake corrected (it was lying)

`KnowledgeToolsTests`'s `GetByRefsAsync` stub matched the doc prefix by **equality against 12 characters**,
so a short handle was unresolvable in the test and nowhere else. Now matches by prefix, like `ResolveDocId`.

---

## 2. LIVE-DATA EVIDENCE — zero degradation

Full harness output: **session scratchpad `LIVE-EVIDENCE.md`** (never written into a repo, §0.16).
Credentials read at runtime from `C:\Nik\cosmosindexsetup\appsettings.{ca,in}.json`; probes are read-only
and live in the scratchpad (`cosmos-probe.ps1`, `search-probe.ps1`).

| Check | Canada | India |
|---|---|---|
| Knowledge rows | 4 (all `File`) | 50 (31 TypedFaq, 19 `File`) |
| Status distribution | **all `Ready`** | **all `Ready`** |
| Rows the new rule would blank | **0** | **0** |
| Index cards | 744 | 99 |
| Cards with empty content | 0 | 0 |
| Two DIFFERENT texts hashing alike | **0** | **0** |

India's 83 distinct fingerprints across 99 cards is CORRECT, not a collision: 16 cards hold byte-identical
text (repeated FAQ answers). The fingerprint is only ever compared for the same (document, chunk).

‼️ **Cosmos gateway trap for the next session:** a raw cross-partition REST query **cannot** use server-side
aggregates (`COUNT`, `GROUP BY`) — the gateway returns 400 with "can not be directly served by the gateway".
Project the rows and aggregate locally. `cosmos-probe.ps1` already does.

**What live data cannot cover, stated plainly:** there is **no live `.xlsx`, `.pptx`, `.html`, `.txt` or
`.md`** knowledge document in either region — every live `File` row is a PDF. Re-running the PDF/image lane
costs paid Document Intelligence and vision calls. Neither EX-01 nor EX-02 touches extraction, so no
extraction re-run was needed for them; **the extraction findings below WILL need one.**

---

## 3. IN PROGRESS — stopped cleanly, nothing half-applied

**#5 (FAQ edit writes Cosmos before the index) — ANALYSED, NOT STARTED. No code written.**

Verified real: `UpdateFaqAsync` calls `TryReplaceAsync` (committing the new question/answer) and only then
`IndexFaqCardsAsync`. If indexing fails, Cosmos holds the new FAQ while search still serves the old, and
`IsDrifted` compares only COUNTS — which are identical for an edited FAQ, so health reports success.
`CreateFaqAsync` already does it the right way round (index first, purge cards on failure).

‼️ **The obvious fix is WRONG and the next session must not just "mirror the create path".** Index-first
alone moves the divergence to the other side: on a failure the index serves the NEW text while the row says
OLD. The design worked out (and not yet written):

1. Read + validate, then **pre-check the client's ETag before spending an index write** — not the
   authorization (the CAS still is), but it collapses the window in which a doomed edit rewrites what
   callers are answered from.
2. Index the new cards, prune the stale tail.
3. Commit the row with the client's ETag.
4. **On Conflict: COMPENSATE** — re-index from the row's CURRENT stored question/answer (the same two steps
   the admin reindex uses, so there is one rebuild path). **On `Gone`: purge the cards, do not restore.**
5. Compensation failure ⇒ admin alert (the floor, never the substitute).

Also set `row.Status = Ready` on this path so a row left `Processing` by an earlier failed finalize heals.
`FinalizeFaqRowAsync` stays — `ReindexAsync` still uses it.

---

## 4. OUTSTANDING — nothing else was started

### 4.1 The ETag silent overwrite (Q3-A / finding #7) — OWNER DEFERRED TO ITS OWN SESSION

**Confirmed real.** `CosmosDbRepository.UpdateItemAsync` (lines 250-276) re-reads the item **to obtain its
current ETag**, then replaces with the caller's **stale** object using it. The check passes by construction,
and the 412 retry repeats the same pattern — turning a *detected* conflict into a *silent overwrite*.

**The analysis is done; the next session starts from here rather than re-measuring:**

| Fact | Value |
|---|---|
| Production call sites through the broken method | **~132** |
| Files containing them | **40** |
| Files that ALREADY handle a real 412 | **3** — `OnboardingProgressService`, `BookingTimeoutProcessor`, `BookingAutoCompletionProcessor` |
| Files with NO conflict handling | **37** |
| Repository wrappers delegating to it | 26, across 22 repositories |

‼️ **Strongest evidence the honest fix is right:** `OnboardingProgressService` already catches
`PreconditionFailed` and **refetches** on conflict, and carries the comment *"base repo retries 3x on 412
internally"*. **The code was written expecting this to work. The base repository silently defeating it is the
anomaly.**

**Design agreed in principle (owner chose "full best practice, no patch, fixed all the places"):**
- `UpdateItemAsync(item, pk)` → `IfMatchEtag = item.ETag`; on 412 **throw**, never blind-retry. Most call
  sites need **no change** — they already `Get` → mutate → `Update`, so they inherit a genuine conditional
  write, and `BaseController` already maps `PreconditionFailed` → HTTP 412 + `Error_DbConcurrencyConflict`.
- Add `UpdateItemWithRetryAsync(id, pk, Func<T,bool> mutate)` — a REAL read-modify-write CAS that recomputes
  from fresh state each attempt. The correct pattern already exists in the codebase as
  `CosmosDbRepository.PatchStableArrayItemByIdAsync` — copy its shape.
- ‼️ **Do NOT field-diff and re-apply generically.** Considered and rejected: over 30 entity types it is
  guesswork and can merge two conflicting intents into a third state neither writer asked for.
- ‼️ **`StampUpdatedBy(item, existing)` needs the stored `createdBy*`** ("historical attribution is NEVER
  rewritten"). Keep the internal read for `ProviderOwnedEntity` or attribution regresses. The RU saving is
  not the point.
- Service Bus processors need no special handling: a 412 fails the message, redelivery re-reads fresh and
  converges. That is the correct retry.

**Why it needs its own session:** the flows are **bookings and invoices** — money — so §0.8 makes
integration coverage on the real engines mandatory, which means `Clinqet.API.UnitTests` +
`.IntegrationTests` are the whole point of that session. Shipping it half-proven would trade silent data
loss for **visible unhandled 412s on money paths**.

### 4.2 `AUDIT-FINDINGS.md` — verified REAL this session, not yet fixed

| # | Defect | Verified evidence |
|---|---|---|
| **#3** | Multi-file confirm partially commits and is **not retry-safe** | `ConfirmUploadsAsync` loops sequentially. On retry a created row makes `TryCreateAsync` return false ⇒ throws; a replace target is now `Processing` ⇒ "not replaceable" throws. **Both stop before reaching the remaining files.** Needs per-file outcomes + idempotent semantics for the same doc/blob generation |
| **#4** | A failed replacement takes the previously good document offline | `Failed` is excluded from retrieval, and the row's `BlobPath` has already been overwritten with the new upload, so the old version is unrecoverable as content. **The old SOURCE blob still exists** (see #2) — the row simply no longer points at it. A proper fix is staging ⇒ likely schema |
| **#5** | See §3 — analysed, design worked out, not written |
| **#6** | Metadata drifts permanently after a queue-send failure | `UpdateDetailsAsync` commits the row, THEN `EnqueueIngestAsync`. The stuck-processing alert is gated on `Status == Processing`; a MetadataOnly row is `Ready`, so **no alert fires**. The retry then hits "a save that changed nothing" and returns `Ok` without requeueing ⇒ the cards keep the stale type/links for ever |
| **#11** | Quota checks race | `CountAsync` → create, and `GetPassageUsageAsync` → create. Low severity (a provider self-service cap) but real |
| **#19** | Caller material-send limits not atomic | `CountMaterialSends(session) >= max` … enqueue … `RecordSendMarkerAsync` (a CAS). Real; low likelihood (parallel tool calls in one realtime session) |
| **#20** | Index health is count-only | `IsDrifted` compares counts only, so it cannot see a stale FAQ, partially applied metadata, or wrong-but-valid embeddings |
| **#21 / EX-26** | Business Search returns an image for a result the model never saw | `SearchKnowledgeTool` lines 139-146: `Citations.Take(kept)` trims citations, but `Images = images` is **unfiltered** — an image whose owning card `SerializeCapped` dropped still ships. **Small, safe fix: bind each image to its payload index and emit only those below `kept`** |
| **#22** | Role-audience keys not validated against the catalogue | `SetSearchAudienceAsync` trims, bounds, dedupes and caps to 32 — but never checks the keys exist. An unknown key fails closed and silently restricts the document to nobody while the UI shows it as shared |
| **#2** | Abandoned/replaced source blobs accumulate | Every upload gets a unique path under `{businessId}/{docId}/source/`; storage lifecycle rules clean `_sent` and `_ocr` only. The replaced blob is never deleted and abandoned uploads never create a row. Partly fixable; the abandoned case needs a pending record ⇒ schema |
| **#9** | Post-commit effects not durably coordinated | Category selection / count refresh / derivative dispatch / onboarding progress all happen after the service write, are alerted but never recovered, and count repair only covers categories known to the current operation |

**#1, #10, #13-#18 remain DONE** from the previous session.

### 4.3 `EXTRACTION-PASSAGE-AUDIT.md` — EX-04 … EX-34

**Verified real this session (evidence captured):**

- **EX-10** — the image cap ranks by **compressed source bytes before decode**:
  `KnowledgeIngestProcessorFunction.cs:1508-1511` calls
  `KnowledgeImageStore.SelectWithinCap(assets, cap, a => a.SourceBytes.LongLength)`. Confirmed exactly.
- **EX-11** — `normalized.Width < min && normalized.Height < min` (**AND**), so a 30×2000 divider survives a
  200 px floor. Confirmed. ‼️ Note the audit is only partly right about the cost: an image small in BOTH
  dimensions is skipped before the caption call and the upload — but the 30×2000 strip passes the AND, so it
  **does** burn a caption call, a blob write and a card slot.

**‼️ OWNER ALREADY APPROVED THE RULE FOR BOTH (2026-09-04) — NOT YET IMPLEMENTED:**

> **Short edge ≥ 96 px, max aspect ratio 16, min area 200×200, and rank by AREA after a header-only probe.**

Implementation notes agreed: use a **header-only** `Image.Identify` (no pixel decode, so no added cost)
BEFORE the cap; reject strips and icons first; then rank survivors by area; **refill a vacated slot when a
selected candidate fails to decode**. Measured effects the owner accepted: a 30×2000 divider is now
REJECTED (today: kept); a 2000×150 product banner is KEPT; **a 300×100 small logo strip is newly REJECTED**
(area 30 000 < 40 000) — the one deliberate loss.

**NOT independently verified — every one still needs the code read before any fix:**
EX-04 (vision replaces OCR with no fidelity check) · EX-05 (AI captions become searchable facts) ·
EX-06 (extraction/caption lineage too narrow — a caption fix cannot reach a document whose caption is
reused by content hash) · EX-07 (two-column PDF reading order) · EX-08 (one page number per passage) ·
EX-09 (vision moves every figure anchor to the page end) · EX-12 (no perceptual dedupe) ·
EX-13 (image cards lack source context) · EX-14 (repeated image placements suppressed) ·
EX-15 (a worksheet flattened into one table) · EX-16 (full-width merged rows become fake repeated values) ·
EX-17 (résumé fidelity) · EX-18 (charts/SmartArt/shape fills) · EX-19 (a caption card can exceed the chunk
maximum) · EX-20 (generated summaries acquire factual authority) · EX-21 (heading-only sources fail as
unreadable) · EX-22 (prose dedupe erases section context) · EX-23 (inventory merges unrelated tables) ·
EX-24 (section counts mix unlike content) · EX-25 (blank-first-cell inheritance) ·
EX-27 (script detection ignores title/section) · EX-28 (animated GIF/WebP frames) ·
EX-29 (uploaded HTML header/footer removal) · EX-30 (scalar-root JSON rejected) ·
EX-32 (dehyphenation removes legitimate hyphens) · EX-33 (analyzer choices — search schema ⇒ §0.7) ·
EX-34 (linked/vector/small/full-page image coverage).

**EX-03 and EX-31 remain DONE. EX-01 and EX-02 are DONE this session (§1).**

‼️ **A path correction the next session needs:** `EXTRACTION-PASSAGE-AUDIT.md` §2 lists
`KnowledgeImageCaptionClassifier.cs`, `VisionDocumentTranscriptionService.cs` and `PageMarkdownSplicer.cs`
under `clinqetfuncations`. **They are all in `clinqetinfrastructure`** — the first under
`Services/Knowledge/`, the other two under `Services/AI/`. That matters for §0.18 test placement: tests for
them belong in the suite of the host whose runtime path invokes them, which is the **Functions** host for
the vision/caption lane, not whichever suite is convenient.

### 4.4 Still open and NOT this session's to decide

`BusinessSearchGroupBToolTests.ARefundAmount_ArrivesReadyToQuote_NeverAsMinorUnits` — see §0.2 item 1.
The peer session owns the expected string.

### 4.5 Documentation debt this session did NOT get to

- `clinqet-voice-assistant` SKILL, **all four copies** — needs the EX-01 answerable rule (R-series), the
  EX-02 fingerprint contract, and the post-commit blob-cleanup rule.
- Memory entry for this session.
- `TRIAGE-AND-STATUS.md` — updated in the same change as this file; re-check it against §1-§4 before
  trusting it.

---

## 5. Operating notes earned in THIS session (add to the runbook)

1. ‼️ **A bash heredoc silently failed to terminate** on one multi-hundred-line payload and wrote nothing —
   it reported `unexpected EOF while looking for matching '`. Writing the same script with the Write tool
   worked first time. If a heredoc fails twice, stop debugging quoting and switch tools.
2. ‼️ **Perl `substr` patches must match the source's EM DASHES.** Three patches failed on an anchor where
   the source had `—` and the patch had `-`. Anchor on lines without dashes.
3. ‼️ **A Moq mock returns `null` for an unstubbed `Task<IReadOnlyList<T>>`**, and `await`ing it then throws
   on `.Count`. Adding an interface member breaks every test that reaches it — stub it in the SHARED setup,
   not per test. This cost 6 red tests.
4. ‼️ **A test fake that is stricter than production hides a production bug.** The `GetByRefsAsync` stub
   compared the doc prefix by equality against 12 characters; production resolves any prefix length. The
   short-prefix defect was therefore invisible to the whole suite.
5. ‼️ **Check `git log`, not just `git status`, before believing your work is uncommitted.** A peer session's
   `search UI improvements` commit had already swept this session's changes into four repositories.
