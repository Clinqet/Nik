---
name: clinqet-availability-calendar
description: |
  **CORE FEATURE SKILL** — Work on the Provider Availability + Calendar feature
  end-to-end. Weekly recurring working hours (Monday–Sunday, 24h HH:MM), per-side
  per-day availability docs in ProviderData, bulk weekly update + copy-to-multiple-
  days, FullCalendar-based partner calendar UI (note: folder is "calender" with a
  typo — preserve), public availability lookup, CategoryAvailabilityFilter for
  location-faceted category discovery. Booking conflict checks reference these
  hours during validation.
  USE FOR: availability CRUD, weekly schedule update, copy-day-times, public
  availability endpoint, calendar UI (month/week/day/list views), mobile-first
  calendar rendering, filter sidebar, overlap modal, category-availability
  facet filter. Applies to clinqetcore/Entities/COSMOS/Cosmos.cs (Availability),
  clinqetinfrastructure/Data/COSMOS/AvailabilityRepository.cs,
  clinqetinfrastructure/Services/CategoryServices/CategoryAvailabilityFilter.cs,
  clinqetapi Controllers/AvailabilityController.cs, clinqetshared/DTOs/COSMOS/
  Cosmos.cs (WeeklyAvailabilityDto, AvailabilityDayDto, CopyAvailabilityDto),
  clinqetwebpartnerapp src/app/dashboard/calender + src/components/calendar +
  src/components/onboarding/.../SetAvailability.jsx.
---

# CLINQET AVAILABILITY + CALENDAR — COMPREHENSIVE SKILL

## ENTITY (`clinqetcore\Entities\COSMOS\Cosmos.cs`)

### `Availability` (~lines 453-472)
- Container: `ProviderData`. Partition key: `/businessId`. Document id: `{businessId}_{dayOfWeek.ToLower()}` (e.g. `biz123_monday`). TTL: -1.
- Fields:
  - `availabilityId: string`
  - `businessId: string` (pk)
  - `dayOfWeek: string` — capitalized day name (e.g. `"Monday"`); ID always lowercased
  - `startTime: string` — `HH:mm` 24-hour, regex `^([01]\d|2[0-3]):([0-5]\d)$`; nullable when `isAvailable=false`
  - `endTime: string` — same regex; nullable when not available
  - `isAvailable: bool`
  - Inherited from `BaseEntity`: `id, type, eTag, createdAt, updatedAt`

**Important:** One document per (businessId, dayOfWeek). The full week is up to 7 documents. Missing-day fallback is handled in the controller (returns the full week with default `09:00–17:00`, `isAvailable=false`).

There is **no timezone field** in the entity — time strings are interpreted in the provider's local timezone (resolved via `BusinessProfile.Addresses` or default). Bookings store absolute UTC, so timezone interpretation happens at display/validation time.

---

## ENUMS

### `DayOfWeek` (`clinqetshared\Enums\DayOfWeek.cs`)
Verbatim: `Monday = 1, Tuesday = 2, Wednesday = 3, Thursday = 4, Friday = 5, Saturday = 6, Sunday = 7`. `[JsonConverter(typeof(JsonStringEnumConverter))]`.

---

## CONTAINER & INDEXES

### ProviderData (shared with BusinessProfile + Service + ServiceArea + Portfolio + etc.)
Partition key `/businessId`. TTL: -1. Availability-relevant included paths:
- `/dayOfWeek/?`
- `/isAvailable/?`
- `/type/?`

No availability-specific composite index — partition reads are cheap (max 7 docs).

---

## DTOs (`clinqetshared\DTOs\COSMOS\Cosmos.cs`)

