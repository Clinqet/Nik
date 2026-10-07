---
description: |
  **BACKEND SKILL** — Work on the Clinqet Infrastructure library (.NET 10 shared library). USE FOR: creating/modifying services, Cosmos repositories, middleware, email templates, localization, Service Bus messaging, storage services, AI services, health checks, geocoding, search, broadcasts, messaging, notifications, PDF generation, currency, dashboard, recommendations. Applies to ALL files in clinqetinfrastructure/.
---

# CLINQET INFRASTRUCTURE — COMPREHENSIVE SKILL
## ABSOLUTE RULES (READ FIRST — APPLIES TO EVERY CHANGE)

- **Comments — terse, only when they earn their place.** Default to no comments; let naming carry the meaning. **However**, write a comment when it captures non-obvious context the code itself cannot show: a hidden invariant, a subtle ordering constraint, a deliberate workaround for a known bug, a defensive choice with a real reason, or an RFC/spec citation that explains *why*. Prefer a single short line. Forbidden: restating WHAT the code does (e.g. `// increment counter` above `counter++`); multi-line narrative blocks explaining design rationale; XML doc summaries on properties whose names already convey intent; commented-out code; `// TODO` without an issue link. When in doubt, delete the comment — but don't strip a *real* WHY-comment just to chase zero.
- **No verbose docstrings on self-evident members.** A property named ``EnableAISpellCorrection`` does NOT need a doc summary. A field named ``_searchEnableAISpellCorrection`` does NOT need a multi-line ``//`` block above it. Trust naming.
- **No commented-out code, no leftover symbols, no ``// TODO`` without an issue link.**
- **EVERY `IMemoryCache` write MUST set `Size = 1` (ZERO-TOLERANCE, 2026-07-10).** The shared caches in the API/Functions/MCP hosts have `SizeLimit` (`MemoryCache:SizeLimit` = 50000) ⇒ a size-less write throws `InvalidOperationException` at runtime as a 500 (broke the billing receipt endpoint + receipt-email processor via `SellerTaxRegistrationService`). The `_cache.Set(key, value, TimeSpan)` / `(key, value, DateTimeOffset)` overloads are FORBIDDEN — use `MemoryCacheEntryOptions { Size = 1, AbsoluteExpirationRelativeToNow = ... }`, `.SetSize(1)`, or `entry.Size = 1` in `GetOrCreate`. Enforced by `MemoryCacheSizeConventionTests` (Clinqet.API.UnitTests) which scans all backend source — fix the call site, never the test. Identity host deliberately has NO SizeLimit (Apple auth writes size-less entries); never add one there.
- **EF tracking is a PER-HOST invariant, uniform across environments (2026-07-09).** API + Functions hosts: AppDbContext is TRACKED-BY-DEFAULT — never reintroduce a global/env-conditional NoTracking there (it silently no-ops query→mutate→SaveChanges writes; the 2026-07 billing outage). Identity host: NoTracking-by-default UNCONDITIONALLY (ASP.NET Identity attach-based writes conflict with ambient tracking) — identity-host writers opt in with `.AsTracking()` (DeviceTokenRepository, PolicyConsentService, CommunicationPreferenceService, AuthService passkey writes). Reads opt out with `.AsNoTracking()`. On the request-scoped bridge context, never `ChangeTracker.Clear()` (drops co-resident pending changes) — detach the specific entity type instead.

---


## OVERVIEW

The Infrastructure project is the shared .NET 10 class library used by both the Main API and the Function App. It contains all business services, Cosmos DB repositories, middleware, email/SMS communication, Service Bus integration, AI services, and supporting utilities.

- **Path**: `C:\Nik\clinqetinfrastructure\`
- **Project**: `Clinqet.Infrastructure.csproj`
- **Consumers**: Main API (`Clinqet.API`), Function App (`Clinqet.Communications`), Identity API (`Clinqet.Identity.API`)

---

## DIRECTORY STRUCTURE

```
clinqetinfrastructure/
├── Data/
│   └── COSMOS/
│       ├── Base/CosmosDbRepository.cs      # Base repository (ALL repos inherit from this)
│       ├── Extension/                       # 16 entity-to-DTO mapping extension files
│       ├── BookingRepository.cs            # 33 concrete repositories
│       ├── ServiceRepository.cs
│       └── ... (33 total)
├── Logging/                                # ResilientConsoleFormatter + AddResilientConsole (all 4 hosts)
├── Services/
│   ├── AI/                                 # 13 files: text enhancement, MCP, doc intelligence, embeddings
│   ├── Auth/                               # 8 files: AuthService (LARGE — always read fully)
│   ├── Booking/                            # Booking business logic
│   ├── Broadcast/                          # BroadcastService, classification, matching
│   ├── Communication/                      # ServiceBusService, email, SMS, notifications
│   ├── Currency/                           # Currency conversion
│   ├── Customer/                           # Customer management
│   ├── Dashboard/                          # Dashboard statistics
│   ├── Discovery/                          # Service discovery
│   ├── Documents/                          # PDF generation
│   ├── Geocoding/                          # Address geocoding
│   ├── GoogleRecaptcha/                    # reCAPTCHA verification
│   ├── Invoice/                            # Invoice business logic
│   ├── Language/                           # LocalizationService
│   ├── Mailchimp/                          # Marketing list management
│   ├── Messaging/                          # ConversationService, message handling
│   ├── Notifications/                      # Notification creation & dispatch
│   ├── OnboardingProgress/                 # Provider onboarding tracking
│   ├── RecentlyViewed/                     # Recently viewed items
│   ├── Recommendations/                    # Recommendation engine
│   ├── Search/                             # 7 files: AzureSearchQuery, spell check, AI search
│   ├── SignalR/                            # SignalR notification service
│   └── Storage/                            # 2 files: Azure Blob Storage management
├── HealthChecks/                            # 6 health check files (SQL, Cosmos, ServiceBus, Blob, Mailgun, Twilio)
├── Middleware/                              # AdminIpWhitelist, UserCulture
├── Migrations/                              # EF Core SQL migrations (identity DB)
└── Resources/
    ├── Localization/en.json                # Single source of truth for ALL localization keys
    └── EmailTemplates/{en,es,fr,gu,hi}/    # 108 templates x 5; Content only, composed by EmailShell
```

---

## COSMOS DB REPOSITORY PATTERN

### Base Repository (Data/COSMOS/Base/CosmosDbRepository.cs)

ALL 33 repositories inherit from `CosmosDbRepository<T>` where `T : BaseEntity`.

#### Core Methods

```csharp
// Point Read (partition key REQUIRED)
Task<T?> GetItemAsync(string id, string partitionKey);

// Query with SQL
Task<IEnumerable<T>> GetItemsAsync(string query, string partitionKey);
Task<IEnumerable<TResult>> GetItemsAsync<TResult>(QueryDefinition queryDefinition, string partitionKey);

// LINQ Predicate Query
Task<List<T>> GetItemsByLinqAsync(Expression<Func<T, bool>> predicate, string partitionKey);

// Filtered Query (OFFSET/LIMIT pagination)
Task<IEnumerable<T>> GetFilteredItemsAsync(string partitionKey, whereClause?, orderByClause?, skip?, take?);

// Scalar/Aggregate
Task<TResult?> ExecuteScalarQueryAsync<TResult>(string query, string partitionKey);

// CRUD
Task<T> AddItemAsync(T item, string partitionKey);
Task<T> UpdateItemAsync(T item, string partitionKey);      // ETag concurrency
Task<T> UpsertItemAsync(T item, string partitionKey);
Task<bool> DeleteItemAsync(string id, string partitionKey);

