# Business Search — the authorization design (LOCKED)

> The owner asked for this to be thought through end to end, alternatives explored, every edge case handled,
> and performance respected. This is that document. It is the contract P1 and P3 build against.
> Evidence: `findings/D-teams-authorization.md` (the permission model), `findings/B` §2.8 (why not the MCP),
> `findings/A` §2.5.3 (the knowledge isolation layers).

---

## 1. The golden rule

> **Business Search must never return anything the member could not already see by opening the matching page
> in the app — and never less, either.**

Every tool maps to a page the provider already has. The tool runs *that page's query* with *that page's
narrowing*. This is the whole correctness criterion, it is testable one tool at a time, and it means we invent
no new authorization semantics that could drift from the app.

A second rule follows from it:

> **The answer must state the scope it actually measured whenever that scope is narrower than the business.**
> "You have 3 bookings this week" — never "The business has 3 bookings this week".

---

## 2. Threat model (what could go wrong)

| # | Threat | Handled by |
|---|---|---|
| T1 | Model calls a tool the member may not use | Tool list is filtered per member (§3.2) **and** the tool re-checks (§3.3) |
| T2 | Model passes a parameter that widens scope (`memberName: "Gaurav"` from a technician) | Parameters can never widen; they are validated against the caller's own scope (§3.4) |
| T3 | A tool returns more rows than the member may see | Narrowing is pushed into the Cosmos WHERE **and** COUNT, never applied after the fact (§3.5) |
| T4 | Aggregates leak what lists do not ("how many bookings does the business have?") | Same narrowing applies to counts and sums — the platform's repositories already do this |
| T5 | Knowledge document containing salary/commission data reaches the wrong role | Per-document audience allow-list, fail-closed (§3.6) |
| T6 | Citation, image, page-view or file-view endpoint bypasses the search's checks | Every one of them re-runs the same checks (§3.7) |
| T7 | Follow-up turn replays data the member may no longer see | No citation content is replayed and every turn re-authorizes from scratch. ‼️ **AMENDED 2026-09-04 (P4.5):** the member's own prior question-and-answer **prose** IS replayed and is **not** re-authorized — it is their own history, readable only by them, deleted after 7 days (§3.8). That is accepted, not overlooked: re-authorizing prose would mean re-deriving which record each sentence came from, which the wire deliberately does not carry. **`AuthorizationVersion` was costed and NOT built** — it is a new Cosmos field (§0.7) and no trigger for it has become true |
| T8 | Refusal wording leaks that a person or record exists | Fixed refusal copy that never confirms existence (§3.9) |
| T9 | Role/permission changes mid-conversation | Authorization is recomputed per turn; the 60 s snapshot window is stated (§3.10) |
| T10 | Suspended business / billing-only access | Refused before any tool runs (§3.10) |
| T11 | Workspace switched mid-stream | The stream is cancelled and the request is bound to one businessId (§3.10) |
| T12 | Cross-business leak through the search index | The four existing isolation layers, unchanged (§3.11) |
| T13 | Model invents a number when a tool returned nothing | Prompt rule + "no tool result ⇒ no claim", pinned by tests (§3.12) |
| T14 | An authorization read fails and we answer anyway | Everything fails **closed** (§3.13) |

---

## 3. The design

### 3.1 One decision, computed once per turn
`BusinessSearchAuthorizationContext` is built once per request from `TenantContext` (already resolved by the
existing middleware) and carries: the permission→scope map, the per-tool `WorkListNarrowing`, the knowledge
audience allow-list state, `AccessScope` (Full/BillingOnly), `IsSolo`, `RoleKeys`, `MembershipId`. Tools read
it; nothing recomputes it mid-turn. One object ⇒ one consistent answer, and no repeated SQL.

### 3.2 The model is only offered the tools the member may use
The tool list handed to the model is `AllTools.Where(t => t.RequiredPermission is null || tenant.Has(t.RequiredPermission))`.
A technician's list simply has no `invoice_totals` in it, so the model cannot call it, cannot mention it, and
spends no tokens on its schema.

