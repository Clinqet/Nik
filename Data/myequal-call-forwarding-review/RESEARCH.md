# MyEqual AI and existing-number call forwarding for Clinket

**Clinket can support the experience described: keep the existing business number, ring the owner's normal phone, and let AI answer calls the owner misses or declines.** The mechanism is conditional call forwarding at the owner's carrier. The strongest initial design is a dedicated Clinket answering number behind each connected business line, with forwarded calls entering the existing voice assistant directly. This requires changes to onboarding and call routing, but does not require replacing the MCP or knowledge architecture.

Evidence was checked on September 14, 2026. This is a research and design proposal. It does not establish live carrier compatibility, measured latency, or approval to implement schema or UI changes. No account was registered, no forwarding was activated, and no live calls were placed during this review.

**What MyEqual's public material establishes.** Equal's setup help explicitly identifies network-provider call forwarding and says forwarding can persist after account deletion. That confirms where the routing rule lives. Its public account help describes Indian carrier support with a BSNL exclusion; that is a product support claim, not proof that BSNL lacks forwarding generally. [1][2]

The current Android listing advertises decline-to-assistant, live transcripts, summaries, recordings, joining calls, and handling saved as well as unknown callers. It shows 5M+ downloads and a September 9, 2026 update. These are store-listed figures and features, not independently tested quality or retention measurements. The iPhone listing is live and requires iOS 17.2 or later. [3][4]

Some help material is stale: the account page still says iOS is coming, while the actual iPhone listing is available. The customization help mentions English and Hindi, while the home page advertises 9+ Indian languages. Prefer current app releases for availability, and test individual languages rather than treating either page as a complete compatibility matrix. [2][4][5][6]

**Equal is a consumer call-assistant competitor, with overlap in business use.** Its public pitch emphasizes handling personal interruptions, spam, deliveries, caller intent, and follow-up actions. The evidence does not establish a marketplace and provider operating system equivalent to Clinket. Prosus identifies the operator's earlier identity/data-sharing business, an October 2025 consumer AI launch, and a US$30 million Series B in tranches. That announcement reported more than one million monthly active users and 350,000 daily active users; those are company/investor-reported figures at announcement time, not current audited usage. [3][7]

It would be premature to say Equal has no tools, no contextual memory, or no ability to expand into bookings. Its privacy policy describes personalization and names Ultravox/Fixie, Sarvam AI, Gemini, and ElevenLabs as AI processors, with roles spanning conversational voice, transcription, language processing, and speech synthesis. It does not disclose which combination serves each call, the telephone carrier, or the routing architecture. Public material reviewed did not establish an MCP implementation or a business booking/knowledge workflow comparable to Clinket's. Absence of public documentation is not proof of absence. [8]

**The three setup calls were most likely three carrier commands.** Three conditional rules explain the observed behavior:

| Condition | What the carrier does | What the owner experiences |
|---|---|---|
| No answer | Forwards after the carrier's ring timer expires | Phone rings normally, then AI answers |
| Busy | Forwards when the carrier determines the line is busy | AI can answer after a decline, depending on carrier/device behavior |
| Unreachable | Forwards when the line cannot be reached | AI can answer while the phone is off or outside coverage |

For example, Vi documents `*61*DESTINATION#`, `*67*DESTINATION#`, and `*62*DESTINATION#`. The destination can be identical in all three. The prefixes change the rule being registered; they do not imply three different AI servers or three separate telephone numbers. These are illustrative carrier-specific commands, not instructions to activate anything now. [9]

There is also a close US analogue: Google's own voicemail instructions tell AT&T Wireless users to place three separate conditional-forwarding commands, waiting for confirmation between them. This independently demonstrates that a three-call setup is an established carrier feature. [10]

The precise strings used in the observed Indian setup were not available. Therefore, identifying those specific three actions as busy/no-answer/unreachable activation is a high-confidence inference, not a recovered record of the setup. If they were three ordinary telephone numbers without service prefixes, they might instead have included verification calls or a carrier-specific provisioning sequence. Ordinary calls to arbitrary external numbers do not, by themselves, establish forwarding rules.

**The carrier changes the destination while the caller is still connected.** The phone owner can think of the sequence as:

```text
Customer calls the existing business number
                |
                v
Owner's carrier rings the owner's normal phone
                |
        +-------+--------------------------+
        |                                  |
   Owner answers                    No answer / busy /
        |                           decline / unreachable
   Normal conversation                     |
                                           v
                              Carrier forwards the call
                                           |
                                           v
                              Clinket answering number
                                           |
                                           v
                              Plivo or Telnyx receives it
                                           |
                                           v
                              Clinket selects the business
                                           |
                                           v
                              AI + existing MCP capabilities
```

The AI server does not watch the native phone ringing and then seize the SIM's audio. The telephone network delivers another inbound call leg to the answering service. Plivo documents both forwarding an external number to a Plivo number and routing external-provider SIP traffic into a Plivo application. Its normal inbound integration invokes the application's answer URL, after which the application controls call handling and media. [11][12]

Declining an incoming call is distinct from ending an answered call. Conditional forwarding can handle a decline when the carrier maps it into a forwarding condition. It does not recover a call after both parties' connection has ended. If Clinket is already hosting and bridging a call, it can implement a separate mid-conversation handoff while retaining the caller leg; that is a different topology.

**The owner's setup action supplies carrier authorization.** A normal self-service forwarding feature generally does not require Clinket to negotiate a separate partnership with every mobile carrier. The account must support the feature, and the owner must invoke its authorized activation method. Pressing Call on the setup commands from the selected SIM is such an action; carrier account settings are another. It can be user-directed authorization even when the app describes the process simply as assistant activation.

An SMS OTP in Clinket proves control of a number for that verification flow. It is not a universal API credential for changing that line's carrier services. Our server cannot configure an arbitrary mobile line solely because someone entered its number. Enterprise carrier APIs or managed PBX integrations are separate possibilities with their own access arrangements. The product should plainly tell the owner which calls will be redirected and how to restore their original handling. Carrier-routing activation and disclosure about AI/recording serve different purposes. [1][13]

**An invisible destination is different from having no destination.** For ordinary number-to-number forwarding, there must be a reachable telephone number at the receiving end. A DID is a telephone number that routes into software; it does not require the business owner to acquire another SIM or carry another phone. MyEqual can keep that destination out of ordinary product screens while inserting it into setup commands.

Public evidence does not reveal whether Equal uses one destination per subscriber, a shared destination pool, or a bespoke carrier interconnect. These are distinct designs:

| Receiving design | Identifying the intended business | Assessment for Clinket |
|---|---|---|
| Dedicated answering DID per connected line | The incoming destination resolves directly to a business | Recommended first version; fits current runtime lookup |
| Shared DID or small destination pool | Requires reliable original-called/diverting-number metadata or another authenticated routing mechanism | Possible, but do not assume safe cross-carrier identification |
| Direct SIP from an existing PBX/carrier | Trusted trunk and destination information identify the business | Useful later for managed business telephony; not normal SIM setup |
| Port the public number to a programmable carrier | The public number itself is hosted by the programmable carrier | Larger service migration; unnecessary for the observed experience |

Plivo's documented `ForwardedFrom` metadata is carrier-dependent. SIP's Diversion mechanism can carry forwarding information, but a standard's existence does not guarantee that every retail carrier and interconnect preserves it into a webhook. A shared-number design must be tested against actual traffic and fail closed when tenant identity is missing or ambiguous. [14][15]

Caller identity and business identity must remain separate. A caller can contact many businesses, so the caller's `From` number cannot determine which business was called. A dedicated answering DID provides stable business routing even if diversion metadata is absent. Forwarding metadata and caller ID also do not substitute for the existing booking verification or authorization rules.

**This can work in India, Canada, and the United States, but compatibility belongs to a carrier, plan, device, and destination combination.** There is no universal three-command activation sequence.

