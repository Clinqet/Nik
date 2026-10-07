---
description: |
  **DEPLOYMENT & INFRASTRUCTURE AUTOMATION SKILL** — Work on Clinqet ARM templates, deployment scripts, CI/CD pipelines, and Azure resource provisioning. USE FOR: adding new Azure resources, modifying ARM templates, updating deploy.ps1, configuring CI/CD workflows, environment variable mappings, Service Bus queue definitions, storage containers, Cosmos DB provisioning.
---

# CLINQET DEPLOYMENT & INFRASTRUCTURE AUTOMATION — COMPREHENSIVE SKILL

## RECENT CHANGES — 2026-10-06 (the claim/stop link signing key)

See the `clinqet-prepared-providers` skill for the whole feature. What changed HERE:

- **`PreparedProvider__SigningKey`** comes from ONE Key Vault secret (`prepared-provider-link-key`), created once per environment with `Get-OrCreateKeyVaultSecret` and mirrored into every stamp's vault — exactly like the JWT signing key above it.
- ‼️ **It is NEVER rotated.** Rotating it makes every claim and stop-emails link already sitting in somebody's inbox unverifiable, and those links live 60 days.
- **It is wired to THREE hosts** — API, Identity and **Functions** — and it must be in all three `Required*AppSettings` manifests. ‼️ Functions is the host that SIGNS the links: absent there, it falls back to the committed sandbox key and signs links both API hosts then reject, while the gate that exists for the other two stays silent.
- **No new queue, container or Azure resource** was introduced by this programme.
## ABSOLUTE RULES (READ FIRST — APPLIES TO EVERY CHANGE)

- **Comments — terse, only when they earn their place.** Default to no comments; let naming carry the meaning. **However**, write a comment when it captures non-obvious context the code itself cannot show: a hidden invariant, a subtle ordering constraint, a deliberate workaround for a known bug, a defensive choice with a real reason, or an RFC/spec citation that explains *why*. Prefer a single short line. Forbidden: restating WHAT the code does (e.g. `// increment counter` above `counter++`); multi-line narrative blocks explaining design rationale; XML doc summaries on properties whose names already convey intent; commented-out code; `// TODO` without an issue link. When in doubt, delete the comment — but don't strip a *real* WHY-comment just to chase zero.
- **No verbose docstrings on self-evident members.** A property named ``EnableAISpellCorrection`` does NOT need a doc summary. A field named ``_searchEnableAISpellCorrection`` does NOT need a multi-line ``//`` block above it. Trust naming.
- **No commented-out code, no leftover symbols, no ``// TODO`` without an issue link.**

---


## OVERVIEW

> **Per-stamp JWT issuer (2026-07-24).** `Initialize-StampContext` derives
> `$script:IdentityIssuer = "https://identity-$($Region.Slug).$CustomerApexDomain"`, used at all four
> `JwtSettings__Issuer` sites (API app, Identity app, and both paste blocks). The signing key stays env-scoped and
> shared, so the ISSUER is what binds a token to the stamp that minted it — do NOT put `$IdentityBaseUrl` (the
> geo-routed apex) back there, or an India-issued token authenticates on Canada again. `Identity__BaseUrl` must stay
> the apex. See [[clinqet-identity-api]].

Infrastructure-as-Code deployment using ARM templates orchestrated by PowerShell, with GitHub Actions CI/CD for all APIs.

