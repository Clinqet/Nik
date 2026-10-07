# Voice assistant: move to GPT-Realtime 2.1, and make the assistant sound more human

**The authority document for this programme.** Folder: `C:\Nik\Data\voice-realtime-2.1\`.
Hand-off prompt for the implementing session: `IMPLEMENTATION-PROMPT.md` (same folder).

| | |
|---|---|
| Written | 2026-09-25, by the planning session. **That session changed no code, config or deployment.** |
| Status | **APPROVED by the owner for implementation (2026-09-25)**. The owner's words: the next session must know *"what is our approved design and what need to be fixed so that it can do it all"*. Items in §12 are **NOT approved yet**; ask the owner before touching them. |
| Mockups | **Owner waiver (2026-09-25):** *"It doesn't need to approve the mock-up with me."* The UI quality bar in §9 replaces mockup approval for this programme. It is mandatory. |
| Code state | Every file path and line number here was verified on 2026-09-25. Other sessions edit these repos, so **re-read every file before editing it. If the code no longer matches this plan, STOP and ask the owner.** |

---

## Contents

1. [Goal and success criteria](#1-goal-and-success-criteria)
2. [What the planning session found, and the evidence](#2-what-the-planning-session-found-and-the-evidence)
3. [Decisions and the reasoning (owner-approved)](#3-decisions-and-the-reasoning-owner-approved)
4. [Scope](#4-scope)
5. [Phase A — model move (both countries)](#5-phase-a--model-move-both-countries)
6. [Phase B1 — voice picker redesign (web + mobile)](#6-phase-b1--voice-picker-redesign-web--mobile)
7. [Phase B2 — tone and pace in the prompt](#7-phase-b2--tone-and-pace-in-the-prompt)
8. [Phase B3 — notice voice for Canada/US (Telnyx)](#8-phase-b3--notice-voice-for-canadaus-telnyx)
9. [UI quality bar (mandatory)](#9-ui-quality-bar-mandatory)
10. [Tests](#10-tests)
11. [Dev-call verification](#11-dev-call-verification)
12. [Found while planning — OWNER DECISION NEEDED (not approved)](#12-found-while-planning--owner-decision-needed-not-approved)
13. [Execution order, build protocol, git and clean-tree rules](#13-execution-order-build-protocol-git-and-clean-tree-rules)
14. [Rollback](#14-rollback)
15. [Definition of done](#15-definition-of-done)
16. [Decision register](#16-decision-register)
17. [UI register (§0.20)](#17-ui-register-020)
18. [Sources](#18-sources)

---

## 1. Goal and success criteria

**Goal 1: sound human.** A caller talking to the assistant should feel they are talking to a calm, natural
person: fast natural turn-taking, a calm unhurried tone, one consistent voice from the first word, and wording
that doesn't sound scripted.

**Goal 2: stay on a supported model.** Replace `gpt-realtime-2` (Preview, being retired) and
`gpt-realtime-mini` with `gpt-realtime-2.1` and `gpt-realtime-2.1-mini`. Both countries run identical models.

**Done means:**
1. Every Canada/US and India call runs on `gpt-realtime-2.1-mini` (Standard) or `gpt-realtime-2.1`
   (Advanced). The old model names appear nowhere in runtime code, config or `deploy.ps1`.
2. Azure accepts every call: no 400/410/422 on accept, and no `error` event after the India session setup.
3. The voice picker leads with the two best voices, has honest labels, and plays a ~10-second preview in the
   line's own language. It is excellent on phone, iPad and laptop, and native-feeling on the mobile app.
4. The assistant's prompt asks for a calm, unhurried delivery.
5. On Canada/US lines the recording notice is read by a natural voice in the line's language, of the same
   gender as the AI voice the provider chose.
6. All tests are green (unit and integration). ESLint has zero errors. Mobile `tsc` and jest are green.
   Skills and memory are updated. The tree is clean.

---

## 2. What the planning session found, and the evidence

All of this was verified on 2026-09-25 against official sources or the code. Sources are in §18.

### 2.1 Model lifecycle

| Model | Version | Status | Retires | On Azure's SIP list | East US 2 / Sweden Central |
|---|---|---|---|---|---|
| `gpt-realtime-2` (Advanced today) | 2026-05-06 | Preview | Retirement page shows no date; replacement = 2.1. Models API date 2026-10-31 (recorded in `deploy.ps1:539` by another session; not re-checked). | yes | yes / yes |
| **`gpt-realtime-2.1`** | 2026-07-07 | **GA** | 2027-06-25 | **yes, since 2026-09-23** | yes / yes |
| **`gpt-realtime-2.1-mini`** | 2026-07-07 | **GA** | 2027-06-25 | **yes, since 2026-09-23** | yes / yes |
| `gpt-realtime-mini` (Standard today) | 2025-12-15 | GA | The page lists BOTH 2026-12-15 and 2027-06-15 | yes | yes / yes |
| `gpt-realtime-1.5` (emergency fallback only) | 2026-02-23 | GA | 2027-08-24 | yes | yes / yes |

- **Preview retirement policy (Microsoft):** a retiring preview model is either force-upgraded to its
  replacement or switched off (inference returns `410 Gone`), with at least 30 days' notice. There is no
  staying on it.
- **Deployment type:** every realtime model is **Global Standard only**. There is no Data Zone or regional
  option for realtime.
- **When SIP support arrived:** 2.1 and 2.1-mini were added to the SIP list by the public docs commit
  "realtime 2.1 GA (#14526)" on 2026-09-23 (MicrosoftDocs/azure-ai-docs `1501895985b8c16cf61f000a6c703c0c37e82be7`).
  The same commit removed the old 2026-08-31 retirement date for `gpt-realtime-2`.

### 2.2 The August "2.1 fails on SIP" result was confounded

- **2026-07-30:** 2.1 was not on the SIP list. Premium moved from 1.5 to `gpt-realtime-2`.
- **2026-08-07:** our payload started sending `truncation` (retention_ratio) to **every** model, on both SIP
  and the India WebSocket.
- **2026-08-11 (decision D5):** the owner's live probe showed 2.1 and 2.1-mini failing on Azure SIP.
- **2026-09-02:** Microsoft added a known limitation: *"Currently, GPT Realtime 2.x models don't support the
  `truncation` property in the `session.update` payload."* The commit message says the limitation was
  *"determined through conversation with the product team"*.
- **Conclusion:** the August failure may have been our payload, not SIP. We also cannot prove from the repo
  that any Advanced (`gpt-realtime-2`) call has succeeded since 2026-08-07.

### 2.3 Other Azure facts that shape the code

- Azure 2.x `reasoning.effort` accepts `minimal`, `low`, `medium` and `high`. OpenAI documents `low` as the
  default.
- 2.x reply turns can contain several output items: a preamble (`commentary`) and a `final_answer`. Microsoft
  says 2.x instruction following is *stricter* than earlier models.
- **Context window is reported three ways:** 32K input (Azure model table), 128K (OpenAI model page), 256K
  (Azure 2.x overview). Plan for 32K until a long dev call measures it.
- **Azure rejects a whole `session.update` when one field is malformed.** This is recorded in
  `clinqetmcp/Clinqet.Mcp.UnitTests/Monitor/PlivoVoiceRelayTests.cs:303`. On India's relay, an `error` event
  after the setup is only logged as a Warning (`PlivoVoiceRelay.cs:639`), so a rejected setup could leave a
  call running without our instructions, tools or audio format.
- **Silent failure on accept:** `clinqetinfrastructure/Services/Voice/RealtimeCallService.cs:44-48` maps HTTP
  404/410/422 to `CallGone`. It logs a Warning, **does not log the response body**, and sends **no admin
  alert** (`RealtimeCallWebhookFunction.cs:200-205`). A retired model answers 410.

### 2.4 Prices

Source: Azure Retail Prices API. East US 2 and Sweden Central are identical. Global Standard, per 1M tokens.

| Model | Audio in / cached / out | Text in / cached / out |
|---|---|---|
| `gpt-realtime-2` = `gpt-realtime-2.1` | $32 / $0.40 / $64 | $4 / $0.40 / $24 |
| `gpt-realtime-mini` (2025-12-15) = `gpt-realtime-2.1-mini` | $10 / $0.30 / $20 | $0.60 / $0.06 / $2.40 |

Audio is billed at ~10 tokens/s for the caller and ~20 tokens/s for the AI (OpenAI realtime cost guide).

**Modelled per-call effect of this plan.** The model uses the July call shape: 7.5k-token fixed prompt, ~4
replies/min, caller speaking 35% of the time, AI 45%. Three sensitivity runs agree.

- **Advanced 2 → 2.1:** 0%.
- **Standard mini → 2.1-mini with reasoning `low`:** about +5% to +13% per typical call, i.e. ~$3–8 per 1,000
  three-minute calls. This is the reasoning tokens.
- **Calls over ~10 minutes get cheaper.** Today's 8,000-token `truncation` limit makes Azure re-read the kept
  history at full price after each trim, and that goes away.
- **The measured figure comes from existing per-call usage telemetry** (`RealtimeUsage` on the session,
  `costMeta.RealtimeEstimatedCost` on the call summary).

### 2.5 India

- India calls do **not** use SIP. They use **our** WebSocket relay, `clinqetmcp/Clinqet.Mcp/Monitor/PlivoVoiceRelay.cs`
  (~1,850 lines, MCP host in Central India) to the Sweden Central Foundry account.
- India's Advanced tier currently runs **the Standard model**, because the Sweden Central account had no
  premium quota. `deploy.ps1:3438-3440` falls back when the premium deployment is missing, and
  `clinqetmcp/Clinqet.Mcp/appsettings.in.json:68` hard-codes mini.
- The owner has now created `gpt-realtime-2.1` and `gpt-realtime-2.1-mini` in Foundry, so India matches Canada.
- **Noise:** Plivo's noise cancellation is NOT available on the call type India uses (MPC ai-agent). Azure's
  model-side `far_field` noise reduction is India's only denoiser (`RealtimeSessionPayloadBuilder.cs:244-246`).
  Canada/US additionally has Telnyx Krisp suppression (`Voice:NoiseSuppression`, Enabled = true).

### 2.6 Voice picker (the owner's finding 1, verified and slightly worse)

- **Order:** alphabetical, from `clinqetapi/Clinqet.API/appsettings.json:286-327` (`VoiceAssistant:Voices`).
  Web and mobile both render that order. `cedar` is 4th and `marin` 7th. OpenAI: *"For best quality, we
  recommend using marin or cedar."*
- **Labels:**
  - "calm and steady" (ash) and "gentle and reassuring" (sage) steer people who want calm towards the weaker
    voices.
  - Web: `clinqetwebpartnerapp/public/lang/*.json` keys `voiceAssistant.voice.<id>`
    (`en-US.json:3830-3839`).
  - **Mobile shows the API's hard-coded ENGLISH label** (`ApplicationForm.tsx:494` renders `voice.label`,
    which comes from `VoiceOptionDto.Label`), so it is untranslated in every language.
- **Previews:**
  - Web: `clinqetwebpartnerapp/public/voice-samples/<id>.wav`, played at `VoiceApplicationForm.jsx:235`.
  - Mobile: `clinqetmobilepartnerapp/src/assets/voice-samples/<id>.wav`, with a static require map in
    `index.ts`.
  - All 10 are the same single English sentence, *"Hi, thanks for calling! How can I help you today?"*,
    whatever the line's language.
  - They last 2.65–3.5 s. **marin (2.65 s) and cedar (2.8 s) are the two shortest.**
  - They are studio quality, 24 kHz PCM, while callers hear an 8 kHz phone line.
- **Generator:** `clinqetwebpartnerapp/scripts/generate-voice-samples.mjs`. It defaults to
  `gpt-realtime-mini` (which is being removed) and uses the old preview endpoint
  (`/openai/realtime?api-version=2025-04-01-preview&deployment=`).
- **Default voice:** a new line has **no voice selected** (web `VoiceApplicationForm.jsx:49`, mobile
  `ApplicationForm.tsx:60`), and validation then demands one.
- **Mobile audio library:** `react-native-nitro-sound` (`ApplicationForm.tsx:12`).
- **Existing tests:**
  - web: `src/components/Profile/voiceAssistant/voiceApplicationValidation.test.jsx`;
  - mobile: `__tests__/voiceSampleUri.test.ts`, `__tests__/voiceApplicationValidation.test.tsx`,
    `__tests__/voiceAssistantDarkContrast.test.ts`. The mobile app has dark mode.
- **UI languages:** web `en-US`, `es-US`, `fr-CA`, `gu-IN`, `hi-IN`; mobile `src/Locales/{en,es,fr,gu,hi}.json`,
  with `localeParity.test.ts` and `sourceLocalizationIntegrity.test.ts`.
- **Call languages** (`VoiceAssistant:SupportedLanguages`): `en`, `fr`, `es`, `hi`, `pa`, `gu`.

### 2.7 Prompt (the owner's finding 2, verified with one correction)

- `RealtimeSessionPayloadBuilder.cs:330` opens: *"…answering its phone professionally, warmly and CRISPLY."*
- `:383` reads *"Be brief: one or two short spoken sentences per turn…"*.
- **Correction:** `:384` ALREADY says *"Sound like a real person, not a script: warm and natural … never
  robotic or over-formal…"*. So tone is partly covered; **pace and calm are not covered at all.**
- The only pinned test sentence is `"Sound like a real person"` (`RealtimeSessionPayloadBuilderTests.cs:1355`).
  `CRISPLY` is not pinned.
- OpenAI's realtime prompting guide recommends a "Personality & Tone" section: role, tone, length, pacing,
  variety.

### 2.8 Speaking speed (the owner's finding 3, deferred by the owner)

- We send only `audio.output.voice`: `RealtimeSessionPayloadBuilder.cs:186` (SIP) and `:280` (WebSocket).
- OpenAI documents a speed setting (0.25–1.5), but it changes **playback rate**, not how the model phrases
  or paces its speech.
- It is **not verified** that Azure accepts it on SIP with 2.1. An unknown field can make Azure reject the
  whole setup (§2.3).
- Our Canada/US monitor estimates playout at 480 ms/word (`SpokenPlayoutMsPerWord`). Slowing speech without
  scaling that brings back the July "AI talks over itself" timing bug.
- **Not in this plan.**

### 2.9 Notice voice (the owner's finding 4, verified)

- **Canada/US (Telnyx):** `VoiceCall:SpeakVoice = "female"` (`clinqetfuncations/Clinqet.Communications/appsettings.json:1486`,
  class `clinqetshared/Models/VoiceCallSettings.cs:54`), one generic voice for every language.
  - Language tags: `SpeakLanguageMap` en → en-US, fr → fr-CA, es → es-MX, hi → hi-IN
    (`VoiceCallSettings.cs:59-65`, appsettings `:1487-1492`).
  - `SpeakLanguageFallbacks` sends gu and pa to hi.
  - Code comment: an invalid tag is REJECTED and §19 then disables recording and the AI for the whole call.
- **India (Plivo):** `Plivo:Speak:DefaultVoice = "WOMAN"`, `VoiceMap.hi = Polly.Aditi / hi-IN` (appsettings
  `:505-519`, `clinqetshared/Models/PlivoSettings.cs:77-117`). Gu and pa fall back to hi.
- **So a line using `cedar` (male) opens with a woman reading the notice, then a man answers.**
- **Every Telnyx speak site already has the `voiceline`** (so the AI voice), with **no extra read and no new
  stored field**:

  | Site | Line spoken |
  |---|---|
  | `VoiceCallControlFunction.cs:296` | line unavailable |
  | `:344-345` | disclaimer |
  | `:743` | provider hold, via `SpeakProviderHoldAsync` reading the voiceline at `:738` |
  | `:1283` | cap unavailable |
  | `:1729-1739` | voicemail invite |
  | `VoicePostCallProcessorFunction.cs:2835-2846` | dial reassurance |

- **Gender map:** `Azure:Realtime:VoiceGenders` in the Functions appsettings (`:1584-1595`). marin, coral,
  sage and shimmer are female; ash, ballad, cedar, echo and verse are male; alloy is unmapped (neutral).
- **Telnyx voice format (docs):** `Azure.en-CA-ClaraNeural`. Its HD example is written
  `en-US-Emma:DragonHDLatestNeural`, without the `Azure.` prefix, so **the HD string must be confirmed on a dev
  call**.
- **Price:** Azure HD voices through Telnyx cost ~$0.000045 per character. The notice
  (`Voice_Disclaimer`, `clinqetinfrastructure/Resources/Localization/en.json:2636`) is 66 characters, so about
  $0.003 per call.
- **Azure voice names**, verified on Microsoft's voice list with gender:

  | Language | Female | Male |
  |---|---|---|
  | en-US | `en-US-AvaNeural`, `en-US-EmmaNeural`; HD `en-US-Ava:DragonHDLatestNeural`, `en-US-Emma2:DragonHDLatestNeural` (conversational) | `en-US-AndrewNeural`, `en-US-BrianNeural`; HD `en-US-Andrew:DragonHDLatestNeural`, `en-US-Andrew2:DragonHDLatestNeural` (conversational) |
  | fr-CA | `fr-CA-SylvieNeural` | `fr-CA-ThierryNeural` (also Antoine, Jean) |
  | es-MX | `es-MX-DaliaNeural` | `es-MX-JorgeNeural` |
  | hi-IN | `hi-IN-SwaraNeural` | `hi-IN-MadhurNeural` |

  - gu-IN (`gu-IN-DhwaniNeural` female, `gu-IN-NiranjanNeural` male) and pa-IN (`pa-IN-VaaniNeural` female,
    `pa-IN-OjasNeural` male) also exist. **This plan keeps gu and pa on today's Hindi fallback**: the Telnyx
    language tag for gu-IN is not known to be valid, and a rejected notice disables the call's AI.
  - No HD voices exist for fr-CA, es-MX or hi-IN. They use regular neural voices.

### 2.10 Found gap: India prompts never learn the AI's gender

`VoiceGenders` exists **only** in the Functions appsettings. The MCP host, which builds the India payload via
`BuildWebSocketSessionPayload`, has none (checked: `clinqetmcp/Clinqet.Mcp/appsettings*.json` contain 0
occurrences). `ResolveSelfReference` (`RealtimeSessionPayloadBuilder.cs:777-787`) therefore returns null on
India. India prompts say *"Do not refer to yourself with gendered pronouns"*, while Canada/US say *"use she/her
pronouns"*.

In Hindi and Punjabi the first-person verb changes with gender (e.g. "सकती" feminine / "सकता" masculine), so a
female voice may speak masculine forms. **See §12 F1: owner decision needed.**

### 2.11 Alternatives researched and rejected (details in §3)

- Gemini Live (3.8 Live).
- Azure Voice Live.
- Moving Canada/US onto a WebSocket relay.
- Speaking speed now.

---

## 3. Decisions and the reasoning (owner-approved)

**D1 — Models.**
- Standard = `gpt-realtime-2.1-mini`, Advanced = `gpt-realtime-2.1`, **identical in Canada/US and India**.
- The old models are removed from code, config, `deploy.ps1`, skills and scripts.
- The owner has created the new deployments in Foundry. Deployment names must equal model names, as
  `deploy.ps1` already assumes (`modelName = name`).
- *Why:* 2 is a retiring preview. 2.1 and 2.1-mini are GA, on the SIP list, and priced identically. 2.1
  specifically improves alphanumeric recognition, silence and noise handling, and interruptions.

**D2 — Transport.** Canada/US stay on **Azure SIP** straight into the model. India stays on **our Plivo relay**.
- *Why not move Canada/US onto a relay:* today Azure carries Canada/US audio, and our MCP monitor only
  observes. A restart, deploy or crash of our server does not drop a live call. On a relay it would.
- A relay would also add a network hop on every audio frame, take over what Azure's SIP stack does (jitter,
  cutting the AI off when interrupted), cost Telnyx streaming ($0.0035/min), and need a new Telnyx-specific
  relay.
- The relay's advantages (independence from the SIP list, exact audio timing) don't outweigh losing call
  survival.

**D3 — Reasoning.** `reasoning.effort = "low"` on **both** tiers, sent explicitly from one setting.
- *Why:* it is the model's default and what Advanced uses today. Being explicit is deterministic. The cost is
  small (§2.4).

**D4 — No Gemini.** Gemini 3.8 Live (Google's current Live model; there is no cheaper Live tier) was rejected
because:
- Google still bills **every turn for all tokens in the session context, with no cache** (Google Cloud pricing
  page, verbatim). Proactive audio is permanently on in 3.8 Live and bills input while listening.
- Modelled at **3–8× Standard per call**, and dearer than Advanced after ~5 minutes.
- **No SIP** (WebSocket only), and it is not in Azure's catalogue, so Azure SIP can never carry it.
- **No remote MCP:** our code would have to run every tool call.
- **No μ-law audio.** Sessions end at 15 min and connections reset every ~10 min without resumption.
- Its real strengths (Hindi and Gujarati support, voices, proactive audio, keeps talking during tool calls)
  don't outweigh these.

**D4b — No Azure Voice Live.** It runs the same 2.1 models, but:
- **2.1 and 2.1-mini are only *preview* inside Voice Live.** They are GA on Azure OpenAI direct.
- **No SIP** (FAQ: "SIP is currently not supported"). Telephony goes through Azure Communication Services or
  listed connectors (Twilio, Infobip, Genesys, Sinch, Bandwidth), **not Telnyx or Plivo**.
- **Standard costs +44% to +57% per call:** its Basic tier bills cached text at $0.33/M versus $0.06/M, and our
  fixed instructions are re-read every reply.
- With OpenAI voices it offers nothing extra for English. With Azure voices the model writes text and a
  separate voice reads it, which loses native prosody and emotion.
- Its genuine upsides (Indian-accent voices diya, meera and aarti; Québécois sylvie and thierry; deep noise
  suppression) were considered and **declined by the owner**.

**D5 — Voice picker.**
- The recommended voices come first, with honest labels.
- ~10-second previews **in each supported call language**, made with 2.1, played in the line's primary
  language.
- A default voice is pre-selected.
- A modern, fully responsive redesign on web **and** mobile (§6, §9).

**D6 — Tone and pace.** The prompt asks for a calm, unhurried delivery (§7). It ships **together** with the
model move (the owner: assume the models ARE 2.1 and 2.1-mini).

**D7 — Speaking speed.** Later. Not in this plan (§2.8).

**D8 — Notice voice.** The small version for Canada/US only:
- A per-language, per-gender natural voice, chosen from the AI voice the provider picked.
- A retry with today's generic voice if Telnyx refuses a named voice.
- India unchanged (§8).

---

## 4. Scope

**In scope:** Phase A (§5), Phase B1 (§6), Phase B2 (§7), Phase B3 (§8), tests (§10), skills and memory, and
the verification checklist for the owner (§11).

**Out of scope, do NOT do:**
- speaking speed;
- Azure Voice Live;
- Gemini;
- moving Canada/US to a relay;
- a pre-recorded notice in the AI's own voice;
- native Gujarati or Punjabi notice voices;
- anything in §12 until the owner answers;
- any Cosmos, SQL or Search schema change. None is needed. If you think one is, STOP and ask (CLAUDE.md §0.7).

---

## 5. Phase A — model move (both countries)

### A0. Preconditions (confirm with the owner before editing; do not assume)

1. The owner said the Foundry changes are made. **Ask the owner to confirm** the exact deployment names are
   `gpt-realtime-2.1` and `gpt-realtime-2.1-mini`, on BOTH the East US 2 account (Canada/US) and the Sweden
   Central account (India). Global Standard, auto-upgrade off.
2. If the old deployments are already deleted, sandbox voice calls fail until Phase A is deployed. Tell the
   owner this, and that it is expected.

### A1. `clinqetshared/Models/AzureRealtimeSettings.cs`

| Line (2026-09-25) | Change |
|---|---|
| 9-14 | Rewrite the comment. It says 2.1 is NOT SIP-listed, which is now false. Keep one or two short lines per CLAUDE.md §0.14: the tier→deployment map changes only here and in `deploy.ps1`; a model must be on Azure's realtime SIP list (link). |
| 15 | `DeploymentDefault = "gpt-realtime-2.1-mini"` |
| 16 | `DeploymentPremium = "gpt-realtime-2.1"` |
| 118-119 | `VadType` comment says semantic_vad "needs gpt-realtime / gpt-realtime-mini". Update to the GPT-realtime family. Confirm on the dev call that 2.1 accepts `semantic_vad` (§11). |
| 146-152 | **Delete** `TruncationEnabled`, `TruncationRetentionRatio`, `TruncationPostInstructionsTokens` and their comment. 2.x can't take truncation, and the owner's rule is no parked switches. |
| 154-157 | **Rename** `PremiumReasoningEffort` → `ReasoningEffort`, default `"low"`. Short comment: sent on every call; Azure 2.x values `minimal`, `low`, `medium`, `high`; empty ⇒ omitted. |
| 172-187 | `TokenPricing` defaults: key `"gpt-realtime-mini"` → `"gpt-realtime-2.1-mini"` (same six prices); `"gpt-realtime-2"` → `"gpt-realtime-2.1"` (same six prices). Update the "as of 2026-08" date wording. |

### A2. `clinqetinfrastructure/Services/Voice/RealtimeSessionPayloadBuilder.cs`

| Line | Change |
|---|---|
| 175, 269 | Remove the `truncation = BuildTruncation(),` members from BOTH payloads (SIP accept and India `session.update`). |
| 203-214 | Delete `BuildTruncation()` and its comment. |
| 176, 270 | `reasoning = BuildReasoning(model)` → `reasoning = BuildReasoning()` on both payloads. |
| 216-223 | Rewrite `BuildReasoning()`: empty or whitespace `ReasoningEffort` ⇒ `null`, else `new { effort = value.Trim().ToLowerInvariant() }`. **Delete** the "decided by the resolved model / never for the standard model" special case: no pre-2.x model remains. |
| 330, 383-384 | Phase B2 prompt edits (§7). |

No other behaviour changes in this file for Phase A.

### A3. `clinqetinfrastructure/Services/Voice/RealtimeCallService.cs`

- **`:44-48`:** include Azure's response body in the Warning for 404/410/422, reusing the existing
  `Truncate(body)` helper at `:89`. Structured logging only (CLAUDE.md §7).
- Do NOT change the outcome mapping or add an alert without asking.

### A4. `clinqetfuncations/Clinqet.Communications/appsettings.json` (section `Azure:Realtime`, lines 1539-1597)

- **`:1542-1543`:** `"DeploymentDefault": "gpt-realtime-2.1-mini"`, `"DeploymentPremium": "gpt-realtime-2.1"`.
- **`:1562-1564`:** delete `TruncationEnabled`, `TruncationRetentionRatio`, `TruncationPostInstructionsTokens`.
- **`:1565`:** `"PremiumReasoningEffort": "low"` → `"ReasoningEffort": "low"`.
- **`:1568`, `:1576`:** `TokenPricing` keys → `"gpt-realtime-2.1-mini"` and `"gpt-realtime-2.1"`, prices unchanged.
- Leave the Endpoint, ApiKey, SipUri and WebhookSecret values alone. They are sandbox values the owner has
  ruled acceptable (CLAUDE.md §19).

### A5. `clinqetmcp/Clinqet.Mcp/appsettings.json`, `appsettings.ca.json`, `appsettings.in.json`

- **Base `:287-288`:** the new names. **`:310-312`:** delete the truncation keys. **`:313`:** rename the
  reasoning key.
- **`appsettings.ca.json:67-68`:** the new names.
- **`appsettings.in.json:67-68`:** the new names. **Advanced becomes `gpt-realtime-2.1`** (was mini).
- `VoiceGenders` for the MCP host is §12 F1: **do not add it without the owner's yes.**

### A6. `azureautomation/deploy.ps1`

| Line | Change |
|---|---|
| 539 | `$OpenAiRealtimePremiumModelVersion` default `"2026-07-07"`. Rewrite the comment: 2.1 GA, on Azure's SIP list since 2026-09-23. |
| 3021-3025 | Rewrite the comment block (it says 2.1 is NOT on the SIP list). |
| 3026 | `$openAiRealtimeDefaultDeploymentName = "gpt-realtime-2.1-mini"` |
| 3027 | `$openAiRealtimePremiumDeploymentName = "gpt-realtime-2.1"` |
| 3052 | The realtime Standard entry's `version = "2025-12-15"` → `"2026-07-07"`. ⚠ **Do NOT touch `:3054`**, the transcription sidecar `gpt-4o-mini-transcribe`, which is also `"2025-12-15"` and stays. |
| 3438-3439 | Comment says Sweden has no gpt-realtime-2 quota. Make it generic: India's Advanced tier falls back to the Standard deployment only while the premium deployment is missing on the India account. |

- The four app-settings blocks (`:7394-7398`, `:8387-8391`, `:8768-8774`, `:8936-8940`) take the variables
  automatically. Check them, but no edit is expected.
- `preserveIfExists = $true` means the script keeps deployments the owner created by hand. That is the
  intended behaviour.
- `deploy.ps1` sets no reasoning or truncation settings (verified), so nothing to remove there.

### A7. Partner web scripts

`clinqetwebpartnerapp/scripts/generate-hero-call.mjs:70` and `generate-hero-voice.mjs:26` default to
`gpt-realtime-mini`. Change them to `gpt-realtime-2.1-mini`. `generate-voice-samples.mjs` is rewritten in B1.

### A8. The owner's local, gitignored files (tell the owner; do not commit)

`clinqetfuncations/Clinqet.Communications/local.settings.ca.json:98-99` and `local.settings.in.json:98-99` still
name the old models. The owner updates their local copies. Ask before editing any gitignored local file.

### A9. Documentation

- **Voice skill, all four copies:** `.claude/skills/clinqet-voice-assistant/SKILL.md`,
  `.github/skills/clinqet-voice-assistant/SKILL.md`, `.agents/skills/clinqet-voice-assistant/SKILL.md` and
  `.cursor/rules/clinqet-voice-assistant.mdc` (same body, own frontmatter).
  - Add a RECENT CHANGES entry for this programme.
  - Fix §7: the truncation bullet goes, and reasoning now applies to both tiers.
  - Fix §14.2: `DeploymentPremium`, the reasoning key, the truncation keys.
  - Fix the 2026-07-30b and 2026-08-11 "2.1 not SIP-listed" rules by adding a dated "superseded" note. Do not
    delete history.
- **Deployment skill, all four copies:** the model list (`.claude/skills/clinqet-deployment/SKILL.md:178`).
- **Memory:** update `realtime-model-migration-2026-09-25.md` and its `MEMORY.md` line.

---

## 6. Phase B1 — voice picker redesign (web + mobile)

The UI bar in §9 is mandatory. Web and mobile ship **together** (CLAUDE.md §0.7.1).

### B1.1 Order and default

- **Order**, in `clinqetapi/Clinqet.API/appsettings.json` `VoiceAssistant:Voices`: marin, cedar, alloy, ash,
  ballad, coral, echo, sage, shimmer, verse. The two recommended voices come first; the rest stay in their
  current order.
- **Default:** when the loaded application has **no saved voice**, pre-select the **first voice in the options
  list** on web and mobile.
  - Never override a saved voice.
  - The default comes from config order, never from a literal in UI code.
  - If the options arrive after the form mounts, apply the default once, when the voices arrive and the field
    is still empty. The same pattern as mobile's forwarding-number default at `ApplicationForm.tsx:193-209`.
- The runtime default is already `AzureRealtimeSettings.DefaultVoice = "marin"` for a line with no voice. That
  is consistent; no change.

### B1.2 Card content

Each voice is a card showing:
- the **name** (e.g. "Marin");
- a **short description** ("Warm and calm");
- a **"Recommended" badge** on marin and cedar;
- a **preview control**.

| Voice | Description (English, proposed) | Badge |
|---|---|---|
| marin | Warm and calm | Recommended |
| cedar | Relaxed and friendly | Recommended |
| alloy | Balanced and clear | — |
| ash | Deep and steady (was "calm and steady") | — |
| ballad | Warm storyteller | — |
| coral | Bright and upbeat | — |
| echo | Confident and direct | — |
| sage | Soft and light (was "gentle and reassuring") | — |
| shimmer | Energetic and crisp | — |
| verse | Expressive and lively (was "expressive and natural") | — |

- **All visible text is localized** in web `public/lang/{en-US,es-US,fr-CA,gu-IN,hi-IN}.json` and mobile
  `src/Locales/{en,es,fr,gu,hi}.json`. That covers name keys if names are shown as text, descriptions, the
  badge, the preview control's accessible names ("Play Marin's sample", "Stop"), and the language hint.
  Include new keys for the badge and states. **No emoji, no technical words** (memory:
  `feedback-no-ai-looking-icons`, `feedback-no-technical-words-in-provider-copy`).
- **Mobile must stop rendering the API's English `voice.label`** and use its own translated keys, like web.
  Whether the API `Label` is then removed is §12 F2: ask.
- **Ask the owner** to confirm the final English copy and the translations before shipping (no assumptions).

### B1.3 Preview behaviour

- **Language:** play the clip for the line's **primary language** (`values.primaryLanguage`). If none is chosen
  yet, or no clip exists for that language, play English.
- **Hint:** a small localized line near the picker says which language previews play in. With no language
  chosen, it invites the provider to pick their main language to hear it.
- **One at a time:**
  - Tapping another voice stops the current one.
  - Changing the primary language stops the current one.
  - Leaving the screen stops playback (already done on both apps).
  - On mobile, the app going to the background stops playback.
- **States:** idle → loading (until audio starts) → playing (animated, with progress) → finished or stopped. On
  error, show a localized toast or inline message; the web today fails silently and must show something.
- **Selecting** a card selects it AND plays its preview, as today. A separate play/stop control previews
  without selecting.
- **Paths:**
  - web: `/voice-samples/<lang>/<voice>.mp3`;
  - mobile: a static require map keyed `<lang>/<voice>` in `src/assets/voice-samples/index.ts`, extending
    `getVoiceSampleUri(voiceId, language)`. Keep the Android release `res/raw` handling that is already there.
- **Mobile `previewUrl`:** `voice.previewUrl` is read but the API never sends it. Leave it unless the owner
  answers §12 F3.

### B1.4 The 60 preview clips (10 voices × 6 languages)

**Rewrite `clinqetwebpartnerapp/scripts/generate-voice-samples.mjs`.** Verify every event and field name
against Microsoft's GA realtime reference. **Do not assume.**

- **Endpoint:** the GA realtime WebSocket, `wss://<resource>.openai.azure.com/openai/v1/realtime?model=<deployment>`
  with the `api-key` header (Microsoft's 2.x overview). Env vars: `CLINKET_AOAI_ENDPOINT`,
  `CLINKET_AOAI_KEY`, `CLINKET_AOAI_DEPLOYMENT` (default **`gpt-realtime-2.1`**, per the owner). **The owner
  supplies the endpoint and key. Never write a key into any file.**
- **Session:** a GA `session.update` with verbatim-reading instructions in a warm, calm, natural front-desk
  tone, the voice, and PCM16 24 kHz output.
- **Per clip:** send the script, collect the audio and the output transcript, and compare the transcript to the
  script (normalize case and punctuation).
  - Re-record up to 3 times on a mismatch.
  - After 3 failures, fail loudly with a list of the failing clips.
- **Gendered wording:** Hindi and Punjabi use the female or male script by `Azure:Realtime:VoiceGenders`
  (alloy uses the female wording). Gujarati, French, Spanish and English are the same for both genders.
- **Output:**
  - write temporary WAVs to a scratch directory, **never inside a repo**;
  - encode to mono MP3 (~64 kbps, 24 kHz);
  - loudness-normalize so all clips play at the same volume;
  - write to `clinqetwebpartnerapp/public/voice-samples/<lang>/<voice>.mp3`.
  - The script takes an output-dir argument. Copy the same files into
    `clinqetmobilepartnerapp/src/assets/voice-samples/<lang>/<voice>.mp3`. **A script in one repo must not
    write into another repo by path.**
- **Encoder: ASK THE OWNER.** ffmpeg is NOT installed on the dev machine. Either the owner installs it (e.g.
  `winget install Gyan.FFmpeg`), or the owner approves a named alternative. Do not download tools on your own.
- **Delete** the 10 old English-only `.wav` files in both apps once the new clips are wired and tested.
- **Size:** ~60–80 KB per clip, ~4–5 MB in total. The same WAVs would be ~29 MB, which is why MP3.
- **As built, correction 2026-09-27 (owner heard Marin/Cedar say "I, thanks for calling"; fix approved).** Every clip
  started speaking within 20 ms of the file start, so a player or headset waking up swallowed the first sound, and the
  "h" of "Hi" measured 0 ms on marin/cedar/alloy (10 ms echo). The harness now adds 200 ms of silence before and 150 ms
  after (not 300: a pause felt on every tap), re-records takes that begin inside a loud voiced sound, keeps the English
  take whose "h" is clearly heard, checks every take on the finished MP3, and has a second listener
  (`gpt-4o-mini-transcribe`) that flags any clip it cannot hear word for word as "needs a listen". 15 clips were
  re-recorded; the other 45 got the same silence by MP3 frame copy and decode bit-exact to the approved audio. Detail:
  skill `clinqet-voice-assistant`, "Voice samples fixed 2026-09-27". Still for a native speaker: fr/alloy and fr/coral
  "un prix", fr/sage "pour vous", pa/cedar, pa/coral, pa/echo "ਕਾਲ ਕਰਨ", and gu/coral, gu/sage, gu/verse.

**Scripts** (female wording; male changes marked). **Ask the owner to have a native speaker confirm** hi, pa,
gu, fr and es before generating:

| Lang | Script |
|---|---|
| en | Hi, thanks for calling! I'm here to help you book an appointment, check a price, or leave a message for the team. What can I do for you today? |
| fr | Bonjour, merci d'avoir appelé! Je peux vous aider à prendre rendez-vous, à connaître un prix ou à laisser un message à l'équipe. Qu'est-ce que je peux faire pour vous aujourd'hui? |
| es | ¡Hola, gracias por llamar! Puedo ayudarle a reservar una cita, consultar un precio o dejar un mensaje para el equipo. ¿En qué le puedo ayudar hoy? |
| hi | नमस्ते, कॉल करने के लिए धन्यवाद! मैं आपकी अपॉइंटमेंट बुक करने, कोई कीमत जानने, या टीम के लिए संदेश छोड़ने में मदद कर सकती हूँ। आज मैं आपकी क्या मदद कर सकती हूँ? (male: सकता, twice) |
| pa | ਸਤ ਸ੍ਰੀ ਅਕਾਲ, ਕਾਲ ਕਰਨ ਲਈ ਧੰਨਵਾਦ! ਮੈਂ ਤੁਹਾਡੀ ਅਪਾਇੰਟਮੈਂਟ ਬੁੱਕ ਕਰਨ, ਕੋਈ ਕੀਮਤ ਜਾਣਨ ਜਾਂ ਟੀਮ ਲਈ ਸੁਨੇਹਾ ਛੱਡਣ ਵਿੱਚ ਮਦਦ ਕਰ ਸਕਦੀ ਹਾਂ। ਅੱਜ ਮੈਂ ਤੁਹਾਡੀ ਕੀ ਮਦਦ ਕਰ ਸਕਦੀ ਹਾਂ? (male: ਸਕਦਾ, twice) |
| gu | નમસ્તે, ફોન કરવા બદલ આભાર! હું તમને એપોઇન્ટમેન્ટ બુક કરવામાં, કોઈ કિંમત જાણવામાં અથવા ટીમ માટે સંદેશ મૂકવામાં મદદ કરી શકું છું. આજે હું તમારી શું મદદ કરી શકું? |

### B1.5 Every state must be designed (CLAUDE.md §0.7.1)

| State | What the provider sees |
|---|---|
| Options loading | a skeleton in the card grid |
| No voices returned | the picker is hidden; save is not blocked by a missing voice (existing behaviour; keep and verify) |
| Saved voice not in the list | a legacy id. Show it as selected if it exists; if not, the default applies only when empty. Ask if unclear. |
| Preview | loading, playing, finished, error (localized) |
| Offline (mobile) | local assets play offline. No network error for previews. |
| Language without a clip | English, with the hint |
| Dark mode (mobile) | contrast rules pass (`voiceAssistantDarkContrast.test.ts`) |

---

## 7. Phase B2 — tone and pace in the prompt

The file is `clinqetinfrastructure/Services/Voice/RealtimeSessionPayloadBuilder.cs`, `BuildInstructions`. The
prompt is model-facing English; the model still replies in the caller's language.

1. **`:329-330`** (the opening sentence): replace
   *"…answering its phone professionally, warmly and CRISPLY."* with
   *"…answering its phone like a friendly, experienced receptionist: warm, calm and unhurried."*
   The rest of the sentence ("Your first job is to listen…") is unchanged.
2. **Insert a new line directly after `:383`** ("Be brief: …"):
   *"Tone and pace: speak calmly and at a relaxed, natural pace — never rushed. Let a brief, natural pause fall
   between thoughts, keep your voice friendly and steady, and match the caller's mood: gentle with a worried
   caller, upbeat with a cheerful one."*
3. Keep "Be brief" (short turns are part of sounding human on a phone) and "Sound like a real person" (pinned).
4. Search the prompt for any other wording that pushes speed or crispness, and ask before changing anything
   beyond items 1–2.
5. **Tests:** pin the new tone line on BOTH transports (SIP accept and India `session.update`), and pin that
   "CRISPLY" is gone. The existing pin `"Sound like a real person"` stays green.

---

## 8. Phase B3 — notice voice for Canada/US (Telnyx)

**Goal:** the recording notice, hold line, voicemail invite, "still connecting" and line-unavailable lines are
read by a natural voice in the line's language, of the same gender as the provider's AI voice. India (Plivo)
is unchanged.

### B3.1 Setting

A new property on `clinqetshared/Models/VoiceCallSettings.cs`. Its class default **mirrors** appsettings, the
same pattern as `SpeakLanguageMap` at `:59-65`.

```json
"SpeakVoices": {
  "en": { "Female": "Azure.en-US-Ava:DragonHDLatestNeural", "Male": "Azure.en-US-Andrew:DragonHDLatestNeural" },
  "fr": { "Female": "Azure.fr-CA-SylvieNeural",             "Male": "Azure.fr-CA-ThierryNeural" },
  "es": { "Female": "Azure.es-MX-DaliaNeural",              "Male": "Azure.es-MX-JorgeNeural" },
  "hi": { "Female": "Azure.hi-IN-SwaraNeural",              "Male": "Azure.hi-IN-MadhurNeural" }
}
```

- It goes in `clinqetfuncations/Clinqet.Communications/appsettings.json`, section `VoiceCall`, next to
  `SpeakVoice` (`:1486`).
- **An empty or missing value ⇒ today's generic `SpeakVoice`.**
- The exact HD string (with or without the `Azure.` prefix) is confirmed on a dev call before it ships (§2.9).
- The value shape (a small class with `Female`/`Male`) follows existing options-class conventions. **Ask if a
  different shape is preferred.**
- No `local.settings.json` key, so no ARM or `deploy.ps1` change. Check `deploy.ps1` does not already override
  `VoiceCall__SpeakVoice`; if it does, ask.

### B3.2 Resolver

`ResolveSpeakVoice(spokenIsoLanguage, aiVoiceId)`:
- **Gender:** `aiVoiceId` = `voiceline.Voice`, or `AzureRealtimeSettings.DefaultVoice` when empty. Look it up
  in `AzureRealtimeSettings.VoiceGenders`; "male" ⇒ Male, anything else (female, neutral, unmapped) ⇒ Female.
- **Language:** `spokenIsoLanguage` is the language AFTER `ResolveSpokenLanguage`, so gu and pa become hi. The
  voice then matches the text actually spoken.
- **Lookup:** `SpeakVoices[lang].Female` or `.Male`. Empty or missing ⇒ `SpeakVoice`.
- **Check** whether `VoiceCallControlFunction` and `VoicePostCallProcessorFunction` already receive
  `IOptions<AzureRealtimeSettings>`. If not, inject it (the Functions host binds it). Do not duplicate the
  gender map. Ask if unsure.

### B3.3 Call sites (all already hold the voiceline)

- **`VoiceCallControlFunction.cs:1749-1754` `SpeakLocalizedAsync`:** add an `aiVoiceId` parameter. Pass
  `voiceline?.Voice` from:
  - `:296` (line unavailable; the voiceline may be null ⇒ Female/generic);
  - `:344-345` (disclaimer);
  - `:743` via `SpeakProviderHoldAsync` (`:738` has the voiceline);
  - `:1283` (cap unavailable).
- **`VoiceCallControlFunction.cs:1739`** (voicemail invite; direct `SpeakAsync`): use the resolver.
- **`VoicePostCallProcessorFunction.cs:2846`** (dial reassurance): use the same resolver. It has its own
  `ResolveSpokenLanguage` and `ResolveSpeakLanguage` copies at `:2851-2860`. Put the new resolver where both
  hosts' code can share it without duplication; if unsure where, ask.

### B3.4 Safety net (mandatory)

- If `SpeakAsync` with a named voice returns `false`: log a Warning with a stable marker, then **speak the same
  text once more with the generic `SpeakVoice`**.
- The result of the second attempt feeds the existing `spoke` logic. A notice that fails to play disables
  recording and the AI for the whole call (§19), so this retry is required.
- **Check** how an *accepted* speak that later fails is handled. `DisclaimerCompletionBackstopSeconds` (15) is
  in appsettings `:1480`. Confirm by reading the code that the backstop covers it. If not, ask.

### B3.5 Cost

About $0.003 per call for the 66-character notice with an HD voice, more for the voicemail invite and the
"still connecting" line.

---

## 9. UI quality bar (mandatory)

This is the owner's instruction for this programme, and it replaces mockup approval.

1. **Extremely responsive and polished** on phone (small Android ~360 px and iPhone ~390–430 px), iPad
   (768–1024 px, portrait and landscape), laptop (1280–1440 px) and large monitor (≥1920 px).
   - No horizontal scroll, no clipped labels, no overlapping controls at any size.
   - Test each size in the browser pane and state what you tested.
2. **Modern and futuristic, but exactly on brand:**
   - the app's own theme tokens, fonts, font sizes and colours, never ad-hoc values where a token exists;
   - brand green `#97EF29` fills anything pressed or selected (`theme.brandGreen` on mobile);
   - navy `#032858` is for headings, structural labels and focus rings;
   - the "Recommended" badge must NOT use the selected-state green fill, because green means "chosen" (memory
     `brand-button-colour-mandate-2026-08-09`);
   - generous white space;
   - subtle motion: a selection transition and an animated playing indicator or progress, respecting
     reduced-motion settings.
3. **No emoji and no AI-looking icons.** Use icons from the app's existing icon set only (memory
   `feedback-no-ai-looking-icons`).
4. **Plain words.** No technical terms anywhere a provider can read (memory
   `feedback-no-technical-words-in-provider-copy`).
5. **Accessible:**
   - radio-group semantics for the voice choice (`role="radiogroup"` / `role="radio"`, `aria-checked`, arrow
     keys on web);
   - a visible navy focus ring;
   - preview controls with localized accessible names;
   - WCAG AA contrast (and dark mode on mobile);
   - touch targets at least 44×44.
6. **The mobile app must use its native power and complement the mobile design**, not copy the web:
   - haptic feedback on select and play, using the app's existing haptics helper if one exists;
   - **ask before adding any new dependency**;
   - playback stops when the app goes to the background;
   - native-feeling press states;
   - a bottom sheet or inline list, whichever fits the existing mobile form. Ask if unsure.
7. **Web and mobile ship in the same change.** All five UI languages on each. Every state in §6 B1.5.
8. **Register:** add the UI register row in §17 when done.

---

## 10. Tests

CLAUDE.md §0.8, §0.18 (a test lives in the suite of the host that runs the code), §0.17 (a test reads only
its own repo).

**`clinqetfuncations/Clinqet.Communications.UnitTests`** (the host that runs the SIP accept, the payload
builder and the Telnyx calls):

`Voice/RealtimeSessionPayloadBuilderTests.cs`:
- `:68` expects `gpt-realtime-2.1-mini`; `:79` expects `gpt-realtime-2.1` (update the comment at `:78`).
- Delete `Build_Truncation_DefaultOn_EmitsRetentionRatioShape_OnBothTransports` (`:1915-1926`) and
  `Build_Truncation_Disabled_OmitsTheField` (`:1928-1937`). Add a test that NEITHER payload ever contains
  `truncation`.
- `Build_Reasoning_PremiumTierOnly_LowercasedEffort` (`:1939-1949`) → both tiers and both transports emit
  `reasoning.effort = "low"`.
- Delete `Build_Reasoning_PremiumTierOnTheStandardModel_OmitsTheField` (`:1951-1965`); the special case is
  gone.
- Keep `Build_Reasoning_EmptySetting_OmitsTheField_EvenOnPremium` (`:1967-1974`), renamed and extended to both
  tiers.
- Update `Build_AllLeversFlippedBack_ReproducesLegacyWireShape` (`:1976-1994`): there is no truncation lever
  any more.
- B2: pin the tone line on both transports, and pin that "CRISPLY" is absent.

Other files in the same project:
- `Voice/RealtimeCostCalculatorTests.cs:49`: the "unlisted model ⇒ no estimate" example uses
  `"gpt-realtime-2.1"`. Change it to an obviously unlisted name.
- `Functions/VoicePostCallProcessorFunctionTests.cs:4885`: comment names the pricing key. Confirm the numbers
  still come from class defaults with the renamed keys.
- A test for `RealtimeCallService` 404/410/422 body logging: extend an existing test file if one exists.
- B3: resolver tests (gender, language, gu/pa ⇒ hi voice, unmapped or neutral ⇒ Female, empty ⇒ generic),
  call-site tests (the disclaimer uses the named voice), and the safety net (a refused named voice ⇒ retry
  with generic ⇒ recording still starts).

**`clinqetfuncations/Clinqet.Communications.IntegrationTests`** (MANDATORY: webhooks):
- `Tests/Functions/RealtimeCallWebhookFunctionIntegrationTests.cs`: the accept body sent to Azure has no
  `truncation`, has `reasoning.effort = "low"` on both tiers, and names the 2.1 deployments. Check how existing
  tests capture the outgoing accept; if they can't, ask.
- The Telnyx webhook path with a fake Telnyx that refuses the first speak ⇒ generic retry ⇒ the call proceeds.
- `Tests/Functions/VoicePostCallProcessorIntegrationTests.cs:479`: comment.

**`clinqetmcp/Clinqet.Mcp.UnitTests`:**
- `Monitor/PlivoVoiceRelayTests.cs:300-318`: remove `truncation` from the mocked payload and the comment. Keep
  the null-omission check for `reasoning`.
- If §12 F1 is approved: a test that India's session carries the gendered self-reference line.

**Partner web:** extend `src/components/Profile/voiceAssistant/voiceApplicationValidation.test.jsx` or add
picker tests:
- config order is kept;
- the default is pre-selected only when empty;
- the preview path is `/<lang>/<voice>.mp3` with English fallback;
- one preview at a time;
- the language hint.

Then ESLint with **zero errors**.

**Provider mobile:**
- update `__tests__/voiceSampleUri.test.ts` (per-language map, English fallback, Android `res/raw` form);
- add tests for the default and the one-at-a-time preview;
- `localeParity.test.ts` and `sourceLocalizationIntegrity.test.ts` stay green;
- `voiceAssistantDarkContrast.test.ts` stays green;
- `tsc` with zero errors.

**Never skip, disable or loosen a test to get green.** A test whose assumption changed is rewritten to the new
truth.

---

## 11. Dev-call verification

The owner places the calls after deploy. Prepare the checklist and read the logs.

| # | Check | Expected |
|---|---|---|
| 1 | Canada/US Standard and Advanced calls, and India Standard and Advanced calls | Azure accepts (no 400/410/422 in logs). India shows no `error` after the setup. The greeting plays. |
| 2 | 2.1 accepts our settings | `semantic_vad`, `far_field` noise reduction and `reasoning` are all accepted |
| 3 | Tools | booking, catalogue lookup (large-catalogue line), send details or a quote. **Watch Standard**: community reports say 2.1-mini sometimes skips tool calls. |
| 4 | Call handling | provider join by phone and browser; join miss ⇒ the assistant resumes |
| 5 | Interruptions and noise | caller barge-in, a noisy background, silence and the idle prompt, goodbye ⇒ hang-up |
| 6 | Languages | English, French, Hindi, Gujarati |
| 7 | Long call | one call over 20 minutes: no errors, sensible memory of the start of the call |
| 8 | Tone | the same scripted test call, recorded on the new build: calm, unhurried |
| 9 | Notice voice | a marin line gets a female notice and a cedar line a male one, in the line's language. Temporarily setting a bad voice name in dev ⇒ generic voice, and the call still records and reaches the AI. |
| 10 | Cost and speed | per-call telemetry (`RealtimeUsage`, `costMeta.RealtimeEstimatedCost`, `answer_ms`) against §2.4 |
| 11 | Picker | on a phone, an iPad and a laptop (web) and on iOS and Android (app): order, default, labels in all five UI languages, previews per call language, states |

---

## 12. Found while planning — OWNER DECISION NEEDED (not approved)

**Ask the owner about each item. Do nothing until the owner answers.**

| # | Finding | Recommendation |
|---|---|---|
| F1 | The MCP host has no `Azure:Realtime:VoiceGenders` (§2.10). India prompts tell the AI to avoid gendered self-reference, and Hindi/Punjabi verbs are gendered. | Add the same map to `clinqetmcp/Clinqet.Mcp/appsettings.json` (config only), plus a relay test. Recommended. |
| F2 | After mobile switches to translated keys, the API's `VoiceAssistant:Voices[].Label` and `VoiceOptionDto.Label` may be unused. First check the admin app (`clinqetwebadmin`) and everything else that reads it. | If truly unused, remove it (CLAUDE.md §22.2: no dead config). Owner to decide. |
| F3 | Mobile reads `voice.previewUrl`, but the API never sends it. | Leave it, or remove it as dead code. Owner to decide. |
| F4 | `gpt-realtime-mini` 2025-12-15 appears twice on the retirement page with two dates. | Informational: after this plan nothing uses it. |

---

## 13. Execution order, build protocol, git and clean-tree rules

**Order:**
1. Read CLAUDE.md fully, then these skills: `clinqet-voice-assistant` (at least §6–§11, §14, §21 and the recent
   changes), `clinqet-deployment`, `clinqet-infrastructure`, `clinqet-function-app`, `clinqet-partner-app`,
   `clinqet-provider-mobile`, `clinqet-ui-common`, `clinqet-testing`. Then every file this plan names, end to
   end.
2. **Ask the owner, in one message:**
   - A0 confirmation;
   - §12 F1–F3;
   - the MP3 encoder (B1.4);
   - native-speaker confirmation of the scripts (B1.4);
   - final label copy (B1.2);
   - whether a Canada/US dev line exists per tier for §11.
3. Phase A (§5). Then B2 (§7). Then B3 (§8).
4. B1 (§6): picker code on web and mobile, then the clips (needs the owner's endpoint and key as env vars, and
   the encoder).
5. **Build and test, batched once at the end.** Other AI sessions share `C:\Nik` and its `obj/` and `bin/`
   (memory `feedback-never-build-while-another-session-works`). Check `ListAgents` for busy sessions and **ask
   the owner for an exclusive build window**. Never leave code that has not compiled. Never trust a
   `--no-build` run.
6. ESLint on the partner web app (zero errors); mobile `tsc` and jest.
7. Skills (4 copies) and memory (§5 A9).
8. Clean tree: see the git rules below.
9. Report (§15), with evidence.

**Git (zero tolerance):**
- Never run `git checkout --`, `restore`, `reset`, `stash` or `clean` (CLAUDE.md §0.19).
- Never `git pull` or merge. History is linear (§0.21).
- Commit or push **only if the owner asks**.

**Clean tree (§0.16):**
- scratch files only in the session scratchpad, never in a repo;
- delete every scratch file you made, including temporary WAVs and scripts;
- `git status --porcelain` in each repo you touched, and look at it;
- say in the report what you removed.

**Other sessions' uncommitted work:** at planning time, `clinqetshared`, `clinqetinfrastructure` and
`clinqetcore` had uncommitted billing edits from another session (`MinuteLedgerEntryType.cs`,
`BillingModelConfiguration.cs`, `BillingTransaction.cs`, `MinuteLedger.cs`, `BillingFailureCodes.cs`). Never
touch or revert other sessions' files.

---

## 14. Rollback

- **Models:** fix forward. The old deployments are gone and `gpt-realtime-2` is retiring. The emergency option
  is `gpt-realtime-1.5` (GA, SIP-listed, retires 2027-08-24): the owner creates it in Foundry, and the two
  `Azure__Realtime__Deployment*` app settings are switched. ⚠ 1.5 predates configurable reasoning. If it is ever
  needed, `ReasoningEffort` must be set empty, or Azure may reject the call.
- **Notice voice:** set the `SpeakVoices` values to empty in the app settings ⇒ every notice uses the generic
  voice.
- **Prompt, picker, clips:** code revert. The old clips remain in git history.

---

## 15. Definition of done

Report to the owner, with evidence:
- the files changed per repo;
- test counts per project (before and after), and that no test was skipped, disabled or loosened;
- ESLint, `tsc` and jest results;
- screenshots of the picker at phone, iPad and laptop widths (web), and on the mobile app, including dark mode;
- the §11 checklist ready for the owner's calls;
- skills and memory updated;
- a clean `git status` in every repo touched, and what scratch files were deleted;
- the §12 answers and what was done with them;
- anything that did not match this plan and how it was resolved (with the owner's answer).

---

## 16. Decision register

| Date | Decision | By |
|---|---|---|
| 2026-07-01 | Gujarati waived as a hard requirement; Hindi is the India language bar | owner |
| 2026-07-30 | Advanced → `gpt-realtime-2` (2.1 not SIP-listed then) | owner |
| 2026-08-11 | D5: 2.1 "fails on SIP" (live probe). Superseded 2026-09-25: confounded by `truncation` (§2.2) | owner / planning |
| 2026-09-25 | D1–D8 of this plan | owner |
| 2026-09-25 | Mockup approval waived for this programme; the §9 bar is mandatory instead | owner |
| 2026-09-25 | Plan approved for implementation, §12 excepted | owner |

## 17. UI register (§0.20)

| Screen | Path | Sheet | Approval | Governs |
|---|---|---|---|---|
| Voice picker (AI assistant setup), partner web + provider mobile | web `src/components/Profile/voiceAssistant/VoiceApplicationForm.jsx`; mobile `src/Screen/ProfileFlow/VoiceAssistant/ApplicationForm.tsx` | none: built without a mockup | owner waiver 2026-09-25 (the §9 bar applies). **Superseded 2026-09-25 by the next row**: the owner asked, in the implementing session, to see a mockup first | order, default, labels, per-language previews, states |
| Voice picker — Recommended as a group heading | same two files | no new sheet (change to `voice-picker`) | ✅ **OWNER-APPROVED 2026-09-26 without a drawing** (owner, in conversation) | supersedes the per-card badge only: a "Recommended" heading leads the group (web + app sheet), web recommended cards side by side from ~500 px; the app keeps the badge on the chosen-voice card |
| Voice picker (AI assistant setup), partner web + provider mobile | same two files | `C:\Nik\Data\mockups\voice-picker\index.html` (drawn 2026-09-25) | ✅ **APPROVED AS DRAWN 2026-09-25** (owner, in conversation) | order and default from the server list, the server's `recommended` flag and badge, the web card grid at every width, the app's voice row + bottom sheet, every state (loading, playing, finished, could not play, the three language lines, a voice no longer offered, no voices), dark mode, accessibility, and the five-language copy table |

Add a row for any other screen this programme changes.

## 18. Sources

- Azure realtime SIP (supported models): https://learn.microsoft.com/en-us/azure/foundry/openai/how-to/realtime-audio-sip
- GPT Realtime 2.x overview (truncation limitation, reasoning values, context): https://learn.microsoft.com/en-us/azure/foundry/openai/concepts/realtime-2
- Model retirement schedule: https://learn.microsoft.com/en-us/azure/foundry/openai/concepts/model-retirement-schedule
- Model lifecycle policy: https://learn.microsoft.com/en-us/azure/foundry/openai/concepts/model-retirements
- Region availability: https://learn.microsoft.com/en-us/azure/foundry/foundry-models/concepts/models-sold-directly-by-azure-region-availability?pivots=standard
- Docs history (2.1 GA commit, 2026-09-23): https://github.com/MicrosoftDocs/azure-ai-docs/commits/main/articles/foundry/openai/how-to/realtime-audio-sip.md
- Azure Retail Prices API: https://prices.azure.com/api/retail/prices
- OpenAI realtime costs (audio tokens per second, caching): https://developers.openai.com/api/docs/guides/realtime-costs
- OpenAI text-to-speech (marin/cedar recommendation): https://developers.openai.com/api/docs/guides/text-to-speech
- OpenAI realtime prompting guide: https://developers.openai.com/cookbook/examples/realtime_prompting_guide
- OpenAI 2.1 announcement and community reports: https://community.openai.com/t/new-realtime-models-on-the-api-gpt-realtime-2-1-and-gpt-realtime-2-1-mini/1385896
- Azure Voice Live overview, FAQ, how-to, telephony: https://learn.microsoft.com/en-us/azure/ai-services/speech-service/voice-live ·
  https://learn.microsoft.com/en-us/azure/ai-services/speech-service/voice-live-faq ·
  https://learn.microsoft.com/en-us/azure/ai-services/speech-service/voice-live-how-to ·
  https://learn.microsoft.com/en-us/azure/ai-services/speech-service/voice-live-telephony
- Azure HD voices: https://learn.microsoft.com/en-us/azure/ai-services/speech-service/high-definition-voices
- Azure voice list: https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support?tabs=tts
- Gemini pricing and Live API: https://ai.google.dev/gemini-api/docs/pricing · https://ai.google.dev/gemini-api/docs/live-api/capabilities
- Google Cloud Live billing rules: https://cloud.google.com/gemini-enterprise-agent-platform/generative-ai/pricing
- Telnyx TTS voices: https://developers.telnyx.com/docs/voice/programmable-voice/tts
- Telnyx media streaming: https://developers.telnyx.com/docs/voice/programmable-voice/media-streaming
- Telnyx pricing: https://telnyx.com/pricing/call-control
