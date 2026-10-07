// Clinket — Investor Overview (Word). Brand: Lufga, Navy #032858, Green #97EF29.
const fs = require("fs");
const {
  Document, Packer, Paragraph, TextRun, ImageRun, Table, TableRow, TableCell,
  WidthType, BorderStyle, ShadingType, AlignmentType, HeadingLevel, Header, Footer,
  PageNumber, TabStopType, LevelFormat, PageBreak, ExternalHyperlink, VerticalAlign,
  TableOfContents
} = require("docx");

const NAVY = "032858", GREEN = "97EF29", INK = "171717", GREY = "5F5F5F",
      BORDER = "E7E7E7", GWASH = "F4FFE4", GSTROKE = "D4F9A0", BLUE = "0869D4", IWASH = "F0F4FF";
const DIAG = "/sessions/determined-sharp-hopper/mnt/Nik/investor-pitch/diagrams/";
const OUT  = "/sessions/determined-sharp-hopper/mnt/Nik/investor-pitch/Clinket-Investor-Overview.docx";
const CONTENT_W = 9360; // letter, 1in margins

const img = (p) => fs.readFileSync(p);
const noB = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };

// ---------- text helpers ----------
const P = (text, o = {}) => new Paragraph({
  spacing: { after: o.after ?? 160, line: o.line ?? 300 },
  alignment: o.align, style: o.style,
  children: Array.isArray(text) ? text : [new TextRun({ text, font: o.font || "Lufga", size: o.size ?? 22, color: o.color ?? INK, bold: o.bold, italics: o.italics })],
});
const R = (text, o = {}) => new TextRun({ text, font: o.font || "Lufga", size: o.size ?? 22, color: o.color ?? INK, bold: o.bold, italics: o.italics, highlight: o.highlight });
const FILL = (what) => R(` [TO FILL: ${what}] `, { bold: true, color: NAVY, highlight: "yellow" });
const HL = (text) => new TextRun({ text, font: "Lufga", size: 22, bold: true, color: NAVY, shading: { type: ShadingType.CLEAR, fill: "E8FFC8" } });
const SRC = (n) => R(` [source ${n}]`, { size: 16, color: BLUE });

const H1 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 420, after: 60 },
  children: [new TextRun({ text: t, font: "Lufga", bold: true, size: 40, color: NAVY })],
  border: { bottom: { style: BorderStyle.SINGLE, size: 18, color: GREEN, space: 4 } } });
const H2 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 100 },
  children: [new TextRun({ text: t, font: "Lufga SemiBold", bold: true, size: 28, color: NAVY })] });
const H3 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_3, spacing: { before: 220, after: 80 },
  children: [new TextRun({ text: t, font: "Lufga Medium", bold: true, size: 24, color: NAVY })] });

const BULL = (runs, o = {}) => new Paragraph({
  numbering: { reference: "brand-bullets", level: 0 }, spacing: { after: o.after ?? 100, line: 300 },
  children: Array.isArray(runs) ? runs : [R(runs)],
});

// diagram figure: image + caption
const FIG = (file, hSrc, caption) => {
  const w = 624, h = Math.round(624 * hSrc / 1600);
  return [
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 160, after: 40 },
      children: [new ImageRun({ type: "png", data: img(DIAG + file), transformation: { width: w, height: h } })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 240 },
      children: [R(caption, { size: 18, color: GREY, italics: true })] }),
  ];
};

// screenshot placeholder box (easy to spot + replace)
const SHOT = (title, desc) => new Table({
  width: { size: CONTENT_W, type: WidthType.DXA }, columnWidths: [CONTENT_W],
  rows: [new TableRow({ children: [new TableCell({
    width: { size: CONTENT_W, type: WidthType.DXA },
    shading: { type: ShadingType.CLEAR, fill: GWASH },
    borders: { top: { style: BorderStyle.DASHED, size: 8, color: GSTROKE }, bottom: { style: BorderStyle.DASHED, size: 8, color: GSTROKE }, left: { style: BorderStyle.DASHED, size: 8, color: GSTROKE }, right: { style: BorderStyle.DASHED, size: 8, color: GSTROKE } },
    margins: { top: 160, bottom: 160, left: 200, right: 200 },
    children: [
      P([R("SCREENSHOT TO ADD — " + title, { bold: true, color: NAVY, size: 22 })], { after: 60 }),
      P([R(desc + "  (Delete this box and insert the image here: Insert → Pictures.)", { size: 19, color: GREY })], { after: 0 }),
    ] })] })],
});
const SPACER = () => new Paragraph({ spacing: { after: 200 }, children: [] });

// callout with green left bar
const CALLOUT = (runs) => new Table({
  width: { size: CONTENT_W, type: WidthType.DXA }, columnWidths: [CONTENT_W],
  rows: [new TableRow({ children: [new TableCell({
    width: { size: CONTENT_W, type: WidthType.DXA },
    shading: { type: ShadingType.CLEAR, fill: GWASH },
    borders: { top: noB, bottom: noB, right: noB, left: { style: BorderStyle.SINGLE, size: 24, color: GREEN } },
    margins: { top: 140, bottom: 140, left: 220, right: 200 },
    children: [P(runs, { after: 0 })] })] })],
});

const LINK = (text, url) => new ExternalHyperlink({ link: url,
  children: [new TextRun({ text, font: "Lufga", size: 22, color: BLUE, underline: {} })] });

// simple brand table
const TBL = (widths, headerCells, rows) => new Table({
  width: { size: CONTENT_W, type: WidthType.DXA }, columnWidths: widths,
  rows: [
    new TableRow({ tableHeader: true, children: headerCells.map((h, i) => new TableCell({
      width: { size: widths[i], type: WidthType.DXA },
      shading: { type: ShadingType.CLEAR, fill: NAVY },
      margins: { top: 90, bottom: 90, left: 140, right: 140 },
      borders: { top: noB, bottom: noB, left: noB, right: noB },
      children: [P([R(h, { bold: true, color: "FFFFFF", size: 20 })], { after: 0 })] })) }),
    ...rows.map((cells, ri) => new TableRow({ children: cells.map((c, i) => new TableCell({
      width: { size: widths[i], type: WidthType.DXA },
      shading: { type: ShadingType.CLEAR, fill: ri % 2 ? "FAFAFB" : "FFFFFF" },
      margins: { top: 80, bottom: 80, left: 140, right: 140 },
      borders: { top: { style: BorderStyle.SINGLE, size: 4, color: BORDER }, bottom: { style: BorderStyle.SINGLE, size: 4, color: BORDER }, left: noB, right: noB },
      verticalAlign: VerticalAlign.CENTER,
      children: [P(Array.isArray(c) ? c : [R(c, { size: 20 })], { after: 0, line: 260 })] })) })),
  ],
});

