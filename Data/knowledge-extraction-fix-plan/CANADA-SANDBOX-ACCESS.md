# Canada sandbox access for the AI Knowledge fix programme

Everything a fix session needs to drive the **deployed** Canada nonprod pipeline end to end, so nobody has to ask the owner for it again. The owner placed this here on 2026-09-10. `C:\Nik\Data` is **not** a git repository; nothing in this folder may ever be copied into a repo, an `appsettings*.json`, a `local.settings.json`, a SKILL, a memory entry or a chat transcript (CLAUDE.md §19 governs real production secrets; this is the nonprod stamp, accepted by the owner on 2026-09-05 and again on 2026-09-10).

| What | Where | Used by |
|---|---|---|
| **Service Bus connection string** (namespace `clinket-servicebus-ca-v4-nonprod`, `RootManageSharedAccessKey`) | `C:\Nik\Data\knowledge-extraction-fix-plan\secrets\ca-servicebus.txt` (one line) | `tools\kaudit` (`push`, `wait`, `batch`, `reprocess`, `delete`) and `tools\kqueue` read it automatically from this path first, then fall back to `<scratchpad>\secrets\ca-servicebus.txt` |
| Cosmos DB (`clinket-ca-v4-nonprod-eastus2`, database `Clinket-nonprod`), Blob storage (`clinketstoragecav4dev`), Azure AI Search (`clinket-search-ca-v4-nonprod`) | `C:\Nik\cosmosindexsetup\appsettings.ca.json` (tracked, nonprod, owner-accepted) | `tools\kaudit` reads them at runtime; never copy a value out of it |
| Knowledge queue | `knowledge-ingest-dev` (session-enabled; session id = businessId; message id `{businessId}:{docId}:Full:{ticks}`; body `{BusinessId, DocId, Mode:"Full", Attempt:1, ForceFresh:false, PreferredLanguage:"en", CorrelationId, SchemaVersion:2}`) | `kaudit push/batch/reprocess` |
| Knowledge index | alias `clinket-knowledge-dev` → physical `clinket-knowledge-dev-v1` (REST api-version `2026-04-01`; `docId`/`businessId` are **not facetable** — count per docId with `top=0`; `hasEmbedding` is hidden — never `select` it) | `kaudit pull/drift/measure/indexinfo` |
| Cosmos containers | `KnowledgeBase-dev` (pk `/businessId`: documents, drafts, analytics, image registry), `ProviderData-dev` (pk `/businessId`: `BusinessProfile`, `SelectedCategory`, `Service`, `ServiceArea`), `SystemData-dev` (`AdminAlert`) | `kaudit sql <region> <container> <pk> "<query>"` (partition-scoped only) |
| Content artefacts / images | blob `provider-knowledge` container: `{businessId}/{docId}/{file}`, `{businessId}/_artifacts/{docId}.json.gz`, `{businessId}/_images/{docId}/{imageId}.*` | `kaudit pull` |

## ‼️ DRIVING THE API AS A PROVIDER — no more asking the owner for a JWT (added 2026-09-15)

| What | Where | Notes |
|---|---|---|
| Provider JWT (business `MEE3IC`, *Complete Hair & Beauty*, Salon & Beauty) | `secrets\ca-provider-jwt.txt` | Lives ~2 hours. **Do not hand-edit** — the helper rewrites it |
| Provider REFRESH token | `secrets\ca-provider-refresh.txt` | The durable credential. Mints a new JWT whenever the current one 401s |
| Ready-made helpers | `tools\api.py`, `tools\adminapi.py`, `tools\listblobs.py` | Read the two files above automatically |
| **Search + embeddings** | `tools\srch_client.py`, `tools\emb_client.py` | Sign themselves from the tracked nonprod `cosmosindexsetup\appsettings.ca.json` and the Functions `appsettings.json`. No SDK, no extra credential |
| **`tools\kprobe.py`** | **Replays the retrieval's EXACT hybrid query** — same search text (escaped, digit-expanded, code-wildcarded), same searchFields, same filter, same scoring profile, same vector k — against the LIVE alias. The deployed MCP host answers `403 Ip Forbidden` from here, so this replay IS the proof | `py kprobe.py MEE3IC "how much is a haircut"` · `--script Gujr` · `--keyword-only` · `--cjk` · `--docs a,b` |

