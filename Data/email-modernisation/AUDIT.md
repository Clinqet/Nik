# Email modernisation — closing audit

> §5b of `TASK-PROMPT.md` makes this a **GATE, not a report**: every finding is fixed in the same session.
> Written 2026-10-02. Each line says what was **VERIFIED** (a check that was run, with its result) and what was
> **ASSUMED** (reasoned, not measured).

**Result: 21 findings, 21 fixed in this session. 0 deferred.**

> **Round 3, 2026-10-02 — the rebase onto master.** Three other programmes landed while this work ran
> (AI Assistant number lifecycle, voice receptionist, trial reminders), bringing the shell itself onto
> master along with 16 new templates, 3 reworded ones and 1 split into variants. F20 and F21 come from
> that rebase.

> **Round 2, 2026-10-02:** the owner approved the mockup, asked for O4 to be fixed and for O1 and O2 to be
> fixed if they were small, and told me to drop O3 and O5. Findings F13–F19 come from that round — five of
> the seven are defects in my own work, found by the guards and by looking at the output.

---

## 0. Findings and what was done about them

| # | Dimension | Finding | Fix |
|---|---|---|---|
| **F1** | Correctness | `BookingRejection` carried `{{#if RejectionReason}}` / `{{/if}}`. `TemplateService` has never supported conditionals — it does a plain `string.Replace` per property name — so **every rejected customer, in all five languages, saw those braces as literal text** above the details box. | Removed with the migration. The Reason row renders exactly as it already did. Follow-up O4 in `PLAN.md` offers the correct conditional-row mechanism. |
| **F2** | Correctness | `RefundProcessed` hard-coded `{{AppBaseUrl}}/dashboard/billing` although `BillingReceiptEmailProcessor` already computes and passes `BillingPath = BillingPagePaths.For(...)`. An **AI top-up refund opened the plan billing page, which never shows AI money** — the exact thing `BillingPagePaths`' own comment forbids. | Now uses `{{AppBaseUrl}}{{BillingPath}}`. A plan refund resolves to the identical URL as before; an AI refund now reaches the AI page. |
| **F3** | Correctness | `FounderBlockHtml` emitted its own `<tr>`. The shell gives a sender's block a padded card row of its own, so that `<tr>` would have nested inside a `<td>` and **every mail client discards it** — the founder discount would have vanished. | `BillingNotificationService.ApplyFounderOffer` now emits a self-contained `<div>`. Verified by rendering `SubscriptionTrialEnded_Plan` with the real block (screenshot in the session; the offer box renders). |
| **F4** | Tests (coverage loss) | `EmailTemplateCorpus.CopyOf` did not walk `EmailBlock.Token` / `RowsToken`, so **all nine declared `HtmlFragment` placeholders became invisible** and `EveryDeclaredFragment_IsStillUsedByATemplate` accused them of being orphaned. | Added `PlaceholderText`, which walks block tokens as well as copy, links and the plain-text part. Caught by the guard itself, not by reading. |
| **F5** | Tests (coverage loss) | Four guards read top-level string properties or the raw file. After the migration that is **the Subject alone** — a 3,780-field translation hole, and the logo/language scans would have read **zero** files and reported success (§0.17: worse than no guard). | All email guards now read the **shipped** document and walk into `Content`, through one reader. Each asserts its scanned count is greater than zero. |
| **F6** | Tests | My own word-coverage guard compared against `EmailShell`'s tag-stripping with a different rule (`<tag>` → space, not nothing), so `"{{ProductLabel}}</strong>."` became `"{{ProductLabel}} ."` and 24 templates reported false failures. | The guard now mirrors `EmailShell.Strip` exactly: `<br>` becomes a break, every other tag closes up, entities decode. |
| **F7** | Tests | The guard compared copy against the **authored** `PlainTextContent`, which for 49 of 67 templates is not a complete rendering of the email (several omit the heading and the button label — pre-existing). | The guard now asserts on the shell's **own** `RenderPlainText`, which is the property it can honestly claim. A separate assertion covers the shipped plain text: non-empty and free of markup. The authored gap is recorded as O2 for the owner, because correcting it is a copy change. |
| **F8** | Correctness (new, mid-session) | While this work ran, the Trial-offers programme pushed a **108th template, `OfferAvailable`, in the old legacy style** — Arial, div-based, no media query. A fourth generation arriving during the migration. | Migrated in all five languages and included in every check. |
| **F9** | Process | Re-running the migration writer over already-migrated files **emptied every template** (it reads `HtmlContent`, which a migrated file no longer has). Caught by inspecting the output immediately after. | Recovered from the git-exported originals — git then reported the 107 originals byte-identical, so nothing was lost. The writer now aborts on an already-migrated file. |
| **F10** | Security | Nothing proved that a **shell-composed** body still encodes a hostile token value; it would be easy to assume the copy layer escapes. | `ProcessTemplate_EncodesAPlainString_IntoAShellComposedBody` pins that an injected business name is encoded in **all four** places the shell put it (heading, paragraph, fact value, footer) while a declared `HtmlFragment` still passes through. |
| **F20** | Correctness | ‼️ `BookingRejection` is sent TWICE — once to the customer, once to the provider — from two separate blocks in `BookingEmailProcessor`. The O4 fix changed only the customer one, so the **provider's copy would have shipped the literal text `{{RejectionReasonRow}}`**: a placeholder nothing supplies is not blank, it renders as itself. Found by asking the memory's own question — "can any remaining branch still reach the bad state?" — not by a failing test. | Both paths compose the row, each in its own recipient's language. |
| **F21** | Tests | `Run_BookingRejection_PersistsRejectionReasonInTemplateData` asserted the OLD contract (a bare `RejectionReason` value). | Rewritten to the new contract, and a second test added for the half the old one never covered: **no reason ⇒ no row at all**. |
| **F13** | Correctness | Three producers compose extra rows INTO a template's fact table — the per-visit and distance charges, the payment method — and each wrote its own markup. Beside the shell's rows they rendered a different size, colour and alignment. A regression this change introduced, and my render harness hid it by substituting my own stand-in markup. | One `EmailShell.FactRow`, used by the shell and by all three producers, so the markup cannot drift again. |
| **F14** | Correctness | F2 was only half fixed: `RefundProcessed`'s **plain-text** part still carried the hard-coded `/dashboard/billing`, so a text-only reader of an AI top-up refund still landed on the plan page. | The plain-text link now uses `{{BillingPath}}` too, in all five languages. |
| **F15** | Tests | My own guard stripped Indic **combining marks**, turning "ચુકવણી પૂર્ણ" into "ચ કવણ પ ર ણ". Every Hindi and Gujarati comparison it made was quietly wrong. | `\p{M}` is kept. The same bug was in the migration tool and was fixed there too. |
| **F16** | Tests | The same guard compared **case-sensitively**, so a Spanish fact value capitalised as a label ("Plan gratuito de Clinket") was reported missing from a sentence that says the same words in lower case. | Compared case-insensitively — it is a check on words, not on capital letters. |
| **F17** | Correctness | My first attempt at O2 merged every missing line into the authored prose. It **garbled Spanish**: a capital letter made a line look missing so it went in twice, and one landed inside a sentence. | Thrown away. Replaced by inserting only at document boundaries — the heading at the top, footer lines at the end — where nothing can land mid-sentence. |
| **F18** | Correctness | Deciding those insertions per language broke **token parity**: English skipped a button whose link a sentence already carried while Spanish inserted one, so Spanish ended up with a `{{Tier}}` English did not have. Parity is what proves a translated email opens the page its English original opens. | A change is applied to all five languages or to none. Verified: all 105 templates carry identical tokens in every language. |
| **F19** | Correctness | That merge put `{{IntroHtml}}` — composed **markup** — into a plain-text part, where its tags would print to the reader. | A field that is only a placeholder is never copied into the text half; the text half has its own token (`{{IntroText}}`). |
| **F12** | Tests | Re-running the pre-migration word checker after the migration passed **vacuously** — it re-parses the migrated file, finds no `HtmlContent` and compares nothing to nothing. | Replaced by a checker that compares the original export against the file now on disk. See §1. |
| **F11** | Responsiveness | A fact table is two columns. A Hindi or Gujarati label plus a date cannot share 335px, so it would have squeezed to a word a line. | The mobile query stacks `.facts td`. Proven by rendering, not by the rule's presence — see §3. |

