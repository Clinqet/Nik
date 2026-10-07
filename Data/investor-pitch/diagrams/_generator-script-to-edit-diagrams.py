# Clinket investor diagrams — brand-exact SVG -> PNG (cairosvg, Lufga installed)
import cairosvg, html, os

OUT = "/sessions/determined-sharp-hopper/mnt/Nik/investor-pitch/diagrams"
os.makedirs(OUT, exist_ok=True)

NAVY = "#032858"; NAVY7 = "#0A3A6B"; DEEP = "#021A3D"; BLUE = "#0869D4"
GREEN = "#97EF29"; GSHADE = "#7AD91F"; CYAN = "#5BE7FF"
INK = "#171717"; GREY = "#5F5F5F"; BORDER = "#E7E7E7"; BG = "#FAFAFB"
GWASH = "#F4FFE4"; BWASH = "#EAF7FF"; IWASH = "#F0F4FF"; CWASH = "#E8F9FF"

F = "Lufga"; FM = "Lufga Medium"; FSB = "Lufga SemiBold"; FXB = "Lufga ExtraBold"; FL = "Lufga Light"

def esc(s): return html.escape(str(s), quote=True)
def tw(s, size): return len(s) * size * 0.545  # rough Lufga width

ICON = '''<g transform="translate({x},{y}) scale({s})">
<rect width="50" height="50" rx="10.84" fill="{green}"/>
<path d="M33.69 33.8778C31.1925 33.8778 28.9759 33.3658 27.0403 32.3418C25.1047 31.2868 23.575 29.8749 22.4511 28.1062C21.4179 26.2247 20.8057 24.2349 20.7653 21.9623C20.7653 19.6661 21.3272 17.6336 22.4511 15.8649C23.575 14.0652 25.1047 12.6378 27.0403 11.5828C28.9759 10.5278 31.1925 10.0002 33.69 10.0002H37.2959L35.1208 13.9752L33.971 16.0976C32.7535 16.0976 31.7076 16.3614 30.8335 16.8889C29.9593 17.3854 29.2725 18.0835 28.773 18.9834C28.3047 19.8523 28.0706 20.8452 28.0706 21.9623C28.0706 23.0794 28.3047 24.0878 28.773 24.9877C29.2725 25.8566 29.9593 26.5547 30.8335 27.0822C31.7076 27.5787 32.7535 27.827 33.971 27.827H37.2959V33.8778H33.69Z" fill="{navy}"/>
<path d="M16.1058 16.1226C18.6033 16.1226 20.8199 16.6346 22.7555 17.6586C24.6911 18.7136 26.2208 20.1255 27.3447 21.8942C28.4686 23.6939 29.0306 25.7419 29.0306 28.0381C29.0306 30.3344 28.4686 32.3668 27.3447 34.1355C26.2208 35.9353 24.6911 37.3626 22.7555 38.4177C20.8199 39.4727 18.6033 40.0002 16.1058 40.0002H12.5L14.675 36.0252L15.8248 33.9028C17.0424 33.9028 18.0882 33.639 18.9624 33.1115C19.8365 32.6151 20.5233 31.9169 21.0228 31.017C21.4911 30.1482 21.7253 29.1552 21.7253 28.0381C21.7253 26.9211 21.4911 25.9126 21.0228 25.0127C20.5233 24.1439 19.8365 23.4457 18.9624 22.9182C18.0882 22.4217 17.0424 22.1735 15.8248 22.1735H12.5L12.5 16.1226H16.1058Z" fill="{navy}"/></g>'''

def icon(x, y, px=22, green=GREEN, navy=NAVY):
    return ICON.format(x=x, y=y, s=px/50.0, green=green, navy=navy)

def text(x, y, s, size=15, fill=INK, font=F, weight=None, anchor="start", spacing=None):
    w = f' font-weight="{weight}"' if weight else ""
    sp = f' letter-spacing="{spacing}"' if spacing else ""
    return f'<text x="{x}" y="{y}" font-family="{font}" font-size="{size}" fill="{fill}" text-anchor="{anchor}"{w}{sp}>{esc(s)}</text>'

def lines(x, y, arr, size=15, lh=None, fill=INK, font=F, anchor="start"):
    lh = lh or size * 1.42
    return "".join(text(x, y + i*lh, s, size, fill, font, anchor=anchor) for i, s in enumerate(arr))

def card(x, y, w, h, fill="#FFFFFF", stroke=BORDER, rx=16, sw=1.2, extra=""):
    return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}" {extra}/>'

def chip(x, y, s, size=13, fill=GWASH, color=NAVY, stroke="#D4F9A0", font=FM):
    w = tw(s, size) + 26; h = size + 15
    return (f'<rect x="{x}" y="{y}" width="{w:.0f}" height="{h}" rx="{h/2}" fill="{fill}" stroke="{stroke}" stroke-width="1"/>'
            + text(x + w/2, y + h/2 + size*0.36, s, size, color, font, anchor="middle")), w

