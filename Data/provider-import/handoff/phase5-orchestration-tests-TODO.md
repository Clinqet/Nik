# Phase 5 — orchestration tests still to write (handoff, 2026-10-07)

None written yet. Home: `clinqetfuncations/Clinqet.Communications.UnitTests/ProviderImport/` (xunit.v3 + Moq,
`[Trait("Category","Unit")]`, `[Trait("Feature","ProviderImport")]`, like `CurationVerifierTests.cs`). Name tests with §21 IDs
(F11, F14, F15, F17–F20, X1, X6, X9, X12–X15, X18, X19, X21, X22, V1–V3, V10, V11, FN3, FN5 …). Run with
`dotnet test Clinqet.Communications.UnitTests --filter "FullyQualifiedName~Clinqet.Communications.UnitTests.ProviderImport.<Class>"`
(VSTest; a full build of the test project takes ~5 min).

1. `FriendlyNameCandidatesTests` — order (bot, AI, slug, slug-city, -2..-N); accents, `&`→and, legal suffixes + "the" dropped;
   whole-word cut ≤ 20; initials fallback; non-Latin ⇒ only bot/AI; no duplicates.
2. `ProviderImportFakes` — run/item repositories honouring ETags (stale ETag ⇒ null; each write a new ETag), applying
   `PatchOperation` Set/Increment by JSON path through a Newtonsoft `JObject` round-trip (cast to `PatchOperation<T>`, read
   `.Value`); `UpsertManyAsync`, `ListAsync`, `CountByStatusAsync` from the stored items; daily spend dictionary; a CAS
   active-runs document so the real `ProviderImportRunSlots` works; a blob store fake with the `ProviderImportBlobStore` JSON
   options; the real `ProviderImportAlerts` over a recording `Mock<IServiceBusService>`.
3. `ProviderImportValidationRunnerTests` — mock `IProviderImportFileValidator` (records from
   `ProviderImportNormalizationFixture.Provider(...)`, each with its own name/email/phone or they dedupe), the real normalizer
   + deduplicator, a mocked `IProviderImportExistingMatcher`. Cases: not Uploaded/Validating ⇒ no-op; missing upload ⇒
   ValidationFailed; invalid envelope ⇒ ValidationFailed, errors capped; SchemaInvalid items; skip rules; dedupe skips;
   matcher skip / FillGaps / PossibleExistingBusiness; lanes (position % ParallelismPerRun, nextItemId, heads); counters;
   cost estimate; redelivery converges; LostRace.
4. `ProviderImportItemAiMeterTests` — budget = planned + MaxAiCallsPerProvider from `item.Ai.Calls` across attempts; run and
   daily limits ⇒ RunCostLimit; warning once on crossing (keys `run-cost-warning:{runId}`, `day-cost-warning:{yyyyMMdd}`);
   a bank hit costs nothing.
5. `ProviderImportLaneAdvancerTests` — next non-terminal item sent with attempt+1 and `MessageIdFor`; terminal skipped; last
   lane finishes with recomputed counts; CompletedWithErrors; Cancelling ⇒ Cancelled; stale-ETag finish does nothing; slot
   released; completion/custom-category/price alerts once (`completed:{runId}:{n}`, `summary:{runId}:{n}:custom-categories`,
   `summary:{runId}:{n}:prices`); paused run moves currentItemId, sends nothing.
6. `ProviderImportSweeperTests` — abandoned upload ⇒ Discarded + blobs deleted; stale validation re-sent
   `validate:{runId}:{attempts+1}`, after MaxStallRequeues ⇒ ValidationFailed + Stalled alert; stale lane re-sent; after
   MaxStallRequeues ⇒ item Failed Stalled + alert + advance; terminal current item ⇒ advance; fresh lane untouched; one broken
   run does not stop the others.
7. `ProviderImportItemProcessorTests` — mocks for curator, category prompt service (Lookup = `CurationTestData.Categories`),
   preparer, identity client, account store, profile repo, bootstrap, writer, photo copier, lifecycle; real `CurationVerifier`
   and `ProviderImportLaneAdvancer`. Every case: terminal / stale attempt / claim / paused / Cancelling; ContentRefused ⇒
   Skipped, no Identity call; merge veto + NoCity at P5; P5 re-check skip + FillGaps switch; each Identity outcome; Identity
   Unavailable ⇒ PausedIdentityUnavailable + one High alert + item Queued; AI unavailable below threshold ⇒
   `ProviderImportTransientException`, at threshold ⇒ PausedAiUnavailable; PausedCostLimit; AiBudgetExhausted; OwnerTookOver;
   verdict Live / blockers / FillGaps never activates; `PendingApprovalServiceIds` in the result blob; redelivery after each
   checkpoint repeats nothing (no 2nd AI or account call); `Reconcile()` agree/disagree.
   ‼️ `Reconcile` is `internal static` and `Clinqet.Communications` has no `InternalsVisibleTo` for its unit tests — check
   first; either add it (host csproj change) or test through `ProcessAsync`. Also check the FillGaps re-check on a redelivery
   (the processor reads `Mode`, `ExistingUserId`, `Links` from the item).
8. Sabotage ≥ 4.
