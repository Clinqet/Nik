---
name: clinqet-integration-health
description: |
  **CORE FEATURE SKILL** — Work on the integration health alerting layer: the one place that tells an
  admin a dependency has stopped serving us. 14 watched resources (AI Search, AI model, Email, SMS,
  WhatsApp, SQL, Cosmos, Storage, Service Bus, Push, SignalR, Payment gateway, Voice carrier, Geocoding),
  five failure kinds, one alert type per resource, and a POST-RETRY observation seam per transport so a
  blip that a retry cleared is structurally invisible rather than filtered out. Also covers email BOUNCE
  reporting (Azure Event Grid → per-stamp Service Bus queue → EmailDeliveryReportProcessor) and the
  per-stamp Azure Communication Services pair that makes it possible.
  USE FOR: adding a watched resource, adding an observer to a new transport or HTTP client, changing
  failure classification, touching AdminAlertSettings gates, the admin Alerts type list, the ACS/Event Grid
  ARM + deploy.ps1 wiring, or anything that could make an alert fire when nothing is wrong.
  Applies to clinqetinfrastructure/Services/Integration/, clinqetinfrastructure/Services/AI/,
  clinqetinfrastructure/Services/Search/AiSearchResourceLimitPolicy.cs, clinqetshared Enums/
  IntegrationResource.cs + IntegrationFailureKind.cs, clinqetcore Interfaces/Integration/,
  clinqetfuncations Functions/EmailDeliveryReportProcessor.cs, azureautomation communication.json +
  events.json + deploy.ps1, clinqetwebadmin src/pages/alerts/AlertsPage.jsx.
---

# CLINQET INTEGRATION HEALTH ALERTING — COMPREHENSIVE SKILL

Built 2026-09-19. Generalised from the earlier AI-only `AiResourceLimitAlerts`, which is **deleted** —
`IAiResourceLimitAlerts`, `AiResourceLimitAlerts`, `AiResourceLimitAlertSettings`, `AiResourceKind` and
`AiResourceLimitAlertExtensions` no longer exist. Do not reintroduce them.

---

## 0. THE ONE RULE

> **An alert fires only after every retry that transport owns is spent, or on a wall no retry can clear.**

A 503 that the next attempt cleared must never reach an admin. This is not achieved by filtering after the
fact — it is achieved by putting the observer **above** each transport's own retry, so a healed failure is
never seen at all. Every seam below was verified against the SDK source before it was used.

The second rule follows from the first: **an ordinary answer is not an incident.** Cosmos 404/409/412/413,
Storage 404/409/412/304, a SQL unique-index violation, a Stripe card decline, a WhatsApp 131047 closed
window, a Telnyx invalid-number refusal, an HTTP 400 — none of these ever alert.

---

## 1. THE PRIMITIVE

| File | Role |
|---|---|
| `clinqetshared/Enums/IntegrationResource.cs` | The 14 watched resources |
| `clinqetshared/Enums/IntegrationFailureKind.cs` | `RateLimited · QuotaExhausted · Timeout · Unavailable · Unauthorized` |
| `clinqetshared/Models/IntegrationFailureSignal.cs` | `readonly record struct` — scalars only, so a suppressed report allocates nothing |
| `clinqetcore/Interfaces/Integration/IIntegrationHealthAlerts.cs` | `void Report(IntegrationFailureSignal signal)` — the ONLY member |
| `clinqetinfrastructure/Services/Integration/IntegrationHealthAlerts.cs` | Singleton + `IHostedService` + `IDisposable`. Dedupe, cooldown, gates, background publish, flush on shutdown |
| `clinqetinfrastructure/Services/Integration/IntegrationFailureClassifier.cs` | `FromStatusCode`, `FromTransportException`, `ScopeOf(Uri)`, and the `ReportHttp` / `ReportTransport` / `ReportKind` extensions |
| `clinqetshared/Models/IntegrationHealthAlertSettings.cs` | `CooldownMinutes=15`, `PublishTimeoutSeconds=30`, `FailedPublishCooldownSeconds=30`, `MaxInspectionBytes=65536` |