// ---------- header & footer ----------
const pageHeader = new Header({ children: [
  new Paragraph({
    tabStops: [{ type: TabStopType.RIGHT, position: CONTENT_W }],
    border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: GREEN, space: 6 } },
    spacing: { after: 120 },
    children: [
      new ImageRun({ type: "png", data: img("/sessions/determined-sharp-hopper/mnt/outputs/wordmark-navy.png"), transformation: { width: 125, height: 38 } }),
      new TextRun({ children: ["\t"], font: "Lufga" }),
      new TextRun({ text: "Investor Overview · Confidential", font: "Lufga", size: 18, color: GREY }),
    ] }),
] });
const pageFooter = new Footer({ children: [
  new Paragraph({
    tabStops: [{ type: TabStopType.RIGHT, position: CONTENT_W }],
    border: { top: { style: BorderStyle.SINGLE, size: 4, color: BORDER, space: 6 } },
    children: [
      new TextRun({ text: "Clinket — everything local, one platform", font: "Lufga Medium", size: 18, color: GREY }),
      new TextRun({ children: ["\t"], font: "Lufga" }),
      new TextRun({ children: ["Page ", PageNumber.CURRENT], font: "Lufga", size: 18, color: GREY }),
    ] }),
] });

// ---------- cover ----------
const cover = [
  new Paragraph({ spacing: { before: 1200, after: 300 }, alignment: AlignmentType.CENTER,
    children: [new ImageRun({ type: "png", data: img("/sessions/determined-sharp-hopper/mnt/outputs/wordmark-navy.png"), transformation: { width: 330, height: 99 } })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 120 },
    children: [new TextRun({ text: "Everything local. One platform.", font: "Lufga", bold: true, size: 72, color: NAVY })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 },
    children: [new TextRun({ text: "The marketplace, the business toolkit, and the AI receptionist", font: "Lufga", size: 30, color: INK })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 500 },
    children: [new TextRun({ text: "for the businesses that keep every neighbourhood running.", font: "Lufga", size: 30, color: INK })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 80 },
    children: [new TextRun({ text: "INVESTOR OVERVIEW", font: "Lufga SemiBold", bold: true, size: 24, color: NAVY })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 40 },
    children: [new TextRun({ text: "July 2026", font: "Lufga", size: 22, color: GREY })] }),
  new Paragraph({ alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: "Private & confidential — prepared for prospective investors and partners", font: "Lufga Light", size: 20, color: GREY })] }),
  new Paragraph({ children: [new PageBreak()] }),
];

// ---------- table of contents page ----------
const tocPage = [
  new Paragraph({ spacing: { before: 200, after: 60 },
    children: [new TextRun({ text: "Contents", font: "Lufga", bold: true, size: 40, color: NAVY })],
    border: { bottom: { style: BorderStyle.SINGLE, size: 18, color: GREEN, space: 4 } } }),
  new Paragraph({ spacing: { after: 200 },
    children: [new TextRun({ text: "Click any line to jump to it. (If Word asks to update fields when you open this file, say yes — that refreshes the page numbers.)", font: "Lufga", size: 19, color: GREY, italics: true })] }),
  new TableOfContents("Contents", { hyperlink: true, headingStyleRange: "1-2" }),
  new Paragraph({ children: [new PageBreak()] }),
];

// ============================================================ CONTENT
const body = [];

// ---- 1. Executive summary
body.push(H1("1. The opportunity in two minutes"));
body.push(P("Think of how Uber Eats brought every restaurant to your phone. Now think of everything else people need every week — the plumber, the hair stylist, the cleaner, the mechanic, the physiotherapist, the family selling the best homemade food in the neighbourhood. That entire world still runs on missed phone calls, paper notebooks and word of mouth. There is no winner serving it. Clinket is built to be that winner."));
body.push(P("Clinket is one platform with three ways in, and a business can use one, two, or all three:"));
body.push(BULL([R("A marketplace + e-commerce experience", { bold: true, color: NAVY }), R(" where customers find, compare, message, book, and pay for any local service — with "), HL("money held safely until the job is done"), R(".")]));
body.push(BULL([R("A free toolkit to run a business", { bold: true, color: NAVY }), R(" — bookings, quotes, invoices with payment links, a customer book, and a ready-made personal website. "), HL("Free of charge"), R(", even if the provider never touches the marketplace.")]));
body.push(BULL([R("An AI assistant and AI phone receptionist", { bold: true, color: NAVY }), R(" that "), HL("answers every missed call like a trained employee"), R(": it books appointments, creates quotes, remembers every caller, and reports back with a summary of what it did.")]));
body.push(P([R("Everything is "), HL("built, working, and approved"), R(": customer and provider web apps, customer and provider mobile apps approved by Apple and Google, an admin console, and a complete billing and subscription system — approved "), HL("without the app stores taking their usual 15–30% cut"), R(". The platform runs in Canada/US and India today, and an entire new country can be live in hours, not months.")]));
body.push(CALLOUT([R("What we're looking for: ", { bold: true, color: NAVY }), R("not a hand out — a hand up. The product is already built and paid for. We're looking for partners with marketing and sales expertise, the networks to open doors, and the fuel to make Clinket pop — in the city, the province, the country. Details in section 11.")]));

// ---- 2. Problem
body.push(H1("2. The problem — a huge industry still runs on missed calls"));
body.push(P([R("Local services are one of the biggest parts of the economy, and one of the last still stuck offline. In the US, services make up roughly 69% of all consumer spending."), SRC(2)]));
body.push(P([R("Homeowners alone spend about half a trillion dollars a year on home improvement and repair in the US — roughly $509 billion projected for 2025."), SRC(1), R(" And that is before cleaning, beauty, wellness, tutoring, food, equipment rental and every other everyday service Clinket covers. Yet even the market leader admits in its own annual report that its biggest competitor is ", { }), R("word of mouth", { italics: true }), R("."), SRC(5)]));
body.push(P("For the people providing these services, the day-to-day reality looks like this:"));
body.push(BULL("A one-person business cannot answer the phone while doing the job. Every missed call is potentially lost income — and often a customer lost to whoever picks up next."));
body.push(BULL([R("Hiring help at the front desk costs real money — the median US receptionist earns about $37,230 a year."), SRC(14), R(" A small salon, mechanic or dental office often simply cannot afford that.")]));
body.push(BULL([R("Missed connections are expensive everywhere: peer-reviewed research found that nearly 1 in 5 medical appointments are no-shows, at an average cost of about $196 per missed appointment."), SRC(15)]));
body.push(BULL([R("28% of US small businesses still have no website at all"), SRC(16), R(" — building one that takes bookings and payments is beyond most family businesses.")]));
body.push(P([R("So where do they go today? Many end up advertising services on Facebook Marketplace — a platform with over a billion monthly shoppers"), SRC(8), R(" that was never designed for services: no booking, no invoices, no reminders, no payment protection, contact details actively stripped out, ads that expire and must be reposted — and a documented trust problem (a UK bank study found about a third of Marketplace listings showed signs of scams)."), SRC(9), R(" People use it because there is no better option. That is the gap.")]));
body.push(SHOT("The problem in one picture (optional)", "If you have a photo of a busy provider (e.g., a mechanic under a car, salon at work), it lands well here."));
body.push(SPACER());

