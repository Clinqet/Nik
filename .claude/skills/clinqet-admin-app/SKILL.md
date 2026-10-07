---
description: |
  **FRONTEND SKILL** — Work on the Clinqet Admin Web App (React 18, Create React App, Express server, Tailwind CSS). USE FOR: creating/modifying admin dashboard pages, country management, category management, content management, alert monitoring, admin analytics, platform health monitoring. Applies to ALL files in clinqetwebadmin/.
---

# CLINQET ADMIN APP — COMPREHENSIVE SKILL

## RECENT CHANGES — 2026-10-06 (preparing a provider account, and the 60-minute setup session)

See the `clinqet-prepared-providers` skill for the whole feature. What changed HERE:

- **No password field.** Creating a provider account never sets one; the provider sets it themselves later.
- **The list says where each account stands** — "Waiting for provider" or "Taken over on <date>" — from `claimedAt` on the lookup.
- **"Correct email / phone"** is the ONE recovery when the owner never got our message. It is refused the moment they are in, so the dialog only appears while `claimedAt` is null, and nothing is sent to them.
- ‼️ **The landline hint belongs on the CREATE form, not only the correct-contact dialog.** Every way in is a code, and a code to a landline never arrives — say it where the number is typed.
- **The online-booking switch is LOCKED until the owner signs in** ("Turns on when {name} signs in."), in the admin WEB and the admin PHONE. The server refuses to turn it on, so an unlocked switch loses the whole form's save to an error about somebody signing in.
- **The Exit/Done box** is the only thing a setup session may send the provider: one notice, ticked by default, with optional area ticks. ‼️ Its preview must say exactly what the server sends — it names the PROFILE and drops the "and" before "and more".
- **Exiting revokes the session server-side** on every exit path, in both admin apps.
- **Services with no price** show "Price on request" and offer "No price yet"; a typed 0 is refused.
## ABSOLUTE RULES (READ FIRST — APPLIES TO EVERY CHANGE)

- **Comments — terse, only when they earn their place.** Default to no comments; let naming carry the meaning. **However**, write a comment when it captures non-obvious context the code itself cannot show: a hidden invariant, a subtle ordering constraint, a deliberate workaround for a known bug, a defensive choice with a real reason, or an RFC/spec citation that explains *why*. Prefer a single short line. Forbidden: restating WHAT the code does (e.g. `// increment counter` above `counter++`); multi-line narrative blocks explaining design rationale; XML doc summaries on properties whose names already convey intent; commented-out code; `// TODO` without an issue link. When in doubt, delete the comment — but don't strip a *real* WHY-comment just to chase zero.
- **No verbose docstrings on self-evident members.** A property named ``EnableAISpellCorrection`` does NOT need a doc summary. A field named ``_searchEnableAISpellCorrection`` does NOT need a multi-line ``//`` block above it. Trust naming.
- **No commented-out code, no leftover symbols, no ``// TODO`` without an issue link.**

---


## OVERVIEW

The Admin App is a React 18 single-page application served by an Express.js server. It provides internal admin tools for managing the Clinqet platform: bookings, quotes, services, categories, countries, content, and platform health.

- **Path**: `C:\Nik\clinqetwebadmin\`
- **Framework**: React 18.3 | Create React App (CRA)
- **Server**: Express.js (port 8080) with SPA routing + smart caching
- **Styling**: Tailwind CSS with Clinqet brand colors
- **State Management**: React Context API (no Redux)
- **HTTP Client**: Axios (two instances: Identity API + Main API)
- **Animations**: Framer Motion
- **Auth**: JWT with token refresh interceptor

---

## PROJECT STRUCTURE

```
clinqetwebadmin/
├── server/                # Express host: server.js (serves ONLY build/, helmet + CSP) — Linux App Service, no web.config
├── package.json           # Dependencies & scripts
├── tailwind.config.js     # Tailwind theme (brand colors: #032858 primary, #97EF29 accent)
├── public/                # Static assets
├── build/                 # Production build output
└── src/
    ├── pages/             # Page components (Dashboard, Categories, Countries, Content, Alerts)
    ├── components/        # Reusable components
    ├── context/           # React Context providers (ThemeContext with dark/light mode)
    ├── services/          # API service layer
    ├── utils/             # Utility functions
    └── assets/            # Static images/icons
```

---

## SERVER CONFIGURATION (server.js)

Express.js server with:
- SPA routing: All non-static requests → `index.html`
- Smart caching: Static assets get `max-age=1y, immutable`; HTML gets `no-cache` for instant deploy updates
- Port: 8080 (configurable via `PORT` env var)
- Health check endpoint for Azure App Service

---

## API INTEGRATION

### Two Axios Instances

```javascript
// authApi — Identity API (auth endpoints)
const authApi = axios.create({
    baseURL: process.env.REACT_APP_IDENTITY_API_URL + '/api/v1',
    headers: { 'Content-Type': 'application/json' }
});

// backendApi — Main API (business data endpoints)
const backendApi = axios.create({
    baseURL: process.env.REACT_APP_API_URL + '/api/v1.0',
    headers: { 'Content-Type': 'application/json' }
});
```

### Interceptors
- **Request**: Attaches JWT Bearer token, observability headers
- **Response**: Token refresh on 401 (same pattern as Partner/User apps)

### Environment Variables
```
REACT_APP_IDENTITY_API_URL    # Identity API base URL
REACT_APP_API_URL             # Main API base URL
```

---

## STATE MANAGEMENT: CONTEXT API

### ThemeContext
- Dark/light mode toggle
- Persisted to localStorage
- Provides: `theme`, `toggleTheme()`

### Auth State
- Access token in page memory only (`src/utils/session.js`); the session is the HttpOnly
  `__Host-ClinketSession-Admin` cookie on Identity, renewed with `POST auth/session/renew` — see
  `clinqet-auth-sessions` and the SESSION section below
- Two-step sign-in code step (`pages/auth/SignInCodeStep.jsx`); admin role validated on login

---

## COMPONENT PATTERNS

### Styling: Tailwind CSS
- Brand colors: `#032858` (primary/dark blue), `#97EF29` (accent/green)
- Responsive design with standard breakpoints
- Dark mode support via ThemeContext
- Framer Motion for page transitions and animations

### Page Pattern
```jsx
import { motion } from 'framer-motion';

const AdminPage = () => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchData();
    }, []);

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="p-6"
        >
            {loading ? <Loader /> : <DataTable data={data} />}
        </motion.div>
    );
};
```

### Error Handling
- Toast notifications for success/error messages
- Error boundary for unhandled React errors
- API error extraction from response envelope

---

## ADMIN-SPECIFIC FEATURES

### Category Management
- CRUD operations for 300+ categories/subcategories
- Tree view of parent → child category hierarchy
- Category icon/image management

### Country Management
- Enable/disable countries for service availability
- Country-specific settings

### Content Management
- Static content (FAQs, help center, policies)
- Email template preview

### Alert Monitoring
- Admin alerts from Service Bus
- Priority levels: High, Medium, Low
- Alert resolution tracking

### Dashboard
- Platform-wide statistics
- Active bookings, quotes, services count
- Revenue analytics
- Health status overview

---

## TAILWIND THEME

```javascript
// tailwind.config.js
module.exports = {
    content: ["./src/**/*.{js,jsx,ts,tsx}"],
    theme: {
        extend: {
            colors: {
                primary: '#032858',    // Dark blue
                accent: '#97EF29',     // Green
                // Additional brand colors
            }
        }
    }
};
```

---

## SCRIPTS

```bash
npm run start          # Development server (CRA default)
npm run build          # Production build
npm run test           # Run tests
node server.js         # Start Express server (production)
```

---

## KEY DIFFERENCES FROM PARTNER/USER APPS

| Aspect | Admin App | Partner/User Apps |
|--------|-----------|-------------------|
| Framework | CRA (React 18) | Next.js 16 (React 19) |
| Server | Express.js | Next.js built-in |
| Routing | Client-side (React Router) | File-based (App Router) |
| State | Context API | Redux Toolkit |
| i18n | Minimal/none (internal app) | react-intl (4 languages) |
| SEO | Not applicable (internal) | Full SEO (public-facing) |
| Auth | Admin role required | Provider/Customer roles |

---

## CHECKLIST BEFORE SUBMITTING ADMIN APP CHANGES

- [ ] Admin role authorization enforced on all endpoints called
- [ ] Tailwind CSS styling matches existing design system
- [ ] Framer Motion transitions consistent with existing pages
- [ ] Two Axios instances used correctly (authApi vs backendApi)
- [ ] Error/loading states handled
- [ ] Dark/light mode themes work correctly
- [ ] Build succeeds (`npm run build`)
- [ ] No console.log or debug code left
- [ ] Internal-only — no SEO or public localization needed
- [ ] Admin alert wording can be hardcoded (internal only)

