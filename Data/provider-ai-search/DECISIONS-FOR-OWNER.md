# Business Search — decisions (LOCKED) and what is still open

> ‼️ **`PLAN.md` §15 wins on any disagreement with this page.** This sheet is the plain-language mirror of it.
> Rewritten 2026-09-02 after the pre-build sweep found this page recommending the opposite of two locked
> decisions. Nothing here is a question any more except §3.

---

## 1. Everything you decided — locked

| # | Decision | Locked answer |
|---|---|---|
| 1 | Nav label | **"Ask Clinket"** — not the bare word "Search", which your app already uses as the in-page filter on ~12 screens |
| 2 | Header entry | **Option A** — an "Ask Clinket" button in the header's right cluster opening a panel. The panel is an **entry point**: type, press Enter, and it opens the full page at `/dashboard/search` with the answer already streaming |
| 3 | Who can use Search | **Every member** with a business context |
| 4 | Follow-up questions | **Yes** — short memory, re-authorized every turn |
| 5 | Limits | **200 per business per day · 60 per member per day · 6 per minute** — all appsettings dials, all surfaced in the UI with the real number |
| 6 | The one new field (`searchAudience`) | ‼️ **APPROVED.** Default **"Everyone on my team"**; hidden entirely on a solo business |
| 6b | ‼️ Who may find DOCUMENTS | **Open to every member.** Today only 4 of your 10 roles can see documents at all (the Knowledge page is gated on the AI-voice permission); six roles gain document search. Because that is a deliberate widening, **the `searchAudience` field and its enforcement move from Phase 4 into Phase 1** — so the restriction mechanism exists from the first line of code and there is never a window where every document is open with no way to limit it. Its **UI** stays in Phase 4 |
| 7 | Phasing | **Everything in this project — P1 to P5**, per `PLAN.md` §14. Nothing waits for go-live |
| 8 | Model | ‼️ **`gpt-5.6-luna` at `reasoning_effort: none`** — measured on your own Azure: 15/15 tool planning (mini 14/15), 4.4× cheaper, ~0.35 s slower to first token. The deployment stays a one-line dial |
| 9 | Helpful / Not helpful | **Keep** — it is the quality signal after launch |
| 10 | New UI libraries | **Approved**: `react-markdown` + `remark-gfm` (web), `react-native-markdown-display` (mobile), `@react-native-clipboard/clipboard` |
| 11 | "Quotes Gaurav sent" | **Answer "assigned to Gaurav", and say so in the answer.** No new index. Same for bookings and invoices |
| 12 | The dormant `/ai/chat` assistant | ‼️ **DELETE it** in P1. It has no screen on either app, and its session grants whole-business access regardless of role — deleting it closes that |
| 12b | ‼️ Analytics | **Store the question text, anonymised on the device before it is sent** — the existing PII scrub, plus money → `<amount>`, team names → `<member>`, customer names → `<customer>`. Web **and** mobile. No sampling on asks |
| 13 | Rail position | **Right under Dashboard** |
| 14 | ‼️ Voice input | **LOCKED, own phase (P1.5), `PLAN.md` §18.** Speak in any of your 5 languages → transcript stays in that language, editable, never auto-sent → answer comes back in that language. Nothing the provider sees is ever translated |
| 15 | ‼️ Transcription engine | **Azure Speech "Fast Transcription"** — $0.36/hr vs the **$1.00/hr** engine you run today. **2.8× cheaper**, and because it replaces the engine behind the existing mobile dictation, that gets cheaper too. Same Speech resource, same key, **no new Azure resource** |
| 16 | ‼️ The old `ai/speech-to-text` endpoint | **Move mobile's 4 call sites to a new `api/v1/speech/transcribe`, THEN delete the old route.** Your assumption that nobody used it was wrong — mobile calls it in four places — so it is a migration, not a deletion. No backward compatibility (pre-prod) |
| 17 | ‼️ Auto-detect the spoken language | **Yes — no picker.** The 4-language cap that excluded Gujarati belongs to the OLD engine. Fast Transcription has no such limit, so we send a small candidate list built per provider (their app language + country + their content's alphabets). The picker exists only to *correct* a wrong detection |
| 18 | ‼️ Search across alphabets | **The rule: search the asked language + every alphabet your content uses.** Not "add English". A business with English + Gujarati + Hindi documents needs three renderings **even for an English question**. English + French + Spanish is **one** alphabet ⇒ one rendering |
| 19 | ‼️ How the AI knows your alphabets | **It doesn't, and it must not.** The **server** knows, from a new `scripts` field on each chunk, and builds the tool with one required field per alphabet. You never pick anything; the AI never guesses |
| 20 | ‼️ Index changes | **Knowledge index: delete + recreate** (drops the dead `language` field, adds `scripts`) — costs re-embedding every document, which you accepted. **Services index: ADD `scripts` only, no rebuild** — it is your customer-facing marketplace index and must not be disrupted. **No backfill anywhere** |
| 21 | Live text while speaking | **No — speak-then-see**, as your apps already do |
| 22 | Rename the `ai.assistant.use` permission | **No** — renaming logs every mobile user out for zero benefit |
| — | Internal name | **`BusinessSearch`** / `api/v1/business/search` (`ProviderSearch*` already means the customer-side "search **for** providers") |
| — | Audit cadence | **After every phase**, mandatory — a phase is not done until its audit has run and every finding is fixed or refuted |

---

## 2. What changed your assumptions (all measured, not guessed)

| | |
|---|---|
| **Luna can tool-call** | Your codebase says it can't. I measured it on your Azure: it can, with `reasoning_effort: none`, streaming included — and it planned tool calls *better* than mini (15/15 vs 14/15), at 4.4× lower cost |
| **A cheaper answer than a download link** | Every PDF/scan page is already cached as text, so "Show page 4" costs a few kilobytes — no viewer, no file download. "Open the original file" stays as a second, deliberate action |
| **Page numbers are free** | Already stored on every searchable passage. No schema change, no reprocessing. Honest only for PDFs, scans and slide decks — Word/Excel/web files show the section instead |
| **The breadcrumb is already built** | Categories store `"Appliance Services > Washing Machine"`, and a subcategory is a category with a parent — exactly as you described. Note: category names are not translated anywhere in the platform, so the breadcrumb shows the stored name in every language, same as your customer app |
| ‼️ **Transcription costs more than the answer** | Your AI answer costs **$0.00025**. Ten seconds of speech on today's engine costs **$0.0028** — **11× the answer**. On Fast Transcription it drops to $0.0010. The cheapest option on the market (`gpt-4o-mini-transcribe`, ~$0.0006) saves another $0.0004 per query — about **8 cents per business per day** — but publishes **no Gujarati support**, and independent measurements put Gujarati error rates near 28%. Not worth breaking one of your five languages |
| ‼️ **Gujarati is the language auto-detect drops** | Azure allows only **four** candidate languages when detecting automatically, and your code wires `en, fr, es, hi` — Gujarati is the one left out, in the market most likely to speak it. Fix: **always name the language**, chosen from a small picker that defaults to the member's app language. Gujarati then works everywhere, and the 4-language cap stops mattering at all |
| **A Hindi document, an English question** | Found through the meaning-based leg only — the keyword leg cannot match across scripts. The fix is nearly free and is being added: tell the model which languages your documents are in (we already read that), so it searches in both |

---

## 3. Still open — the only things I need from you

| Topic | Options |
|---|---|
| ‼️ **One analytics field, `inputMode`** (records whether an ask was **typed** or **spoken**) | This is a §0.7 change, so it needs your yes. Without it, voice ships but we cannot tell whether spoken questions get worse answers than typed ones — which is the whole reason you asked to store the question text. Cost: one short word per event, added to a schema that only ever grows. **Everything else about voice is decided and needs nothing from you.** |
| **Search-service capacity** | One Azure AI Search service (basic SKU, 1 replica) hosts the knowledge, service and provider indexes, so Business Search shares capacity with your customer marketplace search. Nothing to do now — it gets measured under load in P5, and raising the SKU would be your call then |
| *(Optional, previously declined)* "Sent by" index | You chose "assigned to" (decision 11). If you ever want true "sent by Gaurav", it needs a new database index — a separate schema approval |

---

## 4. What happens next

1. **P1 is running now.** You have sent it the correction message.
2. ‼️ **P1.5 = voice**, its own session, run **after P1 and before P2** (prompt: `PHASE-1-PART-2-PROMPT.md`). It has its own session because it changes a shared service your mobile app already uses — that deserves its own audit, not a corner of the UI phase.
3. P2 = web **and** mobile together (mobile never lags web). P3 = team answers. P4 = the audience UI. P5 = the whole-programme audit.
3. Every phase ends with its own multi-dimensional audit and writes the next session's copy-paste prompt.
4. No UI code before you approve the mockup states it draws; no schema beyond the one approved field without a fresh §0.7 answer.
