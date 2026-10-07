---
description: |
  **BACKEND SKILL** — Work on the Clinqet Azure Function App (.NET 10 Isolated Worker). USE FOR: creating/modifying Service Bus-triggered functions, Cosmos change feed functions, timer functions, HTTP webhook functions, message processing, email/PDF generation, analytics, broadcast processing, notification dispatch. Applies to ALL files in clinqetfunctions/.
---

# CLINQET FUNCTION APP — COMPREHENSIVE SKILL
## ABSOLUTE RULES (READ FIRST — APPLIES TO EVERY CHANGE)

- **Comments — terse, only when they earn their place.** Default to no comments; let naming carry the meaning. **However**, write a comment when it captures non-obvious context the code itself cannot show: a hidden invariant, a subtle ordering constraint, a deliberate workaround for a known bug, a defensive choice with a real reason, or an RFC/spec citation that explains *why*. Prefer a single short line. Forbidden: restating WHAT the code does (e.g. `// increment counter` above `counter++`); multi-line narrative blocks explaining design rationale; XML doc summaries on properties whose names already convey intent; commented-out code; `// TODO` without an issue link. When in doubt, delete the comment — but don't strip a *real* WHY-comment just to chase zero.
- **No verbose docstrings on self-evident members.** A property named ``EnableAISpellCorrection`` does NOT need a doc summary. A field named ``_searchEnableAISpellCorrection`` does NOT need a multi-line ``//`` block above it. Trust naming.
- **No commented-out code, no leftover symbols, no ``// TODO`` without an issue link.**

---


## OVERVIEW

The Function App processes all asynchronous workloads for the Clinqet platform via Azure Service Bus queues and Cosmos change feeds. Built on .NET 10 Isolated Worker model.

- **Solution**: `C:\Nik\clinqetfunctions\Clinqet.Function.sln`
- **Project**: `C:\Nik\clinqetfunctions\Clinqet.Communications\`
- **Runtime**: .NET 10 Isolated Worker (NOT in-process)
- **Trigger Types**: Service Bus (24 queues), Cosmos Change Feed, Timer, HTTP

---

## PROJECT STRUCTURE

```
Clinqet.Communications/
├── Program.cs              — DI registration (40+ services: Cosmos repos, HTTP clients, AI services)
├── host.json               — extension config; only the keys the extensions actually read (see HOST.JSON)
├── local.settings.json     — Runtime settings (Service Bus connection strings — gitignored)
├── appsettings.json        — Non-trigger settings
├── Functions/              — 35 function files / 37 [Function] attributes (verified 2026-05-16)
│   ├── Email processors (8) — Booking/Quote/Invoice/Broadcast email + PDF
│   ├── Broadcast handlers (7) — Dispatch, matching, bid processing
│   ├── Notification handlers (6) — Push, in-app, SMS
│   ├── Timer functions (3) — Timeouts, reminders, cleanup
│   ├── HTTP webhooks (2) — Twilio callbacks
│   ├── SearchIndexSyncFunction.cs — Cosmos change feed → AI enrichment → Search index
│   ├── AnalyticsFunction.cs — Search analytics → Parquet files
│   └── IdentitySyncFunction.cs — Customer identity sync
```

---

## DI REGISTRATION PATTERN (Program.cs)

The function app uses `FunctionsApplication` builder with 40+ DI registrations:

```csharp
var host = new HostBuilder()
    .ConfigureFunctionsWebApplication()
    .ConfigureServices((context, services) =>
    {
        // CosmosClient — Singleton (SDK retry: 9 max, 30s wait, camelCase, StringEnumConverter)
        // 35+ Scoped repositories (same interfaces as Main API)
        // HttpClient factory with named clients
        // All infrastructure services
    })
    .Build();
```

### Shared Infrastructure
The Function App uses the SAME `Clinqet.Infrastructure` and `Clinqet.Core` projects as the Main API. All repositories, services, entities, and DTOs are shared.

---

## SERVICE BUS FUNCTION PATTERN (MANDATORY)

Every Service Bus function MUST follow this exact pattern:

```csharp
public class BookingEmailProcessor
{
    private readonly ILogger<BookingEmailProcessor> _logger;
    private readonly IBookingRepository _bookingRepository;
    // ... other dependencies

    public BookingEmailProcessor(
        ILogger<BookingEmailProcessor> logger,
        IBookingRepository bookingRepository)
    {
        _logger = logger;
        _bookingRepository = bookingRepository;
    }

    [Function(nameof(BookingEmailProcessor))]
    public async Task Run(
        [ServiceBusTrigger("booking-emails", Connection = "ServiceBusConnection")]
        ServiceBusReceivedMessage message,
        ServiceBusMessageActions messageActions,
        CancellationToken cancellationToken)
    {
        // 1. Deserialize — fail fast to DLQ if invalid
        BookingEmailMessage? emailMessage;
        try
        {
            emailMessage = message.Body.ToObjectFromJson<BookingEmailMessage>(
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true,
                    Converters = { new JsonStringEnumConverter() } });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to deserialize message {MessageId}", message.MessageId);
            await messageActions.DeadLetterMessageAsync(message,
                deadLetterReason: "DeserializationFailure",
                deadLetterErrorDescription: ex.Message);
            return;
        }

        // 2. Validate required data — DLQ if missing
        if (emailMessage == null || string.IsNullOrEmpty(emailMessage.BookingId))
        {
            await messageActions.DeadLetterMessageAsync(message,
                deadLetterReason: "InvalidMessage");
            return;
        }

        // 3. Process — idempotent operations only
        try
        {
            // ... business logic (fetch data, generate PDF, send email)
            await messageActions.CompleteMessageAsync(message);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Processing failed for {MessageId}", message.MessageId);
            throw; // Let Service Bus retry (up to max delivery count)
        }
    }
}
```

### CRITICAL RULES

1. **Idempotency**: Every handler MUST be safe to re-execute. No duplicate emails, no duplicate bookings. Check if already processed.
2. **Manual completion**: Use `messageActions.CompleteMessageAsync(message)` on success
3. **Dead letter**: Use `messageActions.DeadLetterMessageAsync()` for unrecoverable errors
4. **Transient errors**: Throw the exception — Service Bus redelivers up to the queue's ARM `maxDeliveryCount` (5); host.json does not set it
5. **Deserialization failures**: Always DLQ immediately — never retry
6. **Enum deserialization**: Always include `JsonStringEnumConverter` in serializer options
7. **Structured logging**: Use parameterized messages with `{MessageId}`, `{BookingId}`, etc.
8. **CancellationToken**: Accept and pass through to all async operations

---

## KEEP-YOUR-OWN-NUMBER VERIFICATION (2026-09-15)

`VoiceOwnNumberCheckCoordinator` (`Services/`) owns the whole verification state machine over ONE
`voicecheck_{businessId}` Cosmos doc: `Pending → Placed → Arrived | Failed | TimedOut`, every transition an ETag
CAS, so a redelivered `StartOwnNumberCheck` cannot double-dial and a duplicate webhook cannot flip a terminal verdict.

- Two `VoicePostCallKind` members on the existing post-call queue: `StartOwnNumberCheck` (messageId
  `vpc-owncheck-{businessId}-{checkId}`) and `OwnNumberCheckTimeout` (`vpc-owncheck-timeout-…`, the lost-webhook
  safety net scheduled at ring timeout + AMD wait + 10 s).
- ‼️ **This host holds NO verification number.** The API stamps the business's COUNTRY caller on the document
  (`Voice:OwnNumber:Countries:<ISO>:VerificationCallerNumber`) and the coordinator dials `check.VerificationCaller`.
  An empty one fails the check closed and raises an admin alert; the Functions `appsettings.json` carries only the
  dial/verdict timers and the alert thresholds, pinned by `VoiceOwnNumberSettingsConventionTests`.
- Both ingress functions short-circuit the forwarded call: `VoiceCallControlFunction` rejects it
  (`RejectAsync`, cause CALL_REJECTED) and `PlivoVoiceCallControlFunction` answers with an empty applet — **no
  session, no answer, no AI, no answered-leg billing**. The predicate needs BOTH the live doc and the caller match.
- Three Plivo routes carry the outbound leg's own webhooks: `voice/plivo/verify-answer` (holds the leg for the AMD
  verdict), `verify-amd`, `verify-hangup` — all behind the same carrier gate + signature validation as the rest.
- Admin alerts fire on PATTERNS only (a per-business failure streak, a per-carrier failure window), never on one
  failed check; the live update to the provider is transient SignalR.

---

## INDIA RELAY SUPERVISION — `PlivoRelaySupervisor` (2026-09-26, owner-approved; full detail in `clinqet-voice-assistant`)

‼️ The MCP host carrying a live India AI call can restart, crash or hang without a word, so THIS host supervises the
caller. `Services/PlivoRelaySupervisor` (scoped) owns every path that finds a caller no relay serves, and they all end
in one hand-off: hang up the AI leg ⇒ voicemail (`EnterVoicemailAsync`, also used by the ai-agent join check).

- **Two new `VoicePostCallKind` members on the existing voice post-call queue** (no new queue, so no ARM change):
  `PlivoRelayCheck` (the periodic chain `vpc-ail-{callId}-{leg}-t{n}` started by the hand-off, a second look `{id}-c`,
  carrier-signal checks, the relay's own end check and its drain dead man's switch) and `PlivoCallEndBackstop` (the
  relay's deferred call-end backstop). `AiSessionLost` also routes to the supervisor now.
- **New HTTP route `voice/plivo/ai-stream-status`** (`PlivoVoiceAiStreamStatus`, same carrier gate + V3 validation):
  Plivo's AI-stream status callback; any report only schedules a check. `ParticipantExit` for anyone but the caller on
  `voice/plivo/status` does the same.
- **Confirm, then act:** a carrier signal or a lapsed lease never moves a caller on its own; the supervisor reads the
  real state (phase, the relay's lease `_ts + ttl`, the member list via the tri-state `ReadMpcParticipantsAsync`) and a
  lapsed lease needs two looks. Every id is deterministic, every reschedule bounded, and a rescue that loses every CAS
  while the call is live throws so Service Bus redelivers it — a periodic check arms its next tick before throwing,
  because this processor dead-letters on the final delivery and a dead-lettered tick would end the supervision.
- **Fencing:** on Plivo, `HangupCall` is ignored unless the phase is `AiHandoff`/`Active` — a relay that wakes from a
  stall must not hang up a caller already in voicemail.
- **This host now reads `IVoiceBusinessLiveCallRepository`** (point reads, SystemData) — registered in `Program.cs` and
  in the integration `FunctionAppFactory`.
- Settings: `Plivo:AiLivenessCheckSeconds` 20, `AiLostConfirmSeconds` 5, `AiActivationTimeoutSeconds` 30, validated at
  start (`AiActivationTimeoutSeconds` must outlast the ai-agent join checks, computed with the chain's own clamps).
  The binding + rules live in `Configuration/PlivoSettingsRegistration.AddFunctionsPlivoSettings` (unit-tested);
  `FunctionHostCompositionIntegrationTests` resolves them on the REAL Program.cs under every stamp — ValidateOnBuild
  checks the graph, never option VALUES, so a probe must resolve the options to run their rules.

---

## HOST.JSON CONFIGURATION

```json
"extensions": {
  "cosmosDB": { "connectionMode": "Direct" },
  "serviceBus": {
    "prefetchCount": 100,
    "autoCompleteMessages": true,
    "maxConcurrentCalls": 16,
    "maxMessageBatchSize": 100,
    "maxAutoLockRenewalDuration": "01:00:00",
    "maxConcurrentSessions": 8,
    "sessionIdleTimeout": "00:00:05"
  }
}
```

‼️ **P4-42 / P4-43 — a key the extension does not read is silently ignored, and a stale one reads like live config.**
- **Cosmos DB extension 4.x** binds ONLY `connectionMode`, `userAgentSuffix` and `serializerSettings` from host.json.
  Poll delay, lease intervals and batch size come from the `[CosmosDBTrigger]` ATTRIBUTE alone (an int, so one value for
  every environment); the attribute sets none of the intervals, so the SDK defaults apply (5 s poll, 13 s acquire,
  17 s renew, 60 s expiry). The old `feedPollDelay` / `maxItemsPerInvocation` / `maxConcurrency` / lease keys here were
  inert, and so are the `AzureFunctionsJobHost__extensions__cosmosDB__*` app settings `deploy.ps1` still writes.
- **Service Bus extension 5.17** honours the list pinned in `Conventions/HostJsonExtensionKeysConventionTests`
  (modern names; legacy `messageHandlerOptions` / `sessionHandlerOptions` names are mapped). `autoCompleteMessages`
  stays `true` while any trigger takes no `ServiceBusMessageActions` (LoginAttempt, MarketingSubscription,
  UserActivity processors) — the host skips auto-complete for a message a function already settled.
  `sessionIdleTimeout` is short (5 s) because a session receiver otherwise waits the full try-timeout (60 s) on an
  empty session, which starves the other businesses on the session-enabled provider-projection queue.
- The convention test fails the build on an unknown key, on auto-complete being turned off while a trigger depends on
  it, and on a missing or long `sessionIdleTimeout`.

---

## COSMOS CHANGE FEED PATTERN (SearchIndexSyncFunction)

```csharp
[Function("ProviderDataUnifiedProcessor")]
public async Task Run(
    [CosmosDBTrigger(
        databaseName: "%CosmosDb:DatabaseName%",
        containerName: "%CosmosDb:ContainerNames:ProviderData%",
        Connection = "CosmosDbConnection",
        LeaseContainerName = "%CosmosDb:ChangeFeed:LeaseContainerName%",
        LeaseContainerPrefix = "%CosmosDb:ChangeFeed:ProviderDataUnifiedLeasePrefix%",
        CreateLeaseContainerIfNotExists = true,
        StartFromBeginning = true,
        MaxItemsPerInvocation = 100)]
    string input)