### Things that will bite you

- **`Report` takes the signal by value, not `in`.** The `in` modifier was deliberately dropped so Moq can
  mock the interface. Do not add it back.
- **`ReportHttp` / `ReportTransport` / `ReportKind` / `ReportAi` are EXTENSION methods.** Moq cannot
  `Setup` or `Verify` an extension method — it throws `NotSupportedException` at runtime, not compile time.
  Assert against `Report(It.Is<IntegrationFailureSignal>(...))`, or use
  `Clinqet.API.UnitTests.Helpers.HealthAlertMockExtensions` (`VerifyAi` / `SetupAi`).
- **The dedupe key is `(Resource, Scope, Kind)`.** A rate limit and an outage on the same host are two
  incidents with two cooldowns. Any test that reports 429 then 503 and expects one alert is wrong.
- **`ScopeOf` keeps the host (and non-default port) and NOTHING else.** Paths and queries carry document
  ids, phone numbers, prompts and `sig=` tokens, and the scope is stored on the alert for 90 days.
- **The `EventId` is deterministic**: `DeterministicGuid.Create(alertType, scope, kind, windowBucket)`.
  It becomes the Cosmos document id, which is what actually dedupes across processes — the `admin-alerts`
  queue has `requiresDuplicateDetection: false`, so `MessageId` alone dedupes nothing.
- **Background publish runs under `ExecutionContext.SuppressFlow()`** so the caller's request context and
  cancellation never reach it.

---

## 2. THE OBSERVATION SEAMS — verified, not assumed

| Transport | Seam | Why it is above the retry |
|---|---|---|
| Cosmos | `CosmosClientOptions.CustomHandlers` (`CosmosHealthHandler`) | `ClientPipelineBuilder.Build()` composes custom handlers above `RetryHandler` |
| Azure.Core (AI Search, Blob) | `HttpPipelinePosition.PerCall` | `HttpPipelineBuilder.BuildInternal()` puts PerCall above `RetryPolicy`; `ResponseBodyPolicy` sits below both, so the body is already buffered |
| SQL / EF Core | `ClinqetSqlExecutionStrategy : SqlServerRetryingExecutionStrategy` | EF routes queries, `SaveChanges` and `ExecuteSql*` through the execution strategy — one class is the whole SQL surface of a host |
| `IHttpClientFactory` | `IntegrationHttpHealthHandler`, registered **before** `AddPolicyHandler` | The first handler added is the outermost |
| Stripe | `StripeHealthObservingHttpClient : Stripe.IHttpClient` | Wraps `SystemNetHttpClient`, so it sees the outcome after `MaxNetworkRetries` |
| ACS email, Telnyx, 2Factor, Meta, Razorpay, ANH, SignalR | In-service, at the point where the service's own retry loop gives up | Their walls live in the BODY, which a status-only handler cannot read |

‼️ **`PerRetry` composes BELOW the retry policy.** One word turns the whole guarantee inside out.
`AzureCorePolicies_AreRegisteredPerCall_NotPerRetry` fails the build if anyone changes it.

---

## 3. PROVIDER FACTS THAT ARE NOT WHAT YOU EXPECT

Read this before classifying anything. Every line was taken from the provider's own reference.

- **Azure Storage does not throttle with 429.** It answers **`503 ServerBusy`**, and its
  **`OperationTimedOut` is a 500**. Classify on the `x-ms-error-code` header first.
- **Cosmos uses 403 for two unrelated things.** Sub-status **1003** is a storage quota a human must raise;
  every other 403 is authorization. Sub-status arrives in the `x-ms-substatus` header.
- **2Factor answers HTTP 200 with `{"Status":"Error","Details":"..."}`.** There are no numeric codes and no
  documented rate limit — the walls are account state and credit, matched on `Details` markers.
- **Telnyx puts capacity, spend and account walls in a numeric body code** (`10011`, `40011`, `40333`,
  `40312`, …) on 2xx *and* 4xx responses.
