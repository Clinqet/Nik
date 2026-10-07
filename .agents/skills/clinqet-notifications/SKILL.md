---
name: clinqet-notifications
description: |
  **CORE FEATURE SKILL** — Work on the multi-channel notification pipeline.
  Single entry point `ICommunicationDispatcher.DispatchAsync(CommunicationRequest)` fans out
  to Service Bus queues → `NotificationProcessor` (Cosmos persist + SignalR + Push in parallel),
  Email function (templates + PDF), SMS function (Telnyx). USE FOR: adding/modifying notification
  types, channels, preferences, mandatory/eligible rules, templates, SignalR hub wiring,
  Azure Notification Hub registration, admin alerts on channel failures, DLQ handling.
  Applies to clinqetinfrastructure/Services/Communication/, clinqetinfrastructure/Services/SignalR/,
  clinqetinfrastructure/Services/Notifications/, clinqetfunctions/Functions/NotificationProcessor.cs,
  clinqetapi Controllers/Notification/, clinqetshared Enums/NotificationType.cs.
---

# CLINQET NOTIFICATION PIPELINE — COMPREHENSIVE SKILL

## RECENT CHANGES — 2026-10-06 (prepared accounts: the channel rule, and one alert per waiting customer)

See the `clinqet-prepared-providers` skill for the whole feature. What changed HERE:

- ‼️ **§6 channel rule.** A business the Clinket team built has nobody who could have agreed to anything: **no SMS, no WhatsApp, no marketing** until its owner takes it over. Transactional EMAIL still goes — that is how the owner learns a customer is waiting.
- ‼️ **"Stop emails" BEATS the mandatory rule.** Mandatory means the account HOLDER cannot opt out; nobody has taken this account over, and the person reading its mail pressed Stop. That check sits BEFORE `IsEmailMandatory`.
- **The lookup is skipped for customers.** `RecipientType.Customer` can never be a prepared provider, and this is the platform's hottest path — one SQL read per recipient per cache window on every booking, message, lead and quote.
- **`PreparedProviderWaitingAlert`** raises ONE alert per waiting REQUEST (lead, booking request, message), deterministic on `(kind, account, requestId)`. ‼️ It is NOT gated on `isFirstAttempt`: the alert processor dedupes on the EventId, so a redelivery costs one extra send, while gating it lost the alert for good on any first-attempt abandon.
- ‼️ **A blank `contextId` is the field's DEFAULT**, so the EventId falls back on the notification kind — `?? ` alone collapsed all four kinds into one id with no date.
- **`NotificationType.ProfileUpdatedByClinketTeam`** is the one notice a setup session may send; it is in `SignalRSettings:EnabledNotificationTypes`, in the echo catalog (Deliver) and in the routing catalog.
- **The notice names the PROFILE, not the list of areas** — "your services and prices" cannot carry a correct possessive in Spanish, Hindi or Gujarati. It also drops the "and" when "and more" follows.
- **Tests live in the Functions suite** (`PreparedProviderWaitingAlertTests`, `PreparedProviderEmailFooterTests`) and the channel rule in the API suite (`PreparedAccountChannelRuleTests`) — §0.18, the host that invokes it.

## RECENT CHANGES - 2026-08-14 (AI setup pricing remediation)

- `CatalogActionRequired` maps to `ServiceCatalog` and `catalog.service.update`. It resolves active unique people who can edit services plus administrators. It never reads the NewWorkIntake/lead route. `ServiceRejectedByAI`, `ServiceRejectedByAdmin`, `ServicePricingRequired`, and `ServicePricingRequiredSummary` use this class.
- `IBusinessCommunicationDispatcher.DispatchBatchAsync` validates one shared routing contract, resolves the SQL business/member/role/preference graph once, then emits every item per recipient with its own event ID. Zero recipients or dispatch failures retain the existing best-effort admin-alert path.
- An AI setup upload with incomplete pricing emits one durable `ServicePricingRequired` notification-center row per affected service (`SkipPush=true`, `SkipSignalR=true`, exact Service metadata/link) and one non-persisted `ServicePricingRequiredSummary` per recipient/run with SignalR and push eligible. The summary exists only when at least one incomplete service was successfully persisted. Stable run identity is the canonical validated blob host/path; SAS query values never participate.
- Provider web and mobile open an individual service notification in the existing exact-service editor and open the aggregate summary in Notifications. While onboarding, a live banner may render but its tap cannot navigate; mobile system-push taps also cannot enter the dashboard shell, so no deferred redirect survives onboarding.

## HIGH-LEVEL FLOW

```
Any service code (Booking/Broadcast/Quote/Review/Cart/Auth/...)
  └─> ICommunicationDispatcher.DispatchAsync(CommunicationRequest)
        ├─ resolves user preferences (SQL, 15-min cache)
        ├─ applies mandatory (BookingNotifications, QuotesInvoices)
        └─ fans out in parallel:
             ├─ email-notifications queue → EmailProcessor function → ACS email + optional PDF
             ├─ notifications queue       → NotificationProcessor function
             │     ├─ Cosmos Communications container (persist)
             │     ├─ SignalR (via Main API internal endpoint) — real-time
             │     └─ Azure Notification Hubs — mobile push
             └─ sms-notifications queue   → SmsProcessor function → Telnyx / TwoFactor
Failure paths: each function reports to FailureNotificationHelper → admin-alerts queue.
```

---

## ENTRY POINT — `CommunicationDispatcher`

`C:\Nik\clinqetinfrastructure\Services\Communication\CommunicationDispatcher.cs`

Public surface: `DispatchAsync(CommunicationRequest request, CancellationToken)` returning `DispatchResult` with success flags per channel.

### `CommunicationRequest` (interface DTO at `clinqetcore\Interfaces\Communication\ICommunicationDispatcher.cs`)

| Property | Required for | Notes |
|----------|--------------|-------|
| `RecipientUserNumber` | all channels | Cosmos user number |
| `NotificationType` | all | **must be `nameof(NotificationType.X)`** — dispatcher validates against enum and rejects unknown types into an admin alert |
| `RecipientType` | all | parses to `RecipientType` enum (Customer, Partner) |
| `RecipientEmail` | email | |
| `RecipientPhone` | SMS | |
| `EmailTemplateName`, `EmailTemplateData` | email | template under `Resources/EmailTemplates/{lang}/` |
| `SmsTemplateName`, `SmsTemplateData` | SMS | |
| `NotificationTitle`, `NotificationBody` | in-app/SignalR/push | **already localized and `string.Format()`'d** — never pass raw keys with `{0}` placeholders |
| `SkipEmail`, `SkipPush`, `SkipSms` | any | override eligibility |
| `PreferredLanguage` | all | default `"en"` |
| `NotificationMetadata` (`Context`, `ContextId`) | client deep-link | |
| `NotificationData` | client custom payload | `Dictionary<string, string>` |
| `PersistenceMode` | notification history | `Durable` by default; `Transient` suppresses Cosmos persistence without suppressing SignalR or push |
| `SkipInApp` | legacy notification gate | suppresses both durable history and SignalR; use `PersistenceMode.Transient` when realtime must remain enabled |
| `SkipSignalR` | realtime | suppresses SignalR independently of durable history and push |
| `SmsCategory` | SMS | `"Transactional"` for booking SMS, default `"Notification"` |
| `SmsCountryCode` | SMS | ISO code for E.164 |
| `EmailContext` | email | `NotificationContext` enum |

### DI registration
- Main API: `Program.cs` line ~532 — `services.AddScoped<ICommunicationDispatcher, CommunicationDispatcher>();`
- Function App: `Clinqet.Communications/Program.cs` line ~286 — same scoped registration (so functions can also dispatch).
- Identity API: NOT registered — Identity dispatches via Function App where needed (do not introduce dispatcher there without ADR).

---

## PREFERENCE RESOLUTION

`C:\Nik\clinqetshared\Models\CommunicationPreferenceConfig.cs`

Categories the dispatcher honors (Provider + Customer have slightly different mappings — see file):
- `BookingNotifications` — email **MANDATORY** (cannot opt out)
- `QuotesInvoices` — email **MANDATORY**
- `BookingReminders`
- `BroadcastOpportunities` (provider) / `CartReminders` (customer)
- `MessagesChats` — DirectMessageReceived only
- `ServiceApprovals` (provider)
- `ReviewsRatings`
- `MarketingPromotions`

