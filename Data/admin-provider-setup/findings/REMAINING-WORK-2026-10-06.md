# Consolidated work list after the §14 audit (2026-10-06)

Four reviewers reported (security · correctness/edge cases · runtime/cost · completeness). Two more are still
running (localization/UX · config/regression). Items marked **DONE✔** were fixed after the reviewers read the
tree, so their reports are stale on those points.

## Already fixed this session (reviewers' reports predate these)

- **C5 provider web** — `PRICE_TYPES.ON_REQUEST` was undefined; added + 5 sabotage-proven tests. DONE✔
- **C5 provider web** — hidden extras were still validated, making the form a dead end. DONE✔
- **C5 provider phone** — 4th pill, nudge, `normalizePriceType`, validation + payload gating, hidden fee
  sections. DONE✔
- **RUN-1** — `ForceOnlineBookingsOffAsync` now needs `IsAdminProvisioned`, so a setup session on a live
  provider no longer switches their online booking off. DONE✔
- **SEC-3** — take-over refuses a closed or suspended account, in the cheap check AND in the atomic claim. DONE✔
- **SEC-5** — the name signal now works on the identity-provider path too (`PersonFirstName/PersonLastName`). DONE✔
- **RUN-3** — post-commit effects use `CancellationToken.None`. DONE✔
- **MEMORY.md** — index lines + two new entries written; the design entry marked built. DONE✔

## P0 — security and money

| id | what | where |
|---|---|---|
| P0-1 | **Privilege escalation**: the phone-only password-reset sign-in mints a session with a **caller-chosen `UserType`**, `Admin` included — the one code path that never got `MayEnterAsAsync` | `AuthService.cs:2019-2026`, `AuthController.cs:2691` |
| P0-2 | **SignalR is not MVC**: a setup session can open `NotificationHub`, replay the provider's notifications and `WatchVoiceLive` their customers' **live call transcripts** | `NotificationHub.cs`, both `Program.cs` |
| P0-3 | **The claim/stop link is a 60-day bearer token bound to nothing**: sent to `BusinessProfile.Email`, signs only the account id, never synced on a contact correction → the old address can repeatedly destroy the corrected email and every external login | `PreparedProviderLinkProtector`, `PreparedProviderEmailFooter`, `CorrectContactAsync`, `RemoveReportedAddressAsync` |
| P0-4 | **$0 money path**: `EnsureBookingInvoiceSentAsync` has no no-price guard → a Sent $0 invoice, a $0 gateway link and a $0 PDF the day booking-pay is switched on | `InvoiceService.cs:167-205` |
| P0-5 | **C2 unenforced on the MCP service tools** → `price:0` stored as a priced service, and an On-request row written with `FixedPrice = 0` | `ServiceManagementTools.cs:309-365` |
| P0-6 | stop/resume are anonymous with **no limit** → unbounded SQL writes + alert sends from one link | `AuthController.cs:1149,1175` |
| P0-7 | a setup session can **manufacture marketing consent** (`UpdateProfileDto.ReceiveMarketingEmails` defaults true) | `UserProfileController.cs:161,262` |
| P0-8 | the claim/stop footer is appended to **one-time-code and security emails** | `AzureCommunicationServicesEmailService.cs:218` |
| P0-9 | the 60-day token travels in a **GET query string** | `PreparedProfileController.cs:80` |
| P0-10 | prepared accounts are marked `EmailConfirmed`/`PhoneNumberConfirmed` with **no proof**, taking the unique proven-phone slot | `AdminProviderProvisioningService.cs:172` |
| P0-11 | **data loss**: the AI writer's `Normalize` deletes the provider's visit fee, travel rate, floor and discount when a re-read finds no price | `ProviderSetupServiceWriter.cs:334`, `formUtils.js:170` |

## P1 — plan deliverables never built