```csharp
public record WeeklyAvailabilityDto(
    [Required(ErrorMessage = "Error_WeeklyAvailabilityRequired")]
    [MinLength(7, ErrorMessage = "Error_WeeklyAvailabilityMinLength")]
    [MaxLength(7, ErrorMessage = "Error_WeeklyAvailabilityMaxLength")]
    [Display(Name = "Label_WeeklyAvailability")]
        List<AvailabilityDayDto> WeeklyAvailability);

public record AvailabilityDayDto(
    [Required(ErrorMessage = "Error_DayOfWeekRequired")]
    [Display(Name = "Label_DayOfWeek")] string DayOfWeek,

    [Required(ErrorMessage = "Error_IsAvailableRequired")]
    [Display(Name = "Label_IsAvailable")] bool IsAvailable,

    [RegularExpression(@"^([01]\d|2[0-3]):([0-5]\d)$", ErrorMessage = "Error_TimeFormat")]
    [Display(Name = "Label_StartTime")] string? StartTime,

    [RegularExpression(@"^([01]\d|2[0-3]):([0-5]\d)$", ErrorMessage = "Error_TimeFormat")]
    [Display(Name = "Label_EndTime")] string? EndTime);

public record CopyAvailabilityDto(
    [Required(ErrorMessage = "Error_SourceDayRequired")]
    [Display(Name = "Label_SourceDay")] string SourceDay,

    [Required(ErrorMessage = "Error_TargetDaysRequired")]
    [MinLength(1, ErrorMessage = "Error_TargetDaysMinLength")]
    [Display(Name = "Label_TargetDays")] List<string> TargetDays);
```

**All Display/Error attributes are localization keys** (memory `feedback_clinqet_engineering_standards`).

---

## REPOSITORY — `AvailabilityRepository.cs` (`clinqetinfrastructure\Data\COSMOS\`)

Every method partition-scoped on `/businessId`.

- `GetByBusinessIdAsync(businessId, ct) → IEnumerable<Availability>` — full partition read (≤7 docs).
- `GetAvailableDaysAsync(businessId, ct) → IEnumerable<Availability>` — `WHERE isAvailable=true`.
- `CreateAvailabilityAsync(availability, ct) → Availability` — id = `{businessId}_{dayOfWeek.ToLower()}`.
- `UpdateAvailabilityAsync(availability, ct) → Availability` — ETag-checked.
- `DeleteAvailabilityAsync(id, businessId, ct) → bool`.
- `GetAvailabilityForDayAsync(businessId, dayOfWeek, ct) → Availability?` — point read by composite id.

---

## CONTROLLER — `AvailabilityController.cs` (`clinqetapi\Clinqet.API\Controllers\`)

Route base `api/v{version:apiVersion}/business/availability`. Plus one public route.

| Verb | Route | Auth | DTO In | Notes |
|------|-------|------|--------|-------|
| GET | `~/api/v1/public/business/{businessId}/availability` | `[AllowAnonymous]` | — | Public availability lookup — used by Open Page and search facets |
| GET | `/` | `[Authorize]` | — | Returns current provider's 7-day schedule with defaults for missing days |
| PUT | `/` | `[Authorize]` | `WeeklyAvailabilityDto` | Bulk update — accepts exactly 7 days, upserts each |
| POST | `/copy` | `[Authorize]` | `CopyAvailabilityDto` | Copy times from source day to multiple target days |

Response format: `ApiResponse<IEnumerable<Availability>>` with days ordered **Sunday, Monday, Tuesday, Wednesday, Thursday, Friday, Saturday** (week starts Sunday in the response shape — UI re-orders as needed).

After update, `OnboardingProgressService.UpdateStepAsync(OnboardingStep.Availability, hasItems)` is called (cross-link `clinqet-provider-onboarding` skill).

---

## CATEGORY AVAILABILITY FILTER — `CategoryAvailabilityFilter.cs`

Path: `clinqetinfrastructure\Services\CategoryServices\CategoryAvailabilityFilter.cs`.

```csharp
public async Task<CategoryAvailabilityResult> FilterByLocationAsync(
    IReadOnlyList<CategoryResponseDto> categories,
    string? country, string? city, double? latitude, double? longitude,
    double? radius = null, DistanceUnit? unit = null,
    CancellationToken cancellationToken = default)
```

**Does NOT directly query Availability docs.** Instead, uses Azure Search facets (via `AzureSearchFacetService`) to determine which categories have ≥1 provider in the geographic area. Filters the input category hierarchy down to "categories with reachable providers." Falls back to full catalog on facet failure.

Cross-link: `clinqet-search-discovery` SKILL for facet service details. Used in broadcast/quote category picker and category browse pages.

---

## CALENDAR UI — Partner App

**Folder name is `calender` (typo preserved — do not rename).**

### Page
`C:\Nik\clinqetwebpartnerapp\src\app\dashboard\calender\page.jsx` — imports and renders `<CustomCalendar />`.

### Calendar component
`C:\Nik\clinqetwebpartnerapp\src\components\calendar\CustomCalendar.jsx`