Helpers (use these, don't re-implement):
- `GetCategoryForNotificationType(string type)` → category
- `IsEmailMandatory(string category)` → bool
- `IsSmsEligible(string category)` → bool (SMS-allowed list: BookingNotifications, BookingReminders, BroadcastOpportunities, MarketingPromotions)

Preference lookup: `ICommunicationPreferenceService` (SQL-backed, `IMemoryCache` 15-minute TTL).
- `ResolveUserIdFromUserNumberAsync(userNumber)` → SQL user id
- `GetCategoryPreferenceAsync(sqlUserId, category)` → `ChannelPreferenceDto { Email, Push, Sms }`

Defaults: Email=true, Push=true, SMS=false (regulatory).

**Concurrency / thread-safety (read before any fan-out work):** `CommunicationPreferenceService` resolves a fresh context **per call** from `IDbContextFactory<AppDbContext>` — registered as a *pooled factory + scoped bridge* via `AddAppDbContextPooled(...)` (`clinqetinfrastructure\Data\SQL\AppDbContextServiceCollectionExtensions.cs`) in all three hosts (API, Identity, Functions). It is therefore safe to invoke concurrently: the broadcast fan-out dispatches up to `BroadcastSettings.ProviderNotificationConcurrency` (default 10) providers in parallel through one injected dispatcher + preference service. **Never** hand this service — or anything reached inside a parallel fan-out — a single shared scoped `AppDbContext`; `AppDbContext` is not thread-safe and a shared instance throws `ObjectDisposedException` (or "A second operation was started on this context instance…") under load. Direct `AppDbContext` injectors are unaffected — the scoped bridge still hands them a normal per-scope context.

---

## SERVICE BUS LAYER

`C:\Nik\clinqetinfrastructure\Services\Communication\ServiceBusService.cs`

Public surface (used by dispatcher and other services — **never call directly from a controller for notification work**):

- `SendNotificationAsync(NotificationMessage)` → publishes to `NotificationsQueueName`
- `SendMessageAsync<T>(queueName, message)` → generic; 3 retries, exponential backoff; `forceAdminAlert` flag respected
- `SendBatchAsync<T>(queueName, messages)` → batch dispatch
- `SendScheduledMessageAsync<T>(queueName, message, scheduleEnqueueTime)` → for cart reminders, booking reminders, etc.

**Hard rule (CLAUDE.md §3.10):** the send-failure path must respect `forceAdminAlert` AND `EnableAdminAlertOnFailure` appsetting:
```csharp
if (forceAdminAlert || _settings.EnableAdminAlertOnFailure) {
    await CreateSendFailureAlertAsync(...);
}
```

Serialization: System.Text.Json with camelCase, `JsonStringEnumConverter`. `MessageId` is GUID — used for Cosmos dedup on idempotent retries.

### Queue topology (names from `ServiceBusSettings`)

| Setting key | Default value | Consumer | Purpose |
|-------------|---------------|----------|---------|
| `NotificationsQueueName` | `notifications` | `NotificationProcessor` | in-app + SignalR + push |
| `EmailNotificationsQueueName` | `email-notifications` | Email processor | template render + ACS send |
| `SmsNotificationsQueueName` | `sms-notifications` | SMS processor | Telnyx / TwoFactor route |
| `AdminAlertsQueueName` | `admin-alerts` | Admin alert processor | persist + ops notify |

Supporting domain queues (booking emails, broadcast processing, cart reminders, etc.) are listed in `clinqet-function-app` SKILL.

---

## QUEUE CONSUMER — `NotificationProcessor`

`C:\Nik\clinqetfunctions\Clinqet.Communications\Functions\NotificationProcessor.cs`

```csharp
[Function("NotificationProcessor")]
[ServiceBusTrigger("%ServiceBusSettings:NotificationsQueueName%", Connection = "ServiceBusConnection")]
```

Flow:
1. Deserialize `NotificationMessage`. Dead-letter on schema fail / unknown `NotificationType`.
2. **Persist to Cosmos** via `INotificationRepository.CreateAsync` (container `Communications`, partition `/userNumber`, id `{userNumber}_{notificationId}`, TTL from `NotificationSettings:TtlByType` or `DefaultTtlDays`).
3. **Idempotency**: on Cosmos 409 conflict, read back the existing doc and verify content match — if equal, treat as duplicate retry and continue with channel delivery; if not equal, log + skip (ID collision).
4. **Parallel delivery** via `Task.WhenAll`:
   - **SignalR** — `SignalRHttpClient.SendNotificationAsync(...)` → HTTP POST to Main API `/api/v1/internal/notifications/send` with `X-Internal-Api-Key` (must match `SignalRSettings:InternalApiKey`).
   - **Push** — if `!SkipMobilePush`, `IPushNotificationService.SendToUserAsync(recipientId, templateProperties)` → Azure Notification Hubs (FCM + APNs + Web Push templates).
5. **Completion**:
   - success → `CompleteMessageAsync`.
   - failure (not final retry) → `AbandonMessageAsync` (Service Bus retries).
   - failure (final retry, `DeliveryCount >= MaxDeliveryCount`) → `DeadLetterMessageAsync` with reason.
6. Channel failure (SignalR / push exceptions) routes through `FailureNotificationHelper` → admin alert.

`SafeFireAsync` pattern: any post-controller real-time fan-out (e.g., `ConversationRead` broadcast in messaging) uses this helper so a SignalR hiccup never breaks the controller response.

### Durable versus transient notification delivery

- `NotificationPersistenceMode.Durable` is the dispatcher default. Persistence, SignalR, and push are mapped independently onto `NotificationMessage.SkipPersistence`, `SkipSignalR`, and `SkipMobilePush`.
- `SkipInApp` retains its legacy meaning: suppress durable history and SignalR. Use `PersistenceMode = NotificationPersistenceMode.Transient` when persistence must be suppressed while realtime stays enabled.
- A durable replay is deduplicated by the existing notification document and does not repeat SignalR or push.
- A transient message acquires separate `CommunicationDeliveryIdempotencyStore` leases for `SignalR` and `Push`, keyed by `NotificationMessage.IdempotencyKey` with Service Bus `MessageId` fallback. Successful leases complete; failed leases release and abandon; a retry sends only incomplete channels. Final failure dead-letters with `TransientNotificationDeliveryFailed`.
- Durable external-channel failure remains best-effort after the history write and completes the message, preserving the existing contract.

### Audience isolation (dual-role: one userNumber, both apps)

Every notification carries `RecipientType` (Customer/Provider/Admin). In-app delivery (SignalR + REST) is scoped to an **audience group** so a dual-role human's two web apps never cross-receive each other's notifications. Clients do NOT filter by `RecipientType` — server isolation is authoritative.
- Group name: `NotificationAudience.GroupName(userNumber, RecipientType)` = `notif:{userNumber}:{recipientType}` (`Clinqet.Shared.Enums.NotificationAudience`).
- Connection audience = `NotificationAudience.FromUserType(JWT "UserType" claim)` (Partner→Provider, Clinket/Customer→Customer, Admin→Admin). `NotificationHub.OnConnectedAsync` joins the group; historical + replay filter by it.
- `SignalRNotificationService` sends live `ReceiveNotification` + read/delete/all-read sync to `Clients.Group(...)`; `ConversationRead` stays on `Clients.User(userNumber)` (a stray receipt for an unknown conversationId is a harmless client no-op).
- REST `NotificationController` + `INotificationRepository` (6 query methods take optional trailing `RecipientType? audience`) filter `AND c.recipientType = @audience` (in-partition); Communications index has `(type,recipientType,createdAt)` + `(…,isRead,createdAt)` + `(…,isRead)` composites.
- `CommunicationDispatcher.DispatchNotificationAsync` **rejects** an empty/invalid `RecipientType` (LogError + `AdminAlertType.InvalidRecipientTypeRejected` + return false) — never silently defaults to Customer. `FailureNotificationHelper` forwards `RecipientType` verbatim (the dispatcher is the single gate). Auth account-event DTOs (`LoginDto`/`VerifyMfaDto`/`ResetPasswordDto`) require `AppType` so push routing can't default to Partner.

---

## SIGNALR — REAL-TIME DELIVERY

### Main API endpoint
`C:\Nik\clinqetapi\Clinqet.API\Controllers\Notification\InternalNotificationTriggerController.cs`

`POST /api/v1/internal/notifications/send` — **internal-only**:
- Auth filter: `InternalApiKeyAuthorizationFilter` matches `X-Internal-Api-Key` header to `SignalRSettings:InternalApiKey` (32+ chars).
- Validates type, constructs `NotificationDto`, calls `ISignalRNotificationService.SendNotificationAsync`.
- Returns HTTP 503 when the notification type is disabled or the hub call fails. `SignalRHttpClient` maps non-success to `false`, so a transient SignalR lease is never falsely completed.

### Notification service
`C:\Nik\clinqetinfrastructure\Services\SignalR\SignalRNotificationService.cs`

- `SendNotificationAsync(recipientId, NotificationDto)` — checks `SignalRSettings:EnabledNotificationTypes` whitelist BEFORE delivery. **New notification types MUST be added to this list in Main API `appsettings.json` or they will silently not arrive in real time.**
- Live invocation: `_hubClients.Group(notif:{userNumber}:{recipientType}).ReceiveNotification(dto)` — audience-scoped (see Audience isolation above).
- `SendNotificationBatchAsync` is audience-scoped per-notification (groups by each `RecipientType`) but has **no production caller**; reconnect replay flows through `NotificationHub.RequestMissedNotifications` → `Clients.Caller.ReceiveNotificationReplay` (audience-filtered query).
- `NotifyConversationReadAsync(...)` (line ~140-166) — sends `ConversationRead` to the sender side; skips self-read.

### Hub & client wiring
- Hub: registered in Main API `Program.cs`.
- Group naming: one group per user — `User(recipientId)`.
- Clients: user-app, partner-app, admin-app each maintain a SignalR connection bound to JWT; reconnect re-joins user group automatically.

---

## EMAIL CHANNEL

- Templates: `C:\Nik\clinqetinfrastructure\Resources\EmailTemplates\{lang}\{TemplateName}.json` — JSON file with `Html`, `Subject`, `Title` (+ optional `PlainText`). Languages: en, es, fr, de, zh, in.
- Token replacement: `EmailTemplateData` properties substitute into Handlebars-style placeholders in `Html`/`Subject`.
- PDF: invoice/quote/booking PDFs generated via QuestPDF (`clinqetinfrastructure\Services\Documents\QuestPdfService.cs`); all tokens passed; design matches partner-app theme.
- Email provider: Azure Communication Services — `AzureCommunicationServicesEmailService.cs`.

When you add a new template:
1. Add the JSON file under EVERY supported language folder. Never ship en-only.
2. Update `EmailTemplateData` model if new tokens.
3. Test PDF rendering end-to-end if attached.

---

## AUDIT PARTITION KEY — email/SMS `UserActivity` rows (2026-06-05)

`EmailSent`/`EmailFailed` and `SmsSent`/`SmsFailed` are written to the `UserActivity`
Cosmos doc (container `SystemData`), whose **partition key IS `UserId`** (`UserId` is an
alias of `Pk` — `clinqetcore\Entities\COSMOS\UserActivity.cs`). That key MUST be the
canonical **SQL `ApplicationUser.Id` GUID** — the same value Login/Register/consent
(`IUserActivityService.RecordActivityAsync(userId:)`) and SMS/WhatsApp opt-in/out
(`CommunicationPreferenceService` / `WhatsAppConsentService`, using `user.Id`) write —
so a send shows up when querying a user's activity by GUID and never scatters into
display-name / UserNumber / BusinessId partitions.

How it is carried (resolve once, no extra SQL on the send path):
- `EmailNotificationMessage.AuditUserId` + `SmsNotificationMessage.AuditUserId` carry the GUID.
- `CommunicationDispatcher` sets them from the already-resolved `ResolveSqlUserIdAsync(request)`
  (uses `PreferenceLookupUserId` — the customer's `Customer.UserId` or the provider-owner's
  `BusinessProfile.UserId`, both SQL GUIDs). The WhatsApp→SMS fallback re-dispatches through
  `DispatchAsync`, so it inherits this automatically.
- `IEmailService` / `ISmsService` methods take `auditUserId`; `userName`/`Username` keep their
  rate-limit / ACS-display roles. The audit uses `auditUserId`, falling back to the documented
  sentinel `SystemConstants.SystemAuditUserId` ("system") for anonymous/system sends.
- Dedicated email processors (Booking/Invoice/Quote) resolve the customer GUID via
  `ICommunicationPreferenceService.ResolveUserIdFromUserNumberAsync(CustomerUserNumber)` (cached)
  and use `BusinessProfile.UserId` for provider emails.
- AuthService OTP/MFA/verification call sites pass `auditUserId: user.Id`.

NEVER stamp the audit `UserId` from a display name, email, UserNumber, or BusinessId. NEVER
reintroduce the IP/UA-missing drop (removed 2026-06-05). New send paths that emit an
`EmailSent`/`SmsSent` audit MUST pass `auditUserId`.


---

## SMS CHANNEL

- `RoutingSmsService.cs` — route by `SmsCategory` + country code.
- Providers: `TelnyxSmsService.cs` (primary), `TwoFactorSmsService.cs` (OTP/MFA).
- Categories:
  - `Transactional` — dedicated number, higher delivery priority (booking notifications).
  - `Notification` — default.
  - `Marketing` — requires explicit marketing consent.

---

## PUSH CHANNEL — Azure Notification Hubs

`C:\Nik\clinqetinfrastructure\Services\Notifications\AzureNotificationHubService.cs`

- Platforms: FCM (Android), APNs (iOS), Web Push.
- Templates (per-platform JSON, variables like `$(title)`, `$(body)`, `$(notificationType)`, `$(contextId)`, `$(noticeType)`):
  ```jsonc
  // APNs
  {"aps":{"alert":{"title":"$(title)","body":"$(body)"},"sound":"$(sound)","badge":"#(badge)"},
   "data":{"type":"$(notificationType)","contextId":"$(contextId)","noticeType":"$(noticeType)"}}
  // FCM
  {"message":{"notification":{"title":"$(title)","body":"$(body)"},
   "data":{"type":"$(notificationType)","contextId":"$(contextId)","noticeType":"$(noticeType)"},
   "android":{"priority":"high"}}}
  ```
- **`noticeType`** = a `SystemNotification`'s own kind. APNs, FCM and Web templates all carry it; `NotificationProcessor` fills it
  from `message.Data["Type"]` (empty when absent, and `AzureNotificationHubService` defaults it to `""` so the template never
  breaks). Provider mobile `resolveSystemType` reads `data?.noticeType`, so a tapped `LeadQuotaReached` /
  `WhatsAppSendCapReached` / `WhatsAppPlanBlocked` push opens Plan & Billing.
- **Two hubs per namespace — the hub IS the app boundary.** One Notification Hub carries one APNs bundle ID; the partner app (`com.clinketpartner`) and customer app have different bundles, so each gets its own hub: `clinket-push-partner-{env}` + `clinket-push-customer-{env}`, both inside the one region namespace. A single **namespace-level** `send-listen` SAS connection string addresses both (only the hub *name* differs).
- **`AppType` binds a device to its app.** `DeviceToken` (SQL) has a non-nullable `AppType` column; the register/refresh DTOs require it (`AppType?` + `[Required]` so a missing value 400s instead of silently defaulting to `Partner`). Uniqueness is the composite `(DeviceId, AppType)` — one physical device can host both apps (iOS shares `identifierForVendor`).
- Device registration (SQL, Identity API): `RegisterDeviceAsync(userNumber, deviceId, token, platform, appType)` routes the Installation to the app's hub (Partner→partner, Clinket→customer, Admin→none) with tag `userNumber:{userNumber}`. `UnregisterDeviceAsync(deviceId, appType)` removes it; `DeviceTokenController.UnregisterToken` takes `appType` as a required query param.
- **Token-change re-push + stale-token hygiene.** `IDeviceTokenRepository.UpsertAsync` returns `DeviceTokenUpsertResult(Device, HubSyncRequired)` — true on insert, a new token, a new platform, a **new owner** (shared phone: the installation is tagged with the previous owner's UserNumber, so the new owner would receive the old owner's pushes) or a row back from retirement. `DeviceTokenController.RegisterToken` re-syncs the hub when `!IsRegisteredWithHub || HubSyncRequired` — so a token rotated via **register** (not just refresh) updates the installation's push channel (`CreateOrUpdateInstallation` overwrites it in place; no extra hub round-trip when nothing changed); `RefreshToken` always re-syncs; both share the private `SyncHubRegistrationAsync` helper. If a re-push *fails* on an already-registered device (e.g. token rotation during an NH outage), the helper clears the flag (`MarkAsUnregisteredWithHubAsync`) so the 15-min `DeviceRegistrationRetryFunction` re-syncs the current token (the flag then means "hub has the current token"). The daily `DeviceTokenCleanupFunction` (Function App) prunes tokens not refreshed in `DeviceTokenCleanup:StaleAfterDays` (90) via `GetStaleDevicesAsync` → best-effort `UnregisterDeviceAsync` (resolves the hub by the row's `AppType` and calls `DeleteInstallation`, which **removes the installation so it no longer counts toward the namespace 200k active-device cap** of the Basic ~$10 tier) → SQL `DeleteAsync` **only on a successful hub removal** (`UnregisterDeviceAsync` returns `DeviceUnregistrationOutcome` {Removed,NoHub,Failed}; on `Failed`/transient hub error the SQL row is kept so the next run retries — never hard-deleting the row while the installation may still occupy a 200k slot; one aggregated `SystemError` admin alert per run flags persistent hub-unregister failures for an admin), in a **bounded drain loop** (`MaxParallelism` concurrency, `BatchSize` per fetch, hard `MaxBatchesPerRun` cap, `HashSet` forward-progress guard against a permanently-failing row). Safe to prune because a pruned device **self-heals** — it re-registers on next app open (relies on the mobile contract to call register on launch); meanwhile in-app/SignalR/email still deliver. `Enabled`/`StaleAfterDays`/`BatchSize`/`MaxParallelism` live in the Function App `appsettings.json` under `DeviceTokenCleanup`; the cron `TimerSchedule` (`%DeviceTokenCleanup:TimerSchedule%`, daily 03:30 UTC) is host-resolved from `local.settings.json` + `deploy.ps1` (applied + emit), NOT `appsettings.json` (same as `AnalyticsCompactionSettings:CronExpression`).
- Send: `SendToUserAsync(userNumber, recipientType, templateProperties)` picks the hub by **`RecipientType`** (Provider→partner, Customer→customer, Admin→skip) then tags `userNumber:{userNumber}`; `NotificationProcessor` passes `message.RecipientType` through. Because the recipient id is always the userNumber (BusinessId == UserNumber for providers, CustomerUserNumber == UserNumber for customers), a dual-role human (same userNumber, both apps installed) gets each notification on the correct app only.
- Settings: `AzureNotificationHubSettings { ConnectionString, PartnerHubName, CustomerHubName }` — one shared conn string + two hub names.
- **Auth = SAS connection string only; Managed Identity is impossible** for the NH data plane (Azure platform limit — the NH security baseline marks Azure AD / Managed Identities / Service Principals / RBAC for data plane all `Supported: False`, and the `Microsoft.Azure.NotificationHubs` 4.2.0 SDK has only connection-string constructors). NH is the one Azure dependency NOT on Managed Identity — by necessity, not oversight.
- **Devices follow their sign-in session (2026-09-29).** Register/refresh bind `DeviceTokens.SessionId` to the caller's session; ending the session retires the device in the same transaction; `logout`/`logout/all` remove it from the hub at once; the 15-min retry sweep and the nightly cleanup catch the rest. `device-tokens/unregister` clears `IsRegisteredWithHub` once the hub no longer holds the installation, so a later sign-in re-registers. Full rules: `clinqet-auth-sessions` §7.

- **Backend needs Listen + Send.** Installation management (`CreateOrUpdateInstallation`/`DeleteInstallation`) is a **Listen** op; sending is **Send**. `events.json` provisions **both hubs** + one namespace-level `send-listen` rule (Listen+Send); `deploy.ps1` wires the shared connection string + `PartnerHubName`/`CustomerHubName` to the Function App (`NotificationProcessor` sends + `DeviceRegistrationRetryFunction` registers) AND the Identity API (`DeviceTokenController` registers) — in BOTH the applied `Merge-AppSettings` block AND the emit-only local-paste dicts (`$functionAppSettings`/`$identityApiSettings`). A Send-only key 401s on registration. The Main API does NOT use push.

---

## PERSISTED NOTIFICATIONS (in-app)

`Notification` entity (`clinqetcore\Entities\COSMOS\Cosmos.cs`):
- Container: `Communications`. Partition key: `/userNumber`.
- Fields: `NotificationId`, `UserNumber`, `RecipientType`, `Title`, `Body`, `NotificationType` (string), `IsRead`, `Priority` (Normal/High), `Data` (Dict), `Metadata` (Context/ContextId), `CreatedAt`, `ExpiresAt`, `Ttl`.

Repository: `INotificationRepository` — `CreateAsync`, `GetByRecipientIdAsync(paged)`, `GetUnreadCountAsync`, `GetUnreadNotificationsAsync(maxCount)`, `MarkAsReadAsync`, `DeleteAsync`.

Client API (Main API):
- `GET /api/v1/notifications` — paged
- `GET /api/v1/notifications/unread/count` — badge
- `PATCH /api/v1/notifications/{id}/read`
- `DELETE /api/v1/notifications/{id}`

---

## NOTIFICATION TYPES — `NotificationType` enum

`C:\Nik\clinqetshared\Enums\NotificationType.cs` — ~66 values. Must have `[JsonConverter(typeof(JsonStringEnumConverter))]` (already on the type-level attribute).

Logical groups:
- **Booking**: BookingCreated, BookingConfirmed, BookingAwaitingConfirmation, BookingRejectedTimeout, BookingCancelled, BookingUpdated, BookingReminder, BookingRejected, BookingCompleted, BookingInProgress, BookingNoShowCustomer, BookingNoShowProvider, BookingAutoCompleted
- **Quotes**: QuoteReceived, QuoteSent, QuoteApproved
- **Services**: ServiceApprovedByAdmin, ServiceRejectedByAdmin, ServiceApprovedByAI, ServiceRejectedByAI, ServiceCategoryAutoCorrected
- **Broadcasts**: BroadcastReceived, BroadcastNoMatches, BroadcastBidReceived, BroadcastBidUpdated, BroadcastBidWithdrawn, BroadcastMessageReceived, BroadcastAwarded, BroadcastWon, BroadcastLost, BroadcastBidRejected, BroadcastExpired, BroadcastCancelled, BroadcastExpiryReminder, BroadcastUpdated, BroadcastProcessed, BroadcastFailed, DirectMessageReceived
- **Account**: PhoneChanged, EmailChanged, PasswordChanged, PasskeyAdded, PasskeyRemoved, PasswordReset, FriendlyNameUpdated, FriendlyNameRemoved, AccountLockout, MfaLockout
- **Reviews**: ReviewDeleted, ReviewReplied, ReviewReplyEdited, ReviewReplyDeleted, ReviewApproved, ReviewRejected
- **Cart**: CartReminder
- **System**: SystemNotification

**Adding a new NotificationType — ten-step checklist:**
1. Add the value to the `NotificationType` enum (keep alphabetical within group).
2. Map it in `CommunicationPreferenceConfig` (provider list, customer list, or both) under the correct category.
3. Decide email/SMS mandatory vs eligible — adjust helpers if a new category needs to be added.
4. Add the **two localization keys**: `Notification_<Name>_Title` and `Notification_<Name>_Body` in every language file under `Resources/Localization/`.
5. If real-time delivery is required, add the enum name string to `SignalRSettings:EnabledNotificationTypes` in Main API `appsettings.json`.
6. If email-eligible, add the JSON template file under every language in `Resources/EmailTemplates/`.
7. If push-eligible, decide priority (`Normal`/`High`) and any custom data fields.
8. Set TTL under `NotificationSettings:TtlByType.<Name>` (or accept default).
9. Wire the call site to `ICommunicationDispatcher.DispatchAsync` with `string.Format()`-resolved title/body.
10. Add unit AND integration tests covering dispatch + persistence + SignalR + push paths.