| Component | Path |
|-----------|------|
| ARM templates + scripts | `C:\Nik\azureautomation\` |
| Main API CI/CD | `C:\Nik\clinqetapi\.github\workflows\` |
| Identity API CI/CD | `C:\Nik\clinqetidentity\.github\workflows\` |
| Identity app registration | `C:\Nik\azureautomation\identity.ps1` |

---

## DEPLOYMENT ARCHITECTURE (deploy.ps1)

### 5-Phase Deployment Order

```
Phase 1:  analytics.json   → Log Analytics + 7 App Insights instances
Phase 2a: events.json      → Service Bus namespace + 45 queues + 1 topic + Notification Hub
Phase 2b: storage.json     → Blob storage + 11 containers
Phase 2c: ai.json          → OpenAI + AI Search + Speech + Doc Intelligence
Phase 3a: apps.json        → VNet + DNS + App Service Plan + 5 Web Apps
Phase 3b: functions.json   → Function App (FlexConsumption)
Phase 3c: networking.json  → Front Door + 5 WAFs + 6 custom domains
Phase 3d: apps.json (lock) → Lock web apps to Front Door only
Phase 4:  database.json    → SQL Server + Cosmos DB + Private Endpoints
Phase 4b-4d: Settings      → Fetch keys, merge into Function/API/Identity apps
Phase 4d.5: App RBAC       → ALL data-plane roles for API/Identity/Function (fail-loud, see below)
Phase 4e:  MCP config      → MCP RBAC (fail-loud) + settings merge + restart
Phase 5:  identity.json    → GitHub SP role assignments (optional)
```

### App data-plane RBAC — PHASE 4d.5 ONLY (never earlier)
In Azure every app data plane is **managed identity** (connection strings blanked; `CosmosDb:Endpoint` /
`ServiceBusSettings:FullyQualifiedNamespace` / `StorageConfiguration:AccountUrl` / ACS `Endpoint` set); local dev
uses the **connection strings from the end-of-run paste blocks** (never MI). The one CS holdout in Azure is
`AzureWebJobsStorage` (Functions host internals; NH data plane is SAS-only too). PHASE 4d.5 grants + HARD-VERIFIES
(throw, never a silent WARN) for API + Identity + Function: **Cosmos Built-in Data Contributor** (Cosmos SQL RBAC),
**Storage Blob Data Contributor**, **Service Bus Data Owner**, and **ACS Contributor** (Identity + Function only);
then waits 90s if any grant was new and **restarts the apps** (the CosmosClient caches a boot-time 403 for the
process lifetime). MCP gets the same treatment in PHASE 4e. NEVER move these grants earlier: the old PHASE 2c/2d
best-effort pass ran before the apps (Phase 3) and Cosmos (Phase 4) existed, silently WARN-skipped, and shipped an
IN stamp whose apps all 403'd on /health (2026-07). `Assert-RequiredAppSettings` manifests enforce the MI keys
(`CosmosDb__Endpoint`, `ServiceBusSettings__FullyQualifiedNamespace`, `StorageConfiguration__AccountUrl`,
`AnalyticsSettings__StorageAccountUrl` for API+Function).

### Helper Functions
- `Merge-AppSettings` — Safe read-modify-write of Azure Web App settings
- `Merge-ConnectionStrings` — Same for connection strings
- `Join-ResourceName` — `{NamePrefix}-{base}-{NameSuffix}` naming
- `Join-StorageName` — Strip hyphens for storage accounts (max 24 chars, lowercase, no special chars)
- `Ensure-AdGroup` — Create/verify Azure AD groups

### Parameters
- `NamePrefix` (required) — Prefix for all resource names
- `NameSuffix` (required) — Suffix for all resource names
- `Location` — Azure region
- `SkipPhase5` — Skip GitHub SP role assignments
- `McpContainerStopSeconds` (default 60, range 1–120) — `WEBSITES_CONTAINER_STOP_TIME_LIMIT` on the voice MCP app
  (platform default 5 s). ‼️ Must exceed `Mcp:HostShutdownSeconds` (45): a restart first drains every live India AI
  caller to voicemail (`Plivo:AiDrainSeconds`, see `clinqet-voice-assistant` 2026-09-26b); the host logs an ERROR at start otherwise.

---

## ARM TEMPLATES

### Resource Groups (8 total)

| Template | Resource Group | Resources |
|----------|---------------|-----------|
| `analytics.json` | `{prefix}-analytics-{suffix}` | Log Analytics Workspace, 7 App Insights (API, Identity, Functions, Admin, Partner, Customer, Shared) |
| `events.json` | `{prefix}-events-{suffix}` | Service Bus Namespace (Standard), 45 Queues + 1 Topic, Azure Notification Hub |
| `storage.json` | `{prefix}-storage-{suffix}` | Storage Account (StorageV2, LRS), 11 Blob Containers |
| `ai.json` | `{prefix}-ai-{suffix}` | AI Services Hub, Speech, Doc Intelligence, AI Search (Basic; `-SearchSku free` overrides), OpenAI (7 model deployments) |
| `apps.json` | `{prefix}-apps-{suffix}` | VNet (10.0.0.0/16), DNS Zones, App Service Plan (P0v4 Linux), 5 Web Apps |
| `functions.json` | `{prefix}-functions-{suffix}` | FlexConsumption Plan (FC1), Function App, Function Storage Account |
| `networking.json` | `{prefix}-networking-{suffix}` | Azure Front Door (Standard), 5 WAF Policies, 6 Custom Domains |
| `database.json` | `{prefix}-database-{suffix}` | SQL Server + Identity DB, Cosmos DB (Provisioned), Private Endpoints |

---

## SERVICE BUS QUEUES

‼️ `events.json` is the SOURCE OF TRUTH and currently defines **45 queues + 1 topic** (2026-10-01). The table below is
the hand-kept subset — it was last labelled "25" and had drifted; never trust its length over the template.

Most queues use: lockDuration=PT1M, maxSize=1024MB, TTL=P14D, maxDeliveryCount=5. Session-enabled and
duplicate-detecting queues override those (e.g. `provider-projection`: PT5M lock, P7D TTL, PT5M dup window).

| Queue Name | Session | Purpose |
|------------|---------|---------|
| `admin-alerts` | No | Admin alert notifications |
| `analytics-events` | No | Search/suggest analytics |
| `booking-cancellations` | No | Booking cancellation processing |
| `booking-emails` | No | Booking-related emails |
| `booking-reminders` | No | Upcoming booking reminders |
| `booking-timeout-check` | No | Expired booking detection |
| `broadcast-expiry` | No | Broadcast request expiration |
| `broadcast-processing` | No | Broadcast matching/routing |
| `broadcast-status-updates` | **Yes** | Broadcast status changes (ordered) |
| `broadcast-tiered-expansion` | No | Expand broadcast to wider area |
| `broadcast-update-notifications` | No | Broadcast update notifications |
| `change-feed-failures` | No | Cosmos change feed error handling |
| `customer-identity-sync` | **Yes** | Customer profile sync (ordered) |
| `email-notifications` | No | General email sending |
| `identity-profile-sync` | No | Identity → Cosmos profile sync |
| `invoice-emails` | No | Invoice-related emails |
| `invoice-past-booking-check` | No | Check past bookings for invoicing |
| `login-attempts` | No | Login attempt tracking |
| `marketing-subscriptions` | No | Mailchimp marketing sync |
| `notifications` | No | Push/in-app notifications |
| `provider-confirmation-requests` | No | Provider confirmation requests |
| `provider-projection` | **Yes** | Debounced provider-index projection (Phase 5) — dup-detection PT5M |
| `quote-emails` | No | Quote-related emails |
| `sms-notifications` | No | SMS sending (Twilio) |
| `user-activities` | No | User activity tracking |

### Adding a New Queue
1. Add queue definition in `events.json` (copy existing pattern)
2. Add connection string / queue name to `deploy.ps1` Phase 4b settings merge
3. Add to Function App `local.settings.json` if triggered by it
4. Add to ARM template for Function App app settings
5. Add the queue-name property to `ServiceBusSettings` AND a sender entry in `ServiceBusService`’s `_senders`
   dictionary — a missing sender throws `Sender for queue ‘x’ not found` at the first send, not at startup
6. If the host both produces and consumes it, add the key to `$script:RequiredFunctionAppSettings` so a
   stamp missing it fails the deploy instead of silently using the prod-named queue

---

## STORAGE CONTAINERS (11 in main, 1 in function)

| Container | Public Access | Purpose |
|-----------|---------------|---------|
| `analytics` | None | Analytics Parquet files |
| `bookingattachments` | None | Booking file attachments |
| `broadcast` | None | Broadcast-related media |
| `categoryicons` | Blob | Category/subcategory icons (public CDN) |
| `licensedocuments` | None | Provider license documents |
| `portfoliomedia` | Blob | Provider portfolio images (public CDN) |
| `profilepictures` | Blob | User profile pictures (public CDN) |
| `provider-setup-docs` | None | Provider setup documents |
| `quoteattachments` | None | Quote file attachments |
| `reviewimages` | Blob | Review photos (public CDN) |
| `serviceimages` | Blob | Service listing images (public CDN) |

### Adding a New Container
1. Add container definition in `storage.json`
2. If public: Set `publicAccess: "Blob"`; if private: `publicAccess: "None"`
3. Update `deploy.ps1` if container URL needs to be passed to apps

---

## AI RESOURCES

### OpenAI Model Deployments (`$modelDeployments` in deploy.ps1)
```
gpt-6-luna, gpt-6.1-sol, gpt-5.6-luna (the reader, AiModels.Reader), gpt-5.4-mini (search enrichment, AiModels.Mini),
text-embedding-3-large,
gpt-realtime-2.1-mini, gpt-realtime-2.1, gpt-4o-mini-transcribe
(realtime tiers since 2026-09-25, both version 2026-07-07 and on Azure's SIP list; earlier gpt-realtime-mini + gpt-realtime-2)
```
‼️ A deployment created OUTSIDE `$modelDeployments` is never visited by the RAI content-filter loop and
serves UNFILTERED. `gpt-5.6-sol` (version `2026-07-09`, `NoAutoUpgrade`) is the document-transcription
VERIFIER only, and it is shown provider-uploaded pixels, so it must stay in that array. It is pinned because
the accepted page-cache key carries its name through `ValidationFingerprint`: a silent model change would
replay pages adjudicated by a model that is no longer there. Its app settings
(`Voice__Knowledge__Vision__VerifyDeploymentName` on BOTH the Function App and the API app, plus
`AIAssistant__ProviderAttachmentProcessing__Vision__VerifyDeploymentName` on the API) are stamped from the
Merge blocks and listed in the required-app-setting manifests.

### Other AI Services
- **AI Search**: Basic tier by default (`-SearchSku` overrides; free falls back automatically only when basic has no capacity in any approved region), index for services search
- **Speech**: F0 tier, speech-to-text
- **Doc Intelligence**: F0 tier, document processing
- **AI Services Hub**: S0, unified AI access

---

## WEB APPS (5)

| App | Runtime | Framework | Notes |
|-----|---------|-----------|-------|
| API | DOTNETCORE\|10.0 | .NET 10 | SystemAssigned identity, VNet integrated |
| Identity | DOTNETCORE\|10.0 | .NET 10 | SystemAssigned identity, VNet integrated |
| Admin | NODE\|22-lts | React 18 CRA + Express | — |
| Provider | NODE\|22-lts | Next.js 16 | Uses startup.sh |
| Customer | NODE\|22-lts | Next.js 16 | Uses startup.sh |

### Function App
- **Plan**: FlexConsumption (FC1)
- **Runtime**: dotnet-isolated, .NET 10.0
- **Max instances**: 100
- **Memory**: 2048MB
- **Identity**: SystemAssigned

---

## ENVIRONMENT VARIABLE MAPPINGS

### Function App Settings (merged in Phase 4b)
```
ServiceBus: ConnectionString (send-listen), every queue name (see events.json for the authoritative list)
Cosmos: ConnectionString, DatabaseName, container names
AI Search: Endpoint, ApiKey, IndexName
OpenAI: Endpoint, ApiKey, model deployment names
Storage: ConnectionString, container names
Notification Hub: ConnectionString (send-listen rule = Listen+Send), HubName — SAS only; Managed Identity is NOT supported for the NH data plane, so this is the one connection-string holdout
ClinqetApi: BaseUrl, InternalApiKey
SQL: ConnectionString
```

### Main API Settings (merged in Phase 4c)
```
ServiceBus: ConnectionString (send-only), queue names
Cosmos: ConnectionString, DatabaseName, container names
AI: Search (endpoint, key), OpenAI (endpoint, key), Speech, Doc Intelligence
Storage: ConnectionString, FrontDoorBaseUrl, container names
Analytics: StorageConnectionString
```

‼️ **`Payments__Regions__N` (API only) scopes the stamp**: NA = `us`,`ca`; India = `in`. The base `appsettings.json` carries NO
list and the class default is empty (a base list merges BY INDEX, so India bound as `in,ca,in`), the API refuses to boot
on an empty, repeated or unknown list, and `$script:RequiredApiAppSettings` asserts `Payments__Regions__0` after deploy.
It scopes billing AND the voice own-number settings (admin editor + runtime).

### Identity API Settings (merged in Phase 4d)
```
Cosmos: ConnectionString, DatabaseName
ServiceBus: ConnectionString (send-only)
Storage: ConnectionString, FrontDoorBaseUrl
SQL: ConnectionString
Notification Hub: ConnectionString (send-listen = Listen+Send), HubName — device registration (DeviceTokenController); SAS only, no Managed Identity
```

---

## CI/CD PIPELINES

### Structure — reusable workflows + per-env/region wrappers (6 apps)

Six apps each ship a CI/CD set under `<app>/.github/workflows/`:
`clinqetapi`, `clinqetidentity`, `clinqetfunctions`, `clinqetwebadmin`, `clinqetwebpartnerapp`, `clinqetwebuserapp`.

```
Per app:
  _build.yml                         → reusable build  (workflow_call)
  _deploy.yml                        → reusable deploy (workflow_call)
  build-{dev,uat,prod}.yml           → build wrappers  (push to master / release / production)
  deploy-{dev,uat,prod}-{ca,in}.yml  → deploy wrappers, one per environment × region stamp
```
Functions deploy wrappers are named `deploy-communications-{dev,uat,prod}-{ca,in}.yml`. Two region stamps exist: `ca` (Canada Central) and `in` (Central India). Each deploy wrapper calls `_deploy.yml` with `environment`, `region`, `env_secret_suffix` (DEV|UAT|PRODUCTION), `region_secret_suffix` (CA|IN), `creds_tier` (NONPROD|PROD), the app-name secret prefix, and `default_health_check_url`.

### Per-environment secrets (suffix `_{ENV}_{REGION}`)
- `AZURE_CREDENTIALS_{NONPROD|PROD}` — one service principal per tier
- `AZURE_WEBAPP_NAME_{DEV|UAT|PRODUCTION}_{CA|IN}` (web/api/identity) · `AZURE_FUNCTIONAPP_COMMUNICATIONS_NAME_{…}_{…}` (functions)
- `AZURE_RESOURCE_GROUP_{…}_{…}`
- `HEALTH_CHECK_URL_{…}_{…}` — optional override of the wrapper's `default_health_check_url`
- `CLINQET_ACCESS_TOKEN` — cross-repo dependency checkout (backends)

### Health-check URL convention (deploy wrapper `default_health_check_url`)
The post-deploy health check targets the **region-pinned Front Door host of the stamp being deployed**, so it verifies that exact stamp. The host is the per-stamp custom domain `deploy.ps1` creates (`$perStampApps` + hostname rule, deploy.ps1 ~3543-3553):
- env-apex: prod = `clinket.com`, dev = `dev.clinket.com`, uat = `uat.clinket.com`
- api / identity / partner / admin / function → `https://<app>-<stamp>.<env-apex>` (e.g. `api-ca.dev.clinket.com`, `identity-in.clinket.com`)
- customer → `https://<stamp>.<env-apex>` (e.g. `ca.dev.clinket.com`, `in.clinket.com`)

NEVER use the hyphen-env form `<app>-<stamp>-<env>.clinket.com` or the transposed `<env>-<stamp>.clinket.com` — those hosts do not exist (Front Door creates only the dot form). A `403` from the host is treated as healthy (apps are locked to Front Door only).

**Web apps probe `…/api/health`, NOT `/`.** Customer + partner apps run Next.js Basic-Auth middleware on non-prod (`deploy.ps1` sets `BASIC_AUTH_PASSWORD`; empty on prod), so the root `/` returns **401** there — and `401` is NOT treated as healthy, so a root probe fails (this was the `in.dev.clinket.com` health-check failure). Each web app exposes a dedicated auth-exempt liveness endpoint `/api/health` returning `200` + `Cache-Control: no-store` + `X-Robots-Tag: noindex` (user: `app/api/health/route.js`; partner: `src/app/api/health/route.js`; admin: Express route in `server/server.js`). The Next middleware matcher already excludes `api/health`/`health`; the noindex header keeps it unindexed in every env. All 18 web wrappers set `default_health_check_url: 'https://<host>/api/health'`. Per-stamp hosts are uncached, so probes always hit fresh origin.

### Front Door cache purge (in `_deploy.yml`)
Front Door's purge limit is **`#domains × #content-paths ≤ 100` URLs** — counted per request AND across concurrent in-flight purges; a new purge submitted before the prior batch completes is rejected (verified vs MS docs 2026-05-29).
- **Backends (api / identity / functions) do NOT purge.** Their Front Door routes have no `cacheConfiguration` and the Main API stamps `Cache-Control: no-store` on every response, so nothing is cached — there is nothing to invalidate. Their `_deploy.yml` has no purge step and no `front_door_*` inputs.
- **Web apps (admin / partner / customer) purge exactly ONE domain — their cached geo-routed host.** Each web `_deploy.yml` takes a `front_door_purge_domain` input (customer → `www.<apex>`, partner → `business.<apex>`, admin → `admin.<apex>`) and runs `az afd endpoint purge … --domains "$PURGE_DOMAIN" --content-paths '/*'` with bounded retry, hard-failing if it cannot submit (stale UI hitting the new API is a real bug — never swallow a failed purge). **A bare `/*` with NO `--domains` is WRONG: it fans out to EVERY custom domain on the shared endpoint (N URLs) and trips the 100-URL cap — the recurring "We can only accept 100 paths for purging concurrently" failure.** Scoping `--domains` to the single host makes every purge exactly 1 URL. **Only the geo-routed app domains cache** (route-level `cacheConfiguration` + `UiCacheRules`); per-stamp region hosts (`in.dev…`, `business-in…`) have no `cacheConfiguration` (networking-perstamp-health.json) → uncached → never need purging.

### Build steps (backends)
1. Checkout app + 3 dependency repos (Core, Shared, Infrastructure) via `CLINQET_ACCESS_TOKEN`
2. .NET 10 → restore / build / unit + integration tests (Testcontainers) → `dotnet publish` → `buildinfo.json`
3. Functions: pre-zip with `zip -r` preserving the `.azurefunctions/` directory

### Deploy steps
1. Resolve build run → download artifact → assert `buildinfo.json` environment matches
2. Azure login (tier creds) → deploy. **Web apps:** `azure/webapps-deploy@v3` → restart. **Functions (Flex Consumption = One Deploy only):** `Azure/functions-action@v1` (`sku: flexconsumption`, `remote-build: false`, `package: publish/function-app.zip` so the prebuilt `.azurefunctions/` survives) via the prior `azure/login` RBAC (basic-auth publishing is disabled) — **no manual restart** (One Deploy auto-activates the package). **Never `az … config-zip` on Flex**: it is Zip Deploy (unsupported on Flex) and its post-deploy sync-triggers/health poll hangs intermittently to the 30-min timeout (azure-cli #33184). Readiness is verified separately by the `/api/health` step (4).
3. Web apps only: purge Front Door cache scoped to the app's single cached geo-routed `--domains` host (retry; hard-fail on persistent failure)
4. Health check the region-pinned URL at `/api/health` (auth-exempt; `403` still treated as healthy)

### Concurrency
Each deploy wrapper uses a concurrency group to prevent parallel deploys of the same env/region (e.g. functions: `deploy-prod-ca-communications`):
```yaml
concurrency:
  group: deploy-{env}-{region}-{app}
  cancel-in-progress: false
```

---

## DEPLOYER (RUNNER) IP POLICY

Nothing is ever whitelisted PERMANENTLY without an explicit argument. `-AllowedIpAddresses` = deliberate dev/admin IPs -> Admin WAF + SQL firewall + Key Vault firewall (kept). `-DeployerIpAddresses` = runner egress IP -> Key Vault firewall ONLY (kept — explicit intent). With NO argument: the runner IP is resolved (api.ipify.org) and allowed on the vault firewall TRANSIENTLY, then REMOVED at the end of PHASE 2e (Remove-AzKeyVaultNetworkRule + verify) — the run ends with nothing whitelisted. Required because the vaults are firewall-Deny and PHASE 2e manages secrets from the runner (Cloud Shell is not a KV trusted service — no way around the firewall). SQL, Cosmos and the Admin WAF NEVER see the runner IP under any path; Cosmos never receives client IPs at all. The PHASE 4 managed-identity SQL grant works from Cloud Shell via the non-prod AllowAllWindowsAzureIps rule; a local-laptop run needs `-AllowedIpAddresses` for that step (non-fatal WARN otherwise).

---
## identity.ps1

Creates Azure AD App Registration + Service Principal + client secret for GitHub Actions deployment:
1. Registers an Azure AD application
2. Creates a service principal
3. Generates client secret
4. Outputs `AZURE_CREDENTIALS` JSON: `{clientId, clientSecret, subscriptionId, tenantId}`

Deploy.ps1 Phase 5 assigns roles to this SP.

---

## DATABASE (database.json)

### Cosmos DB
- Capacity per stamp: **India = Provisioned** (claims the subscription's ONE free-tier slot - 1000 RU/25 GB - in every env: prod, uat, dev); **every other stamp = Serverless** (free tier impossible on serverless; Canada never competes for India's slot)
- Consistency: Session
- Throughput Limit: 1000 RU account cap (Provisioned mode only)
- Backup: Continuous 7 days
- Zone redundancy: **automatic wherever it is FREE, flag-only where it costs.** `$cosmosAzRequested = -CosmosZoneRedundant OR CosmosCapacityMode -eq "Provisioned"` - the Provisioned stamp (whichever `-CosmosFreeTierRegion` selects; not hardcoded to India) gets AZ automatically because 100% of its throughput is the autoscale shared DB and the AZ premium is waived for autoscale. Serverless stamps pay 1.25x/RU with AZ so they stay off unless `-CosmosZoneRedundant` is passed. If the free-tier handler flips a stamp to Serverless mid-run, auto-AZ is dropped with it (flag keeps it). When requested, AZ is tried FIRST; capacity/AZ-unsupported errors drop AZ in the SAME region, then the ladder moves down the fallback chain (AZ reset to the requested value per new region). Existing accounts always keep their current AZ + region (both immutable). Prod placement is never changed (in-region, requested AZ; waits/retries only). The end-of-run DEGRADED notice fires only when AZ was requested but not achieved, or the account left the stamp region.
- **AZ cost (our exact setup, verified):** the AZ premium is waived ONLY for autoscale and multi-region-write. India stamp = Provisioned account whose shared DB throughput IS autoscale (cosmosindexsetup `CreateAutoscaleThroughput(1000)`, free-tier covered) => AZ would be free there. Every other stamp = Serverless (autoscale impossible; the code path falls back to a no-throughput DB) => AZ bills EVERY consumed RU at **1.25x**. That serverless premium is why AZ defaults off.
- **Region fallback (non-prod only; prod never leaves the stamp region):** latency-ordered chains in `$COSMOS_REGION_FALLBACK` (script scope, deploy.ps1) - Canada Central -> East US 2 -> East US -> Canada East; **Central India -> South India -> West India (India-only, data residency)**. A fallback account gets a **region-suffixed name** (`<base>-eastus2` via `Get-CosmosRegionSuffixedName`) because the same-named SQL server pins the bare name to the stamp region (ARM `InvalidResourceLocation` forbids same-name/different-location in one RG). `Resolve-CosmosAccountName` (called in `Initialize-StampContext`) adopts whichever account actually exists so re-runs, RBAC, keys/endpoint, locks and `CosmosDb__Region` all target the real one. The template's write region is `cosmosLocation` (NOT `location` - the PE stays in the stamp VNet via `location`).

### SQL Server
- Version: 12.0
- Auth: Azure AD-only by default (hybrid optional)
- Database: `clinket` in prod, `clinket-{env}` otherwise (S0 tier) — holds identity, billing, promo and teams; renamed from `identity` 2026-10-02. The name is set in TWO places that must change together: `$sqlDatabaseName` in `deploy.ps1` and `SqlDatabaseInitializer.DatabaseBaseName` in `cosmosindexsetup`
- Private Endpoints via pe-subnet

---

## NETWORKING (networking.json)

### Azure Front Door (Standard)
- 5 WAF policies (one per web app)
- 6 custom domains
- DDoS protection
- SSL termination

### Front Door request-header rules (`ClientInfoHeaders`)
`networking.json` defines the `ClientInfoHeaders` rule set that appends `X-Client-Country: {geo_country}` + `X-Client-IP` on every route; the API resolves the country from it (see `clinqet-search-discovery`). **Per-stamp direct-addressing routes** (`networking-perstamp-health.json` — the region-pinned `api-<stamp>` / `identity-<stamp>` hosts the web apps actually call via `NEXT_PUBLIC_BASE_API`) MUST attach it too: they declare it in the per-stamp template, and `deploy.ps1` re-asserts it post-deploy via `Sync-ClientInfoHeadersToRoutes` (idempotent; skips storage/apex routes). Omitting it = empty country header at the origin (the 2026-05-30 SearchController regression).
- **Per-stamp WAF rate limits** (`networking-perstamp-health.json`, one healthcheck WAF for every per-stamp host but admin): `RateLimitPerIPApi` gives `api-<stamp>` the apex api WAF's 500 req/min/IP (signed-in apps send every API call to their stamp host); `RateLimitPerIP` keeps every other per-stamp host at 200 (Host condition `BeginsWith api-`, lowercased, negated).

### Assets serving — geo entry + region-pinned hosts (data residency)
Storage is **sharded per stamp** (each stamp has its OWN blob account); a blob exists in exactly ONE region's account. Two ways to address it:
- **Geo entry** `assets.<apex>` (`networking.json`, geo `storage-route` + GeoRouting override → viewer-country picks storage). Kept as a direct-call entry, like `api.<apex>`. **Non-deterministic across regions** — only correct when viewer-country == data-region.
- **Region-pinned** `assets-<stamp>.<apex>` (`networking-perstamp-assets.json`, runs per stamp in PHASE 3c-perstamp-assets). Pinned route → that stamp's `storage-origin-group-<stamp>` with **no** geo override, reusing the shared `StorageCacheRules` rule set (the `NoCachePrivateContainers` rule keeps SAS'd private blobs off the edge) + storage WAF. A blob deterministically resolves to its owning region's storage **regardless of viewer geo**.

**Each stamp's API/Functions emit the region-pinned host:** `deploy.ps1` sets `StorageConfiguration__FrontDoorBaseUrl = https://assets-<stamp>.<apex>` (`$AssetsRegionalBaseUrl`, NOT the geo `assets.<apex>`). This fixes the cross-region asset mismatch (e.g. a viewer on the per-stamp `in.<apex>` host whose assets would otherwise geo-route to the wrong region's storage → 404) and the private-SAS cross-region failure (SAS signed by the owning account). Frontends allowlist BOTH geo + `assets-{in,ca}.*` hosts in `next.config.mjs` `images.remotePatterns`; the layout warms DNS for the build's own `assets-<region>` host. The per-stamp assets route also makes `storage-origin-group-<stamp>` a route default → clears the cosmetic "Unassociated" badge on the non-primary stamp's storage origin group.

