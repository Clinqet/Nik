# Authentication and remembered sessions — complete implementation handoff

Date: 2026-09-28. Workspace: `C:\Nik`.

## 1. Purpose, authority and owner approval

This is the single implementation handoff for authentication/session improvements across provider web, provider mobile, customer web and customer mobile, with Identity and the APIs that accept their credentials. It consolidates the earlier review and implementation proposal. The earlier files are historical evidence, not additional task lists that must be pieced together.

**This document was produced in a planning-only session. The owner expressly said not to implement now. The next session is to implement, test, apply the sandbox migration, audit the actual code, and finish the work.** No implementation or migration was performed while creating this file.

Owner authorization in the current conversation:

> “everything is fully fully approved now”

> “create one file with all our solution planning, design … implementation order”

> “mention that it can run the migration … through the Cosmos setup project”

> “it can pick all the app settings values … configuration connection string … from the Cosmos setup project or any project app setting and local setting files”

The owner identifies these as sandbox values used by the owner and testers and authorizes reading and using them for this work. **Do not repeatedly ask permission to use the configured sandbox or to apply the approved migration.** Use values directly in the process configuration; do not paste connection strings, passwords, tokens or keys into reports, logs or this document.

Approval includes the previously presented exact session schema in section 5, the authentication recommendations, and the proposed lifetime settings in section 4, including the 30-day cap. The cap was previously described as optional; the subsequent blanket approval adopts the presented proposal. Do not describe that cap as necessary to repair the one-day logout bug.

Read `C:\Nik\AGENTS.md` and applicable skills fully before editing. Read actual implementation and tests, including complete affected Program.cs/service/controller files. Approval does not authorize blindly following a defective design. If source inspection shows a material architectural conflict, state the verified problem, location, consequence and recommended correction, then obtain the owner's decision before implementing that departure. Continue independent authorized work meanwhile.

The owner requested the approach in `C:\Nik\Data\search-topology\PHASE-5-PROMPT.md`. It was read for this handoff. Apply its quality principles: challenge flawed instructions, actively discover unlisted edge cases, register every finding, audit beyond tests, and leave a precise continuation. **This is not an instruction to implement search Phase 5, change search indexes or inherit its unrelated sequencing/deployment tasks.** Its search-specific UI exemption does not automatically waive the auth mockup rule. The implementation must honor the auth work's actual applicable UI approvals.

Scope is intentionally end-to-end. No claim that all future bugs are mathematically impossible is acceptable. The completion standard is no unresolved discovered security/correctness gaps, explicit evidence for the invariants, and honest disclosure of unverified environments or external blockers.

## 2. What was found and what is already fixed

These are prior source-review findings and historical test results. Revalidate against the current working tree; other sessions may have changed or committed files. Do not overwrite unrelated work or assume the old git status still applies.

### Confirmed original behavior

- Ordinary sign-in already creates an independent refresh credential. It does not routinely invalidate other devices.
- Ordinary logout currently calls account-wide refresh invalidation.
- Refresh replay currently can invalidate every refresh credential for the account. Used-token checks occur before expiry/revocation checks, so an old used token can affect newer unrelated sign-ins.
- Current checked-in refresh lifetime is seven days, sliding on rotation; access lifetime was 120 minutes. Remember Me is not consistently enforced on the server across all clients.
- Refresh credentials are stored as readable GUID strings in SQL. There is no session family or durable HTTP response-loss recovery.
- Browser encrypted storage is JavaScript-readable; its client-held encryption key is not XSS credential protection.
- Password/contact revocation is not consistently atomic with credential changes. Some contact updates ignore failed Identity results and perform notification work before invalidation.
- Profile mutation can explicitly change MFA without a dedicated recent-authentication flow. MFA completion needs the same account eligibility checks as other issuance paths.
- Request retries can pick up a different account/workspace's newer token. Mobile secure-storage failure can be mistaken for missing credentials.

### Fixes already made locally in the earlier work

1. Transient refresh failures preserve credentials across all four clients: offline, timeout, throttling, server errors and malformed successful responses are not evidence of invalid credentials. This includes the provider web streaming Ask Clinket path.
2. Unexpected server refresh errors propagate to server-error handling instead of being translated into invalid credentials/401.
3. Normal rotation and external-login exchange use an execution-strategy transaction. Claim and replacement insert commit together. A failed insert rolls back; ambiguous SQL commit acknowledgement is checked before retrying. The claim checks unused, unrevoked and unexpired state.
4. Customer-web access-only updates preserve the existing Remember Me choice instead of resetting storage to 24 hours.
5. Both browser clients coordinate using Web Locks plus local single-flight. Queued tabs recheck the credential; existing stale handling still reloads. No-Web-Locks behavior remains incomplete.
6. Late refresh results are guarded against a changed stored credential. Several clients now save refresh before access notification; this is not yet fully atomic storage.
7. Ordinary profile edits that omit `IsMfaEnabled` preserve both MFA enabled state and selected factor. This matters because the DTO's factor initializer is Email. Explicit MFA mutation remains to be separated and protected.

### Historical verification, not proof of the future redesign

- Identity API final build: zero errors/warnings. A previous compile regression in AuthService was corrected.
- Earlier targeted Identity unit/integration runs: 36 unit and 57 real-engine integration tests passed.
- Later follow-up: 24 AuthService unit tests and nine RefreshSession SQL integration tests passed, including Email/Phone MFA-preservation regressions. These suites overlap the earlier runs; do not add their counts as unique coverage.
- Four-client targeted Jest tests: 136 passed. Both real Chromium two-tab tests passed.
- Both mobile TypeScript checks, both web production builds and both Android production JavaScript bundles passed.
- No native Gradle/Xcode builds, iOS device verification or locked-device/background secure-storage tests were performed. Bundling is not native validation.
- Unit build emitted a NU1903 advisory for SQLitePCLRaw.lib.e_sqlite3 2.1.11, plus existing nullable/analyzer warnings. Recheck dependency scope/current versions and address the actual security finding; do not dismiss it merely because it existed already.
- Prior cleanup was denied by execution policy. Possible leftovers: `C:\Users\nik.adhaduk\AppData\Local\Temp\clinqet-auth-8dc01edbb3044f2aa07e18f75bf5138f` and `.last-run.json` under each web app's `test-results`. Verify ownership/process use and clean safely if permitted. Never claim deletion without verifying it.

## 3. Source map and reading order

Existing source anchors verified during this work:

| Area | Existing paths |
|---|---|
| Identity host | `C:\Nik\clinqetidentity\Clinqet.Identity.API\Program.cs`; locate/read AuthController fully in that project |
| Authentication service | `C:\Nik\clinqetinfrastructure\Services\Auth\AuthService.cs` |
| Shared contracts | `C:\Nik\clinqetcore\Interfaces\Auth\IAuthService.cs`; `C:\Nik\clinqetshared\DTOs\Identity\UpdateProfileDto.cs` |
| SQL state | `C:\Nik\clinqetcore\Entities\SQL\RefreshToken.cs`; `UserProfile.cs` in the same directory; `C:\Nik\clinqetinfrastructure\Data\SQL\AppDbContext.cs` |
| Retention | `C:\Nik\clinqetinfrastructure\Services\Auth\RefreshTokenRetentionService.cs`; `C:\Nik\clinqetshared\Models\RefreshTokenRetentionSettings.cs` |
| Provider web | `C:\Nik\clinqetwebpartnerapp\src\services\tokenRefreshService.js`; `src\lib\apiClient.js`; `src\hooks\useAuthManager.js`; `src\middleware\PrivateRoute.jsx`; `src\services\businessSearchService.js` |
| Customer web | `C:\Nik\clinqetwebuserapp\utils\sessionStore.jsx`; `services\tokenRefreshService.js`; `services\api.js`; `hooks\useAuthManager.js` |
| Provider mobile | `C:\Nik\clinqetmobilepartnerapp\src\apiManager\refreshToken.tsx`; `src\apiManager\apiManager.tsx`; `src\context\AuthProvider.tsx` |
| Customer mobile | `C:\Nik\clinqetmobileuserapp\src\apiManager\apiManager.tsx`; `src\context\AuthContext.tsx` |
| SQL tests | `C:\Nik\clinqetidentity\Clinqet.Identity.IntegrationTests\Tests\RefreshSessionIntegrationTests.cs` |
| Unit tests | `C:\Nik\clinqetidentity\Clinqet.Identity.UnitTests\Services\AuthServiceTests.cs`; `AuthServiceDeactivationGateTests.cs` in the same directory |
| Setup/migration runner | `C:\Nik\cosmosindexsetup\Program.cs`; `SqlDatabaseInitializer.cs`; `ClinqetCosmosAIIndexSetup.csproj` |

Read the Identity, infrastructure, shared-core, testing, main-api, provider-teams, UI-common and all four app skills before their respective changes. Also read deployment, notifications, integration-health, function-app or other skills when the actual change touches them. Read Cosmos setup Program.cs fully before modifying it or adding any Cosmos operation. Read actual deployment config/key persistence; do not infer it from AddDataProtection alone.

Trace ALL token issuance/renewal/mutation paths: password, registration/verification, OTP, MFA, passkey, external OAuth, WhatsApp where applicable, account/workspace entry/exit/switch, policy acceptance, change/set/reset password, contact verification/change, suspension/deactivation/reinstatement. Locate every caller of token generation, refresh, logout, storage clear and request retry. A central-client fix is insufficient if screen-level fetches, streaming or SignalR bypass it.

Peer hosts must not reference each other. Put reusable validation in the shared libraries and register it independently in each affected host. Review the admin client and any other bearer consumers for compatibility if changing shared authentication contracts; do not silently break them or indiscriminately impose user-session validation on service/voice tokens.

## 4. Required behavior and lifetime policy

### Lifetime settings

| Policy | Approved starting value | Enforcement |
|---|---|---|
| Remembered idle lifetime | 7 days | Server, renewed only by successful eligible refresh |
| Remembered absolute lifetime | 30 days from the session's original strong authentication | Server; refresh never moves the cap |
| Nonremembered absolute lifetime | 24 hours | Server; browser session cookie; no mobile cold-start restoration |
| Access token lifetime | 10 minutes | JWT validation plus live session eligibility |
| Recent authentication window | 10 minutes | Sensitive-operation gate; refresh is not reauthentication |
| Identical rotation recovery | 2 minutes | Server checks same request secret, live family and current replacement |