---

## ADMIN ALERTS & FAILURE HELPER

`C:\Nik\clinqetfunctions\Clinqet.Communications\Services\FailureNotificationHelper.cs`

- `IsFinalRetry(deliveryCount)` checks against `RetrySettings:MaxDeliveryCount` (default ~10).
- `HandleSystemFailureAsync(failureType, description, contextIdentifier, forceAdminAlert)` — persists alert via `IAdminAlertRepository` (container `AdminAlerts`).
- Per-channel helpers: `HandleSignalRNotificationFailureAsync(...)`, `HandlePushNotificationFailureAsync(...)`.
- `AdminAlertType` enum (e.g., SystemError, InvalidNotificationTypeRejected, MediaDerivativeQueueFailure, BroadcastProcessingFailure) and `AdminAlertSeverity` (Low/Medium/High/Critical).
- **Immutable audit alerts** (`AdminAlertController.IsImmutableAuditAlert`): `AdminAccessGranted`, `AdminAccessRevoked`, `ProviderVerificationChanged`, `VoiceTrainingConsentChanged`, `CategoryPromotedToGlobal`, `ProviderScoreOverrideChanged`. Delete ⇒ 400 `Error_AlertNotDeletable`; resolve AND mark-read re-pin the ttl to `CreatedAt + AuditRetentionDays(type)` (`PinnedAuditTtlAsync`; `MarkAsReadAsync` gained `ttlSeconds`), so neither triage write extends the record. Retention: `DocumentTtl:VoiceTrainingConsentAuditTtlDays` (2555), `DocumentTtl:ProviderScoreOverrideAuditTtlDays` (183), else `DocumentTtl:AdminAccessAuditTtlDays` (365).
- **`ProviderScoreOverrideChanged`** (F10 / D19, High): written by `ProviderScoreOverrideService` (`clinqetinfrastructure\Services\Provider\`) straight to `IAdminAlertRepository.CreateAlertAsync` — NOT the alert queue, because the queue message cannot carry a ttl — with `Ttl` = `DocumentTtl:ProviderScoreOverrideAuditTtlDays` × 86400 (183 in Main API AND Functions appsettings; key + code default are the consts `ProviderScoreOverrideSettings.AuditTtlDaysKey` / `DefaultAuditTtlDays`, shared with `AdminAlertController`'s re-pin). Actions `set` / `changed` (admin `PUT admin/providers/{businessId}/scores/override`), `cleared` (`POST …/scores/override/clear`), `expired` (`ExpireIfLapsedAsync`, actor `system`; since W11 from `ProviderScoreRefreshService` only — the override's own exact-minute `provider-score-refresh` message (`ProviderScoreRefreshKind.OverrideExpiry` → `ExpireOverrideAsync`, not gated by `ProviderScoring:Enabled`) and, as a backstop, the start of every rescore; the profile write reaches search via the ProviderData change feed — `SearchIndexAuditFunction` no longer expires overrides). `Description` carries actor, action, reason, expiry and computed + override before → after per score; `Metadata` carries `Actor`, `Action`, `Reason`, `ComputedResponse` / `ComputedReliability` / `ComputedAcceptance`. ‼️ Durability: written with `CancellationToken.None`; a deterministic id per event, `scoreoverride_{businessId}_{action}_{stampTicks}` — an admin write stamps once per request, so its retries reuse the id (a `DuplicateItemException` counts as already written); the lapse keys on `overrideExpiresAt` and point-reads each month partition since it (floored at now − the audit ttl) before writing; the lapse writes its record BEFORE clearing and does not clear without one; mark-read and resolve re-pin the ttl (above); `OperationCanceledException` is never swallowed. ‼️ W13: an admin's change is recorded FIRST (after its end message is scheduled); if either fails nothing is saved (`ScoreOverrideResult.Unavailable` ⇒ 503), and a change recorded but then not saved or not confirmed gets a second "not applied" / "not confirmed" record. A failed audit write still logs Critical. Admin filter: `clinqetwebadmin` `AlertsPage.jsx`.
- **Cooldown**: invalid-type alerts coalesce — 30-minute cooldown per type to prevent storm.
- Admin alert wording is **internal-only** — hardcoded English is allowed here (CLAUDE.md §3.6).

---

## APPSETTINGS

Main API `appsettings.json`:
- `SignalRSettings` — `InternalApiKey`, `AzureSignalR.{Enabled,ConnectionString}`, **`EnabledNotificationTypes` whitelist**.
- `AdminAlertSettings.{Enabled, AlertChannels}`.

Function App `appsettings.json`:
- `NotificationSettings.{DefaultTtlDays, CreateAdminAlertOnChannelFailure, TtlByType{...}}`.
- `ServiceBusSettings` (shared shape).
- `RetrySettings.{MaxDeliveryCount}`.

Function App `local.settings.json` (gitignored — runtime only):
- `ServiceBusConnection`
- `SignalRBaseUrl` / `InternalApiKey` (for the internal HTTP call)
- Any other trigger-bound connection strings

Any new `local.settings.json` entry MUST also be added to `C:\Nik\azureautomation\deploy.ps1` and ARM templates.

---

## TESTS

- Unit: `Clinqet.Communications.UnitTests/Functions/NotificationProcessorTests.cs` — null message, invalid type, delivery count, idempotent retry, channel failure, mocks for `INotificationRepository`, `SignalRHttpClient`, `IPushNotificationService`.
- Integration: `Clinqet.Communications.IntegrationTests/Tests/Functions/NotificationProcessorIntegrationTests.cs` — Service Bus + Cosmos emulator end-to-end.
- New notification types REQUIRE both unit AND integration coverage exercising each enabled channel.

---

## CHECKLIST BEFORE MERGE

- [ ] Never call `ServiceBusService` directly from a controller for notification work — always go through `ICommunicationDispatcher`.
- [ ] `NotificationType` is a known enum value (validated by dispatcher).
- [ ] Title/body **already** localized AND `string.Format()`'d before dispatch — no raw `{0}` placeholders.
- [ ] `SignalRSettings:EnabledNotificationTypes` updated for any new type that needs real-time delivery.
- [ ] Localization keys added in EVERY supported language.
- [ ] Email templates added in EVERY supported language (if email-eligible).
- [ ] Preference category mapping updated for the new type.
- [ ] Failure path covered — `forceAdminAlert` or `EnableAdminAlertOnFailure` respected.
- [ ] TTL configured in `NotificationSettings:TtlByType` or default accepted.
- [ ] Unit + integration tests for every channel exercised.
- [ ] If a new queue or hub group is introduced: ARM template + `deploy.ps1` updated.

## Voice material email — `MaterialInfoEmail` (2026-08-21, sent by the Functions post-call processor)

- **What:** when a caller asks the AI receptionist to be SENT pieces of the owner's material and chooses email, the Functions
  host (`VoicePostCallProcessorFunction.SendMaterialEmailAsync`, `VoicePostCallKind.SendMaterialInfo`) sends
  `Resources/EmailTemplates/{en,es,fr,hi,gu}/MaterialInfoEmail.html` through `IEmailService.SendTemplatedEmailAsync` with
  the PDF attached (the quote/invoice attachment path). It does NOT ride the `CommunicationDispatcher`: the recipient is a
  caller, not a platform user with preferences, and asked for it on the call (the `ServiceDetailsEmail` posture) — so no
  send-time opt-out re-check, `communicationType` `VoiceMaterialInfo`, audit user `SystemConstants.SystemAuditUserId`.
- **Data:** `Greeting` (`MaterialInfo_GreetingNamed` "Hi {0}," when caller-ID matched a contact, else
  `MaterialInfo_GreetingAnonymous`), `BusinessName`, `BusinessPhone` (the DNIS, else the profile phone), `DetailsHtml` — an
  `HtmlFragment` produced by `MaterialInfoEmailRenderer.RenderHtml` with EVERY text node HTML-encoded (records as label/value
  rows, prose as paragraphs, the "… continues" line only when truncated); subject `MaterialInfo_Subject` ("Information from
  {0}"). `DetailsHtml` is registered in `EmailHtmlFragmentsAreDeclaredTests.DeclaredFragments` (Functions) — a new
  block-shaped placeholder fails that suite until its producer is declared there.
- **Language:** the provider's preferred language (the existing precedent for caller-facing documents) — en/es/fr/hi/gu all
  shipped with byte-identical token sets.
- A send failure ⇒ forced admin alert (`FailureNotificationHelper.HandleSystemFailureAsync`) + an in-call
  `DocumentDeliveryNotice` (`VoiceDocumentKind.KnowledgeInfo`) — the model already told the caller it is on its way.
- Tests: Functions `Voice/MaterialInfoEmailRendererTests`, processor `Run_SendMaterialInfo_Email_*`, and the real-localization
  integration test `Run_SendMaterialInfo_Email_EndToEnd_RealLocalization_DetailsInBody_PdfAttached`.


## WhatsApp — the 4th channel (Phase 1, 2026-06-01)

WhatsApp rides `CommunicationDispatcher` as a 4th channel alongside email / in-app / SMS. Full detail in the `clinqet-whatsapp` skill; the dispatcher-facing contract:
- **Gate** (`EvaluateWhatsAppWillSendAsync`): `!SkipWhatsApp && IsWhatsAppEligible(category) && RecipientWhatsApp present && WhatsAppTemplateName present && registry.HasApprovedTemplate(name,lang) && contact.ChannelOptIn==OptedIn && !contact.Blocked && (category!=Marketing || marketingOptIn)`. Cheap sync checks run first; the consent point-read (`IWhatsAppConsentService.ResolveContactAsync`, SystemData `WhatsAppContact` doc) runs only when WhatsApp could otherwise send and is **cached** in the dispatcher's `IMemoryCache` (`WhatsAppConsentService.ConsentCacheKey`). A consent-read failure returns false (no WhatsApp, no SMS suppression) so other channels still deliver.
- **SMS suppression + fallback**: a WhatsApp send SETS `smsEnabled=false` (WhatsApp REPLACES SMS; email + in-app stay additive). The suppressed SMS is carried forward as `WhatsAppSmsFallback` on the queue message so `WhatsAppOutboundProcessorFunction` can re-send it on a delivery failure (`SkipWhatsApp/Email/Push=true` on the fallback re-dispatch).
- **Queue/flow**: `whatsapp-outbound` → `WhatsAppOutboundProcessorFunction` (MessageId dedup via `WhatsAppIdempotencyStore`; `WhatsAppErrorClassifier`→retry/fallback/block; §2.1 alias link on success) → `MetaWhatsAppService` → Meta; delivery callbacks → `whatsapp-status` → `WhatsAppStatusProcessorFunction` (failed+unreachable→block contact + admin alert). DLQ + `FailureNotificationHelper.HandleWhatsAppFailureAsync` admin alert on final failure (`AdminAlertType.WhatsAppDeliveryFailure` / `WhatsAppContactBlocked`).
- **Request fields**: `RecipientWhatsApp` (+E.164 or BSUID — use `PhoneNumberNormalizer.ToE164OrNull` at dispatch sites), `WhatsAppTemplateName` (`WhatsAppTemplateNames.*`), `WhatsAppTemplateData` (exact `BodyParams`/`*Key` from `WhatsApp:Templates`); `DispatchResult.WhatsAppDispatched/WhatsAppFailed`.
- **Wired Phase-1 sites**: booking reminder/confirm-needed/cancelled/rejected/completed/requested/new (Functions + BookingService + BookingController), lead/quote-bid/broadcast-won (Broadcast*), invoice `InvoiceReady` (PDF as WhatsApp document, `InvoiceEmailProcessor`). New consent capture endpoint `POST /api/v1.0/whatsapp/consent` (Main API, `ExplicitForm`). `NotificationType.InvoiceReady` is WhatsApp-only (SignalR-whitelist `DeliberatelyExcluded`).
- **PII**: never log the raw recipient/phone/BSUID — mask via `SecurityExtensions.MaskUserId()/.MaskPhoneNumber()` (the dispatcher's WhatsApp logs do; the s18 12.4 audit also masked the dispatcher's email/SMS branch logs + the routing/booking-reply/auth-OTP logs).
- **Phase 2 (2026-06-02):** shared-number **send guardrails** — `IWhatsAppSendGate` over a `WhatsAppSendCounter` SystemData doc (`wasendcap_`, atomic PATCH increment, calendar-day UTC, per-item ttl) enforced ONLY in `WhatsAppOutboundProcessorFunction` (per-provider daily TEMPLATE cap → over-cap suppresses the WhatsApp send + falls back to SMS; in-window session text is free, never counted; + WABA-tier monitor). Cap/tier admin alerts: `AdminAlertType.WhatsAppSendCapReached` (per-provider, once at count==cap) + `AdminAlertType.WhatsAppWabaTierReached` (shared-number, s18). Opted-out/blocked CRM outreach dispatches the in-app `NotificationType.ProviderWhatsAppReachOut` (push + SignalR, account-only). The 6.3 notification master toggle reads consent via `CommunicationPreferenceService.EnrichWhatsAppAsync` (cost-gated, fail-soft, OFF the dispatch hot path — which still uses `GetCategoryPreferenceAsync`).


## Billing notifications — multi-channel + product/card-aware (Part 3, 2026-06-29)

Flow-A billing now fans out on **in-app + push + email + WhatsApp** through `BillingNotificationService` (the only Flow-A call site of `ICommunicationDispatcher`). It resolves the provider contact ONCE from `BusinessProfile` (email + phone→E.164 WhatsApp), sets `RecipientEmail`/`RecipientWhatsApp`, and selects copy/email/WhatsApp templates by `(NotificationType, BillingProduct, HasPaymentMethodOnFile)`.

- `BillingPayments` is now in `CommunicationPreferenceConfig.WhatsAppEligibleCategories` (WhatsApp suppresses SMS; additive to mandatory email + in-app).
- New `NotificationType`: `SubscriptionTrialEnded`, `SubscriptionCanceled` (both in `ProviderCategories[BillingPayments]` + SignalR `EnabledNotificationTypes`).
- New enum `BillingProduct {None,Plan,AiAssistant}` keeps copy product-clear: "Clinket {tier} plan" vs "Clinket AI Assistant"; plan lapse = "moved to free Clinket plan", AI lapse = "switched off". NEVER confuse the two.
- Product/card-aware in-app keys: `Notification_Subscription{Downgraded|TrialEnded}_{Plan|Ai}_*`, `Notification_SubscriptionTrialEndingSoon_{Card|PlanNoCard|AiNoCard}_*`, `Notification_SubscriptionCanceled_*` (en/gu/hi; fr→en).
- Admin revenue-at-risk alerts are raised from `BillingNotificationService` (deduped once/provider/cycle via deterministic SHA-256 EventId→MessageId), gated by `Payments:AdminAlertOnBillingRisk`.

### Payment receipts (Part 2 §A3) — receipt email is THE email for successful charges
A branded HTML receipt email **with the PDF attached** now fires on EVERY successful payment, via a dedicated `BillingReceiptEmailProcessor` function on the new `billing-receipt-emails` queue (see `clinqet-function-app` skill). To avoid a double email, `BillingNotificationService.ResolveVariant` sets **`EmailTemplate = null`** for `SubscriptionCharged`, `AiAddOnActivated`, and `MinuteTopUpPurchased` — those stay **in-app + push** (and WhatsApp where applicable) but no longer send their own email; the receipt is the email. `RefundProcessed` and the at-risk types are unchanged. Enqueue is DRY at one site per flow: Flow A in `BillingChargeService.ChargeVaultedAsync` (receipt-eligible Succeeded; best-effort + non-throwing — a receipt-enqueue failure never rolls back the charge); Flow B (customer "PAID" booking receipt) in `BookingPaymentService.FinalizeCapturedAsync`. Templates `BillingReceipt.json` + `BookingPaidReceipt.json` (en; `communicationType = BillingPayments`).


## Promo-sunset notification family + multi-language email shell + hi/gu backend repair (2026-07-11)

> ‼️ The promo-sunset family and the founder block were DELETED on 2026-10-04 (two plans, see "Two plans" below):
> the four `Sunset*` types, `SubscriptionUpgraded`, the sunset email templates, the founder tokens and
> `ApplyFounderOfferAsync` no longer exist. The multi-language shell and the hi/gu repair below still stand.

- ~~**4 new `NotificationType` values**~~ (deleted 2026-10-04) — `SunsetAnnouncement`, `SunsetCutoverSoon` (D-7), `SunsetCutoverTomorrow` (D-1), `SunsetTrialStarted` (day 0) — dispatched by `BillingNotificationService` (BillingPayments category, in-app + push + email, `SkipSms`, NO WhatsApp via the template-map default, no admin alerts), added to `SignalRSettings:EnabledNotificationTypes`. Copy `Notification_Sunset*_{Title,Body}` in backend en + REAL hi + gu; args `{0}=date, {1}=days`.
- **Email templates now have hi/ + gu/ language folders** (first non-en folders; `TemplateService` picks the recipient language folder, en fallback stands for everything else). The 4 sunset templates + the two founder-carrying trial templates (`SubscriptionTrialEnded_Plan`, `SubscriptionTrialEndingSoon_PlanNoCard`) exist in en/hi/gu on a shared RESPONSIVE shell: full HTML doc, fluid 600px card, ≤480px media query, lime `#97EF29` CTA + navy `#032858` headings, preheader, plain-text twin — owner-mandated design (flawless 320/768/1200, non-technical, one message, one CTA).
- ~~**Founder block tokens**~~ (deleted 2026-10-04 — the trial templates no longer carry them): the two trial templates carried `{{FounderBlockHtml}}`/`{{FounderBlockText}}`; `BillingNotificationService.ApplyFounderOfferAsync` ALWAYS sets both (empty outside the founder window/cohort — placeholders never leak) and renders the cohort-locked codes only for targeted businesses (see clinqet-payments).
- **‼️ Backend `Resources/Localization/hi.json` + `gu.json` REPAIRED (2026-07-11):** they were Windows-1252 double-encoded UTF-8 — every hi/gu notification title/body rendered as mojibake in production paths. ~2200 values per file recovered losslessly (cp1252 reverse map + fatal UTF-8 decode). hi/gu are now REAL languages for backend notifications; keep new keys translated there (en-only fallback no longer the norm for notification copy).

## Tier-limits final audit fixes (2026-07-16)

- **Preference-category map completed:** `CommunicationPreferenceConfig.ProviderCategories[BillingPayments]` now lists the ENTIRE provider billing family — 27 types at the time, including the 4 Sunset types (removed 2026-10-04 with `SubscriptionUpgraded`) and 10 previously-unmapped post-launch billing types (`SubscriptionTrialStarted`, `SubscriptionPriceChangeScheduled`, `AiAssistantAutoRenewalOff/Resumed`, `AiAssistantUpgraded`, `SubscriptionAutoRenewalOff/Resumed`, `AutoRechargePackUnavailable`, `SubscriptionSwitchedToAnnual`, and the since-removed `SubscriptionUpgraded`). An unmapped type takes the dispatcher's all-channels fallback, which BYPASSES the provider's push opt-out and logs a warning per send — mapped types get mandatory email + preference-gated push. Pinned by `CommunicationPreferenceConfigTests` (all 27 mappings + mandatory-email/no-SMS category rules). The in-app+push-only types are unaffected on email (they carry no email template).
- **Provider-language meter notices:** the WhatsApp cap-reached/plan-blocked notices resolve the provider's preferred language (see clinqet-whatsapp).
- **French localization backfill:** all 16 tier-limits/sunset keys existed in `fr.json`; the 4 Sunset email templates (deleted 2026-10-04) + both trial templates exist in `EmailTemplates/fr/` on the canonical responsive shell with byte-identical token sets to en. The card-holder `SubscriptionTrialEndingSoon` template (previously old-shell en-only) was REGENERATED onto the responsive shell in en and translated to fr/hi/gu (same 9 tokens, deliberately NO founder tokens — card-holders convert, the winback targets non-converters).

## Two plans — plan-limit notices (2026-10-04)

Authority `C:\Nik\Data\two-plan-pricing\PLAN.md`. Removed `NotificationType` values: `SunsetAnnouncement`, `SunsetCutoverSoon`, `SunsetCutoverTomorrow`, `SunsetTrialStarted`, `SubscriptionUpgraded` (and their templates, keys, `SignalRSettings:EnabledNotificationTypes` entries and client routes). New notices ride the existing `SystemNotification` type, so no new `NotificationType` and no `EnabledNotificationTypes` change:

| Notice | Sender | Data `Type` | Channels | Deep link |
|---|---|---|---|---|
| Monthly free leads used (fires once, on the increment that reaches the cap) | `LeadQuotaNotifier` (via `LeadAccessGate`) | `LeadQuotaReached` (+ `MonthlyCap`) | in-app + push; Financial routing, `billing.read`, `BillingPayments`; event id `leadquota-{yyyyMM}` | `BillingPagePaths.Plan` |
| WhatsApp daily cap reached | `FailureNotificationHelper.HandleWhatsAppSendCapReachedAsync(businessId, cap, upgradeAvailable)` | `WhatsAppSendCapReached` | in-app + push | `BillingPagePaths.Plan` |
| WhatsApp plan-blocked | `FailureNotificationHelper` | `WhatsAppPlanBlocked` | in-app + push | `BillingPagePaths.Plan` |
| AI minutes cap | `VoicePostCallProcessorFunction` | — (its own `NotificationType.VoiceMinuteCapReached`) | unchanged | `BillingPagePaths.AiAssistant` |

- ‼️ **Premium is never told to upgrade.** `upgradeAvailable` is true only for tier `Free`. The WhatsApp cap body is
  `Notification_WhatsAppSendCapReached_BodyUpgrade` only then, else `_Body`. The other limit notices default to the upgrade
  wording and switch to a `*TopPlan` variant when there is no higher plan: `Notification_LeadQuotaReached_TitleTopPlan` /
  `_BodyTopPlan`, `Notification_WhatsAppPlanBlocked_BodyTopPlan`, `Notification_BroadcastReceivedLocked_BodyTopPlan`.
- **Over-quota leads:** a Free provider past `leads_quota` gets the lead row but NO `BroadcastReceived` email or WhatsApp; push + in-app go out only when `Broadcast:Matching:NotifyOverQuotaLeads` (default `false`), titled/bodied `Notification_BroadcastReceivedLocked_{Title,Body}` via `LeadNotice` (see `clinqet-quote-lead-broadcast`).
- **Clients:** a `SystemNotification` whose `Type` is `LeadQuotaReached` / `WhatsAppSendCapReached` / `WhatsAppPlanBlocked` opens the plan page — partner web `utils/notificationNavigation.js` (`PLAN_LIMIT_NOTICES` → `dashboardRoute.billing`), provider mobile `Util/notificationNavigation.ts` (`PLAN_LIMIT_NOTICE_TYPES` → `PlanAndBilling`; on a push it reads the type from
  `data.noticeType`, see PUSH CHANNEL).

## Password notifications (2026-07-22)

- `PasswordSet` is a distinct `NotificationType` from `PasswordChanged`. Both are emitted through `AccountNotificationService` only after Identity has completed the password mutation and rotated the session.
- Both types have localized notification title/body and email templates in en/fr/hi/gu. `PasswordSet` is also present in Main API `SignalRSettings:EnabledNotificationTypes` for real-time delivery.
- Both email families use the canonical fluid 600px table shell with mobile media rules and Outlook guards; keep HTML/plain-text token sets identical (`FirstName`, `WebAppOrMobileAppUrl`, `CurrentYear`) across all four locales.

## Business notification recipient routing — multi-user providers (Phase 5, 2026-08-02)

A provider is no longer one person. A business event must reach the right **people**, not one
hard-coded `RecipientUserNumber`. A **resolver sits in front of the dispatcher**; the dispatcher and
`NotificationProcessor` both stay **single-recipient** and are called once per resolved recipient
(decisions L4, L5, L93).

```
producer -> IBusinessCommunicationDispatcher.DispatchAsync(request, requestFactory)
              -> INotificationRecipientResolver.ResolveAsync  (SQL: routes, members, roles, prefs)
              -> for each recipient: requestFactory(recipient) -> ICommunicationDispatcher.DispatchAsync
                                                                  (UNCHANGED, single-recipient)
```

‼️ **`requestFactory` is invoked ONCE PER RECIPIENT and MUST render in `recipient.PreferredLanguage`.**
Building the `CommunicationRequest` outside the factory ships one language to everybody. That is the
single easiest way to break this pipeline and no compiler error catches it.

### The nine routing classes

`NotificationRoutingClass`: `PersonalSecurity` · `BusinessSecurity` · `Financial` · `WorkIntake` ·
`Assignment` · `DirectMessage` · `ContextMessage` · `Awareness` · `CustomerFacing`.

| Class | Recipients |
|---|---|
| `PersonalSecurity` | the affected person only — **zero** business queries |
| `BusinessSecurity` | affected member + every admin |
| `Financial` | permission-eligible members + configured finance route + every admin |
| `WorkIntake` | routed team (or everyone with the permission when unconfigured) + every admin |
| `Assignment` | assignee / assigned team / participants + every admin |
| `DirectMessage` | ‼️ **that member ONLY — NEVER the admin** |
| `ContextMessage` | assignee + admins; falls back to the configured route when unassigned |
| `Awareness` | **activity feed only — zero notifications, zero recipients** |
| `CustomerFacing` | the customer, unchanged |

**"Admin" always means the Primary Owner plus anyone holding the Administrator role, and admins are
never dropped by the branch filter or the recipient cap.**

### The classification catalogue is build-enforced

`Clinqet.Core.Services.Communication.NotificationRoutingCatalog` maps **all 140** `NotificationType`
members to a `NotificationRoutingDescriptor` (routing class, permission key, and which of
business/customer/personal scopes it supports). `NotificationRoutingCatalogTests` fails the build if a
type is unclassified. **Add a `NotificationType` ⇒ add its catalogue entry in the same change.**

‼️ **A live progress feed is TRANSIENT, never a record.** `VoiceOwnNumberCheckUpdated` (keep-your-own-number
verification, 2026-09-15) ships `PersistenceMode = Transient` with push/email/SMS/WhatsApp skipped: the screen that
started the check renders it and CLAIMS the event, so there is no toast and no bell entry, and the verdict itself
lives on the assistant state. Both apps' SignalR clients return `true` from the subscriber to claim it — the same
shape the Knowledge page uses. Its two siblings `VoiceAssistantReadyToConnect` / `VoiceAssistantAnswersAllEnabled`
are ordinary `BusinessSecurity` notifications.

Only business-scoped `SystemNotification` may pass `RoutingClassOverride` / `PermissionKeyOverride` /
`PreferenceCategoryOverride`; every other type throws (L87). `DirectMessageReceived` picks its class
from `Subject.ConversationContext` — `Direct` ⇒ `DirectMessage`, `Broadcast`/`Quote`/`Booking` ⇒
`ContextMessage`. A null context throws rather than guessing.

### SQL tables

- **`BusinessNotificationRoute`** `(BusinessId, EventCategory)` unique →
  `AllWithPermission | Team | ExplicitMembers | OwnerOnly`. **No row means "everyone with the
  permission"**, so an unconfigured business behaves exactly as it does today. An invalid route
  (deleted team, malformed explicit-member JSON) logs a warning and falls back to all eligible — it
  never fails the event.
- **`MembershipNotificationPreference`** `(MembershipId, EventCategory, Channel, DeliveryMode,
  Enabled)` holds **both** D8 preference surfaces in one table, discriminated by `IsTeamActivity`
  (L86): `false` = the member's own settings; `true` + nullable `AboutMembershipId` = an admin's
  team-observation settings (null = all members, set = that member). Three filtered unique indexes
  keep the shapes disjoint and `CK_MembershipNotificationPreference_TeamActivityShape` stops an own
  row targeting someone else.

‼️ **The two surfaces are independent by design.** An admin muting team activity must still receive
their own direct messages, their own assigned work and their own personal-security events. The
resolver picks `ResolveAboutPolicy` only for an admin who is a pure observer of the event; otherwise
`ResolveOwnPolicy`.

`Business.NotificationRouteVersion` is part of the route cache key, so an edit takes effect
immediately. Bump it whenever a route changes.

### Branch filter (`05-BRANCHES.md` §6.3)

Applied only when the subject carries `branchId` **and** the business has **2 or more active
branches**. Admins always pass. ‼️ **A branch with no staff falls back to notifying every eligible
member — never nobody.** A misconfigured branch must degrade to over-notifying, never to silence.

### Cost controls — `Notifications:*` (Main API + Functions `appsettings.json`)

`TeamBroadcastRestrictedToRouted` **true** · `MaxRecipientsPerEvent` 100 · `MaxConcurrentDispatches` 8 ·
`RouteCacheSeconds` 300 · `DeliveryIdempotencyTtlDays` 35 · `DeliveryLeaseSeconds` 900 ·
`DeliveryAcquireAttempts` 3 · `DigestWindowMinutes` 15 · `DigestRetentionDays` 2 ·
`DigestWriteAttempts` 3 · `DigestLeaseSeconds` 900 · `DigestMaxEventsPerBucket` 100.
Options-class defaults mirror these exactly and are `ValidateOnStart`.

**Measured SQL queries per resolved event — do not regress these:**
`PersonalSecurity` 0 · `CustomerFacing` 0 · `Awareness` 0 · `BusinessSecurity` 4 · `Assignment` 4 ·
`DirectMessage` 4 · `Financial` 5 · `WorkIntake` 5 · `ContextMessage` 5. Pinned by
`NotificationRoutingIntegrationTests.RoutingClasses_StayWithinMeasuredSqlQueryBudgets` with a real
`DbCommandInterceptor`.

Over the cap, admins and the routed set are kept, the remainder is dropped, a warning is logged and a
`NotificationRecipientsCapped` row goes to the activity feed — truncation is never silent (L91).

### Digest and idempotency — no new Cosmos container (L89)

Both live in the existing **`SystemData`** container with `id == partition key` (point reads only).
Digest buckets flush over the **`notification-digests`** queue to
`NotificationDigestProcessorFunction`. An empty bucket sends nothing.

Delivery identity is `SHA256(EventId | RecipientUserNumber | BusinessId)`; each processor appends its
channel. ‼️ **Producers must supply a durable `EventId` derived from the persisted transition** — an
ETag, a status plus version, a row id. **A `Guid.NewGuid()` or a timestamp defeats redelivery dedup
entirely** (L88).

### Mandatory email still cannot be defeated (L20)

`BookingNotifications`, `QuotesInvoices` and `BillingPayments` force `Email = Immediate` regardless of
any membership preference, stale row, digest mode or routing flag. If no administrator ends up with an
email dispatched, an admin alert is raised. A localized five-language `BusinessNotification` template
is the fallback when a producer supplies no specific template (L90).

‼️ **The ONE exception: `CommunicationRequest.EmailDeliveredElsewhere`** (2026-09-27). A notice whose email is
sent by a DIFFERENT path — today the branded receipt (PDF) from `BillingReceiptEmailProcessor` — is still in a
mandatory category, but an email sent *here* would be the **second** one. `BillingNotificationService` sets the
flag for `SubscriptionCharged`, `AiAddOnActivated` and `MinuteTopUpPurchased`, and the fan-out then (a) does not
substitute the `BusinessNotification` template, (b) skips the email leg, and (c) **skips the
"mandatory email reached no administrator" alert**, which would otherwise fire on every successful charge.

- ‼️ **A null `EmailTemplateName` is NOT that signal.** It is indistinguishable from "a mandatory notice forgot
  its template", which is exactly what the fallback exists to catch. Say it with the flag or not at all.
- ‼️ **Do NOT make a caller's `SkipEmail` beat the mandatory rule instead.** It looks equivalent and is not:
  `BookingService` sets `SkipEmail = true` in ~8 places and `BookingNotifications` is mandatory too, so that
  change would silently stop booking emails. Considered and REJECTED.
- Guarded by `MandatoryEmailIsNotDuplicatedTests` (Clinqet.API.UnitTests), which runs the REAL dispatcher.

### ‼️ Inbound keywords are matched through ONE normalizer, and answer in four languages (2026-09-27)

`InboundReplyKeywords` (clinqetshared) is the single table for BOTH text channels; `SmsInboundIntentParser` and the
two WhatsApp functions all match through `InboundReplyKeywords.Normalize` and the `Is*` helpers.

- **`Normalize` = trim → strip the punctuation a human leaves → strip ACCENTS → uppercase.** ‼️ Every table entry is
  stored WITHOUT accents: one entry then covers ARRET, arrêt, ARRÊT and even ARRÈT. **Never add an accented spelling
  as a separate entry** — it would match only itself and read as if the unaccented one were unsupported.
- **French and Spanish opt-out/opt-in/help are accepted** (ARRET/ARRETER/DESABONNER, PARAR/PARE/ALTO/BAJA/CANCELAR,
  AIDE/AYUDA, REPRENDRE/CONTINUER/REANUDAR/CONTINUAR/SUSCRIBIR). Every template still ADVERTISES the English word in
  all five languages — the localized ones are a safety net for the reader who ignores the instruction, which is
  exactly the reader who types their own language (CTIA/CWTA practice for a non-English programme).
- ‼️ **Spanish ALTA ("subscribe") is deliberately ABSENT** — one letter from ALTO ("stop"). Reading a mistyped opt-out
  as an opt-in would resume messaging someone who meant to end it.
- ‼️ **WhatsApp takes only the COMMAND words** (ARRET, DESABONNER): ALTO, PARE, PARAR, BAJA and CANCELAR are ordinary
  Spanish a customer may open a message with, and eating them would silence a live conversation. Same test the
  existing CANCEL/END/QUIT narrowing applies.
- ‼️ **Splitting is on ANY whitespace, not a literal space.** A phone keyboard sends a newline or a non-breaking space
  often enough, and `"STOP\n"` reaching Unknown means we keep messaging someone who asked us to stop.
- A word may never sit in two tables — `NoWord_MeansTwoDifferentThings` makes that impossible rather than merely
  currently true.

### ‼️ Handing a message to a queue — the only place a notice can be LOST

Once the broker accepts a message, redelivery and the DLQ take over. The **send** is the whole loss window, and
every send on every host (API · Functions · Identity · MCP) funnels through one method,
`ServiceBusService.ExecuteWithRetryAsync`. There is no second place to change.

- **Backoff** (2026-09-27): exponential, jittered, capped — `RetryBaseDelayMs` << attempt, clamped to
  `RetryMaxDelayMs`, spread ±`RetryJitterPercent`. Defaults 100ms / 1000ms / 25% ⇒ three retries cost ~1.4s.
  ‼️ **A send blocks a live request**, so the budget exists to ride out a blip, never to wait out an outage;
  `TheDefaults_KeepEveryRetryUnderTwoSeconds` fails the build if it grows past 2s. Permanent failures (entity
  missing, credential rejected, entity disabled) are still never retried.
- **When every attempt is spent** the notice is gone, so `AdminAlertType.NotificationSendFailed` is raised with
  what it takes to deliver it by hand: business, recipient, notification type, subject, **`CorrelationId`**, the
  **scrubbed + capped payload**, `SendingHost`, language, queue/message/attempt facts. Keyed per
  **(queue, business, 15-min window)** — a per-queue key would collapse an outage into one useless row.
  ‼️ `BusinessId`/`BusinessName` go on the AdminAlert **entity columns**, not only `Metadata`, because the admin
  list filters on the columns. Severity is `Critical` when the call site passed `forceAdminAlert`.
  ‼️ A message with nothing identifying raises **no** such alert — the gate reads IDENTITY fields only, never the
  ambient `CorrelationId`/`PreferredLanguage` every message inherits, or an analytics event would look like a
  lost notice. All of it is settings-bound in **all four hosts'** `appsettings.json`.

### Checklist for a new business-routed producer

1. Add the type to `NotificationRoutingCatalog` (the build fails otherwise).
2. Inject `IBusinessCommunicationDispatcher` (**scoped**, via `AddNotificationRouting`).
3. Supply a **durable** `EventId`, the real `BusinessId`, and a `Subject` built with
   `ToScopedResource()` off the already-loaded document — never re-read it just to route.
4. Render title/body **inside** `requestFactory` using `recipient.PreferredLanguage`.
5. Keys in **all five** localization files; email templates in all five languages.
6. `Awareness` types need no recipients — they only need the activity-feed arguments.

### Dispatch failure is alerted, not just logged (L94)

A producer swallows a dispatch failure so it cannot fail the business transaction — so
`BusinessCommunicationDispatcher.DispatchAsync` **catches, raises an admin alert, then rethrows**. The
alert is gated by **`Notifications:EnableAdminAlertOnDispatchFailure`** (default `true`), matching the
platform's `EnableAdminAlertOnFailure` convention. Raising it inside the dispatcher means one call site
instead of ten, and the rethrow keeps L87/L88 programming errors loud in tests. The alert send is itself
wrapped, so a dead Service Bus can never replace the original exception. Alert wording is
admin-internal English — the one permitted exception to §0.10.

---

## ‼️ MULTI-USER TENANCY — PHASE 6 (2026-08-03). Read before touching messaging or notifications.

### The routing rule that changed (L106, owner-decided)

`ConversationContext.Direct` does **NOT** mean "a private 1:1 between two people". It is what **every**
customer↔business chat uses, including WhatsApp inbound. `DirectMessageReceived` on **any** conversation
context now resolves to **`NotificationRoutingClass.ContextMessage`**:

```
unassigned thread  ->  everyone with conversation.read  +  admin
claimed thread     ->  the assignee + their team + watchers  +  admin
```

Before this, `Direct` routed to the `DirectMessage` class, which resolves `Subject.DirectTargetMembershipId`
and nothing else — **null on a shared thread, so an unclaimed customer message notified NOBODY.**

‼️ `NotificationRoutingClass.DirectMessage` is **retained but currently unreachable** (L111). Do not delete
it: `BusinessEventCategory.DirectMessage` is a SQL-persisted enum value on
`MembershipNotificationPreference.EventCategory`, and the class encodes owner-locked rule **L21** for the
member-to-member messaging that does not exist yet.

### Adding a NotificationType requires FIVE edits, and one of them is a test

1. the `NotificationType` enum member
2. a `NotificationRoutingCatalog` entry
3. ‼️ **`BuildExpected()` in `NotificationRoutingCatalogTests`** — the test keeps its OWN contract map, and its
   failure message reads as if the catalogue is stale when it is the test that is incomplete
4. a `CommunicationPreferenceConfig` category mapping
5. a `SignalRSettings:EnabledNotificationTypes` entry + title/body keys in **all five** language files

‼️ If the affected person is **not an Active membership** when the event fires (suspension, removal, an
outgoing owner after a transfer), business scope reaches the admins and **never** them —
`NotificationRecipientResolver.LoadGraphAsync` loads Active members only. Those types set
`SupportsPersonal = true` and are dispatched **twice**, once per audience, with separate
`Notification_{type}_Self_*` copy.

### The provider inbox

The provider-side `Conversation` is keyed on **`BusinessId`**, the customer-side mirror on the customer's
`UserNumber`. Controllers resolve their side through `BaseController.GetCurrentConversationParticipantId()` —
never `GetCurrentUserNumber()`.

- **Five views**, all single-partition: Unassigned / Assigned to me / My team / Watching / All. ‼️ There is
  **no Overdue view** — `slaDueAt` is deferred to Phase 8 (L98).
- Every view is filtered by the caller's own `conversation.read` **scope**, so the view name describes the
  query and never escalates what a member may see.
- **Atomic claim**: `IConversationRepository.TryClaimAsync` — a conditional PATCH guarded by BOTH the document
  ETag AND a `conditionExpression` asserting it is still unassigned. Never read-then-write. The 412 loser is
  told **who** holds it.
- ‼️ Unread count, mute, hide and TTL are **business-wide** on the provider side (L107). That is what makes it
  a shared queue.

### ‼️‼️ The cross-business write guard (L85)

**Every** assignment surface calls `IBusinessAssignmentGuard.TargetsBelongToBusinessAsync` before writing a
membership or team id onto a record. There is exactly **ONE** implementation, deliberately — a second copy is
where the check goes missing. Without it an assignment API is a cross-tenant write primitive.

Assignment writes currently ship for **`Conversation` and `Booking` only** (L108). `Quote`, `Invoice` and
leads are Phase 8, which adds the `ProviderData` index path in the same change as its query.

### Member lifecycle

- ‼️ **The primary owner can be neither suspended nor removed.** Ownership must be transferred first.
- Removal is a **workflow, not a delete** — the membership row survives so the business keeps its record of
  who did what, and historical actor attribution is **never** rewritten.
- Reassignment is **batched** (`Tenancy:Lifecycle:ReassignmentBatchSize`) and reports
  `ReachedBatchCeiling` rather than truncating silently.
- ‼️ Any membership/role/team/branch change must bump `AuthorizationVersion` **and** write an
  `AccessChangeQueue` row **in the same transaction**. Use `AccessChangeStaging.Stage` — it does both, so they
  can never be written apart.

### Per-branch opening hours

`BranchAvailabilityResolver` (in `clinqetcore`) is the one place the rule lives:

```
effectiveHours(branch B) = rows WHERE branchId = B  ELSE  rows WHERE branchId IS NULL
```

‼️‼️ **ABSENT ROWS MEAN INHERIT, NEVER CLOSED.** A branch that is genuinely shut carries an explicit row with
`isAvailable = false`. Treating "no rows" as "closed" would silently shut every branch nobody customised.

The search index publishes the **UNION** across active branches and its **shape is unchanged — zero new
fields**. `IBranchDirectory` supplies the active branch ids and is consulted **only** when a provider actually
has branch-tagged rows, so the common path costs nothing.

### Invitations

The token is a **credential**: ≥256 bits, **only its SHA-256 hash is persisted**, compared with
`CryptographicOperations.FixedTimeEquals`, single-use, and **both resend and revoke ROTATE the hash** so the
emailed link dies immediately. It travels in the request **body**, never a route segment. Acceptance requires
the signed-in person's **verified** email to equal the invited address — a correct token in the wrong hands
still fails. Seats are checked at issue (`CanGrantSeat`) and at accept (`IsOverTierLimit` — accepting is
**seat-neutral**, so `CanGrantSeat` there would refuse the last legitimate joiner).

### Infrastructure obligations that ship in the same change

A new `local.settings.json` key needs a `deploy.ps1` entry in the required-settings list **and** both host
blocks, plus the ARM template. ‼️ **Never edit `deploy.ps1` with `perl`** — a single non-ASCII character
corrupted it into 426 parse errors that `grep` could not see. Back it up and validate afterwards with
`[System.Management.Automation.Language.Parser]::ParseFile`.

---

## ‼️ MULTI-USER TENANCY — PHASE 7 (2026-08-03). The producer sweep.

### The defect: 18 producers addressed a business as if it were a person

Every asynchronous provider-side event in the Functions host dispatched to
`RecipientUserNumber = businessId`. Under tenancy a `businessId` is **not** a user number, and all three
real-time channels key on a person:

| Channel | What it did | Result |
|---|---|---|
| in-app | wrote to a `Communications` partition keyed by `businessId` | `NotificationController` never reads that partition |
| push | tagged `userNumber:{businessId}` | matched zero devices |
| SignalR | targeted group `notif:{businessId}:Provider` | zero connections |

Email was the only leg that could still land, because it addresses `RecipientEmail` rather than a user
number. Any site that set `SkipEmail = true` or carried no template had **no surviving channel at all**.

This is the **third** occurrence of this family (L99's empty inbox, Phase 7 part 1's voice-live group,
this sweep). All three times a fully green suite covered none of it, because every assertion was written
against the same wrong address the production code used.

**Full evidence table:** `C:\Nik\member-provider\phase-07-function-audit.md` — all 68 `[Function]`
attributes, five questions each.

### `BusinessEventId` — the durable-EventId helper (L88)

`clinqetcore\Services\Communication\BusinessEventId.cs`. Eighteen call sites must not each invent their
own identity scheme. A random GUID, `DateTime.UtcNow`, or a per-attempt id is **INVALID**: Service Bus
redelivery would mint a new identity and the per-recipient delivery-idempotency store could not
deduplicate it.

```csharp
BusinessEventId.ForBooking(booking, NotificationType.BookingCancelled)
BusinessEventId.ForInvoice(invoice, notificationType)
BusinessEventId.ForService(service, notificationType)
BusinessEventId.ForLead(broadcastId, businessId, notificationType)   // one event per matched provider
BusinessEventId.ForCall(callId, notificationType)
BusinessEventId.ForBusinessPeriod(businessId, "yyyy-MM", notificationType)
BusinessEventId.For(subjectKind, subjectId, notificationType, version)
BusinessEventId.VersionOf(entity)                                    // ETag ?? UpdatedAt ticks
```

**Use the `version` overload when a genuine re-occurrence must be a new event.** Examples in the tree:
reminder number (`"{bookingId}|r{n}"`), broadcast status transition (version = new status), and a lead
re-edit (version = `VersionOf(provider)`, so a real edit is a new event but a redelivery is not).

### ‼️ L94 IS NOT UNCONDITIONAL — the guard is wrong where the notification IS the work product

The rule reads "producers swallow dispatch failures". It protects a business transaction that has
**already been persisted** from being failed by a notification. It does **not** apply when the
notification is the only thing the message exists to do.

`ProviderConfirmationProcessor` is the worked example. Swallowing there completes the Service Bus message
while **no member was ever asked to confirm**, and the booking then times out on the customer. It must
throw so the message retries and dead-letters.

```csharp
// ‼️ NOT L94-guarded, and that is deliberate. The notification IS the work product here.
await _businessCommunicationDispatcher.DispatchAsync(...);
```

Apply the guard only when you can name the row that is already committed. `BookingCancellationProcessor`
can (the cancellation); `ProviderConfirmationProcessor` cannot.

### ‼️ TWO WAYS A NOTIFICATION TEST PASSES WITHOUT TESTING ANYTHING

**1. A bare mock never invokes the factory.** The real dispatcher calls `requestFactory` **once per
recipient**. `Mock.Of<IBusinessCommunicationDispatcher>()` calls it zero times, so every assertion about
notification *content* — title, body, language, deep link — passes vacuously.

Use the recording doubles instead:
- unit: `Clinqet.Communications.UnitTests\Helpers\BusinessDispatcherTestDouble.cs` —
  `WithTeam(("OWN01","en"),("EMP02","fr"))` proves per-recipient rendering; `CountFor`, `RenderedFor`,
  `ThrowFor`, `DeliverNothingFor` cover the failure paths.
- integration: `Clinqet.Communications.IntegrationTests\Helpers\PassThroughBusinessDispatcher.cs` —
  renders for one resolved recipient and forwards to the underlying `ICommunicationDispatcher`, so
  existing raw-dispatcher assertions stay meaningful.

**2. `Awareness` never reaches the raw dispatcher at all.** An Awareness type resolves **zero recipients
by design** and writes one activity row (L91), so its call site legitimately passes
`_ => new CommunicationRequest()`. Any assertion of the form
`dispatcher.Verify(..., Times.Once)` on the **raw** dispatcher therefore sits at zero — and a
`Times.Never` assertion passes no matter how badly the producer is broken, including if it never ran.

For an Awareness producer the **only** evidence is the business-layer request:

```csharp
Assert.Equal(1, businessDispatcher.CountFor(NotificationType.CallSummaryReady));   // idempotency
Assert.NotEmpty(failureBusinessDispatcher.Requests);                              // the helper ran
```

`PassThroughBusinessDispatcher` models this correctly — it consults `NotificationRoutingCatalog` and
short-circuits Awareness *before* invoking the factory. A double that forwarded Awareness anyway would
manufacture a dispatch production never makes, which is the same vacuous-pass hazard inverted.

### ‼️ Live-call watch is re-authorized on a cadence, server-side (L120, edge case 11)

Authorizing only at JOIN left a member **suspended mid-call** still receiving the transcript, because
SignalR group membership has no TTL. `NotificationHub.StartVoiceWatchRevalidation` now re-checks the
**cached** authorization snapshot every `SignalRSettings:VoiceLiveWatchRevalidationSeconds` (default 60)
and removes the connection from `voicelive:{businessId}` itself.

**The server drives it**, so a client that simply stops calling in cannot evade it — that is what makes it
a control rather than UX. It needs **no distributed cache**: a SignalR connection is server-affine, so the
server that owns it can act on it. Only *finding* a connection owned by another server would need shared
state, and nothing here does.

‼️ `IAuthorizationSnapshotProvider` is **scoped** — the loop resolves it per pass via
`IServiceScopeFactory`. Capturing the hub's injected instance would be a captive dependency.

A warm snapshot check costs **zero SQL**, which is what makes a cadence affordable at all (L61).

---

## ‼️ THE NOTIFICATION-SETTINGS ENDPOINTS — Phase 8B1, 2026-08-03

Phase 5 shipped the **tables** (`BusinessNotificationRoute`, `MembershipNotificationPreference`) and no public
endpoint. `IBusinessNotificationSettingsService` +
`BusinessNotificationSettingsController` (`api/v1/business/notifications`) is now the **only** public surface
over them. **No schema was added.**

| Endpoint | Permission | Notes |
|---|---|---|
| `GET/PUT routing` | `notification_policy.read` / `.manage` (Primary Owner + Administrator only) | Business routing |
| `GET/PUT preferences` | active business context | The member's OWN delivery settings, per business |
| `GET team-activity` · `PUT team-activity/class` · `PUT team-activity/member` · `POST team-activity/reset` | active business context | §14.8 / D8 |

‼️ **The member's own settings and the team-activity control share a table and must NEVER share a mutation.**
They are discriminated by `IsTeamActivity`, and merging the payloads would let a screen about colleagues change
what reaches the member themself.

### ‼️ `emailMandatory` spans two deliberately unrelated enums

`CommunicationPreferenceConfig.MandatoryEmailCategories` is keyed by **`PreferenceCategory`**;
`MembershipNotificationPreference.EventCategory` is a **`BusinessEventCategory`**. There is **no direct lookup** —
the enum's own comment calls them distinct. The bridge lives in **`NotificationRoutingCatalog`** (which already
owns `ToBusinessEventCategory`) so exactly one mapping exists and no client carries a copy:

