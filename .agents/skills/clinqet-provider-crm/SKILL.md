---
name: clinqet-provider-crm
description: |
  **CORE FEATURE SKILL** — Work on the Provider CRM (Customer List) feature
  end-to-end. Provider-scoped BusinessCustomer entity (separate from the
  platform Customer entity), multi-field search and filtering, modal CRUD with
  duplicate detection (email/phone normalized), per-business pagination,
  customer-level booking history. Two-container pattern: BusinessCustomer in
  ProviderData (provider's contact list) + Customer in CustomerData (the
  authenticated platform user).
  USE FOR: BusinessCustomer CRUD, duplicate detection by email/phone, paginated
  list with filters, address management, two-container sync semantics, partner-
  app customer management UI, soft-delete with conditional cross-partition
  cleanup. Applies to clinqetinfrastructure/Data/COSMOS/BusinessCustomerRepository.cs
  + CustomerRepository.cs, clinqetinfrastructure/Services/CustomerService.cs,
  clinqetapi Controllers/CustomerController.cs, clinqetcore/Entities/COSMOS/
  Cosmos.cs (BusinessCustomer + Customer), clinqetwebpartnerapp
  src/components/customers + src/app/dashboard/customers.
---

# CLINQET PROVIDER CRM — COMPREHENSIVE SKILL

## ENTITIES (`clinqetcore\Entities\COSMOS\Cosmos.cs`)

### `BusinessCustomer` (~lines 1479-1501) — provider's customer entry
- Container: `ProviderData`. Partition key: `/businessId`. Document id: `{businessId}_{customerId}`.
- Fields: `businessId, customerId, firstName?, lastName?, email?, phoneNumber?, address?: Address`.
- Inherits from `BaseEntity`: `id, type, eTag, createdAt, updatedAt`.

### `Customer` (~lines 1436-1477) — global platform user
- Container: `CustomerData`. Partition key: `/customerId` (self-partition). Document id: `{customerId}`.
- Fields: `customerId, userId?, firstName, lastName, email, phoneNumber, countryCode, preferredLanguage, addresses: List<Address>, createdAt, updatedAt`.
- `userId` is set when the customer is an authenticated platform user (linked to Identity API SQL user).

### Relationship
- A `Customer` in `CustomerData` represents an authenticated user.
- A `BusinessCustomer` in `ProviderData` is the provider's contact entry for that customer.
- One Customer may appear as `BusinessCustomer` rows in many providers' partitions.
- Provider-driven CRUD writes to BOTH (with caveats — see Sync Semantics below).

---

## SYNC SEMANTICS (TWO-CONTAINER PATTERN)

`CustomerService` writes both:
- `Customer` in `CustomerData` partitioned by `/customerId`
- `BusinessCustomer` in `ProviderData` partitioned by `/businessId`

Because writes span two partitions, the operation is NOT transactional. Sync rules:
1. **Create**: create Customer first → create BusinessCustomer; on second-step failure, log + flag for retry but leave the Customer.
2. **Update (provider-scoped)**: update both; partner-app surfaces the local BusinessCustomer changes optimistically.
3. **Delete from business**: ALWAYS remove the BusinessCustomer row. If the Customer has no `userId` (was created by the provider, never authenticated), ALSO delete the Customer record. If it has a `userId`, leave it (other providers may have it).
4. **CustomerService.UpdateCustomerAsync (no businessId)**: only updates Customer container; does NOT sync to BusinessCustomer rows in other partitions (cross-partition fan-out is forbidden per §0.6 CLAUDE.md). A future Change Feed listener may eventually propagate.

This is documented in `CustomerService.cs` ~lines 156-158 as a known sync caveat.

---

## REPOSITORIES

### `BusinessCustomerRepository.cs` (`clinqetinfrastructure\Data\COSMOS\`)
All methods partition-scoped on `/businessId`.

