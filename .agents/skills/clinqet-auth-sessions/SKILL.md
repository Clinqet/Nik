---
name: clinqet-auth-sessions
description: |
  **CORE PLATFORM SKILL** — Work on sign-in sessions: the AuthSession family (one row per sign-in, its
  RefreshToken lineage, SHA-256 hashes only), rotation with replay detection and the two-minute lost-response
  recovery, live validation of every access token on BOTH API hosts (session_ended / session_context_changed /
  session_unavailable), the browser transport (HttpOnly __Host- cookie per app, never a refresh token in script),
  the password-reset cookie, security changes that end every session and continue this device, recent sign-in,
  registration holds (incl. the phone claim that needs a code on the profile's own phone), push devices bound to
  their session, retention, and the client rules all four apps follow.
  USE FOR: anything touching AuthSession/RefreshToken/DeviceTokens.SessionId, SessionAccessValidation,
  AuthSessionService, token/refresh, session/renew, logout, logout/all, password reset/change/set, email/phone/MFA
  change, registration verification, external-login exchanges, device-token register/refresh/unregister, and every
  web/mobile session store.
  Applies to clinqetinfrastructure/Services/Auth/{AuthSessionService,SessionCredentials,SessionAccessValidation,RefreshTokenRetentionService,AuthService}.cs,
  clinqetinfrastructure/Data/Repositories/DeviceTokenRepository.cs, clinqetidentity AuthController + DeviceTokenController +
  Services/Passwords, clinqetfuncations Functions/{DeviceRegistrationRetryFunction,DeviceTokenCleanupFunction}.cs,
  clinqetshared/Constants/{BrowserSessionConstants,SessionErrorCodes,SessionClaimTypes,ExternalLoginExchangeConstants}.cs.
---

# CLINQET AUTH SESSIONS

## RECENT CHANGES — 2026-10-06 (the Clinket team's setup session, and the take-over)

See the `clinqet-prepared-providers` skill for the whole feature. What changed HERE:

- **A setup session is a real `AuthSession`** carrying an ACTOR claim and no credential. `SetupSessionFilter` (default DENY) refuses every endpoint without `[AllowedInSetupSession]`, on BOTH API hosts.
- ‼️ **A hub is NOT an MVC action, so that filter never runs there.** `NotificationHub.OnConnectedAsync` aborts a setup session itself — otherwise the token joined the provider's own stream and `WatchVoiceLive` served the live transcript of a customer phone call.
- ‼️ **S2: a setup session never counts as a fresh sign-in.** `GrantsRecentSignIn` is `row.Current is not null`, and the record now DEFAULTS TO FALSE so a future construction site denies rather than grants.
- **A take-over ends every session** (`RevokeAllAsync` + a rotated `SecurityStamp`) BEFORE the new one is minted — including the admin's live setup session.
- **Correcting a prepared account's contact rotates the security stamp too.** The sign-in contact moved; a session live on the account must not outlive it.

> Authority for design history: `C:\Nik\Data\auth-session-review\AUTH-SESSION-IMPLEMENTATION-PLAN.md` (§5 schema, §11
> ledger and decision register D1–D16). This skill is the operating manual; read the code before changing it.

## 1. The model

| Store | What it holds | Rules |
|---|---|---|
| `AuthSession` (SQL) | One row per sign-in: `UserId`, `AuthenticatedAt`, `RememberMe`, `IdleExpiresAt`, `AbsoluteExpiresAt`, `SecurityStamp` (the account's at issue), `RevokedAt`, `BrowserHandleHash` | The family id IS the `SessionId` claim in every access token. It never changes across refreshes. |
| `RefreshToken` (SQL) | The family's credentials: `TokenHash` (SHA-256, never the token), `IsUsed`, `IsRevoked`, `ExpiryDate`, `ReplacementTokenId`, `RotationRequestHash`, `RecoveryPayload`, `RecoveryExpiresAt`, `ContextUserType`, `BusinessId` | The newest unused row is the session's context (customer/provider/admin + workspace). |
| `DeviceTokens.SessionId` (SQL, nullable, `IX_DeviceTokens_SessionId`, no FK) | The session that last registered/refreshed the push device | Ending the session retires the device. No FK: a device outlives the retention purge of its session. |

‼️ **LOCK ORDER, everywhere: UserProfile row → AuthSession row → RefreshToken rows → DeviceTokens rows.** Any path
that touches a later one first can deadlock against revoke-all. `AuthSessionService` owns every write to the first
three; it is the only writer of `AuthSession` and of the session columns of `RefreshToken`.

Lifetimes (`Session` section, both API hosts; class defaults mirror appsettings): access token **10 min**, ClockSkew
0, HS256 only; remembered **idle 7 d / absolute 30 d**; not remembered **24 h absolute**; recent sign-in **10 min**;
recovery window **120 s**. Refresh never extends `AbsoluteExpiresAt` or `AuthenticatedAt`.

## 2. Rotation, replay, recovery (`POST auth/token/refresh`, apps only)

- The client sends `{refreshToken, requestSecret, token?}`. `requestSecret` is 32 random bytes (base64url, 43 chars),
  **stored by the client BEFORE it sends** and re-sent unchanged on a retry.
- Rotation under locks: consume the presented row (`IsUsed`), write the replacement, seal the new credential into
  `RecoveryPayload` (AES-GCM, key from the request secret, AAD = consumed token hash) for `RecoveryWindowSeconds`.
- A consumed credential presented again **with the same secret inside the window** recovers the committed pair
  (lost response). Anything else presenting a consumed credential is a **replay and revokes that family only**.
- Execution-strategy transaction with `verifySucceeded` (the replacement hash exists) — a lost commit ack is never
  treated as a replay of its own success.
- A browser session's credential is never handed out, so presenting one to `token/refresh` is refused.

## 3. Live validation — every request on Identity AND the Main API

`SessionAccessValidation` runs in `JwtBearerEvents.OnTokenValidated` (and for SignalR connection tickets):

| Answer | When | Client must |
|---|---|---|
| 401 `session_ended` | revoked, expired, stamp moved, account inactive/suspended, no `SessionId` claim | end the session (only if the refused token is still the stored one) |
| 401 `session_context_changed` | the token names a workspace the session has left (switch in another window) | renew/refresh, reload the workspace, **never replay** the refused request |
| 503 `session_unavailable` + `Retry-After: 5` | the session store could not be read | keep everything, bounded retry |
| plain 401, no code | the access token itself expired | refresh once, replay only under the same person + session + workspace |

`RequireRecentSignIn`: sensitive changes need `AuthenticatedAt` within 10 min → 403 `recent_sign_in_required` (a
403, so the client does not loop through refresh).

## 4. Browser transport (web apps) — token-mediating, NOT a BFF (D6)

- Script holds only the 10-minute access token, **in memory**. The session lives in an HttpOnly, Secure,
  SameSite=Strict, host-only cookie on the Identity host, one per app: `__Host-ClinketSession-{Business|Admin|Customer}`.
  The handle never rotates (two tabs cannot race each other out).
- Every cookie call must carry `X-Clinket-Session-Transport: cookie` (forces a CORS preflight) and an `Origin` in
  `AllowedOrigins:{AppType}` (one app's page can never use another app's cookie). A browser without them gets 400
  `session_transport_required`, and a session just issued to it is revoked, not handed to script.
- A browser request is detected by the `Origin` header; native HTTP stacks never send it.
- `POST auth/session/renew {appType}` → fresh access token from the cookie. `POST auth/logout {appType}` clears it.
- ‼️ **Password reset (D8):** `password/reset/verification` from a browser sets `__Host-ClinketPasswordReset-{Business|Customer}`
  (HttpOnly, 15-min `Max-Age`, own `PasswordReset` token provider with `Identity:PasswordResetTokenLifespanMinutes` = 15)
  and returns `token: null`; the transport check runs **before** the code is spent. `password/reset` takes the grant
  **only** from that cookie (a body token is ignored). Unknown account, spent, expired or another account's grant all
  answer 400 `password_reset_expired` (cookie cleared). A rejected new password keeps the cookie so another can be
  tried. Apps still receive `token` in the body and must send it back (400 `Error_TokenRequired` otherwise).
- External sign-in: web uses `__Host-ClinketExternalLogin` + `POST auth/providers/login/exchange/web`; apps use a PKCE
  code on `clinket://` / `clinketpartner://` + `POST auth/providers/login/exchange/mobile`, spent like a refresh.
- ‼️ Sign-in uses `CheckPasswordSignInAsync` and never `SignInManager.SignInAsync`/`PasswordSignInAsync`: those issue
  ASP.NET Identity's own `.AspNetCore.Identity.Application` cookie — a second, unmanaged session no revoke can end.

## 5. Security changes

Password change/reset/set, email change, phone change, MFA change, and the first proof of an address:
rotate the security stamp → `RevokeAllAsync` (sessions, credentials **and devices**) → this device continues in a NEW
family that keeps its `AuthenticatedAt`, `AbsoluteExpiresAt` and `RememberMe` (`IssueSessionAsync(... continuing:)`),
and its push device is re-pointed to the new session in the same transaction (`SessionCreateRequest.ContinuesSessionId`;
a device the person had switched off before stays off). If the change committed but no session could be issued, the
answer is **401 `session_ended` with "Your change was saved. Please sign in again."** (`Error_ChangeSavedSignInAgain`) —
never a silent 200. `email/verify/verification` answers 401 `session_ended` with "Your email address is confirmed… sign in again with a code
sent to your email" (`Error_AddressProvenSignInAgain`) when proving the current address stripped sign-ins it had not
established (`RemoveUnprovenAccessAsync` saved): that ended every session, and the password/phone it had may be gone.

## 6. Registration holds (other session's design, extended by the audit)

- A submission never writes the live account: it is held as a `RegistrationPending` user-token row and applied only when
  the code bound to THAT submission (`Registration:{registrationId}`) is verified; single-use by atomic delete.
- ‼️ **Claim by phone (D14):** a new email whose phone matches an unclaimed, unconfirmed provider-created profile
  (CRM/WhatsApp) is held with `RequiresPhoneCode`. Two codes: email to the address typed, SMS
  (`RegistrationPhone:{registrationId}`) to the profile's OWN stored number, never the typed one. Verify needs both
  (`VerifyRegistrationMfaDto.PhoneCode`; either wrong = one answer); resend sends both; the first SMS is limited per
  account like every code send. On apply: email/username become the registrant's, `IsSystemGenerated = false`,
  `EmailConfirmed`, `PhoneNumberConfirmed`, UserNumber (and history) kept. Response: `requiresPhoneCode`, `phoneHint`
  ("•••• 4321"). A stranger's held claim is discarded when the owner completes.
- A system profile claimed by its EMAIL (phone differs) is also marked claimed (`IsSystemGenerated = false`).
- ‼️ **Sign-up refuses only a number another account has PROVEN** (`DuplicatePhoneNumber`, §11); a number another
  account only typed is accepted. Verify re-checks before applying: a held number, a phone claim's own number, or a
  phone claim's held email, proven/taken by another account since the hold → `DuplicatePhoneNumber` / `DuplicateEmail`,
  nothing applied.
- A resend of an EXPIRED hold is refused (`Error_RegistrationExpired`) and the row deleted — never revived.
- A resend cannot keep a hold open past `Identity:Registration:MaxHoldLifetimeMinutes` (30) from its FIRST issue
  (`PendingRegistration.FirstIssuedAt`); a sign-up refused after it was held (`IAuthService.DiscardRegistrationAsync`)
  leaves no hold and no uploaded picture behind.
- ‼️ **Every code send and code check is limited, and every limit that refuses raises an admin alert** (owner,
  2026-09-29/30). There are ten code checks: registration, email and phone code sign-in, the two-step code, reset, phone
  change, email change, phone and email verification, and account deletion. Two layers guard them.
  - **In memory, per server, per IP and per account: `Services/CodeLimits/CodeLimitGate`.** Its settings are
    `RateLimiting:AccountCodes|OtpLogin|OtpVerify`, and both the auth and profile controllers use it.
    - The IP bucket is counted first; a refused IP does not count against the account.
    - LimitedBy `IpAddress` alerts have a constant title and description, with the IP only in metadata, so the processor
      merges a spread-out flood. LimitedBy `Account` alerts name the account.
    - The alert claim is given back when its send fails, so the next refusal raises it instead.
    - ‼️ An account is keyed the way SQL finds it:
      - a typed email or phone is resolved to the account id first; an unknown address, which is sent nothing, uses its
        normalized form;
      - only a canonical GUID may name an account (`AccountKey`). Any other spelling is refused with 400 before any limit,
        because SQL matches ids ignoring case, width and some invisible characters.
    - Sign-up reserves a slot of the IP's allowance for the whole request, so parallel sign-ups never pass it together.
      - It gives the slot back if no code is sent; once a send has been attempted the slot stays spent.
      - An account confirmed at sign-up (load tests) never spends it.
      - A sign-up refused by the account limit writes nothing on the account: no hold, no picture and no consent record.
  - ‼️ **In SQL, per account and flow, across every server: `IVerificationCodeGuard` / `VerificationCodeGuard`.**
    - **Settings:** `Identity:CodeLimits` (`WrongCodesPerHour` 10, `WrongCodesPerDay` 20),
      `VerificationCodeLimitSettings` with `ValidateOnStart`.
    - **Flows (`VerificationCodeFlow`):**
      - Registration.
      - SignIn: email and phone code sign-in plus the two-step code.
      - PasswordReset: the account resolved once, in the controller.
      - Contact: phone and email change, and current-contact verification.
      - AccountDeletion.
    - **Reservation:**
      - Each attempt is RESERVED before its code is checked: one `UserToken` row `CodeAttempt:{flow}`, written by a
        raw `INSERT` so it never commits the request's other tracked changes. Its value is a fixed-width UTC stamp; no schema change.
      - The rows are then recounted in one query, so a parallel burst never passes the limit (an over-limit reservation
        is withdrawn).
      - A two-step attempt the MFA lockout refuses is never reserved; the controller reads the lockout first.
    - **Pause:** 10 in the last hour or 20 in the last day pauses that flow. Not even the right code is checked, and a
      paused attempt writes nothing. The answer is 429 `Error_CodeChecksPaused` ("Too many incorrect codes... paused for a
      while... try again later or contact support").
    - **What ends a count:**
      - A right code clears its flow's rows, except Contact.
      - ‼️ Contact codes go to addresses the holder chooses, so a right one releases only its own row
        (`ReleaseAttemptAsync`). An "already verified" answer checks no code and releases only itself too.
      - Day-old rows are pruned on every write.
    - **Alert:** each pause raises the flow's alert once per account, window and admin release: an in-memory claim plus
      `EventId = DeterministicGuid("code-pause", flow, account, limit, bucket, release)`. Severity is High, LimitedBy
      `WrongCodesPerHour`/`WrongCodesPerDay`. A failed send gives the claim back.
    - **Admin release** from Account Support: `POST admin/users/by-number/{userNumber}/code-pauses/clear` →
      `ReleasePausesAsync`.
      - It finds deactivated accounts too, clears every flow and writes a `CodeAttemptRelease` row, so the NEXT pause
        raises a new alert.
      - Its answer (`data`) is `CodePauseClearSuccess`, which warns that short per-server limits may last a few minutes,
        or `CodePauseClearNothing`. The activity recorded is `VerificationCodePauseCleared`.
  - ‼️ **Codes are purpose-bound.** A reset code has its own purpose (`PasswordReset`), so a sign-in code never resets a
    password and each code has one wrong-code count.
    - An account-deletion code (`AccountDeletionConfirm`) is single-use and matches only if this account was sent one
      (the `AccountDeletionMFA` issue row, consumed on use); the service owns its send (email first, else SMS).
    - A typed number resolves through `UserProfilePhoneLookup.FindByPhoneAsync`: its proven holder, else its only
      holder, else nobody (§11), so every caller means the same account.
  - The existing in-memory MFA lockout (5 → 15 min) and password lockout stay as they were.
  - **Dedicated alert types:**
    - `RegistrationCodeLimitReached`, `LoginCodeLimitReached`, `PasswordResetCodeLimitReached`,
      `ContactCodeLimitReached` and `AccountDeletionCodeLimitReached`.
    - `SessionReplayDetected`: a consumed refresh credential came back. Once per ended session, raised by
      `AuthService.RefreshSessionAsync`.
    - `UnprovenAccessRemoved`: the hijack defence stripped sign-ins. Once per account; High when a social sign-in or
      passkey was removed.
    - All are in `AdminPushSettings:PushableTypes` (the Identity, API and Functions lists are identical), and
      `AlertsPage.jsx` lists every type (parity test).
- ‼️ **Open sign-ups per account** (`Identity:Registration:MaxPendingPerAccount` 5, recounted after the write).
  - The next sign-up is refused with 429 (`RegistrationErrorCodes.Limited`).
  - Both refusals, before the write and on the recount, go through `RefuseOpenSignUpAsync` and raise
    `RegistrationCodeLimitReached` (LimitedBy `PendingHolds`, EventId per account + hold window).
  - A hold is live only while BOTH its latest code (`IssuedAt`) and its lifetime (`FirstIssuedAt` + 30 min) hold, for
    resend AND verify.
- ‼️ **Marketing opt-in is queued only after the code is verified** (owner, 2026-09-29): the pending registration carries
  `RegistrationMarketing(AppType, Platform)`; `VerifyRegistrationMfaAsync` returns `RegistrationVerified(User, Marketing)`
  and the controller subscribes the PROVEN account (its E.164 phone, its applied names). A sign-up can type anyone's email.
- Anonymous passkey discover/challenge return only `credentialId`, type, platform, display/description, flags —
  never device names, models, ids or dates — most recently used first (D11).

## 7. Push devices follow their session (D9)

- `device-tokens/register|refresh` bind the row to the caller's `SessionId` claim and reactivate it. ‼️ `IsActive` and
  `SessionId` are always written (`WriteBinding`): a session end may have retired the row after this context read it.
- `DeviceTokenUpsertResult.HubSyncRequired` is true on insert, a new token, a new platform, a **new owner** (shared phone:
  the hub installation is keyed by DeviceId but tagged with the owner's UserNumber) or a row back from retirement.
- Session end retires its devices (`IsActive = 0`) inside the revoking transaction (`RevokeSessionCoreAsync`, `RevokeAllAsync`).
- `logout` / `logout/all` then remove the retired devices from the Notification Hub at once (best effort, after commit).
- `DeviceRegistrationRetryFunction` (15 min) removes whatever is still retired-but-registered, only rows retired more than
  `DeviceRegistrationRetry:RetiredDeviceGraceMinutes` (5) ago — a security change retires then re-points its own
  device moments apart. It pages `BatchSize` rows up to `MaxRetiredBatchesPerRun` (10), tries each device once a run (a
  refused one stays first in line), and its "none released" alert is cooled down (`RetiredDeviceAlertCooldownMinutes`).
  `device-tokens/unregister` clears `IsRegisteredWithHub` once the hub no longer holds it.
- `DeviceTokenCleanupFunction` (nightly, keyset pages of `EndedSessionPageSize`) retires devices whose session ended
  without a revoke (expired, purged, refused by its stamp, account deactivated or suspended) — "live" is exactly what
  `SessionAccessValidation` accepts — and devices with NO session whose account is signed in nowhere. ‼️ Judged in one
  SELECT, written in a second UPDATE that re-checks the judged binding: an UPDATE reading AuthSessions would lock them
  after DeviceTokens, against the lock order, and a device re-pointed in between must stay on.

## 8. Client rules (all web and mobile apps)

Web keeps the access token in memory only and renews from the cookie; mobile keeps ONE keychain record
(`AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY`) whose reads are absent / unavailable / value — unavailable never signs out;
a session counter (epoch) drops late answers; a refused request is replayed only under the same sub + SessionId +
BusinessId, and `session_context_changed` never; only a 401 ends a session, and only for the credential it refused;
sign-out clears locally first and keeps a pending marker/record until the server answers 200 (a 503 is NOT a
confirmation); the device id and personal preferences survive sign-out. Mobile keychain records are ordered by an install-local
generation counter, never the clock; a security change holds a `session_ended` for at most 10 s (customer) / 60 s
(provider; Android fetch never times out) / 30 s (admin, request timeout); a realtime hub refusal gets one refresh per
refused token, never a loop. Per-app detail: `clinqet-ui-common`
("Session model"), `clinqet-partner-app`, `clinqet-user-app`, `clinqet-admin-app`, `clinqet-customer-mobile`,
`clinqet-provider-mobile`.

‼️ **A session lives in ONE stamp's SQL.** The shared `identity.`/`api.` hosts are geo-routed per request by the
caller's IP (deploy.ps1 `Sync-GeoRoutingToRoutes`), so a call that lands on the other stamp answers `session_ended`.
Web builds bake per-stamp hosts (`identity-<stamp>`, `api-<stamp>`); the customer and provider apps pin every
authenticated call to the per-stamp hosts of the session's issuing origin (`src/services/stampRouting.ts`, the origin
captured from the request that issued the session, never the region at save time). External sign-in starts and
exchanges on one `identity-<stamp>`, so each provider's redirect URI (`/signin-google|facebook|apple`) must be
registered for every stamp host — the web apps already sign in through those hosts. Per-stamp hosts share one Front
Door WAF: `api-<stamp>` is limited to 500 req/min/IP like the shared api host; every other per-stamp host to 200
(`networking-perstamp-health.json`, rules `RateLimitPerIPApi` + `RateLimitPerIP`).

Admin MOBILE (`clinqetmobileadminapp`, no skill of its own):
- **Session record:** one keychain record `com.clinketadmin.session`, written only by `writeRecord`.
  - It goes through a staging slot `…session.next`; a read prefers a valid staged record, and launch finishes a half
    write (never while the device is marked signed out).
  - Every record carries `savedAt` and `installedAt`.
- **Keychain rule:** the shared one — iOS `-26275` and Android `E_CRYPTO_FAILED` without "Could not access Keystore"
  reset the item; everything else is unavailable. "Keep me signed in" defaults to on.
- **Password change** runs through `runSecurityChange` (30 s bound). It holds a `session_ended` for the old session
  until the change settles. `session_ended` ends the session even on a replayed request.
- **Sign-out:**
  - The pending-logout record is written BEFORE the local clear. If it cannot be read or written, the record is not
    erased: it stays behind the signed-out mark until it can be queued.
  - `clinket.auth.signedOut` (AsyncStorage) holds a time. Only records saved before it are signed out: never used, and
    ended on the server once readable. A readable newer record clears the mark.
  - The mark is written through on every change, and the next settle re-saves one that storage missed. While it exists,
    the sign-out is reported pending.
- **Retries:** pending sign-outs are retried at launch, on return and when `isConnected` goes false→true. NetInfo 12.0.1
  runs with `reachabilityShouldRun` off: no probe to a Google endpoint.
- **Timeouts:** refresh and logout time out at 10 s, and Retry-After is capped at 30 s. So every attempt in one refresh run
  is answered within 90 s, inside the 120 s recovery window. A secret still unanswered when a run gives up is sent again by
  the next refresh, which can fall outside the window; the server then treats it as a replay. That is inherent.
- **First launch of an install** (`session.installed` absent) ends only a record from another install (the OS first-install
  time); if the OS cannot say which install this is, it ends any stored record.
- **Lost session:** a 401 on a tokenless request, while a session is held and the keychain reads absent, ends the session.
  "Sign in again" on the unavailable screen signs that session out on the device first.
- **Sign out everywhere** sends no push call while `logout/all` is in flight.
- **Known limit:** a sign-in that overwrites a session the device could not read overwrites its only refresh token; that
  server session lives until its own expiry.

The admin MOBILE app deliberately stays on the shared hosts (owner, 2026-09-30): Front Door's `GeoRouting` rules pick
the stamp per request from the caller's IP country (`RemoteAddress` GeoMatch, session affinity disabled). Known limits:
an admin whose IP country flips mid-session (VPN, roaming) is signed out and signs in again; a sign-out that lands on
the other stamp answers 200 without ending the real session (the device already deleted its tokens; the session
expires on its own); a mobile admin reaches only the stamp their country maps to; a refresh that lands on the other stamp gets 401 `session_ended`
and the device ends its copy with no queued sign-out, so the real session on the home stamp lives until it expires.

## 9. Tests (real engines)

| Where | Proves |
|---|---|
| `Clinqet.Identity.IntegrationTests/Tests/RefreshSessionIntegrationTests.cs`, `BrowserSessionIntegrationTests.cs`, `ExternalLoginExchangeIntegrationTests.cs` | rotation, recovery, replay (and its one SessionReplayDetected alert), browser cookie, exchanges |
| `.../PasswordResetCookieIntegrationTests.cs` | reset cookie, 15 min, body token ignored, transport before code, enumeration-free |
| `.../PhoneClaimRegistrationIntegrationTests.cs` | the two-code phone claim; a claim whose email was taken meanwhile claims nothing |
| `.../DeviceSessionIntegrationTests.cs` | device binding, sign-out release, continuing re-point, shared phone |
| `.../Repositories/DeviceTokenRepositoryIntegrationTests.cs` | register/refresh switch a device back on after a stale read |
| `.../SessionAuditRegressionIntegrationTests.cs` | no Identity cookie, customer session cannot create a business, trimmed passkey discovery |
| `.../RegistrationSafeguardsIntegrationTests.cs` | marketing only after proof; open-sign-up cap (and a parallel burst never passes it), resend limit (one alert each); duplicate phone at hold, at apply and among existing duplicates; expired resend; hold lifetime at resend and at verify; a refused sign-up leaves no hold |
| `.../VerificationCodeGuardIntegrationTests.cs` | the SQL wrong-code guard: hourly and daily pause refuse even the right code, one alert per pause, parallel burst never passes, day-old rows pruned, right code clears its flow only (contact: only itself; "already verified" releases only itself), re-spelled id, full-width id refused, every endpoint wired to its own flow with the pause sentence, lockout-refused two-step never counted, a sign-in code never resets a password, account deletion paused and counted, a failed alert raised by the next pause, a new alert after an admin release, admin release (and admins only) |
| `.../AuthControllerVerifyCurrentContactIntegrationTests.cs` | the email proof that strips unproven sign-ins answers 401 change-saved |
| `.../UserProfileControllerIntegrationTests.cs` | account deletion: request then confirm; a code never sent is refused |
| `.../ProvenPhoneNumberIntegrationTests.cs` | §11: two phone changes to one number at once → exactly one wins, the other "already in use"; a proven number refused before any code is sent; a typed one proven by the changer; phone sign-in proves a free number, signs in but leaves it typed when another account proved it, two at once → one owner; two typed holders → no account |
| `Clinqet.API.IntegrationTests/Tests/ProvenPhoneNumberMigrationSqlTests.cs` | §11 migration: typed and deleted-account duplicates survive Up, a second proven owner is refused (2601, recognised by `IsProvenNumberTaken`), a proven number without its key is refused (547), two active owners stop Up whole, Down/Up |
| `Clinqet.Communications.IntegrationTests/Tests/Functions/DeviceSessionSweepIntegrationTests.cs` | nightly retire (stamp, deactivated, suspended, no-session devices, re-point guard via interceptor) + 15-min release across batches (serial "Device Tokens Serial" collection, UserNumber prefix "S") |

The nightly and 15-minute sweeps run in the Functions host, so their tests live in the Functions suites (§0.18).

## 10. Traps

- ‼️ The Identity host is **NoTracking** globally; `UserManager` saves attach. Detach before a second save.
- ‼️ `Mock<IConfiguration>` in AuthControllerTests answers every key with "test-value" — match template names with `It.IsAny<string>()`.
- ‼️ `AuthService` reads its settings through the indexer (`_configuration["…"] ?? "default"`): its unit tests mock
  `IConfiguration`, and `GetValue` would call a `GetSection` the mock never set up.
- ‼️ `EmailTokenProvider` codes derive from the stamp + purpose + the user's CURRENT email: verify before applying a held email.
- ‼️ Anonymous code endpoints refuse any id that is not a canonical GUID (400 `UserIdRequired`): tests must use GUID
  ids (`"test-user-id"` never reaches the service). `CodeLimitGate` counters are process-static: each limit test brings
  its own IP and account. A mocked `UserManager.NormalizeEmail` returns null unless set up (AuthControllerTests sets it).
- ‼️ Guard rows are written by a raw `INSERT INTO [UserToken]`: the guard needs a relational provider (real SQL tests only).
- A new `IAuthSessionService` member must also be implemented by `InMemoryAuthSessionService` (Identity unit tests) and
  `MockAuthSessionService` (Main API integration tests) — compile-required, not a placement violation (§0.18 rule 3).

## Web session-cookie lock (2026-09-30)

Identity sets `__Host-ClinketSession-{App}` on sign-in and on security changes (12 endpoints), and deletes it on `logout`/`logout/all` (200) and on `session/renew` (401, dead handle); whichever answer lands last wins. All three web apps therefore hold the Web Lock `clinket.auth.sessionCookie` (`sessionCookieLock.js`; an in-tab fallback with the same grant rules where `navigator.locks` is missing):
- `holdToSetCookie` (exclusive): every cookie-setting send and replay, scoped to the HTTP exchange only (axios adapter). Locks are not re-entrant, so a 401 → renew → replay takes fresh holds.
- `holdToDeleteCookie` (shared): logout, logout/all, and each renew attempt; back-off waits run outside the hold.
- `holdToDeleteCookieIfFree`: only the automatic pending-sign-out retry. `NOT_SENT` = nothing sent, marker kept.
- Holds: at most 30 s, aborted at the deadline, released at deadline + 2 s regardless. The wait for a hold is capped at 32 s, after which the request is sent unlocked with a warning.
- A sign-in whose answer carries a session clears the pending sign-out marker INSIDE its hold.
- The later action wins: a sign-out clicked during another tab's sign-in runs after it.
- Mobile needs none of this: no shared cookie; each sign-out names its own refresh token.

## Sign-out then sign-in again (2026-10-03)

Owner report: signing out, then straight back in (mostly Google), sometimes landed back on the sign-in screen with no message; a second try worked.

- ‼️ **Next 16 syncs `window.history.replaceState` into `useSearchParams`** (`next/dist/client/components/app-router.js`, ACTION_RESTORE). Provider web `HomeClient` spent `?external_login=complete` with `replaceState`, so its landing effect ran AGAIN without the marker and called `restoreSession()`. That renewal raced the exchange for the session-cookie lock; when it won it answered `sessionInvalid` and the landing routed to `/login`, silently. The effect now returns once the exchange started.
- **Restore hold (provider web, as the customer web already had):** `sessionRecovery.holdRestoreForExternalLogin()` — `restoreSession()` taken on a `?external_login=complete` address (or while `HomeClient` holds it) waits for the exchange, then adopts its token without renewing. Released when the exchange settles; bounded at 30 s. Without a hold the renewal starts exactly as before (no extra tick).
- **Provider web `useAuthManager` follows the tab:** `onSessionToken` and `onAuthPurge` re-decide `isAuthenticated`/`user`. It used to decide once per load, so after a same-tab sign-out + sign-in the policy check and the header held "signed out" until a reload.
- **Customer mobile social sign-in:** (1) only an iOS `cancel` from `openAuth` discards the PKCE attempt — Android's closing tab races the callback link (provider mobile already did this); (2) every failure is said in our own words (`SOCIAL_LOGIN.*`, `ThemedAlert`): Identity refused → `FAILED`, nothing decided → `UNAVAILABLE`, provider refusal → `NAME_NOT_PROVIDED`/`EMAIL_NOT_VERIFIED` naming only Google/Facebook/Apple, and only for an attempt this device started; `exchangeExternalLoginCode` returns `{kind:'signedIn'|'refused'|'unavailable'}`; (3) `replaceHeldSession` treats a record with no refresh token (only the exchange's pending secret) as a guest, not another person's session — it used to `clear('logout')` and lose the guest cart mid-sign-in.
- **Provider mobile:** `appNavigation/launchLink.takeLaunchLink()` hands the launch URL out once per process (Android answers `getInitialURL` with the launch link for the process's whole life; re-reading it on foreground and on every sign-in screen mount replayed an old sign-in failure and cleared the new attempt's verifier). `startIdentityFlow()` ends the sign-out toast mute, so a sign-in started inside it reports its errors. `AuthProvider` follows `onSessionEstablished('signIn'|'restored')`.

### Audit follow-ups (2026-10-03)

- The provider-web restore hold is taken only on the landings that run the exchange (`/` and `/continue`): a crafted marker elsewhere would hold the tab 30 s. `awaitRestoredSession` waits on a live hold BEFORE its sign-out-pending check, because a social sign-in clears that marker only when its exchange answers.
- `useAuthManager` also exposes `account` (UserNumber); `PolicyConsentChecker` re-checks when it changes, not only when the signed-in flag flips.
- Customer mobile: one failed callback delivered to both the link listener and `openAuth` raises ONE alert (single-flight per URL); `linking.getInitialURL` consumes a launch social callback once per process; an exchange answered 200 without a session is `refused`, not `unavailable`.
- Provider mobile: the passkey screen ends the sign-out toast mute at submit (its discovery messages come before `startIdentityFlow`); `tokenManager.onSignedOut` fires from `clearAuthTokens`.

## Consent: one question at a time (2026-10-03)

See `clinqet-ui-common` "Consent model — one question at a time". It covers: nothing on sign-in surfaces; a small bottom cookie card (per device); one signed-in agreements dialog that carries the cookie question when this device has not answered it; Terms + Privacy only on Register and on the server. Server side: `EnforcedPolicies` = privacy + terms. The cookie row is proof only and never stale.

## 11. Phone numbers: one owner per PROVEN number (2026-10-04)

The rule, in one line: **a number proven with a code belongs to one active account; a number only typed is a note on
its account and never blocks anyone.** Owner-approved 2026-10-04 (free-trial abuse: one real phone, one account).

- **Database:** `UX_UserProfile_PhoneSearchKey_Proven` — unique on the last-10-digit `PhoneSearchKey`, filtered
  `IsActive = 1 AND PhoneNumberConfirmed = 1` (a deleted account frees its number). `CK_UserProfile_ProvenPhoneSearchable`
  — a proven number must start with `+` and carry its key, so nothing (not even a hand edit) proves a number past the
  index. Migration `ProvenPhoneNumberUnique` changes no data; it also dropped the two unused full-number indexes.
  Names live in `UserProfilePhoneLookup.ProvenNumberIndex` / `ProvenNumberRule`.
- **Lookup (`UserProfilePhoneLookup`):** `FindHoldersAsync` = active holders, proven first, then oldest.
  `FindByPhoneAsync` = the proven holder, else the only holder, else **nobody** (never guess between two typed holders).
  `IsProvenByAnotherAsync` matches on the key alone, exactly as the index. `CanBeProven` mirrors the check rule.
  `IsProvenNumberTaken(DbUpdateException)` recognises the index refusing a save (2601/2627 + index name).
- **What proves a number, and what each says when another account proved it first:**

| Path | Before the save | Same-moment race (index refuses) |
|---|---|---|
| Phone / WhatsApp code sign-in, phone two-step code | `ProvePhoneIfFreeAsync`: proven only if free | sign-in **still succeeds**; number stays typed |
| Phone change (send + verify) | `DuplicatePhoneNumber` (send spends no SMS) | `DuplicatePhoneNumber`; the code attempt is released, never counted wrong |
| Verify current phone (send + verify) | `DuplicatePhoneNumber`; an unusable number on file → `Error_InvalidPhoneFormat` | `DuplicatePhoneNumber`; attempt released |
| Sign-up claim of a provider-created profile (phone code) | `DuplicatePhoneNumber`, nothing applied | `DuplicatePhoneNumber` |
| Admin-created provider (proven without a code) | `ProviderAccountAlreadyExists` only for an ACTIVE PROVEN holder | same (the existing catch re-checks) |

- Sign-up, Google/Apple/Microsoft sign-in, provider-created customers and profile edits never prove a number, so they can
  never hit the index. `VerifyPhoneChangeAndGenerateTokenAsync` returns `(Success, ErrorKey, Response)`; the controller
  shows `ErrorKey` localized.
- ‼️ After a failed save, detach the account and put back its `ConcurrencyStamp` (UserStore moved it), or a later save in
  the same request replays the refused change or fails on concurrency.
- ‼️ Test seeds that mark a phone proven must mint a unique number (API: `Helpers/TestPhoneNumbers`; Identity: a per-class
  counter prefix). A shared real-SQL fixture otherwise refuses the second seed.
- **Free trial (next):** start it only on a proven number, and record the number it was given to — deleting the account
  or changing the number must not buy a second trial.
- Deliberately unchanged: the inbound SMS/WhatsApp "shared phone" resolvers (`BookingReplyActionService`,
  `BusinessMemberDirectory`, `WhatsAppInboundResolver`) still refuse when two active accounts hold a number — typed
  duplicates remain possible, and refusing is safe.
