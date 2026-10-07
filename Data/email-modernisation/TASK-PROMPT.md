# TASK — Modernise every email template behind one shared shell

> **Start a fresh session and point it at this file.** This task is independent of the AI Assistant number
> lifecycle programme (`Data/voice-number-lifecycle/`), which builds its own voice email templates on the
> shell this task creates. If that programme has already landed the shell, reuse it — do not write a second one.

Owner decision, 2026-10-01: **scope B — all templates, not just the billing ones.** Split out of the number
lifecycle programme so neither task's diff becomes unreviewable.

---

## 1. The problem, measured

Counted across all five language folders in `clinqetinfrastructure/Resources/EmailTemplates/`:

| | Files |
|---|---|
| Total template files (107 templates x 5 languages) | **535** |
| Responsive (contain an `@media` query) | **80** |
| **NOT responsive — broken on a phone** | **455 (85%)** |

There is **no shared layout**. `clinqetinfrastructure/Services/Language/TemplateService.cs` only substitutes
tokens; every template is a standalone HTML document. That is why the estate has drifted into **three
generations**:

| Generation | Which | Responsive | Brand font |
|---|---|---|---|
| **Modern** | 10 files — `SubscriptionTrialEnded_Plan`, `SubscriptionTrialEndingSoon`, `SubscriptionTrialEndingSoon_PlanNoCard`, `SunsetAnnouncement`, `SunsetCutoverSoon`, `SunsetCutoverTomorrow`, `SunsetTrialStarted`, `PasswordChangedEmail`, `PasswordSetEmail`, `RefundProcessed` | yes | `'Lufga'` on 7 of them |
| **Responsive, off-brand** | the 9 voice `.html` templates (`VoiceAssistant*.html`) — tables + `@media`, but Arial | yes | no |
| **Legacy** | **91 templates** — a bare `max-width:600px` `<div>`, `font-family: Arial`, no media query | **no** | no |

Brand colours are already consistent and correct throughout: `#032858` navy ink, `#97EF29` brand green.
**The problem is layout and font, not colour.**

Concretely: `SubscriptionTrialEnded_Plan` is modern and responsive; its direct sibling
`SubscriptionTrialEnded_Ai` is a legacy div with Arial and no media query. Same family, same moment, two
different designs, and the AI half does not work on a phone.

---

## 1b. ‼️ THE SHELL ALREADY EXISTS — REUSE IT, DO NOT WRITE A SECOND ONE

Built by the number-lifecycle programme on 2026-10-01:

- `clinqetshared/Rendering/EmailShell.cs` — public, pure, thread-safe, source-generated regex.
- `clinqetshared/Models/EmailTemplate.cs` — a template declares EITHER `HtmlContent` (its own full document)
  OR `Content` (Preheader · Pill · Heading · Paragraphs · CtaText · CtaHref · FooterNote).
- `clinqetinfrastructure/Services/Language/TemplateService.cs` composes shell + content **once at load**.
- 25 live examples to copy: the five `Voice*` templates in each of the five language folders.
- A guard already enforces the contract: `EmailTemplateContentConventionTests` fails a template that declares
  both forms, or a `Content` one missing a heading, paragraphs, or half a CTA pair.

**Your job is to MIGRATE the remaining templates onto it, not to design it.**

## 2. What to build — migrate onto the shell, NOT 535 copy-pastes

‼️ **Do not copy table scaffolding into template files.** That is precisely what produced three generations
and it will produce a fourth. The fix is one shell in `TemplateService`, with each template carrying only its
own content.

### The shell contract (take the exact values from `en/SubscriptionTrialEnded_Plan.json`, the house reference)

- `<!DOCTYPE html>`, `<html lang>`, `<meta charset>`, `<meta name="viewport" content="width=device-width, initial-scale=1.0">`,
  `color-scheme` / `supported-color-schemes` = light
- Font stack: `'Lufga', 'Segoe UI', Arial, Helvetica, sans-serif` on `body, table, td, a`
- `@media only screen and (max-width: 480px)`: `.px` padding to 20px, `.hero-title` to 24px/32px,
  `.cta a` to `display:block` (full-width button), `.canvas` padding to 16px/10px
