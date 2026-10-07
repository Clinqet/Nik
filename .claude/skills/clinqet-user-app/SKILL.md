---
description: |
  **FRONTEND SKILL** — Work on the Clinqet User/Consumer Web App (Next.js 16, React 19, Tailwind CSS 4). USE FOR: creating/modifying user-facing pages for search, booking, quoting, broadcasting, service discovery, public business profiles, reviews, cart/checkout, user dashboard, notifications, settings, help center, privacy/terms pages. Applies to ALL files in clinqetwebuserapp/.
---

# CLINQET USER APP — COMPREHENSIVE SKILL

## RECENT CHANGES — 2026-10-06 ("Price on request", and the prepared-phone stop)

See the `clinqet-prepared-providers` skill for the whole feature. What changed HERE:

- **A service with no price shows "Price on request"** with **Ask for price** and **Call** — never "Get a quote" (that is the broadcast feature) and never a 0.
- **It is not addable to the cart and not bookable.** A line the server drops is SAID, with the way to ask the provider right there.
- **An offer band needs a price to discount**, so it is suppressed on an on-request service.
- **Registration stops on a prepared provider's phone** (`PreparedProfileReady`, in the CUSTOMER's words) and offers a code to that number.
- **Sign-in offers "No password yet? Sign in with a code"**, and the phone-sign-in **Resend code** calls the SAME send — the two-step endpoint refuses outright when two-step is off, so Resend never worked.
- **The Settings menu says "Set Password"** when the account has none, in the sidebar and both header menus.
- **The price-type filter chips are localized** — the facet value is the stored English word, so `priceTypeLabelId` maps it.
- **Settings tab titles are localized** the way the auth section already does it (`SettingsDocumentTitle` + `settingsPageMetadata`): the server renders English, the browser replaces it.
## ABSOLUTE RULES (READ FIRST — APPLIES TO EVERY CHANGE)

- **Comments — terse, only when they earn their place.** Default to no comments; let naming carry the meaning. **However**, write a comment when it captures non-obvious context the code itself cannot show: a hidden invariant, a subtle ordering constraint, a deliberate workaround for a known bug, a defensive choice with a real reason, or an RFC/spec citation that explains *why*. Prefer a single short line. Forbidden: restating WHAT the code does (e.g. `// increment counter` above `counter++`); multi-line narrative blocks explaining design rationale; XML doc summaries on properties whose names already convey intent; commented-out code; `// TODO` without an issue link. When in doubt, delete the comment — but don't strip a *real* WHY-comment just to chase zero.
- **No verbose docstrings on self-evident members.** A property named ``EnableAISpellCorrection`` does NOT need a doc summary. A field named ``_searchEnableAISpellCorrection`` does NOT need a multi-line ``//`` block above it. Trust naming.
- **No commented-out code, no leftover symbols, no ``// TODO`` without an issue link.**

---


## OVERVIEW

The User/Consumer App is a Next.js 16 application where customers search for services, book providers, request quotes, post broadcasts, leave reviews, and manage their account.

- **Path**: `C:\Nik\clinqetwebuserapp\`
- **Framework**: Next.js 16.0.6 | React 19.2.0 | Tailwind CSS 4
- **State Management**: Redux Toolkit 2.11.0
- **Forms**: Formik 2.4.9 + Yup 1.7.1
- **HTTP Client**: Axios 1.13.2
- **i18n**: react-intl 7.1.14 (4 active languages: en, fr, gu, hi; Spanish authored but hidden)
- **Real-time**: @microsoft/signalr 10.0.0
- **Auth**: JWT + Passkey (SimpleWebAuthn 13.2.2)
- **TypeScript**: 5.9.3 (type definitions available)
- **Build**: Standalone output

---

## ABOUT US PAGE (static, SEO-indexable)

- Route `app/(customer)/about-us/page.js` + `layout.js` (`constructMetadata`, indexable, canonical `/about-us`). Wrapped in `AccountSidebarLayout` + `AccountPageHeader`; sectioned content via `t("aboutUs.*")` keys — fully localized JSX (the data-deletion pattern), NOT the policy HTML-fallback pattern.
- Linked from the footer "Company" group (`components/layout/customer/footer.jsx`) and the support/legal group in `components/layout/customer/accountSidebarNav.js`. Route constant `CustomerRoute.AboutUs` (`/about-us`).
- Copy keys `aboutUs.*` + `header.About_Us` + `footer.aboutUs` + `accountSidebar.item.aboutUs` exist in all 4 `public/lang/*.json` (en/hi/gu translated; ja = English placeholder).

---

## DIRECTORY STRUCTURE

```
clinqetwebuserapp/
├── app/                          # Next.js App Router
│   ├── layout.js                # Root layout with global metadata, GTM, GA, structured data
│   ├── page.js                  # Landing page
│   ├── globals.css              # Global styles
│   ├── robots.js                # Dynamic robots.txt
│   ├── sitemap.js               # Dynamic sitemap.xml
│   ├── (customer)/              # Authenticated customer routes
│   │   ├── my-bookings/        # Booking history
│   │   ├── my-broadcasts/      # Broadcast requests
│   │   ├── my-profile/         # User profile
│   │   ├── my-reviews/         # Reviews left by user
│   │   ├── notifications/      # Notification center
│   │   ├── settings/           # Account settings
│   │   ├── cart/               # Service cart/checkout
│   │   └── change-password/
│   ├── auth/                    # Auth routes (login, signup, OTP)
│   ├── services/                # Service search/list
│   ├── service/                 # Service detail
│   ├── [friendlyName]/         # Dynamic business profile by slug
│   ├── bookings-details/       # Booking detail view
│   ├── quote-details/          # Quote detail view
│   ├── help-center/            # Help center
│   ├── faqs/                   # FAQ page
│   ├── reviews/                # Reviews page
│   ├── privacy-policy/         # Privacy policy
│   ├── cookie-policy/          # Cookie policy
│   └── terms-conditions/       # Terms & conditions
├── components/                   # React components
│   ├── admin/                  # Admin-specific
│   ├── auth/                   # Auth UI (login, signup, OTP)
│   ├── common/                 # Shared components
│   ├── customer/               # Customer-specific UI
│   ├── landing/                # Landing page components
│   ├── layout/                 # Layout wrappers
│   ├── notification/           # Notification UI
│   ├── seo/                    # SEO components (metadata, schemas)
│   └── analytics/              # GoogleAnalytics, GTM, PageViewTracker
├── context/                     # IntlContext, SignalRProvider, LoaderProvider
├── store/                       # Redux store + slices
├── services/                    # API service layer (api.js, authServices, categoryService, etc.)
├── hooks/                       # Custom hooks (useBusiness, useCategories, useNotifications, etc.)
├── lib/                         # SEO (metadata, structured-data, dynamic-seo), validation, OTP
├── utils/                       # Helper utilities (sessionStore, errorHandler, toastConfig, etc.)
├── types/                       # TypeScript definitions (business.ts, category.ts, review.ts)
├── api/                         # Next.js API routes
├── assets/                      # Static assets
├── routes/                      # Route utilities
└── public/                      # Static files (icons, manifest, lang/ JSONs)
```

---

## API SERVICE LAYER

### Core Client (services/api.js)
- Axios instance with observability headers: `X-Correlation-Id`, `X-Session-Id`, `X-Device-Id`, `Accept-Language`
- JWT Bearer token attached via interceptor
- Token refresh on 401 with deduplication

### Service Files (services/)
| File | Purpose |
|------|---------|
| `api.js` | Core Axios instance + interceptors |
| `authServices.js` | Login, signup, OTP, token refresh, passkey |
| `categoryService.js` | Category/subcategory hierarchy |
| `businessService.js` | Business profiles, services, reviews |
| `reviewService.js` | Review CRUD |
| `notificationServices.js` | Notification fetch, read, delete |
| `policyService.js` | Privacy, terms, cookie policy |
| `signalRService.js` | Real-time WebSocket connection |
| `passkeyService.js` | WebAuthn/Passkey integration |

### Environment Variables
```
NEXT_PUBLIC_BASE_IDENTITY    # Identity API base URL
NEXT_PUBLIC_BASE_API         # Main API base URL
NEXT_PUBLIC_API_VERSION      # API version (default: v1)
NEXT_PUBLIC_HOSTING_URL      # App base URL (https://clinket.com)
NEXT_PUBLIC_GA_MEASUREMENT_ID # Google Analytics
NEXT_PUBLIC_GTM_ID           # Google Tag Manager
```

---

## AUTH PATTERN

### Context (context/)
- `IntlContext.jsx` — react-intl provider with locale switching
- `SignalRProvider.jsx` — Real-time notifications via SignalR
- `LoaderProvider.jsx` — Global loading state

### Token Storage (utils/sessionStore.jsx)
- SessionStorage or LocalStorage based on "Remember Me"
- Cross-tab sync via localStorage event listener
- JWT validation with 30-second expiry buffer

### External (social) sign-in return — `components/landing/ExternalLoginHandler.jsx`
- Login and registration initiation use `responseMode=SecureCookieExchange` plus the validated HTTPS `HOSTING_URL` as `returnUrl`. Identity returns only `?external_login=complete`; no JWT or refresh token belongs in the URL.
- `app/page.js` awaits `searchParams` and passes only `initialExternalLoginPending: boolean`. The boolean seeds the first server-rendered cover without forwarding callback values or secrets into React props.
- The handler immediately strips callback parameters with `window.history.replaceState(null, "", location.pathname)` — NEVER router navigation — then POSTs `/auth/providers/login/exchange/web` with `withCredentials: true` and `X-Clinket-External-Login: exchange` before loading the profile and storing the session.
- Middleware applies private no-store, no-referrer, and noindex/nofollow response headers to callback requests. Secure-mode HTML receives only the non-secret marker, GA/GTM stay disabled until the URL is clean, and an unrelated web `code` query is not a callback.
- The legacy `access_token` + `refresh_token` parser exists only so the web-first deployment can receive callbacks from old Identity. New Identity rejects `LegacyUrlTokens` for `AppType.Clinket`; remove the parser after rollout.

### Navigation progress bar — `context/NavigationProgressContext.jsx`
`useNavigation()`/`ProgressLink` call `start()` before the router moves; `NavigationSettleWatcher` calls `done()` when the URL arrives.
‼️ **It settles against the URL key captured by `start()` (read from `window.location`), never a key the watcher recorded itself.** The URL and the `active` flag can commit in either order, and a watcher that banked the new URL while still inactive could never recognise the arrival: the bar crept to `TARGET_BEFORE_DONE` (92%) and hung there until the 8s `MAX_PROGRESS_MS` safety net. `done()` advances that key so a re-render cannot re-settle the same arrival.

---

## STATE MANAGEMENT: REDUX TOOLKIT

### Store (store/store.js)
```javascript
configureStore({
    reducer: {
        notifications: notificationReducer
    }
});
```

### Notification Slice (store/notificationSlice.js)
- `notifications[]`, `unreadCount`, `continuationToken`, `hasMore`
- `loading`, `loadingMore`, `countLoading`, `error`
- `isSignalRConnected`, `isNotificationMenuOpen`, `isNotificationPageOpen`
- Actions: `setNotifications`, `appendNotifications`, `addNotification`, `markNotificationAsRead`, `deleteNotification`, `markAllAsRead`, `incrementUnreadCount`, `decrementUnreadCount`

---

## COMPONENT PATTERNS

### Styling: Tailwind CSS 4
- Utility-first — NO CSS modules
- Responsive breakpoints: `xs` (320px) → `5k` (3840px)
- Safe area padding for mobile notches
- Fluid typography via `clamp()`

### Page Pattern
```jsx
"use client";

export default function MyPage() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchData().then(setData).finally(() => setLoading(false));
    }, []);

    if (loading) return <Loader />;
    return <div className="...">{/* content */}</div>;
}
```

### Forms: Formik + Yup
Same pattern as Partner App — Formik wraps form, Yup schema validates, custom inputs for styling.

### Error Handling
- Toast notifications via react-hot-toast
- Error extraction from API responses (errors[], message, error)
- ErrorBoundary wrapper for unhandled React errors

---

## LOCALIZATION: react-intl

### Setup (context/IntlContext.jsx)
- Loads messages from `public/lang/{locale}.json`
- Default locale: `en`
- SSR-safe with `typeof window` check
- Fallback: silently fails missing keys (`onError={() => null}`)

### Language Files
- `public/lang/en-US.json` (English)
- `public/lang/fr-CA.json` (French)
- `public/lang/hi-IN.json` (Hindi)
- `public/lang/gu-IN.json` (Gujarati)
- `public/lang/es-US.json` (Spanish, authored but hidden)

### Usage
```jsx
import { FormattedMessage, useIntl } from "react-intl";