- **Meta documents no HTTP status per error code.** A throughput wall (`130429`, `80007`) usually arrives
  on a **400**. The body code has to win over the status.
- **Azure SQL has no typed exception for pool exhaustion** and no error number — the only signal is the
  phrase `obtaining a connection from the pool` in an `InvalidOperationException`.
- **`ServiceBusFailureReason` has no `Unauthorized` member.** An AMQP credential rejection surfaces as
  `UnauthorizedAccessException`, so the exception TYPE is the only signal.
- **Stripe's 402 is a card decline**, not a quota. It is excluded from payment-gateway health on purpose
  and left to the billing alerts that own it.
- **Azure AI Search returns 402** for a quota wall, which no other resource here does.
- **ACS email never answers a status lookup for an operation id it never issued** — the request hangs until
  the caller gives up (measured 2026-10-02 with a valid token; without one it answers 401 at once). `AcsEmailAuthHealthCheck` therefore
  probes with a send ACS must refuse: sender and recipient on the RFC 2606 `.invalid` domain. Bad credentials
  answer **401**; good ones answer **404 `DomainNotLinked`**, which is the only Healthy outcome. The SDK refuses
  an empty sender client-side, so an "invalid body" probe never reaches ACS.

---

## 4. ALERT TYPES, GATES AND SEVERITY

- One `AdminAlertType` per resource, named **exactly** `{Resource}ResourceLimit`.
  `EveryResource_MapsToItsOwnNameSuffixedAlertType` fails the build if a new resource is wired to an
  existing type.
- One `AdminAlertSettings` gate per resource, named **exactly** `Enable{Resource}ResourceLimitAlerts`,
  defaulting `true` — a host that never binds the section must still alert.
- Plus `EmailSendFailure` (could not hand it to ACS at all) and `EmailDeliveryFailure` (ACS's later verdict
  on one it accepted), with `EnableEmailSendFailureAlerts` / `EnableEmailDeliveryFailureAlerts`.
- Severity is `High` or `Critical`, never `Low` or `Medium` — a failure that survived every retry is never
  minor. A store the whole platform reads through is `Critical`; so is any `Unauthorized` or
  `QuotaExhausted`, because no retry anywhere will clear it.
- **Every type must also be listed in `clinqetwebadmin/src/pages/alerts/AlertsPage.jsx`** (`alertTypes`), or
  it cannot be filtered and is invisible to whoever is on call. `AlertsPage.test.js` guards all 16.

### Adding a 15th resource — the whole checklist

1. `IntegrationResource` value.
2. `AdminAlertType.{Name}ResourceLimit`.
3. `AdminAlertSettings.Enable{Name}ResourceLimitAlerts = true`, and the same key in **all four**
   `appsettings.json` (API, Identity, MCP, Functions).
4. An arm in `AlertTypeFor`, `GateFor`, `LabelFor`, and a `High`/`Critical` answer from `SeverityFor`.
5. The observer, at the post-retry seam for that transport.
6. `alertTypes` in the admin app + the list in `AlertsPage.test.js`.
7. Tests in the suite of the **runtime consumer** (CLAUDE.md §0.18), not wherever the class happens to live.

---

## 5. EMAIL BOUNCE REPORTING

A send call returns once ACS has **accepted** the message. A bounce is the only evidence the person never
received it, and it arrives minutes later.

```
ACS (per stamp) → Event Grid system topic (per stamp) → event subscription filtered to failure statuses
                → Service Bus queue email-delivery-failures{-env} (that stamp's namespace)
                → EmailDeliveryReportProcessor → FailureNotificationHelper.HandleEmailDeliveryFailureAsync
```

- The seven possible `status` values are **`Delivered`, `Expanded`, `Bounced`, `Suppressed`, `Quarantined`,
  `FilteredSpam`, `Failed`**. The subscription pulls the last five. `Delivered` is a success;
  **`Expanded`** means a distribution-group recipient was expanded before delivery to the individual
  members — informational, not terminal, and each real member produces its own later report.