- Hidden preheader `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">`
- Outer canvas `#F4F6F8`; inner card `max-width:600px`, `#ffffff`, `border-radius:16px`, `1px solid #E7E7E7`
- `<table role="presentation">` nesting throughout (Outlook ignores div-based layout)
- Logo `{{LogoUrlOnLight}}` at 156x40
- Optional status pill: `#F0FFE1` background, `#2F7D00` text, uppercase, `border-radius:999px`
- `h1` `#032858`, 28px/36px; body text `#333333`, 16px/26px
- CTA: `#97EF29` background, `#032858` text (owner mandate: brand green for the chosen action)

### Mechanism

Give each template a content-only form (heading, optional pill, paragraphs, CTA text + href, optional footer
note) and have `TemplateService` compose shell + content. Keep token substitution exactly as it is — the
shell must not change how `{{Tokens}}` resolve. Decide the content format by reading the existing templates
first; do not invent a format that cannot express what they already say.

---

## 3. Rules

1. ‼️ **Every template, all five languages.** `en` `es` `fr` `gu` `hi`. A template modernised in English only
   is a regression for four languages.
2. ‼️ **Never change the words.** This task changes layout, font and structure — not copy. If wording looks
   wrong, write it down for the owner; do not fix it here.
3. ‼️ **Delete what is unused.** Grep every template name against the whole solution. A template file nothing
   produces is dead — delete it in all five languages and say which ones in the summary. Clean coding only.
4. **Prove responsiveness, do not assert it.** Render representative templates at 375px and at desktop width
   and look. A media query that exists but does not change anything is not responsiveness.
5. **Plain-text parts stay in step.** `PlainTextContent` must still match what the HTML says.
6. Every rule in `CLAUDE.md` applies, in particular **§0.14** (no narrating comments), **§0.16** (leave the
   tree clean), **§0.19** (never `git checkout --` / `restore` / `reset` / `stash` / `clean` — other sessions
   work uncommitted in these repos) and **§0.21** (linear history, never a merge commit).
7. Run the affected test suites to green before reporting done.

---

## 4. Known defects to fix while in here

- **Route mismatch.** The WhatsApp buttons point at `partner.clinket.com/dashboard/billing`; the AI billing
  emails point at `{{AppBaseUrl}}/dashboard/ai-billing`. Both routes exist in `clinqetwebpartnerapp`. Settle
  which is correct for each message and make the two channels agree.
- **The 9 voice `.html` templates are off-brand** — they are responsive but use Arial. Bring them onto the
  shell and the `'Lufga'` stack.

## 5. Out of scope

- The AI Assistant number lifecycle's own email templates (`VoiceNumberHeld`, `VoiceNumberKept`,
  `VoiceNumberBeingArranged`, `VoiceForwardingNumberChanged`, `VoiceForwardingChangeDeclined`) — the number
  lifecycle programme owns those and builds them on this shell.
- Any WhatsApp template. That work is complete; see `Data/voice-number-lifecycle/WHATSAPP-TEMPLATES.md`.
- Wording changes of any kind.

## 5b. ‼️ MULTIDIMENSIONAL AUDIT — A GATE, NOT A REPORT

Before you call this done, audit your own work and FIX EVERY FINDING IN THE SAME SESSION. Write it to
`Data/email-modernisation/AUDIT.md`. Cover, and state what you VERIFIED versus what you assumed:

- **Correctness:** every template still says exactly what it said before — this task changes layout, never words.
- **Security:** no token interpolated as markup. `TemplateService.ForHtml` encodes by TYPE; only a declared
  `HtmlFragment` passes through. A business name or a customer message must never be able to inject.
- **Responsiveness:** proven by RENDERING at 375px and desktop, not by the presence of a media query. A media
  query that changes nothing is not responsiveness.
- **Every language:** Hindi and Gujarati are LONGER than English and will overflow a fixed-width button.
- **Performance / memory:** composition stays at load, never per send; no per-call regex construction; no
  unbounded string building.
- **Deployment:** templates ship with the host; nothing references a file you deleted.
- **Tests:** suites green, lint zero errors, no skipped or empty-scan tests.
- **Dead templates:** list every one you deleted, in all five languages.

## 6. Done means

- 107 templates x 5 languages all composing from the one shell, every one responsive at 375px.
- Zero templates still carrying their own `<table>` scaffolding or `font-family: Arial`.
- Dead templates deleted in all five languages and named in the summary.
- The route mismatch resolved.
- Affected suites green; `git status --porcelain` clean of scratch files.
