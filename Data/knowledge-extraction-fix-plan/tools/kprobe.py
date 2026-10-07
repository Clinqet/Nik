# -*- coding: utf-8 -*-
"""
kprobe - replay the knowledge retrieval's EXACT hybrid query against the live index.

‼️ WHY THIS EXISTS. The deployed MCP host answers `403 Ip Forbidden` from a dev machine, so the phone's own
`search_knowledge` cannot be called from here. A BM25 curl is not a substitute: the product sends text AND a
vector AND a filter in ONE request, and the ranking that results is the thing under test. This replays that
request, field for field, from the same settings the service reads.

‼️ WHAT IT IS NOT. It is a REPLAY, not the service. It proves the INDEX and the QUERY; it cannot prove the
service's own gates, trim or note. Anything it shows must be reported as "the query the service builds
returns X", never as "the receptionist said X".

Usage:
    py kprobe.py <businessId> "<question>" [--script Latn] [--top 8] [--cjk] [--docs id1,id2]
    py kprobe.py MEE3IC "how much is a haircut"
    py kprobe.py SX3SG2 "હેરકટનો ભાવ" --script Gujr

Settings mirrored from clinqetmcp/Clinqet.Mcp/appsettings.json -> Voice:Knowledge.
"""
import argparse
import io
import json
import os
import sys

_HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, _HERE)

import srch_client as srch  # noqa: E402
import emb_client as emb    # noqa: E402

# ---- the service's own constants (ProviderKnowledgeSearchService) -------------------------------------
# The service names contentCjk on EVERY query since Phase 3 item #3 (ProviderKnowledgeSearchService.SearchFields).
SEARCH_FIELDS = ["content", "contentCjk", "sectionTitle", "docTitle", "linkedServiceNames", "docType", "linkedGroupName"]
SEARCH_FIELDS_CJK = ["content", "contentCjk", "sectionTitle", "docTitle", "linkedServiceNames",
                     "docType", "linkedGroupName"]
SELECT_FIELDS = ["id", "businessId", "docId", "docName", "docTitle", "sectionTitle", "content",
                 "linkedServiceIds", "linkedServiceNames", "chunkKind", "docType", "linkedGroupName", "imageRef"]
# Read from the live index, not guessed: the SDK constant is the PROFILE name, the C# field name is not.
SCORING_PROFILE = "knowledgeRelevance"
WINDOW_FACTOR = 2
MAX_QUERY_CHARS = 200

# Azure simple query syntax operators; the service escapes the caller's words and adds its own unescaped.
_OPERATORS = set('+|"()-*~/\\')

# The digit zero of each script that writes its own numerals (TextScriptDetector.DigitZeros).
_DIGIT_ZEROS = {
    "Arab": 0x0660, "Deva": 0x0966, "Beng": 0x09E6, "Guru": 0x0A66,
    "Gujr": 0x0AE6, "Taml": 0x0BE6, "Telu": 0x0C66, "Thai": 0x0E50,
}


def escape_simple(text):
    return "".join(("\\" + c) if c in _OPERATORS else c for c in text)


def fold_digits_to_ascii(text):
    out = []
    for ch in text:
        code = ord(ch)
        for zero in _DIGIT_ZEROS.values():
            if zero <= code <= zero + 9:
                ch = chr(ord("0") + code - zero)
                break
        out.append(ch)
    return "".join(out)


def map_ascii_digits(text, zero):
    return "".join(chr(zero + ord(c) - ord("0")) if "0" <= c <= "9" else c for c in text)


def looks_like_code(token, min_len=4, max_len=12):
    if not (min_len <= len(token) <= max_len):
        return False
    has_letter = any(c.isalpha() for c in token)
    has_digit = any(c.isdigit() for c in token)
    return has_letter and has_digit and all(c.isalnum() for c in token)


FILLER_WORDS = set("""का की के को में मे से पर पे तक ने लिए लिये द्वारा वाला वाली वाले है हैं हूँ हूं हो था थी थे होता होती होते होगा होगी होंगे होना होने रहा रही रहे गया गई गए सकता सकती सकते मैं मुझे मुझ मेरा मेरी मेरे हम हमें हमारा हमारी हमारे आप आपका आपकी आपके आपको तुम तुम्हारा तुम्हारी तुम्हारे यह ये वह वो वे इस उस इन उन इसका इसकी इसके उसका उसकी उसके इनका उनका इसे उसे इन्हें उन्हें अपना अपनी अपने क्या कौन कौनसा कौनसी सा सी कब कहाँ कहां कैसे कैसा कैसी क्यों कितना कितनी कितने कोई और या कि भी ही तो लेकिन परंतु अगर यदि जो जब तब न ना नहीं नही जी कृपया बताइए बताएं बताओ चाहिए નો ની નું ના ને નાં માં થી પર પરથી સુધી માટે સાથે દ્વારા વાળો વાળી વાળું વાળા છે છો છું છીએ હતો હતી હતું હતા હશે હોય હોઈ થાય થશે શકે શકો શકું હું મને મારો મારી મારું મારા અમે અમને અમારો અમારી અમારું અમારા આપણે આપણો તમે તમને તમારો તમારી તમારું તમારા આપ આપનો આપની આપનું આપના આપને તે તેઓ તેનો તેની તેનું તેના તેને આ એ આમાં એમાં શું શુ કોણ ક્યારે ક્યાં કેમ કેવી કેવું કેવો કેવા કેટલું કેટલો કેટલી કેટલા કયું કઈ કયો કયા કોઈ અને અથવા કે પણ જ તો જો ન નહીં નહિ નથી કૃપા કૃપયા કરીને જણાવો જોઈએ""".split())  # QueryFillerWords.cs
_FILLER_EDGES = "()[]{},.;:\"'?!\u0964\u0965\u201c\u201d\u2018\u2019"


