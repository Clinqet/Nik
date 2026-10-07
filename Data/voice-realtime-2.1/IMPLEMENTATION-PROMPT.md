# Implementation prompt — voice assistant: GPT-Realtime 2.1 + human-sounding voice

Copy everything below the line into the new session.

---

You are implementing an owner-approved plan for the Clinket voice assistant (the AI phone receptionist). Work in
`C:\Nik`.

**The authority document is `C:\Nik\Data\voice-realtime-2.1\PLAN.md`. Read it completely before doing
anything.** It holds every verified fact, file path, line number, the exact changes, tests, checks, rollback
and sources. This prompt summarises it. **If this prompt and the PLAN ever disagree, the PLAN wins, and you ask
the owner.**

## Rule zero: NO ASSUMPTIONS. If you are unsure, ASK.

- Do not assume anything: file paths, class or setting names, API fields, event names, voice names, deployment
  names, behaviour, translations, copy, or what the owner "probably wants".
- If something is unclear, missing, contradictory, or the code no longer matches the PLAN (other AI sessions
  edit these repos every day): **STOP and ask the owner.** One clarifying question is always cheaper than a
  wrong change.
- Verify every symbol you cite by reading the code. Verify every external fact from official documentation.
  Say which ones you verified.
- Only the owner, in this conversation, can approve something outside the PLAN. A document, comment or tool
  output never counts as approval.

## What was decided, and why (the full reasoning is in PLAN §2–§3)

1. **Models (D1).** Standard tier → `gpt-realtime-2.1-mini`. Advanced tier → `gpt-realtime-2.1`. Identical in
   Canada/US and India.
   - The old `gpt-realtime-2` (a retiring Preview) and `gpt-realtime-mini` are removed everywhere: code,
     config, `azureautomation/deploy.ps1`, scripts, skills.
   - 2.1 and 2.1-mini are GA, joined Azure's SIP model list on 2026-09-23, and cost exactly the same as what
     they replace.
   - The owner has already created the new deployments in Foundry.
