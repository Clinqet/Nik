---
description: |
  **BACKEND SKILL** — Work on the Clinqet Main API (.NET 10, C#). USE FOR: creating/modifying API controllers, endpoints, middleware, DI registration, CORS config, rate limiting, SignalR hubs, health checks, response formatting, API versioning, authorization. Applies to ALL files in clinqetapi/.
---

# CLINQET MAIN API — COMPREHENSIVE SKILL

## RECENT CHANGES — 2026-10-06 (the Clinket team's setup session reaches this host too)

See the `clinqet-prepared-providers` skill for the whole feature. What changed HERE:

- ‼️ **`SetupSessionFilter` is registered as an MVC filter and is DEFAULT DENY.** A token carrying an ACTOR claim answers 403 `setup_session_not_allowed` on every endpoint without `[AllowedInSetupSession]`. 34 endpoints are marked, and `Clinqet.API.UnitTests/Conventions/SetupSessionAllowListTests` pins the whole set.
- ‼️ **A HUB IS NOT AN MVC ACTION, so that filter never runs there.** `NotificationHub.OnConnectedAsync` aborts a setup session itself — otherwise the token joined the provider's own notification stream and `WatchVoiceLive` served the live transcript of a customer phone call. Any new hub must do the same.
- **`POST business/setup-session/notice`** is the ONE thing a setup session may send: it requires `[Authorize]` **plus** `IsSetupSession(User)` **plus** `business.profile.update`, and it refuses a token with no session-id claim rather than guessing a dedup key from the request.
- **`GET public/prepared-profile`** is the one public read behind the claim and stop pages. The token comes in the **`X-Prepared-Token` header**, not a query string, and the budget uses `GetRateLimitClientIp()` so an IPv6 client does not get 2^64 buckets.
- ‼️ **`ServiceController.RefusedPrice<T>` must never be a ternary.** `ActionResult<T>` has an implicit conversion FROM `ActionResult`, so a conditional whose other branch is an `ActionResult` converts the null and throws `ArgumentNullException` — on every PRICED service, which is the normal case.
## ABSOLUTE RULES (READ FIRST — APPLIES TO EVERY CHANGE)

- **Comments — terse, only when they earn their place.** Default to no comments; let naming carry the meaning. **However**, write a comment when it captures non-obvious context the code itself cannot show: a hidden invariant, a subtle ordering constraint, a deliberate workaround for a known bug, a defensive choice with a real reason, or an RFC/spec citation that explains *why*. Prefer a single short line. Forbidden: restating WHAT the code does (e.g. `// increment counter` above `counter++`); multi-line narrative blocks explaining design rationale; XML doc summaries on properties whose names already convey intent; commented-out code; `// TODO` without an issue link. When in doubt, delete the comment — but don't strip a *real* WHY-comment just to chase zero.
- **No verbose docstrings on self-evident members.** A property named ``EnableAISpellCorrection`` does NOT need a doc summary. A field named ``_searchEnableAISpellCorrection`` does NOT need a multi-line ``//`` block above it. Trust naming.
- **No commented-out code, no leftover symbols, no ``// TODO`` without an issue link.**

---


## OVERVIEW

The Main API is a .NET 10 ASP.NET Core Web API serving the Clinqet service marketplace platform. It exposes RESTful endpoints for three web clients (Partner, User, Admin) and planned mobile apps.

- **Solution**: `C:\Nik\clinqetapi\Clinqet.API.sln`
- **API Project**: `C:\Nik\clinqetapi\Clinqet.API\`
- **Framework**: .NET 10, ASP.NET Core
- **Database**: Azure Cosmos DB (operational data) + SQL Server (identity only)
- **Search**: Azure AI Search (hybrid: BM25 + semantic + vector)
- **Real-time**: SignalR (notifications hub)
- **Queuing**: Azure Service Bus (all async operations)

---

## PROJECT REFERENCES

The API project references these shared libraries:
- `Clinqet.Shared` — DTOs, Enums, Constants, Models, ApiResponse
- `Clinqet.Core` — Entities, Interfaces, Validation
- `Clinqet.Infrastructure` — Services, Repositories, Middleware, Data Layer

---

## CONTROLLER PATTERNS (MANDATORY)

### Base Controller

All controllers MUST inherit from `BaseController`:
```csharp
[ApiController]
[Route("api/v{version:apiVersion}/...")]
[Authorize]
[EnableCors("B2CPolicy")]
[ApiVersion("1.0")]
public class MyController : BaseController
```

### Claims Extraction (from BaseController)

```csharp
GetUserId()                    // ClaimTypes.NameIdentifier — user's GUID
GetCurrentUserNumberAsync()    // "UserNumber" claim — partition key for Cosmos
GetCurrentUserTypeAsync()      // "UserType" claim — Provider, Customer, Admin
GetPreferredLanguage()         // Accept-Language header or "Locale" claim
```

### Response Envelope

ALL endpoints MUST return `ApiResponse<T>` or `ApiResponse`:

```csharp
// Success
return Ok(ApiResponse<MyDto>.Ok(data));
return Ok(ApiResponse<MyDto>.Ok(data, localizedMessage));
return Ok(ApiResponse<MyDto>.Created(data));

// Errors
return BadRequest(ApiResponse<MyDto>.Fail(message, errors, statusCode: 400));
return NotFound(ApiResponse<MyDto>.NotFound(message));
return Conflict(ApiResponse<MyDto>.Conflict(message));
return StatusCode(403, ApiResponse<MyDto>.Forbidden(message));
return StatusCode(401, ApiResponse<MyDto>.Unauthorized(message));
```

**ApiResponse<T> Properties**:
- `Success` (bool) — always present
- `StatusCode` (int) — hidden from JSON
- `Data` (T?) — omitted if null
- `Message` (string?) — localized
- `Errors` (List<string>?) — omitted if null

### Validation Pattern

Use `ValidateId<T>()` from BaseController for ID validation:
```csharp
var validation = ValidateId<MyDto>(id, "Booking");
if (validation != null) return validation;
```

DTO validation uses localization keys on annotations — the framework resolves them automatically:
```csharp
[Required(ErrorMessage = "Error_FieldRequired")]
[StringLength(200, ErrorMessage = "Error_FieldMaxLength")]
[Display(Name = "Label_FieldName")]
```

### Exception Handling

Controllers use `HandleException<T>()` from BaseController. Do NOT add try/catch unless there is a specific reason:
```csharp
catch (Exception ex)
{
    return HandleException<MyDto>(ex, entityId, "operation name");
}
```

The handler maps:
- `KeyNotFoundException` → 404
- `ArgumentException` → 400
- `CosmosException` → Maps status codes (404, 409, 412, 429)
- Default → 500

Global exception middleware in `Program.cs` handles uncaught exceptions.

### ‼️ ONE RULE decides what a caller is told when an exception carries a message (2026-09-19)

A domain refusal's exception **Message IS a localization key**, resolved in the CALLER's language. EF, SqlClient,
the Azure SDKs and our own config guards throw the **same types** with a developer sentence, and
`LocalizationService` answers an unknown key **VERBATIM** — so the two were indistinguishable, and
`"The ConnectionString property has not been initialized."` shipped as a **400 "invalid input"**. Other leaks in
the same family named `Mcp:SecretPath`, `CosmosDb:DatabaseName` and `DocumentTtl:CustomerQuoteTtlDays`.

`BaseController.ResolveCallerFailure` is the single decision, used by `DomainRefusal<T>` **and** by both
`HandleException` overloads, so one throw cannot get two answers:

| Exception | Message resolves | Message does NOT resolve |
|---|---|---|
| `DuplicateItemException` | **409** + that copy | **409** + `Error_ResourceAlreadyExists` |
| `KeyNotFoundException` | **404** + that copy | **404** + `Error_ResourceNotFound` |
| `UnauthorizedAccessException` | **403** + that copy | **403** + `Error_Unauthorized` (was a **500**) |
| `ArgumentException` / `ValidationException` | **400** + that copy | **400** + `Error_InvalidInputOrOperation` |
| `InvalidOperationException` | **400** + that copy | **500** + `Error_InternalServerError` |
| `ILocalizedRefusal` | its status + copy **with arguments substituted** | — |

- **The type settles the status where it can.** A thing that is not there is 404 however it was described.
  `InvalidOperationException` settles nothing, so only "is the message ours" can tell a refusal from an outage.
- **`Clinqet.Core.Exceptions.ILocalizedRefusal`** carries key + args for copy with a `{0}`:
  `LocalizedRefusalException` (an `InvalidOperationException`) and `LocalizedArgumentException` (an
  `ArgumentException`). ‼️ **An interface, not one base class** — the exception TYPE is already part of the
  contract, and collapsing two into one changed what `catch (ArgumentException)` matched.
- **Both handlers return idiomatic typed results** (`NotFound` / `BadRequest`), matching `DomainRefusal`, so a
  caller matching on the result type sees one shape.
- ‼️ **Never branch on the message's ENGLISH TEXT.** `CustomerController` had **14**
  `when (ex.Message.Contains("not found"))`-style filters choosing the status — which made the sentence
  load-bearing, so localizing it would silently have changed the status code. Gone; the type and the key decide.
- ‼️ **A refusal throws the KEY, never the resolved sentence.** Pre-resolving produced text the catalogue does not
  contain — indistinguishable from a developer sentence. 31 sites in `CategoryRepository`, `ReviewService`,
  `ContentReportService` and `McpService` were converted; **35 keys × 5 languages verified present**, so no
  translation was lost.

**Guards (both fail the build; fix the call site, never the test):**
`Conventions/ExceptionMessagesNeverReachTheCallerTests` — no controller hands `ex.Message` to the catalogue, into
a response, or into a text branch; its exemption registry fails in BOTH directions.
`Conventions/RefusalsThrowAKeyNotASentenceTests` — no library service throws a resolved sentence on a
caller-visible type. Both sabotage-proven, as is the rule itself.

‼️ **A `Mock<ILocalizationService>` returning the key verbatim is EXACTLY what production does for a key it does
NOT have**, so such a double cannot tell a refusal from a developer sentence and every assertion about which one a
controller answered is vacuous. Classes exercising this rule use `Helpers/TestLocalization.Real` — the REAL
catalogue from the test project's own output. ‼️ **Do NOT convert every double**: most classes use the identity
double deliberately, to assert WHICH KEY was chosen, and that is a legitimate and useful idiom.

### Authorization

```csharp
[Authorize]                                    // Default — JWT required
[AllowAnonymous]                               // Public endpoints (search, categories)
```

Multi-tenant isolation is MANDATORY. Every query must filter by the authenticated user's `businessId`/`userNumber`:
```csharp
var userNumber = await GetCurrentUserNumberAsync();
var data = await _repository.GetItemAsync(id, userNumber);
```

### Pagination

Use Cosmos continuation tokens for paginated endpoints:
```csharp
[HttpGet("paginated")]
public async Task<ActionResult<ApiResponse<PagedResult<T>>>> GetPaginated(
    [FromQuery] int pageSize = 20,
    [FromQuery] string? continuationToken = null)
```

Response uses `PagedResult<T>` with `Items`, `ContinuationToken`, `TotalCount`.

---

## PROGRAM.CS — DI REGISTRATION PATTERNS

### Repositories
All Cosmos repositories registered as **Scoped**:
```csharp
services.AddScoped<IBookingRepository, BookingRepository>();
```

### Services
- **Singleton**: `ILocalizationService`, `IServiceBusService`, `ICategoryCacheService`, `ISearchResultCacheService`, `ICategoryEmbeddingService`, `ITemplateService`
- **Scoped**: `IEmailService`, `ISmsService`, `IStorageManagerService`, and most business services
- **HttpClient factory**: Named clients with timeouts and retry policies

### HTTP Clients
```csharp
// Default: 30s timeout, 5-min handler lifetime
// Mailgun: Email-specific timeout
// AI Foundry: Infinite timeout (streaming)
// Geocoding: 3x exponential backoff retry (Polly)
// Embedding: 3x retry
```

### CosmosClient (Singleton)
```csharp
// SDK-level retry: max 9 attempts, 30s max wait
// Serialization: camelCase, JsonStringEnumConverter
// Region: from config ("CosmosDb:Region")
```

---

## MIDDLEWARE PIPELINE ORDER (CRITICAL — DO NOT REORDER)

> `ConsentEnforcementMiddleware`'s stamp-fallback rule moved to
> `Clinqet.Infrastructure.Services.Auth.PolicyDocumentReaderExtensions.GetForStampAsync` (2026-07-24) so the Identity
> host shares ONE implementation — see [[clinqet-identity-api]]. The middleware is a singleton and passes its
> constructor-resolved `_stampJurisdiction`, so nothing reads configuration per request. `PolicyController` keeps
> using the UNCLAMPED `TryGetCurrentAsync` — a client asking for a jurisdiction this stamp does not seed must get a
> clean 404, never another jurisdiction's document.

1. ForwardedHeaders (resolves real client IP — MUST BE FIRST)
2. DeveloperExceptionPage or ExceptionHandler
3. Swagger/SwaggerUI (if enabled) — AFTER the handler (swapped 2026-07-24): Swagger used to sit outside it, so a Swagger-middleware throw escaped to Kestrel as a bare 500
4. ResponseCompression (Brotli + Gzip)
5. Cache-Control: `no-store`
6. ResponseCaching
7. Security Headers (X-Content-Type-Options, X-Frame-Options, CSP, Strict-Transport-Security)
8. CORS (`UseCors("B2CPolicy")`) — BEFORE Auth
9. Correlation middleware (custom)
10. RequiredHeaders middleware (custom)
11. Authentication (JWT Bearer)
12. Authorization
13. Health check endpoints: `/health`, `/ping`
14. Controllers
15. SignalR hub: `/api/v1/hubs/notifications` with `RequireCors("B2CPolicy")`
16. RequestLocalization
17. UserCulture middleware

> **HTTPS enforced at the edge, NOT in the app.** `UseHttpsRedirection()` + `UseHsts()` removed 2026-06-04. Every Front Door route (`networking.json`) has `httpsRedirect: Enabled` + `forwardingProtocol: HttpsOnly`; App Service `httpsOnly: true` (`apps.json`). Behind the TLS-terminating proxy the redirect middleware can't determine a port (logs `FailedToDeterminePort`) and only no-ops; `UseForwardedHeaders` (XForwardedProto, #1) already makes `Request.IsHttps` true for real traffic. HSTS is emitted once by the Security Headers middleware (`Strict-Transport-Security` from `SecurityHeaders:StrictTransportSecurity`, 1yr + includeSubDomains). Do NOT re-add either.

---

## APPSETTINGS STRUCTURE

Key configuration sections:
- `ConnectionStrings:DefaultConnection` — SQL Server (identity only)
- `CosmosDb` — Connection string, database name, container names, SDK retry config
- `JwtSettings` — Secret key, issuer, audience, expiry
- `AllowedOrigins` — customer + partner CORS origins. **B2CPolicy = `AllowedOrigins` ∪ `Admin:AllowedOrigins`** (merged in `CorsOriginResolver`, mirroring Identity) — every controller, admin ones included, carries `[EnableCors("B2CPolicy")]`, so the admin bucket MUST be in that union or the admin portal is refused by ASP.NET on every request (2026-07-24 incident). `AdminPolicy`/`MobilePolicy` remain registered for endpoint-scoped use. Per env = geo-routed host + per-stamp `ca`/`in` hosts; `deploy.ps1` injects the union as App Settings (override base), localhost is **dev-only**. See `clinqet-deployment` → CORS origins.
- `Search` — Rate limiting, caching, query limits, BM25/Vector/Semantic weights, spell check
- `Search:Topology` — the search ROUTER: per-plane endpoint + key, the country index pairs, the private cells
- `Mailgun` / `Twilio` — Email/SMS provider config
- `StorageConfiguration` — Azure Blob Storage
- `SignalRSettings` — Hub config, Azure SignalR option
- `RateLimiting` — Auth and API rate limits
- `HealthChecks` — Timeout per dependency

### Rules
- Only add settings that the Main API project uses
- Use placeholder values for secrets (Key Vault references in production)
- Never commit real secrets
- Feature flags follow existing patterns

---

## LOCALIZATION

All user-facing strings MUST use localization keys:
```csharp
var message = _localizationService.GetLocalizedString("Error_BookingNotFound", language);
```

- Source file: `C:\Nik\clinqetinfrastructure\Resources\Localization\en.json`
- Key format: `Category.Action.Detail` or `Error_ActionDetail`
- Admin alerts are the ONLY exception — they may use hardcoded text

---

## SIGNALR — REAL-TIME NOTIFICATION ARCHITECTURE

### Hub

- **Endpoint**: `/api/v1/hubs/notifications`
- **Hub class**: `NotificationHub` at `Clinqet.API/Hubs/NotificationHub.cs`
- **User ID provider**: `ClinqetUserIdProvider` maps JWT `UserNumber` claim to SignalR user identity
- **Authentication**: JWT Bearer token (passed via query string for WebSocket upgrade)
- **CORS**: `RequireCors("B2CPolicy")`
- **Connection lifecycle**: Aborts if `UserNumber` claim missing; supports multi-device (all connections receive messages)
- **Disconnect logging**: `OnDisconnectedAsync` logs `null`/`OperationCanceledException` (benign client ping-timeout/abort) at `Information` with NO exception attached — only genuine errors log `Warning` WITH the exception. Logging a client-timeout as an exception spams App Insights `AppExceptions`.

### Hub timeouts (`SignalRSettings`, applied in `Program.cs` `AddSignalR`)

- `KeepAliveIntervalSeconds` (15), `ClientTimeoutIntervalSeconds` (60, relaxed from the framework 30s default), `HandshakeTimeoutSeconds` (15), `EnableDetailedErrors` (false).
- **Invariant** (fail-fast at startup): `KeepAliveIntervalSeconds * 2 <= ClientTimeoutIntervalSeconds`, both positive.
- **Multi-instance**: self-hosted hub `IHubContext` only reaches clients on the local instance. For >1 API instance, enable **Azure SignalR** (`SignalRSettings:AzureSignalR:Enabled` + connection string — `Microsoft.Azure.SignalR` already referenced; code branches to `AddAzureSignalR`) or a Redis backplane + sticky affinity.

### Client Interface (INotificationClient)

```csharp
Task ReceiveNotification(NotificationDto notification);       // Single notification
Task ReceiveNotificationBatch(IEnumerable<NotificationDto>);  // Batch on connect
Task NotificationRead(string notificationId);                  // Sync read state
Task NotificationDeleted(string notificationId);               // Sync deletion
Task AllNotificationsRead();                                   // Sync all-read
```

### Historical Notifications on Connect

- Configured via `SignalRSettings:SendHistoricalOnConnect` (default: true)
- Sends up to `HistoricalNotificationCount` (default: 10, max: 50) unread notifications on connect
- Uses `GetUnreadNotificationsAsync` from the notification repository

### Internal Notification Endpoint

The function app's `SignalRHttpClient` calls this endpoint to trigger real-time delivery:

- **Endpoint**: `POST /api/v1.0/internal/notifications/send`
- **Controller**: `InternalNotificationTriggerController`
- **Security**: `InternalApiKeyAuthorizationFilter` — requires `X-Internal-Api-Key` header, validated with SHA256 hash + `CryptographicOperations.FixedTimeEquals()` (constant-time comparison, prevents timing attacks)
- **Flow**: Receives `SignalRNotificationRequest` → parses `NotificationType` enum → builds `NotificationDto` → calls `SignalRNotificationService.SendNotificationAsync()`
- **No Cosmos writes** — this endpoint is SignalR-only (persistence happens in the function app)

### EnabledNotificationTypes Whitelist

Configured in `appsettings.json` under `SignalRSettings:EnabledNotificationTypes`:
- If **empty/not configured**: ALL notification types are delivered via SignalR
- If **configured**: ONLY listed types are sent; others are silently skipped (logged at Debug level only)
- **CRITICAL**: When adding a new `NotificationType` enum value that should have real-time delivery, it MUST be added to this list in `appsettings.json`

### End-to-End Flow

```
Function App: NotificationProcessor
  → SignalRHttpClient (HTTP POST with X-Internal-Api-Key)
    → Main API: InternalNotificationTriggerController
      → SignalRNotificationService.SendNotificationAsync()
        → IsNotificationTypeEnabled() check (whitelist)
          → hub.Clients.User(recipientId).ReceiveNotification(dto)
            → Client (Partner/User/Admin app via SignalR WebSocket)
```

---

## RATE LIMITING

- Auth endpoints: 15 permits per 5 minutes
- API endpoints: 100 permits per 10 seconds
- Search: 60 req/min anonymous, 200 req/min authenticated
- Suggest: 120 req/min anonymous, 400 req/min authenticated

---

## KEY FILES TO READ BEFORE ANY CHANGE

1. `C:\Nik\clinqetapi\Clinqet.API\Program.cs` — DI, middleware, full pipeline
2. `C:\Nik\clinqetapi\Clinqet.API\Controllers\Base\BaseController.cs` — Base patterns
3. An existing controller similar to what you're building
4. `C:\Nik\clinqetapi\Clinqet.API\appsettings.json` — All config sections
5. `C:\Nik\clinqetshared\Models\ApiResponse.cs` — Response envelope

---

## CART / BASKET

### Overview
The cart system allows both authenticated users and anonymous visitors to build multi-provider service carts. Carts are persisted in the `SystemData` Cosmos container and support anonymous-to-authenticated merge on login.

### CartController (`C:\Nik\clinqetapi\Clinqet.API\Controllers\Cart\CartController.cs`)
**Route**: `api/v1.0/cart`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/` | `[AllowAnonymous]` | Get current cart (by userNumber or deviceId) |
| `POST` | `/` | `[AllowAnonymous]` | Save/update entire cart |
| `DELETE` | `/items/{serviceId}` | `[AllowAnonymous]` | Remove a specific service item |
| `PATCH` | `/items/{serviceId}/quantity` | `[AllowAnonymous]` | Update item quantity |
| `DELETE` | `/` | `[AllowAnonymous]` | Clear entire cart |
| `POST` | `/merge` | `[Authorize]` | Merge anonymous (device) cart into authenticated user cart |

### Identity Resolution
- **Authenticated users**: Identified by `userNumber` from JWT claim (calls `GetCurrentUserNumberAsync()`)
- **Anonymous users**: Identified by `deviceId` from `X-Device-Id` header (calls `GetDeviceId()`)
- All endpoints use `[AllowAnonymous]` — identity is resolved at runtime, not via auth filter
- `GetCartIdentifier()` returns a `(string identifier, CartIdentifierType type)` tuple

### Auto-Merge on Login
When `POST /merge` is called after login, the service merges items from the device-based cart into the user's cart, removes the device cart, and schedules cart reminders. The merge endpoint requires `[Authorize]`.

### Rate Limiting
- Cart endpoints use `RateLimitPartition.GetFixedWindowLimiter` keyed by IP address
- Config: `CartSettings:RateLimiting:PermitLimit`, `Window`, `QueueLimit`
- Rate-limited responses use `ApiResponse.Fail(localized "Error_TooManyRequests", statusCode: 429)`

### Cart Settings (`appsettings.json`)
```json
"CartSettings": {
  "CartExpiryDays": 30,
  "MaxItemsPerCart": 50,
  "MaxProvidersPerCart": 10,
  "EnableCartReminders": true,
  "CartReminderDelayHours": [24, 72],
  "RateLimiting": {
    "PermitLimit": 30,
    "Window": 60,
    "QueueLimit": 0
  }
}
```

---

## CHECKLIST BEFORE SUBMITTING ANY API CHANGE

- [ ] Controller inherits BaseController
- [ ] Returns ApiResponse<T> envelope
- [ ] Uses localization keys for all messages
- [ ] Multi-tenant isolation enforced (userNumber/businessId in every query)
- [ ] Authorization attribute applied correctly
- [ ] No cross-partition Cosmos queries
- [ ] Enum serialization as strings
- [ ] No hardcoded text
- [ ] DI registration follows existing patterns (correct lifetime)
- [ ] No new try/catch unless specifically needed
- [ ] Build succeeds with zero errors
- [ ] All tests pass

## Privacy Policy Consent (2026-05-22)

`ConsentEnforcementMiddleware` (in `clinqetinfrastructure/Middleware/`) is registered in `Program.cs` immediately after `UseAuthorization()`. It reads `privacy_v` + `privacy_jur` claims from the JWT (no SQL hit), compares against `IPolicyDocumentReader.GetCurrentAsync(jurisdiction, "privacy_policy")` (5-min `IMemoryCache`, single Cosmos point-read on miss), and on mismatch returns 409 with body `{ message: "policy_update_required", data: currentPolicy }`. Exempt routes (`/api/v1/auth/accept-policy`, `/api/v1/auth/logout`, `/api/v1/auth/refresh-token`, `/api/v1/public/`, `/health`, `/ping`, `/hubs/`) are matched by `string.StartsWith` from `PolicyConsentSettings.ExemptRoutes`.

`PolicyController` (`/api/v1/public/policy/`) exposes one `[AllowAnonymous]` endpoint: `GET /current?jurisdiction=&policyType=privacy_policy` → `PolicyDocument`. Backs the frontend register form + re-consent modal so the client always submits a hash matching what it rendered.

`IPolicyDocumentReader` is registered alongside `ILookupRepository`; `PolicyConsentSettings` is bound from the `PolicyConsent` appsettings section. The full `IPolicyConsentService` (read + write) is only registered in the Identity API where `UserManager<UserProfile>` is hosted.

Warm-path overhead is ~1µs (2 claim reads + path prefix scan + IMemoryCache hit). Stale-version 409 is the only path that opens the global re-consent modal in the frontend.

**Unseeded jurisdiction ⇒ 404, never 500.** Region-pinned stamps seed only their own jurisdictions (`LegalPolicyManifest.CountriesForRegion`: `in`→[in], `ca`→[us,ca], `us`→[us]). `PolicyController.GetCurrent` + `GetCurrentBatch` call `IPolicyDocumentReader.TryGetCurrentAsync` (null when unseeded) and return a clean `404` `ApiResponse` for a valid-but-unseeded `(jurisdiction, type)` — the frontend then uses its static fallback. Only malformed metadata still throws. Do NOT substitute another jurisdiction's document (serving CA legal text for an `in` request is legally wrong).

**Global error handler:** `GlobalExceptionHandler : IExceptionHandler` (`Clinqet.API/Middleware/`; an identical copy lives in `Clinqet.Identity.API/Middleware/` — kept per-API, NOT moved to Infrastructure, which has no `Microsoft.AspNetCore.App` framework ref and is shared with the Functions isolated worker), registered via `AddExceptionHandler<GlobalExceptionHandler>()` + `AddProblemDetails()` + parameterless `app.UseExceptionHandler()`. **`AddProblemDetails()` is REQUIRED** — without it the parameterless `UseExceptionHandler()` throws `InvalidOperationException` at startup (its build-time check needs an `IProblemDetailsService`); the handler still returns true so the ProblemDetails writer never actually responds. Returns the `ApiResponse` 500 envelope with localized `Error_InternalServerError`. The handler is a SINGLETON ⇒ inject only singleton deps (it takes the singleton `ILocalizationService`). Only **Development** uses `UseDeveloperExceptionPage`; **Testing + Production both run this handler**, so integration tests exercise the real exception pipeline. Do NOT revert to `UseExceptionHandler("/error")` — that re-executes the entire pipeline (auth + `ConsentEnforcementMiddleware`) per error and, with no matching route, throws *"exception handler produced a 404"*, masking the real exception.

## Admin alerts endpoint — keyset-paged (2026-07-24)

`AdminAlertController` (`api/v1/admin/alerts`) returns `ApiResponse<AdminAlertPageDto>` — `{ items, continuationToken, hasMore, pageSize, startDate, endDate }`, **not an array**. Query params: `startDate`, `endDate`, `alertType`, `severity`, `isRead`, `isResolved`, `pageSize`, `continuationToken`.

Every filter is forwarded into the Cosmos SQL via `AdminAlertQuery` — the controller does **no** in-memory filtering (it used to pull the whole window and `.Where()` it in C#). The controller owns only the guard rails, all from `AdminAlerts` options (`AdminAlertQuerySettings`): default window `DefaultWindowDays` (7), window clamped to `MaxWindowDays` (90, so partition fan-out is bounded), page size clamped into `[1, MaxPageSize]` (100). A malformed `continuationToken` surfaces as 400, not 500 (the repository throws `ArgumentException`).

`GET /admin/alerts/unread` was **deleted** — no client called it and `isRead=false` covers it. Do not re-add.

The Identity host's `AdminAccessController.GetAuditLog` needs a full list rather than a page, so it walks pages up to `AdminAlerts:AuditMaxRecordsPerType` (1000) and logs a warning if it truncates — never a silent cap on a governance record.

---

## SEO PUBLIC SURFACE (session 7, 2026-07-26)

**Public business-scoped endpoints are gated.** `IProviderPublicVisibilityGate` (Scoped, registered in
`Program.cs`) applies `ProviderPublicVisibility.IsPubliclyListed` to every `[AllowAnonymous]`
`public/business*` and `public/businesses*` route, so a Pending, Suspended or never-onboarded
provider 404s instead of returning 200. The verdict rides the shared `IMemoryCache` (`Size = 1`) for
`BusinessProfile:PublicVisibilityCacheSeconds` (default 60; `0` disables the cache and reads
through, which is what the integration fixture sets).

- `GetMyPublicBusinessProfile` evaluates the predicate on the profile it **already read** and calls
  `Remember(...)`, so a provider page render costs ONE point read, not six.
- ‼️ **The review + rating routes exempt the owner and admins.** Partner web and partner mobile read
  those same public routes for the provider's own Reviews screen; a blanket gate blanks a suspended
  provider's own dashboard. See `ReviewController.IsHiddenFromPublicAsync`.
- `public/business/{id}/offers` returns only LIVE offers whatever `filter` says; `Deactivated`/`Past`/
  `All` are provider-management views on the authenticated route.
- A non-existent business is now a real **404**, not a 200 with an empty list.

**`SitemapController`** (`public/sitemap`) gained `services/{chunk}`, which streams a pre-generated
gzipped file from blob (Phase 8/D23) — zero database on the crawl path — and `index` now also returns
`serviceChunks`, the list the nightly job actually PUBLISHED.

‼️ **`IProviderListingProjectionService` requires `IIndexNowSubmitter`.** The API registers the
projection service (the admin reindex uses it), so it must register `IIndexNowSubmitter` +
`IndexNowSettings` + the named HttpClient too. Without them the admin reindex endpoint fails DI
resolution and returns 500 — found and fixed 2026-07-26.

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

---

## AN ENABLED-BY-DEFAULT SETTING THAT CALLS OUT MUST BE PINNED OFF IN THE FIXTURE (2026-07-26)

`ClinqetApiFactory` calls `config.Sources.Clear()`, so `appsettings.json` never loads and **the options
class default is what applies in integration tests**. The moment `IndexNowSettings.Enabled` became
`true` with a real key (committed values are the PROD values, per §0.12), every reindex and
provider-projection test would have POSTed to the **live api.indexnow.org**.

Pinned `["IndexNow:Enabled"] = "false"` in the fixture, beside the identical
`Payments:SmartAnalyticsEnabled` precedent whose comment already spelled out the rule.

**The rule:** when a setting's class default flips to enabled, ask *does anything behind it leave the
process?* If yes, it must be pinned off in the fixture in the same change. §0.12 forces the class
default to mirror prod; the fixture is the only correct place to opt out.

The Identity host needs no pin — it never references IndexNow.

## Homepage banner + admin provider trust (Phase 4B, 2026-07-28)

**`DiscoveryBannerController`** — `GET /api/v1/public/discovery/banner?city=`, `[AllowAnonymous]`,
`B2CPolicy`, on the SAME prefix as `DiscoveryCatalogController` (two controllers, one route prefix,
different action templates). Serves the customer hero.
- ‼️ **There is no `lat`/`lng`, deliberately.** The area key is the city slug and the payload is shared
  and cacheable per city (plan 8.3 / 8.4). Coordinates in the cache key give every visitor a private
  entry and destroy the cache; coordinates that do NOT reach the key serve one visitor's area to another.
  Country is resolved server-side from `X-Client-Country`; the promo region reuses that same header.
- ‼️ **Rate limiting is checked AFTER the cache, unlike every other endpoint here.** A cache hit touches
  neither Azure Search nor SQL, so it consumes no allowance; over-limit serves the last-good payload and
  only 429s (with `Retry-After`) when there is no history at all. Uses `ISearchRateLimitService`
  (service-level — there are still ZERO `[EnableRateLimiting]` attributes in this API).
- ‼️ **503, never an empty 200.** `InvalidOperationException` from the service ⇒ 503.
- `Cache-Control: public, max-age=<Banner:ClientCacheSeconds>` (60s) bounds how long a promo an admin
  just switched off can survive in a CDN copy.

**`AdminProviderController`** — `api/v1/admin/providers`, `[Authorize(Roles = "Admin")]`. The
provider-facing lifecycle endpoints on `BusinessProfileController` derive the business from the
CALLER's token, so an admin needs a `businessId`-addressed surface.
- `GET {businessId}/state` · `PUT {businessId}/clinket-badge` · `POST {businessId}/suspend` ·
  `POST {businessId}/reactivate`.
- ‼️ **Every mutation answers with the REFRESHED state**, so a screen never follows a write with a read.
- ‼️ **Suspend refuses unless `acknowledgedOutstandingBookings` is true.** The UI check is a
  convenience, never the authority.
- ‼️ **The audit region matters:** admin-config audit rows are partitioned by region and the reader
  validates it against the served set, so an empty region writes to a partition nothing can query.

---

## Multi-user provider — PHASE 2: the auto-create hazard is CLOSED (2026-08-02)

### What used to happen

`BusinessProfileController.GetMyBusinessProfile` (`GET /api/v1/business/profile`) keyed on
`GetCurrentUserNumberAsync()`, so **any** authenticated caller holding a `UserNumber` silently got a
`BusinessProfile` created for them. Under a membership model that means an invited employee opening the
provider app would mint a **second, empty business** instead of entering their employer's workspace —
which is why this had to close **before** invitations ship in Phase 6. `POST /business/profile` had the
same defect: keyed on `UserNumber` it wrote a document into a partition that is not a real tenant.

### What happens now

Both read the workspace from the **signed token**:

```csharp
protected string? GetCurrentBusinessId();     // BaseController — BusinessContextClaimTypes.BusinessId
protected string? GetCurrentMembershipId();   // BaseController — BusinessContextClaimTypes.MembershipId
```

- No business context ⇒ **403** with `Error_BusinessContextRequired`, and **nothing is read or written**.
- A business context but no Cosmos document ⇒ the **projection** is created (**L34**: the SQL `Business`
  is the real tenant and already exists). ‼️ **A SQL `Business` is NEVER created in the Main API.**

> ‼️ The tests assert this by querying **Cosmos after the 403**, not by reading the response body — a gate
> that returns 403 and still writes the document would pass a response-only test.
> See `BusinessProfileContextIntegrationTests`.

### ‼️ The rest of the Main API is UNCHANGED — and that is deliberate

`GetCurrentUserNumberAsync()` is still called at **277 sites across 32 files** and still returns the
person's `UserNumber`. **Phase 3 owns retiring it** (by deleting the method, so every site becomes a
compile error and none can be missed). Until then, only the two creation paths above are workspace-aware.

> ‼️ Consequence to know while working here: Phase 1's seeder already keys Cosmos documents on the real
> 6-char `BusinessId`, so every OTHER provider endpoint is reading a partition that seeded data does not
> use. That is a known, Phase-3-scoped state — not a new bug to "fix" locally.

### Seat enforcement engine — `IBusinessSeatService` (registered HERE, not in Identity)

`services.AddBusinessSeatServices()` in `Program.cs`, separate from `AddTenancyServices` because seats
need `IEntitlementService`, which only hosts that call `AddPaymentServices` have.

`EvaluateAsync(businessId)` returns `BusinessSeatState`:

```
UsedSeats        = memberships with Status Active OR Invited
                   (counting only Active would let 100 pending invites blow past a 10-seat tier)
TierLimit         = team.seats entitlement, null when the tier has no row
BaseLimit         = TierLimit ?? Tenancy:Seats:DefaultLimit (3) — never unlimited
ExtraSeatsAllowed = Business.ExtraSeatsAllowed, else 0
EffectiveLimit    = max(BaseLimit, ExtraSeatsAllowed)  <- PROTECTS existing members
CanGrantSeat      = UsedSeats < BaseLimit              <- governs NEW seats
```

> ‼️ **The tier limit, never the allowance, governs a NEW seat (D7).** A business at 12 of 3 that removes
> someone is at 11 of 3 and still may **not** invite — the allowance exists so those 12 keep working, it
> is not invitable headroom. `TenancyConventionTests.SeatState_GovernsNewGrantsByTheTierLimit_NotByTheLegacyGrant`
> fails the build if someone "simplifies" this to `UsedSeats < EffectiveLimit`.

The first evaluation after a downgrade **stamps** `Business.ExtraSeatsAllowed` / `ExtraSeatsGrantedAt` /
`ExtraSeatsReason` via a guarded `ExecuteUpdateAsync` (auditable, cleared only by deliberate admin
action, never shrinks, never expires) and **touches no membership status** — a tier change must never
suspend or remove anyone. `BusinessSeatSqlTests` proves that by re-reading every membership row.

**The enforcement CALL SITES (issuing an invitation, accepting one) ship with invitations in Phase 6.**
Phase 2 ships the engine and its full D3/D7 test matrix.

### Test-token helper

`TestTokenHelper.GenerateBusinessOwnerToken(userId, businessId)` now stamps the businessId as **both** the
legacy `UserNumber` claim (for the 277 sites) **and** the `BusinessId` business-context claim — exactly
what a production provider token carries after the exchange. `GenerateTestToken(..., businessId: null)` is
how a test represents a signed-in provider with **no** workspace.

---

## PROVIDER AUTHORIZATION — the tenancy pipeline (Phase 3 + 3b, 2026-08-02)

‼️ **Every provider endpoint in this API is gated. Read this before adding one.**

### Request order (`Program.cs`)

```
UseAuthentication()
UseTenantContext()      <- Clinqet.API.Middleware.TenantContextMiddleware
UseAuthorization()
ConsentEnforcementMiddleware
```

`TenantContextMiddleware` returns immediately when the caller is unauthenticated or carries no `BusinessId`
claim, so a customer, admin or anonymous request costs **nothing**. With a claim it resolves the authorization
snapshot and writes `HttpContext.Items["Clinqet.TenantContext"]`. A FAILED resolution is **recorded** at
`HttpContext.Items["Clinqet.TenantContextFailure"]`, never thrown — the same person's customer-side requests
must keep working while their provider membership is suspended.

### Reading the acting workspace

| Use | Not |
|---|---|
| `BaseController.Tenant` (the validated `TenantContext`) | `HttpContext.Items` directly |
| `GetCurrentBusinessId()` — the BUSINESS you are acting for | the `UserNumber` claim |
| `GetCurrentUserNumber()` — the PERSON (notification recipient, own customer record, own preferences) | `GetCurrentBusinessId()` |
| `ITenantContextAccessor` (Scoped) inside a service | resolving from `HttpContext` ad hoc |

‼️ **`GetCurrentUserNumberAsync()` IS DELETED, and there is deliberately NO claim fallback.** The middleware
leaves the context unset when a membership is suspended, removed or version-stale, so a fallback would hand
exactly those callers a working businessId. **Never add one.** A unit test that constructs a controller
directly has no middleware and must call `_controller.HttpContext.AttachTenantFromClaims()`
(`Clinqet.API.UnitTests.Helpers`).

‼️ **BUSINESS vs PERSON is a judgement call per ENDPOINT, not per controller.** `CustomerController` holds
both: `GET /customer/business` is the provider's CRM list (business) while `GET /customer/me` and every
`me/addresses` endpoint are the caller's OWN record in `CustomerData` (`/customerId` == their `UserNumber`,
so: person). Getting this backwards 401s every customer. Current split: **BUSINESS 205 / PERSON 73**.