def remove_filler_words(text):
    words = text.split()
    kept = [w for w in words if w.strip(_FILLER_EDGES) not in FILLER_WORDS]
    return text if len(kept) == len(words) or not kept else " ".join(kept)


def build_search_text(text, script, code_wildcard=True, max_terms=3):
    """Byte-for-byte the shape ProviderKnowledgeSearchService.BuildSearchText produces."""
    text = remove_filler_words(text)
    parts = [escape_simple(text)]

    ascii_form = fold_digits_to_ascii(text)
    if ascii_form != text:
        parts.append(escape_simple(ascii_form))
    zero = _DIGIT_ZEROS.get(script)
    if zero is not None:
        native = map_ascii_digits(text, zero)
        if native != text:
            parts.append(escape_simple(native))

    if code_wildcard:
        seen, appended = set(), 0
        for raw in text.split(" "):
            if appended >= max_terms:
                break
            token = raw.strip("(),.;:\"'?!")
            if not looks_like_code(token) or token.lower() in seen:
                continue
            seen.add(token.lower())
            parts.append(escape_simple(token.lower()) + "*")
            appended += 1

    return " ".join(p for p in parts if p)


def build_filter(business_id, doc_ids, use_vector):
    f = "businessId eq '%s'" % business_id.replace("'", "''")
    if doc_ids:
        f += " and search.in(docId, '%s', '|')" % "|".join(doc_ids)
    if use_vector:
        f += " and hasEmbedding eq true"
    return f


def probe(business_id, question, script="Latn", top_k=8, cjk=False, doc_ids=None, keyword_only=False):
    text = question.strip()[:MAX_QUERY_CHARS]
    vector = None if keyword_only else emb.embed([text])[0]
    use_vector = vector is not None

    body = {
        "search": build_search_text(text, script),
        "searchFields": ",".join(SEARCH_FIELDS_CJK if cjk else SEARCH_FIELDS),
        "select": ",".join(SELECT_FIELDS),
        "filter": build_filter(business_id, doc_ids, use_vector),
        "top": top_k * WINDOW_FACTOR,
        "scoringProfile": SCORING_PROFILE,
        "count": True,
    }
    if use_vector:
        body["vectorQueries"] = [{
            "kind": "vector",
            "vector": vector,
            "fields": "contentVector",
            "k": top_k * WINDOW_FACTOR,
        }]
        # No vectorFilterMode: the private plane is exhaustive KNN (D-2), and the service names none.

    # ‼️ The ALIAS, not the physical name - that is what the product queries, so a probe that named the
    # physical index would prove the wrong thing the day an alias swap happens.
    status, result = srch.call("indexes/%s/docs/search" % srch.ALIAS, body, api=srch.QUERY_API)
    return status, result, body


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("businessId")
    ap.add_argument("question")
    ap.add_argument("--script", default="Latn", help="ISO 15924 of the LEG, e.g. Gujr, Hani, Deva")
    ap.add_argument("--top", type=int, default=8)
    ap.add_argument("--cjk", action="store_true", help="include contentCjk (only after the v2 rebuild)")
    ap.add_argument("--docs", default=None, help="comma-separated answerable docIds, as the gate supplies")
    ap.add_argument("--keyword-only", action="store_true", help="no vector leg - proves BM25 on its own")
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()

    doc_ids = [d.strip() for d in args.docs.split(",")] if args.docs else None
    status, result, body = probe(args.businessId, args.question, args.script, args.top,
                                 args.cjk, doc_ids, args.keyword_only)

    if args.json:
        print(json.dumps({"status": status, "request": {k: v for k, v in body.items() if k != "vectorQueries"},
                          "result": result}, ensure_ascii=False, indent=2))
        return

    print("HTTP %s   leg=%s   vector=%s   cjk=%s" % (
        status, args.script, "off" if args.keyword_only else "on", "on" if args.cjk else "off"))
    print("search : %s" % body["search"])
    print("filter : %s" % body["filter"])
    if status != 200:
        print("ERROR  : %s" % json.dumps(result, ensure_ascii=False)[:600])
        return

    rows = result.get("value", [])
    print("hits   : %s (showing %d)" % (result.get("@odata.count"), len(rows)))
    for i, row in enumerate(rows, 1):
        content = (row.get("content") or "").replace("\n", " · ")
        print("  %2d  %.5f  %-14s %-26s %s" % (
            i, row.get("@search.score") or 0.0, row.get("chunkKind") or "?",
            (row.get("docTitle") or row.get("docName") or "")[:26], content[:110]))


if __name__ == "__main__":
    main()
