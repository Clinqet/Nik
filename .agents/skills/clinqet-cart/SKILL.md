---
name: clinqet-cart
description: |
  **CORE FEATURE SKILL** — Work on the Cart feature end-to-end. Anonymous (device) and
  authenticated (user) carts, per-provider groups with items and offers, merge on login,
  conversion to per-provider bookings, abandoned-cart reminders (Service Bus scheduled
  messages → email). Backed by `SystemData` container, deterministic id `cart_{pk}`, ETag
  concurrency, TTL by status.
  USE FOR: cart CRUD, item add/remove/update, merge device→user on login, mark-converted
  on booking creation, reminder scheduling and processing, cart UI on user app, rate
  limiting on anonymous endpoints. Applies to clinqetcore/Entities/COSMOS/Cart.cs,
  clinqetshared/DTOs/COSMOS/CartDtos.cs, clinqetinfrastructure/Data/COSMOS/CartRepository.cs,
  clinqetinfrastructure/Services/Cart/CartService.cs, clinqetapi Controllers/Cart/,
  clinqetfunctions Functions/CartReminderProcessorFunction.cs, clinqetwebuserapp cart UI.
---

# CLINQET CART — COMPREHENSIVE SKILL

## RECENT CHANGES — 2026-10-06 (a line whose price went away)

See the `clinqet-prepared-providers` skill for the whole feature. What changed HERE:

- ‼️ **A service that no longer has a price is taken OUT of the cart and the customer is TOLD** — `removedItems` on the priced response, surfaced on the customer web and the customer phone, with "Ask for price" beside it.
- **It describes one answer, so it is never stored on the device.**
- **A minimum charge alone still counts as a price** (`ServiceBookingPrice.HasSetPrice`), so such a line is NOT removed.

## ENTITY (`clinqetcore\Entities\COSMOS\Cart.cs`)

- Container: `SystemData`. Partition key: `/pk`. Document id: `cart_{pk}`.
- `Pk` = `userNumber` (authenticated) OR `deviceId` (anonymous).
- `IdentifierType: CartIdentifierType` (`User` | `Device`).
- `Email?` — captures guest email pre-login.
- `DeviceId?` — links device cart back to authenticated user cart on merge.
- `Providers: List<CartProviderGroup>` — one group per business with:
  - `BusinessId`, `BusinessName`, `BusinessLogoUrl` (+ derivatives), service items, applied offers, delivery address.
  - `Items: List<CartItem>` — `serviceId`, `name`, `basePrice`, `quantity` (1-100), `locationType`, `notes` (≤500), `discount`, `currency`, derivatives for service image.
  - `AppliedOffers: List<CartAppliedOffer>` — `offerId`, `discountType`, `discountValue`, `calculatedAmount`.
  - `Address: CartAddress`.
- `Price: CartPrice` — `servicesSubTotal`, `discountTotal`, `totalAmount`, `currency`. Recalculated on every save.
- `Status: CartStatus` — `Active` | `Converted`.
- Reminder fields: `RemindersSent`, `LastReminderSentAt?`, `ScheduledReminderSequenceNumber?`.
- `Ttl` (seconds) — 30 days for guest, 90 days for authenticated, 7 days post-conversion (cleanup).
- `ETag` for optimistic concurrency.

## DTOs (`clinqetshared\DTOs\COSMOS\CartDtos.cs`)

- `CartResponseDto` (client-facing, read-only)
- `SaveCartRequestDto` — validates providers ≥1, items ≥1 per provider, quantity 1-100, note ≤500. ‼️ It carries
  CHOICES only (M2, 2026-09-25): service ids, quantity, location, note, `SaveCartItemDto.AppliedOfferId`, and the
  group's offers as `SaveCartOfferDto { OfferId }` — never an amount.
- `CartItemDto.Pricing` (`ServiceSummaryPricingDto`, filled at read time, never stored) — the catalogue price as it
  stands now, the one shape every customer screen renders a cart line from ("Up to", "From", "/ hour", a minimum).
  Null when the service is gone.
- `CartProviderGroupDto`, `CartItemDto`, `CartPriceDto`, `CartAppliedOfferDto`, `CartAddressDto`
- `UpdateCartItemRequestDto` — quantity, locationType, notes

Validation messages are localization keys.

## ENUMS

- `CartIdentifierType`: User, Device
- `CartStatus`: Active, Converted
- Both have `[JsonConverter(typeof(JsonStringEnumConverter))]`.

## REPOSITORY — `CartRepository.cs`

- `GetByPkAsync(pk)` — active cart by partition key.
- `UpsertAsync(cart)` — insert/update with ETag concurrency, 2 retries on conflict.
- `DeleteByPkAsync(pk)`.