- `GetBusinessCustomerAsync(businessId, customerId, ct)` — point read by composite id.
- `GetCustomersByBusinessIdAsync(businessId, ct)` — partition scan (returns all).
- `GetCustomerByEmailAsync(businessId, email, ct)` — query with **normalized email** (`ToLowerInvariant()`).
- `GetCustomerByPhoneAsync(businessId, phoneNumber, ct)` — query on phoneNumber.
- `GetCustomerByEmailOrPhoneAsync(businessId, email, phoneNumber, ct)` — OR query for combined duplicate check.
- `CreateBusinessCustomerAsync(businessCustomer, ct)` — id = `{businessId}_{customerId}`.
- `UpdateBusinessCustomerAsync(businessCustomer, ct)` — ETag concurrency.
- `UpsertBusinessCustomerAsync(businessCustomer, ct)` — validates inputs, replaces or creates.
- `DeleteBusinessCustomerAsync(businessId, customerId, ct) → bool` — hard delete.
- `CustomerExistsForBusinessAsync(businessId, customerId, ct) → bool` — existence check.

### `CustomerRepository.cs`
All methods partition-scoped on `/customerId`.

- `GetCustomerByIdAsync(customerId, ct)` — point read `{customerId}`.
- `CreateCustomerAsync(customer, ct)` — adds to CustomerData partition.
- `UpdateCustomerAsync(customer, ct)` — ETag concurrency.
- `DeleteCustomerAsync(customerId, ct) → bool` — hard delete.

---

## SERVICE — `CustomerService.cs` (`clinqetinfrastructure\Services\`)

Public methods:

- `GenerateUniqueCustomerIdAsync()` — generates 5-char alphanumeric customerId (up to 10 attempts; logs collision).
- `GetCustomerByIdAsync(customerId)` — delegate to repository.
- `GetCustomersByBusinessIdAsync(businessId)` — returns all BusinessCustomer entries for a provider.
- `CreateCustomerForBusinessAsync(businessId, firstName, lastName, email, phoneNumber)` — **duplicate detection on email** via `GetCustomerByEmailAsync`. Creates BOTH Customer + BusinessCustomer.
- `UpdateCustomerAsync(customerId, ...)` — updates Customer only (no BusinessCustomer cross-fanout).
- `UpdateCustomerForBusinessAsync(businessId, customerId, ...)` — updates BOTH Customer and BusinessCustomer.
- `DeleteCustomerFromBusinessAsync(businessId, customerId)` — soft-deletes from BusinessCustomer; if Customer has no `userId`, ALSO deletes Customer.
- `CreateOrUpdateCustomerFromQuoteAsync(businessId, firstName, lastName, email, phoneNumber, address)` — upsert pattern for quote-driven customer creation. Email then phone duplicate check.
- `AddAddressAsync(customerId, address, maxAddresses)` — enforces `CustomerSettings.MaxAddressesPerCustomer`. First address gets `isPrimary=true`.
- `UpdateAddressAsync(customerId, addressId, ...)` — manages primary flag transitions.
- `DeleteAddressAsync(customerId, addressId)` — reassigns primary if needed.
- `SetPrimaryAddressAsync(customerId, addressId)` — moves primary flag.

### Duplicate detection
- Email: normalized to lowercase (`ToLowerInvariant()`) before compare.
- Phone: exact match (TODO: future normalization to E.164).
- Returns existing `customerId` on duplicate match; caller decides update vs error.

---

## CONTROLLER — `CustomerController.cs` (`clinqetapi\Clinqet.API\Controllers\`)

Route base `api/v{version:apiVersion}/customer`. `[Authorize]`.

### Provider-facing endpoints

| Verb | Route | DTO | Notes |
|------|-------|-----|-------|
| GET | `/me` | — | Returns current user's Customer (auto-creates if missing) |
| GET | `/{customerId}` | — | Get single customer by id |
| GET | `/business` | (query: pageNumber, pageSize=10, sortBy, sortOrder, firstName, lastName, email, phoneNumber, searchText) | Paginated list for current business |
| POST | `/` | (firstName, lastName, email, phoneNumber) | Create new customer for current business |
| POST | `/business/{businessId}/customer` | (firstName, lastName, email, phoneNumber) | Create with explicit businessId (auth check) |
| PUT | `/{customerId}` | (firstName, lastName, ...) | Update Customer record |
| PUT | `/business/{businessId}/customer/{customerId}` | (firstName, lastName, ...) | Update BOTH; **side-effect: queues MarketingSubscriptionMessage** (fire-and-forget) |
| DELETE | `/business/{businessId}/customer/{customerId}` | — | Returns 204; soft-delete pattern |