// Patch (partial update with ETag)
Task<T?> PatchItemAsync(string id, string partitionKey, IReadOnlyList<PatchOperation> patchOps, ifMatchEtag?, conditionExpression?);

// Bulk
Task<IEnumerable<T>> BulkInsertAsync(IEnumerable<T> items, Func<T, string> partitionKeySelector);

// Existence Check
Task<bool> DocumentExistsAsync(string id, string partitionKey);
```

#### CRITICAL RULES

1. **Partition key is REQUIRED on every query** — throws if null/empty
2. **Type filter on ALL queries**: `c.type = 'DocumentType'` prevents cross-type pollution in shared containers
3. **SQL injection protection**: Regex whitelist `SafeSqlClausePattern` validates dynamic clauses
4. **ETag concurrency**: `UpdateItemAsync` retries up to `MaxConcurrencyRetries` (default 3) with exponential backoff on 412
5. **Configuration**: `CosmosDb:MaxItemCount` (default 100), `CosmosDb:MaxConcurrencyRetries` (default 3)
6. **Polly retry**: Built-in retry policy from `CosmosRetryPolicyFactory`

### Concrete Repository Example (BookingRepository)

```csharp
public class BookingRepository : CosmosDbRepository<Booking>, IBookingRepository
{
    public BookingRepository(CosmosClient client, IConfiguration config, ILogger<BookingRepository> logger)
        : base(client, config, logger,
            containerName: config["CosmosDb:ContainerNames:Transactions"],
            documentType: nameof(Booking))
    { }

    // Composite ID pattern
    public async Task<Booking> CreateBookingAsync(Booking booking)
    {
        booking.Id = $"{booking.BusinessId}_{booking.BookingId}";
        booking.Ttl = GetTtlSeconds(config["DocumentTtl:BookingTtlDays"]);
        return await AddItemAsync(booking, booking.BusinessId);
    }

    // Paginated query with WHERE clause builder
    public async Task<PagedResult<Booking>> GetPaginatedAsync(string businessId, BookingQueryDto query)
    {
        // Build WHERE clause from filters (status, dates, customer, search text)
        // Use OFFSET/LIMIT for pagination
    }
}
```

---

## ENTITY-TO-DTO MAPPING PATTERN

Mapping uses **extension methods** (NOT AutoMapper) in `Data/COSMOS/Extension/`:

```csharp
public static class BookingExtensions
{
    public static BookingDto ToDto(this Booking entity) => new()
    {
        BookingId = entity.BookingId,
        Status = entity.Status,
        // ... map all properties
    };

    public static Booking ToEntity(this CreateBookingDto dto) => new()
    {
        // ... map from DTO to entity
    };
}
```

**16 mapping extension files** covering all entity types. ALWAYS use extension methods — do NOT introduce AutoMapper or different mapping approaches.

---

## SERVICE BUS SERVICE (Communication/ServiceBusService.cs)

### Send Pattern

```csharp
// Standard send
await _serviceBusService.SendMessageAsync("queue-name", message, cancellationToken, forceAdminAlert: false);

// Session-based (ordered processing)
await _serviceBusService.SendMessageWithSessionAsync("queue-name", message, sessionId);

// Scheduled
long sequenceNumber = await _serviceBusService.SendScheduledMessageAsync("queue-name", message, scheduledTime);

// Batch
await _serviceBusService.SendBatchAsync("queue-name", messages);