- `Quarantined` and `FilteredSpam` are **Critical**: they are sender-reputation signals that affect ALL
  Clinket email, not one message.
- The processor also ignores non-failure statuses in code, because a portal filter can be widened by hand.
- The alert `EventId` is `DeterministicGuid.Create("EmailDeliveryFailure", acsMessageId, status)` — an
  Event Grid redelivery cannot duplicate, but a LATER different verdict on the same message still gets its
  own alert.
- The queue is **externally produced**: Event Grid writes it, no host sends to it. It is therefore the one
  exemption in `ServiceBusServiceSenderRegistrationTests`.

### The per-stamp ACS architecture

A delivery report carries nothing that says which stamp sent the mail, and an Event Grid system topic can
only hang off a Communication Service. One global ACS therefore made **every bounce a Canada bounce**.

Each stamp now owns its own Email Communication Service **and** its own Communication Service. The same
verified domain is provisioned on both — proven against live Azure on 2026-09-19: a second copy gets its
own TXT token, both coexist in the zone, and Domain/SPF/DKIM/DKIM2 all verify. The From address is
identical on every stamp. **Cost is unchanged**: ACS bills per message sent, not per resource, and both
Communication Services and Email Communication Services are free to create.

`deploy.ps1` PHASE 2d runs **per stamp**. PHASE 3c walks `$script:AcsStamps` for DNS + verification +
linking. PHASE 4 writes a stamp's own endpoint and connection string **only once that stamp's domain is
both Verified and Linked** — until then it falls back to the operator-supplied values, so a half-provisioned
stamp never silently stops sending mail.

---

## 6. RESOURCE NAMING — the rule and why

Every regional resource is `{prefix}-{what it is}-{stamp}-{shared suffix}`. **The stamp and env label come
last, always.**

| Thing | Name |
|---|---|
| Communication Service | `clinket-communication-{stamp}-{shared}` |
| Email Communication Service | `clinket-communication-email-{stamp}-{shared}` |
| Event Grid system topic | `clinket-communication-events-{stamp}-{shared}` |
| Event Grid subscription | `email-delivery-failures` |
| Service Bus queue | `email-delivery-failures{-env}` |

‼️ The topic must **not** extend the email service's name. `…-email` and `…-email-events` differ only by a
suffix, so any `startswith` match — a script, a portal filter, a tired human — conflates two resources.

‼️ Queues are named by **domain function**, never by vendor. There is no `acs-*`, `azure-*`, `stripe-*` or
`telnyx-*` queue among the 44; do not add the first one.

The three ACS names are built **outside** the prefix/suffix branch in `Initialize-StampContext`, so the name
shape cannot depend on whether a prefix was supplied.

---

## 7. WHERE THE TESTS LIVE

Per CLAUDE.md §0.18, a library class is tested from the suite of the **host that invokes it at runtime**.

| Subject | Suite |
|---|---|
| Classifier, HTTP handler, Cosmos/SQL/Storage classification, Stripe decorator, carrier code tables, Service Bus send-failure alert, WhatsApp service reporting | `Clinqet.API.UnitTests/Services/Integration/`, `/Services/Communication/`, `/WhatsApp/` |
| The publisher itself, AI lane | `Clinqet.API.UnitTests/Services/AI/` |
| ACS email service reporting | `Clinqet.Identity.UnitTests/Services/AcsEmailHealthReportingTests.cs` |
| Bounce processor, email-processor alerting, ANH push | `Clinqet.Communications.UnitTests/Functions/` |
| Realtime socket handshake | `Clinqet.Mcp.IntegrationTests` |

Convention guards (`IntegrationHealthCoverageTests`) exist **once per host repo** with that host's own
exemption registry, and each scans only its own repo plus `clinqetinfrastructure`, which it compiles in.
Never add a peer-repo checkout to make a scan run (§0.15/§0.17).

`SqlExceptionFactory` (API.UnitTests/Helpers) builds a real `SqlException` by **discovering** SqlClient's
non-public members rather than hardcoding them, so a signature change fails loudly instead of silently
classifying nothing.

