---
name: clinqet-spotlight
description: |
  **CORE FEATURE SKILL** — Work on the Spotlight / product-tour ("What's New") feature. Backend
  infrastructure for dismissal tracking lives in SQL (Identity API); tour step content
  (title/body localization keys, icon, target element, act) is defined in code, NOT Cosmos.
  Four live frontends: partner web + user web (driver.js), partner mobile + user mobile
  (custom react-native-svg overlays), all sharing ONE brand-locked design system (2026-07-23).
  USE FOR: adding tour steps/acts, dismissal endpoints, audience targeting
  (AppType × Surface × SpotlightType), popup UI styling, icon chips, localization keys.
  Applies to clinqetcore/Entities/SQL/UserSpotlightDismissal.cs,
  clinqetshared/DTOs/Identity/UserMetadataDto.cs, clinqetinfrastructure/Services/Auth/UserMetadataService.cs,
  clinqetidentity Controllers/UserMetadataController.cs, clinqetwebpartnerapp src/lib/productTour/** +
  src/hooks/useProductTour.js, clinqetwebuserapp lib/productTour/** + hooks/useProductTour.js,
  clinqetmobilepartnerapp src/components/ProductTour/** + src/lib/productTour/**,
  clinqetmobileuserapp src/components/{ProductTour,SpotlightOverlay}.tsx + src/lib/spotlight*.ts.
---

# CLINQET SPOTLIGHT / PRODUCT TOUR — COMPREHENSIVE SKILL

> Tour content (step keys, icons, targets) is defined in **code**, not Cosmos. Only the per-user
> dismissal state is persisted (SQL via Identity API). Publishing a tour change is a code deploy.
>
> **2026-07-23 redesign (user-mandated):** ONE unified, brand-locked visual system across all four
> surfaces; **NO emoji anywhere** — every step carries a brand **icon chip** instead (memory:
> `feedback-no-ai-looking-icons`). Emoji in headings reads as AI-generated and is a zero-tolerance
> regression.

## THE UNIFIED DESIGN SYSTEM (all four surfaces MUST match)

| Element | Spec |
|---|---|
| Icon chip | 40×40 web / 38×38 mobile, radius 12, navy bg (web: gradient `#032858→#0a4a8a` — the app's own AI-button gradient; mobile light: `theme.brandBlue`, mobile dark: lifted navy `#16457e`), containing a 20px lime (`#97EF29`) icon from the app's icon language (AI sparkle, mic, share, leads target, person, magnifier, chat-with-lines). Soft navy shadow. Sits ABOVE the title. |
| Highlight ring | 2.5–3px `#97EF29` + soft lime glow, radius 14, ~2px offset — ALL surfaces (added to user mobile 2026-07-23; it previously had a bare cutout). |
| Overlay dim | `rgba(3,40,88,0.72)` (navy-tinted) — ALL surfaces. Web: driver.js `overlayColor:"#032858"`, `overlayOpacity:0.72`. |
| Card | White (mobile dark: `theme.surfaceElevated`), radius 16, Lufga (web), shadow `0 20px 48px rgba(3,40,88,0.22)`, max-width 360 (web) / screen−32. |
| Title / body | Title navy `#032858` 16/600 (mobile 700, theme.textPrimary); body gray `#5F5F5F` 13–13.5px, line-height ≈1.55. |
| Primary CTA (Next/Got it) | Navy pill (web gradient / mobile light `theme.brandBlue`, mobile dark lifted navy `#16457e`), white text, radius 999, weight 500; lime glow on web hover. |
| Back | White/transparent pill, hairline border `#E7E7E7` (dark: `rgba(255,255,255,0.22)`), gray text. |
| Skip | Underlined muted `#919191` link ("Skip tour" web / "Skip" mobile top-right). |
| Progress | "Step X of Y" muted text; mobile adds dots — active = lime 16×6 pill, inactive muted. |
| Copy | Localization keys ONLY, in every supported language file. NO emoji. Icons referenced by NAME in copy ("tap the sparkle icon"). |

Off-brand grays (`#4A5568`, `#E2E8F0`, `#CBD5E0`, `#F3F4F6`, `#111827`, `#D1D5DB`) were purged
2026-07-23 — never reintroduce library-default grays; use `#5F5F5F` / `#919191` / `#E7E7E7` (web)
or theme tokens (mobile).

## DATA MODEL — SQL (Identity API)

### `UserSpotlightDismissal` (`clinqetcore\Entities\SQL\UserSpotlightDismissal.cs`)

| Column | Type | Notes |
|--------|------|-------|
| `Id` | Guid | PK |
| `UserId` | Guid | FK → UserProfile.Id |
| `AppType` | enum string | `Partner` / `Admin` / `Clinket` (customer app) |
| `Surface` | enum string | `Web` / `Mobile` |
| `SpotlightType` | enum string | `Onboarding` / `Dashboard` |
| `DismissedAt` | DateTime | |
| `CreatedAt`, `UpdatedAt` | DateTime | audit |

Composite index on `(UserId, AppType, Surface, SpotlightType)`. Migration:
`clinqetinfrastructure\Migrations\20260505073828_AddUserSpotlightDismissals.cs`.

The triple `(AppType, Surface, SpotlightType)` is the **identity** of a spotlight. Dismissing on
one surface does NOT dismiss on another — partner mobile's `isSpotlightDismissed` was aligned to
the full triple 2026-07-23 (it previously matched SpotlightType only, so a web dismissal wrongly
suppressed the mobile tour).

## ENUMS / DTOs / SERVICE / CONTROLLER (unchanged)

- Enums: `AppType` (Partner/Admin/Clinket), `SpotlightSurface` (Web/Mobile), `SpotlightType`
  (Onboarding/Dashboard) — all `[JsonConverter(typeof(JsonStringEnumConverter))]`.
- DTOs (`clinqetshared\DTOs\Identity\UserMetadataDto.cs`): `UserMetadataDto` (incl.
  `SpotlightDismissals: List<SpotlightDismissalDto>`), `SpotlightDismissalDto`,
  `DismissSpotlightDto` (all three triple fields required).
- `UserMetadataService` (`clinqetinfrastructure\Services\Auth\`): `GetUserMetadataAsync`,
  `DismissSpotlightAsync` (idempotent; concurrent-dismissal unique-conflict treated as success).
  Its `DbUpdateException` branch distinguishes THREE cases (2026-07-24): concurrent create ⇒ re-read and succeed;
  no `UserProfile` row on this stamp ⇒ `UnknownUserException` ⇒ **401**; anything else ⇒ rethrow ⇒ 500. Both
  `UserMetadata` and `UserSpotlightDismissal` FK to `UserProfile`, and JWTs are NOT stamp-bound, so a token minted
  on another regional stamp used to surface as a raw `FK_UserMetadata_UserProfile_UserId` 500. See
  [[clinqet-identity-api]] § Unknown-user 401 contract. Clients must treat 401 here as "clear session, re-login".
- `UserMetadataController` (Identity API, `[Authorize]`): GET `/api/v1/UserMetadata`,
  PUT `/api/v1/UserMetadata`, POST `/api/v1/UserMetadata/spotlight/dismiss` (returns refreshed DTO).

## FRONTEND IMPLEMENTATIONS (all four live)

### Partner web (`clinqetwebpartnerapp`) — driver.js ^1.4.0
- `src\hooks\useProductTour.js` — consent-gated auto-start (waits for cookie banner + policy
  re-consent), analytics `tour_start`/`tour_complete`/`tour_skip` via `trackEngagement`.
- `src\lib\productTour\driverConfig.js` — ALL styling as injected CSS (`<style id="clinqet-product-tour-styles">`);
  `TOUR_TARGET_IDS`; `TOUR_ICONS` + `popoverClassForIcon(icon)` → per-step
  `popoverClass: "clinqet-tour-popover clinqet-tour-chip-<icon>"`; the chip renders as a
  `::before` on `.driver-popover-title` with a two-layer background (lime SVG data-URI over the
  navy gradient) — no DOM injection, no driver.js internals. Skip/Close buttons injected in
  `onPopoverRender`. `allowClose:false`, `disableActiveInteraction:true`, stagePadding 8, stageRadius 14.
- `src\lib\productTour\tourSteps.js` — acts `onboarding.step1` (QuickSetup→sparkle,
  TextareaAI→mic) + `dashboard` (ShareProfile→link on the Personalize Link card,
  HeaderShare→share, Leads→leads). Targets pushed via **visibility-aware** `pushIfVisible`
  (element + every ancestor must have a layout box — hidden targets are skipped, never floated).
- `src\lib\productTour\spotlightCache.js` — `Partner`/`Web`; act→SpotlightType map; login-hydrated
  metadata cache; optimistic local dismissal on POST failure.
- Mount: `src\app\dashboard\page.jsx` (act dashboard) + `src\app\onboarding\page.jsx` (tab 1);
  `src\components\common\ProductTour.jsx` wrapper (700ms delay).
- Localization: `public\lang\{en-US,hi-IN,gu-IN,ja-JP}.json` — `Tour.Button.*`, `Tour.Progress`
  (driver.js `{{current}}/{{total}}` tokens), `Tour.Step1.*`, `Tour.Dashboard.*`. ja-JP block added
  2026-07-23 (NOTE: ja-JP is a ~190-line stub overall — a platform-wide pre-existing gap beyond the tour).

### User web (`clinqetwebuserapp`) — driver.js ^1.4.0
- `hooks\useProductTour.js`, `lib\productTour\{driverConfig,tourSteps,spotlightCache}.js`,
  `components\common\ProductTour.jsx`. CSS classes `clinket-tour-*`, same chip system
  (icons: search, quotes). Act `home` (search box + `[data-tour-quotes-button]` via
  first-VISIBLE-match so desktop/mobile header variants both work).
- `spotlightCache.js` is the richest: guest-mode dismissals in localStorage
  (`clinket_guest_spotlight_dismissals`) + replay-on-login "device check-in", `clinket-auth` event
  subscription. `AppType="Clinket"`.
- All four lang files complete for `Tour.Home.*`. No analytics events (known parity gap vs partner).

### Partner mobile (`clinqetmobilepartnerapp`) — custom overlay
- `src\components\ProductTour\{TourContext,ProductTourOverlay,useTourTarget}` +
  `src\lib\productTour\{tourConstants,tourSteps,tourStorage,spotlightCache}` +
  `src\hooks\useProductTour.ts`. SVG mask cutout + lime ring + navy dim
  (`hexToRgba(lightTheme.brandBlue, 0.72)`); chip via `StepIcon` (react-native-svg, cases
  sparkle/mic/share/person); steps carry `icon: TourStepIcon`. Dual dismissal: AsyncStorage flag +
  server triple. Analytics tour_start/complete/skip. Locales `src\Locales\{en,es,hi,gu,ja}.json`
  all carry the 13 `TOUR.*` keys (es is dormant — not registered in i18n.ts).

### User mobile (`clinqetmobileuserapp`) — custom overlay
- `src\components\ProductTour.tsx` (step defs — `titleKey`/`bodyKey`/`icon`, resolved via
  `useTranslation()`; NEVER inline English — the 2026-07-23 change removed exactly that violation)
  + `src\components\SpotlightOverlay.tsx` (mask + lime ring + glow, `BACKDROP_DIM`, chip with
  search/chat icons, navy CTA, lime dots) + `src\lib\{spotlightTargets,spotlightCache}.ts`.
  Guest AsyncStorage dismissals + login replay (mirrors user web). Locales
  `src\Locales\{en-US,hi-IN,gu-IN,ja-JP}.json`: `TOUR.SKIP/BACK/NEXT/DONE/STEP_OF` +
  `TOUR.HOME_SEARCH_TITLE/BODY` + `TOUR.HOME_QUOTES_TITLE/BODY`. Backdrop-tap = skip = dismiss.

### Admin web — NOT implemented (no tour; `AppType.Admin` has no frontend consumer).

## MOCKUPS
`clinqetwebpartnerapp\mockups\spotlight-redesign\{index,web,mobile}.html` — the approved design
spec: responsive web mockup (desktop/iPad/phone), phone-frame mobile mockups (light+dark), token
table. Keep in sync if the system evolves.

## ADDING A NEW TOUR STEP (checklist)
1. Add the target id/data-attr to the page element (content-sized inner element, never a
   grid-stretched card).
2. Add the step in the surface's step file with a brand icon key (add the icon to the icon map if
   new — lime-on-navy, from the app's icon language; NEVER emoji, never an off-brand glyph).
3. Add title/body localization keys to EVERY language file of that app.
4. Reuse the act→SpotlightType mapping; bump/introduce a SpotlightType only for a genuinely new
   category (dismissals are per-triple — a new type re-shows for everyone).
5. Web: verify the step at mobile widths (visibility-aware push skips hidden targets — make sure
   that's the intent). Mobile: register the ref via the target registry.
6. ESLint zero errors (web), tsc 0 errors + jest green (mobile).

## NOTIFICATION INTEGRATION (unchanged)
Pull-based only (loaded on app open). NO `SpotlightShown` notification type. Email/push nudges for
a feature go through `MarketingPromotions` preferences via `ICommunicationDispatcher` — never bypass opt-in.

## TESTS
- Identity backend: `UserMetadataServiceTests`, `UserMetadataControllerTests`,
  `UserMetadataControllerIntegrationTests` (SQL fixture).
- Partner mobile: `__tests__\spotlightCache.test.ts` (triple matching + optimistic dismissal).
- Web apps: no tour unit tests (styling-only config; prod build + ESLint are the gate).

## CHECKLIST BEFORE MERGE
- [ ] Triple `(AppType, Surface, SpotlightType)` consistent everywhere; mobile matches the FULL triple.
- [ ] Localization keys exist in every language file of the touched app; NO emoji in any tour string.
- [ ] Icons come from the unified system (lime-on-navy chip); dim/ring/CTA match the design table above.
- [ ] Idempotent dismissal; frequency cap (session flag) intact.
- [ ] No new Cosmos container/repository — dismissals are SQL only.
- [ ] Web: ESLint zero errors + prod build; Mobile: tsc 0 errors + jest green.
- [ ] Pull-only; no `SpotlightShown` notification type.