```

### Processing Pattern:
1. Parse each event; `Service` events index or delete the service, the `ReindexDocumentTypes` (BusinessProfile,
   ServiceArea, Offer, Availability, BusinessRating, Portfolio) rebuild the whole business.
2. AI validation for `PendingAIValidation`, enrichment (`CommonSearchPhrases`, `UserIntentPhrases`) and embeddings run
   inside the indexer, paced by the AI budget governor.
3. Offer changes schedule a business rebuild at each offer's start and end (the moments nothing else marks).
4. Provider-document markers go to the session-enabled `provider-projection` queue (see below).
5. ‼️ **Failures are REPLAYED, never held — P4-107.** Extension 4.x checkpoints a batch whether the invocation
   succeeds or throws (a throw is logged by the health monitor and the feed moves on; only listener cancellation
   stops it). So every failed service, business, provider document or offer boundary is queued to
   `change-feed-failures` as its OWN `ChangeFeedFailureMessage`; a batch that throws queues a `BusinessReindex` (and an
   `OfferBoundaries` replay) for EVERY business it touched before it rethrows; a replay that cannot be queued is named
   in a Cosmos admin alert (`ChangeFeedDocumentProcessingFailure`). One business failing never costs another its write.
   `SearchIndexDeleteFailureException` and `CosmosDb:ChangeFeed:EnablePerDocumentFailureTracking` are DELETED — the first
   only "held" a checkpoint that was never held, the second could switch the replays off.

---

## FUNCTION INVENTORY (39 files / 41 [Function] attributes — 35/37 verified 2026-05-16; +4 WhatsApp added s17)

> **WhatsApp (s17 inventory sync, not yet inlined in the tables below):** +4 function files — `WhatsAppWebhookFunction.cs` (HTTP `whatsapp/webhook`, GET verify + POST) + `WhatsAppInboundProcessorFunction.cs` / `WhatsAppOutboundProcessorFunction.cs` / `WhatsAppStatusProcessorFunction.cs` (ServiceBus → `WhatsAppInboundQueueName` / `WhatsAppOutboundQueueName` / `WhatsAppStatusQueueName`).

| Function file | Trigger | Source |
|---|---|---|
| `AdminAlertProcessor.cs` | ServiceBus | `AdminAlertsQueueName` |
| `AnalyticsCompactionFunction.cs` | Timer | `%AnalyticsCompactionSettings:CronExpression%` |
| `AnalyticsProcessorFunction.cs` | ServiceBus (batched) | `AnalyticsQueueName` + `BroadcastAnalyticsQueueName` (2 [Function] attrs in one file) |
| `BookingAutoCompletionProcessor.cs` | ServiceBus | `BookingAutoCompletionQueueName` |
| `BookingCancellationProcessor.cs` | ServiceBus | `BookingCancellationsQueueName` |
| `BookingEmailProcessor.cs` | ServiceBus | `BookingEmailsQueueName` |
| `BookingReminderProcessor.cs` | ServiceBus | `BookingRemindersQueueName` |
| `BookingTimeoutProcessor.cs` | ServiceBus | `BookingTimeoutCheckQueueName` |
| `BroadcastExpiryFunction.cs` | ServiceBus | `BroadcastExpiryQueueName` |
| `BroadcastProcessorFunction.cs` | ServiceBus | `BroadcastProcessingQueueName` |
| `BroadcastStatusUpdateFunction.cs` | ServiceBus | `BroadcastStatusUpdatesQueueName` |
| `BroadcastTieredExpansionFunction.cs` | ServiceBus | `BroadcastTieredExpansionQueueName` |
| `BroadcastUpdateNotificationFunction.cs` | ServiceBus | `BroadcastUpdateNotificationsQueueName` |
| `CartReminderProcessorFunction.cs` | ServiceBus | `CartRemindersQueueName` |
| `CustomerIdentitySyncProcessor.cs` | ServiceBus (sessions enabled) | `CustomerIdentitySyncQueueName` |
| `DeviceRegistrationRetryFunction.cs` | Timer | every 15 min — three independent jobs: removes admin-app devices of non-admins; **removes signed-out devices from the Notification Hub** (`GetRetiredOnHubAsync`: inactive rows the hub still holds, retired more than `DeviceRegistrationRetry:RetiredDeviceGraceMinutes` (5) ago so a security change can re-point its own device first; row kept, `IsRegisteredWithHub` cleared; pages `BatchSize` up to `MaxRetiredBatchesPerRun` (10), each device tried once a run; alert only when none of a run succeeds, cooled down by `RetiredDeviceAlertCooldownMinutes` (60)); retries pending registrations. See `clinqet-auth-sessions` §7. |
| `DeviceTokenCleanupFunction.cs` | Timer | `%DeviceTokenCleanup:TimerSchedule%` (daily 03:30 UTC) — prunes device tokens not refreshed in `StaleAfterDays` (90): per device, best-effort NH `UnregisterDeviceAsync` (resolves hub by the row's `AppType`; `DeleteInstallation` frees the namespace 200k active-device slot) then SQL `DeleteAsync` **only when the hub removal succeeded** (`UnregisterDeviceAsync`→`DeviceUnregistrationOutcome` {Removed,NoHub,Failed}; on `Failed`/transient hub error the SQL row is kept for next-run retry, so a transient failure never orphans an installation that keeps counting toward 200k; one aggregated `SystemError` admin alert per run if any device failed hub-unregister), oldest-first, `MaxParallelism`-bounded. **Bounded drain loop**: keeps fetching `BatchSize` batches (deletion advances the cursor) until a short/empty batch or `MaxBatchesPerRun` cap, with a `HashSet` forward-progress guard so a permanently-failing row can't spin. Self-heals: a pruned device re-registers on next app open. A third independent job retires (`IsActive = 0`) devices whose session ended without a revoke — expired, purged, refused by its stamp, account deactivated or suspended — and devices with no session whose account is signed in nowhere (`RetireDevicesOfEndedSessionsAsync`: a keyset walk over every active device once per run, `EndedSessionPageSize` (1000) per page, cursor in SQL's own uniqueidentifier order; judged by a SELECT, written by an UPDATE that re-checks the judged binding, keeping the UserProfile → AuthSession → DeviceTokens lock order; own alert `DeviceTokenCleanup.EndedSessionDevices`); the 15-min retry sweep then removes them from the hub. Tests: `DeviceSessionSweepIntegrationTests` (Functions suite, §0.18). |
| `EmailNotificationProcessorFunction.cs` | ServiceBus | `EmailNotificationsQueueName` |
| `HealthCheckFunction.cs` | HTTP | `health` + `ping` (2 [Function] attrs) |
| `IdentityProfileSyncProcessor.cs` | ServiceBus | `IdentityProfileSyncQueueName` |
| `InvoiceEmailProcessor.cs` | ServiceBus | `InvoiceEmailsQueueName` |
| `InvoicePastBookingProcessor.cs` | ServiceBus | `InvoicePastBookingCheckQueueName` |
| `BillingReceiptEmailProcessor.cs` | ServiceBus | `ReceiptEmailsQueueName` (`billing-receipt-emails`) — branded HTML receipt + PDF on EVERY successful payment. Flow A (provider, load `BillingTransaction` from SQL + seller/tax/card → `GenerateBillingReceiptPdfAsync` → template `BillingReceipt`) / Flow B (customer "PAID" booking, `GenerateBookingPdfAsync` already stamps PAID at `Captured`/`Transferred` → template `BookingPaidReceipt`). Deterministic MessageId `receipt_{txId}`/`bookingreceipt_{bookingId}` ⇒ queue duplicate-detection dedups (no marker store, mirrors `InvoiceEmailProcessor`). Enqueued DRY at one site each: Flow A in `BillingChargeService.ChargeVaultedAsync` (receipt-eligible Succeeded ∈ {SubscriptionCharge, AddOnCharge, AddOnUpgrade, TopUpPurchase}, incl. $0/promo; best-effort + non-throwing), Flow B in `BookingPaymentService.FinalizeCapturedAsync`. `communicationType = BillingPayments`. |
| `LoginAttemptProcessorFunction.cs` | ServiceBus | `LoginAttemptsQueueName` |
| `MarketingSubscriptionProcessorFunction.cs` | ServiceBus | `MarketingSubscriptionQueueName` |
| `MediaDerivativeProcessorFunction.cs` | ServiceBus | `MediaDerivativesQueueName` |
| `NotificationProcessor.cs` | ServiceBus | `NotificationsQueueName` |
| `ProviderConfirmationProcessor.cs` | ServiceBus | `ProviderConfirmationRequestsQueueName` |
| `QuoteEmailProcessor.cs` | ServiceBus | `QuoteEmailsQueueName` |
| `RecommendationEngineFunction.cs` | Timer | `%RecommendationSettings:TimerSchedule%` |
| `SearchIndexSyncFunction.cs` | Cosmos change feed | `ProviderData` container |
| `SearchInteractionProcessorFunction.cs` | ServiceBus (batched) | `SearchInteractionsQueueName` |
| `SearchJudgeFunction.cs` | Timer | `%Search:Judge:TimerSchedule%` |
| `SmsNotificationProcessorFunction.cs` | ServiceBus | `SmsNotificationsQueueName` |
| `SmsWebhookFunction.cs` | HTTP | `sms/webhook` |
| `UserActivityProcessorFunction.cs` | ServiceBus | `UserActivitiesQueueName` |
| `TrialReminderFunction.cs` | Timer | `%TrialReminders:TimerSchedule%` — a host setting per stamp: CA/US `0 0 14 * * *`, IN `0 0 4 * * *` (a morning hour, not the 04:00 UTC billing hour). Calls `ISubscriptionBillingService.ProcessTrialRemindersAsync`; off with `SubscriptionBilling:Enabled`; a failure raises the `TrialReminders.Failure` alert. See clinqet-payments "Trial reminders and trial messages". |
| `VectorEmbeddingRecoveryFunction.cs` | Timer | `%Search:VectorRecovery:Schedule%` |

Totals: **31 ServiceBusTrigger**, **6 TimerTrigger**, **1 CosmosDBTrigger**, **4 HttpTrigger** (incl. the 4 WhatsApp functions: Inbound/Outbound/Status SB + Webhook HTTP).

## 31 SERVICE BUS QUEUE NAMES (28 verified 2026-05-16 + 3 WhatsApp s17: `WhatsAppInboundQueueName` / `WhatsAppOutboundQueueName` / `WhatsAppStatusQueueName`)

| Setting key | Queue purpose |
|---|---|
| `AdminAlertsQueueName` | Admin alerts |
| `AnalyticsQueueName` | Search analytics events |
| `BroadcastAnalyticsQueueName` | Broadcast-specific analytics |
| `BookingAutoCompletionQueueName` | Auto-complete past bookings |
| `BookingCancellationsQueueName` | Booking cancellation processing |
| `BookingEmailsQueueName` | Booking emails (with PDF) |
| `BookingRemindersQueueName` | Upcoming booking reminders |
| `BookingTimeoutCheckQueueName` | Provider confirmation timeout |
| `BroadcastExpiryQueueName` | Expire broadcasts |
| `BroadcastProcessingQueueName` | Broadcast matching algorithm |
| `BroadcastStatusUpdatesQueueName` | Broadcast status transitions |
| `BroadcastTieredExpansionQueueName` | Tier-by-tier expansion of broadcasts |
| `BroadcastUpdateNotificationsQueueName` | Broadcast update notifications |
| **`CartRemindersQueueName`** | Abandoned-cart reminders (added 2026-05) — see `clinqet-cart` skill |
| `CustomerIdentitySyncQueueName` | Sync customer profile from identity (session-enabled) |
| `IdentityProfileSyncQueueName` | Sync identity profile to provider/customer |
| `EmailNotificationsQueueName` | General email notifications |
| `SmsNotificationsQueueName` | SMS via Telnyx |
| `InvoiceEmailsQueueName` | Invoice emails with PDF |
| `InvoicePastBookingCheckQueueName` | Past-booking timer → auto-create invoice |
| **`ReceiptEmailsQueueName`** (`billing-receipt-emails`) | Branded payment-receipt email + PDF on every successful payment (Flow A provider / Flow B customer "PAID" booking) — `requiresDuplicateDetection: true`, DLQ via MaxDeliveryCount. Published by `BillingChargeService` (Flow A) + `BookingPaymentService` (Flow B); consumed by `BillingReceiptEmailProcessor`. |
| `NotificationsQueueName` | In-app + push notifications via `NotificationProcessor` |
| `LoginAttemptsQueueName` | Login attempt tracking |
| `MarketingSubscriptionQueueName` | Marketing list sync |
| **`MediaDerivativesQueueName`** | WebP thumb/medium generation (Service-Bus refactor 2026-05-11) — see `clinqet-media-derivatives` skill |
| `ProviderConfirmationRequestsQueueName` | First-touch provider confirmation messages |
| `QuoteEmailsQueueName` | Quote emails |
| **`SearchInteractionsQueueName`** | Search + interaction events → Parquet — see `clinqet-search-discovery` skill |
| `UserActivitiesQueueName` | User activity events |

---

## NOTIFICATION PIPELINE (NotificationProcessor)

The `NotificationProcessor` function is the central orchestrator for all in-app notifications.

### Flow

```
CommunicationDispatcher (Infrastructure)
  → Service Bus "notifications" queue
    → NotificationProcessor (Function App)
      ├── 1. Persist to Cosmos DB (with TTL + 409 conflict handling)
      └── 2. Parallel delivery:
          ├── SignalR (real-time) via SignalRHttpClient → Main API internal endpoint
          └── Push (mobile) via IPushNotificationService
