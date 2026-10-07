---
name: clinqet-invoice-generation
description: |
  **CORE FEATURE SKILL** — Work on the Invoice feature end-to-end. Invoice entity,
  state machine (Draft → Sent → Paid / Overdue / Cancelled), PDF generation via
  QuestPDF, payment tracking, soft-delete with TTL, auto-creation from completed
  Booking, customer-side denormalized invoice view (CustomerInvoice), earnings
  analytics, past-booking timer check, partner-app invoice management.
  USE FOR: invoice CRUD, status transitions, PDF generation, send/email flow,
  payment recording, soft-delete, earnings graph, dedupe by context+contextId,
  invoice-from-booking, Service Bus integration (2 queues), partner-app invoice
  UI. Applies to clinqetcore/Entities/COSMOS/Cosmos.cs (Invoice + CustomerInvoice
  + InvoiceItem + PaymentInfo + InvoiceCustomerInfo), clinqetinfrastructure/
  Data/COSMOS/InvoiceRepository.cs + CustomerInvoiceRepository.cs,
  clinqetinfrastructure/Services/Invoice/InvoiceService.cs,
  clinqetinfrastructure/Services/Documents/QuestPdfService.cs, clinqetapi
  Controllers/Invoice/InvoiceController.cs, clinqetfunctions
  Functions/InvoiceEmailProcessor.cs + InvoicePastBookingProcessor.cs,
  clinqetwebpartnerapp src/app/dashboard/invoices.
---

# CLINQET INVOICE GENERATION — COMPREHENSIVE SKILL

## RECENT CHANGES — 2026-10-06 (never an invoice for a job nobody priced)

See the `clinqet-prepared-providers` skill for the whole feature. What changed HERE:

- ‼️ **BOTH invoice-from-booking paths refuse a price-less booking**, not just `CreateFromBookingAsync`. `EnsureBookingInvoiceSentAsync` is the path online booking-pay takes, and without the guard a completed price-less job raised a **Sent $0 invoice**, asked the gateway for a $0 link and emailed the customer a $0 PDF.
- **`EnsureBookingInvoiceSentAsync` returns `Invoice?`** — null means "there is nothing to bill yet".
- **`EnsurePaymentPendingAsync` also refuses it**: nothing is pending when nobody has said what the job costs.
- **`BookingPriceDisplay.IsAwaitingPrice` is the one rule**, and the PDF prints "To be confirmed" rather than a 0.

## ENTITIES (`clinqetcore\Entities\COSMOS\Cosmos.cs`)

### `Invoice` (~lines 2640-2745)
- Container: `Transactions` (same as Bookings + Quotes). Partition key: `/businessId`. Document id: `{businessId}_{invoiceId}`. ETag concurrency.
- Key fields:
  - `invoiceId`, `invoiceNumber`, `businessId` (pk), `businessName`
  - `context?` — typically `"Booking"`; `contextId?` — the booking id (used for dedupe)
  - `customer: InvoiceCustomerInfo` (customerUserNumber→customerId, firstName, lastName, email, phoneNumber, address)
  - `billingAddress: Address?`, `serviceAddress: Address?`
  - `purchaseOrderNumber?`, `referenceNumber?`
  - `invoiceDate`, `dueDate?`
  - `items: List<InvoiceItem>` — line items
  - `subTotal: decimal`, `taxMode: string` (default "Percentage"), `taxPercentage: decimal`, `taxAmount: decimal`
  - `discountAmount?: decimal`, `discountDescription?: string`
  - `appliedOffers: List<AppliedOffer>?`
  - `totalAmount: decimal`, `currency: string` (default "USD")
  - `status: InvoiceStatus`
  - `notes?`, `terms?`
  - `sentAt?`, `sentToEmail?`, `paymentLink?`
  - `paymentInfo?: PaymentInfo` (paymentMethod, transactionId, paidAt, amountPaid)
  - `isDeleted: bool` (soft-delete flag)
  - `createdBy`, `updatedBy?`
  - `ttl: int?` — from `DocumentTtl:InvoiceTtlDays` (default 730); reduced to `DocumentTtl:InvoiceSoftDeleteTtlDays` (default 30) on soft-delete