‼️ **kprobe is a REPLAY, not the service.** It proves the INDEX and the QUERY. It cannot prove the gates, the
trim, or the note the model is handed — report what it shows as *"the query the service builds returns X"*,
never as *"the receptionist said X"*.

‼️ **THREE traps, all paid for on 2026-09-15:**
1. The **Analyze** API does NOT resolve an alias — it needs the PHYSICAL index name
   (`clinket-knowledge-dev-v1`). `GET /aliases` gives it, and THAT endpoint needs api-version **2026-04-01**.
2. **docs/search** DOES resolve the alias, but only on the newer api-version; on `2024-07-01` it answers
   `404 index not found`, which reads exactly like a missing index.
3. The scoring profile is **`knowledgeRelevance`** — the C# constant is `SearchScoringProfiles.KnowledgeRelevance`
   and its *field name* is not its *value*. Guessing it costs a `400 UnknownScoringProfile`.

```python
import sys; sys.path.insert(0, r"C:\Nik\Data\knowledge-extraction-fix-plan\tools")
import api
status, body = api.call("GET", "/knowledge/documents?page=1&pageSize=50")
status, body = api.call("POST", "/knowledge/documents/%s/rerun-analytics" % doc_id)
api.put_blob(sas_url, data, "text/csv")          # upload straight through a granted SAS
```

`api.call` retries **once** through `refresh_token()` on a 401, so an expired JWT heals itself and you never
have to ask the owner. `tools\listblobs.py` lists a blob prefix with Shared Key auth (no azure SDK needed);
it reads the storage connection at runtime from the tracked nonprod `cosmosindexsetup\appsettings.ca.json`.

‼️ **A REFRESH TOKEN IS SINGLE-USE AND ROTATES.** Every refresh returns a NEW one and spends the old.
Reusing a spent refresh token triggers `RevokeAllOnReuse` and **kills every session on that account** — the
owner would have to log in again everywhere. `tools\api.py` persists the rotated value immediately, which is
the only reason this is safe. **If you copy the token somewhere else, you have created a landmine.** Use the
helper; do not roll your own refresh.

‼️ **These are SANDBOX credentials for a non-production stamp, and the owner has explicitly ruled storing
them here ACCEPTED (2026-09-15)** — the same ruling that already governs `ca-servicebus.txt` beside them.
`C:\Nik\Data` is **not a git repository**, so nothing here can be committed. That ruling does NOT extend to
production credentials, to any repo, or to pasting a token into a chat message.

‼️ **AND IT ONLY SELF-SERVES WHILE ITS REFRESH TOKEN IS THE NEWEST ONE FOR THAT ACCOUNT.** Observed
2026-09-15: a later interactive login (the one that produced an admin JWT) superseded the stored session, and
the refresh then answered `401 {"message":"Invalid or expired token. Please log in again."}`. So a stored
refresh token is not immortal — **if refresh 401s, stop and ask the owner for a fresh login response
(the whole JSON: `token` AND `refreshToken`), then write both files.** Do not retry a rejected refresh in a
loop; a refresh token is single-use and hammering one is how `RevokeAllOnReuse` fires.

‼️ **A TRAP WORTH KEEPING, paid for the same night.** `tools\api.py` retries transient transport failures so a
long watch survives a dropped connection. That retry clause **must stay BELOW the `HTTPError` clause**:
`HTTPError` is a SUBCLASS of `URLError`, so placed above it, it swallowed every 401 and the token could never
refresh itself. The symptom was a watch dying on "401 Unauthorized" that should have healed silently.

**The admin JWT is still owner-supplied** (`secrets\ca-admin-jwt.txt` if you are given one). Admin tokens have
no refresh stored, so ask when you need the alert list. Everything else is self-service.

## ‼️‼️ THE BROWSER AND `tools\api.py` CANNOT BOTH HOLD A SESSION ON THE SAME ACCOUNT (proven twice, 2026-09-15)

**Asking the owner to sign in to the partner web app KILLS the stored API session**, because every login
revokes every existing refresh token on that account (below). It happened twice in one day: the second time
the session had been handed over minutes earlier, was used successfully, rotated its refresh token once, and
then died the moment the owner signed in to the browser for a UI check.

**The order therefore matters, and it is one line:**

> ‼️ **Sign in to the browser FIRST. Paste the token pair SECOND.** A login after the paste revokes the paste.

