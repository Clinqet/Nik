---
description: |
  **DATA LAYER SKILL** — Work on Cosmos DB data patterns, entities, DTOs, container design, partition keys, indexing. USE FOR: creating/modifying Cosmos entities, DTOs, repositories, container definitions, index policies, partition key design, data migration, seed data. Applies to files in clinqetcore/Entities/, clinqetshared/DTOs/, clinqetinfrastructure/Data/, cosmosindexsetup/.
---

# CLINQET COSMOS DB DATA LAYER — COMPREHENSIVE SKILL
## ABSOLUTE RULES (READ FIRST — APPLIES TO EVERY CHANGE)

- **Comments — terse, only when they earn their place.** Default to no comments; let naming carry the meaning. **However**, write a comment when it captures non-obvious context the code itself cannot show: a hidden invariant, a subtle ordering constraint, a deliberate workaround for a known bug, a defensive choice with a real reason, or an RFC/spec citation that explains *why*. Prefer a single short line. Forbidden: restating WHAT the code does (e.g. `// increment counter` above `counter++`); multi-line narrative blocks explaining design rationale; XML doc summaries on properties whose names already convey intent; commented-out code; `// TODO` without an issue link. When in doubt, delete the comment — but don't strip a *real* WHY-comment just to chase zero.
- **No verbose docstrings on self-evident members.** A property named ``EnableAISpellCorrection`` does NOT need a doc summary. A field named ``_searchEnableAISpellCorrection`` does NOT need a multi-line ``//`` block above it. Trust naming.
- **No commented-out code, no leftover symbols, no ``// TODO`` without an issue link.**

---


## OVERVIEW

Cosmos DB is the primary operational data store for ALL business data (services, bookings, quotes, invoices, broadcasts, messages, notifications, reviews, etc.). User identity data lives in SQL Server (separate concern).