```

### Key Behaviors

- **Cosmos persistence first**: Notification is saved to Cosmos with per-type TTL. Duplicate `MessageId` (409 conflict) is handled as non-fatal — delivery channels still execute.
- **Parallel delivery**: SignalR + Push execute via `Task.WhenAll` after persistence.
- **SignalR delivery**: `SignalRHttpClient` sends HTTP POST to `{ClinqetApi:BaseUrl}/internal/notifications/send` with `X-Internal-Api-Key` header. Returns `bool` (success/failure). Does not throw on failure.
- **Push delivery**: `IPushNotificationService.SendToUserAsync()`. Skipped if `NotificationMessage.SkipMobilePush` is true.
- **Retry**: Service Bus handles retries via `DeliveryCount`. Final retry → forced admin alert + DLQ.
- **Failure alerting**: Both push and SignalR failures can trigger admin alerts via `FailureNotificationHelper`:
  - `HandlePushNotificationFailureAsync()` — controlled by `EnablePushNotificationFailureAlerts` (default: false)
  - `HandleSignalRNotificationFailureAsync()` — controlled by `EnableSignalRFailureAlerts` (default: true)

### Notification Body — String.Format Requirement

Notification bodies use localization keys with `{0}`, `{1}` placeholders. When creating a `NotificationMessage`, the body MUST be formatted using `string.Format()` before dispatch:

```csharp
// CORRECT — placeholders resolved
NotificationBody = string.Format(
    _localizationService.GetLocalizedString("Notification_BroadcastExpired_Body", language),
    broadcast.BroadcastNumber)