## SERVICE — `CartService.cs` (`ICartService`)

- `GetCartAsync(userNumber, deviceId)` — resolves identity; auto-merges if user has a deviceId cookie at login.
- `SaveCartAsync(userNumber, deviceId, request)` — validates, **recalculates prices** server-side (never trusts client totals), applies offer discounts, sets/updates TTL, schedules reminder.
- `RemoveCartItemAsync(serviceId, businessId)` — remove item; if provider group becomes empty delete it; if cart becomes empty delete the cart entirely.
- `UpdateCartItemAsync(serviceId, businessId, request)` — quantity/locationType/note; recalculate prices.
- `ClearCartAsync()` — delete cart + cancel pending scheduled reminders.
- **`MergeCartAsync(userNumber, deviceId)`** — critical for login flow:
  - Loads device cart + user cart (if either exists).
  - Merges by `serviceId` keeping the **max quantity**; updates name/URLs/derivative URLs from latest.
  - Resolves offer conflicts (newer offer wins).
  - Deletes device cart; persists merged user cart.
- `MarkCartAsConvertedAsync()` — sets status=Converted after booking creation; switches to short TTL (7 days).

### Pricing recalculation
- ‼️ **M2 / Q-1 (2026-09-25) — every line is priced by the SERVER, on every write AND every read.** `CartService`
  (`PriceFromCatalogueAsync`) loads each business's services with ONE `IServiceRepository.GetServicesByIdsAsync`
  (ReadMany, point reads, partition-scoped) and prices each line with `BookingMappingExtensions.CataloguePricing(service)`
  — the one definition the booking charges (moved out of `BookingController`). An app's amounts are never read.
- A line that can no longer be booked (service deleted, or `ServiceBookingPrice.HasSetPrice` false) is DROPPED, never
  shown as free; a group left empty goes with it.
- Offers go through `IOfferValidationService` (`PriceOffersAsync`): a selection the engine refuses keeps the offers valid
  on their own, together if they combine, else the first — never a discount checkout would refuse.
- A READ (`PricedResponseAsync`) answers with today's catalogue prices without writing; the stored cart catches up on its
  next save. The abandoned-cart email reads the stored cart, whose amounts every save now prices.
- Sums `basePrice * quantity` across items.
- Subtracts applied offer discounts (per-provider, capped at subtotal).
- Final = subtotal − discounts; never negative.
- Currency assumed homogeneous per cart (validate; if a multi-currency cart is attempted, reject with a localized error).

### Reminder scheduling
- On `SaveCartAsync`, if `CartSettings.AbandonedCartEmailEnabled` and `RemindersSent < MaxReminders`, schedule via `IServiceBusService.SendScheduledMessageAsync<CartReminderMessage>(`...`)`.
- Delays from settings: `FirstReminderDelayHours` (default 24h), `SecondReminderDelayHours` (default 72h). `MaxReminders` (default 2).
- Cancel pending scheduled messages on clear/convert/empty.

## CONTROLLER — `CartController.cs`

`/api/v1/cart`. CORS `B2CPolicy`. Most endpoints `[AllowAnonymous]` to support guest carts; auth identity (when present) takes precedence.

| Verb | Route | Auth | Body | Rate limit |
|------|-------|------|------|------------|
| GET | `/` | Anon (uses device cookie) or JWT | — | 60/min auth, 30/min anon |
| POST | `/` | same | `SaveCartRequestDto` | same |
| DELETE | `/` | same | — | same |
| DELETE | `/items/{serviceId}?businessId=...` | same | — | same |
| PATCH | `/items/{serviceId}?businessId=...` | same | `UpdateCartItemRequestDto` | same |
| POST | `/merge` | **JWT only** | — | auth-only |

Anonymous device id resolution: `X-Device-Id` header → cookie → IP-derived fallback (rate limit by this key).

## FRONTEND — User app (`clinqetwebuserapp`)

### Redux + persistence
- `store/cartSlice.js` — localStorage key `clinqet_guest_cart` for guests. Auto-cleared after login. Thunks: `loadCart`, `saveCartToServer`, `clearCartGuest`, `removeItem`, `updateItem`. Selectors are memoized (count, subtotal).
- `services/cartService.js` — maps API DTOs ↔ local shape (e.g., flatten `cartProviderGroupDto` → `items` with derived `price`, `icon`, `serviceImageUrl`).
- `utils/cartPricing.js` — `resolveCartBasePrice(pricing)` handles Fixed / Range / Hourly pricing types.