def chiprow(x, y, items, size=13, gap=10, fill=GWASH, color=NAVY, stroke="#D4F9A0", maxw=None, lh=None):
    out = []; cx, cy = x, y; lh = lh or size + 25
    for s in items:
        w = tw(s, size) + 26
        if maxw and cx + w > x + maxw: cx = x; cy += lh
        frag, w = chip(cx, cy, s, size, fill, color, stroke)
        out.append(frag); cx += w + gap
    return "".join(out), cy + size + 15 - y

def arrow(x1, y1, x2, y2, color=NAVY, sw=2.2, dash=None):
    d = f' stroke-dasharray="{dash}"' if dash else ""
    return f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{color}" stroke-width="{sw}" marker-end="url(#ah-{color[1:]})"{d}/>'

def elbow(pts, color=NAVY, sw=2.2, dash=None):
    d = f' stroke-dasharray="{dash}"' if dash else ""
    path = "M " + " L ".join(f"{p[0]} {p[1]}" for p in pts)
    return f'<path d="{path}" fill="none" stroke="{color}" stroke-width="{sw}" marker-end="url(#ah-{color[1:]})"{d}/>'

def defs():
    out = ['<defs>']
    for c in (NAVY, GREEN, GREY, GSHADE, BLUE, "#9CA3AF"):
        out.append(f'<marker id="ah-{c[1:]}" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="{c}"/></marker>')
    out.append(f'<linearGradient id="heroNavy" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="{NAVY}"/><stop offset="50%" stop-color="{NAVY7}"/><stop offset="100%" stop-color="{NAVY}"/></linearGradient>')
    out.append(f'<linearGradient id="airy" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#FFFFFF"/><stop offset="40%" stop-color="{IWASH}"/><stop offset="70%" stop-color="{CWASH}"/><stop offset="100%" stop-color="#FFFFFF"/></linearGradient>')
    out.append(f'<linearGradient id="greenGlow" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#CFEEB0"/><stop offset="100%" stop-color="{GREEN}"/></linearGradient>')
    out.append('</defs>')
    return "".join(out)

def header(title, sub, W, kw=None):
    # kw: (word, rest) -> highlight first part in green? keep title navy, green rule below
    out = [text(60, 78, title, 34, NAVY, FXB)]
    out.append(f'<rect x="62" y="94" width="70" height="5" rx="2.5" fill="{GREEN}"/>')
    if sub: out.append(text(60, 128, sub, 16, GREY, F))
    return "".join(out)

def footer(name, W, Hh):
    y = Hh - 46
    return (f'<line x1="60" y1="{y}" x2="{W-60}" y2="{y}" stroke="{BORDER}" stroke-width="1"/>'
            + icon(60, y + 12, 20)
            + text(88, y + 27, "Clinket", 12, GREY, FM)
            + text(W-60, y + 27, name + "  ·  Confidential", 12, GREY, F, anchor="end"))

def wrap_svg(W, H, body, name, bg="#FFFFFF"):
    return (f'<svg width="{W}" height="{H}" viewBox="0 0 {W} {H}" xmlns="http://www.w3.org/2000/svg">'
            + defs() + f'<rect width="{W}" height="{H}" fill="{bg}"/>' + body + footer(name, W, H) + '</svg>')

def render(fname, svg):
    p = os.path.join(OUT, fname)
    with open(p + ".svg", "w") as f: f.write(svg)
    cairosvg.svg2png(bytestring=svg.encode(), write_to=p + ".png", scale=2.0)
    print("done", fname)

# ============================================================ D1 — three pillars
def d1():
    W, H = 1600, 830
    b = [header("The Clinket platform — three offerings, one engine",
                "Providers adopt one pillar or all three. Every pillar feeds the same customers, data and AI.", W)]
    cw, ch, gap, y0 = 470, 348, 25, 175
    pill = [
        ("1", "Marketplace + e-commerce", "Every local service, one front door", CYAN, CWASH, [
            "Google-simple search — answers on the first screen",
            "Honest profiles: ratings, photos of past work, clear pricing",
            "Chat, call, voice notes, WhatsApp — privacy-controlled",
            "Book and pay online — funds held until the job is done",
            "Refunds, disputes and support built in, Amazon-style"]),
        ("2", "Free tools to run the business", "A ready-made back office — $0", GREEN, GWASH, [
            "Bookings, quotes and invoices with payment links",
            "Their own customer book, built in — on or off Clinket",
            "Auto-generated personal website with booking + QR code",
            "Offers and campaigns pushed to their customer base",
            "Free of charge — the on-ramp for every small business"]),
        ("3", "AI Assistant + Receptionist", "Never miss a call, a lead or an order", BLUE, IWASH, [
            "Answers missed calls 24/7 and books real appointments",
            "Creates quotes, orders and customer records from the call",
            "Follows the owner’s instructions — “no pepperoni today”",
            "Owner can watch the call live and take over anytime",
            "Every call summarized — with the actions it took"]),
    ]
    for i, (num, t, st, acc, wash, bl) in enumerate(pill):
        x = 60 + i*(cw+gap)
        b.append(card(x, y0, cw, ch, "#FFFFFF", BORDER, 18))
        b.append(f'<rect x="{x}" y="{y0}" width="{cw}" height="8" rx="4" fill="{acc}"/>')
        b.append(f'<circle cx="{x+44}" cy="{y0+52}" r="20" fill="{wash}" stroke="{acc}" stroke-width="1.5"/>')
        b.append(text(x+44, y0+59, num, 19, NAVY, FXB, anchor="middle"))
        b.append(text(x+76, y0+48, t, 20, NAVY, FSB))
        b.append(text(x+76, y0+72, st, 13.5, GREY, F))
        yy = y0 + 118
        for s in bl:
            b.append(f'<circle cx="{x+34}" cy="{yy-5}" r="3.5" fill="{GREEN}"/>')
            b.append(text(x+50, yy, s, 14.5, INK, F))
            yy += 32
        b.append(text(x+30, y0+ch-24, ["For customers: one app for every need",
                                       "For providers: run everything in one place",
                                       "For any business — even off the marketplace"][i], 13, GREY, FM))
    # shared engine bar
    ey = y0 + ch + 38
    b.append(card(60, ey, W-120, 118, "url(#heroNavy)", NAVY, 18, 0))
    b.append(text(92, ey+46, "One shared engine underneath", 18, "#FFFFFF", FSB))
    b.append(text(92, ey+72, "Every pillar runs on the same platform services:", 13, "#BFD3EA", F))
    frag, _ = chiprow(430, ey+30, ["AI matching", "Smart search", "Customer insights",
                                   "Payments + refunds", "Messaging + WhatsApp", "Notifications",
                                   "Recommendations", "Photos + documents"],
                      13, 9, "#0A3A78", "#FFFFFF", "#0A4A8A", maxw=W-520)
    b.append(frag)
    return wrap_svg(W, H, "".join(b), "Platform overview")

# ============================================================ D2 — customer journey
def d2():
    W, H = 1600, 700
    b = [header("Booking a service on Clinket — the customer journey",
                "From “I need a plumber” to a completed, protected job — without a single phone call chase.", W)]
    steps = [
        ("Search", ["Type a need like a", "Google search — every", "answer on one screen"]),
        ("Compare", ["Real profiles, ratings,", "portfolios and transparent,", "tax-inclusive pricing"]),
        ("Connect", ["Chat, call, voice note or", "WhatsApp — share contact", "details only if you choose"]),
        ("Book", ["Live availability,", "reminders and free", "cancellation until the job"]),
        ("Pay safely", ["Optional online payment,", "held until the job is done;", "refunds if things go wrong"]),
        ("Review", ["Rate the provider —", "photos included — and", "power the next customer"]),
    ]
    n = len(steps); cw = 205; gap = (W - 120 - n*cw)/(n-1); y0 = 210; ch = 210
    for i, (t, cap) in enumerate(steps):
        x = 60 + i*(cw+gap)
        b.append(card(x, y0, cw, ch, "#FFFFFF", BORDER, 16))
        b.append(f'<circle cx="{x+cw/2}" cy="{y0+44}" r="23" fill="{GWASH}" stroke="{GREEN}" stroke-width="2"/>')
        b.append(text(x+cw/2, y0+52, str(i+1), 19, NAVY, FXB, anchor="middle"))
        b.append(text(x+cw/2, y0+96, t, 17, NAVY, FSB, anchor="middle"))
        b.append(lines(x+cw/2, y0+126, cap, 12.5, 19, GREY, F, anchor="middle"))
        if i < n-1:
            b.append(arrow(x+cw+6, y0+ch/2, x+cw+gap-8, y0+ch/2, GSHADE, 2.6))
    ay = y0 + ch + 46
    b.append(card(60, ay, W-120, 96, GWASH, "#D4F9A0", 16))
    b.append(text(92, ay+40, "In a hurry, or a complex job?", 16, NAVY, FSB))
    b.append(text(92, ay+66, "Post one request instead — “Get Quotes” — and let matched providers come to you with bids. (See: How Get Quotes works)", 14, INK, F))
    return wrap_svg(W, H, "".join(b), "Customer journey")

# ============================================================ D3 — quote/lead flow
def d3():
    W, H = 1600, 800
    b = [header("How “Get Quotes” works — one request, a market of offers",
                "The customer describes what they need, once. Clinket privately shares it with the right nearby providers — who then compete for the job.", W)]
    def tag(x, y, s, fill, color):
        w = tw(s, 11.5) + 20
        return (f'<rect x="{x}" y="{y}" width="{w:.0f}" height="22" rx="11" fill="{fill}"/>'
                + text(x+w/2, y+15.5, s, 11.5, color, FM, anchor="middle"))
    CU = ("CUSTOMER", CWASH, NAVY); AI = ("CLINKET AI", NAVY, "#FFFFFF"); PR = ("PROVIDERS", GWASH, NAVY)
    nodes = [
        (1, CU, "Describe the job once", ["Type it, speak it, or add photos —", "the leaky tap, the car, the hair length"]),
        (2, AI, "Clinket understands it", ["It works out the type of job and the", "area on its own — no forms, no menus"]),
        (3, AI, "The right providers get it", ["Nearby, relevant, well-rated providers;", "premium members see it first — but", "everyone gets a fair chance"]),
        (4, PR, "Providers see a new lead", ["Full job details — but who the customer", "is stays private until they choose"]),
        (5, PR, "Providers compete", ["Offer a price, ask questions, show", "their ratings and past work"]),
        (6, CU, "Customer picks a winner", ["Compare every offer side-by-side,", "then pick with one tap"]),
        (7, AI, "Deal happens end-to-end", ["Contact shared → booking → safe", "payment → job done → review"]),
    ]
    cw, ch = 332, 152; gx, gy = 50, 60; y0 = 200
    pos = {}
    for i in range(4): pos[i+1] = (60 + i*(cw+gx), y0)
    for i in range(3): pos[7-i] = (60 + (i+0.5)*(cw+gx), y0+ch+gy)
    for num, (lt, lf, lc), t, cap in nodes:
        x, y = pos[num]
        dark = num == 7
        b.append(card(x, y, cw, ch, "url(#heroNavy)" if dark else "#FFFFFF", NAVY if dark else BORDER, 16, 0 if dark else 1.2))
        b.append(tag(x+22, y+18, lt, lf if not dark else GREEN, lc if not dark else NAVY))
        b.append(text(x+cw-22, y+34, f"{num}", 20, GREEN if dark else "#D4F9A0", FXB, anchor="end"))
        b.append(text(x+22, y+68, t, 16.5, "#FFFFFF" if dark else NAVY, FSB))
        b.append(lines(x+22, y+94, cap, 12.7, 19, "#BFD3EA" if dark else GREY, F))
    my = y0 + ch/2
    for i in range(3):
        x, _ = pos[i+1]; b.append(arrow(x+cw+4, my, x+cw+gx-6, my, GSHADE, 2.6))
    x4c = pos[4][0] + cw/2; x5c = pos[5][0] + cw/2
    b.append(elbow([(x4c, y0+ch+4), (x4c, y0+ch+gy/2), (x5c, y0+ch+gy/2), (x5c, y0+ch+gy-8)], GSHADE, 2.6))
    my2 = y0+ch+gy+ch/2
    for src, dst in ((5, 6), (6, 7)):
        xs = pos[src][0]; xd = pos[dst][0]
        b.append(arrow(xs-4, my2, xd+cw+8, my2, GSHADE, 2.6))
    ny = y0 + 2*ch + gy + 44
    b.append(card(60, ny, W-120, 92, IWASH, "#D9E2F5", 16))
    b.append(text(92, ny+38, "Privacy by design", 15.5, NAVY, FSB))
    b.append(text(92, ny+63, "The customer decides if and when their phone or email is shared. Providers bid on the job, not on the person — no data resale, ever.", 13.5, INK, F))
    return wrap_svg(W, H, "".join(b), "Get Quotes → Leads flow")

# ============================================================ D4 — AI receptionist
def d4():
    W, H = 1600, 810
    b = [header("The AI receptionist — every call answered, every action done",
                "A dedicated business line where AI behaves like a trained employee — and the owner stays in control.", W)]
    y0 = 175
    b.append(card(60, y0, 300, 118, "#FFFFFF", BORDER, 16))
    b.append(text(90, y0+46, "Customer calls", 17, NAVY, FSB))
    b.append(lines(90, y0+74, ["the business’s dedicated", "Clinket number"], 13, 19, GREY))
    b.append(arrow(360+6, y0+59, 430-6, y0+59, GSHADE, 2.6))
    b.append(card(430, y0, 390, 118, "#FFFFFF", BORDER, 16))
    b.append(text(460, y0+42, "Rings the owner first", 17, NAVY, FSB))
    b.append(lines(460, y0+70, ["Missed, declined or after hours —", "the AI takes over, seamlessly"], 13, 19, GREY))
    b.append(arrow(820+6, y0+59, 890-6, y0+59, GSHADE, 2.6))
    b.append(card(890, y0, W-60-890, 118, "url(#heroNavy)", NAVY, 16, 0))
    b.append(text(920, y0+42, "AI answers like a trained employee", 18, "#FFFFFF", FSB))
    b.append(lines(920, y0+70, ["It knows the whole business: services, prices, hours, history,", "standing instructions — and it can search the web when needed"], 13, 19, "#BFD3EA"))
    my = y0 + 142
    frag, mh = chiprow(60, my, ["Owner-first, AI on miss (24/7)", "After-hours only", "Listen + summarize only",
                                "Private mode — AI fully off the call", "Pause / resume anytime",
                                "Standing instructions: “no pepperoni today”"], 13, 10, BWASH, NAVY, "#BFE3F5", maxw=W-120)
    b.append(text(60, my-6, "", 12, GREY)); b.append(frag)
    gy0 = my + mh + 34
    b.append(text(60, gy0-8, "While on the call, it actually does the work:", 16, NAVY, FSB))
    caps = [
        ("Books + reschedules", ["Real appointments on the real", "calendar; changes confirmed", "with a one-time security code"]),
        ("Takes orders + quotes", ["Creates quotations and", "orders live during the", "conversation, ready for review"]),
        ("Remembers every caller", ["Each caller becomes a customer", "record — number, email, name —", "ready for follow-up"]),
        ("Answers anything", ["Services, prices, availability,", "directions — always from the", "business’s own information"]),
        ("Sends follow-ups", ["Quotes and confirmations by", "WhatsApp, SMS or email —", "while still on the line"]),
        ("Hands over smoothly", ["Owner watches the live", "transcript and can take over", "mid-call like a colleague"]),
    ]
    cw, chh, gap = 236, 168, 12.8;
    for i, (t, cap) in enumerate(caps):
        x = 60 + i*(cw+gap)
        b.append(card(x, gy0+12, cw, chh, "#FFFFFF", BORDER, 14))
        b.append(f'<rect x="{x}" y="{gy0+12}" width="42" height="5" rx="2.5" fill="{GREEN}" transform="translate(24,26)"/>')
        b.append(text(x+24, gy0+66, t, 15, NAVY, FSB))
        b.append(lines(x+24, gy0+94, cap, 12.3, 18.5, GREY))
    ay = gy0 + 12 + chh + 34
    b.append(card(60, ay, (W-132)/2, 128, GWASH, "#D4F9A0", 16))
    b.append(text(92, ay+40, "After every call — the follow-up feed", 16, NAVY, FSB))
    b.append(lines(92, ay+68, ["Two-line summary, full transcript, recording, and exactly what the AI did",
                               "(booking created, quote sent, customer added) with confidence scores."], 13.5, 20, INK))
    x2 = 60 + (W-132)/2 + 12
    b.append(card(x2, ay, (W-132)/2, 128, IWASH, "#D9E2F5", 16))
    b.append(text(x2+32, ay+40, "Fits any business, any size", 16, NAVY, FSB))
    b.append(lines(x2+32, ay+68, ["Pizza shop order line, dental front desk, one-person mechanic, heavy-equipment",
                                  "sales floor — set up in minutes from flyers, photos or plain instructions."], 13.5, 20, INK))
    return wrap_svg(W, H, "".join(b), "AI receptionist flow")

# ============================================================ D5 — revenue model
def d5():
    W, H = 1600, 800
    b = [header("How Clinket makes money — built today, compounding tomorrow",
                "Recurring subscription revenue is live in the product now; three larger engines are unlocked by the same data and scale.", W)]
    y0 = 175; cw = (W-132)/2
    b.append(card(60, y0, cw, 370, "#FFFFFF", BORDER, 18))
    b.append(f'<rect x="60" y="{y0}" width="{cw}" height="8" rx="4" fill="{GREEN}"/>')
    b.append(text(92, y0+52, "Live in the product today", 20, NAVY, FSB))
    b.append(text(92, y0+78, "Recurring, self-serve, already approved on Apple + Google billing", 13, GREY))
    rows1 = [
        ("Provider subscriptions", ["Free · Basic · Premium · Premium Max — monthly lead quotas,",
                                    "head-start on every lead, deep analytics, featured banners,", "WhatsApp allowances. Free tier never starves — it upsells."]),
        ("AI Receptionist plans", ["Standard and Advanced intelligence tiers + usage minutes —",
                                   "phone-plan mechanics: top-ups and auto-recharge included."]),
        ("Promotions + loyalty engine", ["Free trials, personalized promo codes and targeted offers,",
                                         "delivered in-app and by email — built and live today."]),
    ]
    yy = y0 + 108
    for t, cap in rows1:
        b.append(f'<rect x="92" y="{yy-16}" width="4" height="20" rx="2" fill="{GREEN}"/>')
        b.append(text(108, yy, t, 16, NAVY, FSB))
        b.append(lines(108, yy+24, cap, 13.2, 19.5, GREY))
        yy += 24 + len(cap)*19.5 + 22
    x2 = 60 + cw + 12
    b.append(card(x2, y0, cw, 370, "#FFFFFF", BORDER, 18))
    b.append(f'<rect x="{x2}" y="{y0}" width="{cw}" height="8" rx="4" fill="{NAVY}"/>')
    b.append(text(x2+32, y0+52, "What the same data unlocks next", 20, NAVY, FSB))
    b.append(text(x2+32, y0+78, "Each one can outgrow subscriptions — and could even make the core free", 13, GREY))
    rows2 = [
        ("Precision B2B advertising", ["Wholesalers reach exactly the right trades — and our analytics",
                                       "knows which pages and placements each provider engages with", "most, so every ad lands where it's seen. Win-win-win."]),
        ("Clinket-branded services", ["The Kirkland / Amazon Basics play: launch or lease out own-brand",
                                      "services in areas where demand data proves the market."]),
        ("Selective transaction fees", ["A small fee only on categories we choose — e.g. buy-and-sell or",
                                        "delivery — deliberately not a tax on every service booking."]),
    ]
    yy = y0 + 108
    for t, cap in rows2:
        b.append(f'<rect x="{x2+32}" y="{yy-16}" width="4" height="20" rx="2" fill="{NAVY}"/>')
        b.append(text(x2+48, yy, t, 16, NAVY, FSB))
        b.append(lines(x2+48, yy+24, cap, 13.2, 19.5, GREY))
        yy += 24 + len(cap)*19.5 + 22
    by = y0 + 370 + 36
    b.append(card(60, by, W-120, 108, "url(#heroNavy)", NAVY, 18, 0))
    b.append(text(92, by+44, "The horizon: one app for everything", 18, "#FFFFFF", FSB))
    b.append(text(92, by+72, "Bills, transit passes, mobile top-ups, payments — the WeChat / Paytm playbook, proven at billion-user scale in Asia, rebuilt for North America.", 13.5, "#BFD3EA"))
    return wrap_svg(W, H, "".join(b), "Revenue model")

# ============================================================ D6 — architecture
def d6():
    W, H = 1600, 1060
    b = [header("Platform architecture — enterprise-grade, one-click global",
                "Built cloud-native on Microsoft Azure. Scales from zero to millions automatically; a whole new country goes live in hours.", W)]
    y0 = 168
    clients = ["Customer web + mobile", "Provider web + mobile", "Admin console", "Phone calls + WhatsApp"]
    cw = (W-120-3*14)/4
    for i, c in enumerate(clients):
        x = 60 + i*(cw+14)
        b.append(card(x, y0, cw, 56, BWASH, "#BFE3F5", 12))
        b.append(text(x+cw/2, y0+34, c, 14.5, NAVY, FSB, anchor="middle"))
        b.append(arrow(x+cw/2, y0+60, x+cw/2, y0+96, GREY, 1.8))
    fy = y0 + 100
    b.append(card(60, fy, W-120, 74, "url(#heroNavy)", NAVY, 14, 0))
    b.append(text(92, fy+32, "Azure Front Door — the only way in", 16, "#FFFFFF", FSB))
    b.append(text(92, fy+56, "Global edge network · firewall + dynamic rule engine · bot + abuse blocking · geo-filtering · routes each user to the nearest region", 12.5, "#BFD3EA"))
    b.append(arrow(W/2, fy+78, W/2, fy+112, GREY, 1.8))
    ry = fy + 116; rh = 500
    b.append(card(60, ry, W-120, rh, BG, "#D1D5DB", 18, 1.4, 'stroke-dasharray="7 5"'))
    b.append(text(88, ry+38, "Regional stamp — the whole platform, replicated per region", 16.5, NAVY, FSB))
    b.append(text(88, ry+62, "Live today: Canada/US + India · fully automated deployment — a new region (e.g. Australia) is production-ready in hours, data kept in-country", 12.5, GREY))
    ax = 88; ay = ry + 86; aw = 430
    b.append(card(ax, ay, aw, 170, "#FFFFFF", BORDER, 14))
    b.append(text(ax+24, ay+34, "API layer", 15, NAVY, FSB))
    b.append(lines(ax+24, ay+62, ["Main platform API — auto-scaling", "Identity API — passkeys, biometrics, OTP,", "social logins; modern token security"], 13, 20, GREY))
    b.append(chip(ax+24, ay+126, "Stateless · scales 0 → millions", 12, GWASH, NAVY, "#D4F9A0")[0])
    ex = ax + aw + 24; ew = 620
    b.append(card(ex, ay, ew, 170, "#FFFFFF", BORDER, 14))
    b.append(text(ex+24, ay+34, "27+ asynchronous engines (microservices)", 15, NAVY, FSB))
    frag, _ = chiprow(ex+24, ay+50, ["Leads + broadcast", "Notifications", "Email", "WhatsApp", "SMS", "Search index",
                                     "Analytics", "Recommendations", "Media", "Voice AI", "Billing", "Reminders", "Documents"],
                      11.5, 7, IWASH, NAVY, "#D9E2F5", maxw=ew-48, lh=32)
    b.append(frag)
    qx = ex + ew + 24; qw = W-120-60- (qx-60) + 32
    qw = (60 + W - 120) - qx - 28
    b.append(card(qx, ay, qw, 170, "#FFFFFF", BORDER, 14))
    b.append(text(qx+24, ay+34, "Service Bus", 15, NAVY, FSB))
    b.append(lines(qx+24, ay+62, ["25+ queues decouple", "everything — nothing", "blocks a user request,", "nothing gets lost"], 13, 20, GREY))
    dy = ay + 194
    b.append(card(ax, dy, 500, 150, "#FFFFFF", BORDER, 14))
    b.append(text(ax+24, dy+34, "Data — split by design", 15, NAVY, FSB))
    b.append(lines(ax+24, dy+62, ["Cosmos DB — all business data, millisecond-fast,", "designed to grow without limits",
                                  "SQL — logins + financial records, kept separate"], 13, 20, GREY))
    b.append(card(ax+524, dy, 520, 150, "#FFFFFF", BORDER, 14))
    b.append(text(ax+548, dy+34, "Azure AI services", 15, NAVY, FSB))
    b.append(lines(ax+548, dy+62, ["OpenAI models · AI Search (hybrid + semantic)", "Speech (28 languages) · Document Intelligence",
                                   "GPT-Realtime voice · embeddings + enrichment"], 13, 20, GREY))
    b.append(card(ax+1068, dy, (60+W-120)-(ax+1068)-28, 150, GWASH, "#D4F9A0", 14))
    b.append(text(ax+1092, dy+34, "Zero-credential security", 15, NAVY, FSB))
    b.append(lines(ax+1092, dy+62, ["No usernames or passwords", "exist inside the boundary —", "managed identity only.", "Nothing to steal."], 13, 20, INK))
    ny = ry + rh + 26
    notes = ["Runs itself — self-healing, admin alerted before users notice", "Infrastructure cost at scale: hundreds of dollars, not millions",
             "Data residency + privacy law compliance per region, consent automated", "Apple + Google approved — web, iOS and Android, incl. billing"]
    nw = (W-120-3*14)/4
    for i, s in enumerate(notes):
        x = 60 + i*(nw+14)
        b.append(card(x, ny, nw, 78, "#FFFFFF", BORDER, 12))
        b.append(f'<rect x="{x+18}" y="{ny+18}" width="4" height="42" rx="2" fill="{GREEN}"/>')
        wrapped = []
        words = s.split(); cur = ""
        for wd in words:
            if tw(cur+" "+wd, 12.5) > nw-60: wrapped.append(cur.strip()); cur = wd
            else: cur += " " + wd
        wrapped.append(cur.strip())
        b.append(lines(x+34, ny+34, wrapped[:3], 12.5, 18, INK))
    return wrap_svg(W, H, "".join(b), "Technical architecture")

# ============================================================ D7 — ERD
def d7():
    W, H = 1600, 850
    b = [header("How everything connects — the building blocks of Clinket",
                "A plain-English map of the pieces behind the product and how they relate. (Simplified — the full technical model is available for review.)", W)]
    y0 = 180
    ents = {  # name: (x, y, w, fields, accent)
        "Category":      (60,   y0,      240, ["300+ types of services,", "with subcategories"], CYAN),
        "Service":       (350,  y0,      260, ["what a provider offers —", "prices, photos, details"], GREEN),
        "Provider":      (660,  y0,      300, ["business profile + own website", "service areas · working hours"], NAVY),
        "Subscription":  (1010, y0,      260, ["Free / Basic / Premium / Max", "AI minutes · top-ups · offers"], GREEN),
        "AI phone line": (1320, y0,      220, ["its own phone number", "call rules set by the owner"], BLUE),
        "Quote request": (60,   y0+230,  240, ["a “Get Quotes” job post —", "photos · budget · deadline"], GREEN),
        "Offer (bid)":   (350,  y0+230,  260, ["price · questions + answers", "one winner per request"], CYAN),
        "Booking":       (660,  y0+230,  300, ["confirmed appointments,", "reminders, no double-booking"], NAVY),
        "Invoice":       (1010, y0+230,  260, ["created automatically,", "with a link to pay"], GREEN),
        "Call + summary":(1320, y0+230,  220, ["what was said + what the", "AI did · follow-up ideas"], BLUE),
        "Customer":      (60,   y0+460,  240, ["decides what to share —", "privacy in their hands"], NAVY),
        "Conversation":  (350,  y0+460,  260, ["chat · voice notes · files", "also on WhatsApp · encrypted"], CYAN),
        "Review":        (660,  y0+460,  300, ["ratings + photos · replies", "builds the provider’s reputation"], GREEN),
        "Payment":       (1010, y0+460,  260, ["held safely until the job is", "done · refunds if it goes wrong"], NAVY),
        "Customer book": (1320, y0+460,  220, ["the provider’s own customers,", "built automatically from calls"], BLUE),
    }
    def anch(name, side):
        x, y, w, _, _ = ents[name]; h = 118
        return {"l": (x, y+h/2), "r": (x+w, y+h/2), "t": (x+w/2, y), "b": (x+w/2, y+h)}[side]
    rels = [
        ("Category", "r", "Service", "l", "sorts"),
        ("Service", "r", "Provider", "l", "offered by"),
        ("Provider", "r", "Subscription", "l", "pays for"),
        ("Subscription", "r", "AI phone line", "l", "unlocks"),
        ("Quote request", "r", "Offer (bid)", "l", "receives"),
        ("Offer (bid)", "r", "Booking", "l", "becomes"),
        ("Booking", "r", "Invoice", "l", "creates"),
        ("Invoice", "b", "Payment", "t", "paid by"),
        ("AI phone line", "b", "Call + summary", "t", "answers"),
        ("Call + summary", "b", "Customer book", "t", "adds to"),
        ("Customer", "t", "Quote request", "b", "posts"),
        ("Customer", "r", "Conversation", "l", "chats via"),
        ("Conversation", "t", "Offer (bid)", "b", "discusses"),
        ("Review", "t", "Booking", "b", "after"),
        ("Provider", "b", "Booking", "t", "does the job"),
    ]
    for name, (x, y, w, fields, acc) in ents.items():
        h = 118
        b.append(card(x, y, w, h, "#FFFFFF", BORDER, 12))
        b.append(f'<rect x="{x}" y="{y}" width="{w}" height="34" rx="12" fill="{NAVY}"/><rect x="{x}" y="{y+22}" width="{w}" height="12" fill="{NAVY}"/>')
        b.append(f'<rect x="{x}" y="{y+34}" width="{w}" height="3" fill="{acc if acc!=NAVY else GREEN}"/>')
        b.append(text(x+w/2, y+23, name, 14.5, "#FFFFFF", FSB, anchor="middle"))
        b.append(lines(x+16, y+60, fields, 12, 19, GREY))
    def edge_label(cx, cy, s, above=True):
        w = tw(s, 10.5) + 12
        return (f'<rect x="{cx-w/2:.0f}" y="{cy-9}" width="{w:.0f}" height="17" rx="8" fill="#FFFFFF" stroke="{BORDER}" stroke-width="0.8"/>'
                + text(cx, cy+3.5, s, 10.5, GREY, FM, anchor="middle"))
    for a, sa, c, sc, lbl in rels:
        (x1, y1), (x2, y2) = anch(a, sa), anch(c, sc)
        if sa in "lr" and sc in "lr" and abs(y1-y2) < 4:
            b.append(arrow(x1, y1, x2 + (-6 if x2 > x1 else 6), y2, "#9CA3AF", 1.8))
            if lbl: b.append(edge_label((x1+x2)/2, y1, lbl))
        else:
            mx, my2 = (x1+x2)/2, (y1+y2)/2
            b.append(elbow([(x1, y1), (x1 if sa in "tb" else mx, y2 if False else my2), (x2, my2), (x2, y2 + (-6 if y2 > my2 else 6))][:4] if sa in "tb" else [(x1, y1), (mx, y1), (mx, y2), (x2 + (-6 if x2 > mx else 6), y2)], "#9CA3AF", 1.8))
            if lbl: b.append(edge_label(x1 if sa in "tb" else mx, my2, lbl))
    return wrap_svg(W, H, "".join(b), "Entity map (simplified)")

for fn, f in [("clinket-01-what-clinket-offers-three-pillars", d1),
              ("clinket-02-how-a-customer-books-a-service", d2),
              ("clinket-03-how-get-quotes-and-leads-work", d3),
              ("clinket-04-how-the-ai-receptionist-answers-calls", d4),
              ("clinket-05-how-clinket-makes-money", d5),
              ("clinket-06-how-the-platform-scales-architecture", d6),
              ("clinket-07-how-everything-connects-data-map", d7)]:
    render(fn, f())
print("ALL DONE")
