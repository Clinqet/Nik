// Clinket — Investor Deck. Brand: Lufga, Navy 032858, Green 97EF29 (spark only).
const pptxgen = require("pptxgenjs");
const NAVY="032858", GREEN="97EF29", INK="171717", GREY="5F5F5F", BORDER="E7E7E7",
      GWASH="F4FFE4", GSTROKE="D4F9A0", BLUE="0869D4", IWASH="F0F4FF", CYAN="5BE7FF", BG="FAFAFB";
const OUTS="/sessions/determined-sharp-hopper/mnt/outputs/";
const DIAG="/sessions/determined-sharp-hopper/mnt/Nik/investor-pitch/diagrams/";
const OUT="/sessions/determined-sharp-hopper/mnt/Nik/investor-pitch/Clinket-Investor-Deck.pptx";
const W=10, H=5.625, M=0.5;

const p = new pptxgen();
p.layout = "LAYOUT_16x9";
p.author = "Clinket"; p.title = "Clinket — Investor Deck";

let pageNo = 0;
function content(title, kicker) {
  const s = p.addSlide(); pageNo++;
  s.background = { color: "FFFFFF" };
  if (kicker) s.addText(kicker.toUpperCase(), { x: M, y: 0.28, w: 9, h: 0.3, fontFace: "Lufga Medium", fontSize: 10.5, color: GREY, charSpacing: 2, margin: 0 });
  s.addText(title, { x: M, y: 0.52, w: 9, h: 0.55, fontFace: "Lufga", bold: true, fontSize: 25, color: NAVY, margin: 0 });
  s.addShape("rect", { x: M + 0.01, y: 1.12, w: 0.55, h: 0.045, fill: { color: GREEN } });
  // footer
  s.addImage({ path: "/sessions/determined-sharp-hopper/mnt/Nik/brand-kit/logos/png-icon/logo-96.png", x: M, y: H - 0.34, w: 0.19, h: 0.19 });
  s.addText("Clinket", { x: M + 0.24, y: H - 0.38, w: 1.2, h: 0.26, fontFace: "Lufga Medium", fontSize: 9, color: GREY, margin: 0 });
  s.addText(String(pageNo), { x: W - M - 0.6, y: H - 0.38, w: 0.6, h: 0.26, align: "right", fontFace: "Lufga", fontSize: 9, color: GREY, margin: 0 });
  s.addShape("line", { x: M, y: H - 0.42, w: W - 2 * M, h: 0, line: { color: BORDER, width: 0.75 } });
  return s;
}
function card(s, x, y, w, h, fill, lineColor) {
  s.addShape("roundRect", { x, y, w, h, rectRadius: 0.09, fill: { color: fill || "FFFFFF" }, line: { color: lineColor || BORDER, width: 1 } });
}
function shotBox(s, x, y, w, h, title, desc) {
  s.addShape("roundRect", { x, y, w, h, rectRadius: 0.09, fill: { color: GWASH }, line: { color: GSTROKE, width: 1.25, dashType: "dash" } });
  s.addText([
    { text: title + "\n", options: { fontFace: "Lufga SemiBold", bold: true, fontSize: 12, color: NAVY } },
    { text: desc, options: { fontFace: "Lufga", fontSize: 10, color: GREY } },
  ], { x: x + 0.18, y: y + 0.12, w: w - 0.36, h: h - 0.24, valign: "middle", margin: 0 });
}
function bullets(s, x, y, w, h, items, opt = {}) {
  s.addText(items.map((it, i) => ({
    text: (typeof it === "string" ? it : it.text),
    options: { bullet: { code: "2022", indent: 10 }, color: (typeof it === "string" ? INK : (it.color || INK)),
      bold: typeof it === "object" && it.bold, breakLine: true, paraSpaceAfter: opt.gap ?? 8 },
  })), { x, y, w, h, fontFace: "Lufga", fontSize: opt.size ?? 12.5, color: INK, valign: "top", margin: 0, lineSpacingMultiple: 1.12 });
}
function stat(s, x, y, w, big, label, src, bigColor) {
  s.addText(big, { x, y, w, h: 0.75, fontFace: "Lufga", bold: true, fontSize: 34, color: bigColor || NAVY, align: "center", margin: 0 });
  s.addText(label, { x, y: y + 0.78, w, h: 0.62, fontFace: "Lufga", fontSize: 10.5, color: INK, align: "center", margin: 0, lineSpacingMultiple: 1.05 });
  if (src) s.addText(src, { x, y: y + 1.38, w, h: 0.24, fontFace: "Lufga", fontSize: 8, color: GREY, align: "center", italic: true, margin: 0 });
}

// ================= 1. COVER =================
{
  const s = p.addSlide(); pageNo++;
  s.background = { path: OUTS + "bg-navy.png" };
  s.addImage({ path: OUTS + "wordmark-white.png", x: M, y: 0.5, w: 1.9, h: 0.57 });
  s.addText([
    { text: "Everything local.\n", options: { color: "FFFFFF" } },
    { text: "One ", options: { color: "FFFFFF" } },
    { text: "platform", options: { color: GREEN } },
    { text: ".", options: { color: "FFFFFF" } },
  ], { x: M, y: 1.9, w: 9, h: 1.7, fontFace: "Lufga", bold: true, fontSize: 44, margin: 0, lineSpacingMultiple: 1.02 });
  s.addShape("rect", { x: M + 0.02, y: 3.62, w: 0.8, h: 0.05, fill: { color: GREEN } });
  s.addText("The marketplace, the free business toolkit, and the AI receptionist\nfor the businesses that keep every neighbourhood running.",
    { x: M, y: 3.78, w: 8.5, h: 0.75, fontFace: "Lufga Light", fontSize: 15, color: "E6EEF8", margin: 0, lineSpacingMultiple: 1.15 });
  s.addText("Investor overview  ·  July 2026  ·  Private & confidential",
    { x: M, y: 5.05, w: 8, h: 0.3, fontFace: "Lufga Light", fontSize: 10.5, color: "AFC6DE", margin: 0 });
  s.addNotes("Open with the Uber Eats line: they solved this for restaurants — nobody has solved it for the other 95% of local services.");
}

