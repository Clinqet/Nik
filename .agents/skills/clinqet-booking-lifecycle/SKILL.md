---
name: clinqet-booking-lifecycle
description: |
  **CORE FEATURE SKILL** — Work on the Booking feature end-to-end. Booking entity,
  full state machine (Draft → AwaitingProviderConfirmation → Confirmed → InProgress
  → Completed, with Cancelled / Rejected / RejectedTimeout / NoShow terminals),
  double-booking prevention via Availability cross-check, provider confirmation
  timeout, scheduled reminders, auto-completion, transactional invoice creation
  on Completed, customer-side denormalized booking view (CustomerBooking), refund
  via deposit tracking, partner/user/admin UI.
  USE FOR: booking CRUD, state transitions, cancellation/rejection flows, provider
  confirmation timeout (48h default), reminder scheduling (24h default), auto-
  completion (48h default), attachments + SAS upload, idempotency, ETag
  concurrency, BookingService Bus integration (6 queues), notification dispatch,
  partner-app booking UI, user-app booking pages, admin oversight via AdminAlert.
  Applies to clinqetcore/Entities/COSMOS/Cosmos.cs (Booking + CustomerBooking),
  clinqetinfrastructure/Data/COSMOS/BookingRepository.cs + CustomerBookingRepository.cs,
  clinqetinfrastructure/Services/Booking/BookingService.cs +
  BookingValidationService.cs, clinqetapi Controllers/BookingController.cs,
  clinqetfunctions Functions/Booking*Processor.cs (6 functions),
  clinqetwebpartnerapp src/components/booking + src/app/dashboard/bookings,
  clinqetwebuserapp customer-side booking pages.
---

# CLINQET BOOKING LIFECYCLE — COMPREHENSIVE SKILL

## RECENT CHANGES — 2026-10-06 (a booking whose price the owner has not set)

See the `clinqet-prepared-providers` skill for the whole feature. What changed HERE:

- ‼️ **A price-less booking never becomes `PaymentPending` and never raises an invoice** — in BOTH invoice paths. See `clinqet-invoice-generation`.
- **A booking line with no amount carries `PriceTypes.OnRequest`, never an empty type**, so no document prints a 0 that reads as "free".
- **The receptionist's unlisted line keeps the service's own description AND adds the subject-to-confirmation note** — it used to REPLACE it, leaving the customer with a document that no longer said what they had booked.

## UNLISTED ("Other") LINE NAME RESOLUTION — 2026-08-25

- A booking/quote service line with `serviceId: null` and a typed `serviceName` (web + partner
  mobile both send exactly this for "Other" rows — sentinel `"other"` never reaches the wire) is
  resolved server-side against the business's own catalog by `IServiceNameResolver`
  (`clinqetinfrastructure\Services\Catalog\ServiceNameResolver.cs`): exact-name match after
  case/whitespace/punctuation normalization, NEVER contains/fuzzy, verified by a live point-read so
  a stale cache can never attach a renamed id. Cache: `IMemoryCache` `svc:namemap:{businessId}`,
  `Size=1`, `ServiceNameResolution:{Enabled,CacheTtlMinutes,MaxServicesPerBusiness}` (API + MCP
  appsettings; class defaults mirror JSON).
- Hook points: the four `BookingController` service-validation loops (create, draft create, draft
  update, update) resolve BEFORE the catalog Taxable/payment-override normalization — a resolved
  line then follows the exact catalog-line path; `QuoteController` create/update resolve BEFORE
  offer validation (service-scoped offers must see the id). The line's typed text and price are
  NEVER touched; CategoryId/SubcategoryId fill only when absent. Unresolved/ambiguous/inactive ⇒
  the line stays unlisted, exactly as before.
- Every same-host Service name/active/delete mutation calls `Invalidate(businessId)`
  (ServiceController create/update/duplicate/delete/bulk, CategoryController cascade deletes,
  ProviderSetupServiceWriter, MCP ServiceManagementTools). Approval-only and image/currency-only
  writes deliberately do not (the map keys name+active only); cross-host writes age out via TTL.
- Voice: `request_booking`/`send_quote`/partner `create_booking`/`create_quote` run the same
  resolver, and an UNRESOLVED voice line is stamped with the localized `Voice_UnlistedItemNote`
  ("subject to change until confirmed by {business}") — booking lines carry it in `JobDescription`
  (PDF Details column), quotes in `QuoteDescription` (PDF description block). Provider-authored
  (UI or partner-scope voice) unlisted lines get NO note. See `clinqet-voice-assistant` 2026-08-25.
- Tests: `ServiceNameResolverTests` (API.UnitTests, §0.18 primary host), controller tests in
  Booking/Quote suites, `ServiceNameResolutionIntegrationTests` against real Cosmos (incl. the
  rename→immediate-invalidation round trip); `UnlistedServiceLineIntegrationTests` unchanged.

## BOOKING TIME HYBRID INVARIANT — 2026-07-16