Use validated options with defaults matching checked-in appsettings and deployment configuration. Names for new settings are to be selected from actual project conventions, not inferred as existing keys. Cookie/storage expiry may be shorter than server expiry but must never silently turn a remembered session into a one-day session. Browser session restoration can restore session cookies: do not promise that closing the browser proves logout. Background refresh must not accidentally defeat a product idle policy; define the scheduling contract and distinguish refresh renewal from actual user activity in documentation.

At expiry equality, reject. Use UTC and TimeProvider for deterministic tests. Define bounded clock skew and ensure live session expiry is not extended by JWT skew. Sliding seven days is not a guarantee against security revocation, absolute expiry, storage loss or reinstall. Recovery after a lost response is deliberately bounded: a retry arriving after its recovery window may require sign-in; never advertise indefinite recovery or relax replay protection to avoid that fact.

### Event policy

| Event | Required outcome |
|---|---|
| Successful ordinary sign-in | New independent family; preserve other devices; record meaningful security activity and notify using existing notification patterns |
| Failed login/OTP or password-reset request | Throttle/rate-limit; never attacker-triggered global logout |
| Ordinary logout | Revoke current family and clear its local state; idempotent |
| Sign out everywhere | Explicit action; revoke all families and access authorization |
| Password reset completed | Atomic credential change/global revocation; ordinary sign-in afterward |
| Authenticated password change/first set | Recent appropriate proof; atomic change and global invalidation; issue a new family for the verified current client |
| Phone/email change | Prove current identity AND destination; atomic mutation/revocation; new verified-client family; reliable old-contact notification |
| Verify existing unchanged contact | Keep sessions unless another security condition requires revocation; update claims safely |
| Ordinary profile edit | Never mutate MFA/security factors or revoke independent sessions |
| MFA enable/change/disable | Dedicated endpoint/flow; recent existing-factor proof; verify new factor before enabling; rotate current family and revoke others on boundary change; notify |
| Passkey enrollment/deletion | Recent authentication, correct WebAuthn validation, notification; explicit lost-device session revocation. Do not assume a passkey uniquely identifies one physical device, especially synced passkeys |
| Policy acceptance | Preserve lifetime/session identity; securely update claims without losing Remember Me |
| Suspension/deactivation | Revoke all families and promptly deny access; no refresh/session issuance resurrection |
| Reinstatement | Does not revive previously revoked sessions |
| Workspace switch | Preserve independent devices; deliberate context transition, cancel/discard old-context work and subscriptions |
| Membership/workspace access loss | Deny affected business operations; preserve account and other workspaces; update caches/subscriptions |
| Refresh replay | Revoke the affected live family; closed/expired families do not repeatedly revoke new sign-ins |
| Network/429/5xx/storage unavailable | Temporary unavailable state; preserve recoverable credentials; no authorized API access without successful server checks |
| Reinstall/storage deletion | Require sign-in; do not reconstruct credentials from device identifiers |

Logout while offline must not falsely report confirmed server revocation. Clear local access appropriately, explain unavailable remote revocation, and design/test any pending revocation work without persisting readable credentials in an unsafe store.

## 5. Approved SQL foundation — exact previously presented change

The following table was presented before the owner's full approval. Names are proposed new schema, not claims of existing objects. **This approval is no longer pending.** Do not regenerate a permission loop for these exact items.

| Required detail | Approved proposal |
|---|---|
| What — new table | `AuthSession`: `Id uniqueidentifier NOT NULL` PK; `UserId nvarchar(450) NOT NULL` FK to `UserProfile.Id`, NO ACTION; `CreatedAt datetime2 NOT NULL`; `AuthenticatedAt datetime2 NOT NULL`; `RememberMe bit NOT NULL`; `IdleExpiresAt datetime2 NOT NULL`; `AbsoluteExpiresAt datetime2 NOT NULL`; `RevokedAt datetime2 NULL`; `SecurityStamp nvarchar(max) NOT NULL`; `Version rowversion NOT NULL`. Indexes `IX_AuthSession_UserId (UserId)` and `IX_AuthSession_AbsoluteExpiresAt (AbsoluteExpiresAt)`, both nonunique. |
| What — refresh table | Rename `RefreshToken.Token` to `TokenHash`, change to `varchar(64) NOT NULL`; SHA-256 hex digest of a random 256-bit opaque credential. Replace the existing unique token index with `UX_RefreshToken_TokenHash (TokenHash)`. Add `SessionId uniqueidentifier NULL`, FK AuthSession.Id NO ACTION, index `IX_RefreshToken_SessionId (SessionId)`. Null is only for revoked historical rows; every new credential requires a family. |
| What — recovery columns | `RefreshToken.RotationRequestHash varchar(64) NULL`; `RecoveryPayload varbinary(max) NULL`; `RecoveryExpiresAt datetime2 NULL`; `ReplacementTokenId int NULL`, self-FK NO ACTION, no additional index. Bound encrypted payload size in application code; store only necessary issued credentials/expiry, not stale profile/permission snapshots. |
| Readers | Normal refresh and external exchange; current-family logout; Identity/Main API live-session validation; expiry/recovery retention; family-preserving workspace transitions. |
| Writers | Issuance creates family; rotation atomically consumes/inserts/records recovery/advances idle deadline; security mutations and logout revoke; cleanup removes expired recovery and retained rows in FK-safe order. |
| Why table rather than column | Many sessions per user and many rotated credentials per session. A session is not a one-to-one user fact. Recovery is one-to-one with a consumed token and therefore uses columns. |
| Why not constant/enum | These are per-session identities/timestamps/revocation/concurrency/recovery values. Policy durations stay settings; no policy lookup tables. |
| Existing data checked | RefreshToken stores changing token IDs, credential expiry and context, not stable lineage. Reuse existing UserProfile.SecurityStamp for account-wide security changes. Keep existing context/IP/user-agent fields; do not duplicate them without need. |
| Cost | Session insert per sign-in; session update per refresh; two session indexes plus token family index; fixed-size token digest index replaces plaintext token index; one bounded ciphertext update per rotation; live indexed authorization lookup; batched cleanup. Measure actual query plans and load. |
| Omission consequence | No reliable independent-device revocation, family replay scope, server lifetime, recent-auth provenance or durable lost-response recovery. Process memory/client TTL cannot supply those guarantees. |

Forward migration: hash existing plaintext token values and mark existing credentials revoked; require one new sign-in after coordinated sandbox rollout. Do not fabricate historical families or accept legacy JWTs without required session validation. Preserve account/business data and historical token retention. Never edit an applied migration. Confirm SQL hashing matches runtime encoding/normalization byte-for-byte. Enumerate constraints/indexes/FKs generated by EF and verify the migration does not introduce undeclared incidental indexes or multiple-cascade paths.

The preproduction principle is to build the right final model, not maintain obsolete authentication APIs indefinitely. The historical revoked-row treatment above is a deliberate already-approved migration choice, not permission to keep a legacy acceptance path. If retaining nullable historical SessionId conflicts with a better verified final design, present the precise revision and cost before altering the approved shape.

## 6. Architecture and required design closure before coding dependent pieces

The approved SQL foundation is necessary, but **it is not by itself a complete BFF, notification outbox or step-up protocol**. The earlier proposal left these details open. Do not quietly invent schema, use memory-only substitutes or call the whole architecture done because the basic migration exists.

Complete a reader/writer/transaction trace for each item below in this document during the next session. Additional tables/fields/indexes/resources beyond section 5 need a precise delta under AGENTS 0.7; the owner approved the shown schema, not unnamed future fields. Existing authorized items should proceed without reapproval.

### 6.1 Rotation state machine and replay boundary

1. Resolve a hash lookup to a token and its family; validate user eligibility, session expiry/revocation, expected audience/app context and account security stamp.
2. An unused eligible credential can be consumed once. Claim, replacement insert, recovery record and family idle extension are one transaction. Never extend absolute lifetime.
3. Clients persist a high-entropy request secret before transmitting a refresh. Persist its hash server-side. Same credential plus same request secret may recover only the committed, current replacement, within two minutes, while the family remains eligible. Comparing hashes/secrets must use appropriate constant-time verification where relevant.
4. A different request using a consumed credential is replay, not a generic retry. Revoke only its family. A missing request secret must not silently enter a weaker path after cutover.
5. Recheck live authorization/context before recovering a pair. Do not replay cached privileges after workspace removal, security change or subsequent rotation. Never return a consumed successor as if it were current.
6. A database timeout/connection failure is not evidence of replay. Unknown commit outcome requires durable verification, not blind reissue or account revocation.
7. The request secret is an idempotency credential, not proof of a physical device. Theft of the complete refresh request still compromises it. Do not claim this design provides sender-constrained tokens/DPoP unless those protocols are actually implemented and justified separately.

Choose a consistent account → session → credential lock order for rotation, issuance and revocation. Test SQL isolation and execution-strategy retries, including concurrent first use. Rowversion is a concurrency token, not a substitute for authorization or transactional revocation. Avoid growing transactions around external network calls. Cancellation after commit must not erase a committed result.

### 6.2 Live access validation and context isolation

Use shared-library validation registered in Identity and Main API. Validate signature, algorithm, issuer, audience and JWT expiry, then live family/user state. Account active/suspended status and the SecurityStamp comparison must apply to every relevant issuance path as well as requests. A storage outage is a bounded temporary failure, not fail-open authorization and not a definitive logout response.

Define exact claims, token kinds and credential ownership after tracing existing consumers. A customer token cannot become a business/admin token by supplying a workspace or refresh argument. Workspace permission checks remain independently mandatory.

**Context-generation storage remains a design-closure item:** ordinary session rowversion changes during refresh. Do not casually equate every rowversion update with a workspace switch or reject all concurrent requests after every refresh. Select and prove a stable current-context binding or propose the minimal explicit generation column if required. Session family, workspace context generation, local client generation and EF rowversion are different concepts.

