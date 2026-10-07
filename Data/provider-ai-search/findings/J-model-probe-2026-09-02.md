# J — LIVE MEASUREMENT: does `gpt-5.6-luna` support tool calling? (2026-09-02)

> Ran against **live Azure** from local code (the method this programme's owner sanctioned: "prove locally —
> harness against live Azure from local code"). Probe scripts lived in the session scratchpad, never in a repo:
> `…\scratchpad\luna-tools-probe.mjs`, `luna-temp-probe.mjs`, `luna-temp-isolate.mjs`.
> Endpoint/key/api-version read from `clinqetapi/Clinqet.API/appsettings.json` → `AIService`; the key was never
> printed. Cost of the whole probe: 14 completions, < 1¢.

## 1. The headline

**`gpt-5.6-luna` DOES support function/tool calling on Azure Chat Completions — including streaming — provided
`reasoning_effort` is `'none'` (or absent).** The owner's assumption ("I think Luna doesn't support the tool
calling") and the repo's own comment are both wrong as stated.

| # | Call | Result |
|---|---|---|
| A | `gpt-5.4-mini` + tools, non-stream (baseline) | **200**, `finish_reason: tool_calls`, `search_knowledge{"query":"cancellation policy fee inside 24 hours"}`, 1858 ms, 188 prompt / 26 completion |
| B | `gpt-5.6-luna` + tools, `reasoning_effort:'none'` | **200**, `tool_calls`, same tool + args, **1456 ms** (faster than mini), 188/26, 0 reasoning tokens |
| C | `gpt-5.6-luna` + tools, **no** `reasoning_effort` field | **200**, `tool_calls`, 2133 ms, 188/40, **6 reasoning tokens** |
| D | `gpt-5.6-luna` + tools, `reasoning_effort:'low'` | **400** `unsupported_value` — *"Function tools with reasoning_effort are not supported for this model in /v1/chat/completions. To use function tools, use /v1/responses or set reasoning_effort to 'none'."* |
| E | `gpt-5.6-luna` + tools, effort `none`, **temperature 0.7** (the exact shape `McpAIService` sends) | **200**, `tool_calls` |
| F | `gpt-5.4-mini` + tools, **streaming** | **200**, tool-call deltas, first event **446 ms**, total 648 ms |
| G | `gpt-5.6-luna` + tools, **streaming**, effort `none` | **200**, tool-call deltas, first event **816 ms**, total 1166 ms |

## 2. The exact temperature rule (isolated by a second and third probe)

`reasoning_effort: 'none'` is the switch — not the presence of tools.

| `reasoning_effort` | tools | `temperature` | result |
|---|---|---|---|
| `'none'` | either | absent / **0** / **0.7** | **200** (strict `json_schema` also 200) |
| absent | yes | absent | 200 (spends a few reasoning tokens) |
| absent | yes | 0 | **400** `Only the default (1) value is supported` |
| absent / `'medium'` | no | 0 · 0.1 · 0.7 · 2 | **400** same |
| absent / `'none'` | no | 1 (or absent) | 200 |
| explicit `'low'` / `'medium'` / … | **yes** | — | **400** (row D above) |

## 3. What this REFUTES in the current codebase (report to the owner; do NOT fix inside this project)

1. ‼️ **`clinqetshared/Constants/AiModels.cs:9-11`** — the comment *"gpt-5.6 cannot do tool calls on Chat
   Completions"* is **false as written**. The true constraint is: *not together with an explicit non-`none`
   `reasoning_effort`*. The convention test
   `clinqetapi/Clinqet.API.UnitTests/Conventions/AiModelPinConventionTests.cs:56`
   (`TheHostDefaultModel_StaysOnMini_BecauseA3CannotLeaveIt`) therefore pins the right outcome for the **wrong
   reason** — if the host default is to stay on mini, the reason must be restated (candidates: luna's RAI filter
   is assigned-but-not-enforced, and luna 500s on some image inputs — both measured by the AI-cost programme).
2. ‼️ **`AIService:DefaultTemperatureOnlyDeployments` is over-broad.** The seam
   (`clinqetinfrastructure/Services/AI/AICompletionService.cs`, `AcceptsTemperature`) strips temperature for
   every luna call. Measured: with `reasoning_effort: 'none'` luna accepts **any** temperature. Consequence for
   the other programme: **B1 search enrichment lost its `temperature: 0` determinism (which the content-hash
   cache depends on) unnecessarily** — sending `reasoning_effort: 'none'` explicitly restores it. This is a
   concrete, cheap fix for a Gate-1 workaround, but it belongs to the AI-cost programme, not here.

## 4. What it means for Provider Search (decision 10)

- **luna is viable** for the answer model: tools ✓, streaming ✓, strict schema ✓, temperature freedom ✓ — all at
  `reasoning_effort: 'none'`, and at **$0.20/$0.02/$1.20 per 1M vs mini's $0.75/$0.075/$4.50** (≈ 3.75× cheaper
  in, 3.75× cheaper out) ⇒ ≈ **$0.0013 vs $0.005 per answer** on the plan's token model.
- **Latency**: first streamed event 816 ms (luna) vs 446 ms (mini) — one sample each, not a p95. Since the UI
  streams a "Searching your documents…" status immediately and the first tool round happens before any prose,
  ~400 ms extra before the first token is not user-visible in this design.
- **Quality is NOT settled by this probe.** It proves capability, not answer quality. The plan keeps
  `DeploymentName` a dial and the honest sequence is: ship on the model the owner picks, then A/B answer quality
  on a labelled question set before flipping (the programme's own rule: a dial moves only on a measurement).
- ‼️ **Standing risk if luna is chosen**: luna's content filter is assigned but **not enforced** on the data
  plane (AI-cost programme measurement: profanity / jailbreak / indirect-attack injections all returned 200 on
  luna and 400 on mini). Provider-uploaded documents are untrusted text that flows into this prompt, and
  prompt-injection through them is already unmitigated platform-wide. On mini the content filter at least
  blocks the known classes. **This is the strongest argument for mini as the phase-1 default**, cost
  notwithstanding — owner's call, stated plainly.
- **If effort `none` is used, set it explicitly** rather than omitting it: omitting it worked but spent reasoning
  tokens (case C: 40 completion vs 26, with 6 reasoning) and leaves the temperature restriction in force.

## 5. Reproduce
`node <scratchpad>/luna-tools-probe.mjs` (7-case matrix + verdict), `luna-temp-probe.mjs` (temperature sweep),
`luna-temp-isolate.mjs` (which factor lifts the restriction). Each reads the endpoint/key from the repo
appsettings at runtime; none writes anything anywhere.
