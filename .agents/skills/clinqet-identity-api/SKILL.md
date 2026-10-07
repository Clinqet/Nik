---
description: |
  **BACKEND SKILL** — Work on the Clinqet Identity API (.NET 10, ASP.NET Core Identity, SQL Server). USE FOR: creating/modifying authentication endpoints, registration, login, MFA/OTP, passkey/WebAuthn, JWT token generation/refresh, password management, user profiles, device tokens, communication preferences, account lockout, login attempt tracking. Applies to ALL files in clinqetidentity/.
---

# CLINQET IDENTITY API — COMPREHENSIVE SKILL

## RECENT CHANGES — 2026-10-06 (prepared provider accounts + take-over)

See the `clinqet-prepared-providers` skill for the whole feature. What changed HERE:

- **The admin never sets a password.** `AdminProviderProvisioningDtos` has no `Password`, and nothing hashes one. A prepared account signs in by a CODE; the existing Set-password page gives it one later.
- **`UserProfile.ClaimedAt`** (datetimeoffset NULL, no index) is the one new column. Null ⇒ nobody has taken the account over.
- ‼️ **`EmailConfirmed`/`PhoneNumberConfirmed` on a prepared account mean "the team believes this reaches the owner", NOT "somebody proved it."** They are load-bearing — a forgot-password by phone needs the phone one, an email code needs the other — so do not "fix" them to false. The take-over resets both to what was actually proven.
- ‼️ **The register-by-phone branch checks the PROVEN holder FIRST.** If another account proved that number, `FindByPhoneAsync` resolves THEM, so offering "sign in with a code" would send the code to the wrong account.
- ‼️ **S4.** `VerifyMfaForPasswordResetAsync`'s phone-only sign-in branch OPENS A SESSION, so it carries every rule a sign-in carries: `MayEnterAsAsync` gates the caller-chosen `AppType`. Without it an account with an unconfirmed email could ask for the admin app and get it.
- **`SessionSnapshot.GrantsRecentSignIn` now defaults to FALSE.** A construction site that forgets it must DENY. Only `AuthSessionService` passes true, and only for a session with a stored context.
- **`[AllowedInSetupSession]` is METHODS ONLY** — a class-level mark would open every action and the convention pin enumerates methods, so the compiler now refuses what the pin could not see.
- **`PreparedProviderEmailFooter` is deliberately NOT registered in this host.** It sends codes and security notices; a "claim your free profile" invitation with a one-tap "this isn't my business" has no place in one.
- **`prepared-profile/emails/stop` and `/resume`** are anonymous and they WRITE, so both take an hourly budget (`PreparedProvider:StopResumeWritesPerHour`) keyed on the BUSINESS read out of the signature — not on the caller, who can change address for free. A link that does not verify takes no slot: it writes nothing, so it cannot spend a real account's budget.
- **`Security:AdminIpWhitelist:ProtectedPaths` is `/api/v1/admin`** — `v{version:apiVersion}` with `ApiVersion("1.0")` renders "v1", never "v1.0". The old default matched no admin route at all.
## ABSOLUTE RULES (READ FIRST — APPLIES TO EVERY CHANGE)

- **Comments — terse, only when they earn their place.** Default to no comments; let naming carry the meaning. **However**, write a comment when it captures non-obvious context the code itself cannot show: a hidden invariant, a subtle ordering constraint, a deliberate workaround for a known bug, a defensive choice with a real reason, or an RFC/spec citation that explains *why*. Prefer a single short line. Forbidden: restating WHAT the code does (e.g. `// increment counter` above `counter++`); multi-line narrative blocks explaining design rationale; XML doc summaries on properties whose names already convey intent; commented-out code; `// TODO` without an issue link. When in doubt, delete the comment — but don't strip a *real* WHY-comment just to chase zero.
- **No verbose docstrings on self-evident members.** A property named ``EnableAISpellCorrection`` does NOT need a doc summary. A field named ``_searchEnableAISpellCorrection`` does NOT need a multi-line ``//`` block above it. Trust naming.
- **No commented-out code, no leftover symbols, no ``// TODO`` without an issue link.**

---


## OVERVIEW

The Identity API handles all authentication and authorization for the Clinqet platform. It uses ASP.NET Core Identity with SQL Server for user management and JWT Bearer tokens for API authentication.

- **Path**: `C:\Nik\clinqetidentity\`
- **Solution**: `C:\Nik\clinqetidentity\Clinqet.Identity.sln`
- **API Project**: `C:\Nik\clinqetidentity\Clinqet.Identity.API\`
- **Framework**: .NET 10, ASP.NET Core Identity
- **Database**: SQL Server (EF Core) — ONLY database for identity/auth
- **Auth Methods**: Email/password, phone/OTP, Passkey/WebAuthn, Apple OAuth

---

## LOCKOUT PRESENTATION CONTRACT — 2026-07-16

- Identity storage remains UTC. No user-facing login response or lockout email may print `LockoutEnd`, an ISO timestamp, or a raw UTC value.
- `LoginDto.clientTimeZone` is the single additive optional client field. Partner/user/admin web send the browser IANA zone; both mobile apps send the device IANA zone. Zone capture failure must not block login.
- `LockoutPresentationFormatter` computes `LockoutEnd - UtcNow`, rounds up to a friendly minute/hour/day unit, and clamps expired values to one minute. Missing or invalid untrusted zones return duration-only without throwing.
- Account-lockout responses and `AccountLockedEmail` lead with the localized duration and append an absolute device-local time plus IANA label only when validation succeeds.
- Background/MFA lockout paths have no login device-zone field, so `MfaLockedEmail` is duration-only. Both templates exist in `en`, `fr`, `hi`, and `gu`; repeated lockout emails must also remain UTC-free. The 5 lockout localization keys (`MfaLockedOut` + the 4 `Notification_*Lockout_*` keys) exist in all four language files including `fr`.
- Passkey added/removed emails never print raw UTC timestamps: `AddedTime`/`RemovedTime` render the localized `Passkey_EventJustNow` phrase, and the `PasskeyAddedEmail`/`PasskeyRemovedEmail` templates exist in all four languages (en/fr/hi/gu). Passkey endpoints carry no `clientTimeZone` — only `LoginDto` does.
- Admin alerts/audit metadata may retain UTC because they are internal and operational, not user-facing.

## CONTROLLERS

### AuthController (Main — 7+ endpoints)

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| POST | `/register` | AllowAnonymous | Register new user (multipart/form-data) |
| POST | `/register/verification/resend` | AllowAnonymous | Resend registration MFA code |
| POST | `/register/verification` | AllowAnonymous | Verify MFA and complete registration |
| POST | `/login` | AllowAnonymous | Email/password login |
| POST | `/login/verification/resend` | AllowAnonymous | Resend login MFA code |
| POST | `/login/phone` | AllowAnonymous | Phone number login |
| POST | `/login/phone/verify` | AllowAnonymous | Verify phone login code |

### Additional Controllers
- `UserProfileController` — Profile CRUD, address management, friendly-name check/set/remove + public resolve (`GET public/{identifier}`: friendlyName ?? userNumber)
- `DeviceTokenController` — Push notification device registration
- `CommunicationPreferenceController` — Notification/email preferences
- `UserMetadataController` — User metadata management

All inherit from `BaseController` (same pattern as Main API).

**FriendlyName → Cosmos mirror (2026-07-02)**: `UserProfile.FriendlyName` (SQL, source of truth for the Open Page slug) is mirrored onto Cosmos `BusinessProfile.friendlyName` by `UserProfileController` on every set/change/remove via `IBusinessProfileRepository.TrySetFriendlyNameAsync` (point patch; 404 ⇒ non-provider no-op). The write fires the ProviderData change feed so search-result slugs re-stamp (see `clinqet-search-discovery`). Failure never fails the request — `AdminAlertType.FriendlyNameProjectionFailure` (High) is queued instead. Identity Program.cs registers `IBusinessProfileRepository`; identity appsettings + deploy.ps1 carry `CosmosDb:ContainerNames:ProviderData`.

---

## AUTH SERVICE (clinqetinfrastructure/Services/Auth/AuthService.cs)

**THIS IS A LARGE FILE — ALWAYS READ FULLY BEFORE ANY AUTH CHANGE.**

### Key Methods
```csharp
RegisterUserAsync(dto, language)             // User registration
SendRegistrationMfaAsync()                   // Send MFA for registration
VerifyRegistrationMfaAsync()                 // Verify MFA & sign in
LoginAsync(dto, language)                    // Email/password login
  → Returns (SignInResult, UserProfile?, previousLoginAt, errors)