---

## 8. DEFECTS THIS PROGRAMME FOUND AND FIXED

| # | Defect |
|---|---|
| F1 | `AiSearchClientFactory` registered its policy `PerRetry` — it saw attempts, not outcomes, and would alert on failures the SDK healed |
| F2 | `EmailNotificationProcessorFunction`'s generic catch alerted on **every** delivery attempt, not just the last |
| F3 | Its alert descriptions embedded the attempt count and the exception text, so one fault produced a different sentence each time and could never be recognised as one incident |
| F4 | `TwoFactorSmsService`'s OTP path bypassed the Polly policy and never checked the HTTP status |
| F5 | `TelnyxSmsService` and `TelnyxCallControlService` did not treat 502/504 as retryable |
| F6 | Our own hourly email/SMS caps dropped a message with nothing but a log line — an MFA code or reset link simply vanished |
| F7 | `AiSearchResourceLimitPolicy` short-circuited on any classifiable status, so a 5xx never had its structured error code read, unlike every other provider |
| F8 | A 401 handshake rejection on the realtime socket was pinned by a test as "no alert" — a rejected key must always alert |
| F9 | `LabelFor` coverage could not be proven at runtime (the label equals the enum name for Email, Cosmos, SignalR, …) — the guard now reads the switch source |

---

## 9. RUNNING VERIFICATION

`C:\Nik\Data\integration-health-alerts\Verify-AcsPerStampEmail.ps1` — ASCII-only, syntax-checked, safe to
run against a live subscription. Steps: `check` (read-only), `probe`, `link`, `prove` (full end-to-end
including the DNS TXT merge and a real send), `cost`, `spend`, `cleanup` (removes only probe-suffixed
resources and the one TXT value it added).

The authority document for the whole programme is `C:\Nik\Data\integration-health-alerts\PLAN.md`.

---

## 10. COST-LIMIT ALERT TYPES AND THE LOST-MESSAGE EXEMPTION (post-ranking follow-ups, 2026-09-29…10-01)

Not dependency failures — per-file cost limits — but each level has its OWN `AdminAlertType`, raised through
`IPlatformLimitAlerts.ReportFileLimitAsync(type, warningOnly, limitName, dial, …)` (a warning withholds nothing), and
listed in `clinqetwebadmin/src/pages/alerts/AlertsPage.jsx` and `clinqetmobileadminapp/src/services/alertTypes.ts`
(parity tests against the enum).

| Types | Dial (`Voice:Knowledge:…`) |
|---|---|
| `KnowledgePicturesWarning` / `KnowledgePicturesLimit` | `Images:ImagesAlertPerDocument` (150) / `Images:MaxImagesPerDocument` (300) |
| `KnowledgePictureTextWarning` / `KnowledgePictureTextLimit` | `Images:TranscribedPicturesAlertPerDocument` (25) / `Images:MaxTranscribedPictures` (50) |
| `KnowledgePictureListFull` | `Images:MaxRegistryBytes` (1,000,000) |
| `KnowledgePicturesLeftOutSpaceFull` | the business's searchable space (entitlement) |
| `KnowledgePicturePassesExhausted` | `Images:PicturesPerPass`, `Images:PicturePassSeconds` |
| `KnowledgeNearDuplicatesWarning` / `KnowledgeNearDuplicatesLimit` | `Images:NearDuplicateComparisonsWarning` (150) / `Images:NearDuplicateMaxComparisons` (200) |
| `KnowledgeLongPagesWarning` / `KnowledgeLongPageLimit` / `KnowledgeLongPagesFileLimit` | `Oversize:SectionReadsAlertPerDocument` (200) / `Oversize:MaxSectionsPerPage` (24) / `Oversize:MaxSectionReadsPerDocument` (400) |
| `ProviderSetupLongPagesWarning` / `ProviderSetupLongPageLimit` / `ProviderSetupLongPagesFileLimit` | the same three, for a provider-setup upload (`VisionDocumentTranscriptionService.LongPageAlerts`) |