// ================= 2. PROBLEM =================
{
  const s = content("A huge industry still runs on missed calls", "The problem");
  stat(s, 0.5, 1.55, 2.9, "69%", "of US consumer spending is services — the last big offline category", "US BEA / FRED", NAVY);
  stat(s, 3.55, 1.55, 2.9, "$509B", "a year spent on US home improvement & repair alone", "Harvard JCHS, 2025", NAVY);
  stat(s, 6.6, 1.55, 2.9, "$37,230", "median cost of one receptionist — the help small businesses can't afford", "US BLS, May 2024", NAVY);
  s.addShape("line", { x: 3.4, y: 1.75, w: 0, h: 1.6, line: { color: BORDER, width: 1 } });
  s.addShape("line", { x: 6.45, y: 1.75, w: 0, h: 1.6, line: { color: BORDER, width: 1 } });
  card(s, 0.5, 3.55, 9, 1.35, GWASH, GSTROKE);
  s.addText([
    { text: "Even the market leader admits it: ", options: { color: INK } },
    { text: "Angi's own annual report names its biggest competitor as “word of mouth and referrals.”  ", options: { color: NAVY, bold: true } },
    { text: "The customers are there. The providers are there. The platform that connects them properly isn't — yet.", options: { color: INK } },
  ], { x: 0.78, y: 3.72, w: 8.5, h: 1.05, fontFace: "Lufga", fontSize: 13.5, valign: "middle", margin: 0, lineSpacingMultiple: 1.2 });
  s.addNotes("Land the three numbers, then the Angi quote — the strongest proof the market is still offline.");
}

// ================= 3. BROKEN OPTIONS =================
{
  const s = content("What providers are stuck with today", "The problem");
  const cw = 2.93, gap = 0.11, y = 1.45, h = 3.45;
  const cols = [
    ["The missed call", [
      "One-person businesses can't answer while doing the job",
      "Nearly 1 in 5 medical appointments are no-shows — about $196 lost each time (peer-reviewed)",
      "Hiring front-desk help costs $37K+ a year",
    ], "Every missed call is lost income."],
    ["The wrong platforms", [
      "Facebook Marketplace: 1B+ monthly shoppers but no booking, payments or reminders — and contact details get blocked",
      "A UK bank study flagged ~1/3 of Marketplace listings as likely scams",
      "28% of US small businesses have no website at all",
    ], "Demand exists. The workflow doesn't."],
    ["The lead-sellers", [
      "Angi sells leads — providers pay whether or not they win the job",
      "Fined $7.2M by the FTC for misleading pros about lead quality",
      "Revenue down ~24% and service requests down ~30% in two years",
    ], "The old model taxes providers."],
  ];
  cols.forEach(([t, items, tag], i) => {
    const x = 0.5 + i * (cw + gap);
    card(s, x, y, cw, h);
    s.addText(t, { x: x + 0.2, y: y + 0.16, w: cw - 0.4, h: 0.35, fontFace: "Lufga SemiBold", bold: true, fontSize: 14.5, color: NAVY, margin: 0 });
    bullets(s, x + 0.22, y + 0.62, cw - 0.42, h - 1.15, items, { size: 10.5, gap: 7 });
    s.addText(tag, { x: x + 0.2, y: y + h - 0.5, w: cw - 0.4, h: 0.35, fontFace: "Lufga Medium", fontSize: 10, color: GREY, italic: true, margin: 0 });
  });
  s.addNotes("Sources: BMC Health Services Research; Capital One Shopping / TSB; Clutch; Angi 10-K; FTC April 2023.");
}

// ================= 4. THE ANSWER — 3 PILLARS =================
{
  const s = content("Clinket — one platform, three ways to win", "The answer");
  const cw = 2.93, gap = 0.11, y = 1.45, h = 3.1;
  const cols = [
    ["1", "Marketplace + e-commerce", CYAN, [
      "Search any service like Google — everything on one screen",
      "Chat, call, WhatsApp — privacy stays in the customer's hands",
      "Book & pay online; money held until the job is done",
      "Refunds and support built in, Amazon-style",
    ]],
    ["2", "Free tools to run the business", GREEN, [
      "Bookings, quotes, invoices with payment links — $0",
      "Their own customer book, built automatically",
      "A ready-made website with booking + QR code",
      "The on-ramp: every business can start today",
    ]],
    ["3", "AI assistant + receptionist", BLUE, [
      "Answers every missed call 24/7, like a trained employee",
      "Books appointments, takes orders, creates quotes — live",
      "Owner watches the transcript, takes over anytime",
      "Every call summarized with the actions it took",
    ]],
  ];
  cols.forEach(([n, t, acc, items], i) => {
    const x = 0.5 + i * (cw + gap);
    card(s, x, y, cw, h);
    s.addShape("rect", { x, y, w: cw, h: 0.07, fill: { color: acc } });
    s.addText(n, { x: x + 0.18, y: y + 0.2, w: 0.5, h: 0.5, fontFace: "Lufga", bold: true, fontSize: 22, color: NAVY, margin: 0 });
    s.addText(t, { x: x + 0.62, y: y + 0.2, w: cw - 0.8, h: 0.62, fontFace: "Lufga SemiBold", bold: true, fontSize: 13.5, color: NAVY, margin: 0, lineSpacingMultiple: 1.02 });
    bullets(s, x + 0.22, y + 0.95, cw - 0.42, h - 1.1, items, { size: 10.5, gap: 7 });
  });
  card(s, 0.5, 4.72, 9, 0.55, NAVY, NAVY);
  s.addText([
    { text: "One shared engine underneath:  ", options: { bold: true, color: "FFFFFF" } },
    { text: "AI matching · smart search · customer insights · payments · messaging · notifications", options: { color: "CADCFC" } },
  ], { x: 0.78, y: 4.76, w: 8.5, h: 0.47, fontFace: "Lufga", fontSize: 11.5, valign: "middle", margin: 0 });
  s.addNotes("A provider can adopt one pillar or all three — each one feeds the same data and network.");
}