SendPhoneLoginVerificationCodeAsync()        // Phone login
VerifyPhoneLoginCodeAsync()                  // Verify phone code
GenerateJwtTokenAsync()                      // Create JWT access token
GenerateRefreshTokenAsync()                  // Create refresh token
ValidateJwtTokenAsync()                      // Validate existing token
UploadProfilePictureAsync()                  // File upload to Blob Storage
```

### JWT Token Claims
```csharp
ClaimTypes.NameIdentifier  →  UserId (GUID)
"UserNumber"               →  BusinessId or CustomerNumber (partition key for Cosmos)
"UserType"                 →  "Provider" | "Customer" | "Admin" (enum string)
"Locale"                   →  Preferred language (e.g., "en")
ClaimTypes.Role            →  Role-based access
```

> **Null-safe claims (invariant).** `GenerateJwtTokenAsync` MUST never pass null to a `Claim` ctor — the ctor throws `ArgumentNullException("value")`, surfacing as **400 "Invalid input or operation: Value cannot be null. (Parameter 'value')"**. Phone-only / system accounts (WhatsApp no-account flow → `CustomerIdentityService.CreateSystemCustomerAsync`) have a **null `Email`**; guard `UserName`/`Email` with `?? string.Empty` and `Locale` with `?? _defaultLanguage`. Regression-tested (unit + integration). Fixed 2026-06-08.

### Rate Limiting (rewritten 2026-09-30)
Two layers guard every code send and check. The in-memory one is per server; the SQL one is shared.
- **In memory: `Services/CodeLimits/CodeLimitGate`** (scoped; its counters are process-static, like the MFA lockout). It is
  shared by `AuthController` and `UserProfileController`. `CodeLimitFlow` names each family: its key prefix, its
  settings group and its admin alert. Limited per IP first, then per account; a refused IP does not count against the account.
  - **Login codes** (`login/phone`, `login/email` + their `/verification`): `RateLimiting:OtpLogin`.
  - **Contact verification** (`phone/verify`, `email/verify` + `/verification`): `RateLimiting:OtpVerify`.
  - **Every other code**: registration, MFA resend, password reset, contact change and account deletion
    (`userprofile/account-deletion/request` + `/confirm`). These use `RateLimiting:AccountCodes`: a 15-minute window;
    sends 10 per IP and 5 per account; checks 20 per IP and 5 per account.
  - ‼️ **Accounts are keyed the way SQL finds them.** A typed address is resolved first (`ResolveAddressAsync`), and the
    key is the account id. An unknown address uses its normalized email or last-10-digit phone key, and nothing is sent to it.
    Only a canonical GUID may name an account (`AccountKey`): SQL ignores case, width and some invisible characters, so any
    other spelling gets 400 `UserIdRequired` before any limit or check.
  - **Sign-up** reserves a slot of the IP's allowance for the whole request (`ReserveRegistrationSlotAsync`), so parallel
    sign-ups can never pass it together. A request that sends no code gives the slot back; once a send has been attempted the
    slot stays spent. The account half is checked after `RegisterUserAsync` (`RegistrationAccountRefusedAsync`). A refused
    sign-up writes nothing on the account: no hold, no picture and no consent record.
  - Each refusal raises the flow's own alert once per window. The cooldown claim is taken before the send and given back
    if the send fails (`IAdminAlertCooldownService.Release`), so a lost alert is raised by the next refusal. The per-IP
    alert names no address in its title or description.
  - Refusal = 429 `Error_TooManyRequests`.
- **In SQL: `IVerificationCodeGuard`** counts wrong codes per account and flow (`Identity:CodeLimits`, 10/hour and
  20/day) for all ten code checks, and a paused flow answers 429 `Error_CodeChecksPaused`. See `clinqet-auth-sessions` §6.
- **Two-step code** (`login/verification`): `IMfaLockoutService` counts the attempt BEFORE the code is checked, under one
  lock. The controller reads the lockout first, so an attempt the lockout refuses never reaches the SQL count.
  `MfaLockoutStatus.LockoutStarted` is true only for the wrong code that started the lockout; the email, notice and alert
  go out once. The store is in memory, per instance.
- **Passkey challenge cooldown:** `Identity:RateLimiting:PasskeyChallenge:MinIntervalSeconds`.
- Per-IP keys read the first `X-Client-IP` (Front Door OVERWRITES it on the identity route).
- **Tests:**
  - `AuthControllerTests` (#region Account code limits; #region Code limits count the account SQL resolves).
  - `UserProfileControllerTests` (deletion) and `CodeLimitGateTests`.
  - `MfaLockoutServiceTests` and `AuthServiceLockoutTests`.
  - `SecurityIntegrationTests` and `VerificationCodeGuardIntegrationTests` (factory: per-IP 1000, per-account at
    production values).

### Password Policy
- Minimum 12 characters
- Requires: digit, lowercase, uppercase, non-alphanumeric
- Lockout: 15 minutes after 5 failed attempts
- Token lifespan: 120 minutes (configurable)

---

## PROGRAM.CS PATTERNS

### DI Registration

```csharp
// SQL Database (EF Core)
services.AddDbContext<AppDbContext>(options =>
    options.UseSqlServer(connectionString, sqlOptions =>
    {
        sqlOptions.EnableRetryOnFailure(maxRetryCount: 5, maxRetryDelay: 30s);
        sqlOptions.CommandTimeout(30);
        sqlOptions.MigrationsAssembly("Clinqet.Infrastructure");
    })
    .UseQueryTrackingBehavior(QueryTrackingBehavior.NoTracking));

// Identity
services.AddIdentity<UserProfile, ApplicationRole>(options =>
{
    options.Password.RequiredLength = 12;
    options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(15);
    options.Lockout.MaxFailedAccessAttempts = 5;
    options.Tokens.TokenLifespan = TimeSpan.FromMinutes(120);
});

// CosmosClient (Singleton) — for login attempts, user activity tracking
services.AddSingleton(sp => new CosmosClient(connectionString, ...));

