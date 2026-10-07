# UI verification — Admin provider setup, take-over, and "Price on request"

**Paste this whole file as the first message of a new Claude Desktop session (browser enabled).**

---

## 1. Status — read this first, do not re-implement anything

**The programme in `C:\Nik\Data\admin-provider-setup\PLAN.md` is FULLY IMPLEMENTED, committed,
pushed to `master` in every repo, and DEPLOYED.** The SQL migration `AddUserProfileClaimedAt` is
applied in **both regions (CA and IN)**, and the one-off data migration has already run.

Backend state, already verified — **do not re-run these**:

| Suite | Result |
|---|---|
| `Clinqet.API.UnitTests` | 16,280 passed, 0 failed |
| `Clinqet.API.IntegrationTests` (affected areas) | all green |
| `Clinqet.Identity.UnitTests` | 1,408 passed |
| `Clinqet.Mcp.IntegrationTests` (health tier) | 4 passed |
| Customer / provider / admin web builds | all succeed |
| `clinqetmobileuserapp` | tsc clean, 2,357 tests pass |
| `clinqetmobileadminapp` | tsc clean, 577 tests pass |

**Your job is ONLY the browser.** Do not change backend code, do not add features, do not redesign
anything. You are checking that what shipped looks right and is responsive.

---

## 2. What you are checking against

- `C:\Nik\CLAUDE.md` **§24.1** and **§24.2** — the binding UI standard.
- **Widths: 320, 375, 768, 1024, 1440.** Every page, every width.
- **House design system only.** Navy ink, brand green for the chosen action, amber for limits, blue
  for processing. Lufga. Existing radii, shadows, button shapes.
- **Icons come only from the set each app already uses** — customer web `react-icons`, provider web
  `lucide-react`, admin web `react-icons`. **Never an emoji, never an invented icon.**
- ‼️ **No technical words anywhere a provider or customer can read.** Not "payload", "endpoint",
  "token", "schema", "partition", "index", "cache". Say *page, text, document, source, answer, saved*.
- **Every state is designed**: loading, empty, error, offline, permission denied, limit reached.
- **No horizontal scroll at any width. Touch targets ≥ 44px. Type stays readable.**

---

## 3. Hosts

| App | Dev URL |
|---|---|
| Customer web | `https://www.dev.clinket.com` |
| Provider web | `https://business.dev.clinket.com` |
| Admin web | ask the owner — the dev host is not in the repo files |

If a page needs sign-in and you have no account, say so and ask. **Do not create accounts, do not
enter real credentials, and do not submit any form that sends email or SMS to a real address.**

---

## 4. Screens to check — these are the ones that actually changed

### 4a. Provider web (`business.dev.clinket.com`) — HIGHEST PRIORITY

**Two brand-new PUBLIC pages. Nobody has ever seen these in a browser.**

1. **`/claim`** — the page a prepared business lands on from the e-mail "take over your profile" link.
   - Open it **with no token at all**, and **with a nonsense token** (`/claim?token=abc`).
   - Expected states, each designed and in the house style: link not valid · link expired · the
     business is already claimed · the business is gone · offline / could not load · the normal
     "here is your business, take it over" state.
   - ‼️ A broken link must NOT look like a dead end when the network simply hiccupped — "we couldn't
     load this" and "your link is dead" must be visibly different pages.
   - Files: `src/app/claim/page.jsx`, `src/components/preparedProfile/ClaimProfile.jsx`,
     `PreparedProfileShell.jsx`, `PreparedProfileParts.jsx`.

2. **`/stop-emails`** — the "I don't want these e-mails" / "this isn't my business" page.
   - Same token variations as above, plus: the already-stopped state (it must show the done state,
     not re-offer the same choice) and the turn-back-on state.
   - Files: `src/app/stop-emails/page.jsx`, `src/components/preparedProfile/StopEmails.jsx`.

3. **Services — "No price yet" / "Price on request"** — the pill in the service form.
   - `onboarding/add-business-information/ManageServicesPrice/` → `AddServiceModal`, `ServiceCard`,
     `BulkUploadModal`.
   - Choose "No price yet": the price fields must hide cleanly, the form must SAVE, and reopening
     the service must show "No price yet" again — not a blank Fixed price.
   - The service card and the booking screens must read **"Price on request"**, never `$0`, never an
     empty price line. Check `src/components/booking/BookingCard.jsx`, `BookingsDetails.jsx`,
     `ServicesList.jsx`, `src/utils/bookingPrice.js`.

4. **Auth screens** — `registerForm`, `loginWithEmailForm`, `verifyForgotEmailForm`,
   `verifyForgotPhoneForm`, `verifyLoginPhoneForm`, `createNewPasswordForm`,
   `components/auth/PhoneOnlySignedIn.jsx`, `components/auth/PreparedProfileReady.jsx`.
   - The code screen must say **which way the code was sent** (e-mail vs text). A screen that tells
     someone to look for a text that was never sent is a defect.
   - **"Set password" vs "Change password"**: a provider who has never set one must see **Set
     password** in the profile menu AND on the page. Check `dashboard/profile`.

### 4b. Customer web (`www.dev.clinket.com`)

