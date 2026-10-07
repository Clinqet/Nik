# Master Prompt — Outbound Campaign / Callback Solution Design for Tinket

## Mandatory extension — one or several people without a campaign (2026-10-04)

**MUST READ `C:\Nik\Data\outbound-calls\QUICK-CALLS.md` IN FULL. THE OWNER REQUIRES ONE SHARED “CALL WITH AI” FLOW FOR ONE PERSON OR A SMALL SELECTED GROUP, NOW OR SCHEDULED, WITHOUT A VISIBLE OR HIDDEN CAMPAIGN. THIS IS PART OF THE APPROVED MOCKUP AND CURRENT SOLUTION, NOT A FUTURE OPTIONAL FEATURE. IMPLEMENT C25 AND Q01–Q16 WITH REAL PER-PERSON ELIGIBILITY, TIME REVIEW, IDEMPOTENCY, PARTIAL/UNCERTAIN-SAVE RECOVERY, RESULTS/HISTORY AND CANCELLATION. REUSE THE SAME ENGINE AND SHARED WEB/NATIVE COMPONENTS; DO NOT CREATE A GROUP MODEL OR ANOTHER ENGINE WITHOUT A JUSTIFIED CURRENT NEED.**

**PHASES 1–5 MUST RECORD THIS EXTENSION'S VERIFIED PROGRESS AND NEXT OWNER IN THEIR BUILD STATE AND NEXT COPY-PASTE HANDOFF WITHOUT A REMINDER. PHASE 6 AUDITS IT END TO END AND HAS NO SUCCESSOR. EXISTING FULL MOCKUP APPROVAL, COMPONENT REUSE, CREATIVE FREEDOM WITHOUT ROUTINE REAPPROVAL, STARTUP SIMPLICITY, SECURITY/COST/PERFORMANCE/DATA QUALITY AND NO-UI-STUB REQUIREMENTS APPLY. OPEN THE STUDIO'S CALLS & CALLBACKS → CALL WITH AI STATES; REUSE `Mockup/quick-calls.js` AND `quick-calls.css` AS DESIGN/INTERACTION REFERENCES THROUGH THE REAL APP COMPONENTS.**

## Mandatory two-way coverage, preview and reuse — final audit 4.1

**MUST READ AND FOLLOW `C:\Nik\Data\outbound-calls\Mockup\COVERAGE-AUDIT.md` IN FULL. CHECK BOTH DIRECTIONS: EVERY PROJECT REQUIREMENT MUST HAVE ITS INTERFACE/BEHAVIOR AND TEST; EVERY MOCKUP CAPABILITY MUST HAVE A PLAN REQUIREMENT, REAL CONTRACT, NAMED IMPLEMENTATION PHASE AND ACCEPTANCE TEST. THE MOCKUP IS FULLY OWNER-APPROVED, INCLUDING ITS REUSABLE COMPONENTS. NO FURTHER MOCKUP APPROVAL IS REQUIRED. DO NOT LOSE A MOCKUP FEATURE BECAUSE AN EARLIER PHASE DESCRIPTION WAS LESS DETAILED.**

**HOW TO VISUALIZE: OPEN `C:\Nik\Data\outbound-calls\Mockup\index.html` IN EDGE OR CHROME (POWERSHELL: `Start-Process 'C:\Nik\Data\outbound-calls\Mockup\index.html'`). NO INSTALL, BUILD OR SERVER IS NEEDED. INSPECT EVERY RELEVANT SCREEN/STATE, BOTH PRODUCT MENUS, ROLES, PHONE/TABLET/DESKTOP SIZES, WEB/NATIVE MODE AND SUPPORTED THEMES. USE OPEN FULL SCREEN AND ACTUALLY EXERCISE THE FLOWS; DO NOT REVIEW SCREENSHOTS ALONE.**

**HOW TO REUSE THE CODE: READ `C:\Nik\Data\outbound-calls\Mockup\COMPONENTS.md`. REUSE THE APPROVED TOKENS, ASSETS, CONTROL STRUCTURE, INTERACTION/RETURN PATTERNS AND RESPONSIVE LAYOUTS FROM `controls.js`, `controls.css`, `ui.js`, `styles.css`, `navigation.js`, `builder-tools.js`, `audience-ui.js`, `record-ui.js`, `campaign.js` AND `call-results.js` WHERE THEY FIT. START WITH THE VERIFIED REACT/NATIVE SHARED COMPONENTS MAPPED THERE. ADAPT THEM TO REAL STATE, LOCALIZATION, AUTHORIZATION AND APIs. NEVER COPY SYNTHETIC DATA, SIMULATED AI/CALLS/MESSAGES, GLOBAL DOM WIRING OR A TOAST AS A PRODUCTION INTEGRATION.**

**DATA QUALITY IS MANDATORY ALONGSIDE SECURITY, COST, PERFORMANCE AND FUNCTIONALITY: USE STABLE BUSINESS/RECORD/NUMBER IDENTITIES, E.164 NORMALIZATION, EXPLICIT TIME ZONES AND EVIDENCE PROVENANCE, FROZEN AUDIENCE/BRIEF VERSIONS, TYPED ANSWERS AND DISTINCT UNKNOWN/REFUSED/UNCONFIRMED STATES. COUNTS, CHARTS, HISTORY, FILTERED LISTS AND EXPORTS MUST AGREE. MUTATIONS MUST RENDER THE AUTHORITATIVE SAVED RESULT AND HANDLE CONCURRENCY/REPLAY. NEVER TREAT MISSING AS ZERO, NO, CONSENT OR SUCCESS. KEEP NECESSARY DATA WITHOUT SPECULATIVE FIELDS OR DUPLICATE SOURCES OF TRUTH.**

**APPLY CREATIVE JUDGMENT TO THE COMPLETE FUNCTIONALITY. DECIDE WHETHER EACH DETAIL MAKES SENSE IN THE REAL SYSTEM; REUSE, SIMPLIFY OR IMPROVE IT UNDER AUT-1 WITHOUT ROUTINE OWNER APPROVAL, INCLUDING JUSTIFIED NECESSARY SCHEMA/CONTAINER/ARCHITECTURE CHANGES. DO NOT OVERCOMPLICATE OR SILENTLY DROP A REQUIRED USER OUTCOME. RECORD THE RATIONALE AND UPDATE THE PLAN, COVERAGE REGISTER AND AFFECTED PROMPTS. ASK ONLY FOR A GENUINELY UNRESOLVED OR OWNER-DEPENDENT DECISION AFTER PRESENTING OPTIONS AND A RECOMMENDATION. EVERY EXPOSED CAPABILITY MUST WORK END TO END—NO UI STUBS.**


## Mandatory owner direction — final review and delegation, 2026-10-03

**MUST READ AND FOLLOW: `C:\Nik\Data\outbound-calls\IMPLEMENTATION-CHARTER.md` IN FULL, THEN `C:\Nik\Data\outbound-calls\PLAN.md` AND THIS ENTIRE PROMPT. THE CHARTER RECORDS THE OWNER'S LATEST PROJECT-SPECIFIC INSTRUCTIONS AND TAKES PRECEDENCE OVER EARLIER CONTRARY APPROVAL WORDING, INCLUDING COPIED STANDARDS, SKILLS AND MEMORIES.**

**THE ENTIRE MOCKUP IS FULLY OWNER-APPROVED AS A STARTING POINT AND REFERENCE. YOU HAVE CREATIVE FREEDOM TO IMPROVE UI, FUNCTIONALITY, NECESSARY FEATURES, SOLUTION DESIGN, ARCHITECTURE, CONTRACTS AND NECESSARY SCHEMA—INCLUDING SQL/COSMOS FIELDS, INDEXES AND CONTAINER CHOICE—WITHOUT ROUTINE OWNER APPROVAL OR A NEW MOCKUP. DO NOT OVERCOMPLICATE: USE THE SIMPLEST CORRECT SOLUTION THAT BALANCES COST, SECURITY, PERFORMANCE, FUNCTIONALITY AND LOW-FRICTION PROVIDER/CUSTOMER USE. DO NOT ADD DATA WITHOUT A CURRENT NEED; REUSE EXISTING ADMIN ALERTS WHERE SUFFICIENT AND ALLOW LEGITIMATE REPEAT FEEDBACK. JUSTIFY COSMOS PLACEMENT AND REAL RU/THROUGHPUT COST. RESEARCH CONSENT OPTIONS AND OTHER UNSTABLE/LEGAL FACTS WITH CURRENT OFFICIAL SOURCES; DO NOT ASSUME AUTOMATIC CONSENT OR A LIABILITY DISCLAIMER MAKES CALLS LAWFUL. ASK ONLY FOR A GENUINELY UNRESOLVED/TRICKY OR OWNER-DEPENDENT DECISION, AFTER COMPARING OPTIONS AND GIVING YOUR RECOMMENDATION.**

**NO UI STUBS OR INCOMPLETE WIRING: EVERY EXPOSED CAPABILITY MUST HAVE REAL WORKING INTEGRATION, PERSISTENCE WHERE NEEDED, AUTHORITATIVE RESULTS, VALIDATION AND FAILURE/PERMISSION/LIMIT HANDLING. MATCH THE ACTUAL SHARED DROPDOWNS, CHECKBOXES, TEXT FIELDS AND ALL CONTROL STATES. KEEP THE UI MODERN, FUTURISTIC, BRANDED, PLAIN-SPOKEN, EASY TO NAVIGATE, SPACE-EFFICIENT AND RESPONSIVE ACROSS DESKTOP, TABLET, PHONE WEB AND NATIVE APPS. USE NATIVE STRENGTHS WITH VISIBLE ALTERNATIVES; KEEP SUMMARIES AND HISTORY CLOSE.**