// ---- 3. What Clinket is
body.push(H1("3. What we built — one platform, three ways to win"));
body.push(P("Clinket serves both sides of every local service: the customer who needs something done, and the provider who does it. A provider can adopt Clinket at whatever depth suits them — list on the marketplace, just use the free business tools, or just hire the AI receptionist. Each pillar feeds the same shared platform, so every provider we win makes the whole network more valuable."));
body.push(...FIG("clinket-01-what-clinket-offers-three-pillars.png", 830, "Figure 1 — What Clinket offers: three pillars on one shared engine."));

body.push(H2("3.1 The marketplace + e-commerce — every service, one front door"));
body.push(P("For customers, Clinket feels as simple as a Google search: type what you need, and everything is on the first screen — providers nearby, honest ratings, photos of past work, and clear pricing (including whether tax is in the price). No digging through five levels of menus."));
body.push(P([R("From there, everything an Amazon customer takes for granted finally exists for services: chat, calls and voice notes with the provider (mirrored to WhatsApp if both sides prefer it, and encrypted); booking with live availability and reminders; optional online payment that is "), HL("held and only released when the job is completed"), R("; and refunds and support if something goes wrong. Cancellation is free until the job happens — no risk in committing early.")]));
body.push(P([R("Privacy is a feature, not a footnote: ", { bold: true, color: NAVY }), R("the customer decides if and when a provider sees their phone number or email. They can run the entire relationship through the app — or take it to a direct phone call the moment they choose.")]));
body.push(...FIG("clinket-02-how-a-customer-books-a-service.png", 700, "Figure 2 — How a customer books a service on Clinket."));
body.push(SHOT("Customer home page with search", "The customer web app landing page showing the Google-style search box and recommended services."));
body.push(SPACER());
body.push(SHOT("A provider profile as customers see it", "One provider page showing ratings, portfolio photos, prices and the Book button."));
body.push(SPACER());

body.push(H3("“Get Quotes” — the reverse marketplace that providers love"));
body.push(P("Sometimes a customer doesn't want to browse — they want offers to come to them. With Get Quotes, they describe the job once (type it, speak it, or add photos — the leaky tap, the car, the hair length) and Clinket's AI works out what kind of job it is and quietly shares it with the right nearby providers. Providers see a new lead, compete with their price and their portfolio, and the customer picks a winner. The customer's identity stays private until they decide otherwise."));
body.push(P("This is the fair version of the lead business: every relevant provider gets a chance (paid tiers see leads earlier, but nobody is starved), and providers compete on merit — ratings, past work and price — not on who paid the most for a stranger's phone number."));
body.push(...FIG("clinket-03-how-get-quotes-and-leads-work.png", 800, "Figure 3 — How “Get Quotes” works: one request becomes a private market of offers."));
body.push(SHOT("A lead as the provider sees it", "The provider Leads screen showing an incoming quote request with the bid box."));
body.push(SPACER());

body.push(H2("3.2 Free tools to run the business — the $0 back office"));
body.push(P("Plenty of providers don't want a marketplace — they already have customers. For them, Clinket is simply the software their business never had: bookings and a calendar, quotations, invoices with a pay-online link, and a customer book that builds itself. They can run offers and campaigns to their own customers. None of this requires the marketplace, and it is free."));
body.push(P([R("Every provider also gets a ready-made personal website", { bold: true, color: NAVY }), R(" — their services, photos, reviews and prices, with online booking built in and a QR code to share. For the 28% of small businesses with no website"), SRC(16), R(", this is their storefront on the internet, live on day one.")]));
body.push(P("Why give it away? Because it is the on-ramp. Every business running its day on Clinket is a business whose bookings, invoices and customers live on Clinket — and the natural next step is the marketplace, the analytics, and the AI receptionist."));
body.push(SHOT("Provider dashboard", "The partner app dashboard with bookings, leads and earnings in one view."));
body.push(SPACER());
body.push(SHOT("A provider's own website (Open Page)", "One provider's auto-generated public page with the booking button and QR share."));
body.push(SPACER());

body.push(H2("3.3 The AI assistant + AI receptionist — never miss a call again"));
body.push(P("This is the game-changer. Every provider on Clinket can turn on a dedicated business phone line with an AI receptionist behind it. Calls ring the owner first; if they're busy, or it's after hours — or whenever the owner prefers — the AI answers like a trained employee. It knows the whole business: every service, price, opening hour, and any standing instruction the owner types in plain language (“no pepperoni today” means no pepperoni today)."));
body.push(P([R("And it doesn't just talk — "), HL("it does the work"), R(". On the call, it books and reschedules real appointments (protected by a one-time security code), takes orders, creates quotations, sends confirmations by WhatsApp, text or email, and adds every caller to the customer book. The owner can watch the conversation live and take over mid-call, as smoothly as one colleague handing the phone to another. After every call: a two-line summary, the full transcript, and exactly what the AI did — ready to review and confirm.")]));
body.push(...FIG("clinket-04-how-the-ai-receptionist-answers-calls.png", 810, "Figure 4 — How the AI receptionist answers calls and actually gets work done."));
body.push(P("Because it is this flexible, it fits any business:"));
body.push(BULL([R("The pizza shop", { bold: true, color: NAVY }), R(" — a phone-order line that never rings out during the dinner rush.")]));
body.push(BULL([R("The dental office", { bold: true, color: NAVY }), R(" — bookings, cancellations and basic questions handled instantly, instead of 9-out-of-10 calls going unanswered and no-shows piling up.")]));
body.push(BULL([R("The one-person mechanic", { bold: true, color: NAVY }), R(" — under a car for three hours while the AI catches every job the flyers bring in.")]));
body.push(BULL([R("The equipment dealership", { bold: true, color: NAVY }), R(" — an AI salesperson that knows every machine's specification and can even look up what it doesn't know.")]));
body.push(P("Setup is self-serve and takes minutes, not days: upload a flyer, a menu, photos or even a handwritten description, and Clinket's AI reads it and builds the business profile automatically. The same AI helps everywhere in the product — writing, proof-reading and summarizing for people who never had a marketing department."));
body.push(SHOT("Call follow-ups screen", "The provider mobile app showing AI call summaries with the actions taken (booking created, customer added)."));
body.push(SPACER());
body.push(SHOT("Live transcript with Take Over button", "A call in progress with the live transcript streaming and the take-over control."));
body.push(SPACER());

