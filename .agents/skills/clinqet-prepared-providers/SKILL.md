---
name: clinqet-prepared-providers
description: |
  **CORE FEATURE SKILL** — Work on PREPARED PROVIDER ACCOUNTS: an account the Clinket team builds for a
  provider who is not on Clinket yet, and the one step where that account becomes the provider's own
  ("take-over"). Covers: the admin never sets a password; the 60-minute setup session and its
  default-DENY allow-list; registration and code sign-in against a prepared account; the signed
  claim / stop-emails link and its two public pages; the email channel rule and footer for an
  unclaimed business; and SERVICES WITH NO PRICE going live as "Price on request".
  USE FOR: anything touching UserProfile.ClaimedAt, IsAdminProvisioned, IProviderTakeoverService,
  IPreparedAccountDirectory, IPreparedProviderLinkProtector, IPreparedProviderService,
  SetupSessionFilter / [AllowedInSetupSession], PriceTypes.OnRequest, ServicePricingRules,
  BookingPriceDisplay, the /claim and /stop-emails pages, or the admin provider-setup screens.
  Authority document: C:\Nik\Data\admin-provider-setup\PLAN.md.
---

# Prepared provider accounts, take-over, and price-less services

> Built 2026-10-06. The plan at `C:\Nik\Data\admin-provider-setup\PLAN.md` is the authority for every
> decision here; this skill is the map of where those decisions live in code.

## 1. What a "prepared account" is

The Clinket team creates a working provider account for a business that has never heard of Clinket, fills in
its profile, services and hours, and the business appears in search. Nobody has signed into it.

| Fact | Where |
|---|---|
| The account is marked `IsAdminProvisioned = true` | `clinqetcore/Entities/SQL/UserProfile.cs` |
| `ClaimedAt` is NULL until its owner takes it over | same file — the ONE approved SQL column for this work |
| It has **no password at all** (`PasswordHash` null) | `AdminProviderProvisioningService.CreateProviderAsync` |
| `ReceiveMarketingEmails = false` — nobody asked them | same |
| Its email and phone are marked confirmed with **no code** | same — and this is exactly what take-over undoes |
| Online booking is forced **off** | `ForceOnlineBookingsOffAsync`, and the Main API refuses to turn it on |

‼️ **An admin never sets a provider's password.** `AdminCreateProviderRequestDto` carries no password field,
and `AdminProviderProvisioningServiceTests.CreateProviderRequest_CarriesNoPasswordFieldAtAll` keeps it that way.
The provider sets their own on the existing Settings page, which reads `hasPassword === false` and says
"Set password" in all four apps.

## 2. Take-over — the one step, every path

`clinqetinfrastructure/Services/Auth/ProviderTakeoverService.cs` is the ONLY place a prepared account becomes
a person's. Every way in ends here: registration with the team email, email / phone / WhatsApp code sign-in,
password-reset completion, phone-only forgot password, Google/Apple with the same verified email.

‼️ **The claim is the lock.** `ClaimAsync` is a conditional `ExecuteUpdateAsync` (`ClaimedAt == null`) inside an
explicit transaction, so two people proving two different contacts at the same moment cannot both run the
effects. The loser gets `ProviderTakeoverOutcome.AlreadyTakenOver`. `ProviderTakeoverIntegrationTests`
proves this against REAL SQL — EF InMemory has neither `ExecuteUpdateAsync` nor transactions and can prove
nothing about it.

What one take-over does, in order:
1. `ClaimedAt` set (the lock).
2. What was typed at registration applied.
3. ‼️ **The contact nobody proved is removed from sign-in** — `BusinessProfile.Email/PhoneNumber` are separate
   fields and the public page keeps them. A phone-only result uses the phone as the user name.
4. `EmailConfirmed`/`PhoneNumberConfirmed` become **only what was proven**; two-step by phone is turned off if
   the phone went.
5. Other external logins removed (except `KeepLoginProvider`), passkeys deactivated.
6. The admin-stamped Terms/Privacy rows forgotten — EXCEPT on `ProviderTakeoverPath.Registration`, where
   registration recorded the person's own consent moments earlier.
7. Communication preferences back to defaults (undoing any "stop emails").
8. `AllowOnlineBookings` ON, every session ended, security + concurrency stamps replaced.
9. One `AdminAlertType.ProviderAccountTakenOver` alert (Medium when the team had typed a real name and both
   typed names differ) and one activity row.

### Registration against a prepared account

