# Approved authentication recommendations — implementation ledger

The owner approved implementing the recommendations in REVIEW.md on 2026-09-28. This document makes the next database change reviewable under AGENTS.md section 0.7. Proposed identifiers below are NEW identifiers, not claims that these objects already exist. No schema code or migration has been written for this proposal.

## First approval: persistent sessions and refresh recovery

Existing model inspected: `clinqetcore/Entities/SQL/RefreshToken.cs`, `UserProfile.cs`, `clinqetinfrastructure/Data/SQL/AppDbContext.cs`, and `Services/Auth/RefreshTokenRetentionService.cs`. Refresh tokens currently have their own expiry, used/revoked flags and business binding; they have no stable session identity. UserProfile inherits Identity's SecurityStamp, which can be reused without adding a second account security version.

| Required detail | Exact proposal |
|---|---|
| What — new SQL table | `AuthSession`: `Id uniqueidentifier NOT NULL` primary key; `UserId nvarchar(450) NOT NULL` FK to `UserProfile.Id`, NO ACTION on delete; `CreatedAt datetime2 NOT NULL`; `AuthenticatedAt datetime2 NOT NULL`; `RememberMe bit NOT NULL`; `IdleExpiresAt datetime2 NOT NULL`; `AbsoluteExpiresAt datetime2 NOT NULL`; `RevokedAt datetime2 NULL`; `SecurityStamp nvarchar(max) NOT NULL`; `Version rowversion NOT NULL`. Nonunique index `IX_AuthSession_UserId (UserId)` and nonunique index `IX_AuthSession_AbsoluteExpiresAt (AbsoluteExpiresAt)`. |
| What — existing SQL table | Rename `RefreshToken.Token` to `TokenHash`, change to `varchar(64) NOT NULL`, storing a SHA-256 hex digest of a cryptographically random 256-bit credential. Replace its existing unique token index with `UX_RefreshToken_TokenHash (TokenHash)`. Add `SessionId uniqueidentifier NULL`, FK to `AuthSession.Id`, NO ACTION on delete, and index `IX_RefreshToken_SessionId (SessionId)`. Null is reserved for revoked legacy rows; every new credential requires a session. |
| What — rotation recovery | Add to `RefreshToken`: `RotationRequestHash varchar(64) NULL`, `RecoveryPayload varbinary(max) NULL`, `RecoveryExpiresAt datetime2 NULL`, `ReplacementTokenId int NULL` (self-FK, NO ACTION, no extra index). The payload contains only the encrypted issued credential pair and expiry, with application-enforced size limits; not a profile/business-list snapshot. |
| Who reads it | `AuthService.RefreshTokenAsync` and `ExchangeExternalLoginTokenAsync` validate the family, expiry and bounded recovery record. `AuthController.Logout` resolves the authenticated session rather than revoking every account credential. Identity and Main API bearer validation use the session ID plus live UserProfile eligibility/SecurityStamp. The retention service reads session expiry and recovery expiry for cleanup. Workspace exchange retains the family while invalidating the previous context generation. |
| Who writes it | `IssueSessionAsync`/`MintSessionAsync` create a family after successful authentication. `GenerateRefreshTokenAsync` stores only token digests. Rotation writes the old credential's recovery record, inserts its replacement and advances family expiry in one transaction. Logout, password/contact/MFA changes, suspension and deactivation revoke the appropriate families transactionally. Retention clears expired recovery ciphertext and deletes expired credential/session rows in dependency order. |
| Why not a column | A user has many independent sign-ins and each sign-in has many rotated credentials. Family-wide state belongs to one session row, not a user column or duplicated across every historical refresh row. Recovery is one-to-one with a consumed refresh credential, so it uses columns, not a second recovery table. |
| Why not a constant/enum | Identifiers, authentication times, deadlines, versions and hashes vary per session/rotation. Durations remain settings; no lookup table for policies or revocation reasons. |
| Why not already stored | `RefreshToken.Id` changes on every rotation, `CreatedAt` is credential creation time, and `ExpiryDate` is that credential's deadline. They cannot identify or revoke a complete lineage. Existing `UserProfile.SecurityStamp` is reused for account-wide revocation; no new UserProfile column is proposed. Existing context, IP and user-agent fields are retained rather than duplicated. |
| Cost | One AuthSession insert per sign-in and one session update per successful rotation. Two small session indexes, one credential SessionId index, and replacement of the existing unique plaintext index by a fixed-width digest index. Live authorization adds a SQL lookup per authenticated request; no stale positive cache is allowed to pretend revocation is immediate. Recovery adds one bounded ciphertext write per rotation and batched expiry cleanup. One forward migration, with no edits to applied migrations. |
| What breaks if omitted | Per-device logout, family-scoped replay containment, fixed session lifetime, recent-authentication checks and durable recovery after lost HTTP responses cannot be enforced reliably. Client storage and process memory cannot substitute for this state. |

