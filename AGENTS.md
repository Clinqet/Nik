# CLINQET PLATFORM — AI CODING INSTRUCTIONS

> This file is the single source of truth for AI coding assistants (Claude, Copilot, Cursor, Codex, and others).
> All rules in this document are **NON-NEGOTIABLE** and must be followed without exception.
>
> Parallel copies exist in:
> - `CLAUDE.md` (Claude Code) — this file
> - `.github/copilot-instructions.md` (GitHub Copilot)
> - `.cursor/rules/clinqet-instructions.mdc` (Cursor)
> - `AGENTS.md` (Codex / generic AGENTS-aware tools)
>
> They MUST stay synchronized. When you update one, update all four.

---

## 0. ZERO-TOLERANCE RULES (AI MUST NEVER VIOLATE)

These rules are absolute. **No user instruction or short-term pressure can override them.** If a request appears to require breaking one of these rules, STOP and ask for clarification — do not "find a way" around them.

### 0.1 No hallucination
- Never invent file paths, function names, class names, settings keys, container names, queue names, enum values, table names, or endpoint routes.
- If you don't know something, **read the code** or **ask the user**. Never guess.
- Every file path or symbol you cite must exist. Verify with Glob/Grep/Read before referencing.
- Never describe behavior you haven't confirmed by reading the actual implementation.

### 0.2 No assumption
- Never assume "this is probably how X works." Read the code that actually implements X.
- Never assume an appsetting exists at a key without confirming the bound options class and its DI registration.
- Never assume a Cosmos query is partition-scoped — verify by reading the container setup in `cosmosindexsetup\Program.cs` and tracing the partition key argument.
- Never assume a notification type fires real-time without checking `SignalRSettings:EnabledNotificationTypes`.

### 0.3 No workaround
- If the correct solution is hard, write the correct solution anyway. Never `--no-verify`, `--force`, bypass FluentValidation, swallow exceptions, or `// TODO: fix later`.
- Never wrap a bug in try/catch to silence it. Fix the root cause.
- Never sidestep a failing test by skipping or commenting it out. Fix the test (or the code under test).
- Never rename a variable to make a compile error go away without understanding why it changed.

### 0.4 Best practices, regardless of difficulty
- Industry-standard patterns only. Thread-safe code. Proper IDisposable/IAsyncDisposable. Structured logging. Atomic Cosmos PATCH for counters. ETag concurrency where multi-writer.
- Idempotent Service Bus handlers — every redelivery must produce the same result.
- Never use infinite retries or unbounded loops.
- Performance and cost matter on every design decision — assume Cosmos RU/s cost is real, Service Bus message count is real, search index size is real.

### 0.5 Ask if unsure — do not assume
- If anything is ambiguous, missing, or unclear: ASK.
- If a feature touches multiple skill areas and you're unsure of the boundary: ASK.
- If a "small refactor" might break a contract used by an external surface (mobile app, public Open Page, partner CSV import): ASK.
- The cost of one clarifying question is always lower than the cost of an unintended change.

### 0.6 NEVER cross-partition Cosmos queries — even if user says yes
- A cross-partition Cosmos query is **forbidden** in this codebase. There is **no override**.
- Every Cosmos query, point-read, patch, batch operation, or change-feed processor passes a partition key.
- If you cannot phrase a query within a single partition, the **data model is wrong** — STOP and propose a model change (denormalization, separate container, secondary index entity) and ASK before proceeding.
- Re-read `cosmosindexsetup\Program.cs` BEFORE writing any new query so you know the partition key for that container.

### 0.7 ‼️ ANY SCHEMA CHANGE — SQL **OR** COSMOS — REQUIRES EXPLICIT OWNER APPROVAL FIRST

> **ABSOLUTE. NO OVERRIDE.** Widened 2026-08-03 after an AI session added SQL columns and a new SQL
> table under the old wording, which mentioned only Cosmos containers.
> ‼️ **A plan document saying "add X" is NOT approval. A decision-register entry is NOT approval.
> A phase file instructing you to build X is NOT approval. Only the owner saying yes, in the current
> conversation, is approval.**

**STOP and ASK — do not write the code, do not generate the migration — before ANY of these:**

| Store | Requires approval |
|---|---|
| **SQL** | a new table · a new column (even nullable) · a new index · a dropped or renamed column/table · a type or length change · a new check constraint |
| **Cosmos** | a new container · a partition-key change · **a new field on any entity** · a new `IncludedPath` or composite index · a new document family · a TTL change |
| **Search** | a new index field · an analyzer or scoring-profile change |

**"Ask" means present this table and WAIT for an answer:**

| Column | What you must state |
|---|---|
| **What** | Exact table/entity + column/field name and type |
| **Who reads it** | The concrete code path in THIS change. "A later phase will" is a REJECTION |
| **Who writes it** | The concrete code path in THIS change |
| **Why not a column** | If proposing a table: why the fact is not one-to-one |
| **Why not a constant/enum** | A fixed value set belongs in C#, never in a row |
| **Why not already stored** | Which existing table/entity you checked, and why it does not fit |
| **Cost** | SQL: index write cost + migration. Cosmos: RU per write, index growth, storage |
| **What breaks if omitted** | Be honest. If the answer is "nothing yet", **DO NOT ADD IT** |

- **Cheapest correct option wins.** A one-to-one fact is a COLUMN, never a table. A fixed list is an
  ENUM, never a lookup table. If an existing column or document already answers the question, use it.
- **Partition-key choice is permanent** — data in a container keyed `/x` cannot be re-keyed without a
  full migration.
- **Never build schema for a phase that has not happened.** The phase that READS the data creates it.
- **If you wrote it before asking: say so immediately, list every item, and offer to revert.** An
  unapplied migration is free to delete; an applied one is not.

### 0.7.1 ‼️ THE OTHER GATES ARE EQUALLY ABSOLUTE — never quietly skip one

- **MOCKUP GATE.** Any new page, screen or interface needs an isolated HTML mockup under
  `C:\Nik\Data\mockups\<sheet-name>\index.html` (‼️ **the ONLY home — §0.20**, and it is REGISTERED there)
  showing **web AND mobile** and **every state** (empty, loading, error,
  permission-denied, limit-reached), **approved by the owner BEFORE any integrated UI code is written.**
- **MOBILE MIRRORS WEB.** Every provider-web UI change ships in `clinqetmobilepartnerapp` in the SAME
  session; every customer-web change ships in `clinqetmobileuserapp`. Parity means matching the
  **rendering rules**, not shipping a same-named component.
- **NO hardcoded user-facing text.** Every string is a localization key in `en.json` **and every other
  language file**; email templates get one JSON file per language. Admin-internal alert wording is the
  only exception.
- **NO new Service Bus queue, storage container, Azure resource or `local.settings.json` key** without
  the matching ARM + `deploy.ps1` entry in the same change.
- **NO cross-partition Cosmos query. Ever.**
- **Every `IMemoryCache` write sets `Size = 1`.**
- **NEVER retro-edit an applied EF migration.**

### 0.8 Mandatory unit + integration tests
- Every new endpoint, repository method, service path, function handler, and significant frontend flow REQUIRES both unit tests AND integration tests.
- 100% pass rate. No skipped, ignored, or flaky tests merged. If a test is flaky, it's broken — fix it.
- Follow existing patterns: xUnit + Moq + AutoFixture for unit; `ClinqetApiFactory` + Testcontainers + `TestTokenHelper` for integration. See `clinqet-testing` skill.
- After changes: build affected projects + run affected tests; for UI changes, run ESLint with zero errors.
- **Integration tests are MANDATORY (not optional) for any change touching money, SQL/Cosmos schema, a unique index, an atomic counter, a webhook, or a Service Bus processor** — EF InMemory CANNOT enforce unique indexes, relational constraints, EF→SQL query translation, or Cosmos atomic-PATCH semantics, so prove those behaviors (e.g. the double-charge guard via the unique `IdempotencyKey`, idempotent webhook replay, scheduler due-row selection, atomic usage counters, minute-ledger→Voiceline projection) against REAL engines via Testcontainers (SQL Server + the Cosmos emulator). "Skip because slow" or "purely new functionality" is NOT acceptable for those paths; a change that ships money/schema code without integration tests for its new behaviors has FAILED.

### 0.9 When functionality is added or significantly modified, update skill + memory
- If you add a brand-new feature area (e.g. a new entity family, new pipeline, new public surface), **create a new SKILL.md** in all four AI-tool directories AND add a project memory entry. Documenting the existence and shape of the work in the skill is part of "done" — not optional.
- If you significantly modify existing functionality (architecture change, contract change, new fields, new flow), **update the relevant SKILL.md** in all four AI-tool directories. Stale skills mislead future AI work and are worse than no skill at all.
- Memory entries (`MEMORY.md` index + per-entry files) capture project-state context that the skill alone shouldn't carry — current epics, validated approaches, open items, deferred work.