| Typed | Answer | Code |
|---|---|---|
| The team **email** | normal registration, one email code, then take-over | `AuthService.RegisterUserAsync` hold branch |
| The team **phone** | 409 `RegistrationErrorCodes.PreparedProfileSignIn` + the masked number and NOTHING else | `AuthController.Register` |
| Another account's email/phone | today's clear error | unchanged |

The 409's masked number comes from `SecurityExtensions.PhoneHint` — one definition of that mask, server-side.

## 3. The setup session (S1–S10)

`clinqetinfrastructure/Authorization/SetupSessionFilter.cs` runs on **both** API hosts and is **default DENY**:
a token carrying `ActorClaimTypes.ActorUserId` reaches only endpoints marked `[AllowedInSetupSession]` (plus
anything `[AllowAnonymous]`, which needs no token at all). Everything else answers 403
`setup_session_not_allowed`.

‼️ **The allow-list is pinned by a convention test in each host's own suite** —
`Clinqet.API.UnitTests/Conventions/SetupSessionAllowListTests.cs` and
`Clinqet.Identity.UnitTests/Conventions/SetupSessionAllowListTests.cs`. Adding or removing a mark fails the
build until the registry is updated, and the money/customer/message controllers and the account's own security
endpoints are named one by one so a future mark on them fails by name. `Clinqet.API` and
`Clinqet.Identity.API` are PEER HOSTS: neither scans the other (CLAUDE.md §0.15).

Other rules worth knowing before changing anything here: the session is minted with **no recent-authentication
credit** (S2), refuses to mint for an account holding Admin (S3), adds a user type only after a SUCCESSFUL
sign-in (S4), attributes writes to "Clinket team (admin name)" through the existing `PlatformAdmin` actor and
writes one `BusinessActivityType.ClinketTeamSetupSession` row (S5), and enters only a business the person OWNS
(S8). It is 60 minutes, cannot be refreshed, and lives in memory only.

**S6, the way out**: `clinqetapi/Clinqet.API/Controllers/SetupSessionController.cs` — one notice, in-app and
push only, `NotificationType.ProfileUpdatedByClinketTeam`, deterministic EventId per SESSION so a double-tap
on Finish cannot send two. Shown only on an account its owner has taken over: a notice to an account nobody
has signed into reaches nobody.

## 4. The signed claim / stop-emails link

`clinqetinfrastructure/Services/Auth/PreparedProviderLinkProtector.cs` — HMAC-SHA256 over
`v1.{userId}.{expiryUnix}`, base64url, `FixedTimeEquals`, and the payload is parsed **only after** the
signature verifies.

‼️ **Not ASP.NET Data Protection.** The link is signed in the **Functions** host and read in **two API** hosts,
and must survive weeks in an inbox; Data Protection's key ring is per host and expires in 90 days. The key is
`PreparedProvider:SigningKey`, identical across hosts AND stamps (`azureautomation/deploy.ps1` creates it once
in Key Vault and never rotates it — rotating it kills every link already sent). A host refuses to boot without
one of at least 32 characters.

The two pages live in the PROVIDER web app and are `noindex` + robots-disallowed:
`clinqetwebpartnerapp/src/app/claim/` and `.../stop-emails/`, with their components in
`src/components/preparedProfile/`. Their paths must match `PreparedProvider:ClaimPath` / `StopEmailsPath`;
`preparedProfilePaths.js` holds the client half and says so.

‼️ **Every answer for a link the server cannot place is the STATE ALONE** — a made-up link, an expired one and
a claimed one are indistinguishable. Only a business still waiting for its owner describes itself, and then
only with what the email already carried (business name, city, category, three services, a masked email, a
COUNT of waiting customers, never a customer detail).

‼️ **Stopping happens only on the button**, never on a GET: mail scanners open links.

Two reasons, from `PreparedProviderStopReason`:
- `Unwanted` → emails off through the existing communication-preference rows (no schema), Medium
  `PreparedProviderEmailsStopped` alert, the claim invite kept, reversible.
- `NotMine` → the reported **email is removed** from the account in one transaction (the phone is KEPT — the
  reporter speaks only for the inbox), High `PreparedProviderWrongContact` alert carrying the OLD email, and
  the page shows a thank-you with no claim invite.

## 5. Messages to an unclaimed business

`CommunicationDispatcher` asks `IPreparedAccountDirectory` for a cached
`PreparedAccountState(IsPrepared, EmailsStopped)` and, for a prepared account, allows **email and in-app
only** — no SMS, no WhatsApp, no marketing — and lets a "stop emails" beat even the mandatory-email rule until
take-over.

