# Integration health alerts — authority document

Started 2026-09-18. **This file is the authority.** A phase prompt, a finding file or a code comment that
disagrees with it is wrong.

**Goal.** Every integration Clinket depends on raises an admin alert when it is genuinely in trouble — and
stays silent when a retry healed it. One observer per host at each transport boundary, positioned **above**
that transport's own retry, so "retried and succeeded" is structurally invisible rather than filtered after
the fact.

---

## 0. Owner decisions — CONFIRMED in conversation

| # | Decision | Status |
|---|---|---|
| D1 | Build the ACS email-bounce path via Event Grid → Service Bus → function | **CONFIRMED** |
| D2 | Scope is **all 14** integrations in §2, not just email/SMS/WhatsApp/SQL/Cosmos/Blob | **CONFIRMED** |
| D3 | Every new alert type registered in the admin app (`AlertsPage.jsx`) | **CONFIRMED** |
| D4 | Re-verify AI Search + AI model coverage and fix what is found | **CONFIRMED** |
| D5 | **401 and 5xx must alert** on every provider, not only rate limits | **CONFIRMED** |
| D6 | Golden line: no false positives. A failure a retry healed must not alert | **CONFIRMED** |
| D7 | Per-stamp email bounce routing via a **second ACS + Email Communication Service for India**, same `noreply@` address — NOT a second sender address | **CONFIRMED** |
| D8 | India pair's Data Location = **India** (data-residency improvement), contingent on V2 | **CONFIRMED** |
| D9 | **Generalise** the shipped AI primitive into one shared `IIntegrationHealthAlerts` covering all 14 | **CONFIRMED** |
| D10 | 12 new `<Integration>ResourceLimit` types + `EmailSendFailure` + `EmailDeliveryFailure`; kind in the title and in `FailureKind` metadata; severity per §4 | **CONFIRMED** |
| D11 | Never assume — ask the owner. Nothing ships unverified | **STANDING** |
| D12 | Every defect in §6 is part of this change. Nothing deferred | **CONFIRMED** |
| D13 | End with a full multidimensional audit: not a test run — code quality, bugs, gaps, flow gaps, end to end | **CONFIRMED** |

### Verification — ALL THREE PASSED against real Azure (sandbox, 2026-09-19)

Run with `Data\integration-health-alerts\Verify-AcsPerStampEmail.ps1`, subscription
`bf81c75c-4e72-41f7-9a49-4cb5f5588829`, resource group `communication`, domain `dev.clinket.com`.

| # | Question | Result | Evidence |
|---|---|---|---|
| V1 | Same custom domain in a SECOND Email Communication Service, with its own TXT? | **PASS** | domain PUT → HTTP 201; probe token `775e9a22-5cab-45cc-80d3-aeac79bb1119` vs live `6134be9c-19c3-4ec7-a041-24374280d62f` — different values, same DNS name |
| V2 | `India` accepted as an Email Communication Service Data Location? | **PASS** | emailServices PUT → HTTP 201, provisioned with `dataLocation India` |
| V3 | Topic type `Microsoft.Communication.CommunicationServices` available? | **PASS** | listed, `provisioningState Succeeded`, publishes `Microsoft.Communication.EmailDeliveryReportReceived`; `sourceResourceFormat` = `.../Microsoft.Communication/communicationservices/<name>` |

**Two facts the probe settled that change the DNS work:**

- The probe's SPF and DKIM records are **byte-identical** to the live ones
  (`v=spf1 include:spf.protection.outlook.com -all`; `selector1/2-azurecomm-prod-net._domainkey` CNAMEs).
  **The only new DNS record is one additional `ms-domain-verification=` TXT value** at the mail domain.
  `deploy.ps1` already merges a second value into an existing TXT record set rather than replacing it.
- The live domain runs `userEngagementTracking: Enabled`; the probe used `Disabled`. The real India domain
  is created **Enabled**, to match.

### ‼️ PROVEN END TO END ON LIVE AZURE — `-Step prove`, 2026-09-19

Not a prediction. The full chain was executed against the dev stamp:

| Stage | Result |
|---|---|
| Second Email Communication Service, `dataLocation India` | created, Succeeded |
| `dev.clinket.com` provisioned a SECOND time on it | own token `b1ed6e94-2f58-4a93-86e9-1c7c73c312fa`, distinct from the live `6134be9c-…` |
| The token added to the existing TXT record set in Azure DNS | **2 values → 3, every pre-existing value intact** |
| Domain / SPF / DKIM / DKIM2 on the second copy | **all four Verified** — it verified against the SAME SPF and DKIM records already in the zone |
| `noreply@dev.clinket.com` sender username on the second copy | created |
| India Communication Service | provisioned, `linkedDomains: dev.clinket.com` |
| **A real email sent FROM the India resource** | **HTTP 202**, operation `c09d5784-5379-42d5-99f8-037e64bc3404`, endpoint `…-inprobe.india.communication.azure.com` |

One domain, two Email Communication Services, both verified, both linked, one identical `noreply@` address,
and the second resource sending. The probe resources and the added TXT value were then removed by
`-Step cleanup`.

### Cost — no additional spend, and why

| Added per extra stamp | Meter | Extra |
|---|---|---|
| Email Communication Service + Communication Service | ACS bills **only** $0.00025/email + $0.00012/MB; no SKU, tier or hourly meter | **$0** — same emails, split across two resources |
| Event Grid system topic + subscription | Basic tier: **$0.60/M operations, first 100,000 free per Azure subscription**. ~2 ops/email. Two topics carry the same total events; the allowance is per subscription, not per topic | **$0** below ~50,000 emails/month |
| Service Bus queue | Standard namespace already paid; queue count free, operations inside the included 12.5M/month | **$0** |
| Function execution | only on a FAILED email — Delivered and Expanded never leave Event Grid | ~**$0** |

Confirmed from Azure's own Retail Prices API (`-Step cost`): `Standard Operations 100K from 0 = 0`, then
`from 1 = 0.06`, i.e. 100K free then $0.60/M. The `Standard Throughput Unit` hourly meter belongs to Event
Grid **Namespaces** (standard tier); a system topic pushing to a Service Bus queue is **basic** tier, which
Microsoft's tier comparison shows has no throughput units. **ACS is not published in the Retail Prices API
at all** — that absence is not evidence of being free, which is why `-Step spend` reads the real invoice.

### ‼️ D14 — per-stamp configuration is part of this change, not a follow-up

ACS is deployed **once, on the primary stamp** today, and `$AcsConnectionString` / `$AcsEndpoint` are written
identically into every stamp's app settings. With a second ACS stack this becomes wrong. Required in the same
change:

| Surface | Requirement |
|---|---|
| `communication.json` | parameterised so the per-stamp Email + Communication Service pair is deployable, with the stamp's own `dataLocation` |
| `deploy.ps1` PHASE 2d | move ACS out of the "primary stamp only" branch: each stamp deploys **its own** ECS + CS, provisions the domain on it, merges **its own** TXT into the zone, initiates verification, creates its sender usernames and links its own domain |
| `deploy.ps1` app settings | `AzureCommunicationServices__ConnectionString` / `__Endpoint` become **per stamp**; `__FromAddress` stays identical on both. Every host that sends email (API, Identity, MCP, Functions) gets its own stamp's values |
| `events.json` | one `acs-email-events{suffix}` queue **per stamp's** Service Bus namespace |
| Event Grid | one system topic + one subscription **per stamp**, each pointing at that stamp's queue |
| `ServiceBusSettings` | new `AcsEmailEventsQueueName`, in the shared queue-name list every host reads, and guarded by the existing deploy.ps1 queue-name check |
| Deploy summary | the end-of-run output prints each stamp's ACS resource, data location, domain verification state and event-subscription destination — a stamp whose bounce path is not wired must be visible, not silent |

## 0.1 Gates

| Gate | Status |
|---|---|
| §0.7 SQL schema | No table, column, index or type change. **Not triggered** |
| §0.7 Cosmos schema | New `AdminAlertType` **enum values** only. `alertType` and `metadata` are existing fields on `AdminAlert`. No new field, container, partition key, index path or TTL. **Not triggered** |
| §0.7 Search | No index field, analyzer or scoring-profile change. **Not triggered** |
| §0.7.1 new Azure resource | **Triggered, APPROVED (D1/D7)**: 2 Event Grid system topics, 2 event subscriptions, 1 Service Bus queue per stamp, 1 Email Communication Service + 1 Communication Service for India. ARM + `deploy.ps1` in the same change |
| §0.7.1 mockup gate | **Not triggered.** New rows in the existing `ALERT_TYPES` registry feeding an existing filter and an existing details panel — no new page or interface |
| §0.10 localization | **Exempt.** Admin alert wording is admin-internal English (§3.6) |
| §4 local.settings.json | Only `appsettings.json` keys, except the new queue name — an existing-shape `ServiceBusSettings` entry, so ARM + `deploy.ps1` |

