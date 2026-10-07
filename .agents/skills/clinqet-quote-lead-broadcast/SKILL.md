---
name: clinqet-quote-lead-broadcast
description: |
  **CORE FEATURE SKILL** — Work on the Quote / Lead / Broadcast feature end-to-end.
  This is ONE feature with THREE names by audience:
    - Customer UI: "Get Quotes" at `/quotes`
    - Provider UI: "Leads" at `/dashboard/leads`
    - Backend code: `Broadcast*` (entities, repos, services, controllers, queues, notification types)
  USE FOR: posting a quote request (customer reverse-marketplace), matching algorithm,
  provider inbox, bidding, awarding, lead muting/hiding, conversion to booking,
  expiry, tiered expansion. Applies to clinqetcore/Entities/COSMOS/Cosmos.cs (Broadcast*),
  clinqetinfrastructure/Services/Broadcast/, clinqetapi Controllers/Broadcast/,
  clinqetfunctions Functions/Broadcast*, clinqetwebuserapp/app/(customer)/quotes/,
  clinqetwebpartnerapp/src/app/dashboard/leads/.
---

# CLINQET QUOTE / LEAD / BROADCAST — COMPREHENSIVE SKILL

## RECENT CHANGES — 2026-10-06 (a lead to a business nobody is signed in to)

See the `clinqet-prepared-providers` skill for the whole feature. What changed HERE:

- ‼️ **A lead routed to a business the Clinket team prepared raises a dedicated admin alert** (`PreparedProviderCustomerWaiting`, High so it reaches a phone): nobody is signed in to bid on it, so only the team can act.
- **One alert per REQUEST**, deterministic on `(kind, account, requestId)` — not one per notification.
- **A prepared business gets NO text and NO WhatsApp about it**, only the transactional email; and if the person reading that mail pressed "Stop emails", not even that.
- **A price-less service is matched and indexed normally** — it used to be parked out of search entirely.

## TERMINOLOGY MAP (CRITICAL — DO NOT MIX)

| Audience | UI Term | Route | Backend Term |
|----------|---------|-------|--------------|
| Customer (web user app) | "Get Quotes" / "Quotes" | `/quotes`, `/quotes/new`, `/quotes/[id]` | Broadcast |
| Provider (partner app) | "Leads" / "My Leads" | `/dashboard/leads`, `/dashboard/leads/[id]` | BroadcastProvider |
| Admin | "Broadcasts" | varies | Broadcast |
| Backend everywhere | — | `/api/v1/broadcast`, `/api/v1/business/broadcast` | Broadcast, BroadcastProvider, BroadcastDispatch |

**Rule:** Never rename backend identifiers to "Quote"/"Lead". Never expose "Broadcast" in customer or provider UI copy/labels. Localization keys carry the user-facing wording; only `en.json` (and the React components) reference Quote/Lead.

---

## ENTITIES (Cosmos DB)

All in `C:\Nik\clinqetcore\Entities\COSMOS\Cosmos.cs`.

### Broadcast (lines ~1898-2033) — the customer's request
- Container: `Communications`. Partition key: `/userNumber`. Document id: `{userNumber}_{broadcastId}`.
- Key fields: `BroadcastId`, `BroadcastNumber` (display id), `UserNumber`, `CategoryId`, `CategoryName`, `Subcategories: List<BroadcastSubcategory>`, `Location: BroadcastLocation` (lat/lng/radius/city/state/zip), `Budget: BroadcastBudget`, `Schedule: BroadcastSchedule`, `ContactPreferences`, `MediaFiles: List<BroadcastMedia>`, `Status: BroadcastStatus`, `ExpiresAt`.
- Counters (use IBroadcastRepository.IncrementCounterAsync, ONLY allowed names): `ProvidersMatched`, `ProvidersNotified`, `ProvidersQueued`, `ProvidersOpened`, `BidsReceived`, `MessagesReceived`.
- Tiered-expansion idempotency: `ProcessedExpansionBatches: List<int>` + `ExpansionScheduleRecoveredAt` (D-12 recovery tracking).

### BroadcastProvider (lines ~2142-2371) — provider's view of one broadcast
- Container: `ProviderData`. Partition key: `/businessId`. Document id: `{businessId}_{broadcastId}`.
- Status enum (provider side): `Queued → Delivered → Opened → Engaged → Won | Lost | Expired | Cancelled`.
- Soft-hide: `IsHidden` (per-provider), `MutedUntil` (optional timestamp), `Ttl` (Cosmos auto-expiry).
- Snapshot of broadcast at delivery time (category, subcategories, matched services, distance, customer hint) so the lead remains viewable after the broadcast mutates.
- `ConversationId` links to the messaging Conversation for this lead.
- `LatestBid: BroadcastBidSummary` (amount, currency, status, message, updatedAt).

### BroadcastDispatch (lines ~2520-2550) — short-lived fan-out record
- Container: `Communications`. Partition key: `/userNumber`. TTL applied.
- Contains the matched provider list + `MatchingStrategy: BroadcastMatchingStrategy`.

### Supporting types in the same file
- `BroadcastSubcategory`, `BroadcastMedia`, `BroadcastLocation`, `BroadcastBudget`, `BroadcastSchedule`, `BroadcastContactPreferences`, `BroadcastBidSummary`, `BroadcastConversationData`, `MatchedServiceInfo`.

---

## ENUMS (`clinqetshared\Enums\`)

- `BroadcastStatus`: Draft, Processing, Active, Awarded, Completed, Expired, Cancelled, Failed
- `BroadcastProviderStatus`: Queued, Delivered, Opened, Engaged, Won, Lost, Expired, Cancelled
- `BroadcastBidStatus`: Active, Updated, Withdrawn, Rejected, Won, Lost, Expired
- `BroadcastUrgency`: ASAP, WithinAWeek, WithinAMonth, Flexible
- `BroadcastBudgetType`: Fixed, Range, Hourly, Flexible
- `BroadcastMatchingStrategy`: MatchAll, SoftCap, Tiered
- `BroadcastServiceLocationType`: OnSite, Remote, Flexible
- `NotificationType` (subset): BroadcastReceived, BroadcastNoMatches, BroadcastBidReceived, BroadcastBidUpdated, BroadcastBidWithdrawn, BroadcastMessageReceived, BroadcastAwarded, BroadcastWon, BroadcastLost, BroadcastBidRejected, BroadcastExpired, BroadcastCancelled, BroadcastExpiryReminder, BroadcastUpdated, BroadcastProcessed, BroadcastFailed
- All enums MUST have `[JsonConverter(typeof(JsonStringEnumConverter))]`.

---

## DTOs