```
NotificationRoutingCatalog.IsEmailMandatory(BusinessEventCategory)   // NewWorkIntake, AssignmentTask, Financial
NotificationRoutingCatalog.DeliversToRecipients(BusinessEventCategory)  // false for Awareness + PersonalSecurity
NotificationRoutingCatalog.HonoursConfiguredRoute(BusinessEventCategory) // Financial, NewWorkIntake, ContextMessage ONLY
```

The server **rejects** an attempt to switch a mandatory email off (`notification_email_mandatory`) — the UI lock
is not the control.

### ‼️ Two classes whose backend does nothing, and how they are rendered

| Class | Reality | Rendering |
|---|---|---|
| **`AssignmentTask` on the ROUTING screen** | `NotificationRecipientResolver` loads a configured route only for `Financial`, `WorkIntake`, `ContextMessage`. A route for `AssignmentTask` is **inert** | Informational card with the recipient count, **no segment**. Server returns `notification_route_not_adjustable`. Decision **B1** |
| **`Awareness` on the member's own screen** | `ResolveAsync` returns `Empty(...)` for `Awareness` — **zero recipients, by design** (L91) | Stated row with the reason, **no live dropdowns**. Server returns `notification_class_not_deliverable`. Decision **B3** |

**`BusinessSecurity` team-activity is refused outright** (`team_activity_not_adjustable`, NS-4): an administrator
quietly muting security events about one colleague is the exact shape of an insider-risk gap.