1. **"Price on request" everywhere a price is shown** — this is the big one.
   - Service detail, service list, business profile, trending services on the dashboard, the cart,
     the add-item sidebar, the service modal.
   - Files: `components/common/ServicePriceLine.jsx`, `ServicePriceDetails.jsx`,
     `AskForPriceButton.jsx`, `AskProviderForQuote.jsx`, `GetQuoteLink.jsx`,
     `components/customer/ServiceDetailModal.jsx`, `businessProfile.jsx`,
     `providerService/ProviderServiceContent.jsx`, `services/ServicePageContent.jsx`,
     `cart/serviceDetails.jsx`, `cart/AddItemSidebar.jsx`,
     `dashboardTrendingServices/dashboardTrendingServices.jsx`.
   - ‼️ **Nothing may render `$0`, `0.00`, "Free", or an empty gap.** A price-less service shows the
     words and offers the "ask for a price" action.
   - Such a service must **not** be addable to the cart as if it had a price — check the button state
     and what the cart shows.

2. **`components/customer/cart/CartRemovedNotice.jsx`** — the notice when an item left the cart.
   Check the empty and the one-item and the several-items wording at every width.

3. **Settings pages** — `/settings` and its children (change-password, delete-account,
   manage-addresses, mfa-setup, notifications, passkey-management). Each got a layout + document
   title. Confirm the **browser tab title** is right on each, the side nav highlights the current
   page, and nothing is blank. `components/layout/customer/accountSidebarNav.js`, `header.jsx`.

4. **Auth** — `registerForm`, `loginWithEmailForm`, `verifyForgotEmailForm`,
   `verifyLoginPhoneForm`, `components/auth/PreparedProfileReady.jsx`.

### 4c. Admin web

1. **Provider accounts page** — `src/pages/providers/ProviderAccountsPage.jsx`. The list, the
   filters, the empty state, and the two new dialogs:
   - `src/components/providers/CorrectContactDialog.jsx` — correcting a typed e-mail / phone.
   - `src/components/providers/FinishSetupDialog.jsx` — ending the setup session.
2. **The onboarding wizard** — `src/pages/providers/ProviderOnboardingPage.jsx`,
   `onboarding/StepBusinessDetails.jsx`, `onboarding/StepServices.jsx`.
   - Step 1 (business details) must save. Services step must allow a service with **no price**.
3. **Alerts page** — `src/pages/alerts/AlertsPage.jsx`. The four new alert types must render with a
   readable title and body, not a raw enum name:
   `PreparedProviderCustomerWaiting`, `PreparedProviderEmailsStopped`,
   `PreparedProviderWrongContact`, `ProviderSetupReadingNeedsReview`.
   - Admin screens are English-only by design — that is correct, not a finding.

### 4d. Localization — all five languages

`en-US`, `es-US`, `fr-CA`, `gu-IN`, `hi-IN` in both customer and provider web
(`public/lang/*.json`).
- Switch language and re-check the claim page, the stop-emails page, the price line, and the auth
  screens.
- ‼️ **No raw key may appear on screen** (anything that looks like `Prepared_Claim_Title`).
- ‼️ **Québec French takes NO space before `? ! ;`**.
- Long German-style wrapping is not a concern, but **Gujarati and Hindi must not clip or overflow**
  at 320 and 375.

---

## 5. Mobile apps — code review only, no simulator needed

Confirm the same rules hold by reading these (they mirror the web and already type-check and pass
their tests):

- `clinqetmobileuserapp`: `src/components/ServicePriceLine.tsx`, `PreparedProfileReady.tsx`,
  `src/utils/servicePrice.ts`, `src/utils/priceType.ts`, `src/components/cart/AddCartItemSheet.tsx`,
  `src/screen/provider/ServiceDetailScreen.tsx`, `src/screen/cart/CartScreen.tsx`.
- `clinqetmobilepartnerapp`: `src/components/PreparedProfileReady.tsx`, `PhoneOnlySignedIn.tsx`,
  `src/Util/priceType.ts`, `src/Screen/completeProfileFlow/AddService/components/PricingSection.tsx`,
  `ManageService/`.
- `clinqetmobileadminapp`: `src/components/providers/CorrectContactSheet.tsx`,
  `FinishSetupSheet.tsx`, `src/screens/admin/ProviderOnboardingScreen.tsx`.

Flag anything where the phone app would print `$0` or an empty price, or where it would say
"Change password" to someone who has never set one.

---

## 6. How to report

1. Work through section 4 in order. Take a screenshot at **320, 375, 768, 1024, 1440** for every
   screen you open.
2. For each finding give: **screen · width · what is wrong · which rule in §24.1/§24.2 it breaks**.
3. ‼️ **Fix every finding in the same session** (CLAUDE.md, owner-mandated), inside the existing
   theme, colours, font, icons and components. You have creative freedom to make a screen more
   modern and easier to follow — but **never add a page or a step nobody asked for**.
4. Run ESLint on any UI repo you touch — **zero errors** — and re-run that app's tests.
5. **Do not commit or push.** Report what you changed and let the owner decide.

---

## 7. Things that are correct — do not "fix" them

- Admin screens are **English only**.
- A business the Clinket team prepared is reached by **e-mail only** — no SMS, no WhatsApp. A
  **customer** gets every channel as normal; that is deliberate and already proven by tests.
- A price of **0 is refused** by the API. "Free" is not a supported state.
- A service whose price the AI **could not read** stays hidden and waits for the provider — it must
  NOT show "Price on request". Only a document that genuinely names no price publishes that way.
- The committed sandbox keys in `appsettings.json` are **accepted** by the owner. Do not report them.

---

## 8. One open decision — mention it, do not act on it

The one-off data migration released **53 services** (CA 10, IN 43) that had been hidden for having
no price. It released them **all**, because the reason a service was hidden is not stored anywhere.
Some may now be public as "Price on request" when the real reason was that the reading failed.

**If you see a live service whose price looks like it should have come from the provider's document,
note it — do not change the data.** The owner decides whether those 53 get re-checked.
