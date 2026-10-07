# Admin provider setup — prepared accounts, take-over, price-less services

> **THE AUTHORITY for this programme. Final version, 2026-10-05.** Every decision below was made by the owner in
> conversation and is quoted in §13. **NOTHING IS BUILT YET.** This file replaces every earlier draft; nothing outside it
> is a requirement. If anything here is unclear or looks wrong once you read the code: **STOP AND ASK THE OWNER. Never
> assume, never guess.**
>
> **Mockups — the ONLY ones to build from (§9):** `Data/mockups/provider-takeover-screens/index.html`,
> `Data/mockups/service-price-on-request-v2/index.html`, `Data/mockups/stop-emails-page/index.html` — each ONE
> self-contained HTML file (owner: "mockup should be just the html file"). The earlier sheets `prepared-provider-takeover`,
> `service-price-on-request` and `claim-profile-landing` were REJECTED by the owner ("horrible", invented icon, tiny
> state boxes, a page nobody asked for) and must not be used. **§13 records which of the new sheets the owner approved;
> build no UI whose sheet is not recorded there as approved** (§0.7.1, "approval covers only what was shown").
> All UI follows CLAUDE.md §24.1 + §24.2 (added 2026-10-05 for this programme).
> ‼️ **The mockups are a guide, not a pixel contract. YOU HAVE CREATIVE FREEDOM, without asking the owner again**
> (owner, 2026-10-05: "it will also have the creative freedom to look at that mockup and making sure is it modernistic,
> it is looking good, is it easy to understand, follow, responsive … utilizing the power of the mobile app … same theme,
> color, brand, kit, font … without my approval"). Refine freely inside the existing theme, colours, brand, font, icons and
> components; keep the agreed content, flow and meaning; never add a page or step nobody asked for.
> Small choices the stop-emails sheet left open — decide them yourself under that freedom: the footer of emails to a
> not-yet-taken-over business drops "Manage notification preferences" (they cannot sign in to it yet); the legal links
> may be made taller for touch; "Claim my free profile" on the stop page opens the claim page for the same business.

---

## 0. How this work must be done (owner's standing orders for this programme)

- **Best practice and industry standard only. No workaround, no shortcut, no assumption, no "TODO later".** Sandbox,
  not production: "this is our time, we do it right". **Quality over speed.**
- **If you are unsure or need information: ask the owner** instead of assuming.
- Every rule in `C:\Nik\CLAUDE.md` applies, especially: §0.1–0.6 (no hallucination, read the code, no cross-partition
  Cosmos query), §0.7 (the only schema change approved is §10's `ClaimedAt`; anything else → ask with the table),
  §0.7.1 (mockup gate; mobile mirrors web; no hardcoded text — every string a key in **all 5 languages**; every new
  local.settings key/queue/resource → ARM + deploy.ps1; `IMemoryCache` Size = 1; never edit an applied migration),
  §0.8 (unit + **real-engine integration tests**, mandatory here: schema, Service Bus, money-adjacent), §0.9 (skills ×4
  + memory), §0.10–0.14 (localization, cost, appsettings not constants, read everything first, terse comments),
  §0.15–0.18 (tests live in the repo/host that runs the code), §0.16 (clean tree), §0.19 (**never** `git checkout --`,
  `restore`, `reset`, `stash`, `clean` — other sessions work in these trees), §0.21 (linear history, no merge commits),
  §0.23, §24.1 (UI standard; browser check at 320/375/768/1024/1440).
- **The owner commits, pushes and deploys** unless he says otherwise. SQL migrations ARE applied by you to CA + IN via
  `cosmosindexsetup` (`dotnet run -- --all-regions --sql-only`) and proven with `dotnet ef migrations list`.
- **Golden rule: never make anything worse.** Priced services, the knowledge base and the AI receptionist must show
  **zero regression** — prove it before/after (owner: "heart of our AI receptionist … no regression is acceptable").
- Explain anything you ask the owner in the simplest words: problem → what breaks → fix → recommendation.

---

## 0A. Background — the problem, how we got here, and what was rejected (read this; it is the "why")

**The business problem (owner's words, summarised).** Clinket is about to go live as a marketplace. Waiting for every
provider to sign up would take forever and leave search empty. So the team will use bots (Grok, Meta, OpenAI) to scrape
each provider's public information into a JSON file, upload it through the admin Provider setup tool (AI Quick Setup
reads it), build the whole profile, and then **phone the provider**: "we set up your profile from public information".
The provider will either **register** (they think they never signed up) or **sign in with their phone** — the owner
wants both to just work, never confuse them, never block them, and handle every edge case. Many scraped services have
**no price**; today those never go live, which starves search and leads. The admin's 60-minute access must be safe.

**How the design evolved in conversation (2026-10-05) — so you do not rebuild a rejected idea:**
1. **Research first.** Four read-only research passes plus my own reading produced §2. Surprises: the change feed has
   NO price check (the AI-setup writer parks price-less services); the setup session is a full owner login for any
   business; admin-created accounts are marked "proven" with no code; registration with the team email/phone is refused.
2. **Task A was misread at first.** I proposed a forgot-password "Create your password" redesign and a setup-session
   audit. The owner corrected it: the ask is simply that the admin never sets a password, so the EXISTING Settings
   "Set password" page (which already switches on `hasPassword`) shows "Set password" — on provider AND customer apps.
   → **Rejected:** any forgot-password redesign. The forgot/resend bugs found stay as plain bug fixes (§8).
3. **Phone matches, email doesn't.** I first proposed two codes (phone + email) on one screen, then two codes one after
   the other, then "one code + confirm the email later". The owner disliked all three ("can we simplify by simply telling
   them to sign in with the phone"). Security check: telling someone a number already has an account reveals nothing new
   (registration already says "phone in use"); the code still goes to that phone. → **Decided:** team phone at
   registration → "Your business profile is ready — sign in with a code". Never say "your email doesn't match" (it would
   tell a stranger the account has another email). → **Rejected:** two-code flows for this case.
4. **Email matches.** → **Decided:** keep normal registration with one email code; the person's typed names/password
   apply (looks like any sign-up).
5. **Unproven team contact.** The owner asked for the concrete flow (Joe signs in by phone; the scraped info@ stays on
   the account; if it is an ex-employee's inbox, that person could sign in later). → **Decided:** remove it from sign-in
   at take-over; it stays on the public business page.
6. **Provider already has another Clinket account.** I proposed a full "hand over to an existing account" tool. →
   **Rejected** by the owner in favour of the simpler **"admin corrects email/phone"** on a prepared account.
7. **Admin help after take-over.** I recommended blocking it; the owner wants the team to be able to help → **kept**, but
   locked to setup screens and never able to touch sign-in details, money, customers, or team (§5).
8. **The "team updated your profile" notice (P1).** I proposed server-side tracking of real changes; the owner pointed
   out the cost and regression risk on the provider-token request path and could not follow the technical explanation.
   → **Rejected:** any per-save change tracking. **Decided:** a checkbox on Exit (ticked by default) + optional area
   ticks the admin chooses; specific message when areas are ticked, generic otherwise ("How about we do both?").
9. **Emails to prepared accounts (P2).** → email only, no SMS/WhatsApp/marketing; existing templates; a footer in the
   shared email shell; the owner wanted the footer to PROMOTE ("Claim your profile and grow your business with Clinket")
   and the stop link on its own line. He then asked for the stop/claim landing page to be a full, personalised,
   modern conversion page that makes signing in easy (§6A, sheet `claim-profile-landing`).
10. **Price storage.** The owner asked for best practice on null vs 0 and what the index should hold. → explicit
    `OnRequest` type, null amounts, 0 refused, no index schema change (§7 C2). Customer wording: the owner said "Get a
    quote" is a SEPARATE feature (broadcast quotes) — so the price line is **"Price on request"** with **"Ask for price"**.
11. **Knowledge base + AI receptionist** are the heart of the product: the owner demanded zero regression → the knowledge
    suggestion path is NOT changed at all; the receptionist changes only for no-price services.
12. **Where to build.** The owner asked whether to continue in this session or a new one; I recommended a new session
    reading only this file, because the old conversation contains rejected designs.
13. **Mockups redone.** The first sheets were hand-drawn approximations: an emoji phone icon instead of the app's real
    Call icon, states drawn as tiny boxes, and an extra "claim landing page" nobody asked for. The owner rejected them
    and added CLAUDE.md §24.2: modern, existing colours / font / icons / components ALWAYS, extremely responsive web,
    phone apps that use the device (long press, bottom sheets…), every state a full screen, mockups drawn FROM the real
    app, never an unrequested page. The sheets were rebuilt from the real components (§9).

**How to work with the owner (his explicit instructions):**
- **No assumptions. If unsure, ask** — "the cost of one clarifying question is always lower than the cost of an
  unintended change". He was angry when I answered a question he did not ask.
- **Answer the literal ask first.** Explain in the simplest words, with an example (he understood "Joe's Plumbing").
  No jargon. Problem → what breaks → fix → recommendation. Offer 2–3 options, recommendation first.
- **Show, then build**: anything visible gets a mockup he approves first.

---

## 1. The goal

1. The Clinket team builds provider profiles fast from bot-scraped JSON (Grok / Meta / OpenAI bots) through the admin
   **Provider setup** tool (admin web `clinqetwebadmin` + admin phone app `clinqetmobileadminapp`; the JSON goes through
   the existing AI Quick Setup, which accepts `.json`).
2. The team calls the provider; the provider **registers** or **signs in with a code** and lands in the ready business —
   never confusing, never stuck, secure.
3. Services with **no price** go live (search web + phone, private catalogue, leads) shown as **"Price on request"**.
4. The admin's 60-minute **setup session** has no loopholes.
5. The admin never sets a password; the provider sees **"Set password"** on the existing Settings page.

| Word | Meaning |
|---|---|
| **Prepared account** | Created by the team (`UserProfile.IsAdminProvisioned = 1`) and not yet taken over (`ClaimedAt IS NULL`) |
| **Take over** | The real owner proves the account's email or phone with a code (or Google/Apple with that verified email). From then on it is a normal account |
| **Setup session** | The admin's 60-minute session into a business (today's "onboarding token", `POST api/v1/admin/provider-accounts/{userId}/onboarding-token`) |

Example used below: the team builds **Joe's Plumbing** with **info@joesplumbing.com** and **905-555-1234**, no password.

---

## 2. Verified facts about today's code (read the code again before changing it)

**Admin setup**
- Create: `clinqetinfrastructure/Services/Auth/AdminProviderProvisioningService.cs:75-258`. Email and phone marked
  confirmed with no code (`:159-160`). Server still accepts an admin `Password` (`clinqetshared/DTOs/Identity/AdminProviderProvisioningDtos.cs:27-32`,
  hashed `:173-176` without the Identity validators; the DTO comment "random hash" is stale). Both admin forms already
  have no password box. Terms/Privacy stamped on the provider's behalf (`:564-587`). `ReceiveMarketingEmails` left at
  the entity default `true`. `IsAdminProvisioned` is written and never read.
- Setup session: `IssueOnboardingTokenAsync` `:260-427`; 60 min (`clinqetidentity/.../appsettings.json:621-622`);
  cannot be refreshed or extended (verified). Its problems (all to fix, §5): full primary-owner session for ANY business;
  counts as a fresh sign-in for 10 minutes (`AuthSessionService.cs:76-77` + `AuthController.cs:3572-3582`) → email /
  phone / password / two-step / passkey / `accept-policy` changes possible; copies ALL the target's roles incl. Admin
  (`AuthService.cs:3358, 3401-3405`); the actor claim is never read; writes attributed to the provider; admin phone app
  never revokes sessions (`clinqetmobileadminapp/src/screens/admin/ProviderOnboardingScreen.tsx:171-189,209-221,425-426,494`);
  staff accounts can enter the employer's business (`:333-334`); the user type is added BEFORE the password check
  (`AuthService.cs:1269-1272` vs `:1275`) so any account can be made "Business"; code sign-in to the admin app adds the
  Admin type unchecked (`AuthService.cs:2469+2483, 2593+2613`).
- Admin IP allow-list: off (owner: temporary, sandbox) and its path `/api/v1.0/admin` never matches `/api/v1/admin/...`.

**Provider arriving today**
- Register with the team email → `DuplicateEmail` (`AuthService.cs:392-398`); with the team phone → `DuplicatePhoneNumber`
  (`:413-420`). A registration-hold / claim mechanism exists for `IsSystemGenerated` profiles (`:570-644`, verify
  `:1054-1199`; skill `clinqet-auth-sessions` §6) — reuse it.
- Code sign-in works (`AuthService.cs:2447-2629`). **"Resend code" for phone sign-in is broken in all four apps** (they
  call the two-step resend, refused when two-step is off): provider web `src/components/auth/verifyLoginPhoneForm.jsx:64-66`,
  customer web `components/auth/verifyLoginPhoneForm.jsx:57-59`, provider phone `src/Screen/authenticationFlow/LoginOTPScreen/index.tsx:150-154`,
  customer phone `src/screen/AuthenticationFlow/LoginOTPScreen/loginOtpAPI.tsx:37-46`.
- Phone-only account + "Forgot password" → says sent, sends nothing (`AuthService.cs:1766-1774`).
- Google/Apple with the team email links silently; Facebook is refused (`AuthService.cs:2778-2808`).
- The existing Settings "Set password" page switches on `hasPassword === false` in all four apps (provider web
  `src/components/Profile/ChangePassword.jsx:48`; customer web `app/(customer)/settings/change-password/page.js:41-46`;
  provider phone `src/Screen/ProfileFlow/ChangePassword/index.tsx:75-107`; customer phone `src/screen/settings/ChangePasswordScreen.tsx:48-80`);
  menus always say "Change Password". `password/set` needs a sign-in within 10 minutes; each app has a re-sign-in path.

**Price-less services**
- **No price check in the change feed or indexer.** The AI-setup writer parks a service with no usable price as
  `PendingProviderCompletion` (`clinqetinfrastructure/Services/AI/ProviderSetupServiceWriter.cs:97-102`, `IsPricingUsable`
  `:332-349`); only `Approved` reaches the public index (`clinqetcore/Utilities/ServiceIndexGates.cs:10-20`). Sandbox:
  CA 10 + IN 43 parked; 5 India providers listed with zero services.
- Leads use no price (`BroadcastFilterBuilder.cs:63-111`); no lead email/WhatsApp/push prints a service price.
- Customers see "Get a quote" as the price line today (`clinqetwebuserapp/utils/servicePrice.js:43-47,262-263`;
  `clinqetmobileuserapp/src/utils/servicePrice.ts:68-74,168-174`). Booking is blocked client + server
  (`BookingController.cs:647,874,1076,1263,1688`; `CartService.cs:458-463`).
- `Pricing.PriceType` is a string; constants `"Fixed" | "Starting from" | "Hourly"` (`clinqetshared/Enums/CosmosEnum.cs:9-14`);
  `NormalizePriceType` turns empty/unknown into `"fixed"` (`clinqetshared/Extensions/StringFormattingExtensions.cs:35-47`).
  Four different "has a price" rules exist (`ServiceBookingPrice.HasSetPrice`, `ProviderScoreCalculator.HasPrice`,
  `IsPricingUsable`, `IsDraftPriceIncomplete`).
- Cosmos writes nulls (`clinqetcore/Cosmos/ClinqetCosmosSerializer.cs:46-49`). Every price-bearing index write is a full
  `Upload` (`AzureSearchIndexer.cs:771`, `ProviderSearchIndexer.cs:235`); price sort already puts null last
  (`AzureSearchQuery.cs:3309-3321`); the provider price sort drops price-less providers (`ProviderSearchService.cs:840-849`).
- Receptionist `request_booking` stamps $0 for a price-less listed service (`clinqetmcp/Clinqet.Mcp/Tools/BookingTools.cs`
  `BuildBookingServices`), `get_quote_estimate` throws (`:241-242`).
- Every manual service form demands a price (a price-less service cannot even be edited); admin forms write 0
  (`clinqetwebadmin/src/components/providers/onboarding/StepServices.jsx:166-174`); editing a "Starting from" service
  wipes its price (provider web `ManageServicesPrice/utils/formUtils.js:27,177-179`; `StepServices.jsx:74`; admin phone `StepServices.tsx:96`).
- Knowledge suggestions refuse a price-less draft (`KnowledgeDraftApprovalService.cs:371-372, 1573-1578`) — **stays as is**.
- Business switch `BusinessProfile.AllowOnlineBookings` exists (`clinqetcore/Entities/COSMOS/Cosmos.cs:152`, enforced by
  `BookingIntake.OnlineRefusalKey`); customers already see "Online booking not available — tap Call" + a Call button.

---

## 3. Task A — no password; "Set password" on the existing page

Owner: "they already have this functionality … the password change page … if password not set they will see the set
password … same for the customer web and app too."
1. Remove `Password` from `AdminCreateProviderRequestDto` and all hashing/handling of it; fix the stale comments.
2. Admin-created accounts start with `ReceiveMarketingEmails = false`.
3. The menu entry reads **"Set password"** when there is none, in all four apps (today always "Change Password").
4. Sandbox data: clear `PasswordHash` on prepared accounts that have an admin-set password (CA 1, IN 6 today).
5. **Prove end to end** on provider web, provider phone, customer web, customer phone that an admin-created passwordless
   account sees "Set password", can set one (including the 10-minute re-sign-in step), and then signs in with it.

---

## 4. Task B — the provider takes over

### 4.1 Two ways in (both need a code)
- **Sign in with a code** to the team phone (text or WhatsApp) or team email → in the ready business → set a password on
  the existing Settings page.
- **Register:**

| Joe types | Result |
|---|---|
| **Team email** + any phone | Normal-looking registration: **one email code** → in. His names, password, language and marketing choice apply. A different phone replaces the team's if no other account uses it; a phone another account uses → existing "already in use" error |
| **Team phone** + any email | Registration stops with **"Your business profile is ready on Clinket — our team set up a profile for this phone number. Sign in with a code sent to it to open it. [Send code to •••• 1234]"** → code sign-in, number filled in. Email + password set later in Settings. The screen never shows the account's email or any detail. Server answer: code `PreparedProfileSignIn` + masked number only |
| Email/phone of another (non-prepared) account | Today's clear error |
| Neither | Normal new account (cannot know it is Joe); the team prevents it by telling Joe which email/phone to use or correcting it (§4.4) |

### 4.2 One take-over step — every path ends here, one transaction
Paths: registration with the team email (verified), email / phone / WhatsApp code sign-in, password-reset completion,
phone-only forgot password, Google/Apple with the same verified email.
1. Set `ClaimedAt`.
2. Apply what was typed at registration.
3. **Remove from sign-in the team-entered email or phone the owner did not use or prove** (it stays on the public
   business page — `BusinessProfile.Email/PhoneNumber` are separate; he can add it back in Settings with a code).
   A phone-only result uses the phone as the user name.
4. **Consent becomes the person's own**: remove the Terms/Privacy rows the admin stamped; registration records his own;
   code sign-in shows the existing agreements dialog.
5. **Online booking ON** (`BusinessProfile.AllowOnlineBookings`, via the `IBusinessProfileRepository` already registered
   in Identity, `clinqetidentity/.../Program.cs:551`, partition = businessId).
6. Communication preferences back to normal defaults (undo a "stop emails", §6).
7. End every session (including an admin setup session in progress).
8. One dedicated admin alert **`ProviderAccountTakenOver`** (Low; Medium only when the team had entered a real name —
   not the "Guest User" placeholder, `SystemConstants.cs:14-15` — and both first and last names typed differ) + an
   activity row.
9. Nothing for the future "we set this up for you" popup (another developer's phase). They can read `ClaimedAt`.

### 4.3 Edge cases (all must work and be tested)
| # | Situation | Result |
|---|---|---|
| 1 | Register: team email, same phone, same names | One email code → in |
| 2 | Team email, different names | His names win |
| 3 | Team email, different free phone | His phone replaces the team's |
| 4 | Team email, phone used by another account | "This phone number is already in use" |
| 5 | Team email, names AND phone differ | Taken over; alert Medium (per 4.2.8) |
| 6 | Team phone, any email | "Your business profile is ready" → code sign-in |
| 7 | Code sign-in by phone | In; the unproven team email removed from sign-in |
| 8 | Code sign-in by email | In; the unproven team phone removed from sign-in |
| 9 | Resend code on phone sign-in | Works (fix §7) |
| 10 | Forgot password with the team email | Code → new password → taken over |
| 11 | Forgot password, phone-only account | Text code → signed straight in, told he can add an email for a password (owner: "Yes") |
| 12 | Password typed on a no-password account | Unchanged server answer + app line "No password yet? Sign in with a code" on every failure |
| 13 | Google/Apple with the team email | Taken over |
| 14 | Facebook with the team email | Refused as today |
| 15 | Google/Apple on a phone-only prepared account | New separate account; the team corrects the prepared contact (4.4) |
| 16 | Customer app registration with the team email | Taken over; account becomes provider + customer |
| 17 | Customer app registration with the team phone | Customer wording of the "already has an account — sign in with a code" stop → code sign-in → taken over |
| 18 | Admin mid-setup when Joe takes over | Admin session ends |
| 19 | Registers again after take-over | Normal "already registered — sign in" |
| 20 | Stranger with the public email/phone | Codes go to the real inbox/phone; nothing changes; existing limits + alerts |
| 21 | Team phone is a landline | Use the email or the team corrects the phone; admin form warns "Use a mobile number the owner can receive texts on" |
| 22 | Team phone is a staff member's mobile | Holder can take over; the take-over alert lets the team check |
| 23 | Number in another format | Last-10-digit match (works today) |
| 24 | Prepared account deactivated/suspended | Not claimable; registering with a deactivated email returns a clean message (today 500) |
| 25 | Wrong person took over | Medium alert → team contacts them |

### 4.4 Admin side
- Creation refuses an email on ANY account and a phone on ANY active account (typed OR proven — today only proven),
  showing that account's number.
- **"Correct email / phone"** (owner's choice, no hand-over tool): only on a prepared account before take-over; the new
  value must not be used by any other account; no code; audit row. Admin web + admin phone.
- Provider list shows **Waiting for provider** / **Taken over on <date>**.
- Prepared business: online booking forced **off** server-side and the switch shown locked ("Turns on when <name> signs in").

---

## 5. Setup session — every loophole closed

The session stays available for business accounts (owner: "admin can check and help provider … keep it"), made safe:

| # | Rule |
|---|---|
| S1 | **Setup screens only, on BOTH APIs, default deny.** Allowed = what the admin wizard calls today (business profile/address/social/timezone, categories, services, service areas, availability, offers, knowledge documents + FAQs, AI provider setup, tax + payment defaults, friendly-name check/save, `auth/businesses` read, `auth/logout`, and the §5 S6 notice call). Everything else → 403 `setup_session_not_allowed`. Mirror the existing `[AllowedWhenBillingOnly]` pattern (`clinqetapi/Clinqet.API/Authorization/RequiresPermissionAttribute.cs:89,219`); a convention test fails the build for any endpoint not classified |
| S2 | **Never a fresh sign-in**: mint with no recent-authentication credit |
| S3 | **Provider roles only**; refuse to mint for any account holding the Admin role or Admin user type |
| S4 | User type added only after a SUCCESSFUL sign-in (password and code paths); code sign-in to the admin app requires an existing admin |
| S5 | Writes attributed to **"Clinket team (admin name)"** via the existing `PlatformAdmin` actor (`ActorAttributionAccessor.cs:35-41`); one business-activity line per session when it starts: **"Clinket team helped with your business setup"** |
| S6 | **Exit / Done box** (only on an account the provider manages): "Tell <name> the Clinket team updated their profile" — **ticked by default**, plus optional area ticks (Business details · Categories & services · Prices · Opening hours · Service areas · Offers · AI knowledge). Ticked → ONE notice, in-app (web + phone, live via SignalR) **and** phone push: title **"Your profile was updated"**; areas ticked → body names them ("The Clinket team updated your services and offers"; more than three → "…your services, prices, offers and more"), tap opens that page (one area) or the dashboard; nothing ticked → "The Clinket team updated your business on Clinket", tap opens the dashboard. Unticked → nothing. Timed-out session → no notice. No server-side change tracking. New NotificationType in `SignalRSettings:EnabledNotificationTypes`; 5 languages |
| S7 | Admin phone app ends its sessions on the server on every exit path, like admin web |
| S8 | Mint enters only a business the person OWNS; none owned → refused (never an employer's business) |
| S9 | IP allow-list stays OFF; only its path is corrected to `/api/v1/admin` |
| S10 | Remove stale admin copy ("pass on their sign-in details", "20 hourly slots" — it is 40) |

Kept: 60 minutes, cannot be refreshed/extended, memory-only token, countdown banner, audit rows on both sides.

---

## 6. Messages to a prepared account (owner approved)
- **No SMS, no WhatsApp, no marketing** until take-over. Transactional emails (new lead, booking request, customer
  message) keep their **existing templates**.
- The shared email shell (`TemplateService.cs:190`) adds, only for prepared accounts, a footer in 5 languages:
  **"Claim your profile and grow your business with Clinket"** (link) and on its own line **"Don't want these emails?
  Stop them"**. Responsive, every link correct, every string localized (past bugs: unlocalized links/footers).
- **Both footer links open ONE page — the claim page (§6A).** The link is signed (account id + purpose + expiry, server
  secret — reuse the platform's existing signing / Data Protection mechanism; find it, don't invent). Stopping happens
  only when a person presses **Stop emails** in a small sheet on that page (never a one-click GET — mail scanners open
  links). Stop = every email off through the existing communication-preference table (no schema); the mandatory-email
  rule applies only after take-over; take-over restores defaults; "Turn emails back on" reverses it.
- One-click unsubscribe header (List-Unsubscribe / List-Unsubscribe-Post): add it **only after verifying** our email
  service supports custom headers; if not, report it.
- **One dedicated admin alert per waiting customer request** (lead, booking request, message thread) to a prepared
  account: business, what the customer is waiting for, business phone — also when emails were stopped. Deterministic
  event id per request, never one per email.
- **Legal check before launch** (CASL / CAN-SPAM / TCPA / Meta) — owner's to arrange; note it in the final report.

### 6A. The stop-emails page (owner, 2026-10-05) — sheet `Data/mockups/stop-emails-page` — **awaiting owner approval**
Owner: when they click to stop the emails, the page must have "a nice header footer" and "give an opportunity to explore
our site before … turning off all the email notification", and "make it easier for them to go to our sign-in page".
**Two pages, two purposes** (industry pattern; owner chose "Yes, both pages" after asking "is this best practice?"):
"Stop them" → the stop page below; "Claim your profile" → a **claim page** ("Is this your business?" + their real
profile preview + "N customers waiting" when N > 0 + ONE action "Send me a sign-in code" to the masked email the message
went to → code typed on the page → "Open my business" → signed in; secondary "See my public page"; a quiet link to the
stop page; full-size states: loading, sending, code sent, wrong code, too many codes, offline, already claimed, link
expired, business gone). It is NOT the normal sign-in page (a person who never made an account looks for a password
there). The earlier `claim-profile-landing` sheet is REJECTED (wrong design); both pages are drawn in `stop-emails-page`.
- Email footer (only for not-yet-taken-over businesses, inside the existing email shell): "**Claim your profile** and grow
  your business with Clinket" → the provider sign-in; "Don't want these emails? **Stop them**" → the stop page.
- The stop page (provider web, public, noindex): the real provider-web header + footer; the stop choice clearly visible
  and easy (legal: unsubscribing must never be hard) with two reasons — "I don't want these emails" / "This isn't my
  business" (the second also raises ONE admin alert: wrong contact) — and a "Stop emails" button (stopping only on the
  button: mail scanners open links); beside it a personal, true "Before you go" section: their business, their real
  public profile preview, "N customers are waiting" only when N > 0 (never a customer detail), "Claim my free profile"
  (sign-in code to the email the message came to, no password) and "See my public page".
- Full-size states: loading, stopped (still invites to claim), already stopped (+ turn back on), already claimed (→ Sign
  in), link expired/broken, business no longer on Clinket, could not load / offline. Laptop, iPad, phone.
- Server pieces (API contract, no schema): public read by signed link (only the values shown), send/verify sign-in code by
  signed link (same limits/alerts as other code sign-ins), stop / resume emails by signed link, the wrong-contact alert.

---

## 7. Task C — price-less services go live

| # | Change |
|---|---|
| C1 | A service with a category and no price is live everywhere — public index (web + phone), private catalogue (Ask Clinket + receptionist), leads. Admin, AI setup AND providers |
| C2 | **Storage (owner: "Yes, as recommended"):** an explicit price type **`PriceTypes.OnRequest`** + a fourth `NormalizePriceType` case; every amount **null, never 0**; an amount of 0 is **refused** by the API (a free service is not supported; it would be its own type later). No new Cosmos field, no index schema change; the `priceType` facet shows "On request" |
| C3 | One "has a price" rule: `ServiceBookingPrice.HasSetPrice`, used by the writer, the score, the forms |
| C4 | AI-setup writer: price-less + category → the normal approval path; only a missing category waits for the provider. The AI content-check prompt states a missing price is valid (both the appsettings prompt and the class default) |
| C5 | Forms (admin web/phone, provider web/phone): fourth choice **"No price yet"**; a price-less service can be edited and saved; bulk upload accepts an empty cost; provider nudge "Add a price so customers can book online" |
| C6 | Customers (web + phone): price line **"Price on request"** (never "Get a quote" — that is the separate Get Quotes/broadcast feature); buttons **"Ask for price"** (chat with that provider pre-filled "Hi, what's the price for <service>?") and the existing **Call** when a phone exists; not addable to cart / not bookable online |
| C7 | **Knowledge-base suggestions: NO CHANGE** (a suggestion still needs a price before approval); reading, suggesting, matching, banked AI results and rules versions untouched |
| C8 | **Receptionist: priced services zero change.** No-price service: asked the price → the owner gives the price + offer call-back/message; booked → like today's unlisted-item request, "price to be confirmed by the owner", never $0 in any email/PDF; `get_quote_estimate` answers "no listed price"; partner `create_booking` same guard. **Proof: every existing receptionist/MCP suite passes unchanged + new before/after tests + a real sandbox call** |
| C9 | Retire "needs a complete price before it can go live" / "won't appear in search results" (API ×5 languages, partner web/phone, admin) → the C5 nudge |
| C10 | Search: price filters exclude price-less; price sorts put them last — including the provider price sort (today drops them); ranking unchanged |
| C11 | Rough edges: no offer band / visit-fee / "total at checkout" on price-less cards; mini-cart guard; landing "everyone starts at…"/"real prices" skip price-less providers; "Book now" banner wording |
| C12 | Edge cases: in a customer's cart when it loses its price → removed at checkout with a clear message; existing bookings keep their price; minimum charge alone ("From $120") still counts as a price; a visit/travel fee alone or hourly with no rate = no price; adding a price back → bookable again; Ask Clinket + Insights show "No price set" |
| C13 | Bugs: "Starting from" wiped on edit (provider web + both admin apps); Insights `NormalizePriceType` case-sensitive (`SmartAnalyticsAggregationService.cs:833-856`) |
| C14 | Sandbox: move the 53 parked services to the normal approval path |

---

## 8. Every other finding — fixed in the same build (owner: "fix all the finding … fully end to end")
- Phone sign-in "Resend code" in all four apps (§2).
- Customer phone app registers people as **providers** and opts them into marketing (sends no `AppType`/platform/choice:
  `clinqetmobileuserapp/src/screen/AuthenticationFlow/RegisterScreen/registerAPI.tsx:12-33`).
- Provider phone app drops `SignupExperience` at registration (`src/services/authService.ts:216-257`).
- Deactivated account's email → 500 at registration → clean message.
- Reset wrong-code guard answers differently for real accounts → same answer for every address.
- Stale comments/skills: identity-api SKILL:806, 824-825; `AdminProviderProvisioningDtos.cs:27`; `Cosmos.cs:39`;
  `AdminTenancyLookupController.cs:15-16`; admin copy (§5 S10).
- Customer web hard-coded English (settings tab title, validation messages); provider web reset success message dropped;
  Gujarati "??" on "Forgot Password"; reset email-code screen redirecting to itself (provider + customer web); customer
  phone forgot step-1 errors swallowed; provider phone code screen says "Phone" for emailed codes.
- Anything else you find while building: fix it in the same build, or ask if it is big or ambiguous.

---

## 9. Mockups (redrawn from the real apps, 2026-10-05; approval status in §13)
- `provider-takeover-screens` — the screens (not one page) a provider and an admin see: register stop "Your business
  profile is ready", working resend, "No password yet? Sign in with a code", phone-only forgot sign-in, "Set password"
  menu (provider + customer, web + phone); admin web + phone: status, correct email/phone, setup banner, locked online
  booking, the Exit box with area ticks, and the resulting in-app notice + push.
- `service-price-on-request-v2` — customers (web at phone/iPad/laptop + customer phone app): "Price on request",
  "Ask for price", the real Call action, prepared business, cart removal; provider + admin web + phone: "No price yet".
  Supersedes `service-price-honesty` on one point only: the no-price price line.
- `stop-emails-page` — the email footer inside the real email shell + the stop page with "Before you go", every state.
- Rejected, do not use: `prepared-provider-takeover`, `service-price-on-request`, `claim-profile-landing`.

## 10. Schema, enums, config, data
| Item | Status |
|---|---|
| SQL `UserProfile.ClaimedAt` `datetimeoffset NULL`, no index | **APPROVED** (owner: "new column is good"). Apply to CA + IN via cosmosindexsetup, prove with `dotnet ef migrations list` |
| Anything else that changes SQL/Cosmos/search schema | **NOT approved — ask first with the §0.7 table** |
| API contract additions: register answer `PreparedProfileSignIn` (+ masked phone); `setup_session_not_allowed`; admin correct-contact endpoint; P1 notice endpoint; stop-emails endpoints | this plan |
| New enum values: admin alerts `ProviderAccountTakenOver`, a dedicated "prepared account has a waiting customer" type; activities `ProviderAccountTakenOver`, `ProviderContactCorrected`; NotificationType for the P1 notice; `PriceTypes.OnRequest` | add to the three `AdminPushSettings:PushableTypes` lists + admin Alerts page parity list; **deploy Functions before Identity** |
| Sandbox data: clear admin-set passwords on prepared accounts; un-park the 53 services | owner delegated |

## 11. Tests (placement per CLAUDE §0.18)
- **Identity** unit + real-SQL integration: every row of §4.3; every take-over effect; consent; online booking ON;
  sessions ended incl. a live setup session; S2/S3/S4/S8; creation collisions; correct-contact rules; phone-only forgot;
  deactivated email; stop-email link (valid / expired / forged / other account).
- **Main API** integration: S1 allow-list (allowed endpoints work, every other one 403) + the classification convention
  test; online booking refused while prepared; attribution; P1 notice; price rules (0 refused, OnRequest).
- **Functions**: writer status; change feed indexes price-less services; alerts; prepared-account channel rule; email
  footer only for prepared accounts in 5 languages.
- **MCP**: receptionist before/after.
- **Apps (7)**: jest for every new state; ESLint zero errors; browser at 320/375/768/1024/1440; phone apps on simulators.
- Sabotage check: break each new guard once and confirm a test fails.

## 12. Build order
1. Shared + SQL (enums, `ClaimedAt` migration applied + proven, DTOs).
2. Identity (Task A server, take-over, register rules, collisions, correct-contact, phone-only forgot, S2–S4, S8, stop
   emails, findings).
3. Main API (S1, S5, S6, online booking rule, price rules, bulk).
4. Functions + MCP (writer, prompt, alerts, channel rule, email footer, receptionist, Insights bug).
5. Apps: provider web/phone, customer web/phone, admin web/phone.
6. Tests, browser + device checks, sandbox data, skills ×4 (auth-sessions, identity-api, admin-app, provider-teams,
   service-listing, search-discovery, quote-lead-broadcast, voice-assistant, notifications, partner-app, user-app,
   customer-mobile, provider-mobile, ui-common as touched), memory.
7. §14 audit → fix every finding → re-audit → report.

---

## 14. MULTIDIMENSIONAL AUDIT — MANDATORY BEFORE THE TASK IS COMPLETE

Owner, in his words (2026-10-05): *"once done, at the end, can we make sure we create the multidimensional audit as well?
… super important. And the goal of this audit to make sure our code is fully bug free. There is no issue with the code
that we have done. There is no loophole. It's extremely user friendly and most importantly our code need to work for
every and all the edge case scenario in every single situations and also it is the performance friendly cost friendly …
multi-threading memory safe like a no memory leak no CPU leak and thread safe … we didn't miss any of those things that
we should have been done. So that level of multi-dimensional audit before we mark this task as a complete, and also
fixing all the finding of this audit as well."*

1. **Independent audit (fresh eyes — separate reviewers per dimension), covering:**
   - Correctness: every edge case in §4.3, §7 C12, §6, and every owner scenario in §13.
   - Security & loopholes: take-over, setup session (S1–S10), account enumeration, consent, signed links (forgery,
     replay, expiry), injection, authorization on every new endpoint, cross-tenant isolation.
   - User experience: all seven apps, every state (loading, empty, error, offline, permission denied, limit reached),
     320/375/768/1024/1440 and real phone sizes; plain words; nothing confusing.
   - Localization: every new string in all 5 languages, apps and API and emails; no hardcoded text.
   - Performance & cost: Cosmos RU (point reads, no cross-partition query), SQL query plans, search writes, Service Bus
     message counts, AI calls; nothing added to every request.
   - Thread safety, memory and CPU: no leaks, correct disposal, cancellation honoured, no captive dependencies,
     `IMemoryCache` Size = 1.
   - Idempotency & resilience: Service Bus redelivery, change feed replay, retries, partial failures, concurrent take-over.
   - Data integrity: SQL constraints, unique indexes, ETags, transactions.
   - Observability: structured logs, each admin alert exactly once.
   - Tests: unit + real-engine integration per §11, sabotage-checked.
   - Config & infra hygiene: appsettings (class defaults match), ARM + deploy.ps1, no orphans, no stale DI.
   - **No regression**: priced services, knowledge base, AI receptionist — before/after proof.
   - Completeness: every line of this plan done; skills ×4 + memory updated; clean tree (§0.16).
2. **Every finding fixed in the same task**; re-audit the affected dimensions until nothing is left.
3. Only then report complete, with the evidence (test runs, browser/device checks, sandbox receptionist call, migration proof).

---

## 13. Decision log (owner, 2026-10-05, in conversation)
| # | Decision | Owner's words |
|---|---|---|
| D1 | `ClaimedAt` column | "new column is good" |
| D2 | Remove the unused team-entered contact from sign-in at take-over | "Remove from sign-in" |
| D3 | Admin can still help after take-over (with §5 rules) | "admin can check and help provider … keep it" |
| D4 | Admin corrects email/phone; no hand-over tool | "Admin corrects email/phone" |
| D5 | No-price wording delegated | "full creativity to decide" → "Price on request" / "Ask for price" / Call |
| D6 | Providers may choose "No price yet" | "Yes" |
| D7 | Prepared business: online booking off, on at take-over | "online booking turn off … once they sign in or register it will set to turn on" |
| D8 | Set password on customer web + phone too | "customer for sure … mobile and web both" |
| D9 | Sandbox data steps delegated | "I will leave that with you" |
| D10 | Fix every finding; IP allow-list stays off | "fix all the finding … admin ip restriction is temp switch off for sandbox" |
| D11 | Phone-only forgot password → text code → signed in | "Yes" |
| Q-A | Task A = the existing Set-password page | "they already have this functionality … same for the customer web and app too" |
| Q-phone | Team phone at registration → "profile is ready, sign in with a code" | "Yes, go" |
| Q-email | Team email at registration → normal registration, one email code | "Keep registering, one email code" |
| P1 | Exit-box checkbox, ticked by default, optional area ticks → specific or generic notice, in-app + push | "let's go with the checkbox" · "How about we do both?" |
| P2 | Prepared accounts: email only, footer + stop page, alert per waiting request | "Go with this" + wording "Claim your profile … grow your business with Clinket", stop on its own line |
| Price | OnRequest type, null amounts, 0 refused, no index schema change | "Yes, as recommended" |
| Plan | Approved | "both approved" |
| First mockups | Approved, then REJECTED after review | "the fucking mock-up is horrible … why the heck you have to invent this telephone icon" — redrawn from the real apps (§9) |
| First claim landing page | REJECTED (wrong design) | "Why do we even need the landing page?" |
| Claim page + stop page (two pages, two purposes) | **Decided** | owner: "Yes, both pages (Recommended)" after the best-practice explanation (§6A) |
| Mockups are single HTML files | **Decided** | "mocup fucking should be just the html file" — one self-contained file per sheet, no server, no shared folder |
| Design rules | CLAUDE.md §24.2 added (×4 files) | "modern … futuristic … existing design theme color icon font … extremely responsive … utilize the power of the mobile app like long press" |
| New sheets `provider-takeover-screens`, `service-price-on-request-v2`, `stop-emails-page` | **APPROVED** ("all three mocup is approved now"), guide with creative freedom | "whoever the session will implement this will review it and it will also have the creative freedom … without my approval … just finish it" |
| Audit | §14 mandatory, all findings fixed | quoted in §14 |

## 17. Stop page reasons + mockup approval (owner, 2026-10-05: "all three mocup is approved now")
- **All three sheets APPROVED**: `provider-takeover-screens`, `service-price-on-request-v2`, `stop-emails-page`.
- **Both stop reasons raise an admin alert** (owner: "make sure in both case when provider will click either way"):
  - "I don't want these emails" → emails stop; dedicated alert **`PreparedProviderEmailsStopped`** (Medium): business,
    reason, business phone — the team calls to offer help / claim.
  - "This isn't my business" → emails stop AND the business's contact is marked "reported wrong" (the take-over by that
    email is blocked until an admin corrects the contact with "Correct email / phone", §4.4); dedicated alert
    **`PreparedProviderWrongContact`** (High): business, the reported address, business phone — the team verifies and
    corrects the contact. The page shows only a thank-you (no claim offer).
  - One alert per click, deterministic event id per (account, reason, day) so a double click never doubles it. Both types
    join the three `AdminPushSettings:PushableTypes` lists and the admin Alerts page parity list. Stored with no schema:
    the stop + reason live in the existing communication-preference rows / activity row — confirm the exact store while
    building; if it needs any new field, ASK first (§0.7).

## 18. "This isn't my business" — final design (owner, 2026-10-05; supersedes the §17 "marked reported wrong" wording)
Owner: "Yes remove it but admin alert will contain the old email … I like this solution" · phone: "Keep the phone".
1. The signed link proves the click came from the inbox the email went to. On **Stop emails** with this reason:
   - **The reported email is REMOVED from the prepared account** in one transaction (no new field): no more emails to
     it, it can never sign in or take the account over. If the account had no phone, its user name becomes an internal
     placeholder until an admin adds a contact (admin creation already uses phone as user name when there is no email).
   - **The phone number is KEPT** (the reporter speaks only for the inbox; the phone may be the real owner's).
   - **High alert `PreparedProviderWrongContact`** containing: business name + id, the **removed email (old value)**,
     the business phone, time — so the admin knows exactly what was wrong.
   - Activity row on the account (old email, reason). Page: "Thank you — we've removed this email from <business> and
     won't email you again." (no claim invite).
2. The admin calls the business and adds the right contact with **Correct email / phone** (§4.4); the real owner then
   takes over normally.
3. Same link again → "Already done, thank you", no second alert (deterministic event id). Already-claimed account → this
   choice is not shown (page shows "already claimed → Sign in"). A mistaken click by the real owner's staff → the admin
   re-adds the email from the alert.
4. "I don't want these emails" stays as §17: emails off via the existing communication-preference rows, Medium alert
   `PreparedProviderEmailsStopped`, claim invite kept, "Turn emails back on" reverses, take-over restores defaults.
5. Nothing in this programme is pending an owner decision. The only item outside the build is the owner's legal check
   (CASL / CAN-SPAM / TCPA / Meta) before launch.

## 19. Admin alert contents — every new alert (so the admin can act without searching)
Every alert below carries in Title/Description (plain English, admin-internal) AND Metadata: business name, BusinessId,
UserId, UserNumber, the business phone, the account email/phone as they stand, the admin who created the account
(ProvisionedByAdminId), when, and a deep link to the admin provider page.
| Alert | Severity | Extra details it must carry |
|---|---|---|
| `ProviderAccountTakenOver` | Low (Medium per §4.2.8) | path used (register / email code / phone code / WhatsApp / reset / Google / Apple), names the team entered vs typed, contact removed from sign-in (old value) |
| `PreparedProviderEmailsStopped` | Medium | reason "I don't want these emails", when, the email it was sent to |
| `PreparedProviderWrongContact` | High | **the removed email (old value)**, the phone kept, when, "add the right contact with Correct email / phone" |
| Prepared account has a waiting customer (§6) | Medium | what the customer is waiting for (lead / booking request / message) + its id and time, whether emails are stopped |
All: deterministic EventId (never doubled), added to the three `AdminPushSettings:PushableTypes` lists and the Alerts page
parity list, deploy Functions before Identity.

## 20. Completeness statement (2026-10-05)
Every design, solution and decision from the design session is in this file (§0A history, §3–§7 behaviour, §13 decision
log, §17–§19 final additions). **No owner decision is pending.** Only outside the build: the owner's legal check.
