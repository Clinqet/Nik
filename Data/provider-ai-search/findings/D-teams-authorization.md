# D — Multi-user provider authorization model (Teams) — handover for "Provider AI Search"

Re-measured on **2026-09-02** against the CURRENT working trees under `C:\Nik` (clinqetshared `e5bec24`,
clinqetcore `fd04b1a`, clinqetinfrastructure `6341780`, clinqetapi `6a61450`, clinqetmcp `8406310`,
clinqetfuncations `43ec2c0`, clinqetwebpartnerapp `99ff26ba`, clinqetmobilepartnerapp `bd630f0e`).
Read-only; nothing in any repo was modified. **Every line number below was re-grepped at these HEADs.**
Section 13 lists every difference from the earlier draft of this file.

---

## 0. Executive summary

1. Authorization is **permission key × scope**, resolved per request from the signed provider token, never
   from the client. The catalogue is **code**: `C:\Nik\clinqetinfrastructure\Data\SQL\TenancyRoleCatalogDefinition.cs`
   defines **94 permission keys** (lines 49-178), **10 system roles** (184-303), `CatalogVersion = 4` (line 18).
   ‼️ Both figures moved this week — see §13.1.
2. `PermissionScope` has **7 values** ordered narrow→broad: `None, CreatedByMe, Participating, Assigned,
   Branch, Team, Business` (`C:\Nik\clinqetshared\Enums\PermissionScope.cs:8-17`). **Only `Business` and
   `Assigned` are granted by any role** (catalogue helpers 307-311; SKILL line 2167) —
   `Team/Branch/Participating/CreatedByMe` are evaluator branches with no grantor today.
3. The request-scoped truth is `TenantContext` (`C:\Nik\clinqetshared\Models\TenantContext.cs:7-19`): UserId,
   UserNumber, BusinessId, MembershipId, AuthorizationVersion, AccessScope (Full/BillingOnly),
   RelationshipType, IsPrimaryOwner, RoleKeys, **Permissions (key→scope)**, TeamIds, BranchIds. Built once per
   request by `TenantContextMiddleware` (`C:\Nik\clinqetapi\Clinqet.API\Middleware\TenantContextMiddleware.cs:62-84`)
   from a 60 s cached SQL snapshot.
4. `[RequiresPermission(key, minimumScope)]` is an MVC `IAsyncAuthorizationFilter`
   (`C:\Nik\clinqetapi\Clinqet.API\Authorization\RequiresPermissionAttribute.cs:20`); per-record narrowing is
   `IResourceScopeEvaluator` (`C:\Nik\clinqetinfrastructure\Services\Tenancy\ResourceScopeEvaluator.cs:17-46`);
   list narrowing is `WorkListNarrowing` (`C:\Nik\clinqetcore\Services\Tenancy\WorkListNarrowing.cs:43-87`)
   pushed into the Cosmos `WHERE` **and** `COUNT` (`ARRAY_CONTAINS(c.assignedMembershipIds, @scopeMembership)`).
5. Member-scoped data exists **only** where an `assignedMembershipIds` array exists: Booking, Quote, Invoice,
   BroadcastProvider (lead), Conversation (`C:\Nik\clinqetcore\Entities\COSMOS\ProviderOwnedEntity.cs:51-68`;
   class headers Cosmos.cs:1603, 2083, 2668, 2864, **3263**). Customers are **derived** from those. Everything
   else (availability, knowledge, insights, billing, voice, catalogue, team roster, activity) is
   **all-or-nothing at Business scope**.
6. Technician and Contractor hold `booking.read`, `quote.read`, `conversation.read`, `customer.read`
   (+ Technician `invoice.read`) at **`Assigned`** only (catalogue 245-253, 289-295); they hold **no**
   `lead.read`, `insights.read`, `payment.*`, `billing.*`, `team.read`, `voice.*`, `ai.assistant.use`.
7. "Who did what" is recorded as `createdByMembershipId`/`updatedByMembershipId` on every business-owned
   document (`ProviderOwnedEntity.cs:20-46`, stamped by `CosmosDbRepository.cs:133-168`) — **not indexed** in
   any container (`C:\Nik\clinqetcore\Cosmos\Setup\CosmosContainerPolicies.cs`: no such IncludedPath), so
   "quotes Gaurav created" is an in-partition scan today.
8. Members with display names: `GET /api/v1/business/members` (`team.read`, Business) →
   `MemberLifecycleService.ListMembersAsync` (`C:\Nik\clinqetinfrastructure\Services\Tenancy\MemberLifecycleService.cs:61-137`)
   → `BusinessMemberDto.DisplayName/MembershipId/UserNumber`. No server-side name search exists (NOT FOUND).
9. The voice/MCP host knows **BusinessId only** — `CallContext`
   (`C:\Nik\clinqetmcp\Clinqet.Mcp\Context\CallContext.cs:5-18`) has no MembershipId or permissions; the
   in-app chat mints the same Partner-scope per-call token from `businessId` alone
   (`C:\Nik\clinqetapi\Clinqet.API\Services\McpToolGateway.cs:48-57`). Functions host has zero `TenantContext`
   usage (grep: no matches).
10. Knowledge is gated on **`voice.read`** (list) / **`voice.settings.manage`** (every write)
    (`C:\Nik\clinqetapi\Clinqet.API\Controllers\Knowledge\KnowledgeController.cs:26-28, 79, 142…807`) —
    owner/admin/ops-manager/dispatcher can read; **only owner/admin can upload or delete**. **No per-document
    ACL/visibility exists** (NOT FOUND in entity, DTOs, search document, services). Nearest pattern:
    `KnowledgeDocument.ShareWithCallers` (a per-document audience boolean read live at search time).
11. Frontends gate UI from `GET /business/access` (`BusinessAccessSummaryDto`, permission→scope map) through
    `useBusiness().can(key)` + `SurfaceGate`/`CapabilityGate` on both web and mobile; **a 403 never signs
    anyone out** on either client (web `apiClient.js:63-77`; mobile `apiManager.tsx:83-121, 229-232`) — the
    memory "mobile 403=logout" is historical.