### Gating an endpoint

```csharp
[HttpGet]
[RequiresPermission("catalog.service.read", PermissionScope.Business)]
public async Task<ActionResult<ApiResponse<IEnumerable<Service>>>> GetMyServices() { … }
```

- The attribute marks an endpoint **provider-only**. **Anything a customer calls must NOT carry it**, or every
  customer request 403s. Mixed controllers are real: `BookingController` (only 3 of 17 actions are
  provider-only), `InvoiceController`, `QuoteController`, `ReviewController`, `SupportController`, and all of
  `Messaging/`.
- **`Admin/*` controllers get NOTHING** (L33) — an admin token has no `BusinessId` claim, so the attribute
  would 403 support rather than secure anything. Same for every `[AllowAnonymous]` endpoint.
- **`minimumScope` convention (L68):** `PermissionScope.Business` on whole-business surfaces (lists, settings,
  catalogue, billing, voice, insights) — that is what stops a Contractor browsing the whole customer list;
  the default `None` on per-record surfaces, so a narrow-scoped member reaches the endpoint and the resource
  check narrows.
- **Permission keys come from `TenancyRoleCatalogDefinition.Permissions` (89).** A typo is a permanently
  locked endpoint — `ProviderEndpointAuthorizationTests` fails the build on an unknown key, an ungranted key,
  an unsatisfiable `minimumScope`, an annotated admin controller and an annotated anonymous endpoint.