- `ScheduledStartDateTime` / `EstimatedEndDateTime` are business-local wall times (`DateTimeKind.Unspecified`) and remain the only display truth for UI, MCP read-back, email, SMS, WhatsApp, and PDF.
- `TimeZoneId` is an IANA zone snapshotted when the appointment is written. `ScheduledStartUtc` / `EstimatedEndUtc` are derived computation truth for past guards, cancellation/payment windows, due selection, scheduled messages, analytics, and instant sorting.
- `BookingTimeHelper` is the only conversion point. Every wall-time writer calls `ApplySchedule`; an unset draft calls `ClearSchedule`. DST gaps shift to the first valid wall minute and DST ambiguity selects the first occurrence.
- Legacy reads missing timezone/UTC derive from BusinessProfile address zone and then `BusinessTime:DefaultTimeZoneId`. An unresolvable stored `TimeZoneId` degrades to the profile-derived zone via the guarded resolver instead of throwing. Do not backfill pre-production data.
- Local-day filters remain on wall time. Transactions and CustomerData UTC sort/query paths require the `scheduledStartUtc` included path/composites; deploy the policy and wait for Cosmos index transformation completion.
- BusinessProfile stamps `TimeZoneId` on creation/address changes and lazily by ETag-protected point PATCH when an older profile is read. Zone resolution order: stored snapshot → India country check (`Asia/Kolkata` — geo border polygons are imprecise near India's borders, e.g. Raxaul geo-resolves to Asia/Kathmandu) → geo-derivation from the primary address lat/long via the offline `GeoTimeZone` NuGet in `Clinqet.Core` (`Etc/*`/null rejected) → `BusinessTime` state map/default. Geo runs only on stamping/zone-resolve misses; a normally-stamped booking/profile never reaches it (compute paths use the snapshotted zone through the cached `TimeZoneInfo`). A provider override (`BusinessProfile.TimeZoneSource: Manual`, set via `PUT business/profile/timezone`, US/CA only per `BusinessTime:AllowedTimeZonesByCountry`) survives address re-saves; `PUT null` resets to detected.

## ENTITIES (`clinqetcore\Entities\COSMOS\Cosmos.cs`)

### `Booking` (~lines 1635-1743)
- Container: `Transactions`. Partition key: `/businessId`. Document id: `{businessId}_{bookingId}`. ETag concurrency on every UpdateItemAsync.
- Key fields:
  - `bookingId`, `bookingNumber` (human-readable), `businessId` (pk), `businessName`
  - `quoteId?`, `broadcastId?`, `broadcastProviderId?` — back-links when booking is converted from Quote or Broadcast
  - `customer: BookingCustomerInfo` (customerId, firstName, lastName, email, phoneNumber, address)
  - `services: List<BookingService>` — line-item services with prices
  - `bookingDescription`, `notes: List<string>?`
  - `scheduledStartDateTime`, `estimatedEndDateTime?` (wall display truth), `timeZoneId?`, `scheduledStartUtc?`, `estimatedEndUtc?` (computation truth), `actualStartDateTime?`, `actualEndDateTime?`
  - `price: BookingPrice` (subtotal, tax, discount, total, depositAmount, depositPaid, depositPaidAt)
  - `appliedOffers: List<AppliedOffer>?`
  - `status: BookingStatus`
  - `cancellationReason?`, `rejectionReason?`, `cancelledAt?`, `cancelledBy?`
  - `providerCancelReason?` (`ProviderCancelReason`, string enum, null-omitted) — D7, set only when the business cancels a booking it had agreed to
  - `serviceAddress: Address?`, `attachments: List<string>?` (blob filenames)
  - `createdBy`, `updatedBy?`
  - `confirmedByProvider: bool`, `confirmedByCustomer: bool`, `providerConfirmedAt?`, `customerConfirmedAt?`
  - **Scheduled message tracking** — `timeoutMessageSequenceNumber: long?`, `reminderMessageSequenceNumbers: List<long>?`, `autoCompletionSequenceNumber: long?` (used to cancel scheduled SB messages on state change)
  - `idempotencyKey?` (dedupe support)
  - `ttl: int?` — from `DocumentTtl:BookingTtlDays` (default 730)

### `CustomerBooking` (~lines 1745-1793) — customer-side denormalized view
- Container: `CustomerData`. Partition key: `/customerId`. Document id: `{customerId}_{bookingId}`.
- Subset: `customerId` (pk), `bookingId`, `bookingNumber`, `businessId`, `businessName`, `scheduledStartDateTime`, `estimatedEndDateTime`, `timeZoneId`, `scheduledStartUtc`, `estimatedEndUtc`, `status`, `totalAmount`, `totalTax`, `currency`, `confirmedByProvider`, `confirmedByCustomer`, `idempotencyKey?`, `ttl: int?` (from `DocumentTtl:CustomerBookingTtlDays`).

Both records are written/updated together — never assume a single Cosmos write.

---

## ENUMS

### `BookingStatus` (`clinqetshared\Enums\BookingStatus.cs`)
Verbatim: `Draft, AwaitingCustomerConfirmation, AwaitingProviderConfirmation, Confirmed, InProgress, Completed, Cancelled, Rejected, RejectedTimeout, NoShowCustomer, NoShowProvider`. All have `[JsonConverter(typeof(JsonStringEnumConverter))]`.

### Booking-related `NotificationType` values (`clinqetshared\Enums\NotificationType.cs`)
`BookingCreated, BookingConfirmed, BookingAwaitingConfirmation, BookingRejectedTimeout, BookingCancelled, BookingUpdated, BookingReminder, BookingRejected, BookingCompleted, BookingInProgress, BookingNoShowCustomer, BookingNoShowProvider, BookingAutoCompleted`.

### Booking-related `EmailType` values (`clinqetshared\Enums\EmailType.cs`)
`Confirmation, Reminder, BookingCancellation, BookingTimeout, ProviderConfirmationRequest, BookingRejection, BookingCompleted, BookingUpdated`.

### `CancellationType` — `CustomerCancellation, ProviderCancellation, SystemTimeout`.

### `ProviderCancelReason` (`clinqetshared\Enums\ProviderCancelReason.cs`) — `CustomerAsked, CouldNotDoIt, EnteredByMistake` (D7).

---

## CONTAINERS & INDEXES

### Transactions (Bookings, Invoices, Quotes share container) — `cosmosindexsetup\Program.cs` + `clinqetcore\Cosmos\Setup\CosmosContainerPolicies.cs`
Partition key: `/businessId`. TTL: -1 (per-doc).

Included paths (subset): `/type/?`, `/bookingNumber/?`, `/status/?`, `/scheduledStartDateTime/?`, `/scheduledStartUtc/?`, `/price/totalAmount/?`, `/customer/firstName/?`, `/customer/lastName/?`, `/customer/email/?`, `/isDeleted/?`, `/createdAt/?`, `/updatedAt/?`, `/paymentInfo/paidAt/?`.

Composite indexes (booking-relevant):
1. `(/type ASC, /status ASC, /scheduledStartUtc DESC)` — booking list by status sorted by instant
2. `(/type ASC, /scheduledStartUtc DESC)` — chronological instant order
   - Existing `scheduledStartDateTime` composites are retained because Quote documents share Transactions and still use wall-time ordering.
3. `(/type ASC, /status ASC, /price/totalAmount DESC)`
4. `(/type ASC, /customer/lastName DESC)`, `(/type ASC, /customer/firstName DESC)`
5. `(/type ASC, /status ASC, /createdAt DESC)`

### CustomerData (customer-side) — pk `/customerId`, TTL -1.
Composite indexes:
1. `(/type ASC, /status ASC, /scheduledStartUtc DESC)` — customer booking list
   - The existing `(/type ASC, /status ASC, /scheduledStartDateTime DESC)` composite remains for CustomerQuote compatibility.
2. `(/type ASC, /status ASC, /issueDate DESC)`
3. `(/type ASC, /status ASC, /invoiceDate DESC)`
4. `(/type ASC, /createdAt DESC)`

**Hard rule (memory `feedback_cosmos_emulator_vs_prod_matcher`):** filter columns lead `ORDER BY`. Add string-shape SQL unit tests; the Testcontainers emulator is more permissive than prod.

---

## REPOSITORIES

### `BookingRepository.cs` (`clinqetinfrastructure\Data\COSMOS\`)
Every method is partition-scoped on `/businessId`.

- `GetByBusinessIdAsync(businessId, ct)` — all bookings in partition.
- `GetBookingByIdAsync(bookingId, businessId, ct)` — point read on `{businessId}_{bookingId}`.
- `GetBookingByNumberAsync(bookingNumber, businessId, ct)` — query by `bookingNumber`.
- `CreateBookingAsync(booking, ct)` — sets composite id + TTL from `DocumentTtl:BookingTtlDays`.
- `UpdateBookingAsync(booking, ct)` — ETag concurrency (412 bubbles up).
- `DeleteBookingAsync(bookingId, businessId, ct)` — broadcast-conversion rollback only; `DELETE /bookings/{id}` goes through `_holderWrites.DeleteAsync` (releases held offer uses in the same batch).
- `GetOutcomeRowsTouchedAsync(businessId, from, until?, maxRows?, ct)` — `BookingOutcomeRow` projection for the nightly provider scores (adds `cancelledAt`, `scheduledStartUtc`, `providerCancelReason`), bounded on `updatedAt` newest first (N9). Replaced `GetOutcomeRowsByBusinessIdSinceAsync`.
- `GetPaginatedBookingsAsync(businessId, BookingQueryDto, ct)` — filters (status, dateRange, customer name, searchText, serviceId), sort (amount/status/scheduledStartDateTime DESC default). Returns `PagedResult<Booking>` with continuation token.
- `GetMostRecentPendingBookingAsync(businessId, ct)` — WHERE status=AwaitingProviderConfirmation ORDER BY createdAt DESC TOP 1.
- `GetTodayBookingCountAsync(businessId, todayStart, todayEnd, ct)`.
- `GetTodayCompletedCountAsync(businessId, todayStart, todayEnd, ct)`.
- `GetUpcomingConfirmedCountAsync(businessId, utcNow, ct)`.

### `CustomerBookingRepository.cs`
Every method is partition-scoped on `/customerId`.

- `GetByCustomerIdAsync(customerId, ct)`.
- `GetByCustomerIdPagedAsync(customerId, pageSize, continuationToken?, statuses?, startDate?, endDate?, sortOrder?, ct)` — returns `(IEnumerable<CustomerBooking>, continuationToken?)`.
- `GetCustomerBookingByIdAsync(bookingId, customerId, ct)` — composite id `{customerId}_{bookingId}`.
- `GetCustomerBookingByNumberAsync(bookingNumber, customerId, ct)` — ‼️ D-109: a number is unique per BUSINESS and this partition is one CUSTOMER, so a customer who booked with two providers holds two `BK-000001`s. An ambiguous number resolves to NOTHING; `GetCustomerBookingsByNumberAsync` returns them all for the caller to disambiguate.
- `GetByIdempotencyKeyAsync(idempotencyKey, customerId, ct)` — dedupe support.
- `CreateCustomerBookingAsync`, `UpdateCustomerBookingAsync`, `UpsertCustomerBookingAsync`. No delete: `DeleteCustomerBookingAsync` was removed (D5).

---

## SETTINGS — `BookingSettings` (read directly via `IConfiguration` in `BookingService`)

```
Booking:SendReminders               = true
Booking:ReminderHoursBeforeBooking  = 24
Booking:ProviderConfirmationTimeoutHours = 48
Booking:CustomerConfirmationTimeoutHours = 48
Booking:SendAdminAlertOnBookingCancellation = true
Booking:SendAdminAlertOnBookingCreated      = true   # customer-initiated + lead conversion
Booking:SendAdminAlertOnProviderManualBookingCreated = true   # provider manual add + provider's own quote
Booking:SendAdminAlertOnNoShow              = true
Booking:RequireCustomerConfirmationForProviderManualBooking = false
Booking:RequireCustomerConfirmationForProviderLeadBooking   = true
Booking:AutoCompletionHours         = 48
```

Function App appsettings (read by `BookingTimeoutProcessor` only):
```
Booking:SendAdminAlertOnBookingTimeout = true
```

TTL settings:
```
DocumentTtl:BookingTtlDays          = 730
DocumentTtl:CustomerBookingTtlDays  = 730
```

No bound options class exists — all `Booking:*` read via `IConfiguration.GetValue` (API: `BookingService` + `BookingController`; Functions: `BookingTimeoutProcessor`). `BookingService`/`BroadcastService` are **API-only** (function processors never call their handlers).

### Confirmation model & admin-alert gates (2026-06-06)
- **`AwaitingCustomerConfirmation` is now a LIVE initial state**, produced when a provider creates a booking that the **customer** must confirm:
  - Provider converts a **lead** (broadcast) → `AwaitingCustomerConfirmation` when `RequireCustomerConfirmationForProviderLeadBooking` (default **true**); `BroadcastService.ConvertToBookingForProviderAsync`.
  - Provider **manual** create (`POST /bookings`) or provider-from-own-**quote** (`POST /from-quote`) → gated by `RequireCustomerConfirmationForProviderManualBooking` (default **false**), applied ONLY when the customer is a known platform user (`customer.CustomerId` present) so an anonymous customer is never stranded.
  - In every case `ConfirmedByProvider=true`, `ConfirmedByCustomer=false`.
- **Customer confirms** via existing `PATCH /{bookingId}/status` `{newStatus:Confirmed}` (state machine already allows `AwaitingCustomerConfirmation → Confirmed` for Customer) → `HandleConfirmedAsync` cancels the timeout (party-agnostic `TimeoutMessageSequenceNumber`) and runs confirmed side-effects.
- **Confirmation timeout** mirrors the provider flow via `BookingTimeoutCheckMessage.ConfirmationParty` ∈ {Provider, Customer}. `BookingService.ScheduleCustomerConfirmationAsync` schedules a `Customer`-party timeout (`CustomerConfirmationTimeoutHours`) + dispatches a customer prompt (`NotificationType.BookingAwaitingConfirmation`, keys `Notification_BookingAwaitingCustomerConfirmation_Title/_Body`, in-app + push). `BookingTimeoutProcessor` branches on `ConfirmationParty`: customer branch short-circuits when `ConfirmedByCustomer || status != AwaitingCustomerConfirmation`, else → `RejectedTimeout` (reason `CancellationReason_CustomerTimeout`).
- **Admin-alert gates (all default true):** the booking-created alert is split by `BookingCreationOrigin` (ProviderManual / CustomerInitiated / LeadConversion) into **two** gates — `SendAdminAlertOnProviderManualBookingCreated` (provider direct add + provider's own quote→booking) and `SendAdminAlertOnBookingCreated` (customer-initiated + lead conversion); both via `BookingService.RaiseBookingCreatedAdminAlertAsync(booking, createdBy, origin)` (`AdminAlertType.BookingCreated`/`Low`, fired once per real creation from all 3 paths — skipped on idempotent broadcast re-hits; controller passes `Partner→ProviderManual else CustomerInitiated`, broadcast passes `LeadConversion`). Plus `SendAdminAlertOnBookingCancellation` (existing), `SendAdminAlertOnNoShow` (NEW gate), `SendAdminAlertOnBookingTimeout` (NEW gate, Functions). Broadcast-conversion rollback `SystemError` stays always-on.
- **User app**: the `AwaitingCustomerConfirmation` Accept/Reject UI (formerly reschedule-labelled) is the customer confirm/decline surface — copy generalized to confirmation wording in all 4 locales. **Partner app**: read-only "Awaiting Customer", no provider actions.

Class-default values for any bound options class must mirror these (memory `feedback_appsettings_class_defaults`).

---

## SERVICE BUS QUEUES + MESSAGES (`clinqetshared\DTOs\Messages\`)

| Queue (`ServiceBusSettings`) | Message Class | Trigger Function |
|---|---|---|
| `BookingEmailsQueueName` (`booking-emails`) | `BookingEmailMessage` (BookingId, BusinessId, CustomerId, EmailType, RejectionReason?) | `BookingEmailProcessor` |
| `BookingTimeoutCheckQueueName` (`booking-timeout-check`) | `BookingTimeoutCheckMessage` (BookingId, BusinessId, CustomerId, ScheduledFor) | `BookingTimeoutProcessor` |
| `BookingRemindersQueueName` (`booking-reminders`) | `BookingReminderMessage` (BookingId, BusinessId, CustomerId, ScheduledFor, ReminderNumber=1) | `BookingReminderProcessor` |
| `BookingAutoCompletionQueueName` (`booking-auto-completion`) | `BookingAutoCompletionMessage` | `BookingAutoCompletionProcessor` |
| `BookingCancellationsQueueName` (`booking-cancellations`) | `BookingCancellationMessage` (CancellationReason, CancellationType) | `BookingCancellationProcessor` |
| `ProviderConfirmationRequestsQueueName` (`provider-confirmation-requests`) | `ProviderConfirmationRequestMessage` (built inline; provider contact + customer info + scheduled time + preferredLanguage) | `ProviderConfirmationProcessor` |

All Service Bus handlers are idempotent (§9 of CLAUDE.md). `forceAdminAlert || EnableAdminAlertOnFailure` honored on send failures.

---

## SERVICE — `BookingService.cs` (`clinqetinfrastructure\Services\Booking\`)

Public surface (~1237 lines, multiple state-routing entry points):

- `HandleStatusChangeAsync(booking, previousStatus, newStatus, changedBy: UserType, preferredLanguage, cancellationReason?, rejectionReason?, ct)` — main dispatcher; routes to internal handlers per `newStatus`.
- `HandleBookingCreatedAsync(booking, createdBy: UserType, preferredLanguage, ct)` — if status=Confirmed → `HandleConfirmedAsync`; if AwaitingProviderConfirmation → schedules `ProviderConfirmationRequestMessage` + timeout message (48h default).
- `HandleBookingUpdatedAsync(booking, dateTimeChanged, updatedBy: UserType, preferredLanguage, ct)` — only acts on Confirmed/InProgress. If `dateTimeChanged`, cancels old reminders + reschedules. Dispatches `BookingUpdated` notification + queues `BookingUpdated` email.
- `ScheduleBookingReminderAsync(booking, preferredLanguage="en", ct) → long?` — schedules `BookingReminderMessage` at `ScheduledStartDateTime - reminderHoursBeforeBooking`; returns SequenceNumber for cancellation.
- `CancelScheduledTimeoutAsync(booking, ct)` — cancels timeout SB message by stored sequence number.
- `CancelScheduledRemindersAsync(booking, ct)` — cancels all reminder messages by sequence numbers.

Internal handlers (state-specific):
- `HandleConfirmedAsync` — cancel timeout, schedule reminder, queue confirmation email, schedule auto-completion (48h after end), schedule invoice past-booking check.
- `HandleRejectedAsync` — cancel timeout, dispatch rejection notification.
- `HandleInProgressAsync` — dispatch InProgress notification, schedule auto-completion.
- `HandleCompletedAsync` — cancel reminders+auto-completion, dispatch completion notifications, **auto-create Invoice via `InvoiceService.CreateFromBookingAsync(booking)`** (cross-link to `clinqet-invoice-generation` skill).
- `HandleCancelledAsync` — cancel all scheduled messages, queue cancellation email, create AdminAlert (if `SendAdminAlertOnBookingCancellation=true`).
- `HandleNoShowAsync` — cancel reminders+auto-completion, dispatch no-show notifications, create AdminAlert.

`HandleStatusChangeAsync` ALWAYS runs through `BookingValidationService.ValidateStatusTransitionAsync` first.

---

## VALIDATION — `BookingValidationService.cs` (`clinqetinfrastructure\Services\`)

- `CalculateNameSimilarity(name1, name2): double` — Levenshtein-based; used in customer matching.
- `ValidateStatusTransitionAsync(booking, newStatus, userType, cancellationReason?, providerCancelReason?): Task<(bool IsValid, string? ErrorMessage)>` — returns localization error keys (e.g. `Error_CannotChangeFromFinalStatus`, `Error_InvalidStatusTransition`, `Error_ProviderCancelReasonRequired`, `Error_ProviderCancelReasonNotAllowed`).

### State machine (NON-NEGOTIABLE — enforce in `ValidateStatusTransitionAsync`)

```
Draft
  ├─→ AwaitingProviderConfirmation (Partner only)
  └─→ Cancelled

AwaitingProviderConfirmation
  ├─→ Confirmed         (Partner only)
  ├─→ Rejected          (Partner only)
  ├─→ RejectedTimeout   (system on 48h timeout)
  └─→ Cancelled

AwaitingCustomerConfirmation
  ├─→ Confirmed         (Customer only)
  └─→ Cancelled

Confirmed
  ├─→ InProgress        (Partner only)
  ├─→ Completed         (Partner only)
  ├─→ NoShowCustomer    (Partner only)
  ├─→ NoShowProvider    (Customer only)
  └─→ Cancelled

InProgress
  ├─→ Completed         (Partner only)
  ├─→ NoShowCustomer    (Partner only)
  ├─→ NoShowProvider    (Customer only)
  └─→ Cancelled
```

Terminal states (no further transitions): `Completed, Cancelled, Rejected, RejectedTimeout, NoShowCustomer, NoShowProvider`. Cancellation requires a reason: free-text `cancellationReason` or `providerCancelReason` (D7, below). No-show transitions are refused by the controller before `ScheduledStartUtc` (D6, below). Availability cross-check happens before transition into Confirmed (delegate to AvailabilityRepository — cross-link to `clinqet-availability-calendar` skill).

---

## CONTROLLER — `BookingController.cs` (`clinqetapi\Clinqet.API\Controllers\`)

Route prefix `api/v{version:apiVersion}/bookings`. ApiVersion 1.0. `[Authorize]` on all endpoints. Multi-tenant isolation enforced via JWT claims (businessId for Partner, customerId for Customer).

| Verb | Route | DTO In | Notes |
|------|-------|--------|-------|
| GET | `/paginated` | `BookingQueryDto` | Partner-only. Returns `PagedResult<Booking>` |
| GET | `/customer` | (query: pageSize, continuationToken, status, startDate, endDate, sortOrder) | Customer-only. Returns `BookingPagedResultDto` |
| GET | `/{bookingId}` | — | Ownership-checked |
| POST | `/draft` | `DraftBookingRequestDto` | Skips Required validation; status=Draft |
| POST | `/` | `BookingRequestDto` | Creates Confirmed booking |
| PUT | `/{bookingId}` | `UpdateBookingRequestDto` | ETag concurrency |
| POST | `/{bookingId}/cancel` | `CancelBookingRequestDto` (cancellationReason?, providerCancelReason?) | Reason rule is in `ValidateStatusTransitionAsync`, not the DTO |
| PATCH | `/{bookingId}/status` | `UpdateBookingStatusRequestDto` (newStatus, rejectionReason?, cancellationReason?, notes?, providerCancelReason?) | Returns `BookingStatusUpdateResponseDto`. Carries the provider decline (`Rejected`) and the customer no-show report |
| DELETE | `/{bookingId}` | — | Business only, `Draft` only (D5); hard-delete |
| POST | `/{bookingId}/confirm` | — | Provider confirmation |
| POST | `/from-quote` | `CreateBookingFromQuoteRequestDto` | Converts Quote → Booking |
| POST | `/{bookingId}/attachments/sas-url` | `BookingAttachmentSasUrlRequestDto` (fileNames) | Returns SAS URLs |
| POST | `/{bookingId}/attachments/confirm` | List<string> | Persists confirmed filenames |
| DELETE | `/{bookingId}/attachments/{fileName}` | — | Removes attachment |
| POST | `/{bookingId}/send-confirmation` | — | Re-send confirmation email |

All responses use the `ApiResponse<T>` envelope (§5 CLAUDE.md). 412 Precondition Failed surfaces as a clear error (never silently overwrite).

‼️ **D-109 — a booking is addressed by its ID on every route.** A booking NUMBER is sequential per BUSINESS (D-108), so the first booking of two different providers is `BK-000001` at both: a route, a deep link, an email link or a `NotificationData` entry built from a number opens another provider's booking or none. The number stays as the words people read. `BookingNotificationLink.CustomerData(bookingId, bookingNumber)` composes the customer payload in one place; `BookingLinkAddressesByIdConventionTests` (API and Functions suites) fails the build on any link or id-field that takes a number.

---

## FUNCTION APP HANDLERS (`clinqetfunctions\Clinqet.Communications\Functions\`)

All Service Bus triggered, idempotent (re-delivery safe).

- `BookingEmailProcessor.cs` — pulls `BookingEmailMessage`, resolves template per `EmailType`, sends via email pipeline (per-language template). Honors `forceAdminAlert + EnableAdminAlertOnFailure`.
- `BookingTimeoutProcessor.cs` — on fire, fetches Booking; unless `IsResolved` (the awaited party confirmed, or the status left the awaiting state) → `RejectedTimeout`, written with the conditional `IHolderWriteService.ReplaceAsync` (D8, releases held offer uses). 412 ⇒ re-read: resolved meanwhile ⇒ completes the message; still awaiting ⇒ throws (redelivery). NotFound ⇒ completes.
- `BookingReminderProcessor.cs` — sends `BookingReminder` notification via `CommunicationDispatcher` (24h before scheduled start).
- `BookingAutoCompletionProcessor.cs` — on fire, if status=Confirmed/InProgress (`IsOpenForCompletion`) → `Completed`, written with `TryReplaceBookingAsync(booking, booking.ETag!)`. Any other status (Completed, `NoShowProvider`/`NoShowCustomer`, a cancel) was ended by someone else ⇒ message completed, never completed over; a lost race re-reads and does the same, else throws for redelivery. Emits `BookingAutoCompleted` notification.
- `BookingCancellationProcessor.cs` — handles cancellation email, AdminAlert, refund flag housekeeping. When `Booking.ProviderCancelReason` is set, `ReasonFor` sends the customer `BookingCancelReason_{reason}` and the team `BookingCancelReasonForTeam_{reason}`, each in the recipient's language, followed by any typed note.
- `ProviderConfirmationProcessor.cs` — first send when booking lands in AwaitingProviderConfirmation; uses Telnyx SMS (if subscribed) + email + push.

---

## NOTIFICATION DISPATCH

Customer-personal booking notifications continue through `ICommunicationDispatcher.DispatchAsync(CommunicationRequest)`. Provider-business booking notifications from `BookingController` and `BookingService` resolve recipients through `IBusinessCommunicationDispatcher.DispatchAsync(BusinessCommunicationRequest, requestFactory)`. Real-time delivery still requires the type in `SignalRSettings:EnabledNotificationTypes`.

- Business requests use `Scope = Business`, the persisted `BusinessId`, and `booking.ToScopedResource()`. Booking workspace links target `/dashboard/bookings/{bookingId}` (D-109).
- `NotificationRoutingCatalog` derives routing class, required permission, and preference classification. Non-`SystemNotification` producers must not set routing, permission, or preference overrides.
- `EventId` identifies the durable booking transition. Create uses the persisted booking identity; later transitions add the notification type and the persisted ETag, falling back to `UpdatedAt` ticks. A retry of the same transition must reproduce the same ID.
- The request factory renders title, body, and language-sensitive template data separately for every `ResolvedRecipient` using `recipient.PreferredLanguage`.
- `BusinessCommunicationDispatcher` validates/expands external workspace links with `QRCodeSettings:PartnerBaseUrl` and centrally applies resolved member identity, mandatory-email rules from `CommunicationPreferenceConfig`, immediate/digest channel policy, SMS/WhatsApp eligibility, and `EventId + userNumber + businessId` idempotency. Producer `SkipEmail` cannot disable mandatory email.
- This is the multi-user-provider Phase 5 API/infrastructure producer activation. Invitations, team/branch CRUD, and assignment writes remain Phase 6; the Functions/MCP/voice producer sweep remains Phase 7.

---

## FRONTEND

### Partner app (`clinqetwebpartnerapp`)
- Components: `src\components\booking\` — `ActionMenu.jsx`, `AddBookingForm.jsx`, `AttachmentsUpload.jsx`, `Booking.jsx`, `BookingCard.jsx`, `BookingDetailsForm.jsx`, `BookingTab.jsx`, `BookingsDetails.jsx`, `BookingsSections.jsx`, `CustomerDetailsForm.jsx`, `PricingForm.jsx`, `ServiceAccordion.jsx`, `ServiceForm.jsx`, `ServicesList.jsx`.
- Pages: `src\app\dashboard\bookings\[id]\page.jsx` (details), `src\app\dashboard\bookings\[id]\layout.js`.
- Calendar view: cross-link to `clinqet-availability-calendar` skill (`src\app\dashboard\calender\` — typo preserved).
- Provider-side actions: confirm, decline (`AwaitingProviderConfirmation` → `Rejected`), mark in-progress, mark completed, mark no-show, cancel (not offered on `Draft` or `AwaitingProviderConfirmation`), delete (`Draft` only), edit (with ETag retry), attach files. Rules: `src\utils\bookingActionPolicy.js` (`canDeclineBooking`, `canCancelBooking`, `canDeleteBooking`, `needsProviderCancelReason`, `providerCancelReasonsFor`); mobile mirror `src\lib\bookingActionPolicy.ts`.

### User app (`clinqetwebuserapp`)
- Customer booking pages live under the customer tree; use `CustomerBooking` denormalized records via `/api/v1/bookings/customer`.
- Booking detail with status timeline, edit, cancel, view invoice (cross-link `clinqet-invoice-generation` skill), and the "provider didn't come" report (`components\customer\myBookings\myBookingsTabs\model\providerNoShowModel.jsx` → `PATCH /status {newStatus: NoShowProvider}`), offered only once the appointment has started. Mobile: `BookingDetailScreen.tsx` + `canReportProviderNoShow` (`src\utils\bookingStatus.ts`).

### Admin app (`clinqetwebadmin`)
- No dedicated Booking page; admin oversight via `AdminAlert` entries (cancellations, no-shows, AI errors). Cross-link `clinqet-admin-app` skill.

### Shared rule
- All copy via `react-intl` keys (no inline English).
- Mobile-first responsive (memory `feedback_clinqet_engineering_standards`).
- ESLint zero errors after any UI change.

---

## TESTS

Unit (xUnit + Moq + AutoFixture):
- `BookingRepositoryTests` — partition isolation, composite id, pagination, status filter, sort orders.
- `CustomerBookingRepositoryTests` — idempotency key dedupe, customer-partition isolation.
- `BookingServiceTests` — every state-handler path; scheduled-message lifecycle (schedule → cancel on transition); auto-completion timing.
- `BookingValidationServiceTests` — state machine completeness (every transition + every guard).

Integration (`ClinqetApiFactory` + Testcontainers Cosmos emulator):
- Booking CRUD end-to-end via controller.
- Provider confirmation timeout → RejectedTimeout.
- Auto-completion flow → Completed → Invoice draft created.
- ETag 412 round-trip.
- Service Bus scheduled message cancellation on state change.

**Always add a string-shape SQL unit test for new composite-index ORDER BY queries** (memory `feedback_cosmos_emulator_vs_prod_matcher`).

---

## CROSS-LINKS

- Invoices: `clinqet-invoice-generation` SKILL — auto-creation on Completed.
- Availability: `clinqet-availability-calendar` SKILL — conflict checks before Confirmed.
- Notifications: `clinqet-notifications` SKILL — customer-personal events use `ICommunicationDispatcher`; provider-business events use `IBusinessCommunicationDispatcher`.
- Quote→Booking conversion: `clinqet-quote-lead-broadcast` SKILL — `POST /from-quote`.
- Media: `clinqet-media-derivatives` SKILL — attachment SAS upload.

---

## CHECKLIST BEFORE MERGE

- [ ] Every Cosmos query is partition-scoped (`/businessId` on Transactions, `/customerId` on CustomerData). NO cross-partition queries (§0.6 CLAUDE.md).
- [ ] Both `Booking` and `CustomerBooking` written/updated atomically (compensating logic on partial failure).
- [ ] State transition runs through `BookingValidationService.ValidateStatusTransitionAsync`. New transition? Update the state machine here AND in the SKILL.
- [ ] Scheduled SB messages cancelled on terminal state (timeout, reminders, auto-completion).
- [ ] ETag concurrency honored — 412 returned to client with clear error (no silent overwrite).
- [ ] Idempotency key checked on Create (dedupe customer-side `CustomerBooking.idempotencyKey`).
- [ ] Service Bus handler idempotent (re-delivery produces same end state).
- [ ] New `NotificationType` added to `SignalRSettings:EnabledNotificationTypes` (Main API appsettings).
- [ ] No hardcoded English — all labels, validation messages, notification titles/bodies via localization keys (memory `feedback_clinqet_engineering_standards`).
- [ ] Composite index covers any new sort path; string-shape SQL unit test added.
- [ ] Unit + integration tests for every new endpoint / repo method / service path.
- [ ] Backend builds clean. ESLint zero errors on changed UI.
- [ ] `BookingSettings` defaults in options class match `appsettings.json` (memory `feedback_appsettings_class_defaults`).

## CANCELLATION MODEL — D3 booking-day gate + ONE cancel path (2026-07-17)

- `BookingService.CancelBookingAsync(booking, reason?, cancelledBy, language, actorUserId?, providerCancelReason?)` is THE only cancel path — called by BOTH `POST /bookings/{id}/cancel` AND `PATCH /{bookingId}/status→Cancelled`. It always runs `ValidateStatusTransitionAsync` (state machine + the `Transferred`/provider-paid guard + reason-required), applies the cancel fields, updates the `CustomerBooking` mirror, then runs `HandleStatusChangeAsync` side-effects. Outcome enum `BookingCancelResult {Ok, NotAllowed, Blocked}`; Blocked ⇒ HTTP 400 with `ApiResponse.ErrorCode="booking_day_contact_support"` + `Error_BookingSelfCancelBookingDay` (en/fr/hi/gu).
- **Customer self-cancel gate (D3)**: `BookingCancellationPolicy.EvaluateForCustomer` (clinqetcore/Utilities) — free self-cancel strictly BEFORE the booking's LOCAL calendar day (zone = `Booking.TimeZoneId` → profile → `BusinessTime` default); on/after the day ⇒ blocked with reason `booking_day_contact_support`. Draft/AwaitingProviderConfirmation/AwaitingCustomerConfirmation are ALWAYS customer-cancellable (declining an uncommitted booking must never deadlock); terminal statuses ⇒ (false, null); no-schedule bookings ⇒ allowed. Providers are exempt (state machine only). Setting `Booking:SelfCancelCutoff` (enum `SelfCancelCutoff`: `BeforeBookingLocalDate` default | `BeforeStart`); **`Booking:CancellationWindowHours` is DELETED** (API + MCP + tests). The MCP voice `cancel_my_booking`/`find_booking` use the SAME policy (hint codes `available|bookingDay|notCancellable`).
- **Eligibility as data**: `Booking.CanSelfCancel` + `Booking.SelfCancelBlockedReason` are response-only stamps (`[Newtonsoft.Json.JsonIgnore]` ⇒ never persisted; STJ-visible, null-omitted) computed for the CALLING customer on `GET /{bookingId}` and each `GET /customer` list item (stamp AFTER the final Cosmos save, same contract as attachment-URL transforms). `BookingPaymentStatusDto.canSelfCancel/selfCancelBlockedReason` mirror it; `canCancelFree` ANDs it. Independent of `OnlineBookingPayEnabled` — the customer cancel button works with pay off.
- **DI note:** `BookingService` now requires `IBookingValidationService` (registered in API AND Functions hosts — the Functions host registers BookingService for voice side-effects).
- **D2 completion signals:** provider-initiated `HandleCompletedAsync` still emits the `Complete` booking-pay signal; the capture itself is now MUTUAL (both `ProviderConfirmedCompletedAt` + `CustomerConfirmedCompletedAt`) with a grace backstop — see clinqet-payments.

### Final adversarial audit hardening (same program, post-audit fixes)
- **Backstop is now retry-safe:** `OnBookingCompletedAsync` returns `BookingPaymentOutcome`; the processor's `Complete` op retries (Abandon→redelivery→DLQ+admin alert) on `NotReady` (capture still settling) — a transient gateway wobble can no longer silently consume the one-and-only backstop message. Declined/async-"pending" are terminal for the message (surfaced / webhook-owned). A backstop re-fire landing back inside a RAISED grace window re-arms itself; the mutual deferral applies ONLY under `CaptureTrigger=OnCustomerCompletion` (BeforeAppointment never defers); a freshness re-read suppresses the customer prompt when they confirmed mid-race.
- **Cancel is ETag-CAS:** `CancelBookingAsync` re-reads + re-validates on a fresh copy per attempt and saves via `TryReplaceBookingAsync` (bounded retries; exhaustion ⇒ `Error_DbConcurrencyConflict`) — a racing payment/status write is never clobbered by a stale full-document save. Terminal-state customer cancels fall through to the state machine (accurate error, never a bogus booking-day block). The WhatsApp customer DECLINE (`BookingReplyActionService`) now routes through `CancelBookingAsync` too (stamps + mirror + side-effects).
- ‼️ **Every non-create booking write in `BookingController` goes through `WriteBookingAsync(…, create: false)`** ⇒
  `IHolderWriteService.ReplaceAsync`, conditional on the ETag the read carried (no ETag ⇒ `PersistenceContractException`).
  A newer write ⇒ 409 `Error_DbConcurrencyConflict`, never overwritten (draft update, update, status, confirm).
- **Every route that ENDS a booking stamps `CancelledAt` + `CancelledBy` (Phase 4, 2026-08-14):** in-app reject (`BookingController`), phone/WhatsApp reply-decline (`BookingReplyActionService`), timeout (`BookingTimeoutProcessor`, always did) and cancel (`CancelBookingAsync`). ‼️ Nothing infers status from `CancelledAt` — status is the authority, and a `Rejected`/`RejectedTimeout` booking legitimately carries these stamps (swept across all five apps). The reply-decline undo CLEARS both, because a Confirmed booking carrying a cancellation stamp reads as cancelled in every audit/PDF/support view. **No `RejectedAt` field exists — it was proposed and rejected; use this pair.**
- **Reply-driven confirm/decline is a FULL transition (Phase 4, 2026-08-14):** `BookingReplyActionService` provider Confirm/Decline and customer Confirm use the SAME ETag-CAS loop + `HandleStatusChangeAsync` as the in-app endpoint — timeout cancel, notifications, email, reminders, auto-completion, invoice check, and the payment unwind on decline all ride the shared path; the mirror gets the confirm flags. Never re-add a hand-rolled dispatch/email subset there. (The in-app `BookingController.UpdateBookingStatus` write itself still uses `UpdateBookingAsync` — a recorded last-write-wins residual outside the WhatsApp programme.)
- Also fixed: multi-role Admin claim check in `BaseController`; fr.json backfill for BookingPaymentSucceeded/Failed/RefundIssued/PayoutReleased; `Booking:SelfCancelCutoff` added to the Functions appsettings; admin AlertsPage filter = exact `AdminAlertType` enum-order parity (phantom `VoiceAssistantAccessRequested` removed); provider "Paid out" shows no amount (the payout ≠ the customer charge on promo-funded/partially-refunded bookings); "within 24 hours" copy replaced with windowless wording everywhere (grace is configurable); provider cancel note gated on an actual hold (Authorized/Vaulted); customer confirm-completion hint carries the {amount}; mark-complete now refreshes the web payment panel; day-of/pending-refund contact-support copy corrected on mobile; list-card cancels tracked as surface `booking_list`.

## ‼️ PHASE 3 AUDIT — a customer books at the CATALOGUE price (Q-1, UW-21, 2026-09-24)

- **The server derives every customer line price** from the stored `Service.Pricing` through
  `Clinqet.Core.Utilities.ServiceBookingPrice` (declared type, else inferred from the amounts; hourly = rate ×
  max(minimum hours, 1); floored by the minimum charge; rounded to the currency's minor unit). Create, draft save,
  draft update and update all do it; a body's amounts are never read for a customer. Providers set their own.
- **Visit fee**: once per booking, at the highest fee among the booked services (`BookingController.CustomerBookingPrice`).
  **Travel (distance) fee**: never charged at booking — the provider adds it on confirmation; the preview says so.
- **`POST api/v1/bookings/price-preview`** returns exactly what the booking will store (`BookingMappingExtensions.PriceBooking`
  is shared with `ToEntity`): lines, services total, discount, visit fee, tax (or "includes tax"), total, currency,
  `travelFeeToFollow`. Every customer checkout (web + phone) renders it (`checkout-price-breakdown` sheet).
- **Refused for a customer (400)**: an unlisted line (`Error_ServiceNotFound`), and a service with **no set price**
  (`BaseOf == 0` ⇒ `Error_ServiceHasNoSetPrice`, naming the service) on create, draft save/update, update and the
  preview. A minimum charge alone IS a price. The apps show "Get a quote" instead of booking.
- Offers travel ONLY in `appliedOffers` (Q-2); the server calculates them once, against the catalogue price.

## Confirmation window and timeout wording (2026-09-26)
- The provider confirmation request states `{{ConfirmationHours}}` (`Booking:ProviderConfirmationTimeoutHours`) — never a hard-coded "48"; its WhatsApp `expiresAt` = the request message's `EnqueuedTime` + the window (the timeout is scheduled when the request is sent and a reschedule restarts it), never `booking.CreatedAt`.
- Timeout emails are party-neutral ("was not confirmed in time"); `BookingTimeoutProvider` carries `{{PartyNote}}` = `BookingTimeoutProvider_Note_{ProviderParty|CustomerParty}`, so a customer-party timeout never tells the provider to confirm faster. Guards: `BookingTimeoutProcessorTests.Run_Timeout_EachEmailNamesWhoDidNotConfirm`, `ProviderConfirmationProcessorTests.Run_StatesTheConfiguredWindow_…`.

## D-108 + P4-140 (2026-09-28)

- **A booking takes its number in the repository's create batch** (`BK-000123`), never from a generator: the number and
  the record are one batch, so a failed create consumes nothing and a replay throws `DuplicateItemException`.
- ‼️ **P4-140 — a service that cannot be SEEN cannot be BOOKED.** One shared predicate,
  `ServiceIndexGates.IsIndexable(service.IsActive, service.IsDeleted, service.ApprovalStatus?.ToString())` — the same
  rule the public index uses, so a card and a checkout can never disagree. Refusal:
  `Error_ServiceNotBookable` (five languages), naming the service.
  Gated: `BookingController` create, draft-create, price-preview and from-quote; the draft→booked transition in
  `UpdateBookingStatus`; `CartService` (the line LEAVES the cart, as an unpriced one does); `QuoteController` (an
  unsellable service is never bound to a quote line, the typed text and price stay); MCP `PartnerTransactionTools`
  create_booking and create_quote. MCP `BookingTools` already gated all three states on both paths.
- **Deliberately NOT gated: the booking and draft UPDATE paths.** Existing bookings stand, and the client re-sends the
  whole line list — gating there would block editing the time of a booking whose service was later paused.
- **`TestDataBuilder.CreateValidService` now defaults to `ApprovalStatus = Approved`**: the entity's own default is
  `PendingApproval`, which P4-140 refuses, and a "valid" catalogue service is one a customer can actually buy.

## ‼️ Scoring-lane booking rules — D5–D9, D13, N1, N2 (2026-09-29, uncommitted)

Why: the nightly provider scores (`clinqetcore\Utilities\ProviderScoreEvaluator.cs`, run from `SmartAnalyticsAggregationService`) read booking outcomes, so each
of these closes a way a booking misreported whose fault something was.

- **D5 — only a Draft is deleted, only by the business.** `DELETE /bookings/{id}`: non-Business ⇒ 403
  `Error_BookingDeleteDraftOnly`; scope key `booking.delete`; status ≠ `Draft` ⇒ 400 `Error_BookingDeleteDraftOnly`.
  Anything past Draft is declined or cancelled, never erased. A draft has no `CustomerBooking` (one is made only when it
  leaves Draft), so the delete touches nothing in `CustomerData`. The old customer branch deleted the BUSINESS's document.
- **D6 — customer "provider didn't come".** `PATCH /{id}/status {newStatus: NoShowProvider}` (Customer only, from
  `Confirmed`/`InProgress`). `BookingController.UpdateBookingStatus` asks `IBookingService.NoShowReportRefusalKey(booking,
  now)` for `NoShowProvider` AND `NoShowCustomer` ⇒ 400 with the key: no `ScheduledStartUtc` ⇒
  `Error_NoShowWithoutAppointmentTime`; before start ⇒ `Error_NoShowBeforeAppointment`; after start +
  `Booking:AutoCompletionHours` ⇒ `Error_NoShowReportWindowClosed`. The window is the booking's own clock, never a scheduled
  auto-completion (a provider-created or back-dated booking has none). Customer apps label it "The provider didn't come"
  in a neutral closed state, not "No Show"/"Request declined".
- **D7 — `providerCancelReason`** (`ValidateProviderCancelReason` in `BookingValidationService`):
  - Business cancelling a booking with `ConfirmedByProvider == true` ⇒ reason REQUIRED (`Error_ProviderCancelReasonRequired`).
  - Given in any other case (customer, unconfirmed booking, or a status other than `Cancelled`), or an undefined value ⇒
    `Error_ProviderCancelReasonNotAllowed`. DTO-level: `[EnumDataType]` ⇒ `Error_InvalidProviderCancelReason`.
  - `EnteredByMistake` only when `booking.CreatedBy == "Business"`.
  - Free text becomes optional: `Error_CancellationReasonRequired` only when BOTH are empty. `CancelBookingAsync` trims
    the note (blank ⇒ null) and stores both. Only `CouldNotDoIt` (or no reason) counts against reliability.
  - UI: tapping a reason IS the cancel (no second confirm) — partner web `ActionStatusModal.jsx`, mobile `CancelReasonSheet.tsx`.
- **D8 — the 48 h confirmation timeout is unchanged for the customer** (`Booking:ProviderConfirmationTimeoutHours`,
  wall clock; the write is now conditional so a confirm landing as it fires wins). A `RejectedTimeout` with `TimeoutParty == Provider` counts against
  the provider only when the request was open ≥ `ProviderScoring:JudgeAfterOpenHours` (8) of THEIR opening hours
  (`OpeningHoursClock`: a week under `MinWeeklyOpenHours` (10) is stretched to it; wall clock only when the business has
  no hours on record at all).
- **D9 / N16 — `BookingIntake`** (`clinqetcore\Utilities\BookingIntake.cs`): `IsTakingBookings` = `IsListed` AND
  `Status == Active`. `OnlineRefusalKey` ⇒ `Error_BusinessNotTakingBookings`, else `Error_OnlineBookingsDisabled` when
  `!AllowOnlineBookings`, else null. Gated: `POST /bookings` and `POST /bookings/draft` (Customer only), `POST
  /bookings/price-preview` (every caller); MCP `request_booking` throws "…not taking new bookings right now. Take a message
  instead." Also gated: the customer's awarded-quote conversion (`BroadcastService`, no `expectedProviderId`) ⇒
  `Error_BusinessNotTakingBookings`; the voice post-call auto-apply of a `DraftBooking` (`VoicePostCallProcessorFunction`
  leaves it out, `CallFollowUpApplyService` refuses it if the pause races) ⇒ it stays a Pending review card. NOT gated:
  `POST /from-quote` and the provider's lead conversion.
- **N1 / D13 — decline is `Rejected`, never `Cancelled`.** The web Reject/"Decline" button and the mobile card used to open
  Cancel. Now `rejectBooking` ⇒ `PATCH /{id}/status {newStatus: Rejected, rejectionReason?}`; the controller stamps
  `RejectionReason`, `CancelledAt`, `CancelledBy` (`CancelledAt` is the decline time, D18: no `providerRespondedAt`). The
  decline dialog (web `DeclineBookingDialog.jsx`, mobile `DeclineRequestSheet.tsx`) shows one line with links to pause
  the listing or update hours.
- **N2 — `ProviderConfirmedAt` means an actual confirmation.** `BookingMappingExtensions.ToEntity` now sets
  `ConfirmedByProvider = false` and no `ProviderConfirmedAt`. Stamped only by: `POST /bookings` when auto-confirmed
  (else explicitly null), `PATCH /status → Confirmed` by the Business, `POST /{id}/confirm`, the from-quote mapping and
  `BroadcastService` when auto-confirmed/provider-created, `BookingReplyActionService` provider confirm, and MCP
  `PartnerTransactionTools`.
