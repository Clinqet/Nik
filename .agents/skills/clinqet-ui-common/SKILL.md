---
description: |
  **UI COMMON PATTERNS SKILL** — Cross-cutting frontend patterns shared across all 3 Clinqet web apps (Partner, User, Admin). USE FOR: Tailwind styling, forms/validation, auth/token handling, API clients, localization, toast notifications, loading states, SignalR, error boundaries, SEO, responsive design.
---

# CLINQET UI COMMON PATTERNS — COMPREHENSIVE SKILL

## RECENT CHANGES — 2026-10-06 (patterns this programme set across the apps)

See the `clinqet-prepared-providers` skill for the whole feature. Patterns worth reusing:

- ‼️ **A "Set password" vs "Change password" menu label reads `hasPassword` from the profile** (`readHasPassword`, in every app). Undefined means "not loaded yet" and reads as "has one"; the page itself switches on the real answer.
- ‼️ **A transient failure must never be drawn as a dead end.** Offline and "we couldn't load this" are their OWN states with their own titles — telling somebody their link is dead when the network hiccupped is how they give up.
- ‼️ **A long-lived token in a link is read ONCE and removed from the address bar** (`history.replaceState`), and sent to the API in a HEADER, never a query string — a query string is written into request telemetry.
- **A code screen says which way the code came.** One screen serving both email and phone must branch its description, or it tells people to look for a text that was never sent.
- **"Resend code" is the SAME send, not the two-step resend** — the two-step endpoint refuses outright on an account with two-step off, so Resend silently never worked.
- **A tab title set by a side effect reads the intl CONTEXT, not `useIntl()`** — `useIntl` throws with no provider above it, and a cosmetic title must never take a page down.
- **A localized label for a value the server stores in English** (a search facet, a stored enum) maps through the app's own key map; never render the raw stored word.
## ABSOLUTE RULES (READ FIRST — APPLIES TO EVERY CHANGE)

- **Comments — terse, only when they earn their place.** Default to no comments; let naming carry the meaning. **However**, write a comment when it captures non-obvious context the code itself cannot show: a hidden invariant, a subtle ordering constraint, a deliberate workaround for a known bug, a defensive choice with a real reason, or an RFC/spec citation that explains *why*. Prefer a single short line. Forbidden: restating WHAT the code does (e.g. `// increment counter` above `counter++`); multi-line narrative blocks explaining design rationale; XML doc summaries on properties whose names already convey intent; commented-out code; `// TODO` without an issue link. When in doubt, delete the comment — but don't strip a *real* WHY-comment just to chase zero.
- **No verbose docstrings on self-evident members.** A property named ``EnableAISpellCorrection`` does NOT need a doc summary. A field named ``_searchEnableAISpellCorrection`` does NOT need a multi-line ``//`` block above it. Trust naming.
- **No commented-out code, no leftover symbols, no ``// TODO`` without an issue link.**
- ‼️ **NEVER `defaultProps` on a function component — React 19 DROPS IT SILENTLY.** Partner and User are React 19 on the automatic JSX runtime (`tsconfig.json` → `"jsx": "react-jsx"`), and `jsx()` never reads `Component.defaultProps`: the prop arrives `undefined` with no warning, no lint error and no test failure. This took `/dashboard/search` down **completely** — `AskBox.defaultProps.placeholderId` never applied, so `formatMessage({ id: undefined })` threw out of `@formatjs/intl`'s `invariant` and the route rendered its error boundary on **every visit for every member**, for as long as the code was live, while the suite stayed green. **Put defaults in the destructuring parameter list**: `({ placeholderId = "BusinessSearch.Ask.Placeholder" })`. `propTypes` is dead the same way — it warns about nothing under React 19, so it is documentation, never a guard. Machine-checked by `clinqetwebpartnerapp/src/lib/defaultPropsAreDeadUnderReact19.test.js`. Class components still honour both, and Admin is React 18 where both still work — neither is a reason to use them.

---


## OVERVIEW

Three frontend applications sharing common patterns, libraries, and design language.

| App | Framework | React | Tailwind | State | Path |
|-----|-----------|-------|----------|-------|------|
| **Partner** | Next.js 16.1.6 | 19.2.0 | v3 | Redux Toolkit | `clinqetwebpartnerapp/` |
| **User** | Next.js 16.0.6 | 19.2.0 | v4 | Redux Toolkit | `clinqetwebuserapp/` |
| **Admin** | CRA 5.0.1 | 18.3.1 | v3 | Context API | `clinqetwebadmin/` |

---

## BRAND DESIGN SYSTEM

### Colors
| Color | Hex | Usage |
|-------|-----|-------|
| Primary (dark blue) | `#032858` | Headings, button loader dots, icons |
| Accent (neon green) | `#97EF29` | Focus borders, toggles, CTAs |
| Error (red) | `#FF3B30` | Error borders on inputs |
| Input background | `#F5F5F5` | FloatingInput background |
| Admin primary | `#032858` | Admin theme (Tailwind `primary`) |
| Admin accent | `#97EF29` | Admin theme (Tailwind `accent`) |

### Font
**Lufga** — applied via `font-[Lufga]` class (inline, not in Tailwind config).

### Responsive Breakpoints (Partner & User)
```
xs: 320px, sm: 480px, md: 768px, lg: 1024px, xl: 1280px, 2xl: 1536px, 3xl: 1920px, 4k: 2560px, 5k: 3840px
```
Admin uses Tailwind defaults only.

### Responsive Font Sizes (clamp-based)
```
responsive-xs:   clamp(0.625rem, 1.5vw, 0.75rem)
responsive-sm:   clamp(0.75rem, 1.8vw, 0.875rem)
responsive-base: clamp(0.875rem, 2vw, 1rem)
responsive-lg:   clamp(1rem, 2.5vw, 1.125rem)
responsive-xl:   clamp(1.125rem, 3vw, 1.25rem)
responsive-2xl:  clamp(1.25rem, 3.5vw, 1.5rem)
responsive-3xl:  clamp(1.5rem, 4vw, 1.875rem)
responsive-4xl:  clamp(1.875rem, 5vw, 2.25rem)
responsive-5xl:  clamp(2.25rem, 6vw, 3rem)
```

### Safe-Area Spacing (Partner & User)
`safe-top`, `safe-bottom`, `safe-left`, `safe-right` using `env(safe-area-inset-*)`.

---

## AUTH PATTERN

### Session model (all three web apps, 2026-09-29) — server rules in `clinqet-auth-sessions`

No web app stores a token or a refresh credential. There is **no BFF** (owner decision D6): the session is an
HttpOnly, Secure, SameSite=Strict `__Host-ClinketSession-{Business|Customer|Admin}` cookie on the Identity host,
and script holds only the 10-minute access token **in page memory**.

