---
description: |
  **CROSS-CUTTING FEATURE SKILL** — The multi-user provider model: one business, many people. USE FOR: business/membership/role/permission work, the authorization pipeline (TenantContext, [RequiresPermission], the snapshot cache, resource scopes), the business-context token exchange and workspace switching, invitations, teams, branches (locations) and per-branch hours, seats and the legacy grant, member lifecycle and ownership transfer, the shared team inbox, the business activity feed, business notification routing, the admin support cross-lookup, and cross-tenant isolation. Spans clinqetcore/Entities/SQL, clinqetinfrastructure/Services/Tenancy, clinqetapi Controllers/Tenancy, clinqetidentity BusinessContextController, and the tenancy surfaces in clinqetwebpartnerapp, clinqetmobilepartnerapp and clinqetwebadmin.
---

# CLINQET PROVIDER TEAMS (MULTI-USER PROVIDER) — COMPREHENSIVE SKILL

## RECENT CHANGES — 2026-10-06 (an administrator holding a 60-minute reach into a business)

See the `clinqet-prepared-providers` skill for the whole feature. What changed HERE:

- **A SETUP SESSION is a business-context token minted for an ADMINISTRATOR, carrying an actor claim**, and it is DEFAULT DENY: only `[AllowedInSetupSession]` endpoints answer it.
- ‼️ **It is minted only into a business the person is the PRIMARY OWNER of** (`m.IsPrimaryOwner`, no "only one enterable" fallback), and never into an account that holds admin access.
- **Attribution puts the ACTOR first**: the feed and the activity row read "Clinket team (admin name)", not the owner's name.
- **The business-context EXCHANGE is not marked**, so a setup session cannot launder its actor claim away by re-minting a token. Only `GET auth/businesses` is.
- **The take-over ends every session** on that account, the admin's included.

## ABSOLUTE RULES (READ FIRST — APPLIES TO EVERY CHANGE)

1. **The active `BusinessId` comes ONLY from the signed token.** A route, header, query **or body**
   value must equal it or the request is refused. ‼️ A settable `BusinessId` on a provider-gated request
   DTO is a **build failure** — see §12.2.
2. **NO cross-partition Cosmos query. Ever.** Every branch, team, assignment and inbox predicate is an
   in-memory `Where` **inside** one `/businessId` read.
3. **Every `IMemoryCache` write sets `Size = 1`.** This feature added six cache write sites; all six comply.
4. **Deny by default.** No permission, or an unmatched scope, means no access.
5. **`business.transfer_ownership` is never grantable to an Administrator** (L19), and
   `payout.manage_account` is owner-only (L40). Both are enforced by build-failing convention tests.
6. **Never retro-edit an applied EF migration**, and ‼️ **never pass `--no-build` to `dotnet ef`** — it
   reads a stale model AND a stale migration list, and has already produced an empty migration and
   deleted the wrong one.
7. **Zero hardcoded user-facing text.** Every string is a key in all five API catalogs
   (`en`/`es`/`fr`/`hi`/`gu`, **2,879 keys each, identical keysets** — 2,876 until AZ12 added `booking.delete`) or in both provider apps' bundles.
   The `clinqetwebadmin` app is the ONE exception — it has no i18n at all and its copy is hardcoded
   English by owner decision (**AD1**).

---

## 1. WHAT THIS FEATURE IS, AND WHAT IT REPLACED

Clinket used to conflate six meanings into one identifier. `UserProfile.UserNumber` (5 chars) was
simultaneously the person, the provider, the business, the Cosmos tenant, the payout owner and the public
identity — so **a business could have exactly one human, forever.**

The programme separated them:

```
PERSON      UserProfile : IdentityUser      UserNumber  5 chars   [SQL]
   |
   |  BusinessMembership — one row per relationship, many-to-many
   v
BUSINESS    Business (the tenant)           BusinessId  6 chars   [SQL]
   |
   +-- Cosmos operational data    ProviderData / Reviews / Transactions   /businessId
   +-- Cosmos communications      Communications /userNumber  (notifications = person,
   |                                                          conversations = business)
   +-- SQL money                  ProviderSubscription / ConnectedAccount / LedgerEntry /
                                  BillingTransaction / MinuteLedger    .BusinessId
```

One human can be a Clinket customer **and** owner of Business A **and** administrator of Business B
**and** contractor for Business C, signing in once and switching workspaces.

‼️ **The Cosmos data layer was already correct before the programme started** — `ProviderData`,
`Reviews` and `Transactions` already partitioned on `/businessId`, and all 52 repositories already took
an explicit `partitionKey`. **Zero new containers, zero partition-key changes, zero composite-index
rewrites** were needed. Only the *meaning* of the value changed.

### 1.1 Where to read more

| Topic | Skill |
|---|---|
| Controllers, `[RequiresPermission]`, the middleware pipeline | `clinqet-main-api` |
| Token claims, the workspace exchange, business creation | `clinqet-identity-api` |
| Cosmos entities, attribution, assignment, the activity feed | `clinqet-cosmos-data` |
| Enums, DTOs, error codes, `TenantContext` | `clinqet-shared-core` |
| Recipient resolution and the 129-type catalogue | `clinqet-notifications` |
| The shared inbox and the SLA clock | `clinqet-messaging` |
| Provider-web screens and the rendering rules | `clinqet-partner-app` |
| Provider-mobile mirror and `isDomainForbiddenUrl` | `clinqet-provider-mobile` |
| The support cross-lookup | `clinqet-admin-app` |
| Test doubles, convention tests, sabotage lessons | `clinqet-testing` |

---

## 2. IDENTIFIERS — and why 6 characters is a correctness requirement

| Identifier | Shape | Means | Lives on |
|---|---|---|---|
| `UserId` | GUID string (450) | ASP.NET Identity PK | `UserProfile.Id`, JWT `NameIdentifier` |
| `UserNumber` | **5** chars `A-Z0-9` | the **person** | `UserProfile.UserNumber`, JWT `UserNumber` |
| **`BusinessId`** | **6** chars `A-Z0-9` | the **tenant** | `Business.BusinessId`, every Cosmos `/businessId` |
| `MembershipId` | GUID string | person↔business relationship | `BusinessMembership.MembershipId` |
| `TeamId` / `BranchId` | GUID string | operational groupings | SQL only |

‼️ **Why the lengths must differ (D1, and it is a data hazard not a style choice).** The
`Communications` container is partitioned by a single path, `/userNumber`, and stores **both**
`Notification` documents keyed by a *member's* `UserNumber` **and** provider-side `Conversation`
documents keyed by a *`BusinessId`*. If the two identifiers could ever be equal, **two different
tenants' documents would share one logical partition.**

Three layered guarantees:

1. **Length disjointness** — 5 vs 6. Equality is impossible.
2. **Shared-namespace allocation** — `Clinqet.Core.Services.Tenancy.BusinessIdAllocator` rejects a
   candidate found in *either* `UserProfile.UserNumber` *or* `Business.BusinessId`, via
   `IIdentifierNamespaceProbe`. Two probes, one algorithm:
   `Clinqet.Infrastructure.Services.Tenancy.SqlIdentifierNamespaceProbe` (Scoped) and
   `ClinqetCosmosAIIndexSetup.DataSeeding.SeedIdentifierNamespaceProbe`.
   ‼️ The seed probe exposes **`IsTakenAsync`**, not a synchronous `Contains`.
3. **A convention test** fails the build if either generator length changes to collide.

Shared shape: `Clinqet.Shared.Constants.IdentifierNamespace` (`Alphabet`, `UserNumberLength = 5`,
`BusinessIdLength = 6`, `StoredMaxLength = 16`) +
`Clinqet.Shared.Utilities.IdentifierCodeGenerator.NewCode`.

‼️ **Both columns are `[StringLength(16)]`** — `nvarchar` is variable-length so short values cost
nothing, and widening the generator later is a config change with **no migration**.

‼️ **The allocator lives in `clinqetcore`, not Infrastructure** (L42). `cosmosindexsetup` references only
`clinqetcore` + `clinqetshared`, so an Infrastructure-resident allocator would have forced a second copy
of the retry/backoff algorithm into the seeder.

---

## 3. SQL SCHEMA — 17 tenancy tables

`clinqetcore\Entities\SQL\`, configured by
`clinqetinfrastructure\Data\SQL\TenancyModelConfiguration.Apply(ModelBuilder)`, called from
`AppDbContext.OnModelCreating` beside `BillingModelConfiguration.Apply`.

| Table | Holds |
|---|---|
| `Business` | the tenant. `BusinessId` PK · `DisplayName` · `LegalName?` · `Status` · `PrimaryOwnerMembershipId?` · `Country`/`TimeZone`/`DefaultLocale` · `FriendlyName?` (the Open Page slug, **moved off `UserProfile`**) · `IsPubliclyListed` · `PublicListingUpdatedAt?` · `PublicListingSequence?` · `ExtraSeatsAllowed?`/`ExtraSeatsGrantedAt?`/`ExtraSeatsReason?` · `NotificationRouteVersion` · the four ownership-transfer columns · `RowVersion` |
| `BusinessMembership` | the relationship. `MembershipId` PK · `BusinessId` · `UserId` · `RelationshipType` · `Status` · **`AuthorizationVersion`** · `JoinedAt`/`SuspendedAt`/`RemovedAt`/`LastAccessAt` · `SuspendedByUserId?`/`RemovedByUserId?` · `InvitedByMembershipId?` · `RowVersion` |
| `BusinessRole` | the ten system role templates. `IsSystemRole`; nullable `BusinessId` reserved for future custom roles |
| `BusinessMembershipRole` | `(MembershipId, RoleId)` — **multiple roles per membership** |
| `BusinessTeam` · `BusinessTeamMember` | operational groupings; team name unique per business, enforced by the database |
| `BusinessBranch` · `BusinessMembershipBranch` | branch **identity + staff**. `BranchId` · `BusinessId` · `Name` · `IsActive` · `IsDefault` · `DisplayOrder`. ‼️ **ZERO address columns** |
| `BusinessInvitation` · `InvitationRole` · `InvitationTeam` · `InvitationBranch` | pending invitations. `TokenHash` only — never the raw token |
| `BusinessNotificationRoute` | `(BusinessId, EventCategory)` unique → who is operationally responsible |
| `MembershipNotificationPreference` | **both** D8 preference surfaces, discriminated by `IsTeamActivity` + nullable `AboutMembershipId` |
| `AccessChangeQueue` | the D4 targeted outbox |
| `BusinessOwnershipHistory` | append-only transfer record (already an audit table) |
| `BusinessFriendlyNameHistory` | retired slugs, keyed on `BusinessId`, unique on `FriendlyName` |

### 3.1 What is deliberately NOT a table

- ‼️ **The permission catalogue and its role grants are CODE** —
  `clinqetinfrastructure\Data\SQL\TenancyRoleCatalogDefinition` (`Permissions`, `Roles`,
  `GrantsByRoleKey`). `BusinessPermissionDefinition` and `BusinessRolePermission` were built in Phase 1
  and **deleted** in Phase 2.1 (**L55**): 89 permissions and 353 grants are a fixed C# list, and copying
  them into SQL buys a seeder, a version row, a reconcile path and a drift risk while nothing queries
  them. **Only `BusinessRole` reaches SQL**, because a membership needs a real foreign key.
  `PermissionsAndGrants_AreCodeOnly_AndNeverSQLEntities` fails the build if either table returns.
- ‼️ **The D7 grandfathered seats are three COLUMNS on `Business`**, not `BusinessLegacySeatGrant`
  (**L56**). One fact per business that never shrinks and never expires ⇒ a column.
- ‼️ **The ownership-transfer state is four COLUMNS on `Business`**, not a table (**L95**) — at most one
  transfer can be pending per business, so the column shape enforces the invariant structurally.
- ‼️ **`SecurityAuditEvent` DOES NOT EXIST AND WILL NEVER BE BUILT.** See §14.

### 3.2 Migrations, in order

`20260801220934_AddMultiUserProviderTenancy` → `20260801235115_AddRefreshTokenBusinessContext` →
`20260802020008_TenancySchemaSimplification` →
`20260802201725_AddNotificationRoutingVersionAndPreferenceDiscriminator` →
`20260803040821_AddTeamManagementAndOwnershipTransfer` →
`20260804150226_AddBusinessDisplayNameIndex`.

### 3.3 The three index traps this schema already hit

1. ‼️ **EF Core keys `HasIndex(properties)` on the PROPERTY SET, not the name.** Declaring both a
   filtered-unique and a plain index on `(BusinessId, UserId)` did **not** create two indexes — the
   second call **renamed the first**, so the load-bearing unique index shipped under the wrong name.
   Use the `HasIndex(properties, name)` overload. **One** index exists on that pair:
   `UX_BusinessMembership_Business_User_Live` (filtered, `WHERE Status <> Removed`) — **L39**.
2. ‼️ **EF's FK-index convention silently DROPS the conventional index** when you declare a composite
   leading with the FK column. A filtered `(UserId, BusinessId)` index on `RefreshToken` generated a
   `DropIndex(IX_RefreshToken_UserId)`, which would have de-indexed `InvalidateRefreshTokensAsync` and
   the user-delete cascade. **Read the generated migration** — that is the only place it was visible
   (**L52**).
3. ‼️ **`Business` gets NO global query filter** (**L43**). "Excluded from public surfaces" means
   `Status != Active`, evaluated per query. A filter would silently hide a suspended business from the
   seat count, the admin portal and the WhatsApp router.

### 3.4 Two more SQL facts that bite

- ‼️ **`AppDbContext` applies `HasQueryFilter(u => u.IsActive)` to `UserProfile`.** Any membership query
  that joins `Users` inherits it, so a deactivated person's memberships **silently vanish** from a team
  list. Team reads use `IgnoreQueryFilters()` and surface the deactivated state explicitly.
- ‼️ **`BusinessMembership.UserId → UserProfile` is `DeleteBehavior.Restrict`** (**L44**). The
  business's record of who did what must survive a person delete; removal is a `Status` transition,
  never a row delete. This broke `IdentityApiFactory.CleanupDatabaseAsync` until it deleted `Business`
  rows first.
- ‼️ **`cosmosindexsetup` does NOT reference `clinqetinfrastructure`.** It carries its own shadow EF
  model (`DataSeeding\SeedDbContext.cs`) mapped to the same tables. **Schema drift there does not fail
  to compile** — mirror any `AppDbContext` change the seeder touches by hand.

---

## 4. THE TOKEN CONTRACT

`Clinqet.Shared.Constants.BusinessContextClaimTypes` — names frozen by a convention test. Stamped on a
**provider-context token only**; a customer or admin token carries none of them and costs **zero** extra
queries.

| Claim | Meaning |
|---|---|
| `BusinessId` | the active tenant |
| `MembershipId` | the acting relationship |
| `AuthorizationVersion` | the snapshot stamp for revocation |
| `BusinessRoles` | comma-joined coarse set — ‼️ **UI affordances ONLY, never authorization** |
| `BusinessAccess` | `Full` or `BillingOnly` (D9) |

**Never in the token:** the permission set, scopes, assigned resource ids or team membership. The token
is a *snapshot*, not proof.

### 4.1 One session-minting path

‼️ **`IAuthService.IssueSessionAsync` is the ONLY place a session is minted** (**L53**). Eleven flows —
login, three MFA flows, passkey, external, registration verification, password set/change, contact
change, refresh — were all routed through it. **Do not add a twelfth path.**
`GenerateJwtTokenAsync` and `GenerateRefreshTokenAsync` gained *optional trailing* parameters, so no
call site broke.

### 4.2 The workspace endpoints (Identity host, `api/v{version}/auth`)

`Clinqet.Identity.API.Controllers.BusinessContextController`:

| Endpoint | Does |
|---|---|
| `GET businesses` | lists every workspace the caller **holds** — see §4.4 |
| `POST business-context` | the token exchange. ‼️ **The only way an active `BusinessId` is established** |
| `POST businesses` | creates an ADDITIONAL workspace for someone who already has one — explicit and deliberate. It is no longer how the FIRST one appears (§4.6) |

‼️ **`POST business-context` is throttled** — `Tenancy:BusinessContext:MaxExchangesPerWindow` 20 /
`WindowMinutes` 5, in-memory, `Size = 1`, checked **before any database work**, refusing with **429**
`business_context_rate_limited`. Not because it leaks anything (§4.3) but because **every DENIED
exchange calls `RevokeBusinessSessionsAsync`, an `ExecuteUpdateAsync` against `RefreshToken`** — the
platform's hottest-insert table (**H4**).

### 4.6 Self-serve provisioning — the first workspace appears at first SIGN-IN

‼️ **"Business" is our word, not the provider's.** Somebody who signs up on the partner app with nobody
expecting them IS a business, so making them earn one was friction we invented. Before this, the tenant
appeared only at the first onboarding save — which meant the AI Quick Setup modal on onboarding step 1
called `GET /business/service/areas` with no `BusinessId` claim, got **403 business_context_required**, and
greyed out its own button with copy telling the user to close and reopen (which re-ran the same 403).

**Where:** `IssueSessionAsync`, in the `businesses.Count == 0` branch — the membership query that signals
it **already runs on every provider sign-in**, so the trigger costs nothing. Every auth path funnels through
it, including `POST /auth/register/verification`, which is the FIRST session a new provider ever receives —
so the very first token they hold already carries the workspace.

‼️ **Refresh deliberately never reaches it**: refresh resolves from the workspace stored on the refresh
token, so it can never create.

**`IBusinessProvisioningService.EnsureSelfServeBusinessAsync` returns `SelfServeProvisioningOutcome`:**

| Outcome | Caller must |
|---|---|
| `Created` | re-read memberships |
| `AlreadyHeld` | ‼️ **re-read memberships TOO** — see below |
| `ExpectedByInvitation` | return empty; they genuinely hold nothing |
| `Failed` | return empty; fail-open, the next sign-in retries |

‼️ **`AlreadyHeld` is not the same refusal as `ExpectedByInvitation`, and collapsing them loses a session.**
Concurrent sign-ins all read "no workspaces" before any of them writes, so the applock makes every racer but
the winner land on `AlreadyHeld` — their list is merely stale. Returning empty there hands a real provider a
session with no workspace for a business that now exists. Caught by
`ConcurrentSignIns_ProvisionExactlyOneWorkspace`.

**The two in-lock guards** (`SelfServeDeclineAsync`, inside the existing `sp_getapplock` — the decision
CANNOT be made outside it, because two devices both read "no workspaces" before either writes):

1. **already holds a non-Removed membership** → `AlreadyHeld`. ‼️ `Removed` is the only exclusion that
   carries weight — nothing creates an `Invited` membership (§4.4), and naming it here is a dead clause of
   exactly the kind casebook CASE 2 returned through. `NoLimitCountsAnImpossibleRowTests` fails the build
   on it.
2. **a Pending, unexpired invitation names their `NormalizedEmail`** → `ExpectedByInvitation`. This is
   §5.3's original defect: an invited employee registers through the SAME register page as everyone else,
   with the token stashed client-side only, so the server can disambiguate by **email alone**. Seeks
   `IX_BusinessInvitation_Email_Pending` — filtered on `[Status] = 'Pending'`, added by the
   `AddPendingInvitationEmailIndex` migration, because the existing composite leads with `BusinessId`.

**An EXPIRED invitation does NOT count** (owner-decided): nobody is expecting them any more, so they are a
self-serve signup like any other, and their next sign-in provisions.

‼️ **Sign-in applies the SAME eligibility gate as `POST /auth/businesses`** (`!IsActive || IsSuspended`).
Production login refuses first, but a second entry point that trusts the caller's check has none.

‼️ **The self-serve workspace COUNTS toward `Tenancy:BusinessCreation:MaxPerWindow`.** It is a business
creation by that person; exempting it would be a hole rather than a courtesy. It cannot be looped — the
second sign-in finds a workspace and creates nothing.

**`DisplayName` is seeded from the PERSON's name**, because no business name exists yet — they type it at
onboarding step 1, and the ProviderData change feed projects it over the seed the moment they save (§4.7).

### 4.7 `Business.DisplayName` is a PROJECTION of `BusinessProfile.Name`

**Two names, two stores, one source of truth.** `BusinessProfile.Name` (Cosmos) is authoritative — it is
what the provider edits, in one atomic ETag-guarded form. `Business.DisplayName` (SQL) is a **read-model
projection**, and nothing else may write it.

**Why SQL keeps a copy at all** (removing it was considered and rejected):

- the **public Open Page** renders from ONE Cosmos document, so the name must live there → Cosmos cannot be
  dropped;
- `ProjectMemberships` joins `Business.DisplayName` as **one column on a table the workspace query already
  joins**, on **every provider sign-in** → dropping the SQL copy makes every sign-in N Cosmos reads;
- every business email, notification, digest and invitation reads it on SQL-only paths — a cross-store read
  per dispatch, or a cache that goes stale on the exact operation being fixed.

‼️ **Admin name search is NOT the reason** (owner-corrected): admin can look a business up by email or
business number.

**How the copy stays true:** `ProviderListingProjectionService`, driven by the ProviderData change feed —
which **already delivers and already deserializes the BusinessProfile document**. Zero new feed, zero new
lease, zero new RU, zero Cosmos reads. Same pattern as `IsPubliclyListed`, on the same row.

‼️ **The projection is SET-BASED — one round trip per BATCH, never per business.** It was per-business: a
DbContext and a connection for each of up to 500 businesses, then a **second pair** for each IndexNow ping.
Now one `OPENJSON` + `UPDATE..FROM..OUTPUT`:

- `OPENJSON` not a TVP (a user-defined table type is schema) and not a `VALUES` list (variable parameter
  counts pollute the plan cache with one plan per batch size);
- `OUTPUT` returns exactly the rows that changed — that is what makes the IndexNow ping free AND stops a
  redelivered batch re-submitting a URL that never moved;
- raw ADO because `ExecuteSqlInterpolatedAsync` cannot read rows, wrapped in the context's own execution
  strategy so it keeps the platform's transient-fault retry.

**The WHERE is the cost story.** A batch carrying only service/offer/availability edits contributes
**nulls** — it claims nothing about the verdict or the name, so those columns are left alone:

| Row state | Written? |
|---|---|
| already listed | **yes** — lastmod IS the crawler signal that the page moved |
| becoming listed | yes |
| name genuinely moved (even while unlisted) | yes — emails must never carry a stale name |
| unlisted, name unchanged | **no row touched at all** |

‼️ **`FriendlyName` is a DIFFERENT field and stays SQL-authoritative** — it is the public URL slug
(`clinket.com/{friendlyName}`), unique, reserved-word checked, with a history table so retired slugs 301
instead of 404. The field that needs a CONSTRAINT lives in SQL; the free-text one lives with the profile.

‼️ **A rename now pings IndexNow**, deliberately: the business name is on the public page, so the page did
change.

### 4.8 Workspace entry returns early when the token already has one

`enterMostRecentWorkspace` (partner web `utils/workspaceEntry.js`, provider mobile
`lib/tenancy/pendingInvitation.ts`) must return `false` immediately when `businessIdFromToken()` is truthy —
there is nothing to enter, and exchanging spends a round trip to arrive where it already is. **Mobile always
had this guard; web did not**, and since self-serve provisioning a first-time provider's very first token
carries a workspace, so web burned an exchange on every cold start.

### 4.3 `BusinessAccessPolicy` — the ONE pure gate

`Clinqet.Shared.Utilities.BusinessAccessPolicy` is consulted by **both** the workspace list and the
token exchange, so the selector can never offer something that 403s on click:

| Situation | Result |
|---|---|
| Removed / Invited | generic deny |
| Suspended membership | its own key |
| Closed business | deny |
| Suspended business + **primary owner** | grant **`BillingOnly`** (D9) |
| Suspended business + anyone else | deny |
| **Active or Onboarding** | grant `Full` |

‼️ **`Onboarding` GRANTS access** (**L46**). `Business.Status` *defaults* to `Onboarding`, so a literal
"reject unless Active" reading would lock an owner out of a business they just created. Public listing
gates separately on `Status == Active`.

‼️ **"No live membership" and "no such business" return the IDENTICAL response** — no enumeration
oracle. An integration test byte-compares the two bodies.

### 4.4 `GetMembershipsAsync` — the list is NOT self-filtering

The method was `GetActiveMembershipsAsync` and returned only enterable workspaces. It is now
**`GetMembershipsAsync`** and returns every workspace the person **holds** (A5, owner-approved):

| Situation | In the list? |
|---|---|
| Active membership, active/onboarding business | ✅ `CanEnter = true`, `AccessScope = Full` |
| Suspended business, the primary owner | ✅ `CanEnter = true`, `AccessScope = BillingOnly` |
| **Suspended business, anyone else** | ✅ **`CanEnter = false`**, `AccessScope = null`, reason `Error_BusinessSuspended` |
| **Suspended membership** | ✅ `CanEnter = false`, reason `Error_BusinessMembershipSuspended` |
| **Closed business** | ✅ `CanEnter = false`, reason `Error_BusinessClosed` |
| Removed · Invited (unaccepted) | ❌ filtered **in SQL** |

‼️ **`AccessScope` is NULLABLE and null exactly when `CanEnter` is false**, because
`default(BusinessAccessScope)` is **`Full`** — a non-nullable scope on an unenterable row would
advertise full access.

‼️ **Anything SELECTING a workspace from this list must filter on `CanEnter` itself.**
`IssueSessionAsync` does, explicitly, and throws rather than defaulting a missing scope.
`ResolveBusinessContextAsync` is unchanged and remains **the only authorization gate** — widening a
display list is never an authorization change.

‼️ **A `Removed` membership must stay indistinguishable from "no such business"**, and an `Invited` row
is not a workspace the person holds.

### 4.5 Refresh

`RefreshToken` persists **only** `BusinessId` (**L52**); `MembershipId`, roles and scope are
re-resolved from live SQL on every refresh — **that re-resolution IS the revocation guarantee**, and it
also makes a re-invited membership pick up its NEW `MembershipId` automatically.

‼️ **A refresh response deliberately returns an EMPTY `Businesses` list** (`AuthService.cs`, and it says
so in as many words) — refetching it on the platform's most frequent authenticated call would add a
query per refresh. It **does** carry `ActiveBusinessId`. **A client that writes its cached workspace
list from a refresh response WIPES the switcher.** Guard every write on a non-empty list.

---

## 5. THE AUTHORIZATION PIPELINE

```
UseAuthentication()
UseTenantContext()        <- Clinqet.API.Middleware.TenantContextMiddleware
UseAuthorization()
ConsentEnforcementMiddleware
```

`TenantContextMiddleware` returns immediately when the caller is unauthenticated or carries no
`BusinessId` claim, so a **customer or admin request costs nothing**. With a claim it resolves the
snapshot and writes `HttpContext.Items[TenantContextItemKeys.TenantContext]`. A **failed** resolution is
recorded at `HttpContext.Items["Clinqet.TenantContextFailure"]` and is **not thrown** — the same
person's customer-side requests must keep working while their provider membership is suspended.

### 5.1 `TenantContext`

`Clinqet.Shared.Models.TenantContext(UserId, UserNumber, BusinessId, MembershipId,
AuthorizationVersion, AccessScope, RelationshipType, IsPrimaryOwner, RoleKeys, Permissions, TeamIds,
BranchIds)` plus `ScopeFor(key)`, `Has(key, minimumScope)` and **`Satisfies(permissions, key,
minimumScope)`**.

‼️ **`Satisfies` is ONE scope rule with TWO callers** — the cached context and the live snapshot. A
second copy could drift and silently widen one of them (**H2**).

### 5.2 The snapshot cache

| | |
|---|---|
| Key | `authz:snapshot:{membershipId}:v{authorizationVersionFromToken}` |
| Value | `Clinqet.Shared.Models.AuthorizationSnapshot` |
| Entry | `Size = 1`, `AbsoluteExpirationRelativeToNow = Tenancy:Authorization:SnapshotCacheSeconds` (**60**), plus a per-membership `CancellationChangeToken` from `IAuthorizationCacheSignal` |
| Miss | **exactly one** SQL projection folding membership + business + roles + teams + branches |
| Version mismatch | **401 `business_context_stale`**, and nothing is cached |
| Denial | never cached |
| Permissions | `TenancyRoleCatalogDefinition.GrantsByRoleKey`, in memory, **broadest scope wins** (L27) |

‼️ **Revocation is bounded by the TTL, not guaranteed on the next request** (**L61**, owner-accepted).
A queue reaches one consumer and **D4 forbids a topic**, so worst-case revocation latency for an
already-issued access token is one TTL on an instance that did not consume the eviction. The
version-in-key guarantees a **new** token can never read an **old** snapshot; the outbox guarantees the
message is never lost.

‼️ **A cancelled `CancellationTokenSource` must not be disposed while `MemoryCache` still holds
registrations on its token** — `Register` on a disposed source throws. `AuthorizationCacheSignal`
cancels and drops the reference.

### 5.3 `[RequiresPermission]` — an MVC filter, not a policy handler

`Clinqet.API.Authorization.RequiresPermissionAttribute` is an **`IAsyncAuthorizationFilter`** (**L62**),
because every refusal must be an `ApiResponse` carrying a **localized** `Message` and a machine
`ErrorCode`, and the mismatch guard needs `RouteData`. A policy handler can only produce a bare 403.

- **183 endpoints across 23 controllers** carry it.
- **`[AllowedWhenBillingOnly]`** is class-level on `ProviderBillingController` and **nowhere else** — a
  convention test enforces it.
- ‼️ **The route/header/query mismatch guard lives INSIDE the attribute, never in middleware** (**L63**,
  **L71**). Two authenticated route families take a `{businessId}` —
  `customer/business/{businessId}/...` (five endpoints) and `ReviewController`'s class route
  `businesses/{businessId}/reviews` — plus the **anonymous public Open Page** family. A blanket
  middleware guard would 403 every provider page on the internet.
- ‼️ **The guard COMPARES BEFORE it validates shape** (**L67**). The first cut validated shape first and
  400'd every seeded id like `TEST-BUSINESS-001`; 22 integration tests caught it. "Malformed" now means
  outside `≤ 64 chars of [A-Za-z0-9_-]`.
- **Deliberately NOT annotated:** every `Admin/*` controller (**L33** — an admin token has no
  `BusinessId` claim, so the attribute would 403 support rather than secure anything), every
  `[AllowAnonymous]` endpoint, and the customer side of the mixed controllers. Three convention tests
  enforce those exclusions.

### 5.4 `RequiresLiveAuthorization` — the seven sensitive operations

`Clinqet.Shared.Constants.SensitiveOperations` is the canonical list:
`business.lifecycle.manage` · `business.transfer_ownership` · `payment.refund_approve` ·
`payout.export` · `payout.manage_account` · `team.assign_role` · `voice.number.manage`.

Setting `RequiresLiveAuthorization = true` makes the filter re-resolve via
`IAuthorizationSnapshotProvider.GetLiveAsync` after the cached checks pass, and re-test grant,
billing-only scope and permission. **10 endpoints** carry it: `ProviderBillingController` ×3 ·
`BusinessMemberController` ×4 · `BusinessProfileController` ×2 ·
`ProviderBookingPaymentController` ×1.

‼️ **The ORDER is load-bearing and is pinned by tests.** The cached checks run FIRST, so an ordinary
endpoint pays **zero** extra reads and a caller the cache already refuses pays **zero** — the live read
happens only for someone who would otherwise be allowed.

‼️ **Three convention tests make it an invariant, not a judgement call**
(`ProviderEndpointAuthorizationTests`): the flag is **required** on a sensitive key, **forbidden** on an
ordinary one, and every key in the list must exist in the catalogue — a typo would silently disable the
guard.

‼️ **`payout.export` and `voice.number.manage` have ZERO endpoints today.** Both are catalogue keys
granted to roles but carried by no controller. Not a hole — an unreachable permission grants nothing —
but they are on the list so that the day an endpoint appears, the convention test forces it onto the
live path.

‼️ **Step-up re-authentication exists in exactly ONE place on the platform** —
`MemberLifecycleService` (ownership transfer). **There is still no password step-up on payout KYC**; the
owner chose the live-SQL re-check instead (**H2**).

### 5.5 Resource-level scope — 28 endpoints

`IResourceScopeEvaluator` is called through `BaseController.EnforceResourceScope<T>(permissionKey,
ScopedResource)` and its non-generic sibling, resolved from `HttpContext.RequestServices` with
`GetRequiredService`. Wired at **28 per-record endpoints**: `Quote` 8 · `Invoice` 7 ·
`BroadcastProvider` 7 · `Customer` 6 · `Booking` 2. Returns **403 `resource_out_of_scope`**.

Pattern: load-by-partition-key → `ToScopedResource(...)` → `EnforceResourceScope` (which asserts the
document's own `BusinessId` too) → 403.

‼️ **Never hand-build a `ScopedResource`** — use
`Clinqet.Core.Entities.COSMOS.ScopedResourceExtensions.ToScopedResource(...)`. `SupportsAssignment:
false` on a type that *does* support assignment denies silently.

‼️ **`BaseController.RequiresResourceNarrowing(permissionKey)` gates the check where it would force an
EXTRA read** — Invoice, `BusinessCustomer` and lead endpoints (**L76**). A `Business`-scoped member is
entitled to anything in their own business, and every one of those loads already uses the caller's own
`BusinessId` as the partition key.

‼️ **`review.reply`, `voice.transcript.read` and `voice.settings.manage` get NO resource check**
(**L77**) — no role grants them below `Business`, so the check could never change the answer. The
assumption is an **enforced invariant**:
`CosmosTenancyContractTests.PermissionsWithNoResourceCheck_AreNeverGrantedBelowBusinessScope` fails the
build the day someone grants one at `Assigned`.

### 5.6 `minimumScope` policy (L68)

`PermissionScope.Business` on **whole-business** surfaces (lists, settings, catalogue, billing, voice,
insights); the default `None` on **per-record** surfaces so a narrow-scoped member reaches the endpoint
and the resource check narrows.

### 5.7 Self-dealing (L25)

`BaseController.IsSelfDealing(subjectCustomerUserNumber)` + `SelfDealingBlocked<T>()`, wired to
`ProviderBookingPaymentController.MarkRefundedInCash` and `ProviderDisputesController.Respond`.
`quote.approve_discount` has **no endpoint** — `Quote` carries no discount field — so wire it when one
ships.

### 5.8 Permission discovery for the client

**`GET /api/v1/business/access`** → `ApiResponse<BusinessAccessSummaryDto>` (role keys,
permission→scope map, access scope, team ids, branch ids). **Hiding an action client-side is UX; the
server still enforces.**

---

## 6. PERMISSIONS, ROLES AND SCOPES

### 6.1 The catalogue is CODE

`TenancyRoleCatalogDefinition` — **89 permissions**, **10 system roles**, **353 grants**,
`CatalogVersion = 1`. Seeded at runtime by `TenancyRoleCatalogSeeder` (+
`TenancyRoleCatalogSeedHostedService`), marker row `CatalogVersionState.TenancyRoleCatalogRowId =
"tenancy_roles"` (**L38** — `HasData` would add ~2,700 lines to the migration *and* to every future
snapshot).

`SystemRoleId(roleKey) => "sysrole_{roleKey}"`.

### 6.2 Scopes — action × scope, never action-per-scope

`Clinqet.Shared.Enums.PermissionScope`:
`None` · `CreatedByMe` · `Participating` · `Assigned` · `Branch` · `Team` · `Business`
— ‼️ **ordered narrow → broad, deliberately, so L27's "broadest scope wins" is a comparison.**

‼️ **Two roles granting one permission at different scopes → the BROADER wins** (**L27**). Otherwise
adding a role could *reduce* access.

### 6.3 The ten role keys

`primary_owner` · `administrator` · `operations_manager` · `sales_representative` · `dispatcher` ·
`technician` · `catalog_manager` · `finance` · `contractor` · `read_only_auditor`.

- **Primary Owner** = everything. Exactly one per business.
- **Administrator** = everything **except** `business.transfer_ownership` (L19) and
  `payout.manage_account` (L40) — so a compromised admin cannot redirect the business's money.
- **Technician / Contractor** = `Assigned` scope only. ‼️ **Both hold `quote.read` AND `invoice.read` at
  `Assigned`** (**L74**) — the approved admin mockup's read-out claiming otherwise is **factually
  wrong**, which is exactly why that panel must be **derived** from the catalogue, never authored.
- **Contractor PII (G2):** full customer details, `Assigned` scope only. A technician who cannot phone
  the customer cannot do the job — and the role never receives `Business` scope, so they can never
  browse the whole customer list.

### 6.4 At launch

System templates only · multiple roles per membership · **no** per-user overrides · **no** deny rules ·
**no** customer-authored policy language. Custom roles, approval limits and temporary elevation are
deliberately deferred.

### 6.5 Two permissions were ADDED to the owner-approved list (L66, ✅ approved)

`business.lifecycle.manage` (owner + administrator only) and `payment.record_offline` (+ Finance,
Operations Manager) — 87 → **89**. Two real endpoints had no honest key:
`POST /business/profile/deactivate` takes the whole business off the marketplace (and the nearest
existing keys were both held by the Catalog Manager, so a catalogue editor could have closed the shop),
and `POST /provider/bookings/{id}/cash-paid` moves money state with no gateway behind it.

### 6.6 Localization

Every permission and role carries a localization **key** for its display name and description —
**195 keys × 5 files** from Phase 1 alone.

---

## 7. SEATS AND QUOTAS

### 7.1 `team.seats`

An entitlement key resolved through the existing `EntitlementService.ResolveAsync(businessId)` /
`SubscriptionPlan` machinery. `BillingCatalogDefinition.EntitlementsForTier` (introduced in `CatalogVersion` 8;
two plans since **v12**, 2026-10-04).

**Free 3 · Premium 50 — never "unlimited"** (D3). An unbounded value creates
a cliff when limits arrive and leaves the enforcement path dead and untested until the worst moment.
Changing a value is a **configuration** change.

### 7.2 `IBusinessSeatService` — the D3/D7 engine

- **`UsedSeats` = live memberships + pending, non-expired `BusinessInvitation` rows** (**L100**).
- **`EffectiveLimit = max(tier, grant)`** — protects existing members.
- ‼️ **`CanGrantSeat = UsedSeats < BaseLimit`** — the **TIER** limit, never the grant (**L50**). A
  build-failing convention test blocks the tempting "simplification" to `Used < EffectiveLimit`.
- Registered **only in the Main API** (`AddBusinessSeatServices`), not by `AddTenancyServices` (**L51**)
  — seats need `IEntitlementService`, and the Identity host deliberately does not take the payments graph.
- **`UpgradeAvailable`** (on `BusinessSeatState` and `BusinessSeatStateDto`, 2026-10-04) = the resolved tier is
  `Free` — only then is there a higher plan. `BusinessInvitationService` refuses a seat-less invite with
  `Error_BusinessSeatLimitReached` when it is true and `Error_BusinessSeatLimitReachedTopPlan` (free a seat —
  no upgrade offer) when it is false. Both apps' `seatCardCopy` (`lib/tenancy/renderingRules`) pick the
  `*TopPlan` body keys and hide the upgrade button unless the server says `upgradeAvailable === true` — a
  missing field must never tell Premium to upgrade.
- **The tier limit is read by `PlanLimits.TeamSeats(tierLimit, Seats.DefaultLimit)`** (`clinqetcore/Models/Payments/PlanLimits.cs`,
  key `BusinessSeatState.TeamSeatsFeatureKey` = `team.seats`) — never unlimited; a missing row is the configured default. The
  billing plan card reads the same helper, so the card and the seat gate cannot disagree.

‼️ **Enforcement was INERT on the invite path until Phase 6 (casebook CASE 2).** The count read only
`BusinessMembership`, and a repo-wide grep proves **nothing anywhere creates a
`MembershipStatus.Invited` row** — `00-SOLUTION` §4.4 forbids a nullable-`UserId` membership, so a
pending invitation is a `BusinessInvitation` row and nothing else. **100 invitations against a 3-seat
tier were all allowed.** There was even a passing test that seeded `Invited` *membership rows* — a green
test on a shape production never creates. Fixed with the existing
`IX_BusinessInvitation_Status_ExpiresAt`: **no new index, no schema.**

‼️ **Expired and revoked invitations must RELEASE their seat** or a business silently locks itself out.

### 7.3 Downgrade = permanent legacy grant (D7)

A business that drops tier keeps **all** members working **forever**. Only **new invites** are blocked.
Recorded as `Business.ExtraSeatsAllowed` / `ExtraSeatsGrantedAt` / `ExtraSeatsReason`, written by a
**guarded `ExecuteUpdateAsync`** (`WHERE ExtraSeatsAllowed IS NULL OR < @used`), never read-modify-write.
Grants never shrink automatically and never transfer on ownership change.

### 7.4 Accepting an invitation is seat-NEUTRAL (L102, ✅ approved)

The accept gate is **`IsOverTierLimit`**, not `CanGrantSeat`. Because `UsedSeats` counts pending
invitations, acceptance flips one pending invitation into one membership — so `CanGrantSeat` would refuse
the **last legitimate acceptance on every tier**. `IsOverTierLimit` fires only when the tier dropped
between issue and acceptance. **Issue still uses `CanGrantSeat`.**

### 7.5 Quotas were already correct by construction

`AiUsageCounter.pk` · `LeadUsageCounter.pk` · the WhatsApp send-cap `pk` · `MinuteLedger.BusinessId` are
**all keyed on the business, never the person**. So five members share one pool automatically, and a
contractor in two organisations bills each separately — **with zero code change**. Every phase touching
quotas **proves this with a test** rather than assuming it.

---

## 8. INVITATIONS

`IBusinessInvitationService` / `BusinessInvitationService` — Issue / List / Resend / Revoke / Preview /
Accept / ExpireDue.

| Endpoint | Gate |
|---|---|
| `POST`/`GET /api/v1/business/team/invitations`, `{id}/resend`, `{id}/revoke` | `team.read` / `team.invite`, Business scope |
| `POST /api/v1/business/team/invitation/preview` and `/accept` | `[Authorize]` only — **the token is in the BODY** |

‼️ **EVERY invitation endpoint lives in the MAIN API, including ACCEPT** (**L101**), deviating from the
launcher that specified Identity. The invitee is **already authenticated** when they accept, so no new
session is needed and inventing one would add the twelfth path L53 forbids. Acceptance genuinely needs
the seat engine and the Phase 5 recipient resolver, neither of which the Identity host registers.
`UserType.Partner` is granted by inserting the `UserUserType` row **inside the acceptance transaction**.

### 8.1 Security properties actually built

`Clinqet.Core.Services.Tenancy.InvitationToken` — Generate (**≥ 256 bits**, Base64Url, floor-enforced) /
Hash (SHA-256 hex) / `HashesMatch` via **`CryptographicOperations.FixedTimeEquals`**.

- The raw token exists only in the response to the mailer and in the email; **only `Hash(raw)` reaches
  SQL**.
- Constant-time comparison after a unique-index seek. Single-use. Expiry from settings.
- **Resend and revoke both ROTATE the hash**, so the old link dies immediately (**L31** — inviting an
  address that already has a pending invitation is a *resend*, not an error).
- Rate-limited three ways: per business per window (`MaxPerBusinessPerWindow` 25 / 24 h), per invitation
  by cooldown (`ResendCooldownMinutes` 5), per caller by `IInvitationAcceptThrottle`
  (`MaxAcceptAttemptsPerWindow` 10 / 15 min, `Size = 1`).
- Seat check at **issue** (`CanGrantSeat`) and at **accept** (`IsOverTierLimit`).
- The invited email must equal the signed-in person's **VERIFIED** email.
- Roles/teams/branches validated against **this** business.
- ‼️ **A primary-owner role can never be conferred by invitation** (L19).
- **L32:** if the inviter is removed before acceptance, the invitation **stays valid** — it belongs to
  the business, and the audit keeps the original inviter's name.

### 8.1.1 ‼️ The invite screen preselects NOTHING — owner reversal of IV-1 (2026-08-10)

IV-1 originally preselected the narrowest role (`technician`), then the role that business used last.
**The owner reversed it: no role is ticked on load, on either client.** A prefilled role sends somebody an
invitation carrying access nobody chose, and the provider never looks at a box that was already ticked.

- `clinqetwebpartnerapp/src/app/dashboard/team/invite/page.jsx` and
  `clinqetmobilepartnerapp/src/Screen/ProfileFlow/Team/InviteMemberScreen.tsx` — `FALLBACK_ROLE_KEY`, the
  `clinket.invite.lastRoleId` remembered-role store and its read/write are **deleted**, not disabled.
- The heading stays the plain-language question **"What can they do?"**; `Invite.RoleHelp` /
  `INVITE.ROLE_HELP` sits under it and is the one place the word **role** is introduced — the same sentence
  turns red and gains `role="alert"` when nothing is ticked, so the instruction and the complaint are never
  two different strings. `Error_InvitationRoleRequired` no longer exists in the partner-web catalogues
  (it survives in the API catalogues, where server-side `[MinLength(1)]` still uses it).
- Submitting with nothing ticked scrolls the role card into view rather than only banner-ing at the button.
- Mobile now renders `BusinessRole_{roleKey}_Description` like web, and a chosen role fills brand green
  (`brandGreen` / `brandGreenSoft`), not `brandBlue`. The notification rows draw a `lock-closed-outline`
  **icon** where a pasted `🔒` used to sit — Lufga carries the brand codepoints and nothing else.

Pinned and sabotage-verified on both clients:
`clinqetwebpartnerapp/src/app/dashboard/team/invite/invitePageRoles.test.jsx` and
`clinqetmobilepartnerapp/__tests__/inviteRoleSelection.test.tsx` — restoring any preselect fails 3 of 4.

### 8.2 Concurrency — three layers, no new schema (L103)

1. `sp_getapplock` on `invite:{businessId}:{normalizedEmail}` inside the issue transaction.
2. A **guarded status flip** (`WHERE Status = Pending`, rowcount 1 wins) as the acceptance winner-picker.
3. The existing filtered unique index `UX_BusinessMembership_Business_User_Live` as the last line.

A filtered unique index on `(BusinessId, NormalizedInvitedEmail) WHERE Status = 'Pending'` would have
been the obvious answer — **but it is schema, and Rule Zero forbids adding it without asking.**

‼️ **A sequential "accept twice" test does NOT prove the concurrency guard**, and neither did the first
real-SQL version — the filtered unique index independently prevents the second membership, so two
mechanisms produce the same outcome. **The test had to assert WHICH one fired**: the loser must receive
`invitation_already_accepted` (the guarded flip), not `member_already_active` (the index). That
distinction is also the user-facing difference, so it is behaviour, not implementation detail.

### 8.3 A refused acceptance notifies BOTH audiences (L97, ✅ owner-decided)

The **business's admins** in-app + push + SignalR via the Phase 5 `BusinessSecurity` class, **AND**
Clinket ops via an admin alert gated on `Tenancy:Invitations:EnableAdminAlertOnRejectedAccept`
(default `true`). Two audiences, two different jobs, and it is **not** either/or: the business admin can
*act*; only Clinket ops can see **probing across tenants**.

‼️ **The spam vector is closed STRUCTURALLY, not by a rate limit.** A garbage token resolves to no
invitation, so there is no business to notify and it is rejected silently (it still counts toward the ops
signal). Repeats collapse to ONE notification via the delivery-idempotency store using the
deterministic `EventId` `invite-reject:{invitationId}:{reason}`.

---

## 9. TEAMS, BRANCHES AND STAFF

`IBusinessTeamStructureService` + `BusinessTeamController` (`api/v1/business/teams`) +
`BusinessBranchController` (`api/v1/business/branches`).

Team CRUD with a **unique name per business enforced by the database**, not by a pre-check. Branch
create / rename / reorder / set-default / deactivate / reactivate / delete / assign-staff — all eight verbs.

‼️ **Staff-to-branch and team-membership changes bump `AuthorizationVersion` AND write an
`AccessChangeQueue` row in the SAME transaction.** Without both, a moved member keeps their old access
for a full cache TTL.

‼️ **`IBranchResolver.EvictAreaMap` is called on every branch mutation AND every service-area mutation**
(**L82** + **CP8**). Phase 6 wired the branch half; **nothing evicted on an area mutation** until Part
C-PROVIDER, so a re-pointed area kept routing new work to its old location for up to 300 s, silently.

- Branch **delete** is refused while it holds staff or service areas, and **deletes its availability
  rows** in the same operation (**CP9**) — rows tagged with a branch that no longer exists are
  unreachable by every resolver.
- **Deactivate** deliberately KEEPS the rows, because closing is reversible.
- Deactivating a **default** branch moves the flag to a successor, because "are you open?" with no
  branch named must always resolve.

### 9.1 The SQL / Cosmos split (L57) — read `05-BRANCHES.md` before any branch work

- **SQL** answers *"does this member work at this branch"* — authorization, so it must be transactional
  with membership and is read on every request. **Zero address columns.**
- **Cosmos** answers *"where does this branch operate"* — `ServiceArea` and `BusinessProfile.Addresses`
  stay put and carry a nullable `branchId`, as do `Booking` / `Quote` / `BroadcastProvider` /
  provider-side `Conversation`.
- They meet **without a join**: SQL yields a small id list onto `TenantContext`, Cosmos filters
  `AND c.branchId IN (@allowed)` **inside the existing `/businessId` partition**.
- **`null` = whole business**, so a single-site provider sees no change.

### 9.2 The three rules that catch people out

1. ‼️ **`Service` is NEVER branch-scoped.** `Service.ServiceAreaIds` is already a list, so one service
   spans many areas and therefore many branches with a **single record**. There is no copy-paste.
2. ‼️ **The search index gets ZERO new fields.** `serviceAreaId` is already indexed; **`branchId` must
   NOT be** because it is mutable — moving one area between branches would reindex every service
   touching it.
3. ‼️ **A provider with zero branches never sees the word.** The dropdown appears only at **2+**
   (`showsLocations(activeCount) >= 2`). ‼️ **A branch with no staff falls back to notifying ALL
   eligible members — never nobody** (`NotificationRecipientResolver.ApplyBranchFilter`).

### 9.3 Per-branch opening hours (L60)

`Clinqet.Core.…BranchAvailabilityResolver` is **one pure, tested function** so every read site agrees:

> ‼️ **`effectiveHours(B) = rows WHERE branchId = B ELSE rows WHERE branchId IS NULL`.
> ABSENT ROWS MEAN INHERIT, NEVER CLOSED.** An explicit `isAvailable = false` row is how a branch is
> shut. Confusing the two silently closes every branch nobody customised — and this is the single most
> dangerous regression in the feature, sabotage-verified in three separate sessions.

Also on the resolver: `SameSchedule` (order-insensitive; an explicit closed day is **not** equal to an
open one) and `BranchIdsWithOwnHours` (the Cosmos-only short-circuit).

**Read sites:** the public availability endpoint · the provider availability route · the search
**UNION** across active branches (`AzureSearchIndexer.GetAvailabilityInfoAsync`,
`ProviderSearchIndexer.ResolveIndexedAvailabilityAsync`) · voice
(`BookingTools.EvaluateWorkingHours` at two call sites, + `DescribeBranchHoursAsync`) ·
`FullProviderContextService.ResolveHoursAsync`.

‼️ **Per-branch TIME ZONES are explicitly OUT OF SCOPE** (§8.7). The column is trivial but every UTC
path would have to resolve the branch first. Cross-timezone providers run two businesses (L26).

‼️ **`GET /business/availability` takes an optional `?branchId=` and its RESPONSE SHAPE IS UNCHANGED**
(**CP1**). A location with no rows of its own reads back the BUSINESS rows — the hours it inherits —
**UNTAGGED. Whether a returned row carries the requested `branchId` is the ONLY signal for "has its own
hours"**, and that is what makes the pre-filled grid structural rather than a second request.
`useBusinessHours: true` **DELETES** the location's rows rather than copying the business grid.

### 9.4 The SQL-outage split — opposite answers on purpose

- ‼️ **A location lookup NEVER fails a service-area (Cosmos) write** (**CP4**). On any failure the area
  attaches to the whole business and logs a Warning. Making SQL a hard dependency of a Cosmos write
  shipped a `400 "The ConnectionString property has not been initialized"` — precisely the failure
  **L94** was locked to prevent. Falling back to `null` is also the **safe** answer for a
  client-supplied id: unverified it could name another tenant's branch, and storing it would be a
  tenant-isolation hole. **Untagged cannot be.**
- ‼️ **The per-location HOURS request REFUSES when the directory is unavailable** (**CP5**), because
  writing a row tagged with an unverified id *is* the hole. And the business-wide path **never consults
  SQL at all** — so every request a single-location provider makes cannot be broken by a SQL outage.

### 9.5 `IBranchDirectory` vs `IBranchResolver`

| | Needs | Usable in MCP? |
|---|---|---|
| `IBranchResolver` / `BranchResolver` | `IServiceAreaRepository` + `IMemoryCache` (Cosmos only) | ✅ yes |
| `IBranchDirectory` / `BranchDirectory` | `IDbContextFactory<AppDbContext>` | ❌ **no — the MCP host has no SQL** |

`IBranchDirectory` exposes `GetActiveBranchIdsAsync` and `GetActiveBranchesAsync` (the latter projects
two extra columns on the **same** indexed seek — no new index).

‼️ **Branch identity reaches the MCP host inside the `warm-context` POST that already fires while the
caller's phone rings** (**L113**, owner-approved) — **not** over a new endpoint and **not** by giving MCP
SQL. `Clinqet.Mcp\Context\WarmedBranchDirectory` implements the same interface over `IMemoryCache`
(`Size = 1`), so `FullProviderContextService` is host-agnostic: one code path, two transports.
**Degradation is safe by construction** — no `branches` in the body ⇒ empty cache ⇒ the permissive
hours **UNION**, never "closed".

### 9.6 The AI-facing shape (L114) — do not undo this

The owner's binding condition was *"make sure it is super easy and not confusing at all for AI"*:

1. **At 0 or 1 branch, and whenever every active branch resolves to the SAME grid, the branch block does
   not exist** — no key, no sentence, no token. The model never learns the word "location".
2. **`WeeklyAvailability` IS the default branch's hours**, pre-resolved, so every existing instruction
   sentence stays true **with no rewording**.
3. **`ProviderContextLocation` carries a NAME and finished HOURS** — no id, no `isDefault`, no
   "inherits" marker, no nulls.
4. **Only branches that actually DIFFER from the default are listed.**

---

## 10. MEMBER LIFECYCLE AND OWNERSHIP TRANSFER

`IMemberLifecycleService` + `BusinessMemberController` (`api/v1/business/members`).

List (with **`IgnoreQueryFilters`** so a deactivated person is shown as deactivated rather than
vanishing) · suspend · reinstate · **remove-as-workflow** · update roles · the full ownership transfer
(get / initiate / accept / cancel / **remind**).

### 10.1 Removal is a workflow, not a delete

Suspend → revoke sessions → enumerate operational ownership → reassign or release → transfer
shared-inbox ownership → remove from teams and branches → **PRESERVE historical actor attribution** →
mark `Removed` → write the `AccessChangeQueue` row.

- ‼️ **The primary owner can be neither suspended nor removed** — this closes **L54**, deferred since
  Phase 2.
- Removal releases conversations, watches and bookings in **bounded batches**
  (`ReassignmentBatchSize` 50, `MaxReassignmentItems` 1000) and reports **`ReachedBatchCeiling`** rather
  than truncating silently.
- `RemoveAsync` accepts an optional **`reassignToMembershipId`** (4th parameter, before the
  cancellation token — every existing call site had to move to `cancellationToken:` named form), and a
  named successor is validated through **`IBusinessAssignmentGuard`** first. The successor **replaces**
  the leaver in place rather than being appended, so a thread they already held is not listed twice.
- ‼️ **`MemberRemovalResultDto` carries PAIRED counters** (**A1**): `ReassignedBookings` /
  `ReleasedBookings`, `ReassignedConversations` / `ReleasedConversations`, `ReassignedWatches` /
  `RemovedWatches`, plus `ReassignedToMembershipId` (null ⇒ the work went to the shared queue). One
  counter cannot say which outcome happened. `ReassignedQuotes` / `ReassignedLeads` remain and remain
  **0** — quote and lead assignment does not exist (**L108**).
- `GET /business/members/{id}/removal-impact` → `MemberRemovalImpactDto` states the holdings **before**
  the confirm button (**A2**), reusing the exact single-partition reads `RemoveAsync` already performs
  and reporting `ExceedsBatchCeiling`. ‼️ **"Open quotes" is deliberately absent** (**A4**) — a "0" row
  would advertise a feature that does not exist.

### 10.2 Ownership transfer

Initiate → **step-up re-authentication** → target accepts → move the primary-owner role → append to
`BusinessOwnershipHistory` → queue `BusinessOwnershipTransferred` for **both** parties. State lives in
four `Business` columns; a lapsed transfer leaves the original owner with everything.

‼️ **Step-up uses `IPasswordHasher<UserProfile>.VerifyHashedPassword` directly** (**L110**) — the Main
API does not host ASP.NET Identity, and this is the exact primitive `UserManager.CheckPasswordAsync`
wraps. ‼️ **Lockout counters are deliberately UNTOUCHED**: this re-authenticates an already-authenticated
session, so a fat-fingered password while transferring ownership must not lock the owner out of the
platform.

‼️ **`POST /business/members/ownership-transfer/remind` needed its own durable `EventId` or it would
have been a button that does nothing** (**A3**). `membership:{id}:initiated` is deterministic, so a
re-dispatch is swallowed by the delivery idempotency store.
`NotifyOwnershipTransferRemindedAsync` emits `membership:{id}:reminded:{key}` where the key is
`{initiatedAtTicks}-{floor(elapsedMinutes / cooldownMinutes)}` — **stored data plus a bucketed clock,
never a GUID** (L88). `IOwnershipTransferReminderThrottle` (singleton, `Size = 1`, keyed **per
business**) guarantees two reminders are at least one cooldown apart. **No new `NotificationType`.**

### 10.3 Expiry sweep

`ITenancyExpirySweeper` + `TenancyExpirySweepFunction` (timer,
`%Tenancy:Lifecycle:ExpirySweepCron%`, hourly). Expires pending invitations (releasing seats and
**rotating the hash so the emailed link dies**) and lapsed ownership transfers.

‼️ **It is its own service, not methods on the invitation or lifecycle service** (**L109**). Putting
`ExpireDueInvitationsAsync` on the invitation service would force the Functions host to register
`IBusinessSeatService` → `IEntitlementService` → `ICountryResolutionService` → two Cosmos repositories
purely to expire a row. ONE timer covers both deadlines, each independently try/caught.

---

## 11. THE D4 ACCESS-CHANGE OUTBOX

```
AccessChangeQueue (SQL, same transaction as the change)
  -> AccessChangeDispatcher.DispatchPendingAsync
  -> Service Bus queue `access-changes`   (MessageId = the row id, so the namespace deduplicates)
  -> AccessChangeProcessorFunction
  -> AccessChangeApplier
```

Timer: `AccessChangeDispatcherFunction` on `%Tenancy:AccessChange:SweepCron%` (default every minute).
`DispatchBatchSize` 100 per sweep, `MaxDispatchAttempts` 5 then an admin alert — **never an unbounded
retry loop**.

‼️ **The Functions host is the ONLY carrier.** Rows are written by the Main API, the Identity host
(self-serve provisioning at first sign-in) and the Functions host alike, and **no writer dispatches
inline** — three comments claimed the API did until 2026-08-07; it never has. A change is therefore live
within one `SweepCron` tick, and if that timer stops, every revocation stops with it.

‼️ **`AccessChangeDispatcher` and `AccessChangeApplier` take `IAuthorizationCacheSignal`, NEVER
`IAuthorizationSnapshotProvider`.** They only ever call eviction, and the provider drags `AppDbContext` +
`IMemoryCache` + `TenancyMetrics` into hosts that authorize nothing. `TenancyMetrics` is registered only
by `AddTenancyAuthorization()` (Main API only), so from the day it shipped **both access-change functions
failed DI activation once a minute, in every environment**, and the entire D4 pipeline had never once run
(2026-08-07). See `ServiceRegistrationSelfContainmentTests`.

‼️ **Per-row failure isolation is mandatory.** A send retries, alerts, then **throws** — so without per-row
isolation one bad row aborts the batch, every row queued behind it never attempts, and no attempt count
persists (an unbounded retry loop by accident). Each row is now wrapped individually.

‼️ **`SendMessageAsync` / `SendMessageWithSessionAsync` / `SendNotificationAsync` return `Task`, NOT
`Task<bool>`** (fixed 2026-08-07). They could only ever return `true`, and that lie is what produced the
dispatcher's unreachable `else`. `SendBatchAsync`, `CancelScheduledMessageAsync` and
`PublishMediaDerivativeAsync` KEEP their bool — they genuinely return `false`. Pinned by
`ServiceBusContractTests`; never widen it onto the three that report failure meaningfully.

### 11.0 Retention — the outbox is PURGED, not infinite

`ITenancyExpirySweeper.PurgeDispatchedAccessChangesAsync`, run by the existing hourly
`TenancyExpirySweepFunction` (no new timer, no new Azure resource). `Tenancy:AccessChange:RetentionDays`
30 · `PurgeBatchSize` 1000 · `MaxPurgeBatchesPerRun` 10.

- **Set-based `ExecuteDeleteAsync`** — one SQL statement, no materialisation, no change tracking.
- ‼️ **Deadlock-free by construction**: the purge touches only `DispatchedAt IS NOT NULL`, the dispatcher
  only `DispatchedAt IS NULL`. Disjoint row sets, different indexes, no lock cycle is possible.
- Batches of 1000 stay under SQL Server's ~5000-lock escalation threshold, so a purge never takes a table
  lock and never blocks an insert. **Never parallelise it** — concurrent deletes on one table/index
  manufacture the contention this design avoids.
- ‼️ **Abandoned rows are deliberately NOT purged.** They are un-propagated revocations, i.e. evidence.
- The purge is what justifies `IX_AccessChangeQueue_DispatchedAt`. `IX_AccessChangeQueue_DedupKey` was
  dropped (migration `20260807204936_DropDeadAccessChangeDedupKeyIndex`) — `DedupKey` is written but
  never queried, and the index was non-unique so it enforced nothing; the real dedup is the Service Bus
  `MessageId` + queue duplicate detection.

‼️ **Only FOUR event types revoke refresh sessions** (**L64**): `MembershipSuspended`,
`MembershipRemoved`, `BusinessStatusChanged`, `BusinessOwnershipTransferred`. Role, team and branch
changes **evict but never revoke** — a role change re-scopes access rather than removing it, and the
`AuthorizationVersion` bump already makes the old token stale on its next request.

‼️ **`AccessChangeQueue.DedupKey` is version-qualified**: `{EventType}:{MembershipId}:v{AuthorizationVersion}`
(**L112**). Two role edits are two distinct facts and must not collapse; a redelivery of one still must.
Staged centrally in `AccessChangeStaging` so the version bump and the queue row can never be written
apart — the failure modes being prevented are a bump with no row (other instances stay stale) and a row
with no bump (the cached snapshot stays reachable).

‼️ **`AccessChangePayload` carries the SUBJECT's `UserId`, never the ACTOR's** — which is why "who
suspended/removed this member" needed two columns on `BusinessMembership` and had **no answer anywhere
in the platform** before them.

### 11.1 The backlog health check

`AccessChangeBacklogHealthCheck` → check `access_change_backlog`. ‼️ **A stalled dispatcher is the
quietest failure on the platform**: no request fails, nothing logs an error, and a removed employee
simply keeps working until their token expires.

‼️ **It lives in the FUNCTIONS host, not the API** (moved 2026-08-07). A check belongs to the host that
can act on it: the API can neither cause nor fix a stalled sweep, so reporting it there only ever took
the API out of rotation for another host's fault — and failed clean API deploys for hours. It is
registered **non-critical** there, so the Functions host keeps draining every other queue while a human
acts. **Do not add it to the API, the Identity host or the MCP host.**

- **AGE of the oldest DISPATCHABLE row, never the count** — a big batch draining normally is healthy;
  one row stuck for an hour is not.
- ‼️ **Abandoned rows (`AttemptCount >= MaxDispatchAttempts`) are EXCLUDED from that age and counted
  separately.** The predicate must match the dispatcher's work-set, or a terminal row the dispatcher will
  never revisit pins the check red forever — an alarm with no off switch stops being an alarm.
- ‼️ **EVALUATE BOTH BRANCHES — never `return` on the abandoned count (fixed 2026-08-08).** The original
  rewrite got the predicate right and the control flow wrong: it returned Unhealthy as soon as
  `abandoned > 0`, which made the age-based stall branch **unreachable**. Because abandoned rows are
  deliberately never purged (they are evidence) and the dispatcher skips them forever, ONE abandoned row
  latched the check red permanently *and blinded it to a later genuine dispatcher stall* — the exact fault
  it exists to catch. The check now reports the union of both faults, worse status winning. **A correct
  predicate behind an early return is still a check that cannot see.**
- **One round trip**: a single grouped SELECT returns both the age and the abandoned count, binding the
  filtered **`IX_AccessChangeQueue_Undispatched`**, so an idle queue scans an empty index.
- Wrapped in `CachedHealthCheck<T>` (`HealthChecks:ExternalCacheSeconds`) — `/health` is polled by deploy
  gates and monitors, and uncached it cost a SQL round trip plus an ERROR log line on every poll.
- Thresholds: `HealthChecks:AccessChange:TimeoutSeconds` 10 · `DegradedAfterSeconds` 300 ·
  `UnhealthyAfterSeconds` 900.

### 11.2 The three health tiers (all four .NET hosts)

`Clinqet.Shared.Constants.HealthTags` — mixing these is the classic outage, because each failure has a
different consequence.

| Endpoint | Question | Consumer | On failure |
|---|---|---|---|
| `/health/live` | is the process wedged? | platform restart | **restarts** — so it NEVER touches a dependency |
| `/health/ready` | can THIS instance serve? | load balancer, **deploy gate** | out of rotation |
| `/health` | how is everything? | humans, alerts | page someone; never gates automation |

Ready-tagged: API → `cosmos_database` + `sql_database`; Identity → `sql_database`; MCP → `cosmos_database`;
Functions → `sql_database` + `cosmos_database` + `service_bus`. The .NET repos' deploy gates poll
`/health/ready` (`/api/health/ready` on the Functions host, which has the Functions route prefix).
Region-safe: the base URL comes from the per-stamp `HEALTH_CHECK_URL_{ENV}_{REGION}` secret, only the path
is shared.

‼️ **`failureStatus:` applies ONLY when a check THROWS.** A returned `HealthCheckResult` is used verbatim,
so a check whose body does `return HealthCheckResult.Unhealthy(...)` **silently overrides its own
registration**. Six registrations declaring `Degraded` were no-ops until 2026-08-08 — a transient blob
blip 503'd the whole API despite the registration comment saying it must not. Every shared check now
returns `context.Failure(...)` (`HealthChecks/HealthCheckContextExtensions.cs`), which reads
`context.Registration.FailureStatus`, so the REGISTRATION is authoritative on both paths. **Never
hardcode `HealthCheckResult.Unhealthy` in a shared check** — the same class is registered at different
tiers by different hosts.

‼️ **A health check that performs no I/O cannot detect a fault.** `ServiceBusHealthCheck` awaited only
`Task.Delay(1)` and returned `true`, with two unreachable `catch` clauses — a firewalled namespace, a
rotated SAS key or a deleted queue all reported **Healthy**, while it was `Ready`-tagged on the Functions
host. It now calls `sender.CreateMessageBatchAsync(...)`, which negotiates the AMQP link and needs only
**Send** rights (`ServiceBusAdministrationClient` needs Manage; a receiver peek needs Listen — the API
host only sends). ‼️ `ServiceBusMessageBatch` is `IDisposable`, **not** `IAsyncDisposable` — `using`, not
`await using`. Because it now does real I/O it is wrapped in `CachedHealthCheck<T>`; the `Ready`-tagged
Functions registration uses the shorter `ReadinessCacheSeconds`, since a readiness signal must not be a
minute stale.

### 11.3 Startup DI validation

All four .NET hosts set `ValidateOnBuild` + `ValidateScopes`. Hand-built test graphs (`new TenancyMetrics()`)
prove a class works when handed everything and can **never** prove the container can build it, which is
exactly why the D4 outage survived 13,764 green tests.

‼️ **The rule is a DEPENDENCY CONTRACT, not blanket self-containment.** "Every extension composes from host
primitives alone" is too strong and the source says so: `AddBusinessSeatServices` needs `IEntitlementService`
from `AddPaymentServices`, and `AddTeamManagement` needs the seat engine, the recipient resolver and the
tenant context. So each extension declares its **prerequisite extensions + host-provided externals**, and the
guard proves that set is exactly sufficient. That still catches the D4 shape — an extension growing a
dependency outside its declared set fails the test instead of production.

`ServiceRegistrationSelfContainmentTests` (2026-08-08) now covers **all 13** extensions in
`clinqetinfrastructure/Configuration/`. Three properties make it more than decoration:
- **the must-resolve set is DERIVED**, by marking `services.Count` before/after and resolving every
  `ServiceType` added in between, with `Assert.NotEmpty` — a hand-written list rots the way the defect did;
- **externals are faked at their REAL production lifetime, defaulting to Scoped** — the strict choice, because
  a Singleton depending on a Scoped external is precisely the captive dependency `ValidateScopes` must catch;
- **a minimality self-test**: remove each declared external in turn and assert the composition FAILS, so a
  stale or over-broad declaration cannot survive.

‼️ **A guard belongs in the repo whose composition it builds (§0.15), because the SAME extension composes with
DIFFERENT externals per host.** `Clinqet.Communications/Program.cs` was built by **no test at all** — its
integration fixture hand-rolls a `ServiceCollection` and calls none of the real extensions — which is the
2026-08-07 condition still open in the host the outage happened in. The Functions host now has its own copy,
whose host primitives include `AddAppDbContextPooled` (so `IDbContextFactory<AppDbContext>` is a primitive
there but an external in the API repo). **Do not "share" one guard across repos** — the exemption and
externals sets are per-host policy.

‼️ Two comments this guard proved wrong, both harmless today but load-bearing if anyone trusts them:
`PaymentServiceRegistration.cs:21-24` claims the payments stack is self-contained bar `ICountryResolutionService`
— it actually **cannot compose without** `AddNotificationRouting` (five services take
`IBusinessCommunicationDispatcher`) and transitively `AddBusinessActivityFeed`. And
`TenancyServiceRegistration.cs:139-141` says `AddTenancyExpirySweeps` "needs only the DbContext and the
notifier" — the notifier itself pulls `IBusinessCommunicationDispatcher`.

‼️ **NEVER let a singleton take a scoped dependency.** Enabling these flags immediately crash-looped the
dev Functions host and exposed two live captive dependencies: `FunctionsCatalogIsolationAlarm`
(`ICatalogAlarm`) held the scoped `FailureNotificationHelper` → `ICommunicationDispatcher`, and
`McpSessionSignalClient` held the scoped `IBranchDirectory`. A singleton capturing a scoped service pins
**`AppDbContext` — which is NOT thread-safe — alive for the whole process**. Both were fixed by
correcting the LIFETIME to `AddScoped` (their only consumers are scoped), **not** by injecting
`IServiceScopeFactory` and not by turning the flags off. Reach for `IServiceScopeFactory` only when a
genuinely process-long singleton must touch scoped state — `CachedHealthCheck<T>` is the example.

‼️ **To debug a Functions startup crash without Azure access**: set every value from
`local.settings.ca.json` as a process env var and run `dotnet Clinqet.Communications.dll` directly.
`builder.Build()` runs before the gRPC connect, so the full DI validation error prints. Getting as far as
`Functions:Worker:HostEndpoint is missing` means validation PASSED.

‼️ **`AddCheck<T>()` resolves T through `ActivatorUtilities`**, so a health check taking a settings POCO
throws at startup — take `IOptions<HealthCheckSettings>` instead.

---

## 12. TENANT ISOLATION — the three holes this programme found and closed

### 12.1 The provider inbox was completely EMPTY (L99, casebook CASE 1)

**Four** service-layer writers stored the provider-side `Conversation` under the **`BusinessId`**
partition while **the two controllers read the person's `UserNumber`** partition. Phase 1 made those
values differ, so for every tenancy-path provider there were **no leads, no bids, no WhatsApp, no
customer chats.** 13,515 tests passed — every unit test built a context where the two values were
identical.

‼️ **It was NOT a data re-key.** `GenerateConversationId` **sorts** the participant pair before hashing
and both sides already passed `(businessId, customerUserNumber)`, so the ids already matched and every
document was already in the right partition. Re-keying "both sides" would have **moved correct
documents** and broken the customer mirror.

Fixed with ONE helper — **`BaseController.GetCurrentConversationParticipantId()`** — at all **15** sites
(`ConversationController` 11, `MessageController` 4). A read receipt addressed to a business is expanded
to its members through **`IBusinessMemberDirectory`** before SignalR delivery, and
`MarkConversationAsReadResult` gained `OtherParticipantType` so the expansion is decided by the
participant **TYPE**. ‼️ **A length heuristic was written and REJECTED** — seeded ids like
`TEST-BUSINESS-001` defeat it, and the document already carried the truth.

### 12.2 A client could assert a `BusinessId` in a request BODY (H3)

‼️ **`[RequiresPermission]` guards the route, the header and the query. It CANNOT guard a body**, because
the body is not read until model binding runs *after* the authorization filter.

`CreateInvoiceRequestDto` carried a `[Required] BusinessId`; `InvoiceService` used it as the **Cosmos
partition key** and `InvoiceMappingExtensions` stamped it onto the document. **A member of Business A
with `invoice.create` could POST an invoice into Business B's `Transactions` partition.**

**How it hid:** `InvoiceController.CreateInvoice` *does* call `GetCurrentBusinessId()`, so the code reads
as tenant-aware — but the value was used only for a customer-identity-sync side effect, never for the
write. And every test passed the same value in the token and the DTO, so the two could never diverge.
**13,764 tests were green over it.**

**Fixed structurally:** the field is **deleted**; the workspace is threaded from the signed token through
`IInvoiceService.CreateInvoiceAsync` and `ToInvoice`. Overwriting `dto.BusinessId` from the token was
considered and **rejected** — it closes the hole but leaves correctness depending on remembering to
overwrite forever. Deleting the field makes the assertion **inexpressible**.

‼️ **The durable guard is a convention test, not a code review:**
`ProviderEndpointAuthorizationTests.NoProviderEndpointAcceptsABodyThatAssertsABusinessId` reflects over
every `[RequiresPermission]` action's `Clinqet.Shared.DTOs.*` parameters and **fails the build** on any
settable `BusinessId`. **It found this hole on its first run.** `BusinessName` deliberately remains — it
is display copy, not a tenant boundary.

### 12.3 Voice live transcripts never arrived (Phase 7)

The SEND side was already business-keyed (`voicelive:{businessId}`) while
`NotificationHub.WatchVoiceLive()` joined `voicelive:{UserNumber claim}`. **No test covered it.** Found
by **tracing the group name end to end** rather than reading the phase file's description of it.

`WatchVoiceLive()` now reads the signed `BusinessId` claim and requires **`voice.livecall.join`** plus
`BusinessAccessScope.Full`. `UnwatchVoiceLive()` is deliberately **not** permission-gated so a
membership that just lost the grant can still unsubscribe. **Zero client change was needed** — both
provider apps `invoke('WatchVoiceLive')` with **no arguments**.

‼️ **`NotificationHub.StartVoiceWatchRevalidation`** re-checks the cached snapshot on an appsetting
cadence (`SignalRSettings:VoiceLiveWatchRevalidationSeconds`, default 60 s) and **the server** removes
the connection from the group (**L120**), so a client that stops calling in cannot evade it. It needs no
distributed cache: **a SignalR connection is server-affine.** ‼️ `IAuthorizationSnapshotProvider` is
**scoped**, so the loop resolves it per pass via `IServiceScopeFactory`.

### 12.4 The cross-tenant matrix — 39 permanent cases

`Clinqet.API.IntegrationTests/Controllers/CrossTenantAuthorizationTests.cs`. **Every row runs through
the REAL pipeline**: JwtBearer → `TenantContextMiddleware` → `RequiresPermissionAttribute` → the action.
It is a permanent, always-run suite — the regression net for every future change.

Covered: another business's booking · route / header / **body** mutated · removed member with a valid
token · suspended member with a valid token · a contractor replaying a previous workspace's resource URL
· a team-scoped member reading another team's conversation · an assigned-only member requesting an
unassigned booking · a customer token on a provider endpoint · another business's payout · an
administrator attempting ownership transfer · Finance attempting a payout-account change · a suspended
member's **cached** snapshot after suspension · zero bleed for a member of two businesses · a refund on
one's own booking · an invitation replayed after acceptance · an invitation accepted by a different email
· a voice call bound to A reaching B · an MCP tool call with a mismatched claim · a customer learning
which employee is assigned (**must NOT** — `[System.Text.Json.JsonIgnore]` on all nine assignment and
attribution fields).

‼️ **`ABillingOnlyToken_Is403OnEveryOperationalSurface` is a `[Theory]` over 13 operational paths** — D9
is *enumerated*, never trusted to a UI that hides links.

### 12.5 The MCP guard is the platform's oldest tenant check

`clinqetmcp\Clinqet.Mcp\Middleware\McpChannelAuthMiddleware` rejects unless
`session.BusinessId == claims.BusinessId`; `Monitor\PlivoVoiceRelay` performs the same equality against
the binding document. **Extended, never relaxed.**

---

## 13. NOTIFICATION ROUTING (summary — full detail in `clinqet-notifications`)

A **recipient-resolution layer sits IN FRONT of** `CommunicationDispatcher`. The dispatcher and
`NotificationProcessor` both stay **single-recipient** (L4, L5, L93) and are invoked once per resolved
recipient.

`INotificationRecipientResolver` → `IBusinessCommunicationDispatcher`, with
`Clinqet.Core.Services.Communication.NotificationRoutingCatalog` exhaustively classifying **all 129**
`NotificationType` values. ‼️ **`NotificationRoutingCatalogTests` FAILS THE BUILD** if any type lacks a
descriptor — and it keeps **its own hand-written map**, so a new type needs **THREE** additions: the
enum, the catalogue, **and `BuildExpected()` in the test**. Plus a
`SignalRSettings:EnabledNotificationTypes` entry and a `CommunicationPreferenceConfig` category mapping.

### 13.1 D5's routing model

```
NEW lead / booking / quote  -> ALL active members with the permission + admin (always)
A member ACCEPTS / CLAIMS   -> that member becomes the assignee
EVERY follow-up             -> the ASSIGNEE + admin (subject to the admin's own toggles)
```

| Class | Recipients |
|---|---|
| Personal security | the affected person only. **Zero business queries** |
| Business security | admin + affected member |
| Financial | admin + Finance + configured financial admins |
| New work intake | all active members with the permission + admin |
| Assignment / task | assignee + assigned team + watchers + admin |
| **Direct message** | ‼️ **that member ONLY. NEVER the admin** — private correspondence (L21) |
| Context message | assignee + watchers + admin; the shared-inbox team when unassigned |
| Awareness | **activity feed only** — no interruptive alert |

‼️ **A customer's message to a business routes as `ContextMessage`, not `DirectMessage`** (**L106**,
owner-approved). `ConversationContext.Direct` is what **EVERY** customer↔business chat uses, including
WhatsApp inbound, and the `DirectMessage` class resolves `DirectTargetMembershipId` and nothing else — so
on an unclaimed thread it resolved **ZERO recipients** and the provider was never told a customer had
written to them (casebook CASE 19). The `DirectMessage` **class is retained** (**L111**) because
`BusinessEventCategory.DirectMessage` is a SQL-persisted enum value and the branch encodes L21.

‼️ **An admin's OWN notifications are a SEPARATE preference surface, never affected by the team-activity
toggles.** Two independent surfaces, discriminated in one table by `IsTeamActivity` +
`AboutMembershipId` (**L86**), with three filtered unique indexes keeping the shapes disjoint —
`ResolveOwnPolicy` calls `.Single()`, so **do not relax them**.

### 13.2 Measured SQL budget per resolved event — do not regress these

`PersonalSecurity` **0** · `CustomerFacing` **0** · `Awareness` **0** · `BusinessSecurity` 4 ·
`Assignment` 4 · `DirectMessage` 4 · `Financial` 5 · `WorkIntake` 5 · `ContextMessage` 5.
Pinned by a real `DbCommandInterceptor` in `RoutingClasses_StayWithinMeasuredSqlQueryBudgets`.

### 13.3 The L94 / L119 guard is CONDITIONAL

**L94:** a business-notification dispatch never fails the business transaction that triggered it —
because the resolver performs a **SQL** read the pre-Phase-5 path never did, and
`BaseController.HandleLocalizedException` maps `InvalidOperationException` to **HTTP 400**, so an
unguarded dispatch turned an **already-persisted** booking transition into a client error (casebook
CASE 3).

‼️ **L119 corrects it: the guard applies ONLY where a business transaction is already persisted.** Where
the notification **is** the work product — `ProviderConfirmationProcessor`, whose entire message exists
to ask a member to confirm — swallowing completed the Service Bus message with **nobody asked**, and the
booking then timed out on the customer. **The mechanical test: name the row that is already committed.
If you cannot, do not guard.**

---

## 14. ‼️‼️ `SecurityAuditEvent` IS CLOSED — NEVER TO BE BUILT (H1)

`00-SOLUTION` §15 and **D10.3** both named a `SecurityAuditEvent` table. Phase 6 built it and **deleted
it before the migration was applied** (**L96**). Phase 9A presented the complete RULE ZERO table and
**the owner declined it.** **D10.3's audit-store requirement is WITHDRAWN.**

What ships instead: **one structured log line per privileged read** at
`AdminTenancyLookupController.Search`, `.GetPerson` and `AdminProviderController.GetMembers` —
actor · subject · outcome, and ‼️ **never the search text, which is somebody's email or phone number.**

**Alternatives weighed and rejected on the record:** a provider notification (no correct recipient, and
support opening a member list is normal ticket work); an admin alert per lookup (one per lookup trains
ops to ignore alerts, making the platform *less* safe); the business activity feed (the provider can
**see** it, so a fraud investigation would tip off the subject; it self-deletes at 90 days; and being
partitioned per business it cannot answer *"what did this agent look at across ALL businesses"* without
a forbidden cross-partition query).

‼️ **AP-1 is UNCHANGED and must stay unchanged:** the admin portal claims nothing about a view being
recorded, and `TenancyLookupPage.test.js`'s *"never claims that opening a member list is recorded"* must
keep passing.

‼️ **A LATER SESSION MUST NOT TREAT THE ABSENCE OF THIS TABLE AS A GAP.** Same standing as **B15**.

---

## 15. OBSERVABILITY — `TenancyMetrics`

`Clinqet.Infrastructure.Observability.TenancyMetrics` is ‼️ **the platform's FIRST
`System.Diagnostics.Metrics.Meter`** — before it, `grep` for `new Meter(` / `CreateCounter` / `AddMeter`
returned nothing anywhere. Meter name `Clinket.Tenancy`, exported by `.AddMeter(...)` in the Main API's
existing `WithMetrics` block (**H6**).

| Signal | Instrument |
|---|---|
| Snapshot cache hit rate | `clinket.authorization.snapshot.lookups{result}` (hit/miss/stale/denied) |
| Membership lookup latency | `clinket.authorization.membership.lookup.duration` (ms histogram) |
| Permission denials · **cross-tenant mismatch attempts** | `clinket.authorization.denials{reason,permission}` — the mismatch is `reason=business_context_mismatch` |
| Sensitive-operation live re-checks | `clinket.authorization.live_rechecks{outcome}` |
| `AccessChangeQueue` backlog | the health check's `data.oldestPendingSeconds` |

‼️ **HARD RULE, encoded in the class comment: no tag may carry a `businessId`, `membershipId` or
`userId`.** Those are unbounded, and unbounded metric cardinality is a **cost incident**. The permission
key is a fixed catalogue of 89, so it is safe.

**Deliberately NOT application metrics:** RU per business, hot partitions, Service Bus dead-letter count
and oldest-message age are **Azure platform metrics** — no application code can produce them better.

**Deliberately NOT instrumented, and named rather than dropped:** unassigned conversation count,
time-to-claim, 412 collision rate, businesses at/near `team.seats`, invites blocked by limit. These are
**inbox and billing product metrics, not tenancy-security signals** — Phase 12 decides.

---

## 16. SEED DATA

`cosmosindexsetup\DataSeeding\`:

- `UserSeeder.CreateBusinessWithOwnerAsync` allocates a `BusinessId` and creates Business + Owner
  membership + Primary Owner role **atomically and idempotently**, guarded by `ownedBusinessByUserId`.
- `SeedDbContext` gained `SeedBusiness`, `SeedBusinessMembership`, `SeedBusinessMembershipRole`.
- `ProviderDataSeeder` keys Cosmos docs on `user.BusinessId`; profile-picture blob paths moved from
  `UserNumber` to `BusinessId`.
- ‼️ **`TenancyFixtureSeeder` seeds ONE multi-member business (Operations Manager + Technician) and ONE
  contractor holding live memberships in TWO businesses** (**H7**). Before it, **every** seeded provider
  was a single owner, so **no local environment had ever exercised the multi-user model** — which is
  precisely how a tenancy defect stays invisible until a real customer hits it. Idempotent by checking
  for a live membership first, because `UX_BusinessMembership_Business_User_Live` would otherwise make a
  re-run throw.
- ‼️ **Seeded providers get `UserUserType = "Partner"`, not `"Provider"`** (**L45**). `"Provider"` is
  not a `UserType` value, so `Enum.TryParse` dropped it and every seeded provider had **zero** user types
  and could not sign in. Note `UserUserType.UserType` is a **`string` column** and `Id` is a `Guid`
  **with no default**.
- ‼️ **`cosmosindexsetup` IGNORES the shell `CLINKET_REGION`** — always pass `--launch-profile`.
- ‼️ **`SeedCity` lives in `ClinqetCosmosAIIndexSetup.DataSeeding.SeedTemplates`**, not the parent
  namespace.

---

## 17. SETTINGS (defaults mirror the options classes exactly)

**`Tenancy:*` — Main API** unless noted:

| Key | Default |
|---|---|
| `BusinessId:{Alphabet,Length,MaxAllocationAttempts,InitialBackoffMs,MaxBackoffMs}` | A-Z0-9 · 6 · 10 · 100 · 5000 |
| `BusinessCreation:{MaxPerWindow,WindowHours,LockTimeoutMs}` | 3 · 24 · 5000 |
| `Seats:DefaultLimit` | 3 |
| `Authorization:SnapshotCacheSeconds` | **60** |
| `AccessChange:{DispatchBatchSize,MaxDispatchAttempts}` + `SweepCron` (Functions) | 100 · 5 · `0 */1 * * * *` |
| `Activity:{RetentionDays,DefaultPageSize,MaxPageSize}` | 90 · 25 · 100 |
| `Branch:AreaMapCacheSeconds` | 300 |
| `Invitations:{ExpiryHours,TokenBytes,MaxPerBusinessPerWindow,WindowHours,ResendCooldownMinutes,EnableAdminAlertOnRejectedAccept,MaxAcceptAttemptsPerWindow,AcceptAttemptWindowMinutes}` | 168 · 32 · 25 · 24 · 5 · true · 10 · 15 |
| `Lifecycle:{ReassignmentBatchSize,MaxReassignmentItems,OwnershipTransferExpiryHours,OwnershipTransferReminderCooldownMinutes,ExpirySweepCron}` | 50 · 1000 · 72 · 5 · `0 0 * * * *` |
| `Inbox:{DefaultPageSize,MaxPageSize,DefaultSlaHours,SlaHoursLead,SlaHoursQuote,SlaHoursBooking,SlaHoursDirect}` | 25 · 100 · 24 · **2 · 4 · 8 · 24** |
| **`BusinessContext:{MaxExchangesPerWindow,WindowMinutes}` — IDENTITY host** | 20 · 5 |
| **`HealthChecks:AccessChange:{TimeoutSeconds,DegradedAfterSeconds,UnhealthyAfterSeconds}`** | 10 · 300 · 900 |

`Notifications:*` — see `clinqet-notifications`.

‼️ **The ARM / `deploy.ps1` rule, and it is narrower than people assume.** Only a
**`local.settings.json`** entry (a Functions *trigger-binding* setting) or a new Azure resource needs an
ARM + `deploy.ps1` entry. An **appsettings-only** key does not. So `access-changes` and
`notification-digests` (queues) and the two `*Cron` values **are** in both artefacts;
`Tenancy:BusinessContext:*`, `HealthChecks:AccessChange:*` and
`Tenancy:Lifecycle:OwnershipTransferReminderCooldownMinutes` correctly are **not**.

---

## 18. ‼️ THE HAZARD LIST — read this before you touch anything

### 18.1 Things that look right and are wrong

1. ‼️ **A capability with ZERO callers reads as done.** `IResourceScopeEvaluator` was fully built and
   unit-tested across all seven scopes and called from **no controller** until Phase 4 wired it.
   `GetLiveAsync` was fully built, **proved against a real SQL Server**, and called from **no production
   code** until Phase 9A. **Both were correct code that protected nothing.** Casebook CASE 20.
   **Grep for a caller before believing a guard exists.**
2. ‼️ **A reader with no writer is a dead predicate.** The seat count branched on
   `MembershipStatus.Invited`, which **nothing ever creates**. Grep for the **writer** of every enum
   value, status and flag your logic branches on.
3. ‼️ **A private helper inserted BETWEEN an attribute block and its action steals the route
   attribute.** It compiles, unit tests pass, and it returns **405 in production**. Guard:
   `Conventions\RouteAttributesBindToPublicActionsTests`.
4. ‼️ **The Identity host is `QueryTrackingBehavior.NoTracking` GLOBALLY.** A mutated read there
   persists **nothing** and the endpoint returns **200 OK**. Use `.AsTracking()` for anything you will
   mutate. `Remove()` on a detached entity DOES work, so a delete path can hide this while an update
   path silently no-ops.
5. ‼️ **`BusinessAccessScope` has NO `None`, and adding one is NOT a free safety win.**
   `RequiresPermissionAttribute` and `NotificationRecipientResolver` both branch on `== BillingOnly`, so
   `None` would fall into the **permissive** branch and behave *less* restrictively than `BillingOnly`.
   `NotificationHub` already uses the safe positive form. **Convert those two sites to `== Full` first,
   or leave the enum alone.**
6. ‼️ **`GET /business/availability` threw a 500 the moment any location overrode** (**CP7**) — the
   handler keyed the raw partition by `DayOfWeek` alone, but the partition holds one row per day **per
   location**, so `ToDictionary` threw. **`ToDictionary` over a Cosmos partition is a latent 500 wherever
   a nullable discriminator exists.**
7. ‼️ **`ApiResponse<T>.Fail` has NO `errorCode` parameter.** `ErrorCode` is a settable property — set
   it after constructing.
8. ‼️ **`GrantsByRoleKey` maps to an `IReadOnlyList<(string, PermissionScope)>`, not a dictionary** —
   `grants.Keys` compiles as nothing; use `grants.Any(g => ...)`.
9. ‼️ **`PatchOperation.Remove` on an absent path is a 400 that takes the WHOLE patch down.** Clearing
   `slaDueAt` is therefore its own request guarded by `conditionExpression: IS_DEFINED(c.slaDueAt)`.
   `Set(path, null)` was rejected — it writes a JSON null, which keeps an index entry.
10. ‼️ **A screen can be registered in a router, claimed by a deep-link table, and still have NO way in
    from inside the app.** The entire provider-mobile team surface shipped unreachable across two parts.
    **Grep for a `navigate()`/`href`, and on mobile check PER STACK, never the union.**

### 18.2 Verification traps

1. ‼️ **`grep -c` EXITS 1 WHEN THE COUNT IS ZERO**, so
   `dotnet build … | grep -cE ": error" && dotnet test …` prints `0` and **silently skips the entire test
   run** — a false FAILURE that reads like a broken suite. And chaining with `;` instead of `&&` gives
   the inverse: a **stale assembly reporting `Passed!`** against a build that just failed. **Read the
   build result before the test result.**
2. ‼️ **A piped build masks MSBuild's exit code.** `dotnet build a.csproj b.csproj | tail -25` reported
   **exit 0** for a build that failed with `MSB1008`. **Read the build OUTPUT, never a pipeline's exit
   code.**
3. ‼️ **Building the production project is NOT evidence the test projects compile.** Adding a constructor
   parameter broke four sites the production build could not see.
4. ‼️ **Run the four Testcontainers suites SERIALLY** — `Clinqet.API.IntegrationTests`,
   `Clinqet.Identity.IntegrationTests`, `Clinqet.Communications.IntegrationTests` and
   `Clinqet.Mcp.IntegrationTests` each start their own containers and two at once collide on the
   Cosmos-emulator port **8081**. A **total-failure** pattern is an infrastructure signal, not a
   regression.
5. ‼️ **CRLF vs LF differs BETWEEN SIBLING FILES**, so a `\n` pattern silently matches zero. Always
   `\r?\n`, and **always state the EXPECTED count and fail the script when it differs** — printing the
   count is not enough. The count guard has fired **14 times** in this programme, and it earns its keep
   most when the count is **HIGHER** than expected: a low count means the edit did not apply and you
   notice; a high count means it applied where you did not intend and you do not.
6. ‼️ **A sabotage that bites in ONE app and not the other is a finding about your TESTS.** The app that
   stayed green is the one with the gap.
7. ‼️ **When two mechanisms produce the same outcome, assert the one under test by its distinguishable
   effect**, or the sabotage check is decorative.

### 18.3 Test-double traps

- ‼️ **`Mock.Of<IBusinessCommunicationDispatcher>()` is a silent hole.** The real dispatcher invokes
  `requestFactory` **once per recipient**; a bare mock never calls it, so every assertion about the
  *content* of a business notification passes **vacuously**. Use `BusinessDispatcherTestDouble` (unit) or
  `PassThroughBusinessDispatcher` (integration).
- ‼️ **For an `Awareness` producer, `Times.Never` on the raw dispatcher proves NOTHING** — it sits at
  zero whether the producer worked perfectly or never ran at all.
- ‼️ **A test double MORE permissive than production is as dangerous as one that is less.** The first
  `PassThroughBusinessDispatcher` invoked the factory unconditionally and manufactured a dispatch
  production never makes. **The double must model the routing RULE, not just the interface.**
- ‼️ **`MockAuthorizationSnapshotProvider` must be able to express a STALE cache.** It resolved
  `GetAsync` and `GetLiveAsync` from the same dictionary, so every §7.4 assertion would have passed
  **whether or not the endpoint re-checked**. It gained `RegisterLive(...)` and `LiveReadCount`.
- ‼️ **The API integration host has NO SQL container**, so `IAuthorizationSnapshotProvider` is doubled
  there (**L70**) and the SQL semantics are proved separately against a **real** SQL Server in
  `AuthorizationSqlTests`. Only the LOOKUP is doubled — the middleware, the attribute, the D9 gate, the
  mismatch guard and `BusinessAccessPolicy` are all production code in those tests.
- ‼️ **`SeoSqlFixture` is shared**, so every real-SQL test file needs its **own `BusinessId` prefix**
  (`E` seats · `N` provisioning/notification-settings · `H` member handover · `Z` authorization).

### 18.4 Host capability matrix — the single most important architectural fact

| Host | SQL | `AddTenancyAuthorization` | `AddNotificationRouting` | `AddBusinessActivityFeed` | Actor |
|---|:--:|:--:|:--:|:--:|---|
| Main API | ✅ | ✅ | ✅ | ✅ | request-scoped human |
| Identity API | ✅ | — | — | — | n/a |
| Functions | ✅ | — | ✅ | ✅ ‼️ **yes — `Program.cs:478`** | **System** |
| **MCP** | ‼️ **NONE** | — | — | — | **System** |

‼️ **`clinqetmcp\Clinqet.Mcp` HAS NO SQL AT ALL** — no `AppDbContext`, no `AddDbContext`. It is
**Cosmos-only**, plus Service Bus and a bidirectional internal HTTP seam guarded by `X-Internal-Api-Key`.
**That seam, not a new dependency, is how SQL-only facts get there.** Anything living only in SQL —
`BusinessMembership`, branch **name**/`IsActive`/`IsDefault`, seats, entitlements, the authorization
snapshot — **cannot be read there.**

‼️ **`AddSystemActorAttribution()` is registered in the Functions and MCP hosts** (`TryAddSingleton`, so
a host that also registers the human accessor keeps it), so every document those hosts write is stamped
`BusinessActorType.System` (**L115**). ~~‼️ **Only the Main API registers `AddBusinessActivityFeed()`**, so no caller-less host writes an
activity row today and `ActorType == System` is currently unreachable in the feed.~~
‼️‼️ **WRONG, AND CORRECTED IN PLACE (PHASE 13 PART 1). CODE IS KING.** The **Functions host registers it
too**, at `clinqetfuncations/Clinqet.Communications/Program.cs:478`, five lines above its
`AddSystemActorAttribution()`. So `ActorType == System` **IS reachable today**, and
`BroadcastMatchingService:1656` writes a `LeadReceived` row **per matched provider on every broadcast
fan-out** — a real recurring Cosmos cost on the busiest path on the platform. **Only the MCP host lacks the
feed**, and **AD6's premise is false.** Phase 11 Part 4 proved this and corrected `02-CODE-REALITY` §10; the
correction reached this file only as an appended block ~700 lines below, so every reader still met the wrong
fact first. **The host matrix above is corrected with it.**

---

## 19. WHAT IS CUT OR CLOSED — do not build these, and do not report them as gaps

| Item | Standing |
|---|---|
| **`SecurityAuditEvent`** | ⛔ **CLOSED by owner decision (H1).** Never to be built |
| **A realtime push for a claim / assignment / release** | ⛔ **CLOSED by owner decision (B15).** The refresh-driven claimed-live banner ships as is. A `NotificationType` would be the **wrong shape** — it persists a Cosmos notification and fans out a push for every claim. The right shape, kept for reference only, is the **voice-live watch group** (`02-CODE-REALITY` §7.1) |
| **Inbox free-text search (`?q=`)** | ⛔ **CUT on cost (M7b).** The pre-existing client-side box was **removed** from both apps — it filtered only the 25 loaded rows and returned a confident wrong "no results" |
| **Activity member / date / location filters** | ⛔ **CUT on cost (M9).** The API accepts only `activityType`, `pageSize`, `continuationToken` |
| **A team-scoped activity feed** | ⛔ **CUT by the owner (AF-5)** |
| **Per-member calendars** | ⛔ **OUT OF SCOPE (L30).** Availability stays one calendar per business. Flag it if wanted; never build it here |
| **Per-branch time zones** | ⛔ **OUT OF SCOPE** (§8.7). Cross-timezone providers run two businesses |
| **Custom roles · per-user overrides · deny rules · approval limits · temporary elevation** | Deliberately deferred |
| **Impersonation** | ⛔ Not in this programme — its own consent model, step-up and audit trail |
| **Working-hours validation on the Main API booking path** | ⛔ Does not exist today, and adding it would start rejecting bookings both customer apps currently succeed with (**L117**). **Voice path only** |

### 19.1 Still open at the end of Phase 9

| Item | Owner |
|---|---|
| Assignment WRITES for `Quote`, `Invoice` and leads + their `ProviderData` index paths | the phase that builds their screens (**L108**) |
| `BusinessTeamController`'s duplicate-team-name path still returns `team_not_found`/404 — the wart **CP6** fixed for branch names | whoever next opens the team screen. **One line** |
| **B1 / B3** — two informational cards the owner may still want as live switches | owner decision |
| Inbox product metrics + seat metrics | **Phase 12** |
| The clean wipe and reseed (**D11**) | **Phase 15**, not Phase 11 |

---

## 20. THE FRONTEND CONTRACT

### 20.1 The rendering rules are the cross-platform contract

`clinqetwebpartnerapp/src/lib/tenancy/renderingRules.js` — **64 exports**, every one fixture-covered.
Its twin is `clinqetmobilepartnerapp/src/lib/tenancy/renderingRules.ts`.

‼️ **Keep both files dependency-free and side-effect-free.** The parity spec evaluates the web copy in a
`vm` sandbox; **a single `import` turns a build-failing diff test into a silent skip.**

‼️ **They return localization KEYS, never English.**

‼️ **The mobile twin's newer blocks are GENERATED from the web file and proved by a round-trip diff**
(**CP12**): strip the TypeScript annotations back out and the result must equal the web source
**character for character**. Edit the WEB file and regenerate — hand-editing the mobile copy will be
reverted.

`__tests__/tenancyRenderingParity.test.ts` is **build-failing** and passes **286** cases across all 64
exports.

### 20.2 Provider mobile — the 403 hazard

‼️ **`apiManager.fetchWithAuth` force-logs-out on ANY 403 it does not recognise as a domain answer.**
Every tenancy refusal is a 403 — `permission_denied`, `primary_owner_protected`,
`ownership_transfer_invalid`, **`step_up_required`**, `invitation_identity_mismatch`,
`business_context_stale`. **A mistyped ownership-transfer password would have signed the owner out of the
app** — the exact opposite of the guarantee that step-up does not touch lockout counters.

Fixed with **`isDomainForbiddenUrl()`**, a URL predicate in the shape of the existing `isAuthExemptUrl`.
‼️ **Add every new tenancy URL to it in the same change**, and to
`__tests__/tenancyForbiddenIsNotLogout.test.ts` (**29** URLs plus one unrelated 403 that still signs
out). It already covers `/business/members`, `/business/team/`, `/business/access`, `/business/branches`,
`/business/teams`, `/business/inbox`, `/business/activity`, `/business/notifications`,
`/business/availability`, `/business/service/areas`.

Two of these were live defects: a **Technician was signed out** by tapping Save on the opening-hours
screen (**CP10**).

### 20.3 Provider mobile — a new screen is a FIVE-file registration

`appNavigation/constant.tsx` · `types.ts` · `linking.ts` · the owning `*-Route.tsx` **and**
`services/analyticsTracker.ts`'s `screenMap`. ‼️ **A registered route missing from `screenMap` reports
`surface: undefined` on every PageView.** ‼️ **And check reachability PER STACK** — `SetAvailability`
lives in **two** stacks, so `LocationHours` had to be registered in `AboutBusiness-Route` too or the tab
tap was a silent no-op from the onboarding wizard.

‼️ **A new WEB route under `/dashboard/**` is a MOBILE deep-link obligation** — the association file
claims every such path, so the Universal Link would open the app on a blank stack.

### 20.4 Session and per-tab state (provider web)

‼️ **`SessionStore.set(key, value)` defaults to `localStorage`, which both browser tabs share**, and
`SessionStore.get` reads `sessionStorage` first then `localStorage`. The per-tab business key therefore
goes **straight to `window.sessionStorage`**, never through `SessionStore`. The token pair genuinely is
shared, so the honest guarantee is **detect and stop** (`tabContextDiverged()`), never "render the other
workspace's data under this header".

‼️ **`LastAccessAt` is nullable AND can arrive as the .NET zero date, which is TRUTHY** — a bare
truthiness check sorts a never-opened workspace to the top of a most-recent-first list.

### 20.5 Localization

| App | Keys × 5 files |
|---|---|
| API (`clinqetinfrastructure/Resources/Localization`) | **2,879** (2,876 until AZ12 added `booking.delete`) |
| Provider web (`public/lang/*.json`) | **5,052** flat react-intl ids |
| Provider mobile (`src/Locales/*.json`) | **4,565** nested i18next keys |
| Customer web | 3,798 |
| Customer mobile | 2,206 |
| **Admin app** | **n/a — no i18n exists (AD1)** |

‼️ **The mobile bundles are GENERATED from the web catalogs** (**B17**) by a script that re-parses and
diffs every file, so the two apps **physically cannot say different things**. It maps flat ids to nested
SCREAMING_SNAKE, `{x}` → `{{x}}`, and splits inline ICU plurals into `_one`/`_other` (mobile forbids
inline ICU), then proves identical key sets, zero surviving ICU, zero single-brace placeholders, zero
placeholder drift and zero empty values.

‼️ **i18next supports exactly ONE count per key**, so a two-plural sentence is inexpressible there. The
generator **REFUSES it by name** rather than half-converting; the two count PHRASES become their own keys
and are composed at the render site (**CP11**).

‼️ `tenancyKey()` (`lib/tenancy/localizationKeys.ts`) is the ONE mechanical id translation, and
`__tests__/tenancyLocalizationKeys.test.ts` resolves **every id the rules can return** (**127** checks).

Traps: **i18next `keySeparator` makes a flat `"A.B.C"` key unreachable** — nest properly ·
**`sourceLocalizationIntegrity` enforces fr-CA typography** (a letter followed directly by `?` fails;
French Canadian needs `Quelle équipe ?`) · **no `t(key, { defaultValue: 'English' })` in mobile source,
ever** · format dates through `getActiveLocale()`, never bare `toLocaleDateString()` ·
‼️ **ONE `defaultMessage` shared across a switch renders the WRONG string** — it rendered a **closed
account as Active**.

### 20.6 Rules the UI must not break

- ‼️ **Every provider-web change ships in `clinqetmobilepartnerapp` in the SAME session** (**L13**).
  Parity means matching the **rendering rules**, not shipping a same-named component.
- **No control whose backend does not exist.** Where an approved mockup asked for something the contract
  could not express, the honest answer shipped and the difference was **recorded and flagged** — A4, B1,
  B3, B14, AD3, AD4, AD6, AD7, C2, CP2, CP13. **Never fabricate.**
- **Derive a read-out; never author one.** The admin "what this role allows" panel is derived from
  `TenancyRoleCatalogDefinition`, because the approved mockup's hand-written version was **factually
  wrong** about the Technician role.
- Brand palette only — Navy `#032858` · Green `#97EF29` · Ink `#171717` · Border `#E7E7E7`. No raw emoji,
  no AI-looking glyph. Responsive at 320 / 480 / 768 / 1024 / 1280.
- ‼️ **ESLint 0 is a CORRECTNESS gate on this codebase**, not a style gate.

---

## 21. TESTING THIS FEATURE

**The convention tests that fail the build — never weaken one, fix the call site:**

| Test | Guards |
|---|---|
| `ProviderEndpointAuthorizationTests` | admin/anonymous exclusions · `[AllowedWhenBillingOnly]` placement · every referenced permission exists and is granted · **no body asserts a `BusinessId`** · the three `RequiresLiveAuthorization` invariants |
| `NotificationRoutingCatalogTests` | every `NotificationType` is classified — **and it keeps its own `BuildExpected()` map** |
| `MemoryCacheSizeConventionTests` | every `IMemoryCache` write carries a size |
| `RouteAttributesBindToPublicActionsTests` | no routing attribute on a non-public member |
| `CosmosTenancyContractTests` | index paths · `[JsonIgnore]` on assignment/attribution · permissions with no resource check stay `Business`-scoped |
| `CosmosCompositeIndexContractTests` | every repository file is registered in the container map |
| `TenancyConventionTests` | claim names · `UserProfile` no longer carries the four business columns · `CanGrantSeat` uses the tier limit |
| `PermissionsAndGrants_AreCodeOnly_AndNeverSQLEntities` | the catalogue never returns to SQL |
| `AuthorizationNeverReadsBusinessProfileTests` | L18 — no authorization reads `BusinessProfile.UserId` |
| `tenancyRenderingParity` (mobile) | all 64 rendering rules answer identically |
| `tenancyLocalizationKeys` (mobile) | every rule-produced id resolves |
| `tenancyForbiddenIsNotLogout` (mobile) | a tenancy 403 never signs the user out |
| `zeroLocationSilence` (web) | a zero-location provider never sees the word |
| `routeConfig.test.js` (admin) | **exhaustive** route map (`toEqual`) — never weaken to a subset |

**Integration tests are MANDATORY** for money, SQL/Cosmos schema, unique indexes, atomic counters,
webhooks and Service Bus processors — against **real engines** via Testcontainers. EF InMemory **cannot**
enforce a unique index, a filtered index, a relational constraint, EF→SQL translation, or Cosmos
atomic-PATCH semantics. ‼️ **Refresh cannot be unit-tested on EF InMemory at all**:
`RefreshTokenAsync` claims its token with `ExecuteSqlInterpolatedAsync` inside a catch-all, so **every**
InMemory refresh test "passes" as a rejection — including the ones that must succeed.

**End-of-programme baseline (PHASE 14 PART 3, 2026-08-06): 14,433 passed / 0 failed / 0 skipped across all nine suites.**
`Clinqet.API.UnitTests` 8,076 · `Clinqet.API.IntegrationTests` 1,637 · `Clinqet.Identity.UnitTests` 868 ·
`Clinqet.Identity.IntegrationTests` 385 · `Clinqet.Communications.UnitTests` 1,758 ·
`Clinqet.Communications.IntegrationTests` 420 · `Clinqet.Mcp.UnitTests` 535 ·
`Clinqet.Mcp.IntegrationTests` 65 · `ClinqetCosmosAIIndexSetup.UnitTests` 44.

---

## 22. FILE MAP

**`clinqetshared`** — `Constants/{BusinessContextClaimTypes,IdentifierNamespace,SensitiveOperations,TenancyErrorCodes}.cs` ·
`Enums/{BusinessStatus,BusinessAccessScope,MembershipRelationshipType,MembershipStatus,InvitationStatus,PermissionScope,AuthorizationEventType,BusinessEventCategory,BusinessActorType,BusinessActivityType,NotificationRoutingClass,NotificationRoutingTarget,NotificationDeliveryChannel,NotificationDeliveryMode,AdminTenancyMatchReason}.cs` ·
`Models/{TenantContext,AuthorizationSnapshot,ScopedResource,TenancySettings,ActorAttribution,BranchSummary,BusinessTokenContext,AccessChangePayload}.cs` ·
`Utilities/{BusinessAccessPolicy,IdentifierCodeGenerator}.cs` ·
`DTOs/Tenancy/{TeamManagementDtos,BusinessActivityDtos,NotificationSettingsDtos}.cs` ·
`DTOs/Identity/BusinessContextDtos.cs` · `DTOs/Admin/AdminTenancyDtos.cs`

**`clinqetcore`** — `Entities/SQL/` (the 17 tables) ·
`Entities/COSMOS/{ProviderOwnedEntity,BusinessActivity,ScopedResourceExtensions}.cs` ·
`Interfaces/Tenancy/` (26 interfaces) · `Services/Tenancy/{BusinessIdAllocator,InvitationToken,BranchAvailabilityResolver,PublicAvailabilityWeek}.cs` ·
`Services/Communication/{NotificationRoutingCatalog,BusinessEventId}.cs`

**`clinqetinfrastructure`** — `Services/Tenancy/` (32 services) ·
`Services/Communication/{NotificationRecipientResolver,BusinessCommunicationDispatcher,NotificationDigestService,CommunicationDeliveryIdempotencyStore,BusinessNotificationRouteStore}.cs` ·
`Data/SQL/{TenancyModelConfiguration,TenancyRoleCatalogDefinition}.cs` ·
`Data/COSMOS/BusinessActivityRepository.cs` · `HealthChecks/AccessChangeBacklogHealthCheck.cs` ·
`Observability/TenancyMetrics.cs` ·
`Configuration/{TenancyServiceRegistration,CommunicationServiceRegistration}.cs`

**`clinqetapi\Clinqet.API`** — `Middleware/TenantContextMiddleware.cs` ·
`Authorization/{RequiresPermissionAttribute,RequestLanguageResolver}.cs` ·
`Controllers/Tenancy/` (10 controllers)

**`clinqetidentity`** — `Controllers/BusinessContextController.cs` ·
`Controllers/Admin/AdminTenancyLookupController.cs`

**`clinqetfuncations`** — `Functions/{AccessChangeDispatcherFunction,AccessChangeProcessorFunction,NotificationDigestProcessorFunction,TenancyExpirySweepFunction}.cs`

**`clinqetmcp`** — `Context/WarmedBranchDirectory.cs`

**Provider web** — `src/lib/tenancy/` · `src/components/tenancy/` · `src/app/dashboard/{team,inbox,activity}/` ·
`src/app/dashboard/profile/locations/` · `src/app/invitation/` · `src/context/BusinessContext.jsx` ·
`src/utils/tenancySession.js` · `src/services/tenancyServices.js`

**Provider mobile** — `src/lib/tenancy/` · `src/components/tenancy/` ·
`src/Screen/ProfileFlow/{Team,Activity,Locations}/` · `src/context/BusinessProvider.tsx` ·
`src/services/tenancyService.ts`

**Admin** — `src/pages/users/TenancyLookupPage.jsx` · `src/components/tenancy/TenancyPanels.jsx` ·
`src/services/adminTenancyService.js`

---

## 23. THE PROGRAMME'S OWN PLAN DOCUMENTS

`C:\Nik\member-provider\` — read these before any change to this feature area:

| File | What |
|---|---|
| `PROGRESS.md` | the durable ledger: what every phase actually did, its gotchas, its decisions |
| `02-CODE-REALITY.md` | the verified code baseline. **This is fact** |
| `00-SOLUTION.md` | the architecture |
| `03-DECISIONS.md` | **every locked decision. Do not re-open one** |
| `05-BRANCHES.md` | the complete branch contract (L57/L59/L60) |
| `06-AUDIT-CASEBOOK.md` | ‼️ **49** real defects this programme shipped, and the method that found each |
| `01-MASTER-PLAN.md` | fifteen phases, the coding standards, the ten-dimension audit gate |

**Status: phases 1-9 COMPLETE. Phases 10-14 are the AUDIT programme (they FIND AND FIX). Phase 15 wipes
and reseeds.**

---

## 24. ‼️ THE TEAM/BRANCH NAME CONFLICT — fixed 2026-08-04 (SK5)

Two defects on the same paths, both closed.

### 24.1 The wrong code

A duplicate **team** name returned **`team_not_found` / 404** while carrying the message *"A team with
this name already exists"*. On a **RENAME** both outcomes are genuinely possible and the screens do
**opposite** things — a duplicate is an inline field error the provider fixes by typing; a vanished team
means a colleague deleted it and the row must go. Sharing one code forced the client to branch on the
**translated sentence**, which the tenancy error contract forbids.

**`TenancyErrorCodes.TeamNameInUse = "team_name_in_use"` → 409.** The localization key
`Error_TeamNameInUse` already existed in all five catalogs, so this added **zero** localization work.
‼️ **This is the split CP6 made for branches; teams were missed by it** — and `Create`/`Update` had been
declaring `ProducesResponseType(409)` they could never produce.

‼️ **Uniqueness is PER BUSINESS.** `UX_BusinessTeam_Business_Name` is on the **pair** `(BusinessId, Name)`,
so two different businesses may both have a team called "Dispatch" — asserted by test, not inferred from
the index name. Within one business it is blocked because teams are picked from a dropdown for
notification routing and work assignment, and two identical labels route work to the wrong group with no
visible symptom.

### 24.2 ‼️ The TOCTOU 500 — the defect the "one-line fix" framing hid

The `AnyAsync` pre-check is **check-then-act**. `CreateTeamAsync` and `CreateBranchAsync` carried a
`DbUpdateException` catch on the unique index; **`UpdateTeamAsync` and `UpdateBranchAsync` did not.**
Two admins renaming onto the same name both passed the pre-check, the index rejected one, and the loser
got an **unhandled `DbUpdateException` — a 500** on a conflict the database had resolved correctly.

Both rename paths now catch it, revert the tracked entity (so the `DbContext` stays usable) and return
the conflict.

> ‼️ **The rule, and it generalises to every unique index on the platform: a pre-check is NEVER the guard —
> the database is. If a write is protected by a unique index, EVERY path that writes it needs the
> `DbUpdateException` catch, not just the create path.**

**Sabotage-verified 3/3, all restored:** the wrong code failed 4 real-SQL tests quoting the exact strings;
removing the rename guard failed with `SqlException: Cannot insert duplicate key row … 
UX_BusinessTeam_Business_Name` (**the production 500**); deleting the 409 arm failed 3 unit tests with
`Expected: 409 / Actual: 400`.

**Tests:** `Clinqet.API.UnitTests/Controllers/BusinessTeamControllerNameConflictTests.cs` (5) ·
`Clinqet.API.IntegrationTests/Tests/TeamNameConflictSqlTests.cs` (6, **REAL SQL** — EF InMemory does not
enforce a unique index at all, so the race cannot happen there and the catch would never execute).

---

## PHASE 10 PART 1 — THE DATA/SCHEMA/PERSISTENCE AUDIT (2026-08-04)

> Phase 10 is the first **AUDIT** phase (10-14 FIND AND FIX). Part 1 ran four of the seven sweeps and
> fixed two live defects. ‼️ **Phase 10 PART 2 is the FINAL part** and owns S1 (orphan), S4
> (index-binding), S6 (persistence), the N+1 half of S7, and FINDING 3.
> **Baseline after Part 1: 13,802 passed / 0 failed / 0 skipped across all nine suites.**

### ‼️ Two live defects found and fixed

**1. Eight voice-lifecycle notifications reached the wrong Cosmos partition; two reached NOBODY (DA1).**
`VoiceAssistantService.DispatchPartnerNotificationAsync` and `DispatchNumberLifecycleNotificationAsync`
passed `RecipientUserNumber = profile.BusinessId` to the **raw single-recipient** `ICommunicationDispatcher`.
A `BusinessId` is not a `UserNumber`, so `NotificationProcessor` wrote the in-app document into a
`Communications` partition **`NotificationController` never reads**, push tagged `userNumber:{businessId}`
(zero devices) and SignalR targeted `notif:{businessId}:Provider` (zero connections). Email was the only
surviving leg — and **`VoiceAssistantActivated` and `VoiceAssistantRejected` carry no email template**, so
those two reached nobody at all.

‼️ **`NotificationRoutingCatalog` already classified all eight as `Business`/`BusinessSecurity`** — the
catalogue and the producer disagreed, and the catalogue was right. **The fix:**
`IBusinessCommunicationDispatcher`, a per-recipient factory, and a durable `EventId`
(`BusinessEventId.For("voiceassistant", businessId, type, VersionOf(profile))` — **L88**), with the
**L94** guard retained because the profile mutation is already committed.

‼️ **How it hid, and the rule it produces:** Phase 7's producer sweep was scoped to the **Functions host**
and evidenced by a 68-row table of `[Function]` attributes. This producer is an infrastructure **service**
and could not appear in it. **A sweep bounded by a directory or an attribute is bounded by the wrong
thing** — casebook **CASE 21**.

**2. Deleting a team orphaned booking 101+ onto the deleted team (DA2).**
`BusinessTeamStructureService.ReleaseTeamBookingsAsync` read exactly one page —
`GetAssignedToTeamAsync` is bounded by `CosmosDb:MaxItemCount` (100) per **L84** — and neither looped nor
reported a ceiling, while `DeleteTeamAsync`'s own comment states the invariant it was breaking
(*"a conversation pointing at a team that no longer exists would match no view at all"*). Now a drain
loop bounded by the existing `Tenancy:Lifecycle:MaxReassignmentItems` (1000), logging a Warning at the
ceiling. ‼️ **A bound is only safe if the caller either DRAINS it or REPORTS it** — casebook **CASE 21b**.

### ‼️ What the sweeps CLEARED, and by what method

- **Cross-partition (S3): CLEAR.** `grep` for `PartitionKey.None` / `EnableCrossPartitionQuery` /
  `CrossPartition` across all seven backend projects returns **zero production matches**.
  `CosmosDbRepository`'s 14 data entry points all throw on a blank partition key, and the two that look
  unguarded (`ExecuteScalarQueryAsync(QueryDefinition,…)`, `GetFilteredItemsAsync`) delegate to guarded
  methods. ‼️ **19 of the 53 repositories do NOT derive from the base** and hold their own `Container`, so
  all **23** production `GetItemQueryIterator` call sites were enumerated individually — every
  `QueryRequestOptions` carries a concrete `PartitionKey`. ‼️ **`AdminAlertRepository.GetAlertsPagedAsync`
  is a per-MONTH fan-out of single-partition queries, not a cross-partition query**, despite a test whose
  name says "CrossPartitionQueries".
- **Migrations (S2): CLEAR.** All six tenancy `Up` blocks read line by line; every
  `DropIndex`/`DropColumn`/`DropTable`/`AlterColumn` accounted for. `SeedDbContext` matches
  `AppDbContext` for every column it declares, and every column it omits is nullable, DB-generated or
  defaulted. `cosmosindexsetup` applies all 8 container policies through `ReplaceContainerAsync`, so a
  re-run genuinely updates an existing container.
- **L81: CLEAR.** The only `c.branchId` query predicate is `BookingRepository.cs:439`, on `Transactions`,
  which **does** carry `/branchId/?`. `ProviderData` still needs none.
- **`UX_BusinessBranch_Business_Default`:** the index is correct (**filtered `[IsDefault] = 1`**, so many
  branches and at most one default) — **and it was completely untested until now.**

### ‼️ FINDING 3 — OPEN, owned by Phase 10 Part 2

The six provider-inbox conversation queries (`BuildUnassignedQuery`, `BuildAssignedToMembershipQuery`,
`BuildAssignedToTeamsQuery`, `BuildWatchedQuery`, `BuildAllForBusinessQuery`, overdue) are **unbounded
`SELECT *` over a business partition**, and `ProviderInboxService` pages them **in memory** with
`.Skip().Take()`. The bookings side got `SELECT TOP` in L84; conversations never did.

### ‼️ Traps for anyone touching this area

1. ‼️ **The API integration host has NO SQL container** (**L70**), so a business-routed notification
   resolves **zero recipients** and publishes **no `NotificationMessage` at all**. Assert against an
   injected dispatcher double, never against the emitted Service Bus message.
2. ‼️ **Ten `VoiceAssistantControllerIntegrationTests` assertions ENCODED THE DEFECT**
   (`n.RecipientId == businessId`). They are now `Assert.DoesNotContain(...)` regression guards.
   **When a fix turns a test red, ask FIRST whether the test was asserting the bug.**
3. ‼️ **Use `Clinqet.API.UnitTests.Helpers.BusinessDispatcherTestDouble`**, never
   `Mock.Of<IBusinessCommunicationDispatcher>()` — the real dispatcher invokes the per-recipient factory
   and a bare mock never does, so content assertions pass vacuously (casebook CASE 4).
4. ‼️ **`Bind for 0.0.0.0:8081 failed: port is already allocated` is INFRASTRUCTURE, not a regression** —
   a leftover Cosmos-emulator container. Run `docker ps` before believing a Testcontainers failure.
5. ‼️ **53 Cosmos repositories, not 52**; `Cosmos.cs` is **3,395** lines, not 3,331. Both figures are
   still quoted stale in `PHASE-10` §1. **Treat every inherited count as a hypothesis and measure it.**

---

## PHASE 10 PART 2 — the data/schema/persistence audit closed (2026-08-05)

> Phase 10 is **DONE**. Tree green at **13,842 / 0 / 0**. Schema added: **one** owner-approved Cosmos composite
> and nothing else. Full record: `member-provider/PROGRESS.md` → *PHASE 10 PART 2*; decisions **DA7–DA12**.

### ‼️‼️ A `BusinessId` CAN NEVER EQUAL A `UserNumber` — and a build-failing guard now enforces it

**D1** makes them disjoint by construction: six characters versus five, allocated from one shared namespace. So
`u.UserNumber == businessId` is **never** true — and it fails in the quiet direction, "not found".

**Four production sites asked it anyway**, all in the payments surface. The worst was
`AdminProviderPayoutsController.BusinessExistsAsync`, where it was **not a fallback but the only check**, so
Clinket support looking up any tenancy-path provider without a payout account was told **"No business found for
that ID"** — false, on a money question. Its own comment asserted the dead invariant as fact.

- ✅ The tenant is the SQL **`Business`** row. Resolve existence from `db.Businesses`, never from `Users`.
  `Business` has **no** global query filter (**L43**), so a suspended or closed business still resolves — which
  is what an admin lookup needs.
- ‼️ **The guard:** `Clinqet.API.UnitTests.Conventions.NoCodeResolvesAPersonFromABusinessIdTests` fails the build
  on the comparison in either direction, across all seven production projects. **Fix the call site, never the
  test.** One named exemption exists (`BroadcastMatchingService`, deferred to Phase 11) and it is pinned to its
  own defect, so it cannot outlive it.
- ‼️ **How it hid:** both fixtures seeded a `UserProfile` whose `UserNumber` WAS the businessId, so the two
  identifiers could not diverge. **Casebook CASE 1 / CASE 23.**

### ‼️ The provider inbox is KEYSET-paged — never add an offset page here

`GET /business/inbox` takes **`continuationToken`**, not `page`. `InboxPageDto` carries `NextCursor` and the six
tab counts, and **no** `TotalCount` / `Page` / `PageSize`.

- `IConversationRepository.GetInboxPageAsync(businessId, InboxPageQuery)` → `ConversationKeysetPage(Items, NextCursor)`.
- SQL: `SELECT TOP n * FROM c WHERE … ORDER BY c.type, c.lastMessageAt DESC, c.id DESC`, cursor
  `(c.lastMessageAt < @cursorAt OR (c.lastMessageAt = @cursorAt AND c.id < @cursorId))`.
- ‼️ **Why the `/id` tiebreaker exists:** `(type, lastMessageAt DESC)` alone cannot separate two conversations
  written in the same tick, so a cursor repeats or skips them — **and the sort would not bind in production**
  even though the emulator permits it (L12). The composite `(type ASC, lastMessageAt DESC, id DESC)` on
  `Communications` is owner-approved (**DA5**) and is the ONLY schema Part 2 added.
- ‼️ **Why not `OFFSET`:** Cosmos charges RU for the documents an offset skips, so offset paging is
  O(page depth). `SELECT TOP (page × pageSize)` was proposed, rejected and must not return.
- ‼️ **The query NARROWS; `IResourceScopeEvaluator` DECIDES** (DA8). Only `Assigned` and `Team` become SQL
  predicates because only those paths are indexed. `Branch` / `CreatedByMe` / `Participating` get **no** query
  narrowing and are decided entirely by the evaluator, with a bounded top-up loop refilling the page.
  **Never move an access decision into the query.**
- **Overdue is unchanged** (B8): a bounded read, sorted in memory, sliced by its own `(slaDueAt, id)` cursor.
  `GetInboxTabProjectionAsync` is still a full-partition read, by the owner's explicit choice.
- Cursor encoding lives once, in `Clinqet.Infrastructure.Data.COSMOS.Base.KeysetCursor` —
  `BusinessActivityRepository` delegates to it. **Do not write a second encoder.**
- A stale or mangled cursor is **400 + `invalid_continuation_token`**, never a silent ignore (AD8).

### ‼️ The composite-index guard is now self-verifying — trust it, but know what it checks

`CosmosCompositeIndexContractTests` had drifted: **five of 53 repositories were validated against the wrong
container's index policy** (`AiSession`, `BroadcastDispatch`, `Broadcast` are **`Communications`**; `Cart` and
`RecentlyViewed` are **`SystemData`**). Three changes:

1. `TheContainerMap_MatchesTheContainerEachRepositoryActuallyResolves` derives each container from the repository
   source and fails on divergence — the hand map can no longer drift silently.
2. `EverySingleColumnOrderByQuery_HasMatchingCompositeIndex` — ‼️ **`TypeFilterSql` puts `c.type = 'X'` on every
   repository query, so a ONE-column sort still needs a `(type, sortColumn)` composite.** 27 queries validated.
3. Line comments are blanked before scanning: writing the words of a sort clause in a comment between two string
   literals was being parsed as SQL.

> ‼️ **The lesson that cost the most: a wrong guard does not merely fail to catch bugs — it PROPOSES them.**
> Acting on the mis-mapped result, the audit first deleted a correctly-indexed sort from `AiSessionRepository`.
> **Verify the guard before you change the code it accuses.**

### ‼️ OPEN — owner decisions, NOT unfinished work. Do not "fix" either unilaterally

- **`BusinessStatus.Suspended` and `.Closed` are UNREACHABLE.** `Business.Status` is written in exactly one
  place (`BusinessProvisioningService:130`, `Active`, at creation). **D9's entire billing-only regime reads a
  state nothing produces.** The admin "suspend provider" action sets `BusinessProfileStatus.Suspended` on the
  **Cosmos** profile (marketplace visibility) and never touches SQL `Business.Status` (tenancy access) — and its
  own guard leaves outstanding bookings live, which argues they are deliberately separate axes.
- **Five indexed paths serve no query** (four of them array paths, costing one index entry per element on every
  write, forever): `ProviderData` `/serviceImages/[]/imageId`, `/images/[]/imageId`, `/documents/[]/documentId`,
  `/pricing/priceType`; `Reviews` `/images/[]/imageId`; `Messages` `/attachments/[]/attachmentId`. The nested-id
  lookups are done **in memory** by `PatchStableArrayItemByIdAsync`. Removing an `IncludedPath` is RULE ZERO.

### Two sweep techniques worth reusing

- ‼️ **A C#-property orphan scan LIES about Cosmos.** Any field written by `PatchOperation.Set("/jsonPath", …)`
  looks orphaned. Scan for the **JSON name too** — it moved this sweep's result from 18 false hits to 14 real ones.
- ‼️ **Widening a race is not fixing it.** A banner test gave an offer 2 seconds of life and slept it out; a
  loaded full-suite build outlasts 2 seconds, so it failed intermittently — and its own comment recorded that the
  window had already been widened once, from 120 ms. **Remove the elapsed time, do not lengthen it.**

---

## PHASE 11 PART 2 — THE AUTHORIZATION / MONEY AUDIT (2026-08-05)

> ‼️ **This block CORRECTS three things stated above.** Read it before acting on §5.3, §5.5 or the
> ABSOLUTE RULES.

### ‼️ Corrections to this skill

| Section | Said | **Measured 2026-08-05** |
|---|---|---|
| §5.3 | `[RequiresPermission]` on **183 endpoints across 23 controllers** | **224 across 31** |
| §5.5 | The resource-scope evaluator is wired at **28** endpoints | **31** |
| **ABSOLUTE RULES §5** | L19 and L40 are *"enforced by build-failing convention tests"* | ‼️ **They were NOT. Neither test existed** — see F4 below. They are now |

### ‼️ F2 — TWO BOOKING ENDPOINTS GATED NOTHING. It was a BLOCKER, and it is fixed

`POST /api/v1/bookings/{bookingId}/cancel` and `PATCH /api/v1/bookings/{bookingNumber}/status` carried
`[Authorize]` and nothing else. **Both have a live `if (userType == UserType.Partner)` branch** that resolves
`GetCurrentBusinessId()` and mutates the booking, so a **`catalog_manager`** (*"No booking or money access"*),
a **`read_only_auditor`** (*"no writes"*), `finance` and `sales_representative` could all **cancel and
complete any booking**, and `technician`/`contractor` — who hold `booking.complete` at **`Assigned`** scope —
could complete **any** booking in the business. ‼️ **`Completed` transactionally creates an invoice.**

**The fix, and the pattern to copy:** gate the **provider branch IN-ACTION**, never with a class-level
attribute — both are shared customer-and-provider endpoints and a blanket attribute would 401 every customer
(casebook **CASE 7**). `BookingController.BookingStatusPermission(status)` maps the transition to its key
(`Cancelled`→`booking.cancel`, `Completed`→`booking.complete`, `Confirmed`→`booking.accept`, else
`booking.update`), then `EnforceResourceScope(...)`.

‼️‼️ **THE FACT THAT MAKES THIS ONE CALL INSTEAD OF TWO: `ResourceScopeEvaluator.Evaluate` ALREADY DENIES AN
UNGRANTED PERMISSION ON ITS FIRST BRANCH.** `context.ScopeFor(key)` returns `PermissionScope.None` for a key
the caller does not hold, and the evaluator returns `DeniedOutOfScope` before looking at anything else. So
`EnforceResourceScope` does **permission + cross-tenant assertion + `Assigned`-narrowing** in one call.
**Do not build a separate in-action "do you hold this permission" primitive. There already is one.**

### ‼️ F4 — L19 AND L40 WERE ENFORCED BY NOTHING

The ABSOLUTE RULES above, and `03-DECISIONS.md` L40, both claimed a build-failing convention test.
**Neither existed.** The invariant was held by a single expression in `TenancyRoleCatalogDefinition:179`.
A grant edit could have handed a compromised Administrator the ability to transfer the business or
**redirect its payout destination**, with nothing failing.

`Conventions/OwnerOnlyPermissionTests.cs` now asserts each owner-only key is held by `primary_owner` and no
other role at `Business` scope, that the Administrator template is the owner's minus **exactly** those two,
and that the owner holds every catalogue key.

> ‼️ **The rule this produces: a document saying "enforced by a test" is a CLAIM ABOUT a test. `ls` the file.**

### ‼️ F1 — billing copy carries no language of its own

`BillingNotification.Language` is **deleted**. `ResolvedRecipient.PreferredLanguage` is **`required` and
`init`-only**, there are exactly **TWO** constructions platform-wide
(`NotificationRecipientResolver` and **`TeamLifecycleNotifier`**), and both coalesce a blank to `"en"`.

‼️ **Part 1 recorded "exactly ONE construction" as the whole proof. That was wrong**, and the conclusion only
survived because the second construction defaults correctly too — **casebook CASE 26**.

Deleted with it: `SubscriptionBillingService.ResolveLanguageAsync` (**10 Cosmos reads per billing run**, four
inside sweep loops) · `AiAddOnService.LoadUserProfileAsync` (1 SQL read) ·
‼️ **and `SubscriptionBillingService`'s whole `IBusinessProfileRepository` dependency — its constructor is now
12 arguments, not 13.**

‼️ **`LoadUserProfileAsync` legitimately SURVIVES in `BookingPaymentService` (a CUSTOMER's own language on the
Flow-B path) and `PaymentMethodService` (Razorpay contact prefill). Do not "clean them up".**

### ‼️ F3 — the orphan-permission registry

**Nine catalogue keys have no consumer**, each triaged individually and registered with its reason in
`Conventions/OrphanPermissionRegistryTests.cs`, which derives the set from the real catalogue and the real
source tree and fails if it **grows or shrinks**.

`business.friendlyname.manage` (L65 — the slug endpoints live in the **Identity** host, which has no
`[RequiresPermission]` pipeline at all) · `lead.assign` · `lead.hide` · `quote.approve_discount`
(‼️ re-verified: `Quote` still carries **no** discount field) · `conversation.view_all` · `review.report` ·
`payout.export` · `analytics.read` · `media.delete`.

‼️ **Two are OWNER DECISIONS, not gaps:** `review.report`'s endpoint exists but is **person-scoped**
(`GetUserId()`, no provider branch) so gating it would 401 every customer; and `analytics.read`'s endpoints
gate on **`insights.read`**, whose grants differ, so re-pointing removes access `sales_representative` has today.

### Hazards this part adds to §18

1. ‼️ **RE-VERIFY THE EVIDENCE OF AN INHERITED FINDING, NOT JUST ITS CONCLUSION.** CASE 26.
2. ‼️ **The count guard earns its keep in the HIGHER direction.** `, language,` appears **23** times in
   `AiAddOnService`, only **15** are targets; across three files a blind `replace_all` would have corrupted
   **17** unrelated call sites. Anchor on the line ending and prove the pattern's lines are the compiler's lines.
3. ‼️ **A raw `grep -c` over-counts a guard by its declaration** — `IsSelfDealing(` says 3, the truth is
   **2 endpoints + the `BaseController` declaration**. CASE 25b, inverted.
4. ‼️ **`python3` is NOT available in this environment.**
5. ‼️ **All four `Services/Payments` files are LF while most of the tree is CRLF.**
6. ‼️ **`SubscriptionBillingService`'s constructor is 12 arguments now**, and `BroadcastMatchingService` takes
   `IBusinessMemberDirectory` as its 13th.

---

## PHASE 11 PART 3 — THE SHARED-ENDPOINT PROVIDER BRANCH (2026-08-05)

> ‼️ **This block CORRECTS two things stated above.** Read it before acting on §5.4, §6.1 or the
> ABSOLUTE RULES.

### ‼️ Corrections to this skill

| Section | Said | **Measured / decided 2026-08-05** |
|---|---|---|
| §6.1 · ABSOLUTE RULES 7 | **89 permissions**; catalogs **2,876 keys each** | **90 permissions** (`booking.delete`, owner-approved **AZ12**); catalogs **2,879 keys each** |
| §5.4 | Ten endpoints carry `RequiresLiveAuthorization` | ‼️ Still ten — but **only ONE had a test proving the live read is REACHED**. All ten are now proved (finding **G3**) |

### ‼️‼️ THE HIGHEST-RISK SURFACE ON THIS PLATFORM: a SHARED endpoint's provider branch

A **shared** customer-and-provider endpoint **cannot** carry `[RequiresPermission]` — a customer token has no
`BusinessId` claim, so a class-level attribute would **401 every customer** (casebook **CASE 7**). Phase 3b
recorded that reasoning and deliberately left those endpoints unannotated.

‼️ **So the absence of a gate reads as a decision that has already been justified, and nobody asks what
replaced it.** For **twelve** endpoints, nothing had — finding **G1**, a **BLOCKER**:

| Endpoint | Provider branch did | Now gated on |
|---|---|---|
| `GET /bookings/{bookingNumber}` | read ANY booking | `booking.read` + resource scope |
| `POST /bookings/draft` · `POST /bookings` · `POST /bookings/from-quote` | created bookings (`POST /bookings` **auto-confirms**) | **`booking.create`** via `EnforceBusinessPermission` |
| `PUT /bookings/draft/{n}` · `PUT /bookings/{n}` | mutated ANY booking | `booking.update` + resource scope |
| ‼️ `DELETE /bookings/{bookingNumber}` | **hard-deleted the booking AND the customer mirror** | **`booking.delete`** + resource scope |
| 3 attachment verbs + `POST /{n}/send-confirmation` | mutated attachments, emailed the customer | `booking.update` + resource scope |
| `GET /quotes/by-number/{quoteNumber}` | read ANY quote | `quote.read` + resource scope |

**Who could reach them:** `catalog_manager` holds **no `booking.*` key at all**; `read_only_auditor` holds
only `booking.read`; `technician`/`contractor` hold theirs at **`Assigned`** scope and could therefore reach
**every** booking in the business.

‼️ **The evidence that settled it was an ASYMMETRY, not a count:** `GET /quotes/{quoteId}` is gated by
attribute **and** resource scope; `GET /quotes/by-number/{quoteNumber}` — the same document, a different
handle — by nothing. **Where one resource has two handles, diff the handles.**

### ‼️ The rule for any NEW shared endpoint

1. **Never** put `[RequiresPermission]` on it — CASE 7.
2. Gate the **provider branch in-action**, leaving the customer branch untouched.
3. **Per-record** (a document is in hand) ⇒ `EnforceResourceScope(key, entity.ToScopedResource())`.
   ‼️ `ResourceScopeEvaluator.Evaluate` **already denies an ungranted key on its first branch**, so that one
   call does permission + cross-tenant assertion + `Assigned`-narrowing together.
4. **CREATE** (no document exists yet) ⇒ **`EnforceBusinessPermission<T>(key)`** (**AZ11**). This is the one
   case §5.5's "there already is one" does not cover. ‼️ **Never hand-build a `ScopedResource`** to fake it.
5. `Conventions/SharedEndpointProviderBranchTests.cs` fails the build on any new ungated provider branch, and
   carries **eleven named clearances** — it fails if that list **grows OR shrinks**.

### `booking.delete` — a new key, and deliberately narrower than `booking.cancel`

**Owner-approved 2026-08-05 (AZ12).** Granted to `primary_owner`, `administrator`, `operations_manager` —
‼️ **not `dispatcher`, which does hold `booking.cancel`**. The distinction is real: **a cancelled booking
stays auditable; a deleted one does not**, so erasing the record is a different act, not a stronger cancel.

### The eleven CLEARED sites — correct, do not "fix" them

Four `CategoryController` `[AllowAnonymous]` routes (businessId read only when authenticated, only to
decorate the caller's OWN selected categories) · `SupportController.RequestPaymentSupport` (internal ops
alert, own-partition read, fixed response body) · six `BusinessNotificationSettingsController` actions
(**structurally self-scoped** — every write filters on `preference.MembershipId == tenant.MembershipId`, and
`AboutMembershipId` is validated against the caller's own colleague list).

### L94 is CLEAR, but its guard SHAPE has drifted

All **26** files with a business-dispatch call site guard it, and the one that does not —
`ProviderConfirmationProcessor` — is **correct by L119** (the notification IS the work product, so it must
throw and dead-letter). ‼️ **But eleven producers use a plain `catch (Exception ex)` instead of L94's
`when (ex is not OperationCanceledException)`**, so a genuine cancellation is swallowed. **Low, unguarded by
any convention test.**

### Hazards this part adds to §18

1. ‼️‼️ **A FIX INHERITS THE SCOPE OF THE FINDING THAT DESCRIBED IT.** Part 2 closed F2 (two ungated booking
   endpoints) correctly and completely; the behaviour was **twelve endpoints wider**. **Casebook CASE 27.**
   Write the defect in ONE sentence with **no file names**, then grep for that sentence.
2. ‼️‼️ **BUILD ALL EIGHT SOLUTIONS, not the ones you changed.** Part 1's `BroadcastMatchingService` change
   left `Clinqet.Communications.IntegrationTests` unbuildable and **two sessions missed it** (finding G2).
3. ‼️ **A sweep regex is an enumeration and can be wrong.** `[HttpPost(` cannot see bare **`[HttpPost]`** —
   which is `POST /bookings`, the main create endpoint.
4. ‼️ **An attribute look-back that walks to the previous `[Http…]` inherits the PREVIOUS action's
   `[RequiresPermission]`** and reports every following action as gated. Walk back only over the contiguous
   attribute/blank block.
5. ‼️ **Counting the SHAPE of a guard is not counting the presence of one** — and a guard can live at the
   CALLER, hundreds of lines from the call it protects (`MessageService`).
6. ‼️ **A bash heredoc breaks on apostrophes in prose.** Plan-document prose goes through the editor tool.

### ‼️ G4 — a fix and its own integration proof, disabled by the same edit (CASE 27b)

Part 1's **AZ1** made `IBusinessMemberDirectory` a **required** constructor argument on
`BroadcastMatchingService`. That made `Clinqet.Communications.IntegrationTests` **fail to compile** — and the
one test in it that exercised the self-match guard end to end **was itself asserting the defect**, seeding the
poster's own hit with `businessId == the poster's UserNumber` (impossible under **D1**; CASE 23's shape).

**So one edit shipped the fix and silenced the only test able to judge it.** It sat that way for two sessions,
because *"all 8 production projects build with 0 errors"* is true and complete about production code.

- ‼️ **"The build is green" and "every test project compiles" are different claims.** Build every solution.
- ‼️ **After changing a guard, ask which test proves it END TO END — and whether you just broke that test.**
- The fix restored `ProvidersMatched == 1` and `Assert.Null(selfDoc)` **unchanged**, pointed at a distinct
  `posterBusinessId` resolved through the member directory. **Fixed, never weakened.**

---

## PHASE 11 PART 4 — THE PHASE CLOSES (2026-08-05)

> ‼️ **This block CORRECTS §18.4 and the PHASE 8 PART D activity-feed claim. Read it before acting on either.**

### ‼️ Corrections to this skill

| Section | Said | **Measured / decided 2026-08-05** |
|---|---|---|
| §18.4 host matrix | *"Only the Main API registers `AddBusinessActivityFeed()`"*, so no caller-less host writes a feed row and `ActorType == System` is unreachable | ‼️ **WRONG.** The **Functions host registers it too** (`clinqetfuncations/Clinqet.Communications/Program.cs:478`), five lines above its `AddSystemActorAttribution()`. `System` **IS** reachable, and `BroadcastMatchingService:1656` writes a `LeadReceived` activity row **per matched provider on every broadcast fan-out**. Only the **MCP** host lacks the feed. **AD6's premise is false** |
| §5.5 / §6.2 | Seven `PermissionScope` values, seven evaluator branches | ‼️ Still true — but **the catalogue grants exactly TWO**: `Business` and `Assigned`. `Team`, `Branch`, `Participating` and `CreatedByMe` are granted by **no role**, so four branches are unreachable today, and `00-SOLUTION` §12.5 **row 5 cannot currently occur** |

### ‼️ THE HIGHEST-RISK SURFACE, PART TWO: a guard's own ENUMERATION

**Casebook CASE 29.** H3's `NoProviderEndpointAcceptsABodyThatAssertsABusinessId` reflects only over
`[RequiresPermission]` actions — which **structurally excludes a shared customer-and-provider endpoint**,
because such an endpoint cannot carry the attribute (CASE 7). That is exactly where finding **G1** lived.

‼️ **Ask of every convention test: what does it ENUMERATE, and can the behaviour occur outside that
enumeration?** A convention test is a sweep that runs forever, so its boundary deserves the same distrust as a
one-off sweep's (CASE 21 / CASE 27). An attribute, a directory, a file pattern and a namespace are all the
wrong boundary for a behaviour.

`NoActionAnywhereAcceptsABodyThatAssertsABusinessId` now walks **every** action and registers the **eight**
legitimate bodies by name — three `[Authorize(Roles = "Admin")]` surfaces (**L33**: an admin token carries no
`BusinessId` claim, so naming the business IS the request), three `[AllowAnonymous]` guest-pay actions (the id
is a lookup coordinate; the **e-mail match** is the authorization), one internal-API-key relay, one analytics
dimension. **Add a new body only with its reason — never a bare exemption.**

### ‼️ CASE 2's DEAD PREDICATE WAS NEVER REMOVED — a fix that added beside instead of replacing

**Casebook CASE 28.** `BusinessSeatService` still counted `Status == Active || Status == Invited`, and nothing
creates an `Invited` MEMBERSHIP row. **L100 added the pending-`BusinessInvitation` query BESIDE the dead clause**,
so the service read as though it handled invitations twice — and the obvious tidy-up ("this duplicates the
query below") restores the original seat hole exactly.

‼️ **And `Evaluate_CountsInvitedAlongsideActive` was pinning the fiction**, seeding six impossible membership
rows against real SQL while a comment 190 lines below **in the same file** said that shape is one production
never creates.

- **The clause is deleted** (`Active` only); the test is re-pointed to the honest inverse,
  `Evaluate_AnInvitedMembershipRow_CountsForNothing`, which is strictly stronger.
- `Conventions/NoLimitCountsAnImpossibleRowTests` pins the FACT: `MembershipStatus.Invited` may be **excluded**
  or **denied**, **never counted**. Three sites registered with their reasons; it fails if one disappears.
- ‼️ **Three rules:** a fix that adds the right thing beside the wrong thing is half a fix · a comment
  explaining why the code above it is dead is a DEFECT REPORT · **re-run the sweep that found a defect against
  the fixed code — a casebook case is a detector, not a history entry.**

### ‼️ L94 IS BUILD-ENFORCED, AND THE SHAPE IS NOW MEASURABLE

`Conventions/BusinessDispatchGuardShapeTests` is **brace-aware**: from each call site it walks UP to the
enclosing `try`, then DOWN to that block's own `catch`. **33 call sites across 26 files.**

- **Eleven** plain catches were normalised to `catch (Exception ex) when (ex is not OperationCanceledException)`.
- ‼️ **`InvoicePastBookingProcessor` had NO dispatch guard at all** — its only catch was the processor's
  top-level handler, so a notification failure **dead-lettered a message whose invoice was already committed**
  and raised *"Invoice Past Booking Processing failed"* about work that had succeeded. It now has one.
  **Swallowing loses no signal**: `BusinessCommunicationDispatcher.DispatchAsync` raises the dispatch-failed
  admin alert itself and **then rethrows**, precisely so producers can swallow.
- **Seven sites are registered**, each with its mechanism: `ProviderConfirmationProcessor` (**L119 — must
  THROW**), `FailureNotificationHelper` (it IS the failure path), `MessageService` and
  `VoicePostCallProcessorFunction` (guarded at the caller), and ‼️ **three `TeamLifecycleNotifier` sites guarded
  by a WRAPPER the dispatch is handed to as a lambda** — `SafeDispatchAsync` carries the filtered catch, and
  **no lexical scanner can follow a lambda into its callee.**

### ‼️ `[Required]` IS A PROMISE ABOUT `ModelState`, NEVER ABOUT THE VALUE

**Casebook CASE 29b.** `BookingController.CreateBooking` dereferenced `dto.Customer.Email` **eighteen lines
above** its `ModelState.IsValid` check. A body omitting the customer block — or posting `"customer": null` —
threw a `NullReferenceException`, and the caller got a **500** from the platform's main booking-create
endpoint. The DTO already carried the correct localized 400; **the code returned before reaching the check that
reads it.**

‼️ **Any dereference of an annotated complex member before the `ModelState` check is a 500 waiting for a client
that omits it.** Swept across the three money controllers: exactly one site, now fixed and guarded.

### What is now PROVED rather than assumed

| Claim | Where it is proved |
|---|---|
| Every authorization change bumps `AuthorizationVersion` **and** writes the `AccessChangeQueue` row **together** | `Tests/RevocationAtomicitySqlTests.cs` — 8 tests, **REAL SQL**: suspend · reinstate · remove · roles · teams · branch staff, plus a refused change writing neither and a revocation touching no other business |
| Five members share one quota pool; a contractor in two businesses draws from each separately | `Repositories/QuotaIsolationCosmosIntegrationTests.cs` — 11 tests, **real Cosmos emulator**, BOTH counters |
| Every permission and role has a display name in **all five** catalogues | `Conventions/PermissionCatalogueLocalizationTests.cs` — 90 × 2 + 10 × 2 keys, plus an orphan check and a key-set identity check |
| Every booking and invoice status transition, valid and invalid | `Services/StatusTransitionMatrixTests.cs` — **242** booking cells + 25 invoice cells, EXECUTED |
| Inviting an existing Clinket user is indistinguishable from inviting a stranger | `InvitationConcurrencySqlTests` — both the success and the refusal path. ‼️ **Structurally true: `IssueAsync` never looks the invited address up in `Users` at all** |
| Every endpoint's business-vs-person classification | `Conventions/EndpointIdentityClassificationTests.cs` — both directions of CASE 7, over **466** actions derived from source |

### Hazards this part adds to §18

1. ‼️ **The two usage counters do NOT share an interface.** `AiUsageCounterRepository : IUsageCounter`; lead
   volume has its own `ILeadUsageCounter`, deliberately, to avoid DI ambiguity. **A theory iterating
   `UsageMeter` and resolving `IUsageCounter` covers ONE of the two while reporting both.**
2. ‼️ **`CachedUsageCounter` decorates `IUsageCounter` in DI.** A quota test that resolves the interface
   measures the read cache, not the atomic PATCH. Resolve `AiUsageCounterRepository` concretely.
3. ‼️ **A "Seo SQL" test finishing in one second has NOT run.** `SeoSqlFixture` starts a real SQL container;
   a suspiciously fast pass is a harness question, not a result. Watch `docker ps` during the run.
4. ‼️ **BusinessId prefix "K" is claimed** by `RevocationAtomicitySqlTests`. The claimed set is now
   **D E G H K N P Q R S T U V Z**, and a new one must be proved free against **both** idioms
   (`"X" + Interlocked` and the parameterised `NextId("X")`).
5. ‼️ **An enum-writer grep requiring `=`, `,` or `(` before the member misses TERNARIES and bare arguments.**
   It under-reported `BookingPaymentStatus.Refunded`, `InvoiceStatus.Draft` and
   `BusinessActivityType.LeadReceived` as zero-writer. **Open the file before calling a predicate dead.**
6. ‼️ **When a test you just wrote returns an unexpected status, the first hypothesis is a DEFECT, not a bad
   fixture.** Tuning the fixture until the assertion passes is how a live defect becomes a green test — it is
   how the `CreateBooking` 500 was found.
7. ‼️ **A SqlClient reader fault with NO xUnit assertion in the trace is the CONTAINER, not the code.**
   `Clinqet.API.IntegrationTests` returned 1,679 / 1,678+1 / 1,679 across three runs of an unchanged assembly;
   the middle failure was `AffectedCountModificationCommandBatch.ConsumeResultSetAsync` after EF had already
   burned its three configured retries. **Diagnose it — never re-run it away — but recognise the signature.**

---

## ‼️ PHASE 12 PART 2 CORRECTION BLOCK (2026-08-06) — notification routing under tenancy

### 1. ‼️ A member's own notification-preference screen was inert for a solo business

`NotificationRecipientResolver.ResolveAboutPolicy` returned a hard-coded `Immediate` when the observed
membership set was empty, so an administrator's own `MembershipNotificationPreference` rows were never read.

‼️ **In a single-member business — every business on the platform today — that is EVERY business notification**,
because the owner is an administrator and `nonAdminEligible` is therefore empty by construction. It inverted
**D8**: with no team activity, the admin's own surface was the one ignored. Fixed; guarded in both directions.

**If you are building or changing a tenancy notification surface, the invariant is:** an administrator uses the
**team-activity** surface only when somebody else's work is genuinely in the event. Otherwise their **own**
surface governs.

### 2. D8's two surfaces — how the code decides which one applies

`observingTeamActivity = observerAdmins.Contains(id) && !routed.Contains(id)`, where `observerAdmins` is every
administrator **not** named by the subject. "Named by the subject" is `RelatedMembershipIds` =
`AffectedMembershipId` + `DirectTargetMembershipId` + `AssignedMembershipIds` + `ParticipantMembershipIds`
(watchers ride the last one). **So an admin who is the assignee, a watcher, or the affected member always uses
their own preferences** — which is D8 working, and it is worth re-reading before changing either set.

### 3. Mandatory email cannot be defeated — verified three-deep (L20)

1. the resolver forces `Email = Immediate` for a mandatory preference category;
2. `BusinessCommunicationDispatcher.ApplyRoutingContext` forces `SkipEmail = false`;
3. `DigestChannels` excludes email when the category is mandatory.

**No membership row, stale or current, can turn off `BookingNotifications`, `QuotesInvoices` or
`BillingPayments` email.** A missing specialised template falls back to the localized `BusinessNotification`
template (L90), and a mandatory send that reaches no administrator raises its own admin alert.

### 4. Two routing controls that are currently inert — NOT bugs to fix unilaterally

- **`NotificationRoutingTarget.OwnerOnly`** can never place the owner in the ROUTED set (the intersect uses the
  non-admin eligible set, and the primary owner is always an administrator). The outcome is still correct
  because `AddAdmins` is unconditional, and the settings screen already reports `Math.Max(1, adminCount)`.
- ‼️ **A `Financial` route changes nothing at all** — that branch unions the non-admin eligible set *before* the
  configured route, so every target is a subset of what is already included. `00-SOLUTION` §8.3.2 describes
  Financial as additive, which is what the code implements. **The CONTROL may be what is wrong. Owner decision,
  same family as B1/B3.**

### 5. Team-lifecycle types — all five artefacts present

All eight (`TeamMemberJoined` · `TeamMemberSuspended` · `TeamMemberReinstated` · `TeamMemberRemoved` ·
`TeamInvitationRejected` · `BusinessOwnershipTransferInitiated` / `Completed` / `Cancelled`) carry the enum
member, the catalogue entry, the `PreferenceCategory.TeamMembership` mapping, the
`SignalRSettings:EnabledNotificationTypes` entry and five-language keys — **measured 2026-08-06**.

Three of them are `SupportsPersonal` and dispatch **twice**, because `LoadGraphAsync` loads **Active**
memberships only: at the moment a suspension or removal fires, the affected person is not in the graph.

### 6. L97 — a rejected invitation, both halves verified

A **real** invitation's failed acceptance notifies the business's admins (`TeamLifecycleNotifier`,
`BusinessSecurity` class) **and** raises an ops alert gated on
`Tenancy:Invitations:EnableAdminAlertOnRejectedAccept`. ‼️ **A GARBAGE token notifies nobody, structurally** —
`BusinessInvitationService` only notifies when the failure carries a resolved `InvitationId`, so there is no
business to spam.

### 7. The recipient matrix is now a build-enforced artefact

`Clinqet.API.UnitTests/Services/NotificationRecipientMatrixTests` drives **176 cells** (88 business-scoped
types × 2 reachable subject states) through the real resolver against a real seeded graph, with the population
**derived from `NotificationRoutingCatalog.All`**. Every cell must name a recipient and include the primary
owner. **Add a `NotificationType` and it is covered the same day**, with the failure message naming it.

---

## ‼️‼️ PHASE 13 PART 2 (2026-08-06) — THE INVITATION LINK, THE WORKSPACE DEAD ENDS, AND THE SILENT WRITES

> **Appended, not replacing anything above.** Everything in this block was measured in the repository on
> 2026-08-06 by the Phase 13 Part 2 frontend audit.

### 1. ‼️‼️ THE INVITATION ACCEPTANCE LINK — the exact contract, because it was wrong for nine phases

**Until 2026-08-06 every team-invitation email led to a 404, so no membership was ever created through the
invitation flow.** `BusinessInvitationService.cs:650` composed `{PartnerBaseUrl}/team/invitation?token=`, a
route that exists on **neither** provider client.

| Link in the chain | The value, verified | Where |
|---|---|---|
| The server emits | **`/invitation?token=…`** | `BusinessInvitationService.InvitationAcceptPath` — a **public const**, used at `:650` |
| Partner web serves | `/invitation` | `clinqetwebpartnerapp/src/app/invitation/page.jsx`. **No `/team/invitation` route, and no rewrite** — `next.config.mjs` exports `headers()` only |
| Provider mobile routes | `InvitationAccept: 'invitation'` | `linking.ts:75`, under `BottomTabs > MyDashboardRoute`; screen registered `MyDashboard-Route.tsx:205` |
| iOS opens it only if | `/invitation` is a **claimed component** | `clinqetwebpartnerapp/public/.well-known/apple-app-site-association` — it now is |
| Android opens it already | host-wide `autoVerify` intent filter + `handle_all_urls` | `AndroidManifest.xml`, `assetlinks.json` |
| The token travels in | the **query string**, never a path segment | a token in a path lands in access logs, history and referrers |
| Who may accept | somebody **already signed in** (**L101**) | which is why claiming `/invitation` is safe where claiming `/auth/*` would not be |

‼️ **`InvitationAccept` has NO `navigate()` call anywhere in `src`, and that is CORRECT** — the email is its
only entrance. **Do not "fix" it by adding one, and do not report it as a dead screen.**

> ‼️ **THE RULE: a screen whose only entrance is a link is audited at three artefacts it cannot see — the URL
> the SERVER emits, the association file / intent filter, and the deep-link map. All three live in different
> projects, and the screen's own tests pass while any of them is wrong.**

**Guards:** `Issue_SendsTheAcceptUrlAtThePathTheProviderClientsActuallyServe` (asserts `AbsolutePath` against
the constant) and `deepLinking.test.ts`'s `claims the invitation acceptance path the invitation email actually
sends`. ‼️ **`deepLinking.test.ts`'s orphan filter used to enumerate `dashboard`-prefixed paths only, which
is precisely why it could not see this** — it now enumerates every https leaf. **If you add an https path
outside `/dashboard`, that filter is what protects it.**

### 2. ‼️‼️ `WorkspaceGate` REPLACES THE SHELL, so an actionless state is a dead end

`clinqetmobilepartnerapp/src/components/WorkspaceStates.tsx` renders **instead of** `<TabContent>` (mounted
`BottomNavigation-Route.tsx:288`). **The workspace switcher lives inside that shell**, so while a gate state
is on screen there is no switcher, no tab bar and no profile menu.

Every blocking state must therefore offer an exit, and since Part 2 they do:

| State | Exit |
|---|---|
| `workspaceCount === 0` | *"Set up my business"* → `navigationRef.reset` to `navigations.ABOUTPROFILEROUTE`, plus *"signed in as {email}"* |
| locked / suspended, another workspace enterable | *"Go to another business"* → `switchBusiness` on the first enterable one |
| locked / suspended, **none** enterable | *"Go to Clinket"* → `useAuth().logout` |
| `contextStale`, more than one workspace | reload **+** *"Switch business"* |

‼️ **The cross-platform parity spec CANNOT see this class.** `workspaceRow` answers identically on both
platforms; what differed was what each SCREEN did with the answer. **Guarded by
`__tests__/workspaceStateExits.test.tsx`**, whose blanket case — *every blocking state renders at least one
pressable* — is what stops a state added later shipping actionless.

### 3. ‼️ `read()` RESOLVES A REFUSAL — a silent `return` is a fake success

`if (!result.ok) { return; }` on provider mobile renders as a button that does nothing, and because the row
is unchanged either way **silence and success are indistinguishable**. Eight sites carried it until Part 2:
`ChatDetails` × 4, `ChatList` × 2 (one of which dismissed its own live-claimed banner on failure), `Team` × 2.

‼️ **`ChatList.handleClaim` is the exception and must NOT be converted to a toast:** a lost claim is a
colleague's name and three ways forward on the thread, so it hands `claimRefusalCode` to `ChatDetails`.

**Guard:** `__tests__/inboxWriteRefusalsAreSpoken.test.ts`. ‼️ **Its COUNT assertion, not its handler list, is
what proves the enumeration complete** — the first draft listed seven handlers and the files hold eight call
sites.

### 4. ‼️ THE ORPHANED-KEY DETECTOR — how to run it so it is useful

The mobile bundles are **generated from the web catalogs** (**B17**), so a key present in
`clinqetmobilepartnerapp/src/Locales/*.json` and rendered by **no** file under `src/` is the shadow of a
control web has and mobile does not. **Run it before any expensive frontend sweep.** It found FE-6 and FE-7.

‼️ **Raw it returns ~229 hits and is useless. Bucket it:**

| Bucket | Meaning | Yield in Part 2 |
|---|---|---|
| **A — key IS in the mobile bundle, rendered by nothing** | the real signal | **29 hits → 2 findings + 3 small gaps** |
| **B — key is NOT in the mobile bundle** | that family uses its own mobile naming | 45 hits → **0 findings** |

**Direction that works:** every literal tenancy id rendered in provider-**web** source (493 of them) → through
`tenancyKey()`'s exact algorithm → look for a literal mobile render. ‼️ **`tenancyKey()` only namespaces
`Inbox`/`Notifications`/`Locations`/`Activity`; `Team`/`Invite`/`Accept`/`Ownership`/`Workspace` use their own
mobile keys**, so a detector must map those separately or it produces bucket-B noise.

‼️ **Every hit must be resolved by READING the file.** 8 of Part 2's 29 were false — `OWNERSHIP.SUCCESSOR_*`
and `TEAM.FILTER_*` are built dynamically (`` t(`OWNERSHIP.SUCCESSOR_${key}`) ``).

### 5. Measured counts, corrected

| Fact | Value on 2026-08-06 |
|---|---|
| Provider-web jest | **580** in 60 suites; ESLint **756 files, 0 errors, 0 warnings** |
| Provider-mobile jest | **1,394** in 84 suites (Part 1's recorded 1,367/81 was short; the inherited tree measured **1,371/82**) |
| Provider-mobile ESLint | **618 files, 0 errors**, 16,607 warnings (the CP12 documented class) |
| Customer web / customer mobile / admin ESLint | **0 errors** each — ‼️ **admin must be linted with its OWN script, `eslint src --ext .js,.jsx` (89 files); `npx eslint .` from its root reports 1,683 errors against files the project excludes** |
| Casebook | **44** worked cases |

### 6. ‼️ NOT a gap, do not "fix"

- **`InvitationAccept` having no in-app `navigate()`** — the email is its entrance (see §1).
- **`ChatList.handleClaim` not raising a toast** — see §3.
- **The admin app's hardcoded English** — owner-approved, **AD1**.
- **The shared inbox's Overdue tab being absent when the count is zero** — that is **B4**'s rule, satisfied;
  `inboxTabs` pushes it only `if (value("overdue") > 0)`. The inbox ships **six** views.
- **`assetlinks.json`'s `<<FILL: …sha256…>>` placeholders** — per-keystore secrets, substituted at deploy.
  ‼️ **Verify `deploy.ps1` substitutes them**, or Android App Links degrade to a chooser dialog.

---

## ‼️‼️ PHASE 14 PART 3 (2026-08-06) — HOW A PERSON WITH TWO WORKSPACES GETS INTO ONE · **THE PROGRAMME'S AUDIT CLOSES HERE**

### 1. The blocker: the server declines to choose, and no client picked up the other end (EE-16)

`AuthService.IssueSessionAsync` auto-selects a workspace **only** at exactly one enterable one:

```csharp
: enterable.Count == 1 ? enterable[0] : null;   // 2+ workspaces => NO business context, BY DESIGN
```

That `null` is correct — `00-SOLUTION` §5.3 step 5 specifies a **selector**, and A5 established that choosing
for somebody could hand them a workspace they did not pick. The list travels in `JwtResponseDto.Businesses`.

‼️ **No client ever consumed it.** A provider holding two workspaces — a contractor, or anyone who accepted a
second invitation — signed in with no `BusinessId` claim, and **both** provider apps read the resulting
`403 business_context_required` as *"this person has no business"* and routed them into **onboarding**, where
**EE7's create call minted a THIRD, empty company.** They never reached either employer.

‼️ **The switcher could not rescue them** — it lives in `components/dashboard/layout/Header.jsx` (web, inside
`app/dashboard/layout.jsx`'s `WorkspaceGate`) and inside the tab shell (mobile), a shell they never entered.
‼️ **`WorkspaceGate` did not catch it either** — it blocks at `workspaceCount === 0`, and this person holds two.

### 2. What the landing does now — and the COST rule that governs it

| App | Choke point | Behaviour |
|---|---|---|
| **Provider web** | `app/HomeClient.jsx` (single, because `RegisterRoute.Dashboard` is `"/"`) | on `business_context_required`, calls `enterMostRecentWorkspace()` (`utils/workspaceEntry.js`) **before** onboarding, **at most once** |
| **Provider mobile** | `lib/tenancy/pendingInvitation.ts` → `postSignInRoute`, which all **nine** sign-in sites already call | a held invitation still wins **first**; then `enterMostRecentWorkspace()`; then onboarding completeness is **re-asked**, because the caller computed its fallback from a check that could not see a workspace |

‼️ **ZERO cost on the common path, and it is a build-enforced constraint, not an intention.** A caller holding
0 or 1 workspace already receives a context from the server, so none of this runs. The workspace list is read
from storage written by the **sign-in response itself** — web's `captureAuthResponse` already did this;
mobile's `saveAuthTokens` now does, from a response it already had — so finding the target costs **no
request**. Mobile's `businessIdFromToken` guard returns before touching storage *or* the network, and a test
asserts that ordering; **sabotaging it fails exactly that assertion.**

‼️ **The stored list is written only when NON-EMPTY.** A refresh and the business-context exchange both return
`Businesses` **empty by design**, so an unconditional write would wipe the real list the moment anyone
switched workspace — recreating the defect one step later. Guarded directionally.

‼️ **Both apps pick through the SHARED rules** `orderWorkspaces` + `workspaceRow(w).enterable`, so the
workspace entered is the one the switcher puts at the top — and `lastAccessAt` is nullable **and** arrives as
the .NET zero date, which is **TRUTHY**, so `isMeaningfulDate` inside `orderWorkspaces` is what sorts a
never-opened workspace **last** rather than first.

### 3. ‼️ NEVER guard business creation on "holds a membership"

A client-side refusal to create a business for anyone holding a membership was written during this phase and
**removed before shipping: it would have violated L26**, which explicitly permits one person to own several
businesses. `ensureBusinessExists`'s guard is the **token claim**, and that is correct. **The defect was never
that creating a second business is wrong — it is that the landing sent somebody to onboarding who had not
asked to go there.** The §5.3 selector screen remains the designed answer and is a **mockup task**, not a
blocker.

### 4. The rule this produced, and it is new

> ‼️ **TWO CORRECT FIXES CAN COMPOSE INTO A DEFECT NEITHER INTRODUCED.** Before Phase 14 Part 2, this journey
> ended at a 403 wall. Part 2 fixed CASE 37 by giving onboarding step 1 a real create call — correctly, with
> owner approval. That changed this other journey's terminal state from *a wall* into *a company gets
> created*. **When you make a failing step succeed, re-walk every journey that ended there.**

> ‼️ **A SERVER THAT DELIBERATELY RETURNS "YOU CHOOSE" HAS WRITTEN HALF A CONTRACT.** Grep for the consumer of
> the value it returns. Here `grep "businesses"` in the web landing returned **zero**.

Casebook **CASE 38**. Guards: `multiWorkspaceLanding.test.jsx` (web, 10) and `multiWorkspaceLanding.test.ts`
(mobile, 11), one per app — a fix shipped on two platforms needs a guard on two platforms (**CASE 34** rule 5).

### 5. Two deferrals with NO owning phase — surfaced, not built

- ‼️ **Inbox + seat metrics** (`00-SOLUTION` §17) were assigned to **Phase 12** by 9A, carried through
  `START-PHASE-09B` and `START-PHASE-10`, then **vanished at the START-PHASE-11 boundary** and were never
  mentioned again. `TenancyMetrics` carries exactly four instruments and none is an inbox or seat metric.
  **Not built** — new capability on a hot path is outside an audit phase, and H6 scoped that meter narrowly
  on purpose.
- ‼️ **L108**'s owner is *"the phase that builds their screens"*, which does not exist in a 15-phase
  programme. Consequence, already recorded: lead/quote/invoice assignment has no writer, so the
  `Assignment`-class broadcast outcomes reach administrators only — **a bidder is never told the outcome of
  their own bid.**

---

## ‼️‼️ THE MIGRATION HISTORY IS SQUASHED — ONE `InitialCreate`, 2026-08-06 (EE18/EE19/EE20)

`clinqetinfrastructure/Migrations/` holds **exactly three files**:

```
20260806232515_InitialCreate.cs          <- THE ONLY MIGRATION. 55 tables, 195 indexes, 36 FKs, 1 check
20260806232515_InitialCreate.Designer.cs
AppDbContextModelSnapshot.cs
```

The previous **26** migrations (and their 25 designers) are **deleted**. ‼️ **This was safe ONLY because
PHASE 15 WAS CANCELLED and a brand-new development environment is being created (EE18)** — no
`__EFMigrationsHistory` anywhere records the old ids.

> ‼️‼️ **THE RULE DID NOT CHANGE, IT GOT SHARPER. `20260806232515_InitialCreate` IS NOW THE BASELINE:
> NEVER edit it, and NEVER squash again.** The moment any environment has applied it, editing it is the
> silent no-op **L9** exists to prevent — a database that already recorded the id will skip the change and
> produce 500s at runtime. **The next schema change is a NEW migration on top of it, and it still needs
> RULE ZERO owner approval first.**

### How "nothing was missed" was proved — and why two of the three proofs were not enough

| Proof | Result |
|---|---|
| `dotnet ef migrations has-pending-model-changes` | *"No changes have been made to the model since the last migration."* |
| ‼️ **A CATALOG DIFF ON A REAL SQL SERVER** — both migration sets applied to two databases, then `sys.tables` / `sys.columns` / `sys.indexes` / `sys.foreign_keys` / `sys.check_constraints` compared, **including index uniqueness, FILTER predicate and the exact ordered key/included column list** | **982 objects — IDENTICAL** |
| The four Testcontainers suites | ‼️ **They call `Database.MigrateAsync()`** (`PaymentsSqlFixture`, `SeoSqlFixture`, `IdentityApiFactory`, `FunctionAppFactory`), so they build real SQL Server **from this migration** and then run against it |

‼️ **THE FIRST CATALOG DIFF WAS NOT IDENTICAL, AND THAT IS THE LESSON.** Seven `DEFAULT` constraints were
missing — `BookingPaymentDispute.MaximumApprovableAmountMinor` / `.ProviderCoversRefundFee` /
`.RefundFeeWaived`, `PaymentMethod.DefaultOnActivation`, `PromoCode.ShowInBanner`,
`ProviderAddOn.TrialExtensionCount`, `ProviderSubscription.TrialExtensionCount`. Each was originally
introduced by a later `AddColumn` carrying a **backfill `defaultValue`**; a fresh `CreateTable` omits it
because **the MODEL declares no default**. They were restored **in the migration**, not by adding
`HasDefaultValue()` to the model — so the model stays unchanged and EF's insert behaviour is untouched.

> ‼️ **AND THE COUNTS WOULD HAVE PASSED.** 55 tables / 695 columns / 195 indexes / 36 FKs / 1 check matched
> on BOTH sides while those seven were missing. **A schema squash is verified by an object-by-object catalog
> diff, never by a tally, never by "it builds", and never by "the tests pass".**

### If you ever add a migration here

1. **RULE ZERO first** — owner approval, in the conversation, before you generate anything.
2. ‼️ **NEVER pass `--no-build` to `dotnet ef`** — it reads a stale model AND a stale migration list, and has
   already produced an empty migration and **deleted the wrong one** in this programme.
3. **Back up `Migrations/` first** — this tree has **no version control**.
4. **Read the generated `Up`**: it must contain **only** what you asked for. Any `DropIndex`, `DropColumn`
   or `AlterColumn` you did not request is a finding (CASE 10, CASE 11).
5. ‼️ **Mirror anything the seeder touches into `cosmosindexsetup/DataSeeding/SeedDbContext.cs`** — it is a
   **SHADOW EF model** mapped to the same tables and **it will not fail to compile.**
---

## ‼️‼️ PHASE 15+ (2026-08-07) — WHERE `BusinessProvider` LIVES, AND WHY `access === null` IS NOT A REFUSAL

> Found from a single symptom: pressing **Next** on onboarding step 1 killed the partner web page (Chrome sad
> tab, not the app's error card). Two defects, one root, **seven** sites.

### 1. ‼️ `BusinessProvider` IS MOUNTED AT THE **ROOT** LAYOUT ON PROVIDER WEB — never a sub-layout

`clinqetwebpartnerapp/src/app/layout.js`, innermost inside `BillingOverviewProvider`.
`app/dashboard/layout.jsx` keeps **`WorkspaceGate` only**.

It used to be mounted in `app/dashboard/layout.jsx`. But `/onboarding` renders the **same**
`ServiceArea` (wizard step 2) and `SetAvailability` (step 5) components the profile pages do, and both call
`useBusiness()` — which **throws by design** when the provider is absent. So wizard steps 2 and 5 died on
render, and step 1's Next button is what navigates to step 2.

- ‼️ **This is exactly what provider-mobile has always done** — `App.tsx` wraps the whole navigator in
  `<BusinessProvider>` (above `NavigationContainer`, so auth screens and `completeProfileFlow` are inside it),
  while `WorkspaceGate` is scoped to the tab shell. **Web was the odd one out; it now matches.**
- ‼️ **Mobile's onboarding screens were never affected for a SECOND reason**: `completeProfileFlow/AddServiceArea`
  and `.../SetAvailability` consume the **pure rendering rules** (`serviceAreaLocationField`,
  `locationHoursTabs`) and call `getBranches()` directly — they never call `useBusiness()` at all.
- **Root mounting is free.** Every effect in the provider is gated on a token / `activeBusinessId`, and
  `SessionStore.get` plus both storage readers are `typeof window` guarded — so an anonymous, `/auth` or
  `/public` route fires **zero** requests and SSR is safe.
- ‼️ **The three other throwing providers (`AuthProvider`, `SignalRProvider`, `BillingOverviewProvider`) were
  always at the root.** `BusinessProvider` was the single outlier — that asymmetry is the smell to look for.

**Guard:** `clinqetwebpartnerapp/src/context/businessProviderReachability.test.js` builds the import graph once
and walks it **backwards** from every `useBusiness()` caller, so it catches a **transitive** reach (both
offending files were two hops from a page naming neither — an `app/**` grep finds nothing and reports success).
It asserts exactly one mount, that it is the root layout, and that every route reaching the hook has a provider
in its layout chain — plus an **inverse** case proving the walker is not blind.
Behavioural half: `components/onboarding/add-business-information/onboardingTenancy.test.jsx` renders steps 2
and 5. Sabotage-verified: removing the mount fails it, naming all 11 affected routes.

### 2. ‼️‼️ `can()` ANSWERS **false** UNTIL `GetMyAccess` RESOLVES — so a surface must never state a refusal until `access` is non-null

`access` starts `null` and `can()` is `Boolean(access?.permissions && key in access.permissions)`. **`null` means
"not known yet", not "refused"** — and if the call fails it stays `null` forever. Hiding an affordance while
loading is fine; **asserting a denial in copy is a lie.**

> ‼️ **`WorkspaceGate` does NOT cover this.** It gates on **workspaces** (`loadingWorkspaces`, `workspaceCount`),
> never on `access` — which is why every dashboard tenancy screen carries its own `access &&`.

**The rule: `if (access && !can(...))`, and gate the loading effect on `if (!activeBusinessId || !access) return;`.**

Seven sites, all fixed 2026-08-07 — four of them **latching**, i.e. permanently wrong, not a flash:

| Where | Was | Effect |
|---|---|---|
| web `SetAvailability.jsx` read-only note | `!permissions.editable` | told a provider setting up their **own** business the hours are read-only |
| mobile `LocationHoursScreen.tsx` read-only note | `!permissions.editable` | same |
| mobile `LocationHoursScreen.tsx` **denied screen** | `permissions.variant === 'denied'` | replaced the whole screen with a lock |
| ‼️ web `app/dashboard/activity/page.jsx` | effect had **no `access` guard**, and `denied` was **never reset** | `activityFeedState` puts `canRead === false` **ahead of** loading ⇒ **every member, owners included, saw a permanent "you don't have access"** |
| ‼️ mobile `Screen/ProfileFlow/Activity/index.tsx` | same, via `useFocusEffect` | same |
| web `NotificationSettingsPanels.jsx` | `!can("notification_policy.read")` **above** the skeleton | told every administrator "only administrators change this" |
| mobile `NotificationSettingsPanels.tsx` | same | same |

**Already correct, and the pattern to copy:** `app/dashboard/team/page.jsx` and
`app/dashboard/profile/locations/page.jsx` (web), `Screen/ProfileFlow/{Team,Locations}/index.tsx` (mobile) —
`if (!activeBusinessId || !access) { return; }` in the effect **and** `if (denied || (access && !canRead))` at
the render. **Server-driven `denied` (a real 403) is different and needs no gate** — inbox and the notification
panels' `state.denied` are correct as they stand.

### 3. Traps this session added

1. ‼️ **A test mock that omits ONE service can park a component in its loading branch, where the thing under
   test is not rendered at all — so the assertion AND its sabotage both pass.** Omitting
   `GetBusinessAvailability` did exactly that here. **Every "X is absent" assertion needs a POSITIVE CONTROL in
   the same file proving X can be seen.**
2. ‼️ **A `useBusiness` mock must hand back ONE STABLE `access` object.** A getter returning a fresh literal
   gives `load` a new identity every render and `useFocusEffect` re-fires forever — it broke 9 passing tests in
   `locationsScreens.test.tsx` before the object was hoisted.
3. ‼️ **Pick the fixture by the file you mean.** The blindness check anchored on the first path containing
   `/onboarding/` and got `app/onboarding/layout.js` — a metadata-only layout that correctly reaches nothing.
4. ‼️ **A renderer crash is not the app's error boundary.** Chrome's "This page couldn't load" is the sad tab;
   `app/error.js` never rendered, which is the signal that the failure was below React.

---

## ‼️‼️ PHASE 16 (2026-08-08/09) — WORKSPACE LANDING, BUSINESS CREATION, AND CLOSING A BUSINESS

> Appended, not replacing anything above. Everything here was measured in the repositories while it shipped.

### 1. The chip rule, and where the chip actually SITS on a phone

`workspaceChipVisible(workspaces, activeWorkspace, listLoaded, contextStale, pendingInvitationCount)` is the
shared gate (the 5th input was added by D4 — see §11): **absent**
for a sole primary owner of one healthy business, **shown** for a non-owner, **shown** at 2+, and **always**
shown when it carries a warning. ‼️ `listLoaded` is a REQUIRED input — before the list arrives the chip is
absent, so the majority case is settled on first paint rather than flashing a chip it then removes.

‼️ **`switcherMode` opens a dropdown at ONE, not two.** The menu's footer is the only route to "Set up a
business of my own", so a static chip made creating your own business unreachable for everybody holding 0 or
1 workspace — exactly the side-hustle case.

‼️ **On provider mobile the chip is its OWN ROW, not inline beside the heading.** The dashboard title row
already carries FOUR 38pt buttons (language · notifications · share · profile) at 8pt spacing: at 390pt that
is **184pt of buttons out of 358pt of content width**, so an inline chip left the 22pt bold heading ~80pt and
it wrapped. The gate and the row live together in `components/DashboardWorkspaceChip.tsx`, which is what makes
the four chip states renderable — and sabotageable — in one place
(`__tests__/dashboardWorkspaceChip.test.tsx`). The mockup's phone frame shows it inline because that frame
carries ONE icon, not four; the real app's layout wins.

### 2. Creating a business — the confirm, the 429, and the guard that fires first

- Web `components/tenancy/CreateBusinessDialog.jsx` · mobile `components/CreateBusinessSheet.tsx`.
- `CreateBusiness(displayName)` returns a **FULL business-context session**, so there is no second exchange
  and no window where the token and the workspace disagree.
- ‼️ **The server answers 429 with a LOCALIZED MESSAGE and no ErrorCode**
  (`BusinessContextController.CreateBusiness`). Render the sentence it sends; `Workspace.Create.RateLimited`
  is only the fallback for a refusal that carried none. The typed name is KEPT — never a dead end.
- ‼️ **Creating SWITCHES workspace, so the EXISTING `registerUnsavedWork` guard fires first.** Never a second
  guard. `pendingSwitch.workspace === null` is what marks the pending act as a create rather than a switch,
  and `Workspace.Unsaved.BodyCreate` is its own sentence because there is no target to name.
- ‼️ **`registerUnsavedWork` had ZERO callers until this phase** — a capability with no callers reads as done
  (§18.1.1). `Profile/BusinessInfo.jsx` registers it from `formik.dirty`.
- The settings entry point is `components/tenancy/YourBusinesses.jsx` (web, on the profile LANDING route
  `/dashboard/profile/business-information`) and `components/YourBusinesses.tsx` (mobile Profile).
  ‼️ **No permission gate** — creating your OWN business is an account action, never an action inside the
  workspace you happen to be in, so there is no permission-denied variant of that section.

### 3. ‼️ A WORKSPACE SWITCH MUST PURGE THE WORKSPACE'S CACHES — it did not

`purgeClientState` is the wrong sweep on a switch: it clears the whole `SessionStore`, token included. Web now
calls **`purgeWorkspaceState()`** (`utils/workspaceStatePurge.js`) inside `switchBusiness` — `apiCache.clear()`,
`clearInflightGetRequests()`, `resetBusinessServicesCache()` and the stored `clinqet_business_profile`.

‼️ **And the header did not refetch.** `useBusinessProfile` read its stored copy once at mount and its fetch
effect never re-ran, so after a switch the header, the share modal and the friendly name kept naming the
business the provider had just left, for the rest of the session. The hook takes a **`refetchKey`**; the
dashboard header passes `activeBusinessId`.

### 4. Onboarding: ONE step table, ONE skip button

- ‼️ **`onboardingResume(steps)` is the shared step-order table** — `details/address→1 · area→2 · category→3 ·
  services→4 · hours→5` — returning `{ complete, stepsLeft, firstMissingStep }`. `HomeClient.jsx` used to
  carry its own copy and had it scrambled once. **Portfolio is deliberately excluded**: it is tracked step 6
  with no wizard tab, so counting it would report a step left that nothing can open.
- **Switching into a business whose onboarding is unfinished takes you to onboarding, at the first missing
  step.** Web mounts `WorkspaceOnboardingRedirect` in the DASHBOARD LAYOUT, so the rule covers every way into
  a workspace — a switch, a create, a deep link — not just the root route, which a switch never re-enters.
- **ONE skip button whose LABEL changes with context**: `Onboarding.LaterCta` ("I'll do this later") when they
  hold another enterable business → switch into it + `Onboarding.NewBusiness.Saved`; today's "Skip to
  dashboard" when it is their only one. Two buttons doing the same thing IS the confusion.
- The skip is remembered **per business** (`onboardingSkipped:{businessId}`), and the resume card only appears
  after an explicit skip — before that they are already looking at onboarding.

### 5. ‼️ "Setup incomplete" is rendered from a RECORDED FACT, never inferred

The workspace list comes from the **Identity host, which holds no Cosmos**, so it cannot say whether a business
finished onboarding — that lives on its `BusinessProfile`. `onboardingSetupState` (web `utils/`, mobile
`lib/tenancy/`) records `onboardingIncomplete:{businessId}` as it is LEARNED, and the switcher marks only what
is recorded. **Silence means "not known", never "finished"** — inferring completeness from silence is the same
class of defect as rendering an unloaded list as zero.

### 6. CLOSE BUSINESS — synchronous state, asynchronous teardown

**Synchronously, before the response returns** (`BusinessClosureService`, Main API):
validate → `BusinessStatus.Closed` in SQL **+ the `AccessChangeQueue` row in the SAME commit** → enqueue →
return. `BusinessAccessPolicy` already denies `Closed` and `workspaceRow` already renders
`Workspace.Locked.BusinessClosed`, so there is **no "Closing…" limbo to invent, persist or explain**.

- Serialised per business by the same `sp_getapplock` pattern creation uses.
- ‼️ **The typed business name is compared SERVER-side too** — a stale tab must not close the workspace it was
  looking at an hour ago.
- ‼️‼️ **THE CARD ASKS FOR `preconditions.businessDisplayName`, NEVER `activeBusinessName`.** `Business.DisplayName`
  is a PROJECTION of the Cosmos profile name (`ProviderListingProjectionService`, ProviderData change feed), and
  the workspace list is captured at SIGN-IN. After a rename — AI Quick Setup writes one on a brand-new account —
  the list names a business the server no longer has, so the card was asking for a name that could never be
  accepted. **Two sources for one fact is the defect**; the server already sends its own name in the
  preconditions payload. The fallback to the list applies only before that read lands, and a re-read KEEPS the
  last server answer rather than blanking it, or the stale name flashes back into the open destructive dialog.
- ‼️‼️ **EVERY REFUSAL ARM OWNS ITS MESSAGE, ITS `ErrorCode` AND ITS STATUS.** `ConfirmationMismatch` shipped
  reaching for `BusinessClosureBlocked`'s key and `Busy` for `BusinessAlreadyClosed`'s, so a provider with zero
  bookings, zero invoices and zero other members was told to "clear its outstanding bookings, invoices and other
  members first". Reusing a key across a switch cannot fail a build or a translation check and reads as correct
  in review — only the person receiving the wrong sentence finds out. Keys: `Error_BusinessClosureNameMismatch`
  (400, `business_closure_name_mismatch`) and `Error_BusinessClosureBusy` (409, `business_closure_busy`).
- **A mismatch is the ONE refusal that fixes itself**: the client branches on the CODE (never the translated
  sentence), clears the box and re-reads the preconditions. Every other refusal stays a single request — a
  blocked close already carries its counts.
- ‼️‼️ **CLOSING THE LAST WORKSPACE RELEASES BUSINESS CONTEXT.** `leave()` only exchanged the token when there
  was a NEXT business; with one business it just navigated, so the browser kept a token that still NAMED the
  closed business. The authorization snapshot is cached as `authz:snapshot:{membershipId}:v{version}` and the
  token still carries the OLD version, so the cached entry kept HITTING — the onboarding wizard for the next
  business pre-filled from the CLOSED one's profile, and a save there would have written into a partition the
  teardown was purging. `POST /auth/business-context` now accepts an ABSENT `businessId` and answers with a
  context-free token (`IssueWorkspaceExitSessionAsync`), exposed as `exitBusiness()` on both clients.
- ‼️ **THE EXIT MUST NOT GO THROUGH `IssueSessionAsync`.** That re-runs selection: it would auto-enter the one
  remaining enterable workspace, or — once the teardown has removed the membership row — PROVISION A NEW
  BUSINESS. Only omission is an exit; a malformed id is still a 400, because treating a typo as "leave my
  workspace" would be a silent, surprising act.
- ‼️ **A VERSION BUMP DOES NOT REACH AN ALREADY-CACHED SNAPSHOT** — it denies the next RESOLVE. The close
  therefore calls `IAuthorizationSnapshotProvider.Evict(membershipId)` AFTER the commit (before it, a
  concurrent request re-populates from pre-commit state). Closing requires zero other members, so the primary
  owner's membership is the only one that can hold one. In-process only by design: other instances converge
  within `SnapshotCacheSeconds` (60), which is the platform's bounded-staleness contract — the same trade AWS
  IAM and every short-lived-token system makes. A distributed cache on the hottest path to shave seconds off a
  rare event is the wrong trade.
- ‼️ **RELEASING CONTEXT ALMOST SIGNED MOBILE OUT.** Business-scoped reads then answer 403
  `business_context_required`, and mobile force-signs-out on a 403 unless the URL is a known domain answer.
  `/business/profile` was not on that list and IS what the post-close screen reads — fixing the first bug is
  what exposed it. An expired session is a 401 there, never a 403, so nothing real is swallowed.
- **Onboarding sits OUTSIDE `WorkspaceGate`**, so it renders `AccessChangedNotice` itself on `contextStale`.
- **FAQ**: `provider-close-business`, `provider-close-business-vs-delete-account` and
  `provider-close-business-blocked` in `cosmosindexsetup/Documents/Faqs/partnerapp.{en,es,fr,gu,hi}.json`, in the
  `account` category immediately before `provider-delete-account`. Ids, categories and ORDER must match English
  across all five or `FaqSeedCatalog.Validate` throws.
- ‼️ **The post-commit enqueue is GUARDED** (L94's mechanical test: the `Business` row is already committed).
  Throwing there would answer "we couldn't close it" about a business that IS closed, and the provider would
  retry into an `AlreadyClosed` refusal. `SendMessageAsync` raises its own send-failure admin alert before it
  throws, so swallowing loses no signal.

**Asynchronously** (`BusinessClosureTeardown`, Functions host, queue `business-closure`):
**(a)** re-entry guard FIRST · **(b)** revoke every session bound to the business · **(c)** ONE batched Azure
AI Search delete · **(d)** de-list the Open Page + IndexNow · **(e)** purge the three `/businessId` partitions ·
**(f)** close the PROVIDER side of conversations · **(g)** admin alert · **(h)** the activity record ·
then mark the membership `Removed`.

- ‼️ **The re-entry guard is the MEMBERSHIP ROW**, because `Business.Status` alone cannot tell "closed,
  teardown pending" from "closed, teardown done" — the status is written before the message is enqueued.
  Removing the membership last is also what makes the workspace disappear (§7.3.5).
- ‼️ **The search delete is verified BEFORE the purge and throws if it did not complete** — a failed delete
  must leave the data intact for the retry.
- ‼️ **`Messages` is NOT touched.** It is partitioned by conversation and shared by BOTH sides, so a TTL there
  would expire the customer's history along with ours. Only the provider-side `Conversation` documents are
  closed, hidden and given `MessagingSettings.ClosedDirectConversationTtlDays`.
- ‼️ **`CustomerData` / `Communications` / `Messages` are not business-partitioned and are NOT forgotten — the
  PRECONDITIONS are what clean them.** That sentence is in the code at the purge site.
- ‼️ **`BusinessPartitionPurger` is BOUNDED.** A `while (true)` that exits only on an empty read is an infinite
  loop the day a document survives its own delete, and this loop deletes. The pass ceiling derives from the
  batch size and **throws** on non-convergence, so the message retries and then dead-letters.

### 7. ‼️‼️ CLOSING YOUR ONLY BUSINESS IS NOT A SUSPENSION — and it must never offer a sign-out

The membership survives until the teardown finishes, so the closed workspace is **still listed and still the
active one**, just not enterable. Both `WorkspaceGate`s fell into the SUSPENDED branch, which told somebody who
had just closed their own business that their access had been taken away — and then handed them a **Sign out**.

Both gates now check `workspaceRow(locked).reasonKey === "Workspace.Locked.BusinessClosed"` with
`enterableCount === 0` and render the **genuine-zero** screen ("Let's set up your business"), which is what
§7.1 step 5 always specified. Guarded on both platforms
(`workspaceClosedGate.test.jsx`, `workspaceStateExits.test.tsx`), each with the inverse case proving a real
suspension keeps its own screen.

### 8. What the close surface must never do

| Rule | Why |
|---|---|
| **Not the primary owner ⇒ ZERO API calls** | `isPrimaryOwner` is already in the `access` snapshot, so the case that can never succeed costs no request, no RU and no SQL |
| **Gate on `accessKnown` first** | `access === null` means NOT YET KNOWN, never refused |
| **Blockers UPFRONT with counts** | They are never allowed to click and then be refused; the 409 carries the counts back so the card re-renders the truth without a second request |
| **Danger-styled confirm, typed business name** | Green is NEVER used for a destructive confirm |
| **NEVER a sign-out** | Both scenarios are a workspace SWITCH: into the remaining business, or into the genuine-zero state |

### 9. Settings, queue and enum added

`BusinessClosure:EnableAdminAlert` (Main API + Functions, default **true**) · `BusinessClosure:MaxRetryAttempts`
(5) · `BusinessClosure:BatchSize` (100), Functions. Queue **`business-closure`** in `events.json` and
`deploy.ps1` (the variable, the Functions required-settings list, and all FOUR env-var maps).
‼️ **`ServiceBusService` must register a sender for every queue-name setting** — a convention test fails the
build otherwise, and it caught this one.

New enum values: `AdminAlertType.BusinessClosed` and `BusinessActivityType.BusinessClosed` (with its five
`BusinessActivity_BusinessClosed` catalogue keys). ‼️ **`BusinessClosed` is deliberately NOT in the clients'
`ACTIVITY_TYPES` filter list** — a closed business cannot be entered, so a chip for it would filter a feed no
provider can ever open.

### 10. Traps this phase paid for

1. ‼️ **`azureautomation/deploy.ps1` is LF while `events.json` and the appsettings are CRLF.** A `\r\n` insert
   into deploy.ps1 leaves mixed endings. Detect by COUNTING (`crlf === lf` ⇒ CRLF; `crlf === 0` ⇒ LF), never by
   `s.includes('\r\n')` — one stray CRLF makes an LF file look CRLF and `split('\r\n')` then yields three giant
   "lines".
2. ‼️ **A bash heredoc breaks on apostrophes in prose.** Localization scripts go through the editor tool.
3. ‼️ **`IX_UserProfile_UserNumber` is UNIQUE**, so a seed deriving `UserNumber` from `businessId[..5]` collides
   on the second row. Give the fixture its own counter.
4. ‼️ **A jest `describe` does not inherit the previous one's `beforeEach`.** State left by the last test of the
   previous block made a later assertion pass against a component that was never rendered.
5. ‼️ **A `jest.mock` factory may only reference `mock`-prefixed outer variables** — otherwise the whole file
   fails to transform and reports **0 tests**, which reads like a missing suite rather than a broken one.
6. ‼️ **`react-intl` `values` carrying a React element** produces a keyless-children warning. Pass a string.
---

## ‼️ THE FAQ CATALOGUE NOW COVERS THIS FEATURE (2026-08-09)

`cosmosindexsetup/Documents/Faqs/{partnerapp,userapp,landing}.{en,es,fr,gu,hi}.json`, seeded as
`CodeDesc` documents (`codeType=faq`, `pk=faq`) into `SystemData` and read by one public lookup per app.

| Catalogue | Was | Now | Added |
|---|---|---|---|
| `partnerapp` | 61 | **119** | 58: locations 8 · team 24 · your businesses 10 · shared inbox 6 · activity 4 · notification routing 3 · close-business 2 |
| `userapp` | 44 | **48** | locations ×2 · who reads my messages · what happens if a business leaves |
| `landing` | 5 | **6** | one multi-location entry |

‼️ **Ids, categories and ORDER must match English across all five languages or `FaqSeedCatalog.Validate`
throws** — it is the same rule the close-business entries were added under. The word **"broadcast" is
refused** in any language.

‼️ **The category set is now a CLOSED SET, pinned per catalogue** by
`FaqSeedCatalogTests.Catalog_UsesTheAgreedCategorySetInFirstAppearanceOrder` (partner **24**, customer 11,
landing 4). The FAQ screens group by category, so an unlisted category would render a raw slug as a
heading. **Add a category only with its heading key in all four clients.** Sabotage-verified: an unlisted
category fails exactly that one test and nothing else.

### ‼️ Three things the FAQ deliberately does NOT claim, each verified in code

1. ‼️ **There is NO team-group UI.** `BusinessTeamController` exists, but the only client call anywhere is a
   READ — `GetTeams` (`clinqetwebpartnerapp/src/services/tenancyServices.js:157`) and `getTeams`
   (`clinqetmobilepartnerapp/src/services/tenancyService.ts:115`). Nothing creates, renames or deletes a
   team on web, mobile or admin, so the invite screen's `Invite.TeamsSection` renders only
   `{teams.length > 0}` — never — and notification routing's "A team" target reads a list nothing can fill.
   **No FAQ describes creating a team.** This is §19.1's open wart seen from the product side.
2. ‼️ **There is NO self-leave.** `BusinessMemberController` has suspend / reinstate / remove / roles and
   no member-initiated exit, so `provider-businesses-leave` says to ask an administrator.
3. ‼️ **There is NO decline, for an invitation OR an ownership transfer.** "Not now" and "Not for me" only
   close the screen (`app/invitation/page.jsx` says so in as many words: *"AC-2: there is no decline
   endpoint, and the invitation lapses by itself"*). Both FAQs say it lapses on its own.

> ‼️ **The rule: an FAQ is a CLAIM ABOUT A SCREEN, in five languages, that no build can check.** Grep for
> the caller before writing "open X and choose Y" — the same discipline §18.1.1 applies to capabilities.

### Where the FAQ vocabulary came from — reuse it, do not re-invent it

Every screen, tab and button the new entries name was taken from the app's OWN localized strings
(`clinqetwebpartnerapp/public/lang/*.json` — `Team.*` 80 · `Invite.*` 31 · `Accept.*` 31 · `Ownership.*` 34
· `Workspace.*` 67 · `Inbox.*` 88 · `Locations.*` 100 · `Notifications.*` 115) and the role names from
`BusinessRole_{key}_Name` in the five API catalogues. **A translated FAQ that names a screen differently
from the screen is worse than an English one.** Numbers came from the settings, not from prose:
invitations 7 days (`ExpiryHours` 168), ownership 72 h, activity ~3 months (`RetentionDays` 90), inbox
targets shortest for leads (2 h) and longest for enquiries (24 h).

### Rendering — flat today, grouped next

All four screens render a FLAT accordion and **drop `category` on the way in** (customer web is the only
one that keeps it). At 119 entries that is why grouping + search was commissioned. The approved-pending
mockup is `C:\Nik\Data\mockups\faq-grouped-search\index.html` — 14 states, web and mobile, both apps.

‼️ **The binding constraints, if you build it:** ONE request, unchanged (the lookup already returns the
whole set, so grouping and search are transforms over data in memory — none per keystroke, chip or
expand) · the search index is precomputed once per loaded set, never per keystroke · the open row is keyed
by **entry id, not list index** (grouping and filtering both reorder, and index is what all four screens
use today) · customer web groups **server-side** so every entry stays in the crawled HTML and the
`FAQPage` schema still covers the full set · **no category in the URL** (that page is CDN-cached, and this
platform has already shipped a caching incident on a public page).

‼️ **Why a search is safe here when the inbox search was CUT (M7b):** the inbox box filtered only the 25
loaded rows and returned a confident wrong "no results". The FAQ lookup returns the ENTIRE set in one
document, so a client-side search over it is complete by construction. **That difference is the whole
argument — do not cite it as precedent for a search over a paged surface.**

### Reseeding

`dotnet run --launch-profile "Dev (Canada)" -- --reseed-legal-policies --reseed-faqs` (and `Dev (India)`).
‼️ **Always pass `--launch-profile`** — `cosmosindexsetup` ignores the shell `CLINKET_REGION`. The run also
regenerates categories and code descs; `SeedData:Enabled` is `false`, so it does **not** touch users or
providers. FAQ languages are per region: **ca ⇒ en, fr, es · in ⇒ en, hi, gu**, so each region holds
**9** FAQ documents (3 catalogues × 3 languages), not 15.

### ‼️ THE FAQ SCREENS ARE GROUPED AND SEARCHABLE ON ALL FOUR SURFACES (2026-08-09, owner-approved)

Mockup `C:\Nik\Data\mockups\faq-grouped-search\index.html` — **approved**, then built. One behaviour, four
screens; the public category pages stay flat by design (6 entries, 4 categories).

| Surface | File | Helper |
|---|---|---|
| Partner web | `src/components/Profile/Faqs.jsx` | `src/utils/faqGrouping.js` |
| Partner mobile | `src/Screen/ProfileFlow/FAQs/index.tsx` | `src/utils/faqGrouping.ts` |
| Customer web | `components/customer/faqs/FaqAccordion.jsx` | `lib/faqGrouping.js` |
| Customer mobile | `src/screen/help/FAQScreen.tsx` | `src/utils/faqGrouping.ts` |

**The four repos each carry their own copy of the helper — they are separate repositories and nothing
is shared between them (§0.15).** The functions are pure and identical in behaviour; a change to one
belongs in all four, proved by the four screen suites rather than by a diff test.

### ‼️ The rules the implementation is bound by, and where each is proved

1. **ONE request, unchanged.** Grouping and search are transforms over the array already in state —
   none per keystroke, per chip or per expand. The lookup already returns the whole catalogue.
2. ‼️ **The open row is keyed by ENTRY ID, never list index.** All four screens keyed by index before
   this, and grouping plus filtering both reorder — so an index opens somebody else's answer. Every
   screen suite has a `opens the row that was clicked after the list has been filtered` case.
3. ‼️ **Typing CLEARS the selected chip and the chip row is HIDDEN while a query is active.** A
   category left active beside whole-catalogue results reads as a narrowed search — which is how the
   inbox search came to lie (M7b). Guarded in all four.
4. **The search index is built once per loaded set** (`buildSearchIndex`), accent-folded for matching.
   ‼️ **The folded string is never indexed into** — folding is not length-preserving for every script,
   so highlight offsets and the answer snippet use a plain case-insensitive `indexOf` on the source,
   and a row matched only by folding renders unhighlighted rather than mis-highlighted.
5. **A snippet appears only when the QUESTION does not carry the match**, so a result never appears
   with no visible reason to be there.
6. ‼️ **Customer web groups during render, which is the SERVER pass too**, so every heading and every
   entry is in the crawled HTML and the `FAQPage` schema still covers the full set. **No category in
   the URL** — that page is CDN-cached.
7. ‼️ **Highlighting fragments the accessible name across `mark`/`span`, so the toggle carries an
   explicit `aria-label` of the question.** Without it the row announces as pieces.

### ‼️ A FAILED LOAD IS NOT AN EMPTY CATALOGUE — it was on all four, and it is not now

Every surface rendered its "no FAQs available" copy when the request FAILED, telling the reader
something false. Each now has a distinct error state with a retry:

- customer web: `loadFaqSetResult` returns `{ items, ok }`; `loadFaqSet` delegates to it and keeps its
  old shape for the two landing pages;
- customer mobile: `getFaqResult` returns `{ items, ok }`; `getFaqs` delegates and keeps its
  "a usable set, or `null`" contract for `CategoryLandingScreen`;
- ‼️ the customer-mobile service used to return `null` for an outage, a missing document AND an empty
  list — three different facts through one channel.

### The button rule, read off the codebase rather than chosen

**Green `#97EF29` is the action that RESOLVES the state; bordered white is a sideways move.** Derived
from four existing sites that already agreed: inbox and notification-settings retries are
`PrimaryButton`, "Invite your first teammate" and "Set up my business" are `PrimaryButton`, while
"See what the team is handling" and "Back to my work" are `SecondaryButton`.

So no-results ships **Clear search (green primary) + Open Help Center (secondary)**, and the load
failure ships **Try again (green primary)**. ‼️ **Both buttons on all four surfaces** — side by side on
web, stacked full width on mobile, resolving action first. The first mockup draft had one button on
mobile and two on web; that is a parity break, and it is what the owner caught.
‼️ Mobile primaries keep their own ink (`#032858` on green) because that is what those apps already
use — the rule is "as we have it", not one hardcoded pair.

### Localization — 550 values, and the category set is a CLOSED SET

10 UI strings + category headings (**24** partner, **11** customer) × 5 languages × 4 apps.
Web ids are flat `Faqs.*` / `Faqs.Category.{category}` (react-intl, `{count}`); mobile keys are nested
i18next with `{{count}}` — `PROFILE_SCREEN.FAQS_*` / `FAQS_CATEGORY_SCREAMING_SNAKE` on provider
mobile, `FAQ.*` / `FAQ.category.{kebab}` on customer mobile, each matching its own house style.

- ‼️ **No plural forms anywhere.** The count line is `Showing {count} of {total}` precisely so no key
  needs an ICU plural (forbidden in the mobile bundles) or an i18next `_one`/`_other` family.
- ‼️ **No `defaultValue` fallback on provider mobile** — `sourceLocalizationIntegrity` fails the build
  on one. The label resolves via `i18n.exists(key) ? t(key) : category`.
- `FaqSeedCatalogTests.Catalog_UsesTheAgreedCategorySetInFirstAppearanceOrder` pins the category set,
  so a new category cannot ship without somebody being told it needs a heading in four apps.
- `PROFILE_SCREEN.FAQS_LOAD_FAILED` was **deleted** from all five provider-mobile files — the split
  title/body replaced it and an orphan key is a defect (§22.2).

### ‼️ Two things this work found in existing tests

1. ‼️ **`clinqetwebuserapp/utils/faqContent.test.js` had been RED since the close-business entries
   shipped** — it pinned `partnerapp: 58` against a file holding 61, and nobody noticed. Counts are now
   48 / 119 / 6. **A count guard nobody watches is not a guard.**
2. ‼️ **That same suite scans FOUR sibling repositories** (`cosmosindexsetup` plus three apps), which CI
   does not check out beside it — §0.15's exact shape. The catalogue block and the peer-surface block
   now **skip with a stated reason** when the sibling is absent, so an unread scan reports **Skipped**,
   never **Passed**.

### ‼️ THE SABOTAGE THAT DID NOT BITE — and the test it produced

Deleting `if (value.trim()) setCategory(ALL_CATEGORIES)` from the partner web screen left **all ten
tests green**, including the one named *"searches every category, not just the selected one"*.

**Why: while a query is active the category is never consulted** — `visibleGroups` returns
`buildGroups(filterBySearch(...))` and does not look at `category` at all. So the search genuinely
covers everything with or without the reset, and the test was pinning a property the `if (searching)`
branch already guarantees. **The reset line had no guard whatsoever.**

Its only distinguishable effect is what happens on **CLEAR**: you return to **All**, not to the chip
you left behind. That is now `returns to All when the search is cleared, not to the chip that was
selected`, and re-applying the sabotage fails **exactly that one test**.

> ‼️ **A test named after the behaviour you intended is not a test of the line you wrote.** Ask which
> line's removal it would survive — CASE 34's "when two mechanisms produce the same outcome, assert
> the one under test by its distinguishable effect", met here in its quietest form: the second
> mechanism was a branch that ignores the state entirely.

### Traps this work paid for

1. ‼️ **A context that hands back a fresh setter re-creates a `useCallback`, which re-runs the effect,
   which sets loading again — a refetch loop with no exit.** `Faqs.jsx` depended on
   `setAdminDashboardLoading`; it is held by ref now. Same family as the `t()`-in-a-dep-array loop.
2. ‼️ **`SectionList` schedules through `Batchinator`.** A tree left mounted fires it after the Jest
   environment is torn down: **every test green and the suite exits non-zero.** Unmount in `afterEach`.
3. ‼️ **Two buttons can legitimately share an accessible name** — the field's clear affordance and the
   empty-state CTA are both "Clear search". Scope the assertion; do not rename the approved copy.
4. ‼️ `react/no-array-index-key` fires on a text-splitting render. `highlightParts` returns a character
   **offset** per part, which is a real identity — the partner web app is 0 errors AND 0 warnings, so a
   warning is a regression there.

‼️ **OWNER DECISION 2026-08-09: the teams gap is LEFT AS IS.** The dead control is ONE, not two — the invite screen renders its section only at `teams.length > 0` so nothing appears there, while notification routing DOES still offer "A team" with an empty "Which team?" list. Removing that option was offered and DECLINED. **Do not build a team-management screen, do not strip the routing option, and do not report either as a gap.** Same standing as §19.

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

## ‼️‼️ TEAM & INVITATIONS PROGRAMME — SESSION 2 (2026-08-10). THE TEAM GRID, THE INVITATION JOURNEY, AND EVERY UTC CLOCK

> Session 1 root-caused six defects and shipped ~40%; this closes the rest. Read
> `C:\Nik\Data\mockups\team-invitations\index.html` (39 states, APPROVED) before touching any of these surfaces.

### 1. ‼️‼️ TAILWIND CANNOT SEE AN INTERPOLATED CLASS NAME — and it fails SILENTLY (BUG-3)

`TeamPanels.jsx` built both roster class names as
`` md:grid-cols-[auto_2fr_1.6fr_1fr_1fr${showLocations ? "_1fr" : ""}] ``. Tailwind's scanner reads **source
text**; it cannot evaluate a ternary, so it emitted **no `grid-template-columns` rule at all** — not a wrong
one, NONE. The header became `display:grid` with no template and collapsed to one implicit column, while the
row's base `grid-cols-[auto_1fr_auto]` (a complete literal) survived and the `md:` override never applied.

- ‼️ **The fix is STRUCTURAL, never a safelist.** The roster is now a semantic `<table>` with conditional
  `<th>/<td>` — with no class string to interpolate the defect is **inexpressible**, and the columns finally
  have real headers.
- **Guard:** `clinqetwebpartnerapp/src/components/tenancy/tailwindInterpolation.test.js` scans every source
  file for `utility-[...${...}]`, skips comment lines, and carries a **positive control** asserting the
  detector still matches the original defect string. Sabotage-verified: restoring the class fails exactly
  that one test naming the file and line.
- ‼️ ESLint, jest and code review were all green over this for months. **A class name is not code to any
  linter** — only a scanner-shaped guard sees it.

### 2. D3 — ONE card, ONE filter, invitations INLINE (BUG-2's client half)

`InvitationsPanel` is **deleted**. `TeamRoster` takes `invitations` and renders them as rows in the same
table. Before, selecting **Invited** emptied the roster and still drew its header — a labelled empty box —
while the actual invitation sat in a second card the filter did not govern.

- Columns are **PERSON · ROLES · [LOCATIONS] · STATUS**. ‼️ **No TEAMS** (D5).
- An invited row carries the email, the **relative** expiry via `invitationExpiry`, its **real roles** (they
  were always on `BusinessInvitationDto`), an `Invited` pill and Resend/Revoke.
- Revoke: row dims + **both** actions disable while in flight (two revokes in flight is how the owner's
  stale `invitation_revoked` was reached), a danger-styled typed confirm, then a one-line confirmation so
  the disappearance reads as a RESULT rather than a glitch.
- ‼️ **`invitation_revoked` / `invitation_already_accepted` are NOT failures** — they mean somebody got there
  first. Both clients hold them in `RACE_CODES`, reconcile the list and explain, never a red "that didn't go
  through".

### 3. ‼️ THE RESEND COOLDOWN COMES FROM THE SERVER NOW

Both clients hardcoded `RESEND_COOLDOWN_MINUTES = 5`, duplicating `Tenancy:Invitations:ResendCooldownMinutes`
— a setting only the server enforces. `BusinessInvitationDto` gained **`ResendCooldownMinutes`**, so the
button and `ResendAsync` are structurally incapable of disagreeing. **Zero new requests** (it rides the list
the screen already loads).

### 4. ‼️‼️ NO EMAIL, NOTIFICATION OR PDF PRINTS A UTC CLOCK — `LocalTimeFormatter` has FOUR shapes

`clinqetcore/Utilities/LocalTimeFormatter.cs` shipped in session 1 with **ZERO callers**; it now has **29
call sites across 13 files**. Choosing the wrong shape is a real bug, so the distinction is the design:

| Shape | For | Behaviour |
|---|---|---|
| `Instant` | a moment (receipt, expiry, payout) | converts to business-local, **names the zone** |
| `Day` | an INSTANT the reader cares about only to the day (renewal, trial end) | converts, then drops the clock |
| ‼️ `CalendarDay` | a value already STORED as a calendar date | **renders as-is** |
| ‼️ `WallTime` | a value already STORED as local wall time in a known zone | **labels without converting** |

- ‼️‼️ **A DUE DATE HAS NO TIME ZONE.** `Invoice.InvoiceDate`, `Invoice.DueDate` and `Quote.ValidUntil` arrive
  from the provider's own date picker as a bare `yyyy-MM-dd` (`.toISOString().split("T")[0]`) and deserialize
  to **midnight Unspecified**. Converting them from UTC moves them a day BACKWARDS everywhere west of
  Greenwich — an invoice dated the 20th would print **"August 19"**. `CalendarDay` exists to make that
  impossible; sabotage-verified (making it convert fails exactly one test).
- ‼️‼️ **`Booking.ScheduledStartDateTime` is ALREADY wall time in the booking's own zone**
  (`BookingTimeHelper.ApplySchedule` writes it that way), so `Instant` would shift every appointment by the
  offset. `WallTime` labels it instead. **This was never a UTC bug — only a culture one.**
- The 7 auth-security emails stay on `Common_EventJustNow` ("just before this email was sent"): every one was
  literally `DateTime.UtcNow` at dispatch, so a relative phrase is exactly as accurate and the reader's own
  mail client already stamps arrival locally.

### 5. ‼️‼️ A BILLING DATE MUST TRAVEL AS A **VALUE**, NEVER A PRE-FORMATTED STRING

Three duplicate private `FormatDate` helpers (`AiAddOnService`, `SubscriptionService`, `PromoSunsetService` — the last since deleted with the founder feature, 2026-10-04)
each did `.UtcDateTime.ToString("MMM d, yyyy", InvariantCulture)` — **an English month inside every Hindi,
Gujarati, French and Spanish billing email**. All three are **deleted**.

‼️ **The root cause is WHERE, not HOW.** A producer runs **once, before recipients are resolved**, so it
cannot know anybody's language or the business's zone. `BillingNotification` therefore gained
**`DateFields: Dictionary<string, DateTimeOffset>`**, rendered per recipient by
`BillingNotificationService.RenderDates` — the one place `lang` and the zone are both known.

- 12 producer call sites converted. A test asserting `Fields.ContainsKey("date")` is asserting the **old**
  shape: the assertion is now `DateFields` carries it and `Fields` does **not**.
- `ResolvedRecipient` gained **`BusinessTimeZone`**, projected from the **same `Business` row** the resolver
  already reads for `DisplayName` — one more column on a seek it already performs, **zero new queries**.

### 6. ‼️ `Business.TimeZone` FINALLY HAS A WRITER — and it is the change feed, not a new read

The column existed with **no effective writer**: `BusinessCreateRequestDto` carries a `TimeZone` field but
**no caller has ever populated it** (`AuthService` self-serve sets DisplayName/Country/DefaultLocale only;
both clients send `displayName` alone), so every row was null.

`ProviderListingChange` gained `TimeZoneId` and `ProviderListingProjectionService` projects it in the SAME
`OPENJSON` + `UPDATE..FROM..OUTPUT` that already writes `DisplayName`, driven by the ProviderData change feed
which already deserializes the BusinessProfile. **Zero new feed, zero new lease, zero new RU, zero Cosmos
reads.** The WHERE gained `OR (v.TimeZone IS NOT NULL AND (b.[TimeZone] IS NULL OR v.TimeZone <> b.[TimeZone]))`
so a relocation reaches SQL even while unlisted — emails must never carry a stale zone.

‼️ **The seeder writes it too**, on BOTH stores (`ProviderDataSeeder` stamps the profile via
`BookingTimeHelper.StampProfileTimeZone`; `UserSeeder` resolves the same city onto `SeedBusiness.TimeZone`) —
otherwise no local environment exercises anything but the fallback.

### 7. ‼️ ONE CULTURE RESOLVER — `CultureInfo.GetCultureInfo(language)` THROWS

`Clinqet.Core.Utilities.LanguageCulture` replaces the Functions-host-internal `CultureResolver` (deleted, 11
call sites re-pointed) and the private one in `DocumentDeliveryService`. **`QuestPdfService` called the raw
API six times and `BookingPaymentService` once** — the language is stored user data, so an unrecognised value
was a dead-lettered message or a 500, not a mis-rendered date.

### 8. D5 — the TEAMS surfaces are gone, and BOTH invite screens lost a request

Nothing on provider web, provider mobile or admin creates, renames, deletes or assigns a team — the only
`Team*` writes either client makes are `UpdateTeamActivityClass/Member`, which are **notification
preferences**. So the column could only ever render an em dash and `Invite.TeamsSection` was guarded on
`teams.length > 0`, never true.

Removed: the roster column, the dead section on both invite screens, `teamIds` from the invite request, and
‼️ **the `GetTeams()`/`getTeams()` call from both startup `Promise.all`s — one fewer API request every time
the invite screen opens, on each app.** The now-callerless service bindings and URL constants were deleted
with them (§0.16).

- ‼️ **The `/business/teams` entry in mobile's `isDomainForbiddenUrl` STAYS.** It is a URL *classifier*
  deciding whether a 403 signs somebody out, not a caller list, and it must already be right the day a caller
  reappears. `tenancyForbiddenIsNotLogout.test.ts` names it as a literal now, with that reason.
- ‼️ **UNTOUCHED, both owner decisions:** notification routing's "A team" option (declined 2026-08-09) and the
  inbox reassign modal.
- **Guard:** `teamsSurfaceRemoved.test.js` fails on any `GetTeams(` call, any import of it, or the return of
  the three orphaned keys — with a positive control.

### 9. ‼️‼️ D4 — A PENDING INVITATION IS REPORTED ON **EVERY** WORKSPACE LIST (BUG-6)

`BusinessContextController` looked for pending invitations **only when `businesses.Count == 0`**. That made an
invitation invisible to the one person guaranteed to be signed in and never looking for it: **somebody who
already runs a business.** Since self-serve provisioning gives everyone a workspace at first sign-in, that is
almost everybody.

- The lookup now always runs — one seek on the filtered `IX_BusinessInvitation_Email_Pending`, on a call made
  once per app load, provider apps only.
- ‼️ **`EmptyReason` still explains an EMPTY list and nothing else.** Widening it would fire the
  zero-workspace gate for somebody holding a perfectly good workspace. Both `WorkspaceGate`s keep their
  `emptyReason === "PendingInvitation"` condition **unchanged** and correct, because they sit inside the
  `workspaceCount === 0` branch.
- The switcher gained an **INVITED section** on both apps (mockup §5): every invitation listed **separately**
  — choosing between two on somebody's behalf is how a person joins the wrong business — with the role, the
  relative expiry, a green Join, and every refusal answered **in place** via `invitationRefusalKey`.

### 11. ‼️‼️ D4's SECOND HALF — `TeamInvitationReceived`, the in-app announcement (2026-08-11)

The switcher's INVITED section only helps somebody who **looks**. An invited person who already runs a
workspace is signed in and looking at something else, so the email was their only signal — and they never
open it. `NotificationType.TeamInvitationReceived` is the unmissable half: in-app + push + SignalR, fired the
moment an invitation is issued **or resent**.

**Where it is raised:** `BusinessInvitationService.SendInvitationEmailAsync` — the one method both Issue and
Resend funnel through — via `ITeamLifecycleNotifier.NotifyInvitationSentAsync`.

‼️ **ZERO extra queries.** That method already reads the invitee's `Users` row to pick the email language;
the projection was widened to `new InvitedPersonRef(u.Id, u.UserNumber, u.PreferredLanguage)`. Resolving the
recipient again inside the notifier would add one query per invitation for nothing.

‼️ **Dispatched ONLY when the invitee already has an account.** A stranger has no `UserNumber`, which is the
Communications partition key — dispatching for one writes into a partition nothing reads and tags an empty
device set. For them the email IS the journey.

‼️ **`NotificationRecipientScope.Personal` + `DirectRecipient`, and it must be.** The invitee holds **no
membership**, so business-scope resolution walks `BusinessMembership` and finds nobody — the notification
would be dispatched to an empty audience and vanish silently. `NotificationRecipientResolver.ResolveAsync`
returns `ResolveDirect` **before touching the database**, so this also costs 0 SQL.

#### Three traps this dispatch hit, none of which any existing test could see

1. ‼️‼️ **OMITTING `ResolvedRecipient.BusinessId` does not omit the id — it writes a NULL OVER it.**
   `BusinessCommunicationDispatcher.ApplyRoutingContext` assigns `data["BusinessId"] = recipient.BusinessId!`
   **unconditionally**, after the caller's own `NotificationData`, and that dictionary reaches Cosmos and the
   SignalR payload verbatim. It is also hashed into `BuildIdempotencyKey(eventId, userNumber, businessId)` —
   so a null there **collides the key across businesses**. Carrying the id is safe: notifications are keyed to
   the PERSON (`/userNumber`, and `NotificationRepository` has no business filter anywhere), so it cannot
   hide the notification. **Every other `ResolvedRecipient` in the codebase already carried it; this was the
   only one that did not.**
2. ‼️‼️ **THE EVENT ID IS THE DELIVERY ID, so keying it on the invitation makes Resend do nothing.**
   `EventId` → `BuildIdempotencyKey` (SHA-256) → `ChannelMessageId` → Service Bus `MessageId` →
   `notificationId` → `CreateIfAbsentAsync`. A resend REUSES the `InvitationId`, so
   `invite-sent:{invitationId}` makes the second announcement an "idempotent replay" that
   `NotificationProcessor` completes and **drops before Cosmos, SignalR or push**. The key is
   `invite-sent:{invitationId}:{LastSentAt:O}` — the exact shape the invitation **email** on the same method
   already used (`invite:{InvitationId}:{LastSentAt:O}`). A Service Bus redelivery of one send still collapses,
   because `LastSentAt` is unchanged. Same family as `NotifyOwnershipTransferRemindedAsync`'s `reminderKey`.
3. ‼️ **A test that asserts the NOTIFIER WAS CALLED TWICE passes against trap 2.** The first version of
   `Resend_AnnouncesAgain` did exactly that and was worthless — two calls carrying one delivery id are one
   notification. It now captures both send stamps and asserts they DIFFER.

#### The prerequisite hole D4 opened in a rule this skill already documented

‼️‼️ **`workspaceChipVisible` hid the chip from exactly the person D4 targets.** The rule is **absent for a
sole primary owner of one healthy business** — and that is the invitee's own state. The INVITED section lives
inside that chip, so the notification would have deep-linked them to a dashboard **with no way to act on it**.
The rule gained a fifth input:

```
workspaceChipVisible(workspaces, activeWorkspace, listLoaded, contextStale = false, pendingInvitationCount = 0)
```

A pending invitation returns `true` and **outranks every rule below it**, including `listLoaded` — it is
decidable before the workspace list resolves. Mirrored in `clinqetmobilepartnerapp/src/lib/tenancy/
renderingRules.ts` with identical comment text; call sites `Header.jsx` and `DashboardWorkspaceChip.tsx` now
pass `pendingInvitations.length`. Four fixtures added to `tenancyRenderingParity.test.ts`.

‼️‼️ **THE ORDERING NEEDS ITS OWN FIXTURE, and the parity suite was green without one.** Every other chip
fixture answers identically whether the invitation check sits before or after the `!listLoaded` gate — so
reordering the MOBILE rule so the gate ran first (chip hidden until the workspace list resolves: a genuine
web/mobile divergence) left `tenancyRenderingParity` passing **329/329**. Only
`[[], null, false, false, 1]` — a pending invitation with an UNLOADED list — separates the two orderings.
**A cross-platform diff proves the RULES agree only on the inputs you actually feed it; a branch order that
no fixture distinguishes is not covered, however many fixtures there are.**

#### The five mandatory artefacts, plus what is NOT needed

Enum member · `NotificationRoutingCatalog` `Personal()` descriptor · `NotificationRoutingCatalogTests`
`BuildExpected()` entry · `SignalRSettings:EnabledNotificationTypes` (Main API `appsettings.json`) ·
`CommunicationPreferenceConfig` `TeamMembership` category. Plus `Notification_TeamInvitationReceived_Title`
/ `_Body` in all five API catalogues (**2,888 → 2,890**, keysets identical). `{0}` = the business name,
`string.Format`-resolved BEFORE dispatch.

‼️ **No client-side strings were added.** The title and body come from the API, like every other notification.

**Client routing — the dashboard SHELL on both apps**: `TeamInvitationReceived: () => dashboardRoute.dashboard`
(web) and `() => ({ screen: 'MyDashboard' })` (mobile, the screen that renders `DashboardWorkspaceChip`).
‼️ **Never a `/dashboard/team` target — the invitee has no permission there, so it 403s.** The existing
reachability guards (web walks the App Router tree; mobile reads the real navigator source) prove the target
EXISTS but would pass on the notifications **fallback** too, so each app also pins the destination explicitly.

**Channels:** `SkipEmail = true`, `SkipSms = true` — the invitation email IS this event's email channel, and a
second one is the same sentence twice. In-app, push and SignalR all default on.

**Tests:** `TeamLifecycleNotifierTests` (8, new) · `BusinessInvitationServiceTests` +3 ·
`renderingRules.test.js` +3 · `tenancyRenderingParity.test.ts` +4 · web + mobile route pins. **Eight
sabotages applied, eight bit the right test.** ‼️ One of them "passed" first time because a bare string
replace hit the FIRST `BusinessId = businessId,` in the file — in `NotifyInvitationRejectedAsync`, not the D4
recipient. **A sabotage that reports "applied" has proved nothing until you diff and see it land on the
target.**


### 10. ‼️ `joinInvitation` MOVED INTO THE CONTEXT — two surfaces, one implementation

The gate owned the accept-mine → switch flow; the switcher now joins too. Rather than a second copy,
`BusinessContext` (web) / `BusinessProvider` (mobile) expose `joinInvitation`, `joining`, `joinError`.

‼️ **The tests had to move with it.** The gate now asserts what the gate owns — that it forwards the press
with **that invitation's own businessId**, and renders the refusal the provider resolved. The FLOW is pinned
in new `joinInvitationFlow` suites against the real provider. Sabotage-verified: deleting the `switchBusiness`
call fails exactly the two tests that assert entry.

### 11. Traps this session paid for

1. ‼️ **A test mock missing ONE context field crashes the component**, and the failure names a `.length` on
   undefined rather than the missing key. Adding a field to a context means auditing every partial mock —
   `createBusinessDialog`, `dashboardWorkspaceChip` and `workspaceStateExits` all needed it.
2. ‼️ **`invitation.Roles` is NOT populated on the issue path.** Role rows are added straight to the context,
   so the navigation is filled only if EF fixup happened to run — and an empty list there is **invisible**,
   the email just loses its role clause. `SendInvitationEmailAsync` takes `roleIds` **explicitly** now.
3. ‼️ **Role display names come from the `BusinessRole` ROW, not from `sysrole_{roleKey}`.** The id format
   holds for the ten system roles but a future custom role would silently vanish from the sentence.
4. ‼️ **The email template engine substitutes RAW, unencoded** (`TemplateService` is `string.Replace`), so
   any server-composed HTML fragment must encode provider-typed text itself. Pre-existing platform-wide.
5. ‼️ **An email sentence with a variable clause needs a WHOLE key per case**, never a clause glued onto a
   fixed one: the role lands mid-sentence in English and **before the verb** in Hindi and Gujarati. Hence
   `TeamInvitation_Intro` / `TeamInvitation_IntroWithRoles`, both rendered to `IntroHtml` + `IntroText`.
6. ‼️ **The accept screen's full sentence is the wrong register for a table row.** `Invitation.Expiry.*` is
   "This invitation expires in 7 days."; the roster and switcher use a short `Team.Expiry.*` family derived
   from the same rule's branch — one rule, two registers, never a second rule.
7. ‼️ **`python` is unavailable here** and **a bash heredoc breaks on apostrophes** — localization and
   template scripts go through the editor tool, run with `node`, and carry count guards.
8. ‼️ **Line endings differ per file AND within a file.** The API catalogues are MIXED (fr is pure LF), the
   `Services/Payments` files are LF. Detect by COUNTING (`crlf === lf` ⇒ CRLF), and insert new lines with the
   EOL of the **anchor line** you matched.

### 12. Measured at the end of this session

| Check | Result |
|---|---|
| All **8** .NET solutions | **0 errors** |
| `Clinqet.API.UnitTests` | 8,961 / 8,962 — the 1 failure is **pre-existing and not ours** (see below) |
| Identity · Communications · Mcp · CosmosIndexSetup unit | 868 · 1,883 · 544 · 70, all green |
| Provider web jest | **937 passed / 81 suites**; ESLint **0 errors** |
| Provider mobile jest | 1,683 / 1,684 — the 1 failure is **pre-existing** (`bookingDashboardFilter`, fails in isolation, touches nothing changed) |
| Provider mobile `tsc --noEmit` | clean; ESLint errors only in **6 files never touched** (the `markLoaded`/`shouldBlock` class) |
| API catalogues | 2,885 → **2,888**, key sets identical |
| Provider web catalogues | 5,170 → **5,181** (15 added, 4 orphans deleted), key sets identical |
| Provider mobile bundles | 4,690 → **4,703** (16 added, 3 orphans deleted), key sets identical |

‼️ **TWO PRE-EXISTING FAILURES, NEITHER OURS — do not inherit them as ours:**
- `EmailedUrlsResolveToRealRoutesTests` for `/services`: the customer app moved that page into a `(search)`
  route group (commit `d0749ee`, the search-performance programme). The route **is** served; the guard's path
  resolver does not collapse a route group at that position. **A wrong guard PROPOSES bugs** — fix the
  resolver, not the route.
- `clinqetmobilepartnerapp/__tests__/bookingDashboardFilter.test.tsx`.

‼️ **THE INTEGRATION SUITES COULD NOT RUN HERE.** Port **8081** is held by an unrelated project's container
(`linking-cosmos-1`), so every Testcontainers fixture fails at `Bind for 0.0.0.0:8081`. That is
**infrastructure, not a regression** — `docker ps` first, always. The new SQL integration tests
(`ProviderNameProjectionSqlTests` +4 for `Business.TimeZone`, `BusinessContextIntegrationTests` +1 for D4)
compile and are correct but are **UNVERIFIED BY EXECUTION**; run them on a machine where 8081 is free.

---

## ‼️‼️ SESSION 2 ADDENDUM (2026-08-10) — EMAIL HTML ENCODING, AND TWO GUARDS THAT WERE ACCUSING WORKING CODE

> Three items the session first reported as "not ours / could not run" were then fixed properly, end to end.

### 1. ‼️‼️ `TemplateService` SUBSTITUTED RAW — every email placeholder was an injection point

`ProcessTemplate` filled `{{Token}}` with a plain `string.Replace` into the HTML body. Every placeholder is
somebody's typed text — a business name, a service name, a customer's own message — so a provider whose
business name contained markup had it rendered AS markup in every transactional email their customers
received. **102 templates, all five languages.**

**The fix is TYPE-DRIVEN, the same contract as ASP.NET's `IHtmlContent` / Razor's `HtmlString`:**

- `Clinqet.Shared.Models.HtmlFragment` wraps markup the producer composed itself.
- `TemplateService.ForHtml(raw, rendered)` **encodes by default** and passes through **only** an
  `HtmlFragment`.
- ‼️ **The decision is made on the TYPE, never by inspecting the value.** Sniffing for `<` is how the attacker
  wins — the payload is exactly the thing that looks like markup.
- ‼️ **Only the HTML body is encoded.** The SUBJECT and the PLAIN-TEXT body are not markup; encoding there
  would show the reader `&amp;`. A producer needing both supplies two tokens (`IntroHtml` + `IntroText`).

**The seven declared fragments** (every one verified against the real templates, not guessed):
`ItemsSection` · `PayButtonSection` (InvoiceEmailProcessor) · `ReviewSection` (BookingEmailProcessor) ·
`PaymentMethodRow` ×2 (BillingReceiptEmailProcessor) · `CartItemsHtml` (CartReminderProcessorFunction) ·
`FounderBlockHtml` (BillingNotificationService — deleted with the founder feature, 2026-10-04) · `IntroHtml` (BusinessInvitationService).

‼️ **`NotificationBody` is deliberately NOT one** — it is a localized sentence whose `string.Format`
arguments are a customer's name and a service name, i.e. exactly the text the encoding exists to contain.

**How the set was proved complete** (the sweep that matters, because a block handed a bare string now shows
its tags to the customer):
1. every `{{Token}}` in every English HTML body was extracted — **114 distinct**, of which 8 are block-shaped;
2. all 8 accounted for (7 fragments + `NotificationBody`);
3. **zero** localization values contain a tag, so nothing arrives as markup through a localized string;
4. **zero** placeholders sit inside a `<style>` or `<script>` block, where entity encoding would not decode.

**Guards:** `TemplateServiceEncodingTests` (6, including the `<script>` payload and the everyday
`Smith & Sons`) and `EmailHtmlFragmentsAreDeclaredTests`, which fails the build if a new block-shaped
placeholder appears undeclared **or** if a declared fragment's placeholder disappears. Sabotage-verified:
removing the encode fails 4 of 6.

‼️ **A type change is a TEST-CONTRACT change.** 19 assertions across FIVE test projects did
`(string)templateData["ItemsSection"]` / `as string`; a boxed `HtmlFragment` throws on the first and yields
**null** on the second — and `as string` is the dangerous one, because null silently passed an
`Assert.Equal(string.Empty, …)` shape until it did not.

### 2. ‼️‼️ A ROUTE GROUP IS INVISIBLE AT THE **LAST** SEGMENT TOO — the guard was accusing working code

`EmailedUrlsResolveToRealRoutesTests` reported `/services` as served by no route. It **is** served:
`clinqetwebuserapp/app/(customer)/services/(search)/page.js`. The walker descended `(group)` directories
while consuming segments but its TERMINAL case called `HasPage(dir)` only, so a page inside a route group at
the final segment was invisible to it.

- Fixed with `ServesHere(dir, isPrefix)`, which descends **route groups only** — ‼️ never a `[param]`
  directory, because `app/[friendlyName]` matches any single segment and would report every path as served.
- Added the walker's own **positive AND negative control** (`/services` resolves; a made-up path does not),
  because every other assertion in the file asserts a path RESOLVES — so a walker that started matching
  everything would go green while proving nothing.
- Sabotage-verified by moving the real `page.js` aside: 2 tests fail, and the file is restored.

> ‼️ **A WRONG GUARD DOES NOT MERELY FAIL TO CATCH BUGS — IT ACCUSES WORKING CODE.** This one named a
> customer route that has always worked. Verify the guard before you change the code it accuses.

### 3. ‼️ `bookingDashboardFilter` — the test asserted the OPPOSITE of a deliberate design

It asserted that a blur+focus resets the status filter. The screen deliberately does the opposite: its OWN
blur fires when a booking detail is pushed on top, and Back must not land the provider on an unfiltered list
— the reset lives on the **parent** tab's blur (`booking.tsx:215` says so in as many words).

The harness had no `getParent`, so the real reset path was **inexpressible** and the test approximated it
with a plain blur. It now models both: `leaveTab()` fires the parent blur, and a second test pins that the
screen's own blur PRESERVES the filter. Sabotage-verified: removing the
`setParams({ status: undefined })` consumption fails exactly the param-consumption test.

> ‼️ **When a test contradicts a commented design decision, the test is the thing to read first.** Its NAME
> here ("consumes the param so clearing the filter afterwards sticks") described the real invariant; only its
> BODY had drifted.

### 4. ‼️ THE COSMOS EMULATOR PORT — free it, do not work around it

Every Testcontainers fixture starts an emulator on **8081**, so ANY container already publishing that port
fails all four integration suites with `Bind for 0.0.0.0:8081 failed: port is already allocated` — including
SQL-only tests, because the assembly fixture boots the emulator regardless. `docker ps --filter publish=8081`
names the holder; stop it, run the suites **serially**, restart it afterwards.

### 5. Measured after these three fixes — everything green

| Suite | Result |
|---|---|
| All **8** .NET solutions | **0 errors** |
| `Clinqet.API.UnitTests` | **8,971 / 8,971** |
| `Clinqet.Identity.UnitTests` · `Communications` · `Mcp` · `CosmosIndexSetup` | 868 · 1,883 · 544 · 70 — all green |
| `Clinqet.Identity.IntegrationTests` (**REAL SQL**) | **410 / 410** |
| `Clinqet.API.IntegrationTests` (**REAL SQL + Cosmos emulator**) | **1,743 / 1,743** |
| `Clinqet.Communications.IntegrationTests` (**REAL SQL + Cosmos emulator**) | **434 / 434** |
| `Clinqet.Mcp.IntegrationTests` (**REAL Cosmos emulator**) | **65 / 65** |

‼️ **ALL FOUR Testcontainers suites run SERIALLY and ALL FOUR are green — 2,652 integration tests.** Running
two at once returns a TOTAL failure (65/65 here), which is the infrastructure signature, never a regression.
| Provider web jest · ESLint | **937 / 937** · **0 errors** |
| Provider mobile jest · tsc | **1,685 / 1,685** · clean |

‼️ **The D4 integration test had to be re-ordered, and the reason is the feature:** seeding the invitation
BEFORE sign-in makes self-serve provisioning decline the workspace (`ExpectedByInvitation`, §4.6), so the
person holds nothing — the OTHER case. Authenticate first, THEN seed: that is "somebody who already runs a
business is later invited", the exact person the old `businesses.Count == 0` gate hid the invitation from.
Sabotage-verified against real SQL — restoring the gate fails exactly that one test.

---

## ‼️‼️ THE INVITATION ACCEPT DEAD END (owner-reported live, 2026-08-10) — BUG-1 WAS ONLY HALF FIXED

> Reported from `business.dev.clinket.com`: signed out → opened the emailed link → signed in → **"Something
> went wrong at our end. Your invitation has not been used."** — and Try again never recovered. Then, after
> joining, **no way back to their own business.** Two separate defects, both real, one per app.

### 1. ‼️‼️ THE POST-SIGN-IN LANDING CARRIES NO TOKEN IN THE URL — so the STASH is the only copy

`HomeClient.returnToInvitation()` does `router.replace(INVITATION_ROUTE)` — **`/invitation`, no query
string**. The screen then cleared the stash on the way in, before anything had used it:

```
useEffect →  stashed = read()  →  clear()  →  loadPreview(stashed)   // preview works, value passed directly
Join      →  activeToken() = token || read() || ""   →  ""           // token gone, query empty
```

`AcceptInvitation("")` fails the DTO's `[Required]` + `MinimumLength(16)` as a **plain 400 with no
ErrorCode**, and `invitationRefusal(undefined)` falls through `default` → **"error"** → *"Something went
wrong at our end"*. ‼️ **And Try again could never work**, because it calls `loadPreview(activeToken())` —
the same empty string. A permanent dead end on the platform's only route into a membership.

- ‼️ **The stash now outlives a RETRYABLE refusal** (`error`, `throttled` — both offer Try again) and is
  dropped only on a terminal one (`alreadyAccepted`, `revoked`, `expired`) via one `settle(code)` helper, so
  a spent token cannot bounce every later sign-in back here either.
- ‼️ **MOBILE HAD ITS OWN VERSION.** It cleared the stash too and survived only because it happened to hold
  a copy in React state — but **both Try again buttons call `loadPreview`, which RE-READS storage**, so a
  retry on a perfectly valid invitation fell through to **"Your invitation has expired"**, and any remount
  stranded it for good. Same `settle` fix, same terminal set.

> ‼️‼️ **BUG-1 WAS SABOTAGE-VERIFIED AND STILL HALF BROKEN.** Session 1 proved the token survives
> `purgeClientState()`'s `sessionStorage.clear()` — and it does. It was then destroyed one step later, by the
> screen it had survived *for*. **A guard that pins "the value reaches the screen" says nothing about whether
> the screen can still USE it.** Pin the ACT (Join posts a non-empty token), not the transport.

### 2. ‼️‼️ JOINING A SECOND BUSINESS LEFT THE WORKSPACE SWITCHER DEAD (web only)

`BusinessContext` refetches the workspace list **only while `listState === UNKNOWN`**, and it seeds that
state from a cache in **`localStorage`** (`SessionStore.set` defaults there — §20.4). So after accepting:

- the token and `activeBusinessId` point at the NEW business;
- the cached list still holds only the OLD one;
- `activeWorkspace = list.find(w => w.businessId === activeBusinessId)` → **undefined**;
- `WorkspaceSwitcher` hits `if (mode === "noAccess" || !activeWorkspace)` and renders its **unknown-name
  SKELETON** — a grey bar that is not a switcher;
- **a hard reload does not help**, because the cache is still non-empty, so `listState` starts LOADED.

The person is stuck in the business they just joined with **no way back to their own**, until they sign out.

‼️ **THE ASYMMETRY THAT NAMED IT:** `CreateBusinessDialog.jsx:76` already calls `reloadWorkspaces()` after
creating a business — for exactly this reason. **Joining was the one path that did not.** Provider *mobile*
already called `await reload()` in its `join()`; **web was the odd one out**, which is the inverse of the
usual parity gap and is why a mobile-first check would have missed it.

> ‼️ **ANY WRITE THAT CHANGES WHICH WORKSPACES A PERSON HOLDS MUST REFRESH THE LIST.** Creating, joining,
> closing. The cached list is the switcher's only source, it is not request-scoped, and it survives reloads.

### 3. Guards, both apps, both sabotage-verified

`clinqetwebpartnerapp/src/app/invitation/invitationTokenSurvival.test.jsx` (8) and
`clinqetmobilepartnerapp/__tests__/invitationTokenSurvival.test.tsx` (8) — the stash survives the preview,
Join posts the real token and **never** `""`, the list reloads after joining, retryable refusals keep the
token, terminal ones drop it. Sabotage: restoring the eager clear fails **4** web / **2** mobile; removing
`reloadWorkspaces()` fails the switcher test.

‼️ Two test-authoring traps paid for here: `screen.findByText(/Join X/)` matches the **heading and** the
button (scope to `getByRole("button")`), and a `press` helper must walk rendered **text**, never
`JSON.stringify(children)` — a React tree is circular.

**Measured after:** provider web **945/945**, provider mobile **1,693/1,693**, `tsc` clean, ESLint 0.

---

## ‼️‼️ TEAM BUG FIX — PHASE 1: THE WAY IN (2026-08-11/12). FIVE PRODUCERS OF ONE REDIRECT, AND A BOOLEAN THAT ANSWERED A THREE-STATE QUESTION

> Programme folder `C:\Nik\Team-Bug-Fix\`. Read `PROGRESS.md` there for the full record. Appended, not
> replacing anything above.

### 1. ‼️‼️ ONBOARDING IS ENTERED FROM A POSITIVE FACT — and there were FIVE places that decided otherwise

The owner's report — *"I'm part of someone's team, why is it bringing me back to the onboarding steps?"* —
had one root and five producers, three of which no earlier session had counted:

| Producer | What it decided on | Fixed |
|---|---|---|
| web `app/HomeClient.jsx` catch-all | **any** non-401 failure of `GET /business/profile` ⇒ "no business" ⇒ `/onboarding?step=1`, where step 1 MINTS a company | Part 1 |
| web `hooks/useWorkspaceOnboarding.js` (dashboard **layout**) | unfinished setup, for **every member of every role**, on every dashboard visit | Part 1 |
| ‼️ web `HomeClient` **success** path | unfinished setup, still ungated after Part 1 | **Part 2** |
| ‼️ mobile `services/socialLoginService.completeSocialLogin` | `profileCompleted`, a local flag only ever SET | **Part 2** |
| ‼️ mobile `App.tsx` cold start | the same flag, on **every launch** | **Part 2** |

**THE ONE RULE, now stated once and applied by all five:** onboarding is entered only when the profile
**RESOLVED** and says the setup is unfinished, **AND** no invitation is waiting, **AND** the workspace was
not explicitly skipped, **AND** the person can **`business.profile.update`**. `access === null` **defers**
— the shell/layout redirect asks the same question against a resolved `access`, so deferring is never a
dead end and never a stuck loader.

‼️‼️ **WHY THE PERMISSION GATE IS NOT OPTIONAL, and why "the read 403s anyway" is wrong:** **all ten roles
hold `business.profile.read` at `Business` scope.** So `GET /business/profile` SUCCEEDS for a technician
and reports their EMPLOYER's setup as unfinished — **truthfully**. The read is not the gate; the permission
to ACT on it is. `business.profile.update` is exactly what the wizard's saves need, so the gate and the
screen cannot disagree.

> ‼️ **CASE 27 AGAIN — A FIX INHERITS THE SCOPE OF THE FINDING THAT DESCRIBED IT.** Part 1 wrote the finding
> as *"the redirect lives in the layout"* and fixed exactly that. Written with **no file names** —
> *"a member of somebody else's business is sent to a wizard they cannot use"* — the same grep finds five.

### 2. ‼️ `isOnboardingComplete()` — a BOOLEAN ANSWER TO A THREE-STATE QUESTION (deleted)

`clinqetmobilepartnerapp/src/services/authService.ts` returned `false` on **any** failure, so a 403 for
somebody holding two workspaces, a permission refusal and a dropped request all read as *"this person has
not set up their business"* — and all ten mobile sign-in landings routed on it. Replaced by
`readWorkspaceSetup()` in `lib/tenancy/pendingInvitation.ts`, which returns **`resolved` / `complete` /
`firstMissingStep`**; `resolved: false` is never an onboarding signal.

‼️ **Mobile's `fetchBusinessProfile` returns the RAW `Response` and does NOT throw on 4xx**, so a 403 body
(`data: null`) is read by `onboardingResume` as "nothing is done". **Every mobile caller needs an explicit
`if (!response.ok)`** — web's axios client rejects, which is why the web twin never needed one. Two sites
needed it: the landing and `useWorkspaceOnboarding`.

‼️ **`postSignInRoute()` takes NO argument now.** It used to accept a `fallbackRoute` the nine screens each
computed from that boolean, so nine screens held half a decision and four of them spent a **duplicate**
profile request. The common path is one request cheaper than before.

### 3. ‼️ THE SIGN-IN LANDINGS ARE TEN, NOT NINE — and the guard could not see the tenth

`providerStartsHere.test.ts` counted `navigation.reset(...)` inside `src/Screen/authenticationFlow` and
asserted all nine go through `postSignInRoute`. **`socialLoginService.completeSocialLogin` lives in
`src/services`** and used `navigationRef.current?.reset(...)`, so an invitee signing in with **Google** —
the journey the emailed link invites — landed in the onboarding wizard with their stashed invitation never
read. **Casebook CASE 21: a sweep bounded by a directory is bounded by the wrong thing.** The guard now
walks the whole of `src`, keying on files that persist tokens (`saveAuthTokens` / `saveDeepLinkTokens`),
with a positive control proving the walker reaches the file the defect lived in.

### 4. ‼️‼️ `await import()` THROWS UNDER PROVIDER MOBILE'S JEST — a module can be 100% green and never executed

`A dynamic import callback was invoked without --experimental-vm-modules`. `pendingInvitation.ts` had nine
of them, each inside a `try` whose `catch` returns the safe default — so **`enterMostRecentWorkspace` had
never once run in a test**, and every guard on that file was source-scanning. Worse: a behavioural test
written against it would have **passed for the wrong reason**, because every catch default happens to be
the answer the safe cases expect. All nine are now static imports.

> ‼️ **A file whose only guards are source scans has no behavioural coverage, and neither the scan nor the
> suite will say so.** Before trusting a module, check that something actually CALLS it.

### 5. `HtmlFragment` survives Service Bus — and it was live in TWO producers

`HtmlFragment` identified producer-declared markup **by its C# type**, and a queue carries no types: JSON
turned it into a `Dictionary<string,object>` whose `ToString()` is the .NET type name the customer read.
The fix is a **type-level** `[JsonConverter]` writing a self-describing `{"$html": "…"}` marker, plus
`HtmlFragment.TryRead(JsonElement)` as the ONE reader, recognised by
`EmailNotificationProcessorFunction.ConvertJsonElement` **before** the object branch. It was live in the
invitation email **and** the billing trial emails (`BillingNotificationService.FounderBlockHtml`, since deleted). The other
three `ConvertJsonElement` copies carry alert/analytics metadata and are unaffected — **stated after
checking, not assumed**.

‼️ **`Conventions/EmailHtmlFragmentsAreDeclaredTests.cs` now lives in `Clinqet.Communications.UnitTests`**
(owner-decided 2026-08-12), beside `TemplateServiceEncodingTests`. `Clinqet.API` carries no template, no
producer and no `TemplateService`. §0.15 permits it: `clinqetinfrastructure` is a **library** every host
compiles in, and that project already scans it the same way (`LocalizationSourceConventionTests`). Its
`Assert.SkipWhen` became a **hard throw** — a compile-time dependency can never legitimately be absent —
and it gained `Assert.NotEmpty(placeholders)`, because an empty scan could not fail its own assertion.

### 6. TD-4 — there is no "You're in" screen on either app

Joining lands on the dashboard with a **localized toast** naming the business (`Accept.Joined.Title` /
`ACCEPT.JOINED_TITLE`). ‼️ **`alreadyAccepted` KEEPS its screen** — that person did not just act.
`Accept.Joined.Body` / `.Open` and `ACCEPT.JOINED_BODY` / `JOINED_OPEN` are **deleted** from all ten
catalogue files (web 5,180 → 5,178, mobile 4,704 → 4,702, key sets identical).

### 7. Two client-state facts that bit on both platforms

- ‼️ **The workspace list must be fetched ONCE PER APP LOAD, not "while the state is unknown".** A cached
  list starts `loaded` — web from `localStorage`, mobile because `hydrate()` sets it before
  `syncFromSession` reads the gate — so the fetch was suppressed and `pendingInvitations` came back empty
  from storage that has never held any. D4's INVITED section was therefore invisible to every returning
  provider, on both apps.
- ‼️ **A refresh that FAILS is not a list that is MISSING.** Only an EMPTY list may become `failed`, or a
  dropped background refresh downgrades a working switcher to the connection-failure screen.

### 8. ‼️ The onboarding SKIP is session-scoped on both apps, and the key cannot be purged by name

Web writes it with `persistent = false` (`onboarding/page.jsx`), so it dies with the tab. Mobile's was
permanent AsyncStorage — and because the key is **per business** (`onboardingSkipped:{businessId}`), the
fixed logout purge list **cannot enumerate it**, so a skip survived a sign-out and the next account on that
device was never offered the wizard. Mobile now holds it in memory for the process and clears it on the
session sweep. **A value that must not outlive the session is not written to storage that does.**

### 9. Where the mobile landing lives, and what mounts what

| Concern | File |
|---|---|
| The post-sign-in decision (all ten landings) | `src/lib/tenancy/pendingInvitation.ts` → `postSignInRoute()` |
| The cold-start decision (local-only, **no network**) | same file → `coldStartRoute()` |
| The automatic relocation into the wizard | `src/hooks/useWorkspaceOnboarding.ts`, mounted **once** by `BottomNavigation-Route.tsx` inside `WorkspaceGate` |
| Everything else that opens `ABOUTPROFILEROUTE` | an explicit tap — resume card, zero-workspace gate, create, close, dashboard tiles |

‼️ **The cold start is deliberately local-only.** A launch must not wait on the network behind the splash,
so it routes to the shell unless `onboardingIncomplete:{businessId}` is a **recorded** fact — and the shell
then re-asks against a fresh profile and a live `access`. Silence means "not known", never "finished".

---

## ‼️‼️ TEAM BUG FIX — PHASE 2: WHICH WORKSPACE AM I IN (2026-08-12). A COLUMN NOTHING WRITES, AND A REMOUNT ONLY ONE APP HAD

> Programme folder `C:\Nik\Team-Bug-Fix\`. Read `PROGRESS.md` there for the full record. Appended, not
> replacing anything above. ‼️ **This block CORRECTS §20.4's `LastAccessAt` note and §6.3's L26.**

### 1. ‼️‼️ `BusinessMembership.LastAccessAt` IS DROPPED (TD-15, owner-approved schema change)

It had **no writer anywhere on the platform** and **six readers**, three of which were on screen: the
provider-web roster, the provider-mobile roster and the admin support lookup each printed **"Never"** for
every member of every business, always. **A dead column with a reader is a lie, not an absence.**

Removed in one migration on top of the baseline — `20260812072058_DropDeadMembershipLastAccessAt`,
‼️ **never editing `20260806232515_InitialCreate`** — together with the entity property, the
`SeedDbContext` shadow property, four DTO fields, six projections, `lastAccessLabel` from both
rendering-rule files, both roster cells, the admin row, and the `Team.LastAccess.Never` /
`TEAM.LAST_ACCESS_NEVER` keys from all ten catalogue files.

‼️ **§20.4's warning ("`LastAccessAt` is nullable AND can arrive as the .NET zero date, which is TRUTHY")
is now historical.** `isMeaningfulDate` survives and is still load-bearing for invitation expiry, resend
cooldowns and the inbox SLA clock — do not delete it.

‼️ **`orderWorkspaces` sorts OWNED-FIRST, then by name.** It sorted on that null column, so every row tied
and the order collapsed to whatever SQL returned — which is how a provider signed in and landed in somebody
else's business. `BusinessClosureService.ResolveNextWorkspaceAsync` mirrors the same rule.

### 2. ‼️‼️ ONE OWNED BUSINESS PER ACCOUNT (TD-1) — **L26 IS REVERSED**

`03-DECISIONS.md` **L26** permitted one person to own several businesses, and §14.3 records that a
client-side guard was written and deliberately removed for that reason. **L26 is superseded by TD-1,
by the owner, 2026-08-11.** A later session finding either note must read both as historical.

- **The predicate is "already the PRIMARY OWNER of a live business", never "holds a membership".** Joining
  other people's businesses is unlimited — a membership-shaped guard would stop an invited employee ever
  setting up their own, which is exactly why the first one was removed.
- `Closed` **releases** the cap (synchronously, the moment the status is written); `Suspended` does **not**
  — the business is still theirs and they still hold billing-only access to it.
- Enforced **inside the existing `sp_getapplock`** in `BusinessProvisioningService`, beside the rate-limit
  count and for the same reason. **No new index** — it seeks `IX_BusinessMembership_User_Status`.
- ‼️ **Self-serve provisioning cannot trip it.** `SelfServeDeclineAsync` already returns `AlreadyHeld` for
  anybody holding a live membership, so §4.6's first-workspace-at-first-sign-in is untouched — and it must
  be, or a brand-new provider could never get one at all.
- **409 with its own `ErrorCode` (`business_ownership_limit_reached`), never the rate limit's 429.** A rate
  limit resolves by waiting and this never does; sharing the shape tells somebody to do something that can
  never work.
- **Ownership transfer refuses at INITIATE and again at ACCEPT.** Initiate, because discovering it at accept
  leaves the sitting owner having publicly offered their business to somebody who cannot take it and the
  transfer simply lapsing after 72 hours. Accept, because that window is long enough for the target's own
  ownership to change.
- **Client: disabled with a reason on four surfaces**, answered from `isPrimaryOwner` + `businessStatus`
  already on the workspace list — **no new field, no new request**.

‼️ **TD-1 MADE THE RATE-LIMIT RACE UNREACHABLE.** Two concurrent creates by one person are now always
resolved by the cap, because the winner's business is live the instant it commits. The old
`CannotBothSlipPastTheRateLimit` test staged the race by pre-closing two businesses and can no longer be
staged; it is merged into `CreateBusiness_TwoConcurrentSubmissions_ProduceExactlyOneBusiness`, which
exercises the same applock on the same resource key through the guard that now decides. **Coverage moved,
and the test says where it went** — never lower a floor silently.

### 3. ‼️‼️ A WORKSPACE SWITCH REBUILDS THE DASHBOARD CONTENT — and provider MOBILE already did this

`switchBusiness` rotated the token, ran `purgeWorkspaceState()` and bumped the generation guard, and the
owner still watched their own fifty services stay listed **and editable** after switching into a business
where they are a sales rep. **Clearing a cache does not re-render a component that is not asking.**

‼️ **Provider MOBILE has had the fix since Phase 16** — `BusinessProvider.contextEpoch` +
`<TabContent key={contextEpoch}>` in `BottomNavigation-Route.tsx`. **Provider WEB did not.** That is the
inverse of the usual parity gap, and a mobile-first check would have reported the bug already fixed.
Web now has `components/tenancy/WorkspaceScopedContent.jsx`, keyed on the same epoch, wrapping `{children}`
in the dashboard layout.

- ‼️ **The SHELL stays outside the key.** Remounting the switcher, sidebar and header flickers the whole app.
- ‼️ **The epoch bumps only once a business is already KNOWN.** Keying on the id alone refetches the entire
  dashboard the moment the first business becomes known, on every page load.
- ‼️ **The purge is still necessary AND was incomplete.** A remount over a warm store re-renders the previous
  business's rows instantly. Everything that survives a remount must be enumerated and each item purged or
  deliberately kept — `purgeWorkspaceState` now also resets the redux `invoices` and `currency` slices and
  `profile.friendlyName` (the BUSINESS's Open Page slug living inside an account-scoped slice), while
  deliberately KEEPING `notifications` (partitioned by `/userNumber`, no business filter, legitimately
  shared) and `profile.userProfile`.
- ‼️ **Creating a business is a SWITCH and purged nothing.** The wizard renders outside the dashboard layout,
  so neither the purge nor the remount reached it. Both create surfaces now purge.
- ‼️ **The test must be of the GUARANTEE, not the mechanism.** "purge was called" was true while the bug was
  live. Render a screen with a `useEffect(…, [])`, switch, assert the row is gone and a refetch happened.

### 4. THE WORKSPACE MEMORY IS ON THE DEVICE, KEYED BY ACCOUNT (TD-14)

`clinqetwebpartnerapp/src/utils/workspaceMemory.js` · `clinqetmobilepartnerapp/src/lib/tenancy/workspaceMemory.ts`.

- ‼️ **ONE FIXED KEY holding a LIST keyed BY account**, never `clinket.workspace.{userNumber}`. A per-account
  key name cannot be named in a fixed preserve or purge list — that is exactly how the mobile onboarding skip
  (TB-19j) survived a sign-out and reached the next account on a shared device.
- The account key is the **`UserNumber` claim already in the token** (`userNumberFromToken` on both apps),
  because the memory must be readable at the one moment every other account key has just been wiped.
- Web: named in `PRESERVED_KEYS_ON_CLEAR` so it survives `SessionStore.clear()`. Mobile: deliberately
  **absent** from `clearAuthTokens`'s `multiRemove` list, with a guard that reads that literal.
- **One writer per platform** — `switchBusiness`; a switch, a join and a create all land there.
- A remembered workspace that is gone or unenterable **falls through silently and is forgotten**, so the
  next sign-in does not retry it. Bounded to five accounts, most-recent-first.
- ‼️ **The default when nothing is remembered is the business you OWN**, and that lives in `orderWorkspaces`
  rather than in each landing, so the two apps cannot drift on it.

### 5. `SpotlightType.WorkspaceSwitcher` — its own hint (TD-6)

A new C# enum member — code, not schema; dismissal rides `UserSpotlightDismissal` unchanged. **Its own type
so it reaches people who dismissed the dashboard tour long ago**, which is most of the people who now hold a
second workspace.

- ‼️ **`switcherHintEligible` requires `workspaceChipVisible` FIRST, in the rule, not at the call site.** The
  hint spotlights the chip, and the chip rule once hid it from exactly the person D4 targeted.
- ‼️ **TWO ACTS CAN BE ELIGIBLE ON ONE SCREEN.** A provider holding a second workspace who has also never
  seen the dashboard tour had both calling `drive()`. Both apps now refuse to start a second tour while one
  is live; the loser records **no** dismissal, so it simply shows next visit.
- The icon is **drawn** — inline SVG of the same `lucide-react`/Ionicons building mark the chip already uses.
  Never a glyph or an HTML entity: the brand font boxes unknown codepoints, and a mockup cannot catch it.

### 6. Traps this phase paid for

1. ‼️ **A shared SQL fixture makes a fixed display name meaningless.** `Assert.False(Any(b => b.DisplayName
   == "Second"))` was satisfied by a *different* test's row. Name rows uniquely per run, or the "wrote
   nothing" assertion silently stops meaning it.
2. ‼️ **Name the outcome in a concurrency assertion.** `Assert.Equal(1, results.Count(r => r.Success))`
   failing tells you nothing about WHICH guard fired, and after TD-1 there are two that could. Putting the
   error keys in the message is what found TB-19m in one run instead of three.
3. ‼️ **A `jest.mock` factory referencing a variable declared BELOW it is an ESLint error** even though it
   works at runtime. Declare `let businessValue;` above the `jest.mock` call — and on provider web a
   WARNING is a regression too, so run `eslint --fix` for import order before calling it done.
4. ‼️ **Importing `useTourTarget` into a small component drags `TourContext` → `spotlightCache` →
   `apiManager` → `react-native-device-info` in with it**, and every test that renders that component then
   needs the whole native graph mocked. The dashboard SCREEN owns tour refs; components take a `tourRef` prop.
5. ‼️ **Adding a field to a context breaks every partial `useBusiness` mock**, and the failure names the
   call site, not the missing key.
6. ‼️ **A mobile nested-key collision is silent at authoring time.** Web's `Workspace.CreateOwn` maps to
   `WORKSPACE.CREATE_OWN`, so `Workspace.CreateOwn.AlreadyOwn` would need `CREATE_OWN` to be an object AND a
   string. The web id is `Workspace.CreateOwnBlocked`.

---

## ‼️‼️ TEAM BUG FIX — PHASE 3: WHAT THIS ROLE CAN SEE (2026-08-12). ONE LIST BEHIND THE RAIL *AND* THE SCREEN

> Programme folder `C:\Nik\Team-Bug-Fix\`. Read `PROGRESS.md` there for the full record. Appended, not
> replacing anything above. ‼️ **This block CORRECTS §15.2's "seven screens" note and §20.1's export count.**

### 1. ‼️‼️ `SURFACE_PERMISSIONS` — the ONE list that answers TWO questions

`renderingRules.{js,ts}` now carries **14 surfaces**, each naming the permission its screen's PRIMARY read
demands **and the controller action that demands it**:

```
dashboard(null) · calendar(availability.read) · leads(lead.read) · inbox(conversation.read)
bookings(booking.read) · quotes(quote.read) · invoices(invoice.read) · customers(customer.read)
insights(insights.read) · refundRequests(payment.read) · billing(billing.read) · team(team.read)
activity(audit.read) · callFollowUps(voice.read)
```

- **The rail reads it AND the screen reads it**, so a hidden item's deep link reaches the no-access panel
  **by construction**. Two lists is how a rail comes to offer what a screen refuses.
- ‼️ **The gate is "held at ANY scope", never "held at `Business` scope".** A technician holds
  `invoice.read` at `Assigned`; Phase 4 makes those lists NARROW instead of refusing, so a scope-shaped
  gate would hide a screen about to become theirs. **A technician therefore still sees Bookings, Quotes,
  Invoices and Customers, and those four still refuse until Phase 4 — into the friendly panel, not an error.**
- ‼️ **Deny by default.** An undeclared surface is hidden; a typo cannot open a screen.
- **`activityNavVisible` is DELETED** from both rule files — it asked the same question a second way.

### 2. ‼️‼️ FOUR access states, and the ORDER is the fix

`surfaceAccessState(surface, can, accessKnown, accessFailed)` → `failed` · `loading` · `denied` · `granted`.

- ‼️ **`accessError` is NEW state on `BusinessContext` (web) and `BusinessProvider` (mobile), and it is
  load-bearing.** Gating a screen's loader on `access` WITHOUT it parks every list on a skeleton **for
  ever** after one dropped `GET /business/access`. A refusal is a designed state; an outage is a
  RETRYABLE one; they are not the same screen.
- ‼️ **Provider mobile never reset `accessFetchedFor` on failure and web did**, so mobile had no retry at
  all — one dropped read hid every permission-gated control for the session. Fixed with the same work.
- ‼️ **No business context ⇒ the gate has NO OPINION.** Permissions are then unknowABLE and `WorkspaceGate`
  already owns that state; speaking there is the eternal skeleton again.
- ‼️ **The branch order needs its OWN parity fixture.** `['invoices', ALLOW_NOTHING, false, true]` is the
  only case that separates failed-first from unknown-first — every other fixture passes either way.
  (`tenancyRenderingParity` is **358** cases now, not 341.)

### 2b. ‼️ THE RAIL ANSWERS THE SAME FOUR STATES — `!accessKnown || surfaceVisible(...)`

> Added 2026-09-16 after the collapsed rail was "fixed" by gating the whole app SHELL on `access`.

`surfaceVisible(surface, can)` is the TWO-state rule and is only correct once access is KNOWN. Called bare
it answers "no" to everything for the one request between sign-in and `GET /business/access` — so the rail
collapsed to the rows whose permission is `null` (Dashboard, Ask Clinket), and a refresh "fixed" it because
the cached snapshot seeds `access` before the first paint.

- ‼️ **Every affordance reads `!accessKnown || <the two-state rule>`.** `dashboardCardVisible` already did
  (`if (accessKnown !== true) return true`), and so did `surfaceAccessState`, `capabilityReadState` and all
  three mobile rails. The WEB SIDEBAR and the MOBILE FAB SIDE RAILS were the two calling the bare rule.
- ‼️ **A FAILED read never becomes known, and that is deliberate** — the affordance stays and the SERVER
  decides. A skeleton rail would leave a fully-permitted owner with NO navigation after one dropped request.
- ‼️ **NEVER gate the SHELL on `access`.** `WorkspaceGate`'s children are the whole shell — sidebar, header,
  route content. `switchBusiness` sets `access` back to null, so a shell gated on it tears down and rebuilds
  on every switch, which is exactly what `WorkspaceScopedContent` keeps the shell OUTSIDE its key to avoid
  (TB-09); one dropped read then replaces the entire app with a bare retry card.
- Guards: `sidebarPermissionGating.test.jsx` and `fabSideRails.test.tsx` assert the FULL rail while unknown;
  `accessLifecycle` in BOTH apps asserts the SAME shell node before and after permissions land.
- ‼️ **A test can pin the defect.** The old `sidebarPermissionGating` case asserted exactly
  `["Dashboard", "Ask Clinket"]` for the unknown window, with a comment rationalising it — which is how the
  rail and the phone disagreed for months with every suite green.

### 3. The gate is a WRAPPER, so a refused member never MOUNTS the screen

| Platform | Where |
|---|---|
| Web | `components/tenancy/SurfaceAccess.jsx` — `<SurfaceGate surface="…">` around **ten** `app/dashboard/**/page.jsx` |
| Mobile | `components/tenancy/SurfaceGate.tsx` + `appNavigation/gatedScreens.tsx`, and every navigator registers the **Gated** component |

That is what makes "gate the loading effect" structural instead of ten remembered `if`s — and the 403s in
the owner's network log are no longer issued at all.

‼️ **On mobile the tab BUTTON is hidden (`tabBarItemStyle`) and the ROUTE STAYS REGISTERED**, so a deep
link still resolves and lands on the panel rather than doing nothing.

‼️ **Do NOT gate the inbox, team, activity or locations screens** — they carry a server-driven `denied` and
are correct as they stand (§15.2 names them).

### 4. The copy, and where it comes from

`Access.Denied.{Title,Body,Cta}` · `Access.Unknown.{Title,Body}` · `Access.Surface.{surface}` — 19 web ids,
mirrored on mobile under a new **`Access: "ACCESS"`** entry in `tenancyKey()`'s `NAMESPACES`. ‼️ **The 14
surface labels are DERIVED from each language's existing `sidebar.*` value**, so nothing was translated
twice. The panel names the area, says the role does not include it, offers one way forward, and has **no
Retry** — retrying a refusal never succeeds.

### 5. ‼️ `Permission_*_Name` NOW EXISTS ON BOTH CLIENTS — 90 keys, from the API catalogues

It was **180 keys in the API and ZERO in both bundles**, so react-intl fell back to `defaultMessage` (the
raw key) and i18next returned the key itself: both apps showed `booking.accept` to a human.

- ‼️ **The mobile key IS the web id.** `tenancyKey()` leaves a dotless id untouched — the same shape
  `BusinessRole_*_Name` already uses.
- ‼️ **`Permission_*_Description` was deliberately NOT shipped**: nothing renders it, and an orphan key is
  a defect (§22.2).
- Web **5,180 → 5,291**, mobile **4,704 → 4,815**, API catalogues **2,891 — UNCHANGED**.

### 6. TD-9 — the primary owner's card, DERIVED

`OWNER_ONLY_PERMISSIONS` in `permissionGroups.{js,ts}` drives one sentence plus the two things nobody else
can do, rendered through the names in §5. `NavigationGatesMatchControllerPermissionsTests` computes
owner-minus-administrator from `TenancyRoleCatalogDefinition` and **fails the build if the client literal
drifts** — never author a read-out (§20.6).

### 7. ‼️ THE GUARD THAT KEEPS THE MAP TRUE, and where it must live

`Clinqet.API.UnitTests/Conventions/NavigationGatesMatchControllerPermissionsTests.cs` reads the client
literal, finds each named action in **its own repo's** controllers, and compares. It spans two artefacts by
nature (§0.15), so it **`Assert.SkipWhen`s** the sibling checkout and reports **Skipped**, never Passed.
Four cases: the permission matches · the permission exists in the catalogue · **no role ends up with an
empty rail** · the owner-only pair matches the catalogue.

‼️ **An attribute block MAY CONTAIN A BLANK LINE** (`InvoiceController`'s `[HttpGet]` does). The first cut
stopped there and reported a correctly-gated endpoint as ungated — *a wrong guard accuses working code*.
It terminates on the action SIGNATURE now, which is what makes crossing into the next action impossible.

### 8. The `Modal` primitive is bounded now — every tenancy dialog inherits it

`max-h-[92dvh]` flex column, **body is the only scroller**, footer pinned with `env(safe-area-inset-bottom)`,
bottom sheet on a phone and centred from `sm` up, plus an opt-in `width="wide"`. `ChangeRolesDialog` lost
`max-h-[46vh]` entirely and became a **two-column grid**, so ten roles read as ten rather than as a short
list that happens to be cut off.

### 9. ‼️ Two findings this phase SURFACED rather than fixed — do not treat either as done

- ‼️ **A Catalog Manager's rail is ONE item (Dashboard).** They hold none of the fourteen surface
  permissions; their whole job lives under **Profile**, the always-present footer row. A finding about the
  ROLE, needing an owner decision — **TB-19o**.
- ‼️ **Provider mobile has NO role-change surface.** `updateMemberRoles` has **zero callers**, so an owner
  can change roles on web and not on a phone. Building one is a NEW surface and needs the mockup gate —
  **TB-19q**.

### 10. Traps this phase paid for

1. ‼️ **A `node -e` script in SINGLE-QUOTED bash still loses one level of backslash.**
   `new RegExp("\\{\\s*"+name+"\\s*\\}")` compiled as `{s*names*}` and matched nothing. It failed SAFELY,
   but only because a count guard was watching. **Anchor on a literal `includes` in shell-driven scripts;
   keep regexes in files.**
2. ‼️ **Several source files carry MIXED line endings** (`Invoices.jsx` is 835 CRLF / 838 LF), so a
   multi-line `\n` pattern silently matches zero. Edit by LINE, re-joining with each line's own separator.
3. ‼️ **A JSX wrapper inserted by walking to the first `/>` closes the INNER element.** Match the closing
   tag at the OPENING tag's indentation, or `{cond && (` lands inside an `<Ionicons … />`.
4. ‼️ **A `jest.mock` factory may only reference `mock`-prefixed outer variables** — mobile fails the whole
   transform otherwise and reports **0 tests**, which reads like a missing suite rather than a broken one.
5. ‼️ **The sidebar's Profile row is a `<div>`, not a `<button>`** — `getAllByRole("button")` does not see
   it, which makes it the right control for an exhaustive rail assertion.

---

## ‼️‼️ TEAM BUG FIX — PHASE 4: ASSIGNED WORK (2026-08-12, COMPLETE). THE NARROW-SCOPE ROLES CAN FINALLY WORK

> Programme folder `C:\Nik\Team-Bug-Fix\`. Read `PROGRESS.md` there for the full record. Appended, not
> replacing anything above. ‼️ **This block CORRECTS §5.6, §10.1's `ReassignedQuotes` note, §19.1's first row,
> §20.1's export/parity counts, §20.2's `isDomainForbiddenUrl` note and TD-3's own container table.**
>
> **PHASE 4 IS COMPLETE — all four parts.** The server narrows and assigns; the control ships on provider web
> AND provider mobile for **all four** work kinds from the row and the detail view; TD-21's mobile roles screen
> exists. What the phase did NOT do is §8 below, and it is short and specific.

### 1. ‼️ Corrections to this skill

| Section | Said | **Measured / decided 2026-08-12** |
|---|---|---|
| §19.1 row 1 | Assignment WRITES for Quote/Invoice/leads "+ their `ProviderData` index paths" are owed | **Built** — and ‼️ **no `ProviderData` index path was needed or added** (TD-17). Assigning a lead is a partition-keyed POINT READ plus one write; it never runs `ARRAY_CONTAINS` |
| §10.1 | `ReassignedQuotes` / `ReassignedLeads` "remain **0**" (L108) | **No longer 0.** `HandOverQuotesAsync` / `HandOverInvoicesAsync` / `HandOverLeadsAsync` exist, with paired `Released*` counters, and "open quotes" is back in the removal-impact preview (A4's reason expired) |
| §6.1 · ABSOLUTE RULES 7 | **90 permissions**, `CatalogVersion = 1` | **92** (`quote.assign`, `invoice.assign` — owner-approved **TD-16**), `CatalogVersion` **2** |
| §5.6 | `PermissionScope.Business` on whole-business surfaces including LISTS | ‼️ **Six list endpoints moved to the DEFAULT scope** so a narrow-scope member REACHES the action and the query then narrows: `BookingController` GET `paginated` · `QuoteController` GET `""` + `paginated` · `InvoiceController` GET `""` + `summary` + `earnings` · `CustomerController` GET `business` |
| §20.1 | `renderingRules.js` has **64** exports, parity spec **286** cases | **73** exports, **406** cases |
| TD-3's table | `BroadcastProvider` is in `Transactions` | ‼️ **`ProviderData`** (`BroadcastProviderRepository.cs:22`), which carries neither assignment path |

### 2. ‼️ THE LIST NARROWS; THE EVALUATOR STILL DECIDES — and the predicate must reach the COUNT

`clinqetcore/Services/Tenancy/WorkListNarrowing.cs` is the whole seam, written once so four surfaces cannot
drift: `None` · `AssignedToMembership` · `AssignedToTeams` · `MatchesNothing` · `Unsupported`.

- ‼️‼️ **These lists page by `OFFSET/LIMIT` + `COUNT(1)`, NOT by keyset like the inbox**, so narrowing only the
  data query returns a right page under a wrong total — "page 2 of 9" of a three-row list.
  `CosmosDbRepository.ApplyNarrowing` is shared by **six** queries across three repositories for that reason.
- ‼️ **A `Business`-scope member SKIPS it entirely** — same page, same query, same cost as before Phase 4, and
  `ReplaceItems` returns the ORIGINAL page object.
- ‼️ **`Unsupported` REFUSES rather than serving wide or short**, and is unreachable by construction:
  `WorkListNarrowingContractTests` fails the build if any role grants a work-list permission at `Branch`,
  `CreatedByMe` or `Participating`.
- **TD-7 — customers is DERIVED, in ONE query.** `BusinessCustomer` has no assignment field, so
  `IBookingRepository.GetAssignedCustomerIdsAsync` runs `SELECT DISTINCT VALUE c.customer.customerId … WHERE
  c.type IN ('Booking','Quote','Invoice') AND ARRAY_CONTAINS(...)` — Booking, Quote and Invoice share ONE
  container, ONE partition key and the same customer path, so it is one query, not one per type. The customers
  list was ALREADY a full-partition read paged in memory, so intersecting costs **no additional read**.
  Bounded by `Tenancy:WorkLists:MaxAssignedCustomerIds` (500), and the ceiling is **logged**.

### 3. Assignment: four controllers, one shape, one write path

`WorkAssignmentControllerBase` holds the shape once — partition-keyed read → `EnforceResourceScope` →
`IBusinessAssignmentGuard` → **ETag** write → notify — behind `BookingAssignmentController`,
`QuoteAssignmentController`, `InvoiceAssignmentController` and `LeadAssignmentController`
(`PUT` and `GET .../{id}/assignment` each). Route segments `bookings` · `quotes` · `invoices` · `leads`; ids
`bookingId` · `quoteId` · `invoiceId` · `broadcastId`.

- ‼️ **The old `BookingAssignmentController` wrote with NO ETag** — a plain `UpdateBookingAsync`. Two
  dispatchers assigning at once was a silent last-write-wins the day it got its first caller (**TB-19t**). All
  four writes are `PatchOperation` + `ifMatchEtag`; a 412 surfaces as **409 + `work_assignment_conflict`**.
- ‼️ **`[JsonIgnore]` was NOT touched.** The provider learns the holder through `WorkAssignmentDetailDto` on a
  provider-only route a customer token can never reach.
- ‼️ **TD-24 — the READ answers to the record's own READ key** (`booking.read` / `quote.read` / `invoice.read` /
  `lead.read`), and `EnforceResourceScope` runs on **that** key, so an `Assigned`-scope technician reads their
  OWN record's assignment and nobody else's. **`Targets` come back ONLY to a caller who also holds the assign
  key** — a roster of colleagues is not a read-only fact. `PUT` is unchanged.
- ‼️ **TD-27 — the assignee's NAME is on the DTO (`AssignedDisplayName`), and it HAS to be.** It lives nowhere
  else: `Targets` are withheld from a reader **and** filter `Status == Active`, so a record held by a
  since-suspended colleague resolved to no name **even for a dispatcher**.
  `IWorkAssignmentService.ResolveAssigneeNameAsync` is one indexed seek, constrained to **this** business (a
  foreign id resolves to null rather than naming another tenant's member), read with **`IgnoreQueryFilters`**,
  and **not asked at all when nothing is assigned**.
- ‼️ **TD-28 — `GetAssignmentTargetsAsync(…, includeConversationWorkload: false)` on this read.** Its
  `OpenConversationCount` comes from a **full-partition Cosmos read of every conversation**, and the assign
  control renders **role pills** instead. **The inbox reassign dialog still passes `true` — it draws the
  number.** Never make this read pay for it again.
- **TD-16 — `quote.assign` and `invoice.assign` are new catalogue keys.** ‼️ `invoice.assign` goes to
  **`finance`, NOT `dispatcher`**: a dispatcher holds no `invoice.read` at all, so granting it would be a
  permission to act on a surface they cannot see.
- **`lead.assign` is no longer an orphan** — and ‼️ **its registry REASON was factually wrong** (**TB-19u**): it
  claimed the endpoint needed a `ProviderData` IncludedPath. It never did. **An exemption's reason rots as
  easily as the exemption.**
- **TD-23 — BIDDING IS THE CLAIM.** Placing or updating a bid stamps the bidder as the lead's assignee **when
  the lead is unassigned**; a dispatcher's explicit assignment is never yanked away, and they can reassign at
  any time. The claim rides the **SAME ETag-guarded patch as the bid**, so it is atomic with it. ‼️ **Only a
  PERSON claims** — the membership comes from `IActorAttributionAccessor`, registered only in hosts with a
  caller, so a Functions/MCP (voice) bid carries a `System` actor and claims nothing.

### 4. `NotificationType.WorkAssigned` — and the two things that make routing it non-trivial

Five artefacts, all present: the enum member · a **`Personal()`** descriptor (‼️ **never the `Assignment`
routing class** — that resolves assignee + team + watchers **+ admin**, and TD-8 says the assignee alone) ·
`NotificationRoutingCatalogTests.BuildExpected()` · `SignalRSettings:EnabledNotificationTypes` · the
`TeamMembership` preference category. `SkipPush` + `SkipEmail` + `SkipSms`, pinned.

- ‼️ **The EventId is the DELIVERY id**: `work-assigned:{kind}:{workId}:{membershipId}:{writtenAt:O}`, where the
  stamp is the document's post-write `UpdatedAt`. A re-assignment is a NEW notification; a Service Bus
  redelivery of one write collapses. **Stored data plus a write stamp, never a GUID** (L88).
- ‼️ **`ResolvedRecipient.BusinessId` is carried** — omitting it writes a **null OVER it**, and that null is
  hashed into the idempotency key.
- ‼️‼️ **`NotificationContext` CANNOT DISTINGUISH AN INVOICE FROM A QUOTE.** There is no
  `NotificationContext.Invoice`, so `ContextFor(Invoice)` maps to `Quote` — deliberately, and the code says so.
  **A client routing on the context alone sends an invoice assignment to the QUOTES list** (**TB-19ab**). The
  kind therefore travels explicitly in **`NotificationMetadata.Properties["workKind"]`** — the free-form bag
  both clients already read, so no new type and no new DTO field — and each kind is pinned to its own list:
  web `/dashboard/{bookings,myQuotes,invoices,leads}`, mobile `{BookingScreen, Quotes, InvoicesScreen,
  BroadcastScreen}`. **A payload with no kind lands on the dashboard, never a guessed list.**
- ‼️ **`navigations.MYQUOTES = 'MyQuotes'` names a screen NO navigator registers** (**TB-19ac**). The mobile
  quotes list is `Quotes` (`MyDashboard-Route.tsx:163`). The reachability guard walks the routes that EXIST, so
  it cannot see a constant pointing at one that does not. **Read the navigator.**
- ‼️ **A reachability guard PASSES on the notifications fallback**, because the fallback is a real screen. Every
  work kind is therefore pinned explicitly on both apps, exactly as `TeamInvitationReceived` is.

### 5. The client contract — ONE control, four kinds, and the rules are the parity

`clinqetwebpartnerapp/src/components/tenancy/AssignWorkDialog.jsx` (dialog + row button + detail card) and
`clinqetmobilepartnerapp/src/components/tenancy/AssignWorkSheet.tsx` (bottom sheet + the same two). Nine shared
rules in `renderingRules.{js,ts}`: `WORK_ASSIGNMENT_KINDS` · `workAssignmentPermission` ·
`workAssignmentTitleKey` · `workAssignmentRowVisible` · `workAssignmentCardState` · `workAssignmentDialogState` ·
`workAssignmentRefusal` · `workAssignmentOptions` · `workAssignmentEmptyState`.

- ‼️ **ONE request when the control opens** — assignee, name and eligible people together. **Never also
  `GetInboxAssignmentTargets`**: it is gated on `conversation.assign`, which **Finance does not hold at all**,
  and folding the targets into the record's own read is exactly why that route exists.
- ‼️ **THE LIST ROW CARRIES AN ACTION AND READS NOTHING** until the control opens — pinned on both apps. The
  assignee is `[JsonIgnore]` and absent from every list payload, so a name per row is a **request per row**.
- ‼️ **SIX card states and the ORDER is the rule**: undeclared kind → **silent** · `access === null` →
  **silent** · a **FAILED** read before `loaded` → `assignUnknown` for somebody who can assign and **silent**
  for somebody who cannot · loading · assign · reassign · readOnly. **A dropped read never becomes a claim**:
  "Nobody yet" is a statement about the record, and an action is not.
- ‼️ **A reader with an assignee gets the NAME and NO control** — not a disabled one. **A reader with no
  assignee gets NO CARD**: nothing to say, nothing to do.
- ‼️ **A 409 and a "that person has left the business" share the BUTTON ("Load the latest") and never the
  SENTENCE.** `workAssignmentRefusal(code).reload` separates the refusals a reload fixes from the ones "try
  again" can resolve. **"Try again" retries the CHOICE that failed**, held in a ref — retrying the current
  assignee would silently discard the decision still shown as selected.
- ‼️ **No team section** (TD-19): the RULE drops teams so no call site has to remember, and the client sends
  `teamIds: []`. The API still accepts them.
- ‼️ **`Assign.Card.Locked` deliberately does NOT use the mockup's literal string.** The mockup said *"Only a
  dispatcher can change this"* — **factually wrong for an invoice**, because a dispatcher holds no
  `invoice.read`. It reads *"Your role can't change who's handling this"*. **Never author a read-out the
  catalogue contradicts** (§20.6).
- ‼️ **The mobile invite CTA must use the NESTED navigate.** `TeamInvite` is registered in `MyDashboard-Route`
  **alone** while the four work screens live in **three** stacks, so `navigate('TeamInvite')` from a booking
  detail resolves to nothing. **Reachability is per stack, never the union** (§20.3).
- Copy: **24 keys**, web flat `Assign.*` → mobile `WORK_ASSIGNMENT.*` via a new `Assign` entry in
  `tenancyKey()`'s `NAMESPACES`. **A WHOLE title key per kind** — the work type lands mid-sentence in English
  and before the verb in Hindi and Gujarati.

### 6. ‼️ Traps this phase paid for — every one measured

1. ‼️‼️ **A DIRECTLY-CONSTRUCTED CONTROLLER RUNS NO AUTHORIZATION FILTER.** Part 2's sabotage re-tightened the
   GET's `[RequiresPermission]` and bit the **reflection** Theory and **none of the four behavioural cases** —
   the attribute is never evaluated. **A behavioural controller test proves the BODY; only reflection or a real
   pipeline proves the GATE.**
2. ‼️‼️ **TWO LITERALS AGREEING IS NOT A GUARD.** Restoring the dead `/dashboard/quotes` deep link left the
   route-resolution guard GREEN: it asserted `/dashboard/myQuotes` **resolves**, not that the service
   **composes** it. Fixed by making `WorkAssignmentService.WorkspacePathFor(kind)` **public** and deriving the
   guard's theory from it.
3. ‼️‼️ **`expect(obj).not.toHaveProperty("a.b.c")` READS THE DOTS AS A PATH** (**TB-19aa**). The web
   catalogues are FLAT, so an orphan-key assertion resolved `en.Team` → `undefined` and **could never fail in
   either direction**. Only the ARRAY form means a literal key. **Found by a sabotage that did not bite.**
   Sweep every other flat-catalogue `toHaveProperty` in both apps.
4. ‼️‼️ **RESTORING A SABOTAGED C# FILE BY FILE-COPY CAN LEAVE AN mtime MSBuild TREATS AS UNCHANGED**, so the
   next `dotnet test` recompiles nothing and runs the **SABOTAGED** binary — two tests "failed" with the source
   visibly correct on disk. **`touch` the restored file and read the BUILD output before believing the test.**
5. ‼️ **A parity fixture and a behavioural case prove DIFFERENT things, and you need both.** Three of this
   phase's sabotages bit one of each: the parity spec proves the two apps AGREE, a behavioural case proves an
   app CONSULTS the rule. **A branch order no fixture distinguishes is not covered, however many fixtures
   there are** — `{loaded:false, failed:true}` and `{conflict:true, failed:true}` are the two that separate
   this phase's orders.
6. ‼️ **`useBusiness()` THROWS when the provider is absent, by design**, and two existing booking suites mount
   the detail view in isolation. Adding the assignment card broke them and **the code was right** —
   `BusinessProvider` is at the ROOT layout on provider web and `businessProviderReachability.test.js` proves
   it. **Mock the context in the suite; never weaken the hook.** `access: null` is the honest default.
7. ‼️ **An attribute block may contain a COMMENT line, not just a blank one** (**TB-19s**). Adding
   `// TD-2: …` above four `[RequiresPermission]` attributes made the navigation guard report **four
   correctly-gated endpoints as missing** — *a wrong guard accuses working code*, one step past TB-19r.
8. ‼️ **A JSX wrapper inserted by walking to the first `/>` closes the INNER element.** Match the closing tag
   at the OPENING tag's indentation.
9. ‼️ **Mobile source is CRLF and web is LF, and a `$1` inside a `node -e "…"` under bash is expanded as a
   POSITIONAL PARAMETER and silently becomes EMPTY.** Detect the EOL by COUNTING, edit by LINE, keep patterns
   in a file, and never put a capture-group reference inside double quotes in a shell.

### 7. Part 4 — the other three surfaces, the mobile roles screen, and two decisions

**Six call sites per platform, and nothing new was needed** — quote row + detail, invoice row + detail, lead
row + detail, on web and on mobile.

- ‼️ **The ids are the whole risk, and one of them is a trap.** `InvoiceCardCompact.jsx:42` and the mobile
  invoices list both hold a local `invoiceId = invoiceNumber || invoiceId` — that is the **ROUTE** id. Passing
  it as `workId` composes `PUT /business/invoices/{invoiceNumber}/assignment`, which 404s, and no build, no
  lint and no render test would say so (**TB-19af**). Guarded by `assignWorkCallSites.test.{js,ts}`, which
  **SWEEPS** every usage in each tree rather than enumerating call sites, and asserts: each `workId` binds that
  kind's own id field · none binds a `*Number` field · all four kinds have exactly a row and a detail card.
- ‼️ **The mobile GRID card carries no row control, on any kind, and web's agenda views are untouched** —
  bookings set that precedent in Part 3. The DETAIL view always carries the control, so nothing is unreachable.
- **TD-30 — the lead's affordance is `tone="quiet"`**: a dashed, unfilled pill, because **"Place a bid" stays
  the green action** (TD-23). `tone` is presentation, not a rule — `workAssignmentRowVisible` still decides
  whether the control exists — so `tenancyRenderingParity` stays at **406**.

**TD-21 — `Screen/ProfileFlow/Team/MemberRolesScreen.tsx`**, reached from `MemberDetailScreen`'s footer behind
provider web's own gate, unchanged: `can('team.assign_role') && !member.isPrimaryOwner`.

- ‼️ **TD-29 — it is DELIBERATELY ABSENT from `linking.ts`**, and the other FOUR registration files are filled
  (`constant.tsx` · `types.ts` · `MyDashboard-Route.tsx` · `screenMap` → `team_member_roles`). Provider web
  renders roles as a **DIALOG** on `/dashboard/team` and serves no `/dashboard/team/roles`; a mapping would
  claim a path the web app 404s. **TD-25 and TB-19x one artefact along.** `navigationSpine` proves every entry
  `linking.ts` HAS resolves — it does not require one per screen, and must not.
- ‼️ **FOUR outcomes in the pinned order** — `accessError` → `access === null` → denied → granted — written out
  rather than borrowed by declaring a **sixteenth** `SURFACE_PERMISSIONS` entry nobody navigates to. Without the
  first arm, one dropped `GET /business/access` parks the screen on a skeleton for ever (TB-19p).
- ‼️ **`SurfaceNoAccess` gained an optional `areaLabel`** so a refusal that is not one of the fifteen surfaces
  can still use the one shared panel. The label is **DERIVED** from `Permission_team_assign_role_Name`, which
  already exists in both bundles — never authored (§20.6).
- ‼️ **The screen reads NOTHING until it knows the reader may act.** The first cut mounted its effect
  unconditionally and issued two requests purely to be refused; its own test caught it before it shipped.
- ‼️ **`isDomainForbiddenUrl` NO LONGER EXISTS** — `tenancyForbiddenIsNotLogout.test.ts` is the live guard, and
  it matches **literal URLs**. `API.business_members` is `business/members`; `business/members/roles` and
  `business/members/{id}/roles` are different paths and were **not** covered. Both are now listed.
- Copy: **4 mobile keys × 5 files** (`TEAM.DETAIL_CHANGE_ROLES` · `TEAM.ROLES_TITLE` ·
  `TEAM.ROLES_AT_LEAST_ONE` · `COMMON.SAVE`), every value **DERIVED** from a web key that already existed in
  all five languages. **The web catalogue is unchanged.** Bundles 4,866 → **4,870**.

### 8. ‼️ What Phase 4 has NOT done — short, specific, and not "no time"

| Outstanding | Where it stands |
|---|---|
| **The acceptance journeys against a running app** | Never walked, across Phases 1-4. Both apps point at the deployed dev stamp, so this needs **Phase 4 deployed there** AND **a seeded technician login with credentials**. Without both, TB-17 returns the old answer and a green walk is a lie |
| **TB-19ae — the `createdAt` ordering defect** | **DIAGNOSED, not fixed** (§9). The fix changes a platform-wide write format and is the owner's call |
| **`InvoiceCard.jsx` (444 lines, ZERO importers) and `navigations.MYQUOTES`** | Dead code SURFACED, not removed — neither is this programme's file (TB-19ag, TB-19ac) |
| **The pixel check at 320/480/768/1024/1280** | Needs a browser and a device. Structure is pinned by tests; appearance is not |

### 9. ‼️‼️ TB-19ae — A `DateTime` WRITTEN WITHOUT A FORMAT MAKES COSMOS `ORDER BY` DISAGREE WITH TIME

**This is platform-wide, not admin-alert-specific, and it is the diagnosis of the intermittent named across
three parts** (`AdminAlertControllerTests.GetAlerts_CursorPaging_ReturnsDisjointNewestFirstPages`).

`BaseEntity.CreatedAt` is a bare `[JsonProperty("createdAt")] DateTime` with **no converter and no format**, and
**no `CosmosClientOptions.Serializer` is registered anywhere**. The SDK's Newtonsoft serializer therefore writes
`yyyy-MM-ddTHH:mm:ss.FFFFFFFK`, and **`F` OMITS TRAILING ZEROS**. Cosmos orders on the stored **string**, so
`"…22.12Z"` sorts AFTER `"…22.1234567Z"` while being the EARLIER instant.

- **The failing assertion is the WITHIN-PAGE ordering, never the intersection.** Ruled out by reading: the
  keyset predicate (a page-1 row can never satisfy it), the composite index (`SystemData` **#13** is
  `(type ASC, createdAt DESC, id DESC)` — all 13 enumerated), ties (the `id DESC` tiebreaker), and a newer row
  arriving mid-page (it fails the cursor predicate — a gap, never an overlap).
- **Green in isolation** because the four seeded alerts share ONE `DateTime.UtcNow` (Windows' ~15.6 ms tick), so
  their strings are identical. **Red about once in three FULL runs** because `BroadcastControllerTests`,
  `CategoryAdminAlertIntegrationTests` and every `FailureNotificationHelper` path write alerts into the same
  shared `SystemData` container from parallel collections.
- **Recommended fix: give `createdAt` a fixed-width ISO format** so string order and chronological order cannot
  disagree. ‼️ **Every Cosmos `ORDER BY` on a `DateTime` written this way has the same exposure.**

### 10. ‼️ Two more traps Part 4 paid for

1. ‼️‼️ **`expect(obj).not.toHaveProperty("a.b.c")` HAD A SECOND SITE.** `teamsSurfaceRemoved.test.js` hid
   **three** such assertions in one loop against the FLAT web catalogue (**TB-19ad**). Verified in BOTH
   directions: the ARRAY form fails on exactly that assertion when the orphan key is re-added, and **the old
   string form passes 5/5 against the same file containing it.** Sweep result across both provider apps: **6**
   `toHaveProperty` assertions, 2 already correct, 2 single-segment against a NESTED object, **3 the defect**.
   **Provider mobile has none — its bundles are nested, so the shape cannot arise there.**
2. ‼️ **A sabotage pattern ending in `\n` matched ZERO against CRLF mobile source, the diff printed nothing,
   and the suite reported 4/4 GREEN** — a textbook "the sabotage did not bite" that was really "the sabotage
   never applied". Only the script's `throw` on a no-op replace caught it. §18.2.5, live. **Every pattern must
   be `\r?\n`-safe, and every sabotage must print its diff.**

## ‼️‼️ TEAM BUG FIX — PHASE 5: THE HOLISTIC AUDIT (2026-08-12, COMPLETE). THE DECLINE THAT DID NOT EXIST, AND THE JOIN SEAM PROVED

> Programme folder `C:\Nik\Team-Bug-Fix\`. Read `PROGRESS.md` there for the full record — Part 1 shipped the
> platform-wide Cosmos serializer (TD-31), the dashboard card gates (TD-32), the `enterJoinedWorkspace` seam
> (TD-33) and the switcher bottom sheet (TD-34); Part 2 finished the phase. Appended, not replacing anything above.

### 1. ‼️ Corrections to this skill

| Section | Said | **Measured / decided 2026-08-12 (Part 2)** |
|---|---|---|
| §20.5 | web 5,052 / mobile 4,565 keys | web **5,344** · mobile **4,868** · API **2,901** (after the ClinketAi orphans went) |
| Phase 4 block §4 | — | `InvitationPreviewDto` now carries **`BusinessId`** — a DTO field, not schema (TD-27's precedent); the pending-invitations list already exposed it to the same caller |
| activity actor rendering | `System` ⇒ "Clinket AI" | ‼️ **`System` renders as AUTOMATIC.** Every caller-less writer is the broadcast fan-out (a CUSTOMER posted a request) or the auto-completion timer — the voice-AI host has NO activity feed — so "Clinket AI" credited the assistant with every lead every provider ever received. `Activity.Actor.ClinketAi(Note)` deleted from all ten catalogues |

### 2. ‼️‼️ "NOT NOW" IS A DESTINATION, AND THE EXITS USED TO LOOP (the owner's journey)

There is **NO decline endpoint**, deliberately — an invitation lapses by itself. "Not now" on the emailed
acceptance screen was `router.replace("/")` alone, the stash survived it, and the landing re-sends anybody
whose stashed token is still alive straight back to `/invitation` — **a fresh invitee who pressed "Not now"
was trapped between two screens**. The same trap sat behind "Go to Clinket" on the noSeats, throttled, error
and wrong-account states, and on mobile the AsyncStorage stash re-opened the acceptance screen on **every
cold start** until the token was spent.

**The shape now, identical on both apps (`leaveInvitation`):**

1. **An explicit exit SPENDS the stash** — the emailed link and the switcher's INVITED section are the ways
   back in. ‼️ The ONE exception is **wrong-account**, which must keep the stash for the invited address to
   come back to; it records the suppression instead, and `purgeClientState()` clears that record on the next
   sign-in so the right person is bounced straight back.
2. **The decline is recorded PER INVITATION for the session** — one fixed key holding a LIST (web
   `clinket.invitation.declined` in sessionStorage; mobile in-memory in `lib/tenancy/invitationDecline.ts`,
   cleared by the same session sweep as the onboarding skip). `"*"` records an exit from a state that never
   learned which invitation it was. ‼️ **Per-invitation matters**: a SECOND business inviting them mid-session
   is still announced; a global bit would silence it.
3. **Where they land is a SHARED rule** — `invitationDeclineDestination(workspaceCount, listLoaded)`:
   somebody who holds **no business** lands in the **ONBOARDING STEPS** (the owner's stated requirement);
   everybody else goes back to the app. ‼️ `listLoaded` is required for 'onboarding' — an unloaded list reads
   as zero, and relocating on data never received is the TB-02 shape.
4. **The landing and both gates honour the record** — `undeclinedInvitations(invitations, declinedIds)`
   filters the invitation-outranks branch in `HomeClient` and the `InvitedNotJoined` offer in both
   `WorkspaceGate`s; when nothing undeclined remains, the plain start screen renders. **"Set up my own
   instead" records the same decline** for everything on offer, so abandoning the wizard cannot land them
   back on the screen they just left.
5. **A fresh emailed link clears every decline** — re-engagement is explicit.
6. The error and throttled states gained a "Go to Clinket" exit beside Try again — **a screen must never be a
   room with no door**, and the only exits were retries that could sit failing forever.

‼️ **The wizard's own create call was the FIFTH workspace entrance and it skipped the guarantees.**
`ensureBusinessExists` (web `BusinessDetails.jsx`, mobile `BusinessDetailsApi.tsx`) — the create every fresh
invitee who pressed "Not now" walks through — captured the session and nothing else. It now writes the
per-account memory (creating IS choosing, TD-14), records the onboarding state, and refreshes the workspace
list (web explicitly via `reloadWorkspaces()`; ‼️ mobile deliberately does NOT — `saveAuthTokens` announces
the session and `BusinessProvider.syncFromSession(true)` reloads off that announcement). Web also purges,
exactly as `CreateBusinessDialog` does.

### 3. ‼️ THE SEAM AND THE HIGHLIGHT ARE NOW PROVED, NOT ONLY GUARDED (Part 1's debt)

- ‼️ **`joinInvitationFlow.test.jsx` (web) EXISTS NOW.** The mobile twin's header cited it for months while it
  did not exist — a guard that is only ever named is not a guard. Both files pin the TD-33 seam against the
  REAL provider: the list reload (§4.5 — an exchange returns an EMPTY `Businesses` list, so the reload must be
  explicit), the TD-14 highlight, the ride-along purge + per-account memory, and the refused-entry inverse.
- **Eight sabotages, every one diffed, every one bit exactly its named test, every one restored
  byte-identical**: the seam's reload (both apps), the seam's highlight (both), the landing's sign-in
  highlight (both — web `multiWorkspaceLanding`, mobile `workspaceMemoryAndHint`), `CurrencyInitializer`'s
  refusal bound (new `currencyInitializer.test.jsx` — a 403 is terminal per token, a drop stays retryable, a
  new token re-arms), and the TD-34 sheet (new `workspaceSwitcherSheet.test.jsx`, which pins the class
  contract: viewport-anchored below `sm`, popover only behind `sm:`, body-only scroller, safe-area padding).

### 4. ‼️ THE COMPOSITION AND SWEEP FINDINGS FIXED IN PART 2 — each is a class, not a site

| One sentence, no file names | Where it was live |
|---|---|
| **A root-level provider holding business-scoped state survives a workspace switch** | the billing overview (plan · seats · tier) kept rendering the PREVIOUS business after every switch — `purgeWorkspaceState()` now dispatches `WORKSPACE_PURGE_EVENT` (`onWorkspacePurge`), the same shape `onAuthPurge` covers for the account boundary; any future root provider subscribes or it lies after every switch |
| **A write that changes what a person holds does not refresh the workspace list** | ownership-transfer ACCEPT on both apps — `isPrimaryOwner` lives on the list rows and drives owned-first ordering + the TD-1 create gating |
| **A button that says dashboard opens the onboarding wizard** | mobile quote-confirmation "Back to dashboard" reset to `ABOUTPROFILEROUTE` — a member of somebody else's business was dropped into their employer's wizard (the TB-05 class, behind an explicit tap) |
| **A display number is passed where the route takes the raw id** | web quote-list "Send by email" posted `quoteNumber \|\| quoteId` to `POST /quotes/{quoteId}/send` (a point lookup by ID) ⇒ 404 for every numbered quote. ‼️ The defect was born one WRAPPER away from the service call, so `sendConfirmationCoverage` now sweeps the ARGUMENT shape across every file, with a positive control on the exact line that shipped. Bookings/invoices genuinely take the number — quotes-only |
| **One actor marker covers every caller-less write and renders as the AI** | activity feed on both apps (§1 above) |

### 5. ‼️ FOUND AND RECORDED, NOT FIXED — decision-shaped, owner's call (see `prompts/CLOSE-OUT.md`)

The unowned-areas sweep (admin support lookup · activity feed · notification routing · shared inbox ·
invitation email) found **12** items; the three P1s every future session should know:

- ‼️ **The shared-inbox assignment/release/follow writes take NO caller ETag** — the repository re-reads and
  patches with its own fresh etag, so a stale view silently overwrites a newer assignment, and the narrow race
  that IS caught surfaces as **404 "conversation not found"** for a thread visibly on screen. The four work
  kinds all take `ifMatchEtag` and answer 409 (TB-19t's fix); conversations are the one that did not.
- ‼️ **Handing a conversation to a colleague notifies NOBODY** — the one work type with a response-time clock
  (SLA) is the only one whose assignment sends no alert; `ProviderInboxService` has no dispatcher dependency
  at all. Adding a notification is a TD-8-shaped owner decision (five artefacts).
- ‼️ **The inbox reassign roster silently drops deactivated accounts** — it joins `Users` WITHOUT
  `IgnoreQueryFilters` while every sibling read takes it deliberately, so a member holding six threads is
  named on the threads and absent from the picker.

Plus: `BookingCreated` written on the customer-initiated path renders as "the platform did this" (needs a
`Customer` actor distinction — enum value + writer changes); work assignment writes no activity row; the
`BusinessSecurity` routing class computes a permission-eligibility set it never reads; the admin seat card
renders the protection ceiling as the budget; a `"Support"` role gate no endpoint accepts; two admin DTO
fields rendered nowhere; a lockout flag the roster shape never carries; the expired-invitation copy hardcodes
"seven days" in ten files while expiry is a setting; seven team-lifecycle notification types land on the
notifications fallback instead of `/dashboard/team`; and the web AI-assistant + payment-settings screens (and
mobile payment settings) still render a refusal as a retryable failure — the TB-15 shape on two surfaces
outside the fifteen `SURFACE_PERMISSIONS` entries.

### 6. ‼️ Traps Part 2 paid for

1. ‼️ **`grep -oE 'w-\[NNNpx\]' | grep -v max-w` filters NOTHING** — `-o` emits only the extracted fragment,
   so the exclusion never sees the `max-w-` prefix it was written to exclude. Filter on the full line, or the
   sweep reports every bounded card as an overflow hazard.
2. ‼️ **A sabotage pattern written with `\n` matches zero against a CRLF file** (§18.2.5 again) — the harness
   must translate the pattern into the FILE's own EOL and refuse a 0-match apply. It refused twice this
   session; both were CRLF, not absence.
3. ‼️ **`findAll` on a react-test-renderer tree matches the composite AND its host node** — a `.length === 1`
   assertion on a pressable counts 2. Count DISTINCT labels or assert presence.
4. ‼️ **The Browser pane cannot composite in an unattended session** — the rendered-pixel walk needs a
   displayed pane (a user present) or a device. Structure was pinned by class-contract tests instead; the
   pixel walk stays owed with the journeys.

---

## ‼️‼️ TEAM BUG FIX — FINAL (2026-08-13, TWO PARTS). THE PROGRAMME CLOSES: THE OWNER'S FOUR LIVE FINDS, THE INBOX ETAG ROUND TRIP, AND THE TEN SWEEP FINDINGS

> Programme folder `C:\Nik\Team-Bug-Fix\` — `PROGRESS.md`'s last two sections are the full record. Appended,
> not replacing anything above. ‼️ **This block CORRECTS the Phase 5 block's §5 ("FOUND AND RECORDED, NOT
> FIXED") — every item there is now FIXED — and §13.1/§13.2's BusinessSecurity descriptor note.**

### 1. ‼️ Corrections to this skill

| Section | Said | **Measured / shipped 2026-08-13** |
|---|---|---|
| Phase 5 block §5 | TB-19ar/as/at "recorded, not fixed — owner's call" | **ALL FIXED** (TD-36 converted the recommendations into build orders; both parts shipped them) |
| §13 catalog descriptors | BusinessSecurity types carry permission keys (`voice.settings.manage`, `team.read`, …) | ‼️ **A BusinessSecurity descriptor carries NO permission key.** The resolver's branch is admin + AffectedMembershipId and never reads the eligibility set, so the sixteen keys gated NOTHING while the routing-settings card counted their holders as recipients. Stripped; pinned by `BusinessSecurityDescriptors_CarryNoPermissionKey…` |
| §5.4 / F3 registry | `voice.number.manage` "on the SensitiveOperations list, no endpoint" but absent from the orphan registry | ‼️ **It is in `OrphanPermissionRegistryTests` now** — its only source-text consumer was the dead descriptor key, so the strip exposed it and the registry demanded it (the guard was RIGHT) |
| §20.1 / parity | 427 cases (Phase 5) | **446** (Part 1 +17 capability rules; Part 2 +2: the D3 options passthrough, the B2 Customer actor) |
| §20.5 counts | web 5,344 · mobile 4,868 · API 2,901 | API **2,903** · clients **+5 keys per file** (see §6) — and the client repos advanced under the programme, so absolute totals are the tree's, not the programme's |

### 2. Part 1 — the owner's four live finds (TB-19au/av/aw/ax · TD-37.1-4), both apps, sabotage-verified

- **The phone-width web chip is the monogram** (+ chevron) below `sm` — name block `sr-only sm:not-sr-only`,
  TD-14 ring on the BUTTON, TD-34 sheet untouched. RN unaffected (its chip is its own row).
- ‼️ **A read the access snapshot says will be refused is NEVER fired** — three shared rules
  (`capabilityReadState` — failed ⇒ ALLOWED, the server decides; `capabilityAccessState`;
  `serviceCatalogEditable`) + **`CapabilityGate`** on both apps: a refused member's screen is NOT MOUNTED,
  TD-12 panel exactly once, area derived from `Permission_{key}_Name`. `CurrencyInitializer` moved INSIDE
  `BusinessProvider`, gated on `insights.read` — the owner's two statistics calls on My Bookings were both
  it. Every /dashboard/profile page is gated or registered-with-reason (`profileScreensAreCapabilityGated`,
  42 cases); every mobile navigator registers the GATED component ("gated everywhere or nowhere").
- **Every role sees services, read-only**: grants (code) — `catalog.service.read` → finance;
  `servicearea.read` → technician, contractor, finance. No CatalogVersion bump (grants are in-memory).
  Both services screens hide every edit affordance without `catalog.service.update`; the AI quick-setup
  entrances count as writes. ‼️ The owner's live 403 as technician was the DEPLOYMENT GAP — re-test on the
  deployed stamp.
- **A permission refusal never toasts**: web `showError` + mobile `toastApiError`/`toastApiResponseError`
  refuse `errorCode === "permission_denied"` (the machine code, never the sentence); THE DEDUP PIN on both
  apps — two refused constituent reads ⇒ ONE panel, ZERO toasts, neither read fires.
- **TB-19ar/as SERVER**: `SetAssignmentAsync`/`SetWatchersAsync` take `ifMatchEtag`; a missing/stale etag =
  **409 `work_assignment_conflict`, never 404**; `InboxConversationDto.ETag` +
  `ConversationEtagRequestDto`; proved on the REAL emulator (a stale caller LOSES). ‼️ **`ClaimAsync` is
  deliberately NOT etag-gated** — its conditionExpression is the guard and the loser is told the WINNER.
  `NotifyConversationAssignedAsync` mirrors the four kinds: `WorkAssigned` + `workKind="conversation"`,
  assignee only, in-app+SignalR, EventId = stored data + write stamp, no self-claim announcement.
  `ProviderInboxService.InboxWorkspacePath` is a public const the route guard derives from.

### 3. Part 2 — the etag CLIENTS, the fifth kind, and all ten sweep findings

- ‼️ **The wire casing was PROVED before anything read it**: `JsonSerializerDefaults.Web` serializes `ETag`
  as **`eTag`** (executed, not assumed). Requests bind case-insensitively.
- **Both apps send the RENDERED row's etag** on reassign/release/follow (web
  `tenancyServices`/inbox page; mobile `tenancyService`/ChatList/ChatDetails — the row-tap and the claim
  navigation thread `eTag` + the fresh assignment through the route params, and every write's returned DTO
  refreshes it). **Claim carries none, pinned on both apps.**
- **The 409 arm**: `workAssignmentRefusal(code).reload` is the ONE classifier. `WorkConflictBanner` (both
  apps) renders the four kinds' own `Assign.Error.Conflict` + "Load the latest" — **no Retry**; the web
  ReassignDialog gained a conflict state (people hidden, reload in the footer, refetch re-points the open
  thread); ‼️ **mobile ChatDetails' reload returns to the LIST** — the messaging `ConversationResponseDto`
  deliberately carries no assignment fields or etag (exposing them would hand the CUSTOMER the assignee,
  invariant #10), the list refetches on focus, and ChatDetails is registered in the Inbox stack alone.
- **`workKind === 'conversation'` routes to the INBOX** (web `/dashboard/inbox`, mobile `ChatList`),
  lowercase because ProviderInboxService writes the literal; pinned beside the four kind pins on both apps.
- **TB-19at, all ten** (each sabotage-verified):
  **D3** — `GetAssignmentTargetsAsync` reads Users with `IgnoreQueryFilters`; `InboxAssigneeDto` gained
  `IsAccountDeactivated`; ‼️ the SAME targets feed the four-kind assign dialog (TD-24), so ALL FOUR pickers
  label a closed account with the roster's own `Team.Status.AccountClosed` key; `workAssignmentOptions`
  passes the flag (parity fixture).
  **B2** — `BusinessActorType.Customer`, stamped STRUCTURALLY by `ActorAttributionAccessor` (an
  authenticated non-admin with no tenant is the customer branch of a shared endpoint — the only writes that
  succeed without business context), rendered "The customer" + note on both apps; the old accessor test
  asserted the defect and was re-pointed.
  **B3** — `BusinessActivityType.WorkAssigned` + a recorder call in `WorkAssignmentService.ApplyAsync`
  AFTER the committed write (optional `IBusinessActivityRecorder?`, the BookingController pattern); a
  RELEASE and a lost etag race record nothing; SubjectType = the kind so B/Q/I rows link; the assignee's
  name rides `ResolveAssigneeNameAsync` (one seek). Chip `Activity.Type.WorkAssigned`, category
  `Activity.Category.Team` (‼️ the mobile key-resolution guard REQUIRES every chip-listed type to carry a
  category pill — it caught the categoryless first cut).
  **C1** — the sixteen dead BusinessSecurity keys STRIPPED (see §1). Measured first: no role below
  administrator holds either voice key, so "honour the key" would have fixed nothing while widening seven
  team-lifecycle audiences.
  **A1** — the admin seat card's budget is the TIER limit: "X of {base} used (+Y protected)".
  **A2** — the dead `"Support"` clause dropped (every tenancy endpoint is `Roles = "Admin"`).
  **A3** — the two unrendered provenance fields render: "Sarah Whitfield (A7X2M) is Administrator —
  membership suspended".
  **A4** — `AdminBusinessMemberDto.IsLockedOut`, projected from `LockoutEnd > now`; a lapsed lockout is
  false; pinned locked/lapsed/free.
  **E1** — `Accept.Expired.Body` reworded DURATION-FREE per language in the ten files that carry it
  (‼️ measured: 5 web + 5 mobile — the API email templates never held the sentence); `invitationExpiryCopy`
  sweeps on both apps refuse a digit or the written "seven" in any language.
- **The seven lifecycle fallbacks, decided by READING `TeamLifecycleNotifier`**: `TeamMemberJoined` and
  `TeamInvitationRejected` resolve to **ADMINS ALONE** (Joined passes no affected member; a rejection names
  none) → routed to `/dashboard/team` / mobile `TeamScreen`. ‼️ The five siblings keep the fallback
  DELIBERATELY: Suspended/Removed/TransferCompleted dispatch twice and the subject's copy is
  indistinguishable from the admins' on the client (the outgoing owner keeps NO roles, measured);
  Reinstated/TransferInitiated carry the affected member in the business audience. All seven pinned on both
  apps; `BusinessOwnershipTransferCancelled` (the eighth sibling) stays with them.
- **The two tracked pre-programme leftovers are DELETED** (`update_locales.js`, `remove_seo.js` —
  TD-36-approved, zero references measured first).

### 4. ‼️ Traps this session paid for (new or re-fired)

1. ‼️ **`grep -cE ": error" && dotnet test` SKIPPED a sabotage's test run** — `grep -c` exits 1 on zero
   (§18.2.1 fired again, mid-sabotage-pass). Run the test unconditionally; list errors with plain `grep`.
2. ‼️ **A source-sweep regex capturing to the first `)` breaks on `(conversation as any)`** — capture to
   the statement end (`\\);`), or a multi-line call site with an inner paren silently truncates the match.
3. ‼️ **Stripping a "dead" string can orphan a permission**: the routing key WAS `voice.number.manage`'s
   last source-text consumer, and the orphan registry rightly failed. When you delete a decorative
   reference, re-ask which guards counted it as life.
4. ‼️ **A chip-listed activity type MUST carry a category pill** — `tenancyLocalizationKeys` enforces it;
   a categoryless type resolves `key: null` and fails there, not at render.
5. ‼️ **The client repos move UNDER a long programme** (other work merges); full-suite totals are the
   tree's, not the session's. State your own deltas; never reconcile someone else's growth into your count.

### 5. What this feature area now guarantees (the closing contract)

- **Every shared-inbox write is compare-and-set**: the caller's rendered etag or a 409 with the reload arm;
  a lost race is never a 404 and never a silent overwrite; claim's loser is told the winner by name.
- **Every work assignment tells its assignee** (five kinds now) **and writes a feed row** (four kinds; a
  conversation assignment is announced but deliberately writes no row — the notifier is its record).
- **The activity feed's actor is always honest**: Member by name · Clinket support · Automatic · **the
  customer** — and never "Clinket AI", never "Active" about a locked-out account on the admin roster.
- **A notification's tap target never lands on a screen its recipient cannot open** — measured per
  audience, not assumed per type.
- **No catalogue copy promises a number a setting owns.**

### 6. Measured at close (2026-08-13)

All 8 solutions 0 errors · API unit **9,120** · Communications **1,914** · CosmosIndexSetup **70** ·
web jest **1,601/132** + ESLint 0/0 · mobile jest **2,249/129** + tsc clean + 0 errors in touched files ·
admin **192/18** + lint clean · parity **446** · API catalogues **2,903** · client catalogues +5 keys per
file (`BusinessActivity_WorkAssigned` · `Activity.Type.WorkAssigned` · `Activity.Category.Team` ·
`Activity.Actor.Customer` · `Activity.Actor.CustomerNote`), key sets identical · **16 sabotages, all
diffed, all bit their exact named target, all restored byte-identical (C# on fresh builds)** · the four
Testcontainers suites deliberately NOT run (no §0.8-mandated class touched; Part 1's 1,756 · 420 · 434 ·
67 stand).

‼️ **The one open item is owner-blocked, not code**: the 61+16 running-app journeys + the rendered-pixel
pass need a seeded dev-stamp technician login (deployment is confirmed). Everything else in the Team Bug
Fix programme is CLOSED — `C:\Nik\Team-Bug-Fix\prompts\CLOSE-OUT.md` says so and lists only that.

### SAME-DAY ADDENDUM (2026-08-13): the live walk's finds — TB-19ay/az/ba shipped; TB-19bb open

The owner tested the deployed stamp live (owner session, then technician). Contract changes to know:

- **TB-19ay — `GET categories/selections/services` now takes `catalog.service.read` (Business), not
  `catalog.category.read`.** It returns the services CATALOGUE and is the services screens' constituent
  read on both apps (TD-37.3's rule: every role sees the catalogue). Category-MANAGEMENT reads
  (`selections`, custom categories) keep `catalog.category.read`. Pinned in `CategoryControllerTests`
  (`…IsTheServicesScreensConstituentRead…`).
- **TB-19az — the shared billing-overview read answers to `billing.read` BEFORE it fires.**
  `BillingOverviewProvider` now nests INSIDE `BusinessProvider` (it sat above and could not ask `can()` —
  TD-37.2's exact trap); `ensureLoaded` refuses on a KNOWN-denied snapshot, DEFERS while the snapshot
  loads (consumers re-arm via callback identity), falls through on a FAILED snapshot read, and exposes
  `billingPermissionDenied` — `PlanStatusCard` is ABSENT on denial (never a skeleton) and
  `AssistantStatusStrip` counts the denial into `entitlementKnown`. `planStatus: "billing.read"` is a
  `DASHBOARD_CARDS` entry on BOTH apps (parity-pinned); the dashboard page gates the card like every
  sibling. Mobile's two former leaks (ProfileScreen PRO chip, CallFollowUps engine-tier read) gate on
  `can('billing.read')`; the tier chip falls back to the live voiceline model name. Pins:
  `billingOverviewGate.test.jsx` (8 behavioural + 2 source), `dashboardCardGating` planStatus rows,
  `billingReadGate.test.ts` (mobile).
- **TB-19ba — `SurfaceNoAccess` renders `tone="info"`** (navy `#032858` on `bg-[#E4EEFB]`), matching the
  Activity/Inbox denied panels; a role boundary is calm information, never amber. Class-pinned in
  `surfaceAccessStates.test.jsx`.
- **TB-19bb — OPEN: the SOLO-PROVIDER experience.** A one-member business still sees every team verb
  (assign panels on all five kinds, the inbox's five audience tabs). The full work order — the shared
  `soloBusiness` rule, the surface × disposition table, the MOCKUP GATE on the inbox's solo shape,
  transition dynamics, the nine-dimension edge-case audit, the remaining technician walk — is
  `C:\Nik\Team-Bug-Fix\prompts\SESSION-SOLO-EDGE-CASES.md`. Do not build team-chrome features without
  reading it: every team affordance is about to answer to one shared solo rule.

### SOLO-PROVIDER ADDENDUM (2026-08-13, the TB-19bb session): every team affordance answers to ONE rule

> TB-19bb FIXED both apps; TB-19bc/bd/be found and fixed same-session. Contract changes to know before
> touching any team chrome:

- ‼️ **`soloBusiness(access)` is THE gate for every team verb** (`renderingRules` twins): solo =
  `memberCount <= 1 && pendingInvitationCount === 0`. Suspended members COUNT as team (their assignments
  render labelled); Removed folds; a pending unexpired invitation counts (chrome appears at INVITE time).
  `access === null` and MISSING counts both answer false — UNKNOWN renders the TEAM shape, and a client
  deployed ahead of the server must never fold a real team. **Never re-derive team size from raw counts on
  a screen; consume `useBusiness().solo`.**
- **`GET /business/access` now carries `MemberCount` + `PendingInvitationCount`**, computed LIVE per fetch
  by `BusinessMemberDirectory.CountRosterAsync` (one round trip, existing indexes). ‼️ They are deliberately
  NOT on the cached `AuthorizationSnapshot` — its cache key is version-scoped and roster changes bump
  nobody's AuthorizationVersion, so a cached count would be wrong by design. No server cache on top: the
  client pins the response per business (the client IS the cache).
- **`refreshAccess()`** (both contexts) re-reads access WITHOUT nulling the rendered one. Call it after any
  count-changing action (invite create · revoke · member remove — all three swept by source on both apps).
  Cross-device folds ride the new **`onTeamRosterChanged`** SignalR subscription
  (TeamMemberJoined/Removed/InvitationRejected; Suspended/Reinstated deliberately excluded). Invitation
  EXPIRY folds at the next natural access fetch (`ExpiresAt > now` in the count, so the hourly sweeper's
  lag never holds chrome open).
- **What solo hides (all sabotage-verified)**: the four kinds' assign row-buttons + cards (their
  `GetWorkAssignment` read is NOT fired — `useWorkAssignment(…, accessKnown && !solo)`); the inbox's five
  audience tabs (`inboxTabs` returns `[]`; the strip returns null WITH its wrapper), the "All" scope note,
  "See what the team is handling", claim/pills/follow/hand-over/take-over/"Replying as", with
  `inboxDefaultView(solo)="All"` and the FIRST inbox fetch deferred until access resolves; the
  Work-assigned + Team-notifications chips (`TEAM_ONLY_ACTIVITY_CHIPS`); the routing panel (folds to
  `Notifications.Routing.SoloTitle/Body`, read not fired) + its Team entry; the team-activity read; the
  locations "staff" verb + staff counts + the roster fetch; the web ownership-transfer card (TB-19bc —
  mobile's entry is on another member's detail, unreachable solo). Actor notes have `…NoteSolo` variants.
  Overdue banner + unread badge STAY (customer facts; `Inbox.Unread.Solo` label). Doors stay (Team page,
  invite); existing rows stay (facts). Solo ⇒ the one member is the Active primary owner
  (PrimaryOwnerProtected), so solo never intersects narrow-scope states.
- **TB-19bd — activity SubjectId is "what the detail route OPENS"**: booking/invoice recorders write the
  NUMBER (their routes are number-keyed), quote keeps the raw id, WorkAssigned rows follow per kind.
  Pinned by `ActivityLinkSubjectTests` + `WorkAssignmentServiceTests`. A guid there 404'd live.
- **TB-19be — the generic `NotificationAwareness` feed row is GONE**: the dispatcher records ONLY
  producer-declared typed rows (`AwarenessActivityType`); the Notifications chip left `ACTIVITY_TYPES`
  ×both twins and its key left all 10 catalogues (old rows still render via their stamped summary key,
  90-day TTL). `NotificationRecipientsCapped` KEPT: ‼️ delivery to everyone up to the cap is UNTOUCHED
  (in-app + SignalR + push; protected/owner/admin kept first) — the row only records the overflow.
  Reworded ×5 API files; chip = "Team notifications" ×10, team-only.
- Parity 448 → **480**; web catalogues 5,364/file; suites: `soloProvider.test.{jsx,tsx}`,
  `soloTransitions.test.jsx`, `BusinessRosterCountsTests`, `BusinessAccessCountsTests`,
  `ActivityLinkSubjectTests`. The activity chips strip uses `chip-strip-scroll` (thin navy), never
  `no-scrollbar`.


## ‼️‼️ ROLE CLARITY + ROUTING REDESIGN (2026-08-14, owner-approved end to end). THE "SEE MORE" DIALOG, TWO ROUTING TARGETS, AND THE MONEY ROUTE FINALLY WIRED

> Mockup `C:\Nik\Data\mockups\team-role-clarity\team-roles-and-routing.html` (approved, including the
> told→"notified" wording pass). Appended, not replacing anything above. ‼️ **This block SUPERSEDES three
> earlier facts:** §13.1's "a Financial route changes nothing" (it restricts now), Session-2 §8's ""A team"
> option UNTOUCHED" (the owner reversed it live on 2026-08-14 after hitting
> `notification_route_target_invalid`), and §12.2 item 4's second bullet (RESOLVED — the control was right,
> the resolver was wrong).

### 1. The role-detail dialog — DERIVED rows, one dialog, seven entry points

- **`RoleAccessSummaryCatalog`** (`clinqetinfrastructure/Data/SQL/`, beside the role catalogue) derives a
  plain-language summary per role from `GrantsByRoleKey`, in memory — no DB read, no schema, nothing
  authored (§20.6). 13 areas (`RoleAccessArea`), 5 levels (`RoleAccessLevel`), 9 nameable actions
  (`RoleAccessAction`) — all string-serialized enums in `clinqetshared/Enums/`.
- **Levels are mechanical:** all grants narrow-scoped → `AssignedWork`/`AssignedView`; zero writes →
  `ViewOnly`; ≥4 writes → `Full`; 1–3 writes → `Limited` with the named extras ("View, plus: create, send").
- ‼️ **Six permissions are deliberately EXCLUDED from areas** (`ExcludedPermissionKeys`): `media.*` and
  `ai.*.use` are supporting capabilities, not browsable areas; the owner-only pair renders through the
  owner/administrator banners instead. ‼️ **`payment.record_offline` is area-OVERRIDDEN into Bookings** —
  it is the bookings cash-paid endpoint, and leaving it in PaymentsPayouts showed the Operations Manager a
  money row the role cannot open.
- `BusinessRoleAssignmentDto` gained `Access: List<RoleAreaAccessDto>` — attached post-materialisation in
  `ListAssignableRolesAsync`. **Zero extra SQL; the roles endpoint the screens already call.** Unknown role
  key → empty list → the dialog shows the description alone (never "no access to everything").
- **Guards** (`RoleAccessSummaryCatalogTests`): every permission maps to exactly one area XOR the exclusion
  list · no role mixes Business and narrow scopes inside one area · every `Limited` row names ≥1 action ·
  every `RoleAccessAction` renders in ≥1 system role (no orphan enum values) · pinned snapshots for
  technician/contractor/auditor + exact action lists for sales/finance/ops · the service attaches summaries.
  **`RoleAccessAreasMatchClientTests`** pins the clients' `ROLE_ACCESS_AREA_ORDER` literal against the enum
  name-for-name and in order — `Assert.SkipWhen` the web repo is absent (§0.15).
- **Web** `RoleDetailDialog` (`MemberDialogs.jsx`): three variants via `roleDetailVariant` — owner (the
  existing derived owner card), administrator ("Everything in {business}, except two things:" + the
  owner-only pair + "Those two always stay with the primary owner."), standard (rows + "No access to"
  chips). **Mobile** `RoleDetailSheet.tsx` — same rules, bottom sheet.
- **Entry points, all seven:** invite role cards ("See more"), `ChangeRolesDialog` cards ("See more" —
  swaps the modal body, never stacks a second overlay), team-roster member chips, roster INVITATION chips,
  member-drawer chips, mobile `MemberRolesScreen` cards, mobile member-detail chips. Chips are
  `PillButton`s (new primitive). ‼️ **A chip inside the roster `<tr>` needs BOTH `stopPropagation`s —
  click AND keydown** — the row listens for Enter/Space, so an unstopped keydown opens the member drawer
  over the dialog. ‼️ **The ChangeRoles "See more" needs `preventDefault`** — a button inside a `<label>`
  toggles the checkbox by default.
- New rendering rules (twins + parity fixtures): `ROLE_ACCESS_AREA_ORDER` (constant), `roleAccessAreaKey`,
  `roleAccessLevelKey`, `roleAccessActionKey`, `roleDetailVariant`, `roleAccessRows` (drops unknown areas —
  an older client meeting a newer server must not render raw enum names), `roleNoAccessAreas` (derived from
  the SAME order list, so an area can never appear in both sections or neither).
- The nine role DESCRIPTIONS were owner-reviewed against the grants and kept verbatim.
- Mobile `tenancyKey` gained the `Team: 'TEAM'` namespace — safe because nothing else routed a `Team.*` id
  through it (the team screens' own chrome uses TEAM.* directly). Mobile roster/detail now load
  `getAssignableRoles` in their existing parallel batches.

### 2. Notification routing — the redesign that shipped

- **Two targets only: `AllWithPermission` and `ExplicitMembers`.** `UpdateRouteAsync` REFUSES `Team` and
  `OwnerOnly` outright (`notification_route_target_invalid`) — teams have no creation surface anywhere, so
  the old "A team" button errored 100% of the time (owner hit it live). ‼️ It also refuses any category not
  in `RoutingCategories`: `ContextMessage` honours a route in the resolver, but no surface renders one, so
  accepting it would store policy nobody can see or undo.
- **`GetRoutingAsync` stopped loading teams — two fewer SQL queries per open.** A legacy stored
  Team/OwnerOnly row (dev DBs only; prod writes were impossible) presents as Everyone — matching the
  resolver's missing-team fallback — and heals on the next save. DTO cleanup: `Teams`,
  `NotificationRoutingTeamDto`, `TeamId`/`TeamName`/`RoutedTeamMissing` (route DTO), `TeamNames` (member
  DTO) and `TeamId` (request) are GONE. The resolver's own Team branch STAYS (enum values are SQL data).
- ‼️‼️ **THE MONEY ROUTE IS WIRED NOW (owner-approved).** `NotificationRecipientResolver`'s Financial branch
  mirrors WorkIntake exactly: under `TeamBroadcastRestrictedToRouted` (true everywhere) a configured route
  REPLACES the eligible set; admins are still always added. The old additive union made every stored Money
  route a no-op. Pinned by `Financial_ConfiguredNamedPeople_RestrictsToThemPlusAdministrators` (+ the
  setting-off case) and the SQL suite; the 176-cell recipient matrix still passes (admins/owner always in).
- **`RecipientCount` is the UNION with the always-included administrators** — `Math.Max` under-counted
  (2 named non-admins + 1 admin = 3, not 2).
- **`EligibleMembershipIds` is new on the route DTO**: who "everyone who can handle it" means right now.
  ‼️ **The picker offers exactly these people** — naming somebody whose role cannot receive the category
  was a stored no-op (a role-less/ineligible member never resolves). Administrators render as visible,
  non-choice "Always notified" rows (`alwaysIncluded` on both MemberPickers).
- **Naming people is a DRAFT with an explicit Save** ("Save — notify only these people"); nothing is stored
  until confirmed, Cancel restores, Save is disabled at zero, and the consequence warning sits above the
  picker. Choosing Everyone over a saved named route writes immediately (nothing to lose).
- **Adjustable cards first; the locked classes fold into ONE "Always automatic" block at the end**
  (`routingCardOrder` + `routingAutoLineKey` — AssignmentTask/BusinessSecurity get their own sentence,
  anything new falls back to `Notifications.Routing.NotAdjustable`). The per-card admins note replaced the
  old bottom banner.
- **Wording is "notified" everywhere** (owner-directed): page title "Who gets notified about what", the
  count line, the API error `Error_NotificationRouteTargetInvalid` — ×5 API files, ×5 web, ×5 mobile.
- **Deleted as orphans** (×10 client catalogues): `Notifications.Routing.{Everyone,Team,Named,OwnerOnly,
  TeamMissing,WhichTeam,TeamFallbackWarning,AdminsAlways,Fixed,Target.Team}` + `Notifications.Team.FilterAll`
  (the picker's team-name filter chips died with the teams data). **Deleted rules:** `routeSummary` and
  `routeMemberPicker` lost their last callers and left both twins + fixtures + the localizationContracts
  entry (‼️ `DYNAMIC_LOCALIZATION_DOMAINS.tenancyNotifications` enumerates runtime-generated keys and FAILS
  the build when a key it names is deleted — update it in the same change).

### 3. Traps this session paid for

1. ‼️ **A background `dotnet test` piped through `Select-String "error"` hides the real failure** — it
   matched "ErrorMessage" inside pre-existing WARNINGS and exit 255 arrived with only noise. Pipe plain
   `-v q` tails, filter after.
2. ‼️ **`BusinessNotificationRoute.TeamId` has an FK** — a "legacy Team row" integration fixture must seed a
   REAL `BusinessTeam` (which is also the only shape a legacy row could ever have had).
3. ‼️ **`NotificationSettingsSqlTests`' seeded colleagues had NO ROLES**, so every named-people scenario was
   vacuous (nobody but the owner was ever eligible). They hold a business-scoped `dispatcher` role now —
   branded to the scenario's BusinessId so the shared fixture cannot collide.
4. ‼️ **A new sheet that calls `useSafeAreaInsets` breaks every mobile suite that mounts its screen** —
   the house pattern is a per-file `jest.mock('react-native-safe-area-context', …)`, not a provider wrap.
5. **PowerShell's `ConvertFrom-Json` cannot parse the web catalogues** (case-insensitive dictionary;
   `Profile.Offers` vs `profile.Offers` both legitimately exist). Validate with node.
6. **`npx next lint` is not a thing here** — `npm run lint` (plain eslint with a content cache).

### 4. Measured at close (2026-08-14)

API solution 0 errors · Functions/MCP/Identity solutions 0 errors · role/routing unit classes **235**
(230 + the 5 cross-artefact guard cases) · `NotificationSettingsSqlTests` **20/20** vs real SQL ·
`NotificationRoutingIntegrationTests` green · web jest full **139 suites / 1,692** + ESLint 0 errors ·
mobile jest full **135 suites / 2,409** + `tsc --noEmit` clean · parity **489** · localization: web
catalogues 5,400/file, mobile NOTIFICATION_SETTINGS 127 + TEAM 143 per file, all five identical by key
set · Functions/MCP/Identity solutions rebuilt green with zero hand edits.


## ‼️‼️ SAME-DAY ADDENDUM (2026-08-14): CATALOG MANAGER GETS `availability.read` — AND THE GRANT-CHANGE PLAYBOOK

> Owner-approved live: view-only availability for `catalog_manager` (MANAGE stays with owner/admin/ops/
> dispatcher — hours change when customers can book and when the voice AI answers). Grants are CODE, so a
> grant change reaches SQL nowhere; what needed engineering was everything AROUND the grant.

### ‼️ THE GRANT-CHANGE PLAYBOOK — five steps, never fewer (owner-mandated: "never ever get missed")

The clients DERIVE everything — menus, gates, refusal panels, the role "See more" dialog — from
`GET /business/access` + the rendering rules, so a grant change needs **zero UI edits for menus/gates**.
The work is the seams:

1. **Edit `TenancyRoleCatalogDefinition` and bump `CatalogVersion`** in the same change. The version is now
   the **authorization snapshot cache epoch** (`AuthorizationSnapshotProvider.CacheKey` embeds it): without
   the bump, a deployed grant serves the OLD cached permission set until `SnapshotCacheSeconds` runs out —
   the owner watched exactly this ("I changed it and still see the refusal"). The seeder side of the bump is
   a harmless one-row marker stamp (grants never reach SQL; only the 10 role rows + `CatalogVersionState`
   live there). ‼️ Never LOWER the number: dev DBs already store the old value, and code < stored makes the
   seeder consider itself current forever.
2. **Update `RoleAccessSummaryCatalogTests` pins consciously** — the derived "See more" dialog follows the
   grant automatically; the pinned snapshot failing is the review surface, not an obstacle.
3. **Sweep the COMBINATION, not the permission**: list which gated screens the role can NEWLY open
   (`SURFACE_PERMISSIONS` + the profile `CapabilityGate`s) and check every OTHER read/write those screens
   fire is either held by the role or gated on `can()`. `availability.read` made catalog_manager the
   first-ever role that opens Calendar while holding ZERO booking access — both calendars fetched bookings
   unconditionally and offered add-booking affordances.
4. **On mobile, treat any newly reachable refused call as the CP10 hazard**: an unexpected 403 on a URL
   outside `isDomainForbiddenUrl` force-logs the member out. Gating the fetch on `can()` is correctness
   there, not politeness.
5. **Deploy; clients pick the new set up on next app load / workspace switch.** No per-member action, no
   manual cache flush — that is what step 1's epoch is for.

### What this specific grant shipped (both apps)

- **Calendar, web (`CustomCalendar.jsx`)**: booking fetch + the hover "+" injections + date-click/select
  add paths + the add sidebar all gate on `can('booking.read')`/`can('booking.create')` — `SurfaceGate`
  mounts the screen only after access is KNOWN, so `can()` is authoritative inside it. A no-booking viewer
  gets the schedule grid plus one line: `Calendar.BookingsNotInRole` ("Bookings aren't part of your role,
  so the calendar shows the schedule without them"), ×5 web files.
- **Calendar, mobile (`CalenderTab/Calendar/calendar.tsx`)**: same gates (`access !== null && can(...)`
  since the tab's mount guarantee is weaker than web's); the no-read state renders a lock +
  `CALENDAR.BOOKINGS_NOT_IN_ROLE` (×5 mobile files) instead of "No bookings + Add booking", and the empty
  state's Add button now needs `booking.create`.
- **Set Availability, mobile (`completeProfileFlow/SetAvailability`)**: gained the read-only mode web
  already had — `hoursPermissionState` + the `Locations.Hours.ReadOnly` note, day/time/copy handlers
  no-op, and the WHOLE `StepFooter` is absent when not editable. ‼️ Web's wizard rule copied exactly:
  `entryContext === 'onboarding'` bypasses the gate, because inside onboarding the permission set is not
  loaded yet and gating there locks the owner out of their own setup. Web's page needed NOTHING (it and
  `LocationHoursScreen` already handled read-without-manage for technician et al.).
- Role-dialog pin extended: catalog_manager now shows `Calendar & availability — View only`.

---

## The go-live strip's label ids — the one rule that answered differently per platform (2026-08-25)

`__tests__/tenancyRenderingParity.test.ts` failed on a clean tree: web exported
`ONBOARDING_STEP_LABEL_IDS`, mobile exported `ONBOARDING_STEP_LABEL_KEYS`, and `onboardingTrack`
returned `labelId` on one side and `labelKey` on the other with a DIFFERENT string in it
(`voiceAssistant.onboarding.step.BusinessDetails` vs `VOICE_ASSISTANT.ONBOARDING_STEP_BUSINESS_DETAILS`).

- ‼️ **The mobile module was the defect, not the spec.** `lib/tenancy/localizationKeys.ts` states the
  contract in its own header: the rules return the WEB ids, and `tenancyKey()` is the ONE mechanical
  translation at the render boundary. A rule that answers with a platform-specific id defeats the point.
- Fixed by renaming the mobile export to the web name, carrying the WEB ids, returning `labelId`, and
  resolving through `tenancyKey(entry.labelId)` in `GoLiveTrack.tsx`.
- `tenancyKey`'s `NAMESPACES` gained **`voiceAssistant: "VOICE_ASSISTANT"`** — safe because the five
  onboarding step ids are the only `voiceAssistant.*` ids any rule returns, and the mechanical transform
  lands exactly on the keys the AI-assistant gate already ships
  (`onboarding.step.BusinessDetails` → `ONBOARDING_STEP_BUSINESS_DETAILS`).
- ‼️ **Neither the rule nor its label map was in the parity table at all** — that is why a
  platform-specific id survived. `onboardingTrack` now has 4 fixture rows and
  `ONBOARDING_STEP_LABEL_IDS` is in `CONSTANTS`; `tenancyLocalizationKeys.test.ts` resolves all five ids.
  Counts at this date: **103 exports each side**, parity spec **494** tests, key spec **223**.

### ‼️ Every cross-repo guard in `clinqetmobilepartnerapp` now SKIPS LOUDLY (§0.17)

Four suites read `../clinqetwebpartnerapp` at module or describe-body scope, so in CI — which checks out
ONE repo — they would have thrown `ENOENT` before any `it()` ran, failing the suite rather than skipping
it. `describe.skip` still EXECUTES its callback; only `it()` bodies are skipped.

- `tenancyRenderingParity` (sandbox-evaluates the web module), `analyticsWebParity` (walks the web src
  tree), `paymentSettingsCopyParity` (reads the web message catalogue) and `deepLinking` (reads the AASA
  + the web route tree) now guard on `fs.existsSync` at module scope and defer every peer read into a
  memoised getter called from inside `it()`.
- Own-repo assertions were MOVED OUT of the guarded describes so they still run in CI: the bank-privacy
  sentence, the mobile billing-purchase guard, the retired-verb guard, and the five deep-link routing
  checks. **Proven** by pointing the peer paths at an absent directory: 579 skipped, 20 passed, 0 failed.
- These cannot move to `azureautomation/deploy.ps1` (rule 4) — they compare a JSON file served by the web
  app, a JS module, a message catalogue and a TS routing table compiled into the mobile binary. deploy.ps1
  ships none of them. So they stay, and report **Skipped** on the one machine that cannot answer them.

## P4-39 — one member-name rule, looked up inside the business (2026-09-27)

- Every roster, inbox and team announcement names a member through `MemberDisplayName.Of(first, last, email)`
  (`clinqetcore/Utilities/MemberDisplayName.cs`); the private copies in `ProviderInboxService`,
  `TeamLifecycleNotifier` and `WorkAssignmentService` are gone. The claim-based names (`ActorAttributionAccessor`,
  `BusinessSearchController`) read TOKEN claims, not stored members, and are a different rule on purpose.
- ‼️ A membership id is resolved ONLY within the business the work belongs to (`membership.BusinessId == businessId`):
  the inbox holder names and the team-announcement name used to look an id up across every tenant.
- The notification-settings roster (`BusinessNotificationSettingsService.LoadMembersAsync`) lists exactly the people
  `NotificationRecipientResolver` delivers to — active membership, open and UNSUSPENDED account (`IgnoreQueryFilters`
  + both predicates). It used to count a suspended colleague as someone who would be told.
- Tests: `ProviderInboxAssignmentTests` (AHolderFromAnotherBusiness…, TheHolder_IsNamedByTheOneMemberNameRule),
  `TeamLifecycleMemberNameTests`, `BusinessNotificationSettingsRosterTests`, and against SQL
  `NotificationSettingsSqlTests.ASuspendedOrClosedAccount_IsNeitherOfferedNorCounted`.
- Assignment and claim patches (quotes, leads, conversations) now stamp `updatedBy*` like a replace — see
  `clinqet-cosmos-data`.