- Library: **FullCalendar** (with plugins `dayGridPlugin`, `timeGridPlugin`, `interactionPlugin`, `listPlugin`).
- Views: `dayGridMonth`, `timeGridWeek`, `timeGridDay`, `listWeek`.
- Mobile detection (~lines 54-56): forces `dayGridMonth` on phone widths; renders pill/dot indicators per day cell.
- Slot duration: 1 hour.
- Events: booked appointments (color-coded by `BookingStatus`), provider availability shading (off-hours dimmed).
- CSS: `C:\Nik\clinqetwebpartnerapp\src\components\calendar\styles\calendar.css`.

### Sub-components
- `CalendarFilterSidebar` — multi-filter (status, date range, customer name, booking ref, service).
- `CalendarHeader` — view switcher, fullscreen toggle, filter button.
- `OverlapModal` — shown when multiple bookings overlap a slot.
- `AddBookingForm` — side panel for quick-add.

### Mobile-first responsive (memory `feedback_clinqet_engineering_standards`)
Phone defaults to month view; tablet+ defaults to week view; desktop allows all views.

---

## SET AVAILABILITY WIZARD — `SetAvailability.jsx`

Path: `C:\Nik\clinqetwebpartnerapp\src\components\onboarding\add-business-information\SetAvailability.jsx`.

Used in two places:
1. Onboarding wizard step 5 (`/onboarding?step=5`).
2. Profile dashboard page (`src\app\dashboard\profile\set-availability\page.jsx`) — passes `navigationNotShow={true}`.

### Key functions
- `GetAvailabilityList()` — fetches via API client.
- `handleComplete()` — calls `UpdateBusinessAvailability(payload)` (bulk PUT).
- `handleDayToggle()` — toggles `isAvailable` per day.
- `handleExpandDay()` — expands/collapses day detail panel.
- `handleTimeRangeChange()` — updates start/end times.
- `handleCopyTimes()` — opens copy modal.

### UI state
- `schedule[]` — `[{ id, dayOfWeek, isAvailable, startTime, endTime }]`.
- `expandedDay: Set<string>`.
- `copySourceDay`, `selectedDaysToCopy: { [day]: bool }`.

### Copy modal (~lines 439-489)
Lists all days except the source. User selects multiple targets via checkbox; Apply triggers `POST /availability/copy`.

### Navigation
- Wizard mode: Previous → ManageServicesPrice (step 4); Next → `handleComplete()` then advance/dashboard redirect.
- Standalone mode (`navigationNotShow=true`): shows Save button instead of Next.

---

## INTEGRATION WITH BOOKING VALIDATION

`BookingService` / `BookingValidationService` (cross-link `clinqet-booking-lifecycle` skill) consult Availability before allowing transition into `Confirmed`:
1. Compute `scheduledStartDateTime.DayOfWeek` and time of day.
2. Point-read `AvailabilityRepository.GetAvailabilityForDayAsync(businessId, dayOfWeek)`.
3. If `!isAvailable` OR time outside `startTime`–`endTime` → reject with localization key `Error_OutsideAvailability`.

This is the only place where availability time strings are compared against absolute UTC; do the conversion via the provider's timezone (resolved from `BusinessProfile.Addresses[].Coordinates` or default).

---

## TESTS

Unit (xUnit + Moq):
- `AvailabilityRepositoryTests` — composite id construction (lowercased dayOfWeek), partition isolation, point read per day, ETag concurrency.
- `AvailabilityControllerTests` — Get/Update/Copy success + validation failure paths.
- `CategoryAvailabilityFilterTests` — facet fallback, location parameter combinations.

Integration (`ClinqetApiFactory` + Testcontainers):
- PUT /availability with full 7-day payload → 7 documents present.
- POST /availability/copy → target days updated atomically.
- Public GET endpoint → no auth required, returns sanitized data.
- Booking conflict path: booking at 22:00 when isAvailable=false on that day → 400 with localized error.

Add string-shape SQL unit tests for any new keyset query (memory `feedback_cosmos_emulator_vs_prod_matcher`).

---

## CROSS-LINKS

- Bookings: `clinqet-booking-lifecycle` SKILL — uses Availability to reject conflicts on Confirmed transition.
- Onboarding: `clinqet-provider-onboarding` SKILL — Availability is step 5 of the 7-step wizard.
- Search: `clinqet-search-discovery` SKILL — `CategoryAvailabilityFilter` consumes facet service.
- Public page: `clinqet-provider-public-page` SKILL — public availability endpoint shown in business hours section.