| Rule | Partner | User | Admin |
|---|---|---|---|
| Access token | memory (`SessionStore`, legacy `token` swept) | memory (`sessionStore.jsx`) | memory (`utils/session.js`) |
| Restore on load / new tab | `POST auth/session/renew` once per page load (`sessionRecovery`) | renew (`sessionService` + `useAuthGate`) | renew (`renewSession`) |
| Every cookie call | `X-Clinket-Session-Transport: cookie`, `withCredentials`, `appType` | same | same |
| Replay a refused request | only under the same sub + SessionId + BusinessId; `session_context_changed` never | same | same |
| `session_ended` | acts only for the tab's current session; one renew first (another tab's security change) | same | same |
| Sign-out | `clinket.auth.signOutPending` set first, local purge at once, marker cleared ONLY by HTTP 200 (Identity keeps the cookie on 503); no tab renews while it is set; retried per load and per `online` | same | same |
| Sign-out order + sign-in in flight (Partner, 2026-09-30) | marker → purge + announce → route to login → `POST logout` (cookie only); a 200 settles only the marker that sign-out wrote; `clinket.auth.signInInFlight` (60 s) blocks every pending-logout retry while a sign-in is on the wire; every sign-in purges inside `persistSignInSession`; a cancelled request is silent in `showError`/`resolveErrorMessage` | — | — |
| Retry-After | capped at 30 s | not read: the restore backs off 2, 5, 15, 30, 60 s | capped at 30 s (`MAX_RETRY_AFTER_SECONDS`) |
| Stored values | plain JSON; legacy CryptoJS `U2FsdGVkX1…` values treated as absent and removed | same | `jsonStorage`, same |
| Password reset (A1) | grant only in the HttpOnly `__Host-ClinketPasswordReset-Business` cookie; `password_reset_expired` restarts, any other 400 keeps the new-password step | `…-Customer`, same | no reset flow |
| Kept across sign-out | `x-device-id`, language, country, remembered email/OTP id, view prefs, the pending marker | same set + location/AI nudges | `x-device-id`, theme, language, rememberedEmail |
| Clearing (2026-09-30) | ‼️ remove each non-kept key — never `clear()` + write-back (a write-back fires a storage event per tab: two tabs purged each other forever); a tab with no token and no account data ignores a cross-tab purge | `SessionStore.clear({ keep })` removes each non-kept key one by one (the sign-in purge keeps a guest cart with `keep: ["clinqet_cart"]`); another tab's purge (`clearTab`) in a tab holding no session (no access token, no tab `userId`) keeps its sign-in/registration/reset values in sessionStorage, while its memory is still reset (the epoch advances) | same |
| Late answers | an answer to a request sent before the session epoch moved is dropped (`apiClient` epoch; renewals too) | `authEpoch` on every restore/renewal; `supersedeRenewals()` on a cross-tab sign-in | generation check (`endAfterFailedRenew`) |
| Fast device clock | `MIN_TRUSTED_LIFETIME_SECONDS` 120: a token arriving with ≤120 s left is renewed only on a 401 | same rule | — |
| Language after the CryptoJS sweep | stored choice → account `preferredLanguage` (no new request) → browser languages → `en` | `readUiLocale`: stored readable choice → the signed-in account's `preferredLanguage`, held in memory for that session only (`adoptAccountUiLocale`; every purge calls `forgetAccountUiLocale`; never written to `selectedLanguage`) → browser languages → `en` | — |

`NEXT_PUBLIC_SESSION_SECRET` / `REACT_APP_SESSION_SECRET` are gone (the key shipped in every bundle, so the old
"encryption" was obfuscation). One base64url + UTF-8 JWT decoder per app (`jwtClaims.js` / `utils/jwt.js`).
Production CSP (D12) is built per stamp in `next.config.mjs` (`lib/contentSecurityPolicy.*`) and in the admin
`server/server.js`; allow-lists come from the code (API/Identity/wss, asset hosts, GTM/GA, Maps, reCAPTCHA, Stripe,
Razorpay, and on partner Telnyx/Plivo). `'unsafe-inline'`/`'unsafe-eval'` stay: no nonces (keeps static
rendering), and Google Maps JS plus the HEIC converter evaluate code.

### Customer Web External Login Handoff
- Start browser social login and registration with `responseMode=SecureCookieExchange` plus a validated HTTPS `returnUrl`; the success URL contains only `external_login=complete`.
- Exchange the Identity HttpOnly cookie through credentialed POST `/auth/providers/login/exchange/web` with `X-Clinket-External-Login: exchange`. Tokens are returned in the JSON body, never in the new-flow URL.
- Seed callback loading from server `searchParams` as a boolean only. Never pass token/error values into server-rendered component props.
- Remove callback parameters with `history.replaceState`; router navigation is forbidden for cleanup because it re-renders the route and creates a second home load.
- Protect callback responses with private no-store, no-referrer, and noindex/nofollow headers that override public route caching, and suppress GA/GTM until the browser query is clean. Only explicit secure-mode callbacks guarantee secret-free HTML.
- Query-token parsing exists only for a web-first deployment against old Identity. New Identity rejects `LegacyUrlTokens` for customer `AppType.Clinket`.

---

## API CLIENT PATTERN

### Observability Headers (ALL apps)
Every HTTP request includes:
```
X-Correlation-Id: {timestamp}-{random}
X-Session-Id: sessionStorage (created on first use)
X-Device-Id: localStorage (crypto.randomUUID())
X-Client-Version: from env var
Accept-Language: user locale or browser language
```

### Partner — Multi-layer Architecture
```
apiClient.js (single axios instance, baseURL = Identity API)
  ├── Request interceptor: Bearer token from SessionStore
  ├── Response interceptor: 401 refresh, 403 redirect, 429 log
  └── Verb wrappers: getApi.js, postApi.js, putApi.js, patchApi.js, deleteApi.js
        └── Service files: bookingServices.js, quoteServices.js, etc.
              └── URL constants: url.js (validates env vars server-side)
```

### User — Single Instance
```
api.js (axios instance, baseURL = Main API /api/{version})
  ├── Request: Bearer from localStorage
  ├── Response: 401 → redirect to /login-email
  └── Exports: api.get, api.post, api.put, api.patch, api.delete

authServices.js (separate identityApi instance → Identity API)
```

### Admin — Dual Instances
```
authApi.js  → Identity API (identity.clinket.com)
backendApi.js → Main API (api.clinket.com)
  └── 401 interceptor: refresh via authApi → retry, or clear → redirect
```

### Environment Variables
| App | Prefix | Key Variables |
|-----|--------|---------------|
| Partner | `NEXT_PUBLIC_*` | `IDENTITY_URL`, `API_BASE_URL`, `CLIENT_VERSION` |
| User | `NEXT_PUBLIC_*` | `API_BASE_URL`, `API_VERSION`, `IDENTITY_URL` |
| Admin | `REACT_APP_*` | `API_URL`, `IDENTITY_API_URL` |

---

## FORM PATTERN

### Libraries
- **Formik** — form state management (all 3 apps)
- **Yup** — schema validation (all 3 apps)

### Validation Schema Pattern
```javascript
// lib/validation/schema.jsx
import * as Yup from "yup";

export const loginSchema = Yup.object().shape({
  email: Yup.string()
    .email("Enter a valid email")
    .required("Email is required"),
  password: Yup.string()
    .min(12, "Password must be at least 12 characters")
    .required("Password is required"),
});
```

### FloatingInput Pattern (Partner & User)
```jsx
<FloatingInput
  id="email"
  name="email"
  type="email"
  label="Email Address"
  formik={formik}
  required
/>
```
- Floating label that moves above on focus/fill
- Error state: red border (`#FF3B30`)
- Focus state: green border (`#97EF29`)
- Background: `#F5F5F5`
- Font: `font-[Lufga]`
- SSR-safe IDs via `useSafeId()` hook

### Available Input Components (Partner)
`FloatingInput`, `FloatingSelect`, `FloatingPasswordInput`, `FloatingMobileNumberInput`, `FloatingTextarea`, `FloatingDateInput`, `FloatingLabel`, `FloatingMultiSelect`, `FloatingInputWithPrediction`, `FloatingCountrySelect`, `TimeRangePicker`, `CustomToggleSwitch`, `CustomCheckbox`, `RadioGroup`, `DragDrop`, `ImageUploadBox`

---

## TOAST NOTIFICATION PATTERN

### Library: **react-hot-toast** (all 3 apps)

### Custom Toast (Partner & User — `utils/toastUtil.js`)
```javascript
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";

// Animated slide-in from right with spring physics
const springTransition = { type: "spring", stiffness: 500, damping: 30 };

showSuccess("Operation completed");  // Green
showError("Something went wrong");   // Red
showInfo("Updated successfully");    // Blue
showWarning("Please review");        // Orange (Partner only)
```

### Error Extraction
Handles all formats: Error objects, API response envelopes (`data.errors[]`, `data.message`), plain strings. Arrays show as bullet points.

