# Remembered sessions and revocation review — 2026-09-28

Scope: Identity API/shared AuthService, provider web/mobile, and customer web/mobile. This is a source review and targeted regression verification, not evidence from the particular deployed session that logged the owner out. Deployed settings and production request traces were not inspected. Changes are local, not deployed.

## Outcome and confirmed defects fixed

1. **Temporary refresh failures were treated as logout.** Central API/auth callers, including provider web’s separate Ask Clinket streaming client, could discard credentials after offline errors, timeouts, throttling, server failures or malformed responses. All four clients now distinguish explicit invalid-session responses from inconclusive failures. Cached session presentation can remain available during an outage; APIs continue to enforce authorization. Mobile API callers receive a temporary 503 result when refresh cannot establish validity.
2. **Identity returned invalid credentials for internal errors.** `AuthService.RefreshTokenAsync` caught arbitrary exceptions and returned false; `AuthController.RefreshToken` converted that to 401. Unexpected errors now propagate to the existing server-error handler.
3. **Refresh rotation could consume the old credential without issuing its replacement.** The claim and replacement were separate commits. Normal refresh and external-login exchange now share an execution-strategy transaction. Replacement failure rolls back the claim. A lost SQL commit acknowledgement is verified against the committed replacement before any retry. The atomic claim also checks revocation and expiry, closing the read/claim revocation race.
4. **Remembered customer-web access-token updates could revert to 24-hour storage.** Policy/consent paths call `SessionStore.setToken` without a Remember Me argument. Its default was false. It now preserves the existing choice. This was a real storage-lifetime defect, but it alone does not establish the cause of the reported logout: a surviving refresh credential can still recover an expired/missing access token.
5. **Browser single-flight only covered one tab.** Two tabs could submit the same remembered refresh token and trigger server reuse revocation. Both web apps now use same-origin Web Locks as well as within-tab coalescing. A waiting tab rechecks storage and reports a stale session if another tab changed it, allowing existing callers to reload instead of replaying or erasing the new pair. Browsers without Web Locks retain only within-tab coordination; the browser test covers Chromium with Web Locks.
6. **Late refresh results could affect a changed session.** Refresh services check the stored credential before accepting/rejecting a result. Provider mobile checks again after response-body parsing. Replacement refresh tokens are stored before access-token notification in both web apps and customer mobile. Provider mobile's timeout now covers response-body reading too.

Relevant implementation:

- [AuthService](C:/Nik/clinqetinfrastructure/Services/Auth/AuthService.cs), normal refresh, external exchange, `ExecuteTokenRotationAsync`.
- [Provider web refresh](C:/Nik/clinqetwebpartnerapp/src/services/tokenRefreshService.js), [API](C:/Nik/clinqetwebpartnerapp/src/lib/apiClient.js), [route gate](C:/Nik/clinqetwebpartnerapp/src/middleware/PrivateRoute.jsx), [auth hook](C:/Nik/clinqetwebpartnerapp/src/hooks/useAuthManager.js).
- [Customer web storage](C:/Nik/clinqetwebuserapp/utils/sessionStore.jsx), [refresh](C:/Nik/clinqetwebuserapp/services/tokenRefreshService.js), [API](C:/Nik/clinqetwebuserapp/services/api.js), [auth hook](C:/Nik/clinqetwebuserapp/hooks/useAuthManager.js).
- [Provider mobile refresh](C:/Nik/clinqetmobilepartnerapp/src/apiManager/refreshToken.tsx), [API](C:/Nik/clinqetmobilepartnerapp/src/apiManager/apiManager.tsx), [auth provider](C:/Nik/clinqetmobilepartnerapp/src/context/AuthProvider.tsx).
- [Customer mobile API/refresh](C:/Nik/clinqetmobileuserapp/src/apiManager/apiManager.tsx), [auth provider](C:/Nik/clinqetmobileuserapp/src/context/AuthContext.tsx).

## What seven days currently means

Checked-in Identity settings are `JwtSettings:RefreshTokenValidityInDays = 7`, `JwtSettings:ExpiryInMinutes = 120`, and `Security:RefreshToken:RevokeAllOnReuse = true`. Successful refresh gives the replacement another seven days. This is a sliding window, not a fixed seven-day session measured from original sign-in. The changes preserve that existing behavior.

A valid remembered session should survive returning after one, two or six days without another login, provided it has not been deliberately revoked. Seven days is not a guarantee against password reset, account suspension, explicit logout, stolen-token response, deleted browser storage, app reinstall or expired credentials. An absolute session cap, if desired, must be enforced by the server and would require additional session state; it has not been added.

## Does signing in revoke the other device?

**No, ordinary sign-in does not.** `IssueSessionAsync`/`MintSessionAsync` create another refresh credential without invalidating existing ones. SQL tests confirm that issuing a second session leaves both refreshable. Password, OTP, MFA, passkey and external sign-in paths use session issuance.