**Upload SAS routing (gated, code-side).** Client uploads use the modern `GenerateSasUrlAsync`/`GenerateBulkSasUrlsAsync` path, which issues the upload SAS on the region FD host so the browser uploads **through** Front Door (WAF scan + hides the blob host). Toggle in `AzureStorageService` via `StorageConfiguration.RouteUploadsThroughFrontDoor` (default `true`; `false` = direct-to-blob) + `DirectUploadContainers` (CSV per-container carve-out, e.g. large docs). **Uniform value ⇒ Main-API `appsettings.json` only, NOT `deploy.ps1`** (deploy.ps1 injects region-specific values only). Identity/Functions issue no upload SAS, so the toggle is Main-API-only.

### VNet Layout (apps.json)
- Address space: 10.0.0.0/16
- Subnets: app-subnet, pe-subnet (private endpoints), function-subnet

---

## RULES FOR INFRASTRUCTURE CHANGES

1. **New Azure resource** → Add to appropriate ARM template + `deploy.ps1`
2. **New Service Bus queue** → Add to `events.json` + settings merge in `deploy.ps1` + `local.settings.json` if function-triggered
3. **New storage container** → Add to `storage.json`
4. **New app setting needed at function runtime** → Must go in `local.settings.json` AND ARM template AND `deploy.ps1`
5. **New secret** → Placeholder in `appsettings.json`, real value via `deploy.ps1`/ARM, never committed
6. **New Cosmos container** → Added via code (`cosmosindexsetup`), not ARM

---

## CART / BASKET

### Service Bus Queue
- **Queue name**: `cart-reminders`
- **ARM template**: `C:\Nik\azureautomation\events.json` — defines the queue with standard properties
- **Connection**: Uses the main Service Bus connection string

### Settings
- `CartSettings` in Main API `appsettings.json` — cart expiry, max items/providers, reminders, rate limiting
- `CartSettings` in Function App `appsettings.json` — same section for reminder processing
- `cart-reminders` queue connection via `ServiceBusConnection` in Function App `local.settings.json` (must also be in ARM/deploy.ps1)

---

## POST-DEPLOY LOCAL CONFIG RECONCILIATION (run after EVERY `deploy.ps1`)

`deploy.ps1` finishes by printing a per-stamp **"PASTE INTO …"** block for each app. **That printed output is the single source of truth** — reconcile EVERY field in it into local config. **Not one field may be skipped.** Reconcile only from the deploy output the user shares — never from any other file (see "`.deploy-secrets` is DELETED" below).

### Files to reconcile (the deploy prints blocks for only the first three apps)
| App | Stamp files (gitignored, real secrets) | Shared layer |
|-----|----------------------------------------|--------------|
| Identity API | `clinqetidentity\Clinqet.Identity.API\appsettings.{ca,in}.json` | `…\appsettings.json` |
| Main API | `clinqetapi\Clinqet.API\appsettings.{ca,in}.json` | `…\appsettings.json` |
| Function App | `clinqetfunctions\Clinqet.Communications\local.settings.{ca,in}.json` **+ the active `local.settings.json`** (a copy of the `CLINKET_REGION` stamp) | `…\appsettings.json` |
| **cosmosindexsetup** | `cosmosindexsetup\appsettings.{ca,in}.json` — **NO deploy block is printed for it**, yet it holds stamp-specific `CosmosDb:ConnectionString`, `Search:ServiceEndpoint`+`ApiKey`, `ConnectionStrings:IdentityDb` (SQL — read in `Program.cs` for seeding), `AzureStorage:ConnectionString`. Reconcile these from the matching stamp's deploy values. | — |