### Pagination behavior
Pagination uses Cosmos partition scan + LINQ filter (multi-field OR for `searchText`) + in-memory `Skip(.Take(...))`. Returns `PagedResult<BusinessCustomerDto> { items, totalCount, pageNumber, pageSize, hasPrevious, hasNext, totalPages }`.

### Sort
- `name` → FirstName then LastName ASC/DESC.
- `email` → Email ASC/DESC.
- `phone` → PhoneNumber ASC/DESC.
- `date` → CreatedAt ASC/DESC (default: DESC).

### Address management endpoints

| Verb | Route | DTO | Notes |
|------|-------|-----|-------|
| GET | `/me/addresses` | — | List all addresses for current user |
| POST | `/me/addresses` | `Address` | Add (max enforced) |
| PUT | `/me/addresses/{addressId}` | `Address` | Update |
| DELETE | `/me/addresses/{addressId}` | — | Delete |
| PUT | `/me/addresses/{addressId}/set-primary` | — | Reassign primary |

### Error codes
- 400: Invalid input, max addresses reached
- 401: Unauthorized (businessId mismatch with claims)
- 404: Not found
- 409: Duplicate email/phone
- 500: Internal

All responses use the `ApiResponse<T>` envelope.

---

## FRONTEND — Partner App

### Pages
- `C:\Nik\clinqetwebpartnerapp\src\app\dashboard\customers\page.jsx` — main customers list.

### Component
- `C:\Nik\clinqetwebpartnerapp\src\components\customers\index.jsx`:
  - **Lazy pagination via `IntersectionObserver`** — fires when last item is within 100px of viewport bottom.
  - PAGE_SIZE = 10.
  - Filter chips with X-to-remove + "Clear all".
  - Toolbar search (400ms debounce) — single text triggers OR match across firstName/lastName/email/phoneNumber.
  - Sort: FirstName (default), Email, Phone, CreatedAt; asc/desc.
  - Modals: `AddCustomerModal`, `EditCustomerModal`, `DeleteCustomerModal`.
  - Responsive: desktop table (≥md), mobile card list (<md).
  - Skeleton loading: 6-row desktop, 5-card mobile.
  - Empty state: icon + i18n message.
  - Address display in row: concatenated `street, city, state, country` with tooltip on truncation.

### Modals
- `AddCustomerModal` — form with localization keys; validates email format + phone shape; calls POST.
- `EditCustomerModal` — prepopulates with selected customer; submits to PUT.
- `DeleteCustomerModal` — confirmation dialog showing customer name + last-booking warning if any.

### Booking history per customer
The customer detail view (modal or page) queries `/api/v1/bookings/paginated?customerId=...` (cross-link `clinqet-booking-lifecycle` skill). Booking list is read-only inside the CRM view.

---

## SETTINGS — `CustomerSettings`

```
Customer:MaxAddressesPerCustomer = 5
Customer:DefaultPreferredLanguage = "en"
```

Class-default values must match `appsettings.json`.

---

## SERVICE BUS

When `UpdateCustomerForBusinessAsync` runs, a `MarketingSubscriptionMessage` is queued on `MarketingSubscriptionQueueName` (queue: `marketing-subscription`). Processed by `MarketingSubscriptionProcessorFunction` (see `clinqet-function-app` skill).

This is fire-and-forget — logs warning on failure but never blocks the customer update.

---

## TESTS