---

## 1. Correctness — the words did not change

**VERIFIED.** A per-file, per-language comparison against the originals exported from `origin/master`:

| Check | Files | Result |
|---|---|---|
| Visible words, as a multiset: the **original on master** vs the **migrated file now on disk** | 525 | **0 unexplained differences** |
| `{{Placeholders}}`, per destination (Subject · body · plain text) | 525 | **0 unexplained differences** |
| Link targets (`href`, `CtaHref`, `Footer.LinkHref`) | 525 | **0 unexplained differences** |

‼️ **F12, caught while writing this section:** re-running the pre-migration word checker after the migration
reported "104 clean, 0 problems" per language — a **vacuous pass**. It re-parses the migrated file, finds no
`HtmlContent`, and compares nothing to nothing. The number above comes from a checker written specifically to
compare the original export against the file now on disk, which is the only form of that claim worth making.
Exactly the §0.17 failure mode this change hardened the guards against, met once more in my own tooling.

The comparison is per destination, so a token that used to sit only in the old `<title>` and now reaches the
recipient through `Subject` is not mistaken for a loss.

**Three deviations are deliberate**, each registered in the checker with its reason:

1. `{{#if RejectionReason}}` / `{{/if}}` — F1.
2. The word `CLINKET`, painted above the logo image in `PasswordChangedEmail` and `PasswordSetEmail`. Dropped as
   duplicate branding; the logo's `alt` still carries the name, and `Account security` became the status chip.
