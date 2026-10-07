# KEEP YOUR OWN NUMBER — architecture review and solution design

**Status:** analysis only. No code written, no schema proposed for approval yet, no carrier account touched.
**Date:** 2026-09-14. **Companion:** [RESEARCH.md](RESEARCH.md) (evidence + 28 external sources).
**This document is the authority for the programme.** RESEARCH.md is its evidence base; where the two
disagree, this file wins and must say on which point.

---

## 0. VERDICT

**Yes. And the runtime is already built.**

The thing Equal does — caller dials the provider's own number, provider misses it, AI answers — is
**conditional call forwarding performed by the provider's own mobile carrier**. Clinket never touches the
provider's line. The carrier hands us a second, ordinary inbound call on a number we own. From that instant
onward it is a call exactly like every call Clinket already answers today.

The mode that answers such a call already exists and is live: **`VoiceHoursMode.AiFirst`** — "no ring, no
ringback, no miss branch — the AI takes the call the moment the disclaimer ends"
([VoiceCallControlFunction.cs:549](../../clinqetfuncations/Clinqet.Communications/Functions/VoiceCallControlFunction.cs#L549)).

The carrier does the ring-and-miss. `AiFirst` does the answering. **They compose.**

| Question | Answer |
|---|---|
| Is the mechanism real and legal? | Yes — it is a standard GSM supplementary service the subscriber activates themselves |
| Do we need a deal with Rogers / Bell / Airtel / Jio? | **No.** The provider authorises it on their own line |
| Do we need to change the AI, MCP, knowledge or booking stack? | **No.** Nothing downstream of call answer changes |
| Does the provider need a second phone or SIM? | No. They need a **hidden** Clinket DID as the forwarding destination — never published, never dialled by a customer |
| Is it possible "with what we have now"? | **The call-handling runtime, yes — verbatim.** The onboarding that activates it does not exist |
| ✅ **Has it been proven on a real line?** | ‼️ **YES — 2026-09-14/15, a live Canadian iPhone.** A missed call on the owner's own number reached the Clinket assistant. **The mechanism is no longer theory.** §13.0, §15 |
| What made it work? | ‼️ **A short ring timer.** The carrier default loses to voicemail; at 10 s forwarding wins. **Canada is self-serve — no carrier call, no unsubscribing voicemail** |
| What is the single most dangerous defect? | A dial back into the forwarding line. One method causes it. §5 |
| ‼️ What is the biggest *silent* risk? | **"Silence Unknown Callers"** — it bypasses forwarding, and **new customers are exactly the unknown numbers it blocks**. It fails invisibly because providers test with their own contacts. §9.7, §15 |

**The honest headline: the runtime is ~1 method away; the product is an onboarding programme.** The
engineering is small and the setup experience is the whole job — and it is materially harder in Canada than
in India, which is the opposite of what copying Equal would suggest. §8.

### 0.1 GLOSSARY — what a "DID" is, and where ours live

**DID = Direct Inward Dialing.** The telecom term for a phone number that terminates in *software* instead
of on a physical phone line. The name is historical: one trunk carrying many numbers, each ringing a
specific extension "directly inward" without an operator.

**In Clinket, a DID is exactly the dedicated Clinket number an admin assigns to a provider.** Same thing,
industry name. It is `Voiceline.E164` — the Cosmos doc `voiceline_{e164}` in `SystemData`, point-read on
every `call.initiated`.

‼️ **There is no "the DID" in appsettings, and there cannot be — it is one number per provider.** What
appsettings holds is the *application* that every DID routes into:

| Setting | Value | What it actually is |
|---|---|---|
| `Telnyx:CallControlApplicationId` | `2981089789136078834` | The Telnyx Call Control app every CA/US voice DID is pointed at. Webhooks land on `VoiceCallControlFunction` |
| `Plivo:ApplicationId` | `20607094856854474` | The India equivalent. Webhooks land on `PlivoVoiceCallControlFunction` |
| `Telnyx:WebRtc:CredentialConnectionId` | `2978004926459807198` | Browser/in-app join credentials — **not** a phone number |
| `Telnyx:TransactionalFromNumber` | `+18449254651` | ‼️ **SMS sender, NOT a voice DID.** Do not test voice against it |
| `Voice:Carrier` | `telnyx` | Which carrier seam this stamp runs |

**To get a real DID for the sandbox test:** open the business's AI-assistant page in the admin portal and
read its assigned number, or read `Voiceline.E164` from Cosmos. It is per-business, assigned by admin (§7),
and never a config value.

**In own-number mode the DID still exists — it is simply never published.** That single fact is also what
gives us free health monitoring (§10.2).

---

## 1. WHAT EQUAL ACTUALLY DOES — and how confident we are

Equal AI (Equal Identity Private Limited, India; ~5M+ Play installs; US$30m Series B via Prosus Ventures)
ships a **consumer** call assistant on iOS and Android in 9+ Indian languages.

| Claim | Confidence | Basis |
|---|---|---|
| It uses **carrier call forwarding** | **Confirmed** | Equal's own setup help states forwarding is "operated by your network provider", and warns forwarding **persists after account deletion** — only a carrier-side rule behaves that way |
| The "three calls" were **three conditional-forwarding commands** (no-answer / busy / unreachable) | **High-confidence inference** | Matches the three GSM conditions exactly; matches Equal's troubleshooting vocabulary ("call forwarding failed", "select the SIM", "reset network settings"); Google's own AT&T instructions for Voice use the same three-command sequence. The literal dial strings from the owner's setup were not recorded |
| It needs a **reachable inbound destination** | **Confirmed by mechanism** | Number-to-number forwarding cannot terminate on nothing |
| It rents **one DID per subscriber** vs a shared pool | **Unknown** | Not disclosed. Do not design on an assumption here |
| Its telephony vendor | **Unknown** | No attribution established. Its privacy policy names AI processors (Ultravox/Fixie, Sarvam, Gemini, ElevenLabs) but no carrier |
| "AI takes over within a second" | **Not established** | No-answer forwarding must first burn the carrier's ring timer. A *decline* is fast; a *miss* is not. §3.1 |

**What Equal is not.** Nothing public shows MCP tools, bookings, a knowledge base, or provider-business
context. That is Clinket's moat and none of it is at risk here. But absence of public documentation is not
proof of absence — do not put "they can't do bookings" in a pitch deck.

---

## 2. THE MECHANISM, PRECISELY

```
Customer dials the provider's OWN published number
        │
        ▼
Provider's carrier rings the provider's own phone          ← Clinket is not involved, sees nothing
        │
        ├── provider answers ──────────────► normal private call. Clinket never sees it. No transcript.
        │
        └── no answer / busy / declined / unreachable
                    │
                    ▼  carrier applies the rule the PROVIDER saved
        Carrier places a NEW inbound call to the hidden Clinket DID
                    │
                    ▼
        Telnyx (CA/US) or Plivo (IN) → existing webhook → Voiceline point-read
                    │
                    ▼
        HoursMode = AiFirst  →  disclaimer  →  AI answers  →  MCP, bookings, knowledge, summary
                                                              ── all unchanged ──
```

### 2.1 ‼️ IT IS ONE CALL, NOT THREE — and removal is one call too

Equal's three-call setup is **not the minimum**. On every GSM carrier in Canada and on AT&T/T-Mobile,
`*004*` sets **all three conditional rules in a single dial**, and `##004#` clears all three in a single
dial. We can ship a one-tap setup and a one-tap removal where Equal ships three.

| Market / carrier | **Turn ON — one call** | **Turn OFF — one call** | Individual rules (fallback if `*004*` is rejected) |
|---|---|---|---|
| **Canada** — Rogers, Fido, Bell, Telus, Freedom | `*004*<DID>#` | `##004#` | `*61*` no answer · `*67*` busy · `*62*` unreachable |
| **US** — AT&T, T-Mobile (GSM) | `**004*<DID>#` | `##004#` | `**61*` · `**67*` · `**62*` |
| ‼️ **US — Verizon, US Cellular** (CDMA family) | `*71<DID>` — **different syntax, no `#`, no `*004*`** | `*73` | No separate *unreachable* rule exists |
| **India** — Airtel, Jio, Vi | `*004*<DID>#` | `##004#` | `*61*` · `*67*` · `*62*` |
| Universal GSM clear-everything | — | `##002#` | clears unconditional forwarding too |

**Design rule: try the one-call code first, fall back to the three.** Some plans and MVNOs reject `*004*`
while accepting the individual rules. The UI must offer both, and must never present three steps to a
carrier that only needs one.

#### The prefix grammar — whoever writes the UI copy needs this

GSM prefixes are not decoration; each one means a different operation:

| Prefix | Means | Example |
|---|---|---|
| `**` | ‼️ **Register AND activate** — sets the destination. **No prior step is ever needed** | `**61*<DID>**5#` |
| `*` | Activate (supplying a number also registers it on most networks) | `*004*<DID>#` |
| `#` | Deactivate, **keeping** the stored destination | `#004#` |
| `##` | ‼️ **Erase** — removes the destination entirely; re-registering is required | `##004#`, `##002#` |
| `*#` | Interrogate — read back what is stored. Changes nothing | `*#61#` |

**Practical consequence:** after `##002#` or `##004#` the rules are *gone*, not merely off. The next
setup dial must be a `**`/`*` form carrying the destination — which it always is, so nothing extra is
needed. And a `**61*` dial **never** requires `*004*` to have been run first.

#### ‼️ WHAT EACH CONDITION ACTUALLY COVERS — and the trap in `61`

**`004` is not a condition.** It is shorthand that writes the same destination into `61`, `67` and `62` in
one dial. The real rules are:

| Code | Condition | Fires when | Timer? |
|---|---|---|---|
| **`61`** | **No Reply** | The phone rings and **nobody picks up** until the timer expires | ✅ **Only this one has a timer** (5–30 s) |
| **`67`** | **Busy** | The line is busy — ‼️ **and this is where DECLINING/cutting the call normally lands** | ❌ fires at once |
| **`62`** | **Not Reachable** | Phone off, flight mode, no signal | ❌ fires at once |
| `21` | **Unconditional** | Every call, before the phone rings at all | ❌ — overrides all three |

‼️ **THE TRAP: `61` alone does NOT cover a declined call.** Pressing decline normally reports *user busy*
to the network, which applies **`67`**. A line with only `61` registered sends a declined call to
**voicemail**, not to us — which looks exactly like a broken setup.

**So every real setup needs all three**, and any test must state which condition it is exercising:
*let it ring* tests `61`; *decline* tests `67`; *flight mode* tests `62`. A pass on one proves nothing
about the others (§10).

**Decline behaviour is not perfectly uniform** — most handsets/networks map decline to *busy*, but some
send a plain reject that takes the network's default treatment instead. It must be tested per carrier, not
assumed.

##### ‼️❌ CONFIRMED LIMITATION — iPHONE DECLINE BYPASSES THE BUSY RULE (Canadian iPhone, 2026-09-14)

```
*#67#  →  Voice Call Forwarding · When Busy · Forwards to 2364767193 · ENABLED
          then tapped the red decline button  →  ❌ VOICEMAIL, not the AI
```

**The rule is registered, enabled, pointing at the right number — and declining never invokes it.** `67`
carries no timer, so had decline raised *busy* it would have fired instantly. It did not.

**Conclusion: tapping decline on an iPhone does not signal "user busy" to the network.** It sends a plain
reject that takes the network's default treatment — voicemail — and never consults the subscriber's rule.

‼️ **No dial code can fix this.** The rule is already correct. Do not spend engineering time looking for one.

##### ‼️ And `67` barely fires on a mobile anyway — call waiting means the line is never "busy"

With call waiting enabled (the default on every modern mobile plan), a second call presents as *call
waiting*, not as a busy line. **So the busy condition rarely occurs at all on a mobile.**

**Set `67` anyway** — it costs one dial and covers the genuinely-busy case on lines with call waiting off —
but **do not count on it.** In practice own-number mode runs on **`61` (no answer)** and **`62`
(unreachable)**. `61` is the workhorse; everything else is an edge case.

‼️ **And there is a clean workaround that needs no code**, and on iPhone it is a single precise instruction:

| What the provider does | What the network sees | Result |
|---|---|---|
| **Side button ONCE** — silences the ringer | the call keeps ringing normally | ✅ hits the no-answer rule at 10 s → **AI** |
| Side button **twice**, or tapping the red Decline button | decline | ❌ straight to voicemail (if the limitation confirms) |
| Ignore it entirely | rings out | ✅ **AI** |

**"Press once to silence. Never twice."** Same outcome, same speed, no extra taps — and it is a sentence a
provider can actually remember. It belongs in the setup screen copy, in plain words (§0.7.1).

‼️ **THIS WORKAROUND IS ITSELF UNPROVEN AND IS THE NEXT TEST.** Silencing is a local action, so the network
should still see an unanswered call and run the no-reply timer to us — **but that is reasoning, not a
measurement, and the same reasoning said decline would raise busy.** Test it exactly:

> Call the line, **press the side button ONCE**, touch nothing else, and let the full 10 s run.

If the AI answers, the workaround is real and the product promise becomes *"the AI answers calls you don't
pick up"* — true, and the main use case regardless. **If voicemail answers, own-number mode on iPhone only
covers calls the provider ignores entirely**, and the copy must say exactly that.

##### ‼️ ROOT CAUSE — documented, and it is Apple's design, not our misconfiguration

**The iPhone reject button sends ISDN/Q.850 cause 21 "Call Rejected" — not cause 17 "User Busy".**

- **Cause 17 (User Busy)** → the network applies the subscriber's **CFB rule** → would reach us.
- ‼️ **Cause 21 (Call Rejected)** → the network applies its **default treatment** → **voicemail**, and the
  subscriber's rule is never consulted.

Independently documented: *"the reject button is programmed to send to carrier voicemail"*, and *"call
forwarding works properly if you let it ring through, your phone is turned off, or if the line is busy."*

**There is no dial code, carrier setting, or iOS setting that changes this.** The rule is already correct;
the network is never asked.

##### ‼️‼️ HOW EQUAL SOLVES IT — an Android APP PERMISSION, not a telecom trick

This is the answer to *"they solved it, so there must be something."* **There is — and it is not available
to us on iPhone, or to a non-dialer app at all.**

Android's `CallScreeningService` — available only to the app holding the **default Caller ID & Spam** role —
offers three distinct responses to an incoming call:

| Response | Effect |
|---|---|
| `setDisallowCall()` | blocks the call |
| `setRejectCall()` | rejects it **"as if the user did so manually"** → ‼️ same voicemail problem |
| ‼️ **`setSilenceCall()`** | ‼️ **silences the ringing but LETS THE CALL CONTINUE** |

**`setSilenceCall()` is the trick.** The app silences the ring, the call keeps ringing *at the network*, the
no-answer timer runs, and the call forwards to their AI. **The user believes they declined** — they tapped a
button in Equal's own UI — but underneath, the app silenced instead of rejecting, and the ordinary no-answer
rule did the work.

‼️ **This is precisely why Equal's setup insists on "Set Equal AI as Default Caller ID and Spam App."** That
permission is not for spam blocking. **It is the mechanism that makes their headline feature work.**

**And it is impossible on iOS.** A third-party app cannot intercept, reject or silence a native cellular
call; CallKit is for VoIP, and iOS 26's call screening is Apple's own. **Equal's iOS app almost certainly has
the exact limitation measured here** — their decline pitch is an Android behaviour.

##### ✅ THE SOLUTION FOR CLINKET — the short timer, already proven on this line

Clinket is a **web + partner mobile app**, not a dialer, and will not become the default Caller ID app on a
provider's phone — and even if it did, it would be Android-only. **So we do not chase decline. We make it
irrelevant.**

**At a 5-second timer, "ignore" and "decline" are indistinguishable to everyone involved:**

| | Provider | Caller |
|---|---|---|
| Presses the side button **once** | ringing stops instantly | hears ~5 s of ringing, then the AI |
| Does nothing at all | phone rings 5 s | same |

**5 s is the GSM minimum** (the timer accepts 5–30 in steps of 5) and it is **already proven working on this
line**. The provider's experience — *press once, it goes quiet, the assistant handles it* — is functionally
identical to what Equal delivers, reached by a different route.

‼️ **So the product promise is "the assistant answers the calls you don't pick up" — which is true, is the
main use case anyway, and needs no app permission, no dialer role, and no platform-specific code.**

##### ‼️ THE TIMER IS SET FOR THEM — 10 SECONDS, NO CHOICE AT SETUP (owner ruling, 2026-09-15)

> **Owner:** *"5 seconds will be too low… I think we just recommend only the 10 second."* — **Agreed, and
> there is no picker at setup at all.**

| Value | Verdict |
|---|---|
| 5 s | ❌ **Too low.** ~one ring — the provider cannot realistically answer their own phone |
| ✅ **10 s** | ✅ **SHIPPED DEFAULT.** ~two rings, spec-valid, a full 5 s of margin below the measured 15 s ceiling |
| 12 s | ❌ ‼️ **Outside the standard** (§13.0 quotes 3GPP TS 22.082: *"in steps of 5 seconds"*). Accepted by the handset, **undefined in the network, and unreadable afterwards** |
| 15 s | ⚠️ Spec-valid but **sits at the measured cliff**. Offered only in **Adjust**, and only where a carrier's ceiling has been measured |

**Why no picker at setup:** a provider **cannot possibly know their carrier's voicemail pickup time**, so any
choice we offer is a guess whose failure is silent. ‼️ **Instead of asking them to choose, we MEASURE the
result and report it** (§9.10): *"Your phone rings for about 10 seconds."*

**Adjust (10 s / 15 s) lives on the status card**, for the provider who says *"it picks up too fast."* The
option set is capped per carrier in appsettings (§0.12) as ceilings get measured — never a constant.

‼️ **On the rejected 12 s disclaimer:** a warning like *"some carriers may not support this"* pushes a
**technical judgement onto a provider who has no way to evaluate it** — a direct breach of §0.7.1. The gain
over 10 s is two seconds no caller can perceive. **Not offered.**

##### ❌ `62` DOES NOT HELP — the condition is never met on a decline

`62` = **CFNRc, "not reachable"**: phone powered off, flight mode, no coverage. When the red button is
pressed the phone is **on, registered and perfectly reachable** — the network knows exactly where it is, so
the not-reachable condition never occurs.

**Set `62` anyway** — it genuinely covers a phone that is off or out of signal, which is a real case worth
catching. **But it will never catch a decline.** Neither will any other condition; there are only four and
rejection is not one of them.

##### ‼️‼️ HANDSET SETTINGS THAT SILENTLY BREAK THIS — and one of them is aimed straight at our customers

These are **not** about the red button. They break forwarding for calls the provider never touches at all,
which makes them far more dangerous.

| iPhone setting | What it does | Risk to us |
|---|---|---|
| ‼️ **Silence Unknown Callers** | Sends calls from numbers **not in the provider's contacts** straight to voicemail — **documented to bypass conditional call forwarding entirely** | ‼️‼️ **CATASTROPHIC.** An unknown caller *is a new customer* — precisely who the assistant exists for. With this on, **every new customer goes to voicemail and the assistant never rings**, while the provider's own tests with known contacts pass |
| **Focus / Do Not Disturb** | Silences and routes to voicemail | ⚠️ **Unclear whether the network's no-answer condition still fires. Untested — must be measured, not reasoned about** |
| iOS 26 **Call Screening** | Answers unknown calls on-device | Same class of risk as Silence Unknown Callers |
| Live Voicemail | Device-side voicemail transcription | May answer before the network condition fires |

‼️ **THE TEST EVERY RESULT SO FAR HAS MISSED.** Every call in this programme was placed from a **known
contact** (the owner's wife). **Real customers are unknown numbers.** Until a call is placed from a number
that is **not** in the provider's contacts, none of the passing results prove the product works for an actual
customer.

**Consequences for the product:**
- **"Turn off Silence Unknown Callers" is a mandatory setup step**, not advice — and it must be *verified*,
  because a provider testing with their own known contacts will see everything pass.
- ‼️ **The §10 verification test call must originate from a number that is NOT in the provider's contacts**,
  or it certifies a path real customers never take.
- Each of these settings needs its own row in the carrier/handset matrix, per platform.

##### ‼️ IS THERE ANY FIX WITHOUT REMOVING VOICEMAIL? — **No. Searched exhaustively.**

| Avenue | Verdict |
|---|---|
| A dial code for "rejected" | ❌ **Does not exist.** GSM defines four conditions (CFU/CFB/CFNRy/CFNRc); rejection is not one |
| `62` not-reachable | ❌ Condition never met — the phone is on and registered |
| An iPhone setting | ❌ None exists |
| A subscriber-facing carrier setting | ❌ Reject treatment is not exposed |
| A third-party app on iOS | ❌ Cannot intercept, reject or silence a native cellular call |
| Call Deflection (3GPP TS 22.072) | ❌ A separate service, not a standing rule, and not exposed on iPhone |

‼️ **The decisive corroboration: GOOGLE VOICE HAS THE SAME LIMITATION.** Google's own conditional-forwarding
flow suffers exactly this — declined and some unanswered calls land on carrier voicemail instead of Google
Voice, reported for years and never solved. **If Google cannot fix it at the network layer, it is not a gap
in our research — it is the network's behaviour.**

##### Removing voicemail — the only lever, and ‼️ NOT worth it

| Carrier | Turning voicemail off |
|---|---|
| **Rogers** mobile | `*93` — documented on Rogers' own mobility voicemail support; two beeps confirm. Reversible |
| **Bell** mobility | No published code found — a call to Bell (`*611` / 1-800-667-0123) |
| **Telus** | Reportedly **cannot be fully disabled** — the voicemail number is read-only |
| **AT&T / T-Mobile / India** | Untested |

‼️ **RECOMMENDATION: do NOT build the product around removing voicemail.**

- **The benefit is tiny.** It buys one thing: the provider may press the **red** button instead of pressing
  the side button **once**. Both take one press. Both reach the assistant in ~5 s.
- **The cost is large.** Every provider must alter their carrier account; it is carrier-dependent,
  **impossible on some (Telus)**, and it strips voicemail from their **personal** calls too.
- ‼️ **It removes the safety net.** With voicemail gone, any forwarding failure means the caller reaches
  **nothing at all** — a silent ring — instead of a voicemail box. That trades a small convenience for a
  worse failure mode on the provider's real business line.

**Worth ONE test on the owner's own line** to record the answer definitively (does a rejected call fall
through to `67` once voicemail is gone?) — **as knowledge, not as a product requirement.**

**The shipped answer stays: "press once to silence, never the red button."** One instruction, no account
changes, works on every carrier including Telus.

##### ‼️✅ REFRAME (owner, 2026-09-14) — the red button is a FEATURE, not a limitation

> *"That way we don't send all the junk to the AI."*

**Correct, and it reframes the whole thing.** The provider gets a two-way choice at ring time, with **zero
UI, zero code and zero settings**:

| Provider's action | Outcome | Cost |
|---|---|---|
| **Silence it, or ignore it** | ✅ assistant answers, books, takes a message, summarises | AI minutes |
| ‼️ **Red button** | voicemail — assistant never engages | **nothing** |

A spam or junk call is exactly the call a provider **wants** dumped, and the red button does that for free.
Without this, every nuisance call would spend AI minutes against the monthly cap.

‼️ **So we should NOT fix the red button even if we could** — and it stops being an apology in the UI. The
copy becomes a capability:

> *"Don't want the assistant on a call? Just decline it — it goes to your voicemail and the assistant stays
> out of it. To let the assistant take it, silence the ring or simply don't pick up."*

Two behaviours, one sentence each, no technical words (§0.7.1). **Log this as a deliberate design decision,
not a known issue** — a future session must not "fix" it and silently start charging providers for junk calls.

##### ‼️ "If voicemail is removed, will `67` work?" — almost certainly NOT, and we no longer want it to

**The handset still sends cause 21 "rejected" regardless of voicemail.** Removing voicemail does not change
what the phone reports — it only removes where the network's *default treatment* points. So:

- The phone still says *rejected* → the network still never consults `67`
- With no voicemail, the default treatment has **nowhere to go** → the caller most likely gets **failure
  or dead air**, not the assistant

**Expected outcome: worse, not better.** Testable via Rogers `*93` if the definitive answer is wanted, but
**the reframe above removes the reason to want it.** Keeping voicemail is now the deliberate choice: it is
the junk path *and* the safety net if forwarding ever breaks.

##### Known future option — Android parity, NOT proposed now

If true decline→AI parity on Android is ever wanted, the partner mobile app could take the
`CallScreeningService` role and call `setSilenceCall()` — the same mechanism as Equal. **Android only**,
requires the provider to grant the default Caller ID & Spam role, and is a significant piece of scope.
**Recorded so it is not re-derived from scratch; not proposed.**

‼️ **If the limitation confirms, there is no code that fixes it.** `67` has no timer to tune, `62` is a
different condition, and a shorter `61` timer cannot help because a decline never waits for the timer. The
only alternatives are the instruction above or `*21*` (which stops the phone ringing at all). **Do not spend
engineering time hunting for a dial code that does not exist.**

‼️ **This is a real divergence from Equal's pitch**, which is built on *"decline and the assistant steps
in."* That works in India. **It must not be promised in Canadian copy until `*#67#` proves it**, or the
product's headline behaviour fails on the owner's own handset.

**The timer is a trade-off, and it belongs only to `61`:** short enough to beat voicemail, long enough for
the provider to actually answer. 5 s ≈ one ring — right for a diagnostic, too aggressive to ship. Expect
10–15 s in production, tuned per carrier against measured voicemail pickup.

‼️ **Verizon is the odd one out and it is a major US carrier.** GSM codes do not work on it at all. Its
`*71` covers busy *and* no-answer together, and there is no unreachable rule — so a Verizon provider whose
phone is off or out of coverage will **not** reach the assistant. Verizon must either be excluded from the
US launch or shipped with that limitation stated plainly.

To a non-technical provider these strings look like "a number to call". That is exactly what the owner
experienced with Equal — and why the UI must say *"tap to set this up"*, never show the string as an
instruction to understand.

---

## 3. THE MODES — what survives, and the one thing that genuinely cannot

Owner ruling, this session: **in own-number mode we do not offer the mode choice at all.** That is the
right call, and it happens to be the only coherent one — the carrier, not Clinket, decides who rings first.

‼️ **CORRECTION to the first pass of this document: THREE of the four hours modes survive, not one.** The
earlier draft conflated `NeverAnswer` (take a message, never converse — which works fine) with whisper/
summarise-every-call (which is structurally impossible). Verified in code this session: with `ForwardTo`
empty, **every** dial site enters the miss branch instead of dialling —
`TryGatedDialToPartnerAsync` → `EnterMissBranchAsync`
([:1005](../../clinqetfuncations/Clinqet.Communications/Functions/VoiceCallControlFunction.cs#L1005)) and
`StartEarlyPartnerDialAsync` → `ParkEarlyDialMissAsync`
([:1054](../../clinqetfuncations/Clinqet.Communications/Functions/VoiceCallControlFunction.cs#L1054)) —
so the miss branch reaches `TryReceptionistHandoffAsync`, which is where the hours rules live.

| Today's mode | Own-number (forwarded) | Why |
|---|---|---|
| `AlwaysOnMiss` — *"answer the calls I miss"* | ✅ **Works** (as `AiFirst` on our side) | The carrier does the ringing and the miss detection. We answer what arrives. **Identical experience to today's `AlwaysOnMiss` from the provider's and caller's point of view** |
| `AfterHoursOnly` | ✅ **Works** | Missed call after hours → AI. Missed call *during* hours → Clinket voicemail instead. The caller still hears the provider's phone ring first — we cannot stop a carrier ringing |
| `NeverAnswer` — *"just take a message"* | ✅ **Works** | Record-only disclaimer, voicemail, no conversation. No dial anywhere |
| `AiFirst` — *caller never hears the provider ring* | ❌ | Needs unconditional `*21*`, which stops their phone ringing for **every** call, all day. §3.2 |
| Whisper / summarise calls the provider **answers** | ❌ | Structural — the audio never reaches us. §3.3 |
| Recording + transcript + summary of **AI-handled** calls | ✅ Full parity | It is an ordinary Clinket call |
| Live monitor, barge-in, MCP tools, bookings, knowledge, follow-ups | ✅ Full parity | Nothing downstream changes |
| Provider joins the live call | ✅ browser / mobile app · ❌ phone-join | Phone-join dials `ForwardTo`, which in this mode is the forwarding line itself. §5.3 |

**So the provider keeps a real choice of three behaviours, not a single take-it-or-leave-it mode.** That is
worth surfacing in the UI — it is strictly more than Equal offers.

The two losses are the same two either way, and both are honest to explain: the AI cannot jump in *before*
their phone rings, and calls they answer themselves stay private.

So the provider-facing promise reduces to one sentence, and it should be exactly one sentence:

> **Keep your number. Clinket answers the calls you miss.**

### 3.1 The latency the marketing will get wrong

`AiFirst` today is the *fastest* mode Clinket has, because the AI warms while the disclaimer plays and no
provider leg is ever dialled. That stays true **of our half**. What we no longer control is the part before
the call reaches us: the carrier's no-answer timer, typically ~20–25 s, tunable on some GSM carriers via
`*61*<DID>*11*<seconds>#` (multiples of 5, max 30).

- **Declined call →** forwards immediately. This is where "the AI picked up instantly" comes from.
- **Ignored call →** caller waits out the full ring timer *first*, then hears us.

Measure and report **arrival→first-AI-word** (ours) separately from **caller-dial→first-AI-word** (theirs).
Never quote the second number as if it were our latency, and never promise "one second".

### 3.2 ‼️ "AI ANSWERS BEFORE MY PHONE RINGS" — available via `*21*`, ADMIN-GATED (owner ruling)

> **Owner, 2026-09-14:** *"if they need AI answer before my phone rings we can add it from admin when they
> decided every call to transfer — we can give warning and separate command for them to execute."*

**Agreed, and it costs zero extra runtime work.** Unconditional forwarding `*21*<DID>#` sends **every** call
to us immediately — the provider's phone never rings. Our side is byte-for-byte the same configuration as
conditional mode: `AiFirst` + empty `ForwardTo`. **Only the code the provider dials changes.**

| | Conditional (`*004*`) — the default | Unconditional (`*21*`) — admin-gated |
|---|---|---|
| Provider's phone rings first | yes | **never** |
| "AI answers before my phone rings" | ❌ | ✅ |
| Every call summarised | only missed ones | ✅ **all of them** — the AI handles every call |
| Caller wait before the AI speaks | carrier ring timer (~20–25 s) | **immediate** |
| Provider can answer on their own phone | ✅ | ❌ — it never rings |
| Clinket runtime config | `AiFirst` + empty `ForwardTo` | **identical** |

‼️ **RULING, 2026-09-14 — it is NOT self-serve and it is NOT in the signup flow.** Owner: *"we simply in
that case don't do it, since it will complicate — it is their personal line. Only do it through admin alert.
We will call them and explain, and if they are OK then it is fine, in a case when it is purely a business
number."*

**So the flow is: provider requests it → admin alert → a human phones them and explains → admin enables it →
the provider is given the `*21*` code.** Never a self-serve toggle, never shown as an option they can pick
alone. **This also replaces porting entirely (§6.0).**

Both of the previously-impossible items land here, and this is why it is worth the admin call:

| Previously ❌ | Under `*21*` |
|---|---|
| "AI answers before my phone rings" | ✅ literally — their phone never rings |
| "Summarise calls I answer myself" | ✅ **dissolves** — the AI handles every call, so every call is summarised. They never answer on their own phone, so there is no unsummarised call left |

**Why it must stay admin-gated, with an explicit warning the provider has to accept:**
- ‼️ Their phone stops ringing for **everyone** — family, bank, school. It is not a business-hours setting; it is their whole line.
- Every call now spends AI minutes, including ones they would have answered for free.
- ‼️ **The AI cannot transfer a caller to them.** Dialling their number while `*21*` is on forwards straight back to us. A transfer needs a **separate, non-forwarding number** (§5.3) — collect it before enabling, or the "let me put you through to the owner" path is dead.
- It is the right setting for a provider who has a **dedicated business line** they never personally answer. It is the wrong setting for anyone using one phone for everything.

**Removal:** `##21#`. But see §10.3 — `##002#` clears *everything* in one call and is the safer instruction
to give, because it works no matter which setup they chose.

### 3.3 Why whisper/summaries on answered calls is structurally impossible — and it is fine

If the provider answers on their own carrier line, the audio travels provider↔caller on the carrier's
network. Clinket is not a party to it. There is no packet to transcribe. No cloud service can summarise a
conversation it never received — Equal cannot either, which is precisely why their product is built around
*declining*.

This is the compromise the owner already identified, and it is the correct one. State it plainly in the UI
at setup time (§0.7.1 — plain words, no technical terms): *"Calls you answer yourself stay private — they
are not recorded or summarised."* That sentence is a **feature** to most providers, not an apology.

---

## 4. WHAT CLINKET ALREADY HAS — verified, not assumed

Every row below was read in the working tree this session.

| Already exists | Evidence |
|---|---|
| `VoiceNumberMode { NewDedicated, ForwardExisting }` | [VoiceNumberMode.cs:6](../../clinqetshared/Enums/VoiceNumberMode.cs#L6) |
| `VoiceHoursMode.AiFirst` — "AI answers immediately — the provider leg is never dialled" | [VoiceHoursMode.cs](../../clinqetshared/Enums/VoiceHoursMode.cs) |
| `NumberMode` + `ForwardingTarget` persisted on the application | [VoiceAssistantState.cs:75,78](../../clinqetcore/Entities/COSMOS/VoiceAssistantState.cs#L75) |
| `NumberMode` is **locked once Active** | [VoiceAssistantService.cs:134](../../clinqetinfrastructure/Services/Voice/VoiceAssistantService.cs#L134) |
| Telnyx `AiFirst`: warms AI, schedules the backstop, **returns before any dial** | [VoiceCallControlFunction.cs:348](../../clinqetfuncations/Clinqet.Communications/Functions/VoiceCallControlFunction.cs#L348) |
| Plivo `AiFirst`: `if (HoursMode != AiFirst) StartProviderDial` | [PlivoVoiceCallControlFunction.cs:353](../../clinqetfuncations/Clinqet.Communications/Functions/PlivoVoiceCallControlFunction.cs#L353) |
| Plivo engages the AI on the **caller's own join** when no provider leg is dialled | [PlivoVoiceCallControlFunction.cs:1216](../../clinqetfuncations/Clinqet.Communications/Functions/PlivoVoiceCallControlFunction.cs#L1216) |
| Line lookup is a **point read** on the dialled number (`voiceline_{e164}`) — no cross-partition query | [VoicelineRepository.cs:32](../../clinqetinfrastructure/Data/COSMOS/VoicelineRepository.cs#L32) |
| **Automated DID purchase already implemented** — search, quote, order, poll | [VoiceAssistantService.cs:881](../../clinqetinfrastructure/Services/Voice/VoiceAssistantService.cs#L881) `PurchaseSpecificNumberAsync` → `_numberProvider.OrderNumberAsync` |
| Loop guard rejecting a forwarding target that is a platform DID | [VoiceAssistantService.cs:732](../../clinqetinfrastructure/Services/Voice/VoiceAssistantService.cs#L732) |
| Assigning a DID equal to the forwarding target is rejected | [VoiceAssistantService.cs:818](../../clinqetinfrastructure/Services/Voice/VoiceAssistantService.cs#L818) |
| ‼️ **The `ForwardExisting` copy keys already exist in ALL FIVE partner-web languages** — en-US, es-US, fr-CA, gu-IN, hi-IN; five keys each, counts consistent | `clinqetwebpartnerapp/public/lang/*.json` |

**On localization (§0.10):** the option is already written and translated — *"Use my existing number / Keep
the number you already advertise."* ‼️ **But the description ends "We'll set this up for you soon"**, which
must be rewritten in all five files the moment this ships, or the UI promises a future that has already
arrived. The genuinely new copy is the setup flow: carrier instructions, the dial codes, the eight-dialog
warning, *"press once to silence, never twice"*, the verification states, and the removal code.

### 4.1 ‼️ The empty-`ForwardTo` path is **already loop-safe on both carriers**

This is the finding that makes the verdict "yes, with what we have". Every branch that could dial the
provider already guards on an empty forwarding number, and every one of them degrades to something sane:

| Branch | Telnyx | Plivo |
|---|---|---|
| Normal answer, `AiFirst` | returns before the dial ([:348](../../clinqetfuncations/Clinqet.Communications/Functions/VoiceCallControlFunction.cs#L348)) | skips `StartProviderDial` ([:353](../../clinqetfuncations/Clinqet.Communications/Functions/PlivoVoiceCallControlFunction.cs#L353)) |
| **Minutes spent (cap)** | `TryTransferToPartnerAsync` → empty target → `EnterMissBranchAsync` → speaks localized `Voice_LineUnavailable`, hangs up ([:1245](../../clinqetfuncations/Clinqet.Communications/Functions/VoiceCallControlFunction.cs#L1245)) | `SpeakThenHangup(Voice_LineUnavailable)` ([:328](../../clinqetfuncations/Clinqet.Communications/Functions/PlivoVoiceCallControlFunction.cs#L328)) |
| **Private mode** | empty target → miss branch → clean hangup | `SpeakThenHangup(Voice_LineUnavailable)` |
| Disclaimer speak rejected (dead-air rescue) | empty target → miss branch, no dial | n/a |
| AI handoff fails | falls back to voicemail, never a dial ([:567](../../clinqetfuncations/Clinqet.Communications/Functions/VoiceCallControlFunction.cs#L567)) | miss branch |

Both carriers already speak the **same localized key** (`Voice_LineUnavailable`) in the same situations.
That consistency was not built for this feature and it lands exactly right for it.

**Therefore: `HoursMode = AiFirst` + `ForwardTo = ""` is a complete, loop-free own-number runtime today.**

### 4.2 ‼️ The no-dial behaviour is ALREADY PINNED BY TESTS — none written for this feature

This is not an inference from reading branches. Named tests already assert it, on both carriers:

| Test | Carrier |
|---|---|
| `Run_CallAnswered_CallerLeg_AiFirst_PlaysDisclaimerButNeverDialsTheProvider` | Telnyx |
| `Run_SpeakEnded_AiFirst_HandsToTheAssistant_WithoutDialing` | Telnyx |
| `CompleteDisclaimer_AiFirst_BackstopReachesTheAssistant_WithoutDialing` | Telnyx |
| `Run_SpeakEnded_AiFirst_HandoffRejected_FallsBackToVoicemail_NeverDials` | Telnyx |
| `Answer_AiFirst_NeverDialsTheProvider` | Plivo |
| ‼️ **`Status_AiFirst_CallerJoin_EngagesAi_EvenWithAForwardingNumber`** | Plivo |

That last one is the sandbox precondition, already green: **`AiFirst` engages the AI even when a forwarding
number is present.** It is why §13.1 needs no code change.

**So the runtime half of the theory is already proven.** The untested half is entirely the carrier's —
whether Rogers/Bell/Airtel/Jio will actually forward the call to us. That is what §13.1 measures.

---

## 5. ‼️ THE ONE DEFECT — and it is one method

### 5.1 The loop

`SyncVoicelineFromApplicationAsync` copies the application's forwarding target onto the runtime line:

```csharp
v.ForwardTo  = application.ForwardingTarget ?? string.Empty;   // ← VoiceAssistantService.cs:934
v.HoursMode  = application.HoursMode ?? VoiceHoursMode.AlwaysOnMiss;
```

In own-number mode `ForwardingTarget` **is the provider's own forwarding line**. Copying it into
`ForwardTo` arms every dial path to call straight back into the line that forwards to us:

```
caller → provider's number → (miss) → carrier → Clinket DID → we dial ForwardTo
                                          ▲                          │
                                          └──────── (miss) ──────────┘   ← unbounded
```

At best the provider's phone rings twice and the caller waits through two ring cycles. At worst: repeated
legs, duplicate sessions, duplicate summaries, and billed minutes on both sides. Network loop limits are
not a design.

**The fix is local and needs no schema change:** when `NumberMode == ForwardExisting`, the sync must write
`ForwardTo = string.Empty` and `HoursMode = AiFirst`, regardless of what the application says. Everything
in §4.1 then holds.

The existing guard at `:732` does **not** cover this — it only proves the target is not one of *our* DIDs.
It cannot know that an external mobile line forwards back to us. Nothing can, short of a live test call
(§10).

### 5.2 `ForwardingTarget` is currently mandatory

Submission validation requires both
([VoiceAssistantService.cs:719-722](../../clinqetinfrastructure/Services/Voice/VoiceAssistantService.cs#L719)):

```
NumberMode        → Error_VoiceAssistantNumberModeRequired
ForwardingTarget  → Error_VoiceAssistantForwardingTargetRequired
```

In own-number mode the provider *does* supply a number — their own — so the field is still filled and the
validator is still satisfied. **Its meaning changes, not its presence**: today it means *"the number we
dial"*; in the new mode it means *"the number that forwards to us"*. Two meanings on one field is exactly
the kind of thing that produces a production incident eighteen months from now. This is the one place a
schema question is genuinely open — §14, Decision 5.

### 5.3 Phone-join stops working; browser and app join do not

Provider join resolves `method = "phone"` when there is no WebRTC/REFER target, and phone-join derives
`tel:{voiceline.ForwardTo}`
([VoicePostCallMessage.cs:16](../../clinqetshared/DTOs/Messages/VoicePostCallMessage.cs#L16),
[VoiceSessionMonitor.cs:431](../../clinqetmcp/Clinqet.Mcp/Monitor/VoiceSessionMonitor.cs#L431)).
With `ForwardTo` empty there is nothing to dial.

Two honest options, both cheap:
- **(a)** Own-number providers join from the browser or the mobile app only. Phone-join is hidden, not broken.
- **(b)** Collect a separate *"call me on"* number used **only** for join — a second line, a landline, a
  desk phone. It must never be the forwarding line, or the join call itself loops.

(a) for the pilot. (b) only if pilot providers actually ask.

#### ‼️ THE LIVE-CALL MATRIX — exactly one of six things is lost

> **Owner's question:** *"we stream the call to mobile app and web and give the option — pick up from the
> phone, or mobile app, or ring their phone. So ring-their-phone won't be supported, but the others will?"*
>
> **Correct. Only "ring my phone" is lost. Everything else is untouched.**

| On a live call | Own-number mode | Why |
|---|---|---|
| Live transcript streamed to **web** (SignalR) | ✅ | Driven by the AI session, not by how the call arrived |
| Live transcript streamed to **mobile app** | ✅ | Same stream, same hub |
| Listen in / watch the call happen | ✅ | Same |
| **Join from the browser** (Telnyx WebRTC) | ✅ | `useBrowserCall.js`, `webrtc-credential` — no phone number involved |
| **Join from the mobile app** (in-app audio) | ✅ | `useInAppJoin.ts` sends `joinMethod: 'browser'` — it is an in-app audio join, **not** a call to their phone |
| Barge-in / take over from the AI | ✅ | Rides whichever join they used |
| ‼️ **"Ring my phone" join** | ❌ | `LiveCall/index.tsx` sends `joinMethod: 'phone'`, which derives `tel:{ForwardTo}` — the forwarding line. It would ring their phone, they would miss it, and the carrier would forward it **back to us** |

Verified this session in `clinqetmobilepartnerapp`: the app already has **both** paths —
`useInAppJoin.ts` (`joinMethod: 'browser'`) and `LiveCall/index.tsx` (`joinMethod: 'phone'`). Only the
second is hidden in own-number mode, and hiding one button is the entire UI change.

‼️ **Under `*21*` (§3.2) the same rule bites harder:** the AI cannot *transfer* a caller to the provider
either, for the same reason. A transfer path needs the separate "call me on" number from option (b).

---

## 6. THE TWO OWN-NUMBER PATHS — and where each is available

The owner proposed offering both. Both are real, but they are **not** both available in both regions.

| Path | What it is | Modes available | CA/US | India |
|---|---|---|---|---|
| **A — Forward** (this programme) | Provider keeps their carrier; saves 3 forwarding rules to a hidden Clinket DID | Miss-takeover only | ✅ | ✅ |
| **B — Port** | The number is transferred to Telnyx/Plivo and becomes a Clinket DID | **All four**, full parity with today | ✅ (regulated, weeks, manual) | ❌ **Not permitted** |

‼️ **India blocks Path B.** TRAI does not permit porting Indian **mobile** numbers into virtual/cloud
telephony. So "port for the full experience" is a **Canada/US-only** upsell and must never be shown to an
Indian provider. Verify against Plivo/Telnyx in writing before any copy is drafted (§15).

Path B is also not self-serve anywhere: porting is an LOA + carrier process measured in days-to-weeks with
a real cutover risk. Treat it as an **admin-assisted enterprise path**, reachable from a "talk to us" link.
It does not belong in the pilot.

> ‼️ **RULING SUPERSEDED, 2026-09-14 (same day).** The earlier ruling offered Path B CA/US admin-assisted.
> **Owner then dropped porting entirely:** *"we will never show the option porting the number to telnyx and
> plivo — instead of porting this will be better."*
>
> **Path B is OUT. Never shown, in any region, to anyone.** Its purpose — "AI answers every call on my own
> number" — is served better by admin-gated `*21*` (§3.2): same outcome, **one dial instead of a weeks-long
> regulated migration, and reversible in one dial.**

### 6.0 Why dropping porting is the right call

Porting exists to make the number *ours*. For an AI receptionist, ask what that actually buys:

| What porting would add | Does this product need it? |
|---|---|
| AI answers 100% of calls | ❌ **No — `*21*` already does this**, in one dial |
| SMS to that number reaches us | ❌ No — voice SMS sends from `Telnyx:TransactionalFromNumber`, never the provider's number |
| WhatsApp on that number | ❌ No — WhatsApp runs on a shared Clinket business number per region |
| Outbound caller ID as that number | ❌ No — not a feature of this product |
| No dependence on their carrier | ✅ the only real gain |

**One real gain, against weeks of regulated migration, an LOA, a cutover window where calls can be lost, and
no easy undo.** `*21*` gets the same caller experience today and is reversed with `##002#`. The owner's
instinct is correct and this row is why.

What is genuinely lost by never porting: if the provider's carrier breaks forwarding, or they cancel their
carrier plan, the assistant stops. That is a support risk, not a product gap — and it is the same risk the
whole own-number path already carries.

### 6.1 ‼️ SWITCHING BETWEEN THE TWO MODES — owner's proposal, and it is the right one

> **Owner, 2026-09-14:** *"they can go in between — if they want to use their own number they can do it, or
> if the number is already assigned by our admin they can go back to that number as well."*

**Yes. Do this.** It is a good idea, and it turns out to be *cheaper* than not doing it, because of one fact
that is easy to miss:

‼️ **The provider's phone number is the same value in both modes.** In assigned-number mode
`ForwardingTarget` is *"the phone we dial"*. In own-number mode it is *"the phone that forwards to us"*.
**Same phone. Same number. Same field.** Only one thing differs — whether we are allowed to dial it.

That collapses the whole design:

| | Assigned-number mode | Own-number mode |
|---|---|---|
| The Clinket DID | **published** — customers dial it | **hidden** — only the carrier dials it |
| `ForwardingTarget` | the provider's phone | the provider's phone (**identical value**) |
| `Voiceline.ForwardTo` | the provider's phone | **empty** |
| `Voiceline.HoursMode` | provider's choice of 4 | forced `AiFirst` |
| Who rings the provider | **we do** | **their carrier does** |

So switching is **a flip of two runtime fields on one existing Voiceline** — no re-provisioning, no new
number, no release, no quarantine, no port. The provider keeps the same hidden/published DID through the
switch; it simply changes from *"give this to customers"* to *"never give this to anyone"*.

**This also answers the schema question (§5.2) without a schema change.** `NumberMode` is the discriminator;
`ForwardingTarget` keeps one meaning — *"the provider's phone"* — and the mode decides whether we may dial
it. One field, one value, no ambiguity. **No §0.7 approval needed.**

‼️ **The one sharp edge, and it is sharp.** *Switching the mode in our app does not change the carrier's
forwarding rules.* A provider who switches back to assigned-number mode but leaves `*61*` still pointing at
us produces exactly the loop from §5.1: their missed call forwards to a line that is now armed to dial them
back. So the switch is **never** a toggle on its own — it is a guided flow:

- **→ own-number:** assign/keep DID → provider saves the three rules → **we prove it with a test call** → mode flips only on success
- **→ assigned-number:** provider cancels forwarding (`##004#`) → **we prove it is gone** (a test call must now go unanswered, *not* arrive at us) → mode flips → DID is published to them

The "prove it is gone" half is the one everybody forgets. It is the same test-call machinery as §10, read in
the opposite direction: **arrival = failure.**

#### ‼️ No number is unassigned on a switch — and that is deliberate

Owner asked whether switching back to the dedicated number means we un-assign the hidden DID. **No — and
un-assigning would be a defect, not housekeeping.**

It is the **same DID in both modes**. Only its *publicity* changes:

| | own-number mode | assigned-number mode |
|---|---|---|
| The DID | hidden — only the carrier ever dials it | published — customers dial it |
| Release / quarantine / re-purchase | **none** | **none** |

Un-assigning would cost a release, a quarantine window, and a fresh purchase — for no gain. Worse, it would
**strand callers**: anyone who already has that number would reach a dead line.

Keeping it also makes the switch safe in both directions:
- **dedicated → own-number:** the old published number stays live. A customer who still has it calls it and
  the AI answers (`AiFirst`). Nothing breaks.
- **own-number → dedicated:** the previously-hidden number is simply handed to the provider to publish.

**A switch never strands a caller in either direction.** The existing release + quarantine path stays
exactly as it is, used only when the provider cancels the assistant entirely.

Also unlock `NumberMode` — today it is frozen once Active
([VoiceAssistantService.cs:134](../../clinqetinfrastructure/Services/Voice/VoiceAssistantService.cs#L134),
`Error_VoiceAssistantNumberModeLocked`). That lock must become "changeable only through the verified
switch flow", never a free edit.

### 6.2 India porting through Plivo — the direct answer

**Evidence says no, and it is not Plivo's choice.** The restriction is regulatory: Indian **mobile** numbers
cannot be ported into virtual/cloud telephony. Plivo sells Indian numbers and supports porting elsewhere,
but no vendor can port a number the regulator will not release into that class of service.

‼️ **Confidence: industry documentation, corroborated across sources — NOT a TRAI/DoT circular I read.**
Before this appears in provider-facing copy or a sales conversation, get it **in writing from Plivo** for
Clinket's specific account and service model. Until then it is a design assumption, not a fact.

Practical effect: an Indian provider gets **forwarding only**. That is exactly Equal's own product, in
Equal's own market — so it is demonstrably a viable product on its own.

---

## 7. NUMBER PURCHASE — ‼️ OWNER RULING: stays admin-only

> **Ruling, 2026-09-14:** *"no — current process, purchase number always will be through admin."*
> Closed. Do not re-propose provider-facing purchase.

Automated purchase already exists and works (`PurchaseSpecificNumberAsync` searches, quotes, orders, polls
— [VoiceAssistantService.cs:881](../../clinqetinfrastructure/Services/Voice/VoiceAssistantService.cs#L881)),
gated admin-only:

```
[Authorize(Roles = "Admin")]  POST  {businessId}/assign-number      AdminVoiceAssistantController.cs:93
[Authorize(Roles = "Admin")]  GET   {businessId}/number-quote       AdminVoiceAssistantController.cs:133
```

**State the consequence plainly rather than discovering it in the pilot:** own-number mode does **not**
remove the admin step. The hidden forwarding destination is still a purchased DID, so an own-number provider
still waits for an admin to assign one. Own-number mode buys **capability** (keep your published number),
not **speed of activation**.

If the wait later becomes the complaint, the only design that satisfies both "admin controls spend" and
"provider does not wait" is a **pre-stocked pool**: admin buys N numbers ahead of demand, assignment draws
from stock instantly. ‼️ **That pool does not exist today** — the release path returns a number with a
`QuarantineUntil`, and purchase buys one specific quoted DID on demand ("the blind *buy any available* path
is gone"). Pre-stocking would be new work and a new owner decision. Not proposed now; recorded so it is not
re-invented from scratch.

---

## 8. REGION REALITY — ‼️ Canada is the hard one, not India

This is the most important non-obvious finding, and it inverts the instinct to copy Equal (an India-only product).

| Market | Conditional forwarding | The friction that decides the UX |
|---|---|---|
| **India** — Airtel, Jio, Vi | Documented, `*61*/*67*/*62*` or handset settings | Destination restrictions (no international, no BSNL destination, not your own number). Jio increasingly steers to handset settings / MyJio rather than codes. **Equal excludes BSNL.** Commercial blocker is *our* number supply (KYC), not the provider's setup |
| **Canada** — Rogers, Bell, Telus, Fido, Freedom | Documented GSM codes | ‼️ **Carrier voicemail intercepts the call first.** Rogers states conditional forwarding will not work while voicemail is active. Bell's voicemail answers before forwarding can reach us. The provider must first have voicemail **removed from the line** — Rogers `*91`/`*93`; Bell requires phoning `*611` / 1-800-667-0123 |
| **US** — AT&T, T-Mobile, Verizon | Documented, syntax differs per carrier (`*61*`/`**61*`/`*71`) | Same voicemail-precedence problem in general; Verizon excludes international destinations. Prepaid/MVNO support is inconsistent |
| **Landlines / RingCentral / 8x8 / Google Voice** | Portal setting, not a dial code | Entirely different instructions. Do not promise support in the pilot |

**Consequence for the product:** the "three taps and you're live" story is **true in India and false in
Canada.** In Canada the honest flow is:

> 1. Remove voicemail from your line (we tell you exactly how, per carrier)
> 2. Save three forwarding rules
> 3. We place a test call to prove it works

And it must be said **before** they pay, not after. A provider who loses their voicemail without being
warned, or whose forwarding silently never fires because voicemail won, is a support ticket and a refund.

**Corollary worth stating plainly:** replacing voicemail is the *value proposition* — the AI is a far better
voicemail. But it is still a change to the provider's phone that they must consciously accept.

### 8.1 ‼️ Availability is gated PER COUNTRY, off the business address (owner ruling)

> **Owner, 2026-09-14:** *"depends on the provider business address — where we know the country — we can
> turn this on and off."*

Clinket serves **three** regions: Canada, USA, India. Carrier behaviour differs per region and could
plausibly make own-number mode unworkable in one of them. So the mode is **not** a global feature flag — it
is **per-country availability**, resolved from the business address the platform already holds (the same
address that resolves the payment gateway and the voice carrier today).

Consequences:
- A region that fails Phase 1 is simply **switched off**, and the option is never shown to providers there.
  The feature ships for the regions that work rather than waiting for the worst one.
- Own-number is offered in India **even though porting is not** (§6.2) — the two are independent switches.
- ‼️ **The gate must be server-side.** A provider whose country does not support it must not be able to
  reach the setup flow by any route, including a stale mobile build or a deep link.
- The country list belongs in appsettings (§0.12), never as a constant — it will change as carriers are
  certified one by one.

### 8.2 ‼️ THE CANADIAN DESIGN FORK — ✅ **RESOLVED 2026-09-14, NO FORK NEEDED**

> ‼️ **THIS SECTION IS SUPERSEDED BY ITS OWN RESOLUTION. Read this box before the rest of it.**
>
> The fork below was written when `*004*` lost to voicemail and `*21*` was the only thing that worked. **The
> timer fix (§13.0) then proved the cause was a timer race, not a voicemail override.** With
> `**61*<DID>**5#` the AI answered on a normal, voicemail-subscribed Canadian line.
>
> **So there is no fork.** Conditional forwarding is the self-serve Canadian default, `*21*` returns to being
> the rare admin-gated exception (§3.2), and no provider has to unsubscribe voicemail or phone their carrier.
>
> **What survives from the section below:** the plain-language question *"is this phone business-only?"* is
> still worth asking — not because conditional fails, but because a business-only provider may genuinely
> prefer the AI to take every call. It is a **preference**, no longer a **workaround**.
>
> **The one permanent change:** the no-reply timer must always be set explicitly. **The carrier default is
> not safe**, and `*004*` alone is not a complete Canadian setup (§2.1 sequence rule).

_Historical — the fork as it stood before the timer fix:_

Canada's live result (§13.0) forces one product question, and it is answerable in **plain words a provider
understands** (§0.7.1 — no technical terms):

> **"Is this phone only for your business, or do you use it for personal calls too?"**

| Their answer | Setup | Their phone rings | Extra steps | Status |
|---|---|---|---|---|
| **Business only** | `*21*<DID>#` — the AI takes every call | never | **none** | ✅ **PROVEN WORKING in Canada today** |
| **Personal too** | `*004*<DID>#` — the AI takes what they miss | yes, normally | ‼️ **voicemail must be removed from the line — a call to the carrier** | ❌ blocked until voicemail is gone |

‼️ **This inverts the original plan.** `*21*` was designed as the rare admin-gated exception and conditional
as the self-serve default. **In Canada the opposite is true:** `*21*` is the only path that works with no
carrier intervention at all.

#### ‼️ DOES THE CANADIAN FAILURE APPLY TO THE US AND INDIA? — NO, and assuming so would be a costly mistake

**The dial codes are the same GSM family. The voicemail-precedence behaviour is NOT.** They are two
different things and only the first is standardised.

| Market | Codes | Voicemail precedence | Confidence |
|---|---|---|---|
| **Canada** — Rogers, Bell, Telus, Fido, Freedom | same GSM codes | ❌ **Voicemail wins — PROVEN on a live line** | **Measured by us, one carrier** |
| **US** — AT&T, T-Mobile | same GSM codes | ✅ **Likely fine** | **Inference.** Google Voice's official flow tells AT&T/T-Mobile users to point conditional forwarding at a Google number, and it works at scale — so those carriers do let the subscriber's rule replace voicemail. **Untested by us** |
| ‼️ **US** — Verizon, US Cellular | ❌ **different family entirely** — `*71`/`*73`, no `*004*`, **no timer control**, no unreachable rule | unknown | **The timer fix below may be impossible here** |
| **India** — Airtel, Jio, Vi | same GSM codes | ✅ **Likely fine** | **Strong inference.** Equal AI runs an entire 5M-install business on exactly this mechanism in India. Indian mobile voicemail is also commonly **not subscribed by default**, so there is often nothing to compete with. **Untested by us** |

‼️ **This explains why Equal is India-only.** Their three-tap setup works there because Indian carrier
voicemail usually is not in the way. **Their model would hit this exact Canadian wall on Rogers or Bell** —
so do not treat their smooth onboarding as evidence that ours will be smooth here.

**And it changes which market is "hard".** §8 originally called Canada the hard market on documentation
alone. That is now **measured**, and the gap to India is wider than expected: India may need no
intervention at all, while Canada needs either a timer fix or a carrier call.

‼️ **Rule: every carrier is tested on a real line before it is switched on (§8.1). One carrier's result is
never generalised to another — not even inside the same country.**

**Consequences to carry into design:**
- The §3.2 admin-alert gate on `*21*` was ruled for a good reason (it silences a personal line). **That
  reason disappears when the provider tells us the phone is business-only.** Whether a "business only"
  answer is enough to unlock it self-serve, or whether it still warrants the admin phone call, is an
  **owner decision** — recorded as §14 ruling 12, not assumed.
- With `*21*`, the AI cannot transfer a caller back to the provider (§3.2). A provider who wants
  "AI screens, then puts important callers through to me" needs a **separate number to be reached on**.
  That combination — screen everything, transfer on demand — is a genuinely strong product, and it is the
  one shape that needs the extra field (§14 ruling 11).
- Whether removing voicemail actually fixes the conditional path in Canada is **still unproven.** `*#61#`
  will show whether the carrier stored our DID or quietly kept voicemail as the destination — one dial,
  and it decides whether path 2 is worth building at all.
- ‼️ **Do not generalise.** This is one carrier, one line, one handset. Every other Canadian carrier, and
  the whole US and India matrix, is still untested.

### 8.3 ‼️ LANDLINES — partially, and with completely different codes

> **Owner's question:** *"it will be supported on landline too, correct?"*

**Partially. Do not assume the mobile story carries over — almost none of it does.**

| Line type | Conditional forwarding | Codes | Verdict |
|---|---|---|---|
| **Rogers Home Phone** | ✅ Yes | `*92`+number (no answer) · `*90`+number (busy) · `*72`/`*73` unconditional | Supported, **different codes** |
| **Bell Business Phone** | ✅ Yes | `*90` busy programmable · `*92` don't-answer programmable | Supported, **different codes** |
| ‼️ **Bell residential Home Phone** | ❌ **Bell does not offer it** | `*72`/`*73` unconditional only | **Conditional mode impossible.** Only the `*21*`-equivalent (`*72`) path works |
| **Business VoIP** — RingCentral, 8x8, Ooma, Vonage, Google Voice | ✅ usually | **No star codes** — a web portal setting | Supported in principle, but we can give **no dial code at all** |
| **PBX / SIP trunk** | ✅ | Whatever the PBX exposes | Enterprise; a direct SIP trunk to us is the better answer long-term |

What breaks on landlines:
- ‼️ **`*004*` does not exist.** No one-call setup. Separate codes per condition, per telco.
- ‼️ **There is no "unreachable" condition.** A landline does not go out of coverage. Two rules, not three.
- **Different code family entirely** (`*90`/`*92`, not `*61`/`*67`/`*62`), and it varies telco by telco.
- **Feature may need to be subscribed** on the line before any code works.
- **No handset to tap from** — web or printed instructions only; the §9 mobile-app one-tap path is useless here.

**Recommendation: mobile-only for the pilot.** Add landline as its own certified track afterwards, per
telco, with its own instruction set. Offering it before certifying it converts every landline provider into
a support ticket — and Bell residential would fail outright with no code that can fix it.

**Detect, don't ask.** A carrier/line-type lookup (Telnyx and Plivo both expose number lookup returning
carrier + line type: mobile / landline / VoIP) should drive which instructions are shown, with the provider
able to correct it — porting and dual-SIM make automatic detection wrong often enough to matter.

---

## 9. SETUP UX — what the phone will and will not let us do

| Surface | Can we one-tap the code? | Flow |
|---|---|---|
| **Android** (partner mobile app) | **Yes** — `ACTION_CALL` with `tel:` and `#` encoded as `%23`, needs `CALL_PHONE` | One tap per rule |
| **iOS** (partner mobile app) | ‼️ **No.** Apple, by design: *"If a URL contains the `*` or `#` characters, the Phone app does not attempt to dial"* — explicitly to stop apps redirecting calls | Show the code, **Copy**, paste into the keypad, Call |
| **Partner web** | No — a browser cannot dial the phone being programmed | Show a QR / deep link into the mobile app, or print the codes to copy by hand |

Equal ships on iOS under the same restriction, which is the strongest available evidence that
copy-and-paste is a good-enough experience. It also means **the mobile app is the primary setup surface**
and web is the fallback — the reverse of how Clinket onboarding normally works, and a real piece of scope
(§0.7.1: mobile mirrors web, and this feature is mobile-*first*).

Dual-SIM must be asked explicitly — Equal asks, and it is not inferable.

### 9.1 ‼️ iPHONE SETTINGS CANNOT SEE OR TURN OFF CONDITIONAL FORWARDING — the code is the ONLY way

**iOS Settings → Phone → Call Forwarding controls *unconditional* forwarding only.** There is no
conditional option anywhere in iOS. (Some carriers hide even the unconditional toggle on VoLTE/Wi-Fi
Calling lines — a carrier restriction, not an Apple one.)

Three consequences, all of which shape the product:

1. ‼️ **The provider cannot turn our forwarding off from Settings.** The dial code is the only mechanism.
   **So shipping the deactivation code in our UI is mandatory, not a nicety** — without it the provider is
   genuinely stuck, and their only route is a call to their carrier.
2. ‼️ **Settings will show Call Forwarding "Off" while our conditional forwarding is fully active.** This
   *will* generate "I turned it off but it's still forwarding" tickets. The UI must say plainly: *your
   phone's settings screen does not show this — use the code we give you.*
3. **The only way to see the truth is `*#004#`** on the handset. There is no server-side view (§10.1).

Android's dialer *does* expose all four conditions in its own call-settings screen — so the two platforms
need different words for the same step. Another reason this is a mobile-first, per-platform flow.

### 9.2 ‼️ THE UI FLOW — proposed, for mockup (§0.20). NOT approved, NOT built.

‼️ **Nothing here may be built before a sheet exists at `Data\mockups\voice-keep-your-number\index.html`,
is approved by the owner, and is registered in §16.** This section is the brief for that sheet.

#### ‼️ THE FRAMING — an ADDITION, never a choice (owner ruling, 2026-09-14)

> **Owner:** *"they can do both so we don't need to give the choice — rather, if they want to use their
> number, then what to do?"*

**Every provider gets a Clinket number regardless.** Own-number mode does not replace it; it **adds** a
second way in. So there is no "which number do you want" question at all:

| Customer dials… | What happens | Who rings them |
|---|---|---|
| **The Clinket number** | Assistant answers **straight away** | nobody — we never dial |
| **Their own number** | Rings their phone ~10 s → assistant answers on a miss | **their carrier** |

‼️ **Both work at the same time, and this is safe** precisely because `ForwardTo` is empty (§5.1) — we never
dial out, so nothing can loop. The provider simply does not advertise the Clinket number.

**This is genuinely useful, not a compromise:** they can hand the Clinket number to listings and directories
where they *want* the assistant to take every call, and keep their own number for people who should reach
them personally.

‼️ **What connecting costs them, stated BEFORE they start** (the *What changes?* expander):
- "Assistant answers first" and whisper turn **off** on the Clinket number — we can no longer ring them back
- Live-call join moves to the app; **"ring my phone" join disappears** (§5.3)
- Calls they answer themselves stay private (§3.3)

#### The entry point — a card, not a modal, not a fork

On the AI Assistant page, once their assistant is live on its Clinket number:

```
┌────────────────────────────────────────────────────────┐
│  Also use the number you already advertise             │
│                                                        │
│  Customers keep calling your existing number. When     │
│  you don't pick up, your assistant answers.            │
│                                                        │
│  [ Connect my number ]        What changes? ⌄          │
└────────────────────────────────────────────────────────┘
```

#### The wizard — FOUR steps, one job each

| Step | Screen | What it does | Detail |
|---|---|---|---|
| **1** | **Your number** | Pre-filled from profile, **editable**. Lookup runs → shows *"Rogers · mobile"* with a **Not right?** correction | §9.3 · landline/VoIP ⇒ §9.4 · unsupported country ⇒ §8.1 |
| **2** | ‼️ **Two quick checks** | **Silence Unknown Callers OFF** + **Do Not Disturb**. Platform auto-detected with an iPhone/Android switcher. **Both ticked to continue** | §9.7 — **the screen that decides whether this works at all** |
| **3** | **Connect it** | Two codes, large. Android: two tap-to-dial buttons, **second unlocks after the first**. iPhone: copy + *"paste into your keypad"*. Amber warning about the confirmation popups | §2.1 sequence rule — **`61` LAST** |
| **4** | **Let's check it works** | *"We're calling you now — please don't answer."* Live progress → **Received ✓** + the **measured** delay. **Skip, I'll check later** available | §9.10 — the full mechanic |

‼️ **There is NO ring-timer step.** 10 s is set for them (§13.0 ruling). Adjusting moves to the status card,
where it belongs — a provider at setup cannot possibly know their carrier's voicemail pickup time.

‼️ **Prerequisite stated up front: "have your phone with you."** On web especially — a provider who reaches
step 4 with the phone in another room fails the test for no reason at all.

#### After connecting — the permanent status card

```
┌────────────────────────────────────────────────────────┐
│  ✓ Connected            Last checked 15 Sep            │
│                              [ Check again ]           │
│                                                        │
│  Your phone rings for about 10 seconds, then your      │
│  assistant answers.                    [ Adjust ]      │
│                                                        │
│  ▸ How it works                                        │
│  ▸ What's not supported                                │
│  ▸ Disconnect                                          │
└────────────────────────────────────────────────────────┘
```

- **Last checked \<date\>** — ‼️ **never a live "Active" badge** (§10.1)
- **Adjust** — 10 s or 15 s only, capped per carrier (§13.0)
- **How it works** — the four lines (§9.8)
- **What's not supported** — §9.9, expandable, never buried
- **Disconnect** — `##002#` + ‼️ **reverse verification: arrival = failure** (§10.3)
- ➕ **"Call your assistant to hear it"** — one deliberate call to their own DID. This is the emotionally
  satisfying proof, and it belongs **here**, not in the test (§9.10 explains why the test cannot deliver it)

#### ‼️ DESIGN RULES — how this stays information-dense AND readable (owner-mandated)

> **Owner:** *"a nice interactive UI that gives all the information, but not in a way that is very difficult
> to read — in a meaningful way, separated out. Proper UI is very important here."*

| Rule | Why |
|---|---|
| ‼️ **One job per screen** | Never two decisions on one page. Four steps exist so that each is trivial |
| ‼️ **One expander maximum per screen** | Everything dense lives in the **status card's** collapsible panels, never inside the wizard |
| **Colour carries exactly one meaning throughout** | 🟢 connected/working · 🔵 in progress · 🟠 needs attention/limit · navy neutral. **No other colour means anything** |
| **Progressive disclosure, never a wall** | The *why* is always one tap away and never in the default view |
| **Every failure names its own fix** | Four distinct test failures ⇒ four distinct messages (§9.10). Never "something went wrong" |
| ‼️ **No technical word a provider can read** (§0.7.1) | Banned: *conditional · DID · diversion · MMI · carrier rule · timer · forwarding condition · unconditional*. Say **your number · your phone · your assistant · rings · connected** |
| **Every string a localization key** (§0.10) | All five partner-web languages: en-US, es-US, fr-CA, gu-IN, hi-IN |

### 9.3 ‼️ DETECTION — never ask the provider what we can look up

| What | Where it comes from | Can they change it? |
|---|---|---|
| **Country** | The business address the platform already holds — the same one that resolves the payment gateway and voice carrier | No — it gates availability (§8.1) |
| **Phone number** | **Pre-filled from their profile**, never retyped | ✅ **Yes — editable.** The business number and the phone they carry are often different |
| **Carrier + line type** | ‼️ **Telnyx Number Lookup API** — returns carrier name, **line type (mobile / landline / VoIP)**, and portability: *the actual serving carrier today, not the original* | ✅ Yes — shown, correctable |

‼️ **Line type from the lookup removes an entire question.** We never ask *"what kind of phone is this?"* —
we look it up and route the flow. Ported numbers are common and the lookup already resolves them, which a
provider guessing their own carrier would get wrong.

**Still correctable, always.** Dual-SIM and recent ports make any detection fallible, and a provider
correcting it is cheaper than a wrong instruction set.

#### ‼️ WHICH LOOKUP, PER REGION — and what it costs (researched 2026-09-15)

| Region | Provider | Price | Returns |
|---|---|---|---|
| **Canada + US** | **Telnyx Number Lookup** | **$0.0015** per query (carrier only; caller-name would add more — **we do not need it**) | Carrier name, **line type**, portability = *the actual serving carrier today* |
| **India** | **Plivo Lookup** (owner ruling) | **$0.0040** per request; **bundles available** for less | Carrier type (mobile / landline / VoIP / premium / special), MCC + MNC, 90+ countries |

**Matches the existing carrier seam** — Telnyx for CA/US, Plivo for India — so no new vendor relationship.

‼️ **The cost is not a consideration: one lookup per provider at setup, plus the occasional re-check.**
A third of a cent. **Far cheaper than asking the provider and getting a ported number wrong**, which costs a
failed setup and a support ticket.

**Fallback if a lookup fails or returns nothing:** show a **carrier picker** for that country rather than
blocking. A wrong-but-correctable guess beats a dead end.

### 9.4 ‼️ WHY LANDLINES GET A DIFFERENT ROUTE — and it is not a dead end

The mobile story does not transfer (§8.3): a different code family (`*90`/`*92`, not `*61`/`*67`/`*62`),
**no `*004*`**, ‼️ **no "unreachable" condition** (a landline cannot leave coverage), and ‼️ **Bell
residential offers no conditional forwarding at all.** Business VoIP — RingCentral, 8x8, Ooma, Google
Voice — has **no dial codes whatsoever**, only a web portal. And there is no handset to tap from.

‼️ **But landlines almost always support UNCONDITIONAL forwarding (`*72`).** So the landline route is not
*"not supported"* — it is **the admin-assisted "assistant answers every call" path** (§3.2), which for a
business line nobody answers anyway is often what they actually want.

> **Landline copy:** *"We can set your assistant up to answer every call to this line. Someone from our team
> will call you to arrange it."* → admin alert. **Never a dead end, never the word "unsupported".**

### 9.5 ‼️ WHERE ADMIN PROVISIONING SITS IN THE FLOW (owner ruling §7 — purchase stays admin)

The provider chooses the mode **up front**, so admin knows what to provision — but the phone-setup steps
cannot exist until the DID does.

| | What happens | Surface |
|---|---|---|
| 1 | Application form — **they choose "use my own number" here** | web + mobile |
| 2 | Submit → **admin alert** (existing) | — |
| 3 | ‼️ **Waiting state** — *"We're setting up your number. Next you'll spend about two minutes on your phone connecting it."* | web + mobile |
| 4 | Admin assigns the DID (existing `assign-number`) | admin |
| 5 | **Notification + email: "Your assistant is ready to connect"** | push + email |
| 6 | **Setup wizard unlocks** — checks, timer, codes, test | ‼️ **mobile-first** |

‼️ **The waiting state must say what comes next.** Today it ends at "waiting for a number"; in own-number
mode that is only half the journey, and a provider who thinks they are finished will never dial the codes.

### 9.6 ‼️ MOBILE IS THE PRIMARY SURFACE HERE — not a mirror

This inverts the usual rule (§0.7.1 says mobile mirrors web; here **web mirrors mobile**), because the codes
are dialled **on the phone being configured**.

| | Role |
|---|---|
| **Partner mobile app** | ‼️ **The real flow.** One-tap dial on Android; copy-to-clipboard + "paste into your keypad" on iPhone (§9) |
| **Partner web** | Choice, status, verification result, turn-off — and a **QR code / deep link** to continue on the phone. **A browser cannot dial the phone being programmed** |

### 9.7 ‼️ THE PRE-FLIGHT CHECKS — the screen that decides whether this works at all

Both settings send calls to voicemail **bypassing forwarding entirely**, and both fail *invisibly* because
the provider's own test calls come from their own contacts.

| Check | Why it matters — in provider words | iPhone | Android |
|---|---|---|---|
| ‼️ **Silence Unknown Callers → OFF** | *"New customers call from numbers you haven't saved. With this on, they go to your voicemail and your assistant never hears them."* | Settings → Apps → Phone → Silence Unknown Callers | Phone app → Settings → Blocked numbers / Caller ID & spam |
| **Do Not Disturb / Focus** | *"If your phone is on Do Not Disturb, calls may go to voicemail instead of your assistant."* | Settings → Focus | Settings → Do Not Disturb |
| iOS 26 **Call Screening** / **Live Voicemail** | Same class of risk — may answer before the network does | Settings → Apps → Phone | n/a |

‼️ **Do Not Disturb behaviour is UNMEASURED.** Until tested, the copy must say *"may"*, not *"will"*.

### 9.8 ‼️ THE HOW-IT-WORKS CARD — four lines, and one of them is a feature

Shown at the end of setup and permanently in settings. Plain words only (§0.7.1):

> - **Don't pick up, or silence the ring** → your assistant answers and tells you what they wanted
> - **Phone off or no signal** → your assistant answers straight away
> - ‼️ **Decline the call (red button)** → goes to **your own voicemail** — your assistant stays out of it.
>   **Use this for calls you don't want your assistant to handle**
> - **Answer it yourself** → a normal private call. Not recorded, not summarised

‼️ **The third line is a capability, not an apology** (§2.1 reframe). It is how a provider keeps junk calls
off their assistant and off their bill. Never word it as a limitation.

### 9.9 ‼️ "WHAT'S NOT SUPPORTED" — say it BEFORE they pay, not after

| Plain-words statement | Why |
|---|---|
| *"Calls you answer yourself stay private — they're not recorded or summarised."* | Structural (§3.3). Most providers read this as a **feature** |
| *"Your assistant can't answer before your phone rings."* | §3.2 — `*21*` exists but is admin-only |
| *"You'll join live calls from the app, not by us ringing your phone."* | §5.3 |
| *"Declined calls go to your voicemail, not your assistant."* | §2.1 — pair it with the reframe so it reads as control |
| *"Your carrier may charge for forwarded calls."* | §11 — an unlimited plan does **not** imply unlimited forwarding |
| ‼️ *"If you cancel, turn forwarding off on your phone too — we can't do it for you."* | §10.3. Shown at cancel **and** emailed |

‼️ **All of it is a localization key in every language file** (§0.10), and **no technical word a provider can
read** (§0.7.1) — no "conditional", "DID", "diversion", "MMI", "carrier rule", "no-reply timer".

### 9.10 ‼️‼️ THE TEST CALL — the complete mechanic

The single most important interaction in the feature. It is the *"your assistant is ready"* moment, it is
the only thing that can honestly turn the status green (§10.1), and it is easy to hand-wave and then get
wrong in build. Everything below is specified.

#### The topology — a loop out through the network and back to us

```
  Clinket ──outbound via Telnyx/Plivo──►  the provider's OWN number
                                                 │
                                        their phone rings ~10 s
                                                 │  nobody answers
                                                 ▼
                                        their carrier forwards
                                                 │
  Clinket ◄──inbound on THEIR Clinket DID────────┘
```

**We place the call and the same call comes back to us. The arrival IS the proof** — nothing else can put a
call on that DID, because in this mode it is never published (§10.2).

#### ‼️ THE AI MUST NOT ANSWER — and it could not be heard even if it did

A natural but wrong assumption is *"the phone stops ringing, then the assistant answers and they hear it."*
**Trace the audio:** we call **them**; they do not answer; the carrier forwards the call **to us**. Both ends
are now Clinket. **Their phone has stopped ringing — they are not in the call.**

If the AI answered it would be **talking to our own outbound robot**: spending minutes, writing a call
summary, producing a recording of nothing, and **the provider would hear none of it.**

| | |
|---|---|
| ‼️ **So the test short-circuits before answering** | At `call.initiated` on that DID, check for a pending test matching this `From`. If found: record the arrival and drop the call. **No answer ⇒ no answered-leg billing, no AI minutes, no summary, no recording** |
| ✅ **The AI-answers half is proven separately and more cheaply** | The provider calls their own Clinket number and hears it — surfaced as the **"Call your assistant to hear it"** button on the status card (§9.2). One deliberate call instead of one on every setup |

#### The verification caller — ‼️ TWO numbers, and they must be two

| Region | Number | Why |
|---|---|---|
| **Canada + US** | one **Telnyx** number | Same NANP, same carrier seam |
| **India** | a separate **Plivo** number | ‼️ **Mandatory, not preference** — the codebase already states it: *"India DoT rules mandate a Plivo-rented Indian number as caller ID (no non-owned CLI passthrough there)"* |

**Proposed setting section `Voice:Verification`, per stamp.** In `appsettings.json` (both hosts read it), so
**no ARM/`deploy.ps1` change** under §4 — but ‼️ **two real numbers must be purchased**, one per region.

‼️ **DO NOT reuse `Telnyx:TransactionalFromNumber` (`+18449254651`):** it is toll-free, it is the SMS sender,
and **Clinket's own `Telnyx:FraudDetection:HighRiskAreaCodes` lists `844`** — originating voice from it
invites being flagged or blocked.

‼️ **DO NOT use the provider's own DID as the caller ID:** calling their DID *from* their DID produces a
self-referential loop some carriers reject, and it destroys the correlation signal below.

✅ **And the choice of an unfamiliar number is deliberate**: the verification caller is **not in the
provider's contacts**, so the test **also exercises the unknown-caller path** — closing the exact gap that
invalidated every manual test in §13.0, where every call came from a known contact (§2.1).

#### Correlation — collision-proof with no extra machinery

Recorded at T0: `businessId`, the provider's number, the outbound call id, the timestamp. The forwarded leg
arrives with **`From` = our verification number**, **on their DID**.

‼️ **Even with a hundred providers testing simultaneously there is no ambiguity**, because each forwarded
call lands on **its own DID**, which already resolves to exactly one business — the same point-read
(`voiceline_{e164}`) that makes the whole design work (§11.1). **No Diversion header, no lookup table.**

#### ‼️ FAILURE DIAGNOSIS — AMD turns one vague failure into four precise ones

Put **AMD on the outbound leg**. The machinery already exists — `ResolveAmdDetectionMode` (Telnyx) and
`enableAmd: true` (Plivo).

| Observed | Diagnosis | What the provider is told |
|---|---|---|
| **Inbound arrives on the DID** | ✅ **Working** | *"Received — your number is connected."* + the measured delay |
| Outbound **answered**, AMD = **machine** | ‼️ **Voicemail intercepted** (§8) | *"Your voicemail picked up first. Let's make your phone ring for less time."* → offers the shorter setting |
| Outbound **answered**, AMD = **human** | **They picked up** | *"Looks like you answered. Let it ring this time."* → retry |
| Outbound **not answered**, nothing arrives by 45 s | Forwarding not saved, or wrong number | *"We didn't get the call. Let's check the code again."* → back to step 3 |
| Outbound **fails to connect** | Wrong/unreachable number | *"We couldn't reach that number."* → back to step 1 |

**Four real failures, four different fixes.** ‼️ **Never a generic "something went wrong"** — that is the
difference between a provider who self-serves and a support ticket.

#### The measured delay — and its honesty limit

`T1 − T0` = the ring timer **plus** call setup and routing, so it slightly **overstates** the timer.

‼️ **Therefore: round to the nearest 5 and always say "about".** *"Your phone rings for about 10 seconds."*
**Never "10.0 seconds".** Claiming precision we do not have is exactly how a status starts lying — and this
is the only way to know the delay at all, because the carrier will not report the stored timer (§13.0).

✅ **It also silently catches carrier rounding:** if a network stored something other than what was dialled,
the measurement shows the truth without any per-carrier rounding table to maintain.

#### The screen

```
┌──────────────────────────────────────────────┐        ┌──────────────────────────────────┐
│  Let's check it works                        │        │              ✓                   │
│                                              │        │   Your number is connected       │
│      ((•))   Calling your phone…             │   →    │                                  │
│                                              │        │   Your phone rings for about     │
│  ⚠  Please DON'T answer.                     │        │   10 seconds, then your          │
│     Let it ring, or silence it.              │        │   assistant answers.             │
│                                              │        │                                  │
│  ● Calling                                   │        │   ▸ How it works                 │
│  ○ Your phone should be ringing              │        │            [ Done ]              │
│  ○ Waiting for your assistant                │        └──────────────────────────────────┘
│                                              │
│              Skip, I'll check later          │
└──────────────────────────────────────────────┘
```

**Skip** is always available and leaves the status honestly at **"Not checked yet"** — ‼️ **never a green
badge that was never earned.**

#### ‼️ ABUSE CONTROLS — this endpoint places a REAL outbound call (owner-raised)

> **Owner:** *"we should not make it a free endpoint so it can be misused."*

Unprotected, this is both a cost leak and **a free robocall gun pointed at any number in the world.**

| Control | Requirement |
|---|---|
| ‼️ **The target is NEVER user-supplied** | Read **server-side** from the provider's saved, **ownership-verified** number. ‼️ **A request body carrying a phone number IS the vulnerability** |
| **Ownership — the arrival IS the proof** (ruling 34) | No OTP: only the controller of a line can make a call to it arrive on this business's DID. Before the first dial: a confirm dialog + a target blocklist (never a Clinket DID, a verification number, or a short/premium code) |
| **Authenticated + permission-scoped** | `voice.settings.manage`, business-scoped, through the existing `[RequiresPermission]` pipeline |
| **Hard rate limit** | A few per hour and roughly a dozen per day **per business** — the `McpToolRateLimiter` / `AiRateLimitingService` pattern |
| **State-gated** | Callable only while connecting, re-verifying or disconnecting. **Not from an arbitrary state** |
| **Single-flight** | One test in flight per business; a second request returns the in-flight one |
| **Fully audited** | Every invocation logged with business, target (masked), outcome |

#### ‼️ ADMIN ALERTS — on PATTERNS, never on instances

> **Owner:** *"we need the admin alert for sure."* — Agreed, **but aimed correctly.**

A failed provider test is a **normal, expected outcome** (voicemail, they answered, a mistyped code).
‼️ **Alerting on every one would bury the admin in noise and train everyone to ignore the channel** — which
is worse than no alert at all.

| ✅ Alert | ❌ Do not alert |
|---|---|
| **Same provider fails 3+ times in a row** — they are stuck and about to churn | A single failure. The provider already sees it and is given the fix |
| **Failure rate for a whole carrier spikes** — systemic, e.g. a carrier changed behaviour | Ordinary day-to-day failures |
| ‼️ **The test infrastructure itself errors** — the outbound leg cannot be placed, or the verification number is rejected | — |

‼️ **The third is the critical one.** If the verification number gets blocked or the outbound path breaks,
**every provider's setup fails silently and nobody finds out** until churn shows up in a report. Route all
three through `FailureNotificationHelper` with `forceAdminAlert` (§3.10).

#### What the test does NOT prove

- ❌ **Not the busy condition.** A decline never reaches us on iPhone (§2.1). Testing `67` needs a real second call
- ❌ **Not the unreachable condition.** That needs the phone genuinely powered off
- ❌ **Not that it still works tomorrow.** Only that it worked at that instant (§10.1)

‼️ **So the success copy must be precise: *"we tested calls you don't answer"* — never *"everything is
working"*.** One passing condition has never proved the others (§10).

---

## 10. VERIFICATION — never claim "you're live" without proving it

The codes are dialled on the provider's handset. The server sees nothing. So activation must be **proved**,
not assumed — this is the "your assistant is ready" moment Equal produces and it is the difference between
a product and a hope.

**The test:** Clinket places an outbound call to the provider's own number and tells them **not to answer**.
If the conditional rule is live, the carrier forwards it to the hidden DID and we receive an inbound call we
can correlate to the pending test. Received → proven. Not received → the rule did not take.

Three requirements, all non-negotiable:
1. ‼️ **The test call must be tagged and must never reach the AI.** It arrives as a perfectly ordinary
   inbound call on the provider's DID. Untagged, it spends AI minutes and generates a summary of a robot
   calling itself.
2. **One condition proven ≠ three proven.** A declined test proves *busy* only. Say exactly which conditions
   were verified — "we tested calls you don't answer" — and never imply the others.
3. **Calling the hidden DID directly proves nothing** about forwarding. It only proves the assistant works.

And the mirror image, which Equal's own help warns about and which will otherwise become our worst support
category: **forwarding survives cancellation.** If a provider cancels Clinket and their carrier still
forwards, their customers reach a dead number. Deactivation instructions (`##004#` / `##002#`) must ship
**with** the feature, be shown on cancel, and be emailed — not written later.

### 10.1 ‼️ What we can and cannot see — and why the UI must not lie

> **Owner's question:** *"how will we be able to see whether it is done — how can we see and control that
> the user has done it?"*

| | Can we? | |
|---|---|---|
| Read the carrier's forwarding table from our server | ❌ **Never** | There is no API. `*#004#` is a handset-only interrogation the provider reads with their own eyes |
| Prove it worked at a moment in time | ✅ | The test call (§10) |
| Know a forwarded call arrived | ✅ **Deterministically** | §10.2 |
| Know forwarding is *still* on right now | ❌ | Only that it worked the last time we checked |
| Turn their forwarding off remotely | ❌ **Never** | Only the subscriber can. This is permanent, and it is why §10.3 matters |

‼️ **Therefore the UI must never show a live-looking status.** It shows **"Last checked: <date>"** with a
**Check again** button — never a green "Active" pill that implies we are watching. A status we cannot
refresh is a claim we cannot back, and the provider will trust it exactly when it has silently broken.

### 10.2 ‼️ The invariant that gives us monitoring for free

**In own-number mode the DID is never published to anyone.** No customer has it, no listing carries it, no
Open Page shows it. Therefore:

> **Any call arriving on that DID was put there by the provider's carrier.**

That is a deterministic signal requiring no `Diversion` header, no carrier metadata, and no new telephony.
Every inbound call on an own-number line *is* proof that forwarding was working at that moment.

What it supports:
- **"Working as of <timestamp of last received call>"** — honest, cheap, always true.
- The setup test call is just the first instance of the same signal.

‼️ **What it does NOT support: alarming on silence.** Zero calls in two weeks is indistinguishable from
"nobody phoned them". **Never raise an alert or degrade the status on silence** — it would fire constantly
on quiet providers and train everyone to ignore it.

### 10.3 Removal — ‼️ ONE call, and one code covers every setup

> **Owner's question:** *"how will I remove this after — is there a separate three calls?"*

**No. Removal is a single dial, and it is the same single dial whichever setup they used.**

| Market | Clear conditional only | ‼️ **Clear EVERYTHING — recommended** |
|---|---|---|
| Canada (Rogers, Fido, Bell, Telus, Freedom) | `##004#` | **`##002#`** |
| US — AT&T, T-Mobile | `##004#` | **`##002#`** |
| US — Verizon, US Cellular | `*73` | `*73` (no GSM code works) |
| India — Airtel, Jio, Vi | `##004#` | **`##002#`** |

**Always instruct `##002#`.** It erases conditional *and* unconditional forwarding in one dial, so it works
whether the provider set up with `*004*` or `*21*` — which means **we never have to remember which they
chose** in order to tell them how to undo it. That removes a whole class of state and a whole class of
support ticket.

Removal must be verified in reverse (§6.1): a test call must now go **unanswered**, not arrive at us.
**Arrival = failure.**

### 10.4 When to re-verify

Not on a timer for its own sake — on the events that actually break it:

- The provider edits their phone number in Clinket
- They tell us the assistant is not answering
- They switch modes in either direction (§6.1)
- They report changing carrier, plan, SIM or handset
- A manual **Check again**, always available

An optional low-frequency scheduled re-check (monthly) is reasonable *if* it is silent on success and never
alarms on silence. Decide it at pilot, on real failure rates — not up front.

---

## 11. COST

| Item | Who pays | Note |
|---|---|---|
| Hidden DID rental | Clinket | ~US$1/mo (Telnyx CA/US); ₹200/mo list (Plivo India). **Per provider, per month, forever** — including providers who never get a forwarded call |
| Forwarded-leg minutes | Clinket | Only on calls the provider missed |
| Carrier forwarding charge | **The provider** | Plan-dependent. An unlimited plan does **not** imply unlimited forwarding. Must be disclosed |
| AI / model / recording / storage | Clinket | Unchanged |

**The economics improve where it matters:** every call the provider answers themselves now costs Clinket
nothing at all — today that call would have been dialled out by us. The recurring DID rental is the price of
that, and it is the one number to watch if own-number mode becomes popular among low-volume providers.

### 11.1 ‼️ ONE SHARED NUMBER FOR ALL PROVIDERS — NO. This is the decision that could break tenancy

> **Owner's question:** *"Can I have one number for all the providers who want to use this? When we get
> calls from multiple providers, can we differentiate?"*

**Forwarding to a shared number would work. Telling the calls apart would not.** Here is what a forwarded
call actually carries:

| Field | Value on a forwarded call | Can it identify the business? |
|---|---|---|
| `From` | ‼️ **the original customer who dialled** | ❌ **Never.** One customer can call many businesses |
| `To` | our number | ❌ It is the same number for everyone in a shared design |
| SIP `Diversion` / `ForwardedFrom` | the provider's own number — **only if every hop preserved it** | ⚠️ **Carrier-dependent. This is the whole problem** |

That header must survive: the provider's mobile carrier → the PSTN interconnect → Telnyx/Plivo → our
webhook. **Any hop may drop it, and they do.**

**Three pieces of verified evidence, not assumption:**
1. ‼️ **Clinket's own parser does not read it and never has.** `TelnyxWebhookParser.Parse` lifts
   `call_control_id`, `call_session_id`, `client_state`, `direction`, `from`, `to`, `hangup_cause`,
   `result`, recording and transcription fields — **and nothing about a diverting party**
   ([TelnyxWebhookParser.cs](../../clinqetinfrastructure/Services/Communication/TelnyxWebhookParser.cs)).
   `VoiceTelephonyEvent` has no field for it either.
2. **Telnyx documents Diversion for the OUTBOUND direction** — we must *send* it (which is exactly what our
   private-mode REFER does, or Telnyx rejects with `403 ... D51`). Inbound preservation is the unreliable one.
3. **Independently reported stripped in practice** — a public report of exactly this failure mode on an AI
   voice product: the Diversion header missing from the webhook's custom SIP headers.

**The failure mode is not a degraded call — it is a cross-tenant breach.** Miss the routing and a customer
phoning Salon A reaches Salon B's assistant: wrong business name spoken aloud, wrong services quoted, wrong
knowledge base, and a booking written into the wrong calendar. Fail-closed is barely better — a real
customer hears "sorry, I can't help you" on a call the provider paid for.

**And the saving does not justify it.** A Telnyx local DID is ~US$1/month. 100 own-number providers ≈
US$100/month — a rounding error beside the AI minutes those same calls consume.

### 11.2 ‼️ FULL WEB RESEARCH ON THE SHARED-DID QUESTION (owner-requested, 2026-09-14) — **CONFIRMED NO**

Re-researched from scratch rather than from memory, because the cost saving would be real. **Four
independent lines of evidence, all pointing the same way.**

**1. Diversion works — but only when the call starts on a SIP system you control.** Telnyx's custom-SIP-header
feature is documented as *"configure your PBX or carrier platform to insert custom SIP headers"*, and
Synthflow's diversion-routing guide describes headers *"injected pre-call by SIP, CRM webhook, or lambda
function."* **Both describe a PBX/SIP trunk inserting the header — not a mobile carrier forwarding over the
PSTN**, which is our entire use case.

**2. It is reported stripped in practice, on Telnyx, by people building exactly this.** Two separate public
reports: *"Inbound SIP Diversion header not visible in webhook custom_sip_headers"* and *"Diversion SIP
header stripped/missing from custom_sip_headers webhook payload."*

**3. The telecom answer is "ask your carrier".** *"The Diversion Header technique is not universally used,
customers need to check with their SIP providers"*; *"if your telco does not allow passing original called
information, that is beyond the scope of the PBX."* **A feature whose availability must be negotiated per
carrier cannot underpin tenant routing for providers on carriers we never contract with.**

**4. ‼️ THE DECISIVE ONE — the industry does not do it.** **Smith.ai**, one of the largest receptionist
services in North America, gives **every customer their own "Smith.ai Number"** and instructs conditional
forwarding to it. At their volume the saving would dwarf ours. **They still buy a number per customer.**

**And their docs reveal a SECOND job for the dedicated number we had not counted:** outbound calls placed
on the customer's behalf show that number, so *"if someone called back at that number, they still reach the
right business."* ‼️ **On a shared DID a callback is unroutable** — the caller is dialling a number that
means nothing about which business they want. That is a second, independent reason, unrelated to Diversion.

#### ‼️ "Then how does Equal do it?" — the arithmetic says they CANNOT be renting one number per user

**Start with the numbers.** Plivo India list is ₹200/month; the wider Indian market is typically
US$5–15/month per virtual number. Equal reports 5M+ installs, ~1M MAU, ~350k DAU, on a **US$30M Series B**.

> Even at a deeply discounted ₹50/month, **1M users ≈ ₹50M/month ≈ US$600k/month**. That is a quarter of
> their entire Series B **every four months**, on number rental alone.

**So they are not buying a DID per user. Something else identifies the subscriber.**

##### ‼️ WHAT "DEFAULT CALLER ID APP" ACTUALLY MEANS — the app NEVER answers the call

A common and costly misreading is that the app *picks up*. **It cannot, and this is settled.**

**Google blocked third-party access to call audio at Android 10 (2019), and closed the Accessibility-API
workaround in May 2022.** No third-party app on Android can hear, record, or answer a cellular call.
**iOS has no equivalent role at all.**

What the default Caller ID & Spam role *does* grant is `CallScreeningService`, which fires **on every
incoming call, before it rings**, hands the app the **caller's number**, and lets it respond: allow ·
silence · reject · block. **That is the entire surface: knowledge and ringing control. No audio, ever.**

So the real sequence is:

```
Caller dials the provider's OWN number
   → Android asks the app "what do I do with this?"   ← app learns WHO is calling and WHEN
   → app says "silence" (or allows it)
   → the call rings out AT THE NETWORK
   → the CARRIER's forwarding rule sends it to the server
   → ‼️ THE SERVER answers — not the app
```

‼️ **The app's only contribution is telling the server WHICH SUBSCRIBER this call belongs to.** It is an
**informant, not an answerer** — and that is precisely what makes a shared number possible for them and
impossible for us.

##### ‼️ THE LIKELY MECHANISM — the app correlates the call. (INFERENCE, not established.)

Everything fits if the identification happens **on the phone, not in the network**:

1. Equal's setup **requires their app to be the default Caller ID & Spam app** — their own documented step.
2. That role grants `CallScreeningService`, which fires **on every incoming call, before it rings**, and
   hands the app the caller's number.
3. So the app knows *"a call from +91XXXXX is arriving at MY phone, right now"* — and can tell the server.
4. The forwarded call then lands on a **shared** Equal number with `From` = +91XXXXX.
5. The server matches **caller number + a few-second time window** → identifies the subscriber → answers
   with their context.

**This explains every otherwise-odd fact at once:** the shared-number economics, why the app permission is
mandatory (it is not only for silencing — §2.1), why the product is Android-first, and why a service that is
"just call forwarding" needs an app on the phone at all.

‼️ **And it is exactly what a consumer app can do and a B2B platform cannot.** Clinket has no app on the
provider's phone holding the call-screening role, and **on iOS the role does not exist**. Their architecture
is not portable to ours.

**Alternatives not ruled out:** a direct telco/licence relationship (Equal Identity is an established Indian
identity company); far fewer active users than installs suggest; or Indian carriers genuinely passing the
diverting number where North American ones do not. **All unverified.**

##### ✅ ONE CHEAP EXPERIMENT WOULD SETTLE INDIA — worth running

North America is proven to strip the diverting number. **India was never tested, and India is where the cost
actually hurts.**

> Forward an Indian mobile to a Plivo India DID, place a missed call, and **log the complete raw webhook
> payload** — every field, not just the ones `PlivoVoiceCallControlFunction` currently reads. Look for
> `ForwardedFrom` or any field carrying the *diverting* number.

| Result | Consequence |
|---|---|
| A diverting number **is** present, on Airtel **and** Jio **and** Vi | A shared-pool design becomes possible **in India only** — and must still fail closed when the field is absent |
| Absent or inconsistent | Settled: one DID per provider everywhere. Stop asking |

**One test, and the India cost question is answered with data instead of inference.**

#### The cost, honestly

| | |
|---|---|
| Telnyx local DID | **~US$1/month** |
| A single ~3-minute AI call | model + telephony + transcription — **already more than a month of DID rental** |

**The DID costs about one phone call per month.** And the existing release + quarantine path already
recycles numbers from cancelled providers, so dormant inventory is reclaimed rather than accumulating.

##### ‼️ India is the real cost, and ₹200 is a LIST price — not a fixed one

| Lever | Detail |
|---|---|
| **Negotiate with Plivo first** | Plivo publicly offers **volume discounts on committed spend**, and their Enterprise tier exists to unlock them. ‼️ **Negotiating beats switching**, because the India integration (`PlivoVoiceCallControlFunction`, `PlivoVoiceRelay`, the MPC + ai-agent relay) is already built and paid for |
| **Ask for the cheapest inbound-capable class** | ‼️ **In own-number mode the DID is never published** — it needs no memorable digits, no local area, no mobile series. **Whatever is cheapest that can receive a call.** This has probably never been asked |
| **Quote alternatives as leverage** | Exotel (the Indian incumbent for exactly this), Ozonetel, Knowlarity/Gupshup, MyOperator, Servetel/Acefone, Tata Tele, Airtel IQ — all price per number on negotiated enterprise terms |
| **Buy at activation, release at cancel** | Already built |
| **Sequence India after CA/US** | The number is ~US$1 in Canada. **Prove the whole product where it is cheap, then negotiate India from a position of real volume** |

‼️ **Do not switch India carriers on price alone** — the shipped Plivo integration is a sunk, working asset,
and rebuilding it would cost far more than the rental difference.

‼️ **Decision: one DID per provider. This is not a preference, it is the tenancy boundary.**

**It also means zero new routing code.** The dedicated DID *is* the business key: the line is a point-read
on the dialled number (`voiceline_{e164}` as both id and partition key —
[VoicelineRepository.cs:32](../../clinqetinfrastructure/Data/COSMOS/VoicelineRepository.cs#L32)). Each
provider dials **their own** number into `*004*`, so the carrier delivers the call to a number that already
means exactly one business. No header parsing, no lookup table, no cross-partition query (§0.6), nothing to
build.

---

## 12. RISKS THAT WILL ACTUALLY BITE

| # | Risk | Severity | Mitigation |
|---|---|---|---|
| 1 | **Dial-back loop** (§5.1) | **Critical** | Force `ForwardTo=""` + `AiFirst` in the sync. Pin it with a test that asserts no dial is ever issued in own-number mode, on both carriers |
| 1b | ‼️‼️ **"Silence Unknown Callers" silently kills the product** — new customers are unknown numbers, and the setting **bypasses forwarding entirely**. It fails *invisibly*, because the provider's own tests use their own contacts | ‼️ **CRITICAL** | Mandatory pre-flight step (§9.7) **and** the verification call originates from a number **not in their contacts** (§9.10), so the test exercises the real path |
| 2 | **Voicemail wins; forwarding never fires** | **High** | ✅ **SOLVED for the tested carrier by the 10 s timer** (§13.0). For every other carrier it is unproven — the test call is the only proof |
| 2b | ‼️ **A later `*004*` silently reverts the timer** and nothing looks wrong — destination stays correct, only the timing moves | **High** | `61`-with-timer is registered **LAST**, always (§2.1); re-verify after any change |
| 3 | **Test call reaches the AI** — a robot talking to itself, spending minutes and writing a summary | High | Short-circuit at `call.initiated` **before answering**, matched on pending-test + `From` (§9.10) |
| 3b | ‼️ **The test endpoint becomes a free robocall gun** | ‼️ **Critical** | Target **server-side only** from the verified number · ownership verified first · permission-scoped · rate-limited · state-gated · single-flight · audited (§9.10) |
| 3c | ‼️ **Verification number blocked ⇒ EVERY provider's setup fails silently** | **High** | Alert on **test-infrastructure failure** specifically — not on individual provider failures (§9.10) |
| 3d | **Admin alert fatigue** — alerting on every failed provider test buries the channel | Medium | Alert on **patterns only**: 3+ consecutive, carrier-wide spikes, infrastructure errors (§9.10) |
| 4 | **Stale forwarding after cancellation** | High | Ship deactivation codes with the feature; show on cancel + email |
| 5 | **India number supply blocked by KYC** | High | Settle in writing before promising self-serve in India |
| 6 | Provider changes carrier / SIM / number | Medium | Re-verify on demand; a "test again" action |
| 7 | iPhone Live Voicemail / on-device screening answers first | Medium | Must be tested on a real device; do not assume |
| 8 | Two meanings on `ForwardingTarget` (§5.2) | Medium | Decision 5 |
| 9 | Provider expects summaries of calls they answered | Medium | Say it at setup, in plain words, before payment (§9.9) |
| 10 | Phone-join unavailable (§5.3) | Low | Hide it; browser/app join unaffected |
| 11 | ‼️ **Declining goes to voicemail, not the assistant** (iPhone, confirmed) | Medium | **Reframed as a feature** — the junk-call path (§2.1). Copy: *"press once to silence, never the red button"* |
| 12 | **A future session "fixes" the red button** and starts charging providers for junk calls | Medium | Logged as a **deliberate design decision**, not a known issue (§2.1) |
| 13 | ‼️ **Generalising one carrier's result to all** — everything proven so far is ONE carrier, ONE handset, ONE known-contact caller | **High** | §15 evidence ledger; per-country + per-carrier gating (§8.1); nothing switched on until tested |
| 14 | **Provider reaches the test with the phone in another room** | Low | *"Have your phone with you"* stated **before** the wizard starts (§9.2) |
| 15 | **Status badge implies live monitoring we do not have** | Medium | **"Last checked \<date\>" only**, never a live "Active" pill; never alarm on silence (§10.1, §10.2) |

---

## 13. PHASED PLAN

Nothing below is approved. Each phase ends with evidence, not a claim.

| Phase | Work | Status / exit condition |
|---|---|---|
| **0 — Decide** | §14 | ✅ **DONE** — 25 rulings closed, one open (schema, ruling 11) |
| **1 — ‼️ ZERO-CODE CARRIER PROOF** (§13.0, §13.1) | Owner's own Canadian phone + an existing CA line set to `AiFirst`. No code, no purchase | ✅ **DONE FOR ONE CANADIAN CARRIER.** The mechanism is proven and the timer fix makes Canada self-serve. ‼️ **Still open: an unknown-number call, Android, every other carrier, and India (§15)** |
| **2 — ‼️ MOCKUP** (§0.20) | `Data\mockups\voice-keep-your-number\index.html` — **web AND mobile**, every state in §9.2 + §13.2 | ⏸️ **BLOCKED ON OWNER APPROVAL OF THIS PLAN** (ruling 25). Then drawn, approved, and **registered in §16** |
| **3 — Runtime** | The §5.1 sync fix · the §9.10 test-call short-circuit · the abuse controls · the pattern-based alerts | Unit + integration green on **both** carriers; a deliberate sabotage (re-arming `ForwardTo`) makes them fail |
| **4 — Onboarding + switch flow** | The four-step wizard, per-country gate, lookup, pre-flight checks, codes, live test, status card, disconnect + reverse verification | Localized ×5 (§0.10); zero technical words (§0.7.1); mobile-first with web parity |
| **5 — Pilot** | A handful of real providers on tested carriers | Activation-completion rate, failed-forward rate, support load |

‼️ **Phase 1 was the gate and it passed — for one carrier.** Its remaining gaps (§15) do not block the
mockup, but they **do** block switching a carrier or a region on.

### 13.2 ‼️ THE STATE INVENTORY THE MOCKUP MUST COVER — web AND mobile, every one

**Happy path:** entry card · *What changes?* expanded · step 1 number+lookup · step 2 checks (iPhone) ·
step 2 checks (Android) · step 3 codes (iPhone copy) · step 3 codes (Android tap, second locked) ·
step 3 after first code · step 4 calling · step 4 ringing · step 4 received ✓ · connected status card ·
*How it works* expanded · *What's not supported* expanded.

**Failure + edge:** test failed — voicemail intercepted · test failed — they answered · test failed —
nothing arrived · test failed — could not connect · test skipped ("Not checked yet") · lookup failed →
carrier picker · **landline/VoIP → admin route** · **country not available** · carrier not yet certified ·
offline · dial permission denied (Android) · number ownership unverified.

**Lifecycle:** Adjust timer (10/15) · Check again (running) · Disconnect step 1 (the code) ·
Disconnect step 2 (**reverse verification — arrival = failure**) · disconnected confirmation ·
**waiting for admin to assign the number** · *"Call your assistant to hear it"*.

‼️ **A state the server can reach that the sheet cannot draw is a state that ships undesigned** (§0.20).

### 13.0 ‼️ THE 5-MINUTE CANADA TEST — what to dial, in plain steps

**You need:** your Canadian mobile · a second phone to call from · one Clinket voice number (the DID).

**Before you dial anything — three settings, or the test proves the wrong thing:**
1. Get the Clinket number: admin portal → that business's AI-assistant page → its assigned number.
2. In that business's AI-assistant settings choose **"AI answers first"** (`AiFirst`).
3. Confirm **minutes remaining** and **private mode OFF**. (A spent cap or private mode takes a different
   branch that **will** ring you back — that is the loop, not a bug in the test.)

**Then, on your Canadian phone:**

| Step | Dial / do | Expect |
|---|---|---|
| 1 | Call the Clinket number directly | The AI answers. Baseline — proves the assistant works, **nothing about forwarding** |
| 2 | **`*004*6475551234#`** then press call — ‼️ **10 digits, no `+1`, no spaces, no dashes** (if the carrier rejects it, try `*004*16475551234#`) | A carrier confirmation. **One dial sets all three rules** |
| 3 | **`*#004#`** | Reads back what your carrier stored — check the number is right before wasting a call |
| 4 | From the **second phone**, call your Canadian number and **let it ring out. Do not answer** | ‼️ **THE TEST.** The AI should answer |
| 5 | Call again and **decline** immediately | Should reach the AI faster — this is the "instant takeover" |
| 6 | Put your phone in flight mode, call again | Should reach the AI (the unreachable rule) |
| 7 | **`##002#`** | Everything removed, one dial. Call again — your phone rings normally |

**Rogers · Bell · Telus · Fido · Freedom all use these same codes.**

#### ✅ LIVE RESULT — step 2 confirmed on a Canadian iPhone, 2026-09-14

`*004*<10-digit DID>#` returned **"Setting Activation Succeeded"** — eight times, one per bearer service:

> Voice Call Forwarding · Data · Fax · SMS · Sync Data Circuit · Async Data Circuit · Packet Access ·
> Pad Access — each **"All Conditional Calls"**

**The carrier accepted it. `*004*` works on a Canadian mobile line, and one dial registered all three
conditions.** Only the first line matters — **Voice Call Forwarding / All Conditional Calls**. The other
seven are legacy circuit-switched bearer services: `*004*` with no basic-service code applies to *every*
service the network offers, so the handset confirms each one. Harmless, but **eight dialogs is a poor first
impression** and the UI must warn the provider to expect them.

**Possible tidy-up, unverified:** standard GSM defines basic-service code `11` = Telephony, so
`*004*<number>*11#` *should* register voice only and return a single confirmation. Worth one test dial —
**but the eight dialogs are cosmetic, and `*004*` is proven on this carrier while the `*11` variant is not.**
Do not put the unproven form in provider instructions until it is tested on each carrier.

‼️ **Activation succeeded ≠ calls reach us.** This proves the carrier *stored* the rule. Step 4 is still the
real test — Canadian voicemail can still intercept ahead of it (§8).

#### ‼️❌ LIVE RESULT — step 4 FAILED AS PREDICTED, 2026-09-14

**The caller heard the provider's voicemail. The call never reached the Clinket DID.**

Setup: Canadian iPhone, `*004*` accepted (all eight "Setting Activation Succeeded"), caller let it ring,
provider did not answer → **carrier voicemail answered**.

**This is §8 confirmed on a live Canadian line: carrier voicemail outranks conditional call forwarding.**
It is the predicted failure and it is the most important data point in this programme so far — it decides
whether the Canadian flow is "one tap" or "call your carrier first".

**It is not proof of the root cause yet.** Three hypotheses remain, and they are separated by three dials:

| # | Hypothesis | The test | Reading |
|---|---|---|---|
| **1** | ‼️ **Our DID is not live / not answering** — an unreachable forward target makes some carriers fall back to voicemail | Call the Clinket DID **directly** from the second phone | **AI answers ⇒ our side is fine, rule out.** Anything else ⇒ the problem is ours, not the carrier's. **Do this first — it is the cheapest and it clears our half** |
| **2** | **The rule was silently overwritten or stored against the wrong number** | `*#004#`, and `*#61#` for the no-reply rule + its timer | Right number still registered ⇒ rule out |
| **3** | ‼️ **Voicemail precedence** — the expected cause. Rogers states conditional forwarding will not work while voicemail is active; Bell's voicemail answers first | `*21*<DID>#` (unconditional) then call again. Reverse with `##002#` | **Reaches the AI ⇒ CONFIRMED.** The network path to our DID works; only the *conditional* rule loses to voicemail |

**Test 3 is the decisive one.** `*21*` never reaches a "no reply" condition, so it cannot lose to voicemail.
If unconditional reaches us and conditional does not, the diagnosis is certain and the cause is entirely on
the provider's carrier side.

#### ‼️✅ DIAGNOSIS CONFIRMED — 2026-09-14, live Canadian iPhone

| Test | Result |
|---|---|
| ① Call the Clinket DID directly | ✅ **AI answered** — our side is sound |
| ③ `*21*<DID>#` unconditional, then call | ✅ **AI answered, fully** |
| Step 4 `*004*` conditional, let it ring | ❌ **Carrier voicemail answered** |

**Hypothesis 3 is proven.** The network path to the Clinket DID is perfect. Telephony, webhook, routing,
`AiFirst`, the AI — all correct. **Only the conditional rule loses, and it loses to carrier voicemail.**

‼️ **The lesson that must shape the product: "Setting Activation Succeeded" is an acknowledgement of the
REQUEST, not a guarantee the rule wins at call time.** The handset reported success eight times and the rule
still never fired. **This is exactly why §10 requires a live test call and forbids a green "Active" pill.**
Had we trusted the confirmation dialog, every Canadian provider would have been told they were live while
every one of their missed calls went to voicemail.

#### ‼️ `*#61#` INTERROGATION — the rule IS stored correctly. 2026-09-14

```
Setting Interrogation Succeeded
Voice Call Forwarding · When Unanswered · Forwards to 2364767193 · ENABLED
Data / Fax / SMS / Sync / Async / Packet / Pad  ·  When Unanswered · Disabled
```

**Two things this settles:**
1. ‼️ **The carrier stored OUR DID and the rule is Enabled.** It did **not** overwrite the destination with
   voicemail. Hypothesis 2 is dead — the rule is correct and sitting there, and the carrier ignores it at
   call time anyway.
2. **Only Voice actually took.** Every other bearer service reads *Disabled* despite all eight activation
   dialogs saying "Succeeded". The eight dialogs really were cosmetic — the network applied voice only.

**So the rule is correct and still loses.** That leaves exactly two explanations, and they have completely
different costs:

| | Explanation | Fix | Cost |
|---|---|---|---|
| **A** | ‼️ **TIMER RACE.** The no-reply timer is longer than the carrier's voicemail pickup, so voicemail answers first. The interrogation shows **no timer value**, suggesting a long network default (20–30 s) | **Shorten the no-reply timer below voicemail's pickup** | ‼️ **FREE. One dial. No carrier contact. Canada stays fully self-serve** |
| **B** | **Voicemail subscription overrides.** The switch never consults the rule while voicemail is subscribed — the documented Rogers behaviour | Unsubscribe voicemail | A phone call to the carrier, per provider |

#### ‼️ THE DISCRIMINATING TEST — one dial decides which, and A would be a major win

```
**61*2364767193**5#
```

Standard GSM: `**61*<number>**<seconds>#`, where seconds ∈ {5, 10, 15, 20, 25, 30}. This re-registers the
no-reply rule with a **5-second** timer. The busy and unreachable rules from `*004*` are untouched.

Then call the line again from a second phone and let it ring.

| Result | Meaning |
|---|---|
| **The AI answers** | ‼️ **Explanation A — and Canada is saved.** Forwarding beats voicemail on time. No carrier call, no unsubscribe, fully self-serve. Production timer then becomes a tuned trade-off (≈10–15 s: long enough to answer, short enough to win) |
| **Voicemail still answers at 5 s** | **Explanation B.** The rule is genuinely ignored. Canada needs voicemail unsubscribed, and §8.2's fork stands |

‼️ **This is the highest-value single dial remaining in the programme.** It decides whether Canadian
own-number mode is self-serve or requires every provider to phone their carrier.

#### ‼️✅✅ RESOLVED — EXPLANATION **A**. THE TIMER FIX WORKS. Canada is self-serve. 2026-09-14

```
**61*2364767193**5#   →  caller let it ring  →  5 s  →  ‼️ THE AI ANSWERED
```

**It was a timer race, not a voicemail override.** The carrier honours the subscriber's no-reply rule
perfectly — it simply was not reached, because the default no-reply timer was longer than the carrier's
voicemail pickup. Shorten the timer below voicemail and **forwarding wins**.

| | |
|---|---|
| Voicemail must be unsubscribed | ❌ **No** |
| A phone call to the carrier | ❌ **No** |
| Provider keeps their voicemail for personal use | ✅ **Yes** |
| Canadian own-number mode is self-serve | ✅ **YES** |

‼️ **This reverses §8.2's fork.** `*21*` goes back to being the rare admin-gated exception it was designed
to be, and conditional forwarding is the self-serve default in Canada after all. **The one thing that
changes permanently: the no-reply timer must be set explicitly. The carrier default is not safe.**

‼️ **And `*004*` alone is therefore NOT a complete Canadian setup** — it writes all three rules with the
default timer, which is the losing configuration. See the sequence rule below.

#### ‼️ THE SETUP SEQUENCE — `61`-with-timer goes LAST, always

`*004*` rewrites all three rules **including `61`'s timer back to the default**. So a `004` dialled after
the timer fix silently destroys it.

**Canadian production setup — two dials:**

```
1.  *004*<DID>#              → all three rules to the DID (default timer on 61)
2.  **61*<DID>**10#          → re-register no-answer with a SHORT timer   ← MUST BE LAST
```

Or three individual dials, `61` still last:

```
**67*<DID>#      busy / declined     (no timer — fires instantly)
**62*<DID>#      unreachable         (no timer — fires instantly)
**61*<DID>**10#  no answer           ← LAST
```

‼️ **Rule for the UI and for support: never dial `004` after the timer has been set without re-dialling
`**61*…**<secs>#` afterwards.** This is the single easiest way for a working setup to silently regress to
voicemail, and neither the confirmation dialog nor `*#61#` will look wrong — the destination stays correct
and only the timer moves.

**Why `67` and `62` need no timer:** both fire the instant the condition occurs, so there is no window for
voicemail to get there first. Only `61` ever raced. **This must still be proven per condition (§10) — one
passing condition proves nothing about the others.**

#### ✅ MEASURED — the carrier's voicemail ceiling (2026-09-15)

5 s proved the mechanism but ships badly — roughly one ring, so the provider can barely answer their own
phone. The production value is a trade-off, and the **voicemail pickup time was measured rather than
guessed**:

| Timer | Result, live, 2026-09-14 |
|---|---|
| 5 s | ✅ AI answered |
| 10 s | ✅ AI answered |
| **15 s** | ✅ **AI answered — the ceiling** |
| 20 s | ❌ **voicemail won** |

**Voicemail pickup on this carrier sits between 15 and 20 seconds.**

##### ‼️ THE TIMER CANNOT BE READ BACK — `*#61#` REPORTS THE NUMBER BUT NO TIMER (2026-09-15)

Tested at **both 12 s and 10 s**: `*#61#` returns the forwarding **number** and `Enabled`, and **no timer
value at all**. **The stored timer is not readable on this carrier/handset.**

Three consequences, and the third is the useful one:

1. ‼️ **Out-of-step values cannot be validated.** `12` is *accepted* by the network (owner tested it), but
   the spec defines the timer in 5-second steps and **nothing tells us whether 12 was stored as 12, rounded
   to 10, or rounded to 15.** Not readable ⇒ not knowable by interrogation.
2. ‼️ **Interrogation is a PARTIAL view and must never back a status claim.** It has now misled twice:
   `*004*` reported "Activation Succeeded" for eight services of which seven were actually `Disabled`, and
   `*#61#` omits the timer entirely. **Only observed behaviour counts** — §10.1 confirmed a third time.
3. ✅ **But our own test call IS the measurement.** We place the outbound leg at **T0**; the forwarded leg
   arrives at **T1**. **T1 − T0 is the real, effective ring delay** — timer plus routing, which is the only
   number that actually matters to a caller.

‼️ **So verification measures, it never reads.** The test call already tells us the truth, and lets the UI
say something honest and useful in plain words:

> *"Your phone rings for about 10 seconds before your assistant answers."*

Derived from observation, not from a setting we cannot see. **And if a carrier silently rounds, the
measurement exposes it** — no interrogation needed, no per-carrier rounding table to maintain.

##### ‼️ THE STANDARD ITSELF — 3GPP TS 22.082 V9.0.0 §3.3.3, read directly (2026-09-15)

Retrieved from the ATIS-published specification, quoted verbatim:

> *"3) the duration of the no reply condition timer. Registration can take place either by the service
> provider or with an appropriate control procedure by the subscriber. **If the duration of the no reply
> condition timer is not registered by the mobile subscriber then the previous value set by the mobile
> subscriber applies. If no previous value exists, a default value set by the service provider applies. The
> value is in between 5 and 30 seconds, in steps of 5 seconds.**"*

> *"When the mobile subscriber so registers call forwarding on no reply, the network will return notification
> of acceptance or rejection of the request. **This notification will include the forwarded-to number to
> which call forwarding on no reply is registered and the duration of the no reply condition timer.**"*

**Three findings, all decisive:**

1. ‼️ **12 s is outside the standard.** The spec is explicit — *"between 5 and 30 seconds, in steps of 5
   seconds."* The handset accepting it proves the **request** was accepted, not that 12 is defined. What a
   network does with an out-of-step value is **undefined behaviour**, and it may differ per carrier.
2. ‼️ **The carrier is NON-CONFORMANT on the readback.** The spec says the notification *"will include …
   the duration of the no reply condition timer."* This carrier returns the number and omits the timer, at
   both 10 s and 12 s. **So the timer genuinely cannot be read back here — and that is the carrier's gap,
   not a missing code on our side.** Assume other carriers may do the same.
3. ‼️ **CORRECTION to the earlier §2.1 warning.** I wrote that a later `*004*` "resets the timer to the
   carrier default." **The spec says otherwise:** omitting the timer applies *"the previous value set by the
   mobile subscriber"*, and only falls back to the operator default if none was ever set. **The risk is
   smaller than stated** — but this carrier has already proven non-conformant on the notification, so do not
   bank on conformance here either. **The guidance is unchanged and safe under both readings: always set
   the timer explicitly, and register `61` LAST.**

##### ✅ FINAL TIMER RULING — **10 SECONDS, FIXED, NO PICKER AT SETUP** (owner, 2026-09-15)

**Ship 10 s.** **Adjust (10 / 15) lives on the status card only.** Full reasoning in §2.1.

**12 s is not offered** — not because it failed (it was accepted) but because it is **outside the standard**,
its handling is **undefined**, **this carrier cannot report what it stored**, and the gain over 10 s is two
seconds no caller can perceive. *Known* beats *undefined*.

**5 s is not offered** — owner ruling: too low, roughly one ring, the provider cannot answer their own phone.

**Verification therefore measures, never reads** — the test call's T1 − T0 is the real effective delay, and
it is the only number that survives a carrier that will not answer the question.

‼️ **Ship 10 s, not 15 s.** 15 is the last known-good value, which puts it within one step of the cliff —
and voicemail pickup is not perfectly constant (network load, roaming, VoWiFi). **10 s keeps a full step of
margin while still giving the provider two rings to answer their own phone.** The rule is *the highest value
that wins, minus one step*, and it exists precisely so a marginal carrier day does not silently send a
provider's calls to voicemail.

Store it **per carrier in appsettings** (§0.12), never as a constant — every carrier's voicemail pickup
differs and this one was measured on exactly one line.

**If hypothesis 3 confirms, the Canadian design changes:**
- Own-number mode in Canada requires **voicemail removed from the line first** — Rogers' own material says
  unsubscribe voicemail, which is a **call to the carrier**, not a code. ‼️ The `*91`/`*93` codes are
  documented on Rogers' **Home Phone** pages and remain **unverified for mobile** — do not ship them.
- ‼️ **The irony worth noting:** the admin-gated `*21*` mode (§3.2) would work in Canada **without** touching
  voicemail, while the self-serve conditional mode would not. The harder-to-get mode is the easier-to-run one.
- "Three taps and you're live" is **false in Canada** and must not appear in Canadian copy.
- Record the **carrier** (Rogers / Bell / Telus / Fido / Freedom) with every result — the fix differs per carrier
  and one carrier's behaviour must never be generalised to the others.

#### ‼️ If voicemail answers instead of the AI at step 4

**That is the expected Canadian failure and it is the single most valuable result this test can produce.**
It means carrier voicemail intercepts the call before forwarding can reach us (§8) — the known Rogers/Bell
behaviour, and the thing that decides whether the Canadian story is "three taps" or "call your carrier
first".

‼️ **Do not dial `*91` / `*93` to "fix" it.** Those codes are documented on Rogers' **Home Phone** support
pages; whether they behave the same on a **mobile** line is **not confirmed** and I will not have you dial
something unverified at your own line. Rogers' own material says the real requirement is to **unsubscribe
voicemail from the account** — that is a call to Rogers, not a code.

**If voicemail wins: stop, record it, and tell me.** That result changes the Canadian onboarding design and
is worth more than a completed happy path.

---

### 13.1 ‼️ THE ZERO-CODE SANDBOX PROOF — runnable today

The owner asked for a sandbox proof of the theory. **It needs no code, no new number and no purchase**,
because of one fact verified in the tree this session:

> `AiFirst` is **already a live, provider-selectable option** in the existing form
> ([VoiceApplicationForm.jsx:509](../../clinqetwebpartnerapp/src/components/Profile/voiceAssistant/VoiceApplicationForm.jsx#L509)),
> and the Telnyx `AiFirst` branch **returns before any dial is issued**
> ([VoiceCallControlFunction.cs:348](../../clinqetfuncations/Clinqet.Communications/Functions/VoiceCallControlFunction.cs#L348))
> — even while `ForwardTo` still holds the provider's number.

So an existing CA line, switched to `AiFirst` in the normal UI, already behaves **exactly** like an
own-number line. The carrier half is the only untested half, and the owner's own Canadian phone can test it.

**Preconditions — all three, or the test proves the wrong thing:**
1. The sandbox line has **minutes remaining** (a spent cap takes the `TryTransferToPartnerAsync` branch and **will** dial back — §4.1)
2. **Private mode OFF** (same branch, same dial-back)
3. Mode set to `AiFirst` in the partner UI **before** the first test call

**The run:**

| # | Step | What it proves |
|---|---|---|
| 1 | Note the sandbox Clinket DID. Set the line to `AiFirst`. Call the DID directly | The assistant answers. **Baseline only — proves nothing about forwarding** |
| 2 | On the Canadian phone dial **`*004*<DID>#`** — **one call, all three rules** (§2.1). If the carrier rejects it, fall back to `*61*<DID>#`, `*67*<DID>#`, `*62*<DID>#` | Whether the carrier accepts it, and **whether one call is enough or three are needed** |
| 2b | Dial `*#004#` to read back what the carrier actually stored | Confirms the rules landed on the right destination before wasting a test call |
| 3 | From a second phone, call the Canadian number. **Let it ring out** | ‼️ **The whole theory.** AI answers ⇒ proven. **Voicemail answers ⇒ the Rogers/Bell voicemail problem is real (§8) and must be solved before anything else** |
| 4 | Repeat, **decline** immediately | Whether decline maps to *busy*, and the real "instant takeover" latency |
| 5 | Repeat with the phone in flight mode | The *unreachable* rule |
| 6 | Time steps 3 and 4 with a stopwatch, caller-dial → first AI word | The number marketing must never exaggerate (§3.1) |
| 7 | `##004#`, then call again | **Restoration works.** Never ship without proving this |

**Record for each step:** carrier, the exact string dialled, what the carrier replied, what the caller heard,
seconds to first AI word, and whether a Clinket call summary was produced.

‼️ **What this run does NOT prove, and must not be reported as proving:** the cap-exceeded and private-mode
branches still dial `ForwardTo` and **will loop** on a forwarding line. They are excluded by precondition,
not fixed. The §5.1 fix remains mandatory before any provider touches this.

---

## 14. OWNER RULINGS — 2026-09-14 / 15 (CLOSED unless marked OPEN)

### 14.A — Rulings of 2026-09-15 (the UI + test-call session)

| # | Decision | **Ruling** |
|---|---|---|
| 14 | ‼️ **The ring timer** | ✅ **10 SECONDS, FIXED. No picker at setup.** 5 s too low; **12 s NOT offered** (outside the standard, undefined, unreadable, and a disclaimer would push a technical judgement onto the provider — §0.7.1). **Adjust (10 / 15) on the status card only.** §2.1 + §13.0 |
| 15 | ‼️ **Entry framing** | ✅ **AN ADDITION, NEVER A CHOICE.** The Clinket number stays live regardless; own-number is a **Connect** card. **Both entry points work simultaneously** and that is safe because `ForwardTo` is empty. §9.2 |
| 16 | **The setup wizard** | ✅ **Four steps:** your number → two checks → connect it → live test. ‼️ **No ring-timer step.** §9.2 |
| 17 | ‼️ **Does the AI answer the test call?** | ❌ **NO — and it could not be heard anyway.** Both legs are Clinket; the provider's phone has stopped ringing. Short-circuit before answering: no minutes, no summary, no recording. The "hear it work" moment moves to a **"Call your assistant to hear it"** button. §9.10 |
| 18 | ‼️ **Verification caller numbers** | ✅ **TWO — one Telnyx (CA+US), one Plivo (India, DoT-mandated).** Proposed `Voice:Verification` in `appsettings.json` (no ARM change). ‼️ **Never reuse `TransactionalFromNumber`** (toll-free, SMS sender, `844` is in the platform's own high-risk list) and **never the provider's own DID** (self-loop + destroys correlation). §9.10 |
| 19 | **Failure diagnosis** | ✅ **AMD on the outbound leg** → four distinct failures, four distinct fixes. ‼️ **Never a generic "something went wrong."** §9.10 |
| 20 | ‼️ **Test-endpoint abuse** | ✅ Target **server-side only** from the verified number (a request body carrying a number *is* the vulnerability) · ownership verified first · `voice.settings.manage` · hard rate limit · state-gated · single-flight · audited. §9.10 |
| 21 | ‼️ **Admin alerts** | ✅ **On PATTERNS, never instances** — 3+ consecutive failures for one provider · a carrier-wide failure spike · **the test infrastructure itself failing** (the critical one). A single failed test is normal and must not alert. §9.10 |
| 22 | **Carrier / line-type lookup** | ✅ **Telnyx for CA/US ($0.0015), Plivo for India ($0.0040)** — matching the existing carrier seam. Replaces asking *"what kind of phone is this?"* entirely. Failure ⇒ carrier picker, never a dead end. §9.3 |
| 23 | **Landline route** | ✅ **Revises ruling 9** — not *"unsupported"*. Landlines get the **admin-assisted `*72` "answers every call"** route. ‼️ **Never a dead end, never the word "unsupported."** §9.4 |
| 24 | **Design rules** | ✅ One job per screen · one expander max · colour carries one meaning · every failure names its fix · no technical word a provider can read · every string localized ×5. §9.2 |
| 25 | ‼️ **Process** | ✅ **Plan first, owner approval, THEN the mockup** — and the mockup registers back into §16. **No mockup may be drawn before approval.** §0.20 |
| 26 | **Locked modes are explained, and one has a way in** (2026-09-15) | ✅ *Assistant answers every call* and *Summarize only* stay visible while connected, locked with a one-sentence reason; the first offers **"Ask us to set this up"** → admin alert → **we phone them** and walk through `*21*`. Sheet C+2–C+5, §17.9 |
| 27 | **The door is permanent** (2026-09-15) | ✅ *Assistant settings → Your numbers* is the standing address for connect / adjust / disconnect on web and app; the A1 card is only the invitation. Sheet C+6 / G17 |
| 28 | ‼️ **One Voiceline, one mode — the answering choice applies to BOTH numbers** (2026-09-15, found while solutioning) | ✅ A forwarded call and a direct call are indistinguishable on arrival, so per-number behaviour is impossible. The sheet's C+1/C+2 were corrected the same day. §17.4 |
| 29 | ‼️ **§0.7 SCHEMA APPROVAL** (2026-09-15) | ✅ **"Approve both (A) and (B)"** — the `voicecheck_{businessId}` TTL document family in SystemData, and the `ownNumber` sub-object on `VoiceAssistantApplication`, **exactly as listed in §17.6 and nothing beyond it** |
| 30 | Permission key (2026-09-15) | ✅ **`voice.number.manage`** for every own-number mutation; `voice.read` for reads |
| 31 | ‼️ Launch countries (2026-09-15) | ✅ **All three — CA, US, IN** (owner, against the CA-only recommendation). Consequence: a per-carrier `CertifiedCarriers` map carries the honesty — uncertified carriers get the D9 "not yet tested" copy; the India dial-format test and the Plivo KYC lead time become **launch blockers** |
| 32 | Verizon / US Cellular (2026-09-15) | ✅ **Included, limitation stated** (owner, against the exclude recommendation). CDMA template family, Verizon step-3 variant with the amber losses banner, no Adjust, `*73` to disconnect |
| 33 | Check limits (2026-09-15) | ✅ **5 per hour · 15 per day**, per business, appsettings |
| 34 | ‼️ Ownership of the business number (2026-09-15) | ✅ **The verification call is the proof.** No SMS, no OTP (a landline cannot receive one — owner's objection). Confirm dialog before the first dial · target blocklist (never a Clinket DID, never a verification number, never short/premium codes) · target always server-side. §17.8 |
| 35–36 | ⏳ **OPEN — §17.14 ASK 5 · 8** | India dial format + who holds the Indian test SIM, and when · who buys the two verification numbers, through which path, when. **Both are now launch blockers because IN is on** |

### 14.B — Rulings of 2026-09-14

| # | Decision | **Ruling** |
|---|---|---|
| 1 | Which region proves first? | **Canada** — owner is in Canada, easiest to test. ‼️ **Three regions exist: CA, US, IN.** Availability is gated **per country off the business address**, so a region where forwarding fails is simply switched off rather than blocking the feature |
| 2 | Hidden DID per provider vs shared | **Per provider.** Shared rejected — carrier-dependent diversion metadata, cross-tenant risk (§11) |
| 3 | Provider-facing number purchase | ❌ **NO. Purchase always through admin.** Closed (§7) |
| 4 | Path B (port) | ‼️ **SUPERSEDED same day → ❌ DROPPED ENTIRELY.** Never shown, no region, no one. `*21*` serves the same need in one dial and is reversible — §6.0 |
| 5 | `ForwardingTarget` ambiguity | **Resolved by §6.1 — no schema change.** `NumberMode` is the discriminator; the field keeps one meaning (*the provider's phone*) and the mode decides whether we may dial it |
| 6 | Mode switching | ✅ **Both directions supported**, each behind a verified switch flow (§6.1). `NumberMode`'s Active-lock must become "changeable only through that flow" |
| 7 | Pilot carriers | Rogers + Bell (CA) first; Airtel + Jio (IN) later. Landline/VoIP/MVNO excluded from the pilot |
| 8 | "AI answers before my phone rings" | ✅ **Admin-alert ONLY — never self-serve, never in signup.** Provider requests → admin alert → **we phone them and explain** → admin enables → they get the `*21*` code. For purely-business lines. **Zero extra runtime work.** Delivers BOTH previously-❌ items. **Replaces porting.** §3.2 |
| 8b | The three self-serve modes | ✅ *"Answer the calls I miss"* · *"Only after hours"* · *"Just take a message"* — shown normally in own-number mode, no admin involvement. §3 |
| 8c | "Ring my phone" join | ✅ **Disabled in own-number mode** (owner-confirmed). The button is hidden; in-app join, browser join, transcript streaming and barge-in all stay. §5.3 |
| 9 | Landline support | ⚠️ **Mobile only for the pilot.** Different code family, no `*004*`, no unreachable rule, and **Bell residential offers no conditional forwarding at all**. Its own certified track later. §8.3 |
| 10 | Live-call features | Only **"ring my phone"** join is lost. Transcript streaming (web + mobile), in-app join, browser join and barge-in all survive. §5.3 |
| 12 | ~~Canada inverts the `*21*` gate~~ | ✅ **CLOSED same day — no inversion.** The timer fix proved conditional forwarding works on a normal voicemail-subscribed Canadian line. `*21*` stays the admin-gated exception (§3.2); ruling 8 stands unchanged |
| 13 | ‼️ **NEW — the no-reply timer is now a product setting** | The carrier default loses to voicemail. Every setup must set the timer explicitly, `61` **last** (§2.1). The value is **per carrier, in appsettings** (§0.12), derived from measured voicemail pickup — never a constant, never the carrier default |
| 11 | ‼️ **OPEN — needs a §0.7 ruling** | Does own-number mode need to **persist** any new state (forwarding verified-at, which code family was used, a separate "call me on" number)? §10.3 removes the need to remember the code family (`##002#` covers all). "Last checked" and the join number do not exist anywhere today. **No schema is being proposed until you rule** |

---

## 15. EVIDENCE LEDGER — what is PROVEN, what is INFERRED, what is UNTESTED

‼️ **This section was rewritten on 2026-09-15.** Its opening line previously read *"No live call was placed"* —
**that became false** once the owner ran the live tests. A stale caveat in an authority document is worse
than none, because it is trusted.

### ✅ PROVEN LIVE — one Canadian iPhone, one carrier, 2026-09-14/15

| Finding | Evidence |
|---|---|
| `*004*` is accepted and registers all three rules in one dial | Handset returned "Setting Activation Succeeded" ×8 |
| Only **Voice** actually takes; the other seven bearer services stay `Disabled` | `*#61#` readback |
| ‼️ **The carrier default timer LOSES to voicemail** | Step 4 failed → voicemail answered |
| ‼️ **The rule is stored correctly and still ignored** at the default timer | `*#61#` = Enabled → our DID |
| ‼️ **A SHORT TIMER BEATS VOICEMAIL — Canada is self-serve** | 5 s → **the AI answered** |
| Voicemail pickup on this carrier is **between 15 s and 20 s** | 5/10/15 ✅, 20 ❌ |
| `*21*` unconditional reaches the assistant perfectly | Control test |
| ‼️ **iPhone decline BYPASSES the busy rule** | `*#67#` = Enabled → our DID, decline → voicemail |
| ‼️ **The stored timer cannot be read back** on this carrier | `*#61#` omits it at both 10 s and 12 s |
| **12 s is accepted by the handset** | Owner dialled it successfully |
| The Clinket DID answers with the AI when dialled directly | Baseline test |

### 📘 PROVEN FROM PRIMARY SOURCES

- **3GPP TS 22.082 §3.3.3** — the no-reply timer is *"between 5 and 30 seconds, in steps of 5 seconds"*, and
  the network's notification *"will include… the duration of the no reply condition timer"* ⇒ **12 s is
  outside the standard, and this carrier is non-conformant on the readback.**
- **Apple** — a `tel:` URL containing `*` or `#` will not dial (§9).
- **Google** — third-party call-audio access blocked at Android 10; the Accessibility workaround banned
  May 2022 ⇒ **no third-party app answers a cellular call** (§11.2).
- **Rogers / Bell** — conditional forwarding vs voicemail precedence (§8).

### 🔍 INFERRED — reasoned, consistent with all evidence, NOT established

- ‼️ **How Equal identifies a subscriber on a shared number** (app correlation via `CallScreeningService`).
  Fits the economics, the app-permission requirement, and their silence — **but nobody publishes it.**
  ‼️ **The owner can settle it directly: dial `*#61#` on the phone where Equal is set up** and compare the
  forwarding number with another Equal user's (§11.2).
- Equal's actual dial strings, telephony vendor, and active-user count.

### ❌ UNTESTED — must not appear as fact in any plan, copy or decision

| Gap | Why it matters |
|---|---|
| ‼️ **Every live test came from a KNOWN CONTACT** (the owner's wife) | **Real customers are unknown numbers.** With *Silence Unknown Callers* on, they bypass forwarding entirely (§2.1). **Nothing is proven for a real customer until a call is placed from a number not in the contacts** |
| **Do Not Disturb / Focus** behaviour | Unmeasured. Copy must say *"may"*, never *"will"* (§9.7) |
| **iPhone Live Voicemail** and iOS 26 Call Screening | May answer before the network condition fires |
| **Every carrier except the one tested** | Bell · Telus · Fido · Freedom · AT&T · T-Mobile · **Verizon (different code family entirely)** · Airtel · Jio · Vi |
| **India, end to end** | Never tested. Includes whether a diverting number arrives in the Plivo webhook (§11.2) |
| **Landline / VoIP**, any telco | §9.4 |
| **Android**, any handset | Decline may behave differently from iPhone |
| Whether removing voicemail lets a **declined** call fall through to `67` | Expected **no**; §2.1 |
| Whether Plivo/Telnyx approve Clinket's **specific** India service model | Needs written confirmation, not a docs page |
| That **TRAI blocks mobile→virtual porting** | Industry documentation, **not** a TRAI circular. Confirm before provider-facing copy |
| Real forwarded-call latency on any carrier but this one | — |

‼️ **The rule this programme has already paid for twice: acceptance is not proof.** `*004*` reported success
eight times while seven services stayed disabled, and the no-answer rule read back perfectly while losing
every call to voicemail. **Only observed behaviour counts** (§10.1).

---

## 16. MOCKUP REGISTER (§0.20)

| Sheet | Path | Approved | Governs | Supersedes |
|---|---|---|---|---|
| **voice-own-number-card-actions** | `Data\mockups\voice-own-number-card-actions\index.html` | ✅ **APPROVED 2026-09-18** (owner, in conversation: "approve but some change" — the disconnect dialogs drawn at their real size and alignment, and one font/size/colour scale on web and app) for the card (R4) and the refused-disconnect answer (R5), BUILT the same day · the server rules approved the same day after the owner asked "do we need a limit on disconnect at all?" — refined to D-71 and BUILT | The card’s action row: two links (Check again · Adjust ring time) · "Change" beside the number in every state except where the button already opens the number step · "Call your assistant to hear it" at the end of How it works · "No, I didn’t pick up" inside its sentence · a refused disconnect that re-reads the line and says "already off" · the dialog header alignment and the checking icon slot, web and app | Supersedes the action row drawn on **voice-own-number-honest-status**, **voice-keep-your-number** and **voice-assistant-page-density** (four links → two). Disconnect keeps its D-35 place |
| **voice-own-number-honest-status** | `Data\mockups\voice-own-number-honest-status\index.html` | ✅ **APPROVED 2026-09-17** (owner, in conversation, after testing on their phone): Decision 1 **"Lock it"**, confirmed as "for him only", i.e. per business and number · Decision 2 **default ring 10 s** ("it is sandbox only so I am ok with your recommendation") · Decisions 3–4, the five server rules and every sentence ("you don't need my approval as long as it is correct and fully easy to understand") | What each check proves and says: the voicemail-first lock and its recommendation · the chosen ring time vs the test call's stopwatch · the "ring time changed" card state · the disconnect check's checking words, last step and six endings · "no result" and "couldn't start" · the read-only number field following the card · the five server rules (D-42 … D-49) | Supersedes **voice-keep-your-number** on the voicemail-first failure ("Try again as is" deleted), the connected sentence and the disconnect check's words; supersedes **voice-assistant-page-density** on the 15-second default (D-18) and adds the lock to its step-3 ring choice. Both sheets are stamped |
| **voice-assistant-page-density** | `Data\mockups\voice-assistant-page-density\index.html` | ✅ **APPROVED 2026-09-16** (owner, in conversation: "all good", "rest looks good") with ONE amendment — the per-option ring counts ("about two rings") are dropped, see D-17 | The assistant page after the owner’s live test: a left column that carries who-answers and the knowledge line instead of stretching · disconnect as a header action on the number card · How-it-works open by default · the deleted “Your numbers” line and the two-column settings grid · the ring-time picker inside connect step 3, a 15-second default and a visible close · a second “not available here” sentence for a country with no verification number · the knowledge row’s full-width notice line | Supersedes **voice-keep-your-number** on LAYOUT ONLY (§C1 card composition, §C6 settings header, the connect step-3 panel). Every rule that sheet sets about what a check proves, what each failure offers and what the words say is unchanged |
| **voice-keep-your-number** | `Data\mockups\voice-keep-your-number\index.html` | ✅ **APPROVED 2026-09-15** (owner, in conversation) | The whole own-number UI: the A1 entry card as an addition · the four-step wizard · the connected status card · **C+ who-answers panel with two modes locked and the "ask us" admin request** · every failure · disconnect with reverse verification · the same web page at 768 and 390 · 17 provider-app frames · the copy table (every sentence → proposed key, five languages) | Supersedes nothing. Revises the live `voiceAssistant.form.numberMode.ForwardExistingDesc` copy in all five files |

**Status:** ✅ **APPROVED 2026-09-15 and BUILT the same day** (see §18). Also indexed in
`Data\mockups\REGISTER.md`. Steps 1–6 below are complete.

**Sequence, owner-mandated 2026-09-15:**

```
  1. Plan complete            ← this document
  2. OWNER APPROVES the plan  ← ‼️ WAITING HERE. Nothing is drawn before this
  3. Mockup drawn at the path above — web AND mobile, EVERY state in §13.2
  4. Owner approves the mockup
  5. ‼️ The mockup is REGISTERED in this table, with its approval date
  6. Only then may integrated UI code be written
```

‼️ **A sheet the owner approved that appears in no register has been LOST, not approved** (§0.20). The row
above gets filled in **the day** the owner says yes — never later, never "when there is time".

**No integrated UI may be written until steps 3–5 are complete.**

---

## 17. PRODUCTION SOLUTION DESIGN — every step, end to end, no shortcuts

> **Owner, 2026-09-15:** *"review the entire plan file and do the solution on each of the steps where it
> will require the design and solutioning… fully end to end production grade… if confused, ask instead of
> assuming wrong. No coding."*
>
> Every symbol below was read in the working tree this session. Anything **proposed** (a new method, enum
> member, setting, key or field) is labelled *proposed*. Anything that needs the owner's ruling is marked
> **‼️ ASK** and collected in §17.14. **Nothing in this section is built.**

### 17.1 The system in one picture

```
 PROVIDER (web / app)                 API (Clinqet.API)                          FUNCTIONS (Clinqet.Communications)                 CARRIER
 ───────────────────                  ─────────────────                          ────────────────────────────────────                ───────
 Connect wizard ──PUT own-number──►   validate · lookup · gate · verify owner
                                      persist intent (§17.6 ‼️ §0.7)
 step 3: dials *004* / **61*…**10#  ──────────────────────────────────────────────────────────────────────────────────────────────►  provider's
                                                                                                                                      mobile carrier
 step 4: POST own-number/check ───►   rate-limit · single-flight · create
                                      voicecheck doc (TTL) ──enqueue──►  VoicePostCallProcessorFunction
                                                                          Kind = StartOwnNumberCheck (proposed)
                                                                          ── MakeCall(to=provider, from=VERIFICATION#, AMD) ──►  Telnyx / Plivo
                                                                          ◄── call.answered + machine_detection.ended (outbound leg)
                                                                          ◄── call.initiated on the PROVIDER'S DID, From=VERIFICATION#  ◄─ carrier forwards
                                                                          short-circuit: mark ARRIVED, reject (never answered, no session)
                                                                          ── schedule OwnNumberCheckTimeout (45 s) ──►
                                      ◄── outcome (SignalR VoiceOwnNumberCheckUpdated, proposed) ── persist result
 wizard shows ✓ / one of four fails
```

### 17.2 Ingress — where forwarded calls enter, and what changes (TWO lines of code, both carriers)

The forwarded leg is an **ordinary inbound call on the provider's DID**. Nothing about ingress changes for
real calls. The only ingress change is the **verification short-circuit**:

| Carrier | Insertion point (verified) | Rule |
|---|---|---|
| Telnyx (CA/US) | `VoiceCallControlFunction.HandleInitiatedAsync` — after `GetByNumberAsync(evt.To)` resolves the voiceline and **before** `TryCreateAsync(session)` / `AnswerAsync` ([VoiceCallControlFunction.cs:175](../../clinqetfuncations/Clinqet.Communications/Functions/VoiceCallControlFunction.cs#L175)) | `if (evt.From == VerificationCallerNumber && pending voicecheck exists for voiceline.BusinessId)` → stamp `ArrivedUtc`, **`HangupAsync` the unanswered leg** (a hangup on an un-answered inbound is a reject — no answered-leg billing), `return true`. **No session, no answer, no disclaimer, no AI** |
| Plivo (IN) | `PlivoVoiceCallControlFunction.HandleAnswerAsync` — after the voiceline + status checks and **before** `GetByCallIdAsync`/session creation ([PlivoVoiceCallControlFunction.cs:236](../../clinqetfuncations/Clinqet.Communications/Functions/PlivoVoiceCallControlFunction.cs#L236)) | same predicate → stamp arrival, return `PlivoVoiceXmlBuilder.Empty()` (Plivo has no imperative answer; an empty applet ends the leg) |

‼️ **The predicate must be BOTH conditions.** `From == VerificationCallerNumber` alone would let anyone
who learns our verification number spoof a "success" by calling the provider's DID from it — impossible for
a PSTN caller to forge `From` reliably, but the pending-doc check costs one point-read and closes it.

‼️ **The verification caller number must have NO `Voiceline` document.** `HandleInitiatedAsync` already
ignores any DNIS without a voiceline, so a stray call *to* the verification number is dropped for free.
This is an ops-runbook item (§17.12), not code.

### 17.3 The runtime fix — `SyncVoicelineFromApplicationAsync` (the ONE method, §5.1)

Today ([VoiceAssistantService.cs:934](../../clinqetinfrastructure/Services/Voice/VoiceAssistantService.cs#L934)):
`v.ForwardTo = application.ForwardingTarget ?? ""; v.HoursMode = application.HoursMode ?? AlwaysOnMiss;`

**Proposed:** when the business is in own-number mode **and connected** (§17.6 state):

| Application (what the provider chose) | Voiceline written | Why |
|---|---|---|
| `ForwardTo` | **`""` always** | The provider's phone is the forwarding source; dialling it loops (§5.1). Every empty-target branch is already loop-safe on both carriers (§4.1) |
| `HoursMode = AlwaysOnMiss` ("Any missed call") | **`AiFirst`** | With `ForwardTo` empty, `AlwaysOnMiss` still reaches the AI but via early-dial-park → speak.ended → miss branch → handoff. `AiFirst` warms the AI during the disclaimer and hands off at speak.ended — **the fastest path, and the one proven live** (§13.0). Same outcome, fewer hops |
| `HoursMode = AfterHoursOnly` | `AfterHoursOnly` | Miss branch → `TryReceptionistHandoffAsync` → hours verdict → within hours: message-taking voicemail; after hours: AI. Already loop-safe with an empty target |
| `HoursMode = AiFirst` | **rejected at save** (`Error_VoiceAssistantModeNotAvailableConnected`, proposed key) | Only reachable via the admin "answers every call" path (§17.9), which stores its own flag and writes `AiFirst` |
| `HoursMode = NeverAnswer` | **rejected at save** (same key) | The whisper promise cannot be kept on a number the provider answers themselves (§3.3) |

‼️ **17.4 — ONE Voiceline, ONE mode: the fact the sheet had wrong.** A forwarded call and a direct call to
the Clinket number arrive on the **same DID** with `To = DID`, `From = the customer` and **no diverting
number** (§11.1). The runtime **cannot tell them apart**, so the mode can never differ per entry point.
Under *Any missed call* both reach the AI on arrival; under *After hours only* both get message-taking
within hours. **The sheet's C+1/C+2 were corrected on 2026-09-15 to say the choice applies to both
numbers.** Any future design that promises per-number behaviour is promising something the wire cannot
deliver.

**Mode lock while connected:** `NumberMode` is already frozen once Active
([VoiceAssistantService.cs:134](../../clinqetinfrastructure/Services/Voice/VoiceAssistantService.cs#L134)).
That lock becomes *"changeable only through the connect/disconnect flows"* (§6.1) — the save path rejects
a direct `NumberMode` edit with the existing `Error_VoiceAssistantNumberModeLocked`.

### 17.5 The test call — outbound leg design

**Telnyx.** `IVoiceTelephonyProvider.DialAsync(to, from, timeoutSecs, amd, timeLimitSecs, linkToCallControlId, clientState, bridgeIntent)`
posts `v2/calls` with `connection_id = CallControlApplicationId` and **`link_to = linkToCallControlId`**
([TelnyxCallControlService.cs](../../clinqetinfrastructure/Services/Communication/TelnyxCallControlService.cs)).
The verification call has **no existing leg to link to**, so:

- **Proposed:** `IVoiceTelephonyProvider.MakeCallAsync(to, from, timeoutSecs, answeringMachineDetection, timeLimitSecs, clientState, ct) → DialResult` — the same `POST v2/calls` **without `link_to`**. A new interface member, not a schema change. Telnyx's `/v2/calls` accepts a call with no `link_to`.
- `from` = the stamp's **verification caller number** (§17.11). Never `TransactionalFromNumber` (toll-free, SMS sender, `844` is in `Telnyx:FraudDetection:HighRiskAreaCodes`), never the provider's DID (self-loop + kills correlation).
- `answeringMachineDetection` = `_settings.AnsweringMachineDetection` (the standard mode) — **not** `VoiceAmdModes.PremiumIosCallScreening`; a test call needs human-vs-machine, not premium screening, and premium costs more.
- `timeoutSecs` = **`Voice:OwnNumber:CheckRingTimeoutSeconds` (proposed, default 45)** — longer than any carrier's voicemail pickup, so the outbound leg is still alive when the carrier forwards or voicemail answers.
- `clientState` = `EncodeClientState(checkId, businessId, PhaseOwnNumberCheck)` (**proposed phase constant**) so every webhook for this leg routes to the verification handler and never into the live-call state machine.

**Plivo.** The MPC adapter already has `MakeProviderCallAsync(to, from, answerUrl, hangupUrl, amdCallbackUrl, ringTimeoutSecs, enableAmd)` — a standalone make-call. Reuse it with **dedicated callback names** (`verify-answer`, `verify-hangup`, `verify-amd`, proposed) so `PlivoVoiceCallControlFunction` routes them to the verification handler. `from` = the Indian verification number (DoT: owned CLI only).

**Webhooks on the outbound leg → outcome:**

| Event (verified handlers) | Meaning | Outcome written |
|---|---|---|
| inbound `call.initiated` on the DID, `From` = verification # (§17.2) | ‼️ **the proof** | `Arrived`, `arrivedUtc` |
| `call.machine_detection.ended` = machine (`HandleMachineDetectionAsync`) and **no** arrival | voicemail intercepted | `Failed:VoicemailFirst` |
| `call.machine_detection.ended` = human, no arrival | they picked up | `Failed:Answered` |
| `call.hangup` on the outbound leg, no arrival, no answer | rang out / not forwarded | `Failed:NothingArrived` (after the timeout below) |
| `DialResult.Rejected` / carrier error at make-call | unreachable / invalid | `Failed:CouldNotConnect` |
| scheduled **`OwnNumberCheckTimeout`** (proposed `VoicePostCallKind`, 45 s) fires with no terminal outcome | safety net | `Failed:NothingArrived` |

**Measured delay** = `arrivedUtc − placedUtc`, **rounded to the nearest 5 s**, displayed as *"about N
seconds"* (§9.10). Stored as an integer of seconds.

**Hang-up hygiene:** on any terminal outcome the function issues `HangupAsync` on the outbound leg if it is
still alive (a rejected forward leaves it ringing until `timeoutSecs`).

### 17.6 ‼️ §0.7 — the state this needs, and the approval it requires (ASK)

Two stores. **Neither exists. Neither may be created until the owner says yes.**

**(A) A short-lived check document — new document family in `SystemData`** (proposed id = pk =
`voicecheck_{businessId}`, TTL **`Voice:OwnNumber:CheckTtlSeconds`** default 600):

| Column | Statement |
|---|---|
| **What** | `voicecheck_{businessId}` doc: `businessId`, `checkId`, `purpose` (Connect · Recheck · Disconnect · AnswersAll), `targetE164`, `verificationCaller`, `outboundCallControlId`, `placedUtc`, `arrivedUtc?`, `amdResult?`, `state` (Placed · Ringing · Arrived · Failed:{cause} · TimedOut), `requestedByUserId`, `ttl` |
| **Who reads it** | `HandleInitiatedAsync` / Plivo `HandleAnswerAsync` (the arrival predicate, §17.2); the verification webhook handler; the timeout processor; `GET own-number/check/{id}` (poll fallback) |
| **Who writes it** | `POST own-number/check` (create, single-flight via create-if-absent); the Functions handlers (CAS-stamp state transitions); TTL deletes it |
| **Why not a column** | It is per-attempt, short-lived, and written by a different host than the profile; putting it on `BusinessProfile` would churn a large document on every test and race the provider's own edits |
| **Why not an enum / constant** | It is state, not a fixed set |
| **Why not already stored** | `VoiceCallSession` is keyed by carrier call id and models a live customer call with scope Customer/Partner (`VoiceCallScope`) — a verification is neither, and mixing it in would drag the test through recording, summary and usage paths |
| **Cost** | 1 write + ~3 CAS patches + 1 point-read per check; TTL reclaims it; no index change (id = pk point-reads only) |
| **What breaks if omitted** | The arrival predicate has nothing to check against ⇒ **no verification at all**, or a spoofable one |

**(B) Persisted result on the application — new fields on `VoiceAssistantApplication`** (Cosmos, inside
`BusinessProfile`), proposed as ONE sub-object `ownNumber`:

| Field | Type | Who reads | Who writes |
|---|---|---|---|
| `connected` | bool | sync (§17.3), UI status card, mode-lock | connect flow on `Arrived`; disconnect flow on reverse-verified |
| `ringSeconds` | int (10 · 15) | code generator, UI | connect / adjust |
| `verifiedAtUtc` | DateTime? | UI *"Last checked"*, re-verify triggers | every successful check |
| `measuredRingSeconds` | int? | UI *"about N seconds"* | every successful check |
| `lastCheckOutcome` | string? | UI failure/skipped state | every check |
| `carrierName`, `lineType` | string? | UI, code-template selection, per-carrier cap | lookup at step 1 |
| `answersAllRequestedAtUtc` | DateTime? | UI C+4, admin alert dedupe | provider request |
| `answersAllEnabledAtUtc` | DateTime? | sync writes `AiFirst`; UI C+5 | **admin only** |
| `checksToday`, `checksDate` | int, string | daily cap (§17.8) | `POST own-number/check` |

| Column | Statement |
|---|---|
| **Why not derivable** | *connected* could be derived (`NumberMode==ForwardExisting && Voiceline.ForwardTo==""`), but **nothing else can**: the date, the measured delay, the chosen ring time and the admin flag exist nowhere |
| **Why not a separate container** | One-to-one with the business's assistant; it is the application's own state |
| **Why not already stored** | Checked `VoiceAssistantState`, `VoiceAssistantApplication`, `Voiceline`: none carries a verification date, a measured delay, a ring choice, or an admin "answers all" flag |
| **Cost** | ~9 small fields on an existing doc; no new index (never queried by these fields) |
| **What breaks if omitted** | The approved sheet's status card (*Last checked · about N seconds · Adjust · answers-all*) **cannot be rendered truthfully** — it would have to show a green badge it cannot back (§10.1) |

✅ **APPROVED — owner, in conversation, 2026-09-15: "Approve both (A) and (B)."** This is the §0.7 approval,
given in the current conversation, for exactly the two stores and the field list above — **and nothing
beyond them.** A field not in this list is a new §0.7 ask.

### 17.7 The API surface (proposed routes on the existing `VoiceAssistantController`, `api/v{v}/voice-assistant`)

| Route | Does | Guard |
|---|---|---|
| `GET own-number` | the status card model | `voice.read` |
| `PUT own-number` | connect intent: `{ e164, ringSeconds }` → lookup (§17.10) → country gate (§17.8) → owner verification (§17.8) → persist `ownNumber.*` intent → return generated codes (§17.8) | ✅ **RULED 2026-09-15: `voice.number.manage`** — the SENSITIVE operation (live-SQL re-check) that had zero endpoints until now (Provider-Teams skill Phase 9). Every own-number mutation below uses it; `voice.read` for reads |
| `POST own-number/check` `{ purpose }` | starts a verification (§17.5) | same + rate limit (§17.8) |
| `GET own-number/check/{checkId}` | poll fallback when SignalR is unavailable | `voice.read` |
| `DELETE own-number` | disconnect intent → returns `##002#` → client then `POST own-number/check {purpose: Disconnect}`; **success = `Failed:NothingArrived` + AMD machine/human (i.e. the call did NOT arrive)**; `Arrived` ⇒ *still connected* (E3) | `voice.number.manage` |
| `POST own-number/answers-all/request` · `DELETE …/request` | the C+3/C+4 admin request; raises the admin alert (§17.9) | `voice.number.manage` |
| `PUT own-number/ring-seconds` `{ 10 \| 15 }` | Adjust → returns the new `**61*…**N#` code → client runs a Recheck | `voice.number.manage` |
| **Admin** `POST admin/voice-assistant/{businessId}/own-number/answers-all/enable` · `…/disable` | stamps `answersAllEnabledAtUtc`, re-syncs the voiceline (`AiFirst`), notifies the provider | `[Authorize(Roles="Admin")]` on `AdminVoiceAssistantController` |

**Transport of the check outcome to the UI:** SignalR notification type **`VoiceOwnNumberCheckUpdated`**
(proposed `NotificationType` member) carrying `{checkId, state, measuredRingSeconds}`; **it must be added to
`SignalRSettings:EnabledNotificationTypes`** in the Main API `appsettings.json` (CLAUDE.md §16) or it will
never reach the browser. The wizard also polls `GET …/check/{id}` every 3 s as the fallback.

### 17.8 Guards, gates, codes and limits (all appsettings — §0.12; class defaults mirror the JSON)

**Proposed section `Voice:OwnNumber` (Main API; Functions reads only the two it needs):**

| Key | Default | Read by |
|---|---|---|
| `EnabledCountries` | ✅ **RULED 2026-09-15: `["CA","US","IN"]` — all three on at launch** (owner, against the CA-only recommendation; recorded, not re-argued) | API gate at `PUT own-number`; UI hides the entry card when the business country is not listed (§8.1). **Server-side, never client-only** |
| ‼️ `CertifiedCarriers` (**new, made necessary by the ruling above**) | `{ "CA": { "Rogers": { "maxRingSeconds": 15 } } }` — grows only from a **measured** live test (§13.0) | ‼️ **Because US and IN are ON while untested, honesty moves from the country gate to the carrier.** A carrier absent from this map gets the sheet's **D9 copy** — *"We haven't finished testing this with {carrier} yet — try anyway"* — and `RingSecondsOptions` capped at the default 10. A carrier in the map gets the confident copy and its measured cap. **The country gate says where the feature exists; this map says where we can promise it works** |
| `RingSeconds` | `10` | code generator |
| `RingSecondsOptions` | `[10, 15]` | Adjust |
| `CarrierMaxRingSeconds` | `{ "Rogers": 15 }` — measured; grows as carriers are certified | caps `RingSecondsOptions` per carrier |
| `CheckRingTimeoutSeconds` | `45` | §17.5 |
| `CheckTtlSeconds` | `600` | (A) TTL |
| `MaxChecksPerHour` / `MaxChecksPerDay` | ✅ **RULED 2026-09-15: `5` / `15`** per business | rate limit |
| `BlockedPrefixes` | per country: emergency, short codes, premium-rate (e.g. CA/US `911`, `N11`, `900`; IN `100`, `112`, `1xx` short codes — **the exact lists are verified at implementation, not typed from memory**) | target blocklist (below) |
| `Codes` | per country calling-code, template strings (below) | code generator |

**Code generation (server-side, never client-side):** the DID in **national digits** — NANP: strip `+1`
(proven live: `*004*2364767193#`). India: **‼️ ASK 5** — the India Phase-1 test must establish whether
Airtel/Jio/Vi want 10 digits, `0`-prefixed, or `+91`; the template is a setting so it can change without a
release.

| Country / family | Set all three | No-answer with timer | Clear |
|---|---|---|---|
| CA · US (GSM: Rogers, Bell, Telus, Fido, Freedom, AT&T, T-Mobile) | `*004*{did}#` | `**61*{did}**{s}#` | `##002#` |
| ‼️ US Verizon / US Cellular (CDMA family) | `*71{did}` — **no timer, no unreachable rule** (§2.1) | n/a | `*73` |
| IN | `*004*{did}#` | `**61*{did}**{s}#` | `##002#` |

✅ **RULED 2026-09-15: Verizon / US Cellular are INCLUDED, with the limitation stated** (owner, against the
exclude recommendation). Design consequences, all mandatory:

- **Template family by carrier, not by country.** The lookup's carrier name selects the CDMA template
  (`*71{did}` on · `*73` off) for Verizon and US Cellular; every other US carrier gets the GSM family.
- **Step 3 has a Verizon variant** (sheet B6v): **one** code, **no** ring-time step, and an amber banner
  that states both losses in plain words — *"With Verizon we can't shorten how long your phone rings, so your
  voicemail may pick up first. And calls when your phone is off won't reach your assistant."*
- **Adjust ring time is hidden** for the CDMA family (there is no timer to adjust).
- **The verification call still runs** — it is the only thing that can tell a Verizon provider whether
  voicemail wins on *their* line (D1 vs B9).
- **Disconnect shows `*73`**, never `##002#`, for this family (E1 variant).
- ‼️ **Launch blockers this ruling creates** (they were "later" when only CA was on): a live test on **at
  least one US GSM carrier and one Verizon line**, and — because IN is also on — **the India dial-format test
  (ASK 5) and the Plivo verification number's KYC lead time (ASK 8) are now on the critical path**, not after it.

**Rate limiting:** add a named policy to the existing top-level `RateLimiting` section (it already holds
`Authentication` and `Api` with `Window*/PermitLimit/QueueLimit`) — proposed `OwnNumberCheck`, **partitioned
by business id claim, not IP** — plus the daily cap enforced in the service from `checksToday/checksDate`
(§17.6 B). Single-flight = create-if-absent on `voicecheck_{businessId}`.

**Ownership of the business number — ✅ RULED 2026-09-15 (owner asked for the best answer; this is it):
‼️ THE VERIFICATION CALL IS THE PROOF. No SMS, no OTP.**

The owner's objection was decisive: *"it could be a landline, so SMS won't work."* Thinking it through
removes the step entirely:

- A call to number X **can only arrive on this business's DID** if whoever controls X dialled *our DID* into
  *their carrier's* forwarding rule. **Nobody can do that for a line they do not control.** Arrival is
  therefore a stronger proof of ownership than any code we could text — and it works for a landline.
- A call to a number that is **not** theirs simply rings a stranger once and never arrives → `NothingArrived`.
  The residual risk is one nuisance ring per attempt, bounded by the rate limit below on an authenticated,
  identity-verified, paying business account. Not worth a step that also breaks every landline provider.

**What replaces the OTP — three cheap guards, all mandatory:**

| Guard | Detail |
|---|---|
| **Confirm dialog before the first dial** (the owner's instinct) | *"We're about to call {number}. Is this your business phone?"* — Yes, call it · No, change the number. Sheet D11 (rewritten). Zero cost; catches the typo case |
| ‼️ **Target blocklist at `PUT own-number`** | Reject: any number with a `Voiceline` doc (a Clinket DID — reuse the `EnsureNoForwardingLoopAsync` point-read, [VoiceAssistantService.cs:732](../../clinqetinfrastructure/Services/Voice/VoiceAssistantService.cs#L732)); our verification numbers; emergency/short codes and premium-rate prefixes per country (a list in `Voice:OwnNumber:BlockedPrefixes`, appsettings) |
| **Target read server-side only** | The outbound test dials the persisted `ownNumber` intent, **never a value from the request body** (§9.10) — unchanged |

*Optional hardening, not core:* a per-**target** daily cap across all businesses (two colluding accounts
hammering one victim) — an `IMemoryCache` counter keyed by e164 with **`Size = 1`**; per-instance, degrades
gracefully, no new store. Add only if the pilot shows a reason.

**Rate limits — ✅ RULED 2026-09-15: `MaxChecksPerHour = 5`, `MaxChecksPerDay = 15` per business** (owner's
numbers), in `Voice:OwnNumber`, class defaults mirroring the JSON (§0.12).

### 17.9 "Assistant answers every call" — the admin path (§3.2, sheet C+3–C+5)

1. Provider taps *Ask us to call me* → `POST own-number/answers-all/request` → stamps `answersAllRequestedAtUtc`.
2. **Admin alert** via the existing `FailureNotificationHelper.HandleSystemFailureAsync(title, message, exception:null, contextIdentifier: businessId, forceAdminAlert: true)` pattern (the same call shape as *"Voice AiFirst Cap Reached"*), title *"Voice own-number: answers-every-call requested"* — admin-internal English is permitted (§3.6). **Deduped** by the stamp: a second request while one is pending is a no-op.
3. A human calls the provider, confirms it is a business-only line, walks them through `*21*{did}#`.
4. Admin `…/answers-all/enable` → `answersAllEnabledAtUtc` → sync writes `HoursMode = AiFirst` → provider notification (`VoiceAssistantAnswersAllEnabled`, proposed `NotificationType`) → sheet C+5.
5. Verification for this path: the same check, but **success = `Arrived` with `measuredRingSeconds ≈ 0`** (no ring). Disconnect is unchanged: `##002#` clears `*21*` too (§10.3).

### 17.10 Carrier + line-type lookup (§9.3) — a new seam, resolved by the existing country→carrier selector

**Proposed** `IPhoneNumberLookupService.LookupAsync(e164) → { carrierName, lineType (Mobile·Landline·VoIp·Other), portedCarrier? }` with two implementations behind the same country selector that already chooses Telnyx vs Plivo for voice: `TelnyxNumberLookupService` (CA/US, `/v2/number_lookup`, ~$0.0015) and `PlivoLookupService` (IN, ~$0.0040). ‼️ **Check first:** `TelnyxSmsService`'s fraud validation (`FraudDetection.EnablePhoneValidation`, [TelnyxSmsService.cs:374](../../clinqetinfrastructure/Services/Communication/TelnyxSmsService.cs#L374)) may already call Telnyx number lookup — if so, **extract and share that client** rather than adding a second one. Result cached in `IMemoryCache` **with `Size = 1`** (ZERO-TOLERANCE, CLAUDE.md §14) for 24 h per e164. Failure ⇒ the UI's carrier picker (D6), never a block. `lineType ∈ {Landline, VoIp}` ⇒ the landline route (D7), which raises the same class of admin alert as §17.9.

### 17.11 The verification numbers — ‼️ ONE PER COUNTRY, never shared (owner ruling 2026-09-15, BUILT)

| Country | Number | Bought by | Routed to | Setting (BUILT) | Today |
|---|---|---|---|---|---|
| **CA** | one **Telnyx** Canadian local DID (not toll-free) | **admin**, through the existing admin purchase path (`IVoiceNumberProvider.SearchAvailableNumbersAsync/QuoteNumberAsync/OrderNumberAsync`) or the Telnyx portal | the same `Telnyx:CallControlApplicationId` (so its webhooks land on `VoiceCallControlFunction`) | `Voice:OwnNumber:Countries:CA:VerificationCallerNumber` | `+12896981655` (the owner's sandbox placeholder) |
| **US** | its **OWN** Telnyx US DID — ‼️ **never Canada's** | same path | same application | `Voice:OwnNumber:Countries:US:VerificationCallerNumber` | **EMPTY ⇒ the region reports "not configured"** until it is bought |
| **IN** | one **Plivo** Indian DID — **KYC applies** (§11.2); lead time is Plivo's, not ours | admin / Plivo console | the same `Plivo:ApplicationId` | `Voice:OwnNumber:Countries:IN:VerificationCallerNumber` | **EMPTY ⇒ the region reports "not configured"** until it is bought |

‼️ **Why per country.** The call must originate on the region's own telephony account (Telnyx CA/US, Plivo IN) or it
is an international leg with a foreign caller ID — the provider sees a number they cannot recognise, carriers rate it
differently, and India's rules do not accept a foreign originator for this at all. **The API stamps the business's
country caller onto the check document; the Functions host holds no number and dials from the document**, so a stamp
can never borrow another region's number. An empty value fails closed: the card says "not available in your region
yet", nothing dials.

Rules: **no `Voiceline` doc for it** (§17.2) · **never used for SMS** · **never the provider's own DID** ·
`appsettings.json` only ⇒ **no ARM / `deploy.ps1` change** (CLAUDE.md §4 — only `local.settings.json` keys
need ARM) · the value is not a secret · each one is refused as a connect target automatically, in every region.

Rules: **no `Voiceline` doc for it** (§17.2) · **never used for SMS** · **never the provider's own DID** ·
`appsettings.json` only ⇒ **no ARM / `deploy.ps1` change** (CLAUDE.md §4 — only `local.settings.json` keys
need ARM) · the value is not a secret.

### 17.12 Messaging, alerts, analytics, localization

| Piece | Design |
|---|---|
| Queue | **Reuse** `ServiceBusSettings.VoicePostCallQueueName` (default `voice-postcall`; consumer `VoicePostCallProcessorFunction`, trigger `%ServiceBusSettings:VoicePostCallQueueName%`). **No new queue ⇒ no ARM change.** New `VoicePostCallKind` members (proposed): `StartOwnNumberCheck`, `OwnNumberCheckTimeout` (scheduled, like `DialReassurance`/`DisclaimerBackstop`). Deterministic `messageId = vpc-owncheck-{businessId}-{checkId}` so a redelivery never double-dials (the same guarantee `vpc-join-dial-{callId}` gives today) |
| Idempotency | every state write is a CAS on the `voicecheck` doc; a second `StartOwnNumberCheck` for the same `checkId` finds `outboundCallControlId` set and no-ops |
| Provider notifications | `VoiceOwnNumberCheckUpdated` (SignalR, per §17.7) · `VoiceAssistantReadyToConnect` (push + email when admin assigns the number and `NumberMode == ForwardExisting` — G14) · `VoiceAssistantAnswersAllEnabled`. All three are proposed `NotificationType` members; **all three go into `SignalRSettings:EnabledNotificationTypes`**; titles/bodies `string.Format`-resolved before dispatch (CLAUDE.md §2) |
| Admin alerts | **patterns only** (§9.10): 3 consecutive failures for one business · carrier-wide failure spike (a per-carrier rolling ratio in the API's `IMemoryCache`, `Size = 1`) · **make-call rejected / verification number refused** — `forceAdminAlert: true` |
| Analytics | `AnalyticsEventType.VoiceOwnNumberAction = 59` (proposed; last is `InsightsAction = 58` — **additive, never renumber**), metadata `{ step, outcome, carrier, lineType, ringSeconds }` through the existing `/api/analytics/track` pipeline (Analytics skill) |
| Localization | every key in the sheet's §H, ×5 partner-web files + the provider app; server keys in `clinqetinfrastructure\Resources\Localization\en.json` **and every other language file** for the push/email; the existing `voiceAssistant.form.numberMode.ForwardExistingDesc` rewritten ×5 |

### 17.13 Tests (§0.8 — unit AND integration, 100 % green, no skips)

| Layer | Host (§0.18 — the runtime consumer) | Must prove |
|---|---|---|
| Unit | `Clinqet.API.UnitTests` | sync mapping table §17.3 (every row, incl. the two rejections) · code generation per country/family incl. digit normalisation · `ringSeconds` capped per carrier · rate limit + daily cap · target never read from the body · permission attribute present on every new route · country gate |
| Unit | `Clinqet.Communications.UnitTests` | arrival predicate needs **both** conditions · short-circuit **never** calls `AnswerAsync`/creates a session (Telnyx) and returns `Empty()` (Plivo) · AMD → outcome mapping (4 rows) · timeout ⇒ `NothingArrived` · measured seconds rounded to 5 · redelivered `StartOwnNumberCheck` does not double-dial |
| Integration (Testcontainers) | `Clinqet.API.IntegrationTests` | `voicecheck` create-if-absent single-flight against the **real Cosmos emulator** · TTL set · CAS transitions · `PUT own-number` end-to-end persists intent and returns codes |
| Integration (Testcontainers) | `Clinqet.Communications.IntegrationTests` | the processor is idempotent under redelivery (deterministic messageId) · webhook replay of the forwarded `call.initiated` stamps arrival exactly once |
| Convention | existing | `MemoryCacheSizeConventionTests` passes (every cache write sets `Size = 1`) · no hardcoded provider-facing strings · every new key present in all five catalogues |
| Sabotage (before merge) | — | re-arm `ForwardTo` in the sync ⇒ the loop test **fails**; remove the pending-doc condition from the predicate ⇒ the spoof test **fails** |

### 17.13b ‼️ BUILT 2026-09-15 — what shipped, and every deviation from this section

Built end to end across `clinqetshared`, `clinqetcore`, `clinqetinfrastructure`, `clinqetapi`,
`clinqetfuncations`, `clinqetwebpartnerapp` and `clinqetmobilepartnerapp`; all four backend suites, both app
suites and both sabotage probes green.

A second, adversarial pass over the same code (2026-09-16) read every file against the decisions rather than
against its own tests: **17 in the Functions coordinator and its two ingress functions**, **17 on the provider web
surface** and **17 on the phone**. 46 were fixed, 3 were judged and recorded (below), and 2 phone items were read
against the code and were not defects. The behaviour changes that pass is responsible for are D-12 … D-16 below;
the rest were repairs inside the shipped behaviour (a latched "call in progress" that hid every way out of the
screen, a blank sheet after a refused check, a resumed check id from a previous visit, a measured ring of 0
printed as "about 0 seconds", a UTC stamp read as local time, a clipboard refusal that locked the second code
for good). Three findings were judged and NOT changed, recorded here rather than silently dropped: the
pattern alerts still count in per-instance memory (a shared counter needs a schema the owner has not approved,
§0.7); one verification caller per country still means a spoofed caller ID during a live check can decide that
check (§17.2, unchanged by design); and if the machine-detection event itself is LOST, a voicemail that answered
is reported as "you picked up" — the leg answered either way and nothing else can tell them apart.

Deviations from the design above, each deliberate:

| # | Designed | Shipped | Why |
|---|---|---|---|
| D-1 | one `Voice:OwnNumber:VerificationCallerNumber` per stamp | **one per COUNTRY** (`Countries:<ISO>:…`), stamped on the check doc | Owner ruling 2026-09-15 (§17.11). A US or Indian provider must never be called from the Canadian number |
| D-2 | `DELETE own-number` route | not built | The codes come from `GET own-number`; a state-less delete had no caller |
| D-3 | D8 "Tell me when it's ready" CTA | not built | It would need a waitlist the backend does not have — no stubs (§0.16 / no-stubs rule) |
| D-4 | `Failed:{cause}` as one stored value | `state` + `outcome` (two enums) | Same information, no string parsing, and the DTO can answer `succeeded` per purpose |
| D-5 | the wizard as a modal on both surfaces | modal on web, **its own gated screen on the provider app** | A four-step flow with a live call inside a phone bottom-sheet cannot show its own header or survive a back gesture |
| D-6 | platform toggle + QR hand-off on both | **web only** | The app IS the phone: `Platform.OS` answers the checklist, and there is nothing to hand off to |
| D-7 | admin console UI for "answers every call" | API only | The admin screen has no approved sheet (§0.20 mockup gate); admins use the two documented routes |
| D-8 | the carrier lookup decides the carrier | **a carrier the provider TYPES wins** | Found by the closing audit: the code FAMILY follows the carrier, so a mis-read carrier could never be corrected and the codes would silently not work |
| D-9 | one ring-time rule per certified carrier | **a carrier we have not measured may still offer the longer ring** (`UntestedMaxRingSeconds`, 15) | Owner ask 2026-09-15. The untested banner still says we have not proven it, and a voicemail-first failure offers the shorter ring as its own fix |
| D-10 | the verdict screen says "your phone rings for about N seconds" | **it says the answers-every-call sentence when that is on** | Audit: with answers-all the phone never rings and the measured value is ~0, so the ring sentence was untrue on a recheck |
| D-11 | a number change silently clears answers-every-call | **it raises an admin alert naming both numbers** | Audit: the arrangement was made on a phone call and the OLD line keeps forwarding unconditionally, so its removal cannot be silent |
| D-12 | a disconnect check that hears nothing proves the number is off | **only a carrier event that ENDED the call proves it** (`state == Failed`); a timeout proves nothing | Round-2 audit: a lost webhook on a line that is still forwarding looks identical to silence, and acting on it re-points the Clinket number at a phone that forwards back to it (§5.1 loop) |
| D-13 | a verification call arriving after the verdict is a normal inbound call | **it is still declined** while the check document lives | Round-2 audit: it is the leg WE placed — answering it opens a session, meters minutes and sends the provider a summary of a call from their own verification number |
| D-14 | the test call uses the configured machine detection ("detect") | **it uses premium iOS-screening when the platform has it on**, and each carrier's webhook decides "machine" in its own words | Round-2 audit: plain detect cannot see an iPhone voicemail, Plivo answers "true" not "machine", and the premium screening EVENT carries no result at all — each miss offers the one fix that cannot work |
| D-15 | the settings form's "number to reach you on" is editable in every mode | **read-only once they are live on their own number** (server refuses it too) | Round-2 audit: that field IS the verified line — swapping it there kept the green "connected" badge, the measured ring and the dial codes of a line nobody had tested |
| D-16 | the screen's own 150 s stop is a verdict | **it says "we didn't get a result"** | Round-2 audit: the client cannot see the line. For a disconnect the fabricated verdict was the exact inverse of the server's rule |
| D-17 | each ring option says "about two rings" | **the seconds alone, with one sentence of consequence** | Owner ask 2026-09-16. A ring is a carrier cadence, not a constant: 10 seconds is about two rings in North America and nearer three where the cadence is shorter, so the count was a guess printed as a fact |
| D-18 | the default ring time is 10 seconds | **15 seconds** | Owner ask 2026-09-16, and it is the longest we have measured to still beat voicemail (Rogers 15, untested cap 15). A carrier measured lower still keeps its own cap |
| D-19 | the ring time is chosen in its own dialog, after connecting | **also inside connect step 3, above the code that carries it** | Owner ask 2026-09-16. Code 2 IS the ring time, so the choice belongs where that code is read; the adjust dialog now shows the same control, written through the same route |
| D-20 | one verification caller per country, never shared | **Canada and the United States share one Telnyx +1 number; India opens on a placeholder** | Owner instruction 2026-09-16. The guard now forbids borrowing ACROSS CALLING CODES rather than between countries, so India can still never be rung from a +1 number. ‼️ India's `+919999999999` is a placeholder: Plivo will refuse to dial from a number the India account does not own, so every check there fails until the real number lands |
| D-21 | one sentence for every refused number | **two: ours, and a premium or service range** | Reproduced live on the Canada stamp 2026-09-16 — typing our own verification number answered "that looks like a premium or service number", which sends a provider hunting for a fault in their own line |
| D-22 | the assistant page is a usage card beside the number cards, with who-answers and the knowledge line lower down | **the left column carries usage, who-answers and the knowledge line; neither column is stretched; the "Your numbers" line is deleted; the settings form is two columns from 1024** | Owner ask 2026-09-16 (image 4.png/5.png/6.png): the left card was inflated down a whole screen, and the same two numbers appeared in three places, once with no role |
| D-23 | disconnect is the third expander on the number card | **a danger-tone action on the card's header row**, and "Use a different number" joins the connected card | Owner ask 2026-09-16 (image 3.png). ‼️ The second half is a defect this session created: the settings field is read-only and its hint points at the card, which had no control to change the number |
| D-24 | the connect wizard refuses a provider who is already connected | **step 1 is always reachable** | Closing audit 2026-09-16. The phone's connect screen returned "you're connected" before rendering the form, so D-23's "Use a different number" was a dead link on the provider app — both halves individually right, together a dead end |
| D-25 | the ring picker's options are disabled while a save is in flight, and when only one is offered | **never disabled; the press is guarded instead** | Closing audit 2026-09-16. The browser blurs a disabled element, so the option they just pressed threw focus to the page body; and a saved value the carrier no longer offers left the single option both unselected AND unpressable, with no way out |
| D-26 | the platform default ring time is used as-is when connecting | **clamped to what the carrier actually offers** | Closing audit 2026-09-16. Raising the default to 15 armed a latent refusal: a carrier certified at 10 offers only `[10]`, connect ran at step 1 with 15, and threw "choose one of the offered ring times" — with the picker that would offer one sitting downstream of the throw |
| D-27 | "These apply to both of your numbers" sits above the settings form | **deleted** | Closing audit 2026-09-16. It rendered for every provider, including the ones with a single number, and where it WAS true the hours section already said it under the right gate |
| D-28 | a wrong-length number and a non-E.164 number share one sentence | **two sentences** | Closing audit 2026-09-16, same class as D-21: "+1416555011" IS in international format, so telling them to write it in international format sends them to redo what they did right |
| D-29 | Plivo's refusal and a transport failure are the same dial result | **the refusal is reported as one** | Closing audit 2026-09-16. Only Telnyx ever returned `RejectedByCarrier`, so every India failure raised the admin alert naming the carrier adapter as the suspect, when the suspect is the verification number |
| D-30 | the document page is addressed as `?id=` on the laptop and `docId` on the phone | **`docId` on both** | Closing audit 2026-09-16. The phone claimed the universal link and could not read the id off it, so every tap opened the viewer with nothing to view |
| D-31 | the settings form is two columns from 1024 with the short blocks moved first (D-22) | **‼️ REVERSED by the owner 2026-09-17: only Phone setup and Languages share a row; every other section is a full-width row in its ORIGINAL order** — voice (two columns of cards), greeting, instructions, hours, call recording, data & retention, help improve | Owner, reviewing the built page: two columns squeezed the voice cards into one narrow column and pulled recording, retention and consent into half-width cells, leaving white space beside each. Supersedes the settings half of D-22 |
| D-32 | Pause assistant and Private mode sit under the number cards in the right column | **the left column, under who-answers and the knowledge line** | Owner 2026-09-17: they extended the right column past the left and left a screen of white space beside them |
| D-33 | Disconnect is a danger-tone link on the number card's header row (D-23) | **a red outline button at the FOOT of the card, right-aligned, under the two expanders** — the same treatment as "Cancel assistant" at the foot of the page; the phone does the same | Owner 2026-09-17 disliked the link wrapping under the number and asked for a recommendation. A rare, destructive action belongs at the foot of what it removes, away from the number and from the green "Check it now". Supersedes the placement half of D-23 |
| D-34 | the phone's assistant screen has no pull-to-refresh and no haptic feedback | **pull-to-refresh (brand green, the Activity screen's shape) and the app's `haptics` helper: a light tick on copy, selection on the two switches, error when a switch fails, success or warning when a check finishes** | Owner 2026-09-17: the phone must use its own design. A check finishes on the server, so "Not checked yet" becomes "Connected" without the screen being told — pulling is how a phone user asks again. 13 other screens already refresh this way |
| D-35 | Disconnect is a red outline button at the foot of the number card (D-33) | **its own ruled row directly under the card's actions, before "How it works"**: actions · line · Disconnect · line · How it works — left-aligned under the primary action, web and phone | Owner 2026-09-17, after seeing D-33 built. Supersedes D-33's position; the button treatment is unchanged |
| D-36 | `BlockedNumbers` lists `+12896981655` | **`BlockedNumbers` ships EMPTY** | ‼️ Owner 2026-09-17: typing that number answered "That's one of Clinket's own numbers". It was never ours — this PLAN records it as the owner's sandbox placeholder for the CA verification caller. When the caller moved to `+18449254651` (D-20), I added the old value to `BlockedNumbers` on the assumption it was a Clinket line. The own-number tests also used it as the fake verification caller, which is how the assumption took hold; they now use the real caller, and `OwnNumber_Connect_ANumberClinketDoesNotOwn_IsAccepted` connects it against the API's real appsettings |
| D-37 | the knowledge line ("Your assistant already knows your Clinket profile…") rides the left column under who-answers (D-22) | **back where it was before the number cards: after the settings section, just above Cancel assistant** — web and phone | ‼️ Owner 2026-09-17: beside the number cards it read as out of place. It describes what the assistant answers WITH, so it closes the settings. Supersedes the knowledge half of D-22 and the phone's L8 move |
| D-38 | a rule runs above AND below the Disconnect row (D-35) | **only the rule below stays**: actions · Disconnect · line · How it works | Owner asked for a recommendation 2026-09-17. Disconnect is one of the number's actions, so spacing groups it with them; a rule above split it off and stacked three rules in a short space. The rule below still separates what you DO from the "How it works" reference |
| D-37 | the own-number values live in `Voice:OwnNumber` (a deploy to change a number) | **the operational values live in Cosmos SystemData: `voicecfg_{iso}` (offered, verification number, measured carriers) + `voicecfg_platform` (ring times, blocked numbers), edited at admin `/voice-config`; the file keeps the numbering plans and timers and is the fallback while no document exists** | Owner 2026-09-17 (§0.7 approved in conversation): cached a DAY (every RU counts), a stored document REPLACES the file values whole, an empty caller stays empty (fail-closed), seeded by `cosmosindexsetup` create-if-absent and never overwritten. Mockup waived by the owner ("no need to have the mockup") |
| D-38 | the verification number is refused only in the connect flow | **refused wherever a number is entered, from the RESOLVED config (never hardcoded)**: own number, the number calls ring (forwarding target), an admin assigning or quoting a line; an admin cannot make a business line the verification number, and a verification number can be replaced but not removed | Owner 2026-09-17: "whatever our verification number is" must never be accepted. Removing it would trap connected providers, whose only way out is a disconnect check dialled from it |
| D-39 | every stamp answers for every country it has a numbering plan for | **each stamp serves only `Payments:Regions` (NA = US + CA, India = IN)**: admin 403 for another stamp's country, the provider sees "not available in your region", the India blocked list refuses a +1 number | Owner 2026-09-17: two admin portals, two stores. Found while building it: `Payments:Regions` bound `us,ca,in` on EVERY stamp (class default + a base appsettings list merged by index), which had also opened every region's billing to every stamp. Fixed at the source: empty default, no base value, the API refuses to boot without a valid list, deploy.ps1 asserts the setting |
| D-40 | turning a country off hides the own-number card's controls | **it stops NEW connections only; a connected provider still sees Disconnect (web + phone)** | 2026-09-17: the only way out of own-number mode is a disconnect check, so turning a country off must never lock anyone in |
| D-41 | a failed store read serves the file values for the documents it could not read | **it serves the last good snapshot, or the file WHOLE on a cold start, never a mix**; measured carriers are stored as a LIST | Independent review 2026-09-17: one failed read could bring back a retired number or a disabled country. The Cosmos serializer camel-cases dictionary KEYS ("Rogers" was stored as "rogers"), so a carrier name is never a key |
| D-42 | the default ring time is 15 seconds (D-18) | **10 seconds — ‼️ REVERSES D-18** in the file default, the class default and the API appsettings | Owner 2026-09-17, after testing on their own phone: 15 lost to voicemail on the same line where it had beaten voicemail on 14 Sep. Voicemail timing drifts, so the plan's original rule is back: one step below the highest time that wins. ‼️ The stamps read `voicecfg_platform` first (D-37), so the admin Voice Settings page on EACH portal must be set to 10 as well, or the stored 15 keeps winning. A provider already connected keeps the time they chose |
| D-43 | a voicemail-first result offers "Shorten the ring" and "Try again as is" | **the time voicemail beat, and every longer one, is LOCKED** on the result, the card, the ring-time dialog/sheet and connect step 3: shown, greyed, with a lock, and a screen-reader label saying voicemail answered first. The longest time still shorter is marked Recommended and pre-selected, and one press on "Use N seconds" saves it and opens code 2. "Try again as is" (`fail.voicemailAlt`) is deleted in all ten language files. A retry is offered only where nothing shorter exists (a "still picked up first" sentence with the silencing / Do Not Disturb advice) or where the carrier owns the timer | Owner ruling 2026-09-17, Decision 1. ‼️ The lock is held by the open dialog, wizard or screen and keyed to the NUMBER. Saving the shorter time retires the voicemail verdict on the server (D-46), so once that window closes nothing remembers that 15 lost; a later deliberate 15 is caught by the next check. Remembering it would need a stored field, and the sheet stores nothing new |
| D-44 | connect step 3 shows the saved ring time as selected | **while the saved time is the one that lost: nothing is selected, code 2's digits are hidden, its dial button reads "Dial code 2 (after choosing a time)", and "I've done both" waits** until a shorter time is saved | Found while writing the lock's tests, 2026-09-17. The first build selected the losing 15 (the picker never locks its own value) and left its code 2 dialable, so step 3 was the one place the provider could still carry on at 15. The lock is taken only where a shorter time exists and the carrier is not CDMA: that family still receives an options list, and locking it would leave no way forward |
| D-45 | "Your phone rings for about {measured ?? chosen} seconds" | **"Your phone rings for {chosen} seconds, then your assistant answers."** The test call's stopwatch is its own line ("reached your assistant in about N seconds, counting the moment before your phone started to ring"). A ring time changed since the last check says "dial the new code, then check it works", with a "Show me the code" button, instead of claiming the new time. CDMA says the carrier decides; a measured 0 says calls come straight through | Owner 2026-09-17: chose 10 and was told "about 15". The stopwatch starts when we place the call, so it includes call set-up. It is the only measurement a carrier allows (§13.0), so it stays, labelled for what it is |
| D-46 | every finished check writes its verdict on the business | **five server rules**: (1) a check that ran out of time writes nothing; (2) an answered call writes nothing; (3) a disconnect check that still reached the assistant marks the line connected with today's date, and one that could not reach the phone writes nothing; (4) changing the ring time clears the measured time and retires a voicemail-first verdict (other verdicts stay), and is refused while a check call is live ("We're already checking your number"); (5) continuing with the SAME number in "Use a different number" keeps the chosen ring time if the carrier still offers it | Owner 2026-09-17, Decision 3. `VoiceOwnNumberOutcomes.WritesAVerdict` decides once, and the coordinator skips the profile write entirely when it says no, so there is no ETag churn. Only a result that exercised the forward may move the card |
| D-47 | the disconnect check says the call "should ring to voicemail, not your assistant", and its strip ends "Waiting for your assistant" | **"This time the call should go to your voicemail or ring until it stops, not to your assistant"; the strip's last step is "Voicemail or rings out"** (connect keeps its own). Six endings, each with its own sentence: voicemail answered (off) · rang out with no voicemail (off, with a note that the carrier can switch voicemail on) · still reached the assistant (still on, the clear code again, "I've dialled it again") · answered (proves nothing) · couldn't reach the phone (proves nothing) · no result (the number stays connected here) | Owner 2026-09-17: a phone with no voicemail rings out. "Answered" and "unreachable" were being told "still connected", a sentence that says the call reached the assistant |
| D-48 | a check refreshes the assistant when its own screen hears the result, and reads it twice | **one app-wide listener** (web `VoiceAssistantContext`, phone `SignalRProvider`) re-reads the assistant when a check update is FINAL, and swallows the now-stale "Checking your number" pop-up. The check screen re-reads only when it found the result by polling or gave up waiting (plus the one late re-read) | Owner 2026-09-17: a check that finished after its window closed left the card wrong until a reload. No polling was added; a live result now costs one read instead of two |
| D-49 | the read-only "Number to reach you on" field keeps the value it opened with | **it follows the saved number** the moment the card's number changes | Owner 2026-09-17: after "Use a different number" it showed the old number until a reload, and a save would have sent the replaced number back to be refused |
| D-50 | a test call that could not be placed at all is a verdict about their line | **it writes nothing and the screen says "we didn't get a result"**: the finalize clears the placement stamp, the check DTO carries `notPlaced`, the live update carries it too, and both apps read it as no result | ‼️ Independent audit 2026-09-17, the worst of the 18 findings. With no verification caller for the country, or with the carrier refusing OUR caller (India's placeholder does exactly that), the check ended `Failed/CouldNotConnect` — so a CONNECTED provider pressing "Check again" was told "We couldn't reach that number. Check the number is right", was sent to re-enter a number that was fine, and lost their Connected badge. Nothing had rung their phone. A call the carrier refused after it LEFT is still a verdict about their line, and stays one |
| D-51 | the settings form only follows the number to reach you on | **it follows the number mode and the answering mode too** (web and phone) | ‼️ Independent audit 2026-09-17: the form keeps what it opened with and sends all of it on save, so after connecting (or disconnecting) a save answered "The number mode cannot be changed while the assistant is active" — every save, until a reload. A stale answering mode failed the same way, because own-number mode forbids two of them |
| D-52 | step 3 locks from the time voicemail beat, whatever the carrier | **no lock where the carrier owns the timer, and code 2 is only shut when a shorter time exists**: at the shortest ring the losing time stays pickable and dialable, and only the longer ones are locked | Independent audit 2026-09-17, two dead ends: correcting the carrier to Verizon after a voicemail loss left step 3 with no picker, no code 2 and a disabled "I've dialled it"; and a loss at the shortest ring locked every option with nothing shorter to choose. Held locks are now read through one rule that drops them for another line and for a carrier-set ring |
| D-53 | "Check again" on a card whose ring time changed starts a check | **it shows code 2 first ("I've dialled it"), then checks** | Independent audit 2026-09-17: the phone still forwards on the OLD timer until the new code is dialled, so a check started from that card measured the old time and then stated the new one — or recorded a voicemail loss against a time that had never been on the line |
| D-54 | an own-number check update that no screen claims becomes a pop-up | **no check update is ever a pop-up, in either app** | Independent audit 2026-09-17: sheet 2F removed it for a FINISHED check, but an in-progress one still said "We're checking that calls to your number reach your assistant" — to teammates, to a provider who pressed Stop, and word for word during a DISCONNECT check, which is the opposite of what that call is for. Progress belongs to the check screen; the result belongs to the card |
| D-55 | the shared assistant state is whatever the last answer says | **a read that began before a save never replaces that save, and a refresh asked for during a read in flight reads again** (one extra read at most, coalesced, and dropped if the session is swept in between) | Independent audit 2026-09-17: a verdict refresh and a "Use 10 seconds" save can cross, and the older read put 15 back — with the code screen then showing code 2 for the time voicemail had just beaten. On the phone the same crossing swallowed the refresh instead, leaving the card stale after a check finished behind a closed sheet |
| D-56 | the connect flow's result may be replaced by the connected card, and the disconnect result lives only while the number is in use | **step 4 keeps its own result on the phone, and the disconnect sheet/dialog survives the refresh that ends own-number mode** | Independent audit 2026-09-17: the phone swapped the result for a card with neither the measured line nor How-it-works the moment the refreshed state said "connected"; and in a country turned off, the "Your number is disconnected" answer vanished as soon as it was true, because the card stops rendering its dialogs once the number is no longer in use |
| D-57 | the phone holds its step-3 lock for as long as the screen is mounted | **reopening the codes takes the lock again from what the server says now** | Independent audit 2026-09-17: the phone's connect screen stays mounted behind the card, so it kept a lock the web wizard forgets on reopen. Same rule now on both: held while open, re-read on re-entry, dropped once a check passes |
| D-58 | the who-answers panel states the chosen ring time in every state | **it names a time only once a check has proved the line**: no time while a new time waits for its code, none before the first check, the carrier sentence on a carrier-set ring, and the straight-through sentence when the assistant answers every call | Independent audit 2026-09-17: beside a card saying "At 15 seconds, your voicemail answers first", the panel said "Rings you first for 15 seconds. If you don't pick up, it goes to what you choose below" — a promise the same screen had just disproved |
| D-59 | the ring time follows the saved forwarding number | **it is forgotten when a different number is typed in settings** | Independent audit 2026-09-17: after a disconnect that field is editable again, so a new phone inherited the ring time chosen for the old one. Reconnecting the SAME phone still keeps its time |
| D-60 | a finished check always writes the profile it read | **a verdict that applies to nothing writes nothing, and a read that fails says whether a write was even due** | Independent audit 2026-09-17: a verdict for a number replaced mid-check rewrote the profile unchanged, costing RU and an ETag that makes a concurrent save retry; and the admin alert said "the application could not be updated" for a check that was never going to update it |
| D-61 | a check that cannot be started shows the server's sentence | **and where there is no server sentence, the screen's own** | Independent audit 2026-09-17: an empty answer from the start route reached the provider as the word "empty check" |
| D-62 | "What changes when you connect your number" ends on "You join live calls from the app" | **"Your assistant handles the whole call": it answers, takes the details, books and deals with whatever the caller needs; you watch it live in the app, can join in, and get a full summary when it ends** | Owner 2026-09-17: the old line explained a thing we do NOT do (ring their phone to bring them in) where the provider wanted to know what they GET. Joining from the app is kept inside the new sentence, so nothing true was lost |
| D-63 | step 2 is two phone settings and nothing else | **plus an OPTIONAL note, on iPhone and Android alike: their voicemail does not have to answer first, and the carrier can make it wait longer or switch it off** | Owner 2026-09-17. It is a note, never a third tick: voicemail is a CARRIER setting, so a box that gates "Both done, continue" would either block a provider who cannot change it from the phone, or make the gate meaningless |

| D-64 | a check something answered proves the line failed, or proves nothing at all | **it is RECORDED and the badge does not move, and the provider is asked the one thing detection cannot see**: "Did you pick up?" — only their "No, I didn't" takes the line off connected, and the card keeps asking until they answer | Owner 2026-09-17. Detection can read an iPhone voicemail as a person, so "you answered" may be a voicemail we are deaf to. The forward never ran either way, so the last real proof and its date stand; what happened is written down, the card says the last check told us nothing, and the server refuses the correction unless an answered check is actually on file. An undecided verdict now also raises an admin alert naming the line, because a voicemail we cannot hear is the one failure a provider can never diagnose |
| D-65 | the screens print our own stopwatch ("it reached your assistant in about 25 seconds") | **they print what a CALLER lives through, and say whether it is healthy** | Owner 2026-09-17, after reading 25 seconds beside "your phone rings for 15 seconds" as a bug. It was neither a bug nor a ring: the measurement spans our dial being accepted → the forwarded call reaching us, so it is ALWAYS longer than the chosen ring by the carrier's handover. Two numbers that cannot agree, with nothing saying why. The number is now named for what it is (`callerWaitSeconds` end to end, including the live update's payload), the success screen explains the difference in one sentence, and the card says "a normal wait" or warns |
| D-66 | any measured wait is just a fact to display | **past `Voice:OwnNumber:CallerWaitHealthySeconds` (30) the card warns in the caller's terms, with the fix in the same row** | Telephony answers within 3–4 rings (~20–24 s) and abandonment climbs steeply past half a minute, so a long wait is lost business for the provider — the one reading they can act on. The server decides it (one definition; neither app does the arithmetic), it is silent where the assistant takes every call and where the line forwards before it rings, and it never promises a shorter ring on a line that has none — including a carrier-set ring, where the options list still offers shorter times the line can never use |
| D-67 | the ring-time chooser shows times and nothing else | **it says what each choice would mean for a caller**, live as they tap | The handover belongs to the carrier, not to the ring, so `wait − ring` carries to every option and the relative difference is exact. It is the only reason to move that dial, and until a check has measured the line it predicts nothing rather than inventing a number |
| D-68 | the card’s row holds Check again · Adjust ring time · Call your assistant to hear it · Use a different number | **two links: Check again · Adjust ring time**; "Change" beside the number; hearing the assistant at the end of How it works (open on arrival); "No, I didn’t pick up" inside the sentence it answers | Owner 2026-09-18: four links wrapping over two lines above a red button read as five controls of equal weight. "Change" appears in every state except "We couldn’t reach that number", whose own button already opens the number step — which also closes a real gap: the locked settings field said "change it on your number card" while a not-checked or failed card had no such control |
| D-69 | a refused disconnect shows the server’s sentence and stops | **it re-reads the line; if the number is already off it says "Your number is disconnected — It was already off"**, web and app, and keeps updating if the earlier check is still running | Owner 2026-09-18, their exact case: presses were refused while a check one of them HAD started finished behind the refusal. For a live assistant the only way out of own-number mode is a disconnect check that proved the forward is off — nothing disconnects in the background |
| D-70 | web and app draw the card and its dialogs on their own scales | **one scale**: number 16 on a phone / 18 wider, links 13, notes 12 (amber included — the app had 12.5), How-it-works 13 / 12.5 (the app had 14.5 / 13), dialog titles 18 on a 24 line with the icon on the FIRST line (a wrapped title floated between two), the checking spinner in the same 36 circle as every verdict icon, links lifted to a 44pt touch target on the phone | Owner 2026-09-18: "font and colour and size and all need to make sense and align and consistent in the web and app". Colours stay each platform’s own tokens (the app’s design system, D-34) — the palette already matches || D-71 | every check shares one allowance (5 an hour per API instance, 15 a day), the disconnect check too | **a number that passed a check disconnects with NO limit and spends nothing; a never-proven number’s disconnect has its OWN 5 an hour and may go 5 past the daily 15 (`Voice:OwnNumber:DisconnectExtraChecksPerDay`); every refusal says the real reason; a disconnect of a number already off says so; and every proof is forgotten when the number changes — in the settings form too, not only the connect flow** | Owner 2026-09-18: "it allows me to connect but not to disconnect" — connecting places no call, every check does, and the exit shared the entry’s limit. The owner then asked whether disconnect needs a limit at all: for a PROVEN number no (it can only ring the provider’s own phone); for a never-proven one yes — a number is typed before anything proves whose it is, and "type a stranger’s number, disconnect, repeat" would ring that stranger from our verification number as fast as calls finish (and get the number flagged as spam, breaking checks for every provider). The settings form kept the old number’s proof, which would have handed a new number the unlimited exit. A day refusal also gave back the hour’s slot it had taken |

**Judged and deliberately NOT changed (independent audit, 2026-09-17):**

- **Two cross-device races of a few milliseconds.** `ConnectAsync` can change a ring time while a check is live (a carrier
  correction on the same line), and the ring route reads the live check a moment before it writes. Both need two devices
  acting inside the same instant, and closing them properly means stamping the ring time on the check document — a schema
  change (§0.7) for a race the screen itself prevents: the check screen locks while a call is live.
- **A disconnect answered by voicemail still reads as "off"** (owner ruling 4). The clear code takes down every conditional
  forward at once, so a voicemail answer means the no-reply forward is gone; a line where voicemail beats the forward could
  never have connected. Recorded because it is the one ending that is inferred rather than observed.
- **A test call that never left still spends one of the provider's daily checks.** The admin alert fires on the first one,
  and refunding from the Functions host would duplicate the allowance logic that lives in the API.

### 17.14 ‼️ ASK — the decisions only the owner can make (nothing proceeds on an assumption)

| # | Question | Recommendation |
|---|---|---|
| ASK 1 | Approve §17.6 (A) the `voicecheck_{businessId}` TTL doc family and (B) the `ownNumber` sub-object on `VoiceAssistantApplication`? | ✅ **APPROVED 2026-09-15 — both** |
| ASK 2 | Permission for connect/disconnect/adjust/answers-all | ✅ **RULED: `voice.number.manage`** |
| ASK 3 | `EnabledCountries` at launch | ✅ **RULED: all three — `["CA","US","IN"]`.** Honesty therefore moves to the per-carrier `CertifiedCarriers` map (§17.8) |
| ASK 4 | Check limits per business | ✅ **RULED: 5 / hour · 15 / day** |
| ASK 5 | India dial-string format for the DID inside the codes; **who holds the Indian test SIM, and when** | ⏳ **OPEN — a launch blocker** (IN is on) |
| ASK 6 | Verizon / US Cellular in the US launch | ✅ **RULED: included, limitation stated** — CDMA template family, Verizon step-3 variant, no Adjust, `*73` to disconnect (§17.8) |
| ASK 7 | Owner-verification rule for the business number | ✅ **RULED (owner asked for the best answer): the verification call IS the proof — no SMS/OTP; confirm dialog + target blocklist + server-side target** (§17.8). Works for landlines |
| ASK 8 | Who buys the two verification numbers, through which path, when | ⏳ **OPEN — the IN number's KYC lead time is a launch blocker** |

**§17 is complete for everything that does not hinge on the two open answers (5 and 8 — both logistics).** Once they are in, this
section is the implementation checklist — follow it in order, build nothing it does not name, and leave
nothing it names unbuilt.
