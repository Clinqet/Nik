# Business Search — PLAN v3 (2026-09-02)

> **Scope change locked by the owner on 2026-09-02:** everything is ONE project delivered NOW. The knowledge
> document audience (was §5) and the authorization-aware business questions (was §6) are **not** post-launch
> phases — they ship inside this project. Search must answer over **the whole business**: knowledge documents,
> typed FAQs, services, offers, availability, profile, and every work record the asking member is allowed to
> see. **Every phase ends with a full multi-dimensional audit — mandatory, never skipped, part of the phase's
> definition of done.**
>
> Authority: the owner's words (`00-ORIGINAL-PROMPT.md` + the 2026-09-02 feedback) > this plan > `findings/A–K`.
> No code before the owner approves the solution AND the mockup — **every approved sheet is registered in §0**.
> Schema items (§6.1) need the §0.7 table
> answered explicitly.
>
> **Naming:** the feature is `BusinessSearch` (`api/v{v}/business/search`). `ProviderSearch*` is the
> CUSTOMER-side "search for providers" family — 218 existing references (`findings/H` PART 2).
> User-facing label recommendation: **"Ask Clinket"**.

---

## 0. ‼️ THE MOCKUP REGISTER — every sheet the owner has approved, and what each one governs

> Added 2026-09-03 by P2 after the owner caught the omission. **This plan called itself the authority and
> named no mockup file at all** — it said "mockup §1", "mockup §4", "the approved mockup", while the only
> pointers to four approved sheets lived in two phase prompts and one audit. §14's P5 duty is *"a walk-through
> of every approved mockup state on both apps"*, which is impossible without the list. This section IS the list.
>
> ‼️ **A sheet that is approved and appears in no register has been lost, not approved.** Add a row the day a
> sheet is approved. Never delete a row — supersede it, and say what superseded it.
>
> ‼️ **The location is now a platform rule: `CLAUDE.md` §0.20** (and its three twins). Every sheet lives in
> **`C:\Nik\Data\mockups\<sheet-name>\`** and nowhere else. On 2026-09-03 all seventeen folders were moved out of
> `C:\Nik\mockups\` (deleted, never to be recreated) and this programme's own `mockups\` subfolder was moved to
> `Data\mockups\business-search-page\` — two homes had already cost one approved sheet its only pointer.

| # | Sheet | Approved | Governs | Status |
|---|---|---|---|---|
| M1 | `C:\Nik\Data\mockups\business-search-page\provider-ai-search.html` (v3) | 2026-09-02 | The whole page and its core states (empty · running · answered · nothing found · error/time-out · permission denied · daily limit · 360 px responsive proof) · **header entry Option A** (decision 2) · the mobile screen and its entry points · the **"Team search" box** in the document editor (§6.3) · the no-stub control map | **LIVE.** Two parts superseded — see M2 |
| M2 | `C:\Nik\Data\mockups\business-search-sources\index.html` | 2026-09-02 | How a cited source appears: one card per file type · **Show page N** for paginated files · **Show text** for the four types with no real page · the two panels · the shared excerpt renderer · **no download anywhere** | **LIVE.** ‼️ **Supersedes M1** on (a) the "Open the original file" action, which no longer exists, and (b) the grey excerpt quote under a source card, which the wire cannot carry |
| M3 | `C:\Nik\Data\mockups\business-search-voice\index.html` | 2026-09-03 | The microphone in the ask box: eleven states (idle · listening · near cap · transcribing · transcript ready · correction chips · nothing heard · mic blocked · engine error · too long · unsupported · offline) · **the mic never sends** · the correction chip's exact rules · web **and** phone | **LIVE** |
| M4 | `C:\Nik\Data\mockups\business-search-states\index.html` | 2026-09-03 | The eleven states none of the above drew: no documents yet · offline (page level) · very long answer + the sticky strip · **mobile keyboard open** · answer cut short (live **and** replayed) · a restricted document (absence is the rendering) · the source panel's truncated and page-missing outcomes · reopening a saved conversation · **where every state's words come from** (server vs screen) · **the suggestion chips come from the provider's own catalogue** | **LIVE.** ‼️ **Superseded by M5** on §01b's chip row only — M5 §10 puts the bookings and leads chips BACK, for a member who can be answered, now that the work tools exist. Every other rule in §01b (own catalogue, fixed order, Hours reserved, no late pop-in) stands unchanged |
| M5 | `C:\Nik\Data\mockups\business-search-team-answers\index.html` | 2026-09-03 | **Every state of a WORK answer**, web and phone: the sentence that says whose work was counted · "nothing is assigned to you" vs "the business has none" · a refusal that names nobody · the answer naming the colleague it resolved · dates always repeated in words (and "which days?" when none was given) · the **eleven work source cards** and their one action each · ‼️ the **call card's "Clinket's note, not the caller's words"** line · ‼️ **money quoted verbatim + "47, showing 10"** · part-could-not-be-checked · the work chips returning · a **one-person business** seeing none of it · where every state's words come from | **LIVE.** Supersedes M4 §01b's chip row (above). ‼️ **§10's chip row is itself SUPERSEDED IN PART on 2026-09-04 by owner ruling R1 (below)** — the LEADS chip is retired and both work chips are bookings. ‼️ **ONE element is deliberately NOT built as drawn** (P4, owner-confirmed 2026-09-04): the customer card's *"4 bookings · last on 2 Sep"* ships as **"Added {date}"**, because `BusinessCustomer` carries neither figure and the Customers page shows neither — deriving them is one query per card for a number the provider cannot check against their own screen. A booking count would need a projected counter on the customer row ⇒ §0.7. **Do not "complete" this against M5 without a new ruling.** The three other C3 subtitles (message · review · Insights) ship M5's words, but render `yyyy-MM-dd` rather than M5's friendly dates — `Local(...)` is InvariantCulture across all 17 tools |
| M6 | `C:\Nik\Data\mockups\business-search-document-audience\index.html` | 2026-09-04 | **Every state of the "Team search" box** in the document editor, web and phone: waiting for the roles · **the roles could not be loaded** · saving · saved · could not save · nobody picked · not allowed to change · offline · file still being read (changeable, unlike the caller switch) · file being removed · a **one-person business** (absent on the default, **drawn when a file is still restricted**) · a typed question (absent) · the **mark on the document row**, web **and** phone · the phone's own roles list · where every state's words come from | **LIVE.** ‼️ **Supersedes M1 §4** on the role chips only: Owner and Administrator are **not** pickable (they always find every file, so a chip there is a lie), and "Front desk" does not exist — the picker renders the business's real catalogue roles (S8). ‼️ **REVISED 2026-09-04 after the P4 audit** — two states added (roles-could-not-load; a shrunk one-person business still holding a restriction), all "just you" copy renamed to name the owner and administrators, the separate "Try again" button removed (re-tapping the choice IS the retry), §3's justification for the shortened phone words corrected (it was FALSE), and decisions 6/7/8 recorded |
| M7 | `C:\Nik\Data\mockups\business-search-ask-layout\index.html` | 2026-09-04 | **The frame of the answer surface**, web and phone: the screen names itself ONCE (the top bar) · the card fills the width, only the TEXT is bounded · **ONE ask box, docked at the bottom in every state**, prompt switching to follow-up · **ONE Stop**, in the box · the landing block anchored above the box · **the suggestions and the history as TWO LANES** (a suggestion ASKS, a recent question REOPENS) · suggestions wrapping to the whole sentence, history clamped to one line and capped · first visit with no history · offline · cut short · daily limit · error · tablet and phone-width proofs | **LIVE.** ‼️ **Supersedes M1 §1** on the page frame (no second title, full-width card, one docked box) and **M4 §01b** on the *presentation* of the suggestion row only — which chips appear, in what order, and Opening hours being reserved are unchanged, as is M5 §10 |
| M8 | `C:\Nik\Data\mockups\provider-money-multi-currency\index.html` | 2026-09-05 | **Money that is not all in one currency**, web and phone, on the four surfaces that ADD amounts up: today’s earnings tile · the invoice total cards · the invoice list’s group headings · the earnings chart. Every state of each: one currency (byte-identical to today) · two · three or more · nothing yet · loading · could-not-load · role-not-permitted. The rule it fixes: **amounts in different money are never added together** — the headline is the business’s own money and every other currency is named beneath it, in full. Carries the where-every-state’s-words-come-from table | **LIVE** (approved 2026-09-05, P4.6). Drawn because P4.6 measured the sums as arithmetically meaningless — live business `LXDP8G` reads **233510.1** for one day, which is ₹208,511.10 and C$24,999.00 added together. Supersedes nothing |
| M9 | `C:\Nik\Data\mockups\business-search-source-grouping\index.html` | 2026-09-05 | **How a cited source appears, after the four-identical-cards defect**: ONE card per DOCUMENT with the parts the answer used listed inside it, each carrying the words it contributed · the cited parts marked and NEVER rolled up however scattered · the roll-up for a document that gave many parts · a single part collapsing its own chrome · a typed answer · **"Show the whole document" drawn ONLY when the document actually has saved text** · a part with no readable words · truncated · offline · a reopened conversation · web AND phone · the where-every-state's-words-come-from table | **LIVE** (approved 2026-09-05, P4.7). ‼️ **Supersedes M2** on three points: (a) documents GROUP, (b) the excerpt IS carried on the wire and drawn — M2 said "the wire cannot carry" it, (c) a control that cannot work is never drawn. Everything else in M2 stands: no download anywhere, the shared excerpt renderer, `Show page N` for genuinely paginated files. Drawn because one live question returned FOUR cards for ONE document and every one of them offered a "Show text" that 404s — measured, ONE saved whole-document text across 23 blobs on the CA dev store. ‼️ **Superseded on ONE point by owner decision O-1 (2026-09-25, P4-E-26 — `C:NikDataanswer-relevancePLAN.md` §0):** a part or a document the answer does not cite is no longer drawn at all — the server sends only cited sources and both apps draw only what the words cite — so the roll-up and its "Show N more" are gone. Every other point of M9 stands |

| M10 | `C:\Nik\Data\mockups\business-search-conversations\index.html` | **2026-09-06 — owner approved in conversation** | Continuous conversation transcript; Back and New conversation; seventh exchange in the same chat; separate readable-history and AI-context limits; recovery/permission/capacity states; dashboard entry controls; web, iPad and phone previews. See `findings/DASHBOARD-CONVERSATION-REPAIR-2026-09-06.md` | **APPROVED.** Supersedes M7 on transcript and Back/New navigation, and M1 on header history reopening. Existing source and voice rules remain in force. Owner requires web phone/iPad/laptop/large-screen responsiveness and native-app navigation/theme parity |
| M11 | `C:\Nik\Data\mockups\business-search-modern-surface\index.html` | **2026-09-07 — owner approved in conversation** (“entire mockup is good and approved”) | The visual language of the answer surface: the topic bar and the conversation’s own name; the question bubble and the answer’s mark (no card of its own); folded sources on the computer; the answering feedback controls; the composer footer and counter; M3’s listening level meter in house colour; twelve widths from 1920 to a folded cover; and the phone app’s native shape | **LIVE. BUILT 2026-09-07.** Completes M10 and M3. ‼️ **Supersedes M10 on ONE point** — *New conversation* is **outlined, never filled with brand green**, because green fills a **pressed or chosen** control everywhere else in the app. ‼️ **TWO changes made AFTER approval, both owner-instructed in conversation and both now DRAWN IN THE SHEET**: (1) 2026-09-07 — at 1280+ the column opens 780→1100 (1360 past 1600) so a laptop no longer frames the conversation with ~330px of white each side, while the answer’s own paragraph stays capped at 72 characters; (2) 2026-09-08 — *Conversations* and *New conversation* now answer in **ONE colour family** (`--green-soft` hover, `--green-mid` press). Back hovered neutral grey while New hovered green, so two controls in one bar read as two different systems; the hierarchy still holds because New keeps its border. On the phone *New* answers a PRESS in the same green, and the phone’s back arrow is **deliberately unchanged** — it is `CommonHeader`’s shared control across ~30 screens with no per-screen style hook |
| M12 | `C:\Nik\Data\mockups\business-search-refusal-states\index.html` | **2026-09-07 — owner approved in conversation** | Six states and the words they need — governs audit rows U-6 · U-26 · U-28 · U-37: the resume-after-switching state, the long-answer scroll cue, the typed-answer source line, the three voice-panel moments, the shown-of-total row footer, and money in three or more currencies | **LIVE. BUILT 2026-09-07** — all six on web and phone. Supersedes nothing. Two recorded divergences: §05’s “Open all” link names the PAGE rather than the answer’s narrowing (ruling **R8**), and §06’s amber “counted apart, never added” note (**R9**, reversed the same day — the words are verbatim in this sheet, so the sheet IS where they come from; only the sheet’s own words panel was missing a row for them) |

## 0.1 ‼️ RULINGS THAT CHANGE AN APPROVED SHEET WITHOUT A NEW SHEET

> ‼️ A sheet is superseded by a later sheet **or** by an owner ruling. A ruling that changes what an
> approved sheet drew and is written down NOWHERE is the same loss §0 exists to prevent — the next person
> audits the UI against the sheet and "finds" a defect that was a decision. Never delete a row; add one here.

| # | Ruled | Changes | What it does NOT change |
|---|---|---|---|
| **R1** | 2026-09-04, owner, in conversation | **M5 §10 / M4 §01b — WHICH suggestion chips appear.** (a) `BusinessSearch.Chip.LeadsLastWeek` and `canReadLeads` are **retired**; both work chips answer to `booking.read` — `WeekAhead` (schedule) + `BookingsLastWeek` (count). (b) A chip whose rendered question is **already a row in the Recent lane is not offered**, and its slot goes to the next candidate — including `Hours`, which is reserved against the CAP only. (c) A service name that **looks like a stock code is skipped**, and a name that **fits** is preferred over one that must be cut | The rest of M4 §01b and M5 §10 stand: the provider's OWN catalogue, the fixed order, `Hours` last and never dropped by the cap, no late pop-in, and a chip never offered to a member who would be refused. **No new sheet was drawn, and none is owed:** no new screen, control or state — the only new shape is an EMPTY suggestion lane beside a full Recent lane, which **M7 §15.1 already rules** ("the single lane sits at half width beside an empty column") |
| **R2** | 2026-09-04, owner, in conversation | **The landing sentence.** `BusinessSearch.Landing.Body` still named only P1's five Group A sources after P3 shipped twelve more, so it understated the surface by twelve tools; `BusinessSearch.Empty.NoDocumentsBody` had the same list. Both rewritten in five languages on both apps, and the rewrite adds one clause — **"You see only what your role allows."** | It names **no** family the business may not have switched on (refund requests, Insights), because each already has its own "not set up" sentence and the landing must not promise an answer the server will refuse. It does **not** enumerate per-role access on arrival — explicitly rejected as a wall of negatives |
| **R3** | 2026-09-04, owner, in conversation | **The header magnifier on the answer page.** M1 drew the header entry (decision 2) and M7 later docked one ask box on that page; neither drew what the magnifier DOES when the member is already there. It was pushing the open route — a live-looking control that did nothing. It now **focuses the docked box**, falling back to the push if none is found | Everywhere else the magnifier is unchanged: it still opens the small ask panel and hands its question over in memory. The button is **not** hidden on the answer page — that would shift the bell and share controls beside it |
| **R4** | 2026-09-04 — **NOT a defect, recorded so it is not "found" again** | **Mobile's magnifier is dashboard-only while web's is on every page.** Web has ONE shared header; mobile has **no shared header** at all — each screen builds its own cluster above a bottom tab bar. Both apps offer **two** entrances, placed by their own navigation shell | Making it global on mobile means editing ~10 bespoke headers and choosing a placement — a **design change needing a sheet**, not a parity fix. Nothing was changed on mobile |
| **R5** | 2026-09-07, owner, in conversation (audit U-29) | **M5 §10 — the ORDER of the suggestion chips.** The two work chips sit **ahead of the second service name**: after the first service's price chip come `WeekAhead` and `BookingsLastWeek`, then the second service's "what's included", then online booking, with `Hours` last. The reason is that *"what's on this week?"* is the question a provider opens the app to ask, and a second service name is a weaker prompt than their own week. Until now that reasoning lived only in a code comment in `askRules`, so the next audit read the order as a deviation from the sheet and re-raised it | The chip SET is unchanged (R1 still governs which chips appear, the Recent-lane drop and the stock-code skip). `Hours` is still last and still never dropped by the cap. **No new sheet is owed:** no screen, control or state changes — only the sequence within a lane the sheet already draws. The order remains a single fixed sequence, never re-ranked per member or per session |
| **R6** | 2026-09-07, owner, in conversation (audit U-33) | **ONE AUTHOR PER STATE, decided per state on the evidence.** (a) *Cut short* — the **screen** writes it, because only the screen knows live from replayed and the two need different advice; the server now sends the `Partial` FLAG and no words, and `BusinessSearch_Status_PartialAnswer` is deleted in five languages. (b) *Page / text cannot be shown* — the **screen** writes it, because the client turns a 404 on those routes into "nothing to show" without reading the body; the two server sentences are deleted and the body falls back to the generic `Error_NotFound`. (c) *Something went wrong* — the **server** writes it with the screen as a FALLBACK, and this is deliberately left alone | It does **not** make the server the author everywhere: (c) is a chain, not two authors, and the client already renders the server's sentence first and its own only when there is none. The screen's own `BusinessSearch.Partial.*` and `BusinessSearch.Source.*UnavailableTitle` keys stay — they are now the only author of those states, not a duplicate |
| **R7** | 2026-09-07, owner, in conversation (audit U-34 / U-35) | **ONE NAME PER THING, per language.** (a) The brand is **Latin “Clinket” in every script** — 77 Devanagari and Gujarati transliterations replaced, and Latin was already the 90-to-7 majority. (b) The Insights page is named by **its own sidebar entry** in every language: Spanish had three names, French **four**; all nine keys on web and mobile now reuse one noun. (c) The AI Knowledge page is `AI નોલેજ` / `AI नॉलेज` everywhere, ending three names in Gujarati and Hindi across web, phone and the server's notification. (d) **fr-CA punctuation**: no space before `?` `!` `;` (479 values across the three French catalogues), and the space before `:` is **kept** — that is the Québec convention, not an oversight | It does not touch the space before `:` (215 web, 161 phone, 111 server values), and it does not transliterate the brand back. It does not rename the pages themselves — only the places that referred to them by a different noun |
| **R8** | 2026-09-07, me, recorded for the owner (audit U-28) | **THE “OPEN ALL” LINK NAMES THE PAGE, NOT THE ANSWER’S NARROWING.** Sheet `business-search-refusal-states` §05 draws “Open all *unpaid* invoices” and asks for a destination “narrowed the same way the question was”. Only the invoices page reads a filter from its URL today (`Invoices.jsx:116`, `status`), and **no** provider page reads a date range — so for eight of the ten shortenable lists a narrowed promise would land the member on a page showing a **different number from the one printed above the link**, which is the exact trap §05 exists to close. The wording therefore promises the full list, and that is what opens. A tool name the app does not recognise draws **the count alone** | It does **not** drop the count — the count is the whole defect, and it ships on every shortened list on both apps. It does not rule out the narrowing later: the wire already carries which list it was, so a page that learns to read its own filters can be upgraded one entry at a time in `rowListRoutes`. Nothing about §05’s other rules changes |
| **R9** | 2026-09-07, me — ‼️ **REVERSED THE SAME DAY on the owner’s call, and I was wrong to withhold it: the note IS BUILT.** The words are verbatim in the approved sheet; only a row in that sheet’s own words panel was missing, which is bookkeeping, not a missing sentence (audit U-37) | ~~**THE “COUNTED APART, NEVER ADDED” NOTE IN §06 WAS NOT BUILT.**~~ The sheet’s frame draws an amber note under the money pairs, but the sheet’s own words panel names exactly **one** new sentence (`Insights.Chart.AmountInCurrency`), and §0.20 requires every state to say where its words come from. That note’s words exist in no catalogue and on no server path, so building it would mean **inventing provider-facing copy** | Everything else in §06 shipped: the named pairs one per line, the dimmed bars while a new range loads, amber instead of red on a chart failure, and the phone tile opening on a foreign-only day. If the owner wants the note, it is one sentence ×5 ×2 apps and a row in the sheet’s words panel |

**How to read them together.** M1 is the page; M2 is what a source card does; M3 is the microphone inside the
ask box; M4 is every state the other three left out; M5 is every state a WORK answer adds; M6 is every state the
document-audience box adds; M7 is the frame all of them sit in. Where two disagree,
**the later sheet wins** and the row above records it.

**One sheet is still in the wrong place and only the owner can finish it.**
`clinqetmobilepartnerapp/mockups/voice-live-call/index.html` is **committed inside a repo**, which §0.20 forbids.
It has been copied to `C:\Nik\Data\mockups\voice-live-call\`; the tracked original was left untouched because
removing it is a git operation and the owner owns those (§21, §0.19). **Owner action: `git rm -r mockups` in
`clinqetmobilepartnerapp` when convenient.**

**What is still owed a sheet** (draw and get a yes before building):
- ~~**P3** — the Group B answer states~~ — **DRAWN AND APPROVED 2026-09-03 as M5** (row above).
- ~~**P4** — the "Team search" box's missing states~~ — **DRAWN AND APPROVED 2026-09-04 as M6** (row above).
  M1 §4 keeps the box itself; M6 adds every state, the phone frames, the row mark on both platforms, and
  removes M1's invented "Front desk" chip and its pickable Owner/Administrator chips (§15c S8).

---

## 1. What the owner asked for, and where each part lives in this plan

| Owner's requirement | Where |
|---|---|
| A search page in provider web + mobile | §8, §9 |
| Answers from the business's own knowledge + services, like the phone receptionist but text | §3, §4 |
| ‼️ "work on all my things like offer and my knowledge document and faq and everything" | **§4 — the complete coverage map** |
| Streaming answer, renders tables/HTML/PDF-derived content and extracted images | §5.2, §5.3 |
| Citations: document + page (+ a cost-friendly way to view), service breadcrumb | §5.4, §5.5 |
| Never another business's data | §10 |
| Team-oriented questions with the asker's role/permissions honoured | §4.3, §10.2 |
| Without impacting the phone assistant | §2.2 |
| Per-document "who on my team can find this" | §6 |
| ‼️ Analytics so we can improve it, web AND mobile, with anonymisation | **§7** |
| ‼️ Multi-dimensional audit after every phase | **§14** |
| ‼️ Voice input — speak in your own language, search + answer in it | **§18 (phase P1.5)** |
| ‼️ Clean up the old `ai/speech-to-text` endpoint | **§18.1 / §18.7 — consolidate, do NOT delete: mobile uses it** |
| Cost saving everywhere, quality non-negotiable | §11, §5.1, §18.2 |
| Reuse existing code | §2.1, §2.3, §5.3, §5.5 and throughout |

**Non-goals:** internet search; writing or editing data from Search (every tool is read-only).
(The dormant `/ai/chat` assistant is not a non-goal — it is **deleted** in P1, §2.3. ‼️ **Voice input is LOCKED
and in scope as phase P1.5, §18** — an earlier draft of this line called it "not in the original ask", which was
wrong: the owner's dictated ask included speaking the question. Voice **translation** remains a non-goal — the
provider's words are never translated for display, only the retrieval leg may query cross-language, §18.6.)

**Hard constraints:** no feature flags · no stubs · no hardcoded copy (5 languages × API + web + mobile) ·
mobile mirrors web's rendering rules · every `IMemoryCache` write sets a Size (a blanket `1` is NOT the rule —
`FullProviderContextService.cs:93-99` sizes by content) · tests live with the runtime consumer (§0.18) ·
integration tests on real engines for every isolation guarantee · §0.7 approval for the one new Cosmos field ·
owner commits and deploys.

---

## 2. Architecture

### 2.1 "Same engine, different door"

```
web / mobile ──POST /api/v1/business/search/ask (SSE)──▶ Clinqet.API
                                                        │ TenantContext: who, which business, which
                                                        │   permissions, at which scope
                                                        │ BusinessSearchAgent — streaming tool loop
                                                        │   (gpt-5.6-luna @ reasoning_effort:none)
                                                        │ tools = thin in-process adapters over the SAME
                                                        │   services the phone receptionist's MCP tools wrap
                                                        │ CitationRegistry — server-built, per answer
                                                        ▼
   Azure AI Search (knowledge + service indexes) · Cosmos (registry, work records) · SQL (membership)

   phone receptionist ──▶ Clinqet.Mcp  ← RUNTIME BEHAVIOUR UNCHANGED (see §2.2)