3. Tokens that existed only inside **commented-out** action buttons (`{{BookingUrl}}` ×10, `{{InvoiceUrl}}`,
   `{{DashboardUrl}}` ×4, `{{QuoteUrl}}`). §0.14 forbids commented-out code; nothing rendered changed.

**ASSUMED, not measured:** that the four non-English languages say what their English counterparts say. This work
did not read the translations for meaning — it preserved each language's own words exactly, and the structural
parity guards prove every language carries the same tags, tokens and links as English.

## 2. Security — no token is interpolated as markup

**VERIFIED.**
- `TemplateService.ForHtml` encodes by **TYPE**: only a value the producer declared as `HtmlFragment` passes
  through. Unchanged by this work — composition happens at load, substitution at send, and the seam between them
  did not move.
- A business name carrying `<script>` is encoded in every place the shell puts it (F10).
- Template **copy** is emitted raw by the shell, because that copy legitimately carries `<strong>`. It is
  author-controlled, not user-controlled, and `NoTemplateCopyCarriesPresentationOrLayout` now restricts it to
  `strong b em i u br a code` with **no attributes but `href`** — so no copy field can carry a `<script>`, a
  `<style>`, an event handler or a layout table.
- `CtaHref` and `Footer.LinkHref` are emitted into an `href`. The content guard requires each to be absolute,
  `mailto:` or a token; a token's substituted value is encoded, so a quote in a value cannot break out.

## 3. Responsiveness — proven by rendering, not by the presence of a query

**VERIFIED.** Every template was rendered through the **real `EmailShell`** (a harness referencing the shipping
assembly, not a reimplementation) and loaded in a browser:

| Check | Scope | Result |
|---|---|---|
| Horizontal overflow (`scrollWidth > clientWidth`) at **375px** | 520 emails (104 × 5 languages) | **0** |
| Horizontal overflow at **320px** | 520 emails | **0** |
| Looked at, computer and phone | 10 scenarios covering every block kind, 2 of them Hindi | reflows correctly |

What the mobile query actually changes, confirmed on screen: side padding 40px → 20px; the heading 28/36 → 24/32;
the action button goes full width; the canvas gutter shrinks; **a fact row stops being two columns and stacks its
label above its value**. A query that changed nothing would not have produced those screenshots.