// Cancel scheduled
await _serviceBusService.CancelScheduledMessageAsync("queue-name", sequenceNumber);
```

### Serialization
- ALWAYS `JsonStringEnumConverter` — enums as strings, never integers
- `MessageId = Guid.NewGuid()` for deduplication
- `ContentType = "application/json"`
- `ApplicationProperties["MessageType"] = typeof(T).Name`

### Admin Alert Pattern (CRITICAL)
```csharp
// On final send failure:
if (forceAdminAlert || _settings.EnableAdminAlertOnFailure)
{
    await CreateSendFailureAlertAsync(...);
    // Creates scope, gets IAdminAlertRepository, saves to Cosmos
}
```

### Retry
- **Transient failures only**: `MaxSendRetries` + 1 attempts (class default 2; API/Functions set 3).
- Delay: `(attempt+1)*150ms + random(0,50ms)`
- **Permanent failures are attempted ONCE** — `ServiceBusException{IsTransient:false}` (`MessagingEntityNotFound`, `MessagingEntityDisabled`, `QuotaExceeded`, `MessageSizeExceeded`, `GeneralError`), `UnauthorizedAccessException`, `ArgumentException`, `InvalidOperationException`, `NotSupportedException`. The SDK has already retried anything genuinely transient internally, and each re-attempt of a missing entity costs ~5s of link-open (2026-07-24: 20.8s on admin assign-number).
- On final failure: ONE `LogCritical` with the stack (retry warnings omit the exception object) carrying QueueName, MessageType, MessageId, Attempts, FailureReason, Retryable — then admin alert + throw.

### Disposal
`IAsyncDisposable` — disposes all senders + client with `Interlocked.Exchange()`.

---

## LOCALIZATION SERVICE (Language/LocalizationService.cs)

```csharp
// Single source: Resources/Localization/en.json
// Keys: flattened dot-notation (e.g., "Auth.Error.InvalidCredentials")
// Loaded on startup, cached in memory
string message = _localizationService.GetLocalizedString("Error_BookingNotFound", language);
```

- Falls back to default language if key not found for requested language
- Returns key itself if not found in any language
- Admin alerts are the only exception (hardcoded text OK)

---

## EMAIL TEMPLATE SERVICE

### Template Structure (Resources/EmailTemplates/{en,es,fr,gu,hi}/)

‼️ **Since 2026-10-02 every message composes from ONE shell.** A template file carries `Name`, `Subject` and
`Content` — only what THIS message says. `Clinqet.Shared.Rendering.EmailShell` wraps it in the responsive,
branded document, and `TemplateService.LoadJsonTemplateFile` does that **once at load**, never per send.
108 templates × 5 languages. The retired `.html` path is gone: a non-JSON file under `EmailTemplates` is not
loaded at all, and `NoTemplateShipsAsRawHtml` fails the build over one.

Before this, 455 of 535 files had no media query and were broken on a phone, because there was no shared layout
and every author copied the last template written — three generations had drifted apart.

```jsonc
{
  "Name": "BookingConfirmation",
  "Subject": "Booking Confirmation - {{BookingNumber}}",
  "Content": {
    "Preheader": "…",                 // the inbox-preview line; never part of the body
    "Pill": "Trial ended",            // optional uppercase status chip
    "Heading": "Booking Confirmed",   // optional — see HeadlessTemplates
    "Paragraphs": ["…"],              // SHORTHAND for a paragraph-only body
    "Blocks": [ … ],                  // the general form; never both
    "CtaText": "…", "CtaHref": "{{AppBaseUrl}}/…",
    "FooterNote": "…",                // one quiet line under the button
    "Footer": { "Lines": ["…"], "LinkText": "…", "LinkHref": "{{PreferencesUrl}}" }
  }
}
```

A block is ONE node with a `Kind` (both Newtonsoft and System.Text.Json read these files and neither resolves a
polymorphic union without a hand-written converter in each):

| `Kind` | Carries | Renders as |
|---|---|---|
| `Text` | `Text`, optional `Tone` | a paragraph (`Quiet` = 14px grey, `Warning` = amber ink) |
| `Subheading` | `Text` | an `<h2>` |
| `Bullets` | `Items` | a `<ul>` |
| `Facts` | `Facts[{Label,Value,Emphasis}]`, optional `RowsToken` | a label/value table — two columns on a computer, **stacked on a phone** |
| `Panel` | `Children`, `Tone` | a callout card (`Info` blue · `Success` green · `Warning` amber · default grey) |
| `Fragment` | `Token` | a placeholder the producer fills with composed markup (a declared `HtmlFragment`) |

‼️ `EmailTemplateContentConventionTests` rejects a field that does not belong to the declared `Kind` — content
in the wrong field renders as **nothing**, silently, in all five languages.

### What you may NEVER put in a template

- **Its own `<table>`, `<div>` or `<style>`** — that is how the three generations started.
- **Presentation in the copy.** Copy may use `strong b em i u br a code` and **no attribute but `href`**.
  `NoTemplateCopyCarriesPresentationOrLayout` fails the build over a `style=` in a sentence.
- **A fixed width on the action button.** Hindi and Gujarati labels run longer than their English originals.

### The guards (all in `Clinqet.Communications.UnitTests`, the host that sends the mail)

| Guard | What it protects |
|---|---|
| `EmailTemplateTokenPinTests` | ‼️ Every English template's **placeholders and link targets**, pinned in `TestData/EmailTemplateTokenPin.json`. Neither is visible to someone proof-reading copy: drop `{{BookingNumber}}` and the mail still reads as a sentence, it just no longer says which booking. Language parity proves the other four match English, so pinning English pins all five. **Changing either means editing the pin in the same change.** |
| `EmailShellConventionTests` | The mobile query and each of its rules, the viewport, the brand font, the 600px column, the Outlook-sized logo, the page language, the green action with no fixed width, that every word a template declares reaches both halves of the mail, and that no presentation sits in the copy |
| `EmailTemplateContentConventionTests` | One content form per template, block-kind field validity, the headless registry, the one fragment template, and no non-JSON file |
| `EmailTemplateAssetConventionTests` | Language/file/token parity, **field-by-field** translation, logo presence and sizing, and that every template resolves through the real `TemplateService` |
| `EmailTemplateTranslationConventionTests` | Each translated copy field keeps English's markup, links and token spacing; each composed page differs from English only in its words |

‼️ **Every one of these reads the document that SHIPS** (`EmailTemplateCorpus.Entry.Shipped`), not the file. A
guard that reads the raw file after the migration finds no logo, no media query and no `<html lang>` — it scans
nothing and reports success, which §0.17 calls worse than no guard at all.

### Token Pattern
Templates use `{{TokenName}}` placeholders:
- `{{FullName}}`, `{{CompanyName}}`, `{{LockoutDuration}}`
- `{{WebAppOrMobileAppUrl}}`, `{{CurrentYear}}`
- Custom tokens per template type

`TemplateService.ProcessTemplate` resolves these from configuration, NOT from caller-supplied
`TemplateData` - never pass them in:

| Token | Setting | Notes |
|---|---|---|
| `{{LogoUrlOnDark}}` | `Email:LogoUrlOnDark` | White wordmark. **No template uses it since 2026-10-02** — the shell paints a white card and supplies `{{LogoUrlOnLight}}` itself. Kept because a dark header may return and because it is still read and still deployed. |
| `{{LogoUrlOnLight}}` | `Email:LogoUrlOnLight` | Navy wordmark. Use on white cards and on any template that declares no background. |
| `{{AppBaseUrl}}` | `Email:AppBaseUrl` | Partner app origin. CTA hrefs MUST be absolute - a relative href is dead inside an email client. |
| `{{CompanyName}}`, `{{SupportEmail}}`, `{{ExpiryTime}}`, `{{CurrentYear}}` | localization | Resolved per language. |

### Email Logo Rules (ZERO-TOLERANCE)
Broke in production 2026-07-24: the blob had never been seeded on any stamp, 64 of 99 tags were
CSS-sized only, and one token served both dark and light headers.

- **Pick the token by background, not by habit.** A white mark on a white card is invisible. The
  luminance of the nearest preceding `background-color` decides it; no declared background counts
  as light, because the client paints its own.
- **Every `<img>` needs explicit `width` AND `height` attributes.** Outlook for Windows uses the Word
  engine and ignores `max-width`/`max-height`, painting the intrinsic 383x98. Sizes in use: `125x32`
  (dark headers), `156x40` (white card), `188x48` (unbacked). Also set `display:block` and `border:0`.
- **Hosted URL only - never base64 / data-URI.** Gmail web strips `src="data:"` and Outlook will not
  render it. CID inline would re-ship the bytes on every message, and the ACS sender sets no
  `ContentId` anyway (`AzureCommunicationServicesEmailService`).
- **The PNGs are seeded by `deploy.ps1`, never by hand.** `azureautomation/assets/clinket_email_logo.png`
  (white) and `clinket_email_logo_dark.png` (navy) upload to the public `assets` container for every
  stamp and every environment as `image/png` with `Cache-Control: public, max-age=2592000`, then get
  verified by an anonymous fetch. A base64 copy is embedded in the script for Cloud Shell runs that
  carry no repo assets - regenerate it whenever the brand mark changes.
- `EmailTemplateAssetConventionTests` (Clinqet.API.UnitTests) fails the build on any violation above.

### Sending Pattern (via Service Bus)
```csharp
var message = new EmailNotificationMessage
{
    TemplateName = "BookingConfirmation",
    TemplateData = new { FullName = "...", CompanyName = "...", /* all tokens */ },
    Language = language
};
await _serviceBusService.SendMessageAsync("booking-emails", message);
```

**ALL tokens in the template MUST be provided** — missing tokens will render as-is.

---

## PDF GENERATION (QuestPDF)

`QuestPdfService` builds booking, quote, invoice and billing-receipt PDFs. `PdfImageLoader`
(`IPdfImageLoader`) is the ONLY supported way for an image to reach a document.

### Image Rules (ZERO-TOLERANCE)
Every logo was missing from every PDF until 2026-07-24 because both call sites passed a URL.

- **NEVER pass a URL to `.Image(string)`.** That overload takes a FILE PATH. A URL throws inside the
  compose lambda, and the old swallowing `catch` rendered the text fallback instead - so no booking,
  quote or invoice PDF ever showed the Clinket wordmark or the provider's own logo.
- **QuestPDF decodes PNG, JPEG and WEBP only.** SVG is NOT supported by `Image()`; undecodable bytes
  throw at RENDER time, which fails the entire document rather than falling back. `PdfImageLoader`
  magic-byte checks every payload before it reaches QuestPDF.
- **Resolve images BEFORE `Document.Create`.** Compose lambdas are synchronous, so fetching inside one
  is sync-over-async on the PDF hot path. `QuestPdfService.ResolveBrandingAsync` pre-resolves and hands
  `QuestPDF.Infrastructure.Image` instances (disposed with the enclosing `using`) to the compose methods.
- **Use `Image.FromBinaryData`, never the `byte[]` overload, for anything user-supplied.** It validates
  EAGERLY, so a corrupt body (valid magic bytes, truncated payload) degrades to the text fallback. The
  `byte[]` overload defers the throw to RENDER time and fails the whole document. It is NOT about size:
  measured identical output at 1, 2, 4 and 9 pages - QuestPDF already dedupes across pages.
- **Remote images are cached** (`IMemoryCache`, `Size = 1`) with a shorter TTL for failures, so a broken
  provider logo URL is not re-fetched for every PDF. Timeout, both cache windows and the byte cap are
  `PdfSettings`.
- **The Clinket wordmark ships with the app**: `clinqetinfrastructure/Resources/Branding/clinket-logo.png`
  (navy on transparent, 383x98), resolved from `AppContext.BaseDirectory` via `PdfSettings.BrandingLogoPath`.
  No network call, so invoice branding cannot be broken by a CDN outage.
- Any host generating PDFs must register BOTH `IPdfImageLoader` and
  `AddHttpClient(PdfImageLoader.HttpClientName)` alongside `IPdfGenerationService`.
- `PdfBrandingTests` (Clinqet.API.UnitTests) covers all of the above.

---
## NOTIFICATION & COMMUNICATION DISPATCH PIPELINE

### CommunicationDispatcher (Communication/CommunicationDispatcher.cs)

The entry point for ALL multi-channel notification dispatch. Any service that needs to notify a user calls `CommunicationDispatcher.DispatchAsync()`.

#### Flow

```
Any Service (Booking, Broadcast, Quote, etc.)
  → CommunicationDispatcher.DispatchAsync(CommunicationRequest)
    ├── 1. Map NotificationType → PreferenceCategory
    ├── 2. Resolve user preferences from SQL (cached 15 min)
    ├── 3. Apply mandatory/eligible rules
    └── 4. Parallel dispatch to Service Bus queues:
        ├── Email → EmailNotificationsQueueName (if not SkipEmail)
        ├── Notification → NotificationsQueueName (in-app + SignalR + push)
        └── SMS → SmsNotificationsQueueName (if not SkipSms, if eligible)