<FormattedMessage id="Label.ComingSoon" />

const intl = useIntl();
intl.formatMessage({ id: "Button.Submit" });
```

---

## SEO PATTERNS (CRITICAL FOR USER APP)

The User App is the PUBLIC-FACING app — SEO is mission-critical.

### Root Layout SEO (app/layout.js)
- Google Tag Manager (GTM) in `<head>` + noscript fallback
- Google Analytics (GA4) via env var
- WebSiteSchema + OrganizationSchema as JSON-LD
- Comprehensive favicon set (16x16, 32x32, 180x180, 192x192, 512x512)
- Web manifest, viewport config, theme color (#032858)

### Static Metadata (lib/seo/metadata.js)
```javascript
constructMetadata({
    title,          // Default: "Clinqet - Find & Book Trusted Local Service Professionals"
    description,    // 300+ chars for rich snippets
    keywords,
    image,          // OG image
    noIndex,        // For sensitive/admin routes
    canonicalUrl,
    author
});
```

### Dynamic Business SEO (lib/seo/dynamic-seo.js)
```javascript
generateBusinessMetadata({
    business: { name, description, profilePictureUrl, categories },
    location: "New York, NY"
});
```
- Title: `{BusinessName} in {City} | Book on Clinqet`
- Keywords: business name, location, categories, "near me" variants
- Canonical: `https://clinket.com/{friendlyName}`

### Structured Data (lib/seo/structured-data.js)
1. **WebSiteSchema** — Google Sitelinks Searchbox with SearchAction
2. **OrganizationSchema** — Brand identity, social links, contact point
3. **LocalBusinessSchema** — Business info, ratings, service areas, pricing

### Route-Level Metadata
```javascript
export const metadata = createMetadata({
    title: "Search Services",
    description: "Find trusted service professionals...",
    path: "/services",
    keywords: "local services, near me..."
});
```

### Analytics
- PageViewTracker component fires on route changes
- Google Analytics events for key user actions
- Google Tag Manager for marketing/conversion tracking

---

## SEARCH FUNCTIONALITY

The User App implements full search with:
- Search bar with autocomplete/suggestions
- Filter by category, subcategory, location, price range
- Results display with service cards, ratings, availability
- Map integration for location-based search
- "Near me" geolocation support

### Search API Calls
```javascript
// From services/
await getApi.get(`${API_URL}/search/services?q=${query}&lat=${lat}&lng=${lng}`);
await getApi.get(`${API_URL}/search/suggest?q=${partialQuery}`);
```

### Search page fetch contract (2026-07-02 — MUST preserve)
- `components/customer/services/ServicePageContent.jsx` + `components/customer/providers/ProviderPageContent.jsx` are keyed on the URL search-params string; **committed interactions only call `writeUrl` (never fetch-driving setState)** — the keyed remount performs the single search + filters fetch. Adding setState back before `writeUrl` re-introduces the aborted-duplicate request bug.
- First fetch is gated on `locationReady` (URL-supplied lat/lng bypass the wait). Typing fires suggestions only; the full search fires on submit / suggestion select (SearchBox has no `onDebouncedChange`).
- City URL sentinel: param absent = untouched (geo city applies implicitly, shown as a dismissible "Near {city}" chip); `?city=` (present, empty) = user explicitly chose All cities (`filters.city === null`, no city sent).
- Both pages have a draft+Apply filter panel (provider page included — no per-change search), min<=max price validation (`filter.priceRangeError`), a distinct localized error state with retry (`search.searchFailed*` / `search.retry`), page URL param clamped to 100, and facet requests trimmed to the 4 rendered facets. Distances/radii render via `search.distanceKm` / `search.radiusKm` keys.
- The search Beta badge was removed platform-wide (web + customer mobile); `search.beta*` keys no longer exist.


---

## ESLINT (MUST PASS)

```bash
npm run lint      # Check
npm run lint:fix  # Auto-fix
```

Uses `eslint-config-next/core-web-vitals` with Next.js best practices.

---

## CART / BASKET

### State Management
- **Redux slice**: `src/store/cartSlice.js` — manages cart state with `providers`, `price`, `syncing`, `loaded`, `lastSyncedAt`
- **Reducers**: `setCart`, `clearCart`, `resetLoaded` (used on login to force cart reload)
- **Selectors**: `selectCart`, `selectCartItemCount`, `selectCartProviderCount`

### Cart Service (`src/services/cartService.js`)
- `getCart()` — `GET /api/v1.0/cart`
- `saveCart(data)` — `POST /api/v1.0/cart`
- `removeCartItem(serviceId)` — `DELETE /api/v1.0/cart/items/{serviceId}`
- `updateItemQuantity(serviceId, quantity)` — `PATCH /api/v1.0/cart/items/{serviceId}/quantity`
- `clearCart()` — `DELETE /api/v1.0/cart`
- `mergeCarts()` — `POST /api/v1.0/cart/merge`

### useCart Hook (`src/hooks/useCart.js`)
- Provides CRUD helpers: `addToCart`, `removeFromCart`, `updateQuantity`, `clearCart`
- **Debounced sync**: Cart changes locally then syncs to API after 1.5s delay to reduce API calls
- Auto-loads cart on mount if not yet loaded
- Calls `mergeCarts()` on first authenticated load (after login)

### Login Flow Integration
- `loginWithEmailForm.jsx`, `loginWithPasskeyForm.jsx`, `loginVerifyEmailForm.jsx` all dispatch `store.dispatch(resetCartLoaded())` before navigating to dashboard
- This forces cart reload after authentication, triggering the merge flow in `useCart`

### Cart Page & Components
- **Page**: `src/app/cart/page.jsx`
- **Components**: `src/components/cart/` — CartItem, CartProviderGroup, CartSummary, EmptyCart
- All text uses `react-intl` `<FormattedMessage>` — no hardcoded strings

---

## CHECKLIST BEFORE SUBMITTING USER APP CHANGES