// HTTP Clients: "default" (30s), "mailgun" (10s)
```

### CORS Policies
```csharp
// B2CPolicy — All partner/admin/clinqet origins
// MobilePolicy — GET, POST, PUT, DELETE only
// AdminPolicy, ClinketPolicy — App-specific
// Origins from config: AllowedOrigins:Partner|Admin|Clinket[] (B2CPolicy merges all three)
// Per env = geo-routed host + per-stamp ca/in hosts; deploy.ps1 injects the union (overrides
// base appsettings.json); localhost is DEV-ONLY. See clinqet-deployment -> CORS origins.
```

### Middleware Stack (same critical order as Main API)
1. ForwardedHeaders (FIRST — real IP resolution)
2. ExceptionHandler — `GlobalExceptionHandler : IExceptionHandler` (`Clinqet.Identity.API/Middleware/`), registered `AddExceptionHandler<GlobalExceptionHandler>()` + `AddProblemDetails()` (REQUIRED — parameterless `UseExceptionHandler()` throws at startup without an `IProblemDetailsService`) + parameterless `app.UseExceptionHandler()`; returns the `ApiResponse` 500 envelope (localized `Error_InternalServerError`). Dev uses `UseDeveloperExceptionPage`; Testing + Production both run this handler. Do NOT use `UseExceptionHandler("/error")` — there is no `/error` route, so the re-executed pipeline 404s and masks the real exception. Mirror of [[clinqet-main-api]]'s handler (kept per-API, not in Infrastructure). Registered BEFORE Swagger (swapped 2026-07-24) so a Swagger-middleware throw is handled instead of escaping to Kestrel as a bare 500.
3. Swagger (if enabled)
4. ResponseCompression (Brotli + Gzip)
5. ResponseCaching
6. Security headers (incl. `Strict-Transport-Security`)
7. CORS (BEFORE Auth)
8. Authentication → Authorization
9. Health checks: `/health`, `/ping`
10. Localization
11. Controllers

> **HTTPS enforced at the edge, NOT in the app** — `UseHttpsRedirection()` + `UseHsts()` removed 2026-06-04 (Front Door `httpsRedirect` + App Service `httpsOnly`; behind the proxy they only no-op / log `FailedToDeterminePort`). HSTS comes from the Security Headers middleware (`SecurityHeaders:StrictTransportSecurity`). Do NOT re-add either. See [[clinqet-main-api]] for the full rationale.

---

## Unknown-user 401 contract (2026-07-24)

Every child of `UserProfile` (`UserMetadata`, `UserSpotlightDismissal`, `UserPolicyConsent`, `DeviceTokens`, …) carries a
FK to it, and **JWTs are not stamp-bound** — issuer, audience and signing key are identical across the `ca` and `in`
stamps (`appsettings.{ca,in}.json` + `deploy.ps1`), while each stamp has its own `clinket-dev` SQL database. A token
minted on one stamp therefore authenticates on the other, and the first FK'd insert died as
`FK_UserMetadata_UserProfile_UserId` → 500.

- `Clinqet.Shared.Models.UnknownUserException(userId, inner?)` is the signal. `BaseController.HandleException` /
  `HandleLocalizedException` map it to **401** + `Error_Unauthorized`, and log it at **Warning** (a client condition,
  not a server fault — keeps the App Insights error feed clean).
- `UserMetadataService` checks user existence **only on the `DbUpdateException` path** (`ThrowIfUserMissingAsync`), after
  the concurrent-create re-read comes up empty — the happy path adds no query. Uses `IgnoreQueryFilters()` so a
  soft-deleted (`IsActive = false`) user is NOT reported as unknown; only a genuinely absent row is.
- `PolicyConsentService.RecordBatchAsync` throws the same type (was `InvalidOperationException` → a misleading 400).
- Proof is an integration test — EF InMemory cannot enforce the FK. See
  `UserMetadataControllerIntegrationTests.DismissSpotlight_WithTokenForUserNotOnThisStamp_Returns401`, which mints a
  token for an unpersisted `UserProfile`. `UserProfile.UserNumber` is a non-nullable `string`; leave it null and
  `GenerateJwtTokenAsync` NREs.

**Closed the same day by two follow-ups — both chosen because they add ZERO per-request work:**

1. **Per-stamp JWT issuer (config only, no code).** `JwtSettings:Issuer` is now the region-pinned identity host
   (`https://identity-{ca|in}.<apex>`) in `appsettings.{ca,in}.json` for BOTH the API and Identity hosts, and
   `deploy.ps1` derives `$script:IdentityIssuer` once per stamp in `Initialize-StampContext` (used at all four
   `JwtSettings__Issuer` sites). `ValidateIssuer` was already `true`, so the issuer string comparison ALREADY ran on
   every authenticated request — only the expected constant changed. A foreign-stamp token is now rejected inside
   JwtBearer validation, before any controller or SQL work. Signing is HS256/symmetric ⇒ no JWKS or discovery fetch,
   the issuer is an opaque string. `Identity:BaseUrl` deliberately stays the geo-routed **apex** — only the issuer is
   stamp-pinned. Only API + Identity ever receive `JwtSettings__Issuer`; `VoiceCallTokenService` has its own
   `Voice:TokenIssuer` and is untouched. Cost: every in-flight token is invalidated once on deploy.