**FULL MOCKUP APPROVAL AND COMPONENT REUSE: THE ENTIRE MOCKUP IS FULLY OWNER-APPROVED—SCREENS, COMPONENT DESIGNS, STATES, NAVIGATION AND INTERACTIONS. NO FURTHER DESIGN APPROVAL IS REQUIRED. READ `C:\Nik\Data\outbound-calls\Mockup\COMPONENTS.md` IN FULL AND REUSE ITS COMPONENT SOURCE/PATTERNS, TOKENS AND EXISTING-APP COMPONENT MAP. DROPDOWNS, TEXT BOXES, CHECKBOXES AND ALL OTHER CONTROLS MUST FOLLOW THE APPROVED THEME, DESIGN, COLORS, LUFGA FONT AND BEHAVIOR. START WITH THE APP'S REAL SHARED COMPONENTS, REUSE OR IMPROVE THEM, AND BIND REAL FUNCTIONALITY. THE BROWSER MOCKUP'S SYNTHETIC STATE IS NOT A PRODUCTION INTEGRATION. YOU HAVE CREATIVE FREEDOM TO IMPROVE ANY UI OR COMPONENT FOR CLARITY, RESPONSIVENESS, EASY NAVIGATION AND A BETTER PROVIDER/CUSTOMER EXPERIENCE WITHOUT ASKING FOR APPROVAL OR CREATING ANOTHER MOCKUP.**

**ONE PHASE = ONE SESSION. AFTER A PHASE IS TRULY COMPLETE, WITHOUT WAITING FOR ANOTHER REQUEST OR REMINDER, GIVE THE OWNER A COPY-PASTE NEXT-PHASE PROMPT IN THE FINAL CHAT AND THE MATCHING HANDOFF FILE: EXACT NEXT PROMPT PATH, BASIC PURPOSE, VERIFIED BUILD-STATE CONTEXT, CHARTER/PLAN PATHS AND RELEVANT GOTCHAS. DO NOT START THE NEXT PHASE AUTOMATICALLY. THE LAST PHASE HAS NO NEXT-PHASE HANDOFF.**


## Complete functionality and campaign interaction requirements — owner direction, 2026-10-03

**IMPLEMENT ALL CAPABILITIES ASSIGNED TO THIS DEVELOPMENT PHASE WITH COMPLETE, WORKING INTEGRATION. DO NOT BUILD OR WIRE AN ACTION THAT HAS NO FUNCTIONALITY. NEVER SHIP OR MARK COMPLETE A STUB, PLACEHOLDER BUTTON, UNCONNECTED SCREEN, FAKE DATA PATH OR TOAST-ONLY SUCCESS. EVERY EXPOSED CONTROL MUST PERFORM ITS REAL OPERATION, PERSIST THE RESULT WHERE REQUIRED, UPDATE FROM THE AUTHORITATIVE RESPONSE, AND HANDLE VALIDATION, LOADING, FAILURE, PERMISSION AND LIMIT STATES. IF A DEPENDENCY IS MISSING, RESOLVE IT IN ITS RESPONSIBLE PHASE AND REPORT THE BLOCKER; DO NOT PRETEND THE FEATURE WORKS.** The isolated mockup's simulations are reference behavior only and must not be copied into integrated production code as functioning features. Phase 4 reconciles the approved reference to the backend and implements provider web/mobile in the same session; actual integration must be proved.

**FOLLOW THE OWNER'S CAMPAIGN INTERACTION REQUIREMENTS: SUPPORTING TASKS MUST RETURN TO THE SAME CAMPAIGN AND STEP WITH THE DRAFT INTACT; ACTUAL EXIT MUST OFFER KEEP EDITING, DISCARD CHANGES OR SAVE DRAFT & LEAVE. SAVED BRIEFS AND DRAFTING NEED CLEAR PURPOSE, REVIEW AND APPLY FLOWS. CONVERSATION SECTIONS MUST BE CLEAR AND RESPONSIVE. HANDOUTS MUST SUPPORT ADD, ACTUAL PREVIEW, APPROVAL, EDIT/COPY AND REMOVAL INSIDE THE BUILDER; A HANDOUT USED BY ANOTHER CAMPAIGN MUST NOT BE DELETED OR OVERWRITTEN. VOICES, LANGUAGES, SAMPLES AND SPEAKING-STYLE GUIDANCE MUST FOLLOW THE ACTUAL AI ASSISTANT SETTINGS. EXPLAIN PER-PERSON LOCAL CALLING HOURS, THEIR SOURCE AND UNKNOWN-ZONE HOLDS. ALL CHOICES MUST PERSIST AND APPEAR ACCURATELY IN REVIEW.** Apply each requirement within this phase's assigned responsibility; preserve the approved business rules and the latest charter’s decision boundaries. Do not guess production routes, contracts, schemas or settings.

**LATEST OWNER UX DIRECTION — INLINE FIRST, BOUNDED AUDIENCES, RELEVANT LOCAL WORDING (2026-10-03): KEEP SMALL CHOICES DIRECTLY IN THE PAGE WHEN THEY FIT; THE THREE ASSISTANT-INFORMATION CHECKBOXES BELONG IN CONVERSATION, WITHOUT AN EXTRA PICKER OR SAVE-SELECTION CLICK. ROOT DIALOGS CLOSE WITH ONE CLEAR ACCESSIBLE CLOSE CONTROL; RETAIN BACK FOR A REAL NESTED RETURN AND RETAIN UNSAVED-CHANGE PROTECTION. CALLING HOURS SHOW AUDIENCE COUNTS FIRST, THEN AN INLINE SEARCHABLE, FILTERED, PAGED LIST WITH A BOUNDED NUMBER OF ROWS—NEVER ALL 500 OR 5,000 PEOPLE AT ONCE. PEOPLE AND PERMISSION REVIEW MUST ALSO REMAIN BOUNDED AND PRESERVE SELECTIONS. PERSONALIZE EXPLANATORY COPY USING THE ACTUAL SELECTED CONTACTS’ DESTINATION COUNTRY AND TIME-ZONE BASIS, NOT UI LANGUAGE, A GUESSED COUNTRY FROM +1, OR ONLY THE PROVIDER’S COUNTRY. A DOMESTIC AUDIENCE MUST NOT SEE UNRELATED COUNTRY NAMES; MIXED AUDIENCES USE NEUTRAL PRIMARY COPY AND RELEVANT PER-DESTINATION DETAIL. UNKNOWN LOCATION STAYS HELD. KEEP SOURCE, HOLDS, COUNTS, ESTIMATES, SAVED DRAFT AND FINAL REVIEW CONSISTENT; KNOWN HOURS NEVER IMPLY CALLING PERMISSION.** Use real bounded queries and authoritative rules during implementation; mockup examples are not integrations. Preserve PLAN’s calling, consent and billing rules and the charter’s decision boundaries. These refinements are within the owner-approved UI freedom; no renewed UI approval or new mockup is needed.

Read `C:\Nik\Data\outbound-calls\Mockup\INTERACTION-REVIEW.md` fully. Its screen-by-screen review and operation/return-path acceptance requirements supplement the approved mockup and PLAN. Include the actual control-to-operation bindings and end-to-end success/failure/permission evidence in the phase handoff. UI improvement freedom and existing owner approval remain unchanged; no new mockup or renewed UI approval is required.


## Owner approval and UI creative freedom — 2026-10-02

**THE OWNER HAS APPROVED THE OUTBOUND AI CALLS MOCKUP AND THE REFINEMENTS MADE DURING THE FULL PROJECT REVIEW. `C:\Nik\Data\outbound-calls\Mockup\index.html` IS AN APPROVED STARTING POINT AND REFERENCE, NOT A RIGID PIXEL BLUEPRINT.** The owner said: “I'm approving all of it” and asked that implementing sessions be given creative freedom.

**EVERY SESSION IMPLEMENTING THESE PHASES MAY IMPROVE THIS FEATURE'S UI WITHOUT ASKING FOR ANOTHER OWNER APPROVAL AND WITHOUT CREATING ANOTHER MOCKUP FILE.** Exercise that freedom to make the interface **modern, futuristic and attractive; consistent with Clinket's real product branding, colours and Lufga font; easy to understand and navigate; clean and nontechnical in its language; complete against the requirements and every reachable state; fully responsive on desktop, mobile web and iPad/tablet; equally complete in the native mobile apps; and efficient in its use of space without dead areas, overcrowding or broken layouts. Harness native capabilities such as long press, swipe, bottom sheets, appropriate haptics, refresh, safe areas, accessibility and deep links, with visible alternatives to gestures. Critical information—including summaries, call history, recordings and next steps—must be directly accessible and must not require five or six pages of navigation.** Re-read the actual Business and AI Assistant dashboards and their web/native navigation before integrating. Improve navigation, hierarchy, density and interaction where useful while preserving requirements, rendering rules and web/mobile parity. Record the rationale and verification in the phase handoff; do not turn that record into another approval gate. A file-by-file UI plan is documentation, not another permission step: do not pause to approve UI layout, wording that preserves its meaning, density, navigation or interaction improvements.

**THIS IS AN EXPLICIT, PROJECT-SPECIFIC EXCEPTION TO THE RE-APPROVAL AND NEW-MOCKUP GATES FOR UI IMPROVEMENTS IN OUTBOUND AI CALLS, INCLUDING AN IMPROVED SCREEN OR STATE NEEDED TO MEET THE EXISTING REQUIREMENTS. DO NOT ASK THE OWNER AGAIN FOR THIS UI FREEDOM.** It supersedes contrary generic mockup rules, the earlier deferral and any narrower wording later in this prompt or its verbatim historical standards. The owner also explicitly chose the project-local `Mockup` folder; retain that location and its PLAN §0.4 register.

The original 2026-10-02 ruling approved the design. **The owner's later AUT-1 delegation broadens implementation freedom as set out in IMPLEMENTATION-CHARTER.md; earlier routine plan/schema reapproval waits are superseded.** No development phase is completed by a design approval. Legal eligibility, security, real integration, full localization and native-device verification remain implementation obligations. Do not invent a per-item approval or treat the delegation as permission for unrequested live deployment/calls.


> **Current use — 2026-10-03:** This file preserves the original design brief and its historical workflow below. The design and entire mockup are now approved. Start implementation with `phases/HANDOFF-TO-PHASE-1.md`; follow the mandatory charter, PLAN and the assigned phase prompt. The current schedule is five implementation phases plus Phase 6's multidimensional audit. Historical "design only", "wait for approval" and mockup-creation instructions below describe the earlier design session; they must not restart that session or override AUT-1. Product requirements and coding, testing, security and quality standards remain applicable.

