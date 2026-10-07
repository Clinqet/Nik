# Clinket localization glossary — fr · es · hi · gu (2026-09-25)

The one reference for words customers and providers read: emails, notifications, and the web and phone screens.
Created for the billing and email translation pass (`Data/topup-engine-rules/FOLLOWUPS-PLAN.md`, work item F). When a
screen already uses a correct term, keep it. When this table and a screen disagree, this table wins and the screen is
wrong.

## Voice

| | Register | Notes |
|---|---|---|
| **fr** | *vous*, always | Plain, warm, professional French. ‼️ **QUÉBEC punctuation, not France**: NO space before `? ! ;` (« Confirmer? »), and a space is KEPT before `:` (repo ruling R7 / audit U-35, guarded in the provider web suite). Never anglicisms where a common French word exists. |
| **es** | *tú*, always | The apps' majority voice. Never mix *usted* forms (su/sus/elija/actualice) with *tú* in one message. Opening `¿` `¡`. |
| **hi** | *आप*, always | Natural spoken Hindi in Devanagari. Common tech loanwords stay in Devanagari transliteration (below). Full stop `।`. |
| **gu** | *તમે*, always | Natural Gujarati. Loanwords as below, spelled one way only. Full stop `.` |

Brand: **Clinket** is never translated or transliterated. `{{CompanyName}}` is the brand token.

## Products and plans

| English | fr | es | hi | gu |
|---|---|---|---|---|
| AI Assistant | Assistant IA | Asistente de IA | AI असिस्टेंट | AI આસિસ્ટન્ટ |
| Clinket AI Assistant | Assistant IA Clinket | Asistente de IA de Clinket | Clinket AI असिस्टेंट | Clinket AI આસિસ્ટન્ટ |
| Clinket {plan} plan | forfait Clinket {plan} | plan Clinket {plan} | Clinket {plan} प्लान | Clinket {plan} પ્લાન |
| Free (plan) | Gratuit | Gratis | फ्री | ફ્રી |
| Premium (plan) | Premium | Premium | प्रीमियम | પ્રીમિયમ |
| Standard (AI engine) | Standard | Estándar | स्टैंडर्ड | સ્ટાન્ડર્ડ |
| Advanced (AI engine) | Avancé | Avanzado | एडवांस्ड | એડવાન્સ્ડ |