Unit (xUnit + Moq):
- `BusinessCustomerRepositoryTests` — composite id, partition isolation, email-normalization query, phone query, OR query.
- `CustomerRepositoryTests` — CustomerData partition scope.
- `CustomerServiceTests` — duplicate detection paths, two-container create/delete semantics, address management (primary reassignment, max enforcement).
- `CustomerControllerTests` — auth checks (businessId in claim), pagination filter combinations, sort orders.

Integration (`ClinqetApiFactory` + Testcontainers):
- Provider creates customer → records exist in BOTH ProviderData and CustomerData.
- Provider deletes customer with no userId → both records gone.
- Provider deletes customer WITH userId → only BusinessCustomer row removed.
- Email duplicate on create → 409.
- Pagination with multi-field searchText → correct OR semantics.

Add string-shape SQL unit tests for any new keyset query (memory `feedback_cosmos_emulator_vs_prod_matcher`).

---

## CROSS-LINKS

- Bookings: `clinqet-booking-lifecycle` SKILL — customer's booking history.
- Quotes: `clinqet-quote-lead-broadcast` SKILL — `CreateOrUpdateCustomerFromQuoteAsync` upsert path.
- Marketing: `clinqet-function-app` SKILL — MarketingSubscriptionProcessor.

---

## CHECKLIST BEFORE MERGE

- [ ] Every Cosmos query partition-scoped (`/businessId` on ProviderData, `/customerId` on CustomerData). NO cross-partition.
- [ ] Email normalized via `ToLowerInvariant()` before any lookup or storage of the canonical lower form.
- [ ] Duplicate check (`GetCustomerByEmailAsync` / `GetCustomerByPhoneAsync` / `GetCustomerByEmailOrPhoneAsync`) before insert.
- [ ] Two-container writes are sequenced (Customer → BusinessCustomer); failure of second step logged, not silently swallowed.
- [ ] Delete-from-business preserves Customer if `userId` is set.
- [ ] Address max enforced via `CustomerSettings.MaxAddressesPerCustomer`; primary flag managed atomically.
- [ ] `MarketingSubscriptionMessage` queue is fire-and-forget (no blocking of HTTP response).
- [ ] All labels + validation messages via localization keys.
- [ ] Pagination uses LINQ on partition scan only (no cross-partition); for >1000 customers per business consider continuation tokens (memory entry).
- [ ] Mobile-first responsive (table → cards on phone).
- [ ] ESLint zero errors on UI.
- [ ] Unit + integration tests for every new path.

## WhatsApp from the CRM (Phase 2, 2026-06-02) — "Message on WhatsApp"
The provider CRM is the first PRODUCTION WhatsApp context-creator (6.1). `POST /api/v1.0/customer/business/{businessId}/customer/{customerId}/whatsapp` → `IWhatsAppProviderOutreachService.InitiateAsync` (**tenant-isolated**: loads the `BusinessCustomer`, uses its linked `CustomerId`, no find-or-create) → 5-state branch: `WindowOpen`/`WindowClosed` (opted-in, opens the inbox thread) · `InvitationSent` (None/Pending → gated `clinket_optin_first_contact`) · `OptedOut`/`Blocked` (no WhatsApp; account-only in-app `ProviderWhatsAppReachOut` re-engagement). Same deterministic `GenerateConversationId(Direct,null,businessId,customerId)` ⇒ the WhatsApp thread == the in-app Direct thread (see `clinqet-messaging` / `clinqet-whatsapp`). Read-only status (side-effect-free): `GetContactStatusAsync` + `GET …/customer/{id}/whatsapp/status` + `GET /business` per-row enrichment (`WhatsAppContactStatus`, parallel single-partition point-reads, **fail-open**). UI (6.4): `customers/index.jsx` WhatsApp column + consent badge + action icon; shared `utils/whatsappStatus.js` + `hooks/useWhatsAppOutreach.js` + `components/whatsapp/WhatsAppContactBlock.jsx`; Add-modal "invite after saving" checkbox (config default `NEXT_PUBLIC_WHATSAPP_INVITE_DEFAULT`). All consent lives on the Cosmos `WhatsAppContact` doc — NOT on `BusinessCustomer`.