## Provider Payments (Phase 3-UI, Flow-B oversight)
`pages/dashboard/ProviderPaymentsPage.jsx` (route `/provider-payments`): per-provider tax view/override/lock (GET/PUT `admin/billing-config/providers/{id}/tax`) + read-only refunds/disputes (`admin/billing-config/refunds-disputes`), via `services/billingConfigService.js`. Hardcoded EN. **Wraps `<AdminLayout>` like every other admin page — do NOT drop it (that was the missing-sidebar bug).** Tax lookup is a 3-mode segmented toggle **Business ID | Phone | Email** (the Number tab was removed 2026-07-24: a provider's `BusinessId` IS the SQL `UserNumber`, so Number duplicated Business ID with an extra identity call — never re-add it): Business ID = direct point-read (0 identity hop); Phone/Email resolve via the cached `admin/users/lookup` (`lookupUser` from `services/userSupportService.js`) → `userNumber`, which **IS** the provider's `businessId` (`BusinessProfile.Id == BusinessId == SQL UserNumber`), then the same tax point-read — no new endpoint, no user→business Cosmos query. 404 after a resolve ⇒ "not a provider / setup incomplete"; 404 without a resolve ⇒ "no user found". See the `clinqet-payments` skill §Phase 3-UI. `pages/payments/ProviderPayoutsPage.jsx` (route `/provider-payouts`, sidebar "Provider Payouts"; renamed end-to-end from the old Provider Onboarding payout page 2026-07-24, no aliases) is the payout-accounts page with the IDENTICAL 3-mode lookup against `AdminProviderPayoutsController` (`admin/provider-payouts/{businessId}`; Business ID mode = exactly ONE backend call). Its GET contract: 200 + dto ⇒ payout account; 200 + null data ⇒ business exists (SQL `Users.UserNumber` probe with `IgnoreQueryFilters` so inactive users still resolve) but has no payout account — the page shows the "has no payout account" banner; 404 ⇒ genuinely unknown businessId. Default mode is Business ID (keeps the existing jest tests green).


**Region, currency + engine sources (2026-10-05):** region names come from `src/utils/useRegionNames.js` (country lookup `getCountries`; the code shows until it loads) and served regions + each region's canonical currency from `src/utils/useServedRegions.js` (`getServedRegions` → `{ regions, currencies }`, read from the API's `regionCurrencies` map — field name pending backend confirmation); both are cached once per browser session in `src/utils/sessionCache.js`, never cache a failure, and Retry asks again. `src/utils/useSelectedRegion.js` keeps the chosen region while it is served. Billing Configuration, Provider Payments, Provider Ledger, Voice Settings and every Offers page (via `OffersShell regionState`) show a served-region failure as an error with Retry, an empty region list as a notice, and a country-name failure as an error with Retry. The region currency is the canonical one, with the plan rows only as the fallback while the API omits it; Billing Configuration derives its catalogue (currency + live AI engines) from its own plans and add-ons, and the Offers pages from `useOfferCatalog(region, canonicalCurrency)`. No hard-coded region, currency or engine list, and no guessed USD (`formatMinor` and `money` show a bare amount when the currency is unknown).

## Billing revenue-at-risk alert types (Part 3, 2026-06-29)

4 new `AdminAlertType`s render in the Alerts page filter dropdown (`src/pages/alerts/AlertsPage.jsx` → `alertTypes`, mirrors the enum order): `BillingTrialEndingNoCard`, `BillingTrialLapsed`, `BillingPaymentFailed`, `BillingPaymentMethodMissing`. Raised (internal English, severity Medium, deduped once per provider per billing cycle) by `BillingNotificationService` for at-risk Flow-A scenarios so an admin can reach out and win the provider back. Colour/icon are severity-driven (no per-type map), so no extra UI wiring beyond the filter list.

- **Alerts filter types (2026-07-12):** `AlertsPage.jsx` gained `LeadQuotaReached`, `WhatsAppPlanBlocked`, `AiMinutesExhausted` (tier-limit conversion alerts; metadata carries phone/email/tier/adminLink) plus the previously-missing `ContentReported` and `FriendlyNameProjectionFailure`.

## Admin read-path paging — Alerts + Login Attempts (2026-07-24)

Both admin feeds read shared production Cosmos, so neither is allowed to pull an unbounded result set.

### Alerts — keyset paging over month partitions
`GET /admin/alerts` returns `AdminAlertPageDto` (`{ items, continuationToken, hasMore, pageSize, startDate, endDate }`), **not an array**. Every filter (`alertType`, `severity`, `isRead`, `isResolved`, date range) is pushed into the Cosmos SQL — the controller no longer filters in memory.

`AdminAlertRepository.GetAlertsPagedAsync(AdminAlertQuery)` walks the window's `yyyy-MM` partitions **newest-first, one at a time**, stopping as soon as the page is full, and skips any month whose first instant is newer than the cursor. RU therefore scales with page size, not with how many alerts the window holds. Cursor = base64(`createdAt`|`id`); SQL is `SELECT TOP n … ORDER BY c.type, c.createdAt DESC, c.id DESC`, bound to the `(type, createdAt DESC, id DESC)` composite in `CosmosContainerPolicies.SystemData` (`/isResolved` is in `IncludedPaths` for the same reason).

**Partition invariant:** `AlertDate` (the pk) is ALWAYS derived from `CreatedAt` inside `CreateAlertAsync`. A caller-supplied `CreatedAt` is honoured (`AdminAlertProcessor` passes `message.AlertTimestamp`), so an alert delayed across a month boundary still files — and reads back — under the month it actually happened in. Never set `AlertDate` independently of `CreatedAt`.

Settings: `AdminAlerts` → `DefaultWindowDays` 7, `MaxWindowDays` 90 (matches the alert TTL; caps partition fan-out), `DefaultPageSize` 25, `MaxPageSize` 100, `AuditMaxRecordsPerType` 1000 (Identity host, admin-access audit walk). `GET /admin/alerts/unread` was **deleted** — it had no client and `isRead=false` covers it.

The three alert-backed work queues (`reviewService`, `serviceApprovalService`, `voiceAssistantService`) call `getAllAlerts`, which walks pages up to a cap and returns `{ items, truncated }`; their pages render an amber "showing the most recent N of a larger queue" banner rather than silently truncating. They pass an explicit 90-day `startDate` (`queueWindowStart()`) because a queue triages everything still open, not just the last week.

### Login Attempts — user-scoped by construction
`LoginAttempt.Pk IS the userId`, so a platform-wide sign-in feed would be a cross-partition query (§0.6, no override). The page therefore **requires a resolved user** (`admin/users/lookup` → userId) and then reads that one partition.

`GET /admin/login-attempts` returns `LoginAttemptPageDto` (`{ items, continuationToken, hasMore, pageSize, startDate, endDate }`). Its query contract is `userId`, `startDate`, `endDate`, `isSuccessful`, `pageSize`, and `continuationToken`; page numbers, `COUNT`, and `OFFSET` are not part of this admin path. The opaque cursor is base64(`attemptDate`|`id`), and the UI keeps prior cursors locally for Prev navigation. Any lookup or filter change resets that cursor stack.

Settings: `LoginAttempts` → `DefaultWindowDays` 30, `MaxWindowDays` 90, `DefaultPageSize` 25, `MaxPageSize` 100. Date range and outcome filters are pushed into the single-partition Cosmos query.

Do NOT add a global sign-in feed by dual-writing a day-bucketed doc or re-keying the container — the owner explicitly rejected both (2026-07-24). Platform-wide sign-in anomalies surface as `AccountLockout` / `MfaLockout` / `SuspiciousPasskeyAuthentication` admin alerts on the Alerts page instead.

### Shared UI contract (both pages)
Range presets (24h / 7d / 30d [/ 90d] / Custom) + page-size selector (25/50/100) + Prev/Next. Requests are `AbortController`-cancelled when filters change so a superseded response can never overwrite fresher state, and the page-reset effect bails out when nothing changed so first paint issues exactly one request. Refresh re-anchors "now" (a frozen end date would hide everything raised since load). The pager stays mounted and disabled while a page is in flight. Sidebar order: **Alerts sits directly under Dashboard.**

## Provider Trust & Safety page (Phase 4B, 2026-07-28) — `/provider-trust`

`src/pages/providers/ProviderTrustPage.jsx` + `src/services/providerTrustService.js`. Sidebar entry
**"Provider Trust"** (`FiAward`) sits just above Account Support, with the trust/safety group.

- **Lookup via `BusinessLookupField`** (one box, any handle) + a directly-editable Business ID field.
  ‼️ **The old segmented `ID_TYPES` tabs are GONE** — see "THE USERNUMBER-IS-NOT-A-BUSINESSID FIX" below.
- ‼️ **There is deliberately NO provider list.** Providers are partitioned by businessId, so paging
  all of them is a cross-partition query. The empty state says so rather than showing a blank table.
- ‼️ **The TRUE outstanding count and the capped sample are different reads.** The tile shows the count;
  the table says "first 50 of N". Showing the array length as the total would understate the blast radius.
- **Suspension** requires a dropdown reason (fixed + translated), an optional internal note (audit and
  admin alert ONLY — never sent to a customer), an admin-chosen 30–90 day retention window, and an
  explicit acknowledgement. ‼️ **The server refuses without the acknowledgement** — the UI gate is a
  convenience, never the authority.
- ‼️ **Every mutation is ONE call** — the endpoints answer with the refreshed state, so a write is never
  followed by a read.
- **Promo screen:** `ShowInBanner` is a toggle on the existing promo modal (Customer audience only) plus
  a "Banner" chip in the Active column — no ninth table column, so the table cannot overflow.

### Verified business — added session 16 (2026-07-29)

A second card on the same Provider Trust page, above the Clinket badge card.

- ‼️ **Verification is ADMIN-GRANTED, never a plan benefit.** Until this session the backend stamped
  `isVerified` from the **paid** `badge` entitlement and **no admin screen could verify anyone**. The
  card exists because that was corrected — see the search-discovery skill and master plan 17 → 16.2.
- **Granting requires an attestation checkbox** (registration, identity, licence/insurance). ‼️ **The
  server enforces it too** (`checksAttested`) — the checkbox is a convenience, never the authority.
  **Revoking needs none**: there is nothing to attest to when removing a mark.
- ‼️ **The attestation is per-decision.** `applyState` clears it, so looking up a different provider can
  never inherit the previous tick.