### ‼️ Every route write MUST bump `Business.NotificationRouteVersion`

The resolver's cache key is `notification-route:{businessId}:{category}:{version}` with a 300 s TTL, so an edit
that does not bump it **does not apply for five minutes** — a settings screen that appears to work and silently
does not. Pinned by `SavingARoute_BumpsTheCacheVersion`.

### The team-activity storage shape

**Absence means ON.** `Everyone` = no rows. Otherwise the write picks whichever of two equivalent encodings costs
fewer rows — *catch-all `Off` + a row per kept colleague*, or *a row per excluded colleague and no catch-all* —
and the READ derives the audience from the **resolved** per-colleague state (`specific ?? catch-all ?? on`), so it
is encoding-independent. 30 colleagues keeping 6 costs **35 rows, not 120**. NS-3: the screen has **no channel
dimension** and writes all five channels at once.

---

## THE THREE NOTIFICATION-SETTINGS SURFACES — where they live and what they must never do (Phase 8 Part B2)

Three surfaces that must never be confused with each other. B1 built the endpoints and the web panels;
**B2 mounted them and mirrored them on provider mobile.**

| Surface | Whose setting | Lives at |
|---|---|---|
| **Business routing** — who the business tells when new work arrives | the business (admin) | web `/dashboard/team/notifications` · mobile `NotificationRouting` screen. **Reached from the TEAM screen**, gated on `notification_policy.read` |
| **My notifications, in this business** | mine | web `/dashboard/profile/notifications` · mobile `ProfileNotificationScreen` — **above** the platform-wide account card |
| **What I hear about my team's work** (§14.8) | mine | the same screen, directly below. **NS-6: never under Team settings** |