Sabotage: renaming the `.facts td` rule so it matches nothing made the guard fail for every template. The guard
can fail.

## 4. Every language

**VERIFIED.** All five (`en es fr gu hi`) are migrated, rendered and swept for overflow. Hindi and Gujarati run
longer than English, so:
- the action button is never given a pixel width — it is `display:block` on a phone, and the guard fails any
  template whose button declares a width;
- fact rows stack rather than sharing a row;
- the page declares the language it is written in, which it did not before for any migrated template.

Translation coverage is **higher** than before: 3,780 copy fields are now compared field-by-field against English
(previously the Subject alone would have been). That found one real case — `"<strong>Plan:</strong> {{ProductName}}"`
is identical in Spanish because *Plan* is the same word — registered per field with its reason rather than
silenced wholesale.

## 5. Performance and memory

**VERIFIED by reading the code and the call path:**
- Composition happens in `TemplateService.LoadJsonTemplateFile`, i.e. **once per template per language at load**,
  never per send. `ProcessTemplate` still only substitutes.
- `EmailShell` builds one `StringBuilder(4096)`; no string concatenation in a loop.
- Both regexes are `[GeneratedRegex]` source-generated statics. **No regex is constructed per call** — the static
  `Regex.Replace` overload takes a lock on a shared pattern cache, and this runs once per paragraph across 540
  files at startup.
- No unbounded growth: every loop is over a template's own blocks.
- The `.html` loading path, its two helpers and one method nothing called were deleted, so startup now reads each
  language directory once instead of twice.

**ASSUMED:** that composing 540 documents at startup is not a meaningful cost. It is ~17,000 lines of
`StringBuilder` work done once per process; the previous code read the same files and did the same I/O.

## 6. Deployment

**VERIFIED.**
- Templates ship as host content via the existing `Resources/**` copy in each consuming project. The file set
  changed but not the mechanism.
- Nothing references a deleted template: a scan of all nine .NET repos for `EmailConfirmation`,
  `PasswordResetEmail` and `VerificationEmail` returns **zero** production references (and zero test references).
- No new Azure resource, queue, container or `local.settings.json` key, so no ARM or `deploy.ps1` change is owed.
- `Clinqet.API`, `Clinqet.Identity.API` and `Clinqet.Mcp` all **build** against the changed libraries; the only
  public signature change (`EmailShell.Render` gained a language) has no caller outside these four repos.

‼️ **One deployment dependency, and it is the whole risk of this change:** the shell itself
(`Rendering/EmailShell.cs` and the `Content` property) is the concurrent number-lifecycle session's uncommitted
work and is **not on master**. A migrated template without it deserializes to an empty body and **the email sends
blank**. See `PLAN.md` §3 — that commit must land with or before this one.

## 7. Tests

**VERIFIED.** `Clinqet.Communications.UnitTests`, the host that owns the templates: **all green**, no new skips.
`Clinqet.API.UnitTests` billing/email/template subset: 323 passed, 0 failed (30 pre-existing skips, untouched).

No guard can pass over nothing: every scan asserts its own count is greater than zero before asserting zero
failures. Four of the new guards were **sabotaged and confirmed to fail**:

| Sabotage | Guard that caught it |
|---|---|
| Dropped `{{BookingNumber}}` from a fact value | `EveryTemplateUsesExactlyThePlaceholdersAndLinksItIsPinnedTo` |
| Put `<span style="color:#ff0000">` into copy | `NoTemplateCopyCarriesPresentationOrLayout` |
| Retyped a `Facts` block as `Text` | `EveryTemplate_DeclaresExactlyOneContentForm_AndAContentOneIsComplete` |
| Hard-coded `lang="en"` in the shell | `EveryTemplatePage_DeclaresTheLanguageItIsWrittenIn` |
| Renamed the `.facts td` mobile rule | `EveryShippedEmail_IsResponsiveAndOnBrand` |

Every sabotage was made on a snapshot copy and restored by copying back — never through `git checkout`,
`restore`, `reset`, `stash` or `clean` (§0.19). The worktrees were verified clean afterwards.

