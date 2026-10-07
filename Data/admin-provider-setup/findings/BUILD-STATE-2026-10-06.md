# Admin provider setup — build state (session working file; delete before reporting done)

All 7 backend projects built with 0 errors before the app phase. No scratch file left in any repo.

## DONE (backend)
Phases 1–4 of the plan: shared/core/SQL (incl. the APPLIED `ClaimedAt` migration), Identity (take-over on
6 paths, register rules, collisions, correct-contact, phone-only forgot, S2/S3/S4/S8, stop/resume, prepared
endpoints), Main API (S1 default-deny filter + 34 marks, S6 notice, online-booking lock, price rules, C10),
Functions/MCP/AI (writer, prompt, alerts, channel rule, email footer, receptionist, Insights bug), C8 (no $0
in any document), C11/C12 server side, 41 API localization keys x5.

## DONE (apps)
- **Customer web**: price-on-request layer, Ask for price, chat draft, cart removed notice, offer band rule,
  modal/service-page actions, landing claim retired. 184 suites / 2703 tests PASS. ESLint clean.
- **Provider web**: No price yet pill + nudge + zero-price refusal, stored→form price type fix (C13),
  Price on request + Add a price in the services list, booking "To be confirmed", resend-code fix,
  "No password yet? Sign in with a code", prepared-profile register stop screen, phone-only signed-in screen,
  Set password menu, /claim + /stop-emails public pages (every state) + noindex + robots. ESLint clean.
- **Admin web**: No price yet + zero refused + stored→form fix, Price on request in the list, provider status
  (Waiting / Taken over on), Correct email/phone dialog, S10 banner wording, locked online-booking switch,
  S6 Finish dialog on both exit paths. 84 suites / 1302 tests PASS (react-scripts). ESLint clean.
- **Customer phone**: On request price type + Ask for price + note + chat draft + cart removed items + offer
  band rule + haptics; AppType/Platform/marketing fix at registration; resend-code fix. 174 suites / 2357 PASS.
- **Provider phone**: SignupExperience sent, resend split (two-step vs code sign-in, same stamp),
  prepared-profile register stop screen, "No password yet" line, activity key. Suite re-running.
- **Admin phone**: server-side session revoke (S7) + setup-notice call + ClaimedAt on the session.
- **azureautomation**: `PreparedProvider__SigningKey` — Key Vault secret (create-if-not-exists, never rotated),
  wired to API + Identity + Functions, in all three Required*AppSettings manifests, new -PreparedProviderSigningKey
  parameter. `deploy.ps1` parses.

## PENDING
1. Admin phone UI: status + Correct contact sheet + setup banner + Exit sheet + No price yet.
2. Provider phone: price pills/pill/long-press/pull-to-refresh; customer phone: cart notice UI, Set Password menu,
   forgot step-1 errors.
3. Remaining §8 copy: customer web hard-coded English, provider web reset success, Gujarati "??", reset
   email-code redirect.
4. Backend tests (Identity unit + real-SQL integration, Main API integration + S1 convention test, Functions, MCP).
5. Sandbox data (C14 un-park 53, A4 clear admin passwords).
6. Skills x4 + memory.
7. §14 multidimensional audit → fix every finding → re-audit.
8. Migration both regions (`cosmosindexsetup -- --all-regions --sql-only`), then commit + push all repos,
   `clinqetapi` LAST.

## Backend test state (2026-10-06)
- All 4 solutions BUILD with 0 errors (test projects included).
- Identity unit: 1347 PASS. API unit: 16176 PASS (after the fixes below). Functions unit: 9672 PASS.
  MCP unit: 1487 PASS.
- Real defects the existing suites caught and that are now FIXED:
  1. `ServiceController.RefusedPrice<T>` returned a ternary whose null branch converted through
     `ActionResult<T>.op_Implicit` → **ArgumentNullException on every PRICED service** (create and update).
  2. `SetupSessionController.SendUpdateNotice` had a plain `catch (Exception ex)` (L94) and no in-action
     permission gate on a shared endpoint. Both fixed; the comment moved inside the catch so the brace-walking
     scanner can see it.
  3. `NotificationType.ProfileUpdatedByClinketTeam` was absent from the echo catalog and duplicated in the
     routing catalog (a duplicate dictionary key throws at type init). Both fixed + both test registries.
- Tests whose EXPECTATION was the old behaviour and now assert the new rule (each with the reason in the code):
  S4 (no user type on a failed/locked password), §4.4 (a phone on any ACTIVE account is taken), A1 (no Password
  field on the admin DTO) + A2 (marketing off), the generic 429 on password-reset code checks, C4 (a price-less
  AI-extracted service goes live as On request, only a missing category parks), C8 (an unlisted booking line
  carries PriceTypes.OnRequest, never an empty type).

## Sandbox data (C14 + A4) — APPLIED 2026-10-06
`cosmosindexsetup --all-regions --migrate-prepared-providers [--apply]` (new one-shot, idempotent,
partition-scoped). Dry run matched the plan's figures exactly, then applied:
- CA: 10 parked services released as "On request", 1 admin-set password cleared.
- IN: 43 parked services released as "On request", 6 admin-set passwords cleared.
- Re-run dry: 0 / 0 in both regions — idempotent.
SQL migration `20261006041846_AddUserProfileClaimedAt` listed with no "(Pending)" in CA and IN;
`--all-regions --sql-only` reports 0 pending in both.

## Apps green (2026-10-06)
customer web 184/2703 · provider web 458/6357 · admin web 84/1302 · customer phone 174/2357 ·
provider phone 477/7870 · admin phone 33/577. Every one ESLint/tsc clean on the files touched.

## New tests written
- Identity unit: `PreparedProviderLinkProtectorTests` (24) — forged, re-pointed, spliced, expired,
  stretched-expiry, wrong-key, unknown-version, short-key, no-key.
- Identity unit: `SetupSessionAllowListTests` (15) — the exempt set pinned + the account's own security
  endpoints named one by one.
- Identity integration (REAL SQL): `ProviderTakeoverIntegrationTests` (13) — including the concurrent
  take-over race, consent, external logins, two-step, security stamp.
- API unit: `SetupSessionAllowListTests` (9) — allow-list pinned, money/customer/message controllers named.
  SABOTAGE-CHECKED: marking InvoiceController.GetInvoices failed 2 tests; reverted and re-proved green.
- API unit: `ServicePricingRulesTests` (33) — C2/C3/C12 and the C8 booking-display rule.