Plan names are proper names: capitalised, never "Prime"/"prima" (those mean *bonus*/*cousin*).
There are exactly two plans, Free and Premium (2026-10-04, `Data/two-plan-pricing/PLAN.md`). "Basic" and "Premium Max"
no longer exist — never use them in copy.

## Billing

| English | fr | es | hi | gu |
|---|---|---|---|---|
| billing page | page Facturation | página de Facturación | बिलिंग पेज | બિલિંગ પેજ |
| billing | facturation | facturación | बिलिंग | બિલિંગ |
| auto-recharge | recharge automatique | recarga automática | ऑटो-रिचार्ज | ઑટો-રિચાર્જ |
| auto-renewal | renouvellement automatique | renovación automática | ऑटो-रिन्यू | ઑટો-રિન્યૂ |
| minute pack | pack de minutes | paquete de minutos | मिनट पैक | મિનિટ પેક |
| top up (minutes) | ajouter des minutes / recharger | recargar minutos | मिनट टॉप-अप करें | મિનિટ ટોપ-અપ કરો |
| included minutes | minutes incluses | minutos incluidos | शामिल मिनट | સમાવિષ્ટ મિનિટ |
| free trial | essai gratuit | prueba gratuita | फ्री ट्रायल | ફ્રી ટ્રાયલ |
| payment method / card | moyen de paiement / carte | método de pago / tarjeta | भुगतान विधि / कार्ड | ચુકવણી પદ્ધતિ / કાર્ડ |
| Update card (button) | Mettre à jour la carte | Actualizar tarjeta | कार्ड अपडेट करें | કાર્ડ અપડેટ કરો |
| receipt | reçu | recibo | रसीद | રસીદ |
| charge / charged | débit / débité | cobro / cobrado | शुल्क / शुल्क लिया गया | ચાર્જ / ચાર્જ કરવામાં આવ્યો |
| refund | remboursement | reembolso | रिफ़ंड | રિફંડ |
| promo code | code promo | código promocional | प्रोमो कोड | પ્રોમો કોડ |

## Everyday product words

| English | fr | es | hi | gu |
|---|---|---|---|---|
| booking | réservation | reserva | बुकिंग | બુકિંગ |
| quote (a customer's request / a provider's price) | devis | cotización | कोटेशन | કોટેશન |
| Get quotes | Obtenir des devis | Obtener cotizaciones | कोटेशन पाएँ | કોટેશન મેળવો |
| lead (a provider's incoming request) | prospect | cliente potencial | लीड | લીડ |
| invoice | facture | factura | इनवॉइस | ઇન્વૉઇસ |
| review | avis | reseña | समीक्षा | સમીક્ષા |
| customer | client | cliente | ग्राहक | ગ્રાહક |
| service | service | servicio | सेवा | સેવા |
| message | message | mensaje | संदेश | સંદેશ |
| dashboard | tableau de bord | panel | डैशबोर्ड | ડેશબોર્ડ |
| provider / business | prestataire / entreprise | proveedor / negocio | सेवा प्रदाता / व्यवसाय | સેવા પ્રદાતા / વ્યવસાય |
| travel fee (the provider travels to you) | frais de déplacement | tarifa de desplazamiento | यात्रा शुल्क | મુસાફરી ફી |
| visit fee | frais de visite | tarifa de visita | विज़िट शुल्क | મુલાકાત ફી |

Never let an internal name reach a reader: a customer's quote request is never a "broadcast" (प्रसारण / બ્રોડકાસ્ટ).

## Email conventions

| | en | fr | es | hi | gu |
|---|---|---|---|---|---|
| Greeting | Hello {{FirstName}}, | Bonjour {{FirstName}}, | Hola, {{FirstName}}: | नमस्ते {{FirstName}}, | નમસ્તે {{FirstName}}, |
| Sign-off | Best Regards, / The {{CompanyName}} Team | Cordialement, / L'équipe {{CompanyName}} | Saludos cordiales, / El equipo de {{CompanyName}} | सादर, / {{CompanyName}} टीम | સાદર, / {{CompanyName}} ટીમ |
| Footer | © {{CurrentYear}} Clinket. All rights reserved. | © {{CurrentYear}} Clinket. Tous droits réservés. | © {{CurrentYear}} Clinket. Todos los derechos reservados. | © {{CurrentYear}} Clinket. सर्वाधिकार सुरक्षित। | © {{CurrentYear}} Clinket. સર્વાધિકાર સુરક્ષિત. |
| Billing help line | Questions about your bill? Contact us at {{SupportEmail}}. | Des questions sur votre facture ? Écrivez-nous à {{SupportEmail}}. | ¿Tienes preguntas sobre tu factura? Escríbenos a {{SupportEmail}}. | अपने बिल के बारे में कोई सवाल है? {{SupportEmail}} पर हमसे संपर्क करें। | તમારા બિલ વિશે કોઈ પ્રશ્ન છે? {{SupportEmail}} પર અમારો સંપર્ક કરો. |

## Rules that are not about words

- Links are never translated: an `href`, a path after `{{AppBaseUrl}}`, and any URL stay byte-identical to English.
- A `{{token}}` is a word in the sentence: spaces around it follow the language's grammar, never glued to a letter.
- Bold and link markup wrap the same meaning as in English, and there is a normal space outside them.
- `<html lang>` names the file's own language.
- ‼️ **es: "tarifa de desplazamiento", never "de traslado"** for the travel fee. *Traslado* is a transfer/transport and
  is the right word for a transport SERVICE CATEGORY — so both words live in the customer copy and mean different
  things. A 2026-09-27 sweep changed three of the six travel-fee strings and left one screen flow saying both;
  `servicePrice.test.ts` (customer app) caught it. One fee, one word, on every surface.
