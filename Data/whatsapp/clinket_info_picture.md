# `clinket_info_picture` — the WhatsApp picture template (knowledge pictures, Phase B / P5)

> Tracked from [`README.md`](./README.md) in this folder, which is the ONE place that lists every Meta
> template still to be created. The feature that uses it is recorded in `C:\Nik\knowledge-image-extraction\`.

> Created 2026-08-25. **The `_v1` set is a PROOF, never a runtime template name** — the same discipline as
> `C:\Nik\Data\whatsapp\whatsapp-utility-recreation-plan.json` (`proofNamesAreNeverRuntimeTemplateNames`).

## Why a new template at all

`clinket_info_ready` declares `HEADER format: DOCUMENT`. A template's header format is **fixed at creation**;
at send time only a parameter of the declared type is accepted. Making it carry an image would mean EDITING
the template, which re-submits it for review — the exact 30-day trap. Verified against the live Canada WABA
on 2026-08-25, not from memory.

Carousel templates (several images in ONE message) are documented by Meta as **marketing-only**, so they
cannot carry a caller-requested transactional send. **One image per message is a platform constraint.**

## The wording

Header `IMAGE` · one body variable `{{1}}` = business name · footer reused verbatim from the already
UTILITY-approved `clinket_info_ready`. Written natively per language — not translated from the English.

‼️ Meta subcode **2388299**: a variable may not be the first or last element of the body. The first English,
French and Spanish drafts ended on `{{1}}.` and were refused; every locale now has `{{1}}` mid-sentence.

| Locale | Body | Footer |
|---|---|---|
| `en_US` | `Hi! Here is a picture from {{1}}, as you asked on your call.` | `Sent by Clinket at your request.` |
| `hi` | `नमस्ते! आपने {{1}} के साथ अपनी कॉल में जो तस्वीर माँगी थी, वह यह रही।` | `आपके कहने पर Clinket की ओर से भेजा गया।` |
| `gu` | `નમસ્તે! તમે {{1}} સાથેની તમારી કૉલમાં જે ફોટો માંગ્યો હતો, તે આ રહ્યો.` | `તમે માંગ્યું તેથી Clinket તરફથી મોકલેલ.` |
| `fr_CA` | `Bonjour ! Voici une photo de la part de {{1}}, comme demandé lors de votre appel.` | `Envoyé par Clinket à votre demande.` |
| `es` | `¡Hola! Aquí tienes una foto de parte de {{1}}, como lo pediste en tu llamada.` | `Enviado por Clinket porque lo pediste.` |

Body example value: `Sparkle Salon`. Header example: the Clinket app icon
(`clinqetwebpartnerapp/public/android-chrome-512x512.png`) uploaded through the app's resumable-upload
endpoint (app id `854679587689410`).

The line is deliberately ONE short sentence: up to four photos are four separate messages, and the longer
`clinket_info_ready` paragraph repeated four times reads as spam.

## The proof set — `clinket_info_picture_v1`, approved then DELETED 2026-08-25

Kept here as the audit trail: these ids no longer exist. They proved the wording earns UTILITY, and were
removed only after every production locale was verified live `APPROVED / UTILITY`.

Every submission used `category: "UTILITY"` with **`allow_category_change: false`**, so Meta refuses rather
than silently downgrading to MARKETING. Graph `v25.0`.

| WABA | Locale | Template id |
|---|---|---|
| Canada/US `1302322178177914` | `en_US` | `1367649162241693` |
| | `hi` | `1017041951290194` |
| | `gu` | `1107683968264921` |
| | `fr_CA` | `949957718146781` |
| | `es` | `2502618140205663` |
| India `2518598361929331` | `en_US` | `1076739978654425` |
| | `hi` | `1074105332144046` |
| | `gu` | `1490487076221292` |

India deliberately carries **only** `en_US`/`hi`/`gu` (owner's instruction; it mirrors how
`clinket_info_ready` is provisioned there).

## Status — COMPLETE (2026-08-25)

| Step | State |
|---|---|
| 1. Proof `clinket_info_picture_v1`, 8 locales | ✅ APPROVED / UTILITY — the wording earns the category |
| 2. Production `clinket_info_picture`, 8 locales | ✅ **APPROVED / UTILITY** on both WABAs |
| 3. Delete the 8 proofs | ✅ deleted, and absence VERIFIED by re-reading Meta |
| 4. `ApprovedLanguages` in the API **and** Functions appsettings | ✅ `[ "en", "es", "fr", "hi", "gu" ]`, identical in both (parity-tested) |

Production template ids:

| WABA | Locale | Id |
|---|---|---|
| Canada/US `1302322178177914` | `en_US` | `1589353039238790` |
| | `hi` | `1954395785252020` |
| | `gu` | `896619479900854` |
| | `fr_CA` | `1294953802597737` |
| | `es` | `1885285462877272` |
| India `2518598361929331` | `en_US` | `3014798852187716` |
| | `hi` | `2238017073656195` |
| | `gu` | `1618438526643124` |

‼️ India carries only `en_US`/`hi`/`gu`, while `ApprovedLanguages` lists all five — deliberately mirroring
`clinket_info_ready`. A French caller on the India stamp gets a template send Meta rejects, the picture
simply does not arrive, and the PDF still carries it. Fail-soft, and consistent with the sibling.

**The picture leg is now fully wired but still DARK**: nothing sends until
`Voice:Knowledge:Images:Enabled` is turned on. Approving the template did not enable the feature.

## Runtime contract

- `WhatsAppTemplateNames.InfoPicture` = `clinket_info_picture`; config key `ImageLinkKey` = `pictureUrl`,
  body param `businessName`.
- Inside an open 24h window the picture goes as a FREE-FORM image message instead (kind `SessionImage`) —
  same picture, same sentence, no billed message.
- Caps live in `Voice:Knowledge:Images`: `MaxImagesPerSend` (pictures in the document) and
  `MaxWhatsAppImageMessages` (of those, how many also arrive as chat photos).

## The other outstanding template job

The four Utility recreations are Job 2 in [`README.md`](./README.md) — attempted again on 2026-08-25 and
still refused by Meta (subcode 2388025, 36–37 hours left). Nothing was changed.