- **`[AllowedWhenBillingOnly]` is on `ProviderBillingController` and nowhere else** (D9). A convention test
  pins that.

### Order inside the filter (it matters)

1. no `TenantContext` → 403 `business_context_required`, or the recorded failure (401 for **stale**)
2. asserted `BusinessId` (route / `X-Business-Id` header / `?businessId=`) ≠ the signed one → 403
   `business_context_mismatch`, logged as a security signal. ‼️ **Compared BEFORE any shape validation** (L67):
   the caller's own signed id is valid by definition, and seeded ids look like `TEST-BUSINESS-001`. A value
   that could never be an identifier (>64 chars, or outside `[A-Za-z0-9_-]`) is 400.
3. `AccessScope == BillingOnly` and the endpoint is not opted in → 403 `billing_only_access` (D9)
4. `!tenant.Has(permission, minimumScope)` → 403 `permission_denied`

‼️ The mismatch guard lives **inside the attribute, never in middleware** (L63): the anonymous public Open
Page routes carry a `{businessId}`, and a blanket middleware guard would 403 every provider page on the
internet. `CustomerController` and `ReviewController` also have **authenticated** `{businessId}` routes — the
earlier claim that only the public routes do was wrong (L71).

### Resource-level scope — ‼️ NOT wired yet