```

#### CommunicationRequest Model

```csharp
public class CommunicationRequest
{
    public string RecipientUserNumber { get; init; }   // Partition key / user ID
    public string RecipientType { get; init; }          // "Provider" or "Customer"
    public string NotificationType { get; init; }       // Enum value as string
    public string NotificationTitle { get; init; }      // Localized title
    public string NotificationBody { get; init; }       // Localized body (MUST use string.Format for placeholders)
    public string? RecipientEmail { get; init; }
    public string? EmailTemplateName { get; init; }
    public object? EmailTemplateData { get; init; }
    public Dictionary<string, string>? NotificationData { get; init; }
    public NotificationMetadata? NotificationMetadata { get; init; }
    public bool SkipEmail { get; init; }                // Skip email channel
    public bool SkipPush { get; init; }                 // Skip mobile push (passed to NotificationMessage.SkipMobilePush)
    public bool SkipSms { get; init; }                  // Skip SMS channel
    public string PreferredLanguage { get; init; } = "en";
    // ... additional fields for SMS, email subject, etc.
}
```

#### Preference Categories & Mandatory Rules

- **Mandatory email** (cannot be opted out): `BookingNotifications`, `QuotesInvoices`
- **SMS eligible** (requires explicit opt-in): `BookingNotifications`, `BookingReminders`, `BroadcastOpportunities`, `MarketingPromotions`
- NotificationType → PreferenceCategory mapping is defined in `CommunicationPreferenceConfig.cs` (Shared project)

#### DispatchResult

```csharp
public class DispatchResult
{
    public bool EmailDispatched { get; init; }
    public bool NotificationDispatched { get; init; }
    public bool SmsDispatched { get; init; }
    public bool EmailFailed { get; init; }
    public bool NotificationFailed { get; init; }
    public bool SmsFailed { get; init; }
    public bool AnyFailed => EmailFailed || NotificationFailed || SmsFailed;
}
```

### String.Format Requirement for Notification Bodies

Notification bodies use localization keys with `{0}`, `{1}` placeholders. The body MUST be formatted using `string.Format()` **before** passing to `CommunicationRequest.NotificationBody`:

```csharp
// CORRECT
NotificationBody = string.Format(
    _localizationService.GetLocalizedString("Notification_BookingConfirmed_Body", language),
    booking.BookingNumber, booking.ServiceName)

// WRONG — raw placeholders reach the user
NotificationBody = _localizationService.GetLocalizedString("Notification_BookingConfirmed_Body", language)
```

---

## SIGNALR NOTIFICATION SERVICE (SignalR/SignalRNotificationService.cs)

In-process service used by the Main API to deliver real-time notifications via the SignalR hub.

### EnabledNotificationTypes Whitelist

Configured in `appsettings.json` under `SignalRSettings:EnabledNotificationTypes`:
- If **empty/not configured**: ALL notification types are delivered via SignalR
- If **configured**: ONLY types in the list are sent; others are silently skipped (logged at Debug level)
- When adding a new `NotificationType` enum value that should have real-time delivery, it **MUST be added** to this list

### Methods

```csharp
// Single notification → hub.User(recipientId).ReceiveNotification(dto)
Task SendNotificationAsync(NotificationDto notification);

// Batch delivery → hub.User(recipientId).ReceiveNotificationBatch(notifications)
Task SendNotificationBatchAsync(string recipientId, IEnumerable<NotificationDto> notifications);