---

## CHECKLIST BEFORE MERGE

- [ ] Every Cosmos query partition-scoped (`/businessId` on ProviderData). NO cross-partition.
- [ ] Document id pattern preserved: `{businessId}_{dayOfWeek.ToLower()}`.
- [ ] Time strings validated against `^([01]\d|2[0-3]):([0-5]\d)$` regex.
- [ ] Updates flow through `OnboardingProgressService.UpdateStepAsync(OnboardingStep.Availability, ...)` (so progress recalculates).
- [ ] Public endpoint never exposes ETag, internal IDs, or non-availability fields.
- [ ] Calendar UI folder name `calender` preserved (typo) — never rename.
- [ ] Mobile-first responsive on the calendar — month view on phone.
- [ ] All UI strings via `react-intl` keys.
- [ ] All DTO Display/Error attributes use localization keys.
- [ ] ESLint zero errors on changed UI.
- [ ] Unit + integration tests for new endpoints / repo methods.

---

## ‼️ CUSTOMER-FACING PER-LOCATION OPENING HOURS (PHASE 8 PART C, 2026-08-04)

**One service can be sold from several locations whose hours differ, so the schedule a customer sees depends
on which location serves them.** Getting this wrong sends a real person to a locked door — that is the failure
the whole design exists to prevent.

### The ONE endpoint the customer surfaces read

```
GET /api/v1/public/business/{businessId}/locations?serviceId=      [AllowAnonymous]
    -> ApiResponse<PublicBusinessLocationsDto>
       { hours: PublicAvailabilityDayDto[7],      // the business week
         hoursDiffer: bool,
         locations: [ { name, isDefault, inheritsBusinessHours, serviceAreaIds[], hours[7] } ] }
```

