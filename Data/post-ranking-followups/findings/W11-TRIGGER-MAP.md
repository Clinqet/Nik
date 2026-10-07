# W11 — what moves a provider's score, and where each change is written (read in the code, 2026-09-30)

The facts the event-driven rescore is built on. Paths are in the W: worktrees (branch `feature/post-ranking-followups`).

## What the three scores read (unchanged math)

| Input | Where it lives | Read by |
|---|---|---|
| Booking outcome rows (`BookingOutcomeRow`: status, createdAt, createdBy, cancelledBy, timeoutParty, providerConfirmedAt, cancelledAt, scheduledStartUtc, providerCancelReason) | Transactions, pk `/businessId`, `type = "Booking"`; selected by `updatedAt >= from` | `IBookingRepository.GetOutcomeRowsTouchedAsync` |
| Customer waits (`ReplyCycle {wroteAt, answeredAt}` embedded in the business side's `Conversation`) | Communications, pk `/userNumber` = the businessId for the business side | `IConversationRepository.GetReplyCyclesAsync` (by `lastMessageAt`) |
| Opening hours (business-level rows only: `BranchAvailabilityResolver.EffectiveHours(rows, branchId: null)`) + the profile's time zone (`TimeZoneId`, else country, else address) | ProviderData, `type = "Availability"` / `"BusinessProfile"` | `OpeningHoursClock` |
| Hidden or not: `IsListed`, `ParticipatesInMarketplace`, `Status`, any active + approved + not-deleted service | ProviderData `"BusinessProfile"`, `"Service"` | the pause rule |

Leads (broadcast provider rows) are NOT read by any score — a lead response needs no rescore.

## Where each input changes

- **Bookings**: every write goes to Transactions (API controllers, `BookingService`, the timeout / auto-completion
  processors, MCP tools, voice follow-up, broadcast conversion, reply actions, `HolderWriteService`). One hard delete
  exists (`BroadcastService` compensating rollback of a booking it just created) — invisible to a change feed, and a
  booking that never existed moves no score.
- **Customer waits**: only `ConversationRepository.OpenReplyCycle` (via `IncrementUnreadAsync(…, waitStart)`) and
  `EndCustomerWaitAsync`, both reached only from `ConversationService.UpdateSummaryForBothParticipantsAsync`
  (API + Functions hosts; MCP does not register it). The Communications container has NO change feed.
- **Opening hours**: `AvailabilityController` PUT / copy, default hours on profile creation, MCP document setup. Hard
  deletes touch BRANCH rows only (`ClearBranchHoursAsync`, `DeleteBranchHoursAsync`), which the scoring clock never reads.
- **Profile**: listing (`ProviderListingService`), lifecycle (`ProviderLifecycleService`: deactivate / suspend /
  reactivate — Cosmos only), time zone (`TrySetTimeZoneAsync`, address update, `IdentityProfileSyncProcessor`).
  SQL-only lifecycle (closure, account deactivation, user suspension) never changes a scoring input: closure's
  teardown hard-purges the profile ⇒ every later message finds no profile and ends.
- **Services**: ProviderData `"Service"` writes (soft delete is a write).
- **The scorer's own write** (`TrySetProviderScoresAsync`) and the override patch are profile writes ⇒ they reach the
  ProviderData change feed.

## Change feeds that exist (Functions, `SearchIndexSyncFunction.cs`)

- `ProviderDataUnifiedProcessor` — ProviderData, lease prefix `providerdata-unified`, `StartFromBeginning = true`,
  100 per batch; dispatches on the raw `type`.
- `TransactionsOfferProcessor` — Transactions, lease prefix `transactions-offers`, `StartFromBeginning = false`;
  today skips `Booking`.
- The Cosmos extension CHECKPOINTS a batch whether the invocation succeeds or throws.

## Override (§12.5)

`ProviderScoreOverrideService` — `SetAsync` / `ClearAsync` (API `AdminProviderScoresService`, `PUT …/scores/override`,
`POST …/scores/override/clear`) and `ExpireIfLapsedAsync` (today: the nightly job and `SearchIndexAuditFunction:351`,
which also queued a reindex). Audit id `scoreoverride_{businessId}_{action}_{ticks}` (an `AdminAlert`,
`ProviderScoreOverrideChanged`). Five profile fields written in one patch.

## Registry for the safety net

SQL `Business` (`AppDbContext.Businesses`), key `BusinessId` — 6 characters from `A–Z0–9`
(`IdentifierNamespace`), `Status` Onboarding / Active / Suspended / Closed. Keyset paging exists in
`SearchIndexAuditFunction`.

## Service Bus facts (Microsoft docs, read 2026-09-30)

- A scheduled message's expiry = its SCHEDULED enqueue time + time-to-live: it cannot expire before it fires.
- Scheduled messages take part in duplicate detection (scheduled after unscheduled and the reverse are both dropped).
- History window 20 s – 7 days; a longer window costs throughput. Duplicate detection cannot be switched on in place.
- Session state (`ServiceBusSessionMessageActions.Get/SetSessionStateAsync`) is available in
  `Microsoft.Azure.Functions.Worker.Extensions.ServiceBus` 5.24.0.