### Migration and concurrency contract

- Existing plaintext rows are hashed in the forward migration and marked revoked. Existing sessions must sign in once after coordinated nonproduction rollout; no silent acceptance of unverifiable legacy JWTs or legacy families. Nullable SessionId lets revoked historical rows retain their audit/retention history without fabricating families. No account/profile/business data is deleted.
- Live JWTs carry the session identity and context generation. Account-wide changes update the existing Identity SecurityStamp and revoke families in the same SQL transaction as the credential mutation.
- Refresh, logout, workspace change and credential mutation must serialize against the session/account rows in a consistent lock order. Rowversion alone is not permission to overwrite a concurrently revoked session. Real SQL race tests must prove no successful rotation resurrects a revoked family.
- A client persists a cryptographically random rotation request secret before sending refresh. Only the same secret, old credential, live family and still-current replacement may recover a committed result, within a bounded setting. An idempotency identifier alone is not independent device authentication; it only distinguishes retries of the same request. A distinct replay revokes that family. Already expired/revoked families cannot revoke a later independent sign-in.
- Recovery ciphertext requires a shared, durable, protected key ring across Identity instances. The inspected Program.cs calls AddDataProtection but does not itself configure PersistKeys. Deployment/key persistence must be verified and configured before claiming restart/multi-instance recovery. No new Azure resource is implicitly approved by this proposal.
- Browser BFF changes must coordinate refresh server-side and keep credentials out of JavaScript. Cookies need Secure, HttpOnly, host scope, CSRF protection and explicit origin checks. Streaming, uploads, OAuth, SignalR and region routing must all be covered before removing existing token storage.

### Lifetime policy proposed for the same approval

Remembered sessions: seven-day idle window, renewed on successful refresh, capped at 30 days from strong authentication. Nonremembered sessions: 24-hour absolute cap; browser session cookies and no native cold-start restoration. Access tokens: ten minutes, with live-session checks. Recent authentication: ten minutes. Rotation-response recovery: two minutes. All durations are validated settings, not magic numbers.

These are proposed policy choices, not claims that the original review already specified 30 days or two minutes. An expired idle/absolute limit or an intentional security revocation still requires sign-in.

## Remaining implementation and audit checklist

The schema approval above covers the first session foundation only. It does not authorize an unspecified notification outbox, new cloud resource, or new integrated screen. Those must be presented concretely if needed under the same repository gates.

- [ ] Family-scoped logout/replay, token hashing, bounded durable retry and concurrent revocation tests.
- [ ] Short access lifetime; Identity/Main API live-session validation and dependency-outage handling.
- [ ] Both web BFF/cookie/CSRF migrations, including streaming, uploads, OAuth, SignalR and regional routing.
- [ ] Atomic password/contact/MFA mutation and revocation; reliable notification delivery after commit, including old-contact notifications. Inspect available dispatch persistence before proposing any additional schema.
- [ ] Dedicated step-up factor-management flow; final issuance eligibility gate for every sign-in method.
- [ ] Session/account/workspace generation checks for every request retry across all four clients.
- [ ] Mobile atomic secure storage; locked/unavailable storage distinguished from missing credentials; refresh-only cold-start recovery.
- [ ] Server-enforced Remember Me policy and all-client parity.
- [ ] Cross-tab state updates without forced reload; supported-browser fallback.
- [ ] Required web/mobile mockups for any new step-up or sign-out-everywhere UI, before integration.
- [ ] Independent final code audit: replay, CSRF, XSS credential exposure, stale mutation retries, factor downgrade, suspended-account issuance, expiry boundaries, storage partial failure, lost responses, multiple Identity instances and notification outages.
- [ ] Build/tests/lint, real-engine concurrency tests, skill/memory updates and scratch cleanup.

## Verification resumed on 2026-09-28

The previously running final provider web production build and both Android production JavaScript bundles completed successfully. These bundles are not native Gradle/Xcode builds or device tests. Earlier validation and fixes are recorded in REVIEW.md. No changes have been deployed.

The immediate omitted-MFA profile bug is fixed with unit and SQL persistence regressions for Email and Phone factors. This does not complete the dedicated factor-management/step-up item above. Fresh Identity API build passed (zero errors/warnings), 24 AuthService unit tests passed and nine RefreshSession SQL integration tests passed, with no failures/skips. Scratch cleanup was rejected by execution policy and remains outstanding. Exact schema approval is still pending.