**Logout does revoke every device.** `AuthController.Logout` calls `InvalidateRefreshTokensAsync(userId)`. The checkbox does not override that. Separately, presenting a used refresh token can revoke every credential belonging to the account because reuse detection is account-wide. A second device's independent token is not itself reuse; duplicate use of the same token is.

## Recommended security and UX policy — approved for implementation, not yet fully implemented

| Event | Current behavior confirmed in source | Recommendation |
|---|---|---|
| Ordinary successful sign-in | Creates independent refresh token | Keep other devices signed in. Record and notify meaningful new-device activity. |
| Failed login/OTP attempt | Does not normally revoke existing refresh tokens | Keep existing sessions; throttle authentication attempts. Avoid attacker-triggered global logout. |
| Ordinary logout | Revokes all account refresh tokens | Revoke the current session family. Separate explicit “sign out everywhere” action. |
| Password-reset request | Sends recovery challenge | Never revoke solely because somebody requested recovery. |
| Successful password reset | Revokes all refresh tokens; no automatic replacement session | Keep this recovery behavior; require normal sign-in afterward. |
| Authenticated password change | Revokes all, then issues current replacement | Keep current verified device with a new session; revoke the other sessions. Make password mutation and revocation atomic. |
| First password set | Same revoke-all/reissue pattern | Require recent strong authentication, rotate current session, revoke other sessions. |
| Email/phone change | Confirms destination, revokes all, issues replacement | Require recent proof of current identity plus proof of destination. Notify the old contact. Make mutation/revocation atomic and independent of notification availability. |
| Verify an existing contact | Marks contact confirmed without global revocation | Usually retain sessions. Refresh affected claims as needed. |
| Ordinary profile edit | No global revocation | Retain sessions. Security factors must have their own authenticated mutation flow. |
| Policy acceptance | Issues a fresh access token without rotating refresh | Retain session and Remember Me choice; fixed customer-web lifetime default. |
| Enable/change/disable MFA | Existing paths do not consistently revoke sessions | Require recent authentication, rotate current session, revoke other sessions when the authentication boundary changes; notify the user. |
| Passkey enrollment/deletion | Registration/deletion do not globally revoke sessions | Require recent authentication and notify. Deleting a credential must also offer a way to revoke sessions on the lost device. |
| Account deactivation/suspension | Revokes refresh tokens | Keep global revocation and ensure already-issued access tokens lose authorization promptly. |
| Account reinstatement | Does not revive revoked tokens | Keep this; require a new sign-in. |
| Workspace membership/access loss | Refresh re-resolves access and can downgrade to account session | Keep the account signed in to other workspaces. Clear affected workspace caches and subscriptions. |
| Workspace switch | Issues another business-context session | Keep unrelated devices; never replay an old business mutation under the newly selected business. |
| Refresh token replay | Configured to revoke all account refresh tokens | Retain replay protection, but scope it to a session family unless evidence requires account-wide incident response. |
| Network failure / 429 / 5xx | Previously several paths logged out | Preserve credentials and surface temporary unavailability; fixed central paths. Retry on later activity, without unbounded loops. |
| App restart / browser reopen | Reads stored session and attempts refresh | Restore remembered sessions consistently; distinguish temporarily unavailable secure storage from absent credentials. |
| Storage deletion / reinstall | Credentials unavailable | Reauthentication is necessary. Do not fabricate recovery from a device identifier. |