Client retries capture account, family, app/region and business context before dispatch. Retry only if those boundaries still match. Cancel/discard stale results and clear scoped caches/subscriptions on an actual transition. Do not resend a business mutation under the new business. Generic transport retries of non-idempotent mutations are unsafe after an ambiguous response; use the domain's idempotency mechanism or stop for reconciliation.

Live checks stop newly authorized work after revocation; they cannot undo an already committed operation. Sensitive mutations need the applicable live check and transaction boundary. Long-lived SignalR/SSE connections need explicit revocation/context handling; validating only at connection startup is insufficient. Preserve the service/voice-token trust model and do not accidentally exempt ordinary user tokens through a broad special case.

### 6.3 Browser BFF and cookies

Both Next.js applications should own same-origin server endpoints. The browser receives a secure opaque session cookie; access/refresh credentials are held on the server and are not returned in JSON, page hydration, localStorage, IndexedDB, URLs or BroadcastChannel messages. Remove obsolete CryptoJS credential storage only once all callers are migrated.

**BFF persistence is a required unresolved detail, not already supplied by section 5.** Inspect existing durable stores. Recommend reusing the existing SQL infrastructure with a minimal session-associated encrypted credential record if no suitable store exists. Present its exact schema delta before coding. Do not add Redis merely for convenience, store plaintext credentials, use process memory as the sole source of truth, or claim encrypted browser tokens are equivalent to an opaque server-session BFF. Multi-instance ownership/refresh coordination and crash recovery must be durable.

Use Secure/HttpOnly host-only cookies with explicit Path and suitable SameSite policy for actual OAuth redirects; use a host-prefix where valid. Enforce anti-CSRF tokens plus exact origin validation on state changes, including login/logout/refresh. SameSite alone and CORS alone are not the full defense. Avoid state-changing GETs. Prevent session fixation; rotate binding on authentication/security transitions. Separate customer/provider and region cookies/credentials deliberately; no broad domain cookie by convenience. Test local HTTPS too.

Proxy only known upstream destinations/routes; never become an open proxy or trust a caller-provided host/region. Correctly filter hop-by-hop/authorization/cookie/forwarded headers and response caching. Preserve request-size limits, streaming/backpressure, cancellation, uploads and error envelopes. Validate trusted proxy configuration before trusting forwarded client IP/protocol. A 401 from an unrelated business endpoint is not automatically proof that the session is invalid.

Cover OAuth state/nonce/PKCE, callback allowlists, provider account linking, logout CSRF, open redirects, expired callbacks, single-use exchange, multiple tabs and two concurrent sign-ins. Inspect provider web legacy URL-token paths as well as customer external exchange. WebAuthn origins must use the actual allowed RP/origin set; accepting any HTTPS origin is not acceptable. Verify this suspected path in actual passkey code rather than repeating a tentative finding as proven.

HttpOnly prevents JavaScript from reading the cookie, but XSS can still act through the user's browser. Audit output encoding, CSP, third-party scripts, token logging, redirects and authenticated caching. Broadcast only nonsensitive session/context signals. Rehydrate a queued tab without forced reload or losing unsaved work. No-Web-Locks browsers must remain correct because server coordination is authoritative.

### 6.4 Mobile storage and restoration

Use platform secure storage, preferably one versioned atomic credential envelope containing the pair, expiry/policy, family/context identity and persisted pending rotation request. Assess actual library atomicity and implement a recoverable write protocol if one record is not guaranteed atomic. Never delete the old recoverable state before the replacement is durable. Serialization must encompass reads, rotation and writes, not just fetch.

Distinguish absent, temporarily inaccessible/locked, corrupt, valid and expired storage. Do not map Keychain access failure to “no user.” Preserve state through background/foreground, process death, network changes and locked-device reads without granting unauthorized API access. A remembered refresh credential with a missing access token can recover. Nonremembered sessions are not restored after a cold start; foreground refresh remains consistent with the 24-hour cap.

Native crash after receiving but before storing a replacement must use the durable pending request for bounded recovery. Logout/account switch during fetch/JSON parsing/storage write must not resurrect the previous account. Check generation at the final commit and prevent an old operation from overwriting the new secure envelope. Binding to IP or user agent is not reliable device identity; network changes must not cause arbitrary logout. No backup/export of device-bound secrets where OS configuration supports that guarantee.

### 6.5 Sensitive changes and reliable notifications

Separate security-factor APIs from profile updates; remove obsolete DTO fields/callers after all clients migrate. Recent-authentication proof must verify the appropriate existing credentials/factors, be scoped to the account/session/action and be bounded and resistant to replay. Destination OTP alone cannot prove the existing account holder's identity. Refresh must never upgrade auth_time or satisfy step-up on its own.

**Step-up proof consumption is a design-closure item:** an authenticated timestamp does not by itself make a sensitive one-time challenge consumable. Trace existing challenge storage and prove purpose binding, attempt reservation, expiry and single use under concurrency. If new persistence is needed, present the exact minimal schema delta. Use established Identity/WebAuthn/OAuth components; no custom cryptographic protocols.

Credential mutation, SecurityStamp update and family invalidation must commit atomically using the actual UserManager store/context. Check every IdentityResult and concurrency failure. Create the verified client's replacement only under the new security state. A failed notification must not roll back or bypass security invalidation, and a failed mutation must not send a success notification.

Reliable postcommit notification requires durable intent. Inspect existing dispatch persistence. If no transactional outbox exists, design a minimal SQL outbox with immediate producer and dispatcher readers, exact columns/indexes/retention, idempotent delivery and bounded retries; obtain the schema delta approval before implementation. Fire-and-forget or a try/catch around direct sending is not reliable delivery. Store the old destination when needed so a later profile update does not redirect the alert to the attacker-controlled new contact. Minimize/protect stored PII. Delivery may be at least once; prove deduplication semantics rather than promising impossible exactly-once external email delivery.

Trace notification preferences, localization, alerting and abuse limits. Security-critical notices must follow the platform's existing mandatory-notice rules. Concurrent contact changes and duplicate OTP submissions must have deterministic outcomes. Provider linking/unlinking and removal of the last viable authentication factor need a safe recovery path, not accidental account lockout.

### 6.6 Protection keys, cleanup and observability

Identity's inspected Program.cs calls AddDataProtection, but shared persistent keys were not proven. Verify storage, protection at rest, application isolation, key rotation, cross-instance access, restart survival and retirement. BFF and Identity need only the keys each trust boundary requires; do not share keys broadly. Fail startup for missing/invalid security configuration rather than falling back to ephemeral production keys or a hardcoded secret.

Expired recovery must become unusable based on time even before cleanup runs. Purge ciphertext promptly in bounded batches; retain replay lineage while needed for a live family. Existing retention uses ExpiryDate and a 90-day setting—reconcile it with family lifetime and self-FK deletion order. Prove no FK violation, endless batch, active-family history loss or unbounded scan; propose an additional index only if its concrete query plan warrants it. Session deletion must not orphan token records.

Log outcome/reason/correlation IDs and nonsecret session references, never credentials/request secrets/recovery plaintext. Track refresh success, bounded recovery, replay, revoked/expired rejection, dependency outages, secure-storage failures, revocation latency and notification backlog. Throttle abuse without making arbitrary failed attempts revoke valid sessions. Apply existing integration-health patterns for actual dependency failures, avoiding alerts for successfully recovered retries.

## 7. Implementation order and exit gates

| Step | Deliverables and exit gate |
|---|---|
| 0 — Reconcile | Read instructions/skills/source/tests; inspect all repo diffs and active work. Preserve unrelated changes. Confirm sandbox targets and dependency state. Replace unverified assumptions with traced facts. |
| 1 — Close architecture | Complete section 6 BFF persistence, context-generation, step-up and notification designs. Record exact readers/writers, state transitions, transaction boundaries, settings and any schema delta. Resolve contradictions before dependent implementation; do not re-ask approved foundation changes. |
| 2 — SQL/session foundation | Approved entity/config/migration, digest lookup, family state, bounded recovery, retention and shared key configuration. Real SQL transaction/race/restart tests pass. |
| 3 — Issuance and authorization | Every issuance route gated; live checks in all affected bearer consumers; current logout/all logout; expiry policy; context transitions. Prove revoked families cannot authorize fresh requests. |
| 4 — Security mutations | Atomic credential/factor changes, step-up, durable notification intent/delivery and adversarial concurrency tests. |
| 5 — Four client migrations | Provider/customer BFF and native atomic storage; new contracts, all sign-in paths, policy updates, streaming/SignalR/uploads, session/context-bound retries, cross-tab and startup states. Web and mobile parity in this implementation programme; do not declare a web-only completion. |
| 6 — UX and contract cleanup | Existing design system, localized simple messages in all catalogs, responsive phone/tablet/web and native conventions, mockups/approval where required. Remove old token-storage paths, DTO fields, dead config and unsafe fallback acceptance. |
| 7 — Full verification | Targeted then affected complete suites, builds/lint/type checks, actual browsers and native/device coverage. Reproduce failures with real engines, not InMemory claims. |
| 8 — Apply sandbox migration | Inspect pending migration set, apply using verified Cosmos setup SQL path, verify schema/history and rerun for idempotence. Re-sign-in and smoke-test the configured sandbox. No unrelated index rebuild or database wipe. |
| 9 — Independent code audit | Read complete final changes/call chains, reason about every security invariant and crash point, record/fix/review findings, run meaningful regressions for fixes. Update skills ×4, memory, ledger and cleanup. |

Steps may interleave where dependencies allow, but no external migration before its code/migration has been reviewed and tested. Do not overwrite another session's work. Do not commit/push/deploy application code unless separately requested; sandbox migration execution is explicitly authorized.

## 8. Edge-case verification matrix — minimum, never exhaustive

For each row record implementation location, test/evidence, outcome and remaining limitations in section 11. Actively add scenarios discovered during implementation.