2. **Jurisdiction clamp**, via `PolicyConsentService` alone — no controller edits. `GetCurrentAsync` and
   `ValidateAsync` now resolve through `PolicyDocumentReaderExtensions.GetForStampAsync`, and `ValidateBatchAsync`
   calls the clamped local `GetCurrentAsync`. That single change fixes all three endpoints: `consent-status` returns
   200 (`isCurrent:true` for an already-consented user), `accept-policy` returns **409 `policy_update_required`**, and
   `register` marks the consent stale — never a 500. `TryGetCurrentAsync` stays **unclamped** on purpose: callers
   asking whether a specific jurisdiction exists need the raw answer (e.g. [[clinqet-main-api]]'s public
   `PolicyController`, which must 404 rather than silently serve another jurisdiction's doc).

Perf note, since it drove both designs: the clamp issues the SAME number of cache/Cosmos lookups as before on the
success path (`GetCurrentAsync` always called `TryGetCurrentAsync` internally) plus an N-element null scan on an array
already in memory; the second lookup happens ONLY when a doc is missing. The stamp jurisdiction is resolved once in
the `PolicyConsentService` constructor — never per request.

---

## APPSETTINGS STRUCTURE

```json
{
    "ConnectionStrings": { "DefaultConnection": "SQL Server" },
    "JwtSettings": {
        "SecretKey": "32+ chars (placeholder)",
        "Issuer": "https://identity.clinket.com",
        "Audience": "clinqet.api",
        "ExpiryInMinutes": 120,
        "RefreshTokenValidityInDays": 7,
        "MfaExpirationMinutes": 10
    },
    "Identity": {
        "DefaultRedirectUri": "https://provider.clinket.com",
        "RateLimiting": {
            "PasskeyChallenge": { "MinIntervalSeconds": 1 }
        },
        "WebAppRedirectUris": {
            "Partner": { "PasswordReset": "...", "Error": "...", "Success": "..." },
            "Admin": { ... },
            "Clinqet": { ... }
        },
        "PasskeySettings": { ... }
    },
    "Email": {
        "SendLoginNotification": true,
        "SendWelcomeEmail": true,
        "SendAccountLockedNotification": true,
        "Templates": { ... }
    },
    "AllowedOrigins": { "Partner": [], "Admin": [], "Clinqet": [] },
    "HealthChecks": { "Sql": { "TimeoutSeconds": 5 }, ... }
}
```

### Rules
- ONLY settings used by the Identity API go here
- JWT secret key uses placeholder (Key Vault in production)
- Email templates referenced by name (resolved by template service)
- Rate limiting configurable per environment
- ‼️ **`Email:ExternalLoginNotification` is `false` (owner decision, 2026-08-10).** Signing in with Google /
  Facebook / Apple emails the customer nothing — every sign-in generating a "you signed in with X" mail was
  noise, and the provider they just authenticated with already tells them. The switch is read at
  `AuthService.HandleExternalLoginAsync` (`_configuration.GetValue("Email:ExternalLoginNotification", false)`),
  it lives in the base `appsettings.json` only (no region override, no ARM/`deploy.ps1` entry), and the one
  code path serves **every** client — partner web + mobile, customer web + mobile, admin. Turning it back on
  is one boolean. `Email:ExternalSignUpNotification` stays `true`: that fires **once**, when the external
  identity creates the account, and is the only record the person gets that a Clinket account now exists.

---

## ASYNC OPERATIONS

The Identity API queues ALL side effects to Service Bus (never inline):
- Welcome emails → `email-notifications` queue
- Login notifications → `email-notifications` queue
- Account lockout notifications → `notifications` + `email-notifications` queues
- Admin alerts → `admin-alerts` queue
- Marketing subscriptions → `marketing-subscriptions` queue
- Login attempt tracking → `login-attempts` queue

---

## HEALTH CHECKS

| Dependency | Failure Level |
|------------|--------------|
| SQL Server | Unhealthy (critical) |
| Mailgun | Degraded |
| Twilio | Degraded |
| Service Bus | Degraded |
| Blob Storage | Degraded |
| Cosmos DB | Degraded |
| Self | Degraded |

Endpoints: `/health`, `/ping`

---

## TESTING

### Unit Tests: `C:\Nik\clinqetidentity\Clinqet.Identity.UnitTests\`
### Integration Tests: `C:\Nik\clinqetidentity\Clinqet.Identity.IntegrationTests\`

---

## KEY FILES TO READ BEFORE ANY IDENTITY CHANGE

1. `C:\Nik\clinqetinfrastructure\Services\Auth\AuthService.cs` — ENTIRE FILE, end to end
2. `C:\Nik\clinqetidentity\Clinqet.Identity.API\Controllers\AuthController.cs` — All endpoints
3. `C:\Nik\clinqetidentity\Clinqet.Identity.API\Program.cs` — DI, middleware, policies
4. `C:\Nik\clinqetidentity\Clinqet.Identity.API\appsettings.json` — All config

---

## CHECKLIST FOR IDENTITY API CHANGES

- [ ] AuthService.cs read fully before any auth change
- [ ] JWT claims follow existing pattern (UserId, UserNumber, UserType, Locale)
- [ ] Password policy maintained (12+ chars, complexity requirements)
- [ ] Rate limiting enforced on auth endpoints
- [ ] All side effects queued to Service Bus (no inline email/SMS)
- [ ] Lockout policy respected
- [ ] Localization keys used for all error messages
- [ ] SQL migrations added if schema changes
- [ ] Multi-tenant isolation enforced
- [ ] Token refresh endpoint works correctly
- [ ] CORS origins from config (never wildcard)
- [ ] Build and tests pass

## Privacy Policy Consent (2026-05-22)

`AuthController` injects `IPolicyConsentService` and gates `Register` on `ValidateBatchAsync` (returns 409 + `data.stalePolicies[]` on any stale `(version, hash, jurisdiction)` triple). On success it calls `RecordBatchAsync` to stamp every accepted policy into the `UserPolicyConsent` SQL table (one row per `(UserId, PolicyType)` — `IX_UserPolicyConsent_UserId_PolicyType` is unique). Each policy also writes a `UserActivity` audit row using `UserActivityTypes.TermsAccepted`. **Consent retention (2026-06-03):** these `TermsAccepted` audit rows are kept permanently — `UserActivityProcessorFunction` stamps Cosmos `ttl = -1` (never-expire) for `TermsAccepted`, so consent can always be demonstrated; every other `UserActivity` type still expires per `ActivityStorage:UserActivityTtlDays` (default 90 days). Each row's metadata carries `policyType` + `version` + `hash` (SHA-256) + `jurisdiction` for all three legal consents (privacy/terms/cookie).

`AuthService.GenerateJwtTokenAsync` writes a compact `consents` claim (`<policy_type>:<version>:<jurisdiction>[,...]`). The Main API's `ConsentEnforcementMiddleware` parses it on every request — zero SQL hit on the warm path.

Endpoints on `AuthController`:
- `GET /api/v1/auth/consent-status?jurisdiction=` (Authorize) → multi-policy `ConsentStatusResponse { IsCurrent, UserConsents[], StalePolicies[], CurrentPolicies[] }`.
- `POST /api/v1/auth/accept-policy` (Authorize) → validates one policy → stamps + audits → returns a freshly-signed access token so the updated claim propagates immediately.

`RegisterDto.Consents` is a `List<RegisterConsentDto>` with one entry per enforced policy (regex `^(privacy_policy|terms_of_use|cookie_consent)$` × `^(in|us|ca)$` × 20-char version × 64-char hex hash).

## PolicyConsentSettings — binder-append landmine (2026-05-22)

`PolicyConsentSettings.ExemptRoutes` and `PolicyConsentSettings.EnforcedPolicies` ship **empty list defaults** and authoritative values live in `appsettings.json`. ConfigurationBinder APPENDS to existing `List<T>` contents when binding — pre-populated class defaults would silently produce 6 entries (3 class default + 3 config) instead of 3, causing duplicate `UserPolicyConsent` inserts and the unique-index violation that surfaced as a 500 on Register.

Wiring (both Identity API + Main API `Program.cs`):

```csharp
builder.Services.AddSingleton<IValidateOptions<PolicyConsentSettings>, PolicyConsentSettingsValidator>();
builder.Services.AddOptions<PolicyConsentSettings>()
    .Bind(builder.Configuration.GetSection("PolicyConsent"))
    .ValidateOnStart();
```

`PolicyConsentSettingsValidator` fails startup on: empty `EnforcedPolicies`, duplicate entries (the binder-append symptom), unknown policy types, blank entries, malformed exempt routes (must start with `/`), or `CacheTtlMinutes < 1`.

`PolicyConsentService` has defense-in-depth dedup (`ValidateBatchAsync` distinct on required types, `RecordBatchAsync` groups by PolicyType) plus an explicit `AsTracking()` on the existing-row lookup so the upsert UPDATE branch works under `QueryTrackingBehavior.NoTracking` (non-Development default). Audit `RecordActivityAsync` calls fan out via `Task.WhenAll` since each only enqueues a Service Bus message.

Integration test fixtures MUST seed `PolicyConsent:EnforcedPolicies` (and `ExemptRoutes` for Main API) in `testConfig` because empty defaults + `ValidateOnStart` fail the host without them.

## WhatsApp OTP — Sign in with WhatsApp (2026-05-31, Stage 1.8)

LOGIN-ONLY alternative OTP transport: the phone-login + phone-change verification codes can be delivered via a Meta WhatsApp **AUTHENTICATION (copy-code)** template instead of SMS. The OTP token/verify/JWT pipeline is **unchanged** — this only swaps the transport.

- **Branch point:** `ISmsService.SendVerificationCodeAsync` gained `OtpChannel channel = OtpChannel.Sms` (`clinqetshared/Enums/OtpChannel.cs`). `RoutingSmsService` injects `IEnumerable<IWhatsAppOtpService>` (**optional** — empty ⇒ null ⇒ SMS; only the Identity host registers it) and on `channel==WhatsApp` tries `WhatsAppOtpService`, then **auto-falls-back to SMS** on any failure (unmapped sub-type / no approved template for the recipient's language / Meta send error). Telnyx/2Factor accept+ignore the param.
- **`AuthService`:** `SendPhoneLoginVerificationCodeAsync(phone, userId, OtpChannel channel = Sms)` and `SendPhoneChangeVerificationCodeAsync` (reads `PhoneChangeDto.Channel`) thread the channel to `_smsService`. **UNCHANGED (verified — Identity 629-test suite green): `GenerateTwoFactorTokenAsync`, the `PhoneLoginMFA/TokenCreationTime` marker, the 10-min expiry, `VerifyTwoFactorTokenAsync`, JWT/refresh generation.** On a successful WhatsApp login OTP, best-effort `RecordWhatsAppSignInConsentAsync` writes `channelOptIn=OptedIn, source=SignInWithWhatsApp` to the Cosmos WhatsApp contact (try/catch — **never breaks login**; recorded on the user's CHOICE of WhatsApp even if this code fell back to SMS). `IWhatsAppConsentService` is an **optional trailing ctor param** (null in non-Identity hosts / older test fixtures — keeps existing AuthService test constructors compiling).
- **`AuthController`:** `/login/phone` passes `dto.Channel`; unknown phone keeps **HTTP 400**, channel-aware message (`NoAccountForWhatsAppLogin` "register first" for WhatsApp, else `UserNotFoundWithPhone`). `PhoneLoginDto`/`PhoneChangeDto` carry `Channel` (default Sms). **Rate-limit reuses the existing `RateLimiting:OtpLogin:Phone` lane** (no new lane — a number can't be double-spammed across SMS+WhatsApp).
- **DI/config:** Identity is the **only OTP sender**, so `Program.cs` registers the `whatsapp` HttpClient + `Configure<WhatsAppSettings>` + `IWhatsAppTemplateRegistry`/`IWhatsAppService(MetaWhatsAppService)`/`IWhatsAppOtpService(WhatsAppOtpService)`/`IWhatsAppConsentService`, and the AUTH templates `clinket_login_code`/`clinket_verify_phone` (`CopyCodeParamKey:"code"`, `ApprovedLanguages:["en"]`) + `WhatsApp:OtpTemplates` + `LanguageMap` live in **Identity appsettings ONLY** (NOT API/Functions — CLAUDE.md §4 no-unused-settings). `deploy.ps1` wires the WhatsApp **send** secrets (`PhoneNumberId`+`Token`) to the Identity app as per-stamp Key Vault refs (no AppSecret/WebhookVerifyToken — Identity has no webhook). New `en.json` key `NoAccountForWhatsAppLogin`.
- **Account creation is NOT built** (`CreateSystemCustomerAsync` untouched): WhatsApp sign-in works only for an existing Clinket account that has a phone number. See `WHATSAPP_INTEGRATION_PLAN.md` §10 + the `clinqet-whatsapp` skill.
- **Login UI (Phase-1 Increment H, 2026-06-01):** both apps' `auth/loginWithNumberForm.jsx` show a Variant-A secondary **"Get code on WhatsApp"** button (only when a phone-like value is typed) that posts `Channel:"WhatsApp"`; the default Login path is unchanged. Verify/resend copy is channel-agnostic (zero regression). Backend auto-falls-back to SMS on any WhatsApp send failure, so the button can never dead-end. `Auth.GetCodeOnWhatsApp` localized ×4 langs ×2 apps.

## Customer external OAuth handoff (2026-08-11)

- `AppType.Clinket` external login must opt into `SecureCookieExchange` (web) or `SecureCodeExchange` (mobile). Identity rejects `LegacyUrlTokens` for Clinket at initiation and callback; legacy URL tokens remain temporarily available only to non-customer apps.
- Web initiation accepts only a validated HTTPS Clinket return URL. The callback puts a time-limited Data Protection grant in the host-only `__Host-ClinketExternalLogin` cookie (`Secure`, `HttpOnly`, `SameSite=Strict`, `Path=/`, no `Domain`) and redirects with only `external_login=complete`. `POST /api/v1.0/auth/providers/login/exchange/web` reads only that cookie and requires `X-Clinket-External-Login: exchange` plus an `Origin` exactly matching the protected return origin.
- Mobile initiation accepts only `clinket://auth/external-login` and a valid PKCE S256 challenge. Success redirects to `clinket://auth/external-login?code=<protected-grant>`; `POST /api/v1.0/auth/providers/login/exchange/mobile` reads only `{ code, codeVerifier }`. The app persists the trusted Identity base used to initiate login and exchanges against that same base; no stamp/region query parameter exists.
- `ExternalLoginExchange:LifetimeMinutes` is 5 in the options default and base Identity `appsettings.json`; startup validation permits 1-15. It is not region-specific and has no `deploy.ps1` entry; isolated test hosts repeat it explicitly. The grant embeds the per-stamp JWT issuer, and App Service instances of one Identity app share the default persisted Data Protection key ring. Grants are not portable across regional Identity apps.
- No schema was added. `AuthService.PrepareExternalLoginExchangeAsync` shortens the existing provider-bearing `RefreshToken` row, and `ExchangeExternalLoginTokenAsync` atomically claims it with `IsUsed = 0` predicates before rotating it. This dedicated path never invokes refresh-token reuse revoke-all, so a replay cannot revoke the winning session.
- `ParseAndValidateReturnUrl` validates mobile schemes before the absolute-URI host branch. Google remote failure preserves encoded return URL, platform, app type, and provider. The test fixture config uses `Identity:AllowedRedirectDomains:{AppType}` and `Identity:AllowedMobileDomains:{AppType}`, never flat arrays.
- `SameSite=Strict` intentionally does not support a localhost page calling deployed Identity cross-site. Local OAuth must run through a same-site development hostname or a local Identity host; do not weaken the production cookie.
- Regression coverage: `AuthControllerTests`, `ExternalLoginExchangeProtectorTests`, `ExternalLoginExchangeIntegrationTests`, and the credentialed exchange case in `CorsPreflightTests`.

## Password management contract (2026-07-22)

- External-login accounts are created with `UserManager.CreateAsync(user)` and no generated password. `UserProfileDto.HasPassword` is the only client switch between set-password and change-password modes; clients must not infer this from provider metadata.
- `POST /api/v1.0/auth/password/set` accepts `SetPasswordDto` only when `HasPasswordAsync` is false. `POST /api/v1.0/auth/password/change` requires the current password and returns the same fresh `JwtResponse` shape as set-password.
- Both successful paths revoke every existing refresh token, then issue one new access/refresh pair for the current session. Linked external logins remain attached. Record `PasswordSet` or `PasswordChanged` activity and dispatch the matching localized account notification/email.
- Password policy (user-approved 2026-07-23): 8–128 characters with required composition — ≥1 uppercase, ≥1 digit, ≥1 non-alphanumeric; lowercase NOT required. Enforced twice: Identity options (`RequireUppercase`/`RequireDigit`/`RequireNonAlphanumeric` true, `RequiredLength` 8 — code defaults in `Program.cs` mirror `appsettings.json`) and a `[RegularExpression]` on the four password DTOs returning localized `Error_PasswordComposition` (en/hi/gu/fr) on the request path before UserManager. `ClinqetPasswordValidator` additionally enforces the configured maximum, the exact configured blocklist (refreshed with common composition-passing passwords like `P@ssw0rd`/`Password1!`), and user-specific terms; its settings live only in Identity `appsettings.json`.
- The DTO length message `Error_PasswordLength` is static localized text with the 8/128 numbers written out (en/hi/gu/fr) — DataAnnotations never formats placeholders through `ValidationFailed`, so `{1}`/`{2}` tokens must never appear in that resource; keep the numbers in sync with the policy settings.
- Clients use the `HasPassword` value already carried by their cached profile. They make one existing profile read only when that capability is absent, never a dedicated password-status call; successful set-password responses patch the cache locally.

## Admin login-attempt paging contract (2026-07-26)

`GET /api/v1.0/admin/login-attempts` requires `userId`; the Admin app resolves that ID through `/admin/users/lookup` before querying Cosmos. The endpoint accepts `startDate`, `endDate`, `isSuccessful`, `pageSize`, and `continuationToken`, and returns `LoginAttemptPageDto`. It does not accept admin page numbers and does not return a total count.

`LoginAttempts` settings are bound in the Identity host with defaults 30-day window / 90-day maximum / 25 default page size / 100 maximum page size. The controller clamps the window and page size before calling the single-partition keyset repository method. Keep the separate `/admin/login-attempts/user` endpoint on its existing contract unless that consumer is deliberately migrated.

---

## FRIENDLY NAME: POLICY, HISTORY AND 301s (session 7, 2026-07-26)

**Policy (D7).** `FriendlyName:AllowedPattern` is now `^[a-z0-9-]+$` (was `^[a-zA-Z0-9_-]+$`);
MinLength 3 / MaxLength 20 unchanged, and 20 is the SQL column width. `AuthService.UpdateUserProfileAsync`
**lowercases** the value and validates it against the configured pattern before the reserved-word and
availability checks, so one slug is one document and a case-variant URL becomes a 301 rather than a
duplicate page.

**History (D3).** New SQL table `UserFriendlyNameHistory` (retired name — UNIQUE, owning user,
replacedAt), migration `AddUserFriendlyNameHistory`. Owned by `FriendlyNameHistoryStore`
(`clinqetinfrastructure/Services/Auth/`), which takes an `AppDbContext` directly so the real-SQL
tests can exercise it without AuthService's 17 dependencies.

- Written on rename AND on removal, **tracked not saved** — the caller's own `UpdateAsync` commits it
  in the same transaction, so history can never be half-written.
- `IsFriendlyNameAvailableAsync` consults history too, with `IgnoreQueryFilters()`. A retired slug is
  reserved **permanently**; only its original owner may take it back (which deletes the history row).
- **No query filter on the table**, deliberately: a slug retired by an account that later deactivated
  must still read as TAKEN. `GetUserByRetiredFriendlyNameAsync` loads the owner through the
  **filtered** `Users` set, so a deleted owner's old URL 404s instead of 301ing to a dead page.
- Resolution order in `UserProfileController.GetPublicProfile`: current FriendlyName → UserNumber →
  retired history → 404. The history table is reached ONLY by a URL that was about to 404 anyway, so
  a real provider page never touches it.
- **Chains resolve in ONE hop**: the row points at the OWNER, never at the previous name, so
  A→B→C reads C directly. Never turn this into a name→name mapping — that is what creates redirect
  chains, and Google stops following them.

Proved by `FriendlyNameHistorySqlTests` (Testcontainers SQL): rename, chains, hijack prevention,
the unique-index race, re-claiming, A→B→A→B re-retirement, removal, case variants, and the
deactivated-owner pair (does not resolve / still reserved).

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

## Multi-user provider — PHASE 2: identity + business context (2026-08-02)

Phase 1 built the tenancy schema. **Phase 2 makes it mean something at sign-in.** A provider token now
carries the workspace it is acting for, and that workspace can only ever be established by a **signed
token exchange** — a client asserting a `BusinessId` in a header, body or route is never trusted.

### The claims a provider token now carries

Stamped by `AuthService.GenerateJwtTokenAsync(user, contextUserType, businessContext)`. Names are frozen
by `TenancyConventionTests.BusinessContextClaimNames_AreFrozen` — renaming one silently strips business
context from every already-issued token.

| Claim | Constant | Value |
|---|---|---|
| `BusinessId` | `BusinessContextClaimTypes.BusinessId` | the active tenant |
| `MembershipId` | `.MembershipId` | the acting relationship |
| `AuthorizationVersion` | `.AuthorizationVersion` | int as string; the Phase 3 snapshot cache key contains it |
| `BusinessRoles` | `.BusinessRoles` | comma-joined coarse role keys, ordered by `DisplayOrder` |
| `BusinessAccess` | `.BusinessAccess` | `Full` \| `BillingOnly` (`BusinessAccessScope`) |

> ‼️ **`BusinessRoles` is for UI affordances ONLY, never authorization.** The token is a *snapshot*, not
> proof: no permission key, scope, assigned resource id or team id may ever ride on it. A test asserts
> exactly that.

A **customer or admin** token carries **none** of these claims and costs **zero** extra queries (L33: an
admin token on a provider endpoint is a 403).

### `BusinessAccessPolicy` — the ONE gate (`clinqetshared\Utilities\`)

`Classify(membershipStatus, businessStatus, isPrimaryOwner)` is a pure function consulted by **both** the
workspace list and the token exchange, so the selector can never offer a workspace that 403s on click.

| Situation | Result |
|---|---|
| `Removed` or `Invited` membership | deny · `Error_BusinessAccessDenied` |
| `Suspended` membership | deny · `Error_BusinessMembershipSuspended` |
| Business `Closed` | deny · `Error_BusinessClosed` |
| Business `Suspended` + **primary owner** | **grant, `BillingOnly`** (D9) |
| Business `Suspended` + anyone else | deny · `Error_BusinessSuspended` |
| Business `Active` **or `Onboarding`** | grant, `Full` |

> ‼️ **"No live membership" and "no such business" return the IDENTICAL key** — the exchange must not be
> an enumeration oracle for which BusinessIds exist. An integration test byte-compares the two responses.
>
> ‼️ **Membership status is checked BEFORE business status**, so a suspended member never learns that the
> business itself is suspended.
>
> ‼️ **`Onboarding` grants.** `Business.Status` *defaults* to `Onboarding`, so denying it would lock an
> owner out of a business they just created. Public listing gates separately on `Status == Active`, so an
> unfinished business still stays unlisted. Provisioning explicitly writes `Active` (as the seeder does),
> which makes `Onboarding` currently unreachable — the policy is belt-and-braces (**L46**).

### `IAuthService` additions

```csharp
Task<IReadOnlyList<BusinessMembershipSummaryDto>> GetActiveMembershipsAsync(userId, ct);
Task<BusinessContextResolution> ResolveBusinessContextAsync(userId, businessId, ct);
Task<int> RevokeBusinessSessionsAsync(userId, businessId);
Task<JwtResponseDto> IssueSessionAsync(user, contextUserType, requestedBusinessId?, provider?, ip?, ua?, ct);
```

`GetActiveMembershipsAsync` returns only workspaces the caller can **enter now**. It is **ONE** query
(`ProjectMemberships`) that also carries everything the token needs, so auto-selecting a single workspace
costs no second query. It deliberately does **not** join `Users` — the caller has already gated on
`IsActive`/`IsSuspended`, and joining would inherit `UserProfile`'s global `IsActive` filter for no gain.

> ‼️ **`IssueSessionAsync` is the ONE place a session is minted.** Login, MFA verification, phone-login,
> email-login, passkey, external login, registration verification, password set/change and contact change
> all route through it. Adding a parallel token path would let one flow silently miss business context.

### `POST/GET` surface (`BusinessContextController`, route `api/v{version}/auth`)

| Route | Behaviour |
|---|---|
| `GET auth/businesses` | the caller's enterable workspaces |
| `POST auth/business-context` `{businessId}` | 400 malformed (**no DB round trip**) · 403 denied · 200 new token pair. Calling it while already in a workspace **is** how switching works |
| `POST auth/businesses` `{displayName,…}` | creates a business and returns a session already scoped to it |

### Business creation — `IBusinessProvisioningService`

ONE SQL transaction: `sp_getapplock` (per user) → rate-limit count → allocate `BusinessId` → `Business`
(`Active`) → Owner `BusinessMembership` (`Active`) → `sysrole_primary_owner` role →
`Business.PrimaryOwnerMembershipId` → `AccessChangeQueue` row (`MembershipCreated`) → commit.

- ‼️ **`sp_getapplock` is what makes a double-submit deterministic.** Without it two simultaneous requests
  both read "under the limit" and mint two businesses. A real-SQL test proves it.
- ‼️ **A missing `sysrole_primary_owner` REFUSES the creation** — an owner membership with no role is an
  invalid state nothing can repair. This is why the Identity host now also runs
  `TenancyRoleCatalogSeedHostedService`.
- **The Cosmos `BusinessProfile` is NOT written here (L47).** L34 already requires the Main API to create
  the projection on first access, so doing it in both places would risk two divergent document shapes.
- Rate limit: `Tenancy:BusinessCreation:MaxPerWindow` (3) per `WindowHours` (24), counted over the user's
  Owner memberships. L26 permits owning several businesses.

### Refresh — THE revocation guarantee

`RefreshToken.BusinessId` persists the workspace (new migration `20260801235637_AddRefreshTokenBusinessContext`).
`MembershipId`, roles and access scope are **re-resolved live on every refresh**, so a suspended
membership, a suspended business or a bumped `AuthorizationVersion` takes effect on the **next refresh**
rather than at token expiry. Lost workspace access detaches that business context and returns an account-level session; it does not end the account session.

- The workspace comes from the **stored row**, never the request, so a Business A refresh token can never
  yield a Business B access token.
- Ordinary refresh omits the `Businesses` list; workspace downgrade returns a fresh list.
- ‼️ **Refresh cannot be unit-tested on EF InMemory.** `RefreshTokenAsync` claims its token with
  `ExecuteSqlInterpolatedAsync`, which InMemory cannot run. Infrastructure failures now propagate. Those tests live in `BusinessContextIntegrationTests` against real SQL.

### Sign-in shape

```
0 workspaces  -> customer experience only; the provider app shows a localized
                 "no business access" state and NEVER creates a business
1 workspace   -> auto-selected; the token already carries it
2+ workspaces -> JwtResponseDto.Businesses is returned, ActiveBusinessId is null,
                 the client calls POST auth/business-context
```

### Localization keys added (all five files)

`Error_BusinessAccessDenied` · `Error_BusinessMembershipSuspended` · `Error_BusinessSuspended` ·
`Error_BusinessClosed` · `Error_BusinessContextRequired` · `Error_BusinessCreationFailed` ·
`Error_BusinessCreationRateLimited` · `Error_BusinessCreationBusy` · `Error_BusinessSeatLimitReached` ·
`Error_BusinessInvalidIdentifier` · `Error_BusinessDisplayName{Required,Length}` ·
`Error_Business{LegalName,Country,TimeZone,DefaultLocale}Length`.
`Error_BusinessIdRequired` already existed and is REUSED, not redefined.

### Phase 2 deliberately did NOT do

The 277 `GetCurrentUserNumberAsync()` call sites · `TenantContext` · the permission-policy pipeline · the
`AccessChangeQueue` dispatcher and snapshot cache (all **Phase 3**) · any Cosmos change (**Phase 4**) ·
notification routing (**Phase 5**) · invitations and the seat enforcement CALL SITES (**Phase 6**) · any
UI (**Phase 8**) · the "last owner cannot be removed" guard — **there is no removal path to attach it to
until Phase 6**.

---

### 14.3 ‼️ CORRECTED 2026-08-03 — the membership list now carries UNENTERABLE workspaces

§14.3 above described `GetActiveMembershipsAsync` returning only enterable workspaces. **That method no
longer exists.** It is `GetMembershipsAsync`, and it returns every workspace the person HOLDS:

| Situation | In the list? |
|---|---|
| Active membership, active/onboarding business | ✅ `CanEnter = true`, `AccessScope = Full` |
| Suspended business, the PRIMARY OWNER | ✅ `CanEnter = true`, `AccessScope = BillingOnly` (D9) |
| **Suspended business, anyone else** | ✅ **`CanEnter = false`**, `AccessScope = null`, reason `Error_BusinessSuspended` |
| **Suspended MEMBERSHIP** | ✅ `CanEnter = false`, reason `Error_BusinessMembershipSuspended` |
| **Closed business** | ✅ `CanEnter = false`, reason `Error_BusinessClosed` |
| Removed membership · Invited (unaccepted) | ❌ filtered **in SQL** — a removed membership must stay indistinguishable from "no such business", and an invitation is not a workspace you hold |

‼️ **`AccessScope` is NULLABLE and null exactly when `CanEnter` is false.** `default(BusinessAccessScope)`
is **`Full`**, so a non-nullable scope on an unenterable row would advertise full access.

‼️ **The list is NOT self-filtering.** Anything SELECTING a workspace from it must filter on `CanEnter`
itself — `IssueSessionAsync` does, and `IssueSession_WhenTheOnlyWorkspaceCannotBeEntered_MintsNoBusinessContext`
proves it. `ResolveBusinessContextAsync` is unchanged and remains the only authorization gate.

**Cost: unchanged.** `ProjectMemberships` always materialised every non-Removed row and `Classify` always
ran in memory over them, so this was a projection filter, never a query filter.

‼️ **Do NOT add a `None` member to `BusinessAccessScope` without first converting
`RequiresPermissionAttribute.cs:80` and `NotificationRecipientResolver.cs:240`** from `== BillingOnly` to
positive `== Full` checks — otherwise `None` falls into the permissive branch and is *less* restrictive
than `BillingOnly`.

---

## ‼️ PHASE 8 PART D (2026-08-04) — the admin support cross-lookup's PERSON half lives here.

**New `Controllers/Admin/AdminTenancyLookupController.cs`, route `api/v{version}/admin/tenancy`,
`[Authorize(Roles = "Admin")]`, `[EnableCors("B2CPolicy")]`.**

| Endpoint | Returns |
|---|---|
| `GET admin/tenancy/search?q=` | `AdminTenancySearchResultDto` — `People[]` + `Businesses[]` + `CloseMatches[]`, **every row carrying an `AdminTenancyMatchReason`** |
| `GET admin/tenancy/people/{userNumber}` | `AdminPersonTenancyDto` — the person plus **every** business they belong to, including the ones they cannot enter, each with the reason |

Backed by `IAdminTenancyLookupService` (`clinqetinfrastructure/Services/Tenancy/`), registered by
`services.AddAdminTenancyLookup()` — **Identity host only.**

### ‼️ Why the person half is HERE and the business half is in the Main API (AD2)

This host owns `UserProfile` normalization: `NormalizedEmail` is written by the registered
`ILookupNormalizer`, so the email seek must go through it rather than a hand-rolled `ToUpperInvariant()` that
merely happens to agree today. The BUSINESS half needs `IBusinessSeatService` → `IEntitlementService`, and
`TenancyServiceRegistration.cs` states that this host deliberately does not take the payments graph — so
`GET admin/providers/{businessId}/members` lives on `AdminProviderController` in the Main API instead.

### ‼️ SARGABILITY IS THE CONTRACT

Every branch is an index seek and the handle SHAPE decides which run — an email never probes `UserNumber`, a
phone never probes the business-name index. The **one** approved SQL index `IX_Business_DisplayName` (migration
`20260804150226_AddBusinessDisplayNameIndex`) is seeked with an **escaped prefix `LIKE`**;
`AdminTenancyLookupService.LikePrefix` escapes `[`, `%` and `_` so a pasted wildcard cannot turn the seek
into a scan. ‼️ **`LOWER(`, `UPPER(`, `LEFT(` and `CHARINDEX` appear in none of the generated SQL**, asserted
by `AdminTenancyLookupSqlShapeTests` against the **real** predicate expressions (`internal` for that reason).

### ‼️ Other rules that must not be softened

- **READ-ONLY.** No `HttpPost/Put/Patch/Delete` on the controller; no `SaveChanges`/`Add(`/`Remove(`/`Update(`
  in the service. D10.2 forbids message content, member notification preferences, impersonation and any
  membership write.
- **`IgnoreQueryFilters()` is deliberate**: `UserProfile` carries a global `IsActive` filter, and a closed
  account is usually exactly why support is looking. It must resolve and be MARKED, never silently absent.
- **A `Removed` membership must stay indistinguishable from "no such business"** — the same guarantee the
  workspace list gives.
- ‼️ **Nothing identifying is logged.** The handle is somebody's email or phone number; the log line carries
  **counts only**, and the search handler passes `null` as the exception entityId.
- **New appsettings key `AdminSupport:LookupResultLimit` = 20**, with the class default mirroring it. Not a
  `local.settings.json` key ⇒ **no ARM and no `deploy.ps1` change.**
- **The existing `AdminUserLookupCache` is untouched** and still writes `Size = 1`. Part D added **zero**
  `IMemoryCache` writes.

### ‼️ NEVER pass `--no-build` to `dotnet ef`

In this session it produced an **empty** migration and then **deleted the wrong migration** — a stale assembly
carries a stale migration list as well as a stale model. There is no version control in `C:\Nik`. Take a
backup of `Migrations/` first, and always `dotnet build` before `dotnet ef`.

---

## ‼️ MULTI-USER TENANCY — PHASE 9 (2026-08-04). The exchange is throttled; the workspace list is not self-filtering.

> **The whole model is now one skill: read `clinqet-provider-teams` before any tenancy change.** This
> section records only what changed in **this** host.

### `POST /api/v1/auth/business-context` is rate-limited (H4)

`IBusinessContextExchangeThrottle` / `BusinessContextExchangeThrottle` — a fixed window per caller,
`IMemoryCache` with `Size = 1`, checked **BEFORE any database work**, refusing with **429**
`business_context_rate_limited` (`Error_BusinessContextRateLimited`).

Settings, Identity host only, class defaults mirroring the JSON:
`Tenancy:BusinessContext:MaxExchangesPerWindow` **20** · `WindowMinutes` **5**.
‼️ Appsettings-only ⇒ **no ARM and no `deploy.ps1` entry** (only a `local.settings.json` key or a new
Azure resource needs those).

‼️ **The reason is NOT enumeration.** §11.2 already guarantees that "no such business" and "no live
membership" return **byte-identical** bodies, and an integration test byte-compares them. The reason is
that **every DENIED exchange calls `RevokeBusinessSessionsAsync`, an `ExecuteUpdateAsync` against
`RefreshToken`** — the platform's hottest-insert table — so an authenticated Partner could loop it and
drive unbounded SQL **writes**. Bounding it before the database work makes the refusal itself free.

‼️ **A shared `FixedWindowThrottle` primitive was considered and REJECTED.**
`OwnershipTransferReminderThrottle` is a *cooldown*, a genuinely different shape, so this is only the
second *counter*. **A third counter should trigger the extraction** — refactoring working tested code
inside a hardening phase is churn with regression risk.

### `GetActiveMembershipsAsync` is now `GetMembershipsAsync`, and the list is NOT self-filtering

The old name became a lie the moment the list stopped filtering itself. It now returns **every workspace
the person HOLDS**, each carrying `CanEnter` + `AccessDenialReasonKey`, with `AccessScope` **NULLABLE**:

| Situation | In the list? |
|---|---|
| Active membership, Active/Onboarding business | ✅ `CanEnter = true`, `Full` |
| Suspended business, the **primary owner** | ✅ `CanEnter = true`, **`BillingOnly`** (D9) |
| Suspended business, anyone else | ✅ **`CanEnter = false`**, scope **null**, `Error_BusinessSuspended` |
| Suspended **membership** | ✅ `CanEnter = false`, `Error_BusinessMembershipSuspended` |
| **Closed** business | ✅ `CanEnter = false`, `Error_BusinessClosed` |
| Removed · Invited (unaccepted) | ❌ filtered **in SQL** |

‼️ **`AccessScope` had to become nullable because `default(BusinessAccessScope)` is `Full`** — a
non-nullable scope on an unenterable row would have advertised full access.

‼️ **Anything SELECTING a workspace from this list must filter on `CanEnter` ITSELF.**
`IssueSessionAsync` does, explicitly, and **throws** rather than defaulting a missing scope at the token
boundary. Pinned by `IssueSession_WhenTheOnlyWorkspaceCannotBeEntered_MintsNoBusinessContext`.
‼️ **`ResolveBusinessContextAsync` is UNCHANGED and remains the only authorization gate** — widening a
display list is never an authorization change.

‼️ **A `Removed` membership must stay indistinguishable from "no such business"**, and an `Invited` row is
not a workspace the person holds.

**Cost: zero.** `ProjectMemberships` always materialised every non-`Removed` row and `Classify` always ran
**in memory** over them, so this was a projection filter, never a query filter. Filtering `Invited` and
`Removed` in SQL makes the payload marginally *smaller* than before.

### Why the support cross-lookup spans TWO hosts (AD2)

The **person** half is here because it needs this host's own **`ILookupNormalizer`** —
`UserProfile.NormalizedEmail` is written by it, so hand-rolling `ToUpperInvariant()` in the Main API would
be an **unstated coupling to a framework default** that breaks silently if a custom normalizer is
registered. The **business** half is on the Main API because it needs `IBusinessSeatService` →
`IEntitlementService`, and `TenancyServiceRegistration` states in as many words that this host
deliberately does not take the payments graph (L51).

### Three structured log lines, and the table that will NOT be built

‼️ **`SecurityAuditEvent` IS CLOSED — it will never be built (H1). Its absence is NOT a gap.**
D10.3's audit-store requirement is **WITHDRAWN by owner decision.** What ships instead is **one
structured log line per privileged read** at `AdminTenancyLookupController.Search`, `.GetPerson` and
(Main API) `AdminProviderController.GetMembers` — **actor · subject · outcome, and NEVER the search text,
which is somebody's email or phone number.**

‼️ **`AP-1` is unchanged and must stay unchanged:** the admin portal claims nothing about a view being
recorded, and `TenancyLookupPage.test.js`'s *"never claims that opening a member list is recorded"* must
keep passing. **Do not report the missing table as a defect.**

### ‼️ Refresh still cannot be unit-tested on EF InMemory

`RefreshTokenAsync` claims its token with `ExecuteSqlInterpolatedAsync`. InMemory cannot run the SQL claim or transaction; infrastructure failures propagate. Prove refresh semantics against real SQL in `Clinqet.Identity.IntegrationTests`.

## AI call coverage audit (2026-09-15)

Identity currently has no AI model or Azure Search calls, so no unused publisher/settings were added. Its own `AiResourceLimitCoverageTests` guards this inventory and classifies its four outbound HTTP registrations. Any future AI integration must install the shared resource-alert observers; a peer host must never be scanned to prove Identity coverage.

---

## ‼️ THE SIGN-IN SURFACE NEVER ANSWERS WITH A DEVELOPER SENTENCE (2026-09-19)

`BaseController.ResolveCallerFailure` is the same single rule the Main API uses, so one throw cannot get two
answers across the two hosts. A domain refusal's Message IS a localization key, resolved in the CALLER's language;
the catalogue answers an unknown key **VERBATIM**, so a message that comes back as itself is infrastructure.

| Exception | Message resolves | Message does NOT resolve |
|---|---|---|
| `DuplicateItemException` | **409** + that copy | **409** + `Error_ResourceAlreadyExists` |
| `KeyNotFoundException` | 404 + that copy | 404 + `Error_ResourceNotFound` |
| `UnauthorizedAccessException` | 403 + that copy | 403 + `Error_Unauthorized` (was a **500**) |
| `ArgumentException` / `ValidationException` | 400 + that copy | 400 + `Error_InvalidInputOrOperation` |
| `InvalidOperationException` | 400 + that copy | **500** + `Error_InternalServerError` |
| `ILocalizedRefusal` | its status + copy with arguments substituted | — |

`UnknownUserException` keeps its own fixed **401** and never consults the message — the sign-in surface is
deliberately opaque about which half of a credential was wrong.

Before this, a SQL outage during login shipped as **400 "Invalid input or operation: &lt;developer sentence&gt;"**.

**Guard:** `Conventions/ExceptionMessagesNeverReachTheCallerTests` (this repo's own copy — peer hosts never scan
each other, §0.15) fails the build on a controller that hands `ex.Message` to the catalogue, into a response, or
into a text branch; its exemption registry fails in BOTH directions. Sabotage-proven, as is the rule.

‼️ **`Helpers/TestLocalization.Real`** loads the REAL catalogue from this project's own output. A
`Mock<ILocalizationService>` returning the key verbatim is exactly what production does for a key it does NOT
have, so such a double cannot tell a refusal from a developer sentence — every assertion about which one a
controller answered would be vacuous. A five-language theory pins that moving the resolve to the controller cost
no translation.

## ‼️ A COUNTRY IS READ, NEVER GUESSED AS "US" (DD-34 / G-21, search-topology Phase 3C, 2026-09-25)

A stored user country becomes a self-serve workspace's country — and with it the business's currency and search
market — so an unreadable one must stay EMPTY.

- **`CountryCodeHelper.ReadCountry(country, dialingCode)`** → `(Country, DialingCode)`: a readable name / ISO code
  (strict), else a dialling code only ONE country uses (`TryFromDialingCodeStrict` — "1" names none), else EMPTY.
- `AuthService` uses it for **registration** (`RegisterDto.Country` / `CountryCode`) and **external sign-in**
  (`ExternalSignInCountry`: the provider's claims first, then Front Door's `X-Client-Country` header, each read
  strictly). `AdminProviderProvisioningService` uses it too.
- **`SeedData` is strict**: a configured `CountryCode` that is neither digits nor readable fails the seed loudly
  (`SeedDialingCode`), never the US.
- The orphan `Identity:ExternalLogin:CountryCode` setting is DELETED — nothing read it.
- US territories (PR, GU, VI, MP, AS, UM) read as the US (DD-35) — see `clinqet-shared-core`.
- Guard: `CountryParsingConventionTests` (API unit) registers the lenient parses left on purpose
  (`PhoneNumberNormalizer`, `ValidPhoneNumberAttribute` — a region hint for phone parsing, never a stored country — and
  `InvoicePaymentRails`' long-name fallback after its strict parse).


## Sign-in sessions — see `clinqet-auth-sessions` (2026-09-29)

The pre-session refresh model this section once described (account-wide revoke on logout, a 7-day sliding refresh,
`ExecuteTokenRotationAsync`) is GONE. Every sign-in is an `AuthSession` family validated live on every request;
rotation, recovery, the browser cookie, the password-reset cookie, security changes, registration holds, the phone
claim and push devices bound to sessions are documented in `clinqet-auth-sessions`. Read it before touching
`AuthController`, `DeviceTokenController` or any session path.

### Profile edits preserve MFA (2026-09-28)

`AuthService.UpdateUserProfileAsync` preserves both the enabled flag and selected factor when `UpdateProfileDto.IsMfaEnabled` is omitted. The DTO has an Email factor initializer, so independently applying its `MfaType` would silently change an existing phone factor. Unit and real-SQL regressions cover both factors. MFA itself changes only through `POST auth/mfa`, which needs a sign-in from the last 10 minutes (`RequireRecentSignIn`, 403 `recent_sign_in_required`) and an already-verified factor — see `clinqet-auth-sessions` §5.