// Sync read/delete state across all connected devices
Task NotifyNotificationReadAsync(string recipientId, string notificationId);
Task NotifyAllNotificationsReadAsync(string recipientId);
Task NotifyNotificationDeletedAsync(string recipientId, string notificationId);
```

---

## STORAGE SERVICE (Storage/)

Two files handling Azure Blob Storage:
- File upload with type/size validation
- Container naming convention: `{partnerId}/{entityId}/{filename}`
- SAS token generation for access
- Public containers configured in `StorageConfiguration:PublicContainers`
- Max file size: from `StorageConfiguration:MaxSizeInMb` (default 30MB)

---

## KNOWLEDGE READER — NEVER LOSE CONTENT (2026-10-02/03, BUILT, not deployed; detail in `clinqet-voice-assistant`)

- `Services/Knowledge/KnowledgeDocumentParser.cs`: page furniture is marked, never deleted (only page numbers are removed and
  recorded); figure tags sit on their own lines; `KnowledgeContentConservation` checks every word and number of the source is
  in the blocks, re-parses a losing page alone and saves a page still losing as plain text; the result carries `Conservation`.
  `KnowledgeDocumentParser.TableGrid.cs` is the one table span rule (HTML, Word, PowerPoint, Excel).
- `Services/AI/ReadingOutcomeItems.cs` + `TranscriptionVerificationAlerts.PublishReadingOutcomeAsync`: ONE admin alert per
  reading, only when a person must act. `ITranscriptionVerificationAlerts` has no other member (per-check alerts deleted).
- `Services/AI/Reading/`: the page reading rules and the raw AI bank (`PageReadingRawBank`, `PageReadingRawKeys`).
  `DocumentTranscriptComparer` / `DocumentValueEquivalence` are deleted.
- `ReadingPageCount.Mismatch` and `Services/Knowledge/KnowledgeCardCheck.cs` produce consumer items for the reading alert.
- `KnowledgeChunker`: each distinct running header/footer reaches one card only. `KnowledgeSectionScope` gives the chunker and
  `KnowledgeInventoryBuilder` one section path per block (page rule, banners). `KnowledgePlacementCeiling` bounds picture placements.
- Retrieval: `KnowledgeRelevanceRanker.Seat(..., countsAsSeat)`; overview cards are seated beside records
  (`RetrievalLookupOverviewSeats` / `RetrievalBrowseOverviewSeats`).
- `Services/Knowledge/KnowledgeWrongAnswerReports.cs` (`IKnowledgeWrongAnswerReports`, registered in the API): one admin alert per
  report, nothing stored.
- AI setup: `ProviderSetupServiceGate` and `ProviderSetupFactChecks` (`Services/AI/`) — `clinqet-ai-assistant`.
- Storage: `IAzureStorageService.TryDownloadDerivativeBlobAsync` (one request, 404 = null) and `ListBlobFoldersAsync` (the folders
  directly under a prefix); `KnowledgeVersionPruner.PruneFoldersAsync` deletes a document's other `_ocr` version folders.

## AI SERVICES (AI/)

13 files covering:
- Text enhancement (service description improvement)
- MCP (Model Context Protocol) tool integration
- Document intelligence (PDF/image analysis)
- Embedding generation (for vector search)
- Service category validation and auto-correction
- Search query understanding and spell correction

### Key Rule: AI prompts must NEVER hardcode category/service names — there are 300+ categories.

---

## HEALTH CHECKS (HealthChecks/)

Six health check implementations:
| Check | Failure Severity |
|-------|-----------------|
| SQL Database | Unhealthy (critical) |
| Cosmos DB | Unhealthy (critical) |
| Service Bus | Degraded |
| Blob Storage | Degraded |
| Mailgun (email) | Degraded |
| Twilio (SMS) | Degraded |

Each has configurable timeout from appsettings `HealthChecks` section.

---

## Logging/ — ResilientConsoleFormatter (2026-07-24)

`builder.Logging.AddResilientConsole()` is called by **all four hosts** (Main API, Identity API, Function App, MCP) right
after configuration is composed. It swaps the console provider's formatter — `AddConsole` is `TryAddEnumerable`-based, so
on hosts whose default builder already added the provider this only changes its formatter; no duplicate provider.

**Why it exists.** `ILogger.Log` wraps any provider failure in an `AggregateException`, and the framework's
`ExceptionHandlerMiddlewareImpl` logs the unhandled exception itself — so a formatter throw converts a *handled* error
into a 500 whose own cause is unloggable. `SimpleConsoleFormatter` calls `Exception.ToString()`, which resolves type
names and reads portable PDBs; on a damaged deployment that throws `BadImageFormatException` (`CLDB_E_INDEX_NOTFOUND`,
0x80131124). Seen in prod on `clinket-api-in-v3-dev` 2026-07-24 — `GET /conversations/unread-count` returned 500 with no
diagnostics at all.

`ResilientConsoleFormatter` degrades instead of throwing: the message formatter, `Exception.ToString()`,
`GetType().FullName`, `Message`, each scope, and the `TextWriter` write are all individually guarded. Output shape
matches `SimpleConsoleFormatter` (`info: Category[EventId]` + 6-space-indented body) and honours
`ConsoleFormatterOptions` (`TimestampFormat`, `UseUtcTimestamp`, `IncludeScopes`).

A `BadImageFormatException` at runtime still means a **corrupt or mismatched assembly on that instance** — the formatter
makes it diagnosable, it does not fix it. The fix is a clean redeploy. Tests:
`Clinqet.API.UnitTests/Logging/ResilientConsoleFormatterTests.cs`.

---

## MIDDLEWARE (Middleware/)

### AdminIpWhitelistMiddleware
- Protects `/api/v1.0/admin` and `/api/admin` paths
- Config-driven: `Security:AdminIpWhitelist:Enabled`, `AllowedIPs`, `AllowedCIDRs`
- Returns 403 if IP not allowed

### UserCultureMiddleware
- Resolves culture from: JWT `"Locale"` claim → Accept-Language header → default "en"
- Sets `CultureInfo.CurrentCulture` and `CurrentUICulture`

---

## CART / BASKET

### CartService (`C:\Nik\clinqetinfrastructure\Services\Cart\CartService.cs`)
**Interface**: `ICartService` (`C:\Nik\clinqetcore\Interfaces\ICartService.cs`)

| Method | Description |
|--------|-------------|
| `GetCartAsync(identifier, type)` | Fetch cart by pk (userNumber or deviceId) |
| `SaveCartAsync(dto, identifier, type)` | Full cart save with ETag concurrency (retry loop on 412/PreconditionFailed) |
| `RemoveCartItemAsync(identifier, type, serviceId)` | Remove item by serviceId; skips Cosmos upsert if item not found |
| `UpdateCartItemQuantityAsync(identifier, type, serviceId, quantity)` | Update quantity for a specific item |
| `ClearCartAsync(identifier, type)` | Delete cart document |
| `MergeCartsAsync(userIdentifier, deviceIdentifier)` | Merge device cart → user cart, delete device cart, schedule reminders |
| `ConvertCartAsync(identifier, type)` | Set status to `Converted`, cancel scheduled reminders |

### Key Patterns
- **Deterministic ID**: `cart_{pk}` where pk = userNumber (authenticated) or deviceId (anonymous)
- **Concurrency**: `SaveCartAsync` uses an ETag retry loop — on `CosmosException` with `PreconditionFailed` status, re-fetches and retries (max 3 attempts)
- **Cart reminders**: On save/merge, if `EnableCartReminders` is true, schedules Service Bus messages to `cart-reminders` queue with delays from `CartReminderDelayHours` array
- **Reminder cancellation**: On clear/convert, cancels any scheduled cart reminders via `ServiceBusService.CancelScheduledMessagesAsync`

### CartRepository (`C:\Nik\clinqetinfrastructure\Data\COSMOS\CartRepository.cs`)
**Interface**: `ICartRepository` (`C:\Nik\clinqetcore\Interfaces\ICartRepository.cs`)
**Container**: `SystemData` (partition key: `/pk`)

| Method | Description |
|--------|-------------|
| `GetCartByPkAsync(pk)` | Read cart by partition key, returns null if not found |
| `UpsertCartAsync(cart)` | Upsert with ETag (`IfMatchEtag`) for optimistic concurrency |
| `DeleteCartAsync(id, pk)` | Hard delete cart document |

### Email Template
- **Template**: `CartReminder.json` in `C:\Nik\clinqetinfrastructure\Resources\EmailTemplates\en\`
- **Tokens**: CustomerName, ItemCount, CartItemsHtml, CartUrl, PreferencesUrl

---

## CHECKLIST FOR INFRASTRUCTURE CHANGES

- [ ] Repository methods include partition key parameter
- [ ] New repository methods assessed for Cosmos index needs (check cosmosindexsetup/Program.cs)
- [ ] Entity-to-DTO mapping via extension methods (not AutoMapper)
- [ ] Service Bus messages use JsonStringEnumConverter
- [ ] Admin alert pattern respected (forceAdminAlert || EnableAdminAlertOnFailure)
- [ ] Email templates have ALL tokens provided
- [ ] Localization keys added to en.json for new user-facing text
- [ ] No cross-partition queries
- [ ] ETag concurrency used for entities with concurrent updates
- [ ] Health checks added for new critical dependencies
- [ ] Structured logging with parameterized messages
- [ ] DI registration uses correct lifetime (Singleton/Scoped)
- [ ] No hardcoded secrets — use appsettings placeholders

## Password-management infrastructure (2026-07-22)

- `AuthService` must leave external-login users passwordless; never synthesize or persist a random local password for Google, Apple, Facebook, or other external providers.
- Password-set and password-change success notifications use `AccountNotificationService` and the normal communication dispatcher. Both events have localized notification copy and email templates in en/fr/es/hi/gu.
- `PasswordSetEmail` and `PasswordChangedEmail` use the same 600px fluid, table-based Clinket shell in en/fr/es/hi/gu: navy `#032858`, lime `#97EF29`, inline fallback styling, mobile media rules, Outlook width guards, hidden preheader, and plain-text twin.
## Localization and email baseline (2026-07-26)

- Backend resources are complete in `en`, `fr`, `es`, `hi`, and `gu`; English is the structural source of truth and convention tests enforce exact keys and format placeholders.
- Every English email template has an exact filename and token-parity counterpart in all five language folders. Recipient email copy is localized. Attached booking, quote, invoice, and billing-receipt PDFs are deliberately generated in English pending the separate legally reviewed multilingual-PDF phase.