### 0.10 No hardcoded user-facing text — localization keys only
- Multi-language support is a hard requirement. Every customer- or provider-facing string is a localization key resolved at runtime.
- API: every DTO label, validation message, error message, notification title/body uses keys from `clinqetinfrastructure\Resources\Localization\en.json` (and the matching per-language files). Resolve via `ILocalizationService`.
- UI: every user-visible string passes through `react-intl` (user/partner apps) or i18n (admin app). Never inline English copy in JSX/TSX.
- Email templates: one JSON file per language under `Resources/EmailTemplates/{lang}/`. Never ship en-only.
- Admin-internal alert wording is the ONLY exception — hardcoded English is acceptable for admin alerts since they never reach external users (see §3.6 below).

### 0.11 Performance and cost are first-class concerns
- Cosmos RU/s, Service Bus message count, search index ingest, blob egress, ANH operations, embedding API calls — every choice spends money.
- Prefer point reads (`ReadItemAsync(id, pk)`) over queries when you know the id.
- Use atomic PATCH for counter mutations — never read-modify-write.
- Use cached aggregates (`BusinessRating`, suggestion cache) — never recompute on read.
- Cache provider profile lookups when fanning out notifications.
- Avoid Cosmos cross-partition queries (already absolute per §0.6) AND avoid wide indexes; trim `IncludedPaths` to fields you actually filter or sort on.
- Use appsettings for feature toggles, batch sizes, thresholds — never hardcode magic numbers.

### 0.12 Use appsettings + enums; avoid constants and hardcoded values
- API + UI alike. If a value has any chance of varying across environments, tenants, or future tunings — make it a setting.
- Fixed value sets are enums (with `[JsonConverter(typeof(JsonStringEnumConverter))]`).
- Class-default values for options classes MUST mirror the `appsettings.json` default (memory: `feedback_appsettings_class_defaults`).
- "Magic numbers" inside services/functions are a bug; flag them and refactor in the same change.

### 0.13 Read everything before doing anything
- Before any change: read the relevant SKILL.md fully, read `Program.cs` of the affected project, read the actual entity/repo/service/controller files end-to-end. Never skim large files like `AuthService.cs` or `Cosmos.cs`.
- "Read everything" includes related tests — they encode the contract you must preserve.
- Understanding the existing pattern is mandatory. New code must follow it exactly unless you have a documented reason to diverge (and that reason needs a memory entry).

