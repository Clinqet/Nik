---
name: clinqet-customer-mobile
description: |
  **FRONTEND SKILL** — Work on the Clinqet customer/consumer MOBILE app (React Native, clinqetmobileuserapp; scheme clinket://). USE FOR: customer mobile screens, navigation, theme/tokens, i18n, the AppConfig consumer, and the in-app native booking-pay surface (Payments Phase 5 — Apple Pay / Google Pay / card via @stripe/stripe-react-native). Distinct from clinqet-user-app (the Next.js WEB app) and clinqetmobilepartnerapp (the provider mobile app). Applies to files in clinqetmobileuserapp/.
---

# Clinqet Customer Mobile (RN) — skill

## RECENT CHANGES — 2026-10-06 ("Price on request", and the prepared-phone stop)

See the `clinqet-prepared-providers` skill for the whole feature. What changed HERE:

- **A service with no price shows "Price on request"** with **Ask for price** and **Call**, is not addable to the cart, and shows no offer band.
- **The cart SAYS when the server dropped a line** (`selectCartRemovedItems`), with "Ask for price" beside it when the reason was the price. A test mocking `cartSlice` must carry that selector or `useAppSelector` is handed undefined.
- **Registration stops on a prepared provider's phone** (`PreparedProfileReady`, in the CUSTOMER's words) and offers a code to that number.
- **Sign-in offers "No password yet? Sign in with a code"**, and the profile menu says **"Set Password"** when the account has none.
- **Registration sends `AppType` (`Clinket`), `Platform` and `ReceiveMarketingEmails`** — without them every sign-up was registered as a PROVIDER on a "web" device. ‼️ Marketing is FALSE on purpose: registration asks nobody, exactly as the customer web does.
- **Forgot-password step 1 surfaces its error** — the API rethrows and an empty `catch {}` swallowed it, so the spinner stopped and nothing was said.

> The customer/consumer **mobile** app `C:\Nik\clinqetmobileuserapp` (React Native 0.78, scheme `clinket://`). Distinct from `clinqet-user-app` (the Next.js WEB customer app) and `clinqetmobilepartnerapp` (the provider mobile app). Covers the app shell + the in-app native booking-pay surface added in Payments Phase 5.

## App shell (verified)
- **Navigation:** React Navigation v7. Root stack in `App.tsx` (`createStackNavigator`); bottom tabs `src/appNavigation/BottamNavigation-Route.tsx` (MyDashboard · Inbox · MyBooking · Profile — note the "Bottam" spelling); nested `src/appNavigation/MyDashboard-Route.tsx`. Screen-name constants in `src/appNavigation/constant.tsx` (`navigations.*`). Screens under `src/screen/<flow>/...`. Booking detail = `src/screen/bookings/BookingDetailScreen.tsx`, route `BookingDetail`.
- **Theme:** `src/theme/index.ts` (`AppTheme`, light+dark) via `useTheme()` (`src/context/ThemeProvider`). Tokens: `brandGreen #97EF29`, `brandBlue`/`textPrimary #032858`, `textStrong`, `brandGreenSoft`, `surfaceElevated`, `border`, `textSecondary`, `danger`, `success`. Shared UI: `components/ui/AppButton.tsx` (variants primary/accent/secondary/danger…, sizes sm/md/lg), `components/ui/AppHeader.tsx`, `components/ui/AppToast.tsx` (`showToast(msg,{type})`), `components/ThemedAlert.tsx` (`showAlert`). Icons: SVG wrapper `components/svg/web` (`FaWebIcon`) + `react-native-svg` + `react-native-vector-icons`.
- **i18n:** i18next + react-i18next; init `src/Locales/i18n.ts`; resources **en-US/fr-CA/gu-IN/hi-IN** (`fallbackLng:'en-US'`; es-US is complete but deliberately unregistered). `useTranslation()` → `t('SECTION.KEY')`; keys use `SECTION.SCREAMING_KEY`.
- **API:** `src/apiManager/apiManager.tsx` — clients `identityApi`/`mainApi`/`searchApi`/`urlApi` + the `apiClient` wrapper. **`request()` returns the PARSED ApiResponse body (`{success,data,…}`), NOT a Response** — services do `res?.data ?? res`. Auth via `buildHeaders` (Bearer from `SessionStore`) + auto refresh-on-401; `getWithoutHeaderUrl`/`mainApi.getPublic` = anonymous (no logout side-effects). Endpoint constants/builders in `src/apiManager/constant.tsx`; hosts in `src/config/env.ts` (dev forced; `clinket.com`).
- **Tests:** jest (`preset: react-native`), `__tests__/*`, `npm test`. `App.test.tsx` PASSES on the current baseline (react-redux IS in `transformIgnorePatterns`; full suite 59/59 green 2026-07-16 — the old "fails on clean baseline" note is obsolete). **ESLint config EXISTS** (`.eslintrc.js` extends `@react-native`) → `npm run lint` works; lint changed files with `node node_modules/eslint/bin/eslint.js <files>`.

## Secure external/social login handoff (2026-08-11)

- `src/services/socialLoginCoordinator.ts` is the sole callback owner. Screens, `AppState` listeners and social-button callers must never parse callback query strings, store tokens or navigate on success.
- Start external login with `returnUrl=clinket://auth/external-login`, `responseMode=SecureCodeExchange`, `codeChallenge=<PKCE S256>` and `codeChallengeMethod=S256`. Generate the 43-character verifier from 32 secure random bytes; derive the challenge with SHA-256 + unpadded base64url.
- The sign-in flow's stamp is captured once at its first step (`beginSignInFlow()`, `stampRouting.ts`) and every later step uses it. The PKCE attempt `{ codeVerifier, identityBaseUrl, createdAt, code? }` lives in a KEYCHAIN item (`…social-login`, the old AsyncStorage `clinket_social_login_pending` is deleted at first launch) before opening a browser; it expires after five minutes and the exchange goes to the stored origin, accepted when it is any of this environment's per-stamp Identity hosts (a region change while the browser was open no longer rejects it). `resumeSocialLogin()` (from `AppBootstrap`) finishes an exchange the app was killed in the middle of, with the same code, verifier and request secret.
- A successful callback is exactly `clinket://auth/external-login?code=<opaque-protected-grant>`. Intercept it through the root linking `getInitialURL` and `subscribe` hooks before React Navigation. Do not pass it as route params. Failure callbacks may carry `error`, `errorCode` and `provider`; clear the attempt and remain on login.
- Deduplicate `openAuth` and `Linking` delivery with one coordinator single-flight. POST `{ code, codeVerifier }` to the persisted origin at `/api/v1/auth/providers/login/exchange/mobile` through `urlApi.post(..., { auth:false, regionPinned:true })`. Never re-resolve that pinned URL from current region state.
- The session is ONE keychain record (`com.clinqet.customer.session`, `AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY`): access token + expiry, refresh token + expiry, `sessionExpiresAt`, the server's `rememberMe`, the pending refresh secret and the issuing `identityBaseUrl`. Reads are absent / unavailable / value — unavailable never signs out, never deletes, never attaches a token. Emit the login event only after the record is written. `userInformation` must not contain `token` or `refreshToken`. Queue one root reset until the navigation ref is ready.
- Fall back to `Linking.openURL` only when `InAppBrowser.isAvailable()` returns `false`. An `openAuth` exception, callback/exchange/storage failure, cancel or dismiss clears the pending attempt and must not relaunch OAuth.
- API request/response tracing recursively redacts sensitive body and header fields, including grants, PKCE verifiers, tokens, Authorization, cookies, API keys, passwords, secrets and OTPs.
- Dependencies are exact-pinned: `js-sha256@1.0.0` and `react-native-get-random-values@1.11.0`. Version 1.11.0 is the latest line compatible with this app's React Native 0.78.1; v2 requires React Native 0.81+, so never force-install or upgrade RN just for this polyfill.
- Regression coverage lives in `socialLoginCoordinator.test.ts`, `socialLoginService.test.ts`, `sessionStoreAuthSession.test.ts` and `apiLoggingRedaction.test.ts`.

## Payments surface (Phase 5 — in-app native booking pay; App-Store/Play compliant)
**Golden rule (INVERTED vs the provider app):** a customer paying for a **booking** is a real-world service ⇒ in-app native pay IS required and is **0% store fee**. So we DO build a real pay UI here — the **native payment sheet** (`@stripe/stripe-react-native`: Apple Pay / Google Pay / card), NEVER web Elements, NEVER a browser hand-off. STILL: flag-gated INVISIBLE on `OnlineBookingPayEnabled`; optional + post-confirmation only; trust seal = native shield-check vector (no 🛡️ emoji); "Secure payment" (no vendor name); keys only from `initiate`; no PAN/CVV stored. (04-payments-flow + 05/06-compliance docs in `payments-plan/` are authoritative.)

- **AppConfig:** `src/services/appConfigService.ts` (`GET /api/v1/app-config` → `PaymentClientFlags`, all-OFF on any failure, strict `=== true`; reads the parsed `{data:{payments}}`/`{payments}` envelope) + `src/context/AppConfigProvider.tsx` (`useAppConfig()` → `{ payments, loaded, refresh }`, fetch-once + in-flight dedupe), mounted in `App.tsx`. Flags mirror AppConfigDto.Payments (`enabled`, `billingUiEnabled`, `aiAssistantEnabled`, `aiAssistantPaidEnabled`, `onlineBookingPayEnabled`, `bookingDepositEnabled`).
- **Service:** `src/services/bookingPaymentService.ts` — `initiateBookingPayment`/`confirmBookingPayment`/`getBookingPaymentStatus` (authed `booking-payments/{id}/initiate|confirm` + GET `{id}`). Endpoint builders in `apiManager/constant.tsx`.
- **Pure logic (unit-tested):** `src/utils/bookingPayState.ts` (`resolvePayPhase`, `shouldQueryPayment`, `isPaidStatus`/`isRefundedStatus`) + `src/utils/paymentFormat.ts` (`currencyExponent`/`minorToMajor`/`formatMinor`). Tests in `__tests__/{bookingPayState,paymentFormat,appConfigService}.test.ts` (26 GREEN).
- **UI:** `src/components/payments/TrustSeal.tsx` (full + compact, native `react-native-svg` shield-check) + `src/components/payments/BookingPaymentSection.tsx` (status fetch on focus + return-from-background, single-flight; phases hidden|payable|paid|refunded; pay = `initiate` → lazy `import('@stripe/stripe-react-native')` → `initStripe`(per-intent key) → `initPaymentSheet`(payment|setup intent) → `presentPaymentSheet` → `confirm` → refetch). Wired into `BookingDetailScreen.tsx` after Payment Details. Config: `STRIPE_APPLE_MERCHANT_ID` in `config/env.ts`; dep `@stripe/stripe-react-native@^0.45.0`.
- **Localization:** English is the source of truth; en-US/fr-CA/hi-IN/gu-IN are active and es-US is complete but hidden.
- **Edges:** flag off / AppConfig fail / offline → hidden (no call); flag flip mid-session → hides on focus; per-booking `canPayOnline=false` → hidden (backend also 403s); already-paid → receipt summary; declined → inline error + retry; 3DS/SCA → in-sheet; sheet cancelled → silent; deposit selector intentionally absent (server sends one `amountMinor`).
- **Scope NOT here:** anonymous/guest BOOKING pay (the confirmation-email link deliberately opens the browser — the universal-link association excludes `/booking-pay/*` because "card payment finishes in the browser session that started it"); provider digital-goods/subscription surfaces (that is the provider app, P4). ‼️ **Public-INVOICE pay IS here since session 26** — see "Invoice pay" below.

## Analytics instrumentation (analytics-recs Phase A4, 2026-07-02 — FULL coverage)
- **Tracker** `src/services/analyticsTracker.ts` (24 helpers; queue 10 / 2s flush; consent-gated `clinket_consent` + jurisdiction; AppState background/inactive flush; route→surface map covers EVERY registered route incl. `QuickBook→cart_checkout`, `CategoriesScreen→categories`, `Splash/about_us/data_deletion/auth.error`). PageView auto-fires per route via NavigationContainer onReady/onStateChange.
- **Search attribution LIVE**: `searchService.fetchSearchResults/fetchProviderResults` now call `setLinkedSearchId(searchId)`; `trackSearchInteraction` posts the web-parity `/search/track` DTO (searchId, serviceId|businessId, interactionKind, position, page, pageSize, searchText, categoryId, subcategoryId, city, distanceKm, scrollDepthPercentile, visibleResultIds). `src/hooks/useSearchInteractionTracking.ts` = RN port of the web hook (same dedup key; impressions via FlatList viewability in SearchResultScreen, clicks on card tap). `src/hooks/useAnalyticsEngagement.ts` = `useDwell(surface)` (emits on unmount/AppState-background) + `useScrollDepth(surface)` (returns an onScroll handler).
- **Double-count fix**: the two client `trackBookingInitiated` calls (CartScreen, QuickBookScreen) were REPLACED with web-parity `trackCart checkout_submit/checkout_success/checkout_fail` (surface `cart_checkout`, metadata `item_count`/`error_code`). BookingInitiated/QuoteRequested are SERVER-emitted — never call them client-side.
- **Byte-exact web parity** on every shared subtype/surface (see `clinqet-analytics` taxonomy). Mobile-only additions within taxonomy: cart `address_select/date_pick/timeslot_pick/offer_view/promo_apply`; SearchAction `query_submit`; settings `language_change`; notifications baseline `trackNav list_view/notification_click/mark_all_read` (web /notifications mirrors these in Phase A2).
- **Coverage**: search funnel (query_submit/suggestion_select/sort_change/clear_filters/no_results_view + FilterScreen trackFilterApplied), home/discovery/categories `trackResultClick` (`trending/recently_viewed/recommendation/category_browse/search_result` — the mobile rec-click feedback loop is fixed), service detail + provider profile (tab_switch, share_open/share_method, outbound_link phone/whatsapp/map, gallery_view/portfolio_open, from_provider_profile ServiceView, cart add, review form/vote/report), cart/checkout screens, bookings (view_detail/tab_switch/cancel_*/reschedule_*/contact_provider), broadcasts (form_open/attachment_add/submit_*/view_detail/bid_*/withdraw/tab_switch), messaging (inbox_open/conversation_open/tab_switch/message_sent/attachment_sent/mark_read/older_load/mute_toggled/hide), my-reviews + PendingReviewsBanner (prompt_view/prompt_cta), notifications, ALL auth flows via the *API.tsx helpers (login/register/OTP/forgot/passkey — passkey events carry `{identifier_type, method: face|fingerprint|passkey}`, the EVENT only, never biometric data) + logout (flushes before token wipe), settings screens (exact web camelCase surfaces `settings.manageAddresses/changePassword/mfaSetup/deleteAccount`), legal screens `useScrollDepth`, FAQ `faq_expand`, ErrorBoundary `unhandled_error`.
- **Tests**: `__tests__/useSearchInteractionTracking.test.tsx` + `__tests__/useAnalyticsEngagement.test.tsx` (12 tests, green).