- Also added by the same programme, owned by their feature skills: `ProviderScoreSafetyNetWarning` / `…Limit`,
  `ProviderScoreConversationsWarning` / `…Limit`, `ProviderScoreBookingsWarning` / `…Limit`, `InsightsLeadEventsWarning` /
  `…Limit`, `InsightsInquiriesWarning` / `…Limit`.
- **`IRecoveredWhenLost`** (clinqetshared `DTOs/Messages/IRecoveredWhenLost.cs`): a message the platform re-creates on its
  own. `ServiceBusService.CreateLostMessageAlertAsync` returns before raising `NotificationSendFailed` for such a payload —
  an admin has nothing to deliver by hand — while the Service Bus queue-health alert still fires. Implemented by
  `ProviderScoreRefreshMessage` (audit D-M2).

<!-- search-topology-phase5 -->
## ‼️ SEARCH MONITORING A1–A7 (search-topology Phase 5, 2026-10-02)

Authority D-114…D-118, D-126, D-128; operator meaning/action per alert: `cosmosindexsetup/RUNBOOK.md` "Alerts A1–A7".
- **A1** `SearchRequestsRefused` (Critical) — metric alert `ThrottledSearchQueriesPercentage` > 0 per search service.
- **A2** `SearchSlowPhoneAssistant` / **A3** `SearchSlowAskClinket` / **A4** `SearchSlowMarketplace` (High) — log alerts,
  every 5 min over 15 min, p95 of `AppDependencies` search calls (MCP private / API private / API CUSTOMER public
  searches joined to `AppRequests` on `OperationId`; background scans excluded, D-126), minimum 50 samples.
- **A5** `AskClinketFirstWordsSlow` (High) — p95 of the `clinket.first_word_ms` tag on the Ask Clinket request > 15 s,
  ≥ 20 answers.
- **A6/A7** `SearchSpaceWarning` (High) / `SearchSpaceCritical` (Critical) — daily Functions timer
  `Search:Capacity:TimerSchedule` (05:30 UTC): storage, vector, index count, synonym maps at ≥ 70 % / ≥ 85 % of quota
  (`Search:Capacity:WarningPercent`/`CriticalPercent`); a failed statistics read raises nothing; one per counter per day.
- **Receiver (D-128 — no loophole):** `POST /api/monitoring/search-alerts`, function key in Key Vault; trusts only the
  alert id, READS THE ALERT BACK from Azure Monitor with the Functions managed identity (a custom role holding only
  `Microsoft.AlertsManagement/alerts/read`, `search-alert-reader-role.json`), forwards only our known rules — Fired OR
  already Resolved (D-131: "resolved at …" in the description); admin alert id derived from Azure's alert id (Fired +
  Resolved deliveries = ONE admin alert); unknown rule ⇒ 200; not found after the re-check, a transient read failure or a
  host shutdown ⇒ 503 (Azure retries); a denied scope or invalid settings ⇒ 500 + Error. Settings validated per call,
  never at host start (a bad value must not stop 90 functions). The stamp WAF rate-limits the route before its allow.
- Gates: `AdminAlertSettings:EnableSearchMonitoringAlerts` (A1–A5) and `EnableSearchSpaceAlerts` (A6/A7). A NEW
  per-stamp action group carries the webhook; the shared `clinket-alerts-{env}` group is unchanged.
- `SearchIndexSwapStopped` is raised by the `cosmosindexsetup` swap tool, gated by its own `Search:Swap:AdminAlertsEnabled`
  (‼️ never a field on the shared `AdminAlertSettings` — every host's settings guard rejects a gate no host reads).
- Thresholds (D-130): A2 phone and A3 Ask Clinket 2,000 ms (dev p95 ~700–1,000 ms), A4 500 ms, A5 15 s; a window is
  judged only with `Samples >= N and Rows >= N`. Cost ≈ $12.20/env (D-132). One search service per stamp: `deploy.ps1`
  throws if the hosts' endpoints name two (Phase 6 B adds that).