body.push(H2("3.4 Smart analytics — Google-grade insight for main-street businesses"));
body.push(P("Underneath all three pillars, Clinket quietly collects what big tech collects — done with legal guidance, approved by Apple and Google, and privacy-protected by design. Around 50+ signals per interaction tell us what customers look for, what they click, what prices win in each area, and how quickly providers respond."));
body.push(P("Customers feel it as a homepage that learns what they like within minutes of use — like YouTube recommendations, but for services. Providers see it as answers to questions they could never afford to ask: How many people viewed my profile? What are people in my area searching for? Is my price high or low for my neighbourhood? And in the future, this same engine powers precision advertising (section 7) — the reason our data is a compounding asset."));
body.push(SHOT("Provider analytics screen", "The provider insights page showing profile visits, search trends and price benchmarks."));
body.push(SPACER());

// ---- 4. Who
body.push(H1("4. Who Clinket serves"));
body.push(P([R("Every provider, in every category. ", { bold: true, color: NAVY }), R("Clinket runs 300+ service categories and was deliberately built with no bias toward any one industry: the mother selling her famous biryani, the family making Portuguese tarts, the home salon, the part-time cleaner, the nurse and the physiotherapist, the carpool driver doing Niagara–Toronto every morning, the plumber, the electrician — up to equipment dealerships that sell and rent machines. If somebody serves somebody, Clinket fits them.")]));
body.push(P([R("Every customer with a to-do list. ", { bold: true, color: NAVY }), R("One app for every need, with the trust layer (ratings, protected payments, refunds) that makes trying a new provider feel safe.")]));
body.push(P([R("The market is enormous on both sides: ", { bold: true, color: NAVY }), R("34.8 million small businesses in the US"), SRC(12), R(" and about 1.1 million employer businesses in Canada (98% of them small)"), SRC(13), R(" — and every household around them. Clinket is live in Canada/US and India today, with the machinery to open any new country in hours (section 8).")]));

// ---- 5. Market
body.push(H1("5. The market — big, growing, and nobody owns it"));
body.push(P([R("The spend is already there. ", { bold: true, color: NAVY }), R("US homeowners spend roughly $500 billion a year on home improvement and repair alone (Harvard's Joint Center for Housing Studies puts 2025 at ~$509B)"), SRC(1), R(", services account for ~69% of US consumer spending"), SRC(2), R(", and in Canada renovation and repair support more residential-construction jobs than building new homes (57% of 1.2 million jobs)."), SRC(3)]));
body.push(P([R("The online shift is early and fast. ", { bold: true, color: NAVY }), R("Online on-demand home-services platforms are forecast to grow at 17–24% per year globally through 2030–2032"), SRC(4), R(" — services are moving online the way travel and food delivery did, and the platforms capturing that shift are still small compared to the underlying spend. That is the definition of early.")]));
body.push(P([R("The AI receptionist wave is just starting. ", { bold: true, color: NAVY }), R("The AI voice-agents market is projected to grow from $2.5 billion in 2025 to $35.2 billion by 2033 — a 39% yearly growth rate — with North America the largest region and inbound call handling the biggest slice."), SRC(10), R(" Clinket ships this today, bundled with the tools a business already runs on — not as a bolt-on gadget.")]));
body.push(TBL([3420, 3180, 2760],
  ["What we're capturing", "Verified size / growth", "Source"],
  [
    ["US home improvement & repair spend", [R("~$509B projected for 2025", { size: 20 })], [R("Harvard JCHS", { size: 19 }), SRC(1)]],
    ["Services share of US consumer spending", [R("~69% of all personal consumption", { size: 20 })], [R("US BEA / FRED", { size: 19 }), SRC(2)]],
    ["Canada residential construction", [R("CA$213.7B; 57% of its 1.2M jobs are renovation & repair", { size: 20 })], [R("CHBA / StatCan", { size: 19 }), SRC(3)]],
    ["Online on-demand home services (global)", [R("17–24% yearly growth forecast to 2030–32", { size: 20 })], [R("Grand View; VMR", { size: 19 }), SRC(4)]],
    ["AI voice agents (global)", [R("$2.5B (2025) → $35.2B (2033), 39%/yr", { size: 20 })], [R("Grand View Research", { size: 19 }), SRC(10)]],
    ["Small businesses to serve", [R("34.8M in the US; ~1.1M employer businesses in Canada", { size: 20 })], [R("SBA; ISED", { size: 19 }), SRC(12)]],
  ]));
body.push(P([R("A note on honesty with numbers: ", { bold: true, color: NAVY }), R("total consumer spend and online-platform revenue are different layers of the market — we cite both, labeled clearly, and every figure in this document links to its source in Appendix C. Nothing here is invented.", { italics: true })], { after: 240 }));

// ---- 6. Competition
body.push(H1("6. Competition — and why Clinket wins"));
body.push(P("No major player combines a services marketplace, free business software, and an AI receptionist. Each competitor holds one corner of the triangle — and against each one, Clinket has a clear edge:"));
body.push(TBL([2200, 3400, 3760],
  ["Who", "What they are", "Where Clinket wins"],
  [
    [[R("Angi / HomeAdvisor", { size: 20, bold: true, color: NAVY })],
     [R("The best-known US home-services name (500+ categories; owns HomeStars in Canada). Business model: pay-per-lead — pros pay whether or not they win the job.", { size: 20 })],
     [R("We never tax a provider's leads — even the free tier gets them. The lead-selling model is losing provider trust (the FTC fined HomeAdvisor $7.2M over lead quality, and demand has been shrinking for two years) — Clinket is built to win exactly the providers that model is losing.", { size: 20 }), SRC(5), SRC(6)]],
    [[R("Thumbtack / TaskRabbit", { size: 20, bold: true, color: NAVY })],
     [R("Growing US marketplaces ($400M revenue, +27% — Thumbtack). Proof the spend is moving online.", { size: 20 })],
     [R("They stop at matching. We add what makes providers stay: the free business toolkit, protected payments, an e-commerce checkout for services, and the AI receptionist — value no lead marketplace offers.", { size: 20 }), SRC(7)]],
    [[R("Facebook Marketplace / Kijiji", { size: 20, bold: true, color: NAVY })],
     [R("Where small providers actually advertise today (1B+ monthly shoppers) — with no booking, invoices, payments or reminders, and contact details blocked.", { size: 20 })],
     [R("We give that proven demand a real workflow: booking, invoices, reminders, protected payment and verified reviews. Providers advertising on Marketplace today are our most natural first users.", { size: 20 }), SRC(8)]],
    [[R("Uber Eats / DoorDash", { size: 20, bold: true, color: NAVY })],
     [R("Solved this exact problem — for restaurants only.", { size: 20 })],
     [R("The playbook is proven; nobody has run it beyond food. Clinket runs it for every local service — with lighter economics, because we don't own delivery fleets.", { size: 20 })]],
    [[R("Booking/CRM software (e.g. salon or clinic apps)", { size: 20, bold: true, color: NAVY })],
     [R("Single-industry tools with monthly fees; no marketplace bringing customers.", { size: 20 })],
     [R("Our toolkit is free, works for every industry, and comes with a marketplace that brings demand — software alone can't do that.", { size: 20 })]],
  ]));