---

## 1. The false-positive rule — verified seams

An observer reports only what its transport could not fix.

| Integration | Who retries | Observation seam | Verified by |
|---|---|---|---|
| Cosmos | SDK `RetryHandler`, 9 throttle retries | `CosmosClientOptions.CustomHandlers` | `ClientPipelineBuilder.Build()` — custom handlers compose **above** `RetryHandler` |
| Blob, AI Search | `Azure.Core` `RetryPolicy` | `HttpPipelinePosition.PerCall` | `HttpPipelineBuilder.BuildInternal()` — per-call precedes `RetryPolicy`; `ResponseBodyPolicy` sits below both, so the body is buffered when a per-call policy unwinds |
| SQL | `SqlServerRetryingExecutionStrategy` | subclass overriding `Execute`/`ExecuteAsync`, catching `RetryLimitExceededException` | EF Core 10 `ExecutionStrategy` public virtual surface; EF routes queries, `SaveChanges` and `ExecuteSql*` through the strategy |
| ACS email | in-service `ExecuteWithRetryAsync` | the exhaustion point | source |
| Telnyx / 2Factor / Meta | in-service Polly | the Polly exhaustion point | source |
| Stripe | `Stripe.net` internal `MaxNetworkRetries` | `catch (StripeException)` at the gateway boundary | the SDK raises only after its own retries |
| Razorpay | named client + Polly | `RazorpayApiException` at the gateway boundary | source |
| Service Bus, ANH, SignalR, voice carriers, geocoding | in-service | their exhaustion point | source |

**Walls no retry can clear are reported on first sight** — expired credentials, a zero SMS balance, a spend
limit, a restricted WhatsApp account. Waiting for a retry to fail there only delays the alert.

---

## 2. Coverage matrix

| Resource | Hosts | Detected |
|---|---|---|
| `Email` (ACS) | Identity, MCP, Functions | 429 throttle, 401/403, 5xx after retries, timeouts, our own hourly rate-limit drop, ACS operation failure |
| `Sms` (Telnyx) | API, Identity, MCP, Functions | `10011`, `40318` queue full, `40333` spend limit, `40011`/`40016`/`40018` carrier throughput, 401/403, 5xx + timeout after Polly |
| `Sms` (2Factor) | API, Identity, MCP, Functions | `Balance is too low`, `Account Disabled`, `Account Expired`, `Invalid API Key`, sender not approved, 5xx + timeout |
| `WhatsApp` (Meta) | Identity, MCP, Functions | `4`, `80007`, `130429`, `131048`, `133016` throughput/rate walls; `368` restricted; `190` token expired; `2`/`131016`/`131000` capacity; 5xx + timeout after Polly |
| `Sql` | API, Identity, Functions | post-retry `RetryLimitExceededException`, connection-pool exhaustion, socket/transport errors, command timeout, Azure SQL governance errors |
| `Cosmos` | API, Identity, MCP, Functions | 429/503/408/449 **after** the SDK's retries, with substatus |
| `BlobStorage` | API, Identity, Functions | `ServerBusy` (503), `OperationTimedOut` (500), `InternalError` (500), 403, timeouts — after Azure.Core retries |
| `ServiceBus` | all four | send failures after retries |
| `Push` (ANH) | API, Identity, Functions | throttling, auth, 5xx, timeouts |
| `SignalR` | API, Functions | throttling, auth, 5xx, timeouts |
| `PaymentGateway` | API, Functions | Stripe `rate_limit_error` / `api_error` / `api_connection_error` / `authentication_error` / `permission_error`; Razorpay 429/5xx/401/403 |
| `VoiceCarrier` | API, MCP, Functions | Telnyx Call Control + Plivo: 429, 5xx, 401/403, timeouts |
| `Geocoding` | API, Functions | 429, 5xx, 401/403, timeouts |
| `AiSearch`, `AiModel` | API, MCP, Functions | existing, plus the per-retry → per-call correction and 401/5xx |