> **Original target agent:** Claude Fable  
> **Primary purpose:** Solution architecture, business analysis, product design, cloud/infrastructure/security design, and end-to-end brainstorming for the new outbound campaign / callback capability.  
> **Current stage:** Solutioning and design only. **Do not implement the feature yet.**  
> **Priority:** **QUALITY OVER SPEED.**

---

## 0. Non-Negotiable Preservation and Interpretation Rules

This prompt consolidates and restructures the full project description so it is easier to understand and execute. Treat every requirement, constraint, example, edge case, workflow rule, reference path, coding standard, audit rule, UX rule, billing consideration, and future-phase instruction in this file as intentional.


### MANDATORY PRE-READ — COMPLETE READING BEFORE ANY SOLUTIONING

Before you analyze, brainstorm, recommend, design, or implement anything, you **MUST complete the following reading sequence in full**. This is a hard prerequisite, not a suggestion.

1. **Read this entire master prompt file from the first line to the final line**, including every section, every rule, every example, all coding standards, all workflow/audit rules, and **Appendix A (the verbatim original source)**.
2. **Read the previous-agent solution file in its entirety, from beginning to end:**

   ```text
   C:\Nik\Data\outbound-calls\SOLUTION.md
   ```

3. **Read the previous-agent deep-research file in its entirety, from beginning to end:**

   ```text
   C:\Nik\Data\outbound-calls\deep-research-report.md
   ```

4. **Read and understand the relevant codebase thoroughly**, as required elsewhere in this prompt, before making code-specific claims or finalizing the architecture.

**Full-read requirement:** Do not substitute summaries, snippets, search hits, partial reads, headings-only review, or selective reading for the complete documents. If a file is too large to consume in one operation or one context window, read it sequentially in chunks until the entire file has been consumed. Do not claim to have read a file unless you actually reached the end of it.

**No premature solutioning:** Do not begin presenting architectural recommendations until the complete reading sequence above has been completed. You may take internal notes while reading, but the solution must be based on the complete material, not an early portion of it.

**Accessibility failure rule:** If any required file/path cannot be accessed, do not silently skip it and do not pretend it was read. Tell the user exactly which file is inaccessible and request the correct/accessible path or file before treating the architecture as final.

**Authority rule:** The two previous-agent files are mandatory reading, but they remain **reference material only**. They did not have full codebase access. They may contain useful brainstorming or prior interactive decisions, but they must be validated against this master prompt, the verbatim original source, the actual codebase, official documentation/research, and the user's confirmations.

After completing the required reading, explicitly confirm which required files were read completely before moving into the solution-design discussion.

### Absolute rules

1. **Do not omit, weaken, reinterpret, or silently replace any requirement in this file.**
2. **Do not assume missing facts.** If something materially affects the architecture or solution and is not verified from the codebase, provided files, official documentation, or the user, ask the user.
3. **Do not treat the examples in this prompt as an exhaustive list.** They are examples that establish the expected depth. You must independently identify additional relevant cases.
4. **Do not fixate on prior agents' recommendations.** Their outputs are supporting material only.
5. **Read the actual codebase thoroughly before making code-specific claims or finalizing architecture that depends on existing implementation.**
6. **Use web research, official documentation, competitor research, and best-practice research where appropriate.**
7. **This is an interactive solution-design process.** Present recommendations, explain trade-offs, ask for clarification where needed, and wait for user confirmation before the solution becomes final.
8. **Do not begin implementation merely because you have a plausible design.** Implementation, mockups, phase files, and development prompts come after the solution is reviewed and approved.
9. If a project term, provider name, or product name appears inconsistent with what you find in the codebase, **do not silently normalize it**. Verify the canonical value from the code or ask the user.

---

# 1. Your Role

Act as the user's:

- Expert **Solution Architect**
- Expert **Cloud Infrastructure Architect**
- Expert **Security Architect**
- **Business Analyst**
- **Project Manager**
- Architecture-focused software expert capable of understanding the existing code deeply

Your responsibility in this session is **not to develop the feature**. Your responsibility is to:

- fully understand the current system;
- thoroughly inspect the relevant code;
- research the outbound-calling problem;
- brainstorm the full solution;
- identify every important edge case;
- evaluate architecture, data, infrastructure, billing, UX, security, scale, performance, and cost;
- present options with pros/cons;
- recommend the best approach;
- interact with the user until the design is confirmed;
- only after user approval, move into the documentation/mockup/phasing workflow described later in this prompt.

The future implementation sessions should ultimately be able to follow the approved design with very little ambiguity, while still retaining the responsibility to flag anything that appears unsafe, incorrect, non-best-practice, inconsistent, or unclear.

---

# 2. Existing Product Context

We have the following major product areas:

## 2.1 Tinket Marketplace Web

The web product is technically a marketplace.

Providers can publish their services into the marketplace.

## 2.2 Tinket Business App

The business app should be thought of as a business tool that helps any/all kinds of businesses run their business and software workflows.

The Tinket AI assistant functionality is built on top of this business app.

Provider services from the business app are automatically published into the marketplace.

## 2.3 Tinket Ask

Tinket Ask is the search experience and one of the two powerful/core capabilities at the heart of the platform.

Tinket Ask uses a combination of:

- MCP APIs;
- the AI Function App;
- Cosmos;
- AI Search;
- the surrounding platform/code.

It reads the relevant information and displays results in the chatbot.

Users can communicate through voice and related chatbot functionality.

The current functionality is considered solid and working well.

## 2.4 AI Assistant

The AI assistant is the second powerful/core platform capability.

It is used when a caller calls a provider.

The assistant supports multiple modes:

### Mode 1 — Missed Call

If the provider does not pick up, the AI takes over the call.

### Mode 2 — Summarization

The AI never talks.

It summarizes every discussion/conversation.

### Mode 3 — After Hours

After the business's operating hours, if the provider does not pick up, the AI takes over.

### Mode 4 — AI Always Talks

Any call to that number is handled by the AI; the AI always talks.

## 2.5 Provider Number Porting / Call Forwarding

Providers can port their number to us.

The current functionality/instruction is straightforward.

The platform utilizes call forwarding so that when someone calls the provider's number, the call is forwarded to the AI assistant, and the AI can take over if the provider does not pick up.

This existing functionality is considered solid and working well.

---

# 3. Provider Diversity / Generalized Business Model

The platform is deliberately generalized.

It must work across effectively any type of provider/business, including, but not limited to:

- lawyer;
- salon;
- electrician;
- carpenter;
- landscaping/fence provider;
- handyman;
- doctor;
- insurance company;
- finance company;
- biomedical company;
- and any other provider/business category.

The outbound solution must therefore avoid being designed only for one industry or one narrow workflow.

---

# 4. Existing AI Knowledge Capability

Behind the AI assistant is a provider-specific knowledge base.

Providers can upload documents.

The system accepts document types such as:

- PDF;
- PowerPoint;
- Word;
- and effectively every supported document type.

The platform converts the documents into searchable parts/chunks, stores/indexes them in AI Search / an AI index, and allows the AI assistant to use that searchable knowledge.

The assistant uses the **GPT Real Time 2.0 model** together with AI Search and tool calls to answer callers about the provider/business.

The provider can be any type of business.

This existing knowledge functionality is considered to be working well.

---

# 5. New Capability to Design: Campaign Callback / Outbound Calling

We now need to build a **brand-new campaign callback / outbound calling capability**.

Think of this as the platform calling a customer back and serving whatever the callback needs to accomplish.

The objective is to design this capability in the best possible way for:

- current needs;
- future flexibility;
- scale;
- billing flexibility;
- performance;
- cost;
- security;
- provider experience;
- customer/callee experience;
- analytics;
- campaign use cases;
- individual one-off outbound calls;
- future expansion.

This is a greenfield capability.

---

# 6. Current Development Stage and Freedom

The product is **not in production yet**.

We are currently in:

- sandbox;
- UAT;
- dev.

We therefore have full flexibility.

We do not need to worry about backfill or preserving bad legacy structures.

At the moment described in the original project context, all sandbox environments had been deleted and a new sandbox was expected to be created in approximately two days.

If the architecturally correct approach requires deleting the environment and recreating it from scratch, that is acceptable.

The goal is to get the architecture right before production.

---

# 7. Existing Subscription / Minutes Model

The outbound capability needs to be considered together with the existing billing/subscription concept.

The provider can purchase a subscription that currently includes:

- **500 minutes of Standard tier**, or
- **500 minutes of Advanced tier**.

There is no functional difference between Standard and Advanced except that:

- **Advanced uses the higher model: ChatGPT Real Time 2.0.**

Once the included 500 minutes are consumed, the provider can top up with additional minutes and pay for however many additional minutes they want.

The outbound-call design needs to consider how to integrate with and/or extend this billing model.

The original spoken description also used the phrase **"tie to the booking"** while immediately explaining the subscription/minutes model. Because that wording may be a speech-to-text ambiguity between *booking* and *billing*, do **not** silently reinterpret it. Inspect the code/domain model and confirm with the user if the distinction materially affects the solution.

---

# 8. Billing Design Requirement for Outbound Calls

The outbound system must be designed so billing is **extremely flexible**.

Explore models such as, but not limited to:

- billing by campaign;
- billing by outbound minute;
- campaign purchases;
- outbound-minute purchases;
- subscription inclusion;
- top-ups;
- other appropriate charging models.

Do not assume the listed examples are the final model.

The solution should give us flexibility to maneuver commercially once the product is large and in production.

At the same time, the provider should be offered diverse and understandable ways to buy/use outbound capabilities.

The current strategic goal is to **encourage adoption and usage of this capability**, including encouraging providers to try it.

Research and recommend how the product/billing experience can support that goal without creating a bad long-term architecture.

---

# 9. Main Product Goal

There are two primary experience objectives.

## 9.1 Provider Experience

Provide the best possible experience to providers by helping them reduce work and effort through automation of outbound calls.

## 9.2 Customer / Callee Experience

For the provider's customer who receives the outbound call, the AI-assisted call experience should be faster, better, clearer, more adaptive, and ideally better than a normal human interaction for the intended task.

The outbound assistant must be able to:

- adapt during the conversation;
- understand the campaign/call objective;
- stay aligned to a clear goal;
- greet appropriately;
- deliver information appropriately;
- collect information where required;
- summarize appropriately;
- end the call properly;
- respect a defined time frame;
- handle interruptions, failures, hang-ups, and other edge cases correctly.

---

# 10. Core Use Cases to Support

The design must support at least both of the following:

## 10.1 Campaign Outbound Calls

A provider can create an outbound campaign.

Possible flow envisioned by the user:

- create a campaign;
- add provider contacts to the campaign;
- define the call goal/objective;
- provide standard instructions for the AI;
- optionally attach/reference documents;
- define what information should be delivered;
- define what information should be collected;
- run the campaign;
- apply configured retry/outcome logic;
- capture results;
- provide analytics.

This is early brainstorming, **not a predetermined final design**.

You must determine what the best architecture and UX should actually be.

## 10.2 One-Off Outbound Call

The provider may want to make a single outbound call to one customer/contact instead of creating a normal campaign.

One possible UX idea is:

- from the customer/contact page;
- use a three-dot/context action (the original brainstorm also described clicking/right-clicking this action);
- choose something like "Set outbound call";
- provide instructions, goal/objective, and optional documents;
- initiate/schedule the call.

One possible implementation idea is to create a campaign automatically with exactly one contact.

That is only an idea.

You must determine whether that is the correct conceptual/data model or whether another approach is better.

---

# 11. Existing Contact / Activity Context

The business app currently has a contact capability.

The original description also states: **"we provide a contact booking code."** Preserve and investigate that existing concept in the codebase rather than ignoring it or guessing what it means.

It is not very detailed.

The contact currently contains basic data such as:

- first name;
- last name;
- address;
- email;
- similar/basic contact fields.

The product does **not** currently have an activity feature in the sense intended for this outbound workflow.

There is a page called **Activity**, but that can be misleading because it is essentially an **audit** of what is happening.

Do not incorrectly treat the existing Activity page as an outbound/campaign CRM-style activity system.

An actual activity capability could be added if that is architecturally appropriate.

---

# 12. Campaign Instructions, Goals, and Conversation Control

A campaign/call should be able to receive clear instructions similar in concept to how the AI assistant/search currently receives standard instructions.

The provider should be able to define:

- what the AI needs to discuss;
- what the objective is;
- what it should try to achieve;
- what it must achieve;
- what information it should deliver;
- what information it should collect;
- what documents or supporting material may be used;
- how the conversation should be conducted.

The solution must determine the right product model for these instructions and objectives.

The assistant must have a clear objective and goal during the call.

The design should address:

- greeting behavior;
- how the caller/AI identifies or introduces itself;
- how information is delivered;
- how to handle questions;
- how to use provider knowledge;
- how to keep the conversation on objective;
- how to summarize;
- how to end the call;
- time-frame/maximum-call considerations;
- what happens when the callee hangs up;
- what happens when the call partially completes;
- what qualifies as success/failure/unknown/no-answer/etc.;
- whether/when another attempt is made.

---

# 13. Information Collection and Response Storage

Some outbound calls will be used to collect information or feedback from the customer.

We need a place to capture responses/results.

Possible technologies mentioned for consideration include:

- a new Cosmos document;
- Blob Storage;
- another storage option.

**Do not assume one of these is correct.**

Evaluate the most cost-friendly and performance-friendly architecture.

The stored result should support provider review and the ability to derive useful analytics.

The solution must decide:

- what data should be persisted;
- where it should live;
- how much raw transcript/conversation content should be stored;
- what structured outcomes should be stored;
- how analytics should be supported;
- how to avoid unnecessary Cosmos RU usage;
- how retention should work;
- how security/tenant isolation should work;
- how to keep the design scalable.

---

# 14. Delivery-Only Outbound Calls

Some calls will simply need to deliver information.

In that case, the AI should perform its duty and deliver the information appropriately.

The architecture and campaign model should support calls that do **not** require data collection.

---

# 15. Document Delivery During/After Outbound Calls

The existing AI assistant has the capability to deliver documents or information through:

- WhatsApp;
- email;
- text message/SMS for limited/small information.

Text messages are limited because only relatively small amounts of information can reasonably be delivered through them.

Documents such as PDFs or other files can be delivered by email or WhatsApp.

Do not assume the document must be a PDF; the design should support appropriate document/file types based on the actual system capability.

When the provider configures the call/campaign goal, they may also attach/reference documents to be delivered.

The solution must explore how this should work end to end.

Also explore the edge case of **template-driven document generation/personalization**, for example:

- the provider submits a template;
- the system fills it with the recipient/customer's name or other appropriate fields;
- the personalized document is delivered.

The user explicitly identified this as a possible extreme edge case and is not asserting that it must be implemented exactly this way.

Research whether this is common/valuable and how it should be architected if it belongs in the solution.

---

# 16. Retry, No-Answer, Hang-Up, and Call-Outcome Logic

This area is extremely important.

Do not design only the happy path.

Examples that must be researched and solved include:

- What happens if the person does not pick up?
- Should the system retry?
- How many retry attempts should be allowed?
- What should the retry interval be?
- Should it retry after one hour?
- Should it retry the next day?
- What is standard/best practice?
- Should retry policy be configurable?
- If the person answers on a later attempt, how is the result handled?
- When does the system give up?
- What happens if the customer hangs up immediately?
- Does that count as an unsuccessful call?
- Should the system try again after a hang-up?
- How should different call outcomes be classified?
- What happens with partial completion?
- What happens with voicemail?
- What happens when the phone/network/provider fails?
- What happens when a campaign is paused/cancelled while work is queued?
- What happens when minutes are exhausted mid-campaign or potentially mid-call?
- What happens if a recipient/contact becomes suppressed after attempts are already scheduled/queued?

The examples above establish the required depth but are not exhaustive.

Identify **every relevant call lifecycle and campaign edge case**.

---

# 17. Unsubscribe / Do-Not-Call / Re-Subscribe — Must Be Unbreakable

If a recipient says things such as:

- "never call me again";
- "unsubscribe me";
- "take me off the list";
- or equivalent terms;

the system must handle that correctly.

This is a **trust-critical requirement**.

If someone opts out, the platform must not accidentally call them again.

Breaking that confidence/trust would be disastrous for both the platform and the provider's relationship with their customer.

Research and design:

- how voice opt-out should be recognized;
- whether text/SMS opt-out should be supported;
- how inbound responses such as unsubscribe terms are received;
- whether this belongs on the contact document;
- whether there should be a global suppression/do-not-call list;
- whether both contact-level and global/stateful suppression mechanisms are needed;
- how provider-level removal should work;
- how suppression is enforced at scheduling, queueing, and execution time;
- how to prevent race conditions that could still place a call;
- how to audit opt-out and re-subscribe events;
- how the person/provider can legitimately re-enable calls;
- what should happen if the person texts something like "START" again;
- what telecom-provider features are required.

The original brainstorm notes that perhaps SMS may not be allowed, depending on how the number is configured, and that must be verified rather than assumed.

For the Canada region, the original project description states that **Telnet** is used as the telecommunications provider for voice calling.

For India, the original project description states that **Plivo** is used.

If voice/SMS functionality differs by provider/number/configuration, verify it from the actual code/configuration and official provider documentation.

Do not silently alter the provider names written in this source; if code/documentation shows a canonical provider name or spelling, surface the discrepancy and confirm it.

---

# 18. Research Requirement

You must research online and not rely only on intuition.

Research should include:

- official documentation;
- current best practices;
- outbound-call/campaign architecture patterns;
- AI outbound calling practices;
- compliance-sensitive patterns;
- retry behavior;
- opt-out handling;
- consent/suppression considerations;
- provider/telecom capabilities;
- billing models;
- relevant competitor products and how they approach outbound campaigns;
- document delivery/personalization patterns;
- analytics;
- storage/data architecture;
- scalability;
- performance;
- cost;
- security.

Do not search one or two items and stop.

Explore the meaningful option space.

For each meaningful architectural option, explain:

- what it is;
- how it would work;
- pros;
- cons;
- cost/performance impact;
- scale impact;
- security impact;
- operational impact;
- UX impact;
- fit with the existing Tinket platform;
- whether it is recommended.

Whenever you present multiple solutions/options, explicitly identify your strongly recommended option and explain why.

---

# 19. Codebase Review Requirement

The prior external solutioning agents did **not** have full access to the codebase.

You do.

Therefore:

- read the code;
- understand the code;
- understand the existing AI assistant;
- understand Tinket Ask;
- understand MCP APIs;
- understand the AI Function App;
- understand Cosmos usage;
- understand AI Search usage;
- understand telephony integration;
- understand contacts;
- understand bookings;
- understand billing/minutes;
- understand current audit/activity behavior;
- understand the web and mobile applications;
- understand relevant infrastructure;
- understand the actual data structures;
- understand current patterns before recommending how the outbound feature should fit.

Do not claim a code-specific fact without reading the relevant code.

Do not rely on the prior agents' design in place of code review.

---

# 20. Prior Agent Artifacts — Mandatory Full Read, Reference Only, Not Authority

Two prior agents created supporting solution/research files. **Both files must be read completely, from the first line to the last line, before solutioning begins:**

```text
C:\Nik\Data\outbound-calls\SOLUTION.md
```

and

```text
C:\Nik\Data\outbound-calls\deep-research-report.md
```

These may be useful to understand previous brainstorming and previous yes/no interactive decisions.

However:

- take them with a "pinch of salt";
- they did not have full codebase access;
- do not solidify their design automatically;
- do not fixate on them;
- do not rely on them as the final solution;
- treat them only as hints/inputs/one leg of the brainstorming;
- review them alongside the actual code, current architecture, web research, official documentation, and your own analysis.

Your job is to independently determine the best approach.

---

# 21. Architecture Quality Requirements

The solution must be evaluated from every angle.

At minimum, explicitly evaluate:

- correctness;
- feature completeness;
- edge cases;
- scalability;
- throughput;
- concurrency;
- resiliency;
- fault tolerance;
- performance;
- memory use;
- CPU use;
- storage;
- Cosmos RU use;
- cost;
- operational simplicity;
- flexibility;
- billing flexibility;
- security;
- tenant isolation;
- privacy;
- provider data separation;
- prevention of cross-provider data mismatch;
- observability;
- auditability;
- analytics;
- maintainability;
- future extensibility;
- user experience;
- mobile experience;
- web experience;
- campaign lifecycle;
- one-off-call lifecycle;
- telephony lifecycle;
- retries;
- opt-out/re-subscribe;
- failure recovery.