The recommendation to retain rotation/replay detection, revoke affected grants, and expire inactive refresh tokens follows [RFC 9700 §4.14.2](https://www.rfc-editor.org/rfc/rfc9700.html#section-4.14.2). Recent reauthentication and server-enforced expiry follow [OWASP session guidance](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html). Password recovery should end with ordinary login and session invalidation, as described by [OWASP password-recovery guidance](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html).

## Remaining design/security findings to address before production

These are part of the requested second analysis. They have not been silently implemented as policy or schema changes.

1. **Session families and response-loss recovery are missing.** `RefreshToken` has no family/session ID or replacement linkage. A server may commit rotation and lose the HTTP response afterward. The client retains the old credential; retry can trigger account-wide reuse revocation. The SQL transaction fixes database partial failure, not loss after a successful HTTP-side commit. Used-token detection currently precedes revocation/expiry checks, so presenting an old used token can also revoke newer unrelated sessions; closed families should not repeatedly invalidate fresh sign-ins. A durable, bounded, explicitly designed retry/idempotency mechanism and family-scoped revocation are needed. Disabling replay protection or accepting used tokens indefinitely would be a shortcut and is not recommended.
2. **Access-token revocation is delayed.** Checked-in access lifetime is 120 minutes. The Identity and Main API bearer registrations do not validate a live account session/security stamp on every authenticated request. Refresh-token revocation alone therefore cannot promise immediate access-token invalidation. Individual authorization paths may have additional checks; those are not a platform-wide session revocation mechanism. Recommend short access lifetimes plus an explicit live-session/security-version check for account-wide revocation and sensitive actions.
3. **Browser token storage is JavaScript-readable.** CryptoJS encryption uses a client-readable key; it does not protect against script execution in the origin. Prefer a BFF/session-cookie design with HttpOnly/Secure cookies and CSRF protection. Mobile should keep credentials in OS secure storage.
4. **Refresh tokens are stored in plaintext SQL.** Recommend high-entropy opaque credentials with a server-side hash, session-family identity, expiry and revocation state. This requires an approved schema/migration design, including handling of existing sessions.
5. **Credential changes and notification failures are not consistently isolated.** Email/phone mutation paths perform notification work before refresh invalidation and do not consistently check `UserManager.UpdateAsync` results. Password/contact changes and session invalidation should commit together; reliable notifications should follow committed security state. This deserves a separate tested mutation-flow change.
6. **MFA mutation deserves urgent attention.** The follow-up fixes `UpdateUserProfileAsync` so an omitted MFA choice preserves both the enabled flag and factor; previously an ordinary edit could disable MFA or switch phone MFA to the DTO's default Email factor. Explicit factor changes still use the profile contract. Separating security-factor changes and enforcing recent authentication remain unfinished. The login-MFA completion method also lacks the explicit suspended-account guard used by the passwordless paths; unify the final issuance eligibility gate.
7. **Remaining client race/storage edges.** API retry shortcuts can use a newly stored access token without proving it represents the same account/business as the original request. Add an explicit session-generation/context boundary before retrying mutations. Provider mobile secure-storage read errors currently collapse to “missing”, and its cold-start fallback requires an access token even if a refresh token remains. A proper unavailable-storage/auth state should preserve the session without granting API access. These broader lifecycle changes were not folded into this patch.
8. **Remember Me off is inconsistent.** Provider mobile disallows refresh when its flag is false, while web/customer-mobile paths differ. Agree on browser-close/idle/absolute semantics and enforce lifetime policy server-side. Do not rely solely on client storage TTLs.
9. **Cross-tab support and UX.** The new lock prevents duplicate rotation on browsers supporting Web Locks. A queued tab currently uses the existing stale-session reload behavior. A future session-generation channel could update that tab without losing in-progress UI state, while preserving account/workspace isolation. Legacy browsers without Web Locks still need an explicit support policy or a secure shared coordinator.

No new SQL columns, tables, indexes, Cosmos fields, or migrations were created. The owner approved implementation of the recommendations. The exact first schema/readers/writers/cost and lifetime proposal is now in [IMPLEMENTATION.md](C:/Nik/Data/auth-session-review/IMPLEMENTATION.md), awaiting the separate explicit approval required by `C:/Nik/AGENTS.md` §0.7 before schema code or migrations. That file tracks the unfinished implementation and audit.

## Verification

- Identity API build: passed, 0 errors and 0 warnings on the final incremental build.
- Identity targeted unit tests: 36 passed, 0 failed, 0 skipped.
- Identity real-engine integration tests: 57 passed, 0 failed, 0 skipped. Includes `RefreshSessionIntegrationTests`, workspace-refresh behavior, external exchange, and controller refresh cases. New tests inject failed replacement inserts, lost commit acknowledgement, idle ages of 2/6/8 days, and independent session issuance.
- Frontend targeted Jest tests: 136 passed across all four apps, including auth hooks/providers, API interception, token rotation, malformed/transient failures, account changes and storage lifetime.
- Actual Chromium two-tab tests: passed in both web apps. Test harness loads the actual refresh service, encrypted SessionStore and Axios; only transport/config dependencies are stubbed. Customer test used the installed compatible Chromium via the existing `E2E_CHROMIUM_EXECUTABLE` option because its pinned binary was absent.
- Both mobile TypeScript checks: passed. Native iOS/Android builds and device/background-Keychain tests were not run.
- Both web production builds: passed, including the provider rebuild after the streaming-client fix. Both Android production JavaScript bundles: passed (not native builds). Targeted ESLint: zero errors across changed application and Jest files; existing mobile style warnings remain.

Follow-up verification: Identity API builds with zero errors and zero warnings; AuthServiceTests passes 24 tests and RefreshSessionIntegrationTests passes nine real-SQL tests, including two new MFA-preservation cases in each suite. No failures or skips. The unit build also emitted existing dependency/nullability/analyzer warnings, including NU1903 for SQLitePCLRaw.lib.e_sqlite3 2.1.11. This has not been assessed or remediated as part of the auth changes; it prevents any claim that the dependency tree has no security risks.

Scratch cleanup was attempted for the session-only Android bundles/assets and generated Playwright last-run reports. The execution policy rejected the cleanup command; those artifacts have not been confirmed removed.

Passing these regressions protects the identified failures. It is not a proof that every future change or network/storage failure can never cause reauthentication.