- Request: `C:\Nik\clinqetshared\DTOs\Broadcast\BroadcastRequestDtos.cs` — `CreateBroadcastRequestDto`, `UpdateBroadcastRequestDto`, `PlaceBidRequestDto`, `AskQuestionRequestDto`, `ConvertBroadcastToBookingRequestDto`.
- Response: `BroadcastResponseDtos.cs` — `BroadcastResponseDto`, `BroadcastListResponseDto`, `BroadcastProviderInboxDto`, `BroadcastProviderDetailDto`, `BroadcastResponseSummaryDto`, `BroadcastBidSummaryDto`, `BroadcastAnalyticsSummaryDto`, `MatchedServiceInfoDto`.
- Classification: `BroadcastDtos.cs` — `BroadcastClassifyRequestDto/ResponseDto`, `BroadcastSasUrlRequestDto/ResponseDto`.
- Service Bus messages (`clinqetshared\DTOs\Messages\`): `BroadcastProcessingMessage`, `BroadcastExpiryMessage`, `BroadcastStatusUpdateMessage`, `BroadcastTieredExpansionMessage`, `BroadcastUpdateNotificationMessage`, `BroadcastAnalyticsMessage`.
- All DTO validation messages must be localization keys (`Error_*`, `Label_*`) — never hardcoded English.

---

## REPOSITORIES (`clinqetinfrastructure\Data\COSMOS\`)

| Repository | Interface | Container / PK | Key methods |
|------------|-----------|---------------|-------------|
| `BroadcastRepository.cs` | `IBroadcastRepository` | Communications / `/userNumber` | `GetByIdAsync`, `CreateBroadcastAsync`, `GetByUserNumberAsync(paged, status?)`, `IncrementCounterAsync(allowedNames)`, `TryApplyCounterDeltaAsync` (idempotent + dedup key), `TryRecordExpansionBatchAsync` (ETag + filter predicate), `SetTtlAsync`, `GetActiveCountByUserAsync` |
| `BroadcastProviderRepository.cs` | `IBroadcastProviderRepository` | ProviderData / `/businessId` | `GetByProviderAndBroadcastAsync`, `GetByProviderIdAsync(paged, status?)`, `GetStatusCountsByProviderIdAsync` (single-partition `GROUP BY c.status` → per-status inbox totals), `MarkAsOpenedAsync` (idempotent), `UpdateBidSummaryAsync` (terminal-guard), `UpdateStatusAsync`, `UpdateStatusConditionalAsync`, `HideAsync`, `UnhideAsync`, `MuteAsync`, `UnmuteAsync` |
| `BroadcastDispatchRepository.cs` | `IBroadcastDispatchRepository` | Communications / `/userNumber` | `CreateAsync`, `GetByIdAsync` |

**Partition rule (NON-NEGOTIABLE):** every query specifies its partition key — never cross-partition. Customer queries pass `userNumber`; provider queries pass `businessId`. Server-side (function app) loads broadcasts by `(broadcastId, userNumber)` always.

---

## SERVICES (`clinqetinfrastructure\Services\Broadcast\`)

### BroadcastService.cs (customer-side)
- `CreateAsync(userNumber, dto, preferredLanguage, idempotencyKey)` — validation (desc length 10–2000, ≤10 media, expiry ≤ MaxExpiryDays, location coords OR city required, budget coherence per type, category + subcategories validated against the global catalogue — parent must exist, every subcategory must be its child; throws `Error_CategoryNotFound` / `Error_BroadcastSubcategoryInvalid`), idempotency via header OR content-hash 5-min bucket, enqueues `BroadcastProcessingMessage`.
- `GetByIdAsync`, `GetByUserNumberAsync(paged, status?)`, `UpdateAsync`, `CancelAsync(reason, lang)` — notifies all engaged providers.
- `AwardAsync(broadcastId, userNumber, conversationId, lang)` — transitions to Awarded, creates booking, fires BroadcastWon to winner + BroadcastLost to all others.
- `RejectBidAsync(broadcastId, userNumber, conversationId)` — customer rejects a single bid; provider may re-bid (per rule in service).
- `GetResponsesAsync(broadcastId, userNumber)` — ordered by engagement + distance.
- `ConvertToBookingAsync` / `ConvertToBookingForProviderAsync`.
  - **Provider-initiated** conversion (`ConvertToBookingForProviderAsync`) now creates the booking in `AwaitingCustomerConfirmation` (not auto-`Confirmed`) when `Booking:RequireCustomerConfirmationForProviderLeadBooking` is true (default). `ConfirmedByProvider=true`, `ConfirmedByCustomer=false`; the customer confirms via `PATCH /bookings/{n}/status` → Confirmed. A `Customer`-party `BookingTimeoutCheckMessage` (`Booking:CustomerConfirmationTimeoutHours`) expires it to `RejectedTimeout` if unconfirmed. Set the flag false to keep legacy auto-confirm. Customer-initiated conversion is unchanged (`AwaitingProviderConfirmation`). Every successful conversion also raises the gated booking-created admin alert (`Booking:SendAdminAlertOnBookingCreated`). See `clinqet-booking-lifecycle` for the full confirmation/timeout/alert model.

### BroadcastMatchingService.cs
Eight-phase pipeline, executed once per broadcast on `broadcast-processing` queue:
1. **Location validation** — reject `(0,0)` + empty city (bug BC-12). Need usable coords (|lat|, |lng| > 0.0001) OR city name.
2. **Description cleaning** — strip Lucene specials `+ - & | ! ( ) { } [ ] ^ " ~ * ? : \ /`, normalize whitespace, remove price patterns, drop stop words + generic service words (from appsettings).
3. **BM25 text build** — concat cleaned description + subcategory terms.
4. **Embedding generation** — `EmbeddingService` → 3072-dim vector from cleaned desc.
5. **Parallel BM25 + Vector** queries against Azure Search index. BM25 weights: `serviceName=15, searchKeywords=8, synonyms=6, ...`. Vector: HNSW `M=10, EfConstruction=400, EfSearch=500`.
6. **Semantic skip decision** — if high-confidence fusion, skip; else semantic re-rank (Microsoft Reranker).
7. **Fusion (RRF) + boosts** — subcategory match boost, service-area match boost, location proximity, exclude closed services / inactive businesses.
8. **Search expansion** — if no results and `EnableSearchExpansion=true`, retry with expanded radius; apply `ExpandedMatchMinNormalizedScore` floor.

Result: ranked providers + `MatchingMetrics` (timings, counts, API calls).

### BroadcastProviderService.cs (provider-side)
- `GetInboxAsync(businessId, paged, status?)` — Leads inbox.
- `GetBroadcastAsync(businessId, broadcastId)` — detail; **auto-transitions `Delivered → Opened`** on first access (sets `OpenedAt`, increments `ProvidersOpened` counter, idempotent).
- `PlaceBidAsync(businessId, providerName, profilePic, broadcastId, dto, timeout)` — optimistic concurrency with `BroadcastBidConcurrencyConflictException` (returns 409); `Opened → Engaged`; rate-limited; emits `BroadcastBidReceived`.
- `UpdateBidAsync`, `WithdrawBidAsync`, `DeleteAsync` (sets IsHidden + optional MutedUntil), `UnmuteAsync`.
- Terminal-status guards: Won/Lost/Expired/Cancelled cannot transition further except for the explicit "re-bid after rejection" path.

### BroadcastAnalyticsService.cs / BroadcastClassificationService.cs
Captures opened/bid events to analytics queue. Classification calls AI for category/subcategory + photo analysis + spell correction. The photo half runs on `AiModels.Reader` (`gpt-5.6-luna`, `BroadcastClassification:VisionDeploymentName`, mapped by deploy.ps1): 90.1% right on 29 labelled photos (2026-09-02). `ClassifyCategoryAsync(text, photoUrls, businessId, location, userId, ct)` — `userId` scopes photo SAS minting to the caller's own blobs (`IsValidBlobUrlForBusiness`, fail-closed when no owner scope) and records LLM token usage via `IAiRateLimitingService.RecordTokenUsageAsync(RateLimitEndpoint, userId, tokens)`. Validation repairs swapped or mismatched (category, subcategory) pairs from the catalogue lookup, counts unrepairable pairs as invalid, dedupes identical pairs (highest confidence wins), rescales all-≤1 LLM confidences ×100, and bypasses the embedding coherence guard when the query embedding is empty (an embedding outage must not drop LLM picks). The embedding-only fallback returns null on empty embedding or zero similarity and returns a parent-only recommendation (no fabricated subcategory) when only a parent matches.

---

## CONTROLLERS (`clinqetapi\Clinqet.API\Controllers\Broadcast\`)

### `BroadcastController.cs` — customer endpoints, JWT required (customer claim), CORS `B2CPolicy`, route `/api/v{version:apiVersion}/broadcast`

| Verb | Route | DTO | Notes |
|------|-------|-----|-------|
| POST | `/upload-urls` | `BroadcastSasUrlRequestDto` | validates count, size, MIME, extension |
| POST | `/classify` | `BroadcastClassifyRequestDto` | rate-limited (`broadcast-creation` key) |
| POST | `/` | `CreateBroadcastRequestDto` | Idempotency-Key header optional; enqueues processing |
| GET | `/{broadcastId}` | — | |
| GET | `/` | — | paged + status filter |
| PUT | `/{broadcastId}` | `UpdateBroadcastRequestDto` | |
| POST | `/{broadcastId}/cancel` | `CancelBroadcastRequestDto?` (reason) | cancel (a bare DELETE is 405 — verified live 2026-08-09) |
| POST | `/{broadcastId}/award` | conversationId in body | transitions Awarded, creates booking |
| GET | `/{broadcastId}/responses` | — | for choosing winner |
| POST | `/{broadcastId}/reject-bid` | conversationId | |
| POST | `/{broadcastId}/convert-to-booking` | `ConvertBroadcastToBookingRequestDto` | |

### `BroadcastProviderController.cs` — provider endpoints, JWT required (partner claim), route `/api/v{version:apiVersion}/business/broadcast`

| Verb | Route | Notes |
|------|-------|-------|
| GET | `/inbox` | paged + status filter; returns `BroadcastProviderPagedResultDto` |
| GET | `/inbox/status-counts` | whole-inbox per-status totals (`BroadcastProviderStatusCountsDto {statusCounts, total}`) powering the leads-tab counts; literal route wins over `inbox/{broadcastId}` |
| GET | `/inbox/{broadcastId}` | auto-marks Opened |
| POST | `/{broadcastId}/bid` | `PlaceBidRequestDto`; 409 on concurrent bid |
| PUT | `/{broadcastId}/bid` | update existing |
| DELETE | `/{broadcastId}/bid` | withdraw |
| POST | `/{broadcastId}/hide` | soft-delete |
| POST | `/{broadcastId}/unmute` | clear `MutedUntil` |
| POST | `/{broadcastId}/convert-to-booking` | provider-initiated |

---

## FUNCTION APP (Service-Bus-triggered) — `clinqetfunctions\Clinqet.Communications\Functions\`

| Function | Queue setting | Purpose |
|----------|--------------|---------|
| `BroadcastProcessorFunction.cs` | `ServiceBusSettings:BroadcastProcessingQueueName` | runs the 8-phase matching pipeline, creates `BroadcastProvider` docs + `BroadcastDispatch`, batches notifications, updates counters |
| `BroadcastExpiryFunction.cs` | `:BroadcastExpiryQueueName` | sets `Broadcast.Status=Expired`, updates engaged providers to `Expired`, optional customer reminder email |
| `BroadcastStatusUpdateFunction.cs` | `:BroadcastStatusUpdatesQueueName` | propagates status changes (award/reject/convert) across both sides |
| `BroadcastTieredExpansionFunction.cs` | `:BroadcastTieredExpansionQueueName` | staged rollout for SoftCap/Tiered strategies; uses `ProcessedExpansionBatches` for idempotency |
| `BroadcastUpdateNotificationFunction.cs` | `:BroadcastUpdateNotificationsQueueName` | routes customer-edit notifications to all engaged providers |

Failure path (every function): `FailureNotificationHelper` → admin alert (DLQ after MaxDeliveryCount).

---

## APPSETTINGS (`clinqetapi/Clinqet.API/appsettings.json`, also Function App)

`ServiceBusSettings` (the 5 broadcast queue names) + `BroadcastSettings`:

```jsonc
"BroadcastSettings": {
  "Enabled": true,
  "CompanyName": "Clinket",
  "DefaultExpiryDays": 7,
  "MaxExpiryDays": 30,
  "MaxMediaFiles": 10,
  "MaxActiveBroadcastsPerUser": 5,
  "MinDescriptionLength": 10,
  "MaxDescriptionLength": 2000,
  "BidTimeoutSeconds": 30,
  "Matching": {
    "DefaultRadius": 10, "MinRadius": 0.5, "MaxRadius": 200,
    "DefaultRadiusUnit": "Miles",
    "EnableVectorSearch": true, "EnableSemanticSearch": true,
    "EnableSearchExpansion": true,
    "EnableMatchingGeocodeFallback": true,
    "MinNormalizedScoreThreshold": 15.0,
    "ExpandedMatchMinNormalizedScore": 25.0,
    "StopWords": [...], "GenericServiceWords": [...], "ActionIntentWords": [...]
  },
  "Notifications": {
    "SendBroadcastReceivedEmail": true,
    "SendBroadcastBidReceivedEmail": true,
    "SendBroadcastAwardedEmail": true,
    "SendBroadcastExpiredEmail": true,
    "SendBroadcastCancelledEmail": true,
    "SendBroadcastExpiryReminderEmail": true
  }
}
```

Every BroadcastSettings option must have a matching class default in the bound C# options class — keep them in sync (memory: `feedback_appsettings_class_defaults.md`).

---

## NOTIFICATIONS

**Customer-quote-created admin alert (temporary, post-launch monitoring):** `BroadcastService.CreateAsync` raises a gated `AdminAlertType.CustomerQuoteCreated` (Low — named CustomerQuoteCreated to disambiguate from provider quotes; distinct from the unrelated `CommunicationSubTypes.QuoteCreated`) on the success path, **overlapped with the BroadcastCreated analytics send via `Task.WhenAll`** (ServiceBusService pre-creates all senders in its ctor ⇒ concurrent sends to different queues are thread-safe; both tasks are fully exception-isolated so WhenAll never faults). Gate `Broadcast:SendAdminAlertOnCustomerQuoteCreated` (default true) — flat IConfiguration key (like `Booking:*`), read once into a readonly bool, NOT the `BroadcastSettings` options class. Payload entirely from the in-memory `created` entity (ZERO extra Cosmos calls): CustomerNumber, BroadcastNumber, CategoryName + subcategory NAMES only (no ids), truncated Description, City, Radius/Unit, Status. Idempotent-create 409 returns early ⇒ no double-alert; queue-failure path throws before the alert. Try/caught (never breaks create). See memory `project_quote_message_admin_alert_gates_2026_06_07`.

Dispatch via `ICommunicationDispatcher.DispatchAsync(CommunicationRequest)` — see `clinqet-notifications` skill. Required wiring:
- `NotificationType` enum value (string) must be in `SignalRSettings:EnabledNotificationTypes` whitelist in Main API `appsettings.json` to get real-time delivery.
- `NotificationTitle` / `NotificationBody` must be **pre-formatted** with `string.Format()` before dispatch — never raw localization keys with `{0}` placeholders.
- Email templates in `clinqetinfrastructure\Resources\EmailTemplates\en\Broadcast*.html`: BroadcastAwarded, BroadcastBidReceived, BroadcastBidRejected, BroadcastBidUpdated, BroadcastBidWithdrawn, BroadcastCancelled, BroadcastExpired, BroadcastExpiryReminder, BroadcastFailed, BroadcastMessage.

---

## FRONTEND — CUSTOMER ("Get Quotes")

`C:\Nik\clinqetwebuserapp\`

- Routes: `app/(customer)/quotes/page.js` (list), `quotes/new/page.js` (create), `quotes/[id]/page.js` (detail + responses).
- Components: `components/customer/quotes/` — `QuoteCreateForm.jsx`, `QuoteList.jsx`, `AIConfirmModal.jsx`, `AIQuoteNudge.jsx`, `AIQuoteIcon.jsx`, `AIQuoteSpark.jsx`, `QuoteButton.jsx`, `ai/expiryUrgency.js`.
- Copy: every label/button/error is a `react-intl` key. NEVER hardcode "Quote"/"Get Quotes"; route through localization.
- SEO: `/quotes` and `/quotes/new` pages need proper metadata.

## FRONTEND — PROVIDER ("Leads")

`C:\Nik\clinqetwebpartnerapp\src\`

- Routes (`routes/routeConfig.jsx`): `leads: "/dashboard/leads"`, `leadDetails: "/dashboard/leads/:id"`. Also legacy public `/leads/:id`.
- Pages: `app/dashboard/leads/page.jsx` (inbox), `app/dashboard/leads/[id]/page.jsx` (detail + bid).
- Tab counts come from `GET /inbox/status-counts` (`getProviderLeadStatusCounts`), NOT from the loaded page — refreshed on mount, manual refresh, and the debounced SignalR lead-update handler; on fetch failure the tabs fall back to counting the loaded page. The header "bids" metric stays page-derived (not status-derivable).
- Localization via `react-intl`. NEVER hardcode "Lead"/"Bid".
- Per-side delete: kebab on phone list item; visible trash on broadcast vs. direct (see memory `project_dm_per_side_delete_2026_05_08`).
- Mute parity: provider gained Mute UI; uses `PATCH /api/v1/business/broadcast/{id}/...` and `unmute` endpoint.

---

## BUSINESS RULES (NON-NEGOTIABLE)

1. **Customer cannot see provider PII** until the customer awards (or the provider explicitly shares via `ContactPreferences`). Provider sees a sanitized customer hint until award.
2. **Auto-open on first view** is idempotent — calling GET detail twice from the same provider must not increment `ProvidersOpened` twice.
3. **Bid concurrency** is optimistic: simultaneous bids from same provider get a 409; client must retry with the latest bid view.
4. **Award is one-shot** — terminal. Cannot re-award. Other engaged providers transition to `Lost`.
5. **Expiry** is timer-driven by `BroadcastExpiryFunction` — not by reads. Status must reflect Expired even if no provider opens the lead.
6. **Tiered expansion** is idempotent — `ProcessedExpansionBatches` prevents double-fan-out on Service Bus redelivery.
7. **Geocoding fallback** — if Cosmos doc has only `(city, state)` (no coords), geocode at matching time; never reject the broadcast for missing coords if city/state are present.
8. **Counters use atomic increment** via Cosmos PATCH — never read-modify-write.

---

## TESTING

- Unit: `Clinqet.API.UnitTests/Controllers/Broadcast*.cs`, `BroadcastControllerTests.cs`, `BroadcastProviderControllerTests.cs` (+ Additional).
- Integration: `Clinqet.API.IntegrationTests/Controllers/Broadcast*IntegrationTests.cs`.
- Function tests: `Clinqet.Communications.UnitTests/Functions/Broadcast*Tests.cs` and `Clinqet.Communications.IntegrationTests/Tests/Functions/Broadcast*IntegrationTests.cs` (5 functions).

Every new endpoint, repo method, service path, function handler needs **both** unit AND integration tests. Match the existing patterns: `ClinqetApiFactory`, `TestTokenHelper`, AutoFixture for entity build, Cosmos emulator via Testcontainers.

Beware: **Cosmos emulator ≠ prod** for composite-index ORDER BY matching — add string-shape SQL unit tests when adding new keyset queries (memory: `feedback_cosmos_emulator_vs_prod_matcher.md`).

---

## CHECKLIST BEFORE MERGE

- [ ] Partition key included in every new query (no cross-partition).
- [ ] Status transitions guarded by terminal-status checks.
- [ ] Counter increments use atomic PATCH, never read-modify-write.
- [ ] Idempotency key respected on create; content-hash bucket fallback wired.
- [ ] Notification dispatch via `ICommunicationDispatcher` only — no direct queue writes.
- [ ] New `NotificationType` value added to `SignalRSettings:EnabledNotificationTypes` in Main API `appsettings.json`.
- [ ] New email template added under all supported language folders.
- [ ] New appsetting has a matching class-default in the options class.
- [ ] New Cosmos index reviewed in `cosmosindexsetup\Program.cs`.
- [ ] No cross-partition query introduced anywhere — this is non-negotiable.
- [ ] Unit + integration tests added; build clean; ESLint clean on changed UI projects.
- [ ] Customer UI uses "Quotes" copy; provider UI uses "Leads" copy; all via localization keys.

---

## ‼️ TWO PLANS (2026-10-04, CURRENT) — two waves, rescue leads, over-quota leads

Authority `C:\Nik\Data\two-plan-pricing\PLAN.md` (D4–D7). Plans are `SubscriptionTier { Free, Premium }`. This
**supersedes** the four-step timing (Max/Premium/Basic/Free), the old delay knobs and the Free 5 / Basic 25 /
Premium 100 / Max ∞ quota ladder described in the dated sections below — those are history.

**Entitlements (catalog v12, admin-editable per region):** `leads_priority` Premium **1** / Free **2**;
`leads_quota` Premium `null` (unlimited) / Free **5**. `LeadAccessGate.QuotaOf`: `null` = uncapped, **`0` is a real
cap** (no normal leads, rescue leads only — it used to read as unlimited). Caps apply only when
`Payments:UsageCapsEnabled`.

**Two waves — `BroadcastMatchingService.AssignTierSteps(leadsPriorities, strategy, matching)`:**
- `MatchAll` ⇒ everyone step 1 (no waves, no rescue).
- `Tiered`: `WaveForPriority` = 1 for `leads_priority <= 1` (Premium), else 2 (Free / unknown). With
  `floor = MinProvidersToServe` (15): if `EnablePremiumExclusiveWindow` (true) and `countPremium >= floor`, step 1 =
  Premium only; otherwise step 1 = the first `min(max(countPremium, floor), n)` providers of the
  priority-then-relevance list, so the **most relevant Free providers join wave 1 at once**. At least 1 provider is
  always in step 1 when any matched. Everyone else keeps their own wave.
- Wave 2 is released at `LeadWaveSchedule.ReachesAt(activatedAt, step, matching)` = activation +
  `Broadcast:Matching:FreeDelayMinutes` (default **30**); the lead rows store that instant (`reachesYouAt`) and the
  processor schedules the `BroadcastTieredExpansionMessage` from the same rows. `MaxExclusiveWindowMinutes`,
  `PremiumDelayMinutes` and `BasicDelayMinutes` no longer exist.

**RESCUE rule — the stored fact `BroadcastProvider.PulledUpByFloor` (owner-approved 2026-10-05):** set ONCE at match
time by `BroadcastMatchingService.IsPulledUpByFloor` (wave 1, plan's own wave later, strategy not MatchAll), stored only
when true (`DefaultValueHandling.Ignore`, not indexed: ProviderData excludes `/*`), carried through `AdoptWavePlanAsync`
(Set / Remove). The gate reads ONLY this flag — never the wave number, the current plan or today's strategy — so a capped
Premium is capped, the pre-reindex window caps correctly, and after a Premium→Free drop leftover Premium-wave leads follow
Free rules. `LeadWaveMember(BusinessId, PulledUpByFloor)`: the dispatch list does not carry the flag, so the status /
update functions pass false and check the lead row; later waves are never rescues. A rescued provider got the lead only
because Premium alone could not reach the floor. While under the quota a rescue
lead is counted like any other; at or past the quota it is still allowed and is marked spent
(`TryConsumeLeadUsageAsync`) **without** incrementing the counter. Rescue rows are never quota-blocked.

**Silenced leads (`BroadcastProvider.SilencedAt`, owner-approved 2026-10-05):** with `NotifyOverQuotaLeads` off, an
over-limit lead is settled by `SettleWithoutNoticeAsync`, which sets `silencedAt` (NOT `notifiedAt`, which means a notice
was really sent); stored only when set. `NoticeHandled` (notified OR silenced) stops every later claim/notice. Updated and
ended notices for a silenced lead go out only once the provider opened or worked it (`IsSpent`). `NotifyOverQuotaLeads`
is ON by default since 2026-10-05: over-limit providers get push + in-app with the locked words, never email/WhatsApp.
The monthly `LeadQuotaReached` notice is push + in-app only (SkipEmail/SkipSms/SkipWhatsApp).

**Act-on (detail / bid / ask) — `EnsureCanActOnLeadAsync`:** past the quota on a normal lead,
- the **detail** endpoint returns **200** with a locked card `LeadAccess.LimitReached` (category + area only, like
  `Waiting` / `Missed`) instead of a 429;
- **bid / ask** still throw `LeadQuotaExceededException` ⇒ 429 `lead_quota_exceeded` (message `Error_LeadMonthlyLimitReached`, or
  `Error_LeadMonthlyLimitReachedTopPlan` when `LeadAccessDecision.UpgradeAvailable` is false); the deny still publishes
  `AdminAlertType.LeadQuotaReached`.
The inbox maps an `Open` lead to `LimitReached` when `ILeadAccessGate.LocksLead(usage, lead)` (Delivered, not yet
spent, quota exhausted, not rescue) — the ONE rule shared by the inbox, the lead page and Business Search
`ListLeadsTool`.

**One notice when the last included lead is used:** the atomic increment that returns exactly `cap` calls
`ILeadQuotaNotifier.NotifyLimitReachedAsync` ⇒ one `SystemNotification` per month (data `Type: "LeadQuotaReached"`,
`MonthlyCap`; event id `leadquota-{yyyyMM}`), Financial routing + `billing.read` + `BillingPayments` preference,
deep link `BillingPagePaths.Plan`, in-app + push only (`SkipEmail/SkipSms/SkipWhatsApp`). Keys
`Notification_LeadQuotaReached_{Title,Body}`, or `_TitleTopPlan` / `_BodyTopPlan` when there is no higher plan.

**Over-quota Free providers still receive the lead** (customer-neutral) but not the per-lead announcement:
`BroadcastProcessorFunction` and `BroadcastTieredExpansionFunction` call `ILeadAccessGate.FindQuotaBlockedAsync`
per wave (fails OPEN); the result maps each blocked businessId to its `UpgradeAvailable`. Blocked ⇒ never email or
WhatsApp; push + in-app only when `Broadcast:Matching:NotifyOverQuotaLeads` (default `false`), worded by `LeadNotice`
(`Notification_BroadcastReceivedLocked_{Title,Body}`, body `_BodyTopPlan` when there is no higher plan).

**Silent settle (`NotifyOverQuotaLeads` off):** both functions call `IBroadcastProviderRepository.SettleWithoutNoticeAsync` —
ONE ETag-conditional patch that sets `notifiedAt` (and clears the dispatch lock + last error). It returns false and writes
nothing when the row is already settled or another worker holds a live claim lock (`notificationDispatchLockedUntil` in the
future); a claim or settle since the read turns the write into a 412, never a second write. The processor still counts the
lead as sent — it sits in the inbox as a locked card.

**Spent + locked leads after the end (2026-10-04 audit):** `IsSpent` reads only facts a terminal status never erases (`leadUsageConsumedAt`, `openedAt`, `latestBid`, or status Opened/Engaged/Won), so a redelivered `BroadcastStatusUpdateFunction` still sees an unopened lead as unopened; the locked-skip branch stamps `terminalNotifiedStatus` first, so a redelivery never announces a lead that was deliberately left silent. `LocksLead` applies only to Queued/Delivered rows. The detail endpoint throws (client retries) when the request cannot be read, returns 404 for an unopened lead whose request is gone, and never flips Delivered→Opened on a gate fail-open (`LeadAccessDecision.FailedOpen`). A failed counter increment releases the consume marker (`IBroadcastProviderRepository.ReleaseLeadUsageAsync`); a Cosmos SDK timeout fails open, only caller cancellation rethrows.

**`GET business/broadcast/lead-usage`:** `BroadcastLeadUsageDto` gained `upgradeAvailable` (true only for `Free`).
Premium is unlimited ⇒ no meter; `cap: 0` is real.

**UI:** partner web `components/leads/LockedLeadCard.jsx` and provider mobile `Broadcast/LockedLeadCard.tsx` draw the
`LimitReached` card with "Unlock with Premium" (or "Start free trial" when a plan trial is live — web
`utils/planTrialOffer.js`, mobile `hooks/usePlanTrialOffered.ts`); a member without `billing.read` sees the text
without the button. Copy says **Premium gets new requests first** — never Basic / Max.

---

## PHASE 8 (SHIPPED) — Approach F tier-step delivery + lead-volume caps

> ‼️ History. The step/delay model and the quota values below were replaced on 2026-10-04 — see "TWO PLANS" above.

**CHANGE 1 — Lead delivery = Approach F (replaces size-based waves).** `BroadcastMatchingService.AssignTierSteps(IReadOnlyList<int> leadsPriorities, strategy, matching)` (was `AssignBatches`) assigns each provider a 1-based **tier-step** = `NotificationBatch` off `leads_priority` (Max=1→step1, Premium=2→step2, Basic=3→step3, Free=4→step4), relevance-ordered WITHIN each step. A **never-starve floor** `MinProvidersToServe` guarantees step 1 holds ≥ floor providers: if `countMax ≥ floor` AND `MaxExclusiveWindowMinutes > 0` → Max-only window (step1 = all Max); else the window collapses and step1 = the first `max(countMax, floor)` providers (pulled by relevance). `n ≤ floor` ⇒ everyone step 1. **MatchAll** ⇒ all step 1 (immediate override). Scheduling is **fan-out, not chained**: `BroadcastProcessorFunction.ScheduleTierStepsAsync` schedules one `BroadcastTieredExpansionMessage` per non-empty step>1 at its absolute offset (`TierStepDelayMinutes`: step2=`PremiumDelayMinutes` 15, step3=`BasicDelayMinutes` 45, step4=`FreeDelayMinutes` 75) on the existing `BroadcastTieredExpansionQueueName`; `BroadcastTieredExpansionFunction` processes its own step and **no longer self-chains** (avoids halting on an empty intermediate step). Idempotency unchanged (per-provider `TryClaimNotificationDispatchAsync` + `TryRecordExpansionBatchAsync`). New `BroadcastSettings.Matching` knobs: `MinProvidersToServe/MaxExclusiveWindowMinutes/PremiumDelayMinutes/BasicDelayMinutes/FreeDelayMinutes` (replaced `InitialBatchSize/BatchMultiplier/MaxRounds/ExpansionDelayHours`). **Promo == today:** all Max ⇒ countMax==n ⇒ all step 1 ⇒ immediate, pure-relevance.

**CHANGE 2 — Lead-volume caps by tier (customer-neutral).** New `leads_quota` entitlement (monthly act-on cap; seeded per region: Free 5 / Basic 25 / Premium 100 / Max `null`=unlimited; migration `AddLeadsQuotaEntitlements`). Counter = atomic Cosmos SystemData `LeadUsageCounter` (`leadusage_{businessId}_{periodKey yyyyMM}`, pk=businessId, `PatchOperation.Increment`, TTL `PaymentSettings.LeadUsageCounterTtlSeconds`) behind `ILeadUsageCounter`/`LeadUsageCounterRepository`. `ILeadAccessGate`/`LeadAccessGate.EnsureCanActOnLeadAsync` enforces at **act-on** (first full-detail open `GetBroadcastAsync`, bid `PlaceBidAsync`, contact `AskQuestionAsync`), consumed **once per (provider,broadcast)** via the `BroadcastProvider.leadUsageConsumedAt` conditional-patch marker (`TryConsumeLeadUsageAsync`) — re-acting on a spent lead never re-charges. Over quota ⇒ `LeadQuotaExceededException("Error_LeadMonthlyLimitReached")` → controller **403** localized. Honors `UsageCapsEnabled` (off ⇒ inert) + promo (Max ⇒ unlimited ⇒ no count). Fail-OPEN on counter blip. Boundary inclusive: a provider may act on exactly `cap` leads/month; the (cap+1)-th is denied. NEVER blocks notify/match (customer unaffected). `GET business/broadcast/lead-usage` → `BroadcastLeadUsageDto {capsEnabled,unlimited,used,cap,remaining,periodKey}` powers the web leads meter (`LeadUsageBanner`, hidden when unlimited). **No cross-partition; no new container; no new SB queue; no deploy.ps1/ARM change.**

**Mobile** (`clinqetmobilepartnerapp`): the provider leads/Broadcast surface EXISTS at `src/Screen/ProfileFlow/Broadcast/`; the `LeadUsageMeter` (list-header, hidden when unlimited) is shipped there with a **P4-compliant info-only CTA** — `Open the web app` → `Linking.openURL(${PARTNER_HOSTING_URL}/dashboard)` (NEVER /billing, no price/vendor). `getLeadUsage()` + `BroadcastLeadUsageAPI`; localized en/hi/gu/es.

---

## 2026-07-02 DEEP-REVIEW FIXES (search+broadcast engagement, sessions 1-2)

**Free tier receives leads (catalog v3).** `BillingCatalogDefinition` bumped `CatalogVersion` 2→3: the `leads` entitlement is now enabled for ALL tiers and `leads_priority` Free=4. `BillingCatalogSeeder.ApplyEntitlementRelease` applies the value changes to existing rows exactly once on next API start. `AzureSearchIndexer` stamps `leadsPriority` via `GetLimit("leads_priority") ?? 4` (unknown never outranks Basic) — existing index docs need one reindex pass to pick up `leadsEligible=true`/`leadsPriority=4` for Free providers. NOTE: the promo (everyone=PremiumMax) currently masks this; it matters when the promo ends.

**Self-match exclusion (BY DESIGN).** `BroadcastMatchingService` excludes `hit.BusinessId == broadcast.UserNumber` — a provider posting a quote from their own account never receives their own lead. Do not "fix" this.

**Rate-limited providers keep the lead.** `ProviderNotificationRateLimitService` (>5 lead notifications/60min) only skips the push/email/WhatsApp announcement — the `BroadcastProvider` doc is still written (Queued leads ARE shown in the inbox). Accepted design; the skipped announcement is never retried. Counter = SystemData doc `pnrl_{businessId}` (pk = businessId) mutated by a conditional atomic PATCH increment (`FilterPredicate` on `windowStartEpoch`; expired window => conditional reset patch; `NOT IS_DEFINED` guard resets malformed/legacy docs) - never read-modify-write. Fails CLOSED with a cooldown-gated admin alert. Proven against the real Cosmos emulator in `ProviderNotificationRateLimitIntegrationTests`.

**Matcher correctness (session 1).** `AppendGeoDistanceFilter` converts `MaxRadius` by `DefaultRadiusUnit` before the km comparison; `CoversBroadcast` is an instance method using `LocationLatitudeEqualityTolerance` with both-near-zero semantics (single-zero ordinates near the equator/prime meridian no longer disable coverage checks); radius-expansion fusion receives the `MatchingNoMatchBreakdown` so rejected-provider analytics are captured for expansion attempts too.

**Bid-counter generations (F1).** `BroadcastBidSummary.Generation` (int, `clinqetcore\Entities\COSMOS\Cosmos.cs`) versions each bid lifecycle: counter dedup keys are `placebid:{biz}:{bc}:{gen}` / `withdraw:{biz}:{bc}:{gen}` via `BroadcastProviderService.NextBidGeneration` (rebid after withdraw/reject ⇒ gen+1; in-place update keeps gen; the 412-retry path re-derives gen). Fixes `bidsReceived` permanently under-counting across bid→withdraw→rebid cycles. `RejectBidAsync` + `BroadcastStatusUpdateFunction.GetTerminalBidSummary` propagate Generation. Known bounded caveat: `appliedCounterDeltas` is untrimmed (bounded by the 5/window bid rate limit + broadcast TTL).

**Terminal-status redelivery idempotency (F4/F6).** `BroadcastProvider.TerminalNotifiedStatus` + `IBroadcastProviderRepository.TryMarkTerminalNotifiedAsync(businessId, broadcastId, terminalStatus)` (ETag + FilterPredicate, same pattern as `MarkProviderDeliveredOnDispatchAsync`): `BroadcastStatusUpdateFunction` stamps BEFORE emitting terminal notifications/conversation messages; already-stamped ⇒ skip emission but still apply the status patch. Providers with `NotifiedAt == null` get the status patch but no announcement (no ghost "you lost" notifications). The marker — not MessageId — is the dedup mechanism.

**Other lead-plumbing fixes (session 1, WS4).** Quota gate runs AFTER the broadcast-Active check in `PlaceBidAsync`/`AskQuestionAsync` (dead leads no longer burn quota); `ShareEmail`/`SharePhone=false` null the fields on write AND gate the provider projection (pre-award PII); `MarkAsOpenedAsync` carries a `status='Delivered'` condition; `UpdateBidAsync` handles 412 with a dedicated PreconditionFailed catch (terminal ⇒ `Error_BroadcastProviderTerminalStatus`, else the 409 conflict contract — no admin alert on routine races); `IBroadcastBidRateLimitService.CanAcquire` (non-consuming peek) lets WithdrawAndRebid check the limit BEFORE withdrawing; expansion counter `remainingQueued = laterBatches + (toExpand.Count − expandedCount)`.

**Classification hardening (session 1, WS5)** is documented inline in the BroadcastClassification section above (blob ownership scope, catalog-coherence validation, empty-embedding guards, punctuation-preserving splice, token metering).

**Final-audit hardening (same engagement, post-audit).** `BroadcastStatusUpdateFunction`: the per-provider terminal patch result is CHECKED — an ETag race (concurrent bid update) re-reads + re-patches up to 3 attempts, else the provider counts as failed (never "you lost" while the doc stays live); the CUSTOMER terminal notification is one-shot via `BroadcastDispatch.TerminalCustomerNotifiedStatus` + `IBroadcastDispatchRepository.TryMarkCustomerTerminalNotifiedAsync` (same conditional-patch pattern as the provider marker); post-stamp emit failures increment `failedCount` (visible to the ≥50% alert) — replay requires clearing the marker. Fan-out ordering in `BroadcastProcessorFunction` + `BroadcastTieredExpansionFunction` is now **peek → claim → consume** (`IProviderNotificationRateLimitService.CanAcquireAsync` non-consuming peek; a redelivered batch cannot burn rate-limit slots for already-notified providers), and a claim-null (already dispatched) counts as expanded so the F7 queued math stays accurate across redeliveries. `bidsReceived`: the generation-keyed placebid delta is applied UNCONDITIONALLY (in-place updates re-apply the same key — no-op or heal) and the already-withdrawn path heals a lost withdraw decrement; `providersOpened` increments only when `MarkAsOpenedAsync` actually won the Delivered→Opened transition. The F13 limiter separates benign create/reset races from transient attempts (no spurious fail-closed) — settings doc: `MaxNotificationsPerWindow ≤ 0` is a floor-to-5, NOT a disable. Known accepted edge (display-only): prior-batch notification FAILURES drop out of `providersQueued` at the next batch (exact repair would need per-provider cross-partition reads; failures already alert at ≥50%).

**Counter accounting (2026-07-02, final).** `Broadcast.providersFailed` (new) + **derived** `providersQueued`: `BroadcastRepository.TryRecordExpansionBatchAsync(broadcastId, userNumber, expandedCount, failedCount, batchNumber)` increments Notified/Failed and re-derives Queued = `Matched − Notified − Failed` under the same ETag + once-per-batch guard — prior batches' failures and rate-limit skips can never leak out of the math. **Step 1 uses the same guard** (`batchNumber: 1`): the matching-complete patch now writes `providersNotified=0 / providersQueued=Matched / providersFailed=0` and `BroadcastProcessorFunction.RecordBatchCountersAsync` records the fan-out's ACTUAL outcome; the Active-redelivery retry heals a crash-before-record window by recording already-notified (observed during its per-provider point reads) + healed dispatches. Claim-null (already dispatched) counts as dispatched in `DispatchProviderNotificationsAsync` so redelivered/healed runs stay accurate. Rate-limited providers are neither notified nor failed ⇒ they remain in Queued (by design — the lead stays in their inbox).


## Lead-cap upgrade moment + truth fixes (Tracks A/B, 2026-07-11)

- **Delivery guarantee re-verified + pinned (owner D1, plan Part 3.5):** EVERY matched provider (≤2000) receives every lead; tiers only change timing (Max 0 / Premium +15 / Basic +45 / Free +75 min; 15-provider floor pulls lower tiers incl. Free to minute 0; <15 total ⇒ everyone at minute 0). The act-on quota (Free 5 / Basic 25 / Premium 100 / Max ∞, consumed once per lead) never blocks delivery. The stale "Free excluded" comment in `BroadcastMatchingService.cs` and the lying `billing.plans.leadCopy` (JSON ×3 langs AND the JSX defaultMessage in `Billing.jsx`) are fixed to the truth.
- **429 contract:** all 5 `LeadQuotaExceededException` catch sites in `BroadcastProviderController` return 429 + `ApiResponse.ErrorCode = "lead_quota_exceeded"` (shared `LeadQuotaExceeded<T>()` helper; used/cap deliberately NOT in the body — clients refetch `business/broadcast/lead-usage`).
- **Web block moment** (`leads/[id]/page.jsx`): `isLeadQuotaError()` (`utils/errorHandler.js`) → `quotaBlocked` state → `UpgradeNudge` replaces the not-found view (load-blocked) or the bid panel (action-blocked), composer hidden, usage line via `getLeadUsage()`. Keys `leads.quota.*` en/hi/gu.
- **Mobile block moment + false-success fix** (`BroadcastDetails.tsx`): shared `parseResponse()` checks `res.ok`/`json.success` on load/bid/update/replace/ask/withdraw/convert (the 429-sails-through-as-success bug is dead); quota 429 opens `UpgradeSheet` → in-app PLANANDBILLING (D7); load errors surface `TOAST_LOAD_ERROR` (4 locales). The leftover `{ const data = json.data; … }` block from the guard refactor was flattened (2026-07-11 s2).
- Shared limit UI = `UsageMeterCard`/`UpgradeNudge` (web) + `UsageMeter`/`UpgradeSheet` (mobile) — see partner-app / provider-mobile skills.

- **Lead-quota admin alert (2026-07-12):** the `LeadAccessGate` act-on DENY now publishes `AdminAlertType.LeadQuotaReached` via `ITierLimitAlertService` (once per provider per month, SystemData marker; name/phone/email/tier/used-cap in the payload) so admins get a reach-out list of providers who wanted more leads than their plan allows. Fail-quiet — the deny path never breaks on an alert hiccup.

## Tier-limits final audit fixes (2026-07-16)

- **Web lead detail (`leads/[id]/page.jsx`):** a SILENT/background refresh (SignalR-triggered) can no longer pop the quota wall or an error toast mid-typing — walls/toasts appear only on explicit user actions (mirrors mobile). A SUCCESSFUL load now clears a stale `quotaBlocked` wall (post-upgrade the composer returns immediately; previously the wall persisted after the server had already allowed — and consumed — the read).
- **Mobile detail (`BroadcastDetails.tsx`):** the booking-start pre-fill uses a functional state read — the deps-frozen closure could previously clobber a provider-picked booking time on every silent refresh (wrong-datetime bookings). `convert_to_booking_fail` analytics now carry the real `status` metadata like every other fail event.
- **Backend:** `WithdrawAndRebidAsync` peeks the lead quota READ-ONLY (`ILeadAccessGate.PeekActOnLeadAsync` (returns the decision, incl. `UpgradeAvailable`, from one read)) BEFORE withdrawing — an at-cap provider with an unconsumed lead can no longer end up bid-less with the customer notified of a withdrawal. `LeadQuotaExceededException` slimmed to message-only (Used/Cap were dead — clients refetch `lead-usage` by owner-locked design). The 429 + `errorCode:"lead_quota_exceeded"` contract is now pinned by 5 controller unit tests + a real-host-serializer camelCase wire-shape integration test.

## Broadcast filter extraction — BroadcastFilterBuilder (2026-07-16)

The matching OData filter now lives in `clinqetinfrastructure\Services\Broadcast\BroadcastFilterBuilder.cs` (static, pure — extracted zero-behavior-change from `BroadcastMatchingService`): `BuildCategoryFilter(broadcast, matching)`, `AppendLocationFilter(filter, broadcast, matching, locationIsValid)`, `AppendGeoDistanceFilter`, `AppendCityFilter`, `EscapeFilterValue`, plus `BuildLabeledClauses(broadcast, matching, locationIsValid)` → ordered `(Label, Clause)` list (labels: category, hardSubcategory?, isActive, businessStatus, isListed, allowOnlineBookings, leadsEligible, country, atCustomersLocation?, location) whose `" and "`-join is byte-identical to the production filter — pinned by golden-string tests in `Clinqet.API.UnitTests\Services\BroadcastFilterBuilderTests.cs`. `IsLocationValid` (instance settings) stays in `BroadcastMatchingService` and feeds the `locationIsValid` bool; the city-fallback warning log stays in the service's thin `AppendLocationFilter` wrapper. Filter-string edits happen ONLY in the builder; the admin provider-visibility diagnostic (see `clinqet-search-discovery` skill) replays `BuildLabeledClauses` clause-by-clause, so a new/renamed clause changes that report too.


## 2026-07-16 ZERO-MATCH INCIDENT FIXES (city-only geocode + normalized threshold + closed funnel)

**Incident (BC-2607B68E0D, Canada dev, verified live):** a city-only quote was created with `(0,0)` coords
(frontend `Number.isFinite(Number(null))` bug), matching ran in city-string mode, the location-scoring block
measured distances from Null Island (×`LocationMinMultiplier` crush), and the ABSOLUTE `MinScoreThreshold=0.02`
on raw RRF (scale ∝ 1/k) dropped the only real candidate at FusedScore 0.0042 ⇒ ZERO providers notified.
The poster's own business was self-match excluded (by design, previously uncounted).

**Fixes (all shipped + unit/integration/live-validated):**

1. **Nullable coordinates end-to-end, sentinel-free.** `BroadcastLocationDto.Latitude/Longitude` and the
   `BroadcastLocation` entity are `double?`; a (0,0)/half pair is stored as **null** at create
   (`BroadcastService.CreateAsync`). New entity fields `GeocodedAt` + `GeocodeSource`. Mobile (which already
   sent null) now works for city-only quotes. Idempotency hash uses `"null"` for absent ordinates.
2. **Business rule 7 is now IMPLEMENTED — matching-time geocode fallback.** `BroadcastMatchingService`
   Phase 1.5 `ResolveEffectiveLocationAsync`: coords unusable + city present ⇒ `IGeocodingService.GeocodeCityAsync`
   (city, state, country); success mutates the in-memory `broadcast.Location` (+`GeocodeSource="MatchingCityFallback"`)
   so the geo filter, distance scoring, coverage gate, expansion and provider-doc snapshots all run on real
   coordinates; failure degrades to the city-string filter (matching NEVER hard-fails on geocoder outage).
   `BroadcastProcessorFunction` persists the geocoded `/location` back onto the doc in the post-match patch
   (ONE PatchOperation.Set — patch stays ≤ the 10-op Cosmos cap). Setting: `EnableMatchingGeocodeFallback` (true).
3. **Usable-point guard on location scoring.** The scoring block and the normalization ceiling use
   `HasUsableBroadcastPoint` (both-near-zero tolerance, same rule as `CoversBroadcast`): city-mode scores are
   location-neutral (no distance, no ×0.3 crush, and the ceiling leaves out the location factor — since D-103 the curve's own peak).
4. **Scale-free threshold.** `MinScoreThreshold` (raw RRF) is DELETED; the floor is
   `MinNormalizedScoreThreshold = 15.0` applied to `NormalizedScore` (0-100, k-invariant). Invariant:
   `MinNormalizedScoreThreshold < ExpandedMatchMinNormalizedScore` (25.0). Dense candidate sets no longer
   silently zero/truncate.
5. **Closed funnel instrumentation.** `MatchingNoMatchBreakdown` gains business-level counters —
   `ProvidersBeforeFiltering`, `ProvidersDroppedByCoverageGate`, `DroppedBySelfMatch`, `DroppedByMaxProvidersCap` —
   with the invariant `matched == ProvidersBeforeFiltering − coverage − selfMatch − scoreThreshold − cap`
   (per attempt; expansion rows flagged by `SearchExpansionUsed`). EVERY dropped provider now gets a
   `RejectedProviderRecord` (stages: CoverageGate | SelfMatch | ScoreThreshold | MaxProvidersCap | ExpansionFloor)
   in the `broadcast-rejected-providers` detail parquet. Self-match exclusion REMAINS by design — it is now visible.
6. **Truthful analytics event.** `BroadcastProviderMatched` now stamps `BroadcastStatus=Active`, effective
   `SearchRadiusKm`/`Latitude`/`Longitude`, `LocationValidationApplied/Passed`, `LocationFallbackReason`
   (CoordsProvided | GeocodedCity | CityOnly-GeocodeFailed | CityOnly-GeocodeDisabled | NoUsableLocation) and the
   four funnel columns (appended to the broadcast parquet schema; version stays 1 pre-prod).
   `TryExpandRadiusAsync` records `ExpansionReason` = CityOnlyNoGeo | RadiusExpansionExhausted | RadiusExpanded.
7. **Matched-path provenance carry.** `CreateProviderDocumentsAsync` returns a fresh result — the location
   provenance fields are copied across (an integration test pins this; losing them silently skipped the
   `/location` persist).
8. **Frontend.** `QuoteCreateForm.jsx` uses a strict `isUsableGeoPair` helper (typeof number + finite + not-(0,0))
   for submit/classify/category-fetch; payload sends null coords when absent — never 0/0.
9. **Diagnostics.** Admin endpoints `GET /admin/search/provider-visibility/{businessId}` (gate-by-gate verdicts +
   per-clause OData simulation) and `POST /admin/search/reindex-business/{businessId}`; offline counterpart
   `C:\Nik\lead_brodcast_review\provider-visibility-forensics.py` (reads local.settings.{region}.json, read-only).

**Appsettings delta (both hosts):** `MinScoreThreshold` removed; `MinNormalizedScoreThreshold: 15.0` +
`EnableMatchingGeocodeFallback: true` added under `BroadcastSettings:Matching` (class defaults mirror JSON).

**Customer-mobile parity fix pack (2026-07-16, same engagement).** `clinqetmobileuserapp` quote creation now mirrors web:
shared guard `src/utils/geo.ts` `isUsableGeoPair` (jest-covered) applied at wizard state seeding (the global LocationContext
can legitimately hold a (0,0) optimistic city-pick whose geocode failed), the create payload (unusable pair ⇒ null/null;
city trimmed; `country` from CountryContext), classify (city + guarded coords + radius/unit — web semantics), the
recommended-services placeholder fetch (killed a `Number(null)→0` coords leak), and the `LocationPickerModal.onCityPicked`
handler (pick without a usable pair ⇒ coords CLEARED, never old-city coords under a new city name). The shared modal now
fires `onCityPicked` from the Places-autocomplete path too (typed picks reach the wizard). Failure envelopes are CHECKED
(`request()` never throws on HTTP errors): classify + create branch on `success === false` — a 400 can no longer render the
success screen; `errors[]` carries raw keys (BaseController) so `Error_BroadcastLocationInvalid` → `BROADCASTS.VALIDATION_LOCATION`,
category-family keys → new `BROADCASTS.VALIDATION_CATEGORY` (+`COORDS_ONLY`) ×4 locales, and raw `Error_*` strings never
display. Client pre-guards mirror the server rules (category + ≥1 subcategory; city OR usable pair). `createBroadcast`
now really sends the `Idempotency-Key` header (`urlApi.post` gained optional per-request `headers`; the old code
`void`-discarded the key).

---

## PHASE 3B (SHIPPED 2026-07-28) — WITHIN-WAVE EARNED QUALITY ORDERING

**One sentence:** tier still decides **when** a provider is notified (the `leads_priority` tier-step wave);
a new **earned-quality factor** now decides **who is contacted first inside that wave**. Nothing else moved.

### The invariant that shaped the whole design — ‼️ READ BEFORE TOUCHING THE MATCHER
`FuseAndRankResults` does **not** end at the relevance floor. Two stages remove providers, in this order:

| Line | Stage | Effect |
|---|---|---|
| `:1142` | `NormalizedScore >= MinNormalizedScoreThreshold` (15.0) | relevance floor |
| **`:1157-1172`** | **`OrderByDescending(FusedScore).Take(MaxProviders)`** | ‼️ **a RANK CUT on `FusedScore` that decides lead ELIGIBILITY**, recording each drop as `DroppedByMaxProvidersCap` + a `RejectedProviderRecord` |

⇒ **Any multiplier applied to `FusedScore` before `:1157` changes WHO RECEIVES A LEAD and corrupts the
closed-funnel arithmetic.** The quality factor is therefore **a sort key applied after everything**, in
`ExecuteMatchingAsync` at `:266`, and it **never mutates `FusedScore` or `NormalizedScore`.**

### `ApplyQualityOrdering` (`BroadcastMatchingService.cs:1195`)
```
sortKey = FusedScore × ProviderBoostComposer.ComposeForBroadcast(signals, broadcast.Location?.City, nowUtc, boost, badges)
order   = sortKey desc, then FusedScore desc, then businessId ordinal   // E1 tiebreaker
```
- Runs **after** the `MaxProviders` cap and **after** `ExpandedMatchMinNormalizedScore` on the expansion path.
- Wrapped: a throw **degrades to relevance order and logs at Error** — it may never cost a match.
- Feeds the existing **stable** `OrderBy(p => p.LeadsPriority)` at `:1269`, so the quality order survives
  inside every wave, **including the Premium wave** (was the Premium Max wave before 2026-10-04).

### `ProviderBoostComposer.ComposeForBroadcast` (`clinqetcore/Utilities/`)
`broadcastFactor = 1 + (response 0.040 + reliability 0.035 + completeness 0.025 + verified 0.012 +
clinketBadge 0.008 + newInArea 0.005)`, clamped at `Search:Boost:MaxCompositeFactor` (1.15).

| Rule | Why |
|---|---|
| ‼️ **TIER EXCLUDED** — stripped **inside** the method, not left to the caller | Tier already bought its advantage by deciding the WAVE. Counting it again is the double-application the Boost Register exists to prevent |
| ‼️ **FULL strength** (`HasSearchText = false`) — diverges from `/services`, which halves | Owner decision 2026-07-28. `/services` halves because relevance is ranking *different services* against typed words; here the set is already closed, and a non-responder at the front of a lead queue costs the customer the whole outcome |
| **null score = UNKNOWN**, contributes nothing | never a penalty, never treated as 0 |
| It **delegates to `Compose`** | one formula, so leads and search can never drift |

### ‼️ THE SELECT LIST IS LOAD-BEARING (`AddSelectFields`, `:2046`)
Azure returns **only what is SELECTED**. `responseScore`, `reliabilityScore`, `completenessScore`,
`isVerified`, `clinketBadge`, `newAreaSince` were added — omit one and that dial is **silently inert with
nothing failing** (the `newAreaSince` defect, master plan 12.8).
‼️ **`searchBoostFactor` is deliberately NOT selected**, so tier exclusion is *structural*: the value does
not exist to be passed in.

### Config — no new setting
`Search:Boost:*` and `Badges:*` were already bound in the **Functions** host, which is the **only** host
registering `IBroadcastMatchingService` (`clinqetfuncations/…/Program.cs:297`). No ARM, no `deploy.ps1`,
no `local.settings.json`, no reindex.

### Kill switches
`Search:Boost:MaxCompositeFactor = 1.0` ⇒ every factor is 1.0 ⇒ ordering **byte-identical to before**.
Any single weight `= 0` retires that dial. `Badges:NewProviderDays = 0` retires new-in-area.
‼️ **No feature flag was added** — the one flag this programme ever had (the tier BADGE, Phase 6) was deleted on 2026-10-04.

### What was NOT touched (assert this before any future edit)
`BroadcastFilterBuilder` (golden-pinned) · the coverage gate · both relevance floors · the `MaxProviders`
cap · `AssignTierSteps` · the never-starve floor · lead quotas · who receives a lead · every analytics
field and both Parquet schemas.

‼️ **One consequence the owner explicitly approved:** when `countMax < MinProvidersToServe` (since 2026-10-04:
`countPremium`) the floor collapses and pulls lower-tier providers to t=0. The floor still fires identically (same trigger, same
count, same delays, same steps array) but **which** lower-tier providers get pulled changes — from
"best word-match" to "best word-match that actually replies". That is the point of the phase.

### Tests
`ProviderBoostComposerTests` (+9): tier cannot change the answer at any value · full strength · every dial
kept · null = unknown · kill switch · ceiling · **identical to `Compose` with tier stripped**.
`BroadcastMatchingServiceTests` (+10): fast Free beats slow Free **inside** a wave · **never jumps a wave** ·
a large relevance gap cannot be closed · **match set never shrinks** (40 providers, a third with no signals) ·
**tier-step output byte-identical** with quality anti-correlated to relevance · `FusedScore`/`NormalizedScore`
never mutated · no signals ⇒ exact relevance order · deterministic ties · kill switch · **select list carries
every signal and deliberately not tier**.
‼️ 7 sabotages applied, **7 bit**.

## 22.9e (2026-07-30) — broadcast BM25 uses the SHARED query shaper
- `BroadcastMatchingService` no longer has a private `BuildFuzzyQuery`/`EscapeLuceneSpecialChars` — its BM25 query comes from `ISearchQueryTextProcessor.BuildSafeFullQuery` (Search:* fuzzy dials; the private copy had drifted and fuzzed 4-5 char words — `hair~1` ⇒ `air`).
- Settings REMOVED (do not re-add): `Broadcast:Matching:EnableFuzzySearch`, `Broadcast:Matching:FuzzyMinimumLength`. Broadcast's own preprocess + `GenericServiceWords`/`StopWords` remain (suggestion/preprocess paths).
- Cross-category exposure was never possible here — `BroadcastFilterBuilder` mandates `categoryId eq` — the shaper fix improves in-category text scoring. The semantic leg takes raw text.

## ‼️ 22.9f (2026-07-30) — the vector score is 1 + cosine, NOT a similarity
- Azure AI Search returns **`1 + cosine`** as `@search.score` on a cosine-metric vector index. Clamping it to [0,1] (what both search and broadcast did) maps **every doc with cos >= 0 to a perfect 1.0**, silently disabling EVERY cosine threshold: the fusion floor, the single-source boost gate, the semantic-skip confidence checks, and the suggestion floors.
- Always convert with **`Clinqet.Core.Utilities.VectorScoreNormalizer.ToCosineSimilarity`** (`score - 1`, clamped). ONE implementation on purpose — duplicated private copies are how this defect shipped in two services at once. Monotonic ⇒ RRF rank order is unaffected.
- Thresholds live in TRUE cosine space, calibrated from measured **query-side** embeddings (a strong match peaks ~0.40, typical genuine ~0.31, cross-domain noise <= 0.15): `Search:VectorMinScore` **0.15**, `SingleSourceVectorMinScore` **0.25**, `VectorHighConfidenceThreshold` **0.35**, `Semantic:SkipVectorThreshold` **0.30**, `Suggestion:*` **0.15 / 0.25**, broadcast **0.15 / 0.25**. ‼️ Doc-to-doc cosine runs ~3x higher than query-to-doc — never calibrate a query-side floor from doc-to-doc numbers.
- ‼️ OPEN (plan 22.9g): `NormalizeBM25Score` has the SAME saturation — K=50 against real raw scores of 645-1569 ⇒ every hit >= 50 clamps to 1.000 and the adaptive floor never adapts. Needs relative-to-top normalization, not a bigger constant.

## ‼️ 22.9g/22.9i (2026-07-30) — BM25 ratio-to-best + expansion-on-insufficient
- BM25 normalization is **ratio-to-best of the SAME query** via `Clinqet.Core.Utilities.LexicalScoreNormalizer` — never an absolute curve (raw BM25 is unbounded; `log(1+raw)/log(1+50)` saturated every real hit to 1.000). `BM25MinScore` = **0.005** is a measured RECALL junk-line (genuine matches run as low as ratio 0.0100; junk at 0.0047) — relevance is decided downstream by RRF + `MinNormalizedScoreThreshold` + the diversity band. Never "tidy" it up to a bigger number.
- **Expansion fires on too FEW results, not only zero**: `Search:Expansion:MinResultsBeforeExpansion` (3) / `Broadcast:Matching:MinProvidersBeforeExpansion` (3). **Every ladder phase must reach the threshold to declare victory** — a partial phase is remembered (best-so-far snapshot) and superseded, never returned early; originals are **union-carried** so a non-empty result set can never shrink.
- Partial expansion uses the `Search_Expansion_*_Partial` localization keys ("Only a few results…") — the base keys say "No results" and are a LIE when `PreExpansionResultCount > 0`.
- The 0-100 `searchScore`/NormalizedScore sent to the UI is `min(100, fused/maxRRF x 100)` — rank-based, unaffected by either normalizer.
- Every score dial is scale-free by construction: cosine (query↔doc property), ratio-to-best (per-query), RRF (rank-based), ratio bands. Corpus growth changes NONE of them.

## ‼️ 22.9k (2026-07-31) — vector queries MUST name the pure profile
- Azure returns **`1/(2 - cosine)`** on a cosine-metric vector index. Convert with `VectorScoreNormalizer.ToCosineSimilarity` (`2 - 1/score`). ‼️ NEVER assume `score - 1`.
- ‼️ **Every vector query must set `ScoringProfile = SearchScoringProfiles.VectorPure`.** Without it the query inherits the index `defaultScoringProfile`, whose freshness/rating/review/offer functions MULTIPLY the similarity (~1.9x, non-uniformly) — recency and commercial signals then decide the one leg that must be pure relevance. Measured: the best semantic match for "hair cut" fell out of the vector top 12. The profile declares ZERO functions; TextWeights are inert on a vector query (verified), so it needs no field list.
- Vector thresholds are TRUE cosine: fusion floor **0.20**, single-source gate **0.45**, semantic-skip **0.50/0.55**. Measured genuine 0.58-0.63; no-match ceilings 0.171 (gibberish) / 0.144 (a category with no services). `SearchThresholdCalibrationTests` fails if a dial leaves the evidence band.
- Unaffected by design (verified, do not "fix"): provider index (explicit profile, no vectors), facets, the semantic legs (read `RerankerScore`), BM25 legs (boosts belong there), voice catalog, and **classify** (in-process cosine over cached category vectors).

## ‼️ SEARCH-PERFORMANCE PHASE 4B (2026-08-09) — the broadcast consistency fix pack. Read before touching the matcher

All 13 drift findings from the async-broadcast review (master plan B4, `C:\Nik\search-performance\`) are FIXED. Audit: `search-performance\audits\PHASE-4-AUDIT.md`.

- **D2 — the shared shaper now shapes identically in both hosts.** `Search:GenericServiceWords` (49) + `Search:StopWords` (64) were MISSING from the functions appsettings, so `SearchQueryTextProcessor` fell back to its 16/12-word hardcoded defaults there and produced a DIFFERENT Lucene query for the same text (`technician`, `residential` fuzzed broadcast-side only). Both lists copied in; `SearchQueryTextProcessorTests.WordLists_DefinedAndIdentical_AcrossBothHosts` pins all three word lists equal across hosts (SkipWhen a peer repo is absent, §0.15).
- **D3 — BM25 text keeps token adjacency.** `BuildBM25SearchText` used to merge subcategory terms + description words into ONE `HashSet` and re-join ⇒ order scrambled ⇒ the shaper's leading contiguous phrase was garbage and multi-word synonym rules (22.9j) could never fire broadcast-side. Now: the (cleaned, preprocessed) DESCRIPTION leads in its original word order, subcategory terms APPEND after it, deduped case-insensitively; `ExtractSubcategoryTerms` is order-preserving too. Pinned by `ExecuteMatchingAsync_Bm25Text_DescriptionLeadsInOrder_SubcategoryTermsAppend`.
- **D7 — a cancelled leg can never masquerade as "no matches".** All three legs (BM25/vector/semantic) carry `catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested) => throw` BEFORE the swallow-catch — a host shutdown mid-leg now aborts to Service Bus redelivery (the processor's own OCE-rethrow + stale-claim reclaim handle the rest) instead of fanning out an empty match set. The semantic leg still degrades to empty on its OWN `SemanticMaxWaitTimeSeconds` expiry.
- **D8 — the matcher spell-corrects (owner-approved, gated).** `BroadcastMatchingService` takes the SHARED `IQueryUnderstandingService` and runs `ProcessQueryAsync(description, skipAI: true)` (L0–L2 dictionary layers, NEVER an LLM) on the final description before matching. Gate: `BroadcastSettings:Matching:EnableSpellCorrection` (true). Customer-visible text NEVER changes; the hard category filter bounds any correction to re-ranking INSIDE the customer's chosen category. `MatchingMetrics.SpellCorrectionTimeMs` is now a real measurement (it was a permanently-null analytics column); `LlmApiCallCount` is a truthful 0 (skipAI ⇒ no LLM by construction). Spell failure degrades to the raw text — matching never fails on it.
- **Decision #13 (owner: keep design as-is + sanity check).** Classification stays advisory, `categoryId` stays a hard filter, category stays immutable, NOTHING persisted on the entity. NEW: a log-and-alert-only coherence check — matching's own description embedding vs the picked category's cached embedding (in-process cosine, ZERO extra AI calls). Gate: `Matching:EnableCategoryCoherenceCheck` (true); score in (0, `CategoryCoherenceAlertThreshold` 0.15) ⇒ `AdminAlertType.BroadcastCategoryMismatch` (Low; also added to AlertsPage.jsx). ‼️ A 0.0 score means "no embedding found for that category name" and NEVER alerts. Never blocks, never reorders, never drops a match.
- **D9 — vector leg 100 → 500** (`Matching:MaxVectorResults`, both hosts + class default): 500 = the HNSW efSearch ceiling and the search side's effective vector depth. Can only ADD candidates. BM25 deliberately stays at `Size = MaxProviders` (2000) — full recall is what the funnel arithmetic and the every-matched-provider-gets-the-lead guarantee stand on; do NOT "rationalize" it downward.
- **D4 — `SemanticScoreNormalizer` (clinqetcore\Utilities)** is now the ONE reranker÷4 implementation (the byte-identical private copies in `BroadcastMatchingService` + `AzureSearchQuery` delegate to it).
- **D5 — semantic-skip rank bonuses read `Search:Semantic:*`** (TopMatchRankBonus/Top2OverlapRankBonus/Top3OverlapRankBonus + the previously-missing `MaxRankBonus` cap) exactly like search — the hardcoded 0.05/0.03/0.02 copies are gone. Defaults mirror the appsettings values, so behaviour at defaults is byte-identical.
- **D6** — `PreprocessQuery` uses `ToLowerInvariant()` (culture-sensitive `ToLower()` gone).
- **D13 — scoring-profile/semantic-config names centralized**: `SearchScoringProfiles.ServiceRelevance` / `.ServiceRelevanceWithLocation` / `.DefaultSemanticConfiguration` now used by the matcher, `AzureSearchQuery` AND the index definition in cosmosindexsetup. No unshared literals remain.
- **D1/D11 — orphan config deleted**: the phantom `Matching:EnableFuzzySearch`/`FuzzyMinimumLength` keys (no such properties — removed 22.9e) and the reader-less `EnableFilterFallback` (key + property) are gone.
- **D12 — the API's partial `BroadcastSettings:Matching` copy is PINNED**: `EffectiveMatchingConfig_IsIdentical_AcrossApiAndFunctionsHosts` binds BOTH hosts' blocks onto `BroadcastMatchingSettings` and asserts every property equal — present keys and class-default fallbacks alike. A functions-side tune the API copy misses now fails the build instead of silently forking the admin diagnostic.
- **Embedding budget** — the matcher's embedding call runs under `Matching:EmbeddingBudgetSeconds` (5, same contract as the realtime paths): expiry ⇒ BM25-only matching, caller cancel propagates.
- Ctor gained `IQueryUnderstandingService`, `ICategoryEmbeddingService`, `IConfiguration` (all already registered in the functions host — the only host running matching).

## ‼️ Broadcast funnel counters double-counted on radius expansion (fixed 2026-08-01)

`BroadcastMatchingService.FuseAndRankResults` accumulated the business-level funnel counters with `+=`, but **radius expansion calls it a SECOND time over a SUPERSET that re-scores the SAME providers** (the author's own comment: *"The expanded radius is a SUPERSET, so its run re-scores the originals"*). Every broadcast that expanded therefore reported each provider twice: `ProvidersBeforeFiltering`, `CandidatesBeforeFiltering`, `DroppedByCoverageGate`, `ProvidersDroppedByCoverageGate`, `DroppedBySelfMatch`, `DroppedByScoreThreshold`, `DroppedByMaxProvidersCap` all inflated, and the documented invariant broke:

> `ProvidersBeforeFiltering − ProvidersDroppedByCoverageGate − DroppedBySelfMatch − DroppedByScoreThreshold − DroppedByMaxProvidersCap == matched` **(per attempt)**

**Fix:** reset those seven counters at the top of each `FuseAndRankResults` call, so the breakdown describes the attempt whose ranking is actually used. The superset property means the last attempt's view IS the distinct union, so nothing is lost. `RejectedProviders` is deliberately NOT reset — it is the cumulative diagnostic log.

‼️ **This changes live analytics VALUES** for expanded broadcasts (they were inflated; they are now correct). Dashboards comparing pre/post history will see a step change — that is the bug leaving, not data loss.

Caught by `BroadcastProcessorFunctionIntegrationTests.ProcessBroadcast_CityOnlyBroadcast_OnlineBookingsOff_RealMatcher_…` (expected 2, got 4 — the search mock returns 2 hits and fusion ran twice). It is an INTEGRATION-only failure: the unit tests never exercise the expansion path, which is exactly why "unit green" missed it.

---

## ‼️ THE SEARCH TOPOLOGY ROUTER (search-topology Phase 1, 2026-09-21)

**No code outside `Clinqet.Infrastructure.Services.Search.Topology` may name a search endpoint or an index
alias.** Every read and every write resolves a route from `ISearchTopology` (`clinqetcore/Interfaces/Search/ISearchTopology.cs`):

| Call | Answers | Use it for |
|---|---|---|
| `ResolvePublic(countryName)` | a `PublicRoute` of `PublicIndexPair` (services + providers client, country code, `Launching`/`Live`) | marketplace search, SEO, banners, the broadcast matcher, the service/provider indexers |
| `ResolvePrivate(businessId)` | a `PrivateRoute` (`CatalogClient`, `KnowledgeClient`, both NULLABLE) | the phone receptionist, Ask Clinket, the knowledge indexer |
| `EnumeratePlane(SearchPlane)` | every index of that plane | global scans: health checks, the audit function, the suggestion prefix scan, the spell-dictionary refresh |
| `EnumerateForBusiness(businessId)` | every index a business can be in, both planes | teardown / cascade delete |

- `route.Single` THROWS when a route carries more or fewer than one pair — a single-query reader handed a
  fan-out must fail, never silently read the first index. A global scan enumerates instead.
- `PublicRoute` and `PrivateRoute` are **distinct types on purpose**: Phase 0 measured the two planes needing
  OPPOSITE vector algorithms (tenant filter ⇒ exhaustive 2.8× faster; country filter ⇒ HNSW 2.1× faster), so a
  misroute is a 2× regression the compiler now prevents.
- **A nullable private client means the stamp has AI Search unprovisioned** — `deploy.ps1` writes the endpoint
  as an EMPTY STRING there. Readers degrade to their Cosmos leg; the host still boots.
- `AiSearchClientFactory` is the ONLY place a `SearchClient` is constructed and the router is its only caller.
  Both facts are pinned by `SearchTopologyConventionTests` in **each host's own** unit suite (§0.15/§0.17), with
  its own exemption registry and a zero-hit guard so an unresolved root fails loudly instead of reporting green.
- Settings: `Search:Topology:Services:{Public,Private}:{Endpoint,ApiKey}`,
  `Search:Topology:Public:Countries:<ISO2>:{ServiceAlias,ProviderAlias,Status}`,
  `Search:Topology:Private:Cells:<cellId>:{CatalogAlias,KnowledgeAlias}`, `Search:Topology:Private:OpenCells`.
  ‼️ **The base appsettings of every host ships NO countries and a BLANK endpoint**: the .NET binder MERGES a
  dictionary rather than replacing it, so a non-empty base would widen whatever the per-stamp file sets.
- `AddSearchTopology(configuration, requiresPublicPlane)` binds, `ValidateOnStart`s and registers the router,
  its alarm, the alias-not-found policy and a `SearchTopologyPlaneScope`. MCP passes **false** (private plane
  only). Validation refuses to boot on: an empty country list, an unparseable ISO key, a blank alias, one alias
  for both grains, a duplicate alias across countries, no private cell, an `OpenCells` entry naming no cell, a
  `CrossBorderPairs` entry naming an unserved country or itself.
- ‼️ **`Search:Topology:Public:Countries` means "the countries that have their OWN index pair on this stamp"**,
  not "the countries this stamp serves" — the permanent definition that makes the duplicate-alias guard
  unambiguous in every phase (PLAN §5.4.1, E73).
- A configured alias that does NOT exist answers 404 forever and every reader treats empty as legitimately
  empty. `SearchAliasNotFoundPolicy` (PerCall, so it sees the outcome the caller sees) raises one Critical
  `AdminAlertType.SearchTopologyMisconfigured` at first use, **excluding `GetDocumentAsync`'s 404**, which is
  the normal answer for a document not indexed yet.
- The unconfigured-plane alarm fires only for a plane this host READS and that has something to serve — MCP's
  permanently-blank public endpoint is the design, and alerting on it would be a Critical on every healthy boot.
- Clients are cached per **(endpoint, API key, alias)** for the process lifetime, built through a
  `Lazy<SearchClient>` in `ExecutionAndPublication` mode. The key includes the API key because two planes may
  share a host and hold different keys.
- **Tests**: `TestSearchTopology` (one copy per test project; a hand-built `ISearchTopology`, deliberately not
  a Moq double) gives a service the route it needs in one line. The slot a test is NOT exercising gets a
  `NotUnderTest()` client pointing at an unresolvable host, so a misroute FAILS instead of quietly passing.

### ‼️ PHASE 2 — THE PRIVATE PLANE IS ITS OWN INDEX NOW (2026-09-22)

The private catalogue and the private knowledge index are **no longer the public indexes under another name**.
`cosmosindexsetup` creates one pair per cell — `private-catalog-<cell><env>` / `private-knowledge-<cell><env>` —
and `deploy.ps1`'s `Add-SearchTopologySettings` points every host at them from one `$privateSearchCells` list.
‼️ The cell comes BEFORE the environment in the name; suffixing the grain first produced `private-catalog-dev-cell1`,
which no host's alias-shape guard recognises.

**Which cell a business lives on** is `BusinessProfile.searchCell`, written once at profile creation by
`ISearchCellAllocator` (SHA-256 of the business id over the OPEN cells — never `GetHashCode`, which is randomised
per process). `ISearchCellDirectory` is the only thing that reads it: a singleton, `IMemoryCache` (`Size = 1`),
single-flight per business, 15 min for a found cell / 30 s unassigned / 10 s unavailable.
‼️ **A failed lookup is `Unavailable`, NEVER `NotAssigned`** — a Cosmos blip read as "no cell" would fail every
tenant closed for a whole cache window and the repair would be the wrong one. A cell this stamp does not
configure is **refused, never substituted**: answering from another cell reads and writes another tenant's shelf.
Callers that already hold the profile call `Remember(businessId, cell)`, so the write path costs no extra read.

**The two planes hold DIFFERENT populations (D-35).** The private catalogue holds **every service that still
exists** — pending and inactive included, each carrying `approvalStatus` and `isActive` — so "not sellable" is a
FILTER (`isActive eq true and approvalStatus eq 'Approved'`), never a missing row. The public index keeps
membership-by-ABSENCE. `ServiceIndexGates.BelongsInPrivateCatalog(isDeleted)` and `IsIndexable(...)` are the two
rules, and only a DELETED service leaves the private plane.

- **One document class, two materialisations.** `ServiceSearchDocumentProjector.ForPrivateCatalog` /
  `ForPublicServiceRows`. ‼️ Azure rejects the WHOLE batch with 400 when a document carries a field the index does
  not declare, so every field a plane does not declare must be nullable AND `JsonIgnore(WhenWritingNull)` —
  pinned by `SearchPlaneConventionTests`.
- **The receptionist's second lock (D-36)**: every returned row is checked against the scope the filter
  promised, on the lookup leg AND the expert-check candidate leg. One bad row discards the whole set and alarms.
- **`find_services` and `answer_catalog_question` state the same facts as the embedded profile** —
  `VoiceServiceCardFields` declares the model-visible keys and names every deliberate divergence; the parity
  test lives in `Clinqet.Communications.UnitTests`. ‼️ `CatalogLookupItem.Price` is `[JsonIgnore]`d: the
  structured amounts are the SCREEN's shape, and a model given `fixedPrice: 80` beside `chargePerVisit: 40`
  states 120. The ear gets `priceText` + `extraChargesText`, composed by `CatalogPriceNarrator`.
- **Ask Clinket's `search_services` runs ONE leg** (D-6). The paired Cosmos `CONTAINS` leg is gone with
  `CatalogLookupQuery.UnapprovedOnly` — the index now holds the drafts that leg existed for.

**The AI cache (D-21/D-29/D-60)** lives in the EXISTING `provider-knowledge` container under
`{businessId}/ai-cache/…`, so it adds no Azure resource and the business-closure prefix purge already sweeps it.
`ISearchAiCacheStore` holds the enrichment text, the vector and the content hashes; a rebuild that hits it makes
**zero model calls**. Invariants: the artifact is durable BEFORE any index write (I1); a write lock is a blob
LEASE, **per business** for services and **per document** for knowledge (D-60), with a `Lost` token that cancels
a rebuild whose lease expired. ‼️ The lease registry is keyed by **blob name**, and the store looks the lease up
itself — the knowledge lane leases the very blob it then writes, so a caller-supplied key would 412 every ingest.
A 404 is a MISS; a transport failure THROWS. The miss rate alerts on a **tumbling window**, never a lifetime
total, or a long-lived host could never notice a purged container.

**The nightly audit is a ROTATION SWEEP (D-51).** The old index↔index scan is deleted: it never read Cosmos, so
it could not see "Cosmos has a service the index never received", and above 5,000 providers it skipped its own
check while reporting all-clear. Now: `SELECT TOP (batch) FROM Business WHERE Id > @cursor ORDER BY Id`
(a clustered-PK seek), one single-partition Cosmos read + one per-business query per plane + the artifact check,
with `batch = ceil(total / SearchAudit:TargetCoverageDays)` capped by `MaxBusinessesPerRun`. The cursor is ONE
`SearchAuditWatermark` in `SystemData` (id `search_audit_watermark`, pk `system`), advanced only after a batch
fully succeeds. ‼️ **When the ceiling binds an admin alert states the REAL coverage period** — it must never go
quiet, which is exactly how the old one failed. Closed and Suspended businesses are expected to hold ZERO
documents in both planes, so the sweep is also a standing check that closures completed.

**Admin health** (`GET /admin/search/health`) now enumerates BOTH planes and each row carries its `plane`: a
stamp whose private cells are unreachable answers no phone calls at all while the marketplace looks fine.

### D7 — the BM25 leg’s paging (2026-09-21)

`ExecuteBM25SearchAsync` asked for `Size = MaxProviders` (2,000). Azure caps a response at
`AzureSearchLimits.MaxDocumentsPerResponse` (1,000) and the SDK silently followed its own `$skip` continuation,
so it was already two round trips — undeclared, unlogged and **undeduped**. The 2,000 is deliberate (every
potentially-matching provider must reach the funnel), so the count is unchanged and only the paging is now
explicit, with a `seenDocuments` `HashSet` keyed on the document id: Azure orders equal scores arbitrarily per
request, so a tie at a page boundary could hand the funnel the same provider twice.

### ‼️ 2026-09-22 — THERE IS NO SECOND CATALOGUE STORE, AND THE PRIVATE PLANE IS EXHAUSTIVE EVERYWHERE

**The Cosmos fall-through on every catalogue search path is DELETED** (owner, amending D-33). It matched raw
substrings on `name` and `description` alone: measured live, *"skid steers"* found **0 offerings where the index
found 43** — and it then handed the model a `None` result whose note says *"Tell the caller warmly that you
cannot find that one."* A broken search became the business denying its own stock, and nobody could see it,
because a partial answer reads exactly like a complete one.

- **What a caller hears now**: *"I can't check right now — let me take a message."* `VoiceCatalogSource.Cosmos`
  is renamed **`Unavailable`**; `LookupAsync` ends `result ??= Unavailable()`; `RetrieveCandidatesAsync`
  returns `[]`, which `ProviderCatalogAnswerService` already maps to the same thing.
- **‼️ AND AN ADMIN ALERT IS MANDATORY** (owner: *"that is a must"*). `ICatalogAlarm.RaiseCatalogueUnreachable`
  is implemented in all three hosts. It is **silent when `IndexAvailable` is false** — an unprovisioned stamp
  is configuration, not an outage, and alerting there would Critical on every healthy boot.
- **Deleted with it**: `IServiceRepository.SearchPublicCatalogAsync`, `CatalogRepositoryQuery`,
  `CatalogRepositoryPage`, `BuildCatalogPredicate`, `BuildPriceClause`, and the `Voice:Catalog:CosmosFallbackMaxScan`
  setting from all three hosts. `LoadNearestGroupsAsync` is an index **facet** now — the last Cosmos read on a
  search path, at 30–41 RU a call.
- **The only repository call left** on that path is `GetGlobalCategoriesAsync`, which is CACHED and is a
  SECURITY control: the model's group name is resolved to an id we own, so model text never reaches a filter.

**‼️ BOTH private indexes are `exhaustiveKnn`, uncompressed — the knowledge one was not, for a whole phase.**
`KnowledgeSearchIndexInitializer` takes no plane parameter (every knowledge index is a private-cell index), so
it silently built the PUBLIC plane's HNSW + `bq-mrl`. Exhaustive KNN **cannot rescore**, and rescoring against
the full-precision originals is the whole mechanism that makes binary quantisation safe — without it recall@10
fell to 68 % here. The private plane's vector configuration now lives in ONE place,
**`cosmosindexsetup\PrivateVectorSearch.cs`**, which both initializers read.

**‼️ A cell alias is a PRIVATE alias.** All three hosts had shipped
`Cells.cell1.CatalogAlias = "clinket-dev"` — the customer-facing index. `PrivateCellAliasConventionTests`
(one copy per host) now fails on that. `deploy.ps1` was always right: `private-catalog-$cell$EnvSuffix`.

**D-2 GATE 2 IS CLOSED — PASS** (`Data\search-topology\findings\PHASE-2-QUALITY-PARITY.md`). 1,335 cards from
87 real documents, two indexes differing only in the vector configuration: recall IDENTICAL, MRR within 0.5 %,
sign test **p = 1.000**, and the private arm uses ZERO vector-index quota. The gate was proven able to FAIL.

**Two traps this phase paid for, which will be laid again:**

1. **A counter on a SCOPED service cannot say "on this host".** `_consecutiveCatalogueUnreachable` was an
   instance field, so a stamp-wide outage reported *"1 in a row"* five hundred times. Static now.
2. **A name in a guard's registry is not evidence.** `IndexCoverageMinRatio` named a reader that IS compiled
   into the API host — but its only caller is registered ONLY in Functions, so the API tuned a value nothing
   read, for months, with a written reason for the divergence.

## ‼️ SEARCH-TOPOLOGY PHASE 3 — A QUOTE IS MATCHED IN ITS OWN COUNTRY (2026-09-22/24)

Full picture in `clinqet-search-discovery` → "PHASE 3". What changed for quotes:

- **B-17 — the router is TYPED.** The matcher calls `ResolvePublic(CountryCodeHelper.ParseStrictOrNull(...))`;
  the old full-name router sent every ISO-coded quote to the stamp's first pair, so every US quote matched ZERO.
- **B-18 — a quote is never stored without its own country** (`BroadcastService.ResolveQuoteCountryAsync`):
  - a SENT country is parsed strictly and stored as its ISO code; a real ISO code we do not list (a place picked
    in Chile) is refused `Error_BroadcastCountryNotServed`, anything else unreadable `Error_BroadcastCountryInvalid`;
  - a BLANK country is read from the quote's own coordinates (reverse geocode, in the customer's language so the
    search's cached cell answers it) or, with no usable coordinates, from its typed city (forward geocode, the
    visitor's listed country as a BIAS — `IBroadcastService.CreateAsync(..., CountryCode? visitorCountry, ...)`,
    passed by the controller from `X-Client-Country`); a place that cannot be named is refused
    `Error_BroadcastCountryUnresolved`, one outside our countries `Error_BroadcastCountryNotServed`;
  - "no usable coordinates" is the shared `CoordinateSentinel` rule (a near-(0,0) pair is no position).
  - The budget is priced in THAT country's currency (`ResolveCurrencyForCountry` ignores the client's currency
    whenever the country is known).
- **Clients (both customer apps) send only the quote's OWN place**: a picked suggestion's coordinates + ISO
  country; the device position only while the city field still holds the device's own city; a typed city is
  resolved through `GET /api/search/place` before it is used (awaited at submit); when the place's country is
  unknown the country is sent as NULL — never the visitor's header country (the server stores a sent country as
  the truth, so a guess filed "Buffalo" typed in Toronto as Canadian). The budget currency shown follows the
  destination's country. A 400 shows the server's own translated sentence.
- **B-19 — correlated filter**: the broadcast filter puts the country INSIDE each place clause (address and
  every service area), so a Detroit business listing a Toronto area no longer matches a Windsor quote.
- **D6 — live eligibility re-check BEFORE any lead row exists** (`RecheckEligibilityAsync`, in the matcher after
  quality ordering): every provider about to receive the lead is re-read from Cosmos (exists, `Active`,
  `ParticipatesInMarketplace`, `IsListed`) and its live plan (`leads` feature). A failed read keeps the provider
  (fail OPEN — the index was already membership-filtered and a lost lead is a harm too), counted as
  `EligibilityUnverified` and alerted on `BroadcastSettings:Matching:EligibilityRecheckAlertCooldownMinutes` (15). Drops are
  `DroppedByEligibilityRecheck` in the funnel and the broadcast Parquet row (append-only v2).
- The matcher's city-only geocode fallback sends a listed ISO country as its English name (the geocoder expands
  it centrally), so "hamilton, CA" is no longer California.

## ‼️ PHASE 3 AUDIT FIXES — quotes and leads (2026-09-24)

- **D6 eligibility re-check is batched and SQL-aware** (Q-7, Q-12): one Cosmos read-many (`CosmosDbRepository.ReadManyAsync`),
  one SQL status query (`IBusinessStatusDirectory`), one `IEntitlementService.ResolveManyAsync`; SQL Closed/Suspended ⇒
  ineligible. It fails OPEN with its own alert type `AdminAlertType.BroadcastEligibilityUnverified` and ONE warning per
  quote (Q-16).
- **The route is resolved once, before the matching legs**; a routing failure propagates — never "no matches" (Q-8).
- **A place-lookup outage is a retryable 400** (`Error_PlaceLookupUnavailable`), distinct from "not a place" (Q-9,
  `GeocodingResult.Unanswered`). A retry finds the stored quote BEFORE re-resolving (Q-11).
- **A country is real only if `RegionInfo` knows it** (Q-17). **A budget amount in another currency than the
  place's is refused** (`Error_BroadcastBudgetCurrencyMismatch`), never relabelled; a flexible budget has nothing to
  relabel (Q-18). `UpdateAsync` validates the budget like `CreateAsync` (Q-22).
- A sent country is checked against the quote's own coordinates (coordinates win) and a listed country with no index
  on the stamp is NotServed (G-4 / Q-3 / Q-10).

## Ended requests speak to each audience (2026-09-26)
- Expired: the customer gets `BroadcastExpired` ("your quote request"); providers get `BroadcastExpiredProvider` + in-app `Notification_BroadcastExpired_Provider_*` ("the lead"). Cancelled: providers get `BroadcastCancelled` ("cancelled by the customer"); the customer gets `BroadcastCancelledCustomer`. Subject key = `{Template}_Subject`.
- Provider email data is built whenever a template is sent — members receive it at their own address, so a business profile without an email address must never yield an email with empty data. Guard: `BroadcastStatusUpdateFunctionTests.Run_EndedRequest_EachAudienceGetsItsOwnWording`.

## ‼️ D-103 / P4-124 — ONE lead-distance curve (2026-09-27)

`BroadcastMatchingService.LocationMultiplier(distanceKm, isAtCustomersLocation, matching)` is the ONLY distance factor.
`d` = the distance to the nearest place the business serves: the nearest service-area centre when any area has one,
else its location (`NearestServedDistanceKm`). One formula for every business — the old second formula for a nearer
area centre, the step UP at the primary radius (×1.00 at 50 km, ×1.15 just past it) and the one-step at-customer halving
are gone.

| d | multiplier |
|---|---|
| 0 → `LocationBoostPrimaryRadiusKm` (50) | straight line `LocationBoostPrimaryMultiplier` (1.4) → `LocationBoostSecondaryMultiplier` (1.15) |
| primary → `LocationBoostSecondaryRadiusKm` (100) | straight line 1.15 → 1.0 |
| beyond secondary | `1.0 − (d − secondary) × LocationDecayRate` (0.001/km), floored at `LocationMinMultiplier` (0.3) |

- ‼️ **A service done only at the business's premises** (`ServicePlace.IsAtBusinessOnly(isAtStore, isAtCustomersLocation)`,
  D-102 (8)) measures `d` to the ADDRESS (`location`), never to an area centre — "comes to your address" does not apply
  to it. The matcher now selects `isAtStore`. Test: `ALeadsDistance_ForAnAtPremisesOnlyService_IsToTheAddress`.
- Anchors are clamped to a running minimum, so no configuration can make the curve RISE with distance.
- At-customer services: `AtCustomerLocationDistancePenalty` (0.5) phases in LINEARLY over
  `AtCustomerLocationPenaltyBandKm` (50, NEW) past the secondary radius, instead of halving in one step.
- The normaliser's ceiling is `MaxLocationMultiplier(matching)` = the curve's peak, DERIVED — the retired
  `MaxLocationBoostMultiplier` (1.6 over a real 1.4) deflated every lead against the floor.
- DELETED from `BroadcastSettings:Matching` (appsettings + class): `MaxLocationBoostMultiplier`,
  `ServiceAreaBoostMultiplier`, `ServiceAreaProximityBonus`. `Search:*` keys of similar names are a different feature.
- Response and reliability enter the lead score through `ProviderBoostComposer.ComposeForBroadcast(…, scoring)`; the
  matcher passes the bound `ProviderScoringSettings`, so a business with no measured score counts at the same prior the
  nightly job stores (P4-106) — never 0, so a new business is never ranked below one measured at the prior.
- Tests (Functions suite): `Services/BroadcastLocationCurveTests` — a 0–300 km sweep at 0.5 km never rises, continuity
  (1e-9) at every breakpoint, one area vs many areas, the at-customer band has no step, the ceiling equals the peak.

## ‼️ A REDELIVERED BROADCAST IS IDEMPOTENT (2026-09-27)

A holder that wrote the lead rows and died before activating is reclaimed by the stale-claim re-check, which re-runs
matching over rows that already exist. The base repository reports each 409 as `DuplicateItemException` — the matcher
caught a raw `CosmosException` Conflict that never arrived, so every row counted toward the ≥50% failure gate and the quote
was failed for writes that had succeeded. Now: a duplicate lead row is reconciled (`ReconcileProviderConflictAsync`), and a
duplicate dispatch projection is REWRITTEN to this attempt's rows (`RefreshRedeliveredDispatchAsync`, via
`UpdateItemWithRetryAsync`, keeping `TerminalCustomerNotifiedStatus`) — it used to fall into reconstruct-and-retry, fail
again, delete the rows and fail the quote. Tests: `BroadcastMatchingServiceTests.CreateProviderDocuments_RowsARedelivery…`
and `…_ADispatchARedelivery…` (unit), `BroadcastProcessorFunctionIntegrationTests.ProcessBroadcast_RedeliveredAfterItsRowsLanded…`
(real Cosmos: two deliveries, one row, one notification, no failure alert).