body.push(P([R("Our structural advantages:", { bold: true, color: NAVY })], { after: 80 }));
body.push(BULL([R("We side with providers. ", { bold: true, color: NAVY }), R("No lead tax, no forced fees — providers keep their prices, their tax choices, their payment preferences and their customer relationships. We don't stand between businesses and their customers; we make the connection easier.")]));
body.push(BULL([R("A free acquisition engine. ", { bold: true, color: NAVY }), R("The $0 toolkit brings providers in the door — an acquisition channel every competitor has to charge for.")]));
body.push(BULL([R("A reason to join beyond the marketplace. ", { bold: true, color: NAVY }), R("The AI receptionist wins even the one-person shop that never wanted a marketplace at all.")]));
body.push(BULL([R("Data that compounds. ", { bold: true, color: NAVY }), R("Three pillars on one platform mean one company's data keeps compounding — three separate products can never combine what we see in one place.")]));
body.push(BULL([R("Trust built in. ", { bold: true, color: NAVY }), R("Protected payments, verified reviews and privacy controls make trying a stranger's business feel safe — the thing classifieds never solved.")], { after: 200 }));
body.push(CALLOUT([R("And none of them can follow where we're going. ", { bold: true, color: NAVY }), R("The financial layer we're building next (section 10) — financing at checkout, insurance at the point of service, and data-backed lending for providers — needs everything above already in place: the bookings, the payments, the verified history. Competitors would have to rebuild our whole platform before they could even start. That puts Clinket in a different league entirely.")]));
body.push(SPACER());

// ---- 7. Money
body.push(H1("7. How Clinket makes money"));
body.push(P("Revenue is already designed, built and approved in the product — this is not a monetization plan on a whiteboard."));
body.push(...FIG("clinket-05-how-clinket-makes-money.png", 800, "Figure 5 — Revenue engines live today, and the larger ones the same data unlocks next."));
body.push(H2("7.1 Live today: subscriptions"));
body.push(TBL([1760, 2560, 5040],
  ["Tier", "Who it's for", "What they get"],
  [
    [[R("Free", { size: 20, bold: true, color: NAVY })], [R("Every provider, day one", { size: 20 })], [R("Full toolkit and marketplace listing; can act on 5 leads a month — sees every lead, so upgrading is always tempting, never forced.", { size: 20 })]],
    [[R("Basic", { size: 20, bold: true, color: NAVY })], [R("Growing businesses", { size: 20 })], [R("More leads to act on (25/month), earlier lead delivery, more WhatsApp messaging.", { size: 20 })]],
    [[R("Premium", { size: 20, bold: true, color: NAVY })], [R("Serious operators", { size: 20 })], [R("100 leads a month with an earlier look at each one, deep analytics on their area — plus a featured banner: their business showcased on the customer app to nearby customers who are already looking for what they offer. Think of it as a digital billboard, shown only to the right audience.", { size: 20 })]],
    [[R("Premium Max", { size: 20, bold: true, color: NAVY })], [R("Market leaders", { size: 20 })], [R("Unlimited leads with the first look at every one, the full analytics suite, and top banner placement across the customer app in their area — the best billboard spot in the neighbourhood.", { size: 20 })]],
  ]));
body.push(P([R("The AI receptionist is its own subscription", { bold: true, color: NAVY }), R(", in two levels: "), R("Standard", { bold: true }), R(" for everyday businesses and "), R("Advanced", { bold: true }), R(" for those with more complex conversations. Usage works exactly like a mobile phone plan — a generous monthly allowance of AI minutes, then simple top-ups when a busy month runs long, with optional auto-recharge so the line never goes dark.")]));
body.push(P([R("Behind all of it runs a full promotions and loyalty engine — already built and live. ", { bold: true, color: NAVY }), R("From our admin console we can create free trials, personalized promo codes and targeted offers for any provider or customer — or a whole group at once — and deliver them by email and right inside the app, exactly the way Uber Eats and DoorDash surface offers. This is how we engage both sides: let a business try the AI receptionist free, feel it winning them work, and convert to a paid plan on their own — and keep customers coming back with offers they actually want.")]));
body.push(P([HL("Everything is completely self-serve"), R(" — signing up, subscribing, upgrading, topping up — as easy as ordering on Uber Eats, with no salesperson needed. And upgrades sell themselves the way ChatGPT's do: a provider reaches a limit at the exact moment they can see the value on the other side of it — one more lead, one more insight, a few more AI minutes — and one tap later, they're on the next plan.")]));
body.push(H2("7.2 What the same data unlocks next"));
body.push(P("Everything below is powered by data the platform is already collecting today — no new product to build, just a switch to flip when the audience is large enough."));
body.push(BULL([R("Precision B2B advertising — our future game-changer. ", { bold: true, color: NAVY }), R("A salon-supply wholesaler today buys scattershot ads hoping a salon owner happens to see one. We know exactly which providers are salons, where they are, and what they need. And it goes deeper: our analytics sees precisely where every provider and customer spends their attention — which screens, which pages, which placements get the most engagement — so every ad lands exactly where it will be seen, at the moment it's most relevant. Advertisers get conversion that broadcast advertising simply cannot buy; providers and customers see offers they actually want. Win-win-win.")]));
body.push(BULL([R("Clinket-branded services. ", { bold: true, color: NAVY }), R("The Kirkland / Amazon Basics play: where our data shows deep, reliable demand in an area, launch or lease out own-brand services and earn the operator margin, not just the platform fee.")]));
body.push(BULL([R("Selective transaction fees. ", { bold: true, color: NAVY }), R("A small commission only on categories we choose to enable it for — for example buy-and-sell (list a used appliance, like eBay) or delivery and fulfillment. Deliberately never a tax on every service booking: keeping the core frictionless is what wins the market.")]));
body.push(P("Any one of these can outgrow subscriptions — and at scale could let us make the core free, widening the moat further."));

