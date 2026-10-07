---
description: |
  **SHARED LIBRARIES SKILL** — Work on Clinqet shared and core libraries. USE FOR: creating/modifying enums, DTOs, models, constants, converters, extensions, filters, attributes, validation, interfaces, ApiResponse patterns. Applies to ALL files in clinqetshared/ and clinqetcore/.
---

# CLINQET SHARED & CORE LIBRARIES — COMPREHENSIVE SKILL
## ABSOLUTE RULES (READ FIRST — APPLIES TO EVERY CHANGE)

- **Comments — terse, only when they earn their place.** Default to no comments; let naming carry the meaning. **However**, write a comment when it captures non-obvious context the code itself cannot show: a hidden invariant, a subtle ordering constraint, a deliberate workaround for a known bug, a defensive choice with a real reason, or an RFC/spec citation that explains *why*. Prefer a single short line. Forbidden: restating WHAT the code does (e.g. `// increment counter` above `counter++`); multi-line narrative blocks explaining design rationale; XML doc summaries on properties whose names already convey intent; commented-out code; `// TODO` without an issue link. When in doubt, delete the comment — but don't strip a *real* WHY-comment just to chase zero.
- **No verbose docstrings on self-evident members.** A property named ``EnableAISpellCorrection`` does NOT need a doc summary. A field named ``_searchEnableAISpellCorrection`` does NOT need a multi-line ``//`` block above it. Trust naming.
- **No commented-out code, no leftover symbols, no ``// TODO`` without an issue link.**

---


## OVERVIEW

Two shared .NET 10 class libraries used across all backend projects (Main API, Identity API, Function App, Infrastructure).