### `InvoiceItem` (~lines 2586-2623)
`description, quantity, unitPrice, amount, isTaxable (default true), serviceId?, serviceName?, discountAmount?, discountType?, discountValue?, appliedOfferId?, offerName?`

### `PaymentInfo` (~lines 2625-2638)
`paymentMethod?, transactionId?, paidAt?, amountPaid?`

### `InvoiceCustomerInfo` (~lines 2565-2584)
`customerUserNumber: string?` (JSON property `customerId`), `firstName?, lastName?, email?, phoneNumber?, address: Address?`

### `CustomerInvoice` (~lines 2747-2792) — customer-side denormalized view
- Container: `CustomerData`. Partition key: `/customerId`. Document id: `{customerId}_{invoiceId}`.
- Subset: `customerId` (pk), `invoiceId`, `invoiceNumber`, `businessId`, `businessName`, `invoiceDate`, `dueDate`, `totalAmount`, `currency`, `status`, `context`, `contextId`, `isDeleted`, `ttl: int?` (from `DocumentTtl:CustomerInvoiceTtlDays` default 730).

Both records written/updated together — never one without the other.

---

## ENUMS

### `InvoiceStatus` (`clinqetshared\Enums\InvoiceStatus.cs`)
Verbatim: `Draft, Sent, Paid, Overdue, Cancelled`. `[JsonConverter(typeof(JsonStringEnumConverter))]`.

### Invoice-related `EmailType` (`clinqetshared\Enums\EmailType.cs`)
Invoices reuse `Confirmation` plus the broader email pipeline; PDF attached when `Sent` or `Paid`.

### `CommunicationOperationType` — includes invoice-relevant entries via Quote/Booking codes; invoices themselves run through the email function with PDF attachment.

---

## CONTAINERS & INDEXES

### Transactions (shared with Booking + Quote)
Partition key `/businessId`. Composite indexes already present that benefit invoices:
1. `(/type ASC, /isDeleted ASC, /status ASC, /invoiceDate DESC)` — list active by status sorted by date
2. `(/type ASC, /isDeleted ASC, /invoiceDate DESC)`
3. `(/type ASC, /isDeleted ASC, /status ASC, /totalAmount DESC)`
4. `(/type ASC, /isDeleted ASC, /totalAmount DESC)`
5. `(/type ASC, /status ASC, /issueDate DESC)`
6. `(/type ASC, /price/totalAmount DESC)` (shared with bookings; used for amount sort)

Included paths covering invoice fields: `/invoiceNumber/?`, `/invoiceDate/?`, `/dueDate/?`, `/totalAmount/?`, `/isDeleted/?`, `/context/?`, `/contextId/?`, `/paymentInfo/paidAt/?`.

### CustomerData (customer-side)
Partition key `/customerId`. Composite `(/type ASC, /status ASC, /invoiceDate DESC)` covers customer's invoice list.

**Filter columns lead `ORDER BY`** (memory `feedback_cosmos_emulator_vs_prod_matcher`). Add string-shape unit tests.

---

## REPOSITORIES

### `InvoiceRepository.cs` (`clinqetinfrastructure\Data\COSMOS\`)
Every method partition-scoped on `/businessId`.