| Market / service | Public evidence | Implication for launch |
|---|---|---|
| India — Vi | Official documentation gives busy, unanswered, and unreachable activation commands | Strong candidate for a guided three-step setup [9] |
| India — Airtel | Official material describes all three conditional modes and app/dialer setup | Validate actual command formatting and handset behavior on test SIMs [16] |
| India — Jio mobile | Current official instructions use handset settings or MyJio with SIM verification; destination restrictions apply | Offer the currently supported mobile flow rather than copying older code lists [13] |
| India — BSNL | Equal's help excludes BSNL from its supported set | Treat as uncertified for this proposal, not as technically impossible [2] |
| Canada — Rogers mobile | Official support documents the three conditions and their codes; it explicitly says conditional forwarding will not work with voicemail activated | Onboarding must handle the voicemail prerequisite [17] |
| Canada — Bell Mobility | Official support describes No Answer Transfer and forwarding configuration | No-answer support documented; certify decline, unreachable, and current plan provisioning separately [18] |
| Canada — TELUS mobile | Located TELUS-hosted device/Smart Hub material, but not a sufficiently clear current retail-mobile support contract for every requested condition | Keep TELUS on the validation list; do not infer retail-mobile guarantees from another product's manual [19] |
| US — T-Mobile | Official short-code table documents no-reply, unreachable, and busy forwarding | Strong candidate; its syntax differs from Rogers/Vi [20] |
| US — Verizon Wireless | Official FAQ documents `*71` plus the destination for unanswered calls | Fewer setup steps may suffice; test decline and unreachable separately [21] |
| US — AT&T Wireless | Google Voice's official integration guide documents three conditional commands | Strong evidence for the mechanism; still test the specific AT&T plan [10] |
| MVNOs, prepaid variants, landlines and PBXs | Feature availability and provisioning differ | Separate support entries; do not infer support from the underlying radio network alone |

Jio's mobile page explicitly excludes international destinations, BSNL destinations, and the subscriber's own Jio number. This makes a supported Indian receiving number important. JioFiber publishes a different code-based guide; it should not be presented as proof of current Jio mobile activation behavior. Verizon also excludes international forwarding destinations. Local domestic answering numbers reduce avoidable routing and billing complications. [13][21][22]

**MyEqual's apparent speed does not establish a universal one-second guarantee.** No-answer forwarding first waits for the mobile carrier's timer. Declining can avoid that remaining wait. Once forwarding begins, perceived pickup time includes carrier routing, destination answer, our application startup, any disclosure, and the AI's first audible response. A prompt audio greeting can conceal some preparation time, but should not be confused with a fully ready conversational model.

In the existing Clinket topology we see the call before ringing the provider, which provides time to warm AI context while their phone rings. Under carrier-first forwarding we normally receive nothing until the forward occurs, so that preparation window disappears. The current `AiFirst` path warms context during the disclosure and is useful to reuse. Measure arrival-to-first-audio and arrival-to-first-AI-speech separately, alongside the caller's total wait; report median and tail latency for warm and cold services.

**The current code already contains useful foundations, but `ForwardExisting` is not a finished feature.** The following findings are based on local source inspection, not a successful end-to-end carrier test:

| Finding | Verified local evidence | Design consequence |
|---|---|---|
| `VoiceNumberMode` contains `NewDedicated` and `ForwardExisting` | [VoiceNumberMode.cs](C:/Nik/clinqetshared/Enums/VoiceNumberMode.cs:6) | Reuse the existing product concept |
| Existing-number choice is disabled and marked coming soon on web and mobile | [Web form](C:/Nik/clinqetwebpartnerapp/src/components/Profile/voiceAssistant/VoiceApplicationForm.jsx:355), [mobile form](C:/Nik/clinqetmobilepartnerapp/src/Screen/ProfileFlow/VoiceAssistant/ApplicationForm.tsx:380) | Needs a complete onboarding experience, not simply an enabled button |
| Incoming Telnyx and Plivo calls resolve a line by the received destination | [Telnyx handler](C:/Nik/clinqetfuncations/Clinqet.Communications/Functions/VoiceCallControlFunction.cs:171), [Plivo handler](C:/Nik/clinqetfuncations/Clinqet.Communications/Functions/PlivoVoiceCallControlFunction.cs:241) | A dedicated hidden DID fits the current approach |
| Line lookup is a point read using `voiceline_` plus the number for both id and partition key | [VoicelineRepository.cs](C:/Nik/clinqetinfrastructure/Data/COSMOS/VoicelineRepository.cs:32) | No cross-partition discovery query is needed for that design |
| `Voiceline` carries a business, DID, `ForwardTo`, and `HoursMode`, but no `NumberMode` property | [Voiceline.cs](C:/Nik/clinqetcore/Entities/COSMOS/Voiceline.cs:8) | Runtime routing cannot assume the application choice is already projected |
| Application sync writes `ForwardingTarget` into runtime `ForwardTo`; it does not project `NumberMode` | [VoiceAssistantService.cs](C:/Nik/clinqetinfrastructure/Services/Voice/VoiceAssistantService.cs:913) | The present field means the provider dial-out destination, not the original public number's carrier rules |
| Both carrier state machines implement `AiFirst` | [Telnyx AI-first handler](C:/Nik/clinqetfuncations/Clinqet.Communications/Functions/VoiceCallControlFunction.cs:553), [Plivo entry flow](C:/Nik/clinqetfuncations/Clinqet.Communications/Functions/PlivoVoiceCallControlFunction.cs:321) | Much of the immediate AI entry already exists |
| Cap/private branches can still dial the provider | [Telnyx fallback](C:/Nik/clinqetfuncations/Clinqet.Communications/Functions/VoiceCallControlFunction.cs:287), [Plivo fallback](C:/Nik/clinqetfuncations/Clinqet.Communications/Functions/PlivoVoiceCallControlFunction.cs:323) | Setting `AiFirst` alone is insufficient for safe forwarding mode |
| Existing loop validation rejects forwarding to a platform DID | [Loop validation](C:/Nik/clinqetinfrastructure/Services/Voice/VoiceAssistantService.cs:732) | It does not prove the external mobile line is not forwarding back to us |
| Telnyx parsing and the neutral event model do not expose an original diverting number | [Parser](C:/Nik/clinqetinfrastructure/Services/Communication/TelnyxWebhookParser.cs:12), [event model](C:/Nik/clinqetshared/Models/Voice/VoiceTelephonyEvent.cs:8) | A shared-DID router is not already present in this seam |
| Voice prompts configure MCP and allow booking, verification, messages, and conditional knowledge tools | [RealtimeSessionPayloadBuilder.cs](C:/Nik/clinqetinfrastructure/Services/Voice/RealtimeSessionPayloadBuilder.cs:23) | Preserve this downstream functionality when changing call ingress |

**The critical defect to avoid is forwarding a forwarded call back to its source line.** The naive configuration is:

```text
Existing business mobile -> Clinket DID -> same business mobile
                         <- missed-call forwarding loops back <-
```

At best the phone rings twice. At worst it creates repeated call legs, duplicated sessions, confusing outcomes, or unnecessary charges. Network loop limits are not a substitute for correct application behavior.

For existing-number mode, initial arrival should mean the carrier has already offered the call to the owner. Clinket should perform required disclosure, establish business context, and engage AI without another provider dial. Every failure path must obey the same topology: spent minutes, private mode, failed disclosure, failed AI transfer, timeout, manual transfer, and provider join. Preserve the dedicated-number product's current behavior separately.

**Recommended parallel product flow.** Keep the current dedicated-number option and add an existing-number option within the same voice service and business account. This is a new entry and routing mode, not a separate AI backend.

1. The business owner selects the existing-number option, confirms the business line, and chooses country, carrier, and SIM/phone type. Carrier auto-detection can assist but must not override the owner when portability or dual SIM makes it ambiguous.
2. The platform provisions or reserves a supported answering destination, binds it to the correct business, and verifies that its voice application works before inviting the owner to redirect real traffic.
3. The owner receives a short explanation of the three conditions, voicemail effects, and restoration process. Show the answering destination as setup information without requiring a public number change.
4. On the phone, guide the supported activation process: carrier commands, handset settings, or the carrier's app. Desktop onboarding can hand the owner a link or QR to the mobile instructions.
5. Confirm each activation result and then conduct an owner-requested test through the public number. A test reaching the hidden DID directly proves only that the assistant works; it does not prove forwarding works.
6. Show precisely which conditions were verified. One rejected test call proves the decline path only; no-answer and unreachable require their own checks before claiming all three are verified.
7. Provide a test-again function and guided disconnection/restoration. Deleting the Clinket account alone cannot remove carrier-side forwarding.

These are proposed behaviors and labels, not existing endpoint names or approved schema. Detailed design should first reuse existing state and identify only the missing facts that this flow immediately consumes. Any new persisted fields require the owner's explicit schema approval under the project rules. Web/mobile mockups and owner approval precede integrated UI work.