If both are needed at once, use two different accounts — the browser on the owner's, `api.py` on another
provider account.

‼️ **And a rule for the probing scripts themselves:** a poll loop that calls `api.call` every 45 seconds will
make one refresh attempt per call. On a REVOKED token that is harmless (revoked is a different branch from
used), but it is still 30 minutes of noise hiding a one-line answer. **Stop on the first 401 that survives a
refresh and say so**, rather than logging `401` forty times.

## ‼️ WHY A STORED SESSION DIES, AND IT IS NOT THE REFRESH TOKEN'S FAULT (root-caused 2026-09-15)

**Every fresh interactive login on that account REVOKES every existing refresh token.** The sign-in paths
call `InvalidateRefreshTokensAsync(userId)` **before** issuing the new session, and that sets `IsRevoked` on
every row the user owns (`AuthService.cs` ~3464). So the moment the owner signs in to the partner app, the
refresh token sitting in `secrets\` is dead — and nothing tells you until the stored JWT ages out ~2 hours
later and the refresh answers 401. That is exactly what happened on 2026-09-15 at ~06:00 local.

‼️ **There are only FIVE reasons `POST /auth/token/refresh` returns 401** (`AuthService.RefreshTokenAsync`),
and knowing which one you hit matters:

| Condition | What happens |
|---|---|
| Refresh token **not found** | 401. Nothing else |
| Belongs to a **different user** | 401. Nothing else |
| ‼️ **`IsUsed`** — already spent | 401 **AND** `Security:RefreshToken:RevokeAllOnReuse` (default **true**) **revokes every token on the account** |
| **`IsRevoked`** — killed by a later login, a password/phone change, a lockout or a logout | 401. Nothing else |
| **Expired** — `RefreshTokenValidityInDays` is **7** | 401. Nothing else |

**Only the `IsUsed` branch is dangerous**, and it is checked BEFORE `IsRevoked`. A revoked token is a safe
401; a *spent* one is the landmine. Since you cannot tell them apart from the outside, **never retry a
rejected refresh** — one attempt, then stop and ask for a fresh login.

**To restore a session:** sign in as the provider, write the login response's `token` into
`secrets\ca-provider-jwt.txt` and its `refreshToken` into `secrets\ca-provider-refresh.txt` — one line each.
Then `tools\api.py` self-serves again. The JWT lives ~2 hours; the refresh 7 days **or until the next login,
whichever comes first**.

‼️ **The search and embedding tools are UNAFFECTED by any of this.** `srch_client.py`, `emb_client.py` and
`kprobe.py` sign themselves from the tracked non-production configuration and need no JWT at all.

## ‼️ THE STATE OF THE CANADA SEARCH SERVICE AFTER PHASE 3 (2026-09-15) — read before you touch it

| Thing | State |
|---|---|
| `clinket-knowledge-dev-v1` | **2,850 cards (CA) / 2,625 (IN). The OLD shape — no `contentCjk`.** The copy SOURCE, kept as the only fallback until the owner deletes it |
| `clinket-knowledge-dev-v2` | ‼️ **LIVE, and the alias points HERE (2026-09-16).** 2,850 (CA) / 2,625 (IN) cards, copied out of v1 — vectors byte-identical, verified field by field. Carries `contentCjk` + `knowledgeCjkAnalyzer`, a **retrievable AND stored** `contentVector`, and the three unused attributes dropped |
| `clinket-knowledge-dev` (alias) | **→ v2**, both regions |
| `Voice:Knowledge:CjkFieldEnabled` | ‼️ **DELETED — the setting no longer exists.** Do not look for it, do not re-add it. Both indexes declare the field, so the code names it unconditionally |

‼️ **DONE 2026-09-16 — there is no re-ingest and no flag.** v2 was rebuilt and refilled BY COPYING every card
out of v1, because v1 hands back every field including the vector. No Document Intelligence, no vision lane,
no judge, no AI spend — minutes. The copier was throwaway code, deleted after the run; the recipe lives in the
`clinqet-search-discovery` SKILL.

‼️ **THE PERMANENT RULE THIS LEAVES BEHIND:** the binaries name `contentCjk` on EVERY query, and naming a
field an index does not declare is a **400 on every search**. So an index rebuild ALWAYS precedes the deploy
that names a new field, in every region, never the other way round.

```
dotnet run --launch-profile "Dev (Canada)" -- --search-only     # rebuilds v2 and points the alias at it
dotnet run --launch-profile "Dev (India)"  -- --search-only     # separate search service — BOTH are needed
```

‼️ **Never `--recreate-aliases`.** It DELETES the index whose name the alias wants. Nothing in this sequence
needs it.

‼️ **`shutil.copy2` / `cp -p` preserve mtime.** If you snapshot a source file, mutate it and copy it back,
MSBuild will not rebuild — and your next `dotnet test` runs the mutated binary from innocent-looking source.
Touch the file after restoring. This produced two false sabotage verdicts on 2026-09-15.

## Businesses

| Business | What it is | Use it for |
|---|---|---|
| `SX3SG2` | *MK Construction Equipment* — selected categories Construction and Mining, Material Handling, Power Systems, Attachments and Accessories, Marketplace & Classifieds; 708 machines listed; the **17 retained fixture documents** (ids in `PLAN.md` §"Owner rulings") and three JSON inventories | extraction/passage/image proof by `kaudit reprocess ca SX3SG2 <docId>` + `kaudit pull`; **never** for drafts proof (the judge removes salon/auto/clinic lines as not sold here — correctly); **never delete the 17 fixture documents before Phase 4** |
| `MEE3IC` | the owner's business with `gopi.jpeg` (`be07d747c73944a587a3a1029cb5717f`, drifted 7/0, undescribed) | Phase 1 heals it |
| `MKC85P` | the owner's two real pharma PDFs (`10af723e4f764d40b10498365da5b9a8` SOP pack 173 cards, `74a5becb831d4e1e886485738e644b58` MFR/BMR pack 172 cards — the cross-page table on page 22) | A5-L / A16-L proof; read-only unless the owner says otherwise |
| a matching test business for drafts | create one (or add categories to an existing test business) whose selected categories are a salon, an auto-repair shop, a clinic | Phase 2 drafts proof |

## What still cannot be done from a dev machine (verified 2026-09-10)

- The Canada API (`api-ca.dev.clinket.com`) rejects a locally minted admin JWT (its signing key is Key-Vault-stamped, not the tracked appsettings) — drive the pipeline through the queue (`kaudit`), or ask the owner to run an admin endpoint (`POST /api/v1/admin/search/reindex-knowledge/{businessId}?forceFresh=true`).
- The deployed MCP host answers `403 Ip Forbidden` — replay the service's own hybrid query instead (runbook).
- `clinqetfuncations\...\local.settings.json` still points at the retired `in-v2` India stamp (hosts do not resolve); India v4 lives in `appsettings.in.json`.
- `python` on this machine is the Microsoft Store stub; use `dotnet` tools (`tools\kpdf` renders PDF pages like the pipeline).

## Commands (from `C:\Nik\Data\knowledge-extraction-audit\tools\kaudit`, `dotnet run --` or the built dll)

```
kaudit list ca [n]                              rows in KnowledgeBase-dev (all businesses)
kaudit pull ca <biz> <docId> <outDir>           row.json, artifact + blocks (with the verifier's ## reviews), cards, image blobs, drafts
kaudit drift ca                                 row passageCount vs index count per document
kaudit alerts ca <needle>                       AdminAlert rows containing the text (docId)
kaudit sql ca <container> <pk> "<sql>"          partition-scoped read-only query
kaudit push ca <biz> <file> [docType]           create row + blob + Full ticket for a new document
kaudit batch ca <biz> <listFile> <outDir>       push every path in listFile, poll, pull each
kaudit reprocess ca <biz> <docId>               CAS the row to Processing and send a Full ticket on the SAME id (fixture re-run)
kaudit wait ca <biz> <docId> [seconds]          poll until Ready/Failed
kaudit delete ca <biz> <docId>                  the real purger path (never a raw Cosmos delete)
kaudit measure ca <biz> <docId>                 card byte sizes (B1)
kqueue knowledge-ingest-dev [active]            active/dead-letter counts, DLQ peek (+ active peek)
kpdf <pdf> <page> <out.png>                     render a page as the pipeline's rasterizer does
```

`kaudit` (`tools\kaudit`) and `khead` (`tools\khead`) are separate projects; `khead` references `clinqetinfrastructure` and therefore builds the shared libraries — check that no other session is working in `C:\Nik` before building it.