12. ‼️ **CLOSED THIS SESSION (was the file's one open item): provider-side reads on the messaging thread
    endpoints are NOT scope-checked and NOT permission-checked.** `ConversationController` and
    `MessageController` carry only `[Authorize]`; their sole identity step resolves to the caller's
    **BusinessId**, so a technician or contractor whose `conversation.read` is `Assigned` can read and act on
    **every** thread in the business. Full proof in **§11.6**.

---

## 1. The documented contract (SKILL.md, read end-to-end: 4,802 lines)

Source: `C:\Nik\.claude\skills\clinqet-provider-teams\SKILL.md`. Key sections and what they bind:

| Section | Lines | Contract |
|---|---|---|
| Absolute rules | 8-25 | BusinessId only from the signed token; no cross-partition; deny by default; `business.transfer_ownership` never grantable to Administrator, `payout.manage_account` owner-only |
| Identifiers | 76-113 | UserNumber 5 chars = person; BusinessId 6 chars = tenant; MembershipId GUID = relationship |
| Token contract | 191-206 | Claims `BusinessId, MembershipId, AuthorizationVersion, BusinessRoles (UI only), BusinessAccess`; permission set/scopes NEVER in the token |
| Authorization pipeline | 407-550 | `UseAuthentication → UseTenantContext → UseAuthorization`; snapshot cache key/TTL; `[RequiresPermission]` as MVC filter; 7 sensitive operations; resource scope at per-record endpoints; `minimumScope` policy (531-535); `GET /business/access` (544-548) |
| Permissions/roles/scopes | 552-606 | catalogue is code; scopes ordered narrow→broad, broadest wins (L27); 10 role keys; Technician/Contractor = `Assigned` only. **Says "89 permissions, CatalogVersion = 1" (556-557) — stale, see §13.1** |
| Tenant isolation holes closed | 1123-1212 | provider inbox keyed on BusinessId; body-asserted BusinessId deleted; voice-live group; **39-case cross-tenant matrix (1194-1197) — two of its named cases have no test, see §11.6** |
| Host capability matrix | 1476-1503 | Main API = SQL + `AddTenancyAuthorization`; Functions = SQL, no authorization; **MCP = NO SQL**, System actor |
| Cut/closed items | 1506-1530 | **Per-member calendars OUT OF SCOPE (L30, line 1515)**; custom roles/deny rules deferred |
| Phase 11 Part 2 corrections | 1959-2050 | 224 endpoints/31 controllers at that date; orphan permission registry (2027-2036) |
| Phase 11 Part 3 | 2053-2155 | shared customer+provider endpoints are gated **in-action** (`EnforceResourceScope` / `EnforceBusinessPermission`), never with the attribute; `booking.delete` added |
| Phase 11 Part 4 | 2158-2266 | **"the catalogue grants exactly TWO scopes: Business and Assigned"** (2167, re-read and still present) |
| Team Bug Fix Phase 3 | 3873-3999 | `SURFACE_PERMISSIONS` — 14/15 rail surfaces → permission; gate is "held at ANY scope" (3892-3895) |
| Team Bug Fix Phase 4 | 4002-4260 | `WorkListNarrowing`; six list endpoints moved to default scope (4019); TD-7 derived customers (4036-4041); assignment controllers (4043-4081); `quote.assign`/`invoice.assign` (**"92 keys, CatalogVersion 2"** at 4018 — stale) |
| Solo addendum | 4548-4594 | `soloBusiness(access)`; `GET /business/access` carries `MemberCount`/`PendingInvitationCount` |
| Grant-change playbook | 4713-4743 | edit catalogue **and bump `CatalogVersion`** (cache epoch) |

Skill facts re-measured this session and found **stale**: permission count (skill says 89/90/92 at three
dates → code is **94**), `CatalogVersion` (skill last says 2 → code is **4**), attribute-site count (skill
says 224/31 → grep 2026-09-02: **266 `[RequiresPermission(` lines across 37 controller files**).

---

## 2. Code verification — the authorization model

### 2.1 Permission-key catalogue (ALL 94 keys, grouped by `Module`)

File: `C:\Nik\clinqetinfrastructure\Data\SQL\TenancyRoleCatalogDefinition.cs`, `Permissions` array lines
**49-178**. `IsSensitive` (3rd arg) is a catalogue display flag, **distinct from** the live-recheck list in
§2.7 — the two new `invoice.payment_methods.*` keys prove it: both are `IsSensitive: true` and neither is in
`SensitiveOperations`.

| Module | Keys (line) |
|---|---|
| BusinessProfile | `business.profile.read` (51) · `business.profile.update` (52) · `business.publicpage.manage` (53) · `business.friendlyname.manage` (54) · `business.lifecycle.manage` (57, sensitive) |
| CatalogService | `catalog.service.read` (59) · `.create` (60) · `.update` (61) · `.delete` (62) |
| CatalogCategory | `catalog.category.read` (64) · `.create` (65) · `.update` (66) · `.delete` (67) |
| CatalogOffer | `catalog.offer.read` (69) · `.create` (70) · `.update` (71) · `.delete` (72) |
| ServiceArea | `servicearea.read` (74) · `servicearea.manage` (75) |
| Availability | `availability.read` (77) · `availability.manage` (78) |
| Portfolio | `portfolio.read` (80) · `portfolio.manage` (81) |
| License | `license.read` (83) · `license.manage` (84) |
| Lead | `lead.read` (86) · `lead.bid` (87) · `lead.bid_withdraw` (88) · `lead.assign` (89) · `lead.hide` (90) |
| Quote | `quote.read` (92) · `quote.create` (93) · `quote.update` (94) · `quote.send` (95) · `quote.assign` (98) · `quote.approve_discount` (99, s) |
| Booking | `booking.read` (101) · `booking.create` (102) · `booking.accept` (103) · `booking.assign` (104) · `booking.update` (105) · `booking.cancel` (106) · `booking.complete` (107) · `booking.delete` (109) |
| Invoice (**8 keys now**) | `invoice.read` (111) · `invoice.create` (112) · `invoice.send` (113) · `invoice.assign` (114) · `invoice.adjust` (115, s) · `invoice.delete` (116, s) · ‼️ **`invoice.payment_methods.read` (119, s)** · ‼️ **`invoice.payment_methods.manage` (120, s)** |
| Conversation | `conversation.read` (122) · `conversation.reply` (123) · `conversation.assign` (124) · `conversation.view_all` (125, s) |
| Customer | `customer.read` (127, s) · `customer.create` (128) · `customer.update` (129) · `customer.delete` (130, s) |
| Review | `review.read` (132) · `review.reply` (133) · `review.report` (134) |
| Payment | `payment.read` (136, s) · `payment.refund_approve` (137, s) · `payment.dispute_respond` (138, s) · `payment.record_offline` (141, s) |
| Payout | `payout.read` (143, s) · `payout.export` (144, s) · `payout.manage_account` (145, s) |
| Billing | `billing.read` (146, s) · `billing.manage` (147, s) |
| Voice | `voice.read` (149) · `voice.settings.manage` (150) · `voice.livecall.join` (151) · `voice.transcript.read` (152, s) · `voice.number.manage` (153, s) |
| Ai | `ai.assistant.use` (155) · `ai.document_intelligence.use` (156) |
| Insights | `insights.read` (158) · `analytics.read` (159) |
| Media | `media.upload` (161) · `media.delete` (162) |
| Team | `team.read` (164) · `team.invite` (165, s) · `team.remove` (166, s) · `team.suspend` (167, s) · `team.assign_role` (168, s) · `team.manage_teams` (169) · `team.manage_locations` (170) |
| NotificationPolicy | `notification_policy.read` (172) · `notification_policy.manage` (173) |
| Audit | `audit.read` (175, s) |
| Ownership | `business.transfer_ownership` (177, s) |

Totals: 5+4+4+4+2+2+2+2+5+6+8+**8**+4+4+3+4+3+2+5+2+2+2+7+2+1+1 = **94**
(machine check: `sed -n '49,178p' … | grep -cE '^\s+new\('` → **94**).

The two new keys carry the in-file rationale at 117-118: *"D-PERM: deliberately NOT billing.* — direct
invoice instructions must stay independent of online-billing access and of the partner app's
billingUiEnabled gate."*

**No `knowledge.*` key exists** (knowledge reuses `voice.*`, `KnowledgeController.cs:26-28`).

Orphan keys (no endpoint consumer), pinned by
`C:\Nik\clinqetapi\Clinqet.API.UnitTests\Conventions\OrphanPermissionRegistryTests.cs:42-92` — still exactly
these **9**: `business.friendlyname.manage` (44), `lead.hide` (53), `quote.approve_discount` (57),
`conversation.view_all` (62), `review.report` (67), `payout.export` (73), `voice.number.manage` (77),
`analytics.read` (83), `media.delete` (88). The two new keys are **not** orphans: five endpoints carry them
(`ProviderBillingController.cs:1143, 1169, 1201, 1235, 1270`), and the mapping is pinned by
`Clinqet.API.UnitTests\Controllers\ProviderBillingInvoicePaymentMethodTests.cs:405-409, 444-445, 459-460`.

Localization keys per permission/role: `PermissionNameKey` / `RoleNameKey`
(`TenancyRoleCatalogDefinition.cs:39-45`) → `Permission_{key_with_underscores}_Name`,
`BusinessRole_{roleKey}_Name`. The new keys' four strings exist at
`clinqetinfrastructure\Resources\Localization\en.json:3269-3272`.

### 2.2 The 10 system roles and their grants (`TenancyRoleCatalogDefinition.cs:184-303`)

`Business(...)` = every listed key at `PermissionScope.Business`; `Assigned(...)` = at
`PermissionScope.Assigned` (helpers 307-311). `Merge` concatenates (313-315). Runtime lookup:
`GrantsByRoleKey` (321-322); effective set for a membership = union with **broadest scope winning**
(`AuthorizationSnapshotProvider.ResolvePermissions`,
`C:\Nik\clinqetinfrastructure\Services\Tenancy\AuthorizationSnapshotProvider.cs:202-219`).

| Role key (DisplayOrder) | Grants |
|---|---|
| `primary_owner` (1) | every key at Business (184-186, 196) — **now 94 keys** |
| `administrator` (2) | everything **except** `business.transfer_ownership` and `payout.manage_account` (190-192, 197) — **now 92 keys**; ‼️ it DOES receive both new `invoice.payment_methods.*` keys, because the template is derived (`everything.Where(...)`), not hand-listed |
| `operations_manager` (3) | Business: business.profile.read · catalog.service/category/offer.read · servicearea.read · availability.read/manage · portfolio.read · license.read · lead.read/bid/bid_withdraw/assign/hide · quote.read/create/update/send/assign · booking.read/create/accept/assign/update/cancel/complete/delete · invoice.read/create/send/assign · payment.record_offline · conversation.read/reply/assign · customer.read/create/update · review.read/reply/report · voice.read/livecall.join/transcript.read · ai.assistant.use · insights.read · analytics.read · media.upload · team.read (199-215) — **unchanged** |
| `sales_representative` (4) | Business: business.profile.read · catalog.service/offer.read · servicearea.read · availability.read · portfolio.read · lead.read/bid/bid_withdraw/hide · quote.read/create/update/send · booking.read/create · conversation.read/reply · customer.read/create/update · review.read · ai.assistant.use · insights.read · media.upload (217-228) — **unchanged** |
| `dispatcher` (5) | Business: business.profile.read · catalog.service.read · servicearea.read · availability.read/manage · lead.read/assign/hide · quote.read/assign · booking.read/create/accept/assign/update/cancel/complete · conversation.read/reply/assign · customer.read · voice.read/livecall.join · ai.assistant.use · team.read (230-241) — **unchanged** |
| `technician` (6) | Business: business.profile.read · catalog.service.read · servicearea.read · availability.read · media.upload; **Assigned**: booking.read/update/complete · conversation.read/reply · customer.read · quote.read · invoice.read (245-253) — **unchanged** |
| `catalog_manager` (7) | Business: business.profile.read/update · business.publicpage.manage · catalog.service.* · catalog.category.* · catalog.offer.* · servicearea.read/manage · availability.read · portfolio.read/manage · license.read/manage · review.read · ai.assistant.use · ai.document_intelligence.use · media.upload/delete (258-269) — **unchanged** |
| `finance` (8) | Business: business.profile.read · catalog.service.read · servicearea.read · booking.read · quote.read · invoice.read/create/send/assign/adjust/delete · ‼️ **invoice.payment_methods.read/manage (280)** · payment.read/refund_approve/dispute_respond/record_offline · payout.read/export · billing.read/manage · customer.read · insights.read · analytics.read · audit.read (273-285) — ‼️ **THE ONLY ROLE WHOSE GRANT LIST CHANGED** |
| `contractor` (9) | Business: same 5 as technician; **Assigned**: booking.read/update/complete · conversation.read/reply · customer.read · quote.read (289-295) — **no invoice.read**; **unchanged** |
| `read_only_auditor` (10) | Business: business.profile.read · catalog.service/category/offer.read · servicearea.read · availability.read · portfolio.read · license.read · lead.read · quote.read · booking.read · invoice.read · customer.read · review.read · insights.read · analytics.read · audit.read · team.read (297-303) — **unchanged** |

Derived facts the planner needs (read off the grants above):
- **Money readers** (`invoice.read` at Business): owner, admin, ops_manager, finance, read_only_auditor.
  Technician: `invoice.read` **Assigned**. Contractor, sales_rep, dispatcher, catalog_manager: **none**.
- ‼️ **NEW — invoice payment-method readers/managers** (`invoice.payment_methods.read|manage`): owner, admin,
  **finance** only. Nobody else, at any scope.
- `payment.read` / `billing.read` / `payout.read`: owner, admin, finance only.
- `insights.read` (dashboard statistics + Smart Analytics): owner, admin, ops_manager, sales_rep, finance,
  read_only_auditor.
- `lead.read`: owner, admin, ops_manager, sales_rep, dispatcher, read_only_auditor — always Business scope
  (no `Assigned` grant anywhere).
- `team.read` (member roster): owner, admin, ops_manager, dispatcher, read_only_auditor.
- `voice.read` (knowledge list, call summaries): owner, admin, ops_manager, dispatcher.
  `voice.settings.manage` (knowledge writes): **owner + admin only**.
- `ai.assistant.use`: owner, admin, ops_manager, sales_rep, dispatcher, catalog_manager — **not** technician,
  contractor, finance, read_only_auditor.
- `availability.read`: every role; `availability.manage`: owner, admin, ops_manager, dispatcher.
- `catalog.service.read`: every role (TD-37.3).

Owner-only invariants enforced by
`C:\Nik\clinqetapi\Clinqet.API.UnitTests\Conventions\OwnerOnlyPermissionTests.cs:32, 52, 63, 86` — including
`TheAdministratorTemplate_IsTheOwnersMinusExactlyTheTwoOwnerOnlyKeys` (63), which is why the derived
administrator template needed no edit for the two new keys.

### 2.3 Resource-scope enum — 7 values and exact semantics

Enum: `C:\Nik\clinqetshared\Enums\PermissionScope.cs:8-17` — `None, CreatedByMe, Participating, Assigned,
Branch, Team, Business` ("Ordered widest-to-narrowest… L27 resolves two roles granting one permission to the
BROADER scope" — comment 5-6; numeric order is narrow→broad so `scope > existing` = broader,
`AuthorizationSnapshotProvider.cs:213`).

Semantics = `ResourceScopeEvaluator.Evaluate(TenantContext, permissionKey, in ScopedResource)`
(`C:\Nik\clinqetinfrastructure\Services\Tenancy\ResourceScopeEvaluator.cs`):

| Scope | Decision rule | Lines |
|---|---|---|
| (any) first | `context.ScopeFor(key) == None` → `DeniedOutOfScope` (permission not held) | 21-23 |
| (any) second | `resource.BusinessId != context.BusinessId` → `DeniedWrongBusiness` (logged Warning) | 26-32 |
| `Business` | `Allowed` | 36 |
| `Team` | caller has ≥1 TeamId AND `resource.AssignedTeamIds` intersects `context.TeamIds`; else denied | 48-56 |
| `Branch` | `resource.BranchId` null/empty → **Allowed** (whole-business work); else allowed iff `context.BranchIds` contains it | 58-68 |
| `Assigned` | `resource.SupportsAssignment` must be true (else `DeniedUnsupportedScope`, logged Error); `resource.AssignedMembershipIds` must contain `context.MembershipId`; null/empty → denied | 70-85 |
| `Participating` | `resource.SupportsParticipation` must be true; `resource.ParticipantMembershipIds` contains `context.MembershipId` | 87-102 |
| `CreatedByMe` | `resource.CreatedByMembershipId == context.MembershipId`; null → denied | 104-110 |
| `None` (as effective scope) | unreachable past line 23; `TenantContext.Satisfies` returns false for None (`TenantContext.cs:36-37`) | — |

`ScopedResource` record (`C:\Nik\clinqetshared\Models\ScopedResource.cs:8-17`): BusinessId,
AssignedMembershipIds, AssignedTeamIds, BranchId, CreatedByMembershipId, ParticipantMembershipIds,
SupportsAssignment, SupportsBranch, SupportsParticipation. `ScopeDecision` (19-25): Allowed,
DeniedWrongBusiness, DeniedOutOfScope, DeniedUnsupportedScope. `ScopeEvaluation` (27-30) exposes `Allowed`.

`ToScopedResource(...)` — the ONE mapping from entities
(`C:\Nik\clinqetcore\Entities\COSMOS\ScopedResourceExtensions.cs`): Booking 14-21, Quote 23-30, Invoice
32-39, BroadcastProvider 41-48 (all `SupportsAssignment: true, SupportsBranch: true`); Conversation 54-62
(watchers ride ParticipantMembershipIds but `SupportsParticipation` stays false, comment 50-53);
BusinessCustomer 67-75 (assigned set passed in by caller); Review 79-84, Service 86-91 (no assignment);
ServiceArea 93-100 (branch only).

**Granted today**: only `Business` and `Assigned` (catalogue helpers `TenancyRoleCatalogDefinition.cs:307-311`;
no `Team`/`Branch`/`CreatedByMe`/`Participating` helper exists). Build guard:
`C:\Nik\clinqetapi\Clinqet.API.UnitTests\Conventions\WorkListNarrowingContractTests.cs:31`
`NoRoleGrantsAWorkListPermissionAtAnUnpushableScope`.

Second, orthogonal axis — `BusinessAccessScope` (`C:\Nik\clinqetshared\Enums\BusinessAccessScope.cs:8-12`):
`Full` | `BillingOnly` (suspended business admits only its primary owner, to billing surfaces;
`BusinessAccessPolicy.Classify`, `C:\Nik\clinqetshared\Utilities\BusinessAccessPolicy.cs:19-45`).

### 2.4 `TenantContext` — exactly what it carries

`C:\Nik\clinqetshared\Models\TenantContext.cs:7-19` (sealed record):

| Member | Meaning | Source |
|---|---|---|
| `UserId` | ASP.NET Identity PK of the person | snapshot (`AuthorizationSnapshot.UserId`) |
| `UserNumber` (nullable) | the person's 5-char number | `UserNumber` claim, `TenantContextMiddleware.cs:74` |
| `BusinessId` | active tenant (6 chars) | snapshot |
| `MembershipId` | acting relationship (GUID) | snapshot |
| `AuthorizationVersion` | int, bumped on any access change | snapshot |
| `AccessScope` | `Full`/`BillingOnly` | `BusinessAccessPolicy.Classify` result |
| `RelationshipType` | `Owner, Employee, Contractor, Partner, Guest` (`C:\Nik\clinqetshared\Enums\MembershipRelationshipType.cs:6-13`) | snapshot |
| `IsPrimaryOwner` | `Business.PrimaryOwnerMembershipId == MembershipId` (`AuthorizationSnapshotProvider.cs:193`) | snapshot |
| `RoleKeys` | ordered role keys | snapshot 179-183 |
| `Permissions` | `IReadOnlyDictionary<string, PermissionScope>` — the effective key→scope map | `ResolvePermissions` 202-219 |
| `TeamIds` | `BusinessTeamMember` rows for the membership | 165-168 |
| `BranchIds` | active `BusinessMembershipBranch` rows | 169-172 |

Methods: `ScopeFor(key)` → scope or `None` (21-22); `Has(key, minimumScope = None)` (26-27); static
`Satisfies(permissions, key, minimumScope)` = `scope != None && scope >= minimumScope` (31-38) — "ONE rule,
two callers" (cached context + live snapshot).

**Seat state is NOT on `TenantContext`** (NOT FOUND in the record). Seats are read live via
`IBusinessSeatService.EvaluateAsync` → `BusinessSeatStateDto`
(`C:\Nik\clinqetapi\Clinqet.API\Controllers\Tenancy\BusinessMemberController.cs:91-111`). Roster counts
(`MemberCount`, `PendingInvitationCount`) are likewise live on `GET /business/access` only, from
`IBusinessMemberDirectory.CountRosterAsync` (`BusinessAccessController.cs:45-47, 63-64`), not in the snapshot.

Access paths: `HttpContext.Items["Clinqet.TenantContext"]`
(`C:\Nik\clinqetinfrastructure\Services\Tenancy\TenantContextAccessor.cs:9`), `ITenantContextAccessor.Current`
/ `.Require()` (23-29; interface `C:\Nik\clinqetcore\Interfaces\Tenancy\ITenantContextAccessor.cs:7-12`),
`BaseController.Tenant` (`C:\Nik\clinqetapi\Clinqet.API\Controllers\Base\BaseController.cs:227-230`),
`GetCurrentBusinessId()` (232), `GetCurrentMembershipId()` (234), `GetCurrentUserNumber()` (239-248),
`GetUserId()` (195).

### 2.5 `[RequiresPermission]` and the enforcing filter

`C:\Nik\clinqetapi\Clinqet.API\Authorization\RequiresPermissionAttribute.cs`:
- `sealed class RequiresPermissionAttribute : Attribute, IAsyncAuthorizationFilter, IProviderEndpointMarker`
  (20); usable on class **or** method (19); ctor `(string permission, PermissionScope minimumScope = None)`
  (29-33); `RequiresLiveAuthorization { get; init; }` (42).
- Order of checks in `OnAuthorizationAsync` (44-149):
  1. no `TenantContext` → `NoContext` (56-60, 151-169): 403 `business_context_required`, or the recorded
     middleware failure code — **401** for `business_context_stale`, 403 otherwise.
  2. asserted BusinessId in route (`businessId`/`businessid`), header `X-Business-Id`, or query `businessId`
     ≠ token → 403 `business_context_mismatch`; malformed (>64 chars or non `[A-Za-z0-9_-]`) → 400
     `business_context_invalid` (62-86, 178-214).
  3. `AccessScope == BillingOnly` and no `[AllowedWhenBillingOnly]` in **`ActionDescriptor.EndpointMetadata`**
     (88-89, i.e. a **class**-level attribute counts) → 403 `billing_only_access` (92-98).
  4. `!tenant.Has(Permission, MinimumScope)` → 403 `permission_denied` (100-106).
  5. if `RequiresLiveAuthorization`: `IAuthorizationSnapshotProvider.GetLiveAsync` → re-test grant /
     BillingOnly / `TenantContext.Satisfies` (108-148).
- `[AllowedWhenBillingOnly]` (218-221). Error codes:
  `C:\Nik\clinqetshared\Constants\TenancyErrorCodes.cs:7, 10, 13, 15, 17, 19, 22, 25` —
  `business_context_required`, `business_context_mismatch`, `business_context_stale`,
  `business_context_invalid`, `permission_denied`, `resource_out_of_scope`, `billing_only_access`,
  `self_dealing_blocked` (+ `work_assignment_conflict` later in the file).

Middleware order (`C:\Nik\clinqetapi\Clinqet.API\Program.cs`): `UseAuthentication()` **1592** →
`UseTenantContext()` **1596** → `UseAuthorization()` **1598** → `ConsentEnforcementMiddleware` **1602**.
DI: `AddTenancyServices` **711**, `AddTenancyAuthorization` **718** (registers `TenancyMetrics` +
`IAuthorizationCacheSignal` singletons, `ITenantContextAccessor`, `IAuthorizationSnapshotProvider`,
`IResourceScopeEvaluator`, `IActorAttributionAccessor` scoped —
`C:\Nik\clinqetinfrastructure\Configuration\TenancyServiceRegistration.cs:49-64`).

`TenantContextMiddleware` (`C:\Nik\clinqetapi\Clinqet.API\Middleware\TenantContextMiddleware.cs`): returns
early for unauthenticated or no `BusinessId` claim (34-45); missing `MembershipId`/`AuthorizationVersion` →
recorded failure `business_context_invalid` (47-60); `snapshotProvider.GetAsync(membershipId, businessId,
version)` (62); denial recorded at `Items["Clinqet.TenantContextFailure"]`, never thrown (64-68, 89-90);
success writes `TenantContext` (71-84).

Coverage: **266** `[RequiresPermission(` sites in **37** controller files (grep 2026-09-02,
`C:\Nik\clinqetapi\Clinqet.API\Controllers`). Shared customer+provider endpoints (BookingController
create/read-by-number/update/delete, QuoteController by-number, ConversationController, MessageController)
carry NO attribute by design; the booking/quote ones gate the provider branch in-action
(`BookingController.cs:449, 510, 963, 2009, 2160`), the **messaging ones gate nothing at all — §11.6**.

### 2.6 The snapshot cache

`C:\Nik\clinqetinfrastructure\Services\Tenancy\AuthorizationSnapshotProvider.cs`:
- Key: `authz:snapshot:c{CatalogVersion}:{membershipId}:v{authorizationVersion}` (44-45) — the catalogue
  version is the **epoch** (comment 41-43). ‼️ The bump to `4` therefore invalidated every cached snapshot on
  deploy, which is exactly what makes the new `finance` grant live immediately.
- Hit path: `TryGetValue` + businessId equality (57-66). Miss: `ResolveAsync` — ONE EF projection over
  `BusinessMemberships` joining business status, primary owner, active roles, team ids, active branch ids
  (145-198); Users deliberately not joined (143-144).
- Token version ≠ SQL version → `Deny(business_context_stale)`, **nothing cached** (79-90).
- Only a **grant** is cached (94-105): `MemoryCacheEntryOptions { Size = 1,
  AbsoluteExpirationRelativeToNow = Tenancy:Authorization:SnapshotCacheSeconds }` +
  `AddExpirationToken(_signal.GetToken(membershipId))` (98-103). Default 60 s:
  `C:\Nik\clinqetshared\Models\TenancySettings.cs:153`.
- Invalidation: `Evict(membershipId)` → `IAuthorizationCacheSignal.Invalidate` (122-126);
  `AuthorizationCacheSignal` = per-membership `CancellationTokenSource` (`AuthorizationCacheSignal.cs:16-45`).
  Carriers: `AccessChangeApplier` (Functions host, `AccessChangeApplier.cs:27-46`, evicts only — never
  `IAuthorizationSnapshotProvider`), business closure (SKILL 2775-2781).
- `GetLiveAsync` bypasses the cache (110-119). `Classify` → `BusinessAccessPolicy` (131-141).

### 2.7 Live-SQL re-check — the 7 sensitive operations

`C:\Nik\clinqetshared\Constants\SensitiveOperations.cs:10-19` — **still exactly 7**:
`business.lifecycle.manage` · `business.transfer_ownership` · `payment.refund_approve` · `payout.export` ·
`payout.manage_account` · `team.assign_role` · `voice.number.manage`.

Endpoints carrying `RequiresLiveAuthorization = true` (grep 2026-09-02) — **12 sites, unchanged in count**:
`BusinessProfileController.cs:1077, 1107` and `Tenancy\BusinessClosureController.cs:44, 71`
(`business.lifecycle.manage`); `ProviderBillingController.cs:587, 617, 654` (`payout.manage_account`);
`ProviderBookingPaymentController.cs:99` (`payment.refund_approve`);
`Tenancy\BusinessMemberController.cs:165` (`team.assign_role`), `199, 250, 265`
(`business.transfer_ownership`). `payout.export` and `voice.number.manage` have **no endpoint**
(`OrphanPermissionRegistryTests.cs:73, 77`). Invariants:
`ProviderEndpointAuthorizationTests.cs:153 EverySensitiveOperation_ReVerifiesAgainstLiveSql`,
`166 NoOrdinaryOperation_PaysForALiveReCheck`, `329 EverySensitiveOperationKey_ExistsInTheCatalogue`.

‼️ **The two new `invoice.payment_methods.*` keys are `IsSensitive: true` in the catalogue but are NOT on the
`SensitiveOperations` list**, so their five endpoints run off the 60 s cached snapshot like any ordinary
operation. That is consistent (`IsSensitive` is a display flag; §2.1) but it is a real 60 s revocation window
on the surface that decides where an invoice tells a customer to send money.

### 2.8 How a SERVICE (not a controller) checks permission + scope in code — the existing seams

All are registered by `AddTenancyAuthorization` (`TenancyServiceRegistration.cs:49-64`) in the Main API host
only (Functions/MCP have none — §6).

1. **Who is acting / what they hold**: inject `ITenantContextAccessor`
   (`C:\Nik\clinqetcore\Interfaces\Tenancy\ITenantContextAccessor.cs:7-12`); `var tenant = accessor.Require();`
   (`TenantContextAccessor.cs:28-29`) then `tenant.Has("invoice.read", PermissionScope.Business)` or
   `tenant.ScopeFor("booking.read")` (`TenantContext.cs:21-27`). Existing service consumer:
   `ProviderInboxService` takes `TenantContext tenant` as a **parameter** and reads
   `tenant.ScopeFor(ConversationReadPermission)`
   (`C:\Nik\clinqetinfrastructure\Services\Tenancy\ProviderInboxService.cs:24, 187-198`).
2. **Per-record decision**: inject `IResourceScopeEvaluator`
   (`C:\Nik\clinqetcore\Interfaces\Tenancy\IResourceScopeEvaluator.cs:7-10`);
   `_scopeEvaluator.Evaluate(tenant, "conversation.read", conversation.ToScopedResource(businessId)).Allowed`
   (`ProviderInboxService.cs:179-182`, and again at 311-312 over the keyset projection and 605-606). The
   evaluator already denies an ungranted key on its first branch (`ResourceScopeEvaluator.cs:21-23`), so one
   call = permission + tenant assertion + narrowing.
3. **List narrowing**: `WorkListNarrowing.For(tenant, key)` (`WorkListNarrowing.cs:43-58`) →
   `None | AssignedToMembership | AssignedToTeams | MatchesNothing | Unsupported`; pass into the repository
   overloads that take `WorkListNarrowing narrowing`:
   `IBookingRepository.GetPaginatedBookingsAsync` (`IBookingRepository.cs:35`; impl `BookingRepository.cs:192`),
   `IBookingRepository.GetAssignedCustomerIdsAsync` (`IBookingRepository.cs:40`; impl 485),
   `IQuoteRepository.GetPaginatedQuotesAsync` (`IQuoteRepository.cs:18`; impl `QuoteRepository.cs:95`),
   `IInvoiceRepository.GetPaginatedInvoicesAsync` (`IInvoiceRepository.cs:19`; impl `InvoiceRepository.cs:79`),
   `GetInvoiceSummaryAsync` (`IInvoiceRepository.cs:21`; impl 214), `GetOverdueInvoiceSummaryAsync`
   (`IInvoiceRepository.cs:23`; impl 241), `GetPaidInvoicesInRangeAsync` (`IInvoiceRepository.cs:33`; impl 331),
   `IInvoiceService.GetPaginatedAsync/GetSummaryAsync/GetEarningsGraphAsync`
   (`IInvoiceService.cs:51, 54, 58`; impl `InvoiceService.cs:342, 348, 583`).
   `CosmosDbRepository.ApplyNarrowing` appends the predicate to WHERE **and COUNT**
   (`C:\Nik\clinqetinfrastructure\Data\COSMOS\Base\CosmosDbRepository.cs:62-71`). Predicates:
   `ARRAY_CONTAINS(c.assignedMembershipIds, @scopeMembership)` /
   `EXISTS(SELECT VALUE t FROM t IN c.assignedTeamIds WHERE t IN (...))` (`WorkListNarrowing.cs:63-87`).
   `MatchesNothing` → empty result without a query (`BookingRepository.cs:203-204`); `Unsupported` → refuse
   403 `resource_out_of_scope` (`BaseController.WorkListOutOfScope` 349-362).
4. **Evaluator pass over returned rows** (the query narrows, the evaluator decides): controllers use
   `BaseController.KeepInScope` (370-395) + `ReplaceItems` (401-407). These helpers live on `BaseController`;
   a service replicates them by iterating `IResourceScopeEvaluator.Evaluate(...).Allowed`.
5. **Business-level permission for a create (no document yet)**: `tenant.Has(key, PermissionScope.Business)`
   — the controller form is `EnforceBusinessPermission<T>` (`BaseController.cs:312-327`), refusing with
   `permission_denied`.
6. **Only narrow when needed**: `RequiresResourceNarrowing(key)` = `tenant.ScopeFor(key) != Business`
   (`BaseController.cs:334-335`) — a Business-scoped member never pays the extra read.
   `NarrowWorkList(key)` is the controller shorthand for `WorkListNarrowing.For(Tenant, key)` (343).
7. **Live re-check**: `IAuthorizationSnapshotProvider.GetLiveAsync(membershipId, businessId)` then
   `TenantContext.Satisfies(live.Snapshot.Permissions, key, minScope)`
   (`RequiresPermissionAttribute.cs:113-146`).
8. **Outside HTTP (SignalR)**: `NotificationHub.ResolveVoiceWatchBusinessIdAsync` reads the claims itself and
   calls `_snapshotProvider.GetAsync(membershipId, businessId, tokenVersion)` then
   `Snapshot.Permissions.GetValueOrDefault(key) != None`
   (`C:\Nik\clinqetapi\Clinqet.API\Hubs\NotificationHub.cs:219, 301-338`).
9. **Attribution of writes**: `IActorAttributionAccessor.Current` → `ActorAttribution(UserId, MembershipId,
   BusinessActorType.Member|PlatformAdmin|Customer|None, DisplayName)`
   (`C:\Nik\clinqetinfrastructure\Services\Tenancy\ActorAttributionAccessor.cs:22-56`), stamped automatically
   by `CosmosDbRepository` on `ProviderOwnedEntity` writes (`StampCreatedBy` 133-147, `StampUpdatedBy`
   152-168 — createdBy* is carried forward from the STORED document, never rewritten).
10. **Self-dealing**: `BaseController.IsSelfDealing(subjectCustomerUserNumber)` compares `Tenant.UserNumber`
    (431-437).

---

## 3. Business-context token: claims, parsing, per-request resolution

Claim names (frozen): `C:\Nik\clinqetshared\Constants\BusinessContextClaimTypes.cs:8-18` — `BusinessId` (8),
`MembershipId` (10), `AuthorizationVersion` (12), `BusinessRoles` (14, comma-joined via `RoleSeparator` 18;
"UI affordances ONLY — never authorization", comment 3-5), `BusinessAccess` (16).

Stamped in `C:\Nik\clinqetinfrastructure\Services\Auth\AuthService.cs:2986-2996` (inside JWT generation) from
`BusinessTokenContext` (`C:\Nik\clinqetshared\Models\BusinessTokenContext.cs:8-13`): `BusinessId` (2986),
`MembershipId` (2987), `AuthorizationVersion.ToString(InvariantCulture)` (2988), `AccessScope.ToString()`
(2990, `"Full"`/`"BillingOnly"`), `BusinessRoles` only when roles exist (2993). Example values pinned by
tests: `BusinessContextIntegrationTests.cs:145-147`
(`C:\Nik\clinqetidentity\Clinqet.Identity.IntegrationTests\Tests\`) — `BusinessId == session.ActiveBusinessId`,
`BusinessAccess == "Full"`, `BusinessRoles == "primary_owner"`; `AuthServiceBusinessContextTests.cs:519-523`
(`C:\Nik\clinqetidentity\Clinqet.Identity.UnitTests\Services\`) — `MembershipId == membership.MembershipId`
(GUID string), `AuthorizationVersion == "7"`, `BusinessRoles == "primary_owner,finance"`.

Exchange endpoints (Identity host,
`C:\Nik\clinqetidentity\Clinqet.Identity.API\Controllers\BusinessContextController.cs`):
`GET api/v1/auth/businesses` (50-87) → `MyWorkspacesDto`
(`C:\Nik\clinqetshared\DTOs\Identity\BusinessContextDtos.cs:53`) of `BusinessMembershipSummaryDto` (9-45:
BusinessId, DisplayName, BusinessStatus, MembershipId, RelationshipType, MembershipStatus, IsPrimaryOwner,
**CanEnter** 31, AccessDenialReasonKey 33-34, AccessScope? 37-38, AuthorizationVersion, Roles) plus
`PendingInvitations`; `POST api/v1/auth/business-context` (90-178): throttle (110-118), `UserType.Partner`
only (131), **absent `BusinessId` = leave context** (143-150), `ResolveBusinessContextAsync` (152;
`AuthService.cs:7120-7144` → `BusinessAccessPolicy.Classify`), denial revokes sessions (156),
`IssueSessionAsync` (167-169); `POST api/v1/auth/businesses` creates a business and returns a full context
session (181-244).

Parsing in the Main API: `TenantContextMiddleware.cs:40-48` (`FindFirstValue` of the three authorization
claims), `BaseController.GetCurrentUserNumber` (239-248), `GetCurrentUserTypeAsync` (465-476),
`GetCurrentSenderType` (478-492: `Partner→Provider`, `Customer→Customer`). Identity host:
`C:\Nik\clinqetidentity\Clinqet.Identity.API\Controllers\BaseController.cs:139`. SignalR:
`NotificationHub.cs:306-314`.

Per-request resolution: middleware → `IAuthorizationSnapshotProvider.GetAsync(membershipId, businessId,
tokenVersion)` → `TenantContext` in `HttpContext.Items` (§2.5/2.6). The token is a **snapshot, not proof**:
permissions/scopes/team ids are never in the token (`BusinessContextClaimTypes.cs:3-5`).

Refresh persists only `BusinessId` and re-resolves `MembershipId`/roles from SQL (SKILL 394-398 — skill claim,
not re-read in code this session).

---

## 4. Scope enforcement in data access — per feature

Legend: **Read key** = `[RequiresPermission]`/in-action key; **Scopes honoured** = what the code branches on;
**Member field** = the document field that makes narrowing possible. All line numbers re-grepped at the HEADs
named at the top of this file.

| Feature | Endpoint(s) → read key (min scope) | Scopes honoured (how) | Repository/service method + member field | Member-scoped? |
|---|---|---|---|---|
| **Bookings** | `GET bookings/paginated` — `booking.read` default (`BookingController.cs:275`); `GET bookings/{number}` in-action `booking.read` + `EnforceResourceScope` (449) | Business → whole partition; Assigned → `ARRAY_CONTAINS(c.assignedMembershipIds,@scopeMembership)`; Team → EXISTS over `assignedTeamIds`; MatchesNothing → empty; Unsupported → 403 (`BookingController.cs:303-310`; `WorkListNarrowing.cs:43-87`) | `BookingRepository.GetPaginatedBookingsAsync(businessId, query, ct, narrowing)` (`BookingRepository.cs:192`, `MatchesNothing` short-circuit 203-204); fields `assignedMembershipIds`, `assignedTeamIds`, `branchId` (`ProviderOwnedEntity.cs:55-67`; `Booking : AssignableWorkEntity` Cosmos.cs:2083); indexed in **Transactions** (`CosmosContainerPolicies.cs:245-247`) | **Yes** (Assigned/Team) |
| Booking assignment | `PUT/GET bookings/{bookingId}/assignment` — `booking.assign` / `booking.read` (`Tenancy\BookingAssignmentController.cs:41, 70`) | evaluator on the record (`WorkAssignmentControllerBase.cs:55`); `Targets` only for holders of the assign key (58, 72-75) | `IWorkAssignmentService.ApplyAsync`; ETag patch `BookingRepository.SetAssignmentAsync` (464); `ResolveAssigneeNameAsync` (`WorkAssignmentService.cs:107`) | Yes |
| **Leads (Broadcast)** | `GET broadcast…/inbox`, `/inbox/status-counts` — `lead.read` **Business** (`Broadcast\BroadcastProviderController.cs:61, 91`); also 156 `lead.read` Business; `GET inbox/{broadcastId}` — `lead.read` default + `EnforceLeadScopeAsync` (118, 50, 133) | list: Business only (no narrowing call); detail: evaluator | `IBroadcastProviderService.GetInboxAsync(businessId, pageSize, cursor, status, ct)` (`IBroadcastProviderService.cs:9`; call 80) / `GetInboxStatusCountsAsync(businessId, ct)` (10; call 106); entity `BroadcastProvider : AssignableWorkEntity` (Cosmos.cs:2668) lives in **ProviderData**, which has **no assignment IncludedPath** (`CosmosContainerPolicies.cs:8-55`); `deliveredAt`/`openedAt` indexed (51-52), `createdAt` (29) | **No** at list level (no role holds `lead.read` below Business); assignment exists (`Tenancy\LeadAssignmentController.cs:43, 72`) |
| **Quotes** | `GET quotes` / `quotes/paginated` / `quotes/{quoteId}` — `quote.read` default (`QuoteController.cs:131, 164, 210`) | as bookings (145-153, 186-195, 236); ‼️ NOTE `GET quotes` (unpaginated) narrows **only in memory** via `KeepInScope` after a whole-partition read (149-151) | `QuoteRepository.GetPaginatedQuotesAsync(..., narrowing)` (`QuoteRepository.cs:95`); `Quote : AssignableWorkEntity` (Cosmos.cs:1603); `IssueDate` (1617-1618, indexed `CosmosContainerPolicies.cs:222`), `Status` (`QuoteStatus.cs`), `UpdatedBy` string (1661); **no `sentAt`/`sentBy` on Quote** (grep: the only `sentAt` in Cosmos.cs is Invoice's, 3363) | **Yes** |
| Quote send / assign | `POST quotes/{id}/send` — `quote.send` + `EnforceResourceScope` (`QuoteController.cs:1024, 1049`); `Tenancy\QuoteAssignmentController.cs:41 quote.assign, 68 quote.read` | evaluator | attribution `createdByMembershipId`/`updatedByMembershipId` stamped (`CosmosDbRepository.cs:133-168`) — **not indexed** | Yes (record) |
| **Invoices / earnings** | `GET invoices` (`Invoice\InvoiceController.cs:95`), `/{invoiceNumber}` (288 + `EnforceInvoiceScopeAsync` 237-258, call 304), `/summary` (326, narrowing 338-340), `/earnings` (756, narrowing 778-780) — all `invoice.read` default | as bookings; summary + earnings pass the same narrowing to the aggregates (TD-18, comment 754-755) | `InvoiceService.GetSummaryAsync` (`InvoiceService.cs:348`) → `InvoiceRepository.GetInvoiceSummaryAsync` (214) + `GetOverdueInvoiceSummaryAsync` (241); `GetEarningsGraphAsync` (`InvoiceService.cs:583`) → `GetPaidInvoicesInRangeAsync` on `c.status='Paid' AND c.paymentInfo.paidAt` range (`InvoiceRepository.cs:331`); `Invoice : AssignableWorkEntity` (Cosmos.cs:**3263**, assignment frozen from the source booking 3260-3262), `PaymentInfo.PaidAt/AmountPaid` (3228, 3236, 3239), `SentAt` (3363); `/paymentInfo/paidAt/?` indexed (`CosmosContainerPolicies.cs:238`) | **Yes** (Technician `invoice.read` Assigned) |
| ‼️ **Invoice payment methods (NEW)** | `GET/POST/PUT/DELETE/PATCH` on `ProviderBillingController.cs:1143` (`invoice.payment_methods.read` **Business**), `1169, 1201, 1235, 1270` (`invoice.payment_methods.manage` **Business**) | Business only | SQL billing tables. ‼️ The class carries `[AllowedWhenBillingOnly]` (line 35) and the filter reads it off `EndpointMetadata` (`RequiresPermissionAttribute.cs:88-89`), so these five are reachable in `BillingOnly` mode — benign today (BillingOnly admits only the primary owner, who holds every key) but worth stating | **No** |
| Payments (booking pay) | `GET …/bookings/{bookingId}/payment-status` — `payment.read` **Business** (`ProviderBookingPaymentStatusController.cs:47`); disputes `payment.read` (`ProviderDisputesController.cs:45`), `payment.dispute_respond` (67, 95); `payment.record_offline` (`ProviderBookingPaymentController.cs:50`), `payment.refund_approve` live (99) | Business only | booking `Payment` mirror (Cosmos.cs:2061-2081) | **No** |
| Billing / payouts | `ProviderBillingController.cs` — `billing.read`/`billing.manage`/`payout.read`/`payout.manage_account` all **Business** (129-1939); class-level `[AllowedWhenBillingOnly]` (35; `ProviderEndpointAuthorizationTests.cs:112 OnlyProviderBilling_IsReachableWhileTheBusinessIsSuspended`) | Business only | SQL billing tables | **No** |
| **Availability / calendar** | `GET business/availability?branchId=` — `availability.read` **Business** (`AvailabilityController.cs:168`); writes `availability.manage` Business (228, 346) | Business only; optional **branch** filter | `IAvailabilityRepository.GetByBusinessIdAsync(businessId, ct)` (`IAvailabilityRepository.cs:8`), `GetAvailabilityForDayAsync` (16); `Availability : ProviderOwnedEntity` (Cosmos.cs:625) with `branchId`; one calendar per business — per-member calendars OUT OF SCOPE (SKILL 1515, L30) | **No** (no member field) |
| **Customers (CRM)** | `GET customer/business` — `customer.read` default (`CustomerController.cs:204`); `GET customer/{customerId}` (165) + in-action scope (138-143); writes 377/508 Business, 552/648/704 default; 426 `conversation.reply` | Business → full list; Assigned/Team → **derived**: customer ids of the member's assigned Booking/Quote/Invoice (218-237) | `BookingRepository.GetAssignedCustomerIdsAsync(businessId, narrowing, ct)` (485; `SELECT DISTINCT VALUE c.customer.customerId … c.type IN ('Booking','Quote','Invoice') AND <predicate>`, bounded `Tenancy:WorkLists:MaxAssignedCustomerIds` 500, `TenancySettings.cs:39`); detail: `GetAssignedMembershipIdsForCustomerAsync` (441) + `BusinessCustomer.ToScopedResource(assigned)` (`ScopedResourceExtensions.cs:67-75`). `BusinessCustomer : ProviderOwnedEntity` (Cosmos.cs:1753) has **no assignment field** | **Yes (derived)** |
| **Inbox / conversations (the scope-aware surface)** | `GET business/inbox?view=` — `conversation.read` default (`Tenancy\ProviderInboxController.cs:44`; also 151, 168); assign 80/113/134 `conversation.assign`; reply 96 `conversation.reply` | Assigned → `ForMembership`; Team → `ForTeams`; CreatedByMe/Participating → no narrowing; **every row** re-checked by `IsVisibleTo` evaluator (`ProviderInboxService.cs:179-182, 187-198`, plus 311-312 and 605-606) | `IProviderInboxService.GetViewAsync(businessId, tenant, view, pageSize, cursor, context, ct)` (`IProviderInboxService.cs:13-16`); views `ProviderInboxView` Unassigned/AssignedToMe/MyTeam/Watching/All/Overdue (48-59); `Conversation : AssignableWorkEntity` (Cosmos.cs:2864) + `watcherMembershipIds` (2945), `slaDueAt` (2952); **Communications** container pk `/userNumber` with `/assignedMembershipIds/[]/?` (`CosmosContainerPolicies.cs:460`), `/assignedTeamIds/[]/?` (464), `/watcherMembershipIds/[]/?` (465), `/slaDueAt/?` (468); provider side keyed on **BusinessId** (`BaseController.GetCurrentConversationParticipantId` 262-265) | **Yes** (inbox only) |
| ‼️ **Messages / raw threads (NOT scope-aware)** | `Messaging\ConversationController.cs` (11 actions) and `Messaging\MessageController.cs` (4 actions) — **`[Authorize]` only** (24 / 28). Zero `[RequiresPermission]`, zero `EnforceResourceScope`, zero `EnforceBusinessPermission`, zero `Tenant`/`ScopeFor` reads | **NONE.** The only check is "a conversation with this id exists in the caller's partition", and for a provider the partition IS the BusinessId | `IConversationService.GetByIdAsync(conversationId, participantId, ct)` (`IConversationService.cs`; impl `ConversationService.cs:162-173`) → `ConversationRepository.GetByIdAsync` (64-70) = point read of `{participantId}_{conversationId}`; `IConversationService.GetInboxAsync` (10) → `GetByUserNumberAsync`; `MessageService.GetMessagesAsync` (191). Grep for tenancy types across `clinqetinfrastructure\Services\Messaging\`: **one hit and it is a comment** (`MessageService.cs:398`) | **NO — see §11.6** |
| **Knowledge** | `GET knowledge/documents`, `/documents/{docId}/images` — `voice.read` **Business** (`Knowledge\KnowledgeController.cs:79, 528`); every write — `voice.settings.manage` **Business** (142, 326, 379, 409, 443, 486, 564, 612, 653, 691, 715, 760, 807); `Knowledge\KnowledgeServiceDraftsController.cs`: `voice.read` 45, `voice.settings.manage` 88/125/155/182/210, `catalog.service.create` 239/328/356, `catalog.service.update` 268/295/385 | Business only | `IProviderKnowledgeSearch.SearchAsync(businessId, query, ct)` (`IProviderKnowledgeSearch.cs:19-22`) and `IKnowledgeManagementService` methods take `businessId` only; `KnowledgeDocument : BaseEntity` (`KnowledgeDocument.cs:10-93`) — no member field, and not even `createdByMembershipId`; **KnowledgeBase** container pk `/businessId` (`CosmosContainerPolicies.cs:743`) | **No** |
| **Analytics / insights** | `GET analytics/insights` — `insights.read` Business (`Analytics\AnalyticsController.cs:59`); `GET dashboard/statistics` — `insights.read` Business (`Dashboard\DashboardController.cs:43`) | Business only | ‼️ `ISmartAnalyticsReadService.GetInsightsAsync(businessId, tier, ct)` (`clinqetcore\Interfaces\Services\ISmartAnalyticsReadService.cs:11`; call `AnalyticsController.cs:82`) — the tier is resolved from `IEntitlementService.ResolveAsync(businessId)` → `analytics_advanced` (76-81), and the endpoint ALSO requires `Payments:Enabled && SmartAnalyticsEnabled` (66-68) and a per-business rate limit (70-74). Dashboard: `IDashboardService.GetDashboardStatisticsAsync(businessId, currencySymbol, ct)` (`IDashboardService.cs:7`; call 72). `analytics.read` is an orphan (`OrphanPermissionRegistryTests.cs:83`) | **No** |
| **Team / members** | `GET business/members` — `team.read` Business (`Tenancy\BusinessMemberController.cs:47`); seats 94; roles 116; suspend 62/77; remove 130/145; assign_role 165 (live); ownership 183/199/233/250/265; invitations (`Tenancy\TeamInvitationController.cs:39, 55, 83, 108`); branches (`Tenancy\BusinessBranchController.cs:42, 57-155`); teams (`Tenancy\BusinessTeamController.cs:38, 54-103`); activity feed `audit.read` Business (`Tenancy\BusinessActivityController.cs:40`) | Business only | SQL `BusinessMembership` (`C:\Nik\clinqetcore\Entities\SQL\BusinessMembership.cs:10-50`); `BusinessActivity` rows carry `actorMembershipId` but the feed filters only by `activityType` (`CosmosContainerPolicies.cs:54`) | **No** |
| Voice | `Voice\VoiceAssistantController.cs` — `voice.read` Business (64, 84, 249, 451, 484, 514); `voice.settings.manage` Business (105, 135, 162, 189, 219) and default (569, 601, 633); `voice.livecall.join` Business (274, 297, 337, 413); `voice.transcript.read` default (536, 665); SignalR `WatchVoiceLive` (`NotificationHub.cs:219, 301-338`) | Business only (no role grants below Business — `CosmosTenancyContractTests.cs:352`) | — | **No** |
| Services / catalogue | `ServiceController.cs` `catalog.service.read` Business (162, 211), `.create` (253, 523, 774), `.update` (355), `.delete` (573), `media.upload` (1142, 1235) | Business | `Service : ProviderOwnedEntity` (Cosmos.cs:405) | **No** |
| Reviews | provider replies `review.reply` (`ReviewController.cs:699, 753, 810`); reads are public anonymous routes | Business | `review.read` has no `[RequiresPermission]` consumer | **No** |

Cross-cutting facts:
- The two "work" containers that make member scoping possible: **Transactions**
  (`/assignedMembershipIds/[]/?`, `/assignedTeamIds/[]/?`, `/branchId/?` — `CosmosContainerPolicies.cs:245-247`)
  and **Communications** (460, 464, 465). **ProviderData** (leads, activity, availability, services)
  indexes none of them (8-55). `createdByMembershipId`/`updatedByMembershipId` are indexed **nowhere**
  (grep across `CosmosContainerPolicies.cs`: no matches).
- Assignment arrays hold **MembershipId** values (`ProviderOwnedEntity.cs:55-57`;
  `WorkListNarrowing.cs:50-52`), validated Active-in-this-business by
  `BusinessAssignmentGuard.TargetsBelongToBusinessAsync`
  (`C:\Nik\clinqetinfrastructure\Services\Tenancy\BusinessAssignmentGuard.cs:20`).
- All nine assignment/attribution fields are `[System.Text.Json.JsonIgnore]` — never serialised to API
  responses (`ProviderOwnedEntity.cs:21, 25, 32, 36, 40, 45, 56, 60, 66`; guards
  `CosmosTenancyContractTests.cs:235, 253, 272`). The provider learns the assignee only via
  `WorkAssignmentDetailDto` (`TeamManagementDtos.cs:495`).

---

## 5. Member identity resolution

- **List members with display names**: `GET /api/v1/business/members`
  (`Tenancy\BusinessMemberController.cs:47`, `team.read` Business) →
  `IMemberLifecycleService.ListMembersAsync(businessId, ct)` (`IMemberLifecycleService.cs:15`; impl
  `MemberLifecycleService.cs:61-137`): `BusinessMemberships` join `Users.IgnoreQueryFilters()`,
  `Status != Removed`, `DisplayName = BuildDisplayName(FirstName, LastName, Email)` (124; helper 978), plus
  roles/teams/branches (96-119). DTO `BusinessMemberDto`
  (`C:\Nik\clinqetshared\DTOs\Tenancy\TeamManagementDtos.cs:8-38`): `MembershipId`, `UserNumber`,
  `DisplayName`, `Email`, `PhoneNumber`, `RelationshipType`, `Status`, `IsPrimaryOwner`,
  `IsAccountDeactivated`, `JoinedAt`, `Roles[]`, `Teams[]`, `Branches[]`. Clients: web `GetMembers`
  (`src\services\tenancyServices.js:84` → `src\api\url.js:362` `BusinessMembersAPI` = `business/members`),
  mobile `getMembers` (`src\services\tenancyService.ts:64` → `src\apiManager\constant.tsx:294`).
- Who may call it: `team.read` holders only — owner, admin, ops_manager, dispatcher, read_only_auditor. A
  technician/contractor/sales_rep/finance/catalog_manager asking "bookings for Gaurav" cannot resolve
  "Gaurav" through this endpoint (and, being Assigned-scoped for bookings, may only see their own anyway).
- **Assignment targets (Active members + role keys)**:
  `IProviderInboxService.GetAssignmentTargetsAsync(businessId, tenant, ct, includeConversationWorkload)`
  (`IProviderInboxService.cs:23-25`; impl `ProviderInboxService.cs:200`) → `InboxAssigneeDto { MembershipId,
  DisplayName, RoleKeys, OpenConversationCount, IsAccountDeactivated }` (`TeamManagementDtos.cs:464`);
  exposed at `GET business/inbox/assignment-targets` (`conversation.assign`,
  `Tenancy\ProviderInboxController.cs:80`) and inside `WorkAssignmentDetailDto.Targets` only when the caller
  holds the record's assign key (`WorkAssignmentControllerBase.cs:58, 72-75`).
- **One name from a membership id**: `IWorkAssignmentService.ResolveAssigneeNameAsync(businessId,
  membershipId)` (`WorkAssignmentService.cs:107`) — constrained to this business, `IgnoreQueryFilters`,
  `"First Last"` else email.
- **Directory primitives**: `IBusinessMemberDirectory`
  (`C:\Nik\clinqetcore\Interfaces\Tenancy\IBusinessMemberDirectory.cs:6-30`):
  `GetActiveMemberUserNumbersAsync(businessId)` (8), `GetActiveBusinessIdsForUserNumberAsync(userNumber)` (13),
  `GetPrimaryOwnerUserIdAsync(businessId)` (19), `CountRosterAsync(businessId)` (26).
- **Free-text name → membership**: NOT FOUND. No server endpoint or service searches members by name; a
  planner must match client/AI-side over `ListMembersAsync` output (`DisplayName`, `Email`), then validate
  with `BusinessAssignmentGuard`-style Active-membership checks.
- **"my" mapping**:
  - `Tenant.MembershipId` — the identity used in every assignment array and narrowing predicate
    (`WorkListNarrowing.cs:50-52`), in `createdByMembershipId`/`updatedByMembershipId`
    (`ActorAttributionAccessor.cs:31-32`), and in `BusinessActivity.actorMembershipId`.
  - `Tenant.UserId` — SQL Identity PK; `createdByUserId` survives membership removal
    (`ProviderOwnedEntity.cs:10-12, 20-22`).
  - `Tenant.UserNumber` — the **person**; customer-side partitions, notifications, self-dealing check
    (`BaseController.cs:431-437`). A `BusinessId` and a `UserNumber` can never be equal (5 vs 6 chars,
    SKILL 86-101).
  - SQL rows: `BusinessMembership { MembershipId PK (14), BusinessId (18), UserId (22), RelationshipType (24),
    Status (26), AuthorizationVersion (30) }`; `Business { BusinessId, DisplayName (18), Status (23),
    PrimaryOwnerMembershipId (26), TimeZone (32), … }`
    (`C:\Nik\clinqetcore\Entities\SQL\Business.cs:10-93`).

---

## 6. Voice / MCP and Functions tenancy — BusinessId only (re-verified, unchanged)

- MCP host authenticates every tool request with a per-call bearer whose claims are `VoiceCallTokenClaims
  { BusinessId, CallId, Scope, Jti, ExpiresAt }`
  (`C:\Nik\clinqetshared\Models\Voice\VoiceCallTokenModels.cs:12-19`); `McpChannelAuthMiddleware` verifies the
  binding doc and requires `session.BusinessId == claims.BusinessId && session.Scope == claims.Scope`
  (`C:\Nik\clinqetmcp\Clinqet.Mcp\Middleware\McpChannelAuthMiddleware.cs:158-164`) and sets `CallContext
  { BusinessId, CallId, Scope, Verified, CustomerId, VerifiedBookingNumber, CatalogSource }` (166-176;
  `C:\Nik\clinqetmcp\Clinqet.Mcp\Context\CallContext.cs:5-18`). `VoiceCallScope` = `Customer | Partner`
  (`C:\Nik\clinqetshared\Enums\VoiceCallScope.cs:6-10`).
  **No MembershipId, no roles, no permissions anywhere in the MCP host**: grep
  `TenantContext|RequiresPermission|MembershipId|PermissionScope` over
  `C:\Nik\clinqetmcp\Clinqet.Mcp\**\*.cs` → **exactly one hit, a comment at `Program.cs:226`**
  ("…MembershipId, so a voice-taken booking can never read as an employee's").
  `AddSystemActorAttribution()` (`Program.cs:227`) stamps every write as `System`. MCP has no SQL
  (SKILL 1485-1489). Knowledge tools search by `context.BusinessId` alone
  (`C:\Nik\clinqetmcp\Clinqet.Mcp\Tools\KnowledgeTools.cs:102-103, 165-166, 171`;
  `IProviderKnowledgeSearch.SearchAsync(businessId, …)`).
- **In-app AI assistant (chat) — re-verified**: `AIAssistantController` gates
  `ai.assistant.use` Business at **232, 322, 431, 1162**
  (`C:\Nik\clinqetapi\Clinqet.API\Controllers\AI\AIAssistantController.cs`) and reads only
  `GetCurrentBusinessId()` (246, 333, 445, 638, 782, 1169).
  `McpToolGateway.CreateSessionAsync(string businessId, …)`
  (`C:\Nik\clinqetapi\Clinqet.API\Services\McpToolGateway.cs:48-95`) takes **only `businessId`**, mints
  `_tokenService.Mint(businessId, callId, VoiceCallScope.Partner, lifetime)` (57), sends it as
  `Authorization: Bearer` to `{Mcp:PublicUrl}/mcp/{SecretPath}` (60-66), and upserts the binding
  `VoiceCallSession { CallId, BusinessId, Scope = Partner, Phase = Active, Jti, Ttl }` (74-82). **No
  `MembershipId`, role, or permission map reaches the MCP host on this path**; every tool the chat calls runs
  at business level with a `System` actor.
- Functions host (`C:\Nik\clinqetfuncations\Clinqet.Communications`): grep
  `TenantContext|ITenantContextAccessor|RequiresPermission|IAuthorizationSnapshotProvider` → **no matches**.
  It registers `AddNotificationRouting` (`Program.cs:362`), `AddTenancyExpirySweeps` (510),
  `AddBusinessActivityFeed` (511), `AddSystemActorAttribution` (522); `AccessChangeApplier` only evicts via
  `IAuthorizationCacheSignal` (`AccessChangeApplier.cs:27-46`).

**Consequence for Provider AI Search**: the only host that can answer a member-scoped question is the
**Main API**. `AddTenancyAuthorization()` is registered there and nowhere else (`Program.cs:718`), and
`ITenantContextAccessor` reads `HttpContext.Items` (`TenantContextAccessor.cs:23-26`), so a tool that runs
off the request thread must be **handed a `TenantContext` value**, exactly as `IProviderInboxService` is
(§12).

---

## 7. Frontend gating (partner web + partner mobile)

**Permission source**: `GET /api/v1/business/access`
(`C:\Nik\clinqetapi\Clinqet.API\Controllers\Tenancy\BusinessAccessController.cs:35-66`) →
`BusinessAccessSummaryDto` (`BusinessContextDtos.cs:91-111`): `BusinessId, MembershipId, RelationshipType,
IsPrimaryOwner, AccessScope, AuthorizationVersion, RoleKeys, Permissions (key→scope), TeamIds, BranchIds,
MemberCount (109), PendingInvitationCount (110)`. The two counts are read LIVE from
`IBusinessMemberDirectory.CountRosterAsync` (47), never from the version-keyed snapshot (comment 45-46).

Web (`C:\Nik\clinqetwebpartnerapp`):
- `src/context/BusinessContext.jsx`: `loadAccess` → `GetMyAccess()` once per business (198-219),
  `reloadAccess` (221-224), `refreshAccess` (229-233), a roster-change subscription
  `onTeamRosterChanged(() => refreshAccess())` (237),
  `can = (permission) => Boolean(access?.permissions && permission in access.permissions)` (326-329),
  `accessKnown: access !== null` (375), `solo: soloBusiness(access)` (382), `membershipId` (383),
  `isPrimaryOwner` (384); `useBusiness()` (429).
- `src/services/tenancyServices.js`: `tenancyResult` shape `{ok, code, message, status, data}` (20-44);
  `GetMyAccess` (68) → `url.BusinessAccessAPI` = `business/access` (`src/api/url.js:357`); `GetMembers` (84)
  → `url.BusinessMembersAPI` (362).
- `src/lib/tenancy/renderingRules.js`: `SURFACE_PERMISSIONS` (**1168-1188**, exactly 15 entries: dashboard
  null · calendar availability.read · services catalog.service.read · leads lead.read · inbox
  conversation.read · bookings booking.read · quotes quote.read · invoices invoice.read · customers
  customer.read · insights insights.read · refundRequests payment.read · billing billing.read · team
  team.read · activity audit.read · callFollowUps voice.read), `surfacePermission` (1190-1193),
  `surfaceVisible` deny-by-default (1196-1201), `DASHBOARD_CARDS` (1210), `surfaceAccessState`
  failed→loading→denied→granted (1235-1238), `capabilityAccessState` (1272), `serviceCatalogEditable` (1281),
  `workAssignmentRowVisible` (1313), `soloBusiness` (348). ‼️ Each entry names the controller+method it maps
  to, and `NavigationGatesMatchControllerPermissionsTests` reads that literal and fails the build on a
  mismatch (comment 1160-1163) — **so a new AI-search surface added here needs a matching controller gate**.
- `src/components/tenancy/SurfaceAccess.jsx`: `SurfaceNoAccess` panel (23-50), `useSurfaceGate` (78-93),
  `SurfaceGate` (100-103 — screen NOT mounted when refused), `CapabilityGate` keyed on a permission (111-129;
  area label from `Permission_{key}_Name`).
- 403 handling: `src/lib/apiClient.js:63-77` — 403 rejects to the caller, **never logs out**, and raises ONE
  global dialog via `raiseAccessDenied` when `isPermissionRefusal` (`src/services/accessDeniedBus.js:89-97`);
  only 401 refreshes/logs out (119).

Mobile (`C:\Nik\clinqetmobilepartnerapp`):
- `src/context/BusinessProvider.tsx`: `loadAccess` → `getMyAccess()` (257-274; `business_context_stale` →
  `contextStale`, declared 60, state 91), `refreshAccess` (288-292), `can` (390-393),
  `solo: soloBusiness(access)` (448).
- `src/services/tenancyService.ts`: `getMyAccess` (61) → `API.business_access`
  (`src/apiManager/constant.tsx:293` `business/access`); `getMembers` (64) → `business_members` (294).
- `src/lib/tenancy/renderingRules.ts`: `SURFACE_PERMISSIONS` twin (**1159-1179**), same 15 entries;
  `capabilityAccessState` comment at 1260.
- `src/components/tenancy/SurfaceGate.tsx`: `SurfaceNoAccess` (22-48), `SurfaceGate` (54-78),
  `CapabilityGate` (86-109).
- 403 handling: `src/apiManager/apiManager.tsx:83-121` — "ON THIS PLATFORM A 403 IS ALWAYS A DOMAIN ANSWER,
  NEVER A DEAD SESSION"; `logForbidden` raises the access-denied bus (104-121); `response.status === 403`
  returns the response to the caller (229-232); only 401 triggers refresh → `forceLogout` (173, 215, 127).
  The guard `__tests__/tenancyForbiddenIsNotLogout.test.ts` still exists. The memory line "mobile
  403=logout" describes the pre-fix hazard (CP10), not current code.

---

## 8. Cross-tenant / authorization tests to copy as patterns

| File | Notable cases (line) |
|---|---|
| `C:\Nik\clinqetapi\Clinqet.API.IntegrationTests\Controllers\CrossTenantAuthorizationTests.cs` — **33 test methods**, real pipeline: JwtBearer → middleware → attribute → action; snapshot provider doubled | route/header/query mismatch 403 (70, 83, 97); malformed 400 (110); removed/suspended member 403 (123, 136); suspended business (148, 162); `ABillingOnlyToken_Is403OnEveryOperationalSurface` Theory (187); customer/admin token on provider endpoint (200, 212); `AMemberWithoutThePermission_Is403PermissionDenied` (224); **`AContractor_SeesOnlyTheCustomersOnTheirOwnAssignedWork_NeverTheWholeList`** (245); `ABusinessScopedMember_StillSeesTheWholeCustomerList` (287); version bump → stale (301); two-business member acts only in token workspace (318); no MembershipId → 403 (336); public Open Page still anonymous (350, 362); body-asserted BusinessId ignored (381); admin cannot transfer ownership (409); finance cannot change payout account (424); contractor cannot replay previous workspace URL (439); live re-check cases (459, 475, 490, 502, 625); catalog manager / auditor cannot create booking on shared endpoint (544, 560); customer not refused by provider gate (578); ops manager not refused (592); hard delete refused (608). ‼️ **No case concerns a conversation or a message — §11.6** |
| `C:\Nik\clinqetapi\Clinqet.API.IntegrationTests\Tests\AuthorizationSqlTests.cs` (REAL SQL) | owner resolves full catalogue (118); non-live membership denied (136); suspended business billing-only (149, 161); other business denied (174); no roles → empty set (196); stale version (218, 244); warm snapshot zero SQL (271); `GetLiveAsync` ignores cache (293); evict (319); dispatcher/consumer semantics (393-601) |
| `C:\Nik\clinqetapi\Clinqet.API.IntegrationTests\Tests\RevocationAtomicitySqlTests.cs` | suspend/reinstate/remove/roles/teams/branch-staff bump version + queue eviction together (50-136); refused change writes nothing (161); revocation touches no other business (180) |
| `C:\Nik\clinqetapi\Clinqet.API.IntegrationTests\Repositories\QuotaIsolationCosmosIntegrationTests.cs` (emulator) | five members share one pool (50); contractor in two businesses draws separately (68); periods never share (89); 20 simultaneous increments (122) |
| `C:\Nik\clinqetapi\Clinqet.API.UnitTests\Conventions\ProviderEndpointAuthorizationTests.cs` | every referenced permission exists/granted (35, 49); **`EveryMinimumScope_IsSatisfiableByAtLeastOneRole` (66)**; admin/anonymous exclusions (87, 100); billing-only surface (112); no authorization/tenancy file reads UserType (130, 142); sensitive ops (153, 166, 329); no body asserts BusinessId (181, 216); `TenantContext_IsReadFromExactlyOneKey` (338) |
| `C:\Nik\clinqetapi\Clinqet.API.UnitTests\Conventions\SharedEndpointProviderBranchTests.cs` | `EveryProviderBranchOnASharedEndpoint_IsGated` (67); `ClearedWithoutAGate` registry (33-64); the 12 pinned G1 endpoints (95-119). ‼️ **Its detector is `text.Contains("GetCurrentBusinessId()")` (171) and it SKIPS `BaseController.cs` (130) — which is why the messaging controllers are invisible to it (§11.6)** |
| `C:\Nik\clinqetapi\Clinqet.API.UnitTests\Conventions\WorkListNarrowingContractTests.cs` | no unpushable-scope grant (31); permission actually granted (56); assigned-scope grant exists (68); `For_*` mapping (87-118); predicate shapes (126, 138); throws for a kind with no predicate (154) |
| `C:\Nik\clinqetapi\Clinqet.API.UnitTests\Tenancy\CosmosTenancyContractTests.cs` | assignment/branch/conversation query shapes (34-101); index paths (106-190); cursor round-trip (214, 228); serializer never emits assignment/attribution (235, 253, 272); every assignable type declares support (311, 324); `PermissionsWithNoResourceCheck_AreNeverGrantedBelowBusinessScope` (352) |
| `C:\Nik\clinqetapi\Clinqet.API.UnitTests\Conventions\OwnerOnlyPermissionTests.cs` (32, 52, 63, 86), `OrphanPermissionRegistryTests.cs` (61 + registry 42-92), `NavigationGatesMatchControllerPermissionsTests.cs`, `EndpointIdentityClassificationTests.cs` | catalogue invariants and client↔controller permission parity |
| `C:\Nik\clinqetapi\Clinqet.API.UnitTests\Controllers\ProviderBillingInvoicePaymentMethodTests.cs` | ‼️ NEW — the five `invoice.payment_methods.*` endpoints' gate mapping (405-409) and catalogue/grant assertions (444-445, 459-460) |
| `C:\Nik\clinqetapi\Clinqet.API.UnitTests\Controllers\ConversationParticipantIdentityTests.cs` | `ProviderInbox_ReadsTheBusinessPartition_NotThePersons` (64); `CustomerInbox_StillReadsThePersonsPartition` (86); `CustomerMarksRead_FansTheReceiptOutToEveryBusinessMember` (105); `ProviderMarksRead_NotifiesTheCustomerDirectly_WithNoMemberLookup` (133). ‼️ These **assert the shared-partition behaviour on purpose** — they are the proof of §11.6, not a contradiction of it |
| `C:\Nik\clinqetmcp\Clinqet.Mcp.UnitTests\Middleware\McpChannelAuthMiddlewareTests.cs` | `Invoke_JtiMismatch_Returns401` (259), `Invoke_BusinessMismatch_Returns401` (278), `Invoke_ScopeMismatch_Returns401` (297), context stamped/cleared (315, 341) |
| Mobile `__tests__/tenancyForbiddenIsNotLogout.test.ts`, `__tests__/tenancyRenderingParity.test.ts` | 403 never signs out; web/mobile rule parity |

---

## 9. Knowledge — permissions today and per-document ACL

**Gates today** (`C:\Nik\clinqetapi\Clinqet.API\Controllers\Knowledge\KnowledgeController.cs`): comment 26-28
"Gates REUSE voice.read / voice.settings.manage (D17 — deliberately no new permission key)".
READ = `voice.read` Business (`GET knowledge/documents` 79; `GET documents/{docId}/images` 528).
WRITE = `voice.settings.manage` Business: 142, 326, 379, 409, 443, 486, 564, 612, 653, 691, 715, 760, 807.
Drafts (`KnowledgeServiceDraftsController.cs`): list `voice.read` (45), review actions
`voice.settings.manage` (88, 125, 155, 182, 210), approve-to-catalogue `catalog.service.create` (239, 328,
356) / `catalog.service.update` (268, 295, 385). Per the catalogue (§2.2): read = owner, admin, ops_manager,
dispatcher; upload/delete = **owner + admin only**.

**Per-document ACL / visibility: NOT FOUND.**
- Entity `KnowledgeDocument` (`C:\Nik\clinqetcore\Entities\COSMOS\KnowledgeDocument.cs:10-93`): businessId,
  docId, docName, docTitle, docType, linkedServiceIds, status, failureReasonKey, sizeBytes, pageCount,
  passageCount, contentHash, blobPath, sourceKind, **shareWithCallers** (71, default `true`), faqQuestion/
  faqAnswer, serviceDraftAnalytics, images, droppedImages. No visibility/audience/role/membership field.
  `KnowledgeDocument : BaseEntity` (not `ProviderOwnedEntity`), so **no `createdByMembershipId` either**.
- DTOs: grep `visibility|audience|restrict|allowedRole|roleKey|membershipId|ownerOnly|adminOnly|acl` over
  `C:\Nik\clinqetshared\DTOs\Knowledge` → no matches; `C:\Nik\clinqetcore\Models\Knowledge` → no matches;
  `KnowledgeServiceDraft.cs` → no matches.
- Search index `KnowledgeSearchDocument`
  (`C:\Nik\clinqetcore\Entities\AISearch\KnowledgeSearchDocument.cs:11-119`): id, businessId (filter, 21-23),
  docId (26-28), docName, docType, linkedServiceIds (filter, 45-47), linkedServiceNames, linkedGroupName,
  sectionTitle, content, contentVector, docTitle, chunkKind, pageNumber, language, updatedAt, hasEmbedding,
  imageRef — no audience field; "treat every field here as permanent" (9).
- Services: grep over `C:\Nik\clinqetinfrastructure\Services\Knowledge` for
  `visibility|audience|restrict|allowedRole|roleKey|membershipId|TenantContext` → no matches.
- ‼️ The retrieval interface itself forbids a caller-built filter: `IProviderKnowledgeSearch`
  (`C:\Nik\clinqetcore\Interfaces\Knowledge\IProviderKnowledgeSearch.cs:7-12`) states the implementation MUST
  scope every query to `businessId` ("there is no overload that accepts a caller-built filter"), assert the
  emitted filter LEADS with that scope before the request leaves the process, and verify every returned row's
  businessId, failing closed on any mismatch. Implementation:
  `ProviderKnowledgeSearchService.SearchAsync` (94-99), `BuildScopeFilter` (672) + `AssertScoped` (700),
  called at 131-132 and again on the read-by-refs path at 291-292 with per-row verification at 302.
  **A member/role audience filter therefore cannot be bolted on at the call site — it must be a field on the
  index plus a change to this contract.**

**Nearest existing patterns to model "everyone in my team" vs "admins & supervisors only" on:**
1. `KnowledgeDocument.ShareWithCallers` — a per-document audience boolean, read **live at search time** as an
   exclusion/inclusion list: `IKnowledgeDocumentRepository.ListRefSuppressedDocIdsAsync(businessId)`
   (`C:\Nik\clinqetinfrastructure\Data\COSMOS\KnowledgeDocumentRepository.cs:169`) and
   `ListRetrievableDocIdsAsync` (259) → `search.in(id, …)` filter
   (`ProviderKnowledgeSearchService.cs:275, 291, 370, 386`). Toggled via
   `PATCH knowledge/documents/{docId}/sharing` (`KnowledgeController.cs:486`).
2. `LinkedServiceIds` — a per-document **list** stored on the row (`KnowledgeDocument.cs:34-35`) mirrored as a
   filterable index collection (`KnowledgeSearchDocument.cs:45-47`) and used in the scope filter
   (`ProviderKnowledgeSearchService.cs:687`).
3. Membership-id arrays on Cosmos work entities with an IncludedPath: `assignedMembershipIds` /
   `watcherMembershipIds` (`ProviderOwnedEntity.cs:55-57`; Cosmos.cs:2945;
   `CosmosContainerPolicies.cs:245, 460, 465`).
4. SQL: `BusinessNotificationRoute { Target: NotificationRoutingTarget, ExplicitMembershipIdsJson }`
   (`C:\Nik\clinqetcore\Entities\SQL\BusinessNotificationRoute.cs:19-27`) — an "everyone with the permission"
   vs "these named members" audience switch.
5. **Role keys are never stored on any entity** — grep `RoleKeys|List<string>.*Role|RoleId` over
   `C:\Nik\clinqetcore\Entities` → only SQL FKs `BusinessMembershipRole.RoleId`, `BusinessRole.RoleId`,
   `InvitationRole.RoleId`. Permissions/roles live in code and SQL role rows; a role-key list on a Cosmos
   document would be a first.

Any new visibility field on `KnowledgeDocument`, on `KnowledgeSearchDocument`, or a new KnowledgeBase
IncludedPath is a **§0.7 schema change requiring owner approval** (CLAUDE.md §0.7; index fields are permanent
per `KnowledgeSearchDocument.cs:9`). A new permission key is a **`CatalogVersion` bump** (now → 5) plus
localization in `en.json` and every other language file, as `invoice.payment_methods.*` just demonstrated.

---

## 10. Mapping natural-language business questions → permission key + scope filter

| Question (asker) | Permission needed (READ) | Data path | Scope filter that must be applied | Member/branch field | Verified support |
|---|---|---|---|---|---|
| "Show me all my bookings" (technician/contractor) | `booking.read` at **Assigned** | `IBookingRepository.GetPaginatedBookingsAsync(..., narrowing)` (`IBookingRepository.cs:35`) | `WorkListNarrowing.For(tenant,"booking.read")` → `ARRAY_CONTAINS(c.assignedMembershipIds, @scopeMembership)`; then evaluator per row | `assignedMembershipIds` (Transactions, indexed 245) | Yes (`BookingController.cs:303-310`) |
| "Show me all my bookings" (owner/admin/ops/dispatcher/sales/finance/auditor) | `booking.read` at Business | same, `narrowing.Kind == None` | none ("my" = the business) | — | Yes |
| "Show me Gaurav's bookings" (owner/admin) | `booking.read` Business **and** a way to resolve "Gaurav" → `team.read` (`GET business/members`) | `BookingRepository.BuildAssignmentQuery("assignedMembershipIds", membershipId, status)` (518, bounded `SELECT TOP`; callers 417, 428) or the paginated query with an `AssignedToMembership` narrowing built for Gaurav's MembershipId | `ARRAY_CONTAINS(c.assignedMembershipIds, @gauravMembershipId)`; **not** `createdByMembershipId` (unindexed) | `assignedMembershipIds` | Yes for assigned work; **name→membership resolution is client/AI-side only** (§5) |
| "Show me Gaurav's bookings" (technician) | — | — | must be refused/empty: technician holds `booking.read` Assigned (own only) and no `team.read` | — | By construction (`WorkListNarrowing` ignores a requested member) |
| "How many leads did I receive last week?" | `lead.read` (**Business only** — no narrower grant exists) | `IBroadcastProviderService.GetInboxStatusCountsAsync(businessId, ct)` / `GetInboxAsync` (`IBroadcastProviderService.cs:9-10`) | business-wide; "I" = the business. Date = `deliveredAt`/`createdAt` (indexed in ProviderData, `CosmosContainerPolicies.cs:51, 29`) | none for members (lead assignment exists but `lead.read` is never Assigned) | Yes (business level); per-member "received" = **not modelled** |
| "How many quotations did Gaurav send last week?" | `quote.read` (Business for the asker) + `team.read` to resolve Gaurav | Quote container = Transactions; **no `sentAt`/`sentBy` on `Quote`** (Cosmos.cs:1603-1670) | Two possible proxies, both **not indexed**: (a) `createdByMembershipId == Gaurav` (stamped `CosmosDbRepository.cs:141`), (b) `updatedByMembershipId == Gaurav`; date proxy `issueDate` (indexed 222). "Sent" ≈ `POST quotes/{id}/send` (`QuoteController.cs:1024`) which records no sender/timestamp on the quote | `createdByMembershipId` / `updatedByMembershipId` (unindexed); `assignedMembershipIds` (indexed, but = assignee not sender) | **Unknown/partial** — the data model has no "sent by"; any filter is an in-partition scan or a §0.7 index change |
| "What is my availability?" | `availability.read` Business (every role) | `IAvailabilityRepository.GetByBusinessIdAsync(businessId, ct)` (`IAvailabilityRepository.cs:8`) via `GET business/availability?branchId=` (`AvailabilityController.cs:168`) | business-wide (optionally per branch); **no per-member availability exists** (SKILL 1515) | `branchId` only | Yes (business); per-member = not modelled |
| "How much money did we receive through invoices last week?" (owner/admin/finance/ops/auditor) | `invoice.read` Business | `IInvoiceService.GetEarningsGraphAsync(..., narrowing)` (`IInvoiceService.cs:58`) → `GetPaidInvoicesInRangeAsync(status='Paid', paymentInfo.paidAt ∈ range)` (`InvoiceRepository.cs:331`) | none | `/paymentInfo/paidAt/?` indexed (238) | Yes (`InvoiceController.cs:749-792`) |
| same question (technician) | `invoice.read` **Assigned** | same, with narrowing | `ARRAY_CONTAINS(c.assignedMembershipIds, @scopeMembership)` — answer = money on **their** invoices only (TD-18 "at whatever scope the reader holds", `InvoiceController.cs:754-755`) | `assignedMembershipIds` | Yes |
| same question (contractor, sales_rep, dispatcher, catalog_manager) | none — no `invoice.read` | — | **refuse** (`permission_denied`) | — | By construction |
| ‼️ "Where do customers send invoice payments?" | `invoice.payment_methods.read` **Business** — owner/admin/**finance** only | `ProviderBillingController.cs:1143` (SQL billing) | none | — | Yes (NEW this week) |
| "Which customers do I look after?" (technician) | `customer.read` Assigned | `IBookingRepository.GetAssignedCustomerIdsAsync(businessId, narrowing, ct)` (`IBookingRepository.cs:40`; impl 485) | derived from assigned Booking/Quote/Invoice; bounded 500 (`TenancySettings.cs:39`) | derived | Yes (`CustomerController.cs:218-237`) |
| "What's in my inbox / unanswered messages?" | `conversation.read` (Assigned for technician/contractor) | ‼️ `IProviderInboxService.GetViewAsync(businessId, tenant, view, …)` (`IProviderInboxService.cs:13-16`) — **never** `IConversationService` | `NarrowingFor(tenant)` (`ProviderInboxService.cs:187-198`) + `IsVisibleTo` per row (179-182) | `assignedMembershipIds`, `assignedTeamIds`, `watcherMembershipIds` (Communications) | Yes — **and only through this seam (§11.6)** |
| "What does our knowledge say about X?" | `voice.read` Business (owner, admin, ops, dispatcher) — anyone else refused today | `IProviderKnowledgeSearch.SearchAsync(businessId, query, ct)` (`IProviderKnowledgeSearch.cs:19-22`) | business-wide; per-document audience = only `ShareWithCallers` (callers, not members) | none | Yes (business); per-role visibility = **not modelled** (§9) |
| "How is the business doing?" (insights) | `insights.read` Business | `ISmartAnalyticsReadService.GetInsightsAsync(businessId, tier, ct)` (`ISmartAnalyticsReadService.cs:11`) — also needs `Payments:Enabled && SmartAnalyticsEnabled` (`AnalyticsController.cs:66-68`); counters via `IDashboardService.GetDashboardStatisticsAsync` (`IDashboardService.cs:7`) | none | none | Yes |
| "Who is on my team?" | `team.read` Business | `IMemberLifecycleService.ListMembersAsync(businessId, ct)` (`IMemberLifecycleService.cs:15`) | none | — | Yes |

---

## 11. Gaps / risks / open questions

1. **No "sent by / created by" query path.** `createdByMembershipId`/`updatedByMembershipId` are stamped on
   every business-owned document (`CosmosDbRepository.cs:133-168`) but indexed in **no** container
   (`CosmosContainerPolicies.cs`: no IncludedPath). "Quotations Gaurav sent" needs either an in-partition scan
   (RU cost, unbounded) or a new IncludedPath (§0.7 owner approval). Quote carries no `sentAt`; Invoice does
   (Cosmos.cs:3363).
2. **Leads are never member-scoped for reading.** `lead.read` is granted only at Business
   (`BroadcastProviderController.cs:61, 91, 156`); per-member "leads I received" is not a modelled concept
   (assignment via bid claim exists but is not a read filter), and **ProviderData indexes no assignment
   path** so a narrowing predicate would be a full-partition scan.
3. **Availability is one calendar per business** (L30, SKILL 1515); "my availability" for a technician = the
   business's hours.
4. **Knowledge has no member/role visibility**; today only owner/admin can upload/delete, and only
   `voice.read` holders can read. A per-document audience is a new Cosmos field + new search-index field
   (+ possibly an IncludedPath) **and** an amendment to the `IProviderKnowledgeSearch` isolation contract
   (`IProviderKnowledgeSearch.cs:7-12`) → §0.7, plus new permission semantics.
5. **Name→member resolution is not a server capability**; the AI would need `team.read` to list members and
   match names, which technician/contractor/sales/finance/catalog_manager lack — a design decision is needed
   for how the AI resolves "Gaurav" for those roles (it should not).
6. ‼️ **VERIFIED AND CLOSED — the messaging thread endpoints are NOT scope-checked. Answer: plainly NO.**

   **What is there.** `Messaging\ConversationController.cs` (11 actions) and `Messaging\MessageController.cs`
   (4 actions) carry class-level `[Authorize]` only (24 / 28). Grep over both files for
   `RequiresPermission|EnforceResourceScope|EnforceBusinessPermission|Tenant\.|ScopeFor|GetCurrentMembershipId`
   → **zero matches**. The single identity step in every action is
   `GetCurrentConversationParticipantId()` — ConversationController 56, 101, 133, 166, 207, 240, 273, 306,
   343, 375, 407; MessageController 77, 165, 205, 357.

   **What that helper returns.** `BaseController.GetCurrentConversationParticipantId()` (262-265) returns
   `GetCurrentBusinessId()` when `GetCurrentSenderType() == SenderType.Provider`, else `GetCurrentUserNumber()`.
   Its own comment (250-259) states the intent: *"A provider acts FOR THE BUSINESS — its inbox is shared by
   every member — so the provider side is keyed on BusinessId."*

   **What the service and repository then do.** `ConversationService.GetByIdAsync(conversationId,
   userNumber, ct)` (`ConversationService.cs:162-173`) calls
   `ConversationRepository.GetByIdAsync` (`ConversationRepository.cs:64-70`), which is a **point read of
   `{participantId}_{conversationId}` in the `participantId` partition**. `GetInboxAsync` (143-160) is
   `GetByUserNumberAsync(userNumber, …)`. `MessageController.GetMessages` (157-194) verifies only that the
   conversation exists in that partition (172-175) before calling
   `MessageService.GetMessagesAsync(conversationId, userId, …)` (181-182; impl `MessageService.cs:191`).
   Grep over `clinqetinfrastructure\Services\Messaging\` for
   `TenantContext|ITenantContextAccessor|IResourceScopeEvaluator|ScopeFor|WorkListNarrowing|conversation.read|PermissionScope`
   → **one hit, and it is a comment** (`MessageService.cs:398`).

   **Therefore**: existence in the business's partition is the entire check. A **technician or contractor**,
   whose `conversation.read` is granted at `Assigned` only, can — through `GET /api/v1/conversations`,
   `GET /api/v1/conversations/{conversationId}` and `GET /api/v1/conversations/{conversationId}/messages` —
   read **every** thread and message of their business, and can additionally reply (`POST …/messages`),
   mark-read, archive, hide, block, unblock, mute and report on any of them. So can a
   **catalog_manager** or a **finance** member, who hold **no** `conversation.*` key at all. The
   scope-aware surface is *only* `Tenancy\ProviderInboxController` → `ProviderInboxService`
   (`IsVisibleTo` 179-182).

   **Why no guard catches it.** `SharedEndpointProviderBranchTests.ScanControllers` decides "this action has
   a provider branch" with `text.Contains("GetCurrentBusinessId()")` (line **171**) and **skips
   `BaseController.cs` entirely** (line **130**). The messaging controllers reach the business id only
   *through* the `BaseController` helper, so the scan records `HasProviderBranch == false` for all 15 actions
   and never considers them. They are also absent from `ClearedWithoutAGate` (33-64), i.e. nobody ever
   triaged them.

   **Why no test catches it.** `CrossTenantAuthorizationTests.cs` has 33 test methods (all listed in §8) and
   **none** concerns a conversation or a message. `ConversationParticipantIdentityTests.cs` asserts the
   shared-partition behaviour **as the desired outcome** —
   `ProviderInbox_ReadsTheBusinessPartition_NotThePersons` (64) and
   `CustomerMarksRead_FansTheReceiptOutToEveryBusinessMember` (105).

   **The SKILL claim is unsupported.** SKILL.md 1194-1196 lists, inside its "39-case cross-tenant matrix",
   *"a team-scoped member reading another team's conversation"* and *"an assigned-only member requesting an
   unassigned booking"*. Neither case name exists in `CrossTenantAuthorizationTests.cs`. Quote the code.

   **What this means for Provider AI Search.** (a) An AI tool must **never** be wired to
   `IConversationService` or `IMessageService`; the only member-safe messaging seam is
   `IProviderInboxService.GetViewAsync(businessId, tenant, …)`. (b) Whether the raw thread endpoints should
   themselves become scope-checked is an **owner decision with a real behaviour change** — they are shared
   with the customer app, so the fix is an in-action provider-branch gate (the §2.5 pattern), not a class
   attribute (that would 401 every customer). (c) The `SharedEndpointProviderBranchTests` detector should be
   widened to `GetCurrentConversationParticipantId()` as well, or these 15 actions stay invisible to it
   forever.
7. **The AI tool layer today is BusinessId-only** (MCP `CallContext`,
   `McpToolGateway.CreateSessionAsync(businessId)` → `Mint(businessId, callId, Partner, …)`). A member-aware
   AI search must carry the caller's `TenantContext` (MembershipId + permission→scope map + TeamIds/BranchIds)
   into tool execution and reuse `WorkListNarrowing`/`IResourceScopeEvaluator`; there is no existing seam for
   that in the MCP host (no SQL, no snapshot provider), so the natural home is the Main API
   (`AddTenancyAuthorization` is registered there only, `Program.cs:718`). §12 is the recipe.
8. **`GET quotes` (unpaginated) narrows only in memory** after a full-partition read
   (`QuoteController.cs:149-151`) — a technician asking for quotes pays for the whole partition. An AI tool
   must use `GetPaginatedQuotesAsync` with a narrowing, never this path.
9. **Skill/document drift**: permission count (**94**), `CatalogVersion` (**4**), attribute-site count
   (**266/37**) — quote the code, not the skill. §13 lists the full delta.
10. **Revocation is TTL-bounded** (60 s snapshot cache, `TenancySettings.cs:153`); the seven sensitive
    operations re-check live SQL — an AI answering money questions from cached permissions inherits the same
    60 s window (acceptable per L61, but state it). ‼️ Note that the new `invoice.payment_methods.*` keys are
    NOT on the sensitive list despite being marked sensitive in the catalogue (§2.7).
11. `BusinessStatus.Suspended/Closed` and `BillingOnly` reduce access further at the token/middleware level;
    any AI surface must honour `TenantContext.AccessScope == BillingOnly` → refuse operational questions
    (mirrors `RequiresPermissionAttribute.cs:92-98`). ‼️ Remember that `[AllowedWhenBillingOnly]` is read off
    `EndpointMetadata` (88-89), so a class-level attribute exempts every action on that class — as
    `ProviderBillingController.cs:35` now does for the five new payment-method endpoints.
12. `ai.assistant.use` is **not** held by technician, contractor, finance, read_only_auditor (catalogue §2.2)
    — the existing AI assistant entrance is already closed to the roles whose scope-narrowing matters most; a
    Provider AI Search reusing that key would exclude them by default (owner decision needed: new key vs.
    widen grants — either is a `CatalogVersion` bump to 5, SKILL 4725-4731, plus `en.json` + every language
    file, exactly as `invoice.payment_methods.*` did).
13. **A new surface row in `SURFACE_PERMISSIONS` is a build-checked claim.** Both rendering-rule files name
    the controller + method behind each permission, and `NavigationGatesMatchControllerPermissionsTests`
    reads that literal and fails if the controller demands a different key
    (`renderingRules.js:1160-1163`). An AI-search rail entry therefore requires the controller gate to exist
    first, in both `clinqetwebpartnerapp` and `clinqetmobilepartnerapp` (parity guard
    `__tests__/tenancyRenderingParity.test.ts`).

---

## 12. How a SERVICE-layer AI tool enforces permission + scope — the precise recipe

Everything below already exists; nothing here is a proposal. All seams are registered by
`AddTenancyAuthorization()` in the **Main API host only** (`Program.cs:718`;
`TenancyServiceRegistration.cs:49-64`).

### 12.1 What to inject

| Inject | From | Why |
|---|---|---|
| `ITenantContextAccessor` | `clinqetcore\Interfaces\Tenancy\ITenantContextAccessor.cs:7-12` (impl `TenantContextAccessor.cs:14-30`) | `Require()` (28-29) returns the request's `TenantContext` or throws. ‼️ It reads `HttpContext.Items` (23-26), so it is **only valid on the request thread** |
| `IResourceScopeEvaluator` | `clinqetcore\Interfaces\Tenancy\IResourceScopeEvaluator.cs:7-10` (impl `ResourceScopeEvaluator.cs:17-46`) | The one per-record decision. Its first branch already denies an ungranted key (21-23), so one call = permission + tenant assertion + narrowing |
| the feature repository/service **interface**, choosing the overload that accepts `WorkListNarrowing` | §12.3 table | The query narrows; the evaluator decides |

‼️ **Prefer passing `TenantContext` as an explicit parameter over injecting the accessor**, following the one
existing precedent: `IProviderInboxService` takes `TenantContext tenant` on every method
(`IProviderInboxService.cs:13-16, 23-25, 28-45`). An AI tool may execute on a continuation, a streamed
response, or a background scope where `HttpContextAccessor.HttpContext` is null; a value cannot go stale
mid-answer, and it makes the tool unit-testable without an HTTP context.

### 12.2 The fixed order of operations

```
1. tenant   = accessor.Require()                       // or the TenantContext parameter
2. BillingOnly guard   : if (tenant.AccessScope == BusinessAccessScope.BillingOnly) refuse
                         // mirrors RequiresPermissionAttribute.cs:92-98
3. Permission gate     : if (!tenant.Has(key))         refuse "permission_denied"
                         // Has(key) with no minimumScope == "held at ANY scope above None"
                         // TenantContext.cs:26-27; the rail uses the same rule (SKILL 3892-3895)
                         // For a Business-only feature pass PermissionScope.Business explicitly.
4. Narrow              : var narrowing = WorkListNarrowing.For(tenant, key);   // WorkListNarrowing.cs:43-58
                         switch (narrowing.Kind) {
                           MatchesNothing -> return an EMPTY answer, run NO query
                           Unsupported    -> refuse "resource_out_of_scope"
                           None | AssignedToMembership | AssignedToTeams -> continue
                         }
5. Query               : the repository overload that takes `narrowing` (§12.3)
                         // CosmosDbRepository.ApplyNarrowing (62-71) puts the predicate in WHERE *and* COUNT
6. Decide per row      : rows.Where(r => evaluator.Evaluate(tenant, key, r.ToScopedResource()).Allowed)
                         // ScopedResourceExtensions.cs:14-100 ; controller equivalents are
                         // BaseController.KeepInScope (370-395) + ReplaceItems (401-407)
7. Bind ids from tenant: businessId = tenant.BusinessId, membershipId = tenant.MembershipId
```

**Rule 7 is the leak-prevention rule and is absolute.** A tool must never accept `businessId`,
`membershipId`, `userNumber`, a team id or a branch id as a model-supplied argument. The attribute already
refuses a route/header/query assertion (`RequiresPermissionAttribute.cs:62-86`) and
`ProviderEndpointAuthorizationTests.cs:181, 216` refuses a body that asserts one; a tool-call argument is the
same class of input with no guard in front of it. Everything the model may vary — dates, statuses, page size,
a service name, a free-text query — is fine; identity is not.

Two more invariants worth restating: step 4 is an **RU optimisation only**; a wrong narrowing may cost RU or
return fewer rows and can never widen (`WorkListNarrowing.cs:6-9`, `CosmosDbRepository.cs:58-61`). And every
call in §12.3 is single-partition (`/businessId`, or `/userNumber` for Communications where the provider side
is keyed on BusinessId) — **no cross-partition query, CLAUDE.md §0.6**.

### 12.3 Per-tool: permission key, narrowing call, repository overload

| AI tool | Permission key (min scope) | Narrowing call | Repository/service overload that accepts it | Row-level `ToScopedResource` | Narrow-scope behaviour |
|---|---|---|---|---|---|
| **Bookings list** | `booking.read` (**None** — reach the action, let the query narrow) | `WorkListNarrowing.For(tenant, "booking.read")` | `IBookingRepository.GetPaginatedBookingsAsync(businessId, BookingQueryDto, ct, narrowing)` — `IBookingRepository.cs:35`; impl `BookingRepository.cs:192` (`MatchesNothing` short-circuit 203-204) | `Booking.ToScopedResource()` — `ScopedResourceExtensions.cs:14-21` | Assigned → own assigned bookings; Team → team's; controller precedent `BookingController.cs:303-310` |
| **Quotes list** | `quote.read` (None) | `WorkListNarrowing.For(tenant, "quote.read")` | `IQuoteRepository.GetPaginatedQuotesAsync(businessId, QuoteQueryDto, ct, narrowing)` — `IQuoteRepository.cs:18`; impl `QuoteRepository.cs:95` | `Quote.ToScopedResource()` — 23-30 | ‼️ Never the unpaginated `GET quotes` path (`QuoteController.cs:145-153`) — it reads the whole partition and filters in memory |
| **Invoice totals / earnings** | `invoice.read` (None) | `WorkListNarrowing.For(tenant, "invoice.read")` | `IInvoiceService.GetSummaryAsync(businessId, ct, narrowing)` — `IInvoiceService.cs:54`; impl `InvoiceService.cs:348` → `IInvoiceRepository.GetInvoiceSummaryAsync` (21 / impl 214) + `GetOverdueInvoiceSummaryAsync` (23 / impl 241). Money over a date range: `IInvoiceService.GetEarningsGraphAsync(businessId, start, end, currencySymbol, ct, narrowing)` (58 / impl 583) → `GetPaidInvoicesInRangeAsync` (33 / impl 331). List: `GetPaginatedAsync` (51 / impl 342) | `Invoice.ToScopedResource()` — 32-39 | Technician gets money on **their** invoices only (TD-18, `InvoiceController.cs:754-755`); contractor/sales/dispatcher/catalog_manager hold no `invoice.read` ⇒ step 3 refuses |
| **Leads count** | `lead.read` at **`PermissionScope.Business`** — pass it explicitly, as `BroadcastProviderController.cs:61, 91` does | **none** — do not call `WorkListNarrowing.For` here | `IBroadcastProviderService.GetInboxStatusCountsAsync(businessId, ct)` — `IBroadcastProviderService.cs:10`; list `GetInboxAsync(businessId, pageSize, cursor, status, ct)` (9) | `BroadcastProvider.ToScopedResource()` exists (41-48) but only the **detail** path uses it (`EnforceLeadScopeAsync`, `BroadcastProviderController.cs:50, 133`) | No role grants `lead.read` below Business, and **ProviderData indexes no assignment path** (`CosmosContainerPolicies.cs:8-55`) ⇒ a narrowing predicate would be a full-partition scan. Answer business-wide or refuse |
| **Availability** | `availability.read` at **`PermissionScope.Business`** (`AvailabilityController.cs:168`) | none | `IAvailabilityRepository.GetByBusinessIdAsync(businessId, ct)` — `IAvailabilityRepository.cs:8`; one day: `GetAvailabilityForDayAsync(businessId, dayOfWeek, ct)` (16) | `ServiceArea.ToScopedResource()` covers branch-only resources (93-100); `Availability` has **no** mapping | Every role holds it at Business. One calendar per business; `branchId` (Cosmos.cs:625-638) is the only sub-filter. Per-member availability does not exist (SKILL 1515) |
| **Team roster** | `team.read` at **`PermissionScope.Business`** (`BusinessMemberController.cs:47`) | none | `IMemberLifecycleService.ListMembersAsync(businessId, ct)` — `IMemberLifecycleService.cs:15`; impl `MemberLifecycleService.cs:61-137` (`DisplayName` 124). Assignable ACTIVE targets: `IProviderInboxService.GetAssignmentTargetsAsync(businessId, tenant, ct, includeConversationWorkload: false)` (23-25) — pass `false`, it skips a whole Cosmos read (TD-28). One name: `IWorkAssignmentService.ResolveAssigneeNameAsync(businessId, membershipId, ct)` (`WorkAssignmentService.cs:107`) | n/a (SQL) | Technician/contractor/sales_rep/finance/catalog_manager hold no `team.read` ⇒ step 3 refuses ⇒ the AI cannot resolve a colleague's name for them (§11.5) |
| **Inbox summary** | `conversation.read` (None) | ‼️ **do not** build a `WorkListNarrowing` — this surface owns its own type | `IProviderInboxService.GetViewAsync(businessId, tenant, ProviderInboxView, pageSize, continuationToken, context, ct)` — `IProviderInboxService.cs:13-16`. Pass the `TenantContext` and it narrows internally (`NarrowingFor` → `InboxScopeNarrowing.ForMembership`/`ForTeams`, `ProviderInboxService.cs:187-198`; type at `clinqetcore\Interfaces\COSMOS\InboxPageQuery.cs:12-26`) **and** re-checks every row (`IsVisibleTo` 179-182). Views: `ProviderInboxView` 48-59 | `Conversation.ToScopedResource(businessId)` — 54-62 (done for you) | Assigned → own + watched; Team → team's. ‼️ **Never** `IConversationService.GetInboxAsync/GetByIdAsync` or `IMessageService.GetMessagesAsync` — those are partition-only and return the whole business (§11.6) |
| **Insights** | `insights.read` at **`PermissionScope.Business`** (`AnalyticsController.cs:59`, `DashboardController.cs:43`) | none | `ISmartAnalyticsReadService.GetInsightsAsync(businessId, InsightsTier, ct)` — `clinqetcore\Interfaces\Services\ISmartAnalyticsReadService.cs:11`. Resolve the tier the way the controller does: `IEntitlementService.ResolveAsync(businessId, ct)` → `analytics_advanced` → Max/Premium/Free (`AnalyticsController.cs:76-81`), and honour `Payments:Enabled && SmartAnalyticsEnabled` first (66-68). Plain counters: `IDashboardService.GetDashboardStatisticsAsync(businessId, currencySymbol, ct)` — `IDashboardService.cs:7` | n/a (aggregate) | Business-only; technician/contractor/dispatcher/catalog_manager hold no `insights.read` ⇒ refuse |
| **Knowledge search** (the primary surface) | `voice.read` at **`PermissionScope.Business`** (`KnowledgeController.cs:79`) | none | `IProviderKnowledgeSearch.SearchAsync(businessId, KnowledgeSearchQuery, ct)` — `IProviderKnowledgeSearch.cs:19-22`; citation cards `GetByRefsAsync(businessId, refs, ct)` (27-30) | n/a — isolation is inside the service (`BuildScopeFilter` 672 + `AssertScoped` 700 + per-row verification 302) | Business-only today. Read-only owner/admin/ops/dispatcher; upload/delete owner+admin (`voice.settings.manage`) |
| **Customers** (bonus — derived) | `customer.read` (None) | `WorkListNarrowing.For(tenant, "customer.read")` | `IBookingRepository.GetAssignedCustomerIdsAsync(businessId, narrowing, ct)` — `IBookingRepository.cs:40`; impl `BookingRepository.cs:485` (bounded by `Tenancy:WorkLists:MaxAssignedCustomerIds` = 500, `TenancySettings.cs:39`). Detail: `GetAssignedMembershipIdsForCustomerAsync` (441) then `BusinessCustomer.ToScopedResource(assigned)` (67-75) | `BusinessCustomer.ToScopedResource(businessId, assigned)` — 67-75 | Business → whole list; Assigned/Team → only customers on their own assigned work (`CustomerController.cs:218-237`; pinned by `CrossTenantAuthorizationTests.cs:245`) |

### 12.4 Where the answer is composed

- Attribute the tool's own writes (if any) through `IActorAttributionAccessor`
  (`ActorAttributionAccessor.cs:22-56`) — `CosmosDbRepository` stamps `createdBy*`/`updatedBy*` automatically
  on any `ProviderOwnedEntity` write (133-168). A tool running with no HTTP context inherits
  `ActorAttribution.None` and stamps nothing, which is a silent loss of attribution — hand it the actor
  explicitly if it writes.
- A refusal must be a **localized, structured refusal**, not an empty answer: reuse
  `TenancyErrorCodes.PermissionDenied` (17) / `ResourceOutOfScope` (19) / `BillingOnlyAccess` (22) so both
  clients' existing 403 handling (`apiClient.js:63-77`, `apiManager.tsx:83-121`) and the access-denied dialog
  fire unchanged.
- `MatchesNothing` is an **empty answer, never a refusal** (`WorkListNarrowing.cs:17-19`) — a technician with
  no assigned bookings has zero bookings, not an error.
- If the tool needs to expose "who" (an assignee name), the only sanctioned route is
  `WorkAssignmentDetailDto` / `InboxAssigneeDto` — every assignment and attribution field is
  `[System.Text.Json.JsonIgnore]` and must never be echoed into an AI answer verbatim
  (`ProviderOwnedEntity.cs:14-17`; guard `CosmosTenancyContractTests.cs:272`).

---

## 13. Differences found versus the previous draft of this file

### 13.1 The catalogue (the mandated re-verification) — `clinqetinfrastructure\Data\SQL\TenancyRoleCatalogDefinition.cs`

Last commit touching this file: **`dca0eba` "Add Invoice payment options"** (previous: `3fa9288`).
`git -C C:\Nik\clinqetinfrastructure diff 3fa9288..dca0eba -- Data/SQL/TenancyRoleCatalogDefinition.cs`
shows exactly three hunks, and nothing else in the file changed:

| # | Change | Old text said | Code now says |
|---|---|---|---|
| 1 | `CatalogVersion` | `3` (line 18) | ‼️ **`4`** (line 18) |
| 2 | Permission count | **92** | ‼️ **94** (machine-counted) |
| 3 | New key | — | ‼️ **`invoice.payment_methods.read`**, Module `Invoice`, `IsSensitive: true` (line **119**) |
| 4 | New key | — | ‼️ **`invoice.payment_methods.manage`**, Module `Invoice`, `IsSensitive: true` (line **120**) |
| 5 | Rationale comment | — | New at 117-118: "D-PERM: deliberately NOT billing.* — direct invoice instructions must stay independent of online-billing access and of the partner app's billingUiEnabled gate." |
| 6 | Role grant change | finance list ended `…invoice.delete, payment.read…` | ‼️ **`finance` gained both new keys at Business (line 280)** — the ONLY role whose hand-written grant list changed |
| 7 | Derived roles | owner 92 / administrator 90 | ‼️ owner **94**, administrator **92** — both derived from `everything` (184-192), so they picked the keys up with no edit |
| 8 | Every other role | ops_manager, sales_representative, dispatcher, technician, catalog_manager, contractor, read_only_auditor | ‼️ **byte-identical grant lists** — re-read key by key, no additions, no removals, no scope changes |
| 9 | `Permissions` array range | 49-174 | **49-178** |
| 10 | `Roles` range | 178-300 | **184-303** (`Roles` property at 180, `BuildRoles()` 182) |
| 11 | Invoice module | 6 keys, lines 111-116 | **8 keys**, 111-116 + 119-120 |
| 12 | Every module AFTER Invoice | — | **shifted +4**: Conversation 118-121→**122-125**, Customer 123-126→**127-130**, Review 128-130→**132-134**, Payment 132/133/134/137→**136/137/138/141**, Payout 139-141→**143-145**, Billing 142-143→**146-147**, Voice 145-149→**149-153**, Ai 151-152→**155-156**, Insights 154-155→**158-159**, Media 157-158→**161-162**, Team 160-166→**164-170**, NotificationPolicy 168-169→**172-173**, Audit 171→**175**, Ownership 173→**177** |
| 13 | Role line ranges | — | all **+4**: `everything` 180-182→**184-186**, administrator filter 186-188→**190-192**, owner ctor 192→**196**, admin ctor 193→**197**, ops_manager 195-211→**199-215**, sales_rep 213-224→**217-228**, dispatcher 226-237→**230-241**, technician 241-249→**245-253**, catalog_manager 254-265→**258-269**, finance 269-280→**273-285**, contractor 284-290→**289-295**, auditor 292-298→**297-303** |
| 14 | Helpers | `Business`/`Assigned` 302-306, `Merge` 308-310, `GrantsByRoleKey` 316-317 | **307-311**, **313-315**, **321-322** |
| 15 | `PermissionNameKey`/`RoleNameKey` | 39-47 | **39-45** (`Slug` at 47) |

**Consequences of the catalogue change that the old text could not have stated:**
- `SensitiveOperations` is **still exactly 7** (`SensitiveOperations.cs:10-19`) — the two new keys are
  `IsSensitive: true` in the catalogue but are **not** live-rechecked, so they run off the 60 s snapshot
  (§2.7). Live-auth sites remain **12** (line numbers in §2.7 moved, item 22 below).
- The keys are **not orphans**: five endpoints (`ProviderBillingController.cs:1143, 1169, 1201, 1235, 1270`)
  and a dedicated test file (`ProviderBillingInvoicePaymentMethodTests.cs:405-409, 444-445, 459-460`).
  The `KnownOrphans` registry is unchanged at 9 keys.
- Localization exists for both: `en.json:3269-3272`.
- **New money-permission fact for §10**: only owner, admin and **finance** may read or manage where invoice
  payments land. Nobody else, at any scope.
- Because the cache key embeds `CatalogVersion` (`AuthorizationSnapshotProvider.cs:44-45`), the bump to 4 is
  what made the new finance grant live on deploy rather than after a TTL.
- The five new endpoints sit on a class carrying `[AllowedWhenBillingOnly]`
  (`ProviderBillingController.cs:35`) and the filter reads that off `EndpointMetadata`
  (`RequiresPermissionAttribute.cs:88-89`), so they are reachable while a business is suspended. Benign
  today (only the primary owner gets a BillingOnly token) but now recorded.

### 13.2 Everything else that moved

| # | Item | Old text | Current tree |
|---|---|---|---|
| 16 | `[RequiresPermission(` site count | 261 lines / 37 files | **266 lines / 37 files** |
| 17 | SKILL.md length | 4,803 lines | **4,802** (`wc -l`) |
| 18 | API `Program.cs` | AddTenancyServices 706, AddTenancyAuthorization 713, UseAuthentication 1578, UseTenantContext 1582, UseAuthorization 1584, Consent 1588 | **711, 718, 1592, 1596, 1598, 1602** |
| 19 | Functions `Program.cs` | 354, 502, 503, 514 | **362, 510, 511, 522** |
| 20 | MCP `Program.cs` | comment 225-226 | comment **226**; `AddSystemActorAttribution()` **227** (unchanged) |
| 21 | `InvoiceController.cs` | list 71, detail 264, summary 302 (+314-318), earnings 724 (+746-751, 717-760, 722-723), `EnforceInvoiceScopeAsync` 213-230 | list gate **95** (action 91-131, narrowing 116-121), detail **288** (scope call 304), summary **326** (action 322-351, narrowing 338-340), earnings **756** (action 749-792, narrowing 778-780, TD-18 comment 754-755), `EnforceInvoiceScopeAsync` **237-258** |
| 22 | `ProviderBillingController.cs` | `payout.manage_account` live at 584, 614, 651; gate range 126-1746 | **587, 617, 654**; gate range **129-1939**; `[AllowedWhenBillingOnly]` at **35** |
| 23 | `InvoiceService.cs` | GetPaginatedAsync 310, GetSummaryAsync 316, GetEarningsGraphAsync 480 | **342, 348, 583** |
| 24 | `InvoiceRepository` paginated | "paginated 79" | method is **`GetPaginatedInvoicesAsync`** (line 79); interface `IInvoiceRepository.cs:19` |
| 25 | `CosmosDbRepository.cs` | `ApplyNarrowing` 58-71; attribution 137-166 | `ApplyNarrowing` **62-71**; `StampCreatedBy` **133-147**, `StampUpdatedBy` **152-168** |
| 26 | `TenancySettings.cs` | SnapshotCacheSeconds 147-154 | **153** (`MaxAssignedCustomerIds` 39, unchanged) |
| 27 | `ProviderInboxService.cs` | "24, 37, 48, 176-198, 187-198, 200-229" | const **24**, evaluator field **37**, ctor assignment **58**, `GetViewAsync` **68**, `IsVisibleTo` **179-182**, `NarrowingFor` **187-198**, `GetAssignmentTargetsAsync` **200**. ‼️ **Two more evaluator call sites the old text did not mention: 311-312 (over `InboxTabProjection`) and 605-606** |
| 28 | `MemberLifecycleService.cs` | ListMembersAsync 62-137, DisplayName 125, BuildDisplayName 993 | **61-137**, **124**, **978** |
| 29 | ‼️ Insights service type | "`IInsightsReadService.GetInsightsAsync(businessId, tier)`" | **`IInsightsReadService` DOES NOT EXIST.** The interface is **`ISmartAnalyticsReadService`** (`clinqetcore\Interfaces\Services\ISmartAnalyticsReadService.cs:11`); the controller field is merely *named* `_insightsReadService` (`AnalyticsController.cs:23`, ctor 31/43, call 82) |
| 30 | Insights endpoint gates | "`insights.read` Business, 54-84" | gate **59** — plus two gates the old text omitted: `Payments:Enabled && SmartAnalyticsEnabled` (**66-68**) and a per-business rate limit (**70-74**), with the tier resolved from `IEntitlementService.ResolveAsync` (**76-81**) |
| 31 | `AuthService.cs` claim stamping | 2984-2996 | **2986-2996** (BusinessId 2986, MembershipId 2987, AuthorizationVersion 2988, BusinessAccess 2990, BusinessRoles 2993) |
| 32 | `Cosmos.cs` Invoice | class 3246; `sentAt` 3346; PaymentInfo 3228-3241 (paidAt/amountPaid 3355-3356); assignment-freeze comment 3243-3245 | class **3263**; `sentAt` **3363**; `PaymentInfo` class **3228**, `paidAt` **3236**, `amountPaid` **3239**; freeze comment **3260-3262**. (Service 405, Availability 625, Quote 1603, BusinessCustomer 1753, Booking 2083, BroadcastProvider 2668, Conversation 2864 all unchanged) |
| 33 | `ProviderKnowledgeSearchService.cs` | "113, 131", "275-292", "303-308" | filter built **131**, asserted **132**; read-by-refs filter **291**, assert **292**, per-row verification **302**; `BuildScopeFilter` **672**, `linkedServiceIds` clause **687**, `AssertScoped` **700**; `ListRetrievableDocIdsAsync` calls **275, 370**, `ListRefSuppressedDocIdsAsync` **386**; repo methods **169** and **259** |
| 34 | Web `src/api/url.js` | BusinessAccessAPI 350; "business/members 355" | **BusinessAccessAPI 357**; the members constant is **`BusinessMembersAPI`** at **362** |
| 35 | Web `renderingRules.js` | SURFACE_PERMISSIONS 1165-1185, surfaceVisible 1193-1198, DASHBOARD_CARDS 1207-1218, surfaceAccessState 1232-1236, capabilityAccessState 1269-1273, serviceCatalogEditable 1278-1279, workAssignmentRowVisible 1310-1316 | **1168-1188** (still exactly 15 entries), **1196-1201**, **1210**, **1235-1238**, **1272**, **1281**, **1313**; `surfacePermission` **1190-1193**; `soloBusiness` **348** (unchanged) |
| 36 | Web `BusinessContext.jsx` | loadAccess 198-215, refreshAccess 229-233, can 326-329, accessKnown 375, solo 382, membershipId 383, isPrimaryOwner 384, useBusiness 429-435 | all confirmed. ‼️ **Two members the old text omitted: `reloadAccess` (221-224) and the roster subscription `onTeamRosterChanged(() => refreshAccess())` (237)** |
| 37 | Mobile `constant.tsx` | business_access 286, business_members 287 | **293, 294** |
| 38 | Mobile `BusinessProvider.tsx` | loadAccess 257-274, refreshAccess 288-292, can 390-393, solo 448 | all confirmed; `contextStale` declared **60**, state **91** |
| 39 | `OrphanPermissionRegistryTests.cs` | registry 44-88 | registry **42-92** (`TheOrphanPermissionList_IsExactlyWhatTheCodebaseSays` at **61**); **the same 9 orphan keys**, at 44, 53, 57, 62, 67, 73, 77, 83, 88 |
| 40 | `ProviderEndpointAuthorizationTests.cs` | listed 35, 49, 87, 100, 112, 153, 166, 181, 216, 329, 338 | all confirmed; ‼️ **the old §8 omitted `EveryMinimumScope_IsSatisfiableByAtLeastOneRole` (66)** and the two `NoAuthorizationPathFile/NoTenancyServiceFile_ReadsUserType` guards (130, 142) |
| 41 | `IProviderInboxService.cs` view enum | 48-58 | **48-59** |
| 42 | `BroadcastProviderController.cs` `lead.read` sites | 61, 91, 118 | **61, 91, 118 + 156** (a fourth Business-scope `lead.read` the old text did not list) |
| 43 | `CrossTenantAuthorizationTests.cs` | cases listed without a total | **33 test methods**; the old list omitted 336 (`ATokenWithABusinessIdButNoMembershipId_Is403`), 350, 362 (public Open Page) and 592 (`AnOperationsManager_IsNotRefusedByTheProviderGate`) |
| 44 | ‼️ §4 "Messages" row and §11 item 6 | "VERIFICATION IN PROGRESS … service layer being checked", member-scoped `?` | ‼️ **RESOLVED: NOT scope-checked, NOT permission-checked.** Full proof in §11.6 — including the two reasons no guard and no test catches it (`SharedEndpointProviderBranchTests.cs:130, 171`) and the fact that SKILL 1194-1196's two named cases exist in no test |
| 45 | ‼️ §4 legend "four work containers" | "The four work containers/paths that make member scoping possible" | There are **two**: **Transactions** (245-247) and **Communications** (460, 464, 465). ProviderData indexes none (8-55). The old phrasing counted paths as containers |

Unchanged and re-confirmed byte-for-byte at the current HEADs (no drift): `PermissionScope.cs:8-17`,
`TenantContext.cs:7-38`, `ScopedResource.cs:8-30`, `ResourceScopeEvaluator.cs:17-110`,
`WorkListNarrowing.cs:10-87`, `ProviderOwnedEntity.cs:1-68`, `ScopedResourceExtensions.cs:14-100`,
`TenantContextMiddleware.cs:34-90`, `RequiresPermissionAttribute.cs:19-149`,
`AuthorizationSnapshotProvider.cs:44-219`, `TenancyServiceRegistration.cs:49-64`,
`SensitiveOperations.cs:10-19`, `TenancyErrorCodes.cs:7-25`, `BusinessContextClaimTypes.cs:8-18`,
`CosmosContainerPolicies.cs:222/238/245-247/443/460-468/743`, `KnowledgeDocument.cs:10-93`,
`KnowledgeController.cs` all 15 gate lines, `BusinessMemberController.cs` all 13 gate lines,
`VoiceAssistantController.cs` all 21 gate lines, `BusinessBranch/Team/Activity/TeamInvitationController`
all gate lines, `BaseController.cs:195-437`, `CallContext.cs:5-18`, `McpToolGateway.cs:48-95`,
`BusinessContextController.cs:50-244`, `BusinessAccessSummaryDto` (`BusinessContextDtos.cs:91-111`),
`BusinessMemberDto` (`TeamManagementDtos.cs:8-38`), `InboxAssigneeDto` (464), `WorkAssignmentDetailDto` (495),
`BusinessMembership.cs:10-50`, `Business.cs:10-93`, `MembershipRelationshipType.cs:6-13`,
`ITenantContextAccessor.cs:7-12`, `IResourceScopeEvaluator.cs:7-10`, `TenantContextAccessor.cs:7-30`,
`NotificationHub.cs:219/301-338`, `BusinessAssignmentGuard.cs:20`, `BusinessAccessPolicy.cs:19`.