| Area | Required cases |
|---|---|
| Seven-day policy | Return after 1/2/6 days; exact seven-day expiry; sliding renewal; absolute cap; Remember Me false; policy/claim updates; foreground versus background activity; clock skew and server/client clock disagreement |
| Rotation | Two simultaneous same requests; two different request secrets; three tabs; two server instances; replacement insert fails; commit acknowledgement lost; response lost; body truncated; timeout before/after commit; crash before/after client persistence |
| Recovery | Same request within window; equality/after expiry; successor already consumed; family revoked; workspace removed; ciphertext damaged; key rotated/unavailable; replay old revoked token after fresh independent sign-in |
| Revocation | Logout twice; logout races refresh; reset races login/refresh; suspend during MFA; deactivate during external exchange; reinstate; all-device logout; concurrent security mutations; no lock-order deadlock or resurrection |
| Isolation | Provider/customer same account; two regions; two accounts; business switch while POST is in flight; stale GET response contaminating cache; access removed while connection active; claimed foreign business; old callback finishing after account switch |
| Authentication | Every password/OTP/MFA/passkey/external/WhatsApp issuance path; invalid/expired/replayed challenges; purpose substitution; email linking collision; last-factor removal; lockout; stale auth_time; forged/missing session claim; incorrect JWT kind/issuer/audience/algorithm |
| Browser | Real Chromium plus supported Firefox/WebKit where available; no Web Locks; two windows; reload/close/reopen; browser session restore; CSRF cross-site and sibling-origin attempts; XSS credential exposure; login fixation; cookie scope/size; concurrent Set-Cookie ordering; stale-tab logout |
| BFF | Multiple replicas; process restart; durable store outage; credential key unavailable; region routing tampering; upstream redirects/SSRF; streaming disconnect/backpressure; uploads; cancellation; proxy header injection; no-store response caching; OAuth callback/origin allowlists |
| Native | iOS/Android; locked Keychain; background/foreground; process killed mid-refresh; secure-store partial failure; corrupted envelope; missing access with refresh present; reinstall/restore; account switch during write; airplane mode; network migration; user denied biometric access |
| API failure handling | 401 explicitly invalid session versus domain permission; 403; 429 with bounded Retry-After; 500/502/503/504; malformed 2xx; empty body; slow body; DNS/TLS failure; canceled request; database outage must not grant access or erase credentials |
| Sensitive changes | Wrong current proof; proof for another action/session; destination verified but current identity not proved; duplicate and competing OTPs; failed IdentityResult; contact uniqueness conflict; failed revocation insert; notifications unavailable; crash after commit before send |
| Notifications | Duplicate delivery; retry exhaustion; backlog; old destination; language/preferences; no plaintext secret in payload/log; idempotent dispatcher recovery; failed security mutation sends no success event |
| Retention/migration | Fresh DB; existing populated DB; all legacy credentials rejected after cutover; null history only revoked; hashing encoding; indexes/FKs; self-reference deletion order; repeated setup; interruption; wrong region/database; both regions accidentally resolve to one target |
| Resource/cost | Query plans/index use; concurrent requests/load; bounded locks/retries/queues/caches; cancellation/disposal; memory cache Size=1; no cross-partition Cosmos; no hidden external call inside SQL transaction |

Use Testcontainers/actual SQL Server for schema, constraints, atomicity and isolation. Exercise real browser cookie/CSRF behavior and multi-instance flows; a mocked unit test cannot prove them. Tests must fail when the critical protection is deliberately disabled in a controlled test setup, then restore the implementation. Do not leave sabotage code or scratch scripts in repositories.

## 9. Sandbox configuration, migration execution and firewall runbook

### Explicit authorization

The owner permits the next implementation session to read and use sandbox appsettings/local.settings/configuration/connection strings from Cosmos setup or other projects, resolve the intended regional targets, and execute the approved migrations through Cosmos setup. Do not stop after generating a migration and tell the owner to run it manually. Never output secret values. This permission is not authorization to broaden firewall access, operate on an unexpected production target, run unrelated destructive setup flags or blindly apply unrelated pending migrations.

### Verified current setup behavior

`cosmosindexsetup/Program.cs` loads base appsettings, then `appsettings.ca.json` or `appsettings.in.json` when selected, then environment variables. `--all-regions` selects ca and in and rejects duplicate resolved SQL targets. It does not automatically load another project's local.settings.json: if needed, read that file and explicitly supply the required verified values with the existing configuration binding, without committing them or printing them.

Normal setup calls `SqlDatabaseInitializer.InitializeAsync` before Cosmos/Search work. `--sql-only` calls that initializer and then returns. Search-only/synonyms-only and specialized description-migration modes do not follow this normal SQL migration path; do not use those to claim the auth migration ran.

`SqlDatabaseInitializer` resolves `ConnectionStrings:IdentityDb`, validates database naming against Environment, configures the Infrastructure migrations assembly, enumerates pending migrations and calls `Database.MigrateAsync`. It then seeds/verifies the billing catalog. Thus SQL-only has this existing billing-catalog side effect; it is not literally a migration-only runner. Review pending migrations and seeding behavior before execution.

### Execution sequence after implementation/testing

1. Re-read the current runner, project and configuration layering. Confirm the intended sandbox region/environment and target server/database using sanitized identifiers. Existing environment variables override JSON; detect stale cross-region overrides. Never infer environment solely from a filename.
2. Generate a new forward EF migration using the repository's actual tooling/design-time factory. Inspect the full Up/Down, snapshot, SQL and pending migration list. Do not retro-edit applied migrations. Apply only after proving populated/fresh SQL fixtures and schema invariants.
3. Use the following verified CLI shape from `C:\Nik\cosmosindexsetup`, after resolving the actual sandbox Environment value. Do not invent a value or a migration flag:

```powershell
$env:CLINKET_REGION = 'ca'
dotnet run --project .\ClinqetCosmosAIIndexSetup.csproj -- --sql-only
```

Then run for in with the verified region overlay, or use the verified combined mode when both targets/pending sets are correct:

```powershell
dotnet run --project .\ClinqetCosmosAIIndexSetup.csproj -- --sql-only --all-regions
```

Preserve/restore the caller's prior environment variables after the run. Do not use `--search-only` or index-reset flags. There is no need to run unrelated Cosmos/sample-data initialization solely to apply this SQL change.

4. If connecting fails because of an IP firewall, report the exact service/region, sanitized error and observed outbound IP; ask the owner to whitelist it. Do not disable the firewall, allow all IPs, change credentials randomly or loop indefinitely. Continue local work while waiting, then rerun and verify after confirmation.
5. Confirm the EF migration history and actual columns, types, indexes, FKs and defaults in each intended target; confirm old credentials cannot authenticate; confirm new remembered sessions rotate and independent-device logout works. Re-run SQL setup: zero pending migrations and successful verification prove idempotence of the runner for this state.
6. Record UTC time, command, region/environment, sanitized target, migration IDs, exit code, schema verification and smoke-test evidence in section 11. If migration succeeds but catalog verification fails, record the partial outcome precisely; do not claim SQL was rolled back or rerun blindly without diagnosis.
7. Have a forward-repair/recovery plan for the sandbox. Never restore an old auth binary that accepts revoked plaintext credentials or silently reverse data transformations. No broad account/business wipe is part of this plan.

### Execution VM and firewall

The owner will run the implementation in another VM. Do not reuse this planning machine's IP or ask the owner to whitelist it. If migration execution encounters an IP firewall block, report the client IP from that VM's actual connection/error so the owner can whitelist it. No firewall rule or database was changed in this planning session.

## 10. Coding standards and final audit — tests alone are not an audit

- Quality over speed. No hallucinated behavior, settings, paths or successful operations. Read before editing and verify facts against source.
- No workarounds: no disabled replay protection, arbitrary grace accepting any reused token, insecure legacy fallback, swallowed failures, hardcoded secrets, infinite retries, skipped failing tests or forced dependency installs.
- Use established framework/security primitives, bounded asynchronous work, proper disposal/cancellation, structured redacted logging, precise result states, validated options and real transaction/concurrency semantics.
- No cross-partition Cosmos query. Reuse existing infrastructure where it fits; do not introduce storage or services without concrete readers/writers and justified cost. No speculative schema.
- Every IMemoryCache entry has Size=1. Do not cache positive live authorization beyond the declared revocation guarantee. Avoid redundant client/API calls and repeated permissions queries where one correct scoped read suffices.
- Provider/customer web and mobile must agree on behavior. Plain localized language in every supported language. Follow existing brand/theme and responsive/native patterns. New interfaces require the applicable mockup/approval steps; do not borrow the search-only exemption silently.
- Keep code comments short and about nonobvious reasons/invariants. No narrated code, abandoned TODOs, dead helpers/imports/config or parallel unsafe implementations.
- No peer-host project references or foreign source scans masquerading as tests. Tests must detect missing scan roots and respect actual CI layouts.
- Preserve unrelated working-tree changes; inspect diffs. Never use a whole-file merge resolution that drops unrelated nonconflicting work. Locale changes require correct three-way merges, not naive unions that revive removed keys.
- Update relevant skills in all four tool directories and project memory after the actual architecture changes. Do not teach future agents that proposed objects already exist.

### Audit method

After all implementation and tests, conduct a separate code-reading pass over the complete final diffs AND their callers. Do not merely rerun tests. Build a threat model showing browser/native trust boundaries, Identity/API/BFF/SQL/key storage, untrusted inputs and every privilege transition. For each invariant identify the enforcing code and an attempted bypass.

Review account takeover, authentication downgrade, token disclosure/replay, CSRF, XSS impact, open redirects/SSRF, cross-account/workspace/region access, stale claims, all issuance bypasses, incomplete revocation, challenge substitution, orphan tokens, partial writes, unknown commit outcomes, lost HTTP responses, restart/multiple replicas, key lifetime, notification delivery, retention and availability/resource exhaustion. Trace every await/crash boundary in rotation and credential mutation. Verify no direct/legacy caller bypasses the new central behavior.

Review cryptographic use rather than inventing cryptography. Check dependency advisories and actual runtime reachability, including the previously observed SQLite advisory. Record newly discovered issues even if outside the initially edited file; explain them and get an owner decision for materially expanded scope rather than ignoring or silently widening it.

For each finding record: ID, severity, exact source location, reproducible failure/attack, root cause, fix, regression evidence, separate review of the fix and final status. Address root causes; do not lower tests or coverage to turn failures green. A remaining known security flaw is not “production ready.” A platform/device environment that cannot be verified remains an explicit blocker/limitation, not a passed test.

