Read C:\Nik\CLAUDE.md in full, then C:\Nik\Data\post-ranking-followups\FINAL-PLAN.md in full — it is the authority for this
build — then PLAN.md §10 (every owner decision, verbatim) and §11 (the approved mockups), then the design files it names
(DESIGN-TALL-PAGES.md, DESIGN-PICTURES.md, DESIGN-PROVIDER-SCORING-SCALE.md) and FINDINGS-OOM.md, and every skill the plan
names, completely.

Every decision, design and mockup is ALREADY APPROVED. Nothing is open. Your job is to BUILD everything in FINAL-PLAN.md §3
(W1–W16), in the order of §4, with the proofs of §5, to the definition of done in §7.

You also have creative freedom. Read the real code end to end and re-review each approved design against it; brainstorm
the edge cases. If you see something that is not correct, a gap, an edge case the approved solution does not handle, or a
better and more industry-standard way, write it down and bring it to me: what is wrong, your better solution, and why it is
better. I will confirm. Otherwise, build the approved plan as written. Never assume and never silently deviate. When you
ask, use AskUserQuestion and explain in plain words in the chat (never send me to a file), and log my answer in PLAN.md §10
the moment I give it.

UI: you have full design freedom and do NOT need my approval, as long as you follow FINAL-PLAN.md §0a. Treat the approved
mockups as a starting point and change them wherever you can do better. Every screen must be modern and futuristic, and
it must use the space well: no wasted white space, and the important content visible without scrolling. The web must be
fully responsive on a phone browser, an iPad and a laptop or monitor. The phone apps must use phone-native patterns such
as long press, swipe, bottom sheets and haptics. Match each app's own font, colours, sizes and theme exactly. Every word
must be plain and friendly, never technical. When what you build differs from its sheet, update the sheet and its row in
PLAN.md §11 so the record shows what shipped.

No degradation of Ask Clinket, the receptionist, search or Insights — prove every change before and after on the CA and IN
sandbox (full permission; connection strings in cosmosindexsetup\appsettings.{ca,in}.json and
clinqetfuncations\Clinqet.Communications\local.settings.{ca,in}.json — never print a key). Build and test in an isolated
copy, never in the shared trees. Real uploads through the product for every reading change. Finish with the
multi-dimensional audit and fix every finding in this session. Commit locally with linear history; I push and deploy.

Start with FINAL-PLAN.md §4 step 1.