`IResourceScopeEvaluator` implements all seven scopes and is unit-tested, but **no controller calls it**: the
`assignedMembershipIds` / `assignedTeamIds` / `branchId` fields it reads are added in **Phase 4**, which must
wire it (L68). After loading a resource:

```
1. Load using BusinessId as the Cosmos partition key
2. Assert resource.BusinessId == TenantContext.BusinessId     <- BOTH steps required
3. Evaluate the scope; not allowed -> 403 resource_out_of_scope
```

Scope rules: `Business` allows · `Team` intersects `assignedTeamIds` · `Branch` follows `05-BRANCHES.md` §10
(**`branchId == null` is whole-business work and is ALWAYS visible**; a member with no branches therefore sees
only untagged work — never nothing, never everything) · `Assigned` / `Participating` require the resource to
support it, else **deny and log a configuration error** · `CreatedByMe` compares `createdByMembershipId`.
**L27: two roles granting one permission resolve to the BROADER scope**, so adding a role never reduces access.

### The snapshot cache

| | |
|---|---|
| Key | `authz:snapshot:{membershipId}:v{authorizationVersionFromToken}` |
| Entry | `Size = 1` (mandatory), TTL `Tenancy:Authorization:SnapshotCacheSeconds` (default 60), plus a per-membership `CancellationChangeToken` |
| Miss | **exactly one** SQL projection folding membership + business + roles + teams + branches |
| Version mismatch | **401 `business_context_stale`**, and nothing is cached |
| Denial | never cached |
| Permissions | `TenancyRoleCatalogDefinition.GrantsByRoleKey`, in memory, never a join (L55) |