| id | what | where |
|---|---|---|
| P1-1 | **A3**: the Settings menu still says "Change password" in **3 of 4** apps | provider phone, customer web (×3 sites), customer phone |
| P1-2 | **§4.3-17**: neither customer app handles the `prepared_profile_sign_in` 409 | `clinqetwebuserapp`, `clinqetmobileuserapp` |
| P1-3 | **§4.3-9 / §8-1**: customer web's phone-sign-in resend still calls the two-step endpoint | `verifyLoginPhoneForm.jsx:59` |
| P1-4 | **§4.3-12**: "No password yet? Sign in with a code" absent from both customer apps | |
| P1-5 | **S9**: the admin IP allow-list still protects `/api/v1.0/admin`, which matches no route | `AdminIpWhitelistMiddleware.cs:37`, identity `appsettings.json:690` |
| P1-6 | **§8-10**: the reset email-code screen redirects to itself in **both** web apps | `verifyForgotEmailForm.jsx` ×2 |
| P1-7 | **§6-4**: no `List-Unsubscribe` / `List-Unsubscribe-Post` header | `AzureCommunicationServicesEmailService` |
| P1-8 | **§8-8**: provider web shows no success message after a password reset | `createNewPasswordForm.jsx:49` |
| P1-9 | **§8-12**: the provider phone code screen says "Phone" for an emailed code | `LoginOTPScreen/index.tsx:231` |
| P1-10 | **§8-7**: seven customer-web settings `layout.js` titles hardcode English | |
| P1-11 | **§8-11**: customer phone forgot step 1 still has an empty `catch {}` | |
| P1-12 | **§8-2**: customer phone never collects `ReceiveMarketingEmails`, so it is always false | `RegisterScreen/index.tsx:153` |
| P1-13 | **C5 bulk upload**: both bulk UIs still demand a cost | provider web + provider phone |
| P1-14 | **4.4-d**: the admin **phone** online-booking switch is not locked | `StepBusinessDetails.tsx:490` |
| P1-15 | **C6**: customer web shows no Call in the booking-on + price-less branch | `ServiceDetailModal.jsx:528` |
| P1-16 | **C9**: provider phone still claims price-less services "won't appear in search results" | `Locales/*.json` `SUMMARY_NO_PRICE_TEXT` |
| P1-17 | **S10**: admin phone still says 20 hourly slots (its own service says 40) | `ProviderAccountsScreen.tsx:83,114` |
| P1-18 | **4.3-21**: the landline hint is only on the correct-contact surfaces, not the creation forms | admin web + admin phone |
| P1-19 | **§8-6a/6c/6d**: three stale comments/skills named in the plan are untouched | identity-api SKILL ×4, `Cosmos.cs:39`, `AdminTenancyLookupController.cs:15` |
| P1-20 | **deploy.ps1**: `PreparedProvider__SigningKey` missing from `RequiredFunctionAppSettings` — and Functions is the host that SIGNS | |
| P1-21 | **§19**: none of the four alerts carries the business name / `BusinessId` / business phone / deep link | |
| P1-22 | **C3**: `ProviderScoreCalculator.HasPrice` is still a second rule, and both indexers use it | `ProviderScoreCalculator.cs:205` |
| P1-23 | **skills ×4**: 14 named skills untouched; the new skill row went into `.cursor` only | |
| P1-24 | **§11**: no Main API integration test, no Functions test for the channel rule / footer / alerts | |

## P2 — correctness and cost

| id | what |
|---|---|
| P2-1 | "not mine" leaves `EmailsStopped` false → the stop form redraws and a **second** High alert fires |
| P2-2 | the cart removal notice repeats on every read |
| P2-3 | the C14 migration aborts on a service with no `pricing` node |
| P2-4 | the zero-price refusal rounds in USD regardless of the service's currency |
| P2-5 | three definitions of "awaits the owner's price" (`BookingPriceDisplay`, `QuestPdfService`, `QuoteEmailProcessor`) |
| P2-6 | `RefusedPrice` reads `dto.PriceType` while the mapper falls back to the stored one |
| P2-7 | the waiting-customer alert is behind `isFirstAttempt` → lost on any first-attempt abandon |
| P2-8 | `contextId ?? …` does not handle `""`, the field's default → one EventId for all four kinds |
| P2-9 | no `ClaimedAt` backfill for a pre-existing admin-provisioned account already in use |
| P2-10 | `Forget` is per-instance → 5 minutes of suppressed SMS/WhatsApp after a take-over |
| P2-11 | `SessionKey()` falls back to `TraceIdentifier`, so the double-tap guard does not exist |
| P2-12 | the dispatcher's prepared-account read runs on every dispatch, customers included |
| P2-13 | `TakeOverAsync` runs a query on 100% of sign-ins |
| P2-14 | the claim page uses `GetClientIpAddress()`, not the `/64`-collapsing `GetRateLimitClientIp()` |
| P2-15 | the same `Users` row is read twice per claim-page load |
| P2-16 | every service document is materialised to `.Take(3)`; the unread count filters an unindexed field |
| P2-17 | `ServicesShown`/`ReadsPerWindow`/`ReadWindow` hardcoded; the counter is not atomic |
| P2-18 | `EmailShell` replaces the footer placeholder globally while the prefs block is first-index only |
| P2-19 | the MCP host registers `IEmailService` but not the footer |
| P2-20 | dead branch in `clinqetwebuserapp/utils/servicePrice.js` `resolvePriceType` |
| P2-21 | dead `LinkLifetimeDays > 0 ? … : 60` behind `ValidateOnStart` |
| P2-22 | no `AdminAlertType`→label parity test in either admin app |
| P2-23 | PLAN §9 has no §0.20-shaped mockup register |
| P2-24 | C10's two-segment search: `size: depth - hits.Count` mixes a business count with a row budget |