### Provider facts that contradict the obvious assumption

Researched, not assumed — this is why §0.2 required the reading.

- **Blob** throttling is **503 `ServerBusy`**, not 429. `OperationTimedOut` is **500**, not 408.
- **Meta** documents **no HTTP status per error code**. `130429` arrives in the body, usually on a 400.
- **2Factor** returns **HTTP 200** with `{"Status":"Error","Details":"Access Denied - Balance is too low"}`.
- **Telnyx** capacity is spread across body error codes, not statuses.
- **Azure SQL** throttling is `10928`/`10929`/`10936`/`40501`/`49918`–`49920`; pool exhaustion is an
  `InvalidOperationException` EF does **not** retry, with no error number and no typed exception.
- **Cosmos** documents 1–5% 429 as healthy, so only post-retry 429 may alert.
- **Stripe** classifies by `StripeError.Type`, not status.
- **ACS email** throttles with **429 + Retry-After**; bounces never appear in the send call at all.

---

## 3. Shape

```
IntegrationResource      enum  AiSearch AiModel Email Sms WhatsApp Sql Cosmos BlobStorage
                               ServiceBus Push SignalR PaymentGateway VoiceCarrier Geocoding
IntegrationFailureKind   enum  RateLimited QuotaExhausted Timeout Unavailable Unauthorized
IntegrationFailureSignal readonly record struct (Resource, Scope, Kind, StatusCode, ErrorCode,
                                                 Operation, Sample)
IIntegrationHealthAlerts        void Report(in IntegrationFailureSignal)
IntegrationHealthAlerts         the singleton + IHostedService, generalized from AiResourceLimitAlerts
```

- **Dedupe key** `(Resource, Scope, Kind)`. `Scope` is low cardinality and never secret: database name,
  `database/container`, carrier name, gateway name, ACS host, WhatsApp phone-number id, storage host.
- **Cooldown** `IntegrationHealthAlerts:CooldownMinutes`, default 15.
- **Cross-process dedupe** is the deterministic, cooldown-window-bucketed `EventId`, which becomes the
  Cosmos document id; the processor treats the 409 as "already persisted". ‼️ `admin-alerts` has
  `requiresDuplicateDetection: false`, so a `MessageId` alone would dedupe **nothing**.
- **Scalars only** in the signal: the suppressed path must not allocate.
- `Sample` is one already-safe affected identity from the **first admitted report in the window**, labelled
  `AffectedSample` so nobody reads it as the only affected recipient.

### Two layers, kept separate

| Layer | Purpose | Cardinality |
|---|---|---|
| Resource health (new) | the dependency itself is in trouble | one per resource per kind per cooldown; identity-free |
| Delivery failure (exists) | one message to one person is permanently lost | one per lost message; carries the recipient |

Existing per-recipient alerts are unchanged, so nothing is lost.

---

## 4. Alert types and severity — CONFIRMED

Twelve new resource-health types, matching the shipped `AiSearchResourceLimit` / `AiModelResourceLimit`
naming so all fourteen group together in the admin filter. The precise nature lives in the title and in the
`FailureKind` metadata, exactly as the shipped pair already does for timeouts.

`EmailResourceLimit` · `SmsResourceLimit` · `WhatsAppResourceLimit` · `SqlResourceLimit` ·
`CosmosResourceLimit` · `StorageResourceLimit` · `ServiceBusResourceLimit` · `PushResourceLimit` ·
`SignalRResourceLimit` · `PaymentGatewayResourceLimit` · `VoiceCarrierResourceLimit` ·
`GeocodingResourceLimit`

Delivery types: `EmailSendFailure` (replaces the generic `SystemError` on the email path, peer of
`SmsSendFailure`) and `EmailDeliveryFailure` (Event Grid bounce / suppressed / quarantined / spam / failed,
peer of `SmsDeliveryFailure`).