## `HomepageBannerService` (Phase 4B, 2026-07-28)

`Services/Discovery/HomepageBannerService.cs` — the customer homepage hero (plan Part 8). Singleton.

**The shape, and why it scales.** ONE build per `(area, region, rotation window)` serves every visitor
in that window, so Azure AI Search cost is **flat in traffic** and grows only with the number of
distinct areas being browsed.
- Its **own bounded `MemoryCache`** (`Banner:MaxCachedAreas` × 3 entries), not the shared one, so its
  memory budget is its own setting and a cold city is LRU-evicted instead of pushing someone else out.
  ‼️ Every write still sets `Size = 1`.
- ‼️ **Per-scope single-flight** via `ConcurrentDictionary<string, Lazy<Task<T>>>` removed
  value-conditionally in a `finally`. `SeoDiscoveryCatalogService`'s single `_pending` Lazy works only
  because it has ONE cache key; the banner has one per city.
- Last-good + failure-backoff, both copied from the catalog service. **An empty build THROWS.**
- ‼️ **Promos degrade independently** — a SQL hiccup costs two slides, not the hero.

**The ladder (8.1a).** Tier outer → offer → photo. ‼️ **At most two queries per tier, and the second
only if the first left slots unfilled**, so a healthy city costs ONE query. `hasActiveOffers` is
filterable but NOT sortable ⇒ the offer split must be a filter; `serviceImages` is a `[SimpleField]`
⇒ the photo split is an in-memory rank. One slide per business (`Banner:MaxSlidesPerBusiness`),
enforced in **ONE place** (`Rank`) — a second check in `TakeInto` was proved unreachable by sabotage
and deleted, because an unreachable guard makes the real one look optional.

**Rotation** is a time bucket, exactly reproducible from `(area, region, bucket)` — that is what makes a
paid impression provable. ‼️ **Never random-per-request**: it destroys the cache AND the audit trail.

**Expiry at READ time (E25):** `Freshen` drops a lapsed promo slide and CLEARS a lapsed offer (the
service is still real; the discount is not). Allocation-free when nothing expired.

**The area filter comes from the shared `SearchFilterExpressionBuilder`** — never a second copy. A
copy-pasted geo rule is exactly how the `(0,0)` defect survived a release.

## `CustomerPromoService` — the banner read (Phase 4B)
`GetBannerPromosAsync(region)` — anonymous, no order amount, so it returns the code's OWN TERMS and no
computed saving. ‼️ **The cached candidate query is a deliberate SUPERSET: `IsListed OR ShowInBanner`.**
One cached query serves two surfaces and **every caller MUST narrow it** — `GetOffersAsync` carries an
explicit `if (!p.IsListed) continue;` or a banner-only code leaks into the cart teaser and pay sheet.

## `ProviderLifecycleService` — admin suspend (Phase 4B, D-L4/D-L5)
- ‼️ **`SuspendAsync` is a SEPARATE method, not a flag on `DeactivateAsync`**, and `DeactivateAsync`
  now refuses `Suspended` outright. The outstanding-booking block is right for a provider LEAVING but
  backwards for a suspension — it let a bad actor veto their own suspension by holding one booking.
  A bypass expressed as a parameter can be passed by accident; a different method cannot.
- The admin chooses the purge window, clamped to
  `BusinessProfile:MinAdminSuspendPurgeDays`..`MaxAdminSuspendPurgeDays` (30..90).
- ‼️ **Outstanding bookings are LEFT ALIVE** (owner decision) and the alert records the exact count.
  Cancel + refund is future work: it needs a paged read of full `Booking` documents (the blocker list
  caps at 50) and an async worker, because a safety action must never wait on a payment gateway.
  ‼️ **`BookingCancellationProcessor` does NOT cancel — it notifies about an already-cancelled booking.**
- `RaiseBadgeChangedAlertAsync` — a badge grant MOVES RANKING, so it raises `ProviderBadgeChanged`.

---

## ‼️ PHASE 4 — EMBEDDING/COMPLETION LANES, PACING AND SEARCH-INDEX RESILIENCE (2026-08-18)

One `text-embedding-3-large` deployment serves **eleven** consumers and one `gpt-5.4-mini` deployment serves
**fifteen** call sites, mixing live and bulk work on one budget. Phase 4 made that lane split explicit.

- **`AiWorkloadLane`** (`clinqetshared/Enums`) — `Interactive` (default) or `Bulk`, on `IEmbeddingService`
  and every `IAICompletionService` method. **Interactive never queues.** Bulk = knowledge ingest, the
  change-feed enrichment + embedding, category embeddings, the vector-recovery sweep, doc summaries, image
  captions. Live = customer search, `search_knowledge`, the voice catalog, broadcast matching, spell check.
- **`IAiBudgetGovernor` / `AiBudgetGovernor`** — a process-wide singleton that admits Bulk against Azure's
  OWN reported headroom (`x-ratelimit-*`), with a guard band, burst spacing, a concurrency cap and a
  learned debit ratio. Configured TPM survives only as a bootstrap. `retry-after-ms` marks the snapshot stale.
- **`AzureAIFoundryEmbeddingService`** owns the request-sizing rule for every caller: token-bounded
  sub-batching, per-input clamping, in-batch dedup, poison isolation, adaptive halving on a token-cap 400,
  and a bulk coalescing window that turns N single Bulk embeds into batched requests.
- **`EmbeddingResult` / `EmbeddingBatchResult` / `AiFailureKind`** (`clinqetcore/Models/Search`) — the legacy
  `float[]`/`[]`-sentinel methods still exist, but a caller that must tell a **throttle** from an **outage**
  reads the reason. `AiThrottledException` (`clinqetcore/Exceptions`) is its completion-side twin.
- **`ServiceIndexOutcome` / `ServiceIndexLegs`** — the indexer reports WHICH leg degraded, so the change feed
  can queue a retry and the aggregated admin alert can name a reason.
- **`AdminAlertSettings` now lives in `Clinqet.Shared.Models`** — the search indexer and the enrichment
  failure tracker are library code and could not reach the Functions host's copy, which is why they were
  cooldown-gated while everything else was appsettings-gated. One regime now. Every flag still defaults TRUE.

‼️ **`vectorFilterMode` is set explicitly to `preFilter`** on every filtered vector query. It was set nowhere,
so the platform ran on whatever default the index vintage happened to give it.

## AI resource alerts (2026-09-15)

`AddIntegrationHealthAlerts` registers one host-owned `IntegrationHealthAlerts` publisher. All Search clients are created by `AiSearchClientFactory`; every AI HTTP client uses `.AddAiModelResourceLimitAlerts()`. `SpeechService` reports SDK throttling, unavailable and timeout cancellations. MCP's realtime socket separately observes rejected handshakes and structured error events. â¼ï¸ SUPERSEDED 2026-09-19: the AI-only publisher was generalised into `IIntegrationHealthAlerts` over 14 resources and `AiResourceLimitAlerts`/`IAiResourceLimitAlerts`/`AiResourceKind`/`AiResourceLimitAlertSettings` were DELETED â see the `clinqet-integration-health` skill.