### Admin
Uses `toast.success()` / `toast.error()` directly from react-hot-toast (no custom wrapper).

---

## LOADING STATES

### Partner
| Component | Type | Usage |
|-----------|------|-------|
| `Loader` | Spinning dashed circle | Inline loading |
| `OptimizedLoader` | Full-screen overlay + OwlEye logo | Page transitions |
| `ButtonLoader` | Three bouncing dots (`#032858`) | In-button loading |
| `NotificationSkeleton` | Pulse placeholders | Skeleton screens |
| `NavigationProgressBar` | Top bar | Route changes |

### User
| Component | Type | Usage |
|-----------|------|-------|
| `LoaderProvider` | Full-screen + rocking OwlEye logo (Framer Motion -30° to 30°) | Page loading |
| `ButtonLoader` | Three bouncing dots | In-button loading |

`useLoader()` hook to trigger loading from any component.

### Admin
No dedicated loader components — uses inline conditional rendering.

---

## LOCALIZATION (react-intl)

### Setup (Partner & User only — Admin is hardcoded English)

| Feature | Partner | User |
|---------|---------|------|
| Import method | Static (build-time) | Dynamic (`import()`) |
| Active locales | en-US, fr-CA, gu-IN, hi-IN | en-US, fr-CA, gu-IN, hi-IN |
| Missing key handling | `onError={() => null}` | `onError={() => null}` |
| Context hook | `useIntlContext()` | `useIntlContext()` |

### Locale Files
```
public/lang/
  ├── en-US.json
  ├── fr-CA.json
  ├── hi-IN.json
  ├── gu-IN.json
  └── es-US.json (authored, hidden)
```

### Usage
```jsx
// Component-level
<FormattedMessage id="Label.Save" />

// Imperative
const intl = useIntl();
intl.formatMessage({ id: "Label.Save" })
```

---

## SIGNALR (Partner & User)

### Connection Setup
```javascript
const connection = new HubConnectionBuilder()
  .withUrl(`${API_BASE_URL}/hubs/notifications`, {
    accessTokenFactory: () => getToken(),
  })
  .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
  .build();
```

### Events
- `ReceiveNotification` — New notification received
- `NotificationRead` — Single notification marked read
- `NotificationDeleted` — Notification deleted
- `AllNotificationsRead` — All marked read

### Token Source
- Partner: `SessionStore.getToken()`
- User: a single-use ticket from `requestHubConnectionTicket` (the access token never goes in the URL); one
  `renewSession()` per refused token — a hub that refuses the renewed token too is not renewed again until a different
  token exists

---

## ERROR BOUNDARIES (Partner only)

```
ErrorBoundary.jsx       — Component-level error catching
GlobalErrorBoundary.jsx — App-level fallback
RouteErrorFallback.jsx  — Route-level error display
```

---

## REACT 18 GOTCHAS

### `.then` / `.finally` are separate microtasks — automatic batching does NOT span them

React 18's automatic batching covers `setState` calls within **a single microtask**, NOT across separate ones. `.then(...)` and `.finally(...)` on the same promise are different microtasks — so `setMessages(data)` in `.then` and `setLoadingMessages(false)` in `.finally` can produce **two renders**, with an intermediate render where `messages.length > 0 && loadingMessages === true`.

**Real incident (2026-05-11, messaging — memory `feedback_react_promise_batching`):** Chat opened at top of thread instead of bottom. The intermediate render had data but still loading=true, so JSX took the loading branch (spinner with `h-full`). `useLayoutEffect` on `[messages]` fired, did `scrollTop = scrollHeight` → clamped to 0 because the spinner DOM had `scrollHeight ≈ clientHeight`. Next render swapped spinner for messages; scrollHeight grew, but the effect didn't re-fire (`messages` reference unchanged).