- `AvailabilityController` → `IPublicBusinessLocationService` (`clinqetinfrastructure\Services\Tenancy\`).
- ‼️ **It accepts NO visitor signal — no coordinate, no area id, no header — ON PURPOSE.** The SSR surfaces it
  feeds are CDN/ISR-cached, so one URL must render one deterministic HTML. A route that *cannot* receive a
  visitor signal cannot vary by one, which makes SEO rule 1 structural rather than a review promise.
- **Omit `serviceId`** for the Open Page (every active location serves). **Pass it** on a service page to
  narrow to the locations that actually sell that service (`Service.ServiceAreaIds` → `ServiceArea.branchId`).
- ‼️ **It REPLACES the `/availability` call on a customer surface — never joins it.** Its `hours` is the same
  business week from the same projection (`Clinqet.Core.Services.Tenancy.PublicAvailabilityWeek`), so the
  request count is unchanged. `/public/business/{id}/availability` still exists and is untouched.
- **Cost:** 0 locations ⇒ 1 Cosmos partition read (the one the availability endpoint already did) + 1 SQL
  index seek that returns nothing, then **short-circuits**. 1 location ⇒ the same two. 2+ ⇒ + `ServiceArea`
  and, with `serviceId`, one `Service` point read. All `/businessId`-partitioned. **No cache — the page's own
  `revalidate = 3600` ISR is the cache**, and a second one would delay picking up edited hours.

### The four states — the ONLY correct rendering, and it lives in ONE module

`clinqetwebuserapp\lib\locations\hoursRenderingRules.js` **and its twin**
`clinqetmobileuserapp\src\lib\locations\hoursRenderingRules.ts`. Call `resolveHoursView(payload, areaId)`;
never re-derive a state.

| Situation | What the customer sees |
|---|---|
| **0 locations** | ‼️ **Bare hours, byte-identical to before this feature.** No name, no expander, no JSON-LD change |
| **1 serving location** | Hours **+ the location name** |
| **2+, same hours** | The hours **once** + "Available at N locations" + the names. **No expander** |
| **2+, different hours** | The **matched** location's hours + name, plus **"Other locations (N)"** with *Hours differ* |

**Matched, in order:** the `serviceAreaId` the customer arrived with → the business's **default** location.
On web that id comes from the clicked search result; on mobile from the device-location-ranked search result
(`isClosest`). **No permission / no search context ⇒ the default leads**, which is what keeps the two apps'
output identical (CB-4).

‼️ **Both modules are dependency-free and side-effect-free ON PURPOSE.**
`clinqetmobileuserapp\__tests__\customerHoursRenderingParity.test.ts` sandboxes the web copy and **fails the
build** on any divergence — including an uncovered export. An `import` in either file breaks the sandbox and
the spec throws rather than silently skipping.

### The rules that bite

1. ‼️‼️ **ABSENT ROWS MEAN INHERIT, NEVER CLOSED.** A location with no override of its own shows the
   *business* hours; only an explicit `isAvailable = false` row is closed. `BranchAvailabilityResolver`
   already encodes this — use it, never re-derive it. Reading absence as "closed" silently shuts every
   location nobody customised.
2. ‼️ **`!![]` is `true`.** An empty `locations` array is the 0-location ANSWER, not missing data. Test length.
3. ‼️ **A failed load is NOT the 0-location state.** `payload === null` ⇒ the "hours unavailable" sentence,
   and the booking CTA stays live. A payload that loaded with nothing configured ⇒ render nothing, exactly as
   before (that is what protects the byte-identity gate).
4. ‼️ **CB-3: the "Same as the business hours" label appears in the EXPANDER ONLY** — provider vocabulary
   must never land on the main block.
5. ‼️ **CB-2: the expander ships CLOSED with "Hours differ" on the header.** Closed without those words is a
   trap; open by default is the "never dump every location" failure.

### SEO — the five rules, and where each is enforced

| # | Rule | Enforced by |
|---|---|---|
| 1 | One URL, one deterministic HTML, never varies by visitor | The endpoint takes no visitor parameter (C1). **No `Vary` exists on either SSR route** |
| 2 | When hours differ, EVERY location's hours are in the server-rendered HTML | The SSR payload carries all of them; the expander only hides them visually |
| 3 | Location awareness is a CLIENT-SIDE highlight of content already in the DOM | `matchedServiceArea` is read in a `useEffect` after mount, so the first client render matches the server |
| 4 | Locations create NO new URLs | Nothing added to the sitemap, the slug set or the canonical |
| 5 | 0 locations ⇒ byte-identical output | `PublicAvailabilityWeek` is shared by both endpoints; the day rows were deliberately NOT changed (decision C2); `LocationHours` renders `null` in that state |

**JSON-LD (CB-1):** 0 locations or all sharing hours ⇒ **one** `openingHoursSpecification`, exactly as before.
Hours differ ⇒ **per-location `department[]`**, each with its own schedule, and the business-level one is
**dropped**. Both surfaces: `lib\seo\dynamic-seo.js` (Open Page) and `lib\seo\serviceSeo.js` (service page).
‼️ **NEVER a single business-level schedule that is only true at one location.**

### `serviceAreaId` — the passthrough (L80)

`IndexedServiceAreaInfo.ServiceAreaId` has been in the search index since Phase 4, but **both wire DTOs
dropped it** until Part C. It now travels `ServiceAreaDistanceInfo` → `ServiceAreaResultDto` → the client →
`serviceAreaId` on `DraftBookingRequestDto` / `BookingRequestDto` → `IBranchResolver`. It **only routes** —
never authorization, never money — so an absent or stale id resolves to the whole business and must never fail
a booking. Carried in `sessionStorage` (web) / memory (mobile), keyed per business, 30-min TTL. ‼️ **NEVER in
the URL** — a query parameter would make the SSR route dynamic and fragment the ISR cache.

### Localization

Location **names are provider-typed and NEVER translated.** Every label around them is a key: web
`locations.*` (7 flat ids × 5 files), mobile `LOCATIONS.*` (9 nested leaves × 5 bundles). ‼️ Mobile keys are
**nested** (i18next `keySeparator`) and use `{{name}}`; web is **flat** and uses `{name}`.

✅ **Weekday names are LOCALIZED on all four customer hours surfaces** (decision **C6** — the owner relaxed
the byte-identity gate in session, 2026-08-04). Web uses `day.{DayOfWeek}`; mobile uses
`FILTER_SCREEN.DAY_{DAYOFWEEK}` — **not** `COMMON.WEEKDAY_*`, which is the three-letter chip set.
‼️ **The defect had been CROSSED:** web was raw on the SERVICE page and localized on the Open Page, while
mobile was localized on service detail and raw on the Open Page — neither app was the correct one to copy.

‼️ **`LocationHours`'s `formatDay` prop is REQUIRED and THROWS when absent.** Its old optional default
returned `day.dayOfWeek`, which is exactly how untranslated names shipped. **Never reintroduce a fallback.**

---

## ‼️ PER-LOCATION PROVIDER HOURS (PHASE 8 PART C — PROVIDER, 2026-08-04)

> Appended below Part C CUSTOMER's block, which covers the CUSTOMER-facing four-state rendering. This covers the
> PROVIDER side: reading and writing a location's own hours.

### The contract, and why the response shape did not change

```
GET  /business/availability?branchId=      availability.read    -> IEnumerable<Availability>   (7 rows)
PUT  /business/availability                availability.manage  -> the RESOLVED week
     body: { weeklyAvailability[7], branchId?, useBusinessHours? }
POST /business/availability/copy           availability.manage  -> business-scoped; NO frontend caller
```

‼️ **The GET resolves through `BranchAvailabilityResolver.EffectiveHours`, so a location with no rows of its own
returns the BUSINESS rows — the hours it inherits — and returns them UNTAGGED.**

**Whether a returned row carries the requested `branchId` is the ONLY signal for "has its own hours".** That is
deliberate, and it is what makes the owner's worked example structural: the grid is already filled with the
inherited hours before the toggle is touched, so it can never arrive blank and no second request is needed.

‼️ **`useBusinessHours: true` DELETES that location's rows** so it inherits again. Never a copy of the business
grid — a copy would freeze today's hours and stop tracking the default, which is the entire point of
inheritance (§8.2). The seven days still travel in the body and are ignored, because **absence of rows IS the
inheriting state**.

### ‼️ Two things that were broken and are now fixed

1. **`GET /business/availability` threw a 500 the moment any location overrode.** It keyed the raw partition by
   `DayOfWeek` alone, but the partition holds one row per day **PER LOCATION**, so `ToDictionary` threw
   `ArgumentException`. Always resolve through `EffectiveHours` BEFORE keying by day.
2. **`DeleteBranchAsync` left the branch's availability rows behind** (§8.6 case 6). Delete is permitted at zero
   areas and zero staff, but a location can still carry its own hours, and rows tagged with a branch that no
   longer exists are unreachable by every resolver. Delete now clears them; **deactivate keeps them**, because
   closing is reversible.

Also latent and now fixed: `POST /copy` resolved its source with `FirstOrDefault()` across the day and could
have copied a LOCATION's hours into the business default. `IAvailabilityRepository.GetAvailabilityForDayAsync`
remains branch-blind — **do not use it on any path where a location override can exist.**

### ‼️ The SQL boundary — deliberate and asymmetric

- **The business-wide read and write consult NO SQL.** `IBranchDirectory` is called ONLY when a `branchId` is
  supplied, so every request a single-location provider makes — most providers, forever — cannot be broken by a
  SQL outage. Pinned by `TheBusinessTab_NeverConsultsTheLocationDirectory`.
- **A per-location request REFUSES (`404 branch_not_found`) when the directory is unavailable**, because writing
  a row tagged with an unverified id would be a cross-tenant hole.
- ‼️ **The opposite applies to SERVICE AREAS:** there the lookup is a routing hint on a Cosmos write, so it
  degrades to `null` (the whole business) and logs a Warning — never a 400. That asymmetry is intentional; see
  CP4 / CP5 in `03-DECISIONS.md`.

### The provider UI rules (both apps, one module)

`showsLocations(activeCount) >= 2` gates the tab strip. At 0 or 1 there is **no strip, no toggle and no mention
of the word** — one open location plus one CLOSED one counts as one.

`locationHoursState(rows, branchId)` decides `inheriting` vs `own`, and **the screen must never re-derive it**.
`locationHoursTabs(locations)` builds "All locations" + one tab per ACTIVE location.
`weekSummary(rows)` collapses consecutive identical days into ranges and is shared by the list row, the inherit
panel and the copy picker, so all three can never describe one schedule differently.

**BR-3 copy-from-another-location is a CLIENT-SIDE grid fill — no endpoint.** Each option prints its actual
hours so nobody copies blind, and nothing is written until Save. Copy-day-times likewise stays **within** the
selected location (§8.6 case 12).

‼️ **A location write must NOT mark the onboarding availability step.** Only the BUSINESS week answers "has this
provider set their opening hours"; a location override refines hours that must already exist.