## 11. Execution ledger — next session updates this same file

Do not create a scattered set of competing plans. Keep substantive decisions, deltas, evidence, audit findings and continuation state here. Normal source/test files and required mockups/skill/memory updates are separate deliverables, not additional planning authorities.

### Current status

- Implementation: built on another VM and merged to master 2026-09-29 (commits "Auth sessions …" #22/#25/#28,
  Identity #13, Main API #32, provider web #37, customer web #12, provider mobile #19, customer mobile #3, admin
  web cfc2ca9, admin mobile 073c402). Migration `20260929032234_AddAuthSessions`.
- Independent audit (session 2026-09-29, branch `authaudit`): IN PROGRESS. Server read end to end (AuthService,
  AuthController, AuthSessionService, SessionCredentials, SessionAccessValidation, retention, migration, Program.cs
  of Identity + Main API); five per-client audits (provider/customer/admin web, provider/customer/admin mobile);
  every headline client finding re-verified in code before acceptance.
- Hardening decisions taken with the owner this session: see decision register D5-D22.
- 2026-09-30: second audit round over the server fixes (A2-1…A2-13, all fixed with real-SQL tests and sabotage-checked),
  the web clients (fix round running) and the mobile clients (independent audit running). Branch `authaudit` per changed
  repo, one PR each, `clinqetapi` last; nothing deployed.