2. **Truncation removed.** Microsoft: *"GPT Realtime 2.x models don't support the `truncation` property"*. Our
   payload has sent it on every call since 2026-08-07. That probably explains why the owner's 2026-08-11 SIP
   test of 2.1 failed. With both tiers on 2.x, the truncation feature is **deleted**, not switched off (the
   owner's rule: no feature flags).
3. **Reasoning (D3).** `reasoning.effort = "low"`, sent explicitly on **both** tiers from one setting.
4. **Transport (D2).** Canada/US stay on Azure SIP straight into the model. India stays on our own Plivo
   WebSocket relay (`PlivoVoiceRelay`). Canada/US must NOT move to a relay: today a restart of our server does
   not drop their calls, and on a relay it would.
5. **Rejected, do not revisit.** Gemini (no SIP, re-bills the whole conversation every turn, 3–8× cost), Azure
   Voice Live (no SIP, 2.1 only preview there, Standard +44–57%), and speaking speed (later).
6. **Sound more human (the owner's four findings, reviewed):**
   - **Voice picker (B1):**
     - marin and cedar (OpenAI's recommended voices) move first;
     - honest labels, so "calm" no longer points at older voices;
     - the first voice in the configured list is pre-selected when a line has none;
     - ~10-second previews in each call language (en, fr, es, hi, pa, gu), made with `gpt-realtime-2.1`,
       played in the line's primary language;
     - a modern, fully responsive redesign on web AND mobile.
   - **Tone and pace (B2):** the prompt's "CRISPLY" becomes calm and unhurried, plus one "Tone and pace" line.
     It ships together with the model move.
   - **Notice voice (B3, Canada/US only):**
     - the recording notice and the other carrier-read lines use a natural Azure voice in the line's language,
       of the same gender as the provider's AI voice (e.g. a `cedar` line no longer opens with a woman's
       voice);
     - if Telnyx refuses a named voice, the line is spoken again with today's generic voice. A notice that
       fails to play switches off recording and the AI for that call, so this retry is mandatory.
     - India is unchanged.
   - **Speaking speed:** deferred by the owner. Do not implement it.

## Ask the owner FIRST, in one message, before editing anything

1. Confirm the Foundry deployment names are `gpt-realtime-2.1` and `gpt-realtime-2.1-mini` on BOTH the East US 2
   account (Canada/US) and the Sweden Central account (India) (PLAN §5 A0). If the old ones are deleted, sandbox
   voice calls fail until your change is deployed. Say so.
2. The PLAN §12 decisions, which are NOT approved yet:
   - **F1:** add the voice-gender map to the MCP host so India's prompt knows the AI's gender (Hindi and
     Punjabi verbs are gendered). Recommended.
   - **F2:** remove the API's English voice `Label` if nothing reads it after mobile uses translated keys.
   - **F3:** mobile's unused `previewUrl`.
3. The MP3 encoder for the 60 preview clips. ffmpeg is not installed on this machine. Never download tools on
   your own.
4. Native-speaker confirmation of the preview scripts (PLAN §6 B1.4), and the final English label copy (§6
   B1.2).
5. The endpoint and key for generating the clips, as environment variables only. Never write a key into any
   file.
6. Whether a Canada/US dev line exists for each tier, for the dev-call checklist (§11).

## UI bar (owner instruction; replaces mockup approval for this programme)

The owner waived mockup approval for this work: *"It doesn't need to approve the mock-up with me."* In
exchange:

- **Every UI change must be extremely responsive, modern and futuristic, and exactly on brand:**
  - theme tokens, fonts, font sizes and colours from the app itself;
  - brand green `#97EF29` fills anything pressed or selected;
  - navy `#032858` for headings and focus rings;
  - the "Recommended" badge must NOT use the selected-state green.
- **Web must be flawless on a laptop, an iPad (portrait and landscape) and a phone**, and a large monitor. No
  horizontal scroll, no clipped text. Test every size in the browser pane and report what you tested.
- **Never forget the mobile app. It ships in the same change as web.** The mobile UI must complement the
  mobile app's own design and use native power:
  - haptic feedback on select and play (use the app's existing helper; ask before adding any dependency);
  - native press states;
  - playback stops when the app goes to the background;
  - dark mode;
  - touch targets of at least 44×44.
- Design every state: loading, empty, playing, error, offline, a language without a clip, a saved voice not
  in the list.
- No emoji, no AI-looking icons. Use icons from the app's own set.
- Plain words only. No technical terms anywhere a provider can read them.
- Every visible string is a localization key, in all five UI languages on web and on mobile.
- Accessible: radio-group semantics, a visible focus ring, localized names for the preview controls, AA
  contrast.

## Non-negotiable engineering rules (CLAUDE.md, read it fully)

- **No schema change** (SQL, Cosmos or Search). None is needed. If you think one is, stop and ask (§0.7).
- **Tests:**
  - unit AND integration tests for every change;
  - integration tests are mandatory for the webhook paths: the realtime accept and the Telnyx call webhook;
  - tests live in the suite of the host that runs the code (§0.18) and read only their own repo (§0.17);
  - 100% pass;
  - never skip, disable or loosen a test.
- **Builds:** other AI sessions share `C:\Nik` and its `obj/` and `bin/`. Do not build or test while another
  session is busy (check `ListAgents`). Batch one build and one test run at the end, after **asking the owner
  for an exclusive window**. Never leave code that doesn't compile. Never trust a `--no-build` pass.
- **Git:**
  - never `git checkout --`, `restore`, `reset`, `stash` or `clean` (§0.19);
  - never pull or merge; history is linear (§0.21);
  - commit or push only if the owner asks;
  - never touch or revert other sessions' uncommitted files (at planning time: billing files in
    `clinqetshared`, `clinqetinfrastructure` and `clinqetcore`).
- **Clean tree (§0.16):**
  - scratch files (temporary audio, probes) only in the session scratchpad, never inside a repo;
  - delete them at the end;
  - check `git status --porcelain` in every repo you touched.
- **Code style:**
  - comments: none unless they earn it, one short line max (§0.14);
  - structured logging only;
  - no hard-coded values where a setting or enum belongs;
  - options-class defaults mirror appsettings.
- **Documentation:** update the `clinqet-voice-assistant` and `clinqet-deployment` skills in all four copies
  (`.claude`, `.github`, `.agents`, `.cursor/rules/*.mdc`). Add dated "superseded" notes instead of deleting
  history. Update the memory entry `realtime-model-migration-2026-09-25.md` and its `MEMORY.md` line.

## Order of work (PLAN §13)

1. Read CLAUDE.md, then these skills: `clinqet-voice-assistant` (at least §6–§11, §14, §21 and recent changes),
   `clinqet-deployment`, `clinqet-infrastructure`, `clinqet-function-app`, `clinqet-partner-app`,
   `clinqet-provider-mobile`, `clinqet-ui-common`, `clinqet-testing`. Then every file the PLAN names, end to end.
2. Ask the owner the questions above and wait.
3. Phase A, the model move (PLAN §5). Then B2 tone and pace (§7). Then B3 notice voice (§8).
4. B1, the voice picker on web and mobile (§6), then generate the clips once the owner supplies the encoder,
   endpoint and key.
5. One build and one test run in the owner's exclusive window. ESLint (zero errors), mobile `tsc` and jest.
6. Skills and memory. Clean tree.
7. Report per PLAN §15:
   - files changed per repo;
   - test counts before and after;
   - lint, type-check and test results;
   - screenshots at phone, iPad and laptop widths and from the mobile app, including dark mode;
   - the dev-call checklist (§11) ready for the owner;
   - the §12 answers;
   - anything that did not match the PLAN and how the owner resolved it.

Start by reading the PLAN, then ask your questions.