- [ ] All text uses react-intl `<FormattedMessage>` or `useIntl()` — no hardcoded strings
- [ ] New i18n keys added to ALL 4 language files
- [ ] Tailwind CSS 4 only — no inline styles, no CSS modules
- [ ] Responsive design: mobile-first, tested across breakpoints
- [ ] SEO metadata added for new public pages (title, description, keywords, canonical)
- [ ] Structured data (JSON-LD) added for content-rich pages
- [ ] Analytics events fire correctly (Google Analytics, GTM)
- [ ] Auth-protected routes use proper guard
- [ ] Error/loading states handled
- [ ] Accessibility: semantic HTML, alt text, ARIA, keyboard nav
- [ ] `npm run lint` passes with zero errors
- [ ] `npm run build` succeeds
- [ ] No console.log or debug code
- [ ] TypeScript types maintained in types/ folder if applicable

## ANALYTICS INSTRUMENTATION (analytics-recs Phase A2, 2026-07-02 — full coverage)

Tracker `services/analyticsTracker.js` (24 helpers) + `hooks/useAnalyticsEngagement.js` (useDwell/useScrollDepth) + `components/analytics/PageViewTracker.jsx`. Taxonomy + guardrails live in the `clinqet-analytics` skill — EventSubType/surface strings are byte-identical to customer mobile; verify there before adding any emitter.

- **Surface inference**: single-segment unknown paths resolve to `provider_profile` (Next.js `[friendlyName]` mirror) via `STATIC_TOP_SEGMENTS` — ADD any new top-level static route to that set or its PageViews become provider_profile. `/details`→provider_profile, `/about-us`→about_us, `/data-deletion`→data_deletion, `/do-not-sell-share`→do_not_sell_share, `/change-password`→settings.change-password.
- **Unload flush**: final flush (visibilitychange hidden + beforeunload) posts via `fetch keepalive` with `applyObservabilityHeaders` + bearer (`sendEventsFinal`) — never swap to `sendBeacon` (drops identity/consent headers). Same shape exists in the partner tracker; keep them in lockstep.
- **ServiceView**: profile service-row click = `from_provider_profile` + opens ServiceDetailModal; `?service=` deep-link arrival (all card navigations) = surface `service_detail`, `from_search`/`direct` per LinkedSearchId (fires in the deep-link effect in `businessProfile.jsx`).
- **/notifications**: mobile-baseline strings (`list_view`/`notification_click` {type}/`mark_all_read` + web-only `mark_read`, surface `notifications`) + dwell; row click emits ONLY in the page layout of `NotificationItem` (`layout="page"`), not the header dropdown.
- **Fully covered surfaces** (don't re-add): search funnel (ServicePageContent/ProviderPageContent/SearchBox), home rails ResultClick — ALL THREE rails since Phase D 2026-07-03 (`recently_viewed` + `trending` + the providers rail's `recommendation`) plus the `/service/[id]` discovery grid (surface `discovery`, `recently_viewed`|`recommendation` — mobile DiscoveryScreen parity), cart + checkout, bookings, quote list/detail/create (incl. `withdraw` + `contact_provider`), messages, reviews write-flow (`review_form`/`my_reviews` + votes/reports in `useReviews`), my-profile (`settings.profile`), settings subpages incl. `settings.payments` (`payments_view` {has_payments}/`receipt_download`), passkeys (`auth.passkey_management`), auth forms, legal ×8 (scroll+dwell+`policy_view`), FAQ `faq_expand`, help-center (dwell + `outbound_link` {target: phone|email|whatsapp}), consent, errors.
- **Deliberately NOT instrumented**: `/reviews` + `/reviews-test` (static demo pages); ServiceDetailModal share (no affordance — `share_open` is provider-profile only); header notification dropdown clicks.
- **A2-P2 enrichment (2026-07-03)**: SearchAction `suggestion_view` in SearchBox (once per resolved non-empty suggestion set per query+context) + `filter_toggle` {metadata: filter, value} per draft-panel control on `/services` AND `/service/provider` (radius emits on pointer/key RELEASE only via a value-deduped ref; prices on the debounced `onCommit`); batch `FilterApplied` on Apply with metadata keys byte-identical to the customer-mobile FilterScreen; the panel Clear-All emits `clear_filters` (the chip-row one already did); `useDwell("search_results")` sits ABOVE ServicePageContent's keyed remount boundary — never move it inside (it would emit one dwell per URL commit) — plus `useDwell("categories")` in categoriesList. `/service/provider` deliberately has NO extra dwell (the `/service/[id]` page-level `discovery` dwell owns it). The dead `components/customer/filter/` demo pair was DELETED. Exact strings: `clinqet-analytics` skill "A2-P2 enrichment additions".

## DISCOVERY / RECOMMENDATION RAILS (Phase D delivery audit, 2026-07-03)