**A warm authorized request makes ZERO SQL and ZERO Cosmos calls.** Sensitive operations must call
`GetLiveAsync` instead (§3.8) — never decide payout destination, ownership transfer, closure or data export
from the cache. ‼️ **Cross-instance eviction is bounded by the TTL, not guaranteed on the next request** — a
queue reaches one consumer and D4 forbids a topic (L61).

### Self-dealing (L25)

A member may be a customer of their own employer; what makes that safe is that they can never approve their
own money. `BaseController.IsSelfDealing(subjectCustomerUserNumber)` + `SelfDealingBlocked<T>()` compare
`booking.Customer.CustomerUserNumber` (JSON `customerId`) with `TenantContext.UserNumber`. Wired to
`MarkRefundedInCash` and `ProviderDisputesController.Respond`. `quote.approve_discount` has no endpoint yet.

### Error contract (the Phase 8 UI branches on `ErrorCode`)

`business_context_required` 403 · `business_context_mismatch` 403 · `business_context_stale` **401** ·
`business_context_invalid` 403 · `permission_denied` 403 · `resource_out_of_scope` 403 ·
`billing_only_access` 403 · `self_dealing_blocked` 403.
Discovery: **`GET /api/v1/business/access`** → `BusinessAccessSummaryDto`. Hiding an action client-side is UX;
the server still enforces.

### Testing

- **Unit:** attach a context with `_controller.HttpContext.AttachTenantFromClaims()` or
  `TenantContextTestFactory.Create(...)`.
- **Integration:** tokens go through the real middleware, so they need **no** attachment. ‼️ The API
  integration host has **no SQL container**, so `IAuthorizationSnapshotProvider` is doubled
  (`MockAuthorizationSnapshotProvider`); register non-default states via
  `_factory.AuthorizationSnapshots.Register(membershipId, …)`. Real SQL semantics — suspension, removal,
  version staleness, `ExecuteUpdateAsync` session revocation, dispatcher stamping — live in
  `AuthorizationSqlTests` on the `"Seo SQL"` Testcontainers fixture (prefix `Z`; never assert a global count).

---

## PHASE 4 — RESOURCE-LEVEL SCOPE IS NOW ENFORCED (2026-08-02)

Phase 3b annotated **183 endpoints** with `[RequiresPermission]`, which answers *"do you hold this
permission at all"*. Phase 4 wires the second half — *"on THIS document"* — at **28 per-record
endpoints**, which closes decision L68.

### The pattern, at every per-record endpoint

```
1. Load using the caller's own BusinessId as the Cosmos partition key
2. Project the loaded document with ToScopedResource(...)
3. EnforceResourceScope<T>(permissionKey, resource)   <- asserts BusinessId AND evaluates scope
4. Not allowed -> 403 resource_out_of_scope
```

`BaseController` (`Clinqet.API.Controllers.Base`) gained four members:

| Member | Purpose |
|---|---|
| `EnforceResourceScope<T>(string permissionKey, in ScopedResource resource)` | Returns `null` when allowed, otherwise a 403 `ActionResult<ApiResponse<T>>` carrying `ErrorCode = resource_out_of_scope` and the localized `Error_ResourceOutOfScope` |
| `EnforceResourceScope(string, in ScopedResource)` | Non-generic sibling for `ApiResponse` actions |
| `RequiresResourceNarrowing(string permissionKey)` | `true` only when the caller holds that permission **below** `Business` scope |
| *(private)* `EvaluateResourceScope` | Resolves `IResourceScopeEvaluator` from `HttpContext.RequestServices` with `GetRequiredService` |

‼️ **The evaluator is resolved from `RequestServices`, not the constructor** — `BaseController` is the
base of 59 controllers, and `[RequiresPermission]` already uses the same locator. `GetRequiredService`
so a missing registration fails loudly instead of quietly allowing everything.
**A directly-constructed controller in a unit test therefore needs `RequestServices`** —
`TenantContextTestFactory.Attach` / `AttachTenantFromClaims` now supply it automatically.

### Where it is wired

| Controller | Endpoints | Permissions |
|---|---|---|
| `QuoteController` | 8 | `quote.read` · `quote.update` (5) · `quote.send` (2) |
| `InvoiceController` | 7 | `invoice.read` · `invoice.create` (scoped on the BOOKING) · `invoice.adjust` (2) · `invoice.send` (2) · `invoice.delete` |
| `BroadcastProviderController` | 7 | `lead.read` · `lead.bid` (4) · `lead.bid_withdraw` · `booking.create` |
| `CustomerController` | 6 | `customer.read` (2) · `customer.update` (2) · `customer.delete` · `conversation.reply` |
| `BookingController` | 2 | `booking.accept` · `booking.update` |

‼️ **`RequiresResourceNarrowing` gates the check wherever it would force an EXTRA read** (Invoice,
`BusinessCustomer`, leads). A `Business`-scoped member is entitled to anything inside their own
business, and every one of those loads already uses their own `BusinessId` as the partition key — so
today, with only Primary Owner memberships in existence, this costs **zero extra reads**. Where the
document is already in hand (Booking, Quote) the evaluator runs unconditionally.

‼️ **`review.reply`, `voice.transcript.read` and `voice.settings.manage` get NO resource check** — no
role template grants them below `Business`, so the check could never bind. The invariant is enforced by
`CosmosTenancyContractTests.PermissionsWithNoResourceCheck_AreNeverGrantedBelowBusinessScope`, which
fails the build the day one of them is granted narrower.

### ‼️ THE BUG THAT WILL BITE YOU: attributes and private helpers

Inserting a private helper **between an attribute block and its action** silently moves `[HttpGet]` onto
the helper. The action still compiles, its unit tests still pass, and it starts returning **405 Method
Not Allowed** in production. This happened on three controllers in Phase 4 and was only caught by the
integration suite.

`Conventions/RouteAttributesBindToPublicActionsTests` now reflects over every controller and fails the
build if any non-public member carries `IActionHttpMethodProvider`, `IRouteTemplateProvider` or
`ProducesResponseTypeAttribute`. **Put new private helpers above the first action or below the last
one, never between an attribute block and the method it decorates.**

### Building a ScopedResource

Never hand-build one. Use `Clinqet.Core.Entities.COSMOS.ScopedResourceExtensions.ToScopedResource(...)`,
which has an overload per entity and sets `SupportsAssignment` / `SupportsBranch` / `SupportsParticipation`
truthfully. Declaring support a type does not have is worse than declaring none: the evaluator looks for
an array that can never be populated and denies **silently** instead of failing loudly.

Two overloads take an extra argument because the entity cannot answer alone:
`Conversation.ToScopedResource(businessId)` (the document is partitioned by `userNumber`) and
`BusinessCustomer.ToScopedResource(assignedMembershipIds)` (a customer carries no assignment; the caller
resolves the memberships holding a booking for them via
`IBookingRepository.GetAssignedMembershipIdsForCustomerAsync`).

### New endpoint

`GET /api/v1/business/activity` — `BusinessActivityController` (`Controllers/Tenancy/`),
`[RequiresPermission("audit.read", PermissionScope.Business)]`.
Query: `activityType?` · `pageSize?` · `continuationToken?`.
Response: `ApiResponse<BusinessActivityFeedDto>` (`Clinqet.Shared.DTOs.Tenancy`) — items carry
`SummaryKey` + `SummaryArgs`, **never a rendered sentence**; the client resolves the key in the reader's
language. `ContinuationToken` is an opaque base64 `createdAt|id` keyset cursor; `null` means last page.
A malformed token is **400 `Error_InvalidContinuationToken`**.

### New controller dependencies (constructor changes)