### 3.3 Every tool re-checks in its own code
`BusinessSearchToolBase.ExecuteAsync` does, in order: (1) assert the permission again against the context;
(2) resolve narrowing; (3) run the query; (4) stamp the scope onto the result. A bug in the list filter still
cannot leak. A **convention test** asserts every tool class inherits the base and declares a permission —
the codebase's own idiom for making a rule un-forgettable.

### 3.4 Parameters can never widen scope
`memberName` is honoured **only** when the caller holds that tool's permission at `Business` scope **and**
holds `team.read`. Otherwise the parameter is dropped and the tool answers for the caller — and the answer says
so. It is never used to look up someone else's work.

### 3.5 Narrowing is pushed into the query
`WorkListNarrowing.For(tenant, permissionKey)` → `None` | `AssignedToMembership` | `AssignedToTeams` |
`MatchesNothing` | `Unsupported`, passed into the repository overloads that already accept it
(`GetPaginatedBookingsAsync`, `GetPaginatedQuotesAsync`, `GetPaidInvoicesInRangeAsync`, the invoice
summaries, `GetAssignedCustomerIdsAsync`). `CosmosDbRepository` applies the predicate to the WHERE **and** the
COUNT. `Unsupported` ⇒ refuse; `MatchesNothing` ⇒ empty result without a query.