```

**Why the API host and not the MCP** (`findings/B` §2.8, §3.2): the MCP has no SQL, no member identity and no
permission concept — its token says only "business X, customer or partner". It cannot enforce a technician's
scope, and teaching it to would mean editing the shared voice gate. The API host already resolves
`TenantContext` on every request and owns `WorkListNarrowing` and `IResourceScopeEvaluator`. The search
services are plain library classes in `clinqetinfrastructure`; the Functions host already composes the catalog
half outside the MCP (`IProviderCatalogSearch`, `ICatalogAlarm`, `CatalogSearchDependencies`,
`IFullProviderContextService`), and `ProviderKnowledgeSearchService` is a 5-arg-ctor class with no host coupling.

### 2.2 The phone assistant's runtime behaviour is provably unchanged
‼️ Stated precisely, because "not one file" would be false: this project adds **no MCP tool, no allowlist
entry, no realtime config change and no change to any voice code path**. Its Customer-scope token is minted
only by the Functions host; `partnerOnly` tools are refused in that scope; its `allowed_tools` list is fixed in
`RealtimeSessionPayloadBuilder`. A caller still cannot ask "how many bookings do I have".
**The only `clinqetmcp` edits P1 makes** are the removal of the dead CHAT branch: the chat-session check in
`Tools/McpToolGuard.cs`, the `Mcp:ChatToolAllowlist` key in that repo's appsettings, and that repo's own
`ChatToolAllowlistConventionTests` (§0.15 — a repo's convention test is deleted from its own repo).
**The P1 audit must prove the Customer-scope voice tool surface is byte-identical before and after.**

### 2.3 ‼️ DELETE the dormant in-app chat assistant (owner-approved 2026-09-02)
The owner: *"no one will have it … delete this fully or repurpose this to business search."* **Decision:
delete the chat path; reuse only the parts that genuinely serve Business Search.** This also removes a live
security gap and makes the previously-proposed `ChatToolLoop` refactor unnecessary — Business Search writes its
own loop and the old one goes.

**Deleted (P1):** `POST /ai/chat` (`ProcessChatInput`) and the three `sessions` endpoints ·
`IMcpAIService`/`McpAIService` · `IMcpToolGateway`/`McpToolGateway` (its only consumer was `McpAIService`) ·
`Mcp:ChatToolAllowlist` + `ChatToolSessions` + the chat branch in the MCP's `McpToolGuard` + both repos'
`ChatToolAllowlistConventionTests`.
‼️ **What must NOT be deleted, though an earlier draft said so:**
(a) `AIAssistant:Mcp:Session:*` — `McpSessionService` reads eight keys from it and P1 KEEPS that service
(rename to `BusinessSearch:Session:*` only if you rewire the service in the same change);
(b) `ChatInteractionType` — it is a **persisted Cosmos property** on `AiSession` and a parameter on
`IMcpSessionService`; removing it would itself be a §0.7 change. Only the `InteractionTypePrompts` config and
the DTO members no surviving endpoint binds are removed;
(c) `AIAssistant:Mcp:MaxTokens` — deleting it orphans the dial `AiBudgetCutoffAlerts` maps for
`AiSubFlows.AssistantChat`, and a Functions test fails BOTH ways (a sub-flow with no dial, a dial with no
sub-flow). Remove the sub-flow id and its dial **together**, and rebuild + rerun the **Functions** suite.

**This closes the gap that any `ai.assistant.use` holder got whole-business Partner scope on the MCP,
including unmasked customer contact via `get_booking`** (§17 item 1 — it stops being a "report" and becomes a
fix).

**Kept and reused:** `IMcpSessionService` + `AiSession` become the Business Search session store · the SSE
writer pattern from `AIAssistantController` · `AICompletionService` and every dial/alert seam.
‼️ **M4 — `AiSession` has NEITHER a member field NOR an ETag**, and its `userNumber` actually holds the
**businessId** (`McpSessionService` writes `UserNumber = context.BusinessId`) — so nobody may reuse that field
for identity. **Decision: the member id and the concurrency token ride the existing `metadata` bag**
(`AiSession.metadata` is already a `Dictionary<string, object>`), so **no new Cosmos field is created and no
§0.7 approval is needed**. Member-scoped reads compare `metadata["membershipId"]`; the write does a
read-compare-write on `metadata["rev"]` and retries on mismatch. If a future phase wants first-class fields,
that is its own §0.7 request.
**Kept untouched (still live, do NOT delete):** `POST ai/speech-to-text` and `POST ai/enhance-text` (both used
by `FloatingAIButtons` / `SpeechToTextButton` on web and mobile) and the whole `provider-setup` document
pipeline. ‼️ Corrected: speech-to-text and enhance-text carry `ai.assistant.use`; **provider-setup carries
`ai.document_intelligence.use`**, so the "all three" claim was wrong. The conclusion still holds on the first
two — `ai.assistant.use` does not become orphaned — but verify it with `OrphanPermissionRegistryTests` rather
than by assertion.
‼️ Deletion is surgical and test-first: `McpService` keeps its provider-setup methods; only the chat/voice-chat
entry points go.

---

## 3. The model — LOCKED by measurement (`findings/K`)

**`gpt-5.6-luna` with `reasoning_effort: "none"`.**

| | luna @ none | mini @ low |
|---|---|---|
| Tool-planning accuracy (5 compound scenarios × 3) | **15/15** | 14/15 |
| Answer quality (real RAG task) | correct table, policy, package, citations | same |
| Cost per model **turn** (a full answer runs ~2 — see §11) | **$0.00025** | $0.00114 (**4.4×**) |
| Time to first token | 899 ms | 552 ms |
| MMLU-Pro (public) | **86.0 %** | 84.6 % |

‼️ `reasoning_effort: "none"` is **mandatory**, not a tuning choice: luna + tools with any explicit higher
effort returns HTTP 400 ("use /v1/responses or set reasoning_effort to 'none'"). Set it explicitly — omitting
it spends reasoning tokens and re-imposes luna's "temperature must be 1" lock.
`BusinessSearch:Answer:DeploymentName` stays a dial; mini @ low is the fallback if a quality gate ever fails.
Accepted risk (owner: "content filter is not a big issue"): luna's RAI filter is assigned but not enforced.

---

## 4. ‼️ THE COVERAGE MAP — what Search can answer, and what it deliberately does not

Every tool is **read-only**, declares the permission it needs, and is only offered to the model when
`tenant.Has(permission)` — then re-checks in its own code. A member who lacks the permission never sees the
tool, so there is nothing to leak; they get fixed localized copy instead.

### 4.0 ‼️ What Business Search does NOT answer — and why (so "complete" is honest)
The provider dashboard has six more surfaces. They are **deliberately out of scope for this project**, and the
map is not "complete" without saying so: **Call follow-ups** (the receptionist's own call summaries and
suggestions — the most natural next candidate, and the first thing to add if the owner wants it), **Billing**
and **AI billing** (money owed to Clinket, not business data — and its own permission family), **Activity feed**
(an audit log; answering from it invites "who deleted X" questions the feed is not shaped for),
**Notifications** (per-user, transient), and **Refund requests** (a payments workflow with its own gates).
None of them is blocked by the architecture — each would be one more tool with its existing permission key.
They are excluded to keep the phase count honest, not because they cannot be done.

### 4.1 Group A — the business's own material
‼️ **Not all of Group A is universal.** Knowledge, services and profile are open to every member; but
`catalog.offer.read` is **not** held by dispatcher, technician, finance or contractor, and `availability.read`
is **not** held by finance. Those members get the fixed refusal copy (§9b), not an error — and a finance user
asking "what are our hours?" is a refusal, not a bug. Do not grant the two keys to fix this without the
CatalogVersion/pin/sweep grant-change playbook.

| Tool | Answers | Source | Permission |
|---|---|---|---|
| `search_knowledge` | anything in uploaded documents **and typed FAQs** (both are cards in the same knowledge index — FAQs are `chunkKind = FaqPair`) | `IProviderKnowledgeSearch` + the audience allow-list (§6) | none (audience-filtered) |
| `search_services` | the service catalogue: what we sell, prices, durations, categories | `IProviderCatalogSearch.LookupAsync` | `catalog.service.read` (every role holds it) |
| `list_offers` | ‼️ **current discounts and promotional offers** | `IOfferRepository.GetActiveOffersAsync` + `IOfferValidationService` | `catalog.offer.read` |
| `get_business_profile` | ‼️ **C5 projection ONLY**: hours/weekly availability, service areas, addresses, branches, rating, currency, active-offer count. **No licence numbers, issuers or expiry** — the raw `ProviderContext` carries them and must never reach the model. Name the projection DTO in the prompt so the test has a shape to assert | `IFullProviderContextService.GetPartnerContextAsync` (cached 5 min) | none |
| `get_availability` | the weekly working hours, per branch | availability service | `availability.read` |

### 4.2 Group B — work records, member-scoped (this is the "team-oriented" half)

Each uses the **existing** narrowing the app's own pages use — `WorkListNarrowing.For(tenant, key)` →
`ARRAY_CONTAINS(c.assignedMembershipIds, @me)` pushed into the Cosmos WHERE **and** COUNT.

| Tool | Answers | Repository (narrowing overload already exists) | Permission |
|---|---|---|---|
| `list_bookings` / `count_bookings` | "my bookings this week", "bookings for Gaurav" | `BookingRepository.GetPaginatedBookingsAsync(..., narrowing)` | `booking.read` |
| `list_quotes` / `count_quotes` | "how many quotes went out last week" | `QuoteRepository.GetPaginatedQuotesAsync(..., narrowing)` | `quote.read` |
| `invoice_totals` | "how much did we invoice / receive last week" | `InvoiceRepository.GetPaidInvoicesInRangeAsync(..., narrowing)` + summary/overdue | `invoice.read` |
| `count_leads` | "how many leads last week" | `IBroadcastProviderService.GetInboxStatusCountsAsync` | `lead.read` (Business only — no narrower grant exists) |
| `list_customers` | "which customers do I look after" | `BookingRepository.GetAssignedCustomerIdsAsync(businessId, narrowing)` (derived, capped 500) | `customer.read` |
| `inbox_summary` | unanswered messages, my threads | `IProviderInboxService.GetViewAsync(businessId, tenant, …)` (evaluator per row) | `conversation.read` |
| `get_insights` | how the business is doing | `IInsightsReadService` / `IDashboardService` | `insights.read` |
| `list_team_members` | who is on my team (also resolves "Gaurav" → membershipId) | `IMemberLifecycleService.ListMembersAsync` | `team.read` |
| `list_reviews` | recent reviews and ratings | review service | `review.read` |

**Worked examples** (the owner's own questions):
- *"Show me all my bookings"* — admin ⇒ business-wide; technician ⇒ `Assigned` narrowing, their own only.
- *"Bookings for Gaurav"* — needs `booking.read` at Business **and** `team.read` to resolve the name; a
  technician holds neither at that scope ⇒ fixed refusal, no data fetched.
- *"How much money came in through invoices last week"* — owner/admin/finance ⇒ business total; technician ⇒
  `invoice.read` at `Assigned` ⇒ their own invoices only, and the answer says so; contractor/sales/dispatcher
  ⇒ no `invoice.read` ⇒ the tool is never offered ⇒ "You don't have access to payment and invoice information."
- *"What is our availability?"* — the business calendar (per-member calendars do not exist in the platform).

### 4.3 Two honest limits to state in the answer, not paper over
1. **"Quotes Gaurav *sent*" is not stored.** `Quote` has no `sentAt`/`sentBy`; `createdByMembershipId` exists
   but is indexed in no container. Search answers "quotes **assigned to** Gaurav" and says which it measured.
   Making "sent by" answerable is a §0.7 index change — **owner decision 11**.
2. **Leads are never member-scoped for reading** (`lead.read` is granted only at Business), so "leads I
   received" is a business-level number.

---

## 5. The answer pipeline

### 5.1 The agent
`BusinessSearchAgent.StreamAsync(TenantContext, question, session, language, ct)` in
`clinqetinfrastructure/Services/BusinessSearch/`. System prompt: answer only from tool results; cite with `[n]`;
never invent; say plainly when nothing is found; tables as markdown; prices/durations verbatim; never say
"index"/"passage"/"embedding". Loop `MaxToolIterations` 4, parallel read-only tool calls, cutoff alert on
`finish_reason == length`.

### 5.2 Streaming — ONE wire shape
`data: {json}` frames carrying an in-JSON `eventType` (`AIAssistantController.cs:1267-1273` is the precedent;
no `event:` line exists anywhere in the platform). Events: `meta` → `status` → `delta` → `citation` → `image` →
`done` / `error`. A `: ping` comment every 15 s while a tool runs so the mobile stall guard can be short.
Cancellation via `HttpContext.RequestAborted`; bounded channel + linked CTS (the existing pattern).

### 5.3 Rendering
Markdown (tables included), sanitized, no raw HTML — stored card text is already plain
`label: value | label: value`, so no HTML ever needs rendering. **Reuse `MaterialExcerptBuilder`**
(`clinqetinfrastructure/Services/Knowledge/MaterialExcerptBuilder.cs:26` — pure, no I/O, no AI):
`ParseRecordLine` re-tabulates flattened rows, `BuildFaq` lays out Q/A, `DropOverlap` removes the chunker's
15 % sentence overlap, `CompletionChain` rejoins a row split across pieces. The passage a provider reads is
then laid out exactly like the PDF a caller receives — one renderer, no drift.
Images: knowledge pictures the answer actually cited, thumbnail inline → full-size in the existing viewer.
‼️ **Visibility rule (C3)**: a picture is shown when **its document is visible to that member**. It must **NOT**
reuse `ListSendableImageRefsAsync` — that is the "may this be sent to a phone caller" gate, and reusing it
would let the receptionist's switch decide what the provider's own team can see.

### 5.4 Citations (server-built — the model can never fabricate one)
Per answer, a `CitationRegistry` maps `[n]` → the id that came back from **this request's** tool results.
- **Document card**: title (`docTitle ?? docName`), section, **page** — shown only for genuinely paginated
  sources (PDF · JPG/PNG/TIFF/BMP/HEIF · WEBP/GIF · PPTX → "Slide N"); Word/Excel/HTML/text show section only,
  because their stored page value is a placeholder `1`.
- **Service card**: name + breadcrumb from `Category.FullPath` (already stored, e.g.
  `"Appliance Services > Washing Machine"`) + `ParentCategoryId`, names via `ICategoryCacheService`
  (cache write already `Size = 1`). ‼️ Category names are not translated anywhere in the platform — the
  breadcrumb renders in the stored language in all five UI languages, exactly as the customer app does.
- **Offer / booking / invoice / lead cards** carry their own identifier and deep link.

### 5.5 Viewing the source — three levels, cheapest first
1. **The cited passage** — already on screen. Free.
2. ‼️ **"Show page 4"** — the whole page as text, a few KB. Every DI/vision-path document already has its pages
   cached as markdown at
   `_ocr/{businessId}/{documentKey}/{contentHash}/{deploymentName}/v{promptVersion}/p{NNN}.md`
   (`KnowledgeBlobPaths.OcrPageBlob`). **No PDF viewer, no file download, no egress.**
   ‼️ The key includes a **deployment-name segment** — build it only via `KnowledgeBlobPaths.OcrPageBlob`,
   never by hand, and bind `Voice:Knowledge:Vision:{TranscribeDeploymentName,TranscribePromptVersion}` in the
   API host (which also means extending `VoiceKnowledgeSettingsConventionTests.ReadByThisHost`).
   Fall back to (1) then (3) on a miss — a document over the page ceiling rasterizes zero pages and has no
   cache, and the lifecycle rule deletes cached pages after 180 days.
3. **"Open the original file"** — a short read-SAS, inline disposition, minted on click only.

---

## 6. Knowledge document audience for team search

### 6.1 §0.7 table — ONE new Cosmos field
| Column | Statement |
|---|---|
| **What** | `KnowledgeDocument.searchAudience` : enum `KnowledgeSearchAudience { Team, Roles }` + `searchAudienceRoleKeys : List<string>?` (`WhenWritingNull`). File rows only. |
| **Who reads it** | `IKnowledgeDocumentRepository.ListSearchVisibleDocIdsAsync(businessId, roleKeys, isOwnerOrAdmin)`, called by `search_knowledge` and by the page/view endpoints — in THIS project. |
| **Who writes it** | `PATCH knowledge/documents/{docId}/audience` (`voice.settings.manage`) → `SetSearchAudienceAsync`, a registry field merge under CAS, mirroring `SetShareWithCallersAsync`. |
| **Why not a column / table** | It is a one-to-one fact about the document; the entity already exists. |
| **Why not a constant/enum alone** | The MODE is an enum; the chosen role list varies per document. |
| **Why not already stored** | `shareWithCallers` is a different audience (callers); repurposing it would silence the receptionist. No ACL exists. |
| **Cost** | ~40 bytes/row. No IncludedPath (never queried by value). ‼️ The existing partition query projects `c.docId` only, so this is not free-by-reuse: **the projection widens by two fields — still ONE query, no extra round trip.** Zero index change. |
| **What breaks if omitted** | Part B of the owner's ask cannot exist; every member who can search sees every document. |

**No search-index change.** Enforcement is the fail-closed allow-list at query time, so a change takes effect
instantly with no re-processing.

### 6.2 The rule
```
visible(doc, member) =
      doc.Status != Deleting                      // ‼️ NOT "is Ready" — that would change voice behaviour
  &&  ( isOwnerOrAdmin                            // primary_owner + administrator always
     || doc.SearchAudience == Team                // default
     || doc.SearchAudienceRoleKeys ∩ tenant.RoleKeys ≠ ∅ )