`InvoiceController` (+`IInvoiceRepository`, +`IBusinessActivityRecorder`) ·
`CustomerController` (+`IBookingRepository`) ·
`BroadcastProviderController` (+`IBroadcastProviderRepository`) — all **required**.
`BookingController` (+`IBranchResolver?`, +`IBusinessActivityRecorder?`) and
`QuoteController` (+`IBusinessActivityRecorder?`) — **optional trailing parameters**, so existing
`new XxxController(...)` in tests still compiles.

---

## PHASE 5 — BUSINESS NOTIFICATION ROUTING IS ACTIVE (2026-08-02)

The Main API registers the shared notification-routing layer with `AddNotificationRouting`. Provider-business producers resolve the authorized recipient set through `IBusinessCommunicationDispatcher`; customer-personal producers continue to call `ICommunicationDispatcher`. `BookingController` routes provider booking-created events this way, and `AdminBillingConfigController` routes `ProviderTaxOverridden` this way.

### Producer contract

- Build a `NotificationRecipientRequest` with `Scope = Business`, a persisted `BusinessId`, a durable `EventId`, and an ownership-safe subject. Use the complete scoped resource when it exists; business-wide events use `new ScopedResource(businessId)`.
- `NotificationRoutingCatalog` is authoritative for routing class, required permission, and preference category. Non-`SystemNotification` producers must not set `RoutingClassOverride`, `PermissionKeyOverride`, or `PreferenceCategoryOverride`.
- `EventId` identifies a durable domain transition rather than one dispatch attempt. Derive it from persisted entity/message/payment identifiers plus persisted status, ETag, or update version; the same redelivery must recreate the same ID.
- The `requestFactory` is per recipient. Localize title/body and language-sensitive template data with `ResolvedRecipient.PreferredLanguage`; never render once in the initiating user's language and reuse it for the team.
- Supply a valid partner workspace link. External email/digest links must be absolute HTTP(S); `BusinessCommunicationDispatcher` validates `QRCodeSettings:PartnerBaseUrl` and expands relative workspace paths. Current API routes include `/dashboard/bookings/{bookingNumber}` and `/dashboard/profile/payment-settings`.
- Do not duplicate delivery policy in a controller. `BusinessCommunicationDispatcher` supplies member identity/contact/business context, derives mandatory email from `CommunicationPreferenceConfig`, applies immediate-versus-digest membership channel policy and SMS/WhatsApp eligibility, and sets stable `EventId + userNumber + businessId` idempotency. A producer's `SkipEmail` cannot suppress mandatory email.

### Programme boundary

Phase 5 activates the Main API and infrastructure producers while preserving the single-recipient `CommunicationDispatcher` and `NotificationProcessor` downstream. Invitations, team/branch CRUD, and assignment writes remain Phase 6. The Functions/MCP/voice producer sweep remains Phase 7.

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

## Member handover and the ownership-transfer reminder (Phase 8 Part A, 2026-08-03)

`BusinessMemberController` (`api/v{version}/business/members`) gained three things.

### `DELETE /business/members/{membershipId}` now takes an optional body

```json
{ "reassignToMembershipId": "membership-id-or-null" }
```

Absent or blank returns the leaver's work to the **shared queue** (the pre-existing behaviour). Present
moves their conversations, watches and bookings to that person instead.

‼️ **The successor is validated through `IBusinessAssignmentGuard` before anything moves.** That is the
one write-side guard against naming a membership from another business (L85), and it is the reason a
rejected successor produces `member_not_found` with the membership still **Active** — a refused handover
never half-removes anybody. The successor **replaces** the leaver in the assignment list rather than being
appended, so a thread the successor already held does not list them twice.

`MemberRemovalResultDto` distinguishes the two outcomes:

| Field | Meaning |
|---|---|
| `ReassignedToMembershipId` | Null ⇒ the work went back to the shared queue |
| `ReassignedBookings` / `ReleasedBookings` | Moved to the successor / returned to the queue |
| `ReassignedConversations` / `ReleasedConversations` | Same distinction |
| `ReassignedWatches` / `RemovedWatches` | Same distinction |
| `ReassignedQuotes` / `ReassignedLeads` | **Always 0.** Quote and lead assignment does not exist (L108) |
| `ReachedBatchCeiling` | The member held more than `Tenancy:Lifecycle:MaxReassignmentItems` |

### `GET /business/members/{membershipId}/removal-impact`

`MemberRemovalImpactDto` — `AssignedBookings`, `ClaimedConversations`, `WatchedConversations`,
`ExceedsBatchCeiling`. Gated on `team.remove`. Exists so a confirm dialog can state the cost **before** the
button rather than reporting it afterwards. Reuses the same single-partition reads `RemoveAsync` performs.
**No quotes count** — assignment for them does not exist, and a zero row would advertise a feature that is
not there.

### `POST /business/members/ownership-transfer/remind`

Re-notifies the pending owner. Refused unless the caller is the sitting primary owner
(`ownership_transfer_invalid`), a transfer is pending, and it has not lapsed. Inside the cooldown it
returns **429 `invitation_rate_limited`** — it refuses rather than silently no-opping, because an owner
told "reminder sent" when nothing was sent will keep pressing while the other person still hears nothing.

- Cooldown: `IOwnershipTransferReminderThrottle`, a **singleton in-memory** throttle keyed **per business**,
  `MemoryCacheEntryOptions { Size = 1 }`. Setting
  `Tenancy:Lifecycle:OwnershipTransferReminderCooldownMinutes` (default 5), **Main API appsettings only**.
- ‼️ **A reminder needs its own durable `EventId` or it is a button that does nothing.**
  `NotifyOwnershipTransferInitiatedAsync` builds `membership:{id}:initiated`, which Phase 5's delivery
  idempotency would use to swallow the repeat. `ITeamLifecycleNotifier.NotifyOwnershipTransferRemindedAsync`
  emits `membership:{id}:reminded:{key}`, where the key is
  `{initiatedAtTicks}-{floor(elapsedMinutes / cooldownMinutes)}` — **stored data plus a bucketed clock,
  never a GUID or a raw `DateTime.UtcNow`** (L88). Two throttle-permitted reminders are at least one
  cooldown apart, so their keys cannot collide.
- It **does not extend the deadline**. A reminder that moved the expiry would let an owner keep a transfer
  alive indefinitely without re-authenticating.
- **No new `NotificationType`**: the reminder reuses `BusinessOwnershipTransferInitiated`, whose copy
  already reads correctly as a reminder.

Tests: `TenancyLifecycleAndGuardTests` (unit) and `MemberHandoverSqlTests` (**real SQL Server** — the
successor guard is a SQL read filtered by business AND status, and on EF InMemory the same code passes
whether or not the business predicate is present).

---

## ‼️ Phase 8 Part A is COMPLETE (2026-08-03) — the note above about it being partial is superseded

Every Part A screen shipped in **both** provider apps, in five languages, with a build-failing
cross-platform parity spec. Additional endpoints built because the approved mockups needed them and
nothing served them: `GET /business/members/seats`, `GET /business/members/roles` (primary-owner role
excluded — L19), `GET /business/members/{id}/removal-impact`.

‼️ **The provider MOBILE 403 hazard is FIXED.** `apiManager.tsx` no longer force-logs-out on a 403 from
the tenancy surface (`isDomainForbiddenUrl`), because every tenancy refusal is a 403 and a mistyped
ownership-transfer password would otherwise have signed the owner out.
`__tests__/tenancyForbiddenIsNotLogout.test.ts` locks it down — **add every new tenancy URL to that list.**

‼️ Mobile source rules enforced by `sourceLocalizationIntegrity`: format dates through `getActiveLocale()`,
never bare `toLocaleDateString()`; and **never** `t(key, { defaultValue: 'English' })`.

‼️ A single `defaultMessage` shared across a switch renders the WRONG string when a bundle is missing —
`<FormattedMessage id={status.key} defaultMessage="Active" />` rendered a closed account as Active.

---

## ‼️ MULTI-USER TENANCY — PHASE 9 (2026-08-04). Sensitive operations, the body-BusinessId ban, metrics.

> **The whole model is now one skill: read `clinqet-provider-teams` before any tenancy change.** This
> section records only what PHASE 9 changed in **this** project, plus the two live holes it closed.

### ‼️‼️ A client can no longer assert a `BusinessId` in a request BODY

**`[RequiresPermission]` guards the route, the header and the query. It CANNOT guard a body**, because the
body is not read until model binding runs **after** the authorization filter.

This was a **LIVE CROSS-TENANT WRITE HOLE.** `CreateInvoiceRequestDto` carried a `[Required] BusinessId`;
`InvoiceService` used it as the **Cosmos partition key** and `InvoiceMappingExtensions` stamped it onto
the document. **A member of Business A holding `invoice.create` could POST an invoice into Business B's
`Transactions` partition.**

‼️ **How it hid.** `InvoiceController.CreateInvoice` *does* call `GetCurrentBusinessId()`, so the code
reads as tenant-aware — but the value was used only for a customer-identity-sync side effect, never for
the write. And **every test passed the same value in the token and in the DTO**, so the two could never
diverge. 13,764 tests were green over it.

**Fixed structurally (H3):** `CreateInvoiceRequestDto.BusinessId` is **DELETED**;
`IInvoiceService.CreateInvoiceAsync(dto, businessId, createdBy, preferredLanguage, ct)` and
`ToInvoice(dto, businessId, createdBy, stampCurrency)` take the trusted value explicitly, and the
controller passes `GetCurrentBusinessId()`. Overwriting `dto.BusinessId` from the token was **rejected** —
it closes the hole but leaves correctness depending on remembering to overwrite forever. Deleting the
field makes the assertion **inexpressible**.

‼️ **The durable guard is a convention test, not a code review.**
`Conventions\ProviderEndpointAuthorizationTests.NoProviderEndpointAcceptsABodyThatAssertsABusinessId`
reflects over every `[RequiresPermission]` action's `Clinqet.Shared.DTOs.*` parameters and **fails the
build** on any settable `BusinessId`. **It found this hole on its first run.** `BusinessName` deliberately
remains — display copy on the caller's own invoice is not a tenant boundary.

### `RequiresPermissionAttribute.RequiresLiveAuthorization` — the seven sensitive operations

`OnAuthorizationAsync` is now **`async`**. Setting the new `init` property makes the filter re-resolve via
`IAuthorizationSnapshotProvider.GetLiveAsync` **after** the cached checks pass, and re-test grant,
billing-only scope and permission against live SQL.

`Clinqet.Shared.Constants.SensitiveOperations` is the canonical list of seven keys:
`business.lifecycle.manage` · `business.transfer_ownership` · `payment.refund_approve` ·
`payout.export` · `payout.manage_account` · `team.assign_role` · `voice.number.manage`.