// ---- 8. Technology
body.push(H1("8. Built to scale — without the usual bills"));
body.push(P([R("Clinket was designed and built end to end by its founder — one person. ", { bold: true, color: NAVY }), R("That one person carries experience from the heavy-equipment, financial, insurance, retail-loyalty and marketing industries: systems serving 20 million customers, organizations with billions in revenue, and regulated medical data. Clinket is built to that standard on Microsoft Azure — and you don't need to be technical to see what that makes possible, because it shows up directly in the economics:")]));
body.push(BULL([R("Scale without drama. ", { bold: true, color: NAVY }), R("Every layer scales automatically from zero to millions of users. No re-platforming moment, no growth cliff, no 2 a.m. heroics.")]));
body.push(BULL([R("Costs that stay tiny. ", { bold: true, color: NAVY }), R("The platform runs on hundreds of dollars a month, and scaling to a million users adds surprisingly little — modern cloud done right means our margins improve with growth.")]));
body.push(BULL([R("A new country in hours. ", { bold: true, color: NAVY }), R("The entire platform — every service, every setting — deploys to a new region with one automated run. Canada/US and India are live; Australia could be serving customers this afternoon, on local servers, at local speed.")]));
body.push(BULL([R("Local law, handled. ", { bold: true, color: NAVY }), R("Each region keeps its data in-country, uses local payment methods (cards and wallets in North America, UPI-style flows in India), and follows local telecom and privacy rules. When a privacy policy changes, the app itself asks users for consent and records it — no mass-email scramble.")]));
body.push(BULL([R("Security with nothing to steal. ", { bold: true, color: NAVY }), R("Inside the platform there are no usernames or passwords at all — every internal connection uses Microsoft's managed identity. A single guarded front door filters every request, blocks abusive traffic and countries we don't serve, and alerts us before customers notice anything.")]));
body.push(BULL([R("Modern sign-in for users. ", { bold: true, color: NAVY }), R("Passkeys and biometrics, social logins, phone/email one-time codes — every current standard, already built.")]));
body.push(...FIG("clinket-06-how-the-platform-scales-architecture.png", 1060, "Figure 6 — The platform at a glance: one guarded front door, self-scaling regional stamps, and AI services throughout. (For technical reviewers.)"));
body.push(P("For due-diligence teams, a plain-English map of how the product's building blocks connect:"));
body.push(...FIG("clinket-07-how-everything-connects-data-map.png", 850, "Figure 7 — How everything connects: the building blocks behind the product. Full technical documentation is available under NDA."));

// ---- 9. What exists today
body.push(H1("9. What exists today — not a deck, a product"));
body.push(P("Everything described in this document is built and working now:"));
body.push(BULL("Customer web app + customer mobile app (approved by Apple and Google)."));
body.push(BULL("Provider web app + provider mobile app (approved by Apple and Google)."));
body.push(BULL("Admin console with full oversight — we typically know about an issue before any user does."));
body.push(BULL([R("Complete billing and subscriptions: tiers, AI plans, minutes, top-ups, free trials and promo codes — "), HL("approved by the app stores without surrendering the usual 15–30% cut"), R(".")]));
body.push(BULL("The AI receptionist live on real phone numbers in North America and India, with a working demo (we loaded a heavy-equipment dealership's full inventory; the AI answers like their best salesperson)."));
body.push(BULL([R("Traction to date: "), FILL("providers onboarded, bookings completed, AI calls handled, GMV — add current numbers")]));
body.push(P([R("Try it yourself (development environment — the doors just aren't open to the public yet):", { bold: true, color: NAVY })]));
body.push(TBL([2600, 3560, 3200],
  ["What", "Where", "Note"],
  [
    [[R("Customer app", { size: 20, bold: true, color: NAVY })], [LINK("dev.clinket.com", "https://dev.clinket.com")], [R("Live dev environment", { size: 20 })]],
    [[R("Provider app", { size: 20, bold: true, color: NAVY })], [R("", { size: 20 }), FILL("confirm provider app URL")], [R("Live dev environment", { size: 20 })]],
    [[R("Admin console", { size: 20, bold: true, color: NAVY })], [LINK("admin.clinket.com", "https://admin.clinket.com")], [R("Walkthrough on request", { size: 20 })]],
    [[R("Mobile apps (iOS / Android)", { size: 20, bold: true, color: NAVY })], [R("Invite-only for now", { size: 20 })], [R("Approved by Apple & Google; share your Apple/Google ID and we'll invite you", { size: 20 })]],
    [[R("Live demo videos", { size: 20, bold: true, color: NAVY })], [R("", { size: 20 }), FILL("links to search, Get Quotes and AI-call recordings")], [R("Also linked from the slide deck", { size: 20 })]],
  ]));
body.push(P([R("Demo credentials are shared privately on request.", { italics: true, color: GREY, size: 20 })], { after: 240 }));