// ================= 5. PILLAR 1 =================
{
  const s = content("The marketplace — every service, one front door", "Pillar 1 · live today");
  bullets(s, 0.5, 1.5, 4.5, 3.3, [
    { text: "As simple as a Google search — providers, honest ratings, photos of past work and clear tax-included pricing on the first screen", },
    { text: "Talk your way: chat, call, voice notes, attachments — mirrored to WhatsApp if both sides prefer it, and encrypted" },
    { text: "The customer decides when to share their phone or email — privacy is a feature", },
    { text: "Pay online, with money held until the job is done; free cancellation until then; refunds if it goes wrong" },
    { text: "Everything Amazon taught customers to expect — finally for services", bold: true, color: NAVY },
  ], { size: 12, gap: 10 });
  shotBox(s, 5.3, 1.5, 4.2, 2.35, "SCREENSHOT — customer app home + search", "Drop in the customer home page screenshot (search box + recommendations).");
  shotBox(s, 5.3, 4.0, 4.2, 1.12, "LIVE DEMO VIDEO — search to booking", "Paste the link to the recorded search→booking demo here.");
  s.addNotes("Demo flow: search 'keratin' → provider profile → book → pay. Under 60 seconds.");
}

// ================= 6. GET QUOTES DIAGRAM =================
{
  const s = content("How “Get Quotes” works", "Pillar 1 · the lead engine, done fairly");
  s.addImage({ path: DIAG + "clinket-03-how-get-quotes-and-leads-work.png", x: 0.95, y: 1.3, w: 8.1, h: 8.1 * 800 / 1600 });
  s.addNotes("Key line: providers compete on merit — ratings and price — not on who paid most for a stranger's phone number. Premium tiers see leads earlier; nobody is starved.");
}

// ================= 7. PILLAR 2 =================
{
  const s = content("The free toolkit — a $0 back office for every business", "Pillar 2 · live today");
  bullets(s, 0.5, 1.5, 4.5, 3.3, [
    "Bookings and calendar, quotations, invoices with pay-online links — everything a small business never had",
    "A customer book that builds itself — their customers, on or off Clinket",
    "A ready-made personal website with online booking and a QR code — live on day one",
    "Offers and campaigns to their own customer base",
    { text: "Free of charge. It's the on-ramp: businesses that run their day on Clinket grow into the marketplace, analytics and AI.", bold: true, color: NAVY },
  ], { size: 12, gap: 10 });
  shotBox(s, 5.3, 1.5, 4.2, 1.75, "SCREENSHOT — provider dashboard", "Bookings, leads and earnings in one view.");
  shotBox(s, 5.3, 3.4, 4.2, 1.75, "SCREENSHOT — a provider's own website", "One provider's public page with Book button + QR share.");
  s.addNotes("28% of US small businesses have no website (Clutch). We hand them one, free, with payments.");
}

// ================= 8. PILLAR 3 =================
{
  const s = content("The AI receptionist — never miss a call again", "Pillar 3 · live today, the game changer");
  bullets(s, 0.5, 1.5, 4.5, 3.4, [
    "A dedicated business line: rings the owner first, AI takes over on missed calls, after hours, or always — the owner chooses",
    "Knows the whole business and follows plain-language instructions — “no pepperoni today”",
    "Actually does the work: books and reschedules (one-time code protected), takes orders, creates quotes, sends WhatsApp/text/email confirmations",
    "Owner watches the live transcript and can take over mid-call",
    { text: "After every call: a two-line summary and exactly what the AI did — booking created, customer added, quote sent.", bold: true, color: NAVY },
  ], { size: 11.5, gap: 9 });
  shotBox(s, 5.3, 1.5, 4.2, 1.75, "SCREENSHOT — call follow-ups feed", "AI call summaries with actions taken.");
  shotBox(s, 5.3, 3.4, 4.2, 1.25, "LIVE DEMO VIDEO — a real AI call", "Paste the link to the recorded AI receptionist call.");
  s.addText("Fits any business: pizza line · dental desk · one-person mechanic · equipment dealership (live demo built)",
    { x: 5.3, y: 4.74, w: 4.2, h: 0.42, fontFace: "Lufga", fontSize: 9.5, color: GREY, italic: true, margin: 0, lineSpacingMultiple: 1.1 });
  s.addNotes("Setup is minutes: upload a flyer or menu and the AI builds the business profile itself.");
}