**10 endpoints carry the flag:** `ProviderBillingController` ×3 · `BusinessMemberController` ×4 ·
`BusinessProfileController` ×2 · `ProviderBookingPaymentController` ×1.

‼️ **The ORDER is load-bearing and is pinned by three tests.** The cached checks run FIRST, so an
**ordinary endpoint pays ZERO extra reads** and **a caller the cache already refuses pays ZERO** — the
live read happens only for someone who would otherwise be allowed
(`AnOrdinaryOperation_NeverPaysForTheLiveReCheck`, `ASensitiveOperation_MakesExactlyOneLiveRead`,
`ACallerTheCachedSnapshotAlreadyRefuses_CostsNoLiveRead`).

‼️ **`TenantContext.Satisfies(permissions, key, minimumScope)` is ONE scope rule with TWO callers** — the
cached context and the live snapshot. A second copy could drift and silently widen one of them.

‼️ **Three convention tests make it an invariant, not a judgement call:** the flag is **required** on a
sensitive key, **forbidden** on an ordinary one, and every key in the list must exist in the catalogue —
a typo would silently disable the guard.

‼️ **`payout.export` and `voice.number.manage` have ZERO endpoints today.** Catalogue keys granted to
roles but carried by no controller. Not a hole, but they are on the list so the day an endpoint appears
the convention test forces it onto the live path.

### `TenancyMetrics` — the platform's FIRST `Meter`

`Clinqet.Infrastructure.Observability.TenancyMetrics`, meter name `Clinket.Tenancy`, exported by
`.AddMeter(TenancyMetrics.MeterName)` in `Program.cs`'s existing `WithMetrics` block — **without that line
the instruments record into a void.** Before this, `grep` for `new Meter(` / `CreateCounter` / `AddMeter`
returned nothing anywhere on the platform.

`clinket.authorization.snapshot.lookups{result}` · `…membership.lookup.duration` ·
`…denials{reason,permission}` (cross-tenant mismatch is `reason=business_context_mismatch`) ·
`…live_rechecks{outcome}`.

‼️ **No tag may carry a `businessId`, `membershipId` or `userId`** — unbounded cardinality is a cost
incident. The permission key is a fixed catalogue of 89, so it is safe.

### `access_change_backlog` health check

Registered on `/health`, failing **Unhealthy** (H5). ‼️ **A stalled D4 dispatcher is the quietest failure
on the platform**: no request fails, nothing logs an error, and a removed employee keeps working until
their token expires. It reports the **AGE of the oldest undispatched row, never the count**, and binds
the existing filtered `IX_AccessChangeQueue_Undispatched`.

‼️ **`AddCheck<T>()` resolves T through `ActivatorUtilities`**, so every constructor parameter must be
registered. A health check taking a settings POCO throws at startup — take `IOptions<HealthCheckSettings>`.
(`SqlBillingHealthCheck` gets away with a bare `TimeSpan?` only because it has a default.)

### Two more facts for this project

- ‼️ **`GetCurrentUserNumberAsync` has ZERO call sites** — the only two remaining hits were **stale
  comments** naming a deleted method, both corrected. `GetCurrentBusinessId()` (the workspace, from the
  validated `TenantContext`) and `GetCurrentUserNumber()` (the person, from the claim) are the two
  replacements, and `SupportController.RequestPaymentSupport` needs **both**.
- ‼️ **There is deliberately NO claim fallback in `BaseController`.** The middleware leaves the context
  **unset** when a membership is suspended, removed or version-stale, so a fallback would hand exactly
  those callers a working `businessId`. A directly-constructed controller in a unit test must call
  `HttpContext.AttachTenantFromClaims()` (`Helpers\TenantContextTestExtensions`).
- **`TenancyErrorCodes.BusinessContextRateLimited`** (`business_context_rate_limited`, HTTP **429**) and
  **`InvalidContinuationToken`** are the two newest codes. The latter fixed a real defect:
  `BusinessActivityController` returned the localized sentence and **no `ErrorCode` at all**, making the
  approved stale-page recovery implementable only by branching on a translated string.

### ‼️ 2026-08-04 — the team name conflict: a wrong code AND a 500 (SK5)

`TeamStructureStatus.For` in `Controllers/Tenancy/BusinessTeamController.cs` gained
**`TenancyErrorCodes.TeamNameInUse => 409`**, and the service stopped answering `team_not_found` for a
duplicate name.

**Before:** a duplicate TEAM name returned **`team_not_found` / 404** while carrying the message *"A team
with this name already exists"* — self-contradictory on the wire. On a **RENAME** both outcomes are
genuinely possible and the screens do **opposite** things (an inline field error the provider fixes by
typing, versus removing a row that is gone), so a client could tell them apart **only by parsing the
TRANSLATED sentence** — which the error contract forbids. Both `Create` and `Update` also declared
`ProducesResponseType(409)` they **could never produce**.

‼️ **This is the split CP6 made for branches; teams were simply missed by it.**
‼️ **Uniqueness is per BUSINESS** — `UX_BusinessTeam_Business_Name` is on the **pair**, so another
business using the same team name never collides.

**And the defect the one-line framing hid: a TOCTOU 500.** The `AnyAsync` pre-check is check-then-act.
`CreateTeamAsync` and `CreateBranchAsync` carried a `DbUpdateException` catch; **`UpdateTeamAsync` and
`UpdateBranchAsync` did not.** Two admins renaming onto the same name both passed the pre-check, the
unique index rejected one, and the loser got an **unhandled `DbUpdateException` — a 500** on a conflict
the database had resolved correctly. Both rename paths now catch it and return the conflict, reverting
the tracked entity so the context stays usable.

**Sabotage-verified 3/3:** restoring the wrong code failed 4 real-SQL tests quoting
`Expected "team_name_in_use" / Actual "team_not_found"`; removing the rename guard failed with the raw
`SqlException: Cannot insert duplicate key row … UX_BusinessTeam_Business_Name` — **that is the
production 500**; deleting the 409 arm failed 3 unit tests with `Expected: 409 / Actual: 400`.

> ‼️ **The generalisable rule: one code per distinguishable outcome, and a pre-check is never the guard —
> the database is.** If a write is protected by a unique index, EVERY path that writes it needs the
> `DbUpdateException` catch, not just the create path.

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

---

## PHASE 11 PART 2 — the authorization audit (2026-08-05)

### ‼️ CORRECTED COUNTS — measured, and four documents still state the old ones

| Fact | Documented | **Measured 2026-08-05** |
|---|---|---|
| `[RequiresPermission]` attributes | 183 across 23 controllers | **224 across 31** |
| Endpoints calling `EnforceResourceScope` | 28 | **31** |
| `RequiresLiveAuthorization = true` | 10 | **10** ✅ |
| `IsSelfDealing` **endpoint** sites | 2 | **2** ✅ — ‼️ `grep -c "IsSelfDealing("` says **3**; it counts the `BaseController` declaration |
| `[AllowedWhenBillingOnly]` | 1, class-level on `ProviderBillingController` | **1** ✅ |
| `GetCurrentConversationParticipantId` | 15 messaging sites | **15**, and **0** outside `Controllers/Messaging` ✅ |

### ‼️‼️ GATING A SHARED CUSTOMER/PROVIDER ENDPOINT — the pattern, and why a class attribute is wrong

`POST /bookings/{bookingId}/cancel` and `PATCH /bookings/{bookingNumber}/status` carried `[Authorize]` and
nothing else, and **both have a live `if (userType == UserType.Partner)` branch** that mutates the booking.
A `catalog_manager` (*"No booking or money access"*) and a `read_only_auditor` (*"no writes"*) could cancel
and complete any booking; `technician`/`contractor`, who hold `booking.complete` at **`Assigned`** scope,
could complete **any** booking. ‼️ **`Completed` transactionally creates an invoice.**

‼️ **A class-level `[RequiresPermission]` is the WRONG fix and repeats casebook CASE 7** — a customer token
carries no `BusinessId` claim, so it would 401 every customer cancelling their own booking. Phase 3b left
these unannotated for exactly that reason.

**The pattern:** gate the **provider branch in-action**, after the document is loaded and the not-found check
has run, keyed on what the request actually does:

```csharp
if (userType == UserType.Partner)
{
    var outOfScope = EnforceResourceScope<T>(BookingStatusPermission(dto.NewStatus), booking.ToScopedResource());
    if (outOfScope != null) return outOfScope;
}
```

‼️‼️ **AND THE FACT THAT MAKES ONE CALL SUFFICIENT: `ResourceScopeEvaluator.Evaluate` DENIES AN UNGRANTED
PERMISSION ON ITS FIRST BRANCH.** `context.ScopeFor(key)` returns `PermissionScope.None` for a key the caller
does not hold, and the evaluator returns `DeniedOutOfScope` before it looks at anything else. So
`EnforceResourceScope` performs **the permission check, the cross-tenant `BusinessId` assertion, and
`Assigned`/`Team`/`Branch` narrowing** together. **Do NOT add a separate in-action "does this caller hold the
permission" helper — there already is one**, and `ConfirmBookingByProvider` was already using it.

‼️ **Key the permission to the TRANSITION, not the endpoint.** The catalogue separates `booking.accept` /
`.update` / `.cancel` / `.complete` because they are four distinct acts, so one status endpoint must ask for
the one that matches — otherwise a Technician confirms through `PATCH /status` what
`POST /{n}/confirm` already refuses them.

### ‼️ Two permission keys in the catalogue are NOT wireable without an owner decision

- **`review.report`** — `POST /businesses/{businessId}/reviews/{reviewId}/reports` **exists but is
  person-scoped**: no provider branch, and it passes `GetUserId()` as the reporter. Gating it would 401 every
  customer.
- **`analytics.read`** — `AnalyticsController` and `DashboardController` gate on **`insights.read`**, whose
  grants **differ**, so re-pointing removes access `sales_representative` has today.

Both, and seven others with no endpoint at all, are registered with their reasons in
`Conventions/OrphanPermissionRegistryTests.cs`, which fails if the orphan list **grows or shrinks**.

---

## PHASE 11 PART 4 — TWO CONTROLLER RULES THAT ARE NOW BUILD-ENFORCED (2026-08-05)

### ‼️ `[Required]` IS A PROMISE ABOUT `ModelState`, NEVER ABOUT THE VALUE