"Stopped" has no column: it is **every category's email switch being false**, with one shared
parser/predicate in `PreparedAccountDirectory` (`EveryEmailIsOff`). Do not add a second definition.

The footer is added by `PreparedProviderEmailFooter` through markers in `EmailShell`, resolved by
`ApplyPreparedFooter` on **every** send, so a marker can never ship. The shell renders once per language;
the footer is per recipient, which is why it is markers and not a shell edit.

One `PreparedProviderCustomerWaiting` alert per waiting REQUEST (lead, booking request, message), raised from
`NotificationProcessor` via `PreparedProviderWaitingAlert`, with a deterministic event id per request — never
one per email.

## 6. Services with no price — "Price on request"

‼️ **One rule, one place.** `ServiceBookingPrice.HasSetPrice` is the only answer to "does this have a price",
and `clinqetcore/Utilities/ServicePricingRules.cs` is the only answer to "may it be stored":

- A real price (above zero), **or** `PriceTypes.OnRequest` with every amount null.
- **An amount of 0 is REFUSED** (`Error_ZeroPriceRefused`). A free service is not supported, and a service
  stored at 0 reads as free and books at nothing.
- A **minimum charge alone IS a price** ("From $120") — which is why the rule asks `HasSetPrice` and not one
  named field.
- A ceiling with no start books AT the ceiling (UW-29), so it is a real price too.
- `Normalize` stamps the canonical `"On request"` and nulls every amount, visit fee, travel fee and discount.

`StringFormattingExtensions.NormalizePriceType` has a fourth case; the stored value is always
`PriceTypes.OnRequest` ("On request"), and **every form token mapper must map the stored words back** — a plain
`.toLowerCase()` matches no pill and loses both the type and the price (the C13 defect, fixed in provider web,
admin web and admin phone).

What a price-less service does:
- **Lives.** The AI setup writer approves it and only a missing CATEGORY parks one
  (`ProviderSetupServiceWriter`).
- **Customers** see "Price on request", an "Ask for price" button that opens a chat with THAT provider already
  typed, and the existing Call. It is never addable to a cart and never bookable online. (It is NOT the
  marketplace "Get Quotes" broadcast — that is a different feature.)
- **No offer band**: an offer takes money off a price, and there is none. One rule per app
  (`serviceShownOffer`, `shownServiceOffer`).
- **No visit/travel flag**: those describe a TOTAL.
- **Price filters** exclude it and price **sorts** put it last, including the provider price sort, which used
  to drop such providers entirely (`ProviderSearchService`, two segments, no index change).
- **Documents never print its 0.** `BookingPriceDisplay` is the one rule; `QuestPdfService` and the booking /
  quote email processors print `Label_PriceToBeConfirmed`, and `InvoiceService.CreateFromBookingAsync` returns
  **null** rather than raising an invoice for a booking still awaiting a price.
- **The receptionist** books it like an unlisted item, price to be confirmed by the owner
  (`clinqetmcp/.../Tools/BookingTools.cs`), and `get_quote_estimate` answers instead of throwing.
- **A cart line that loses its price** is removed on the next read with a reason
  (`CartRemovalReason`), and the cart SAYS so.

## 7. Where the words live

Provider/customer strings are keys in all five languages; admin screens are English-only by rule.
`service.price.onRequest` / `service.price.askForPrice` / `service.price.onRequestNote` /
`messages.priceRequestDraft` / `cart.itemRemovedNoPrice` (customer web, and `SERVICE_PRICE.*` / `CART.*` on
the customer phone); `Label.NoPriceYet` / `service.priceOnRequest.*` (provider web, `*_SCREEN.*` on the
provider phone); `Error_PreparedProfileSignIn`, `Error_ZeroPriceRefused`, `Label_PriceToBeConfirmed`,
`Email_PreparedFooter_*`, `Notification_ProfileUpdatedByClinketTeam_*`, `SetupArea_*`,
`BusinessActivity_ClinketTeamSetupSession` (API).

## 8. Before you change anything here

1. Read `PLAN.md` — especially §4.3's 25 edge cases and §7's C1–C14. They are the contract.
2. A new `[AllowedInSetupSession]` mark is a **security decision**; the convention test will make you write it
   down, and you should be able to say why the admin wizard needs it.
3. Never add a second definition of "has a price", "is on request", or "emails are stopped".
4. The link key is never rotated and never per-stamp.
5. Changing the take-over means changing `ProviderTakeoverIntegrationTests` deliberately, against real SQL.