Both integration-test projects (`Clinqet.Communications.IntegrationTests`, `Clinqet.API.IntegrationTests`)
**build** against the changed libraries. They were not RUN, and this is the reason rather than an excuse: the
change touches no money path, no SQL or Cosmos schema, no unique index, no atomic counter, no webhook and no
Service Bus processor, which is what §0.8 makes integration tests mandatory for. The one money-adjacent edit —
`ApplyFounderOffer` emitting a self-contained block instead of its own `<tr>` — is asserted by
`PromoSunsetSqlIntegrationTests` only as "the HTML contains the promo code" and "an outsider gets an empty
string", and both still hold.

The loader itself IS exercised against the real files: `EveryJsonTemplateResolvesByItsCanonicalFileNameInEveryLanguage`
constructs a real `TemplateService` over the real template directory in all five languages, and now also asserts
that every `Content` template composed to a **non-empty body and a non-empty plain-text part** — which is the
failure mode that would otherwise reach a recipient as a blank email.

**No lint run is owed:** this change touches no UI repo.

## 8. Dead templates deleted

Three templates, in **all five** languages — 15 files:

| Template | Why it is dead |
|---|---|
| `EmailConfirmation` | Registration confirms with a code, not a link. `{{ConfirmationLink}}` has no producer. |
| `PasswordResetEmail` | `AuthService.RequestPasswordResetAsync` sends a code through `MfaCodeNotification`. `{{ResetLink}}` has no producer. |
| `VerificationEmail` | Same code flow. `{{VerificationLink}}` has no producer. |

Proof: a scan of every `.cs`, `.json`, `.ps1`, `.csproj` and `.md` in all nine .NET repos (4,492 files) found the
names **nowhere** — not in production code, not in tests, not in `appsettings`, not in `deploy.ps1`. Template
names are never composed at runtime (checked: no `GetTemplateAsync($"...")` anywhere), so a dynamic reference is
not possible.

## 8b. The owner's round-2 decisions

| | Decision | What was done |
|---|---|---|
| **S1 mockup** | **APPROVED 2026-10-02** | Recorded in `Data/mockups/REGISTER.md` and in `PLAN.md` §0 the same day, as §0.20 requires. |
| **O1** | Fix | The eleven headless messages were given a heading — each took its OWN Subject, already written and already translated in all five languages, so no word was invented and nothing was re-translated. `HeadlessTemplates` in the guard is now EMPTY, which makes a missing heading a build failure rather than a habit. |
| **O2** | Fix if small | Fixed narrowly: 290 headings and 20 footer lines added to the plain-text parts, at document boundaries. It was NOT small in the general form — see F17/F18/F19. |
| **O3** | Ignore | Dropped. The WhatsApp button URL is registered at Meta and no code change can reach it. |
| **O4** | Fix | The Reason row is composed by `BookingEmailProcessor` now, so it disappears when the provider gave no reason. Its label moved into localization, taking each language's own existing word. Registered as a declared `HtmlFragment`. |
| **O5** | Ignore | Dropped. `Email:LogoUrlOnDark` stays. |

### What O2 is still not

Three things remain true of the plain-text parts, and they are **copy** matters rather than defects:

- Six templates (`FriendlyName*`, `Passkey*`, `MfaEnabled`) carry sentences the HTML has never said — "You can
  review your account settings here: …". That is why the whole part cannot simply be derived from the content.
- A handful of body paragraphs and sub-headings are still absent from one language's text part but present in
  another's. Inserting them means writing into the middle of translated prose, which is exactly what garbled
  Spanish in F17.
- The preheader and the status chip are deliberately not in any plain-text part.

Every heading, every action link and every footer line IS there, in all five languages, and
`EveryWordATemplateDeclares_AppearsInTheEmailItShips` now asserts that against the part that actually ships
rather than against the renderer's own output.

## 8c. The rebase onto master (round 3)

Master moved by 4–7 commits per repo while this work ran. The rebase was done in a dedicated worktree, one
commit at a time, and every conflict resolved by hand:

| Conflict | Resolution |
|---|---|
| `EmailShell.cs`, `EmailTemplate.cs` (clinqetshared) | Kept mine. Verified line by line that master's version is wholly contained in it — every line master has that mine "lacks" is one I rewrote (the language argument, the block renderer, `<br>` in the text half). |
| `TemplateService.cs` | Kept mine. Master's only change since my branch point was the composition hook, which mine already has, plus the language argument and the retired `.html` path. |
| `EmailTemplateAssetConventionTests`, `EmailTemplateContentConventionTests` | Kept mine. Master's `ShippedMarkup` helper is subsumed by `EmailTemplateCorpus` (which every guard uses, not just the logo one), and mine asserts everything master's did plus block-kind validity. |
| `SubscriptionTrialEndingSoon`, `_AiNoCard` ×5 | **Took master verbatim.** Both were already rewritten on the shell with new wording, so there was nothing to convert. |
| `SubscriptionTrialEndingSoon_PlanNoCard` ×5 | **Took master's new wording and ran the migration on it** — the owner's instruction exactly. Master still had it as legacy markup. Word-for-word clean in all five. |
| `SubscriptionTrialStarted` ×5 | **Accepted master's deletion** — it was split into `_Card`, `_PlanNoCard` and `_AiNoCard`. |

### Master's 19 new templates need no changes

Every one already composes from the shell: a status chip, a heading, two to four paragraphs, one brand-green
action and a footer note, in all five languages. None uses a `<br>` list that would want a fact table.
Restyling them into the richer vocabulary would be rewriting another session's just-shipped copy layout for
no gain, so they are left exactly as written. They differ from the migrated ones in one visible way — their
support line sits inside the card (`FooterNote`) rather than under it (`Footer.Lines`) — and that is a copy
placement decision, not a defect.

### Proof the rebase lost nothing

| Check | Scope | Result |
|---|---|---|
| Visible words, placeholders (per destination) and link targets: **branch vs master** | **605 files** | **0 unexplained differences** |
| Placeholder parity across the five languages | 121 templates | **identical per file** |
| Responsive rules, viewport, brand font, 600px column, declared language | **600 rendered emails** | all present on every one |
| Fixed pixel width anywhere (would stop it reflowing) | 600 rendered emails | **none** |
| Estate sweep: file sets, names, subjects, half-CTAs, stray control flow, markup in a subject | 605 files | **nothing found** |
| Localization keys vs master | 5 files | **+1 (mine), 0 removed, 0 changed** |
| The three dead templates, re-checked against master's much larger code | 9 repos | **still referenced nowhere** |

‼️ The browser pane was not available in this session, so the 375px/320px **visual** sweep of round 1 could
not be repeated for master's new templates. Their responsiveness rests on the assertions above, run over
every rendered email — not on a fresh look. Said plainly rather than implied.

## 9. What was deliberately NOT done

| Item | Why |
|---|---|
| ~~Promote the Subject into a heading~~ | **DONE** in round 2 at the owner's request — see §8b. |
| ~~Complete the authored plain-text parts~~ | **DONE narrowly** in round 2 at the owner's request — see §8b. |
| Repoint the WhatsApp AI billing buttons | The URL is static and registered at Meta; code cannot change it — `PLAN.md` O3. |
| Remove `Email:LogoUrlOnDark` | Still read by `TemplateService`, so not an orphan by §4's own words; removing it is ARM and `deploy.ps1` churn across six regions — `PLAN.md` O5. |
| ~~Make `BookingRejection`'s Reason row conditional~~ | **DONE** in round 2 at the owner's request — see §8b. |

## 10. Tree left clean

`git status --porcelain` in all four worktrees: **empty**. Every scratch artefact — the migration tool, the
verifiers, the render harness, the static server, the snapshots and the exported originals — lives in the session
scratchpad and never inside a repo (§0.16). The only files written outside a repo are this audit, `PLAN.md`,
`Data/mockups/email-shell/index.html` and its row in `Data/mockups/REGISTER.md`.