### ‼️ The per-business surfaces COEXIST with the platform-wide account card

`clinqetwebpartnerapp/src/components/Profile/Notifications.jsx` (and the mobile
`ProfileFlow/NotificationScreen`) render **three** things in order: `MyNotificationsPanel` →
`TeamActivityPanel` → the platform-wide account preferences (`GetCommunicationPreferences`,
`PreferenceCategory`-keyed). **Do not merge them.** One is "what this business sends me"; the other is "what
Clinket sends me about my own account, the same for every business, and always on".

The web component's default export is a composition; the original 495-line component is the inner
`AccountNotifications` and keeps its own data path untouched.

### The rules

`NOTIFICATION_CHANNELS` (`InApp · Email · WhatsApp` — Push and Sms travel in the payload and are deliberately
not drawn, B2) · `NOTIFICATION_DELIVERY_MODES` · `eventCategoryLabel` · `channelCell` · `routeSummary` ·
`teamActivitySegment` · `teamActivityPersonSummary` · `teamActivitySummary` · `showsTeamActivitySection`.

| Rule | The thing to get right |
|---|---|
| `channelCell` | A mandatory email is a **locked cell + a lock mark + one line of reason** (edge case 27). **Never an enabled toggle that silently does nothing** |
| `showsTeamActivitySection` | ‼️ In a **solo business the whole §14.8 section is ABSENT** — not an empty state, not a card saying "you have no team" |
| `teamActivitySegment` | Three-way **Everyone / Some people / No one**; only *Some people* expands, and a partial selection ALWAYS carries its count |
| `routeSummary` | A route pointing at a deleted team falls back to everyone, and the card warns **while the route is live**, not in a toast afterwards |

### ‼️ Non-negotiables the screens encode

- **The separation statement renders BEFORE the data loads**, above the fold, with a **working** link. B2 found
  it rendering with no handler — the link was simply absent, which is the dead control the no-stub rule forbids.
  Both apps now move the reader to their own settings.
- **The plain-language summary is built from the SERVER's state and re-read after every save AND every
  failure.** A switch that disagrees with the server is the worst outcome on a settings screen.
- **A failed save reverts the switch and re-reads**, and the message names what is still true.
- **One write per CLASS and one per PERSON** — 30 colleagues is one call, never 120.
- **No channel dimension on the team-activity screen** (NS-3). It decides whether you are a recipient; your own
  delivery settings decide how.
- **The security class is rendered and LOCKED, never hidden** (NS-4).

### ‼️ Mobile: a 403 here must not sign the provider out

Every tenancy refusal is a 403, and `apiManager.fetchWithAuth` force-logs-out on any 403 it does not recognise
as a domain answer. **`/business/notifications` and `/business/inbox` are both in `isDomainForbiddenUrl()`**,
and `__tests__/tenancyForbiddenIsNotLogout.test.ts` pins all 13 URLs plus one unrelated 403 that still signs
out. Adding a tenancy endpoint means adding it there in the same change.

### Localization

110 web keys (B1) + the mounts' own. Mobile keys are the nested `NOTIFICATION_SETTINGS.*` twin, **generated
from the web catalogs** so the two apps cannot diverge, with `tenancyKey()` mapping ids at runtime and
`__tests__/tenancyLocalizationKeys.test.ts` proving every rule-produced id resolves.

---

## ‼️ MULTI-USER TENANCY — PHASE 9 (2026-08-04). No change here, and the four rules that must not drift.

> **The whole model is now one skill: read `clinqet-provider-teams` before any tenancy change.**

**Phase 9 changed NOTHING in this pipeline** — no new `NotificationType`, no catalogue entry, no routing
change, no template, no queue. It is recorded here because a later phase auditing notifications needs to
know the routing state is **final**, and because these four rules are the ones most likely to be
"improved" by a session that has not read the history.

### 1. ‼️ The L94 guard is CONDITIONAL — applying it uniformly is a BUG (L119)

**L94:** a business-notification dispatch never fails the business transaction that triggered it, because
the resolver performs a **SQL** read the pre-Phase-5 path never did, and
`BaseController.HandleLocalizedException` maps `InvalidOperationException` to **HTTP 400** — so an
unguarded dispatch turned an **already-persisted** booking transition into a *client* error and told the
user it failed when it had already succeeded (casebook CASE 3).

‼️ **L119 corrects it. The guard applies ONLY where a business transaction is already PERSISTED.** Where
the notification **IS** the work product — `ProviderConfirmationProcessor`, whose entire message exists to
ask a member to confirm a booking — swallowing **completed the Service Bus message with nobody asked**,
and the booking then timed out on the customer, silently. Those sites must **throw** so the message
retries and dead-letters.

> **The mechanical test: NAME THE ROW THAT IS ALREADY COMMITTED. If you cannot, do not guard.**
> `BookingCancellationProcessor` can (the cancellation). `BroadcastProcessorFunction` can (the claim).
> `ProviderConfirmationProcessor` cannot.

The alert is raised **once, from one place**: `BusinessCommunicationDispatcher.DispatchAsync` catches,
raises it when `Notifications:EnableAdminAlertOnDispatchFailure` is true (default), then **RETHROWS** — so
programming errors (L87/L88) still surface loudly in tests. The alert send is itself wrapped so a dead
Service Bus cannot replace the original exception.

### 2. ‼️ A customer's message routes as `ContextMessage`, not `DirectMessage` (L106) — do not "fix" it back

`ConversationContext.Direct` is what **EVERY** customer↔business chat uses, including WhatsApp inbound.
The `DirectMessage` class resolves `Subject.DirectTargetMembershipId` **and nothing else**, so on an
unclaimed thread it resolved **ZERO recipients** and the provider was **never told a customer had written
to them** (casebook CASE 19). `00-SOLUTION` §8.3.2 already lists *"WhatsApp reply"* under the
context-message class, so the locked table always expected this routing.

Unassigned ⇒ everyone with `conversation.read` + admin (or the configured route);
claimed ⇒ assignee + their team + watchers + admin.

‼️ **This is NOT re-opening L21.** `NotificationRoutingClass.DirectMessage` is **RETAINED** (L111) because
`BusinessEventCategory.DirectMessage` is a **SQL-persisted enum value** on
`MembershipNotificationPreference.EventCategory`, so the class cannot be removed without a schema change —
and the branch is the encoded form of L21, which the platform needs the moment member-to-member messaging
ships. It is currently **unreachable**, and that is correct.

### 3. ‼️ A branch with no staff falls back to ALL eligible members — never nobody

`NotificationRecipientResolver.ApplyBranchFilter` runs **only** when the subject carries a `branchId`
**and** the business has 2+ active branches; admins always pass; and when `hasBranchStaff` is false the
eligible non-admin set is **unioned back in**. Pinned by
`EmptyStampedBranchFallsBackToAllEligibleMembers`. **Read the code, not the doc** — this was verified line
by line during Phase 9's branch sweep.

‼️ The role catalogue grants **zero** `PermissionScope.Branch` permissions today, so a Branch-scoped grant
would be the first to evaluate against a `BranchIds` list that is only loaded under those two conditions.

### 4. ‼️ Two independent preference surfaces, in ONE table, and the indexes are load-bearing

`MembershipNotificationPreference` stores **both** D8 surfaces discriminated by `IsTeamActivity` + nullable
`AboutMembershipId` (L86), with **three filtered unique indexes** and
`CK_MembershipNotificationPreference_TeamActivityShape`.

‼️ **`ResolveOwnPolicy` calls `.Single()`** on each channel group and `ResolveAboutPolicy` calls
`.SingleOrDefault()`. **Safe ONLY because of those three indexes — do not relax them.**

‼️ **An admin's OWN notifications are NEVER affected by the team-activity toggles.** Turning off "team work
updates" must not silence their own DMs, their own assigned work or their personal security events.

### The measured SQL budget per resolved event — a later phase must not regress these

`PersonalSecurity` **0** · `CustomerFacing` **0** · `Awareness` **0** · `BusinessSecurity` 4 ·
`Assignment` 4 · `DirectMessage` 4 · `Financial` 5 · `WorkIntake` 5 · `ContextMessage` 5.
Pinned by a real `DbCommandInterceptor` in `RoutingClasses_StayWithinMeasuredSqlQueryBudgets`.

‼️ **`Direct` resolving to `ContextMessage` is why `ContextMessage` is 5, not 4** —
`NotificationRoutingIntegrationTests` encoded the PRE-L106 budget in three places and had to be rewritten
as **unclaimed vs claimed**, because the old Direct-vs-Booking contrast had become **vacuous** once both
contexts resolved identically.

### Adding a `NotificationType` is a FIVE-place change

1. the enum (**129 members**), 2. `NotificationRoutingCatalog`, 3. ‼️ **`BuildExpected()` in
`NotificationRoutingCatalogTests`** — the test keeps its **own hand-written contract map**, and its failure
message reads as if the catalogue were stale when it is the **test** that is incomplete,
4. `SignalRSettings:EnabledNotificationTypes`, 5. a `CommunicationPreferenceConfig` category mapping plus
title/body keys in **all five** languages.

‼️ **Prefer NOT adding one.** The ownership-transfer *reminder* reuses
`BusinessOwnershipTransferInitiated` with a reminder-scoped `EventId` (A3) precisely because a new type
needs all five to say what the existing copy already says. And ‼️ **for a claim/assignment push a
`NotificationType` is the WRONG shape entirely** (B15) — that path persists a Cosmos notification and fans
out a **push** for every claim. **A claim is visibility, not responsibility.** The right shape is the
business-keyed **voice-live watch group**: no Cosmos write, no push, no `EnabledNotificationTypes` gate.
**The owner CLOSED this on 2026-08-04: the push is NOT to be built and its absence is not a gap.**

### The two ways a notification test passes vacuously

- ‼️ **`Mock.Of<IBusinessCommunicationDispatcher>()` never invokes `requestFactory`**, so every assertion
  about the *content* of a business notification passes **vacuously**. Use `BusinessDispatcherTestDouble`
  (unit) or `PassThroughBusinessDispatcher` (integration).
- ‼️ **For an `Awareness` producer, `Times.Never` on the raw dispatcher proves NOTHING** — it sits at zero
  whether the producer worked perfectly or never ran at all. Assert on the **business-layer request**.
- ‼️ **A double MORE permissive than production is as dangerous as one that is less.** The first
  `PassThroughBusinessDispatcher` invoked the factory unconditionally and manufactured a dispatch
  production never makes, because `Awareness` resolves **zero** recipients by design (L91).
  **The double must model the routing RULE, not just the interface.**
- ‼️ **`requestFactory` runs ONCE PER RECIPIENT and must render in `recipient.PreferredLanguage`.**
  Building the `CommunicationRequest` outside the factory ships one language to everybody — **no compiler
  error, no test failure** unless a test asserts two languages.