// ================= 9. AI FLOW DIAGRAM =================
{
  const s = content("How the AI receptionist handles a call", "Pillar 3 · under the hood, in plain English");
  s.addImage({ path: DIAG + "clinket-04-how-the-ai-receptionist-answers-calls.png", x: 1.3, y: 1.32, w: 7.4, h: 7.4 * 810 / 1600 });
  s.addNotes("Walk the flow left to right: rings owner → AI answers → does real work → owner reviews the follow-up feed.");
}

// ================= 10. ANALYTICS =================
{
  const s = content("The data engine — insight that compounds", "The compounding advantage");
  const cw = 4.45, y = 1.45;
  card(s, 0.5, y, cw, 2.0);
  s.addText("Customers feel it as magic", { x: 0.7, y: y + 0.15, w: cw - 0.4, h: 0.32, fontFace: "Lufga SemiBold", bold: true, fontSize: 13.5, color: NAVY, margin: 0 });
  s.addText("A homepage that learns what they like within minutes — recommendations like YouTube, but for services. Works with full privacy protection, approved by Apple and Google, built with legal guidance.",
    { x: 0.7, y: y + 0.52, w: cw - 0.4, h: 1.35, fontFace: "Lufga", fontSize: 11, color: INK, margin: 0, lineSpacingMultiple: 1.2 });
  card(s, 5.05, y, cw, 2.0);
  s.addText("Providers feel it as answers", { x: 5.25, y: y + 0.15, w: cw - 0.4, h: 0.32, fontFace: "Lufga SemiBold", bold: true, fontSize: 13.5, color: NAVY, margin: 0 });
  s.addText("Who viewed my profile? What is my area searching for? Is my price high or low for my neighbourhood? Deep insight sold with Premium tiers — insight they could never buy alone.",
    { x: 5.25, y: y + 0.52, w: cw - 0.4, h: 1.35, fontFace: "Lufga", fontSize: 11, color: INK, margin: 0, lineSpacingMultiple: 1.2 });
  card(s, 0.5, 3.65, 9, 1.5, IWASH, "D9E2F5");
  s.addText([
    { text: "50+ signals per interaction", options: { bold: true, color: NAVY, fontSize: 13.5 } },
    { text: " — what people search, click, book and pay across every category and neighbourhood. This is the asset that powers personalization today and precision B2B advertising tomorrow — and it compounds with every user.", options: { fontSize: 12, color: INK } },
  ], { x: 0.78, y: 3.8, w: 8.5, h: 1.2, fontFace: "Lufga", valign: "middle", margin: 0, lineSpacingMultiple: 1.25 });
  s.addNotes("Analytics is both a product feature (Premium tiers) and the moat for the future ad business.");
}

// ================= 11. MARKET =================
{
  const s = content("A market that's huge, shifting online, and unowned", "The market · every number sourced");
  stat(s, 0.5, 1.5, 2.9, "$509B", "US home improvement & repair spend alone (2025 proj.) — before beauty, cleaning, food, wellness…", "Harvard JCHS");
  stat(s, 3.55, 1.5, 2.9, "17–24%", "yearly growth of online on-demand home-services platforms through 2030–32", "Grand View Research; VMR");
  stat(s, 6.6, 1.5, 2.9, "39%/yr", "AI voice agents: $2.5B (2025) → $35.2B (2033); North America leads", "Grand View Research", BLUE);
  s.addShape("line", { x: 3.4, y: 1.7, w: 0, h: 1.7, line: { color: BORDER, width: 1 } });
  s.addShape("line", { x: 6.45, y: 1.7, w: 0, h: 1.7, line: { color: BORDER, width: 1 } });
  card(s, 0.5, 3.6, 9, 1.4, GWASH, GSTROKE);
  s.addText([
    { text: "34.8M small businesses in the US + 1.1M employer businesses in Canada", options: { bold: true, color: NAVY } },
    { text: " (SBA 2024; ISED 2025) — and every household around them. Clinket is live in Canada/US and India, and a new country can be live in hours. Full sources: Appendix + the investor overview document.", options: { color: INK } },
  ], { x: 0.78, y: 3.75, w: 8.5, h: 1.1, fontFace: "Lufga", fontSize: 12.5, valign: "middle", margin: 0, lineSpacingMultiple: 1.2 });
  s.addNotes("Be explicit that total spend vs platform revenue are different layers — we cite both honestly.");
}