// WRONG — raw placeholders sent to user
NotificationBody = _localizationService.GetLocalizedString("Notification_BroadcastExpired_Body", language)
// Result: "Your broadcast {0} has expired." instead of "Your broadcast BR-12345 has expired."
```

### Service Bus Message Model (NotificationMessage)

```csharp
public record NotificationMessage : ServiceBusMessageBase
{
    public string RecipientId { get; init; }
    public RecipientType RecipientType { get; init; }
    public string Title { get; init; }
    public string Body { get; init; }
    public string NotificationType { get; init; }  // String, NOT enum
    public string Priority { get; init; } = "Normal";
    public Dictionary<string, string>? Data { get; init; }
    public NotificationMetadata? Metadata { get; init; }
    public bool SkipMobilePush { get; init; }
}
```

### Admin Alert Settings (FailureNotificationHelper)

```csharp
public class AdminAlertSettings
{
    public bool EnableEmailFailureAlerts { get; set; } = false;
    public bool EnablePushNotificationFailureAlerts { get; set; } = false;
    public bool EnableSignalRFailureAlerts { get; set; } = true;
    public bool EnablePdfGenerationFailureAlerts { get; set; } = false;
    public bool EnableSystemFailureAlerts { get; set; } = true;
}
```

---

## ANALYTICS FUNCTION (PARQUET)

- Triggered by Service Bus `analytics` queue
- Writes Parquet files with defined schema
- **NEVER modify the analytics schema** without explicit permission
- All search/suggest metrics must remain intact

---

## APPSETTINGS RULES

| File | Content |
|------|---------|
| `appsettings.json` | Non-trigger settings (AI config, email templates, PDF settings) |
| `local.settings.json` | ONLY runtime trigger settings (Service Bus connection string) |

- Every new `appsettings.json` key MUST be read by active runtime code in the same change.
- If a setting is no longer used, remove the key and related options/DI binding immediately (no orphan settings).

### CRITICAL: Any new `local.settings.json` entry MUST also be added to:
- `C:\Nik\azureautomation\deploy.ps1`
- Relevant ARM template in `C:\Nik\azureautomation\`

---

## CART / BASKET

### CartReminderProcessorFunction (`C:\Nik\clinqetfunctions\Clinqet.Communications\Functions\CartReminderProcessorFunction.cs`)
**Trigger**: Service Bus queue `cart-reminders`
**Message type**: `CartReminderMessage`

### Processing Flow
1. Deserialize `CartReminderMessage` from Service Bus
2. Validate cart still exists and has `Active` status (skip if converted/deleted)
3. Check user's notification preferences (email channel enabled)
4. Send reminder email using `CartReminder.html` template
5. Schedule next reminder if more delays exist in `CartReminderDelayHours`
6. Complete the message on success, dead-letter on permanent failure

### Idempotency
- Checks cart status before sending — no duplicate reminders for converted/deleted carts
- Uses `ReminderIndex` to track which reminder in the sequence was already sent

### Settings
- Queue: `cart-reminders` (defined in `events.json` ARM template)
- Connection: `ServiceBusConnection` from `local.settings.json`

---

## CHECKLIST FOR NEW FUNCTIONS

- [ ] Function class has constructor DI (no static methods)
- [ ] Service Bus trigger uses `ServiceBusReceivedMessage` + `ServiceBusMessageActions`
- [ ] Deserialization errors → immediate DLQ (never retry)
- [ ] Handler is fully idempotent
- [ ] Uses `JsonStringEnumConverter` for deserialization
- [ ] Structured logging with parameterized messages
- [ ] CancellationToken accepted and propagated
- [ ] Manual completion on success
- [ ] Transient errors thrown for retry
- [ ] Queue name added to `local.settings.json` if new
- [ ] Queue added to ARM template and `deploy.ps1` if new
- [ ] DI registration added to `Program.cs`
- [ ] Removed any orphan appsettings/options/DI entries introduced by the change
- [ ] Build succeeds


## Two plans — lead waves + over-quota notices (2026-10-04)

The promo-sunset step is GONE from `SubscriptionBillingSchedulerFunction` (the whole PromoSunset / founder feature was deleted with the promo grant — `Data\two-plan-pricing\PLAN.md` D8). Plans are `Free` + `Premium` only.

- **Two waves.** `BroadcastProcessorFunction` notifies wave 1 (Premium, plus any Free providers the never-starve floor pulled in — RESCUE leads) at once and schedules wave 2 (Free) at `LeadWaveSchedule.ReachesAt(activatedAt, step, matching)` = `Broadcast:Matching:FreeDelayMinutes` (default 30) after activation; `BroadcastTieredExpansionFunction` releases it. Both read the same lead rows, so the countdown and the release cannot drift.
- **Over-quota Free providers.** Before each wave's fan-out both functions call `ILeadAccessGate.FindQuotaBlockedAsync(leads, maxConcurrency)` (one batched entitlement read + a counter point-read per capped provider; rescue rows are never candidates; fails OPEN). A blocked provider gets NO email and NO WhatsApp (`SkipEmail = overQuota || …`, `SkipWhatsApp = overQuota`). Push + in-app go out only when `Broadcast:Matching:NotifyOverQuotaLeads` (default `false`), worded by `LeadNotice.Title/Body(locked: true)` (`Notification_BroadcastReceivedLocked_*`); otherwise `LeadNotice.SettleWithoutNoticeAsync` claims + marks the row dispatched so a redelivery settles silently. The lead still sits in their inbox as a `LeadAccess.LimitReached` locked card.
- **WhatsApp daily cap notice.** `WhatsAppSendRecord.UpgradeAvailable` flows into `FailureNotificationHelper.HandleWhatsAppSendCapReachedAsync(businessId, cap, upgradeAvailable)`, which picks `Notification_WhatsAppSendCapReached_BodyUpgrade` only for a provider with a higher plan (Free) — Premium is never told to upgrade. The cap and plan-blocked notices deep-link to `BillingPagePaths.Plan`; the AI-minute cap notice (`VoicePostCallProcessorFunction`) links to `BillingPagePaths.AiAssistant`.

## Tier-limits final audit fixes (2026-07-16)

- **WhatsAppOutboundProcessorFunction:** ANY `ProviderCap` throttle (Free plan-blocked OR paid daily-cap-spent) completes WITHOUT marking the idempotency doc — a capped send never happened, so its deterministic MessageId must stay reusable (day-roll/upgrade retry). `WabaCeiling` throttles still mark. The throttle log no longer claims an SMS fallback capped sends don't have.
- **FailureNotificationHelper:** `HandleWhatsAppSendCapReachedAsync` / `HandleWhatsAppPlanBlockedAsync` resolve the provider's `BusinessProfile.PreferredLanguage` (fail-soft en) — new `IBusinessProfileRepository` constructor dependency (all test call sites updated).
- **Functions appsettings hygiene:** the unread `Payments:Regions` and `Payments:BillingUiEnabled` keys were removed (API-only concerns).


## 2026-07-16 INDEX-PIPELINE HARDENING + NEW FUNCTIONS (replay consumer, drift audit)

- **`ChangeFeedFailureReplayFunction`** (`ChangeFeedFailureReplayProcessor`, queue
  `%ServiceBusSettings:ChangeFeedFailuresQueueName%`): the `change-feed-failures` queue finally has a consumer.
  Idempotent replay from CURRENT Cosmos state — Service ⇒ Gate-C re-check via `ServiceIndexGates` ⇒
  `IndexServiceAsync`/`DeleteServiceFromIndexAsync`; BusinessReindex ⇒ entitlement invalidate + reindex
  (non-Active profile ⇒ delete-all cascade). Final retry ⇒ admin alert + DLQ (`ChangeFeedReplayFailed`);
  the replay DLQ is the operator signal. The old "no automatic consumer" notes are obsolete.
- **`SearchIndexAuditFunction`** (timer `%SearchIndexAudit:CronSchedule%`, default 6 AM UTC daily, settings
  `SearchIndexAudit:{Enabled,CronSchedule,SampleSize}`): counts `leadsEligible eq false` (under promo — any hit
  is drift) + `businessStatus ne 'Active'` ghosts ⇒ one admin alert with sample businessIds. Owner-confirmed keep:
  it is the only detector for frozen-false `leadsEligible` stamps (provider visible in search, silently
  lead-invisible). CronSchedule env var wired in local.settings.* and deploy.ps1.
- **SearchIndexSyncFunction hardening:** BusinessProfile-missing during service indexing now THROWS (routes to
  the failures queue) instead of the silent LogWarning skip; unknown-category AI validation parks the service in
  `PendingApproval` + rejection reason instead of stranding it in `PendingAIValidation` forever; failure
  enqueues are SCHEDULED (`CosmosDb:ChangeFeed:FailureReplayDeferMinutes`, default 5) so replay starts after
  the transient window.
- **Single approval-gate definition:** `Clinqet.Core.Utilities.ServiceIndexGates` (`IsApproved`/`IsIndexable`,
  string-based incl. legacy `AIApproved`) — used by Gate C, business reindex, the replay function and the
  provider-visibility diagnostic. Never re-inline the set.
- **AzureSearchIndexer:** `ReindexBusinessServicesAsync` applies the approval gate (a profile edit can no longer
  republish unapproved services into customer search); centerless service areas (zip/polygon without coords,
  geocode failures) are indexed with `center: null` so their city/zip string legs still match (every query-side
  predicate guards `sa/center ne null`).
- **Entitlement stamping guards:** `EntitlementService` raises the cooldown-deduped plan-missing admin alert
  whenever it resolves an EmptySet (that is the state that stamps `leadsEligible=false`); the billing-catalog
  seed hosted service verifies the promo plan resolves on every host start (LogCritical on failure).

---

## BOTH HOSTS SUBMIT TO INDEXNOW — ENABLING ONE IS A SILENT HALF-FIX (2026-07-26)

`IIndexNowSubmitter` is registered in **two** hosts, and the important one is easy to miss:

| Host | Path | Fires when |
|---|---|---|
| Main API | admin reindex endpoint | someone clicks it |
| **Function App** | `SearchIndexSyncFunction` -> `ProviderListingProjectionService` | **the Cosmos change feed**, i.e. every provider profile edit |

Enabling only the API leaves every *organic* submission dead while the manual button appears to work —
which looks like success. Both `appsettings.json` files must carry the **same** `Key`, `Host` and
`Endpoint`, and both must be prod-gated in `deploy.ps1`. `indexNowKey.test.js` iterates both hosts and
requires two `isProdEnvironment` gates, so enabling one and forgetting the other fails the build.

## SERVICESSITEMAP SHIPS ON, AND THAT IS SAFE BECAUSE THE INDEX IS MANIFEST-DRIVEN

`sitemap.xml` lists service chunks from the manifest the nightly job writes **LAST**. A stamp that has
never run therefore advertises **nothing** — it cannot advertise chunk URLs that would 404. That is what
makes `Enabled=true` safe as a committed default on every environment; the job also only touches its own
environment's SQL, Cosmos and blob container, so there is no cross-stamp leakage the way there is with
IndexNow (which pings a third party and so stays prod-only).

‼️ `ForceFullRebuild` stays **false**. It is an operational one-shot that ignores the watermark; left on,
every nightly run would rebuild every group and burn RU for nothing.

‼️ No `CronExpression` property on `ServicesSitemapSettings`. The schedule is a TimerTrigger binding the
**host** resolves from an env var, so an `IOptions` copy is read by nothing and can silently disagree
with the schedule in force — same decorative duplicate removed from `SearchIndexAudit`.
## Localized email/PDF behavior (2026-07-26)

- Email processors resolve recipient copy from the complete `en`/`fr`/`es`/`hi`/`gu` template sets.
- Booking, quote, invoice, and both billing-receipt attachment paths explicitly pass `en` to PDF generation. Unit and integration tests pin this temporary contract until multilingual PDFs receive legal/product approval.

---

## PROVIDER INDEX SYNC — session 9, 2026-07-27; DEBOUNCED in Phase 5, 2026-08-18 (`SearchIndexSyncFunction`)

`ProviderDataUnifiedProcessor` maintains **two** search indexes. Still exactly **one** `CosmosDBTrigger` —
no new change-feed function, trigger or lease container was added, and none should be. Phase 5 DID add one
Service Bus queue + one queue-triggered function; that is the only new infrastructure.

- Pass **`EnqueueProviderProjectionsAsync`**, after `ProcessBusinessReindexesAsync`, over the **same deduped
  set as `ProjectPublicListingsAsync`** (`listingBusinessIds` = business-level changes ∪ every business
  touched by a service change).
- ‼️ **Phase 5: it no longer rebuilds anything inline.** Each rebuild re-read the business's whole catalogue
  through eight concurrent queries, and per-batch dedupe only collapsed edits inside ONE batch — services
  written one at a time (`MaxItemsPerInvocation = 100`, 2000ms poll delay) each land in their own batch and
  defeat it. 100 services one at a time cost ~5,050 service-document reads for ONE provider document:
  quadratic per provider, ~5M reads across a ~1,000-provider launch. The pass now posts one dirty marker per
  business to the **`provider-projection`** queue and **`ProviderProjectionProcessorFunction`** rebuilds.
- ‼️ **Do NOT move it into `ProcessReindexForBusinessAsync`.** That runs only for `ReindexDocumentTypes`,
  and a **service add/remove never enters that set** — yet it changes `serviceCount` / `fromPrice` /
  `categoryIds` on the provider document. That was a real defect (Phase 1, F1).
- The marker's **`messageId` carries the time bucket** (`providerprojection:{businessId}:{unixSeconds/window}`,
  window = `CosmosDb:ChangeFeed:ProviderProjectionDebounceSeconds`, default 120, clamped `[15, 240]`), and it
  is **scheduled at the bucket boundary**. ‼️ Never rely on the queue's `duplicateDetectionHistoryTimeWindow`
  for the collapse: with a `PT10M` window every edit between the rebuild firing and the window closing is
  SILENTLY DROPPED. The queue is `PT5M` only as defence in depth, deliberately wider than the clamp ceiling.
- ‼️ **P4-108 — leaving the marketplace is NOT debounced.** An event showing the business out of the marketplace (promotion
  OFF or status not Active), or a pause stamped within the debounce window, sends an IMMEDIATE marker under its own id
  `providerprojection:{businessId}:now:{event _lsn, else _etag}` on the same session; promotion ON, resume and
  ordinary edits keep the bucket. A per-version id means the immediate marker is never swallowed by a bucket's dedupe.
- ‼️ **The queue is session-enabled on `businessId`.** The change feed used to serialise a business's
  projections for free (one Cosmos partition ⇒ one lease ⇒ ordered batches). With 16 concurrent queue calls,
  two buckets firing milliseconds apart can interleave read-then-overwrite and leave the index on the older
  snapshot — including losing a **suspension**, which keeps a suspended business in search. Sessions remove
  the race by construction. `IServiceBusService.SendScheduledMessageWithSessionAsync` exists for this: a
  session-enabled queue rejects a message with no SessionId.
- ‼️ **The processor invalidates cached entitlements before rebuilding.** Inline, that eviction came free
  from the reindex leg in the same batch; in its own invocation a stale cache would stamp the PRE-change
  tier / leads / boost permanently.
- ‼️ **A vanished BusinessProfile is terminal, not a failure** — the debounce makes "closed between edit and
  rebuild" reachable, so the processor deletes the document and completes instead of alerting.
- One call handles both directions: `IProviderSearchIndexer.UpsertProviderDocumentAsync` **deletes** the
  document itself when the profile is not Active, so a suspension cannot leave a ghost.
- **Not fail-open** (unlike the sitemap projection), and the failure path is now in TWO halves, both live:
  a failed **SEND** stays here as `failedProjectionEnqueues` → `HandleReindexFailuresAsync(…,
  "ProviderDocument")`; a failed **REBUILD** is retried on delivery count, then on FINAL delivery the
  processor alerts (gated by `AdminAlertSettings.EnableProviderProjectionFailureAlerts`), posts a
  `ChangeFeedFailureMessage` with `DocumentType = "ProviderDocument"` for replay, and dead-letters.
  `HandleReindexFailuresAsync` takes the document type as an optional parameter.
- `ChangeFeedFailureReplayFunction` writes the provider document on **both** replay paths — a service
  replay moves provider fields too, so repairing only the service index would silently leave the gap. It
  stays INLINE there on purpose: deferring a named repair is the opposite of what a repair is for.
- `ReindexDocumentTypes` gained **`"FeaturedPlacement"`** — inert until Phase 4 creates that doc type.

Full detail, including why there is no backfill: `clinqet-search-discovery` SKILL, "PROVIDER INDEX".

## Phase 4B (2026-07-28)

`SearchIndexSyncFunction.ReindexDocumentTypes` no longer contains `"FeaturedPlacement"`. Nothing will
ever write that document type — the paid boost is **design only** (plan 8.6) and, when built, projects
onto `BusinessProfile` instead. A trigger for a type that cannot exist reads as a live feature.

`AzureSearchIndexer` / `ProviderSearchIndexer` now stamp `ClinketBadge` from
`BusinessProfile.ClinketBadge` (previously hardcoded `null`), and no longer write `IsFeatured`.


## 2026-07-30 — Phase-6 combining audit
- **SearchIndexAuditFunction is a ROTATION SWEEP since 2026-09-22 (D-51)** — the index↔index provider reconciliation is DELETED. It never read Cosmos, so it could not see "Cosmos has a service the index never received", and above `MaxReconciledProviders` it skipped its membership check while reporting all-clear. Now it pages `Business` by clustered primary key (`WHERE Id > @cursor ORDER BY Id`, identical cost at any table size) and, per business, does ONE single-partition Cosmos read + one per-business query on EACH plane + the blob AI-cache artifact check. The two planes have DIFFERENT expected sets: the private catalogue mirrors every living service, the public index only the publishable ones; Closed/Suspended businesses expect ZERO documents in both, which makes the sweep a standing check that closures completed. `batch = ceil(total / SearchAudit:TargetCoverageDays)` (15) capped by `SearchAudit:MaxBusinessesPerRun` (2000); ‼️ when the ceiling binds an admin alert states the REAL coverage period ("every 47 days, not 15") — it must never go quiet, which is exactly how the old one failed. Cursor: ONE `SearchAuditWatermark` in `SystemData` (id `search_audit_watermark`, pk `system`, no TTL, ≈1 RU), advanced only after a batch fully succeeds. The promo-drift half (leadsEligible / businessStatus over the public services index) is unchanged.
- **ChangeFeedFailureReplayFunction: a replayed service DELETE now also refreshes the provider document** — serviceCount/fromPrice move with a delete too.

---

## ‼️ MULTI-USER TENANCY — PHASE 7 (2026-08-03). Every provider notification changed.

### The rule

**No `[Function]` in this host may dispatch a provider-directed notification through the raw
`ICommunicationDispatcher`.** A provider recipient id *is* a `BusinessId`, and in-app, push and SignalR
all key on a **person** — so a raw dispatch writes to a partition nobody reads, tags a device tag nobody
has, and targets a SignalR group with zero connections. Provider notices go through
`IBusinessCommunicationDispatcher`, which re-addresses per resolved member.

Customer-directed dispatches are **unchanged** and still use `ICommunicationDispatcher` (L4/L5).

### Scope of the change

15 dispatch sites across 13 function files, plus 7 provider sites inside
`Services\FailureNotificationHelper.cs`, which gained a shared
`DispatchOperationalNoticeAsync(...)` that routes provider notices through the business dispatcher while
customer and admin notices stay single-recipient.

**Full 68-row evidence table** (every `[Function]` attribute in this host, five questions each):
`C:\Nik\member-provider\phase-07-function-audit.md`.

Converted files: `ProviderConfirmationProcessor` · `BroadcastProcessorFunction` ·
`BroadcastTieredExpansionFunction` · `BroadcastStatusUpdateFunction` ·
`BroadcastUpdateNotificationFunction` · `BookingReminderProcessor` · `BookingCancellationProcessor` ·
`BookingTimeoutProcessor` · `BookingAutoCompletionProcessor` · `InvoicePastBookingProcessor` ·
`RealtimeCallWebhookFunction` · `VoicePostCallProcessorFunction` (2) · `SearchIndexSyncFunction` ·
`Services\FailureNotificationHelper` (7).

### Free win found during the sweep

`TryClaimNotificationDispatchAsync` **already returns the `BroadcastProvider` document**, and both
broadcast functions were discarding it. Using `dispatchClaim` as the routing `Subject` gives
branch-correct lead routing at **zero extra Cosmos reads**, and let ~25 now-dead `BusinessProfile` point
reads per fan-out be deleted along with `ResolveUserIdFromUserNumberAsync(businessId)` — which could
never have worked under tenancy, since it resolves a userId from a *userNumber*.

### ‼️ L94 is not unconditional

Swallow a dispatch failure **only** when you can name the row that is already committed. Where the
notification *is* the work product — `ProviderConfirmationProcessor` — swallowing completes the message
while nobody was asked to confirm, and the booking times out on the customer. Let it throw so Service
Bus retries and dead-letters. A test caught this being applied wrongly.

### ‼️ B.12 — where a private helper is declared matters

A helper inserted **between** an attribute block and its action moves `[Function]` onto the helper. It
compiles, unit tests pass, and it 405s in production. `ProviderConfirmationProcessor`'s helper is
deliberately declared **after** `Run` and carries a comment saying why.

### Testing these functions

See the `clinqet-notifications` skill for the two ways a notification test passes without testing
anything (a bare mock never invokes `requestFactory`; `Awareness` never reaches the raw dispatcher).
Use `BusinessDispatcherTestDouble` (unit) and `PassThroughBusinessDispatcher` (integration).

---

## ‼️ MULTI-USER TENANCY — PHASE 9 (2026-08-04). The four tenancy functions, and what this host is NOT.

> **The whole model is now one skill: read `clinqet-provider-teams` before any tenancy change.**

**Phase 9 changed NOTHING in this host.** This section is the final inventory.

### The four tenancy functions this programme added

| Function | Trigger | Does |
|---|---|---|
| `AccessChangeDispatcherFunction` | timer, `%Tenancy:AccessChange:SweepCron%` (default `0 */1 * * * *`) | sweeps undispatched `AccessChangeQueue` rows onto Service Bus. `DispatchBatchSize` **100** per sweep, `MaxDispatchAttempts` **5** then an admin alert — **never an unbounded retry loop** |
| `AccessChangeProcessorFunction` | Service Bus, `%ServiceBusSettings:AccessChangesQueueName%` (`access-changes`) | `AccessChangeApplier` — evicts the cached authorization snapshot and revokes refresh sessions where required |
| `NotificationDigestProcessorFunction` | Service Bus, `%ServiceBusSettings:NotificationDigestsQueueName%` (`notification-digests`) | acquires a bounded lease; sends **no message for an empty window** |
| `TenancyExpirySweepFunction` | timer, `%Tenancy:Lifecycle:ExpirySweepCron%` (hourly) | `ITenancyExpirySweeper` — expires pending invitations (releasing seats and **rotating the hash so the emailed link dies**) and lapsed ownership transfers |

**Re-measured 2026-10-02: 73 files, 90 `[Function]` attributes** (47 Service Bus queue triggers, 23 HTTP, 21 timers, 2 Cosmos change feeds; 2026-09-20 read 66 / 79) (`PHASE-07` said 56/64 and was wrong; the count was
corrected in `02-CODE-REALITY.md` §8). ‼️ **Any "audit every function" obligation is a 68-row table.**
Per-function evidence: `member-provider/phase-07-function-audit.md`.

‼️ **`ITenancyExpirySweeper` is its own service, NOT methods on the invitation or lifecycle service**
(L109). Putting `ExpireDueInvitationsAsync` on `IBusinessInvitationService` would force **this host** to
register `IBusinessSeatService` → `IEntitlementService` → `ICountryResolutionService` → two Cosmos
repositories plus `IBillingCatalogAlertService`, purely to expire a row. The narrow service needs only
`AppDbContext` and the notifier. **ONE timer covers both deadlines** — they share a cadence and a failure
mode — and the two sweeps are independently try/caught so a failure in one cannot stop the other.

### ‼️ What this host is, and is NOT

| | |
|---|---|
| SQL (`AppDbContext`) | ✅ **yes** — which is what makes the sweeps and the dispatcher possible here |
| `AddNotificationRouting()` | ✅ registered |
| `AddSystemActorAttribution()` | ✅ registered (L115) — **every document this host writes is stamped `BusinessActorType.System`** with a null `MembershipId` |
| `AddTenancyAuthorization()` | ⛔ **deliberately ABSENT.** This is not an authorization host — there is no request, no token and no `TenantContext` |
| `AddBranchResolution()` | ✅ registered |
| **`AddBusinessActivityFeed()`** | ⛔ **NOT registered.** ‼️ **Only the Main API registers it**, so **no caller-less host writes an activity row today** and `BusinessActorType.System` is currently **unreachable in the feed.** Wiring it here is the switch that would activate voice-taken bookings in the feed — and it is a **cost decision** (one Cosmos write per event per business) |

‼️ **`SystemActorAttributionAccessor` uses `TryAddSingleton`**, so a host that also registers the
request-scoped human accessor keeps it. Phase 4's central stamping in `CosmosDbRepository` picks it up with
**zero repository change**. A voice-taken booking is now **positively marked** `System` rather than merely
unattributed — absence could not distinguish "a system did it" from "written before attribution existed".

### ‼️ THE PRODUCER SWEEP — 18 sites + a 7-site helper family, and why it mattered

Under tenancy a `businessId` is **not** a user number. Every site dispatching a provider notification with
`RecipientUserNumber = businessId` therefore wrote in-app to a partition `NotificationController` never
reads, tagged push `userNumber:{businessId}` (**zero devices**), and targeted SignalR
`notif:{businessId}:Provider` (**zero connections**). **Email was the only leg that could land** — so any
site with `SkipEmail = true` or no template had **no surviving channel at all.**

‼️ **The launcher named 2 sites. There were 18, across 13 function files, plus a nineteenth family of 7
inside `Services\FailureNotificationHelper.cs`.** All converted to `IBusinessCommunicationDispatcher`.
Every remaining raw `_communicationDispatcher.DispatchAsync` in this host was individually confirmed to
carry `RecipientType.Customer`. **No provider-addressed raw dispatch remains.**

**A net performance REDUCTION:** the sweep **removed ~25 Cosmos point reads per broadcast fan-out**.
`TryClaimNotificationDispatchAsync` already returned the `BroadcastProvider` document and both broadcast
functions were **discarding it**, so using `dispatchClaim` as the routing `Subject` gives branch-correct
lead routing at **zero extra reads** — and let the now-dead `BusinessProfile` reads and
`ResolveUserIdFromUserNumberAsync(businessId)` be deleted (‼️ that last one could **never** have worked
under tenancy: it resolves a userId from a *userNumber*).

### ‼️ THE L119 RULE — the swallow guard is CONDITIONAL, and applying it uniformly IS a bug

**L94** says a business-notification dispatch must never fail an **already-persisted** business
transaction. I applied it uniformly across all 18 producers and **that was wrong** in
`ProviderConfirmationProcessor`: **nothing is persisted by that message — the dispatch IS the work.**
Swallowing **completed the Service Bus message while no member was ever asked to confirm the booking**, and
the booking then timed out on the customer, silently. `Run_GenericExceptionFinalRetry_DeadLetters` failed
and exposed it.

> ‼️ **The mechanical test: NAME THE ROW THAT IS ALREADY COMMITTED.**
> `BookingCancellationProcessor` can (the cancellation) · `BroadcastProcessorFunction` can (the claim) ·
> `ProviderConfirmationProcessor` **cannot**, so it **throws** and Service Bus retries then dead-letters.

### Durable event identity

`clinqetcore\Services\Communication\BusinessEventId.cs` (L88) — every business-routed producer supplies an
`EventId` derived from the **persisted transition**. ‼️ **Random GUIDs, `DateTime.UtcNow` and per-attempt
ids are INVALID**: Service Bus redelivery and partial fan-out cannot deduplicate an id minted during a
retry. Per-recipient delivery identity is SHA-256 of event + recipient + business; processors append the
channel. Sabotage-verified — appending a GUID to `BusinessEventId.For` failed 2 tests.

### Infrastructure — these ones DO need ARM + `deploy.ps1`

`access-changes` is provisioned in ARM at `azureautomation/events.json` and named in `deploy.ps1`
(`$qAccessChanges`), assigned to the **Functions** host, the **API** host and `$functionAppSettings`.
`notification-digests` likewise. `Tenancy__AccessChange__SweepCron` (`0 */1 * * * *`) and
`Tenancy__Lifecycle__ExpirySweepCron` (`0 0 * * * *`) are set for this host with values that **mirror the
options-class defaults**.

‼️ **The rule is narrower than people assume:** only a **`local.settings.json`** entry (a trigger-binding
setting) or a new Azure resource needs an ARM + `deploy.ps1` entry. An **appsettings-only** key does not —
which is why `Tenancy:BusinessContext:*` and `HealthChecks:AccessChange:*` correctly have none.

### Testing these four functions

See `clinqet-notifications` for the two ways a notification test passes without testing anything, and
`clinqet-testing` for the doubles. ‼️ **Run `Clinqet.Communications.IntegrationTests` SERIALLY** — it and
the three other Testcontainers suites collide on the Cosmos-emulator port **8081**, and a **total-failure**
pattern is an infrastructure signal, not a regression.

### ‼️ L35 — DRAIN EVERY QUEUE AT DEPLOY

Messages enqueued before the tenancy cutover carry the pre-tenancy shape, and **no version-compatibility
code was written** (pre-production; L35 forbids it).

---

## ‼️ CORRECTION — PHASE 12 PART 1 (2026-08-05). THE ACTIVITY-FEED ROW ABOVE IS WRONG.

The "What this host is, and is NOT" table states **`AddBusinessActivityFeed()` — ⛔ NOT registered … only the
Main API registers it, so no caller-less host writes an activity row today and `BusinessActorType.System` is
currently unreachable in the feed.**

‼️ **That is FALSE, and Phase 11 Part 4 already proved it against the code.** This host registers the feed at
`clinqetfuncations/Clinqet.Communications/Program.cs:478`, five lines above its `AddSystemActorAttribution()`
at `:485`. `02-CODE-REALITY` §10 was corrected then; **this skill was not**, so the stale claim survived into
Phase 12. Three consequences:

- **`BusinessActorType.System` IS reachable in the activity feed.** `AD6`'s "the System actor is unreachable"
  premise is false.
- `BroadcastMatchingService:1656` writes a **`LeadReceived` activity row per matched provider on every
  broadcast fan-out**, and that service is registered **only** in this host. That is a real, recurring Cosmos
  write on the busiest fan-out path on the platform — it belongs in any cost estimate for this host.
- Only the **MCP** host lacks the feed.

## ‼️ MEASURED COUNTS — PHASE 12 PART 1

| Fact | Long-quoted | **Measured 2026-08-05** |
|---|---|---|
| Function files / `[Function]` attributes | 56 / 64 (`PHASE-12` §1) · 35 / 37 (this skill's older inventory) | **66 files / 79 attributes** (re-measured 2026-09-20) |
| Distinct `ServiceBusTrigger` queue expressions | **37** (`02-CODE-REALITY` §8, `PHASE-12` §1) | ‼️ **39** — the 37-name list predates tenancy and omits **`AccessChangesQueueName`** (Phase 3) and **`NotificationDigestsQueueName`** (Phase 5) |
| Timer binding expressions | — | **12** `%…%` expressions plus one literal (`0 */15 * * * *`, `DeviceRegistrationRetryFunction`) |

## ‼️ A `%…%` TRIGGER BINDING IS RESOLVED BY THE HOST, NOT BY `appsettings.json`

The Functions **host** resolves `%Foo:Bar%` in a trigger attribute from `local.settings.json` (locally) or the
App Service application settings (deployed). The **worker's** `appsettings.json`, added in `Program.cs` via
`builder.Configuration.AddJsonFile(...)`, is a different configuration and **cannot** satisfy a binding
expression. So:

- **Every `%…%` in a `[TimerTrigger]` or `[ServiceBusTrigger]` must exist in all three `local.settings*.json`
  AND in `deploy.ps1`.** Diffing against `appsettings.json` proves nothing.
- ‼️ `ServicesSitemapSettings` deliberately carries **no** `CronExpression` property (an `IOptions` copy could
  silently disagree with the schedule in force), so `appsettings.json` could not cover for the key at all.
- Phase 12 Part 1 found three genuinely missing: `ServicesSitemap__CronExpression` (absent from **both**
  `local.settings.ca.json` and `local.settings.in.json`), `SearchIndexAudit__CronSchedule` (absent from
  `local.settings.in.json`) and `ServiceBusSettings:VoiceMonitorCommandsTopicName` (absent from
  `local.settings.json`). **All three were correct in `deploy.ps1`'s applied block**, so this was
  local-development only — but it is CASE 16's shape and the check is cheap: **all 12 timer expressions now
  resolve in all three profiles, measured 12/12/12.**

## ‼️ `voice-monitor-commands` IS A TOPIC WITH NO CONSUMER IN THIS HOST — and that is correct

ARM (`azureautomation/events.json:1130`) provisions 40 Service Bus entities against this host's 39 queue
triggers. The fortieth is the **topic** `voice-monitor-commands` + its `monitor` subscription: this host is a
**producer** (`Services/VoiceProviderJoinSignals.cs`, `Services/VoiceDocumentDeliverySignals.cs`), and the
consumer is `clinqetmcp/Clinqet.Mcp/Monitor/VoiceMonitorCommandListener.cs`. **Do not read it as an orphan.**

## ‼️ SILENT BACKGROUND FAILURE — the one question every trigger must answer (2026-08-08)

**Ask of every `[Function]`: "if this failed on EVERY invocation, how would anyone find out?"** Answers, best
to worst:

| | signal | acceptable? |
|---|---|---|
| **(a)** | raises an admin alert via `FailureNotificationHelper` | ✅ |
| **(b)** | rethrows ⇒ platform failure metric **and** the message reaches the DLQ (Service Bus triggers only) | ✅ |
| **(c)** | rethrows, but no DLQ exists (HTTP / change-feed / timer) | ⚠ visible only as an exception nobody alerts on |
| **(d)** | **catches, logs, returns normally** — silence is indistinguishable from success | ❌ **THE DEFECT** |

A 2026-08-08 sweep of all 70 `[Function]` attributes (13 timers + 57 non-timer) found **eight (d) sites**,
three of them BLOCKER-grade: a failed SMS **STOP** was acked 200 to Telnyx and never retried (TCPA); every
inbound India call got an empty applet on any fault while Plivo saw 200; and a Service Bus outage silently
discarded **every** inbound WhatsApp message with a 200 to Meta. All eight now alert.

**The canonical shape — copy `Functions/TenancyExpirySweepFunction.cs:80-92` verbatim:**
log the error, then `await _failureNotificationHelper.HandleSystemFailureAsync(key, message, ex)` **wrapped in
its own try/catch**, so a failing alert can never break the caller. `FailureNotificationHelper` is
`AddScoped` in `Program.cs`, so adding it to a function's constructor needs **no** DI change.

Rules learned the hard way:

- ‼️ **VERIFY THE GATE, NOT THE CALL.** `HandleSystemFailureAsync` is gated on `EnableSystemFailureAlerts`;
  `HandleEmailFailureAsync` and `HandlePdfGenerationFailureAsync` are gated on **different** flags that were
  `false` in both the class default and `appsettings.json`. Five processors called them believing they
  alerted — they only ever reached the DLQ. **A call to an alert helper is not evidence that an alert fires.**
- ‼️ **`OperationCanceledException` must NOT alert.** A host shutdown is not a fault. Use
  `catch (Exception ex) when (ex is not OperationCanceledException)` so cancellation reaches the existing
  rethrow — otherwise every scale-in raises a Critical alert, and the "cancellation raises no alert" test is
  vacuous.
- ‼️ **A Cosmos CHANGE-FEED trigger cannot be retried by failing it** — extension 4.x checkpoints the batch whether
  the function returns or THROWS, so an unrecorded failure is lost forever with no DLQ. `ProviderDataUnifiedProcessor`
  is the reference (P4-107): every failed document or business is queued as its own replay, and a batch that throws
  queues one for every business it touched before rethrowing (the rethrow only records the failed run).
- ‼️ **`IsFinalRetry` only works if the app and the queue agree.** It is
  `deliveryCount >= RetrySettings:MaxDeliveryCount` (`FailureNotificationHelper.cs:97-110`). If the queue's
  ARM `maxDeliveryCount` is LOWER, the message dead-letters before the alert can fire; if HIGHER, the alert
  fires early and the message keeps retrying. Both are `5` today (`appsettings.json:886`,
  `azureautomation/events.json`) — **re-check both sides whenever either changes.**
- **Keep the caller-facing behaviour, fix the visibility.** A live phone call must still get a graceful applet
  and Meta must still get its 200 — the fix is the alert, not a 500. The exception is a compliance-critical
  write (an SMS opt-out), where the failure MUST propagate so the carrier retries; that was only safe because
  the preference write was verified idempotent first.


## WhatsApp+SMS Phase 4 — the catch-all cadence is now uniform (2026-08-14)

- **Every WhatsApp/SMS processor catch-all alerts ONLY on `IsFinalRetry`** — Phase 4 fixed the last two
  per-attempt sites (`WhatsAppInboundProcessorFunction`, `WhatsAppOutboundProcessorFunction`; the status +
  SMS processors were fixed in Phase 1). Catch-all descriptions carry the exception **TYPE** (never
  `ex.Message` — stable for the content-hash dedupe; the full exception still rides the `ex` parameter and
  the structured log). Cadence pinned by test pairs in all four processors' test files.
- AI-F8 at the producers: `TelnyxSmsService`/`TwoFactorSmsService` never put `ex.Message` into
  `SmsResult.ErrorMessage` — downstream alert descriptions consuming `ErrorMessage` are clean by
  construction. Carrier verdict text (statuses/error codes/errorsJson) is kept deliberately.

## WhatsApp+SMS Phase 1 — processor alert contracts (2026-08-13)

- `SmsNotificationProcessorFunction`: null-phone/missing-template DLQs raise `SmsSendFailure` (High, producer
  defect); transient exceptions alert ONLY on final retry (the per-attempt Critical spam is gone); the final
  send failure is a forced `SmsSendFailure`; `SmsResult.Permanent` (India OTP-only refusal, owner DR-1) ⇒
  lease released + COMPLETE, no retry, no alert.
- `WhatsAppStatusProcessorFunction`: no silent paths — null-status DLQ alerts (producer defect), the catch-all
  alerts, a Meta `failed` verdict alerts FORCED + Critical, and a claimed ticket whose SMS then fails raises a
  recovery-lost alert (`TicketConsumed=true`).
- `WhatsAppOutboundProcessorFunction`: fallback failures alert at every stage (dispatcher/direct/ticket-mint —
  see clinqet-whatsapp); a cap-accounting failure raises a stable-description SystemError (dedupe-friendly).
- `SmsWebhookFunction`: a consent-write failure raises a FORCED `SmsWebhookFailure` AND still rethrows so the
  carrier retries — keep both properties through any refactor. Telnyx `delivery_failed` raises a forced
  Critical `SmsDeliveryFailure` with the `provider` passed explicitly.
- The `WhatsAppWebhookFunction` payload-drop alert is FORCED (Meta got its 200 and never retries — the alert
  is the only signal).
- `BookingTimeoutProcessor` reads `Booking:BookingTimeoutAdminAlertTtlSeconds` (present in THIS host's
  appsettings; the old `AdminAlertSettings:TtlByType:*` path existed only in the API's appsettings, which this
  host never loads — that dead API section is deleted).
- ‼️ `AdminAlertSettingsConventionTests.EveryAlertGate_DefaultsTrue_InClassAndAppSettings` fails the build if
  any `AdminAlertSettings` bool gate is not true in class + appsettings (owner rule R3).

## WhatsApp+SMS Phase 3 — the voice post-call pipeline (2026-08-14)

- `VoicePostCallProcessorFunction`'s three `vpc-doc-email-*` enqueues stamp **`EmailOnly = true`** — the
  booking/quote/invoice email processors skip their additive WhatsApp copy for voice-originated sends
  (DR-9 one-channel; web flows byte-unchanged, default false).
- `AutoCreateSuggestionsAsync` passes `autoApplied: true`, returns the applied suggestion ids, and on an
  applied DraftBooking enqueues **`ActionSideEffects{BookingCreated}`** (dedup
  `vpc-act-{callId}-BookingCreated-{bookingId}`) so the auto-created booking rides the SAME provider
  one-tap confirm chain as a live receptionist booking; an enqueue failure after a successful apply raises
  a FORCED SystemError (a booking nobody was asked to confirm must never be silent).
- New `DispatchPendingSuggestionNotificationAsync` dispatches **`CallSuggestionPending`** (in-app + push)
  when a Pending DraftBooking/DraftQuote card remains un-applied — inside the `SideEffectsAppliedAt`
  once-per-call guard, `BusinessEventId.ForCall` durable id, L94-guarded (the card itself is durable).
- The `send_service_info` failure/SentAsText notice now carries `VoiceDocumentKind.ServicePage` (was
  hardcoded `Booking` — a live caller was told a nonexistent booking failed).
- `VoiceDocumentDeliverySignals` logs a Warning when a notice is dropped for a LIVE session with no
  monitor (the unmonitored-call failure mode was a silent return).
- ‼️ STALE BLOCK CORRECTION: the "Admin Alert Settings" snippet further up this file predates Phase 1 —
  `AdminAlertSettings` now has 13 gates, ALL true in class + appsettings, build-pinned by
  `AdminAlertSettingsConventionTests` (see the Phase 1 section below; trust it, not the old snippet).

## WhatsApp+SMS Phase 2 — the inbound webhook contracts (2026-08-13)

### ‼️ `SmsWebhookFunction` inbound is IDEMPOTENT, and the lease rules are load-bearing

Every inbound intent runs inside `HandleInboundOnceAsync`, keyed `sms-inbound:{carrier message id}` on the
existing `ICommunicationDeliveryIdempotencyStore` (channel `SmsInbound`) — no new store, no new doc family.

- `Completed` ⇒ a carrier redelivery: log and return 200 without re-running anything.
- `Busy` ⇒ another worker holds it: return 200, do not double-apply.
- `Acquired` ⇒ handle, then **`CompleteAsync` ONLY after the handler succeeded**.
- ‼️ **A failed handle RELEASES the lease and rethrows.** The opt-out/opt-in handlers must fail the webhook so
  Telnyx retries a lost consent write; marking the message processed on failure would swallow that retry —
  the two mechanisms would silently cancel each other out.
- No carrier message id ⇒ process WITHOUT replay protection and log a warning. Never fabricate a key.

### ‼️ Anything you inject into the parsed form MUST be declared in `SmsWebhookFormKeys`

The 2Factor signature is an HMAC over the carrier's own fields. The function stamps its own keys onto the same
dictionary before validation (`WebhookProvider`, the buffered raw body, header-carried signature material, the
parsed Telnyx envelope), and hashing those made the computed signature differ from the carrier's **on every
request** — 2Factor callbacks could never validate. `TwoFactorWebhookHandler.ComputeHmacSignature` now filters
on `SmsWebhookFormKeys.IsInjected` (the literal `WebhookProvider` plus everything `__`-prefixed).
**Add a key without registering it there and you re-break inbound India SMS.**

### Telnyx SMS webhook: signature or nothing

The `X-Forwarded-For` CIDR fallback is DELETED, and so is `TelnyxWebhookSettings.AllowedIpRange` (class,
appsettings, tests). A caller-supplied header let anyone forge an opt-out or confirm a stranger's booking; the
voice path already refused it. Absent Ed25519 material ⇒ reject. ‼️ This requires signing to be enabled on the
Telnyx **messaging** webhook profile, not just the voice one.

### Intents the webhook now handles

`SmsInboundIntent` gained `Help`. The switch is: OptOut · OptIn · Confirm · Decline · **Help** · default.

- **Confirm/Decline** try the provider first, then fall through to `ApplyCustomerReplyAsync` when the phone is
  not a provider — an ordinary customer replying to their own confirm-request used to hit a dead end and log
  `Critical`.
- **Help** sends the static `Resources/SmsTemplates/en/HelpReply.json` (one token, `HelpUrl`, from
  `QRCodeSettings.CustomerHelpUrl()`). India refuses it by policy (DR-1 OTP-only) and that is logged as
  Information, not a failure — a `Permanent` result is a policy answer, never a fault.
- **default (unrecognized)** logs a masked phone + message length and sends **NOTHING**. Deliberate: carrier and
  bot echoes would loop, every auto-reply costs a message, and HELP is the affordance we advertise.

### One keyword table across both channels

`SmsInboundIntentParser` + `clinqetshared/Constants/InboundReplyKeywords.cs` replace the duplicated tables that
lived privately in `TelnyxWebhookHandler` and `TwoFactorWebhookHandler`. See the `clinqet-whatsapp` skill for
the full sets and for why the WhatsApp opt-out set is deliberately narrower.

### `WhatsAppInboundProcessorFunction`: one block gate, before routing

`ApplyInboundBlockPolicyAsync` runs right after contact resolution: an **Admin** block ignores the inbound
entirely; a **Deliverability** block is cleared because the inbound proves reachability. The cold branch no
longer carries its own copies. Full rationale in `clinqet-whatsapp`.

---

## ‼️ KNOWLEDGE READING ACCURACY (2026-10-02/03/04 — pushed, NOT deployed; detail in `clinqet-voice-assistant`)

- 2026-10-04: what the reading rules write back never breaks a page (`PageBlocks`, the `PageWriteBack` row edit, short-row
  reseat) and a ruling the page could not take raises `RulingNotWritten` in the one reading alert. Proven end to end by
  `KnowledgeReadingWriteBackIntegrationTests` (real reading service on an Azurite page bank, then parser, chunker, card check).

- `KnowledgeIngestProcessorFunction` takes `ITranscriptionVerificationAlerts` (last constructor argument) and sends ONE
  `ReadingOutcomeReport` per reading (flow KnowledgeIngestion, the reading's own `Settings`) right after the committed-row check and
  BEFORE the analytics ticket; a replay sends nothing, and the "already Ready" exit re-tells it from the banked reading
  (`RetellReadingOutcomeAsync`, `TryReadForAnalyticsAsync`, deterministic id). Content lost and a broken reading rule bypass the
  verification switch. The per-check verification alerts are deleted (2026-10-03).
- Both the fresh reading and the retell add `ReadingPageCount.Mismatch` (`PageCountMismatch`) and `KnowledgeCardCheck`
  (`WordsNotOnCards` / `MarkupOnCards`) items; the retell re-chunks the banked reading (free).
- At both commit points the ingest prunes the other bytes' `_ocr` folders (`KnowledgeVersionPruner.PruneFoldersAsync`); the
  top-level picture and describe banks stay. `KnowledgeDocumentDescriber` banks its answer (`DescribeRulesVersion`, §0.23).
- Picture placements: `CaptionPlacements` → `KnowledgePlacementCeiling.Apply` ⇒ `KnowledgePictureSectionsLimit` /
  `KnowledgePictureSectionsWarning` (`Voice:Knowledge:Images:MaxSectionsPerImage` 8 / `SectionsPerImageWarning` 5), raised after
  the cards are built via `ReportFileLimitAsync`.
- Overview cards: `DocAggregateCardsWarning` (8) / `DocAggregateCardsLimit` (12) ⇒ `KnowledgeAggregateCardsWarning` / `Limit`
  (only the first Limit cards ship); a full business space leaves overviews out first (`OverviewsToLeaveOut`) ⇒
  `KnowledgeOverviewsLeftOutSpaceFull`, raised only once the file fits.
- The alert is bounded for the queue: readings cut to `MaxDiscrepancyExcerptCharacters`, at most `MaxDiscrepanciesPerVerification`
  items listed (most important first), and halved until the body is ≤ 192 KB (Service Bus Standard refuses > 256 KB for good).
  Its id hashes every reading and loss count, sorted. Picture-text losses join the report (`KnowledgeReadingConservation.Combine`).
- A duplicate upload keeps the survivor's own notices and adds the merge notice once.
- The content artefact banks `Conservation` and a replay copies it back, so a replayed reading raises the same notice
  (`Info_KnowledgeContentNotSaved` when anything is still lost).
- `AdminAlertProcessor.IsKeyedByEvent`: `KnowledgeReadingNeedsReview`, `ProviderSetupReadingNeedsReview` (with
  `DocumentTranscriptionVerification`) and `KnowledgeWrongAnswersReported` (the API's "Report wrong answers", a new EventId per
  tap: a redelivery is one alert, a second tap another) are stored by EventId; a message without identity is dead-lettered.
- `KnowledgeServiceDraftAnalyticsJob` restates `Info_KnowledgeDraftPricesToCheck` on EVERY outcome (removed when nothing is left;
  counted by source row, over drafts that have a price); approving or dismissing removes it once the file has nothing waiting
  (`KnowledgeDraftApprovalService`, ETag retry). It sends ONE `PublishReadingOutcomeAsync` per run (`PriceReadDifferently`,
  `ReadByAnOlderReader` items), binds disputes through the candidate row (`TranscriptionDisputeIndex.PricingAt`), and re-parses a
  stale artefact from its saved reading (`KnowledgeContentArtifact.Markdown`) — never paid AI.
- Tests: `ReadingOutcomeAlertsTests`, `AdminAlertProcessorIntegrationTests` (incl. `WrongAnswersReport_FromTheRealProducer_PersistsOneRowPerTap`),
  `KnowledgeIngestPageScopeIntegrationTests`, `KnowledgeIngestOverviewCardsIntegrationTests`, `KnowledgePageReadingPruneIntegrationTests`.

## ‼️ PHASE 4 — KNOWLEDGE INGEST + CHANGE-FEED RESILIENCE (2026-08-18)

- **`KnowledgeIngestProcessorFunction` also serves `KnowledgeIngestMode.Analytics` tickets** (2026-08-29): the Ready
  commit stamps `ServiceDraftAnalytics = Queued` and posts a ticket in session `{businessId}:analytics` on the SAME
  `knowledge-ingest` queue (`KnowledgeAnalyticsQueue`), which the function routes to
  `KnowledgeServiceDraftAnalyticsJob.RunAsync(businessId, docId, attempt)` — its own budget (`ServiceDrafts:TimeoutSeconds`
  2400 s since 2026-09-25, kept below `host.json` `functionTimeout` 00:45:00 by a convention test that reads host.json;
  `QueuedStaleAfterMinutes` 240), transient retries as SCHEDULED session sends (180/360/720 s, 4 attempts). See the
  voice-assistant skill.
- **(2026-09-25, P4-C-05 / P4-B-21)** An INGEST failure the classifier calls transient — embedding / search / Cosmos /
  storage transport, `SearchAiCacheUnavailableException`, a throttled or unavailable embedding result, a vision page lost to
  an outage — throws `KnowledgeIngestRetryableException` and rides the same scheduled retry (`ShouldRetryLater`, bounded
  by `Voice:Knowledge:IngestRetryAttempts`), never an instant redelivery. Vision pages still unread after the last attempt
  keep the machine reading and raise a forced admin alert. Full contract: voice-assistant skill, "RECENT CHANGES — 2026-09-25".
- **`KnowledgeIngestProcessorFunction`** embeds on the **Bulk** lane, so a 539-card document goes out as
  several token-bounded requests instead of one 276,000-token request the protocol refuses. Its D11
  doc-summary and image-caption calls are Bulk too. The failure message now names the count, the failure
  kind and the request count instead of "card 0".
  ‼️ **The row stays `Processing` on a non-final delivery.** It used to read "Failed — Try again" while a
  retry was still queued, so the provider was told it had failed and then watched it succeed.
  On the TERMINAL outcome only, it dispatches `NotificationType.KnowledgeDocumentFailed` through
  `IBusinessCommunicationDispatcher` — never on success, never on an intermediate attempt. The EventId
  carries the row's `UpdatedAt.Ticks` so a genuine SECOND failure after a Try-again is not deduped into
  silence, and the row is re-read first so a document deleted mid-run is never announced as failed.
- **`SearchIndexSyncFunction`** — `MaxItemsPerInvocation` is **100** (was 500): the AI legs are paced by the
  budget governor, so an invocation's wall clock now tracks the deployment's spare headroom rather than the
  fan-out. A degraded leg does NOT fail the invocation (the document is indexed and BM25-searchable); it is
  queued onto `change-feed-failures` for a paced retry. `AiThrottledException` counts as transient.
- **`ChangeFeedFailureReplayFunction`** — a replay that comes back still-degraded throws
  `SearchIndexLegDegradedException`, so the queue retries it; only on the FINAL delivery does it report to
  **`SearchLegFailureAggregator`**, which emits ONE aggregated alert per leg per window with counts, a
  capped sample list and an explicit elision note. 500 degraded services = 1 alert, not 500.
- **`AdminAlertType.AiCompletionBudgetExhausted`** (2026-08-29, High): a structured AI answer cut off by its completion
  budget twice (the 3× retry included) — raised by `AiBudgetCutoffAlerts` from the caption classifier, the pixel verify,
  the photo proposer and the document describer; 15-min cooldown per call kind + business + context.
- **New `AdminAlertType` values** (append-only): `KnowledgeIngestFailed`, `SearchEnrichmentFailed`,
  `SearchEmbeddingFailed` — each registered in `clinqetwebadmin/src/pages/alerts/AlertsPage.jsx`.
  **New `AdminAlertSettings` flags**, all default TRUE in the class AND appsettings:
  `EnableKnowledgeIngestFailureAlerts`, `EnableSearchEnrichmentFailureAlerts`, `EnableSearchEmbeddingFailureAlerts`.
  ‼️ The class moved to `Clinqet.Shared.Models` so `clinqetinfrastructure` can be gated by it too.
- **`Search:VectorRecovery:MaxDocumentsPerRun` is 2000** (was 500): 500 could not clear a 5,000-document
  incident in reasonable time. The sweep is paced through the Bulk lane, so a bigger cap cannot become the
  next storm — and a document that re-indexes with the embedding leg STILL down is counted failed, not recovered.

## 2026-09-01/02 Knowledge ingest — vision transcription + AI attempt budget (AI cost programme, sessions 4–5)
- `KnowledgeIngestProcessorFunction.Run` binds an ambient `AiAttemptBudgetScope` per delivery (`Voice:Knowledge:AiAttemptBudgetPerDocument` ÷ `RetrySettings:MaxDeliveryCount`); `AICompletionService` consumes one unit per HTTP attempt and throws `AiAttemptBudgetExhaustedException` when refused; the wrapper fires `AdminAlertType.AiAttemptBudgetExhausted` fire-and-forget on complete / abandon / dead-letter (`AiAttemptBudgetConventionTests` pins the ceiling against the legitimate worst case).
- Every Document Intelligence read in the ingest (`ExtractAsync` → `TranscribeWithVisionAsync`) and in `KnowledgeServiceDraftAnalyticsJob.RederiveBlocksAsync` goes through `IVisionDocumentTranscriptionService` (`Voice:Knowledge:Vision`: luna @ Medium, 900 s time budget ⇒ the WHOLE document keeps its DI text + `AiTimeBudgetExceeded` alert; per-page blob cache `_ocr/{businessId}/{docId}/{contentHash}/{deployment}/v{PromptFingerprint}/pNNN.json` in `provider-knowledge`, deleted with the document and the business — a JSON envelope `{markdown, policy, review}` since 2026-09-10, so a replayed page keeps its review obligation and an entry banked under a different acceptance policy is a MISS). Two character gates, both `Voice:Knowledge:MaxExtractedCharacters` (2 600 000): the OCR length before vision and `KnowledgeBlockText.CountCharacters` after parse ⇒ `Error_KnowledgeTooManyCharacters` with `preserveExistingCards` + the `KnowledgeExtractedCharacters` alert naming the dial.
- Terminal outcomes are `throw await TerminalFailureAsync(...)` at every site (row Failed + reason, message completed, blob retained for Try-again). `Program.cs` registers `IDocumentPageRasterizer` (singleton; PDFium through the own binding `clinqetinfrastructure/Services/AI/Pdfium` over `bblanchon.PDFium.Linux`/`.Win32` — Docnet.Core removed by W2, 2026-09-30), `IVisionPageTranscriber` and `IVisionDocumentTranscriptionService` (scoped). Tests live HERE (§0.18): `UnitTests/Knowledge/DocumentPageRasterizerTests`, `VisionPageTranscriberTests`, `VisionDocumentTranscriptionServiceTests`, `PageMarkdownSplicerTests`, `AiAttemptBudget*`; `IntegrationTests/Tests/Services/KnowledgeOcrPageCacheIntegrationTests` (real Azurite), `Tests/Functions/KnowledgeIngestAttemptBudgetIntegrationTests`. Full contract: the `clinqet-voice-assistant` skill ("Sessions 4–5").

## 2026-09-02 (Gate 3) — knowledge ingest rules that changed
- An `AiAttemptBudgetExhaustedException` inside the vision pass **propagates**; it is the ceiling binding, not an unreadable document, and turning it into a terminal failure deleted the document's live cards and completed the message.
- Document Intelligence's own page count enforces `MaxPagesPerDocument` **before** a page is vision-transcribed, for the documents the free pre-count could not open.
- A blank DI result reaches vision first; the emptiness verdict is taken on the transcript.
- A degraded vision pass is banked as `VisionDegraded` and re-extracted on a fresh delivery (see the `clinqet-voice-assistant` skill for the full contract).
- ‼️ `BusinessClosureTeardown` is invoked ONLY by this host's `BusinessClosureProcessorFunction`, so its tests live here: `IntegrationTests/Tests/Functions/BusinessClosureTeardownIntegrationTests.cs` (migrated from the API suite on 2026-09-02 under §0.18). The API integration suite keeps the closure ENDPOINT tests it owns.
## AI resource alert wiring (2026-09-15)

Program registers `AddIntegrationHealthAlerts` + `AddAiResourceObservers`, three Search clients through `AiSearchClientFactory`, and observers on six AI HTTP registrations. Host-owned convention tests guard coverage/config. Alerts use the existing admin-alerts queue and processor; real-Cosmos integration tests cover the new types, timeout metadata, gates, cooldown and replay. No Service Bus queue or schema change was made. See the infrastructure skill for publisher lifecycle and limits. â¼ï¸ SUPERSEDED 2026-09-19: the AI-only publisher was generalised into `IIntegrationHealthAlerts` over 14 resources and `AiResourceLimitAlerts`/`IAiResourceLimitAlerts`/`AiResourceKind`/`AiResourceLimitAlertSettings` were DELETED â see the `clinqet-integration-health` skill.

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

## SEARCH-TOPOLOGY PHASE 3 — what changed in this host (2026-09-22/24)

Full picture in `clinqet-search-discovery` → "PHASE 3".

- **`OfferExpirySweepFunction`** (timer `%OfferExpirySweep:TimerSchedule%` — a `local.settings.json` key set per
  stamp by `deploy.ps1`; settings `OfferExpirySweep:{Enabled, MaxBusinessesPerRun (500), RebuildConcurrency (4),
  AlertCooldownMinutes (360)}`). An ended offer fires no Cosmos event, so it finds every public document still
  holding one on EVERY country's services and providers index, each round excluding businesses already found
  (`not search.in(businessId, …)`), rebuilds both grains, and alerts `AdminAlertType.OfferExpirySweepIncomplete`
  when the ceiling binds or a rebuild fails. Tests: `OfferExpirySweepFunctionTests` drive a REAL `SearchClient`
  over a fake transport that applies the sweep's own exclusion.
- **`SearchIndexSyncFunction`**: a business LEAVING search (event `status` ≠ `Active`, or
  `participatesInMarketplace` false) whose rebuild fails is REPLAYED on its own (P4-107 superseded the old
  "hold the checkpoint" — extension 4.x never held it), exactly like a failed service delete — otherwise the
  documents of a closed business outlive it.
- **`SearchIndexAuditFunction`** reconciles a business only when its SQL tenancy status AND its Cosmos profile
  are `Active`; a SQL-first closure that never reached Cosmos is expected to hold zero documents.
- **The provider indexer** (projection processor) resolves `served` countries through `PublicCountryFiling`
  (E48), writes to each served country's providers index and deletes from the rest, and takes its OWN lease
  `{biz}/ai-cache/provider-document.lock` (a catalogue rebuild holds `business.json` for minutes).
  A "From" price now follows D-68 (the minimum IS the price; hourly services stay out).
- **`VectorEmbeddingRecoveryService`** (`VectorEmbeddingRecoveryFunction`): each services index gets its own share
  of `MaxDocumentsPerRun`, and each re-ask EXCLUDES what the run already examined — a page of permanent failures
  used to come back first and starve the backlog.
- **Broadcast matcher** (`BroadcastMatchingService`): typed router (B-17), correlated country filter (B-19), and
  the D6 live eligibility re-check before any lead row is written — see `clinqet-quote-lead-broadcast`.

## SEARCH-TOPOLOGY PHASE 3C — what changed in this host (2026-09-25)

Full picture in `clinqet-search-discovery` → "PHASE 3C CLOSE-OUT"; record `Data\search-topology\findings\PHASE-3C-CLOSEOUT.md`.

- ‼️ **S10 — `ChangeFeedFailureReplayFunction` PUTS BACK a replay that meets its business's held lease.** Several
  replays of one business queue on one lease; abandoning spent a delivery each, so a bulk edit dead-lettered and
  alerted on nothing but contention. On `SearchAiCacheUnavailableException` (while `LeaseBusyReschedules` <
  `CosmosDb:ChangeFeed:LeaseBusyMaxReschedules`, default 6) it sends the payload back as a SCHEDULED message
  (`LeaseBusyRescheduleBaseSeconds` 30 × 2^(n−1), jittered ×0.5–1.5; `ChangeFeedFailureMessage.LeaseBusyReschedules`
  + 1; message id `{id}:busy{n}`; sent on `CancellationToken.None`) and COMPLETES the original. A put-back that cannot
  be sent abandons the original instead; past the bound the message takes the ordinary retry ladder to its alert. Both
  keys live in this host's `appsettings.json` (no ARM). Proven against the real Azurite lease
  (`ChangeFeedFailureReplayFunctionIntegrationTests`).
- **S8 / W-6 — `SearchIndexAuditFunction` checks PUBLIC staleness**: each country's public services index is asked for
  copies older than Cosmos (the `updatedAtTicks ge` batch, only for services that country should hold), beside the
  private-catalogue check.
- **S9 / W-4 — drift is confirmed under the business write lock** (`ConfirmUnderWriteLockAsync` →
  `AcquireBusinessWriteLockAsync`): a lock another writer holds, or one lost mid-check, returns nothing — not reported,
  not queued, checked next cycle. A clean business takes no lock. The repair (`BusinessReindex`, id
  `auditrepair:{biz}:{cycle}`) is idempotent, and since P4-50 a second one for the same cycle is dropped by the queue.
- **M1 / B-11 — the offer-boundary scheduler in `SearchIndexSyncFunction` reads offer days in the business's zone**:
  one `GetByBusinessIdsAsync` ReadMany per batch, `BookingTimeHelper.ResolveTimeZone`, then `OfferWindow.StartsAt` /
  `EndsAt(EffectiveEnd(...))`. A boundary scheduled from UTC days fired hours early or late in Canada/US.
- **W-15b/c/d — indexer isolation** (the indexers run in this host): one circuit breaker per index
  (`SearchIndexerSharedResources.PolicyFor(indexName)`), an unreadable country counted unswept instead of failing the
  whole rebuild, a service delete tried on every country before it throws. Test doubles must name their index — Moq
  answers the virtual `SearchClient.IndexName` with null.

## SEARCH-TOPOLOGY PHASE 4 — what changed in this host (2026-09-27)

- **P4-107 — nothing relies on failing a change-feed batch.** See "COSMOS CHANGE FEED PATTERN" above. The replay
  function gained a fourth document type, **`OfferBoundaries`**: it re-reads the business's zone and stored offers and
  schedules every start/end still ahead (`SearchIndexSyncFunction.OfferBoundaries(Offer, …)` + `BoundaryRebuild`, the
  same shape the batch uses); a send that fails throws, so the bounded redelivery and final alert apply. New replay
  ctor deps: `IOfferRepository`, `IBusinessProfileRepository`, `IOptions<BusinessTimeSettings>`.
  `ChangeFeedStallDetector` still alerts on consecutive failed batches — each of those batches was checkpointed and its
  businesses queued for replay, so the alert says the FEED is failing, not that it is frozen.
- **P4-50 — `change-feed-failures` now deduplicates by id for ONE DAY** (`events.json`: `requiresDuplicateDetection:
  true`, `duplicateDetectionHistoryTimeWindow: P1D`). The window covers the whole replay horizon — the busy put-back
  ladder (6 × 30 s·2ⁿ, jittered) is under an hour — and a day of edits to one offer. So `offerboundary:…` (the same
  moment scheduled twice), `auditrepair:{biz}:{cycle}` and `…:busy{n}` collapse. ‼️ Any sender whose repeat must be
  honoured carries a per-request id: the admin resync is `adminresync:{biz}:{svc}:{correlationId}`. The property cannot
  change in place, so `deploy.ps1` recreates the queue ONLY while it is empty (active + scheduled + dead-lettered = 0)
  and otherwise stops the deploy saying why. A message id without the queue flag would dedupe nothing again.
- **A replay VALIDATES a service still waiting for AI validation.** The validation flow moved out of
  `SearchIndexSyncFunction` into `Services/ServiceAiValidator` (`IServiceAiValidator`, scoped; the change feed builds its
  own from the same dependencies, so its tests are unchanged). `ChangeFeedFailureReplayFunction` calls
  `ValidateIfPendingAsync` before a service replay re-indexes, and `ValidatePendingOfBusinessAsync` (one single-partition
  query on the indexed `approvalStatus`) before a business replay — re-indexing alone left a pending service out of
  search and PendingAIValidation for ever. Both are no-ops unless the STORED status is still pending.
- **P4-106 — provider scores start at a prior, not a cliff.** `ProviderScoring` now carries `ResponsePriorMean` /
  `ResponsePriorWeight` / `ReliabilityPriorMean` / `ReliabilityPriorWeight` (75 / 5 / 75 / 5); `MinResponseSampleCount`
  and `MinReliabilitySampleCount` are DELETED. `Conventions/ProviderScoringSettingsConventionTests` pins every property
  to its appsettings value and fails on an orphan key. Formula and consumers: `clinqet-search-discovery`, "PROVIDER
  QUALITY SCORES".
- **P4-124 / D-103 — one lead-distance curve.** `BroadcastSettings:Matching` lost `MaxLocationBoostMultiplier`,
  `ServiceAreaBoostMultiplier` and `ServiceAreaProximityBonus`, and gained `AtCustomerLocationPenaltyBandKm` (50).
  `BroadcastMatchingService` also takes `IOptions<ProviderScoringSettings>`, so an unmeasured response or reliability
  score reads as the same prior the nightly job stores. Tests: `Services/BroadcastLocationCurveTests`. Detail:
  `clinqet-quote-lead-broadcast`.

## D-92 Step 8 — OFFERS CHANGED FEED (2026-09-28)

- ‼️ **Offers live in `Transactions` now, not `ProviderData`.** `SearchIndexSyncFunction` carries a SECOND change-feed
  trigger, `[Function("TransactionsOfferProcessor")]`, over `%CosmosDb:ContainerNames:Transactions%` with lease prefix
  `%CosmosDb:ChangeFeed:TransactionsOfferLeasePrefix%` (`transactions-offers`). `"Offer"` is OUT of
  `ReindexDocumentTypes`, and the ProviderData feed's `changedOffers` collection and boundary scheduling are gone —
  an offer is processed ONCE, by one feed. Guard: `TheProviderDataFeed_NoLongerHandlesOffers` plus
  `AnOfferOnTheProviderDataFeed_RebuildsNothingAndSchedulesNothing` (the same rule from the other side).
- ‼️ **`StartFromBeginning = false`, deliberately.** Transactions holds every booking, quote and invoice ever written and
  a rebuild reads a business's offers as they are NOW, so replaying history costs RU and changes nothing. A change
  arriving while the function is down is NOT lost: the lease keeps the continuation token and the feed resumes from it.
- **A redelivered batch is idempotent**: every leg converges from current Cosmos state, and a boundary carries the
  deterministic id `offerboundary:{businessId}:{offerId}:{yyyyMMddHHmmss}` inside the queue's one-day duplicate window.
- **`OfferUsage` is watched, but only when the counter CAN run out** (`maxUses` or `maxBudgetMinor` present). An
  uncapped offer's counter is written on every booking that uses it and can never change availability, so reacting to it
  would buy a business-wide reindex per booking for nothing. Predicate: `TransactionChangeAffectsSearch`.

## Post-ranking follow-ups — knowledge ingest in this host (W1, W3–W5, audit 2026-10-01)

Authority `C:\Nik\Data\post-ranking-followups\` (`FINAL-PLAN.md`, `DESIGN-TALL-PAGES.md`, `DESIGN-PICTURES.md`,
`findings/AUDIT.md` §6–§7). Library pieces (gate, PDFium, long pages, normalizer): clinqet-infrastructure, "Post-ranking follow-ups — knowledge reading library pieces".

- **Heavy-work gate (W1):** `Program.cs` registers `IHeavyWorkGate` → `HeavyWorkGate` as a singleton (one per process).
  Takers here: `KnowledgeIngestProcessorFunction` (near-duplicate full-size compare), `KnowledgePictureText`,
  `KnowledgeServiceDraftAnalyticsJob`. Never held across a model call.
- `IDocumentPageRasterizer` draws through PDFium (`clinqetinfrastructure/Services/AI/Pdfium`, W2); Docnet.Core is gone.
- **Long pages (W3):** pages read in part ride `VisionPagesReadInPart` (extraction → artefact); a raised section limit
  re-reads only when a page was cut short. Carry-on progress compares `extraction.VisionReadingsBanked` with
  `KnowledgeIngestQueueMessage.ReadingsBankedSoFar`; each banked section counts.
- **Picture passes (W4):** a delivery describes at most `Voice:Knowledge:Images:PicturesPerPass` (40) pictures for at most
  `PicturePassSeconds` (600, never past the delivery deadline less `Vision:PipelineReserveSeconds`); the reading carries
  on (`message.PicturePass`) up to `Images:MaxPicturePasses` = ceil(`MaxImagesPerDocument` (300) / `PicturesPerPass`),
  derived, never a dial. A pass that worked and banked nothing stops; past the pass limit ⇒ `KnowledgePicturePassesExhausted`.
  A pass whose every worked picture was throttled throws `KnowledgeIngestRetryableException` while retries remain (B-L1).
- **Description bank** (`Services/KnowledgePictureDescriptionBank.cs`): blob `KnowledgeBlobPaths.PictureDescriptionBank`
  (`_ocr/…/cap-{pictureHash}-{fingerprint}.json`, `provider-knowledge`). Fingerprint = `DescriptionRulesVersion` (1) +
  `KnowledgeImageCaptionClassifier.PromptFingerprint` (the caption prompt) + caption model/effort/tokens + stored shapes +
  document language + the words beside the picture; limits are left out (raising one reuses work). A success crosses
  readings; a failure binds only its own (`Entry.Reading`). Entries carry `SectionReads`, `ReadInPart` and `TextRules`: a
  picture's TEXT is reused only while `PictureTextRules` (machine-reading model + `VisionDocumentTranscriptionService.ReadingRules`)
  still matches, so a change to how pages are read re-reads the text but never re-describes the picture.
  ‼️ **Raise `DescriptionRulesVersion` / `NearDuplicateRulesVersion` whenever the code they cover changes** — never the build
  (owner, PLAN §10, 2026-10-01). `Conventions/BankRulesVersionConventionTests.cs` pins that code (pages, descriptions,
  near-duplicates) and fails with the exact pin to write: raise the version if behaviour changed, else update the pin only.
- **Near-duplicates:** same shape within `Images:NearDuplicateMaxAspectDifference` (0.01), 32-px colour signature within
  `NearDuplicateMaxMeanDifference` (0.02), then a block compare at the smaller picture's size (`NearDuplicateCompareMaxEdgePixels`
  1024, `NearDuplicateBlockPixels` 4, `NearDuplicateMaxBlockDifference` 0.01) inside a heavy-work slot. Bounded by
  `NearDuplicateMaxComparisons` (200 ⇒ `KnowledgeNearDuplicatesLimit`; the rest stay separate pictures) with
  `NearDuplicateComparisonsWarning` (150 ⇒ `KnowledgeNearDuplicatesWarning`). Verdicts banked at
  `KnowledgeBlobPaths.NearDuplicateBank` (`_ocr/…/near-{fingerprint}.json`) and reapplied by later passes; compare time is
  added back to the pass clock (B-H1).
- **Space rule** (`PicturesToLeaveOut`): text fits the business's searchable space (`GetMaxPassagesAsync`, entitlements)
  but pictures do not ⇒ the smallest whole pictures with cards leave until the excess is met ⇒
  `KnowledgePicturesLeftOutSpaceFull`; a deferred copy is stored only once the rule keeps it (`RestoreKeptCopiesAsync`).
- **Row-size guard:** `KeepRegistryWritable` against `Images:MaxRegistryBytes` (1,000,000) ⇒ `KnowledgePictureListFull`.
- **Limit alerts** (`ReportPictureLimitsAsync`, once for the committing reading; a replay alerts only the difference, B-L3):
  `KnowledgePicturesWarning` (`ImagesAlertPerDocument` 150) / `KnowledgePicturesLimit` (`MaxImagesPerDocument` 300),
  `KnowledgePictureTextWarning` (`TranscribedPicturesAlertPerDocument` 25) / `KnowledgePictureTextLimit` (`MaxTranscribedPictures` 50).
- **Retirement:** the artefact banks `WithheldPictures` (`KnowledgeWithheldPicture(ImageId, SourceKey, BelowTheFloor)`);
  a commit carries back only those; `null` (unseen) keeps the old carry-all.
- **Pictures of text** (`Services/KnowledgePictureText.cs`, one implementation for ingest and analytics rebuild): passes
  `VisionDocumentRequest.SectionReadsBefore`, so the per-file section limit holds across pictures (A-M2); a reading cut
  short counts `PicturesOfTextReadInPart` ⇒ notice `Info_KnowledgePicturesOfTextReadInPart` (+ `_One`). The rebuild
  (`KnowledgeServiceDraftAnalyticsJob`, `onlyIfReadBefore: true`) only replays: it reads a picture only if
  `HasBankedPageAsync` finds the ingest's banked page (A-L9).
- Page-cut figures that failed to draw are counted apart (`PageCutFiguresWithNoPixels`); only Document Intelligence crop
  losses buy a fresh reading (A-L10).
- **Reading progress:** `ReportReadingProgressAsync` → `TrySetReadingProgressAsync` (`KnowledgeReadingProgress {Stage
  Pages|Pictures, Done, Total}`): forward only, only while the row is `Processing` on this reading
  (`ProcessingSince` ≤ epoch, B-L7), at most 3 tries, never fatal.
- `Voice:Knowledge:StaleProcessingMinutes` **560**: above (1 + `MaxReadingContinuations` + `Images:MaxPicturePasses`)
  deliveries × 30 min + back-off. The stale rule is overlap-aware (`KnowledgeProcessingRules.HasStoppedPartWay`, B-L8).
- `Voice:Knowledge:AiAttemptBudgetPerDocument` **23,500** (was 7,500): `AiAttemptBudgetConventionTests` now counts
  `Oversize:MaxSectionReadsPerDocument` and one picture pass per delivery — audit A-L3: (1 + 100 + 400 + 40 + 40) × 8 =
  4,648 ≤ 23,500 / 5; the whole reading (every picture) must also fit.
- **Dead-letter handler (W5):** `[Function("ProcessKnowledgeIngestDeadLetter")]` `RunDeadLetter` on
  `%ServiceBusSettings:KnowledgeIngestQueueName%/$DeadLetterQueue`, `AutoCompleteMessages = false`; the nightly drain and
  `Voice:Knowledge:DeadLetterDrainMaxMessages` are deleted.
  - A death the ingest already alerted (`WasAnnounced`: own reason, `KnowledgeAlertPublished` not false) is removed.
  - Otherwise ONE alert with the body (dedupe `knowledge-dlq:{id}`); if it cannot be published the handler throws and the
    message stays. Then `FailDeadWorkAsync`: Delete ⇒ nothing; Analytics ⇒ `FailLostRunAsync`; else
    `FailDeadReadingAsync` marks only that reading Failed (checked inside the commit: `Processing` and
    `ProcessingSince` ≤ `ReadingEpoch`; MetadataOnly ⇒ exactly its own re-cut; epoch 0 names none) and tells the provider.
  - Handling failure: wait `Voice:Knowledge:DeadLetterRetryBaseSeconds` (30) × 2ⁿ, at most `DeadLetterRetryMaxSeconds`
    (240), then abandon with `KnowledgeDeadLetterAttempts`; at `MaxDeliveryCount` one last alert, `TryFailDeadWorkAtLastAsync`
    still tries the Failed stamp, then complete (B-M2).
- **Tests:** unit `Knowledge/KnowledgeIngestProcessorFunctionTests.{DeadLetter,PicturePasses,LongPages}.cs`,
  `Knowledge/Oversize/*`, `Knowledge/HeavyWorkGateTests`, `DocumentPageRasterizerTests`, `KnowledgeImageNormalizerTests`;
  integration `Tests/Functions/KnowledgeDeadLetterIntegrationTests`, `Tests/Functions/KnowledgePicturePassesIntegrationTests`,
  `Tests/Services/KnowledgeOversizeReadingIntegrationTests`.

---

## Voice number lifecycle (2026-10-02) → `clinqet-voice-number-lifecycle`

Two functions: `VoiceNumberLifecycleFunction` (hourly timer, `%VoiceNumbers:LifecycleSchedule%`, UseMonitor)
and `VoiceNumberOperationProcessorFunction` (queue `%ServiceBusSettings:VoiceNumberOperationsQueueName%`).
The worker never retries in place: the record says what was attempted, a failure abandons the message and the
hourly job reconciles. A redelivered "buy" for a request whose order went out asks the carrier about that
order and never places another. ‼️ No test or dev session may reach the carrier.

<!-- search-topology-phase5 -->
## Search-topology Phase 5 additions (2026-10-02)

- `SearchAlertReceiverFunction` — HTTP `POST monitoring/search-alerts` (AuthorizationLevel.Function). Turns Azure Monitor
  search alerts A1–A5 into admin alerts, but only after reading the alert back from Azure (D-128). See
  `clinqet-integration-health` "SEARCH MONITORING A1–A7".
- `SearchCapacityFunction` — timer `%Search:Capacity:TimerSchedule%` (05:30 UTC): A6/A7 space alerts. ‼️ The schedule is a
  binding setting: `deploy.ps1` writes it for both stamps and lists it in its required-settings check, because a
  missing `%…%` disables the function silently (2026-10-02: six dev functions were found disabled that way and fixed;
  record `Data/functions-settings-audit/`).
- `SearchIndexAuditFunction` compares each business against its OWN cell; wrong-cell copies are reported and removed
  only when the own cell is verified complete (D-125).
- Closure guard (D-113): `BusinessClosureLeavesNothingBehindIntegrationTests` + `ClosureTeardownCoversEverySearchIndexKindTests`
  run the real teardown over an in-memory Azure Search data plane (`Helpers/InMemorySearchService.cs`, strict: unknown
  request or filter ⇒ 400) — a new `SearchIndexKind` nothing deletes fails by name.
- The index swap's catch-up queues `ChangeFeedFailureMessage { ProcessorName = "SearchIndexSwap", DocumentType =
  "BusinessReindex" | "ProviderDocument" }` to `change-feed-failures` — replayed by `ChangeFeedFailureReplayFunction`.