- **Clinqet.Shared** (`C:\Nik\clinqetshared\`) — DTOs, Enums, Constants, Models, Converters, Extensions, Filters, Attributes
- **Clinqet.Core** (`C:\Nik\clinqetcore\`) — Entities, Interfaces, Validation

---

## CLINQET.SHARED STRUCTURE

```
clinqetshared/
├── Attributes/           # Custom validation & metadata attributes
│   ├── McpToolAttribute.cs            # MCP (Model Context Protocol) tool metadata
│   ├── FlexibleUrlAttribute.cs        # URL validation
│   ├── ValidFriendlyNameAttribute.cs  # Friendly name validation
│   ├── PasskeyValidationAttributes.cs # Passkey validation
│   └── SwaggerSchemaExampleAttribute.cs
├── Constants/            # Shared constants
│   ├── ClaimConstants.cs              # JWT claim names (UserType, UserNumber, etc.)
│   └── SystemConstants.cs             # System-wide constants
├── Converters/           # JSON converters
├── DTOs/
│   └── COSMOS/           # 10 DTO files (booking, customer, notification, invoice, etc.)
├── Enums/                # 84 enum files (verified 2026-05-16)
├── Extensions/           # Extension methods
├── Filters/              # Action filters
├── Models/               # 33+ model files
│   ├── ApiResponse.cs                 # Standard response envelope
│   ├── PagedResult.cs                 # Pagination wrapper
│   └── Settings classes (30+)         # AI, Broadcast, Communication, Infrastructure settings
└── obj/bin/              # Build output
```

---

## API RESPONSE ENVELOPE (Models/ApiResponse.cs)

### Structure

```csharp
public class ApiResponse<T>
{
    public bool Success { get; set; }

    [JsonIgnore]
    public int StatusCode { get; set; }

    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public T? Data { get; set; }

    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Message { get; set; }

    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public List<string>? Errors { get; set; }
}
```

### Factory Methods

```csharp
ApiResponse<T>.Ok(data, message?)               // 200 Success
ApiResponse<T>.Created(data, message?)           // 201 Created
ApiResponse<T>.Fail(message, errors?, statusCode)// 400+ Error
ApiResponse<T>.NotFound(message?, errors?)       // 404
ApiResponse<T>.Conflict(message?, errors?)       // 409
ApiResponse<T>.Unauthorized(message?)            // 401
ApiResponse<T>.Forbidden(message?)               // 403
ApiResponse<T>.InternalError(message?, errors?)  // 500
```

### ServiceResponse<T> (for service-layer results)

```csharp
public class ServiceResponse<T>
{
    public bool IsSuccess { get; set; }
    public T? Data { get; set; }
    public ErrorCode? ErrorCode { get; set; }
    public string? ErrorMessage { get; set; }
}

// Extension: .ToApiResponse() converts ServiceResponse to ApiResponse
```

---

## PAGINATION (Models/PagedResult.cs)

```csharp
public class PagedResult<T>
{
    public IEnumerable<T> Items { get; set; }
    public string? ContinuationToken { get; set; }
    public int TotalCount { get; set; }
}

public class PagedRequest
{
    public int PageSize { get; set; } = 20;
    public string? ContinuationToken { get; set; }
}
```

---

## ENUMS (84 total in Enums/ — verified 2026-05-16)

Some files contain multiple enums and a few are static-constant helper classes (`CommunicationStatuses`, `CommunicationSubTypes`, `UserActivityTypes`, `MarketingSignupSource`, `CosmosEnum`) — those don't get `[JsonConverter]` because they aren't true enums.

### SERIALIZATION RULE (NON-NEGOTIABLE)
ALWAYS serialize as **string values**, NEVER integers.

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

// In Cosmos entities (dual converter for Newtonsoft compatibility):
[JsonConverter(typeof(StringEnumConverter))]                        // Newtonsoft
[System.Text.Json.Serialization.JsonConverter(typeof(JsonStringEnumConverter))]  // System.Text.Json
public BookingStatus Status { get; set; }

// In serializer options:
new JsonSerializerOptions { Converters = { new JsonStringEnumConverter() } }
```

### Enum Categories (full list — verified 2026-05-16)

| Category | Enums |
|----------|-------|
| **Admin / Alerts** | `AdminAlertSeverity`, `AdminAlertType` |
| **Analytics / Activity** | `AnalyticsEventType`, `UserActivityTypes` (static const class) |
| **Application / Platform** | `AppType` (Partner, Admin, Clinket), `Platform` (Web, IOS, Android) |
| **Audio / Media** | `AudioLanguage` (28 langs), `MediaProcessingStatus` (Pending/Ready/Failed/Skipped), `MediaParentEntity` (Message/Service/Portfolio/Review/License/BusinessProfile) |
| **Blob / File** | `FileAccessPolicy` (declared in BlobAccessPolicy.cs) |
| **Booking** | `BookingStatus`, `CancellationType` (CustomerCancellation/ProviderCancellation/SystemTimeout) |
| **Broadcast** | `BroadcastBidStatus`, `BroadcastBudgetType`, `BroadcastMatchingStrategy`, `BroadcastProviderStatus`, `BroadcastServiceLocationType`, `BroadcastStatus`, `BroadcastUrgency` |
| **Business** | `BusinessProfileStatus` (Active, Pending, Inactive, Suspended) |
| **Cart** | `CartIdentifierType` (User/Device), `CartStatus` (Active/Converted) |
| **Chat / Conversation** | `ChatInteractionType` (SearchService/ManageBooking/ManageQuote/ManageService), `ConversationContext` (Direct/Broadcast/Quote/Booking), `ConversationStatus` (Active/Archived/Blocked/Closed), `SenderType` (Customer/Provider/System) |
| **Communication** | `CommunicationEventType`, `CommunicationEventStatus`, `CommunicationOperationType`, `CommunicationStatuses` (static const), `CommunicationSubTypes` (static const) |
| **Correction / Spelling** | `CorrectionMethod`, `SpellCorrectionSource` |
| **Cosmos / Database** | `CosmosEnum` (static const: PriceTypes/DistanceUnits/DiscountTypes), `DocumentType` (full enum with all entity type names) |
| **Country / Location** | `CountryCode` (US/CA/IN/GB/AU/FR/DE/ES/MX/BR/JP/KR/IT/NL/NZ/ZA/NG/SG/AE/PH/PK/BD/IE/PT), `DayOfWeek`, `LocationSource` |
| **Device** | `DeviceTokenPlatform` (iOS/Android/Web) |
| **Distance / Duration** | `DistanceUnit` (Kilometers/Miles), `DurationUnit` (Minutes/Hours/Days) |
| **Email** | `EmailType` (Confirmation/Reminder/BookingCancellation/BookingTimeout/ProviderConfirmationRequest/QuoteReceived/BookingRejection/BookingCompleted/BookingUpdated) |
| **Error** | `ErrorCode` (VALIDATION_FAILED, TIMEOUT, AI_*, etc.) |
| **External Providers** | `ExternalLoginProvider` (Google/Facebook/Microsoft/Twitter/GitHub/Apple) |
| **Invoice** | `InvoiceStatus` (Draft/Sent/Paid/Overdue/Cancelled) |
| **Marketing** | `MarketingAction` (Subscribe/Update/Unsubscribe), `MarketingSignupSource` (static const) |
| **Message** | `MessageChannel` (Platform/WhatsApp/SMS/Email), `MessageType` (Text/Bid/BidUpdate/BidWithdrawal/BidAccepted/BidRejected/System/Attachment), `MfaType` (Email/Phone) |
| **Notification** | `NotificationContext`, `NotificationType` (BookingCreated, …, CartReminder, ReviewApproved, BookingAutoCompleted, etc.) |
| **Offer / Passkey** | `OfferStatusFilter`, `PasskeyType` (Biometrics) |
| **Preferences / Social** | `PreferenceCategory` (BookingNotifications/BookingReminders/QuotesInvoices/BroadcastOpportunities/MessagesChats/ServiceApprovals/MarketingPromotions/CartReminders/ReviewsRatings), `SocialPlatform` (Facebook/Instagram/YouTube/LinkedIn/Twitter/Website) |
| **Quote** | `QuoteStatus` (Draft/Sent/Accepted/Rejected/Expired) |
| **Recently Viewed** | `RecentlyViewedItemType` |
| **Reasoning / AI** | `ReasoningEffort` (None/Low/Medium/High) |
| **Review** | `ReviewModerationAction` (Approve/Reject), `ReviewStatus` (Pending/Approved/Rejected), `ReviewReportReason` (Spam/Inappropriate/FakeReview/Harassment/OffTopic/PrivacyViolation/Other), `VoteType` (None/Helpful/Unhelpful) |
| **Search** | `SearchExpansionReason`, `SearchFilterReason`, `SearchFusionStrategy`, `SearchInvocationMode` (Query/BrowseCatalog/Recommendation/ProviderSearch), `SearchLatencyBucket`, `SearchMatchQuality`, `SearchMatchType`, `SearchMessageKey`, `SearchRetentionOutcome`, `SearchSortBy`, `SemanticSkipReason` |
| **Service Approval** | `ServiceApprovalStatus` (PendingApproval/PendingAIValidation/Approved/Rejected/AIRejected/PendingProviderCompletion) |
| **SMS** | `SmsCategory` (Transactional/Notification), `SmsProvider` (Telnyx/TwoFactor) |
| **Spotlight** | `SpotlightSurface` (Web/Mobile), `SpotlightType` (Onboarding/Dashboard) |
| **Suggest** | `SuggestScope` (All/Completions/TopHits) |
| **Support / User** | `SupportQueryType`, `UserType` (Unknown/Partner/Customer/Admin — uses custom `UserTypeJsonConverter`, NOT the default `JsonStringEnumConverter`) |

`EnumSchemaFilter` is a Swagger filter, NOT an enum — counted in the directory file list but excluded from enum logic. `CountryCodeHelper` is a helper class on top of `CountryCode`.

---

## CONSTANTS (Constants/)

### ClaimConstants.cs
```csharp
public static class ClaimConstants
{
    public const string Name = "name";
    public const string UserType = "UserType";
    public const string UserNumber = "UserNumber";
    public const string ProfilePictureUrl = "ProfilePictureUrl";
    public const string DefaultCustomerName = "Customer";
    public const string DefaultProviderName = "Provider";
    public const string DefaultUserName = "User";
}
```

### SystemConstants.cs
```csharp
public static class SystemConstants
{
    public const string SystemSender = "System";
}
```

---


## WORK-LIST DAY FILTERS (Models/Filters/) — 2026-09-03

- `DayRangeFilter` — base for `BookingFilter`/`QuoteFilter`/`InvoiceFilter`. ‼️ **`DateOnly?`**
  `StartDate`/`EndDate`, because every filter picker in every app is a day picker (`type="date"` /
  `mode="date"`). Carried as `DateTime?` the server had to invent a clock time, chose midnight, and dropped
  the whole final day of every range. Query-string names are unchanged; a client that appends a time now
  fails to bind.
- `DateRangeFilter` — **DELETED.** Every work-list and admin filter is day-shaped now, so it had no consumers
  left. Do not reintroduce a DateTime-based range filter.
- `DateRangeBounds` — the resolved half-open `[From, ToExclusive)`. `FromWallClockDays` (no zone,
  `Unspecified` kind) for wall-clock columns; `FromBusinessDays(…, zone)` (UTC, DST-safe) for `createdAt`/
  `updatedAt`. `BookingTimestampBounds` carries the two UTC axes to the repository.
- Full contract and who-resolves-what: `clinqet-cosmos-data` → **WORK-LIST DAY FILTERS**.
## DTO VALIDATION PATTERN

ALL validation messages MUST use localization keys:

```csharp
public record CreateBookingDto(
    [Required(ErrorMessage = "Error_ServiceIdRequired")]
    [Display(Name = "Label_ServiceId")]
    string ServiceId,

    [Required(ErrorMessage = "Error_DateRequired")]
    [Display(Name = "Label_BookingDate")]
    DateTime BookingDate,

    [StringLength(500, ErrorMessage = "Error_NotesMaxLength")]
    string? Notes
);
```

### Key Rules
- Error message keys: `Error_FieldRequired`, `Error_FieldMaxLength`, `Error_InvalidValue`
- Display name keys: `Label_FieldName`
- Resolved at runtime by `LocalizedModelValidatorProvider`
- New keys MUST be added to `clinqetinfrastructure/Resources/Localization/en.json`

---

## SETTINGS MODELS (Models/)

30+ settings classes for strongly-typed configuration:

| Category | Classes |
|----------|---------|
| **AI** | `AIServiceSettings`, `AIAssistantSettings` |
| **Broadcast** | `BroadcastSettings`, `BroadcastClassificationSettings`, `BroadcastSearchEnrichmentSettings` |
| **Communication** | `NotificationSettings`, `MessagingSettings`, `CommunicationPreferenceConfig` |
| **Infrastructure** | `CosmosDbSettings`, `ServiceBusSettings`, `StorageConfiguration`, `MailgunSettings`, `MailchimpSettings`, `RecaptchaSettings` |
| **Search** | `GeocodingSettings` (with `GeocodingResult`, `ResolvedLocation`) |
| **Media** | `PdfSettings`, `QRCodeSettings` |
| **SignalR** | `SignalRHubSettings` |
| **Analytics** | `AnalyticsSettings` |
| **Domain** | `ServiceImage`, `Attachment`, `EmailTemplate`, `NotificationMetadata`, `SmsResult` |

---

## NOTIFICATION & COMMUNICATION MODELS

### DTOs

**NotificationDto** (`DTOs/COSMOS/NotificationDto.cs`) — Record DTO for SignalR client delivery:
```csharp
public record NotificationDto(
    string NotificationId, string RecipientId, string RecipientType,
    string Title, string Body, NotificationType NotificationType,
    bool IsRead, string? Priority, DateTime CreatedAt, DateTime ExpiresAt,
    Dictionary<string, string>? Data, NotificationMetadata? Metadata);
```

**NotificationMessage** (`DTOs/Messages/NotificationMessage.cs`) — Service Bus message model:
```csharp
public record NotificationMessage : ServiceBusMessageBase
{
    public string RecipientId { get; init; }
    public RecipientType RecipientType { get; init; }
    public string Title { get; init; }
    public string Body { get; init; }
    public string NotificationType { get; init; }  // String, NOT enum
    public string Priority { get; init; } = "Normal";
    public Dictionary<string, string>? Data { get; init; }
    public NotificationMetadata? Metadata { get; init; }
    public bool SkipMobilePush { get; init; }
}
```

**SignalRNotificationRequest** (`DTOs/SignalR/SignalRNotificationRequest.cs`) — Internal API request DTO:
```csharp
public class SignalRNotificationRequest
{
    public string NotificationId { get; set; }
    public string RecipientId { get; set; }
    public string RecipientType { get; set; }
    public string Title { get; set; }
    public string Body { get; set; }
    public string Type { get; set; }          // NotificationType enum as string
    public string Priority { get; set; } = "Normal";
    public Dictionary<string, string>? Data { get; set; }
    public NotificationMetadata? Metadata { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime ExpiresAt { get; set; }
}
```

### CommunicationPreferenceConfig (Models/CommunicationPreferenceConfig.cs)

Static mapping of `NotificationType` → `PreferenceCategory` for both Provider and Customer.

**Mandatory email categories** (cannot be opted out): `BookingNotifications`, `QuotesInvoices`
**SMS eligible categories**: `BookingNotifications`, `BookingReminders`, `BroadcastOpportunities`, `MarketingPromotions`

**Provider mappings** (7 categories, 40+ notification types):
- `BookingNotifications`: BookingCreated, BookingConfirmed, BookingCancelled, etc. (11 types)
- `BroadcastOpportunities`: BroadcastReceived, BroadcastBidReceived, etc. (14 types)
- `QuotesInvoices`, `BookingReminders`, `MessagesChats`, `ServiceApprovals`, `MarketingPromotions`

**Customer mappings** (6 categories):
- `BookingNotifications`: 6 types
- `BroadcastOpportunities`: 8 types
- Others follow similar structure

### SignalRHubSettings (Models/SignalRHubSettings.cs)

```csharp
public class SignalRHubSettings
{
    public bool SendHistoricalOnConnect { get; set; } = true;
    public int HistoricalNotificationCount { get; set; } = 10;  // Max 50
    public bool AzureSignalREnabled { get; set; }
}
```

### Key Interfaces (Core)

- `INotificationClient` (`Interfaces/SignalR/`) — SignalR hub client interface (ReceiveNotification, NotificationRead, etc.)
- `ICommunicationDispatcher` (`Interfaces/Communication/`) — Entry point for multi-channel dispatch with `CommunicationRequest` + `DispatchResult`
- `IPushNotificationService` (`Interfaces/Services/`) — Mobile push delivery

---

## CUSTOM ATTRIBUTES (Attributes/)

### McpToolAttribute
Metadata for AI tool discovery (MCP — Model Context Protocol):
```csharp
[McpTool("GetServices", Group = "Service", Description = "...",
    IsReadOnly = true, Tags = new[] { "services" })]
```

Properties: `Group`, `Description`, `IsReadOnly`, `InteractionTypes`, `Tags`, `Priority`, `HasComplexSchema`, `RequiresBusinessContext`

### Validation Attributes
- `FlexibleUrlAttribute` — URL format validation
- `ValidFriendlyNameAttribute` — Friendly name rules
- `RequireIdentifierAttribute`, `ValidatePasskeyAuthenticationAttribute` — Passkey validation

---

## CLINQET.CORE STRUCTURE

```
clinqetcore/
├── Entities/COSMOS/       # 7 entity files (BaseEntity, BusinessProfile, Booking, AiSession, etc.)
├── Interfaces/
│   ├── COSMOS/           # 32 repository interfaces (IBookingRepository, IServiceRepository, etc.)
│   ├── Services/         # 22 service interfaces
│   ├── AI/               # AI service interfaces
│   ├── Analytics/        # Analytics interfaces
│   ├── Auth/             # Auth interfaces
│   ├── Broadcast/        # Broadcast interfaces
│   ├── Communication/    # Communication interfaces
│   ├── Language/         # Localization interfaces
│   ├── Messaging/        # Messaging interfaces
│   ├── Search/           # Search interfaces
│   ├── SignalR/          # SignalR interfaces
│   └── Storage/          # Storage interfaces
├── Validation/
│   ├── LocalizedValidationMetadataProvider.cs  # Resolves localization keys in validation
│   └── ModelBinders.cs                         # Custom model binding
└── Models/                # Core domain models
```

---

## INTERFACE PATTERN

### Repository Interface
```csharp
public interface IBookingRepository : ICosmosDbRepository<Booking>
{
    Task<Booking> CreateBookingAsync(Booking booking);
    Task<Booking?> GetByIdAsync(string bookingId, string businessId);
    Task<PagedResult<Booking>> GetPaginatedAsync(string businessId, BookingQueryDto query);
}
```

### Base Repository Interface
```csharp
public interface ICosmosDbRepository<T> where T : BaseEntity
{
    Task<T?> GetItemAsync(string id, string partitionKey);
    Task<IEnumerable<T>> GetItemsAsync(string query, string partitionKey);
    Task<T> AddItemAsync(T item, string partitionKey);
    Task<T> UpdateItemAsync(T item, string partitionKey);
    Task<bool> DeleteItemAsync(string id, string partitionKey);
    // ... more methods
}
```

### Service Interface
```csharp
public interface IBookingService
{
    Task<ServiceResponse<BookingDto>> CreateBookingAsync(CreateBookingDto dto, string businessId);
    Task<ServiceResponse<BookingDto>> GetBookingAsync(string bookingId, string businessId);
}
```

---

## CART / BASKET

### DTOs (`C:\Nik\clinqetshared\DTOs\COSMOS\CartDtos.cs`)

| DTO | Purpose |
|-----|--------|
| `SaveCartRequestDto` | Full cart save request (providers, currency, notes, address) |
| `CartProviderGroupDto` | Provider group in request (providerId, providerName, items) |
| `CartItemDto` | Individual item (serviceId, serviceName, quantity, price, offer, notes) |
| `CartPriceDto` | Price details (amount, currency, formattedPrice) |
| `CartAppliedOfferDto` | Applied offer (offerId, title, discountPercentage, discountedPrice) |
| `CartAddressDto` | Address (formattedAddress, latitude, longitude) |
| `CartResponseDto` | Full cart response (id, providers, status, currency, notes, itemCount, providerCount, expiresAt) |
| `UpdateCartItemQuantityDto` | Quantity update request |

### Validation
- All DTO validation attributes use localization keys: `Error_CartProvidersRequired`, `Error_CartItemsRequired`, `Error_QuantityRange`, `Error_NoteMaxLength`, `Error_ServiceIdRequired`

### Models
- **CartSettings** (`C:\Nik\clinqetshared\Models\CartSettings.cs`): `CartExpiryDays`, `MaxItemsPerCart`, `MaxProvidersPerCart`, `EnableCartReminders`, `CartReminderDelayHours` (int[]), `RateLimiting` (nested)
- **CartReminderMessage** (`C:\Nik\clinqetshared\Models\CartReminderMessage.cs`): Service Bus message with `CartId`, `Pk`, `RecipientUserId`, `RecipientEmail`, `RecipientFullName`, `PreferredLanguage`, `CartItemCount`, `ReminderIndex`

### Cart Enums
- `CartStatus` (`C:\Nik\clinqetshared\Enums\CartStatus.cs`): `Active`, `Converted`
- `CartIdentifierType` (`C:\Nik\clinqetshared\Enums\CartIdentifierType.cs`): `User`, `Device`

---

## CHECKLIST

- [ ] Every new enum has `[JsonConverter(typeof(JsonStringEnumConverter))]` at the type level and `using System.Text.Json.Serialization;`
- [ ] Enums serialize as strings (both Newtonsoft + System.Text.Json converters on entity properties)
- [ ] DTO validation uses localization keys
- [ ] ApiResponse factory methods used correctly
- [ ] PagedResult for paginated responses
- [ ] Interface defined for every new repository/service
- [ ] Constants defined in Constants/ (not hardcoded)
- [ ] New keys added to en.json
- [ ] No hardcoded values where enums or appsettings can be used

## External OAuth exchange contracts (2026-08-11)

- `Enums/ExternalLoginResponseMode.cs` is string-serialized and defines `LegacyUrlTokens`, `SecureCookieExchange`, and `SecureCodeExchange`. Clinket customer callers may use only the two secure values.
- `Constants/ExternalLoginExchangeConstants.cs` freezes the cookie `__Host-ClinketExternalLogin`, header/value `X-Clinket-External-Login: exchange`, web marker `external_login=complete`, mobile query key `code`, PKCE method `S256`, and callback `clinket://auth/external-login`.
- `DTOs/Identity/ExternalLoginExchangeDtos.cs` defines `ExternalLoginCodeExchangeRequestDto` with `Code` and `CodeVerifier`; it is mobile-only. The web exchange has no request DTO and reads only its HttpOnly cookie.
- `Models/ExternalLoginExchangeSettings.cs` defaults `LifetimeMinutes` to 5, matching Identity appsettings. `IAuthService` exposes `PrepareExternalLoginExchangeAsync` and `ExchangeExternalLoginTokenAsync`; both reuse the existing SQL `RefreshToken` row and add no schema.

## Password-management contracts (2026-07-22)

- `SetPasswordDto` carries `NewPassword` and `ConfirmPassword`; `ChangePasswordDto` also carries `CurrentPassword`. New and reset password fields use localized 8–128 character validation plus a composition `[RegularExpression]` (≥1 uppercase, ≥1 digit, ≥1 special → `Error_PasswordComposition`) and confirmation matching. Their `Error_PasswordLength` resource is static localized text with the numbers written out — nothing formats `{1}`/`{2}` placeholders on the DTO validation path.
- `UserProfileDto.HasPassword` is the cross-client capability flag. `UserActivityTypes.PasswordSet` and `NotificationType.PasswordSet` are string-serialized contract values; append rather than renumber enum members.

---

## DTO VALIDATION MESSAGES: RESOLVE FIRST, FORMAT SECOND (2026-07-26)

A `[StringLength(20, ErrorMessage = "Error_X", MinimumLength = 3)]` message is localized by MVC's
DataAnnotations localizer, which receives the **key plus the attribute's arguments** and must resolve
then format. `BaseController.ValidationFailed()` localized *after* ASP.NET had already formatted, so
the arguments were discarded and **52 annotation sites (25 keys) showed users a literal `{1}`/`{2}` in
every language**. Fixed by `Replace`ing `IStringLocalizerFactory` with
`JsonStringLocalizerFactory` (`clinqetinfrastructure/Services/Language/`) in both API hosts.

‼️ **`{0}` is ALWAYS the display name. Numbers start at `{1}`, and the order is per-attribute:**

| Attribute | After `{0}` |
|---|---|
| `StringLength` | `{1}`=max, `{2}`=min |
| `MaxLength` / `MinLength` | `{1}`=length |
| `Range` | `{1}`=min, `{2}`=max |
| `RegularExpression` | `{1}`=pattern |

7 keys had been authored with `{0}` as the limit; enabling the localizer without correcting them would
have rendered "must not exceed **Label_Message** characters". When adding or editing a validation
message, check the attribute — not the sentence. `ValidationMessagePlaceholderTests`
(Clinqet.API.UnitTests/Conventions) scans the DTO source and all four language files and fails the
build on `{0}`-as-a-value, an unsupplied index, or a translation whose placeholders drift from English.

A **manual** `string.Format(GetLocalizedString(key, lang), arg)` call site is a different convention —
there `{0}` is your first argument (e.g. `ClinqetPasswordValidator`). The guard scans DTO annotations
only, on purpose.

Manual `ModelState.AddModelError(field, "Error_Key")` calls still put **raw keys** into ModelState, so
`ValidationFailed()` must keep resolving; `GetLocalizedString` echoes its input on a miss, which is
what lets an already-formatted sentence pass through unchanged.

### The three dead attempts are DELETED (proved, not assumed)

Tripwire exceptions were planted in `LocalizedValidationMetadataProvider.CreateValidationMetadata` and
in the `LocalizedModelValidatorProvider` branch that assigns `LocalizedAttributeValidator`, then the
full API + Identity integration and unit suites were run with them armed: **2539 tests, zero tripwires
hit.** Both paths are unreachable — the metadata provider was never added to
`MvcOptions.ModelMetadataDetailsProviders`, and the validator provider skips every item because the
built-in DataAnnotations provider always sets `Validator` first.

`clinqetcore/Validation/LocalizedValidationMetadataProvider.cs` (all three classes) is deleted, with its
registrations in both hosts and both fixtures, the orphaned usings, and a now-pointless
`RemoveAll<IValidationMetadataProvider>()`. **One live localization path, no decoys** — a decoy that
looks like the fix is how this bug survived four attempts.

## Phase 4B additions (2026-07-28)

- `Enums/ClinketBadgeType` — `FromClinket` / `Preferred` / `Partner`. Admin-GRANTED trust marks;
  `Pro` / `Top Pro` are tier-derived and are NOT members. ‼️ **Any value earns the same ranking
  tie-breaker**, so adding a member has a ranking consequence (Boost Register, plan 5.-1).
- `Enums/ProviderSuspensionReason` — the admin suspend dropdown. A fixed set because an admin types one
  language while customers read five, and free text about a named business is a defamation risk.
  ‼️ **Locale keys are deliberately NOT added yet** — nothing resolves them until the cancel-and-notify
  work lands, and keys nothing reads are dead config.
- `Enums/AdminAlertType.ProviderBadgeChanged`.
- `Models/BannerSettings` + `DTOs/Discovery/BannerDtos` — ‼️ **no `tierLevel` on a slide**: commercial
  standing orders the server's answer and is not a customer-facing fact.
- `DTOs/Admin/AdminProviderDtos`.
- `isFeatured` removed from `SearchResponseDto` and `RecommendedProvidersResponseDto`; **kept** on
  `ProviderBillingDtos` (the sold benefit line).

---

## ‼️ MULTI-USER TENANCY (2026-08-01 → 2026-08-04) — everything this project contributes

> **The whole model is one skill: read `clinqet-provider-teams` before any tenancy change.** This section
> is the `clinqetshared` inventory only.

### Constants

| File | Holds |
|---|---|
| `Constants/IdentifierNamespace.cs` | `Alphabet` · `UserNumberLength = 5` · **`BusinessIdLength = 6`** · `StoredMaxLength = 16`. ‼️ The lengths are **disjoint on purpose**: `Communications` is partitioned by one path (`/userNumber`) and holds notifications keyed by a PERSON **and** conversations keyed by a **BUSINESS**, so equality would put two tenants in one logical partition |
| `Constants/BusinessContextClaimTypes.cs` | `BusinessId` · `MembershipId` · `AuthorizationVersion` · `BusinessRoles` · `BusinessAccess`. **Names frozen by a convention test.** ‼️ `BusinessRoles` is a coarse comma-joined set for **UI affordances ONLY, never authorization** |
| `Constants/SensitiveOperations.cs` | The seven §7.4 keys that re-verify against **live SQL**: `business.lifecycle.manage` · `business.transfer_ownership` · `payment.refund_approve` · `payout.export` · `payout.manage_account` · `team.assign_role` · `voice.number.manage`. ‼️ `payout.export` and `voice.number.manage` have **zero endpoints today** — they are on the list so the day one appears, a convention test forces it onto the live path |
| `Constants/TenancyErrorCodes.cs` | **35 machine codes** + `TenancyLocalizationKeys`. The frontends branch on the **CODE**, never the status or the message |

### Enums (all with a type-level `[JsonConverter(typeof(JsonStringEnumConverter))]`)

`BusinessStatus` (Onboarding/Active/Suspended/Closed) · `BusinessAccessScope` (**Full/BillingOnly**) ·
`MembershipRelationshipType` (Owner/Employee/Contractor/Partner/Guest) ·
`MembershipStatus` (Invited/Active/Suspended/Removed) · `InvitationStatus` ·
**`PermissionScope`** (None/CreatedByMe/Participating/Assigned/Branch/Team/Business) ·
`AuthorizationEventType` · `BusinessEventCategory` (the 8 D5 routing classes) · `BusinessActorType`
(Member/PlatformAdmin/System) · `BusinessActivityType` (**NINE** members) · `NotificationRoutingClass` ·
`NotificationRoutingTarget` · `NotificationDeliveryChannel` · `NotificationDeliveryMode` ·
`AdminTenancyMatchReason`.

‼️ **`PermissionScope` is ordered narrow → broad DELIBERATELY**, so L27's "two roles granting one
permission at different scopes ⇒ the BROADER wins" is a comparison rather than a lookup table.

‼️ **`BusinessAccessScope` has NO `None`, and adding one is NOT a free safety win.**
`RequiresPermissionAttribute` and `NotificationRecipientResolver` both branch on **`== BillingOnly`**, so a
`None` member would fall into the **permissive** branch and behave *less* restrictively than `BillingOnly`.
`NotificationHub` already uses the safe positive form (`!Granted || Scope != Full`). **Convert those two
sites to positive `== Full` checks first, or leave the enum alone.**

‼️ **`BusinessActivityType` has NINE members, not six** — `PHASE-08` §2.9 says six and is wrong. All nine
have a `BusinessActivity_*` localization key in each of the five API catalogs.

‼️ **`MembershipStatus.Invited` is a DEAD VALUE.** A repo-wide grep returns exactly two hits — a predicate
and the entity's default initialiser. **Nothing anywhere creates an `Invited` membership row**, because
`00-SOLUTION` §4.4 forbids a nullable-`UserId` membership: a pending invitation is a `BusinessInvitation`
row and nothing else. A seat count that branched on it was therefore **inert** (casebook CASE 2).
**A reader with no writer is a dead predicate — grep for the WRITER of every enum value you branch on.**

### Models

| File | Holds |
|---|---|
| `Models/TenantContext.cs` | the request-scoped record + `ScopeFor(key)` · `Has(key, minimumScope)` · ‼️ **`Satisfies(permissions, key, minimumScope)` — ONE scope rule with TWO callers** (the cached context and the live snapshot). A second copy could drift and silently widen one of them |
| `Models/AuthorizationSnapshot.cs` | the cached SQL resolution + `AuthorizationSnapshotResult` with `.Allow()` / `.Deny()` |
| `Models/ScopedResource.cs` | `readonly record struct ScopedResource` + `ScopeDecision` + `ScopeEvaluation`. ‼️ **Never hand-build one** — use `Clinqet.Core.Entities.COSMOS.ScopedResourceExtensions.ToScopedResource(...)`, because `SupportsAssignment: false` on a type that DOES support assignment **denies silently** |
| `Models/TenancySettings.cs` | `BusinessId` · `BusinessCreation` · `Seats` · `Authorization` · `AccessChange` · `Activity` · `Branch` · `Invitations` · `Lifecycle` · `Inbox` · **`BusinessContext`** options classes. **Every class default mirrors `appsettings.json` exactly** |
| `Models/HealthCheckSettings.cs` | + `HealthCheckAccessChangeSettings` (`TimeoutSeconds` 10 · `DegradedAfterSeconds` 300 · `UnhealthyAfterSeconds` 900) |
| `Models/BusinessTokenContext.cs` · `AccessChangePayload.cs` | ‼️ `AccessChangePayload` is a **POSITIONAL record** and carries the **SUBJECT's** `UserId`, **never the ACTOR's** — which is why "who suspended this member" needed two columns on `BusinessMembership` |
| `Models/ActorAttribution.cs` · `BranchSummary.cs` | `BranchSummary` is **identity only** — `BranchId`/`Name`/`IsDefault`, **no geography** (L57) |
| `Utilities/BusinessAccessPolicy.cs` | ‼️ **the ONE pure gate**, consulted by both the workspace list and the token exchange so a selector can never offer something that 403s on click. `Onboarding` **grants** (L46). "No live membership" and "no such business" return the **IDENTICAL** key — no enumeration oracle |
| `Utilities/IdentifierCodeGenerator.cs` | `NewCode` |

### DTOs

`DTOs/Identity/BusinessContextDtos.cs` (incl. `BusinessAccessSummaryDto` and
`BusinessMembershipSummaryDto`) · `DTOs/Tenancy/TeamManagementDtos.cs` (the Phase 8 UI contract) ·
`DTOs/Tenancy/BusinessActivityDtos.cs` · `DTOs/Tenancy/NotificationSettingsDtos.cs` (incl.
`TeamActivityAudience`, a **wire-only enum, never persisted**) · `DTOs/Admin/AdminTenancyDtos.cs`.

‼️ **`BusinessMembershipSummaryDto.AccessScope` is NULLABLE and null exactly when `CanEnter` is false**,
because `default(BusinessAccessScope)` is **`Full`** — a non-nullable scope on an unenterable row would
advertise full access. It carries **no unread count**, so the switcher must never issue a request per
business. ‼️ **`LastAccessAt` is nullable AND can arrive as the .NET zero date, which is TRUTHY** — a bare
truthiness check sorts a never-opened workspace to the top of a most-recent-first list.

‼️ **`CreateInvoiceRequestDto.BusinessId` WAS DELETED (H3), and this is the rule it established:**
**a provider-gated request DTO must never carry a settable `BusinessId`.** The field was `[Required]`, was
used as the **Cosmos partition key**, and let a member of Business A write into Business B's partition.
`[RequiresPermission]` **cannot** guard a body — the body is not read until model binding runs after the
authorization filter. `ProviderEndpointAuthorizationTests.NoProviderEndpointAcceptsABodyThatAssertsABusinessId`
now **fails the build** on any such field. `BusinessName` deliberately remains: display copy on the
caller's own invoice is not a tenant boundary.

### `Models/ServiceBusSettings.cs`

`+ AccessChangesQueueName = "access-changes"` and `NotificationDigestsQueueName`. Both **are** in ARM
(`azureautomation/events.json`) and `deploy.ps1` — they are real Azure resources.

### ‼️ 2026-08-04 — `TenancyErrorCodes.TeamNameInUse` (SK5)

`team_name_in_use`, HTTP **409**, key `Error_TeamNameInUse` — which **already existed and was already
translated in all five catalogs**; only the machine code was missing, so a duplicate team name answered
`team_not_found` / 404 while saying the name was taken.

‼️ **One code per distinguishable outcome.** A duplicate name and a vanished team are two different facts
and the screens do **opposite** things, so sharing a code forces the client to parse the **translated
message** — exactly what this constants file exists to prevent. Same split CP6 made for
`BranchNameInUse`; teams were missed by it.

‼️ **Uniqueness is per BUSINESS** (`UX_BusinessTeam_Business_Name` is on the **pair**), so another
business using the same team name never collides — asserted by
`TwoDifferentBusinessesMayBothHaveATeamCalledDispatch`, not assumed from the index name.

**The catalogue is now 36 codes.** Adding one is a C# constant, **not schema** — Rule Zero does not apply,
and no migration, column or index is involved.

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

## AI resource alert contracts (2026-09-15)

`AdminAlertType` carries one `{Resource}ResourceLimit` value per `IntegrationResource` (14 of them) plus `EmailSendFailure` and `EmailDeliveryFailure`; `IntegrationResource` names the dependency and `IntegrationFailureKind` the wall. `IIntegrationHealthAlerts.Report` takes one `IntegrationFailureSignal` (resource, scope, kind, status, error code, operation, sample). `AdminAlertSettings` has independent enabled-by-default gates for the two types. `IntegrationHealthAlertSettings` defines cooldown (15 minutes), publish timeout (30 seconds), failed-publish backoff (30 seconds) and diagnostic inspection limit (65536 bytes). Metadata uses the existing admin-alert dictionary; no entity/schema fields were added. See the infrastructure skill for lifecycle and cancellation semantics. â¼ï¸ SUPERSEDED 2026-09-19: the AI-only publisher was generalised into `IIntegrationHealthAlerts` over 14 resources and `AiResourceLimitAlerts`/`IAiResourceLimitAlerts`/`AiResourceKind`/`AiResourceLimitAlertSettings` were DELETED â see the `clinqet-integration-health` skill.

## SEARCH-TOPOLOGY PHASE 3 — shared + core contracts (2026-09-22/24)

- `CountryCodeHelper.TryParseStrict` / `ParseStrictOrNull`: ISO-2 or the canonical English name, case-insensitive,
  nothing else — the ONLY parser for a country that is stored or routed (the lenient one read "Canadá" as the US).
- `SearchPlace` (model) · `ResolvedPlaceDto` (what clients display) · enums `SearchPlaceCoverage`
  (`Listed / OutsideOurCountries / Unknown`), `SearchPlaceSource` (`Coordinates / TypedPlace / SavedAddress /
  VisitorCountry / None`), `SearchPlaceLookup` (`Network / CacheOnly`) · `VisitorCountry`.
- `ISearchTopology.ResolvePublic(CountryCode?)` is typed (B-17); `ISearchPlaceResolver`.
- `IBroadcastService.CreateAsync(..., string? idempotencyKey, CountryCode? visitorCountry, CancellationToken)` — the
  visitor's listed country is only a BIAS for a typed place (D-74), never the quote's country.
- `IOfferRepository.DeleteOfferAsync` is soft; false when missing or already deleted.
- `AdminAlertType.OfferExpirySweepIncomplete` (appended).

## SEARCH-TOPOLOGY PHASE 3C — shared + core contracts (2026-09-25)

Record: `Data\search-topology\findings\PHASE-3C-CLOSEOUT.md`. No schema change.

- ‼️ **`CountryCodeHelper.ReadCountry(country, dialingCode)`** → `(Country, DialingCode)` (DD-34): a readable name/ISO
  code (strict), else a dialling code ONE country uses (`TryFromDialingCodeStrict` — "1" names none), else EMPTY —
  never guessed as "US". Used where a person's country is stored (Identity registration + external sign-in, admin
  provisioning, Identity seed).