// ================= 12. BUSINESS MODEL TODAY =================
{
  const s = content("How we make money — live in the product today", "Business model");
  const tiers = [
    ["Free", "Full toolkit + listing. Acts on 5 leads/mo — sees every lead, so upgrading tempts, never forces."],
    ["Basic", "More leads (25/mo), earlier lead delivery, more WhatsApp."],
    ["Premium", "100 leads/mo with an earlier look, deep analytics + a featured banner on the customer app — a digital billboard shown to nearby customers."],
    ["Premium Max", "Unlimited leads, first look at every one, full analytics, top banner placement — the best billboard spot in their area."],
  ];
  const cw = 2.17, gap = 0.105, y = 1.45, h = 2.05;
  tiers.forEach(([t, d], i) => {
    const x = 0.5 + i * (cw + gap);
    card(s, x, y, cw, h, i === 3 ? NAVY : "FFFFFF", i === 3 ? NAVY : BORDER);
    s.addText(t, { x: x + 0.16, y: y + 0.14, w: cw - 0.32, h: 0.34, fontFace: "Lufga SemiBold", bold: true, fontSize: 13, color: i === 3 ? GREEN : NAVY, margin: 0 });
    s.addText(d, { x: x + 0.16, y: y + 0.52, w: cw - 0.32, h: h - 0.66, fontFace: "Lufga", fontSize: 9.6, color: i === 3 ? "E6EEF8" : INK, margin: 0, lineSpacingMultiple: 1.12 });
  });
  card(s, 0.5, 3.72, 4.45, 1.38);
  s.addText([
    { text: "+ AI receptionist plans\n", options: { bold: true, color: NAVY, fontSize: 12.5 } },
    { text: "Standard & Advanced levels + AI minutes that work like a phone plan: allowance, top-ups, auto-recharge.", options: { fontSize: 10.5, color: INK } },
  ], { x: 0.7, y: 3.85, w: 4.05, h: 1.15, fontFace: "Lufga", margin: 0, lineSpacingMultiple: 1.15 });
  card(s, 5.05, 3.72, 4.45, 1.38);
  s.addText([
    { text: "+ Promotions & loyalty engine\n", options: { bold: true, color: NAVY, fontSize: 12.5 } },
    { text: "Free trials, personalized promo codes and targeted offers, in-app and by email — how users try it, love it, and convert to paid.", options: { fontSize: 10.5, color: INK } },
  ], { x: 5.25, y: 3.85, w: 4.05, h: 1.15, fontFace: "Lufga", margin: 0, lineSpacingMultiple: 1.15 });
  s.addNotes("Every limit is an upgrade moment; every upgrade is self-serve — the ChatGPT-subscription mechanic. Billing approved by Apple & Google WITHOUT the usual store cut.");
}

// ================= 13. FUTURE REVENUE =================
{
  const s = content("What the same data unlocks next", "Business model · future");
  const cols = [
    ["Precision B2B advertising", "A salon-supply wholesaler reaches exactly the salons in Hamilton — and our analytics knows which pages and placements each provider engages with most, so every ad lands where it's seen. Win-win-win."],
    ["Clinket-branded services", "The Kirkland / Amazon Basics play: where demand data proves a market, launch or lease out own-brand services and earn the operator margin."],
    ["Selective transaction fees", "A small fee only on categories we choose — e.g. buy-and-sell or delivery — deliberately never a tax on every service booking."],
  ];
  const cw = 2.93, gap = 0.11, y = 1.45, h = 2.5;
  cols.forEach(([t, d], i) => {
    const x = 0.5 + i * (cw + gap);
    card(s, x, y, cw, h);
    s.addShape("rect", { x, y, w: cw, h: 0.07, fill: { color: NAVY } });
    s.addText(t, { x: x + 0.2, y: y + 0.18, w: cw - 0.4, h: 0.6, fontFace: "Lufga SemiBold", bold: true, fontSize: 13, color: NAVY, margin: 0, lineSpacingMultiple: 1.05 });
    s.addText(d, { x: x + 0.2, y: y + 0.85, w: cw - 0.4, h: h - 1.0, fontFace: "Lufga", fontSize: 10.5, color: INK, margin: 0, lineSpacingMultiple: 1.18 });
  });
  card(s, 0.5, 4.15, 9, 1.0, NAVY, NAVY);
  s.addText([
    { text: "Any of these can outgrow subscriptions — ", options: { color: "FFFFFF", bold: true } },
    { text: "and at scale could make the core platform free, widening the moat further.", options: { color: "CADCFC" } },
  ], { x: 0.78, y: 4.25, w: 8.5, h: 0.8, fontFace: "Lufga", fontSize: 12.5, valign: "middle", margin: 0, lineSpacingMultiple: 1.15 });
  s.addNotes("Ad model: we know provider categories and behaviour — wholesale advertisers can't get this targeting anywhere else.");
}

// ================= 14. FINANCIAL LAYER =================
{
  const s = content("The financial layer — a different league", "Business model · where nobody can follow");
  const cols = [
    ["Pay over time, for customers", "A finished basement or new driveway runs $1,000–$5,000+ — and the deal often dies on the price. Furniture stores fixed this long ago: pay-over-time at checkout (often 0%), with a financing partner and its lenders carrying the funding and credit risk (think Wisetack, Financeit, Affirm). We bring it into services — and can share the financing revenue.", GREEN],
    ["Insurance at the point of service", "Just renovated? Bought equipment? We offer the right coverage at exactly that moment — underwritten entirely by insurance partners. Zero risk on our books; commission on every policy.", CYAN],
    ["We help providers get financing", "We see what no bank sees: verified earnings, month after month. Shared with the provider's consent, lending partners offer credit at far lower risk. We connect and earn a commission — partners lend. Square & Shopify proved it for shops; nobody has for services.", BLUE],
  ];
  const cw = 2.93, gap = 0.11, y = 1.45, h = 2.75;
  cols.forEach(([t, d, acc], i) => {
    const x = 0.5 + i * (cw + gap);
    card(s, x, y, cw, h);
    s.addShape("rect", { x, y, w: cw, h: 0.07, fill: { color: acc } });
    s.addText(t, { x: x + 0.2, y: y + 0.18, w: cw - 0.4, h: 0.62, fontFace: "Lufga SemiBold", bold: true, fontSize: 12.5, color: NAVY, margin: 0, lineSpacingMultiple: 1.05 });
    s.addText(d, { x: x + 0.2, y: y + 0.88, w: cw - 0.4, h: h - 1.05, fontFace: "Lufga", fontSize: 9.8, color: INK, margin: 0, lineSpacingMultiple: 1.15 });
  });
  card(s, 0.5, 4.4, 9, 0.75, GWASH, GSTROKE);
  s.addText([
    { text: "We take none of the lending risk — partners underwrite and fund; we can share the revenue. ", options: { bold: true, color: NAVY } },
    { text: "And it only works with our bookings, payments and history already in place: competitors would have to rebuild Clinket first.", options: { color: INK } },
  ], { x: 0.78, y: 4.48, w: 8.5, h: 0.6, fontFace: "Lufga", fontSize: 11, valign: "middle", margin: 0, lineSpacingMultiple: 1.12 });
  s.addNotes("This is the attract-anyone slide: embedded finance built on verified platform data. None of the marketplaces or lead-sellers can copy it without becoming us first.");
}