### Pages & components
- `app/(customer)/cart/page.js` (root cart page).
- `components/customer/cart/serviceDetails.jsx` (main cart view).
- `components/customer/cart/ProviderCartGroup.jsx` (per-provider section).
- `components/customer/cart/CartCheckoutSheet.jsx` (checkout flow modal).
- `components/customer/cart/AddItemSidebar.jsx` (add-to-cart sidebar on service detail).
- Modals: `model/selectDateAndTime.jsx`, `model/selectAddress.jsx`, `model/bookingPopUp.jsx`, `model/offers.jsx`.
- (`components/layout/customer/model/cartManu.jsx` is DELETED — X2, 2026-09-25: dead, and built money from a symbol +
  `toFixed(2)`.)
- E2E: `e2e/tests/cart/cart.spec.js`, `e2e/pages/cart.page.js`.

All copy via `react-intl`. SEO meta on `/cart` page.

## CHECKOUT → BOOKING

- Checkout creates **one booking per provider group** (transactional from booking controller / service).
- After all bookings successfully created, controller calls `ICartService.MarkCartAsConvertedAsync()`.
- On failure of any per-provider booking, the others remain — partial cart cleanup happens in the booking conversion flow (do not delete cart pre-emptively).

## ABANDONED CART REMINDER (Service Bus + Function App)

### Message DTO — `CartReminderMessage`
`clinqetshared\DTOs\Messages\CartReminderMessage.cs`. Carries `pk`, `reminderSequenceNumber`, `correlationId`.

### Function — `CartReminderProcessorFunction.cs`
`clinqetfunctions\Clinqet.Communications\Functions\`. Trigger: `%ServiceBusSettings:CartRemindersQueueName%`.

Flow:
1. Fetch cart by pk. Exit if not Active.
2. Resolve customer (auth side) — if anonymous + no email, skip.
3. Dispatch reminder email via `ICommunicationDispatcher` (`CartReminder` notification type, template `CartReminder.html` per language).
4. Increment `RemindersSent`, set `LastReminderSentAt`.
5. Schedule next reminder (or stop after `MaxReminders`).
6. Persist via repo (ETag concurrency; retry on 412).

DLQ on max delivery count; admin alert via `FailureNotificationHelper`.

### Settings — `CartSettings`
`AbandonedCartEmailEnabled`, `FirstReminderDelayHours`, `SecondReminderDelayHours`, `MaxReminders`. Match class defaults to `appsettings.json`.

### Email template
`Resources/EmailTemplates/{lang}/CartReminder.html` (or JSON if our pipeline) — every supported language. PDF not attached.

## APPSETTINGS

Main API `appsettings.json`:
- `ServiceBusSettings:CartRemindersQueueName` (default `"cart-reminders"`).
- `CartSettings:{AbandonedCartEmailEnabled, FirstReminderDelayHours, SecondReminderDelayHours, MaxReminders, RateLimits...}`.

Function App `appsettings.json`: same `ServiceBusSettings:CartRemindersQueueName` + retry settings.

Deployment (`azureautomation`): `cart-reminders` queue must exist in the ARM template; `deploy.ps1` configures it. ANY new local.settings.json entry must propagate to ARM + deploy.

## TESTS

- Unit: `Clinqet.API.UnitTests/Services/CartServiceTests.cs` (save / remove / update / merge / reminder scheduling).
- `Controllers/CartControllerTests.cs` (rate limiting, auth, validation, anonymous flow).
- `Repositories/CartRepositoryTests.cs` (ETag conflict, deletion, upsert retries).
- Integration: `Clinqet.API.IntegrationTests/Controllers/CartControllerTests.cs` (Testcontainers Cosmos emulator).
- `Clinqet.Communications.UnitTests/Functions/CartReminderProcessorFunctionTests.cs` + integration variant.

## CHECKLIST BEFORE MERGE

- [ ] Every cart query uses `/pk` partition key — never cross-partition.
- [ ] Server-side recalculation of prices; client totals are display-only.
- [ ] ETag concurrency on upsert; retries bounded (2) — never infinite.
- [ ] TTL applied correctly: 30 (guest) / 90 (auth) / 7 (converted).
- [ ] Merge handles deduplication (max quantity), offer conflicts, name/derivative-url refresh.
- [ ] Scheduled reminders cancelled on clear/convert/empty.
- [ ] `CartReminder` notification type whitelisted in `SignalRSettings:EnabledNotificationTypes` (if real-time delivery is desired).
- [ ] Email template present in every supported language.
- [ ] Rate limiting wired on anonymous endpoints.
- [ ] All UI copy via `react-intl`; no hardcoded English.
- [ ] Unit + integration tests added; ESLint clean on user app.