- `GetInvoiceByIdAsync(invoiceId, businessId, ct)` — point read `{businessId}_{invoiceId}`.
- `GetInvoiceByNumberAsync(invoiceNumber, businessId, ct)` — `WHERE c.invoiceNumber=@n AND c.isDeleted=false`.
- `CreateInvoiceAsync(invoice, ct)` — sets composite id + TTL.
- `UpdateInvoiceAsync(invoice, ct)` — ETag concurrency.
- `GetPaginatedInvoicesAsync(businessId, InvoiceQueryDto, ct)` — filters (status, dateRange, customer name/email, searchText), sort options (invoiceDate/totalAmount/status/customerLastName; default invoiceDate DESC). Excludes soft-deleted.
- `GetInvoiceSummaryAsync(businessId, ct) → List<(InvoiceStatus, int Count, decimal Total)>` — GROUP BY status with counts + totals.
- `GetOverdueInvoiceSummaryAsync(businessId, ct) → (int Count, decimal TotalAmount)` — `WHERE status=Sent AND dueDate<now`.
- `GetInvoiceByContextAsync(businessId, context, contextId, ct)` — **dedup helper** so booking → invoice never creates twice.
- `GetTodayPaidEarningsAsync(businessId, todayStart, todayEnd, ct)` — `WHERE status=Paid AND paymentInfo.paidAt IN range`.
- `GetPendingInvoiceCountAsync(businessId, ct)` — `WHERE status NOT IN (Paid, Cancelled)`.
- `GetPaidInvoicesInRangeAsync(businessId, startDate, endDate, ct) → List<(DateTime PaidAt, decimal TotalAmount)>` — earnings graph data.

### `CustomerInvoiceRepository.cs`
- `GetCustomerInvoiceByIdAsync(invoiceId, customerId, ct)`.
- `CreateCustomerInvoiceAsync(customerInvoice, ct)` — TTL from `DocumentTtl:CustomerInvoiceTtlDays`.
- `UpsertCustomerInvoiceAsync(customerInvoice, ct)` — used on every Invoice update to keep customer side in sync.

---

## SETTINGS

```
Invoice:DefaultDueDays             = 30
Invoice:DefaultCurrency            = "USD"
Invoice:PastBookingGraceDays       = 3
DocumentTtl:InvoiceTtlDays         = 730
DocumentTtl:CustomerInvoiceTtlDays = 730
DocumentTtl:InvoiceSoftDeleteTtlDays = 30
```

Class-default values must match `appsettings.json` (memory `feedback_appsettings_class_defaults`).

---

## SERVICE BUS QUEUES + MESSAGES (`clinqetshared\DTOs\Messages\`)

| Queue (`ServiceBusSettings`) | Message Class | Function |
|---|---|---|
| `InvoiceEmailsQueueName` (`invoice-emails`) | `InvoiceEmailMessage` (InvoiceId, BusinessId, CustomerEmail, PreferredLanguage, CorrelationId) | `InvoiceEmailProcessor` |
| `InvoicePastBookingCheckQueueName` (`invoice-past-booking-check`) | `InvoicePastBookingCheckMessage` (BookingId, BusinessId, CorrelationId) | `InvoicePastBookingProcessor` |

Both handlers idempotent. The past-booking timer scheduled by `BookingService.HandleConfirmedAsync` fires at `estimatedEndDateTime + Invoice:PastBookingGraceDays` to ensure an invoice exists for every completed booking.

---

## SERVICE — `InvoiceService.cs` (`clinqetinfrastructure\Services\Invoice\`)

Public surface:

- `CreateInvoiceAsync(CreateInvoiceRequestDto dto, createdBy, preferredLanguage, ct) → Invoice` — creates with optional immediate send. Mirrors to `CustomerInvoice`.
- `CreateFromBookingAsync(booking, ct) → Invoice` — **idempotent via `GetInvoiceByContextAsync(businessId, "Booking", bookingId)`**. Status starts Draft; called from `BookingService.HandleCompletedAsync`.
- `UpdateInvoiceAsync(invoiceNumber, businessId, UpdateInvoiceRequestDto, updatedBy, preferredLanguage, ct) → Invoice` — only allows updates while Draft or Sent (not after Paid/Cancelled).
- `SendInvoiceAsync(invoiceNumber, businessId, preferredLanguage, ct) → Invoice` — Draft → Sent (or resend on Sent/Overdue). Sets `sentAt`, `sentToEmail`. Queues `InvoiceEmailMessage`.
- `UpdateStatusAsync(invoiceNumber, businessId, newStatus, updatedBy, preferredLanguage, ct) → Invoice` — runs `ValidateStatusTransition`. If `newStatus=Paid`: creates `PaymentInfo` with `paidAt=UtcNow`.
- `SoftDeleteAsync(invoiceNumber, businessId, ct) → bool` — sets `isDeleted=true`, `ttl = DocumentTtl:InvoiceSoftDeleteTtlDays * 86400` seconds. Soft-deletes `CustomerInvoice` in parallel.
- `GetByNumberAsync(invoiceNumber, businessId, ct) → InvoiceResponseDto?`.
- `GetPaginatedAsync(businessId, InvoiceQueryDto, ct) → PagedResult<Invoice>`.
- `GetSummaryAsync(businessId, ct) → InvoiceSummaryResponseDto`.
- `SchedulePastBookingInvoiceCheckAsync(booking, ct)` — schedules SB message `InvoicePastBookingCheckMessage` at `estimatedEndDateTime + graceDays`. Called from `BookingService` on Confirmed.
- `GetEarningsGraphAsync(businessId, startDate, endDate, currencySymbol, ct) → EarningsGraphResponseDto` — daily aggregation for partner dashboard.

### Status state machine — `ValidateStatusTransition(current, target)`
```
Draft      → Sent, Cancelled
Sent       → Paid, Overdue, Cancelled
Overdue    → Paid, Cancelled
Paid       → (terminal)
Cancelled  → (terminal)
```

---

## PDF GENERATION — `QuestPdfService.cs` (`clinqetinfrastructure\Services\Documents\`)

QuestPDF-based template. Token substitution per locale. Renders header (business profile + logo via media derivatives — cross-link `clinqet-media-derivatives` skill), customer block (billing + service address), line items (`InvoiceItem[]`), totals (subtotal, tax, discount, applied offers, total), payment status, notes/terms. Per-language templates under `clinqetinfrastructure\Resources\EmailTemplates\{lang}\Invoice*`.

Output: byte array attached to the invoice email by `InvoiceEmailProcessor`.

---

## CONTROLLER — `InvoiceController.cs` (`clinqetapi\Clinqet.API\Controllers\Invoice\`)

Route prefix `api/v{version:apiVersion}/invoices`. ApiVersion 1.0. `[Authorize]`.

| Verb | Route | DTO In | Notes |
|------|-------|--------|-------|
| GET | `/` | `InvoiceQueryDto` | Returns `PagedResult<Invoice>` |
| GET | `/{invoiceNumber}` | — | Returns `InvoiceResponseDto` |
| GET | `/summary` | — | Returns `InvoiceSummaryResponseDto` (status breakdowns + totals) |
| POST | `/` | `CreateInvoiceRequestDto` | Optional `SendImmediately` flag |
| POST | `/from-booking/{bookingId}` | `CreateInvoiceFromBookingRequestDto?` (billingAddress, PO, dueDate, notes, terms, sendImmediately) | Idempotent via dedupe |
| PUT | `/{invoiceNumber}` | `UpdateInvoiceRequestDto` | ETag concurrency |
| PATCH | `/{invoiceNumber}/send` | — | Draft→Sent; queues email |
| PATCH | `/{invoiceNumber}/status` | (newStatus) | Validates transition; sets PaymentInfo on Paid |
| DELETE | `/{invoiceNumber}` | — | Soft-delete |
| GET | `/earnings-graph` | (startDate, endDate, currencySymbol) | Returns `EarningsGraphResponseDto` |

All responses use `ApiResponse<T>` envelope. 412 on ETag mismatch.

---