---

## PHASE 10 PART 1 — THE DATA/SCHEMA/PERSISTENCE AUDIT (2026-08-04)

> Phase 10 is the first **AUDIT** phase (10-14 FIND AND FIX). Part 1 ran four of the seven sweeps and
> fixed two live defects. ‼️ **Phase 10 PART 2 is the FINAL part** and owns S1 (orphan), S4
> (index-binding), S6 (persistence), the N+1 half of S7, and FINDING 3.
> **Baseline after Part 1: 13,802 passed / 0 failed / 0 skipped across all nine suites.**

### ‼️ Two live defects found and fixed

**1. Eight voice-lifecycle notifications reached the wrong Cosmos partition; two reached NOBODY (DA1).**
`VoiceAssistantService.DispatchPartnerNotificationAsync` and `DispatchNumberLifecycleNotificationAsync`
passed `RecipientUserNumber = profile.BusinessId` to the **raw single-recipient** `ICommunicationDispatcher`.
A `BusinessId` is not a `UserNumber`, so `NotificationProcessor` wrote the in-app document into a
`Communications` partition **`NotificationController` never reads**, push tagged `userNumber:{businessId}`
(zero devices) and SignalR targeted `notif:{businessId}:Provider` (zero connections). Email was the only
surviving leg — and **`VoiceAssistantActivated` and `VoiceAssistantRejected` carry no email template**, so
those two reached nobody at all.

‼️ **`NotificationRoutingCatalog` already classified all eight as `Business`/`BusinessSecurity`** — the
catalogue and the producer disagreed, and the catalogue was right. **The fix:**
`IBusinessCommunicationDispatcher`, a per-recipient factory, and a durable `EventId`
(`BusinessEventId.For("voiceassistant", businessId, type, VersionOf(profile))` — **L88**), with the
**L94** guard retained because the profile mutation is already committed.

‼️ **How it hid, and the rule it produces:** Phase 7's producer sweep was scoped to the **Functions host**
and evidenced by a 68-row table of `[Function]` attributes. This producer is an infrastructure **service**
and could not appear in it. **A sweep bounded by a directory or an attribute is bounded by the wrong
thing** — casebook **CASE 21**.

**2. Deleting a team orphaned booking 101+ onto the deleted team (DA2).**
`BusinessTeamStructureService.ReleaseTeamBookingsAsync` read exactly one page —
`GetAssignedToTeamAsync` is bounded by `CosmosDb:MaxItemCount` (100) per **L84** — and neither looped nor
reported a ceiling, while `DeleteTeamAsync`'s own comment states the invariant it was breaking
(*"a conversation pointing at a team that no longer exists would match no view at all"*). Now a drain
loop bounded by the existing `Tenancy:Lifecycle:MaxReassignmentItems` (1000), logging a Warning at the
ceiling. ‼️ **A bound is only safe if the caller either DRAINS it or REPORTS it** — casebook **CASE 21b**.

### ‼️ What the sweeps CLEARED, and by what method

- **Cross-partition (S3): CLEAR.** `grep` for `PartitionKey.None` / `EnableCrossPartitionQuery` /
  `CrossPartition` across all seven backend projects returns **zero production matches**.
  `CosmosDbRepository`'s 14 data entry points all throw on a blank partition key, and the two that look
  unguarded (`ExecuteScalarQueryAsync(QueryDefinition,…)`, `GetFilteredItemsAsync`) delegate to guarded
  methods. ‼️ **19 of the 53 repositories do NOT derive from the base** and hold their own `Container`, so
  all **23** production `GetItemQueryIterator` call sites were enumerated individually — every
  `QueryRequestOptions` carries a concrete `PartitionKey`. ‼️ **`AdminAlertRepository.GetAlertsPagedAsync`
  is a per-MONTH fan-out of single-partition queries, not a cross-partition query**, despite a test whose
  name says "CrossPartitionQueries".
- **Migrations (S2): CLEAR.** All six tenancy `Up` blocks read line by line; every
  `DropIndex`/`DropColumn`/`DropTable`/`AlterColumn` accounted for. `SeedDbContext` matches
  `AppDbContext` for every column it declares, and every column it omits is nullable, DB-generated or
  defaulted. `cosmosindexsetup` applies all 8 container policies through `ReplaceContainerAsync`, so a
  re-run genuinely updates an existing container.
- **L81: CLEAR.** The only `c.branchId` query predicate is `BookingRepository.cs:439`, on `Transactions`,
  which **does** carry `/branchId/?`. `ProviderData` still needs none.
- **`UX_BusinessBranch_Business_Default`:** the index is correct (**filtered `[IsDefault] = 1`**, so many
  branches and at most one default) — **and it was completely untested until now.**

### ‼️ FINDING 3 — OPEN, owned by Phase 10 Part 2

The six provider-inbox conversation queries (`BuildUnassignedQuery`, `BuildAssignedToMembershipQuery`,
`BuildAssignedToTeamsQuery`, `BuildWatchedQuery`, `BuildAllForBusinessQuery`, overdue) are **unbounded
`SELECT *` over a business partition**, and `ProviderInboxService` pages them **in memory** with
`.Skip().Take()`. The bookings side got `SELECT TOP` in L84; conversations never did.

### ‼️ Traps for anyone touching this area

1. ‼️ **The API integration host has NO SQL container** (**L70**), so a business-routed notification
   resolves **zero recipients** and publishes **no `NotificationMessage` at all**. Assert against an
   injected dispatcher double, never against the emitted Service Bus message.
2. ‼️ **Ten `VoiceAssistantControllerIntegrationTests` assertions ENCODED THE DEFECT**
   (`n.RecipientId == businessId`). They are now `Assert.DoesNotContain(...)` regression guards.
   **When a fix turns a test red, ask FIRST whether the test was asserting the bug.**
3. ‼️ **Use `Clinqet.API.UnitTests.Helpers.BusinessDispatcherTestDouble`**, never
   `Mock.Of<IBusinessCommunicationDispatcher>()` — the real dispatcher invokes the per-recipient factory
   and a bare mock never does, so content assertions pass vacuously (casebook CASE 4).
4. ‼️ **`Bind for 0.0.0.0:8081 failed: port is already allocated` is INFRASTRUCTURE, not a regression** —
   a leftover Cosmos-emulator container. Run `docker ps` before believing a Testcontainers failure.
5. ‼️ **53 Cosmos repositories, not 52**; `Cosmos.cs` is **3,395** lines, not 3,331. Both figures are
   still quoted stale in `PHASE-10` §1. **Treat every inherited count as a hypothesis and measure it.**

---

## ‼️ PHASE 12 PART 2 CORRECTION BLOCK (2026-08-06) — read before touching recipient resolution

### 1. ‼️ An admin's OWN preferences govern whenever the event names nobody else

`NotificationRecipientResolver.ResolveAboutPolicy` used to return a **hard-coded `Immediate`** when the observed
membership set was empty, so the administrator's `MembershipNotificationPreference` rows were **never read**.

‼️ **That is the NORMAL path, not an edge case.** In a single-member business — which is every business on the
platform today — the owner is an administrator, so `nonAdminEligible` is empty *by construction*, `routed` is
empty for `WorkIntake` / `Financial` / `ContextMessage`, and `RelatedMembershipIds` is empty for any unassigned
subject. **A sole owner who switched a channel off in their own notification-preference screen kept receiving
it.** It inverted **D8**: with no team activity at all, the admin's own surface was the one being ignored.

**It now reads `if (targets.Count == 0) return ResolveOwnPolicy(admin);`. Do not "simplify" it back.**

- **Zero extra SQL** — `LoadPreferencesAsync` already loads BOTH surfaces in the single query it always ran and
  splits them on `IsTeamActivity`. The real-`DbCommandInterceptor` test
  `RoutingClasses_StayWithinMeasuredSqlQueryBudgets` confirms the budgets are unchanged.
- **Guarded in both directions.** `SoleOwner_OwnPreferenceGovernsTheirOwnWorkIntake` **and**
  `ObservingAColleaguesWork_UsesTheTeamActivitySurface_NotTheirOwnPreference` — the second exists so the fix
  cannot degrade into "own preferences always win", which would break D8 the other way.

### 2. The "nobody receives it" matrix is a DERIVED theory, not a list

`Clinqet.API.UnitTests/Services/NotificationRecipientMatrixTests` drives **176 cells** — 88 business-scoped
types × 2 reachable subject states (unassigned, and assigned to a non-admin) — through the **real resolver
against a real seeded graph**, with the population derived from `NotificationRoutingCatalog.All`.

**A new `NotificationType` is therefore covered the day it is added, and the failure message names it.** Every
cell asserts a recipient is named **and** that the primary owner is among them; `Awareness` is asserted **empty
by name** (L91) so "resolves to nobody" can never become a silent third default.

### 3. Structural facts worth knowing before you change the resolver

| Fact | Consequence |
|---|---|
| `ResolvePermissionEligible` short-circuits `IsAdministrator` to eligible | an administrator is eligible for **every** type, whatever the permission key |
| `AddAdmins` is unconditional for `BusinessSecurity` · `Financial` · `WorkIntake` · `Assignment` · `ContextMessage` | the recipient set can only be empty when the graph holds **no administrator** |
| `Awareness` returns `Empty()` **before** any database work (L91) | `Times.Never` on the raw dispatcher proves nothing for an Awareness producer |
| `DirectMessage` is the ONLY class that never adds admins | it is also **unreachable** — see §4 |
| `LoadGraphAsync` excludes `BillingOnly` members unless the class is `Financial` | a suspended business would resolve no recipients for every other class — but `BusinessStatus.Suspended` is itself unreachable (Phase 10 P2 FINDING 4) |

### 4. ‼️ L21 / D5.2 — the privacy guarantee, stated honestly

**Since L106 the `DirectMessage` routing class has NO producer.** `DirectMessageReceived` resolves to
`ContextMessage` for **all four** conversation contexts, and a `SystemNotification` override to `DirectMessage`
**throws**. So "query the admin's partition and assert ZERO" cannot be staged against a reachable scenario, and
**saying so is the honest answer** rather than inventing one.

Six guards in `NotificationRecipientMatrixTests` pin what IS provable: the four-context mapping, the override
throw, and that an unclassified `SystemNotification` **fails loudly** rather than defaulting (L87).

### 5. Route targets — two things that are inert, and are NOT bugs to "fix"

1. **`NotificationRoutingTarget.OwnerOnly` can never put the owner in `routed`.** `ResolveConfiguredRoute`
   intersects with the `nonAdminEligible` set its three callers pass, and the primary owner is always an
   administrator. **The observable outcome is still correct** — `AddAdmins` adds every administrator, and
   `BusinessNotificationSettingsService` already reports the count as `Math.Max(1, adminCount)`. Changing the
   intersect to `eligible` WOULD change behaviour.
2. ‼️ **A `Financial` route can never change the recipient set.** The `Financial` branch unions
   `nonAdminEligible` **before** the configured route, and every target resolves to a subset of it. `00-SOLUTION`
   §8.3.2 describes Financial as additive, which is what the code implements — **so the CONTROL may be what is
   wrong, not the resolver. Open owner question, same family as B1/B3.**

### 6. Artefact counts, measured 2026-08-06

- `NotificationType` enum **134** = `NotificationRoutingCatalog` **134**, exact in both directions.
- `SignalRSettings:EnabledNotificationTypes` **131**. The three absent — `InvoiceReady`, `BookingReady`,
  `QuoteReady` — are **consistent, not gaps**: `DocumentDeliveryService` uses them as the notification-type TAG
  on a WhatsApp/email document delivery and they never reach the in-app dispatcher.
- **All eight** types added since Phase 5 carry all five artefacts (enum · catalogue · preference mapping ·
  SignalR entry · five-language keys).
- Localization **2,879 keys × 5**; email templates **102 files × 5**, zero filename drift.


## WhatsApp+SMS Phase 1 — send-side alerting is fully gated, default-true (2026-08-13)

Owner rules R2/R3 (whatsapp-sms-review programme): every send-failure path logs AND alerts; every alert
gate defaults TRUE; async carrier verdicts (Meta failed status, Telnyx delivery_failed DLR) are forced + Critical.

- `AdminAlertSettings` (Functions, `FailureNotificationHelper.cs`) now has **13 all-true bool gates** —
  Email/Push/SignalR/Pdf/System/SmsDelivery/SmsSend/SmsWebhook/WhatsAppFailure + per-family WhatsApp
  informational gates (ColdInbound, ProviderInbound, AmbiguousInbound, PlaceholderLeak). ‼️ Push was FALSE in
  class+appsettings since inception — every push-failure alert was a production no-op; both are now true.
  `AdminAlertSettingsConventionTests.EveryAlertGate_DefaultsTrue_InClassAndAppSettings` (reflection-driven)
  **fails the build** if any bool gate is not true in the class AND the Functions appsettings — a new gate must
  ship true in both.
- SMS alert taxonomy (owner DR-2): `AdminAlertType.SmsDeliveryFailure` (carrier DLR on an ACCEPTED message —
  forced + Critical), `SmsSendFailure` (send never left the platform / producer defect / India OTP failure),
  `SmsWebhookFailure` (inbound callback could not be applied — the consent-write failure site is FORCED). New
  helpers `HandleSmsSendFailureAsync` / `HandleSmsWebhookFailureAsync` (gated||force);
  `HandleSmsDeliveryFailureAsync` takes `provider` + `forceAdminAlert`. Admin `AlertsPage.jsx` filters all three.
- `HandleWhatsAppFailureAsync` is gated by `EnableWhatsAppFailureAlerts` and gained `forceAdminAlert` +
  `severityOverride` — the status processor passes force+Critical (async Meta verdict).
  `HandleWhatsAppSmsFallbackFailureAsync` fires when the SMS recovery leg of a failed WhatsApp send ALSO fails
  (stages dispatcher/direct/ticketed/ticket-mint; `TicketConsumed=true` means the exactly-once claim destroyed
  the ticket and nothing will retry).
- `CommunicationDispatcher`: `DispatchResult.EmailFailed/SmsFailed` now mean **attempted-and-failed** (a
  missing template/target is not a failure); on `AnyFailed` the dispatcher raises ONE alert gated
  `Communication:Alerts:EnableAdminAlertOnChannelDispatchFailure` (default true; 15-min per
  (type, channel-set) cooldown via `IAdminAlertCooldownService`, plus the AdminAlertProcessor content-hash
  dedupe). ‼️ The six `AnyFailed` consumers stay LogWarning-only BY DESIGN — never add per-site alerts.
- `IAdminAlertCooldownService.Release(key)` (2026-09-30) gives back a claim whose alert was never sent: claim, send, and
  `Release` in the send's catch, so the next caller raises the alert instead of the window going silent (the code-limit
  gate and the wrong-code guard do this; see `clinqet-auth-sessions` §6).
- `SmsNotificationProcessorFunction`: producer-defect DLQs (null phone / missing template) alert; the generic
  catch alerts ONLY on final retry (per-attempt Critical spam removed); `SmsResult.Permanent` (the India DR-1
  refusal) completes without retry or alert.
- `WhatsAppSendGate` alerts when degraded (fail-open cap read = uncapped billable sends; dead WABA counter =
  WhatsAppWabaTierReached can never fire) — gated `WhatsApp:SendCaps:EnableGateFailureAlerts` (true,
  API+Functions), per-stage cooldown `GateFailureAlertCooldownMinutes`.

## WhatsApp+SMS Phase 3 — the AI/voice rails (2026-08-14)

- **NEW `NotificationType.CallSuggestionPending`** (owner-requested): a call that leaves a Pending
  DraftBooking/DraftQuote suggestion the post-call pipeline did NOT auto-apply pings the provider
  (in-app + push, `SkipEmail/SkipSms/SkipWhatsApp`). Catalog: `Business(WorkIntake, "voice.transcript.read")`;
  echo catalog: Deliver (deferred AI outcome, no member acted); preference category `VoiceAssistant`;
  in `SignalRSettings:EnabledNotificationTypes`; keys in all five languages; deep-links to Call Follow-ups
  on web + mobile. Producer: `VoicePostCallProcessorFunction.DispatchPendingSuggestionNotificationAsync`,
  EventId `BusinessEventId.ForCall(callId, type)`, inside the `SideEffectsAppliedAt`-guarded once-per-call
  block. All FIVE artefacts + BOTH hand-written test contract maps (`NotificationRoutingCatalogTests`,
  `NotificationEchoCatalogTests`) updated.