// ---- 10. Roadmap
body.push(H1("10. Where we're heading"));
body.push(P([R("Now — everything is live, and it already earns. ", { bold: true, color: NAVY }), R("All three pillars are running today, including the AI receptionist. Subscriptions, AI minutes, free trials and the promotions engine are in place and converting users to paid plans on their own. What's missing isn't product — it's "), HL("reach"), R(". The immediate plan is an all-out marketing and sales push across our three audiences — customers, providers, and businesses that just want the AI receptionist — city by city, then the province, then the country.")]));
body.push(P([R("Next — switch on the bigger engines. ", { bold: true, color: NAVY }), R("Once the audience is there, the revenue engines of section 7.2 turn on: the precision advertising marketplace built on our analytics, Clinket-branded services where demand data proves the market, and selective transaction categories. In the same phase, the AI assistant connects to businesses' own systems — opening Clinket to mid-size and complex companies — and providers run personalized campaigns to their own customer books.")]));
body.push(H2("10.1 The financial layer — a different league"));
body.push(P([R("This is where the plan gets interesting, and where nobody can follow us. Three moves — and in none of them do we carry a dollar of financial risk. Partners underwrite; we bring the customers, the trust and the data; we earn the commission.")]));
body.push(P([R("For customers:", { bold: true, color: NAVY })], { after: 80 }));
body.push(BULL([HL("Pay over time for the big jobs."), R(" A new driveway, a finished basement, concrete in the backyard — these run $1,000, $5,000, sometimes far more. Furniture stores solved this problem years ago: 0% financing at the checkout, carried by a financing partner. We bring the same option to services. Companies already built for exactly this — Wisetack in the US, Financeit in Canada, and household names like Affirm — carry the loan and the risk. The customer gets the job done now, the provider wins a bigger job, and Clinket earns a commission for making the match. Everybody wins.")]));
body.push(BULL([HL("Insurance, right where it's needed."), R(" Finished a renovation? Bought a machine? Booked a big job? We offer the right coverage at exactly that moment — underwritten entirely by insurance partners. One more thing handled in one place for the customer, and a clean commission for us, with zero risk on our books.")]));
body.push(P([R("For providers:", { bold: true, color: NAVY })], { after: 80 }));
body.push(BULL([HL("Loans a bank can't match."), R(" When a provider runs their business on Clinket, we see what no bank ever sees: their real earnings, verified, month after month — because the bookings and the online payments flow through us. A bank asks a small business for a mountain of paperwork and still guesses. With the provider's consent, we can share their verified track record with lending partners — and suddenly a loan, a line of credit, even a mortgage becomes a far smaller risk to write. Better terms for the provider, a safer loan for the lender, a healthy commission for us. Square and Shopify proved this works for shops and online stores; "), R("no one has built it for service providers", { bold: true }), R(". We will be first.")]));
body.push(H2("10.2 Then — Clinket becomes the one place for everything"));
body.push(P([R("Here is the end state we are building toward. You open one app, and your whole local life is in it. Book the plumber — and pay this month's mortgage. Order a cake from the family bakery down the street — and renew your transit pass. Settle the utility bill, the credit-card bill, the phone top-up, the toll charge — every payment, every booking, every everyday need, handled from the same place your services already live. And with the AI assistant at the centre, you don't even tap through menus: you say it, and it's done.")]));
body.push(P([R("Why do we believe one app can carry that much of daily life? Because it already happens — at national scale — just not here. "), R("WeChat carries the daily lives of 1.43 billion people in China", { bold: true }), SRC(17), R("; "), R("Paytm handles everyday commerce for 77 million monthly users and 49 million merchants in India", { bold: true }), SRC(18), R(". North America has no equivalent — "), HL("the seat is empty"), R(". And the platform best positioned to take it is the one that starts with weekly services: the plumber, the salon, the cleaner are the habits that bring people back, and payments deepen a habit that already exists. Every capability we add makes Clinket harder to leave — that is how an app stops being an app and becomes infrastructure. With WhatsApp at 2+ billion daily users worldwide"), SRC(19), R(", our WhatsApp-native messaging already meets people exactly where they are — and the AI that powers everything is itself a product we can monetize at every step.")]));

// ---- 11. Ask
body.push(H1("11. What we're looking for"));
body.push(P([R("Let's be clear about what this is — and what it isn't. ", { bold: true, color: NAVY }), R("This is not a Series A, and we are not raising money to build a product: "), HL("the product is built, approved and paid for"), R(". What we're looking for is the expertise, the networks and the fuel to take it to the world.")]));
body.push(BULL([R("Expertise first. ", { bold: true, color: NAVY }), R("People who have done marketing and sales at scale — who know how to make a platform pop in a city, a province, a country. Without that help we grow the slow way, city by city; with it, the timeline collapses.")]));
body.push(BULL([R("Networks. ", { bold: true, color: NAVY }), R("Introductions to the industry leaders, operators and communities where Clinket should be known — often that's worth more than the cheque.")]));
body.push(BULL([R("Capital as the accelerant. ", { bold: true, color: NAVY }), R("Any investment"), FILL("amount, if you choose to name one"), R("goes purely into marketing and sales — nothing else. The engineering is done and the platform runs itself.")]));
body.push(P([R("One more thing. The push that wins the services market is the same push that sets up everything in section 10 — the financial layer, and eventually the one place for everything. Whoever helps us win the neighbourhood is a partner in all of it.")]));
body.push(TBL([4680, 4680],
  ["Use of funds", "Share"],
  [
    [[R("Marketing & customer acquisition (three audiences)", { size: 20 })], [R("", { size: 20 }), FILL("%")]],
    [[R("Sales & provider onboarding teams", { size: 20 })], [R("", { size: 20 }), FILL("%")]],
    [[R("Market expansion (new regions)", { size: 20 })], [R("", { size: 20 }), FILL("%")]],
    [[R("Product & AI (compounding advantage)", { size: 20 })], [R("", { size: 20 }), FILL("%")]],
  ]));
body.push(P([R("Contact: "), FILL("founder name, title"), R(" · "), FILL("email"), R(" · "), FILL("phone")], { after: 240 }));

// ---- Appendices
body.push(new Paragraph({ children: [new PageBreak()] }));
body.push(H1("Appendix A — Figures in this document"));
[["Figure 1", "What Clinket offers — three pillars, one engine", "clinket-01-what-clinket-offers-three-pillars.png"],
 ["Figure 2", "How a customer books a service", "clinket-02-how-a-customer-books-a-service.png"],
 ["Figure 3", "How Get Quotes and leads work", "clinket-03-how-get-quotes-and-leads-work.png"],
 ["Figure 4", "How the AI receptionist answers calls", "clinket-04-how-the-ai-receptionist-answers-calls.png"],
 ["Figure 5", "How Clinket makes money", "clinket-05-how-clinket-makes-money.png"],
 ["Figure 6", "How the platform scales (architecture)", "clinket-06-how-the-platform-scales-architecture.png"],
 ["Figure 7", "How everything connects (data map)", "clinket-07-how-everything-connects-data-map.png"],
].forEach(([n, t, f]) => body.push(BULL([R(`${n} — ${t}. `, { bold: true, color: NAVY, size: 20 }), R(`File: investor-pitch/diagrams/${f} (an editable .svg with the same name sits next to it).`, { size: 20, color: GREY })])));
body.push(P([R("Every figure is also provided as a high-resolution image and an editable vector file, all named by what they show, in the ", { size: 20 }), R("investor-pitch/diagrams", { size: 20, bold: true }), R(" folder.", { size: 20 })]));

body.push(H1("Appendix B — Screenshots to insert before sending"));
[["Customer home page with search", "section 3.1"],
 ["A provider profile as customers see it", "section 3.1"],
 ["A lead as the provider sees it", "section 3.1"],
 ["Provider dashboard", "section 3.2"],
 ["A provider's own website (Open Page)", "section 3.2"],
 ["Call follow-ups screen", "section 3.3"],
 ["Live transcript with Take Over button", "section 3.3"],
 ["Provider analytics screen", "section 3.4"],
].forEach(([t, s]) => body.push(BULL([R(`${t} `, { bold: true, color: NAVY, size: 20 }), R(`— green dashed box in ${s}.`, { size: 20, color: GREY })])));