### Layering — where each field goes (never duplicate, never leave a placeholder)
- **Shared values (identical across stamps) → base `appsettings.json`.** This INCLUDES shared *secrets*: `JwtSettings:SecretKey`, `AzureCommunicationServices:*`, `AnalyticsSettings:HashSalt`, `AzureAIFoundry:ApiKey`, `AIService:ApiKey`, plus queue names, container names, AI deployment names, redirect URIs, `AllowedOrigins`, `QRCodeSettings`, etc.
- **Stamp-specific values (differ per stamp) → `appsettings.<stamp>.json` / `local.settings.<stamp>.json`:** App Insights connection string, `CosmosDb:ConnectionString`+`Region`, `ServiceBusSettings:ConnectionString`, `StorageConfiguration:ConnectionString`, `AnalyticsSettings:StorageConnectionString`, `Search:Topology:Services:{Public,Private}:Endpoint`+`ApiKey` and `Search:Topology:Public:Countries:<ISO2>:{ServiceAlias,ProviderAlias,Status}` (all emitted by `Add-SearchTopologySettings`, never hand-written), `AzureSpeech:ApiKey`+`Region`, `AzureDocumentIntelligence:Endpoint`+`ApiKey`, `AzureNotificationHubSettings:ConnectionString`, `ConnectionStrings:DefaultConnection` (SQL).
- A shared value lives in base ONLY (never copied into both stamp files); a stamp-specific value lives in the stamp file ONLY.
- **Per-app, not blanket — verify the app's code reads a field before adding it.** `deploy.ps1` can over-emit a setting to an app that never reads it. Account for EVERY deploy field, but resolve each as either *reconcile into that app's config* (the app's code reads it) OR *deploy over-emit → drop it from that app's `deploy.ps1` block* (confirm by grepping the app for the setting / its consumer) — never add config an app does not read (§ no orphan settings). Worked example: `ServiceApproval:ContentValidationDeploymentName`/`CategoryValidationDeploymentName` are read ONLY by the Function App (`AICompletionService.ValidateServiceAsync` via `SearchIndexSyncFunction`); the Main API defers AI validation to the Function (`ServiceController.ProcessServiceApprovalAsync` → `PendingAIValidation`) and never reads them, so they belong in the Function config only and were removed from the API blocks of `deploy.ps1`.

### CORS origins — multi-region union, two layers, dev-only localhost
- `deploy.ps1` computes the allowed-origin union ONCE (near the base-URL block) from `$CustomerApexDomain` + `$REGIONS`: per app = the geo-routed host PLUS each per-stamp host (customer `<stamp>.<apex>`, others `<app>-<stamp>.<apex>`). Adding a region to `$REGIONS` auto-extends CORS — never hand-list origins. `Add-IndexedAppSettings` expands each array into contiguous `…__0..N` App Settings (`$B2CWebOrigins`/`$AdminWebOrigins` for the API, `$PartnerWebOrigins`/`$AdminWebOrigins`/`$ClinketWebOrigins` for Identity).
- **Two layers, kept in sync:** ASP.NET (Main API `B2CPolicy` = `AllowedOrigins` ∪ `Admin:AllowedOrigins`, merged in `CorsOriginResolver`; Identity `AllowedOrigins:Partner|Admin|Clinket`, read in each `Program.cs`) AND Azure App Service platform CORS (`apps.json` `siteConfig.cors`, fed `corsAllowedOrigins = $appCorsAllowedOrigins`). Update both together.
- **Localhost is DEV-ONLY** — injected by `deploy.ps1` (`$LocalDevOrigins`, gated on `$Environment -eq 'dev'`), NEVER in base `appsettings.json`.
- **Index-merge leak guard:** ASP.NET merges array config by index, and base `appsettings.json` (always loaded) is overridden index-for-index by the injected App Settings, NOT replaced. So base's `AllowedOrigins` length MUST stay ≤ the smallest per-env injected length (uat/prod), else trailing base entries (e.g. dev localhost) leak into uat/prod. Keep base = the env-shaped host list with NO localhost.
- **Blob storage CORS uses the SAME union.** `$storageCorsAllowedOrigins` = `@($PartnerWebOrigins + $AdminWebOrigins + $CustomerWebOrigins + $LocalDevOrigins | Select-Object -Unique)` — browser-direct SAS→blob `PUT` uploads come from the web frontends, so per-stamp hosts are required here too. Fed to `storage.json` corsRules via the `corsAllowedOrigins` param; keep in sync with the ASP.NET/app origin lists.

### `JwtSettings:SecretKey` — MUST be reconciled into base (do NOT skip it)
The deploy prints the real shared JWT key in every Identity/API block; base ships a `DevOnly…` placeholder. The CFG-13 guard (`builder.Environment.IsProduction()`, Identity `Program.cs` ~557 / API `Program.cs` ~202) rejects the placeholder *only in Production*, so a local run boots either way — **but the deploy provides the real shared value and it MUST replace the placeholder in base**, exactly as `AnalyticsSettings:HashSalt` already does (same Production-gated guard, real value carried in base). Treat it like any other shared secret. Identical across stamps → base, never the stamp files.

### Function-app specifics
- Deploy prints `__`; local `local.settings` uses `:` (only `AzureFunctionsJobHost__*` keeps `__`). Same value, different notation — normalize `__`↔`:` when comparing.
- Trigger-binding values the **host** resolves via `%…%` MUST live in `local.settings` (NOT base `appsettings.json`): all triggered queue names, the change-feed monitored container `CosmosDb:ContainerNames:ProviderData`, `CosmosDb:ChangeFeed:*`, and every timer CRON — `RecommendationSettings:TimerSchedule`, `Search:VectorRecovery:Schedule`, `Search:Judge:TimerSchedule`, `AnalyticsCompactionSettings:CronExpression`. App-level settings (AI keys, the other six container names, etc.) live in base `appsettings.json`. If a `%…%` binding value a function needs is absent from the deploy block (e.g. `Search:Judge:TimerSchedule`), KEEP it in `local.settings` and flag the deploy gap — never delete it.

### `.deploy-secrets` is DELETED - never recreate it
`azureautomation\.deploy-secrets\` was **removed permanently.** ALL deploy-time secrets - the message-encryption keyset, the env-scoped JWT signing key (`jwt-signing-key`), and the per-stamp SQL admin password (`sql-admin-password`) - live ONLY in the per-region Key Vault (`clinket-kv-<stamp>[-env]`), create-if-not-exists, never rotated on redeploy. The deploy principal manages them (Key Vault Secrets Officer); apps resolve them via managed identity (Key Vault Secrets User + `@Microsoft.KeyVault(...)` references). PHASE 2e provisions the vault AFTER apps+functions deploy and BEFORE PHASE 4. **Never reintroduce `.deploy-secrets` or any local deploy-secret file.** Reconcile local config from the deploy OUTPUT (the dev/uat printout), never from a secret file.

### Verify deterministically
Materialize each printed block to a temp JSON file and diff it against the *merged* local config (base ← stamp override; for functions, base `appsettings.json` ← `local.settings.<stamp>` Values), normalizing `__`↔`:`. **Require 0 MISSING and 0 MISMATCH for every block.** `bin/`/`obj/` copies are build output, not source — they regenerate on build; never hand-edit them.

---

## CHECKLIST

- [ ] After a deploy: EVERY field in EVERY printed paste block reconciled into local config — verified 0 MISSING / 0 MISMATCH (see "POST-DEPLOY LOCAL CONFIG RECONCILIATION")
- [ ] `JwtSettings:SecretKey` in base = real deploy value, not the `DevOnly…` placeholder
- [ ] `cosmosindexsetup\appsettings.{ca,in}.json` reconciled (no deploy block is printed for it)
- [ ] No `.deploy-secrets/` (or any local deploy-secret file) exists or is referenced; all deploy-time secrets live in the per-region Key Vault
- [ ] New Azure resource added to correct ARM template
- [ ] deploy.ps1 updated with settings merge for affected apps
- [ ] local.settings.json updated if function runtime needs it
- [ ] ARM template parameters documented
- [ ] No secrets committed (placeholders only)
- [ ] Naming follows `{prefix}-{base}-{suffix}` convention
- [ ] Storage names follow max 24 chars, lowercase, no hyphens
- [ ] CI/CD workflows don't need changes (unless new repo dependency)
- [ ] Queue maxDeliveryCount and TTL match existing patterns

## WhatsApp (Meta Cloud API) — Phase-1 config/infra (2026-06-01)

Per-stamp (one Meta App+WABA+number per region). Full feature detail in `clinqet-whatsapp`; the deploy/ARM surface:
- **Service Bus queues (`events.json`, maxDeliveryCount 5):** `whatsapp-outbound`, `whatsapp-inbound`, `whatsapp-status` (+`$queueSuffix`). `inbound` is created but has NO Phase-1 consumer (Phase 2).
- **`deploy.ps1` real-apply (`Merge-AppSettings`, NOT the emit-only `$apiSettings`/`$functionAppSettings`/`$identityApiSettings` print dicts):**
  - **API** → `ServiceBusSettings__WhatsAppOutboundQueueName` ONLY (the API dispatches but never sends to Meta / never triggers).
  - **Functions** → `WhatsApp{Outbound,Inbound,Status}QueueName` (triggers) + `WhatsApp__PhoneNumberId` (plain per-region app setting from `-WhatsAppPhoneNumberId{In,Ca}`) + 3 KV-ref secrets `WhatsApp__{Token,AppSecret,WebhookVerifyToken}` → per-stamp vault secrets `whatsapp-{token,app-secret,webhook-verify-token}` via `Resolve-KeyVaultSecretRef`. Params `-WhatsAppToken/-WhatsAppAppSecret/-WhatsAppWebhookVerifyToken` (defaults = the committed shared values, identical across regions+envs). **Write rule:** explicit param override wins (overwrite vault, new version); omitted ⇒ seed the default only when the secret is absent, so a separate out-of-band/rotated vault value is preserved. Unversioned KV ref ⇒ App Setting always resolves to current. `WabaId`/`AppId` NOT wired (unused).
  - **Identity** → `WhatsApp__PhoneNumberId` (plain) + `WhatsApp__Token` (KV ref to the SAME `whatsapp-token` secret) only (sends OTP inline; no webhook → no AppSecret/VerifyToken). NO queue names.
  - Both Functions + Identity managed identities already hold Secrets-User on `clinket-kv-<stamp>` (msg-enc/JWT) — no new KV grant needed; `keyvault.json` has NO WhatsApp decl.
- **Function `local.settings.{json,in,ca}`:** the trigger-binding queue names `ServiceBusSettings:WhatsApp{Outbound,Status}QueueName` (`:` notation, the `%...%`-resolved triggers). NOT inbound (no trigger).
- **`appsettings.json` (committed, shared base — NO per-region `.in/.ca` WhatsApp):** API = `WhatsApp:{LanguageMap,Templates,Consent:RateLimiting}`; Functions = `WhatsApp:{GraphBaseUrl,ApiVersion,IdempotencyTtlSeconds,InvoiceDocumentSasExpiryMinutes,FailureClassification,LanguageMap,Templates}`; Identity = `WhatsApp:{GraphBaseUrl,ApiVersion,LanguageMap,OtpTemplates,Templates}`. Secrets/per-stamp ids are KV-ref only (never committed). Class-defaults in `WhatsAppSettings` mirror these (scalars); list/dict defaults empty (binder-append rule).
- **Storage (`storage.json`):** private `invoicedocuments` blob container + lifecycle `invoicedocuments-lifecycle-policy` (auto-delete after `invoiceDocumentRetentionDays` param, default 90) + `deploy.ps1` Function `StorageConfiguration__Containers__InvoiceDocuments`. Holds invoice PDFs for the WhatsApp document header (FD-served read SAS).
- **Storage (`storage.json`, 2026-08-21):** lifecycle `provider-knowledge-sent-lifecycle-policy` auto-deletes the receptionist's sent-material PDFs under `provider-knowledge/_sent/` after the same `invoiceDocumentRetentionDays` (no new container, no new parameter; the WhatsApp read SAS is 12 h). `provider-knowledge/{businessId}/` itself (the owner's uploaded material + `_artifacts`) has NO lifecycle rule by design - it is deleted with the document / the business.
- **Storage (`storage.json`, 2026-09-01):** lifecycle `ocr-page-cache-lifecycle-policy` — the vision page-cache blobs under `provider-knowledge/_ocr/` and `provider-setup-docs/_ocr/` tier to Cool after **30 days without being read** (`enableAutoTierToHotFromCool` brings a re-read bank back to Hot) and are
  deleted after **180 days without being read** — by LAST ACCESS since 2026-10-02 (the blob service enables
  `lastAccessTimeTrackingPolicy`, daily, block blobs; the rule used to count from the WRITE and cooled banks still in use).
  The 2026-10-03 banks sit under the same prefixes, so the rule covers them with no ARM change: raw AI answers
  (`_ocr/{biz}/{doc}/{hash}/raw/`), the describe bank (`_ocr/{biz}/{doc}/describe-{key}.json`) and the setup DI read
  (`provider-setup-docs/_ocr/{biz}/setup/{hash}/di.json.gz`).
  Literal container-rooted prefixes; no new container, parameter or `deploy.ps1` key. The cache is also deleted with its document (`KnowledgeDocumentDataPurger`) and with the business (`BusinessClosureTeardown`, both containers). **Docnet.Core native (`pdfium.so`)** rides `Clinqet.Infrastructure`'s package graph: a RID-specific publish (`-r linux-x64`) flattens it to the app root, a portable publish keeps `runtimes/linux/native/pdfium.so` — both resolve through .NET's native probing. Verified 2026-09-02 by publishing BOTH hosts with the CI flags (API `--runtime linux-x64 --self-contained false`: `pdfium.so` at the app root; Functions portable: `runtimes/linux/native/pdfium.so` + its deps.json entry); execution on the Linux hosts themselves is proven only by the first deployment (owner deploys).

## Key Vault network lock-down — private endpoint (2026-06-03)

Every per-stamp `clinket-kv-<stamp>` is network-restricted (portal: "specific virtual networks and IP addresses" — `publicNetworkAccess: Enabled` + `networkAcls.defaultAction: Deny`). Apps reach it via a **private endpoint**; the deployer reaches it via an **IP allow-rule**. **Service endpoints are NOT used** — App Service AND Flex Consumption Key Vault *references* do NOT resolve over service-endpoint-restricted vaults (documented Microsoft limitation); a **private endpoint is the only working option**.
- **`keyvault.json`:** `networkAcls` (bypass AzureServices, defaultAction Deny, `ipRules` from `allowedIpAddresses` param via a `variables.copy` that maps each IP → `{value:ip}`, virtualNetworkRules []) + a `Microsoft.Network/privateEndpoints` (`groupIds: ["vault"]`) in `pe-subnet` + `privateDnsZoneGroups` → `privatelink.vaultcore.azure.net`. New params: `peSubnetId`, `keyVaultPrivateDnsZoneId`, `allowedIpAddresses`.
- **`apps.json`** (owns the VNet): added the `privatelink.vaultcore.azure.net` private DNS zone + VNet link (mirrors the SQL/Cosmos zones) and a NEW `function-subnet` (10.0.3.0/26) delegated to `Microsoft.App/environments` (Flex VNet integration — can't reuse `default`, which is `Microsoft.Web/serverFarms`-delegated). Outputs: `privateDnsZoneIdKeyVault`, `functionSubnetId`. API/Identity already VNet-integrate `default` + `vnetRouteAllEnabled:true` ⇒ resolve KV refs via the PE.
- **`functions.json`:** the Flex Consumption Function App gains `properties.virtualNetworkSubnetId` (param `vnetIntegrationSubnetId`, `json('null')` when empty) ⇒ outbound VNet integration ⇒ resolves msg-enc + WhatsApp KV refs via the PE (Flex needs NO `vnetRouteAllEnabled`). **BOTH** the PHASE 3b deploy AND the PHASE 3d.5 lockdown re-deploy must pass the subnet (else the re-deploy strips integration).
- **`deploy.ps1`:** registers the `Microsoft.App` provider once before the loop (required for the delegation); captures `$keyVaultPrivateDnsZoneId` + `$functionVnetSubnetId` from apps outputs; passes them to functions.json (BOTH calls) + keyvault.json (`peSubnetId=$subnetId`, the DNS zone, `allowedIpAddresses=$AllowedIpAddresses`). **Prod fail-fast:** prod has no deployer-IP auto-detect → throws unless `-AllowedIpAddresses '<ip>'` is passed (else PHASE 2e secret management is denied). Non-prod auto-detects via ipify.
- **KV consumers (all have a path):** API + Identity (PE via `default`), Function App (PE via `function-subnet`), deployer (IP rule). No app code uses the KeyVault SDK directly — all runtime access is App Service KV references resolved by managed identity.

## Availability cost policy (2026-09-15; supersedes historical availability tuning below)

- Approved: prod only; API, Identity, MCP, Partner and Customer in CA and IN, ten tests total. No Admin, Functions, dev or UAT tests.
- One East US checker (`us-va-ash-azr`) every 900 seconds: 960 scheduled executions/day, 90.7% below the former 12-test / 300-second / three-location setup. Microsoft lists no India or Canada checker, including Canada Central/East. Application hosting and App Insights remain regional.
- `deploy.ps1` gates POST-PHASE B2 on prod and passes an explicit environment. `availability-tests.json` independently gates both the resource and copy count; environment has no default. Cadence and location overrides are constrained to the approved policy. `analytics-alerts.json` creates its availability rule only in prod. Obsolete consensus/bin parameters are removed.
- The availability query selects the latest two samples per approved production test within one hour. Both must fail, at least ten minutes apart; the latest must be newer than 30 minutes. Evaluation is every five minutes. A success clears the query condition; stateful resolution takes additional evaluations. Detection is generally 15-30 minutes plus processing. Missing telemetry is not an outage signal; one checker lacks independent location consensus.
- ARM Incremental does NOT delete existing omitted resources. Delete existing DEV/UAT-clinket-ping-* tests and the matching lower-environment availability alert in Azure Portal. Delete legacy production Admin/Function tests if present. Preserve App Insights, other operational alerts and shared action groups. No live cleanup or deployment was performed.
- Front Door probes remain disabled. TLS validity remains checked; proactive certificate-expiry checking is removed. The alert sends email via the existing action group, with no automated restart or routing action.
- Offline deployment checks and Microsoft Kusto.Language 12.4.1 syntax/semantic analysis passed. The descriptor list resets before each run. Live Azure validation remains outstanding. Owner preference: keep the automation project focused on deployment code, with brief documentation and no optional audit reports, regression scripts or one-time cleanup helpers.
## Health probes DISABLED + availability tests + per-stamp SMS provider (2026-06-03; historical)

Fixes the FD-probe storm that live-called Telnyx on every probe (-> 429). See memory `project_health_probe_telnyx_fix_2026_06_03`.
- **Front Door health probes are DISABLED on ALL single-origin groups** (api/identity/admin/partner/customer/storage/function). `healthProbeSettings` removed from `networking.json` (7 origin groups) AND `deploy.ps1` PHASE 3c-geo `$ogBody` (now-dead HealthPath/ProbeType/Interval cols dropped from `$fdServices`). MS-documented: a single-origin group always routes to its lone origin regardless of probe result, so probes only add multi-POP load. Re-enable for a future multi-origin group by restoring `healthProbeSettings`.
- **`/health` stays the FULL readiness gate** (CI post-deploy still hits it; Degraded->200 so a flaky third-party never fails a deploy). Only the continuous probe was removed. `CachedHealthCheck<TInner>` (infra `HealthChecks/`) caches the live external checks (Telnyx + Search) for `HealthChecks:ExternalCacheSeconds` (=60) so readiness can be polled without re-hitting them.
- **Per-stamp SMS health provider** (`HealthChecks:Sms:Provider`, default Telnyx): each app registers ONLY the active provider's check (Telnyx live-call OR the config-only `TwoFactorHealthCheck`). `deploy.ps1` injects `HealthChecks__Sms__Provider` per stamp via **Merge-AppSettings** (real apply, NOT the emit-only print dicts) keyed on `$RegionStamp -eq "in"` -> IN=TwoFactor else Telnyx; added to the 3 `$script:Required*AppSettings` asserts + the 3 print dicts.
- **Availability tests replace the lost FD liveness signal:** new `availability-tests.json` (standard `Microsoft.Insights/webtests`) pings each backend stamp's region-pinned `/ping` (the function `/api/ping` was REMOVED 2026-06-06 — Flex cold-start false positives, see below); `deploy.ps1` accumulates `$script:allAvailabilityTests` at PHASE 1, deploys in **POST-PHASE B2 per stamp into that stamp's analytics RG** (a webtest MUST share its linked App Insights component's RG — Azure rejects cross-RG with BadRequest; NOT the shared workspace RG). **US agent locations only** (Azure has no IN/CA test agents; US passes the per-stamp health WAF GeoAllowList IN/US/CA). Outage e-mail = new workspace-scoped `availability` scheduledQueryRule in `analytics-alerts.json` (`AppAvailabilityResults | where Success==false`, env-filtered by `{ENV}-clinket-ping` name prefix) -> existing action group.
- **CAVEAT:** `availability-tests.json` is NOT Azure-validated here (no deploy access); JSON parses + schema follows MS docs. Validate with `az deployment group validate` / a real deploy. (Web-app liveness is now covered — see the alerting section below.)

## Alerting redesign — symptom/request-based, low-noise (2026-06-05)

All alerts live in `analytics-alerts.json` (action group + rules) + `availability-tests.json` (webtests), wired in `deploy.ps1` POST-PHASE B / B2. See memory `project_alerting_redesign_2026_06_05`.

**Why the change:** the old blanket log alerts (`error-or-critical`, `warning`, `exception`) fired on EVERY Error/Warning/Exception line → false-positive storm. Verified root causes: `BaseController.HandleException` logs ALL exceptions at `LogError` incl. 4xx (KeyNotFound→404, Validation→400, Cosmos 409/412/429); functions catch→`LogError`→Abandon on every transient retry; benign SignalR `OperationCanceledException`. App Insights marks any HTTP ≥400 as failed, so `Success==false` ≠ server error — use `ResultCode >= 500`.

**Current alert set (analytics-alerts.json):**
- `{ENV}-clinket-server-errors` (sev1, log) — `AppRequests | role api/identity/functions | toint(ResultCode) >= 500`. The "incoming-request error" alert; 4xx excluded by design. Function HTTP-trigger 5xx (webhook/health) is caught here; SB/timer/change-feed rows have no ≥500 ResultCode so they don't match. Threshold `serverErrorThreshold` (default 0).
- `{ENV}-clinket-critical-log` (sev1, log) — `AppTraces | role api/identity/functions | SeverityLevel == 4`. Non-request backstop: the platform reserves `LogCritical` for severe/deliberate failures (final-retry dead-letter, admin-alert publish failure, analytics-dispatch saturation/data-loss).
- `{ENV}-clinket-warning-spike` (sev2, log) — `AppTraces | SeverityLevel == 2 | count by role > warningSpikeThreshold` (default 50). VOLUME alert (a flood = degradation); isolated warnings never page.
- `{ENV}-clinket-dlq-depth-{i}` (sev1, metric) — per SB namespace, `DeadletteredMessages > 0`.
- `{ENV}-clinket-sb-backlog-{i}` (sev2, metric) — per SB namespace, `ActiveMessages` 15-min avg > `sbActiveMessageThreshold` (default 1000). Stuck/down consumer, earlier than DLQ. Reuses the `serviceBusNamespaces` param.
- `{ENV}-clinket-cosmos-429-{i}` (sev2, metric) — per account, 429s > `cosmos429Threshold` (15)/5min.
- `{ENV}-clinket-sql-dtu-{i}` / `-sql-storage-{i}` (sev2, metric) — per DB, `dtu_consumption_percent` / `storage_percent` 15-min avg > 85 (params `sqlDtuThreshold` / `sqlStorageThreshold`). New `$script:allSqlDatabases` accumulator (id+region) captured after the Cosmos one in the DB-deploy block (`Microsoft.Sql/servers/databases`, name `$SqlServerName/$sqlDatabaseName`). DTU model (Basic/S0).
- `{ENV}-clinket-workspace-cap-80pct` (sev2, log), `{ENV}-clinket-unknown-country-traffic` (sev1, log), `{ENV}-clinket-availability` (sev1, log) — covers api/identity `/ping` + web-app `/api/health`; as of 2026-06-06 requires SUSTAINED failure (params `availabilityMinFailingPeriods`/`availabilityEvaluationPeriods`, default 2/2 ≈10 min) and EXCLUDES the Flex function (cold-start). See 2026-06-06 section below.

**Function failure model (deliberate):** functions are event/timer/change-feed driven, NOT request-driven; under `telemetryMode: OpenTelemetry` the function request table is parent-sampling-dependent AND functions catch-and-settle (a failed message-process records a SUCCESSFUL invocation), so `AppRequests.Success` is NOT a reliable function signal. Function failures alert via **DLQ depth + critical-log** (+ the app's own `FailureNotificationHelper`→`admin-alerts` pipeline). Only function HTTP-trigger 5xx rides the server-errors alert.

**Web-app availability:** `admin`/`partner`/`customer` entries added to `$script:allAvailabilityTests` (PHASE 1), pinging `/api/health` (auth-exempt) on the per-stamp health host (US agents pass the GeoAllowList IN/US/CA). They link to the stamp's api App Insights component (web apps have none of their own; same analytics RG satisfies the webtest same-RG constraint) and flow into the existing `availability` alert via the `{ENV}-clinket-ping` name prefix. POST-PHASE B2 host build already handles customer (`{stamp}.{apex}`) vs others (`{app}-{stamp}.{apex}`).

**Role/env filters (unchanged model):** `AppRoleName` = `WEBSITE_SITE_NAME` (no code override) = `clinket-{api|identity|functions}-{stamp}[-{env}]`. `backendRoleFilter` = `startswith "clinket-{api|identity|functions}-"`; non-prod adds `| where AppRoleName endswith "-{env}"` (the shared nonprod workspace holds dev+uat). Metric alerts are per-resource (resource ID) → no KQL env filter.

**Thresholds = params** (deploy.ps1, no magic numbers): `-ServerErrorAlertThreshold 0`, `-WarningSpikeAlertThreshold 50`, `-ServiceBusBacklogThreshold 1000`, `-SqlDtuAlertThreshold 85`, `-SqlStorageAlertThreshold 85` — all tunable per env.

**Gotchas:**
- Renamed/removed rules ORPHAN under ARM Incremental mode — the deprecated `*-error-or-critical`, `*-warning`, `*-exception` are deleted MANUALLY (user decision; no cleanup code in deploy.ps1).
- `host.json` `logging.applicationInsights.samplingSettings` is IGNORED under `telemetryMode: OpenTelemetry` (MS-confirmed) — dead config in the functions repo AND removes the only ingestion brake vs the 0.5 GB/day cap. Config-hygiene follow-up (functions repo, out of azureautomation scope).
- `cap` + `unknown-country` rules are NOT env-filtered → in the shared nonprod workspace dev+uat double-fire (pre-existing; cap is genuinely workspace-wide).
- NOT Azure-validated here: JSON + PS parse clean; metric names verified vs MS supported-metrics docs (`ActiveMessages`, `dtu_consumption_percent`, `storage_percent`). Validate with a real deploy.

## Availability-alert false positives fixed — sustained-failure tuning + function dropped from ping + web-deploy restart (2026-06-06)

The `{ENV}-clinket-availability` alert paged on EVERY web-app deploy and on idle function cold starts. Three causes, three fixes. See memory `project_availability_alert_false_positives_2026_06_06`.

- **403 "Site Disabled" on web-app deploys:** the web `_deploy.yml` did `az webapp stop` before the ZIP swap (to release the file lock) → a stopped App Service returns 403 for the whole stop→start window → the fire-on-first-fail alert paged. **Fix (partner + customer + admin `_deploy.yml`):** removed the `Stop`/`Start` steps; deploy then a single `az webapp restart` (the API/Identity pattern). A restart is a graceful recycle (no 403); on Linux zip-deploy replaces open files without a stop; for the Next.js apps wwwroot stays WRITABLE so startup.sh's `.next/cache`→`/home/.next/cache` symlink (next/image optimization cache) keeps working. **run-from-package was REJECTED** for the Next.js apps — it mounts wwwroot read-only, breaking that symlink + next/image. admin is CRA (no `.next/cache` dependency) and its existing 'Reset run-from-package' step already releases the read-only mount, so its stop was redundant.
- **Function `/api/ping` 30s timeout:** Flex Consumption scales to zero ⇒ an external ping cold-starts the host past the 30s test timeout (idle ≠ down). **Fix:** function descriptor REMOVED from `$script:allAvailabilityTests` (deploy.ps1); `availabilityQuery` also guards `| where Name !contains "-clinket-ping-function-"` so an orphan webtest can't page. Function health stays covered by SB-backlog/DLQ + 5xx + critical-log (its App Insights component remains in `allAppInsightsComponentIds`). **One-time:** delete the existing `{ENV}-clinket-ping-function-{stamp}` webtests in Azure (ARM Incremental won't).
- **Transient blips generally:** the availability rule's `failingPeriods` was `1/1` (paged on the first failed ping). Now parameterized — `availabilityEvaluationPeriods` / `availabilityMinFailingPeriods` (deploy.ps1 `-AvailabilityEvaluationPeriods` / `-AvailabilityMinFailingPeriods`, default **2/2 ≈ 10 min**; Azure availability tests cap at a 5-min minimum frequency, so ~5 min is the floor — raise to 3/3 for ~15 min, or 3/2 to tolerate one recovery flap). A deploy restart (< 1 window) never pages; a genuinely down origin does.
- NOT Azure-validated (analytics-alerts.json JSON + deploy.ps1 PS `Parser` + both web `_deploy.yml` via js-yaml all parse clean). Validate with a real deploy.

## Availability alert deploy fix — multi-period log query must project TimeGenerated (2026-06-07)

POST-PHASE B `analytics-alerts` deploy failed `BadRequest: Number of evaluation periods must be 1 for queries that do not project the 'TimeGenerated' column of type 'datetime'`. Only the `{ENV}-clinket-availability` rule has `numberOfEvaluationPeriods > 1` (the 2/2 sustained tuning above); every other rule is `1/1` and deployed fine. **Azure rule:** any `scheduledQueryRules` criterion with `failingPeriods.numberOfEvaluationPeriods > 1` MUST emit a `TimeGenerated` datetime column so the service can bin results per evaluation period — `summarize ... by Name` alone collapses it away. **Fix (`availabilityQuery` variable):** `summarize Count = count() by Name, bin(TimeGenerated, 5m)`. The bin width is **coupled to `windowSize` (PT5M)** — keep them equal; do NOT remove the bin to "simplify" (re-breaks the deploy). Rejected alternative: collapse to `1/1` + `windowSize PT10M` — that pages on a single transient blip, killing the sustained-detection design. Any future multi-period log rule needs the same `bin(TimeGenerated, <windowSize>)`. JSON re-validated; NOT Azure-validated.

## App Insights ingestion curation — OTel metric Views + config hygiene (2026-06-07)

Instrumentation is the in-code **Azure Monitor OpenTelemetry Distro** (NOT the legacy AI SDK, NOT the codeless agent): API/Identity `AddOpenTelemetry().UseAzureMonitor()` (`Azure.Monitor.OpenTelemetry.AspNetCore` 1.5.0); Functions `AddOpenTelemetry().UseFunctionsWorkerDefaults().UseAzureMonitorExporter()` (`Exporter` 1.8.0) with host.json `telemetryMode: OpenTelemetry`. UI apps have NO App Insights (cost).

**Cost finding (DEV ~320 MB/day vs 0.5 GB/day cap):** `AppMetrics` was the #1 ingester at ~176 MB/day, dominated by auto-emitted OTel metrics — `http.*` ~120 MB (mostly `http.client.open_connections`) + `process.*` ~33 MB. None are charted and **NO alert reads `AppMetrics`** (alerts read AppRequests/AppTraces/AppAvailabilityResults/AzureDiagnostics + platform metrics). Diagnostic logging on **Cosmos and SQL is OFF** (no `diagnosticSettings` in `database.json` → their 429/DTU/storage alerts are free platform-metric reads, zero log ingestion). Only Front Door ships logs (`FrontDoorAccessLog` + WAF) via `networking.json`.

**Fix (all 3 `Program.cs`):** `.WithMetrics(m => m.AddView(static i => … ? MetricStreamConfiguration.Drop : null))` drops `http.client.open_connections`, `http.client.connection.duration`, and `process.*`. **KEPT:** `http.client/server.request.duration` (latency — also derivable from AppRequests/AppDependencies) + `faas.*`. Host CPU/mem stay covered free by App Service/Functions platform metrics. **NO sampling** — a fixed-rate sampler would undercount the count-based 5xx/critical/warning-spike alerts (raw `count()`, not `sum(itemCount)`) and doesn't touch `AppMetrics` anyway.

**Hygiene:** removed dead `logging.applicationInsights.samplingSettings` from host.json (ignored under `telemetryMode: OpenTelemetry`) + removed `ApplicationInsightsAgent_EXTENSION_VERSION="~3"` from deploy.ps1 PHASE 3a (codeless agent + SDK = unsupported double-instrumentation; connection-string-only now). **LIVE cleanup:** the agent app-setting already applied to API/Identity must be deleted manually — `Merge-AppSettings` only adds/updates, never removes (same manual-orphan pattern as renamed alert rules). Builds green ×3; NOT Azure-validated (verify post-deploy via the `AppMetrics | summarize sum(_BilledSize) by Name` KQL).

---

## BOTH HOSTS SUBMIT TO INDEXNOW — ENABLING ONE IS A SILENT HALF-FIX (2026-07-26)

`IIndexNowSubmitter` is registered in **two** hosts, and the important one is easy to miss:

| Host | Path | Fires when |
|---|---|---|
| Main API | admin reindex endpoint | someone clicks it |
| **Function App** | `SearchIndexSyncFunction` -> `ProviderListingProjectionService` | **the Cosmos change feed**, i.e. every provider profile edit |

Enabling only the API leaves every *organic* submission dead while the manual button appears to work —
which looks like success. Both `appsettings.json` files must carry the **same** `Key`, `Host` and
`Endpoint`, and both must be prod-gated in `deploy.ps1`. `indexNowKey.test.js` iterates both hosts and
requires two `isProdEnvironment` gates, so enabling one and forgetting the other fails the build.

## SERVICESSITEMAP SHIPS ON, AND THAT IS SAFE BECAUSE THE INDEX IS MANIFEST-DRIVEN

`sitemap.xml` lists service chunks from the manifest the nightly job writes **LAST**. A stamp that has
never run therefore advertises **nothing** — it cannot advertise chunk URLs that would 404. That is what
makes `Enabled=true` safe as a committed default on every environment; the job also only touches its own
environment's SQL, Cosmos and blob container, so there is no cross-stamp leakage the way there is with
IndexNow (which pings a third party and so stays prod-only).

‼️ `ForceFullRebuild` stays **false**. It is an operational one-shot that ignores the watermark; left on,
every nightly run would rebuild every group and burn RU for nothing.

‼️ No `CronExpression` property on `ServicesSitemapSettings`. The schedule is a TimerTrigger binding the
**host** resolves from an env var, so an `IOptions` copy is read by nothing and can silently disagree
with the schedule in force — same decorative duplicate removed from `SearchIndexAudit`.

---

## ‼️ MULTI-USER TENANCY (2026-08-01 → 2026-08-04) — two queues, two crons, and the rule that stops over-wiring

> **The whole model is one skill: read `clinqet-provider-teams` before any tenancy change.**

**Phase 9 changed NOTHING in `deploy.ps1` or the ARM templates.** This section is the closing inventory
plus the rule most often got wrong.

### ‼️ THE RULE — it is NARROWER than people assume

> **Only a `local.settings.json` entry (a Functions TRIGGER-BINDING setting) or a NEW AZURE RESOURCE needs
> an ARM + `deploy.ps1` entry. An appsettings-only key does NOT.**

| Added by this programme | ARM + `deploy.ps1`? |
|---|---|
| Service Bus queue **`access-changes`** | ✅ **YES** — a real Azure resource |
| Service Bus queue **`notification-digests`** | ✅ **YES** |
| `Tenancy__AccessChange__SweepCron` (`0 */1 * * * *`) | ✅ **YES** — a **TimerTrigger binding** the host resolves from an env var |
| `Tenancy__Lifecycle__ExpirySweepCron` (`0 0 * * * *`) | ✅ **YES** — same reason |
| `Tenancy:Authorization:SnapshotCacheSeconds`, `Tenancy:Invitations:*`, `Tenancy:Activity:*`, `Tenancy:Branch:*`, `Tenancy:Inbox:*`, `Tenancy:Lifecycle:OwnershipTransferReminderCooldownMinutes` | ⛔ **NO** — appsettings-only, Main API |
| **`Tenancy:BusinessContext:{MaxExchangesPerWindow,WindowMinutes}`** (Identity) | ⛔ **NO** |
| **`HealthChecks:AccessChange:{TimeoutSeconds,DegradedAfterSeconds,UnhealthyAfterSeconds}`** (Main API) | ⛔ **NO** |
| `AdminSupport:LookupResultLimit` (Identity) | ⛔ **NO** |
| `SignalRSettings:VoiceLiveWatchRevalidationSeconds` | ⛔ **NO** |

‼️ **Every cron value in `deploy.ps1` MIRRORS its options-class default exactly.** A `IOptions` copy of a
value the **host** resolves from an env var is read by nothing and can silently disagree with the schedule
in force — the same decorative duplicate already removed from `ServicesSitemapSettings` and
`SearchIndexAudit`. **The env var is the authority for a TimerTrigger.**

### Where the two queues are wired

`access-changes` — ARM at `azureautomation/events.json` (with duplicate detection **PT1H**), and in
`deploy.ps1` as `$qAccessChanges` plus `ServiceBusSettings__AccessChangesQueueName` across **all four host
blocks**: the Functions managed identity, the API managed identity, `$apiSettings` and
`$functionAppSettings`. `notification-digests` — the same shape, plus all three
`local.settings*.json` files.

‼️ **A queue name in `local.settings.json` without the matching `deploy.ps1` entry is a runtime failure in
every deployed environment and works perfectly locally.** Both were verified as **artefacts** during Phase
9's §1.3 sweep — casebook CASE 16's rule: **verify the ARTEFACT, not the intention.** (That case was iOS
Universal Links, dead because `CODE_SIGN_ENTITLEMENTS` was never wired: the code was right and the build
config was not.)

### ‼️ `deploy.ps1` HAS MIXED LINE ENDINGS — and it has already been corrupted twice

1. ‼️ **A `perl -0pi` multiline replace anchored on `\n` silently matched ZERO occurrences and reported
   success.** Always `\r?\n`; **always re-grep to prove the count.**
2. ‼️‼️ **A `perl -0pi` edit containing ONE non-ASCII character corrupted the file into 426 parse errors —
   and the grep afterwards looked PERFECT**, because the inserted lines were all present and correct. Only
   `[System.Management.Automation.Language.Parser]::ParseFile` caught it. Restored from a backup taken
   **before** the edit.

> ‼️ **NEVER write `deploy.ps1` with perl or a heredoc. Use the editor tool, keep inserted comments
> ASCII-only, TAKE A BACKUP FIRST, and ALWAYS parser-validate afterwards** — a corrupted script is
> invisible to grep.

‼️ **Anchors are not unique.** `"ServiceBusSettings__AdminAlertsQueueName"` and
`"...UserActivitiesQueueName"` each appear **FIVE** times, across the Functions, API, Identity and MCP
blocks; neither is a safe `replace_all` anchor. `"...VoicePostCallQueueName"` appears exactly twice, both
Functions. **Map every anchor to its owning block first:**

```
awk 'NR<=n && /Merge-AppSettings|^\$[a-z]+Settings = \[ordered\]/ {l=NR": "$0} NR==n {print l}'
```

### ‼️ PowerShell 5.1 mis-decodes a UTF-8-without-BOM script containing non-ASCII

Put translations and any non-ASCII payload in a **JSON data file** read via
`[System.IO.File]::ReadAllText(path, Encoding.UTF8)`, and keep the script itself **ASCII**.
‼️ **Never round-trip a localization file through `ConvertTo-Json`** — it reformats and escapes everything.

### ‼️ NEVER write a source file from a script that resolves paths two different ways

A `deploy`-adjacent PowerShell script **truncated 23 controller files to 0 bytes**. It guarded with
`Test-Path` (**PowerShell-relative**) and read with `[System.IO.File]::ReadAllLines`
(**process-CWD-relative**) — and ‼️ **`Set-Location` does NOT update .NET's
`Environment.CurrentDirectory`**, so the guard passed, the read threw, the line list stayed empty, and
`WriteAllLines` wrote an empty file.

**Always pass ABSOLUTE paths to `[System.IO.File]` methods. Prefer the editor tool for source edits.**

### ‼️ There is NO version control in `C:\Nik` — take a backup before any destructive tool invocation

`dotnet ef migrations add --no-build` produced an **EMPTY** migration, and
`dotnet ef migrations remove --no-build` then **deleted the WRONG migration**, because a stale assembly
carries a **stale migration list** as well as a stale model. `AppDbContextModelSnapshot.cs` was reverted at
the same time.

> ‼️ **NEVER pass `--no-build` to `dotnet ef`.** It is not a speed optimisation — it is a **correctness
> hazard with a destructive tail.**
> ‼️ **A `remove` that names a migration you did not create is a STOP SIGNAL, not a step to scroll past** —
> the output said which one, in plain text, before anything else went wrong.

Recovery (it worked, and is worth knowing): back up `Migrations/` → temporarily revert your own model edit
→ regenerate the other migration **with a real build** → **rename both files back to the original
timestamp prefix and edit the `[Migration("…")]` attribute to match**, so an already-migrated database's
`__EFMigrationsHistory` row stays valid → re-apply your edit → generate yours.

### The tenancy migration lineage — never retro-edit an applied one

`20260801220934_AddMultiUserProviderTenancy` → `20260801235115_AddRefreshTokenBusinessContext` →
`20260802020008_TenancySchemaSimplification` →
`20260802201725_AddNotificationRoutingVersionAndPreferenceDiscriminator` →
`20260803040821_AddTeamManagementAndOwnershipTransfer` →
`20260804150226_AddBusinessDisplayNameIndex`.

‼️ **A retro-edit is a silent no-op against a database that already recorded the migration, and produces
500s at runtime.** ‼️ **`dotnet ef migrations remove` then `add` IS the correct way to revise an
UNAPPLIED migration** — that is not a retro-edit, and it was done cleanly twice.

### Deploy-time obligations for this feature

- ‼️ **L35 — DRAIN EVERY SERVICE BUS QUEUE AT DEPLOY.** Messages enqueued before the tenancy cutover carry
  the pre-tenancy shape and **no version-compatibility code was written** (pre-production; L35 forbids it).
- ‼️ **`cosmosindexsetup` IGNORES the shell `CLINKET_REGION`** — always pass `--launch-profile`.
- **Health check:** `/health` gained `access_change_backlog`, failing **Unhealthy**. ‼️ **A stalled D4
  dispatcher is the quietest failure on the platform** — no request fails, nothing logs an error, and a
  removed employee keeps working until their token expires. It reports the **AGE of the oldest undispatched
  row, never the count**, and binds the existing filtered `IX_AccessChangeQueue_Undispatched`.
- **Metrics:** `Clinket.Tenancy` is the platform's **first** `Meter`, exported via `.AddMeter(...)` in the
  Main API's existing `WithMetrics` block. ‼️ **Without that line the instruments record into a void.**
  ‼️ **No tag may carry a `businessId`, `membershipId` or `userId`** — unbounded cardinality is a **cost
  incident**.
- **No new Azure resource of any other kind** was introduced by the whole programme: no new Cosmos
  container, no new storage container, no new topic, no distributed cache. ‼️ **A distributed cache was
  considered and deliberately NOT taken** (L61 / L120) — the authorization snapshot's 60 s TTL is the
  accepted platform-wide bound, and the one place it mattered (a live-call watcher) was solved **without**
  one, because a SignalR connection is **server-affine**.

### Phase 15 will need this file — the wipe is destructive and ordered

`D11` wipes and reseeds India + Canada at **Phase 15** (not Phase 11 — the sentence was not renumbered when
the audit phases were inserted). ‼️ **Purchased voice numbers are rented monthly: deleting the binding doc
does NOT release the number, so they MUST be released at the carrier BEFORE their bindings are wiped, or
you keep paying for orphans.** Also: reset the `leases` container (stale change-feed continuation tokens),
the blob containers, **both** Azure AI Search indexes, and ‼️ **`__EFMigrationsHistory` — a half-reset
history makes the next migration silently no-op and produces 500s.**

## 2026-09-02 (Gate 3) — the post-deploy gate and the content filter
- ‼️ **An unassigned content filter now FAILS the phase.** The assignment loop collects failures and throws, naming every deployment that would serve unfiltered; it used to warn and let the stamp report success. The model-deployment loop above it still only warns, deliberately — a capacity refusal must not abort a stamp.
- `$script:RequiredFunctionAppSettings` includes `AzureDocumentIntelligence__VisionAiDeploymentName` (this host runs the knowledge/setup vision lanes), and `$script:RequiredMcpAppSettings` includes `WhatsApp__WabaLanguages` (MCP is the fourth registry host and its fallback is the unsafe value).
- **Owner decision still open:** every model deploys with `upgrade = "OnceNewDefaultVersionAvailable"`. That lets Azure move the version each luna measurement in the AI cost programme was taken on. Pinning stops security and quality updates arriving without a manual deploy, so the policy is left as it is and named here.

## ‼️ ONE Service Bus name list for EVERY host (2026-09-17)

`$script:ServiceBusEntitySettings` (right after the `$q*` variables) holds every `ServiceBusSettings__*QueueName` /
`*TopicName` and is merged into the API, Identity, Functions and MCP apps; the per-host blocks no longer list queue names,
the emit-only print dicts are filled from it, and every host's `Required*AppSettings` asserts all of it.

- **Why:** `ServiceBusService` builds a sender for EVERY name in EVERY host, and a name missing on one host falls back to
  the class default — the bare prod-shaped name, which exists in no non-prod namespace. The API block lacked seven
  names; `voice-postcall` 404ed ("Put token failed … MessagingEntityNotFound") so no own-number test call was ever
  placed, and the admin search resync sent to a bare `change-feed-failures`. Identity carried only seven names at all.
- **Guard:** when `clinqetshared` sits beside `azureautomation`, deploy.ps1 reads `ServiceBusSettings.cs` and THROWS on any
  queue/topic property the list lacks; otherwise it prints a loud `[SKIP]` (§0.17 rule 5). Adding a queue = add the
  property, the `$q` variable and one line in the shared list.
- **Local dev twin:** `ServiceBusEntityNamesConventionTests` (Clinqet.API.UnitTests) requires every queue/topic property in
  the API's `appsettings.json` as `<class default>-dev` — it caught `AccessChangesQueueName` and `BusinessClosureQueueName`
  missing on its first run.

---

## ‼️ THE SEARCH TOPOLOGY ROUTER (search-topology Phase 1, 2026-09-21)

**No code outside `Clinqet.Infrastructure.Services.Search.Topology` may name a search endpoint or an index
alias.** Every read and every write resolves a route from `ISearchTopology` (`clinqetcore/Interfaces/Search/ISearchTopology.cs`):

| Call | Answers | Use it for |
|---|---|---|
| `ResolvePublic(countryName)` | a `PublicRoute` of `PublicIndexPair` (services + providers client, country code, `Launching`/`Live`) | marketplace search, SEO, banners, the broadcast matcher, the service/provider indexers |
| `ResolvePrivate(businessId)` | a `PrivateRoute` (`CatalogClient`, `KnowledgeClient`, both NULLABLE) | the phone receptionist, Ask Clinket, the knowledge indexer |
| `EnumeratePlane(SearchPlane)` | every index of that plane | global scans: health checks, the audit function, the suggestion prefix scan, the spell-dictionary refresh |
| `EnumerateForBusiness(businessId)` | every index a business can be in, both planes | teardown / cascade delete |

- `route.Single` THROWS when a route carries more or fewer than one pair — a single-query reader handed a
  fan-out must fail, never silently read the first index. A global scan enumerates instead.
- `PublicRoute` and `PrivateRoute` are **distinct types on purpose**: Phase 0 measured the two planes needing
  OPPOSITE vector algorithms (tenant filter ⇒ exhaustive 2.8× faster; country filter ⇒ HNSW 2.1× faster), so a
  misroute is a 2× regression the compiler now prevents.
- **A nullable private client means the stamp has AI Search unprovisioned** — `deploy.ps1` writes the endpoint
  as an EMPTY STRING there. Readers degrade to their Cosmos leg; the host still boots.
- `AiSearchClientFactory` is the ONLY place a `SearchClient` is constructed and the router is its only caller.
  Both facts are pinned by `SearchTopologyConventionTests` in **each host's own** unit suite (§0.15/§0.17), with
  its own exemption registry and a zero-hit guard so an unresolved root fails loudly instead of reporting green.
- Settings: `Search:Topology:Services:{Public,Private}:{Endpoint,ApiKey}`,
  `Search:Topology:Public:Countries:<ISO2>:{ServiceAlias,ProviderAlias,Status}`,
  `Search:Topology:Private:Cells:<cellId>:{CatalogAlias,KnowledgeAlias}`, `Search:Topology:Private:OpenCells`.
  ‼️ **The base appsettings of every host ships NO countries and a BLANK endpoint**: the .NET binder MERGES a
  dictionary rather than replacing it, so a non-empty base would widen whatever the per-stamp file sets.
- `AddSearchTopology(configuration, requiresPublicPlane)` binds, `ValidateOnStart`s and registers the router,
  its alarm, the alias-not-found policy and a `SearchTopologyPlaneScope`. MCP passes **false** (private plane
  only). Validation refuses to boot on: an empty country list, an unparseable ISO key, a blank alias, one alias
  for both grains, a duplicate alias across countries, no private cell, an `OpenCells` entry naming no cell, a
  `CrossBorderPairs` entry naming an unserved country or itself.
- ‼️ **`Search:Topology:Public:Countries` means "the countries that have their OWN index pair on this stamp"**,
  not "the countries this stamp serves" — the permanent definition that makes the duplicate-alias guard
  unambiguous in every phase (PLAN §5.4.1, E73).
- A configured alias that does NOT exist answers 404 forever and every reader treats empty as legitimately
  empty. `SearchAliasNotFoundPolicy` (PerCall, so it sees the outcome the caller sees) raises one Critical
  `AdminAlertType.SearchTopologyMisconfigured` at first use, **excluding `GetDocumentAsync`'s 404**, which is
  the normal answer for a document not indexed yet.
- The unconfigured-plane alarm fires only for a plane this host READS and that has something to serve — MCP's
  permanently-blank public endpoint is the design, and alerting on it would be a Critical on every healthy boot.
- Clients are cached per **(endpoint, API key, alias)** for the process lifetime, built through a
  `Lazy<SearchClient>` in `ExecutionAndPublication` mode. The key includes the API key because two planes may
  share a host and hold different keys.
- **Tests**: `TestSearchTopology` (one copy per test project; a hand-built `ISearchTopology`, deliberately not
  a Moq double) gives a service the route it needs in one line. The slot a test is NOT exercising gets a
  `NotUnderTest()` client pointing at an unresolvable host, so a misroute FAILS instead of quietly passing.

### ‼️ PHASE 2 — THE PRIVATE PLANE IS ITS OWN INDEX NOW (2026-09-22)

The private catalogue and the private knowledge index are **no longer the public indexes under another name**.
`cosmosindexsetup` creates one pair per cell — `private-catalog-<cell><env>` / `private-knowledge-<cell><env>` —
and `deploy.ps1`'s `Add-SearchTopologySettings` points every host at them from one `$privateSearchCells` list.
‼️ The cell comes BEFORE the environment in the name; suffixing the grain first produced `private-catalog-dev-cell1`,
which no host's alias-shape guard recognises.

**Which cell a business lives on** is `BusinessProfile.searchCell`, written once at profile creation by
`ISearchCellAllocator` (SHA-256 of the business id over the OPEN cells — never `GetHashCode`, which is randomised
per process). `ISearchCellDirectory` is the only thing that reads it: a singleton, `IMemoryCache` (`Size = 1`),
single-flight per business, 15 min for a found cell / 30 s unassigned / 10 s unavailable.
‼️ **A failed lookup is `Unavailable`, NEVER `NotAssigned`** — a Cosmos blip read as "no cell" would fail every
tenant closed for a whole cache window and the repair would be the wrong one. A cell this stamp does not
configure is **refused, never substituted**: answering from another cell reads and writes another tenant's shelf.
Callers that already hold the profile call `Remember(businessId, cell)`, so the write path costs no extra read.

**The two planes hold DIFFERENT populations (D-35).** The private catalogue holds **every service that still
exists** — pending and inactive included, each carrying `approvalStatus` and `isActive` — so "not sellable" is a
FILTER (`isActive eq true and approvalStatus eq 'Approved'`), never a missing row. The public index keeps
membership-by-ABSENCE. `ServiceIndexGates.BelongsInPrivateCatalog(isDeleted)` and `IsIndexable(...)` are the two
rules, and only a DELETED service leaves the private plane.

- **One document class, two materialisations.** `ServiceSearchDocumentProjector.ForPrivateCatalog` /
  `ForPublicServiceRows`. ‼️ Azure rejects the WHOLE batch with 400 when a document carries a field the index does
  not declare, so every field a plane does not declare must be nullable AND `JsonIgnore(WhenWritingNull)` —
  pinned by `SearchPlaneConventionTests`.
- **The receptionist's second lock (D-36)**: every returned row is checked against the scope the filter
  promised, on the lookup leg AND the expert-check candidate leg. One bad row discards the whole set and alarms.
- **`find_services` and `answer_catalog_question` state the same facts as the embedded profile** —
  `VoiceServiceCardFields` declares the model-visible keys and names every deliberate divergence; the parity
  test lives in `Clinqet.Communications.UnitTests`. ‼️ `CatalogLookupItem.Price` is `[JsonIgnore]`d: the
  structured amounts are the SCREEN's shape, and a model given `fixedPrice: 80` beside `chargePerVisit: 40`
  states 120. The ear gets `priceText` + `extraChargesText`, composed by `CatalogPriceNarrator`.
- **Ask Clinket's `search_services` runs ONE leg** (D-6). The paired Cosmos `CONTAINS` leg is gone with
  `CatalogLookupQuery.UnapprovedOnly` — the index now holds the drafts that leg existed for.

**The AI cache (D-21/D-29/D-60)** lives in the EXISTING `provider-knowledge` container under
`{businessId}/ai-cache/…`, so it adds no Azure resource and the business-closure prefix purge already sweeps it.
`ISearchAiCacheStore` holds the enrichment text, the vector and the content hashes; a rebuild that hits it makes
**zero model calls**. Invariants: the artifact is durable BEFORE any index write (I1); a write lock is a blob
LEASE, **per business** for services and **per document** for knowledge (D-60), with a `Lost` token that cancels
a rebuild whose lease expired. ‼️ The lease registry is keyed by **blob name**, and the store looks the lease up
itself — the knowledge lane leases the very blob it then writes, so a caller-supplied key would 412 every ingest.
A 404 is a MISS; a transport failure THROWS. The miss rate alerts on a **tumbling window**, never a lifetime
total, or a long-lived host could never notice a purged container.

**The nightly audit is a ROTATION SWEEP (D-51).** The old index↔index scan is deleted: it never read Cosmos, so
it could not see "Cosmos has a service the index never received", and above 5,000 providers it skipped its own
check while reporting all-clear. Now: `SELECT TOP (batch) FROM Business WHERE Id > @cursor ORDER BY Id`
(a clustered-PK seek), one single-partition Cosmos read + one per-business query per plane + the artifact check,
with `batch = ceil(total / SearchAudit:TargetCoverageDays)` capped by `MaxBusinessesPerRun`. The cursor is ONE
`SearchAuditWatermark` in `SystemData` (id `search_audit_watermark`, pk `system`), advanced only after a batch
fully succeeds. ‼️ **When the ceiling binds an admin alert states the REAL coverage period** — it must never go
quiet, which is exactly how the old one failed. Closed and Suspended businesses are expected to hold ZERO
documents in both planes, so the sweep is also a standing check that closures completed.

**Admin health** (`GET /admin/search/health`) now enumerates BOTH planes and each row carries its `plane`: a
stamp whose private cells are unreachable answers no phone calls at all while the marketplace looks fine.

### deploy.ps1 specifics

- `Add-SearchTopologySettings` is **the only place a search endpoint or an index alias reaches an app**, called
  at all **six** app-settings emit sites (Functions applied · API applied · `$apiSettings` · `$functionAppSettings`
  · `$mcpAzureSettings` · `$mcpAppSettings`). MCP gets `-IncludePublicPlane:$false`.
- `$REGIONS` carries `PublicCountries` per stamp (`@("CA")` / `@("IN")`) — **the countries with their OWN index
  pair on that stamp**. `Initialize-StampContext` copies it to `$script:PublicCountries`; a startup guard rejects
  an empty list or a non-ISO-alpha-2 entry.
- `Get-PublicCountryAliasKeys` builds the per-stamp alias keys for post-deploy verification. It is called AT the
  verification site, never accumulated into the static manifest — the manifests are appended inside the stamp
  loop, so a static append would leak one stamp’s countries onto the next.
- The static manifests list the endpoint and the cell aliases: a missing CELL alias refuses to boot the host, a
  missing ENDPOINT boots it into the unprovisioned degradation, which answers every search empty — silent, and
  therefore worth verifying.

### ‼️ 2026-09-22 — THERE IS NO SECOND CATALOGUE STORE, AND THE PRIVATE PLANE IS EXHAUSTIVE EVERYWHERE

**The Cosmos fall-through on every catalogue search path is DELETED** (owner, amending D-33). It matched raw
substrings on `name` and `description` alone: measured live, *"skid steers"* found **0 offerings where the index
found 43** — and it then handed the model a `None` result whose note says *"Tell the caller warmly that you
cannot find that one."* A broken search became the business denying its own stock, and nobody could see it,
because a partial answer reads exactly like a complete one.

- **What a caller hears now**: *"I can't check right now — let me take a message."* `VoiceCatalogSource.Cosmos`
  is renamed **`Unavailable`**; `LookupAsync` ends `result ??= Unavailable()`; `RetrieveCandidatesAsync`
  returns `[]`, which `ProviderCatalogAnswerService` already maps to the same thing.
- **‼️ AND AN ADMIN ALERT IS MANDATORY** (owner: *"that is a must"*). `ICatalogAlarm.RaiseCatalogueUnreachable`
  is implemented in all three hosts. It is **silent when `IndexAvailable` is false** — an unprovisioned stamp
  is configuration, not an outage, and alerting there would Critical on every healthy boot.
- **Deleted with it**: `IServiceRepository.SearchPublicCatalogAsync`, `CatalogRepositoryQuery`,
  `CatalogRepositoryPage`, `BuildCatalogPredicate`, `BuildPriceClause`, and the `Voice:Catalog:CosmosFallbackMaxScan`
  setting from all three hosts. `LoadNearestGroupsAsync` is an index **facet** now — the last Cosmos read on a
  search path, at 30–41 RU a call.
- **The only repository call left** on that path is `GetGlobalCategoriesAsync`, which is CACHED and is a
  SECURITY control: the model's group name is resolved to an id we own, so model text never reaches a filter.

**‼️ BOTH private indexes are `exhaustiveKnn`, uncompressed — the knowledge one was not, for a whole phase.**
`KnowledgeSearchIndexInitializer` takes no plane parameter (every knowledge index is a private-cell index), so
it silently built the PUBLIC plane's HNSW + `bq-mrl`. Exhaustive KNN **cannot rescore**, and rescoring against
the full-precision originals is the whole mechanism that makes binary quantisation safe — without it recall@10
fell to 68 % here. The private plane's vector configuration now lives in ONE place,
**`cosmosindexsetup\PrivateVectorSearch.cs`**, which both initializers read.

**‼️ A cell alias is a PRIVATE alias.** All three hosts had shipped
`Cells.cell1.CatalogAlias = "clinket-dev"` — the customer-facing index. `PrivateCellAliasConventionTests`
(one copy per host) now fails on that. `deploy.ps1` was always right: `private-catalog-$cell$EnvSuffix`.

**D-2 GATE 2 IS CLOSED — PASS** (`Data\search-topology\findings\PHASE-2-QUALITY-PARITY.md`). 1,335 cards from
87 real documents, two indexes differing only in the vector configuration: recall IDENTICAL, MRR within 0.5 %,
sign test **p = 1.000**, and the private arm uses ZERO vector-index quota. The gate was proven able to FAIL.

**Two traps this phase paid for, which will be laid again:**

1. **A counter on a SCOPED service cannot say "on this host".** `_consecutiveCatalogueUnreachable` was an
   instance field, so a stamp-wide outage reported *"1 in a row"* five hundred times. Static now.
2. **A name in a guard's registry is not evidence.** `IndexCoverageMinRatio` named a reader that IS compiled
   into the API host — but its only caller is registered ONLY in Functions, so the API tuned a value nothing
   read, for months, with a written reason for the divergence.

## 2026-09-23 — explicit SQL/catalog setup for new environments

`cosmosindexsetup` now references the shared Infrastructure library and runs pending EF migrations,
then the existing `BillingCatalogSeeder`, then verifies the catalog version and all six catalog families
before normal Cosmos/Search setup. `--all-regions` visits ca then in; `--sql-only` limits the run to SQL.
Search/synonym-only and service-description migration modes do not run SQL schema migrations or billing seeding.
The setup tool uses `ConnectionStrings:IdentityDb`; the APIs keep `ConnectionStrings:DefaultConnection`.
Regional `Payments:Regions` is ca=[us,ca], in=[in], with no base list. `SeedData:Enabled=false` does not disable
required billing seeding. The automation's setup paste block is nested JSON, includes Environment and
Payments.Regions, and uses the same stamp region list as the API's existing environment variables.

API startup behavior is unchanged: one seed attempt per process start, errors logged, next start retries.
A migration applied while the API is already running does not trigger the startup task again. Prefer setup
before application traffic; otherwise restart the API after migrations or run setup with `--sql-only`.
Existing migrations are never regenerated or edited. Billing seeding is insert-only at every catalog version;
existing admin prices, pending prices, entitlements, taxes, fees and inactive products are preserved. Environment/database mismatch and two
stamps resolving to one SQL target are refused before writes. See the setup project's
SQL Server Testcontainers tests, including failed startup -> migrate -> restarted seed task -> success.
## Provider web hostname (owner-confirmed 2026-09-23)

The provider/business dev app is **https://business.dev.clinket.com/**. Regional dev hosts are
`https://business-ca.dev.clinket.com/` and `https://business-in.dev.clinket.com/`.
The provider hostname is `business` for each environment; `clinqetwebpartnerapp` remains the repository name.
Use these current URLs in instructions, tests and browser verification.

## Search-topology Phase 3 settings (2026-09-24)

- **`OfferExpirySweep__TimerSchedule`** — a Functions `local.settings.json` key, so it is written per stamp by
  `deploy.ps1` (CA/US `0 15 8 * * *`, IN `0 30 0 * * *`). The sweep's other settings live in the Functions
  `appsettings.json` (`OfferExpirySweep` section) and need no deploy entry.
- API `appsettings.json` only (no deploy entry): `Search:RateLimiting:Place:RequestsPerMinute` (30),
  `Geocoding:ReverseCellDecimals` (3) / `ReverseCacheMinutes`, `CosmosDb:OfferDeleteTtlDays` (7).
- No new Azure resource, queue or container in Phase 3; the per-country public index pairs are the Phase 1
  `Search:Topology:Public:Countries:<ISO2>:*` settings `deploy.ps1` already writes per stamp.

## Search-topology Phase 3C settings (2026-09-25)

- **`-StaticMapsApiKey` / `-StaticMapsSigningSecret`** (DD-36, both optional, set TOGETHER — the API's
  `StaticMapSettingsValidator` refuses one without the other): written to the Main API as `StaticMaps__ApiKey` /
  `StaticMaps__SigningSecret` (the `$apiCredentials` merge, and the per-stamp local-dev settings), and listed in
  `$__sharedGlobalKeys`, so they must be identical across stamps. The key is restricted to the Maps Static API only;
  the API signs every map URL the apps show. Unset ⇒ the static-map endpoint answers 503 `Error_MapUnavailable`.
- ‼️ **Owner prerequisites before deploy**: enable **Places API (New)** in the Google project (probed 2026-09-25:
  `SERVICE_DISABLED`) — place suggestions use the existing server key (`-GeocodingApiKey`); create a Maps-Static-only key
  and the URL signing secret. Runbook: `Data\search-topology\RUNBOOK-GOOGLE-MAPS.md` (one key per surface,
  restrictions, daily quotas + billing budget, the per-instance limiter decision, rotation).
- API `appsettings.json` only (no deploy entry): `GooglePlaces:*` (`SuggestionsPerMinute` 60, `PlaceDetailsPerMinute`
  30, …), `StaticMaps:RequestsPerMinute` (60), `Geocoding:WriteWaitMilliseconds` (4000), `Discovery:PointCellDecimals` (2).
  Functions `appsettings.json` only: `CosmosDb:ChangeFeed:LeaseBusyMaxReschedules` (6) /
  `LeaseBusyRescheduleBaseSeconds` (30). Identity: the orphan `Identity:ExternalLogin:CountryCode` is deleted.
- No new Azure resource, queue or container in Phase 3C.

## Post-ranking follow-ups (audit 2026-10-01) — two queues, the size + OOM alerts, the binding guard, release order

### New Service Bus queues (per stamp; `events.json` + `deploy.ps1`)
| Queue | Session | Dup window | TTL | Lock | Max delivery | Size | Consumer |
|---|---|---|---|---|---|---|---|
| `provider-score-refresh{suffix}` (`$qProviderScoreRefresh`) | **Yes** (businessId) | P1D | max (`P10675199DT2H48M5.4775807S`) | PT5M | 5 | **5120 MB** | `ProviderScoreRefresh` |
| `insights-day-rollup{suffix}` (`$qInsightsDayRollup`) | No | P1D | P1D | PT5M | 5 | 1024 MB | `InsightsRollup` |
- Both: `requiresDuplicateDetection` true, `deadLetteringOnMessageExpiration` true, batched operations, not partitioned.
  ‼️ `maxDeliveryCount` MUST equal the Functions `RetrySettings:MaxDeliveryCount` (5) — each processor alerts on the
  final delivery. Duplicate detection cannot be switched on in place.
- `provider-score-refresh`: producers Functions (worker, safety net, change feeds) + API (conversations, admin overrides);
  scheduled messages wait months (fade nights, override ends), so TTL is the maximum and the queue takes Standard's
  largest size. `insights-day-rollup`: Functions only; message ids carry the run.

### Settings
- `ServiceBusSettings__ProviderScoreRefreshQueueName` and `ServiceBusSettings__InsightsDayRollupQueueName` are in
  `$script:ServiceBusEntitySettings` ⇒ written and REQUIRED on every host (API, Identity, Functions, MCP).
- `ProviderScoring__SafetyNet__TimerSchedule` = `0 0 2 * * *` on the Function App (timer binding of
  `ProviderScoreSafetyNet`), listed in `$script:RequiredFunctionAppSettings`.
- W10: `$script:RequiredFunctionAppSettings` also requires `CosmosDb__DatabaseName`, `CosmosDb__ContainerNames__ProviderData`,
  `CosmosDb__ContainerNames__Transactions`, `CosmosDb__ChangeFeed__LeaseContainerName`,
  `CosmosDb__ChangeFeed__ProviderDataUnifiedLeasePrefix`, `CosmosDb__ChangeFeed__TransactionsOfferLeasePrefix`.
- ‼️ **Binding guard** (W10, audit E-10): `deploy.ps1` scans `..\clinqetfuncations\Clinqet.Communications\**\*.cs`
  (not bin/obj) for every quoted string holding a `%Setting%` — `'"[^"\r\n]*%[A-Za-z0-9_:]+%[^"\r\n]*"'`, so a token
  INSIDE a longer binding string is caught — maps `:` → `__`, and throws for any not in
  `$script:RequiredFunctionAppSettings`. Zero bindings found ⇒ throws (it read nothing); the Functions repo not beside
  the script ⇒ a yellow `[SKIP]`. Test: `tests/FunctionsHostSettings.Tests.ps1`.
- appsettings only (no deploy entry): `ProviderScoring:Refresh:*`, the rest of `ProviderScoring:SafetyNet:*`,
  `ProviderScoring:MaxConversationsRead`, `SmartAnalytics:Rollup:*`. Removed: `SmartAnalytics:MaxParquetFilesPerRun`.

### Alerts, memory, storage
- **Queue size** (`analytics-alerts.json`, `{envPrefix}-clinket-sb-queue-size-{n}`, one metric alert per namespace):
  metric `Size` split by `EntityName`, Average over PT1H, severity 2, threshold `sbQueueSizeBytesThreshold` default
  **805306368** (768 MB). Scheduled messages and session state never show as active, so the backlog alert cannot see a
  queue filling; a full queue refuses every send (QuotaExceeded).
- **Functions OOM (W6)**: `{envPrefix}-clinket-functions-oom` (scheduledQueryRule, PT5M, severity 1, split by instance):
  `AppExceptions` of `clinket-functions-*` with `ExceptionType == "Microsoft.Azure.WebJobs.Script.Workers.WorkerProcessExitException"`
  and `OuterMessage has "code 137"`.
- **Function App memory**: `$FUNCTION_INSTANCE_MEMORY_MB = 2048` in every environment (`functions.json` `instanceMemoryMB`
  default 2048, allowed 512/2048/4096); `MALLOC_ARENA_MAX` = `2` merged into the Function App settings (PDFium native heap).
- **Storage lifecycle** (`storage.json`): `analytics-insights-daily-lifecycle-policy` (`analytics/insights-daily/day=`,
  delete after 120 days) and `analytics-insights-runs-lifecycle-policy` (`analytics/insights-daily/_runs/`, 3 days).

### ‼️ Release order (audit C-2)
1. **ARM** (`deploy.ps1`): both queues per stamp, the size alert.
2. **`cosmosindexsetup`** (search index update — `listingReviewCount`) BEFORE both Functions and the API.
3. **Functions** (queue consumers, the safety-net timer, the new alert types).
4. **API**, then **MCP**, then the web and phone apps.

<!-- search-topology-phase5 -->
## Search-topology Phase 5 (2026-10-02) — deploy.ps1 and ARM

- **Private cell alias check (D-110c):** `Assert-PrivateCellAliasesExist` runs once per stamp, after the search key is read
  and before any app-settings block writes a cell: a listed cell missing either alias STOPS the deploy naming it and the
  setup command; zero indexes (fresh environment) or no search service ⇒ skipped; unreadable ⇒ stops as unverified.
  Test: `tests/PrivateCellAliasCheck.Tests.ps1`. Order for a new cell: `cosmosindexsetup` first, then deploy.
- **Search monitoring (D-114/D-115/D-128):** `analytics-alerts.json` adds a per-stamp action group
  `clinket-search-alerts-{env}-{stamp}` (emails + common-schema webhook to the Functions receiver, key from Key Vault),
  the A1 metric alert and A2–A5 log rules; the shared `clinket-alerts-{env}` group is unchanged. Thresholds are
  `deploy.ps1` parameters (`SearchSlow*AlertThresholdMs`, `SearchSlowAlertMinimumSamples`, `FirstWordsAlert*`).
  The Functions identity gets a CUSTOM role (`search-alert-reader-role.json`, only `Microsoft.AlertsManagement/alerts/read`,
  assignable scopes unioned across stamps) — ‼️ so the deployer needs `roleDefinitions/write` (Owner or User Access
  Administrator). Only the stamp WAF (`networking-perstamp-health.json`) allows `/monitoring/search-alerts`, behind a
  rate-limit rule (`searchAlertReceiverRateLimitPerMinute`, 30); the apex has no bypass. Test: `tests/SearchMonitoring.Tests.ps1`.
- **Functions binding setting** `Search__Capacity__TimerSchedule` is written for both stamps and is in the required list.
- **`cosmosindexsetup` emitted settings** now include `ServiceBusSettings` (connection + `admin-alerts` +
  `change-feed-failures` queue names) and `Search.Swap.EmbeddingModel` (= `$openAiEmbeddingDeploymentName`) for the index
  swap. A region that swapped an index keeps `Search:IndexVersions` in `appsettings.{ca|in}.versions.json`, which this
  output never touches.
- **Sol 6.1:** `$openAiVerifierDeploymentName = "gpt-6.1-sol"` version 2026-09-29; deploy.ps1 has no delete path, so the
  old `gpt-6-sol` deployment stays until removed by hand. `BusinessSearch__Answer__TopicDeploymentName` = Luna.
- 2026-10-02: the dev Function apps were missing 14 settings and 2 queues because deploy.ps1 had not been run since they
  were added — added directly on the owner's instruction (`Data/functions-settings-audit/APPLIED-2026-10-02.md`).

## Knowledge reading accuracy (2026-10-03) — release order

- ‼️ **Deploy the API and Functions in ONE release, then the partner web and mobile apps.** Each side reads what the other
  writes: the API reads the new `AdminAlertType` values that Functions stores
  (`KnowledgeReadingNeedsReview`, `ProviderSetupReadingNeedsReview`, `KnowledgeAggregateCardsWarning` / `Limit`,
  `KnowledgeOverviewsLeftOutSpaceFull`, `KnowledgePictureSectionsWarning` / `Limit`), and the API's "Report wrong answers"
  sends `KnowledgeWrongAnswersReported`, which Functions' `AdminAlertProcessor` keys by EventId (a Functions app without that
  value dead-letters the report as InvalidJson). The report button exists only in the new apps, so they ship last.
- The API's `NewtonsoftTokenJsonConverter` (nested alert details as real JSON, not `[]`) ships with the same release.
- No new queue, container, ARM parameter or `deploy.ps1` key: every new setting is appsettings-only
  (`Voice:Knowledge:WrongAnswerReportsPerMemberPerHour`, `RetrievalLookupOverviewSeats` / `RetrievalBrowseOverviewSeats`,
  `DocAggregateMinRangeValues` / `DocAggregateCardsWarning` / `DocAggregateCardsLimit`, `Images:SectionsPerImageWarning`, `AIAssistant:ProviderAttachmentProcessing:{MaxReadingPasses,
  AnchorNameTokenOverlap, OfferingJudge}`).