## Discovery / recommendation delivery (analytics-recs Phase D fixes, 2026-07-03)
- `src/services/discoveryService.ts` recommended-services + recommended-providers call the AUTH client (`apiClient.getwithUrl`) — the old anonymous client kept the rails device-keyed, so after merge-on-login emptied the device doc a signed-in user got generic rails forever. `recentlyviewed` was already authed. The endpoints are AllowAnonymous ⇒ no 401/refresh/logout side-effects for guests.
- Image mapping fixed wherever the search/discovery DTO lands: the live wire shape is `serviceImages: [{original,thumb,medium}]` + `businessProfilePicture{...}` objects (flat `serviceImageUrl(s)` are legacy, never emitted) — homeScreen `resolveServiceImage` (cards, thumb-first) + `resolveBannerImage` (hero, original-first; mapped items carry both `image` and `bannerImage`), DiscoveryScreen mapper (also gained `hourlyRate` in its price chain), searchScreenDetails `mapResult`. Recently-viewed items stay flat (`imageThumbUrl`/`imageUrl`) and are covered by the same chains. Dead `bannerService`/`currentBanner` state removed from homeScreen.
- Reachability note: `DiscoveryScreen` is only navigated with `sectionId: 'recently-viewed'` (home View-All); the trending/providers View-Alls go to SearchResultScreen `source: 'recommended'` (page-1 unfiltered = the discovery endpoints, any input falls through to search). The screen's other two sections stay functional for deep links/default.
- **Recommendations lead only an unsorted list (2026-09-29).** Server: `GET /search/services` with no text anchors recommendations on page 1 only when there is no category/subcategory AND `!SearchRequestDto.HasExplicitSort()` (`SortBy != Relevance`). Client (`src/screen/homeTab/searchScreenDetails/index.tsx`): "no sort" = **`sortBy` omitted** — `sortBy: sort && sort !== DEFAULT_SORT ? sort : undefined` (`DEFAULT_SORT = 'Relevance'`, `src/config/searchConfig.ts`), same wire rule as web. The only client-side counterpart is the `source: 'recommended'` gate: a chosen `sortBy` counts as user input in `hasUserInput`, so `useRecommended` goes false and the search endpoint answers. Rows the server marks `isRecommended` get the `SEARCH_RESULT.RECOMMENDED` badge.

## 2026-07-03 audit-session fixes
- Discovery rails pre-flight token refresh (single-flight) — expired-token cold starts no longer silently serve generic rails.
- Tracker hardening: working 429 backoff (the HTTP layer previously never surfaced statuses); background (AppState) flush uses only the in-memory cached location + defers one microtask so same-turn dwell enqueues are included; `Geolocation.setRNConfiguration({skipPermissionRequests:true})` so an analytics flush can never pop the OS location dialog; console.* stripped in release builds — see the `clinqet-analytics` skill "Mobile tracker hardening".
- DiscoveryScreen 'Get quote' localized + 0-price suppression parity; mappers no longer hardcode USD; suggest headers use the shared builder.
- New instrumentation: `help_center` dwell + `outbound_link` {target: phone|email|whatsapp} (web parity); IntroScreen `cta_click` {target: get_started|login} on `auth.intro`; the native Flow-B pay funnel (BookingAction `pay_open/pay_submit/pay_success/pay_fail`, byte-parity with customer web) — exact strings in `clinqet-analytics`.

## A2-P2 enrichment additions (2026-07-03) — byte-parity with customer web
- SearchAction `suggestion_view` {searchQuery, resultCount} on `search_box` — SearchScreen emits once per resolved NON-EMPTY suggestion set per distinct trimmed query (ref-deduped; re-shows never re-emit).
- SearchAction `filter_toggle` {metadata: filter, value} on `search_results` — FilterScreen emits per control from plain handlers (Switch onValueChange wrapper, CategoriesModal onSelect ×2, Slider `onSlidingComplete`, rating/experience/day chips, FacetPicker onSelect ×2, price `onEndEditing` with a same-value guard ref); filter names = the FilterApplied metadata keys; cleared values `all`/`any`/`none`.
- `useDwell('search_results')` on SearchResultScreen + `useDwell('categories')` on CategoriesScreen (ContentEngagement — tracker-sampled 0.1).
- Full cross-platform contract: `clinqet-analytics` skill "A2-P2 enrichment additions".