body.push(H1("Appendix C — Sources"));
const sources = [
  ["1", "Harvard Joint Center for Housing Studies — US remodeling market ~$509B (2025 projection)", "https://www.jchs.harvard.edu/benchmark-update-lifts-remodeling-market-size-projections"],
  ["2", "US Bureau of Economic Analysis via FRED — services ≈69% of personal consumption expenditures", "https://fred.stlouisfed.org/series/PCES"],
  ["3", "Canadian Home Builders' Association — CA$213.7B residential construction; 57% of 1.2M jobs from renovation & repair", "https://www.chba.ca/economic-impacts/"],
  ["4", "Grand View Research — online on-demand home services, 16.7% CAGR to 2030 (see also Verified Market Research: 23.7% CAGR to 2032)", "https://www.grandviewresearch.com/press-release/global-online-on-demand-home-services-market"],
  ["5", "Angi Inc. FY2025 Form 10-K (SEC) — revenue $1,358.7M (2023) → $1,030.5M (2025); ~23M → ~16M service requests; 500+ categories; pay-per-lead model; word-of-mouth cited as main competition", "https://www.sec.gov/Archives/edgar/data/1705110/000170511026000011/angi-20251231.htm"],
  ["6", "US Federal Trade Commission — final order against HomeAdvisor (Angi), up to $7.2M for deceptive lead marketing (April 2023)", "https://www.ftc.gov/news-events/news/press-releases/2023/04/ftc-approves-final-order-against-homeadvisor-inc-deceptively-marketing-its-leads-home-improvement"],
  ["7", "Fast Company (Apr 2025) — Thumbtack: $400M FY2024 revenue, +27% YoY, ~300,000 pros; TechCrunch (2021) — $3.2B valuation", "https://www.fastcompany.com/91311830/home-services-company-thumbtack-is-thriving-even-as-the-real-estate-market-stays-slow"],
  ["8", "Capital One Shopping Research — Facebook Marketplace: 1B+ monthly shoppers, ~250M sellers", "https://capitaloneshopping.com/research/facebook-marketplace-statistics/"],
  ["9", "TSB Bank (UK, 2024) — ~34% of Facebook Marketplace adverts show scam patterns", "https://www.tsb.co.uk/news-releases/urgent-consumer-warning-as-tsb-finds-over-a-third-of-adverts-on-facebook-marketplace-could-be-scams.html"],
  ["10", "Grand View Research (2026) — AI voice agents: $2.5B (2025) → $35.2B (2033), 39.0% CAGR; North America largest region", "https://www.grandviewresearch.com/industry-analysis/ai-voice-agents-market-report"],
  ["11", "MarketsandMarkets — conversational AI: $17.05B (2025) → $49.8B (2031), 19.6% CAGR", "https://www.marketsandmarkets.com/Market-Reports/conversational-ai-market-49043506.html"],
  ["12", "US SBA Office of Advocacy (2024) — 34,752,434 US small businesses (99.9% of all firms)", "https://advocacy.sba.gov/2024/07/23/frequently-asked-questions-about-small-business-2024/"],
  ["13", "ISED Canada, Key Small Business Statistics 2025 — 1.10M employer businesses; 98.2% small", "https://ised-isde.canada.ca/site/sme-research-statistics/en/key-small-business-statistics/key-small-business-statistics-2025"],
  ["14", "US Bureau of Labor Statistics, Occupational Outlook Handbook — receptionists: median $37,230/yr (May 2024); ~1.0M jobs", "https://www.bls.gov/ooh/office-and-administrative-support/receptionists.htm"],
  ["15", "Kheirkhah et al., BMC Health Services Research (peer-reviewed) — 18.8% average no-show rate; ~$196 average cost per unattended appointment", "https://bmchealthservres.biomedcentral.com/articles/10.1186/s12913-015-1243-z"],
  ["16", "Clutch small-business survey (fieldwork Dec 2020) — 28% of US small businesses have no website", "https://clutch.co/resources/online-presence-management"],
  ["17", "Tencent Q1 2026 earnings release — Weixin/WeChat combined MAU 1,432M", "https://static.www.tencent.com/uploads/2026/05/13/47382ae415a209fd161bc19a1f9b3704.pdf"],
  ["18", "One97 Communications (Paytm) Q4 FY2026 earnings release — 77M average monthly transacting users; 49M registered merchants", "https://paytm.com/document/ir/financial-results/fy2025-26/Paytm_Earning-Release-Q4-FY-2026.pdf"],
  ["19", "Meta Q4 2025 earnings call — “more than 2 billion daily actives” on WhatsApp", "https://s21.q4cdn.com/399680738/files/doc_financials/2025/q4/META-Q4-2025-Earnings-Call-Transcript.pdf"],
];
sources.forEach(([n, t, u]) => body.push(new Paragraph({
  spacing: { after: 120, line: 276 }, indent: { left: 360, hanging: 360 },
  children: [R(`${n}. `, { bold: true, color: NAVY, size: 20 }), R(t + " — ", { size: 20 }), LINK(u, u)],
})));
body.push(P([R("All sources verified July 2026. Where public estimates conflict or lack a primary source (e.g., the often-quoted “62% of small-business calls go unanswered” or “$150B no-show cost”), we deliberately excluded them and used verifiable figures instead.", { size: 19, color: GREY, italics: true })]));

// ============================================================ BUILD
const doc = new Document({
  creator: "Clinket",
  title: "Clinket — Investor Overview",
  features: { updateFields: true },
  styles: {
    default: { document: { run: { font: "Lufga", size: 22, color: INK } } },
  },
  numbering: { config: [{
    reference: "brand-bullets",
    levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT,
      style: { paragraph: { indent: { left: 460, hanging: 260 } }, run: { color: NAVY, bold: true } } }],
  }] },
  sections: [{
    properties: {
      page: { size: { width: 12240, height: 15840 }, margin: { top: 1200, bottom: 1100, left: 1440, right: 1440 } },
      titlePage: true,
    },
    headers: { default: pageHeader, first: new Header({ children: [] }) },
    footers: { default: pageFooter, first: new Footer({ children: [] }) },
    children: [...cover, ...tocPage, ...body],
  }],
});

Packer.toBuffer(doc).then((buf) => { fs.writeFileSync(OUT, buf); console.log("WROTE", OUT, buf.length, "bytes"); });
