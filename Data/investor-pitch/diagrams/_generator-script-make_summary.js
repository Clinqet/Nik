// Clinket — Executive Summary (2 pages, founder voice). Brand: Lufga / Navy / Green.
const fs = require("fs");
const {
  Document, Packer, Paragraph, TextRun, ImageRun, BorderStyle, ShadingType,
  AlignmentType, Header, Footer, PageNumber, TabStopType, LevelFormat, Table,
  TableRow, TableCell, WidthType, VerticalAlign
} = require("docx");

const NAVY = "032858", GREEN = "97EF29", INK = "171717", GREY = "5F5F5F", BORDER = "E7E7E7", GWASH = "F4FFE4";
const OUT = "/sessions/determined-sharp-hopper/mnt/Nik/investor-pitch/Clinket-Executive-Summary.docx";
const CONTENT_W = 9360;
const img = (p) => fs.readFileSync(p);
const noB = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };

const R = (text, o = {}) => new TextRun({ text, font: o.font || "Lufga", size: o.size ?? 22, color: o.color ?? INK, bold: o.bold, italics: o.italics });
const HL = (text) => new TextRun({ text, font: "Lufga", size: 22, bold: true, color: NAVY, shading: { type: ShadingType.CLEAR, fill: "E8FFC8" } });
const FILL = (what) => new TextRun({ text: ` [TO FILL: ${what}] `, font: "Lufga", size: 22, bold: true, color: NAVY, highlight: "yellow" });
const P = (runs, o = {}) => new Paragraph({ spacing: { after: o.after ?? 140, line: 288 }, children: Array.isArray(runs) ? runs : [R(runs)] });
const LEAD = (t) => new Paragraph({ spacing: { before: 180, after: 70 }, children: [new TextRun({ text: t, font: "Lufga SemiBold", bold: true, size: 26, color: NAVY })] });
const BULL = (runs) => new Paragraph({ numbering: { reference: "b", level: 0 }, spacing: { after: 80, line: 288 }, children: runs });

const header = new Header({ children: [new Paragraph({
  tabStops: [{ type: TabStopType.RIGHT, position: CONTENT_W }],
  border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: GREEN, space: 6 } },
  spacing: { after: 120 },
  children: [
    new ImageRun({ type: "png", data: img("/sessions/determined-sharp-hopper/mnt/outputs/wordmark-navy.png"), transformation: { width: 125, height: 38 } }),
    new TextRun({ children: ["\t"], font: "Lufga" }),
    new TextRun({ text: "Executive summary · Confidential", font: "Lufga", size: 18, color: GREY }),
  ] })] });
const footer = new Footer({ children: [new Paragraph({
  tabStops: [{ type: TabStopType.RIGHT, position: CONTENT_W }],
  border: { top: { style: BorderStyle.SINGLE, size: 4, color: BORDER, space: 6 } },
  children: [
    new TextRun({ text: "Clinket — everything local, one platform", font: "Lufga Medium", size: 18, color: GREY }),
    new TextRun({ children: ["\t"], font: "Lufga" }),
    new TextRun({ children: ["Page ", PageNumber.CURRENT], font: "Lufga", size: 18, color: GREY }),
  ] })] });