The final architecture must be solid enough that it does not create a future bottleneck.

---

# 22. Cost and Performance Requirement

Cost and performance are both first-class requirements.

Do not create a design that becomes an unnecessary cost bottleneck.

The user specifically does **not** want to blindly put everything into Cosmos if doing so would create a very large RU burden ("RU juggernaut") at scale.

However, the user is **not prohibiting Cosmos**.

If Cosmos is architecturally the correct solution for particular data, use it.

The requirement is to evaluate storage and processing technologies objectively and choose the best fit for each concern.

The selected solution should be:

- performance-friendly;
- cost-friendly;
- scalable;
- secure;
- flexible;
- maintainable;
- aligned with the platform.

---

# 23. Security / Tenant Separation

Provider information must not be mismatched.

The system must have strong tenant/provider isolation.

Security must be solid.

The design must prevent one provider's:

- contacts;
- campaign instructions;
- documents;
- call results;
- recordings/transcripts if applicable;
- analytics;
- billing data;
- knowledge;
- outbound actions;

from being incorrectly mixed with or exposed to another provider.

---

# 24. Interactive Solutioning Process

This session is intentionally interactive.

You must not make material assumptions just to keep moving.

If you are:

- unsure;
- missing important information;
- unable to verify something from the code;
- seeing a loophole;
- seeing a design gap;
- seeing a conflict;
- seeing a security concern;
- seeing an implementation risk;
- seeing a best-practice concern;

then:

1. explain the issue;
2. explain what you found;
3. provide your recommendation;
4. explain why;
5. ask the user for confirmation when the decision materially affects the design.

The user will review the recommendation and provide insight/approval.

Only after the user confirms the overall solution should it be treated as the **final recommended solution**.

---

# 25. Current Session Gate: Design First, Implementation Later

For this current stage, your only objective is:

> **Fully solution and design the outbound campaign/callback capability.**

Do not prematurely create implementation code.

Do not treat the current brainstorming as approved architecture until the user confirms it.

The expected order is:

1. inspect the codebase and reference artifacts;
2. research the external problem space;
3. identify requirements and gaps;
4. brainstorm architecture/options;
5. analyze edge cases;
6. present recommendations;
7. interact with the user;
8. refine;
9. obtain user approval;
10. then move to documentation/mockups/phasing.

---

# 26. Post-Approval Deliverables

Only **after the user approves the solution design**, proceed with the following.

## 26.1 Final Solution Documentation

Create a phase/solution design file in the `data` folder or another appropriate project folder.

This file must explain the entire approved solution and design in sufficient detail for future implementation sessions.

## 26.2 UI Mockups

If the approved solution requires new UI:

- create mockups before integrated implementation;
- the user will review/approve those mockups;
- only after approval should the relevant implementation phase build the integrated UI.

## 26.3 Implementation Phases

Divide the project into a small number of logical phases.

Possible examples include:

- frontend;
- backend APIs;
- Function App / background processing;
- infrastructure;
- other logical combinations.

Do **not** create too many phases.

Each phase should group work that logically belongs together and can be completed coherently.

Each phase represents a **new Claude session**.

So:

- Phase 1 = new session;
- Phase 2 = new session;
- etc.

The phase count should be only as large as logically necessary.

## 26.4 Coding Standards in Every Phase

Every phase/session must follow the coding standards in this prompt.

The phase files/prompts must include or clearly require them.

## 26.5 Golden Rule for Every Future Phase

No future phase/session may assume material facts.

If a phase finds:

- uncertainty;
- a loophole;
- a gap;
- an inconsistency;
- a non-best-practice decision;
- a risk;
- a missing design point;

it must:

- stop assuming;
- analyze the issue;
- provide the user with the concern;
- provide its recommendation;
- get user confirmation when required before materially changing the approved direction.

Asking the user is better than implementing an incorrect assumption.

---

# 27. Phase Handoff Prompt Rule

The project should support clean handoff between independent/new sessions.

At the end of each phase/session, after the phase is truly complete:

- prepare the prompt for the next phase/session, **or** use a previously created next-phase prompt file if the project chose to prepare all phase prompts earlier;
- provide a **small, copy/paste-ready prompt** to the user;
- include the path to the next phase's prompt file;
- include only short/basic context in the handoff message;
- include important gotchas;
- keep the copy/paste prompt concise because the detailed instructions live in the referenced prompt file.

The user should be able to:

1. copy the small handoff prompt;
2. paste it into a new Claude session;
3. have that new session read the referenced prompt file;
4. continue correctly.

The final implementation phase does **not** need to provide a next-phase implementation prompt if there is no next implementation phase.

However, there is still an end-to-end audit phase described below.

---

# 28. Mandatory Multi-Dimensional Audit for Every Phase

At the end of **every implementation phase/session**, before that phase can be marked complete, perform a multi-dimensional audit of all work completed in that phase.

The audit must verify at least:

- no bugs;
- no logical gaps;
- no missing functionality;
- no performance gap;
- no memory issue/leak;
- no CPU leak/problem;
- thread safety;
- appropriate async/concurrency/multi-threading;
- full performance-friendliness;
- resource handling;
- correctness;
- feature completeness.

The two especially critical outcomes are:

1. **no gaps / no bugs**;
2. **no missing functionality**.

Every finding from the audit must be fixed before the phase is marked complete.

After fixes are applied:

- review the fixes;
- verify the fixes fully close the findings;
- verify the fixes themselves are good and do not create new problems;
- only then mark the phase complete;
- only then provide the handoff prompt for the next phase.

---

# 29. Final End-to-End Audit Phase

After all implementation phases are complete, there must be one final phase dedicated to auditing the **entire functionality/project end to end**.

For example, if the build took four or five implementation phases, the final phase audits all of those phases together.

This final audit must perform the same/similar multi-dimensional review, but across the full feature from beginning to end.

It must verify:

- all components work together;
- no cross-phase gaps exist;
- no bug was introduced by integration;
- no functionality is missing;
- performance is correct;
- memory/resource usage is correct;
- CPU/concurrency behavior is correct;
- security is correct;
- tenant isolation is correct;
- data flow is correct;
- UI/backend/infrastructure/telephony integration is correct;
- all earlier findings are truly closed.

---

# 30. Web and Mobile UI / Mockup Requirements

Do not forget the mobile app.

If the solution requires UI, it must be designed for:

- web;
- mobile app.

## 30.1 Shared Design Quality

Mockups/designs must be:

- extremely modern;
- futuristic;
- good;
- easy to use;
- easy to understand;
- efficient with space;
- not overloaded with unnecessary whitespace;
- not full of unnecessary empty room;
- not confusing;
- aligned with the existing product quality.

Use the existing AI assistant settings page and related established design quality as a reference point.

## 30.2 Brand Alignment

The UI must align with the existing:

- brand theme;
- colors;
- design system;
- kit;
- fonts;
- font sizes;
- font colors;
- icons;
- component styles;
- overall visual language.

Do not invent an unrelated visual style.

## 30.3 Web Responsiveness

The web experience must be **extremely responsive**.

This is an area where the project struggled previously and later improved, so the same mistake must not be repeated.

If the web app is opened on:

- phone/mobile browser;
- iPad/tablet;
- desktop;

it must adapt and render correctly without issue.

## 30.4 Mobile-Native UX

When designing the mobile experience, use the strengths of a mobile application.

For example, where appropriate, use mobile-native interaction patterns such as:

- long press;
- other native-feeling gestures/actions.

The goal is not merely to shrink the web page.

The mobile design should take advantage of mobile capabilities and improve the experience.

---

# 31. Mandatory Coding Standards

The following coding standards are mandatory for all later code analysis, generation, refactoring, and implementation phases.

## SYSTEM INSTRUCTIONS & CODING STANDARDS

You are an expert Software Architect and Developer. You must strictly adhere to the following rules for all code analysis, generation, and refactoring.

## 🛑 1. CORE DIRECTIVES (THE "ZERO" RULES)

- **Zero Assumptions:** Do not assume context. Read and analyze the entire provided codebase thoroughly, regardless of its size, to gain full clarity before writing a single line of code.
- **Zero Hallucinations:** Only output factual, verified code and configurations.
- **Zero Workarounds:** Never use shortcuts, "hacky" fixes, or temporary workarounds. Apply only industry best practices.
- **Plan First:** Analyze thoroughly, formulate a solid architectural plan, and then execute.

## 🏗️ 2. PRE-PRODUCTION FREEDOM & REFACTORING

- **No Legacy Constraints:** We are in a pre-production environment. We have absolute flexibility.
- **Do The "Right" Thing:** Never write backward-compatible code, workarounds, or backfilling logic to support older structures. If a massive refactor is the mathematically or architecturally correct solution, execute the refactor.
- **State Resets:** Assume data can be dropped and recreated at any time. Focus entirely on the absolute best, fully production-ready end state.

## ⚙️ 3. BACKEND & INFRASTRUCTURE

- **Maximum Performance:** Backend code must be hyper-optimized, efficient, and production-ready.
- **Concurrency & Safety:** Implement multi-threading and async tasks where optimal, but you MUST guarantee the code remains 100% thread-safe.
- **Resource Mastery:** Explicitly handle resource deallocation the moment an object is no longer needed. There must be ZERO memory leaks, ZERO CPU leaks, and ZERO resource exhaustion.
- **Watertight Logic:** Code must have zero gaps and zero bugs. Cover every logical pathway.

## 🖥️ 4. FRONTEND & UI ENGINEERING

- **Strict Alignment:** Stay entirely aligned with the existing team theme, design system, and component structure. Build on top of it; do not deviate.
- **Mobile-First Responsiveness:** The UI must be fully responsive and flawless on mobile devices and iPads, as this is our primary user base.
- **Crisp UX & Routing:** Ensure routing between pages is smooth, fast, and lightweight.
- **API Optimization:** UI code must be solid and flexible. Strictly prevent redundant or duplicate API calls.
- **Mockups for New Views:** If tasked with creating a brand new page or interface, DO NOT immediately write the integrated UI code. First, generate an isolated HTML mockup inside a dedicated mockup directory so the design can be visually validated and approved.