| Kind | Severity | Title reads |
|---|---|---|
| `Unauthorized` | **Critical** | "SQL rejected our credentials: clinqetdb" |
| `QuotaExhausted` | **Critical** | "SMS quota is exhausted: 2factor.in" |
| `Unavailable` | **Critical** for Sql/Cosmos, **High** elsewhere | "Cosmos is unavailable: ClinqetDb/ProviderData" |
| `RateLimited` | **High** | "Email is rate limited: …communication.azure.com" |
| `Timeout` | **High** | "Blob storage timed out: …blob.core.windows.net" |

---

## 5. Email bounce path (D1/D7/D8)

ACS delivery reports carry only sender, recipient, messageId, status, statusMessage and timestamp — nothing
that names the sending stamp. With one global ACS there is no documented way to split them, so each stamp
gets its **own** ACS stack and its own event stream, keeping one `noreply@` address.

```
per stamp:
  Microsoft.Communication/emailServices/<name>          dataLocation: CA = United States, IN = India
    └─ domains/<apex>                                    CustomerManaged, its own TXT verification record
  Microsoft.Communication/communicationServices/<name>   linkedDomains: [that domain]
    └─ Microsoft.EventGrid/systemTopics                  location global,
                                                         topicType Microsoft.Communication.CommunicationServices
         └─ eventSubscription
              includedEventTypes: [Microsoft.Communication.EmailDeliveryReportReceived]
              advancedFilters:    data.status StringIn
                                  [Bounced Suppressed Quarantined FilteredSpam Failed]
              destination:        ServiceBusQueue → acs-email-events{suffix}  (that stamp's namespace)
         └─ Functions: EmailDeliveryReportProcessor → EmailDeliveryFailure admin alert (that stamp's Cosmos)
```

`Delivered` and `Expanded` never leave Event Grid: no queue message, no function execution.
(`Expanded` = the address was a distribution group and ACS expanded it into its members; informational.)

**Cost, from the Microsoft sources.** ACS Email is **$0.00025/email + $0.00012/MB with no standing resource
charge**, so two resources sending the same total volume cost exactly what one does. Event Grid Basic is
**$0.60 per million operations, first 100,000 free per Azure subscription**; two topics carry the same total
events, not double. The extra queue fits inside the Service Bus Standard tier's included 12.5M operations.
**Net added Azure spend: effectively zero.**

**Known limit:** ACS email rate limits are **per Azure subscription**, not per resource (30/min, 100/hr on a
custom domain by default). Splitting does not double throughput. Worth raising through support before launch
regardless of this work.

---

## 6. Defects being fixed — ALL of them, in this change (D12)

| # | Defect | Fix |
|---|---|---|
| F1 | `AiSearchResourceLimitPolicy` registered `PerRetry` ⇒ a 503 the SDK then retried successfully still alerts | move to `PerCall` |
| F2 | `EmailNotificationProcessorFunction`'s generic catch alerts on **every** delivery attempt, not the final retry | gate on `IsFinalRetry`, matching its SMS sibling |
| F3 | Same site embeds `ex.Message` in the description, so the processor's content-hash dedupe can never collapse it | stable description, detail into metadata |
| F4 | `TwoFactorSmsService.SendOtpViaTemplateAsync` — the only India OTP path — bypasses its Polly policy and never checks the HTTP status | run it through the policy; check the status |
| F5 | `TelnyxSmsService` omits 502/504 from its retryable set, unlike 2Factor and Meta | add them |
| F6 | ACS email and both SMS services drop a send silently on their own hourly rate limit — `LogWarning` only | report `RateLimited` on our own cap |

---

## 7. Phases

| Phase | Content | Blocked? |
|---|---|---|
| P0 | Shared primitive: enums, interface, `IntegrationHealthAlerts`, settings, classifiers, alert types, gates | no |
| P1 | Data stores: Cosmos handler, SQL execution strategy, Blob per-call policy | no |
| P2 | Communication: ACS email, Telnyx, 2Factor, Meta WhatsApp, plus F4/F5/F6 | no |
| P3 | Remaining: Service Bus, ANH push, SignalR, Stripe, Razorpay, voice carriers, geocoding | no |
| P4 | AI re-verification and F1 | no |
| P5 | Email bounce: per-stamp ACS in `communication.json` + `deploy.ps1` (D14), the queue, the Event Grid topic + subscription, the processor function, `EmailDeliveryFailure`, per-stamp app settings, the deploy summary | **UNBLOCKED** — V1/V2/V3 all passed |
| P6 | Admin app registration + its test | no |
| P7 | Tests — unit + integration, placed per §0.18 with the runtime consumer | no |
| P8 | appsettings ×4, convention guards | no |
| P9 | Skills ×4 + memory | no |
| P10 | Full multidimensional audit — code quality, bugs, gaps, flow gaps, end to end (D13) | last |

