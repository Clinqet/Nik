# P4 — model measurements against live Azure (2026-09-04)

`CARRIED-TO-P4.md` §1 left exactly one measurement open, and `PHASE-4-PROMPT.md` §3.0 named it **C1**:

> The multi-script SEARCH WORDS block sits in the **system** message and varies per question, so a
> multi-alphabet business misses the prompt cache on those turns. Moving it to the user turn fixes that —
> but it measured 25/25 where it sits (P1.5 Gate 1), so **re-measure, never merely move**.

**It was moved, and it was measured.** The owner's instruction for this run: *"all solid and perfect … no
degradation at all."*

| | |
|---|---|
| **Deployment** | `gpt-5.6-luna` at **`reasoning_effort: none`** — the shipped setting, read out of `BusinessSearch.Answer.DeploymentName`, not the `AIService` default |
| **Endpoint** | the owner's own Azure AI Foundry non-prod resource, api-version from `AIService.ApiVersion` |
| **Total calls** | **800** |
| **Fidelity** | The system prompt, the SEARCH WORDS block, the `search_knowledge` description and its three-alphabet schema are **rebuilt from the shipped source**, and **29 literal fragments are asserted byte-present** in the `.cs` / `.json` they came from. A mistyped fragment throws instead of measuring wording that does not ship. The guard caught two of my own errors during setup |
| **Placement guard** | The harness also asserts `Content = scriptRules is null ? question : question + scriptRules` is present in `BusinessSearchAgent.cs`. If somebody moves the block back to the system message, the harness **throws** rather than measuring a variant that no longer runs |

Probe scripts lived in the session scratchpad and are deleted (§0.16). No credential value is written into
any file here or in any repo.

---

## What was compared

| Variant | Where the block sits |
|---|---|
| **A** | the **system** message — the P1.5 placement, which measured 25/25 |
| **B** | appended to the **user** turn — the P4 change, which is what now ships |

Everything else is identical: same base prompt, same tool, same three required renderings
(`queryInEnglish` + `queryInGujarati` + `queryInHindi`), same `max_completion_tokens`.

‼️ **The run is INTERLEAVED — question outer, variant inner.** Running all of A and then all of B would put
any mid-run service slowdown entirely on B, which would read as the move having made things worse.

## The classifier — the SERVER's own rule, never an eyeball

A call PASSES only if all of the following hold, which is exactly what
`BusinessSearchQueryRenderings.Parse` accepts:

1. all three fields present, of type string, and non-empty;
2. `queryInEnglish` contains a Latin letter;
3. `queryInGujarati` contains a Gujarati character (U+0A80–U+0AFF);
4. `queryInHindi` contains a Devanagari character (U+0900–U+097F);
5. neither non-Latin field is byte-identical to the English one (the measured P1.5 failure was the model
   copying one English string into every field).

A transport failure or a 429 is **not** a model verdict: it is retried up to four times and, if it still
cannot complete, counted in its own bucket — so a run can never quietly report a smaller N than it claims.
**No call landed in any such bucket.**

---

## Gate 1 — A vs B, 50 per case, 300 calls

| Question | A (system message) | B (user turn) |
|---|---|---|
| *what is our cancellation policy?* | **50/50** | **50/50** |
| *કેન્સલેશન પોલિસી શું છે?* (asked in Gujarati) | **50/50** | **50/50** |
| *how much deposit do we ask for on a big job?* | **50/50** | **50/50** |
| **Total** | **150/150** | **150/150** |

**No difference, and no failure of any kind on either side** — no missing field, no copied English, no
wrong-script rendering, no refusal, no invalid tool call.

## Gate 2 — confirmation on the SHIPPED placement, 100 per case, 500 calls

Re-run on B alone, with two harder shapes added: the same question asked in Hindi, and a two-part English
question that invites a prose answer instead of a tool call.

| Question | Result |
|---|---|
| *what is our cancellation policy?* | **100/100** |
| *કેન્સલેશન પોલિસી શું છે?* | **100/100** |
| *how much deposit do we ask for on a big job?* | **100/100** |
| *हमारी रद्द करने की नीति क्या है?* | **100/100** |
| *do we cover Saturday callouts and what do we charge for them?* | **100/100** |
| **Total** | **500/500** |

**‼️ The shipped placement measures 650/650 across eight question shapes. The move costs nothing.**

---

## Why the move is worth making

The block is appended **only when the business writes in more than one alphabet**, which depends on the
QUESTION rather than on the business. In the system message that meant the prompt **prefix** changed between
turns for a multi-alphabet business, and a changed prefix cannot be served from the prompt cache.

After the move the ordering is **system → history → question + block**, so the block itself no longer moves
the boundary. ‼️ It is NOT the only thing that did — see the section below, which the audit added.

‼️ **What this run does NOT claim.** It does not demonstrate a cache hit. A probe question builds a prompt
far shorter than the cache minimum, and every reading came back `cached_tokens: 0` for **both** variants —
so the measurement is of **compliance**, which is what could regress, and the cache argument is structural.
Saying otherwise would be reporting a number this run did not produce.

## ‼️ AND THE MOVE DOES NOT FINISH THE JOB — found by the P4 audit, stated here rather than buried

The first draft of this file, and the comment in the code, said the prefix is now "system + history, which
only ever grows". **That is wrong, and the audit caught it.** `scripts.IsSingleLeg` — the very condition that
gated the moved block — ALSO decides how many required `queryIn<Language>` fields
`BusinessSearchQueryRenderings.BuildSchema` puts on `search_knowledge` and `search_services`, and the tool
definitions are part of the cacheable prefix. So for a multi-alphabet business the prefix still changes
between a question asked in English and the same question asked in Gujarati.

| | |
|---|---|
| **What the move fixed** | one of the two causes, worth ~150 tokens of prefix variance, at zero measured cost |
| **What remains** | the per-request tool schema, on the order of 4–5k prompt tokens of prefix (system prompt + work rules + roster + up to 17 tool definitions) |
| **Why it was not fixed here** | a fixed-shape schema means either always asking for every alphabet the business writes in (paying for legs the question does not need, and inviting the 3/25 copy-the-English failure P1.5 measured) or moving the renderings out of the tool schema entirely. Both are model-facing changes that need their own measurement, and one of them was measured at 25/25 in its current shape |

**Carried to P5 as a costed, measured question — not as a cleanup.** The honest summary is that the placement
is now right and the caching win is smaller than the carried item implied.

## What changed in the code as a result

| File | Change |
|---|---|
| `BusinessSearchAgent.BuildMessagesAsync` | The block no longer appends to `system`; the final user message is `question + ScriptRules(scripts)` |
| `BusinessSearchAgent.ScriptRules` | New private static — the same words, verbatim, in one place |

The **wording is byte-identical** to what P1.5 measured at 25/25. Only its position changed, and that is the
only thing this file measures.