## INVOICE NUMBER GENERATION

The `invoiceNumber` is expected to be set by the caller — usually a business-scoped sequential counter or UUID with prefix. The system **dedupes by `(businessId, context, contextId)` for booking-derived invoices** via `GetInvoiceByContextAsync` so re-running the past-booking check never creates duplicates.

---

## FUNCTION APP HANDLERS (`clinqetfunctions\Clinqet.Communications\Functions\`)

### `InvoiceEmailProcessor.cs`
- Trigger: `ServiceBusTrigger("%ServiceBusSettings:InvoiceEmailsQueueName%")`.
- Pulls `InvoiceEmailMessage` → resolves invoice → renders PDF via `QuestPdfService` → sends localized email with PDF attachment.
- Idempotent: re-delivery resends the same email (acceptable; alternatively use `MessageId` dedupe).
- Failure: `forceAdminAlert || EnableAdminAlertOnFailure` → AdminAlert.

### `InvoicePastBookingProcessor.cs`
- Trigger: `ServiceBusTrigger("%ServiceBusSettings:InvoicePastBookingCheckQueueName%")`.
- Pulls `InvoicePastBookingCheckMessage` → fetches Booking → if no invoice exists for `(businessId, "Booking", bookingId)` AND booking ended > `PastBookingGraceDays` ago → creates draft Invoice via `InvoiceService.CreateFromBookingAsync`.

---

## EARNINGS ANALYTICS

`InvoiceService.GetEarningsGraphAsync` aggregates paid invoices over a date range:
- Input: `businessId, startDate, endDate, currencySymbol`.
- Output: `EarningsGraphResponseDto { TotalEarnings, CurrencySymbol, DailyEarnings[] }`.
- Source query: `InvoiceRepository.GetPaidInvoicesInRangeAsync` (returns `(paidAt, totalAmount)` pairs).

Partner dashboard renders this as a chart; admin app does NOT have an earnings view.

---

## FRONTEND

### Partner app (`clinqetwebpartnerapp`)
- `src\app\dashboard\invoices\page.jsx` — list, filter, search, paginate.
- `src\app\dashboard\invoices\create\page.jsx` — create form.
- `src\app\dashboard\invoices\[id]\page.jsx` — view (with status timeline + Send/Mark Paid/Cancel/Soft-Delete actions).
- `src\app\dashboard\invoices\[id]\edit\page.jsx` — edit (Draft/Sent only).
- "Create from booking" shortcut on booking detail page.
- Earnings chart on dashboard home (uses `/earnings-graph`).

### User app (`clinqetwebuserapp`)
- Customer payment history reads `CustomerInvoice` denormalized records.
- Invoice PDF download (signed URL or stream proxy).

### Admin app (`clinqetwebadmin`)
- No dedicated invoice page; oversight via AdminAlerts on payment issues.

### Shared rules
- All labels/copy via `react-intl` keys.
- Mobile-first responsive (memory `feedback_clinqet_engineering_standards`).

---

## TESTS

Unit (xUnit + Moq + AutoFixture):
- `InvoiceRepositoryTests` — composite-id pattern, partition isolation, summary GROUP BY, dedup by context.
- `CustomerInvoiceRepositoryTests` — upsert semantics, TTL on soft-delete.
- `InvoiceServiceTests` — state machine completeness, dedup of CreateFromBookingAsync, soft-delete TTL, earnings aggregation.
- `QuestPdfServiceTests` — PDF rendering with all locales + edge cases (missing fields, RTL languages).

Integration (`ClinqetApiFactory` + Testcontainers):
- POST /invoices (with immediate send) → SB message queued → PDF generated → email pipeline.
- POST /from-booking/{bookingId} → dedup behavior on second call.
- PATCH /status to Paid → PaymentInfo set.
- DELETE → soft-delete + TTL applied to both Invoice and CustomerInvoice.
- Past-booking timer flow end-to-end.