**Forwarding mode changes the meaning of several existing options.** These decisions belong in the design before implementation:

| Situation | Proposed behavior |
|---|---|
| Owner answers on their ordinary mobile | Call never reaches Clinket; no Clinket transcript, summary, or MCP activity |
| Owner misses or declines | AI answers after the carrier forwards |
| Owner wants to join AI live | Prefer an authenticated app/browser audio endpoint, or a verified alternate number that does not forward back |
| Owner chooses after-hours handling | Apply business-hours policy after arrival; Clinket cannot suppress the carrier's initial ring without a different carrier/PBX rule |
| AI minutes run out or AI fails | Use an explicitly designed fallback that cannot dial back into the same forwarding source; recording/message capture must respect existing consent and billing policy |
| Owner pauses the assistant | Explain whether forwarding remains active and what callers will hear; pausing software is not carrier deactivation |
| Owner cancels | Restore carrier handling, then retire the answering binding under a policy that accounts for stale forwarding |
| Owner changes carrier, SIM, number, or voicemail service | Reverify routing and restoration instructions |
| Platform offers a consumer-only assistant | Reuse telephony concepts, but separately design personal context and permissions; do not expose provider-business MCP tools to a personal account |

The proposed loss of visibility into directly answered mobile calls is structural. A cloud system that receives only forwarded calls cannot produce summaries for conversations it never received. Similarly, the business's normal outgoing mobile calls remain on its carrier; forwarded inbound service does not automatically authorize cloud outbound caller ID, move SMS, or change WhatsApp routing.

**Mobile onboarding needs device-specific implementation.** Android's call-screening framework can allow or disallow incoming calls, but that API should not be mistaken for a carrier provisioning API or access to the voice media. Basic missed-call forwarding does not require copying Equal's entire caller-ID and contact-permission experience. [23]

On iPhone, Apple's archived phone-link specification restricts `tel:` links containing `*` or `#`. Treat that as a design constraint to test on supported current iOS versions, with manual copy/dial or carrier-settings instructions available. Do not promise that three web buttons will execute the setup on every iPhone. Current Apple support also directs conditional-forwarding questions to the carrier. [24][25]

Apple Live Voicemail and call screening must be included in device testing: they introduce another answering surface before a call necessarily reaches the network's no-answer condition. Apple distinguishes on-device Live Voicemail from carrier voicemail when the device is off or outside coverage. The interaction with our forwarding path must be measured rather than assumed. [26]

**India's receiving-number arrangement is the main commercial unknown.** Plivo currently documents India-region organizations, approved compliance applications for number rental, and a separate application per customer for resellers. Its current documentation and an older support article differ on accepted documents and review timing, so onboarding should rely on the applicable current carrier process and written confirmation for Clinket's service model. A hidden DID does not eliminate those requirements. [27]

Plivo's public India number page lists a ₹200/month domestic Voice SIP Trunking number rental. This is a published product-specific list price, not a verified quote for our Voice API account, bulk agreement, or full per-business cost. It shows why a dedicated number is a cost decision. Equal's low-friction signup does not establish that it buys one retail-priced DID per user or uses Plivo at all. [28]

The questions for our telephony providers are concrete: can their approved service model support forwarding to an assistant destination for each Clinket customer; what subscriber verification is required; what number inventory and concurrency are available; and what happens when a canceled customer's source line still forwards? For an India consumer product, separately confirm whether the approved arrangement supports individuals without ordinary business registration documents. Do not assume a business-reseller product's eligibility automatically extends to consumers.

**Cost can improve for answered calls while setup and support costs grow.** Under carrier-first forwarding, calls the owner answers directly incur no Clinket AI handling. Forwarded calls incur the receiving carrier/media/model costs; the owner's carrier may separately charge for forwarding under its plan. A dedicated DID adds recurring rental. Avoid assuming that an unlimited mobile calling plan includes unlimited forwarding. [18][21][28]

For comparison, model monthly cost as: destination rental + forwarded-call telephony + AI audio usage + recording/transcription/storage + any provider-join legs + support and provisioning. Keep carrier-to-destination charges paid by the owner visible as a separate amount. Measure real billed units and rounding for both regions before setting a subscription price. Shared destinations are an optimization to evaluate after identity reliability and the commercial agreement are established.