---

# Closed (2026-10-06, after the audit)

## P0 — every one fixed

| id | fix |
|---|---|
| P0-1 | `MayEnterAsAsync` now gates the phone-only reset sign-in; the app's own type is granted like every sibling path |
| P0-2 | `NotificationHub.OnConnectedAsync` aborts a setup session — a hub is not an MVC action, so the filter never ran there |
| P0-3/4 | The link SIGNS the address it was sent to (v2 payload + keyed fingerprint); the destructive action refuses unless it still matches; `CorrectContactAsync` syncs `BusinessProfile.Email`/phone and rotates the security stamp |
| P0-5 | `ServiceManagementTools` runs `Normalize` + `Validate`; `price: 0` is refused and an on-request row keeps no amount |
| P0-6 | stop/resume take a per-caller hourly budget (`PreparedProvider:StopResumeWritesPerHour`) |
| P0-7 | a setup session cannot change the marketing consent — it is pinned to the stored value |
| P0-8 | the footer is registered in Functions only; the Identity and voice hosts (which send codes) never carry it, by construction |
| P0-9 | the token travels in `X-Prepared-Token`, and the page strips it from the address bar after the first read |
| P0-10 | the confirmations stay — rows 8/10/11 need them — with the reason written where they are set; the real hole was the branch ORDER (SEC-12), now fixed |
| P0-11 | `Normalize` keeps the provider's typed visit/travel/discount figures and only switches them OFF |

## Also closed

RUN-1 · RUN-3 · RUN-6 · RUN-7 · RUN-8 · RUN-9 · RUN-10 · RUN-11 · RUN-12 · RUN-13 · RUN-16(documented) ·
RUN-17 · RUN-19 · RUN-20 · RUN-24 · SEC-3 · SEC-5 · SEC-10 (attribute restricted to methods, so the
compiler enforces what the pin can see) · SEC-11 · SEC-12 · SEC-13 · SEC-14 · C3 (the ranking regression) ·
C5 (web pill + phone form + both bulk UIs) · C6 (Call beside Ask) · C9 · S9 · S10 · §8-8 · §8-10 · §8-11 ·
§8-12 · §19 (all four alerts carry the business id, name, phone and admin link) · A1 (possessive) ·
A3 (localized facet chips) · A4 · A5 (orphan key removed) · B1 · B2 · B3 · C1–C8 (claim/stop states) ·
D1 · D2 · D3 · D4 · D5 · 4.3-21 · 4.4-d · the three stale comments · the per-host appsettings orphans ·
`SetupSessionArea` converter · deploy.ps1 Functions manifest · the cosmosindexsetup SQL guard · the
migration's missing-pricing crash.

## Deliberately NOT built, with the reason

- **§8-2 "their marketing choice applies"** — the customer **web** also sends `receiveMarketingEmails: false`
  and never asks. Adding a marketing opt-in to registration is a new step nobody asked for (§24.2), and
  opting out by default is the privacy-preserving answer. The payload bug IS fixed; the default is now
  commented as deliberate in both apps. **Owner decision if a checkbox is wanted.**
- **Three of the four new alerts cannot push** — `AdminPushSettings:MinimumSeverity` is `High` in all three
  hosts and is consulted before `PushableTypes`. Raising the severities would spam; lowering the floor affects
  every alert. **Owner decision.**