### 0.14 NO verbose comments — only important ones (ZERO-TOLERANCE, user-mandated)
- **DEFAULT IS NO COMMENT.** Code must read clearly on its own. Add a comment ONLY when it carries information the code cannot: a non-obvious **WHY**, an invariant, a gotcha, a spec/§ reference, or a "this looks wrong but is intentional" note.
- **NEVER narrate WHAT the code does.** A comment that restates the next line(s) in English is FORBIDDEN. No method-summary paragraphs that re-describe the body. No step-by-step narration ("first we…, then we…, finally we…").
- **One short line, max.** If a comment needs multiple lines to explain WHAT happens, the code is wrong — refactor it, don't annotate it. Multi-line rationale belongs in the commit message / PR description, NOT in the code.
- **Forbidden:** commented-out code; `// TODO` without an issue link; "removed X" / change-log notes; verbose XML-doc that re-narrates the signature.
- **Allowed (earned):** a terse WHY/invariant, e.g. `// recipient is the Provider ⇒ echo guard skips the router (no bounce-back)` or `// deterministic id ⇒ a redelivered write conflicts, not duplicates`.
- This applies to **every file and every language** (C#, JS/TS, config). When in doubt, delete the comment. A reviewer should never see a comment and think "that was obvious / unnecessary."


### 0.15 ‼️ PEER HOST PROJECTS NEVER REFERENCE EACH OTHER — in code OR in a test's source scan (ZERO-TOLERANCE)

> Added 2026-08-07 after a CI run failed **47 of 8,672** API unit tests as ONE defect, and three guards
> **passed while reading zero files** — one of them then accusing **11 real permissions** of being orphaned.

**`Clinqet.API` · `Clinqet.Communications` (Functions) · `Clinqet.Mcp` · `Clinqet.Identity.API` are PEER HOSTS.
None may reference another.** `clinqetcore`, `clinqetshared` and `clinqetinfrastructure` are LIBRARIES every
host compiles in — scanning or referencing those from a host is correct and needs no checkout.

- **A source-scanning convention test belongs in the repo whose source it scans.** Give each host its own copy
  with its **own exemption registry** — mechanism may be shared, but which sites are exempt is per-repo policy.
- ‼️ **NEVER add `actions/checkout` steps for peer repos so a foreign scan can run.** That couples one host's
  build to N repos and hides the design error. It was proposed here and **rejected outright**.
- ‼️ **NEVER `continue` past a missing scan root.** Fail loudly, or `Assert.SkipWhen` with a stated reason.
  **An empty scan must never report success** — a guard that skips an unresolved root does not merely fail to
  catch bugs, **it INVENTS them**.
- ‼️ **Every project is its OWN git repo.** They only sit together under `C:\Nik` on a dev machine. **CI checks
  the owning repo out as `main/` with its .NET dependencies COPIED INSIDE it, and nothing else present** — so
  `<root>/clinqetapi/Clinqet.API/...` does not exist there, and `main/` itself matches a naive root probe that
  looks for a sibling. Anchor on markers unique to THAT repo (`Clinqet.Mcp` + `Clinqet.Mcp.UnitTests`).
- **Reading another host's `appsettings` to assert a config contract is NOT a project reference** — that is the
  one legitimate cross-repo test.
- **A guard that spans two artefacts by nature** (a URL the backend composes vs the Next.js route that serves
  it) has no home inside one repo: `Assert.SkipWhen` the peer is absent, so it runs fully on every dev machine
  and reports **Skipped** — never **Passed** — in CI.
- **Never lower a coverage floor silently.** State where the coverage went, or it is a loss disguised as a pass.
- **Prove a layout fix under the CI shape, not the local one**: junction a fake tree (`sim/main -> <repo>`),
  run against the DLL under it, then **delete one junction and confirm the test FAILS**.

### 0.16 ‼️ LEAVE THE TREE CLEAN — every scratch file you created, you delete (ZERO-TOLERANCE, user-mandated)

> Added 2026-08-07 after a throwaway Playwright repro script was written into a repo root, got picked up by a
> commit, and had to be chased out of git history.

**A session is not finished while anything you created to *investigate* still exists.** Before reporting done:

- **DELETE every scratch artefact**: repro scripts, probe/spike files, throwaway tests, `.bak`/`.orig` copies,
  scanner one-offs, sample payloads, screenshots, generated logs, commented-out experiments.
- ‼️ **NEVER write a scratch file inside a repo.** Temporary files go in the session scratchpad directory, never
  beside source — anything in a repo root is one `git add .` away from being committed by somebody else's tooling.
- ‼️ **`git status --porcelain` MUST be clean of your scratch files at the end**, and you must LOOK at it. A
  file you never intended to keep, left behind, is indistinguishable from one you meant to add.
- ‼️ **Check before you overwrite.** A file whose name you invented may already exist. `ls` / `git ls-files` the
  path first; if you clobbered a tracked file, `git checkout --` it and say so.
- **A test that EARNS its place stays** — a regression guard for the defect you just fixed is deliverable, not
  scratch. The distinction is whether it protects something in the future, not whether it was useful today.
- **Delete what your change orphaned**: dead code, unused imports, now-unreferenced components/helpers, orphan
  appsettings keys, stale DI registrations, obsolete interfaces. Re-affirms §22.2 and §22.11.
- **State it in the summary.** Say what you removed. Silence reads as "nothing was left behind" when something was.

---

## 1. SKILL FILES — DETAILED REFERENCE

Comprehensive, domain-specific reference files are available for each part of the platform.
**Before making ANY change**, read the relevant skill file(s) for the area you are working in.

Skill files exist in four parallel locations (identical content):
- **Claude Code**: `.claude/skills/<skill-name>/SKILL.md`
- **GitHub Copilot**: `.github/skills/<skill-name>/SKILL.md`
- **Codex**: `.agents/skills/<skill-name>/SKILL.md`
- **Cursor**: `.cursor/rules/<skill-name>.mdc` (same content with YAML frontmatter)

### Active skills (42)

| Skill | Folder Name | Covers |
|-------|-------------|--------|
| **Main API** | `clinqet-main-api` | Controllers, middleware pipeline, DI, ApiResponse pattern, claims, SignalR, rate limiting |
| **Identity API** | `clinqet-identity-api` | Auth endpoints, JWT claims, password policy, passkeys, lockout, CORS, user metadata, spotlight dismissal table |
| **Function App** | `clinqet-function-app` | 73 files / 90 [Function] attrs, 47 Service Bus queue triggers, 23 HTTP triggers, Cosmos change feed + 21 timer triggers (incl. the morning trial-reminder timer), host.json, analytics Parquet, media-derivative processor, broadcast processors, cart reminder, notification processor |
| **Infrastructure** | `clinqet-infrastructure` | 36 repositories, services, CosmosDbRepository base, ServiceBusService, email templates, storage, AI, geocoding, search, health checks, communication dispatcher, SignalR service |
| **Cosmos & Data** | `clinqet-cosmos-data` | 7 active containers + 1 lease + partition keys, BaseEntity, ETag, 52 repositories, 197 enum files, DTO validation, mapping, indexing, seed data |
| **Shared & Core** | `clinqet-shared-core` | ApiResponse/PagedResult, 197 enum files (incl. Spotlight, Media, AI, Cart, Review*, Search*), DTOs, constants, interfaces, validation |
| **Testing** | `clinqet-testing` | xUnit + Moq + AutoFixture, `ClinqetApiFactory` (Testcontainers), `TestTokenHelper`, integration patterns |
| **Partner App** | `clinqet-partner-app` | Next.js 16 partner app: dashboard, leads, bookings, invoices, calendar, onboarding, profile, Open Page, CRM, inbox |
| **User App** | `clinqet-user-app` | Next.js 16 user app: search, quotes (`/quotes`), cart, bookings, reviews, my-reviews, settings, SEO |
| **Admin App** | `clinqet-admin-app` | React 18 admin: categories, countries, content, alerts, reviews moderation, analytics |
| **UI Common** | `clinqet-ui-common` | Cross-app patterns: Tailwind, forms, auth, API clients, toasts, loading, SignalR, localization, responsive |
| **Deployment** | `clinqet-deployment` | ARM templates, `deploy.ps1`, CI/CD, Service Bus queues, storage containers, env mappings |
| **Quote / Lead / Broadcast** | `clinqet-quote-lead-broadcast` | One feature, three names: customer "Quotes" / provider "Leads" / backend `Broadcast*`. Posting, matching algorithm, bidding, award, expiry, tiered expansion |
| **Notifications** | `clinqet-notifications` | `CommunicationDispatcher` → Service Bus → `NotificationProcessor` (Cosmos + SignalR + push) + email + SMS, preferences, mandatory/eligible rules, FailureNotificationHelper |
| **Reviews** | `clinqet-reviews` | Review CRUD, reply, votes, reports, admin moderation, business + service rating aggregation, image upload + derivatives, pending-review prompts |
| **Messaging** | `clinqet-messaging` | Conversation + Message entities, composite keyset pagination, per-side soft-hide + TTL, mute parity, attachments via derivatives, real-time `ConversationRead` |
| **Cart** | `clinqet-cart` | Anonymous/auth cart, per-provider groups, merge on login, conversion → bookings, abandoned-cart reminders |
| **Spotlight** | `clinqet-spotlight` | What's-new popup; SQL-backed dismissal per `(AppType, Surface, SpotlightType)`; content authored in code, not Cosmos |
| **Media Derivatives** | `clinqet-media-derivatives` | Service-Bus-triggered WebP thumb/medium pipeline; six parent entities; point-target patch design |
| **Booking Lifecycle** | `clinqet-booking-lifecycle` | Booking entity, full state machine, double-booking prevention, provider confirmation timeout, reminders, auto-completion, transactional invoice on Completed, 6 Service Bus queues |
| **Invoice Generation** | `clinqet-invoice-generation` | Invoice entity, status machine, QuestPDF generation, payment tracking, soft-delete with TTL, auto-from-Booking, earnings analytics, past-booking timer |
| **Availability + Calendar** | `clinqet-availability-calendar` | Weekly recurring working hours, copy-day-times, FullCalendar partner UI ("calender" typo preserved), public availability endpoint, CategoryAvailabilityFilter |
| **Provider Onboarding** | `clinqet-provider-onboarding` | 7-step onboarding wizard (BusinessDetails → BusinessCategory → Services → ServiceArea → Availability → Portfolio → BusinessAddress), ETag concurrency with 412-retry, auto-create profile, geocoding |
| **Provider CRM** | `clinqet-provider-crm` | BusinessCustomer entity (provider-scoped) + Customer entity (global), two-container sync, duplicate detection (email/phone), paginated multi-filter list |
| **Service Listing** | `clinqet-service-listing` | Service catalog CRUD, multi-tier pricing, media derivatives, AI enrichment via change feed, admin approval workflow, search index sync |
| **Provider Public Page** | `clinqet-provider-public-page` | Auto-generated public Open Page (Next.js SSR), SEO + schema.org, share modal + friendly-name + QR code; customers book by signing in (there is no guest booking) |
| **Search & Discovery** | `clinqet-search-discovery` | Hybrid search (BM25 + vector + semantic), 4-layer spell correction, AI enrichment, suggestion cache, rate limiting, Parquet analytics — additive fields ONLY, never a rename or reorder (the often-cited "81-field" figure does not exist: SearchAnalyticsSchema is 91, UserInteractionSchema 45) |
| **AI Assistant** | `clinqet-ai-assistant` | Multi-modal chat (text + speech), MCP tools, document intelligence for provider setup, SSE streaming, session persistence, AI rate limiting |
| **Analytics** | `clinqet-analytics` | Unified user-interaction analytics across customer + partner apps: 32 event types, AppType discriminator (Customer/Provider/Admin), Hive-partitioned Parquet pipeline, nightly compaction, PII scrubbing, lat/lng rounding, sampling, rate limiting, LinkedSearchId attribution, recommendation-engine isolation |
| **Voice Assistant** | `clinqet-voice-assistant` | Inbound-call AI phone receptionist (distinct from the chat AI Assistant): brand-new MCP server (`clinqetmcp`/`Clinqet.Mcp`), per-call token + binding-doc auth, Telnyx (CA/US) + Plivo (IN) telephony, AI takeover on miss/decline/after-hours, Azure GPT-Realtime "first prompt" (embedded provider profile + MCP tools), live transcript over SignalR, browser (WebRTC)/phone provider-join + bridge/AMD anchor, post-call summary + suggestions + usage, provider setup lifecycle, per-region MCP deployment |
| **Customer Mobile** | `clinqet-customer-mobile` | React Native customer app: screens, navigation, theme, i18n, AppConfig consumer, native booking-pay, Phase-5 badges/hero/narrow-search |
| **Provider Mobile** | `clinqet-provider-mobile` | React Native provider app: screens, navigation, i18n, Plan & Billing info surface, analytics parity, rank-higher card |
| **Payments** | `clinqet-payments` | Both money flows (provider→Clinqet subscriptions + customer→provider booking pay), gateway seam, SQL billing, the two plans (Free + Premium) and their entitlements, webhooks |
| **Smart Analytics** | `clinqet-smart-analytics` | Provider Smart Analytics ("Insights") — Payments Phase 7 |
| **WhatsApp** | `clinqet-whatsapp` | Meta Cloud API two-way messaging, transactional notifications, Sign-in-with-WhatsApp, consent + routing |
| **Provider Teams** | `clinqet-provider-teams` | ‼️ **The multi-user provider model** — one business, many people. `Business`/`BusinessMembership`/roles/permissions (89 keys, 10 system roles, code not SQL), the authorization pipeline (`TenantContext`, `[RequiresPermission]`, the snapshot cache, 7 resource scopes, live-SQL re-check for 7 sensitive operations), the business-context token exchange + workspace switching, invitations, teams, branches (locations) + per-branch hours, seats + the legacy grant, member lifecycle + ownership transfer, the shared team inbox, the business activity feed, business notification routing, the admin support cross-lookup, cross-tenant isolation |
| **Business Search** | `clinqet-business-search` | Provider "ask anything about my business": SSE agent on luna @ reasoning_effort none, five Group A tools, the per-document `searchAudience` team-search rule, citations, document page/view-url, member-scoped sessions. Replaced the deleted in-app chat assistant |
| **Integration Health** | `clinqet-integration-health` | â¼ï¸ **The alerting layer for every dependency we call** â 14 watched resources, five failure kinds, one alert type + gate per resource, and a POST-RETRY observation seam per transport so a blip a retry cleared is structurally invisible. Email BOUNCE reporting (Event Grid â per-stamp queue â `EmailDeliveryReportProcessor`), the per-stamp ACS pair that makes it possible, and the provider facts that are not what you expect (Storage throttles with 503, not 429; 2Factor fails on HTTP 200; Meta hides throughput walls in a 400 body) |
| **Delivery Feedback** | `clinqet-delivery-feedback` | ‼️ **What happens when a carrier accepts a message and then says it never arrived** — the two SystemData documents (by carrier id, and by ADDRESS), the three verdict paths, carrier codes verified against their published references, WhatsApp late recovery that sends the text that was held back, the operational notice preferences may not silence, and the surfaces that warn BEFORE a send |
| **Auth Sessions** | `clinqet-auth-sessions` | ‼️ **Every sign-in is an AuthSession family validated live on every request** — rotation, replay and the two-minute lost-response recovery, session_ended / session_context_changed / session_unavailable, the HttpOnly browser cookie per app (no BFF), the password-reset cookie, security changes that end every session and continue this device, registration holds (the phone claim needs a code on the profile's own phone, every code limit — per-server send/verify limits plus a SQL wrong-code guard per account and flow (10/hour, 20/day, admin release) — raising its own dedicated admin alert, replayed credentials and the hijack defence alerting too, marketing only after proof), push devices bound to their session, and the rules all web and mobile clients follow |
| **Voice Number Lifecycle** | `clinqet-voice-number-lifecycle` | ‼️ **MONEY PATH — the life of an AI Assistant phone number**: one inventory partition per stamp, one writer (`VoiceNumberCoordinator`: claim before act, project with the generation, record before the carrier), self-service pick vs the team's queue, the purchase placed ONCE and reconciled by asking the carrier, the hold when the AI service ends, admin remove / park / release, the hourly keep-or-return job, the daily limit, the four apps' number screens — and the rules every bug in it left behind |
| **Prepared Providers** | `clinqet-prepared-providers` | ‼️ **Prepared accounts, take-over, and price-less services** — the account the Clinket team builds before a provider has heard of Clinket, the one transaction where it becomes theirs (6 paths, claim-as-lock, the unproven contact removed from sign-in), the default-DENY setup session and its pinned allow-list (S1–S10), the signed claim / stop-emails link and its two public pages, the email-only channel rule for an unclaimed business, and `PriceTypes.OnRequest` — one "has a price" rule, a zero refused, no document printing $0 |

### Skill paths (Claude Code)

| Skill | Path |
|-------|------|
| Main API | `.claude/skills/clinqet-main-api/SKILL.md` |
| Identity API | `.claude/skills/clinqet-identity-api/SKILL.md` |
| Function App | `.claude/skills/clinqet-function-app/SKILL.md` |
| Infrastructure | `.claude/skills/clinqet-infrastructure/SKILL.md` |
| Cosmos & Data | `.claude/skills/clinqet-cosmos-data/SKILL.md` |
| Shared & Core | `.claude/skills/clinqet-shared-core/SKILL.md` |
| Testing | `.claude/skills/clinqet-testing/SKILL.md` |
| Partner App | `.claude/skills/clinqet-partner-app/SKILL.md` |
| User App | `.claude/skills/clinqet-user-app/SKILL.md` |
| Admin App | `.claude/skills/clinqet-admin-app/SKILL.md` |
| UI Common | `.claude/skills/clinqet-ui-common/SKILL.md` |
| Deployment | `.claude/skills/clinqet-deployment/SKILL.md` |
| Quote/Lead/Broadcast | `.claude/skills/clinqet-quote-lead-broadcast/SKILL.md` |
| Notifications | `.claude/skills/clinqet-notifications/SKILL.md` |
| Reviews | `.claude/skills/clinqet-reviews/SKILL.md` |
| Messaging | `.claude/skills/clinqet-messaging/SKILL.md` |
| Cart | `.claude/skills/clinqet-cart/SKILL.md` |
| Spotlight | `.claude/skills/clinqet-spotlight/SKILL.md` |
| Media Derivatives | `.claude/skills/clinqet-media-derivatives/SKILL.md` |
| Booking Lifecycle | `.claude/skills/clinqet-booking-lifecycle/SKILL.md` |
| Invoice Generation | `.claude/skills/clinqet-invoice-generation/SKILL.md` |
| Availability + Calendar | `.claude/skills/clinqet-availability-calendar/SKILL.md` |
| Provider Onboarding | `.claude/skills/clinqet-provider-onboarding/SKILL.md` |
| Provider CRM | `.claude/skills/clinqet-provider-crm/SKILL.md` |
| Service Listing | `.claude/skills/clinqet-service-listing/SKILL.md` |
| Provider Public Page | `.claude/skills/clinqet-provider-public-page/SKILL.md` |
| Search & Discovery | `.claude/skills/clinqet-search-discovery/SKILL.md` |
| AI Assistant | `.claude/skills/clinqet-ai-assistant/SKILL.md` |
| Analytics | `.claude/skills/clinqet-analytics/SKILL.md` |
| Voice Assistant | `.claude/skills/clinqet-voice-assistant/SKILL.md` |
| Customer Mobile | `.claude/skills/clinqet-customer-mobile/SKILL.md` |
| Provider Mobile | `.claude/skills/clinqet-provider-mobile/SKILL.md` |
| Payments | `.claude/skills/clinqet-payments/SKILL.md` |
| Smart Analytics | `.claude/skills/clinqet-smart-analytics/SKILL.md` |
| WhatsApp | `.claude/skills/clinqet-whatsapp/SKILL.md` |
| Provider Teams | `.claude/skills/clinqet-provider-teams/SKILL.md` |
| Business Search | `.claude/skills/clinqet-business-search/SKILL.md` |
| Integration Health | `.agents/skills/clinqet-integration-health/SKILL.md` |
| Auth Sessions | `.agents/skills/clinqet-auth-sessions/SKILL.md` |
| Voice Number Lifecycle | `.agents/skills/clinqet-voice-number-lifecycle/SKILL.md` |
| Prepared Providers | `.agents/skills/clinqet-prepared-providers/SKILL.md` |

Equivalent paths for Copilot/Codex/Cursor are identical except for the prefix (`.github/skills/`, `.agents/skills/`, `.cursor/rules/<name>.mdc`).

### How to use skills
1. Identify which area(s) your task touches.
2. Read the corresponding SKILL.md file(s) **completely** before writing any code.
3. Follow every pattern, convention, and checklist documented in the skill file.
4. Skills contain code examples — match them exactly.
5. After significant work, update the SKILL.md (in all four AI-tool directories) and add/update a memory entry.

---

## 2. PLATFORM OVERVIEW

A two-sided service marketplace and SaaS platform (comparable to Uber Eats / Airbnb but for local services: salons, plumbing, cooking, cleaning, landscaping, electrical, carpool, and every other service type). Three web apps today, mobile apps planned for both provider and user.

### Applications

| App | Description | Path |
|---|---|---|
| **Partner/Provider App** | Providers manage categories, services, bookings, quotes, invoices, CRM. Setting up a profile auto-generates a public "Open Page". | `C:\Nik\clinqetwebpartnerapp\` |
| **User/Consumer App** | Users search, book, get quotes (broadcast). | `C:\Nik\clinqetwebuserapp\` |
| **Admin App** | Oversees all bookings, quotes, services, alerts, reviews moderation. | `C:\Nik\clinqetwebadmin\` |

### Key feature — Get Quotes / Leads / Broadcast (one feature, three names)

Customers post a reverse-market request at `/quotes` ("Get Quotes"). The matching algorithm routes it to relevant nearby providers, who see it as a "Lead" at `/dashboard/leads` and can bid or accept. Backend names everything `Broadcast*`. See `clinqet-quote-lead-broadcast` SKILL.

### Category & subcategory architecture

- Categories and subcategories share the same Cosmos container. A subcategory is simply a category with a `parentCategoryId`.
- Providers select a category + subcategory when listing a service. Multiple service areas allowed per business.
- 300+ categories/subcategories. See `C:\Nik\cosmosindexsetup\SampleCosmosDataGeneratorSettings.cs`.

### Search architecture (see `clinqet-search-discovery` once authored)

- **Spell correction** (multi-layer): `CommonEnglishWords` + `DomainVocabulary` from `appsettings.json` under `Search > SpellCheck`.
- **Hybrid search**: BM25 + semantic + vector (embedding-based) via Azure AI Search index.
- **AI enrichment**: Cosmos change feed triggers `SearchIndexSyncFunction.cs`; calls AI to enrich service docs with `CommonSearchPhrases`, `UserIntentPhrases`; embeds them; saves to search index.
- **Analytics**: every search and suggest emits a Service Bus event; a function writes Parquet to blob. **Never break or alter analytics collection** during search changes — every metric and field must remain intact.

### Async & queue architecture

ALL of the following are processed **asynchronously via Service Bus**, never inline on the request path:
- User notifications, admin alerts, emails (incl. PDF attachments), booking-related processing, broadcast processing, cart reminders, search analytics events, media-derivative generation.

### Notification pipeline (see `clinqet-notifications` SKILL)

Single entry point: `CommunicationDispatcher.DispatchAsync(CommunicationRequest)`.

Key non-negotiables:
- `CommunicationDispatcher` is the only call site — no controller writes directly to a notification queue.
- New `NotificationType` values MUST be in `SignalRSettings:EnabledNotificationTypes` (Main API `appsettings.json`) for real-time delivery.
- Notification titles/bodies are `string.Format()`-resolved BEFORE dispatch — never raw localization keys with placeholders.
- Failure path: `FailureNotificationHelper` → admin alert. `forceAdminAlert` + `EnableAdminAlertOnFailure` setting honored together.

---

## 3. ARCHITECTURE RULES (NON-NEGOTIABLE)

1. **No cross-partition queries** — ever (re-affirms §0.6). Read `cosmosindexsetup\Program.cs` BEFORE writing any new query.
2. **All user identity/auth** lives in SQL (Identity API) — not Cosmos.
3. **Cosmos** is used for all operational data (services, bookings, quotes, invoices, broadcasts, messages, notifications, reviews, carts, etc.).
4. **.NET 10** for all backend projects.
5. **No hardcoded user-facing text** — every string uses localization keys (re-affirms §0.10). Add new keys to `en.json` AND every other language file.
6. **Admin alert wording may be hardcoded** — admin alerts are internal only. Everything else (emails, notifications, UI text) is localized.
7. **AI system prompts must never hardcode service/category names** — 300+ categories/subcategories. Hardcoding breaks generality.
8. **No hardcoding where enums or appsettings apply** — re-affirms §0.12.
9. **Enum serialization always uses string value** — never integer. Every enum in `clinqetshared\Enums\` has type-level `[JsonConverter(typeof(JsonStringEnumConverter))]`. The global converter in `AddJsonOptions` only covers MVC; the attribute guarantees universal serialization (Service Bus, Cosmos, manual `JsonSerializer`, tests, external consumers). Exception: `UserType` uses custom `[JsonConverter(typeof(UserTypeJsonConverter))]`.
10. **Service Bus admin-alert pattern**: in `ServiceBusService.cs`, always respect `forceAdminAlert` flag AND `EnableAdminAlertOnFailure` appsetting:
    ```csharp
    if (forceAdminAlert || _settings.EnableAdminAlertOnFailure) {
        await CreateSendFailureAlertAsync(...);
    }
    ```
11. **Any new Cosmos repository method** → review `cosmosindexsetup\Program.cs` and decide whether a new/modified index is needed. Include those changes in the same PR.
12. **Any new Cosmos container** requires explicit user approval (re-affirms §0.7). Partition key choice is permanent.

---

## 4. APPSETTINGS RULES

| Location | Rule |
|---|---|
| `appsettings.json` (Main API) | Only settings used by the main API |
| `appsettings.json` (Identity API) | Only settings used by the identity API |
| `appsettings.json` (Function App) | Settings used by the function app that are NOT required at runtime trigger level |
| `local.settings.json` (Function App) | **ONLY** settings required at function runtime (e.g., Service Bus connection strings for triggers). Gitignored. |
| `C:\Nik\azureautomation\deploy.ps1` + ARM templates | Any new `local.settings.json` entry **must** be added here as an environment variable |

- Never add a setting to a project that doesn't use it.
- Never leave orphaned settings after a change.
- Mandatory config hygiene: if a setting is removed/renamed or no longer read, delete the key + related options/DI binding in the same change.
- Usage proof: every new setting has at least one active runtime code path reading it before merge.
- Any new Azure resource (Service Bus queue, storage container, etc.) must be added to ARM + `deploy.ps1`.
- Per-environment values via ARM parameters or environment vars in `deploy.ps1`, not hardcoded per-environment appsettings.
- `appsettings.json` in repo uses placeholders or Key Vault references for secrets — never commit real secrets.
- Options class defaults must match `appsettings.json` defaults (memory: `feedback_appsettings_class_defaults`).

---

## 5. ERROR HANDLING & API RESPONSE FORMAT

- Standard response envelope. Read an existing controller before adding a new endpoint; match the success and error shape exactly.
- Global exception middleware in place — read `Program.cs`. Don't add try/catch in controllers unless you have a specific reason to handle an exception differently.
- Validation errors via existing FluentValidation / ModelState / DTO annotation pattern.
- Use existing custom exception types (`NotFoundException`, `ForbiddenException`, etc.). Don't invent new exception types without asking.
- Never swallow exceptions silently. Every catch rethrows, logs, or handles meaningfully.

---

## 6. AUTHENTICATION & AUTHORIZATION

- Read `AuthService.cs` (fully, end to end) and `AuthController.cs` before any auth-related change.
- JWT-based. Read existing controllers for `[Authorize]`, roles, claims, policies.
- Multi-tenant isolation is mandatory: a partner must never see another partner's data. Every query enforces ownership via claims (`userId`/`partnerId`).
- Don't invent new roles or policies without asking.

---

## 7. LOGGING STANDARDS

- Use existing logging framework (Serilog / Application Insights / `ILogger`) configured in `Program.cs`.
- **Structured logging only** — parameterized: `_logger.LogInformation("Processing booking {BookingId}", bookingId)`. Never string interpolation/concatenation.
- Levels: `Information` for successful operations / key events; `Warning` for recoverable issues / retries; `Error` for failures needing attention; `Debug`/`Trace` local-dev only.
- Correlation IDs: follow existing pattern (API → Service Bus → Function App).

---

## 8. CONCURRENCY CONTROL

- Cosmos optimistic concurrency via ETag for entities with concurrent writers (bookings, quotes, invoices, carts, broadcasts). Read the base Cosmos repository for the helper.
- 412 Precondition Failed → fail gracefully with a clear error. Never silently overwrite.

---

## 9. SERVICE BUS — IDEMPOTENCY & RESILIENCE

- Idempotency is mandatory. Every Service Bus handler must be safe to re-execute (no duplicate emails, bookings, etc.).
- DLQ: follow existing pattern. Unprocessable messages land in DLQ after retries — never silently lost.
- Use `MessageId` (GUID) for dedup where the platform supports it.
- Retry policies in host config; don't add custom retry unless existing doesn't apply.

---

## 10. RETRY & RESILIENCE POLICIES

- Cosmos SDK handles transient + 429 with built-in retry. Don't layer manual retry on top.
- HTTP: use `IHttpClientFactory` + Polly if the codebase uses it. Never `new HttpClient()`.
- Service Bus: host config + existing patterns; no custom infinite retries.

---

## 11. DEPENDENCY INJECTION

- Read `Program.cs` of the project before adding DI. Follow existing registration patterns (extension methods).
- Lifetimes: Singleton for expensive thread-safe (Cosmos clients, HttpClient factories, config); Scoped for per-request services/repositories; Transient for lightweight stateless.
- Never register Scoped as Singleton or inject Scoped into Singleton (captive dependency bug).
- New HTTP: always `IHttpClientFactory`.

---

## 12. ENTITY → DTO MAPPING

- Read the codebase to determine the existing pattern (extension methods in `clinqetinfrastructure\Data\COSMOS\Extension\`, AutoMapper, or manual).
- Follow that pattern exactly. Don't introduce a different mapping approach.

---

## 13. PAGINATION

- Read existing list endpoints. Most use **keyset pagination** with composite cursor (e.g., messaging uses base64(createdAt|id)) or Cosmos continuation tokens.
- Filter columns lead in `ORDER BY` so the prod composite index binds. Emulator is more permissive (memory: `feedback_cosmos_emulator_vs_prod_matcher`) — add string-shape SQL unit tests for new keyset queries.
- Respect existing default + max page sizes from settings; never hardcode page size.

---

## 14. CACHING

- Read `Program.cs` to determine if caching is in use (`IMemoryCache`, Redis, distributed cache).
- Follow existing key naming, TTLs, invalidation patterns.
- Categories/subcategories are good cache candidates — they're already cached. Don't duplicate.
- Never cache user-specific or frequently-mutated data without a clear invalidation strategy.
- **EVERY `IMemoryCache` write MUST set `Size = 1` (ZERO-TOLERANCE).** The shared caches in the Main API, Functions, and MCP hosts are registered with `SizeLimit` (`MemoryCache:SizeLimit`), and .NET throws `InvalidOperationException` at runtime (a 500) on ANY size-less write. The convenience overloads `_cache.Set(key, value, TimeSpan)` / `(key, value, DateTimeOffset)` can never carry a Size and are **FORBIDDEN** — always use `MemoryCacheEntryOptions { Size = 1, ... }`, `.SetSize(1)`, or `entry.Size = 1` inside `GetOrCreate`. This broke the billing receipt endpoint + receipt-email processor in production (2026-07-10). The convention test `MemoryCacheSizeConventionTests` (Clinqet.API.UnitTests) scans all backend source and fails the build listing offenders — fix the call site, never the test. Identity host deliberately has NO SizeLimit (Apple auth's `DefaultAppleClientSecretGenerator` writes size-less entries) — never add one there.

---

## 15. FILE UPLOAD & MEDIA HANDLING

See `clinqet-media-derivatives` SKILL for the full pipeline.

- Read `clinqetinfrastructure\Services\Storage\` for existing Azure Blob patterns.
- Validate file type + size server-side. Existing allowed lists per feature (MessagingSettings, ReviewSettings, BroadcastSettings) — don't widen without ADR.
- Follow existing blob naming conventions (`{partnerId}/{entityId}/{filename}` or per-feature container layout).
- SAS upload → blob direct → controller confirm → Service Bus message → `MediaDerivativeProcessorFunction` → patch parent doc with derivative URLs.

---

## 16. SIGNALR

- Read `clinqetapi\Clinqet.API\Controllers\Notification\` and `clinqetinfrastructure\Services\SignalR\` before changes.
- Group naming per user. Connection lifecycle (join on connect, leave on disconnect) follows existing pattern.
- New notification type → add string name to `SignalRSettings:EnabledNotificationTypes` in Main API `appsettings.json`.
- Internal endpoint `POST /api/v1/internal/notifications/send` uses `X-Internal-Api-Key`; never call from non-internal code.

---

## 17. HEALTH CHECKS

- Existing endpoints in `Program.cs`. Any new critical dependency (Cosmos container, Service Bus queue, external API) should be considered for a health check — flag in plan.

---

## 18. CORS

- Read existing CORS config. Add new origins to existing policy — never create wildcard.
- Never wildcard `*` in production.

---

## 19. SECRETS MANAGEMENT

- Never commit secrets — no connection strings, API keys, passwords, tokens in tracked files.
- `appsettings.json` uses placeholder or Key Vault reference.
- `local.settings.json` is gitignored, local-only.
- New secrets: Key Vault reference in `appsettings.json`, real value as env var in ARM + `deploy.ps1`.
- ‼️ **The keys already sitting in the tracked `appsettings.json` files are SANDBOX / non-production keys and the owner has ruled this ACCEPTED (2026-09-05).** Do NOT report them as a finding, do NOT rotate them, do NOT "fix" them, and do NOT raise them again in a session summary. The rule above governs REAL production secrets only.

---

## 20. ENVIRONMENT-SPECIFIC CONFIGURATION

- `appsettings.{Environment}.json` overrides if pattern exists. Read existing structure first.
- Feature flags via existing settings. No new feature flags without asking.

---

## 21. GIT & BRANCHING

- Check current branch and recent commits for conventions.
- Follow existing branch naming (`feature/xxx`, `bugfix/xxx`).
- Never push to `main`/`master` directly — feature branch unless explicitly instructed.
- Never commit `bin/`, `obj/`, `node_modules/`, build output.

---

## 22. CODING STANDARDS (NON-NEGOTIABLE)

1. **Thread safety**: all code thread-safe. No memory or CPU leaks. Proper IDisposable/IAsyncDisposable. `using` / `await using` for disposables.
2. **Clean code**: no dead code, no unused imports, no orphaned appsettings keys, no commented-out blocks. If unused after your change, delete.
3. **Comments — terse, only when earned (re-affirms §0.14, ZERO-TOLERANCE)**: default NO comments. **One short line, max** — and only for a non-obvious WHY / invariant / gotcha / spec reference, NEVER to narrate WHAT the code does. No method-summary paragraphs re-describing the body, no step-by-step narration, no commented-out code, no `// TODO` without an issue link, no change-log notes, no multi-paragraph rationales (those go in commit messages / PR descriptions). If a comment needs multiple lines to say WHAT happens, the code is wrong — refactor it. When in doubt, delete the comment.
4. **No README/docs files** as part of code output unless explicitly requested.
5. **Simple, readable, performance-aware code**. No over-engineering. No premature abstractions for single-use operations.
6. **Enum serialization** as strings always (re-affirms §3.9).
7. **No hardcoding** (re-affirms §0.12).
8. **DTO annotations** use localization keys.
9. **No workarounds** (re-affirms §0.3).
10. **No backward-compatibility hacks** for new work — pre-prod, no backfill needed. Refactor freely.
11. **Config cleanup mandatory** — no orphan appsettings, no unused options classes, no stale DI.

---

## 23. TESTING REQUIREMENTS

Re-affirms §0.8. Before writing tests: read the existing unit + integration projects, `ClinqetApiFactory` fixtures, and existing patterns thoroughly. Match conventions.

After any change: build affected projects; run affected tests (100% pass); run ESLint on changed UI projects (zero errors).

Integration tests are MANDATORY (not optional) for any change touching money, SQL/Cosmos schema, unique indexes, atomic counters, webhooks, or Service Bus processors — see the strengthened §0.8 ("skip because slow" is not acceptable for those paths; prove them against real engines via Testcontainers).

---

## 24. UI RULES

- Design consistency: every UI change matches the existing design system exactly — colours, typography, spacing, component patterns, theme. Zero deviations.
- Mobile-first responsive (phone + iPad + laptop — memory `feedback_clinqet_engineering_standards`).
- SEO: semantic HTML, meta tags, structured data where applicable.
- ESLint: zero errors after any UI change.
- Localization: every visible string is a key (re-affirms §0.10).

### 24.1 ‼️ UI DESIGN STANDARD — modern, dense, responsive, native (owner-mandated, 2026-10-04)

Every new or changed screen, in every app, meets ALL of these. A screen that misses one is not done.

- **Modern and current.** Clean, confident, contemporary design — never a dated form-on-a-page look. It still uses ONLY the house theme: brand colours, fonts, radii, spacing scale and component patterns. Modern means well composed, never a new palette.
- **Easy to understand at a glance.** One clear primary action per view. Plain words (§0.20 — no technical vocabulary). The user always knows where they are, what changed and what to do next.
- **Use the space — no large empty areas.** Lay content out so the screen does work: grids that reflow, side-by-side panels on wide screens, compact cards. Large blank bands, a narrow column floating in a wide page, or oversized padding are defects.
- **Web is fully responsive — phone, iPad and desktop are all first-class.** A web page opened on a phone or tablet must be as usable as the native app: no horizontal scroll, touch targets ≥ 44px, readable type, layouts that reflow (not shrink). Verify in the browser at **320, 375, 768, 1024 and 1440** wide before reporting done.
- **Mobile apps use the power of the device.** Native patterns, not a web page in a wrapper: bottom sheets, swipe and pull-to-refresh, haptics where the platform expects them, safe areas, deep links, native share, push that opens the exact screen.
- **Every state is designed**: loading, empty, error, offline, permission-denied, limit-reached — each in the same visual language as the happy path.

### 24.2 ‼️ DESIGN RULES FOR EVERY SCREEN AND EVERY MOCKUP (owner-mandated, 2026-10-05)

> Added after mockups were drawn with an invented emoji phone icon, tiny state boxes and a page nobody asked for.
> Owner: the UI must be "modern … futuristic … look good, feel good … easy to understand, easy to follow" and must
> follow the existing design "all the time".

- **Modern and current, never generic.** Every screen looks like a polished, current product: confident hierarchy,
  generous but purposeful spacing, smooth states. It must look good and feel good.
- **The existing design system ALWAYS — no exceptions:** the house colours (navy ink, brand green, the existing amber /
  red / blue states), the house font (Lufga), the existing radii, shadows, button shapes (e.g. the customer app's pill
  buttons) and spacing scale.
- ‼️ **Icons come ONLY from the icon set each app already uses** — customer web `react-icons` / its existing inline SVGs;
  provider web `lucide-react` (+ `react-icons` where already used); admin web `react-icons`; the three phone apps
  `react-native-vector-icons` / `react-native-svg` assets already in the app. **Never an emoji, never a hand-drawn or
  invented icon.** If the app already shows an icon for a thing (call, message, arrow, location), that exact icon is used.
- **Reuse existing components** (cards, rows, buttons, banners, sheets) before drawing anything new; a new screen must
  look like it was always part of the app.
- **Easy to understand, easy to follow:** one clear primary action per view, plain words (no technical vocabulary),
  the user always knows where they are and what happens next.
- **Web is extremely responsive** — phone, iPad and laptop are each designed, not shrunk. Mockups show all three
  (375 / 820 / 1280+) and the build is checked at 320 / 375 / 768 / 1024 / 1440.
- **Phone apps use the power of the device and complement the web** — not a web page in a wrapper: bottom sheets,
  long-press actions, swipe actions, pull-to-refresh, haptics where the platform expects them, native share, safe
  areas, deep links, push that opens the exact screen.
- **Every state is a real, full-size, designed screen** in the same visual language (loading, empty, error, offline,
  permission denied, limit reached, success) — never a pile of small boxes.
- **Mockups are drawn FROM THE REAL APP**: read the actual components (classes, icons, fonts) or capture the live
  screen first, and say on the sheet which component each frame mirrors. A frame that does not look like the real app
  is wrong even if its words are right.
- **Never add a page, screen or step the owner did not ask for.** If a new screen seems needed, explain why in plain
  words and ask first.
- **Mockups are simple, single self-contained HTML files** — no server, no shared folders, no app-building. They show
  the content, the flow and every state; they are a guide, not a pixel contract. Do not spend time over-engineering them.
- ‼️ **The implementing session has CREATIVE FREEDOM, without asking the owner again**, to refine any approved mockup
  while building: make it more modern, better-looking, easier to understand and follow, fully responsive on web, and
  using the full power of the phone apps — as long as it stays inside the existing theme, colours, brand, font, icons
  and components, keeps the agreed content, flow and words' meaning, and never adds a page or step nobody asked for.

---

## 25. INFRASTRUCTURE AUTOMATION

- Any new Azure resource → ARM templates in `azureautomation\` + `deploy.ps1`.
- Any new `local.settings.json` entry → ARM + `deploy.ps1` as env var.
- Settings only in `appsettings.json` (not `local.settings.json`) do not need ARM changes.
- Read `deploy.ps1` + relevant ARM JSON before infrastructure changes.

---

## 26. MANDATORY WORKFLOW — FOLLOW IN ORDER FOR EVERY TASK

1. **Identify the relevant SKILL(s)** for the area you're touching. Read them fully.
2. **Read the code** — every file relevant to the task, end to end. Never skim large files.
3. **Understand existing patterns** — `Program.cs`, controllers, services, repositories, tests. New code MUST follow existing patterns exactly.
4. **Think deeply** — what files are touched, what breaks downstream, what appsettings change, what indexes are affected, what tests are needed, what infra changes are needed, what skill/memory updates are needed.
5. **Ask before acting** when ambiguous (re-affirms §0.5).
6. **Implement** — every rule above without exception.
7. **Verify** — build affected projects; run affected tests (100% pass); run ESLint on changed UI (zero errors).
8. **Clean up** — delete dead code, unused imports, orphan settings, obsolete interfaces/services.
9. **Update skill + memory** when functionality is added or significantly modified (re-affirms §0.9).

---

Regardless of the task or question, always follow the **Zero-Tolerance Rules (§0)** and every other rule in this document, without exception.

## Imported Claude Cowork project instructions

---

## 0.17 ‼️ A TEST MAY ONLY READ ITS OWN REPO — UI AND BACKEND ALIKE (ZERO-TOLERANCE)

> Added 2026-08-15 after `clinqetwebuserapp/utils/indexNowKey.test.js` failed **12 tests** in CI with
> `ENOENT` on `../clinqetapi/...`, `../clinqetfuncations/...` and `../azureautomation/...`. It had passed on
> every developer machine for three weeks, because there every project sits side by side under `C:\Nik`.
> **CI checks out ONE repository. `..` is empty there.** This widens §0.15, which named only the .NET hosts.

**Every project is its own git repository.** `clinqetapi` · `clinqetidentity` · `clinqetmcp` ·
`clinqetfuncations` · `clinqetinfrastructure` · `clinqetwebpartnerapp` · `clinqetwebuserapp` ·
`clinqetwebadmin` · `clinqetmobilepartnerapp` · `clinqetmobileuserapp` · `azureautomation`.
They share a folder on a dev machine and **nothing else**.

### The rule

1. **A test file may only read paths inside its own repository root.** No `../<other-repo>`, in any
   language, in unit tests and integration tests alike. A path that climbs out of the repo is a bug even
   when it currently resolves.
2. **Tests live with the code they test.** API tests in `Clinqet.API.UnitTests`/`.IntegrationTests`,
   Identity tests in the Identity repo, MCP tests in `Clinqet.Mcp.UnitTests`, Function tests in the
   Functions repo, UI tests in that app's repo. **Never mix-and-match**, and never test one host's
   behaviour from another host's suite.
3. ‼️ **NEVER add a checkout of a peer repo to CI so a foreign scan can run.** It couples one build to N
   repositories and hides the design error. Proposed before, **rejected outright** (§0.15).
4. **A check that genuinely spans repos belongs to the thing that deploys them** — normally
   `azureautomation/deploy.ps1`, which already sets both sides per environment. Checked there, it fails at
   the moment of the real risk instead of in a test pretending to know about code it cannot see.
5. **If a cross-repo guard must stay in a repo, it SKIPS LOUDLY when the peer is absent** — reporting
   **Skipped**, never **Passed**. An empty scan that reports success does not merely fail to catch bugs,
   **it INVENTS confidence**.

### ‼️ The trap that makes rule 5 fail silently — `describe.skip` STILL RUNS ITS BODY

Proven by probe, 2026-08-15: `describe.skip(...)` **executes its callback** to collect test names. Only the
`it()` callbacks are skipped. So this **still throws ENOENT in CI**:

```js
const describeOrSkip = fs.existsSync(PEER) ? describe : describe.skip;

describeOrSkip("parity", () => {
  const peer = JSON.parse(fs.readFileSync(PEER_FILE, "utf8"));  // ‼️ RUNS EVEN WHEN SKIPPED
  it("matches", () => expect(...));
});
```

**Every peer read must sit INSIDE an `it()` body:**

```js
const available = fs.existsSync(PEER_FILE);           // existsSync never throws — safe at module scope
const describeOrSkip = available ? describe : describe.skip;

describeOrSkip("parity", () => {
  it("matches", () => {
    const peer = JSON.parse(fs.readFileSync(PEER_FILE, "utf8"));  // not executed when skipped
    expect(...);
  });
});
```

### How to tell you have got it wrong

- The suite passes locally and fails in CI with `ENOENT`. ← the loud version.
- The suite passes in CI having read **zero** files. ← the dangerous version. A guard that matches nothing
  reports success and then, when someone trusts it, **invents bugs or hides them**.
- **Green must mean "I checked", never "I couldn't look."**

## 0.18 ‼️ TEST PLACEMENT FOLLOWS THE RUNTIME CONSUMER — a library class is tested from the suite of the HOST that invokes it (ZERO-TOLERANCE, owner-mandated)

> Added 2026-08-16 after voice noise-suppression tests for `TelnyxCallControlService` and
> `RealtimeSessionPayloadBuilder` were added to `Clinqet.API.UnitTests`. The classes live in
> `clinqetinfrastructure`, but the API host never drives voice call control — the tests were pinning
> behavior a host does not own. Owner: "never ever should this type of mistake happen."

**`clinqetinfrastructure` / `clinqetshared` / `clinqetcore` are LIBRARIES with no test projects of
their own. That a class lives there does NOT mean its tests go wherever is convenient — they go in
the unit/integration suite of the HOST whose runtime path actually invokes it.**

1. Before writing a test for an infrastructure/shared class, answer: **which host(s) call this at
   runtime?** Grep the call sites. That host's test project is the home. Voice call-control commands,
   the realtime session payload builder, functions-consumed processors ⇒
   `Clinqet.Communications.UnitTests`/`.IntegrationTests`. Relay/MCP-side behavior ⇒
   `Clinqet.Mcp.UnitTests`/`.IntegrationTests`. API-consumed services (auth, controllers' services,
   provisioning) ⇒ `Clinqet.API.UnitTests`/`.IntegrationTests`.
2. **A class consumed by MULTIPLE hosts** is tested once, in the suite of its PRIMARY voice/feature
   orchestrator (the host that binds its settings section is a strong tell) — never duplicated per host
   and never parked in an unrelated suite.
3. **Compile-required edits are NOT placement violations** and stay where compilation forces them: a
   widened interface member on an existing mock, a new constructor argument threaded through an
   existing test factory. Adding NEW test cases there is the violation.
4. **Pre-existing misplaced suites are migrated deliberately** (their own change, owner-visible),
   never silently extended — every test ADDED to a misplaced file deepens the misplacement.
5. This is the same principle as §0.15/§0.17 (a test lives with what it tests), extended one level:
   for library code, "what it tests" means the CONSUMING HOST's behavior, not the library's folder.

## 0.19 ‼️ NEVER `git checkout --` / `git restore` / `git reset` / `git stash` / `git clean` IN THESE WORKING TREES (ZERO-TOLERANCE, owner-mandated)

> Added 2026-08-28 after a sabotage-test "restore" ran `git checkout -- AIAssistantModal.jsx` in
> `clinqetwebpartnerapp` and wiped ANOTHER session's uncommitted work in that file. Owner: "never ever
> should this type of things happen."

**Multiple AI sessions (Claude, Copilot, Codex, Cursor) work UNCOMMITTED in the same repos at the same
time.** Any command that rewrites a tracked file from git — `checkout --`, `restore`, `reset --hard`,
`stash`, `clean`, `merge`/`rebase` with a dirty tree — destroys EVERY session's uncommitted edits in
that file, not just yours. Replaying your own edits onto HEAD restores ONLY your work and silently
deletes theirs.

- **A file you need to mutate for a test (sabotage, probe, repro) is COPIED to the session scratchpad,
  mutated THERE or copied back after a snapshot copy is taken first — never restored through git.**
- **There is no "safe" case.** A file with no diff today may have one by the time your restore runs.
- **If it happens anyway: say so IMMEDIATELY** — which file, which HEAD you reverted to, what you
  replayed — so the other sessions can re-apply their edits. Silence turns a recoverable loss into a
  permanent one.
- Committing is still the owner's call (§21); this rule is about the working tree only.

### 0.20 ‼️ EVERY MOCKUP LIVES IN `C:\Nik\Data\mockups\` — ONE HOME, AND IT IS REGISTERED (ZERO-TOLERANCE, owner-mandated)

> Added 2026-09-03 after the owner found an APPROVED mockup that the plan calling itself "the authority" never
> named — the only pointers to four approved sheets were scattered across two phase prompts and one audit
> file. Owner: *"all the mockups will be inside the Data folder ... and never on the Nik folder"*, and
> *"we fucking never ever make mistake"*. In the same sweep a mockup was found **committed inside
> `clinqetmobilepartnerapp`**, which §0.16 already forbids for scratch files.

**The location is absolute:**

| Where | Rule |
|---|---|
| **`C:\Nik\Data\mockups\<sheet-name>\index.html`** | ‼️ **THE ONLY home.** One folder per sheet, kebab-case, named after what it draws (`business-search-sources`, not `mockup2` or `final-v3`) |
| `C:\Nik\mockups\` | ‼️ **GONE. Never recreate it.** Every folder was moved into `Data\mockups\` on 2026-09-03 |
| A programme folder's own `mockups\` subfolder | ‼️ **FORBIDDEN.** `Data\provider-ai-search\mockups\` existed and split the home in two. A programme folder holds its plan, prompts and findings — never its sheets |
| **Anywhere inside a repo** | ‼️ **FORBIDDEN, and worse than scratch (§0.16).** A mockup beside source is one `git add .` from being committed — one already was. Never write one there, in any repo, for any reason |

**And it MUST be findable, not just filed:**

- ‼️ **A sheet the owner approved that appears in no register has been LOST, not approved.** Every programme
  keeps a **mockup register** in its own authority document — a table of sheet · path · approval date · what it
  governs · what it supersedes — and a row goes in **the day the owner says yes**. See `PLAN.md` §0 in
  `C:\Nik\Data\provider-ai-search\` for the shape.
- **Never delete a register row.** Supersede it, and say in the row what superseded it and on which points.
  Two sheets can both be live and disagree; the later one wins and the row records that.
- **A phase that says "audit the UI against the approved mockup" needs the register to have a list to audit.**
  Without one, that duty silently becomes unperformable, and nobody notices — which is exactly how this was found.
- **When a sheet moves or is renamed, sweep every reference in the same change**: the register, the phase
  prompts, the audits, the SKILLs ×4, the memory entries, and any code comment that cites it. A path in a
  comment is a claim about another artefact and no build checks it (§0.15).

**Content rules for the sheet itself** (these are the MOCKUP GATE of §0.7.1, restated because they are where
sheets actually fail):

- **Web AND mobile frames**, and **every state** — empty, loading, error, permission-denied, limit-reached,
  offline, and any state the server can actually produce. A state the server can reach and the sheet cannot
  draw is a state that ships undesigned.
- ‼️ **NO TECHNICAL WORD anywhere a provider can read** (owner, 2026-09-03). "Passage", "chunk", "index",
  "embedding", "retrieval", "token", "payload", "endpoint", "stream", "cache", "blob", "SAS", "schema",
  "frame", "flag", "marker", "partition" mean **nothing** to a salon owner or a plumber. Say *page*, *text*,
  *document*, *source*, *answer*, *saved*, *offline*. The same ban already governs the AI system prompt
  (rule 6) — it governs the screen, the copy files and the sheet too.
- **Say where every state's words come from** — the server's already-translated sentence, or the screen's own
  copy key. A screen that re-invents a sentence the server already sends will drift out of translation.
- **House tokens only** (navy ink, brand green for the chosen action, amber for limits, blue for processing).
  A sheet drawn in another palette teaches the wrong design.

### 0.21 ‼️‼️ GIT HISTORY IS LINEAR — NEVER CREATE A MERGE COMMIT, IN ANY REPO, EVER (ZERO-TOLERANCE, owner-mandated — GOLDEN RULE)

> Added 2026-09-25 after an AI session ran `git pull --no-rebase` in eleven repos after committing. Every repo
> that was behind origin got a "Merge branch 'master' of …" commit. The owner pushed without knowing, and the
> merges reached origin in eight repos. Owner: *"my commit graph need to be stay linear"*, and this must
> **never, ever** happen again.

**Every repo's history is a straight line: each commit has exactly ONE parent.** A merge commit is a defect,
whoever made it and whatever the reason.

| NEVER | ALWAYS |
|---|---|
| `git pull` (it merges by default), `git pull --no-rebase`, `git pull origin master` | `git fetch origin`, then `git rebase origin/master` (on a CLEAN tree: commit first, §0.19) |
| `git merge` of any branch into `master` | a fast-forward only: `git merge --ff-only origin/master`, which REFUSES instead of merging |
| "It merged cleanly, so it is fine" | clean or not, a merge commit breaks the graph |

**Before you tell the owner a repo is ready to push, prove it:**
1. `git rev-list --merges origin/master..HEAD` prints **NOTHING**. Any line it prints is a merge you made: stop
   and remove it before anything is pushed.
2. `git log --oneline --graph -10` shows one straight line.
3. Report both results in the summary. Silence reads as "checked" when it was not.

- ‼️ **`git pull.rebase=true` set in someone's global config does not make a bare `git pull` safe to write here.**
  Always write the explicit `git fetch` + `git rebase origin/master`, so the command is correct on every machine.
- **A rebase that conflicts:** resolve it, `git rebase --continue`, and re-run the affected tests. Never
  `--abort` into a merge "because it is easier".
- **§0.19 still holds:** a rebase needs a clean working tree. Commit your own work first, and never stash or
  reset another session's uncommitted edits to get one. If the tree holds another session's edits, stop and ask.
- **If a merge commit is created anyway:** say so at once, and name each repo and commit. Rebuild the line with
  the same final tree on top of `origin/master`: one commit, the merged tree, parented on `origin/master`. Verify
  the tree hash is identical, and only then replace the branch. If it was already pushed, the owner decides on the
  force push (`--force-with-lease`, never a bare `--force`).

### 0.22 ‼️ DEDICATED WORKTREE MODE — **ONLY WHEN THE OWNER SAYS SO IN THE PROMPT** (owner-mandated, 2026-10-01)

> **DEFAULT IS IN PLACE. Work in the `C:\Nik` repos exactly as usual. Use this mode ONLY when the owner's prompt
> explicitly says to start in a new dedicated / separate worktree. Never choose it yourself, not even for a big task.**

When the owner asks for it, follow this exact approach (proven on the post-ranking follow-ups, 2026-10-01):

**‼️ WHY THIS NEVER TOUCHES ANOTHER SESSION'S WORK — READ THIS FIRST:**
- **A `git worktree` is a SECOND, SEPARATE FOLDER for the same repo, with its OWN branch and its OWN files.** Other
  sessions keep working in `C:\Nik\<repo>` on `master`; you work in `W:\<repo>` on `feature/<task-name>`. Neither
  folder ever sees the other's uncommitted edits. **NEVER run `git checkout`/`switch` in `C:\Nik\<repo>` — that WOULD
  change other sessions' files. Only `worktree add` creates the new folder.**
- **The branch starts from `origin/master` (the remote), NOT from local master**, so it starts clean and never carries
  anyone's half-finished local work.
- **`W:` is just a drive letter (`subst`) pointing at the scratchpad folder that holds all the worktrees side by side,**
  so `..\clinqetinfrastructure` project references resolve exactly as they do under `C:\Nik`.
- **Builds write `bin/obj` inside `W:\`, never inside `C:\Nik`**, so builds never collide either.

**EXACT COMMANDS (git in Git Bash; `subst` in PowerShell or cmd):**
```
mkdir <scratchpad>\w
subst W: <scratchpad>\w
git -C C:/Nik/<repo> fetch origin                       # every repo the task touches
git -C C:/Nik/<repo> worktree add W:/<repo> -b feature/<task-name> origin/master
# ... work, build, test ONLY under W:\<repo> ...
git -C W:/<repo> fetch origin && git -C W:/<repo> rebase origin/master
git -C W:/<repo> rev-list --merges origin/master..HEAD  # MUST print nothing
git -C W:/<repo> push origin HEAD:master                # ONLY when the owner says push
```


1. **Drive.** Create `<session scratchpad>\w\` and `subst W: <that folder>`. Repos sit side by side under `W:\`, so
   every relative project reference resolves exactly as it does under `C:\Nik`.
2. **Branch + worktree per repo.** For every repo the task touches, run `git fetch origin`, then
   `git -C C:\Nik\<repo> worktree add W:\<repo> -b feature/<task-name> origin/master`. Trunk is `origin/master` for
   every repo.
3. **Dependencies.** Use `npm ci` from the worktree's own lockfile. A directory junction to the shared tree's
   `node_modules` is allowed ONLY when both lockfiles are identical.
4. **Build, test, sabotage and live proof ONLY under `W:\`.** Never in `C:\Nik` (other sessions work there).
5. **Finish.** Commit, `git fetch origin`, `git rebase origin/master` (resolve conflicts properly), then re-run the
   tests. Prove `git rev-list --merges origin/master..HEAD` is empty. Push ONLY when the owner says to.
   Push with `git push origin HEAD:master` (fast-forward, never force), libraries first and `clinqetapi` last.
6. **Clean up — in this order, never skipped:**
   - Remove every junction as a LINK ONLY (`cmd /c rmdir <link>`). ‼️ **NEVER a recursive delete through a junction**:
     it deletes the shared tree's files.
   - Deep-scan the worktrees for reparse points. Continue only when none remain.
   - Run `git worktree remove --force` for each. For "Filename too long", delete the folder via the `\\?\` long-path
     form, then `git worktree prune`.
   - Run `subst W: /D` (and any other drive created), from PowerShell or cmd. Git Bash mangles `/D`.
   - Empty the scratchpad, including any secrets file, after copying any evidence the docs cite into `C:\Nik\Data\…`.

§0.19 (no checkout/restore/reset/stash/clean on other sessions' trees) and §0.21 (linear history) still apply in full.

### 0.23 ‼️ A SAVED AI RESULT IS KEYED ON ITS INPUTS + A RULES VERSION — NEVER ON THE BUILD (owner-mandated, 2026-10-01)

A bank that saves paid AI work (page readings, picture descriptions, near-duplicate verdicts, document titles) is keyed on what decides the
result: the settings, the prompt's own fingerprint, and a hand-raised rules version starting at 1. **Never key one on the
build or assembly identity** — that re-bought every page on every deploy.

- ‼️ **When you change the code a version covers, RAISE that version in the same change.** The versions are
  `VisionDocumentTranscriptionService.RenderRulesVersion` (how a page is rendered and asked — the raw answer bank),
  `VisionDocumentTranscriptionService.AdjudicationRulesVersion` (page acceptance),
  `KnowledgePictureDescriptionBank.DescriptionRulesVersion` and `NearDuplicateRulesVersion` (pictures), and
  `KnowledgeDocumentDescriber.DescribeRulesVersion` (a document's banked title and summary).
- `Clinqet.Communications.UnitTests/Conventions/BankRulesVersionConventionTests.cs` pins the code each version covers. It
  fails with the exact line to write:
  - raise the version if what the code decides changed;
  - for cleanup, renames, refactoring, logging, comments or formatting, update ONLY the pin and never raise the version:
    raising it re-buys every saved result (real AI cost), so raise it only when the LOGIC changed.
- ‼️ Never update the pin without asking "did what it decides change?" That question is the whole point of the guard.
- A new bank of AI results gets the same three things: a version, the "bump when…" comment, and a guard entry.