---

## 8. COMPLETION RECORD — 2026-09-19

Every phase P0–P10 is done. Owner pushes and deploys.

### 8.1 Naming — corrected in the same change (owner request)

The rule, now applied without exception: **`{prefix}-{what it is}-{stamp}-{shared suffix}` — the stamp and
the env label come LAST**, exactly as every other regional resource already did.

| Thing | Before | After |
|---|---|---|
| Communication Service | `clinket-communication-{shared}` (ONE, global) | `clinket-communication-{stamp}-{shared}` |
| Email Communication Service | `…-{shared}-email` (suffix after the env label) | `clinket-communication-email-{stamp}-{shared}` |
| Event Grid system topic | `…-{shared}-email-events` (extends the email service's name) | `clinket-communication-events-{stamp}-{shared}` |
| Event Grid subscription | `acs-email-delivery-reports` (vendor acronym) | `email-delivery-failures` |
| Service Bus queue | `acs-email-events{-env}` (vendor acronym) | `email-delivery-failures{-env}` |
| Settings key | `ServiceBusSettings:AcsEmailEventsQueueName` | `ServiceBusSettings:EmailDeliveryFailuresQueueName` |
| Enum value | `IntegrationResource.BlobStorage` → `StorageResourceLimit` | `IntegrationResource.Storage` → `StorageResourceLimit` |

Reasons, so nobody undoes them:

- ‼️ The topic must not be a **prefix-extension** of the email service's name. `…-email` and
  `…-email-events` differ only by a suffix, so any `startswith` match — a script, a portal filter, a tired
  human at 2am — conflates two different resources.
- ‼️ **No vendor name in a queue.** All 44 existing queues are named by domain function; there is no
  `acs-*`, `azure-*`, `stripe-*` or `telnyx-*` among them. `email-delivery-failures` also says honestly what
  the queue carries, since the subscription filters to failures only.
- ‼️ The three ACS names are now built **outside** the prefix/suffix branch in `Initialize-StampContext`, so
  the name SHAPE cannot depend on whether a prefix was supplied. The old `else` branch produced a different
  shape from the `if` branch.
- `IntegrationResource.Storage` makes the alert type (`StorageResourceLimit`) and the gate
  (`EnableStorageResourceLimitAlerts`) **derivable from the resource name for all 14**, which the guard
  `EveryResource_MapsToItsOwnNameSuffixedAlertType` now asserts — stronger than the old distinctness check,
  and it removed a hand-written special case from the test.

### 8.2 The seven ACS delivery-report statuses — what we pull and what we do not

| Status | Meaning (Microsoft's own words, condensed) | Subscribed? |
|---|---|---|
| `Delivered` | Handed to the recipient's mail transfer agent | **No** — success |
| `Expanded` | *A distribution group recipient was expanded before delivery to the individual members of the group* | **No** — informational and non-terminal; each real member produces its OWN later report, so alerting here would be a false positive AND a duplicate |
| `Bounced` | Hard bounce — the address does not exist or the domain is invalid | Yes (High) |
| `Suppressed` | Previously hard bounced, so ACS is now dropping mail to it | Yes (High) |
| `Quarantined` | Quarantined as spam, bulk mail or phishing | Yes (**Critical** — reputation) |
| `FilteredSpam` | Identified as spam and rejected or blocked outright | Yes (**Critical** — reputation) |
| `Failed` | Not delivered; no more specific reason given | Yes (High) |

The second event type, `Microsoft.Communication.EmailEngagementTrackingReportReceived` (View/Click), is
**not subscribed at all** — it is engagement tracking, not health.

### 8.3 Audit findings — found by the closing audit, all FIXED

| # | Finding | Fix |
|---|---|---|
| A-1 | ‼️ `deploy.ps1`'s cross-stamp drift assertion still listed `AzureCommunicationServices__Endpoint` and `__ConnectionString` as keys that MUST be identical across stamps. With per-stamp ACS they now legitimately differ, so **every two-stamp deploy would have thrown `DRIFT … Refactor required` at the very end** | removed both from `$__sharedGlobalKeys`, with the reason recorded inline |
| A-2 | Five other SKILL.md files still described the deleted `AiResourceLimitAlerts` / `IAiResourceLimitAlerts` / `AiResourceKind`. A stale skill is worse than no skill (§0.9) | updated in all four tool directories, each carrying a pointer to `clinqet-integration-health` |
| A-3 | The email health signal carried the **raw** recipient address while the SMS one masked the phone number. The resource-health alert is identity-free and lives 90 days | masked with `MaskEmail()`; the FULL address still rides the per-recipient `EmailSendFailure` / `EmailDeliveryFailure` alert, which is the layer an admin uses to make contact |
| A-4 | My own perl patcher stripped the **UTF-8 BOM** from `deploy.ps1` and three `.cs` files. Windows PowerShell 5.1 then reads every em-dash as mojibake whose `”` is a valid string delimiter, so the script no longer parsed | BOMs restored; patcher made BOM- and CRLF-preserving; `deploy.ps1` re-verified with the PowerShell parser (48,664 tokens, 0 errors) |
| F7 | `AiSearchResourceLimitPolicy` short-circuited on any classifiable status, so a 5xx never had its structured error code read — unlike every other provider, where the body code wins | body inspected first, status as the fallback. Safe because `FindErrorCode` only returns codes from a closed resource-limit allowlist |
| F8 | A test had **pinned** "a 401 handshake does not alert" on the realtime socket, contradicting the owner's explicit rule that 401 must alert | expectation corrected to `true` |
| F9 | `LabelFor` coverage was unprovable at runtime — the label equals the enum name for Email, Cosmos, SignalR and WhatsApp, so the default arm is indistinguishable from an explicit one | the guard now reads the `LabelFor` switch source and asserts an explicit arm per resource |

### 8.4 Test results

| Suite | Result |
|---|---|
| `Clinqet.API.UnitTests` | **13,075 / 13,075** |
| `Clinqet.Communications.UnitTests` | **4,987 / 4,987** |
| `Clinqet.Identity.UnitTests` | **1,027 / 1,027** |
| `Clinqet.Mcp.UnitTests` | **990 / 990** |
| `Clinqet.Communications.IntegrationTests` | **583 / 583** |
| `Clinqet.Identity.IntegrationTests` | **479 / 479** |
| `Clinqet.Mcp.IntegrationTests` | **95 / 95** |
| `clinqetwebadmin` AlertsPage | **28 / 28**, ESLint 0 errors / 0 warnings |
| `Clinqet.API.IntegrationTests` | 2,168 / 2,200 — **32 PRE-EXISTING failures, not from this change** (see 8.5) |

### 8.5 ‼️ PRE-EXISTING failures — NOT caused by this change, NOT fixed here

32 tests fail in `Clinqet.API.IntegrationTests`: 31 in `VoiceAssistantControllerIntegrationTests`, plus
`BusinessProfileControllerTests.UpdateBusinessAddresses_PrimaryCountryChanges_InvalidatesCachedEntitlementRegion`.

**Evidence they are not ours.** `ClinqetApiFactory` configures **no** `ConnectionStrings:DefaultConnection`
— it is a Cosmos-only factory, and no SQL fixture is attached to these classes. The committed billing gate
`AdminVoiceAssistantController.AssignNumber → IAiAddOnService.GetVoiceAddOnBillingStatusAsync` reads SQL, so
it throws `InvalidOperationException("The ConnectionString property has not been initialized.")`, which the
controller's `catch (InvalidOperationException)` returns as a **400 carrying the raw developer sentence**.
Neither that controller, nor `AiAddOnService`, nor `VoiceAssistantService`, nor the entitlement cache is in
this change's diff — which in `clinqetapi` is only `Program.cs` (Cosmos handler, SQL strategy, three HTTP
observers, the SignalR constructor argument) and `appsettings.json`.

**The fix, for whoever owns that programme:** attach a SQL Testcontainer fixture to those classes in the
shape of `PaymentsSqlFixture`, and seed the AI add-on billing rows. Separately, that controller returns an
exception's `Message` as a user-facing string — the same leak already recorded in
`write-path-and-extraction-residuals-2026-09-07`.