---

# The sandbox data migration — APPLIED, then re-verification blocked

`cosmosindexsetup --all-regions --migrate-prepared-providers --apply` **ran successfully earlier on
2026-10-06**: CA released 10 parked services as "On request" and cleared 1 admin-set password; IN released 43
and cleared 6. A re-run reported **0 / 0** in both regions, which is what idempotent looks like. The SQL
migration `20261006041846_AddUserProfileClaimedAt` shows no "(Pending)" in CA or IN.

**A later re-verification could not connect.** Azure SQL error **40615**:

```
Cannot open server 'clinket-ca-nonprod' requested by the login.
Client with IP address '142.189.191.21' is not allowed to access the server.
```

That is the dev machine's **new public IP** after its connection dropped and came back — a firewall rule, not
a code fault. ‼️ Note what it also proves: the run now REQUIRES SQL, because
`--migrate-prepared-providers` was removed from the `RequiresSql` exemption list (it writes SQL, so it must be
subject to the "both regions are not the same database" guard). `ModesThatWriteSqlAreNotExemptFromTheSharedDatabaseGuard`
pins that.

**To re-verify:** allow `142.189.191.21` on `clinket-ca-nonprod` and the IN server, then re-run the dry form
(no `--apply`) and expect **0 / 0** in both regions.

---

# Re-audit of the fixes (2026-10-06) — 4 defects IN THE FIXES, all closed

An independent reviewer re-read each fix. Six of ten areas were clean (the v2 link protector, the take-over
service, the hub guard, the auth ordering, the price rules and their readers, the claim-page controller, the
money refusals). Four defects, all now fixed and pinned:

| id | what the FIX got wrong | fix |
|---|---|---|
| **D3** (Med-High) | My own optimisation. I skipped the prepared-account lookup for `RecipientType.Customer` on the grounds that "only a provider can be one". **False** — a prepared account is created `IsSystemGenerated = false`, and `CustomerIdentityService` matches on email or phone across all users and PREFERS a non-system profile, so another provider adding that business to their CRM makes the Cosmos `Customer` row point at it. §6 was then skipped entirely: SMS and WhatsApp went to the team-entered number and a "Stop emails" already pressed was ignored | the lookup runs for EVERY recipient; the directory already caches both answers 5 min at `Size = 1`. Two new tests prove the exact scenario |
| **D2** (Med) | The new stop/resume budget keyed on the FULL IP, so an IPv6 caller rotates the low 64 bits and it bounds nothing — the same mistake as P2-14, inside the same fix set | `GetRateLimitClientIp()` added to the Identity `BaseController`, mirroring the API one |
| **D4** (Med) | `update_service`'s zero-price refusal tells the assistant to send `priceType: "on request"` with no price — and the pairing guard then REFUSED it. The model was sent round a loop it could not leave, and neither tool documented the value | `priceType` alone is accepted when it means on-request, and both descriptions now name it |
| **D1** (Low-Med) | A repeat press of either stop button raised a FRESH alert (the EventId dedupes only within one calendar day), and for "not mine" the second alert's text said *"nothing was removed, because the contact is not the one that link was sent to"* — the opposite of what happened, caused by that very link, at High severity | each alert fires only when something CHANGED; a repeat press says nothing. 13 new tests, the address binding sabotage-proven |

Also corrected: the stale `MemoryCacheSizeConventionTests` comment claiming an Identity convention test that does
not exist (Identity deliberately has no `SizeLimit`); the stale `HasPrice_…AndRejectsQuoteOnly` test name, now
extended to pin the minimum-charge and on-request cases; the stale `ApplyPricing` comment; and a note on
`DetachEverythingThisTouches` about the latent hazard for a future caller holding unsaved edits.

## Alert severities — FINAL (owner-set 2026-10-06)

All four reach a phone, because `AdminPushSettings:MinimumSeverity` is High and is read BEFORE `PushableTypes`:

| alert | severity |
|---|---|
| `PreparedProviderWrongContact` | High |
| `PreparedProviderCustomerWaiting` | High |
| `PreparedProviderEmailsStopped` | High |
| `ProviderAccountTakenOver` — **name differs** | High |
| `ProviderAccountTakenOver` — expected | Low — every provider claiming their own business fires this, and buzzing for each is how a real "check this" gets ignored |