- Dedicated types: `AiSearchResourceLimit`, `AiModelResourceLimit`. Independent `AdminAlertSettings:EnableAiSearchResourceLimitAlerts` / `EnableAiModelResourceLimitAlerts`, both true by default, independent of the generic system-failure gate.
- `IntegrationHealthAlertSettings`: `CooldownMinutes=15`, `PublishTimeoutSeconds=30`, `FailedPublishCooldownSeconds=30`, `MaxInspectionBytes=65536`. Options are startup-validated; defaults match API, Functions and MCP appsettings.
- Cooldown is IN CODE, keyed by resource hostname/port + Search/Model, shared across businesses in that process. Owner explicitly rejected Service Bus duplicate-detection/recreation. Restart/scale-out duplicates are accepted. No business-keyed cooldown or new queue.
- Success starts the full cooldown. Failed sends are logged and a later failure can retry after the short backoff. Shutdown drains pending sends within the host deadline. This is not a durable outbox.
- One dictionary entry per distinct observed resource/type; expired completed entries are periodically removed. Suppressed calls allocate no alert/task. Model JSON/SSE inspection retains at most the configured payload length per response/event; oversized envelopes are skipped, while HTTP status detection remains active. Normal streaming bytes are preserved.
- HTTP 408/429/503/504 (Search also 402), allowlisted structured quota codes, Search semantic `capacityOverloaded`/`maxWaitExceeded`, and individual indexing statuses are observed. Search SDK network timeouts alert; caller cancellation does not. Feature-owned deadlines retain their existing workflow alerts and must distinguish their own deadline from caller cancellation.
- Metadata includes resource, resource kind, status/code, failure kind, cooldown, host/environment and available trace/business context. Never persist URL paths, queries, credentials or prompts. A person UserNumber is never a BusinessId.
- Host-owned convention tests classify HTTP registrations and guard the sole Search factory. They scan only their own host plus shared infrastructure, never a peer host.

Audit and exact validation scope: `C:\Nik\Data\ai-resource-limit-alerts\AUDIT.md`.

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

## SEARCH-TOPOLOGY PHASE 3 — infrastructure pieces (2026-09-22/24)

Full picture in `clinqet-search-discovery` → "PHASE 3". The classes this library gained or changed:

| Class | Role |
|---|---|
| `Services/Discovery/SearchPlaceResolver` | THE place rule for every search surface: coordinates → typed place (visitor country as a bias) → visitor header; `SearchPlaceLookup.CacheOnly` never calls Google |
| `Services/Geocoding/GoogleGeocodingService` | + `ReverseGeocodeAsync` (sends the ~110 m cell), `GeocodePlaceAsync` (region BIAS + language), `TryGetCachedReverse`; B-3 body-status alarms; its own timeout alarm; a listed ISO country in free text is sent as its English name |
| `Services/Geocoding/GeocodeCell` · `GeocodingSingleFlight` | cell = request point = cache key; N cold callers → one call, cached inside the shared call (`Size = 1`) |
| `Services/Search/PublicFanOutMerger` | D-7 merge BY RANK (never by score), facets summed |
| `Services/Search/PublicCountryFiling` | the ONE filing rule for both indexers (`CanonicalName` throws for an unlistable country; `Served`; `NamesAnyCountry`) |
| `Services/Search/SearchFilterExpressionBuilder` · `ProviderSearchFilterBuilder` · `BroadcastFilterBuilder` | B-19: the country travels INSIDE each place clause |
| `Services/Discovery/LocationResolutionService` | the saved address answers in ITS country; its coordinates follow `CoordinateSentinel` |
| `Services/Broadcast/BroadcastService` | B-18 quote country at create (strict / reverse / biased forward / refused) |
| `Services/Broadcast/BroadcastMatchingService` | D6 live eligibility re-check before lead rows |
| `Data/COSMOS/OfferRepository` | soft delete (`isDeleted` + `ttl`); a second delete answers false |
| `HealthChecks/SearchIndexHealthCheck` | a `Launching` country's emptiness is not index loss (D-8) |

‼️ Traps paid for in this phase: a guard written as `x < lo or x > hi` lets **NaN** through (write the range as
an inclusion); a "superset" wider search is a superset of the INDEX, not of a capped relevance-ranked fetch; a
single-flight must cache inside the shared call or the answer is lost when every caller walks away.

## SEARCH-TOPOLOGY PHASE 3C — infrastructure pieces (2026-09-25)

Record: `Data\search-topology\findings\PHASE-3C-CLOSEOUT.md`. Search rules in `clinqet-search-discovery` → "PHASE 3C CLOSE-OUT".

| Class | Role |
|---|---|
| `Services/Geocoding/GeocodeWait` | G-3: `WithinAsync(pending, waitMs, TimeProvider, ct)` — a request waits a BOUNDED time, never the full timeout + retries; null on timeout, the lookup keeps running and fills the cache. Was the search-only `SearchGeocodeWait` in `Services/Discovery` |
| `Services/Geocoding/WriteAddressGeocoding` | `WithPointAsync` — the point a SAVE gives a quote or booking address, waited `Geocoding:WriteWaitMilliseconds` (4000, validated ≤ the timeout; class default = appsettings); not placed in time ⇒ saved as it came. The two private controller copies are deleted |
| `Services/Geocoding/ProviderAddressWords` | DD-27: a saved provider address keeps its TYPED street; city, state and country become the English reverse-geocode of its point (bounded wait; not named in time ⇒ typed words kept). AI-setup addresses are NOT rewritten (their id derives from the extracted text) |
| `Services/Geocoding/GooglePlaceSuggestionService` (`IPlaceSuggestionService`) | DD-36: place suggestions + the picked place from Places API (New) with the SERVER key; one typing session token is billed once. `GooglePlacesSettings` (section `GooglePlaces`, `GooglePlacesSettingsValidator`) |
| `Services/Geocoding/StaticMapUrlSigner` (`IStaticMapUrlSigner`) | DD-36: server-signed Maps Static URLs (HMAC-SHA1 over path + query); an Area is rounded to 2 dp, never the exact point. `StaticMapSettings` (section `StaticMaps`); `StaticMapSettingsValidator` refuses a key without its secret or the reverse. Missing key ⇒ `IntegrationResource.Geocoding` Unauthorized alert |
| `Configuration/GeocodingRegistration` | binds + `ValidateOnStart` both new option sets |
| `Services/Currency/CountryResolutionService.ResolveManyAsync` | Q-12: cache first, ONE `GetByBusinessIdsAsync` ReadMany of the cold profiles, the country lookup read at most once per call |
| `Services/Search/SearchIndexerSharedResources.PolicyFor(indexName)` | W-15c: retry + circuit breaker PER INDEX (was one per host), alert keyed and titled by the index |
| `Services/Search/PublicFanOutSurvival` · `ServicePriceBandFilter` | R-16 fan-out survival; M11 the ONE budget filter (marketplace + receptionist) |
| `Services/Cart/CartService` | M2: every line priced from the catalogue on every write and read — see `clinqet-cart` |

‼️ Google Places API (New) must be ENABLED in the Google project and a Maps-Static-only key + URL signing secret created
before these endpoints answer — runbook `Data\search-topology\RUNBOOK-GOOGLE-MAPS.md`.

## Auth refresh transactions (2026-09-28)


`Services/Auth/AuthService.cs`: normal refresh and external exchange run through `ExecuteTokenRotationAsync`, an EF execution-strategy transaction with committed-replacement verification. Replacement failure rolls back the old token claim; infrastructure exceptions propagate instead of becoming invalid credentials. Conditional claims enforce unused, unrevoked and unexpired state. SQL regression coverage belongs to Identity (`RefreshSessionIntegrationTests`); EF InMemory cannot prove rotation. No schema changes.

### Profile edits preserve MFA (2026-09-28)