**How to apply (any of the three is fine; #2 is the most defensible):**

1. Consolidate the `setState` calls into one callback — move `setLoadingMessages(false)` out of `.finally` and into both `.then` and `.catch` so they share the microtask with the data setter.
2. **Gate the effect body on the "ready" condition** (recommended):
   ```jsx
   useLayoutEffect(() => {
     if (loadingMessages || messages.length === 0) return;  // ignore intermediate render
     containerRef.current.scrollTop = containerRef.current.scrollHeight;
   }, [messages, loadingMessages]);
   ```
3. Include ALL relevant state in the dependency array — never assume two `setState` calls fire atomically across promise callbacks.

Applies to every async-fetch + layout-effect pattern in user app, partner app, and admin app.

---

## SEO PATTERNS

### Partner App
- `createRouteMetadata()` utility for per-page metadata
- `PAGE_SEO` config object mapping routes to SEO data
- Sitemap generation: `node src/lib/seo/generateSitemap.mjs` (runs after build)

### User App
- `constructMetadata()` — Base metadata builder
- `generateBusinessMetadata()` — Dynamic SEO for business profiles
- JSON-LD structured data: `WebSiteSchema`, `OrganizationSchema`, `LocalBusinessSchema`
- Dynamic SEO component for business profile pages
- Google Analytics + GTM integration

### Admin App
- No SEO (internal tool)

---

## STATE MANAGEMENT

### Redux Toolkit (Partner & User)

**Partner Store Slices:**
- `currency` — Active currency selection
- `dashboard` — Dashboard data
- `invoices` — Invoice list state
- `notifications` — Notification state
- `profile` — User profile data

**User Store Slices:**
- `notifications` — Notification state (only slice)

### Context API (Admin)
- `ThemeContext` — Dark/light mode toggle (persisted to localStorage)
- No global state store

---

## SHARED DEPENDENCIES

| Package | Partner | User | Admin |
|---------|---------|------|-------|
| `axios` | ✓ | ✓ | ✓ |
| `formik` | ✓ | ✓ | ✓ |
| `yup` | ✓ | ✓ | ✓ |
| `react-hot-toast` | ✓ | ✓ | ✓ |
| `framer-motion` | ✓ | ✓ | ✓ |
| `react-icons` | ✓ | ✓ | ✓ |
| `date-fns` | ✓ | ✓ | ✓ |
| `react-select` | ✓ | ✓ | ✓ |
| `react-otp-input` | ✓ | ✓ | ✓ |
| `country-list-json` | ✓ | ✓ | ✓ |
| `react-intl` | ✓ | ✓ | ✗ |
| `@reduxjs/toolkit` | ✓ | ✓ | ✗ |
| `@microsoft/signalr` | ✓ | ✓ | ✗ |
| `crypto-js` | ✗ | ✗ | ✓ (content pages only, never session) |
| `@simplewebauthn/browser` | ✓ | ✓ | ✗ |

---

## ESLINT

### Partner App (comprehensive custom config)
Key rules enforced:
- `no-var: error`, `prefer-const: error`, `eqeqeq: error`
- `no-eval: error`, `no-implied-eval: error`, `no-new-func: error` (security)
- `react-hooks/rules-of-hooks: error`, `react-hooks/exhaustive-deps: warn`
- Accessibility (`jsx-a11y/*`): all `warn`
- `@next/next/no-img-element: warn`, `no-html-link-for-pages: error`
- Import ordering: `import/order` (builtin → external → internal → sibling → index)
- `import/no-cycle: warn` (maxDepth: 10)
- Environment-aware: `no-console` off in dev, warn in CI

### User App
- `eslint-config-next/core-web-vitals` preset only

### Admin App
- CRA defaults (`react-app`, `react-app/jest`)

### Lint Commands
```bash
# Partner & User
npm run lint    # eslint . --cache --cache-location .eslintcache --cache-strategy content
npm run lint:fix

# Admin — no separate lint command
```

---

## NEXT.JS CONFIGURATION (Partner & User)

### Shared Settings
```javascript
reactStrictMode: false,
output: "standalone",
compress: false,
serverExternalPackages: ["sharp"],
```

### Image Remote Patterns
- `flagcdn.com` — Country flags
- `assets.<env-apex>` — geo-routed CDN assets (direct entry)
- `assets-{in,ca}.<env-apex>` — region-pinned CDN assets. Storage is sharded per stamp; each region's API emits its own `assets-<region>` host so a blob resolves to its owning region's storage regardless of viewer geo (data residency). `remotePatterns` MUST list both the geo + per-region hosts for all envs (dev/uat/prod), or Next/Image rejects them. The root layout warms DNS for the build's own `assets-<region>` host (derived from `NEXT_PUBLIC_REGION` + `NEXT_PUBLIC_HOSTING_URL`). See `clinqet-deployment` › Assets serving.

### Caching
- `/_next/static/*` → `public, max-age=31536000, immutable`
- Partner: aggressive no-cache for non-static routes
- User: `s-maxage=3600` for non-static routes

---

## THEME (Admin only)

`ThemeContext` provides dark/light mode toggle:
```javascript
const { theme, toggleTheme } = useTheme();
// theme: "light" | "dark"
```
Persisted to `localStorage`. Not available in Partner or User apps.

---

## CHECKLIST FOR UI CHANGES

- [ ] Design matches existing system exactly (colors, typography, spacing, components)
- [ ] Uses `font-[Lufga]` for text
- [ ] Brand colors used consistently (`#032858`, `#97EF29`, `#FF3B30`, `#F5F5F5`)
- [ ] Responsive design with custom breakpoints (not default Tailwind)
- [ ] Forms use Formik + Yup validation
- [ ] FloatingInput components used for text inputs
- [ ] Toast notifications via `showSuccess`/`showError`/`showInfo` (not raw toast)
- [ ] Loading states use existing loader components
- [ ] Localization keys for all user-facing text (Partner & User)
- [ ] `FormattedMessage` for JSX, `intl.formatMessage` for strings
- [ ] SEO metadata for all pages (Partner & User)
- [ ] ESLint passes with zero errors
- [ ] Accessibility checked (jsx-a11y rules)
- [ ] Token handling follows app-specific pattern
- [ ] API calls use the existing API client (never raw axios/fetch)
- [ ] Error handling extracts and shows proper messages

## Privacy Policy Consent (2026-05-22)

Three new pieces mounted globally in the app shell (`components/common/Providers.jsx` for the customer app, `src/app/layout.js` for the partner app):
- `components/consent/PolicyReconsentModal.jsx` — hard-block modal (no close X, no backdrop dismiss, no Escape). Subscribes to `services/policyConsentBus` and resolves the awaiting axios call when the user clicks Accept (POSTs `/auth/accept-policy`, stores the refreshed access token via `SessionStore.setToken`) or Decline (clears session, redirects to `/account-paused`). Content is sanitized via DOMPurify; effective date rendered via `Intl.DateTimeFormat`.
- `components/consent/PolicyConsentChecker.jsx` — runs once per authenticated session via `useAuth()`; calls `getConsentStatus` and emits to the bus if `isCurrent === false`.
- `app/account-paused/page.jsx` — static page shown when the user declines re-consent.

Axios response interceptor (`services/api.js` for customer, `src/lib/apiClient.js` for partner) handles HTTP 409 where `data.message === "policy_update_required"`: stores `_policyRetry = true` to prevent loops, awaits `policyConsentBus.emit(currentPolicy)`, and on Accept retries the original request with the new bearer token.

Register form (`components/auth/registerForm.jsx`) adds a Jurisdiction select (`in`/`us`/`ca`, defaulted via `mapCountryToJurisdiction(detectUserCountry())`), fetches the current privacy policy via `getCurrentPolicy(jurisdiction)` on mount + jurisdiction change, includes `PrivacyPolicyVersion`/`PrivacyPolicyHash`/`PrivacyPolicyJurisdiction` in the multipart payload, and on backend 409 `policy_version_mismatch` re-fetches + shows an inline `Privacy_Register_Error_PolicyStale` warning without auto-submitting.

`services/policyService.js` exports `getCurrentPolicy(jurisdiction, policyType)` (5-min in-memory cache), `mapCountryToJurisdiction(countryCode)`, and `invalidateCurrentPolicyCache()`. The partner app's `getCurrentPolicy` uses the explicit `${url.OWNER_URL}/api/v1/public/policy/current` URL since `apiClient` baseURL points to the Identity API.

Legal-policy display bodies are locale-aware on every customer/provider web and mobile surface. Cosmos metadata exposes canonical English `content` plus `localizedContent` for `fr`/`es`/`hi`/`gu`; policy services select the active short language and use English only when the requested locale is unavailable. Current-policy caches include language in their key. Bundled emergency bodies live in `policyFallbackContent.localized.json` beside each app's fallback utility and contain all five policies in `en`/`fr`/`es`/`hi`/`gu`. Consent version/hash always remain tied to canonical English, so language switching must never cause re-consent.

Localization keys: `Privacy_Modal_*`, `Privacy_Register_*`, `Privacy_Declined_*`, `common.something_went_wrong`, `common.loading` (in `public/lang/en-US.json`). Backend mirror keys live in `clinqetinfrastructure/Resources/Localization/en.json`.
## Localization baseline (2026-07-26)

- Customer and partner web apps actively expose `en-US`, `fr-CA`, `hi-IN`, and `gu-IN`. Complete `es-US` bundles exist but are intentionally hidden; Japanese files and registrations are absent.
- English is the structural source of truth. Exact key-tree and placeholder parity tests are mandatory for every authored locale. User-facing literals, accessibility labels, date/time/list formatting, and pluralization must all be locale-aware.

---

## ‼️ PHASE 8 PART D (2026-08-04) — cross-app patterns the activity feed and the admin portal established.

### ‼️ A localization KEY plus ARGS is a contract, and the args are POSITIONAL

The activity feed's `SummaryKey` + `SummaryArgs` resolve through the same ids on the server and in **both**
provider apps. The API templates use .NET `{0}` / `{1}` placeholders, which are **valid ICU positional
arguments**, so `react-intl` resolves them directly and the i18next generator converts them to `{{0}}`.
‼️ **Copy the API's translated values into the client catalogs rather than re-translating** — otherwise the feed
sentence and the notification copy drift apart in four languages while English looks fine.

### ‼️ Cancel, do not race

A filter change must **cancel** the in-flight page, not queue a second one: `AbortController` on web,
a request-generation guard on mobile. A feed that lets two responses land into one list is the classic bug.

### ‼️ A shared primitive's defect multiplies

`StateCard` rendered its heading twice — in a tone pill and again as the paragraph — and therefore broke the
**team, invite, shared-inbox and locations** screens simultaneously, from Part A until Part D.
‼️ **The test that "covered" it asserted `getAllByText(...).length > 0`, which passes with 1 OR 2.** When a
component renders one heading, assert **exactly one**.

### ‼️ Registration is not reachability

A screen can be registered in a router, claimed by a deep-link table, and still have **no way in from inside the
app**. That is how the entire provider-mobile team surface shipped unreachable across two parts. **When you add
a screen, grep for a `navigate()`/`href` to it** — and on mobile check **per stack**, never the union.

### ‼️ Derive a read-out; never author one

The admin "what this role allows" panel is derived from `TenancyRoleCatalogDefinition`. The approved mockup's
hand-written version was **factually wrong** about the Technician role. Anything that restates a permission
matrix in prose will drift from the catalogue — derive it, and let a test pin the derivation.

---

## ‼️ MULTI-USER TENANCY — PHASE 9 (2026-08-04). The cross-app patterns this programme established.

> **The whole model is now one skill: read `clinqet-provider-teams` before any tenancy change.**

**Phase 9 changed ZERO frontend files.** This section distils the patterns the five-part frontend
programme proved, so the next cross-app feature does not rediscover them.

### 1. ‼️ Put the rendering rules in a shared, dependency-free module — and make the diff BUILD-FAILING

`clinqetwebpartnerapp/src/lib/tenancy/renderingRules.js` (**64 exports**) and its mobile twin are the
cross-platform contract. **Every "does this render, and with what label" decision lives there, and both
apps call it.**

- ‼️ **Dependency-free and side-effect-free is a HARD requirement**, because the mobile parity spec
  evaluates the web copy in a `vm` sandbox. **A single `import` turns a build-failing diff test into a
  silent skip.** (It throws instead — keep it that way.)
- ‼️ **The rules return localization KEYS, never English.**
- ‼️ **Generate the twin, don't hand-copy it** (**CP12**). A fixture table catches a rule that *answers*
  differently; it **cannot** catch a rule that was **never copied across**. Generating the block and
  proving it by a round-trip diff — strip the TypeScript annotations back out, compare character for
  character — makes divergence **impossible by construction**.
- ‼️ **A cross-platform sabotage that bites in ONE app is a finding about your TESTS, not your code. The
  app that stayed green is the one with the gap.** Breaking one rule failed 3 mobile tests and **0** web
  ones, because every web test rendered the panel directly while mobile drove it *through* the rule.

**This is what "parity means matching the RENDERING RULES, not shipping a same-named component" (L13)
looks like when it is enforced rather than intended.**

### 2. ‼️ A screen can be registered, deep-linked, and STILL have no way in

**The entire provider-mobile team surface shipped unreachable across two parts** — registered in the stack
**and** in `linking.ts`, with **no `navigate()` call anywhere in `src`**. On a phone there is no URL bar,
so a Universal Link was the only way in.

> ‼️ **When you add a screen, grep for a `navigate()`/`href` to it — and on mobile check PER STACK, never
> the union.** A screen living in two stacks needs registering in both, or the tap is a **silent no-op**
> from one of them.

**Third occurrence in this codebase** (SEO session 7's dead iOS entitlement, Session F's
`MydashboardRoute` casing, this). ‼️ **And a new WEB route under a claimed deep-link prefix is a MOBILE
obligation** — the association file claims every `/dashboard/**` path, so an unregistered one opens the app
on a **blank stack**.

### 3. ‼️ A 403 is a DOMAIN ANSWER, not an auth failure

Mobile's `apiManager.fetchWithAuth` force-logs-out on any unrecognised 403 — and **every** permission
refusal on a modern feature is a 403. Shipping over that client means **a mistyped password on a
step-up dialog signs the user out of the app.**

**The pattern: a URL predicate** (`isDomainForbiddenUrl()`, shaped like the existing `isAuthExemptUrl`)
**plus a test that pins every URL AND one deliberately unrelated 403 that must still sign out.**
‼️ **Add the URL in the same change as the endpoint.** Two live defects came from forgetting.

‼️ **The web `apiClient` already gets this right** — it rejects to the caller without logging out. When two
clients disagree about an HTTP status, **one of them is wrong; find out which before mirroring.**

### 4. ‼️ Branch on the ERROR CODE, never the status or the message

Every refusal carries a machine `ApiResponse.ErrorCode` **and** a localized `Message`. Clients branch on
the **code**.

- The claim race surfaces as **409 `conversation_already_claimed`**; the approved design notes say 412.
  **Both apps are correct either way precisely because they read the code.**
- ‼️ **A missing `ErrorCode` makes a designed recovery UNIMPLEMENTABLE.** `GET /business/activity`
  returned only the localized sentence on an invalid cursor, so the approved stale-page recovery could
  only have been built by **branching on a translated string** (**AD8**). Fixed by adding
  `TenancyErrorCodes.InvalidContinuationToken`.
- ‼️ **One code for two outcomes is the same defect.** A duplicate branch name and a vanished branch shared
  `branch_not_found`, and on a RENAME both are possible while **the screens do opposite things** — a
  duplicate is an inline field error the user fixes by typing; a vanished row must disappear. Fixed by
  `BranchNameInUse` / **409** (**CP6**). ‼️ **`BusinessTeamController`'s team-name path still has the
  identical wart** — one line, for whoever next opens that screen.

### 5. ‼️ Never draw a control whose backend does not exist

Where an approved mockup asked for something the wire contract could not express, the honest answer shipped
and the difference was **recorded and flagged** — A4 · B1 · B3 · B14 · AD3 · AD4 · AD6 · AD7 · C2 · CP2 ·
CP13. **Three options exist and only two are permitted:** fabricate (forbidden), drop an approved element
(forbidden), or **build the read**. Three endpoints were **built rather than faked** — seats, roles,
removal-impact.

**And the inverse:** a cut feature must be **removed from the UI, not left drawn as a dead control.** The
pre-existing inbox search box was **deleted** from both apps — it filtered only the 25 loaded rows, so a
member searching a 300-thread queue got a **confident, wrong "no results"**.

### 6. ‼️ Derive a read-out; never author one

The admin "what this role allows" panel is derived from `TenancyRoleCatalogDefinition`. The approved
mockup's hand-written version was **factually wrong** about the Technician role, and a test that copied
the mockup's claim **failed against the real catalogue**. **Anything that restates a permission matrix in
prose will drift — derive it, and let a test pin the derivation.**

### 7. ‼️ Localization: generate the second bundle, never translate twice

The mobile bundles are **GENERATED from the web catalogs** (**B17**) by a script that re-parses and diffs
every file, so the two apps **physically cannot say different things** — the defence against Session D's
58 empty FAQ rows. Flat react-intl ids → nested SCREAMING_SNAKE, `{x}` → `{{x}}`, inline ICU plurals split
into `_one`/`_other`.

Traps, all of which drew blood:

- ‼️ **ONE `defaultMessage` shared across a switch renders the WRONG string** — it rendered a **closed
  account as Active**. A wrong-but-plausible fallback is **worse than a visible key**.
- ‼️ **An optional formatter prop with an English default is how raw English ships.** `LocationHours`'s
  `formatDay` defaulted to `(day) => day.dayOfWeek`; it is now **REQUIRED and THROWS**.
- ‼️ **i18next supports ONE count per key** — a two-plural sentence is inexpressible; split the count
  phrases and compose at the render site.
- ‼️ **i18next `keySeparator` makes a flat `"A.B.C"` key unreachable** — nest properly.
- ‼️ **`sourceLocalizationIntegrity` enforces fr-CA typography** (a letter directly followed by `?` fails)
  and forbids `t(key, { defaultValue: 'English' })` and bare `toLocaleDateString()`.
- ‼️ **Register a dynamic-localization domain for runtime-chosen ids**, or nothing proves the five
  catalogs carry them.

### 8. ‼️ Assert an exact count, not `> 0`

`StateCard` rendered its heading **TWICE** — so every empty / error / permission-denied card on **four**
screens showed its title twice over for two whole parts. **The test that covered it asserted
`getAllByText(...).length > 0`, which passes with 1 or 2.** That is how it shipped unnoticed.

### 9. Cost rules that held across all five parts

- **One list request per view change**, carrying every tab count. **Never a count call per tab.**
- **On-demand only** for dialog data (reassign targets fetched when the dialog opens, never on page load).
- **A request-generation guard** discards stale responses after a fast context switch.
- **Every subscription returns its unsubscribe**; every interval is cleared on unmount.
- **`react cache()`** memoizes a per-request server fetch so a conditional second call is free.
- ‼️ **`apiClient` RESOLVES errors rather than throwing** — every write must check the result. A shared
  `tenancyResult()` / `TenancyResult` wrapper gives every call ONE shape so no call site can read a
  rejection as success.
- ‼️ **`"0001-01-01T00:00:00"` is TRUTHY** · **`!![]` is `true`** · **`t()` is a NEW function every render
  — never put it in a dependency array.**
- ‼️ **ESLint 0 is a CORRECTNESS gate on this codebase**, not a style gate: dependency arrays evaluate
  **during render**, so a violation there is a runtime crash Jest can stay green through.
- ‼️ **`/* global AbortController */` is required in provider web** — a `no-undef` **error**.

---

## ‼️‼️ BRAND MANDATE (owner, 2026-08-09) — READ BEFORE STYLING ANY CONTROL

Given in strong terms after the FAQ screen shipped a **navy selected chip** and a **tofu box** where
the search icon belonged. Both were defects. Neither may recur, on any surface.

### 1. Brand green `#97EF29` fills anything PRESSED or SELECTED

| Role | Colour |
|---|---|
| **Primary action · selected chip · selected tab · any chosen state** | **`#97EF29`** + ink text (`#101010` web · `#032858` mobile) |
| Secondary / sideways move | white or transparent, `#E7E7E7` border, ink text |
| **Section headings, structural labels, focus rings** | Navy `#032858` |
| Destructive confirm | `#B3261E`. **Green is NEVER a destructive confirm** (unchanged) |

> ‼️ **The split that makes the palette mean something: green = something you press or something that
> is chosen; navy = text that organises the page.** A navy selected chip looked deliberate, passed
> review, and was wrong. If everything were green, green would say nothing.

‼️ **All four apps, always** — partner web, partner mobile, customer web, customer mobile. Mobile keeps
its own ink (`#032858` on green) because that is what those apps already use; **the FILL is identical
everywhere**. Take the value from the token where one exists: `theme.brandGreen` on both mobile apps,
`PrimaryButton`/`SecondaryButton` from `clinqetwebpartnerapp/src/components/tenancy/primitives.jsx`.

‼️ **Pin it in a test.** All four FAQ suites assert the selected chip is `#97EF29` and not `#032858`.
The mobile theme mocks now return the REAL `brandGreen` instead of the `'#888'` catch-all — otherwise
the assertion compares two identical greys and proves nothing. Sabotage-verified on web and mobile:
reverting to navy fails exactly one test on each and nothing else.

### 2. ‼️ NEVER render a user-facing glyph as an HTML entity or a raw character

`&#9109;` (⌕) shipped as an **empty box** in the search field, because Lufga does not carry that
codepoint. It rendered perfectly in the mockup, which uses system fonts.

| App | Library | Search / clear |
|---|---|---|
| Partner web | `lucide-react` | `<Search />` `<X />` |
| Customer web | `react-icons/fa` | `<FaSearch />` `<FaTimes />` |
| Partner mobile | `react-native-vector-icons/Ionicons` | `search-outline` `close-circle` |
| Customer mobile | `react-native-vector-icons/Feather` | `search` `x-circle` |

> ‼️ **A brand font carries the glyphs the brand chose and nothing else.** `⌕ ✕ → ★ ✓ ⚑` are all
> candidates to render as a box. If a user can see it, it is an icon component. Inline SVG that is
> already drawn (the accordion chevron) is fine — that is drawn, not typed.

> ‼️‼️ **A MOCKUP CANNOT CATCH THIS.** It runs in system fonts, so the glyph looked right in the
> approved design and wrong in the product. **Look at the running screen — or a screenshot of it —
> before calling a UI change done.** The tests were green, the lint was clean, and the icon was
> missing.

---

## ‼️ NAVIGATION RESHUFFLE + OVERFLOW CUE (2026-08-15, owner-directed)

### The rail tail order is FIXED and pinned by a test

`Sidebar.jsx` ends: **Team → Billing → Call Follow-ups → Activity → Refund Requests**, all pushed after
Customers, which is the last untouched row. ‼️ **This SUPERSEDES the old "Call Follow-ups is the last row
in the rail" rule** — that assertion is gone from `sidebarRailConsistency.test.js` and replaced by four
that pin the new order. **Refund Requests is last because it is the least-opened screen** (owner's call,
overruling an argument that a waiting customer should lift it); it is not a statement about importance.
The order of the `routes.push` calls IS the contract — a feature flag being off may remove a row, never
reorder one. Insights remains the only legitimate `splice` (it belongs beside Leads, mid-list).

### The overflow cue — `useVerticalOverflow`

`src/hooks/useVerticalOverflow.js` is the vertical twin of `useHorizontalOverflow`, and
`clinqetwebuserapp/hooks/useVerticalOverflow.js` is a near-identical twin — **keep the two in step.**

- Returns `{ ref, canScrollUp, canScrollDown }`, **each edge separately**, so the cue says WHICH way there
  is more. Both false when the content fits ⇒ a tall window draws nothing.
- ‼️ **Entirely event-driven.** `ResizeObserver` fires once on `observe()` and that is what performs the
  FIRST measurement. **A `MutationObserver` on `childList` is not optional**: rows are DIRECT CHILDREN of
  the scroller, so a feature flag adding one changes `scrollHeight` while the container's own box stays
  identical and a ResizeObserver alone would never fire.
- ‼️ **Do NOT reintroduce an `overflowing` guard.** `overflowing && scrollTop > 1` is dead logic — with no
  overflow, `scrollTop` is 0 and `distanceToEnd` cannot exceed it. A sabotage run proved the branch
  unreachable (flipping it changed no test). The 1px tolerance on each edge IS the whole rule, and
  sabotaging **that** does fail the suite.
- ‼️ The customer-web copy carries **no `/* global ResizeObserver */`** (that app's ESLint declares it as
  a built-in and `no-redeclare` errors), while the partner copy REQUIRES it. That one-line difference is
  deliberate.
- ‼️ Customer web additionally enforces `react-hooks/set-state-in-effect` — **a synchronous `measure()` in
  the effect body is an ERROR there.** This is the second reason the hook is observer-driven.

### The markup rule

The cue elements are **siblings of the scroller, not children** — they pin to the visible edge instead of
scrolling with the rows, and they stop at the list edge rather than running under the pinned My Profile
footer. `data-visible={canScrollUp}` relies on React stringifying booleans on `data-*`. Both are
`aria-hidden="true"` and `pointer-events: none` — decorative, never a control, and never a click target.
CSS lives in `global.css` under "Rail overflow cue": navy fade + **lime** chevron on the navy rail.

### ‼️ "My" is gone from the labels — keys unchanged, VALUES changed

`sidebar.myBookings` now reads **"Bookings"**, `sidebar.myQuotes` reads **"Quotes"** — and so do
`header.My_Bookings`, `button.My_Bookings`, `Dashboard.MyBookings`, `Dashboard.MyQuotes`,
`Access.Surface.bookings`, `Access.Surface.quotes`, `bookings.myBookings`, `quotes.myQuotes` and the two
`seoConfig` titles, in **all five catalogues**.

- ‼️ **KEYS WERE DELIBERATELY NOT RENAMED.** `labelId` feeds `animKeyFor` → the `[data-anim="myQuotes"]`
  CSS rule and the `ANIM_KEYS` list in `sidebarRailConsistency.test.js`. Renaming keys churns both for
  nothing.
- ‼️ **Every `defaultMessage` must move with the value** — `sourceLocalizationIntegrity` requires an exact
  match and WILL fail the build. It caught `Header.jsx` on the first run; `CloseBusinessCard.jsx`'s
  `linkDefault` is NOT scanned by it, so that one has to be remembered by hand.
- The rule, product-wide: **ownership is established by the context, never repeated on the row.** On this
  rail the context is the dashboard; in the customer app it is the "My Account" group heading, which is
  why *that* heading keeps its "My".
- Non-English values were changed by **stripping the possessive determiner only** (`Mis`/`Mes`/`મારા`/`मेरी`);
  the noun was left exactly as authored. ‼️ **A pre-existing plural inconsistency was therefore preserved,
  not fixed** — gu/hi mix `બુકિંગ`/`બુકિંગ્સ` and `बुकिंग`/`बुकिंग्स` across keys.

---

## ‼️ ANCHORED PANELS — ONE PLACEMENT RULE, `useAnchoredPanel` (2026-09-05, provider web)

> From the owner's phone: the dashboard "Ask Clinket" magnifier opened a card whose left 160px sat off the
> screen. **Seven** surfaces had each hand-rolled the same arithmetic, and six of them had no test at all.

**Never write `right = window.innerWidth - rect.right` again.** Use
`useAnchoredPanel(open, anchorRef, { width, gutter?, offset?, minHeight? })`
(`src/hooks/useAnchoredPanel.js` → the pure rule in `src/lib/anchoredPanel.js`) and spread the result:

```jsx
const box = useAnchoredPanel(open, btnRef, { width: 208, offset: 6 });
…
{open && box && (
  <div style={{ position: "fixed", ...box }} className="… overflow-y-auto overscroll-contain">
)}
```

The hook returns `{ right, width, maxHeight }` plus **either** `top` **or** `bottom`, or `null` before the
first measurement — render nothing (or `invisible`) until it is non-null, or the panel paints one frame at
the old anchor. `width` and `maxHeight` come from the measurement, so the element carries **no** Tailwind
width or height class that could disagree with it.

| Trap | Why it bites |
|---|---|
| Clamping only the RIGHT gutter | `max-w-[calc(100vw-24px)]` bounds the panel's **size** and says nothing about where its **left edge** lands. A 366px card pinned 184px from the right of a 390px screen starts at **−160px** |
| `100vw` | counts the desktop scrollbar (~15px, Windows Chrome). `document.documentElement.clientWidth` does not, and shares the coordinate frame `getBoundingClientRect` reports in |
| A guessed `max-h` | `max-h-[calc(100dvh-96px)]` is unrelated to the measured top. The rule flips the panel **above** its anchor when below cannot hold `minHeight`, anchoring by `bottom` so the content's height never has to be known |
| `window.innerHeight` | never moves for the on-screen keyboard — `visualViewport.height` does, and the hook listens to both its events |
| `rect.bottom + window.scrollY` on a `fixed` element | `fixed` is already viewport-relative; the sum lands the panel `scrollY` px too low on any page whose window scrolls |
| Closing the menu on scroll | the old workaround for an anchor that drifted. **Re-measure instead** — the hook re-places on `scroll` (capture), `resize`, `orientationchange` and both `visualViewport` events, and bails out of the re-render when the box is unchanged |

**The seven call sites** — `businessSearch/AskHeaderButton`, `common/SmartLnDropdown`, `booking/Booking`,
`invoices/Invoices`, `quotes/Quotes`, `customers/index`, `app/dashboard/inbox/page`.
`src/lib/anchoredPanelCallSites.test.js` fails the build if either idiom reappears anywhere under `src/`,
and pins that list. ‼️ It catches the idiom **by name** — a site that measures through a variable the scan
cannot follow, or that positions with `left`, still passes. Green means no file re-derives the right-edge
offset, not that every popover is on the hook.

‼️ **`clinqetwebuserapp` and `clinqetwebadmin` are clean of this idiom** (checked 2026-09-05) and have no
copy of the helper. Port it only when one of them grows an anchored panel — not speculatively.

## 2026-09-07 — provider dashboard overlay/viewport ownership

Provider web now uses a native top-layer `ModalDialog` for drawer and Ask, rather than competing positioned overlays. Cleanup closes the dialog; Escape and backdrop dismiss it. The fixed dashboard shell follows visualViewport height/offset without React scroll-state renders. Anchored menus account for offsetLeft/offsetTop and layout dimensions. Preserve 44px touch targets through responsive layout; do not solve crowding by shrinking controls. Do not patch DOM methods or wrap global event registration to suppress rendering errors. Native parity concerns rendering/lifecycle rules, not DOM primitives; see provider-mobile M10.

## Provider web hostname (owner-confirmed 2026-09-23)

The provider/business dev app is **https://business.dev.clinket.com/**. Regional dev hosts are
`https://business-ca.dev.clinket.com/` and `https://business-in.dev.clinket.com/`.
The provider hostname is `business` for each environment; `clinqetwebpartnerapp` remains the repository name.
Use these current URLs in instructions, tests and browser verification.
## Admin choice-control theme (2026-09-25)

Admin choices use `clinqetwebadmin/src/components/ui/AdminSelect.jsx` (the installed react-select primitive) across all former native selects. Use compact/header or field variants with the shared navy/lime theme; supply layout classes only. Preserve option values, empty sentinels, names, labels, disabled choices, required validation and event-shaped onChange handlers. Search is entered in the combobox trigger, menus portal outside clipping dialogs, and Escape returns control without closing a surrounding dialog. Profile action menus share colors, radii, focus and touch sizing but remain actions. Do not copy the Next.js partner component into CRA or introduce another dropdown implementation. See the admin skill and C:/Nik/Data/admin-dropdowns/PLAN.md for contracts and verification.

## Remembered-session failure contract (2026-09-28)

Superseded 2026-09-29: web apps no longer refresh with a stored refresh token or coordinate through Web Locks; they renew from the HttpOnly session cookie (see "Session model" above and `clinqet-auth-sessions`).

Provider web `businessSearchService.askBusinessSearch` bypasses Axios for streaming; it also clears only on `sessionInvalid`. A transient refresh failure must never sign the member out of Ask Clinket.

## Cookie answer before sign-in, and the banner on sign-in pages (2026-10-03)

- ‼️ **A cookie answer given while signed out is never asked again after signing in.** The sign-in token's `consents` claim predates any `cookie_consent` record, so the first Main API calls answered 409 `policy_update_required` and `PolicyReconsentModal` asked the same question. `services/cookieChoiceRecord` (all four apps) settles a stale `cookie_consent` item that this browser/device already answered for the SAME `version` AND `hash` (empty hash never counts): one `POST auth/accept-policy` under the server document's jurisdiction however many calls were refused, the new token adopted only for the same session, waiters resolved. Everything else (privacy, terms, a different cookie document, a failed record) is still asked. The checkers no longer blind-sync the cookie with its location-based jurisdiction; they read consent-status and emit.
- Mobile checkers also run on a sign-in inside the app (provider `onSessionEstablished('signIn')`, customer `onAuthChanged('login')`), not only on the next foreground.
- **Web banner is a non-blocking bottom card** (`role="dialog" aria-modal="false"`, no backdrop) on every page except the provider landing `/`. Analytics stay off until a choice, so the question must never stand in the way of a sign-in or sign-up form. It reserves its own height through `--cookie-banner-space` (ResizeObserver) → `body { padding-bottom }`, removed when it hides. `aria-labelledby="cookie-banner-title"` stays (the product tour waits on it). Mobile keeps its first-launch sheet: its answer survives sign-out, so it appears once per install.

## Register shows every sign-in option (2026-10-03)

Register renders the same row as sign-in — email/password, email/phone code, passkey, Google, Facebook, Apple — under "Or continue with" (web `Auth.Continue_With`, mobile `REGISTER.OR_CONTINUE_WITH`; the old "Or register with" keys are gone). Only Google/Facebook/Apple create an account; the others sign in an existing one, which is why the divider never says "register". Web `ThirdParty` and customer mobile `ThirdPartyLogin` take `current` (the method already on screen) and omit only that; `isRegister` names the analytics surface only. Provider mobile Register links to `LoginWithEmail {method:'email'|'otp'}` and `LoginWithPasskey`; customer mobile `LoginScreen` honours `route.params.method` the same way.

### ‼️ One line, every width (owner, 2026-10-04 — supersedes "three and three")

- **Web (both apps):** `ThirdParty` owns its row (`data-testid="sign-in-options"`, `flex flex-nowrap gap-2 md:gap-3`); every
  option uses `SIGN_IN_ICON_CLASS` (`common/thirdPartyLogin/signInIcon.js`: `flex-1 min-w-0 max-w-11 md:max-w-[50px] aspect-square`)
  so the options share the width and never wrap. ‼️ No sign-in form may wrap `<ThirdParty />` in a box of its own — the old
  `max-w-[180px] md:max-w-[220px] flex-wrap` box is what drew 3 + 3. Proven in the browser at 320/375/696/1440px.
- **Mobile (both apps):** `SignInOptionsRow` (provider `components/auth/SignInOptionsRow.tsx`, customer
  `components/SignInOptionsRow.tsx`) measures its width and gives every option `signInOptionSize(width, count)` = an equal share,
  capped at the full size (52 / 50); `flexWrap: 'nowrap'`; hidden for the one frame before it is measured. Provider screens build
  their options with `iconSignInOption` / `imageSignInOption` / `socialSignInOptions` (Register, LoginWithEmail, loginWithPasskey,
  LoginWithPhone); customer `ThirdPartyLogin` builds its own.
- **Cookie card buttons:** web — side by side while both labels fit on one line (`flex-wrap`, `grow basis-0 min-w-fit`), each on
  its own line before a label would break; mobile — equal halves, a wrapped label is centred.

### Audit follow-ups (2026-10-03)

- `policyConsentBus.emit` hands its listener a per-emit `answer(result, acceptedPolicies)`: a quiet cookie settle answers ONLY its own refused call; `resolveAll` stays for the modal's accept. Web shows uncovered policies at once and records the cookie in the background (so the product tour cannot start in between); mobile reads the device record first.
- `recordCookieChoice` is single-flight per SESSION (web: session epoch / token `sid`; mobile: session epoch). A record answering after the tab/device left that session shows nothing, adopts nothing and answers `session_changed`.
- ‼️ `accept-policy` never re-enters the consent queue: web `postAcceptPolicy` sends `_policyRetry: true`; provider mobile `fetchWithAuth` skips the 409 branch for `/auth/accept-policy` (it shared ONE `policyRetryPromise` with the listener and deadlocked every gated request); customer mobile passes `skipPolicyRetry`.
- The banner steps aside while the modal is asking the cookie question (`clinket:cookie-consent:asked-by-modal` + `window.__clinketCookieConsentAskedByModal`). Opened on purpose (`requested`), it focuses its heading and returns focus to the opener; DOM order is Decline then Accept, as seen.
- Fixed layouts honour `--cookie-banner-space`: the provider dashboard frame height subtracts it; fixed bottom bars sit at `bottom-[var(--cookie-banner-space,0px)]` (customer booking bar, provider onboarding bar, workspace switcher sheet); the customer auth pages' absolute form box pads by it.
- Mobile consent modals clear their queue and release waiters on sign-out (provider `tokenManager.onSignedOut`, customer `onAuthChanged('logout'|'token-expired')`).
- Server: `PolicyConsentService.RecordBatchAsync` survives two tabs inserting an account's first row at once (2601/2627 on `IX_UserPolicyConsent_UserId_PolicyType` → detach, re-read, update once). Consent jurisdiction is anchored on the legal policies (`Clinqet.Shared.Constants.ConsentJurisdiction`: privacy, then terms) in `ConsentEnforcementMiddleware` and `consent-status`; the cookie row (which follows the browser) sorts first in the claim and used to flip privacy and terms to "jurisdiction changed".

## Consent model — one question at a time (2026-10-03, owner-approved; supersedes the two consent sections above where they differ)

**Two different things, kept apart.** Terms + Privacy are per ACCOUNT and gate the account. The cookie / analytics choice is per DEVICE (browser cookie or AsyncStorage `clinket_consent`) and never gates anything.

- **Server:** `PolicyConsent:EnforcedPolicies` = `privacy_policy`, `terms_of_use` (both hosts' appsettings and both integration factories). `consent-status` and the Main API 409 never list `cookie_consent`. `accept-policy` still records a cookie answer as proof, and `consent-status.userConsents` still returns that row.
- **Nothing on sign-in surfaces.**
  - Provider web: `lib/consentSurfaces`. `hidesAgreementsDialog` covers `/`, `/login` and `/auth/*`. `hidesCookieCard` covers those plus `/continue`, `/app-home` and `/invitation`. The dialog still shows on the hand-off pages, because a request there can be waiting on it.
  - Customer web: `isSignInScreen` = `/auth/*`.
  - A hidden dialog is queued, not dismissed. The next page shows it.
- **Cookie card:** small, at the bottom, no backdrop, no back-button capture. Accept all and Decline are the same size and weight; Accept is green.
  - Web: on every other page, guests included. The space it takes is reserved with `--cookie-banner-space`.
  - Mobile: only on a TAB'S FIRST SCREEN, resting on the tab bar. `appNavigation/consentPlacement` reads `onTabRoot` from the navigation state and `tabBarHeight` from the tab bar's own `onLayout` (customer adds the lifted button's `FAB_LIFT`). It never shows over a pushed screen's buttons or on intro/sign-in screens. Opened from Cookie preferences, it shows anywhere, and a sign-out closes that request.
- **One agreements dialog,** signed in only, for missing or updated Terms/Privacy (social sign-up, admin-created accounts, policy updates).
  - If this device has not answered the current cookie document (`unansweredCookiePolicy`), the cookie question goes in the SAME dialog. "Accept all" = agreements + analytics on. "Decline analytics" = agreements only, analytics off.
  - The dialog is drawn only once that lookup settles, so its buttons never change under a finger.
  - Mobile never hides it by screen: it only exists for a signed-in session, and a sign-in step can be waiting on it.
- **Never two at once.**
  - Web: `announceConsentDialogOpen` / `CONSENT_DIALOG_EVENT`. The dialog says it is open the moment agreements arrive, and says it again on every queue change.
  - Mobile: `services/consentQuestion` holds `checking` (the sign-in look-up), `dialog` and `cookieCard`.
  - The cookie card hides while the dialog is up or being decided.
- **Proof sync at sign-in:** `recordBrowserCookieAnswer` (web) / `recordDeviceCookieAnswer` (mobile) record this device's answer to the CURRENT document when the account's row differs. This is single-flight per session and best effort; it is retried at the next sign-in. Answering the card while signed in records it the same way (`recordCookieChoice`).
- **Tours:**
  - Web `useProductTour` waits while `policyConsentBus.isAwaitingAnswer()` or a consent UI is in the DOM. The 60 s fallback is gone, and the wait is cancelled on unmount.
  - Mobile `useTourAutoStart` (provider) and `ProductTour` (customer) wait on `useConsentQuestionShowing()`.
  - The checkers emit BEFORE they announce "resolved", so nothing starts in the gap.
- **Register** sends Terms + Privacy only. There is no cookie requirement or cookie warning. Provider mobile uses the device's jurisdiction, no longer `'in'`.
- **Do Not Sell** before any cookie answer writes a decline record with `rdp: true` (and the proof when signed in). Turning it off with no record writes nothing. Customer mobile: `cookieChoiceRecord.restrictDataProcessing`.
- **Removed:**
  - The per-emit `answer` on `policyConsentBus`, and `isCoveredByCookieChoice`.
  - The "asked by modal" signal.
  - Mobile: the dead "decide later" dismissal, and the customer `COOKIE_CONSENT_READY_EVENT`.
  - The orphaned copy keys `Cookie_Register_Required`, `Privacy_Modal_Bundle_Footer_Note_CookieOnly`, `Cookie_Modal_Title` and `Cookie_Banner_Close` (web), `POLICY_RECONSENT.COOKIE_TITLE` / `BUNDLE_FOOTER_NOTE_COOKIE_ONLY` and customer `COOKIE_BANNER.DECIDE_LATER` (mobile), and `Cookie_Footer_Preferences` (provider web only; the customer footer still uses it).
