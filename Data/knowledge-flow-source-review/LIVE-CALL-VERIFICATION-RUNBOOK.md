# Live-call verification — the two per-call send allowances (#19 + the cap split)

> ‼️ **Run this only AFTER the code is deployed.** The reserve/promote/release fix and the cap split live in
> `clinqetshared` (`VoiceSendSlot`) and `clinqetmcp` (`KnowledgeTools`, `ServiceInfoTools`,
> `VoiceSendSlotWriter`). A call placed before the deploy exercises the OLD code and tells you nothing —
> and can easily *look* like a pass, because two sequential tool calls often do not race.
>
> **Deploy order matters:** `clinqetshared` / `clinqetcore` / `clinqetinfrastructure` first, then the hosts
> (`clinqetmcp`, `clinqetfuncations`, `clinqetapi`).

## What is being proven

Two separate things that unit tests can only prove against a fake:

1. **The cap holds under a real race**, using real Cosmos ETag optimistic concurrency rather than an
   in-memory lock. The unit guard uses `FakeSessionStore` + `StaleReadGate`, which models serialised CAS
   correctly but is still a fake.
2. **The two allowances are independent** — sending material no longer spends the page-link allowance.
   This is the defect: two settings existed, but one counter counted both kinds.

## Setup (once)

| | |
|---|---|
| Provider business | any dev business with **≥2 Ready documents that are switched on for callers** (`shareWithCallers`) **and ≥1 approved, active service** |
| Number to dial | that business's Clinket number |
| Caller | a phone you control — the AI replies to the number you are calling from |
| Settings in force | `Voice:Knowledge:MaxMaterialSendsPerCall` (2) · `Voice:Sharing:MaxSharesPerCall` (2) · `MaterialSharingEnabled = true` · WhatsApp DOCUMENT template approved, or the AI will offer email instead |

‼️ **This test sends real WhatsApp/email to the number you dial from.** Expect up to 3 messages.

## The call

Let the AI take over (do not answer as the provider), then:

1. Ask something the documents answer — *"what's your cancellation policy?"*
2. **"Can you send me that?"** → confirm WhatsApp (or email, and read the address back). **Send 1.**
3. Ask a different documented thing — *"what are your opening hours?"*
4. **"Send me that one too."** → **Send 2.** The material allowance is now spent.
5. Ask about a specific service — *"how much is a keratin treatment?"*
6. **"Can you send me the page for that?"** → **Send 3, the page link.**

**Step 6 is the whole test.** Before the fix, sends 1 and 2 had already consumed the page-link allowance,
so the AI would refuse here and tell you it had already sent as much as the call allows.

### Pass / fail

| Step 6 | Verdict |
|---|---|
| The link arrives | ✅ the allowances are independent |
| The AI says it has already sent as much as this call allows | ❌ the counters are still shared — tell me |

Then a second call, to prove the caps still *hold*: ask for **three** pieces of material. The third must be
refused ("already sent as much as this call allows"). A cap that never refuses is the other way to get
this wrong.

## What I verify afterwards (give me the call id, or just the time and the number dialled)

I read the `VoiceCallSession` document straight out of Cosmos and check:

- exactly **2** markers with `kind = "material"` and **1** with `kind = "page"`;
- **no marker still carrying `state = "reserving"`** — every reservation was promoted, so nothing leaked;
- `sendsMade = 3`;
- the provider's **Call Follow-ups** card shows 3 entries and no blank one.

A leftover `state = "reserving"` marker means a send failed and its slot was released late or not at all —
that is the one failure mode the unit tests cannot fully reach.

## The gap this does NOT close

Even a passing call does not prove the **concurrent** case, because a phone conversation is sequential:
the model asks for one send, waits, then asks for the next. The race the fix exists for needs two
overlapping tool calls, which is why the unit guard forces the interleaving with `StaleReadGate`
(read-before-gate + a detached copy) and why it is swept over three cap values and run three times.

**The honest remaining strengthening** is an integration test that drives reserve → send → promote through
the REAL `VoiceCallSessionRepository` against a real Cosmos endpoint, so the ETag retry loop is the thing
under test rather than a lock. That needs no phone call and no messages to anybody.