- **One call per action** — `PUT /admin/providers/{id}/verified` answers with the refreshed state.
- ‼️ **Every grant AND revoke writes an IMMUTABLE 365-day admin alert**
  (`AdminAlertType.ProviderVerificationChanged`). It is in `IsImmutableAuditAlert` server-side, so the
  API **blocks deletion** and **re-pins the TTL when resolved** — resolving can never shorten the record.
  `AlertsPage.jsx` lists the type and hides its delete button via `IMMUTABLE_AUDIT_ALERT_TYPES`
  (renamed from `ADMIN_ACCESS_ALERT_TYPES` when verification joined the list).
- A **Verified pill** sits beside the status pill, and a **Verified tile** replaced the retention-window
  tile in the 4-up grid (the window is still shown inside the suspend modal, where the choice is made).

### Ranking scores card + override — F10 / D19 (2026-09-29)

`src/pages/providers/ProviderScoresCard.jsx`, rendered by `ProviderTrustPage` below the state cards (keyed on
`businessId`). Shared `formatDate` / `inputCls` moved to `providerTrustFormat.js`. What the numbers mean and how they
rank: `clinqet-smart-analytics` → "PROVIDER RANKING SCORES".

- **Endpoints** (`AdminProviderController`, `[Authorize(Roles = "Admin")]` — no finer permission; service
  `providerTrustService.js`): `GET /admin/providers/{id}/scores`, `PUT …/scores/override`
  (`AdminScoreOverrideUpsertDto` `{ response?, reliability?, acceptance?, reason, noExpiry, expiresInDays?, expected }`),
  `POST …/scores/override/clear` (`AdminScoreOverrideClearDto` `{ reason, expected }`). All three answer
  `AdminProviderScoresDto` (`clinqetshared/DTOs/Admin/AdminProviderDtos.cs`); 404 unknown business; a save equal to the
  stored override answers 200 (`ScoreOverrideResult.Unchanged`) and writes no audit; **409** when the stored override is
  not the one the admin was shown (`ScoreOverrideResult.Stale`, "Someone else changed this override after you opened
  it…") or on an ETag conflict after 3 attempts ("…being updated concurrently…"). Both are hardcoded English in the
  controller — admin-internal (§3.6), no localization key.
- ‼️ **Expected-version:** PUT and clear carry `expected` (`AdminScoreOverrideDto?`) = the `override` object GET returned,
  echoed by `seenOverride` (null = none seen). `ProviderScoreOverride.Same` compares the three scores, the reason
  (ordinal, untrimmed) and the expiry to the millisecond; `isLive` is output-only and ignored. Checked against the
  FIRST read of the save only, so a retry after a lost answer is not refused by its own write. On a 409 the card
  re-reads the scores, shows the colleague's override, and KEEPS the form (or the remove dialog) open with the admin's
  entries; the next save carries the fresh `expected`.
- ‼️ **Loaded independently of the state read** (`loadScores`, request-counter guard): a scores failure shows its own
  amber retry panel and never takes the page down, and a slow answer for the previous business never lands on the next.
- **Tiles:** Response, Reliability, Acceptance show the EFFECTIVE value + band, a plain hint, "Measured: …", the override
  (with an "expired" chip when not live) and one search line (`searchLine`). `AdminProviderScoresDto.inSearch`
  (`AdminProviderScoresService.ReadIndexedRowAsync`): true = a country provider index holds the business's
  `isPrimaryArea` row; false = EVERY provider index answered and none holds it; null = any index failed to read.
  `indexed` is null unless `inSearch` is true. `inSearch === false` ⇒ "Not in search results" (it will never catch
  up); `inSearch == null` ⇒ "Could not check search results just now"; otherwise "Search is catching up" only while
  `indexed ≠ effective`. Completeness is READ-ONLY (from the index;
  the business raises it) and its chip reads "Not in search results" when `inSearch === false`.
- ‼️ **Bands come from the API, never hardcoded:** each `AdminScoreDto` carries `penaltyStartsBelow` / `fullPenaltyAt` /
  `maxPenaltyPercent`, projected from `Search:Boost:{Response,Reliability,Acceptance}Penalty`. `scoreBand`: null ⇒ "Not
  enough activity yet — treated as a new business"; a RETIRED dial (`maxPenaltyPercent` 0, or start ≤ full) ⇒ not
  pushing down; ≥ start ⇒ not pushing down; ≤ full ⇒ "Pushing them down the most (up to N% lower)"; between ⇒ "Pushing
  them down". Acceptance's line says it can only push down (penalty-only).
- **Override form:** each score 0–100 whole number, blank = keep measured, at least one required; reason 3–500 chars
  AFTER trimming; expiry dropdown from `[30, 60, default, 180, max]` with the default clamped to the max
  (`defaultExpiryDays`), or an explicit **"No expiry"** checkbox. ONE prefill rule (`overridePrefill`, same in the admin
  mobile app): only a LIVE override pre-fills the scores. Server re-validates all of it — `[Range(0,100)]`, the trimmed
  reason (`AdminScoreOverrideReason`), "at least one", and 1…`MaxExpiryDays` days in the controller ONLY (the DTO has no
  range of its own). The override is a SET value that REPLACES the computed one for ranking while live; a new override
  replaces the old one whole. Settings `ProviderScoreOverride:DefaultExpiryDays` 90 / `MaxExpiryDays` 365 (Main API;
  class = appsettings; the API clamps the offered default to the max). Remove uses `NoteActionModal`.
- **Who / when is NOT on the screen:** the profile stores only the five flat §12.5 fields (`responseScoreOverride`,
  `reliabilityScoreOverride`, `acceptanceScoreOverride`, `overrideExpiresAt`, `overrideReason` — see
  `clinqet-cosmos-data`); the summary says "Who set it, and
  when, is on the Alerts page." (reading the audit alerts by business would be cross-partition — forbidden).
- ‼️ **Audit:** every set / change / clear, and every lapse (actor `system`, "on its own"), writes an
  `AdminAlertType.ProviderScoreOverrideChanged` alert (severity High) directly via the repository, with
  `CancellationToken.None`, a deterministic id `scoreoverride_{businessId}_{action}_{stampTicks}`, and a ttl of
  `DocumentTtl:ProviderScoreOverrideAuditTtlDays` = **183 days** (API + Functions appsettings; read through the const
  `ProviderScoreOverrideSettings.AuditTtlDaysKey` with the one code default, the const `DefaultAuditTtlDays` = 183 — not
  part of the bound `ProviderScoreOverride` section). It is in `IsImmutableAuditAlert` ⇒ delete blocked and the ttl
  re-pinned from creation on resolve AND on mark-read (`PinnedAuditTtlAsync`). `AlertsPage.jsx` lists the type,
  labels it "Ranking score override", and adds it to `IMMUTABLE_AUDIT_ALERT_TYPES`. ‼️ W13: an admin's change is
  recorded FIRST (after its end message is scheduled) — if either fails nothing is saved (`Unavailable` ⇒ 503); a change
  recorded and then not saved or not confirmed gets a second "not applied" / "not confirmed" record (a lapse is not
  cleared until its record is written). Lapses are cleared by the
  Functions app, not this screen — see `clinqet-notifications` → `ProviderScoreOverrideChanged`.
- Tests: `ProviderTrustPage.test.js`, `providerTrustService.test.js`, `NoteActionModal.test.js`, `AlertsPage.test.js`;
  backend `AdminProviderControllerTests`, `AdminProviderScoresServiceTests`, `ProviderScoreOverrideServiceTests`,
  `ProviderScoreOverrideIntegrationTests`.
- **Admin mobile (`clinqetmobileadminapp`, outside this skill's scope)** mirrors it: `ProviderScoresSection.tsx` in
  `ProviderTrustScreen`, rules in `src/utils/providerTrust.ts`. The same change fixed payloads that app had wrong:
  badge now sends a `ClinketBadge` value or null (it sent `'Verified'`/`'None'`), suspend sends the reason enum +
  `acknowledgedOutstandingBookings` only after an explicit acknowledgement, tenancy search goes to the Identity host
  with `q`, and user activity binds `Filter.UserId`. Same `expected` / 409 / `inSearch` / retired-band / clamped-default /
  live-only-prefill rules; `ProviderTrustScreen` lets only the newest lookup land (`latestOnly`), and `LookupScreen`
  picks the identifier by `lookupKeyFor` (a 5-character A-Z/0-9 code is a UserNumber even when all digits).


## 2026-07-30 — Phase-6 combining audit
- ‼️ **CRA Jest cannot resolve react-router-dom v7**: the package declares `main: ./dist/main.js` which DOES NOT EXIST, and jest-resolve ignores the `exports` map. Fixed via `package.json` → `jest.moduleNameMapper` for `react-router-dom` AND its `react-router/dom` subpath, plus a TextEncoder/TextDecoder polyfill in `src/setupTests.js`. Do not remove these or App tests fail with "Cannot find module".
- `src/App.test.js` is now a REAL render smoke test (the CRA "learn react" boilerplate was dead — no such link ever existed).

---

## ‼️ PHASE 8 PART D (2026-08-04) — THE SUPPORT CROSS-LOOKUP. The app's FIRST and ONLY change in the whole multi-user programme.

**New page `src/pages/users/TenancyLookupPage.jsx`, route `/tenancy-lookup`, sidebar item "Lookup".**
Panels in `src/components/tenancy/TenancyPanels.jsx` (16 exports); every call AND every rendering rule in
`src/services/adminTenancyService.js`.

**It answers "why can't Sarah see bookings?" without asking the customer for screenshots.** Before it,
`/admin/users/lookup` resolved a PERSON and `/admin/providers/{businessId}/…` took a BUSINESS, and the two
coincided only while a BusinessId happened to be the owner's UserNumber. ‼️ **THEY NOW DIFFER — every
allocated BusinessId is 6 chars (`Tenancy:BusinessId`), every UserNumber is 5. Nothing links them but this
lookup.** See "THE USERNUMBER-IS-NOT-A-BUSINESSID FIX" below.

| Call | Host | Why there |
|---|---|---|
| `GET /admin/tenancy/search?q=` | Identity (`authApi`) | Needs the Identity host's own `ILookupNormalizer` — `UserProfile.NormalizedEmail` is written by it |
| `GET /admin/tenancy/people/{userNumber}` | Identity (`authApi`) | Same |
| `GET admin/providers/{businessId}/members` | Main API (`backendApi`) | Needs `IBusinessSeatService` → `IEntitlementService`; the Identity host deliberately does not take the payments graph |

‼️ **The two-host split is deliberate (decision AD2)**, and it is the pattern `ProviderPaymentsPage` already
uses: resolve a person on one host, read business data on the other.

### ‼️ Rules that must not be softened

- **D10.2 is a CONTRACT, not a UI choice.** `adminTenancyService.js` contains **no `.post/.put/.patch/.delete`
  at all**, and a convention test in `Clinqet.API.UnitTests` walks all eleven support DTOs and **fails on any
  property name** containing message / preview / body / content / notification / preference / channel /
  transcript / password / token / secret.
- ‼️ **AP-1: the page NEVER says a view was "recorded".** `SecurityAuditEvent` does not exist (L96) — **Phase 9
  owns it**, and the wording goes in WITH the table. A test asserts the page never claims it.
- ‼️ **AP-3 permits conversation METADATA, but this portal shows no conversation surface**, so the limits card
  states the boundary rather than claiming a view that is not there (AD7).
- **Every result row says WHY it matched** (`AdminTenancyMatchReason`), and **deactivated/suspended people are
  shown and MARKED, never hidden.** Click-through works both ways via the breadcrumb trail; no dead ends.
- ‼️ **AP-4's role read-out is DERIVED from `TenancyRoleCatalogDefinition`, never authored.** The approved
  mockup's own version is **factually wrong** — it says a Technician reaches no quotes or invoices, but L74
  grants both at `Assigned` scope. Deriving it is what makes it true.
- ‼️ **`routes/routeConfig.test.js` is an EXHAUSTIVE route-map guard** (`toEqual`), so any new route fails it
  until its expectation is updated. Working as designed — never weaken it to a subset check.

### ‼️ i18n — hardcoded English is the documented convention here (AD1, owner-approved 2026-08-04)

This app has **no i18n infrastructure at all**: no `react-intl`, no `i18next`, no catalogs, nothing in
`package.json`. All 20+ pages are hardcoded EN. The owner approved keeping that for the new screens rather than
half-localizing the app. **Do not add react-intl for one page.**

---

## ‼️ MULTI-USER TENANCY — PHASE 9 (2026-08-04). The lookup is final, and the audit table is CLOSED.

> **The whole model is now one skill: read `clinqet-provider-teams` before any tenancy change.**

**Phase 9 changed ZERO files in this app** — proven by mtime. ESLint: **0 errors, 0 warnings**;
jest **144 / 144**. This section closes the support-portal story.

### ‼️‼️ `SecurityAuditEvent` IS CLOSED — IT WILL NEVER BE BUILT (H1)

**D10.3's non-negotiable read:** *"Every admin view of a member list or a person's business list writes a
`SecurityAuditEvent` — who looked, at what, when."* ‼️ **That requirement is WITHDRAWN by owner decision on
2026-08-04.** Phase 6 built the table and **deleted it before the migration was applied** (L96); Phase 9A
presented the complete RULE ZERO table and **the owner declined it.**

**What ships instead: one structured log line per privileged read**, at
`AdminTenancyLookupController.Search`, `.GetPerson` and `AdminProviderController.GetMembers` —
**actor · subject · outcome**, and ‼️ **NEVER the search text, which is somebody's email or phone number.**

**Why, on the record.** The scenario originally offered ("a provider emails asking who looked at their
staff list") **cannot happen** — nothing notifies a provider that support opened their record, so no
provider would ever know to ask. The only genuine driver left is **insider risk / incident scoping**, a
post-launch concern for an internal-only portal with a small trusted staff, no stated compliance regime,
and **D11 wiping every environment at Phase 15** anyway.

**Three alternatives weighed and rejected:** a **provider notification** (no correct recipient — support
opening a member list is normal ticket work, so it is noise); an **admin alert per lookup** (alerts are for
anomalies; one per lookup trains ops to ignore them, making the platform *less* safe); the **business
activity feed** (three disqualifiers — **the provider can SEE it**, so a fraud investigation would tip off
the subject; it **self-deletes at 90 days**; and being partitioned per business it **cannot** answer *"what
did this agent look at across ALL businesses"* without a forbidden cross-partition query, nor host a
person-lookup that belongs to no single business).

‼️ **AP-1 IS UNCHANGED AND MUST STAY UNCHANGED.** The portal claims **nothing** about a view being
recorded, and `src/pages/users/TenancyLookupPage.test.js`'s test named *"never claims that opening a member
list is recorded"* **must keep passing.** A promise the platform cannot keep was judged worse than an
honest gap.

> ‼️ **A LATER SESSION MUST NOT TREAT THE ABSENCE OF THIS TABLE AS A GAP TO CLOSE.** Same standing as
> **B15** (the realtime claim push). **If the owner ever reverses it, the "recorded" wording goes in WITH
> the table, and that test's job changes from proving the claim is ABSENT to proving it is TRUE — update
> it, never delete it.**

### The three endpoints, and why the feature spans TWO hosts (AD2)

| Endpoint | Host | Returns |
|---|---|---|
| `GET /api/v1/admin/tenancy/search?q=` | **Identity** | `AdminTenancySearchResultDto` — `People[]` + `Businesses[]` + `CloseMatches[]`, **every row carrying an `AdminTenancyMatchReason`**, plus a `Truncated` flag |
| `GET /api/v1/admin/tenancy/people/{userNumber}` | **Identity** | `AdminPersonTenancyDto` — the person plus **every** business they belong to, **including the ones they cannot enter**, each with the reason |
| `GET /api/v1/admin/providers/{businessId}/members` | **Main API** | `AdminBusinessTenancyDto` — roster, pending invitations, seat state, legacy grant, and the role-capability read-out |

The **person** half needs the Identity host's own **`ILookupNormalizer`** — `UserProfile.NormalizedEmail`
is written by it, so hand-rolling `ToUpperInvariant()` in the Main API would be an **unstated coupling to a
framework default** that breaks silently if a custom normalizer is registered. The **business** half needs
`IBusinessSeatService` → `IEntitlementService`, which the Identity host deliberately does not take (L51).
**The admin app already talks to both hosts** — `ProviderPaymentsPage` already resolves a person on one and
reads business data on the other — so this is the established pattern, not a new one.

Rejected: everything in Identity (loses the real tier limit, so the approved "9 of 10 seats used" card
would have had to drop its denominator) · everything in the Main API (hand-rolled email normalization).

### ‼️ Sargability is a CONTRACT here, not a preference

Every branch is an **index seek**, and the **handle SHAPE decides which ones run** — an email never probes
the business-name index, a phone number never probes `UserNumber`. **1–4 seeks, never a scan.**

`IX_Business_DisplayName` (**the ONE SQL index this whole programme's frontend work added**, migration
`20260804150226_AddBusinessDisplayNameIndex`, owner-approved under RULE ZERO) is seeked with an **escaped
prefix `LIKE`** — `AdminTenancyLookupService.LikePrefix` escapes `[`, `%` and `_`, so a wildcard pasted
into the box becomes literal text.

‼️ **`LOWER(`, `UPPER(`, `LEFT(` and `CHARINDEX` appear in NONE of the generated SQL**, asserted by
`AdminTenancyLookupSqlShapeTests` against the **real predicate expressions** (they are `internal` for
exactly that reason). Sabotage-verified: making the predicate non-sargable failed the test **quoting the
real generated SQL**.

‼️ **The "did you mean?" seek fires ONLY on a total miss**, so the happy path never pays for it.
Result cap: `AdminSupport:LookupResultLimit` = **20**, Identity host only, class default mirroring it.
Not a `local.settings.json` key ⇒ **no ARM and no `deploy.ps1` change.**

### ‼️ D10.2 is enforced as a CONTRACT, not trusted to the UI

- `services/adminTenancyService.js` contains **no `.post/.put/.patch/.delete` at all.**
- The controller carries **no `HttpPost/Put/Patch/Delete`.**
- Neither service contains `SaveChanges`, `Add(`, `Remove(` or `Update(`.
- ‼️ **A convention test walks ALL ELEVEN support DTOs and fails on any property name containing**
  message · preview · body · content · notification · preference · channel · transcript · password ·
  token · secret. **So "support cannot see message content or notification preferences" is a build
  failure, not a review note.**
- **No impersonation path exists** — that is a separate feature with its own consent model, step-up and
  audit trail, explicitly **not in this programme**.

‼️ **`IgnoreQueryFilters` is used DELIBERATELY** so a closed account resolves and is **MARKED**, rather than
vanishing. And ‼️ **a `Removed` membership stays indistinguishable from "no such business"** — that is a
security property, not an omission.

### ‼️ Derive the role read-out — the approved mockup is FACTUALLY WRONG

The mockup's *"what his role allows"* panel says a Technician reaches *"Leads · quotes · invoices · the
team — Not in this role"*. **`L74` grants a Technician `quote.read` AND `invoice.read` at `Assigned`
scope.** Only `Lead` and `Team` are genuinely absent.

‼️ **A test that copied the mockup's claim FAILED against the real catalogue** — which is precisely why
**AP-4 requires the read-out to be DERIVED.** It is derived from `TenancyRoleCatalogDefinition`, and
`TheRoleReadOut_IsDerivedFromTheCatalogue_AndNarrowsAssignedScopeHonestly` pins the truth.
**Anything that restates a permission matrix in prose will drift from the catalogue.**

### The rendering rules live beside the service

`services/adminTenancyService.js` carries `matchReasonLabel` · `personStatus` · `membershipStatusLabel` ·
`accessSummary` · `scopeLabel` · `roleCapabilityFor` · `roleKeyLabel` · `seatSummary` — **kept next to the
calls so the results list, the business page and the person page cannot describe the same fact
differently.** Sabotage-verified: making `accessSummary` report a denied membership as granted failed **2**
tests, one on the suspended-business page and one on the person page.

### Two app-specific facts

- ‼️ **`routes/routeConfig.test.js` is an EXHAUSTIVE route-map guard** (`toEqual(EXPECTED_ADMIN_ROUTES)`),
  so **any** new route fails it until the expectation is updated. **Working as designed — never weaken it
  to a subset check.**
- ‼️ **`findByRole("button", { name: "…" })` THROWS when a list renders one per row.** Use
  `findAllByRole(...)[0]` and say which one you mean.

### ‼️ i18n — hardcoded English is the documented convention here (AD1, ✅ owner-approved 2026-08-04)

This app has **no i18n infrastructure at all**: no `react-intl`, no `i18next`, no catalogs, nothing in
`package.json`. All 20+ pages are hardcoded EN by design. The shared contract says the only permitted
hardcoded English is admin-internal alert wording, so this needed an **explicit yes** rather than an
assumption — and it was given.

**Rejected:** introducing `react-intl` + five catalogs for the new screens only — that leaves the app
half-localized and makes the new pages inconsistent with every existing one. The app is Clinket-internal
staff only; **no external user ever reads it. Do not add react-intl for one page.**

---

## ‼️ SESSION — `src/utils/session.js` IS THE ONE AUTHORITY (rewritten 2026-09-29, auth-session audit)

The pre-2026-09 model (AES-"encrypted" `authToken`/`refreshToken` in localStorage, `/auth/token/refresh`) is
GONE. Server model: `clinqet-auth-sessions`. This app follows its web rules (§4, §8):

- **Token in memory only.** A reload restores through `POST auth/session/renew {appType:"Admin"}` (cookie +
  `X-Clinket-Session-Transport: cookie`, 15 s timeout, single-flight per tab). Legacy `authToken`,
  `refreshToken`, `userInfo`, `adminIdentity`, `sessionId`, `rememberedPassword` and the per-tab
  `adminAccessToken` are removed at startup. `storageService` is plain JSON (`jsonStorage`); unreadable or
  old encrypted values count as absent.
- **Identity per request.** `handleAuthFailure` replays a plain 401 only when the renewed token has the same
  sub + SessionId + BusinessId as the one sent (`utils/jwt.js`, one base64url+UTF-8 decoder);
  `session_context_changed` is never replayed; a 503 `session_unavailable` is retried (bounded) only while
  the tab still holds that session; `session_ended` aimed at a session the tab already left is ignored, and
  otherwise one renew decides (another tab's security change may have continued the same admin).
- **A renew that returns another admin** reloads the tab; nothing on screen outlives the person it was loaded for.
- **Sign-out:** `clinket.auth.signOutPending` is set BEFORE `POST auth/logout`; the tab clears locally at once;
  the marker is cleared ONLY by an HTTP 200 (Identity keeps the cookie on 503, so a retry can still end the
  session). While it is set no tab renews; the logout is retried once per load and per `online` event; the
  sign-in page shows the pending notice. A late confirmation of an older sign-out never clears a newer one.
- **Two-step sign-in:** `{requiresMfa, userId}` → `SignInCodeStep` → `POST auth/login/verification?userId`
  `{code, appType:"Admin", rememberMe}`; resend has a 30 s cooldown; lockout (429) shows the server sentence.
- **Onboarding reach token** (`ProviderOnboardingPage`): every minted token is held in `services/onboardingSessions.js`
  (token → server `expiresAt`). In-page exits (Exit workspace, Done, unmount, switch provider, the token "Keep working"
  replaces, a late or wrong-provider mint) call `endOnboardingSession`: release, then `auth/logout {}` with only that
  bearer. Everything else ends every held token with `fetch(<identity>/auth/logout, { method: "POST", body: "{}",
  credentials: "omit", keepalive: true })`: `clearSession()` does it the moment any sign-out starts (AdminLayout,
  ChangePassword, sign out everywhere, `endSession`/`redirectToLogin`, another admin taking the browser), and a
  `pagehide` listener (installed on the first mint) covers reload, tab close and hard navigation. Each token is revoked
  at most once; an expired one is only forgotten. A back-forward-cache restore whose token is gone shows "This
  workspace session has ended." The revoke sends no appType/cookie/transport header, so the admin's own session is
  never touched.
- **Keys:** `clinket.auth.signOutPending` (local), `clinket.auth.signedIn` (local, written+removed as a
  cross-tab signal), `clinket.auth.sessionEnded` (session, one-time notice), `adminProfile` (plain JSON
  `{owner, profile}`, only for the admin this tab holds). Kept across sign-out: `x-device-id`, `theme`,
  `selectedLanguage`, `rememberedEmail`, `rememberMe`, `x-session-id`, `clinket.appConfig`.
- **Hosting:** `server/server.js` serves only `build/` (the site runs on Linux, so there is no `web.config`); CI
  runs jest before the build (`npm test -- --runInBand --watchAll=false`, skipped only with `skip_tests`), builds
  with `GENERATE_SOURCEMAP=false` and fails if any `.map` ships. `deploymentPackage.test.js` assembles the package
  with the workflow's own commands and runs the real `server.js`.
- **Audit round 2 (2026-09-30):** `/auth/logout/all` is never retried or replayed; a plain 401 with no token held is
  passed straight through, and `endAfterFailedRenew` never shows "Session expired" after a deliberate sign-out.
  `SignInCodeStep` disables Change while verifying, and a success landing after Change ends the session it opened.
  "Keep working" on onboarding ends the token it replaces. Every failure log goes through `utils/logFailure.js`
  (message, status, URL path — never the axios config, which carries the bearer); `logFailure.test.js` scans the tree.
- **Audit round 3 (2026-09-30):**
  - **Sign out of all devices:** `logoutAllDevices` first calls `ensureFreshSession()` (null = already over, or this
    tab's own sign-out is in flight → nothing is sent). `POST auth/logout/all` then carries the fresh token and is never
    retried. A 401 `session_ended` follows `endSessionIfOver`, the same rule as `handleAuthFailure`: a refusal for a
    session the tab left is ignored; otherwise one renew decides — no session → `endSession({ message })` with the
    server's sentence; the same admin continuing (a security change elsewhere) stays signed in and is asked to retry.
  - **Own sign-out:** while `logoutUser` is in flight (`signingOut` counter, decremented in `finally`),
    `ensureFreshSession` returns null at once — no renew, no `endSession`, no redirect — so PrivateRoute's checks can
    never abort the tab's own logout request.
  - **Code step:** `verifyLoginCode(userId, code, rememberMe, { keep })` has a 15 s timeout (`VERIFY_TIMEOUT_MS`) and
    asks `keep()` only after the code checks out. `SignInCodeStep` keeps the session only if Change was not pressed
    and the tab still holds the SessionId it held at submit; a declined session is never begun (no token swap, no
    SIGNED_IN broadcast, no sign-out marker) and is ended with `POST auth/logout {}` and only its bearer. Known limit:
    a late verify's Set-Cookie still replaces the browser's single Admin cookie, so a tab holding another session signs
    in again at its next renew.
  - **Clear code pauses:** the toast shows the server's sentence from the envelope's `data` (`CodePauseClearSuccess` /
    `CodePauseClearNothing`), falling back to "Code pauses cleared"; confirm, cancel and disabled-while-clearing are
    tested (`AccountSupportPage.test.js`).
  - **CI:** a separate `test` job runs Jest once per run; each region's `build` job `needs: test` (or runs when it was
    skipped via `skip_tests`).
- **Code pauses:** Account Support has **"Clear code pauses"** (`userSupportService.clearCodePauses` →
  `POST admin/users/by-number/{userNumber}/code-pauses/clear`), for use after a `*CodeLimitReached` alert once the
  admin has confirmed it is the real person. `AlertsPage.jsx` lists the seven session-audit types:
  `RegistrationCodeLimitReached`, `LoginCodeLimitReached`, `PasswordResetCodeLimitReached`, `ContactCodeLimitReached`,
  `AccountDeletionCodeLimitReached`, `SessionReplayDetected`, `UnprovenAccessRemoved`.
- Admin copy is English by design (AD1). Tests: `src/utils/session.test.js`, `src/utils/PrivateRoute.test.js`,
  `src/pages/auth/Login.test.js`, `src/services/authService.test.js`, `src/deploymentPackage.test.js`,
  Playwright `e2e/*.spec.cjs` (restore through renew).

## ‼️ SEARCH OPERATIONS PANEL (Phase 4, 2026-08-18)

`src/pages/system/SearchOperationsPanel.jsx`, mounted on **System Monitoring** beside the read-only health
card, in the app's existing design system (white `rounded-2xl` card, `#032858` primary button, `react-hot-toast`).

| Lever | Endpoint | Shape |
|---|---|---|
| Resync ONE service | `POST /admin/search/reindex-service/{businessId}/{serviceId}` | **Queued.** It enqueues a `ChangeFeedFailureMessage`, so the replay processor runs the identical path the change feed uses — it inherits the retry ladder and the DLQ, and a slow AI leg cannot time out an HTTP request. A deterministic messageId collapses a double-click. ‼️ It NEVER touches the Cosmos document to provoke the change feed: that is a data write for a side effect, and it bumps `UpdatedAt`, which the freshness guard reads and the provider sees |
| Resync a business | `POST /admin/search/reindex-business/{businessId}` | Synchronous; already existed, had no UI |
| Visibility report | `GET /admin/search/provider-visibility/{businessId}` | Already existed, had no UI |

**Deep link:** a `SearchEnrichmentFailed` / `SearchEmbeddingFailed` alert carries its affected services as
`businessId/serviceId`; the Alerts detail pane offers **Open Search Operations**, which lands on
`/system-monitoring?businessId=…&serviceId=…` with both fields pre-filled. 401 and 403 surface honestly
rather than as a bare toast.

New alert types registered in `AlertsPage.jsx`: `KnowledgeIngestFailed`, `SearchEnrichmentFailed`,
`SearchEmbeddingFailed`. Admin-internal wording stays hardcoded English (§3.6).

### ‼️ FIND A BUSINESS BY ANY HANDLE (2026-08-19) — reuse, NOT a new endpoint

`src/components/tenancy/BusinessLookupField.jsx`, mounted above the id fields. Every lever on the panel is
keyed on a `businessId`, but a support ticket arrives as an **email or a phone number** — so this resolves one
into the other. ‼️ **A new `/admin/providers/lookup` endpoint was scoped and OWNER-APPROVED, then NOT built,
because `GET /admin/tenancy/search?q=` already does exactly this** ("one box, any handle", shape detected
server-side, grouped People/Businesses, `truncated` flag, privileged read audited without logging the PII),
already wrapped in `src/services/adminTenancyService.js`. **Approval to build is not a reason to build
something redundant — check for the existing surface first.** Zero API change, zero schema change.

- ‼️ **An email or phone matches a PERSON, not a business.** Getting to a businessId therefore needs a
  SECOND call (`getPersonTenancy`), which is spent **only on the person the admin actually picks** — never
  prefetched for every hit. A business id or name resolves in ONE call.
- ‼️ **Cost shape is deliberate and test-pinned**: ONE box (three boxes buy nothing when the server detects
  the shape), **submit-only — never a type-ahead** (an admin pasting an email would otherwise cost one
  request per character), and the `businessId` field stays directly editable so the deep-linked alert case
  spends **ZERO** calls here and a resolver outage never blocks a repair.
- Reuses `BusinessResultRow` / `PersonResultRow` / `LoadingRows` / `Pill` from `TenancyPanels.jsx`, so it
  inherits the lookup page's look for free. States covered: idle, resolving, one/many businesses, person →
  memberships, person-with-no-business, no match, failure, `truncated`.
- Tests: `BusinessLookupField.test.js` (7) mock ONLY the two network calls — the rendering rules stay real,
  because a mocked row could let a wrong businessId reach `onSelect`, and that id is what every lever acts on.
  Two are cost guards: typing spends no call, and an empty box is refused client-side.
- **No mobile parity task was required** (§0.7.1 covers provider-web→partner-mobile and customer-web→user-mobile
  only). ‼️ An admin mobile app DOES exist (`clinqetmobileadminapp`, not covered by this skill) — check it when an
  admin surface changes. The panel is responsive; the lookup row stacks.
- Mockup: `C:\Nik\Data\mockups\admin-search-ops-business-lookup\search-ops-business-lookup.html` (owner-approved).

---

## ‼️ THE USERNUMBER-IS-NOT-A-BUSINESSID FIX (2026-08-20) — four business-keyed pages were unusable

> Reported as "No voice assistant record for this business (530J4)" for a provider whose assistant was
> **Active and taking calls**. The 404 was honest: there is no business `530J4`.

**A UserNumber is 5 chars and names a PERSON. A BusinessId is 6 chars, allocated by `BusinessIdAllocator`
from `Tenancy:BusinessId` (`Alphabet` 36 / `Length` 6), and names a BUSINESS.** They were the same value
before the multi-user provider programme. **They are not any more, for any business** — verified against
CA and IN dev: every `BusinessProfile.businessId` is 6 chars, none is 5.

### What was wrong

Four pages resolved an email/phone to a PERSON and then used that person's `userNumber` as the businessId:

| Page | Symptom |
|---|---|
| `pages/voice/VoiceAssistantRequestsPage.jsx` | **Totally unusable** — its tabs were User #/Email/Phone with no Business ID option at all |
| `pages/providers/ProviderTrustPage.jsx` | email/phone path dead; typed Business ID still worked |
| `pages/dashboard/ProviderPaymentsPage.jsx` | same |
| `pages/payments/ProviderPayoutsPage.jsx` | same |

‼️ **The alert QUEUE was always fine** — `AdminAlertMessage.BusinessId` is stamped from `profile.BusinessId`,
so cards act on the real id. Only the manual lookup was broken, which is why it went unnoticed: providers
who arrive through an alert never need the lookup.

### The fix — reuse, zero API change, zero schema change

All four now mount `components/tenancy/BusinessLookupField.jsx` (already owner-approved for Search Ops)
above a directly-editable **Business ID** field. `lookupUser` is gone from every one of them.

- **`BusinessLookupField` now calls `onSelect(businessId, label)`.** The label is the business display name.
  Purely additive — `SearchOperationsPanel` passes `setBusinessId` and ignores it.
- ‼️ **Destructive confirmations name the BUSINESS, not the person.** The voice page's remove/change/assign
  dialogs used `resolvedUser?.fullName`; a dialog reading "remove the number from Gopi Patel" when the
  business is "Complete Hair & Beauty" is how the wrong-id bug survived review. Test-pinned.
- **A 404 means "no such business", never "no voice assistant record"** — a business that exists without an
  assistant returns `NotInvited` with a **200** (`ToStateDto` coalesces a null `VoiceAssistant`). The copy
  now says so and adds "a business ID is not the owner's user number".
- **Cost:** a typed Business ID is still **0** resolver calls. A business id/name is **1**. An email/phone is
  **2** (search → the picked person's businesses) — the hop that makes it correct. One call cannot be right:
  an email matches a person, and a person can belong to many businesses.
- **Placeholders show the real shape** (`Business ID (e.g. A7X2M9)`), so nobody types a 5-char user number.

### ‼️ What was deliberately NOT converted

- **`pages/whatsapp/WhatsAppAdminPage.jsx`** — keyed on **phone/BSUID**, not a businessId. Resolving to a
  business would be wrong, and it resolves to `user.phoneNumber`, which is correct.
- **`AccountSupportPage` · `LoginAttemptsPage` · `AdminAccessPage`** — keyed on a **PERSON** (`userId`).
  `lookupUser` is the right call there. **Do not "finish the rollout" by converting these.**

### Tests

- **NEW `pages/voice/VoiceAssistantRequestsPage.test.js` (6)** — the page had **zero** tests before, at
  2,229 lines. The regression guard asserts `getVoiceAssistantState` is called with the businessId and
  **never** with the userNumber.
- `ProviderTrustPage` / `ProviderPayoutsPage` / `ProviderPaymentsPage` tests rewired to the resolver; each
  keeps a cost guard proving a typed Business ID spends no resolver call.
- ‼️ **Mock ONLY `searchTenancy` + `getPersonTenancy` via `jest.requireActual` spread.** Automocking
  `adminTenancyService` blanks the RENDERING rules (`personStatus`, `matchReasonLabel`, …) that
  `TenancyPanels` imports, and the panel crashes on `status.tone`.
- ‼️ **Pages importing the DEFAULT `toast` need a mock exposing BOTH** `default` and named `toast` —
  `BusinessLookupField` imports the named one.
---

## ‼️ AI CATEGORIES TAB — the D15 P2 correction queue (2026-09-01)

`AlertsPage.jsx` now carries a header tab control: **Alerts** (everything unchanged) | **AI Categories**
(`src/pages/alerts/AiCategoryCorrectionsTab.jsx` + `src/services/aiCategoryCorrectionService.js`).
An 8-agent adversarial audit ran 2026-09-01; every accepted finding is folded in below.

- Queue = the existing `Custom(Sub)categoryAwaitingReview` alerts — ‼️ fetched WITHOUT an isResolved
  filter: a same-month re-created category conflict-heals into its already-RESOLVED deterministic alert
  doc, so completeness requires classifying resolved rows too. Rows are enriched by
  `POST /admin/categories/ai-proposed/inspect` (client chunks to the server's InspectMaxItems cap and
  passes `alertParentCategoryId` — the mint-time parent evidence that keeps re-parented children in the
  queue). Toggle = **Needs action / All**; needs-action shows actionable rows (Live + AI-owned, resolved
  or not), REPAIRABLE rows (Gone/Inactive with stranded services — the merge-racing-a-setup-run case),
  and unresolved corrected rows. A live human-made custom never appears here (population rule = the id
  pattern, never confidence). Row keys include `alertDate` (cross-month duplicate alert docs share the Rows show "From service: …" from the alert's `TriggeringServiceName` metadata when present.
  deterministic alertId).
- Actions: **Merge into…** / **Repair…** (same dialog; targets from
  `GET /admin/categories/{businessId}/targets`, cascading parent→sub selects with explicit hints when a
  chosen parent has no subcategories or no targets exist, consequence summary, AnimatePresence dialogs
  with backdrop-cancel and every control busy-guarded). ‼️ Resolve gating: the alert resolves ONLY on
  `sourceDeleted` or `AlreadyMerged`; `Partial` and `Ok+sourceDeleted=false` (services appeared
  mid-merge) keep it open with an honest toast. ‼️ A parent merge NEVER auto-resolves its re-parented
  children's alerts — with the parent evidence they remain individually correctable rows. **Promote to
  global** (consequence banner notes a subcategory needs its parent promoted first — the server enforces
  it — + REQUIRED acknowledgement checkbox + optional reason) · **Keep as-is / Resolve**.
- `fetchRows` carries a request-sequence guard (a stale response can never overwrite a fresher one);
  the truncated banner only renders over visible rows and the empty state explains an all-filtered load.
- `categoryService.convertToGlobal` signature is
  `(categoryId, { businessId, reason, acknowledgeGlobalImpact })` — ‼️ the old one-arg call NEVER worked
  (no BusinessId ⇒ always 400). `CategoriesPage.jsx`'s convert modal gained the acknowledgement checkbox
  and the real payload; that page lists only GLOBAL categories for an admin token, so the AI Categories
  tab is the practical promote surface.
- `alertTypes` additions (enum order): `AiTimeBudgetExceeded` (was missing) + `CategoryPromotedToGlobal`
  (also in `IMMUTABLE_AUDIT_ALERT_TYPES`).
- Tests: `AiCategoryCorrectionsTab.test.js` (13 — population rule, resolved-row requeue, repair flow +
  payload, resolve gating incl. Ok-without-delete, no child auto-resolve, promote checkbox gate, empty
  sub-target hint; every action test drains the trailing refetch) + `aiCategoryCorrectionService.test.js`
  (5 — the real seam: metadata casing map, resolved-included fetch, chunking + evidence, exact merge
  payload, URL encoding; ‼️ CRA sets resetMocks:true, so mock implementations belong in beforeEach, never
  in the jest.mock factory) + the AlertsPage tab-switch guard. Hardcoded EN per AD1.

## AI resource alert types (2026-09-15)

`src/pages/alerts/AlertsPage.jsx` includes `AiSearchResourceLimit` and `AiModelResourceLimit` in the existing alert-type filter. Existing detail JSON shows diagnostic metadata. Parameterized page tests cover filtering and metadata rendering for both types. No new page or external-user UI was introduced.

## VOICE SETTINGS — keep-your-own-number config (2026-09-17)

`pages/voice/VoiceConfigPage.jsx` at `/voice-config` (nav "Voice Settings", and a header button on the Voice Assistant
page), backed by `services/voiceConfigService.js` → `api/v1/admin/voice-config`. Tabs: **Country** (offered toggle,
verification number typed after a FIXED `+code`, measured carriers, the numbering plan read-only) · **All countries**
(default ring, choosable options, untested cap, blocked numbers entered as country code + digits with a length check) ·
**Change history** (audit JSON PARSED — the server writes `+` as `+`).

- ‼️ **Each portal manages ONLY its own stamp**: the country picker, the numbering plans and the blocked-number code list
  come from the API, which serves `Payments:Regions` — the India portal shows IN / +91 only, the NA portal US + CA / +1.
  Never hardcode a country list here.
- Save sends the ETag the form was opened with; a 409 shows a Reload banner, never a silent overwrite. A 400 lists
  EVERY server reason and keeps the form. Unsaved changes hold the tabs and the picker. "Fill in the shipped values"
  edits the form only. Tests: `VoiceConfigPage.test.js` (12), `voiceConfigService.test.js` (6); react-router-dom v7 is
  mocked virtually in the Voice Assistant page test.

## Dashboard quick action — Voice Settings (2026-09-17)

The dashboard's Quick Actions include **Voice Settings** (`FiSliders`, `AdmingRoute.VoiceConfigPage`), beside the nav entry
and the button on the Voice Assistant page. `pages/dashboard/dashboard.test.js` pins the navigation.

---

## ‼️ THE SEARCH HEALTH CARD READS A CONTRACT NOTHING CHECKS (2026-09-21)

`GET /admin/search/health` is typed `ApiResponse<object>` on the backend, so **no compiler, test or lint sees
its consumers.** They are exactly two files, and both must change together:

| File | What it holds |
|---|---|
| `src/services/monitoringService.js` | the contract COMMENT — the only written statement of the shape |
| `src/pages/system/SystemMonitoringPage.jsx` | the card: `searchIndexes`, `INDEX_KIND_LABELS`, `indexLabel()` |

Today’s shape, after the search-topology router landed:

```
{ status, indexes: [{ kind, cell, indexName, reachable, documentCount, error }], catalogDictionary, checkedAtUtc }
```

`kind` is a `SearchIndexKind` member (`PublicServices` · `PublicProviders` · `PrivateCatalog` ·
`PrivateKnowledge`) and `INDEX_KIND_LABELS` already maps all four to operator words. `cell` is the country code
on the public plane and the cell id on the private one.

‼️ **It used to be flat** (`indexName`, `indexReachable`, `documentCount`, `indexError`) and the phase that
changed it missed this consumer on the first pass. The card would then have rendered **"Index reachable: No"**
on a perfectly healthy stamp — in the one place an operator looks to find out whether search is alive, and with
nothing failing anywhere to say so. Recorded as F17 of `Data\search-topology\findings\AUDIT-PHASE-1.md`.

‼️ **Phase 2 DID change this payload (2026-09-22)**: `GET /admin/search/health` now enumerates BOTH planes and every row carries a `plane` ("Public"/"Private"). A stamp whose private cells are unreachable answers no phone calls and no Ask Clinket question at all while the marketplace looks perfectly healthy, so the card groups by plane (`Marketplace · Services`, `Provider · Catalog (cell1)`).
When it does: update both files, keep the existing `Row` component and tokens, and run ESLint (zero errors).

## Alert types list — synced 2026-09-24 (search-topology Phase 3)

`src/pages/alerts/AlertsPage.jsx` `alertTypes` mirrors `clinqetshared/Enums/AdminAlertType.cs` and is now
148/148: added `OfferExpirySweepIncomplete` (the D12 offer-expiry sweep hit its ceiling or could not rebuild a
business) and the two that had been missed, `SearchTopologyMisconfigured` and
`MarketplaceParticipationOriginFallback`. 161/161 on 2026-09-30, the latest `AccountDeletionCodeLimitReached`. ‼️ **Since 2026-10-02 there is NO type list in the app.** The filter reads `GET api/v1/admin/alerts/types`
(`alertService.js`, cached, a failed read is not kept); `alertTypesParity.test.js` and the `alertTypes` array are
deleted. A new enum value needs only a LABEL in `ALERT_TYPE_LABELS` — every older note in this file that says
"add it to `alertTypes`" now means "add its label".


## Admin dialog viewport safety (2026-09-24)

The entire centered panel must fit the viewport, not just its body: use `max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain` with the existing `p-4` overlay. Bounding an inner body to 70vh does not account for header/footer height. Twenty formerly unbounded panels were corrected; eight already bounded panels were retained.

AlertsPage renders its existing detail overlay through `createPortal(..., document.body)` so parent layout spacing cannot offset it. Its close header is sticky, footer actions wrap, opaque identifiers wrap, and Escape dismisses. Preserve the existing action handlers and busy guards.

`components/layout/modalViewport.test.js` owns the source guard for every centered admin overlay (floor 23: the AI Assistant page's dialogs share ONE shell, `pages/voice/VoiceDialog.jsx`, so they count once); `e2e/dialog-viewport.spec.cjs` proves real scrolling, control reachability and dismissal at five viewport sizes plus the category form in landscape. Run `npm run test:browser` (Playwright Chromium required). Fixtures are local-only and browser outputs live in OS temp. See `clinqetwebadmin/DIALOG_VIEWPORT_AUDIT.md` for the customer/provider inspection findings; those shared confirmation dialogs are not all viewport-safe.


## Explainable admin search health (2026-09-24)

Owner-approved mockup: C:/Nik/Data/mockups/admin-search-health/index.html; authority and approval register: C:/Nik/Data/admin-search-health/PLAN.md. This supersedes the earlier anonymous/count-only health-card contract. SystemMonitoringPage delegates the search card to SearchHealthCard; searchHealth.js validates and normalizes both JSON casings. The server owns status, summary and findings (code, severity, component, reason, impact, nextStep, optional indexName). Country lifecycle remains index.status. Never derive an outage from a zero document count.

Unknown means the monitoring request/report failed, not that Search is down. Preserve the previous report with its original timestamp and an explicit historical label; never retain its green badge as current status. Refresh aborts superseded/unmounted requests and preserves SearchOperationsPanel inputs/results by keeping it mounted. Legacy reports retain their supplied status with an explanation-unavailable notice. Links lead to the existing Search Operations anchor and Alerts.

Checks cover index reachability and dictionary readiness, not indexing completeness, embeddings or relevance. Keep that limitation visible. Regression suites: SystemMonitoringPage.test.js, searchHealth.test.js and e2e/search-health.spec.cjs. Browser fixtures are local-only and include narrow widths, long aliases, failed refresh and recovery.

## Shared admin dropdowns (2026-09-25)

All 55 choice controls across 18 admin files use `src/components/ui/AdminSelect.jsx`, backed by the existing react-select dependency. Use it for new choices; do not add native select menus or another per-page select theme. Field and compact variants share navy text, lime focus, rounded white menus, a selected check, neutral hover, disabled and validation states. Search is typed directly into the accessible combobox trigger. AdminLayout profile actions share the same visual language and retain action semantics, with Escape returning focus.

The declarative children remain option/optgroup elements; the wrapper converts them to options and emits `{ target, currentTarget, type: "change" }` with string value, name, id and type `select-one`. Preserve empty sentinels and numeric conversions at the caller. A missing selected value is displayed as unavailable, never replaced with the first option. Native required validation/form data and existing labels remain supported. IDs reach the real input; add an aria-label where the visible label is not associated. `className` controls wrapper layout only; theme styling belongs in the shared component.

Menus portal to document.body above admin dialogs, are fixed-positioned and height-bounded, and respond to scrolling/resizing/visualViewport changes. Escape closes the dropdown before the enclosing dialog; Tab must not commit a merely highlighted option. Keep disabled options, dependent-category resets and billing region scope intact. No writes occur simply by opening/filtering the choices.

Tests: AdminSelect.test.jsx for the control contract; adminSelectCoverage.test.js scans a nonempty owning-app source tree for native/unshared choices; existing page tests use real options via testUtils/adminSelect.js; StepServices.test.jsx verifies dependent choices and the submitted payload. Browser coverage lives in e2e/admin-dropdowns.spec.cjs. Authority, preview and final verification: C:/Nik/Data/admin-dropdowns/PLAN.md. No dependency installation, backend/schema change or deployment is part of this styling change.

## Post-ranking follow-ups (audit 2026-10-01) — Provider Trust ranking effect (W13/W14), alert list parity

### `ProviderScoresCard.jsx` — what the scores do to ranking (sheet `provider-trust-ranking-effect`)
- `GET /admin/providers/{id}/scores` also returns `ranking` (`AdminRankingDto`: per-score effect, `browse` + `typed`
  factors) and `legend` (`AdminRankingLegendDto`, from the LIVE `Search:Boost` + `ProviderScoring` settings — never
  written in the page). Every number comes from `ProviderBoostComposer.Explain` (`clinqet-search-discovery` → W14).
- ‼️ `ranking` may be **null** (the search row could not be read): no factor panel; the card says "We couldn't work out
  the effect just now — search results could not be checked."
- **Preview**: `POST /admin/providers/{id}/scores/preview` (`previewProviderScores`, `providerTrustService.js`), after
  `PREVIEW_DELAY_MS` (500), only for typed whole numbers 0–100 (`previewRequest`); saves nothing. 503 (search unreadable)
  or any error ⇒ "We couldn't work out the effect just now. You can still save — ranking will use these numbers either way."
- **Override save, D-L1**: `ScoreOverrideResult.Unconfirmed` ⇒ **503** "The change was sent but could not be confirmed.
  Reload to see whether it was saved before trying again." (was a bare 500). `Unavailable` ⇒ 503 "The change could not
  be recorded, so nothing was saved. Try again in a moment."
- An unmeasured score reads **"Not measured yet"** on its tile band and measured line (`measuredText`); otherwise the
  form shows the REAL measured number ("Measured: N").
- **Admin phone** (`clinqetmobileadminapp`) mirrors it: `src/screens/admin/ProviderScoresSection.tsx` (same null-`ranking`
  and preview-error wording), `src/utils/providerTrust.ts` (`measuredText`), `previewScores` in
  `src/services/adminService.ts`; tests `__tests__/providerScoresSection.test.tsx`, `__tests__/providerTrust.test.ts`.
- Tests (web): `ProviderTrustPage.test.js` (incl. "Not measured yet" ×2 on an unmeasured tile), `providerTrustService.test.js`.

### Alert types — read from the server (was: 186, list = enum)
- Until 2026-10-01 `AlertsPage.jsx` held the list; since 2026-10-02 both admin apps read it from
  `GET api/v1/admin/alerts/types` and keep only labels (see "AI Assistant numbers" below). New in this programme: `ProviderScoreSafetyNetLimit`, `ProviderScoreSafetyNetWarning`,
  `ProviderScoreConversationsWarning`/`Limit`, `ProviderScoreBookingsWarning`/`Limit`, `InsightsLeadEventsWarning`/`Limit`,
  `InsightsInquiriesWarning`/`Limit`.
- Admin phone `src/services/alertTypes.ts` holds LABELS only (its hand-copied `ALERT_TYPES` list is gone);
  `__tests__/alertsAndSystem.test.ts` checks the newer types and labels (e.g. `InsightsLeadEventsLimit` → "Insights:
  lead history limit reached (night skipped)").

---

## AI Assistant numbers (2026-10-02) → `clinqet-voice-number-lifecycle`

Requests · Numbers · Activity on the AI Assistant page (`src/pages/voice/`), per
`C:\Nik\Data\voice-number-lifecycle\UI-CONTRACT.md` §3. The admin mobile app
(`clinqetmobileadminapp/src/components/voice/`) mirrors it. The alert filter's TYPE LIST comes from
`GET api/v1/admin/alerts/types` — never a hard-coded list in either admin app (labels stay in the app).
Return now and Close request are explicit, worded dialogs; nothing shows a return or an assignment as done
before the server says so.

Rules both admin apps follow (each one was a defect found in review, 2026-10-02):

- ‼️ **A purchase above the limit carries the price the admin approved.** Assign / change send
  `approvedMonthlyRental` + `approvedSetupFee` ONLY when the quote is `tooExpensive` and the admin ticked the
  approval (`approvedPrice` in `VoiceAssistantRequestsPage.jsx` / `voiceModel.ts`), else null. There is no
  `confirmPurchase` flag: sent on every purchase it told the server it may buy above the limit.
- The quote carries `monthlyRental` / `setupFee` / `currency` (decimals; null = unknown, shown "Unconfirmed",
  never 0.00). The old `…CostMinor` fields are gone — reading them printed every price as $0.00.
- After assign / change / remove / release — **done or refused** — re-read the business, its requests, the
  queue and Numbers. No answer at all is "unconfirmed", never "failed".
- An empty page WITH a token shows "Nothing on this page" and keeps Load more.
- **Release** on a cancelled business returns the number to the carrier: a dialog, a tick, a red button.
- A parked number reads "Parked"; un-keeping it ends the park (anyone can then be given it), and the Keep and
  Return dialogs say so. A reuse wait whose date has passed reads "ended".
- Alert links: a business alert opens that business; `VoiceAssistantApplicationSubmitted` opens the business
  that applied; every other type starting `VoiceNumber` / `VoiceCarrier` opens Numbers, so a type added later
  still leads somewhere (`voiceAlertLinks.js`, `numberModel.ts` `voiceAlertTarget`).
- Every `admin/voice-assistant/{businessId}` path encodes the id (it comes from a typed box).

## Trial offer form — no reminder setting (2026-10-02)

`TrialOfferFormPage.jsx` no longer has "Remind the partner": when a partner is reminded is ONE platform rule
(`Payments:TrialReminders`, clinqet-payments "Trial reminders and trial messages"), shown as a hint under "Free days". The
offer DTOs no longer carry `reminderLeadDays` and the column is dropped.

<!-- search-topology-phase5 -->
## Search-topology Phase 5 alert types (2026-10-02)

`src/pages/alerts/AlertsPage.jsx` (+ its test) lists the new types: `SearchRequestsRefused`, `SearchSlowPhoneAssistant`,
`SearchSlowAskClinket`, `SearchSlowMarketplace`, `AskClinketFirstWordsSlow`, `SearchSpaceWarning`, `SearchSpaceCritical`,
`SearchIndexSwapStopped`. The mobile admin app's `src/services/alertTypes.ts` carries the same list (list only — no
screen). What each means and what to do: `cosmosindexsetup/RUNBOOK.md` "Alerts A1–A7". No move/swap admin screen
exists or is planned (D-121; if ever, web admin only, never mobile).

## Knowledge reading accuracy alert types (2026-10-02/03)

Labels in `ALERT_TYPE_LABELS` (`src/pages/alerts/AlertsPage.jsx`, + its test) and the admin phone's `src/services/alertTypes.ts`:
`KnowledgeReadingNeedsReview`, `ProviderSetupReadingNeedsReview` (one alert per reading of a file — what to check against the
original), `KnowledgeAggregateCardsWarning` / `KnowledgeAggregateCardsLimit`, `KnowledgeOverviewsLeftOutSpaceFull`,
`KnowledgePictureSectionsWarning` / `KnowledgePictureSectionsLimit`, `KnowledgeWrongAnswersReported` (a provider tapped "Report
wrong answers"; one alert per tap, nothing stored — its metadata names the file, member, app and where to look in storage).
Nested alert details now reach both apps as real JSON instead of `[]` (API `NewtonsoftTokenJsonConverter`, test
`AdminAlertControllerTests.GetAlert_NestedDetails_ReachTheResponseAsTheirOwnJson`). Meaning of each: `clinqet-voice-assistant`.

## Knowledge "Refresh suggestions" per business (2026-10-04)

- Web: `KnowledgeRefreshLimitControl` in `VoiceAssistantRequestsPage.jsx`, under the Knowledge space control on the business's
  number tab. Shows today's use / the effective limit, the platform default, the warning level and the per-document rule.
  Actions: Update refresh limit (whole number ≥ 0), Turn off refreshing (sends 0), Use platform default (sends null).
  Service: `getKnowledgeRefreshLimit` / `setKnowledgeRefreshLimit` (`{ dailyLimit }`, null sent explicitly).
- Mobile admin (`clinqetmobileadminapp`): `KnowledgeRefreshLimitCard` in `BusinessVoicePanel` next to `KnowledgeLimitCard`; every
  write asks first (Turn off is destructive-styled). `parseRefreshLimit` in `voiceModel.ts`.
- The number counts the provider's Refresh suggestions AND Read again (both run the suggestion AI). The admin's own
  knowledge reindex (System) is never counted.
- Alert labels in both apps: `KnowledgeRefreshWarning` "Knowledge Refresh suggestions or Read again: warning level reached",
  `KnowledgeRefreshLimit` "Knowledge Refresh suggestions or Read again: daily limit reached"; the description names the last action.