// ================= 15. COMPETITION =================
{
  const s = content("Nobody holds more than one corner of the triangle", "Competition");
  const rows = [
    ["Angi / HomeAdvisor", "Sells leads; pros pay win or lose. Revenue $1.36B → $1.03B in 2 yrs; requests −30%; $7.2M FTC fine over lead quality.", "We align with providers instead of taxing them"],
    ["Thumbtack / TaskRabbit", "Growing ($400M, +27%) — proof the shift is real. Still lead-selling; no toolkit, no AI receptionist, no service checkout.", "We monetize success, not attempts"],
    ["Facebook Marketplace", "Where providers actually are (1B+ monthly shoppers). No booking, payments, reminders; scam-prone; contact info blocked.", "We give that demand a real workflow"],
    ["Uber Eats / DoorDash", "Solved this exact problem — for restaurants only.", "We run the proven playbook for the other 95%"],
    ["Vertical booking software", "Single-industry tools with monthly fees; no marketplace bringing demand.", "Our toolkit is free — and works for every industry"],
  ];
  let y = 1.32;
  rows.forEach(([who, what, us], i) => {
    if (i > 0) s.addShape("line", { x: 0.5, y: y - 0.035, w: 9, h: 0, line: { color: BORDER, width: 0.75 } });
    s.addText(who, { x: 0.5, y, w: 2.05, h: 0.58, fontFace: "Lufga SemiBold", bold: true, fontSize: 10.5, color: NAVY, valign: "top", margin: 0, lineSpacingMultiple: 1.03 });
    s.addText(what, { x: 2.65, y, w: 4.55, h: 0.58, fontFace: "Lufga", fontSize: 9.4, color: INK, valign: "top", margin: 0, lineSpacingMultiple: 1.05 });
    s.addText(us, { x: 7.35, y, w: 2.15, h: 0.58, fontFace: "Lufga Medium", fontSize: 9.4, color: "2E7D0F", valign: "top", margin: 0, lineSpacingMultiple: 1.05 });
    y += 0.635;
  });
  card(s, 0.5, 4.5, 9, 0.62, NAVY, NAVY);
  s.addText([
    { text: "And the future moat: ", options: { bold: true, color: GREEN } },
    { text: "the financial layer only works on top of our bookings, payments and verified history — a rival would have to rebuild Clinket before they could even start.", options: { color: "FFFFFF" } },
  ], { x: 0.78, y: 4.5, w: 8.5, h: 0.62, fontFace: "Lufga", fontSize: 10.5, valign: "middle", margin: 0, lineSpacingMultiple: 1.08 });
  s.addText("Sources: Angi FY2025 10-K (SEC) · FTC Apr 2023 · Fast Company Apr 2025 · Capital One Shopping / TSB 2024",
    { x: 0.5, y: 5.16, w: 9, h: 0.2, fontFace: "Lufga", fontSize: 8, color: GREY, italic: true, margin: 0 });
  s.addNotes("The triangle: marketplace + free tools + AI receptionist. Each rival holds one corner; the combination is the moat — and the financial layer they just saw is uncopyable without our data.");
}

// ================= 16. EXISTS TODAY =================
{
  const s = content("Not a deck. A finished, approved product.", "Traction & proof");
  bullets(s, 0.5, 1.45, 4.6, 3.6, [
    { text: "4 apps live: customer + provider, web + mobile — approved by Apple and Google", bold: true, color: NAVY },
    "Admin console with full oversight — we know before users do",
    "Complete billing & subscriptions — approved without the usual 15–30% app-store cut",
    "AI receptionist live on real phone numbers in North America and India",
    "Multi-region: Canada/US + India running; a new country live in hours",
    { text: "Traction: [TO FILL — providers, bookings, AI calls, GMV]", color: "B00020", bold: true },
  ], { size: 11.5, gap: 9 });
  const rows = [
    ["Customer app", "dev.clinket.com"],
    ["Provider app", "[TO FILL: provider URL]"],
    ["Admin console", "admin.clinket.com"],
    ["Mobile apps", "Invite-only — share your Apple/Google ID"],
    ["Demo videos", "[TO FILL: links]"],
  ];
  card(s, 5.3, 1.45, 4.2, 3.0);
  s.addText("Try it yourself (dev environment)", { x: 5.5, y: 1.6, w: 3.8, h: 0.3, fontFace: "Lufga SemiBold", bold: true, fontSize: 12, color: NAVY, margin: 0 });
  let yy = 1.98;
  rows.forEach(([k, v]) => {
    s.addText(k, { x: 5.5, y: yy, w: 1.45, h: 0.42, fontFace: "Lufga Medium", fontSize: 10, color: GREY, margin: 0, valign: "top" });
    s.addText(v, { x: 6.95, y: yy, w: 2.45, h: 0.42, fontFace: "Lufga", fontSize: 10, color: v.startsWith("[") ? "B00020" : BLUE, margin: 0, valign: "top", lineSpacingMultiple: 1.05 });
    yy += 0.49;
  });
  s.addText("Demo credentials shared privately on request.", { x: 5.3, y: 4.6, w: 4.2, h: 0.3, fontFace: "Lufga", fontSize: 9, color: GREY, italic: true, margin: 0 });
  s.addNotes("Everything in this deck exists and runs today. The raise funds distribution, not construction.");
}