const body = [
  new Paragraph({ spacing: { before: 100, after: 60 },
    children: [new TextRun({ text: "Clinket, in two pages", font: "Lufga", bold: true, size: 44, color: NAVY })],
    border: { bottom: { style: BorderStyle.SINGLE, size: 18, color: GREEN, space: 6 } } }),
  P([R("The short version of a longer story. The full investor overview and the slide deck go deeper on every point here.", { size: 20, color: GREY, italics: true })], { after: 260 }),

  LEAD("Why this exists"),
  P([R("My wife runs a salon from our home. She's excellent at her work — and for years her business ran on missed calls, Instagram messages and a paper notebook. No website. No booking system. No way to take a payment without chasing someone for it. She isn't the exception; she's the rule. There are about 35 million small businesses in the US and over a million in Canada, and most of the people who fix our cars, cut our hair and cook our food still work exactly like she did.")]),
  P([R("I've spent my career building software for large organizations — loyalty platforms serving 20 million customers, systems for banks, insurers and medical data. At some point the question became obvious: why does none of that exist for the businesses around the corner? So I built it. All of it. That platform is Clinket.")]),

  LEAD("What Clinket is"),
  BULL([R("A marketplace for every local service. ", { bold: true, color: NAVY }), R("Customers search like they'd search Google, compare real ratings and prices, message or call the provider, book, and pay online — with "), HL("the money held until the job is actually done"), R(". Refunds and support included. Plumbers, salons, cleaners, mechanics, tutors, home cooks, even carpools and equipment rentals — over 300 categories.")]),
  BULL([R("A free toolkit to run a business. ", { bold: true, color: NAVY }), R("Bookings, quotes, invoices with payment links, a customer book that builds itself, and a ready-made website with online booking. "), HL("Free"), R(" — even for businesses that never touch the marketplace. This is how providers walk in the door.")]),
  BULL([R("An AI receptionist that never misses a call. ", { bold: true, color: NAVY }), R("It rings the owner first; if they're busy, it answers like a trained employee — books real appointments, takes orders, creates quotes, remembers every caller, and reports back with a summary of what it did. Tell it “no pepperoni today” in plain words and it obeys. A pizza line, a dental desk, a one-person mechanic — it fits all of them.")]),

  LEAD("Why it matters right now"),
  P([R("Local services are one of the last big offline markets: roughly "), R("69% of US consumer spending is services", { bold: true }), R(", US homeowners spend about "), R("$509 billion a year", { bold: true }), R(" on home improvement and repair alone, and the market leader's own annual report says its biggest competitor is word of mouth. Meanwhile the AI voice market is growing 39% a year. The demand exists. The workflow doesn't. Every number we use is sourced in the full document — nothing is made up.")]),

  LEAD("What exists today"),
  P([HL("Everything described above is built, approved and running."), R(" Customer and provider apps on web and mobile — approved by Apple and Google. A full admin console. Billing and subscriptions approved "), R("without the usual 15–30% app-store cut", { bold: true }), R(". Live in Canada/US and India, with a new country deployable in hours. Built end to end by one person, and already paid for.")]),

  LEAD("How it makes money"),
  P([R("Provider subscriptions (Free, Basic, Premium, Premium Max) with lead quotas, analytics and featured placement; AI receptionist plans with minutes that work like a phone plan; and a promotions engine that converts free trials into paid plans on its own. Next, the same data opens bigger doors: precision advertising to exactly the right businesses — and a "), HL("financial layer"), R(" where partners carry the risk and we can share the revenue: pay-over-time on big jobs (often 0% for the customer), insurance at the point of service, and helping providers get financing on their verified earnings. Square and Shopify proved that last model for shops; no one has built it for services.")]),

  LEAD("Where it ends up"),
  P([R("The financial layer is the on-ramp: once we're moving money for jobs, financing and insurance, the next step is obvious — "), HL("one place for everything"), R(". Book the plumber and pay the mortgage, the utility bill, the transit pass — the way WeChat (1.43 billion users) and Paytm already work in Asia. North America has no equivalent. Services are the habit; payments deepen it; the AI ties it together.")]),

  LEAD("What we're looking for"),
  P([R("Honestly: expertise before money. People who have done marketing and sales at scale and know how to make a platform pop in a city, a province, a country. The product is finished — every dollar of any investment goes to exactly that push, nothing else. And if this isn't for you but you know someone who should see it, that introduction is worth as much as a cheque.")]),
  P([R("Contact: "), FILL("name, title"), R(" · "), FILL("email"), R(" · "), FILL("phone"), R("   ·   Try it: "), R("dev.clinket.com", { color: "0869D4" }), R(" (demo access on request)")], { after: 0 }),
];

const doc = new Document({
  creator: "Clinket", title: "Clinket — Executive Summary",
  styles: { default: { document: { run: { font: "Lufga", size: 22, color: INK } } } },
  numbering: { config: [{ reference: "b", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 460, hanging: 260 } }, run: { color: NAVY, bold: true } } }] }] },
  sections: [{
    properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1200, bottom: 1100, left: 1440, right: 1440 } } },
    headers: { default: header }, footers: { default: footer },
    children: body,
  }],
});
Packer.toBuffer(doc).then((buf) => { fs.writeFileSync(OUT, buf); console.log("WROTE", OUT, buf.length); });