**The first validation should be a small carrier experiment, followed by a routing implementation.** The staged plan is:

| Stage | Work | Exit condition |
|---|---|---|
| 1. Commercial and compatibility check | Confirm India receiving-number model and select representative Indian, Canadian, and US test plans | Written carrier/account requirements and a specific test matrix |
| 2. Controlled network proof | Use owned test SIMs and a test answering destination with no return-to-source dial path; activate supported rules and inspect real inbound metadata | Correct destination and business binding; no-answer, decline, unreachable and restoration observed |
| 3. Product and state design | Specify connected number versus answering DID versus safe human-join endpoint; decide fallback, cancellation, hours, and verification semantics | Reviewable design, minimal schema proposal if necessary, approved web/mobile mockups |
| 4. Carrier-path implementation | Reuse existing AI entry and MCP; add topology-aware ingress and fallback behavior for both Telnyx and Plivo | Unit and real-engine integration checks pass; no return-to-source loop in any branch |
| 5. Pilot | Invite a limited set of owners on tested plans; track activation completion, latency, failed forwarding, and support needs | Evidence sufficient to publish a carrier support matrix |
| 6. Later expansion | Add PBX/SIP onboarding or shared-DID routing where justified | Proven tenant identity, approved carrier agreement, and measured cost advantage |

The controlled test matrix should cover normal pickup, intentional decline, unanswered ringing, busy with call waiting on/off, unreachable, mobile data disabled, app not running, dual SIM, voicemail enabled/disabled, iPhone Live Voicemail, simultaneous callers, blocked caller ID, AI failure, cap reached, manual join, cancellation, and restoration. Include one caller contacting two different businesses to prove that caller identity cannot contaminate tenant selection. Real handset/carrier tests complement backend tests; neither replaces the other.

**Confidence is strongest on the mechanism and weakest on Equal's private infrastructure.**

| Conclusion | Confidence / evidence boundary |
|---|---|
| Equal uses carrier call forwarding | Confirmed by its own help |
| The reported three setup actions enabled the three conditional rules | High-confidence inference; actual dial strings unavailable |
| Equal needs a reachable network ingress | Required by the forwarding mechanism |
| Equal rents a unique virtual number per user | Unknown |
| Equal's telephony vendor is Plivo, Telnyx, Exotel, or another named company | Unknown; no attribution established |
| The same broad experience is possible in India, Canada, and the US | Strong primary documentation; each commercial plan still needs testing |
| Clinket can reuse its AI/MCP stack | Supported by inspected local routing and prompt code |
| Clinket already supports this end to end | No; existing-number UI is disabled and runtime/fallback work remains |
| Every user can complete setup through exactly three taps/calls | Not established; carrier, OS, voicemail, and India provisioning can add steps |
| Universal pickup within one second | Not established; requires defined measurements and live testing |

**Recommendation: proceed with an existing-number forwarding option alongside the current dedicated-number product.** Start with a dedicated answering destination and direct AI ingress, settle the India provisioning model early, and retain the existing business-context and MCP authorization machinery. The customer-facing promise can be simple: keep the business number, answer normally, and let Clinket handle eligible missed calls. Carrier-specific onboarding, safe fallback, and correct cancellation are the engineering work that makes that promise reliable.

**Sources and evidence inventory.** All web sources below were accessed September 14, 2026. Undated pages are identified by publisher and title rather than an inferred publication date. Local source links above refer to the inspected working trees; they are implementation evidence, not deployment verification.