- Home = `dashboardContent.jsx`: Banner + RecentlyViewed (`/discovery/recentlyviewed`) + TrendingServices (`/discovery/recommended-services` via `services/discoveryService.js`) + ServiceProviders (`/discovery/recommended-providers`). All three rails fail-quiet (hide on empty / keep prior items on error) and track ResultClick (see clinqet-analytics).
- `services/discoveryService.js` cache: `clinket_disc_rec_v4_{identity}_l{lang}_c{country}_lat{2dp}_lng{2dp}_ps{n}` in localStorage (see PHASE 3C below), **identity-scoped** (hashed account id taken from the access token the request was SENT with | `anon`; `discovery/*` joins an in-progress restore first, so an anonymous answer can never land under a person's key — 2026-09-30) with a **1h TTL** — NOT 6h (the engine recomputes ~6h; 1h bounds staleness and the identity scope makes post-login personalization immediate). v2 and v3 keys are purged once per session. Shared by the home rail, the landing banner, and the QuoteCreateForm placeholder hint. Never widen the TTL or drop the identity segment without re-litigating the Phase D decision.
- Banner `resolveImage` + all card mappers read the real wire shape `serviceImages: [{original,thumb,medium}]` (+ `businessProfilePicture` object); the flat `serviceImageUrl(s)` fields are legacy-only and never emitted by the API — keep the object checks first in any new mapper.
- `/service/[id]` = the discovery-rails grid page (sections `recommended-services` | `recently-viewed`; `provider` delegates to ProviderPageContent). Client-side filter/sort only; grid clicks emit ResultClick on surface `discovery`.

### Phase-D delivery hardening (2026-07-03 audit session)
- Home rails gate on `locationReady` (no more double-fetch + flash); StrictMode abort-retry ref reset; the banner fallback-image is folded into its dedupe key.
- `/service/[id]`: scroll-lock unmount cleanup + surface unified on `discovery` (dwell + PageView).
- Disc-cache identity key no longer decays at 24h — the userId is stored with token-aligned expiry.
- ResultClick wrappers: bubble-phase onClick + keyboard Enter/Space emission (capture-phase previously counted `tel:`/arrow clicks into the rec-engine click signal).
- Flow-B pay funnel instrumented (BookingAction `pay_open/pay_submit/pay_success/pay_fail`) + new tracker surfaces `booking_pay`/`invoice_pay` — exact strings in the `clinqet-analytics` skill.

## Legal Policy Pages — Comprehensive Fallback (2026-06-07)

Five account pages render region-specific legal docs fetched by `services/policyService.getPolicyContent(country, "user", type)` (CodeDesc lookup under code `userapp`, resolved per region by the API — distinct from the consent `getCurrentPolicy` below): `app/(customer)/{privacy-policy,terms-conditions,cookie-policy,community-guidelines,verification-policy}/page.js` (types `privacy | terms | cookie | community | verification`).

When the API returns no content (true failure only), each page renders `getPolicyFallbackContent(type)` from `utils/policyFallbackContent.js` — a **faithful merge** of the real per-region documents the API serves (the most complete region's text as the spine + the other regions' divergent/extra clauses merged in so India/US/Canada are all covered, region named inline only where clauses genuinely differ), sourced from `cosmosindexsetup/Documents/clinket-legal-center.html`, DOMPurify-sanitized. This replaced the old weak 3-bullet inline `getDefaultContent` stubs. The module is kept in sync with the partner app's `src/utils/policyFallbackContent.js`. Fallback body is English HTML (matches the English-only Cosmos docs); page chrome stays react-intl.

## Privacy Policy Consent (2026-05-22)

Three new pieces mounted globally in the app shell (`components/common/Providers.jsx` for the customer app, `src/app/layout.js` for the partner app):
- `components/consent/PolicyReconsentModal.jsx` — hard-block modal (no close X, no backdrop dismiss, no Escape). Subscribes to `services/policyConsentBus` and resolves the awaiting axios call when the user clicks Accept (POSTs `/auth/accept-policy`, stores the refreshed access token via `SessionStore.setToken`) or Decline (clears session, redirects to `/account-paused`). Content is sanitized via DOMPurify; effective date rendered via `Intl.DateTimeFormat`.
- `components/consent/PolicyConsentChecker.jsx` — runs once per authenticated session via `useAuth()`; calls `getConsentStatus` and emits to the bus if `isCurrent === false`.
- `app/account-paused/page.jsx` — static page shown when the user declines re-consent.

Axios response interceptor (`services/api.js` for customer, `src/lib/apiClient.js` for partner) handles HTTP 409 where `data.message === "policy_update_required"`: stores `_policyRetry = true` to prevent loops, awaits `policyConsentBus.emit(currentPolicy)`, and on Accept retries the original request with the new bearer token.

Register form (`components/auth/registerForm.jsx`) adds a Jurisdiction select (`in`/`us`/`ca`, defaulted via `mapCountryToJurisdiction(detectUserCountry())`), fetches the current privacy policy via `getCurrentPolicy(jurisdiction)` on mount + jurisdiction change, includes `PrivacyPolicyVersion`/`PrivacyPolicyHash`/`PrivacyPolicyJurisdiction` in the multipart payload, and on backend 409 `policy_version_mismatch` re-fetches + shows an inline `Privacy_Register_Error_PolicyStale` warning without auto-submitting.

`services/policyService.js` exports `getCurrentPolicy(jurisdiction, policyType)` (5-min in-memory cache), `mapCountryToJurisdiction(countryCode)`, and `invalidateCurrentPolicyCache()`. The partner app's `getCurrentPolicy` uses the explicit `${url.OWNER_URL}/api/v1/public/policy/current` URL since `apiClient` baseURL points to the Identity API.

Localization keys: `Privacy_Modal_*`, `Privacy_Register_*`, `Privacy_Declined_*`, `common.something_went_wrong`, `common.loading` (in `public/lang/en-US.json`). Backend mirror keys live in `clinqetinfrastructure/Resources/Localization/en.json`.

## Booking payments (Phase 3-UI, flag-gated off)
Customer booking-pay UI lives under `components/customer/payments/` (`TrustSeal.jsx`, `BookingPaymentSheet.jsx`) + `services/{appConfigService,bookingPaymentService}.js` + `context/AppConfigContext.jsx`. Surfaces: booking-detail Pay-now/Mark-complete, `app/booking-pay/[bookingId]`, `app/invoices/[number]/pay`, `app/(customer)/settings/payments`. All gated by `useOnlineBookingPayEnabled()` (AppConfig). Trust mark = themed shield-check badge, never the 🛡️ emoji. See the `clinqet-payments` skill §Phase 3-UI.

## Booking cancel/refund surfaces (2026-07-17)

- Booking detail (`app/(customer)/bookings/[id]/page.js`): the Cancel control is driven by `booking.canSelfCancel` (flag-INDEPENDENT booking field), day-of blocked state renders `myBookings.contactSupportDayOf` + a Contact support button (→ Help Center); charge disclaimer `payments.chargeDisclaimer` under the pay sheet; confirm-completion prompt (`payments.confirmCompletionHint`) when status Completed + payment Authorized/Vaulted (D2 mutual capture). List cards (`bookingsInfoBox.jsx`) show a Cancel pill when `canSelfCancel` (reuses `CancelledModel` via `triggerClassName`/`triggerLabelId` props; refresh via `onCancelled`→`fetchFirstPage(forceRefresh)`). `cancelledModel.jsx` adds `myBookings.cancelFreeNote` (pay flag on). `BookingDisputeActions.jsx`: free-cancel notice suppressed when blocked-reason set; refund-waiting state = Withdraw + Contact support side-by-side + friendly `payments.dispute.awaitingProvider` with `{deadline}`. All keys ×4 locales.

## Booking detail: "provider didn't come", business cancel reason, no customer delete (D5–D7, 2026-09-29)

- **D6 report.** `components/customer/myBookings/myBookingsTabs/model/providerNoShowModel.jsx` (`ProviderNoShowModel`) = button `myBookings.noShow.action` → confirm dialog (`.title`/`.body`/`.confirm`/`.reporting`, Go back = `myBookings.detail.goBack`, Esc + focus trap) → `updateBookingStatus(id, { newStatus: "NoShowProvider" })` = `PATCH /api/v1/bookings/{id}/status` → `invalidateBookings()` + toast `myBookings.noShow.success` + `onReported` (= `fetchBooking`). Failure toast = `extractApiError(err, myBookings.noShow.error)` (the server's sentence first).
- **Window.** Rendered only when status is `Confirmed`/`InProgress` AND the start has passed. `lib/bookingDate.js` `msUntilBookingStart({ scheduledStartDateTime, timeZoneId })` reads the booking's wall time against the clock of `timeZoneId` (device clock if missing/unknown; `null` when unscheduled). The page arms a `setTimeout` so the button appears while the page is open, re-reading the time left when it fires (not armed beyond 2^31-1 ms `MAX_TIMER_DELAY_MS`); web has no visibility/focus re-check. The server enforces the same edge: `BookingController.UpdateBookingStatus` refuses `NoShowProvider`/`NoShowCustomer` while `ScheduledStartUtc > now` (`Error_NoShowBeforeAppointment`); the window closes when auto-completion leaves Confirmed/InProgress (`BookingValidationService` allows the customer `NoShowProvider` only from those two).
- **After reporting — neutral, never "declined".** `toSliderStatus` maps `NoShowProvider` → `ProviderNoShow` (`CLOSED`, not `FAILED`): greyed track, grey label `myBookings.status.NoShowProvider` ("The provider didn't come") — never `myBookings.progress.declined`. The pill is grey too: `utils/string.jsx` `BookingsTypeButtonColour.NoShowProvider` = `text-[#5F5F5F] bg-[#F0F0F0]` (the Completed colour), on the detail page and the list card (`bookingsInfoBox.jsx`). `myBookings.status.NoShowCustomer` stays "No Show" (red).
- **Book again.** `isDeclined` = `Rejected`/`RejectedTimeout` only (no rejection block for a no-show). The detail page offers `myBookings.bookAgain` via `canBookAgainAfterClose = isDeclined || status === "NoShowProvider"` (plus the existing Completed/`NoShowCustomer` button). Since W15 (2026-09-30) the list card offers Book again on `Completed` OR `NoShowProvider`, as on mobile (below).
- **D7 cancel reason.** On a `Cancelled` booking the reason box shows `booking.providerCancelReason` (the `Booking` entity field returned by `GET /bookings/{id}`; enum `ProviderCancelReason`) via `PROVIDER_CANCEL_REASON_IDS` → `myBookings.detail.providerCancelReason.{customerAsked,couldNotDoIt,enteredByMistake}`, then `booking.cancellationReason` as the note. No known reason ⇒ the note, else `myBookings.detail.noReason`. An unknown value is never printed.
- **D5.** The app has no booking delete action. `DELETE /bookings/{id}` returns 403 `Error_BookingDeleteDraftOnly` to any non-Business caller.
- Keys ×5 locales (`public/lang/{en-US,es-US,fr-CA,gu-IN,hi-IN}.json`). Tests: `app/(customer)/bookings/[id]/bookingDetailNoShowAndCancelReason.test.jsx`, `components/customer/myBookings/myBookingsTabs/bookingsInfoBox.statusChip.test.jsx`, `lib/bookingDate.test.js`.

## Search results: recommendations lead only an unsorted list (2026-09-29)

- Server rule (`SearchController`): on `GET /search/services` with no text, recommendations anchor page 1 only when there is no category/subcategory AND `!SearchRequestDto.HasExplicitSort()` (`SortBy != Relevance`). Any chosen sort is honoured exactly — no recommendation block above it.
- Client (`components/customer/services/ServicePageContent.jsx`, `/services`): "no sort" = **`sortBy` omitted**. The request sends `sortBy` only when it is not `Relevance` (and `Distance` only with coordinates; without them the picker falls back to `Relevance`); the URL carries `?sortBy=` the same way. There is no client-side recommendation logic — rows the server marks `isRecommended` get the `search.recommendedBadge` chip.
- Not the SEO landing pages: `LandingFilterBar` → `public/discovery/landing` has its own `LandingSortBy` (see "Landing sort" below).

## Password management (2026-07-22)

- `/settings/change-password` is the sole customer password route. It reads cached profile state first and renders set-password only for a literal `hasPassword == false`; missing/invalid capability and concurrent/condition-rejected profile resolution terminate in localized Retry, never an unresolved loader. The duplicate root `/change-password` route was removed.
- Set/change success continues this browser in a NEW session: adopt the returned access token (Identity re-binds the HttpOnly session cookie) and signal other tabs to renew; a 401 `session_ended` there shows the server's "change saved, please sign in again". A 409 forces a profile refresh. Separate set/change analytics actions.
- Password policy (user-approved 2026-07-23): 8–128 characters with ≥1 uppercase, ≥1 number, ≥1 symbol (`[^a-zA-Z0-9]`; spaces count; lowercase deliberately NOT required). It lives ONLY in `lib/validation/passwordPolicy.js` (`PASSWORD_MIN_LENGTH` 8, `PASSWORD_MAX_LENGTH` 128, `PASSWORD_COMPOSITION_PATTERN`, `evaluatePassword` returning a `rules[]` array, `isPasswordValid`); the Yup schemas (min/max/matches → `Validation.PasswordMin8`/`Validation.PasswordComposition`), `PasswordChecklist`, and every submit gate import it — never re-hardcode the numbers or the pattern.
- `PasswordChecklist` (shared by register, set/change, and reset) renders: a progress bar toward the 8-character minimum (navy while typing, lime `#97EF29` when valid, red over 128); a status label — `n/8` counter → "Almost there" once length is met but rules remain → Good/Strong/Very strong ONLY when fully valid (tiers 8–11/12–15/16+, low-variety strings capped at Good); four ALWAYS-VISIBLE requirement chips (8+ chars / 1 uppercase / 1 number / 1 symbol, keys `PasswordChecklist.Rule*`) that flip grey→green with an SVG check per rule; and a guidance line only for the valid and over-128 states. Never show a strength word for an invalid password.
- Set/change/reset submit buttons stay disabled until the form is valid; register keeps Yup per-field errors on submit. Confirm-password mismatch uses `Validation.PasswordsDoNotMatch` and only shows once the confirm field has content.

---

## PUBLIC / SEO SURFACE (session 7, 2026-07-26)

Full detail in `clinqet-provider-public-page`. What matters when working anywhere in this app:

- **`/details` is gone (D25).** It rendered the same `BusinessProfile` component as `/{friendlyName}`.
  It is now a permanent redirect in `next.config.mjs` (`/details?id=X` to `/X`, bare to `/services`);
  the id-capturing rule MUST come first. Route, robots entry, analytics entry and `details.*` locale
  keys are all removed. Locked by `utils/duplicateSurfaceRedirects.test.js`.
- **Provider + service pages 301 to their canonical URL.** One rule —
  `canonicalRedirectFor(requested, canonical)` in `lib/server/providerPageData.js` — covers renames,
  rename chains (one hop), businessId URLs and case variants. `withQueryString` carries deep-link
  params through, so a 301 never breaks `?serviceId=...&book=1`.
- **Tap targets (D26).** `tap-44` and `tap-30` in `app/globals.css` expand the HIT AREA with an
  `::after` overlay and leave the control's own box alone — header density and type scale are
  unchanged. `tap-30` is for dense lists where a full 44px halo would OVERLAP its neighbours, which
  is worse than a small target. Never enlarge the icons.
  ‼️ A `getBoundingClientRect` check cannot see this fix; `C:\Nik\SEO\visual-audit.mjs` probes the
  real hit area with `elementFromPoint` after scrolling each control into view.
- **FAQ content is DATA**, not bundle copy. `lib/server/faqData.js` reads Cosmos `CodeDesc`
  (`type=faq`) per language; there is deliberately NO fallback copy — the deleted `DEFAULT_FAQ` had
  drifted from the stored set. Landing pages render the `landing` set with `FAQPage` schema; the
  computed count/price questions carry none.
- **Sitemap index** now also lists `/sitemap/services/{n}.xml`, pre-generated nightly into blob
  (Phase 8/D23). The names come from the published manifest — never a computed count.
- **Slug parity.** `lib/seo/slug.js` is the reference. Two mirrors exist by necessity (C# for the
  sitemap job, TS for mobile deep links) and all three are pinned to one shared corpus —
  `lib/seo/slugParity.test.js` and its two siblings. Change one, change all three.
## Localization baseline (2026-07-26)

- Active picker locales are `en-US`, `fr-CA`, `hi-IN`, and `gu-IN`. Japanese was removed. `es-US.json` is complete and key/placeholder-parity tested but deliberately not registered in the picker yet.
- English is the structural source of truth. Every authored locale must have the exact English key tree and placeholder set; `localeParity.test.js` enforces this.

---

## Progressive result loading (`/services`, `/service/provider`) — session 8, 2026-07-27

`components/common/LoadMoreControl.jsx` replaced the numbered pager **and** the "Per page" dropdown on
both listing pages. `services.page` / `services.previous` / `services.next` / `search.pageSize` were
deleted from all five locale files as orphans.

**The trigger is a real `<a href="?page=N">` that JS intercepts.** Googlebot neither scrolls nor clicks,
so a button-only control would leave every result past the first page undiscoverable. Scroll auto-loads
only `AUTO_LOAD_LIMIT = 2` batches (mirrored by `AUTO_LOAD_LIMIT` in the customer mobile app's
`src/config/searchConfig.ts`); past that it is a tap, which keeps idle scrolling off the search quota
and leaves the footer reachable.

Non-obvious rules, all pinned by tests:
- **Show-more never rewrites the URL.** `?page=N` means "start at page N" — rewriting it to the last
  loaded page would make refresh/back show only page 3 and lose 1–2.
- **The depth-capped envelope carries `TotalCount = 0`.** Guard before assigning, or a load-more
  response erases the real total.
- **Dedupe on append.** `$skip` paging can repeat a document when the index shifts mid-session, which
  would also collide on the React key.
- `hasMoreResults` gates on `reachedEnd || resultEnd >= totalCount || page + loadedPages >= totalPages`
  — a page that yields nothing is the real end, whatever the arithmetic says.
- The **base** depth cap renders in the top banner (there are no items to scroll past); a cap hit
  **during** accumulation renders in the control, where the visitor actually is. Two separate states.

`hooks/useSearchInteractionTracking.js` now derives the reported `page` from the absolute `position`,
because accumulation puts several pages in one list and the anchor page would attribute every click to
page 1.

## Landing sort / offers / subcategory — session 8

`components/customer/landing/LandingFilterBar.jsx` + client state in `LandingContent.jsx`, calling
`getLandingResults` in `services/discoveryService.js` (the **landing** endpoint, never
`/api/search/providers` — different card shape, different ranking).

- **State is client-only and never written to the URL.** A `?sort=` variant of a canonical landing URL
  is a crawlable near-duplicate, and the server payload lives in the Next **data cache keyed on the
  landing fetch URL**, so rendering filters server-side would mint one cache entry per combination and
  send every cold one to Azure AI Search.
- **The subcategory chip row comes from the FIRST payload.** A narrowed response only reports the
  subcategory you narrowed to, so re-reading it collapses the row to the chip just pressed.
- Returning to the default (`BestRated`, no offers, no subcategory) **issues no request** — the server
  already rendered exactly that list.
- The previous list stays on screen while a refinement is in flight; a failure keeps it and says so.

- ~~The provider PROFILE page cannot show badges~~ ‼️ **CLOSED session 18 (B1):
  `PublicBusinessProfileDto.Badges` shipped and the Open Page renders the full badge set.**
  2026-07-30): dev now serves `badges` with no `tier`/`isVerified` — the badge backend IS deployed.**

---

## ‼️ CUSTOMER-FACING PER-LOCATION OPENING HOURS (PHASE 8 PART C, 2026-08-04)

**One service can be sold from several locations whose hours differ, so the schedule a customer sees depends
on which location serves them.** Getting this wrong sends a real person to a locked door — that is the failure
the whole design exists to prevent.

### The ONE endpoint the customer surfaces read

```
GET /api/v1/public/business/{businessId}/locations?serviceId=      [AllowAnonymous]
    -> ApiResponse<PublicBusinessLocationsDto>
       { hours: PublicAvailabilityDayDto[7],      // the business week
         hoursDiffer: bool,
         locations: [ { name, isDefault, inheritsBusinessHours, serviceAreaIds[], hours[7] } ] }
```

- `AvailabilityController` → `IPublicBusinessLocationService` (`clinqetinfrastructure\Services\Tenancy\`).
- ‼️ **It accepts NO visitor signal — no coordinate, no area id, no header — ON PURPOSE.** The SSR surfaces it
  feeds are CDN/ISR-cached, so one URL must render one deterministic HTML. A route that *cannot* receive a
  visitor signal cannot vary by one, which makes SEO rule 1 structural rather than a review promise.
- **Omit `serviceId`** for the Open Page (every active location serves). **Pass it** on a service page to
  narrow to the locations that actually sell that service (`Service.ServiceAreaIds` → `ServiceArea.branchId`).
- ‼️ **It REPLACES the `/availability` call on a customer surface — never joins it.** Its `hours` is the same
  business week from the same projection (`Clinqet.Core.Services.Tenancy.PublicAvailabilityWeek`), so the
  request count is unchanged. `/public/business/{id}/availability` still exists and is untouched.
- **Cost:** 0 locations ⇒ 1 Cosmos partition read (the one the availability endpoint already did) + 1 SQL
  index seek that returns nothing, then **short-circuits**. 1 location ⇒ the same two. 2+ ⇒ + `ServiceArea`
  and, with `serviceId`, one `Service` point read. All `/businessId`-partitioned. **No cache — the page's own
  `revalidate = 3600` ISR is the cache**, and a second one would delay picking up edited hours.

### The four states — the ONLY correct rendering, and it lives in ONE module

`clinqetwebuserapp\lib\locations\hoursRenderingRules.js` **and its twin**
`clinqetmobileuserapp\src\lib\locations\hoursRenderingRules.ts`. Call `resolveHoursView(payload, areaId)`;
never re-derive a state.

| Situation | What the customer sees |
|---|---|
| **0 locations** | ‼️ **Bare hours, byte-identical to before this feature.** No name, no expander, no JSON-LD change |
| **1 serving location** | Hours **+ the location name** |
| **2+, same hours** | The hours **once** + "Available at N locations" + the names. **No expander** |
| **2+, different hours** | The **matched** location's hours + name, plus **"Other locations (N)"** with *Hours differ* |

**Matched, in order:** the `serviceAreaId` the customer arrived with → the business's **default** location.
On web that id comes from the clicked search result; on mobile from the device-location-ranked search result
(`isClosest`). **No permission / no search context ⇒ the default leads**, which is what keeps the two apps'
output identical (CB-4).

‼️ **Both modules are dependency-free and side-effect-free ON PURPOSE.**
`clinqetmobileuserapp\__tests__\customerHoursRenderingParity.test.ts` sandboxes the web copy and **fails the
build** on any divergence — including an uncovered export. An `import` in either file breaks the sandbox and
the spec throws rather than silently skipping.

### The rules that bite

1. ‼️‼️ **ABSENT ROWS MEAN INHERIT, NEVER CLOSED.** A location with no override of its own shows the
   *business* hours; only an explicit `isAvailable = false` row is closed. `BranchAvailabilityResolver`
   already encodes this — use it, never re-derive it. Reading absence as "closed" silently shuts every
   location nobody customised.
2. ‼️ **`!![]` is `true`.** An empty `locations` array is the 0-location ANSWER, not missing data. Test length.
3. ‼️ **A failed load is NOT the 0-location state.** `payload === null` ⇒ the "hours unavailable" sentence,
   and the booking CTA stays live. A payload that loaded with nothing configured ⇒ render nothing, exactly as
   before (that is what protects the byte-identity gate).
4. ‼️ **CB-3: the "Same as the business hours" label appears in the EXPANDER ONLY** — provider vocabulary
   must never land on the main block.
5. ‼️ **CB-2: the expander ships CLOSED with "Hours differ" on the header.** Closed without those words is a
   trap; open by default is the "never dump every location" failure.

### SEO — the five rules, and where each is enforced

| # | Rule | Enforced by |
|---|---|---|
| 1 | One URL, one deterministic HTML, never varies by visitor | The endpoint takes no visitor parameter (C1). **No `Vary` exists on either SSR route** |
| 2 | When hours differ, EVERY location's hours are in the server-rendered HTML | The SSR payload carries all of them; the expander only hides them visually |
| 3 | Location awareness is a CLIENT-SIDE highlight of content already in the DOM | `matchedServiceArea` is read in a `useEffect` after mount, so the first client render matches the server |
| 4 | Locations create NO new URLs | Nothing added to the sitemap, the slug set or the canonical |
| 5 | 0 locations ⇒ byte-identical output | `PublicAvailabilityWeek` is shared by both endpoints; the day rows were deliberately NOT changed (decision C2); `LocationHours` renders `null` in that state |

**JSON-LD (CB-1):** 0 locations or all sharing hours ⇒ **one** `openingHoursSpecification`, exactly as before.
Hours differ ⇒ **per-location `department[]`**, each with its own schedule, and the business-level one is
**dropped**. Both surfaces: `lib\seo\dynamic-seo.js` (Open Page) and `lib\seo\serviceSeo.js` (service page).
‼️ **NEVER a single business-level schedule that is only true at one location.**

### `serviceAreaId` — the passthrough (L80)

`IndexedServiceAreaInfo.ServiceAreaId` has been in the search index since Phase 4, but **both wire DTOs
dropped it** until Part C. It now travels `ServiceAreaDistanceInfo` → `ServiceAreaResultDto` → the client →
`serviceAreaId` on `DraftBookingRequestDto` / `BookingRequestDto` → `IBranchResolver`. It **only routes** —
never authorization, never money — so an absent or stale id resolves to the whole business and must never fail
a booking. Carried in `sessionStorage` (web) / memory (mobile), keyed per business, 30-min TTL. ‼️ **NEVER in
the URL** — a query parameter would make the SSR route dynamic and fragment the ISR cache.

### Localization

Location **names are provider-typed and NEVER translated.** Every label around them is a key: web
`locations.*` (7 flat ids × 5 files), mobile `LOCATIONS.*` (9 nested leaves × 5 bundles). ‼️ Mobile keys are
**nested** (i18next `keySeparator`) and use `{{name}}`; web is **flat** and uses `{name}`.

✅ **Weekday names are LOCALIZED on all four customer hours surfaces** (decision **C6** — the owner relaxed
the byte-identity gate in session, 2026-08-04). Web uses `day.{DayOfWeek}`; mobile uses
`FILTER_SCREEN.DAY_{DAYOFWEEK}` — **not** `COMMON.WEEKDAY_*`, which is the three-letter chip set.
‼️ **The defect had been CROSSED:** web was raw on the SERVICE page and localized on the Open Page, while
mobile was localized on service detail and raw on the Open Page — neither app was the correct one to copy.

‼️ **`LocationHours`'s `formatDay` prop is REQUIRED and THROWS when absent.** Its old optional default
returned `day.dayOfWeek`, which is exactly how untranslated names shipped. **Never reintroduce a fallback.**

---

## ‼️ PHASE 13 PART 2 (2026-08-06) — a dead prototype route was DELETED from this app (owner-approved)

`app/(admin)/add-business-information/` and `components/admin/add-business-information/form/BusinessDetails.jsx`
were a **504-line three-step "add your business" wizard with no backend at all**:

```jsx
onSubmit={(_values) => { setActiveTab(2); }}
```

`grep` for `fetch(` / `axios` / `apiClient` across all 504 lines returned **zero**. It validated, advanced a
local tab, and never sent anything anywhere. It also carried **hardcoded English** throughout (34 flagged
strings), hardcoded three Gujarat cities as `<option value="option1">Suarat</option>` / `Valsad` / `Bhuj`
**with a typo in the first**, and duplicated **provider onboarding inside the CUSTOMER app** — provider
onboarding is `clinqetwebpartnerapp/src/app/onboarding`.

‼️ **`routes/routeConfig.jsx` had ALREADY commented its route constant out** under a
`// ===== ADMIN ROUTES - REMOVED =====` heading, so it was unlinked — **but it was still a real Next route
served on a real URL**, and it was still registered in three separate lists.

> ✅ **DELETED 2026-08-06, owner-approved in session (decision FE13).** Do not reintroduce it. If provider
> onboarding is ever wanted on the customer app, that is a new feature with a mockup gate, not a restoration.

### ‼️ What a deleted route leaves behind here — three lists a `find` over `app/` will never surface

| List | Why a stale entry is wrong |
|---|---|
| `next.config.mjs` — the `no-store` `source:` alternation | a header rule matching a path that no longer exists |
| `services/analyticsTracker.js` — `STATIC_TOP_SEGMENTS` | ‼️ **any single segment NOT in this set resolves to the `[friendlyName]` provider page**, so a stale entry misclassifies a real Open Page |
| `utils/headers.routes.test.js` — `ACCOUNT_SCOPED` | its `covers every account-scoped route` case iterates this list against the config regex, so the two must move together |

Plus the commented-out constant in `routes/routeConfig.jsx`, which promised *"Uncomment to restore admin
functionality"* — no longer true, and `CLAUDE.md` §0.14 forbids commented-out code regardless.

**Guarded by `utils/bookingProviderSlug.test.js`'s `dead surfaces are gone, not merely unlinked` block** —
the codebase's existing home for exactly this class — which now asserts all five deleted paths **and** that
none of the four files above still names the route. **Sabotage-verified: restoring one file and reinstating
one list entry fails exactly those two cases, and only those two.**

### Also measured on 2026-08-06

- **jest: 744 in 61 suites. ESLint: 546 files, 0 errors, 3 warnings.**
- **Raw emoji / AI-looking glyphs: 0.**
- The remaining inline-English hits are `alt` attributes on brand marks (`alt="Clinket"`, `alt="Image"`),
  decorative rather than prose — recorded, not fixed, and outside the multi-user provider programme's surface.
- ‼️ **This app has no AST-based inline-English guard**, unlike both mobile apps
  (`src/Locales/sourceLocalizationIntegrity.test.ts`). `utils/localizationContracts.js` covers **dynamic key
  domains**, which is a different question. **A guard here would be worth building.**

## Two-stage suggest in SearchBox (search-performance Phase 5, 2026-08-10)
`components/common/SearchBox.jsx` (the ONE suggest component — home hero, header, search page,
providers page, city landing, quote form, address modal) now fires a `scope=Completions` request
per debounced keystroke (instant text completions from the API's RAM prefix store) and a FULL
suggest 250 ms later whose service cards join the same dropdown. Stage 2 never wipes a rendered
list with an empty answer; passing `scope` in `suggestionContext` restores single-request behavior.
Mobile mirrors the same rendering rules in `clinqetmobileuserapp` searchScreen.

## /services instant-commit skeleton + prefetch (owner-approved, no mockup, 2026-08-10)
The `/services` index page lives in the route group `app/(customer)/services/(search)/`
(`page.js` + `loading.js`) so its skeleton boundary covers ONLY the search results URL.
‼️ NEVER move `loading.js` up to `services/` — the SEO landing pages beneath
(`[categorySlug]`, `[categorySlug]/[citySlug]`, `city/[citySlug]`) call `notFound()`, and a
loading boundary above them streams a 200 shell before `notFound()` runs = the 2026-07-25
soft-404 defect; `utils/notFoundStatus.test.js` fails the build on exactly this. The skeleton
mirrors ServicePageContent's layout + its in-page card skeleton (pure shimmer, no text ⇒ no
locale keys). The home hero (`dashboardBanner.jsx`) prefetches `/services` once on first
search-box focus (`onFocusCapture` → `navigation.prefetch`), so a suggestion click commits
instantly to the skeleton even when the dev server is cold (~2 s RSC fetch observed). No mobile
change: RN navigation is local — searchScreen already owns its results loading state.

---

## ‼️ ACCOUNT MENU — ORDER, LABELS AND THE OVERFLOW CUE (2026-08-15, owner-approved)

### The account sidebar had the same hidden-scroll defect as the provider rail

`components/layout/customer/accountSidebarLayout.jsx` renders the desktop nav as
`sticky top-5 max-h-[calc(100vh-40px)] overflow-y-auto **no-scrollbar**` — a capped-height scroller with
the bar suppressed, over 20 rows in three groups. It now carries the same measured edge cue as the partner
rail, via `hooks/useVerticalOverflow.js`.

- ‼️ **The palette INVERTS.** The partner rail is navy ⇒ navy fade + **lime** chevron. This panel is white
  ⇒ **white fade + NAVY chevron**. Lime marks the SELECTED row here and would fail contrast on white.
- ‼️ **`sticky` stays on the OUTER element.** The scroller moved inward and the cues are its siblings;
  moving `sticky` inward unpins the whole panel.
- `no-scrollbar` was deliberately KEPT — option C (fade + chevron, no bar) is what was approved.
- ‼️ This app's ESLint forbids `/* global ResizeObserver */` (`no-redeclare`) and errors on
  `react-hooks/set-state-in-effect`, so the hook is observer-driven with **no synchronous `measure()` in
  the effect body**. The partner twin needs the global comment. Keep the two hooks otherwise in step.

### Order — three silent runs, no new headings

`accountSidebarNav.js` `NAV_GROUPS[0]` is now: Profile Information · **Addresses** ‖ Bookings · Quotes ·
Messages · Reviews ‖ Invoices · Payments. Addresses used to sit **between Invoices and Payments**,
splitting the two money rows. The three groups themselves are unchanged.

### ‼️ "My" is gone from every row — the heading already says it

The group is headed **"My Account"**. Repeating "My" on each row said the same word twice, and five of the
eight rows already omitted it. Now: `myBookings` → **Bookings**, `myReviews` → **Reviews**,
`myInvoices` → **Invoices**, `manageAddresses` → **Addresses**; and the destinations they open agree
(`reviews.myReviews`, `customerInvoices.title`, `manageAddresses.MyAddresses`, plus the header/button
copies). **KEYS ARE UNCHANGED — only values.**

- ‼️ **`accountSidebar.group.myAccount` KEEPS its "My"** in every language. It is the thing that
  establishes ownership; strip it and the rows below lose their context.
- ‼️ This fixed a live casing bug: `"My invoices"` sat two rows under `"My Bookings"`.
- The product-wide rule: **ownership is established by the context, never repeated on the row.**
- Non-English values were changed by **stripping the possessive determiner only** — the noun is exactly as
  authored.

### Customer mobile mirrors this row for row

`clinqetmobileuserapp/src/screen/profile/MyProfileScreen.tsx` carries the same order and the same labels.
‼️ **`Payments` moved from ACCOUNT MANAGEMENT into MY ACCOUNT**, where web has always had it — it was
split from Invoices, the row it belongs beside. Both rows stay gated on `payments.onlineBookingPayEnabled`.

## SEARCH-TOPOLOGY PHASE 3 — the customer web app (2026-09-22/24)

Server side: `clinqet-search-discovery` → "PHASE 3". The web app's half:

- **The server names every place.** `context/LocationContext.jsx` makes NO Google geocoding call and has no IP
  fallback; it stores only a MANUAL pick, as coordinates only (a device fix is never stored); it exposes the
  server's `resolvedPlace`, the location source and "Anywhere". `services/placeService.js` wraps
  `GET /api/search/place` (per-request language).
- **The place chip** — `components/customer/services/ResolvedPlaceChip.jsx` + `lib/search/placeChip.js` — renders
  the server's `ResolvedPlaceDto` (cross-country, ambiguous, lookup failed, outside our countries, offline);
  `components/common/LocationPermissionModal.jsx` doubles as the place picker ("Anywhere" lasts for the session).
  The "outside our countries" empty state names the place. No mockup beyond the approved sheet; the providers page
  has no chip (not on the sheet — owner decision).
- **One price formatter (D-68)** — `utils/servicePrice.js`, `components/common/ServicePriceLine.jsx` (amber
  extras flag, never truncates) and `ServicePriceDetails.jsx`: the minimum IS the price, a blank price type is read
  from the stored amounts, schema.org declares the card's figure. `utils/cartPricing.js` is deleted. ‼️ The cart
  books max(price, minimum) — a money behaviour change to confirm against the server in the audit.
- **Quote form (B-18)** — `components/customer/quotes/quotePlace.js` + `QuoteCreateForm.jsx`: coordinates and
  ISO country only of the quote's OWN place (a pick; the device only while the field holds its own city; a typed
  city resolved through the place endpoint on blur / Enter / submit, stale answers dropped); country NULL when
  unknown, never the visitor's; the budget currency follows the destination; a 400 shows the server's sentence.
  `utils/currency.js` maps all 24 listed countries (the server prices every one of them via RegionInfo).
- Copy: every new string is a key in all five `public/lang/*.json`; orphaned keys were removed in the same change.

## PHASE 3C CLOSE-OUT — customer web (2026-09-25)

- **Rails cache (R-1g).** `services/discoveryService.js` key is `clinket_disc_rec_v4_{identity}_l{lang}_c{country}_lat{2dp}_lng{2dp}_ps{n}` —
  the server's own rails-cache dimensions. `country` is `useCountry().detectedCountryCode` (the Front Door country the server
  answers a point-less request from; null when it only named its default) and is never sent. Every caller (trending rail, banner,
  quote-form hint) waits for `useCountry().countryChecked` (this page load's `/public/locale/country` answered or failed) so no
  answer is stored under an earlier visit's guess, and asks again when the country changes. v2/v3 entries are purged once per session.
- **A range with only a maximum is a ceiling (UW-29).** `PRICE_KIND.UP_TO` → "Up to $150" (`search.priceUpTo`). The server books
  it at `start ?? max`, so a floor BELOW the ceiling leaves "Up to" (the floor shows on the detail page), a floor equal to it reads
  "$150", above it "$200 minimum". Invariant, pinned: every non-hourly card figure equals `serviceBookingPrice`. schema.org:
  `serviceOfferPrice` returns `{ maxPrice, currency }` and `serviceSeo.js` publishes `priceSpecification: { "@type":
  "PriceSpecification", maxPrice, priceCurrency }` with NO `price`. The cart line (`CartItemDto.Pricing`, M2) and the recently-viewed rail
  (`RecentlyViewedItemDto.MaxPrice`, M6b) now say "Up to" too — see the two bullets below.
- **Travel row ⇔ distance note (UW-28).** A travel fee always gets its row; with no (or an unknown) distance unit the value is
  `service.extras.travel.addedByProvider` ("Added by the provider when they confirm"), `later: true`, rendered as wrapping words —
  never a bare number. The distance note is derived from the travel row, so the two cannot disagree.
- **Unnamed pick (UW-9).** A picked place with no words (a reload keeps coordinates only, D-78) that nothing could name shows
  `search.location.pickedNoName` ("Near the place you chose") + Change — the phone's wording. Never a hidden chip.
- **Naming retries (UM-11).** `namePlaceWithin` (`services/placeLookup.js`) names every point `LocationContext` holds: each try
  keeps the 4 s cap; 2 retries at ~1 s then ~3 s (±25% jitter) on 429 / 5xx / `ERR_NETWORK` only — never another 4xx, never a
  try that hit its own cap; the caller's signal ends the wait and the try. Typed-place lookups keep ONE try (someone is waiting).
- **Price filter chips.** `lib/search/priceFilterChip.js`: the band is money in the search's currency — the results' single
  currency, else the answering country's (`resolvedPlace.countryCode`); results in several currencies name none (locale-grouped
  number). Both `/services` and `/service/provider`.
- **Offer hours.** `formatOfferTimeWindow` (`utils/offerFormatting.js`) draws the stored `HH:mm:ss` wall-clock times with
  `intl.formatTime` (12/24 h as the locale is); joined by `cart.Offer_Time_Range` / `cart.Offer_Repeat_AtTimes`. A half-read
  window shows no hours.
- **Deleted.** The 196 `landing.{Hero,Benefits,HIW,Reviews,Services,Partners,ComingSoon,Footer}.*` keys (rendered nowhere — proven by
  whole-key and completable-prefix scans); `components/layout/customer/model/cartManu.jsx` (unmounted since February) with its
  only-used `string.jsx` entries and `cart.moreItems` / `cart.viewCartWithCount`; `messages.pricePerHour` ("/hr").
  `utils/claimHonesty.test.js` now sweeps EVERY key for retired price promises (a hand-kept list had drifted onto dead keys);
  an exemption needs a stated reason.
- **Server-priced cart (Q-1).** Every cart answer (GET, save, patch, remove, merge, promo) is priced by the server and is the
  truth: `applyServerCart` (`store/cartSlice.js`) takes it and rewrites the device copy, so a line the server DROPPED (service
  gone / no set price) never comes back. The save body is choices only — `{ serviceId, quantity, locationType, isAtStore,
  isAtCustomersLocation, note, image fields, categoryName, subcategoryName }`, never a price, type, discount, name or category
  id. Each line carries `pricing` (the service's CURRENT catalogue price) and `formatCartLinePrice` reads it by the card's rule
  (so a ceiling reads "Up to"), rendered through `ServicePriceLine` without the extras flag. `removeProviderFromServer`
  (a booking) passes `keepScreen` so its answers never repaint the confirmation. The promo call returns the priced cart too.
- **Recently viewed** rows carry `maxPrice` (only for a range with a ceiling and no start); `pricingFromRecentlyViewed` folds it in.
- **Copy.** `aboutUs.transparencyBody` no longer promises "no surprise fees": the checkout total includes any visit fee; a travel
  fee is flagged and added by the provider when they confirm (phone parity).
- **Searched point, not a slug-matched city (L8).** The home hero (`getHomepageBanner(city, { country, lat, lng })`) and the
  no-city category page (`getLandingResults({ ..., lat, lng, country })`) send the searched place's point as its 2 dp cell
  (`lib/search/placeCell.js`), with the place's ISO country; the hero's `city` is only the label and its in-tab cache key carries
  the cell. The hub narrows only for a NAMED place (the chip "Near {place}" must say what narrowed it), dismissing the chip drops
  the point, and a `/category/city` page keeps sending its own city. The old `otherCities` slug match is gone (it dropped every
  non-English name and every place outside the top cities); `otherCities` remains only for its links.

## Remembered sessions (2026-09-28)

Superseded 2026-09-29 by the cookie-renew model (`clinqet-auth-sessions` §8, `clinqet-ui-common` "Session model"): the access token lives in page memory (`utils/sessionStore.jsx`), restores through `POST auth/session/renew`, and no refresh token or Web Lock exists. `useAuthGate` has an "unavailable" state (`SessionRestoreRetry`, bounded backoff 2s/5s/15s/30s/60s, manual retry always works); only `session_ended` ends a session. Cart, profile, notifications and SignalR results carry the auth epoch and are dropped when it moved; `clinket_user_addresses` is `{ownerUserId, addresses}`; `authReturnUrl` is validated by `utils/authReturnUrl.js` everywhere. Production CSP: `lib/contentSecurityPolicy.mjs` via `next.config.mjs`.

**Audit round 2 (2026-09-30):**
- `renewSession` records the auth epoch at start and never adopts once it moved or a sign-out is pending
  (`{superseded}` / `{signOutPending}`); `supersedeRenewals()` on a cross-tab `SignedIn`/`SessionReplaced` so a renewal
  started for the old account never adopts. `session_transport_required` stops auto-retry (`isSessionTransportRefused`).
- Sign-out: pending marker → local clear → logout with the captured bearer; a pending load clears leftover account data.
  `postLogoutAll` retries at most once, and only after a 401 with no errorCode or `session_ended` (both mean
  `[Authorize]` refused before `RevokeAllSessionsAsync` ran), after one renewal; the retry is checked by account (sub),
  not SessionId, so it may go out under another live session of the same account — deliberate, since logout/all revokes
  every session of that account. The page claims success only when confirmed
  (`mfaSetup.SignOutAllDevicesPartial|Unconfirmed`). `endSessionIfCurrent` renews once first (B10). The unconfirmed
  sign-out notice also shows from `DeleteAccountModal` and after `handleRecentSignInRequired` (one-shot
  `clinket.auth.signOutNotice`).
- Social exchange: only Identity's own enveloped 4xx means "nothing issued"; anything else runs
  `abandonUnfinishedSignIn` (marker first, logout, marker cleared on 200 only).
- B1: `AuthModal`, header panels, cart, message actions show the neutral/loading state while checking and
  `SessionRestoreRetry` when unavailable — sign-in prompts only when settled signed out (`useAuthGate.currentAuthStatus`).
- Language: one resolver `utils/uiLocale.js` `readUiLocale` (stored readable choice → the account's `preferredLanguage`
  held in memory for the session → browser languages → `en`); the profile fetch adopts the account language in memory
  only (`adoptAccountUiLocale`) and every purge forgets it (`forgetAccountUiLocale`) — an account default never becomes
  the device's choice. Legacy `refreshToken` / `keepMeSignedIn` are swept at load.
- CSP adds `*.g.doubleclick.net` (connect/img), Azure SignalR (`https://`/`wss://*.service.signalr.net`) and
  `https://*.razorpay.com` (Razorpay's documented allow-list). `authReturnUrl.test.js` scans the whole tree with a floor.

**Audit round 3 (2026-09-30):**
- `getValidAccessToken`: after a failed or overtaken renewal it returns the held token only when it is the same session
  (sub + SessionId + BusinessId) as the token the caller started with; otherwise `null` — never another account's token.
  The identityApi interceptor omits `Authorization` when there is no token (`bearerHeaders`), never `Bearer null`.
- Account pages gate their own loads on `useAuthGate() === AUTH_SIGNED_IN` with the gate in the effect deps
  (manage-addresses, my-invoices list/detail + its focus refresh, quotes/[id], settings/payments, settings/notifications,
  the messages inbox, the `providerId` deep link's `createConversation` and the `conversationId` link), so a successful
  "Try again" loads them in place. `api.js` joins a restore in flight but never starts one after a failure
  (`isSessionRestoreFailed()`); such a request is refused quietly (`__authRequired`) — only `SessionRestoreRetry` and
  the automatic back-off restart it.
- A security-change success is adopted only if no sign-out is pending and the auth epoch has not moved since the request
  was sent (`adoptContinuedSession(session, epochAtStart)`); otherwise the pending marker is set, this tab's local
  session ends if it still holds one, and the returned token is logged out (bearer + cookie); the marker clears on 200.
- `discoveryService` records the auth epoch at send and caches an answer only if it has not moved.
- `SessionStore.clear({ keep })` removes each non-kept key one by one (the sign-in purge keeps a guest cart with
  `keep: ["clinqet_cart"]`); a cross-tab purge in a tab holding no session keeps its sign-in/registration/reset values.
- `SessionStore` counts account replacements (`currentAccountScope`: moves only when a token for a different `sub`
  replaces the last one the tab held — never on a renewal, a sign-out or the first restore).
  `components/common/AccountScoped.jsx` (`useAccountScope`) wraps the `bookings`, `messages`, `my-invoices`,
  `my-profile`, `my-reviews`, `notifications`, `quotes` and `settings` layouts, so an in-place account switch
  remounts those pages; `PolicyConsentChecker` has the scope in its deps and checks again for the new account.
- CSP connect-src/img-src add `https://*.google.ca` and `https://*.google.co.in` (GA4 Google-signals regional beacons;
  google.com via the Maps list). `lib/contentSecurityPolicy.test.js` scans this repo's source (root = `package.json`
  beside `next.config.mjs`, floor 400 files) for every `http(s)`/`wss` host; each must be allowed by a fetch directive or
  listed in `NEVER_FETCHED` with a reason, and stale or redundant exemptions fail.
- SignalR: one `renewSession()` per refused token; a hub that refuses the renewed token too is not renewed again until a
  different token exists (the 30 s health check retries without renewing).
- `verifyEmailForm` reads the phone-code requirement through `useSyncExternalStore` (server snapshot null;
  `rememberPhoneCodeRequirement` notifies). Deleted: `components/common/AuthGuard.jsx`, `utils/countryList.jsx`.

## Post-ranking follow-ups (audit 2026-10-01) — Book again after a no-show (W15), "Serves …" cards (W8)

- **W15** (sheet `bookings-list-book-again-no-show`): `components/customer/myBookings/myBookingsTabs/bookingsInfoBox.jsx`
  `canBookAgain = status === "Completed" || status === "NoShowProvider"` — the same `handleBookAgain` add-to-cart action
  and the existing key `myBookings.bookAgain`. Tests `bookingsInfoBox.bookAgain.test.jsx`. Phone parity:
  `canBookAgainFromList` (`clinqet-customer-mobile`).
- **W8 "Serves {area} · Based in {city}"** (sheet `customer-cards-serves-area`; server rule in `clinqet-search-discovery`):
  `utils/servedArea.js` — `servedAreaLines` (null without a served area ⇒ the card is unchanged) and `distanceSortKm`
  (0 when served here, else the served-area distance, else `distanceKm` — the "View all" client re-sort uses it) —
  via `hooks/useServedAreaLines.js`. Cards: `common/workerViewedCard.jsx` (no distance pill when a served line shows),
  `services/ServicePageContent.jsx`, `providers/ProviderPageContent.jsx`, the rails, `app/(customer)/service/[id]/page.js`.
  Keys `search.card.servesArea` / `servesAreaAt` / `basedIn` in all five `public/lang/*.json`.
- ‼️ The home trending rail spreads the WHOLE card (`...item`) into `WorkerViewedCard`, so `servedArea` and `basedInCity`
  arrive (audit C-1 was false) — pinned by `components/customer/dashboardTrendingServices/dashboardTrendingServices.test.jsx`.
  Never narrow that mapping to a field allow-list.

## 2026-10-03: consent, register row

- Consent: `services/cookieChoiceRecord.js` + the `PolicyReconsentModal` listener; `PolicyConsentChecker` only reads consent-status (its blind cookie sync is gone); `CookieConsentBanner` is a non-blocking bottom card. See `clinqet-ui-common`.
- Register: `ThirdParty` shows every option; divider `Auth.Continue_With`.

- Audit follow-ups 2026-10-03: see `clinqet-ui-common` "Audit follow-ups" (per-emit consent answers, session-keyed record, banner focus and fixed-bar reservation). The sign-in row is ONE line at every width (`clinqet-ui-common` "One line, every width", 2026-10-04).

## Consent: one question at a time (2026-10-03)

See `clinqet-ui-common` "Consent model — one question at a time". It covers: nothing on sign-in surfaces; a small bottom cookie card (per device); one signed-in agreements dialog that carries the cookie question when this device has not answered it; Terms + Privacy only on Register and on the server. Customer web: `lib/consentSurfaces.isSignInScreen` (`/auth/*`); guests see the card on every other page. The auth pages no longer pad for the card.