```
‼️ **Three-state, never fail-open**: `ListSearchVisibleDocIdsAsync` returns `AllVisible` | `Restricted(ids)` |
`ReadFailed`. Only `AllVisible` may skip the filter; `ReadFailed` fails the retrieval closed. ("Nothing is
restricted" and "the read failed" must never be the same branch.) FAQs are always `Team` — callers hear them
anyway.

### 6.3 The UI (§0 M1, sheet §4)
Two clearly separated boxes in the existing document details editor, web and mobile: **"Phone receptionist"**
(the existing "Send details to callers" switch) and **"Team search"** (Everyone on my team / Only these roles +
role chips). Each box says in one line that it does not affect the other. A restricted row shows one quiet
navy pill; an unrestricted row shows nothing extra. No jargon.
**Default = "Everyone on my team"** (owner-confirmed reasoning: pre-production, no backfill concern — see §15).

---

## 7. ‼️ Analytics — required, web AND mobile, with anonymisation

The owner: *"store the text too for our analytics so we can improve on it … how can we anonymize certain
things … analytics we cant miss it and it need to be done for web and mobile both."*

| What | Decision |
|---|---|
| Question text | **Stored**, after anonymisation (below) |
| Anonymisation | Before the event leaves the client: (a) the existing PII scrub (emails, phones, long digit runs) runs first; (b) **money amounts** → `<amount>`; (c) **team-member names** → `<member>` — resolved against the business's own roster, which the client already holds, so no server round trip; (d) **customer names** from the answer's own citations → `<customer>`. The original text never leaves the device unredacted. |
| Also captured | question length, language, which tools ran, result counts per source type, whether an answer was produced, time to first token, total time, tokens + cost, follow-up depth, which citation was opened, helpful/not-helpful |
| Events | `SearchAction` (ask), `ResultClick` (citation opened), `AIAssistantAction` (helpful/not helpful), `ContentEngagement` (dwell) — all existing event types; surface `dashboard.search` on both platforms (mobile `screenMap` must carry it, and `analyticsWebParity` requires the same verbs) |
| Sampling | none for `SearchAction` — every question counts (it is the improvement signal) |
| Where | `clinqetwebpartnerapp` `analyticsTracker.js` + `clinqetmobilepartnerapp` `analyticsTracker.ts`, feeding the existing `/analytics/track` → Service Bus → Parquet pipeline |

‼️ Anonymisation is a **client-side redaction step with its own unit tests on both platforms** (same rules,
same fixtures), plus a server-side assertion that a stored question contains no e-mail/phone pattern.

---

## 8. Web UI (`clinqetwebpartnerapp`)
Route `/dashboard/search` (+ `FULL_HEIGHT_ROUTES`), rail surface key **`businessSearch`** with
`permission: null`. Header entry per **owner decision 2** (§0 M1, sheet §1 shows options A/B/C).
Registries that are build-failing if missed: `SURFACE_PERMISSIONS` (+ the controller/method/route literal the
API convention test verifies), `PAGE_FOR_SURFACE` and `SELF_GATED`, `Access.Surface.businessSearch` ×5,
`ANIM_KEYS` + `[data-anim]` + keyframes, the rail tail-order test, `Header.jsx` title case,
`inferSurfaceFromPath`, `PAGE_SEO`/`createMetadata`, AASA + mobile `linking.ts`/`types.ts` parity.
Components: `BusinessSearchPage`, `SearchAnswerMarkdown` (react-markdown + remark-gfm, no raw HTML, brand CSS,
citation + image marker components), `SourceCard`, page viewer, `DocumentPreviewModal` reuse.
Streaming client: fetch + `getReader` + `AbortController` + 20 s stall timer + 401 refresh + 403 →
`raiseAccessDenied` + 429; cancels on `contextEpoch` change.
‼️ **"Recent questions" storage must be keyed by businessId** and swept on workspace switch/sign-out — a member
of two businesses must never see business A's questions inside business B.

## 9. Mobile UI (`clinqetmobilepartnerapp`)
Screen `BusinessSearch`; five-file registration (`constant.tsx`, `types.ts`, `linking.ts` →
`dashboard/search`, `MyDashboard-Route.tsx`, `analyticsTracker.screenMap`) + entrances: dashboard header
magnifier + Profile row beside "AI Knowledge". ‼️ That row must **not** inherit the AI-package flag
(`payments.aiAssistantEnabled`) the neighbouring rows use — Business Search is not an AI add-on feature.
Streaming: generalise `streamSetupOnce` into `streamSse(endpoint, headers, body, {onEvent, stallMs, signal})`
with cancel + typed frames + the 401/403/429 contract, keeping the existing setup caller byte-compatible.
Rendering: `react-native-markdown-display` with theme tokens; custom rules for citation and image markers;
"Show page N" renders in the same markdown component; "Open the original file" → `Linking.openURL`.
Parity pinned by a jest source-scan test (same states, same keys, same page-only-for-paginated rule).

---

## 9b. ‼️ Limits, settings and what the provider is told

**No hardcoded numbers anywhere** (§0.12). Every limit is an appsettings dial with a mirrored class default:

| Dial | Value | Why this number |
|---|---|---|
| `BusinessSearch:Limits:QuestionsPerBusinessPerDay` | **200** | ~25 questions per working hour for a whole business — generous for real use, low enough that a runaway script or shared login is caught the same day |
| `BusinessSearch:Limits:QuestionsPerMemberPerDay` | **60** | a heavy individual user asks a handful an hour; 60 is well clear of that without allowing a loop |
| `BusinessSearch:Limits:QuestionsPerMinute` | **6** | burst guard; a human cannot type faster than this meaningfully |
| `BusinessSearch:Answer:MaxToolIterations` | **4** | covers a compound two-lookup question plus one retry; stops runaway loops |
| `BusinessSearch:Answer:MaxCompletionTokens` | **1500** | a complete answer with a table and citations; cut-off raises the central alert |
| `BusinessSearch:ToolResultMaxChars` / `SnippetMaxChars` / `MaxImagesPerAnswer` (4) / `DocumentViewSasMinutes` (10) / `FollowUpTurns` (6) | | payload, cost and exposure caps |

**The provider must always know what is happening.** Every state gets explicit, localized copy on **both**
apps — never a silent failure, never a spinner that ends in nothing:

| State | What the provider sees |
|---|---|
| Working | "Searching your documents…" / "Checking your bookings…" — the actual step, not a generic spinner |
| Daily/burst limit reached | "You've reached today's limit of {n} questions. It resets at midnight." — with the number from the dial, never hardcoded |
| No permission for part of the question | "You don't have access to payment and invoice information." — fixed copy, no data fetched |
| Nothing found | "I couldn't find anything about X in your documents or services." + what to try |
| Nothing assigned to you | "Nothing is assigned to you this week." — explicitly different from "the business has none" |
| Answer measured a narrower scope | The answer states it: "You have 3 bookings this week" |
| Partial answer (timeout) | "The search took too long — here is what was found so far." and the answer is kept |
| Error | "Something went wrong while searching. Your question was not lost." + Try again |
| Page/file unavailable | "This page can't be shown — open the original file instead." |
| Offline (mobile) | "You're offline. Ask again when you're connected." |
| AI temporarily unavailable | "Search is unavailable right now. Please try again in a few minutes." |

## 10. Isolation and authorization guardrails (each pinned by a test)

> ‼️ **The full design, the alternatives rejected, and every edge case live in
> `AUTHORIZATION-DESIGN.md`** — that document is the contract. The golden rule: **Search never returns anything
> the member could not already see by opening the matching page, and never less.** Highlights:
> the tool list is filtered per member AND every tool re-checks; parameters can never widen scope; narrowing is
> pushed into the WHERE and the COUNT; refusals never confirm that a person or record exists; everything fails
> closed. ‼️ **Solo providers** (most of them): all permissions at Business scope ⇒ **no predicate is added at
> all**, the team tools and the `memberName` parameter are dropped from the schemas, and the "Team search" box
> is hidden — there is nobody to restrict from.

1. `businessId` never leaves the server — taken from `TenantContext`; no tool schema has a businessId.
2. Knowledge retrieval keeps its four layers unchanged (scope-led filter, `AssertScoped`, vector PreFilter,
   per-row verify-and-throw) + the fail-closed retrievable/audience allow-list. An API-side `ICatalogAlarm`
   raises a High admin alert (mirroring `FunctionsCatalogIsolationAlarm`).
3. Catalog search keeps its isolation fortress; every point read passes `businessId`.
4. ‼️ **Corrected (C2)**: the `CitationRegistry` numbers an answer's sources and is a convenience for the
   client — it is **NOT** an authorization gate, because `pages/{page}` and `view-url` arrive as **separate HTTP
   requests** with no access to it. Those endpoints authorize themselves: point-read under
   `TenantContext.BusinessId` + the audience rule + `KnowledgeBlobPaths` prefix pinning. Within one answer, a
   `[n]` the model invents still resolves to nothing.
5. `GET documents/{docId}/pages/{page}` and `GET documents/{docId}/view-url` both: point-read the row under
   `TenantContext.BusinessId`, apply the §6.2 audience rule, and build the blob path only through
   `KnowledgeBlobPaths` (which pins the `{businessId}/` prefix).
6. ‼️ **Sessions are per MEMBER, not per business.** `AiSession` carries no member identity and its partition
   is the businessId, so a "tenant-only" session read would let any member replay another member's answer.
   Stamp the `MembershipId` and require it on read; pinned by an integration test.
7. ‼️ **Follow-ups re-authorize.** Only opaque handles are replayed, never citation content; on each new turn
   they are re-resolved through the same audience + permission checks. Roles change, documents get restricted.
8. Phase-2 tools: offered only when `tenant.Has(key)`, re-checked in code, narrowed by `WorkListNarrowing`,
   per-row `IResourceScopeEvaluator` where the app does it, `BillingOnly` refused, customer PII only with
   `customer.read` at a covering scope.
9. Integration tests on real engines: hostile docId/imageRef/page from another business ⇒ 404/absent; a foreign
   row injected into a search response ⇒ whole result discarded + alarm; member of business A cannot stream
   business B; a technician cannot read a restricted document or another member's session.

---

## 11. Cost model (per answer)
1 embedding + 2 search requests + 1–3 partition reads + ≤ 4 SAS mints (only if pictures are cited) + the model.
Model = $0.00025 **per turn**; a typical answer runs 2 turns (one tool round + the answer) and each turn
re-sends the prompt and the accumulated tool results, so budget **~$0.0005–0.0008 per answer** (S4), still ~4×
cheaper than mini. Prompt caching recovers part of the re-sent prefix. Page view = one small blob read.
Caps, all dials, all enforced server-side:
`MaxToolIterations` 4, `ToolResultMaxChars`, `RetrievalMaxTokens` 3000, `MaxImagesPerAnswer` 4.

‼️ **M6 — the limit MECHANISM, stated once and only once** (three earlier sections named three different ones):
- **Burst, 6/minute** → `AiRateLimitingService` under `AIAssistant:RateLimiting:BusinessSearch`. Its buckets are
  an in-process `ConcurrentDictionary` with a 5-minute reaper, so it can only do short windows — never a day.
  Requires the `GetEndpointConfig` switch case that **S5** already demands.
- **Daily, 200/business and 60/member** → a **durable** counter, because the in-process buckets do not survive a
  restart or span instances: `UsageMeter.BusinessSearch` (a new C# enum value — not a schema change) written
  through `IUsageCounter` with `periodKey = $"{yyyyMMdd}"` for the business cap and
  `periodKey = $"{yyyyMMdd}:{membershipId}"` for the member cap (the interface's own comment says the period key
  is caller-chosen, so this is legal), TTL to the end of the day.
- ‼️ **The "reuse the existing `RequestsPerDay` dial" suggestion is WITHDRAWN** — that dial lives on the
  `AiRateLimitingService` route, which cannot express a **per-member** cap at all.
- Every resulting key is listed once in §12 with its `deploy.ps1` entry.

---

## 12. Config & deployment
‼️ **Also required, and missing from the API host today (M8d)**: a `Voice:Catalog` block +
`Configure<VoiceCatalogSettings>` (both `ProviderCatalogSearchService` and `FullProviderContextService` take
`IOptions<VoiceCatalogSettings>`) and an explicit **service-index** `SearchClient` for
`CatalogSearchDependencies` — the API registers only a `KnowledgeSearchClient`. Plus `UsageMeter.BusinessSearch`
and the `BusinessSearch:Limits:*` keys from §11.
appsettings: `BusinessSearch:*` (Answer dials + caps), `AIAssistant:RateLimiting:BusinessSearch`,
`AiSubFlows.BusinessSearchAnswer = "I1-business-search-answer"`, the dial entry in
`AiBudgetCutoffAlerts.BudgetDialBySubFlow`, the pin in `AiModelPinConventionTests`, and the API's
`Voice:Knowledge` block gains the retrieval + `Vision` keys (with `VoiceKnowledgeSettingsConventionTests`
updated). ‼️ `deploy.ps1` gains `BusinessSearch__Answer__DeploymentName` — the house convention env-maps all 11
per-flow deployment names and §0.7.1 forbids a new key without it. No new Azure resource, queue or container.
Localization: 5 API + 5 web + 5 mobile files.

---

## 13. Tests
API suite owns the agent, tools, citations, audience and isolation (unit + Testcontainers integration).
Web jest: renderer sanitization, citation/page actions, streaming abort/stall, registries, redaction rules.
Mobile jest: `streamSse`, markdown rules, parity source-scan, screen-registration spine, redaction rules.
Every guard is sabotage-verified once — a guard that has never failed is not evidence.

---

## 14. ‼️ PHASES — each one ENDS with a full multi-dimensional audit

**The audit is not a phase of its own and is never deferred. A phase is not done until its audit has run, every
finding is fixed or explicitly refuted with evidence, and the result is written to
`findings/AUDIT-P{n}-<date>.md`.** Audit dimensions, every time: correctness & contracts · tenant isolation and
authorization · data safety & idempotency · cost & performance · memory/resource leaks & thread safety · config
hygiene (§0.12/§4) · localization ×15 files · web/mobile parity · tests (placement §0.18, fail-first evidence,
sabotage) · deployment & infrastructure · UI/UX against **every sheet in §0** · **did we miss anything the owner
asked for**.

**ONE PHASE = ONE SESSION.** Six phases (P1, **P1.5**, P2–P5), sized so each is achievable in a single session
including its audit.
Every session ends by producing THREE things: (1) the phase's code, green; (2) `findings/AUDIT-P{n}-<date>.md`
with every finding fixed or refuted; (3) `PHASE-{n+1}-PROMPT.md` — a self-contained, copy-pasteable prompt for
the next session — **and the same text pasted into the chat reply** (a file path alone is not delivery).

| Phase | Scope (one session) | Ends with |
|---|---|---|
| **P1 — Backend foundation** | ‼️ **delete the dormant /ai/chat assistant (§2.3)** · ‼️ **the `searchAudience` field + `PATCH …/audience` + the three-state allow-list — MOVED HERE FROM P4 by decision 6b** · `BusinessSearchController` + agent + SSE · **Group A tools** (knowledge + FAQs, services, offers, profile, availability) · `CitationRegistry` · page-view + view-url endpoints · all §10 isolation guardrails · API unit + Testcontainers integration tests. **No UI.** | **AUDIT-P1** + `PHASE-2-PROMPT.md` ‼️ **superseded — `PHASE-1-PART-2-PROMPT.md` runs next; P1's own prompt file is kept for P2** |
| ‼️ **P1.5 — Voice input + multi-script retrieval (§18)** | ‼️ **`scripts` on BOTH search indexes** (knowledge: replaces the dead `language`; services: additive) + the Unicode script detector · the per-business alphabet set + cache · ‼️ **dynamic per-request tool schema, one required rendering per alphabet**, server-verified · **parallel query legs, merged** · structured tools get **`relativeRange` computed server-side** + member-name→id resolution that **names who it used** · `SpeechService` → **Fast Transcription** (2.8× cheaper; today's mobile dictation gets cheaper too) · auto-detect from a **per-provider candidate list** · new `api/v1/speech/transcribe`, mobile's 4 call sites moved, `ai/speech-to-text` **deleted** · web gains the raw-dictation client it never had · mockup gate first. ‼️ Runs **after P1, before P2** — it changes a shared platform service mobile depends on and a **customer-facing index**. ‼️ **Five things must be MEASURED before shipping (§18.21).** | **AUDIT-P1.5** + a **"P1.5 DELTA" appended** to the existing `PHASE-2-PROMPT.md` (never overwritten) |
| **P2 — Both apps, Group A** | Web page + mobile screen **together** (the owner's standing rule: mobile ships with web in the same session) · both streaming clients · markdown renderers + citation/image markers · page viewer · **analytics + client-side redaction on both** · localization ×15 · web jest + mobile jest | **AUDIT-P2** + `PHASE-3-PROMPT.md` |
| **P3 — Team answers, end to end** ‼️ **DONE 2026-09-03** | **Group B tools** with permission gating + `WorkListNarrowing` + per-row evaluator + fixed refusal copy · member-name resolution · per-member sessions · follow-up re-authorization · the citation cards + refusal states in **both** apps · tests. ‼️ **Owner ruled ALL TWELVE tools, not the two `CARRIED-TO-P3` named.** `get_voice_usage` deliberately excluded (ai-billing family) | **BUILT + GREEN + AUDITED** — `findings/AUDIT-P3-2026-09-03.md`, `CARRIED-TO-P4.md`, `PHASE-4-PROMPT.md` |
| **P4 — Document audience UI** ‼️ **DONE 2026-09-04** | the "Team search" box in **both** document editors + the row pill + role chips rendered from the **real** catalogue roles (S8) + localization ×15 + tests. ‼️ The FIELD and its ENFORCEMENT ship in **P1** (decision 6b) — this phase is the provider-facing control for them. **Plus the four carried items the owner confirmed 2026-09-03: C1 the multi-script cache hazard (re-measured, 800 live calls), C2 the refund card's reason line, C3 the four M5 subtitles, C4 the refund amount's shape.** | **BUILT + GREEN + AUDITED** — `findings/AUDIT-P4-2026-09-04.md`, `findings/MEASUREMENTS-P4-2026-09-04.md`, `CARRIED-TO-P5.md`, `PHASE-5-PROMPT.md` |
| ‼️ **P4.5 — The close-out fix phase** ‼️ **DONE 2026-09-04** | ‼️ **Inserted 2026-09-04 by owner ruling:** *"nothing fucking move to phase 5 and phase 5 should be only end to end audit"*. P4's audit found defects in code no phase had touched, plus residuals, and parked them in `CARRIED-TO-P5.md` — which would have made P5 a build phase. **Shipped:** the duplicate-upload data loss (alone, first — RULING 3, the newest explicit choices win, and a merge that cannot commit now THROWS instead of purging) · **ONE money renderer**, the symbol from the CURRENCY and the grouping from the READER, measured **byte-identical to the apps' `Intl.NumberFormat` 30/30**, with money formatted **per recipient** exactly as dates already were · **item #10's ROOT fix** — the rule owns the parse, the entity carries the raw string, `KnowledgeSearchAudienceConverter.cs` **DELETED**, no new Cosmos field · the batch of eight · the four residuals · **both measurements** (C1 re-measured **75/75** against a 25/25 bar and SHIPS; **O9 measured at last** — index recall strictly wider, 0/160 misses vs Cosmos's 34 — and ‼️ **the dial was NOT flipped**, ruling 7). ‼️ **Owner ruled the committed Azure keys a SANDBOX and NOT an issue.** ‼️ **The close-out sweep found a SIXTH money defect after the first five were fixed and declared done** — `GetCurrencySymbolAsync` still resolved the BUSINESS ahead of the row's own currency, so a CAD invoice held by an Indian business printed **₹** on the invoice e-mail, the booking e-mail and the receipt. ‼️ **Live-confirmed on business `LXDP8G`** (India/Gujarat, invoice `INV2608010301` in CAD). Fixed at the PRECEDENCE — a row that states its currency is answered with no address lookup at all. | **BUILT + GREEN + AUDITED** — `findings/AUDIT-P4.5-2026-09-04.md`, `findings/MEASUREMENTS-P4.5-2026-09-04.md`, a rewritten `CARRIED-TO-P5.md` ‼️ **AND THE CLOSING SWEEP FOUND TWELVE MORE PROVIDER SCREENS** still taking the symbol from the READER (`style: "currency"` renders `CA$` in English, `$CA` in French, `US$` in Gujarati for one CAD amount) — seven on web, five on the phone, **two of them also dividing by 100 unconditionally**. ‼️ **NOT ONE had a test pinning its string**, so the close-out ships a SCANNING GUARD per app (`moneyFormattingConvention`, sabotage-proven, own-repo only) rather than twelve assertions. ‼️ **AND IT DID NOT CLOSE MONEY PLATFORM-WIDE.** An independent sweep at the close found the rule still unapplied on ~200 call sites across five repos (a SECOND live renderer on mobile, 21 QuestPDF sites, ~25 e-mail sites, 36 web sites). Three one-line live defects were fixed here — the booking e-mail's symbol came from the LANGUAGE FILE (`"$"` in all five), the quote push used `ToString("C")` (the REQUEST's culture), and the mobile twin had no parity guard anywhere. **The rest is an open DEBT in `CARRIED-TO-P5.md` §2.4b, owed its own short phase — P5 must not build it.** |
| ‼️ **P4.6 — Money, everywhere else** ‼️ **NOT STARTED — runs BEFORE P5** | Authority: `PHASE-4.6-PROMPT.md`. P4.5 made "one string on every surface" true for the notification path, Billing and twelve screens; an independent sweep then proved it still false on **~250 more call sites**. ‼️ **The biggest item is a SECOND LIVE RENDERER on provider mobile** (`src/Util/currency.tsx`, 162 call sites in 27 files, region-aware locale defaulting to India) — `bookingDetails.tsx` imports BOTH, so one screen shows one currency as two strings. Plus 44 web sites taking the symbol from the business, 51 backend sites pinning `:N2`/`F2`, Plan & Billing dividing by 100, and a cart e-mail printing the raw currency CODE in hardcoded English. ‼️ **§3.6 lists 30+ sites that MATCH THE SAME GREPS AND MUST NOT CHANGE** — OData filters, log lines, cache keys, an AI prompt. | **PROMPT WRITTEN, every path verified 2026-09-05** — `PHASE-4.6-PROMPT.md` |
| **P5 — Whole-programme audit + close-out** ‼️ **AUDIT ONLY — NOTHING IS BUILT HERE** | adversarial multi-dimensional audit across P1–P4.5 together (independent agents per dimension, then skeptics) · a walk-through of **every state of every sheet in §0** on both apps · **do the phases agree with each other** · **§1's owner-requirement table line by line** · SKILL ×4 + MEMORY updates · the owner's deploy/commit order checklist. ‼️ **If a fix lands in P5, P4.5 failed.** | **AUDIT-FINAL** |
| **P5 — DONE 2026-09-06 as audit only** (owner ruling mid-session: "create file with all the findings then we will fix later") | `findings/AUDIT-P5-2026-09-06.md` — 18 sections: the three priority lanes (sessions across questions §2, tool search §3, the AI prompt §4) with full fix designs, backend §5, web+mobile §6, tests §7, the cross-currency inbox §8, the programme §0.7 result §9 (two breaches by another session), PLAN §1 verdicts §10, phase agreement §11, sheet walk-throughs M1–M9 §12, live-data facts §13, 27 owner decisions §15, the P5B fix order §16, the P5B prompt §17. **No repository file was edited.** | **AUDIT-P5** |
| **P5B — FIX everything AUDIT-P5 found** (next session; prompt = AUDIT-P5 §17) | in the priority order sessions → tool search → prompt → backend → web+mobile → tests → docs; every ID ends FIXED / REFUTED / ACCEPTED; §15 questions asked before each batch; measurements A3/B7/B9/C1/C7 as numbers; SKILL ×4, memory, CARRIED rewritten from the code | **AUDIT-P5B** |

Each `PHASE-{n}-PROMPT.md` must carry, in this order: the exact files to read first (this plan,
`01-SESSION-STATE.md`, the relevant `findings/*`, `C:\Nik\CLAUDE.md` §0) · the owner's coding standards and
absolute rules · what is DONE, what is REFUTED (so it is not redone) · the measured traps · this phase's exact
scope · and the closing duties (audit, next prompt, tree clean, nothing pushed).

---

## 15. Decisions

### Locked
| # | Decision | Answer |
|---|---|---|
| 3 | Who may use Search | Every member with a business context; what they FIND is limited by permissions + document audience |
| 6 | The `searchAudience` field | **Approved in principle** (§6.1 table) — default **"Everyone on my team"**. The audit's objection was about silently widening access to documents that already exist; the owner confirmed this is pre-production with no backfill concern, so the objection does not apply. Restricting stays a per-document choice. |
| 7 | Phasing | **Everything ships in this project** — **P1–P5 per §14**. Nothing waits for go-live. |
| 8 | Model | **gpt-5.6-luna @ `reasoning_effort: none`** (§3), deployment stays a dial |
| 12b | Analytics | **Store the question text, anonymised client-side**; web AND mobile; no sampling on ask (§7) |
| — | Internal name | `BusinessSearch` / `api/v1/business/search` |
| — | Audit cadence | After **every** phase, mandatory (§14) |

### Locked 2026-09-02 (owner's second review) — NOTHING IS OPEN
| # | Decision | Answer |
|---|---|---|
| 1 | User-facing label | **"Ask Clinket"** |
| 2 | Header entry | **Option A** — button in the header right cluster opening a panel; the panel is an ENTRY POINT: Enter/arrow opens `/dashboard/search` with the answer already streaming (one answer surface, bookmarkable, Back works) |
| 4 | Follow-up questions | **Yes**, short memory, `FollowUpTurns` dial, re-authorized every turn |
| 5 | Limits | **200/business/day, 60/member/day, 6/minute** — all appsettings dials, all surfaced in the UI copy (§9b) |
| 6 | `searchAudience` field | ‼️ **APPROVED** (§6.1). Default **"Everyone on my team"**; hidden entirely on a solo business |
| 6b | ‼️ **Who may search documents** (locked 2026-09-02, after the sweep raised it) | **Open to EVERY member** — Business Search deliberately does NOT carry today's `voice.read` gate, which limits the Knowledge page to owner/admin/ops-manager/dispatcher. Six roles (sales rep, technician, catalog manager, finance, contractor, auditor) gain document search. **Because that is a deliberate widening, the `searchAudience` field and its enforcement MOVE FROM P4 INTO P1** so the restriction mechanism exists from the first line of code and there is never a window where every document is searchable with no way to limit it. The field's **UI** stays in the later phase. |
| 9 | Helpful / Not helpful | **Keep** |
| 10 | New UI dependencies | **Approved**: `react-markdown` + `remark-gfm` (web), `react-native-markdown-display` (mobile), `@react-native-clipboard/clipboard` |
| 11 | "Sent by" vs "assigned to" | **Answer "assigned to", and say so in the answer.** No new index. Applies to bookings, quotes and invoices alike, with the solo/unassigned handling in `AUTHORIZATION-DESIGN.md` §5 |
| 12 | The dormant `/ai/chat` assistant | ‼️ **DELETE IT** (§2.3) — the `ChatToolLoop` refactor is therefore dropped; Business Search writes its own loop |
| 13 | Rail position | **Right under Dashboard** |

### ‼️ Locked 2026-09-04 (the P4 close-out review) — these shape **P4.5**, and NOTHING here is open

> The owner's ruling that created P4.5: *"nothing fucking move to phase 5 and phase 5 should be only end to
> end audit"*. P4's audit found defects in code no phase had touched; parking them in `CARRIED-TO-P5.md`
> would have made P5 a build phase. **`PHASE-4.5-PROMPT.md` is the authority for the work; these are the
> decisions behind it.**

| # | Decision | Answer |
|---|---|---|
| **14** | ‼️ **The audience value's root fix** (the converter divergence + its lossy round trip) | ‼️ **APPROVED as the ROOT fix, explicitly NOT a patch** — the owner: *"we need to fix it from the root and not the workaround at all"*. **The rule owns the parse** (`KnowledgeSearchAudienceRule.Decide(rawAudience, …)` returning `(Visible, Recognised)`), **the entity holds the raw string** (`KnowledgeDocument.SearchAudience` becomes `string?`), and ‼️ **`KnowledgeSearchAudienceConverter.cs` IS DELETED**. Strict on the way IN (the DTO keeps its `[Required]` nullable enum), faithful on the way OUT (the returned DTO carries the *interpreted* value, so **no app change**). ‼️ **NOT a §0.7 schema change** — same JSON property, same stored values, **no new field, no migration**. ‼️ **The raw-value EXTRA FIELD was REJECTED** (it leaves both parsers in place and stores the fact twice), and **a sentinel enum member was REJECTED** (it makes the round-trip loss worse). Full spec: `PHASE-4.5-PROMPT.md` §3 |
| **15** | **Where the one money definition lives** | ‼️ **CHANGE THE SHARED FORMATTER** (`CurrencyMinorUnit.ToMajorString`), which P4 deliberately did not touch. The four disagreeing zero-decimal lists collapse to **one**; **never a fifth**. ‼️ **Consequence the owner ACCEPTED:** it formats money platform-wide, so **invoice PDFs, emails and every money-bearing page** change too — an Indian business's invoice will render `₹12,34,567.89`, which is correct for India. Every existing caller must be proven to still render correctly ‼️ **AND ONE AUTHORITY, not just one table (added 2026-09-04):** a ROW'S OWN CURRENCY decides its symbol; the business's address is consulted only for amounts that carry no currency. A second *authority* is the same defect as a second table. |
| **16** | **Indian number grouping** | ‼️ **IN SCOPE — fix it.** Was an accepted residual after P4; the owner put it back |
| **17** | **Duplicate-content upload — whose settings win?** | ‼️ **THE NEWEST EXPLICIT CHOICES WIN**, including `shareWithCallers` and the audience pair. The surviving document keeps its **id/identity** and its already-indexed cards (identical bytes ⇒ identical content). ‼️ **The provider is told either way** — the current silence is the defect |
| **18** | **`get_business_profile` vs `AUTHORIZATION-DESIGN` C5** | ‼️ **AMEND C5 to enumerate what ships. Do NOT trim the tool** — every field is the business's own data and already appears on its public Open Page; removing them would stop Ask Clinket answering basic questions about the provider's own business |
| **19** | **`MaxImagesPerDocument` 15 vs 40** | ‼️ **THE FINDING WAS WRONG AND IT WAS MINE.** They are **two different settings** — `AIAssistant:ProviderAttachmentProcessing:Images` (15, AI Quick Setup) and `Voice:Knowledge:Images` (40, knowledge ingest) — in two options classes, read by two features, each class default matching its own appsettings. **Not drift. Leave both alone.** Only the narrow `MaxTotalMediaBytes` declaration is owed (both hosts register `KnowledgeDocumentParser`; only Functions declares the key). Correction recorded in `findings/AUDIT-P4-2026-09-04.md` §9.8 |
| **20** | **The dead withheld-document counter** | ‼️ **SURFACE IT** as an operator-readable log line. Not deleted, and not left as `_ = excluded;` |
| **21** | **O9** — should `search_services` read the AI Search index instead of the Cosmos leg? | ‼️ **MEASURE AND REPORT ONLY.** Never run in P1.5, P3 or P4 — **run it in P4.5**, record latency, quality and cost, recommend. ‼️ **Do NOT flip `BusinessSearch:ServiceLookupSource`** — changing a data source is not a fix-phase change; the switch is the owner's |
| **22** | **C1's leftover** — `search_knowledge`'s `searchWords` description still varies with the question's alphabet, so the cached prefix still misses | ‼️ **ATTEMPT THE RE-WORDING, WITH A FULL RE-MEASURE, AND REVERT ON ANY DROP.** That exact field measured **3/25** before P1.5's fix and **25/25** after. No model-facing wording ships without a number |
| **23** | **The committed Azure keys in the Functions repo** | ‼️ **DROPPED — NOT AN ISSUE.** The owner states that is a **sandbox**. Do not raise it again, do not untrack the file, do not rotate anything |
| **24** | **The card date format** (`2026-09-04` vs "4 Sep") | **Raised and deliberately NOT put in scope.** Stays an accepted residual — `Local(...)` is InvariantCulture across all 17 tools, and four friendly dates would disagree with every other card on the same surface |
| **25** | **The three other P4 residuals** — the phone helper sentence, the 34 px phone row mark, T7's wording | ‼️ **ALL IN SCOPE.** The phone copy is fixed **in the locale files AND registered in sheet M6 §6**; **both** row marks reach 44 px (fixing one alone breaks the row's parity); T7's **wording is amended** — ‼️ **`AuthorizationVersion` is NOT built** (a new Cosmos field ⇒ §0.7, and nothing needs it) |
| **26** | **Flow 1 — sessions across questions** (P5 audit, 2026-09-06) | ‼️ **CONFIRMED by the owner 2026-09-06 — `findings/AUDIT-P5-2026-09-06.md` §1B Flow 1 is the locked design.** What the member saw is what is stored (whole answer, no cut; the STORE adds the "cut short" mark, also for an error after text started). The model is replayed the last 6 exchanges, each answer trimmed to `SessionTurnMaxChars` 4,000, old `[n]` source numbers removed, the mark kept — the two existing dials are the only levers, **no new dial, no Cosmos field**. Sources/tool results never stored or replayed. A failed answer costs nothing (business busy-minute check BEFORE the charge with its own sentence + retry time; refund after a post-charge failure). Exchanges stored in asked order; a Recent row reopens, never re-asks. The ETag carry is dropped (accepted residual, 1 RU/ask) |
| **27** | **Flow 2 — tool search** (P5 audit) | ‼️ **CONFIRMED 2026-09-06 — AUDIT-P5 §1B Flow 2.** ONE list helper for all 17 tools (total, shown, rows, sample note; sources only for rows the model read; catalogue page 25, phone keeps 5). "Could not be checked", never "nothing found" (lost catalogue leg → partial; roster failure → unavailable; breadcrumb best-effort; no profile → "not set up yet"). Every amount pre-formatted for the reader with the code beside it. Name never an e-mail; roles localized. Solo business: no team tool, no member parameter, not "not set up". One screen retrieval dial `BusinessSearch:Retrieval:TimeoutSeconds` (default 8 after a P50/P95 measurement), separate from the phone's 4 s. Cost items in the same batch: one scan per catalogue miss + one group count; customers = count + newest 10; one picture minted once per answer. Still owed rulings: reviews page rule (Q6), AE→AED (Q10), minimum-hours on the index (Q11) |
| **28** | **Flow 3 — the AI prompt** (P5 audit) | ‼️ **CONFIRMED 2026-09-06 — AUDIT-P5 §1B Flow 3.** The answer is in the language the question was asked in (Gujarati/Hindi script decides; Latin follows the app language); cards, statuses and money grouping stay in the app language. The two fixed sentences are plain copy ×5: no-access = "You don't have access to that." (the owner clause goes); busy business = its own sentence with a retry time. Two colleagues with one first name → the model asks which. Measured wording is NOT edited; the alphabet-block vs catalogue-rule contradiction is settled by one 24-question probe. In reserve if the gu/hi probe shows paraphrasing: render the refusal from a code path on the client (owner decides then) |
| **29** | **Prompt caching — EXTREMELY IMPORTANT** (P5 audit, owner 2026-09-06: "cost and performance is key") | ‼️ **CONFIRMED by the owner in chat 2026-09-06 ("this definitely needs the fix … in a way that never ever gets missed")** — `findings/AUDIT-P5-2026-09-06.md` §1C and the NEVER-MISS banner at its top; P5B is not accepted without the K-4 hit-rate numbers. Azure OpenAI serves the identical prompt BEGINNING from cache automatically (no token to send; the code already logs `cached_tokens`). Three misses to remove: **K-1** the tool list changes with the question's script (`BusinessSearchScriptPlan.Build` adds the asked script first) → the tool list depends only on the BUSINESS in one canonical order, the asked script told on the user turn, field descriptions byte-identical, re-measured 25/25 (decision 22's leftover, finally closed); **K-2** the PEOPLE roster is not deterministically ordered → sort it; **K-3** the answer-language line (decision 28) goes on the USER turn, never the system message. **K-4** P5B measures the hit rate (calls 2–4 inside an answer ≥ 80 % cached; a follow-up ≥ 60 %) before and after |
| **30** | **P5B second pass — the screen's refusals, and my own three defects** (2026-09-07) | `findings/AUDIT-P5B-LEDGER.md` §14 (the owner-required self-audit of P5B's OWN code) and §15 (the audit's §6 UI rows); the contract is the `clinqet-business-search` SKILL §21 (×4, verified identical). ‼️ **Three defects were introduced BY P5B and found by its own audit**: B-19's cost narrowing was applied to the SHARED Cosmos call rather than the index leg's fallback, so with no search index **the provider's own team could not see a single pending offering** and with an index the dedicated unapproved leg was flattened to approved-only — the population lost AND the overlap kept; D-15's empty allow-list defaults turned a wrong-but-permissive Functions config into a silent refusal, dropping **every extracted draft's picture**; and "fail the boot" was a **false claim** — `PostConfigure` runs on first options resolution, which is a controller, so a misconfiguration reached a provider as a 500 (now `ValidateOnStart` on both hosts). A latent captive dependency in the single-flight (a static map closing over a scoped instance) is now per-scope, and that single-flight had **no test at all**. ‼️ Only a FULL suite run caught the first one — the second time in this programme a filtered run hid a red test. ‼️ **Two of the audit's own premises were wrong and are corrected in §15.3, not built on**: U-39's customers list is not loaded on either app (a customer roster is unbounded and paginated — client-side customer redaction cannot be made correct that way, the scrub belongs on the server), and U-29's M5 draws ROLE pills, not suggestion chips, so no sheet specifies the chip order. Rows left to the owner are listed in §15.3 with the reason for each; every one that needs copy for a state **no sheet draws** is held by §0.7.1's MOCKUP GATE rather than guessed. `Data\mockups\REGISTER.md` now indexes all 26 sheets and says which have a programme register — **20 have none**; it is an index, not a record of approval |
| **31** | **P5B close — the three states nothing could describe, and one the codebase hid** (2026-09-07) | `findings/AUDIT-P5B-LEDGER.md` §18; the contract is the `clinqet-business-search` SKILL §22 (×4, verified identical). Sheet `business-search-refusal-states` §01 / §05 / §06 built on both apps. ‼️ **Switching away was painted as a FAILURE** — red, beside two buttons that both re-asked, spending one of the day’s questions to reach an answer already saved. It is now amber with a **free** reopen wearing the green, gated on four clauses that each earn their place (words arrived, no error frame, not the member’s own Stop, a session to reopen) and cleared at the start of **both** `ask` and `reopen`, because a flag raised during a reopen would turn the NEXT question into a notice it never earned. ‼️ **A defect of the codebase’s own, found only because a guard asserted the unhappy path**: an explicit `Error` frame followed by a transport break had its sentence AND its countdown overwritten with a bare “something went wrong”, so a member at the daily ceiling was told nothing about the ceiling — pre-existing, in no audit row, fixed in both apps. ‼️ **A shortened list said nothing**, so ten unpaid invoices read as “there are ten”: `shown`/`total`/`tool` now ride the terminal frame, set in the ONE place every shortenable tool funnels through, sent only when **exactly one** list was shortened (a caption cannot describe two), carried across by the controller because it swallows the agent’s Done frame, and deliberately **not persisted** — a stale count is worse than none. The link **names the page, not the narrowing** (ruling **R8**): eight of ten destinations cannot reproduce the answer’s filters, and a link that lands on a different number is the trap §05 exists to close. ‼️ **Money in 3+ currencies** now pairs every amount with its currency’s NAME, one per line, with the joining word **inside** the key because gu/hi put the postposition after the name; stale bars are dimmed while a new range loads; a chart failure is amber, not red; and the phone tile now opens on a day paid only in another currency. §06’s amber “counted apart” note was **not** built — its words exist nowhere and §0.20 forbids inventing them (ruling **R9**) |
| **32** | **§04 — asking out loud, the last third of a bundled row** (2026-09-07) | `findings/AUDIT-P5B-LEDGER.md` §21; contract `clinqet-business-search` SKILL §23 (×4, verified identical). ‼️ **Found by walking ALL SIX states of the approved sheet against the code** when the owner asked what was pending — five were built, §04 was not (0 of 4 keys in all ten catalogues, rendered nowhere). ‼️ **Audit row U-26 bundles THREE things** — §02, §03 and §04 — two shipped, the row read as done, and the third had no row of its own: **a row that bundles N things is N rows for the purposes of “is it finished”.** Built on both apps: the seconds LEFT before the recorder stops (never zero — at zero it has already stopped and a frozen “0” looks stuck — and plural-aware so it never says “1 seconds”); “listening again in ગુજરાતી”, the language in its OWN script, captured before the restart because `start()` clears it; a way to type instead, offered while listening AND while the words are being written down, where previously there was **no exit at all**; and “Not right?”, which ‼️ **never re-sends** — it re-opens listening and the words stay in the box. ‼️ **Nearing the cap was AMBER**, the colour of a refusal, so “you have nearly finished speaking” read as a limit being enforced — now blue, with the phone's orphaned `stripNearCap` deleted. ‼️ **The phone had no way to abandon a recording** (`stopRecording()` always transcribes), so a `cancelRecording()` was added that drops the file, leaving nothing for a retry to re-send. Both halves sabotaged, each failing exactly one test |
| **33** | **The answer's action row, and R8/R9 closed** (2026-09-07) | `findings/AUDIT-P5B-LEDGER.md` §22; contract `clinqet-business-search` SKILL §24 (×4, verified identical). ‼️ **TWO APPROVED SHEETS DISAGREE about Copy / Helpful / Not helpful**: **M7** (LIVE, and its whole subject is *the frame of the answer surface*) draws them as ~20px chips under a hairline rule with exact values; **M10** (a *layout proposal* about the transcript and limits) draws them borderless at `min-height: 44px`. **M7 wins** — a later sheet is not authoritative on a row another sheet specifies. A first pass had gone borderless off M10 and was reverted before it shipped. ‼️ **THE REAL DEFECT WAS THE 44px TOUCH MINIMUM ON THE VISIBLE CHIP**: both apps drew M7's 20px chip and then added the accessibility minimum to the chip itself, so a 20px row became 44px **on every answer** — the biggest waste of space on the page, invisible to every guard because they all asserted behaviour. The target moves off the PAINT and onto the HIT AREA (a transparent pseudo-element on web, `hitSlop` on the phone), the chips share ONE definition each side, and brand green still fills the chosen one without changing a dimension. ‼️ **R9 BUILT, and withholding it was WRONG**: I said the note's words “exist nowhere” — they are verbatim in the approved sheet; only a row in that sheet's own words panel was missing, which is bookkeeping, not a missing sentence. It earns its place because money in different currencies WAS added together on this very surface. ‼️ **R8 improved**: the link's label now NAMES its destination from the destination's own existing label, so no page name is written or translated twice — R8's substance (the link opens the page, not the narrowing) is unchanged |

---

## 15b. ‼️ SCHEMA + INDEX IMPACT — the complete list (answers "what changes in Cosmos and AI Search?")

| Store | Change | Why |
|---|---|---|
| **Azure AI Search — knowledge index** | **NONE** | `pageNumber`, `docId`, `chunkKind`, `imageRef` already exist and are retrievable; we only add them to the `select` list. The audience rule is applied as a filter built from Cosmos, not as an index field. |
| **Azure AI Search — service index** | **NONE** | The breadcrumb comes from `Category.FullPath` + `ParentCategoryId` in Cosmos, via the existing cached category service. |
| **Cosmos — new container** | **NONE** | |
| **Cosmos — new field** | **ONE**: `KnowledgeDocument.searchAudience` + `searchAudienceRoleKeys` (§6.1). No IncludedPath — never queried by value; the business's registry is already read in one partition query, whose projection simply widens by two fields. | The per-document team-search audience |
| **Cosmos — new index path** | **NONE** — verified: `assignedMembershipIds`, `assignedTeamIds` and `branchId` are already `IncludedPath`s on **Transactions** (bookings, quotes, invoices) and **Communications** (conversations), which are exactly the containers the team-scoped tools query with `WorkListNarrowing`. | |
| **SQL** | **NONE** | Membership, roles and permissions are read through the existing 60-second authorization snapshot. |
| ‼️ **P4.5's audience root fix (decision 14)** | **NONE — and this is deliberate** | `KnowledgeDocument.SearchAudience` changes **C# type** (`KnowledgeSearchAudience` → `string?`) so the row's own word survives a round trip. **Same JSON property name, same stored values, no new field, no IncludedPath, no migration, no backfill.** ‼️ The alternative — an extra `searchAudienceRaw` field — **was rejected**: it would store the fact twice and leave both parsers in place. §0.7 does not fire |
| ‼️ **P5B: AI Search — service index** | **ONE FIELD**: `minimumHours` (`Edm.Double`). **Owner-approved 2026-09-06.** Retrievable ONLY — not filterable, sortable, facetable or searchable — and **omitted from the uploaded document when the service has no minimum**, so a field almost no service sets costs nothing. Verified on a throwaway index against the live CA service and pinned by `ServiceIndexMinimumHoursFieldTests`. ‼️ The OWNER runs `cosmosindexsetup --search-only` in BOTH regions | The index leg built a price WITHOUT the minimum-hours rule while the Cosmos leg set it, so the same hourly service read "C$50.00 per hour" on an indexed stamp and "… (minimum 2 hours)" on an unindexed one |
| ‼️ **P5B: SQL** | **NONE by this phase.** The four `ProviderConnectedAccount` columns (`GatewayProductId`, `UnlinkedGatewayAccountId`, `OnboardingBlockedCode`, `OnboardingBlockedAt`) and the Cosmos field `VoiceCallSession.customerMemberId` predate it and are **owner-approved (2026-09-06)**. Migrations `20260831124946_AddPayoutOnboardingBlockedState` and `20260902061354_AddPayoutProductConfigurationId` are **applied in BOTH regions — 0 pending, verified 2026-09-06** | — |
| ‼️ **P5B: Cosmos — new field / container** | **NONE.** The feedback daily counter reuses the existing `AiUsageCounter` family in `SystemData` with a new id SEGMENT (`bsearchfbm_`), not a new document family. `ConversationTurn.Partial` is in-memory only; the stored `AiConversationTurn` is untouched | A durable ceiling on not-helpful reports without touching the schema |
| *(optional, owner decision 11)* | An IncludedPath on `createdByMembershipId` **only if** the owner wants "quotes **sent by** Gaurav" rather than "assigned to Gaurav". Separate §0.7 approval. | |

**Performance impact.** Each Group B tool runs the *same query the corresponding page already runs today*,
with the same narrowing predicate pushed into the WHERE and COUNT — so a search answer costs what opening that
page costs, not more. Group A adds one embedding + two Azure Search requests + one small partition read.
Nothing is added to the write path, the ingest pipeline, or the voice call path. The only new per-answer cost
is the model (~$0.0005–0.0008 per answer across its turns — S4) and, if pictures are cited, up to four read-SAS mints.

## 15c. ‼️ CORRECTIONS FROM THE ADVERSARIAL AUDIT (beyond authorization — those are in `AUTHORIZATION-DESIGN.md` §6b)

| # | Defect found | Correction (binding) |
|---|---|---|
| **S1** | ‼️ **Stored-XSS risk on "Open the original file".** `.html`/`.htm` are allowed knowledge uploads and the blob's `Content-Type` comes from the client's PUT. An inline-disposition SAS would execute attacker-controlled HTML on the storage origin. | Inline disposition is allowed **only** for `application/pdf` and images. Everything else — html, htm, svg, anything unrecognised — is served `Content-Disposition: attachment`, and the primary action stays "Show page N" (text). Pinned by a test per extension. |
| **S2** | **No existing seam mints an inline-disposition SAS.** `IAzureStorageService` has one read-SAS method and it sets no content disposition. | P1 adds an explicit overload that takes the disposition + content type, rather than pretending the seam exists. |
| **S3** | **`MaterialExcerptBuilder` reuse was overstated** — `ParseRecordLine`, `BuildFaq`, `DropOverlap`, `CompletionChain` are `private`/`internal`; only `Build(...)` is public. | Either call `Build(...)` and map its output, or deliberately widen the few members with a stated reason. Do not claim reuse that the access modifiers forbid. |
| **S4** | **Cost was understated ~3×.** §11 priced ONE model turn; the loop allows four, and each round re-sends the system prompt, the question and all accumulated tool results. | Honest figure: **~$0.0005–0.0008 per answer** on luna for a typical 2-round answer, still ~4× cheaper than mini. Prompt caching recovers part of the re-sent prefix. The dials (`MaxToolIterations` 4, `ToolResultMaxChars`, `RetrievalMaxTokens`) are what bound it. |
| **S5** | **The rate-limit config is not extensible as described** — `AiRateLimitingService.GetEndpointConfig` is a fixed switch, not a lookup. | P1 extends that method (a code change, not "appsettings only"), or Business Search uses the explicit-config overload the speech endpoint already uses. |
| **S6** | **Shared search capacity.** One Azure AI Search service per environment (basic SKU, 1 replica) hosts the knowledge, service and provider indexes — Business Search load competes with the customer marketplace search. | Measure query latency under load in P5; the retrieval caps and the per-minute dial are the throttle. Raising the SKU is an owner/infrastructure decision, flagged not assumed. |
| **S7** | **`get_insights` has more gates than its permission** — the controller also enforces the Payments/SmartAnalytics master switches and the entitlement. | The tool calls the same service behind the same three gates, and is simply absent when they are off. |
| **S8** | **Mockup role picker invents role names** ("Front desk" is not a catalogue role). | The picker renders the business's **actual** roles from the catalogue (10 system roles + any custom), by their localized `BusinessRole_{key}_Name`. |
| **S9** | **Mockup states missing** — including the "Show page N" panel, which is now the primary citation action. | P2 draws the missing states before building them: the page panel, no-documents-yet, offline, very long answer, restricted-document, mobile keyboard-open. |
| **S10** | **Web/mobile registry traps**: a second `permission: null` surface breaks two hard-coded ordered-array assertions; the `SURFACE_PERMISSIONS` entry shape and the API convention test's expectations conflict; mobile keeps a parity copy of the same map; the analytics parity guard fails on a web-only helper/action pair. | P2 updates all four together — they are build-failing guards, so they are discovered immediately, but the plan now names them so they are not a surprise. |
| **S11** | **Session concurrency**: `McpSessionService` mutates a cached instance and persists with a blind upsert — two in-flight follow-ups can lose a turn. | The Business Search session write is ETag/CAS-guarded and never mutates a shared cached instance. |

## 16. Risks
luna's content filter is not enforced (owner-accepted) · prompt injection through provider-uploaded documents is
unmitigated platform-wide today · SSE crosses origins to the API (no Next proxy) · read-SAS can expire
mid-session (client falls through its source chain; view-url is minted on click) · mobile backgrounding
suspends the XHR stream (needs a "continue" state) · markdown re-parse per token (debounce renders) ·
‼️ **another session is actively editing the vision/OCR files this design reads** (`KnowledgeBlobPaths.cs`,
`VisionDocumentTranscriptionService.cs`) — re-read both before building §5.5.

## 17. Pre-existing defects to REPORT (not silently adopted)
1. ~~The dormant chat's whole-business MCP scope~~ — ‼️ **FIXED IN P1 by deleting that path (§2.3)**, not merely reported.
2. ~~`/ai/chat` has no client~~ — deleted in P1.
3. Orphan settings: `McpServerSettings.Search*`, `Mcp:MaxContextTokens`; `AIServiceSettings` class-default drift.
4. Committed key material in MCP/API appsettings (§19).
5. `AiModels.cs:9-11` "gpt-5.6 cannot do tool calls" is false as written; `DefaultTemperatureOnlyDeployments`
   is over-broad — B1 search enrichment can regain `temperature: 0` determinism via `reasoning_effort: none`
   (`findings/J` §3).
6. `GET quotes` (unpaginated) narrows in memory after a full-partition read.
7. Messaging thread endpoints' scope enforcement NOT VERIFIED.
8. The knowledge `imageRef` select is unconditional while its comment claims a kill-switch gate.

---
## 18. ‼️ VOICE INPUT + MULTI-SCRIPT RETRIEVAL — PHASE **P1.5**

> Its own session, run **after P1 (done) and before P2**. Prompt: `PHASE-1-PART-2-PROMPT.md`.
> Everything in this section was **measured on the owner's own Azure** during planning (2026-09-02), not
> assumed. Where a claim is unmeasured it says so explicitly — see §18.21.
>
> ‼️ **Three claims in the first draft of this section were WRONG and are corrected here.** They are listed in
> §18.22 so nobody re-derives them: (1) the semantic ranker's per-query cost does not apply — it is OFF;
> (2) "the vector leg carries cross-language" is FALSE for Gujarati; (3) "the agent knows your document
> languages" was false — that field was never populated.

---

### 18.1 Why this is its own phase

It changes `SpeechService` — a **shared platform service the provider mobile app already depends on** — and it
changes **two Azure AI Search indexes**, one of which is customer-facing. That blast radius earns its own
multi-dimensional audit rather than a corner of the UI phase.

---

### 18.2 ‼️ CORRECTION — `ai/speech-to-text` is NOT dead code

The owner's initial premise ("no one might be using this like the chat endpoint") is **wrong**. Acting on it
ships a regression. Verified call sites in `clinqetmobilepartnerapp`:

| File | Line |
|---|---|
| `apiManager/constant.tsx` (`SpeechToTextAI`) | 132 |
| `hooks/useSpeechToText.ts` | 4 |
| `components/SpeechToTextButton.tsx` | 34 |
| `components/FloatingTextarea.tsx` | 262, 280 |

**Web does not call it.** `clinqetwebpartnerapp` posts its mic recording to `ai/enhance-text`
(`FloatingAIButtons.jsx:60-71` — `AudioFile` / `EnhancementType` / `SourceVoiceLanguage`), which transcribes
**and rewrites**. Web therefore has **no raw-dictation path at all** today.

⇒ **Consolidate, do not delete.** Move mobile's four call sites to the new route, then delete the old one.

---

### 18.3 The transcription engine — decided on live Azure retail prices

Pulled from the **Azure Retail Prices API** (`prices.azure.com`, `eastus2`). Cost assumes a **10-second spoken
question**, against the measured cost of the answer itself (luna @ `reasoning_effort: none` = **$0.00025/turn**,
`findings/K`).

| Engine | List price | Per 10 s | Languages | Indian languages | Verdict |
|---|---|---|---|---|---|
| Azure Speech `S1 Speech To Text` (real-time SDK) — **today** | $1.00/hr | $0.00278 | 130+ | 12 | works, **11× the answer cost** |
| ‼️ **Azure Speech `Fast Transcription`** | **$0.36/hr** | **$0.00100** | **130+** | **12** | ‼️ **CHOSEN** |
| `gpt-4o-mini-transcribe` | $0.003/1K audio-in tok | ~$0.00063 | ~100 | **no published Gujarati** | cheapest, breaks a supported language |
| `gpt-4o-transcribe` | $0.006/1K audio-in tok | ~$0.00125 | ~100 | no | costs more, covers less |
| **MAI-Transcribe-1** (Microsoft, new) | $0.36/hr | $0.00100 | **25 only** | Hindi likely, Gujarati almost certainly not | access-request only; **no billing meter exists yet** ⇒ not GA |
| Meta SeamlessM4T | — | — | ~100 | — | **not in the Foundry catalogue**; self-hosting needs GPUs |
| Azure Speech batch | $0.18/hr | $0.00050 | 130+ | 12 | **minutes of latency** ⇒ unusable interactively |

**The migration pays for itself twice.** Fast Transcription is **2.8× cheaper than the engine running today**,
so consolidating `ai/speech-to-text` onto it makes the **existing mobile dictation cheaper too**. Same Speech
resource, same key, **no new Azure resource**.

**Azure Speech supports 12 Indian languages** — Gujarati, Hindi, Punjabi, Marathi, Bengali, Tamil, Telugu,
Kannada, Malayalam, Urdu, Odia, Assamese — so "we will add languages later" is a config change, not a
re-evaluation. That is the deciding factor over MAI-Transcribe's 25.

**Microsoft's own guidance settles it.** `transcribe-overview` maps scenarios to products; for
**"Real-time text entry and document generation through voice dictation"** — exactly this feature — it says
OpenAI transcription models: **Not available**; Azure Speech models: **Recommended**. The OpenAI transcription
models are documented as transcribing English *or translating other languages into English*, the opposite of
the requirement here.

**Rejected — the cheapest option (§18.3a).** `gpt-4o-mini-transcribe` saves ~$0.0004/query ≈ **$0.08 per
business per day at the full cap**, by dropping Gujarati. OpenAI publishes no supported-language list for it;
independent measurement puts Hindi ~20.2% WER and **Gujarati ~28.4%**. A mic that silently mis-transcribes a
supported language is a **stub**. Not bought for 8 cents.

**Rejected — a hybrid (§18.3b).** `gu`→Azure, everything else→mini. Saves the same $0.0004 and costs two
engines, two failure modes, two retry policies, two test suites, and an accuracy discontinuity between
languages. It is also **a second live code path selected by config — a switch, which the owner has banned**
(*"dials stay, switches don't"*). **One engine.** A future labelled A/B is a design change and a re-measure,
never a flag.

---

### 18.4 ‼️ Language selection — auto-detect from a per-provider candidate list. NEVER a picker first, NEVER a global default set.

**The 4-language cap belongs to the old Speech SDK, not to Fast Transcription.** `AudioLanguage`'s own doc
comment records the old limit — *"auto-detection is used (limited to 4 languages: en, fr, es, hi)"* — and the
four wired in `SpeechService` are `en-US, fr-FR, es-ES, hi-IN`. **Gujarati is the one excluded**, in the market
most likely to speak it. Moving engines removes that constraint: **Fast Transcription documents no maximum on
the `locales` array.**

Its behaviour, from the docs:
- `locales: ["en-US"]` — that locale is used.
- `locales: ["en-US","gu-IN",…]` — **language identification across the candidates**.
- `locales: []` or omitted — the multilingual model, **whose candidate list excludes `gu-IN`** ⇒ **never do
  this**.
- *"Language identification might be more accurate with a more precise list of candidate locales"* ⇒ send a
  **tight** list, not all 130.

**The design:** the candidate list is built per provider from things already known — the member's app language,
the business's country, and the alphabets the business's own content uses (§18.11). Nobody is asked to pick
anything.

| Provider | Candidates sent |
|---|---|
| India | `gu-IN, hi-IN, en-IN` |
| Canada | `en-CA, fr-CA` |
| Spain | `es-ES, en-US` |

The picker exists **only as a correction**: the detected language is shown quietly beside the transcript, one
tap to change it. It is never a gate before speaking. `BusinessSearch:Voice:MaxCandidateLocales` caps the list.

---

### 18.5 Voice UX — speak-then-see (owner-confirmed)

Not live word-by-word. It is what both apps already do, Fast Transcription is built for it, and live streaming
would need a held-open connection for no user benefit on a 10-second question.

**Every state the mockup must show, web AND mobile, before any integrated UI code:** idle · listening (elapsed
time against the cap) · transcribing · transcript ready and **editable** · empty result ("didn't catch that") ·
mic permission denied (browser/OS) · engine error · audio too long · unsupported browser (web) · offline.

**The transcript is NEVER auto-sent.** A mis-heard trade term must be correctable before it spends a query
against the daily cap.

---

### 18.6 Endpoint consolidation — ONE transcription route for the whole platform

- **New route** `POST api/v1/speech/transcribe`. **Mobile's four call sites move to it. `ai/speech-to-text` is
  then DELETED.** No backward compatibility — pre-prod (owner-confirmed).
- **Permission stays `ai.assistant.use` at `PermissionScope.Business`** (owner-confirmed). Renaming a permission
  key forces a `CatalogVersion` bump + pin update + sweep and **logs every mobile user out** (memory:
  GRANT-CHANGE PLAYBOOK) for zero user benefit. The key still describes what it gates.
- `AIAssistantController` keeps `enhance-text` and the two `provider-setup/*` actions, so P1's `/ai/chat`
  deletion leaves **no orphan controller**.
- **Do NOT create a Business-Search-specific transcription endpoint.** Dictation is a platform capability.
- **Web gains a raw-dictation client** (new). `FloatingAIButtons.jsx` keeps its **separate** `ai/enhance-text`
  path — enhancement and dictation are different products and must never be merged.
- ‼️ **Dictation must never be routed through any rewriting step.** A search query comes back **verbatim**.
- The Speech **translation** path (`SpeechTranslationConfig`, `EnableTranslation`) is **out of scope**. If the
  audit finds it orphaned, **report it, do not delete it** (§17 discipline).
- Engine call via `IHttpClientFactory` — never `new HttpClient()`.
- Possible new appsettings key: Fast Transcription needs a resource **endpoint**; today's config
  (`AIAssistantSettings`) carries only `ApiKey` + `Region`. If it cannot be derived from `Region`, add
  `Speech:Endpoint` to **appsettings + ARM + `deploy.ps1` in the same change** (§25). Not a schema change.

---

### 18.7 Answer language (owner-confirmed)

**Answer in the language of the question. Never translate what the provider sees.**

1. **Transcript** — the spoken language, always. They must read it to check it.
2. **Answer** — the question's language, as an **explicit instruction**. The documented failure mode of
   multilingual RAG is the model answering in the **wrong** language when sources are in another language; this
   must not be left to chance.
3. **Verbatim islands — never translated:** prices, currency, dates, durations, **service names**, **category
   names**. The platform does not translate category names anywhere, so a Gujarati answer legitimately contains
   English service names, exactly as the customer app behaves.
4. **`responseLanguage`** — a **nullable** field on the ask payload, defaulting to the question's language.
   Ships now, unused now; makes "always answer me in English" a setting later rather than a rewrite.

**Measured (both models, English sources, non-English question):** Gujarati question → Gujarati answer; Hindi →
Devanagari; romanized "Facial nu price ketlu che?" → romanized reply; English control → English. Prices
preserved verbatim in every case. **luna handles this end to end.**

**The app's UI language is irrelevant to all of this** — everything keys off the language of the question text.
English UI + Hindi question behaves identically to Hindi UI + Hindi question.

---

### 18.8 ‼️ THE CENTRAL FINDING — the retrieval problem is cross-SCRIPT, not cross-language

Cosine similarity, `text-embedding-3-large` (3072-dim), the model the knowledge index actually uses:

| Question | EN prices | EN cancel | EN noise | GU prices | GU cancel |
|---|---|---|---|---|---|
| **EN** "what do facials cost" | **0.684** ✅ | 0.345 | 0.135 | 0.378 | — |
| **HI** "what do facials cost" | **0.520** ✅ | 0.246 | 0.074 | 0.403 | — |
| **GU** "what do facials cost" | 0.191 ❌ | 0.100 | 0.009 | **0.375** | — |
| **GU** "what if they cancel late" | 0.076 | 0.150 ❌ | 0.115 | **0.196** | — |

| English question vs | score |
|---|---|
| English chunk | 0.594 |
| **French chunk** | **0.477** ✅ |
| **Spanish chunk** | **0.487** ✅ |
| Gujarati chunk | **0.192** ❌ |

**Conclusions, all measured:**
1. **Latin-script languages need NOTHING.** English reaches French (0.477) and Spanish (0.487) fine. Never add
   a leg for them.
2. **Gujarati fails badly cross-script** (0.191 against the correct English document).
3. ‼️ **Row 4 is the reason this is not optional.** A Gujarati question about *cancellations* retrieved the
   Gujarati **price list** (0.196) over the English **cancellation policy** (0.150) — **right script, wrong
   topic**. That is a **wrong answer shipped to a provider**, not merely a weak one.
4. **Hindi is better than Gujarati but still fails**: a Hindi cancellation question picked a mixed *deposit*
   chunk (0.244) over the English *cancellation* chunk (0.139).
5. **Mixed-script chunks are the BEST case, not the worst.** A chunk mixing English + Hindi + Gujarati scored
   **0.744 / 0.518 / 0.293** from the three languages — the highest score in the entire matrix. **Mixed
   documents are an asset; they are reachable from every language inside them.**

**There is no semantic ranker to rescue a bad retrieval** — `Voice:Knowledge:SemanticRankerEnabled` is `false`
in all three hosts (API, Functions, MCP), so ordering is BM25 + vector only. See §18.20.

---

### 18.9 ‼️ THE RETRIEVAL RULE

> **A text search must cover the asked language PLUS every alphabet the business's own content actually uses.**

Not "add English for non-English questions" — that is wrong for a business whose documents are Gujarati.

| Business alphabets | Asked in | Renderings searched |
|---|---|---|
| Latin only | English | English (1) |
| Latin only | Gujarati | Gujarati + English (2) |
| Latin + Gujarati | English | English + Gujarati (2) |
| Latin + Gujarati | Gujarati | Gujarati + English (2) |
| **Latin + Gujarati + Devanagari** | **English** | **English + Gujarati + Hindi (3)** |
| Latin + Gujarati + Devanagari | Hindi | Hindi + English + Gujarati (3) |
| Latin only (English + French + Spanish docs) | English | English (1) — **one alphabet, one rendering** |

**English + French + Spanish is ONE alphabet.** The count follows alphabets, never language count.

---

### 18.10 ‼️ ONE SEARCH PER RENDERING, RUN IN PARALLEL — not one combined string

An earlier draft combined all renderings into one query string to halve the semantic-ranker fee.
**That fee does not exist — the ranker is off, and Azure AI Search Basic is flat-rate at $0.101/hour
(≈ $74/month) regardless of query volume.** With the only reason gone, combining is measurably worse:

| Strategy | EN doc | GU doc |
|---|---|---|
| Gujarati only | 0.191 ❌ | 0.403 |
| English only | 0.588 | 0.324 |
| **Combined into one string** | 0.410 | 0.423 |

Combining **dilutes each leg** (English 0.588 → 0.410) and dilutes further with three alphabets.

**Design:**
- One `SearchAsync` call **per rendering**, issued **concurrently** (`Task.WhenAll`) — same wall-clock as one.
- **Merge by chunk id, keep the MAX score**, then take the global top `RetrievalTopK`.
- `BusinessSearch:Retrieval:MaxQueryLegs` caps the fan-out (default 3).
- **A failed or timed-out leg must not fail the answer** — the surviving legs return, and the failure is logged
  and counted. Losing the Gujarati leg degrades recall; losing the whole answer is worse.
- Every leg carries the **same** business filter, audience allow-list and deadline. ‼️ **A leg that skips the
  tenant filter is a cross-business leak** — pin it with a test per leg, not once.

---

### 18.11 ‼️ THE `scripts` FIELD — what we store, where, and how it is computed

**Script = the writing system, not the language.** "Hello", "Bonjour" and "Hola" are all **Latin**. "નમસ્તે" is
**Gujarati**. "नमस्ते" is **Devanagari**. Script is what predicts retrieval reachability (§18.8), and unlike
language it can be determined **exactly**.

**Detection is a Unicode range count — no AI call, no cost, no probability:**

| Script | Unicode range | ISO 15924 |
|---|---|---|
| Latin | U+0041–024F | `Latn` |
| Devanagari (Hindi/Marathi) | U+0900–097F | `Deva` |
| **Gujarati** | **U+0A80–0AFF** | `Gujr` |
| **Gurmukhi (Punjabi)** | **U+0A00–0A7F** | `Guru` |
| Bengali | U+0980–09FF | `Beng` |
| Tamil | U+0B80–0BFF | `Taml` |
| Telugu | U+0C00–0C7F | `Telu` |
| Arabic (Urdu) | U+0600–06FF | `Arab` |

‼️ **Gurmukhi (U+0A00–0A7F) sits DIRECTLY BELOW Gujarati (U+0A80–0AFF).** An off-by-one range boundary silently
mislabels every Punjabi document as Gujarati. **Pin both boundaries with a test** using a real character from
each block.

**It is a LIST, not a single value** — a chunk mixing three scripts stores all three:

| Chunk | `scripts` |
|---|---|
| "Deposit policy / जमा राशि नीति / ડિપોઝિટ નીતિ…" | `["Latn","Deva","Gujr"]` |
| Pure Gujarati price list | `["Gujr"]` |
| English policy | `["Latn"]` |

A script joins the list only above `BusinessSearch:Scripts:MinSharePercent` (default 10) **and**
`MinCharacters` (default 12) of the chunk's **letters** — so one stray character does not add an alphabet.

**Where it is stored:**

| Index | Change | Rebuild? | Computed from |
|---|---|---|---|
| **Knowledge** (`KnowledgeSearchDocument`) | **DELETE the dead `language` field, ADD `scripts`** | **YES — delete + recreate** | the chunk's `content` |
| **Services** (`ServiceSearchDocument`) | **ADD `scripts` only** | **NO** | service **name + description** |

- `scripts` = `Collection(Edm.String)`, **`IsFilterable = true, IsFacetable = true`**. Facetable is what makes
  §18.12 one cheap call. Both indexes are built with `new FieldBuilder().Build(typeof(T))`
  (`KnowledgeSearchIndexInitializer.cs:110`), so the attributes go on the C# property.
- ‼️ **`KnowledgeSearchDocument.Language` is dead**: written `null` at
  `KnowledgeManagementService.cs:816` and **read by nothing** (verified). Deleting it is safe.
- ‼️ **Azure AI Search: adding a field needs no rebuild; DELETING or renaming one does.** That is why knowledge
  is recreated and services is only extended.
- ‼️ **`ServiceSearchDocument` is the CUSTOMER-FACING marketplace index** — `SearchController`,
  recommendations, facets, projections, `SearchSelectFieldsConventionTests`,
  `SearchOrderByIsSortableConventionTests` all depend on it. **Add only. Never rebuild it. Never reorder.**
- **NO BACKFILL** (owner-confirmed, pre-prod). Chunks and services acquire `scripts` as they are ingested.
- Per-**chunk**, never per-document — so a document whose page 1 is English and page 5 is Gujarati is labelled
  correctly page by page.

**Detection edge cases, all of which must have a test:**

| Case | Behaviour |
|---|---|
| 3+ scripts in one chunk | all stored, above threshold |
| 95% English with one Gujarati word | Gujarati excluded by threshold |
| Chunk of mostly numbers (`"$65 \| 45 min"`) | too few letters ⇒ default `["Latn"]` |
| **Romanized Gujarati** ("Facial nu price ketlu che") | `["Latn"]` — **correct, not a bug**: it is reachable by a Latin query |
| Punjabi vs Gujarati | distinct — the adjacent-range trap above |
| Emoji, punctuation, digits | ignored; not letters |
| Empty / whitespace-only chunk | `["Latn"]` |
| Mixed digits in Gujarati numerals (૬૫) | Gujarati digits are letters of that block ⇒ counted |

---

### 18.12 ‼️ The business's alphabet set — how the server knows, and what "cached" means

The AI is **never** asked which languages the business has. It cannot know, and guessing is what breaks.

**The server computes it:**
1. One faceted query per index — `$filter=businessId eq '<id>'`, `facet=scripts`, `$top=0` — returns the
   distinct scripts with counts. Two cheap calls, no documents fetched.
2. **Union** of the knowledge result and the services result = the business's alphabet set.
3. The result is **held in memory** so the next question does not repeat the lookup — that is all "cached"
   means here. `BusinessSearch:Scripts:CacheMinutes` (default 30).
4. ‼️ **Invalidated when a document or service is ingested, re-ingested or deleted**, so adding the first
   Gujarati document takes effect immediately rather than up to 30 minutes later.
5. ‼️ **`IMemoryCache` write MUST set `Size`** (CLAUDE.md §14 — a size-less `Set` is a runtime 500 on a
   `SizeLimit` cache; this broke production on 2026-07-10). Never the `(key, value, TimeSpan)` overload.
6. **Fail-open on retrieval, never on tenancy**: if the facet query fails, fall back to
   `[asked script, Latn]` and log. A missing alphabet costs recall; it must never widen a filter.

#### ‼️ 18.12a Performance — this lookup sits on a REALTIME path, so it must never be felt

The alphabet set is needed **before the first model call**, because the tool schema is part of that request.
So it cannot simply be "done concurrently with the turn" — an earlier draft of this section said that and was
wrong. It is on the critical path unless it is already warm.

| Requirement | |
|---|---|
| ‼️ **Warm on session open, not on ask** | Fire-and-forget when the Business Search page/screen opens or the session is created. By the time a question is submitted the entry is warm, so the ask path costs **zero** |
| **Cold miss** | the two facet queries (knowledge + services) run **in parallel with each other**, `$top=0`, no documents returned — tens of milliseconds, first turn only |
| **Hard budget** | `BusinessSearch:Scripts:LookupTimeoutMs` (default 250). ‼️ **On timeout, proceed with `[asked script, Latn]`** — an answer that is one leg short beats a slow answer. Log + count it |
| **Never serialize the two facets** | one `Task.WhenAll`, never awaited one after the other |
| **Never per-question** | keyed per business, not per member and not per session — every member of a business shares one entry |
| **Negative results cached too** | a business with no documents must not re-query every 30 minutes' worth of asks |
| **`Size` is mandatory** | a size-less `IMemoryCache.Set` is a runtime 500 (CLAUDE.md §14). Never the `(key, value, TimeSpan)` overload |
| **Thread safety** | concurrent asks from several members of the same business must produce **one** lookup, not N — single-flight it |
| **Measured in the audit** | added latency on a warm cache must be **0 ms** (assert no search call), and the cold path must be under the budget |

---

### 18.13 ‼️ THE TOOL SHAPE FOR N SCRIPTS — the owner's open design question, decided

**Decision: dynamic, explicitly-named, all-required scalar fields — built per request — plus deterministic
server-side verification of what comes back.**

The schema for the two text-search tools is generated **per request**, after §18.12 has produced the alphabet
set. For a business with Latin + Gujarati + Devanagari:

```
search_knowledge(
  queryInEnglish   : string   (required)
  queryInGujarati  : string   (required)
  queryInHindi     : string   (required)
)
```

For a Latin-only business it degenerates to a single required `queryInEnglish` — **no dilution, no waste, no
special case in the calling code.**

**Why named required scalars and not `queries: string[]`:**

| Shape | Measured |
|---|---|
| Prompt instruction + `queries` array | luna **19/20**, mini **18/20** — flaky |
| **Named required scalar fields** | **luna 25/25, mini 25/25** |

An array's items are unlabelled: the model can return three strings in the wrong languages, or duplicates, and
nothing detects it. A named required field cannot be omitted and says what it is. Flaky retrieval is a defect
that appears once in twenty and looks to the provider like *"it can't find my document."*

**Field naming** maps script → its representative language word, because that is what the model understands:
`Latn`→`queryInEnglish`, `Gujr`→`queryInGujarati`, `Deva`→`queryInHindi`, `Guru`→`queryInPunjabi`. A Latin-script
business whose documents are French still gets `queryInEnglish` — measured to reach French at 0.477.

**Belt AND braces (owner-mandated) — three layers, in this order:**
1. **Schema** — every field `required`, `additionalProperties: false`. This is what actually enforces it.
2. **Instruction** — in the tool description *and* the system prompt: render the same question in each field,
   never translate the meaning, never answer from a rendering. Costs nothing; protects against future model
   behaviour changes.
3. ‼️ **Server-side verification — the real guarantee.** Every returned string is run through the **same script
   detector** (§18.11). If `queryInGujarati` contains no Gujarati characters, the model did not comply. Then:
   one bounded retry with a corrective message; if it still fails, **run the legs that ARE valid and log a
   counter** — never silently search with a wrong-script string, never fail the whole answer.

**This is deterministic, so model compliance is never trusted.** The same Unicode check secures both ends.

**Structured tools get none of this** (owner's correction, §18.15). Only `search_knowledge` and
`search_services` match words.

---

### 18.14 ‼️ Performance — the provider is waiting

| Rule | |
|---|---|
| Alphabet lookup | ‼️ **warmed on session open** (§18.12a) so the ask path costs 0 ms. It is needed *before* the first model call — it cannot be hidden behind the turn. Cold miss: two parallel facets under a 250 ms budget, then proceed one leg short rather than wait |
| Query legs | **`Task.WhenAll`, always parallel** — N legs cost ~1 leg of wall-clock |
| Leg count | capped by `MaxQueryLegs` (default 3) |
| Per-leg timeout | its own, inside the shared answer deadline; a slow leg cannot hold the answer |
| Partial failure | surviving legs answer; failure logged + counted, never surfaced as an error |
| Latin-only business | **exactly one leg — identical to today, zero added latency** |
| Transcription | one-shot, sub-second class; `: ping` keeps the mobile stall guard short |
| Merge | by chunk id, max score — O(n), no re-ranking round trip |

**The common case (English question, English documents) must be byte-for-byte as fast as P1 is today.**
Pin that with a test asserting exactly one `SearchAsync` call.

---

### 18.15 Structured tools — dates and names (owner-confirmed)

`list_offers`, `get_business_profile`, `get_availability` and the P3 booking/quote/invoice tools **never
text-search**. No renderings, no translation, no script anything.

**Dates — the model never computes them.** A probe asked "कल" (yesterday) with today = 2026-09-02 and one run
of five returned **2026-09-03 — tomorrow**.
- `relativeRange` **enum** (`today`, `yesterday`, `this_week`, `last_week`, `this_month`, `last_month`, …) —
  **the server computes the range**, in the business's time zone.
- Optional explicit `fromDate`/`toDate` for absolute asks ("between 3 and 9 March").
- **Exactly one of the two.** Both ⇒ refuse. Neither ⇒ refuse. Both paths tested.
- Plus a firm instruction (owner: enum **and** instruction).

**Names — resolved to IDs against the real member list, never text-searched.** Measured, both models:

| Spoken | Resolved | |
|---|---|---|
| कल **गौरव** की बुकिंग | `m-101` Gaurav Shah | **5/5** |
| ગઈકાલે **ગૌરવ**ની બુકિંગ | `m-101` | **5/5** |
| कल **गौरी** की बुकिंग (near-collision) | `m-104` Gauri Desai | **5/5** |
| Kal **Gaurav** ni booking | `m-101` | **5/5** |

‼️ **The measured weak spot: a person NOT on the team.** The model sometimes picks the nearest real member
instead of returning empty. Two mitigations, **both required**:
1. **The server validates the returned id** against the caller's real member list and the asker's permissions —
   a model-supplied id is never trusted (already required for authorization).
2. ‼️ **The answer states who it used** — *"3 bookings assigned to **Gaurav Shah** on 1 Sep 2026…"* — so a wrong
   resolution is visible instead of a confidently wrong number. Same principle as decision 11 ("say which it
   measured").

---

### 18.16 Settings — all dials, class defaults mirroring appsettings exactly

```
BusinessSearch:Voice:{ MaxRecordingSeconds, MaxAudioBytes, AllowedLocales,
                       MaxCandidateLocales, RequestTimeoutSeconds, MaxRetryAttempts }
BusinessSearch:Scripts:{ MinSharePercent (10), MinCharacters (12), CacheMinutes (30) }
BusinessSearch:Retrieval:{ MaxQueryLegs (3), PerLegTimeoutSeconds }
```

- Class defaults must equal the `appsettings.json` defaults (memory: `feedback_appsettings_class_defaults`).
- **Voice asks consume the SAME quota as typed asks** (§9b) — a mic must not be a way around the cap.
- Any new `local.settings.json` key ⇒ ARM + `deploy.ps1` in the same change (§25).

---

### 18.17 Analytics — no schema change

`inputMode` (`typed` | `voice`) goes **inside the existing free-form `Metadata` field** of the user-interactions
Parquet schema (`ParquetStorageService.cs:900`, populated from `message.Data?.Metadata` at :1046).
**No new Parquet column ⇒ no §0.7 gate** (owner-confirmed). Also captured in `Metadata`: the detected locale,
whether the transcript was edited before sending, and the number of query legs run.

Trade-off, stated honestly: a real column is easier to query than JSON in a blob. The blob is free and this is
a diagnostic, not a daily grouping key.

---

### 18.18 ‼️ §0.7 — the two index changes needing explicit owner approval

| # | Index | Change | Reads | Writes | Cost | If omitted |
|---|---|---|---|---|---|---|
| 1 | **Knowledge** | delete dead `language`; add `scripts` `Collection(Edm.String)` filterable+facetable | §18.12 facet; §18.13 leg selection | the ingestion path, per chunk | **index delete + recreate ⇒ re-chunk and re-embed every document** (embedding API calls ∝ volume); pre-prod, no backfill | English questions never reach non-Latin documents (measured 0.192) |
| 2 | **Services** | **add** `scripts`, same type/attributes | same | service create/update | **none — additive, no rebuild, no customer-search impact** | a business with no documents but Gujarati service names is invisible to the alphabet set |

**Owner position recorded 2026-09-02:** approved in conversation — add to both indexes first, run in **both
regions**, then remove the `language` field in code; no backfill; the knowledge index may be recreated.

---

### 18.19 Rollout order (owner-specified)

1. **Add `scripts` to both indexes** and run `cosmosindexsetup` **in both regions** — additive, safe, nothing
   breaks. ‼️ `cosmosindexsetup` **ignores the shell's `CLINKET_REGION`** ⇒ **always `--launch-profile`**
   (memory: `admin-alerts-loginattempts-paging-2026-07-24`).
2. **Ship the population code** (ingestion writes `scripts`; services write it on create/update).
3. **Ship the retrieval code** (alphabet set, dynamic tool schema, parallel legs).
4. **Ship voice** (engine migration, new route, both UIs).
5. ‼️ **THE PHASE MUST REMOVE THE `language` PROPERTY FROM `KnowledgeSearchDocument` IN CODE. THIS IS
   MANDATORY AND IS NOT OPTIONAL.** The owner does **no** code changes — if P1.5 does not delete the property,
   it never gets deleted. Remove the property, remove the `Language = null` write at
   `KnowledgeManagementService.cs:816`, and remove anything else that referenced it. Leaving it is a **failed
   phase** (and a §22.2 dead-code violation).
   The column remains in the *live* index after this, unwritten and harmless — an Azure AI Search index may
   carry fields the client does not populate. That is expected and is not a defect.

#### ‼️ 18.19a Who does what — no ambiguity

| Step | **P1.5 (the build session)** | **The owner** |
|---|---|---|
| Add `scripts` to both index definitions | ✅ writes the code | runs `cosmosindexsetup` in both regions |
| Populate + retrieval + voice + tests | ✅ all of it | — |
| ‼️ **Delete the `language` property from the code** | ‼️ **YES — MANDATORY** | ❌ never touches code |
| Delete + recreate the **knowledge** index | ❌ **NOT the phase's job** | ✅ **the owner runs this later, whenever they choose** |
| Delete the **services** index | ‼️ **NEVER** | ‼️ **NEVER** |

‼️ **THE SERVICES INDEX IS NEVER DELETED BY ANYONE.** `ServiceSearchDocument` backs the **customer-facing
marketplace search** — `SearchController`, recommendations, facets, projections. It is only ever **extended**,
which needs no rebuild. Deleting it takes customer search down. (The owner said "delete both indexes" in
conversation on 2026-09-02 and it was corrected in that same conversation to **knowledge only**.)

‼️ **P1.5 is complete and shippable WITHOUT the knowledge index ever being recreated.** The recreate is a
housekeeping step the owner performs on their own schedule; nothing in this phase waits on it, and no test
depends on it.

**Testing note (the owner asked which index the work is verified against):** this planning session used the
**embeddings API directly**, never the live index. The build session's tests use the existing search mocks
(`MockAzureSearchQuery`, `MockSearchIndexService`) plus a live re-measurement of §18.8's numbers. **Recreating
the knowledge index therefore costs no test coverage** — but doing it last preserves manual verification.

---

### 18.20 Semantic ranker — leave it OFF, and know why

`Voice:Knowledge:SemanticRankerEnabled` is `false` in **all three** hosts. Consequences:
- **No per-query search cost.** Basic tier is flat-rate; running 3 legs costs the same as 1. (If it were ever
  enabled: **$1.00 per 1,000 queries**, first 1,000/month free.)
- **No multilingual L2 reranker** to fix a bad candidate set — which is exactly why §18.9 matters.
- ‼️ **It cannot simply be switched on.** `ProviderKnowledgeSearchService.cs:729` records that **Azure semantic
  ranking rejects wildcard queries outright**, so enabling it disables the code-wildcard behaviour measured to
  fix part-number lookups ("TL1255C"). The two are mutually exclusive.
- ‼️ The setting lives under **`Voice:Knowledge:`** — **shared with the phone receptionist**. It is not a
  Business Search dial; changing it changes how callers are answered.
- ‼️ `BuildSearchText` appends ` OR token*` for code-like tokens up to `CodeWildcardMaxTerms`. **Each leg is now
  its own search string**, so the cap applies per leg — verify that is the intent rather than leaving it
  accidental.

---

### 18.21 ‼️ What is measured, and what is NOT

**Measured on the owner's Azure, 2026-09-02** — retrieval scores (§18.8); combined-vs-separate (§18.10);
answer-language behaviour (§18.7); named-required-fields 25/25 vs array 19/20 (§18.13); name resolution 5/5
(§18.15); the date defect (§18.15); live Azure retail prices (§18.3).

**NOT measured — must be measured in P1.5 before shipping:**
1. **The three-field tool shape.** 25/25 was on **two** fields. Same mechanism, unproven at N=3.
2. **Parallel-merge on the live index.** All scores are raw embedding cosines; the live path adds BM25, the
   `KnowledgeRelevance` scoring profile, synonym maps and the audience filter.
3. **Fast Transcription's real latency and accuracy on `gu-IN`/`hi-IN`** with actual provider speech.
4. **Whether 3 legs dilute or improve top-K** versus 2 on real documents.
5. Corpus size: one document pair per language, not a benchmark. Direction is unambiguous (0.19 vs 0.68);
   exact numbers are not.

**The owner's standard: no degradation, in any language, in any scenario.** Every item above is a gate, not a
footnote — a P1.5 that ships without measuring them has failed.

---

### 18.22 ‼️ Corrections to the first draft of this section — do not re-derive them

| # | Wrong claim | Truth |
|---|---|---|
| 1 | "The semantic ranker costs $1/1,000, so combine the legs into one string" | The ranker is **OFF** in all three hosts. Search is **flat-rate**. Combining has no cost benefit and **measurably dilutes** each leg (0.588 → 0.410) ⇒ **parallel legs** |
| 2 | "The vector leg carries a Gujarati question to English documents" | **False for Gujarati** (0.191). True for Hindi (0.520). True for French/Spanish (0.477/0.487) — those need nothing |
| 3 | "The agent already knows which languages your documents are in" | **False.** `KnowledgeSearchDocument.Language` was written `null` and read by nobody. The `scripts` field is what makes it true |
| 4 | "Voice was not in the original ask" | **It was.** The owner's dictated ask included speaking the question |
| 5 | "`ai/speech-to-text` is unused like `/ai/chat`" | **Mobile calls it in four places** |
| 6 | "Auto-detect is capped at 4 languages, so the provider must pick" | That cap is the **old SDK's**. Fast Transcription documents no maximum ⇒ **auto-detect from a per-provider candidate list** |
| 7 | "Only non-English questions need a second rendering" | The rule is **asked language + every alphabet the business uses**. A Latin-only business asking in English needs one; a three-alphabet business asking in English needs three |

---

### 18.23 Tests owed (§0.18 — placement follows the runtime consumer)

`SpeechService` and the retrieval path run in the **API host** ⇒ `Clinqet.API.UnitTests` /
`.IntegrationTests`. Never the MCP or Functions suites.

**Script detection:** each script's boundary characters · ‼️ **Gurmukhi vs Gujarati adjacent ranges** · 3-script
chunk · stray-character threshold · numbers-only chunk · romanized Indic ⇒ `Latn` · empty chunk · Gujarati
numerals.

**Alphabet set:** facet union across both indexes · cache hit/miss · **invalidation on ingest and delete** ·
`IMemoryCache` **Size set** · facet failure ⇒ fallback, never a widened filter.

**Tool schema:** 1/2/3-alphabet businesses produce 1/2/3 required fields · a Latin-only business issues
**exactly one** `SearchAsync` · every field required · wrong-script value ⇒ retry ⇒ partial-leg fallback +
counter · structured tools carry **no** rendering fields.

**Retrieval:** legs run in parallel · merge keeps max score · one leg failing still answers · ‼️ **every leg
carries the tenant filter and the audience allow-list** (one test per leg — a leg without it is a cross-business
leak) · `MaxQueryLegs` respected.

**Voice:** locale always sent, never empty · `gu` end to end · unsupported locale refused, not defaulted ·
oversized/over-long audio refused with **localized** copy · timeout + retry honour the dials · transcript
returned **unrewritten** · **the mic never auto-sends** (web + mobile jest) · a voice ask consumes exactly one
unit of the same quota as a typed ask.

**Structured:** `relativeRange` computed server-side in the business time zone · both range + explicit dates ⇒
refuse · neither ⇒ refuse · unknown person ⇒ server rejects the id · the answer names the resolved member.

**Regression:** existing mobile dictation still works after the engine migration · the phone receptionist's
knowledge path is unchanged.

RED first, then green, then **sabotage** — a guard that has never failed is not evidence.