- **Entities**: `C:\Nik\clinqetcore\Entities\COSMOS\`
- **DTOs**: `C:\Nik\clinqetshared\DTOs\COSMOS\`
- **Repositories**: `C:\Nik\clinqetinfrastructure\Data\COSMOS\`
- **Base Repository**: `C:\Nik\clinqetinfrastructure\Data\COSMOS\Base\CosmosDbRepository.cs`
- **Mappings**: `C:\Nik\clinqetinfrastructure\Data\COSMOS\Extension\`
- **Container Definitions**: `C:\Nik\cosmosindexsetup\Program.cs`
- **Seed Data**: `C:\Nik\cosmosindexsetup\SampleCosmosDataGeneratorSettings.cs`

---

## BOOKING HYBRID TIME DATA CONTRACT — 2026-07-16

- `Booking` in Transactions and `CustomerBooking` in CustomerData carry wall display fields plus `timeZoneId`, `scheduledStartUtc`, and `estimatedEndUtc`; the customer mirror must copy all five values together.
- `BusinessProfile.timeZoneId` is the provider-zone projection. Address writes restamp it; missing legacy profiles use an ETag-conditional point PATCH, never a stale whole-document replace.
- `BookingTimeHelper` is the only wall-to-UTC conversion implementation. Zone sourcing order: India country check → `Asia/Kolkata` (geo border polygons are imprecise near India's borders); else valid primary-address lat/long → offline `GeoTimeZone` lookup (`Etc/*`/null rejected); else the shared `BusinessTime` state map/default. Normally-stamped bookings/profiles never invoke geo — compute paths use the snapshotted `TimeZoneId` via the cached `TimeZoneInfo`. `BusinessProfile.TimeZoneSource` (`Detected`/`Manual` string enum, null ⇒ Detected) records provenance; `Manual` (provider override) blocks re-stamping until reset (`TrySetTimeZoneAsync` ETag CAS patch).
- Keep `/scheduledStartDateTime/?` for business-local-day filters. Add `/scheduledStartUtc/?` plus UTC sort composites in Transactions and CustomerData for instant ordering/computation. Apply `CosmosContainerPolicies` in deployment and wait for index transformation to reach 100%.
- Every query remains partition scoped (`/businessId` or `/customerId`). No container or partition-key change was introduced.


## WORK-LIST DAY FILTERS — HALF-OPEN, DERIVED ONCE (2026-09-03)

‼️ **Every work-list date filter is a DAY on the wire and a HALF-OPEN range in SQL.** Bookings, Quotes and
Invoices each used to emit `<= @endDate` against a `DateTime?` bound from a bare calendar date. Model binding
made that midnight, so an inclusive "To 21 Aug" matched only a booking scheduled at exactly 00:00 and
`From = To = 21 Aug` returned nothing. Five clients had each invented their own end-of-day workaround.

- `BookingFilter` / `QuoteFilter` / `InvoiceFilter` derive from `DayRangeFilter` and expose **`DateOnly?`**
  `StartDate`/`EndDate` (Booking adds `CreatedFrom/To`, `UpdatedFrom/To`). Query-string names are unchanged,
  so clients keep sending `?Filter.EndDate=2026-08-21` — it is simply read as the day it always was.
  ‼️ A client that appends a time (`T23:59:59.999`) now **fails to bind**. Send the bare day.
- `DateRangeBounds` (`clinqetshared/Models/Filters/`) is the ONLY place a day becomes instants:
  - `FromWallClockDays(from, toInclusive)` — **no time zone at all**, `DateTimeKind.Unspecified`. For
    `scheduledStartDateTime`, `issueDate`, `invoiceDate`, which store wall time (`NormalizeWallTime` stamps
    Unspecified, and `ClinqetCosmosSerializer`'s `K` specifier writes no suffix, so the bound matches).
  - `FromBusinessDays(from, toInclusive, zone)` — the BUSINESS's day converted to UTC, with a DST
    spring-forward nudge. For `createdAt`/`updatedAt`, which store UTC: "21 Aug" in Toronto is
    04:00Z→04:00Z, not midnight-to-midnight.
- `DateRangePredicate` (`Data/COSMOS/Base/`) emits `>= @from AND < @toExclusive`. **Never** re-derive a
  boundary at a call site and never write a "last instant".
- **Who resolves what:** the repository derives the wall-clock axis itself from the filter's days, so no
  caller can forget. The UTC axes cannot be derived there (they need the business zone) and arrive as
  `BookingTimestampBounds` via `WorkListDayRange.ResolveTimestamps`; filtering on a created/updated day
  without them **throws** rather than silently dropping the range and returning the whole partition.
  `BookingController` reads the profile ONLY when one of those four filters is present.
- **The ADMIN audit feeds follow the same rule.** `LoginAttemptFilter`/`UserActivityFilter` are day-shaped too,
  and the keyset queries (`AdminAlertQuery`, `AdminLoginAttemptQuery`) carry **`EndDateExclusive`** — a picked
  day widens to the next UTC midnight in the controller, while an omitted one stays `DateTime.UtcNow`, a real
  instant. `DateRangeBounds.FromUtcDays` is the resolver: an audit feed spans the platform, so there is no
  business zone and the day is a UTC day.
  ‼️ `AdminAlertRepository` walks MONTH partitions — enumerate them from `EndDateExclusive.AddTicks(-1)`, or a
  window ending on the last day of a month visits one extra empty partition per page.
- Guards: `DateRangeBoundsTests`, `DayFilterSwaggerSchemaTests` (DateOnly is the first on this API's
  surface — it must document as `string`/`date`), the SQL-shape assertions in
  `TransactionsRepositoryQueryTests`/`QuoteRepositoryTests`, and emulator-backed
  `WorkListDayFilters_ReturnRecordsScheduledLaterThanMidnightOnTheLastDay`.
## COSMOS CONTAINERS

Defined in `cosmosindexsetup/Program.cs`. Read this file BEFORE any data work.

| Container | Partition Key | TTL | Content Types |
|-----------|--------------|-----|---------------|
| `ProviderData` | `/businessId` | -1 (per-doc) | BusinessProfile, Service, ServiceArea, Availability, Category, SelectedCategory, BusinessCustomer, Portfolio, License, Offer, BroadcastProvider, Broadcast |
| `CustomerData` | `/customerId` | -1 (per-doc) | Customer, CustomerBooking, CustomerQuote, CustomerInvoice, UserReview, UserRecommendation |
| `Communications` | `/userNumber` | -1 (per-doc) | Conversation (per-side ownership), Notification, BroadcastDispatch |
| `Messages` | `/conversationId` | -1 (per-doc) | Message (composite id `{conversationId}_{messageId}`, keyset pagination via `(/type, /createdAt DESC, /id DESC)`) |
| `Reviews` | `/businessId` | -1 (per-doc) | Review, ReviewVote, BusinessRating, ServiceRating, ReviewReply, ReviewReport |
| `Transactions` | `/businessId` | -1 (per-doc) | Booking, Quote, Invoice |
| `SystemData` | `/pk` | -1 (per-doc) | AdminAlert, AiSession, Cart (`cart_{pk}`), LookupCodeDesc, LoginAttempt, UserActivity, RecentlyViewed, VoiceOwnNumberCountryConfig (`voicecfg_{iso}`), VoiceOwnNumberPlatformConfig (`voicecfg_platform`) |
| `leases` | `/id` | -1 | Cosmos change-feed lease docs (auto-managed) |

**Spotlight dismissal tracking is NOT in Cosmos** — it lives in SQL via Identity API (`UserSpotlightDismissal` table). See `clinqet-spotlight` skill.

### CRITICAL RULES
1. **No cross-partition queries** — EVER. Every query MUST include the partition key.
2. **Partition key is permanent** — once set, cannot be changed. Ask before creating new containers.
3. **Shared containers** — Multiple document types share containers. Use `type` discriminator field.

---

## ENTITY PATTERN

### Base Entity (clinqetcore/Entities/COSMOS/Cosmos.cs)

```csharp
public abstract class BaseEntity
{
    [JsonProperty("id")]
    public string Id { get; set; }

    [JsonProperty("type")]
    public string Type { get; set; }

    [JsonProperty("_etag")]
    public string ETag { get; set; }

    [JsonProperty("createdAt")]
    public DateTime CreatedAt { get; set; }

    [JsonProperty("updatedAt")]
    public DateTime UpdatedAt { get; set; }
}
```

### Entity Requirements
- ALL entities inherit from `BaseEntity`
- Use `[JsonProperty]` (Newtonsoft.Json) for Cosmos serialization
- Enums MUST have BOTH converters:
  ```csharp
  [JsonConverter(typeof(Newtonsoft.Json.Converters.StringEnumConverter))]
  [System.Text.Json.Serialization.JsonConverter(typeof(System.Text.Json.Serialization.JsonStringEnumConverter))]
  public BookingStatus Status { get; set; }
  ```
- Partition key field always explicit (e.g., `BusinessId`, `UserNumber`)
- Composite IDs: `{partitionKey}_{entityId}` (e.g., `{businessId}_{bookingId}`)
- TTL support: `[JsonProperty("ttl")] public int? Ttl { get; set; }`
- ‼️ **When a reader must know an item EXPIRED, compute it — never trust the store to hide it** (2026-09-26,
  `VoiceBusinessLiveCall`, the India relay's lease). The emulator was seen both returning expired items and purging them
  on its own schedule, so map the system timestamp READ-ONLY and decide in code — every reader then agrees whatever the
  store does (and a test must move the reader's clock, never wait out a real expiry the store may purge first):
  `[JsonProperty("_ts", NullValueHandling = NullValueHandling.Ignore)] public long? WrittenAtEpochSeconds { get; set; }` +
  `public bool ShouldSerializeWrittenAtEpochSeconds() => false;` (never sent back on a write) +
  `IsExpired(utcNow) => _ts + ttl <= utcNow`. No new stored field, no index change; proven against the emulator in
  `VoicePostCallProcessorIntegrationTests.LiveCallLease_RealStore_CarriesItsWriteTime_AndExpiresFromItsOwnClock`.

### Key Entities (7 files in Entities/COSMOS/)

| Entity | Partition Key | Notes |
|--------|--------------|-------|
| `BusinessProfile` | `businessId` | Provider profile, addresses, social links, status |
| `Booking` | `businessId` | Composite ID, TTL, status enum |
| `Service` | `businessId` | Service listings, pricing, availability |
| `AiSession` | `userNumber` | AI conversation history, tool executions |
| `LoginAttempt` | `userId` | Login tracking |
| `UserActivity` | `userId` | Activity tracking |
| `RecentlyViewed` | `userNumber` | Recently viewed items |

### Address Sub-Entity
```csharp
public class Address
{
    public string Street { get; set; }
    public string AptSuite { get; set; }
    public string City { get; set; }
    public string State { get; set; }
    public string ZipCode { get; set; }
    public string Country { get; set; }
    public GeoCoordinates Coordinates { get; set; }
}

public class GeoCoordinates
{
    public double Latitude { get; set; }
    public double Longitude { get; set; }
}
```

---

## DTO PATTERN

### Validation with Localization Keys

ALL DTO validation messages MUST use localization keys (never hardcoded text):

```csharp
public record NotificationDto(
    [Required(ErrorMessage = "Error_NotificationIdRequired")]
    [Display(Name = "Label_NotificationId")]
    string NotificationId,

    [StringLength(200, ErrorMessage = "Error_TitleLength")]
    string Title,

    [Required(ErrorMessage = "Error_MessageRequired")]
    string Message
);
```

### Key DTO Categories
- `CreateXxxDto` — Input for creation
- `UpdateXxxDto` — Input for updates
- `XxxDto` — Output (response)
- `XxxQueryDto` — Query parameters with filters/pagination

### Localization Key Format
- Error messages: `Error_FieldRequired`, `Error_FieldMaxLength`, `Error_InvalidValue`
- Display names: `Label_FieldName`
- All resolved at runtime by `LocalizedModelValidatorProvider`

---

## MAPPING PATTERN (Extension Methods)

16 files in `Data/COSMOS/Extension/` — ALL mapping is done via extension methods:

```csharp
// Entity → DTO
public static BookingDto ToDto(this Booking entity) => new()
{
    BookingId = entity.BookingId,
    Status = entity.Status,
    // ... all properties
};

// DTO → Entity
public static Booking ToEntity(this CreateBookingDto dto) => new()
{
    BookingId = dto.BookingId,
    // ... all properties
};
```

### RULES
- NEVER use AutoMapper — extension methods only
- Mapping logic stays in `Extension/` folder
- One extension file per entity type

---

## REPOSITORY PATTERN

### 35 Concrete Repositories (verified 2026-05-16)

All inherit from `CosmosDbRepository<T>` and implement a corresponding `IXxxRepository` interface, EXCEPT `CartRepository` which implements `ICartRepository` directly (not `CosmosDbRepository<T>` — it uses a custom `cart_{pk}` id pattern).

Full inventory:

| Repository | Container | Partition Key |
|---|---|---|
| `AdminAlertRepository` | SystemData | `/pk` |
| `AiSessionRepository` | SystemData | `/pk` |
| `AvailabilityRepository` | ProviderData | `/businessId` |
| `BookingRepository` | Transactions | `/businessId` |
| `CustomerBookingRepository` | CustomerData | `/customerId` |
| `BroadcastRepository` | ProviderData | `/businessId` |
| **`BroadcastDispatchRepository`** | Communications | `/userNumber` |
| `BroadcastProviderRepository` | ProviderData | `/businessId` |
| **`BusinessCustomerRepository`** | ProviderData | `/businessId` |
| `BusinessProfileRepository` | ProviderData | `/businessId` |
| `BusinessRatingRepository` | Reviews | `/businessId` |
| **`CartRepository`** | SystemData | `/pk` (id pattern `cart_{pk}`) |
| `CategoryRepository` | ProviderData | `/businessId` |
| `ConversationRepository` | Communications | `/userNumber` |
| `MessageRepository` | Messages | `/conversationId` |
| `CustomerRepository` | CustomerData | `/customerId` |
| `InvoiceRepository` | Transactions | `/businessId` |
| `CustomerInvoiceRepository` | CustomerData | `/customerId` |
| `LicenseRepository` | ProviderData | `/businessId` |
| `LoginAttemptCosmosRepository` | SystemData | `/pk` |
| `UserActivityCosmosRepository` | SystemData | `/pk` |
| `LookupRepository` | SystemData | `/pk` |
| `NotificationRepository` | Communications | `/userNumber` |
| `OfferRepository` | ProviderData | `/businessId` |
| `PortfolioProjectRepository` | ProviderData | `/businessId` |
| `QuoteRepository` | Transactions | `/businessId` |
| `CustomerQuoteRepository` | CustomerData | `/customerId` |
| `RecentlyViewedRepository` | SystemData | `/pk` |
| `VoiceOwnNumberConfigRepository` | SystemData | `/pk` (id = pk: `voicecfg_{iso}`, `voicecfg_platform`; point reads only) |
| `ReviewRepository` | Reviews | `/businessId` |
| `UserReviewRepository` | CustomerData | `/customerId` |
| `ReviewVoteRepository` | Reviews | `/businessId` |
| `SelectedCategoryRepository` | ProviderData | `/businessId` |
| `ServiceRepository` | ProviderData | `/businessId` |
| `ServiceAreaRepository` | ProviderData | `/businessId` |
| `UserRecommendationRepository` | CustomerData | `/customerId` |

**Entity documentation gaps now closed (2026-05-16):**

- `Conversation` (Communications, pk `/userNumber`, ~lines 2296-2371): has `isMuted: bool`, `mutedUntil: DateTime?`, `isHidden: bool` (per-side soft-delete), `ttl: int?` (365 active / 90 closed). Per-side ownership — 2 docs per conversation, one per participant. See `clinqet-messaging` skill.
- `Message` (Messages, pk `/conversationId`, ~lines 2393-2457): composite id `{conversationId}_{messageId}`, `ttl: int?`. Soft-delete is at Conversation level, not Message. Keyset pagination supported via composite index `(/type ASC, /createdAt DESC, /id DESC)`. See `clinqet-messaging` skill.
- `Cart` (SystemData, pk `/pk`): deterministic id `cart_{pk}`, ETag concurrency, TTL by status. See `clinqet-cart` skill.

**Phase-2 media-derivative indexes** (active as of 2026-05-10):
- ProviderData: `/documents/[]/documentId/?` (License documents), `/images/[]/imageId/?` (Portfolio + Service).
- Reviews: `/images/[]/imageId/?` (review images), `/updatedAt/?`.

### Constructor Pattern
```csharp
public class BookingRepository : CosmosDbRepository<Booking>, IBookingRepository
{
    public BookingRepository(CosmosClient client, IConfiguration config, ILogger<BookingRepository> logger)
        : base(client, config, logger,
            containerName: config["CosmosDb:ContainerNames:Transactions"],
            documentType: nameof(Booking))
    { }
}
```

### ‼️ RETRY POLICY — there are TWO, and widening the narrow one DOUBLE-BILLS (2026-09-21)

`CosmosRetryPolicyFactory` (`clinqetinfrastructure/Data/COSMOS/Base/CosmosRetryPolicyFactory.cs`) offers two
policies, plus a third for writes that must never repeat. A **transport** failure (the connection dying
mid-response) arrives as `HttpRequestException`, which is *not* a `CosmosException`, and leaves the outcome
**UNKNOWN** — and ‼️ so does a **408** or a **500** on a write (a timeout says nothing about whether it applied).

| Factory method | Handles | Use for |
|---|---|---|
| `Create` — **narrow** | 503 / 408 / 500 | anything that must not repeat when the outcome is unknown |
| `CreateForRepeatableOperations` | + `HttpRequestException` | reads, upserts, replaces, queries, and creates whose id is fixed before attempt one |

| `Unrepeatable` (P4-38b) | nothing — `Policy.NoOpAsync()` | a write whose repeat is not the same state: `Increment`, `Add`, `Move` |

429 is excluded from **all three** on purpose — the SDK retries it natively with `RetryAfter`. Do not add it.
‼️ An unsafe patch in `TryPatchItemAsync` and the Voiceline same-month minute increment take `Unrepeatable`, not the
narrow policy: even its 408/500 retry could double-count a billing counter. The caller gets the failure instead.
Guards: `CosmosRetryPolicyScopeTests.TheUnrepeatablePolicy_RetriesNoAmbiguousOutcome`, `…GivesAnUnsafePatchNoRetry`,
`…TheMinuteLedgerIncrement_IsNeverRepeated`; `CosmosPatchOutcomeTests.AnIncrement_WithAnAmbiguousAnswer_IsNotRepeated`.

`CosmosDbRepository<T>` exposes both, as `_retryPolicy` (narrow) and `_repeatableRetryPolicy`. The 17
repositories that do **not** inherit it pick one in their own constructor:

```csharp
_retryPolicy = CosmosRetryPolicyFactory.CreateForRepeatableOperations(configuration, logger, containerName);
```

**The four rules a reviewer gets backwards:**

- ‼️ **NEVER widen the narrow policy.** Repeating a `PatchOperation.Increment` DOUBLE-COUNTS, and those
  counters are the billing source of truth — lead usage, AI usage, business-search usage, and the Voiceline
  **minute ledger**. Repeating `Add("/segments/-", …)` duplicates the element. `VoicelineRepository` and
  `VoiceTranscriptRepository` are narrow-only for exactly that reason.
- ‼️ **`PatchItemAsync` chooses per call** — repeatable only when EVERY operation is `Set` / `Replace` /
  `Remove`. `Add` is treated as unsafe wholesale rather than parsed for a trailing `/-`: being conservative
  costs one retry, guessing wrong corrupts a document.
- ‼️ **`DeleteItemAsync` keeps the NARROW policy.** A delete is idempotent at the store, but that method
  re-reads first and answers a *question* — "did I delete it?" — so a retried delete finds the row already
  gone and answers `false`, turning a loud "I don't know" into a quiet wrong answer. The three knowledge
  repositories hold a separate narrow `_deleteRetryPolicy` for the same reason.
- ‼️ **A create on the repeatable policy needs the 409-on-retry read-back.** The id is fixed before attempt
  one, so a conflict arriving on attempt 2+ is our OWN landed write whose receipt the dropped connection ate
  — read it back rather than reporting a duplicate. `AddItemAsync` and `BulkInsertAsync` both do this; a new
  create path must too.

Pinned by `Clinqet.API.UnitTests/Conventions/CosmosRetryPolicyScopeTests.cs` — 10 tests, both directions.

### Common Method Implementations

```csharp
// Get by business (partition key = businessId)
public async Task<IEnumerable<Booking>> GetByBusinessIdAsync(string businessId)
    => await GetItemsByPartitionKeyAsync(businessId);

// Get single item
public async Task<Booking?> GetByIdAsync(string bookingId, string businessId)
    => await GetItemAsync($"{businessId}_{bookingId}", businessId);

// Paginated query
public async Task<PagedResult<Booking>> GetPaginatedAsync(string businessId, ...)
{
    // Build WHERE clause from filters
    // Use OFFSET/LIMIT pagination
    var items = await GetFilteredItemsAsync(businessId, where, orderBy, skip, take);
    var count = await ExecuteScalarQueryAsync<int>($"SELECT VALUE COUNT(1) ...", businessId);
    return new PagedResult<Booking> { Items = items, TotalCount = count };
}
```

### Interface Pattern (clinqetcore/Interfaces/COSMOS/)

```csharp
public interface IBookingRepository : ICosmosDbRepository<Booking>
{
    Task<Booking> CreateBookingAsync(Booking booking);
    Task<Booking?> GetByIdAsync(string bookingId, string businessId);
    Task<PagedResult<Booking>> GetPaginatedAsync(string businessId, BookingQueryDto query);
    // ... domain-specific methods
}
```

---

## INDEX DESIGN (cosmosindexsetup/Program.cs)

When adding new repository methods:
1. Read `cosmosindexsetup/Program.cs` to understand existing indexes
2. Assess if new or modified indexes are beneficial
3. Composite indexes for multi-field ORDER BY
4. Range indexes for filtering
5. Spatial indexes for geo queries

### Container Index Categories
- **Included paths**: Properties used in WHERE, ORDER BY
- **Excluded paths**: Large text fields not queried directly
- **Composite indexes**: Multi-field sorting (e.g., status + createdAt)
- **Spatial indexes**: GeoJSON for location-based queries

---

## CONCURRENCY CONTROL

### ETag-Based Optimistic Concurrency

‼️ **Until 2026-09-06 this section described the OPPOSITE of what the code did, and that is how the defect
spread.** `UpdateItemAsync` re-read the document to obtain a FRESH etag and then wrote the caller's STALE
object with it, so the precondition passed *by construction*. Three call sites caught `PreconditionFailed`
expecting a real guard and could never fire; two repositories bypassed the base method with their own
conditional replace, saying so in their comments. **Never describe a concurrency guard you have not read.**

```csharp
// Conditional on the CALLER's etag — the one they read the document with.
// 412 => CosmosException(PreconditionFailed), never a retry: a retry that re-fetches the etag and replays the
// same stale payload is the defect, not the fix.
// No etag on the item => PersistenceContractException (NOT an InvalidOperationException: that type’s Message
// IS a localization key in 65 controller catch blocks, so a developer sentence printed to the provider as a
// 400). A deliberate unconditional write uses UpsertItemAsync.
// The fresh etag is stamped back onto the caller's instance, so writing the same instance twice works.
await _repo.UpdateItemAsync(entity, partitionKey);

// A REAL read-modify-write. `mutate` is re-applied to a FRESH document on every attempt, so a retry can never
// replay stale state. Returning false means "no change needed" and nothing is written. Bounded by
// CosmosDb:MaxConcurrencyRetries, then the 412 is rethrown — the write is still owed.
await _repo.UpdateItemWithRetryAsync(id, partitionKey, entity => { entity.Count++; return true; });

// PatchItemAsync with explicit ETag
await _repo.PatchItemAsync(id, partitionKey, patchOps, ifMatchEtag: entity.ETag);
```

### Which write shape
| The write | Shape |
|---|---|
| Read → mutate → write in one request, and a conflict SHOULD be shown to the user | `UpdateItemAsync`; `BaseController` maps 412 to `Error_DbConcurrencyConflict` |
| A counter, an aggregate, a commutative append, an idempotent stamp | `UpdateItemWithRetryAsync` |
| The entity is held across a slow call (an AI request, a blob upload, a notification fan-out) | `UpdateItemWithRetryAsync`, re-evaluating any guard **inside** the mutate |
| A narrow, stable field set | an atomic `PatchItemAsync` — it removes the conflict instead of reporting it |
| A deliberate unconditional write (a denormalized mirror, an idempotent marker) | `UpsertItemAsync` |

‼️ **Every write path leaves the caller’s instance carrying the CURRENT etag** — `AddItemAsync`,
`UpsertItemAsync` and the conditional replace all restamp it. Without that, a create (or an upsert) followed
by an update of the SAME instance is refused for having no etag: a deterministic failure with no concurrent
writer. `AddItemAsync` shipped without it in 2026-09-06 and broke 8 emulator CRUD tests.

‼️ **`UpsertItemAsync` is NOT a blind write.** It reads the stored document whenever the caller supplied an
id, because that read is what:
1. **carries `createdBy*` forward** — without it, a constructed `ProviderOwnedEntity` written over a
   deterministic id re-attributes the document to whoever edited it last. `Availability` (the weekly-hours
   save and copy-day-times) and `BusinessCustomer` are both `ProviderOwnedEntity`; the invariant is stated in
   `ProviderOwnedEntity`’s own comment and `UpsertItemAsync` was the one path that broke it;
2. **refuses a foreign document family** — shared containers plus `{businessId}_{entityId}` ids means an
   upsert could re-type and destroy another family’s document. The replace and delete paths have refused this
   since 2026-09-06; the upsert path had no guard at all;
3. keeps `CreatedAt` when the caller did not set it. The caller’s own `CreatedAt` still wins.

Cost: one point read per upsert of a caller-supplied id — the same trade the conditional replace already makes.

‼️ **A repository that projects an EXTERNAL source onto a provider-owned row merges, it does not replace.**
`MergeBusinessCustomerAsync` is the pattern: create when absent, otherwise apply only the fields the source
owns under `UpdateItemWithRetryAsync`, **never blanking a stored value with a blank incoming one**, writing
nothing when nothing changed, and merging rather than failing when a create loses its race. The blind upsert it
replaced blanked a provider’s CRM surname and phone every time a quote carried neither.

### Conflict Resolution
- ‼️ **A write that happens AFTER an irreversible side effect** (a notification sent, a blob uploaded or
  deleted, the authoritative row already committed) **must not surface a bare 412** — the caller would be told
  an operation failed that in fact succeeded. Use the read-modify-write so it converges.
- ‼️ **A mutate that runs more than once must be idempotent.** A `list.Add` without an existence check
  duplicates the item when a write lands but its acknowledgement is lost and Polly re-sends.
- NEVER silently overwrite — always preserve data integrity

---

## ENUM SERIALIZATION (NON-NEGOTIABLE)

ALWAYS serialize enums as **string values**, NEVER integer values.

**Every enum definition** in `clinqetshared/Enums/` MUST have `[JsonConverter(typeof(JsonStringEnumConverter))]` at the **type level** (from `System.Text.Json.Serialization`). The global converter in `AddJsonOptions` only covers MVC serialization — the type-level attribute guarantees string serialization universally (Service Bus, Cosmos, manual `JsonSerializer` calls, test deserialization, external consumers). The only exception is `UserType`, which has a custom `[JsonConverter(typeof(UserTypeJsonConverter))]`.

```csharp
// Every enum definition MUST look like this:
using System.Text.Json.Serialization;

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum BookingStatus
{
    Draft,
    Confirmed,
    ...
}

// In entities (dual converter for Newtonsoft compatibility):
[JsonConverter(typeof(StringEnumConverter))]                        // Newtonsoft
[System.Text.Json.Serialization.JsonConverter(typeof(JsonStringEnumConverter))]  // System.Text.Json
public BookingStatus Status { get; set; }

// In serializer options:
new JsonSerializerOptions
{
    Converters = { new JsonStringEnumConverter() },
    PropertyNameCaseInsensitive = true
};
```

This applies everywhere: API responses, Service Bus messages, Cosmos documents, search index.

---

## 54 ENUMS (clinqetshared/Enums/)

### Key Enums by Category

**User**: `UserType`, `MfaType`, `PasskeyType`, `ExternalLoginProvider`, `AppType`, `Platform`

**Transactions**: `BookingStatus`, `QuoteStatus`, `InvoiceStatus`, `OfferStatusFilter`

**Broadcast**: `BroadcastStatus`, `BroadcastUrgency`, `BroadcastBudgetType`, `BroadcastMatchingStrategy`, `BroadcastBidStatus`, `BroadcastProviderStatus`

**Communication**: `NotificationType`, `MessageType`, `CommunicationEventType`, `EmailType`, `SmsCategory`, `MessageChannel`

**Search**: `SearchMatchQuality`, `SearchMatchType`, `SearchFusionStrategy`, `SearchLatencyBucket`, `AnalyticsEventType`

**Admin**: `AdminAlertSeverity`, `AdminAlertType`, `ErrorCode`, `ServiceApprovalStatus`, `BusinessProfileStatus`

---

## CART / BASKET

### Cart Entity (`C:\Nik\clinqetcore\Entities\COSMOS\Cart.cs`)
**Container**: `SystemData` (partition key: `/pk`)
**ID format**: `cart_{pk}` (deterministic — one cart per user/device)

| Property | Type | Description |
|----------|------|-------------|
| `Pk` | `string` | Partition key: userNumber (authenticated) or deviceId (anonymous) |
| `IdentifierType` | `CartIdentifierType` | `User` or `Device` |
| `Status` | `CartStatus` | `Active` or `Converted` |
| `Providers` | `List<CartProviderGroup>` | Items grouped by provider |
| `Currency` | `string` | Cart currency code |
| `Notes` | `string?` | Optional user notes |
| `ConvertedAt` | `DateTime?` | When cart was converted to booking |
| `ReminderScheduledMessageIds` | `List<long>` | Service Bus scheduled message IDs (for cancellation) |
| `Ttl` | `int` | Cosmos TTL in seconds (from `CartExpiryDays`) |

### Sub-Entities
- **CartProviderGroup**: `ProviderId`, `ProviderName`, `ProviderImage`, `Items` (list of CartItem)
- **CartItem**: `ServiceId`, `ServiceName`, `ServiceImage`, `Quantity`, `Price` (CartPrice), `AppliedOffer` (CartAppliedOffer?), `Notes`, `AddedAt`
- **CartPrice**: `Amount`, `Currency`, `FormattedPrice`
- **CartAppliedOffer**: `OfferId`, `OfferTitle`, `DiscountPercentage`, `DiscountedPrice` (CartPrice)
- **CartAddress**: `FormattedAddress`, `Latitude`, `Longitude`

### Cart Enums
- `CartStatus`: `Active`, `Converted`
- `CartIdentifierType`: `User`, `Device`
- Both have `[JsonConverter(typeof(JsonStringEnumConverter))]`

---

## CHECKLIST FOR DATA LAYER CHANGES

- [ ] Container and partition key confirmed from `cosmosindexsetup/Program.cs`
- [ ] Entity inherits `BaseEntity`
- [ ] Enum properties have BOTH Newtonsoft + System.Text.Json converters
- [ ] Composite ID format: `{partitionKey}_{entityId}`
- [ ] All queries include partition key
- [ ] No cross-partition queries
- [ ] DTOs use localization keys for validation messages
- [ ] Mapping via extension methods (not AutoMapper)
- [ ] Repository registered as Scoped in DI
- [ ] Index assessment done for new query patterns
- [ ] ETag concurrency used for entities with concurrent updates
- [ ] New localization keys added to `en.json`
- [ ] Interface defined in `clinqetcore/Interfaces/COSMOS/`

## Privacy Policy Consent (2026-05-22)

`UserProfile` SQL gained 4 nullable columns (migration `20260520221018_AddPrivacyPolicyConsent` in `clinqetinfrastructure/Migrations/`):
- `PrivacyPolicyVersion NVARCHAR(20)`
- `PrivacyPolicyHash NVARCHAR(64)`
- `PrivacyPolicyAcceptedAt DATETIME2`
- `PrivacyPolicyJurisdiction NVARCHAR(2)`

Two indexes via `AppDbContext.OnModelCreating`: composite `(Version, Jurisdiction)` for cohort queries + filtered `(Version) WHERE [PrivacyPolicyVersion] IS NULL` for the "needs re-consent" cohort. NULL is treated as stale → middleware blocks on next request → re-consent modal stamps them.

Legal-policy Cosmos docs (in the existing `SystemData` container under `CodeDesc`, partition key = `codeType`) carry versioned metadata: `{ country, content, version, effectiveDate, contentHash, localizedContent, localizationHash }`. `content` and `contentHash` remain the canonical English consent artifact. `localizedContent` contains full `fr`/`es`/`hi`/`gu` display bodies and `localizationHash` lets translations update without changing the consent version/hash or forcing re-consent. Translation catalogs live under `cosmosindexsetup/Documents/LegalPolicies/{language}.json`; every catalog must contain the exact 17 English card ids and preserve HTML/tag, effective-date-token, email, and URL structure. Doc id format remains `{codeType}_{surface}_{jurisdiction}` (e.g. `privacy_policy_userapp_in`). Idempotent seed via `LegalPolicySeedDecision.Decide` still throws on canonical English drift without a manifest bump; localization-only drift updates in place. Source of truth for version + effective date: `cosmosindexsetup/LegalPolicyManifest.cs`. Country codes stay separate (`us` != `ca`) at every layer — no SharedUsCa entries.

`UserActivity` Cosmos container is used as the audit trail for consent acceptance (`activityType = TermsAccepted`, metadata includes `policyType`, `version`, `hash`, `jurisdiction`, `effectiveDate`, `appType`, `platform`). Partition key remains `userId` (intra-partition for per-user history queries). Written via existing `IUserActivityService.RecordActivityAsync` (Service Bus → function → Cosmos).


## Seed category catalog — permanent ids + icons (2026-07-05)

The seed catalog in `cosmosindexsetup/SampleCosmosDataGeneratorSettings.cs` (`_categoryData`) is **40 categories / 300 subcategories**.

- **Ids are permanent.** Each category carries an explicit `Number` in its tuple -> id `cat_{Number:000}`. Subcategory ids are positional within their list -> `{catId}_sub_{position:000}`. **Append only**: never renumber, reorder, insert mid-list, or reuse a number. New categories take the next free number regardless of alphabetical position (display order is recomputed alphabetically at seed time and may differ from the number).
- **Every category AND subcategory has an icon** at `cosmosindexsetup/Icons/CategoryIcons/{slug}.svg` where slug = `Slugify(full display name)`: lowercase -> strip `& / \ ( )` -> other non-alphanumeric runs -> `-` -> trim `-`. Example: "Oven & Stove Repair (Electric & Gas)" -> `oven-stove-repair-electric-gas.svg`. The seeder warns `Icon not found` and seeds a null IconURL otherwise.
- **Icon style is fixed**: single-line SVG, `viewBox="0 0 24 24" fill="none" stroke="#032858" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"`, geometric primitives only, CRLF, no BOM.
- **Id consumers to keep in sync**: `DataSeeding/SeedTemplates/ServiceTemplates.cs` + `BusinessTemplates.cs` key demo data by literal `cat_XXX[_sub_YYY]` ids; `clinqetwebuserapp/scripts/generate-broadcast-hints.mjs` parses `_categoryData` (explicit `Number`) and re-stamps `clinking.hint.*` keys into the four user-app locale files — **re-run it after any catalog change**.
- Added 2026-07-05: categories 36-40 (Child Care & Babysitting, Laundry & Dry Cleaning, Marketing & Advertising, Senior & Home Care, Tailoring & Alterations) + 25 subcategories appended under existing categories (e.g. Mobile Phone & Tablet Repair, Solar Panel / EV Charger Installation, Septic Tank Services, Home Inspection, Mehndi & Henna Art, Water Purifier & Filtration Service). "Physiotherapy" is NOT a separate subcategory — it is covered by Wellness & Body Care -> Physical Therapy (keywords include physiotherapy/physio/home physiotherapy).

## ‼️ The Cosmos serializer camel-cases DICTIONARY KEYS (2026-09-17)

`ClinqetCosmosSerializer` uses `CamelCasePropertyNamesContractResolver`, which also rewrites the KEYS of every
`Dictionary<string, T>` it writes: a carrier stored as `{"Rogers": 15}` came back as `rogers`, and "AT&T" would be
`aT&T`. **Never key a stored dictionary by text a person typed** — store a list of objects
(`VoiceOwnNumberConfig.CertifiedCarriers` is `List<VoiceOwnNumberCarrierCap>`). ‼️ A test that reads the value back
through a case-INSENSITIVE dictionary passes while the stored name is already wrong: assert the exact text.

## SystemData keyset paging — AdminAlert (2026-07-24)

`AdminAlertRepository` no longer exposes `GetAlertsByDateRangeAsync` / `GetUnreadAlertsAsync` / `GetAlertsByTypeAsync` / `GetAlertsBySeverityAsync` (all four pulled every matching doc in the window). They are replaced by ONE keyset-paged read:

```csharp
Task<(IReadOnlyList<AdminAlert> Items, string? ContinuationToken)> GetAlertsPagedAsync(AdminAlertQuery query, CancellationToken ct = default);
```

- Walks the window's `yyyy-MM` partitions **newest-first, one query at a time**, stops when the page is full, and skips months entirely newer than the cursor. RU scales with page size, not with how many alerts the window holds.
- Cursor = base64(`createdAt`|`id`), the same composite-keyset shape `MessageRepository` uses.
- SQL: `SELECT TOP n * FROM c WHERE … ORDER BY c.type, c.createdAt DESC, c.id DESC` — needs the `(/type ASC, /createdAt DESC, /id DESC)` composite in `CosmosContainerPolicies.SystemData`. `/isResolved` is now in `IncludedPaths` (it is an equality filter; without it prod scans the partition).
- **Partition invariant:** `CreateAlertAsync` always derives `AlertDate` (the pk) from `CreatedAt`, honouring a caller-supplied `CreatedAt` (`AdminAlertProcessor` passes `message.AlertTimestamp`). A pk that disagreed with `createdAt` — a Service Bus message delayed across a month boundary — would hide the alert from every window containing it. Never set `AlertDate` independently.

`LoginAttempt` / `UserActivity` keep `pk == userId`. A platform-wide feed over either is a cross-partition query and is not permitted; the admin surfaces resolve a user first. Owner decision 2026-07-24: do NOT add a day-bucketed feed doc or re-key the container to enable one.

## SystemData keyset paging — LoginAttempt admin feed (2026-07-26)

`LoginAttemptCosmosRepository.GetAdminPageAsync` is the admin list read. It is always scoped with `PartitionKey(userId)`, uses `TOP (pageSize + 1)`, and returns an opaque base64(`attemptDate`|`id`) cursor. It never executes `COUNT` or `OFFSET`; the older `GetPaginatedAsync` contract remains only for existing non-admin consumers.

The default query orders by `(/type ASC, /attemptDate DESC, /id DESC)`. An outcome-filtered query orders by `(/type ASC, /succeeded ASC, /attemptDate DESC, /id DESC)`. Both exact composites belong in `CosmosContainerPolicies.SystemData` and the Identity integration fixture.

---

## SQL + SEED ADDITIONS (session 7, 2026-07-26)

**New SQL table `UserFriendlyNameHistory`** — the only new table this SEO programme added, owner-approved
as D3. Three columns beyond the key: `FriendlyName` (nvarchar(20), **UNIQUE**), `UserId` (FK to
UserProfile, cascade), `ReplacedAt`. Migration `AddUserFriendlyNameHistory`.

‼️ **No global query filter, deliberately** — a slug retired by an account that later deactivated must
still read as TAKEN, exactly like the unique index on `UserProfile.FriendlyName`, which also spans
soft-deleted rows. Read only on a resolution miss; a live provider page never touches it.

**`SitemapSettings.CanonicalOrigin`** added (default `https://www.clinket.com`) — needed only by the
pre-generated services sitemap, which is the one place that builds public URLs outside the browser.

**FAQ seed data (`cosmosindexsetup`).** `FaqSeedCatalog` loads validated JSON from
`Documents/Faqs/{code}.{language}.json`. The authored catalog contains `en`, `fr`, `es`, `gu`, and `hi`;
unsupported locales use English, and Japanese FAQ documents are intentionally absent. English keeps
the bare id (`faq_{code}`); localized documents use `faq_{code}_{language}`.

Three codes:
- `userapp` — complete customer web/mobile help content.
- `partnerapp` — complete provider web/mobile help content.
- `landing` — category-agnostic answers used in public `FAQPage` schema.

All translations must preserve the English item order, stable ids, and category slugs. The catalog
validator rejects missing documents, incomplete or duplicate items, shape drift, and the retired
user-facing term "Broadcast". Customer wording is "Get Quotes"/"Quotes"; provider wording is "Leads".
App surfaces request the selected supported language and must not bundle fallback FAQ answers.
Regional seeding is exact: North America (`ca` stamp) writes `en`/`fr`/`es` (nine documents), while India writes
`en`/`hi`/`gu` (nine documents). The partition wipe runs before filtering, so a regional reseed
removes stale FAQ languages from that region.

`--reseed-faqs` is a lower-environment-only destructive refresh. It queries and deletes only the
`SystemData` partition `pk = "faq"`, then recreates the validated catalog; production is blocked.
## FAQ localization baseline (2026-07-26)

- `FaqSeedCatalog` validates five authored languages: `en`, `fr`, `es`, `hi`, and `gu`, producing 15 documents across `landing`, `partnerapp`, and `userapp`.
- The North America `ca` regional stamp seeds exactly `en`/`fr`/`es`; India seeds exactly `en`/`hi`/`gu`. Japanese FAQ documents are absent. FAQ tests enforce exact region sets and English structural parity.

## Phase-2 provider fields + the conditional-patch rules (2026-07-28)

**New on `BusinessProfile`** (all nullable, all `NullValueHandling.Ignore`):
`responseScore` · `reliabilityScore` · `scoresUpdatedAt` · `newAreaSince` (List<string>) ·
`deactivatedAt` · `deactivationReason` · `ttl`. (`acceptanceScore` + the five flat score-override fields joined 2026-09-29 — last section.)
**New elsewhere:** `Booking.timeoutParty` (`BookingConfirmationParty?`) · `Conversation.firstReplyAt`
(DateTime?) · SQL `PromoCode.ShowInBanner` (bool, default false — ‼️ **no admin can set it yet;
Phase 4B wires it onto the existing promo CRUD**).

### ‼️ `FeaturedPlacement` WAS DROPPED (session 14) — do not create it
The planned `type: "FeaturedPlacement"` document in `ProviderData` **will never exist**. The paid
product is a **boost**, stored as a **SQL billing row projected onto the existing `BusinessProfile`**,
mirroring `TierProjectionService` — ‼️ **no new container AND no new document type.** The projection
write is what fires the change feed; a boost living only in SQL would never reach the index.
‼️ `"FeaturedPlacement"` is still in `SearchIndexSyncFunction.ReindexDocumentTypes` (added inert in
Phase 1) and is now **dead config — Phase 4B removes it.**

### ‼️ Conditional patches — what the emulator will and will not accept
- **Top-level paths in a `FilterPredicate` work.** `TryAppendNewAreaAsync` uses
  `FROM c WHERE IS_DEFINED(c.newAreaSince) AND NOT ARRAY_CONTAINS(c.newAreaSince, '…')` and is proved
  against the real emulator.
- ‼️ **A NESTED path in a `FilterPredicate` is REJECTED** — `c.coordinates.latitude` returns
  `PostgresError(SqlState 42601)`, a 500. Use the **ETag-CAS** pattern instead (re-read, decide in
  memory, patch conditional on that ETag). That is what `TryPersistFallbackCoordinatesAsync` does.
- A `FilterPredicate` takes **no parameters** — any literal must be escaped by the caller. `newAreaSince`
  entries are safe by construction (slug + ISO date).

### When to use which write shape on BusinessProfile
| Need | Shape | Example |
|---|---|---|
| Independent field a background job owns | **field-scoped patch, NO ETag** — cannot clobber a concurrent edit, unlike read-modify-write | `TrySetProviderScoresAsync` |
| An admin value two admins (or the nightly expiry) may race on | **ETag CAS**, Remove only for a field the same read holds, plus an `expected` value from the screen | `TrySetScoreOverrideAsync` |
| Append to an array, exactly once | **two conditional patches** (extend / create) + a bounded re-read | `TryAppendNewAreaAsync` |
| A state change that races the owner's edits | **ETag CAS**; 412 ⇒ caller re-reads | `TrySetLifecycleStatusAsync` |
| One item inside an array, by stable id | `PatchStableArrayItemByIdAsync` (ETag CAS + retry, resolves the index in memory) | `TryPersistAddressFallbackCoordinatesAsync` |

### ‼️ `status IN (...)`, never `ARRAY_CONTAINS(@array, c.status)`
With the document property as the **second** argument, `ARRAY_CONTAINS` is **not index-optimised** — it
evaluates per document, i.e. a partition scan. It passes on the emulator and bills in production. This was
found and fixed during the Phase-2 audit (`GetOutstandingBookingsAsync`), which also bounds its result to
50 rows so a long book cannot put an unbounded array in a 409 payload.

## `BusinessProfile` changes (Phase 4B, 2026-07-28)

- ‼️ **`clinketBadge` ADDED** — `ClinketBadgeType?`, `NullValueHandling.Ignore` so an ungranted
  provider stores **no property at all**. Written only by `TrySetClinketBadgeAsync` (ETag-CAS,
  field-scoped). ‼️ **Revoking uses `PatchOperation.Remove`, and Cosmos REJECTS a Remove on a path the
  document lacks** — which is exactly the state of every never-granted provider — so the caller passes
  `propertyExists` from what it actually read. Proved against the real emulator.
- ‼️ **`isFeatured` REMOVED** — from the entity, from `TrySetSubscriptionProjectionAsync`, and from the
  patch. Its only reader was `TierProjectionService`'s own idempotency check: a projection whose sole
  purpose was deciding whether to rewrite itself.
- `CountOutstandingBookingsAsync` on `BookingRepository` — the TRUE total, uncapped, single-partition.
  ‼️ `GetOutstandingBookingsAsync` stops at 50, so **its length must never be shown as a total**.

---

## MULTI-USER PROVIDER TENANCY — SQL foundation (Phase 1, 2026-08-01)

> Programme docs: `C:\Nik\member-provider\`. Migration: **`20260801220934_AddMultiUserProviderTenancy`**.
> Phase 1 delivered SCHEMA ONLY — no authorization, no token change, no seat enforcement.

### The identifier split (D1)

| Identifier | Shape | Means | Column |
|---|---|---|---|
| `UserProfile.UserNumber` | **5** chars `A-Z0-9` | the PERSON | `nvarchar(16)` |
| `Business.BusinessId` | **6** chars `A-Z0-9` | the TENANT (every Cosmos `/businessId`) | `nvarchar(16)` PK |

**One shared namespace.** `Communications` is partitioned by a single `/userNumber` path but holds
per-member `Notification` docs (keyed by UserNumber) AND provider-side `Conversation` docs (keyed by
BusinessId). If the two could ever be equal, **two tenants would share one logical partition.**
Guaranteed by (1) different lengths, (2) an allocator that rejects a candidate found in EITHER table,
(3) `TenancyConventionTests.UserNumberAndBusinessId_CanNeverBeTheSameLength` — a build-failing test.

Single source of truth: `Clinqet.Shared.Constants.IdentifierNamespace`
(`Alphabet`, `UserNumberLength = 5`, `BusinessIdLength = 6`, `StoredMaxLength = 16`) and
`Clinqet.Shared.Utilities.IdentifierCodeGenerator.NewCode(alphabet, length)`. **Never re-declare a
local `const string chars`** — `AuthService.GenerateUniqueUserNumberAsync` was refactored onto these
precisely so the convention test has something real to anchor on.

### Allocating a BusinessId

```csharp
// Registered by AddTenancyServices(configuration) — Main API host only in Phase 1.
var allocation = await _businessIdAllocator.AllocateAsync(ct);   // (BusinessId, Attempts)
```

- `Clinqet.Core.Interfaces.Tenancy.IBusinessIdAllocator` / `Clinqet.Core.Services.Tenancy.BusinessIdAllocator`.
- **Lives in `clinqetcore`, not Infrastructure** (L42) because `cosmosindexsetup` references only
  `clinqetcore` + `clinqetshared` and must run the SAME algorithm, not a copy.
- `IIdentifierNamespaceProbe` has two impls: `SqlIdentifierNamespaceProbe` (Infrastructure, Scoped,
  `IgnoreQueryFilters` so a code held by a deactivated person still reads as TAKEN) and
  `SeedIdentifierNamespaceProbe` (seeding tool, pre-loaded HashSet).
- 10 attempts, exponential backoff capped at 5 s with jitter, then `BusinessIdAllocationException`.
- Settings `Tenancy:BusinessId:{Alphabet,Length,MaxAllocationAttempts,InitialBackoffMs,MaxBackoffMs}`
  in `Clinqet.API/appsettings.json` and `cosmosindexsetup/appsettings.json`. `TenancySettings` class
  defaults mirror them exactly.

### The 17 tenancy tables

Schema + every index: **`clinqetinfrastructure\Data\SQL\TenancyModelConfiguration.cs`**
(`Apply(ModelBuilder)`, called from `AppDbContext.OnModelCreating` beside `BillingModelConfiguration`).
Entities in `clinqetcore\Entities\SQL\`.

`Business` · `BusinessMembership` · `BusinessRole` · `BusinessMembershipRole` · `BusinessTeam` ·
`BusinessTeamMember` · `BusinessBranch` · `BusinessMembershipBranch` · `BusinessOwnershipHistory` ·
`BusinessInvitation` · `InvitationRole` · `InvitationTeam` · `InvitationBranch` ·
`BusinessNotificationRoute` · `MembershipNotificationPreference` · `AccessChangeQueue` ·
`BusinessFriendlyNameHistory`

> ‼️ **Phase 2.1 cut 20 → 17 and renamed five.** `BusinessPermissionDefinition` and
> `BusinessRolePermission` were **deleted** — the 87 permissions and 353 grants are a fixed C# list in
> `TenancyRoleCatalogDefinition`, resolved at runtime by `GrantsByRoleKey`; copying them into SQL was the
> same data twice with a seeder and drift risk attached, and nothing queried them. A convention test
> fails the build if either returns. `BusinessLegacySeatGrant` became three columns on `Business`.
> Renames: `AuthorizationOutbox`→`AccessChangeQueue` (PK `Id`), `BusinessRoleDefinition`→`BusinessRole`,
> `BusinessLocation`→`BusinessBranch` (PK `BranchId`), `BusinessMembershipLocation`→
> `BusinessMembershipBranch`, `InvitationLocation`→`InvitationBranch`.

> ‼️ **`BusinessBranch` holds branch IDENTITY ONLY — `BranchId`, `BusinessId`, `Name`, `IsActive`.**
> Every piece of geography stays in **Cosmos**: `ServiceArea`, `BusinessProfile.Addresses`, and a
> nullable `branchId` tag on the work documents, all inside the existing `/businessId` partition.
> SQL answers *"may this member see this branch"* (authorization, transactional with membership);
> Cosmos answers *"where does it operate"* (geo-queried by search and lead matching). Never add an
> address column here.

**‼️ THE load-bearing constraint:**

```
UX_BusinessMembership_Business_User_Live
  UNIQUE (BusinessId, UserId) WHERE [Status] <> 'Removed'
```

Duplicate ACTIVE membership is impossible at the DATABASE level. `Invited` and `Suspended` count as
live and collide too. `Removed` rows are excluded, so a re-invite after removal succeeds and gets a
NEW `MembershipId`, and several `Removed` rows for one pair coexist. **Application-level checking is
not acceptable as a substitute.**

Other filtered indexes worth knowing: `IX_Business_FriendlyName` (unique, `WHERE FriendlyName IS NOT NULL`) ·
`IX_Business_PublicListing_Sequence` (`WHERE IsPubliclyListed = 1 AND Status = 'Active'`) ·
`UX_BusinessInvitation_TokenHash` (unique) · `IX_AccessChangeQueue_Undispatched`
(`WHERE DispatchedAt IS NULL`) · `UX_BusinessRole_SystemRoleKey` (`WHERE BusinessId IS NULL`) ·
`UX_MembershipNotificationPreference_Own` / `_About` (split on `AboutMembershipId IS NULL`).

### ‼️ Five traps, all of which cost real time in Phase 1

1. **EF Core keys `HasIndex(properties)` on the PROPERTY SET, not the name.** Two `HasIndex` calls on the
   same columns produce ONE index and the second **renames** the first. Use
   `HasIndex(e => new { ... }, "ExplicitName")` when you need a specific name alongside another declaration.
2. **The Identity host is `QueryTrackingBehavior.NoTracking` GLOBALLY**
   (`clinqetidentity\Clinqet.Identity.API\Program.cs:516`). Main API and Functions are tracked-by-default.
   **Any Identity-host query whose result will be MUTATED must call `.AsTracking()`** — otherwise the write
   silently persists nothing and the endpoint returns 200. `Remove()` on a detached entity DOES work, so a
   delete path can pass while an update path no-ops.
3. **`UserProfile` has a global query filter `HasQueryFilter(u => u.IsActive)`.** Any membership query that
   JOINS `Users` silently DROPS deactivated people — a team list loses members with no error. Team reads
   MUST use `Users.IgnoreQueryFilters()` and surface the deactivated state explicitly.
   `BusinessMembership` itself has NO filter, and neither does `Business` (L43).
4. **`BusinessMembership.UserId → UserProfile` is `DeleteBehavior.Restrict`** (L44), so a hard user delete
   FAILS while a membership exists. Removal is the `Status` transition, never a row delete. Test fixtures
   that wipe users must delete `Business` rows first (cascades memberships) —
   `IdentityApiFactory.CleanupDatabaseAsync` does, and it SWALLOWS its exception, so a regression there
   surfaces later as a confusing `"Email is already in use"`.
5. **`cosmosindexsetup` does NOT reference `clinqetinfrastructure`.** It carries a SHADOW EF model
   (`DataSeeding\SeedDbContext.cs`: `SeedUserProfile`, `SeedBusiness`, `SeedBusinessMembership`,
   `SeedBusinessMembershipRole`) mapped to the SAME tables. **Schema drift there does not fail to compile.**

### Business roles and permissions

Catalogue: **`clinqetinfrastructure\Data\SQL\TenancyRoleCatalogDefinition.cs`** — pure, deterministic,
`CatalogVersion = 1`. **87 permissions**, **10 system roles**, **353 grants**. Applied at runtime by
`TenancyRoleCatalogSeeder` (`ITenancyRoleCatalogSeeder`) via `TenancyRoleCatalogSeedHostedService`,
registered in the **Main API host only** — same pattern as `BillingCatalogSeeder`, with a
`CatalogVersionState` marker row id `"tenancy_roles"` (L38, NOT EF `HasData`).

Insert-if-absent every start; VALUE columns apply only on a `CatalogVersion` bump; a grant the definition
DROPPED is REMOVED on a release, because a permission left on a system role is a silent privilege leak.

System role keys / row ids `sysrole_<key>`:
`primary_owner` · `administrator` · `operations_manager` · `sales_representative` · `dispatcher` ·
`technician` · `catalog_manager` · `finance` · `contractor` · `read_only_auditor`.

- **Action × scope, never action-per-scope**: `booking.read` + `PermissionScope.Assigned`.
- `PermissionScope` is ordered **narrow → broad** (`None < CreatedByMe < Participating < Assigned <
  Branch < Team < Business`) so L27's "broader scope wins" is just `.Max()`.
- `business.transfer_ownership` (L19) **and** `payout.manage_account` (L40) are granted to
  `primary_owner` ONLY — both enforced by build-failing convention tests.
- `technician` and `contractor` get `Assigned` scope on `booking.read`/`customer.read`/`conversation.read`
  — full customer detail (G2) but never the whole list.
- `TenancyRoleCatalogDefinition.PermissionDefinition.IsSensitive` marks the permissions that must
  re-verify against LIVE SQL rather than the cached snapshot.

**Localization:** every role and permission carries `NameLocalizationKey` +
`DescriptionLocalizationKey`, keyed `Permission_<key with dots→underscores>_{Name,Description}` and
`BusinessRole_<roleKey>_{Name,Description}`. All **195** keys exist in **all five** files
(`en/es/fr/hi/gu`) — asserted by `TenancyLocalizationKeyTests`, which also fails if a locale is a
byte-copy of English.

### Seats (D3/D7)

Entitlement key **`team.seats`**, resolved through the existing
`EntitlementService.ResolveAsync(businessId)` / `GetLimitAsync(businessId, "team.seats")`.
`BillingCatalogDefinition.CatalogVersion` is **12** (two plans since 2026-10-04); values **Free 3 ·
Premium 50**, never unlimited. Entitlement row ids are `ent_{region}_{tier}_team.seats`.

Grandfathered seats are **three columns on `Business`** — `ExtraSeatsAllowed` · `ExtraSeatsGrantedAt` ·
`ExtraSeatsReason` (one fact per business ⇒ a column, not a table). **Deliberately NO expiry and no
auto-revoke** (D7): a downgrade never suspends anyone, it only blocks NEW invitations. Written by a
guarded `ExecuteUpdateAsync` (`WHERE ExtraSeatsAllowed IS NULL OR < @used`) so two concurrent
evaluations cannot let the smaller allowance win.

**Nothing enforces seats yet — Phase 2 owns enforcement at invite AND accept.**

### Open Page slug moved to the business

`FriendlyName`, `IsPubliclyListed`, `PublicListingUpdatedAt`, `PublicListingSequence` were **REMOVED
from `UserProfile`** and now live on `Business`. `UserFriendlyNameHistory` was dropped and replaced by
`BusinessFriendlyNameHistory` (L36). `PublicListingSequence` keeps its append-only registration-order
semantics — sitemap chunks are byte-stable only because a sequence is never reassigned.

`IAuthService` (business-keyed): `IsFriendlyNameAvailableAsync(name, excludeBusinessId)` ·
`GetBusinessByFriendlyNameAsync` · `GetBusinessByIdAsync` · `GetBusinessByRetiredFriendlyNameAsync` ·
`RetireFriendlyNameAsync(Business, retired, ct)` · `GetActiveOwnedBusinessAsync(userId, ct)`.
Store: `Clinqet.Infrastructure.Services.Tenancy.BusinessFriendlyNameHistoryStore`.

**Lowercase the PARAMETER, never the column** — `LOWER([FriendlyName])` is non-sargable and full-scans
`Business` on every inbound WhatsApp message and every provider-page render.

Re-pointed consumers: `ProviderListingProjectionService` (raw SQL now `UPDATE [Business]`) ·
`SitemapFeedService` · `ServicesSitemapService` · `ProviderFriendlyNameResolver` ·
`WhatsAppProviderLinkResolver` (returns a real `BusinessId`) ·
`ConversationService.ResolveFriendlyNamesAsync` · `BroadcastService.GetFriendlyNameAsync` ·
`UserProfileController` (all four slug endpoints).

> ‼️ **TRANSITIONAL, Phase 1 → Phase 3 (D12, owner-approved).** The four Identity slug endpoints keep
> their exact routes, DTOs and responses (partner web + partner mobile depend on them), and resolve the
> acting business from the caller's Active Owner membership via `GetActiveOwnedBusinessAsync`. **Phase 3
> replaces every call site with `TenantContext.BusinessId` and DELETES that method.** Oldest membership
> wins when a person owns several businesses, with a warning logged.

> `PublicProfileDto.UserNumber` now carries the **BusinessId** — `clinqetwebuserapp\lib\server\
> providerPageData.js` feeds it straight to the Main API's businessId-keyed public-profile route.
> L41: that anonymous endpoint no longer exposes the owner's personal name, photo, city or state.

### Testing this layer

**Integration tests are MANDATORY and must use REAL SQL Server** via Testcontainers
(`SeoSqlFixture`, collection `"Seo SQL"`, `DisableParallelization = true`; it migrates AND runs
`TenancyRoleCatalogSeeder`). EF InMemory can enforce **none** of a filtered unique index, a filtered
NOT NULL index, a `SEQUENCE`, or `rowversion` — an InMemory version of these tests would pass while the
database allowed duplicates.

Reference files: `BusinessTenancySqlTests` (30) · `BusinessIdAllocatorTests` (7) ·
`TenancyConventionTests` (24) · `TenancyLocalizationKeyTests` (11).
Give each test class its own `BusinessId` prefix (`T`/`H`/`R`/`S`/`G`/`P`) — the SQL fixture is shared,
so never assert a global count.

### Phase 1 deliberately did NOT do

Seat enforcement · the `AccessChangeQueue` dispatcher/queue/cache · the
`PrimaryOwnerMembershipId`-must-be-live guard · any token or claim change · any authorization check ·
any Cosmos entity or query change · any UI.

---

## PHASE 4 — ACTOR ATTRIBUTION, ASSIGNMENT, BRANCHES AND THE ACTIVITY FEED (2026-08-02)

**Additive only. Zero new containers, zero partition-key changes, zero composite-index rewrites.**

### The two new base classes — use them, never copy the fields

`clinqetcore\Entities\COSMOS\ProviderOwnedEntity.cs`:

| Class | Adds | Applied to |
|---|---|---|
| `ProviderOwnedEntity : BaseEntity` | `createdByUserId` · `createdByMembershipId` · `createdByActorType` · `updatedByUserId` · `updatedByMembershipId` · `updatedByActorType` | `Service` · `ServiceArea` · `Availability` · `License` · `Portfolios` · `Offer` · `BusinessCustomer` |
| `AssignableWorkEntity : ProviderOwnedEntity` | `assignedMembershipIds` · `assignedTeamIds` · `branchId` | `Booking` · `Quote` · `Invoice` · `BroadcastProvider` · `Conversation` |

Every field is `NullValueHandling.Ignore`, so an unassigned, unattributed document carries **no bytes**
for any of them. `createdByActorType` / `updatedByActorType` are `BusinessActorType`
(`Member` | `PlatformAdmin` | `System`), string-serialized by a type-level converter.

‼️ **NOT on `BaseEntity`** — customer-side and system documents have no membership, and six always-null
fields on every document in every container is storage and index cost for nothing.

Inline additions that are not on a base class: `ServiceArea.branchId`, `Availability.branchId`,
`Address.branchId`, `BroadcastProvider.matchedServiceAreaId`, and the six attribution fields on the
nested `ReviewReply` (a nested object has no repository, so `ReviewService` stamps it by hand — the ONLY
hand-stamp in the codebase).

### Attribution is stamped CENTRALLY — never at a call site

`CosmosDbRepository<T>` takes an **optional** `IActorAttributionAccessor` (Core, `Interfaces\Tenancy`)
and stamps in `AddItemAsync`, `UpdateItemAsync` and `UpsertItemAsync`. Twelve derived repositories
thread it through as an optional trailing constructor parameter; DI fills it where registered.

- Registered by `AddTenancyAuthorization()` — **Main API only**. In the Functions, MCP and seeding hosts
  it is absent, so nothing is stamped and the fields stay ABSENT. That is the correct record of
  "no human did this", not a gap.
- ‼️ **`UpdateItemAsync` takes `createdBy*` from the STORED document**, so historical attribution can
  never be rewritten — a member removed after creating a record keeps it.
- ‼️ **Targeted `PatchItemAsync` deliberately does NOT re-stamp `updatedBy*`** (decision L73). Patches
  are field-level system mutations on the hottest paths; the activity feed is the audit trail.

`ActorAttributionAccessor` resolves: live `TenantContext` ⇒ `Member` · authenticated platform admin
(claim `UserType=Admin` or role `Admin`) ⇒ `PlatformAdmin` with a **null MembershipId** (L28) ·
otherwise `ActorAttribution.None`.

### Branches — the Cosmos half

`05-BRANCHES.md` is the contract. In Cosmos:

- `ServiceArea.branchId` is the **entire** link between SQL branches and Cosmos geography.
- `null` means **the whole business**. It is never an error state, and untagged work is visible to
  everyone (`05-BRANCHES.md` §10).
- ‼️ **`Availability.branchId` is STORAGE ONLY** until Phase 6. The rule Phase 6 must implement:
  `effectiveHours(B) = rows WHERE branchId = B ELSE rows WHERE branchId IS NULL`.
  **ABSENT ROWS MEAN INHERIT, NEVER CLOSED** — an explicit `isAvailable = false` row is how a branch is
  shut, and confusing the two silently closes every branch nobody customised.
- ‼️ **Never add `branchId` to the Azure AI Search index.** Branch assignment is mutable; `serviceAreaId`
  is already indexed and is the stable fact.

**`IBranchResolver`** (`Clinqet.Infrastructure.Services.Tenancy.BranchResolver`) resolves at WRITE time:
supplied `serviceAreaId` → else match `serviceAddress` (zip, then city) → else `null`. It **never throws**
and never fails a booking. It caches the per-business area-to-branch map in `IMemoryCache` with
`Size = 1` and `Tenancy:Branch:AreaMapCacheSeconds` (default 300).
‼️ **Phase 6 MUST evict `branch:areamap:{businessId}` on any branch or service-area mutation.**

Registered by `AddBranchResolution()` in the Main API **and** the Functions host (lead matching).

### The business activity feed

`BusinessActivity` (`clinqetcore\Entities\COSMOS\BusinessActivity.cs`) — the one new document family,
in the **existing `ProviderData` container**, partition `/businessId`, id `act_{activityId}`.

- ‼️ **`occurredAt` IS `BaseEntity.createdAt`** — `ProviderData` already indexes `/createdAt`, so a
  second timestamp would be a second indexed path holding the same value (L75).
- ‼️ **`summaryKey` + `summaryArgs`, NEVER a rendered English sentence.** Keys are
  `BusinessActivity_{BusinessActivityType}` and a convention test fails the build if one is missing from
  any of `en/es/fr/hi/gu`.
- `ttl` from `Tenancy:Activity:RetentionDays` (90). The feed is append-only in one logical partition;
  without a TTL a busy business grows it toward the 20 GB ceiling.
- `IBusinessActivityRecorder.RecordAsync(...)` **never throws** — a feed append is a visibility side
  effect, and failing a booking over it would be the worse bug.
- Read: `GET /api/v1/business/activity` (`audit.read` at `Business` scope), keyset paged on an opaque
  base64 `createdAt|id` cursor, optional `activityType` filter.

### Index changes — and the discipline behind them

| Container | Added | Query it serves |
|---|---|---|
| `Transactions` | `/assignedMembershipIds/[]/?` · `/assignedTeamIds/[]/?` · `/branchId/?` | the four new `BookingRepository` queries |
| `Communications` | `/assignedMembershipIds/[]/?` | assigned + unassigned provider conversations |
| `ProviderData` | `/activityType/?` + composites `(type, createdAt DESC, id DESC)` and `(type, activityType, createdAt DESC, id DESC)` | the activity feed, unfiltered and filtered |

‼️ **`ARRAY_CONTAINS` can never sit in a composite index** — an array path must be an `IncludedPath`,
and the ORDER BY binds to the existing `(type[, status], scheduledStartUtc DESC)` /
`(type, lastMessageAt DESC)` pairs. **No new composite was needed on `Transactions` or `Communications`.**

‼️ **Paths were added ONLY where a query exists now** (L81). `ProviderData` deliberately does NOT index
`branchId` or the assignment arrays even though leads and service areas carry them: **the phase that
writes the query adds the path, in the same change.** Every indexed path costs write RU on every
document write, forever.

‼️ **Register every new repository in `CosmosCompositeIndexContractTests.RepositoryToContainer`** —
`EveryRepositoryFile_IsRegisteredInTheContainerMap` fails the build otherwise, and an unregistered
repository's multi-column `ORDER BY` queries are never validated.

### New repository queries — all single-partition

| Method | Repository | Notes |
|---|---|---|
| `GetAssignedToMembershipAsync(businessId, membershipId, status?)` | `IBookingRepository` | `ARRAY_CONTAINS` |
| `GetAssignedToTeamAsync(businessId, teamId, status?)` | `IBookingRepository` | `ARRAY_CONTAINS` |
| `GetByBranchesAsync(businessId, branchIds, status?)` | `IBookingRepository` | **always includes untagged work** |
| — the three above are bounded by `SELECT TOP` (default `CosmosDb:MaxItemCount`, optional `maxItems`) — | | a business partition holds years of bookings; Phase 6 replaces the bound with a continuation token (L84) |
| `GetAssignedMembershipIdsForCustomerAsync(businessId, customerId)` | `IBookingRepository` | G2 contractor scope; `customer.customerId` deliberately unindexed |
| `GetUnassignedForBusinessAsync(businessId)` | `IConversationRepository` | absent array **and** empty array |
| `GetAssignedToMembershipAsync(businessId, membershipId)` | `IConversationRepository` | |
| `AddAsync` / `GetFeedAsync` | `IBusinessActivityRepository` | keyset |

‼️ **Null vs empty array is the classic silent bug here.** `ARRAY_CONTAINS` is false for both, and the
unassigned query tests `NOT IS_DEFINED(...) OR ARRAY_LENGTH(...) = 0`. Integration tests pin both shapes.

### D3 quota guarantee — proved, not assumed

`AiUsageCounter.pk`, `LeadUsageCounter.pk`, the WhatsApp send cap and `MinuteLedger.BusinessId` are all
keyed on the **business**. `CosmosTenancyIntegrationTests` proves two members of one business share one
counter, one person in two businesses increments two independent counters, and 20 concurrent atomic
PATCH increments lose nothing.

### Phase 4 deliberately did NOT do

Any assignment WRITE API (Phase 6) · the per-branch availability resolver, search union or UI (Phase 6) ·
branch CRUD (Phase 6) · the provider-side `Conversation` re-key onto `BusinessId` (Phase 6) ·
lead-received activity rows (Phase 5) · the `serviceAreaId` client plumbing on booking create (Phase 8) ·
any UI at all.

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

- **Five views** (plus the Overdue filter), all single-partition: Unassigned / Assigned to me / My team / Watching / All. ‼️ `Overdue`
  (`ProviderInboxView.Overdue`) is a FILTER across those five, served by `GetOverdueForBusinessAsync`, never by keyset.
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

## ‼️ `Communications` GAINED `/slaDueAt/?` — Phase 8B1, 2026-08-03

`Conversation.slaDueAt` (`DateTime?`, `NullValueHandling.Ignore`, `[System.Text.Json.JsonIgnore]`) plus one
`IncludedPath` on `Communications`. **Owner-approved in session.** The `Communications` policy now carries
**15 `IncludedPath`s and 12 composites** — `/slaDueAt/?` was the fifteenth, and it appears in **no composite**. ‼️ Count the method BODY (lines 413-529), not what fits on one screen: the policy is longer than it looks because Notification documents share this container.

‼️ **NO composite index was added, deliberately.** The overdue set is small and bounded, so
`BuildOverdueQuery` carries **no `ORDER BY`** and `ProviderInboxService` sorts in memory. **Do not add
`(slaDueAt, …)` as a "small optimisation"** — it would be permanent write RU on the platform's hottest
container for a query that does not need it.

The field is present **only while a customer is waiting** and is removed the moment the business replies, so an
answered conversation carries **no property, no index entry and no RU**. That free-until-used shape is the cost
basis the owner accepted — anything that writes a JSON `null` there (e.g. `PatchOperation.Set(path, null)`)
breaks it, because a null still occupies an index entry.

`Conversation.priority` still does **NOT** exist: no reader, and the approved mockup deliberately did not
design one.

### `InboxTabProjection` — the pattern for a cheap aggregate

`clinqetcore\Interfaces\COSMOS\InboxTabProjection.cs` is a Newtonsoft-attributed projection type used by
`GetInboxTabProjectionAsync`. It selects **10 small fields** (the assignment arrays, watchers, `slaDueAt`,
`isMuted`, `status`, `context`, `branchId`, `createdByMembershipId`) rather than whole documents, so one
single-partition query produces all six inbox tab counts at roughly a tenth of the RU. **Reach for this shape
whenever a screen needs counts over a partition** — it is much cheaper than N `COUNT` queries and cheaper than
reading the documents.

### `Conversation` write-path invariant

‼️ `IConversationRepository.UpdateSummaryAsync` **must never** stamp `slaDueAt` or `firstReplyAt`. The documents
it returns are the only source of pre-message state, and the SLA clock is derived from them. Its former
`stampFirstReply` parameter was removed — it never fired in production. See the `clinqet-messaging` skill.

---

## ‼️ MULTI-USER TENANCY — PHASE 9 (2026-08-04). The final Cosmos/SQL inventory, and a partition-key hole.

> **The whole model is now one skill: read `clinqet-provider-teams` before any tenancy change.**

### ‼️ PHASE 9 ADDED NO SCHEMA OF ANY KIND

No Cosmos container, field, `IncludedPath`, composite or TTL. No SQL table, column, index or migration.
No search-index field. `Cosmos.cs` and `CosmosContainerPolicies.cs` were **not opened** for a schema
change. The programme is now schema-complete.

### ‼️‼️ A CLIENT-SUPPLIED PARTITION KEY — the hole this phase closed

`CreateInvoiceRequestDto` carried a `[Required] BusinessId` on the request **BODY**, and
`InvoiceService` passed it straight into `GetByBusinessIdAsync(dto.BusinessId, …)` **as the Cosmos
partition key**, while `InvoiceMappingExtensions` stamped `BusinessId = dto.BusinessId` onto the document.
**A member of Business A could write an invoice into Business B's `Transactions` partition.**

‼️ **The lesson for this skill, and it generalises to all 52 repositories: a `partitionKey` argument is
only a tenant boundary if the VALUE is trusted.** Every repository method already takes an explicit
partition key — that is structurally correct — but it cannot tell a token-derived value from a
body-derived one. **Trace where the value came from, not just that one was passed.**

The field is now deleted and the workspace is threaded from the signed token.
`ProviderEndpointAuthorizationTests.NoProviderEndpointAcceptsABodyThatAssertsABusinessId` fails the build
on any settable `BusinessId` in a provider-gated body DTO.

‼️ **`InvoiceServiceTests` now asserts `Assert.Equal(TestBusinessId, result.BusinessId)` where it
previously asserted `dto.BusinessId`.** That is a **STRENGTHENING**: the old assertion compared the result
against the attacker-controllable input and would have passed with the hole wide open.

### The final tenancy index inventory — every path serves a query that shipped with it (L81)

| Container | Tenancy paths added, across the whole programme |
|---|---|
| `Transactions` | `/assignedMembershipIds/[]/?` · `/assignedTeamIds/[]/?` · `/branchId/?` |
| `Communications` | `/assignedMembershipIds/[]/?` · `/assignedTeamIds/[]/?` · `/watcherMembershipIds/[]/?` · `/slaDueAt/?` |
| `ProviderData` | `/activityType/?` + composites `(type, createdAt DESC, id DESC)` and `(type, activityType, createdAt DESC, id DESC)` |

‼️ **No composite was added to `Transactions` or `Communications`** — `ARRAY_CONTAINS` can **never** sit in
a composite, and the existing `(type[, status], scheduledStartUtc DESC)` and `(type, lastMessageAt DESC)`
pairs serve the sorts.

‼️ **`ProviderData` deliberately gains NO assignment or branch paths** (L81 / L105 / L108). Leads
(`BroadcastProvider`) and `ServiceArea` carry `branchId` but nothing queries it; the removal workflow's
"open leads held by the leaver" and team-delete cleanup are rare operations over a status-bounded set,
served by an existing indexed query plus an in-memory filter at **zero permanent write-RU cost.**
**Lead / quote / invoice assignment WRITES are deferred to the phase that builds their screens, and that
phase adds the path in the same change.**

‼️ **`Availability` has no `/branchId` `IncludedPath` and needs none** — the provider availability route
filters **in memory** through `BranchAvailabilityResolver.EffectiveHours` over a partition read that
already happened. Nothing ever queries by it.

‼️ **The search index gained NO branch field** — `grep` for `branchId`/`BranchId` in `SearchDocument.cs`
returns **ZERO**. `05-BRANCHES` §6.3 forbids it because `branchId` is **mutable**: moving one area between
branches would reindex every service touching it.

### `ToDictionary` over a partition is a latent 500 wherever a nullable discriminator exists (CP7)

`GET /business/availability` keyed the raw partition by `DayOfWeek` alone. The partition holds **one row
per day PER LOCATION**, so `ToDictionary` threw `ArgumentException` — **a 500 on the provider's own
opening-hours screen, the moment any location overrode.** Resolving through `EffectiveHours` first fixes
it structurally; grouping defensively without resolving would have hidden which row won.

Two of the same class in the same file: `POST /business/availability/copy` resolved its source with
`FirstOrDefault()` across the day and could have copied a **location's** hours into the business default
(it has **no** frontend caller in either provider app, and is fixed anyway), and
`GetAvailabilityForDayAsync` remains branch-blind and is now called by nothing on that path.

### Attribution, assignment and the activity feed — the shape, restated

`ProviderOwnedEntity : BaseEntity` carries the six attribution fields;
`AssignableWorkEntity : ProviderOwnedEntity` adds `assignedMembershipIds` / `assignedTeamIds` /
`branchId`. **All `NullValueHandling.Ignore`**, so an unassigned document does not carry the property at
all — **zero bytes, zero index entries, zero RU until the feature is used.** That is what makes the whole
assignment design free, and it is why `watcherMembershipIds` was cheap but `slaDueAt` (stamped on EVERY
waiting conversation) needed its own owner approval.

‼️ **All nine of those fields carry `[System.Text.Json.JsonIgnore]`**, so the API serializer never emits
them while Cosmos still persists them through Newtonsoft. Verified: the Cosmos client uses
`SerializerOptions`, **not** a custom `Serializer`, so the SDK's Newtonsoft path is in force. Without this
a customer would have seen `assignedMembershipIds` and `branchId` on their own booking, because
`GetBookingByNumber` and `GetQuoteByNumber` return the **RAW entity** — to the customer too.

‼️ **`UpdateItemAsync` carries `createdBy*` FORWARD from the STORED document**, so historical attribution
can never be rewritten. **Targeted `PatchItemAsync` deliberately does NOT re-stamp `updatedBy*`** (L73) —
patches are field-level system mutations on the hottest write paths, and the activity feed already records
who changed what at business level. **Consequence, stated plainly: a status flip applied by patch leaves
`updatedBy*` showing the last full write.**

‼️ **`BusinessActivity`'s `occurredAt` IS `BaseEntity.createdAt`** (L75) — `ProviderData` already indexes
`/createdAt`, so a second timestamp would be a second indexed path holding the same value.

‼️ **Only the Main API registers `AddBusinessActivityFeed()`.** Neither the Functions host nor MCP does, so
**no caller-less host writes a feed row** and `BusinessActorType.System` is currently **unreachable in the
feed**. Wiring it into the voice host is the switch — and a **cost decision** (one write per event per
business).

### The three SQL index traps, for the record

1. ‼️ **EF Core keys `HasIndex(properties)` on the PROPERTY SET, not the name** — a second declaration
   **RENAMES** the first rather than adding an index (L39).
2. ‼️ **EF's FK-index convention silently DROPS the conventional index** when you declare a composite
   leading with the FK column. **Read the generated migration** — that is the only place it is visible (L52).
3. ‼️ **`Business` gets NO global query filter** (L43) — a filter would hide a suspended business from the
   seat count, the admin portal and the WhatsApp router.

Plus: ‼️ **`cosmosindexsetup` carries a SHADOW EF model** (`DataSeeding\SeedDbContext.cs`) mapped to the
same tables and **does not reference `clinqetinfrastructure`**, so schema drift there **does not fail to
compile.** And ‼️ **never pass `--no-build` to `dotnet ef`** — it reads a stale model AND a stale migration
list, and has produced an empty migration and deleted the wrong one.

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

## PHASE 10 PART 2 — the data/schema/persistence audit closed (2026-08-05)

> Phase 10 is **DONE**. Tree green at **13,842 / 0 / 0**. Schema added: **one** owner-approved Cosmos composite
> and nothing else. Full record: `member-provider/PROGRESS.md` → *PHASE 10 PART 2*; decisions **DA7–DA12**.

### ‼️‼️ A `BusinessId` CAN NEVER EQUAL A `UserNumber` — and a build-failing guard now enforces it

**D1** makes them disjoint by construction: six characters versus five, allocated from one shared namespace. So
`u.UserNumber == businessId` is **never** true — and it fails in the quiet direction, "not found".

**Four production sites asked it anyway**, all in the payments surface. The worst was
`AdminProviderPayoutsController.BusinessExistsAsync`, where it was **not a fallback but the only check**, so
Clinket support looking up any tenancy-path provider without a payout account was told **"No business found for
that ID"** — false, on a money question. Its own comment asserted the dead invariant as fact.

- ✅ The tenant is the SQL **`Business`** row. Resolve existence from `db.Businesses`, never from `Users`.
  `Business` has **no** global query filter (**L43**), so a suspended or closed business still resolves — which
  is what an admin lookup needs.
- ‼️ **The guard:** `Clinqet.API.UnitTests.Conventions.NoCodeResolvesAPersonFromABusinessIdTests` fails the build
  on the comparison in either direction, across all seven production projects. **Fix the call site, never the
  test.** One named exemption exists (`BroadcastMatchingService`, deferred to Phase 11) and it is pinned to its
  own defect, so it cannot outlive it.
- ‼️ **How it hid:** both fixtures seeded a `UserProfile` whose `UserNumber` WAS the businessId, so the two
  identifiers could not diverge. **Casebook CASE 1 / CASE 23.**

### ‼️ The provider inbox is KEYSET-paged — never add an offset page here

`GET /business/inbox` takes **`continuationToken`**, not `page`. `InboxPageDto` carries `NextCursor` and the six
tab counts, and **no** `TotalCount` / `Page` / `PageSize`.

- `IConversationRepository.GetInboxPageAsync(businessId, InboxPageQuery)` → `ConversationKeysetPage(Items, NextCursor)`.
- SQL: `SELECT TOP n * FROM c WHERE … ORDER BY c.type, c.lastMessageAt DESC, c.id DESC`, cursor
  `(c.lastMessageAt < @cursorAt OR (c.lastMessageAt = @cursorAt AND c.id < @cursorId))`.
- ‼️ **Why the `/id` tiebreaker exists:** `(type, lastMessageAt DESC)` alone cannot separate two conversations
  written in the same tick, so a cursor repeats or skips them — **and the sort would not bind in production**
  even though the emulator permits it (L12). The composite `(type ASC, lastMessageAt DESC, id DESC)` on
  `Communications` is owner-approved (**DA5**) and is the ONLY schema Part 2 added.
- ‼️ **Why not `OFFSET`:** Cosmos charges RU for the documents an offset skips, so offset paging is
  O(page depth). `SELECT TOP (page × pageSize)` was proposed, rejected and must not return.
- ‼️ **The query NARROWS; `IResourceScopeEvaluator` DECIDES** (DA8). Only `Assigned` and `Team` become SQL
  predicates because only those paths are indexed. `Branch` / `CreatedByMe` / `Participating` get **no** query
  narrowing and are decided entirely by the evaluator, with a bounded top-up loop refilling the page.
  **Never move an access decision into the query.**
- **Overdue is unchanged** (B8): a bounded read, sorted in memory, sliced by its own `(slaDueAt, id)` cursor.
  `GetInboxTabProjectionAsync` is still a full-partition read, by the owner's explicit choice.
- Cursor encoding lives once, in `Clinqet.Infrastructure.Data.COSMOS.Base.KeysetCursor` —
  `BusinessActivityRepository` delegates to it. **Do not write a second encoder.**
- A stale or mangled cursor is **400 + `invalid_continuation_token`**, never a silent ignore (AD8).

### ‼️ The composite-index guard is now self-verifying — trust it, but know what it checks

`CosmosCompositeIndexContractTests` had drifted: **five of 53 repositories were validated against the wrong
container's index policy** (`AiSession`, `BroadcastDispatch`, `Broadcast` are **`Communications`**; `Cart` and
`RecentlyViewed` are **`SystemData`**). Three changes:

1. `TheContainerMap_MatchesTheContainerEachRepositoryActuallyResolves` derives each container from the repository
   source and fails on divergence — the hand map can no longer drift silently.
2. `EverySingleColumnOrderByQuery_HasMatchingCompositeIndex` — ‼️ **`TypeFilterSql` puts `c.type = 'X'` on every
   repository query, so a ONE-column sort still needs a `(type, sortColumn)` composite.** 27 queries validated.
3. Line comments are blanked before scanning: writing the words of a sort clause in a comment between two string
   literals was being parsed as SQL.

> ‼️ **The lesson that cost the most: a wrong guard does not merely fail to catch bugs — it PROPOSES them.**
> Acting on the mis-mapped result, the audit first deleted a correctly-indexed sort from `AiSessionRepository`.
> **Verify the guard before you change the code it accuses.**

### ‼️ OPEN — owner decisions, NOT unfinished work. Do not "fix" either unilaterally

- **`BusinessStatus.Suspended` and `.Closed` are UNREACHABLE.** `Business.Status` is written in exactly one
  place (`BusinessProvisioningService:130`, `Active`, at creation). **D9's entire billing-only regime reads a
  state nothing produces.** The admin "suspend provider" action sets `BusinessProfileStatus.Suspended` on the
  **Cosmos** profile (marketplace visibility) and never touches SQL `Business.Status` (tenancy access) — and its
  own guard leaves outstanding bookings live, which argues they are deliberately separate axes.
- **Five indexed paths serve no query** (four of them array paths, costing one index entry per element on every
  write, forever): `ProviderData` `/serviceImages/[]/imageId`, `/images/[]/imageId`, `/documents/[]/documentId`,
  `/pricing/priceType`; `Reviews` `/images/[]/imageId`; `Messages` `/attachments/[]/attachmentId`. The nested-id
  lookups are done **in memory** by `PatchStableArrayItemByIdAsync`. Removing an `IncludedPath` is RULE ZERO.

### Two sweep techniques worth reusing

- ‼️ **A C#-property orphan scan LIES about Cosmos.** Any field written by `PatchOperation.Set("/jsonPath", …)`
  looks orphaned. Scan for the **JSON name too** — it moved this sweep's result from 18 false hits to 14 real ones.
- ‼️ **Widening a race is not fixing it.** A banner test gave an offer 2 seconds of life and slept it out; a
  loaded full-suite build outlasts 2 seconds, so it failed intermittently — and its own comment recorded that the
  window had already been widened once, from 120 ms. **Remove the elapsed time, do not lengthen it.**

### ‼️ ADDENDUM 2026-08-05 — four nested-media index paths REMOVED, and one that LOOKED identical was KEPT

Owner-approved (**DA13**). Deleted from `CosmosContainerPolicies`: `ProviderData` `/serviceImages/[]/imageId/?`,
`/images/[]/imageId/?`, `/documents/[]/documentId/?`; `Reviews` `/images/[]/imageId/?`; `Messages`
`/attachments/[]/attachmentId/?`. An **array** path costs one index entry **per element** on every parent write,
forever — and every one of these served a lookup `PatchStableArrayItemByIdAsync` performs **in memory**.

‼️ **`/pricing/priceType/?` was in the same finding and is KEPT.** `ServiceRepository.GetServicesByPricingTypeAsync`
queries it through a **LINQ predicate**, which the Cosmos provider turns into `WHERE c.pricing.priceType` at
runtime — **an expression tree names no path in any string**, so the literal-SQL sweep that produced the finding
could not see it. Removing it would have demoted a live query to a partition scan.

> ‼️ **THE RULE: before deleting an index because "nothing queries it", enumerate every way a query can be
> EXPRESSED here — literal `QueryDefinition`, `GetItemsByLinqAsync` (expression tree),
> `GetFilteredItemsAsync(whereClause:)`, and server-side scripts (none exist). Treat an expression tree as a
> query.** And note which failure you are risking: an unindexed **filter** degrades to a scan, but an unindexed
> **sort** is a hard **400** — so the `ORDER BY` check must be exhaustive.

Guard: `Clinqet.API.UnitTests.Repositories.NestedMediaIdPathsAreNotIndexedTests` — it asserts the four are
absent from `IncludedPaths` **and** every composite, and carries the `priceType` counter-example beside them.
Deployment: `cosmosindexsetup` applies the policy via `ReplaceContainerAsync`, so a re-run updates the live
index online — ‼️ pass `--launch-profile`; the tool ignores the shell `CLINKET_REGION`.


---

## ‼️ P1.5 (2026-09-03) — `scripts` ON BOTH SEARCH INDEXES, AND THE ADDITIVE-ONLY RULE

**`scripts`** — `Collection(Edm.String)`, `IsFilterable = true, IsFacetable = true` — added to BOTH
`KnowledgeSearchDocument` **and** `ServiceSearchDocument`. §0.7 approved 2026-09-02. Deployed to both
regions 2026-09-03 and verified against the engine (CA 744/821 docs, IN 99/126, **nothing lost**).

**`KnowledgeSearchDocument.language` was DELETED from the model.** It is still present in the LIVE knowledge
index, unwritten and harmless, until the owner recreates that index.

### ‼️ THE TRAP THAT COST A DEPLOY

Azure **refuses an index update that DROPS a field**:

```
OperationNotAllowed — Existing field(s) 'language' cannot be deleted.
```

The whole update fails — **including the fields it was adding**. Removing `language` therefore blocked
`scripts` from reaching either region, by anyone.

**`KnowledgeSearchIndexInitializer.PreserveLiveOnlyFieldsAsync` now reads the live index and carries forward
any field the model no longer declares**, making `CreateOrUpdateIndex` **additive only**. Never remove that
guard: it is also what stops the **customer-facing services index** being silently shrunk.

### The rules that still hold

- ‼️ **`ServiceSearchDocument` is the CUSTOMER-FACING marketplace index.** Add only. **Never** rebuild it,
  never reorder it, never delete it.
- Adding a field needs **no** rebuild; deleting or renaming one does.
- ‼️ `cosmosindexsetup` **ignores the shell's `CLINKET_REGION`** — always `--launch-profile`, and use
  `--search-only` unless you intend Cosmos container init and sample-data seeding too.
- **Verify against the ENGINE**, never the tool's "created or updated successfully".
- ‼️ Exception on record: the 2026-09-29 fan-out changes the provider index KEY and adds
  attributes to existing fields — neither can be applied as an update, so the PUBLIC indexes are deleted and rebuilt
  by the owner (`Data/search-topology/findings/PROGRAMME-BUILD-STATE.md` §3a). Never by a session. See the last
  section of this skill.

### ‼️ Second pass — a guard that PASSED its sabotage, and what it teaches

`RecalculateAndPatchAverageRating` was the only repair path for a drifted rating aggregate, and it **did not
repair**: it re-derived the average FROM the stored distribution, but a lost increment lives IN that
distribution, so the "repair" re-published the drift. It now rebuilds the distribution from the REVIEWS
(`GetReviewRatingDistributionAsync`) and patches `/ratingDistribution` too. It also had **zero call sites** —
now `POST /api/v1/admin/reviews/{businessId}/rating/rebuild`.

‼️ **Its first guard asserted the patch OP COUNT — and passed its sabotage.** Rebuilding from the reviews and
re-deriving from the stored distribution both emit the same five operations, so the count could never tell
them apart. Rewritten to assert the VALUES (average 4.5, total 4, distribution `{5:3, 3:1}`), it went RED on
exactly the right test. **Ask of every guard: what differs between pass and fail, and does my assertion touch
THAT?**

Three more of the same family, all fixed:

- ‼️ **A partial-field CAS can create an internally contradictory document.** Copying an issuance snapshot onto
  a fresh invoice without the selection it was built from let an issued invoice **print one payment method and
  store another** — permanently, because the selection freezes once a snapshot exists. **Carry every field the
  copied one depends on.**
- **A survey's site list is not the reachable set.** `LicenseController.ConfirmDocumentUploads` is the same
  append-after-upload shape as four converted sites and was missed because the 136-site census never listed
  it. **After a class-wide conversion, grep the SHAPE, not the census.**
- **Fix a lost HTTP status at the seam, not the call site.** Partner web's two 412 branches were dead because
  the service layer threw the response body and `ApiResponse.StatusCode` is `[JsonIgnore]`d. The status is now
  attached where the body is thrown — which is what the mobile app already did.

## 2026-09-23 — explicit SQL/catalog setup for new environments

`cosmosindexsetup` now references the shared Infrastructure library and runs pending EF migrations,
then the existing `BillingCatalogSeeder`, then verifies the catalog version and all six catalog families
before normal Cosmos/Search setup. `--all-regions` visits ca then in; `--sql-only` limits the run to SQL.
Search/synonym-only and service-description migration modes do not run SQL schema migrations or billing seeding.
The setup tool uses `ConnectionStrings:IdentityDb`; the APIs keep `ConnectionStrings:DefaultConnection`.
Regional `Payments:Regions` is ca=[us,ca], in=[in], with no base list. `SeedData:Enabled=false` does not disable
required billing seeding. The automation's setup paste block is nested JSON, includes Environment and
Payments.Regions, and uses the same stamp region list as the API's existing environment variables.

API startup behavior is unchanged: one seed attempt per process start, errors logged, next start retries.
A migration applied while the API is already running does not trigger the startup task again. Prefer setup
before application traffic; otherwise restart the API after migrations or run setup with `--sql-only`.
Existing migrations are never regenerated or edited. Same-version admin catalog edits survive reruns;
older versions use the existing release and price-notice rules. Environment/database mismatch and two
stamps resolving to one SQL target are refused before writes. See the setup project's
SQL Server Testcontainers tests, including failed startup -> migrate -> restarted seed task -> success.

## SEARCH-TOPOLOGY PHASE 3 — data facts (2026-09-22/24)

- **Offer soft delete (B-12, owner-approved schema item)**: `Offer.IsDeleted` + `Offer.Ttl`
  (`CosmosDb:OfferDeleteTtlDays`, 7) — the ServiceArea pattern, in the same `ProviderData` container
  (`DefaultTimeToLive = -1`, `/isDeleted/?` indexed). The replace IS the change-feed event that removes the offer
  from search. `OfferRepository.DeleteOfferAsync` answers false for a missing OR already-deleted offer (the
  controller's 404, exactly as the hard delete did); every read filters `NOT IS_DEFINED(c.isDeleted) OR
  c.isDeleted = false` (or in memory — a LINQ `IsDeleted != true` is UNDEFINED for a live row). Proven on the
  emulator (`OfferControllerTests.DeleteOffer_IsSoft_…`).
- **`BusinessProfile.firstPublishedAt` (D-64) is WRITE-ONCE by a patch CONDITION** —
  `FROM c WHERE NOT IS_DEFINED(c.firstPublishedAt) OR IS_NULL(c.firstPublishedAt)`; a refused condition is 412 →
  `PatchItemAsync` returns null → false. Concurrent writers: exactly one wins (emulator-proven,
  `FirstPublishedAtWriteOnceIntegrationTests`).
- **Strict country everywhere a country is WRITTEN**: `CountryCodeHelper.TryParseStrict` (ISO-2 or the canonical
  English name, case-insensitive). Service areas and business addresses store the English name; a quote's
  `location.country` stores the ISO code. Legacy rows holding a localized or non-canonical country ("USA",
  "ભારત") make the search indexers FAIL LOUD until re-saved (pre-prod, no backfill).
- **New enum value** `AdminAlertType.OfferExpirySweepIncomplete` (appended; keep `AlertsPage.jsx` in sync — it is
  now 148/148 with the enum).

## P4-38 — `TryPatchItemAsync` / `PatchResult<T>`, and three patch facts (2026-09-27)

- `ICosmosDbRepository.TryPatchItemAsync(id, pk, ops, ifMatchEtag?, conditionExpression?)` returns
  `PatchResult<T>` — `Outcome` ∈ { `Patched`, `NotFound`, `PreconditionFailed` } plus the stored `Document`.
  `PatchItemAsync` keeps its contract (the document, else null) and is now a wrapper. Use `TryPatchItemAsync`
  wherever "gone" and "someone else changed it" need different answers (`BroadcastService` update/cancel/award/
  conversion, `BroadcastProviderRepository.UpdateBidSummaryAsync`, `ServiceRepository.SetActiveAsync`).
- ‼️ **A retry's 412 may be our own landed write** (the first answer lost on the wire). For Set/Replace/Remove-only
  patches the repository re-reads the raw document and compares every value (serialized by `ClinqetCosmosSerializer`,
  `JsonElement.DeepEquals`); if they all hold it reports `Patched`. An identical concurrent write is
  indistinguishable and harmless — the store holds exactly what was asked. Increment/Add/Move are never retried, so the
  question never arises for them.
- ‼️ **The vnext emulator rejects a BOOLEAN in a patch filter predicate** (`FROM c WHERE c.isDeleted = false` ⇒ HTTP 500,
  PGCosmosError "No operator matches"), like it rejects a nested path. Guard with the read's ETag instead (D-82's pause
  does, with a bounded fresh-read retry) — a predicate the integration suite cannot run is a predicate never proven.
- **Person-initiated patches stamp `updatedBy*`** via the base `UpdatedByPatchOperations()` (empty with no actor, so a
  system patch claims nobody): the pause, and the quote / lead / conversation assignment and claim patches.
  `BookingRepository` and `InvoiceRepository` `SetAssignmentAsync` need the same one line (owned by the money lane).
  Test: `AssignmentPatchAttributionTests`.

## D-92 / D-108 — OFFER USES AND RECORD NUMBERS IN `Transactions` (2026-09-28)

- **Three document families joined `Transactions` (`/businessId`)**: `OfferUsage` (id `offerusage:{offerId}` — the
  running count plus a copy of the offer's limits), `OfferRedemption` (id
  `offerredemption:{offerId}:{holderType}:{holderId}` — "this record holds one use, worth N"), and `NumberSequence`
  (id `numberseq_{kind}_{period}`). The Offer document itself MOVED here from `ProviderData`; the old ProviderData
  offer documents are orphaned and are NOT deleted (owner: no migration, no delete).
- ‼️ **The ids are deterministic on purpose**: a retried take is refused as a duplicate and a retried give-back finds
  nothing, so neither can count twice. A redelivered write CONFLICTS, it does not duplicate.
- **D-108 numbering**: `BK-000123`, `QT-000045`, `INV-{FY}-000012` (FY `2026` Jan–Dec, `2627` for India's
  Apr–Mar), at least 6 digits, an invoice number at most 16 characters. The next number is taken by REPLACING the
  sequence document under its ETag in the SAME `TransactionalBatch` as the record create — so a number is never given
  twice and a failed create burns none. A 409 on the record is a replay: it returns the existing record and consumes
  nothing. Only ISSUED invoices are numbered; a draft carries `invoiceNumber = null`.
- ‼️ **Numbers repeat across businesses**, so every lookup by number is scoped to one business or asks which one.
- **Measured on the emulator (vnext-EN20260130) and on real Cosmos**: the emulator IGNORES `IfMatch` inside a batch and
  does NOT roll a failed batch back — a stale replace answered batch=200 with ops [201,200,204] and was APPLIED. Real
  Cosmos honours all four guarantees. Batch atomicity is therefore proven ONLY by the sandbox suites
  (`TransactionalBatchSandboxTests`, `RecordNumberingSandboxTests`), which skip loudly when the sandbox is not
  configured and must never be moved back to the emulator suite.
- **Container policy** (`CosmosContainerPolicies`): ProviderData dropped `/startDate/?`, `/endDate/?`,
  `/discountType/?`; Transactions gained `/offerId/?`, `/isActive/?`, `/startDate/?`, `/endDate/?`. A filter on a
  path with no explicit include does NOT fail on real Cosmos — it costs a scan inside the partition.

## SCORING + SEARCH FAN-OUT — data changes (D5/D7/D11/D14/D19, §13.2; built 2026-09-29, uncommitted)

‼️ **No container, partition key or Cosmos index-policy change.** `CosmosContainerPolicies` is untouched; every new
query binds an existing composite. New fields (JSON names from the attributes):

| Entity (container, pk) | Field | Shape |
|---|---|---|
| `BusinessProfile` (ProviderData, `/businessId`) | `acceptanceScore` | `int?`, Ignore-null. Nightly, penalty only (D12) |
| `BusinessProfile` | `responseScoreOverride` · `reliabilityScoreOverride` · `acceptanceScoreOverride` · `overrideExpiresAt` · `overrideReason` | ‼️ EXACTLY the five FLAT fields owner-approved in FAN-OUT-FINAL-DESIGN §12.5: three `int?` 0–100, `DateTime?` (null with an override = no expiry), `string?` (required whenever any override is set). Each Ignore-null + `[System.Text.Json.JsonIgnore]` — never sent to a provider. NO who/when on the profile: that lives only in the audit alert. Read as one value through the in-memory record `Clinqet.Core.Models.Business.ProviderScoreOverride` (`Of(profile)`, `IsLive`, `Same` — expiry compared to the millisecond) — never stored in that shape |
| `Booking` (Transactions, `/businessId`) | `providerCancelReason` | `ProviderCancelReason?` string enum: `CustomerAsked` · `CouldNotDoIt` · `EnteredByMistake` |
| `Conversation` (Communications, `/userNumber`) | `replyCycles` | `List<ReplyCycle>?` `{ wroteAt, answeredAt? }`, business side only — see `clinqet-messaging` REPLY CYCLES |
| `BusinessRating` + nested `ServiceRating` (Reviews, `/businessId`) | `ratingByMonth` | `Dictionary<string, Dictionary<string,int>>` = `new()` (always written): `"yyyy-MM"` → star → count, months past `Search:RatingSort:RatingBucketMonths` (24) folded into `"yyyy"` — see `clinqet-reviews` |

**The override is five PROPERTIES on the BusinessProfile document** (id = `businessId`), not a document of its own: no
id shape, no TTL. `EffectiveProviderScores.For(profile, now)` is the one reader (both indexers) — a live override
REPLACES the computed score, an expired one is ignored. Writes go through `ProviderScoreOverrideService` (admin
set/clear with an `expected` override ⇒ `Stale` when the stored one differs per `ProviderScoreOverride.Same`; the lapse
via `ExpireIfLapsedAsync`, called only by `ProviderScoreRefreshService` — on every rescore, and by the exact-minute
expiry message (`ExpireOverrideAsync`) the save schedules; post-ranking W11/W13, 2026-10-01),
each audited as an `AdminAlert` `ProviderScoreOverrideChanged`
in SystemData (pk = `alertDate` `yyyy-MM` of the WRITE) with a deterministic id
`scoreoverride_{businessId}_{action}_{stampTicks}` (the lapse keys on `overrideExpiresAt` and point-reads the months
since it before writing, so a retry never duplicates), `CancellationToken.None`, and
`ttl = DocumentTtl:ProviderScoreOverrideAuditTtlDays` (183 in API + Functions appsettings; key and code default are the
consts `ProviderScoreOverrideSettings.AuditTtlDaysKey` / `DefaultAuditTtlDays`). The lapse writes its record BEFORE
clearing; mark-read and resolve re-pin that alert's ttl to creation + 183 days (`clinqet-notifications`). Screen limits:
`ProviderScoreOverride:DefaultExpiryDays` 90 (clamped to the max) / `MaxExpiryDays` 365 (Main API).

**`providerCancelReason` rules** (`BookingValidationService.ValidateProviderCancelReason`): REQUIRED when a Business
cancels a booking it confirmed (`ConfirmedByProvider`); refused otherwise (`Error_ProviderCancelReasonNotAllowed`),
and `EnteredByMistake` only when the booking's `createdBy` is Business. Only `CouldNotDoIt` (or null) counts as a
reliability failure (`ProviderScoreEvaluator`).

### Repository methods — every one single-partition

| Method | Partition | Shape |
|---|---|---|
| `IBookingRepository.GetOutcomeRowsTouchedAsync(businessId, from, until?, maxRows?)` | `/businessId` | Projection `BookingOutcomeRow` (+ `cancelledAt`, `scheduledStartUtc`, `providerCancelReason`); `[TOP n] … WHERE type AND c.updatedAt >= @from [AND < @until] ORDER BY c.updatedAt DESC` — binds `(type ASC, updatedAt DESC)`. REPLACED `GetOutcomeRowsByBusinessIdSinceAsync` (bounded on `createdAt`, N9) |
| `IBusinessProfileRepository.TrySetProviderScoresAsync(…, acceptanceScore, …)` | `/businessId` | gained `/acceptanceScore`; still field-scoped, no ETag |
| `IBusinessProfileRepository.TrySetScoreOverrideAsync(businessId, next?, stored?, ifMatchEtag, stampUtc)` | `/businessId` | ONE patch with the read's ETag: each of the five fields Set from `next`, or Removed only when `stored` (the same read) holds it; stamps `/updatedAt` = the caller's stamp (identical on a lost-answer retry, so the base repository recognises its own write). Returns the patched profile — the caller never re-reads |
| `IConversationRepository.GetReplyCyclesAsync` · `IncrementUnreadAsync(… CustomerWaitStart?)` · `EndCustomerWaitAsync(… CustomerWaitEnd)` | `/userNumber` | see `clinqet-messaging`. `GetCreatedInWindowByUserNumberAsync` REMOVED |
| `ICustomerBookingRepository.DeleteCustomerBookingAsync` | — | **REMOVED** (D5: only a Business deletes, only a Draft, which has no customer copy) |
| `ReviewRepository.GetApprovedReviewDatesAsync` (private) | `/businessId` | `SELECT c.serviceId, c.rating, c.createdAt … AND c.status = 'Approved'` — the repair path's bucket source |

### AI Search rows (public plane) — the fan-out

- ‼️ Each PUBLIC index holds **one row per service (or business) per service area it serves in that country**, each
  scored from that area's centre; the address for a service with no centred area there or that is at-premises only
  (D-104). Keys (`Utilities/SearchRowKeys.cs`): service `{businessId}_{serviceId}_{serviceAreaId|noarea}`, provider
  `{businessId}_{serviceAreaId|noarea}`; the PRIVATE catalogue keeps one row per service keyed `{businessId}_{serviceId}`.
- ‼️ **`ProviderSearchDocument`'s key is now `id`** (no normaliser); `businessId` is an ordinary filterable/sortable
  field that keeps its lowercase normaliser. `ServiceSearchDocument.id` gained `IsSortable` (stripped on the private plane).
- `isPrimaryArea` (`bool?`, filterable) marks the ONE row per service/business that counts, facets, sorts and lookups
  read (`SearchRowKeys.PrimaryAreaId`: the default area, else lowest id ordinal, else `noarea`).
  `SearchRowScope.OnePerService` (the default) reads only those; `EveryServiceArea` only for location-scored queries.
- New fields: `acceptanceScore` (`int?`, not filterable/sortable — read back by the penalty) on both documents;
  `fromPrice` (`double?`, filterable + sortable, public only) on services — the card's lead price (D14).
  `addressLocation` became filterable + sortable on both (Rule 2 distance function).
- `ServiceAreaDistance` / `ServiceAreaScoringPoint` / `ServiceAreaDistanceSettings` (query-time distance correction) and `PublicIndexPair.DistanceGradientKm`
  are DELETED (D1).