Add string-shape SQL unit tests for any new keyset query (memory `feedback_cosmos_emulator_vs_prod_matcher`).

---

## CROSS-LINKS

- Bookings: `clinqet-booking-lifecycle` SKILL — auto-creation on Booking Completed.
- Notifications: `clinqet-notifications` SKILL — invoice email pipeline.
- Media derivatives: `clinqet-media-derivatives` SKILL — business logo on PDF.
- Quote: `clinqet-quote-lead-broadcast` SKILL — Quote → Booking → Invoice chain.

---

## CHECKLIST BEFORE MERGE

- [ ] Every Cosmos query partition-scoped (`/businessId` on Transactions, `/customerId` on CustomerData). NO cross-partition.
- [ ] Both `Invoice` and `CustomerInvoice` updated atomically; on failure roll back the first write.
- [ ] State transition runs through `ValidateStatusTransition`. Terminal states (Paid, Cancelled) never re-transition.
- [ ] Idempotent on creation from Booking — `GetInvoiceByContextAsync` always checked before insert.
- [ ] Soft-delete sets both `isDeleted=true` and `ttl=InvoiceSoftDeleteTtlDays*86400`.
- [ ] PDF rendering uses media-derivative URLs for logo (point-target patch contract — cross-link `clinqet-media-derivatives`).
- [ ] No hardcoded user-facing text — every label, validation message, email subject, PDF token uses localization keys; per-language email templates present (`en.json` + all other languages).
- [ ] Composite index covers new sort path; string-shape SQL unit test added.
- [ ] Unit + integration tests for every new endpoint / repo method / service path.
- [ ] Backend builds clean. ESLint zero errors on changed UI.
- [ ] `InvoiceSettings` defaults match `appsettings.json`.
- [ ] New SB queue or message → ARM + `deploy.ps1` updates per `clinqet-deployment` skill.

## ‼️ THE COPY MUST STATE THE RULE THE CODE ENFORCES (2026-09-19)

`Error_InvoiceUpdateNotAllowed` read *"Only draft invoices can be updated."* — but **three independent
implementations agree the rule is Draft OR Sent**: `InvoiceService` (`status != Draft && status != Sent`), web
(`EDITABLE_STATUSES = ["Draft", "Sent"]` in `InvoiceDetail.jsx` and `EditInvoicePage.jsx`) and mobile
(`EDITABLE_INVOICE_STATUSES` in `Util/invoiceStatus.ts`). The copy was the outlier, in all five languages, and it
told a provider a Sent invoice could not be edited when the Edit button was right there.

**When a refusal's copy and its guard disagree, find the third witness before choosing which to change** — here
the two front ends settled it, and the code was right.


## D-108 + decision C (2026-09-28)

- ‼️ **Invoices are addressed by `invoiceId`, never by number** — every route is `/business/invoices/{invoiceId}`,
  pay links are `/invoices/{InvoiceId}/pay`, and MCP/email/PDF deep links follow. A number is a human-typed lookup only,
  and it is always scoped to one business.
- **A draft has `invoiceNumber = null`** (the type is `string?`). The number is taken only when the invoice is ISSUED
  — Sent, Paid, Overdue, Cancelled, Refunded, PartiallyRefunded — in the same batch as the write. A deleted draft
  consumes nothing; a cancelled issued invoice KEEPS its number. The PDF prints `PDF_DraftLabel` when the number is
  blank and the file is named `invoice-{InvoiceNumber ?? InvoiceId}.pdf`.
- **Per financial year, per business**: `INV-2026-000001` (Jan–Dec) or `INV-2627-000001` (India, Apr–Mar), the month
  taken from the business's primary-address country via `RecordNumbering:FinancialYearStartMonthByCountry` and the
  boundary read in the business's own time zone. `RecordNumbering:MaxAttempts` is 10 in every host and in the options
  class — eight parallel takers exhausted three.
