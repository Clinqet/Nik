# K — MODEL DECISION, measured on the owner's own Azure (2026-09-02)

> Owner's brief: *"cost and speed both are important … content filter is not a big issue it will get resolved …
> which model will be best and their effort level and also performance and accuracy and cost and what will be
> good balance."* This file answers exactly that, with measurements on THIS platform's deployments, using THIS
> feature's real task shape. Probe scripts in the session scratchpad (`model-bench.mjs`,
> `tool-planning-bench.mjs`); nothing was written into any repo.

## 1. RECOMMENDATION — `gpt-5.6-luna` with `reasoning_effort: "none"`

It is **4.4× cheaper**, plans tool calls **better** than mini, matches mini on answer quality, and is ~0.4 s
slower to first token. Keep `BusinessSearch:Answer:DeploymentName` a dial so one config line swaps it.

‼️ **`reasoning_effort: "none"` is mandatory, not a tuning choice**: luna + tools with any explicit effort above
`none` returns **HTTP 400** — *"Function tools with reasoning_effort are not supported for this model in
/v1/chat/completions. To use function tools, use /v1/responses or set reasoning_effort to 'none'."* Omitting the
field also works but spends reasoning tokens and re-imposes luna's "temperature must be 1" lock, so set it
explicitly. (`findings/J` has the full rule table.)

## 2. Answer quality + cost — the real task (RAG answer over 4 retrieved passages, citations, markdown table)

3 runs per arm, streaming, `max_completion_tokens` 900, identical prompt. Cost uses the repo's own
`AIService:TokenPricing`.

| Arm | Time to first token | Total | **Cost / answer** | Output tokens |
|---|---|---|---|---|
| mini, no effort field | 1130 ms | 2472 ms | $0.00109 | 184 |
| mini @ `none` | 934 ms | 1749 ms | $0.00104 | 174 |
| **mini @ `low`** | **552 ms** | **1424 ms** | $0.00114 | 196 |
| **luna @ `none`** | 899 ms | 1978 ms | **$0.00025** | 150 |
| luna, no effort field | 1452 ms | 2471 ms | $0.00033 | 214 (26–77 reasoning) |

**Cost gap is bigger than list price suggests** (4.4×, not 3.75×) because luna also emits ~20 % fewer tokens.
Both models produced a correct markdown price table, the correct policy wording, the correct package answer and
correct `[n]` citation markers. Difference in style only: mini puts `[1]` on each table row, luna puts it once
after the table — a prompt detail, not a capability gap.

## 3. Tool planning — the test that decides an AGENT (and the surprise)

7 tools offered, 5 compound scenarios × 3 runs, scored as an EXACT tool-set match (missing or extra = fail):

| Arm | Correct | Median latency |
|---|---|---|
| **luna @ `none`** | **15 / 15** | 1522 ms |
| mini @ `low` | 14 / 15 | 1471 ms |
| mini @ `none` | 12 / 15 | 1175 ms |

The single failure mode was the same on both mini arms and never on luna: *"How many bookings did Gaurav have
last week and how much did we invoice in the same period?"* → mini called `list_team_members` instead of
`list_bookings` + `invoice_totals`. That is precisely the compound, member-scoped question the owner named, so
the miss is not academic.

**This overturns the intuition** that a non-reasoning model would plan worse: luna @ `none` planned better than
mini @ `low`.

## 4. Public benchmarks (context, not the decision)

MMLU-Pro: **luna 86.0 % vs mini 84.6 %** ([gradually.ai comparison](https://www.gradually.ai/en/llm-comparison/gpt-5.6-luna-vs-gpt-5.4-mini/)).
luna is positioned for "high-volume, latency-sensitive tasks such as chat, classification and lightweight
agentic workflows" with a 1.05 M context vs mini's 400 K
([Artificial Analysis](https://artificialanalysis.ai/models/gpt-5-6-luna), [OpenAI model page](https://developers.openai.com/api/docs/models/gpt-5.6-luna)).
Azure-hosted luna medians reported around 771 ms latency / 44 tok-s
([requesty](https://www.requesty.ai/models/azure/gpt-5.6-luna-eastus2)) — consistent with what we measured.

## 5. What this costs at scale

At the proposed cap (200 questions/business/day):

| Volume | luna @ none | mini @ low | Difference |
|---|---|---|---|
| 1 000 questions/day | $0.25 | $1.14 | $0.89/day |
| 100 businesses × 50/day = 5 000/day | $1.25 | $5.70 | ~$134/month |
| 1 000 businesses × 50/day = 50 000/day | $12.50 | $57.00 | ~$1 340/month |

Retrieval (embedding + 2 search requests + Cosmos reads) is unchanged by the model choice and is the other
half of the per-answer cost; the model is the half that scales with question volume.

## 6. The honest caveats

1. **Answer quality was judged on ONE task shape.** Before go-live, run the A/B on a labelled question set
   drawn from real provider documents (the programme's own rule: a dial moves only on a measurement). The dial
   makes that a config flip, not a rewrite.
2. **luna's content filter is assigned but not enforced** on the data plane (measured by the AI-cost
   programme). The owner has accepted this ("it will get resolved"). Recorded here so the decision is
   traceable, and because provider-uploaded documents are untrusted text entering this prompt.
3. **luna 500s on some image inputs** (AI-cost programme, 8/8 on locally-generated images). Not applicable to
   this feature: Business Search sends only text to the model — pictures are rendered by the client from blob
   storage and never enter the prompt.
4. **Speed**: mini @ `low` is ~350–550 ms faster to first token. Behind the "Searching your documents…" status
   line and a tool round that happens first, this is not user-visible. If it ever is, the dial flips.
5. `reasoning_effort` on **mini** is free to use with tools; on **luna** it must stay `none`. If a future phase
   needs deep reasoning WITH tools, the options are mini at a higher effort, or the Responses API (no Responses
   API usage exists anywhere in the codebase today — that would be new ground).