// ================= 17. TECHNOLOGY =================
{
  const s = content("Built to scale — without the usual bills", "Technology (plain English)");
  const cards = [
    ["0 → millions", "Every layer scales itself. No growth cliff, no re-platforming, no 2 a.m. heroics."],
    ["New country in hours", "One automated run deploys the whole platform to a new region — data kept in-country, local payments, local rules."],
    ["Hundreds, not millions", "Monthly infrastructure cost stays tiny as we grow — margins improve with scale."],
    ["Nothing to steal", "No usernames or passwords exist inside the platform — every internal connection uses managed identity. One guarded front door."],
  ];
  const cw = 4.45, ch = 1.62;
  cards.forEach(([t, d], i) => {
    const x = 0.5 + (i % 2) * 4.55, y = 1.45 + Math.floor(i / 2) * 1.77;
    card(s, x, y, cw, ch, i === 3 ? GWASH : "FFFFFF", i === 3 ? GSTROKE : BORDER);
    s.addText(t, { x: x + 0.2, y: y + 0.13, w: cw - 0.4, h: 0.42, fontFace: "Lufga", bold: true, fontSize: 16, color: NAVY, margin: 0 });
    s.addText(d, { x: x + 0.2, y: y + 0.58, w: cw - 0.4, h: ch - 0.72, fontFace: "Lufga", fontSize: 10.5, color: INK, margin: 0, lineSpacingMultiple: 1.15 });
  });
  s.addText("Designed and built end to end by the founder — one person, on Azure, with experience from 20M-customer systems to regulated medical data.",
    { x: 0.5, y: 4.94, w: 9, h: 0.24, fontFace: "Lufga", fontSize: 9.5, color: GREY, italic: true, margin: 0 });
  s.addNotes("For technical reviewers, point to the appendix architecture slide and offer the full docs under NDA.");
}

// ================= 18. ROADMAP =================
{
  const s = content("Where we're heading", "Roadmap");
  const steps = [
    ["NOW", "Win the neighbourhood", "Everything is live and earning — all three pillars incl. the AI receptionist, with trials and promos converting users to paid. The push: all-in marketing & sales, city → province → country.", GREEN],
    ["NEXT", "Switch on the bigger engines", "Precision B2B advertising on our analytics; Clinket-branded services where data proves demand; the financial layer — job financing, insurance, data-backed provider loans.", CYAN],
    ["THEN", "One place for everything", "Book the plumber — and pay the mortgage, the utility bill, the transit pass. The WeChat (1.43B) / Paytm playbook, with AI at the centre — North America's seat is empty.", BLUE],
  ];
  const cw = 2.93, gap = 0.11, y = 1.6, h = 3.2;
  steps.forEach(([k, t, d, acc], i) => {
    const x = 0.5 + i * (cw + gap);
    card(s, x, y, cw, h);
    s.addShape("rect", { x, y, w: cw, h: 0.07, fill: { color: acc } });
    s.addText(k, { x: x + 0.2, y: y + 0.16, w: cw - 0.4, h: 0.3, fontFace: "Lufga Medium", fontSize: 11, color: GREY, charSpacing: 3, margin: 0 });
    s.addText(t, { x: x + 0.2, y: y + 0.5, w: cw - 0.4, h: 0.65, fontFace: "Lufga SemiBold", bold: true, fontSize: 15.5, color: NAVY, margin: 0, lineSpacingMultiple: 1.02 });
    s.addText(d, { x: x + 0.2, y: y + 1.25, w: cw - 0.4, h: h - 1.45, fontFace: "Lufga", fontSize: 10.5, color: INK, margin: 0, lineSpacingMultiple: 1.18 });
  });
  s.addNotes("NOW: nothing left to build — reach is the constraint. THEN examples: mortgage, credit card, utilities, transit pass — one app, and the AI itself is monetizable at every step. Precedents: Tencent Q1 2026 (1.43B MAU); Paytm Q4 FY26 (77M MTU, 49M merchants); WhatsApp 2B+ daily actives (Meta).");
}