## 🛡️ 5. EDGE CASES & RESILIENCE

- **Exhaustive Exploration:** Never limit your scope to the "happy path". You must anticipate, explore, and handle every possible edge case.
- **Fail-Safes:** Account for network errors, latency, null states, missing data, and broken connections on both the frontend and backend. The solution must survive all of them gracefully.

## 💬 6. COMMENTING & DOCUMENTATION

- **High Signal-to-Noise:** Write comments ONLY when they provide critical architectural context or explain the "why" behind complex logic.
- **No Verbosity:** Absolutely no redundant, obvious, or verbose comments. Let the clean code speak for itself.

## 💡 7. OPTIONS & DECISION MAKING

- **Explicit Recommendations:** Whenever presenting multiple solutions, architectural choices, or design options, you MUST always highlight your strongly recommended option.
- **Provide the "Why":** Alongside your recommendation, include a clear, concise justification explaining exactly why it is the best path forward to facilitate rapid and informed decision-making.

---

# 32. Required Approach for This Session

Execute this solutioning session systematically.

## Step 1 — Read Before Concluding

Read:

- the relevant codebase;
- the two prior agent files;
- relevant architecture/configuration;
- data structures;
- existing telephony code;
- billing/minutes code;
- AI assistant and Tinket Ask code;
- web/mobile UI patterns.

## Step 2 — Research

Use the web and official sources to research:

- outbound calling/campaign platforms;
- AI outbound calls;
- call retry practices;
- suppression / unsubscribe;
- telecom capabilities;
- billing models;
- compliance-sensitive design patterns;
- storage/analytics patterns;
- competitor approaches;
- other relevant implementation patterns.

## Step 3 — Build a Complete Requirement/Edge-Case Model

Do not limit yourself to the edge cases listed in this file.

Build the complete call/campaign lifecycle and identify every meaningful branch.

## Step 4 — Present Architecture Options

Explain reasonable options and trade-offs.

## Step 5 — Give Your Strong Recommendation

State what you recommend and why.

## Step 6 — Interactive Review

Ask questions where material facts/decisions remain unresolved.

Do not assume.

## Step 7 — Refine Until User Approval

Only after the user explicitly approves the solution can it be treated as final.

## Step 8 — Post-Approval Work

Then create:

- final solution/design documentation;
- approved UI mockups where needed;
- logical implementation phases;
- prompt files for phases;
- small copy/paste handoff prompts;
- audit requirements.

---

# 33. Definition of Success

A successful solution is not merely one that can place a phone call.

It must provide a complete, production-ready design for a generalized outbound AI calling platform that:

- works across many business types;
- supports campaign and one-off calls;
- works with the existing business app/marketplace/AI architecture;
- integrates correctly with knowledge and tools;
- supports instructions/goals;
- can deliver and collect information;
- can deliver documents through appropriate channels;
- can potentially support personalized/template documents where appropriate;
- handles retries correctly;
- handles hang-ups and all call outcomes correctly;
- handles opt-out/re-subscribe correctly and safely;
- supports analytics;
- uses storage intelligently;
- keeps Cosmos RU/cost under control where possible;
- scales;
- performs well;
- remains secure;
- prevents cross-provider data mismatch;
- supports flexible billing;
- encourages adoption;
- provides excellent provider UX;
- provides excellent callee/customer UX;
- works well across web and mobile;
- can be implemented in logical phases;
- can be independently audited per phase and end to end;
- is based on code reality, official research, and best practice rather than assumptions.

---

# 34. Final Instruction for This Session

Before anything else, complete the mandatory full-reading sequence in Section 0: read this entire master prompt, the entire previous-agent `SOLUTION.md`, the entire previous-agent `deep-research-report.md`, and then thoroughly read the relevant codebase. Do not skip, skim, selectively read, or substitute summaries for those sources.

Read every requirement carefully.

Fully analyze the ask.

Do not skip small details.

Do not rush into implementation.

Thoroughly review the code and prior research.

Research the external problem space.

Brainstorm deeply.

Identify all edge cases.

Present the complete solution design and your recommendation.

Use an interactive process where needed.

The user will confirm the final solution.

After approval, follow the documented mockup, phasing, coding-standard, handoff-prompt, and audit workflow.

**QUALITY OVER SPEED. GO NOW.**

---


# 35. Copy-Paste Launch Prompt Template

The following is the short bootstrap prompt the user can paste into a fresh Claude session. Replace the dummy master-prompt path with the actual saved path before use. The prior-agent paths shown below are the paths originally supplied by the user; update them only if their real locations are different.

```text
I need you to solution and design our new outbound campaign/callback functionality.

MANDATORY FIRST STEP — DO NOT START SOLUTIONING UNTIL ALL REQUIRED READING IS COMPLETE.

Read the following files COMPLETELY, from the first line to the final line, without skipping, skimming, selectively reading, or relying on summaries/snippets/search results:

1. Master prompt — read the ENTIRE file, including every section, rule, coding standard, workflow requirement, audit requirement, and the complete verbatim appendix:
   C:\Nik\Data\outbound-calls\Prompt.md

2. Previous-agent solution — read the ENTIRE file:
   C:\Nik\Data\outbound-calls\SOLUTION.md

3. Previous-agent deep research — read the ENTIRE file:
   C:\Nik\Data\outbound-calls\deep-research-report.md

If any file is too large to read in one operation/context, read it sequentially in chunks until you reach the end. Do not claim a file was read unless you actually read the whole file. If any required path is inaccessible, tell me exactly which file cannot be accessed instead of silently skipping it or assuming its contents.

After those documents are fully read, thoroughly inspect and understand the relevant codebase as required by the master prompt before making code-specific claims or finalizing the architecture.

The master prompt contains the complete product context, requirements, existing architecture, edge cases, research expectations, approval workflow, coding standards, future implementation-phase rules, mockup requirements, handoff rules, and audit requirements. Follow it completely. Do not omit or weaken anything in it.

The two previous-agent files are mandatory reading but are supporting/reference material only; they are NOT automatically the final architecture because those agents did not have full codebase access. Independently validate their ideas against the master prompt, the original verbatim source, the actual codebase, official documentation/research, best practices, and our interactive decisions.

Your CURRENT objective is solutioning and design only — not implementation. Research deeply, inspect the code, independently brainstorm the architecture and every important edge case, compare options and trade-offs, give your recommendation and reasoning, and work with me interactively until I approve the final solution.

Do not make material assumptions. If anything important is unclear, conflicting, incomplete, inaccessible, unsafe, or not aligned with best practice, explain it, give your recommendation, and ask me for confirmation.

Before presenting the solution, explicitly confirm that you completed the full required reading and list the required files you successfully read end-to-end.

QUALITY OVER SPEED. Start now.
```

---

# Appendix A — Original Source Text (Verbatim Preservation Copy)

The complete original user-provided source is reproduced below verbatim as a preservation/reference appendix. The structured prompt above is the operational version; this appendix exists so no original line/detail is lost and so the agent can reconcile any ambiguity against the source.