1. Equal AI. [Assistant Setup](https://myequal.ai/assistant-setup/). Carrier forwarding and persistence after account deletion.
2. Equal AI. [My Account](https://myequal.ai/my-account/). Support claims and deactivation guidance; iOS statement demonstrably stale.
3. Equal Identity / Google Play. [Equal AI – Call Assistant](https://play.google.com/store/apps/details?id=in.equal.ai.assistant). Listing updated September 9, 2026.
4. Equal Identity / Apple App Store India. [Equal AI Assistant](https://apps.apple.com/in/app/equal-ai-assistant/id6757906431). iPhone availability, requirements and release notes.
5. Equal AI. [Assistant Customization](https://myequal.ai/how-equal-ai-works/). Customization and older language-support claims.
6. Equal AI. [Home page](https://myequal.ai/). Product positioning and current language marketing.
7. Prosus. [Equal AI secures US$30m Series B funding](https://www.prosus.com/news-insights/2026/equal-ai-secures-us-dollar-30m-series-by-prosus-ventures-and-tomales-bay-capital-to-scale-indias-ai-assistant). 2026 announcement; company background, funding structure and reported usage.
8. Equal AI. [Privacy Policy](https://myequal.ai/privacy-policy/). Effective June 2026; disclosed AI processors and personalization.
9. Vi. [How to Use Call Forwarding Code to Activate and Deactivate Call Forwarding](https://www.myvi.in/blog/how-to-activate-and-deactivate-call-forwarding-code-on-vi). Conditional commands and status queries.
10. Google Voice Help. [Send your mobile phone calls to Google Voice voicemail](https://support.google.com/voice/answer/165656?hl=en). Primary integration guidance for AT&T/Verizon conditional forwarding.
11. Plivo. [Connect External Phone Numbers to Plivo](https://www.plivo.com/docs/voice/use-cases/connect-external-numbers). DID-forwarding and direct-SIP architectures.
12. Plivo. [Voice callbacks](https://www.plivo.com/docs/voice/concepts/callbacks). Answer URL and fallback URL behavior.
13. Jio. [How can I activate call forwarding service?](https://www.jio.com/help/faq/mobile/services/hd-voice/how-can-i-activate-call-forwarding-service/). Current mobile setup and destination restrictions.
14. Plivo. [Voice XML overview](https://www.plivo.com/docs/voice/xml/overview). Incoming identifiers and carrier-dependent `ForwardedFrom`.
15. RFC Editor. [RFC 5806: Diversion Indication in SIP](https://www.rfc-editor.org/info/rfc5806/). March 2010. Protocol reference; not a carrier delivery guarantee.
16. Airtel. [What Is Call Forwarding in Airtel?](https://www.airtel.in/blog/airtel-app/call-forwarding-in-airtel/). Published April 2024; page shows a May 2026 update.
17. Rogers. [Use Call Forwarding](https://www.rogers.com/support/mobility/use-call-forwarding). Mobile codes and voicemail prerequisite.
18. Bell Mobility. [How to use Call Forwarding on my mobile phone](https://support.bell.ca/mobility/rate_plans_features/how_to_use_call_forwarding_on_my_mobile_phone?step=2,2). No Answer Transfer and charges.
19. TELUS. [Smart Hub user guide](https://resources-business.telus.com/cms/files/files/000/000/500/original/smart_hub_user_guide.pdf). Product-specific supplementary services; insufficient for blanket retail-mobile certification.
20. T-Mobile. [Self-service & short codes](https://www.t-mobile.com/support/plans-features/self-service-short-codes). Conditional rules and timer examples.
21. Verizon. [Call Forwarding FAQs](https://www.verizon.com/support/call-forwarding-faqs/). Unanswered-forwarding activation and restrictions.
22. Jio. [Can I activate Call Forwarding on my JioFiberVoice number?](https://www.jio.com/help/faq/jiofiber/services/jiofibervoice/can-i-activate-call-forwarding-facility-on-my-jiofibervoice-number/). Fiber-specific codes; not used as mobile instructions.
23. Android Developers. [Telecom framework overview](https://developer.android.com/develop/connectivity/telecom). Call screening versus other telephony responsibilities.
24. Apple Developer. [Phone Links](https://developer.apple.com/library/archive/featuredarticles/iPhoneURLScheme_Reference/PhoneLinks/PhoneLinks.html). Archived specification, updated September 2017; current-device validation still required.
25. Apple Support. [Set up call forwarding on iPhone](https://support.apple.com/en-lamr/guide/iphone/iph7405291c4/ios). Conditional setup delegated to carrier.
26. Apple Support Canada. [Set up Voicemail on iPhone](https://support.apple.com/en-ca/guide/iphone/iph3c99490e/ios). Live versus carrier voicemail behavior.
27. Plivo. [India Number KYC](https://www.plivo.com/docs/numbers/rent-india-numbers). Current India-region and direct-brand/reseller provisioning documentation.
28. Plivo. [India Phone Number Pricing](https://www.plivo.com/phone-numbers/pricing/in/). Domestic SIP number list rental; not a negotiated Voice API quote.