## Quote/broadcast creation hardening (2026-07-16 — mobile leg of the zero-match incident)
- `src/utils/geo.ts` `isUsableGeoPair` (typeof number + finite + not-(0,0); half pair = absent; tests `__tests__/geo.test.ts`) is THE guard wherever lat/lng leave the app: CreateBroadcastScreen state seeding + create payload + classify + recommended-services fetch, and the LocationPickerModal pick handler. Since session 22 the LocationPickerModal writes NO (0,0) optimistic coords (geocode-first; failure ⇒ city-only) — the store no longer legitimately holds (0,0), but keep guarding raw lat/lng anyway (legacy persisted state).
- Create payload: unusable pair ⇒ `latitude/longitude: null` (backend geocodes the city at matching time); `city` trimmed; `country: country?.code`. Step-3 gate + submit pre-guards mirror the server rules (`Error_BroadcastLocationInvalid`; category + ≥1 subcategory).
- Envelope checks: classify + create branch on `success === false` (`request()` never throws on HTTP errors); `resolveApiErrorMessage` maps raw `errors[]` keys (location → `BROADCASTS.VALIDATION_LOCATION`, category-family → `VALIDATION_CATEGORY`) and never displays raw `Error_*`. New keys `BROADCASTS.VALIDATION_CATEGORY` + `COORDS_ONLY` ×4 locales (ja from web's vetted copy).
- `LocationPickerModal` fires `onCityPicked` on Places-autocomplete picks too (typed picks previously never reached the wizard); the CreateBroadcast handler CLEARS coords when the new pick has no usable pair (coords beat city in matching — a mismatch would geo-target the old city).
- `urlApi.post` accepts optional per-request `headers`; `createBroadcast` sends `Idempotency-Key` (previously `void`-discarded — dedup silently relied on the server's 5-min content-hash bucket).

## ‼️ Carry-forwards
- **Native build verification DEFERRED:** `@stripe/stripe-react-native` is a native module needing `pod install` (iOS) / Gradle (Android) + an on-device PaymentSheet run + the Apple Pay merchant entitlement in Xcode — must run on a Mac/build machine (not done in the Windows authoring session). JS is verified (jest/lint/tsc green).
- P1 search index reindex + cosmosindexsetup run DONE (user-confirmed 2026-07-03). India go-live = P6; smart analytics = P7. See the `clinqet-payments` skill + `payments-plan/IMPLEMENTATION-INDEX.md`.

## Booking cancel/refund program parity (2026-07-17)

- Cancel button on `BookingDetailScreen` is driven by `booking.canSelfCancel === true` (booking fetch field, flag-INDEPENDENT), no longer by the pay-status `canCancelFree`. `selfCancelBlockedReason === 'booking_day_contact_support'` ⇒ day-of "Contact support" surface (`BOOKINGS.CONTACT_SUPPORT_DAY_OF` helper + `PAYMENTS.CONTACT_SUPPORT` AppButton → the ThemedAlert contact-support affordance).
- `BookingPaymentStatus` interface gained `canSelfCancel` + `selfCancelBlockedReason`; new `markBookingComplete(bookingId)` (POST `booking-payments/{id}/complete`, `booking_payment_complete_url` in apiManager/constant). Confirm-completion prompt (D2 mutual capture): status Completed + payment Authorized/Vaulted ⇒ `PAYMENTS.CONFIRM_COMPLETION_HINT` card + `PAYMENTS.COMPLETE_ACTION` button → mark complete → reload.
- Payable phase shows the charge disclaimer (`PAYMENTS.CHARGE_DISCLAIMER`, ShieldCheck strip inside `BookingPaymentSection`); cancel modal shows `BOOKINGS.CANCEL_FREE_NOTE` when the pay flag is on. `BookingDisputeSection`: free-cancel card requires no blocked reason; refund-waiting state has Withdraw + Contact support and the friendly `PAYMENTS.REFUND_AWAITING_PROVIDER` copy with `{{deadline}}` (from openDisputeResponseDeadlineUtc). All keys in en-US/fr-CA/hi-IN/gu-IN/es-US (Spanish hidden).

## BookingDetailScreen: "provider didn't come", business cancel reason, no customer delete (D5–D7, 2026-09-29)

- **D6 report.** `AppButton` `BOOKINGS.REPORT_NO_SHOW` (secondary, tap — no long press) → `showAlert` confirm (`REPORT_NO_SHOW_TITLE`/`_BODY`, `COMMON.goBack`, destructive `REPORT_NO_SHOW_CONFIRM`) → `updateBookingStatus(id, { newStatus: 'NoShowProvider' })` = `PATCH /bookings/{id}/status` → toast `REPORT_NO_SHOW_SUCCESS` + `fetchBooking()`. Envelope failure ⇒ `apiFailureMessage(res)` (server sentence) else `REPORT_NO_SHOW_ERROR`.
- **Window.** `src/utils/bookingStatus.ts` `canReportProviderNoShow(booking)` = status `Confirmed`/`InProgress` AND `src/utils/bookingDate.ts` `hasBookingStarted(scheduledStartDateTime, timeZoneId)` (wall time in the booking's zone, device clock if missing/unresolvable), evaluated against a `noShowClock` state. **It unlocks at the start with the screen open:** while `isNoShowReportableStatus(status)` (`bookingStatus.ts`), an effect arms a `setTimeout` for `msUntilBookingStart(scheduledStartDateTime, timeZoneId)` (`bookingDate.ts`; `null` when unscheduled; not armed beyond `MAX_TIMER_DELAY_MS` = 2^31-1), re-reads on every wake, and re-checks on `AppState` → `active` (a suspended app runs no timer); `useFocusEffect` refreshes the clock when the screen regains focus. Timer and listener are cleared on unmount. Server: `BookingController.UpdateBookingStatus` refuses a no-show while `ScheduledStartUtc > now` (`Error_NoShowBeforeAppointment`); auto-completion ends the window (the customer may send `NoShowProvider` only from Confirmed/InProgress).
- **After reporting.** `toSlider('NoShowProvider')` → `ProviderNoShow` (`CLOSED` set): greyed track, neutral label `BOOKINGS.STATUS_PROVIDER_NO_SHOW` ("The provider didn't come") — never `REQUEST_DECLINED`. `BOOKING_STATUS_LABEL_KEYS.NoShowProvider` = the same key; `NoShowCustomer` keeps `BOOKINGS.NO_SHOW`. The pill is neutral grey, not declined-red: `src/assets/theme.ts` `statusColors.NoShowProvider` = `{ text: '#5F5F5F', bg: '#F0F0F0' }` (matches web), used by the detail badge and the list card. `isDeclined` = `Rejected`/`RejectedTimeout` only (no rejection block); `canBookAgain = isDeclined || isCompleted || status === 'NoShowProvider'` ⇒ the detail screen offers `BOOKINGS.BOOK_AGAIN`. Since W15 (2026-09-30) the list card offers Book again on `Completed` OR `NoShowProvider` (`canBookAgainFromList`, below).
- **D7 cancel reason.** On `Cancelled`, `getProviderCancelReasonKey(booking.providerCancelReason)` (`PROVIDER_CANCEL_REASONS` → `BOOKINGS.PROVIDER_CANCEL_{CUSTOMER_ASKED,COULD_NOT_DO_IT,ENTERED_BY_MISTAKE}`) renders first, then `booking.cancellationReason` as a note (`reasonNote`). Unknown/absent ⇒ `null` ⇒ the note or `BOOKINGS.CANCEL_REASON_NONE` ("No reason provided."; mobile-only key — web uses `myBookings.detail.noReason`). Value = the `Booking` entity field from `GET /bookings/{id}` (enum `ProviderCancelReason`). `localizationContracts.test.ts` asserts every reason key exists in every locale.
- Declining a business-proposed reschedule sends `cancellationReason: t('BOOKINGS.DECLINE_BOOKING_REASON')` (was hardcoded English).
- **D5.** No booking delete exists in the app; `DELETE /bookings/{id}` returns 403 `Error_BookingDeleteDraftOnly` to any non-Business caller.
- Keys ×5 (`src/Locales/{en-US,es-US,fr-CA,gu-IN,hi-IN}.json`). Test: `__tests__/bookingNoShowAndCancelReason.test.tsx`.

## Password management (2026-07-22)

- Customer settings uses cached profile data and renders set/change mode only from a literal boolean `hasPassword`/`HasPassword`. Missing or invalid capability never coerces to false: it terminates in localized Retry. A 409 refreshes the profile once and applies the same validation.
- Successful set/change responses continue this phone in a NEW session: `adoptReissuedSession` writes the returned pair and keeps the issuing origin; a 401 `session_ended` there shows the server's "change saved, please sign in again". `Util.evaluatePassword`/`Util.isPasswordValid` (`src/Util/utils.tsx`, exporting `PASSWORD_MIN_LENGTH` 8/`PASSWORD_MAX_LENGTH` 128) are the ONLY password-policy source — 8–128 with ≥1 uppercase, ≥1 number, ≥1 symbol (lowercase NOT required); `evaluatePassword` returns a `rules[]` array. Never re-hardcode the numbers. See the 2026-07-23 checklist section for `PasswordChecklist`.

---

## DEEP LINKS (session 7, 2026-07-26)

`src/appNavigation/linking.ts` maps every public URL to a screen that already exists — home,
messages, bookings, my-profile, booking detail, quotes, categories, cart, notifications, my-reviews,
help-center, faqs, about-us, the legal pages, `/{friendlyName}` and `/{friendlyName}/services/{slug}`.

- ‼️ **The association file and this config MUST stay in step.** A path the AASA claims but this app
  does not route opens it on a blank stack — worse than opening the browser.
  `__tests__/deepLinking.test.ts` fails on any linking target that is not a registered screen, on any
  routed auth / booking-pay / invoice path, and if `/services*` is ever claimed while the app still
  has no category or city screen.
- ‼️ **Hosts must carry `www.`** The apex 301s to www and **iOS does not follow a redirect when
  matching a Universal Link**, so an apex URL opens the browser every single time.

**`src/utils/serviceSlug.ts` must resolve a service exactly as the web does.** It now carries the full
`slugify` / `buildServiceSlug` (NFD, strip combining marks, lowercase, non-alphanumeric to a dash,
trim edges) and disambiguates two services sharing an 8-character id suffix by comparing the WHOLE
slug — it used to give up on a collision, which meant the same URL opened a different service in the
app than in the browser. That is why `findServiceIdBySlug` needs the service NAME, not just the id.

Pinned to the same shared corpus as `lib/seo/slug.js` and `SeoSlug.cs` by
`__tests__/serviceSlug.test.ts`. Change one implementation, change all three.

---

## DEEP LINKS — WHAT ACTUALLY BREAKS (final SEO audit, 2026-07-26)

Universal Links / App Links failed **four** different ways here, and every one was silent: the link
just opened the browser, or the app landed nowhere, with nothing to see in CI.

**1 · Declaring the entitlement is not wiring it.** `clinqet.entitlements` declared
`com.apple.developer.associated-domains` perfectly and `CODE_SIGN_ENTITLEMENTS` appeared **nowhere**
in `project.pbxproj` — the file was not even in the Xcode file tree. Xcode never applied it, so the
shipped app had no associated-domains at all. **Check the build setting, in EVERY configuration.**
No JavaScript test can see a build setting; `universalLinkWiring.test.ts` guards it structurally.

**2 · Release must use the Release entitlements.** The provider app had
`ClinqetPartnerRelease.entitlements` on disk and **both** configurations pointed at the Debug one, so
Release shipped `aps-environment: development` — rejected by APNs, and TestFlight uses the production
gateway too. Leave no entitlements file unused; the guard asserts every file on disk is referenced.

**3 · AASA ↔ linking parity must be checked in BOTH directions.** Both apps asserted "everything I
route is claimed" and both passed; nobody asked whether the association file claims things the app
cannot route. It did — 63 URLs across the two apps. Check against the **web app's real routes on
disk**, the third source neither file mentions.
‼️ **A one-segment static page falling through to `:friendlyName` is worse than a miss** — `/reviews`
opened a provider page for a business that does not exist, which looks broken rather than unhelpful.
A static page must be matched by a **literal** pattern. `exclude` entries go **before** the wildcard:
iOS takes the first matching component.

**4 · Never hand-fill a placeholder the repo can answer.** `<<FILL: iOS_TEAM_ID>>` was
`DEVELOPMENT_TEAM` in each pbxproj all along — and the two apps use **different** teams
(`KWXU56R372` customer, `2225KLHB39` partner), so one value was always wrong for one app. The AASA
`appIDs` is asserted against `DEVELOPMENT_TEAM` + `PRODUCT_BUNDLE_IDENTIFIER`, never as a literal.

**Still owner-only:** the Android SHA-256 fingerprints (Play Console only) and an **on-device test on
a Mac**. Nothing native is verifiable from this environment — the guards prove the wiring, not that a
tap opens the app.

## POLICY CONSTANTS: EXPORTED IS NOT ENFORCED

`FRIENDLY_NAME_MAX` was exported from the policy module and imported by **nobody**, so the modal let a
provider type past the column width and the availability check 400d on every keystroke while the web
capped it locally. **An exported-but-unused constant in a policy module is a defect, not dead code.**
Cap with `.slice()` in the change handler rather than a `maxLength` prop — it covers paste too.

---

## STATIC ASSETS ARE NOT PAGES — THE SECOND HALF OF THE AASA TRAP (2026-07-26)

The first fix excluded static **pages** the app cannot route. It was written from a scan of
`app/**/page.js`, which cannot see `public/` — so **every root-level asset stayed claimed by `/*`**:
`robots.txt`, `sitemap.xml`, `llms.txt`, `llms-full.txt`, `site.webmanifest`, every favicon and svg,
and the new IndexNow key file. A one-segment file name falls through to `:friendlyName`, so tapping a
link to `robots.txt` opens a provider page for a business called "robots.txt".

**The lesson is about the scan, not the file.** A route enumeration answers "what pages exist", never
"what URLs exist". Static assets, route handlers (`robots.js`, `sitemap.xml/route.js`) and `public/`
files are all real URLs the association file claims.

Fixed with extension excludes (`*.txt`, `*.xml`, `*.json`, `*.ico`, `*.png`, `*.jpg`, `*.jpeg`,
`*.webp`, `*.gif`, `*.svg`, `*.webmanifest`) ordered **before** `/*`. Safe because a provider slug never
carries an extension. `deepLinking.test.ts` now reads `public/` off disk so a new asset is covered the
day it lands, and still asserts provider + service pages resolve so the excludes cannot over-reach.

‼️ The **partner** app needs none of this: its AASA claims only `/dashboard*`, which no root file matches.

## MOBILE REACHES THE SERVER'S LOCALIZATION — AND OFFERS ONE LANGUAGE IT LACKS

Both apps send `Accept-Language` on every request (`apiManager.tsx`, `apiHeaders.ts`), and both display
server error messages verbatim — which is why §5's `{1}` placeholder leak was most visible on mobile.
Any server-side localization fix therefore reaches mobile with no app change.

Their own copy is clean of the same bug: i18next `{{name}}` interpolation throughout, zero `{0}`-style
placeholders.

Japanese resources and registrations were removed on 2026-07-26. Spanish resources are complete but deliberately hidden until product approval.`n## Localization baseline (2026-07-26)

- Active resources are `en-US`, `fr-CA`, `hi-IN`, and `gu-IN`. Japanese was removed. `es-US.json` is complete and parity-tested but remains unregistered until product approves picker exposure.
- English is the structural source of truth. Locale parity tests require the exact key tree and `{{placeholder}}` set. UI dates and fallback cookie-policy copy resolve through the selected locale.

---

## Discovery screens + `/services*` deep links — session 8, 2026-07-27

The owner's standing rule: **the app must be identical to the web. If the web has a page the app
lacks, build the page** — never route the URL at a half-fit screen. Session 7 had excluded `/services*`
from the AASA precisely because no screen existed; that exclusion is now gone and all five shapes are
routed.

### New screens (`src/screen/discovery/`)
| Screen | URL it serves |
|---|---|
| `CitiesIndexScreen` | `/services/cities` |
| `CityScreen` | `/services/city/{citySlug}` |
| `CategoryLandingScreen` | `/services/{categorySlug}` **and** `/services/{categorySlug}/{citySlug}` |

`CategoryLandingScreen` is registered twice — as `CategoryLandingScreen` and `CategoryHubScreen` —
because one linking key cannot carry two paths. Same pattern as `ProviderProfile`/`BusinessProfile`.

### `src/services/discoveryCatalogService.ts`
TTL-cached (6h), single-flight, port of the web's `lib/server/discoveryCatalog.js`.

‼️ **Slugs are one-way.** The URL carries `salon-beauty`; the API only ever returns names
("Salon & Beauty"); and `SearchResultScreen` filters by **`categoryId`** — `categoryName` only labels a
chip. The chain is slug → name (`/public/discovery/catalog`) → id (`/public/categories`, already wrapped
by `categoryService.ts`). **No backend change is needed for any of this** — no new endpoint, container
or document. Slugs are derived with the shared `slugify` in `src/utils/serviceSlug.ts`; a second
algorithm would send a tapped URL somewhere different in the app than in the browser.

A failed catalog returns `null`, never an empty one — an empty catalog would make the marketplace look
closed rather than unreachable.

### Linking order is load-bearing
`services/cities` and `services/city/:citySlug` **must be declared before** the category patterns in
`src/appNavigation/linking.ts`. `/services/cities` is shaped exactly like `/services/{category}`, so a
wrong order makes the app search for a category literally called "cities" — worse than no match.
Pinned by `__tests__/deepLinking.test.ts`, which also now scans nested navigators
(`src/appNavigation/MyDashboard-Route.tsx`), not just `App.tsx`.

### Quote nudge and closing band
- `src/components/AIQuoteNudge.tsx` — dismissible, AsyncStorage (`clinqet.aiQuoteNudge.dismissed`),
  on home / search results / cities / city / landing. **Never on the broadcast screens**: offering
  "get quotes" to someone already writing one is noise.
- `src/components/QuoteCtaBand.tsx` — page furniture, **not** dismissible, last on all seven surfaces.
- `src/components/QuoteSparkIcon.tsx` — the shared navy-gradient disc + lime spark, same SVG path as
  web. A generic emoji or stock glyph is forbidden (`feedback-no-ai-looking-icons`).
- `src/components/CitiesBand.tsx` closes the home screen. Its chips are the only in-app route into a
  category-x-city page — without it the three screens are reachable only by deep link. Own city leads,
  matched by **slug** so "toronto" matches "Toronto".

### Dismissal writes must be awaited
`EnableLocationBanner` and `AIQuoteNudge` both `await` their AsyncStorage write. Fire-and-forget loses
the dismissal if the app is killed straight after, and the banner returns on next launch. Both start
hidden and reveal after the async read — painting then yanking is a worse flash than one empty frame.

‼️ In tests, **never `jest.spyOn(AsyncStorage, 'getItem').mockRestore()`** — those methods are already
`jest.fn()`s from the library mock, so restoring a spy leaves a bare stub and every later `getItem` in
the file silently returns `undefined`. Use `mockImplementationOnce`.

### Locale sections
`DISCOVERY_PAGES` (49 keys) and `QUOTE_CTA` (6 keys). `DISCOVERY` was already taken by the home rails.
‼️ The RN locale files have a **mixed EOL shape** — `en-US.json` is CRLF from line 1, the other four
open with a bare LF. Preserve per file; do not normalise.

## ‼️ DISCOVERY CATALOG + LOCATION — session 14, a live outage and its two root causes

**1. Never render from an empty catalog, and never let one be cached.**
An empty search index produced an empty-but-valid catalog that the API returned as `200 OK`. A 200 is a
success, so it was cached — **on Azure App Service `/home`, which survives restarts AND redeploys**.
Result: category tiles lost their icons and every city / category×city page 404'd, for six hours,
immune to every deploy.
- Treat an empty catalog as **Unavailable**, never Ok. ‼️ **EITHER list empty is a failure** — the
  mobile guard was `AND` and let "categories but no cities" through.
- ‼️ An empty **combo slice** is NOT a failure — that is the doorway-page 404 working as designed.
- ‼️ **Do not cache it twice.** The client held it 6 h on top of the API's own 6 h, so the TTLs
  **stacked**: a new city could take ~12 h to appear.
- The **icon** and the **landing page** come from different sources and fail independently — a catalog
  outage must not also strip the tiles of their icons.

**2. The catalog is SCOPED — ask for the slice you need.**
```
(no params)                homepage / cities index — cities carry categoryCount + topCategories
?city=…                    a city page
?category=…&city=…         a landing page — ‼️ the UNION of the row and the column, not the intersection
?allCombos=true            the sitemap only
```
‼️ **If you add a filter, your test stub must honour it.** A stub that returns everything makes a scoped
test pass for the wrong reason — that is exactly how an intersection-vs-union defect nearly shipped.

**3. `(0,0)` is not a location.**
`Number(null)` is `0` and `0` is finite, so converting before checking for absence turns "no location"
into a real point in the Atlantic Ocean. Reject absence **before** the numeric conversion, and treat a
both-near-zero pair as absent (a single zero is the equator or the meridian and stays usable). One
predicate decides "do we have a position" — never inline the check at each call site.


## PROVIDER DISCOVERY ON THE PHONE — badges · the hero banner · narrow-your-search (Phase 5, session 20)

**One contract, four surfaces.** The server sends a FINISHED, ORDERED badge list; the client renders
exactly what it is told. `components/ProviderBadges.tsx` is the only place that knows a badge exists.

- **Verified is a SEAL on the business name** — navy circle, lime check — **never a chip on a card**.
  ‼️ Keep it a `flexShrink: 0` sibling of the truncated name, never inside the truncating node.
- **Card = the seal + the first 2 chips. Profile = everything**, and there Verified appears **twice
  deliberately**: the seal on the name AND a spelled-out "Verified business" chip, plus the
  **meaning line** (`BadgeMeaningLine`) — a phone has no hover, so that line is the only place a
  customer can learn what a mark means.
- ‼️ **An unknown badge code is DROPPED, never rendered raw** (`asBadgeList`).
- ‼️ **`badgeCity` comes from the surface's OWN request city**, never the result row's — the server
  judged "New in X" for the city the client asked about. On the PROFILE it is the provider's own
  primary city (`primaryCity()` in `screen/business/components/profileShared.tsx`).
- **Badge order is the SERVER's.** Never sort, never derive, never filter beyond the display cap.
- **Recently-viewed and trending show NO badges** — recently-viewed data is history (a revoked badge
  would be a stale claim) and `recommended-services` carries no `badges` field at all.
- ‼️ **Card badge rows CLIP, they do not scroll**, and there is **no `+N` counter**: a horizontal
  ScrollView inside a tappable card inside a vertical FlatList fights both gestures, and truncation
  only ever under-claims. `categoryChipAllowance()` decides how many category chips are left.
- ‼️ **Badge chip colours are FIXED in both themes** — a badge carries its own background and
  foreground, like the seal. The meaning line IS theme-aware.

**The hero — `components/HomeHeroBanner.tsx` + `services/bannerService.ts`.**
- `GET /api/v1/public/discovery/banner?city=&country=&lat=&lng=` — since L8 the searched point (2-decimal cell) + the place's ISO country; `city` is only the label (see Phase 3 “L8”).
- ‼️ **It uses `apiClient.getWithoutHeaderUrlWithStatus`, NOT the plain `getWithoutHeaderUrl`.**
  `request()` (`apiManager.tsx`) never throws on a non-OK response and never surfaces headers, so a
  429's `Retry-After` would be unreadable and a 503 indistinguishable from an empty answer. The
  status-carrying path is **`requestWithStatus()`** — one shared transport beside `request()`, with
  the same regional-URL resolution, header building and dev tracing, returning
  `{ status, ok, data, headers }`. ‼️ **It performs NO 401 refresh and NO consent replay** — it is for
  anonymous and telemetry routes where the status IS the answer. `mainApi.postWithStatus` delegates
  to it too. **Reach for it whenever a route's status or headers carry meaning; use `getPublic` for
  everything else.**
- **503 · 429 · a dead line · an empty slide list ⇒ the designed fallback hero.** Never an error,
  never a blank box. **The failure is CACHED**, so a bad line costs exactly one request.
- ‼️ **`Retry-After` is honoured APP-WIDE, not per city** — the limit is per IP.
- ‼️ **Nothing is requested until `locationReady`.** Firing earlier asks for the empty city and then
  again for the real one — two payloads for one page view.
- **Render `displayCount`, not every candidate** (`visibleSlides`), and **pick the rotation offset
  when the payload lands, never during render**.
- Photo chain: service photo → country-aware artwork; a photo that fails to LOAD falls to the artwork.
  ‼️ **The byline avatar is `businessProfileThumb` → the business INITIAL — never the artwork.**
- **The promo slide** labels itself "Clinket offer"; `isPaid` labels itself "Sponsored" (the contract
  only — the boost group is permanently empty and there is no purchase UI).
- **`components/BannerOfferDetails.tsx`** carries every term incl. `PROMO.LIMITED_NOTICE` when
  `budgetLimited`, which also appears in the cart offer list and the pay sheet.
- ‼️ **`utils/clipboard.ts` soft-requires `@react-native-clipboard/clipboard`** (RN 0.78 removed
  `Clipboard` from core). Absent ⇒ the code renders as selectable text with no Copy button.

**Narrow your search — `components/NarrowYourSearch.tsx`**, at the end of results only.
- Two states: `capped` (the 500 depth cap — every option must REDUCE) and `end` (the search ran out —
  the distance chip flips to widening). ‼️ **Renders nothing when no refinement would actually narrow.**
- `narrowKindChips` / `narrowRefinementKeys` are exported so the screen can ask "would this show
  anything?" without a second, drifting copy of the rule.
- It emits `FilterApplied` with the **same metadata keys the filter sheet sends**, plus
  `source: narrow_your_search` and `applied` — a chip press must be indistinguishable from a manual
  filter.
- ‼️ **No "get quotes" button on the phone** — `QuoteCtaBand` already sits directly below it.

**Locale files are uniformly CRLF** and round-trip byte-identically through
`JSON.stringify(obj, null, 2)` + CRLF + a trailing CRLF. Write them that way for a minimal diff.

## ‼️ PROVIDER BADGES — THE RULES (mockup 19, owner-approved 2026-07-29)

The server sends a **finished, ordered** badge list (`ProviderBadgeBuilder`). Clients render what they
are told — never derive, re-order or filter beyond the display cap.

### Verified is the SEAL, never a chip
The navy **rosette** with the lime check (Option A) rides the business name. ‼️ **There is no way to
render Verified as a chip — the `includeVerified` prop was DELETED, not deprecated**, and a test on each
platform proves it cannot come back. Showing the seal and a "Verified business" chip together said the
same thing twice in the same breath, which the owner rejected. The seal must never sit inside a
truncating node: keep it a `shrink-0` / `flexShrink: 0` SIBLING of the truncated name.

### Printed words: VERIFIED ONLY, and only on the public provider page
`<VerifiedMeaning>` (both platforms) prints exactly ONE sentence, and only when verified —
"Verified business — Clinket has confirmed this business's identity."
‼️ **The rule is: a mark gets printed words IF AND ONLY IF it has no chip.** Verified qualifies because
its chip was removed and a seal cannot say a sentence. Every other mark's chip already names it, so
printing "Clinket Preferred — chosen by the Clinket team" underneath is the same words twice — **the owner
caught exactly that on the live page.** The components that printed a line per mark are **deleted**, with
a test on each platform proving they cannot return.

### ‼️ NEVER claim more than we do
Verification is an **identity confirmation, admin-granted**. The shipped copy once read *"identity,
licence and insurance checked by Clinket"* — **we check none of that.** A test in each app fails the
build if `licence` / `license` / `insur` appears in ANY badge meaning, in ANY of the five languages.
On the surface a customer trusts most, an unearned safety claim is the worst defect available.

### Explanations: web hover, phone tap — and the bubble must never be clippable
Every badge explains itself: hover + keyboard focus on web, **tap** on the phone (`onExplain` →
`<BadgeExplainer>`), and the full sentence in the screen-reader text everywhere.

‼️ **The web tooltip renders in a REACT PORTAL on `document.body` with `position: fixed`. NEVER make it
an absolutely-positioned child of the badge** — the first ancestor with `overflow` or a stacking context
crops it, which is exactly how it got cut off against the top of the profile hero. It flips below when
there is under ~96px above, clamps horizontally to the viewport, and dismisses on scroll (**capture
phase** — the scroller is usually an inner element), resize and Escape rather than drifting on stale
coordinates.

‼️ **The phone's explainer sits UNDER the chip row in normal flow, not floating over the chip** — a
floating bubble on a phone hits the very same clipping defect. Flow layout cannot be clipped.

### Tooltips are opt-in, and OFF on cards — deliberately
‼️ **`interactive` is opt-in because a card is covered edge-to-edge by a stretched-link overlay**
(`after:absolute after:inset-0 after:z-[1]`) so a tap anywhere opens the provider. A hover target beneath
it never fires; lifting it above the overlay punches a **dead hole in the card's own tap area**. Only the
public page passes `interactive`; on cards the meanings still reach assistive tech.

### Wording rules
Short, friendly, non-technical, and a full sentence (Verified prints as `Label — meaning.`). Every string
is a localization key in all five languages — **zero hardcoded copy**. Removing a badge surface means
deleting its orphaned keys in the same change.

---

## Session-cache isolation + search notice card + landing facet coherence (2026-07-30)

- **`src/services/sessionCacheRegistry.ts`** — account-scoped module caches self-register a clear
  (`registerSessionCache`); `clearSessionCaches()` runs inside `SessionStore.clear()` (every logout /
  token-expired path) AND in each login-success handler BEFORE the token write (loginAPI, both login
  OTP APIs, register-verify OTP, passkey and the central social-login coordinator). Registered today:
  `lib/spotlightCache.ts`
  (`resetSpotlightCache`). ‼️ **Every registered cache carries a session EPOCH** — an in-flight
  response that started under a previous session must never re-seed the cache after a clear.
  `signalRService.stopSignalRConnection` also clears the `_recentNotifications` dedup map.
- ‼️ `analyticsTracker.linkedSearchId` is deliberately NOT registered: web parity keeps it in
  sessionStorage across auth transitions, guest→login attribution is by design, and the customer
  'login' auth event ALSO fires on every silent refresh (`SessionStore.setToken('token')` emits it) —
  clearing there would break search→conversion attribution. `discoveryService` holds no data cache
  (authPreflight is a self-nulling single-flight); `apiCache`/`bannerService`/catalog/category/policy
  caches are public device-scoped — excluded. SignalR lifecycle was already correct: authEvents
  'login' → connect (token factory reads the current token), logout/token-expired → disconnect.
- ‼️ **`SessionStore.PRESERVED_KEYS_ON_LOGOUT` must list EVERY device-level key** — the clear sweep
  ends in `AsyncStorage.clear()`, so anything unlisted dies with the account. Preserved: spotlight
  guest dismissals, `passkey_local`, observability `clinqet_device_id`, `clinqet_user_location`,
  `clinqet_location_permission_state`, both nudge dismissals, the notification swipe-tutorial flag,
  `appearanceMode`, `language`, `clinket_consent`, `clinket_active_region`, `clinket_locale_country`,
  `selectedCountry`, the PUSH `clinket_device_id` (raw, no expiry — the server retires a device when its session
  ends, 2026-09-29), `clinket_install_marker`, `clinket_discarded_session`, `clinket_session_generation` and
  `clinket_retire_session`. Account data stays wiped (cart, recent
  searches, lastSeen, pending intent). Login-success purges are
  in-memory only (`clearSessionCaches`) so the guest cart survives login for `afterLoginSync` —
  never add an AsyncStorage wipe to a login path. Pinned by `sessionStorePreservedKeys.test.ts`.
- **Search notices** (`screen/homeTab/searchScreenDetails/index.tsx`): the server `responseMessage`,
  `QUALITY_DEGRADED` and the footer depth-cap text all render through ONE `SearchNotice` card
  (brand-green soft surface + border, `info-circle` FaWebIcon, bold title + readable body — the same
  greens as the sibling DYM banner). Title key `SEARCH_RESULT.NOTICE_TITLE` ("About these results",
  all five locales — mirrors web `search.noticeTitle`). Header body priority: responseMessage else
  quality; the depth-cap keeps its footer position (renders only when `!narrowHasOptions`).
- **CategoryLandingScreen facet/scope coherence** — mirrors web LandingContent: `facetBaseline` is
  REPLACED by every response with NO subcategory narrowing (city-scoped included); null ⇒ the load()
  payload's facets; a narrowed response never becomes the baseline. A nearCity change (late location
  resolve or pill dismissal) KEEPS the pressed subcategory chip — refine runs WITH it and a separate
  un-narrowed request re-baselines the sibling counts (`baselineSeq` latest-wins; counts keep the
  previous baseline on failure) — never a full-page reload (pinned by
  `categoryLandingScopeChange.test.tsx`). `refineSeq` makes superseded refinements no-ops; the back-to-default
  shortcut only applies when nearCity matches the base payload's scope (`baseNearCityRef`). An empty
  city-scoped list renders a `NEAR_CITY_DISMISS` outline button under the empty message — same
  handler as the pill's ×.

### Provider-discovery state mirrors (2026-07-30, same session)

- **Catalog cities carry `state`** (`discoveryCatalogService` `CatalogCity.state` + `cityExtras`:
  trimmed lowercase, null when unplaced — mixed short/long forms like "qc"/"ontario"; display casing
  is the UI's job).
- **Hero fallback chips** (`HomeHeroBanner`): up to 3 recommendation-ordered category chips on the
  no-banners fallback slide — the tile list rides in as the `fallbackCategories` prop from
  homeScreen (ZERO new requests); guards = skip empty names, dedupe by slug, cap 3, single-line
  ellipsis; translucent white-on-navy pills (white/15 bg + white/25 border, web parity). Tap →
  `CategoryLandingScreen { categorySlug }` only (it self-personalizes via the Near-city pill), tracked
  with the tiles' verb (`category_browse`, surface home, + `placement: hero_fallback`).
- **CitiesBand rank** (web parity): own city (slug-compared) → same-STATE cities → the rest, ties
  keep the source size order; display cap stays `CITY_COUNT` 8; the see-all link now renders only
  when `cityTotal > displayed` (web D20).
- **CitiesIndexScreen**: groups by PROVINCE when any city has a state — label ≤3 chars UPPERCASE
  else word-capitalized (`stateLabel`), visitor's own province group FIRST, unplaced cities under
  `DISCOVERY_PAGES.CITIES_REGION_OTHER` ("Other areas", all 5 locales, mirrors web
  `cities.index.regionOther`) LAST; first-letter grouping stays the no-states fallback. Featured row
  reordered visitor-city-first then same-state (ties keep size order). The client-side search filter
  already existed — unchanged.

## 2026-07-30 — Phase-6 combining audit
- `jest.config.js` pins `maxWorkers: 50%` (C26 — full-parallel timeouts on the dev machine).
- NarrowYourSearch: `minRating` uses the FALSY check (0 = unset, filters nothing) for web parity — do not revert to a null-check.

## ‼️ 2026-07-30 (session 23) — THE MOBILE SEARCH EXPERIENCE, END TO END

Sixteen drifts against web, all fixed. The three that were genuinely broken are first because each
one silently produced a WRONG ANSWER rather than an error, and two of them had shipped.

### ‼️ There is no `/public/business/{id}/services` route — only the category TREE
`providerService.getProviderServices` requested it for months and got **404** (probed live). The
consequence was invisible: `Promise.allSettled` swallowed it, so `ServiceDetailScreen` — the screen
every service card now lands on — resolved no service, and a search arrival (which carries **no**
prefill) showed a generic title, no price, no siblings, and a `ServiceView` with no `categoryId`.

The only public list is `/public/business/{id}/categories/services`, whose shape is
`category → subcategories → services`. **Category and subcategory identity lives on the TREE NODES,
never on the service object** — a consumer that reads `service.categoryId` off this endpoint reads
`undefined`. `flattenProviderServices` denormalizes it down, and `getProviderServices` reuses the
tree's own cache entry so a profile→service hop costs no second request.

The five routes that actually exist under `/public/business/{id}`: `availability` ·
`categories/services` · `offers` · `portfolios` · `profile`. Nothing else.

### ‼️ The availability wire contract — and why an unconfigured day is now ABSENT
`GET /public/business/{id}/availability` returns `PublicAvailabilityDayDto[]`:
`{dayOfWeek, startTime, endTime, isAvailable, isConfigured}`. **There is no `openTime`, no
`closeTime`, and no `isOpen`.** Three separate mobile copies read exactly those three, and
`slot.isOpen !== false` evaluates `undefined !== false` ⇒ **true**, so every day of every provider
parsed as open with no hours:
- the profile's Business Hours printed "—" seven times and never once said Closed;
- **QuickBook disabled no closed day and offered a 09:00–21:00 fallback window for every provider**;
- Cart's date picker did the same.

One `parseAvailability` in `screen/business/components/profileShared.tsx` now owns it; the other two
copies are deleted onto it. ‼️ **An unconfigured day is omitted from the result, not returned as
closed** — the server sends filler days with no times, and every consumer already reads "no entry" as
"cannot be booked", so absence carries the truth without any caller remembering a flag. A configured
day with `isAvailable: false`, or with missing times, is present and `isOpen: false`.

### ‼️ `!![]` is `true`
The filter sheet ALWAYS writes `subcategoryIds` as an array, so `!!filters.subcategoryIds` was true
after any apply and every card flipped to a price RANGE with no subcategory chosen. Any test of
"is this list filter active" must be `?.length`.

### Facets must describe the set on screen — at the right grain, at the right scope
- **`grain`**: `/search/filters` counts on whichever engine answered the results. Provider mode must
  send `grain=Provider` or the chips describe the service corpus. (Remember FILTERABLE ≠ FACETABLE —
  a copied facet field 503'd this endpoint once.)
- **Scope**: counts are fetched for the same COMMITTED scope as the results call (`useSearchFacets`),
  never location-only. ‼️ **The cost guard is the interesting half:** a scope that is only the
  visitor's location is answered from the app-wide `FiltersProvider`, which has already asked exactly
  that question — so browsing buys no extra request and only a real search or filter pays for its own
  counts. `deriveFacetGroups` is the single definition of payload → display groups, shared by the
  provider and the hook so they can never disagree on ordering.
- The results screen hands its scoped facets to `FilterScreen` by route param; reaching for the
  app-wide provider there would offer subcategories this result set does not contain.

### The "About these results" notice — `utils/searchNotice.ts`
The server composes the WHOLE sentence (spell · expansion · the two combined · related context) and
returns nothing on a clean exact match. The client renders `message` and gets out of the way.
‼️ **Never borrow the degraded line as a fallback** — `responseMessage || QUALITY_DEGRADED` told the
customer their results were degraded on every plain spell correction, a claim the server never made.
Degraded is its own flag. **Deliberate mobile deviation, keep it:** web folds the depth cap into the
same box; on a phone that sentence belongs at the FOOTER of the list the visitor just scrolled.

### The category strip above the search box is PERSONALIZED
Order = the recommendation engine's category order, ranked within `catalog ∩ location facets`, then by
local service volume. ‼️ **The intersection is not cosmetic:** the catalog knows which landing pages
exist, the facets know what this location actually has — either alone either links to a page that does
not exist or promises something the city cannot book. The ordering signal rides the
recommended-services response the rails already need, so it costs **no extra request**. A tile opens
the **category landing screen** when the catalog lists a slug for it, and the scoped search listing
only when it does not. Tiles carry their local service count.

### `(0,0)` is Null Island, and half a pair is not a place
`isUsableGeoPair` now guards `/search/suggest` and all three discovery rails
(`getRecommendedServices` / `getRecommendedProviders` / `getRecentlyViewed` via one `appendPosition`).
The rails were the last unguarded search-family call sites.

### Analytics
`ServiceDetailScreen` sends `eventSubType: from_search | direct` (via `getLinkedSearchId()`) and
`subcategoryId`, matching web. Without it every mobile service view logged as `direct`.

### Content the landing and city screens were missing
- Category landing: the computed **"from the numbers"** questions (derived from the live counts on the
  page) AND the authored **"Good to know"** set (`getFaqs(language, FAQ_CODE_LANDING)`). They never
  share a heading — one is derived, one is editorial. The written set follows the LIVE language via
  `i18n.language`, not a one-shot `getActiveLocale()` read; that also keeps the whole i18n module out
  of the screen's import graph, which is what a jest suite trips over.
- City: the at-a-glance figure and the browse-all action share ONE card (the number is the reason to
  press the button), plus the `CITY_INTRO_MORE` variant for >3 categories.
- Home: the designed empty state when a location has no categories (badge · title · body · **Change
  location** · **Check again**). An empty grid reads as a failed load and offers no way out.

### Navigation types
`CategoryLandingScreen` / `CategoryHubScreen` / `CityScreen` / `CitiesIndexScreen` are now in
`RootStackParamList`. They had been navigated by bare string from `useNavigation<any>()` call sites,
so nothing type-checked them — adding them is what surfaced the tile-navigation change as an error.

### Verified correct, left alone
`ProviderBadges` (byte-for-byte port: same codes, colours, chip limit, Verified-only printed meaning) ·
`NarrowYourSearch` (faithful, and it passes `subcategoryName` where web does not) ·
`CitiesIndexScreen` (every web key covered) · the landing screen's `facetBaseline` and
near-city-survival logic · the provider profile · the notice rendering on the results surfaces only.

### ⏳ UI GATE still open
Web's service page shows a photo STRIP with "+N more"; mobile renders one image in the existing hero
box. A multi-photo gallery is a genuinely new layout pattern — **mock it and get approval first.**

### Customer invoices (built 2026-07-30, session 23)

`src/screen/invoices/` — list + detail, at **strict web parity** by owner ruling
(*"no new changes just follow what we have on web except for the pay"*). Service in
`services/customerInvoiceService.ts`, pill in `components/InvoiceStatusPill.tsx` with web's palette
copied verbatim, Profile row in web's exact slot behind the same `onlineBookingPayEnabled` gate.

‼️ **THE CEILING, and it is the SAME on web — do not promise more.** `CustomerInvoice` is a
denormalized SUMMARY document with **no `Items` array**. The itemised `Invoice` (which carries
`List<InvoiceItem>`) is provider-scoped: `GET /invoices/{invoiceNumber}` resolves the caller as a
BUSINESS, so a customer cannot read it. And **none of the 13 invoice endpoints exposes a PDF** — it is
generated inside `InvoiceEmailProcessor` and attached to email. Neither platform can show line items,
tax or a document. Adding any of it is a SERVER change ⇒ BUILD GATE.

‼️ **Paging trap:** the payload can carry a `continuationToken` alongside `hasMore: false`. Gate the
token on `hasMore` or the list asks for a page that is not there.

**Deliberately absent:** the pay action, filter chips (the API accepts `status`; web never passes it),
and the booking link (`context: "Booking"` + `contextId` are on every invoice; web ignores both).

### `(0,0)` and half pairs — now guarded on every search-family call site
`isUsableGeoPair` guards `/search/suggest` and all three discovery rails via one `appendPosition` in
`discoveryService`. `Number(null)` is `0` and `0` is finite, so an unresolved position asked the
recommender for Null Island and a half-resolved one sent a lone latitude.

### Two testing rules this session paid for
- **A fix without a spec is not done.** The `!![]` fix shipped untested and was only caught on a
  re-verification pass; it now lives in `utils/appliedFilters.ts` with its own specs.
- **A test file with no top-level import/export is a global SCRIPT** — two of them declaring `mockGet`
  is a `tsc` error even though jest passes. Add `export {};`.

## ‼️ 2026-07-30 (session 24) — SIX DEAD ROUTES, AND THE ANALYTICS SURFACE MAP WAS INCOMPLETE

### The route table is the contract — diff it, then PROBE it
Every URL the app builds was diffed against the C# `[Route]`/`[Http*]` attributes and then probed live.
Six were fiction. `request()` never throws, so **each one failed silently, forever**:

| Route the app called | Truth |
|---|---|
| `DELETE /api/v1/Auth/account` | ‼️‼️ does not exist. Deletion is **`POST /UserProfile/account-deletion/request` → OTP → `/confirm`** |
| `POST /public/businesses/{id}/reviews/{rid}/votes` with `{isHelpful}` | ‼️ votes are **authed and not public**: `POST /businesses/{id}/reviews/{rid}/votes` with **`{ voteType: 'Helpful' \| 'Unhelpful' \| 'None' }`** |
| `GET {MAIN}/api/v1/usermetadata` | ‼️ `UserMetadataController` is **identity-hosted**. Anything named `usermetadata` or `UserProfile` lives on `AUTH_URL` — the Main API has no UserProfile controller at all |
| `GET /bookings/{id}/invoice` · `GET /Auth/profile` · `GET {MAIN}/userprofile/friendlyname/check` | none exist |

‼️ **A 404 vs a 401 is the cheap discriminator**: hit the route unauthenticated. A real `[Authorize]`
route answers 401; a route that does not exist answers 404 — no token needed.

### Account deletion: ONE flow, and it is the modal
`components/DeleteAccountModal.tsx` (reached from My Profile) is the only implementation: policy step →
`requestAccountDeletion()` → 6-digit OTP with a resend cooldown → `confirmAccountDeletion()` →
`onDeleted`. It fires `account_delete_init` / `account_delete_confirm` on `settings.deleteAccount`.
The settings-stack `DeleteAccountScreen` was **deleted**: unreachable, no OTP step, and its 404 call
made the app *claim* the account was gone. There is no `deleteAccount()` in `profileService` any more.

### Registration must never invent a country
`AuthService.RegisterAsync` **derives `Country` from `CountryCode`** when Country is absent — so a fixed
dialing code stamps every account with that country (currency, jurisdiction, region routing, marketing).
Send the resolved ISO country from `useCountry()` (`{ Country: countryCode }`) or send neither, which is
what web does. A stale-policy 409 is the registrant's own to handle: `urlApi.post(..., { skipPolicyRetry: true })`,
because the global re-consent modal needs a JWT a registrant does not have. On that 409:
`invalidateCurrentPolicyCache()` → uncheck the terms box → `REGISTER.POLICY_STALE` → `register_policy_stale`.

### `isDayBookable` is the one availability predicate
`parseAvailability` OMITS an unconfigured day, so **"missing" means "not bookable"** — only a schedule
that never loaded stays permissive. Both the cart date picker and QuickBook go through
`isDayBookable(schedule, dayName)` in `screen/business/components/profileShared.tsx`; a second copy is
how the cart came to offer days that then produced zero slots.

### A notification about a message must open the message
`utils/notificationNavigation.ts` resolves a conversation id from `properties`/`data`/`metadata` and a
`metadata.context === 'conversation'` hint, exactly like web. `DirectMessageReceived` and a
conversation-scoped `BroadcastMessageReceived` open `ChatScreen`; everything else keeps its old target.
‼️ **`ChatScreen` accepts `{ conversationId }` alone** and hydrates the header via `getConversationById` —
it used to require a whole `conversation` object and left a permanent spinner without one.

### `src/utils/navigationTargets.ts` — the ONE way to open a screen that may live elsewhere
```ts
navigateToScreen(navigation, navigations.INBOXSCREEN);   // returns false if it could not
```
Reachability-first (walks `getParent()`), then the fully qualified root-anchored path
(`BottomTabs > [MyDashboardRoute >] screen`), and **refuses to navigate when the tab shell is not
mounted** so the dashboard is never pushed over the login screen. The provider app's twin is
`src/Util/navigationTargets.ts`.

‼️ `navigate()` bubbles UP only and the tabs are `lazy`, so a flat `navigate('MyBookingScreen')` off
the container ref reached **nothing**: every booking notification with no booking number, and every
message notification with no conversation id, was a dead tap. The inbox target was worse —
`ConversationList` was in the constants, the param list and the analytics surface map but was never a
mounted screen (the tab is `InboxScreen`), so it could never resolve at all.
`__tests__/notificationScreenRegistration.test.ts` reads the screen names out of `App.tsx` and
`src/appNavigation/*.tsx` and fails on both shapes — an allowlist cannot tell "registered" from
"somebody typed it into the allowlist".

### The cart never sends the shopper away
`components/cart/AddCartItemSheet.tsx` is the mobile shape of web's `AddItemSidebar`: same provider,
search, category groups, in-cart state, and web's dual-location prompt (`isAtStore && isAtCustomersLocation`
⇒ ask; otherwise set it automatically). It reports `trackCart add` on web's **`cart_add_item_sidebar`**
surface. Services come from the category TREE via `flattenProviderServices` — there is still no flat
services route.

### Reviewer names: the DTO chain, nowhere else
`ReviewResponseDto` has `userDisplayName` + `userFirstName`/`userLastName`. `userName`, `customerName`
and `reviewerName` are fiction — reading them showed "Customer" on every review and broke the profile's
review search. Counts are `helpfulVotes`/`unhelpfulVotes`, never `*Count`.

### Service detail mirrors web's REVIEW TRUTH
Web's service page shows the rating summary, star + title + comment, and **"See all reviews for this pro"**
— no votes, no author-only invention. Mobile now matches, keeps its distribution + star chips (they read
real fields and cost no request), and `ProviderProfile`/`BusinessProfile` accept `initialTab` so the
see-all link opens the tab it names.

### ‼️ ANALYTICS: the surface map must cover EVERY registered route
Fifteen registered routes had no entry, so their PageViews carried `surface: undefined` — including all
four discovery screens, both invoice screens and payment history. `__tests__/analyticsParity.test.ts`
enumerates `App.tsx` + both navigators and **fails on any route without a surface**; the seven OTP
screens are asserted as deliberately suppressed (web suppresses the same paths).

Surfaces are web's own names: `category_landing` · `city_landing` · `cities_index` · `invoices` ·
`invoice_detail` · `settings.payments`.

Events that were missing and now fire: `policy_view` on all **eight** legal screens · `location_nudge_cta` ·
`mark_read` (the explicit control only — a row tap is `notification_click`) · `contact_provider` on a
quote's Message link · `payments_view` + `has_payments` + `useDwell('settings.payments')` ·
`cta_click {target, placement}` and `trackResultClick provider_profile {placement}` on service detail
(web tags Book/Call/Profile by placement) · `register_policy_stale` · `trackCart add` from the cart sheet.

**Method worth repeating:** parse every `track*(…)` call in both apps with a balanced-paren scan and diff
by `(helper, action)`. It found all of the above in one pass, and it found a **web** bug: `/my-invoices`
was missing from `STATIC_TOP_SEGMENTS`, so every invoice-list PageView was labelled `provider_profile`.

### Payment history reads the BOOKING, and only one page
There is no payments endpoint — a booking that carries a payment IS the row. The row title is
`businessName` (not `serviceName`/`title`/`service.name`, none of which exist), the date is
`payment.capturedAt ?? authorizedAt ?? booking.scheduledStartDateTime` (not `scheduledAt`), currency
falls back to `booking.price.currency`. Ask for **one page** (`getBookings({pageSize:50})`) like web —
`getAllBookings` walks up to 50 sequential pages. `Disputed` is its own pill, not "failed".
‼️ **The receipt download is owner-blocked**: the PDF route needs a Bearer token, so `Linking` cannot
fetch it, and RN has no filesystem/share dependency installed (`react-native-blob-util` + `pod install`).
### ‼️ An optional field must be ABSENT from a FormData, never appended as `undefined`
RN's `FormData.append` stringifies `undefined` to the literal **`"undefined"`** — nine characters that
sail past a "did I send it?" reading and then fail server validation. Dropping `CountryCode` from the
register payload while leaving `formData.append("CountryCode", data.CountryCode)` in `registerAPI.tsx`
would have returned **HTTP 400 on every single signup** (`[StringLength(5)]`).

`JSON.stringify` drops an undefined property; `FormData.append` does not. **Guard every optional append**
(`if (data.X) formData.append(...)`), as `aiService`, `EditProfileScreen` and `MFASetupScreen` already do.
Pinned by `session24Parity.test.ts`, which allows an unguarded append only for fields the form validates
as non-empty before submit.

**And the meta-rule:** when you report a fix, re-read the FILE, not your own notes. The verification pass
that caught this also caught a `getBookingInvoice` deletion that had been reported and never made.

## ‼️ 2026-07-31 (session 25) — THE WRITE PATHS. `request()` NEVER FAILS, SO NOTHING FAILED

Session 23/24 hardened what the app READS. This session found that what it WRITES could not report a
failure at all. Fourteen mutating call sites resolved `{success:false}` and carried on to the success
branch. The three that mattered most destroyed customer state.

### ‼️‼️ A rejected booking cleared the cart and showed a success screen
`CheckoutScreen`, `CartScreen` and `QuickBookScreen` each did `await createBooking(payload)` and then,
unconditionally: fired **`checkout_success`** (the conversion event), cleared the cart / that provider's
group, and rendered the success screen with `bookingNumber: ''`. A validation failure, a double-booking,
a tier limit or a 401 and **the customer's cart was gone and they believed they had an appointment.**

**`src/utils/apiEnvelope.ts` is now the single predicate** — `isApiFailure` / `apiFailureMessage` /
`apiFailureCode`. Every mutating call site branches on it BEFORE committing: `checkout_fail` with the
real `error_code`, the **server's own sentence** to the user, and no state change.

‼️ **A false success is worse than a missing event.** "Never break analytics" includes never inflating
a funnel with conversions that did not happen.

Also hardened this way: booking accept/reject reschedule · quote award/reject/withdraw/convert/edit ·
the quote-list withdraw · address add/update · inbox mute/hide. (`ChatScreen` already branched; the
`ConversationListScreen` copy of the same two actions never did — **a second copy is where the guard
goes missing.**)

### ‼️ Navigation params are a contract, and it was not being checked
`BookingDetailScreen` reads **`bookingNumber` only**. Both quote surfaces navigated with `{ bookingId }`
— including the success path of a quote conversion — so the screen fetched `undefined`, and because
`setBooking(res?.data ?? res)` treats a **truthy error envelope** as a booking, it rendered a *fake*
booking rather than Not Found. `RootStackParamList` had declared a `bookingId?` the screen never read,
which is what made the mistake typecheck-clean under `useNavigation<any>()`.

**`__tests__/navigationParams.test.ts`** parses `RootStackParamList` plus every
`navigation.navigate(route, {…})` call site and fails on any key the route does not declare. It found a
second one immediately (`addressId` → a screen that reads `address`). `types.ts` was corrected in the
same pass: `ChatScreen.conversation`, the whole checkout trio's params, and 7 provider-profile params
were all undeclared.

### ‼️ The Booking entity carries NO provider slug, picture, phone or address
`GET /bookings/{n}` and `/bookings/customer` return the raw `Booking`
(`clinqetcore/Entities/COSMOS/Cosmos.cs:2037`) — `businessId` + `businessName` and nothing else about
the provider. `businessFriendlyName`, `providerFriendlyName`, `slug` and `businessProfilePictureUrl`
are **fiction**. Consequences before the fix: the provider card was never tappable, **"Book again"
always landed on Home**, and a conversation started from a booking had no avatar.

The screen already fetches `PublicBusinessProfileDto` (for the description/rating block) and that DTO
carries `friendlyName` + `profilePictureThumbUrl` ⇒ read them there, **zero extra requests**. Web has
the same null `providerSlug` and has not closed it.

### ‼️ `BookingPagedResultDto` has no `totalCount`
It is `{ bookings, continuationToken }`. The list read four phantom paths for a total and then fired
**three extra authed `pageSize: 1` requests per mount** to feed tab badges that can never render (with
≥2 bookings in a tab, Cosmos always returns a token, so the `!nextToken ⇒ items.length` fallback never
fires). Prefetch deleted; the count now comes free from the real page when it drained the tab.

### The review a booking submits
`CreateReviewDto.Title` is **optional** — never invent one (`title: data.title || undefined`). The
booking screen carried a **third, stunted copy** of the review form with no service picker and no
anonymous toggle, so `ServiceId` never left the phone and **ServiceRating aggregation saw no mobile
reviews**. That copy is deleted onto `screen/business/components/ReviewFormModal`, which gained an
`initialRating` prop for "rate your booking" links. `MyReviewsScreen` still keeps its own copy.

### Dead things removed
`RescheduleBookingScreen` — registered in `App.tsx`, typed, given the analytics surface
`booking_reschedule`, **navigated from nowhere** (web deliberately has no customer-initiated
reschedule). Screen, route, constant, type, surface and 6 locale keys ×5 all deleted.
`src/hooks/useMessagingRedux.ts` — 250 lines, zero consumers. ‼️ **Repo-wide ESLint errors are now 0**
(the three standing ones were unused imports in these files).

### Two rules this session paid for
- **A source-level guard must pin the BINDING, not the vicinity.** A sabotage that unbound `res` from
  its call (`await award(...); const res = null;`) left the guard text in place and the assertion
  passed for the wrong reason. Assert `const res: any = await <call>;` exists, then look for the branch.
- ‼️ **Never edit these files with `sed -i` or a `\s*`-anchored multiline regex.** The working tree is
  **CRLF** (git stores LF via `core.autocrlf=true`). `sed -i` strips CR from every line, and JS
  multiline `^` matches after a bare `\r` too — one such replace left a bare CR and made git show the
  whole file as rewritten. Use a `\r\n`-aware line scan and check `git diff --numstat` after.

### Invoice pay (built 2026-07-31, session 26) — ‼️ web had this action for months, mobile did not

Customer web renders **Pay now** on any invoice in `Sent` or `Overdue`
(`app/(customer)/my-invoices/[invoiceId]/page.js:116-123`) → `/invoices/{number}/pay?b={businessId}`.
Mobile's detail screen ended at the total row, so **a customer holding an unpaid invoice could not
pay it in the app.** No server change was needed — the endpoint already existed.

- `src/screen/invoices/InvoicePayScreen.tsx` — registered as route **`InvoicePay`** specifically so
  `inferSurfaceFromRoute` yields **`invoice_pay`**, the same surface web infers from `/invoices/*/pay`.
- `initiatePublicInvoicePayment(invoiceNumber, {businessId, email})` → `POST
  api/v1/booking-payments/public/invoice/{invoiceNumber}/initiate` (`[AllowAnonymous]`,
  `BookingPaymentController.cs:317`; the server matches `email` against `invoice.Customer.Email`).
- `InvoiceDetailScreen` gates the CTA on `PAYABLE = new Set(['Sent','Overdue'])`, mirroring web.

‼️ **There is NO confirm endpoint and NO status endpoint for an invoice charge** — the gateway webhook
reconciles it, exactly as the web sheet does for `mode="publicInvoice"`. The screen settles to a
"confirming your payment" state. **Never invent a confirm call here.**

**Mobile is deliberately BETTER than web:** web always makes you type the email; mobile auto-quotes
with the signed-in address (one tap) and falls back to an editable field **with the reason** on a
mismatch — never a dead end.

### Shared rails introduced in session 26 — ‼️ do not re-copy these

| Module | Replaces | Why |
|---|---|---|
| `src/utils/stripeSheet.ts` — `presentStripeSheet()` | the inline sheet plumbing in `BookingPaymentSection` | one lazy `import('@stripe/stripe-react-native')` boundary for **both** pay surfaces. Returns `'ok' \| 'no_key' \| 'init_failed' \| 'cancelled' \| 'declined'`; the CALLER owns the copy and the analytics reason |
| `src/hooks/useOtpCountdown.ts` | **five byte-identical timers** in the OTP screens | ‼️ every copy called `navigation.goBack()` from **inside a `setElapsedTime` updater**. React may run an updater more than once per tick ⇒ **the screen could pop twice.** The exit is now an effect on the *committed* value |
| `src/components/BlockingLoader.tsx` | an inline-styled scrim copied per screen | ‼️ its `accessibilityLabel` **must be a localization key** (`t('COMMON.loading')`) — a screen-reader label is user-facing copy and `sourceLocalizationIntegrity.test.ts` enforces it |

### ‼️ Auth submit guards (session 26)

All five OTP screens shipped `disabled={!isOtpComplete}` with **no in-flight term**, so the same code
could be submitted repeatedly — **each attempt counting toward identity lockout** — with the loader
state tracked and never rendered. Web has always used `disabled={otp.length < 6 || isLoading}` plus a
button loader. Mobile now matches: `disabled={!isOtpComplete || isLoaderLoading}` +
`<BlockingLoader show={isLoaderLoading} />`.

### ‼️ Where the failure guard lives — read the SERVICE before calling a site unguarded

`request()` RESOLVES rejected envelopes, but the guard does **not** always belong in the screen:
`reviewService` (`ensureSuccess` → throw) and `communicationService` convert `success:false` into a
**throw**, so their callers' `try/catch` is real. Session 26 swept **all 100** mutating call sites;
`MFASetupScreen` was the only unguarded one — it reported `mfa_enable_success`, flipped the toggle and
alerted "saved" while the server had **refused to enable two-factor auth**.

## ‼️ 2026-07-31 (session 27) — GUARDS THAT DID NOT BITE, AND THE THINGS THEY WERE HIDING

### The service photo gallery — LOCKED DESIGN (owner-approved 2026-07-31)

`src/components/ServicePhotoGallery.tsx`, rendered at the top of `screen/provider/ServiceDetailScreen`.

| Rule | Reason it is a rule |
|---|---|
| ONE full-bleed paged rail, `width × min(width·0.72, 44% of viewport)` | ‼️ Web renders a hero **plus four square tiles whose "+N" overlay is NOT clickable** — its extra photos are unreachable. One rail reaches every photo and costs no vertical space per extra image |
| **N = 1 → identical treatment**: no dots, no counter, `scrollEnabled={false}` | a lone photo must read as a deliberate choice, never as a broken carousel |
| **N = 0 → the component returns `null`** | a grey 4:3 panel is screen spent saying nothing, and it pushes the price below the fold. Same call web makes |
| the 44% viewport cap | the price must survive the fold on a short device |
| counter pill `rgba(3,40,88,.72)` + brand-green pill dots (cap 8 + overflow tick) | orientation without chrome |
| the identity block rides **up 20pt** (`heroSectionWithPhotos`, 24pt top radius) and **left-aligns** | a centred column under a full-bleed photo leaves a dead band and truncates long names. Photo-less services keep the centred icon layout |
| ‼️ **the sticky footer is `[Call] [Add to cart] [Book now]`** | Call was missing from the mobile bar entirely unless online booking was OFF — absent exactly where it works. Web's mobile sticky bar has always carried it |
| the rail renders `getMediumSrc`, the viewer `getOriginalSrc` | the rail is on the page-load path |

### `ImageLightbox` is the app's ONE full-screen viewer

Renamed from `ReviewImageLightbox` (reviews · portfolio · service gallery all use it).
‼️ **Its old "counter" pill rendered only a picture GLYPH — no `n of N`** — so a customer paging a
multi-photo set had no idea where they were. It is now a real counter (`COMMON.photoCounter`),
swipe-paged with `pagingEnabled` (arrows kept for discoverability + assistive tech), and every
control carries a localized `accessibilityLabel`.

### ‼️ Receipt PDF download — and why the status check IS the feature

`src/utils/receiptDownload.ts` → `GET booking-payments/{id}/receipt`.
- The route is `[Authorize]`, so `Linking.openURL` can never serve it: the PDF must be fetched with
  the Bearer token, which needs a filesystem ⇒ `react-native-blob-util`.
- ‼️ **The module is resolved at RUNTIME**, exactly like `utils/clipboard.ts` — a build that has not
  run `pod install` must still start, and the caller hides the action. `isReceiptDownloadAvailable()`.
- ‼️ **blob-util writes the response body WHATEVER the status.** A 401/500 lands on disk as a "PDF"
  that opens to an error page. `res.info().status !== 200 ⇒ unlink + 'failed'` is the whole point.
- The row gate is `{Captured, Transferred, Refunded, PartiallyRefunded}` — byte-identical to the
  server's own check and to web's `hasReceipt`.

### ‼️ `Share.share` resolves on CANCEL

iOS returns `{ action: 'dismissedAction' }` when the sheet is dismissed. The provider profile fired
`share_method` unconditionally, so **a cancelled share counted as a share**. Always branch on
`result.action === Share.dismissedAction` before reporting. (Android has no cancel signal and always
returns `sharedAction` — that asymmetry is expected.)

### ‼️ The failure predicate is `isApiFailure`, and only `isApiFailure`

37 sites across 18 files were spelled `res && res.success === false` / `res?.success === false`.
All null-safe, so this was consistency rather than a crash — but **a second spelling is where a guard
goes missing**. `apiFailureCode` now reads `code ?? statusCode ?? status` (`statusCode` is a real
`ApiResponse` field). ‼️ `isApiFailure` is a **type predicate**, so it narrows `any` to `ApiEnvelope`
inside the branch — a field not on that interface becomes a compile error, which is how `statusCode`
surfaced.

### ‼️ The shared `ReviewFormModal` had no image guards

Session 25 collapsed the booking review path onto it, but it validated **no file size**, ignored
`response.errorCode`, and made a denied camera permission a **silent no-op** — an oversized photo
joined the strip and failed at upload with nothing on screen. It now mirrors `MyReviewsScreen`'s copy
and the server's `Storage:ReviewMedia` (`MaxFileSizeBytes` 10 MB, `MaxFileCount` 5).
`MyReviewsScreen` still keeps its own copy; both send `title: data.title || undefined` (Title is
optional on `CreateReviewDto`) — verified at all three call sites.

### ‼️ `/do-not-sell-share` is a COMPLIANCE surface, not a convenience

Web links it from the global footer. `DoNotSellShareScreen` existed, rendered the toggle, emitted
`policy_view`, had copy in five locales — and was reachable from **nowhere** (a commented-out
`<MenuItem>`). It is now the last row of Support & Legal and routed at `/do-not-sell-share`.

### Universal links — the association claimed the app had no screens it has had since session 23

Now claimed: `/my-invoices*`, `/passkey-setup*`, `/do-not-sell-share*`, and the six `settings/*` paths
that have screens. ‼️ **`settings/*` is claimed PER PATH, never as a wildcard**: `/settings/delete-account`
has no screen by design (deletion is the OTP modal on My Profile — session 24 deleted the screen
because its endpoint 404s and it *claimed the account was gone*). `/auth/*`, `/booking-pay/*`,
`/invoices/*`, `/reviews*` and `/settings/delete-account*` stay excluded.
‼️ `assetlinks.json` carries **no path list** — Android filters paths in `AndroidManifest.xml`.
`SecurityPasskeysSetup` is the same screen under a second route name, because one linking key cannot
carry two paths (same pattern as `ProviderProfile`/`BusinessProfile`).

### ‼️ THREE SCANNING TRAPS THAT ALL COST REAL TIME IN ONE SESSION

1. **Never parse a JSX tag with `indexOf('>')`.** `onPress={() => …}` contains a `>`. A labeller that
   did this spliced attributes into the middle of an arrow function across ~20 files; only `tsc`
   caught it. Use a **brace/paren/quote-depth scanner**, and dry-run before writing.
2. **A dep-array matcher must allow MORE than one trailing character.** `useFocusEffect(useCallback(fn, [x])),`
   closes with `),`; a single-char pattern silently skipped **every nested-hook dep array in the app**,
   and the sabotage that proved it passed against broken code.
3. **A touch-target guard keyed on `styles.<name>` cannot see a control with no style prop** — whose
   box is exactly the glyph, i.e. the smallest case of the lot. Widen to "no style prop + a handler".

`__tests__/hookDepsTdz.test.ts` is the general TDZ guard: it partitions each file at its column-0
declarations and fails on any hook dependency naming a `const` declared **later in the same region**.
ESLint's `exhaustive-deps` asks for the missing dep; it has no idea whether adding it is safe.

### Accessibility: classify by the HANDLER, never by the glyph

A left chevron is "Back" in a header and "Previous" in a gallery; an × is "Close" on a sheet and
"Clear" on a search field. ‼️ **A wrong screen-reader label is worse than a missing one** — 56 controls
were deliberately left unlabelled rather than guessed. `hitSlop` is the right fix for a sub-44pt
target: it grows the touch region **without moving a pixel of the design**.
Pinned by `__tests__/accessibilityTargets.test.ts`, which also pins its own tag scanner.

### The dead 100 ms i18n poll is gone from all nine auth screens

`isInitialized` was **read by nobody**; one screen had already had its read elided
(`const [, setIsInitialized]`) to silence the linter while the timer stayed. Also removed:
`Forget_password_phone`'s entire country picker (`setShowPicker(true)` was never called, so
`loadCountryList` and `handleCountrySelect` were unreachable) and both dead `fetchCountryListApi`
exports.

‼️ **`LoginOTPScreen` serves BOTH passwordless paths** and its copy must name the channel the code
actually went to: `otpMethod` is hydrated on mount from `AsyncStorage.getItem('loginOtpMethod')`
(written `'phone'` by `LoginWithPhoneAPI`, `'email'` by `sendLoginEmailOtp`). It used to be a
`useState('phone')` with no setter, so every email login read "we sent a code to your phone number".

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

## Two-stage suggest on the search screen (search-performance Phase 5, 2026-08-10)
`src/screen/homeTab/searchScreen/index.tsx` (the app's ONLY fetchSuggestions call site) mirrors the
web SearchBox: per debounced keystroke a `scope=Completions` request renders instant text
completions; a second 250 ms pause timer fires the FULL suggest whose service cards join the same
list. Stage 2 never wipes a rendered list with an empty answer; submit/unmount clear the pause
timer and abort in-flight requests.

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

## SEARCH-TOPOLOGY PHASE 3 — the customer phone app (2026-09-22/24)

Server side: `clinqet-search-discovery` → "PHASE 3". Web parity: `clinqet-user-app` (same RULES, phone design).

- **No Google geocoding on the device** (pinned by `noDeviceGeocoding`): `src/context/LocationContext.tsx` never
  stores a GPS fix, stores a manual pick as coordinates only, and a restored pick never marks permission granted;
  `src/services/placeService.ts` calls `GET /api/search/place` (optional-auth GET in `apiManager.tsx`,
  `search_place_url`); `src/config/searchConfig.ts` holds the lookup timeout and the English lookup language used
  for the city filter.
- **Place chip** — `src/utils/resolvedPlace.ts` (maps the server answer to 8 chip states),
  `src/components/ResolvedPlaceChip.tsx`, `src/utils/searchScope.ts` (the pair rule behind B-10),
  `src/hooks/useIsOffline.ts`; `src/components/LocationPickerModal.tsx` uses server lookups ("set" / "which one"
  modes, "Anywhere in {country}", swipe to close; the last choice wins).
- **One price formatter (D-68)** — `src/utils/servicePrice.ts` (+ `priceType.ts`, the four "range" spellings),
  `src/components/ServicePriceLine.tsx`, `ServicePriceDetails.tsx`, used by every price surface.
- **Quote screen (B-18)** — `src/utils/quotePlace.ts` + `CreateBroadcastScreen.tsx`: only the quote's own place's
  coordinates + ISO country (a Places suggestion's own country; a chip-chosen city resolved through the place
  endpoint; the device's country only when the server named it for EXACTLY those coordinates); NULL when unknown,
  never the visitor's; budget currency follows the destination (`src/utils/currency.ts` maps all 24 listed
  countries); Reset restores the device place with its country. The phone has no free-text city field.

### Close-out 2026-09-25 — the approved location rules and server pricing
- **A point is never a city filter** (UM-12): `LocationContext` publishes a device fix at once and names it in the
  background; a new fix clears the old name; `locationCity` and `indexCity` are GONE. `city` is sent only when the
  customer CHOSE one (the filter sheet or a city page) — never inferred from a point, on search, providers, filter
  counts, suggest, the rails or the quote placeholder.
- **The chip** (UM-13/UM-33a): "Anywhere" is removed; no location ⇒ `NONE_COUNTRY` ("Showing providers across
  {country}", the server's `countryName`) or `NONE_ALL` only when coverage is `Unknown`; outside our countries ⇒
  no chip, the empty state explains. A pick shows the customer's own words (in memory, never stored — D-78).
- **"Which {place}?"** (UW-33): `resolvedPlace.choices` (usable points only, never a list of one) opens
  `PlaceChoicesSheet`; picking re-runs the search at that point. The quote confirm step reuses it (UW-18).
- **Price**: every booking site prices from the server (`serviceBookingPrice`, `useBookingPricePreview`,
  `CheckoutPriceSummary`); `hasSetPrice` mirrors the server's `HasNoSetPrice` — an unpriced service offers
  "Get a quote" (`useQuoteRequest`), never $0/"Free"; "From" only when the server sends `fromPrice`.
- **L8 — hero and landing hub ask about the SEARCHED POINT** (`utils/searchedPoint.ts`: `searchedArea` = the location's 2-decimal
  cell + `place.countryCode`, label = the server's city): no catalogue slug match, no top-N city limit, so a non-English name or an
  unlisted city keeps its local hub; the banner cache and hero request key include the cell; a city page sends its own city and no
  point; no point ⇒ the old city/unscoped request. Unnamed point ⇒ `DISCOVERY_PAGES.NEAR_HERE_DISMISS`. Tests: `searchedPointHub`.

### ‼️ DD-36 (2026-09-25) — NO GOOGLE KEY IN THE APP; places and map images come from OUR API
- `GOOGLE_MAPS_API_KEY` is GONE from `config/env.ts` and `apiManager/constant.tsx`; `react-native-google-places-autocomplete`
  is uninstalled. `__tests__/noDeviceGeocoding.test.ts` fails on any `maps.googleapis.com` / `places.googleapis.com` /
  `maps/api/{geocode,place,staticmap}` string, any `GOOGLE_MAPS` name or `AIza…` key in `src`, and any Google Places/Maps
  dependency in `package.json`.
- `services/placeSuggestionService.ts` — `GET api/v1/geocoding/suggestions` (`input`, `sessionToken`, origin pair or none,
  `countries`), `GET api/v1/geocoding/places/{placeId}?sessionToken=` (ENDS the session; English parts, the server's
  `countryCode` — US territories already "US"), `GET api/v1/geocoding/static-map?kind=Place|Area&…` (signed URL rendered
  as-is, https only; cached per request, success only, `STATIC_MAP_CACHE_ENTRIES`). All through
  `getWithOptionalAuthUrlWithStatus` (a 429 is `rate_limited`, 503/5xx/network `unavailable`, 404 `not_found`).
  ‼️ Build query strings with `append`, never `set` — RN's own `URLSearchParams` throws on `set`/`get`/`has`.
- `newPlaceSessionToken()` = UUID v4 from `crypto.getRandomValues`. ONE per typing session: every suggestion call and the
  one place call share it; a new one after a pick, after the field is cleared, or when the input unmounts. A 429/503 on the
  pick keeps it (Google was never asked); any other answer ends it.
- **`components/PlaceSearchInput.tsx` is the ONE place-search input** (debounce `PLACE_SUGGEST_DEBOUNCE_MS` 250, min
  `PLACE_SUGGEST_MIN_CHARS` 2, a newer keystroke aborts the older request, in-flow rows so taps land inside a
  `keyboardShouldPersistTaps` scroller, rows are buttons with label + `PLACE_SEARCH.CHOOSE_HINT` + busy state, states
  `PLACE_SEARCH.SEARCHING / NO_RESULTS / UNAVAILABLE / RATE_LIMITED / PLACE_FAILED` in all five locales — an outage is
  never "no results"). `excludeTypes` hides rows; `describe` words a row; `value` given ⇒ the host owns the text.
- `LocationPickerModal` passes `excludeTypes={['country']}` (a country is never the search place), the coarse device
  origin, and builds the pick from the server place: label = the suggestion's own words (D-78), name = the city part
  (locality → postal_town → admin 3 → admin 2 → first words), `countryCode` = the server's.
- `components/AddressSearchInput` (was `GoogleAddressInput`) wraps it with the floating label; `toPlaceResult` fills
  street/apt/city/state/zip/country from the parts (a named place or a house number the parts lack keeps the suggestion's
  words). Used by `QuickBookScreen` and `settings/AddEditAddressScreen`.
- `hooks/useStaticMapUrl.ts` — `AboutTab` (`Place`, 600×300@2; space held while asked; no signed image or a failed load ⇒
  no map) and `AIMatchMapLoader` (`Area` at the shared 3-decimal cell, 640×300@2; no usable point, no signed map or a failed
  load ⇒ the drawn map; nothing while asking).

### Q-1 (2026-09-25) — the server prices the cart
- Save body (`cartSyncService.mapCartToApi`): items are `{ serviceId, quantity, locationType, isAtStore, isAtCustomersLocation
  (both booleans, never null), note, appliedOfferId?, serviceImageUrl?, categoryName?, subcategoryName? }`; the group sends
  `appliedOffers: [{ offerId }]` only. Never a name, price, type, category id or amount.
- `mapApiToCart` takes the server's `basePrice`, `priceType`, `pricing` (the service's CURRENT catalogue price; null once
  it is gone), `discountAmount`, and the applied offer from `appliedOfferId` + the group's `appliedOffers`.
  `serverCartFrom(res)` = the cart / `[]` / `null` on a refusal.
- `cartSlice.adoptServerCart`: save (`syncCart`), remove and change adopt the server's answer — a dropped line disappears —
  UNLESS the cart changed while the answer was on its way (reference check), in which case that change's own sync answers.
  Choosing or clearing an offer drops the server's old `discountAmount` and persists, so the server prices it.
- `cartItemDiscount` prefers the server's `discountAmount`; only a guest line (never sent) is estimated from the offer.
- A cart line is headlined by `formatCartLineHeadline` — `formatServicePrice(item.pricing)` exactly as a card ("Up to",
  "From", "/ hour", minimums), the stored figure only when `pricing` is null. Guest lines carry `pricing` from the add site.
- Recently viewed: `pricingFromRecentlyViewed` carries `maxPrice` for a range, so a ceiling-only service reads "Up to $150".
- Tests: `placeSuggestionService`, `placeSearchInput`, `addressSearchInput`, `aboutTabLocationMap`, `aiMatchMapLoader`,
  `noDeviceGeocoding`, `locationPickerModal`, `createBroadcastQuoteCountry`, `cartServerPricing`, `cartOffers`,
  `cartScreenPricePreview`, `servicePrice`, `recentlyViewedProviderPrice`.
- **Google attribution (Places policy):** the suggestion list ends with a muted `PLACES_ATTRIBUTION` ("Google Maps", a brand Google requires untranslated, so a constant and not a locale key) with its own accessible label; it renders only while suggestion rows show. The name deliberately avoids `GOOGLE_MAPS`, which the `noDeviceGeocoding` guard forbids.
- **Static maps are never cropped:** Google draws its logo inside the image, so `staticMapSizeFor(boxWidth, boxHeight)` asks for the image at the box's own shape (sides kept within 64 to 640) and `cover` crops nothing. `AboutTab` measures its box with `onLayout` and asks nothing until it has; `AIMatchMapLoader` sizes from `mapWidth` x `MAP_HEIGHT`.

## Sessions (rewritten 2026-09-29, auth-session audit) — server rules in `clinqet-auth-sessions`

- **One keychain record**, serial keychain queue (a load never finishes after a clear it raced), single-flight clear.
  Written through a staging slot `com.clinqet.customer.session.next` with a `gen` from an install-local counter
  (`clinket_session_generation`, AsyncStorage, kept across sign-out, written before any record carries it; never the
  device clock; a floor that cannot be read refuses the write); the newer slot wins; iOS writes are delete + add. ‼️ The shared keychain rule: iOS `-26275` and Android `E_CRYPTO_FAILED` without "Could not
  access Keystore" reset the record; everything else is unavailable and never signs out. `data_extraction_rules.xml`
  keeps keychain prefs out of backups and device transfer.
  First launch without `clinket_install_marker` (and no earlier-run trace such as the old `keepMeSignedIn`) retires any
  keychain session and queues its server logout. A `rememberMe=false` session is ended at cold start.
- **Refresh** (`sessionService`): the request secret is saved in the record BEFORE sending; a 401 ends the session only
  if the refused refresh token is still the stored one ("stale" otherwise); any other 4xx keeps the session and drops
  the spent secret; the local expiry is only a hint — the server decides. ‼️ The stored access token is ALWAYS sent
  (2026-09-30): a token that already looks due when it arrives means a fast device clock, so it is stored with no
  expiry hint and renewed only on the server's 401 (`accessTokenDue()` drives early renewal). Server times without a
  zone are read as UTC.
- **Replay safety** (`apiManager`): each request records epoch + sub/SessionId/BusinessId; a 401 is replayed only while
  they are unchanged; `session_ended`/`recent_sign_in_required` act only on the session they were about;
  `adoptAccessToken(token, epoch)` replaces `setToken`. `recent_sign_in_required` keeps the session and opens the
  existing sign-in screen ON TOP (`services/reauthentication.ts`); the same person returns to the form intact and the
  replaced session is ended on the server; `recent_sign_in_required` is handled the same on a first answer and on a
  replay after a refresh. A security change runs inside `whileSecurityChange`: a `session_ended` for the same session
  waits until the change settles, at most `SECURITY_CHANGE_HOLD_MS` (10 s), then the session ends with the server's
  sentence (new pair adopted → dropped; 401 "change saved" → that sentence and sign-out); the change's own request carries `securityChange: true` and is never held. `adoptReissuedSession` returns
  false when the device cannot keep the new pair, which is then ended on the server.
- ‼️ **Region pinning** (`src/services/stampRouting.ts`): the shared `identity.`/`api.` hosts are geo-routed PER REQUEST
  by the caller's IP (deploy.ps1 `Sync-GeoRoutingToRoutes`), but a session lives in ONE stamp's SQL. While a session is
  stored every authenticated call (Identity, Main API, SignalR hub, receipt download) goes to `identity-<stamp>` /
  `api-<stamp>` of the issuing origin; a sign-in flow sends all its Identity steps to `identity-{activeRegion}`;
  sessions stored before this change keep the shared hosts until the next sign-in; foreign hosts are never rewritten.
- **Sign-out**: pending-logout record in the keychain first, local clear, one `POST logout {refreshToken}`; only a 200
  confirms; retried at launch, on app active and on network regain; `'unconfirmed'` (record write AND POST failed)
  shows `AUTH_PROMPT.SIGNED_OUT_UNCONFIRMED` instead of promising a retry. The screen navigates at once
  (`signOut()` returns `{ serverAnswer }`); only the notice waits. A sign-out, or a new sign-in, over a record that
  cannot be read marks it with the generation floor (`clinket_retire_session`, kept across sign-out); records at or
  below the mark are retired (logout queued, then deleted) as soon as they can be read. A record written after the mark
  is kept, and a launch that cannot read it answers unavailable, not signed out. A write whose first read could not
  settle the mark keeps it, and a marked copy the new record failed to replace is queued for logout before the slots
  are reconciled; an unparsable mark retires whatever it finds and is lowered to just below the next write. Known
  limit: a record still unreadable when a new sign-in's write fully overwrites it cannot be ended on the server; it
  lapses at its own expiry. A sign-in over a live session writes the replaced session's pending logout BEFORE clearing
  anything (C7); the POST is never awaited. Sign-out never awaits `stopSignalRConnection()` — SignalRProvider closes
  the hub on the 'logout' event. Unconfirmed sign-outs retry on reconnect by `isConnected` alone (never NetInfo
  reachability). NetInfo is configured once in `index.js` (`src/config/reachability.ts`, 2026-09-30): iOS reachability
  is a HEAD to our shared API `/ping` (200 = reachable; 5 min while reachable, 30 s while not, only while active,
  re-checked on every return to the foreground) — never a Google endpoint.
- **SignalR:** the hub gets the stored token as-is; early renewal only when `accessTokenDue()`, once per stored token; a
  hub refusal gets ONE refresh per refused token and none for the token that refresh produced; restarts only while started.
- **Push**: the courtesy unregister leaves before the local clear with the ending session's own bearer (3 s timeout,
  never awaited); push starts only when authenticated and the permission prompt is done.
- **Password reset grant** lives in memory only (`passwordResetGrant.ts`); `passkey_local` holds only `{credentialId}`.
- Tests: `sessionKeychain`, `signOut`, `tokenRefresh`, `sessionRegionPinning`, `appBootstrapSession`, `storeAccountReset`,
  `securityChangeRace`, `reauthentication`, `androidDataExtraction`, `authInterceptor` (clock skew),
  `passkeyDeviceRecord`, `registrationPhoneCode`, `passwordResetGrant`, `profileSignOut`, `signalRToken`.

## Post-ranking follow-ups (audit 2026-10-01) — Book again after a no-show (W15), "Serves …" cards (W8)

- **W15** (sheet `bookings-list-book-again-no-show`): `src/screen/bookings/BookingListScreen.tsx` `BookingCard` shows
  `BOOKINGS.BOOK_AGAIN` when `canBookAgainFromList(status)` (`src/utils/bookingStatus.ts`: `{Completed, NoShowProvider}`,
  non-strings false) → the same `onBookAgain` action. Test `__tests__/bookingListBookAgain.test.tsx`. Web parity:
  `bookingsInfoBox.jsx` (`clinqet-user-app`).
- **W8 "Serves {area} · Based in {city}"** (sheet `customer-cards-serves-area`; server rule in `clinqet-search-discovery`):
  `src/utils/servedArea.ts` `servedAreaLines(t, servedArea, basedInCity, radiusUnit)`; mappers carry `servedArea` +
  `basedInCity` into `homeTab/homeScreen/index.tsx` (RichCard), `homeTab/searchScreenDetails/index.tsx` (ResultCard) and
  `discovery/DiscoveryScreen.tsx` (ItemCard). Keys `SERVICE_PRICE.SERVES_AREA` / `SERVES_AREA_AT` / `BASED_IN` in all five
  `src/Locales/*.json`. Without a served area the card is unchanged.

## 2026-10-03: social sign-in, consent, register row

- Social sign-in: Android dismiss keeps the attempt; every failure is said (`SOCIAL_LOGIN.*`); a guest record holding only the exchange secret is not a session to clear. See `clinqet-auth-sessions`.
- Consent: `services/cookieChoiceRecord.ts` + the `PolicyReconsentModal` listener (the dead `FORCE_SHOW_FOR_DEBUG` block is gone); `PolicyConsentChecker` re-runs on `onAuthChanged('login')`.
- Register: `ThirdPartyLogin` (prop `current`) shows email, code, passkey and the providers under `REGISTER.OR_CONTINUE_WITH`; `LoginScreen` honours `route.params.method` (`'email'` opens the password form, `'otp'` the code form).

- Audit follow-ups 2026-10-03: `AUTH_OPTIONS.*` label every `ThirdPartyLogin` button (incl. the providers); the options sit on ONE line via `SignInOptionsRow` (`clinqet-ui-common` "One line, every width", 2026-10-04); `LoginScreen` takes `route.params.method` in its initial state; one alert per failed callback; the launch social callback is consumed once; the consent modal clears on sign-out; `SOCIAL_LOGIN.EMAIL_NOT_VERIFIED` no longer opens with the lower-case fallback.

## Consent: one question at a time (2026-10-03)

See `clinqet-ui-common` "Consent model — one question at a time". It covers: nothing on sign-in surfaces; a small bottom cookie card (per device); one signed-in agreements dialog that carries the cookie question when this device has not answered it; Terms + Privacy only on Register and on the server. Customer mobile: `appNavigation/consentPlacement` (fed from `trackCurrentScreen` and `BottomTabBar` onLayout + `FAB_LIFT`), `services/consentQuestion`, `ProductTour` gated on it, and `cookieChoiceRecord.restrictDataProcessing` for Do Not Sell.