- **‼️ `CommunicationDispatcher`'s WhatsApp channel is `CapExempt = true` by construction** (DR-12): the
  dispatcher rail is transactional — the plan cap's perk producers (provider ping, CRM outreach, router
  provider-notify) all enqueue directly. The dispatcher had been reusing `NotificationData["BusinessId"]`
  (deep-link metadata) as the billing key, silently plan-gating booking confirms. The WABA monitor still
  counts every send. If dispatcher-routed MARKETING ever ships, it needs its own cap decision.
- An auto-applied voice booking now rides `ActionSideEffects{BookingCreated}` ⇒ the normal
  `ProviderConfirmationProcessor` one-tap chain (see clinqet-voice-assistant 2026-08-14).

## WhatsApp+SMS Phase 2 — inbound-side alert gates (2026-08-13)

Owner rule R3 continues to hold: every admin alert is gated by an appsetting whose default is TRUE, and the
class default mirrors the appsettings value exactly.

| Gate | Home | Default | Raised when |
|---|---|---|---|
| `Communication:Alerts:EnableBookingReplyFailureAlerts` | `CommunicationAlertSettings`, **Functions appsettings only** (the only host registering `IBookingReplyActionService`) | true | An inbound CONFIRM/DECLINE could not be applied, the `CustomerBooking` mirror failed, or the booking email could not be queued. Nothing retries these, and each leaves the provider's and customer's view of one booking disagreeing. `BookingReplyActionService` previously raised ZERO alerts. |
| `WhatsApp:EnableConsentAliasFailureAlerts` | `WhatsAppSettings` | true | A phone↔BSUID alias write failed twice **for a contact that is opted out or blocked** — the case where a second contact document can silently resurrect a hard opt-out under `DefaultOptIn`. A suppressed contact only; ordinary alias misses stay log-only. |

Both use `AdminAlertType.ComplianceRisk` / `SystemError` — **no new alert type was added**, so the admin
`AlertsPage.jsx` filter needs no change.

‼️ `Communication:BookingReplyUndoWindowMinutes` (60, Functions appsettings + class default) is NOT an alert
gate — it is how long a provider has to reverse a mistaken one-tap DECLINE by replying CONFIRM, measured from
the booking's `CancelledAt` stamp. See `clinqet-whatsapp` for the guards.

### The unchanged rules Phase 2 re-confirmed

- The six `AnyFailed` consumers still LogWarning only — the dispatcher's single channel-failure alert is the
  backstop. Do not add per-site alerts.
- A `SmsResult.Permanent` (India OTP-only refusal) is a POLICY answer, not a fault: complete, log Information,
  raise nothing. The new HELP reply path follows the same rule.

## ‼️ SIGNALR SELF-ECHO SUPPRESSION (programme complete 2026-08-14) — the actor's own live toast

> Programme docs: `C:\Nik\signalr-self-echo\` — `00-PLAN.md`, `01-ECHO-CATALOGUE.md` (**owner-approved
> LAW**, D3), phase reports `10/20/30`, `40-FINAL-AUDIT.md`. The behaviour: when YOU perform an action you
> do not get the live SignalR toast about it. Every colleague, the other party, the bell list, and every
> other channel are untouched.

### The mechanism

- **`NotificationEchoCatalog`** (`clinqetcore\Services\Communication\`) classifies **all 134**
  `NotificationType` members: **40 `SuppressSelfEcho` · 94 `AlwaysDeliver`**. Build-enforced:
  `NotificationEchoCatalogTests` keeps its own hand-written map, so a new enum member **fails the build**
  until a human classifies it twice. ‼️ Never change a row without the owner (D3).
- **ONE decision implementation** — `SelfEchoEvaluator` (`ISelfEchoEvaluator`, three overloads). Suppress
  iff: `Enabled && SuppressRealtime && !ForceRealtimeToActor && catalogue == Suppress && actor.IsKnown
  && audience matches && identity matches` (MembershipId → UserId → UserNumber; the FIRST level where both
  sides carry a value decides; null/empty never matches). **Fail-open: anything unknown ⇒ DELIVER.**
  Audience is part of `IsKnown` — a dual-role human's other app can never be silenced (R8).
- **Three seams — the only places the outcome is applied:**
  - **SEAM A** — `BusinessCommunicationDispatcher.ApplyRoutingContext`, INSIDE the per-recipient loop,
    computed from THAT recipient's own identity. This is why INVARIANT S1 (a colleague is never affected)
    holds structurally, not by care.
  - **SEAM B** — `CommunicationDispatcher.DispatchNotificationAsync` (the raw single-recipient path).
  - **SEAM C** — `AccountNotificationService` (Identity host): the producer asserts
    `AccountNotificationRequest.RecipientIsActor` (an assertion, never a decision);
    `EvaluateRecipientIsActor(type)` applies the catalogue — so `PasswordReset` / `AccountLockout` /
    `MfaLockout` (AlwaysDeliver) are **structurally unsuppressible** however a producer sets the flag.
- **The actor** — `INotificationActorAccessor`: `HttpNotificationActorAccessor` registered by
  `AddTenancyAuthorization` (**Main API only**; needs `ITenantContextAccessor` + `IHttpContextAccessor`,
  which no caller-less host registers, so composing it elsewhere is a startup failure);
  `NoNotificationActorAccessor` TryAdd'd by `AddSystemActorAttribution` (Functions + MCP) and by
  `AddAccountNotifications` (Identity) ⇒ timers, change feeds, webhooks and AI-taken calls can suppress
  nobody.
- **Across Service Bus** — `ServiceBusMessageBase` carries `ActorUserNumber/UserId/MembershipId/Audience`
  (`[JsonIgnore(WhenWritingNull)]`; `SchemaVersion` 2), stamped ONCE at enqueue in
  `ServiceBusService.StampCarriedActor` (all four send methods — pinned by
  `ServiceBusActorStampConventionTests`); Functions processors copy with
  `request.WithCarriedActor(message)` (**18 sites / 11 files**, measured Phase 4). A producer-set actor
  always wins; an unstamped message copies nothing; the actor does NOT forward across a second queue hop.
- **Settings** — `Notifications:SelfEcho`: `Enabled` true · `SuppressRealtime` true · `SuppressPush`
  **false** (D1 — flipping it silences the actor's push across all three seams at once). `SuppressPush`
  without `SuppressRealtime` refuses to start. Keys live in Main API + Functions + Identity appsettings;
  the MCP host composes no dispatcher and deliberately has no key.
- **What suppression can NEVER touch:** the recipient set, routing, Cosmos persistence / the bell list,
  email, SMS, WhatsApp, and push while `SuppressPush=false`. Pinned by `SelfEchoInvariantS1Tests`
  (S1-a…S1-i) + the SEAM C proofs in `AccountNotificationServiceTests`.

### Closed owner decisions — do not reopen

- **D4 (CLOSED 2026-08-13):** a provider who confirms/rejects a booking by replying to WhatsApp/SMS KEEPS
  their own toast. The carrier webhook is anonymous; an inbound phone number is never an identity
  assertion strong enough to SILENCE somebody. ‼️ Do NOT build a phone/BSUID→member mapping for this, and
  do not report it as a gap.
- **D5 (CLOSED 2026-08-13):** no per-site push override on account events.
  `AccountNotificationRequest.SuppressMobilePush` was DELETED; push on an account event is governed only
  by `Notifications:SelfEcho:SuppressPush`. Friendly-name changes now buzz the phone like every other
  account event (toast suppressed, push delivered). Do not restore a per-site push flag.
- **Billing producer flag (Phase 4 fix, 2026-08-14):** `BillingNotification.SuppressRealtime` is GONE.
  After billing became a business fan-out (2026-08-06 tenancy conversion) that producer-level
  `SkipSignalR` silenced EVERY resolved recipient — colleagues included — on 13 Suppress-row billing
  types, and on the Functions-host webhook top-up grant it silenced everyone with no actor at all. Echo
  suppression for billing is SEAM A's per-recipient job. ‼️ Never re-add a producer-level `SkipSignalR`
  to a business fan-out; `SelfServeBillingEvent_NeverPreSetsSkipSignalR_ForAnyResolvedRecipient` +
  `ABillingSelfServeEvent_SuppressesOnlyTheActingMember` pin it.

### Traps (each cost a phase real time)

- ‼️ Partner-mobile's rendering rule spans TWO files: `signalRService.ts` routes events to callbacks and
  `SignalRProvider.tsx` decides which callback draws the banner. A single-file guard passes VACUOUSLY.
  The four `signalRBatchNeverToasts.test.{js,ts}` guards (one per client repo, each scanning only its own
  repo) pin batch/replay-never-toast and carry a live-draw control.
- ‼️ DI registration order is load-bearing: never TryAdd `NoNotificationActorAccessor` on the routing
  path — depending on composition order the Main API could resolve the actor-less accessor and
  suppression would silently stop platform-wide with nothing failing. It belongs in
  `AddAccountNotifications` only; `AHostComposingBothSeamCAndAuthorization_KeepsTheHumanActor` pins both
  orders.
- The live `ReceiveNotification` is the ONLY toast source: batch + replay never toast on any client, web
  push does not exist in either web app, and partner-mobile's foreground push banner is guarded by
  `isSignalRConnected()`.
- A scheduled message carries its enqueuer's actor into the future. Safe today because no Suppress-row
  type rides a scheduled hop (measured in Phase 4) — re-verify before scheduling one.

### ‼️ Adding a NotificationType is now a SIX-place change

The five edits documented above (enum · `NotificationRoutingCatalog` · `BuildExpected()` in
`NotificationRoutingCatalogTests` · `CommunicationPreferenceConfig` mapping · SignalR whitelist +
five-language keys) **plus a `NotificationEchoCatalog` row and its hand-written twin in
`NotificationEchoCatalogTests`** — the build fails until both exist, and a `SuppressSelfEcho`
classification needs the owner's sign-off (D3).

---

## ‼️ `KnowledgeDocumentFailed` (Phase 4, 2026-08-18)

A provider-facing notice for an AI-Knowledge document that settled **Failed**. The six registration places:

1. `clinqetshared/Enums/NotificationType.cs` — appended, never reordered
2. `NotificationRoutingCatalog` — `Business(WorkIntake, "voice.settings.manage")`. ‼️ `voice.read` cannot
   re-upload a document, so telling a read-only member is telling nobody who can act
3. `NotificationEchoCatalog` — **`Deliver`**. ‼️ The UPLOADER is exactly the person who must be told; the
   outcome arrives minutes later from a queue, not from their click, so self-echo suppression must not eat it
4. `CommunicationPreferenceConfig` — the `VoiceAssistant` category
5. `SignalRSettings:EnabledNotificationTypes` (Main API appsettings)
6. The deep link → `/dashboard/profile/knowledge` (web `notificationNavigation.js`, mobile
   `notificationNavigation.ts` + `PUSH_DEEPLINK_TYPES`), plus the approved tables in
   `NotificationEchoCatalogTests` and `NotificationRoutingCatalogTests`

**Failure only, terminal only.** Nothing is sent on success. Channels: in-app + push + SignalR;
`SkipEmail`/`SkipSms`/`SkipWhatsApp`. Body carries the document name plus the SAME localized reason the row
shows, so the notice and the page never tell two different stories.

**D-06 — the toast is suppressed CLIENT-side.** The server cannot know which page a provider is on. Both
`signalRService.js` (web) and `signalRService.ts` (mobile) fan the event to a knowledge subscriber; a
subscriber that returns `true` CLAIMS it, so the open Knowledge page refreshes its row silently and no toast
lands on a screen already showing the change. The bell entry and the push are untouched.

## AI engine-change notices (2026-09-25) — see `clinqet-payments` "Minute packs follow the AI engine"

- **`AiMinutesConverted`:** sent by `MinuteLedgerService` for every leftover-minute move between AI engines
  (in-app + push + email `AiMinutesConverted`, no WhatsApp; Financial routing, `billing.read`; BillingPayments category;
  echo policy Suppress — the switch dialog already showed the actor the numbers). Engine names in `Fields` (`engine`,
  `fromEngine`, `toEngine`) are resolved per RECIPIENT language from `Billing_EngineLabel_{tier}`.
  `AutoRechargePackUnavailable` with `Fields["engine"]` renders the `_EngineChanged` copy + email template.

## Digest summary (2026-09-26)
- `NotificationDigestService` picks ONE sentence — `NotificationDigest_BodyOne` (1), `_Body` (many), `_BodyCapped` (bucket full ⇒ "or more") — and sends it as the in-app body AND as `{{Summary}}` in the email and SMS; the templates never print `{{Count}}`. The Meta-held WhatsApp digest still takes `count`. Guard: `NotificationDigestServiceIntegrationTests.TheSummary_FitsTheCount`.

## Booking cancellation carries the provider's reason (D7, 2026-09-29)
- When `Booking.ProviderCancelReason` is set, `BookingCancellationProcessor.ReasonFor` replaces the reason with the localized
  sentence `BookingCancelReason_{CustomerAsked|CouldNotDoIt|EnteredByMistake}` (all five language files), followed by any
  typed note. Otherwise the typed note passes through unchanged.
- Carried in: customer email `CancellationReason`, customer SMS `CancellationReason`, customer WhatsApp `reason` (blank ⇒
  `WhatsApp_BookingCancelled_NoReason`), and the provider email `CancellationReason`, resolved per recipient language.
  The in-app/push body (`Notification_BookingCancelled_Body`) is unchanged and carries only the booking number.
- Rules for when a reason is allowed: `clinqet-booking-lifecycle` "Scoring-lane booking rules".

## Post-ranking follow-ups (audit 2026-10-01) — `IRecoveredWhenLost`

- `clinqetshared/DTOs/Messages/IRecoveredWhenLost.cs` — marker interface for a message the platform sends again on its
  own when one is lost (a later change, the monthly re-check). `ServiceBusService.CreateLostMessageAlertAsync` returns
  early for such a payload: NO `NotificationSendFailed` alert, because an admin has nothing to deliver by hand. The
  queue-health alert still fires.
- Implemented today only by `ProviderScoreRefreshMessage` (W11, queue `provider-score-refresh`): a lost rescore is
  re-requested by the next evidence change or by the safety net (`ProviderScoreSafetyNetFunction`, one slice per night
  over `ProviderScoring:SafetyNet:SliceDays` 30). Audit D-M2: before it, every failed rescore raised a per-business
  "notification was not sent" alert.
- ‼️ Only for a message whose loss the platform repairs by itself. Never put it on a customer- or provider-facing notice —
  that is exactly the loss `NotificationSendFailed` exists to surface.
- Final-delivery failures of the W11 / W12 processors are system-failure alerts deduped per night (rescores) and per
  run + step (Insights, `dedupeKey` `insights-rollup:{runId}:{step}`) — see `clinqet-smart-analytics`.

## Billing notices: trial versions, one price phrase, and a notice that delivers nothing (2026-10-02)

- `BillingNotification` gained `TrialCharge` (a `TrialChargeQuote`, rendered per recipient as the `price` field — ONE phrase
  carrying its period, e.g. "CA$44.07 per month") and `DuringTrial` (picks the trial version of auto-renewal off / on and of the
  price-change notice). A number at stake (`AtRiskNumber`) is the `number` field for in-app and email too, not only WhatsApp.
- `SkipEmail` + `SkipInApp` with no WhatsApp template ⇒ `BillingNotificationService` does NOT dispatch at all and only raises the
  admin risk alert. Used when an AI switch-off is told by the number's hold notice: one moment reaches the provider once.
- `VoiceNumberNotifier.NumberRemovedAsync`: reason `ServiceEnded` reads as a release (`Notification_VoiceNumberReleased_*`, email
  `VoiceNumberReleased`), never "removed by our team"; a team removal now fills `{{ReasonText}}` (it printed raw before).
- Every copy key, email and WhatsApp template: clinqet-payments, "Trial reminders and trial messages".