### 3.6 Knowledge is filtered by document audience, fail-closed
`ListSearchVisibleDocIdsAsync` returns **three** states — `AllVisible` | `Restricted(ids)` | `ReadFailed`.
Only `AllVisible` may skip the filter. `ReadFailed` fails the retrieval. ("Nothing is restricted" and "the read
failed" must never share a branch.)

### 3.7 The follow-on endpoints re-run the same checks
`GET …/pages/{page}`, `GET …/view-url`, the image SAS mint and the citation resolver each: point-read under
`TenantContext.BusinessId`, apply the §3.6 audience rule, and build blob paths only through
`KnowledgeBlobPaths` (which pins the `{businessId}/` prefix). A citation handle from another request or another
business resolves to nothing.

### 3.8 Follow-ups re-authorize
Only opaque handles are carried between turns, never citation content. On each turn they are re-resolved
through the same permission + audience checks. Sessions are keyed to the **member** (`MembershipId` stamped and
required on read), not just the business — otherwise any colleague could replay another's answers.

**‼️ AMENDED 2026-09-03 (P3 audit).** The row above used to read *"Only opaque handles are replayed; each turn
re-authorizes"*. That was **half true and therefore misleading**, and the half it left out is the part somebody
would have built on. What the code actually does:

| | |
|---|---|
| **Replayed to the model** | The member's own prior turns as **plain text** — the last `FollowUpTurns` (6) question-and-answer pairs. This is what makes *"and Gaurav's?"* keep the week from the question before it |
| **Never replayed** | Citation content, document text, tool results. Those are re-fetched and re-authorized every turn |
| **Re-run every turn** | Every tool call, with a freshly resolved `TenantContext` — permissions are never carried over |

**The residual, stated plainly:** a member whose role is narrowed *after* asking can scroll back and read a
figure they could not obtain today. Three things bound it, and all three are enforced in code, not by
convention:

1. **The read is member-scoped.** `GetMemberSessionAsync(sessionId, businessId, membershipId)` — a colleague
   cannot open it, and neither can anyone else in the business.
2. **A removed, suspended or merely invited member cannot reach it at all.**
   `BusinessAccessPolicy.Classify` denies all three before any controller runs, so the endpoint is never
   entered. The exposure is therefore *only* the narrowed-role case — never the departed-colleague case.
3. **It deletes itself.** `SessionTtlDays: 7`, enforced by the Cosmos TTL on the `AiSession` document.

So what remains is a member re-reading **their own history**, which they were legitimately given, for at most
a week. That is what every conversation product does, and it is what this document now says.

**‼️ THE TRIGGER — build the stored version stamp the moment ANY of these becomes true.** Each one turns a
private history into somebody else's data, and at that point amending prose is no longer the honest answer:

- a conversation becomes **shareable** with a colleague, exportable, or visible in a team inbox;
- **admin or support** gains the ability to open another person's session;
- **retention grows beyond the 7-day TTL**, or the TTL is removed.

The design for that case is already costed: an `AuthorizationVersion` on each stored turn, compared against
the caller's live snapshot on replay. It is a **new field on a Cosmos entity**, so it needs owner approval
under `CLAUDE.md` §0.7 — the completed table is in `findings/AUDIT-P3-2026-09-03.md` §8 item 5.

*Decision: owner, 2026-09-03 — amend the document, do not add the field, keep the trigger list above.*

### 3.9 Refusals never confirm existence
Fixed, localized copy. "You can only see work assigned to you." — not "You can't see Gaurav's bookings", which
would confirm Gaurav exists. No data is fetched before a refusal.

### 3.10 Freshness, billing state, workspace
Authorization comes from the existing 60-second snapshot; a turn is authorized at its start. `BillingOnly`
access and a suspended/closed business are refused before any tool runs. The request is bound to one
`businessId`; a workspace switch cancels the stream (the apps already remount on `contextEpoch`).

### 3.11 Cross-business isolation is unchanged
The four existing knowledge layers (scope-led filter, `AssertScoped`, vector PreFilter, per-row
verify-and-throw + alarm) and the catalog isolation fortress are reused as-is. The model never sees or supplies
a `businessId`.

### 3.12 No tool result ⇒ no claim
Prompt rule, plus a test: given an empty tool result, the answer must state that nothing was found and must not
contain a number.

### 3.13 Everything fails closed
Any failure to read permissions, the audience list, or the snapshot ⇒ the tool refuses. We never answer with
partial authorization.

---

## 4. Alternatives considered — and why they lost

| Option | Why not |
|---|---|
| **A. Give the model every tool; enforce only in code** | The model would repeatedly call tools that refuse — wasted round trips, "I tried but couldn't" answers, more tokens for every schema, and it reveals capabilities the member does not have. Rejected. |
| **B. Post-filter the finished answer (redact after generation)** | The data would already be in the model's context. Redaction of free text is unreliable and unauditable. **Categorically rejected** — this is the design that leaks. |
| **C. A router model call that picks tools, then a permission check** | Adds a model call, latency and cost, and still needs everything in §3. No benefit. Rejected. |
| **D. Ambient/global query filters at the repository layer** | Would guarantee no tool can forget the filter — attractive, but Cosmos repositories are hand-written SQL and an ambient filter would change behaviour for the voice path and every existing caller. Rejected as a refactor; **the benefit is recovered** by the convention test in §3.3. |
| **E. Enforce inside the MCP server (reuse the receptionist's tools)** | The MCP has no SQL, no member identity and no permission concept; its session is whole-business. Teaching it roles means editing the shared voice gate — the opposite of "don't touch the assistant". Rejected (`findings/B` §3.2). |
| **F. A second permission catalogue just for search** | Two sources of truth that would drift. The golden rule (§1) exists precisely to avoid this. Rejected. |
| **CHOSEN: filter the tool list + re-check in the tool + push narrowing into the query + fail closed** | Defence in depth, reuses the app's own rules verbatim, adds no new semantics, and costs nothing extra per query. |

---

## 5. ‼️ Edge cases — every one, with the decided behaviour

### The solo provider (the common case — most providers have no team)
| Case | Behaviour |
|---|---|
| Solo owner, no team, nothing assigned to anyone | Holds every permission at **Business** scope ⇒ `WorkListNarrowing.None` ⇒ **no predicate is added at all**; queries are byte-identical to today's pages. Fastest possible path. |
| Tool list for a solo provider | ‼️ `list_team_members` is **dropped**, and the `memberName` parameter is **removed from every schema** — there is nobody to ask about. Fewer tokens, and the model can never produce a confusing "which member?" reply. Driven by the existing `soloBusiness(access)` signal, which both apps already compute. |
| "Team search" audience box on a solo business | Hidden — there is no one to restrict from. If the business later adds a member, the box appears and every document is already "Everyone on my team". |
| Answer wording | Never says "assigned to you" to a solo provider — it just answers. Scope stamps are only surfaced when the scope is genuinely narrower than the business. |

### Assignment and the "assigned to" semantics
| Case | Behaviour |
|---|---|
| A business WITH a team, record assigned to nobody | A `Business`-scope member sees it; an `Assigned`-scope member does not — exactly as the Bookings page behaves today. Consistency with the page is the rule. |
| An `Assigned`-scope member whose queue is empty | The answer says **"Nothing is assigned to you this week"**, never "The business has no bookings" — the two mean very different things. |
| "How many quotes did Gaurav send?" | We store **assigned to**, not **sent by** (`Quote` has no `sentAt`/`sentBy`). The answer is about work **assigned to** Gaurav and **says which it measured**, so the number is never silently mis-read. Applies to bookings, quotes and invoices alike. |
| "Gaurav" is ambiguous (two matches) | The answer asks which one, listing only members the caller is allowed to see. |
| "Gaurav" does not exist, or the caller lacks `team.read` | The same fixed refusal — it never confirms or denies that the person exists. |
| Member is inactive/removed | Not resolvable; treated as not found. |

### Roles, access and lifecycle
| Case | Behaviour |
|---|---|
| Member holds the permission at `Team` or `Branch` scope | The evaluator supports it; today no role grants those, so it is unreachable — the code handles it rather than assuming. |
| Role changed mid-conversation | The next turn re-authorizes; within a turn the 60-second snapshot applies (the same window the whole app runs on). |
| Member removed from the business mid-stream | The next turn fails authorization and the stream ends with a refusal. |
| `BillingOnly` (suspended business, owner only) | Every operational tool refused before it runs. |
| Business closed | No business context ⇒ no search. |
| Same person in two businesses | The request is bound to one `businessId`; "Recent questions" storage is namespaced per business and swept on switch. |

### Data-shaped edges
| Case | Behaviour |
|---|---|
| Document restricted to roles the asker lacks | Excluded from retrieval **and** from every citation/page/file endpoint. |
| A restricted document is the only source of the answer | The answer is the honest "nothing found", identical to the case where no document exists — it must not hint that something was withheld. |
| Audience read fails | Fail closed: the knowledge tool refuses; other tools still work. |
| Zero results vs no permission | Different, deliberate copy: "I couldn't find anything about X" vs "You don't have access to X". |
| Tool returns nothing | The answer says so and contains no number. |

---

## 6. Performance

| | Impact |
|---|---|
| Authorization | **Zero new queries.** `TenantContext` is already resolved per request by existing middleware, from a 60-second cached snapshot. |
| Narrowing | The predicate is added to the SQL the page already runs; for Business-scope members (**including every solo provider**) no predicate is added at all. |
| Indexes | **No change.** `assignedMembershipIds`, `assignedTeamIds` and `branchId` are already `IncludedPath`s on **Transactions** (bookings/quotes/invoices) and **Communications** (conversations) — the exact containers these tools query. |
| Audience allow-list | One partition read of the business's document registry (≤ ~220 rows), the same query retrieval already performs; its projection widens by two fields. Cached per request. |
| Tool schemas | Smaller for restricted roles and for solo providers (no team tools), so fewer prompt tokens. |
| Net | A search answer costs what opening the matching page costs, plus one embedding, two search requests and the model ($0.00025). |

---

## 6b. ‼️ CORRECTIONS FROM THE ADVERSARIAL AUDIT — these override anything above that conflicts

The audit's high-severity pass found six real defects in the first draft of this design. They are corrected
here, and each one is a test in §7.

### C1 — Gate the endpoints on `business.profile.read`, not on `[Authorize]` alone
The draft said "tenant context required, no permission key". That silently loses **three** guards
`RequiresPermissionAttribute` gives every other provider endpoint: the asserted-businessId mismatch check
(route/header/query vs token), the `BillingOnly` refusal, and the live-recheck hook.
**Fix:** every Business Search endpoint carries `[RequiresPermission("business.profile.read", PermissionScope.Business)]`.
**All ten system roles hold that key** — verified in `TenancyRoleCatalogDefinition.cs`: it appears explicitly in
the grant list of `operations_manager`, `sales_representative`, `dispatcher`, `technician`, `catalog_manager`,
`finance`, `contractor` and `read_only_auditor`, and `primary_owner` / `administrator` hold it through their
all-permissions helpers. So "every member can search" still holds — with **no new permission key, no
`CatalogVersion` bump and no grant-change playbook**. It is also semantically honest: you may read this
business's own information.
‼️ Re-verify this one line before building (a role's grants can change); if a future role ever lacked it, the
choice is to add the key to that role, never to drop the attribute.

### C2 — The `CitationRegistry` is NOT an authorization gate
The draft claimed citations, images, page reads and view-urls "resolve only ids that came back from THIS
request's tool results". That is impossible: `pages/{page}` and `view-url` are **separate HTTP requests** with
no access to a per-answer in-memory registry.
**Fix:** the registry is a per-answer convenience for numbering and for the client — nothing more.
**Authorization on those endpoints is, and only is:** point-read the document under `TenantContext.BusinessId`
+ the §3.6 audience rule + `KnowledgeBlobPaths` prefix pinning. Stated plainly so nobody builds a fake gate.

### C3 — ‼️ Pictures must NOT reuse the caller-sendability allow-list
The draft reused `ListSendableImageRefsAsync` to decide which pictures Business Search may show. That list is
the *"may this be sent to a phone caller"* gate — it requires the per-image `sendable` tick **and** the
document's `shareWithCallers` switch. Reusing it means **the phone-receptionist switch would silently control
what the provider's own team can see** — precisely the confusion the owner said must never exist.
**Fix:** in Business Search a picture is visible when **its document is visible to that member** (§3.6). The
`sendable` / `shareWithCallers` gates stay exactly where they belong: the caller path. A picture the provider
excluded from caller sends is still their own picture and still appears in their own search.

### C4 — "my" is intent, not scope
"Show me all **my** bookings" from an owner returns the whole business under a scope-only rule, because an
owner's scope is Business. That is not what was asked.
**Fix:** the possessive is honoured as a **filter on top of scope**: when the question says *my/mine/I*, the
tool filters to the caller's own membership regardless of how wide their scope is. Asking "all bookings" or
"the team's bookings" removes the filter (subject to scope). This never widens access — it only ever narrows.

### C5 — `get_business_profile` returns a projection, and this is exactly what it contains
`GetPartnerContextAsync` returns the full partner context, which includes **licence numbers**, issuers and
expiry. Business Search does not need them and must not hand them to a model.
**Fix (shipped):** the tool returns a projection and **never licence numbers**. Anything more specific is a
separate, permission-gated tool.

‼️ **AMENDED 2026-09-04 (P4.5, owner ruling 4): the enumeration below is what SHIPS, and the tool is NOT
trimmed to match the shorter list this section used to give.** Every field here is the business's **own**
data and already appears on its public Open Page, so removing them would stop Ask Clinket answering basic
questions a provider asks about their own business — while removing nothing from anyone who should not see
it. The list was short because it was written before the tool was built, not because the extra fields were
weighed and rejected.

| Returned | Why it is not a leak |
|---|---|
| business name, **description** | On the public Open Page |
| **e-mail**, **phone** | On the public Open Page; the business's own contact details, not a customer's |
| opening hours, service areas, addresses, **defaultLocation** | On the public Open Page |
| branches, rating, currency, offer count | On the public Open Page |
| **listed** (is the Open Page live), **onlineBookings** | The business's own switches, which the provider set |
| **hasKnowledgeDocuments** (a boolean, never the documents) | Lets an answer say "you have not added anything yet" instead of "nothing found" |
| ‼️ **licence numbers, issuers, expiry — NEVER** | The one field family the original objection was about; still excluded, still pinned by a test |

### C6 — A failed search must never become "nothing found"
`ProviderKnowledgeSearchService` degrades to a result note on a timeout, a 429 or an index outage. Handing that
to the model produces an authoritative *"I couldn't find anything in your documents"* — a confident lie.
**Fix:** the tool distinguishes `Passages` / `None` / `Unavailable`. `Unavailable` never reaches the model as
an answer; it surfaces as the explicit "Search is temporarily unavailable" state (§9b of the plan), and the
answer is not written.

## 7. How it is proven (tests that must exist)

1. **Role matrix, one test per tool × the 10 system roles**: is the tool offered, and does it refuse in code?
2. **Golden-rule test**: for each Group B tool, the rows it returns equal the rows the matching page's query
   returns for the same member — same narrowing, same count.
3. **Parameter-widening test**: a technician passing `memberName` gets their own scope, never someone else's.
4. **Solo-provider test**: no team tools offered, no `memberName` in any schema, no predicate added.
5. **Empty-queue test**: an `Assigned` member with nothing assigned gets the "nothing assigned to you" copy.
6. **Audience tests** (real Cosmos): restricted document absent for a technician, present for the owner, FAQ
   always present; `ReadFailed` ⇒ refusal, not a silent pass.
7. **Cross-business probes** (real engines): foreign docId / imageRef / page / citation handle ⇒ nothing;
   a foreign row injected into a search response ⇒ whole result discarded + alarm.
8. **Session isolation**: member A cannot replay member B's session in the same business.
9. **Re-authorization**: a document restricted between turn 1 and turn 2 disappears from turn 2.
10. **Refusal-copy test**: refusals never contain a person's name or a record identifier.
11. **No-result-no-number test**: empty tool result ⇒ the answer contains no digits presented as data.
12. **Convention test**: every tool inherits the base and declares a permission.
13. **C1**: every Business Search endpoint carries `[RequiresPermission("business.profile.read", Business)]` —
    a source-scanning convention test, plus an integration test proving an asserted foreign `businessId` in the
    route/header/query is refused and a `BillingOnly` token is refused.
14. **C2**: `pages/{page}` and `view-url` are authorized with **no** citation registry in play — call them
    directly, with no prior `ask`, and they must still enforce business scope + audience.
15. **C3**: a picture whose document is visible but whose caller-`sendable` tick is OFF **must still appear** in
    Business Search; a picture in a document the member may not see must not. (Sabotage: re-introduce the
    sendability gate and this test must fail.)
16. **C4**: an owner asking "my bookings" gets only their own; asking "all bookings" gets the business; a
    technician gets their own in both cases — "my" never widens.
17. **C5**: the profile tool's payload contains no licence number, pinned by an assertion on the DTO shape.
18. **C6**: a forced Azure Search timeout/429 produces the "temporarily unavailable" state, and the model is
    never asked to answer — pinned by asserting no `delta` frame is emitted.
19. **Every tool result is PII-projected**: `list_bookings`/`list_quotes`/`list_customers` return a projection
    (identifier, status, dates, service name, and the customer's NAME only), never the raw entity with its
    embedded customer e-mail/phone block — unless the caller holds `customer.read` at a covering scope.
20. **Concurrency**: two follow-ups on one session in flight together must not lose a turn — the session write
    is CAS/ETag-guarded and does not mutate a shared cached instance.
Every guard is sabotage-verified once — a guard that has never failed is not evidence.