- ‼️ **US territories are the US (DD-35, owner 2026-09-25)**: PR, GU, VI, MP, AS and UM — by ISO code or English name —
  parse as `CountryCode.US` in both the strict (`TryParseStrict`) and the lenient parse. `UsTerritoryCodes` and
  `TryGetUsTerritory(iso, out name)` let the geocoder answer a territory as the US with the territory as its state.
- `DiscoverySettings` and `InvoicePaymentRails` now parse countries strictly (a territory takes US defaults/rails). The
  lenient parses left on purpose are registered in `CountryParsingConventionTests` (API unit).
- **`ServiceBookingPrice`** (`clinqetcore\Utilities`): `HasSetPrice(pricing)` — a stored 0 is no price (every cart,
  checkout and quote gate); `StampedTypeOf(pricing)` — the ONE rule for the type a booking/quote line records (the
  provider's word, else `TypeOf`, else "fixed"); `BaseOf` books a ceiling-only range at its ceiling.
- **`OfferWindow`** (`clinqetcore\Utilities`): `StartsAt` / `EndsAt` take the business's zone and `IsLive` / `HasEnded` / `IsUpcoming` decide in it
  (B-11); `IOfferRepository.GetCurrentOfferCandidatesAsync` replaces `GetActiveOffersAsync`. `OfferValidationService` and `OfferController`
  read "now" from a REQUIRED injected `TimeProvider`; their tests pin it at `TestDataBuilder.OfferClockNow` (20:49 Toronto = the next UTC day).
- **`PlaceCell`** (`clinqetcore\Models\Search`) + `DiscoverySettings.PointCellDecimals` (2): the searched point rounded
  to one cell, which keys AND queries the hero/landing (`BannerScope.Cell`).
- **`ChangeFeedFailureMessage.LeaseBusyReschedules`** (int): how many times a replay was put back because its business's
  lease was held (S10); bounded by `CosmosDb:ChangeFeed:LeaseBusyMaxReschedules`.
- **`GeocodingSettings.WriteWaitMilliseconds`** (4000) — the bounded wait a SAVE gives Google; `GooglePlacesSettings`,
  `StaticMapSettings` (DD-36); `ICountryResolutionService.ResolveManyAsync`; `IPlaceSuggestionService`,
  `IStaticMapUrlSigner`.
- DTOs: `SaveCartOfferDto { OfferId }` (the cart save carries choices, never amounts); `CartItemDto.Pricing`
  (`ServiceSummaryPricingDto`, read-time); `RecentlyViewedItemDto.MaxPrice` (from the index, never stored); voice
  `QuoteOfferDiscount(OfferName, Amount)`; `ProviderContextPricing` no longer carries a discount.