```text
Okay, so I will tell you what we have. So we have the Tinket Marketplace web and business app. So our web is technically a marketplace, and our business app is kind of like, think it like a business tool that helps every and all the businesses to run their all the businesses and software. And on top of it, we also have a Tinket Ask, which is our search, and then we also have the AI assistant. Those are our two powerful and heart of our entire platform functionality. So what it does is that they both use the MCP APIs, AI function app, and all of it, and the Cosmos and the AI search. It's a combination of all of it. You can read the code, and it's super solid, super good. It technically reads all the details from all of it, and it simply displays the results in the chatbot, and user can communicate through voice and everything. So it's all solid. Now that's for the Tinket Ask. And the AI assistant is simply when the caller is making a call to the provider, and then if we have a different mode. We have like any missed call, summarization mode, like after hours, and AI speak right away. So any missed call means that if the provider didn't pick up, then AI will take over the call. Summarization means that AI will never talk, but it will summarize every single discussion. The third one is the after hours means that after hours of the business, if the provider didn't pick up, then AI will take over. And the fourth one is AI always talk means that any call come to that number, AI will always going to talk. And we also have the provider can also port their number to us. So we have those straightforward instruction and functionality where provider simply can port their number, and what we utilize on that is the call forwarding. So any one call on the provider's number, we forward that call to our AI assistant, and then AI will take over if the provider didn't pick up. So all those things is solid. Everything is working great. Now what we need is the campaign callback. So think it like I want to think it like our system will going calling back to that customer and simply serving whatever it needs to serve on the callback. And now the good thing about our business is that we are very generalized, in the sense that we serve any sort of every and any and all the customer providers, like we have a lawyer, it could be a salon, it could be an electrician, it could be a carpenter, it could be a landscaping fence guy, it could be a handyman, or even could be a doctor's insurance company, finance company, or even a biomedical companies. So we have a, and our system will work for all, and behind the scene for the AI assistant, we have the knowledge base, where they can upload any documents and every documents, and then we simply convert those documents as searchable parts, and we accept every documents like PDF, PowerPoint, Word, and every single thing. We convert to searchable parts, and then we store it to AI search and AI index, and then AI assistant where we utilize the GPT Real Time 2.0 model, where using that AI search and the tool call, it will answer the caller about the provider, and it could be any business of that provider. So now it's all working great. Now for the callback, we just need to brand new build that functionality. What we're thinking of is that how are we going to better way build this functionality that will provide the future flexibility. It can also tie to our billing, and it will also cover most aspects that we need to cover for the callback. Like it's a campaign callback, it's an individual callback, and when I say tie to the booking means that we have the booking means that they can purchase the subscription of 500 minutes of our standard tier and 500 minutes of our advanced tier. Nothing difference between standard and advanced. The only thing advanced will provide is that higher model, which is the ChatGPT Real Time 2.0. That's all. So we have the standard and advanced tier, and with that monthly tier, we give the 500 minutes, and once the 500 minutes is over, they can also top it up with more minutes, whatever the minutes they would like with the charge. So that's what we have. Now in the outbound call, we wanted to have the campaign wherever they wanted to enable any of the outbound call. They could. I don't know. So that's something I need your help to brainstorm what and how we should do. At this point our goal is to encourage this functionality, encourage our this capabilities. So what should be the better approach here, how we should do it, how we should build it, tie to the billing that give us the flexibility. At the same time, it will encourage them to try it out. And remember, we are not even production yet. We are just building this product. We are in the sandbox, UAT, and even dev environment. So we have full flexibility. We can make any and all changes. We don't need to worry about the backfill. I can complete. In fact, right now, all the sandbox environment has been deleted. We'll be creating a new sandbox environment pretty much after two days. So that's how flexible we are. So in order to get it working, if we have to delete the whole environment and create the brand new, I'm cool. We are cool with that. So our goal here is that what the best way, how can we brainstorm, design this, just so that it will cover every aspect of this functionality, provide the best functionality, and provide the best experience for the provider. And I want you to brainstorm fully end-to-end, and then give me your recommendation, and it will be an interactive conversation, means that you can give me your recommendation, I will review it, but ultimately it will be I will be confirming the entire solution, and then and then then you will mark it as a final solution. So your goal here is that you going to brainstorm every aspect of the solution design. You will review from every angle, every perspective, and the edge case scenario is extremely important. And every single edge case scenario needs to be handled here. What about, like, I'll just give you a few examples. What about I want to run a campaign of the outbound call, or what about I just want to make one outbound call? These are just like one edge case scenario I thought of, but every single edge case scenario that we need to handle, like when we make a call, what about that person didn't pick up? What about do we retry? When we retry, that person pick up, and what would be how many times we should retry the calling? And what should be the interval? Next day after one hour, what would be the standard practice here? And should we make it configurable? And then when the person did pick up and he says that never call me again, unsubscribe me, what should we do? Like, you know, all those aspects. And again, as I said, that's the goal and duty of our brainstorming session. Don't be limited. Every single edge case scenario needs to be handled, every single edge case scenario needs to be done correctly, handled correctly, think correctly, and brainstorm correctly. Now what the solution we need is that it needs to support simply the outbound call and the structure that we have. You can read it from our code as well. If you don't want to read it, I'll tell you. We kind of like our entire Tinket AI assistant functionality is built on top of our business app, which is, I told you earlier, we provide the business tool for provider to run their businesses, and entire their services will, like, automatically publish in our marketplace. And in that one, we provide a contact booking code. We don't have an activity, but we could add an activity section. Our activity is different. It's kind of like an audit that we have. So it could be misleading. You might see on the UI the page called activity, but this misleading, it's simply the audit of whatever happening. So we have a contact functionality, and it's not very detailed. It's just like a basic contact: first name, last name, address, email, and stuff like that. And we have the... So yeah, that's what we have. So this is again, this is, I'm not saying that this is a perfect solution. This is just my brainstorming that I was thinking of. I was thinking of that we could have, like, an outbound campaign page where I could create a campaign and I could just simply add all the provider, all the contact to the campaign, and then I could set up a goal, like this is when I make a call. I will kind of like we have in the AI assistant and the search also, we have a standard instruction. I'll provide the instruction that when the AI will reach out to those contacts, what it needs to discuss. So I'll lay down the clear-cut goals that what it needs to try to achieve, what it needs to achieve, and if we require And if we require some feedback, like let's say we wanted to collect some information from the user, then we do need some places, whether we create a new document in Cosmos or wherever we think, like a blob storage, and it needs to be a cost- and performance-friendly option as well. We could capture all the responses, and then provider, I guess, can make a sense out of it, can read the responses, and we can get the analytics out of it and all those things. And if they again pick up, then whatever the setting that we have set up, like how many times as a part of the campaign we should retry, what is the interval, and then we give up, and then we retry again. And if that outbound call is just about, like, delivering some information, then it just do its duty, and it deliver the information. And then sometimes in the outbound call it needs to deliver some of the documents. Now the good thing about that is that our AI assistant have all the capabilities to deliver the documents over the WhatsApp, email, and even certain details on the text message. But text message is limited because it can only do a limited small information on the text message. So it could deliver those PDF over the email, documents over the email, whatever. I'm not suggesting it will be a PDF, but whatever the documents it is, it can deliver it over the email or even the WhatsApp as well. So it is flexible. So while they set it up as a goal, if they have some documents, they could set it up, those docs, put them documents as well, and we'll do it. Now just visualize it, how it will be done with the documents. Like, is it possible that I will tell submit the template and we'll fill the template with their names and deliver the documents? Maybe that will be edge case scenario at extreme. I'm not sure. You have to research online, search web, and see what would be the common functionality, how we should do the outbound call, how the other companies does it, what should be the best practice here? And then, and then, so there's one of it, and then one odd, let's say I want to make outbound call to one customer, then I would simply from the customer page, I can just, there will be a three dot, I'll click on it, I'll say right click, and I'll say set outbound call. I could just simply set outbound call there, and automatically it will either, by default, will create the campaign with that one contact only and will does it, or I don't know. You tell me how we should handle this situation, and the same approach. I could give the instruction with the document, without documents, and with the goal and objective, and it will deliver the stuff. Now, if the customer says never call again, or send a text message to the number, to our caller number, then somehow we'll read those, or maybe we'll not allow the text message, I guess, because it will not accept any text messaging. But if someone, or maybe we use the, for the Canada region, we use the Telnet as our telecommunication provider for the voice calling, and in India we use the Plivo. So if with the voice they'll enable the text message, then maybe either a text message or the call, they'll say, Unsubscribe, take me off the list, whatever those terms. Then either we set those value directly to that contact document, or we could maintain the global list as well, or you tell me by looking at our data structure and documents, how we should maintain the unsubscribe, and that will be unbreakable, that we should never able to call again. If someone says, there will be a trust thing, there will be a disaster. We don't want to break those confidence and trust level between the caller and even the provider's customer as well. But the provider should have some capability to take the person off the list, and even if the person will text again to start, we should be able to do that as well. So these are, again, I'm not even sure what should be the best architecture here. I'm not even sure how we should handle it. These are the projects. I need to brainstorm it with you. This is the early thoughts that I have in my mind, but you tell me based on that what should be the best architecture, design, solution looks like. What are the functionalities we should have that gives us the functionality or flexibility of all of those, gives us the scale, and at the same time what should be the billing looks like, and that billing needs to be extremely flexible as well, like by campaign, by minute, all of it, that would once we go big in production, that should give us some flexibility to maneuver ourselves. But at the same time we provide the diverse option to our provider, whether they would purchase the campaign or purchase the outbound minutes or XYZ. So overall search web, search online, review what I said, brainstorm all the ideas and all the solution that you have. Again, don't be limited. I don't want you to just search one or two things. I want you to explore every single options, every single solutions with their pros and cons. What would be the best practice? What would be the good idea? And then in every solution, those edge case that I mentioned, that become extremely important. Like if they didn't pick up, how many times we'll have to call, all those edge case scenario, review it, search web, search online, search the official documents, search the best practice, search any competitor if there is any, how they are doing it. Our goal and objective, I'll tell you what our goal and objective: to provide the best experience to our provider, where we are going to help them to reduce their work and effort by automating all their outbound calls. And to their customers, where we are making those calls, we want to have the experience where our AI assistant, when delivering the information, are far more better than the human they are talking to. So it needs to adopt, it needs to be flexible while it's talking to the person. It needs to have the clear-cut objective, clear-cut goal, that what are it talking about, what will be the greetings look like, how they're going to greet the caller, how it's going to deliver, how it's going to summarize end the call, like with the defined time frame, all those aspects. Like all the edge case scenario would be what happen if just customer hang up on him, like how it would handle it. Would it consider as a no call and it will try again, or what scenario it will understand and, like. So these are all the edge case scenario, but that are the main objective that I told you: to have the best experience for our provider to automate all the work, and to have the best experience for their customer where we are calling, to deliver those information faster, better, and better than humans. And we need to consider every single edge case, every single details here, particularly the performance cost. How can we do it that would remain the performance-friendly, but at the same time we're not creating a bottleneck for ourselves by creating the cost bottle. Like we don't want, like, everything to be put into Cosmos. That will be like, that will be RU juggernaut that will have millions of RU to even run our businesses. So where it would need makes. I'm not saying do this and that. I just want you to explore. If something will have to put everything in Cosmos, where we have most of our things in Cosmos, then we'll definitely do it. So I'm not saying this versus that. I'm just saying that you have to explore every single perspective, every single options, every single approaches, and then what would be the best cost solution here that achieves our goal, performance-friendly, cost-friendly, remain flexible, security-wise is solid, means that provider's information will not be mismatch. Overall, it will be best practice and solid. So again, brainstorm this, present me your final solution with all the brainstorming. Most importantly, it will be an interactive session. It means that if you are unsure, if you need more information, or you need to clarify something, don't just assume anything. Simply ask the question. We'll make it interactive. Ask the question. We'll validate, we'll verify. I'll provide my insight, and based on that, you'll provide the solution, present me the solution. Once I'll confirm the solution, and after I confirm, that will become our final recommended solution, and then our approach is that if that solution requires the UI, we'll create a mockup after we approve on it. We'll create a mockup that I'll approve it, and then we'll create a phase file in the data folder or some other folder where we'll create, like, an all-the-solution design file that explains the entire solution, entire design. And now to achieve our solution, we'll divide this entire project into some of the phases, like a front-end, maybe back-end we'll need to divide into a couple of back-end tasks, like APIs and function app. That logically make sense. I don't want to create too many phases to implement, but, like, you know, a phase that logically will make sense and, like, do work together in the one areas and can combine all the work. And then remember each phase means each new session, and that means that we'll start with the phase one, phase two. Every time new phase means the new session. So it means that whenever we're gonna start each phase, we'll start a new session. So we're gonna create that many phases that logically make sense, and then we'll make some coding standards rule. I will give you below coding standards as well. So this will be our coding standard. Every single session and phases will have to follow that coding standard. And most importantly, we'll have a rule that no assumption. None of those sessions will assume, or none of those phases will assume anything. If it's unsure, if it needs some clarity, if it finds some loophole, gap, it just needs to brainstorm again those problems, issues, recommend me what they are thinking of, but ultimately they'll have to get my permissions confirmation. They cannot assume anything. So instead of assuming something incorrect, it's worse than simply ask me, and I'll confirm it. So that will be our golden rule when we're gonna create those files. And then simply we'll have also a rule that once each phase or each session will finish its work, then it will write the prompt file for the next phase, or we'll write the prompt file for each of the phase earlier as well. But then it will, once one phase is done, then it will give me the prompt that I can copy and paste, a small prompt with how the, like, you know, the path of the prompt file of the next session, and like a small basic details of what we're trying to achieve, and some of the gotchas, and some of the things, like short and simple. But that way once we give that path, that contains all of those major details, and it simply go to that prompt, read it what it needs to do, and I can just simply, it needs to give it in a way that I can copy and paste. So I'll copy, paste, and I give it to the next session, it can just work on it and deliver it. So that's our also a rule. But that is again all those things is after I approve the solution designing. So your goal here is just do the solutioning and design. That's only objective. That's your only goal. So after I approve, we'll do that. And also every phase at the end of it will have the multi-dimensional audit rule as well. Means that at the end of every phase means that individual session, once it's done its work, once it's delivered all its work, once it's finished all its work, then simply it's going to audit all its changes, and that will be a multi-dimensional audit to making sure that there is no bug in the code, there is no loophole, there is no missing functionality, there is no performance gap, there is no memory issue, there is no CPU leak. Entire thing is been done with the multi-threading, with the full performance-friendly way. Most importantly, the two main areas will be there is no gap, there is no bug, and there is no missing functionalities. So we'll perform that multi-dimensional audit as well, and then all the finding need to be fixed before they mark that phase as complete. Then all the finding will be fixed as well, and they'll review all the fix they have done for all the finding as well to making sure it will close all the loops and all the findings, and this fix will also good as well. And then they will simply at that point they'll mark that phase complete and they'll give me the prompt for the next phase with that path and some basic details, two, three lines, and that I'll copy paste into the next phase. And the last phase, whoever it is, it doesn't need to give me the prompt because there is no phase at the end. But then at the end of all of it, let's say hypothetically put we created four, five phases, but then the last phase will be the audit of the entire functionality, entire project end to end. So in every phase we'll do the multi-dimensional audit, but at the last we will have one phase that will do the same and similar multi-dimensional audit of this entire functionality from beginning to end, from all of those phases earlier that we have done and developed, and same multi-dimensional audit. So that's that. And now, the last thing, the details about our audit is that, not the audit, but details about our mockup, is that we cannot forget about the mobile app as well. So it needs to be done in a web, and also it needs to be done in our mobile app as well. Now web and mobile app, both of them needs to be done, and at the same time, those mockup needs to be extremely futuristic, extremely good, easy to use, easy to understand, utilizing all the spaces, not to have too many white spaces, not to have too many rooms, like not so confusing designs, modern, futuristic design, good design, like we have for the AI assistant setting page and all of it. That will be aligned with our brand theme, color, design, and our kit, like our branding, theme, color, designs, particularly the font size, font color, brand and theme and colors. Everything needs to be aligned, including the icons and everything. It needs to be a modern, futuristic design. And for web, it needs to be extremely responsive. That's where we struggled a lot, we improved everything. So now we cannot make that mistake. Means that if someone open our web from the mobile app or from the iPad, it needs to render perfectly. It needs to adopt that design. It needs to render perfectly without any issue. And at the same time, when we design and mock up something for the mobile app, it needs to utilize the power of the mobile application. It needs to do it that will enhance the mobile app. It can utilize the functionality of the mobile app itself, like a long press and all of those functionality, and it just get the best out of the mobile app. So that's also a rule of the mockup as well. So that's our whole project. I explained. I explained what we're trying to achieve. I just explained some of my brainstorming. I don't want you to be limited. I want you to be fully thoroughly think about this entire problem. I want you to thoroughly review, research online, search our competitors, search web, brainstorm yourself, review all the edge-case scenario, think about all the edge-case scenario, have an interactive session, and then recommend me the solution, and then I'll confirm, and then we'll do all those phases, mockups, all the requirements, solutioning, designing, everything. So remember, your goal here is the first solution design, and then you'll document everything, then you'll create the mockups. But your main goal here is that solution and design. You are the expert solution design and cloud infrastructure and security architect. That's what your goal. That's what your objective is. You are kind of like my solution architect, business analyst, project manager. That's what your goal is. You're not gonna develop this. That will be, we're gonna create this future phase file, so that next sessions we'll give those prompt, and it will be a brainless. It will just follow what we have done, what we have solutioned, what we have designed. But it's not just gonna be a brainless. It will use their brain. It will stock. It will find it. This will not be a best practice. Definitely, as I mentioned, you're going to write it down. If it doesn't see something best practice, if it doesn't see something good, aligned, it needs to brainstorm and it needs to ask for a confirmation with the recommendation. So that's what we're gonna do. Doesn't matter how long does it take, doesn't matter it will take forever, but the quality of the work will become very important. This will be the heart of our functionality. So quality over speed. Go now.

and I gave this to other model and it created this "C:\Nik\Data\outbound-calls\SOLUTION.md" and this is the third agent did this solutuioning  "C:\Nik\Data\outbound-calls\deep-research-report.md" And remember, both of them didn't have the full access to our code base. So it was based on what I described at the top. So.


So again, this is just created by another model, but you just have to take this as a pinch of salt, and maybe we did have some interactive session and yes or no kind of a thing. So it might help you just to get into that direction. But I don't want you to just fully solidify in this solution. I want you to fully think about this. What should be the best approach here? How we should handle it, how we should do it, what should be the best approach, best solution. So this should be one of the hints for your brainstorming, or one of the legs for your brainstorming, but I don't want you to fixate it, and I don't want you to just rely on this solution only. I want you to fully think about it. I want you to fully brainstorm this. I'm just sharing this. It might help you just to understand and comprehend, but this should not be your final solution. So I'm going to share the other agent, the third agent that I gave that analysis to. It does something as well. So just take a look at all those documents, and that might going to help you. But I want you to read the code, understand the code, look through the entire code, understand it everything, and see, and see and feel that how we should implement, how we should do it. That's very important. So I want you to have this brainstorming interactive session while you review the code, while you brainstorm the whole code, understand it, brainstorm the other analysis, review the other agent that I have prepared, and then you will have the interactive session, and then you will prepare, and then you will present me the solution that you think will be the best and I'll approve, and then we go with the rest of the steps that I mentioned. So go now. Quality over speed. And below are all the coding standards that I mentioned that you're going to put it on the space file as well.



# SYSTEM INSTRUCTIONS & CODING STANDARDS

You are an expert Software Architect and Developer. You must strictly adhere to the following rules for all code analysis, generation, and refactoring.

## 🛑 1. CORE DIRECTIVES (THE "ZERO" RULES)
* **Zero Assumptions:** Do not assume context. Read and analyze the entire provided codebase thoroughly, regardless of its size, to gain full clarity before writing a single line of code.
* **Zero Hallucinations:** Only output factual, verified code and configurations. 
* **Zero Workarounds:** Never use shortcuts, "hacky" fixes, or temporary workarounds. Apply only industry best practices.
* **Plan First:** Analyze thoroughly, formulate a solid architectural plan, and then execute.

## 🏗️ 2. PRE-PRODUCTION FREEDOM & REFACTORING
* **No Legacy Constraints:** We are in a pre-production environment. We have absolute flexibility.
* **Do The "Right" Thing:** Never write backward-compatible code, workarounds, or backfilling logic to support older structures. If a massive refactor is the mathematically or architecturally correct solution, execute the refactor. 
* **State Resets:** Assume data can be dropped and recreated at any time. Focus entirely on the absolute best, fully production-ready end state.

## ⚙️ 3. BACKEND & INFRASTRUCTURE
* **Maximum Performance:** Backend code must be hyper-optimized, efficient, and production-ready.
* **Concurrency & Safety:** Implement multi-threading and async tasks where optimal, but you MUST guarantee the code remains 100% thread-safe.
* **Resource Mastery:** Explicitly handle resource deallocation the moment an object is no longer needed. There must be ZERO memory leaks, ZERO CPU leaks, and ZERO resource exhaustion.
* **Watertight Logic:** Code must have zero gaps and zero bugs. Cover every logical pathway.

## 🖥️ 4. FRONTEND & UI ENGINEERING
* **Strict Alignment:** Stay entirely aligned with the existing team theme, design system, and component structure. Build on top of it; do not deviate.
* **Mobile-First Responsiveness:** The UI must be fully responsive and flawless on mobile devices and iPads, as this is our primary user base.
* **Crisp UX & Routing:** Ensure routing between pages is smooth, fast, and lightweight.
* **API Optimization:** UI code must be solid and flexible. Strictly prevent redundant or duplicate API calls. 
* **Mockups for New Views:** For this project, the entire mockup is already approved. The latest charter permits UI improvements or new necessary screens without another approval or mandatory mockup. Use the approved reference and verify the final experience.

## 🛡️ 5. EDGE CASES & RESILIENCE
* **Exhaustive Exploration:** Never limit your scope to the "happy path". You must anticipate, explore, and handle every possible edge case.
* **Fail-Safes:** Account for network errors, latency, null states, missing data, and broken connections on both the frontend and backend. The solution must survive all of them gracefully.

## 💬 6. COMMENTING & DOCUMENTATION
* **High Signal-to-Noise:** Write comments ONLY when they provide critical architectural context or explain the "why" behind complex logic.
* **No Verbosity:** Absolutely no redundant, obvious, or verbose comments. Let the clean code speak for itself.

## 💡 7. OPTIONS & DECISION MAKING
* **Explicit Recommendations:** Whenever presenting multiple solutions, architectural choices, or design options, you MUST always highlight your strongly recommended option. 
* **Provide the "Why":** Alongside your recommendation, include a clear, concise justification explaining exactly why it is the best path forward to facilitate rapid and informed decision-making.


this contains lots of info and so many details and bug and issue to fix so without missing anything read every single word and understand and fully analysis the ask and then plan and go now

QUALITY OVER SPEED SO GO NOW!


```