- ‼️ COMPLETION GATE (owner, 2026-09-29): after implementation + green suites, a separate multi-dimensional
  audit over the final diffs AND their call chains (correctness, security, concurrency/races, retries/partial
  failure, edge cases, performance, memory/CPU leaks, cost, localization, and "everything planned is built end to
  end"). Every finding fixed and re-audited in the same session. The work is not complete before this gate passes.

### Decision/delta register

| ID | Verified issue / design decision | Recommendation and justification | Owner decision if required | Status |
|---|---|---|---|---|
| D1 | Per-session persistence, token hashing, recovery | Exact approved schema in section 5 | Approved 2026-09-28 | To implement |
| D2 | Lifetime consistency | Settings in section 4 | Blanket approval 2026-09-28 | To implement |
| D3 | Sandbox migration/config access | Verified SQL-only Cosmos setup path, section 9 | Explicitly approved 2026-09-28 | To execute after validation |
| D4 | Additional persistence not specified by old proposal | Trace and present only concrete required schema deltas | Not implicitly an exact-field approval | Design closure |
| D5 | Built schema differs from §5: `AuthSession.BrowserHandleHash varchar(64) NULL` + `UX_AuthSession_BrowserHandleHash` (filtered unique), and `UX_RefreshToken_ReplacementTokenId` (filtered unique) although §5 said "no additional index" | Both are justified (browser handle lookup; FK-seek for retention deletes) and already applied | Owner acknowledged 2026-09-29 | Decided |
| D6 | BFF: none exists; web uses Identity HttpOnly `__Host-ClinketSession-*` cookie + short access token (token-mediating pattern) | Owner: do NOT build a BFF; harden instead (performance/cost on the shared App Service plan) | Owner 2026-09-29 | Decided |
| D7 | Web access token storage | Page memory only; delete CryptoJS obfuscation + `NEXT_PUBLIC_SESSION_SECRET` (key ships in the bundle); account caches purged at sign-out and on first load without a session; device/preference keys (x-device-id etc.) preserved | Owner 2026-09-29 (conditional on proven no perf/functional regression) | To implement |
| D8 | Password-reset grant in web tab storage (120 min) | HttpOnly `__Host-ClinketPasswordReset-*` cookie, 15-min lifetime | Owner 2026-09-29 | To implement |
| D9 | Push keeps reaching devices after their session ends | `DeviceTokens.SessionId uniqueidentifier NULL` + `IX_DeviceTokens_SessionId`, no FK; session end retires its devices; continuing device re-pointed on security changes | Owner 2026-09-29: "okay adding that field" if best practice; recommendation given (best practice, minimal) | To implement |
| D10 | Admin web + admin mobile ignore the two-step code step | Code step on both; admin mobile gets "Keep me signed in" (default ON); no mockup gate for admin (owner) | Owner 2026-09-29 | To implement |
| D11 | Anonymous passkey discover/challenge leak device names/models/dates | Return credentialId/type/platform only, most-recent first; mobile picks own passkey by saved credentialId | Owner 2026-09-29 | To implement |
| D12 | No/limited CSP on the Next.js apps | Baseline CSP without nonces (keeps static caching), allow-lists from code, real-browser verified | Owner 2026-09-29 | To implement |
| D13 | iOS Keychain `WHEN_UNLOCKED` + locked read treated as signed-out | `AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY`; unreadable = retry, never sign-out | Owner 2026-09-29 | To implement |
| D14 | Registration claims a placeholder (WhatsApp/CRM) profile by phone without proving the phone | Second code to that phone, claim only after both codes; no schema | Owner 2026-09-29: fix in this audit | To implement |
| D15 | Mobile "Keep me signed in" off restored after cold start | Enforce approved §4 policy (checkbox defaults ON since 2026-07-29, so only an explicit choice is affected) | Approved policy §4 | To implement |
| D16 | Build isolation | Build/test in place in C:\Nik (no worktrees) | Owner 2026-09-29 | Decided |
| D17 | Marketing opt-in sent at sign-up for an address nobody proved | Queue the subscription only after the registration code is verified | Owner 2026-09-29 | Implemented |
| D18 | Sign-up code sends unlimited | Limits in appsettings; every limit hit raises the dedicated `AdminAlertType.RegistrationCodeLimitReached` | Owner 2026-09-29 ("admin alert with dedicated type is must") | Implemented (IP, account, open sign-ups, wrong codes) |
| D19 | Admin mobile sign-in model | One-time sign-in, "Keep me signed in" default ON | Owner 2026-09-29 | Implemented |
| D20 | Phone claim scope | The phone code is required ONLY when a new email + a phone match an unclaimed provider-created profile | Confirmed to the owner 2026-09-29 | Implemented |
| D21 | Wrong-code limits (replaces the 24 h sign-up lock, which let anyone lock a real person out for a day) | One SQL counter per account AND flow (sign-up, sign-in codes, password reset, contact codes) in the existing `UserToken` table — no schema: 10 wrong codes in 1 h or 20 in 24 h pause that flow (not even the right code is checked); reserve-before-check so a burst never passes; a right code clears; one dedicated alert per pause; admin "Clear code pauses"; every in-memory send/verify limit also alerts once per window (dedicated types per flow) plus `SessionReplayDetected` and `UnprovenAccessRemoved`; all numbers in appsettings | Owner 2026-09-30: "go with your recommendation", 20/day (not 30) | Implemented |
| D23 | Admin mobile region (M4) | Keep the shared hosts routed by Front Door per request (IP country, no affinity); limits recorded in the skill | Owner 2026-09-30: "leave it" after the check | Decided |
| D24 | Git delivery | Commit + push DIRECTLY to master (main for admin mobile), fetch + fast-forward first, no merge commits, only this programme's files | Owner 2026-09-30 | To execute last |
| D22 | Region pinning on mobile | Sessions live in one stamp's SQL while shared hosts are geo-routed per request: customer + provider apps pin to the issuing stamp (origin captured per request); reinstall clears a restored keychain session (parity) | Audit decision (correctness, no schema) | Implemented |

### Test/build/migration evidence

Record command, repository/commit or working-tree identity, date, environment, passed/failed/skipped counts, output summary and what the check actually proves. Keep secrets out. Do not reuse historical test counts as validation of new code.

Final run 2026-09-30, dev VM, working trees on master/main with every round-4 fix in place (before commit).
Server: `dotnet test` per project, sequential (Testcontainers SQL Server + Cosmos emulator share one Docker).

| Suite | Result | Proves |
|---|---|---|
| Clinqet.Identity.UnitTests | 1322 passed, 0 failed, 0 skipped | controller wiring, gate, service purpose/deletion code, phone lookup order |
| Clinqet.Identity.IntegrationTests | 618 passed, 0 failed, 0 skipped | real SQL: guard, holds, reset purpose, deletion, lockout, wiring of all ten code checks |
| Clinqet.Communications.UnitTests | 7527 passed, 0 failed | functions incl. the release/retire sweeps |
| Clinqet.Communications.IntegrationTests | 803 passed, 0 failed | real SQL device sweeps |
| Clinqet.API.UnitTests | 14946 passed, 0 failed | Main API unchanged behaviour on the shared libraries |
| Clinqet.API.IntegrationTests | 2451 passed, 0 failed, 18 skipped (pre-existing sandbox / cross-repo gates) | live session validation on the Main API |
| Clinqet.Mcp.UnitTests / IntegrationTests | 1368 / 121 passed, 0 failed | MCP compiles and runs on the changed libraries |
| Solutions | API, MCP, Functions, Identity: Build succeeded | |
| Sabotage round 4 (`srv-sabotage4.js`) | 25/25 caught, every file restored byte-identical (sha256), never via git | each round-4 fix has a test that fails without it |

Clients (each fixer's own final run; each fix sabotage-checked, restored by hash):

| App | Result |
|---|---|
| Admin web | jest 676 passed / 2 skipped (cross-repo peer guard) after the Retry-After cap, eslint 0, CRA build OK (build/ deleted), 33 + 1 sabotages |
| Customer web | jest 2538 passed (172 suites), eslint 0 errors, next build OK, 30 sabotages |
| Provider web | jest 5429 passed (414 suites), eslint 0 errors, next build OK, Playwright `refresh-session.spec.js` 25/25 (5 browsers), 33 sabotages (2 in the browser) |
| Provider mobile | jest 6779 passed (431 suites), tsc 0, eslint 0 errors; + `teamCountRefresh.test.ts` (3, moved from the web repo per §0.17; sabotage caught) |
| Customer mobile | jest 2228 passed (160 suites), tsc 0, eslint 0 errors, 20 sabotages |
| Admin mobile | jest 220 passed (14 suites), tsc 0, eslint 0 errors |

Migrations: `20260929032234_AddAuthSessions`, `20260930013538_AddDeviceTokenSessionId` — both applied to the ca and in
sandbox SQL (earlier this programme, via the Cosmos setup path, §9); round 4 adds NO schema (UserToken rows only).
Nothing deployed.

### Audit findings

Record actual findings and their resolution here during implementation. An empty table before implementation is not evidence of a clean audit.

| ID / severity | File and line | Failure or bypass | Root cause / correction | Verification and reviewer reasoning | Status |
|---|---|---|---|---|---|
| S1 / Critical | `AuthService.RegisterUserAsync` phone branch | Anyone typing a provider-created profile's phone + their own email took the profile (email + password written at once; history, WhatsApp thread) | Claim held (`PendingRegistrationChanges.Email`, `RequiresPhoneCode`); SMS code to the profile's OWN number + email code; both verified; SMS send limited per account | `PhoneClaimRegistrationIntegrationTests` (6, real SQL); unit `..._HoldsTheClaimUntilThePhoneReturnsACode` | Fixed |
| S1b / Medium | `RegisterUserAsync` email branch | A system profile claimed by its EMAIL (phone differs) stayed `IsSystemGenerated` (invisible to voice caller lookup) | `claimsSystemProfile: existingUserByEmail.IsSystemGenerated` | code review + suite | Fixed |
| A1 / High | reset endpoints + web clients | Reset grant (120 min, shared provider) handed to page script and kept in tab storage | `PasswordReset` token provider, 15 min; browser grant only in `__Host-ClinketPasswordReset-*` HttpOnly cookie; transport checked before the code is spent; body token ignored for browsers | `PasswordResetCookieIntegrationTests` (8) | Fixed (server); clients per C-ledger |
| R1 / Medium | `AuthController.CompleteResetPassword` | Unknown account → service returned null user → controller dereferenced → 500 | dead grant/unknown account → 400 `password_reset_expired`; other null → 400 | unit `CompleteReset_*` | Fixed |
| R2 / Medium | `VerifyMfaForPasswordResetAsync` | "User not found" told anyone which addresses have accounts | same answer as a wrong code | integration `Verification_ForAnUnknownAccount_AnswersLikeAWrongCode` | Fixed |
| R3 / Medium | reset + registration catch blocks | `ex.GetBaseException().Message` returned to the caller (SQL/driver text) | localized `DatabaseError` / `MfaCodeSendingFailed` / `MfaVerificationFailed` | code review | Fixed |
| S2 / Medium | `AuthController` verify flows; `AuthService.LoginAsync` | `SignInAsync` / `PasswordSignInAsync` issued `.AspNetCore.Identity.Application` — a second, unmanaged session no revoke ended | removed; `CheckPasswordSignInAsync` | `SessionAuditRegressionIntegrationTests.PasswordSignIn_IssuesNoIdentityCookie` | Fixed |
| S6 / Medium | lockout + MFA lockout emails | raw Service Bus send: a queue failure became a 500 and no admin alert | `SendSecurityEmailAsync` (SecurityNoticeReporter) | unit lockout tests | Fixed |
| S9 / Medium (privacy) | anonymous passkey discover/challenge | device names, models, ids, dates for any address | trimmed item + most-recent-first | `AnonymousPasskeyDiscovery_NamesNoDeviceOrDate_MostRecentlyUsedFirst` | Fixed |
| S16 / Low | `BusinessContextController.CreateBusiness` | a customer session could create a workspace and carry a Business context | 403 unless the session is a provider session | `CreatingABusiness_FromACustomerSession_IsForbidden_AndCreatesNothing` | Fixed |
| C1 / Medium | phone/email/password/MFA change | change committed but no new session → silent 200 / broken client | 401 `session_ended` + "Your change was saved. Please sign in again." | unit `UpdateMfa_WhenNoSessionCouldBeIssued_Answers401ChangeSaved` | Fixed |
| D9 / High | DeviceTokens | pushes kept reaching a phone after its session ended (sign-out, sign-out everywhere, password change, suspension, expiry) | `DeviceTokens.SessionId` + index; retire in the revoking transaction; re-point on continue; release at sign-out; 15-min sweep (5-min grace); nightly keyset walk for ended sessions | `DeviceSessionIntegrationTests` (10), `DeviceSessionSweepIntegrationTests` (4), unit | Fixed |
| P1 / High (cross-user) | `DeviceTokenRepository.UpsertAsync` | same phone + same push token, new person: hub installation kept the previous owner's tag → new owner received old owner's pushes | `HubSyncRequired` on new owner / platform / reactivation | `ASharedPhone_ReSyncsTheHubForItsNewOwner`, repo unit | Fixed |
| P2 / Medium | `DeviceTokenController.UnregisterToken` | hub installation deleted but `IsRegisteredWithHub` left true → after the next sign-in push never resumed | clear the flag when the hub no longer holds it | unit theory + `SigningBackIn_ReactivatesTheDevice_AndReRegistersIt` | Fixed |
| P3 / Perf | nightly ended-session retirement (first draft, same session) | TOP-n re-scan was quadratic in batches and capped at 10k devices | keyset walk, every active device once per run | `NightlyCleanup_WalksEveryPage` | Fixed |
| S13 / Cleanup | `AuthService` | dead EC math, dead config fields, duplicate passkey methods | deleted | build + suites | Fixed |
| A2-1 / High | `RegisterUserAsync` email branch; `VerifyRegistrationMfaAsync` | Re-registering an unconfirmed account with a number another account holds gave two accounts one phone at verify; a number (or a phone claim's email) taken between hold and verify was still applied | Refuse `DuplicatePhoneNumber` at hold; re-check the held number and held email before applying (`DuplicatePhoneNumber` / `DuplicateEmail`, nothing applied) | `ReRegistering_WithAnotherAccountsPhone_IsRefused`, `APhoneTakenBeforeTheCodeReturns_IsNotApplied`, `AClaimWhoseEmailWasTakenMeanwhile_ClaimsNothing` (real SQL) | Fixed |
| A2-2 / Medium | registration verify + resend | Wrong-code guessing limited only in memory per instance per 15 min; a resend revived an expired hold | Per-account SQL counter (`RegistrationCodeFailure` user-token rows; `Identity:Registration:WrongCodeLimit` 10 / `WrongCodeWindowHours` 24); reaching it discards every hold and refuses verify/resend/new holds (429) + one `RegistrationCodeLimitReached` alert (deterministic EventId); right code clears; stale rows pruned; expired hold refused on resend and deleted | `WrongCodes_ReachingTheLimit_…`, `TheRightCode_ClearsEarlierWrongOnes`, `WrongCodesOutsideTheWindow_…`, `ResendingAnExpiredSignUp_…` | Fixed |
| A2-3 / Medium | `DeviceRegistrationRetryFunction` release job | A hub outage raised the "none released" alert every 15 minutes | `IAdminAlertCooldownService` (`RetiredDeviceAlertCooldownMinutes` 60) | unit `Run_RetiredSweepFailure_WhileCoolingDown_RaisesNoAlert` | Fixed |
| A2-4 / Low | resend limit alert | The account alert on resend named neither the address nor the phone the sign-up used | `IAuthService.GetPendingRegistrationAsync` feeds the alert | unit (CodeEmail + masked phone) + integration | Fixed |
| A2-5 / Medium | `AuthController.Register` | The per-IP limit ran after the account was created/held and the picture uploaded; open holds per account unbounded | IP bucket counted before `RegisterUserAsync` (load-test addresses skipped); account bucket after; `MaxPendingPerAccount` (5) in SQL, 429 + alert | unit `Register_BeyondTheIpLimit_…`, `…LoadTestAddress_SkipsTheIpLimit`; integration `SigningUpOneAddressRepeatedly_…` | Fixed |
| A2-6 / Medium | `VerifyCurrentEmailAsync` | Proving the address stripped unproven sign-ins and revoked every session, yet answered 200 | 401 `session_ended` "change saved, sign in again" | unit (service + controller); integration `VerifyCurrentEmail_OverUnprovenSignIns_…` and the no-op 200 case | Fixed |
| A2-7 / Medium | `DeviceTokenRepository` Upsert/Refresh | A stale tracked read skipped unchanged-looking `IsActive`/`SessionId`, leaving a device retired under a live session | `WriteBinding` forces both columns | `UpsertAndRefresh_SwitchTheDeviceBackOn_WhenItWasRetiredAfterItWasRead` (real SQL) | Fixed |
| A2-8 / Medium (concurrency) | `RetireDevicesOfEndedSessionsAsync` | One UPDATE read AuthSessions while locking DeviceTokens (against the lock order); a device re-pointed mid-run could be retired | SELECT judges, UPDATE re-checks the judged binding | `NightlyRetire_LeavesADeviceRePointedToALiveSession_AfterItWasJudged` (interceptor, real SQL) | Fixed |
| A2-9 / Low | release job | One batch per run; a refused device could block progress | batch loop (`MaxRetiredBatchesPerRun` 10) with a tried-once set | unit ×3 + `RetrySweep_ReleasesEveryRetiredDevice_AcrossBatches` | Fixed |
| A2-10 / Medium | pre-rollout devices (`SessionId` NULL) | Never retired: pushes kept reaching phones signed out before the rollout | retired when the account is signed in nowhere | `NightlyCleanup_RetiresADeviceWithNoSession_…` | Fixed |
| A2-11 / Process (§0.18) | Identity suites | Tests of the Functions-run sweeps lived in the Identity suites | moved to `DeviceSessionSweepIntegrationTests` + stamp/deactivated/suspended cases | Functions suites | Fixed |
| A2-12 / Low | IP limit alert | IP in title/description, so a spread-out flood raised one alert per IP | constant text, IP in metadata | unit `IpLimitAlerts_FromDifferentAddresses_…` | Fixed |
| A2-13 / Cleanup | `AuthService` | stale comment on the password sign-in path; literal reads of the new settings | comment rewritten; settings read through the indexer like the rest of the class | build | Fixed |
| A3-1 / Medium | `AuthController` limit buckets (re-audit F1) | A user id re-spelled in another letter case got a fresh in-memory bucket (SQL matches any case) — unlimited SMS/verify per account | `AccountKey` canonicalises every id before buckets and lookups; the SQL guard keys rows by the account's own id | unit `AnAccountIdInAnyLetterCase_SharesOneLimit`; integration `ARespelledAccountId_…` | Fixed |
| A3-2 / Medium | wrong-code counter (F2, F3) | check-then-act let a parallel burst guess past the limit; the 24 h lock could be renewed forever against the real person | `VerificationCodeGuard` (D21): reserve-before-check + recount, 1 h / 20-a-day pauses, admin release | `VerificationCodeGuardIntegrationTests` (12, real SQL) | Fixed |
| A3-3 / Low | load-test bypass (F4) | skipped the IP limit even where a hold path still sent codes | IP bucket counts only codes actually sent; `IsAutoVerifiedEmail` private again | unit `Register_OfAnAccountConfirmedAtSignUp_…` | Fixed |
| A3-4 / Low | resend (F5) | resends kept a hold open forever | `FirstIssuedAt` + `MaxHoldLifetimeMinutes` (30) | `ASignUpKeptOpenByResends_EndsAtItsLifetime` | Fixed |
| A3-5 / Low | post-commit cleanup (F6) | a concurrent delete turned a verified sign-up into 400 | delete by key; post-commit cleanup log-only | code review + suites | Fixed |
| A3-6 / Low | register (F7) | an account-limit refusal left the hold + picture; IP counted failed attempts (shared-IP false positives) | `DiscardRegistrationAsync`; IP peeked before the account work, counted only on a send | `ASignUpRefusedByTheAccountLimit_LeavesNoHoldBehind`, unit IP tests | Fixed |
| A3-7 / Low | release sweep (F8, F9) | refused devices stalled the batch; release could delete a fresh re-registration | keyset (`RetiredDeviceCursor`, raw SQL order); re-read `IsRetiredOnHubAsync` before the hub call | fn unit + integration (keyset, signed-back-in) | Fixed |
| A3-8 / Low | nightly retire (F10) | EF 10 expands lists into parameters: a full page nears SQL Server's 2,100 cap | `EF.Parameter` (one OPENJSON parameter per list) | `NightlyRetire_AFullPageOfDistinctEndedSessions_…` | Fixed |
| A3-9 / Low | phone check (F11) | the first match could be the account itself, hiding another holder | `UserProfilePhoneLookup.IsHeldByAnotherAsync` | `ReRegistering_WithANumberTheAccountSharesWithAnother_IsRefused` | Fixed (a unique index remains a schema decision — residual) |
| A3-10 / Low | email proof (F12) | "your change was saved" after a proof that removed the password/phone | `Error_AddressProvenSignInAgain` ×5 languages | unit + integration | Fixed |
| A3-11 / Info | continuing re-point (F13) | UPDATE DeviceTokens read AuthSessions (lock order) | revoke time read first | suites | Fixed |
| A4-1 / Medium | contact code checks (re-audit F1) | "Already verified" answered success without a code and cleared the Contact count; a right code on any address the holder owns cleared it too — unlimited guessing of an address they do not own | Contact success releases only its own attempt (`ReleaseAttemptAsync`); other flows still clear | unit `AContactSuccess_ReleasesOnlyItsOwnAttempt`; integration `AnAddressAlreadyProven_NeverResetsTheContactCount`, `ARightContactCode_StopsCountingOnlyItself` | Fixed |
| A4-2 / Medium | `userprofile/account-deletion/*` (F2) | No send or check limit; the time-based code matched whether or not it was sent | `CodeLimitGate` send+verify limits, SQL guard flow `AccountDeletion`, dedicated `AccountDeletionCodeLimitReached` (PushableTypes ×3, AlertsPage), single-use `AccountDeletionMFA` issue row; service owns the send | unit ×9 (controller + service); integration paused / counted / never-sent | Fixed |
| A4-3 / Medium | in-memory buckets (F3) | Reset-by-phone keyed all digits, email sign-in the raw email, ids any spelling SQL accepts (width, invisible characters) | account resolved first, bucket = account id (unknown → normalized form); only canonical GUIDs accepted (400 otherwise) | unit variants + non-canonical theory; integration full-width id | Fixed |
| A4-4 / Medium | guard alerts (F4) | After an admin release the next pause in the same window alerted nobody | `CodeAttemptRelease` row; its stamp is part of the claim and EventId | integration `AfterAnAdminRelease_TheNextPause_RaisesANewAlert` | Fixed |
| A4-5 / Low-Med | two-step code (F5) | attempts the MFA lockout refused were counted as wrong codes | controller reads the lockout first; locked attempts never reserve | unit + integration | Fixed |
| A4-6 / Low-Med | reset vs sign-in (F6) | the same TwoFactor code served both, with two budgets (40/day) | reset codes have their own purpose `PasswordReset` | unit purpose + integration `ASignInCode_NeverResetsAPassword` | Fixed |
| A4-7 / Low | alert claims (F7) | a failed send kept the claim: no alert for the rest of the window | `IAdminAlertCooldownService.Release` on failure (guard + gate) | `CodeLimitGateTests`, integration failing-queue test | Fixed |
| A4-8 / Low | open sign-up cap (F8) | the recount refusal raised no alert | both refusals through `RefuseOpenSignUpAsync` | integration parallel burst | Fixed |
| A4-9 / Low | hold lifetime (F9) | verify ignored `FirstIssuedAt` | `IsPendingRegistrationLive` checks both | `ASignUpPastItsLifetime_CannotBeVerified_EvenWithTheRightCode` | Fixed |
| A4-10 / Low | shared phone (F10) | guard and service could pick different accounts | reset account resolved once in the controller; `FindByPhoneAsync` ordered (CreatedAt, Id) | unit `..._AlwaysResolvesTheOlderAccount` | Fixed |
| A4-11 / Low | register (F11) | consent + activity written before the limit; parallel sign-ups passed the IP peek | limit before consent; IP slot reserved for the whole request, given back when no code is sent | unit ×3 incl. parallel | Fixed |
| A4-12 / Info | reset form (F12) | 429 vs 400 reveals an account after ~11 guesses | accepted: `login/email` and `login/phone` answer "not found" by design, so hiding it here adds nothing | — | Accepted (by design) |
| A4-13 / Residual | D21 (F13) | ~20 anonymous requests pause a person's code sign-in for a day | pause now says why and to contact support (`Error_CodeChecksPaused` ×5); admin release re-arms alerts | — | Owner-accepted residual |
| A4-14 / Low | docs (F14) | stale skill + comments | identity-api skill rewritten; comments trimmed | review | Fixed |
| A4-15 / Test | guard wiring (F15) | tests matched any flow; five endpoints had no real-SQL wiring test | per-flow assertions; theory over the five endpoints with the pause sentence | sabotage round 4 | Fixed |
| A4-L7 / Low | admin clear | deactivated accounts 404; "cleared" when nothing was | `IgnoreQueryFilters`; `CodePauseClearNothing` | unit ×2 | Fixed |
| RC-AW / Low | admin web Retry-After | a long Retry-After held the tab's single renew slot | capped at 30 s like every client | `never waits longer than thirty seconds…` + sabotage | Fixed |
| RC-* / Medium…Low | six client apps (re-audit) | admin web L1–L7; provider web F1–F12 (purge on code sign-in, cancel noise, CSP); customer web 1–12 (other-account token, gated reloads); provider/customer mobile unbounded security-change hold, dispatch epoch, passkey stamp; admin mobile #1–#10 | per app, each fixer's report; skills updated | per-app suites + sabotage (see evidence) | Fixed (NetInfo probe in provider/customer: owner item) |
| W1…W17 / High…Low | three web apps | cross-tab clearing loop (High), resurrected restore, anonymous personalised cache, late answers after sign-out, loader hang, `?experience=`, admin logout/all retry, false "session expired", code step, onboarding token, dead web.config, CSP gaps, return-path check, language reset after the sweep, clock-skew renew loop, test quality | see the web agents' reports; skills `clinqet-partner-app`, `clinqet-user-app`, `clinqet-admin-app` updated | provider jest 5389, customer 2486, admin all green; Playwright two-tab 12/12; 28 + 16 sabotages caught | Fixed |
| M1…M3, L1…L14 / Medium…Low | three mobile apps | unreadable keychain never reset (Android), clock-skew failure loop, security change racing a sign-out, parity gaps (re-auth, sign-out, Retry-After, passkey record, business caches, dead code, test quality) | see the mobile agents' reports; one keychain rule for all three apps | provider jest 6739, admin 198, customer (see evidence) | Fixed (M4 decided: D23) |

### Completion checklist

- [x] Every design-closure item resolved; schema deltas (D5, D9) approved and implemented with real consumers; rounds 3–4 add none.
- [x] All event policies and lifetime invariants enforced server-side.
- [x] All sign-in/exchange/refresh/security mutation paths covered, including admin and account deletion.
- [x] Web apps hardened (no BFF, D6) and all three mobile apps migrated; no alternate unsafe storage/retry path found by the re-audits.
- [x] Revocation, concurrency, recovery, keys, storage and notifications covered by real-SQL / browser / jest evidence (limits listed below).
- [x] New UI states localized (5 languages) and mirrored; admin copy English by design (AD1); no new page (no mockup gate).
- [x] Affected tests/builds/lint/type checks pass (evidence table above); coverage limits stated.
- [x] Migrations applied to ca + in sandbox earlier this programme; round 4 adds no schema.
- [x] Four audit rounds; every finding fixed and re-reviewed, or listed below as an owner decision / accepted residual.
- [x] Skills ×4 and memory updated; git status inspected per repo; scratch removed (see the final report).
- [x] Final report states results, migration ids, audit outcome, limitations; nothing deployed.

Owner decisions / residuals after round 4 (none blocks the commit):
- iOS NetInfo reachability probe (HEAD to a Google endpoint every 60 s) in the provider + customer mobile apps comes from
  pre-existing OfflinePopup / useOnlineStatus / LocationProvider / useIsOffline; turned off only in admin mobile.
- Provider web: a logout already on the wire when a sign-in's Set-Cookie lands can still delete the new cookie (a
  server-side marker naming the session would close it); the client guard `signInInFlight` closes the practical window.
- Tags added inside the GTM container are blocked by the CSP until each host is listed.
- A4-12 (reset form reveals existence after ~11 guesses) accepted by design; A4-13 (D21 lock-out by an attacker) accepted.
- Earlier owner items still open: per-stamp WAF 200 vs api 500; CSP 'unsafe-eval' / report-only; provider redirect URIs for
  `identity-<stamp>`; a unique phone index (schema decision); orphan `REACT_ENV_*` / session-secret GitHub secrets.

If the session must continue later, update this section with exact completed work, pending checks/processes, blocking decisions and next commands. Resume the same file; do not abandon open work or restart the investigation from scratch.

### Resume checkpoint (2026-09-30, after a Claude Code crash; keep this block current)

LATEST STATE (supersedes the lists below where they differ):
- 2026-09-30 DONE AND PUSHED (D24): one linear commit per repo, each with one parent, every repo 0/0 with origin and a
  clean tree — shared 0b0faa9, core 0709330, infrastructure 2989ff3, provider web 9bdca78d, customer web a656eaa,
  admin web 96424a0, customer mobile a4aac29, provider mobile 82c78a9f, admin mobile 0381eca (main), Functions af42741,
  Identity 51602db, API 4f1c88a9 (last). Origin moved during the push (another team's knowledge-entitlement commits in
  shared/core/infra/Functions/API and a React Native 0.79.7 upgrade in both mobile apps): fetched, fast-forwarded or
  rebased (never merged), and re-verified on the combined code — server suites green except one order-dependent test
  in the other team's new `KnowledgePassageLimitIntegrationTests.EveryPlanCarriesTheColumn_…` (passes alone; reads every
  plan in the shared test DB), both mobile apps reinstalled on RN 0.79.7 and green. Nothing deployed; deploy Functions
  before Identity.
- 2026-09-30 round 4: re-audit of round 3 (server F1–F15, rows A4-*) FIXED in code + tests (Identity unit 1322, integration
  618); sabotage harness `srv-sabotage4.js` (25 mutations) running. Client re-audits done for all six apps; fixers DONE for
  admin mobile (jest 220) and provider mobile (jest 6779); admin web, provider web, customer web, customer mobile fixers
  in flight. Skills updated (.claude): identity-api, auth-sessions (§6, §8 admin mobile, tests), admin-app,
  provider-mobile. Still to do: finish fixers → skills for their apps → full suites all repos → sync skills ×4 →
  evidence + checklist → memory → scratch cleanup → commit/push (D24).
- DONE: server round 3 (D21 guard, A3-1…A3-11) with 21 sabotage checks (20 caught; F10's reverted form still passes
  because EF 10.0.8 falls back to one parameter past the cap — explicit `EF.Parameter` kept for a stable plan); web fix
  round (3 apps) and mobile fix round (provider + admin) with their follow-ups; skills `.claude` updated for all of it;
  admin web "Clear code pauses" + alert types. All repos 0/0 with origin after `git fetch` — no foreign commits.
- IN FLIGHT: full server suites (`srv-fullsuites.sh`); read-only re-audit of the round-3 server work; read-only
  re-audit of the client fix rounds (customer mobile added when its fixer finishes); customer mobile fixer.
- THEN: fix every re-audit finding; run admin web jest/eslint/build (changed after its agent) and customer mobile
  checks; sync skills ×4 (`srv-skill-sync.js <skill>…`, validated byte-identical on in-sync skills); evidence +
  checklist here; scratch cleanup; commit + push each repo to master (D24).

DONE (on disk, uncommitted, all on `master`/`main` working trees):
- Server round 2 (A2-1…A2-13) implemented in clinqetshared, clinqetcore, clinqetinfrastructure, clinqetidentity,
  clinqetfuncations (+ clinqetapi test mocks). Targeted suites green; 24/24 sabotage checks CAUGHT and restored
  byte-identical (harness `srv-sabotage2.js` in the session scratchpad).
- Provider mobile hardening + parity follow-ups (first-launch clear, per-request issuing origin) — agent reported jest
  430/430 suites, tsc 0, eslint 0 errors.
- Skills updated in `.claude` only: clinqet-auth-sessions (new), identity-api, function-app, notifications, testing,
  admin-app, ui-common, partner-app, user-app, customer-mobile, provider-mobile. CLAUDE.md ×4 list the 40th skill.
- Memory `auth-session-audit-2026-09-29.md` updated.

IN FLIGHT (resume by messaging the agent ids from this session's transcript; if lost, re-brief from §11 rows):
- Full server suites (Identity unit+integration, Functions unit+integration, API + MCP build/unit/integration).
- Independent read-only re-audit of the server round-2 fixes.
- Web fix round: provider web + admin web (findings W1, W4-W6, W13-W17, admin W7-W10, W17), customer web (W2, W3,
  W11a-j, W12, W13, W15, W17). Findings text: the web audit report (1 High cross-tab clearing loop, 3 Medium).
- Mobile audit DONE (report: session scratchpad `srv-mobile-audit.md`, M1-M4, L1-L14, test quality). Fix round in
  flight: provider (resumed agent), customer and admin (new agents), each edits only its own repo.
- AWAITING OWNER: (a) code-limit design — recommended: 5 tries per code; SQL per-account-per-flow counter in the
  existing UserToken table (no schema) with 10/hour → 1 h pause and 30/24 h → day pause, for sign-up, login codes,
  password reset, contact change/verify, MFA; dedicated alerts RegistrationCodeLimitReached (exists) +
  LoginCodeLimitReached, PasswordResetCodeLimitReached, ContactCodeLimitReached, SessionReplayDetected,
  UnprovenAccessRemoved; admin "clear the pause" action. Replaces the 24 h sign-up lock.
- M4 DECIDED (owner 2026-09-30): admin mobile keeps the shared hosts (Front Door GeoRouting per request by IP
  country, no affinity) — no change; limits recorded in the auth-sessions skill §8 and the final report.

PENDING after those land, in order:
1. Build the confirmed code-limit design and M4; re-audit the web + mobile + server fixes.
2. Re-run all client suites (jest/tsc/eslint/next build) and all server suites; record numbers under "Test/build/
   migration evidence".
3. Update skills (partner-app, user-app, admin-app, ui-common, customer-mobile, provider-mobile, auth-sessions) for the
   client fixes, then sync EVERY changed skill to `.github/skills`, `.agents/skills`, `.cursor/rules/*.mdc` (mdc =
   same body, frontmatter `description` + `globs`); create the three auth-sessions copies.
4. Add web/mobile rows to "Audit findings", tick the completion checklist, update memory.
5. Delete every scratch file (scratchpad `srv-*`, `wf*`, `amob-*`, `rsa-*`, `findings.md`, `CONTRACTS.md`,
   `CLIENT-RULES.md`, `dead.js`, other session scripts); `git status --porcelain` every repo shows no scratch.
6. Git per changed repo — OWNER CHANGED THIS 2026-09-30: commit and push DIRECTLY to master (main for
   clinqetmobileadminapp), no branch/PR. Per repo: `git fetch origin`; if origin moved, `git merge --ff-only
   origin/<branch>` BEFORE committing (refuses rather than touching another session's edits — if it refuses, stop for
   that repo and report); stage ONLY this programme's files (never another session's uncommitted work); commit with the
   Co-Authored-By trailer; prove `git rev-list --merges origin/<branch>..HEAD` is empty and the graph is linear; push.
   Order: clinqetshared, clinqetcore, clinqetinfrastructure, clients, clinqetfuncations, clinqetidentity, clinqetapi
   LAST. Never checkout/restore/reset/stash/clean/pull/merge-without-ff-only. Never print the remote credential.
7. Final report: owner questions (D21 wrong-code lock window 24 h; per-stamp WAF 200 vs api 500; CSP enforce vs
   report-only, 'unsafe-eval'; provider redirect URIs registered for identity-<stamp> hosts), residual risks, migration
   ids (`20260929032234_AddAuthSessions`, `20260930013538_AddDeviceTokenSessionId`, both applied to ca + in sandbox),
   deploy order (Functions before Identity), nothing deployed.

## 12. Primary security references

These inform the design; they do not certify this project's implementation. Refresh-token rotation and replay protection follow [RFC 9700 section 4.14.2](https://www.rfc-editor.org/rfc/rfc9700.html#section-4.14.2). Server-side expiry, cookie protections and reauthentication are informed by [OWASP Session Management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html). Browser state-changing operations must follow the applicable controls in [OWASP CSRF Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html). The specific two-minute idempotent recovery protocol is this project's design and must be independently threat-reviewed; do not claim the RFC mandates that protocol or these lifetime values.

## 13. Copy-paste next-session prompt

Read C:\Nik\Data\auth-session-review\AUTH-SESSION-IMPLEMENTATION-PLAN.md in full and implement this authentication/session programme end to end. It is the single handoff for provider and customer web/mobile, Identity and affected APIs. Read AGENTS.md, applicable skills, actual source and tests before editing. The owner has approved the documented session schema/lifetimes and authorizes using sandbox appsettings/local.settings/connection strings and applying the approved migrations through the Cosmos setup project; do not re-ask those permissions. Resolve the explicitly identified design-closure items properly, presenting exact additional schema deltas only if required. Quality over speed: no assumptions, hallucinations, workarounds, shortcuts, disabled protections or skipped failures. Challenge an incorrect design instead of blindly implementing it. Handle and test concurrency, retries, lost responses, storage failures, all authentication/security events and every further edge case you discover. Preserve unrelated work and maintain all four clients' parity. Run the migration and verify it; if blocked by the SQL firewall, give me the actual client IP to whitelist. After implementation, audit the actual complete code and call chains for security gaps and edge cases separately from running tests, fix and re-audit findings, update this file/skills/memory, clean your scratch files and report verifiable results. Do not declare completion while known gaps or required work remain.

### Round 5 — web session-cookie lock (2026-09-30)
DONE AND PUSHED. Web Lock `clinket.auth.sessionCookie` in customer/admin/provider web closes the race where a logout or a dead-handle renew answer deleted a newer sign-in cookie. Independent audit: 1 high (admin adapter parsed the body too late) + 4 low findings, all fixed except one deliberate difference: customer web keeps the pending sign-out marker on a security change. Commits: customer 94e05a2, f51cd68; admin 25bb604, 0a56b14; provider 5d0093b7, dbf62f03. Mobile: not applicable.