`BookingController.CreateBooking` read `dto.Customer.Email` **eighteen lines above** its
`if (!ModelState.IsValid)` check. `BookingRequestDto.Customer` is `[Required]` — but ‼️ **an annotation records
a model-state error; it does not stop model binding from producing a null.** A body omitting the customer
block, or a partially-filled form posting `"customer": null`, threw a `NullReferenceException`, so the caller
received a **500** from the platform's main booking-create endpoint.

**The irony is the finding: the DTO already carried the correct localized 400 (`Error_CustomerRequired`). The
code returned before reaching the check that reads it.** Casebook **CASE 29b**.

> ‼️ **THE RULE: `if (!ModelState.IsValid) return ValidationFailed<T>();` goes FIRST — above every dereference
> of an annotated complex member.** Custom cross-field checks that ADD model errors come after it.

Swept across `BookingController`, `QuoteController` and `InvoiceController` for the shape *"a complex `dto.X.Y`
dereference before that action's `ModelState` check"*: **exactly one site**, now fixed and guarded by
`BookingControllerTests.CreateBooking_WithNoCustomerBlock_Is400NotAServerError` (both reachable shapes).

### ‼️ EVERY ENDPOINT IS CLASSIFIED BY WHAT ITS BODY DOES, NOT BY ITS NAME

`Conventions/EndpointIdentityClassificationTests` enumerates **466 controller actions from SOURCE** — the
compiled attribute set cannot say which identity helper an action's BODY calls, and that is the question — and
makes **both directions of casebook CASE 7** build-failing invariants:

1. A `[RequiresPermission]` action must genuinely act in a business context.
2. An action resolving ONLY the person must never carry a business permission.

Two indirect resolutions are registered with their mechanism: `BusinessAccessController.GetMyAccess` (reads
`BaseController.Tenant` directly) and `VoiceAssistantController.GetOptions` (returns pure appsettings-derived
options and reads no business data — ‼️ **not** CASE 7, because the surface is provider-only and has no
customer branch to lock out).

### ‼️ THE BODY GUARD NOW COVERS EVERY ACTION, NOT JUST ANNOTATED ONES

H3's `NoProviderEndpointAcceptsABodyThatAssertsABusinessId` reflected only over `[RequiresPermission]` actions
— **structurally blind to shared customer-and-provider endpoints**, which is exactly where finding G1's defect
lived. `NoActionAnywhereAcceptsABodyThatAssertsABusinessId` walks every action and registers the **eight**
legitimate bodies with their reasons:

| Family | Why a body `BusinessId` is correct there |
|---|---|
| `AdminBookingDisputesController.ForceRefund` · `AdminProviderLedgerController.Create` · `CategoryController.ConvertCustomToGlobal` | `[Authorize(Roles = "Admin")]` — **L33: an admin token carries NO `BusinessId` claim**, so naming the business IS the request |
| `BookingPaymentController.{InitiatePublic, ConfirmPublic, InitiateInvoicePublic}` | `[AllowAnonymous]` guest pay. The id is a **lookup coordinate**; the **e-mail match** is the authorization |
| `InternalVoiceTriggerController.LiveEvent` | No JWT pipeline — `X-Internal-Api-Key` only |
| `SearchController.TrackSearchInteraction` | An analytics **dimension**, never a partition key |

‼️ **Adding a ninth means reading the action end to end and writing the reason down. A bare exemption fails the
build.**

## AI resource alert wiring (2026-09-15)

Program registers `AddIntegrationHealthAlerts` + `AddAiResourceObservers`, three Search clients through `AiSearchClientFactory`, and observers on all seven AI HTTP registrations. `IntegrationHealthCoverageTests` guards those registrations and config defaults using only this host and shared infrastructure. Optional BusinessId/TraceId come from existing request context, without a database lookup. See the infrastructure skill for the independent Search/Model gates, 15-minute per-resource in-process cooldown and timeout semantics. â¼ï¸ SUPERSEDED 2026-09-19: the AI-only publisher was generalised into `IIntegrationHealthAlerts` over 14 resources and `AiResourceLimitAlerts`/`IAiResourceLimitAlerts`/`AiResourceKind`/`AiResourceLimitAlertSettings` were DELETED â see the `clinqet-integration-health` skill.

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


## Explainable admin search health (2026-09-24)

GET /admin/search/health now returns ApiResponse<SearchHealthReport> (API-owned Services/SearchHealthReport.cs). Existing index fields remain; additive summary/findings and dictionary enabled/refreshWindowMinutes make the decision explainable. These are response fields only, with no persisted schema change. Fixed health/reason/severity values serialize as string enums.

Zero count alone never degrades this admin report, including Live countries: return an Information finding describing absent searchable content and how to investigate expected content. Any failed index check or no targets remains Unhealthy; an enabled dictionary without a usable snapshot or with unknown/overdue freshness is Degraded. Disabled spell correction is informational. Dictionary grace starts AFTER Catalog.RefreshMinutes plus RefreshTimeoutSeconds, with FailureAdminAlertAfterStaleMinutes added; never flag the normal hourly refresh at 30 minutes. This policy supersedes the earlier admin Live-empty-is-an-outage rule. It does not change the separately configured /health minimum-document watermark.

The whole index probe shares HealthChecks:SearchIndex:TimeoutSeconds through the injected TimeProvider. Caller cancellation propagates; deadline failures retain unknown counts and explicit reasons. No raw SDK exception messages reach this response. Classify missing aliases, access rejection, throttling, service failure and timeouts; retain the full diagnostic in server logs. No database reads or automatic resyncs are added.

SearchAdminControllerTests cover status/severity/cancellation/deadline/freshness; AdminSearchHealthIntegrationTests exercise real routing, JWT authorization, JSON serialization and Azure SDK count/error handling using a deterministic test transport in the existing ClinqetApiFactory.

## ‼️ PHASE 3 AUDIT — endpoints added or changed (2026-09-24)

- `POST api/v1/bookings/price-preview` (`[Authorize]`, customer checkout) — see booking-lifecycle.
- `POST api/v1/geocoding/resolve` (`AddressResolutionController`, `[Authorize]`): exactly one of place id / address /
  pin; answered in the STORED (default) language; the per-client cold-lookup budget (429); outage ⇒ 503
  `Error_PlaceLookupUnavailable`; not found ⇒ 404. Both provider apps and the customer address forms use it — no
  geocoding key in a client (UM-5/UM-6).
- `GET api/search/place` answers ONE lookup (the `indexCity` second lookup is deleted).
- The lookup API refuses a `country` row whose code is not a `CountryCode` member (`Error_CountryNotOnPlatform`, P3-O3).

## ‼️ PHASE 3C CLOSE-OUT — endpoints added or changed (search-topology, 2026-09-25)

Record: `Data\search-topology\findings\PHASE-3C-CLOSEOUT.md`.

- **L3 / DD-36 — place suggestions and map images through OUR API** (`PlaceSuggestionsController`,
  `api/v1/geocoding`, `[AllowAnonymous]`, `B2CPolicy`; each answer paid from a per-client budget via
  `ISearchRateLimitService`, 429 `Error_RateLimitExceeded`):
  - `GET suggestions` (`PlaceSuggestionsRequestDto`: input, session token, optional origin, `countries` — strict
    `CountryCode` list) → `PlaceSuggestionDto[]` in the reader's language; budget `GooglePlaces:SuggestionsPerMinute`.
  - `GET places/{placeId}?sessionToken=` → `ResolvedAddressDto` in the STORED (default) language; ends the typing session
    (billed once); budget `GooglePlaces:PlaceDetailsPerMinute`; not found ⇒ 404 `Error_GeocodingFailed`.
  - `GET static-map` (`StaticMapRequestDto`: kind, lat/lng, width, height, scale) → a server-signed URL
    (`StaticMapDto`); budget `StaticMaps:RequestsPerMinute`; no key/secret ⇒ 503 `Error_MapUnavailable`.
  - Bad input ⇒ 400 `Error_AddressLookupInvalid`; Google outage ⇒ 503 `Error_PlaceLookupUnavailable`. No Google key
    ships in either phone app. ‼️ Places API (New) must be enabled in the Google project first
    (`Data\search-topology\RUNBOOK-GOOGLE-MAPS.md`).
- **L1 / G-9 — `ServiceAreaController` refuses a guessed or region-wide centre**: a geocoder answer that is a
  `PartialMatch` or `Coarse` (a whole province) on create/update ⇒ 400 `Error_ServiceAreaCityNotFound` (5 languages).
  `ProviderSetupServiceAreaService` (AI setup) stores no centre for either.
- **L4 / G-3 + L2 / DD-27 — `BusinessProfileController` places addresses CONCURRENTLY with a bounded wait**
  (`PlaceAddressAsync`, one task per address): `GeocodeWait.WithinAsync(..., Geocoding:WriteWaitMilliseconds)`, then
  `ProviderAddressWords.ApplyAsync` (typed street kept; city/state/country from the point in English). Not placed in
  time ⇒ saved as it came. `QuoteController` and `BookingController` place their addresses through
  `WriteAddressGeocoding.WithPointAsync`.
- **L8 — `GET public/discovery/banner` and `public/discovery/landing` take the searched POINT** (`lat`, `lng`; landing
  also `country`), cached and queried by one `PlaceCell` — see `clinqet-search-discovery`.
- **M2 — the cart is priced by the server** on every write and read; `CartItemDto.Pricing` carries the catalogue
  price — see `clinqet-cart`. **M6b** — `RecentlyViewedItemDto.MaxPrice` is filled from the index on hydration (never
  stored), so a ceiling-only range reads "Up to".

<!-- search-topology-phase5 -->
## Search-topology Phase 5 additions (2026-10-02)

- **A5 first-words tag:** `BusinessSearchController` sets ONE tag `clinket.first_word_ms` on the Ask Clinket REQUEST's own
  server activity (`AskClinketTelemetry`) when the first answer text streams — it lands in `AppRequests` custom
  dimensions at no extra ingestion. Answers that fail before any word set nothing.
- **D-123 guard:** `Conventions/SwapCopyOnlyFieldsNeverReachACallerTests` — reflection over this host's and the shared
  DTO assembly's types: no property named like a `[SwapCopyOnly]` index field, and no raw search row type exposed.
- **Sol 6.1 (D-120):** `AiModels.Sol = "gpt-6.1-sol"` (model version 2026-09-29, $2 / cached $0.10 / $10); conversation
  naming moved to `BusinessSearch:Answer:TopicDeploymentName` = `gpt-6-luna` (6.1 Sol refuses reasoning "none").
- Gates `AdminAlertSettings:EnableSearchMonitoringAlerts` / `EnableSearchSpaceAlerts` are in appsettings (class default true).