`AuthService.UpdateUserProfileAsync` preserves both the enabled flag and selected factor when `UpdateProfileDto.IsMfaEnabled` is omitted. The DTO has an Email factor initializer, so independently applying its `MfaType` would silently change an existing phone factor. Unit and real-SQL regressions cover both factors. Explicit MFA mutation still uses the existing profile contract; dedicated recent-authentication enforcement remains pending in `Data/auth-session-review/IMPLEMENTATION.md`.

## Post-ranking follow-ups — knowledge reading library pieces (W1–W4, audit 2026-10-01)

Authority `C:\Nik\Data\post-ranking-followups\` (`DESIGN-TALL-PAGES.md`, `DESIGN-PICTURES.md`, `findings/AUDIT.md` §6–§7).
Runtime consumers: Functions (knowledge ingest, analytics rebuild) and API (provider setup); host-side wiring in
clinqet-function-app, "Post-ranking follow-ups — knowledge ingest in this host".

- **Heavy-work gate (W1):** `IHeavyWorkGate` (clinqetcore `Interfaces/AI/`) / `Services/AI/HeavyWorkGate.cs`, a singleton
  per process in API and Functions. Bounds page drawings and picture decodes; never held across a model call; a gated
  step never calls another. Capacity `Voice:Knowledge:HeavyWorkConcurrency` (3). **Weighted** (audit A-H1):
  `EnterForPixelsAsync(pixels)` takes ceil(pixels / `Voice:Knowledge:HeavyWorkPixelsPerSlot` (14,000,000)) slots,
  1..capacity; `EnterAsync` takes one. FIFO (a large drawing at the head is never starved); a cancelled waiter leaves the
  queue and lets the ones behind it in; a slot is released once however often it is disposed.
- **PDFium (W2):** `Services/AI/Pdfium/PdfiumDocument.cs` + `PdfiumNative.cs`, own binding over `bblanchon.PDFium.Linux` /
  `.Win32` (156.0.8076); Docnet.Core is gone. Every native call takes the process-wide `PdfiumDocument.Lock`; render
  flags `FPDF_ANNOT | FPDF_RENDER_LIMITEDIMAGECACHE`; a `SafeHandle` closes a forgotten document under the lock.
  `DocumentPageRasterizer` opens/closes on the pool (`Task.Run`, A-L4), pages take one gate slot, PDF regions take slots
  by pixels; `FitWithin` sizes a page as Docnet did, without the float row loss. Pixel check: `findings/W2-PIXEL-PROOF.md`.
- **Oversize pages (W3)** — `Services/AI/Oversize/`: a page past Document Intelligence's limits
  (`Oversize:MaxReadableEdgeInches` 17, `MaxPictureEdgePixels` 10,000) or drawn under `MinScaleVsA4` (0.6) is read in
  sections and stitched. `PageTextScale` (oversize test, planning scale), `OversizeLayoutReader` (layout windows),
  `SectionPlanner` (text is never cut), `OversizePageReader` (each section banked by its exact picture),
  `SectionStitcher` (a cut table merges only when both halves agree on labels), `WholeViewFigures` (pictures a section
  cannot see, from the planning readings), `SectionedPageFigures` (figure order kept), `PictureReadingLimit` (picture
  files DI refuses whole). Driven by `VisionDocumentTranscriptionService` — one rule for knowledge and provider setup.
- `Voice:Knowledge:Oversize:*` (`VoiceKnowledgeOversizeSettings`, API + Functions). Cost limits: `MaxSectionsPerPage`
  (24, page limit), `MaxSectionReadsPerDocument` (400, file limit), `SectionReadsAlertPerDocument` (200, warning). Past a
  limit the rest is read the old way (one squeezed picture), never refused; provider told, admin alerted. The three are
  left out of `SectionedPageCachePolicy`, so raising one re-reads only pages it cut short.
- Alerts by flow (`VisionDocumentTranscriptionService.LongPageAlerts`, via `IPlatformLimitAlerts.ReportFileLimitAsync`):
  `KnowledgeLongPagesWarning` / `KnowledgeLongPageLimit` / `KnowledgeLongPagesFileLimit`;
  `TranscriptionVerificationFlow.ProviderSetup` ⇒ `ProviderSetupLongPagesWarning` / `ProviderSetupLongPageLimit` /
  `ProviderSetupLongPagesFileLimit` (B-L5).
- A-H1: layout windows sized by area so none passes the decode ceiling (a strip keeps its width, a sheet is cut both
  ways); a page needing more windows than `MaxSectionsPerPage` is read the old way, nothing bought to plan it
  (`KnowledgeLongPageLimit`); a region is drawn within the ceiling (`DocumentPageRasterizer.RegionScale`) and reports its scale.
- A-H2: a long page cut by the time budget counts its banked sections in `VisionDocumentTranscription.ReadingsBanked`.
- A-L2: the per-page limit leaves room for every later column; more columns than the limit ⇒ the page is condensed whole.
- A-M2: the per-file section count crosses pictures of text — `VisionDocumentRequest.SectionReadsBefore` in,
  `VisionDocumentTranscription.SectionReads` out; `PagesReadInPart` lists pages a limit shortened.
- `IVisionDocumentTranscriptionService.HasBankedPageAsync` — does this page of this file have a banked reading (the
  analytics rebuild replays only those).
- ‼️ The page bank's policy is `{ValidationFingerprint}:v{AdjudicationRulesVersion}:r{RenderRulesVersion}` (3 and 1 since
  2026-10-04) — NEVER the build (owner, PLAN §10, 2026-10-01: a build key re-read every page on every deploy). **Raise
  `AdjudicationRulesVersion` only when the logic that accepts a page's reading changes, `RenderRulesVersion` only when what the
  model is shown changes**; `BankRulesVersionConventionTests` (Functions) pins that code and fails until you do.
  `ReadingRules(vision, oversize)` keys banks kept elsewhere (a picture's text).
- **Pictures:** `KnowledgeImageNormalizer.DecodeTarget` (A-H3) — a JPEG past the decode ceiling decodes at the smallest
  DCT scale (⅛, ¼, ½, 1) covering the wanted size, never one past `maxDecodedPixels`. `KnowledgeImageSignature` —
  near-duplicate signature and compare. `KnowledgeImageCaptionClassifier.PromptFingerprint` — hash of the caption prompt,
  part of the description-bank key. `KnowledgeReadingNotices.PicturesOfTextReadInPart` =
  `Info_KnowledgePicturesOfTextReadInPart` (+ `_One`; en/fr/es/hi/gu).
- **Reading progress:** `KnowledgeDocumentRepository.TrySetReadingProgressAsync` — one PATCH `Set /readingProgress`
  (`KnowledgeReadingProgress {stage, done, total}`) with IfMatch, no transient retry; `Replaced` / `Conflict` / `Gone`.
- **Stale rule:** `KnowledgeProcessingRules.HasStoppedPartWay(row, staleMinutes, now, businessRows)` (clinqetcore, B-L8):
  a business's readings share one session, so a reading is stopped only when elapsed ≥ window + the overlap the other
  live readings explain (fixpoint). Callers: `KnowledgeManagementService`, `KnowledgeSpaceReservation`, API `KnowledgeController`.
- **Closest seat** (`KnowledgeRelevanceRanker.ClosestWithheld` / `Seat`, `ProviderKnowledgeSearchService.NamesACode`):
  rules in clinqet-voice-assistant and clinqet-business-search.
- **`IRecoveredWhenLost`** (clinqetshared `DTOs/Messages`): `ServiceBusService.CreateLostMessageAlertAsync` raises no
  `NotificationSendFailed` for such a payload (the platform re-creates it); the queue-health alert still fires.
  Implemented by `ProviderScoreRefreshMessage`.