// ================= 19. THE ASK =================
{
  const s = p.addSlide(); pageNo++;
  s.background = { path: OUTS + "bg-navy.png" };
  s.addImage({ path: OUTS + "wordmark-white.png", x: M, y: 0.45, w: 1.55, h: 0.47 });
  s.addText("What we're looking for", { x: M, y: 1.25, w: 9, h: 0.7, fontFace: "Lufga", bold: true, fontSize: 34, color: "FFFFFF", margin: 0 });
  s.addShape("rect", { x: M + 0.02, y: 2.0, w: 0.7, h: 0.05, fill: { color: GREEN } });
  s.addText([
    { text: "Expertise, networks — and fuel. ", options: { color: GREEN, bold: true } },
    { text: "This is not a build-the-product raise: the product is built, approved and paid for.\nWe're looking for partners who know how to make a platform pop — city, province, country. Any investment ", options: { color: "E6EEF8" } },
    { text: "[TO FILL: amount, if named]", options: { color: GREEN, bold: true } },
    { text: " goes purely to marketing and sales.", options: { color: "E6EEF8" } },
  ], { x: M, y: 2.22, w: 9, h: 1.35, fontFace: "Lufga", fontSize: 13, margin: 0, lineSpacingMultiple: 1.22 });
  const uses = [
    ["Marketing & customer acquisition", "[%]"], ["Sales & provider onboarding", "[%]"],
    ["Market expansion", "[%]"], ["Product & AI", "[%]"],
  ];
  uses.forEach(([t, v], i) => {
    const x = 0.5 + i * 2.33;
    s.addShape("roundRect", { x, y: 3.72, w: 2.2, h: 0.95, rectRadius: 0.08, fill: { color: "0A3A78" }, line: { color: "0A4A8A", width: 1 } });
    s.addText(v, { x: x + 0.15, y: 3.79, w: 1.9, h: 0.38, fontFace: "Lufga", bold: true, fontSize: 16, color: GREEN, margin: 0 });
    s.addText(t, { x: x + 0.15, y: 4.15, w: 1.95, h: 0.48, fontFace: "Lufga", fontSize: 9.5, color: "CADCFC", margin: 0, lineSpacingMultiple: 1.05 });
  });
  s.addText("[TO FILL: founder name & title]  ·  [email]  ·  [phone]   —   full details in the Clinket Investor Overview document",
    { x: 0.5, y: 4.95, w: 9, h: 0.35, fontFace: "Lufga", fontSize: 11, color: "AFC6DE", margin: 0 });
  s.addNotes("Tone: we're not asking for a favour — we're offering a seat. Expertise and introductions often matter more than the cheque. The same push that wins services positions Clinket for the one-place-for-everything future — partners now are partners in that.");
}

// ================= 20. APPENDIX: ARCHITECTURE =================
{
  const s = content("Appendix — platform architecture", "For technical reviewers");
  s.addImage({ path: DIAG + "clinket-06-how-the-platform-scales-architecture.png", x: 2.15, y: 1.28, w: 5.7, h: 5.7 * 1060 / 1600 });
  s.addNotes("Full technical documentation, data model and security review available under NDA.");
}

// ================= 21. APPENDIX: BUILDING BLOCKS =================
{
  const s = content("Appendix — how everything connects", "For technical reviewers");
  s.addImage({ path: DIAG + "clinket-07-how-everything-connects-data-map.png", x: 1.5, y: 1.32, w: 7.0, h: 7.0 * 850 / 1600 });
  s.addNotes("Plain-English map of the product's building blocks; the production model is fully partitioned and indexed.");
}

// ================= 22. APPENDIX: SOURCES =================
{
  const s = content("Appendix — sources", "Every number in this deck is verifiable");
  const L = [
    "1. Harvard JCHS — US remodeling ~$509B (2025 proj.) · jchs.harvard.edu",
    "2. US BEA via FRED — services ≈69% of consumer spending · fred.stlouisfed.org/series/PCES",
    "3. CHBA — CA$213.7B; 57% of residential-construction jobs from renovation & repair · chba.ca/economic-impacts",
    "4. Grand View Research — online home services 16.7% CAGR; Verified Market Research — 23.7% CAGR · grandviewresearch.com · verifiedmarketresearch.com",
    "5. Angi Inc. FY2025 Form 10-K (SEC) — revenue & request declines; 500+ categories; lead model · sec.gov",
    "6. FTC (Apr 2023) — HomeAdvisor order, up to $7.2M · ftc.gov",
    "7. Fast Company (Apr 2025) — Thumbtack $400M, +27% · fastcompany.com",
    "8. Capital One Shopping — Facebook Marketplace 1B+ monthly shoppers · capitaloneshopping.com/research",
    "9. TSB Bank (2024) — ~34% of Marketplace ads show scam patterns · tsb.co.uk",
    "10. Grand View Research (2026) — AI voice agents $2.5B → $35.2B, 39% CAGR · grandviewresearch.com",
    "11. SBA (2024) — 34.75M US small businesses · advocacy.sba.gov",
    "12. ISED (2025) — 1.1M Canadian employer businesses, 98.2% small · ised-isde.canada.ca",
    "13. US BLS (May 2024) — receptionists median $37,230/yr · bls.gov",
    "14. Kheirkhah et al., BMC Health Services Research — 18.8% no-shows, ~$196 each · bmchealthservres.biomedcentral.com",
    "15. Clutch (2021) — 28% of US small businesses have no website · clutch.co",
    "16. Tencent Q1 2026 — WeChat 1,432M MAU · tencent.com  ·  Paytm Q4 FY26 — 77M MTU, 49M merchants · paytm.com",
    "17. Meta (Jan 2026) — WhatsApp 2B+ daily actives · Meta Q4 2025 earnings call",
  ];
  s.addText(L.slice(0, 9).map((t) => ({ text: t, options: { breakLine: true, paraSpaceAfter: 6 } })),
    { x: 0.5, y: 1.32, w: 4.45, h: 3.5, fontFace: "Lufga", fontSize: 8.6, color: INK, valign: "top", margin: 0, lineSpacingMultiple: 1.1 });
  s.addText(L.slice(9).map((t) => ({ text: t, options: { breakLine: true, paraSpaceAfter: 6 } })),
    { x: 5.15, y: 1.32, w: 4.35, h: 3.5, fontFace: "Lufga", fontSize: 8.6, color: INK, valign: "top", margin: 0, lineSpacingMultiple: 1.1 });
  s.addText("Clickable links for every source: Appendix C of the Clinket Investor Overview (Word document).",
    { x: 0.5, y: 4.9, w: 9, h: 0.26, fontFace: "Lufga Medium", fontSize: 10, color: NAVY, margin: 0 });
}

p.writeFile({ fileName: OUT }).then(() => console.log("WROTE", OUT));
